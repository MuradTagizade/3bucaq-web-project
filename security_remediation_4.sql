-- ====================================================================
-- 3bucaq / LEVEL UP — SECURITY REMEDIATION — PART 4
-- ====================================================================
-- Part 1, 2, 3 calistirildiktan SONRA calistirin. Idempotent.
--
-- Yeni is kurallari:
--   1. Hotbed paketi almaq ucun KYC statusu 'approved' olmali (buy_package).
--   2. Referral kodu/linki yalniz referrer'in EN AZ 1 aktiv paketi olduqda AKTIV:
--      - check_referral_code: aktiv paket yoxdursa valid=false
--      - handle_new_user / create_profile_if_missing: referred_by yalniz
--        aktiv-paketli referrer icin set edilir (aks halda referal itmir, sadece
--        baglanmir — "once paket al, sonra referal aktiv olsun").
-- ====================================================================

begin;

-- --------------------------------------------------------------------
-- 1. buy_package — KYC 'approved' sarti eklendi
-- --------------------------------------------------------------------
create or replace function public.buy_package(pkg_id text)
returns json security definer set search_path = public as $$
declare
  buyer_id uuid; buyer_profile record; pkg_price numeric; pkg_points numeric;
  upline_id uuid; current_depth integer := 1; parent_profile record;
  bonus_to_add numeric; rows_affected integer; visited uuid[] := '{}';
begin
  buyer_id := auth.uid();
  if buyer_id is null then return json_build_object('success', false, 'error', 'Sessiya tapilmadi.'); end if;

  if pkg_id = 'pkg19' then pkg_price := 19; pkg_points := 0.6;
  elsif pkg_id = 'pkg49' then pkg_price := 49; pkg_points := 1.5;
  elsif pkg_id = 'pkg99' then pkg_price := 99; pkg_points := 3.0;
  elsif pkg_id = 'pkg199' then pkg_price := 199; pkg_points := 6.0;
  elsif pkg_id = 'pkg399' then pkg_price := 399; pkg_points := 12.0;
  elsif pkg_id = 'pkg799' then pkg_price := 799; pkg_points := 24.0;
  else return json_build_object('success', false, 'error', 'Paket tapilmadi'); end if;

  select * into buyer_profile from public.profiles where id = buyer_id;
  if not found then return json_build_object('success', false, 'error', 'Istifadeci tapilmadi'); end if;
  if public.is_effectively_blocked(buyer_id) then return json_build_object('success', false, 'error', 'Hesabiniz bloklanib.'); end if;

  -- YENI: KYC sarti (admin haric)
  if buyer_profile.role <> 'admin' and coalesce(buyer_profile.kyc_status, 'none') <> 'approved' then
    return json_build_object('success', false, 'error', 'Paket almaq ucun KYC dogrulamasi teleb olunur.');
  end if;

  update public.profiles
    set balance = balance - pkg_price,
        active_packages = jsonb_set(coalesce(active_packages,'{}'::jsonb), array[pkg_id], 'true'::jsonb),
        package_activated_at = jsonb_set(coalesce(package_activated_at,'{}'::jsonb), array[pkg_id],
              to_jsonb(to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
    where id = buyer_id and balance >= pkg_price
      and coalesce(lower(active_packages->>pkg_id), 'false') <> 'true';
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then
    if coalesce(lower(buyer_profile.active_packages->>pkg_id),'false') = 'true' then
      return json_build_object('success', false, 'error', 'Bu paket artiq aktivdir');
    else
      return json_build_object('success', false, 'error', 'Balans kifayet etmir');
    end if;
  end if;

  insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
  values ('package_purchase', buyer_id, buyer_profile.user_code, buyer_id, buyer_profile.user_code, pkg_price, 'completed');

  -- Upline dagitim (5 hat) + self/cycle korumasi + min-1-paket
  upline_id := buyer_profile.referred_by;
  visited := array[buyer_id];
  while upline_id is not null and current_depth <= 5 loop
    exit when upline_id = any(visited);
    visited := visited || upline_id;
    select * into parent_profile from public.profiles where id = upline_id;
    if not found then exit; end if;

    if exists (select 1 from jsonb_each_text(coalesce(parent_profile.active_packages,'{}'::jsonb)) where lower(value) = 'true') then
      if pkg_points > 0 then
        update public.profiles set total_points = total_points + pkg_points where id = parent_profile.id;
        insert into public.points_history (uid, points, from_uid, from_login, package_id, line_number)
        values (parent_profile.id, pkg_points, buyer_id, buyer_profile.user_code, pkg_id, current_depth);
      end if;
      if current_depth = 1 then bonus_to_add := pkg_price * 0.10; else bonus_to_add := pkg_price * 0.01; end if;
      update public.profiles set balance = balance + bonus_to_add where id = parent_profile.id;
      insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
      values (case when current_depth = 1 then 'referral_bonus' else 'depth_bonus' end,
              buyer_id, buyer_profile.user_code, parent_profile.id, parent_profile.user_code, bonus_to_add, 'completed');
    end if;

    upline_id := parent_profile.referred_by;
    current_depth := current_depth + 1;
  end loop;

  return json_build_object('success', true);
end;
$$ language plpgsql;

-- --------------------------------------------------------------------
-- 2. check_referral_code — referrer'in EN AZ 1 aktiv paketi olmali
-- --------------------------------------------------------------------
create or replace function public.check_referral_code(p_code text)
returns json security definer set search_path = public as $$
declare ref record;
begin
  select id, active_packages into ref from public.profiles where referral_code = p_code limit 1;
  if not found then
    return json_build_object('valid', false);
  end if;
  if not exists (select 1 from jsonb_each_text(coalesce(ref.active_packages, '{}'::jsonb)) where lower(value) = 'true') then
    return json_build_object('valid', false, 'reason', 'inactive');  -- referrer'in aktiv paketi yox
  end if;
  return json_build_object('valid', true);
end;
$$ language plpgsql;

-- --------------------------------------------------------------------
-- 3. handle_new_user — referred_by yalniz aktiv-paketli referrer icin
-- --------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger security definer set search_path = public as $$
declare
  ref_code text; ref_uid uuid; user_name text; new_code text;
begin
  new_code := public.generate_user_code();
  ref_code := 'REF' || new_code;
  user_name := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1));

  if new.raw_user_meta_data->>'referral_code' is not null and new.raw_user_meta_data->>'referral_code' <> '' then
    select p.id into ref_uid from public.profiles p
      where p.referral_code = new.raw_user_meta_data->>'referral_code'
        and exists (select 1 from jsonb_each_text(coalesce(p.active_packages, '{}'::jsonb)) x where lower(x.value) = 'true')
      limit 1;
  end if;

  insert into public.profiles (
    id, email, display_login, user_code, full_name, role, referral_code,
    referred_by, country, city, phone, admin_permissions
  ) values (
    new.id, new.email, new_code, new_code, user_name, 'user', ref_code, ref_uid,
    new.raw_user_meta_data->>'country', new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'phone', '{}'::jsonb
  );
  return new;
end;
$$ language plpgsql;

-- --------------------------------------------------------------------
-- 4. create_profile_if_missing — ayni referral-paket sarti
-- --------------------------------------------------------------------
create or replace function public.create_profile_if_missing()
returns json security definer set search_path = public as $$
declare
  ref_uid uuid; ref_code text; user_name text; new_code text; p_exists boolean; curr_user auth.users%rowtype;
begin
  if auth.uid() is null then return json_build_object('success', false, 'error', 'Not authenticated'); end if;
  select exists(select 1 from public.profiles where id = auth.uid()) into p_exists;
  if p_exists then return json_build_object('success', true, 'message', 'exists'); end if;

  select * into curr_user from auth.users where id = auth.uid();
  new_code := public.generate_user_code();
  ref_code := 'REF' || new_code;
  user_name := coalesce(nullif(curr_user.raw_user_meta_data->>'full_name', ''), split_part(curr_user.email, '@', 1));

  if curr_user.raw_user_meta_data->>'referral_code' is not null and curr_user.raw_user_meta_data->>'referral_code' <> '' then
    select p.id into ref_uid from public.profiles p
      where p.referral_code = curr_user.raw_user_meta_data->>'referral_code'
        and exists (select 1 from jsonb_each_text(coalesce(p.active_packages, '{}'::jsonb)) x where lower(x.value) = 'true')
      limit 1;
  end if;

  insert into public.profiles (id, email, display_login, user_code, full_name, role, referral_code, referred_by, country, city, phone)
  values (curr_user.id, curr_user.email, new_code, new_code, user_name, 'user', ref_code, ref_uid,
          curr_user.raw_user_meta_data->>'country', curr_user.raw_user_meta_data->>'city', curr_user.raw_user_meta_data->>'phone');
  return json_build_object('success', true, 'message', 'created');
end;
$$ language plpgsql;

commit;
