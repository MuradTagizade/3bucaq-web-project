-- ============================================================================
-- SECURITY REMEDIATION — PART 11: Xəzinə (Treasury) Sistemi + Referal/Köçürmə Statistika RPC-si
-- Tarix: 2026-07-04
-- Zəncir: ... → _9.sql → _10.sql → BU FAYL
--
-- 1) XƏZİNƏ: 1,000,000 USDT-lik sistem hovuzu.
--    * `admin_approve_deposit` — istifadəçiyə yüklənən depozit xəzinədən düşür.
--    * `admin_adjust_balance` — admin balans artırması xəzinədən düşür (maliyyə
--      admininə pul vermə də bu yolla), azaltma xəzinəyə geri qayıdır.
--    * Xəzinə kifayət etməzsə əməliyyat tam geri alınır (savepoint) və aydın
--      xəta qaytarılır. Bütün hərəkətlər `treasury_ledger`-ə yazılır.
--    * Client-dən yazma YOXDUR (RLS: yalnız admin SELECT; mutasiya yalnız definer).
-- 2) `get_treasury()` — qalıq + son 20 ledger sətri (admin).
-- 3) `get_referral_stats(p_range)` — istifadəçilər səhifəsi qrafikləri üçün:
--    köçürmə həcmi (seriya+cəm), xətt 1-5 üzrə referal pul qazancı (depth_bonus
--    xətti alıcının buyer upline zəncirindəki yeri ilə hesablanır — referred_by
--    Part 3-dən bəri kilidli olduğu üçün determinist), xətt üzrə xallar,
--    level bonus / gündəlik qazanc cəmləri.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) Cədvəllər
-- ----------------------------------------------------------------------------
create table if not exists public.treasury (
  id smallint primary key default 1 check (id = 1),
  balance numeric not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

insert into public.treasury (id, balance) values (1, 1000000)
on conflict (id) do nothing;

create table if not exists public.treasury_ledger (
  id uuid primary key default gen_random_uuid(),
  delta numeric not null,
  balance_after numeric not null,
  reason text not null,
  target_uid uuid references public.profiles(id) on delete set null,
  admin_uid uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_treasury_ledger_created on public.treasury_ledger (created_at desc);

alter table public.treasury enable row level security;
alter table public.treasury_ledger enable row level security;

drop policy if exists treasury_admin_select on public.treasury;
create policy treasury_admin_select on public.treasury
  for select to authenticated using ((select public.is_admin()));

drop policy if exists treasury_ledger_admin_select on public.treasury_ledger;
create policy treasury_ledger_admin_select on public.treasury_ledger
  for select to authenticated using ((select public.is_admin()));
-- yazma policy YOXDUR — mutasiya yalnız definer funksiyalar

-- ----------------------------------------------------------------------------
-- 2) Daxili hərəkət köməkçisi (yalnız definer funksiyalardan çağırılır)
-- ----------------------------------------------------------------------------
create or replace function public.treasury_move(p_delta numeric, p_reason text, p_target uuid, p_admin uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_new numeric;
begin
  update public.treasury
     set balance = balance + p_delta, updated_at = now()
   where id = 1 and balance + p_delta >= 0
   returning balance into v_new;
  if not found then
    raise exception 'Xezine balansi kifayet etmir';
  end if;
  insert into public.treasury_ledger (delta, balance_after, reason, target_uid, admin_uid)
  values (p_delta, v_new, p_reason, p_target, p_admin);
end;
$$;

revoke all on function public.treasury_move(numeric, text, uuid, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3) admin_approve_deposit — xəzinə inteqrasiyası (Part 8 tərifini əvəz edir)
-- ----------------------------------------------------------------------------
create or replace function public.admin_approve_deposit(p_deposit_id uuid)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare dep record; rows_affected integer;
begin
  if not public.has_admin_perm('finance') then return json_build_object('success', false, 'error', 'Icaze yoxdur'); end if;
  begin
    update public.deposits set status = 'approved', approved_at = now()
      where id = p_deposit_id and status = 'pending' returning * into dep;
    get diagnostics rows_affected = row_count;
    if rows_affected = 0 then return json_build_object('success', false, 'error', 'Depozit tapilmadi ve ya artiq islenib'); end if;

    -- Xəzinədən düş (kifayət etmirsə exception → savepoint hər şeyi geri alır)
    perform public.treasury_move(-dep.amount, 'deposit_approve', dep.uid, auth.uid());

    update public.profiles set balance = balance + dep.amount where id = dep.uid;
    insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
    values ('deposit', dep.uid, dep.login, dep.uid, dep.login, dep.amount, 'completed');
    return json_build_object('success', true);
  exception when others then
    return json_build_object('success', false, 'error', sqlerrm);
  end;
end;
$$;

revoke all on function public.admin_approve_deposit(uuid) from public, anon;
grant execute on function public.admin_approve_deposit(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 4) admin_adjust_balance — xəzinə inteqrasiyası (+ to_login artıq user_code)
--    Müsbət düzəliş xəzinədən düşür; mənfi düzəliş xəzinəyə geri qayıdır.
-- ----------------------------------------------------------------------------
create or replace function public.admin_adjust_balance(p_uid uuid, p_amount numeric, p_type text default 'admin_adjust'::text)
returns json
language plpgsql
security definer
set search_path to 'public'
as $$
declare target record; rows_affected integer;
begin
  if not public.has_admin_perm('finance') then return json_build_object('success', false, 'error', 'Icaze yoxdur'); end if;
  if p_amount = 0 or p_amount is null then return json_build_object('success', false, 'error', 'Mebleg sifir ola bilmez'); end if;
  begin
    if p_amount > 0 then
      perform public.treasury_move(-p_amount, 'admin_adjust', p_uid, auth.uid());
    else
      perform public.treasury_move(abs(p_amount), 'admin_adjust_refund', p_uid, auth.uid());
    end if;

    update public.profiles set balance = balance + p_amount
      where id = p_uid and balance + p_amount >= 0 returning * into target;
    get diagnostics rows_affected = row_count;
    if rows_affected = 0 then
      raise exception 'Balans menfi ola bilmez ve ya istifadeci tapilmadi';
    end if;
    insert into public.transactions (type, from_uid, from_login, to_uid, to_login, amount, status)
    values (coalesce(p_type, 'admin_adjust'), null, 'Admin', p_uid, target.user_code, p_amount, 'completed');
    return json_build_object('success', true);
  exception when others then
    return json_build_object('success', false, 'error', sqlerrm);
  end;
end;
$$;

revoke all on function public.admin_adjust_balance(uuid, numeric, text) from public, anon;
grant execute on function public.admin_adjust_balance(uuid, numeric, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 5) get_treasury — qalıq + son 20 hərəkət (admin)
-- ----------------------------------------------------------------------------
create or replace function public.get_treasury()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'İcazə yoxdur');
  end if;
  return jsonb_build_object(
    'balance', (select balance from public.treasury where id = 1),
    'ledger', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'delta', l.delta, 'balance_after', l.balance_after, 'reason', l.reason,
        'target', pr.user_code, 'created_at', l.created_at
      ) order by l.created_at desc), '[]'::jsonb)
      from (select * from public.treasury_ledger order by created_at desc limit 20) l
      left join public.profiles pr on pr.id = l.target_uid
    )
  );
end;
$$;

revoke all on function public.get_treasury() from public, anon;
grant execute on function public.get_treasury() to authenticated;

-- ----------------------------------------------------------------------------
-- 6) get_referral_stats — istifadəçilər səhifəsi statistikaları (admin)
-- ----------------------------------------------------------------------------
create or replace function public.get_referral_stats(p_range text default '30d')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_start timestamptz;
  v_sd date; v_step interval; v_fmt text; v_trunc text;
  result jsonb;
begin
  if not public.is_admin() then
    return jsonb_build_object('error', 'İcazə yoxdur');
  end if;

  if p_range = '7d' then
    v_sd := current_date - 6;  v_step := interval '1 day';   v_fmt := 'MM-DD';   v_trunc := 'day';
  elsif p_range = '90d' then
    v_sd := date_trunc('week', (current_date - 89)::timestamp)::date;  v_step := interval '7 days'; v_fmt := 'MM-DD'; v_trunc := 'week';
  elsif p_range = '180d' then
    v_sd := date_trunc('week', (current_date - 179)::timestamp)::date; v_step := interval '7 days'; v_fmt := 'MM-DD'; v_trunc := 'week';
  elsif p_range = 'all' then
    select coalesce(date_trunc('month', min(created_at))::date, date_trunc('month', now())::date)
      into v_sd from public.profiles;
    v_step := interval '1 month'; v_fmt := 'YYYY-MM'; v_trunc := 'month';
  else
    v_sd := current_date - 29; v_step := interval '1 day';   v_fmt := 'MM-DD';   v_trunc := 'day';
  end if;
  v_start := v_sd::timestamptz;

  with dbl as (
    -- depth_bonus xətti: alıcının (to_uid) buyer (from_uid) upline zəncirindəki dərinliyi
    select t.amount,
      (with recursive chain as (
         select p.referred_by as uid, 1 as depth from public.profiles p where p.id = t.from_uid
         union all
         select p2.referred_by, c.depth + 1
         from chain c join public.profiles p2 on p2.id = c.uid
         where c.depth < 5 and c.uid is not null
       ) select depth from chain where uid = t.to_uid limit 1) as line
    from public.transactions t
    where t.type = 'depth_bonus' and t.created_at >= v_start
  ),
  days as (
    select generate_series(v_sd, current_date, v_step)::date as d
  ),
  trs as (
    select date_trunc(v_trunc, created_at)::date as d, count(*) as c, coalesce(sum(amount), 0) as s
    from public.transactions where type = 'transfer' and created_at >= v_start group by 1
  )
  select jsonb_build_object(
    'range', case when p_range in ('7d','30d','90d','180d','all') then p_range else '30d' end,
    'transfers_daily', (
      select jsonb_agg(jsonb_build_object('d', to_char(days.d, v_fmt), 'c', coalesce(trs.c, 0), 'a', coalesce(trs.s, 0)) order by days.d)
      from days left join trs on trs.d = days.d
    ),
    'transfers', (
      select jsonb_build_object('total', coalesce(sum(amount), 0), 'c', count(*))
      from public.transactions where type = 'transfer' and created_at >= v_start
    ),
    'ref_money_by_line', (
      select jsonb_agg(jsonb_build_object('line', v.l, 'amount', coalesce(x.s, 0), 'c', coalesce(x.c, 0)) order by v.l)
      from (values (1),(2),(3),(4),(5)) v(l)
      left join (
        select 1 as l, coalesce(sum(amount), 0) as s, count(*) as c
        from public.transactions where type = 'referral_bonus' and created_at >= v_start
        union all
        select line, sum(amount), count(*) from dbl where line is not null group by line
      ) x on x.l = v.l
    ),
    'points_by_line', (
      select jsonb_agg(jsonb_build_object('line', v.l, 'points', coalesce(x.s, 0)) order by v.l)
      from (values (1),(2),(3),(4),(5)) v(l)
      left join (
        select line_number as l, coalesce(sum(points), 0) as s
        from public.points_history where created_at >= v_start group by line_number
      ) x on x.l = v.l
    ),
    'totals', jsonb_build_object(
      'ref_money_total', (
        select coalesce(sum(amount), 0) from public.transactions
        where type in ('referral_bonus', 'depth_bonus') and created_at >= v_start
      ),
      'points_total', (select coalesce(sum(points), 0) from public.points_history where created_at >= v_start),
      'level_bonus_total', (select coalesce(sum(amount), 0) from public.transactions where type = 'level_bonus' and created_at >= v_start),
      'daily_earning_total', (select coalesce(sum(amount), 0) from public.transactions where type = 'daily_earning' and created_at >= v_start)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_referral_stats(text) from public, anon;
grant execute on function public.get_referral_stats(text) to authenticated;

-- ----------------------------------------------------------------------------
-- Doğrulama:
--   admin JWT: select get_treasury();  -- balance 1000000
--   admin JWT: select get_referral_stats('all');
--   depozit təsdiqi → xəzinə azalır + ledger sətri; xəzinə < məbləğ → xəta, depozit pending qalır
-- ----------------------------------------------------------------------------
