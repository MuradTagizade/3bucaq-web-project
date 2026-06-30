-- ====================================================================
-- LEVEL UP — Referral & Hotbed Package Fix Script
-- Run this in Supabase Dashboard → SQL Editor
--
-- Fixes:
-- 1. create_profile_if_missing() — now resolves referred_by from referral_code
-- 2. buy_package() — robust JSONB boolean check for "already active" packages
-- 3. deactivate_package() — same robust JSONB check
-- ====================================================================


-- ============================================
-- 1. FIX: create_profile_if_missing()
-- Previously this function did NOT resolve the referral code
-- from raw_user_meta_data, leaving referred_by as NULL.
-- Now it mirrors the handle_new_user trigger logic.
-- ============================================
create or replace function public.create_profile_if_missing()
returns json
security definer
set search_path = public
as $$
declare
  ref_code text;
  ref_uid uuid;
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

  -- Resolve referred_by from the referral code in user metadata
  if curr_user.raw_user_meta_data->>'referral_code' is not null 
     and curr_user.raw_user_meta_data->>'referral_code' != '' then
    select id into ref_uid from public.profiles
      where referral_code = curr_user.raw_user_meta_data->>'referral_code'
      limit 1;
  end if;

  insert into public.profiles (
    id, email, display_login, full_name, role, referral_code, 
    referred_by, country, city, phone
  ) values (
    curr_user.id, 
    curr_user.email, 
    user_login,
    coalesce(curr_user.raw_user_meta_data->>'full_name', user_login), 
    'user', 
    ref_code,
    ref_uid,
    curr_user.raw_user_meta_data->>'country',
    curr_user.raw_user_meta_data->>'city',
    curr_user.raw_user_meta_data->>'phone'
  );

  return json_build_object('success', true, 'message', 'Profile created successfully');
end;
$$ language plpgsql;


-- ============================================
-- 2. FIX: buy_package()
-- The "already active" check now handles both JSONB true (boolean)
-- and "true" (string) values robustly. Also ensures all referral
-- bonus logic uses the same robust check for parent active packages.
-- ============================================
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
  pkg_status text;
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

  -- Check if already active (handles both JSONB boolean true and string "true")
  pkg_status := buyer_profile.active_packages->>pkg_id;
  if pkg_status is not null and lower(pkg_status) = 'true' then
    return json_build_object('success', false, 'error', 'Bu paket artıq aktivdir');
  end if;

  -- Deduct from main balance and activate package
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

    -- Check if parent has any active packages (robust check for both boolean and string)
    if exists (
      select 1 from jsonb_each_text(parent_profile.active_packages) where lower(value) = 'true'
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
        if lower(coalesce(parent_profile.active_packages->>'pkg19', 'false')) = 'true'
           and lower(coalesce(parent_profile.active_packages->>'pkg49', 'false')) = 'true'
           and lower(coalesce(parent_profile.active_packages->>'pkg99', 'false')) = 'true'
           and lower(coalesce(parent_profile.active_packages->>'pkg199', 'false')) = 'true' then
          
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


-- ============================================
-- 3. DISABLE: deactivate_package()
-- Manual deactivation is disabled since investment packages are lifetime
-- and earning packages automatically expire after 120 days.
-- ============================================
create or replace function public.deactivate_package(
  pkg_id text
)
returns json
security definer
set search_path = public
as $$
begin
  return json_build_object('success', false, 'error', 'Paketləri əl ilə deaktiv etmək mümkün deyil.');
end;
$$ language plpgsql;
