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

### DEC-009 — Prova física postergada, avanço paralelo
- **Data**: 2026-05-21
- **Decisão**: Avançar com Sprints 2+ sem aguardar a prova física de impressão. O gate continua pendente e será executado quando Ricardo acessar o PC da cozinha (via AnyDesk ou presencialmente).
- **Motivo**: PC da impressora está na cozinha, Ricardo está na sala. Não faz sentido bloquear o desenvolvimento. A página de teste já está pronta e funcional.
- **Alternativas descartadas**: Bloquear todo o desenvolvimento até a prova física (improdutivo).
