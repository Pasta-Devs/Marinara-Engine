# Mapa da arquitetura (desenvolvedores)

Este guia é material técnico para quem contribui com o projeto. Ele descreve como o código do Marinara Engine está organizado: as bases compartilhadas, os sistemas de recursos, o que pertence a cada modo e onde cada pedaço de código deve ficar. Também aponta os arquivos grandes de hoje e o rumo dos próximos trabalhos de refatoração.

Escopo: as pastas `packages/client/src`, `packages/server/src` e `packages/shared/src`. O repositório não mantém uma suíte convencional de arquivos `.test.ts`. A validação automática vem dos scripts de regressão versionados e da cobertura de testes de fumaça do Playwright; os arquivos `.test.ts` temporários, usados só como prova, ficam no gitignore e são removidos depois do uso.

A quantidade de arquivos, de linhas e de rotas muda conforme o repositório evolui. Este mapa dá formatos e nomes aproximados. Para números exatos, consulte sempre a árvore atual do projeto.

## Códigos de seção

Use estes códigos ao planejar movimentações de código, ao rotular issues ou ao acrescentar um cabeçalho curto em um arquivo que ainda não pode ser movido.

| Código | Significado | Local principal |
| --- | --- | --- |
| `CORE-CONTRACT` | Tipos, schemas, constantes e funções auxiliares puras compartilhadas por cliente e servidor | `packages/shared/src` |
| `CLIENT-APP` | Inicialização do aplicativo React, estrutura de layout, ligações globais de interface | `packages/client/src/App.tsx`, `main.tsx`, `components/layout` |
| `CLIENT-SHARED` | Primitivos de interface exclusivos do cliente, hooks comuns, auxiliares comuns de navegador, stores globais | `packages/client/src/components/ui`, `hooks`, `lib`, `stores` |
| `SERVER-APP` | Inicialização do aplicativo Fastify, middleware, registro de rotas, configuração de execução | `packages/server/src/app.ts`, `index.ts`, `middleware`, `config` |
| `SERVER-SHARED` | Bases de armazenamento, banco de dados, LLM, prompt, lorebook, importação e integrações usadas só no servidor | `packages/server/src/services`, `db`, `utils`, `lib` |
| `MODE-CONVERSATION` | Interface e comportamento de servidor exclusivos do Conversation Mode | componentes de conversation, `/api/conversation`, serviços de conversation |
| `MODE-ROLEPLAY` | Interface de Roleplay, cenas, sprites, auxiliares de encontro | componentes de chat de roleplay, `/api/scene`, `/api/encounter`, `/api/sprites` |
| `MODE-GAME` | Interface do Game Mode, prompts do GM, dados, equipe, mapa, combate, assets, sessões | `components/game`, `/api/game`, serviços de jogo |
| `FEATURE-AGENTS` | Definições de agentes, execução, estado de depuração, roteamento de conhecimento | componentes de agente, store de agentes, rotas e serviços de agentes |
| `FEATURE-ASSETS` | Planos de fundo, avatares, galeria, imagens geradas, sprites, assets de jogo | rotas de assets, armazenamento da galeria, serviços de imagem |
| `FEATURE-SIDECAR` | Execução de modelos locais, análise de cena, downloads, controle de processos | store do sidecar, `/api/sidecar`, serviços do sidecar |
| `FEATURE-TTS` | Configuração de TTS, roteamento de vozes, chaves de cache, reprodução de áudio | configurações, hooks, rotas e serviços de TTS |
| `FEATURE-IMPORT` | Importadores de SillyTavern e do Marinara e auxiliares de migração | rotas e serviços de importação |
| `TEST` | Cobertura de regressão versionada e testes de fumaça no navegador, mais testes temporários de prova quando necessário | `scripts/regressions`, `e2e` e arquivos temporários em `packages/server/src/**/__tests__/` removidos depois do uso |

O ideal é que o próprio caminho do arquivo indique a seção. Um comentário como `// Section: MODE-GAME` só serve enquanto o arquivo ainda estiver em uma pasta mista.

## Limites entre pacotes

### packages/shared

`CORE-CONTRACT`. Este pacote deve continuar independente do ambiente de execução.

Conteúdo atual:

- `types`: chat, personagem, jogo, estado do jogo, combate, cena, sidecar, TTS, agentes, prompts, lorebooks, exportações, temas.
- `schemas`: schemas Zod para as entidades persistidas e compartilhadas.
- `constants`: provedores, valores padrão, modos de chat, listas de modelos, prompts de agentes.
- `utils`: funções auxiliares puras, como expansão de macros, empacotamento em XML e pontuação de trilha musical.
- `features`: manifestos e registro de agentes, definições de chamadas de função, pacotes de pastas, os motores de jogos por turno de UNO, Chess e Poker, os conjuntos de regras do Game Mode e o combate deles (`rulesets`, `ruleset-combat`, `tactical-combat` e os arquivos `combat-*`) e o gerador de mundos com os arquivos de compartilhamento (kits de cenário, mundos e pacotes de tiles, tabuleiros e criaturas) em `world`.

Regras:

- Nada de React, DOM, Fastify, armazenamento do servidor, sistema de arquivos, rede ou SDK de provedor.
- Traga código para cá só quando cliente e servidor precisarem do mesmo contrato ou do mesmo algoritmo puro.
- Não transforme a pasta `shared` em depósito de auxiliares que só o cliente usa.

### packages/client

React 19 e PWA com Vite. Hoje o pacote tem várias centenas de arquivos de código.

Estrutura atual no nível de topo:

- `App.tsx`, `main.tsx`: inicialização do aplicativo, React Query, PWA, efeitos globais.
- `components/layout`: estrutura do aplicativo, barras laterais, barra superior, renderizador de janelas.
- `components/ui`: primitivos de interface reutilizáveis.
- `components/chat`: mistura de interface comum de chat, conversation, roleplay, cena, sprite e encontro.
- `components/game`: a superfície e os painéis do Game Mode.
- `components/panels`, `components/modals` e os editores de entidades: configurações e gerenciamento de recursos.
- `features`: módulos de recursos já extraídos, hoje com as seções de **Chat Settings** (configurações do chat), partes do painel de trackers, o multijogador e o contrato, a configuração, o palco e os renderizadores dos agentes de avatar (`features/avatars`).
- `hooks`: hooks de React Query e hooks de execução para a maior parte dos recursos da API.
- `lib`: auxiliares de navegador e de cliente. Hoje mistura auxiliares comuns com auxiliares específicos do Game Mode.
- `stores`: stores Zustand para interface, execução do chat, agentes, estado do jogo, Game Mode, assets, sidecar, tradução, galeria, encontros e os jogos por turno.
- `styles`: a folha de estilo global e o CSS de cada tema.

Cruzamentos importantes que existem hoje:

- A pasta `components/game` importa `components/chat` para peças visuais compartilhadas, como o clima e os painéis laterais da galeria.
- A pasta `components/chat` importa o estado do jogo e o estado de encontro para recursos de roleplay.
- O arquivo `hooks/use-generate.ts` mexe no estado do chat, no estado dos agentes, no estado do jogo, no estado do Game Mode, no estado da tradução e nas configurações de interface.
- Os auxiliares `lib/game-*` servem só ao Game Mode, mas ficam ao lado dos auxiliares globais.

### packages/server

API em Fastify, armazenamento nativo em arquivos e integrações com provedores. Hoje o pacote tem várias centenas de arquivos de código.

Estrutura atual no nível de topo:

- `app.ts`, `index.ts`: fábrica do aplicativo, inicialização, entrega de arquivos estáticos, hidratação do armazenamento em arquivos e os seeders.
- `routes`: muitos arquivos de rota. A maioria é uma API CRUD enxuta, mas `generate.routes.ts` e `game.routes.ts` são arquivos grandes de orquestração. A pasta `routes/generate/` guarda as partes extraídas até agora do caminho de geração, incluindo a cadeia de saída de tokens (`generation-stream-output.ts`), as rodadas de chamadas de ferramenta (`tool-rounds.ts`), a interpretação dos comandos da resposta e a limpeza do texto, e o salvamento da resposta (`save-generated-reply.ts`).
- `services/storage`: a camada de fachada de armazenamento para chats, personagens, prompts, lorebooks, configurações, assets, temas e estado do jogo.
- `services/llm`: registro de provedores, o contrato base de provedor, provedores compatíveis com OpenAI e a ponte para o sidecar local.
- `services/prompt`: a montagem de prompt compartilhada pelas gerações fora do Game Mode.
- `services/conversation`: agendas, mensagens autônomas, percepção de contexto, perfis de conversation e o tratamento dos comandos de conversation.
- `services/game`: prompts do GM, dados, combate, máquina de estados, prompts da equipe, mapas, clima, tempo, sessões, checkpoints, reputação e assets.
- `services/sidecar`: execução local, gerenciamento de modelos, análise de cena e pós-processamento de cena.
- `services/agents`: execução de agentes e roteamento de conhecimento.
- Bases de recursos: `services/import`, `services/lorebook`, `services/image`, `services/haptic`, `services/tools`, `services/regex`, `services/professor-mari`, `services/mari-db`, `services/turn-games`, `services/spotify`, `services/video`, `services/generation`, `services/chat-summary`, `services/achievements`, `services/prompt-overrides`, `services/setup`, `services/noodle`, `services/memory-recall`, `services/avatars` (armazenamento e geração de modelos de avatar e o classificador de emoções dos agentes de avatar), `speech-to-text.service.ts` e `discord-webhook.ts`.
- `db/schema`: as definições das tabelas em arquivo para os dados guardados em `DATA_DIR/storage`.
- `db/file-schema.ts`, `db/file-query.ts`: os metadados nativos das tabelas e as expressões de consulta.
- `db/file-backed-store.ts`: o store de tabelas em memória, o limite de transação, a recuperação após falhas e a persistência em snapshots JSON. Veja [Armazenamento nativo em arquivos](file-storage.md).

Cruzamentos importantes que existem hoje:

- As rotas importam diretamente os serviços de armazenamento, LLM, prompt, lorebook, jogo, sidecar e os demais serviços de recursos.
- O arquivo `generate.routes.ts` atende o caminho principal de geração de conversation e roleplay, além do pipeline de agentes.
- O arquivo `game.routes.ts` cuida da orquestração do jogo e ainda alcança comportamentos de LLM, sidecar, lorebook, imagem, armazenamento e webhook do Discord.
- A análise de cena mora nos serviços de sidecar, mas o Game Mode pode executá-la pelo sidecar ou por uma conexão de LLM escolhida.

## O que pertence a cada modo

### Compartilhado por todos os modos

Estas são as bases globais:

- Persistência de chats e mensagens: `packages/server/src/routes/chats.routes.ts`, `packages/server/src/services/storage/chats.storage.ts` e os tipos e schemas de chat compartilhados.
- Personagens e personas: as rotas de personagem, o armazenamento, os schemas e os hooks e editores de personagem no cliente.
- Conexões e provedores: as rotas de conexão, o armazenamento, as constantes de provedor compartilhadas e a pasta `services/llm`.
- Presets de prompt, lorebooks, regex e ferramentas personalizadas: as bases compartilhadas de criação e de inserção no prompt.
- Transporte da geração: `packages/client/src/hooks/use-generate.ts`, `packages/server/src/routes/generate.routes.ts` e o registro de provedores.
- TTS, tradução, galeria, temas, configurações, importações e backups.

### Modo Conversation

Código principal:

- Cliente: `components/chat/ChatConversationSurface.tsx`, `ConversationView.tsx`, `ConversationMessage.tsx`, `ConversationInput.tsx` e as ligações de início rápido de conversation em `ChatArea.tsx`.
- Hooks do cliente: `use-autonomous-messaging.ts`, `use-background-autonomous.ts`.
- Servidor: `/api/conversation`, `services/conversation/*`.
- Metadados compartilhados: `conversationSchedulesEnabled`, `characterSchedules`, `scheduleWeekStart` e os resumos de dia e de semana.

Limite esperado:

- Conversation deve ser dono das agendas, das mensagens autônomas de acompanhamento, da atividade de conversation e da exibição de mensagens fora do roleplay.
- Conversation não deve saber nada sobre os dados do jogo, as tags do GM, os quick-time events (as ações com tempo limitado), os mapas do jogo ou o combate do jogo.

### Modo Roleplay

Código principal:

- Cliente: `components/chat/ChatRoleplaySurface.tsx`, `ChatMessage.tsx`, `ChatInput.tsx`, os componentes de `RoleplayHUD`, `SpriteOverlay.tsx`, `SceneBanner.tsx`, `CyoaChoices.tsx` e `EncounterModal.tsx`.
- Servidor: `/api/scene`, `/api/encounter`, `/api/sprites` e partes de `/api/generate`.
- Contratos compartilhados: `scene`, os campos de metadados de chat ligados ao roleplay e os tipos de posicionamento de sprite.

Limite esperado:

- Roleplay deve ser dono das cenas, da exibição de sprites, das escolhas CYOA, do HUD de roleplay e dos fluxos auxiliares de encontro do roleplay.
- Os efeitos visuais compartilhados que o Game Mode também usa devem sair da pasta `components/chat`.

### Game Mode

Código principal:

- Cliente: `components/game/*`, `hooks/use-game.ts`, `hooks/use-scene-analysis.ts`, `stores/game-mode.store.ts`, `stores/game-state.store.ts`, `stores/game-asset.store.ts`, `lib/game-*`, `lib/party-dialogue-parser.ts`.
- Servidor: `/api/game`, `/api/game-assets`, `services/game/*` e as partes de jogo dos arquivos `services/sidecar/scene-analyzer.ts` e `scene-postprocess.ts`.
- Contratos compartilhados: `types/game.ts`, `types/game-state.ts`, `types/combat-encounter.ts` e os campos de jogo em `ChatMetadata`.

Limite esperado:

- Game Mode deve ser dono dos prompts do GM, dos prompts da equipe, dos dados, dos testes de perícia, dos quick-time events, do combate do jogo, dos mapas, das viagens e dos descansos, do clima e do tempo, da reputação dos NPCs, dos resumos de sessão, dos assets gerados e dos logs do jogo.
- Game Mode não deve depender da interface dos modos de chat, a não ser por primitivos compartilhados ou por componentes de recurso marcados como compartilhados.

## Arquivos grandes de hoje

Estes arquivos são os que mais tendem a atrasar o trabalho futuro, porque juntam muitas responsabilidades no mesmo lugar. A contagem de linhas muda com frequência, então a lista traz uma ordem aproximada e a responsabilidade envolvida, não o tamanho exato.

| Arquivo | Seção | Responsabilidade |
| --- | --- | --- |
| `packages/server/src/routes/generate.routes.ts` | geração compartilhada e agentes | Rota, streaming, prompt, agentes, armazenamento e efeitos colaterais estão todos no mesmo arquivo. |
| `packages/server/src/routes/game.routes.ts` | `MODE-GAME` | Os handlers da API, o fluxo do GM, a análise de cena, os assets, o combate e a persistência estão acoplados. |
| `packages/client/src/components/game/GameSurface.tsx` | `MODE-GAME` | Renderização, orquestração de estado, assets, logs, narração, combate e efeitos estão acoplados. |
| `packages/client/src/components/chat/ChatSettingsDrawer.tsx` | configurações de chat misturadas | A extração das seções já começou na pasta `features/chat-settings`, mas o painel lateral continua grande. |
| `packages/client/src/components/game/GameNarration.tsx` | `MODE-GAME` | A renderização da exibição e a formatação dos comandos estão muito acopladas. |
| `packages/client/src/components/game/GameCombatUI.tsx` | `MODE-GAME` | A exibição do combate, os controles e os logs podem virar painéis e hooks menores. |
| `packages/client/src/components/chat/RoleplayHUD.tsx` | `MODE-ROLEPLAY` | A divisão já foi feita em parte com `RoleplayHUDActionsMenu.tsx` e `RoleplayHUDPanels.tsx`. |

## Estrutura desejada

Este é o rumo das próximas refatorações. Não é preciso mover tudo de uma vez.

### Alvo do cliente

```text
packages/client/src/
  app/                         # App bootstrap, shell integration, providers
  shared/
    components/                # UI primitives and mode-agnostic widgets
    hooks/                     # cross-feature client hooks
    lib/                       # browser/runtime helpers
    stores/                    # global client stores only
  features/
    agents/
    assets/
    gallery/
    sidecar/
    tts/
    translation/
  modules/
    conversation/
      components/
      hooks/
      lib/
    roleplay/
      components/
      hooks/
      lib/
    game/
      components/
      hooks/
      lib/
      stores/
```

### Alvo do servidor

```text
packages/server/src/
  app/                         # Fastify setup, route registration, middleware
  shared/
    db/
    storage/
    llm/
    prompt/
    lorebook/
    utils/
  features/
    agents/
    assets/
    haptic/
    image/
    import/
    sidecar/
    tts/
  modules/
    chat/
    conversation/
    roleplay/
      scene/
      encounter/
      sprites/
    game/
      routes/
      services/
      prompts/
```

### Alvo do pacote compartilhado

```text
packages/shared/src/
  contracts/
    chat/
    conversation/
    roleplay/
    game/
    providers/
  constants/
  utils/
```

O antigo layout plano com `types`, `schemas` e `constants` já não conta a história toda. A pasta `packages/shared/src/features/` hoje abriga agentes, chamadas de função, pacotes de pastas, jogos por turno, conjuntos de regras e combate, e o gerador de mundos. Mesmo assim, a primeira limpeza do pacote compartilhado deve ficar no nível de tipos e ser feita aos poucos, nunca como uma mudança em massa de arquivos.

## Regras de migração

1. Coloque o código novo na seção correta mais estreita.
2. Se dois ou mais modos usam um componente de cliente, mova-o para `CLIENT-SHARED` antes de acrescentar mais comportamento específico de um modo.
3. Se cliente e servidor precisam do mesmo tipo, schema ou função auxiliar pura, mova para `CORE-CONTRACT`.
4. Se só o servidor precisa, mantenha fora do pacote `packages/shared`.
5. Os arquivos de rota devem validar a entrada HTTP e chamar os serviços. As decisões de domínio ficam nos serviços.
6. Cada store deve ser global (`ui`, `chat`, `sidecar`) ou específico de um modo (`game-mode`, `encounter`). Evite que um store passe a cuidar de vários modos sem ninguém perceber.
7. Os metadados devem passar a ser discriminados por `ChatMode`: os metadados base mais os campos de conversation, de roleplay e de jogo.
8. Mova um recurso por vez. Deixe exports de compatibilidade ou wrappers quando um caminho de importação muito usado provocaria mudanças demais no repositório.
9. Depois de cada movimentação, rode o lint:

   ```bash
   pnpm lint
   ```

   Depois, rode uma verificação do Prettier apenas nos arquivos alterados.

## Primeiros candidatos a refatoração

Estas são boas primeiras rodadas de limpeza, porque reduzem o acoplamento sem mudar o comportamento.

1. Divida a pasta `components/chat` em três grupos: comum, conversation e roleplay.
   - Candidatos ao grupo comum: `ChatCommonOverlays`, `ChatBranchSelector`, `ChatGalleryDrawer`, `WeatherEffects` e os primitivos compartilhados de mensagem e de entrada.
   - Candidatos ao grupo conversation: `ChatConversationSurface`, `ConversationView`, `ConversationMessage`, `ConversationInput`.
   - Candidatos ao grupo roleplay: `ChatRoleplaySurface`, `SpriteOverlay`, `SceneBanner`, `CyoaChoices`, `EncounterModal`. A divisão do HUD de roleplay já está parcialmente feita em `RoleplayHUDActionsMenu.tsx` e `RoleplayHUDPanels.tsx`.
2. Mova para um módulo de jogo os auxiliares de cliente que só o Game Mode usa.
   - Candidatos: `game-audio`, `game-tag-parser`, `game-full-body-pose`, `game-character-name-match`, `game-segment-edits`, `party-dialogue-parser`.
3. Divida o arquivo `GameSurface.tsx` em hooks de execução e contêineres menores.
   - Hooks candidatos: execução da narração, dos assets, da análise de cena, do combate, dos logs e do histórico, e do áudio.
4. Divida o arquivo `GameNarration.tsx` em análise e formatação de comandos, de um lado, e componentes de exibição, de outro.
5. Divida o arquivo `game.routes.ts` por grupo de handler.
   - Grupos candidatos: configuração inicial e sessão; geração de turno; dados, perícia e quick-time events; diário e inventário; mapa, viagem e clima; combate; assets e análise de cena.
6. Divida o arquivo `generate.routes.ts` em transporte da geração, tratamento do pipeline de agentes, rotas de nova tentativa e auxiliares de comando e de pós-processamento. A issue #7573 começou isso: a cadeia de saída de tokens, as rodadas de ferramentas, os comandos da resposta, a limpeza do texto da resposta, as informações de geração da mensagem salva, a âncora de comando oculta e o salvamento da resposta agora ficam em `routes/generate/`, cada um com a própria regressão.
7. Divida `ChatMetadata` em contratos de metadados específicos de cada modo.
8. Tire da pasta `components/chat` os visuais compartilhados de roleplay e de jogo antes que o Game Mode importe ainda mais coisas internas do chat.

## Como começar na prática

No próximo PR de limpeza, siga esta ordem:

1. Crie as pastas de destino de uma área só.
2. Mova primeiro as funções auxiliares puras.
3. Depois mova os componentes folha.
4. Deixe o grande orquestrador onde está até que a maioria das importações dele aponte para o novo módulo.
5. Acrescente re-exports de compatibilidade só onde a troca de importações tiraria o foco da mudança de verdade.
6. Rode o lint:

   ```bash
   pnpm lint
   ```

   Depois, rode as verificações do Prettier apenas nos arquivos alterados.

## Guias relacionados

- [Arquitetura do frontend (desenvolvedores)](frontend.md)
- [Armazenamento nativo em arquivos](file-storage.md)
