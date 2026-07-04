-- ====================================================================
-- 3bucaq / LEVEL UP — SECURITY REMEDIATION — PART 7
-- ====================================================================
-- Part 1-6'dan SONRA calistirin. Idempotent.
--
-- Kaynak: lansman denetimi (frontend + data-layer ajanlari), 2026-07-03.
-- Kapsam:
--   1. get_admin_stats() RPC — admin dashboard istatistikleri tek sorguda
--      (eskiden client TUM profiles tablosunu indirip JS'te topluyordu).
--   2. Storage: cixaris dekontlari 'receipts/<uid>/...' yolundan kullanicinin
--      kendisi tarafindan okunabilir (eskiden owner=admin oldugu icin
--      kullanici kendi dekontunu ACAMIYORDU).
--   3. Storage bucket limiti: kyc-documents 5MB + yalniz resim MIME'lari
--      (client-side dogrulama atlatilabilir; asil kilit burasi).
--   4. Veri duzeltme: user_code oncesi transactions/points_history/
--      deposits/withdrawals/level_claims login snapshot'lari user_code'a
--      backfill (tarihcede eski display_login gorunmesin).
-- ====================================================================

begin;

-- --------------------------------------------------------------------
-- 1. get_admin_stats() — tek sorguluk admin istatistikleri
-- --------------------------------------------------------------------
create or replace function public.get_admin_stats()
returns json security definer set search_path = public as $$
declare result json;
begin
  if not public.is_admin() then
    return json_build_object('success', false, 'error', 'Icaze yoxdur');
  end if;
  select json_build_object(
    'success', true,
    'totalUsers',         (select count(*) from public.profiles),
    'totalBalance',       (select coalesce(sum(balance), 0) from public.profiles),
    'dailyGrowth',        (select count(*) from public.profiles where created_at >= now() - interval '24 hours'),
    'pendingClaims',      (select count(*) from public.level_claims where status = 'pending'),
    'pendingDeposits',    (select count(*) from public.deposits where status = 'pending'),
    'pendingWithdrawals', (select count(*) from public.withdrawals where status = 'pending'),
    'pendingKYC',         (select count(*) from public.profiles where kyc_status = 'pending'),
    'recentUsers',        (select coalesce(json_agg(r), '[]'::json) from (
                             select id, user_code, display_login, full_name, email, country,
                                    kyc_status, created_at, current_level, total_points, active_packages
                             from public.profiles order by created_at desc limit 5
                           ) r)
  ) into result;
  return result;
end;
$$ language plpgsql stable;
revoke execute on function public.get_admin_stats() from public, anon;
grant execute on function public.get_admin_stats() to authenticated;

-- --------------------------------------------------------------------
-- 2. Cixaris dekontu: kullanici 'receipts/<kendi-uid>/...' dosyalarini okuyabilir
--    (admin upload yolu frontend'de receipts/<uid>/... olarak degistirildi)
-- --------------------------------------------------------------------
drop policy if exists "receipts_select_own" on storage.objects;
create policy "receipts_select_own" on storage.objects for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = 'receipts'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- --------------------------------------------------------------------
-- 3. Bucket sertlestirme: 5MB + yalniz resim (server-side asil kilit)
-- --------------------------------------------------------------------
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif']
where id = 'kyc-documents';

-- --------------------------------------------------------------------
-- 4. Legacy login -> user_code backfill (tek seferlik veri duzeltmesi)
-- --------------------------------------------------------------------
update public.transactions t set from_login = p.user_code
  from public.profiles p
  where t.from_uid = p.id and t.from_login is distinct from p.user_code;
update public.transactions t set to_login = p.user_code
  from public.profiles p
  where t.to_uid = p.id and t.to_login is distinct from p.user_code;
update public.points_history h set from_login = p.user_code
  from public.profiles p
  where h.from_uid = p.id and h.from_login is distinct from p.user_code;
update public.deposits d set login = p.user_code
  from public.profiles p
  where d.uid = p.id and d.login is distinct from p.user_code;
update public.withdrawals w set login = p.user_code
  from public.profiles p
  where w.uid = p.id and w.login is distinct from p.user_code;
update public.level_claims c set login = p.user_code
  from public.profiles p
  where c.uid = p.id and c.login is distinct from p.user_code;

commit;
