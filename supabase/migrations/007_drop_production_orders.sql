-- ADR-0006 acao 2 (aprovada pelo Ricardo 18/08/2026 apos verificacao de impacto):
-- remove o esboco de mini-PCP que nasceu dentro do EtiquetaMO (migration 003)
-- antes do PCP existir. Verificado antes de apagar: 0 linhas nas duas tabelas,
-- nenhuma FK externa, nenhuma view, nenhuma funcao de banco, nenhuma policy,
-- nenhum uso em codigo em nenhum dos 5 repositorios da suite (so definicoes de
-- tipo mortas em src/types/database.ts, removidas no mesmo commit).
-- As OPs reais moram no PCP (public.ordens_producao); a fila real de impressao
-- e etiqueta.omie_print_queue.
-- Aplicada via MCP apply_migration em 18/08/2026 (etiqueta_drop_production_orders_esboco).
drop table etiqueta.production_order_items;
drop table etiqueta.production_orders;
