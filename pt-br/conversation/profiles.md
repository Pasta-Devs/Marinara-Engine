# Perfis do Conversation Mode (Display Name, About Me, Behavior)

Todo personagem e toda persona tem um pequeno perfil de aplicativo de chat para o Conversation Mode: um nome de exibição, uma biografia "sobre mim" e uma instrução de comportamento. Esses campos nunca são usados no Roleplay nem no Game Mode.

Este não é um perfil de configurações (um conjunto salvo de opções de chat, veja [Perfis de configurações](../chats/settings-profiles.md)). Está começando no modo? Leia primeiro [Conversation Mode: primeiros passos](getting-started.md). Uma persona é o cartão de personagem que representa você.

## Onde esses campos ficam

Os campos ficam em uma aba chamada **Convo**.

1. Abra o personagem no **Character Editor**, ou a persona no **Persona Editor**. Para chegar lá, abra o painel **Characters** pela barra lateral, ou o painel **Personas** pelo ícone de pessoa na barra superior da barra lateral direita, e clique no cartão (veja [Criando e editando personagens](../characters/creating-and-editing-characters.md) e [Personas de usuário](../characters/personas.md)).
2. Clique na aba **Convo**.

A aba tem **Convo Display Name**, **About Me** e **Convo Behavior**. Em um personagem, ela também tem **Weekly schedule** (com **Edit schedule** ou **Create schedule**, veja [agendas](schedules.md)) e **Image generation instructions**, orientações opcionais para as selfies desse personagem (veja [Selfies](selfies.md)).

## Defina um nome de exibição

**Convo Display Name** é o nome mostrado nos chats de Conversation. Deixe em branco para usar o nome do cartão. As mensagens existentes se atualizam na hora.

Os personagens também têm **Declare this name on the card in the prompt**. Quando ativada, o Marinara adiciona uma linha como "Conversation display name: X" ao texto do cartão no prompt (o texto que o Marinara envia ao modelo), para o modelo saber qual cartão usa qual nome. Ela precisa de um nome de exibição antes.

## Escreva um About Me

**About Me** é uma biografia curta: uma ou duas linhas, um emoji, uma piada, ou nada. O Marinara adiciona ao prompt, a cada turno, o **About Me** de todo personagem e persona presentes, para o modelo saber como cada um se apresenta. Você não precisa fazer nada para isso.

Para preenchê-lo:

- Digite você mesmo. O botão de emoji na barra de ferramentas insere um emoji. **Revert** restaura o texto de antes da sua edição atual.
- Em um personagem salvo, clique no botão de varinha (**Generate About Me from this card**).
- Peça à **Professor Mari** na tela inicial, por exemplo `Write Luna's About Me as a cryptic one-line bio.` Ela lê o perfil salvo, escreve a biografia na voz dessa pessoa e a salva. Você pode manter ou restaurar a mudança dela no fluxo de revisão de sempre.

Se não funcionou: o botão de varinha não aparece em um cartão que ainda não foi salvo. Salve o cartão primeiro.

## Defina o Convo Behavior

**Convo Behavior** é uma instrução sobre como o personagem ou a persona age no Conversation Mode, por exemplo: manter as respostas curtas e em minúsculas e mandar mensagens como uma pessoa de verdade. Instruções pós-histórico são texto de prompt colocado depois do histórico recente do chat. Mantenha o padrão se você não escreve prompts personalizados. Use **Insertion** para escolher onde a instrução entra no prompt:

| Opção | Onde a instrução entra |
| --- | --- |
| **Constant — after the card** (padrão) | Sempre, logo depois do texto do cartão. |
| **Constant — before the card** | Sempre, logo antes do texto do cartão. |
| **Append to post-history** | No fim das instruções pós-histórico. |
| **Prepend to post-history** | No início das instruções pós-histórico. |
| **Replace post-history** | No lugar das instruções pós-histórico. |
| **Only where {{convo_behavior}} is placed** | Só onde você coloca a macro em um prompt personalizado. |

## Substituições de About Me específicas de um chat

O **About Me** do cartão é o padrão em todo lugar. Você pode definir uma biografia diferente só para um chat.

1. Em um chat de Conversation, clique no avatar ou no nome de um personagem ou persona. Um cartão de perfil se abre ao lado (pela parte de baixo, no celular).
2. Leia o cartão. Ele mostra o avatar, o nome e o **About Me** atual. Um selo mostra **Default** ou **Chat-specific**. Os personagens também mostram **Online**, **Away**, **Busy** ou **Offline**.
3. Clique em **Edit**.
4. Digite a biografia para este chat. Um seletor de emojis com uma aba **Custom emojis** está disponível.
5. Clique em **Save**. Você vê "Chat-specific about me saved".

**Cancel** fecha o modo de edição sem salvar. **Revert** desfaz as mudanças não salvas. **Clear** remove uma substituição existente e volta ao padrão do cartão. Salvar uma biografia vazia também a limpa.

## Deixe um personagem mudar o próprio About Me

Esta é uma opção avançada. Uma ferramenta chamada `update_about_me` permite que um personagem edite a própria biografia durante um chat. Ela vem desativada. Para usá-la, abra **Chat Settings → Function Calling**, ative **Enable Tool Use** e adicione a ferramenta `update_about_me`.

O personagem escolhe uma de duas opções:

- Public muda a biografia real, vista em todos os chats. Você a aprova primeiro.
- Chat muda uma biografia privada do chat atual.

## Macros para prompts personalizados

Você não precisa de macros para que os perfis cheguem ao modelo. Use-as só para colocar um valor em um ponto exato de um prompt personalizado. Cada uma fica vazia fora do Conversation Mode. Veja [Macros](../prompts/macros.md).

| Macro | Valor |
| --- | --- |
| `{{convo_display}}` | O nome de exibição do personagem que responde. |
| `{{char_about}}` | O **About Me** efetivo do personagem. |
| `{{persona_about}}` | O **About Me** efetivo da persona. |
| `{{convo_behavior}}` | O **Convo Behavior** do personagem. |

## Guias relacionados

- [Conversation Mode: primeiros passos](getting-started.md)
- [Criando e editando personagens](../characters/creating-and-editing-characters.md)
- [Personas de usuário: criar e editar](../characters/personas.md)
- [Macros](../prompts/macros.md)
