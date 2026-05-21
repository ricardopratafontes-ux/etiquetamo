# CHANGELOG_PROJETO.md — Registro de Mudanças Incrementais

## Formato
Data | Mudança | Motivo | Impacto

---

### 2026-05-21 — Deploy automático via Vercel + GitHub
- **Mudança**: (1) Repositório Git inicializado e pushado para GitHub (ricardopratafontes-ux/etiquetamo). (2) Vercel conectada ao repositório com deploy automático a cada push. (3) Variáveis de ambiente configuradas na Vercel. (4) URL de produção: https://etiquetamo.vercel.app/
- **Motivo**: Deploy manual é frágil. CI/CD automático garante que a versão em produção está sempre sincronizada com o código.
- **Impacto**: Todo git push faz deploy automático em ~1 min. Ricardo pode testar em produção a qualquer momento.

### 2026-05-21 — Início do projeto (estado zero)
- **Mudança**: Criação dos arquivos de governança (CLAUDE.md, DECISIONS.md, OPEN_QUESTIONS.md, CHANGELOG_PROJETO.md).
- **Motivo**: Estabelecer base documental antes de qualquer código.
- **Impacto**: Nenhum impacto técnico. Base para rastreabilidade de decisões.

### 2026-05-21 — Setup Next.js + Tailwind + TypeScript
- **Mudança**: Projeto Next.js 16 criado com App Router, TypeScript strict, Tailwind CSS 4. Paleta de cores do EtiquetaMO aplicada no globals.css. Página inicial e página de teste de impressão criadas.
- **Motivo**: Sprint 1 — configuração base do ambiente.
- **Impacto**: Estrutura de pastas definida (src/app). Deploy pronto após `npm install`.

### 2026-05-21 — Schema SQL inicial do Supabase
- **Mudança**: Criado `supabase/migrations/001_initial_schema.sql` com tabelas: organizations, operators, admins, categories, items, print_history, admin_logs, allowed_ips. Multi-tenant leve (organization_id em todas).
- **Motivo**: Definir estrutura de dados antes de qualquer implementação de funcionalidade.
- **Impacto**: Schema pronto para execução no Supabase. Seed com organização padrão "Gelateria Artesanal".

### 2026-05-21 — Página de teste de impressão
- **Mudança**: Rota `/teste-impressao` com etiqueta estática 50mm x 50mm, 2 por linha, usando window.print() + CSS @media print. Inclui checklist pós-impressão.
- **Motivo**: Gate do Sprint 1 — prova física de impressão na Elgin L42 Pro.
- **Impacto**: Pronta para teste no ambiente real da cozinha.

### 2026-05-21 — Build validado + estratégia de impressão remota
- **Mudança**: (1) Removido Google Fonts em favor de system fonts. (2) Build Next.js 16 passou sem erros (3 rotas: /, /_not-found, /teste-impressao). (3) Documentada estratégia de impressão remota (impressora USB em outro PC). (4) package-lock.json gerado.
- **Motivo**: Build precisa compilar sem dependências externas. Impressora confirmada como USB em PC separado — ajuste na arquitetura de impressão.
- **Impacto**: Projeto pronto para npm install + npm run dev na máquina do Ricardo. Prova física de impressão será feita abrindo o EtiquetaMO no navegador do PC da impressora.

### 2026-05-21 — Print Server local + integração na página de teste
- **Mudança**: (1) Criado print-server/ com micro-serviço Node.js HTTP (porta 9100) que recebe HTML e imprime via driver Windows. (2) Dois .bat de inicialização: um com Node instalado, outro portátil (baixa Node automaticamente). (3) Página /teste-impressao atualizada com dois modos: Local (window.print) e Remoto (via print server). (4) No modo remoto: campo de IP, botão testar, indicador de status, seleção de impressora. (5) Build validado sem erros. (6) LEIA-ME.md com guia completo de instalação.
- **Motivo**: Impressora USB em PC separado. Print server permite imprimir de qualquer dispositivo na mesma rede.
- **Impacto**: Ricardo pode copiar a pasta print-server/ para o PC da cozinha e rodar o .bat. Depois testa impressão remota pelo EtiquetaMO de qualquer browser.

### 2026-05-21 — Sprint 2: Refinamento de UI e campos
- **Mudança**: (1) Redesign completo de todas as páginas com cards, gradientes, toggle buttons, ícones. (2) Termos renomeados: "Nome do produto" → "Descrição", "Categoria" → "Família de Produto", "Código interno" → "Código", "Perfil Operacional" → "Perfil de Etiqueta". (3) Campo EAN (GTIN) adicionado ao formulário, importação e listagem. (4) Campos novos: unidade, peso líquido, tipo armazenagem (com temperaturas: Refrigerado = 5°C, Congelado = -14 a -22°C), etiqueta complementar. (5) Limite de 80 chars com contador no campo info adicional. (6) Ordem dos campos alinhada com exportação do app do Ricardo. (7) Modelo CSV atualizado com nova ordem e coluna EAN. (8) Listagem com badges de armazenagem, unidade/peso, EAN. (9) Decisões DEC-010, DEC-011, DEC-012 registradas.
- **Motivo**: Feedback do Ricardo sobre qualidade visual e alinhamento com fluxo operacional real.
- **Impacto**: Todas as 4 páginas de itens (novo, editar, importar, listagem) consistentes entre si.

### 2026-05-21 — Sprint 2 completo: Cadastro de itens
- **Mudança**: (1) Migration SQL executada no Supabase (tabelas criadas). (2) Configuração do client Supabase (.env.local + lib/supabase.ts). (3) Página /itens/novo — formulário manual com criação inline de categoria, presets de validade, checkboxes operacionais. (4) Página /itens — listagem com busca, filtro por categoria/status, toggle ativo/inativo, link para edição. (5) Página /itens/importar — upload CSV, parse automático de colunas (aceita variações de nome), preview, importação em lote com criação automática de categorias. (6) Página /itens/[id]/editar — formulário preenchido com dados do item, flag manual_override. (7) NavBar global com rotas ativas. (8) Build TypeScript validado (0 erros).
- **Motivo**: Sprint 2 — cadastro de itens é pré-requisito para impressão dinâmica (Sprint 3).
- **Impacto**: Sistema já permite cadastro manual e importação de produtos. Pronto para Sprint 3 (impressão dinâmica a partir dos itens cadastrados).

### 2026-05-21 — Sprint 5: Integração OMIE
- **Mudança**: (1) Credenciais OMIE em .env.local (app_key + app_secret). (2) Lib OMIE client (`src/lib/omie.ts`) com chamadas JSON-RPC genéricas. (3) API route `/api/omie/sync` para sincronização manual de produtos — match por `omie_product_id`, nunca sobrescreve nomes. (4) API route `/api/omie/webhook` para receber eventos de produção — padrão accept-and-store, retorna 2XX em <7s. (5) Migration 006 com tabelas `omie_quarantine`, `omie_print_queue`, `omie_sync_log`. (6) Página `/omie` com 3 abas: Sincronização (botão manual + resultado), Quarentena (itens desconhecidos), Fila de Impressão (ordens "Produzindo"). (7) DEC-032 a DEC-034 registradas.
- **Motivo**: Sprint 5 — integração com ERP OMIE para sincronizar produtos e receber ordens de produção automaticamente.
- **Impacto**: Sistema conectado ao OMIE. Versão v0.8.0.
