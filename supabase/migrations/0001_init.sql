-- Coletivo · Fluxo — schema inicial (login real + dados compartilhados)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase
-- (ou via `supabase db push` se estiver usando o CLI com este repo linkado).
--
-- Nota sobre tipos de id: o app gera ids curtos no navegador (ex: "kx3f9a2b",
-- via uid() em src/App.jsx) em vez de UUID — por isso as tabelas de conteúdo
-- usam `id text` (com um default em uuid só de segurança, mas na prática o
-- app sempre manda o próprio id). Só `profiles.id` é uuid de verdade, porque
-- é o mesmo id do auth.users.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- PROFILES — 1 linha por membro do time, id = auth.users.id
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'atendimento' check (role in ('admin', 'atendimento')),
  status text not null default 'convite pendente' check (status in ('convite pendente', 'ativo', 'inativo')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CLIENTS
-- ---------------------------------------------------------------------------
create table if not exists clients (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  units jsonb not null default '[]',
  portfolio_owner_id uuid references profiles(id) on delete set null,
  priority_metrics jsonb not null default '[]',
  deliverables jsonb not null default '[]',
  diagnosis text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ENTRIES — lançamentos de métricas por cliente/unidade/período
-- ---------------------------------------------------------------------------
create table if not exists entries (
  id text primary key default gen_random_uuid()::text,
  client_id text not null references clients(id) on delete cascade,
  unit_id text not null,
  period_start date,
  period_end date not null,
  metrics jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists entries_client_unit_idx on entries (client_id, unit_id);

-- ---------------------------------------------------------------------------
-- DEMANDS
-- ---------------------------------------------------------------------------
create table if not exists demands (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  client_id text references clients(id) on delete set null,
  unit_id text,
  description text default '',
  priority text not null default 'normal',
  due_date date,
  status text not null default 'aberta',
  origin text not null default 'manual',
  type text not null default 'geral',
  assignee_id uuid references profiles(id) on delete set null,
  recurring jsonb not null default '{"enabled": false, "freq": ""}',
  briefing text default '',
  attachments jsonb not null default '[]',
  requires_proof boolean not null default false,
  proof_question text default '',
  proof jsonb,
  proof_status text not null default 'pendente',
  review_note text,
  actions jsonb not null default '[]',
  checklist jsonb,
  week_key text,
  day_key text,
  platform text,
  observation text,
  origin_alert_key text,
  origin_insight_key text,
  created_at timestamptz not null default now()
);
create index if not exists demands_client_idx on demands (client_id);
create index if not exists demands_assignee_idx on demands (assignee_id);
create index if not exists demands_status_idx on demands (status);

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS — sino da plataforma; todo insert aqui dispara e-mail de
-- alerta via Database Webhook -> Edge Function send-alert-email (configurado
-- no dashboard do Supabase, ver checklist no DEPLOY.md).
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id text primary key default gen_random_uuid()::text,
  member_id uuid not null references profiles(id) on delete cascade,
  message text not null,
  demand_id text references demands(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_member_idx on notifications (member_id);

-- ---------------------------------------------------------------------------
-- COMMUNICATION_RULES — réguas configuradas pelo admin
-- ---------------------------------------------------------------------------
create table if not exists communication_rules (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  active boolean not null default true,
  trigger text not null,
  days_before int,
  day_of_month int,
  status_alvo text,
  demand_type_filter text default 'todos',
  recipient_mode text default 'responsavel',
  recipient_id uuid references profiles(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RULE_FIRE_LOG — dedupe de disparo (mesma lógica de "fireKey" que já existia
-- em memória no App.jsx, agora persistida)
-- ---------------------------------------------------------------------------
create table if not exists rule_fire_log (
  key text primary key,
  fired_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table clients enable row level security;
alter table entries enable row level security;
alter table demands enable row level security;
alter table notifications enable row level security;
alter table communication_rules enable row level security;
alter table rule_fire_log enable row level security;

-- security definer p/ evitar recursão de RLS ao consultar profiles dentro
-- das próprias policies de profiles
create or replace function is_active_member()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and status = 'ativo'
  );
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'ativo'
  );
$$;

-- profiles: qualquer membro ativo lê o diretório do time; cada um lê a si
-- mesmo mesmo antes de estar "ativo" (precisa disso logo após aceitar o
-- convite); só admin cria/edita/apaga linhas de outras pessoas.
create policy "profiles_select" on profiles for select
  using (is_active_member() or auth.uid() = id);
create policy "profiles_self_update" on profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_admin_all" on profiles for all
  using (is_admin()) with check (is_admin());

-- clients / entries / demands: qualquer membro ativo lê e escreve
create policy "clients_rw" on clients for all
  using (is_active_member()) with check (is_active_member());
create policy "entries_rw" on entries for all
  using (is_active_member()) with check (is_active_member());
create policy "demands_rw" on demands for all
  using (is_active_member()) with check (is_active_member());

-- notifications: cada um lê/atualiza (marcar como lida) só as próprias;
-- qualquer membro ativo pode inserir (réguas e notificação manual mandam
-- para outra pessoa); admin lê tudo.
create policy "notifications_select" on notifications for select
  using (member_id = auth.uid() or is_admin());
create policy "notifications_update_own" on notifications for update
  using (member_id = auth.uid());
create policy "notifications_insert" on notifications for insert
  with check (is_active_member());

-- communication_rules: qualquer membro ativo LÊ (o motor de réguas roda no
-- navegador de quem estiver com o app aberto, não só o do admin); só admin
-- cria/edita/apaga régua (a aba Réguas já é admin-only na UI).
create policy "rules_select" on communication_rules for select
  using (is_active_member());
create policy "rules_admin_write" on communication_rules for insert
  with check (is_admin());
create policy "rules_admin_update" on communication_rules for update
  using (is_admin()) with check (is_admin());
create policy "rules_admin_delete" on communication_rules for delete
  using (is_admin());

-- rule_fire_log: qualquer membro ativo lê e registra disparos (dedupe da
-- régua roda em qualquer sessão logada); só admin apaga/edita manualmente.
create policy "fire_log_select" on rule_fire_log for select
  using (is_active_member());
create policy "fire_log_insert" on rule_fire_log for insert
  with check (is_active_member());
create policy "fire_log_admin_update" on rule_fire_log for update
  using (is_admin());
create policy "fire_log_admin_delete" on rule_fire_log for delete
  using (is_admin());
