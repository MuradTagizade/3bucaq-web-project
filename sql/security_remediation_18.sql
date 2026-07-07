-- ====================================================================
-- LEVEL UP — security_remediation_18.sql
-- TARİXÇƏDƏ QARŞI TƏRƏF: user_code + username
-- --------------------------------------------------------------------
-- İstifadəçi istəyi (2026-07-07): transfer/referal tarixçəsində qarşı tərəf
-- yalnız ID (user_code) ilə görünür — ID İLƏ BİRLİKDƏ username də görünsün.
-- Tranzaksiya sətirləri from_login/to_login-də user_code saxlayır; username
-- ayrıca sütun deyil. RLS profiles-də cross-user oxumanı bağladığı üçün
-- client birbaşa join edə bilmir → toplu (batch) definer RPC lazımdır.
--
-- `usernames_for_codes(text[])`: verilən user_code massivinə görə
--   {user_code: username} JSON xəritəsi qaytarır (yalnız username-i olanlar).
-- Enumerasyon riski lookup_user_code/check_username_available ilə eynidir
-- (username onsuz da transfer üçün yarı-publikdir) — qəbul edilir.
-- Part 6 whitelist grant modeli.
-- ====================================================================

begin;

create or replace function public.usernames_for_codes(p_codes text[])
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(json_object_agg(user_code, username), '{}'::json)
  from public.profiles
  where auth.uid() is not null
    and user_code = any(p_codes)
    and username is not null;
$$;

revoke all on function public.usernames_for_codes(text[]) from public, anon;
grant execute on function public.usernames_for_codes(text[]) to authenticated;

commit;
