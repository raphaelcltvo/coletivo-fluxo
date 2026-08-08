-- Coletivo · Fluxo — Temas e Assuntos: fluxo_themes ganha uma hierarquia de
-- dois níveis (tema → assunto), com o tema Cliente sincronizado
-- automaticamente do cadastro de clientes. Também fecha uma lacuna real de
-- privacidade: as tabelas filhas de fluxo_posts liberavam select pra
-- qualquer membro ativo, mesmo quando o post é privado.

create table if not exists fluxo_theme_groups (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  tone text not null default 'brand',
  created_at timestamptz not null default now()
);
alter table fluxo_theme_groups enable row level security;
create policy "theme_groups_select" on fluxo_theme_groups for select
  using (fluxo_is_active_member());
create policy "theme_groups_admin_insert" on fluxo_theme_groups for insert
  with check (fluxo_is_admin());
create policy "theme_groups_admin_update" on fluxo_theme_groups for update
  using (fluxo_is_admin()) with check (fluxo_is_admin());
create policy "theme_groups_admin_delete" on fluxo_theme_groups for delete
  using (fluxo_is_admin());

-- fluxo_themes passa a ser "assuntos": cada linha pertence a um tema.
-- O nome da tabela no banco não muda — evita reescrever fluxo_post_tags e
-- fluxo_alert_tags, que já referenciam theme_id.
alter table fluxo_themes add column if not exists group_id text references fluxo_theme_groups(id) on delete set null;
alter table fluxo_themes add column if not exists client_id text references fluxo_clients(id) on delete cascade;

-- Seed dos 3 temas iniciais.
insert into fluxo_theme_groups (id, name, tone) values
  ('grp-cliente', 'Cliente', 'brand'),
  ('grp-job', 'Job', 'teal'),
  ('grp-categoria', 'Categoria', 'amber')
on conflict (id) do nothing;

-- Migra as tags soltas de hoje (ex: "Dash") pra dentro do tema Categoria.
update fluxo_themes set group_id = 'grp-categoria' where group_id is null;

-- Sincroniza um assunto no tema Cliente pra cada cliente já cadastrado.
insert into fluxo_themes (id, name, tone, group_id, client_id)
  select gen_random_uuid()::text, c.name, 'brand', 'grp-cliente', c.id
  from fluxo_clients c
  where not exists (select 1 from fluxo_themes t where t.client_id = c.id);

-- ---------------------------------------------------------------------------
-- Privacidade real: fluxo_posts já restringe select corretamente (audience
-- 'todos' / autor / admin / destinatário), mas as tabelas filhas liberavam
-- pra qualquer membro ativo — inclusive o texto das respostas de uma
-- thread privada. Helper único, reusado nas 5 tabelas.
-- ---------------------------------------------------------------------------
create or replace function fluxo_can_see_post(pid text) returns boolean as $$
  select exists (
    select 1 from fluxo_posts p
    where p.id = pid and (
      p.audience = 'todos' or p.author_id = auth.uid() or fluxo_is_admin()
      or exists (select 1 from fluxo_post_recipients r where r.post_id = p.id and r.member_id = auth.uid())
    )
  );
$$ language sql security definer stable;

drop policy if exists "post_tags_select" on fluxo_post_tags;
create policy "post_tags_select" on fluxo_post_tags for select
  using (fluxo_can_see_post(post_id));

drop policy if exists "post_recipients_select" on fluxo_post_recipients;
create policy "post_recipients_select" on fluxo_post_recipients for select
  using (fluxo_can_see_post(post_id));

drop policy if exists "post_reads_select" on fluxo_post_reads;
create policy "post_reads_select" on fluxo_post_reads for select
  using (fluxo_can_see_post(post_id));

drop policy if exists "post_replies_select" on fluxo_post_replies;
create policy "post_replies_select" on fluxo_post_replies for select
  using (fluxo_can_see_post(post_id));

drop policy if exists "post_likes_select" on fluxo_post_likes;
create policy "post_likes_select" on fluxo_post_likes for select
  using (fluxo_can_see_post(post_id));
