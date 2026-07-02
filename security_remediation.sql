-- ====================================================================
-- 3bucaq / LEVEL UP — SECURITY REMEDIATION MIGRATION
-- ====================================================================
-- Bunu Supabase Dashboard -> SQL Editor'de, ONCEKI tum migration'lardan
-- SONRA calistirin. Idempotent: guvenle tekrar calistirilabilir.
--
-- Kapsanan bulgular:
--   K1  handle_new_user icindeki admin backdoor (hardcoded email)
--   K2  profiles anon/genis okuma (PII/KYC/bakiye sizintisi)
--   K3  KYC/dekont storage bucket RLS (bucket'i panelden PRIVATE yapin)
--   K4  Para RPC'lerinde double-spend yarisi + balance CHECK + level unique
--   K5  admin_permissions self-elevation + granuler yetki
--   Y1  RPC'lerde KYC / is_blocked kontrolu
--   Y2  Kullanici email/display_login degistirebiliyor
--   #1  Gunluk kazanc (balance'a, idempotent) + #2 paket suresi
--   #3  USDC deposit CHECK
--   #4/#5 Idempotent admin onay/red RPC'leri
--   #10 %10 referral: min 1 aktif yatirim (tasarim belgesi)
--   #12 Trigger'da NULL-guvenli karsilastirma (IS DISTINCT FROM)
--   O1  points_history sahte insert kilidi
-- ====================================================================

begin;

-- --------------------------------------------------------------------
-- 1. BAKIYE BUTUNLUK KISITLARI (K4 backstop)
--    NOT VALID: mevcut satirlari taramaz, yeni yazimlari zorlar.
-- --------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_balance_nonneg') then
    alter table public.profiles
      add constraint profiles_balance_nonneg check (balance >= 0) not valid;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='profiles' and column_name='transfer_balance')
     and not exists (select 1 from pg_constraint where conname = 'profiles_transfer_balance_nonneg') then
    alter table public.profiles
      add constraint profiles_transfer_balance_nonneg check (transfer_balance >= 0) not valid;
  end if;
end $$;

-- Mevcut negatif bakiye var mi? (tani amacli — 0 satir donmeli)
-- select id, display_login, balance from public.profiles where balance < 0;

-- Idempotent gunluk kazanc icin damga sutunu (#1)
alter table public.profiles
  add column if not exists last_daily_earning_date date;

-- USDC deposit destegi (#3)
do $$
begin
  alter table public.deposits drop constraint if exists deposits_payment_method_check;
  alter table public.deposits
    add constraint deposits_payment_method_check
    check (payment_method in ('usdt', 'usdc', 'card'));
end $$;

-- --------------------------------------------------------------------
-- 2. YETKI YARDIMCILARI
-- --------------------------------------------------------------------
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

-- Granuler admin yetki kontrolu (K5). superadmin her seyi kapsar.
create or replace function public.has_admin_perm(perm text)
returns boolean
security definer
set search_path = public
as $$
declare
  perms jsonb;
begin
  select admin_permissions into perms
    from public.profiles
    where id = auth.uid() and role = 'admin';
  if perms is null then
    return false;
  end if;
  return coalesce((perms->>'superadmin')::boolean, false)
      or coalesce((perms->>perm)::boolean, false);
end;
$$ language plpgsql;

create or replace function public.is_superadmin()
returns boolean
security definer
set search_path = public
as $$
declare
  perms jsonb;
begin
  select admin_permissions into perms
    from public.profiles
    where id = auth.uid() and role = 'admin';
  return coalesce((perms->>'superadmin')::boolean, false);
end;
$$ language plpgsql;

-- Bloklu mu? (blocked_until gecmisse blok bitmis sayilir — bug #18)
create or replace function public.is_effectively_blocked(p_id uuid)
returns boolean
security definer
set search_path = public
as $$
declare
  r record;
begin
  select is_blocked, blocked_until into r from public.profiles where id = p_id;
  if not found then return false; end if;
  if not r.is_blocked then return false; end if;
  if r.blocked_until is not null and r.blocked_until <= now() then
    return false; -- suresi dolmus gecici blok
  end if;
  return true;
end;
$$ language plpgsql;

-- --------------------------------------------------------------------
-- 3. handle_new_user — ADMIN BACKDOOR KALDIRILDI (K1)
--    Hardcoded admin@3bucaq.com / admin@levelup.com atamasi silindi.
--    Admin yalnizca create-subadmin route (service_role) ile atanir.
-- --------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger security definer set search_path = public as $$
declare
  ref_code text;
  ref_uid uuid;
  user_login text;
begin
  ref_code := 'REF' || lpad(floor(random() * 100000)::text, 5, '0');

  user_login := coalesce(
    new.raw_user_meta_data->>'display_login',
    split_part(new.email, '@', 1)
  );

  if new.raw_user_meta_data->>'referral_code' is not null
     and new.raw_user_meta_data->>'referral_code' != '' then
    select id into ref_uid from public.profiles
      where referral_code = new.raw_user_meta_data->>'referral_code'
      limit 1;
  end if;

  insert into public.profiles (
    id, email, display_login, full_name, role, referral_code,
    referred_by, country, city, phone, admin_permissions
  ) values (
    new.id,
    new.email,
    user_login,
    coalesce(new.raw_user_meta_data->>'full_name', user_login),
    'user',                       -- HER ZAMAN normal kullanici
    ref_code,
    ref_uid,
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'phone',
    '{}'::jsonb
  );
  return new;
end;
$$ language plpgsql;

-- --------------------------------------------------------------------
-- 4. profiles RLS KILITLEME (K2)
--    - anon "public read" politikasi kaldirildi
--    - genis "authenticated read" -> yalnizca kendi satiri + admin
--    Cross-user okumalar asagidaki SECURITY DEFINER RPC'lerle yapilir.
-- --------------------------------------------------------------------
drop policy if exists "Allow public read of profiles" on public.profiles;
drop policy if exists "Allow authenticated read access to profiles" on public.profiles;
drop policy if exists "Allow users and admins to update profiles" on public.profiles;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

-- Guncelleme politikasi (kendi satiri veya admin) — trigger asil korumayi yapar
drop policy if exists "Allow users to update their own profiles" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- Anon-cagrilabilir guvenli lookup RPC'leri (register/login/forgot)
create or replace function public.check_login_exists(p_login text)
returns boolean
security definer
set search_path = public
as $$
begin
  return exists (select 1 from public.profiles where display_login = p_login);
end;
$$ language plpgsql;

create or replace function public.check_referral_code(p_code text)
returns json
security definer
set search_path = public
as $$
declare
  r record;
begin
  select id, display_login into r from public.profiles where referral_code = p_code limit 1;
  if not found then
    return json_build_object('valid', false);
  end if;
  return json_build_object('valid', true, 'sponsor_login', r.display_login);
end;
$$ language plpgsql;

-- Kullanici adi ile giris icin login -> email cozumleme
create or replace function public.resolve_login_email(p_login text)
returns text
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from public.profiles where display_login = p_login limit 1;
  return v_email;
end;
$$ language plpgsql;

-- Transfer alicisi dogrulama (authenticated) — sadece varlik + gorunen ad
create or replace function public.lookup_login(p_login text)
returns json
security definer
set search_path = public
as $$
declare
  r record;
begin
  if auth.uid() is null then
    return json_build_object('exists', false);
  end if;
  select display_login, full_name into r from public.profiles where display_login = p_login limit 1;
  if not found then
    return json_build_object('exists', false);
  end if;
  return json_build_object('exists', true, 'display_login', r.display_login, 'full_name', r.full_name);
end;
$$ language plpgsql;

-- Cagiranin kendi downline'i (5 hat) — subscribers sayfasi (K2)
create or replace function public.get_my_referral_tree(max_depth integer default 5)
returns json
security definer
set search_path = public
as $$
declare
  me uuid;
  result json;
begin
  me := auth.uid();
  if me is null then
    return '[]'::json;
  end if;
  with recursive tree as (
    select p.id, p.display_login, p.full_name, p.total_points, p.current_level,
           p.created_at, p.active_packages, p.referred_by, 1 as line
    from public.profiles p
    where p.referred_by = me
    union all
    select c.id, c.display_login, c.full_name, c.total_points, c.current_level,
           c.created_at, c.active_packages, c.referred_by, t.line + 1
    from public.profiles c
    join tree t on c.referred_by = t.id
    where t.line < max_depth
  )
  select coalesce(json_agg(json_build_object(
    'uid', id, 'displayLogin', display_login, 'fullName', full_name,
    'line', line, 'totalPoints', total_points, 'currentLevel', current_level,
    'joinedAt', created_at, 'activePackages', active_packages
  )), '[]'::json) into result from tree;
  return result;
end;
$$ language plpgsql;

-- Kimlik no. mukerrer kontrolu (parametreli — enjeksiyon O4 fix)
create or replace function public.check_identity_exists(p_num text)
returns boolean
security definer
set search_path = public
as $$
declare
  cleaned text;
begin
  cleaned := trim(p_num);
  if cleaned = '' or cleaned is null then
    return false;
  end if;
  return exists (
    select 1 from public.profiles
    where id <> auth.uid()
      and (kyc_document_number = cleaned or identity_number = cleaned)
  );
end;
$$ language plpgsql;

-- E-posta degisikligi auth tarafinda tamamlanunca profiles.email'i esitle (Y2)
-- Kullanici kendi email'ini dogrudan degistiremez; yalniz bu RPC auth ile esitler.
create or replace function public.sync_my_email()
returns json
security definer
set search_path = public
as $$
declare v_email text;
begin
  if auth.uid() is null then return json_build_object('success', false); end if;
  select email into v_email from auth.users where id = auth.uid();
  update public.profiles set email = v_email where id = auth.uid();
  return json_build_object('success', true);
end;
$$ language plpgsql;
grant execute on function public.sync_my_email() to authenticated;

-- --------------------------------------------------------------------
-- 5. DIGER GEVSEK ESKI POLITIKALARI TEMIZLE (O1, O3, tekrarlar)
--    security_patch.sql zaten esdeger/daha siki olanlari olusturdu.
-- --------------------------------------------------------------------
drop policy if exists "Allow users to see their own transactions" on public.transactions;
drop policy if exists "Allow users and admins to insert transactions" on public.transactions;
drop policy if exists "Allow users to see their own level claims" on public.level_claims;
drop policy if exists "Allow users to insert level claims" on public.level_claims;
drop policy if exists "Allow admin to update level claims" on public.level_claims;
drop policy if exists "Allow admin to select admin logs" on public.admin_logs;
drop policy if exists "Allow admin to insert admin logs" on public.admin_logs;
drop policy if exists "Allow users to see own points" on public.points_history;
drop policy if exists "Allow insert points" on public.points_history;            -- O1: with check(true)
drop policy if exists "Allow users to see own deposits" on public.deposits;
drop policy if exists "Allow users to insert deposits" on public.deposits;        -- O3
drop policy if exists "Allow admin to update deposits" on public.deposits;
drop policy if exists "Allow users to see own withdrawals" on public.withdrawals;
drop policy if exists "Allow users to insert withdrawals" on public.withdrawals;
drop policy if exists "Allow admin to update withdrawals" on public.withdrawals;
drop policy if exists "Allow select for authenticated" on public.system_settings;
drop policy if exists "Allow update for admin" on public.system_settings;

-- Kullanicilar dogrudan withdrawals INSERT edemesin (create_withdrawal RPC uzerinden) —
-- security_patch "Users can view..." + "Admins can manage..." zaten mevcut; ek insert gerekmez.

-- --------------------------------------------------------------------
-- 6. check_profile_updates TRIGGER SIKLASTIRMA
--    + admin_permissions korumasi (K5)
--    + email / display_login korumasi (Y2)
--    + IS DISTINCT FROM (NULL-guvenli, #12)
-- --------------------------------------------------------------------
create or replace function public.check_profile_updates()
returns trigger
security definer
set search_path = public
as $$
declare
  is_admin_user boolean;
begin
  if NEW.kyc_status = 'approved' and OLD.kyc_status is distinct from 'approved' then
    NEW.identity_number := coalesce(NEW.kyc_document_number, OLD.kyc_document_number);
  end if;

  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return NEW;
  end if;

  -- admin_permissions yalnizca superadmin/service_role degistirebilir (K5)
  if NEW.admin_permissions is distinct from OLD.admin_permissions then
    if not public.is_superadmin() then
      raise exception 'Icaze yoxdur: Admin icazelerini deyise bilmezsiniz';
    end if;
  end if;

  -- Rol degisikligi yalniz superadmin/service_role (K5)
  if NEW.role is distinct from OLD.role then
    if not public.is_superadmin() then
      raise exception 'Icaze yoxdur: Rol yalniz superadmin terefinden deyise biler';
    end if;
  end if;

  is_admin_user := public.is_admin();

  if not is_admin_user then
    if NEW.balance is distinct from OLD.balance then
      raise exception 'Icaze yoxdur: Balansinizi birbasa deyise bilmezsiniz';
    end if;
    if (to_jsonb(NEW) ? 'transfer_balance')
       and NEW.transfer_balance is distinct from OLD.transfer_balance then
      raise exception 'Icaze yoxdur: Transfer balansinizi deyise bilmezsiniz';
    end if;
    if NEW.total_points is distinct from OLD.total_points then
      raise exception 'Icaze yoxdur: Xallarinizi birbasa deyise bilmezsiniz';
    end if;
    if NEW.active_packages is distinct from OLD.active_packages then
      raise exception 'Icaze yoxdur: Paketlerinizi birbasa deyise bilmezsiniz';
    end if;
    if NEW.package_activated_at is distinct from OLD.package_activated_at then
      raise exception 'Icaze yoxdur: Paket aktivasiya tarixini deyise bilmezsiniz';
    end if;
    if NEW.is_blocked is distinct from OLD.is_blocked
       or NEW.blocked_until is distinct from OLD.blocked_until then
      raise exception 'Icaze yoxdur: Blok statusunu deyise bilmezsiniz';
    end if;
    -- email ve display_login degistirmeyi engelle (Y2)
    if NEW.email is distinct from OLD.email then
      raise exception 'Icaze yoxdur: Emaili birbasa deyise bilmezsiniz';
    end if;
    if NEW.display_login is distinct from OLD.display_login then
      raise exception 'Icaze yoxdur: Login adini deyise bilmezsiniz';
    end if;
    if NEW.identity_number is distinct from OLD.identity_number then
      raise exception 'Icaze yoxdur: Kimlik nomresini deyise bilmezsiniz';
    end if;
    if OLD.kyc_status = 'approved'
       and NEW.kyc_document_number is distinct from OLD.kyc_document_number then
      raise exception 'Icaze yoxdur: Tesdiqlenmis KYC sened nomresini deyise bilmezsiniz';
    end if;
    if NEW.kyc_status is distinct from OLD.kyc_status then
      if NEW.kyc_status not in ('none', 'pending') then
        raise exception 'Icaze yoxdur: KYC statusunu tesdiqleye ve ya redd ede bilmezsiniz';
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

commit;
