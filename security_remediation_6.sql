-- ====================================================================
-- 3bucaq / LEVEL UP — SECURITY REMEDIATION — PART 6 (LANSMAN SERTLESTIRME)
-- ====================================================================
-- Part 1-5'ten SONRA calistirin. Idempotent.
--
-- Kaynak: Supabase advisor taramasi (2026-07-03) + lansman denetimi.
-- Kapsam:
--   1. [GUVENLIK] RPC EXECUTE kilidi: TUM public fonksiyonlar anon dahil
--      herkes tarafindan cagrilabiliyordu (Part 2'deki revoke sonraki
--      CREATE OR REPLACE'lerde etkisiz kalmisti). Artik: whitelist grant.
--   2. [PERFORMANS] RLS initplan: politikalardaki auth.uid()/is_admin()
--      cagrilari SATIR BASINA calisiyordu -> (select ...) sarmalamasiyla
--      sorgu basina 1 kez. Buyuk tablolarda 10-100x fark.
--   3. [PERFORMANS] 9 indexsiz FK + sik sorgulanan kolonlara index.
--   4. [PERFORMANS] system_settings cift-permissive SELECT politikasi
--      duzeltildi (ALL -> insert/update/delete ayrildi).
--   5. Yardimci fonksiyonlar STABLE isaretlendi (planner onbellegi).
--
-- NOT: Bundan sonra yeni fonksiyon eklerken EXECUTE grant'ini ACIKCA verin
--      (default privilege'lardan PUBLIC execute kaldirildi).
-- ====================================================================

begin;

-- --------------------------------------------------------------------
-- 1. FONKSIYON EXECUTE KILIDI (whitelist modeli)
-- --------------------------------------------------------------------
revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;
revoke execute on all functions in schema public from authenticated;

-- Gelecekte olusturulacak fonksiyonlar da PUBLIC execute ALMASIN
alter default privileges in schema public revoke execute on functions from public;

-- Kullanici RPC'leri (giris yapmis)
grant execute on function public.transfer_funds(text, numeric) to authenticated;
grant execute on function public.buy_package(text) to authenticated;
grant execute on function public.deactivate_package(text) to authenticated;
grant execute on function public.create_withdrawal(numeric, text, text, text, text) to authenticated;
grant execute on function public.create_level_claim(integer) to authenticated;
grant execute on function public.create_profile_if_missing() to authenticated;
grant execute on function public.sync_my_email() to authenticated;
grant execute on function public.get_my_referral_tree(integer) to authenticated;
grant execute on function public.lookup_user_code(text) to authenticated;
grant execute on function public.check_identity_exists(text) to authenticated;

-- Kayit sayfasi (anon) referal kodu dogrular
grant execute on function public.check_referral_code(text) to anon, authenticated;

-- Admin RPC'leri (fonksiyon icinde has_admin_perm ile ayrica korunur)
grant execute on function public.admin_approve_deposit(uuid) to authenticated;
grant execute on function public.admin_reject_deposit(uuid) to authenticated;
grant execute on function public.admin_approve_withdrawal(uuid, text, text) to authenticated;
grant execute on function public.admin_reject_withdrawal(uuid) to authenticated;
grant execute on function public.admin_approve_claim(uuid, text) to authenticated;
grant execute on function public.admin_reject_claim(uuid) to authenticated;
grant execute on function public.admin_adjust_balance(uuid, numeric, text) to authenticated;
grant execute on function public.admin_adjust_points(uuid, numeric) to authenticated;

-- RLS politikalari + INVOKER trigger bu ucunu CAGIRAN ROL olarak calistirir
-- (kaldirilirsa profiles select/update dahil her sey kirilir!)
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_admin_perm(text) to authenticated;
grant execute on function public.is_superadmin() to authenticated;

-- Cron/bakim: yalniz service_role (pg_cron job'u owner=postgres oldugu icin etkilenmez)
grant execute on function public.process_daily_earnings() to service_role;
grant execute on function public.process_package_expiry() to service_role;
grant execute on function public.run_daily_maintenance() to service_role;

-- Bilerek grant VERILMEYENLER (yalniz definer/owner baglaminda cagrilir):
--   generate_user_code, is_effectively_blocked, handle_new_user,
--   set_admin_log_actor, check_profile_updates (trigger'lar EXECUTE kontrolune tabi degil)

-- --------------------------------------------------------------------
-- 2. RLS INITPLAN OPTIMIZASYONU — auth.uid()/is_admin() sorgu basina 1 kez
-- --------------------------------------------------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()));

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id or (select public.is_admin()))
  with check ((select auth.uid()) = id or (select public.is_admin()));

drop policy if exists "transactions_select_own_or_admin" on public.transactions;
create policy "transactions_select_own_or_admin"
  on public.transactions for select to authenticated
  using ((select auth.uid()) = from_uid or (select auth.uid()) = to_uid or (select public.is_admin()));

drop policy if exists "points_history_select_own_or_admin" on public.points_history;
create policy "points_history_select_own_or_admin"
  on public.points_history for select to authenticated
  using ((select auth.uid()) = uid or (select public.is_admin()));

drop policy if exists "level_claims_select_own_or_admin" on public.level_claims;
create policy "level_claims_select_own_or_admin"
  on public.level_claims for select to authenticated
  using ((select auth.uid()) = uid or (select public.is_admin()));

drop policy if exists "deposits_select_own_or_admin" on public.deposits;
create policy "deposits_select_own_or_admin"
  on public.deposits for select to authenticated
  using ((select auth.uid()) = uid or (select public.is_admin()));

drop policy if exists "deposits_insert_own_pending" on public.deposits;
create policy "deposits_insert_own_pending"
  on public.deposits for insert to authenticated
  with check ((select auth.uid()) = uid and status = 'pending');

drop policy if exists "withdrawals_select_own_or_admin" on public.withdrawals;
create policy "withdrawals_select_own_or_admin"
  on public.withdrawals for select to authenticated
  using ((select auth.uid()) = uid or (select public.is_admin()));

drop policy if exists "admin_logs_select_admin" on public.admin_logs;
create policy "admin_logs_select_admin"
  on public.admin_logs for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "admin_logs_insert_admin" on public.admin_logs;
create policy "admin_logs_insert_admin"
  on public.admin_logs for insert to authenticated
  with check ((select public.is_admin()));

-- system_settings: ALL politikasi SELECT'i de kapsayip cift-permissive
-- uyarisi uretiyordu -> yazma eylemleri ayri politikalara bolundu.
drop policy if exists "system_settings_write_finance_admin" on public.system_settings;
drop policy if exists "system_settings_insert_finance_admin" on public.system_settings;
create policy "system_settings_insert_finance_admin"
  on public.system_settings for insert to authenticated
  with check ((select public.has_admin_perm('finance')));
drop policy if exists "system_settings_update_finance_admin" on public.system_settings;
create policy "system_settings_update_finance_admin"
  on public.system_settings for update to authenticated
  using ((select public.has_admin_perm('finance')))
  with check ((select public.has_admin_perm('finance')));
drop policy if exists "system_settings_delete_finance_admin" on public.system_settings;
create policy "system_settings_delete_finance_admin"
  on public.system_settings for delete to authenticated
  using ((select public.has_admin_perm('finance')));

-- Storage (kyc-documents) politikalari — ayni initplan optimizasyonu
drop policy if exists "kyc_select_own_or_admin" on storage.objects;
create policy "kyc_select_own_or_admin" on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents' and (owner = (select auth.uid()) or (select public.is_admin())));
drop policy if exists "kyc_insert_own" on storage.objects;
create policy "kyc_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and owner = (select auth.uid()));
drop policy if exists "kyc_update_own_or_admin" on storage.objects;
create policy "kyc_update_own_or_admin" on storage.objects for update to authenticated
  using (bucket_id = 'kyc-documents' and (owner = (select auth.uid()) or (select public.is_admin())));
drop policy if exists "kyc_delete_own_or_admin" on storage.objects;
create policy "kyc_delete_own_or_admin" on storage.objects for delete to authenticated
  using (bucket_id = 'kyc-documents' and (owner = (select auth.uid()) or (select public.is_admin())));

-- --------------------------------------------------------------------
-- 3. YARDIMCI FONKSIYONLAR STABLE (salt-okur; planner tek sorguda onbellekler)
-- --------------------------------------------------------------------
alter function public.is_admin() stable;
alter function public.has_admin_perm(text) stable;
alter function public.is_superadmin() stable;
alter function public.is_effectively_blocked(uuid) stable;
alter function public.lookup_user_code(text) stable;
alter function public.check_referral_code(text) stable;
alter function public.check_identity_exists(text) stable;

-- --------------------------------------------------------------------
-- 4. INDEX'LER (FK'ler + sik sorgulanan kolonlar; kucuk tablolarda aninda)
-- --------------------------------------------------------------------
-- Islem tarihcesi (or=from_uid,to_uid sorgusu -> BitmapOr iki index kullanir)
create index if not exists idx_transactions_from_uid on public.transactions(from_uid);
create index if not exists idx_transactions_to_uid on public.transactions(to_uid);
-- Puan tarihcesi
create index if not exists idx_points_history_uid on public.points_history(uid);
create index if not exists idx_points_history_from_uid on public.points_history(from_uid);
-- Depozit / cixaris / level claim (kullanici listeleri)
create index if not exists idx_deposits_uid on public.deposits(uid);
create index if not exists idx_withdrawals_uid on public.withdrawals(uid);
create index if not exists idx_level_claims_uid on public.level_claims(uid);
-- Referal agaci (get_my_referral_tree recursive CTE bu kolonla iner)
create index if not exists idx_profiles_referred_by on public.profiles(referred_by);
-- Kayit sirasinda referal kodu lookup'i
create index if not exists idx_profiles_referral_code on public.profiles(referral_code);
-- Admin log FK'leri
create index if not exists idx_admin_logs_admin_uid on public.admin_logs(admin_uid);
create index if not exists idx_admin_logs_target_uid on public.admin_logs(target_uid);
-- Admin paneli bekleyen-is sayaclari (loglarda surekli polleniyor)
create index if not exists idx_deposits_pending on public.deposits(status) where status = 'pending';
create index if not exists idx_withdrawals_pending on public.withdrawals(status) where status = 'pending';
create index if not exists idx_level_claims_pending on public.level_claims(status) where status = 'pending';
create index if not exists idx_profiles_kyc_pending on public.profiles(kyc_status) where kyc_status = 'pending';
-- Admin dashboard "son kayitlar" (order by created_at desc + gte filtreleri)
create index if not exists idx_profiles_created_at on public.profiles(created_at desc);

commit;
