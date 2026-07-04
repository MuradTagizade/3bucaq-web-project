-- ============================================================================
-- SECURITY REMEDIATION — PART 12: get_my_finance_stats (dəqiq istifadəçi maliyyə statistikası)
-- Tarix: 2026-07-05
-- Zəncir: ... → _10.sql → _11.sql → BU FAYL
--
-- Problem: /dashboard/history səhifəsi Ümumi Mədaxil/Məxaric/Gözləmədə/Net
-- Balansı client-də, LİMİTLİ (200 sətir) pəncərədən hesablayırdı və
-- referral/depth bonus sətirlərində alıcı olmayan tərəfi (paketi alan) səhvən
-- məxaricə yazırdı. Bu RPC bütün tarixi DB-də düzgün cəmləyir:
--   * net       = profiles.balance (mənbə həqiqəti)
--   * incoming  = təsdiqli depozitlər + alınan köçürmələr + istifadəçiyə ödənən
--                 bonuslar (referral/depth/level/daily) + müsbət admin düzəlişi
--   * outgoing  = icra edilmiş çıxarışlar + göndərilən köçürmələr + paket
--                 alışları + mənfi admin düzəlişi (mütləq dəyər)
--   * pending   = gözləyən depozitlər + gözləyən çıxarışlar
-- Yalnız öz statistikası (auth.uid()); Part 6 whitelist grant modeli.
-- ============================================================================

create or replace function public.get_my_finance_stats()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('error', 'Sessiya tapilmadi');
  end if;

  return jsonb_build_object(
    'net', (select coalesce(balance, 0) from public.profiles where id = v_uid),
    'incoming', (
      coalesce((select sum(amount) from public.deposits where uid = v_uid and status = 'approved'), 0)
      + coalesce((select sum(amount) from public.transactions where type = 'transfer' and to_uid = v_uid), 0)
      + coalesce((select sum(amount) from public.transactions
                   where type in ('referral_bonus','depth_bonus','level_bonus','daily_earning') and to_uid = v_uid), 0)
      + coalesce((select sum(amount) from public.transactions
                   where type = 'admin_adjust' and to_uid = v_uid and amount > 0), 0)
    ),
    'outgoing', (
      coalesce((select sum(amount) from public.withdrawals where uid = v_uid and status in ('approved','done')), 0)
      + coalesce((select sum(amount) from public.transactions where type = 'transfer' and from_uid = v_uid), 0)
      + coalesce((select sum(amount) from public.transactions where type = 'package_purchase' and from_uid = v_uid), 0)
      + coalesce((select sum(abs(amount)) from public.transactions
                   where type = 'admin_adjust' and to_uid = v_uid and amount < 0), 0)
    ),
    'pending', (
      coalesce((select sum(amount) from public.deposits where uid = v_uid and status = 'pending'), 0)
      + coalesce((select sum(amount) from public.withdrawals where uid = v_uid and status = 'pending'), 0)
    )
  );
end;
$$;

revoke all on function public.get_my_finance_stats() from public, anon;
grant execute on function public.get_my_finance_stats() to authenticated;

-- Doğrulama: istifadəçi JWT ilə select public.get_my_finance_stats();
-- net = profiles.balance ilə üst-üstə düşməlidir.
