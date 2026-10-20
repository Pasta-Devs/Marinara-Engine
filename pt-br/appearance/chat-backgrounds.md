# Planos de fundo do chat

Este guia explica a biblioteca de planos de fundo no Marinara Engine. São imagens que você mesmo envia e escolhe na mão para ficarem atrás do chat. Se o que você quer é o agente **Background**, que escolhe um cenário para cada turno, veja [Planos de fundo do Roleplay](../roleplay/backgrounds.md). Para planos de fundo de cena gerados por IA a partir da galeria, veja [Planos de fundo de cena e a galeria](../media/scene-backgrounds.md).

## Onde encontrar os planos de fundo

Tudo fica em um lugar só: abra **Settings** (Configurações), depois a aba **Appearance** (Aparência) e então a seção **Backgrounds** (planos de fundo).

A seção **Backgrounds** tem três partes:

1. O seletor **Chat Background** (plano de fundo do chat), onde você escolhe a imagem do chat aberto no momento.
2. O controle deslizante **Background Blur** (desfoque do plano de fundo).
3. A biblioteca de planos de fundo, onde você importa, organiza, filtra, marca com tags, renomeia, baixa e exclui imagens.

O plano de fundo do chat só aparece nos chats de Roleplay e Game Mode. O Conversation Mode usa um gradiente, definido na seção **Conversation Theme**. Isso está explicado em [Configurações de aparência](appearance-settings.md).

## A biblioteca de planos de fundo

A biblioteca reúne todas as imagens disponíveis para escolha. Nela ficam juntas as imagens que você enviou e as artes que já vêm com Marinara. Cada imagem traz uma etiqueta pequena para você distinguir uma da outra:

- **Library**: uma imagem enviada por você. Essas podem ser renomeadas, marcadas com tags e excluídas.
- **Game asset**: uma imagem que já vem com Marinara. Essas são somente leitura, ou seja, não podem ser renomeadas, marcadas com tags nem excluídas.

### Importar um plano de fundo

1. Localize a caixa **Import Backgrounds** (importar planos de fundo) no topo da biblioteca.
2. Arraste um ou mais arquivos de imagem para a caixa, ou clique nela para escolher os arquivos.
3. Espere o upload terminar. Durante o processo, a caixa mostra **Importing...**.
4. As imagens novas aparecem na grade abaixo, com a etiqueta **Library**.

Vários arquivos podem ser importados de uma vez. Cada arquivo precisa ser uma imagem em um destes formatos: JPG, PNG, GIF, WebP ou AVIF. O tamanho máximo por arquivo é de 20 MB.

Marinara verifica o conteúdo real de cada arquivo, não só o nome. Se você renomear um arquivo que não é imagem para terminar em `.png`, o upload é recusado.

### Escolher um plano de fundo para o chat atual

1. Abra **Settings**, depois **Appearance** e então **Backgrounds**.
2. Na grade, clique na miniatura que você quiser.
3. Um sinal de confirmação aparece sobre a imagem escolhida. Ela vira o plano de fundo do chat aberto no momento.
4. Para voltar ao padrão, clique de novo na miniatura escolhida ou clique no botão **Remove** ao lado de **Chat Background**.

### Buscar na biblioteca

Use a caixa **Search backgrounds** acima da biblioteca para filtrar por nome, tag ou origem. A linha de contagem mostra quantas imagens correspondem, por exemplo "3 of 20 backgrounds". Clique no X pequeno dentro da caixa de busca para limpá-la.

Use o seletor ao lado da busca para ordenar os planos de fundo por **A-Z**, **Z-A**, **Newest** ou **Oldest**. Selecione **All** para limpar os filtros de tag, ou abra **Tags** e selecione uma ou mais tags. Com várias tags selecionadas, um plano de fundo aparece se tiver qualquer uma delas.

### Organizar os planos de fundo em pastas

As pastas organizam a biblioteca sem mover nem esconder os arquivos de imagem originais.

1. Clique em **New Folder** (nova pasta). Marinara cria uma pasta com nome único.
2. Dê dois cliques ou dois toques no nome da pasta para renomeá-la. Outra opção: coloque o foco nela e pressione F2.
3. No computador, arraste a linha de um plano de fundo para dentro de uma pasta. No celular ou tablet, mantenha a linha pressionada e depois arraste-a.
4. Arraste o plano de fundo de volta para a área sem pasta e ele sai da pasta atual.

Marinara salva as pastas e as atribuições no servidor e as inclui nos backups. Ao excluir uma pasta, os planos de fundo dela voltam para a lista sem pasta; as imagens continuam onde estavam. Os filtros de busca e de tag mostram automaticamente os itens correspondentes que estão dentro das pastas.

O agente **Background** continua enxergando todos os planos de fundo disponíveis, inclusive os que estão em pastas. As pastas mudam apenas a organização dentro de **Settings**.

### Renomear um plano de fundo

Só é possível renomear imagens com a etiqueta **Library**.

1. Passe o mouse sobre a linha da imagem e clique no ícone de lápis (**Rename**).
2. Digite o nome novo. Não precisa digitar a extensão do arquivo.
3. Clique em **Save**.

### Marcar um plano de fundo com tags

As tags ajudam a agrupar e a buscar as imagens que você enviou. Só é possível marcar imagens com a etiqueta **Library**.

1. Clique no ícone de tag (**Edit tags**) na linha da imagem.
2. Digite uma tag no campo **Add tag...**. Conforme você digita, Marinara sugere tags já usadas antes.
3. Pressione Enter ou clique em **Add**.
4. Para tirar uma tag, clique nela. Enquanto a edição de tags está aberta, cada tag aparece como um botão com um X.

<a id="download-a-background"></a>

### Baixar um plano de fundo

Você pode baixar qualquer plano de fundo, inclusive os que já vêm com Marinara. Passe o mouse sobre a linha da imagem e clique no ícone de download (**Download background**). A imagem é salva com o próprio nome de arquivo. No iPhone ou iPad, a folha de compartilhamento se abre para você salvar a imagem; se ela não abrir, toque em **Save file** (salvar arquivo) na mensagem que aparece.

### Excluir um plano de fundo

Só é possível excluir imagens com a etiqueta **Library**. Passe o mouse sobre a linha da imagem, clique no ícone de lixeira e confirme a exclusão. Se a imagem era o plano de fundo do chat atual ou o plano de fundo padrão do Roleplay, Marinara volta sozinha para o plano de fundo padrão que já vem com Marinara.

## Definir um plano de fundo padrão para o Roleplay

O plano de fundo padrão do Roleplay é a imagem com que todo chat novo de Roleplay começa, antes de escolher a própria. Basta definir uma vez e todo chat novo de Roleplay passa a usá-la.

1. Na seção **Backgrounds**, localize a imagem que você quer na grade.
2. Clique no ícone de alfinete (**Set as default for new Roleplay chats**) na linha dessa imagem.
3. O botão de alfinete continua destacado, e a etiqueta **Default** (padrão) aparece na miniatura. A partir daí, os chats novos de Roleplay começam com ela.

A estrela no canto superior esquerdo da imagem a adiciona aos favoritos. Ela não muda o padrão.

Para voltar atrás, clique no alfinete da imagem que está como padrão. Outra opção: clique no botão **Reset Roleplay default** perto do topo da grade. Esse botão só aparece quando o plano de fundo padrão é diferente do que já vem com Marinara.

## Background Blur

O **Background Blur** deixa a imagem de fundo mais suave atrás do chat, o que facilita a leitura do texto. Vale para os planos de fundo de Roleplay e de Game Mode.

1. Na seção **Backgrounds**, localize o controle deslizante **Background Blur**.
2. Arraste-o entre 0 e 24. Quanto maior o número, maior o desfoque.
3. Deixe em 0 para manter os planos de fundo nítidos. Em 0, o valor aparece como **Off**.

O padrão é 0 (**Off**).

## Como suas imagens e as que já vêm com Marinara se misturam

A biblioteca mostra na mesma grade as imagens que você enviou e as imagens **Game asset** que já vêm com Marinara. A escolha funciona igual nos dois casos. A diferença é que as imagens **Game asset** são somente leitura, então os controles de renomear, marcar com tags e excluir não aparecem nelas.

Os planos de fundo de cena gerados por IA que você cria a partir da galeria também vão parar nessa mesma biblioteca, prontos para reutilizar depois. Veja [Planos de fundo de cena e a galeria](../media/scene-backgrounds.md).

## Onde suas escolhas de plano de fundo ficam salvas

Três configurações diferentes decidem qual plano de fundo um chat mostra, e cada uma é salva de um jeito:

- Marinara salva o **Chat Background** escolhido junto com aquele chat, no servidor. Ele acompanha o chat em qualquer dispositivo onde você o abrir.
- As pastas de planos de fundo e suas atribuições ficam salvas no servidor e acompanham a biblioteca em outros dispositivos.
- O plano de fundo padrão do Roleplay e o **Background Blur** ficam salvos por dispositivo. Eles não sincronizam entre navegadores nem entre dispositivos. O modelo completo de sincronização está em [Configurações de aparência](appearance-settings.md).

## Planos de fundo automáticos e gerados por IA

Este guia trata da biblioteca em que você escolhe na mão. Dois recursos relacionados cuidam do plano de fundo por você:

- O agente **Background** consegue escolher sozinho um cenário da biblioteca, turno a turno, nos chats de Roleplay. Veja [Planos de fundo do Roleplay](../roleplay/backgrounds.md).
- A galeria consegue gerar com IA um plano de fundo de cena inédito a partir da cena atual. Veja [Planos de fundo de cena e a galeria](../media/scene-backgrounds.md).

## Guias relacionados

- [Planos de fundo do Roleplay](../roleplay/backgrounds.md): o agente Background, que escolhe um cenário sozinho a cada turno.
- [Planos de fundo de cena e a galeria](../media/scene-backgrounds.md): planos de fundo de cena gerados por IA a partir da galeria.
- [Configurações de aparência](appearance-settings.md): a aba Appearance inteira, incluindo quais configurações sincronizam e quais ficam em um dispositivo só.
