# Auditoria de limpeza de código

**Data da auditoria:** 2026-07-22

**Branch alvo:** `staging`

**Objetivo:** encontrar artefatos removíveis e simplificações delimitadas, sem mudar o comportamento em execução.

**Situação da implementação:** as constatações de alta confiança e baixo risco já foram implementadas na mesma mudança de limpeza.

## Resultado da implementação

Concluído:

- remoção dos quatro módulos de código inalcançáveis, do builder de sidecar obsoleto, do executor de testes sem testes e dos briefings de tarefas já concluídas;
- remoção do buffer de log de depuração que só existia por causa do painel de depuração inalcançável, mantendo os diagnósticos do console do navegador;
- resolução das 60 constatações de código sem uso comprovadas pelo compilador, com as verificações de código sem uso ativadas no cliente e no servidor;
- remoção de 53 hooks, funções auxiliares, tipos e declarações de interface do cliente que ninguém consumia, em lotes por domínio;
- remoção das oito dependências órfãs de alta confiança, com reparo do lockfile, da verificação de instalação do workspace e do texto de solução de problemas;
- o comando `pnpm test` na raiz agora roda cobertura de regressão de verdade, em vez de relatar sucesso com zero testes;
- reaproveitamento do seletor de quadro-chave do storyboard que já existia e unificação da lógica duplicada de tokens de busca do Spotify;
- a reordenação de variáveis de preset ficou restrita ao preset solicitado, usando o `presetId` antes ignorado como limite de integridade.

Mantido de propósito, para um trabalho separado de compatibilidade ou de produto:

- `@rollup/wasm-node`;
- exports do servidor que podem ser APIs usadas fora do repositório ou pontos de acesso para testes;
- a unificação do parser de PNG e da geometria dos tutoriais;
- as refatorações amplas do editor/compositor e dos módulos grandes;
- campos de compatibilidade previstos para uma versão maior futura.

As constatações detalhadas abaixo ficam como registro das evidências anteriores à mudança. Onde ainda houver texto em forma de recomendação, vale o resultado da implementação descrito acima.

## Validação

A limpeza implementada passou nas trilhas de comprovação que o repositório oferece:

- `pnpm install --frozen-lockfile`
- `pnpm check` (verificação de código sem uso, TypeScript, ESLint e builds de produção)
- `pnpm test` (todas as trilhas de regressão mais a cobertura de smoke no navegador: 81 aprovados, 51 ignorados de propósito)

A suíte de navegador também revelou quatro suposições de localização de elementos que dependiam do estado, ao tornar honesto o comando genérico de teste. Esses testes agora navegam de forma explícita, delimitam controles móveis duplicados e miram o scroller real da linha do tempo do Noodle, sem enfraquecer o que verificam no produto.

## Resumo executivo

O repositório é grande (1.665 arquivos rastreados e cerca de 478.000 linhas nos tipos de arquivo de código analisados), mas a maioria dos arquivos grandes é código ativo do produto, não entulho óbvio. A limpeza mais segura é um conjunto de remoções pequenas e apoiadas em evidências, não uma reescrita ampla.

A primeira trilha de limpeza da auditoria original identificou:

- quatro módulos de código sem nenhuma referência de entrada (899 linhas no total);
- um script obsoleto de build do sidecar (173 linhas);
- um executor de testes que termina com sucesso mesmo sem rodar teste nenhum (54 linhas, mais a ligação nos scripts do pacote);
- dois briefings de tarefas de fase já concluídas, largados na raiz do repositório (235 linhas);
- 60 declarações, imports, parâmetros e variáveis locais sem uso, comprovados pelo compilador;
- oito dependências diretas provavelmente órfãs, sujeitas a uma verificação de instalação limpa e build;
- um sprite estático da Mari provavelmente sem uso, após uma verificação de smoke no navegador.

Só os quatro módulos inalcançáveis, o script obsoleto, o executor que não faz nada e os briefings de tarefas somam 1.361 linhas rastreadas. Ainda assim, o trabalho proposto deve ser dividido em PRs de limpeza pequenos, para que cada remoção tenha uma comprovação estreita e um retorno fácil.

## Como a auditoria foi feita

A auditoria combinou vários tipos de evidência:

1. Inventário de todos os arquivos rastreados, tipos de arquivo, principais áreas de código e maiores arquivos.
2. Análise de import/export na AST do TypeScript, incluindo imports relativos e aliases do repositório.
3. Buscas por símbolo exato e por nome de arquivo em todo o código rastreado, scripts, documentação, manifestos e workflows.
4. Sondagens do compilador TypeScript com `noUnusedLocals` e `noUnusedParameters` forçados no cliente e no servidor.
5. Buscas por dependências diretas e inspeção dirigida do histórico do Git onde uma dependência ou script parecia ter ficado para trás em alguma refatoração anterior.
6. Comparação normalizada de janelas duplicadas, seguida de inspeção manual das coincidências mais significativas.
7. Verificação de sintaxe dos arquivos JSON, Python e Bash rastreados.

Rótulos de confiança usados abaixo:

- **Alta:** várias verificações independentes concordam; a remoção deve ser mecânica.
- **Média:** hoje não há referência, mas carregamento dinâmico, consumidores externos ou intenção de produto ainda podem pesar.
- **Adiar:** uma oportunidade legítima de simplificação, com superfície de regressão ampla demais para uma passada de remoção de artefatos.

A análise estática não consegue provar que não existe busca por string em tempo de execução, uso por pacote baixado, caminho fornecido pelo usuário ou consumidor externo. Esses casos são apontados, e não tratados como código morto.

## 1. Remoções de arquivo com alta confiança

### 1.1 Módulos de código inalcançáveis

| Candidato | Evidência | Nota de limpeza | Comprovação necessária |
| --- | --- | --- | --- |
| `packages/client/src/components/agents/AgentDebugPanel.tsx` (296 linhas) | Nenhum import de entrada, e `AgentDebugPanel` só aparece na própria declaração. | Remova o componente. Depois, revise `debugLog` e `clearDebugLog` no store dos agentes; fora desse painel inalcançável, ninguém mais consome os dois. Não remova `lastResults`, que é usado por `SpriteOverlay`. | `pnpm check`; abra as configurações dos agentes/modo de depuração e verifique as superfícies de depuração ativas. |
| `packages/client/src/components/agents/AgentThoughtBubbles.tsx` (113 linhas) | Nenhum import de entrada, e `AgentThoughtBubbles` só aparece na própria declaração. A interface atual de balões de pensamento e checklist é renderizada por `RoleplayHUD` / `RoleplayHUDActionsMenu`. | Remova o componente e a entrada desatualizada dele em `packages/client/.instructions.md`. | `pnpm check`; `pnpm regression:roleplay`; verifique no navegador o HUD de roleplay e a checklist de continuidade. |
| `packages/client/src/components/panels/GlobalGalleryPanel.tsx` (468 linhas) | Nenhum import de entrada, registro de rota ou referência ao nome exato. | Remova só este painel. **Não** conclua que toda a funcionalidade de galeria está morta: `NoodleHome`, os hooks de galeria, as rotas do servidor e o armazenamento continuam com referências ativas. | `pnpm check`; `pnpm smoke:ui`; verifique manualmente o upload de imagem e a galeria do Noodle. |
| `packages/shared/src/features/turn-games/engine-utils.ts` (22 linhas) | Sem imports, sem export de barrel, e os quatro símbolos exportados só aparecem neste arquivo. | Exclua o arquivo. | `pnpm check`; `pnpm regression`. |

### 1.2 Script obsoleto de build do sidecar

O arquivo `scripts/build-sidecar-runtime.mjs` não é citado por nenhum script de pacote, workflow, documento ou trecho de código. Ele chama `pnpm exec node-llama-cpp`, mas `node-llama-cpp` não é mais dependência do workspace. O histórico no Git liga o script ao antigo caminho de build do sidecar local com Gemma.

**Recomendação (alta confiança):** exclua o script. Antes disso, faça uma última busca por artefatos de release fora do repositório, caso exista algum pipeline de instalador configurado externamente.

### 1.3 Briefings de implementação concluídos na raiz

Os arquivos `MARI_PHASE2_TASK.md` e `MARI_PHASE3_TASK.md` são instruções de implementação voltadas a uma branch, para um trabalho que já está no código. Nada no repositório se refere a eles, e não são documentação duradoura para usuários nem para quem contribui.

**Recomendação (alta confiança):** remova os dois da árvore de trabalho. O histórico continua disponível no Git. Se alguma justificativa ainda for útil, guarde só essa justificativa no documento de arquitetura correspondente, em vez de preservar instruções de tarefa.

### 1.4 Executor de testes enganoso, sem testes

O arquivo `packages/server/scripts/run-tests.mjs` aponta para três padrões de `.test.ts`, mas nenhuma das pastas alvo contém arquivo de teste. Tanto `pnpm --filter @marinara-engine/server test` quanto o `pnpm test` na raiz terminam com sucesso, com zero testes e zero suítes. Os testes antigos foram removidos de propósito, e as regras do repositório proíbem manter arquivos `.test.ts`.

Isso é mais perigoso que código morto comum, porque hoje um `pnpm test` verde sugere uma cobertura que não existe.

**Recomendação (alta confiança):**

1. Remova o executor do servidor e o script `test` do servidor.
2. Mantenha a verificação de layout do instalador do Windows, mas dê a ela um nome de script próprio e honesto, se for preciso.
3. Redefina o `test` da raiz para rodar um subconjunto intencional de regressão/smoke, ou remova o atalho genérico e documente `pnpm check`, `pnpm regression:*` e `pnpm smoke:ui` como os comandos de comprovação de verdade.
4. Garanta que a CI não possa relatar "testes aprovados" só por causa de uma execução sem teste nenhum.

## 2. Limpeza de dependências

Estas dependências diretas não têm hoje nenhum import, registro, configuração ou referência por string em tempo de execução fora dos manifestos e do lockfile, salvo quando indicado.

| Workspace | Dependência | Confiança e evidência |
| --- | --- | --- |
| client | `class-variance-authority` | **Alta.** Sem uso em código ou configuração. Uma limpeza anterior de dependências já a tratava como sem uso. |
| client | `autoprefixer` | **Alta, com comprovação de build.** Não há configuração de PostCSS nem import; o cliente usa o plugin Vite do Tailwind. |
| server | `@earendil-works/pi-ai` | **Alta.** O runtime da Professor Mari foi refatorado e saiu da dependência Pi. O histórico do repositório registra explicitamente que ela já não era importada e ficou para uma limpeza posterior. |
| server | `@fastify/websocket` | **Alta.** Sem registro de plugin, rota de websocket ou import. |
| server | `png-chunk-text` | **Alta.** Sem import. O tratamento atual de metadados de PNG é feito diretamente. |
| server | `png-chunks-encode` | **Alta.** Sem import. |
| server | `png-chunks-extract` | **Alta.** Sem import. |
| shared | `chess.js` | **Alta, com comprovação de compatibilidade.** Sem import atual no código. A funcionalidade de xadrez embutida foi extraída para pacotes opcionais. Removê-la também exige excluir a entrada dela em `scripts/check-workspace-install.mjs` e atualizar o texto desatualizado de solução de problemas sobre o `chess.js` ausente. |

A dependência `@rollup/wasm-node` no cliente também não tem referência, mas pode ser um fallback do Rollup específico de ambiente. Trate como **confiança média**: inspecione o histórico de empacotamento e de CI e comprove os builds nas plataformas com suporte antes de removê-la.

Não classifique como sem uso dependências como `workbox-window`, `pino-pretty`, o `esbuild` da raiz, pacotes de tipos ou ferramentas só de linha de comando com base apenas no texto dos imports. Elas são consumidas por módulos gerados, por configuração de transporte baseada em string, por scripts de build ou por scripts de pacote.

No PR de dependências, atualize `pnpm-lock.yaml`, instale a partir de um estado limpo de dependências e rode a trilha completa de build e verificação. Remover um pacote de uma árvore `node_modules` já populada não é comprovação suficiente.

## 3. Código sem uso comprovado pelo compilador

Forçar as verificações de código sem uso do TypeScript produziu **57 diagnósticos no servidor** e **3 no cliente**. Isso é evidência mais forte que candidatos vindos só de busca textual. A maioria são imports ou variáveis locais e pode ser removida de forma mecânica; já parâmetros de callback e de métodos públicos exigem checar antes as assinaturas de chamada.

### 3.1 Cliente

- `ChatSettingsDrawer.tsx`: parâmetro de filtro `subject` sem uso.
- `GameCombatUI.tsx`: parâmetro `line` do map sem uso.
- `hooks/use-encounter.ts`: `_res` sem uso; aguarde a requisição sem atribuir o resultado.

### 3.2 Servidor

- `db/file-backed-store.ts`: `TABLES_REVERSE` sem uso; campo de instância `loadedManifest` e sua atribuição sem uso.
- Imports e variáveis locais de rotas: `backup.routes.ts` (`dirname`), `sprites.routes.ts` (`readdir`), `scene.routes.ts` (`gsStorage`), `noodle.routes.ts` (`extractNoodleMentionHandles`, `NoodleInteractionType`) e `generate/dry-run-route.ts` (`lorebooksStore`).
- Parâmetros de callback de rota sem uso: `game-assets.routes.ts`, `lorebooks.routes.ts`, `sprites.routes.ts` e `youtube.routes.ts` (`reply`). Renomeie para `_reply` só se a posição na assinatura do Fastify precisar ser preservada.
- `game.routes.ts`: `GmPromptContext`, `formatMoraleContext` e `sceneSpotifyTrackCandidateSchema`.
- `generate.routes.ts`: `readFileSync`, `LIMITS`, `AgentPhase`, `CharacterStat`, `GameState`, `createLLMProvider`, `formatZonedConversationDate`, `formatZonedConversationTime`, `chatsTable`, `normalizeCustomEmojiSelection`, `embedMemoryRecallTexts`, `latestHistoryUserContent`, `getActiveTurnGame`, `startTurnGame`, `pruneEmptyPromptWrappers`, `areConversationSchedulesEnabled`, `addEventEntry`, `normalizeAgentMaxTokens`, `resolveAgentRunInterval` e a variável local `chatParams`.
- `generate/dry-run-route.ts`: função auxiliar local morta `wrapperMessages`.
- `services/agents/agent-executor.ts`: parâmetro `agentType` sem uso em `sanitizeTextAgentResponse`; atualize os chamadores internos se o parâmetro for removido.
- `services/agents/agent-pipeline.ts`: `AgentPhase` sem uso.
- `services/conversation/schedule.service.ts`: `createLLMProvider` e `ConversationStatusOverride` sem uso.
- `services/game/perception.service.ts`: `RPGAttributes` sem uso.
- `services/generation/conversation-react-command-runtime.ts`: parâmetro auxiliar `command` sem uso.
- `services/import/st-bulk.importer.ts`: `personasTable` sem uso.
- `services/lorebook/keyword-scanner.ts`: `currentMessageIndex` desestruturado e sem uso; confira o formato interno das opções antes de removê-lo.
- `services/lorebook/prompt-injector.ts`: `LorebookEntry` sem uso.
- `services/mari-db/mari-db.service.ts`: função auxiliar morta `makeEmptyValidation`.
- `services/prompt/assembler.ts`: `PromptPreset`, `PromptSection`, `PromptGroup`, `groupOrder` e `chatHistoryEndIdx` sem uso.
- `services/sidecar/scene-analyzer.ts`: funções auxiliares mortas `widgetUpdateHint` e `widgetStateSummary`.
- `services/sidecar/scene-postprocess.ts`: função auxiliar morta `normalizeExpression`.
- `services/sidecar/sidecar-process.service.ts`: `lastReadyAt` recebe valor, mas nunca é lido.
- `services/storage/noodle.storage.ts`: `NoodlerStageProfile` sem uso.
- `services/storage/prompts.storage.ts`: parâmetro `presetId` sem uso em `reorderVariables`; verifique os chamadores e a semântica de ordenação do armazenamento antes de mexer na assinatura.

Depois que essa lista estiver limpa, ative `noUnusedLocals` e `noUnusedParameters` nas configurações de TypeScript do servidor e do cliente. Isso transforma a auditoria de uma varredura única em uma invariante mantida. Prefixar com `_` os parâmetros de callback que são realmente necessários é melhor que desativar a regra globalmente de novo.

## 4. Exports internos sem nenhum consumidor no repositório

Declarações exportadas escapam das verificações comuns de variável local sem uso, então uma segunda passada procurou nomes que só aparecem na própria declaração. O cliente é um aplicativo, não uma biblioteca pública, o que torna esses casos bons candidatos à remoção. Exclua em lotes por domínio e deixe o compilador revelar as funções auxiliares e os imports privados ligados a eles.

### 4.1 Hooks e funções auxiliares do cliente

- Hooks de agentes: `useAgentConfig`, `useUpdateAgentByType`, `useToggleAgent`.
- Hooks de personagem: `useUpdatePersonaGalleryClipTrim`, `useCharacterGroup`.
- Hooks de chat e pastas: `useReorderChats`, `useActiveChatPreset`, `useCreateChatPreset`, `useTouchChat`, `useMarkAutonomousUnread`, `useBulkSetMessagesHiddenFromAI`, `useSwipes`, `useMoveConnection`.
- Hooks de jogo: `useRegeneratePartyCard`, `useUpdateGameMapBinding`, `useCombatLoot`, `useLootGenerate`, `useGameJournal`, `useGameCheckpoints`, `useCreateCheckpoint`, `useLoadCheckpoint`, `useDeleteCheckpoint`.
- Hooks de vibração: `useHapticStopScan`, `useHapticCommand`, `useHapticStopAll`.
- Hooks de lorebook: `useLorebookEntry`, `useBulkCreateEntries`, `useSearchLorebookEntries`.
- Outros hooks: `useCustomTool`, `useUpdateNoodleAccount`, `usePreset`, `useCreatePreset`, `usePresetGroups`, `useReorderGroups`, `usePresetSections`, `usePresetVariables`, `usePreviewPreset`, `useRegexScript`, `useUpdateSpatialContext`.
- Declarações de interface: `parseQteTag`, `NoodlerNotificationItem`, `LabelWithHelp`, `RESOURCE_PANEL_SORT_OPTIONS` e `SyncedSettings`.
- Funções auxiliares de biblioteca: `isManagedChatBackgroundUrl`, `isBrowserSpeechRecognitionSupported`, `requestTurnGameBotGeneration`, `resolveInputMacrosForChat`, `createCustomToolFolderPackageFilename`, `resolveCurrentGameSessionChatId`, `readTextFileFromZip` e `buildTTSMessageText`.

Um hook de cliente sem uso **não** prova que o endpoint dele no servidor está sem uso. Remova primeiro o hook; audite as rotas em separado, comparando com a interface, com os pacotes de capacidade e com a compatibilidade da API externa.

### 4.2 Candidatos do servidor que exigem uma decisão final sobre API ou ponto de acesso para testes

As declarações exportadas do servidor a seguir também não têm consumidor dentro do repositório. A maioria parece interna, mas pontos de acesso para testes e funções auxiliares exportadas podem ser usados por ferramentas fora da árvore, então a confiança fica média até que quem mantém o projeto confirme que não são APIs com suporte:

- runtime e autenticação básica: `getServerRoot`, `getSpotifyRedirectUri`, `isAutoOpenBrowserDisabled`, `hasBasicAuthConfigured`;
- pontos de acesso para testes: `resetRateLimitBucketsForTests`, `buildKnowledgeRetrievalAgentMessagesForTest`, `splitRuntimeHandledAgentInjectionsForTest`, `__setSdkForTesting`;
- auxiliares de geração e prompt: `normalizeSecretPlotSceneDirections`, `buildUserMessageRegenerationPrompt`, `buildUserMessageRegenerationSourceMessage`, `wrapFields`, `mergeTruncation`, `modelAccessOptions`, `isStandaloneCharacterProfileBlock`, `resolveChatSummaryPromptFromMetadata`;
- auxiliares de jogo: `buildNpcPortraitImagePrompt`, `buildBackgroundImagePrompt`, `buildSceneIllustrationImagePrompt`, `buildSessionSummaryPrompt`, `buildCardAdjustmentPrompt`, `moraleDiceModifier`, `buildNpcRelationshipSummary`, `buildSessionCarryoverContext`, `getTurnGameContextText`;
- auxiliares de lorebook: `enforceMaxActivatedEntries`, `applyPerLorebookTokenBudgets`, `resolveActivatedLorebookEntryContent`, `resolveBudgetAndRecursivelyActivateLorebookEntries`, `recursiveScan`;
- utilitários e tipos: `AgentPipelineResult`, `resolveVideoRequestDuration`, `newTimeSortableId`, `parseBoolean`, `sanitizePathFilename`.

Não aplique esse teste de "uma única ocorrência textual" em massa ao `packages/shared`: os exports de shared são contratos de compatibilidade para o cliente, o servidor e os pacotes de agente baixáveis, incluindo consumidores fora deste repositório.

## 5. Candidato entre os arquivos estáticos

O arquivo `packages/client/public/sprites/mari/Mari_point_down_left.png`, o único sprite da Mari empacotado cujo nome de arquivo e caminho não apareciam em lugar nenhum do repositório, foi removido pela omnibar slice 38a.

Não use busca por nome de arquivo para podar os arquivos de jogo empacotados. Alguns semeadores e manifestos do servidor varrem certas pastas de arquivos de forma dinâmica.

## 6. Simplificações delimitadas

Estas são melhorias de manutenção, não remoções de código morto. Cada uma deve preservar o comportamento exatamente e trazer uma comprovação de regressão focada.

### 6.1 Regra de negócio duplicada, igual ou quase igual

1. **Seleção de quadro-chave do storyboard – risco baixo.** O arquivo `GameSurface.tsx` tem uma implementação local de `findStoryboardKeyframeForSegment` igual à função exportada `findReplayStoryboardKeyframe` em `lib/game-session-replay.ts`. Reaproveite a função da biblioteca e remova a cópia local.
2. **Normalização da busca no Spotify – risco baixo ou médio.** `SPOTIFY_STOP_WORDS`, `SPOTIFY_MOOD_EXPANSIONS` e o fluxo de expansão estão duplicados entre `game-spotify-music.service.ts` e `tool-executor.ts`. Extraia uma pequena função auxiliar de tokens de busca do Spotify, para que os dois caminhos não possam divergir.
3. **Extração de metadados do card de personagem em PNG – risco médio.** A função `extractCharaFromPng` está implementada de forma independente em `import.routes.ts` e em `st-bulk.importer.ts`. Extraia um único utilitário no servidor e comprove chunks de texto normais, chunks de texto internacionais, cargas em base64 e brutas, cards V2/V3 e PNGs malformados com fixtures de regressão.
4. **Geometria da dica dos tutoriais – risco médio.** `GameTutorial.tsx` e `OnboardingTutorial.tsx` duplicam a lógica de colisão e posicionamento. Extraia só o cálculo de geometria compartilhado; mantenha as políticas móveis e específicas de produto de cada tutorial como opções explícitas.
5. **Normalização de edição de segmento de jogo no cliente e no servidor – risco médio ou alto.** A normalização pura no cliente e no servidor é parecida. Mova para shared só um schema ou normalizador que seja realmente neutro em tempo de execução; deixe no servidor o que é análise e persistência.

### 6.2 Áreas grandes de interface repetidas: adie a unificação ampla

- `CharacterEditor.tsx` e `PersonaEditor.tsx` contêm um fluxo de gerenciamento de sprites bastante repetido.
- `ChatInput.tsx` e `ConversationInput.tsx` repetem o comportamento de plano guiado e de compositor.

Há valor real em unificar, mas juntar qualquer um dos dois pares de uma vez criaria uma superfície de regressão enorme. Extraia um hook ou componente coerente por vez (primeiro o gerenciamento de sprites, no caso dos editores, e primeiro o comportamento de plano guiado, no caso dos compositores) e teste os dois chamadores no navegador depois de cada extração.

### 6.3 Pontos ativos de complexidade

Os maiores módulos ativos são `server/routes/game.routes.ts`, `client/components/game/GameSurface.tsx`, `client/features/chat-settings/ChatSettingsDrawer.tsx`, `server/routes/generate.routes.ts` e `client/components/panels/SettingsPanel.tsx`. Nenhum deles é candidato à remoção. Continue extraindo handlers de rota delimitados, serviços de domínio, seções do painel lateral e funções puras apenas quando a funcionalidade afetada já estiver sendo mexida. Um PR isolado de "dividir tudo" só traria agitação, sem comprovação confiável de comportamento. O painel de configurações do chat foi a exceção: ele foi dividido seção por seção, uma por PR (#9119). As regras da pasta estão na seção Chat Settings de `packages/client/.instructions.md`.

## 7. Itens deixados de fora da limpeza de propósito

- Campos de compatibilidade marcados explicitamente como aceitos ao longo da linha 2.x, incluindo os formatos de compatibilidade de estilo de imagem, estado do jogo, Text to Speech (TTS), tracker de persona e contexto de conversa. Remova esses campos só por meio de uma migração versionada, na próxima versão maior.
- Registros e manifestos de capacidade gerados automaticamente. Gere de novo pelos scripts correspondentes; não faça a poda à mão.
- Código dos pacotes de agente baixáveis, como Illustrator, Music DJ, Lorebook Keeper e outros. A limpeza de runtime e de prompt que pertence ao agente é feita em `Pasta-Devs/Marinara-Agents`; aqui fica só a integração com o host.
- Os módulos do Home Assistant em `custom_components`, cuja descoberta é guiada por convenção e por manifesto.
- `MarinaraLauncher.exe`, consumido pelo código de migração de atalho na barra de tarefas.
- `start-local.bat`, que não é citado por nenhum script de pacote, mas continua sendo um lançador local plausível para uso humano. Remova só depois de checar a intenção com quem mantém o projeto.
- Declarações de schema que parecem sem referência, mas rodam como parte da inicialização do módulo ou do registro de tabelas.
- Rotas do servidor, só porque um hook React de conveniência está sem uso; pacotes baixáveis ou consumidores da API ainda podem chamá-las.

## 8. Sequência de limpeza recomendada

Mantenha o trabalho simples e fácil de revisar:

1. **PR A – artefatos:** remova os quatro módulos inalcançáveis, a entrada desatualizada na documentação do componente, o script obsoleto do sidecar, os briefings de tarefas concluídas e, após confirmação manual, o sprite da Mari sem uso.
2. **PR B – superfície de teste honesta:** remova o executor sem testes e renomeie ou redefina os scripts do pacote, para que comandos bem-sucedidos representem verificações reais.
3. **PR C – limpeza do compilador:** resolva os 60 diagnósticos do TypeScript e depois ative as verificações de código sem uso nas configurações do cliente e do servidor.
4. **PR D – dependências:** remova os oito pacotes de alta confiança, conserte a verificação de instalação do workspace e o texto de solução de problemas, gere o lockfile de novo e comprove uma instalação e um build limpos.
5. **PR E em diante – lotes por domínio:** remova os exports do cliente sem uso, domínio por domínio, e depois pegue as funções auxiliares duplicadas de baixo risco, uma de cada vez.

Evite juntar remoção de dependências, refatoração ampla de interface e decomposição de rotas em um único PR de limpeza.

## 9. Matriz de validação

Rode a comprovação adequada a cada mudança:

- Qualquer limpeza de código: `pnpm check`.
- Mudanças em shared ou amplas no servidor: primeiro `pnpm regression` ou o comando restrito `pnpm regression:<domain>`, seguido da trilha completa antes do merge.
- Limpeza de componente ou hook de interface: `pnpm smoke:ui` mais verificação manual no navegador do fluxo afetado.
- Caminhos de prompt, agente ou roleplay: `pnpm regression:prompt` e/ou `pnpm regression:roleplay`.
- Limpeza de dependências: instalação limpa e travada, `pnpm check`, builds de produção e CI nas plataformas com suporte.
- Unificação da importação de PNG: regressões de importação direta cobrindo cards de personagem válidos e malformados.
- Arquivos de release e versão, se forem tocados sem querer: `pnpm version:check` e `pnpm credits:check`.

Antes desta limpeza, o resultado do `pnpm test` genérico não podia ser citado como evidência de teste, porque ele terminava com sucesso sem rodar teste nenhum.

## 10. Validação e limites da auditoria

Durante esta auditoria:

- todos os arquivos JSON rastreados foram lidos com sucesso;
- todos os 12 arquivos Python rastreados foram lidos com sucesso pelo parser de AST do Python;
- `start.sh`, `start-termux.sh` e `android/build-apk.sh` passaram no `bash -n`;
- as sondagens de código sem uso do TypeScript produziram as 57 constatações do servidor e as 3 do cliente documentadas acima;
- os comandos de teste do servidor e da raiz foram observados diretamente terminando com sucesso, com zero testes.

ShellCheck e PowerShell não estavam instalados, então não houve análise semântica de shell nem leitura dos scripts de PowerShell e do Windows. Os alvos Android e Home Assistant foram inspecionados na estrutura, mas não foram totalmente compilados nesta auditoria. Essas verificações de plataforma cabem aos PRs de limpeza que mexerem nos arquivos delas.
