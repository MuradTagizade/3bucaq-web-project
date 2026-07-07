-- ============================================================================
-- SECURITY REMEDIATION — PART 14: Hotbed paketləri level-up-da sıfırlanır +
--   gündəlik qazanc paket-başına ayrı sətir + Bakı gecəyarısı cron
-- Tarix: 2026-07-07
-- Zəncir: ... → _12.sql → _13.sql → BU FAYL
--
-- İş qaydası dəyişikliyi (istifadəçi istəyi):
--  1) Paketlər ARTIQ ÖMÜRLÜK DEYİL. Hər level bonusu alınanda (level > 1)
--     BÜTÜN hotbed paketləri sönür (active_packages/package_activated_at
--     sıfırlanır). Növbəti level bonusunu almaq üçün tələb olunan paketlər
--     YENİDƏN alınmalıdır. PUL GERİ QAYTARILMIR (re-invest modeli).
--  2) create_level_claim: level 10 tələbinə pkg799 əlavə olundu.
--  3) process_daily_earnings: #399 və #799 gündəlik qazancı artıq TƏK birləşmiş
--     sətir yox, HƏR PAKET üçün AYRI transactions sətri yazır (from_login=paket
--     adı → history-də ayrı etiket). Tarix-guard UTC yox, BAKI gününə görə.
--  4) pg_cron 'daily-maintenance' 00:05 UTC → 20:00 UTC (= Bakı 00:00) köçürülür.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) create_level_claim — level 10-a pkg799 + uğurlu claim-dən sonra paketləri sıfırla
--    (_13.sql-dəki tərifi əvəz edir; xal çıxılmaması davranışı qorunur)
-- ----------------------------------------------------------------------------
create or replace function public.create_level_claim(claim_level integer)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  -- Tələb olunan paketlər (level > 1): hər level-up-da sıfırlandığı üçün YENİDƏN alınmalıdır
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
  elsif claim_level in (8,9) then
    if not (coalesce((user_profile.active_packages->>'pkg19')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg49')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg99')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg199')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg399')::boolean,false)) then has_pkgs := false; end if;
  elsif claim_level = 10 then
    if not (coalesce((user_profile.active_packages->>'pkg19')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg49')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg99')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg199')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg399')::boolean,false)
        and coalesce((user_profile.active_packages->>'pkg799')::boolean,false)) then has_pkgs := false; end if;
  end if;
  if not has_pkgs then return json_build_object('success', false, 'error', 'Teleb olunan paketler aktiv deyil'); end if;

  -- Part 13: xal ÇIXILMIR — yalnız kumulyativ hədd yoxlanılır
  update public.profiles
    set claimed_levels = coalesce(claimed_levels,'[]'::jsonb) || to_jsonb(claim_level),
        balance = balance + bonus_amt,
        current_level = greatest(coalesce(current_level,0), claim_level)
    where id = user_id and coalesce(total_points,0) >= req_points;
  get diagnostics rows_affected = row_count;
  if rows_affected = 0 then return json_build_object('success', false, 'error', 'Kifayet qeder xaliniz yoxdur'); end if;

  begin
    insert into public.level_claims (uid, login, level, bonus_amount, claim_type, status, approved_at)
    values (user_id, user_profile.user_code, claim_level, bonus_amt, 'balance', 'done', now());
  exception when unique_violation then
    update public.profiles
      set balance = balance - bonus_amt,
          claimed_levels = (
            select coalesce(jsonb_agg(x), '[]'::jsonb)
            from jsonb_array_elements(coalesce(claimed_levels, '[]'::jsonb)) x
            where x <> to_jsonb(claim_level)
          )
      where id = user_id;
    return json_build_object('success', false, 'error', 'Bu seviyye artiq istifade olunub');
  end;

  insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
  values ('level_bonus', null, 'System', user_id, user_profile.user_code, bonus_amt, 'completed');

  -- Part 14: yeni levelə keçəndə BÜTÜN hotbed paketləri sönür (pul geri qaytarılmır).
  -- Növbəti level üçün tələb olunan paketlər yenidən alınmalıdır. Level 1 tələbsizdir → sıfırlama yox.
  if claim_level > 1 then
    update public.profiles
      set active_packages = '{}'::jsonb,
          package_activated_at = '{}'::jsonb
      where id = user_id;
  end if;

  return json_build_object('success', true);
end;
$function$;

revoke all on function public.create_level_claim(integer) from public, anon;
grant execute on function public.create_level_claim(integer) to authenticated;

-- ----------------------------------------------------------------------------
-- 2) process_daily_earnings — paket-başına AYRI sətir + Bakı gün tarix-guard
--    (_3.sql-dəki tərifi əvəz edir)
-- ----------------------------------------------------------------------------
create or replace function public.process_daily_earnings()
returns json security definer set search_path = public as $$
declare
  cnt integer := 0; r record; daily numeric; rows_affected integer;
  baku_today date := (now() at time zone 'Asia/Baku')::date;
  has399 boolean; has799 boolean;
begin
  for r in
    select id, user_code, active_packages from public.profiles
    where not public.is_effectively_blocked(id)
      and coalesce(last_daily_earning_date, '1970-01-01') < baku_today
      and (coalesce(lower(active_packages->>'pkg399'),'false')='true'
        or coalesce(lower(active_packages->>'pkg799'),'false')='true')
  loop
    has399 := coalesce(lower(r.active_packages->>'pkg399'),'false')='true';
    has799 := coalesce(lower(r.active_packages->>'pkg799'),'false')='true';
    daily := 0;
    if has399 then daily := daily + 3.3; end if;
    if has799 then daily := daily + 6.5; end if;

    -- Atomik tarix guard (Bakı günü): eyni gün ikinci UPDATE 0 sətir təsir edir
    update public.profiles set balance = balance + daily, last_daily_earning_date = baku_today
      where id = r.id and coalesce(last_daily_earning_date, '1970-01-01') < baku_today;
    get diagnostics rows_affected = row_count;
    if rows_affected = 0 then continue; end if;

    -- Part 14: hər paket üçün AYRI history sətri (from_login = paket adı → UI etiketi)
    if has399 then
      insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
      values ('daily_earning', null, '#399', r.id, r.user_code, 3.3, 'completed');
    end if;
    if has799 then
      insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
      values ('daily_earning', null, '#799', r.id, r.user_code, 6.5, 'completed');
    end if;
    cnt := cnt + 1;
  end loop;
  return json_build_object('success', true, 'processed', cnt);
end;
$$ language plpgsql;

revoke all on function public.process_daily_earnings() from public, anon, authenticated;
grant execute on function public.process_daily_earnings() to service_role;

-- ----------------------------------------------------------------------------
-- 3) pg_cron: gündəlik baxımı Bakı gecəyarısına (20:00 UTC = Bakı 00:00) köçür
--    Eyni ad ilə cron.schedule mövcud job-u (jobid 1) yeniləyir.
--    (Azərbaycan UTC+4, yay saatı yoxdur → 20:00 UTC daim Bakı 00:00-dır.)
-- ----------------------------------------------------------------------------
select cron.schedule('daily-maintenance', '0 20 * * *', 'select public.run_daily_maintenance();');

-- Doğrulama:
--   select jobname, schedule from cron.job where jobname = 'daily-maintenance';  -- '0 20 * * *'
