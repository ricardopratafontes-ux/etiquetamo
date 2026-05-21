-- Migration 004: Campo "Etiqueta de contagem" na tabela items
-- Rodar no Supabase SQL Editor

ALTER TABLE items ADD COLUMN uses_counting_label BOOLEAN DEFAULT false;
