-- Coletivo · Fluxo — schema inicial (login real + dados compartilhados)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase
-- (ou via `supabase db push` se estiver usando o CLI com este repo linkado).
--
-- ⚠️ ATENÇÃO — projeto Supabase compartilhado: este projeto também hospeda
-- outro app (Forneria Original / gestao-operacional), com suas próprias
-- tabelas (`profiles`, `insumos`, `lanches_registros`, etc). Por isso TODA
-- tabela e função do Fluxo usa o prefixo `fluxo_` — nunca crie uma tabela ou
-- função aqui sem esse prefixo, mesmo que pareça óbvio (ex: nunca `profiles`,
-- sempre `fluxo_profiles`). Já aconteceu de um `create table if not exists
-- profiles` "colar" silenciosamente numa tabela de outro app porque o nome
-- já existia — o prefixo existe exatamente pra isso nunca mais acontecer.
--
-- Nota sobre tipos de id: o app gera ids curtos no navegador (ex: "kx3f9a2b",
-- via uid() em src/App.jsx) em vez de UUID — por isso as tabelas de conteúdo
-- usam `id text` (com um default em uuid só de segurança, mas na prática o
-- app sempre manda o próprio id). Só `fluxo_profiles.id` é uuid de verdade,
-- porque é o mesmo id do auth.users.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- FLUXO_PROFILES — 1 linha por membro do time, id = auth.users.id
-- ---------------------------------------------------------------------------
create table if not exists fluxo_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'atendimento' check (role in ('admin', 'atendimento')),
  status text not null default 'convite pendente' check (status in ('convite pendente', 'ativo', 'inativo')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- FLUXO_CLIENTS
-- ---------------------------------------------------------------------------
create table if not exists fluxo_clients (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  units jsonb not null default '[]',
  portfolio_owner_id uuid references fluxo_profiles(id) on delete set null,
  priority_metrics jsonb not null default '[]',
  deliverables jsonb not null default '[]',
  diagnosis text not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- FLUXO_ENTRIES — lançamentos de métricas por cliente/unidade/período
-- ---------------------------------------------------------------------------
create table if not exists fluxo_entries (
  id text primary key default gen_random_uuid()::text,
  client_id text not null references fluxo_clients(id) on delete cascade,
  unit_id text not null,
  period_start date,
  period_end date not null,
  metrics jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists fluxo_entries_client_unit_idx on fluxo_entries (client_id, unit_id);

-- ---------------------------------------------------------------------------
-- FLUXO_DEMANDS
-- ---------------------------------------------------------------------------
create table if not exists fluxo_demands (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  client_id text references fluxo_clients(id) on delete set null,
  unit_id text,
  description text default '',
  priority text not null default 'normal',
  due_date date,
  status text not null default 'aberta',
  origin text not null default 'manual',
  type text not null default 'geral',
  assignee_id uuid references fluxo_profiles(id) on delete set null,
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
create index if not exists fluxo_demands_client_idx on fluxo_demands (client_id);
create index if not exists fluxo_demands_assignee_idx on fluxo_demands (assignee_id);
create index if not exists fluxo_demands_status_idx on fluxo_demands (status);

-- ---------------------------------------------------------------------------
-- FLUXO_NOTIFICATIONS — sino da plataforma; todo insert aqui dispara e-mail
-- de alerta via Database Webhook -> Edge Function send-alert-email
-- (configurado no dashboard do Supabase, ver checklist no DEPLOY.md).
-- ---------------------------------------------------------------------------
create table if not exists fluxo_notifications (
  id text primary key default gen_random_uuid()::text,
  member_id uuid not null references fluxo_profiles(id) on delete cascade,
  message text not null,
  demand_id text references fluxo_demands(id) on delete set null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists fluxo_notifications_member_idx on fluxo_notifications (member_id);

-- ---------------------------------------------------------------------------
-- FLUXO_COMMUNICATION_RULES — réguas configuradas pelo admin
-- ---------------------------------------------------------------------------
create table if not exists fluxo_communication_rules (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  active boolean not null default true,
  trigger text not null,
  days_before int,
  day_of_month int,
  status_alvo text,
  demand_type_filter text default 'todos',
  recipient_mode text default 'responsavel',
  recipient_id uuid references fluxo_profiles(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- FLUXO_RULE_FIRE_LOG — dedupe de disparo (mesma lógica de "fireKey" que já
-- existia em memória no App.jsx, agora persistida)
-- ---------------------------------------------------------------------------
create table if not exists fluxo_rule_fire_log (
  key text primary key,
  fired_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table fluxo_profiles enable row level security;
alter table fluxo_clients enable row level security;
alter table fluxo_entries enable row level security;
alter table fluxo_demands enable row level security;
alter table fluxo_notifications enable row level security;
alter table fluxo_communication_rules enable row level security;
alter table fluxo_rule_fire_log enable row level security;

-- security definer p/ evitar recursão de RLS ao consultar fluxo_profiles
-- dentro das próprias policies de fluxo_profiles
create or replace function fluxo_is_active_member()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from fluxo_profiles where id = auth.uid() and status = 'ativo'
  );
$$;

create or replace function fluxo_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from fluxo_profiles where id = auth.uid() and role = 'admin' and status = 'ativo'
  );
$$;

-- fluxo_profiles: qualquer membro ativo lê o diretório do time; cada um lê a
-- si mesmo mesmo antes de estar "ativo" (precisa disso logo após aceitar o
-- convite); só admin cria/edita/apaga linhas de outras pessoas.
create policy "profiles_select" on fluxo_profiles for select
  using (fluxo_is_active_member() or auth.uid() = id);
create policy "profiles_self_update" on fluxo_profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_admin_all" on fluxo_profiles for all
  using (fluxo_is_admin()) with check (fluxo_is_admin());

-- fluxo_clients / fluxo_entries / fluxo_demands: qualquer membro ativo lê e escreve
create policy "clients_rw" on fluxo_clients for all
  using (fluxo_is_active_member()) with check (fluxo_is_active_member());
create policy "entries_rw" on fluxo_entries for all
  using (fluxo_is_active_member()) with check (fluxo_is_active_member());
create policy "demands_rw" on fluxo_demands for all
  using (fluxo_is_active_member()) with check (fluxo_is_active_member());

-- fluxo_notifications: cada um lê/atualiza (marcar como lida) só as próprias;
-- qualquer membro ativo pode inserir (réguas e notificação manual mandam
-- para outra pessoa); admin lê tudo.
create policy "notifications_select" on fluxo_notifications for select
  using (member_id = auth.uid() or fluxo_is_admin());
create policy "notifications_update_own" on fluxo_notifications for update
  using (member_id = auth.uid());
create policy "notifications_insert" on fluxo_notifications for insert
  with check (fluxo_is_active_member());

-- fluxo_communication_rules: qualquer membro ativo LÊ (o motor de réguas
-- roda no navegador de quem estiver com o app aberto, não só o do admin);
-- só admin cria/edita/apaga régua (a aba Réguas já é admin-only na UI).
create policy "rules_select" on fluxo_communication_rules for select
  using (fluxo_is_active_member());
create policy "rules_admin_write" on fluxo_communication_rules for insert
  with check (fluxo_is_admin());
create policy "rules_admin_update" on fluxo_communication_rules for update
  using (fluxo_is_admin()) with check (fluxo_is_admin());
create policy "rules_admin_delete" on fluxo_communication_rules for delete
  using (fluxo_is_admin());

-- fluxo_rule_fire_log: qualquer membro ativo lê e registra disparos (dedupe
-- da régua roda em qualquer sessão logada); só admin apaga/edita manualmente.
create policy "fire_log_select" on fluxo_rule_fire_log for select
  using (fluxo_is_active_member());
create policy "fire_log_insert" on fluxo_rule_fire_log for insert
  with check (fluxo_is_active_member());
create policy "fire_log_admin_update" on fluxo_rule_fire_log for update
  using (fluxo_is_admin());
create policy "fire_log_admin_delete" on fluxo_rule_fire_log for delete
  using (fluxo_is_admin());
