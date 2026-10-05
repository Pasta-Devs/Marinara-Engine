# Recursos do jogo: música, som, sprites e planos de fundo

Este guia explica a biblioteca de recursos que Game Mode usa para música, som, arte dos personagens e planos de fundo das cenas. Aqui você vê o conjunto inicial que já vem instalado, o gerenciador de arquivos **Asset Browser** (navegador de recursos), como enviar os próprios arquivos e como escolher quais recursos cada jogo pode usar.

## O que são os recursos do jogo

Recursos do jogo são os arquivos de mídia que Game Mode toca e mostra durante a sessão. Marinara Engine organiza tudo em cinco categorias:

- **Music**: trilhas de música de fundo que mudam conforme a cena.
- **Ambient**: sons de ambiente em loop, como natureza, cidade ou interiores.
- **Sound Effects** (também chamados de SFX): sons curtos para menus, combate e exploração.
- **Sprites**: arte de personagens e objetos mostrada na tela.
- **Backgrounds**: imagens de cena exibidas atrás da história.

Game Mode lê essa biblioteca sozinho. A música, o som ambiente e os planos de fundo são escolhidos automaticamente de acordo com a cena, então você não precisa atribuir recursos na mão durante o jogo.

## O conjunto inicial que já vem instalado

Marinara instala uma biblioteca inicial gratuita na primeira vez que o servidor sobe. Nas próximas inicializações, esses arquivos são atualizados se o conjunto instalado mudar. O conjunto inicial traz:

- Cinco trilhas de **Music**, uma para cada clima de cena.
- Um conjunto de loops de **Ambient** nas pastas de natureza, cidade e interiores.
- **Sound Effects** para menus, combate e exploração.

Nenhum arquivo de **Backgrounds** vem instalado. As pastas de plano de fundo começam vazias. Elas só se enchem quando você envia imagens ou quando Game Mode gera a arte da cena.
Nenhum **Sprites** de personagem vem instalado. Adicione apenas a arte que combina com os seus jogos.

Todos os arquivos instalados têm licença CC0, ou seja, estão em domínio público e podem ser usados livremente. Os créditos completos de cada arquivo ficam em um arquivo de texto `CREDITS.md`, que acompanha os recursos no disco. Ele não aparece dentro do aplicativo.

Os arquivos e as pastas que já vêm instalados são protegidos. Você não consegue excluir nem mover esses itens pelo **Asset Browser**, e assim a biblioteca inicial fica intacta. Renomear e copiar continua sendo possível.

## Como abrir o Asset Browser

O **Asset Browser** é um gerenciador de arquivos para os recursos do jogo. Ele abre de duas maneiras.

Pelo painel **Settings** (Configurações):

1. Abra **Settings**.
2. Vá para a aba **Imports**.
3. Localize a seção **Game Assets**.
4. Clique no botão **Asset Browser**.

De dentro de um jogo:

1. Abra um chat em Game Mode.
2. Clique ou toque no botão **Game Assets** (a pasta), que começa no canto superior direito do chat. Você pode arrastá-lo no computador ou no celular.

O botão só aparece no Game Mode. Ele abre **Game Assets**, que contém o **Asset Browser**: uma janela móvel no computador ou um painel de largura total no celular.

Se você usou **Put back in Chat Settings**, abra a seção **Game Assets** dentro de Chat Settings.

A barra de ferramentas no topo tem uma trilha de navegação que começa em **Game Assets**. Ao lado dela ficam o botão liga/desliga entre **Grid view** e **List view**, um botão **Upload** e um botão **New**. Há também um botão **Rescan**, um botão **Open in system folder** e uma caixa **Search in folder**. Em telas mais largas, uma árvore de pastas à esquerda permite pular de uma categoria para outra.

## Como enviar os seus próprios recursos

Existem duas formas de enviar recursos. Use a que for mais prática para você.

### Envio pelo Asset Browser

1. Abra o **Asset Browser**.
2. Entre em uma das cinco pastas de categoria, ou em uma subpasta dentro dela.
3. Clique em **Upload** e escolha os arquivos, ou arraste os arquivos para a área de arquivos.

É preciso estar dentro de uma pasta de categoria antes. Se você soltar arquivos no nível mais alto, o aplicativo pede que você abra uma pasta de categoria antes de enviar.

### Envio pelo painel Settings

1. Abra **Settings** e vá para a aba **Imports**.
2. Localize a seção **Game Assets**.
3. Escolha uma categoria no menu **Type**: **Music**, **Ambient**, **Sound Effects**, **Sprites** ou **Backgrounds**.
4. Defina o destino na caixa **Folder**, ou mantenha o padrão sugerido.
5. Clique em **Choose Files** e selecione os arquivos.
6. Clique em **Upload to Server**.

Cada opção de **Type** preenche a caixa **Folder** com um padrão sensato. Os padrões são:

- **Music**: `exploration/fantasy/calm`
- **Ambient**: `nature`
- **Sound Effects**: `exploration`
- **Sprites**: `generic-fantasy`
- **Backgrounds**: `custom`

### Regras de tipo e tamanho de arquivo

O servidor confere cada envio de acordo com estas regras, válidas para os dois caminhos de envio.

| Categoria                     | Tipos de arquivo aceitos             |
| ----------------------------- | ------------------------------------ |
| Music, Ambient, Sound Effects | MP3, OGG, WAV, FLAC, M4A, AAC, WebM  |
| Sprites                       | PNG, JPG, JPEG, GIF, WebP, AVIF, SVG |
| Backgrounds                   | PNG, JPG, JPEG, GIF, WebP, AVIF      |

Arquivos de áudio e de imagem podem ter até 50 MB cada um. Arquivos de texto podem ter até 10 MB. O servidor recusa os tipos de arquivo que não combinam com a categoria. A mensagem de erro lista os tipos aceitos.

### A regra da pasta de música

A música tem uma organização de pastas rígida. Cada trilha precisa ficar em um caminho de três níveis, no formato `state/genre/intensity` – por exemplo, `exploration/fantasy/calm`. Se o caminho não bater, o envio falha.

Os valores permitidos são:

- Estado: `exploration`, `dialogue`, `combat`, `travel_rest`.
- Gênero: `fantasy`, `horror`, `romance`, `mystery`, `scifi`, `modern`, `slice_of_life`, `adventure`, `drama`, `custom`.
- Intensidade: `calm`, `tense`, `intense`.

É por essa organização que Game Mode sabe a hora de tocar cada trilha. As pastas de ambiente, efeito sonoro, sprite e plano de fundo não seguem essa regra. Nelas, você nomeia as subpastas como quiser.

## Como organizar os recursos

O **Asset Browser** ajuda a manter os arquivos em ordem. No computador, clique com o botão direito em um arquivo ou pasta, ou use o menu "..." do item, para ver as ações disponíveis.

Ações sobre um arquivo:

- **Rename**: dá um novo nome ao arquivo. A renomeação falha se o nome já estiver em uso naquela pasta.
- **Move** e **Copy**: enviam o arquivo para outra pasta por um seletor de pastas.
- **Delete**: remove o arquivo.
- **Download**: salva o arquivo no seu dispositivo.

Ações sobre uma pasta:

- **Create subfolder**: cria uma pasta dentro dela.
- **Open in system folder**: mostra a pasta no gerenciador de arquivos do computador.
- **Delete folder**: remove a pasta. Se ainda houver arquivos dentro, primeiro marque a caixa de seleção **Delete everything inside**.

O botão **New** na barra de ferramentas também cria itens na pasta atual. Ele oferece **New folder**, **New text file** e **New markdown file**.

Para agir sobre vários arquivos de uma vez, use as caixas de seleção de cada arquivo. Uma barra mostra quantos arquivos foram selecionados, com os botões **Select all**, **Move**, **Copy** e **Delete**. Pastas grandes mostram só parte do conteúdo por vez, com um botão **Load more**.

Cada pasta pode guardar uma nota curta. Clique no texto de descrição da pasta, ou na dica **Add description...**, para escrever uma. As cinco pastas de categoria têm descrições fixas, que não podem ser alteradas.

Lembre-se de que os arquivos iniciais instalados são protegidos. Você pode renomeá-los ou copiá-los, mas não pode movê-los nem excluí-los.

## Nova varredura depois de mudanças feitas por fora

Marinara mantém uma lista interna dos recursos para que Game Mode os encontre rápido. Quando o envio é feito pelo aplicativo, essa lista se atualiza sozinha.

Se você copiar arquivos para a pasta de recursos do jogo direto no computador, por fora do aplicativo, ele não percebe na hora. Clique no botão **Rescan** para que a pasta seja lida de novo e os arquivos novos entrem na lista. O botão **Rescan** fica tanto na barra de ferramentas do **Asset Browser** quanto na seção **Game Assets**, dentro do painel **Settings**.

## Como escolher os recursos que um jogo pode usar

Cada chat em Game Mode pode se limitar a apenas algumas das suas pastas de recursos. Isso é útil quando você quer, por exemplo, que um jogo de terror ignore as músicas alegres.

Durante a configuração, abra **Adjust Game Assets for this Game** na etapa **Features**. Em um jogo que já existe, abra a janela **Game Assets** do jogo.

Depois:

1. Clique no botão **Game assets**. Enquanto está ativo, ele passa a mostrar **Selecting**.
2. Use o pequeno controle de status de cada pasta para incluí-la ou excluí-la.

Uma barra mostra "All folders included" ou quantas pastas ficaram de fora, com um botão **Reset to all** para incluir tudo de novo. Essa escolha vale só para aquele chat. Ela muda de quais pastas Game Mode pode escolher, mas não exclui nem esconde nenhum arquivo. Fora daquele chat em Game Mode, não tem nenhum efeito.

## Pasta de música personalizada do Music DJ

**Music DJ** é um agente auxiliar que toca música durante o jogo. No modo Custom, ele toca as trilhas de uma pasta escolhida por você. Essa pasta pode ser definida em dois lugares.

Ao ativar **Music DJ** para um chat, o formulário de configuração segue a origem salva no agente Music DJ. A opção **Game Assets** mostra um caminho dentro dos recursos do jogo, como `music` ou `music/combat`. A opção **Folder on this device** mostra o caminho salvo no dispositivo do servidor e um botão **Choose Folder**.

O editor completo do **Music DJ** tem uma seção **Custom Music Library**. O botão liga/desliga **Use Game Assets music folder** dela alterna entre dois modos:

- Ligado: o campo **Game Assets music folder** lê uma pasta dentro dos recursos do jogo, como `music` ou `music/combat`. O botão **Open Folder** abre essa pasta na máquina do servidor.
- Desligado: o campo **Music folder on this device** deixa o modo Custom tocar música de qualquer pasta do computador que roda o servidor. Clique em **Select Folder** para abrir um seletor de pastas do sistema, ou cole o caminho da pasta na caixa.

Escolher uma pasta fora do aplicativo exige acesso privilegiado. No mesmo computador do servidor, funciona sem configuração extra. De outro dispositivo ou por acesso remoto, primeiro é preciso configurar o acesso de administrador. Veja [Acesso remoto](../REMOTE_ACCESS.md) para saber como ativar. Para todo o resto sobre o tocador de música, veja [Music DJ](../media/music.md).

## Como abrir a pasta no seu computador

O botão **Open in system folder** abre a pasta de recursos selecionada no gerenciador de arquivos comum do computador. Isso só funciona quando você usa o aplicativo no mesmo computador que roda o servidor. No celular, no tablet ou em outro computador, o aplicativo avisa que pastas do sistema só abrem no dispositivo que hospeda Marinara.

## Guias relacionados

- [Music DJ: Spotify, YouTube e músicas locais](../media/music.md)
- [Game Mode: primeiros passos](getting-started.md)
- [Acesso remoto: Basic Auth e lista de IPs permitidos](../REMOTE_ACCESS.md)
