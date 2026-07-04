-- ====================================================================
-- 3bucaq / LEVEL UP — SECURITY REMEDIATION — PART 5
-- ====================================================================
-- Part 1, 2, 3, 4 calistirildiktan SONRA calistirin. Idempotent.
--
-- Kapsam:
--   1. EKSIK RLS POLICY'LERI (KRITIK): security_patch.sql production'a hic
--      uygulanmamisti; Part 1/3 onun policy'lerinin var oldugunu varsayarak
--      yalnizca eski/gevsek olanlari DROP etmisti. Sonuc: 7 tabloda RLS acik
--      ama policy YOK -> client hicbir sey okuyamiyor/yazamiyordu
--      (islem tarihcesi bos, depozit olusturulamiyor, admin paneli bos).
--      Bu bolum minimal-yetki policy'lerini olusturur (Part 3 tasarimi:
--      para tablolarinda admin'e bile client-side WRITE yok — her mutasyon
--      SECURITY DEFINER RPC uzerinden).
--   2. deactivate_package stub'i buraya tasindi (fix_referral_and_packages.sql
--      silindi — canli tanimin kaynagi artik bu dosya).
--   3. transfer_balance kolonu DROP (dual-balance tasarimi iptal edilmisti;
--      kod kullanmiyor, tum degerler 0 idi).
--
-- NOT: Eski dosyalar (security_patch.sql, dual_balance_migration.sql,
--      remove_transfer_balance.sql, fix_referral_and_packages.sql) silindi.
--      Aktif zincir: schema.sql (tablolar) -> security_remediation.sql
--      -> _2_rpcs.sql -> _3.sql -> _4.sql -> _5.sql
-- ====================================================================

begin;

-- --------------------------------------------------------------------
-- 1. EKSIK RLS POLICY'LERI
--    Kural: kullanici kendi satirlarini gorur; admin hepsini gorur.
--    Para tablolarina client-side INSERT/UPDATE/DELETE YOK (RPC'ler yazar) —
--    tek istisna: deposits INSERT (kendi, yalniz 'pending').
-- --------------------------------------------------------------------

-- transactions: SELECT (taraf oldugu islemler veya admin)
drop policy if exists "Users can view their own transactions" on public.transactions;
drop policy if exists "transactions_select_own_or_admin" on public.transactions;
create policy "transactions_select_own_or_admin"
  on public.transactions for select
  to authenticated
  using (auth.uid() = from_uid or auth.uid() = to_uid or public.is_admin());

-- points_history: SELECT (kendi veya admin)
drop policy if exists "Users can view their own points history" on public.points_history;
drop policy if exists "points_history_select_own_or_admin" on public.points_history;
create policy "points_history_select_own_or_admin"
  on public.points_history for select
  to authenticated
  using (auth.uid() = uid or public.is_admin());

-- level_claims: SELECT (kendi veya admin)
drop policy if exists "Users can view their own level claims" on public.level_claims;
drop policy if exists "level_claims_select_own_or_admin" on public.level_claims;
create policy "level_claims_select_own_or_admin"
  on public.level_claims for select
  to authenticated
  using (auth.uid() = uid or public.is_admin());

-- deposits: SELECT (kendi veya admin) + INSERT (kendi, yalniz pending)
drop policy if exists "Users can view their own deposits" on public.deposits;
drop policy if exists "deposits_select_own_or_admin" on public.deposits;
create policy "deposits_select_own_or_admin"
  on public.deposits for select
  to authenticated
  using (auth.uid() = uid or public.is_admin());

drop policy if exists "Users can create their own pending deposits" on public.deposits;
drop policy if exists "deposits_insert_own_pending" on public.deposits;
create policy "deposits_insert_own_pending"
  on public.deposits for insert
  to authenticated
  with check (auth.uid() = uid and status = 'pending');

-- withdrawals: SELECT (kendi veya admin) — INSERT yalniz create_withdrawal RPC
drop policy if exists "Users can view their own withdrawals" on public.withdrawals;
drop policy if exists "withdrawals_select_own_or_admin" on public.withdrawals;
create policy "withdrawals_select_own_or_admin"
  on public.withdrawals for select
  to authenticated
  using (auth.uid() = uid or public.is_admin());

-- system_settings: herkes okur (depozit karti vb. gerekli);
-- yazma yalniz 'finance' izinli admin (kart no degistirme = para yonlendirme riski)
drop policy if exists "Allow authenticated read to system settings" on public.system_settings;
drop policy if exists "system_settings_select_authenticated" on public.system_settings;
create policy "system_settings_select_authenticated"
  on public.system_settings for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage system settings" on public.system_settings;
drop policy if exists "system_settings_write_finance_admin" on public.system_settings;
create policy "system_settings_write_finance_admin"
  on public.system_settings for all
  to authenticated
  using (public.has_admin_perm('finance'))
  with check (public.has_admin_perm('finance'));

-- admin_logs: yalniz admin okur/yazar (actor'u tr_set_admin_log_actor zorlar)
drop policy if exists "Only admins can view admin logs" on public.admin_logs;
drop policy if exists "admin_logs_select_admin" on public.admin_logs;
create policy "admin_logs_select_admin"
  on public.admin_logs for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Only admins can insert admin logs" on public.admin_logs;
drop policy if exists "admin_logs_insert_admin" on public.admin_logs;
create policy "admin_logs_insert_admin"
  on public.admin_logs for insert
  to authenticated
  with check (public.is_admin());

-- --------------------------------------------------------------------
-- 2. deactivate_package — bilerek devre disi (is kurali: paketler manuel
--    deaktive edilemez). Client hala cagirdigi icin stub korunuyor.
-- --------------------------------------------------------------------
create or replace function public.deactivate_package(pkg_id text)
returns json security definer set search_path = public as $$
begin
  return json_build_object('success', false, 'error', 'Paketləri əl ilə deaktiv etmək mümkün deyil.');
end;
$$ language plpgsql;

-- --------------------------------------------------------------------
-- 3. transfer_balance kolonu KALDIR (dual-balance iptal; kod kullanmiyor,
--    tum degerler 0 dogrulandi). Bagli CHECK kisiti kolonla birlikte duser.
--    check_profile_updates trigger'i kolonu kosullu kontrol ettigi icin
--    (to_jsonb(NEW) ? 'transfer_balance') drop sonrasi da sorunsuz calisir.
-- --------------------------------------------------------------------
alter table public.profiles drop column if exists transfer_balance;

commit;
