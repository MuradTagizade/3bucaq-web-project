-- ============================================================================
-- SECURITY REMEDIATION — PART 9: İstifadəçi Logları + Admin Panel Qrafik Dataları
-- Tarix: 2026-07-04
-- Zəncir: ... → _7.sql → _8.sql → BU FAYL
--
-- 1) user_logs cədvəli — istifadəçi hadisələri (qeydiyyat, KYC, profil dəyişmə,
--    blok) DB trigger-ləri ilə avtomatik yazılır (client saxtalaya bilməz).
-- 2) get_user_activity(...) — BÜTÜN istifadəçi hərəkətlərini (transactions,
--    deposits, withdrawals, points_history, level_claims, user_logs) vahid
--    lentə birləşdirən admin RPC-si ('logs' icazəsi tələb edir).
-- 3) get_admin_chart_data() — dashboard qrafikləri üçün 30 günlük aqreqatlar
--    (qeydiyyat, depozit/çıxarış həcmi, əməliyyat aktivliyi, KYC/paket
--    paylanması, ümumi yekunlar) — tək RPC.
-- Part 6 whitelist grant modeli qorunur (aşağıda açıq grant-lar).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) user_logs cədvəli + RLS
-- ----------------------------------------------------------------------------
create table if not exists public.user_logs (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_logs_uid_created on public.user_logs (uid, created_at desc);
create index if not exists idx_user_logs_created on public.user_logs (created_at desc);
create index if not exists idx_user_logs_action on public.user_logs (action);

alter table public.user_logs enable row level security;

-- Yalnız admin oxuyur; yazma YALNIZ definer trigger-lər (heç bir insert policy yoxdur)
drop policy if exists user_logs_admin_select on public.user_logs;
create policy user_logs_admin_select on public.user_logs
  for select to authenticated using ((select public.is_admin()));

-- ----------------------------------------------------------------------------
-- 2) Profil hadisələri trigger-i (INSERT → registered; UPDATE → kyc/blok/profil)
--    SECURITY DEFINER: user_logs-a RLS-dən keçmədən yazır; profiles-dakı
--    check_profile_updates (INVOKER) qorumasına TOXUNMUR (ayrı, AFTER trigger).
-- ----------------------------------------------------------------------------
create or replace function public.log_user_profile_events()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  changed text[];
begin
  if tg_op = 'INSERT' then
    insert into public.user_logs (uid, action, details, created_at)
    values (new.id, 'registered',
            jsonb_build_object('user_code', new.user_code),
            coalesce(new.created_at, now()));
    return new;
  end if;

  if new.kyc_status is distinct from old.kyc_status then
    insert into public.user_logs (uid, action, details)
    values (new.id,
            case new.kyc_status
              when 'pending'  then 'kyc_submitted'
              when 'approved' then 'kyc_approved'
              when 'rejected' then 'kyc_rejected'
              else 'kyc_reset'
            end,
            jsonb_build_object('from', old.kyc_status, 'to', new.kyc_status));
  end if;

  if new.is_blocked is distinct from old.is_blocked then
    insert into public.user_logs (uid, action, details)
    values (new.id,
            case when new.is_blocked then 'blocked' else 'unblocked' end,
            jsonb_build_object('reason', new.block_reason));
  end if;

  if (new.full_name, new.phone, new.country, new.city, new.email)
     is distinct from
     (old.full_name, old.phone, old.country, old.city, old.email) then
    changed := array_remove(array[
      case when new.full_name is distinct from old.full_name then 'full_name' end,
      case when new.phone     is distinct from old.phone     then 'phone'     end,
      case when new.country   is distinct from old.country   then 'country'   end,
      case when new.city      is distinct from old.city      then 'city'      end,
      case when new.email     is distinct from old.email     then 'email'     end
    ], null);
    insert into public.user_logs (uid, action, details)
    values (new.id, 'profile_updated', jsonb_build_object('fields', changed));
  end if;

  return new;
end;
$$;

revoke all on function public.log_user_profile_events() from public, anon, authenticated;

drop trigger if exists tr_log_user_profile_events_ins on public.profiles;
create trigger tr_log_user_profile_events_ins
  after insert on public.profiles
  for each row execute function public.log_user_profile_events();

drop trigger if exists tr_log_user_profile_events_upd on public.profiles;
create trigger tr_log_user_profile_events_upd
  after update on public.profiles
  for each row execute function public.log_user_profile_events();

-- Backfill: mövcud istifadəçilər üçün 'registered' hadisəsi
insert into public.user_logs (uid, action, details, created_at)
select p.id, 'registered', jsonb_build_object('user_code', p.user_code), p.created_at
from public.profiles p
where not exists (
  select 1 from public.user_logs ul where ul.uid = p.id and ul.action = 'registered'
);

-- ----------------------------------------------------------------------------
-- 3) get_user_activity — vahid istifadəçi hərəkət lenti (admin, 'logs' icazəsi)
-- ----------------------------------------------------------------------------
create or replace function public.get_user_activity(
  p_limit  integer default 300,
  p_search text    default null,
  p_action text    default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 300), 1), 500);
  result  jsonb;
begin
  if not public.has_admin_perm('logs') then
    return jsonb_build_object('error', 'İcazə yoxdur');
  end if;

  with events as (
    -- pul əməliyyatları (actor: bonus/daxilolmalarda alan, xərcləmələrdə göndərən)
    select t.created_at,
           case when t.type in ('referral_bonus','depth_bonus','level_bonus','deposit','daily_earning','admin_adjust')
                then t.to_uid else t.from_uid end as uid,
           case when t.type = 'transfer' then 'transfer_out' else t.type end as action,
           t.amount,
           jsonb_build_object('from', t.from_login, 'to', t.to_login, 'status', t.status) as details
    from public.transactions t
    union all
    select t.created_at, t.to_uid, 'transfer_in', t.amount,
           jsonb_build_object('from', t.from_login, 'to', t.to_login, 'status', t.status)
    from public.transactions t
    where t.type = 'transfer' and t.to_uid is not null
    union all
    select d.created_at, d.uid, 'deposit_request', d.amount,
           jsonb_build_object('method', d.payment_method, 'status', d.status)
    from public.deposits d
    union all
    select w.created_at, w.uid, 'withdrawal_request', w.amount,
           jsonb_build_object('method', w.payment_method, 'network', w.network, 'status', w.status)
    from public.withdrawals w
    union all
    select ph.created_at, ph.uid, 'points_earned', ph.points,
           jsonb_build_object('from', ph.from_login, 'package', ph.package_id, 'line', ph.line_number)
    from public.points_history ph
    union all
    select lc.created_at, lc.uid, 'level_bonus_claim', lc.bonus_amount,
           jsonb_build_object('level', lc.level, 'status', lc.status)
    from public.level_claims lc
    union all
    select ul.created_at, ul.uid, ul.action, null::numeric, ul.details
    from public.user_logs ul
  )
  select coalesce(jsonb_agg(row_j order by rn), '[]'::jsonb) into result
  from (
    select row_number() over (order by e.created_at desc) as rn,
           jsonb_build_object(
             'created_at', e.created_at,
             'user_code', pr.user_code,
             'action', e.action,
             'amount', e.amount,
             'details', e.details
           ) as row_j
    from events e
    join public.profiles pr on pr.id = e.uid
    where (p_action is null or e.action = p_action)
      and (p_search is null or pr.user_code ilike '%' || p_search || '%')
    order by e.created_at desc
    limit v_limit
  ) x;

  return coalesce(result, '[]'::jsonb);
end;
$$;

revoke all on function public.get_user_activity(integer, text, text) from public, anon;
grant execute on function public.get_user_activity(integer, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 4) get_admin_chart_data — dashboard qrafik aqreqatları (30 gün, sıfır dolgulu)
-- ----------------------------------------------------------------------------
create or replace function public.get_admin_chart_data()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'İcazə yoxdur');
  end if;

  with days as (
    select generate_series(current_date - 29, current_date, interval '1 day')::date as d
  ),
  regs as (
    select created_at::date as d, count(*) as c
    from public.profiles where created_at >= current_date - 29 group by 1
  ),
  deps as (
    select created_at::date as d, count(*) as c, coalesce(sum(amount), 0) as s
    from public.deposits where status = 'approved' and created_at >= current_date - 29 group by 1
  ),
  wds as (
    select created_at::date as d, count(*) as c, coalesce(sum(amount), 0) as s
    from public.withdrawals where status = 'approved' and created_at >= current_date - 29 group by 1
  ),
  acts as (
    select created_at::date as d, count(*) as c
    from public.transactions where created_at >= current_date - 29 group by 1
  )
  select jsonb_build_object(
    'regs_daily', (
      select jsonb_agg(jsonb_build_object('d', to_char(days.d, 'MM-DD'), 'c', coalesce(regs.c, 0)) order by days.d)
      from days left join regs on regs.d = days.d
    ),
    'deposits_daily', (
      select jsonb_agg(jsonb_build_object('d', to_char(days.d, 'MM-DD'), 'c', coalesce(deps.c, 0), 'a', coalesce(deps.s, 0)) order by days.d)
      from days left join deps on deps.d = days.d
    ),
    'withdrawals_daily', (
      select jsonb_agg(jsonb_build_object('d', to_char(days.d, 'MM-DD'), 'c', coalesce(wds.c, 0), 'a', coalesce(wds.s, 0)) order by days.d)
      from days left join wds on wds.d = days.d
    ),
    'activity_daily', (
      select jsonb_agg(jsonb_build_object('d', to_char(days.d, 'MM-DD'), 'c', coalesce(acts.c, 0)) order by days.d)
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
    'tx_types_30d', (
      select coalesce(jsonb_agg(jsonb_build_object('type', t.type, 'c', t.c, 'a', t.s) order by t.s desc), '[]'::jsonb)
      from (
        select type, count(*) as c, coalesce(sum(amount), 0) as s
        from public.transactions where created_at >= current_date - 29 group by type
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

revoke all on function public.get_admin_chart_data() from public, anon;
grant execute on function public.get_admin_chart_data() to authenticated;

-- ----------------------------------------------------------------------------
-- Doğrulama (əl ilə):
--   select public.get_admin_chart_data();               -- admin sessiyada
--   select public.get_user_activity(50, null, null);    -- 'logs' icazəli admin
--   anon: hər ikisi 42501 permission denied verməlidir.
-- ----------------------------------------------------------------------------
