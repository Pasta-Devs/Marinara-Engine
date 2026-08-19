# Galerias de personagem e de persona

Este guia explica a aba **Gallery** (galeria) dentro dos editores de personagem e de persona. Aqui você vê como adicionar imagens e vídeos que ficam presos a um personagem ou a uma persona (o personagem que você interpreta). O guia também mostra como marcar uma imagem da galeria como emoji ou sticker (figurinha) personalizado.

## A aba Gallery

Todo personagem e toda persona tem a própria aba **Gallery**. Abra um personagem no **Character Editor** (editor de personagem), ou uma persona no **Persona Editor** (editor de persona), e clique na aba **Gallery** (ícone de câmera).

A galeria tem duas sub-abas:

- **Images**: as imagens que você envia para esse personagem ou persona.
- **Videos**: os vídeos que você envia, mais os vídeos de cena e os trechos de chamada de vídeo ligados a esse personagem.

A galeria de um personagem se chama **Character Gallery**. A de uma persona se chama **Persona Gallery**. As duas funcionam igual.

## Como a galeria se diferencia da galeria de um chat

As imagens da galeria pertencem ao personagem ou à persona, não a um chat específico. Se você excluir um chat, essas imagens continuam lá. Use a galeria para fichas de referência, variações de roupa ou pacotes de imagens importados junto com o personagem.

A galeria do chat é outra coisa. Ela guarda as ilustrações daquela cena e os anexos gerados nas mensagens, tudo restrito àquele chat. Deixe a arte passageira de cena na galeria do chat. Deixe a arte definitiva do personagem na aba **Gallery** do personagem ou da persona.

## Adicionar imagens

1. Abra o editor de personagem ou de persona.
2. Clique na aba **Gallery**.
3. Verifique se a sub-aba **Images** está selecionada.
4. Arraste os arquivos de imagem para a caixa **Upload Character Images** (enviar imagens do personagem), ou clique nela para escolher os arquivos. Em uma persona, essa caixa se chama **Upload Persona Images**.
5. Espere o upload terminar. As novas imagens aparecem na grade abaixo.

Os tipos de imagem mais comuns funcionam, como JPG, PNG, GIF, WebP e AVIF. Clique em qualquer imagem para vê-la em tamanho maior. Cada miniatura também tem um controle de download e um de exclusão.

## Adicionar vídeos

1. Clique na aba **Gallery**.
2. Selecione a sub-aba **Videos**.
3. Arraste os arquivos de vídeo para a caixa **Upload Character Videos** (enviar vídeos do personagem), ou clique nela para escolher os arquivos. Em uma persona, essa caixa se chama **Upload Persona Videos**.
4. Espere o upload terminar.

Os tipos de vídeo compatíveis são MP4, WebM e MOV. A sub-aba **Videos** também lista os vídeos de cena gerados em chats com esse personagem, além dos trechos de chamada de vídeo. A ordem começa pelos mais recentes.

## Marcar uma imagem da galeria como emoji ou sticker personalizado

Uma imagem da galeria pode virar um emoji ou um sticker personalizado no **Conversation Mode** (o modo de chat parecido com um mensageiro). O emoji personalizado é uma imagem pequena, escrita no meio do texto como `:name:`. O sticker é uma imagem maior, em bloco, escrita como `sticker:name:`. Os dois só funcionam em chats do Conversation Mode.

Para marcar uma imagem:

1. Abra a aba **Gallery** e selecione a sub-aba **Images**.
2. Encontre a imagem desejada. No canto superior esquerdo dela fica um pequeno botão de tag, com a dica **Tag as emoji or sticker**.
3. Clique no botão de tag. Abre um menu com **Make emoji** e **Make sticker**.
4. Clique em **Make emoji** ou em **Make sticker**.
5. Na caixa de diálogo **Custom Emoji** ou **Custom Sticker**, digite um nome e confirme.

O nome aceita letras minúsculas, números e sublinhados, até 32 caracteres. Marinara converte os outros caracteres para você. Por exemplo, "Big Grin" vira `big_grin`.

Os limites de tamanho dependem do tipo escolhido, não da galeria. A imagem de emoji não pode passar de 256 por 256 pixels. A de sticker não pode passar de 512 por 512 pixels. Se a imagem for grande demais, aparece uma mensagem de erro e a marcação não é aplicada.

### Gerenciar uma imagem marcada

Depois que a imagem é marcada, o botão sobreposto mostra o nome atribuído. Clique nele para abrir um menu com mais opções:

- **Rename**: mudar o nome.
- **Switch to sticker** ou **Switch to emoji**: mudar o tipo. A troca confere de novo o limite de tamanho do novo tipo. Uma imagem de sticker maior que 256 por 256 pixels é grande demais para virar emoji. Nesse caso, aparece um erro e o tipo continua o mesmo.
- **Remove emoji** ou **Remove sticker**: tirar a marcação da imagem. Isso não exclui a imagem da galeria.

### Onde esses emojis e stickers valem

O emoji ou sticker marcado na galeria vale só para aquele personagem ou aquela persona. Ele funciona apenas em chats do Conversation Mode que incluem esse personagem ou essa persona. É algo separado dos conjuntos globais de emojis e stickers, que ficam no campo de escrita da mensagem.

Se um nome da galeria for igual a um nome do conjunto global, a versão da galeria prevalece naquele chat. Marinara não verifica se os nomes são únicos. Escolha um nome distinto para cada imagem e evite surpresas.

## Reutilizar uma imagem da galeria em mensagens e saudações

Qualquer imagem da galeria de um personagem pode aparecer dentro do texto do chat: em uma saudação, mensagem de exemplo ou mensagem enviada pelo personagem. Passe o ponteiro sobre a imagem e clique em **Copy image reference** (o ícone de link). Isso copia um pequeno trecho de Markdown que pode ser colado onde o personagem fala:

```text
![sunset selfie](card://self/gallery/k3m2xq7.png)
```

Existe uma única regra: **`self` significa o personagem que está falando aquela mensagem.** Ao renderizar, o Marinara substitui `self` pelo personagem e mostra a imagem de sua galeria.

Isso funciona em **First Message**, **Alternate Greetings** e **Example Dialogue** no cartão, em qualquer mensagem enviada por personagem tanto em Roleplay quanto em Conversation e em chats em grupo. Em uma resposta com vários falantes, `self` é resolvido separadamente para cada um. Se a galeria do falante não tiver o arquivo, o Marinara procura nas galerias dos outros personagens do chat.

Por design, não funciona nas suas próprias mensagens, que não têm personagem falante, nem em mensagens do sistema, que não renderizam imagens Markdown. Para publicar uma imagem você mesmo, use o navegador de recursos do chat, que escreve a forma completa `card://characters/<id>/...`. Galerias de persona usam `card://personas/<id>/gallery/<file>`.

Se dois personagens tiverem imagens com o mesmo nome de arquivo, a imagem do falante sempre prevalece. Quando ele não possui o arquivo, a primeira correspondência na ordem de personagens do chat é usada. Dê nomes distintos quando precisar de uma versão específica.

### Por que usar `self` em vez do link completo

Um link completo contém o id interno do personagem (`card://characters/<id>/gallery/<file>`), e o id é gerado de novo a cada importação; por isso o link quebra ao compartilhar o personagem. A forma `self` não contém id nem endereço do servidor. Ela sobrevive a uma **exportação e importação JSON nativa**: as imagens viajam na exportação e mantêm os nomes dos arquivos.

Há uma limitação: **as exportações de cartão PNG não incluem a galeria**. Compartilhe a exportação `.json` nativa quando o personagem usar referências de galeria.

## Guias relacionados

- [Criando e editando personagens](creating-and-editing-characters.md)
- [Personas do usuário: criar e editar](personas.md)
- [Emojis personalizados, stickers e GIFs](../conversation/emoji-stickers-gifs.md)
- [Planos de fundo de cena e a galeria](../media/scene-backgrounds.md)
