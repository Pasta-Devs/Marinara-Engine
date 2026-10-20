# Prompt Overrides para imagem e vídeo

Este guia explica os **Prompt Overrides** (substituições de prompt), os editores que mudam os modelos de texto que Marinara Engine usa para escrever os prompts de geração de imagens e de vídeos. Aqui você vê onde eles ficam, o que pode ser editado e como salvar um modelo próprio com segurança.

## O que são os Prompt Overrides

Um **Prompt Override** é um modelo de texto reaproveitável para um prompt de mídia. Antes de gerar uma imagem ou um vídeo, Marinara monta um prompt de texto para o modelo de imagem ou de vídeo. Com os Prompt Overrides, você edita esses modelos.

Este recurso trata apenas dos prompts de imagem e de vídeo. Ele não muda o prompt de texto enviado ao modelo de chat durante uma conversa ou um roleplay. Essa confusão é comum. Para mudar o prompt que vai para um modelo de chat, use um preset de prompt e os **Generation Parameters** (parâmetros de geração). Veja [Editor de presets e gerenciador de prompts](presets.md) e [Parâmetros de geração](generation-parameters.md).

Alguns termos usados abaixo:

- Um **sprite** é uma arte do personagem, como uma expressão facial ou uma pose de corpo inteiro.
- Um **storyboard** é um conjunto de quadros ilustrados gerados a partir de um turno do Game Mode ou de um episódio de Roleplay concluído.

## Onde encontrar

Os editores ficam nas configurações do aplicativo.

1. Abra **Settings** (Configurações).
2. Clique na aba **Generations**.
3. Role até a área **Prompt Overrides**, descrita como "Reusable image and video prompt templates."

Dois editores retráteis aparecem ali.

## Os dois editores

Clique no título de um editor para expandi-lo.

O editor **Video Generation Prompt Overrides** cuida dos modelos reaproveitáveis dos vídeos de cena do Game e da galeria, das mensagens de vídeo do Conversation, dos clipes de personagem das chamadas em Conversation e dos retratos animados de expressão. Cada modelo de prompt de vídeo controla como um tipo de clipe é descrito para o modelo de vídeo.

O editor **Image Generation Prompt Overrides** cuida dos modelos usados pelos sistemas de imagem, de sprite, do Game e do construtor de prompts. Isso inclui as selfies de Conversation, os retratos de NPC do Game, a arte de cena, os prompts de storyboard, o modelo **Noodle Post Image** para as publicações do Noodle e os demais construtores de imagem registrados. Cada modelo de prompt de imagem controla como um tipo de figura é descrito para o modelo de imagem.

Ou seja: com os dois editores, você ajusta os prompts de retratos, selfies, sprites, arte de cena, storyboards e clipes de vídeo.

## Editar um modelo

Os dois editores funcionam do mesmo jeito. Siga estes passos:

1. Abra o editor que você quer usar.
2. Escolha um modelo no menu suspenso **Registered prompt**. A lista muda conforme o editor aberto.
3. Confira a etiqueta de status ao lado do menu suspenso. Ela mostra **Default** quando nenhum modelo próprio está salvo. Mostra **Custom active** quando o modelo que você salvou está em uso. Mostra **Custom paused** quando o modelo está salvo, mas desativado.
4. Leia a descrição curta abaixo do menu suspenso para saber o que aquele modelo faz.
5. Em **Available variables**, clique em qualquer etiqueta de variável para inseri-la no modelo. As variáveis usam a forma `${name}`, por exemplo `${charName}`.
6. Edite o texto na caixa **Template**.
7. Confira a caixa **Rendered preview** logo abaixo. A prévia preenche o modelo com valores de exemplo, e assim você vê o resultado.
8. Se a prévia mostrar o aviso **Unknown variables**, corrija a variável escrita errada. Um nome de variável que não esteja na lista **Available variables** não é preenchido.
9. Clique em **Save**.

A mensagem "Prompt override saved" aparece e a etiqueta de status muda para **Custom active**.

## Salvar um modelo sem usá-lo

O botão liga/desliga **Apply this override** fica abaixo da prévia. O texto de ajuda dele diz "Turn this off to keep the template saved without using it." Desative-o para salvar o rascunho enquanto o recurso continua usando o padrão embutido. A etiqueta de status passa a mostrar **Custom paused**.

## Voltar ao modelo embutido

Clique em **Reset to Default** para descartar o modelo próprio e voltar a usar o embutido. Se existir uma substituição salva, o aplicativo pede uma confirmação antes. A etiqueta de status volta para **Default**.

## Quando as substituições entram em ação

Um Prompt Override só tem efeito nos recursos que realmente geram imagens ou vídeos, como os assets do Game, as selfies e chamadas de Conversation, os sprites e as imagens das publicações do Noodle. Esses recursos também precisam de uma conexão de geração de imagens ou de vídeos configurada antes. Sem uma conexão de geração funcionando, nada roda e o modelo nunca é usado. Veja [Provedores de geração de imagens e configuração](../media/image-providers.md) e [Geração de vídeo de cena](../media/scene-video.md).

## Guias relacionados

- [Provedores de geração de imagens e configuração](../media/image-providers.md)
- [Geração de vídeo de cena](../media/scene-video.md)
- [Perfis de estilo de imagem](../media/style-profiles.md)
- [Configurações do Noodle e transferência para os chats](../noodle/settings.md)
- [Editor de presets e gerenciador de prompts](presets.md)
- [Parâmetros de geração](generation-parameters.md)
