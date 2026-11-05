# Recursos do jogo: música, som, sprites e planos de fundo

Os recursos do jogo são os arquivos de mídia que o Game Mode toca e mostra: música, som, arte de personagens e planos de fundo de cena. Este guia mostra como usar o conjunto inicial, enviar os seus próprios arquivos no **Asset Browser** (navegador de recursos), limitar os recursos que um jogo pode usar e gerar efeitos sonoros e música.

O Game Mode lê a biblioteca sozinho. Ele escolhe a música, o som ambiente e os planos de fundo a partir da cena, então você não atribui recursos à mão durante o jogo.

| Categoria | O que é |
| --- | --- |
| **Music** | Trilhas de fundo que mudam com a cena. |
| **Ambient** | Som de ambiente em loop, como áudio de natureza, de cidade ou de interiores. |
| **Sound Effects** (SFX) | Sons curtos para menus, combate e exploração. |
| **Sprites** | Arte de personagens e objetos mostrada na tela. |
| **Backgrounds** | Imagens de cena mostradas atrás da história. |

## O conjunto inicial

Marinara instala uma biblioteca inicial gratuita na primeira vez que o servidor inicia e a atualiza nas inicializações seguintes se o conjunto incluído mudar. Ela traz:

- Cinco trilhas de **Music**, para climas de cena diferentes.
- Loops de **Ambient** nas pastas `nature`, `urban` e `interior`.
- **Sound Effects** para menus, combate e exploração.

As pastas **Backgrounds** e **Sprites** do Asset Browser começam vazias. Nenhum sprite de personagem vem incluído, então adicione a arte que combina com os seus próprios jogos. Para os planos de fundo, o Game Mode também recorre à biblioteca de planos de fundo do próprio aplicativo. Em uma instalação nova, ela tem 13 imagens iniciais e mais um `Black.jpg` simples, e os jogos podem usá-las sem nenhum envio. Se essa pasta já tinha imagens, só o `Black.jpg` é restaurado. A arte de cena gerada e os seus envios se somam a elas.

Todo o áudio incluído tem licença CC0 (domínio público, livre para usar). Os créditos de cada arquivo ficam em um arquivo `CREDITS.md` que acompanha os recursos no disco. Ele não aparece no aplicativo.

Os arquivos e as pastas incluídos são protegidos. Você não pode excluí-los nem movê-los no **Asset Browser**, mas pode renomeá-los ou copiá-los.

## Abrir o Asset Browser

O **Asset Browser** é um gerenciador de arquivos para os recursos do jogo. Abra-o em **Settings** (Configurações):

1. Abra **Settings**.
2. Vá para a aba **Imports** (importações).
3. Localize **Game Assets** (recursos do jogo) e clique em **Asset Browser**.

Ou abra-o a partir de um jogo:

1. Abra um chat de Game Mode.
2. Clique ou toque no botão **Game Assets** (o ícone de pasta), perto do canto superior direito do chat. Você pode arrastá-lo para outro lugar no computador ou no celular.

O botão só aparece em chats de Game Mode. Ele abre **Game Assets** com o **Asset Browser** dentro, como uma janela móvel no computador ou um painel de largura total no celular. Se você usou **Put back in Chat Settings** (devolver para as configurações do chat) para movê-lo, abra a seção **Game Assets** em Chat Settings.

A barra de ferramentas mostra uma trilha de navegação que começa em **Game Assets**, um botão liga/desliga entre **Grid view** e **List view**, os botões **Upload**, **New**, **Rescan** e **Open in system folder** e uma caixa **Search in folder**. Em telas mais largas, uma árvore de pastas à esquerda ajuda a pular entre as categorias.

## Enviar os seus próprios recursos

Marinara confere cada envio com as regras de [Tipos e tamanhos de arquivo](#file-types-and-sizes). Use qualquer um dos dois caminhos.

### Enviar pelo Asset Browser

1. Abra o **Asset Browser**.
2. Abra uma das cinco pastas de categoria, ou uma subpasta dentro dela.
3. Clique em **Upload** (enviar) e escolha os arquivos, ou arraste os arquivos para a área de arquivos.

Você precisa estar dentro de uma pasta de categoria. Se soltar arquivos no nível mais alto, o aplicativo pede que você abra uma antes.

### Enviar pelo painel Settings

1. Abra **Settings** e vá para a aba **Imports**.
2. Em **Game Assets**, escolha uma categoria em **Type** (tipo): **Music**, **Ambient**, **Sound Effects**, **Sprites** ou **Backgrounds**.
3. Defina o destino em **Folder** (pasta), ou mantenha o padrão.
4. Clique em **Choose Files** (escolher arquivos) e selecione os seus arquivos.
5. Clique em **Upload to Server** (enviar ao servidor).

Se não funcionou, a mensagem de erro lista os tipos de arquivo aceitos para aquela categoria. Para música, confira o caminho da pasta (veja [A regra da pasta de música](#the-music-folder-rule)).

Valores padrão de **Folder**:

| Tipo | Pasta padrão |
| --- | --- |
| **Music** | `exploration/fantasy/calm` |
| **Ambient** | `nature` |
| **Sound Effects** | `exploration` |
| **Sprites** | `generic-fantasy` |
| **Backgrounds** | `custom` |

<a id="file-types-and-sizes"></a>

### Tipos e tamanhos de arquivo

| Categoria | Tipos de arquivo aceitos |
| --- | --- |
| Music, Ambient, Sound Effects | MP3, OGG, WAV, FLAC, M4A, AAC, WebM |
| Sprites | PNG, JPG, JPEG, GIF, WebP, AVIF, SVG |
| Backgrounds | PNG, JPG, JPEG, GIF, WebP, AVIF |

Arquivos de áudio e de imagem podem ter até 50 MB cada. Arquivos de texto podem ter até 10 MB.

<a id="the-music-folder-rule"></a>

### A regra da pasta de música

Toda trilha de música precisa ficar em um caminho de três níveis, `state/genre/intensity`, por exemplo `exploration/fantasy/calm`. Se o caminho não bater, o envio falha. É por essa organização que o Game Mode sabe quando tocar cada trilha.

- Estado: `exploration`, `dialogue`, `combat`, `travel_rest`.
- Gênero: `fantasy`, `horror`, `romance`, `mystery`, `scifi`, `modern`, `slice_of_life`, `adventure`, `drama`, `custom` ou a família de um cenário (veja abaixo), como `wuxia`.
- Intensidade: `calm`, `tense`, `intense`.

As pastas de ambiente, efeito sonoro, sprite e plano de fundo não têm essa regra. Dê às subpastas delas o nome que quiser.

## Organizar os recursos

No computador, clique com o botão direito em um arquivo ou pasta, ou use o menu "..." dele, para ver as ações.

| Ação de arquivo | O que faz |
| --- | --- |
| **Rename** (renomear) | Falha se o nome já estiver em uso naquela pasta. |
| **Move** (mover), **Copy** (copiar) | Envia o arquivo para outra pasta com um seletor de pastas. |
| **Delete** (excluir), **Download** (baixar) | Remove o arquivo, ou salva o arquivo no seu dispositivo. |

| Ação de pasta | O que faz |
| --- | --- |
| **Create subfolder** (criar subpasta) | Cria uma pasta nova dentro dela. |
| **Open in system folder** (abrir na pasta do sistema) | Mostra a pasta no gerenciador de arquivos do computador. |
| **Delete folder** (excluir pasta) | Se houver arquivos dentro, marque **Delete everything inside** (excluir tudo o que está dentro) antes. |

**New** (novo), na barra de ferramentas, cria **New folder**, **New text file** ou **New markdown file** na pasta atual. Para agir sobre vários arquivos, marque as caixas de seleção deles. Uma barra mostra quantos estão selecionados, com **Select all** (selecionar tudo), **Move**, **Copy** e **Delete**. Pastas grandes carregam em partes, com um botão **Load more** (carregar mais).

Cada pasta pode guardar uma nota curta. Clique no texto de descrição, ou na dica **Add description...** (adicionar descrição), para escrever uma. As cinco pastas de categoria têm descrições fixas.

### Reanalisar depois de mudanças feitas por fora

Marinara mantém uma lista interna dos recursos para que o Game Mode os encontre rápido. Os envios feitos pelo aplicativo a atualizam automaticamente. Se você copiar arquivos para a pasta de recursos do jogo no seu computador, por fora do aplicativo, clique em **Rescan** (reanalisar) para ler a pasta de novo. **Rescan** fica na barra de ferramentas do **Asset Browser** e em **Game Assets**, em **Settings**.

### Abrir a pasta no seu computador

**Open in system folder** só funciona quando você usa o aplicativo no mesmo computador que roda o servidor. No celular, no tablet ou em outro computador, o aplicativo avisa que as pastas do sistema só podem ser abertas no dispositivo que hospeda Marinara.

## Escolher os recursos que um jogo pode usar

Um chat de Game Mode pode usar só algumas das suas pastas de recursos, por exemplo para manter as suas músicas alegres fora de um jogo de terror.

1. Durante a configuração, expanda **Adjust Game Assets for this Game** (ajustar os recursos para este jogo) na etapa **Features** (recursos). Em um jogo que já existe, abra a janela **Game Assets** do jogo.
2. Clique em **Game assets**. Ele muda para **Selecting** (selecionando).
3. Use o pequeno controle de status de cada pasta para incluí-la ou excluí-la.

Uma barra mostra "All folders included" ou quantas pastas estão excluídas. **Reset to all** (redefinir para todas) inclui tudo de novo. A escolha fica salva só para aquele chat. Ela muda as pastas das quais o Game Mode pode escolher, e não exclui nem esconde nenhum arquivo.

<a id="a-settings-own-art-and-music"></a>

### A própria arte e música de um cenário

Um jogo iniciado com um kit de cenário tem uma família de arte, mostrada em **Art and music** (arte e música) quando você muda as palavras do kit: `fantasy`, `scifi`, `modern`, `wuxia`, `jazz_age`, `wasteland` ou uma família própria do kit. O jogo usa as pastas com o nome da família dele e todas as pastas sem nome de família, e deixa de fora as pastas das outras famílias. Um jogo cyberpunk nunca toca música de batalha de fantasia nem mostra a floresta encantada. Quando nada da família dele nem das pastas compartilhadas combina, nada toca, em vez de uma trilha de outra família. Um jogo sem kit de cenário usa todas as pastas.

- **Music**: coloque as trilhas do cenário em `music/<state>/<family>/<intensity>`, como `combat/wuxia/intense`. Elas tocam antes das trilhas compartilhadas.
- **Backgrounds**: `backgrounds/<family>`. Os planos de fundo gerados em um jogo com kit de cenário também são salvos ali.
- **Sons de combate**: um som em `sfx/combat/<family>` com o mesmo nome de um som incluído, como `sword-swing`, substitui esse som nos jogos daquela família. Os sons de combate incluídos são de fantasia, então as lutas das outras famílias ficam silenciosas até você adicionar os sons delas.

Os planos de fundo iniciais incluídos contam como compartilhados, exceto os de fantasia (`ancient_library`, `castle_cliff`, `enchanted_forest`) e o moderno `city_night`. Um kit de cenário salvo antes de existirem as famílias de arte continua funcionando: um kit feito a partir de um kit inicial usa a família desse kit inicial, e qualquer outro usa todas as pastas até você escolher uma família em **Art and music**. A barra de seleção acima mostra o nome da família do jogo aberto.

<a id="generated-sound-effects-and-music"></a>

## Efeitos sonoros e música gerados

O Game Mode pode gerar efeitos sonoros e música por uma conta **Music & Sound Effects** (música e efeitos sonoros). Escolha ElevenLabs, SunoAPI ou um servidor compatível personalizado. Cada som ou trilha nova usa essa conta do serviço. O áudio incluído continua disponível sem geração.

**Antes de começar:** você precisa de uma conta **Music & Sound Effects**. A janela **Add account** (adicionar conta) não tem um bloco para ela. Essas contas vêm de uma atualização ou de uma importação: **Import a backup** (importar um backup), em **Connections** (Conexões). Veja [configuração de provedores e limites](../connections/providers-reference.md#music--sound-effects).

1. Em **Connections**, abra o modelo da conta com **Edit model** (editar modelo).
2. Escolha o serviço, informe a chave dele e selecione os modelos de música e de efeitos sonoros. A música da SunoAPI também precisa de uma URL pública de callback HTTPS. Um servidor personalizado precisa dos caminhos dos endpoints dele.
3. Ative **Sound-effect generation** (geração de efeitos sonoros), **Music generation** (geração de música) ou as duas.
4. Salve a conta. Veja [configuração de provedores e limites](../connections/providers-reference.md#music--sound-effects).

Depois, ative o recurso ao criar um jogo:

1. Na etapa **Features** do assistente de configuração, encontre o cartão **Game Audio** (áudio do jogo).
2. Na escolha da conta, selecione a sua conta ou mantenha **Use the default Music & Sound Effects account** (usar a conta padrão de música e efeitos sonoros).
3. Deixe **Sound effects** (efeitos sonoros) e **Music** (música) ligados, ou desligue o que você não quiser.

Cada botão liga/desliga precisa que a função correspondente esteja ativada na conta selecionada. Uma conta Audio só de fala não é usada para geração.

Durante o jogo:

- **Sound effects.** Depois dos turnos do GM (o mestre do jogo), Marinara pede ao serviço sons curtos que combinem com a cena.
- **Music.** Marinara compõe uma trilha instrumental, de cerca de dois minutos, para cada lugar que a equipe visita e para cada tipo de luta, como uma luta contra chefe. Cada trilha é criada uma vez e reaproveitada. A trilha de um lugar novo começa em uma troca de cena posterior, para a música não entrar no meio da cena. A trilha de uma luta entra gradualmente assim que fica pronta.

Os sons e as trilhas gerados ficam salvos com os seus recursos do jogo, então o mesmo som não é criado duas vezes. Se o **Music DJ** tocar música no jogo, o Game Mode não gera música.

## Pasta de música personalizada do Music DJ

O **Music DJ** é um agente auxiliar que pode tocar música durante um jogo. No modo Custom, ele toca trilhas de uma pasta que você escolhe. Quando você ativa o **Music DJ** em um chat, o formulário de configuração segue a origem salva no agente. **Game Assets** mostra um caminho dentro dos seus recursos do jogo, como `music` ou `music/combat`. **Folder on this device** (pasta neste dispositivo) mostra o caminho salvo no dispositivo do servidor e um botão **Choose Folder** (escolher pasta).

O editor completo do **Music DJ** tem uma seção **Custom Music Library** (biblioteca de música personalizada). **Use Game Assets music folder** (usar a pasta de música dos recursos do jogo) alterna entre dois modos:

- Ligado: o campo **Game Assets music folder** lê uma pasta dentro dos seus recursos do jogo. **Open Folder** (abrir pasta) abre essa pasta no computador do servidor.
- Desligado: **Music folder on this device** (pasta de música neste dispositivo) toca música de qualquer pasta do computador que roda o servidor. Clique em **Select Folder** (selecionar pasta), ou cole o caminho.

Escolher uma pasta fora do aplicativo exige acesso privilegiado. No mesmo computador do servidor, funciona sem configuração extra. De outro dispositivo ou por acesso remoto, configure primeiro o acesso de administrador. Veja [Acesso remoto](../REMOTE_ACCESS.md). Para o resto do tocador de música, veja [Music DJ](../media/music.md).

## Guias relacionados

- [Music DJ: Spotify, YouTube e músicas locais](../media/music.md)
- [Provedores de IA compatíveis](../connections/providers-reference.md)
- [Game Mode: primeiros passos](getting-started.md)
- [Acesso remoto: login e lista de IPs permitidos](../REMOTE_ACCESS.md)
