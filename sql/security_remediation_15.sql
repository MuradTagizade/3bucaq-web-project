-- ====================================================================
-- LEVEL UP — security_remediation_15.sql
-- İSTİFADƏÇİ ADI (username) SİSTEMİ
-- --------------------------------------------------------------------
-- Yeni özəllik: qeydiyyatda istifadəçi öz istifadəçi adını seçir
--   * yalnız hərflər (A-Z, a-z), 5-20 simvol, rəqəm/simvol YOX
--   * unikallıq böyük/kiçik hərf fərqi qoymadan (John = john)
--   * yazıldığı kimi saxlanır (case preserved), amma unikallıq lower() ilə
--   * qeydiyyatdan SONRA istifadəçi özü DƏYİŞƏ BİLMƏZ (yalnız admin 'users')
--   * transfer artıq həm user_code, həm username ilə mümkündür
-- Telefon: qeydiyyatdan/profildən UI-də söndürüldü — DB sütunu toxunulmadı
--   (reversible; "şimdilik" gerek yox).
-- Bu fayl _10 (check_profile_updates), _3 (transfer_funds/lookup_user_code)
-- və _4 (handle_new_user/create_profile_if_missing) tanımlarını ƏVƏZ EDİR.
-- Part 6 whitelist grant modeli qorunur.
-- ====================================================================

begin;

-- --------------------------------------------------------------------
-- 1. username sütunu + case-insensitive unique index
-- --------------------------------------------------------------------
alter table public.profiles add column if not exists username text;

-- nulls çoxdur (mövcud/admin istifadəçilər) — unique index null-ları fərqli sayır,
-- ona görə çoxlu null problem deyil. Unikallıq yalnız dolu username-lər üçün.
create unique index if not exists profiles_username_lower_uk
  on public.profiles (lower(username));

-- --------------------------------------------------------------------
-- 2. check_username_available — qeydiyyatda canlı yoxlama (anon + auth)
--    Enumerasyon riski check_referral_code ilə eynidir (qəbul edilir):
--    username onsuz da transfer üçün yarı-publikdir.
-- --------------------------------------------------------------------
create or replace function public.check_username_available(p_username text)
returns json security definer set search_path = public as $$
declare v text;
begin
  v := trim(coalesce(p_username, ''));
  if v = '' then return json_build_object('available', false, 'reason', 'empty'); end if;
  if v !~ '^[A-Za-z]{5,20}$' then
    return json_build_object('available', false, 'reason', 'invalid');
  end if;
  if exists (select 1 from public.profiles where lower(username) = lower(v)) then
    return json_build_object('available', false, 'reason', 'taken');
  end if;
  return json_build_object('available', true);
end;
$$ language plpgsql;
revoke all on function public.check_username_available(text) from public;
grant execute on function public.check_username_available(text) to anon, authenticated;

-- --------------------------------------------------------------------
-- 3. handle_new_user — qeydiyyat metadata-sından username (_4-ü əvəz edir)
-- --------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger security definer set search_path = public as $$
declare
  ref_code text; ref_uid uuid; user_name text; new_code text; v_username text;
begin
  new_code := public.generate_user_code();
  ref_code := 'REF' || new_code;
  user_name := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1));

  -- username: format-guard (hərf, 5-20); uyğun deyilsə null (istifadəçi user_code ilə qalır)
  v_username := nullif(trim(new.raw_user_meta_data->>'username'), '');
  if v_username is not null and v_username !~ '^[A-Za-z]{5,20}$' then
    v_username := null;
  end if;
  -- unikallıq (case-insensitive); çakışırsa signup rollback olur (orphan auth user yaranmaz)
  if v_username is not null and exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
    raise exception 'username_taken' using errcode = 'unique_violation';
  end if;

  if new.raw_user_meta_data->>'referral_code' is not null and new.raw_user_meta_data->>'referral_code' <> '' then
    select p.id into ref_uid from public.profiles p
      where p.referral_code = new.raw_user_meta_data->>'referral_code'
        and exists (select 1 from jsonb_each_text(coalesce(p.active_packages, '{}'::jsonb)) x where lower(x.value) = 'true')
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
-- 4. create_profile_if_missing — eyni username məntiqi (_4-ü əvəz edir)
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

  v_username := nullif(trim(curr_user.raw_user_meta_data->>'username'), '');
  if v_username is not null and v_username !~ '^[A-Za-z]{5,20}$' then
    v_username := null;
  end if;
  if v_username is not null and exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
    return json_build_object('success', false, 'error', 'username_taken');
  end if;

  if curr_user.raw_user_meta_data->>'referral_code' is not null and curr_user.raw_user_meta_data->>'referral_code' <> '' then
    select p.id into ref_uid from public.profiles p
      where p.referral_code = curr_user.raw_user_meta_data->>'referral_code'
        and exists (select 1 from jsonb_each_text(coalesce(p.active_packages, '{}'::jsonb)) x where lower(x.value) = 'true')
      limit 1;
  end if;

  insert into public.profiles (id, email, display_login, user_code, username, full_name, role, referral_code, referred_by, country, city, phone)
  values (curr_user.id, curr_user.email, new_code, new_code, v_username, user_name, 'user', ref_code, ref_uid,
          curr_user.raw_user_meta_data->>'country', curr_user.raw_user_meta_data->>'city', curr_user.raw_user_meta_data->>'phone');
  return json_build_object('success', true, 'message', 'created');
end;
$$ language plpgsql;

-- --------------------------------------------------------------------
-- 5. check_profile_updates — username IMMUTABLE for normal user (_10-u əvəz edir)
--    (INVOKER trigger; display_login ilə eyni model: admin 'users' dəyişə bilər)
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
-- 6. transfer_funds — alıcı user_code VƏ ya username ilə (_3-ü əvəz edir)
-- --------------------------------------------------------------------
create or replace function public.transfer_funds(to_code text, amount numeric)
returns json security definer set search_path = public as $$
declare
  sender_id uuid; sender_profile record; recipient_profile record;
  parsed_amount numeric; rows_affected integer;
begin
  sender_id := auth.uid();
  if sender_id is null then return json_build_object('success', false, 'error', 'Sessiya tapilmadi.'); end if;
  parsed_amount := amount;
  if parsed_amount is null or parsed_amount <= 0 then return json_build_object('success', false, 'error', 'Meblegi duzgun deyil'); end if;

  select * into sender_profile from public.profiles where id = sender_id;
  if not found then return json_build_object('success', false, 'error', 'Gonderen tapilmadi'); end if;
  if sender_profile.role <> 'admin' and sender_profile.kyc_status <> 'approved' then
    return json_build_object('success', false, 'error', 'Kocurme ucun KYC teleb olunur.'); end if;
  if public.is_effectively_blocked(sender_id) then return json_build_object('success', false, 'error', 'Hesabiniz bloklanib.'); end if;

  -- alıcı: əvvəl user_code (dəqiq, böyük hərf), sonra username (case-insensitive)
  select * into recipient_profile from public.profiles where user_code = upper(trim(to_code)) limit 1;
  if not found then
    select * into recipient_profile from public.profiles where lower(username) = lower(trim(to_code)) limit 1;
  end if;
  if not found then return json_build_object('success', false, 'error', 'Qebul eden tapilmadi'); end if;
  if sender_id = recipient_profile.id then return json_build_object('success', false, 'error', 'Ozunuze kocurme ede bilmezsiniz'); end if;

  update public.profiles set balance = balance - parsed_amount where id = sender_id and balance >= parsed_amount;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Balans kifayet etmir'); end if;

  update public.profiles set balance = balance + parsed_amount where id = recipient_profile.id;
  insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
  values ('transfer', sender_id, sender_profile.user_code, recipient_profile.id, recipient_profile.user_code, parsed_amount, 'completed');
  return json_build_object('success', true);
end;
$$ language plpgsql;
grant execute on function public.transfer_funds(text, numeric) to authenticated;

-- --------------------------------------------------------------------
-- 7. lookup_user_code — user_code VƏ ya username ilə tap (_3-ü əvəz edir)
-- --------------------------------------------------------------------
create or replace function public.lookup_user_code(p_code text)
returns json security definer set search_path = public as $$
declare r record;
begin
  if auth.uid() is null then return json_build_object('exists', false); end if;
  select user_code, username, full_name into r from public.profiles where user_code = upper(trim(p_code)) limit 1;
  if not found then
    select user_code, username, full_name into r from public.profiles where lower(username) = lower(trim(p_code)) limit 1;
  end if;
  if not found then return json_build_object('exists', false); end if;
  return json_build_object('exists', true, 'user_code', r.user_code, 'username', r.username, 'full_name', r.full_name);
end;
$$ language plpgsql;
grant execute on function public.lookup_user_code(text) to authenticated;

commit;
