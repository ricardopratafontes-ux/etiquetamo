# DECISIONS.md — Registro de Decisões Arquiteturais

## Formato
Cada decisão segue: Data | Decisão | Motivo | Alternativas descartadas

---

### DEC-001 — Stack tecnológica congelada
- **Data**: 2026-05-21
- **Decisão**: Next.js App Router + TypeScript strict + Tailwind CSS + Supabase + Vercel
- **Motivo**: Stack moderna, produtiva, com deploy simplificado e banco gerenciado. Decisão do Ricardo, congelada — nenhuma tecnologia adicional sem validação explícita.
- **Alternativas descartadas**: Vite + React (sem SSR nativo), Prisma + PostgreSQL externo (mais complexo que Supabase).

### DEC-002 — Etiqueta 50mm × 50mm com 2 por linha
- **Data**: 2026-05-21
- **Decisão**: Cada etiqueta individual mede exatamente 50mm × 50mm. A bobina tem 2 etiquetas lado a lado.
- **Motivo**: Dimensão real da bobina usada na Elgin L42 Pro. Não confundir com 50mm × 25mm.
- **Alternativas descartadas**: Nenhuma — é especificação física do insumo.

### DEC-003 — Prova física de impressão como gate do Sprint 1
- **Data**: 2026-05-21
- **Decisão**: Nenhuma funcionalidade além de setup avança sem uma etiqueta real impressa na Elgin L42 Pro.
- **Motivo**: Impressão é a funcionalidade mais crítica do sistema. Validar early evita retrabalho.
- **Alternativas descartadas**: Avançar para cadastro sem teste físico (risco de descobrir problemas de impressão tarde demais).

### DEC-004 — Multi-tenant leve desde o início
- **Data**: 2026-05-21
- **Decisão**: Toda tabela terá `organization_id` desde a V1.
- **Motivo**: Permitir expansão para franquias sem reescrita do banco de dados.
- **Alternativas descartadas**: Single-tenant (limitaria crescimento futuro).

### DEC-005 — Três canais de cadastro de itens
- **Data**: 2026-05-21
- **Decisão**: Itens podem ser cadastrados via OMIE, planilha (CSV/Excel) ou formulário manual.
- **Motivo**: Nem todos os itens existem no OMIE (ex.: ingredientes manipulados). Flexibilidade operacional.
- **Alternativas descartadas**: OMIE exclusivo (não cobre itens operacionais).

### DEC-006 — Operador sem senha, seleção rápida
- **Data**: 2026-05-21
- **Decisão**: Operadores selecionam nome em lista, sem digitação de senha. Sessão expira após inatividade.
- **Motivo**: Ambiente de cozinha — mãos sujas, luvas, velocidade é prioridade. Segurança via allowlist de IPs.
- **Alternativas descartadas**: Login com senha para operador (impraticável na cozinha).

### DEC-007 — Estratégia de impressão: window.print() agora, print server depois
- **Data**: 2026-05-21
- **Decisão**: Sprint 1 usa window.print() no navegador do PC onde a impressora está conectada. Sprint 3 evolui para um print server local (micro-serviço HTTP no PC da impressora).
- **Motivo**: A Elgin L42 Pro está conectada via USB a um PC separado. WebUSB exigiria que o navegador estivesse no mesmo PC com USB direto — ainda é o caso (o operador abre o browser naquele PC). Print server será adicionado quando precisarmos imprimir de outros dispositivos.
- **Alternativas descartadas**: WebUSB direto (só funciona no PC com USB), Google Cloud Print (descontinuado), impressão direta do servidor Vercel (impossível — impressora é local).

### DEC-008 — Remoção de Google Fonts em favor de system fonts
- **Data**: 2026-05-21
- **Decisão**: Não usar next/font/google. Usar fontes do sistema (Arial, Helvetica, sans-serif).
- **Motivo**: O PC da cozinha pode ter internet instável. System fonts garantem renderização imediata sem dependência externa. Menos bytes, mais rápido.
- **Alternativas descartadas**: Google Fonts via next/font (dependência de rede no build/runtime).

### DEC-010 — Layout da etiqueta: prioridade de fontes
- **Data**: 2026-05-21
- **Decisão**: Na etiqueta impressa, o nome do produto usa a maior fonte. Datas de fabricação e validade usam a segunda maior fonte. Demais campos (lote, info adicional, QR, operador) usam a menor fonte.
- **Motivo**: Em etiquetas 50mm × 50mm, legibilidade do nome é crítica para identificação rápida na cozinha. Datas são o segundo dado mais consultado. Detalhes ficam menores.
- **Alternativas descartadas**: Fonte uniforme para todos (dificulta leitura rápida), nome pequeno com QR grande (QR é complementar, não primário).

### DEC-011 — Campo EAN (GTIN) separado do código interno
- **Data**: 2026-05-21
- **Decisão**: O campo `barcode` armazena o código EAN/GTIN do produto, separado do `code` (código interno). No formulário, aparecem como campos distintos: "Código" e "Código EAN (GTIN)".
- **Motivo**: O código interno é livre (ex: SORV-001) e usado operacionalmente. O EAN é o código de barras padrão brasileiro (13 dígitos) usado para rastreabilidade e eventualmente para o QR code da etiqueta.
- **Alternativas descartadas**: Campo único para ambos (confunde códigos de naturezas diferentes).

### DEC-012 — Limite de 80 caracteres na informação adicional
- **Data**: 2026-05-21
- **Decisão**: O campo "Informação Adicional" do item tem limite de 80 caracteres, com contador visual no formulário.
- **Motivo**: O espaço na etiqueta 50mm × 50mm é limitado. Textos longos ficariam ilegíveis ou cortados na impressão.
- **Alternativas descartadas**: Sem limite (risco de quebra de layout na etiqueta), limite menor de 40 chars (muito restritivo para alergênicos compostos).

### DEC-015 — Logo "mo!" na etiqueta (substituir texto ilegível)
- **Data**: 2026-05-21
- **Decisão**: O texto "EtiquetaMO" no canto inferior direito da etiqueta é ilegível na impressão térmica. Substituído por imagem da logo "mo!" reduzida (LOGO_REDUZIDA.png → /public/logo-mo.png) com opacity 0.6 e height 6mm.
- **Motivo**: Feedback da prova física — texto em 4.5pt é ilegível na Elgin L42 Pro. Logo visual funciona melhor.
- **Alternativas descartadas**: Aumentar fonte do texto (ocuparia muito espaço); remover marca completamente (perde identidade).

### DEC-016 — Layout dinâmico: espaço redistribuído quando info está vazia
- **Data**: 2026-05-21
- **Decisão**: Quando o campo "info adicional" está vazio, as fontes de nome e datas aumentam (nome 16pt, datas 11pt, lote 9pt). Com info, encolhem levemente (nome 15pt, datas 9.5pt, lote 8pt, info 7pt). O espaço disponível é sempre maximizado.
- **Motivo**: Feedback do Ricardo — datas precisam ser mais legíveis, e quando não há informação extra o espaço deve ser aproveitado.
- **Alternativas descartadas**: Tamanho fixo sempre (desperdício de espaço quando sem info).

### DEC-017 — Etiqueta de caixa: tipo separado com fluxo próprio
- **Data**: 2026-05-21
- **Decisão**: Criar um segundo tipo de etiqueta exclusivo para identificar caixas. Campos: nome do produto (grande), quantidade, campo opcional (lote ou fabricação). Fluxo e rota separados das etiquetas de produto.
- **Motivo**: Caixas têm finalidade diferente (identificação de volume, não de unidade). Misturar os fluxos geraria confusão operacional.
- **Alternativas descartadas**: Usar a mesma etiqueta de produto para caixas (campos diferentes, propósito diferente).

### DEC-013 — Segunda etiqueta nunca sai em branco
- **Data**: 2026-05-21
- **Decisão**: Na bobina de 2 etiquetas por linha, a segunda posição SEMPRE repete o conteúdo da primeira. Nunca sai etiqueta em branco. Isso vale para impressão unitária, em lote, e reimpressão.
- **Motivo**: Decisão do Ricardo. Etiqueta em branco é desperdício de bobina e confusão operacional.
- **Alternativas descartadas**: Deixar segunda posição vazia quando só 1 item (desperdiça bobina); permitir dois itens diferentes na mesma linha (complexidade sem benefício real no fluxo da cozinha).

### DEC-014 — Layout de impressão: driver não controla colunas
- **Data**: 2026-05-21
- **Decisão**: O driver da Elgin L42 Pro trata a bobina como papel contínuo de largura única. A divisão em 2 colunas de 50mm com gap de 3mm é 100% controlada pelo CSS/HTML do EtiquetaMO, não pelo driver.
- **Motivo**: Driver não tem opção de "2 etiquetas por linha". Configuração no driver: largura 103mm (printável) + margens 2mm esquerda/direita = 107mm total. Altura 50mm (ou 52.5mm se sensor de gap precisar).
- **Alternativas descartadas**: Nenhuma — é limitação do hardware/driver.

### DEC-018 — Sprint 3: Impressão via Ordem de Produção (não direto do cadastro)
- **Data**: 2026-05-21
- **Decisão**: Etiquetas NÃO são impressas diretamente da tela de itens. O fluxo é: (1) Gestor ou operador cria uma Ordem de Produção com itens + quantidades + lote; (2) ao mover para "em produção", as etiquetas aparecem no site prontas para o operador revisar (lote, iniciais) e enviar para impressão.
- **Motivo**: Produtos são cadastrados via planilha e raramente mudam. A impressão está ligada à produção diária, não ao cadastro. Separar os dois evita impressões acidentais e conecta a etiqueta ao contexto real de fabricação.
- **Regras operacionais**:
  - Gestor E operador podem criar ordens de produção
  - Quantidade e lote são definidos na criação da ordem
  - Na tela de impressão, operador pode revalidar lote e informar iniciais
  - Cadastro de novos itens continua sendo raro e feito via planilha/manual
- **Alternativas descartadas**: Impressão direta da lista de itens (desconectada da produção real, sem contexto de lote/quantidade do dia).

### DEC-019 — Regras operacionais de impressão e importação
- **Data**: 2026-05-21
- **Decisão**: Conjunto de regras de negócio definidas pelo Ricardo durante o preenchimento da planilha de importação:
- **Peso**:
  - Peso = 0,00 → perguntar ao usuário (implementar em futuro review de importação)
  - Peso preenchido → aceitar e imprimir na etiqueta (zona de info, junto com lote)
  - NÃO PERECÍVEL → nunca perguntar peso, não exigir armazenagem
  - Categoria FOOD SERVICE → nunca mostrar peso na etiqueta
- **Dois operadores na impressão** (obrigatórios):
  - "Quem fez a produção" → iniciais vão na etiqueta (quadrado 5mm×5mm)
  - "Quem está imprimindo" → registrado no histórico, NÃO vai na etiqueta
  - Formato no banco: `produtor|impressor` no campo operator_initials
- **Etiqueta complementar** = Sim apenas habilita o recurso; o conteúdo é preenchido sob demanda
- **Responsável** removido da importação CSV; o responsável é definido na hora da impressão (produtor + impressor)
- **Motivo**: Regras derivadas da operação real da cozinha. Dois operadores existem porque nem sempre quem fabrica é quem imprime.
- **Alternativas descartadas**: Campo único de operador (não distingue produtor de impressor).

### DEC-020 — Campo "Item Fraciona" (fracionamento/porcionamento)
- **Data**: 2026-05-21
- **Decisão**: Adicionado campo booleano `is_portioned` na tabela items. Indica que o item pode ser fracionado/porcionado (aberto), gerando nova data de validade. Coluna na planilha: "ITEM FRACIONA" (última posição).
- **Motivo**: Muitos itens da gelateria são porcionados na cozinha — produto novo fracionado ou embalagem aberta com nova validade. Identificar esses itens no cadastro é necessário para futuras regras de reimpressão com nova data.
- **Alternativas descartadas**: Não rastrear fracionamento (perde controle de validade pós-abertura). Campo `expiry_days_portioned` foi considerado mas adiado — será adicionado quando o fluxo de fracionamento for desenhado.

### DEC-021 — Lote do fabricante + validade do pacote como teto
- **Data**: 2026-05-21
- **Decisão**: Para itens que NÃO são da família FOOD SERVICE nem PRODUÇÃO e possuem lote (`uses_lot = true`):
  1. O lote informado na impressão é o **lote do fabricante** (impresso no balde/saco/pacote). O operador digita manualmente. O UI deve deixar claro que é "Lote do Fabricante".
  2. Ao informar o lote, aparece um **popup perguntando a data de validade** impressa no saco/pacote original.
  3. **Regra de validade**: a data final da etiqueta é **a menor** entre:
     - Data calculada pelo sistema (data de fabricação + dias de validade do item)
     - Data de validade do pacote informada pelo operador
  4. Quem vencer primeiro prevalece — sempre a menor.
- **Motivo**: Produtos recebidos de fornecedores já têm validade impressa. Quando a validade do pacote é mais curta que a calculada, ela deve ser o limite. Isso evita imprimir etiquetas com validade maior que a do insumo original.
- **Alternativas descartadas**: Ignorar validade do pacote (risco de etiqueta com data além do fabricante); usar sempre a validade do pacote (ignora a regra do produto manipulado).

### DEC-009 — Prova física postergada, avanço paralelo
- **Data**: 2026-05-21
- **Decisão**: Avançar com Sprints 2+ sem aguardar a prova física de impressão. O gate continua pendente e será executado quando Ricardo acessar o PC da cozinha (via AnyDesk ou presencialmente).
- **Motivo**: PC da impressora está na cozinha, Ricardo está na sala. Não faz sentido bloquear o desenvolvimento. A página de teste já está pronta e funcional.
- **Alternativas descartadas**: Bloquear todo o desenvolvimento até a prova física (improdutivo).
