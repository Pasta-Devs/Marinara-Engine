# Fundamentos do Engine: visão geral da série

Esta página descreve a contribuição de fundamentos do Engine (issue #6624). O trabalho começou como um pull request grande e foi dividido em oito PRs, A a H, para revisão independente. Todos aproveitam código que já funciona bem no Marinara Engine. Não renomeiam APIs existentes, substituem o logger compartilhado nem mudam convenções dos arquivos. Mudanças para todos são identificadas; o restante fica desligado até você ativar.

<a id="the-pull-requests"></a>

## Os pull requests

| PR | Conteúdo | Dependência |
| --- | --- | --- |
| **A** | Fundamentos: regressões isoladas, rastreamento de requisições e cronologia de inicialização, duas opções de lorebook, opções de robustez e diagnósticos de execução, bloqueio de inject na inicialização, controles de recursos, auxiliares de melhor esforço | Nenhuma (este PR) |
| **B** | Dev MCP para assistentes de programação (`tools/dev-mcp/`) | Nenhuma |
| **C** | Paleta Ctrl+K e painel "?" de atalhos (só cliente, sem controle) | Nenhuma |
| **D** | Correções revisadas do servidor, parte 1: rotas e middleware; recuperação do armazenamento, chat e geração, importadores, sidecars e SSRF | A |
| **E** | Correções revisadas do servidor, parte 2: serviços e armazenamento | A |
| **F** | Cache de prompts: marcador de assinatura Claude, atualização do Agent SDK, estrutura favorável ao cache, aviso antes de envio com pouco cache e diagnóstico | A |
| **G** | Trabalhos de geração que continuam com a aba fechada, visualizador de trabalhos e bandeja do console Windows | A (ação da paleta também precisa de C) |
| **H** | Diagnóstico e inicializador: integridade da compilação, telemetria de memória, arquivos de depuração de prompts, limite de chamadas em segundo plano, backup e abertura quando pronto, nova tentativa relacionada ao raciocínio desativado | A |

A, B e C são independentes e podem ser revisados em qualquer ordem. D a H vêm após A: usam seu registro de recursos (`isFeatureEnabled`, Settings > Advanced > Features), rastreamento de logs e auxiliares de melhor esforço, ou ampliam a cronologia e a rota de diagnóstico. Cada PR acrescenta controles, entradas no CHANGELOG e sua seção aqui.

Cada parte de A explica o que existe, o que é adicionado, o que fica igual, como verificar e como desligar ou reverter.

Padrões: mudanças em dados salvos, prompts, novas tentativas ou componentes iniciados ficam desligadas, por variável de ambiente ou **Settings > Advanced > Features** (Configurações > Avançado > Recursos, A6). Sem ativação, o comportamento anterior permanece. Correções, executor de testes e auxiliares adicionais não têm controle; isso é indicado em cada parte.

Reversão: os commits de A são ordenados e compartilham alguns arquivos (`app.ts`, `index.ts`, `runtime-config.ts`, `capability-module-runtime.service.ts`, `CHANGELOG.md`). Reverta do mais recente para trás para evitar conflitos.

A maioria das verificações usa o executor de regressões existente. Compile o pacote compartilhado uma vez (`pnpm build:shared`) e execute os comandos na raiz do repositório.

---

<a id="pr-a-foundations"></a>

# PR A: Fundamentos

> **Rebase sobre a atualização de modelos Decision.** As chamadas Decision já ocorrem dentro da requisição que as utiliza e carregam seu `requestId`. Os sidecars de decisão e utilidade iniciam no contexto raiz de logs; linhas posteriores não carregam o ID do primeiro solicitante. Um slot Decision com falha emite um aviso limitado em frequência, em vez de vários por turno. Cancelamentos ficam em info; afirmações descartadas são contadas em warn, com texto apenas em debug. O encerramento para ambos os sidecars em etapas nomeadas. Chamadas Decision não passam pelo wrapper de novas tentativas do provedor, evitando repetições duplicadas.

<a id="a1-test-harness-each-regression-file-runs-in-its-own-data-folder"></a>

## A1. Ambiente de testes: uma pasta de dados por arquivo de regressão

**O que existe.** `scripts/run-regressions.mjs` encontra regressões e as executa uma a uma por `runRegression()`, com tratamento de prazos e sinais (`terminateActiveChild`, `releaseActiveChild`, `FILE_TIMEOUT_MS`). Cada processo filho recebe todo o `process.env` do desenvolvedor. O servidor já redireciona `.env` por `MARINARA_ENV_FILE` (`getEnvFilePath()` em `packages/server/src/config/runtime-config.ts`); `e2e/start-servers.mjs` já isola seus servidores assim.

**O que é adicionado.** O auxiliar `regressionEnvironment(scratchDir)`. `runRegression()` cria uma pasta temporária por arquivo (`marinara-regression-*` no diretório temporário do sistema) e aponta `DATA_DIR`, `FILE_STORAGE_DIR` e `MARINARA_ENV_FILE` do filho para ela. A pasta é removida após sucesso, falha, prazo esgotado ou falha ao iniciar. Regressões sem isolamento próprio não leem mais o `.env` do desenvolvedor nem disputam a concessão de escrita dos dados reais.

**O que fica igual.** Funções, opções `--filter`/`--list`, prazos, resumo, scripts de `package.json` e CI. Regressões com valores próprios mantêm esses valores. Diferença visível: `DATA_DIR`, `FILE_STORAGE_DIR` e `MARINARA_ENV_FILE` exportados no shell são substituídos por arquivo, intencionalmente e apenas nos testes.

**Como verificar.**

```sh
node scripts/run-regressions.mjs --filter env-watcher
```

Depois, não deve restar nenhuma pasta `marinara-regression-*` no diretório temporário.

**Como desligar / reverter.** Sem controle: isolamento é o padrão. Reverter o commit do executor restaura o anterior; reverta antes os mais recentes, que compartilham apenas `CHANGELOG.md` e `CONTRIBUTING.md`. Uma exceção como `MARINARA_REGRESSION_INHERIT_STORAGE=1` precisaria de poucas linhas, mas não foi adicionada uma opção não solicitada.

---

<a id="a2-logging-follow-one-request-one-boot-and-one-failure"></a>

## A2. Logs: acompanhar uma requisição, uma inicialização e uma falha

**O que existe.** `packages/server/src/lib/logger.ts` exporta o `logger` Pino compartilhado. `protectTerminalLogger` impede falhas do servidor quando o terminal fecha; `logDebugOverride` sustenta a depuração na interface. Logging em `CONTRIBUTING.md` exige logger compartilhado, erro primeiro, especificadores de formato e quatro níveis; todos são mantidos. Em `app.ts`, `buildApp()` fornecia opções próprias ao Fastify, criando outro Pino no mesmo nível. Os IDs `req-1`/`req-2` reiniciavam a cada inicialização.

**O que é adicionado.** Detalhes em `docs/development/logging.md`, agora referenciado na seção Logging de `CONTRIBUTING.md`.

- Fastify usa o logger compartilhado (`loggerInstance: logger`). `req.log` compartilha serializadores e acompanha recargas de `LOG_LEVEL` via `followLogLevel`, cancelado ao fechar. É o comportamento já descrito em `CONTRIBUTING.md`.
- Toda linha causada por uma requisição contém `requestId`, inclusive nos serviços internos (`lib/log-context.ts`, contexto `AsyncLocalStorage` e mixin Pino). É um UUID ou `x-request-id` válido do cliente, devolvido no cabeçalho `x-request-id` para relatos de erro.
- Cada linha contém `bootId`, distinguindo inicializações no mesmo arquivo.
- Cronologia `lib/startup-timeline.ts`: etapas de `app.ts`/`index.ts` envolvidas por `startup.phase("name", fn)`. Uma linha info `[startup] Ready in N ms` lista as mais lentas; falhas de inicialização identificam a etapa.
- Uma linha por falha: provedores e ferramentas relançam sem registrar antes. Uma geração falha produz uma linha error. Paradas do usuário usam info via `failureLevel(err)`; a cadeia `cause` permanece.
- Falhas repetidas de verificações de saúde, consultas do agendador e contribuidores de contexto usam `logRateLimited` com `suppressedRepeats`.
- Saídas de modelos, pedidos de dados, corpos de tokens Spotify e consultas de vídeo passam a debug; warn mostra somente o tamanho.
- Três regressões: `logging-request-trail`, `logging-failure-lines`, `logging-startup-timeline`.

**O que fica igual.** Exportação e arquivo de `logger`, `protectTerminalLogger`, `logDebugOverride`, campos `pid`/`hostname` e chamadas `logger.*`/`req.log`. `LogController` do Fastify é estendido por subclasse, não substituído. `LOG_LEVEL` (padrão `warn`) e `LOG_DISABLE_REQUEST_LOGGING` continuam iguais. O console `pnpm dev` não mostra novos campos: pino-pretty oculta `bootId` e `hostname`. `CONTRIBUTING.md` só recebe acréscimos.

Mudanças detalhadas em `logging.md`:

- `requestId` substitui `reqId` do Fastify; filtros salvos para `reqId` precisam do novo nome.
- Linhas de entrada e rota não encontrada omitem a query string, que pode conter tokens. Outros campos `req` ficam; `route` é acrescentado.
- Nova linha info `Client aborted request`, também desativada por `LOG_DISABLE_REQUEST_LOGGING`.
- Etapa com tempo próprio `selfMs`, sem subetapas, acima de 15 s gera warn, visível no nível padrão. Há aninhamento (`app.build` envolve `buildApp`), mas o nível depende do tempo próprio: uma etapa lenta gera uma linha.

**Como verificar.**

```sh
node scripts/run-regressions.mjs --filter logging-
```

Ou inicie o servidor, envie uma requisição e procure o `x-request-id` retornado com `grep`.

**Como desligar / reverter.** `LOG_DISABLE_REQUEST_LOGGING=true` silencia requisições como antes; `LOG_LEVEL=warn` já oculta os novos info. Para remover tudo, reverta o commit de logs após os commits de código posteriores.

---

<a id="a3-performance"></a>

## A3. Desempenho

Ambas as opções ficam desligadas por padrão; assim, prompts e dados salvos são idênticos byte a byte. Documentadas em `.env.example` e na tabela Lorebooks de `docs/CONFIGURATION.md`.

<a id="a3a-stable-lorebook-group-winners-lorebook_stable_group_winners-switch-stablelorebookgrouppicks"></a>

### A3a. Vencedores estáveis de grupos de lorebook (`LOREBOOK_STABLE_GROUP_WINNERS`, controle `stableLorebookGroupPicks`)

**O que existe.** `applyGroupSelection()` em `packages/server/src/services/lorebook/keyword-scanner.ts` escolhe um vencedor ponderado por grupo de inclusão (`pickWeightedGroupEntry`), priorizando entradas persistentes. A fonte aleatória é injetável (`random`, padrão `Math.random`), facilitando a mudança. Sortear em cada geração pode mudar o vencedor sem outras alterações, modificando o prefixo do prompt e quebrando o cache do provedor.

**O que é adicionado.** `groupSeed` opcional em `applyGroupSelection` e `ScanOptions`. Ativado, `processLorebooks` passa o ID do chat: mesmos candidatos ativos, mesmo vencedor em cada turno desse chat. Chats e conjuntos diferentes continuam variando. O par existente `stableHash` + `createSeededRandom`, já usado por Active Context (Contexto ativo), foi movido sem alterações de `lorebooks.routes.ts` para `lorebook/seeded-random.ts` para compartilhar o gerador. Desde A6, também **Stable lorebook picks** (Seleções estáveis de lorebook); a variável de ambiente prevalece.

**O que fica igual.** Nomes e assinaturas com parâmetro opcional, persistência e pesos. A fonte injetada continua controlando condições probabilísticas; a semente decide os grupos quando ativada, fazendo Active Context coincidir com a geração. Desativada, sem semente e com o caminho anterior.

**Como verificar.** `node scripts/run-regressions.mjs --filter lorebook-group-seed` verifica variável e controle.

**Como desligar / reverter.** Deixe `LOREBOOK_STABLE_GROUP_WINNERS` sem definir e o controle desligado.

<a id="a3b-compact-stored-lorebook-scans-lorebook_compact_stored_scans"></a>

### A3b. Compactar análises de lorebook salvas (`LOREBOOK_COMPACT_STORED_SCANS`)

**O que existe.** Cada mensagem gerada guarda o texto completo das entradas ativas em `extra.lorebookScan`, na linha e em cada swipe. Active Context mostra o contexto exato, mas chats longos com lorebooks grandes aumentam muito as tabelas.

**O que é adicionado.** Ativada, a opção preserva o texto completo na linha e em todos os swipes da mensagem mais recente de assistente ou narrador, lida por Active Context e novas tentativas de agentes. Voltar ao swipe ainda mostra seu texto original. Análises de turnos de usuário imitado são compactadas e nunca ocupam essa posição. Mensagens antigas guardam apenas IDs, nomes, chaves e pontuações. A compactação nunca ocorre no salvamento da geração: uma tarefa em segundo plano compacta a mensagem anterior, uma fila de mensagens por vez. Falhas usam `logRateLimited` e são repetidas no próximo salvamento. Ao excluir mensagens recentes, Active Context (`lorebooks.routes.ts`) e novas tentativas (`retry-agents-route.ts` via `storedContentForTextlessScanEntries`) recorrem ao texto atual salvo da entrada. `scripts/compact-lorebook-scans.mjs` aplica a regra aos chats antigos: simulação por padrão, recusa durante a concessão de escrita do servidor e backup das duas tabelas antes de `--apply`.

**O que fica igual.** Desativada, não grava nada novo e mantém a estrutura. Formato e respostas de Active Context/nova tentativa permanecem; a substituição só ocorre sem texto. Duas correções padrão afetam análises antigas sem texto: Active Context exibe texto salvo em vez de vazio, e novas tentativas incluem essas entradas em vez de descartá-las.

**Como verificar.** `node scripts/run-regressions.mjs --filter lorebook-scan-compaction` cobre estrutura padrão, retorno a swipes, turnos imitados, varredura das mensagens antigas no primeiro salvamento, substituição pela rota real Active Context e script de manutenção.

**Como desligar / reverter.** Deixe `LOREBOOK_COMPACT_STORED_SCANS` sem definir ou em `false`. Mensagens já compactadas continuam assim; a mais recente mantém o texto. Backups de `--apply` restauram a estrutura anterior.

---

<a id="a4-robustness"></a>

## A4. Robustez

Todos estes comportamentos dependem de variáveis desligadas por padrão, documentadas em Robustez de `docs/CONFIGURATION.md` e em `.env.example`. Arquivos separados permitem revisão, separação e reversão independentes. Novos parâmetros/campos são opcionais; `isRateLimitError` e `base-provider.ts` não mudam neste commit.

<a id="a4a-storage-writes"></a>

### A4a. Escritas no armazenamento

**O que existe.** `packages/server/src/db/file-backed-store.ts` grava cada fragmento alterado e `manifest.json` com `serializeTableRows()`/`atomicWriteFile()`, mantendo `.bak` para recuperação. Escrita atômica e backup permanecem.

**O que é adicionado.**

- `STORAGE_SKIP_UNCHANGED_WRITES` ignora escrita se conteúdo, tamanho e mtime correspondem à última escrita durável deste processo. Arquivos recuperados de `.bak` sempre são regravados.
- `STORAGE_YIELDING_SERIALIZE` serializa fragmentos grandes em fatias de 12 ms que cedem ao loop de eventos. Salvar chats longos não bloqueia outras requisições; saída idêntica a `serializeTableRows` byte a byte.

**O que fica igual.** Ambas desligadas: `serializeTableRows`, `beforeTableWrite`, `atomicWriteFile` como antes. Toda escrita real usa `atomicWriteFile`.

**Como verificar.** `node scripts/run-regressions.mjs --filter robustness-storage-write`

**Como desligar / reverter.** Deixe ambas sem definir.

<a id="a4b-windows-boot"></a>

### A4b. Inicialização no Windows

**O que existe.** A concessão identifica a inicialização do sistema com `readBootId()` em `file-backed-store.ts`, executando PowerShell a cada início (cerca de 1,5 a 2 s no Windows) e uma consulta de identidade `reg.exe`.

**O que é adicionado.**

- `STORAGE_CACHE_WINDOWS_BOOT_ID` guarda o resultado exato por inicialização do sistema em `DATA_DIR/.writer-boot-id.json` (`db/writer-boot-id-cache.ts`). Nada em `LOCALAPPDATA`.
- Sempre ativo: `reg.exe` e PowerShell recebem `windowsHide`, evitando flashes de janela ao iniciar sem console. Nenhum outro efeito.

**O que fica igual.** Lógica da concessão e consulta; desligada, consulta a cada início.

**Como verificar.** `node scripts/run-regressions.mjs --filter robustness-boot-performance`

**Como desligar / reverter.** Deixe sem definir ou exclua `.writer-boot-id.json`.

<a id="a4c-shutdown"></a>

### A4c. Encerramento

**O que existe.** `packages/server/src/index.ts` trata SIGINT, SIGTERM e SIGHUP fora do Windows com `shutdown(signal)`, ignora repetições com warn, arma `armShutdownDeadline` de 8 s e aguarda todos os runtimes antes de `closeDB()`. A ordem é preservada.

**O que é adicionado.** `lib/shutdown-signals.ts` e `lib/shutdown-steps.ts`, usados por `index.ts` e `app.ts`:

- `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS`: Ctrl+Break e fechamento do console fazem o mesmo encerramento ordenado dentro dos cerca de 5 s permitidos pelo Windows.
- `SHUTDOWN_FORCE_EXIT_ON_REPEAT`: segundo Ctrl+C mais de 1,5 s após o primeiro força a saída.
- `SHUTDOWN_EARLY_FLUSH`: gravações pendentes começam imediatamente no sinal. Falhas não são registradas novamente aqui: o armazenamento já registrou e tenta outra vez ao fechar.
- `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` (máximo 2500, padrão 0 = aguardar todos): após sinal, `closeDB()` executa ao esgotar o orçamento mesmo se um runtime travar. Estas duas últimas opções só afetam sinais; reiniciar por Advanced Settings em `admin.routes.ts` não muda.
- Sempre ativo: três paradas nomeadas; falha ou demora acima de 1 s é registrada com a etapa.

**O que fica igual.** Tudo desligado: mesmos sinais, repetições ignoradas, todas as paradas antes de `closeDB()`, prazo de 8 s.

**Como verificar.** `node scripts/run-regressions.mjs --filter robustness-shutdown-safety`

**Como desligar / reverter.** Deixe as opções sem definir; as duas primeiras exigem reinício, informado pelo observador de ambiente.

<a id="a4d-provider-retry-on-transient-network-errors-provider_retry_transient_errors-switch-providerretry"></a>

### A4d. Repetir chamadas em erros transitórios de rede (`PROVIDER_RETRY_TRANSIENT_ERRORS`, controle `providerRetry`)

**O que existe.** `RateLimitAwareProvider` em `packages/server/src/services/llm/rate-limit-aware-provider.ts` repete limites de taxa com espera progressiva até `MAX_RATE_LIMIT_RETRIES`, respeitando `Retry-After`. `connection-fallback-provider.ts` troca para conexão alternativa. Ambos funcionam; conexão recusada ou 502 simplesmente fazia a geração falhar.

**O que é adicionado.** Conexão recusada/inacessível ou 502/503 recebe no máximo duas tentativas, espera aleatória de 0,5 a 2 s (`Retry-After` até 5 s), apenas antes de entregar texto ou raciocínio. Nunca 504 ou reset de socket. Não se aplica à conexão principal com alternativa utilizável (`transientRetry: false`), mantendo a troca rápida. Também exclui principais com wrapper próprio, como o passado por pacote de capacidades a `llm.withFallback`. Desde A6, **Retry failed provider calls** (Repetir chamadas com falha); variável de ambiente prevalece.

**O que fica igual.** Limites de taxa: mesmos intervalos, sem aleatoriedade, mesmos callbacks. `isRateLimitError` e `base-provider.ts` intactos.

**Como verificar.** `node scripts/run-regressions.mjs --filter robustness-provider-resilience`

**Como desligar / reverter.** Variável sem definir e controle desligado.

<a id="a4e-runtime-diagnostics"></a>

### A4e. Diagnóstico de execução

**O que existe.** `packages/server/src/routes/admin.routes.ts` oferece rotas privilegiadas como `/request-timeouts`, sem visão conjunta somente leitura do armazenamento e dos runtimes.

**O que é adicionado.** `GET /api/admin/runtime-diagnostics` (`lib/runtime-diagnostics.ts`), protegido por `requirePrivilegedAccess`, `no-store` e limite próprio de 30 requisições/minuto. Contagens de dados residentes, tabelas alteradas, último erro de gravação, runtimes ativos e última falha de ativação. Hooks opcionais: `getStorageStats()` no controlador, `getFileStoreStats()` em `db/connection.ts` e `runtimeState()` em `CapabilityModuleRuntime`.

**O que fica igual.** Só leitura; nenhuma rota, resposta ou regra de acesso existente muda.

**Como verificar.** `node scripts/run-regressions.mjs --filter robustness-runtime-diagnostics` ou abra `/api/admin/runtime-diagnostics` no servidor local com acesso privilegiado.

**Como desligar / reverter.** Inerte sem chamadas. Para remover, exclua a rota de `admin.routes.ts` e `lib/runtime-diagnostics.ts`.

<a id="two-catches-that-used-to-be-silent"></a>

### Duas capturas antes silenciosas

Seguindo CONTRIBUTING, passam a warn o parsing do cabeçalho SillyTavern em `import.routes.ts` (só tipo do erro, pois mensagens JSON podem citar o chat) e o transporte das perguntas de ativação de agentes (frequência limitada).

---

<a id="a5-startup-internal-requests-wait-until-route-registration-has-ended"></a>

## A5. Inicialização: requisições internas aguardam o registro das rotas

Correção sempre ativa, não uma opção.

**O que existe.** `buildApp()` em `packages/server/src/app.ts` registra rotas centrais, aguarda `capabilityModuleRuntime.start(app)`, que ativa pacotes via `activateOne()` em `services/capability-packages/capability-module-runtime.service.ts`, e inicia depois `startServerAutonomousScheduler(app)`. Chamadas internas `app.inject()` vêm dos pacotes por `runCapabilityInternalRoute()` em `capability-route-registration.service.ts`, do agendador autônomo em `server-autonomous-scheduler.service.ts` e de `routes/generate/prompt-preview.ts`. O primeiro `inject()` inicia toda a instância Fastify; depois não é possível adicionar rotas, hooks ou plugins. Se uma tarefa de fundo (um timer de pacote ou um worker iniciado cedo) chamasse `inject()` durante `buildApp()`, todos os pacotes seguintes falhavam com "Root plugin has already booted", e o próximo `addHook` lançava um erro e parava o servidor. O `catch` de `activateOne()` registra e executa `capabilityPackageManager.rollbackRuntime()` ou persiste status e prontidão `"error"`. Assim, um pacote saudável podia continuar revertido ou `"error"` nos próximos inícios.

**O que é adicionado.**

- `lib/fastify-inject-gate.ts`: `buildApp()` chama `holdInjectUntilRegistered(app)` logo após criar a instância e libera antes de `return app`. `app.inject()` anteriores, promises ou callbacks, aguardam e alcançam rotas adicionadas depois. Se `inject()` retido lançar erro, o callback o recebe.
- `activate()`/`selfCheck()` fazem parte do registro; aguardar suas próprias rotas causaria bloqueio. `activateOne()` executa ambos em `failInjectFastDuring()`: `inject()` direto falha imediatamente com `InjectDuringRegistrationError` (`code`: `MARINARA_INJECT_DURING_REGISTRATION`). Só esse pacote falha; o início continua. Timers disparados após o retorno de `activate()` aguardam como chamadas de fundo.
- Outras chamadas retidas avisam com a pilha do chamador após 60 s e são rejeitadas após 10 minutos com o mesmo erro. Inicializações travadas falham visivelmente. Timers sem referência não mantêm o processo vivo.
- `isHostLifecycleActivationError()` em `capability-module-runtime.service.ts` reconhece `AVV_ERR_ROOT_PLG_BOOTED` ("Root plugin has already booted") e `FST_ERR_INSTANCE_ALREADY_LISTENING` ("Fastify instance is already listening"). Não reverte nem persiste status/prontidão `"error"`; versão e estado ficam, ativando normalmente no próximo início. Um warn, com registro no diagnóstico. Outros erros mantêm error, reversão e `"error"`.
- Regressão: `startup-inject-gate`.

**O que fica igual.** Após `buildApp()`, `app.inject()` volta ao Fastify original sem wrapper. A forma encadeada (`app.inject()` sem argumentos) nunca fica retida. Ordem, rotas, `runCapabilityInternalRoute()`, agendador e ativação/atualização após início continuam iguais. Um caso no servidor ativo: pacote ativado pela interface que adiciona nova rota ainda recebe `FST_ERR_INSTANCE_ALREADY_LISTENING`, mas a nova versão fica instalada para o próximo início, sem reversão. O chamador ainda recebe o erro.

**Como verificar.**

```sh
node scripts/run-regressions.mjs --filter startup-inject-gate
```

Verifica liberação e rota posterior, callbacks, falha imediata em `activate()`, timer iniciado em `activate()`, limite de 10 minutos com valores curtos, instalação/liberação em `buildApp()` e retorno antes da reversão com um único aviso para erro de ciclo de vida do host.

**Como desligar / reverter.** Sem controle. `MARINARA_INJECT_DURING_REGISTRATION` é o código de `InjectDuringRegistrationError`, não uma configuração. Reverta o commit do bloqueio inject.

---

<a id="a6-feature-switches-settings--advanced--features"></a>

## A6. Controles de recursos: Settings > Advanced > Features

**O que existe.** Recursos opcionais usam variáveis (A3/A4), sem área comum na interface; cada opção exigiria configuração, rota e UI próprias.

**O que é adicionado.** Um registro e uma seção, ampliados por F, G e H. Detalhes em `docs/configuration/features.md`.

- `packages/shared/src/schemas/feature-settings.schema.ts` define nomes/padrões; objeto JSON em `features` guarda apenas diferenças do padrão.
- Dois controles: **Stable lorebook picks** (`stableLorebookGroupPicks`, A3a) e **Retry failed provider calls** (`providerRetry`, A4d).
- `isFeatureEnabled()` em `services/features/feature-settings.ts` lê uma cópia em memória, sem custo adicional nos caminhos frequentes. Carregada ao registrar rotas de configurações; atualizada a cada escrita/remoção da linha, comandos de banco da Professor Mari que a alterem e recarga de `.env`. `GET` e `PUT /api/app-settings/features`; `PUT` valida estritamente.
- Variáveis definidas prevalecem para ligar e desligar. `LOREBOOK_STABLE_GROUP_WINNERS`/`PROVIDER_RETRY_TRANSIENT_ERRORS` agora fixam os controles, em vez de leituras separadas.
- O cliente lista tudo em Settings > Advanced > Features; controles fixados ficam bloqueados com o nome da variável. Outros componentes usam `useFeatureEnabled()`.

**O que fica igual.** Todos desligados por padrão; sem abrir a seção, comportamento igual. Variáveis existentes mantêm o efeito.

**Como verificar.** `node scripts/run-regressions.mjs --filter feature-settings` cobre registro, padrões, normalização, prioridade, rotas, armazenamento, invalidação tipo Mari e listeners. Na interface, Settings > Advanced > Features ou pesquise `features`.

**Como desligar / reverter.** Deixe ambos desligados ou remova as variáveis. Reverter o commit remove o mecanismo; variáveis voltam a funcionar independentemente.

---

<a id="a7-logged-best-effort-helpers"></a>

## A7. Auxiliares de melhor esforço com logs

Acréscimo sem controle nem mudança de comportamento por si só.

**O que existe.** Alguns erros são ignorados deliberadamente com `catch` vazio: limpeza, avanço de cursor, gravação de cache. É correto, mas sem registro.

**O que é adicionado.** `packages/server/src/lib/best-effort.ts` com `logSuppressed`, `orFallback` e `bestEffort`. Falhas absorvidas usam `logRateLimited` (A2), no máximo uma linha/minuto por evento, chat e etapa. Correções D/E usam isso ao substituir capturas vazias.

**O que fica igual.** Nada chama os auxiliares neste PR; nenhum caminho existente muda.

**Como verificar.** `node scripts/run-regressions.mjs --filter best-effort`.

**Como desligar / reverter.** Sem controle; reverter o commit remove o arquivo.

---

<a id="coming-in-later-pull-requests"></a>

# Próximos pull requests

Seções propositalmente curtas. Cada PR completa sua seção com as mesmas cinco partes quando aberto.

Situação: o PR A foi mesclado como #6647 e o PR B como #6648. O PR C (#6649) foi fechado sem ser mesclado, e os PRs D a H não foram abertos como pull requests separados. As seções de C a H abaixo descrevem o plano como foi escrito; não as leia como recursos lançados dessa forma.

<a id="pr-b-dev-mcp-for-coding-assistants"></a>

## PR B: Dev MCP para assistentes de programação

Servidor local opcional em `tools/dev-mcp`, fora do workspace pnpm e da imagem Docker. Usa o rastreamento A2. Configuração/verificações em `tools/dev-mcp/README.md`, adicionado por B.

<a id="pr-c-command-palette-and-keyboard-shortcuts-overlay"></a>

## PR C: Paleta e painel de atalhos

Em C: paleta Ctrl+K e painel "?" de atalhos. Só cliente, sem controle nem mudança nas teclas existentes.

<a id="pr-d-reviewed-server-fixes-part-1"></a>

## PR D: Correções revisadas do servidor, parte 1

Em D: rotas, middleware, recuperação, chat/geração, importadores, sidecars e SSRF, cada um com regressão. Correções sem controle.

<a id="pr-e-reviewed-server-fixes-part-2"></a>

## PR E: Correções revisadas do servidor, parte 2

Em E: serviços e armazenamento, cada correção com regressão e sem controle.

<a id="pr-f-prompt-caching"></a>

## PR F: Cache de prompts

Em F: marcador de histórico da assinatura Claude, atualização Claude Agent SDK, estrutura favorável ao cache (controle desligado), aviso por chat antes de envio com pouco cache (desligado) e diagnóstico opcional.

<a id="pr-g-generation-jobs-and-console-tray"></a>

## PR G: Trabalhos de geração e bandeja

Em G: imagens, sprites e vídeos continuam com a aba fechada, com visualizador (controle desligado) e ícone de console Windows (controle desligado).

<a id="pr-h-engine-diagnostics-and-launcher"></a>

## PR H: Diagnóstico e inicializador

Em H: integridade ao iniciar, telemetria de memória, arquivos de depuração opcionais, limite de chamadas de fundo (controle desligado), segurança do inicializador e nova tentativa sem desativar raciocínio para modelos que sempre raciocinam.

---

<a id="test-results-for-pr-a-on-the-development-machine"></a>

## Resultados de PR A na máquina de desenvolvimento

Verificado sobre `staging`, commit `dd876831a`. Sem chamadas pagas.

- **Regressões Node Linux**, como CI `complete-node-regressions` (Ubuntu 24.04 no WSL, Node 24, `pnpm install --frozen-lockfile`, `pnpm regression`): 384 arquivos passam. Com mais carga, `server-signal-shutdown` às vezes atingiu 30 s, também no `staging` intacto. `smart-group-decision`, `agent-activation-questions` e `advanced-memory-core`, sensíveis ao tempo, falharam uma vez cada e passaram em toda repetição.
- **Regressões Node Windows**: 379 de 384. `decision-sidecar-runtime`, `gallery-previews`, `request-timeouts`, `server-signal-shutdown` e `storage-writer-lock` falham igualmente no `staging` intacto dessa máquina: bloqueios de arquivos, sinais de console e verificação de espaço locais.
- **Tipos, lint, formato e builds**: `tsc --noEmit` em shared, server, client, projeto raiz e estimativa de tokens; lint com 0 erros; Prettier em `packages/**/*.{ts,tsx}`; verificações de locales e JSX estático; builds de cliente/servidor.
- **Testes de navegador** de configurações (`core-flows`, `issue-sweep-settings`, `ux-feedback-sweep`, `afternoon-sweep`, `client-runtime-diagnostics`) em `mobile-chromium`: 171 passaram, 0 falharam. Falhas restantes após repetir em `mobile-webkit` (WebKit Windows) também ocorrem no `staging` intacto.
- **Seção Features** conferida visualmente nos temas padrão e SillyTavern, claro/escuro, desktop e celular.
