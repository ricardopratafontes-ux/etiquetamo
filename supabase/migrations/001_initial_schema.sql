-- ============================================================
-- EtiquetaMO — Schema Inicial (Sprint 1)
-- Multi-tenant leve: toda tabela tem organization_id
-- ============================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ORGANIZAÇÕES (multi-tenant leve)
-- ============================================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- OPERADORES (seleção rápida, sem senha)
-- ============================================================
CREATE TABLE operators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operators_org ON operators(organization_id);

-- ============================================================
-- ADMINS (autenticação forte — via Supabase Auth)
-- ============================================================
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  auth_user_id UUID NOT NULL UNIQUE, -- referência ao auth.users do Supabase
  name TEXT NOT NULL,
  pin_hash TEXT, -- PIN opcional (hash bcrypt)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admins_org ON admins(organization_id);

-- ============================================================
-- CATEGORIAS DE ITENS
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  -- Perfil operacional padrão da categoria
  uses_label BOOLEAN NOT NULL DEFAULT true,
  uses_lot BOOLEAN NOT NULL DEFAULT false,
  uses_expiry BOOLEAN NOT NULL DEFAULT true,
  default_expiry_days INTEGER, -- validade padrão em dias (ex: 7, 30)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_org ON categories(organization_id);

-- ============================================================
-- ITENS (produtos, ingredientes, etc.)
-- ============================================================
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Identificação
  name TEXT NOT NULL,
  code TEXT, -- código interno ou OMIE
  barcode TEXT, -- código de barras (se houver)

  -- Origem do cadastro
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'spreadsheet', 'omie')),
  omie_product_id BIGINT, -- ID do produto no OMIE (se aplicável)

  -- Perfil operacional (sobrescreve categoria se definido)
  uses_label BOOLEAN, -- null = herda da categoria
  uses_lot BOOLEAN, -- null = herda da categoria
  uses_expiry BOOLEAN, -- null = herda da categoria
  expiry_days INTEGER, -- null = herda da categoria

  -- Informações adicionais para a etiqueta
  additional_info TEXT, -- ex: "Contém glúten", "Sem lactose"

  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Proteção: campos operacionais marcados como manuais não são sobrescritos por sync OMIE
  manual_override BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_items_org ON items(organization_id);
CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_items_omie ON items(omie_product_id) WHERE omie_product_id IS NOT NULL;

-- ============================================================
-- HISTÓRICO DE IMPRESSÕES
-- ============================================================
CREATE TABLE print_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES operators(id) ON DELETE CASCADE,

  -- Dados da etiqueta no momento da impressão (snapshot)
  product_name TEXT NOT NULL,
  fabrication_date DATE NOT NULL,
  expiry_date DATE,
  lot TEXT,
  additional_info TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,

  -- Metadados
  printed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  printer_info TEXT, -- nome/IP da impressora usada
  reprint_of UUID REFERENCES print_history(id) -- se for reimpressão, aponta para a original
);

CREATE INDEX idx_print_history_org ON print_history(organization_id);
CREATE INDEX idx_print_history_item ON print_history(item_id);
CREATE INDEX idx_print_history_operator ON print_history(operator_id);
CREATE INDEX idx_print_history_date ON print_history(printed_at);

-- ============================================================
-- LOGS ADMINISTRATIVOS
-- ============================================================
CREATE TABLE admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_logs_org ON admin_logs(organization_id);
CREATE INDEX idx_admin_logs_date ON admin_logs(created_at);

-- ============================================================
-- IPs AUTORIZADOS (allowlist de operação)
-- ============================================================
CREATE TABLE allowed_ips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ip_address INET NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_allowed_ips_org ON allowed_ips(organization_id);

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_operators_updated_at BEFORE UPDATE ON operators FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_admins_updated_at BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED: Organização padrão para desenvolvimento
-- ============================================================
INSERT INTO organizations (name, slug) VALUES ('Gelateria Artesanal', 'gelateria');
