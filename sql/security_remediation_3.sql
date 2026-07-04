-- ====================================================================
-- 3bucaq / LEVEL UP — SECURITY REMEDIATION — PART 3
-- ====================================================================
-- security_remediation.sql (Part 1) + security_remediation_2_rpcs.sql (Part 2)
-- calistirildiktan SONRA calistirin. Idempotent.
--
-- Kapsam (denetim workflow'unun DOGRULADIGI bulgular + yeni ozellikler):
--   [KRITIK] Granuler admin bypass — trigger whitelist + admin RLS siklastirma
--   [KRITIK] Self-referral/dongu ile para/puan basma — referred_by kilit + cycle detection
--   [YUKSEK] resolve_login_email anon email sizmasi — DROP (login email-only)
--   [ORTA]   admin_reject_claim claimed_levels no-op — deger bazli silme
--   [ORTA]   process_daily_earnings tarih guard yok — atomik guard + is_effectively_blocked
--   [DUSUK]  lookup_login/check_referral_code/max_depth/admin_uid sertlestirme
--   [OZELLIK] user_code (6 karakter alfanumerik benzersiz ID) — username yerine
--   [OZELLIK] transfer/arama/paylasim user_code ile
-- ====================================================================

begin;

-- ====================================================================
-- 1. user_code KOLONU + URETEC + BACKFILL
-- ====================================================================
alter table public.profiles add column if not exists user_code text;

-- Benzersiz 6 karakter alfanumerik kod (I,O,0,1 haric — karisiklik olmasin)
create or replace function public.generate_user_code()
returns text security definer set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text; i int; tries int := 0;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where user_code = code);
    tries := tries + 1;
    if tries > 100 then
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); -- nadir: 7 karakter
      exit when not exists (select 1 from public.profiles where user_code = code);
    end if;
  end loop;
  return code;
end;
$$ language plpgsql;

-- Mevcut kullanicilari doldur (dongu — ayni islemde cakismayi onler)
do $$
declare r record;
begin
  for r in select id from public.profiles where user_code is null loop
    update public.profiles set user_code = public.generate_user_code() where id = r.id;
  end loop;
end $$;

-- Benzersizlik kisiti
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_user_code_unique') then
    alter table public.profiles add constraint profiles_user_code_unique unique (user_code);
  end if;
end $$;

-- display_login artik kimlik anahtari degil — varsa unique kisitini kaldir
do $$
declare c text;
begin
  select conname into c from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'u'
      and pg_get_constraintdef(oid) ilike '%display_login%' limit 1;
  if c is not null then execute format('alter table public.profiles drop constraint %I', c); end if;
end $$;

-- Self-referral DB backstop
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_no_self_referral') then
    alter table public.profiles add constraint profiles_no_self_referral check (referred_by is null or referred_by <> id) not valid;
  end if;
end $$;

-- ====================================================================
-- 2. handle_new_user — user_code uret, display_login = user_code
-- ====================================================================
create or replace function public.handle_new_user()
returns trigger security definer set search_path = public as $$
declare
  ref_code text; ref_uid uuid; user_name text; new_code text;
begin
  new_code := public.generate_user_code();
  ref_code := 'REF' || new_code;   -- user_code benzersiz oldugu icin ref_code de benzersiz (carpisma yok)
  user_name := coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1));

  if new.raw_user_meta_data->>'referral_code' is not null and new.raw_user_meta_data->>'referral_code' <> '' then
    select id into ref_uid from public.profiles where referral_code = new.raw_user_meta_data->>'referral_code' limit 1;
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

-- ====================================================================
-- 3. create_profile_if_missing — ayni mantik (self-healing)
-- ====================================================================
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
    select id into ref_uid from public.profiles where referral_code = curr_user.raw_user_meta_data->>'referral_code' limit 1;
  end if;

  insert into public.profiles (id, email, display_login, user_code, full_name, role, referral_code, referred_by, country, city, phone)
  values (curr_user.id, curr_user.email, new_code, new_code, user_name, 'user', ref_code, ref_uid,
          curr_user.raw_user_meta_data->>'country', curr_user.raw_user_meta_data->>'city', curr_user.raw_user_meta_data->>'phone');
  return json_build_object('success', true, 'message', 'created');
end;
$$ language plpgsql;

-- ====================================================================
-- 4. check_profile_updates — WHITELIST + granuler admin + kilitler (KRITIK)
--    - balance/points/paket/level/user_code/referred_by/referral_code:
--      HICBIR client (admin dahil) degistiremez; yalniz definer RPC'ler.
--    - role/admin_permissions: yalniz superadmin.
--    - admin block/kyc/login duzenlemeleri: has_admin_perm ile gate.
--    - normal kullanici: yalniz full_name/country/city/phone + KYC-submit.
-- ====================================================================
-- ONEMLI: Bu trigger SECURITY DEFINER OLMAMALI. Definer olsaydi, trigger icinde
-- current_user = fonksiyon sahibi (postgres) olur ve asagidaki 'postgres' guard'i HER
-- cagrida eslesip tum korumalari atlardi (kritik bypass). INVOKER (varsayilan) olunca:
-- dogrudan client UPDATE'te current_user='authenticated' -> kontroller calisir;
-- definer para RPC'lerinden gelen UPDATE'te current_user='postgres' -> guard ile bypass (mesru).
create or replace function public.check_profile_updates()
returns trigger set search_path = public as $$
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

  -- transfer_balance (kolon hele varsa)
  if (to_jsonb(NEW) ? 'transfer_balance') and (NEW.transfer_balance is distinct from OLD.transfer_balance) then
    raise exception 'Icaze yoxdur: Transfer balansi deyisdirile bilmez';
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
$$ language plpgsql;

drop trigger if exists tr_check_profile_updates on public.profiles;
create trigger tr_check_profile_updates
  before update on public.profiles
  for each row execute procedure public.check_profile_updates();

-- ====================================================================
-- 5. ADMIN RLS SIKLASTIRMA (KRITIK) — "Admins can manage X" -> SELECT-only
--    Boylece sinirli alt-admin dogrudan cedvele yazip self-approve edemez.
--    Admin SELECT'i "Users can view..." politikalari (or is_admin()) zaten kapsar.
--    Tum mutasyonlar definer RPC'ler uzerinden (RLS bypass).
-- ====================================================================
drop policy if exists "Admins can manage transactions" on public.transactions;
drop policy if exists "Admins can manage points history" on public.points_history;
drop policy if exists "Admins can manage level claims" on public.level_claims;
drop policy if exists "Admins can manage deposits" on public.deposits;
drop policy if exists "Admins can manage withdrawals" on public.withdrawals;

-- ====================================================================
-- 6. admin_logs — actor'u client'a birakma, auth.uid()'den zorla (finding #9)
-- ====================================================================
create or replace function public.set_admin_log_actor()
returns trigger security definer set search_path = public as $$
begin
  -- Client (authenticated) insert'lerinde actor'u gercek auth.uid()'e zorla (forgery onle).
  -- Server route (service_role, auth.uid()=null) guvenilir — verdigi admin_uid'i koru.
  if auth.uid() is not null then
    NEW.admin_uid := auth.uid();
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists tr_set_admin_log_actor on public.admin_logs;
create trigger tr_set_admin_log_actor
  before insert on public.admin_logs
  for each row execute procedure public.set_admin_log_actor();

-- ====================================================================
-- 7. buy_package — self/cycle koruma (KRITIK defense-in-depth) + min-1 referral
-- ====================================================================
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

  -- Upline dagitim (5 hat). SELF + CYCLE korumasi: ayni uid'e asla 2 kez odeme.
  upline_id := buyer_profile.referred_by;
  visited := array[buyer_id];
  while upline_id is not null and current_depth <= 5 loop
    exit when upline_id = any(visited);          -- self veya dongu -> dur
    visited := visited || upline_id;
    select * into parent_profile from public.profiles where id = upline_id;
    if not found then exit; end if;

    -- Kazanc icin parent'in EN AZ 1 aktif paketi olmali (#3 is kurali)
    if exists (select 1 from jsonb_each_text(coalesce(parent_profile.active_packages,'{}'::jsonb)) where lower(value) = 'true') then
      if pkg_points > 0 then
        update public.profiles set total_points = total_points + pkg_points where id = parent_profile.id;
        insert into public.points_history (uid, points, from_uid, from_login, package_id, line_number)
        values (parent_profile.id, pkg_points, buyer_id, buyer_profile.user_code, pkg_id, current_depth);
      end if;
      if current_depth = 1 then
        bonus_to_add := pkg_price * 0.10;
      else
        bonus_to_add := pkg_price * 0.01;
      end if;
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

-- ====================================================================
-- 8. transfer_funds — alici artik user_code ile (buyuk/kucuk harf duyarsiz)
-- ====================================================================
drop function if exists public.transfer_funds(text, numeric);
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

  select * into recipient_profile from public.profiles where user_code = upper(trim(to_code));
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

-- ====================================================================
-- 9. LOOKUP RPC'LERI — user_code'a gecis; email-only login (sizmalari kapat)
-- ====================================================================
-- Anon email sizmasi (YUKSEK) ve username-availability artik gereksiz -> DROP
drop function if exists public.resolve_login_email(text);
drop function if exists public.check_login_exists(text);
drop function if exists public.lookup_login(text);

-- Transfer alicisi dogrulama — user_code ile (random kod, enumerasyon pratik degil)
create or replace function public.lookup_user_code(p_code text)
returns json security definer set search_path = public as $$
declare r record;
begin
  if auth.uid() is null then return json_build_object('exists', false); end if;
  select user_code, full_name into r from public.profiles where user_code = upper(trim(p_code)) limit 1;
  if not found then return json_build_object('exists', false); end if;
  return json_build_object('exists', true, 'user_code', r.user_code, 'full_name', r.full_name);
end;
$$ language plpgsql;
grant execute on function public.lookup_user_code(text) to authenticated;

-- Referral kodu dogrulama — sponsor kimligini SIZDIRMA, yalniz gecerlilik
create or replace function public.check_referral_code(p_code text)
returns json security definer set search_path = public as $$
begin
  return json_build_object('valid', exists (select 1 from public.profiles where referral_code = p_code));
end;
$$ language plpgsql;
grant execute on function public.check_referral_code(text) to anon, authenticated;

-- Downline agaci — max_depth kilitli + user_code eklendi
create or replace function public.get_my_referral_tree(max_depth integer default 5)
returns json security definer set search_path = public as $$
declare me uuid; result json; d integer;
begin
  me := auth.uid();
  if me is null then return '[]'::json; end if;
  d := least(greatest(coalesce(max_depth, 5), 1), 5);   -- 1..5 kilidi
  with recursive tree as (
    select p.id, p.user_code, p.display_login, p.full_name, p.total_points, p.current_level,
           p.created_at, p.active_packages, p.referred_by, 1 as line
    from public.profiles p where p.referred_by = me
    union all
    select c.id, c.user_code, c.display_login, c.full_name, c.total_points, c.current_level,
           c.created_at, c.active_packages, c.referred_by, t.line + 1
    from public.profiles c join tree t on c.referred_by = t.id
    where t.line < d
  )
  select coalesce(json_agg(json_build_object(
    'uid', id, 'userCode', user_code, 'displayLogin', display_login, 'fullName', full_name,
    'line', line, 'totalPoints', total_points, 'currentLevel', current_level,
    'joinedAt', created_at, 'activePackages', active_packages
  )), '[]'::json) into result from tree;
  return result;
end;
$$ language plpgsql;

-- ====================================================================
-- 10. admin_reject_claim — claimed_levels'i DEGER bazli sil (ORTA fix)
-- ====================================================================
create or replace function public.admin_reject_claim(p_claim_id uuid)
returns json security definer set search_path = public as $$
declare cl record; req_points numeric; rows_affected integer;
begin
  if not public.has_admin_perm('claims') then return json_build_object('success', false, 'error', 'Icaze yoxdur'); end if;
  update public.level_claims set status = 'rejected'
    where id = p_claim_id and status = 'pending' returning * into cl;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Telebi tapilmadi ve ya artiq islenib'); end if;

  if cl.level = 1 then req_points := 30; elsif cl.level = 2 then req_points := 109; elsif cl.level = 3 then req_points := 268;
  elsif cl.level = 4 then req_points := 597; elsif cl.level = 5 then req_points := 1266; elsif cl.level = 6 then req_points := 2615;
  elsif cl.level = 7 then req_points := 5314; elsif cl.level = 8 then req_points := 10723; elsif cl.level = 9 then req_points := 21552;
  elsif cl.level = 10 then req_points := 43321; else req_points := 0; end if;

  update public.profiles
    set total_points = total_points + req_points,
        claimed_levels = coalesce((
          select jsonb_agg(e) from jsonb_array_elements(coalesce(claimed_levels, '[]'::jsonb)) e
          where e <> to_jsonb(cl.level)
        ), '[]'::jsonb)
    where id = cl.uid;

  if req_points > 0 then
    insert into public.points_history (uid, points, from_uid, from_login, package_id, line_number)
    values (cl.uid, req_points, null, 'Claim Rejected', 'level_' || cl.level, 0);
  end if;
  return json_build_object('success', true);
end;
$$ language plpgsql;

-- ====================================================================
-- 11. admin_approve_deposit — KYC kontrolu (defense-in-depth, finding #10)
-- ====================================================================
create or replace function public.admin_approve_deposit(p_deposit_id uuid)
returns json security definer set search_path = public as $$
declare dep record; u record; rows_affected integer;
begin
  if not public.has_admin_perm('finance') then return json_build_object('success', false, 'error', 'Icaze yoxdur'); end if;
  update public.deposits set status = 'approved', approved_at = now()
    where id = p_deposit_id and status = 'pending' returning * into dep;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Depozit tapilmadi ve ya artiq islenib'); end if;

  select role, kyc_status into u from public.profiles where id = dep.uid;
  if u.role <> 'admin' and coalesce(u.kyc_status, 'none') <> 'approved' then
    -- geri al: pending'e dondur, kredi verme
    update public.deposits set status = 'pending', approved_at = null where id = p_deposit_id;
    return json_build_object('success', false, 'error', 'Istifadecinin KYC-i tesdiqlenmeyib');
  end if;

  update public.profiles set balance = balance + dep.amount where id = dep.uid;
  insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
  values ('deposit', dep.uid, dep.login, dep.uid, dep.login, dep.amount, 'completed');
  return json_build_object('success', true);
end;
$$ language plpgsql;

-- ====================================================================
-- 12. process_daily_earnings — tarih guard (cift-odeme) + is_effectively_blocked
-- ====================================================================
create or replace function public.process_daily_earnings()
returns json security definer set search_path = public as $$
declare cnt integer := 0; r record; daily numeric; rows_affected integer;
begin
  for r in
    select id, user_code, active_packages from public.profiles
    where not public.is_effectively_blocked(id)
      and coalesce(last_daily_earning_date, '1970-01-01') < current_date
      and (coalesce(lower(active_packages->>'pkg399'),'false')='true'
        or coalesce(lower(active_packages->>'pkg799'),'false')='true')
  loop
    daily := 0;
    if coalesce(lower(r.active_packages->>'pkg399'),'false')='true' then daily := daily + 3.3; end if;
    if coalesce(lower(r.active_packages->>'pkg799'),'false')='true' then daily := daily + 6.5; end if;

    -- Atomik tarih guard: ayni gun ikinci UPDATE 0 satir etkiler
    update public.profiles set balance = balance + daily, last_daily_earning_date = current_date
      where id = r.id and coalesce(last_daily_earning_date, '1970-01-01') < current_date;
    get diagnostics rows_affected = row_count;
    if rows_affected = 0 then continue; end if;

    insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
    values ('daily_earning', null, 'System', r.id, r.user_code, daily, 'completed');
    cnt := cnt + 1;
  end loop;
  return json_build_object('success', true, 'processed', cnt);
end;
$$ language plpgsql;

-- ====================================================================
-- 13. admin_adjust_points -> 'finance' izni (puan level-claim ile bakiyeye donusur)
-- ====================================================================
create or replace function public.admin_adjust_points(p_uid uuid, p_points numeric)
returns json security definer set search_path = public as $$
declare rows_affected integer;
begin
  if not public.has_admin_perm('finance') then return json_build_object('success', false, 'error', 'Icaze yoxdur'); end if;
  update public.profiles set total_points = total_points + p_points
    where id = p_uid and total_points + p_points >= 0;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Xal menfi ola bilmez ve ya istifadeci tapilmadi'); end if;
  return json_build_object('success', true);
end;
$$ language plpgsql;

-- ====================================================================
-- 14. create_withdrawal + create_level_claim -> user_code snapshot (tutarlilik)
-- ====================================================================
create or replace function public.create_withdrawal(amount numeric, crypto_address text, network text, payment_method text, card_number text)
returns json security definer set search_path = public as $$
declare user_id uuid; user_profile record; parsed_amount numeric; rows_affected integer;
begin
  user_id := auth.uid();
  if user_id is null then return json_build_object('success', false, 'error', 'Sessiya tapilmadi.'); end if;
  parsed_amount := amount;
  if parsed_amount is null or parsed_amount <= 0 then return json_build_object('success', false, 'error', 'Meblegi musbet olmalidir'); end if;

  select * into user_profile from public.profiles where id = user_id;
  if not found then return json_build_object('success', false, 'error', 'Istifadeci tapilmadi'); end if;
  if user_profile.role <> 'admin' and user_profile.kyc_status <> 'approved' then
    return json_build_object('success', false, 'error', 'Cixaris ucun KYC teleb olunur.'); end if;
  if public.is_effectively_blocked(user_id) then return json_build_object('success', false, 'error', 'Hesabiniz bloklanib.'); end if;

  update public.profiles set balance = balance - parsed_amount where id = user_id and balance >= parsed_amount;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Balans kifayet etmir'); end if;

  insert into public.withdrawals (uid, login, amount, crypto_address, network, payment_method, card_number, status)
  values (user_id, user_profile.user_code, parsed_amount, crypto_address, network, payment_method, card_number, 'pending');
  insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
  values ('withdrawal', user_id, user_profile.user_code, null, coalesce(card_number, crypto_address), parsed_amount, 'completed');
  return json_build_object('success', true);
end;
$$ language plpgsql;

create or replace function public.create_level_claim(claim_level integer)
returns json security definer set search_path = public as $$
declare
  user_id uuid; user_profile record; req_points numeric; bonus_amt numeric; has_pkgs boolean; rows_affected integer;
begin
  user_id := auth.uid();
  if user_id is null then return json_build_object('success', false, 'error', 'Sessiya tapilmadi.'); end if;

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
  else return json_build_object('success', false, 'error', 'Seviyye tapilmadi'); end if;

  select * into user_profile from public.profiles where id = user_id;
  if not found then return json_build_object('success', false, 'error', 'Istifadeci tapilmadi'); end if;
  if public.is_effectively_blocked(user_id) then return json_build_object('success', false, 'error', 'Hesabiniz bloklanib.'); end if;

  if exists (select 1 from public.level_claims where uid = user_id and level = claim_level and status in ('pending','done')) then
    return json_build_object('success', false, 'error', 'Bu seviyye artiq istifade olunub');
  end if;

  has_pkgs := true;
  if claim_level in (2,3,4) then
    if not (coalesce((user_profile.active_packages->>'pkg19')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg49')::boolean,false)) then has_pkgs := false; end if;
  elsif claim_level in (5,6) then
    if not (coalesce((user_profile.active_packages->>'pkg19')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg49')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg99')::boolean,false)) then has_pkgs := false; end if;
  elsif claim_level = 7 then
    if not (coalesce((user_profile.active_packages->>'pkg19')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg49')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg99')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg199')::boolean,false)) then has_pkgs := false; end if;
  elsif claim_level in (8,9,10) then
    if not (coalesce((user_profile.active_packages->>'pkg19')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg49')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg99')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg199')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg399')::boolean,false)) then has_pkgs := false; end if;
  end if;
  if not has_pkgs then return json_build_object('success', false, 'error', 'Teleb olunan paketler aktiv deyil'); end if;

  update public.profiles
    set total_points = total_points - req_points,
        claimed_levels = coalesce(claimed_levels,'[]'::jsonb) || to_jsonb(claim_level),
        balance = balance + bonus_amt,
        current_level = greatest(coalesce(current_level,0), claim_level)
    where id = user_id and coalesce(total_points,0) >= req_points;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Kifayet qeder xaliniz yoxdur'); end if;

  begin
    insert into public.level_claims (uid, login, level, bonus_amount, claim_type, status, approved_at)
    values (user_id, user_profile.user_code, claim_level, bonus_amt, 'balance', 'done', now());
  exception when unique_violation then
    update public.profiles set total_points = total_points + req_points, balance = balance - bonus_amt where id = user_id;
    return json_build_object('success', false, 'error', 'Bu seviyye artiq istifade olunub');
  end;

  if req_points > 0 then
    insert into public.points_history (uid, points, from_uid, from_login, package_id, line_number)
    values (user_id, -req_points, null, 'Level Claim', 'level_' || claim_level, 0);
  end if;
  insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
  values ('level_bonus', null, 'System', user_id, user_profile.user_code, bonus_amt, 'completed');

  return json_build_object('success', true);
end;
$$ language plpgsql;

commit;
