-- ====================================================================
-- LEVEL UP — security_remediation_19.sql
-- LEVEL-UP QİSMƏN RESET: yalnız o level-in tələb etdiyi paketlər sönür
-- --------------------------------------------------------------------
-- İstifadəçi istəyi (2026-07-08): yeni levelə keçəndə ARTIQ bütün hotbed
-- paketləri sönmür — YALNIZ o level üçün tələb olunan paketlər deaktiv olur.
-- Digər aktiv paketlər (məs. #399, #799) qalır və yalnız ÖZLƏRİNİ tələb edən
-- levelə çatanda sönür (#399 → L8; #799 → L10). Pul geri qaytarılmır (re-invest).
--
-- Bu fayl _14-dəki create_level_claim tanımını ƏVƏZ EDİR. Fərq yalnız 2 yerdə:
--   1) tələb olunan paketlər tək `req_pkgs text[]` massivinə çıxarıldı (həm
--      validasiya, həm reset üçün — mapping bir dəfə yazılır);
--   2) reset `active_packages='{}'` əvəzinə `active_packages - req_pkgs`
--      (yalnız bu level-in paketləri; qalanların timestamp-ı da toxunulmur).
-- Qalan hər şey (kumulyativ xal, xal çıxılmır, balans+bonus, claimed_levels,
-- current_level, level_claims + unique_violation rollback, level_bonus tx,
-- whitelist grant) bayt-bayt eynidir. Part 6 whitelist grant qorunur.
-- ====================================================================

begin;

create or replace function public.create_level_claim(claim_level integer)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  user_id uuid; user_profile record; req_points numeric; bonus_amt numeric;
  req_pkgs text[]; pk text; rows_affected integer;
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

  -- Tələb olunan paketlər (constants.js LEVELS.requiredPkgs güzgüsü).
  -- Bu massiv HƏM validasiya, HƏM level-up reseti üçün istifadə olunur.
  req_pkgs := case claim_level
    when 2 then array['pkg19','pkg49']
    when 3 then array['pkg19','pkg49']
    when 4 then array['pkg19','pkg49']
    when 5 then array['pkg19','pkg49','pkg99']
    when 6 then array['pkg19','pkg49','pkg99']
    when 7 then array['pkg19','pkg49','pkg99','pkg199']
    when 8 then array['pkg19','pkg49','pkg99','pkg199','pkg399']
    when 9 then array['pkg19','pkg49','pkg99','pkg199','pkg399']
    when 10 then array['pkg19','pkg49','pkg99','pkg199','pkg399','pkg799']
    else array[]::text[]   -- level 1: paket tələb olunmur
  end;

  select * into user_profile from public.profiles where id = user_id;
  if not found then return json_build_object('success', false, 'error', 'Istifadeci tapilmadi'); end if;
  if public.is_effectively_blocked(user_id) then return json_build_object('success', false, 'error', 'Hesabiniz bloklanib.'); end if;

  if exists (select 1 from public.level_claims where uid = user_id and level = claim_level and status in ('pending','done')) then
    return json_build_object('success', false, 'error', 'Bu seviyye artiq istifade olunub');
  end if;

  -- Tələb olunan paketlərin hamısı aktiv olmalıdır (level-up-da sönür → yenidən alınmalıdır)
  foreach pk in array req_pkgs loop
    if not coalesce((user_profile.active_packages->>pk)::boolean, false) then
      return json_build_object('success', false, 'error', 'Teleb olunan paketler aktiv deyil');
    end if;
  end loop;

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

  -- Part 19: level-up-da YALNIZ bu level-in tələb etdiyi paketlər sönür (pul geri qaytarılmır).
  -- Digər aktiv paketlər (#399/#799 və s.) qalır — onlar yalnız özlərini tələb edən
  -- levelə çatanda bu blokla sönür. Qalan paketlərin package_activated_at-ı toxunulmur
  -- (hotbed 120-günlük geri sayımı düzgün davam etsin).
  if array_length(req_pkgs, 1) is not null then
    update public.profiles
      set active_packages     = coalesce(active_packages,'{}'::jsonb)     - req_pkgs,
          package_activated_at = coalesce(package_activated_at,'{}'::jsonb) - req_pkgs
      where id = user_id;
  end if;

  return json_build_object('success', true);
end;
$function$;

revoke all on function public.create_level_claim(integer) from public, anon;
grant execute on function public.create_level_claim(integer) to authenticated;

commit;
