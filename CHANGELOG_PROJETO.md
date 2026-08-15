# CHANGELOG_PROJETO.md — Registro de Mudanças Incrementais

## Formato
Data | Mudança | Motivo | Impacto

---

### 2026-08-15 — Sync de produtos OMIE consertado (nunca funcionou desde 22/05)
- **Mudança**: (1) **Causa raiz**: `ListarProdutos` era chamado sem `filtrar_apenas_omiepdv: "N"`. Sem esse campo o Omie responde HTTP 200 com `total_de_registros: 0` em vez de dar erro — comprovado contra a conta real: sem o campo, 0 produtos; com o campo, 888. (2) `listarProdutos` restaurado em `src/lib/omie.ts` com o payload correto, mais `listarTodosProdutos` (paginação serializada, retenta a MESMA página em vez de pular, aborta após 3 falhas iguais pra não derrubar a app_key). (3) Nova rota `/api/omie/sync` **somente-atualização**: nunca faz INSERT em `items`. (4) Varredura vazia/incompleta agora é HTTP 500 com motivo escrito em `details`. (5) Nova tela `/omie` com banner de falha, histórico das 20 últimas execuções e botão "Sincronizar agora". (6) Cron diário às 6h em `vercel.json`. (7) DEC-038, DEC-039, DEC-040 registradas.
- **Motivo**: Um produto novo (GELATO 5L BALDE SNICKERS) foi produzido e a impressão travou porque o EtiquetaMO não conhecia o item. Investigando: `omie_sync_log` tinha 11 execuções, todas de 22/05/2026, todas com `total_omie = 0` e `errors = 0`. A função "concluía com sucesso" trazendo zero produtos e ninguém via.
- **Impacto**: 105 itens que estavam sem `omie_product_id` foram vinculados (agora são **zero** sem vínculo); 5 códigos corrigidos. Nenhum `expiry_days` e nenhum `name` alterado (verificado contra snapshot). Quem **cria** item continua sendo o Painel de Controle — esta varredura é o cinto de segurança, não a criadora, senão os dois escritores duplicariam o catálogo. Requer `CRON_SECRET` configurado na Vercel.

### 2026-08-15 — Fila de OP religa sozinha por código Omie
- **Mudança**: (1) `GET /api/fila/op` religa linha pendente sem `item_id` casando `webhook_payload.event.nCodProd` com `items.omie_product_id`, e grava o vínculo (guarda `.is("item_id", null)` pra não sobrescrever vínculo manual). (2) O sync corrige os `product_name` genéricos `"Produto OMIE #..."` da fila usando o catálogo já carregado, sem chamada extra ao Omie. (3) DEC-041 registrada.
- **Motivo**: A OP do 5L SNICKERS chegou às 14:03 e o item só nasceu às 14:12 — a linha ficou órfã com "Item não vinculado" travando a impressão. O auto-vincular existente casava por NOME e o nome era o genérico, então não achava nada, apesar do código Omie estar guardado na própria linha.
- **Impacto**: A linha travada foi religada ao item certo (verificado: `nCodProd` bate com `omie_product_id`, 0 vínculos divergentes em 626 linhas). 43 nomes genéricos corrigidos; sobram 2, que são eventos malformados (`nCodProd = 0`) já descartados. Fila pendente sem vínculo: 1 → 0.

### 2026-12-02 — Sprint 1b: Autenticação SSO com Intranet + mudança de domínio
- **Mudança**: (1) Novo domínio de produção: `https://etiqueta.gelateriamoderna.com.br/` (antes: etiquetamo.vercel.app). (2) Middleware (`middleware.ts`) agora redireciona sem cookie pra `/login`. (3) Páginas convertidas de client-side pra server-side com validação via `requerAutenticacao()`. (4) Libs de auth: `intranet-auth.ts` (HMAC-SHA256, cópia do Painel), `perfil.ts` (validação + permissões), `api-auth.ts` (proteção de endpoints). (5) Nova página `/login` que linka pra intranet. (6) Endpoint `/api/auth/logout` com botão na NavBar. (7) Perfis autorizados: master, gerente, supervisor, producao, atendente. TTL: 30 dias. (8) APIs protegidas: `/api/fila/op`, `/api/fila/cunhar`, `/api/fila/confirmar-impressao`. APIs abertas (máquina↔máquina): `/api/omie/webhook`, `/api/fila/catalogo`, `/api/fila/reimprimir`. (9) DEC-035, DEC-036, DEC-037 registradas.
- **Motivo**: Ricardo solicitou usar auth compartilhada com Painel/Comercial via Intranet. Segurança + operação unificada.
- **Impacto**: Produção agora exige login Intranet. PC da cozinha (e qualquer acesso) redireciona pra intranet.gelateriamoderna.com.br/intranet. Bridge (`etiquetamo.vercel.app`) continua vivo para OMIE webhook e pontes.

### 2026-05-21 — Deploy automático via Vercel + GitHub
- **Mudança**: (1) Repositório Git inicializado e pushado para GitHub (ricardopratafontes-ux/etiquetamo). (2) Vercel conectada ao repositório com deploy automático a cada push. (3) Variáveis de ambiente configuradas na Vercel. (4) URL de produção: https://etiquetamo.vercel.app/ (mudou 02/12 pra etiqueta.gelateriamoderna.com.br)
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
