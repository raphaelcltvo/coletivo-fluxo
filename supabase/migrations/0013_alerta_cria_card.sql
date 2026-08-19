-- Independente do tipo (relatório/comunicação), o admin decide na criação
-- do alerta se ele vira um card em Demandas quando disparar.
alter table fluxo_alerts add column if not exists creates_card boolean not null default true;
update fluxo_alerts set creates_card = (alert_type = 'relatorio') where true;
