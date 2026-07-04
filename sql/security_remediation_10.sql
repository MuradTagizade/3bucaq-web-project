-- ============================================================================
-- SECURITY REMEDIATION — PART 10: check_profile_updates HOTFIX + Chart RPC dövr parametri
-- Tarix: 2026-07-04
-- Zəncir: ... → _8.sql → _9.sql → BU FAYL
--
-- 1) [KRİTİK BUG] `check_profile_updates` hələ də Part 5-də DROP edilmiş
--    `transfer_balance` sütununa istinad edirdi. PL/pgSQL ifadəsində
--    `to_jsonb(NEW) ? 'transfer_balance'` qoruyucusu işləmir (SQL ifadələrində
--    qısa-dövrə zəmanəti yoxdur; NEW.transfer_balance sahə müraciəti 42703 atır).
--    Nəticə: BÜTÜN birbaşa client profil UPDATE-ləri (KYC göndərmə, telefon/ad
--    saxlama) "record new has no field transfer_balance" xətası ilə uğursuz
--    olurdu. Definer RPC-lər postgres bypass-ından keçdiyi üçün təsirlənmirdi.
--    DÜZƏLİŞ: ölü blok silindi; funksiyanın qalanı BAYT-BAYT eynidir (INVOKER!).
--
-- 2) get_admin_chart_data() → get_admin_chart_data(p_range text) — dövr seçimi:
--    '7d' (günlük), '30d' (günlük, default), '90d' (həftəlik), '180d' (həftəlik),
--    'all' (aylıq, ilk qeydiyyatdan). Sıfır-dolgulu bucket-lər.
--    Köhnə 0-arqumentli imza DROP edilir (overload qarışıqlığı olmasın).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) check_profile_updates — transfer_balance qalığı silindi (INVOKER qalır!)
-- ----------------------------------------------------------------------------
create or replace function public.check_profile_updates()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare is_admin_user boolean;
begin
  -- KYC onayinda identity_number otomatik set (admin yolu)
  if NEW.kyc_status = 'approved' and OLD.kyc_status is distinct from 'approved' then
    NEW.identity_number := coalesce(NEW.kyc_document_number, OLD.kyc_document_number);
  end if;

  -- SECURITY DEFINER RPC'ler (postgres/service_role) — tam bypass
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return NEW;
  end if;

  -- (A) Sistem/finans sutunlari: HICBIR dogrudan client yazamaz (admin dahil).
  if NEW.balance is distinct from OLD.balance
     or NEW.total_points is distinct from OLD.total_points
     or NEW.active_packages is distinct from OLD.active_packages
     or NEW.package_activated_at is distinct from OLD.package_activated_at
     or NEW.current_level is distinct from OLD.current_level
     or NEW.claimed_levels is distinct from OLD.claimed_levels
     or NEW.user_code is distinct from OLD.user_code
     or NEW.referred_by is distinct from OLD.referred_by
     or NEW.referral_code is distinct from OLD.referral_code
     or NEW.last_daily_earning_date is distinct from OLD.last_daily_earning_date then
    raise exception 'Icaze yoxdur: Bu sahe yalniz sistem emeliyyatlari ile deyise biler';
  end if;

  -- (B) role + admin_permissions: yalniz superadmin
  if NEW.role is distinct from OLD.role or NEW.admin_permissions is distinct from OLD.admin_permissions then
    if not public.is_superadmin() then
      raise exception 'Icaze yoxdur: Rol/icazeler yalniz superadmin terefinden deyise biler';
    end if;
  end if;

  is_admin_user := public.is_admin();

  if is_admin_user then
    -- (C) Admin dogrudan duzenlemeleri — granuler icaze (K5)
    if (NEW.is_blocked is distinct from OLD.is_blocked
        or NEW.blocked_until is distinct from OLD.blocked_until
        or NEW.block_reason is distinct from OLD.block_reason)
       and not public.has_admin_perm('users') then
      raise exception 'Icaze yoxdur: Blok emeliyyati ucun users icazesi lazimdir';
    end if;
    if NEW.display_login is distinct from OLD.display_login and not public.has_admin_perm('users') then
      raise exception 'Icaze yoxdur: Login deyisikliyi ucun users icazesi lazimdir';
    end if;
    if (NEW.kyc_status is distinct from OLD.kyc_status
        or NEW.identity_number is distinct from OLD.identity_number
        or NEW.kyc_document_number is distinct from OLD.kyc_document_number
        or NEW.kyc_document_type is distinct from OLD.kyc_document_type
        or NEW.kyc_document_url is distinct from OLD.kyc_document_url
        or NEW.kyc_document_back_url is distinct from OLD.kyc_document_back_url
        or NEW.kyc_selfie_url is distinct from OLD.kyc_selfie_url)
       and not public.has_admin_perm('kyc') then
      raise exception 'Icaze yoxdur: KYC emeliyyati ucun kyc icazesi lazimdir';
    end if;
  else
    -- (D) Normal kullanici — yalniz izinli sahalar
    if NEW.email is distinct from OLD.email then
      raise exception 'Icaze yoxdur: Emaili deyise bilmezsiniz';
    end if;
    if NEW.display_login is distinct from OLD.display_login then
      raise exception 'Icaze yoxdur: Login deyise bilmezsiniz';
    end if;
    if NEW.is_blocked is distinct from OLD.is_blocked
       or NEW.blocked_until is distinct from OLD.blocked_until
       or NEW.block_reason is distinct from OLD.block_reason then
      raise exception 'Icaze yoxdur: Blok statusunu deyise bilmezsiniz';
    end if;
    if NEW.identity_number is distinct from OLD.identity_number then
      raise exception 'Icaze yoxdur: Kimlik nomresini deyise bilmezsiniz';
    end if;
    -- KYC: yalniz none/pending gonderebilir (onay/red YOX)
    if NEW.kyc_status is distinct from OLD.kyc_status and NEW.kyc_status not in ('none', 'pending') then
      raise exception 'Icaze yoxdur: KYC statusunu tesdiqleye/redd ede bilmezsiniz';
    end if;
    -- Tesdiqlenmis KYC sonrasi sened/selfie degisdirmek YOX (finding #8)
    if OLD.kyc_status = 'approved' and (
         NEW.kyc_document_number is distinct from OLD.kyc_document_number
      or NEW.kyc_document_type is distinct from OLD.kyc_document_type
      or NEW.kyc_document_url is distinct from OLD.kyc_document_url
      or NEW.kyc_document_back_url is distinct from OLD.kyc_document_back_url
      or NEW.kyc_selfie_url is distinct from OLD.kyc_selfie_url) then
      raise exception 'Icaze yoxdur: Tesdiqlenmis KYC senedlerini deyise bilmezsiniz';
    end if;
  end if;

  return NEW;
end;
$function$;

revoke all on function public.check_profile_updates() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2) get_admin_chart_data(p_range) — dövr parametri ilə (köhnə imza silinir)
-- ----------------------------------------------------------------------------
drop function if exists public.get_admin_chart_data();

create or replace function public.get_admin_chart_data(p_range text default '30d')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_start date;
  v_step  interval;
  v_fmt   text;
  v_trunc text;
  result  jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'İcazə yoxdur');
  end if;

  if p_range = '7d' then
    v_start := current_date - 6;  v_step := interval '1 day';   v_fmt := 'MM-DD';   v_trunc := 'day';
  elsif p_range = '90d' then
    v_start := date_trunc('week', (current_date - 89)::timestamp)::date;  v_step := interval '7 days'; v_fmt := 'MM-DD'; v_trunc := 'week';
  elsif p_range = '180d' then
    v_start := date_trunc('week', (current_date - 179)::timestamp)::date; v_step := interval '7 days'; v_fmt := 'MM-DD'; v_trunc := 'week';
  elsif p_range = 'all' then
    select coalesce(date_trunc('month', min(created_at))::date, date_trunc('month', now())::date)
      into v_start from public.profiles;
    v_step := interval '1 month'; v_fmt := 'YYYY-MM'; v_trunc := 'month';
  else -- '30d' (default)
    v_start := current_date - 29; v_step := interval '1 day';   v_fmt := 'MM-DD';   v_trunc := 'day';
  end if;

  with days as (
    select generate_series(v_start, current_date, v_step)::date as d
  ),
  regs as (
    select date_trunc(v_trunc, created_at)::date as d, count(*) as c
    from public.profiles where created_at >= v_start group by 1
  ),
  deps as (
    select date_trunc(v_trunc, created_at)::date as d, count(*) as c, coalesce(sum(amount), 0) as s
    from public.deposits where status = 'approved' and created_at >= v_start group by 1
  ),
  wds as (
    select date_trunc(v_trunc, created_at)::date as d, count(*) as c, coalesce(sum(amount), 0) as s
    from public.withdrawals where status = 'approved' and created_at >= v_start group by 1
  ),
  acts as (
    select date_trunc(v_trunc, created_at)::date as d, count(*) as c
    from public.transactions where created_at >= v_start group by 1
  )
  select jsonb_build_object(
    'range', case when p_range in ('7d','30d','90d','180d','all') then p_range else '30d' end,
    'regs_daily', (
      select jsonb_agg(jsonb_build_object('d', to_char(days.d, v_fmt), 'c', coalesce(regs.c, 0)) order by days.d)
      from days left join regs on regs.d = days.d
    ),
    'deposits_daily', (
      select jsonb_agg(jsonb_build_object('d', to_char(days.d, v_fmt), 'c', coalesce(deps.c, 0), 'a', coalesce(deps.s, 0)) order by days.d)
      from days left join deps on deps.d = days.d
    ),
    'withdrawals_daily', (
      select jsonb_agg(jsonb_build_object('d', to_char(days.d, v_fmt), 'c', coalesce(wds.c, 0), 'a', coalesce(wds.s, 0)) order by days.d)
      from days left join wds on wds.d = days.d
    ),
    'activity_daily', (
      select jsonb_agg(jsonb_build_object('d', to_char(days.d, v_fmt), 'c', coalesce(acts.c, 0)) order by days.d)
      from days left join acts on acts.d = days.d
    ),
    'kyc_dist', (
      select jsonb_build_object(
        'approved', count(*) filter (where kyc_status = 'approved'),
        'pending',  count(*) filter (where kyc_status = 'pending'),
        'rejected', count(*) filter (where kyc_status = 'rejected'),
        'none',     count(*) filter (where kyc_status is null or kyc_status = 'none')
      ) from public.profiles
    ),
    'pkg_dist', (
      select jsonb_agg(jsonb_build_object('pkg', v.k, 'c',
        (select count(*) from public.profiles pr
          where lower(coalesce(pr.active_packages ->> v.k, 'false')) = 'true')) order by v.i)
      from (values ('pkg19',1),('pkg49',2),('pkg99',3),('pkg199',4),('pkg399',5),('pkg799',6)) v(k, i)
    ),
    'tx_types', (
      select coalesce(jsonb_agg(jsonb_build_object('type', t.type, 'c', t.c, 'a', t.s) order by t.s desc), '[]'::jsonb)
      from (
        select type, count(*) as c, coalesce(sum(amount), 0) as s
        from public.transactions where created_at >= v_start group by type
      ) t
    ),
    'totals', jsonb_build_object(
      'deposits_sum',    (select coalesce(sum(amount), 0) from public.deposits where status = 'approved'),
      'withdrawals_sum', (select coalesce(sum(amount), 0) from public.withdrawals where status = 'approved'),
      'balance_sum',     (select coalesce(sum(balance), 0) from public.profiles),
      'points_sum',      (select coalesce(sum(total_points), 0) from public.profiles),
      'users',           (select count(*) from public.profiles),
      'active_pkg_users', (
        select count(*) from public.profiles pr
        where exists (
          select 1 from jsonb_each_text(coalesce(pr.active_packages, '{}'::jsonb)) je
          where lower(je.value) = 'true'
        )
      )
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_admin_chart_data(text) from public, anon;
grant execute on function public.get_admin_chart_data(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Doğrulama:
--   * user JWT ilə: update profiles set kyc_status='pending' ... → UĞURLU olmalı
--   * select get_admin_chart_data('7d'/'90d'/'all') → seriya uzunluqları 7/13-14/aylar
-- ----------------------------------------------------------------------------
