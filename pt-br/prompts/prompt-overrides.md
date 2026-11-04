# Prompt Overrides para imagem e vídeo

Os Prompt Overrides (substituições de prompt) são editores dos modelos de prompt que Marinara usa para escrever os prompts dos modelos de imagem e de vídeo. Use um deles para mudar como retratos, selfies, sprites, arte de cena, storyboards ou clipes de vídeo são descritos para o modelo.

Eles não mudam o prompt enviado ao seu modelo de chat. Para isso, use um preset. Veja [Editor de presets e gerenciador de prompts](presets.md) e [Parâmetros de geração](generation-parameters.md).

Um sprite é uma arte do personagem, como uma expressão ou uma pose. Um storyboard é um conjunto de quadros ilustrados de um turno do Game Mode ou de um episódio de Roleplay concluído.

Antes de começar: os Prompt Overrides só importam para os recursos que geram imagens ou vídeos, e esses recursos precisam antes de uma conta de geração de imagens ou de vídeos. Sem ela, o modelo de prompt nunca é usado. Veja [Provedores de geração de imagens e configuração](../media/image-providers.md) e [Geração de vídeo de cena](../media/scene-video.md).

## Encontrar os editores

1. Abra **Settings** (Configurações).
2. Clique na aba **Generations** (gerações).
3. Role até **Prompt Overrides** ("Reusable image and video prompt templates").

Ali ficam dois editores. Clique em um título para expandi-lo.

| Editor | Modelos que ele cobre |
| --- | --- |
| **Video Generation Prompt Overrides** | Vídeos de cena do Game e da galeria, mensagens de vídeo do Conversation, clipes de personagem das chamadas do Conversation, retratos animados de expressão. |
| **Image Generation Prompt Overrides** | Selfies do Conversation, retratos de NPC do Game, arte de cena, prompts de storyboard, o modelo **Noodle Post Image** e outros construtores de imagem. |

## Editar um modelo

1. Abra um editor.
2. Escolha um modelo em **Registered prompt** (prompt registrado). A lista depende do editor.
3. Confira a etiqueta de status ao lado e leia a descrição curta abaixo do menu suspenso.
4. Em **Available variables** (variáveis disponíveis), clique em uma etiqueta de variável para inseri-la. As variáveis têm a forma `${charName}`.
5. Edite o texto na caixa **Template** (modelo).
6. Confira **Rendered preview** (prévia renderizada). A prévia preenche o seu modelo com valores de exemplo.
7. Corrija qualquer aviso **Unknown variables** (variáveis desconhecidas). Um nome que não esteja na lista **Available variables** não é preenchido.
8. Clique em **Save** (salvar).

Aparece "Prompt override saved", e a etiqueta muda para **Custom active**.

| Etiqueta de status | Significado |
| --- | --- |
| **Default** | Nenhum modelo próprio está salvo. |
| **Custom active** | O modelo que você salvou está em uso. |
| **Custom paused** | O modelo está salvo, mas desativado. |

## Manter um modelo sem usá-lo

Desative a opção **Apply this override** (aplicar esta substituição), abaixo da prévia. O texto de ajuda dela diz "Turn this off to keep the template saved without using it." Marinara continua usando o modelo embutido, e a etiqueta mostra **Custom paused**.

## Voltar ao modelo embutido

Clique em **Reset to Default** (restaurar o padrão). Se houver uma substituição salva, Marinara pede que você confirme. A etiqueta volta para **Default**.

## Guias relacionados

- [Provedores de geração de imagens e configuração](../media/image-providers.md)
- [Geração de vídeo de cena](../media/scene-video.md)
- [Perfis de estilo de imagem](../media/style-profiles.md)
- [Configurações do Noodle e transferência para os chats](../agents/noodle-settings.md)
- [Editor de presets e gerenciador de prompts](presets.md)
- [Parâmetros de geração](generation-parameters.md)
