# CLAUDE.md — Instruções para o Claude no projeto EtiquetaMO

## Identidade do Projeto
- **Nome**: EtiquetaMO
- **Tipo**: Sistema web para impressão de etiquetas térmicas em gelateria artesanal
- **Stack**: Next.js App Router, TypeScript (strict), Tailwind CSS, Supabase, Vercel
- **Impressora**: Elgin L42 Pro (térmica, etiquetas 50mm × 50mm, 2 por linha na bobina)

## Regras de Conduta
1. **Estado zero**: o projeto começou do zero absoluto. Nunca assuma artefatos pré-existentes.
2. **Governança obrigatória**: toda decisão arquitetural vai em `DECISIONS.md`, dúvidas em `OPEN_QUESTIONS.md`, mudanças em `CHANGELOG_PROJETO.md`.
3. **Formato de resposta**: cada entrega deve conter: (1) O que entendeu, (2) O que vai fazer, (3) Riscos, (4) Dúvidas (TODO VALIDAR), (5) Próximos passos.
4. **Impressão é prioridade absoluta**: qualquer decisão que atrase ou complique a impressão deve ser reconsiderada.
5. **Prova física obrigatória**: antes de avançar para Sprint 2, uma etiqueta real deve ser impressa na Elgin L42 Pro.
6. **Não inventar dados**: respostas devem ser baseadas nos requisitos documentados. Se há incerteza, registrar como TODO VALIDAR.
7. **Multi-tenant leve**: toda tabela deve ter `organization_id` desde o início.
8. **OMIE é referência, não dependência**: sistema funciona sem OMIE.
9. **Lote nunca é automático global**: sempre informado por item/produção.
10. **Sincronização OMIE nunca sobrescreve campos operacionais** definidos manualmente.

## Paleta de Cores
- Vermelho: #f31c40
- Verde claro: #c9e7bd
- Marrom: #98472d
- Bege claro: #fffaf2
- Branco: #ffffff
- Preto: #000000

## Estrutura de Sprints
- Sprint 1: Setup + prova física de impressão
- Sprint 2: Cadastro de itens (manual + planilha)
- Sprint 3: Impressão dinâmica
- Sprint 4: Histórico e reimpressão
- Sprint 5: Integração OMIE
- Sprint 6: Admin + logs + segurança
- Sprint 7: Relatórios básicos
- Sprint 8: Ajustes finos e testes

## Etiqueta V1 — Campos Obrigatórios
1. Nome do produto
2. Data de fabricação
3. Data de validade
4. Lote (se aplicável)
5. Informação adicional (ex.: "Contém glúten")
6. Mini QR code (link para rastreabilidade)

## Medidas da Etiqueta
- Individual: 50mm × 50mm (5cm × 5cm)
- Bobina: 2 etiquetas por linha (~100mm de largura total)
