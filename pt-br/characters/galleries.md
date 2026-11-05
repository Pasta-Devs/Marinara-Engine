# Galerias de personagem e de persona

A aba **Gallery** (galeria), nos editores de personagem e de persona, guarda imagens e vídeos presos a um personagem ou a uma persona, e eles continuam lá mesmo se você excluir chats. Use a aba para fichas de referência, variações de roupa e pacotes de imagens importados. Você também pode marcar uma imagem da galeria como emoji ou sticker (figurinha) personalizado.

## A aba Gallery

Todo personagem e toda persona tem a própria aba **Gallery** (ícone de câmera). Abra o personagem no Character Editor (editor de personagem) ou a persona no Persona Editor (editor de persona) e clique em **Gallery**. A galeria de um personagem tem o título **Character Gallery**, e a de uma persona, **Persona Gallery**. As duas funcionam do mesmo jeito.

A galeria tem duas sub-abas:

- **Images** guarda as imagens que você envia.
- **Videos** guarda os vídeos que você envia, mais os vídeos de cena e os trechos de chamada de vídeo ligados a este personagem.

A galeria do próprio chat é outra coisa. Ela guarda as ilustrações de cena e os anexos gerados daquele chat. Deixe lá a arte passageira de cena e aqui a arte definitiva.

### Adicionar imagens

1. Abra a aba **Gallery** e selecione **Images**.
2. Arraste os arquivos de imagem para **Upload Character Images** (enviar imagens do personagem) ou clique nessa caixa para escolher os arquivos. Em uma persona, a caixa mostra **Upload Persona Images**.
3. Espere o upload terminar. As novas imagens aparecem na grade.

Clique em uma imagem para vê-la maior. Cada miniatura tem um controle de download e um de exclusão.

### Adicionar vídeos

1. Abra a aba **Gallery** e selecione **Videos**.
2. Arraste os arquivos de vídeo para **Upload Character Videos** (enviar vídeos do personagem) ou clique nessa caixa para escolher os arquivos. Em uma persona, a caixa mostra **Upload Persona Videos**.
3. Espere o upload terminar.

Os tipos compatíveis são MP4, WebM e MOV. Os vídeos mais recentes aparecem primeiro. Para ver quais vídeos de cena e trechos aparecem para cada personagem, veja [Quais vídeos aparecem na lista](#which-videos-are-listed).

## Marcar uma imagem da galeria como emoji ou sticker personalizado

O emoji personalizado é uma imagem pequena no meio do texto, escrita como `:name:`. O sticker é uma imagem maior, em bloco, escrita como `sticker:name:`. Os dois só funcionam em chats do Conversation Mode, o modo parecido com um aplicativo de mensagens.

1. Abra a aba **Gallery** e selecione **Images**.
2. Clique no pequeno botão de tag no canto superior esquerdo da imagem (dica **Tag as emoji or sticker**).
3. Clique em **Make emoji** ou em **Make sticker**.
4. Na caixa de diálogo **Custom Emoji** ou **Custom Sticker**, digite um nome e confirme.

O nome usa de 1 a 32 letras minúsculas, números e sublinhados. Os outros caracteres são convertidos para você, então "Big Grin" vira `big_grin`.

Se não funcionou: a imagem de um emoji não pode passar de 256 por 256 pixels, e a de um sticker não pode passar de 512 por 512. Se a imagem for grande demais, aparece um erro e nada é marcado.

### Gerenciar uma imagem marcada

Depois que a imagem é marcada, o botão sobreposto mostra o nome. Clique nele para ver mais opções:

- **Rename** muda o nome.
- **Switch to sticker** ou **Switch to emoji** muda o tipo. O limite de tamanho do novo tipo é conferido, então um sticker maior que 256 por 256 pixels não pode virar emoji. Aparece um erro e o tipo continua o mesmo.
- **Remove emoji** ou **Remove sticker** tira a marcação da imagem. A imagem continua na galeria.

Um emoji ou sticker marcado na galeria vale só para aquele personagem ou aquela persona, nos chats do Conversation Mode que o incluem. Isso é separado dos conjuntos globais de emojis e stickers do campo de escrita da mensagem. Se um nome da galeria for igual a um nome global, a versão da galeria prevalece naquele chat. Marinara não verifica se os nomes são únicos, então escolha um nome distinto para cada imagem.

<a id="reuse-a-gallery-image-in-messages-and-greetings"></a>

## Reutilizar uma imagem da galeria em mensagens e saudações

Qualquer imagem da galeria de um personagem pode aparecer dentro do texto do chat: em uma saudação, em uma mensagem de exemplo ou em uma mensagem que o personagem envia. Passe o mouse sobre uma imagem da galeria e clique em **Copy image reference** (o ícone de link). Isso copia um trecho de Markdown para colar onde o personagem fala:

```text
![sunset selfie](card://self/gallery/k3m2xq7.png)
```

`self` significa o personagem que está falando aquela mensagem. Quando a mensagem aparece, Marinara troca `self` por esse personagem e carrega a imagem da galeria dele.

Funciona em:

- **First Message**, **Alternate Greetings** e **Example Dialogue** no card de personagem. A pré-visualização de Markdown do campo mostra a imagem enquanto você edita.
- Qualquer mensagem que um personagem envia, no Roleplay e no modo Conversation.
- Chats em grupo. Em uma resposta com vários falantes, `self` é resolvido para cada falante. Se a galeria do falante não tiver o arquivo, Marinara procura nos outros personagens do chat, na ordem do chat. Se dois personagens tiverem o mesmo nome de arquivo, a imagem do próprio falante prevalece.

Não funciona em:

- **As suas próprias mensagens**. Elas não têm personagem falante, então uma referência `self` aparece como imagem quebrada. Para publicar você mesmo a imagem de um personagem, use a inserção do navegador de recursos do chat, que escreve a forma completa `card://characters/<id>/...`.
- **Mensagens do sistema**. Elas não mostram imagens de Markdown, então a referência aparece como texto.
- **Galerias de persona**. As suas mensagens não têm falante, então use a forma de persona `card://personas/<id>/gallery/<file>`.

Um link completo contém o id interno do personagem, e os ids são gerados de novo quando um personagem é importado, então os links completos quebram para qualquer pessoa com quem você compartilhe o personagem. A forma `self` não contém id. Ela sobrevive a uma exportação e importação **Marinara Native**, porque as imagens da galeria viajam dentro da exportação com os nomes dos arquivos. As exportações **Compatible PNG Card** e **Compatible JSON** não incluem a galeria, então nenhuma referência de galeria funciona depois de um compartilhamento desse jeito. Use **Marinara Native** quando um personagem usar imagens da galeria.

<a id="save-web-images-from-greetings"></a>

### Salvar imagens da web das saudações

Muitos cards mostram imagens de outros sites nas saudações, e esses links podem quebrar. Quando **First Message** ou **Alternate Greetings** mostram imagens da web, **Dialogue & Greetings** tem um botão **Save images locally** (salvar imagens localmente).

1. Abra a aba **Card** e encontre **Dialogue & Greetings**.
2. Clique em **Save images locally**. Marinara baixa as imagens para a galeria e troca cada link por uma referência `card://self/gallery/...`.
3. Clique em **Save** (salvar) para manter os novos links.

Nada é baixado até você clicar no botão. Só são salvas imagens PNG, JPEG, GIF e WebP de até 10 MB e 40 megapixels. Links para o seu próprio computador ou para a sua rede doméstica são recusados. Uma imagem que não pode ser salva mantém o link da web, e um aviso explica o motivo.

**Restore web links** (restaurar links da web) devolve os links originais às saudações. As cópias salvas ficam na galeria até você excluí-las. Imagens de lorebooks não estão incluídas.

<a id="which-videos-are-listed"></a>

## Quais vídeos aparecem na lista

A sub-aba **Videos** lista os vídeos de cena gerados em chats com este personagem e os trechos de chamada de vídeo. O personagem que lista um vídeo depende da origem dele:

- Uma mensagem de vídeo do Conversation aparece na lista dos personagens que ela mostra: o que a enviou e qualquer um que ela cite pelo nome. Basta o primeiro nome quando ninguém mais no chat tem o mesmo, desde que ele esteja escrito com letra maiúscula. Todos do chat entram quando o texto pede uma foto ou selfie em grupo. Nomes entre aspas não contam.
- A galeria da sua persona só lista um trecho quando ele cita a sua persona.
- Os vídeos mais antigos, e os vídeos de chats de Roleplay e Game Mode, aparecem para todos os personagens e para a persona do chat deles.

## Guias relacionados

- [Criando e editando personagens](creating-and-editing-characters.md)
- [Personas](personas.md)
- [Emojis, stickers e GIFs personalizados](../conversation/emoji-stickers-gifs.md)
- [Planos de fundo de cena e a galeria](../media/scene-backgrounds.md)
