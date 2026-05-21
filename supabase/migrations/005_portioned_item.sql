-- 005_portioned_item.sql
-- Adiciona campo "fracionável" aos itens
-- Itens fracionados podem ser abertos/porcionados com nova data de validade

ALTER TABLE items ADD COLUMN is_portioned BOOLEAN DEFAULT false;

COMMENT ON COLUMN items.is_portioned IS 'Indica se o item é fracionável (aberto/porcionado gera nova validade)';
