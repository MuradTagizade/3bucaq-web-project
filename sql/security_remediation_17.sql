-- ====================================================================
-- LEVEL UP — security_remediation_17.sql
-- REFERAL "BİR DƏFƏ AL, ÖMÜRLÜK AÇIL" MODELİ
-- --------------------------------------------------------------------
-- İstifadəçi istəyi (2026-07-07): İstifadəçinin referal linkini AKTİV etməsi
-- üçün BİR DƏFƏ hotbed paketi alması KİFAYƏTDİR. Level keçidində paketlər
-- sönsə də (§22), həm referal LİNKİ, həm də referal BONUS QAZANCI işləməyə
-- davam etməlidir. Yəni artıq şərt "cari aktiv paket" DEYİL, "heç vaxt ≥1
-- paket almış olmaq"dır (kalıcı `referral_unlocked` bayrağı).
--
-- Bu fayl §16-dakı "referal tam paketsiz" davranışını dəqiqləşdirir:
--   - referral_unlocked bayrağı əlavə olunur (ilk buy_package-də true olur).
--   - buy_package upline bonus/xal paylanması artıq upline-ın referral_unlocked
--     olmasına baxır (əvvəl "cari aktiv paket").
--   - check_referral_code / handle_new_user / create_profile_if_missing artıq
--     referrer'in referral_unlocked olmasına baxır.
--   - check_profile_updates: referral_unlocked client tərəfindən dəyişdirilə bilməz.
-- _8 (buy_package), _16 (check_referral_code/handle_new_user/create_profile_if_missing),
-- _15 (check_profile_updates) tanımlarını əvəz edir. Part 6 whitelist grant qorunur.
-- ====================================================================

begin;

-- --------------------------------------------------------------------
-- 1. referral_unlocked sütunu + mövcud alıcıların backfill-i
--    (heç vaxt paket alan VƏ ya hazırda aktiv paketi olan → unlocked)
-- --------------------------------------------------------------------
alter table public.profiles
  add column if not exists referral_unlocked boolean not null default false;

update public.profiles p set referral_unlocked = true
where p.referral_unlocked = false
  and (
    exists (select 1 from public.transactions t
              where t.type = 'package_purchase' and t.from_uid = p.id)
    or exists (select 1 from jsonb_each_text(coalesce(p.active_packages, '{}'::jsonb)) x
                 where lower(x.value) = 'true')
  );

-- --------------------------------------------------------------------
-- 2. check_profile_updates — referral_unlocked SİSTEM sütunu (_15-i əvəz edir)
--    (INVOKER trigger; yalnız definer RPC dəyişə bilər)
-- --------------------------------------------------------------------
create or replace function public.check_profile_updates()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare is_admin_user boolean;
begin
  -- KYC onayinda identity_number otomatik set (admin yolu)
  if NEW.kyc_status = 'approved' and OLD.kyc_status is distinct from 'approved' then
    NEW.identity_number := coalesce(NEW.kyc_document_number, OLD.kyc_document_number);
  end if;

  -- SECURITY DEFINER RPC'ler (postgres/service_role) — tam bypass
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return NEW;
  end if;

  -- (A) Sistem/finans sutunlari: HICBIR dogrudan client yazamaz (admin dahil).
  if NEW.balance is distinct from OLD.balance
     or NEW.total_points is distinct from OLD.total_points
     or NEW.active_packages is distinct from OLD.active_packages
     or NEW.package_activated_at is distinct from OLD.package_activated_at
     or NEW.current_level is distinct from OLD.current_level
     or NEW.claimed_levels is distinct from OLD.claimed_levels
     or NEW.referral_unlocked is distinct from OLD.referral_unlocked
     or NEW.user_code is distinct from OLD.user_code
     or NEW.referred_by is distinct from OLD.referred_by
     or NEW.referral_code is distinct from OLD.referral_code
     or NEW.last_daily_earning_date is distinct from OLD.last_daily_earning_date then
    raise exception 'Icaze yoxdur: Bu sahe yalniz sistem emeliyyatlari ile deyise biler';
  end if;

  -- (B) role + admin_permissions: yalniz superadmin
  if NEW.role is distinct from OLD.role or NEW.admin_permissions is distinct from OLD.admin_permissions then
    if not public.is_superadmin() then
      raise exception 'Icaze yoxdur: Rol/icazeler yalniz superadmin terefinden deyise biler';
    end if;
  end if;

  is_admin_user := public.is_admin();

  if is_admin_user then
    -- (C) Admin dogrudan duzenlemeleri — granuler icaze (K5)
    if (NEW.is_blocked is distinct from OLD.is_blocked
        or NEW.blocked_until is distinct from OLD.blocked_until
        or NEW.block_reason is distinct from OLD.block_reason)
       and not public.has_admin_perm('users') then
      raise exception 'Icaze yoxdur: Blok emeliyyati ucun users icazesi lazimdir';
    end if;
    if NEW.display_login is distinct from OLD.display_login and not public.has_admin_perm('users') then
      raise exception 'Icaze yoxdur: Login deyisikliyi ucun users icazesi lazimdir';
    end if;
    if NEW.username is distinct from OLD.username and not public.has_admin_perm('users') then
      raise exception 'Icaze yoxdur: Istifadeci adi deyisikliyi ucun users icazesi lazimdir';
    end if;
    if (NEW.kyc_status is distinct from OLD.kyc_status
        or NEW.identity_number is distinct from OLD.identity_number
        or NEW.kyc_document_number is distinct from OLD.kyc_document_number
        or NEW.kyc_document_type is distinct from OLD.kyc_document_type
        or NEW.kyc_document_url is distinct from OLD.kyc_document_url
        or NEW.kyc_document_back_url is distinct from OLD.kyc_document_back_url
        or NEW.kyc_selfie_url is distinct from OLD.kyc_selfie_url)
       and not public.has_admin_perm('kyc') then
      raise exception 'Icaze yoxdur: KYC emeliyyati ucun kyc icazesi lazimdir';
    end if;
  else
    -- (D) Normal kullanici — yalniz izinli sahalar
    if NEW.email is distinct from OLD.email then
      raise exception 'Icaze yoxdur: Emaili deyise bilmezsiniz';
    end if;
    if NEW.display_login is distinct from OLD.display_login then
      raise exception 'Icaze yoxdur: Login deyise bilmezsiniz';
    end if;
    if NEW.username is distinct from OLD.username then
      raise exception 'Icaze yoxdur: Istifadeci adini deyise bilmezsiniz';
    end if;
    if NEW.is_blocked is distinct from OLD.is_blocked
       or NEW.blocked_until is distinct from OLD.blocked_until
       or NEW.block_reason is distinct from OLD.block_reason then
      raise exception 'Icaze yoxdur: Blok statusunu deyise bilmezsiniz';
    end if;
    if NEW.identity_number is distinct from OLD.identity_number then
      raise exception 'Icaze yoxdur: Kimlik nomresini deyise bilmezsiniz';
    end if;
    -- KYC: yalniz none/pending gonderebilir (onay/red YOX)
    if NEW.kyc_status is distinct from OLD.kyc_status and NEW.kyc_status not in ('none', 'pending') then
      raise exception 'Icaze yoxdur: KYC statusunu tesdiqleye/redd ede bilmezsiniz';
    end if;
    -- Tesdiqlenmis KYC sonrasi sened/selfie degisdirmek YOX (finding #8)
    if OLD.kyc_status = 'approved' and (
         NEW.kyc_document_number is distinct from OLD.kyc_document_number
      or NEW.kyc_document_type is distinct from OLD.kyc_document_type
      or NEW.kyc_document_url is distinct from OLD.kyc_document_url
      or NEW.kyc_document_back_url is distinct from OLD.kyc_document_back_url
      or NEW.kyc_selfie_url is distinct from OLD.kyc_selfie_url) then
      raise exception 'Icaze yoxdur: Tesdiqlenmis KYC senedlerini deyise bilmezsiniz';
    end if;
  end if;

  return NEW;
end;
$function$;

revoke all on function public.check_profile_updates() from public, anon, authenticated;

-- --------------------------------------------------------------------
-- 3. buy_package — ilk alışda referral_unlocked=true; upline paylanması
--    artıq referral_unlocked-a baxır (əvvəl "cari aktiv paket"). (_8-i əvəz edir)
-- --------------------------------------------------------------------
create or replace function public.buy_package(pkg_id text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  -- Part 8: paket almaq üçün KYC tələb olunmur.

  -- Uğurlu alışda referral_unlocked=true (ömürlük) — level-up paketləri sönsə də qalır.
  update public.profiles
    set balance = balance - pkg_price,
        referral_unlocked = true,
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

  -- Upline dagitim (5 hat) + self/cycle korumasi.
  -- Şərt: upline HEÇ VAXT ≥1 paket almış olmalı (referral_unlocked) — cari aktiv paket ARTIQ ŞƏRT DEYİL.
  upline_id := buyer_profile.referred_by;
  visited := array[buyer_id];
  while upline_id is not null and current_depth <= 5 loop
    exit when upline_id = any(visited);
    visited := visited || upline_id;
    select * into parent_profile from public.profiles where id = upline_id;
    if not found then exit; end if;

    if parent_profile.referral_unlocked then
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
$function$;
revoke all on function public.buy_package(text) from public, anon;
grant execute on function public.buy_package(text) to authenticated;

-- --------------------------------------------------------------------
-- 4. check_referral_code — referrer referral_unlocked olmalı (_16-nı əvəz edir)
-- --------------------------------------------------------------------
create or replace function public.check_referral_code(p_code text)
returns json security definer set search_path = public as $$
declare ok boolean;
begin
  select exists(
    select 1 from public.profiles
    where referral_code = p_code and referral_unlocked
  ) into ok;
  return json_build_object('valid', ok);
end;
$$ language plpgsql;
revoke all on function public.check_referral_code(text) from public;
grant execute on function public.check_referral_code(text) to anon, authenticated;

-- --------------------------------------------------------------------
-- 5. handle_new_user — referred_by yalnız referral_unlocked referrer üçün (_16-nı əvəz edir)
-- --------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger security definer set search_path = public as $$
declare
  ref_code text; ref_uid uuid; user_name text; new_code text; v_username text;
begin
  new_code := public.generate_user_code();
  ref_code := 'REF' || new_code;
  user_name := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1));

  v_username := lower(nullif(trim(new.raw_user_meta_data->>'username'), ''));
  if v_username is not null and v_username !~ '^[a-z0-9]{5,20}$' then
    v_username := null;
  end if;
  if v_username is not null and exists (select 1 from public.profiles where lower(username) = v_username) then
    raise exception 'username_taken' using errcode = 'unique_violation';
  end if;

  -- referred_by: referrer BİR DƏFƏ paket almış olmalı (referral_unlocked)
  if new.raw_user_meta_data->>'referral_code' is not null and new.raw_user_meta_data->>'referral_code' <> '' then
    select p.id into ref_uid from public.profiles p
      where p.referral_code = new.raw_user_meta_data->>'referral_code'
        and p.referral_unlocked
      limit 1;
  end if;

  insert into public.profiles (
    id, email, display_login, user_code, username, full_name, role, referral_code,
    referred_by, country, city, phone, admin_permissions
  ) values (
    new.id, new.email, new_code, new_code, v_username, user_name, 'user', ref_code, ref_uid,
    new.raw_user_meta_data->>'country', new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'phone', '{}'::jsonb
  );
  return new;
end;
$$ language plpgsql;

-- --------------------------------------------------------------------
-- 6. create_profile_if_missing — eyni referral_unlocked şərti (_16-nı əvəz edir)
-- --------------------------------------------------------------------
create or replace function public.create_profile_if_missing()
returns json security definer set search_path = public as $$
declare
  ref_uid uuid; ref_code text; user_name text; new_code text; v_username text;
  p_exists boolean; curr_user auth.users%rowtype;
begin
  if auth.uid() is null then return json_build_object('success', false, 'error', 'Not authenticated'); end if;
  select exists(select 1 from public.profiles where id = auth.uid()) into p_exists;
  if p_exists then return json_build_object('success', true, 'message', 'exists'); end if;

  select * into curr_user from auth.users where id = auth.uid();
  new_code := public.generate_user_code();
  ref_code := 'REF' || new_code;
  user_name := coalesce(nullif(curr_user.raw_user_meta_data->>'full_name', ''), split_part(curr_user.email, '@', 1));

  v_username := lower(nullif(trim(curr_user.raw_user_meta_data->>'username'), ''));
  if v_username is not null and v_username !~ '^[a-z0-9]{5,20}$' then
    v_username := null;
  end if;
  if v_username is not null and exists (select 1 from public.profiles where lower(username) = v_username) then
    return json_build_object('success', false, 'error', 'username_taken');
  end if;

  if curr_user.raw_user_meta_data->>'referral_code' is not null and curr_user.raw_user_meta_data->>'referral_code' <> '' then
    select p.id into ref_uid from public.profiles p
      where p.referral_code = curr_user.raw_user_meta_data->>'referral_code'
        and p.referral_unlocked
      limit 1;
  end if;

  insert into public.profiles (id, email, display_login, user_code, username, full_name, role, referral_code, referred_by, country, city, phone)
  values (curr_user.id, curr_user.email, new_code, new_code, v_username, user_name, 'user', ref_code, ref_uid,
          curr_user.raw_user_meta_data->>'country', curr_user.raw_user_meta_data->>'city', curr_user.raw_user_meta_data->>'phone');
  return json_build_object('success', true, 'message', 'created');
end;
$$ language plpgsql;
revoke all on function public.create_profile_if_missing() from public, anon;
grant execute on function public.create_profile_if_missing() to authenticated;

commit;
