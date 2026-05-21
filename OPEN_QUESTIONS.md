# OPEN_QUESTIONS.md — Dúvidas em Aberto

## Formato
Cada dúvida segue: ID | Pergunta | Suposição atual | Status

---

### OQ-001 — Impressora em PC remoto via USB — como imprimir pelo sistema web?
- **Pergunta**: A Elgin L42 Pro está conectada via USB a um PC separado (não é o mesmo PC que acessa o sistema). Como o EtiquetaMO (rodando na Vercel/nuvem) vai enviar impressões para essa impressora?
- **Atualização 2026-05-21**: Ricardo confirmou que a impressora está em outro computador. Isso descarta WebUSB (que exige conexão USB direta no browser). As opções viáveis são:
  - **Opção A — window.print() remoto**: Operador abre o EtiquetaMO no navegador do PC da impressora e imprime via window.print(). Simples, sem instalação extra. Limitação: o operador precisa estar no PC da impressora.
  - **Opção B — Print Server local (recomendada)**: Um pequeno serviço (Node.js ou Python) roda no PC da impressora, recebe comandos HTTP do EtiquetaMO, e envia para a Elgin L42 Pro via driver Windows ou RAW. O EtiquetaMO chama esse serviço via API. Vantagem: imprime de qualquer dispositivo na rede.
  - **Opção C — Compartilhamento de impressora Windows**: A Elgin L42 Pro é compartilhada na rede via Windows. O operador imprime via window.print() de qualquer PC que tenha a impressora mapeada.
  - **Opção D — Google Cloud Print / similar**: Descartada (Google Cloud Print foi descontinuado).
- **Suposição atual**: Começar com Opção A (window.print() no PC da impressora) para a prova física do Sprint 1. Evoluir para Opção B (print server local) no Sprint 3.
- **Status**: PARCIALMENTE VALIDADO — impressora confirmada como USB em outro PC

### OQ-002 — Driver/protocolo da Elgin L42 Pro
- **Pergunta**: A Elgin L42 Pro usa ZPL, EPL, ESC/POS ou driver Windows nativo?
- **Suposição atual**: Provável que suporte ZPL ou ESC/POS. Investigar documentação técnica.
- **Status**: TODO VALIDAR

### OQ-003 — Supabase: projeto existente ou criar novo?
- **Pergunta**: Ricardo já tem um projeto Supabase criado ou devo orientar a criação?
- **Suposição atual**: Será necessário criar um novo projeto. Vou preparar o schema SQL para execução posterior.
- **Status**: TODO VALIDAR

### OQ-004 — Domínio/subdomínio para deploy Vercel
- **Pergunta**: O app será acessado por qual URL? Domínio próprio ou subdomínio Vercel?
- **Suposição atual**: Inicialmente usar o subdomínio padrão da Vercel (etiquetamo.vercel.app ou similar).
- **Status**: TODO VALIDAR

### OQ-005 — PIN opcional do admin
- **Pergunta**: O PIN do admin é numérico de quantos dígitos? É obrigatório ou opcional mesmo?
- **Suposição atual**: Opcional, 4-6 dígitos numéricos. Implementar como feature flag.
- **Status**: TODO VALIDAR

### OQ-006 — Tempo de expiração de sessão do operador
- **Pergunta**: O exemplo diz 5 minutos de inatividade. Esse é o valor confirmado?
- **Suposição atual**: 5 minutos. Configurável pelo admin.
- **Status**: TODO VALIDAR

### OQ-007 — QR Code: URL base para rastreabilidade
- **Pergunta**: Qual será a URL base do QR code na etiqueta? Ex.: `https://etiquetamo.app/r/{id}`
- **Suposição atual**: Usar a URL do deploy Vercel + rota `/rastreio/[id]`.
- **Status**: TODO VALIDAR

### OQ-008 — Credenciais OMIE (App Key / App Secret)
- **Pergunta**: Ricardo já tem as credenciais da API OMIE disponíveis?
- **Suposição atual**: Serão fornecidas quando chegarmos no Sprint 5.
- **Status**: TODO VALIDAR (Sprint 5)

### OQ-009 — Allowlist de IPs: quais IPs serão autorizados?
- **Pergunta**: Quais IPs da cozinha/escritório devem ter acesso ao modo operação?
- **Suposição atual**: Será configurado pelo admin no painel. Implementar no Sprint 6.
- **Status**: TODO VALIDAR (Sprint 6)

### OQ-010 — Etiqueta complementar: layout e regras
- **Pergunta**: Ricardo mencionou "etiquetas complementares" no wizard de impressão. Qual é o layout de uma etiqueta complementar? É diferente da normal (com campos específicos)?
- **Resolução temporária (DEC-029)**: Etiqueta complementar usa o mesmo layout/campos da Etiqueta Avulsa (nome, quantidade toggle, campos opcionais múltiplos, campo extra). Será diferenciada quando houver spec própria.
- **Status**: PARCIALMENTE RESOLVIDO — layout temporário definido, spec completa pendente
