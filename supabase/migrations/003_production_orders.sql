-- Migration 003: Ordens de Produção (Sprint 3)
-- Rodar no Supabase SQL Editor
-- Ref: DEC-018

-- Status possíveis: planejado → em_producao → concluido → cancelado
CREATE TABLE production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  title TEXT NOT NULL,                          -- ex: "Produção 21/05/2026 - Manhã"
  status TEXT NOT NULL DEFAULT 'planejado'
    CHECK (status IN ('planejado', 'em_producao', 'concluido', 'cancelado')),
  created_by TEXT NOT NULL,                     -- nome do gestor/operador que criou
  started_at TIMESTAMPTZ,                       -- quando moveu para em_producao
  completed_at TIMESTAMPTZ,                     -- quando moveu para concluido
  notes TEXT,                                   -- observações livres
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cada item dentro da ordem
CREATE TABLE production_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES production_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id),
  quantity INTEGER NOT NULL DEFAULT 1,          -- quantas etiquetas imprimir
  lot TEXT,                                     -- lote definido na criação, revalidável na impressão
  operator_initials TEXT,                       -- preenchido pelo operador na hora de imprimir
  printed BOOLEAN DEFAULT false,                -- marca se já foi impresso
  printed_at TIMESTAMPTZ,                       -- quando imprimiu
  notes TEXT,                                   -- obs por item
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX idx_po_org_status ON production_orders(organization_id, status);
CREATE INDEX idx_poi_order ON production_order_items(order_id);
CREATE INDEX idx_poi_item ON production_order_items(item_id);

-- RLS básico (ativar depois)
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_order_items ENABLE ROW LEVEL SECURITY;
