-- ====================================================================
-- 3bucaq — Remove Transfer Balance and Use Single Main Balance
-- Run this script in the Supabase Dashboard SQL Editor.
--
-- Changes:
-- 1. transfer_funds: uses main balance instead of transfer_balance
-- 2. buy_package: deducts from main balance
-- 3. create_level_claim: bonus goes to main balance
-- 4. create_withdrawal: deducts from main balance
-- 5. referral/depth bonuses: go to main balance
-- 6. deactivate_package: adds package price back to main balance
-- ====================================================================


-- 1. TRANSFER FUNDS — uses main balance
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
  sender_id := auth.uid();
  if sender_id is null then
    return json_build_object('success', false, 'error', 'Sessiya tapılmadı. Yenidən daxil olun.');
  end if;

  parsed_amount := amount;
  if parsed_amount <= 0 then
    return json_build_object('success', false, 'error', 'Məbləğ düzgün deyil');
  end if;

  select * into sender_profile from public.profiles where id = sender_id;
  if not found then
    return json_build_object('success', false, 'error', 'Göndərən istifadəçi tapılmadı');
  end if;

  -- Check main balance
  if sender_profile.balance < parsed_amount then
    return json_build_object('success', false, 'error', 'Balans kifayət etmir');
  end if;

  select * into recipient_profile from public.profiles where display_login = to_login;
  if not found then
    return json_build_object('success', false, 'error', 'Qəbul edən istifadəçi tapılmadı');
  end if;

  if sender_id = recipient_profile.id then
    return json_build_object('success', false, 'error', 'Özünüzə köçürmə edə bilməzsiniz');
  end if;

  -- Deduct from sender main balance
  update public.profiles
    set balance = balance - parsed_amount
    where id = sender_id;

  -- Add to recipient main balance
  update public.profiles
    set balance = balance + parsed_amount
    where id = recipient_profile.id;

  insert into public.transactions (
    type, from_uid, from_login, to_uid, to_login, amount, status
  ) values (
    'transfer', sender_id, sender_profile.display_login, recipient_profile.id, recipient_profile.display_login, parsed_amount, 'completed'
  );

  return json_build_object('success', true);
end;
$$ language plpgsql;


-- 2. BUY PACKAGE — deduct from main balance
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

  select * into buyer_profile from public.profiles where id = buyer_id;
  if not found then
    return json_build_object('success', false, 'error', 'İstifadəçi tapılmadı');
  end if;

  -- Check main balance
  if buyer_profile.balance < pkg_price then
    return json_build_object('success', false, 'error', 'Balans kifayət etmir');
  end if;

  -- Check if already active
  if coalesce((buyer_profile.active_packages->>pkg_id)::boolean, false) = true then
    return json_build_object('success', false, 'error', 'Bu paket artıq aktivdir');
  end if;

  -- Deduct from main balance
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

    -- Check if parent has any active packages
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

      -- 2. USD Bonuses → main balance
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
        -- 1% Depth bonus (lines 2-5) → main balance
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


-- 3. CREATE LEVEL CLAIM — bonus goes to main balance
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

  -- Deduct points, credit main balance, update level
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

  -- Record level claim (auto-approved)
  insert into public.level_claims (
    uid, login, level, bonus_amount, claim_type, status, approved_at
  ) values (
    user_id, user_profile.display_login, claim_level, bonus_amt, 'balance', 'done', now()
  );

  return json_build_object('success', true);
end;
$$ language plpgsql;


-- 4. CREATE WITHDRAWAL — deduct from main balance
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

  -- Check main balance
  if user_profile.balance < parsed_amount then
    return json_build_object('success', false, 'error', 'Balans kifayət etmir');
  end if;

  -- Deduct from main balance
  update public.profiles
    set balance = balance - parsed_amount
    where id = user_id;

  insert into public.withdrawals (
    uid, login, amount, crypto_address, network, payment_method, card_number, status
  ) values (
    user_id, user_profile.display_login, parsed_amount, crypto_address, network, payment_method, card_number, 'pending'
  );

  insert into public.transactions (
    type, from_uid, from_login, to_uid, to_login, amount, status
  ) values (
    'withdrawal', user_id, user_profile.display_login, null, coalesce(card_number, crypto_address), parsed_amount, 'completed'
  );

  return json_build_object('success', true);
end;
$$ language plpgsql;


-- 5. DEACTIVATE PACKAGE — add back to main balance
create or replace function public.deactivate_package(
  pkg_id text
)
returns json
security definer
set search_path = public
as $$
declare
  user_id uuid;
  user_profile record;
  pkg_price numeric;
  lock_days integer;
  activated_at_text text;
  activated_at_ts timestamp with time zone;
  unlock_date timestamp with time zone;
begin
  user_id := auth.uid();
  if user_id is null then
    return json_build_object('success', false, 'error', 'Sessiya tapılmadı. Yenidən daxil olun.');
  end if;

  -- Determine price and lock period
  if pkg_id = 'pkg19' then
    pkg_price := 19; lock_days := 180;
  elsif pkg_id = 'pkg49' then
    pkg_price := 49; lock_days := 180;
  elsif pkg_id = 'pkg99' then
    pkg_price := 99; lock_days := 180;
  elsif pkg_id = 'pkg199' then
    pkg_price := 199; lock_days := 180;
  elsif pkg_id = 'pkg399' then
    pkg_price := 399; lock_days := 120;
  elsif pkg_id = 'pkg799' then
    pkg_price := 799; lock_days := 120;
  else
    return json_build_object('success', false, 'error', 'Paket tapılmadı');
  end if;

  select * into user_profile from public.profiles where id = user_id;
  if not found then
    return json_build_object('success', false, 'error', 'İstifadəçi tapılmadı');
  end if;

  -- Check if package is active
  if coalesce((user_profile.active_packages->>pkg_id)::boolean, false) = false then
    return json_build_object('success', false, 'error', 'Bu paket aktiv deyil');
  end if;

  -- Check activation date
  activated_at_text := user_profile.package_activated_at->>pkg_id;
  if activated_at_text is null then
    return json_build_object('success', false, 'error', 'Paketin aktivləşmə tarixi tapılmadı');
  end if;

  activated_at_ts := activated_at_text::timestamp with time zone;
  unlock_date := activated_at_ts + (lock_days || ' days')::interval;

  -- Check if lock period has passed
  if now() < unlock_date then
    return json_build_object(
      'success', false, 
      'error', 'Kilid müddəti hələ dolmayıb',
      'unlock_date', to_char(unlock_date, 'YYYY-MM-DD'),
      'days_remaining', ceil(extract(epoch from (unlock_date - now())) / 86400)
    );
  end if;

  -- Deactivate: add back to main balance
  update public.profiles
    set active_packages = jsonb_set(active_packages, array[pkg_id], 'false'::jsonb),
        balance = balance + pkg_price
    where id = user_id;

  -- Record transaction
  insert into public.transactions (
    type, from_uid, from_login, to_uid, to_login, amount, status
  ) values (
    'package_unlock', user_id, user_profile.display_login, user_id, user_profile.display_login, pkg_price, 'completed'
  );

  return json_build_object('success', true);
end;
$$ language plpgsql;
