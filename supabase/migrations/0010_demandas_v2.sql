-- Responsável passa a ser uma lista (múltiplas pessoas).
alter table fluxo_demands add column if not exists assignee_ids jsonb not null default '[]';
update fluxo_demands set assignee_ids = case when assignee_id is not null and assignee_id <> ''
  then jsonb_build_array(assignee_id) else '[]'::jsonb end
  where assignee_ids = '[]';

-- Tipos de demanda customizados, cadastrados pelo admin em Configurações.
create table if not exists fluxo_demand_types (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  created_at timestamptz not null default now()
);
alter table fluxo_demand_types enable row level security;
drop policy if exists "demand_types_select" on fluxo_demand_types;
create policy "demand_types_select" on fluxo_demand_types for select using (fluxo_is_active_member());
drop policy if exists "demand_types_admin_write" on fluxo_demand_types;
create policy "demand_types_admin_write" on fluxo_demand_types for all using (fluxo_is_admin()) with check (fluxo_is_admin());

create table if not exists fluxo_demand_type_fields (
  id text primary key default gen_random_uuid()::text,
  type_id text not null references fluxo_demand_types(id) on delete cascade,
  label text not null,
  field_type text not null check (field_type in ('texto','numero','selecao')),
  options jsonb not null default '[]',
  depends_on_field_id text references fluxo_demand_type_fields(id) on delete set null,
  depends_on_value text,
  sort_order integer not null default 0
);
alter table fluxo_demand_type_fields enable row level security;
drop policy if exists "demand_type_fields_select" on fluxo_demand_type_fields;
create policy "demand_type_fields_select" on fluxo_demand_type_fields for select using (fluxo_is_active_member());
drop policy if exists "demand_type_fields_admin_write" on fluxo_demand_type_fields;
create policy "demand_type_fields_admin_write" on fluxo_demand_type_fields for all using (fluxo_is_admin()) with check (fluxo_is_admin());

alter table fluxo_demands add column if not exists demand_type_id text references fluxo_demand_types(id) on delete set null;
alter table fluxo_demands add column if not exists custom_fields jsonb not null default '{}';

-- Bucket de anexos reais do briefing (vídeo, planilha, pdf, word, foto).
insert into storage.buckets (id, name, public, file_size_limit)
values ('fluxo-attachments', 'fluxo-attachments', true, 26214400)
on conflict (id) do nothing;
drop policy if exists "fluxo_attachments_insert" on storage.objects;
create policy "fluxo_attachments_insert" on storage.objects for insert
  with check (bucket_id = 'fluxo-attachments' and fluxo_is_active_member());
