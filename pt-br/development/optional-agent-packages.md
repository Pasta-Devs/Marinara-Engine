# Pacotes opcionais de agentes e capacidades

Status: implementado no ciclo de desenvolvimento da v2.3.0, na issue #3612.

## Objetivo

A distribuição base do Marinara Engine não pode compilar nem incluir implementações opcionais de agentes e capacidades. Uma instalação nova começa sem nenhum pacote opcional. As atualizações preservam as capacidades que já existiam antes deste sistema de pacotes.

O catálogo oficial, o código dos pacotes, os artefatos reproduzíveis, os scripts de validação e o fluxo de contribuição ficam em [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents). Os artefatos instalados ficam dentro da pasta de dados configurada do Marinara, para que uma atualização do aplicativo não sobrescreva nada.

## Modelo de pacote

Um pacote de agente pode entregar um ou mais agentes declarativos e, opcionalmente, capacidades executáveis confiáveis:

- pontos de entrada no servidor para rotas, hooks de ciclo de vida, provedores de prompt, tratadores de resultado e migrações de armazenamento;
- pontos de entrada no cliente para painéis, superfícies de chat, seções de configuração, escolhas de instalação e telas em tempo de execução;
- esquemas JSON compartilhados e contratos de comunicação estáveis;
- recursos, documentação e fragmentos de conhecimento da Professor Mari pertencentes ao pacote.

Cada pacote é feito para uma versão específica da API de capacidades do Marinara. Nenhum pacote pode importar caminhos internos do código do Engine.

Os elementos de capacidade do cliente recebem o idioma de interface escolhido no Engine pelos atributos `lang` e `dir` e pelo
objeto `capabilityProps.localization`. As interfaces do pacote mantêm os próprios arquivos de idioma e recorrem ao inglês
do pacote quando falta uma tradução; o Engine não traduz os prompts do pacote nem os valores de máquina definidos por ele. A troca de idioma reaproveita
o evento `marinara-capability-props` que já existe, então a interface instalada é redesenhada sem reiniciar o Engine.

### Entrega e cache

Os arquivos de pacotes instalados são servidos com validadores fortes derivados dos hashes SHA-256 de cada arquivo no manifesto, os mesmos valores que o Engine usa para verificar os bytes outra vez a cada leitura. O pacote do cliente (`/api/capability-packages/<id>/client`) e todos os recursos do pacote são sempre revalidados (`no-cache` junto com um `ETag`), então um arquivo sem mudanças responde `304 Not Modified` em vez de ser baixado novamente, enquanto um arquivo republicado é detectado de imediato. Nada é servido como `immutable`: a política de instalação permite republicar a mesma versão com bytes diferentes, por isso nenhuma URL de pacote é endereçada pelo conteúdo.

A API de capacidades 1.1 acrescenta uma fachada genérica de tempo de execução ao contexto
de ativação do servidor. O pacote consegue ler o estado efetivo de depuração do agente e
escrever pelo logger Pino do Engine, inclusive forçando o modo de depuração, sem importar
os módulos internos de logger e de configuração de execução. A fachada expõe operações,
não os objetos internos do Engine.

A API de capacidades 1.2 acrescenta operações de chat e mensagem com escopo de transação,
escritas restritas de metadados do chat, leituras de existência de entradas de lorebook e o
armazenamento de compatibilidade de snapshots espaciais. O pacote consegue validar mudanças de
domínio dentro de uma transação do Engine e salvar os metadados de forma atômica junto com a
mensagem de origem, o swipe ou o snapshot espacial, sem receber uma conexão de banco de dados
nem um objeto de tabela. O Engine continua responsável pelo rollback e pela compatibilidade com o
armazenamento histórico; o pacote continua responsável pela validação e pelas regras de domínio.
Essa mesma API expõe registros normalizados de chat e de personagem, a seleção de
entradas de lorebook elegíveis, a leitura de respostas em formato JSON ou parecido e chamadas resolvidas ao modelo de linguagem.
As credenciais de conexão, as implementações de provedor, as conexões de banco de dados e os objetos de armazenamento continuam internos ao Engine.

### Namespace de cliente do host

O Engine é dono do estado do cliente e das bibliotecas dele, e os clientes dos pacotes de agentes os usam em vez de embutir cópias. Uma cópia mantém um estado próprio: os clientes de pacotes que embutiam o store de configurações da interface salvavam uma versão mais antiga dele por cima das configurações do Engine a cada carregamento (Pasta-Devs/Marinara-Agents#1478), e cada store de chat embutido mantinha o chat que estava aberto quando a página carregou.

Antes de importar o primeiro cliente de pacote, o Engine define um global:

```ts
globalThis.__MARINARA_HOST__ = {
  version: 1,
  capabilityApi,
  stores,
  services,
  modules,
  queryClient,
  components,
  data,
  api,
};
```

A propriedade não é gravável nem configurável, e o namespace e os objetos `stores`, `services`, `modules`, `components` e `data` dele são congelados. O carregador de pacotes (`useCapabilityClientModules`) carrega `lib/marinara-host.ts` com `import()` e aguarda `ensureMarinaraHost()` antes de importar qualquer cliente de pacote, então o namespace está completo quando um módulo de pacote é avaliado. Um Engine sem clientes de pacote nunca o carrega. Se ele não puder ser carregado (um chunk desatualizado depois de uma atualização, por exemplo), cada pacote mostra o erro de carregamento que já existe, e o resto do Engine continua funcionando. O tipo TypeScript é `MarinaraHostV1`, em `packages/client/src/lib/marinara-host-contract.ts`, junto com as listas desta página. Os builds dos pacotes declaram tipos estruturais equivalentes em vez de importar o código-fonte do Engine.

| Membro | Valor |
| --- | --- |
| `version` | `1`. Só muda quando o formato deixa de ser compatível. |
| `capabilityApi` | O `supportedCapabilityApi` do Engine, por exemplo `{ major: 1, minor: 341 }`. |
| `stores` | Os stores zustand ativos `ui`, `chat`, `agent`, `sidecar`, `dialog`, `gallery`, `encounter`, `gameState` e `backfill`. `chat` inclui a fatia de transições espaciais pendentes. |
| `services.tts` | O módulo `lib/tts-service.ts` (`ttsService`, `playWhenAvailable`, ...). |
| `services.audio` | A partir da Capability API 1.381, o módulo `lib/audio-service.ts`: players independentes de música/efeitos sonoros, o manifesto de recursos compartilhado e a seleção de música padrão. Veja [Áudio de pacotes](#package-audio). |
| `services.dialogs` | O módulo `lib/app-dialogs.ts` (`showAlertDialog`, `showConfirmDialog`, `showPromptDialog`, `showChoiceDialog`). |
| `services.imageDownloads` | A partir da Capability API 1.385, as funções existentes da galeria `downloadUrlToDevice`, `shouldUseIosImageShare`, `prepareImageSave` e `savePreparedImageToDevice`. |
| `modules` | Módulos de bibliotecas, indexados pelo especificador simples (veja abaixo). |
| `queryClient` | O único `QueryClient` do React Query com que o Engine renderiza. |
| `components.Modal` | O `Modal` do Engine, com a ordem de sobreposição e o tratamento da tecla Escape e do botão de voltar. |
| `data.emojiCatalog` | O módulo `lib/emoji-catalog.generated.ts`. |
| `api` | O módulo `lib/api-client.ts` (`api`, `ApiError`, `getApiErrorMessage`, ...). |

Um pacote só lê um membro depois de verificá-lo, por exemplo `const host = globalThis.__MARINARA_HOST__; if (host?.version === 1 && typeof host.stores?.ui?.getState === "function")`.

Para baixar imagens, use `shouldUseIosImageShare()` e siga a mesma política de plataforma da galeria. No iPhone, prepare a imagem com `prepareImageSave(url, filename)` antes do gesto de salvar e chame `savePreparedImageToDevice(prepared)` diretamente nesse gesto. O cancelamento do compartilhamento é silencioso, e uma falha não é substituída pela prévia de download do WebKit. As outras plataformas usam `downloadUrlToDevice`. Essas funções salvam no dispositivo do cliente, mesmo quando o servidor do Engine roda no Docker.

O namespace só cresce: um membro novo chega com uma versão minor da API de capacidades, e um pacote que precisa dele exige essa minor. Os pacotes feitos para o namespace exigem a versão da API de capacidades que o acrescentou, então um Engine mais antigo nunca os instala e mantém a versão que já tem instalada. Quando um membro falta mesmo assim, o pacote nunca recorre a uma cópia embutida de um serviço do Engine que guarda estado: os stores `ui` e `chat` viram cópias somente leitura que nunca gravam, e todos os outros membros informam que o recurso precisa de um Marinara Engine mais novo.

**Módulos do host.** `modules[specifier]` é um namespace de módulo completo, inclusive `default` quando a biblioteca tem um. `MARINARA_HOST_MODULE_IMPORTS`, no contrato do cliente, mapeia cada slot público para a dependência que ele importa. A maioria mantém o mesmo nome. O slot estável `framer-motion` é mapeado para `framer-motion-v13` (um alias npm fixado exatamente no Motion 13.5.1), enquanto o slot opcional `motion/react` é mapeado para a dependência principal `framer-motion` 14 do Engine. As ferramentas de pacotes usam esse mapeamento tanto para o inventário de exports quanto para os caminhos do TypeScript; nomes de slots públicos não precisam ser dependências físicas. Os especificadores são `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `@tanstack/react-query`, `zustand`, `zustand/middleware`, `sonner`, `zod`, `i18next`, `react-i18next`, `framer-motion`, `motion/react`, `tailwind-merge` e `clsx`. O build de um pacote resolve esses especificadores para shims que leem o namespace, então o pacote renderiza com o único React do Engine e compartilha o cache do React Query e os toasts dele.

- Os pacotes nunca renderizam um `<Toaster>` nem criam um `QueryClient`. Um `toast` do `sonner` aparece na posição de toasts escolhida pelo usuário. Os padrões de consulta do Engine (`staleTime` de 30 segundos, uma nova tentativa, nenhuma nova busca ao focar a janela) valem, a menos que uma consulta defina as próprias opções, e uma chave de consulta nova que pertença a um pacote começa com o id do pacote.
- Um pacote mantém a própria instância do i18next, criada com `i18next.createInstance()`, dentro de `<I18nextProvider>`. Ele nunca usa `initReactI18next`, `setI18n` nem `setDefaults`, que substituiriam a instância do Engine.
- `lucide-react`, `chess.js`, `scheduler` e `@marinara-engine/shared` não são módulos do host; os pacotes embutem o que usam deles.
- Os pacotes são compilados para estas versões major: `react` 19, `react-dom` 19, `@tanstack/react-query` 5, `zustand` 5, `sonner` 2, `zod` 3, `i18next` 26, `react-i18next` 17, `framer-motion` 13, `motion` 14 (o slot `motion/react`), `tailwind-merge` 3 e `clsx` 2. Substituir a versão major por trás de um slot público existente exige uma versão **major** da API de capacidades. Adicionar um slot distinto é uma mudança aditiva: a API de capacidades 1.377 adiciona `motion/react` sem alterar `framer-motion`. `scripts/regressions/marinara-host-namespace.regression.ts` fixa a dependência mapeada e a versão major de cada slot.
- O Engine valida os próprios dados com o Zod 4 nativo. Os pacotes existentes mantêm o Zod 3 pela dependência explícita
  de compatibilidade `zod-v3`, tanto no slot `zod` do cliente quanto nas importações do servidor do pacote. Isso preserva
  os registros, os valores padrão e as exportações de módulos existentes. O alias inclui a correção de segurança revisada
  para coleções limitadas de `patches/zod@3.25.76.patch`; não é o Zod 3 sem modificações. Esses validadores de pacotes legados
  mantêm o comportamento do Zod 3, exceto por essa correção de segurança documentada. A atualização do núcleo não aplica a eles
  as outras mudanças de validação do Zod 4.
- Os pacotes já instalados mantêm o namespace completo do Motion 13 e não precisam ser recompilados. Um pacote que escolhe o Motion 14 importa `motion/react` pelo shim do host e declara a API de capacidades 1.377 ou mais recente. Hosts antigos rejeitam essa declaração em vez de substituir silenciosamente pelo Motion 13. Mantenha uma só versão em cada árvore de animação: `AnimatePresence`, `MotionConfig`, `LayoutGroup`, os valores do Motion e seus consumidores devem vir do mesmo slot. As versões têm contextos distintos; não há uma ponte entre os contextos. As visualizações de pacotes montam suas próprias raízes React, enquanto o `Modal` do host usa animações CSS. Não espere compartilhar layout ou presença entre versões.

**Campos de store que os pacotes leem.** Os pacotes publicados leem hoje estes campos. O Engine mantém cada um deles, e remover ou renomear um exige uma versão major da API de capacidades (`MARINARA_HOST_STORE_FIELDS` os fixa com `Pick<>`):

| Store | Campos |
| --- | --- |
| `ui` | `achievementsEnabled`, `debugMode`, `includeReasoningInExports`, `enableStreaming`, `userStatus`, `enterToSendConvo`, `conversationCallVoiceVolume`, `conversationCallVoiceMuted`, `setConversationCallVoiceVolume`, `setConversationCallVoiceMuted`, `conversationTimeZone`, `noodleNavigation`, `setNoodleNavigation`, `noodleSelectedPersonaId`, `setNoodleSelectedPersonaId`, `reviewImagePromptsBeforeSend`, `musicPlayerEnabled`, `musicPlayerSource`, `sidebarOpen`, `setSidebarOpen`, `chatBackground`, `setChatBackground`, `characterDetailId`, `lorebookDetailId`, `presetDetailId`, `connectionDetailId`, `agentDetailId`, `toolDetailId`, `personaDetailId`, `regexDetailId`, `characterLibraryOpen`, `botBrowserOpen`, `gameAssetsBrowserOpen`, `modal`, `rightPanelOpen`, `closeModal`, `closeRightPanel`, `closeBotBrowser`, `closeAllDetails` |
| `chat` | `activeChatId`, `activeChat`, `isStreaming`, `streamingChatId`, `abortControllers`, `reset`, `pendingSpatialTransitions`, `setPendingSpatialTransition`, `clearPendingSpatialTransition`, `setPendingSpatialTransitionStatus` |
| `agent` | `setYoutubePlay`, `reset` |
| `sidecar` | `modelDownloaded`, `modelDisplayName`, `fetchStatus` |
| `dialog` | `dialog`, `openDialog`, `closeDialog` |
| `gallery` | `pinImage`, `pinVideo` |
| `encounter` | `reset` |
| `gameState` | `current`, `setGameState`, `reset` |
| `backfill` | `resetBackfill` |

**Armazenamento do navegador que pertence ao Engine.** Os pacotes podem ler estas chaves, mas nunca gravá-las nem removê-las: `marinara-engine-ui`, `marinara-engine-ui:host`, `marinara-active-chat-id`, `marinara-input-drafts` (no local storage e no session storage), `marinara-pending-spatial-transitions`, `marinara-pinned-gallery-images` e `marinara_sidecar_prompted`. Eles nunca abrem o banco de dados IndexedDB `marinara-tts-audio-cache`. Para mudar uma configuração, o pacote chama a ação do store, por exemplo `host.stores.ui.getState().setConversationCallVoiceMuted(true)`, e o Engine a salva.

**Diálogos do aplicativo.** O Engine renderiza os diálogos de alerta, de confirmação, de entrada de texto e de escolha na camada mais alta dele, a da barra de comandos, então um diálogo que um pacote abre aparece acima da sobreposição do próprio pacote e recebe o foco.

**Builds de pacotes anteriores ao namespace.** Eles embutem a própria cópia do store da interface na versão 74 e gravam por cima de `marinara-engine-ui` só as configurações que essa cópia conhece. O Engine também salva cada gravação em uma cópia `marinara-engine-ui:host` exclusiva do host e, ao carregar, ignora um blob salvo mais antigo que a versão dele enquanto essa cópia estiver na versão atual. O Engine continua definindo `globalThis.React` e `globalThis.ReactDOM` para os bundles instalados que usam o runtime clássico do JSX.

### Capability API 1.7: ramificações de chat

A Capability API 1.7 acrescenta metadados normalizados de ramificação ao `CapabilityChatRecord`:

```ts
branch: {
  title: string | null;
  parentChatId: string | null;
  parentMessageId: string | null;
  childMessageId: string | null;
} | null;
```

`title` é o nome persistido da ramificação sem espaços nas pontas. Chats raiz retornam `null`. Ramificações conhecidas criadas pelo Engine expõem o chat pai imediato, a mensagem de origem da bifurcação e a mensagem filha copiada. Ramificações vazias usam âncoras de mensagem null. Ramificações antigas, metadados inválidos e chats irmãos de grupo importados sem uma relação conhecida retornam campos de linhagem null; o Engine não deduz relações históricas. A exportação e a importação genéricas omitem os IDs do pai e das mensagens porque eles mudam entre instalações. Excluir o pai não altera a linhagem da ramificação filha.

### Capability API 1.8: experiências de Game

A Capability API 1.8 acrescenta experiências de Game fornecidas por pacotes, contexto de prompt por turno de Game e gravação de recursos.

Um pacote pode fornecer um Game Mode inteiro em vez de complementar o modo integrado. Ele declara o slot `game-surface` e é escolhido durante a criação do jogo, no bloco Experiences do assistente de configuração. A escolha fica registrada no jogo por toda a duração dele, então uma experiência nunca é ligada ou desligada no meio de uma partida. A superfície desenha o próprio HUD, os menus e o combate sobre a narração compartilhada, além de declarar quais sistemas integrados substitui. Tudo que não for declarado continua integrado, portanto a experiência só desativa o que realmente implementa. O campo opcional `contributions.gameSurface.surfaceClass` informa uma classe que o Engine aplica à área do jogo enquanto a superfície está montada, permitindo que a folha de estilos do pacote altere a interface compartilhada renderizada fora do próprio elemento.

Pacotes com a permissão `prompt-context` acrescentam texto ao prompt do sistema de cada turno de Game gerado. Assim, um pacote que controla um estado ativo mantém o modelo coerente com o que o jogador vê. Uma contribuição também pode declarar quais sistemas integrados substitui, e o Engine deixa de instruir o modelo a controlá-los. As contribuições são coletadas a cada turno e nunca são obrigatórias: uma contribuição vazia é ignorada; se ela gerar erro ou não terminar no prazo, o fato é registrado e ela é ignorada sem afetar a geração.

A fachada de recursos oferece gravações junto com leituras, então o fluxo de configuração do pacote pode localizar ou criar a Persona do jogador e o lorebook dela. Armazenamento, validação e identidade ficam com o Engine; o conteúdo do domínio fica com os pacotes.

### Capability API 1.10: recursos do pacote

A Capability API 1.10 acrescenta a entrega geral de recursos estáticos pertencentes ao pacote. Um manifesto pode declarar `contributions.assets.paths`, uma lista permitida de até 256 imagens (`png`/`webp`/`gif`/`jpg`/`jpeg`) e arquivos JSON enviados dentro do pacote. O Engine os serve em `/api/capability-packages/<id>/assets/<path>` pela mesma cadeia de verificação dos ícones de aba: contenção do caminho, presença do hash em `files[]`, lista permitida de tipos de conteúdo passivos e nova verificação de integridade a cada leitura. O esquema rejeita tipos de documento ativos (SVG, HTML e scripts); todo caminho declarado precisa ter o hash fixado em `files[]`; e o `manifest.json` interno do pacote nunca pode ser servido, mesmo se for declarado. Declarar `contributions.assets` exige um manifesto `schemaVersion` 2 com `capabilityApi` 1.10 ou mais recente; um manifesto v1 não pode declará-lo. Os recursos sempre são revalidados: assim como o pacote do cliente, carregam um `ETag` forte baseado no hash do manifesto e respondem a uma revalidação sem mudanças com `304 Not Modified` e sem corpo. Um conjunto de tiles só é baixado outra vez quando os bytes realmente mudam. As respostas nunca são `immutable` de propósito, pois a política de instalação permite republicar a mesma versão com bytes diferentes e uma URL com versão não é endereçada pelo conteúdo. Isso permite que uma experiência `game-surface` envie arte de verdade em vez de incorporá-la ao pacote do cliente.

Um manifesto que viole essas regras é recusado durante a instalação com uma destas mensagens: "A declared package asset must be listed in the package file manifest", "contributions.assets requires schemaVersion 2 and capabilityApi 1.10 or newer", o erro de extensão do esquema para um caminho que não seja imagem nem JSON, ou, no caso de arquivos cujos nomes só diferem entre maiúsculas e minúsculas e seriam mesclados em sistemas de arquivos que não fazem essa distinção, "Package contains duplicate file" / "Package manifest declares files that collide on case-insensitive filesystems".

Cada elemento de capacidade recebe a própria identidade para isso: `capabilityProps.packageId` e `capabilityProps.packageVersion` chegam junto com `localization`. O pacote monta as URLs de recursos como `/api/capability-packages/<packageId>/assets/<path>`, opcionalmente com `?v=<packageVersion>` para que uma nova versão invalide qualquer cache intermediário, sem baixar novamente a lista de pacotes instalados nem examinar a própria URL de importação.

### Capability API 1.11: interface de combate para experiências

A Capability API 1.11 acrescenta uma interface de combate às propriedades de capacidade `game-surface`. `combatActive` informa o instante em que a interface de combate integrada é realmente montada, ao contrário de `chatMeta.gameActiveState`, o estado narrativo da cena do GM, que demora a refletir a mudança e pode indicar "combat" sem existir um encontro. `combatStyle` leva o estilo efetivo (`classic` ou `tactical`). `requestCombat()` pede ao Engine que gere um encontro pelo mesmo processo do botão manual Start Combat, mas sem a confirmação, pois a interface da experiência já expressou a intenção. O processo de geração do Engine continua decidindo qual será o encontro. Não existe, de propósito, uma forma de o pacote fornecer combatentes ou o estado do combate diretamente: o combate continua sob responsabilidade do Engine.

`requestCombat()` tem identidade estável, não mostra mensagens no caminho do pacote e retorna um código que a experiência usa para renderizar o próprio retorno: `"started"` ou uma recusa, `"combat-active"`, `"pending"` (já existe uma geração em andamento), `"no-turn"` (o GM ainda não escreveu um turno) ou `"unavailable"` (sessão encerrada ou replay). `combatPending` e `combatError` refletem o andamento e a falha da geração para que o pacote não fique esperando `combatActive` depois de uma falha. Como as interfaces 1.7 e 1.8, mas ao contrário de `contributions.assets` da 1.10, que tem uma barreira rígida, essas propriedades são entregues a todo pacote `game-surface`, independentemente da `capabilityApi` declarada. O rótulo 1.11 marca quando surgiram; um pacote que depende delas declara 1.11, e Engines mais antigos o recusam corretamente.

### Capability API 1.12: eventos espaciais para a experiência proprietária

A Capability API 1.12 também endereça os eventos de capacidade espacial ao pacote da experiência proprietária do jogo. `spatial_transition_committed`, `spatial_transition_rejected` e o aviso sem tipo `spatial_context_refresh`, antes enviados apenas a `hierarchical-maps` no evento de janela `marinara-capability-server-event`, passam a ser enviados também com `packageId` igual ao `gameExperienceId` do chat. As cargas variam: um evento confirmado leva `{ chatId, commandId, currentLocationId, definitionRevision, travel? }`; um evento recusado leva `{ chatId, commandId, code?, message? }`, sem campos de localização porque o movimento não aconteceu; o aviso de atualização leva `data: null`. Uma experiência que enviou uma ordem de viagem pelo argumento `pendingSpatialTransition` de `sendMessage` pode confirmar ou limpar a viagem assim que o host conhece o resultado, em vez de deduzi-lo de leituras posteriores. A versão 1.12 também fecha uma lacuna que afetava o World Maps: transições recusadas por um dos dois caminhos HTTP silenciosos, a confirmação antes do streaming do turno proprietário dentro de uma geração ou a confirmação REST independente, antes não geravam evento. Agora os dois sintetizam `spatial_transition_rejected`, somente quando existe evidência definitiva: um código de erro `spatial_*` diferente de `already_applied`. Falhas inconclusivas, como um erro de rede que pode ter perdido uma confirmação bem-sucedida, enviam o aviso sem tipo `spatial_context_refresh`, para que os ouvintes se conciliem com o estado do servidor em vez de aceitar um resultado inventado. Um evento confirmado com `travel.mode` igual a `"step_by_step"` e `complete: false` significa que a viagem continua; mantenha o estado pendente até o evento final. É uma interface flexível como a 1.11: os eventos são entregues independentemente da `capabilityApi` declarada. Declare 1.12 apenas se o pacote precisar dela.

### Capability API 1.13: recolhimento temporário da narração

A Capability API 1.13 acrescenta `requestsCollapsedNarration` à declaração de interface que um pacote `game-surface` envia a `setExperienceChrome`. Enquanto o sinalizador for true, a caixa de narração do Game Mode se recolhe até a alça estreita, permitindo que uma experiência libere a tela para uma cena cinematográfica ou um momento em tela cheia.

Isso é uma SOLICITAÇÃO, não uma preferência. A configuração de recolhimento do jogador nunca é gravada, e o sinalizador só é respeitado enquanto a experiência é a superfície ativa. Remova o sinalizador ou deixe de ser a superfície ativa, e a caixa volta à escolha do jogador. Essa é a garantia de que ela sempre reabre depois; um pacote não pode tornar o recolhimento persistente.

As regras de segurança do Engine têm prioridade. A caixa é aberta à força sempre que o campo de texto do jogador está visível, inclusive no início da cena antes de existir qualquer segmento, e quando os controles de avanço do segmento estão ativos. Esses controles são a única forma de terminar um turno; um pacote capaz de escondê-los poderia prender o jogador para sempre. A alça também continua mostrando o indicador de atenção quando há uma nova tentativa pendente de análise da cena, geração ou geração de combate. Se o jogador abrir a caixa manualmente durante uma solicitação, ela fica aberta até a solicitação terminar. Assim como as interfaces 1.11 e 1.12, esta é flexível: o campo é respeitado independentemente da `capabilityApi` declarada. O rótulo 1.13 marca quando ele surgiu, então um pacote que depende dele declara 1.13.

### Capability API 1.14: superfícies de acompanhamento e ciclo de vida dos agentes

Capability API 1.14 adiciona dois valores de `contributions.slots` para pacotes de agentes Roleplay ativos e habilitados com ponto de entrada do cliente:

- `roleplay-tracker` monta a visualização `toolbar` do pacote no HUD Roleplay. As propriedades incluem `chatId`, `chatMode`, `mobileCompact`, `toolbarButtonClass` do host, `onRerunTracker`, `trackerRetryBusy`, `lockMode` e `onToggleLockMode`. Os callbacks são opcionais: confira se existem antes de usá-los.
- `tracker-panel` monta a visualização `tracker` dentro do Tracker Panel existente, com `chatId`, `chatMode` e `detached`. Reutilize essa superfície em vez de abrir outro painel. Ambos também recebem as propriedades normais de identidade e localização de capacidades.

Contribuições de contexto continuam registradas por `api.registerPromptContext` e exigem `prompt-context`. A solicitação agora expõe `targetCharacterIds`, `personaId` e `placedAgentTypes`, opcional por compatibilidade. `placedAgentTypes` informa ao contribuidor quais seções de dados de agentes o preset já posicionou, para que ele evite duplicar o próprio contexto. O host mantém a identidade do pacote de cada contribuição em `packageBlocks` para posicionar seu texto na seção de agente correspondente. Texto específico para um público deve respeitar os IDs de personagens destinatários recebidos.

Um ponto de entrada do servidor também pode registrar seu serviço de ciclo de vida de pós-processamento por `api.registerService("agent-runtime:<package-id>", service)`. Exige `agent-runtime`; registrar outro ID de pacote é recusado. Os hooks opcionais são:

```ts
const cleanup = api.registerService(`agent-runtime:${packageId}`, {
  prepareContext({ agent, context }) {
    // Return small, JSON-serializable context for this agent, or nothing.
    return { chatId: context.chatId };
  },
  finalizeResult({ agent, context, preparedContext, result }) {
    // Validate or enrich the result before the host publishes/applies it.
    return result;
  },
});
// Return cleanup from activate(), or include it in the activation cleanup.
```

`prepareContext` roda antes do pós-processamento; seu resultado não nulo pertence ao agente e entra no prompt como contexto de execução serializado. `finalizeResult` recebe esse valor e o resultado gerado, e retorna um `AgentResult`. A geração e as novas tentativas manuais esperam a finalização antes de publicar. Cada hook assíncrono tem dois segundos: uma preparação com falha é registrada e ignorada; uma finalização com falha transforma o resultado em falha, sem aplicar saída não validada. São hooks curtos do host, não um lugar para outra chamada lenta ao modelo.

Essas adições não têm controle de versão 1.14 por campo. Um pacote pode detectar propriedades opcionais e funcionar com menos recursos em motores antigos; se precisar dessas superfícies, posicionamento ou ciclo de vida, deve declarar `capabilityApi: { major: 1, minor: 14 }` no manifesto v2 para que um motor anterior recuse a instalação corretamente.

### Capability API 1.15: configuração atual de embeddings

`api.runtime.resolveEmbeddings()` retorna um novo `Promise<CapabilityEmbeddingHost>` com a configuração atual da conexão do agente do pacote. Chame-o ao iniciar cada operação de embeddings em vez de guardar `api.runtime.embeddings`, que é o instantâneo da ativação e não acompanha mudanças posteriores sem reativação.

```ts
const embeddings = await api.runtime.resolveEmbeddings();
const vectors = await embeddings.embed(texts, signal);
// Store/compare embeddings.spaceId with persisted vectors; do not mix embedding spaces.
```

O host retornado tem `spaceId`, `label` e `embed(texts, signal?, inputType?)` (veja a Capability API 1.68 para o tipo de entrada). Usa a fonte de embeddings configurada e recorre ao gerador local MiniLM integrado se nenhuma estiver disponível ou se a resolução da configuração falhar. `embed` pode retornar `null`; lotes vazios, mais de 128 textos ou mais de 200.000 caracteres somados são recusados. Um novo host não recalcula vetores existentes: o pacote deve tratar mudanças de `spaceId` antes de comparar vetores novos e salvos.

O método está disponível nos motores atuais independentemente da versão API declarada. Declare API 1.15 se precisar acompanhar mudanças de conexão. Para aceitar motores antigos, você pode verificar `typeof api.runtime.resolveEmbeddings === "function"` e recorrer a `api.runtime.embeddings`, aceitando sua limitação ao estado da ativação.

### Capability API 1.16: verbos do Game Master declarados por pacotes

Capability API 1.16 permite que um pacote Experience declare uma lista curta e fechada de ações nomeadas do Game Master, chamadas verbos. O motor as apresenta no lembrete de formato do GM, extrai da narração concluída e executa em nome do pacote. Nenhum código de servidor do pacote roda para isso: uma Experience `game-surface` só com pontos de entrada `agents` e `client` pode fazer o GM mudar seu mundo pela prosa.

A integração está completa: esquema, nomes reservados e propriedade de chaves, leitor da tabela, renderização do prompt e executor. Um pacote que fornece a tabela e possui `chat-write` tem seus verbos no lembrete de cada turno Game do chat vinculado e eles são executados quando o GM os usa. Um chat sem pacote vinculado, ou com um pacote sem tabela, resolve zero verbos e mantém um turno idêntico byte a byte ao anterior à integração.

Declare a tabela como `gm-verbs.json`, incluída em `contributions.assets.paths` e fixada por hash em `files[]`, como qualquer recurso. Ela é descoberta por esse nome reservado, uma convenção nova: todos os demais arquivos são lidos por caminhos declarados (`entrypoints`, ícones, recursos), e nada mais é descoberto pelo formato. Um arquivo em `files[]` mas ausente de `contributions.assets.paths` não gera diagnóstico na instalação nem na construção do catálogo: o pacote simplesmente fica sem verbos. O recurso declarado é servido sem proteção em `/api/capability-packages/<id>/assets/gm-verbs.json`, pois essa rota não verifica acesso privilegiado; a tabela nunca deve conter informações sensíveis. Como 1.11–1.13, é uma integração opcional: motores antigos veem um recurso JSON comum e o ignoram. Você pode incluí-lo sem restringir versões; declare `capabilityApi` 1.16 somente se o pacote precisar dos verbos, pois isso recusa todos os motores anteriores.

O documento é `{ "schemaVersion": 1, "verbs": [ … ] }`, com 1–16 verbos. Cada verbo é estrito: chaves desconhecidas são recusadas. Campos desconhecidos ao lado de `schemaVersion` e `verbs` recebem deliberadamente outro tratamento: o motor os remove para aproveitar os verbos que entende de uma tabela mais nova, enquanto o esquema compartilhado de autoria é estrito e os recusa. A validação ao escrever é, portanto, mais rigorosa que a leitura em execução:

```json
{
  "schemaVersion": 1,
  "verbs": [
    {
      "name": "weather",
      "description": "Set the sky when the weather visibly changes.",
      "effect": "state",
      "metadataKey": "pixelforgeWeather",
      "args": [
        { "name": "word", "type": "string", "enum": ["fair", "overcast", "rain", "storm", "snow"] },
        { "name": "intensity", "type": "string", "enum": ["light", "heavy"], "optional": true }
      ]
    }
  ]
}
```

Um nome de verbo segue `[a-z][a-z0-9_]*`, tem no máximo 32 caracteres e não pode coincidir com as tags entre colchetes do GM próprias do motor. A verificação ignora maiúsculas: o lembrete escreve `[Note:` e `[Book:`, mas a expressão de análise não distingue o caso; `note` ocultaria a tag do diário. O conjunto reservado vem de todas as tags que os lembretes do GM e do grupo podem produzir em suas ramificações e dos cinco analisadores de narração: analisador de tags e formatador do cliente, editor de segmentos do servidor, analisador de cenas do sidecar e reescritor de diálogo da rota de geração. Seu vocabulário também inclui `main`, `side`, `extra`, `action`, `thought`, `whisper` e o par `qte_bonus` / `qte_result`, reconhecido só pelo formatador. Um verbo `whisper` removeria `[whisper:Tam]` de uma fala antes de salvar, e a linha deixaria permanentemente de ser diálogo.

As regressões também fixam os extratores: cada analisador com nomes exclusivos, como `party-chat` / `party-turn` ou o par QTE, precisa continuar fornecendo esses nomes. Se uma fonte deixar de ser varrida, a compilação falha em vez de reduzir o conjunto silenciosamente. Os outros três também são percorridos para detectar novas tags. Isso não garante completude: uma tag em arquivo não examinado ou escrita em formato que o extrator não entenda pode escapar; amplie o conjunto quando surgir outro analisador. Palavras comuns como `action`, `state`, `status` e `note` também são reservadas; a recusa geralmente vem dessa regra, não de erro de digitação.

`description` ocupa uma linha de 1–200 caracteres sem colchetes nem quebras, pois entra literalmente em `COMMANDS:`. Além de CR e LF, são proibidos `U+0085`, `U+2028`, `U+2029`, controles C0 e DEL, inclusive tabulações, que deformam o bloco. Depois, porém, as macros do lembrete inteiro são expandidas: `{{…}}` dentro da descrição é avaliado, inclusive `{{setvar::…}}`, que escreve variáveis do chat. Isso não concede mais acesso que `chat-write`, mas evite essas chaves se não forem intencionais. Um verbo aceita até seis argumentos `{ name, type, enum?, maxLength?, optional? }`, nomeados com `[a-z][a-zA-Z0-9_]*` em até 32 caracteres. Diferentemente do verbo, maiúsculas são permitidas porque são chaves JSON, não tags. Só strings aceitam `enum`, com 1–16 valores distintos; duplicatas são recusadas. Uma string sem enum deve declarar `maxLength` de 1–500: a análise delimitada do executor não herda outro teto e poderia aceitar um fragmento inteiro de narração. Declarar `enum` e `maxLength` juntos é recusado, pois o enum já limita o valor. As cargas são JSON plano de uma linha; um `}` aninhado encerra a correspondência antes da hora. Só uma instância de cada nome é analisada por mensagem, então um verbo repetido é aplicado uma vez.

Não é preciso explicar os argumentos na descrição. A tabela analisada produz uma carga esquemática, a descrição e um exemplo copiável:

```
- [weather:{"word":"fair|overcast|rain|storm|snow","intensity"?:"light|heavy"}] — Set the sky when the weather visibly changes. Example: [weather:{"word":"fair"}]
```

O esquema ensina o vocabulário: argumentos na ordem, opcionais marcados com `"name"?:` fora da string JSON, alternativas completas dos enums, limite das strings livres e números ou booleanos sem aspas. O validador recusa `"3"` como número em vez de converter. O exemplo só mostra um valor de enum; com apenas `{"word":"fair"}`, o GM pode escrever "sunny", recusado sem aviso visível. A tag é removida quando o nome corresponde, não quando a validação passa: a narração fica limpa, mas o mundo não muda. Derivar esquema e exemplo da mesma tabela evita divergências; os valores não ficam mais numa descrição que poderia prometer algo inválido. Use os 200 caracteres para explicar quando agir, não para repetir argumentos.

A degradação é por verbo. Um `effect` mais novo, formato impossível de representar, nome reservado ou chave alheia é ignorado com uma linha de registro; os demais continuam, como em `parseCapabilityCatalogWithCompat`. Se um verbo não aparece, leia o registro. Um documento inutilizável, com `schemaVersion` desconhecido, array `verbs` vazio ou raiz que não é objeto, produz tabela vazia e uma linha de registro. A tabela também é recusada antes da leitura se seu `files[].bytes` declarado exceder 64 KB; `files[]` aceita até 100 MB e nada mais limita um recurso antes de ler. Em qualquer falha, o turno sobrevive sem alterações.

Um verbo com `metadataKey` é um **verbo de estado**: grava todos os argumentos sob essa chave nos metadados do chat; o pacote vê a mudança pelas propriedades usuais. Sem `metadataKey`, é um **verbo de evento**, entregue ao vivo como evento de cliente de capacidade, sem gravação durável, fila, repetição nem confirmação. Um evento recusa `metadataKey` para não ocupar uma chave que não escreve; o estado a exige.

O estado é durável e nunca reverte: trocar a variante, editar ou excluir o turno mantém o valor. A última variante gerada vence, não a última exibida; prosa e mundo podem divergir sem reconciliação. Um evento não tem memória: um quadro, um despacho síncrono. É perdido silenciosamente se o turno for abortado, a aba fechar ou recarregar durante a transmissão, chegar antes da primeira montagem do pacote, o jogador mudar de chat ou a tela de carregamento do pacote estiver ativa. Nada o reenvia. Em troca, seu efeito pode reverter com a história se o pacote o guardar onde voltar no tempo reconstrói o estado; os metadados do chat não retrocedem. Um evento aplicado ao estado vivo e perdido numa recarga forçada antes do próximo salvamento não deixa vestígio em nenhum dos casos.

A semântica relativa é proibida por projeto nos dois tipos. O estado sobrescreve valores absolutos e não pode expressar "adicionar cinco moedas". Um evento relativo também é proibido: regenerar cria um índice de variante novo sem carregar as marcas da anterior, então acumularia uma vez por variante gerada. Deduplicar por `chatId:messageId:swipeIndex` evita reenvios, que esse canal não faz, mas não regenerações, que faz. Valores absolutos, não um registro de transações, tornam seguro aplicar um verbo duas vezes. Transforme qualquer vocabulário relativo em valores absolutos por mensagem.

Se um turno contém os dois tipos, o evento síncrono chega antes de terminar a busca assíncrona do estado atualizado. Seu manipulador não deve ler o efeito de um verbo de estado do mesmo turno esperando o valor novo.

O motor só valida o formato: nomes e tipos de argumentos, participação nos enums e limites de strings. A semântica pertence ao pacote: não se pode enumerar NPCs ao declarar um mundo compilado por chat. A recusa do pacote a um verbo de estado é apenas orientativa, pois os metadados já foram gravados ao recebê-lo. Para um evento, a recusa é efetiva: o motor não gravou nada e o pacote pode realmente rejeitar um nome desconhecido.

`metadataKey` deve pertencer ao pacote sob três regras: começa com seu ID normalizado em camelCase (`hierarchical-maps` → `hierarchicalMaps`), continua com um sufixo não vazio que começa em maiúscula, e o ID normalizado não pode ser um namespace do motor nem estendê-lo numa fronteira de maiúscula. Isso impede roubar o prefixo de outro pacote. A lista do motor deriva de todas as chaves superiores de `ChatMetadata`, de suas constantes e das chaves presentes só na assinatura de índice, como `encounterActive`, `internalAssistant` e `imageGenConnectionId`, invisíveis para as duas primeiras fontes.

Esse terceiro grupo exige sete fontes: os objetos passados a `patchMetadata`/`updateMetadata`; os retornados por callbacks de atualização, quase tão frequentes; a mutação `useUpdateChatMetadata()` e a propriedade `onMetadataChange` do cliente, que nunca passam por `patchMetadata`; chamadas diretas `PATCH /chats/:id/metadata`, usadas sem esse hook para chaves de combate, cena e narração; leituras `chatMetadata.key` e `chat.metadata.key`; leituras do resultado de `parseChatMetadata(…)`, a forma mais comum e a única que vê `scenario`; e a lista manual de chaves por chat dos perfis de configurações, que cobre chaves lidas e escritas através de limites entre funções.

As regressões fixam todas as fontes e extratores. Há dois limites deliberados. Uma escrita que recebe variável ou resultado de função, como `patchMetadata(id, hydratedMeta)` ou a mesma forma na rota de metadados, contém chaves invisíveis a uma varredura estática: existem vinte chamadas assim e a regressão fixa esse número; a vigésima primeira exige leitura manual. Uma leitura dentro de um auxiliar a partir de um parâmetro também fica fora do alcance: é o caso de `spatialContext`, escrito pelo cliente de `hierarchical-maps` distribuído no repositório Agents e lido aqui por um auxiliar e análise local ao arquivo. A lista manual cobre esse segundo ponto; por isso uma das sete fontes é selecionada à mão. Os limites são declarados em vez de negados. `persona` também é um mínimo adicionado manualmente que nenhuma fonte produz hoje.

A terceira regra recusa pacotes inteiros de propósito: `conversation-calls` vira `conversationCalls`, e `conversationCalls` + `Enabled` já é uma chave do motor. Esse pacote não pode possuir chaves sob seu ID; `noodle` e `background` estão na mesma situação, este último porque `background` já é, por si só, uma chave de metadados de chat do motor. Eles ainda podem declarar eventos, que não possuem chaves. As chaves são planas e no nível superior porque esse é o formato que o reconciliador do pacote já lê.

Comandos do modelo declarados por um pacote só são executados se ele declarar `chat-write`, estiver instalado e estiver pronto. Essa permissão também controla gravações pela API de persistência do pacote, incluindo mensagens, metadados do chat, eventos de roleplay e snapshots espaciais. `chat-read` controla leituras de chats, mensagens, estado do jogo e snapshots espaciais. As mesmas verificações se aplicam dentro de transações de persistência e bloqueios do chat; uma permissão de gravação não concede implicitamente permissão de leitura. Chamadas de persistência do próprio motor continuam sendo confiáveis.

Após a instalação, a visualização de detalhes de **Agent Organizer** (organizador de agentes) mostra as permissões declaradas pela versão instalada. Quando a versão do catálogo solicita permissões diferentes, elas aparecem separadamente. Instalar ou atualizar código ainda exige a aprovação existente vinculada àquela versão e soma de verificação exatas; comandos do modelo não pedem aprovação separada a cada turno.

São verificações de API, não um ambiente isolado de JavaScript. Permissões de rede, armazenamento e interface são declarações de acesso. O código do pacote no navegador e no servidor continua sendo código confiável e pode acessar o ambiente do host; instale apenas pacotes em que você confia. A verificação considera se o pacote está pronto, e não apenas se pode ser servido: uma atualização que o deixe em `restart-required` interrompe a resolução de seus comandos até o motor reiniciar.

### Capability API 1.17: preparar uma Experience antes do primeiro turno

Um pacote `game-surface` pode declarar `contributions.gameSurface.prepareBeforeStart: true` com a versão 2 do esquema e Capability API 1.17. O Engine monta essa superfície quando o jogo está pronto, antes de habilitar **Start Game** (iniciar jogo). Jogos clássicos e pacotes sem essa marca mantêm o fluxo de inicialização atual.

A superfície principal que ativa essa opção recebe duas propriedades adicionais:

- `startup: boolean` permanece true até o jogador concluir a introdução do Engine com **Continue** (continuar). Pause a simulação do mundo e as ações do jogador enquanto o valor for true.
- `setStartupReady(context: string | null): void` informa o estado da preparação. Envie `null` durante o carregamento, o salvamento ou a recuperação de uma falha. Envie uma string somente quando o mundo real estiver salvo de forma persistente e utilizável; uma string vazia permite iniciar sem contexto adicional.

O host bloqueia **Start Game**, sua confirmação de preparação dos widgets e as novas tentativas do primeiro turno até receber uma string de prontidão. Durante o bloqueio, a interface de carregamento e de falha/nova tentativa do próprio pacote continua visível. Quando fica pronto, o pacote é ocultado atrás da introdução normal do Engine. **Continue** abre a superfície habitual, que pode ser montada novamente: mantenha a preparação do mundo idempotente e restaure o estado salvo em vez de gerá-lo outra vez. Retornar a um jogo cuja introdução já terminou não repete a preparação inicial.

O contexto de abertura tem um limite de **8.000 caracteres**. Um contexto inválido ou longo demais mantém a inicialização bloqueada e exibe um erro; o host não corta fatos do mundo. Forneça um relato compacto do local inicial preparado e dos personagens que realmente estão nele. O Engine acrescenta esse texto ao `generationGuide` existente do primeiro turno com a origem `game_start`, para que a abertura use o mundo que existe. Isso não registra contexto para os turnos seguintes; continue usando a contribuição normal do pacote ao prompt ou seu contexto de geração de turno.

Os callbacks de prontidão pertencem ao chat, ao jogo e ao pacote montados. Chamadas atrasadas de outro escopo são ignoradas. Uma falha do módulo ou do ambiente de execução bloqueia a inicialização em vez de tratar a falta de contexto do mundo como sucesso. Após recarregar, o pacote deve informar a prontidão a partir do mundo salvo. O provedor de contexto do prompt no servidor continua sendo somente leitura e sujeito ao seu prazo curto; não o use para gerar o mundo nem como uma barreira prolongada de inicialização.

### Capability API 1.19: ferramentas fornecidas por pacotes

A Capability API 1.16 permitia que um pacote fizesse o modelo _dizer_ algo sobre o qual pudesse agir. Esta versão permite que o modelo _chame_ algo. Um pacote com a nova permissão `tools` registra uma ferramenta com nome no ponto de entrada do servidor. O Engine a oferece junto das ferramentas integradas em cada turno de cada chat, valida a chamada com o JSON Schema do pacote e entrega os argumentos ao manipulador.

```ts
export async function activate({ api }) {
  api.registerTool({
    name: "set_time",
    description: "Move the world clock forward or back.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["advance", "rewind"] },
        minutes: { type: "integer", minimum: 0 },
      },
      required: ["action", "minutes"],
      additionalProperties: false,
    },
    handler: async (args, { chatId }) => {
      const clock = await moveClock(chatId, args.action, args.minutes);
      return { time: clock.label };
    },
  });
}
```

A escolha de chamadas de ferramentas em vez de um formato de resposta é intencional. Um formato ocupa a resposta inteira: a narração teria que ser um campo de um objeto JSON e não poderia chegar por streaming. Uma chamada pode acompanhar o texto enquanto o modelo escreve o turno. O pacote recebe argumentos já restringidos pelo provedor, em vez de extraí-los da narração pronta. Um esquema impõe regras; uma convenção apenas pede que o modelo as respeite.

As enumerações mostram a diferença. Um pacote que conhece doze lugares pode incluir os doze nomes no esquema. Um décimo terceiro nome é recusado antes de chegar ao manipulador. O validador de argumentos existente do Engine indica os valores aceitos para que o modelo possa corrigir a chamada. O retorno do manipulador é mostrado ao modelo como resultado da ferramenta.

Antes de escrever uma ferramenta, conheça estas regras:

- Os nomes usam `<packageId>_<name>`, trocando `-` por `_`: `set_time` de `world-clock` chega ao modelo como `world_clock_set_time`. Um nome já pertencente a outro pacote é recusado. Ferramentas integradas e ferramentas personalizadas ativadas mantêm os nomes em conflito; a definição do pacote é omitida. O nome completo aceita no máximo **64 caracteres**. Tanto as definições quanto a execução seguem esta ordem: integrada, personalizada, pacote.
- As ferramentas são anexadas enquanto o pacote estiver ativo. Não há um segundo controle por chat como nas ferramentas integradas: declarar a permissão e registrar a ferramenta é a decisão. O provedor selecionado precisa aceitar chamadas nativas de ferramentas.
- O esquema de parâmetros é copiado e compilado no registro. Se o Engine não conseguir compilá-lo, a ativação falha, tornando o problema visível durante o desenvolvimento em vez de no meio do turno.
- Se o manipulador lançar um erro, a chamada falha e o erro é registrado; sua mensagem não é encaminhada ao modelo. Após **10 segundos** sem resultado, o turno também deixa de esperar. O manipulador continua executando, mas não pode bloquear o turno inteiro.
- Os resultados precisam ser serializáveis em até **64 KiB**. Resultados maiores ou não serializáveis fazem a chamada falhar em vez de ocupar o espaço da conversa. Descrições e resultados são conteúdo confiável do pacote. Verifique `chatId` antes de ler ou alterar dados de um chat.
- Cada definição é serializada na solicitação ao provedor em cada turno e conta no ajuste de contexto. Os limites são **16 ferramentas por pacote**, **64 no total**, **512 caracteres** por descrição e **8 KiB** por esquema de parâmetros. Ultrapassá-los lança um erro e impede a ativação. Registrar novamente um nome do próprio pacote substitui a ferramenta sem ocupar outra vaga.
- O contexto de ativação para de funcionar quando ela termina. Se o pacote guardar `api` e chamar `registerTool` em um callback posterior, a chamada será recusada. Uma execução encerrada não pode registrar ferramentas nem substituir as de uma nova ativação.
- Desativar, atualizar ou remover um pacote libera suas ferramentas. O modelo não recebe ferramentas de um pacote que não pode mais responder. As ferramentas são removidas antes de aguardar a limpeza; cada callback de limpeza tem um prazo de 8 segundos.

Esses prazos limitam apenas a espera assíncrona. Os pacotes executam código confiável no processo do servidor; um temporizador não pode interromper trabalho síncrono que bloqueia o loop de eventos. O cancelamento forçado exigiria um worker ou processo separado, que esta API não oferece.

`api.registerTool` só existe a partir desta versão do Engine. Um pacote que dependa dele precisa declarar `capabilityApi` 1.19 e não será instalado em versões anteriores.

## Declarações de decisão e o modelo de decisão

O **Decision model** (Modelo de decisão) do usuário responde a declarações de sim/não e de opções sobre o chat recente. Veja [Modelos de decisão](../connections/decision-models.md) para entender sua função e configuração.

Um template de prompt de agente incluído num pacote pode usar `{{#if decision:"..."}}` e `{{#if decision_choice:"..." == "..."}}` como um agente personalizado. O motor encontra as declarações e pergunta antes de executar o agente (depois da resposta, para pós-processamento), resolvendo o template com as respostas. Nenhuma versão da API de capacidades está envolvida. Veja a sintaxe e a redação em [Prompts condicionais](../prompts/conditional-prompts.md#asking-the-decision-model) e as fases em [Criar agentes personalizados](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

O código de servidor do pacote também pode fazer ao modelo de decisão configurado pelo usuário perguntas limitadas de sim/não e de Choice sobre o contexto que o pacote fornece, por meio de `api.runtime.decisions.evaluate(...)`. Ele usa o mesmo modelo de decisão das perguntas de ativação de agentes e dos condicionais de prompt (um modelo local gerenciado ou uma conexão de decisão) e nunca expõe chaves nem partes internas do Engine. `decisions` é opcional e não exige uma API de capacidades mais nova nem permissão: verifique `typeof api.runtime.decisions?.evaluate === "function"` e use uma alternativa em Engines antigos.

```ts
const result = await api.runtime.decisions?.evaluate({
  messages: [{ role: "user", content: "The tavern falls silent as the stranger draws a blade." }],
  questions: [
    { id: "danger", question: "Someone is about to be attacked." },
    { id: "mood", question: "The mood of the scene is", options: ["calm", "tense", "festive"] },
  ],
  // Optional: pass `signal` to cancel and `debugMode: true` to log the Decision prompt.
});
// null: no Decision model is configured, or it gave no answer (unreachable, timed out or cancelled).
if (result && (result.answers.danger ?? 0) >= result.threshold) {
  // ...
}
```

- `messages` é o contexto do próprio pacote, da mais antiga para a mais recente (no máximo 200 mensagens e 200.000 caracteres; o `name` de uma mensagem tem no máximo 100 caracteres). As mensagens mais antigas são descartadas para caber no modelo.
- Cada `question` tem no máximo 500 caracteres; os ids devem ser únicos. Uma pergunta Choice tem pelo menos duas `options`, e a resposta dela é uma delas ou `"none of these"`.
- Uma requisição pode pedir no máximo tantas respostas quanto o limite **Decision statements per turn** (declarações de decisão por turno) do usuário; cada opção de Choice conta uma vez, mais uma. Uma requisição inválida lança um `TypeError`.
- `answers` guarda a probabilidade de sim de cada pergunta de sim/não, e uma pergunta ausente não foi respondida. Compare com `threshold`, o ponto de operação do próprio modelo: as probabilidades não são comparáveis entre modelos de decisão.

Projete cada uso para quem não tem modelo de decisão. Uma declaração sem resposta vale não: a ramificação `{{else}}`, ou nada, precisa ser um padrão sensato. Escreva para um modelo de decisão em geral, sem exigir Jev: modelos de chat locais e outros backends compatíveis usam a mesma sintaxe, mas podem responder diferente. Veja [Limiares](../connections/decision-models.md#thresholds) e [Limites e custo](../prompts/conditional-prompts.md#limits-and-cost) antes de depender de uma pontuação, quantidade de solicitações ou resposta em cache específica.

### Nota para desenvolvedores de Experiences de Game Mode

O combate do motor decide sozinho o que os inimigos comuns fazem. Cada inimigo não chefe do GM recebe uma função conforme suas habilidades e classe (bruiser, bulwark, skirmisher, marksman, spellcaster, supporter ou controller), proficiência conforme o nível, salvo se a definir (novice, trained, veteran ou master), e temperamento como reckless, cautious, opportunistic ou protective. Bestas e monstruosidades são sempre mindless. O código escolhe isso a partir de uma semente sem chamar o modelo; a dificuldade muda a consistência com que seguem seu tipo. Só chefes criados explicitamente são dirigidos pelo GM por uma chamada ao modelo. Veja [IA de combate de Game Mode](game-combat-ai.md).

Há mais melhorias de combate a caminho. Antes de introduzir decisões, confira se o combate padrão do motor já atende à necessidade. Para uma personalidade específica, atribua primeiro a proficiência e o temperamento correspondentes. Uma decisão por turno inimigo adicionaria trabalho do modelo e um prazo; um backend hospedado também adicionaria solicitações de rede e cobranças. A luta dependeria de um modelo que o usuário talvez não tenha configurado e precisaria de um comportamento sensato sem resposta.

## Pacotes iniciais

- todos os agentes hoje embutidos;
- mapas espaciais hierárquicos para Roleplay e Game;
- chamadas de áudio e vídeo no Conversation Mode;
- UNO;
- Chess;
- Poker;
- 8-Ball Pool;
- Tic-Tac-Toe;
- Rock-Paper-Scissors.

A base guarda o gerenciador de pacotes, o cliente do catálogo, os contratos genéricos do pipeline de agentes, os contratos genéricos de hospedagem de jogos por turno e as interfaces de hospedagem inertes. As implementações concretas pertencem aos pacotes.

## Confiança e instalação

O catálogo oficial é um documento JSON versionado e validado por esquema, obtido por HTTPS. Cada entrada de versão traz URLs de artefato imutáveis, digests SHA-256, tamanho em bytes, compatibilidade com o Engine, permissões e a informação de que o tempo de execução exige ou não reiniciar. Uma entrada de conjunto de regras também pode listar `locales`, seus pacotes de idioma por idioma (Capability API 1.811), cada um com URL, digest SHA-256 e tamanho em bytes próprios, além do nome e da descrição traduzidos do cartão da loja. O Engine busca apenas o pacote no idioma atual dele após instalar o conjunto de regras, e novamente quando o idioma dele muda (`POST /api/capability-packages/rulesets/language`, enviado pela página ao abrir e a cada mudança), mantendo esse pacote junto da versão instalada e removendo os demais; veja [Escrever conjuntos de regras de Game Mode](../extending/writing-rulesets.md).

As atualizações exigem o consentimento do usuário: além das migrações únicas que preservam os antigos recursos embutidos de uma instalação atualizada (veja [Migração de compatibilidade](#compatibility-migration)), a inicialização nunca baixa nem instala um pacote. `GET /api/capability-packages/updates/pending` lista cada pacote oficial instalado cuja versão no catálogo é mais nova e compatível com o Engine e a API de capacidades em uso, deixando de fora uma versão que o usuário já recusou. O cliente mostra todos em um único aviso **Agent updates available** (atualizações de agentes disponíveis). **Update all** (atualizar tudo) instala cada um pelo fluxo normal de instalação, fixado na versão oferecida e no SHA-256 do artefato. **Not now** (agora não) registra as versões recusadas em `DATA_DIR/capability-packages/update-decisions-v1.json` (`POST /api/capability-packages/updates/decline`), para que essa versão não seja oferecida de novo, enquanto uma mais nova será. **Update** (atualizar) continua disponível em **Agent Organizer (organizador de agentes)** de qualquer forma. Uma falha afeta só o pacote em que aconteceu. Os arquivos existentes e o estado do registro continuam utilizáveis se o catálogo estiver fora do ar ou se a verificação falhar, e falhas de prontidão do servidor usam o caminho de rollback para a versão anterior.

As notas de versão são publicadas como `notes.json` ao lado do `catalog.json` que descrevem, nunca dentro de uma entrada de catálogo nem de um manifesto: um Engine mais antigo descarta uma entrada de catálogo com uma chave que não conhece. Cada atualização pendente traz, como `releaseNotes`, as notas de todas as versões depois da instalada até a oferecida, da mais nova para a mais antiga, e `releaseHighlight` é verdadeiro quando alguma delas está marcada como uma mudança que o usuário vai perceber. As notas são texto simples e nunca são renderizadas como Markdown ou HTML.

O instalador precisa:

1. exigir acesso privilegiado por loopback ou de administrador;
2. impor HTTPS, limites de download e tempo limite;
3. verificar a confiança do catálogo e o SHA-256 do artefato antes de extrair;
4. rejeitar caminhos absolutos, travessia de caminho, links, arquivos de dispositivo e arquivos não declarados;
5. validar o manifesto e a compatibilidade com o Engine;
6. extrair em uma pasta temporária vizinha;
7. ativar de forma atômica só depois que a validação passar;
8. manter a versão anterior até que o novo tempo de execução inicie sem erro;
9. desfazer a ativação em caso de falha;
10. nunca executar scripts de instalação, atualização ou desinstalação.

O catálogo oficial só habilita pacotes executáveis confiáveis produzidos pelo próprio projeto. Um fluxo futuro para pacotes de terceiros exige um modelo de confiança separado e explícito.

## Execução e comportamento de reinício

O servidor é dono do registro de pacotes instalados e informa aos clientes quais capacidades estão disponíveis. Os módulos declarativos e recarregáveis entram em uso na hora. A interface invalida as consultas de catálogo, de agentes, de capacidades de modo e do chat ativo depois da ativação.

O manifesto só pode declarar `restartRequired` quando o host não consegue recarregar aquele ponto de entrada com segurança. A ativação a quente bem-sucedida mostra `Agent installed. It is ready to use.` A ativação que exige reinício mostra `Agent installed. Restart Marinara Engine to finish setup.`

Os pacotes de jogo por turno são recarregáveis a quente: a instalação registra na hora o motor no servidor e o lançador manual por comando de barra, e a desinstalação desconecta o tempo de execução sem reiniciar o Engine. As configurações de Conversation Commands de cada chat controlam apenas se os personagens podem emitir o comando oculto do pacote; elas não bloqueiam o lançador por comando de barra do usuário. Os manifestos oficiais de jogo por turno ainda trazem a marca conservadora de reinício, herdada, por compatibilidade com o Engine 2.x; o Engine 3.x reconhece o tipo `turn-game`, faz a ativação a quente com segurança e devolve o pacote como ativo e pronto.

### Uso de disco: cópias de execução e versões mantidas

O servidor de um pacote não roda a partir de `DATA_DIR/capability-packages/versions/<id>/<version>`. Cada ativação verifica os arquivos instalados, copia-os para uma pasta nova em `DATA_DIR/capability-runtime-snapshots` e importa a cópia. A cópia é excluída quando esse tempo de execução para.

- **Cópias de execução.** Uma cópia contém todos os arquivos verificados do manifesto, exceto o ponto de entrada do cliente. O servidor nunca o carrega, e o navegador o obtém de `versions/`. Os recursos ficam, então um servidor pode ler arquivos ao lado do `server.mjs` dele, como o Quartermaster faz com `icons/`. Os arquivos copiados são somente leitura.
- **Limpeza na inicialização.** Uma falha ou uma parada forçada pula a limpeza de uma cópia. A cada início, antes de qualquer pacote ser ativado, o Engine exclui todas as entradas de `capability-runtime-snapshots`, exceto os links compartilhados de `node_modules`, porque nenhuma delas pode estar em uso pelo novo processo. Ele primeiro torna graváveis os arquivos somente leitura, o que o Windows exige, e nunca segue links. Só o processo que detém a concessão de gravação do armazenamento chega a esta etapa, então um segundo Engine iniciado na mesma pasta de dados para ao abrir o armazenamento e nunca exclui as cópias de um Engine em execução.
- **Versões mantidas.** `versions/<id>` mantém a versão atual e a `previousVersion`, que o rollback restaura quando um tempo de execução novo do servidor não consegue iniciar. As versões mais antigas, e uma versão da qual uma atualização com falha foi revertida, são excluídas depois que uma ativação ou uma atualização dá certo e na inicialização. Um pacote cuja atualização espera um reinício (`restart-required`), ou cujo tempo de execução ainda não iniciou (`readiness: "pending"`), mantém todas as versões até ter iniciado.
- **Nunca excluídos:** os dados dos pacotes (pastas como `DATA_DIR/long-term-memory` e as tabelas do pacote em `storage`), os chats, as configurações, `installed.json`, as decisões de atualização, as pastas `.install-*` e as pastas de `versions/` de ids que não estão no registro. A desinstalação continua removendo o código do pacote e mantendo os dados dele.

<a id="compatibility-migration"></a>

## Migração de compatibilidade

Na primeira vez que o aplicativo abre depois da atualização:

- os agentes personalizados ficam intactos;
- todo agente embutido antigo visível naquela instalação é registrado como instalado;
- os mapas, as chamadas do Conversation Mode e os jogos do Conversation Mode continuam disponíveis como antes;
- a configuração de cada chat, os snapshots, o estado do jogo, o histórico de chamadas e a memória dos agentes continuam onde estavam;
- a migração é idempotente e só registra sua conclusão depois que todas as entradas de disponibilidade antigas estão gravadas em disco.

Os artefatos dos pacotes antigos continuam no catálogo oficial como origem para a migração. Uma instalação nova não exibe nem ativa esses pacotes até o usuário instalá-los.

## Desinstalação

A desinstalação tira o pacote das seleções dos chats ativos, exclui a configuração do agente e os arquivos executáveis baixados, e desconecta o tempo de execução no próximo reinício, quando necessário. Os chats antigos, as mensagens, os snapshots de mapa, os resumos de chamadas e os registros de partidas concluídas continuam legíveis, então remover um pacote nunca destrói o trabalho do usuário. A remoção destrutiva dos dados históricos é uma ação separada e explícita do usuário.

Toda desinstalação pede confirmação. Os chats afetados voltam às telas comuns da base, sem corromper o histórico.

## Interface do catálogo

O painel **Agents** (agentes) tem um controle `Agent Organizer` equivalente ao botão `Download` dos painéis Characters e Personas, que abre o Card Browser. Ele abre uma biblioteca responsiva em tela cheia com busca, tipos de pacote, informações de compatibilidade, estado de instalação e atualização, permissões, espaço ocupado, documentação e controles de desinstalação.

No computador, aparece uma barra lateral com busca, filtro de modo e seções ao lado das páginas da loja. No celular, a busca, o filtro de modo e os chips de seção aparecem acima da página; a página de um agente substitui a lista, com navegação explícita para voltar e ações grandes o bastante para o toque. Os estados de lista vazia, sem conexão, incompatível, download corrompido, instalação interrompida, atualização, rollback e reinício necessário são tratados como estados de primeira classe.

## Critério de extração

Uma extração só está completa quando os bundles de produção do cliente e do servidor da base não contêm mais a implementação do pacote, quando uma instalação nova não consegue ativá-lo sem baixar o pacote, quando uma instalação atualizada continua com ele e quando instalar, atualizar e desinstalar o pacote funciona em computador, celular e sistemas de arquivos compatíveis com Termux.

### Capability API 1.30: ferimentos, gasto em testes e combate sobre uma trilha

Uma entrada `live.tracks` pode declarar `levels` e `kinds` para passar de inteiro limitado a TRILHA DE FERIMENTOS: casas com seus próprios rótulos e penalidades, sobre as quais ficam as marcas. `levels` tem 1–16 níveis, do melhor ao pior, cada um com `label` e `penalty` inteiro. `kinds` tem 1–6 tipos de dano, cada um com `id`, `label` curto e `severity` distinta. Eles andam juntos: `kinds` sem `levels` é recusado, pois não haveria onde marcar. `resolution.penaltyFrom` nomeia a trilha cuja penalidade afeta toda rolagem: em `dice-pool`, retira dados sem baixar de `pool.min`; em `dice-sum`, é um modificador fixo.

O restante da 1.30 inclui estas adições; um pacote que use qualquer uma deve declarar 1.30:

- `combat.health` pode nomear uma trilha de ferimentos em vez de uma reserva. `combat.damageKinds` informa o que cada tipo marca: `default`, um mapa `byType` opcional e `marks`, com `per-blow` para uma casa por golpe acertado ou `per-point` para contar níveis de saúde conforme o dano rolado. `damageKinds` é obrigatório com ferimentos e recusado com reservas.
- `resolution.spend`, só para `dice-pool`, define a reserva que pode ser gasta num teste, o custo de cada pagamento, se compra `successes` ou `dice` e `perCheck`, o teto por rolagem.
- `mechanics.check` numa entrada de catálogo define o que algo ESCOLHIDO pelo personagem faz no teste: `reroll` (`upTo` e `once` ou `until`), `dice`, `successes` ou `threshold`. Também exclusivo de reservas.

```json
{
  "capabilityApi": { "major": 1, "minor": 30 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

O comprimento da trilha corresponde aos níveis: `min` deve ser 0 e `max`, `levels.length`. Um arquivo que diga outra coisa é recusado, não corrigido silenciosamente. `resolution.penaltyFrom` precisa nomear uma trilha de ferimentos; uma trilha comum não tem penalidade a aplicar.

Não é uma integração opcional, pelo mesmo motivo que 1.20–1.28: um motor que não entende `levels`, `kinds`, `penaltyFrom`, `damageKinds`, `resolution.spend` ou `mechanics.check` recusa o arquivo inteiro. A instalação lê os bytes verificados de `ruleset.json` e recusa o pacote sob uma declaração anterior. Nada muda para trilhas numéricas, saúde em reserva e regras sem gasto em testes.

### Capability API 1.29: o que um turno de combate do conjunto permite

Há cinco adições opcionais ao bloco `combat` e às entradas de catálogo usadas pela luta:

- Um golpe pode carregar até três quantidades A MAIS além da primeira. `mechanics.plus` de uma entrada e `damage.plus` de uma ação de criatura usam `{ dice?, flat?, type?, save?: { save,
difficulty?, onSuccess: "none" | "half" } }`: cada parte é rolada, tipada, dobrada por crítico e submetida a uma salvaguarda separadamente. O golpe inteiro mantém um único teste de concentração e um único teste para cair.
- `combat.attacks[].strikes` referencia um valor que informa quantos ataques um gasto do orçamento dessa lista compra. Os restantes ficam disponíveis até terminar o turno; enquanto houver algum, todas as linhas da lista não custam orçamento.
- `mechanics.free` não gasta orçamento; `mechanics.gives` o devolve apenas neste turno, respeitando o teto de destino; `mechanics.standard` permite comprar ações padrão com outro orçamento. Uma entrada `utility` com `gives` ou `standard` é oferecida em vez de descartada.
- O novo tipo `rider`, e os `riders` da própria criatura, adicionam uma cláusula de dano ao primeiro acerto válido de um turno ou rodada, passivamente e sem aparecer no menu.
- A lista fechada de efeitos de condições adiciona `own-saves-advantage`, `own-saves-disadvantage`, `resist-all`, `cannot-target-source` e `cannot-approach-source`. Uma condição pode restringir as salvaguardas afetadas (`saves`), valer só enquanto sua origem está visível (`whileSourceInSight`) ou terminar quando ela cai (`endsWhenSourceDown`).

```json
{
  "capabilityApi": { "major": 1, "minor": 29 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Não é uma integração opcional, pelo mesmo motivo que 1.20–1.28: um motor que não entende essas chaves recusa o conjunto inteiro ou o catálogo que as contém. A instalação lê os bytes verificados de `ruleset.json` e de cada `catalogs/<id>.json` declarado, e recusa qualquer um sob uma declaração anterior. Nenhuma permissão nova nem mudança para conjuntos que não as declaram.

### Capability API 1.28: combate do conjunto num tabuleiro

O bloco `combat` pode definir quanto vale uma casa em sua própria distância (`distance: { label, perCell }`); isso permite que o combate tenha posições. `ranged` define a penalidade de um disparo além do alcance normal ou com um inimigo na casa vizinha; `cover`, o que a cobertura acrescenta à defesa; `opportunity`, o orçamento que paga um ataque contra quem se afasta. Uma lista de ataques pode dar às linhas `reach` e `range`, lidos de uma coluna ou definidos uma vez para todas; o `range` de uma ação de criatura pode ser `{ "normal": 30, "long": 120 }` em vez de um número.

```json
{
  "capabilityApi": { "major": 1, "minor": 28 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Declarar `ranged`, `cover`, `opportunity` ou alcance de armas SEM `distance` é recusado na importação: nada disso faz sentido sem uma casa para medir. O tabuleiro reutiliza o gerador, terreno e posicionamento inicial do estilo tático existente, sem adicionar outro modelo de campo nem permissão.

Não é uma integração opcional, pelo mesmo motivo que 1.20–1.27: um motor que não entende essas chaves recusa o conjunto inteiro ou o catálogo que contém a criatura com um par como alcance. A instalação lê os bytes verificados de `ruleset.json` e cada `catalogs/<id>.json` declarado e recusa qualquer um sob uma declaração anterior. Nada muda para conjuntos que não definem distância.

### Capability API 1.27: bestiários do conjunto

Um catálogo de conjunto de regras pode declarar `"holds": "creatures"` e trazer blocos de estatísticas de criaturas em vez de linhas de ficha. Uma criatura é escrita com os números que o bloco `combat` já declara: saúde, que pode ser um número ou dados rolados quando a luta começa, uma defesa, um modificador de iniciativa, valores de atributo e modificadores de salvaguarda sob os próprios IDs da ficha, os tipos de dano a que ela resiste, que a ferem mais ou que ela ignora, as condições em que ela nunca fica, o nível de ameaça em que se encaixa, características que o Game Master vê e ações que podem acertar, exigir uma salvaguarda, aplicar uma condição, ter um número limitado de usos, voltar com uma rolagem de recarga, resolver uma sequência das outras ações do bloco por um único orçamento ou ser compradas com os pontos especiais da própria criatura.

```json
{
  "capabilityApi": { "major": 1, "minor": 27 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/beasts.json"] } }
}
```

Um catálogo de criaturas não declara `feeds` e nunca é oferecido pelo seletor do editor de fichas: quem o lê é uma luta, não uma ficha de personagem. A luta que o lê é o estilo `ruleset` do diretor de combate, que não precisa de um nível próprio da Capability API: ele joga qualquer bloco `combat` e bestiário que um conjunto instalado já traga.

Não é uma integração opcional, pelo mesmo motivo que 1.20–1.26: um Engine que não entende `holds` nem o `creature` de uma entrada recusa o arquivo inteiro do conjunto, ou o arquivo de catálogo que o contém. Por isso, a instalação lê os bytes verificados de `ruleset.json` e de cada `catalogs/<id>.json` declarado e recusa qualquer um deles sob uma declaração anterior. Nenhuma permissão nem mudança para um conjunto sem bestiário.

### Capability API 1.26: combate do conjunto

Um conjunto pode trazer um bloco `combat` opcional no nível superior que diz como uma luta é RESOLVIDA pelos próprios números dele: o que é rolado e contra o quê, a economia de ações, quais listas da ficha são ataques e quais são habilidades, o que as condições dele fazem, a concentração, o que acontece com um personagem em zero, os tipos de dano que ele tem e a escala de onde um oponente é escolhido. A mesma versão permite que o `mechanics` de uma entrada de catálogo diga quantos alvos ela atinge, que ela sempre acerta, quais condições aplica, quantos pontos temporários concede, como cresce com a ficha e qual orçamento gasta.

```json
{
  "capabilityApi": { "major": 1, "minor": 26 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Uma partida com um conjunto que declara `combat`, com o diretor de combate ativado, resolve as batalhas por esse bloco na tela de batalha. Um conjunto sem ele luta como antes, pelo bloco `battle` ou pela preferência Classic ou Tactical do jogador.

Não é uma integração opcional, pelo mesmo motivo que 1.20–1.25: um Engine que não entende `combat` nem as novas chaves de `mechanics` recusa o arquivo inteiro do conjunto, ou o arquivo de catálogo que as contém. Por isso, a instalação lê os bytes verificados de `ruleset.json` e de cada `catalogs/<id>.json` declarado e recusa qualquer um deles sob uma declaração anterior. Nenhuma permissão nem mudança para um conjunto sem nenhum dos dois.

### Capability API 1.25: camadas do conjunto e orientações do mundo

Um conjunto pode declarar um array `layers` opcional no nível superior: variantes nomeadas dele mesmo (Low magic, Hard winter) que o jogador ativa ao criar uma partida e que ficam congeladas no vínculo dessa partida por toda a vida dela. A mesma versão dá ao bloco base `gm` uma string `worldGuidance` opcional, que a geração de mundos lê uma vez na configuração, para que o cenário combine com as regras pelas quais o grupo vai jogar.

```json
{
  "capabilityApi": { "major": 1, "minor": 25 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Os efeitos de uma camada formam um conjunto fechado, e todos eles restringem ou acrescentam: orientações adicionadas depois das do próprio conjunto, valores removidos de um campo de enumeração, a escala de dificuldade substituída por uma do mesmo tipo de resolução e entradas de catálogo ocultadas do seletor do editor de fichas. Nada é acrescentado à ficha, então uma ficha de personagem continua legível com quaisquer camadas que a partida tenha escolhido, e uma camada não traz código de pacote nem chamada extra ao modelo. Camadas publicadas por outra pessoa que não o autor do conjunto ficam para depois.

Não é uma integração opcional, pelo mesmo motivo que 1.20–1.24: um Engine que não conhece `layers` nem `gm.worldGuidance` recusa o arquivo inteiro do conjunto, então a instalação lê os bytes verificados de `ruleset.json` e recusa qualquer um dos dois sob uma declaração anterior. Nenhuma permissão nem mudança para um conjunto sem nenhum dos dois.

### Capability API 1.24: o tipo de resolução por parada de dados

O `resolution` de um conjunto pode declarar `"kind": "dice-pool"` em vez de `"dice-sum"`. O teste então rola a quantidade de dados que a própria ficha do personagem indica e conta os que atingem um alvo, com faces duplicadas, faces que explodem, faces que cancelam, falhas críticas, sucessos excepcionais e uma faixa de dados circunstanciais que o Game Master pode acrescentar ou tirar em um teste, todos opcionais.

```json
{
  "capabilityApi": { "major": 1, "minor": 24 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

A ficha é a mesma: o que `dice-sum` soma à rolagem é, aqui, o número de dados. Por isso, esse tipo não traz vocabulário novo de ficha, nem espaço novo no editor, nem código de pacote.

Não é uma integração opcional, pelo mesmo motivo que 1.20–1.23: um Engine que só conhece `dice-sum` recusa o arquivo inteiro do conjunto, então a instalação lê os bytes verificados de `ruleset.json` e recusa uma resolução `dice-pool` sob uma declaração anterior. Nenhuma permissão nem mudança para um conjunto que soma os dados.

### Capability API 1.23: valores escalonados de catálogo

A linha de uma entrada de catálogo pode trazer um mapa `scaled` opcional: até quatro das colunas numéricas da própria linha cujo valor o conjunto mantém, em vez do jogador. Cada uma é uma referência de valor comum com uma tabela de degraus opcional, então um recurso de classe pode acompanhar um nível e os usos de uma característica podem acompanhar um atributo sem que o formato aprenda nenhuma aritmética nova.

```json
{
  "capabilityApi": { "major": 1, "minor": 23 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

O valor é calculado quando a ficha é editada, nunca quando é lida, então o estado da partida, o bloco de prompt do Game Master e a ponte de batalha continuam lendo o número salvo.

Uma linha escalonada pode ficar embutida em `ruleset.json` ou em um recurso `catalogs/<id>.json`. O manifesto declara os dois arquivos como recursos, mas não consegue mostrar as chaves dentro deles, então a instalação lê os bytes verificados dos dois e recusa uma chave `scaled` sob uma declaração anterior à 1.23, exatamente como faz com `catalogs` antes da 1.21 e com `battle` antes da 1.22. O esquema estrito de um Engine mais antigo recusaria de qualquer forma o arquivo que a contém. Nenhuma permissão nem mudança para um conjunto cujos catálogos não trazem nenhuma.

A mesma versão acrescenta o comando `[sheet: op="use" name="..."]`, que paga o `mechanics.cost` de uma entrada de catálogo mais um uso de cada reserva de linha que essa entrada escreveu. Ele não precisa de declaração: lê catálogos que o Engine já serve.

### Capability API 1.22: o bloco battle

Um conjunto pode trazer um bloco `battle` opcional, que empresta a uma batalha os números da ficha de personagem: a reserva ao vivo que corresponde aos pontos de vida, uma reserva opcional que vira MP, as reservas que viram espaços de magia e as listas da ficha cujas linhas marcadas pelo catálogo viram os `CombatSkill` do próprio Engine. Quando a luta termina, os pontos de vida, a energia e os espaços gastos são gravados de volta pelas mesmas operações de ficha que os botões do próprio jogador usam.

```json
{
  "capabilityApi": { "major": 1, "minor": 22 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Isso não é um adaptador de combate. A aritmética de dano continua sendo a do Engine, e `attackRoll`, `save`, `concentration` e `perCostStep` em uma entrada de catálogo não são lidos por ninguém: a resolução fiel às regras pertence aos adaptadores por conjunto da passagem de combate. `coverage.combat` mantém o próprio significado, e a ponte nunca o lê.

O bloco fica dentro de `ruleset.json`, que o manifesto não consegue mostrar, então a instalação lê os bytes verificados e recusa uma chave `battle` sob uma declaração anterior à 1.22, exatamente como faz com `catalogs` antes da 1.21. O esquema estrito de um Engine mais antigo recusaria de qualquer forma o arquivo inteiro do conjunto. Nenhuma permissão nem mudança para um conjunto que não traz bloco `battle`.

### Capability API 1.21: catálogos do conjunto

Um conjunto pode trazer **catálogos**: coleções nomeadas de entradas prontas (magias, características de classe, equipamentos) que o editor de fichas oferece em um seletor, para que o jogador não precise digitar uma lista linha por linha. O cabeçalho fica em `ruleset.json`, sob `catalogs`; as entradas ficam embutidas nesse cabeçalho ou em um recurso reservado próprio, um arquivo por catálogo:

```json
{
  "capabilityApi": { "major": 1, "minor": 21 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } },
  "files": [
    { "path": "ruleset.json", "sha256": "<sha256>", "bytes": 25767 },
    { "path": "catalogs/spells.json", "sha256": "<sha256>", "bytes": 418204 }
  ]
}
```

`catalogs/<id>.json` é uma família de recursos reservada: o nome do arquivo é o próprio ID do catálogo, então o Engine encontra o arquivo só pelo conjunto, e nenhum catálogo pode apontar para o arquivo de outro. Um recurso de catálogo é fixado por hash em `files[]` como qualquer outro recurso declarado, só é distribuído ao lado do `ruleset.json` que o declara e é recusado pelo tamanho declarado acima de 2 MB antes de ser lido (1 MB antes da Capability API 1.340; um pacote com um arquivo de catálogo acima de 1 MB declara 1.340). O conteúdo passa pelas mesmas verificações das entradas embutidas, contra a mesma ficha, então um catálogo nunca consegue escrever uma linha que a ficha não comportaria. Até 12 catálogos por conjunto e 2000 entradas por catálogo.

O cliente só busca um catálogo quando um seletor é aberto, por `GET /api/capability-packages/rulesets/catalog?rulesetId=&catalogId=&version=`. A lista de conjuntos instalados nunca traz as entradas embutidas, só uma contagem, porque ela é lida sempre que um editor de fichas abre. O texto do catálogo nunca chega a um prompt: o Game Master continua vendo só o que `gm.sheetSummary` indica, então os catálogos não custam tokens.

Como a 1.20, esta não é uma integração opcional, e a trava tem duas metades porque os catálogos ficam dentro do arquivo do conjunto, e não no manifesto. Declarar um recurso `catalogs/<id>.json` exige a 1.21, e um `ruleset.json` que traz uma chave `catalogs` é recusado na instalação quando o manifesto declara menos, porque o esquema estrito de um Engine mais antigo recusaria de qualquer forma o arquivo inteiro do conjunto. Nenhuma permissão, como antes.

### Capability API 1.20: conjuntos de regras de Game Mode

Um conjunto de regras são as regras de um jogo como dados validados: um tipo de resolução que o Engine já implementa, uma ficha de personagem declarada a partir de um conjunto fechado de elementos básicos, descansos e orientações para o prompt do Game Master. Um pacote o distribui como o recurso de nome reservado `ruleset.json`, descoberto por convenção exatamente como `gm-verbs.json`: listado em `contributions.assets.paths` e fixado por hash em `files[]`.

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 20 },
  "id": "ruleset-5e-2014",
  "kind": ["ruleset"],
  "permissions": [],
  "entrypoints": {},
  "contributions": { "assets": { "paths": ["ruleset.json"] } },
  "files": [{ "path": "ruleset.json", "sha256": "<sha256 of the file>", "bytes": 25767 }]
}
```

O trecho mostra só as chaves que importam para um conjunto; os campos usuais do manifesto (`name`, `version`, `description`, `engine`, `builtAgainst`) continuam obrigatórios.

Um pacote de conjunto de regras não precisa de permissão, de ponto de entrada de servidor ou de cliente, nem de agente. O tipo e o recurso andam juntos: um pacote do tipo `ruleset` precisa listar `ruleset.json`, e um pacote que lista `ruleset.json` precisa declarar o tipo, então um conjunto não pode entrar sob outro tipo. Nada no arquivo é executado: não há strings de expressão, e uma mecânica que nenhum tipo de resolução expressa é uma mudança no Engine que acrescenta um tipo, não algo que um conjunto possa fazer. O formato está documentado no guia para autores, [`writing-rulesets.md`](../extending/writing-rulesets.md), e o código que o lê em [Arquitetura de Game Mode](game-mode-architecture.md).

Esta não é uma integração opcional. Um pacote de conjunto de regras não faz nada em um Engine que não consegue lê-lo, então um manifesto que lista `ruleset.json` precisa declarar a Capability API 1.20, e um Engine mais antigo recusa a instalação de forma limpa.

O Engine recusa o recurso pelo tamanho declarado acima de 512 KB antes de lê-lo (256 KB antes da Capability API 1.340; um pacote cujo conjunto passa de 256 KB declara 1.340), verifica-o de novo contra o hash da instalação e o valida com o esquema compartilhado estrito (`packages/shared/src/schemas/ruleset.schema.ts`). Um arquivo que ele não consegue usar é descartado com uma linha de registro que nomeia o pacote e os primeiros problemas `path: message`. Dois pacotes que declaram o mesmo ID de conjunto resolvem para o primeiro na ordem de IDs de pacote, e o outro é descartado com uma linha de registro. `engine-legacy` e `traditional` são IDs do Engine que um arquivo não pode reivindicar.

Uma partida fixa o conjunto uma vez, na criação, como `chat.metadata.gameRuleset`. Sem vínculo, valem as regras do próprio Engine, exatamente como antes. Um vínculo que a instalação não consegue honrar (o pacote foi removido ou a definição instalada é mais antiga que a versão fixada) é informado como indisponível e nunca reinterpretado como outro conjunto. O vínculo é comparado pelo ID do conjunto e pelo pacote que o forneceu, então outro pacote que reivindica o mesmo ID não assume uma partida existente.

### Capability API 1.73: os agentes de avatar

O Engine hospeda os dois agentes de avatar, `2d-avatars` (sprites PNGTuber e avatares de malha) e `3d-avatars` (modelos VRM). Os pacotes deles continuam enxutos: uma definição de agente para cada um, prompts padrão, locales e a entrada do catálogo. O Engine cuida de todo o resto: o armazenamento por proprietário em `DATA_DIR/avatar-models/`, a importação, os renderizadores carregados sob demanda, a configuração na página de cada agente no editor de agentes, o diretor de streaming, o classificador de expressões e as rotas de geração. O contrato compartilhado é `packages/shared/src/types/avatars.ts` (os esquemas dele ficam em `schemas/avatars.schema.ts`), e a metade do cliente é `packages/client/src/features/avatars/contract.ts`. O guia do usuário é [`docs/agents/avatars.md`](../agents/avatars.md).

Não há nenhum campo novo no manifesto. Um pacote de avatar declara a versão 2 do esquema e a Capability API 1.73, então um Engine sem essas superfícies recusa a instalação, em vez de listar um agente que não mostra nada. A mudança que introduziu a 1.73 entregou essas superfícies como stubs inertes; a configuração, o palco e os renderizadores do Engine agora estão na `staging`, e os dois pacotes estão listados no catálogo de prévia. As URLs de artefato referenciadas precisam ser publicadas antes de a instalação funcionar; uma entrada de catálogo sozinha não prova que o artefato para download está disponível.
Os prompts de geração do agente 2D são distribuídos como a coleção de modelos de prompt `avatarGenerationTemplates` nos `defaultSettings` dele, com os ids em `AVATAR_PROMPT_TEMPLATE_IDS`; o editor de agentes mescla e redefine essa coleção como qualquer outra coleção de modelos integrada.

### Capability API 1.72: o pacote de mapa de uma Experience

Um pacote `game-surface` que faz a configuração pelo assistente de Game (`gameSurface.setup`, 1.18) pode distribuir um pacote de mapa com a versão 2 do esquema e a Capability API 1.72: um kit de cenário próprio, mundos prontos feitos com esse kit e um pacote de tiles próprio. Cada um é o arquivo de compartilhamento que o Game Mode e o Pixelforge já leem e escrevem (um `.worldkit.json`, arquivos `.world.json` e um `.tilepack.json`), e cada um também é um recurso declarado e fixado por hash.

```json
{
  "gameSurface": {
    "setup": {},
    "mapPack": {
      "kit": "map/riverlands.worldkit.json",
      "worlds": ["map/upriver.world.json", "map/downriver.world.json"],
      "tiles": "map/riverlands.tilepack.json"
    }
  },
  "assets": {
    "paths": [
      "map/riverlands.worldkit.json",
      "map/upriver.world.json",
      "map/downriver.world.json",
      "map/riverlands.tilepack.json"
    ]
  }
}
```

`worlds` (no máximo 32) e `tiles` são opcionais. Um arquivo de mundo pode trazer o roteiro de história do mundo (worldgen W10), que é distribuído junto com o mapa como parte dele. Um arquivo de mundo da versão 2 também traz o `snapshot` do mundo, o mundo como foi criado (W11): um Engine cujo gerador de mundos mudou desde então lê o mundo a partir dele, exatamente como foi criado, então um pacote continua funcionando depois das atualizações do Engine. Escreva os arquivos pelo **Download** de uma partida ou de um mundo da biblioteca (ou por `GET /api/game/:chatId/world/file`), que o incluem. Um arquivo do pacote tem no máximo 8 MB, o maior arquivo de compartilhamento que o Engine lê (um pacote de tiles mantém os próprios limites, menores), então um mundo cujo arquivo é maior (o snapshot de um mundo muito grande) não pode ir em um pacote. Um mundo cuja história define um `intro` precisa da Capability API 1.339 (veja [A mensagem de introdução](../extending/writing-story-scripts.md#the-intro-message)). `tiles` pode ser um pacote de tiles de imagem (pacote de tiles da versão 2: folhas PNG em uma grade de células, com sprites de várias células), que precisa da Capability API 1.80; o Engine decodifica e verifica as folhas uma vez por versão do pacote. Com a Experience ligada, uma partida nova fica travada no kit do pacote; se o pacote traz mundos, o jogador escolhe um deles (com a história) e não cria nenhum outro. Desligar a Experience devolve as escolhas ao jogador. `POST /api/game/create` mantém uma partida na mesma trava. A partida guarda o kit e o mundo como qualquer partida, então continua jogável se o pacote for removido, e desenha o overworld e as cidades com os tiles do pacote enquanto ele está instalado.

O Engine lê os arquivos pelo caminho de recursos verificado (tamanho declarado de no máximo 8 MB cada, hash conferido de novo) e os verifica como verifica os arquivos de compartilhamento. Um pacote é recusado inteiro, com o motivo, quando um arquivo não pode ser lido, quando um mundo foi feito com outro kit ou não combina com ele, ou quando os bytes dele não são os instalados; a Experience então não consegue iniciar uma partida. Um conjunto de regras nunca faz parte de um pacote de mapa: uma Experience que precisa de regras próprias distribui um pacote de conjunto de regras separado.

#### Capability API 1.344: pacotes de criaturas

`mapPack.creatures` lista até 8 arquivos `.creaturepack.json` (cada um é um recurso declarado, lido e verificado como a biblioteca lê um pacote de criaturas). Numa partida da Experience, toda luta busca primeiro a arte de uma criatura nesses pacotes, na ordem deles, e depois no pacote de criaturas escolhido na biblioteca.

#### Capability API 1.345: música

Os recursos de um pacote podem incluir áudio a partir da 1.345: `.ogg`, `.mp3` ou `.wav`, com no máximo 16 MB cada. `mapPack.music` nomeia as faixas da Experience e quando elas tocam:

```json
"music": {
  "tracks": [
    { "id": "valley", "path": "music/valley.ogg", "title": "The Held Valley" },
    { "id": "town", "path": "music/thrushwick.ogg" },
    { "id": "fight", "path": "music/fight.ogg" }
  ],
  "default": "valley",
  "combat": "fight",
  "places": [{ "place": "p3", "track": "town" }]
}
```

Cada faixa também é um recurso declarado, e todo ID de faixa nomeado está em `tracks`. Um lugar em `places` é um lugar de um dos mundos do pacote, pelo ID. Fora de uma luta, a partida toca a faixa do lugar; caso não haja, a do lugar mais próximo que o contém e tem uma faixa; caso não haja, `default`; numa luta, `combat`. A ação `music` de uma história (veja [Escrever roteiros de história de Game Mode](../extending/writing-story-scripts.md)) coloca uma das faixas sobre todas essas até devolver o controle. Sem nenhuma delas, toca a música do próprio Engine. Um jogador que escolheu a própria fonte de música (o Music DJ, o Spotify) ouve essa fonte: a escolha dele sempre prevalece.

#### Capability API 1.346: pessoas

`mapPack.people` é um arquivo `.people.json` (um recurso declarado) que caracteriza as pessoas nomeadas dos mundos do pacote. As pessoas vêm do próprio mundo, geradas e nomeadas ou acrescentadas à mão nas edições dele (no Pixelforge ou na aba World), então ficam nos seus lugares como as demais; o arquivo diz quem elas são:

```json
{
  "peopleVersion": 1,
  "people": [
    {
      "person": "p3-e1",
      "portrait": "people/maud.png",
      "expressions": { "happy": "people/maud-happy.png", "angry": "people/maud-angry.png" },
      "sprite": "maud-walk",
      "description": "Keeper of Thrushwick's bells, older than she lets on.",
      "voice": "Slow, warm, and fond of proverbs about weather.",
      "lore": [{ "keys": ["bells", "bell tower"], "content": "The bells have rung the year out for 200 years." }]
    }
  ],
  "lore": [{ "name": "The Held Autumn", "keys": ["autumn", "harvest"], "content": "The year has not turned." }]
}
```

- `person` é um ID de pessoa de um dos mundos do pacote (`<place id>-<n>`, ou `-e<n>` para uma acrescentada à mão), e essa pessoa precisa ter um nome ali.
- `portrait` e `expressions` (`neutral`, `happy`, `sad` e as outras expressões da narração) são imagens entre os recursos do pacote. O retrato aparece no Journal quando a partida encontra a pessoa, e as expressões são usadas nas falas dela.
- `sprite` é um personagem dos próprios tiles (de imagem) do pacote, usado pela pessoa ao andar nos mapas de cidades e lugares em vez de um escolhido para ela.
- `description`, `voice` e `lore` viram um lorebook criado com cada partida nova da Experience (_Nome da Experience_: pessoas), ativo desde o primeiro turno: uma entrada por pessoa, acionada pelo nome dela, uma por entrada de `lore`, pelas próprias palavras-chave, e uma por entrada do `lore` do próprio arquivo.

#### Capability API 1.347: companheiros

Uma pessoa pode ser um companheiro: alguém que a equipe pode incorporar, para que uma equipe sem cura, exploração ou uma luz no escuro nunca fique impedida de fazer o que a história pede.

```json
{
  "person": "p3-4",
  "portrait": "people/hob.png",
  "companion": {
    "role": "Healing and herb lore",
    "sheets": {
      "5e-2014": {
        "v": 1,
        "level": ["level"],
        "builds": [
          { "at": 1, "build": { "abilities": { "wis": 16 }, "fields": { "level": 1, "class": "Cleric" } } },
          { "at": 3, "build": { "abilities": { "wis": 16 }, "fields": { "level": 3, "class": "Cleric" } } }
        ]
      }
    }
  }
}
```

- `sheets` contém uma ficha para cada conjunto de regras em cuja partida o companheiro pode entrar, pelo ID do conjunto. `v` é a versão de ficha do conjunto para a qual as configurações foram escritas (as antigas são migradas como as fichas armazenadas).
- `level` nomeia os campos de ficha que contêm o nível de um personagem nesse conjunto de regras, somados (uma ficha multiclasse mantém um por classe). A soma dos campos de nível de cada configuração precisa ser igual ao seu `at`, e as configurações seguem em ordem crescente.
- Um companheiro entra com a configuração do maior nível que a equipe alcançou (a menor, enquanto a equipe estiver abaixo de todas) e, depois de cada turno, sobe para uma configuração superior assim que a equipe a alcança. Uma ficha que o jogador elevou além da sua configuração é mantida, e nada reduz uma ficha. A vida, as reservas e as condições são mantidas separadas da configuração, então uma subida as preserva. Distribua uma configuração para cada nível em que o companheiro deve ser jogável.
- A história os incorpora e os dispensa com as ações `recruit` e `dismiss`. O Game Master recebe quem são os companheiros, onde estão e o que oferecem, e só pode incorporar essas pessoas (um `[party_change]` nomeando qualquer outra é recusado); os personagens da própria biblioteca do jogador ainda podem entrar.
- Um companheiro entra como qualquer recruta: aparece na lista da equipe, traz o card e a ficha e luta no combate tático. Numa partida com um conjunto de regras para o qual não tem ficha, entra com uma em branco.

Um arquivo de pessoas com companheiros exige 1.347; sem eles, 1.346. Uma história que recruta ou dispensa alguém exige 1.347, e cada pessoa que ela nomeia precisa ser um companheiro no arquivo de pessoas do pacote.

#### Capability API 1.350: verificar um pacote antes de exportar

Um aplicativo de criação (Pixelforge) pode pedir ao Engine que verifique um pacote de mapas inteiro antes de exportar o pacote, exatamente como um instalado é lido, sem instalá-lo:

```
POST /api/game/experience/check
{ "mapPack": { ...the manifest's gameSurface.mapPack block },
  "files": { "map/valley.worldkit.json": { ...parsed JSON }, ... },
  "assets": [{ "path": "people/maud.png", "bytes": 48213 }, { "path": "music/valley.ogg", "bytes": 3100000 }] }
```

`files` contém cada arquivo JSON nomeado pelo bloco (kit, mundos, tiles, pacotes de criaturas, pessoas), já analisado; `assets` lista os outros recursos do pacote (imagens, áudio) por caminho e tamanho. A resposta é `{ "ok": true | false, "minor": <n>, "issues": [{ "path": "...", "message": "..." }] }`: `minor` é a versão secundária da Capability API (1.`minor`) que o pacote exige, e `issues` nomeia cada problema pela chave do bloco (`mapPack.music.default`) ou pelo arquivo em que está. As regras do próprio manifesto (recursos declarados, IDs de faixas, tamanhos de áudio) são todas informadas; as verificações dos arquivos param no primeiro problema, como numa instalação.

#### Capability API 1.351: estações mantidas

A história de um mundo pode manter lugares numa estação independentemente da data (`seasons` e a ação `season`: veja [escrever roteiros de história](../extending/writing-story-scripts.md#seasons)), e os campos de batalha de um mundo podem ser pintados com estações (linhas `seasons` e `seasonKeys`). Um pacote de mapas com qualquer um desses recursos exige 1.351. O overworld lê os lugares mantidos como `seasons` (ID de lugar para estação, `*` para o mundo inteiro) de `GET /api/game/:chatId/overworld`; um campo de batalha criado traz as estações iniciais dos seus tiles como `seasons`, indexadas por `"x,y"`.

#### Capability API 1.355: sobreposições de conjuntos de regras

O pacote de mapas de uma Experience pode acrescentar conteúdo aos conjuntos de regras usados pelas suas partidas enquanto a Experience está ligada: criaturas, condições e itens próprios, que não cabe ao pacote do conjunto de regras distribuir.

```json
"mapPack": { "kit": "...", "rulesets": [{ "ruleset": "5e-2014", "overlay": "rules/5e.overlay.json" },
                                        { "ruleset": "dnd5e", "overlay": "rules/dnd5e.overlay.json" }] }
```

Cada `.overlay.json` (declarado como recurso, como os outros arquivos do pacote) é para um conjunto de regras, pelo ID. Um conjunto de regras importado de um arquivo (`local/<id>`) ou de um repositório (`<owner>/<id>`) usa a sobreposição para o seu ID simples, a menos que o pacote também nomeie o seu ID exato:

```json
{ "overlayVersion": 1,
  "creatureTags": [{ "id": "unreaped", "label": "Unreaped" }],
  "conditions": [{ "condition": "owed_frost_held", "effects": ["own-attacks-disadvantage"] }],
  "sheetConditions": [{ "id": "owed_frost_held", "label": "Held by the Frost" }],
  "creatures": [{ "id": "the-owed", "label": "The Owed", "creature": { ... } }],
  "catalogs": { "magic_items": [{ "id": "lantern-of-dusk", ... }] } }
```

`creatureTags` é acrescentado a `combat.creatureTypes.tags` do conjunto de regras, `conditions` a `combat.conditions`, `sheetConditions` a `sheet.live.conditions`, `creatures` ao catálogo `creatures` e cada lista de `catalogs` ao catálogo daquele ID. Uma partida desse conjunto de regras com a Experience ligada usa o conjunto com tudo isso mesclado (lutas da história, `give`, os usos do próprio Game Master), e o conjunto de regras é lido de novo inteiro: uma sobreposição cujas entradas não se encaixam nele, ou que reutiliza um ID que o conjunto tem, é descartada inteira, e a partida usa o conjunto como era. `POST /api/game/experience/check` mescla cada sobreposição ao seu conjunto de regras conforme instalado e informa o que não se encaixa.

A partir da Capability API 1.367, uma sobreposição também pode acrescentar trilhas de ficha, `"tracks": [{ "id": "owing", "label":
"Owing", "min": 0, "max": 20, "default": 0 }]`, no formato de `sheet.live.tracks` do conjunto de regras e acrescentadas a ele: uma trilha declarada pela sobreposição aparece na ficha, é alterada por comandos de ficha e é mantida para as marcas de Held Ground de uma história ou da regra de luz de um tabuleiro. Um pacote com uma sobreposição que acrescenta trilhas exige 1.367.

#### Capability API 1.357: aparências de masmorras e as palavras de um mapa manual

Os mapas feitos à mão de uma Experience podem ser desenhados com aparências próprias, além dos conjuntos de caverna, cripta, templo e estação da biblioteca, e descritos ao Game Master com palavras próprias.

```json
"mapPack": { "kit": "...", "dungeons": ["looks/corn-maze.tilepack.json", "looks/snowfield.tilepack.json"] }
```

Cada um é um pacote de tiles de imagem (`tilePackVersion` 2) disposto como um conjunto de masmorra: `dn_floor`, `dn_wall`, `dn_liquid`, `dn_prop0` a `dn_prop7` (`dn_liquid` pode ter peças de borda, como num conjunto da biblioteca). Ele precisa desenhar pelo menos `dn_floor` e `dn_wall`; os demais usam cores simples como alternativa. Um mapa manual (`edits.maps`) cujo `pack` é um dos IDs deles é desenhado com ele, antes de qualquer pacote da biblioteca com esse ID. Nenhum par pode compartilhar um ID.

Um mapa manual também pode trazer palavras próprias para o Game Master:

```json
"words": { "floor": "stubbled earth", "wall": "walls of standing corn", "liquid": "a ditch of rainwater",
           "props": ["a scarecrow", null, "a corn-dolly shrine"] }
```

`props` tem uma entrada por espaço de objeto de cenário, de 0 a 7 (`null` para um espaço sem descrição). O Game Master então recebe o mapa como "A place made by hand (stubbled earth, walls of standing corn), with a ditch of rainwater in it;
in it: a scarecrow (2), a corn-dolly shrine", em vez de apenas saber que foi feito à mão. Ambos exigem uma Experience que declare 1.357.

#### Capability API 1.359: itens que custam um número da história

Uma sobreposição pode nomear itens cujo uso gasta (ou acrescenta a) um dos sinalizadores numéricos de história da Experience:

```json
{
  "overlayVersion": 1,
  "storyUses": [{ "item": "magic_items/jar-of-someone-elses-death", "flag": "debts_settled", "add": -2, "atLeast": 2 }]
}
```

`item` é `catalog/entry` do conjunto de regras mesclado (os itens da própria sobreposição contam), nomeado uma única vez. Numa luta, usar esse item (o item da ficha do combatente que age) é recusado enquanto o sinalizador, considerando os gastos ainda não registrados, estiver abaixo de `atLeast`: "Jar of Someone Else's Death needs 2 Debts Settled; the party has 1." Um uso aceito pela luta fica guardado com a partida, e o próximo turno de história o registra uma vez (`spend="<id>"`, pelo Engine), dentro de `min` e `max` do sinalizador, e informa ao Game Master o custo. Cada sinalizador precisa ser um sinalizador numérico de uma das histórias do pacote. Um pacote de mapas com `storyUses` exige 1.359.

#### Capability API 1.360: equipes com mais de seis e companheiros que nunca lutam

As variantes de uma luta de história podem ser para equipes com mais de seis membros ou sem limite superior (`"party": { "min": 7 }`), e uma condição de história pode perguntar o tamanho da equipe (`{ "partySize": { "is": ">=", "value": 7 } }`; veja [escrever roteiros de história](../extending/writing-story-scripts.md#conditions)).

Um companheiro do arquivo de pessoas pode nunca lutar:

```json
{ "person": "p3-7", "companion": { "role": "Keeps the ledger", "noncombatant": true, "sheets": { ... } } }
```

Ele viaja com a equipe e é descrito ao Game Master como alguém que nunca luta, mas não é contado no tamanho da equipe (para variantes de luta e condições `partySize`) nem colocado nas suas lutas. Um arquivo de pessoas com um desses companheiros exige 1.360.

### Capability API 1.372: valores de configuração do GM

`contributions.gameSurface.setup.defaults` define o que é preenchido ao escolher a Experience no assistente de Game. A aba Experience do Pixelforge o escreve. Toda chave é opcional, e o jogador ainda pode alterar cada valor:

```json
"setup": {
  "defaults": {
    "name": "The Held Autumn",
    "genre": ["Fantasy"],
    "setting": "Sallowmarch, a valley where nothing has died for forty years.",
    "tone": ["Whimsical", "Dark"],
    "difficulty": "Normal",
    "rating": "sfw",
    "language": "English",
    "combatStyle": "tactical",
    "playerGoals": "Find out why the year will not turn.",
    "preferences": "Quiet dread over gore.",
    "gameSpecialInstructions": "Keep the valley's names.",
    "artStylePrompt": "Muted autumn watercolour.",
    "intro": { "mode": "defined", "text": "The leaves have not fallen in nine years.", "locked": true }
  }
}
```

- `name`: no máximo 100 caracteres.
- `genre` e `tone`: de 1 a 12 nomes cada, com no máximo 60 caracteres, sem vírgulas. Unida, cada lista fica dentro de 200 caracteres.
- `difficulty`: `Casual`, `Normal`, `Hard` ou `Brutal`.
- `rating`: `sfw` ou `nsfw`.
- `combatStyle`: `classic` ou `tactical`.
- Limites de texto: `setting` 4.000 caracteres, `language` 100, `playerGoals` e `preferences` 2.000, `gameSpecialInstructions` 2.000, `artStylePrompt` 500.

`intro` é a mensagem de introdução do Game Master (1.339), com as mesmas regras do `intro` de um roteiro de história (veja [Escrever roteiros de história](../extending/writing-story-scripts.md#the-intro-message)). É o único valor que fica travado. Uma introdução travada aparece como somente leitura no assistente, e a partida começa com ela independentemente do que a configuração envie. A partida mantém a introdução como era quando começou (`chat.metadata.gameExperienceIntro`). Ela é lida antes do `intro` da própria história. A importação de um arquivo de configuração mantém os próprios valores, e desligar a Experience deixa os valores preenchidos como estão.

### Capability API 1.373: arquivos de Experience

Uma Experience que contém apenas imagens, música e dados pode ser compartilhada como um único arquivo `<id>.experience.json` em vez de um zip de pacote. Os jogadores a importam na seção Experiences do assistente de Game com **Import an Experience file** (importar um arquivo de Experience); ela não exige um catálogo de agentes.

O manifesto dela tem `"kind": ["experience"]` e nada mais em `kind`, exige `capabilityApi` 1.373 ou mais recente e não contém código: `entrypoints` é `{}`, `permissions` está vazio, não há `restartRequired` nem `prepareBeforeStart`, e `contributions.slots` é exatamente `["game-surface"]`. Cada arquivo em `files` é `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.ogg`, `.mp3`, `.wav` ou `.json`. A superfície de jogo não desenha nada próprio; a Experience funciona por meio das suas contribuições `gameSurface` (configuração, mapas, mundos, pacotes de criaturas, música).

O arquivo é JSON com as chaves nesta ordem:

```json
{"format":"marinara-experience","version":1,
"manifest":{ ... },
"files":{
"art/portrait.png":"iVBORw0KGgo...",
"music/theme.ogg":"T2dnUwAC..."
}}
```

- `manifest` é o manifesto de pacote descrito acima, com no máximo 1 MB, e vem antes de qualquer arquivo.
- `files` mapeia cada caminho em `files` do manifesto para os seus bytes em base64 padrão (preenchimento só no final, sem espaços em branco nem quebras de linha dentro dele). Cada arquivo listado aparece exatamente uma vez, e nenhum outro aparece.
- Os caminhos são escritos sem escapes, então um caminho com aspas, barra invertida, caractere de controle ou um substituto Unicode isolado é recusado.

Antes de enviar qualquer coisa, o assistente lê só o início do arquivo, até o fim do manifesto, e mostra uma revisão: nome, versão e descrição, o tamanho da importação, quanto dele é imagens, música e dados, e Import (importar) e Don't Import (não importar). Import envia o arquivo para `POST /api/capability-packages/experience-file` (tipo de conteúdo `application/vnd.marinara.experience+json`). O servidor o lê à medida que chega, escreve cada arquivo numa pasta temporária e verifica o tamanho e o `sha256` contra o manifesto. Um arquivo que não corresponde, um arquivo ausente ou extra, um arquivo cortado ou uma versão mais antiga que a instalada é recusado, e nada do que foi escrito é mantido.

Cada arquivo precisa então ser o que o nome diz. As imagens passam pela verificação de assinatura usada nas importações de cards de personagem (`isAllowedImageBuffer`) e precisam ser do tipo indicado pela extensão, então uma página ou um SVG chamado `.png` é recusado. Elas são armazenadas sem os metadados: PNG mantém só os blocos que o desenham (sem `tEXt`, `zTXt`, `iTXt`, `eXIf` nem `iCCP`), JPEG remove os segmentos APP, exceto JFIF e Adobe, e os comentários (então a orientação EXIF não é mantida), GIF remove comentários, texto simples e extensões de aplicativo, exceto a contagem de repetições, e WebP remove os blocos EXIF, XMP e ICC. A música precisa ser Ogg Vorbis ou Opus bem formado (com o checksum de cada página verificado; os comentários e a capa são esvaziados no próprio lugar), MP3 (com as tags ID3 e APE removidas) ou WAV (só os blocos `fmt `, `fact` e `data` são mantidos). Arquivos de dados precisam ser JSON UTF-8. Tudo depois do fim de uma imagem ou som é descartado. O manifesto instalado registra os tamanhos e hashes dos arquivos armazenados. Uma versão mais recente substitui a instalada, como uma atualização de catálogo. Um arquivo de Experience não pode substituir um pacote de outro tipo com o mesmo ID.

Uma Experience nunca é aceita como zip de pacote. Um catálogo de agentes só lista uma com uma URL de artefato terminada em `.experience.json`. O Engine instala esse arquivo pelo mesmo leitor, com as mesmas verificações e remoção de metadados, e o recusa se o manifesto não for o listado no catálogo. Uma entrada de catálogo que é uma Experience (`kind` `experience`, ou o espaço `game-surface`) com qualquer outro artefato é recusada antes de qualquer download, e a instalação do catálogo na primeira inicialização ignora Experiences. Experiences já instaladas continuam funcionando.

O Pixelforge 0.45.0 exporta uma Experience como esse arquivo e só abre arquivos de Experience.

### Capability API 1.18: manter a configuração de Experience no assistente de Game

Um pacote `game-surface` pode declarar `contributions.gameSurface.setup` com a versão 2 do esquema e Capability API 1.18. O Engine mantém as sete etapas habituais de configuração, incluindo **Party** (grupo), objetivos, modelos e lorebooks. Apenas jogos novos oferecem Experiences; reabrir a configuração de um jogo existente preserva sua Experience e a configuração do pacote. Pacotes sem essa declaração mantêm o diálogo de configuração anterior.

```json
{
  "setup": {
    "seed": { "key": "seed", "label": "World seed" },
    "config": { "generate": true, "packWanted": true },
    "requires": { "enableCustomWidgets": false }
  }
}
```

Os três campos são opcionais. A semente declarada aparece abaixo da Experience selecionada com o botão **Randomize** (sortear). Uma entrada vazia ou sem valor numérico finito bloqueia **Start** (iniciar). O host grava a semente numérica e as constantes declaradas em `experienceConfig`; `config` não pode conter a chave da semente. As constantes devem ocupar no máximo 8.000 caracteres após a serialização. O rótulo da semente é texto de exibição escrito pelo pacote; omita-o para usar o rótulo localizado do Engine.

Um requisito declarado de widgets fornece o padrão apenas até o jogador alterar esse controle. Desativar a Experience restaura o padrão habitual, enquanto escolhas explícitas do jogador permanecem intactas. O controle explica o que a Experience espera e continua editável. Os controles de configuração de mapas espaciais ficam ocultos para essas Experiences, portanto nenhum rascunho, modelo ou criador de mapas separado é iniciado.

A etapa **Lorebooks** (lorebooks) permite selecionar até 100 entradas individuais habilitadas, incluindo entradas de livros não anexados. Livros e entradas desabilitados e exclusões do chat são respeitados. Esses IDs são enviados em `GameSetupConfig.activeLorebookEntryIds`. Em `/game/setup`, são entradas forçadas adicionais: ignoram as rolagens de probabilidade, mas mantêm os limites habituais de tokens. O lore global, vinculado a personagens e anexado continua participando da varredura normal. Os pacotes podem ler os mesmos IDs selecionados na configuração para sua própria solicitação de geração do mundo.

A importação de um arquivo de configuração restaura uma Experience instalada e compatível e sua semente numérica válida, mas descarta configurações arbitrárias do pacote. O manifesto atual fornece as constantes novamente. Jogos existentes ignoram importações de Experience com uma explicação. Os snapshots de criação preservam o nome da Experience e a semente para o resumo da configuração.

Use a declaração existente de prontidão para inicialização de forma independente quando o mundo precisar estar preparado antes do primeiro turno. Declare API 1.18 como mínimo do pacote; hosts anteriores não conseguem interpretar essa declaração de configuração.

### Capability API 1.71: ler as mensagens como os agentes as leem

No Roleplay, uma mensagem pode trazer sussurros que não fazem parte do seu `content`. Todos os agentes que o Engine executa leem esses sussurros, e agora um pacote que lê o chat por conta própria pode ler o mesmo texto. Cada registro de `persistence.listMessages(chatId)` recebe `agentContent`: a mensagem como os agentes do Engine a leem. Cada sussurro fica no seu lugar, marcado como `[Private whisper to <name>: …]`, e uma mensagem que é só um sussurro é lida como os seus sussurros. Um documento que um personagem entrega, como uma carta, vem depois da mensagem. As notas privadas do jogador ficam de fora.

`agentContent` só existe em chats de Roleplay. Ele falta nos outros modos e em uma sala multijogador hospedada, onde todos veem o que os agentes escrevem. `content` nunca muda: continua sendo o texto público. `extra` também não muda: são os dados salvos da mensagem, com todos os sussurros, em todos os modos. Nunca mostre um texto montado a partir dele a jogadores ou personagens a quem um sussurro não se destinava.

```ts
const messages = await api.runtime.persistence.listMessages(chatId);
const history = messages.map((message) => message.agentContent ?? message.content);
```

É uma integração opcional: motores antigos deixam o campo de fora, então um pacote que lê `agentContent ?? content` não precisa declarar 1.71. Ele precisa da permissão `chat-read`, como `listMessages`. Sussurros são privados: tudo o que um pacote escreve a partir deles, como uma nota ou uma memória, pode chegar a personagens a quem o sussurro não se destinava.

### Capability API 1.68: gerar embeddings de consultas de busca como consultas

`embeddings.embed(texts, signal?, inputType?)` aceita um terceiro argumento: passe `"query"` para textos de busca, como uma consulta de recuperação. Os textos usam `"document"` por padrão. Alguns modelos de embedding esperam um prefixo nas consultas, e alguns também nos documentos: e5 e nomic-embed-text usam um de cada, e o Snowflake Arctic Embed v2 prefixa apenas as consultas. O Engine acrescenta o prefixo certo. A recuperação fica mais fraca quando o embedding de uma consulta é gerado como documento. Outros modelos, incluindo o gerador MiniLM integrado, não recebem prefixo em nenhum dos casos. O tipo de entrada não muda o `spaceId`, então os vetores salvos continuam comparáveis e nenhum vetor precisa ser recalculado.

```ts
const embeddings = await api.runtime.resolveEmbeddings();
const [queryVector] = (await embeddings.embed([query], signal, "query")) ?? [];
const memoryVectors = await embeddings.embed(memoryTexts, signal); // documents
```

É uma integração opcional: um motor antigo ignora o terceiro argumento, então o pacote sempre pode passá-lo e não precisa declarar 1.68. Passe o tipo de entrada como terceiro argumento, nunca em um objeto de opções: um motor antigo repassa o segundo argumento diretamente ao provedor como sinal de cancelamento.

### Capability API 1.67: abrir um personagem no editor

A visão do navegador ganha `openCharacter(characterId, { tab })`. Ela abre o editor de personagens, na aba indicada quando houver uma, para que um pacote leve o usuário a um campo do card que ele lê. Engines antigos não têm esse método: verifique se `openCharacter` existe antes de mostrar o link.

```ts
if (typeof props.openCharacter === "function") props.openCharacter(characterId, { tab: "convo" });
```

### Capability API 1.66: cenas a partir de threads de pacotes

Uma cena de roleplay normalmente se ramifica a partir de uma Conversation (`/scene`). Um pacote com a nova permissão `scenes` pode deixar que as próprias threads dele, como uma thread de mensagens diretas, sejam a origem. A cena é um chat de cena comum: o mesmo planejador, a mesma caixa de diálogo de preferências do prompt, as mesmas instruções de cena, os mesmos controles End Scene, Discard e Convert e a mesma memória do personagem quando ela termina. O pacote cuida do lado da thread: o que o planejador lê, a trava enquanto a cena roda e o que acontece com o resumo.

```ts
export async function activate({ api }) {
  api.registerSceneOrigin({
    // Planning context, or null when the thread no longer exists.
    getContext: async (threadId) => ({
      characterIds: [creatorCharacterId],
      personaId,
      connectionId: null, // the Engine's default connection
      transcript: [{ speaker: "Mina", content: "Come to my shoot tonight?" }],
      notes: "Stage persona, limits and anything else the scene writer must respect.",
    }),
    // Lock the thread. Return false when it already has an active scene.
    claim: async (threadId, { sceneChatId, characterIds }) => lockThread(threadId, sceneChatId),
    // Unlock and receive the outcome.
    release: async (threadId, end) => {
      if (!(await holdsLock(threadId, end.sceneChatId))) return;
      if (end.kind === "concluded") await saveRecap(threadId, end.summary);
      await unlockThread(threadId);
    },
  });
}
```

A visualização do navegador (`home-browser-tab`) recebe estas propriedades:

- `startScene({ originId, prompt?, planHint?, plan?, data?, initiatorCharacterId?, initiatorName? })` abre a caixa de diálogo de preferências do prompt da cena, planeja e cria a cena e abre o chat dela. Passe `plan` (um `SceneFullPlan`: nome, descrição, cenário oculto, primeira mensagem, prompt de sistema da cena, classificação, histórico do relacionamento, guia de participação, plano de fundo, elenco) para você mesmo escrever a cena; a caixa de diálogo e o planejador do Engine são pulados e a cena é criada exatamente como planejada. Resolve para `{ chatId }`, ou `null` quando o usuário cancela ou a criação falha (o usuário vê o motivo). O auxiliar sempre usa o próprio ID do pacote. Ele é uma conveniência, não uma barreira: as rotas de cena aceitam qualquer ID de pacote, então `getContext` deve devolver só o que o jogador já poderia ver naquela thread.
- `openChat(chatId)` vai para um chat, para um botão "Go to scene" em uma thread travada.
- `focusSceneOriginId` é a thread a mostrar quando o usuário volta de uma cena (Back, End Scene, Discard). Chame `onFocusSceneOriginHandled()` depois de mostrá-la.

Regras que vale conhecer:

- `data` são as configurações próprias desta cena, um objeto JSON simples de no máximo 4.000 caracteres. O Engine o guarda com a cena e o passa para `claim(originId, { sceneChatId, characterIds, data })` e para `release` como `end.data`, então cada cena pode decidir por si: `claim` pode admitir uma cena sem travar (devolva `true` e não guarde nada), e `release` pode destravar sem receber o resumo, ou recebê-lo com o alcance que a cena pediu.
- Só `getContext` é obrigatório. Um pacote que só quer iniciar cenas deixa de fora `claim` e `release`: nada é travado, qualquer número de cenas pode rodar a partir da mesma origem e nada é entregue quando elas terminam (**Back** ainda volta para o pacote). Deixe de fora só `release` para travar sem saber o resultado, ou só `claim` para saber os resultados sem trava.
- Um provedor por pacote; registrar de novo o substitui, e desativar o remove.
- `characterIds` precisam ser personagens do Engine; IDs desconhecidos são descartados, e um contexto sem nenhum personagem conhecido é recusado. Um `personaId` desconhecido é tratado como nenhum. `notes` é cortado em 8.000 caracteres e entregue ao planejador e, com a transcrição, ao escritor da cena como contexto oculto.
- `claim` roda depois que o chat de cena existe. `false` o descarta com um 409; uma exceção o descarta com um 503. `getContext`, `claim` e `release` têm 8 segundos cada: um `getContext` ou `claim` atrasado conta como falha (503, o chat de cena é removido), e um `release` atrasado é registrado e descartado.
- `release` recebe `concluded` (com `summary`, `description`, `scenario`, `rating` e o elenco), `abandoned`, `deleted` ou `converted`. Ele precisa ser idempotente e precisa ignorar uma cena que não detém a trava. Um release que lança uma exceção, ou que chega enquanto o pacote está inativo, é registrado e descartado: o chat de cena continua encerrado de qualquer jeito, então reconcilie uma trava obsoleta lendo o chat de cena com `chat-read`. Os metadados dele têm `sceneStatus`, e uma cena concluída também tem `sceneSummary`.
- O Engine não escreve nada em uma Conversation para uma origem de pacote. A memória do personagem é guardada na conclusão exatamente como em uma cena de Conversation.

`scenes` é recusado em um manifesto que declara uma `capabilityApi` anterior à 1.66.

<a id="capability-api-1376-home-browser-fullscreen"></a>

### Capability API 1.376: tela cheia do navegador de Home

Uma visualização `home-browser-tab` recebe `capabilityProps.browserFullscreen`:

- `active`: indica se este pacote ocupa toda a área de conteúdo do navegador de Home no momento.
- `setActive(boolean)`: entra ou sai da tela cheia para este pacote ativo.
- `enterLabel` e `exitLabel`: rótulos de acessibilidade traduzidos para o botão.

É uma tela cheia dentro do aplicativo: as abas, a barra de endereços e os favoritos de Home ficam ocultos, enquanto a barra superior do Engine continua disponível. Ela não chama a API Fullscreen do navegador nem exige suporte a tela cheia no navegador. O estado é temporário e é redefinido ao sair do pacote ou de Home. Mantenha um botão de saída em todas as telas do pacote e use `aria-pressed` para representar `active`. Atualizações das propriedades devem atualizar o botão sem substituir formulários inacabados. Pacotes que dependem desse controle declaram Capability API 1.376 ou mais recente; os antigos podem manter seus layouts atuais.

<a id="capability-api-1391-advanced-memory-scene-summaries-and-the-memory-block"></a>

### Capability API 1.391: resumos de cena do Advanced Memory e o bloco de memória

`persistence.listChatSummaries(chatId)` também retorna `advancedMemory`: os resumos de cena ativados e concluídos do Advanced Memory desse chat, na ordem em que foram escritos; uma cena resumida novamente vai para o fim, então use `startMessageId` para a ordem da história. Cada um tem `id`, `sceneId`, `kind` (`"scene"`), `title`, `content`, `timeline`, `startMessageId`, `endMessageId`, `audienceCharacterIds`, `sourceFingerprint`, `updatedAt` e `memory`. Chats mais antigos podem conter várias cópias de uma cena com o mesmo `sceneId`. Registros constantes, temporários, de trechos e de recordações não são listados.

O serviço `long-term-memory:runtime` pode adicionar um método opcional `summaryMemoryInstruction()` que retorna um parágrafo ou `null`. Quando o chat lista Long-Term Memory como agente ativo, o Engine acrescenta esse parágrafo a cada requisição inicial de resumo de cena (para cada parte de uma cena dividida em várias partes) e pede uma string `"memory"` na mesma resposta JSON. Ele armazena essa string sem alterações e a retorna como `memory`; o Engine nunca a interpreta, então o formato fica a cargo do pacote. Uma cena resumida em várias partes recebe o bloco de cada parte, unidos por uma linha em branco; as requisições de combinação nunca veem os blocos. O parágrafo tem um limite de 4,000 caracteres.

`memory` é `null` quando a resposta não tinha bloco, depois que o usuário edita o resumo manualmente e nos registros escritos antes da 1.391. Sem o método, ou em um chat que não lista Long-Term Memory, a requisição de resumo não muda.

O bloco é uma única string sem subdivisões, escrita a partir da cena inteira, incluindo mensagens que alguns participantes nunca viram; ao contrário da recapitulação, ele não tem seções por leitor. Um pacote que mostra memórias a um personagem deve restringir, por conta própria, o escopo do registro com base em `audienceCharacterIds`.

Engines mais antigos não retornam `advancedMemory`: verifique se ele existe ou declare 1.391.

```ts
const scenes = (await api.runtime.persistence.listChatSummaries?.(chatId))?.advancedMemory ?? [];
```

### Capability API 1.390: o Engine desenha o cabeçalho da página de um agente

Um pacote com `contributions.agentDetail` pode definir `"header": "engine"`. Então, o Engine desenha o mesmo cabeçalho que aparece em todas as outras páginas de agentes: Voltar, o banner e o logotipo da loja, o nome, a alternância Active do chat aberto e Gerenciar pacote. A visualização `detail` recebe duas propriedades extras: `engineHeader: true` e `headerSlot`, um elemento nas ações do cabeçalho. Oculte seu próprio cabeçalho quando `engineHeader` estiver definido e renderize os botões extras do cabeçalho (por exemplo, “Adicionar memórias” ou ajuda) em `headerSlot` com um portal React ou `appendChild`. `headerSlot` é `null` na primeira renderização, então aguarde a próxima atualização das propriedades. Sem a flag, o pacote mantém a página inteira como antes. Declare Capability API 1.390 ao defini-la.

<a id="capability-api-1389-hide-or-show-messages-from-the-ai"></a>

### Capability API 1.389: ocultar ou mostrar mensagens para a IA

`persistence.setMessagesHiddenFromAI(chatId, messageIds, hidden)` oculta da IA mensagens de um chat ou volta a mostrá-las, como o resumo do Engine faz com **Hide summarised messages** (ocultar mensagens resumidas). Exige a permissão `chat-write` e altera a mensagem e todos os swipes dela. Se o chat não for encontrado, a chamada é rejeitada.

- IDs que não sejam de mensagens desse chat são ignorados.
- Uma mensagem cuja visibilidade o usuário definiu na mão nunca é alterada.
- Retorna os IDs cujo sinalizador esta chamada alterou. Uma mensagem que já estava oculta (pelo resumo, por exemplo) não é retornada, então guarde os IDs retornados e volte a mostrar apenas essas mensagens depois.

Engines anteriores não têm o método: confira se ele existe ou declare 1.389.

```ts
const hidden = (await api.runtime.persistence.setMessagesHiddenFromAI?.(chatId, messageIds, true)) ?? [];
```

<a id="capability-api-1388-a-service-only-the-engine-can-read"></a>

### Capability API 1.388: um serviço que só o Engine pode ler

Todo serviço que um pacote registra pode ser lido por todos os outros pacotes por meio de `runtime.services.get(key)`. Um serviço destinado apenas ao Engine, como um runtime que o Engine chama durante a geração, recebe um terceiro argumento:

```ts
api.registerService("my-package:runtime", service, { hostOnly: true });
```

A consulta do próprio Engine continua retornando o serviço. `runtime.services.get` retorna `null` para ele a todos os pacotes, inclusive ao proprietário. Liberar o serviço remove o sinalizador, então a chave pode ser registrada de novo sem ele. Um Engine anterior à 1.388 ignora o argumento, então o serviço continua podendo ser lido ali; não dependa de `hostOnly` para manter o sigilo em Engines anteriores.

<a id="capability-api-1387-read-a-chats-summaries"></a>

### Capability API 1.387: ler os resumos de um chat

`persistence.listChatSummaries(chatId)` retorna os resumos que o Engine guarda para um chat, para que o pacote não precise extraí-los dos metadados do chat. Exige a permissão `chat-read`, assim como `listMessages`, e retorna cópias:

- `day` e `week`: resumos de Conversation por data (`"DD.MM.YYYY"`, com cada semana identificada pela segunda-feira), cada um no formato `{ summary, keyDetails }`.
- `rolling`: as entradas do resumo contínuo na ordem do chat, incluindo as desativadas (confira `enabled`). Um chat que só tem o resumo único antigo o retorna como uma entrada com `origin: "legacy"`, datada com a última atualização do chat.
- `gameSessions`: o resumo de cada sessão anterior de uma partida em Game. Cada entrada vem completa: um campo de texto ausente é lido como `""`, uma lista ausente como `[]`, uma lista antiga de `revelations` é incorporada a `keyDiscoveries`, e um `sessionNumber` ausente recebe a posição da entrada (a partir de 1). Uma entrada sem data usa o horário da última atualização do chat.

Um chat sem resumos ou que não seja encontrado recebe valores vazios. Engines anteriores não têm o método: confira se ele existe ou declare 1.387.

```ts
const { day, week, rolling, gameSessions } = (await api.runtime.persistence.listChatSummaries?.(chatId)) ?? {};
```

<a id="capability-api-1386-open-a-connection-and-raw-generation-for-packages"></a>

### Capability API 1.386: abrir uma conexão e gerar texto bruto em pacotes

A visualização do navegador recebe `openConnection(connectionId)`. Ela abre o editor na conexão salva, permitindo que um pacote com seletor de conexão ofereça **Edit connection** (editar conexão) em vez de configurações próprias de provedor. Ao fechar o editor, Home volta à aba do pacote; ao sair por outro caminho, como abrir um chat, isso não acontece. No layout de computador, Home e a visualização do pacote são desmontados enquanto o editor está aberto: salve primeiro o que o usuário digitou. Engines anteriores não têm essa função; confira se `openConnection` existe antes de mostrar o botão.

```ts
if (typeof props.openConnection === "function") props.openConnection(connectionId);
```

Um pacote de navegador também pode gerar texto com uma conexão salva, sem ter uma parte de servidor própria: use `POST /api/generate/raw` pelo cliente de API do host, que adiciona os cabeçalhos CSRF e de administrador.

- `connectionId`: a conexão salva. Seus parâmetros são aplicados, e `parameters` (`temperature`, `maxTokens`, `maxContext`, `topP`, `topK`, `minP`, `frequencyPenalty`, `presencePenalty`, `reasoningEffort`, `verbosity`, `serviceTier`, `customParameters`, `enabledParameters`) os substitui campo a campo.
- `messages`: de 1 a 200 mensagens `{ role: "system" | "user" | "assistant", content }`. Mensagens consecutivas do mesmo papel são combinadas e o prompt é ajustado ao contexto do modelo, como nas gerações do próprio Engine.
- `streaming`: `true` responde com eventos enviados pelo servidor; caso contrário, a resposta é `{ content, runId }` ou `{ aborted: true, runId }`.
- `runId`: seu identificador da execução. `POST /api/generate/raw/abort` com `{ runId }` a interrompe, assim como fechar a requisição.
- `debugMode` (1.386): passe o `debugMode` da visualização do navegador. Se for true, ou se o servidor estiver rodando com `DEBUG_AGENTS`, o servidor registra as mensagens finais enviadas ao provedor e a resposta. O corpo é estrito e um Engine anterior rejeita esse campo: envie-o apenas quando for true, de um pacote que declare 1.386.

Os eventos são `raw_started` (`{ runId }`), `token` (o próximo trecho de texto), `result` (`{ content }`, o texto inteiro), `aborted`, `error` (a mensagem), `fallback_used` quando a conexão de reserva do Engine respondeu, e `done`, sempre por último.

<a id="capability-api-150-professor-mari-actions"></a>

### Capability API 1.50: ações do Professor Mari

Um pacote com a nova permissão `mari-actions` pode oferecer ações nomeadas ao Professor Mari. Ele registra um serviço sob seu próprio ID; a ferramenta `package_service` de Mari lista as ações e executa uma quando o usuário pede.

```ts
export async function activate({ api }) {
  api.registerService("mari-actions:my-package", {
    list: () => [
      {
        name: "add-idea",
        summary: "Give a Creator an idea for a post.",
        inputs: { accountId: "The Creator.", text: "The idea." },
      },
    ],
    run: async (name, input, { signal }) => {
      const parsed = schemas[name]?.safeParse(input);
      if (!parsed?.success) return { ok: false, status: 400, error: "Invalid input." };
      return { ok: true, value: await doIt(name, parsed.data, signal) };
    },
  });
}
```

Regras que vale conhecer:

- A chave deve ser `mari-actions:<package-id>` do pacote que registra. Sem a permissão ou sob o ID de outro pacote, o registro lança erro; assim, a ação executada por Mari sempre pertence ao pacote nomeado.
- `list()` retorna entradas `{ name, summary?, inputs? }`. Nomes têm de 1 a 80 letras, dígitos, `.`, `_` ou `-`; outras entradas não aparecem. Mari lê `summary` e `inputs`, então escreva com clareza. Só as primeiras 50 ações podem ser vistas ou executadas. Mari vê até 40 entradas por ação; nomes são cortados em 80 caracteres e textos em 300. `list()` deve responder em 5 segundos ou as ações do pacote são omitidas.
- `run(name, input, { signal })` só recebe nome listado e objeto JSON simples de até 64.000 caracteres. A entrada vem de um modelo: valide com seu próprio esquema antes de agir. Responda `{ ok: true, value }` ou `{ ok: false, status?, error }`; Mari vê os primeiros 2.000 caracteres do erro. `signal` aborta quando o usuário para Mari ou após 5 minutos; o Engine deixa de esperar, então pare seu trabalho também.
- O Engine omite URLs de dados em `value` antes de Mari ler e corta respostas longas. Retorne IDs e texto curto, não arquivos.
- Listar é somente leitura. Toda execução conta como alteração no Permissions Mode de Mari: Plan recusa e Manual aguarda o Accept do usuário. O Engine não consegue pré-visualizar nem desfazer ação de pacote; por isso não mostra card Keep/Restore. Ofereça uma ação própria de desfazer quando a alteração for difícil de reverter. Por esse motivo, Plan também recusa ações que só leem.
- Desativar ou remover o pacote remove suas ações.

`mari-actions` é recusado se o manifesto declarar `capabilityApi` anterior a 1.50.

### Capability API 1.36: conquistas dos pacotes

Um pacote com a nova permissão `achievements` pode adicionar medalhas ao painel **Achievements** (conquistas) da tela inicial, consultar se estão desbloqueadas e desbloqueá-las. O painel as mostra em uma seção com o nome do pacote como título, depois das medalhas do próprio Engine.

```ts
export async function activate({ api }) {
  api.registerAchievements([
    { id: "first_run", title: "First Run", description: "Ran the package once.", iconPath: "art/first-run.png" },
    {
      id: "ten_runs",
      title: "Regular",
      description: "Ran the package ten times.",
      target: 10,
      readProgress: () => runs,
    },
  ]);
  // Later, when the package decides a badge is earned:
  if (await api.runtime.achievements.unlock("first_run")) celebrate();
}
```

Regras que vale conhecer:

- Os IDs usam o espaço de nomes `<packageId>.<id>`. Um ID integrado não contém ponto, então os dois não podem entrar em conflito. O host aceita o ID local ou o que inclui o espaço de nomes e recusa qualquer ID que o próprio pacote não tenha registrado.
- `unlock(id)` resolve com `true` apenas para a chamada que desbloqueou a medalha. `isUnlocked(id)` e `list()` leem o estado; `list()` retorna as medalhas do próprio pacote com o progresso.
- A contagem fica a cargo do pacote. Uma medalha graduada define `target` e um callback `readProgress`: ambos ou nenhum. Engine a desbloqueia na mesma passagem em que verifica suas próprias medalhas graduadas, assim que a contagem atinge a meta. Mantenha o contador no host de persistência. Se um callback lançar uma exceção ou não concluir em **2 segundos**, o valor informado será zero e o problema será registrado. Assim como nas ferramentas, isso limita apenas as esperas assíncronas: o trabalho síncrono que bloqueia o loop de eventos não pode ser interrompido.
- `iconPath` é um caminho dentro do diretório raiz de recursos do pacote, servido pela rota de recursos do pacote. Um card bloqueado continua mostrando o cadeado. Se a imagem não carregar, o card usa `icon` como alternativa (`trophy` por padrão).
- `title` e `description` são os textos exibidos. Um pacote de idioma pode substituí-los por meio de `capabilityAchievements.<packageId>.<id>.title` e `.description`.
- No máximo **32 medalhas por pacote**. Um lote com uma única entrada inválida não registra nada.
- Desativar ou remover o pacote oculta suas medalhas. Os desbloqueios são mantidos, como os das medalhas do próprio Engine, e voltam a aparecer quando o pacote retorna.

`api.registerAchievements` e `api.runtime.achievements` só existem em um Engine desta versão ou de uma versão mais recente, então um pacote que os utiliza declara `capabilityApi` 1.36.

<a id="capability-api-135-agent-home-widgets"></a>

### Capability API 1.35: widgets Home de agentes

Um pacote de agente pode oferecer até três cards para a grade de widgets Home. O Engine nunca os coloca sozinho: o usuário adiciona, oculta, restaura e reordena no **Widget Manager** (gerenciador de widgets), agrupados sob o agente. O Engine controla grade, moldura e layout; o pacote controla o interior do card.

Declare o slot `home-widget` junto das definições:

```json
{
  "schemaVersion": 2,
  "capabilityApi": { "major": 1, "minor": 35 },
  "kind": ["agent"],
  "permissions": ["ui"],
  "entrypoints": { "client": "client.js" },
  "contributions": {
    "slots": ["home-widget"],
    "homeWidgets": [
      {
        "id": "latest",
        "label": "Latest Posts",
        "description": "The newest posts from the feed.",
        "size": "large",
        "iconPath": "art/widget.png",
        "accent": "violet",
        "surface": "solid",
        "header": "banner"
      }
    ]
  }
}
```

- `id` usa kebab-case minúsculo, tem até 64 caracteres e é único no pacote.
- `label` (1–80 caracteres) e `description` (até 200) são os textos do Widget Manager. Um pacote de idioma pode substituí-los por `localizations.<locale>.homeWidgets.<id>.label` e `.description`.
- `size` é `compact` ou `large`. Um widget grande ocupa mais espaço na grade.
- `icon` é um nome de ícone do Engine (`activity`, `bell`, `calendar`, `chart`, `circle`, `clock`, `file`, `flame`, `heart`, `image`, `list`, `message`, `sparkles`, `star`, `zap`). `iconPath` é arte do pacote (`gif`, `jpg`, `jpeg`, `png`, `webp`) e deve constar em `files[]`.
- `accent`, `surface` e `header` escolhem presets de apresentação do Engine.

A instalação é recusada se o pacote não for `agent` com permissão `ui` e entrada de cliente, se slot e `homeWidgets` não forem declarados juntos, se dois widgets compartilharem ID ou se `capabilityApi` for anterior a 1.35.

O Engine monta o elemento cliente com `view="widget"`. Além de `packageId`, `packageVersion` e `localization`, `capabilityProps` contém:

- `widgetId`, `widgetLabel`, `widgetDescription`, `widgetIcon`, `widgetIconPath`, `widgetAccent`, `widgetSurface` e `widgetHeader`: definição do card desenhado, para um bundle renderizar todos os widgets que declara.
- `active`: `true` apenas enquanto Home aparece e o card está visível. Pause consultas e animações quando for `false`.
- `onOpenNoodle()`: abre a aba de navegador Home do próprio pacote. Apesar do nome, funciona para qualquer pacote que também declare `home-browser-tab`. Sem essa aba, a função e `onOpenPost` não fazem nada.
- `onOpenPost(id)`: abre a aba Home própria em um item. `id` é uma string de até 128 caracteres; outros valores são ignorados. O elemento `view="browser"` recebe `focusPostId: id`. Deve chamar `onFocusPostHandled()` depois de mostrar o item, para não repetir o foco. Trocar para outra aba descarta o foco pendente.

Um widget é uma pequena visualização do agente, não outra cópia. Mantenha-o leve e encaminhe tarefas maiores à aba de navegador.

### Capability API 1.34: uma criatura escrita nos termos do conjunto

Uma criatura de bestiário pode conter `sheet`: uma ficha nos termos do conjunto, tão parcial quanto necessário. A luta a constrói como a de um membro do grupo: saúde, defesa, salvaguardas, iniciativa, velocidade e habilidades das listas vêm das declarações do conjunto e são pagas com suas próprias reservas. Ela não declara também `health`, `defense`, `initiativeModifier`, `speed`, `abilities` nem `saves`, e pode não ter ações de bloco próprias:

```json
{
  "capabilityApi": { "major": 1, "minor": 34 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/creatures.json"] } }
}
```

A verificação lê os bytes do conjunto e cada catálogo que a instalação possui, como na 1.27. Uma linha da ficha da criatura pode conter `_catalog: "<catalog>/<entry>"` para uma entrada de catálogo que alimenta essa lista; o motor carrega esses catálogos junto ao bestiário para a luta. Não é uma integração opcional, pelo mesmo motivo que 1.20–1.33: um motor que não entende a chave recusa o catálogo estrito inteiro. O pacote que a inclui declara 1.34. Nenhuma permissão nova.

### Capability API 1.33: o momento que uma reação espera

`mechanics.reaction` de uma entrada pode ser um objeto em vez de `true`. `on` nomeia o momento percebido pelo motor, `at` indica a quem a ação escolhida se dirige e `cancels` impede o que a janela deixou em espera de acontecer:

```json
{
  "capabilityApi": { "major": 1, "minor": 33 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json", "catalogs/spells.json"] } }
}
```

`on` é `aimed`, antes de algo atingir o portador, ou `harmed`, depois de ele sofrer dano; declarar um coloca a entrada no menu dessa janela. `at` é `source`, que preenche quem causou o momento, ou `chosen`, que mantém os alvos da entrada. Só uma entrada `aimed` pode `cancel`: não se cancela algo que já aconteceu. O custo de uma ação cancelada continua gasto, pois foi pago antes da pergunta.

Uma entrada que mantém `"reaction": true` só informa que não é usada num turno, o que não basta para oferecê-la numa janela; fica fora de todos os menus e não precisa de versão mais nova. Não é uma integração opcional, pelo mesmo motivo que 1.20–1.32: um motor que não entende o objeto recusa o catálogo estrito inteiro. O pacote que o inclui declara 1.33. Nenhuma permissão nova.

### Capability API 1.32: uma arma que limita seus próprios ataques

Uma fonte de ataques pode declarar `strikesCappedBy`, uma coluna booleana de sua lista. Se estiver ativa numa linha, essa linha compra um único ataque, independentemente de quantos `strikes` compra para a lista. Assim, uma arma que dispara uma vez por turno mantém esse limite enquanto o restante ataca tantas vezes quanto a ficha determina. Isso corresponde à propriedade Loading do SRD 5.1: "you can fire only one piece of ammunition when you use an action, bonus action, or reaction to fire it, regardless of the number of attacks you can normally make."

```json
{
  "capabilityApi": { "major": 1, "minor": 32 },
  "kind": ["ruleset"],
  "contributions": { "assets": { "paths": ["ruleset.json"] } }
}
```

Exige `strikes` e é recusado sem ele, pois uma lista que compra um ataque por gasto já limita cada linha a um. Não é uma integração opcional, pelo mesmo motivo que 1.20–1.31: um motor que não entende a chave recusa o arquivo de regras inteiro. O pacote que a inclui declara 1.32. Nenhuma permissão nova.

### Capability API 1.31: integrações de geração do host

Pacotes do servidor podem usar `api.runtime.integrations` para acessar os serviços atuais do motor de LLM, imagens e vídeo. Declare API de capacidades 1.31 no manifesto e verifique a disponibilidade do host de integração durante a ativação. Motores antigos recusam o requisito API antes de ativar. Operações com provedores exigem `network`; salvar, preparar e remover mídia exige `storage`.

- `llm.createProvider(...)` aceita as configurações de conexão da fábrica do motor, incluindo parâmetros de solicitação e cabeçalhos personalizados. O provedor tem suporte a `chat`, `chatComplete`, `embed`, `maxContextValue` e `maxTokensOverrideValue`. Não expõe propriedades de credenciais.
- `llm.localSidecar()` retorna o provedor sidecar local do host pela mesma fachada.
- `llm.withFallback(...)` envolve um provedor criado pelo mesmo host do pacote. Preserva a admissão, as notificações de fallback e a seleção de provedor do motor.
- `images.generate(...)` e `videos.generate(...)` usam as implementações ativas do motor, incluindo cancelamento, registro de solicitações, verificações de rede e filas de mídia. Encaminhe o `signal` e o `debugMode` da interface do chamador quando existirem.
- `images.save`, `images.remove`, `images.stage` e `images.sweepStaged` reutilizam as escritas seguras e o ciclo de arquivos preparados da galeria. `videos.save` e `videos.remove` reutilizam o caminho de armazenamento de vídeo. `images.resolveNovelAiRequestSize` reutiliza a normalização de tamanho NovelAI do host. Duração de vídeo e normalização de envio público de referências estão disponíveis em `videos.resolveDuration` e `videos.resolveReferenceUpload`.
- `speech.transcribe(audio, { filename, mimeType, signal })` envia o áudio gravado para o servidor de conversão de fala em texto que o usuário definiu em **Connections → Speech to Text** (Conexões → Speech to Text) e resolve com a transcrição, ou com `null` enquanto esse servidor estiver desligado, para que o pacote mantenha a própria transcrição. Aplica a política de URLs do host (`STT_LOCAL_URLS_ENABLED`) e os limites de tamanho e de tempo, e nunca expõe a chave salva. `speech` é opcional e não exige uma API de capacidades mais nova: verifique `typeof api.runtime.integrations?.speech?.transcribe === "function"` e, em motores antigos, recorra à transcrição do próprio pacote.

`@marinara-engine/shared` exporta os tipos compartilhados de solicitação e resultado. Mantenha a construção de prompts e a orquestração específicas no pacote; use esses pontos do host para E/S de provedores em vez de copiar os serviços do motor. Tipos e auxiliares puros ainda podem ser incluídos no pacote.

<a id="package-audio"></a>

### Áudio de pacotes

A partir da Capability API **1.381**, `__MARINARA_HOST__.services.audio` fornece reprodução e seleção de recursos pelo Engine. Declare essa versão secundária no manifesto do pacote e atualize o Engine junto com o pacote. A fala continua em `services.tts`; música e efeitos sonoros usam `services.audio`. `services.tts.ttsService.speakSequence(requests, id?, options?)` aceita `options.audioConnectionId` desde a versão 1.381, aplicando a conexão de fala selecionada a cada trecho e mantendo a voz de cada solicitação. Deixe o valor indefinido para usar o padrão normal ou passe `""` para usar explicitamente as configurações antigas de TTS.

Um `audioConnectionId` desconhecido, excluído, em quarentena ou que não seja de fala é ignorado, e a resolução normal de fala é executada: primeiro a seleção de fala salva, depois a conexão padrão/de fallback e, por fim, as configurações antigas. Se a própria seleção de fala salva estiver indisponível, a reprodução é recusada em vez de usar outra conexão. Pacotes que exigem uma conexão específica devem validar o ID salvo antes da reprodução.

- `createPlayer()` retorna um player independente com `unlock()`, `playMusic(tag, assets?)`, `stopMusic(immediate?)`, `playSfx(tag, assets?, loopCount?)`, `setVolumes({ music, sfx })`, `setMuted(boolean)` e `dispose()`. Os volumes vão de 0 a 1. `assets` é um registro indexado por tag, cujas entradas têm `{ path: string, url?: string }`; os caminhos usam o servidor de recursos existente de Game, enquanto `url` pode apontar para um recurso do pacote. A reprodução reutiliza o crossfade, a nova tentativa de reprodução automática e o pool de efeitos sonoros do Engine. Chame `unlock()` diretamente em uma interação do usuário ao iniciar o áudio; as regras de reprodução automática do navegador continuam valendo.
- Mantenha um player para a interface montada do pacote e chame `dispose()` ao desmontá-la. A limpeza para permanentemente o áudio daquele player, libera o contexto e os listeners de gestos e torna inertes as chamadas posteriores. Não para o Game nem o player de outro pacote. Crie outro player quando a interface for montada de novo.
- `getAssetManifest()` busca `/api/game-assets/manifest` pelo cliente de API do Engine e retorna `{ scannedAt, count, assets, byCategory }`. Cada recurso tem `tag`, `category`, `subcategory`, `name`, `path` e `ext`. Passe `manifest.assets` para a reprodução; busque de novo depois de adicionar recursos gerados, se necessário.
- `selectDefaultMusic(cue, manifest, { currentTag?, genre? }?)` retorna uma tag de música existente ou `null`. Os contextos são `home`, `combat`, `boss`, `happy`, `tense`, `sad` e `bond`. Reutiliza o classificador de música de Game e apenas a biblioteca por estado; faixas de área/nível de outro Game e faixas geradas para o contexto de pacotes ficam de fora. Passe a tag atual para manter estável uma música adequada. Escolha de novo quando o contexto mudar, não quando o volume mudar. Os contextos incluídos podem compartilhar uma faixa: esse auxiliar não gera música nem promete uma composição diferente para cada clima.

Para reproduzir um `{ tag, path }` gerado pelo Engine, use `player.playMusic(tag, { [tag]: { path } })`. A geração e a seleção de provedores ficam no servidor; os pacotes não podem duplicar solicitações ao provedor nem acessar credenciais salvas. Use o endpoint de geração do Engine para música e efeitos gerados com ativação opcional e mantenha chaves de contexto gerado separadas para cada mundo e contexto do pacote. Uma faixa gerada que falhar ou estiver indisponível pode recorrer a `selectDefaultMusic`.

### Capability API 1.341: serviços de execução do host e bibliotecas compartilhadas do servidor

O servidor de um pacote que inclui a própria cópia de um serviço do Engine executa uma segunda instância dele, com estado próprio:
sua própria conexão com o Intiface, sua própria admissão de conexões, sua própria fila de metadados de chat e seu próprio registro de serviços.
A Capability API 1.341 adiciona membros de `api.runtime` que acessam as instâncias ativas do Engine e permite que servidores de
pacotes usem algumas bibliotecas do Engine em vez de incluí-las no bundle. Cada novo membro é opcional em
`CapabilityRuntimeHost`, então verifique se ele existe antes de usá-lo.

- `runtime.services.get(key)` retorna um serviço que um pacote registrou com `api.registerService`, ou `null` enquanto ele estiver
  ausente ou durante uma geração em uma sala compartilhada. Lê o registro do próprio Engine, então todos os pacotes o veem.
  As chaves `agent-runtime:` e `mari-actions:` sempre retornam `null`; só o Engine as lê. O mesmo vale para um serviço
  registrado com `hostOnly` (Capability API 1.388), para todos os pacotes, inclusive o proprietário.
- `runtime.commands.parse(content)`, `strip(content)` e `instructions()` leem comandos de Conversation com a
  gramática do Engine e as marcações registradas de todos os pacotes.
- `runtime.logger.isLevelEnabled(level)` informa se o sistema de logs do Engine está gravando esse nível no momento.
- `runtime.persistence.patchChatMetadata(chatId, patch, { touchUpdatedAt })` é a alteração de metadados em fila do Engine,
  com uma fila por chat compartilhada com os próprios gravadores do Engine, a proteção de salas compartilhadas e os ordinais de gravação. As chaves na
  alteração substituem essas chaves, e todas as outras permanecem. `patch` pode ser uma função dos metadados atuais. Dentro de
  `withChatLock` para o mesmo chat, a alteração é executada sob esse bloqueio. Como `updateChatMetadata`, recusa uma nova referência a
  uma imagem da Global Gallery que já não existe.
- `runtime.persistence.appendMessages(chatId, messages)` adiciona mensagens, cada uma com seu primeiro swipe, em um único lote e
  as retorna. `createChatNote` e `createChatInfluence` adicionam uma nota ou uma influência de uso único de uma Conversation
  ao Roleplay conectado. Esses quatro membros de persistência exigem `chat-write`.
- `runtime.persistence.updateCharacterStatus(chatId, characterId, { status, activity, duration })` aplica uma
  `[schedule_update]` como o Engine faz depois de uma resposta de Conversation: um status temporário no card de personagem,
  que o personagem mostra em todos os chats até terminar. `status` é `online`, `idle`, `dnd` ou `offline`, `activity`
  tem no máximo 500 caracteres, e pelo menos um dos dois é obrigatório. `duration` é escrito como no comando (`2h`,
  `30m`); sem duração, ou quando ela não pode ser interpretada, o status dura 60 minutos, e nunca mais de uma semana. Retorna
  `{ status, activity, expiresAt }`, ou `null` quando nada mudou: um status definido à mão pelo usuário mantém a prioridade,
  e uma sala compartilhada conserva suas próprias rotinas. Recusa uma atualização inválida, um chat que não seja de Conversation
  e um personagem que não esteja no chat, e exige `chat-write`. Foi adicionado à API de capacidades 1.341 depois dos
  primeiros Engines que informam 1.341, então verifique `typeof api.runtime.persistence.updateCharacterStatus === "function"` e
  pule a mudança de status quando não existir.
- `runtime.integrations.admission` é a admissão de conexões do Engine, então o trabalho de um pacote em segundo plano espera pelas
  solicitações do próprio usuário na mesma conexão. `withProvider(provider, connectionId, mode)` envolve um provedor criado pelas
  integrações do mesmo pacote, `run(connectionId, mode, operation)` executa uma tentativa, `tryBackground(connectionId)`
  ocupa a vaga de segundo plano quando a conexão está livre, e `isFailure(error)` reconhece os erros do Engine que indicam conexão ocupada ou
  rejeição. Não exige permissão, pois só reserva vagas.
- `runtime.integrations.haptics` (`status`, `connect`, `executeCommand`) usa a única conexão com o Intiface Central
  do Engine. Exige `network`.
- `runtime.integrations.spotify` (`commandsAvailable`, `playSong`) usa a conta do Spotify do agente Music DJ.
  `playSong` falha com `ConversationSpotifyCommandError`; os códigos `spotify_unavailable` e
  `missing_playback_scope` significam que o Spotify não está configurado, então descarte o comando sem exibir um aviso. Exige `network`.
- `runtime.integrations.speech.transcribeLocal(wav)` transcreve uma gravação PCM WAV com o modelo Local Whisper
  baixado em **Connections**, e falha com a mensagem do Engine quando ele não está baixado. Exige `network`.
- `runtime.integrations.images.addToChatGallery(input)` inclui uma imagem salva com `images.save` na galeria
  do chat, e `images.persistToEntityGalleries(input)` a inclui nas galerias dos personagens e das personas que ela
  mostra, como acontece com as imagens geradas pelo Engine. Ambos exigem `storage`.

**Nunca uma cópia incluída no bundle.** Quando um desses membros está ausente, o pacote informa que o recurso exige um
Marinara Engine mais novo. Nunca recorre a uma cópia incluída no bundle de um serviço do Engine que mantém estado, como o registro de provedores,
o sidecar local, a admissão de conexões, o serviço háptico, o Spotify, o sistema de logs, um registro ou uma fila de armazenamento, porque uma segunda
cópia divide o estado que o Engine mantém em um só lugar. Tipos e auxiliares puros ainda podem ser incluídos no bundle.

**Bibliotecas compartilhadas do servidor.** O servidor de um pacote pode deixar `zod`, `adm-zip`, `dotenv`, `nanoid` e `jsonrepair` fora do
bundle e importá-los pelo nome, como já pode fazer com `@huggingface/transformers`, `onnxruntime-node`,
`onnxruntime-web`, `sharp`, `pino`, `pino-pretty` e `undici`. O Engine cria links gerenciados na cópia de execução de cada pacote,
gerenciada pelo host, resolvendo as dependências declaradas do servidor do Engine com o resolvedor de pacotes do Node. Isso funciona
com dependências diretas, com hoisting e com hoisting parcial, inclusive quando `DATA_DIR` fica fora do checkout do Engine.
O Zod é a exceção de compatibilidade: a importação de `zod` de um pacote resolve a dependência completa `zod-v3`, incluindo suas
exportações padrão, nomeadas, CommonJS e de subcaminhos. As outras bibliotecas mantêm a mesma instância do módulo que o Engine usa.
As importações de `zod` do próprio Engine continuam resolvendo o Zod 4 nativo. Os nomes acima continuam sendo dependências diretas
de produção de `packages/server`. Os snapshots gerenciados vinculam as dependências declaradas; dependências transitivas não declaradas,
como `ws`, não fazem parte do contrato de bibliotecas compartilhadas. Bibliotecas opcionais ausentes são ignoradas, e as ferramentas
de desenvolvimento instaladas continuam disponíveis. Um alias do Zod 3 ausente ou incompatível faz a ativação falhar explicitamente,
em vez de deixar um pacote carregar o Zod 4 nativo em silêncio. Falhas na configuração de dependências do host preservam a versão
solicitada do pacote e os metadados de rollback; depois que a dependência do Engine é corrigida, a ativação pode tentar de novo
sem reinstalar o pacote.
O Windows usa junções para esses links; instalações pelo código-fonte e pelo inicializador, Android e Termux e as duas imagens Docker
usam o mesmo contrato de resolução de dependências. Os links antigos de dados compartilhados são atualizados quando a pasta física
de dependências do servidor está disponível. As pastas reais existentes permanecem intactas, e as novas cópias de execução resolvem
suas dependências independentemente desse link antigo de dados. A árvore de dependências declarada e incluída no bundle do próprio pacote permanece intacta.

Na inicialização, os pacotes antigos da API-1 desativados pelos erros conhecidos de migração do Zod passam por uma nova tentativa,
com as verificações normais de compatibilidade e integridade dos arquivos. Isso permite que um Engine corrigido recupere uma instalação
que já falhou sem excluir seus mapas nem outros dados de pacote. Pacotes com outras mensagens de erro continuam desativados. As entradas
antigas do registro guardam apenas mensagens de erro, então a recuperação reconhece as falhas antigas exatas de `innerType` e de `curve` aninhado.

**Como declarar.** Um pacote que use qualquer um desses recursos declara `schemaVersion: 2`, `capabilityApi: { major: 1, minor: 341 }`
e `builtAgainst`, e mantém seu intervalo `engine`. Um manifesto `schemaVersion: 1` nunca é verificado em relação à
API de capacidades, então passa para a versão 2. A API de capacidades é o critério, não a versão do Engine: um Engine sem
esses membros recusa a instalação ou a atualização ("Package requires capability API 1.341; this Engine supports ..."),
deixa o pacote fora da lista de atualizações e mantém a versão instalada em execução.
