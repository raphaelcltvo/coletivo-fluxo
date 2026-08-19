-- Cada notificação carrega o tipo de e-mail que deve virar (kind) e os
-- dados prontos pro template (data) — a Edge Function não precisa
-- reconsultar nada, só renderizar.
alter table fluxo_notifications add column if not exists kind text not null default 'generico';
alter table fluxo_notifications add column if not exists data jsonb not null default '{}';
