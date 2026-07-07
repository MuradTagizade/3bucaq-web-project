-- ====================================================================
-- LEVEL UP — security_remediation_16.sql
-- İSTİFADƏÇİ ADI (username) formatı + REFERAL–PAKET AYRILMASI
-- --------------------------------------------------------------------
-- İstifadəçi istəkləri (2026-07-07):
--   1. İstifadəçi adı artıq RƏQƏM də qəbul edir; yalnız KİÇİK hərflər
--      (böyük hərflər avtomatik kiçildilir). Format: ^[a-z0-9]{5,20}$.
--   2. Referal kodu/linki ARTIQ paket aktivliyindən ASILI DEYİL:
--      level açılanda (§22) paketlər sönür, amma referal işləməyə davam edir.
--      - check_referral_code: kod mövcuddursa həmişə valid (aktiv-paket şərti YOX).
--      - handle_new_user / create_profile_if_missing: referred_by referrer'in
--        paket vəziyyətinə baxmadan set edilir.
--   3. Referal siyahısı (get_my_referral_tree) artıq username da qaytarır
--      (UI istifadəçi adını göstərir, user_code yerinə).
-- Bu fayl _15 (username RPC-ləri) və _4 (check_referral_code) tanımlarını,
-- həmçinin _3-dəki get_my_referral_tree-ni ƏVƏZ EDİR. Part 6 whitelist grant qorunur.
-- ====================================================================

begin;

-- --------------------------------------------------------------------
-- 1. check_username_available — rəqəm qəbul edir + kiçik hərfə normalizə
--    (^[a-z0-9]{5,20}$). Böyük hərflər lower() ilə kiçildilir.
-- --------------------------------------------------------------------
create or replace function public.check_username_available(p_username text)
returns json security definer set search_path = public as $$
declare v text;
begin
  v := lower(trim(coalesce(p_username, '')));
  if v = '' then return json_build_object('available', false, 'reason', 'empty'); end if;
  if v !~ '^[a-z0-9]{5,20}$' then
    return json_build_object('available', false, 'reason', 'invalid');
  end if;
  if exists (select 1 from public.profiles where lower(username) = v) then
    return json_build_object('available', false, 'reason', 'taken');
  end if;
  return json_build_object('available', true);
end;
$$ language plpgsql;
revoke all on function public.check_username_available(text) from public;
grant execute on function public.check_username_available(text) to anon, authenticated;

-- --------------------------------------------------------------------
-- 2. handle_new_user — username kiçik+rəqəm; referred_by paket-şərtsiz
--    (_15-i əvəz edir)
-- --------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger security definer set search_path = public as $$
declare
  ref_code text; ref_uid uuid; user_name text; new_code text; v_username text;
begin
  new_code := public.generate_user_code();
  ref_code := 'REF' || new_code;
  user_name := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1));

  -- username: kiçik hərfə normalizə + format-guard (a-z, 0-9, 5-20); uyğun deyilsə null
  v_username := lower(nullif(trim(new.raw_user_meta_data->>'username'), ''));
  if v_username is not null and v_username !~ '^[a-z0-9]{5,20}$' then
    v_username := null;
  end if;
  -- unikallıq; çakışırsa signup rollback olur (orphan auth user yaranmaz)
  if v_username is not null and exists (select 1 from public.profiles where lower(username) = v_username) then
    raise exception 'username_taken' using errcode = 'unique_violation';
  end if;

  -- referred_by: referrer'in paket vəziyyətindən ASILI DEYİL (yalnız kod uyğunluğu)
  if new.raw_user_meta_data->>'referral_code' is not null and new.raw_user_meta_data->>'referral_code' <> '' then
    select p.id into ref_uid from public.profiles p
      where p.referral_code = new.raw_user_meta_data->>'referral_code'
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
-- 3. create_profile_if_missing — eyni məntiq (_15-i əvəz edir)
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

  -- referred_by: paket-şərtsiz (yalnız kod uyğunluğu)
  if curr_user.raw_user_meta_data->>'referral_code' is not null and curr_user.raw_user_meta_data->>'referral_code' <> '' then
    select p.id into ref_uid from public.profiles p
      where p.referral_code = curr_user.raw_user_meta_data->>'referral_code'
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

-- --------------------------------------------------------------------
-- 4. check_referral_code — kod mövcuddursa həmişə valid (aktiv-paket şərti YOX)
--    (_4-ü əvəz edir; artıq 'inactive' qaytarmır)
-- --------------------------------------------------------------------
create or replace function public.check_referral_code(p_code text)
returns json security definer set search_path = public as $$
declare ref_exists boolean;
begin
  select exists(select 1 from public.profiles where referral_code = p_code) into ref_exists;
  return json_build_object('valid', ref_exists);
end;
$$ language plpgsql;
revoke all on function public.check_referral_code(text) from public;
grant execute on function public.check_referral_code(text) to anon, authenticated;

-- --------------------------------------------------------------------
-- 5. get_my_referral_tree — çıxışa username əlavə olundu (_3-ü əvəz edir)
--    UI user_code yerinə username göstərir (yoxdursa user_code fallback).
-- --------------------------------------------------------------------
create or replace function public.get_my_referral_tree(max_depth integer default 5)
returns json security definer set search_path = public as $$
declare me uuid; result json; d integer;
begin
  me := auth.uid();
  if me is null then return '[]'::json; end if;
  d := least(greatest(coalesce(max_depth, 5), 1), 5);   -- 1..5 kilidi
  with recursive tree as (
    select p.id, p.user_code, p.username, p.display_login, p.full_name, p.total_points, p.current_level,
           p.created_at, p.active_packages, p.referred_by, 1 as line
    from public.profiles p where p.referred_by = me
    union all
    select c.id, c.user_code, c.username, c.display_login, c.full_name, c.total_points, c.current_level,
           c.created_at, c.active_packages, c.referred_by, t.line + 1
    from public.profiles c join tree t on c.referred_by = t.id
    where t.line < d
  )
  select coalesce(json_agg(json_build_object(
    'uid', id, 'userCode', user_code, 'username', username, 'displayLogin', display_login, 'fullName', full_name,
    'line', line, 'totalPoints', total_points, 'currentLevel', current_level,
    'joinedAt', created_at, 'activePackages', active_packages
  )), '[]'::json) into result from tree;
  return result;
end;
$$ language plpgsql;
revoke all on function public.get_my_referral_tree(integer) from public;
grant execute on function public.get_my_referral_tree(integer) to authenticated;

commit;
