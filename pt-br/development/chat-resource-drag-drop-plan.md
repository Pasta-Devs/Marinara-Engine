# Plano de arrastar e soltar recursos no chat

## Status

As fases 1 a 4 foram implementadas no branch `drag-me-baby-one-more-time` e estão mescladas em `staging`. Um trabalho posterior (#7362) permite arrastar as linhas da biblioteca sem alça, permite que quem usa toque junte uma pilha de recursos compatíveis com toques de um segundo dedo e mostra espaços de inserção para reordenar.

A cobertura automatizada do resolvedor está ativa. A cobertura do Playwright no desktop já inclui a atribuição de personagem e a troca de persona, mas a execução local no contêiner de desenvolvimento atual está bloqueada: o Chromium não consegue carregar a biblioteca `libnspr4.so`. Esses casos de navegador precisam rodar na CI ou em um ambiente com as dependências de sistema do Playwright.

Antes de começar as fases restantes, siga as regras de coordenação do repositório:

1. Verifique se já existe uma issue, um branch ligado a uma issue, um draft PR ou um item de projeto sobre o arrastar e soltar de recursos no chat.
2. Deixe a responsabilidade visível na issue.
3. Abra um draft PR contra o branch `staging` quando a implementação começar.

## Objetivo

Permitir que o usuário arraste os recursos com suporte do painel direito para o chat ativo, sem passar pelas configurações do chat.

A janela central tem dois destinos possíveis:

- **Área do chat:** muda a configuração persistente do chat ativo.
- **Campo de mensagem:** acrescenta um anexo com suporte ao rascunho atual.

Esses alvos não valem para tudo. Um destino só aparece quando o item arrastado tem ali uma operação real e com suporte hoje.

## Regra do produto

Arrastar escolhe o recurso e o destino. O aplicativo executa apenas operações que já existem no modelo de dados do chat e no pipeline de geração.

- Uma única operação válida de acréscimo: aplique na hora e ofereça Undo (desfazer).
- Uma única operação válida de substituição: peça confirmação se ela for substituir um valor existente.
- Várias operações realmente com suporte: mostre um seletor pequeno, só com essas operações.
- Nenhuma operação válida: não ative o alvo.
- Recurso já aplicado: não aceite uma soltura duplicada.
- Nada de contexto especulativo de um turno, inserção oculta de prompt, menções sintéticas ou chips decorativos.

## Contratos atuais

Os contratos `Chat` e `ChatMetadata` já existentes dão suporte a estas operações persistentes:

- Personagens: atualizar `Chat.characterIds`.
- Persona: atualizar `Chat.personaId`.
- Preset de prompt: atualizar `Chat.promptPresetId`.
- Conexão: atualizar `Chat.connectionId`.
- Lorebooks: atualizar `ChatMetadata.activeLorebookIds`.
- Agentes: atualizar `ChatMetadata.activeAgentIds` e, quando aceito, `ChatMetadata.enableAgents`.
- Plano de fundo do chat: atualizar os metadados de plano de fundo que o chat já tem, pelo mesmo caminho de atribuição usado pelo componente `BackgroundPicker`.

Os campos de mensagem atuais aceitam anexos de arquivo. Eles ainda não aceitam referências a personagem, lorebook, agente, persona, preset ou conexão no escopo de uma mensagem.

## Matriz de ações com suporte

O resolvedor de capacidades também precisa respeitar as restrições do modo de chat atual e a disponibilidade do recurso. A tabela descreve a operação para os casos em que a interface já permite aquilo no modo ativo.

| Recurso | Área do chat | Campo de mensagem | Comportamento ao soltar |
| --- | --- | --- | --- |
| Personagem | Acrescenta o ID em `characterIds` | Nenhuma | Acrescenta na hora; aviso com Undo |
| Lorebook | Acrescenta o ID em `activeLorebookIds` | Nenhuma | Acrescenta na hora; aviso com Undo |
| Agente | Acrescenta o ID em `activeAgentIds` | Nenhuma | Acrescenta na hora quando os agentes estão ativados; caso contrário, confirma a ativação dos agentes e o acréscimo |
| Persona | Define `personaId` | Nenhuma | Define na hora se estiver vazio; confirma quando substitui outra persona |
| Preset de prompt | Define `promptPresetId` | Nenhuma | Respeita as restrições de modo; define na hora se estiver vazio; confirma quando substitui outro preset |
| Conexão | Define `connectionId` | Nenhuma | Confirma quando muda a conexão atual; mostra o nome da conexão antiga e o da nova |
| Plano de fundo do chat | Define os metadados de plano de fundo que o chat já tem | Nenhuma | Usa a semântica atual de atribuição de plano de fundo; só confirma a substituição se o fluxo atual exigir |
| Imagem ou arquivo com suporte | Nenhuma | Acrescenta aos anexos do rascunho | Reaproveita o pipeline atual de validação e preparação de anexos |
| Pasta de personagem, lorebook ou agente | Nenhuma | Nenhuma | Sem alvo |
| Controle de configuração | Nenhuma | Nenhuma | Sem alvo |
| Script de regex | Nenhuma | Nenhuma | Sem alvo enquanto não existir um contrato de atribuição no escopo do chat |
| Função ou ferramenta personalizada | Nenhuma | Nenhuma | Sem alvo enquanto não existir um contrato de atribuição no escopo do chat |
| Contribuição de extensão | Nenhuma por padrão | Nenhuma por padrão | Só com ativação explícita, por uma futura API tipada de contribuições |

### Regras de modo

Não duplique a política de modo nos handlers de arrasto. O resolvedor de capacidades de soltura deve usar os mesmos predicados da interface atual de configuração do chat.

No mínimo:

- Os presets de prompt continuam indisponíveis no Conversation Mode, igual ao componente `PresetsPanel`.
- A soltura de agente exige que o agente esteja instalado, disponível e válido para o modo atual.
- As operações de personagem, persona, lorebook, conexão e plano de fundo só aparecem onde o controle de atribuição correspondente já existe.
- Chats sem ID ativo não expõem nenhum alvo de soltura de recurso.
- O streaming ou o processamento de agentes não deve bloquear atualizações seguras de metadados, a não ser que algum caminho de mutação já faça isso. As confirmações de substituição precisam reler o estado atual do chat antes de aplicar a mudança.

## Design da interação

### Início do arrasto

Cada linha de painel com suporte escreve uma carga de recurso versionada:

```ts
type ChatResourceDragPayload = {
  version: 1;
  kind: "character" | "lorebook" | "agent" | "persona" | "preset" | "connection" | "background";
  ids: string[];
  label: string;
};
```

Use um único tipo MIME próprio, por exemplo `application/x-marinara-chat-resource`. Mantenha as cargas MIME de pasta que já existem durante a migração, porque reordenar pastas continua sendo outra interpretação válida do mesmo arrasto.

Os efeitos de arrasto de recurso devem anunciar o valor `copyMove`:

- As pastas de destino interpretam o arrasto como uma movimentação.
- Os alvos de chat interpretam o arrasto como uma cópia ou atribuição.

Não dependa do tipo `text/plain` para as operações internas de recurso. Ele é ambíguo e hoje contém apenas IDs soltos.

### Visibilidade dos alvos

Os indicadores de soltura ficam escondidos em repouso.

Quando um arrasto de recurso reconhecido entra na janela central:

1. Analise e valide a carga tipada.
2. Resolva as ações válidas contra o chat ativo mais recente.
3. Mostre apenas os destinos válidos.
4. Use um texto específico da ação, como `Add Maris to this chat`, em vez de um genérico `Drop here`.
5. Deixe as áreas inválidas inalteradas e sem aceitar soltura.

No arrasto de um arquivo com suporte, só o campo de mensagem se destaca. No arrasto de personagem, lorebook, agente, persona, preset, conexão ou plano de fundo, só a área do chat se destaca na primeira versão.

### Soltar na área do chat

A região que aceita a soltura é a área da conversa atual, independente da posição de rolagem da transcrição. Soltar sobre uma mensagem antiga não insere histórico nem muda o contexto de forma retroativa.

Ao soltar:

1. Releia o ID do chat ativo e os dados atuais do chat.
2. Resolva a capacidade de novo, para evitar ações duplicadas ou desatualizadas.
3. Aplique na hora quando a ação for de acréscimo e não tiver ambiguidade.
4. Abra uma confirmação enxuta para substituições ou para a ativação de agentes.
5. Informe o sucesso com um aviso localizado e uma ação Undo.
6. Informe a falha da mutação sem alterar a transcrição.

Não crie mensagens de usuário, assistente, narrador ou sistema para registrar mudanças de configuração. O modelo de mensagens não tem um tipo próprio de evento de atividade, e eventos de configuração não podem entrar no histórico que o modelo enxerga.

### Soltar no campo de mensagem

Preserve o comportamento atual de arquivos nos dois componentes, `ChatInput` e `ConversationInput`:

- Valide os tipos com suporte e o limite de 20 MB de tamanho.
- Prepare as imagens com a função `prepareImageAttachment`.
- Leia os arquivos de texto e PDF com suporte pelo caminho de anexo atual.
- Preserve o comportamento de rascunho de anexos pendentes por chat.

Aperte a detecção de arrasto no campo de mensagem, para que os arrastos internos de recurso não acendam o destaque de soltura de arquivo sem fazer nada depois.

### Confirmação

Peça confirmação só quando a operação tiver uma consequência real:

- Substituir a persona ativa.
- Substituir o preset de prompt ativo.
- Trocar a conexão ativa.
- Ativar os agentes como parte do acréscimo de um agente.
- Qualquer caminho atual de atribuição de plano de fundo que já exija uma escolha ou uma confirmação de substituição.

As confirmações precisam citar o valor atual e o valor proposto, quando isso fizer sentido. Elas não podem incluir ações sem relação, como começar um chat novo, chamar um agente uma vez ou citar o recurso em uma mensagem.

### Undo

O Undo restaura o valor exato de antes da soltura, não um palpite reconstruído.

- Personagem: restaure o array `characterIds` anterior por completo.
- Lorebook: restaure o array `activeLorebookIds` anterior por completo.
- Agente: restaure tanto `activeAgentIds` quanto `enableAgents`.
- Persona, preset, conexão e plano de fundo: restaure o valor anterior.

Antes de executar o Undo, verifique se o chat ativo ainda tem o valor que a soltura produziu. Se outra edição já mudou o mesmo campo, não sobrescreva: descarte o Undo desatualizado e informe o usuário de que o chat mudou.

## Arquitetura

### Utilitário compartilhado do cliente

Acrescente um módulo de cliente enxuto, provisoriamente o arquivo `packages/client/src/lib/chat-resource-drag.ts`, com:

- a constante do tipo MIME;
- o tipo da carga e o parser de execução;
- a função `writeChatResourceDragPayload(dataTransfer, payload)`;
- a detecção de arrasto de arquivo;
- as guardas de tipo de recurso.

Mantenha a carga restrita ao cliente na primeira versão, porque ela é estado de interação do navegador, não um contrato de API.

### Resolvedor de capacidades

Acrescente um resolvedor puro, provisoriamente o arquivo `packages/client/src/lib/chat-resource-drop-capabilities.ts`:

```ts
type ChatResourceDropAction =
  | { type: "add-characters"; ids: string[] }
  | { type: "add-lorebooks"; ids: string[] }
  | { type: "add-agents"; ids: string[]; mustEnableAgents: boolean }
  | { type: "set-persona"; id: string; replacesId: string | null }
  | { type: "set-preset"; id: string; replacesId: string | null }
  | { type: "set-connection"; id: string; replacesId: string | null }
  | { type: "set-background"; id: string };
```

As entradas incluem a carga de recurso já analisada, o chat ativo, os metadados normalizados, o modo atual e os IDs de recurso disponíveis. A saída é uma ação concreta ou o valor `null`.

O resolvedor cuida de:

- suprimir duplicatas;
- restrições de modo;
- filtrar vários IDs;
- verificações de instalação e disponibilidade;
- detectar substituições;
- escolher a chave da ação exibida ao usuário.

O resolvedor não executa mutações nem renderiza interface.

### Coordenador de mutações

Acrescente um único hook perto da área do chat, provisoriamente o arquivo `use-chat-resource-drop.ts`, que:

- lê o chat ativo mais recente do React Query/Zustand no momento da soltura;
- chama o hook `useUpdateChat` para os campos de primeiro nível do chat;
- chama o hook `useUpdateChatMetadata` para lorebooks e agentes;
- reaproveita o caminho de mutação atual de atribuição de plano de fundo;
- abre confirmações localizadas com os auxiliares de diálogo que o aplicativo já tem;
- cria avisos de sucesso e de erro e ações Undo protegidas.

Não coloque lógica de mutação assíncrona em uma store do Zustand.

### Sobreposição de soltura

Acrescente um único componente de apresentação em volta do limite compartilhado do chat central, em vez de implementações separadas dentro de cada transcrição:

- Recebe a carga do arrasto atual e a ação resolvida.
- Cobre a área da conversa sem atrapalhar o campo de mensagem.
- Usa contagem de profundidade de `dragenter`/`dragleave` para evitar oscilação entre os elementos filhos.
- Mostra o ícone, o rótulo do recurso e o texto localizado da ação.
- Responde ao tipo de ponteiro e ao tema.

As áreas de Conversation e de Roleplay/Game devem passar pelo mesmo coordenador. Os invólucros específicos de cada área podem fornecer a geometria, mas não podem duplicar a política de capacidades.

### Integração dos painéis

Migre as linhas arrastáveis aos poucos:

1. Personagens.
2. Lorebooks.
3. Agentes.
4. Personas.
5. Presets.
6. Conexões.
7. Planos de fundo, se o contrato de atribuição atual puder ser reaproveitado de forma limpa.

Cada linha mantém a carga de arrasto de pasta que já tem e acrescenta a carga de recurso de chat. Não mude o comportamento de movimentação de pastas.

## Fases de entrega

### Fase 1: contrato de arrasto e sobreposição central

- Acrescentar o utilitário de carga tipada e o parser.
- Acrescentar o resolvedor puro de capacidades para personagens, lorebooks e agentes.
- Acrescentar a sobreposição da área central do chat e o coordenador de mutações.
- Integrar as linhas dos painéis de personagem, lorebook e agente.
- Acrescentar os textos localizados de ação, confirmação, sucesso, erro, duplicata e Undo.
- Garantir que os arrastos internos de recurso não acendam o destaque de arquivo no campo de mensagem.

Esta fase comprova o fluxo principal de acréscimo que o recurso pede.

### Fase 2: recursos de substituição

- Acrescentar as cargas de persona, preset e conexão.
- Acrescentar a detecção de substituição e as caixas de diálogo de confirmação localizadas.
- Reaproveitar as restrições de modo e os hooks de mutação que já existem.
- Acrescentar o Undo protegido para as operações de substituição.

### Fase 3: atribuição de plano de fundo

- Definir se o fluxo de escolha do seletor de plano de fundo atual consegue aceitar um ID de plano de fundo solto sem duplicar a política.
- Acrescentar o arrasto de plano de fundo só se o mesmo comportamento de atribuição no escopo do chat puder ser reaproveitado.
- Caso contrário, deixar os planos de fundo sem suporte e registrar o impedimento na issue ou no PR.

### Fase 4: paridade com toque e sem arrasto

O arrastar e soltar de HTML no desktop é a primeira frente de implementação. O celular não pode depender de arrasto de precisão entre painéis.

- Acrescentar a ação `Add to active chat` na superfície de ações que cada linha com suporte já tem.
- Reaproveitar o mesmo resolvedor de capacidades, as mesmas confirmações, as mesmas mutações e o mesmo comportamento de Undo.
- Se o arrasto por toque for mantido, use as alças de arrasto por toque que já existem e resolva o alvo central com a função `elementFromPoint`.
- Não sobrecarregue o comportamento de toque longo em pastas de um jeito que deixe a organização pouco confiável.

Esta fase é obrigatória antes de considerar o recurso completo no celular.

## Arquivos que devem mudar

Arquivos novos prováveis:

- `packages/client/src/lib/chat-resource-drag.ts`
- `packages/client/src/lib/chat-resource-drop-capabilities.ts`
- `packages/client/src/hooks/use-chat-resource-drop.ts`
- `packages/client/src/components/chat/ChatResourceDropOverlay.tsx`

Arquivos modificados prováveis:

- `packages/client/src/components/chat/ChatArea.tsx` ou o dono compartilhado mais restrito da área central.
- `packages/client/src/components/chat/ChatRoleplaySurface.tsx`, se a geometria da área exigir.
- `packages/client/src/components/chat/ConversationView.tsx`, se a geometria da área exigir.
- `packages/client/src/components/chat/ChatInput.tsx`.
- `packages/client/src/components/chat/ConversationInput.tsx`.
- `packages/client/src/components/panels/CharactersPanel.tsx`.
- `packages/client/src/components/panels/LorebooksPanel.tsx`.
- `packages/client/src/components/panels/AgentsPanel.tsx`.
- `packages/client/src/components/panels/PersonasPanel.tsx`.
- `packages/client/src/components/panels/PresetsPanel.tsx`.
- `packages/client/src/components/panels/ConnectionsPanel.tsx`.
- `packages/client/src/components/panels/settings/BackgroundPicker.tsx`, apenas na fase 3.
- `packages/client/src/localization/locales/en.json` ou o caminho canônico do catálogo em inglês em uso no momento da implementação.

Não se espera nenhuma mudança no servidor nem no pacote compartilhado nas fases 1 e 2. Se a implementação descobrir que alguma operação não consegue usar as rotas de patch de chat que já existem, pare e redimensione o plano, em vez de criar um prompt oculto ou um contrato de persistência novo.

## Requisitos de acessibilidade e de entrada

- Não dependa só da cor: mostre o ícone do recurso e o texto da ação.
- Não exija passar o mouse para descobrir o equivalente sem arrasto.
- As confirmações são navegáveis pelo teclado e devolvem o foco ao fechar.
- A tecla Esc cancela uma confirmação pendente.
- Os leitores de tela recebem um anúncio curto quando um alvo de soltura válido aparece e quando uma operação termina com sucesso ou com falha.
- As sobreposições de arrasto não podem interceptar a rolagem normal quando não há nenhum arrasto reconhecido em andamento.
- Os alvos de toque seguem os tamanhos mínimos que já valem no celular.
- Quem usa movimento reduzido recebe mudanças de opacidade e de estado, sem movimento desnecessário.

## Localização

Todo texto visível novo usa chaves de localização semânticas. Atualize apenas o catálogo canônico em inglês; os idiomas da comunidade podem exibir o inglês como alternativa.

As categorias de texto incluem:

- rótulos de ação para cada tipo de recurso;
- confirmações de substituição;
- confirmação de ativação de agentes;
- avisos de sucesso e de falha;
- mensagens de Undo e de Undo desatualizado;
- anúncios de acessibilidade;
- textos de duplicata ou de recurso já ativo, se forem exibidos;
- ações `Add to active chat` sem arrasto.

## Testes

Não deixe arquivos `.test.ts` temporários no repositório.

### Cobertura de regressão pura

Acrescente cobertura permanente do resolvedor de capacidades apenas em um local e formato de teste de regressão que já tenham suporte:

- Personagem ausente -> ação de acréscimo.
- Personagem já presente -> nenhuma ação.
- Carga com vários personagens misturados -> acrescentar só os IDs válidos que faltam.
- Lorebook ausente -> ação de acréscimo.
- Lorebook já ativo -> nenhuma ação.
- Agente ausente com os agentes ativados -> ação de acréscimo.
- Agente ausente com os agentes desativados -> ação de acréscimo que exige ativação.
- Agente indisponível -> nenhuma ação.
- Persona sem persona atual -> ação de definição sem substituição.
- Persona substituindo outra -> ação de substituição.
- Preset em um modo sem suporte -> nenhuma ação.
- Conexão igual à conexão atual -> nenhuma ação.
- Versão inválida, tipo desconhecido, IDs malformados e carga grande demais -> rejeitados.

### Cobertura de testes de fumaça no navegador

Estenda o comando `pnpm smoke:ui` onde for prático:

- Arrastar um personagem do painel para a área do chat e conferir a atribuição.
- Usar o Undo e conferir se a lista de personagens anterior volta.
- Conferir se o arrasto de personagem sobre o campo de mensagem não mostra o retorno visual de soltura de arquivo.
- Arrastar um arquivo com suporte sobre o campo de mensagem e conferir se o comportamento de anexo continua intacto.
- Conferir se um recurso já ativo não tem nenhum destino de soltura ativo.
- Conferir se uma confirmação de substituição cancelada não gera mutação.
- Conferir se a substituição confirmada atualiza o chat.
- Conferir se o arrastar e soltar de pastas continua movendo recursos dentro do painel.

### Verificação manual

Verifique no desktop, nos modos Conversation, Roleplay e Game onde houver suporte:

- Temas escuro e claro.
- Painel direito aberto com uma transcrição longa e rolada.
- Soltura de acréscimo, soltura duplicada, substituição, cancelamento, falha, Undo e Undo desatualizado.
- Movimento do arrasto por elementos aninhados da transcrição, sem oscilação da sobreposição.
- Movimentação de pastas nos painéis, como já funciona.
- Solturas de arquivo e de imagem nos dois campos de mensagem, como já funcionam.

Verifique em uma tela de celular ou com ponteiro impreciso:

- Paridade da ação `Add to active chat` sem arrasto.
- O arrasto por toque de pastas continua utilizável.
- As confirmações cabem na tela e podem ser fechadas.
- Nenhum texto ou controle se sobrepõe.

Comandos obrigatórios:

```bash
pnpm localization:check
pnpm check
pnpm regression:prompt
pnpm smoke:ui
```

O comando `pnpm regression:prompt` é obrigatório antes do merge: a mudança no arquivo `LorebooksPanel.tsx` afeta a ativação de lorebooks, que alimenta a montagem do prompt.

## Riscos e mitigações

### Conflito com o arrasto de pastas existente

Risco: essas mesmas linhas já usam o arrastar e soltar para mover itens para dentro de pastas.

Mitigação: mantenha os tipos MIME de pasta atuais, acrescente um tipo MIME próprio e tipado para recurso de chat e deixe cada alvo interpretar só a carga dele. Verifique o comportamento do valor `copyMove` e as regressões de pasta.

### Destaque falso no campo de mensagem

Risco: os handlers de `dragover` do campo de mensagem hoje reagem a qualquer arrasto, inclusive a IDs internos de recurso.

Mitigação: acenda o retorno visual do campo de mensagem só quando `DataTransfer.types` ou `DataTransfer.items` indicar arquivos ou outra carga de anexo com suporte explícito.

### Estado desatualizado do chat

Risco: o chat ativo ou os recursos atribuídos podem mudar entre o início do arrasto, a soltura, a confirmação e o Undo.

Mitigação: resolva contra o estado atual na soltura e de novo antes da mutação ou do Undo. Proteja o Undo para que ele não sobrescreva mudanças mais recentes.

### Desvio da política de modos

Risco: o arrastar e soltar pode permitir uma atribuição que a interface de configuração proíbe.

Mitigação: extraia ou reaproveite os predicados compartilhados dos fluxos de atribuição atuais. Não escreva uma segunda matriz de política dentro dos componentes de painel.

### Expansão oculta de comportamento

Risco: aceitar recursos visualmente no campo de mensagem pode dar a entender um contexto de um turno que o servidor não respeita.

Mitigação: mantenha desativada a soltura de recurso no campo de mensagem enquanto não existir um contrato de contexto no escopo da mensagem, desenhado à parte.

### Soltura de seleções grandes

Risco: arrastar no modo de seleção pode acrescentar um conjunto inesperadamente grande de personagens, lorebooks ou agentes.

Mitigação: filtre os IDs inválidos e já ativos, respeite os limites que o servidor ou o modo já impõem e exija confirmação quando uma soltura de vários itens ultrapassar um limite existente. Não invente um limite arbitrário novo.

## O que está explicitamente fora do escopo

- Soltar um recurso sobre uma mensagem do histórico.
- Mudar o histórico de prompts de forma retroativa.
- Registrar mudanças de configuração como mensagens da transcrição.
- Personagens, lorebooks, personas, presets, conexões ou agentes de um turno só.
- Chamar um agente soltando algo no campo de mensagem.
- Começar um chat novo a partir de uma soltura na área central.
- Arrastar configurações quaisquer para dentro do chat.
- Uma API genérica de soltura para plugins na primeira versão.
- Arrastar de uma transcrição de chat para outra.

## Critérios de aceitação

A fase 1 fica aceitável quando:

- um personagem, lorebook ou agente pode ser arrastado da linha dele no painel direito para a área de um chat ativo válido;
- o campo correto do chat é atualizado sem criar nenhuma mensagem na transcrição;
- recursos já ativos e indisponíveis não são aceitos;
- acrescentar um agente com os agentes desativados exige confirmação explícita;
- toda mutação bem-sucedida oferece um Undo protegido;
- os arrastos de recurso não disparam o retorno visual de anexo no campo de mensagem;
- as solturas de anexo de arquivo continuam funcionando nos dois campos de mensagem;
- o comportamento atual de arrastar e soltar pastas não muda;
- todo texto visível novo está localizado;
- o desktop e o celular têm ações equivalentes, mesmo que no celular a ação venha de um menu em vez do arrasto entre painéis;
- os comandos `pnpm localization:check` e `pnpm check` e os testes de fumaça de interface relevantes passam.

O recurso completo fica aceitável quando os recursos de substituição da fase 2 e a paridade obrigatória no celular também estiverem prontos. A atribuição de plano de fundo continua opcional até a fase 3 confirmar que a semântica atual dela pode ser reaproveitada sem duplicar a política.

## Extensão adiada

Um recurso futuro de contexto no escopo da mensagem pode tornar personagens, lorebooks, agentes, personas, presets ou conexões solturas válidas no campo de mensagem. Esse trabalho exige um contrato separado no pacote compartilhado e no servidor, definindo a persistência, a montagem do prompt, o orçamento de tokens, o roteamento de provedores, a exibição, a restauração do rascunho e a semântica do histórico de mensagens. Ele não pode entrar disfarçado neste recurso como chips só do cliente.
