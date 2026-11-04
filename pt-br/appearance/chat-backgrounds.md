# Planos de fundo do chat

A biblioteca de planos de fundo guarda as imagens que você envia e escolhe na mão para ficarem atrás do chat. Para o agente **Background**, que escolhe um cenário para você a cada turno, veja [Planos de fundo do Roleplay](../roleplay/backgrounds.md). Para planos de fundo gerados por IA a partir da galeria, veja [Planos de fundo de cena e a galeria](../media/scene-backgrounds.md).

O plano de fundo do chat aparece em todos os modos de chat. Nos chats de Conversation, o gradiente do **Conversation Theme** (tema do Conversation) fica por cima da imagem, e **Conversation background image opacity** (opacidade da imagem de fundo no Conversation) define com que intensidade a imagem aparece. Veja [Configurações de aparência](appearance-settings.md).

## Como mudar o plano de fundo de um chat

Antes de começar: abra o chat que você quer mudar. O plano de fundo escolhido vale para esse chat.

1. Abra **Settings** (Configurações), depois **Appearance** (Aparência) e então o botão **App**.
2. Em **Backgrounds** (planos de fundo), toque em **Browse library** (navegar pela biblioteca).
3. Toque em uma imagem. Ela vira o plano de fundo deste chat, e a janela se fecha.

Para usar uma imagem sua, importe-a primeiro (veja [Importar um plano de fundo](#import-a-background)).

## Onde encontrar os planos de fundo

1. Abra **Settings**.
2. Escolha a aba **Appearance** e depois o botão **App**.
3. Localize a seção **Backgrounds**.

Ela tem o seletor **Chat Background** (plano de fundo do chat), o controle deslizante **Background Blur** (desfoque do plano de fundo) e os controles **Conversation background image opacity** e **Chat List Backgrounds** (veja [Configurações de aparência](appearance-settings.md)).

O seletor mostra uma prévia do plano de fundo atual, ou **Default background** (plano de fundo padrão) quando nenhum foi escolhido. Abaixo dele, até três planos de fundo **Recent** (recentes) ficam a um toque de distância. Clique em **Browse library** para abrir a janela **Background Library** (biblioteca de planos de fundo).

## A biblioteca de planos de fundo

A biblioteca mistura as imagens que você enviou com as artes que já vêm com Marinara. Cada imagem tem uma etiqueta.

| Etiqueta | Significado |
| --- | --- |
| **My upload** | Uma imagem que você enviou. Você pode renomear, marcar com tags e excluir. |
| **Game asset** | Arte embutida. É somente leitura: não dá para renomear, marcar com tags nem excluir. |

Os botões **All sources**, **My uploads** e **Game assets**, de **Filter by source** (filtrar por origem), mostram quantas imagens cada um reúne.

<a id="import-a-background"></a>

### Importar um plano de fundo

1. Na janela **Background Library**, localize **Import Backgrounds** (importar planos de fundo) ao lado da caixa de busca.
2. Toque ou clique nele e escolha os arquivos de imagem. Você pode escolher vários de uma vez. No computador, também dá para soltar os arquivos sobre ele.
3. Espere. Ele mostra **Importing…** enquanto trabalha.

As imagens novas aparecem na grade com a etiqueta **My upload**.

Cada arquivo precisa ser JPG, PNG, GIF, WebP ou AVIF, com até 20 MB. Marinara verifica o que há dentro do arquivo, não o nome dele. Um arquivo que não é imagem renomeado para `.png` é recusado.

### Escolher um plano de fundo para o chat atual

1. Abra **Browse library**.
2. Clique em uma miniatura. Aparece um sinal de confirmação, a imagem vira o plano de fundo deste chat e a janela se fecha.
3. Para voltar ao padrão, clique de novo na miniatura escolhida ou clique no X (**Clear selection**) da prévia.

### Buscar e filtrar

- **Search backgrounds** (buscar planos de fundo) filtra por nome, tag ou origem. Uma linha de contagem mostra quantas imagens correspondem, por exemplo "3 of 20 backgrounds". Clique no X dentro da caixa para limpá-la.
- **Sort backgrounds** (ordenar planos de fundo) oferece **Manual order**, **A-Z**, **Z-A**, **Newest** e **Oldest**. Com **Manual order** (ordem manual), arraste para reordenar, ou pressione <kbd>Alt</kbd>+<kbd>Up</kbd> ou <kbd>Alt</kbd>+<kbd>Down</kbd> com uma imagem em foco.
- Os chips de pasta **All folders**, **Favorites** e **Unfiled** (sem pasta), mais um chip para cada pasta, filtram por pasta.
- Em tags, **All** limpa os filtros de tag. Abra **Tags** e escolha uma ou mais tags. Uma imagem corresponde se tiver qualquer uma das tags escolhidas.

Clique na estrela de uma imagem para adicioná-la aos favoritos. Isso não muda o plano de fundo padrão.

### Organizar os planos de fundo em pastas

As pastas organizam a biblioteca sem mover nem esconder os arquivos de imagem.

1. Clique em **New Folder** (nova pasta), digite um nome e clique em **Add** (adicionar).
2. Toque no botão **Move to folder** (mover para a pasta) de uma imagem e escolha a pasta. Ou arraste a imagem para o chip de uma pasta. No celular ou tablet, mantenha a imagem pressionada e depois arraste.
3. Para trazer uma imagem de volta, arraste-a para **Unfiled**.
4. Selecione o chip de uma pasta para mostrar os botões de lápis (**Rename folder**) e de lixeira (**Delete folder**).

Excluir uma pasta devolve as imagens dela para **Unfiled** e não as exclui. As pastas ficam salvas no servidor e entram nos backups. O agente **Background** continua vendo todos os planos de fundo, inclusive os que estão em pastas.

### Renomear um plano de fundo

Só as imagens **My upload** podem ser renomeadas.

1. Clique no lápis (**Rename background**) da imagem.
2. Digite o nome novo. Não precisa da extensão do arquivo.
3. Clique em **Save** (salvar).

### Marcar um plano de fundo com tags

Só as imagens **My upload** podem receber tags.

1. Clique no ícone de tag (**Edit tags**) da imagem.
2. Digite uma tag em **Add tag…**. Marinara sugere as tags que você já usou.
3. Pressione <kbd>Enter</kbd> ou clique em **Add**.

Para tirar uma tag, clique nela durante a edição de tags.

<a id="download-a-background"></a>

### Baixar um plano de fundo

Clique no ícone de download (**Download background**) de qualquer imagem, inclusive as embutidas. No iPhone ou iPad, a folha de compartilhamento se abre. Se ela não abrir, toque em **Save file** (salvar arquivo) na mensagem que aparece.

### Excluir um plano de fundo

Só as imagens **My upload** podem ser excluídas.

1. Clique no ícone de lixeira (**Delete background**) da imagem.
2. Confirme.

Se ela era o plano de fundo do chat atual ou o plano de fundo padrão do Roleplay, Marinara volta para o padrão embutido.

## Definir um plano de fundo padrão para o Roleplay

O plano de fundo padrão do Roleplay é a imagem com que todo chat novo de Roleplay começa.

1. Na janela **Background Library**, localize a imagem.
2. Clique no ícone de alfinete dela (**Set as default for new Roleplay chats**).

A miniatura mostra a etiqueta **Default** (padrão). Para desfazer, clique de novo no alfinete dessa imagem, ou clique em **Reset Roleplay default** acima da grade. Esse botão só aparece quando o seu padrão é diferente do embutido.

## Background Blur

O **Background Blur** suaviza o plano de fundo atrás do chat, o que facilita a leitura do texto. Vale para os planos de fundo em todos os modos de chat.

1. Na seção **Backgrounds**, localize o controle deslizante **Background Blur**.
2. Arraste-o entre 0 e 24. Quanto maior o número, maior o desfoque.

Em 0, o valor aparece como **Off**, e os planos de fundo ficam nítidos. O padrão é 0.

## Onde suas escolhas de plano de fundo ficam salvas

| Configuração | Onde fica salva |
| --- | --- |
| O **Chat Background** de um chat | Com aquele chat, no servidor. Ele acompanha o chat em qualquer dispositivo. |
| As pastas e as atribuições delas | No servidor, junto com a biblioteca. |
| O plano de fundo padrão do Roleplay e o **Background Blur** | Por dispositivo. Eles não sincronizam entre navegadores nem entre dispositivos. |

Para o modelo completo de sincronização, veja [Configurações de aparência](appearance-settings.md).

## Guias relacionados

- [Planos de fundo do Roleplay](../roleplay/backgrounds.md): o agente Background, que escolhe um cenário a cada turno.
- [Planos de fundo de cena e a galeria](../media/scene-backgrounds.md): planos de fundo de cena gerados por IA a partir da galeria. Eles também vão parar nesta biblioteca.
- [Configurações de aparência](appearance-settings.md): a aba Appearance inteira.
