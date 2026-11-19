# Logs do servidor

Esta página explica como ler logs do servidor Marinara Engine e escrever linhas úteis. Complementa a [seção Logging do CONTRIBUTING.md](../../CONTRIBUTING.md#logging), sem substituí-la. Continuam valendo o logger Pino compartilhado, objeto de erro primeiro, especificadores de formato e tabela de quatro níveis.

<a id="what-every-line-carries"></a>

## O que cada linha contém

Todas as linhas do servidor vêm de uma instância Pino: `logger` em `packages/server/src/lib/logger.ts`. Fastify usa a mesma instância por `loggerInstance`, então `req.log`, `reply.log` e `app.log` são filhos dela. Compartilham serializadores e acompanham a recarga de `LOG_LEVEL` pelo observador de ambiente.

| Campo | Presente em | Significado |
| --- | --- | --- |
| `pid` | toda linha | ID do processo (padrão do Pino). |
| `hostname` | toda linha | Nome do host (padrão do Pino). |
| `bootId` | toda linha | 8 caracteres hexadecimais novos a cada início. Separam execuções no mesmo arquivo de log. |
| `requestId` | toda linha causada por uma solicitação | Mesmo valor do cabeçalho de resposta `x-request-id`. Aparece nas linhas de `req.log` e do `logger` compartilhado nos serviços. |
| `route` | linhas após analisar o corpo | Padrão de rota correspondente, como `/api/chats/:id`. Nunca guarda a URL bruta. |

<a id="request-ids"></a>

### IDs de solicitação

`lib/request-logging.ts` atribui um ID a cada solicitação:

- O cliente pode enviar `x-request-id`. O servidor preserva de 8 a 80 caracteres de `A-Z a-z 0-9 . _ : -`; outros valores são substituídos.
- Caso contrário, cria um UUID. O contador padrão `req-1` do Fastify reiniciava a cada execução, repetindo IDs.
- O ID volta no cabeçalho `x-request-id`, exposto por CORS. Pode ser citado no relato de bug, e `grep <id>` encontra todas as linhas da solicitação.

O ID fica em um contexto `AsyncLocalStorage` (`lib/log-context.ts`). Um mixin Pino copia-o para cada linha. Não é preciso passá-lo adiante: `logger.warn(err, "...")` dentro de um serviço o recebe automaticamente. O contexto é definido novamente após analisar o corpo, porque isso ocorre no contexto assíncrono próprio do parser HTTP.

O contexto acompanha tudo iniciado na solicitação, incluindo temporizadores, listeners e processos filhos. Para trabalho que sobrevive à solicitação, envolva seu início em `runWithRootLogContext({}, fn)`, evitando que linhas futuras carreguem o ID original. O sidecar local faz isso com llama-server e MLX, e os sidecars Decision e Utility também iniciam assim, para um processo compartilhado por solicitações futuras não manter o primeiro ID. Outros trabalhos duradouros iniciados numa rota ainda carregam seu `requestId` até receberem o mesmo tratamento.

<a id="request-lines"></a>

### Linhas de solicitação

`RequestLogController` é o `LogController` padrão do Fastify com estas mudanças:

- O rótulo é `requestId`, não `reqId`. Buscas salvas e filtros de `reqId` precisam do novo nome.
- Linhas `incoming request` e `Route ... not found` removem parâmetros de consulta, que podem conter token ou texto buscado. A linha de entrada mantém os outros campos de `req` (`method`, `version`, `host`, `remoteAddress`, `remotePort`) e acrescenta `route`.
- Se o cliente fecha cedo, uma linha `Client aborted request` é registrada em info. Fastify não registrava nada nesse caso.

`LOG_DISABLE_REQUEST_LOGGING` funciona como antes e desliga também a linha de cancelamento.

Em `pnpm dev`, pino-pretty oculta `hostname` (seu padrão) e `bootId`. O JSON de produção mantém ambos.

<a id="startup-timeline"></a>

## Linha do tempo de inicialização

`lib/startup-timeline.ts` mede cada etapa:

```ts
const db = await startup.phase("storage.open", () => getDB());
```

- Cada linha contém `event: "startup.phase"`, `stage`, `elapsedMs` (tempo decorrido) e `selfMs` (tempo próprio, sem fases internas). O nível segue `selfMs`: debug abaixo de 1 s, info acima de 1 s e warn acima de 15 s. Com o padrão `LOG_LEVEL=warn`, um início normal, mesmo a primeira execução lenta, não imprime linhas de fase.
- As fases são aninhadas. `app.build` em `index.ts` envolve todas as fases de `buildApp`. Como o nível usa `selfMs`, uma etapa interna lenta é relatada uma vez por ela mesma; `app.build` continua em debug salvo se seu trabalho próprio fora das fases for lento.
- A etapa com falha não registra dentro da fase. O erro sobe intacto e `main().catch` em `index.ts` escreve uma linha `startup.failed` identificando a etapa (`startup.stageOf(err)`).
- Quando o servidor escuta, `index.ts` escreve uma linha info `[startup] Ready in N ms`, com `event: "startup.ready"`, quantidade de fases e as cinco etapas de maior `selfMs`.

Fases não acrescentam `stage` ao contexto de log. Serviços iniciados numa fase mantêm temporizadores, que do contrário carregariam essa etapa por toda a vida do processo.

<a id="one-line-per-failure"></a>

## Uma linha por falha

Uma falha deve produzir exatamente uma linha, escrita pelo código que decide o próximo passo.

- **Registre ou relance, não ambos.** Ao relançar, deixe o chamador registrar. Detalhes úteis vão em debug, como o nome de ferramenta em `[agent-tools] ... failed`.
- **Onde fica a linha:**
  - erros 500 desconhecidos: `middleware/error-handler.ts`
  - falhas de agente: `executeAgent` (warn, falha não crítica)
  - geração de chat com falha: catch principal de `generate.routes.ts`
  - O provedor correspondente lança sem registrar. No máximo acrescenta uma linha debug com modelo e erro bruto, como Grok CLI e Claude (Subscription). Claude (Subscription) lança mensagem amigável que já contém o erro do SDK, sem anexá-lo também como `cause`: o erro SSE do chat e o texto do agente acrescentam a mensagem da causa e duplicariam o texto.
- **Cancelamentos são info.** Parada do usuário, aba fechada ou sinal abortado são resultados esperados. Use `failureLevel(err)` ou `failureLevel(err, "warn")` de `lib/log-context.ts`. Retorna `"info"` quando `isCancellation(err)` é true. Um `TimeoutError` é falha real, não cancelamento.

  ```ts
  logger[failureLevel(err)](err, "[agent-batch] Batch call FAILED: %s", errMsg);
  ```

- **Preserve a causa.** Envolva com `new Error("Could not save chat", { cause: err })`. Serializadores `err` e `error` acrescentam mensagem e pilha da causa (`caused by: ...`). Um Error registrado como `{ error }` também é serializado e não aparece mais como `{}`.

<a id="repeating-failures"></a>

## Falhas repetidas

Consultas periódicas, verificações de saúde e hooks por turno podem falhar da mesma forma a cada poucos segundos. Use `logRateLimited` de `lib/log-rate-limit.ts`:

```ts
logRateLimited("warn", "autonomous-scheduler:poll", err, "[autonomous-scheduler] Poll failed");
```

A primeira ocorrência da chave é escrita. As seguintes dentro da janela (60 s por padrão) são contadas, e a próxima linha contém `suppressedRepeats`. Inclua na chave o item que falha, como ID de pacote ou chat, para que um item problemático não esconda outro.

<a id="prompt-and-model-text"></a>

## Texto de prompts e modelos

Prompts, saída do modelo, corpos de resposta de provedor e de consultas vão em **debug**, nunca warn ou error. Podem conter a história do usuário, e corpos do provedor podem repetir credenciais ou prompt. Em warn, registre tamanho (`rawLength`, `bodyLength`) e motivo. Uma mensagem de erro JSON pode citar o texto que falhou: registre só o tipo de erro em warn. Ponha o erro e o texto numa linha debug separada:

```ts
logger.warn(
  { errorType: err instanceof Error ? err.name : typeof err, rawLength: raw.length },
  "[game/scene-wrap] Failed to parse LLM response as JSON",
);
logger.debug({ err }, "[game/scene-wrap] Unparsed LLM response: %s", raw.slice(0, 200));
```

O ajuste de debug da interface continua funcionando por `logDebugOverride`. Esse é o caminho previsto para ver prompts quando `LOG_LEVEL` oculta debug.

A mídia embutida aparece de forma abreviada no log. `debugJson` troca cada conteúdo base64 por um marcador como `[image/png base64, ~1.2 MB: iVBORw0KGgoAAAA...ElFTkSuQmCC]`, com o tipo, o tamanho e os primeiros e últimos 16 caracteres. Isso inclui URLs `data:` (a string inteira ou dentro de um texto) e campos `data` sem prefixo nas partes de mídia da Anthropic e do Google, mesmo se o base64 ocupar várias linhas. O serializador `msg` faz o mesmo com URLs `data:` em linhas comuns com `%s` e `%j`. Só `debugJson` abrevia um campo `data` sem prefixo. A mudança só afeta a cópia impressa. O valor recebido permanece intacto. Defina `LOG_INLINE_MEDIA=full` no `.env` para voltar a imprimir o conteúdo inteiro. O teste de regressão `log-inline-media` cobre esse comportamento.

<a id="checks"></a>

## Console no aplicativo

Abra **Settings → Advanced → Open Console** (Configurações → Avançado → abrir console) para ver no aplicativo as linhas recentes do servidor quando você não tem acesso ao terminal (NAS, VPS, Docker, Termux).

- `lib/log-buffer.ts` mantém as últimas 1.500 linhas na memória, até cerca de 4 milhões de caracteres. Cada mensagem e cada bloco de campos são cortados em 16 mil caracteres. Nada é gravado em disco, e reiniciar esvazia o buffer.
- `logger.ts` copia cada linha serializada pelo `hooks.streamWrite` do Pino. O buffer guarda o que chegou ao terminal ou ao arquivo de log, no mesmo `LOG_LEVEL`. As linhas que passam fora do Pino, como a linha `injected env` do dotenv ou a saída bruta de um processo filho, ficam fora do buffer.
- `GET /api/admin/logs?afterId=` retorna as linhas após `afterId`, além de `latestId`, `truncated` (linhas foram descartadas antes da leitura) e o `logLevel` do servidor. A rota exige `requirePrivilegedAccess` e usa `no-store`. Ela roda com `logLevel: "silent"`, então as consultas periódicas do console não aparecem no próprio log.
- As regras de registro desta página também valem aqui. Um administrador remoto lê no aplicativo tudo que você registra em warn ou error, portanto mantenha prompts e corpos das solicitações e respostas dos provedores em debug.

## Verificações

As regressões `logging-request-trail`, `logging-failure-lines` e `logging-startup-timeline` cobrem esta página, e `server-console-logs` cobre o console no aplicativo:

```sh
node scripts/run-regressions.mjs --filter logging-
```
