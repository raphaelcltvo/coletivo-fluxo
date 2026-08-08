-- Coletivo · Fluxo — Threads (ex-Novidades): mensagem direta 1:1 e curtidas
-- nos posts públicos.

create table if not exists fluxo_dm_conversations (
  id text primary key default gen_random_uuid()::text,
  member_a_id uuid not null references fluxo_profiles(id),
  member_b_id uuid not null references fluxo_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_a_id, member_b_id)
);

create table if not exists fluxo_dm_messages (
  id text primary key default gen_random_uuid()::text,
  conversation_id text not null references fluxo_dm_conversations(id) on delete cascade,
  sender_id uuid not null references fluxo_profiles(id),
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists fluxo_dm_messages_conv_idx on fluxo_dm_messages (conversation_id, created_at);

create table if not exists fluxo_post_likes (
  post_id text not null references fluxo_posts(id) on delete cascade,
  member_id uuid not null references fluxo_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, member_id)
);

alter table fluxo_dm_conversations enable row level security;
alter table fluxo_dm_messages enable row level security;
alter table fluxo_post_likes enable row level security;

create policy "dm_conversations_participant" on fluxo_dm_conversations for select
  using (auth.uid() = member_a_id or auth.uid() = member_b_id);
create policy "dm_conversations_insert" on fluxo_dm_conversations for insert
  with check (auth.uid() = member_a_id or auth.uid() = member_b_id);

create policy "dm_messages_participant_select" on fluxo_dm_messages for select
  using (exists (
    select 1 from fluxo_dm_conversations c
    where c.id = conversation_id and (c.member_a_id = auth.uid() or c.member_b_id = auth.uid())
  ));
create policy "dm_messages_participant_insert" on fluxo_dm_messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from fluxo_dm_conversations c
      where c.id = conversation_id and (c.member_a_id = auth.uid() or c.member_b_id = auth.uid())
    )
  );
create policy "dm_messages_participant_update" on fluxo_dm_messages for update
  using (exists (
    select 1 from fluxo_dm_conversations c
    where c.id = conversation_id and (c.member_a_id = auth.uid() or c.member_b_id = auth.uid())
  ));

create policy "post_likes_select" on fluxo_post_likes for select
  using (fluxo_is_active_member());
create policy "post_likes_insert_own" on fluxo_post_likes for insert
  with check (member_id = auth.uid());
create policy "post_likes_delete_own" on fluxo_post_likes for delete
  using (member_id = auth.uid());
