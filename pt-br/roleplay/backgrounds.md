# Planos de fundo do Roleplay

Um chat de Roleplay mostra uma imagem da cena inteira atrás das mensagens. Você pode deixar o agente **Background** (plano de fundo) escolher a imagem depois de cada resposta, criar uma nova na mão ou fixar uma imagem em um chat específico. Quando a imagem muda, Marinara faz uma transição suave da antiga para a nova.

A geração de imagens não é obrigatória. Sem uma conta de geração de imagens, o plano de fundo é uma cor sólida e o chat funciona como texto.

## Definir um plano de fundo para um chat só

Use isto para manter uma imagem atrás do chat aberto, em vez de deixar o agente escolher. A mudança vale só para esse chat.

1. Abra o chat. Depois abra **Settings → Appearance** (Configurações → Aparência) e localize **Backgrounds**.
2. Em **Chat Background**, escolha uma imagem enviada por você ou um dos planos de fundo dos seus recursos de jogo.

Você vê a imagem atrás das mensagens. Para voltar ao padrão, clique em **Remove** ao lado de **Chat Background**.

Ainda não tem imagens? Envie uma primeiro. Veja [Planos de fundo do chat](../appearance/chat-backgrounds.md).

## Deixar o agente Background escolher o plano de fundo

O agente **Background** é um ajudante que roda junto com as respostas. Depois de cada resposta, ele lê a cena atual e escolhe, entre todos os seus planos de fundo, a imagem mais adequada. Ele só escolhe imagens que já existem. O agente **Illustrator** cria imagens novas automaticamente.

1. Abra o chat de Roleplay.
2. Abra **Chat Settings** (configurações do chat) pelo botão de controles deslizantes no chat.
3. Abra **Agents** e ative a opção **Enable Agents**.
4. Adicione o agente **Background**.

A partir daí, o plano de fundo muda sozinho conforme a história passa de um lugar para outro.

Se não funcionou: com só um ou dois planos de fundo, o agente continua escolhendo esses. Acrescente mais à sua biblioteca. Veja [Planos de fundo do chat](../appearance/chat-backgrounds.md).

## Gerar um plano de fundo na mão

Marinara monta um prompt de imagem a partir da cena (gênero, cenário, local, clima e horário) e cria um plano de fundo novo.

Antes de começar: instale o agente **Illustrator** e defina uma conta de geração de imagens para ele, ou marque uma conta de geração de imagens como padrão. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md). Não é preciso adicionar o Illustrator ao chat.

1. Abra **Chat Settings** pelo botão de controles deslizantes no chat e expanda **Gallery** (galeria).
2. Clique em **Background**. Ele mostra **Generating...** enquanto trabalha, e a Gallery diz "Illustrator is generating a background image for this scene."
3. Espere terminar. A imagem nova entra na sua biblioteca de planos de fundo e é aplicada à cena.

A geração manual usa a conta de imagens do agente Illustrator e, na falta dela, a sua conta padrão de geração de imagens. Ela funciona nos modos Roleplay e Game, não no Conversation Mode.

Se não funcionou: a mensagem "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection." significa que Marinara não encontrou nenhuma conta de imagens. Defina uma e tente de novo. Se o botão **Background** não aparece, o Illustrator não está instalado.

## A biblioteca e o desfoque

As imagens que você escolhe ficam nessa mesma seção **Backgrounds**. A importação, as tags, a renomeação, a exclusão, o controle deslizante **Background Blur** e o plano de fundo padrão dos novos chats de Roleplay estão em [Planos de fundo do chat](../appearance/chat-backgrounds.md).

## Guias relacionados

- [Planos de fundo do chat](../appearance/chat-backgrounds.md): a biblioteca de imagens enviadas e os controles de aparência.
- [Planos de fundo de cena](../media/scene-backgrounds.md): arte de cena feita por IA a partir da galeria.
- [Roleplay Mode: primeiros passos](getting-started.md): o palco do Roleplay, os sprites e o HUD.
