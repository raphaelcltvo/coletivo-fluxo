-- Coletivo · Fluxo — aba Novidades (timeline interna) + onboarding do primeiro acesso
-- Projeto dedicado (kqakmfrhrvjdemadkqtx) — segue o mesmo padrão de prefixo fluxo_
-- usado em 0001_init.sql.

alter table fluxo_profiles add column if not exists onboarded_at timestamptz;

-- ---------------------------------------------------------------------------
-- FLUXO_THEMES — temas cadastrados pelo admin, usados pra marcar os posts
-- ---------------------------------------------------------------------------
create table if not exists fluxo_themes (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  tone text not null default 'muted' check (tone in ('muted','amber','teal','red','brand')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- FLUXO_POSTS — a timeline em si (tema + cliente opcionais, audiência)
-- ---------------------------------------------------------------------------
create table if not exists fluxo_posts (
  id text primary key default gen_random_uuid()::text,
  author_id uuid not null references fluxo_profiles(id) on delete cascade,
  theme_id text references fluxo_themes(id) on delete set null,
  client_id text references fluxo_clients(id) on delete set null,
  audience text not null default 'todos' check (audience in ('todos', 'pessoas')),
  message text not null,
  created_at timestamptz not null default now()
);
create index if not exists fluxo_posts_created_idx on fluxo_posts (created_at desc);

-- ---------------------------------------------------------------------------
-- FLUXO_POST_RECIPIENTS — quando audience = 'pessoas', quem recebe
-- ---------------------------------------------------------------------------
create table if not exists fluxo_post_recipients (
  post_id text not null references fluxo_posts(id) on delete cascade,
  member_id uuid not null references fluxo_profiles(id) on delete cascade,
  primary key (post_id, member_id)
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table fluxo_themes enable row level security;
alter table fluxo_posts enable row level security;
alter table fluxo_post_recipients enable row level security;

-- themes: qualquer membro ativo lê; só admin cria/edita/apaga
create policy "themes_select" on fluxo_themes for select
  using (fluxo_is_active_member());
create policy "themes_admin_write" on fluxo_themes for insert
  with check (fluxo_is_admin());
create policy "themes_admin_update" on fluxo_themes for update
  using (fluxo_is_admin()) with check (fluxo_is_admin());
create policy "themes_admin_delete" on fluxo_themes for delete
  using (fluxo_is_admin());

-- posts: vê quem é "todos", o autor, admin, ou quem foi marcado como destinatário
create policy "posts_select" on fluxo_posts for select
  using (
    fluxo_is_active_member() and (
      audience = 'todos'
      or author_id = auth.uid()
      or fluxo_is_admin()
      or exists (select 1 from fluxo_post_recipients r where r.post_id = fluxo_posts.id and r.member_id = auth.uid())
    )
  );
create policy "posts_insert" on fluxo_posts for insert
  with check (fluxo_is_active_member() and author_id = auth.uid());
create policy "posts_update_own" on fluxo_posts for update
  using (author_id = auth.uid() or fluxo_is_admin());
create policy "posts_delete_own" on fluxo_posts for delete
  using (author_id = auth.uid() or fluxo_is_admin());

-- post_recipients: qualquer membro ativo lê/insere (baixo risco, só mostra quem foi marcado)
create policy "post_recipients_select" on fluxo_post_recipients for select
  using (fluxo_is_active_member());
create policy "post_recipients_insert" on fluxo_post_recipients for insert
  with check (fluxo_is_active_member());
create policy "post_recipients_delete_own" on fluxo_post_recipients for delete
  using (
    exists (select 1 from fluxo_posts p where p.id = post_id and (p.author_id = auth.uid() or fluxo_is_admin()))
  );
