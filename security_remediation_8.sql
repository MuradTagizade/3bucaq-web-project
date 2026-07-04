-- ============================================================================
-- SECURITY REMEDIATION — PART 8: KYC yalnız pul ÇIXIŞI üçün
-- Tarix: 2026-07-04
-- Zəncir: schema.sql → security_remediation.sql → _2_rpcs.sql → _3 → _4 → _5 → _6 → _7 → BU FAYL
--
-- İş qaydası dəyişikliyi (istifadəçi istəyi):
--   * KYC şərti QALDIRILDI:  buy_package (hotbed paketi almaq), depozit axını
--     (admin_approve_deposit-dəki KYC yoxlaması).
--   * KYC şərti QALIR:       transfer_funds (daxili köçürmə), create_withdrawal (çıxarış).
--     (Pul sistemə KYC-siz girə bilər, amma KYC-siz ÇIXA BİLMƏZ.)
--
-- Part 4-dəki buy_package (KYC şərtli) və Part 2-dəki admin_approve_deposit
-- (KYC yoxlamalı) tərifləri bu fayl ilə superseded olur.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) buy_package — KYC şərti çıxarıldı (qalan məntiq Part 4 ilə eynidir:
--    balans yoxlaması, aktiv-paket təkrarı, upline self/cycle qoruması,
--    upline min-1-aktiv-paket şərti, 5 xətt bonus dağıtımı)
-- ----------------------------------------------------------------------------
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

  -- Part 8: KYC şərti QALDIRILDI (paket almaq üçün KYC tələb olunmur)

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
$function$;

-- Part 6 whitelist grant modeli: yeni tərifə icazələri AÇIQCA yaz
revoke all on function public.buy_package(text) from public, anon;
grant execute on function public.buy_package(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 2) admin_approve_deposit — istifadəçinin KYC yoxlaması çıxarıldı
--    (depozit artıq KYC tələb etmir; has_admin_perm('finance') qalır)
-- ----------------------------------------------------------------------------
create or replace function public.admin_approve_deposit(p_deposit_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare dep record; rows_affected integer;
begin
  if not public.has_admin_perm('finance') then return json_build_object('success', false, 'error', 'Icaze yoxdur'); end if;
  update public.deposits set status = 'approved', approved_at = now()
    where id = p_deposit_id and status = 'pending' returning * into dep;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Depozit tapilmadi ve ya artiq islenib'); end if;

  -- Part 8: depozit üçün KYC yoxlaması QALDIRILDI

  update public.profiles set balance = balance + dep.amount where id = dep.uid;
  insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
  values ('deposit', dep.uid, dep.login, dep.uid, dep.login, dep.amount, 'completed');
  return json_build_object('success', true);
end;
$function$;

revoke all on function public.admin_approve_deposit(uuid) from public, anon;
grant execute on function public.admin_approve_deposit(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Doğrulama (əl ilə):
--   select prosrc ilike '%kyc%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public' and p.proname in ('buy_package','admin_approve_deposit');
--   -- hər ikisi false olmalıdır; transfer_funds/create_withdrawal isə true qalmalıdır.
-- ----------------------------------------------------------------------------
