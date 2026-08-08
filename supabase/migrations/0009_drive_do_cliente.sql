-- Link da pasta do Google Drive do cliente, embutido na tela de Relatórios.
alter table fluxo_clients add column if not exists drive_url text;
