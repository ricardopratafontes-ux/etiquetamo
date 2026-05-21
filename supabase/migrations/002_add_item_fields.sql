-- Migration 002: Campos adicionais na tabela items
-- Rodar no Supabase SQL Editor

-- Unidade de medida (UN, KG, L, ML, etc.)
ALTER TABLE items ADD COLUMN unit TEXT DEFAULT 'UN';

-- Peso liquido (texto livre: "500g", "1.5kg", "200ml")
ALTER TABLE items ADD COLUMN net_weight TEXT;

-- Tipo de armazenagem
ALTER TABLE items ADD COLUMN storage_type TEXT DEFAULT 'ambiente'
  CHECK (storage_type IN ('refrigerado', 'congelado', 'ambiente'));

-- Etiqueta complementar (segunda etiqueta na mesma linha)
ALTER TABLE items ADD COLUMN uses_complementary_label BOOLEAN DEFAULT false;

-- Texto padrao da etiqueta complementar
ALTER TABLE items ADD COLUMN complementary_label_text TEXT;
