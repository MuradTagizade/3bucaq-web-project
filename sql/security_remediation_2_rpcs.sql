-- ====================================================================
-- 3bucaq / LEVEL UP — SECURITY REMEDIATION MIGRATION — PART 2 (RPC'ler)
-- ====================================================================
-- security_remediation.sql (Part 1) calistirildiktan SONRA calistirin.
-- Idempotent.
--
-- Kapsam:
--   K4  Para RPC'leri: atomik korumali kesinti + KYC/blok + level unique
--   #10 %10 referral -> min 1 aktif yatirim
--   #4/#5 Idempotent admin onay/red RPC'leri (has_admin_perm('finance'))
--   #1/#2 Gunluk kazanc (balance, idempotent) + paket suresi (service_role)
--   K3  Storage (kyc-documents) RLS
-- ====================================================================

begin;

-- --------------------------------------------------------------------
-- 1. TRANSFER — atomik korumali kesinti + KYC/blok (K4, Y1)
-- --------------------------------------------------------------------
create or replace function public.transfer_funds(to_login text, amount numeric)
returns json security definer set search_path = public as $$
declare
  sender_id uuid;
  sender_profile record;
  recipient_profile record;
  parsed_amount numeric;
  rows_affected integer;
begin
  sender_id := auth.uid();
  if sender_id is null then
    return json_build_object('success', false, 'error', 'Sessiya tapilmadi. Yeniden daxil olun.');
  end if;

  parsed_amount := amount;
  if parsed_amount is null or parsed_amount <= 0 then
    return json_build_object('success', false, 'error', 'Meblegi duzgun deyil');
  end if;

  select * into sender_profile from public.profiles where id = sender_id;
  if not found then
    return json_build_object('success', false, 'error', 'Gonderen istifadeci tapilmadi');
  end if;

  if sender_profile.role <> 'admin' and sender_profile.kyc_status <> 'approved' then
    return json_build_object('success', false, 'error', 'Kocurme etmek ucun KYC dogrulamasi teleb olunur.');
  end if;
  if public.is_effectively_blocked(sender_id) then
    return json_build_object('success', false, 'error', 'Hesabiniz bloklanib.');
  end if;

  select * into recipient_profile from public.profiles where display_login = to_login;
  if not found then
    return json_build_object('success', false, 'error', 'Qebul eden istifadeci tapilmadi');
  end if;
  if sender_id = recipient_profile.id then
    return json_build_object('success', false, 'error', 'Ozunuze kocurme ede bilmezsiniz');
  end if;

  -- Atomik korumali kesinti: bakiye yetersizse 0 satir etkilenir (K4)
  update public.profiles set balance = balance - parsed_amount
    where id = sender_id and balance >= parsed_amount;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then
    return json_build_object('success', false, 'error', 'Balans kifayet etmir');
  end if;

  update public.profiles set balance = balance + parsed_amount where id = recipient_profile.id;

  insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
  values ('transfer', sender_id, sender_profile.display_login, recipient_profile.id, recipient_profile.display_login, parsed_amount, 'completed');

  return json_build_object('success', true);
end;
$$ language plpgsql;

-- --------------------------------------------------------------------
-- 2. BUY PACKAGE — atomik kesinti + aktif-kontrol + %10 min-1 referral
-- --------------------------------------------------------------------
create or replace function public.buy_package(pkg_id text)
returns json security definer set search_path = public as $$
declare
  buyer_id uuid;
  buyer_profile record;
  pkg_price numeric;
  pkg_points numeric;
  upline_id uuid;
  current_depth integer := 1;
  parent_profile record;
  bonus_to_add numeric;
  rows_affected integer;
begin
  buyer_id := auth.uid();
  if buyer_id is null then
    return json_build_object('success', false, 'error', 'Sessiya tapilmadi.');
  end if;

  if pkg_id = 'pkg19' then pkg_price := 19; pkg_points := 0.6;
  elsif pkg_id = 'pkg49' then pkg_price := 49; pkg_points := 1.5;
  elsif pkg_id = 'pkg99' then pkg_price := 99; pkg_points := 3.0;
  elsif pkg_id = 'pkg199' then pkg_price := 199; pkg_points := 6.0;
  elsif pkg_id = 'pkg399' then pkg_price := 399; pkg_points := 12.0;
  elsif pkg_id = 'pkg799' then pkg_price := 799; pkg_points := 24.0;
  else return json_build_object('success', false, 'error', 'Paket tapilmadi');
  end if;

  select * into buyer_profile from public.profiles where id = buyer_id;
  if not found then
    return json_build_object('success', false, 'error', 'Istifadeci tapilmadi');
  end if;
  if public.is_effectively_blocked(buyer_id) then
    return json_build_object('success', false, 'error', 'Hesabiniz bloklanib.');
  end if;

  -- Atomik: yeterli bakiye VE paket aktif degilse tek islemde kes + aktive et (K4)
  update public.profiles
    set balance = balance - pkg_price,
        active_packages = jsonb_set(coalesce(active_packages,'{}'::jsonb), array[pkg_id], 'true'::jsonb),
        package_activated_at = jsonb_set(coalesce(package_activated_at,'{}'::jsonb), array[pkg_id],
              to_jsonb(to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
    where id = buyer_id
      and balance >= pkg_price
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
  values ('package_purchase', buyer_id, buyer_profile.display_login, buyer_id, buyer_profile.display_login, pkg_price, 'completed');

  -- Referral bonus + points (5 hat). Parent'in EN AZ 1 aktif paketi olmali.
  upline_id := buyer_profile.referred_by;
  while upline_id is not null and current_depth <= 5 loop
    select * into parent_profile from public.profiles where id = upline_id;
    if not found then exit; end if;

    if exists (select 1 from jsonb_each_text(coalesce(parent_profile.active_packages,'{}'::jsonb)) where lower(value) = 'true') then
      if pkg_points > 0 then
        update public.profiles set total_points = total_points + pkg_points where id = parent_profile.id;
        insert into public.points_history (uid, points, from_uid, from_login, package_id, line_number)
        values (parent_profile.id, pkg_points, buyer_id, buyer_profile.display_login, pkg_id, current_depth);
      end if;

      if current_depth = 1 then
        -- %10 direkt bonus — min 1 aktif yatirim (yukaridaki exists kontrolu garanti eder). #10
        bonus_to_add := pkg_price * 0.10;
        update public.profiles set balance = balance + bonus_to_add where id = parent_profile.id;
        insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
        values ('referral_bonus', buyer_id, buyer_profile.display_login, parent_profile.id, parent_profile.display_login, bonus_to_add, 'completed');
      else
        bonus_to_add := pkg_price * 0.01;
        update public.profiles set balance = balance + bonus_to_add where id = parent_profile.id;
        insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
        values ('depth_bonus', buyer_id, buyer_profile.display_login, parent_profile.id, parent_profile.display_login, bonus_to_add, 'completed');
      end if;
    end if;

    upline_id := parent_profile.referred_by;
    current_depth := current_depth + 1;
  end loop;

  return json_build_object('success', true);
end;
$$ language plpgsql;

-- --------------------------------------------------------------------
-- 3. CREATE WITHDRAWAL — atomik kesinti + KYC/blok (K4, Y1)
-- --------------------------------------------------------------------
create or replace function public.create_withdrawal(amount numeric, crypto_address text, network text, payment_method text, card_number text)
returns json security definer set search_path = public as $$
declare
  user_id uuid;
  user_profile record;
  parsed_amount numeric;
  rows_affected integer;
begin
  user_id := auth.uid();
  if user_id is null then
    return json_build_object('success', false, 'error', 'Sessiya tapilmadi.');
  end if;
  parsed_amount := amount;
  if parsed_amount is null or parsed_amount <= 0 then
    return json_build_object('success', false, 'error', 'Meblegi musbet olmalidir');
  end if;

  select * into user_profile from public.profiles where id = user_id;
  if not found then
    return json_build_object('success', false, 'error', 'Istifadeci tapilmadi');
  end if;
  if user_profile.role <> 'admin' and user_profile.kyc_status <> 'approved' then
    return json_build_object('success', false, 'error', 'Cixaris etmek ucun KYC dogrulamasi teleb olunur.');
  end if;
  if public.is_effectively_blocked(user_id) then
    return json_build_object('success', false, 'error', 'Hesabiniz bloklanib.');
  end if;

  update public.profiles set balance = balance - parsed_amount
    where id = user_id and balance >= parsed_amount;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then
    return json_build_object('success', false, 'error', 'Balans kifayet etmir');
  end if;

  insert into public.withdrawals (uid, login, amount, crypto_address, network, payment_method, card_number, status)
  values (user_id, user_profile.display_login, parsed_amount, crypto_address, network, payment_method, card_number, 'pending');

  insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
  values ('withdrawal', user_id, user_profile.display_login, null, coalesce(card_number, crypto_address), parsed_amount, 'completed');

  return json_build_object('success', true);
end;
$$ language plpgsql;

-- --------------------------------------------------------------------
-- 4. LEVEL CLAIM — cift-claim korumasi (unique index) + atomik puan (K4)
-- --------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from public.level_claims
    where status in ('pending','done') group by uid, level having count(*) > 1
  ) then
    create unique index if not exists level_claims_uid_level_active_uniq
      on public.level_claims (uid, level) where status in ('pending','done');
  else
    raise notice 'level_claims: mevcut cift kayitlar var — unique index ATLANDI. Once temizleyin, sonra tekrar calistirin.';
  end if;
end $$;

create or replace function public.create_level_claim(claim_level integer)
returns json security definer set search_path = public as $$
declare
  user_id uuid;
  user_profile record;
  req_points numeric;
  bonus_amt numeric;
  has_pkgs boolean;
  rows_affected integer;
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
  if public.is_effectively_blocked(user_id) then
    return json_build_object('success', false, 'error', 'Hesabiniz bloklanib.');
  end if;

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

  -- Atomik puan kesintisi: yeterli puan yoksa 0 satir (K4)
  update public.profiles
    set total_points = total_points - req_points,
        claimed_levels = coalesce(claimed_levels,'[]'::jsonb) || to_jsonb(claim_level),
        balance = balance + bonus_amt,
        current_level = greatest(coalesce(current_level,0), claim_level)
    where id = user_id and coalesce(total_points,0) >= req_points;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then
    return json_build_object('success', false, 'error', 'Kifayet qeder xaliniz yoxdur');
  end if;

  -- Unique index cift-claim yarisini engeller; carparsa geri al
  begin
    insert into public.level_claims (uid, login, level, bonus_amount, claim_type, status, approved_at)
    values (user_id, user_profile.display_login, claim_level, bonus_amt, 'balance', 'done', now());
  exception when unique_violation then
    update public.profiles set total_points = total_points + req_points, balance = balance - bonus_amt where id = user_id;
    return json_build_object('success', false, 'error', 'Bu seviyye artiq istifade olunub');
  end;

  if req_points > 0 then
    insert into public.points_history (uid, points, from_uid, from_login, package_id, line_number)
    values (user_id, -req_points, null, 'Level Claim', 'level_' || claim_level, 0);
  end if;
  insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
  values ('level_bonus', null, 'System', user_id, user_profile.display_login, bonus_amt, 'completed');

  return json_build_object('success', true);
end;
$$ language plpgsql;

-- --------------------------------------------------------------------
-- 5. IDEMPOTENT ADMIN ONAY/RED RPC'LERI (#4, #5, Y4) — has_admin_perm('finance')
-- --------------------------------------------------------------------
create or replace function public.admin_approve_deposit(p_deposit_id uuid)
returns json security definer set search_path = public as $$
declare dep record; rows_affected integer;
begin
  if not public.has_admin_perm('finance') then return json_build_object('success', false, 'error', 'Icaze yoxdur'); end if;
  update public.deposits set status = 'approved', approved_at = now()
    where id = p_deposit_id and status = 'pending' returning * into dep;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Depozit tapilmadi ve ya artiq islenib'); end if;
  update public.profiles set balance = balance + dep.amount where id = dep.uid;
  insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
  values ('deposit', dep.uid, dep.login, dep.uid, dep.login, dep.amount, 'completed');
  return json_build_object('success', true);
end;
$$ language plpgsql;

create or replace function public.admin_reject_deposit(p_deposit_id uuid)
returns json security definer set search_path = public as $$
declare rows_affected integer;
begin
  if not public.has_admin_perm('finance') then return json_build_object('success', false, 'error', 'Icaze yoxdur'); end if;
  update public.deposits set status = 'rejected' where id = p_deposit_id and status = 'pending';
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Depozit tapilmadi ve ya artiq islenib'); end if;
  return json_build_object('success', true);
end;
$$ language plpgsql;

create or replace function public.admin_approve_withdrawal(p_withdrawal_id uuid, p_tx_hash text, p_receipt_url text)
returns json security definer set search_path = public as $$
declare rows_affected integer;
begin
  if not public.has_admin_perm('finance') then return json_build_object('success', false, 'error', 'Icaze yoxdur'); end if;
  -- Bakiye create_withdrawal'da zaten dusuldu; burada yalnizca durum.
  update public.withdrawals set status = 'done', tx_hash = p_tx_hash, receipt_url = p_receipt_url, approved_at = now()
    where id = p_withdrawal_id and status = 'pending';
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Cixaris tapilmadi ve ya artiq islenib'); end if;
  return json_build_object('success', true);
end;
$$ language plpgsql;

create or replace function public.admin_reject_withdrawal(p_withdrawal_id uuid)
returns json security definer set search_path = public as $$
declare wd record; rows_affected integer;
begin
  if not public.has_admin_perm('finance') then return json_build_object('success', false, 'error', 'Icaze yoxdur'); end if;
  update public.withdrawals set status = 'rejected'
    where id = p_withdrawal_id and status = 'pending' returning * into wd;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Cixaris tapilmadi ve ya artiq islenib'); end if;
  update public.profiles set balance = balance + wd.amount where id = wd.uid;  -- iade (idempotent)
  return json_build_object('success', true);
end;
$$ language plpgsql;

create or replace function public.admin_approve_claim(p_claim_id uuid, p_tx_hash text)
returns json security definer set search_path = public as $$
declare cl record; rows_affected integer;
begin
  if not public.has_admin_perm('claims') then return json_build_object('success', false, 'error', 'Icaze yoxdur'); end if;
  update public.level_claims set status = 'done', tx_hash = p_tx_hash, approved_at = now()
    where id = p_claim_id and status = 'pending' returning * into cl;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Telebi tapilmadi ve ya artiq islenib'); end if;
  update public.profiles set current_level = greatest(coalesce(current_level,0), cl.level) where id = cl.uid;
  insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
  values ('level_bonus', null, 'Admin', cl.uid, cl.login, cl.bonus_amount, 'completed');
  return json_build_object('success', true);
end;
$$ language plpgsql;

create or replace function public.admin_reject_claim(p_claim_id uuid)
returns json security definer set search_path = public as $$
declare cl record; req_points numeric; rows_affected integer;
begin
  if not public.has_admin_perm('claims') then return json_build_object('success', false, 'error', 'Icaze yoxdur'); end if;
  update public.level_claims set status = 'rejected'
    where id = p_claim_id and status = 'pending' returning * into cl;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Telebi tapilmadi ve ya artiq islenib'); end if;
  -- Puan iadesi
  if cl.level = 1 then req_points := 30;
  elsif cl.level = 2 then req_points := 109; elsif cl.level = 3 then req_points := 268;
  elsif cl.level = 4 then req_points := 597; elsif cl.level = 5 then req_points := 1266;
  elsif cl.level = 6 then req_points := 2615; elsif cl.level = 7 then req_points := 5314;
  elsif cl.level = 8 then req_points := 10723; elsif cl.level = 9 then req_points := 21552;
  elsif cl.level = 10 then req_points := 43321; else req_points := 0; end if;
  update public.profiles
    set total_points = total_points + req_points,
        claimed_levels = coalesce(claimed_levels,'[]'::jsonb) - cl.level::text
    where id = cl.uid;
  if req_points > 0 then
    insert into public.points_history (uid, points, from_uid, from_login, package_id, line_number)
    values (cl.uid, req_points, null, 'Claim Rejected', 'level_' || cl.level, 0);
  end if;
  return json_build_object('success', true);
end;
$$ language plpgsql;

create or replace function public.admin_adjust_balance(p_uid uuid, p_amount numeric, p_type text default 'admin_adjust')
returns json security definer set search_path = public as $$
declare target record; rows_affected integer;
begin
  if not public.has_admin_perm('finance') then return json_build_object('success', false, 'error', 'Icaze yoxdur'); end if;
  update public.profiles set balance = balance + p_amount
    where id = p_uid and balance + p_amount >= 0 returning * into target;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Balans menfi ola bilmez ve ya istifadeci tapilmadi'); end if;
  insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
  values (coalesce(p_type,'admin_adjust'), null, 'Admin', p_uid, target.display_login, p_amount, 'completed');
  return json_build_object('success', true);
end;
$$ language plpgsql;

create or replace function public.admin_adjust_points(p_uid uuid, p_points numeric)
returns json security definer set search_path = public as $$
declare rows_affected integer;
begin
  if not public.has_admin_perm('users') then return json_build_object('success', false, 'error', 'Icaze yoxdur'); end if;
  update public.profiles set total_points = total_points + p_points
    where id = p_uid and total_points + p_points >= 0;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Xal menfi ola bilmez ve ya istifadeci tapilmadi'); end if;
  return json_build_object('success', true);
end;
$$ language plpgsql;

-- --------------------------------------------------------------------
-- 6. GUNLUK KAZANC + PAKET SURESI (idempotent, service_role) — #1, #2
-- --------------------------------------------------------------------
create or replace function public.process_daily_earnings()
returns json security definer set search_path = public as $$
declare cnt integer := 0; r record; daily numeric;
begin
  for r in
    select id, display_login, active_packages from public.profiles
    where coalesce(is_blocked,false) = false
      and coalesce(last_daily_earning_date,'1970-01-01') < current_date
      and (coalesce(lower(active_packages->>'pkg399'),'false')='true'
        or coalesce(lower(active_packages->>'pkg799'),'false')='true')
  loop
    daily := 0;
    if coalesce(lower(r.active_packages->>'pkg399'),'false')='true' then daily := daily + 3.3; end if;
    if coalesce(lower(r.active_packages->>'pkg799'),'false')='true' then daily := daily + 6.5; end if;
    update public.profiles set balance = balance + daily, last_daily_earning_date = current_date where id = r.id;
    insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
    values ('daily_earning', null, 'System', r.id, r.display_login, daily, 'completed');
    cnt := cnt + 1;
  end loop;
  return json_build_object('success', true, 'processed', cnt);
end;
$$ language plpgsql;

create or replace function public.process_package_expiry()
returns json security definer set search_path = public as $$
declare cnt integer := 0; r record; pkgs jsonb; acts jsonb; changed boolean; pid text; adate timestamptz;
begin
  for r in select id, active_packages, package_activated_at from public.profiles
           where coalesce(lower(active_packages->>'pkg399'),'false')='true'
              or coalesce(lower(active_packages->>'pkg799'),'false')='true'
  loop
    pkgs := coalesce(r.active_packages,'{}'::jsonb);
    acts := coalesce(r.package_activated_at,'{}'::jsonb);
    changed := false;
    foreach pid in array array['pkg399','pkg799'] loop
      if coalesce(lower(pkgs->>pid),'false')='true' and acts ? pid then
        begin adate := (acts->>pid)::timestamptz; exception when others then adate := null; end;
        if adate is not null and adate < now() - interval '120 days' then
          pkgs := jsonb_set(pkgs, array[pid], 'false'::jsonb);
          acts := acts - pid;
          changed := true;
        end if;
      end if;
    end loop;
    if changed then
      update public.profiles set active_packages = pkgs, package_activated_at = acts where id = r.id;
      cnt := cnt + 1;
    end if;
  end loop;
  return json_build_object('success', true, 'processed', cnt);
end;
$$ language plpgsql;

create or replace function public.run_daily_maintenance()
returns json security definer set search_path = public as $$
begin
  perform public.process_package_expiry();
  return public.process_daily_earnings();
end;
$$ language plpgsql;

-- --------------------------------------------------------------------
-- 7. EXECUTE IZINLERI
-- --------------------------------------------------------------------
-- Cron fonksiyonlari: yalnizca service_role
revoke execute on function public.process_daily_earnings() from public;
revoke execute on function public.process_package_expiry() from public;
revoke execute on function public.run_daily_maintenance() from public;
grant execute on function public.process_daily_earnings() to service_role;
grant execute on function public.process_package_expiry() to service_role;
grant execute on function public.run_daily_maintenance() to service_role;

-- Anon lookup RPC izinleri Part 1'e tasindi (dosya sirasi bagimsizligi icin).

commit;

-- ====================================================================
-- 8. STORAGE RLS (K3) — ONCE Supabase panelinden 'kyc-documents'
--    bucket'ini PRIVATE yapin, sonra bu blogu calistirin.
-- ====================================================================
-- Not: storage.objects'te RLS Supabase'de zaten aciktir.
drop policy if exists "kyc_select_own_or_admin" on storage.objects;
create policy "kyc_select_own_or_admin" on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents' and (owner = auth.uid() or public.is_admin()));

drop policy if exists "kyc_insert_own" on storage.objects;
create policy "kyc_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and owner = auth.uid());

drop policy if exists "kyc_update_own_or_admin" on storage.objects;
create policy "kyc_update_own_or_admin" on storage.objects for update to authenticated
  using (bucket_id = 'kyc-documents' and (owner = auth.uid() or public.is_admin()));

drop policy if exists "kyc_delete_own_or_admin" on storage.objects;
create policy "kyc_delete_own_or_admin" on storage.objects for delete to authenticated
  using (bucket_id = 'kyc-documents' and (owner = auth.uid() or public.is_admin()));
