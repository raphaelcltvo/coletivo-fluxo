-- Ordem manual dos cards dentro de cada coluna do board (posição fracionária,
-- técnica clássica de Trello: só o card movido precisa ser atualizado).
alter table fluxo_demands add column if not exists board_order double precision not null default 0;

-- Arquivar em vez de excluir de vez.
alter table fluxo_demands add column if not exists archived_at timestamptz;
