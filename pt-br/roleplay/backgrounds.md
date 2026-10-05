# Planos de fundo do Roleplay

Este guia explica o plano de fundo da cena no Roleplay Mode: o agente **Background** (plano de fundo), que escolhe uma imagem depois de cada resposta, como criar um plano de fundo na mão e como fixar um plano de fundo em um chat específico. A biblioteca de planos de fundo que você mesmo envia e os controles dela estão em [Planos de fundo do chat](../appearance/chat-backgrounds.md). A arte de cena feita por IA a partir da galeria está em [Planos de fundo de cena](../media/scene-backgrounds.md).

## O plano de fundo da cena

O Roleplay Mode mostra o plano de fundo da cena inteiro atrás das mensagens. Quando a imagem muda, Marinara faz uma transição suave da antiga para a nova, e a troca de cena fica delicada em vez de brusca.

Nada disso depende da geração de imagens. Sem uma conexão de geração de imagens configurada, o plano de fundo aparece como uma cor sólida. O chat continua funcionando normalmente, como um chat de texto.

## O agente Background

O agente **Background** é um ajudante opcional que escolhe o plano de fundo da cena para você. Ele roda depois de cada resposta. Primeiro lê a cena atual, depois escolhe a imagem mais adequada entre todos os planos de fundo disponíveis. As pastas da biblioteca servem apenas para organizar a seção **Settings** (Configurações) e nunca escondem opções do agente. O agente só seleciona imagens que já existem; a geração automática de planos de fundo é tarefa do agente **Illustrator**.

O agente **Background** vem desativado por padrão. Para ativar:

1. Abra o chat de Roleplay.
2. Abra **Chat Settings** (configurações do chat) pelo botão no chat. Ele começa no canto superior direito, a menos que você o tenha movido.
3. Abra a seção **Agents**.
4. Ative o agente **Background**.

A partir daí, o plano de fundo da cena se atualiza sozinho conforme a história muda de lugar.

## Gerar um plano de fundo na mão

Outra opção: criar um plano de fundo você mesmo, sem o agente. Marinara monta um prompt de imagem a partir da cena, ou seja, do gênero, do cenário, do local atual, do clima e do horário, e cria um plano de fundo novo.

1. Abra **Chat Settings** e expanda **Gallery** (galeria).
2. Clique no botão **Background**.
3. Espere o botão terminar. Ele mostra **Generating...** enquanto trabalha.

Durante o processo, aparece este aviso: "AI background generation is running. The new background will be applied when it finishes." A imagem nova entra na biblioteca de planos de fundo e é aplicada à cena.

A geração manual usa a conexão de imagem do agente **Illustrator** e, se ela não existir, recorre à conexão padrão de geração de imagens. O agente **Background** não precisa de conexão de imagem, porque só seleciona imagens que já estão na biblioteca. Quando Marinara não encontra nenhuma conexão, a geração falha com esta mensagem: "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection."

A geração de planos de fundo de cena funciona apenas nos modos Roleplay e Game. No Conversation Mode ela não existe.

## Definir um plano de fundo para um chat só

Você pode fixar um plano de fundo específico no chat aberto, em vez de deixar o agente escolher.

1. Abra a seção **Settings**.
2. Abra a aba **Appearance**.
3. Localize a seção **Backgrounds**.
4. Em **Chat Background**, escolha uma imagem enviada por você ou um dos planos de fundo dos recursos de jogo.

Para voltar ao plano de fundo padrão, clique em **Remove** ao lado de **Chat Background**.

## A biblioteca de planos de fundo e o desfoque

As imagens disponíveis para escolha ficam nessa mesma seção **Backgrounds**, dentro de **Settings** e depois **Appearance**. O guia [Planos de fundo do chat](../appearance/chat-backgrounds.md) cobre a biblioteca por completo: importar imagens, tags, renomear, excluir, o controle deslizante **Background Blur** e a definição de um plano de fundo padrão para os novos chats de Roleplay.

## Guias relacionados

- [Planos de fundo do chat](../appearance/chat-backgrounds.md): a biblioteca de imagens enviadas e os controles de aparência dos planos de fundo.
- [Planos de fundo de cena](../media/scene-backgrounds.md): arte de cena gerada por IA a partir da galeria.
- [Roleplay Mode: primeiros passos](getting-started.md): a cena de Roleplay completa, os sprites e o HUD.
