# Arquitetura do frontend (desenvolvedores)

Este material é para quem desenvolve, não um guia de uso. Aqui você vê como o cliente do Marinara Engine é construído: a estrutura do aplicativo React, as stores Zustand, os hooks do React Query, os principais componentes e o mapa da API do servidor. Se a sua intenção é só usar o aplicativo, comece pelos guias de usuário.

## Visão geral

Marinara Engine é um aplicativo de chat com IA que tem os modos Conversation, Roleplay e Game. O cliente é um aplicativo React 19 de página única servido pelo Vite, estilizado com Tailwind CSS v4 e empacotado como Progressive Web App (PWA), ou seja, um site que se instala como aplicativo.

O cliente fica em `packages/client`. Ele conversa com um servidor de API Fastify (`packages/server`) por REST e Server-Sent Events (SSE). Os contratos de dados compartilhados (tipos, schemas Zod, constantes) ficam em `packages/shared` e são importados pelos dois lados.

## Arquitetura do aplicativo

### Layout de três colunas

A interface segue um desenho de três colunas inspirado no Discord, gerenciado por `components/layout/AppShell.tsx`:

```
+-------------+-----------------------------+--------------+
|  Left       |         Center              |  Right       |
|  Sidebar    |                             |  Panel       |
|             |  Chat area or Editor        |              |
|  Chat list  |  (lazy-loaded)              |  Characters  |
|  Folders    |                             |  Lorebooks   |
|  Mode tabs  |  ChatConversationSurface    |  Presets     |
|             |  ChatRoleplaySurface        |  Connections |
|             |  GameSurface                |  Agents      |
|             |  CharacterEditor            |  Personas    |
|             |  LorebookEditor             |  Settings    |
|             |  PresetEditor               |  Browser     |
|             |  ...other editors           |              |
+-------------+-----------------------------+--------------+
```

- Barra lateral esquerda (`components/layout/ChatSidebar.tsx`): a lista de chats, organizada em pastas e filtrável por modo (Conversation, Roleplay, Game).
- Painel central: a superfície do chat ativo ou um editor de tela cheia (personagem, lorebook, preset e assim por diante). Só um aparece de cada vez. Os editores substituem a área do chat.
- Painel direito (`components/layout/RightPanel.tsx`): um navegador de recursos e as configurações, aberto e fechado pela barra superior. Depois de montado, o painel permanece no DOM (escondido por CSS) para preservar a posição de rolagem e o estado local.
- Barra superior (`components/layout/TopBar.tsx`): botões de troca rápida para cada painel direito.

### Navegação

A navegação é guiada por estado. Não existe roteador de URL. A store Zustand `stores/ui.store.ts` controla o que é renderizado:

| Destino da navegação      | Campo da store       | Função que aciona                                 |
| ---------------------- | -------------------- | ------------------------------------------------- |
| Abrir o editor de personagem  | `characterDetailId`  | `openCharacterDetail(id)`                          |
| Abrir o editor de lorebook   | `lorebookDetailId`   | `openLorebookDetail(id)`                           |
| Abrir o editor de preset     | `presetDetailId`     | `openPresetDetail(id)`                             |
| Abrir o editor de conexão | `connectionDetailId` | `openConnectionDetail(id)`                         |
| Abrir o editor de agente      | `agentDetailId`      | `openAgentDetail(id)`                              |
| Abrir o editor de persona    | `personaDetailId`    | `openPersonaDetail(id)`                            |
| Trocar o painel direito     | `rightPanel`         | `openRightPanel(name)` / `toggleRightPanel(name)` |
| Abrir uma janela             | `modal`              | `openModal(type, props?)`                          |

### Divisão de código

Os editores principais e os componentes pesados são carregados sob demanda em `AppShell.tsx`, com `React.lazy()` e `Suspense`. Assim o pacote inicial fica pequeno (veja o orçamento de bundle mais adiante).

## Gerenciamento de estado

### Stores Zustand (estado do cliente)

O cliente usa um conjunto de stores Zustand em `packages/client/src/stores/` para o estado da interface e de execução. A `ui.store.ts` é a única store persistida. As outras guardam o estado de execução de chats, agentes, jogos, runtime de modelo local, tradução, janelas, backfill e jogos de mesa.

Os arquivos de store atuais são: `agent.store.ts`, `backfill.store.ts`, `chat.store.ts`, `chess-game.store.ts`, `dialog.store.ts`, `encounter.store.ts`, `gallery.store.ts`, `game-asset.store.ts`, `game-mode.store.ts`, `game-state.store.ts`, `poker-game.store.ts`, `sidecar.store.ts`, `translation.store.ts`, `ui.store.ts` e `uno-game.store.ts`.

#### `ui.store.ts`: configurações e elementos de interface

A única store persistida (em localStorage, pelo middleware `persist` do Zustand). Ela guarda:

- Tema: `visualTheme` ("default" ou "sillytavern"), o valor de `data-theme` (dark ou light) e as cores personalizadas.
- Aparência: `fontSize`, `chatFontSize`, `fontFamily`, fontes personalizadas e estilo do cursor.
- Exibição do chat: `boldDialogue`, `showTimestamps`, `showModelName` e `messagesPerPage`.
- Estilo do texto: cor do texto do chat, opacidade do fundo das mensagens de roleplay e contorno do texto.
- Streaming (o texto aparece conforme é escrito): `enableStreaming` e `streamingSpeed`.
- Tema do Conversation: cores de gradiente dos balões de mensagem.
- Som: `convoNotificationSound` e `rpNotificationSound`.
- Comportamento: `confirmBeforeDelete`, `enterToSendRP`, `enterToSendConvo`, `weatherEffects` e `guideGenerations`.
- Navegação: `rightPanel`, `rightPanelOpen`, `sidebarOpen`, `settingsTab`, todos os campos `*DetailId` e `modal`.

Os temas personalizados sincronizados não ficam em `ui.store.ts`. Marinara busca esses temas no servidor pelo React Query e os espelha entre os dispositivos ligados à mesma instância.

#### `chat.store.ts`: execução do chat

Não é persistida. Acompanha a sessão de chat ativa:

- `activeChatId`: qual chat está sendo exibido.
- `messages`: o array de mensagens atual.
- `isStreaming`, `streamBuffer`: geração em andamento.
- `inputDrafts`: rascunhos de mensagem por chat.
- `currentInput`: o valor atual do campo de entrada do chat.
- `perChatTyping`: estado do indicador de digitação.
- `unreadCounts`, `chatNotifications`: selos de notificação.
- `abortControllers`: cancelam as gerações em andamento.

#### `agent.store.ts`: execução dos agentes

Acompanha o estado do pipeline de agentes durante e depois da geração:

- `activeAgents`: agentes em execução no momento.
- `thoughtBubbles`: o raciocínio do agente, exibido em tempo real.
- `echoMessages`: a câmara de eco (chat simulado de espectadores).
- `cyoaChoices`: a interface de escolhas ramificadas.
- `debugLog`: métricas de desempenho e uso de tokens (um token é um pedacinho de texto).
- `failedAgentTypes`: agentes que deram erro (para a interface de nova tentativa).

#### `game-state.store.ts`: companheiro de RPG

Guarda o contexto de cena e de mundo do Roleplay Mode:

- `current` (GameState): data, hora, local, clima, personagens presentes, eventos, atributos do jogador, missões e inventário.
- `isVisible`, `expandedSections`: estado de exibição do HUD (a faixa de informações no topo do chat).

#### `encounter.store.ts`: sistema de combate

Estado do combate por turnos:

- `active`: indica se há um encontro em andamento.
- `party`, `enemies`: combatentes com HP, ataques e status.
- `environment`: detalhes da arena.
- `playerActions`, `encounterLog`: a fila de ações e o histórico.
- `combatResult`: vitória, derrota, fuga ou interrupção.

#### `gallery.store.ts`: sobreposições de imagem

- `pinnedImages`: imagens fixadas na área do chat como sobreposição.

### React Query (dados do servidor)

Todo dado do servidor passa pelo TanStack React Query, configurado em `main.tsx`:

- Tempo de validade: 30 segundos (padrão global).
- Nova tentativa: 1 tentativa.
- Nova busca ao focar a janela: desativada.
- Cache: só em memória, sem persistência.

Cada entidade tem um arquivo de hooks próprio, que exporta os hooks de consulta e de mutação.

## Referência de hooks

Todos os hooks ficam em `src/hooks/` e seguem o padrão `use-{entity}.ts`.

### Hooks de chat (`use-chats.ts`)

| Hook                               | Tipo           | Descrição                                  |
| ---------------------------------- | -------------- | -------------------------------------------- |
| `useChats()`                       | Query          | Todos os chats                                    |
| `useChat(id)`                      | Query          | Um chat pelo ID                            |
| `useChatMessages(chatId, perPage)` | Infinite Query | Mensagens paginadas de um chat                |
| `useChatGroup(groupId)`            | Query          | Grupo de chats                                   |
| `useCreateChat()`                  | Mutation       | Cria um chat                            |
| `useDeleteChat()`                  | Mutation       | Exclui um chat                            |
| `useUpdateChatMetadata()`          | Mutation       | Atualiza os metadados do chat (agentes, sprites e mais) |
| `useBranchChat()`                  | Mutation       | Cria uma ramificação do chat a partir de uma mensagem        |
| `useUpdateMessage()`               | Mutation       | Edita o conteúdo da mensagem (atualização otimista)     |
| `useDeleteMessage()`               | Mutation       | Exclui uma mensagem                 |
| `useDeleteMessages()`              | Mutation       | Exclui várias mensagens                    |
| `useSetActiveSwipe()`              | Mutation       | Troca para outro swipe da geração       |
| `usePeekPrompt()`                  | Mutation       | Prévia do prompt montado                    |
| `useClearAllData()`                | Mutation       | Exclui tudo (ação destrutiva)              |

### Hooks de personagem (`use-characters.ts`)

| Hook                   | Tipo     | Descrição                            |
| ---------------------- | -------- | -------------------------------------- |
| `useCharacters()`      | Query    | Todos os personagens                         |
| `useCharacter(id)`     | Query    | Um personagem com os dados do card já interpretados |
| `useCreateCharacter()` | Mutation | Cria um personagem                       |
| `useUpdateCharacter()` | Mutation | Atualiza os dados do card de personagem            |
| `useDeleteCharacter()` | Mutation | Exclui um personagem                       |
| `useUploadAvatar()`    | Mutation | Faz upload da imagem de avatar                    |
| `usePersonas()`        | Query    | Todas as personas                         |
| `usePersona(id)`       | Query    | Uma persona                         |
| `useCreatePersona()`   | Mutation | Cria uma persona                       |
| `useUpdatePersona()`   | Mutation | Atualiza uma persona                       |
| `useDeletePersona()`   | Mutation | Exclui uma persona                       |
| `useCharacterGroups()` | Query    | Grupos de personagens                       |
| `usePersonaGroups()`   | Query    | Grupos de personas                         |

### Hooks de preset (`use-presets.ts`)

| Hook                           | Tipo     | Descrição                                                 |
| ------------------------------ | -------- | ---------------------------------------------------------- |
| `usePresets()`                 | Query    | Todos os presets                                                |
| `usePreset(id)`                | Query    | Um preset                                              |
| `usePresetFull(id)`            | Query    | Preset com seções, grupos e escolhas                  |
| `useDefaultPreset()`           | Query    | O preset padrão                                         |
| `useCreatePreset()`            | Mutation | Cria um preset                                              |
| `useUpdatePreset()`            | Mutation | Atualiza um preset                                              |
| `useDeletePreset()`            | Mutation | Exclui um preset                                              |
| `usePresetSections(presetId)`  | Query    | Seções de prompt de um preset                               |
| `usePresetGroups(presetId)`    | Query    | Grupos de seções                                           |
| `usePresetVariables(presetId)` | Query    | Variáveis do preset (antes chamadas de blocos de escolha)                  |
| `usePreviewPreset()`           | Mutation | Prévia do prompt renderizado para `{ presetId, chatId, choices }` |

### Hooks de agente (`use-agents.ts`)

| Hook                 | Tipo     | Descrição                     |
| -------------------- | -------- | ------------------------------- |
| `useAgentConfigs()`  | Query    | Todas as configurações de agente        |
| `useAgentConfig(id)` | Query    | A configuração de um agente             |
| `useCreateAgent()`   | Mutation | Cria um agente personalizado             |
| `useUpdateAgent()`   | Mutation | Atualiza a configuração de um agente               |
| `useDeleteAgent()`   | Mutation | Exclui um agente                    |
| `useToggleAgent()`   | Mutation | Ativa ou desativa um agente nativo |

### Hook de geração (`use-generate.ts`)

O hook mais complexo. Ele devolve `{ generate, retryAgents }`.

A função `generate(params)` recebe um único objeto de opções, com campos como `chatId`, `connectionId`, `userMessage`, `regenerateMessageId`, `continueMessageId`, `impersonate` e `attachments`. Ela devolve `false` quando já existe uma geração em andamento naquele chat. O fluxo é este:

1. Definir o estado de streaming em `chat.store.ts`.
2. Enviar a requisição de geração para `/api/generate`.
3. Interpretar eventos SSE como `token`, `agent_start`, `agent_result`, `agent_error`, `thinking`, `tool_call`, `game_state`, `game_state_patch`, `text_rewrite`, `scene_created`, `done` e `error`.
4. Atualizar o cache do React Query com as novas mensagens.
5. Preencher a store de agentes com as bolhas de pensamento e as informações de depuração.
6. Tratar os erros com notificações do tipo toast.

### Outros hooks

A pasta `src/hooks/` também tem muitos hooks específicos de cada recurso. Uma amostra representativa:

| Arquivo                           | Finalidade                                   |
| ------------------------------ | ----------------------------------------- |
| `use-connections.ts`           | CRUD de conexões de API, mais o teste             |
| `use-lorebooks.ts`             | CRUD de lorebooks e entradas                    |
| `use-scene.ts`                 | Planejamento, criação e conclusão de cena       |
| `use-encounter.ts`             | Início, ação e resumo de encontros de combate     |
| `use-autonomous-messaging.ts`  | Verificação e agendamento de mensagens autônomas  |
| `use-idle-detection.ts`        | Detector de 10 minutos de inatividade  |
| `use-background-autonomous.ts` | Verificação em segundo plano para chats inativos      |
| `use-translate.ts`             | Tradução de texto                          |
| `use-apply-regex.ts`           | Execução de scripts de regex nas mensagens         |
| `use-custom-tools.ts`          | CRUD de ferramentas personalizadas                           |
| `use-knowledge-sources.ts`     | Gerenciamento das fontes de conhecimento                |
| `use-gallery.ts`               | Imagens da galeria do chat                           |
| `use-chat-folders.ts`          | CRUD de pastas de chat, mais a reordenação                |
| `use-regex-scripts.ts`         | CRUD de scripts de regex                           |
| `use-haptic.ts`                | Conexão e comandos de dispositivos hápticos      |

## Guia de componentes

### Sistema de chat (`components/chat/`)

O sistema de chat é a maior área de recursos. O arquivo `ChatArea.tsx` carrega sob demanda três superfícies de renderização: Conversation, Roleplay e Game Mode.

#### Modo Conversation (`ChatConversationSurface.tsx`)

Balões de chat no estilo mensageiro. As mensagens do usuário ficam à direita e as do assistente à esquerda. Recursos:

- Paginação com rolagem infinita (as mensagens antigas carregam quando você rola para cima).
- Ações por mensagem: editar, copiar, regenerar, excluir, criar ramificação, espiar o prompt.
- Suporte a anexos (imagens e arquivos).
- Seletores de emoji e de GIF.
- Comandos de barra.
- Sons de notificação em mensagens novas.
- Rascunhos preservados por chat.

#### Modo Roleplay (`ChatRoleplaySurface.tsx`)

Uma interface escura e imersiva, com tema de RPG. Tem tudo o que o Conversation tem, e ainda:

- Sprites de personagem (a imagem do personagem no palco) com troca de expressão comandada pelo agente de expressão.
- O HUD do Roleplay, que mostra o estado do jogo (hora, local, clima, personagens presentes).
- Efeitos de clima (sobreposições de partículas combinando com o clima da cena).
- O painel da câmara de eco (reações simuladas de espectadores).
- Encontros de combate com um sistema de ações por turnos.
- Um painel de World Info com as entradas de lorebook ativas.
- Um sistema de cenas para mini-roleplays ramificados.
- Imagens de plano de fundo com transição em crossfade.

#### Game Mode (`GameSurface.tsx`)

A superfície do Game Master (o mestre do jogo) por IA. Ela fica fora da pasta do chat, em `components/game/GameSurface.tsx`. O arquivo `ChatArea.tsx` a renderiza quando o modo do chat é `game`. Ela lê as stores dedicadas ao jogo (`game-mode.store.ts`, `game-asset.store.ts`, `game-state.store.ts`) e comanda sessões, rolagens de dados, testes de perícia, mapas e storyboards de turno pelos hooks de `use-game.ts` e `use-game-storyboards.ts`.

#### Componentes principais

- `ChatArea.tsx`: o orquestrador central. Busca todos os dados (mensagens, personagens, personas), monta o mapa de personagens, determina o modo do chat e renderiza a superfície certa.
- `ChatMessage.tsx`: renderiza uma mensagem com markdown, navegação entre swipes (respostas alternativas), edição e menus de ação. Usa o subcomponente não controlado `EditTextarea` para evitar re-renderizações durante a edição.
- `ChatInput.tsx`: a entrada do usuário, com redimensionamento automático, rascunhos preservados, autocompletar de comandos de barra, tratamento de anexos e inserção de emoji ou GIF.

### Componentes de editor

Cada tipo de recurso tem um editor de tela cheia que substitui a área do chat:

| Editor            | Arquivo                                          | O que gerencia                                                                         |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Editor de personagem  | `components/characters/CharacterEditor.tsx`   | Campos do card de personagem, avatar, saudação inicial, personalidade, prompt de sistema, metadados   |
| Editor de lorebook   | `components/lorebooks/LorebookEditor.tsx`     | Metadados do lorebook e entradas com chaves, regras de ativação, configurações de inserção   |
| Editor de preset     | `components/presets/PresetEditor.tsx`         | Seções de prompt, grupos, marcadores, parâmetros de geração, blocos de escolha          |
| Editor de conexão | `components/connections/ConnectionEditor.tsx` | Provedor de API, URL base, modelo, janela de contexto, flags                            |
| Editor de agente      | `components/agents/AgentEditor.tsx`           | Modelo de prompt do agente, fase, conexão, ferramentas, configurações                       |
| Editor de persona    | `components/personas/PersonaEditor.tsx`       | A persona do usuário, com nome, descrição, atributos e avatar                              |

### Sistema de janelas (`components/modals/`)

As janelas são renderizadas por `components/layout/ModalRenderer.tsx`. Ele lê `ui.store.modal` e renderiza o componente correspondente dentro de `Suspense`. Os componentes de janela ficam em `components/modals/`.

Os tipos de janela atuais incluem (a lista é ilustrativa, não completa):

| Tipo                       | Componente                     | Finalidade                                    |
| -------------------------- | ----------------------------- | ------------------------------------------ |
| `create-character`         | `CreateCharacterModal`        | Criação rápida de personagem (nome e avatar) |
| `create-connection`        | `CreateConnectionModal`       | Criação rápida de conexão                   |
| `create-persona`           | `CreatePersonaModal`          | Criação rápida de persona                      |
| `create-lorebook`          | `CreateLorebookModal`         | Criação rápida de lorebook                     |
| `create-preset`            | `CreatePresetModal`           | Criação rápida de preset                       |
| `import-character`         | `ImportCharacterModal`        | Importação a partir de arquivo (JSON ou PNG)             |
| `import-connection`        | `ImportConnectionModal`       | Importação de um pacote de conexão              |
| `import-lorebook`          | `ImportLorebookModal`         | Importação a partir de arquivo                            |
| `import-preset`            | `ImportPresetModal`           | Importação a partir de arquivo                            |
| `import-persona`           | `ImportPersonaModal`          | Importação a partir de arquivo                            |
| `character-card-update`    | `CharacterCardUpdateModal`    | Revisão da evolução de card proposta pelo agente       |
| `agent-write-approval`     | `AgentWriteApprovalModal`     | Consentimento e revisão de escrita do agente            |
| `docs-viewer`              | `DocsViewerModal`             | Navegador de documentação dentro do aplicativo              |
| `st-bulk-import`           | `STBulkImportModal`           | Importação em massa de dados do SillyTavern           |
| `about-me-viewer`          | `AboutMeViewerModal`          | Visualização de um About Me do Conversation Mode          |
| `scene-prompt-preferences` | `ScenePromptPreferencesModal` | Preferências de prompt de cena          |

Padrão das janelas: todas aceitam `{ open, onClose }`, envolvem o conteúdo no componente base `Modal`, usam mutações para as chamadas de API e mostram o estado de carregamento a partir de `mutation.isPending`.

### Sistema de painéis (`components/panels/`)

Os painéis do lado direito mostram listas de recursos com busca, ordenação e filtros. Ao clicar em um recurso, o editor completo dele abre no painel central.

Os painéis são registrados em `RightPanel.tsx`, em dois lugares:

1. `PANEL_CONFIG`: título, ícone e cor do gradiente.
2. `PANELS`: o mapa de componentes.

Os painéis usam persistência em nível de módulo. Um Set chamado `mountedPanels` registra quais painéis já foram visitados. Depois de montado, o painel permanece no DOM (escondido com `display: none` ou `aria-hidden`) para preservar o estado.

### Primitivos de interface (`components/ui/`)

| Componente          | Descrição                                                            |
| ------------------ | --------------------------------------------------------------------- |
| `Modal`            | Janela base, com clique no fundo, tecla Esc e animações de entrada e saída |
| `ColorPicker`      | Seletor de cor sólida ou gradiente, com amostras prontas                   |
| `ExpandedTextarea` | Sobreposição em portal e tela cheia para editar blocos grandes de texto              |
| `EmojiPicker`      | Popover de emojis com busca (renderizado em portal)                            |
| `GifPicker`        | Busca de GIFs pela API do Giphy                                          |
| `HelpTooltip`      | Ícone que, ao passar o mouse, mostra uma dica posicionada em portal                     |

Todos os componentes de interface usam props controladas (value mais onChange) e renderização em portal para as sobreposições.

## Cliente de API (`lib/api-client.ts`)

Toda a comunicação com o servidor passa pelo objeto `api`:

```typescript
import { api, ApiError } from "@/lib/api-client";
```

| Método                         | Assinatura           | Descrição                           |
| ------------------------------ | ------------------- | ------------------------------------- |
| `api.get<T>(path)`             | `GET /api{path}`    | Busca JSON                            |
| `api.post<T>(path, body)`      | `POST /api{path}`   | Envia JSON e recebe JSON               |
| `api.put<T>(path, body)`       | `PUT /api{path}`    | Atualização completa                            |
| `api.patch<T>(path, body)`     | `PATCH /api{path}`  | Atualização parcial                        |
| `api.delete(path)`             | `DELETE /api{path}` | Exclui um recurso                       |
| `api.upload(path, FormData)`   | `POST /api{path}`   | Upload de arquivo multipart                 |
| `api.download(path, filename)` | `GET /api{path}`    | Download com janela de salvar como          |
| `api.stream(path, body)`       | `POST /api{path}`   | Gerador assíncrono de SSE (só tokens)     |
| `api.streamEvents(path, body)` | `POST /api{path}`   | Gerador assíncrono de SSE (todos os tipos de evento) |

Os erros lançam `ApiError`, que carrega as propriedades `status` e `message`.

## Sistema de estilos

### Tailwind CSS v4

O projeto usa Tailwind CSS v4 com o plugin `@tailwindcss/vite` (sem precisar de configuração de PostCSS). Os tokens de tema vêm das propriedades CSS personalizadas de `globals.css`:

```css
@theme {
  --color-primary: var(--primary);
  --color-background: var(--background);
  --color-border: var(--border);
  /* ... */
}
```

### Arquitetura de temas

O arquivo `globals.css` está dividido em seções nomeadas. Entre elas estão o mapeamento `@theme` do Tailwind, as variáveis do tema escuro, os ajustes do tema claro, o reset base, os cursores personalizados, as barras de rolagem, os painéis de vidro, os utilitários de brilho, os componentes de interface e as animações de keyframe. Outras seções cuidam das animações do chat, do estilo de chat por modo, dos sprites e do HUD de jogo, dos cards de chamada de função, das regras responsivas, do tema importado do SillyTavern, das regras de acessibilidade e das dicas de desempenho.

### Temas personalizados

Os usuários podem criar temas próprios. As definições de tema ficam no servidor Marinara e sincronizam entre os dispositivos conectados. O tema personalizado ativo também é compartilhado. O componente `CustomThemeInjector.tsx` insere o CSS em uma tag `style`.

O CSS de um tema sincronizado pode pedir o motor nativo Accent Pulse com `--marinara-theme-accent-pulse: enabled`. Acrescente `--marinara-theme-accent-pulse-source: #a78bfa` (ou um gradiente) quando o pulso precisar usar uma cor de destaque específica do tema em vez da cor de destaque atual de Appearance.

### Personal Extensions

As Personal Extensions são código em sandbox, guardado no servidor e aprovado por hash exato. A interface de Addons usa `use-personal-extensions.ts`; `PersonalExtensionInjector.tsx` hospeda o código de Browser aprovado em um Worker dedicado, dentro de um iframe em sandbox de origem opaca, e intermedeia instantâneos imutáveis do contexto do chat ativo. Os campos de contexto estão sempre presentes; fora de um chat ativo, `chatId` e `characterId` ficam como `null` e `characterIds` fica vazio. Os campos limitados do card de personagem ativo e da persona selecionada exigem permissões declaradas separadamente e vinculadas ao hash. As extensões de servidor rodam em um processo Node separado, dentro do Seatbelt do macOS ou do Bubblewrap do Linux, e falham de forma fechada quando nenhum dos dois está disponível. Fontes externas exigem a liberação pelo arquivo `.env` e a ativação em Danger Zone nas fronteiras de listagem, aprovação e execução.

Leia [Arquitetura das Personal Extensions](personal-extensions.md) antes de mexer nesse recurso.

## Pacote compartilhado (`packages/shared`)

O frontend importa tipos, schemas e constantes de `@marinara-engine/shared`.

### Constantes

Arquivos importantes em `packages/shared/src/constants/`:

- `defaults.ts`: exporta itens como `APP_VERSION`, `PROFESSOR_MARI_ID`, `DEFAULT_CONNECTION_ID`, `DEFAULT_GENERATION_PARAMS`, `MAX_FILE_SIZES` e `LIMITS`. É a fonte da versão e guarda as configurações de geração padrão.
- `providers.ts`: exporta `PROVIDERS`, as configurações dos provedores de API (OpenAI, Anthropic, Google e outros) com URLs e autenticação.
- `model-lists.ts`: catálogos estáticos de modelos por provedor, mais `IMAGE_GENERATION_SOURCES` para os provedores de geração de imagens.
- `agent-prompts.ts`: prompts de resumo e de secret plot só do pacote base, mais a busca em tempo de execução dos prompts fornecidos pelos pacotes de agente instalados.

### Schemas (Zod)

Toda validação de entrada usa schemas Zod de `packages/shared/src/schemas/`. Arquivos representativos:

| Arquivo de schema             | Entidades                                                           |
| ----------------------- | ------------------------------------------------------------------ |
| `agent.schema.ts`       | Criação e atualização de AgentConfig, fases do agente, tipos de resultado          |
| `character.schema.ts`   | Cards de personagem, metadados de compatibilidade, character books, grupos   |
| `chat.schema.ts`        | Criação de chat, criação de mensagem, requisição de geração                   |
| `connection.schema.ts`  | Criação e atualização de conexões de API                                   |
| `custom-tool.schema.ts` | Definições de ferramentas personalizadas                                            |
| `lorebook.schema.ts`    | Criação e atualização de lorebook e entradas, condições de ativação, agendas |
| `prompt.schema.ts`      | Preset, seção, grupo, bloco de escolha, parâmetros de geração          |
| `regex.schema.ts`       | Criação e atualização de scripts de regex                                   |
| `personal-extension.schema.ts` | Rascunhos de Personal Extension, aprovação por hash exato, reversão e armazenamento privado |

A pasta também guarda os schemas das configurações do aplicativo, dos perfis de configurações de chat, das chamadas do Conversation, dos emojis e stickers personalizados, do Noodle e dos temas.

### Tipos

As definições de tipo das entidades ficam em `packages/shared/src/types/`. Uma amostra dos arquivos principais:

| Arquivo de tipos             | Interfaces principais                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `agent.ts`            | `AgentConfig`, `AgentResult`, `AgentContext`, `ToolDefinition`, `ToolCall`, `ToolResult`, `BUILT_IN_AGENTS` |
| `character.ts`        | `Character`, `CharacterCardV2`, `CharacterData`, `RPGStatsConfig`                                           |
| `chat.ts`             | `Chat`, `ChatMetadata`, `Message`, `MessageExtra`, `GenerationInfo`, `StreamEvent`                          |
| `connection.ts`       | `APIConnection`, `ModelInfo`, `ModelCapabilities`, `ConnectionTestResult`                                   |
| `combat-encounter.ts` | `CombatPartyMember`, `CombatEnemy`, `CombatActionResult`, `EncounterSettings`                               |
| `game-state.ts`       | `GameState`, `PresentCharacter`, `PlayerStats`, `QuestProgress`, `InventoryItem`                            |
| `lorebook.ts`         | `Lorebook`, `LorebookEntry`, `ActivationCondition`, `LorebookSchedule`, `QuestData`                         |
| `persona.ts`          | `Persona`, `PersonaStatsConfig`                                                                             |
| `personal-extension.ts` | `PersonalExtension`, metadados de execução, revisões, origem e estado de execução no servidor                         |
| `prompt.ts`           | `PromptPreset`, `PromptSection`, `PromptGroup`, `ChoiceBlock`, `GenerationParameters`                       |
| `scene.ts`            | `SceneMeta`, `SceneFullPlan`                                                                                |
| `haptic.ts`           | `HapticDevice`, `HapticStatus`, `HapticDeviceCommand`                                                       |

### Utilitários

| Arquivo              | Finalidade                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `macro-engine.ts` | `resolveMacros(template, context)`: substitui macros como `{{date}}`, `{{char}}`, `{{random}}`, `{{roll:2d6}}` e `{{getvar::name}}`     |
| `xml-wrapper.ts`  | `nameToXmlTag()`: converte um nome de exibição em um slug de marcação XML ("World Info (Before)" vira "world_info_before")                     |

## Endpoints da API

O servidor (`packages/server`) expõe APIs REST sob `/api`. Este é um mapa geral, não a lista completa. A fonte da verdade é o arquivo `packages/server/src/routes/index.ts` junto com os arquivos de rota individuais.

### Recursos principais

| Prefixo               | Métodos                  | Descrição                                                                                |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `/api/characters`    | GET, POST, PATCH, DELETE | CRUD de personagens, grupos, exportação (JSON ou PNG)                                               |
| `/api/chats`         | GET, POST, PATCH, DELETE | CRUD de chats, mensagens, metadados, conectar e desconectar                                     |
| `/api/prompts`       | GET, POST, PATCH, DELETE | CRUD de presets, seções, grupos, blocos de escolha, exportação                                      |
| `/api/connections`   | GET, POST, PATCH, DELETE | CRUD de conexões de API, duplicar, testar                                                      |
| `/api/agents`        | GET, POST, PATCH, DELETE | CRUD de agentes, mensagens de eco, execuções; os agentes nativos são ativados por `PUT /api/agents/toggle/:agentType` |
| `/api/lorebooks`     | GET, POST, PATCH, DELETE | CRUD de lorebooks, entradas, exportação                                                            |
| `/api/custom-tools`  | GET, POST, PATCH, DELETE | CRUD de ferramentas personalizadas                                                                          |
| `/api/regex-scripts` | GET, POST, PATCH, DELETE | CRUD de scripts de regex                                                                          |

As ferramentas de memória dos agentes usam `/api/agents/memory/:agentType/:chatId`, onde `agentType` é a string do tipo do agente e `chatId` é o id do chat de destino.

### Geração

| Endpoint                     | Método | Descrição                                          |
| ---------------------------- | ------ | ---------------------------------------------------- |
| `/api/generate`              | POST   | Geração principal por SSE, com o pipeline de agentes          |
| `/api/generate/retry-agents` | POST   | Nova tentativa por SSE para os tipos de agente informados por quem chama |

### Recursos do chat

| Prefixo                    | Endpoints                        | Descrição                  |
| ------------------------- | -------------------------------- | ---------------------------- |
| `/api/chat-folders`       | CRUD e reordenação                | Gerenciamento das pastas de chat       |
| `/api/conversation`       | schedule, status, message, check | Sistema de mensagens autônomas  |
| `/api/scene`              | create, plan, conclude           | Ramificação de cenas             |
| `/api/encounter`          | init, action, summary            | Encontros de combate            |
| `/api/translate`          | POST                             | Tradução de texto             |
| `/api/game`               | CRUD e ações                 | Sessões e estado do Game Mode |
| `/api/game-assets`        | CRUD e upload                 | Recursos de jogo                  |
| `/api/turn-games`         | Rotas de Chess, UNO e Poker         | Jogos de mesa do Conversation     |
| `/api/conversation-calls` | Rotas de chamada e de sessão           | Chamadas de áudio do Conversation      |

### Mídia e recursos

| Prefixo                        | Descrição                  |
| ----------------------------- | ---------------------------- |
| `/api/avatars/file/:filename` | Entrega das imagens de avatar         |
| `/api/backgrounds`            | CRUD de planos de fundo, mais o upload  |
| `/api/sprites/:characterId`   | Gerenciamento das expressões dos sprites |
| `/api/fonts`                  | Gerenciamento de fontes personalizadas       |
| `/api/gallery/:chatId`        | Imagens da galeria de cada chat      |
| `/api/global-gallery`         | Imagens da galeria global        |
| `/api/tts`                    | Rotas de Text to Speech (conversão de texto em voz)        |
| `/api/youtube`                | Rotas do YouTube DJ           |
| `/api/custom-emojis`          | Recursos de emojis personalizados          |
| `/api/custom-stickers`        | Recursos de stickers personalizados        |
| `/api/gifs/search`            | Busca de GIFs (proxy do Giphy)     |

### Integrações externas

| Prefixo                          | Descrição                  |
| ------------------------------- | ---------------------------- |
| `/api/bot-browser/chub/*`       | Busca de personagens no Chub        |
| `/api/bot-browser/chartavern/*` | Busca no CharacterTavern           |
| `/api/bot-browser/janny/*`      | Busca no JannyAI                  |
| `/api/bot-browser/pygmalion/*`  | Busca no Pygmalion               |
| `/api/bot-browser/wyvern/*`     | Busca no Wyvern                  |
| `/api/bot-browser/datacat/*`    | Busca no DataCat                 |
| `/api/haptic/*`                 | Controle de dispositivos hápticos        |
| `/api/spotify/*`                | Autenticação do Spotify                 |
| `/api/knowledge-sources`        | Base de conhecimento para recuperação |

### Sistema

| Endpoint                        | Descrição                             |
| ------------------------------- | --------------------------------------- |
| `/api/updates/check`            | Verificação de versão nos releases do GitHub   |
| `/api/updates/latest`           | Metadados do último release              |
| `/api/updates/commits-behind`   | Distância de atualização de instalações via Git         |
| `/api/backup`                   | Backup completo, exportação e importação             |
| `/api/import/*`                 | Importação de perfis do SillyTavern e do Marinara |
| `/api/admin/clear-all`          | Limpeza total dos dados                     |
| `/api/themes`                   | Temas personalizados sincronizados                  |
| `/api/personal-extensions`      | Política, rascunhos, aprovação, execução e armazenamento privado das extensões em sandbox |
| `/api/app-settings`             | Configurações do aplicativo no servidor                |
| `/api/sidecar`                  | Runtime de modelo local                     |
| `/api/chat-presets`             | Perfis de configurações de chat (nome de endpoint legado) |
| `/api/connection-folders`       | Pastas de conexões                      |
| `/api/prompt-overrides`         | Sobrescritas dos prompts nativos               |
| `/api/achievements`             | Desbloqueio de conquistas                     |
| `/api/noodle`                   | Linha do tempo social do Noodle                  |
| `/api/professor-mari/workspace` | Operações do espaço de trabalho da Professor Mari     |

## Suporte a PWA

O aplicativo é um Progressive Web App configurado com o VitePWA:

- Manifest: `public/manifest.json`, com o nome de aplicativo "Marinara Engine", modo de exibição standalone e tema escuro.
- Ícones: um favicon de 64px, ícones maskable de 192px e 512px e um logo de splash.
- Service worker: Workbox com estratégia de atualização automática.
- Cache: os recursos estáticos ficam em cache; as rotas `/api/*` usam NetworkOnly.
- Keep-alive: `lib/keep-alive.ts` usa a Web Locks API mais pings por BroadcastChannel para a aba não hibernar.

### Detecção de divergência de versão

O arquivo `App.tsx` consulta `/api/health` a cada 5 minutos. Se a versão do servidor for diferente da versão em cache no cliente, o cliente cancela o registro do service worker. Ele também limpa os caches para forçar a atualização.

## Sistema de agentes

O sistema de agentes processa as respostas da IA por pipelines configuráveis. Os agentes rodam em três fases:

1. Pré-geração: antes da chamada principal ao LLM (por exemplo, inserção de contexto ou recuperação de conhecimento).
2. Paralela: junto com a geração principal (por exemplo, acompanhamento do estado do mundo ou combate).
3. Pós-processamento: depois da resposta principal (por exemplo, reescrita da prosa ou atualização de lorebooks).

As novas tentativas passam por `/api/generate/retry-agents` com uma lista explícita em `agentTypes`. Uma ação ampla da interface, como o botão **Re-run Trackers** (rodar os trackers de novo), envia todos os tipos de tracker ativos. Um controle de widget individual envia só o tracker que ele acompanha.

As ferramentas de memória dos agentes, como o painel Secret Plot do Narrative Director, usam `/api/agents/memory/:agentType/:chatId`. A rota vale para os agentes configurados que guardam memória por chat. A memória de Secret Plot fica sob `director` nas configurações atuais, e `secret-plot-driver` continua aceito para os chats antigos.

### Agentes oficiais para download

A Engine, na versão leve, vem com o registro de agentes em tempo de execução vazio. Os pacotes instalados a partir do catálogo público [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) acrescentam manifestos de agente validados, pontos de entrada de recursos de cliente e servidor e slots de interface em tempo de execução. As definições ativas continuam expostas em `BUILT_IN_AGENTS` por compatibilidade, mas vêm dos pacotes instalados, e não de implementações embutidas. O catálogo oficial tem estes pacotes:

| Agente                    | Fase           | O que faz                                                      |
| ------------------------ | --------------- | ----------------------------------------------------------------- |
| `prose-guardian`         | post_processing | Cuida da qualidade da escrita (evita repetição, mostra em vez de contar)       |
| `continuity`             | post_processing | Detecta problemas de continuidade e pode gerar orientações de reescrita        |
| `director`               | pre_generation  | Insere direções narrativas e, opcionalmente, o estado do Secret Plot       |
| `echo-chamber`           | parallel        | Simula as reações da plateia                                      |
| `world-state`            | post_processing | Extrai data, hora, local e clima a partir da narrativa     |
| `expression`             | post_processing | Escolhe as expressões dos sprites dos personagens                                |
| `quest`                  | post_processing | Acompanha a criação, a atualização e a conclusão de missões                    |
| `background`             | post_processing | Escolhe imagens de plano de fundo adequadas                                |
| `character-tracker`      | post_processing | Acompanha as mudanças de estado dos personagens                                    |
| `persona-stats`          | post_processing | Acompanha as mudanças de atributos da persona do jogador                                |
| `custom-tracker`         | post_processing | Acompanha o estado estruturado definido pelo usuário                                |
| `inventory-tracker`      | post_processing | Acompanha moedas, equipamentos em uso e itens carregados                            |
| `illustrator`            | post_processing | Gera prompts de imagem de cena e pedidos de mídia                  |
| `lorebook-keeper`        | post_processing | Cria e atualiza entradas de lorebook automaticamente                    |
| `card-evolution-auditor` | post_processing | Audita os cards de personagem e sugere evoluções                    |
| `combat`                 | parallel        | Acompanha os turnos de combate, o HP, a iniciativa e os resultados                |
| `html`                   | post_processing | Reescreve as respostas prontas do Roleplay para acrescentar recursos visuais em HTML dentro da ficção |
| `spotify`                | post_processing | Controla a reprodução do Music DJ (Spotify, YouTube ou música local)         |
| `knowledge-retrieval`    | pre_generation  | Recupera contexto das fontes de conhecimento                                  |
| `knowledge-router`       | pre_generation  | Encaminha as entradas de lorebook e de conhecimento relevantes                       |
| `haptic`                 | post_processing | Envia comandos para dispositivos hápticos                                 |
| `cyoa`                   | post_processing | Gera prompts de escolha                                          |
| `conversation-calls`     | feature         | Acrescenta chamadas de áudio e vídeo ao Conversation, além das configurações relacionadas          |
| `hierarchical-maps`      | feature         | Acrescenta mapas, contexto espacial e movimentação ao Roleplay e ao Game Mode             |
| `uno`                    | feature         | Acrescenta a mesa de UNO ao Conversation                                |
| `chess`                  | feature         | Acrescenta o tabuleiro de Chess ao Conversation                             |
| `poker`                  | feature         | Acrescenta a mesa de Texas Hold'em ao Conversation                         |
| `eightball`              | feature         | Acrescenta a mesa de 8-Ball Pool ao Conversation                         |
| `tic-tac-toe`            | feature         | Acrescenta o tabuleiro de Tic-Tac-Toe ao Conversation                     |
| `rock-paper-scissors`    | feature         | Acrescenta as partidas de Rock-Paper-Scissors ao Conversation                     |

### Tipos de resultado dos agentes

Os agentes produzem resultados tipados que o frontend sabe tratar. A união `AgentResultType`, em `packages/shared/src/types/agent.ts`, inclui:

`game_state_update`, `text_rewrite`, `sprite_change`, `echo_message`, `quest_update`, `image_prompt`, `context_injection`, `continuity_check`, `director_event`, `lorebook_update`, `character_card_update`, `background_change`, `character_tracker_update`, `persona_stats_update`, `custom_tracker_update`, `inventory_tracker_update`, `spotify_control`, `youtube_control`, `local_music_control`, `haptic_command`, `cyoa_choices`, `secret_plot`, `game_master_narration`, `party_action`, `game_map_update`, `game_state_transition`, `prompt_patch`, `frontend_theme_update` e `about_me_update`.

## Modos de chat

### Modo Conversation

Diálogo simples com um ou mais personagens de IA. Os personagens podem ter status diferentes (online, ausente, não perturbe, offline), o que muda o tempo e o estilo das respostas. Os agentes nativos são adicionados por chat, não ativados de forma global.

### Modo Roleplay

Uma experiência narrativa imersiva com acompanhamento do estado do jogo: contexto de cena (local, hora, clima), presença e humor dos personagens, atributos do jogador, inventário e missões, encontros de combate, World Info vinda dos lorebooks e expressões dos sprites.

### Game Mode

Sessões com um Game Master por IA, com membros de equipe, dados, estado do jogo, recursos, storyboards, um diário e um ciclo de sessão estruturado. O Game Mode usa stores e rotas dedicadas para o estado do jogo, os recursos, os jogos de mesa, os vídeos de cena e os storyboards. Veja [Game Mode: primeiros passos](../game/getting-started.md) para o fluxo do ponto de vista de quem joga.

## Desenvolvimento

### Comandos

Instalar as dependências:

```bash
pnpm install
```

Iniciar o servidor e o cliente com hot reload:

```bash
pnpm dev
```

Rodar só o servidor de desenvolvimento do cliente:

```bash
pnpm dev:client
```

Rodar só o servidor de API:

```bash
pnpm dev:server
```

Rodar a validação de base (TypeScript mais ESLint):

```bash
pnpm check
```

Gerar a build de produção:

```bash
pnpm build
```

### Orçamento de bundle

- Entrada principal: no máximo 1 MB.
- Por chunk: no máximo 500 KB.
- Divisões de vendor: react, tanstack, motion, zustand, icons e misc.

### Alias de caminho

`@/*` resolve para `./src/*` nas configurações do TypeScript e do Vite.

## Guias relacionados

- [Mapa da arquitetura (desenvolvedores)](architecture-map.md)
- [Armazenamento nativo em arquivos](file-storage.md)
