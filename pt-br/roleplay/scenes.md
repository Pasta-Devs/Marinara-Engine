# Cenas: criando uma ramificação do roleplay

Uma cena é um roleplay curto que nasce como ramificação de um chat de Conversation. Use uma para um flashback, um encontro romântico ou uma briga, sem perder a linha principal.

Cada cena é um chat de Roleplay próprio, com plano de fundo, personagens e mensagem de abertura próprios. Enquanto ela está aberta, o chat de Conversation original mostra um cartão com o texto **A scene is in progress** e um botão **Go to Scene** (ir para a cena).

Enquanto a cena roda, os personagens dela não respondem no chat de Conversation, e um aviso diz que eles estão em uma cena ativa. Para deixar que eles respondam ali mesmo assim, ative **Allow replies here** (permitir respostas aqui) no cartão. A opção começa desativada. Com ela ativada, os personagens da cena respondem quando você manda mensagem para eles, mas continuam sem enviar mensagens por conta própria.

## Começar uma cena

Antes de começar: abra um chat de Conversation que já tenha algumas mensagens. Veja [Conversation Mode: primeiros passos](../conversation/getting-started.md).

1. Na caixa de mensagem, digite `/scene` e uma descrição curta. `/rp` faz a mesma coisa. Por exemplo: `/scene we sneak into the old library at midnight`
2. Pressione <kbd>Enter</kbd>. A janela **Scene Prompt Setup** (preparação do prompt da cena) abre.
3. Se você vir **Scene persona** (persona da cena), escolha quem interpreta você. **Use the Conversation persona** (usar a persona da Conversation) mantém a persona da Conversation.
4. Se você vir **Scene characters** (personagens da cena), deixe **Let the scene planner choose characters** (deixar o planejador da cena escolher os personagens) ativado para que Marinara escolha. Ou desative a opção e escolha pelo menos um personagem.
5. Escolha um **Prompt preset** (preset de prompt). Deixe em **None** (nenhum) para usar o preset do seu [perfil de configurações](../chats/settings-profiles.md#choosing-the-default-profile) padrão de Roleplay. Marinara lembra a sua escolha para a próxima cena.
6. Em **POV**, escolha **First Person**, **Second Person** ou **Third Person**.
7. Em **Tense** (tempo verbal), escolha **Past**, **Present** ou **Future**.
8. Opcional: escreva observações em **Extra instructions** (instruções extras) para direcionar a cena.
9. Clique em **Plan Scene** (planejar a cena).

A cena abre como um novo chat de Roleplay na sua lista de chats, com uma mensagem de abertura que apresenta a situação. Clique em **Cancel** (cancelar) na janela de preparação para parar sem criar uma cena.

`/scene` sozinho também funciona quando a conversa tem histórico suficiente. Se a conversa ainda não tiver mensagens, Marinara pede que você acrescente uma descrição ou converse um pouco antes.

Um personagem também pode pedir para começar uma cena. Um convite **Set up scene** (configurar cena) aparece ao lado da resposta dele. Clique nele para abrir **Scene Prompt Setup** e continue a partir da etapa 3. **Cancel** fecha a preparação, e o convite continua disponível, mesmo depois de recarregar.

Como a cena abre:

- Ela parte do seu perfil de configurações padrão de Roleplay, como qualquer novo chat de Roleplay. Um [perfil de configurações](../chats/settings-profiles.md) é um conjunto salvo de configurações do chat.
- Quando o plano da cena traz esses textos, uma nota curta sobre como jogar a cena é publicada primeiro, como mensagem do narrador, e depois a descrição da cena, como uma segunda mensagem do narrador. Um plano sem a nota a pula.
- Com um personagem, a abertura é escrita na voz dele, com as falas entre aspas duplas, a menos que as suas instruções de escrita definam outro estilo.
- Em uma cena em grupo, a abertura segue o modo de grupo do perfil. **Merged (Narrator)** é o padrão: uma única resposta dá voz a todos os personagens. No modo **Individual**, o personagem que abre a cena a escreve. Veja [Chats em grupo](../chats/group-chats.md#choose-who-speaks).

## Usar a barra da cena

Dentro de uma cena, uma barra acima da caixa de mensagem decide o que acontece com ela. Os botões exibidos dependem de a cena ter ou não uma conversa de origem.

| Botão | O que faz |
| --- | --- |
| **Back to conversation** (voltar para a conversa) | Volta ao chat de Conversation que começou a cena. A cena continua aberta. Só aparece quando existe uma conversa de origem. |
| **End Scene** (encerrar a cena) | Salva um resumo e encerra a cena. Clique em **Yes** (sim) em **End and save summary?**. |
| **Discard** (descartar) | Exclui a cena e não salva nada. Clique em **Yes** em **Discard scene?**. |
| **Convert** (converter) | Transforma a cena em um Roleplay independente. Veja abaixo. |

**End Scene** mostra **Saving...**, escreve um resumo curto na conversa como uma lembrança e leva você de volta para lá. **Discard** não guarda nada. Os dois tiram a cena da sua conversa.

## Clonar uma cena a partir de uma mensagem

Para copiar uma cena até uma mensagem e continuá-la separadamente, enquanto a original continua aberta:

1. Passe o mouse sobre a mensagem a partir da qual você quer criar a ramificação.
2. Clique na ação **Clone from here** (clonar a partir daqui) dessa mensagem.

Marinara cria um novo Roleplay independente com as mensagens até aquela, incluindo ela, mostra uma confirmação e o abre.

## Converter uma cena em Roleplay

Use **Convert** quando uma cena tiver virado uma história que você quer manter como um Roleplay normal.

1. Clique em **Convert** na barra da cena.
2. Leia **Convert this scene into a standalone roleplay?** Isso cria um novo chat de Roleplay a partir da cena e desvincula a cena original da conversa dela. Nenhum resumo da cena nem lembrança do personagem é escrito de volta.
3. Clique em **Convert**, ou em **Cancel** para não mudar nada.

Clonar mantém a cena original aberta. Converter, não.

## Cenas e chats conectados

Uma cena é independente. Ela não puxa contexto de uma Conversation conectada, mesmo quando o chat de origem puxa, e ignora as observações curtas de direcionamento que uma conversa conectada pode enviar a um Roleplay vinculado. Para um vínculo contínuo de mão dupla entre uma conversa e um roleplay, use um chat conectado. Veja [Conectar uma Conversation a um Roleplay ou Game](../chats/connected-chats.md).

## Guias relacionados

- [Roleplay Mode: primeiros passos](getting-started.md)
- [Ramificações de chat](../chats/branches.md)
- [Conectar uma Conversation a um Roleplay ou Game](../chats/connected-chats.md)
