-- Privacidade real: conversas privadas (Threads e DMs) não podem ser vistas
-- por admin que não seja autor/destinatário. DMs já funcionavam assim; agora
-- Threads privadas seguem a mesma regra.
drop policy if exists posts_select on fluxo_posts;
create policy posts_select on fluxo_posts for select using (
  fluxo_is_active_member() and (
    audience = 'todos' or author_id = auth.uid()
    or exists (select 1 from fluxo_post_recipients r where r.post_id = fluxo_posts.id and r.member_id = auth.uid())
  )
);

create or replace function fluxo_can_see_post(pid text) returns boolean as $$
  select exists (
    select 1 from fluxo_posts p
    where p.id = pid and (
      p.audience = 'todos' or p.author_id = auth.uid()
      or exists (select 1 from fluxo_post_recipients r where r.post_id = p.id and r.member_id = auth.uid())
    )
  );
$$ language sql security definer stable;

-- Ordem de exibição dos temas (Cliente > Job > Categoria), fixa em vez de
-- depender da ordem física das linhas (que hoje sai alfabética por id).
alter table fluxo_theme_groups add column if not exists sort_order integer not null default 0;
update fluxo_theme_groups set sort_order = case id
  when 'grp-cliente' then 1
  when 'grp-job' then 2
  when 'grp-categoria' then 3
  else sort_order
end;
