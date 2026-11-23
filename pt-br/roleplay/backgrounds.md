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

## Reutilizar imagens que você já tem

Quando Illustrator cria planos de fundo por conta própria e a história vai para um novo lugar, primeiro verifica se você fixou um plano de fundo naquele lugar (veja [Fixar um plano de fundo em um lugar](#pin-a-background-to-a-place)). Em um lugar fixado, ele não pinta nada. Caso contrário, procura na biblioteca de planos de fundo. Uma imagem serve para um lugar quando o nome do arquivo ou uma das tags com duas ou mais palavras aparece no local do World State. Por exemplo, `john-bedroom.png` serve para "Smith House, John's bedroom". Maiúsculas, acentos e "'s" não importam, e o nome mais específico tem prioridade sobre um simples `bedroom.png`.

Sem um local do World State, o nome do lugar que Illustrator escreve para o novo plano de fundo é comparado da mesma forma. Se uma imagem corresponder, ela é exibida e nada é pintado. Só um lugar sem correspondência recebe uma imagem nova.

Para garantir que um lugar mantenha sua imagem, dê ao arquivo o nome do lugar (`kitchen.png` para "Kitchen"). Uma tag também funciona quando tem duas ou mais palavras, como `smith house kitchen`; tags de uma palavra, como `kitchen` ou `night`, são ignoradas, porque geralmente descrevem a aparência da imagem.

## Gerar um plano de fundo na mão

Marinara monta um prompt de imagem a partir da cena (gênero, cenário, local, clima e horário) e cria um plano de fundo novo.

Antes de começar: instale o agente **Illustrator** e defina uma conta de geração de imagens para ele, ou marque uma conta de geração de imagens como padrão. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md). Não é preciso adicionar o Illustrator ao chat.

1. Abra **Chat Settings** pelo botão de controles deslizantes no chat e expanda **Gallery** (galeria).
2. Clique em **Background**. Ele mostra **Generating...** enquanto trabalha, e a Gallery diz "Illustrator is generating a background image for this scene."
3. Espere terminar. A imagem nova entra na sua biblioteca de planos de fundo e é aplicada à cena.

A geração manual usa a conta de imagens do agente Illustrator e, na falta dela, a sua conta padrão de geração de imagens. Ela funciona nos modos Roleplay e Game, não no Conversation Mode.

Se não funcionou: a mensagem "Choose an image generation connection for the Illustrator agent, or mark one as the default image connection." significa que Marinara não encontrou nenhuma conta de imagens. Defina uma e tente de novo. Se o botão **Background** não aparece, o Illustrator não está instalado.

## Fixar um plano de fundo para um local

Use isto quando um lugar da história deve ter sempre a mesma aparência: o quarto de John sempre mostra `john-bedroom`, e o seu próprio quarto sempre mostra `my-bedroom`. Quando a história chega a um lugar fixado, a imagem dele aparece, independentemente do que o agente Background teria escolhido.

1. Abra **Configurações do chat** pelo botão de controles deslizantes no chat e abra **Plano de fundo**.
2. Em **Lugares fixados**, clique em **Adicionar lugar**.
3. Clique na imagem vazia e escolha o plano de fundo. Digite o local do jeito que a história o escreve, como `John's bedroom`.
4. Opcional: abaixo dele, adicione outros nomes que a história pode usar, separados por vírgulas, como `John's room, the master bedroom`.

Mais rápido: enquanto a história está em um local e a imagem certa está aparecendo, clique em **Fixar esta imagem em "John's bedroom"**.

Como os lugares são diferenciados:

- O nome mais específico tem prioridade. `John's bedroom` e `{{user}}'s bedroom` nunca se misturam, e uma fixação simples de `bedroom` só vale para quartos que ninguém fixou.
- Uma ou duas palavras entre os termos ainda contam: "John's guest bedroom" corresponde a `John's bedroom`, a menos que outro lugar fixado tenha exatamente aquele nome.
- `{{user}}` é o nome da sua persona e `{{char}}` é qualquer personagem no chat, então `{{user}}'s bedroom` corresponde a "Alyssa's bedroom".
- "My" e "our" pertencem a quem escreveu a mensagem. Quando a resposta de John diz que a história está em "my bedroom", esse é o quarto de John; "your bedroom" na resposta dele é o seu. Na sua própria mensagem, "your bedroom" é o quarto do personagem quando o chat tem só um.
- Maiúsculas, minúsculas, acentos e apóstrofos não importam. Os nomes correspondem a palavras inteiras: `John` nunca corresponde a "Johnson".
- Com **World Maps**, escolha o local na lista **Lugar do World Maps**. Um prédio fixado também abrange os cômodos dele que não têm uma fixação própria.

O que acontece:

- A imagem aparece uma vez na chegada. Se você escolher outro plano de fundo na mão enquanto estiver lá, a sua escolha permanece até a história seguir para outro lugar.
- Em um lugar fixado, o agente Background não pode trocar a imagem, e Illustrator não pinta um plano de fundo novo para ele.
- É preciso ter o local do agente **World State** (ou do World Maps). O fim da lista mostra onde a história está agora, e **Aqui** marca o lugar fixado em uso. Os lugares fixados funcionam em chats de Roleplay.

Se não funcionar: confira se **A história está em** abaixo da lista mostra o lugar e se um dos nomes do lugar fixado aparece ali.

### Planos de fundo que acompanham um personagem

Uma imagem na **Galeria** de um personagem (ou de uma persona) marcada como plano de fundo aparece em todos os chats em que esse personagem está, sem precisar fixar lugares em cada chat.

1. Abra a **Galeria** do personagem, clique no botão de tags de uma imagem e escolha **Usar como plano de fundo**.
2. Digite os locais que ela mostra, separados por vírgulas, como `{{char}}'s bedroom, {{char}}'s room`. Na galeria de um personagem, `{{char}}` é esse personagem; na de uma persona, `{{user}}` é essa persona. Deixe o campo vazio se a imagem não representar um local específico.

As imagens que indicam lugares funcionam como lugares fixados em todos os chats com aquele personagem e aparecem em **Lugares fixados**, em **Configurações do chat → Plano de fundo**. Um lugar fixado no próprio chat tem prioridade sobre uma imagem da galeria com o mesmo nome.

## A biblioteca e o desfoque

As imagens que você escolhe ficam nessa mesma seção **Backgrounds**. A importação, as tags, a renomeação, a exclusão, o controle deslizante **Background Blur** e o plano de fundo padrão dos novos chats de Roleplay estão em [Planos de fundo do chat](../appearance/chat-backgrounds.md).

## Guias relacionados

- [Planos de fundo do chat](../appearance/chat-backgrounds.md): a biblioteca de imagens enviadas e os controles de aparência.
- [Planos de fundo de cena](../media/scene-backgrounds.md): arte de cena feita por IA a partir da galeria.
- [Roleplay Mode: primeiros passos](getting-started.md): o palco do Roleplay, os sprites e o HUD.
