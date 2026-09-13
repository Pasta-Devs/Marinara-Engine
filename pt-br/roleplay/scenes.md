# Cenas: criando uma ramificação do roleplay

Este guia explica as cenas do Marinara Engine. Uma cena é um roleplay curto e independente, que nasce como ramificação de um chat Conversation. Aqui você vê como começar uma cena, como jogar e como encerrar, descartar, bifurcar ou converter.

## O que é uma cena

Uma cena é um roleplay paralelo que cresce a partir de um chat Conversation. O chat Conversation é o modo de mensagem direta, no estilo de um mensageiro. Com a cena, você e um personagem saem desse chat para viver um momento de roleplay bem focado. Esse momento pode ser um flashback, um encontro romântico ou uma briga. E a linha principal da história continua intacta.

Cada cena é um chat de roleplay próprio. Ela tem plano de fundo próprio, personagens próprios no palco (a área da cena) e mensagem de abertura própria. Quem escreve essa preparação quando a cena começa é o personagem ou a própria história.

Uma cena é temporária por natureza. Enquanto ela está aberta, o chat Conversation original mostra um pequeno card com o texto **A scene is in progress**. Nesse card fica o botão **Go to Scene** (ir para a cena), que leva você direto para a cena ativa.

Ao terminar, você escolhe o destino da cena. É possível salvar um resumo de volta na conversa, jogar a cena fora ou guardá-la como um roleplay permanente. As três opções estão explicadas abaixo.

## Como começar uma cena

A cena começa dentro de um chat Conversation, com o comando `/scene`. O comando tem um apelido, `/rp`, que faz exatamente a mesma coisa.

Siga estes passos:

1. Abra um chat Conversation que já tenha algumas mensagens.
2. Na caixa de mensagem, digite o comando da cena. Depois dele, você pode escrever uma descrição curta do que quer.

```
/scene we sneak into the old library at midnight
```

3. Pressione Enter. A janela **Scene Prompt Setup** (preparação do prompt da cena) abre.
4. Escolha um **Prompt preset** (predefinição de prompt) para a nova cena ou mantenha **None** (nenhum). Marinara lembra essa escolha para a próxima cena. As instruções da própria cena continuam valendo junto com a predefinição selecionada.
5. Na seção **POV**, escolha o enquadramento da narração: **First Person**, **Second Person** ou **Third Person**.
6. Na seção **Tense**, escolha **Past**, **Present** ou **Future**.
7. Se quiser, escreva observações no campo **Extra instructions** para direcionar a cena.
8. Clique em **Plan Scene**.

Marinara planeja a cena e abre tudo como um novo chat de roleplay. A cena nova aparece na lista de chats e abre sozinha, já com uma mensagem de abertura que apresenta a situação. Mudou de ideia na janela de preparação? Clique em **Cancel** e nenhuma cena é criada.

Também é possível começar uma cena sem descrição nenhuma. Digite só o comando, desde que a conversa já tenha histórico suficiente para servir de base.

```
/scene
```

Se a conversa ainda não tiver mensagem nenhuma, Marinara pede que você escreva uma descrição ou converse um pouco antes de planejar a cena.

O personagem também pode pedir para começar uma cena. Nesse caso, abre a mesma janela **Scene Prompt Setup**, com uma linha do tipo "[Character] wants to start a scene." Escolha **Prompt preset**, **POV** e **Tense** e clique em **Plan Scene**, do mesmo jeito. Para recusar, clique em **Cancel**.

## A barra da cena: End Scene, Discard, Convert e Back to conversation

Dentro de uma cena ativa, existe uma barra logo acima da caixa de mensagem. É nela que ficam os controles que decidem o destino da cena. Os botões exibidos dependem de a cena ter ou não uma conversa vinculada.

- **Back to conversation** (voltar para a conversa) leva você de volta ao chat Conversation que originou a cena. A cena continua aberta e em andamento, então você pode retomá-la depois. Esse botão só aparece quando a cena tem uma conversa de origem.
- **End Scene** (encerrar a cena) finaliza a cena e salva um resumo. Ao clicar, a barra pergunta **End and save summary?**, com os botões **Yes** e **No**. Clique em **Yes** para confirmar. Durante o processo, o botão mostra o estado **Saving...**. Marinara escreve um resumo curto da cena de volta na conversa de origem, na forma de uma lembrança, e devolve você ao ponto onde a conversa parou.
- **Discard** (descartar) joga a cena fora sem salvar nada. Ao clicar, a barra pergunta **Discard scene?**, com os botões **Yes** e **No**. Clique em **Yes** para excluir a cena e voltar para a conversa. Nada é salvo de volta.
- **Convert** (converter) transforma a cena em um chat de roleplay independente. Esse botão tem uma seção só para ele mais abaixo, porque a mudança que ele faz é permanente.

Pense bem antes de clicar em **End Scene** ou **Discard**, porque os dois tiram a cena da conversa. **End Scene** guarda uma lembrança do que aconteceu. **Discard** não guarda nada.

## Como clonar uma cena a partir de uma mensagem

Dentro de um chat de cena, cada mensagem tem um pequeno botão de ação cuja dica (o texto que aparece ao passar o mouse) diz **Clone from here**. Com ele, você bifurca o conteúdo da cena para um chat de roleplay novinho, copiado até a mensagem escolhida, incluindo ela.

Veja como fazer:

1. Passe o mouse sobre a mensagem de onde quer criar a ramificação.
2. Clique na ação **Clone from here** (clonar a partir daqui).

Marinara cria um roleplay independente a partir da cena, copiando as mensagens até aquele ponto. A cena original continua aberta e ativa, então essa é uma forma segura de testar outro caminho. Aparece uma confirmação de que a cena foi clonada como roleplay, e o chat novo abre.

Clonar preserva a cena original. Converter, o assunto seguinte, não preserva.

## Como converter uma cena em roleplay independente

O botão **Convert**, na barra da cena, desvincula a cena e a transforma em um chat de roleplay permanente. Ao clicar em **Convert**, abre uma janela de confirmação com o título **Convert this scene into a standalone roleplay?**

A janela explica o que vai acontecer. Marinara cria um chat de roleplay a partir da cena atual e desvincula a cena original da conversa. Nenhum resumo da cena e nenhuma lembrança do personagem voltam para a conversa original. Clique em **Convert** para seguir em frente ou em **Cancel** para deixar tudo como está.

Use **Convert** quando a cena virar uma história que você quer manter e continuar como um roleplay normal. Quando quiser uma cópia mas também quiser a cena original no lugar, use **Clone from here**.

Resumindo a diferença entre os dois caminhos de bifurcação: **Clone from here** bifurca ramificações da cena e mantém a original ativa. **Convert** converte as ramificações da cena em um roleplay independente e tira a original da conversa.

## Por que a cena não herda o contexto do chat conectado

Um chat Conversation pode ficar conectado a um roleplay, de modo que o contexto circule entre os dois. Com as cenas, o funcionamento é outro, e isso é proposital. A cena é independente.

A cena não puxa automaticamente o contexto de ida e volta de uma conversa conectada, mesmo quando o chat de origem puxa. Uma conversa conectada pode passar discretamente observações curtas de direcionamento para um roleplay vinculado, para guiar a história, mas a cena ignora essas observações. Assim a cena fica concentrada no próprio momento, sem arrastar a conversa inteira junto.

É por isso que a cena se lê como uma historinha completa em si. Se você quer o vínculo contínuo de mão dupla entre uma conversa e um roleplay, use um chat conectado em vez de uma cena. Esse recurso está no guia de chats conectados, com link abaixo.

## Guias relacionados

- [Roleplay Mode: primeiros passos](getting-started.md)
- [Ramificações de chat](../chats/branches.md)
- [Conectar uma Conversation a um Roleplay ou Game](../chats/connected-chats.md)
