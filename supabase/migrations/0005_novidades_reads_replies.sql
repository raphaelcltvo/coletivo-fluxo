-- Coletivo · Fluxo — Novidades ganha confirmação de leitura (estilo
-- WhatsApp: quem viu e quando) e respostas por post.

create table if not exists fluxo_post_reads (
  post_id text not null references fluxo_posts(id) on delete cascade,
  member_id uuid not null references fluxo_profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (post_id, member_id)
);
alter table fluxo_post_reads enable row level security;
create policy "post_reads_select" on fluxo_post_reads for select
  using (fluxo_is_active_member());
create policy "post_reads_insert_own" on fluxo_post_reads for insert
  with check (member_id = auth.uid());

create table if not exists fluxo_post_replies (
  id text primary key default gen_random_uuid()::text,
  post_id text not null references fluxo_posts(id) on delete cascade,
  author_id uuid not null references fluxo_profiles(id),
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists fluxo_post_replies_post_idx on fluxo_post_replies (post_id, created_at);
alter table fluxo_post_replies enable row level security;
create policy "post_replies_select" on fluxo_post_replies for select
  using (fluxo_is_active_member());
create policy "post_replies_insert" on fluxo_post_replies for insert
  with check (fluxo_is_active_member() and author_id = auth.uid());
create policy "post_replies_delete_own" on fluxo_post_replies for delete
  using (author_id = auth.uid() or fluxo_is_admin());
