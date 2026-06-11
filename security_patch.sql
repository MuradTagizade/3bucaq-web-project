-- ====================================================================
-- 3bucaq — Database Security Patch
-- Run this script in the Supabase Dashboard SQL Editor.
-- This script secures the database from balance hacking, free packages,
-- and faked level claims by moving logic to database-level RPC functions.
-- ====================================================================

-- 1. Secure existing helper functions by setting search_path and security definer
create or replace function public.is_admin()
returns boolean 
security definer 
set search_path = public 
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql;

create or replace function public.create_profile_if_missing()
returns json 
security definer 
set search_path = public 
as $$
declare
  ref_code text;
  user_login text;
  p_exists boolean;
  curr_user auth.users%rowtype;
begin
  -- Check if user is authenticated
  if auth.uid() is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  -- Check if profile already exists
  select exists(select 1 from public.profiles where id = auth.uid()) into p_exists;
  if p_exists then
    return json_build_object('success', true, 'message', 'Profile already exists');
  end if;

  -- Get auth user details
  select * into curr_user from auth.users where id = auth.uid();

  -- Generate unique referral code
  ref_code := 'REF' || lpad(floor(random() * 100000)::text, 5, '0');
  
  -- Extract login
  user_login := coalesce(
    curr_user.raw_user_meta_data->>'display_login',
    split_part(curr_user.email, '@', 1)
  );

  insert into public.profiles (
    id, email, display_login, full_name, role, referral_code, 
    country, city, phone
  ) values (
    curr_user.id, 
    curr_user.email, 
    user_login,
    coalesce(curr_user.raw_user_meta_data->>'full_name', user_login), 
    'user', 
    ref_code,
    curr_user.raw_user_meta_data->>'country',
    curr_user.raw_user_meta_data->>'city',
    curr_user.raw_user_meta_data->>'phone'
  );

  return json_build_object('success', true, 'message', 'Profile created successfully');
end;
$$ language plpgsql;


-- 2. Create secure RPC function for Transfer Funds
create or replace function public.transfer_funds(
  to_login text,
  amount numeric
)
returns json
security definer
set search_path = public
as $$
declare
  sender_id uuid;
  sender_profile record;
  recipient_profile record;
  parsed_amount numeric;
begin
  -- Get sender ID from auth context
  sender_id := auth.uid();
  if sender_id is null then
    return json_build_object('success', false, 'error', 'Sessiya tapılmadı. Yenidən daxil olun.');
  end if;

  parsed_amount := amount;
  if parsed_amount <= 0 then
    return json_build_object('success', false, 'error', 'Məbləğ düzgün deyil');
  end if;

  -- Get sender profile
  select * into sender_profile from public.profiles where id = sender_id;
  if not found then
    return json_build_object('success', false, 'error', 'Göndərən istifadəçi tapılmadı');
  end if;

  if sender_profile.balance < parsed_amount then
    return json_build_object('success', false, 'error', 'Balans kifayət etmir');
  end if;

  -- Get recipient profile
  select * into recipient_profile from public.profiles where display_login = to_login;
  if not found then
    return json_build_object('success', false, 'error', 'Qəbul edən istifadəçi tapılmadı');
  end if;

  if sender_id = recipient_profile.id then
    return json_build_object('success', false, 'error', 'Özünüzə köçürmə edə bilməzsiniz');
  end if;

  -- Deduct from sender balance
  update public.profiles
    set balance = balance - parsed_amount
    where id = sender_id;

  -- Add to recipient balance
  update public.profiles
    set balance = balance + parsed_amount
    where id = recipient_profile.id;

  -- Create transaction record
  insert into public.transactions (
    type, from_uid, from_login, to_uid, to_login, amount, status
  ) values (
    'transfer', sender_id, sender_profile.display_login, recipient_profile.id, recipient_profile.display_login, parsed_amount, 'completed'
  );

  return json_build_object('success', true);
end;
$$ language plpgsql;


-- 3. Create secure RPC function for Buy Package
create or replace function public.buy_package(
  pkg_id text
)
returns json
security definer
set search_path = public
as $$
declare
  buyer_id uuid;
  buyer_profile record;
  pkg_price numeric;
  pkg_points numeric;
  upline_id uuid;
  current_depth integer := 1;
  parent_profile record;
  points_to_add numeric;
  bonus_to_add numeric;
begin
  buyer_id := auth.uid();
  if buyer_id is null then
    return json_build_object('success', false, 'error', 'Sessiya tapılmadı. Yenidən daxil olun.');
  end if;

  -- Determine price and points
  if pkg_id = 'pkg19' then
    pkg_price := 19; pkg_points := 0.6;
  elsif pkg_id = 'pkg49' then
    pkg_price := 49; pkg_points := 1.5;
  elsif pkg_id = 'pkg99' then
    pkg_price := 99; pkg_points := 3.0;
  elsif pkg_id = 'pkg199' then
    pkg_price := 199; pkg_points := 6.0;
  elsif pkg_id = 'pkg399' then
    pkg_price := 399; pkg_points := 12.0;
  elsif pkg_id = 'pkg799' then
    pkg_price := 799; pkg_points := 24.0;
  else
    return json_build_object('success', false, 'error', 'Paket tapılmadı');
  end if;

  -- Get buyer profile
  select * into buyer_profile from public.profiles where id = buyer_id;
  if not found then
    return json_build_object('success', false, 'error', 'İstifadəçi tapılmadı');
  end if;

  if buyer_profile.balance < pkg_price then
    return json_build_object('success', false, 'error', 'Balans kifayət etmir');
  end if;

  -- Update buyer balance and active packages
  update public.profiles
    set balance = balance - pkg_price,
        active_packages = jsonb_set(active_packages, array[pkg_id], 'true'::jsonb),
        package_activated_at = jsonb_set(package_activated_at, array[pkg_id], to_jsonb(to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
    where id = buyer_id;

  -- Record purchase transaction
  insert into public.transactions (
    type, from_uid, from_login, to_uid, to_login, amount, status
  ) values (
    'package_purchase', buyer_id, buyer_profile.display_login, buyer_id, buyer_profile.display_login, pkg_price, 'completed'
  );

  -- Distribute referral bonuses and points to upline (up to 5 lines)
  upline_id := buyer_profile.referred_by;
  while upline_id is not null and current_depth <= 5 loop
    select * into parent_profile from public.profiles where id = upline_id;
    if not found then
      exit;
    end if;

    -- Check if parent has any active packages (requirement to earn bonuses)
    if exists (
      select 1 from jsonb_each_text(parent_profile.active_packages) where value = 'true'
    ) then
      -- 1. Points distribution
      points_to_add := pkg_points;
      if points_to_add > 0 then
        update public.profiles
          set total_points = total_points + points_to_add
          where id = parent_profile.id;

        insert into public.points_history (
          uid, points, from_uid, from_login, package_id, line_number
        ) values (
          parent_profile.id, points_to_add, buyer_id, buyer_profile.display_login, pkg_id, current_depth
        );
      end if;

      -- 2. USD Bonuses
      if current_depth = 1 then
        -- 10% First-line bonus if parent has pkg19, pkg49, pkg99, and pkg199 active
        if coalesce((parent_profile.active_packages->>'pkg19')::boolean, false) = true
           and coalesce((parent_profile.active_packages->>'pkg49')::boolean, false) = true
           and coalesce((parent_profile.active_packages->>'pkg99')::boolean, false) = true
           and coalesce((parent_profile.active_packages->>'pkg199')::boolean, false) = true then
          
          bonus_to_add := pkg_price * 0.10;
          update public.profiles
            set balance = balance + bonus_to_add
            where id = parent_profile.id;

          insert into public.transactions (
            type, from_uid, from_login, to_uid, to_login, amount, status
          ) values (
            'referral_bonus', buyer_id, buyer_profile.display_login, parent_profile.id, parent_profile.display_login, bonus_to_add, 'completed'
          );
        end if;
      else
        -- 1% Depth bonus (lines 2-5)
        bonus_to_add := pkg_price * 0.01;
        update public.profiles
          set balance = balance + bonus_to_add
          where id = parent_profile.id;

        insert into public.transactions (
          type, from_uid, from_login, to_uid, to_login, amount, status
        ) values (
          'depth_bonus', buyer_id, buyer_profile.display_login, parent_profile.id, parent_profile.display_login, bonus_to_add, 'completed'
        );
      end if;
    end if;

    upline_id := parent_profile.referred_by;
    current_depth := current_depth + 1;
  end loop;

  return json_build_object('success', true);
end;
$$ language plpgsql;


-- 4. Create secure RPC function for Claim Level
create or replace function public.create_level_claim(
  claim_level integer
)
returns json
security definer
set search_path = public
as $$
declare
  user_id uuid;
  user_profile record;
  req_points numeric;
  bonus_amt numeric;
  user_points numeric;
  has_pkgs boolean;
  already_claimed boolean;
begin
  user_id := auth.uid();
  if user_id is null then
    return json_build_object('success', false, 'error', 'Sessiya tapılmadı. Yenidən daxil olun.');
  end if;

  -- Resolve level details
  if claim_level = 1 then req_points := 30; bonus_amt := 99;
  elsif claim_level = 2 then req_points := 109; bonus_amt := 299;
  elsif claim_level = 3 then req_points := 268; bonus_amt := 499;
  elsif claim_level = 4 then req_points := 597; bonus_amt := 999;
  elsif claim_level = 5 then req_points := 1266; bonus_amt := 1999;
  elsif claim_level = 6 then req_points := 2615; bonus_amt := 4399;
  elsif claim_level = 7 then req_points := 5314; bonus_amt := 8999;
  elsif claim_level = 8 then req_points := 10723; bonus_amt := 18999;
  elsif claim_level = 9 then req_points := 21552; bonus_amt := 39999;
  elsif claim_level = 10 then req_points := 43321; bonus_amt := 72999;
  else
    return json_build_object('success', false, 'error', 'Səviyyə məlumatı tapılmadı');
  end if;

  -- Get user profile
  select * into user_profile from public.profiles where id = user_id;
  if not found then
    return json_build_object('success', false, 'error', 'İstifadəçi tapılmadı');
  end if;

  -- Check if level already claimed
  select exists (
    select 1 from public.level_claims
    where uid = user_id and level = claim_level and status in ('pending', 'done')
  ) into already_claimed;

  if already_claimed then
    return json_build_object('success', false, 'error', 'Bu səviyyə artıq istifadə olunub');
  end if;

  -- Check points
  user_points := coalesce(user_profile.total_points, 0);
  if user_points < req_points then
    return json_build_object('success', false, 'error', 'Kifayət qədər xalınız yoxdur');
  end if;

  -- Check packages requirements
  has_pkgs := true;
  if claim_level in (2, 3, 4) then
    if not (coalesce((user_profile.active_packages->>'pkg19')::boolean, false) = true
       and coalesce((user_profile.active_packages->>'pkg49')::boolean, false) = true) then
      has_pkgs := false;
    end if;
  elsif claim_level in (5, 6) then
    if not (coalesce((user_profile.active_packages->>'pkg19')::boolean, false) = true
       and coalesce((user_profile.active_packages->>'pkg49')::boolean, false) = true
       and coalesce((user_profile.active_packages->>'pkg99')::boolean, false) = true) then
      has_pkgs := false;
    end if;
  elsif claim_level = 7 then
    if not (coalesce((user_profile.active_packages->>'pkg19')::boolean, false) = true
       and coalesce((user_profile.active_packages->>'pkg49')::boolean, false) = true
       and coalesce((user_profile.active_packages->>'pkg99')::boolean, false) = true
       and coalesce((user_profile.active_packages->>'pkg199')::boolean, false) = true) then
      has_pkgs := false;
    end if;
  elsif claim_level in (8, 9, 10) then
    if not (coalesce((user_profile.active_packages->>'pkg19')::boolean, false) = true
       and coalesce((user_profile.active_packages->>'pkg49')::boolean, false) = true
       and coalesce((user_profile.active_packages->>'pkg99')::boolean, false) = true
       and coalesce((user_profile.active_packages->>'pkg199')::boolean, false) = true
       and coalesce((user_profile.active_packages->>'pkg399')::boolean, false) = true) then
      has_pkgs := false;
    end if;
  end if;

  if not has_pkgs then
    return json_build_object('success', false, 'error', 'Tələb olunan paketlər aktiv deyil');
  end if;

  -- Deduct points and credit balance
  update public.profiles
    set total_points = total_points - req_points,
        claimed_levels = claimed_levels || to_jsonb(claim_level),
        balance = balance + bonus_amt,
        current_level = greatest(current_level, claim_level)
    where id = user_id;

  -- Record point deduction in points_history
  if req_points > 0 then
    insert into public.points_history (
      uid, points, from_uid, from_login, package_id, line_number
    ) values (
      user_id, -req_points, null, 'Level Claim', 'level_' || claim_level, 0
    );
  end if;

  -- Record transaction
  insert into public.transactions (
    type, from_uid, from_login, to_uid, to_login, amount, status
  ) values (
    'level_bonus', null, 'System', user_id, user_profile.display_login, bonus_amt, 'completed'
  );

  -- Record level claim request
  insert into public.level_claims (
    uid, login, level, bonus_amount, claim_type, status, approved_at
  ) values (
    user_id, user_profile.display_login, claim_level, bonus_amt, 'balance', 'done', now()
  );

  return json_build_object('success', true);
end;
$$ language plpgsql;


-- 5. Create secure RPC function for Create Withdrawal
create or replace function public.create_withdrawal(
  amount numeric,
  crypto_address text,
  network text,
  payment_method text,
  card_number text
)
returns json
security definer
set search_path = public
as $$
declare
  user_id uuid;
  user_profile record;
  parsed_amount numeric;
begin
  user_id := auth.uid();
  if user_id is null then
    return json_build_object('success', false, 'error', 'Sessiya tapılmadı. Yenidən daxil olun.');
  end if;

  parsed_amount := amount;
  if parsed_amount <= 0 then
    return json_build_object('success', false, 'error', 'Məbləğ müsbət olmalıdır');
  end if;

  select * into user_profile from public.profiles where id = user_id;
  if not found then
    return json_build_object('success', false, 'error', 'İstifadəçi tapılmadı');
  end if;

  if user_profile.balance < parsed_amount then
    return json_build_object('success', false, 'error', 'Balans kifayət etmir');
  end if;

  -- Deduct from balance
  update public.profiles
    set balance = balance - parsed_amount
    where id = user_id;

  -- Record in withdrawals table
  insert into public.withdrawals (
    uid, login, amount, crypto_address, network, payment_method, card_number, status
  ) values (
    user_id, user_profile.display_login, parsed_amount, crypto_address, network, payment_method, card_number, 'pending'
  );

  -- Record in transactions table
  insert into public.transactions (
    type, from_uid, from_login, to_uid, to_login, amount, status
  ) values (
    'withdrawal', user_id, user_profile.display_login, null, coalesce(card_number, crypto_address), parsed_amount, 'completed'
  );

  return json_build_object('success', true);
end;
$$ language plpgsql;


-- 6. Trigger to prevent direct client updates of role, balance, points, packages, blocked status
create or replace function public.check_profile_updates()
returns trigger
security definer
set search_path = public
as $$
declare
  is_admin_user boolean;
begin
  -- Check if the action is run by service_role (system) or superuser
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return NEW;
  end if;

  -- Check if the auth user is an admin
  is_admin_user := public.is_admin();

  if not is_admin_user then
    -- A regular user is attempting to update a row
    -- They can only update their own row (enforced by RLS)
    -- We must ensure they do not alter financial/permission columns
    if NEW.role <> OLD.role then
      raise exception 'İcazə yoxdur: Rolunuzu dəyişə bilməzsiniz';
    end if;
    if NEW.balance <> OLD.balance then
      raise exception 'İcazə yoxdur: Balansınızı birbaşa dəyişə bilməzsiniz';
    end if;
    if NEW.transfer_balance <> OLD.transfer_balance then
      raise exception 'İcazə yoxdur: Transfer balansınızı birbaşa dəyişə bilməzsiniz';
    end if;
    if NEW.total_points <> OLD.total_points then
      raise exception 'İcazə yoxdur: Xallarınızı birbaşa dəyişə bilməzsiniz';
    end if;
    if NEW.active_packages <> OLD.active_packages then
      raise exception 'İcazə yoxdur: Paketlərinizi birbaşa dəyişə bilməzsiniz';
    end if;
    if NEW.package_activated_at <> OLD.package_activated_at then
      raise exception 'İcazə yoxdur: Paket aktivasiya tarixini dəyişə bilməzsiniz';
    end if;
    if NEW.is_blocked <> OLD.is_blocked or NEW.blocked_until <> OLD.blocked_until then
      raise exception 'İcazə yoxdur: Blok statusunu dəyişə bilməzsiniz';
    end if;
    if NEW.kyc_status <> OLD.kyc_status then
      -- Allow user to submit KYC (change from none/rejected to pending)
      -- But do not allow them to set it to approved or rejected
      if NEW.kyc_status not in ('none', 'pending') then
        raise exception 'İcazə yoxdur: KYC statusunu təsdiqləyə və ya rədd edə bilməzsiniz';
      end if;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql;

drop trigger if exists tr_check_profile_updates on public.profiles;
create trigger tr_check_profile_updates
  before update on public.profiles
  for each row execute procedure public.check_profile_updates();

-- ====================================================================
-- 7. Enable Row Level Security (RLS) and define Policies
-- ====================================================================

-- profiles
alter table public.profiles enable row level security;

drop policy if exists "Allow authenticated read access to profiles" on public.profiles;
create policy "Allow authenticated read access to profiles"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Allow users to update their own profiles" on public.profiles;
create policy "Allow users to update their own profiles"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- transactions
alter table public.transactions enable row level security;

drop policy if exists "Users can view their own transactions" on public.transactions;
create policy "Users can view their own transactions"
  on public.transactions for select
  to authenticated
  using (auth.uid() = from_uid or auth.uid() = to_uid or public.is_admin());

drop policy if exists "Admins can manage transactions" on public.transactions;
create policy "Admins can manage transactions"
  on public.transactions for all
  to authenticated
  using (public.is_admin());

-- points_history
alter table public.points_history enable row level security;

drop policy if exists "Users can view their own points history" on public.points_history;
create policy "Users can view their own points history"
  on public.points_history for select
  to authenticated
  using (auth.uid() = uid or public.is_admin());

drop policy if exists "Admins can manage points history" on public.points_history;
create policy "Admins can manage points history"
  on public.points_history for all
  to authenticated
  using (public.is_admin());

-- level_claims
alter table public.level_claims enable row level security;

drop policy if exists "Users can view their own level claims" on public.level_claims;
create policy "Users can view their own level claims"
  on public.level_claims for select
  to authenticated
  using (auth.uid() = uid or public.is_admin());

drop policy if exists "Admins can manage level claims" on public.level_claims;
create policy "Admins can manage level claims"
  on public.level_claims for all
  to authenticated
  using (public.is_admin());

-- deposits
alter table public.deposits enable row level security;

drop policy if exists "Users can view their own deposits" on public.deposits;
create policy "Users can view their own deposits"
  on public.deposits for select
  to authenticated
  using (auth.uid() = uid or public.is_admin());

drop policy if exists "Users can create their own pending deposits" on public.deposits;
create policy "Users can create their own pending deposits"
  on public.deposits for insert
  to authenticated
  with check (auth.uid() = uid and status = 'pending');

drop policy if exists "Admins can manage deposits" on public.deposits;
create policy "Admins can manage deposits"
  on public.deposits for all
  to authenticated
  using (public.is_admin());

-- withdrawals
alter table public.withdrawals enable row level security;

drop policy if exists "Users can view their own withdrawals" on public.withdrawals;
create policy "Users can view their own withdrawals"
  on public.withdrawals for select
  to authenticated
  using (auth.uid() = uid or public.is_admin());

drop policy if exists "Admins can manage withdrawals" on public.withdrawals;
create policy "Admins can manage withdrawals"
  on public.withdrawals for all
  to authenticated
  using (public.is_admin());

-- system_settings
alter table public.system_settings enable row level security;

drop policy if exists "Allow authenticated read to system settings" on public.system_settings;
create policy "Allow authenticated read to system settings"
  on public.system_settings for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage system settings" on public.system_settings;
create policy "Admins can manage system settings"
  on public.system_settings for all
  to authenticated
  using (public.is_admin());

-- admin_logs
alter table public.admin_logs enable row level security;

drop policy if exists "Only admins can view admin logs" on public.admin_logs;
create policy "Only admins can view admin logs"
  on public.admin_logs for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Only admins can insert admin logs" on public.admin_logs;
create policy "Only admins can insert admin logs"
  on public.admin_logs for insert
  to authenticated
  with check (public.is_admin());

