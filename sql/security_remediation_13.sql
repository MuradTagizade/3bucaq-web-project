-- ============================================================================
-- SECURITY REMEDIATION — PART 13: Level claim xalları SIFIRLAMASIN (kumulyativ)
-- Tarix: 2026-07-05
-- Zəncir: ... → _11.sql → _12.sql → BU FAYL
--
-- İş qaydası dəyişikliyi (istifadəçi istəyi): səviyyə bonusu alınanda xallar
-- ÇIXILMIR. Hədlər onsuz da kumulyativdir (LVL1=30, LVL2=109, LVL3=268...),
-- yəni LVL1-dən sonra istifadəçi 30 xaldan davam edir və 109-a çatanda LVL2
-- açılır. Əvvəlki tərif `total_points - req_points` çıxırdı → istifadəçi
-- sıfırdan başlayırdı (LVL2 üçün faktiki 30+109=139 lazım olurdu).
--
-- 1) create_level_claim: xal çıxma + mənfi points_history sətri LƏĞV edildi.
-- 2) Birdəfəlik təmir: keçmiş claim-lərdə çıxılmış xallar geri qaytarılır
--    (mənfi 'level_%' points_history sətirləri silinir, məbləğ total_points-ə
--    geri əlavə olunur) — test hesablarına aiddir, onsuz da lansman sıfırlaması
--    planlaşdırılıb.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) create_level_claim — xal çıxılmır (yalnız hədd yoxlanılır)
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

  return json_build_object('success', true);
end;
$function$;

revoke all on function public.create_level_claim(integer) from public, anon;
grant execute on function public.create_level_claim(integer) to authenticated;

-- ----------------------------------------------------------------------------
-- 2) Birdəfəlik təmir: keçmiş claim-lərdə çıxılmış xalları geri qaytar
-- ----------------------------------------------------------------------------
with neg as (
  select uid, sum(-points) as give_back
  from public.points_history
  where package_id like 'level_%' and points < 0
  group by uid
)
update public.profiles p
   set total_points = p.total_points + neg.give_back
  from neg
 where p.id = neg.uid;

delete from public.points_history where package_id like 'level_%' and points < 0;

-- Doğrulama: select user_code, total_points from profiles where claimed_levels <> '[]';
