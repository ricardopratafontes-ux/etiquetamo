# Migração EtiquetaMO → schema `etiqueta` do projeto principal

> ## ✅ CONCLUÍDA em 20/07/2026, ~12h
>
> Produção rodando no schema `etiqueta` do projeto principal. Verificado: 14/14 tabelas
> com checksum idêntico após o delta; leitura, escrita e a fila de OP (caminho service
> role) testadas na produção real.
>
> **O banco antigo (`lztybrrkrbdnijevroyg`) continua vivo e intacto.** Rollback até
> **03/08/2026** = reverter as 4 envs da Vercel (ver seção 5).
>
> ### 🛑 NÃO PAUSAR NEM DELETAR ESSE PROJETO (revisão de 27/07/2026)
>
> No mesmo dia 20/07/2026 esse projeto foi **reaproveitado como o banco dedicado da
> Família Prata** — outro app, outro dono, em produção (`familia_*` no schema `public`,
> ~184 linhas: 25 pessoas, 95 registros de histórico, contribuições, contas e acervo).
> Ver `ESTADO.md` da Família Prata.
>
> Pausar ou deletar o projeto **derruba/apaga a Família Prata**.
>
> A limpeza correta, depois de 03/08, é apagar **apenas as 14 tabelas do etiqueta**
> dentro do `public` desse projeto (`organizations`, `operators`, `admins`, `categories`,
> `items`, `print_history`, `admin_logs`, `allowed_ips`, `production_orders`,
> `production_order_items`, `avulsa_history`, `omie_quarantine`, `omie_print_queue`,
> `omie_sync_log`) — **nunca** as `familia_*`, e nunca o projeto inteiro.
>
> Pendências abertas na seção "Depois".

**Decisão (20/07/2026):** o projeto Supabase próprio do etiquetamo (`lztybrrkrbdnijevroyg`)
é desativado; o app passa a viver no schema `etiqueta` do projeto principal
(`svruwxhbpuobmcifrjcp`).

O schema é **AUTOCONTIDO** de propósito: o EtiquetaMO é candidato a produto vendido e
precisa sair inteiro num `pg_dump -n etiqueta`. **Nunca** criar FK, view ou trigger
cruzando para os schemas `moderna` ou `public`. A duplicação com `moderna.produtos` é
intencional — o casamento continua sendo por código Omie, via ponte.

---

## Estado atual (feito)

- [x] Schema `etiqueta` criado: 14 tabelas, 21 índices, 5 triggers, função
      `etiqueta.update_updated_at()` própria.
- [x] 1.811 linhas migradas. 14/14 contagens conferidas, 13/14 checksums idênticos
      (`items` divergiu em 1 linha por deriva de origem viva — o webhook do Omie gravou
      `omie_product_id` durante a carga; some no delta).
- [x] RLS ligado nas 14 tabelas. **0 policies, sem grant pro anon** — nasceu fechado.
- [x] Código adaptado: `SUPABASE_SCHEMA` (env `NEXT_PUBLIC_SUPABASE_SCHEMA`, default
      `public`) aplicado nos 5 pontos de `createClient`. Build passa, comportamento
      inerte confirmado (resposta byte-a-byte idêntica com e sem `Accept-Profile`).

## Pré-requisito manual

- [ ] **Expor o schema:** projeto principal → Settings → API → Exposed schemas →
      adicionar `etiqueta` ao lado de `moderna`. Sem isso o PostgREST não serve o schema.
      Seguro fazer a qualquer momento: o schema está sem grants, expor não expõe nada.

---

## Janela

Evidência de 45 dias:
- Impressão concentrada 7h–18h (picos 10h e 17–18h). Entre 19h e 6h: **1 impressão**.
- Webhooks do Omie: seg–sáb. **Domingo: zero.**

→ **Após 19h em dia útil, ou domingo.** Não precisa de mecanismo de freeze: a janela é
escolhida onde não há tráfego. Deploy e delta levam ~5 min.

---

## Roteiro do flip

### 1. Grants e policies (replica fielmente a origem)

```sql
grant usage on schema etiqueta to anon, authenticated, service_role;
grant all on all tables in schema etiqueta to anon, authenticated, service_role;
alter default privileges in schema etiqueta
  grant all on tables to anon, authenticated, service_role;

-- policies abertas, idênticas às da origem (lift-and-shift: o flip é no-op)
create policy allow_read_organizations on etiqueta.organizations for select using (true);

create policy allow_read_categories   on etiqueta.categories for select using (true);
create policy allow_insert_categories on etiqueta.categories for insert with check (true);

create policy allow_read_items   on etiqueta.items for select using (true);
create policy allow_insert_items on etiqueta.items for insert with check (true);

create policy operators_select on etiqueta.operators for select using (true);
create policy operators_insert on etiqueta.operators for insert with check (true);
create policy operators_update on etiqueta.operators for update using (true);

create policy print_history_select on etiqueta.print_history for select using (true);
create policy print_history_insert on etiqueta.print_history for insert with check (true);

create policy avulsa_select on etiqueta.avulsa_history for select using (true);
create policy avulsa_insert on etiqueta.avulsa_history for insert with check (true);
```

**Sem policy (só service role), igual à origem:** `omie_print_queue`, `omie_quarantine`,
`omie_sync_log`, `admins`, `admin_logs`, `allowed_ips`, `production_orders`,
`production_order_items`.

> ⚠️ `production_orders` / `production_order_items` estão com RLS ligado e 0 policies **na
> origem também**, mas o app as acessa pelo navegador com a anon key. O módulo
> **/producao já está quebrado em produção hoje** — isso é anterior à migração e está
> sendo replicado de propósito. Consertar em separado, não nesta janela.

### 2. Trocar a env na Vercel (projeto etiquetamo)

| Variável | De | Para |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://lztybrrkrbdnijevroyg.supabase.co` | `https://svruwxhbpuobmcifrjcp.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon do etiquetamo | anon do principal |
| `SUPABASE_SERVICE_ROLE_KEY` | service do etiquetamo | service do principal |
| `NEXT_PUBLIC_SUPABASE_SCHEMA` | *(não existe)* | `etiqueta` |

Deploy em seguida.

### 3. Delta (depois do deploy, para pegar o que entrou no banco antigo até a virada)

Upsert por `id` — nunca truncar, senão apaga o que o app já gravou no destino.
Transporte pelo método que funcionou: staging `public._mig_etiqueta(tabela, dados jsonb)`
no destino + shell lendo a origem por REST com a service key. `jq` NÃO existe na máquina
(envelopar com `printf` + `cat`).

### 4. Smoke test

- `/itens` lista 548 itens
- `/imprimir` carrega operadores e catálogo
- `/historico` mostra os últimos registros
- Imprimir 1 etiqueta de teste → confere linha nova em `etiqueta.print_history`
- Ponte do Painel: catalogar 1 balde → confere linha em `etiqueta.omie_print_queue`

### 5. Rollback

Reverter as 4 envs e redeployar. O banco antigo continua intacto e recebendo — só voltar
a apontar. Por isso o schema vai por env, não por código.

---

## Depois (fora desta janela)

- Derrubar as pontes HTTP: `Painel/app/gestao/catalogar/acoes.ts:105,151` vira escrita
  direta, e a cunhagem (`src/app/api/fila/cunhar/route.ts:38` → Edge Function) vira **uma
  RPC atômica**. Esse é o ganho real da fusão: hoje a etiqueta pode imprimir e a gravação
  do outro lado falhar, deixando o lote órfão. As pontes continuam funcionando depois do
  flip, então não há pressa.
- Aposentar `ETQ_BRIDGE_URL`, `MO_BRIDGE_TOKEN`, `PAINEL_CUNHAGEM_URL`, `PAINEL_CUNHAGEM_KEY`.
- ~~Pausar o projeto `lztybrrkrbdnijevroyg` por ~2 semanas, depois deletar.~~
  **CANCELADO (27/07/2026):** o projeto agora é o banco da **Família Prata** em produção.
  Pausar ou deletar apaga aquele app. Depois de 03/08, apagar **só as 14 tabelas do
  etiqueta** dentro dele — ver o aviso 🛑 no topo deste arquivo.
- Consertar o módulo /producao (quebrado desde antes da migração).
- `avulsa_history` foi criada fora do versionamento (não está nas migrations 001–006 nem
  em `types/database.ts`) — regularizar.
- Auth de verdade: o app não tem nenhuma (PIN `4109` hardcoded no bundle, autoria de
  impressão forjável). É trabalho de produto, junto com o endurecimento do RLS.
