-- Coletivo · Fluxo — Zeus: agente de dados embutido (conversas, memória por
-- cliente e dashboards gerados). Admin-only.

create table if not exists fluxo_zeus_conversations (
  id text primary key default gen_random_uuid()::text,
  title text not null default 'Nova conversa',
  client_id text references fluxo_clients(id) on delete set null,
  created_by uuid not null references fluxo_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fluxo_zeus_messages (
  id text primary key default gen_random_uuid()::text,
  conversation_id text not null references fluxo_zeus_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists fluxo_zeus_messages_conv_idx on fluxo_zeus_messages (conversation_id, created_at);

-- memória por cliente: link de planilha salvo + o que o Zeus já aprendeu do negócio
create table if not exists fluxo_zeus_client_knowledge (
  client_id text primary key references fluxo_clients(id) on delete cascade,
  sheet_url text,
  key_indicators jsonb not null default '[]',
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists fluxo_zeus_dashboards (
  id text primary key default gen_random_uuid()::text,
  conversation_id text references fluxo_zeus_conversations(id) on delete set null,
  client_id text references fluxo_clients(id) on delete set null,
  file_path text not null,
  url text not null,
  created_by uuid not null references fluxo_profiles(id),
  created_at timestamptz not null default now()
);

alter table fluxo_zeus_conversations enable row level security;
alter table fluxo_zeus_messages enable row level security;
alter table fluxo_zeus_client_knowledge enable row level security;
alter table fluxo_zeus_dashboards enable row level security;

create policy "zeus_conversations_admin" on fluxo_zeus_conversations for all
  using (fluxo_is_admin()) with check (fluxo_is_admin());
create policy "zeus_messages_admin" on fluxo_zeus_messages for all
  using (fluxo_is_admin()) with check (fluxo_is_admin());
create policy "zeus_client_knowledge_admin" on fluxo_zeus_client_knowledge for all
  using (fluxo_is_admin()) with check (fluxo_is_admin());
create policy "zeus_dashboards_admin" on fluxo_zeus_dashboards for all
  using (fluxo_is_admin()) with check (fluxo_is_admin());
