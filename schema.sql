-- =======================================================
-- 3bucaq — Supabase Database Schema Setup Script (v2)
-- Full platform schema with all business logic tables
-- =======================================================

-- Disable existing triggers/functions if running again
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- 1. PROFILES Table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  display_login text unique not null,
  full_name text,
  balance numeric not null default 0,
  transfer_balance numeric not null default 0,
  total_points numeric not null default 0,
  current_level integer not null default 0,
  referral_code text unique not null,
  referred_by uuid references public.profiles(id) on delete set null,
  active_packages jsonb not null default '{}'::jsonb,
  package_activated_at jsonb not null default '{}'::jsonb,
  is_blocked boolean not null default false,
  block_reason text,
  blocked_until timestamp with time zone,
  role text not null default 'user' check (role in ('user', 'admin')),
  country text,
  city text,
  phone text,
  kyc_status text not null default 'none' check (kyc_status in ('none', 'pending', 'approved', 'rejected')),
  kyc_document_type text,
  kyc_document_url text,
  kyc_document_back_url text,
  kyc_selfie_url text,
  claimed_levels jsonb not null default '[]'::jsonb,
  admin_permissions jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

-- Add new columns if table already exists (safe migration)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='country') then
    alter table public.profiles add column country text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='city') then
    alter table public.profiles add column city text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='phone') then
    alter table public.profiles add column phone text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='kyc_status') then
    alter table public.profiles add column kyc_status text not null default 'none' check (kyc_status in ('none', 'pending', 'approved', 'rejected'));
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='kyc_document_type') then
    alter table public.profiles add column kyc_document_type text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='kyc_document_url') then
    alter table public.profiles add column kyc_document_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='kyc_document_back_url') then
    alter table public.profiles add column kyc_document_back_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='kyc_selfie_url') then
    alter table public.profiles add column kyc_selfie_url text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='blocked_until') then
    alter table public.profiles add column blocked_until timestamp with time zone;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='package_activated_at') then
    alter table public.profiles add column package_activated_at jsonb not null default '{}'::jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='claimed_levels') then
    alter table public.profiles add column claimed_levels jsonb not null default '[]'::jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='admin_permissions') then
    alter table public.profiles add column admin_permissions jsonb not null default '{}'::jsonb;
  end if;
end $$;

-- 2. TRANSACTIONS Table
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  from_uid uuid references public.profiles(id) on delete set null,
  from_login text,
  to_uid uuid references public.profiles(id) on delete set null,
  to_login text,
  amount numeric not null,
  status text default 'completed',
  created_at timestamp with time zone not null default now()
);

-- Add status column if missing
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='transactions' and column_name='status') then
    alter table public.transactions add column status text default 'completed';
  end if;
end $$;

-- 3. LEVEL_CLAIMS Table
create table if not exists public.level_claims (
  id uuid primary key default gen_random_uuid(),
  uid uuid references public.profiles(id) on delete cascade not null,
  login text not null,
  level integer not null,
  bonus_amount numeric not null,
  claim_type text not null default 'crypto' check (claim_type in ('balance', 'crypto')),
  usdt_address text,
  network text,
  status text not null default 'pending' check (status in ('pending', 'done', 'rejected')),
  tx_hash text,
  created_at timestamp with time zone not null default now(),
  approved_at timestamp with time zone
);

-- Add new columns if missing
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='level_claims' and column_name='claim_type') then
    alter table public.level_claims add column claim_type text not null default 'crypto' check (claim_type in ('balance', 'crypto'));
  end if;
  if not exists (select 1 from information_schema.columns where table_name='level_claims' and column_name='network') then
    alter table public.level_claims add column network text;
  end if;
end $$;

-- 4. ADMIN_LOGS Table
create table if not exists public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_uid uuid references public.profiles(id) on delete set null,
  action text not null,
  target_uid uuid references public.profiles(id) on delete set null,
  details text,
  created_at timestamp with time zone not null default now()
);

-- 5. POINTS_HISTORY Table (NEW)
create table if not exists public.points_history (
  id uuid primary key default gen_random_uuid(),
  uid uuid references public.profiles(id) on delete cascade not null,
  points numeric not null,
  from_uid uuid references public.profiles(id) on delete set null,
  from_login text,
  package_id text not null,
  line_number integer not null,
  created_at timestamp with time zone not null default now()
);

-- 6. DEPOSITS Table (NEW)
create table if not exists public.deposits (
  id uuid primary key default gen_random_uuid(),
  uid uuid references public.profiles(id) on delete cascade not null,
  login text not null,
  amount numeric not null,
  network text,
  tx_hash text,
  payment_method text not null default 'usdt' check (payment_method in ('usdt', 'card')),
  card_number text,
  receipt_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone not null default now(),
  approved_at timestamp with time zone
);

-- 7. WITHDRAWALS Table (NEW)
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  uid uuid references public.profiles(id) on delete cascade not null,
  login text not null,
  amount numeric not null,
  crypto_address text,
  network text,
  payment_method text not null default 'usdt' check (payment_method in ('usdt', 'card')),
  card_number text,
  receipt_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'done', 'rejected')),
  tx_hash text,
  created_at timestamp with time zone not null default now(),
  approved_at timestamp with time zone
);

-- 8. SYSTEM_SETTINGS Table (NEW)
create table if not exists public.system_settings (
  key text primary key,
  value text not null,
  updated_at timestamp with time zone default now()
);

-- ============================
-- Enable Row Level Security
-- ============================
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.level_claims enable row level security;
alter table public.admin_logs enable row level security;
alter table public.points_history enable row level security;
alter table public.deposits enable row level security;
alter table public.withdrawals enable row level security;

-- Admin role helper function
create or replace function public.is_admin()
returns boolean security definer as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
end;
$$ language plpgsql;

-- ============================
-- RLS Policies
-- ============================

-- PROFILES
drop policy if exists "Allow public read of profiles" on public.profiles;
create policy "Allow public read of profiles"
  on public.profiles for select using (true);

drop policy if exists "Allow users and admins to update profiles" on public.profiles;
create policy "Allow users and admins to update profiles"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin());

-- TRANSACTIONS
drop policy if exists "Allow users to see their own transactions" on public.transactions;
create policy "Allow users to see their own transactions"
  on public.transactions for select
  using (auth.uid() = from_uid or auth.uid() = to_uid or public.is_admin());

drop policy if exists "Allow users and admins to insert transactions" on public.transactions;
create policy "Allow users and admins to insert transactions"
  on public.transactions for insert
  with check (auth.uid() = from_uid or public.is_admin());

-- LEVEL_CLAIMS
drop policy if exists "Allow users to see their own level claims" on public.level_claims;
create policy "Allow users to see their own level claims"
  on public.level_claims for select
  using (auth.uid() = uid or public.is_admin());

drop policy if exists "Allow users to insert level claims" on public.level_claims;
create policy "Allow users to insert level claims"
  on public.level_claims for insert
  with check (auth.uid() = uid);

drop policy if exists "Allow admin to update level claims" on public.level_claims;
create policy "Allow admin to update level claims"
  on public.level_claims for update
  using (public.is_admin());

-- ADMIN_LOGS
drop policy if exists "Allow admin to select admin logs" on public.admin_logs;
create policy "Allow admin to select admin logs"
  on public.admin_logs for select
  using (public.is_admin());

drop policy if exists "Allow admin to insert admin logs" on public.admin_logs;
create policy "Allow admin to insert admin logs"
  on public.admin_logs for insert
  with check (public.is_admin());

-- POINTS_HISTORY
drop policy if exists "Allow users to see own points" on public.points_history;
create policy "Allow users to see own points"
  on public.points_history for select
  using (auth.uid() = uid or public.is_admin());

drop policy if exists "Allow insert points" on public.points_history;
create policy "Allow insert points"
  on public.points_history for insert
  with check (true);

-- DEPOSITS
drop policy if exists "Allow users to see own deposits" on public.deposits;
create policy "Allow users to see own deposits"
  on public.deposits for select
  using (auth.uid() = uid or public.is_admin());

drop policy if exists "Allow users to insert deposits" on public.deposits;
create policy "Allow users to insert deposits"
  on public.deposits for insert
  with check (auth.uid() = uid);

drop policy if exists "Allow admin to update deposits" on public.deposits;
create policy "Allow admin to update deposits"
  on public.deposits for update
  using (public.is_admin());

-- WITHDRAWALS
drop policy if exists "Allow users to see own withdrawals" on public.withdrawals;
create policy "Allow users to see own withdrawals"
  on public.withdrawals for select
  using (auth.uid() = uid or public.is_admin());

drop policy if exists "Allow users to insert withdrawals" on public.withdrawals;
create policy "Allow users to insert withdrawals"
  on public.withdrawals for insert
  with check (auth.uid() = uid);

drop policy if exists "Allow admin to update withdrawals" on public.withdrawals;
create policy "Allow admin to update withdrawals"
  on public.withdrawals for update
  using (public.is_admin());

-- SYSTEM_SETTINGS
drop policy if exists "Allow select for authenticated" on public.system_settings;
create policy "Allow select for authenticated"
  on public.system_settings for select
  to authenticated
  using (true);

drop policy if exists "Allow update for admin" on public.system_settings;
create policy "Allow update for admin"
  on public.system_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================
-- Trigger: Auto-create profile on signup
-- ============================
create or replace function public.handle_new_user()
returns trigger security definer set search_path = public as $$
declare
  ref_code text;
  ref_uid uuid;
  user_login text;
  is_first_user boolean;
  user_role text := 'user';
  user_permissions jsonb := '{}'::jsonb;
begin
  -- Generate unique referral code
  ref_code := 'REF' || lpad(floor(random() * 100000)::text, 5, '0');
  
  -- Extract login from metadata or email
  user_login := coalesce(
    new.raw_user_meta_data->>'display_login',
    split_part(new.email, '@', 1)
  );
  
  -- Resolve referred_by from referral code
  if new.raw_user_meta_data->>'referral_code' is not null and new.raw_user_meta_data->>'referral_code' != '' then
    select id into ref_uid from public.profiles
      where referral_code = new.raw_user_meta_data->>'referral_code'
      limit 1;
  end if;

  -- Auto-promote first user or admin@3bucaq.com to admin
  select not exists(select 1 from public.profiles) into is_first_user;
  if is_first_user or new.email = 'admin@3bucaq.com' then
    user_role := 'admin';
    user_permissions := '{"superadmin": true, "users": true, "kyc": true, "claims": true, "finance": true, "logs": true}'::jsonb;
  end if;
  
  insert into public.profiles (
    id, email, display_login, full_name, role, referral_code, 
    referred_by, country, city, phone, admin_permissions
  ) values (
    new.id, 
    new.email, 
    user_login,
    coalesce(new.raw_user_meta_data->>'full_name', user_login), 
    user_role, 
    ref_code,
    ref_uid,
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'city',
    new.raw_user_meta_data->>'phone',
    user_permissions
  );
  return new;
end;
$$ language plpgsql;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- Self-healing RPC function to create profile if missing
-- ============================================
create or replace function public.create_profile_if_missing()
returns json security definer as $$
declare
  ref_code text;
  user_login text;
  p_exists boolean;
  curr_user auth.users%rowtype;
begin
  -- Check if user is authenticated
  if auth.uid() is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  -- Check if profile already exists
  select exists(select 1 from public.profiles where id = auth.uid()) into p_exists;
  if p_exists then
    return json_build_object('success', true, 'message', 'Profile already exists');
  end if;

  -- Get auth user details
  select * into curr_user from auth.users where id = auth.uid();

  -- Generate unique referral code
  ref_code := 'REF' || lpad(floor(random() * 100000)::text, 5, '0');
  
  -- Extract login
  user_login := coalesce(
    curr_user.raw_user_meta_data->>'display_login',
    split_part(curr_user.email, '@', 1)
  );

  insert into public.profiles (
    id, email, display_login, full_name, role, referral_code, 
    country, city, phone
  ) values (
    curr_user.id, 
    curr_user.email, 
    user_login,
    coalesce(curr_user.raw_user_meta_data->>'full_name', user_login), 
    'user', 
    ref_code,
    curr_user.raw_user_meta_data->>'country',
    curr_user.raw_user_meta_data->>'city',
    curr_user.raw_user_meta_data->>'phone'
  );

  return json_build_object('success', true, 'message', 'Profile created successfully');
end;
$$ language plpgsql;
