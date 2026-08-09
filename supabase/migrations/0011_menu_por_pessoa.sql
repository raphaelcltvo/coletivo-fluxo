-- Permite ao admin delimitar quais itens do menu cada pessoa não-admin vê.
-- null = usa o padrão (Threads, Minhas demandas, Lembretes). Configurações e
-- Equipe & Acessos nunca entram aqui — continuam travados só pra admin no
-- próprio código do app, não fazem parte do conjunto configurável.
alter table fluxo_profiles add column if not exists allowed_tabs jsonb;
