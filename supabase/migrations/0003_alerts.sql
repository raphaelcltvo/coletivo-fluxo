-- Coletivo · Fluxo — Alertas manuais (broadcast pra equipe) + réguas que
-- podem criar Alerta + Novidades passa a suportar múltiplas tags por post.

-- ---------------------------------------------------------------------------
-- NOVIDADES: de "1 tema por post" pra "múltiplas tags por post"
-- ---------------------------------------------------------------------------
alter table fluxo_posts drop column if exists theme_id;

create table if not exists fluxo_post_tags (
  post_id text not null references fluxo_posts(id) on delete cascade,
  theme_id text not null references fluxo_themes(id) on delete cascade,
  primary key (post_id, theme_id)
);
alter table fluxo_post_tags enable row level security;
create policy "post_tags_select" on fluxo_post_tags for select
  using (fluxo_is_active_member());
create policy "post_tags_insert" on fluxo_post_tags for insert
  with check (fluxo_is_active_member());
create policy "post_tags_delete_own" on fluxo_post_tags for delete
  using (
    exists (select 1 from fluxo_posts p where p.id = post_id and (p.author_id = auth.uid() or fluxo_is_admin()))
  );

-- ---------------------------------------------------------------------------
-- FLUXO_ALERTS — alertas manuais criados pelo admin
-- ---------------------------------------------------------------------------
create table if not exists fluxo_alerts (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text default '',
  alert_type text not null check (alert_type in ('relatorio', 'comunicacao')),
  client_ids jsonb not null default '[]',
  destino jsonb not null default '{}',
  scheduled_date date not null,
  repeat_freq text not null default 'nenhuma' check (repeat_freq in ('nenhuma', 'diaria', 'semanal', 'mensal')),
  status text not null default 'agendado' check (status in ('agendado', 'enviado')),
  created_by uuid not null references fluxo_profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists fluxo_alerts_scheduled_idx on fluxo_alerts (scheduled_date);

create table if not exists fluxo_alert_tags (
  alert_id text not null references fluxo_alerts(id) on delete cascade,
  theme_id text not null references fluxo_themes(id) on delete cascade,
  primary key (alert_id, theme_id)
);

alter table fluxo_alerts enable row level security;
alter table fluxo_alert_tags enable row level security;

create policy "alerts_select" on fluxo_alerts for select
  using (fluxo_is_active_member());
create policy "alerts_admin_insert" on fluxo_alerts for insert
  with check (fluxo_is_admin());
create policy "alerts_admin_update" on fluxo_alerts for update
  using (fluxo_is_admin()) with check (fluxo_is_admin());
create policy "alerts_admin_delete" on fluxo_alerts for delete
  using (fluxo_is_admin());

create policy "alert_tags_select" on fluxo_alert_tags for select
  using (fluxo_is_active_member());
create policy "alert_tags_admin_write" on fluxo_alert_tags for insert
  with check (fluxo_is_admin());
create policy "alert_tags_admin_delete" on fluxo_alert_tags for delete
  using (fluxo_is_admin());

-- ---------------------------------------------------------------------------
-- FLUXO_DEMANDS ganha o vínculo com o alerta que a gerou
-- ---------------------------------------------------------------------------
alter table fluxo_demands add column if not exists alert_id text references fluxo_alerts(id) on delete set null;
create index if not exists fluxo_demands_alert_idx on fluxo_demands (alert_id);

-- ---------------------------------------------------------------------------
-- RÉGUAS DE COMUNICAÇÃO — podem criar um Alerta em vez de só notificação
-- ---------------------------------------------------------------------------
alter table fluxo_communication_rules add column if not exists action text not null default 'notificacao' check (action in ('notificacao', 'alerta'));
alter table fluxo_communication_rules add column if not exists alert_type text check (alert_type in ('relatorio', 'comunicacao'));
alter table fluxo_communication_rules add column if not exists alert_tag_ids jsonb not null default '[]';
