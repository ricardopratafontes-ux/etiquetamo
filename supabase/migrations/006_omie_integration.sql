-- =============================================
-- Migration 006: Integração OMIE
-- Tabelas para quarentena de itens e fila de impressão
-- =============================================

-- Quarentena: itens vindos do OMIE que NÃO existem no EtiquetaMO
-- O operador precisa cadastrar manualmente antes de imprimir
CREATE TABLE IF NOT EXISTS omie_quarantine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  omie_product_id BIGINT NOT NULL,
  omie_code TEXT,
  product_name TEXT NOT NULL,
  unit TEXT,
  ean TEXT,
  raw_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'ignored')),
  resolved_item_id UUID REFERENCES items(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_omie_quarantine_org ON omie_quarantine(organization_id);
CREATE INDEX idx_omie_quarantine_status ON omie_quarantine(status);

-- Fila de impressão OMIE: ordens de produção que entraram em "Produzindo"
-- O operador decide quando imprimir
CREATE TABLE IF NOT EXISTS omie_print_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  omie_order_id BIGINT,
  omie_order_number TEXT,
  product_name TEXT NOT NULL,
  item_id UUID REFERENCES items(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  lot TEXT,
  webhook_payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'printed', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  printed_at TIMESTAMPTZ
);

CREATE INDEX idx_omie_print_queue_org ON omie_print_queue(organization_id);
CREATE INDEX idx_omie_print_queue_status ON omie_print_queue(status);

-- Registro de sincronizações manuais
CREATE TABLE IF NOT EXISTS omie_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('products', 'full')),
  total_omie INTEGER NOT NULL DEFAULT 0,
  matched INTEGER NOT NULL DEFAULT 0,
  quarantined INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_omie_sync_log_org ON omie_sync_log(organization_id);
