# Game Mode: mapa, tempo e clima

Use o painel de mapa para ver onde a sua equipe está e para movê-la. Este guia também trata dos sistemas que acompanham o mundo ao redor da equipe: o dia e a hora, o clima e o moral da equipe.

## O painel de mapa

Game Mode mostra um painel de mapa na tela do jogo. Ele traz o nome do mapa atual, o dia de jogo e um ícone de céu que indica a hora do dia.

- **No computador**, o mapa é um painel embutido, fácil de consultar num relance. Você pode arrastá-lo e travá-lo no lugar. Para entender como funcionam os painéis arrastáveis, veja [Game Mode: widgets do HUD](hud-widgets.md).
- **No celular**, toque em **Map** (mapa) para abrir o painel. O botão dele começa perto do canto superior esquerdo e pode ser arrastado pelo chat. Use **Lock window** (travar janela) para manter o botão no lugar e **Close** (fechar) para voltar a ele. A posição fica salva com o chat. O mapa do celular usa o estilo de widget do chat definido em **Settings → Appearance → App**, e o botão dele fica separado do menu de três pontos **Chat tools** (ferramentas do chat).

Uma partida Classic comum tem o mapa de cena descrito aqui. O overworld, as cidades e os mapas de masmorra pertencem às partidas Overworld RPG, que ainda não estão disponíveis (veja [Classic ou Overworld RPG](getting-started.md#classic-or-overworld-rpg)).

### Visualização em grade e visualização em nós

Marinara escolhe a visualização de acordo com o tipo de lugar que o mapa mostra. Você não troca de visualização manualmente.

- A visualização **grid** (grade) serve para áreas abertas, como uma região ou uma cidade. Ela mostra quadrados coloridos conforme o terreno: grama, floresta, água, montanha, deserto, neve, vila, estrada e caverna.
- A visualização **node** (nós) serve para áreas fechadas, como masmorras e interiores. Ela mostra os lugares como círculos ligados por linhas. Um lugar não descoberto aparece com um ponto de interrogação. Uma linha tracejada é um caminho por onde você ainda não passou, e uma linha contínua é um caminho que você já percorreu.

## Como mover a equipe

Só alguns lugares podem ser escolhidos. No mapa em grade, o quadrado precisa estar ao lado da equipe e já ter sido descoberto. No mapa em nós, o nó precisa estar ligado ao lugar atual ou já ter sido descoberto. Os demais quadrados e nós não fazem nada quando você clica neles.

1. Clique em um quadrado da grade ou em um nó do mapa em nós.
2. Uma etiqueta **Map position:** (posição no mapa) com o nome do lugar aparece acima da caixa de mensagem.
3. Escreva a mensagem e envie. Marinara acrescenta uma linha curta como `*moves to <place>*` no começo da mensagem.

Para cancelar, clique no botão de limpar (X) na etiqueta **Map position:**. A dica do botão diz **Clear destination** (limpar destino).

No celular, toque uma vez em um nó para selecioná-lo e depois toque em **Set destination** (definir destino) no rodapé. O nó marcado com **You are here** (você está aqui) é o lugar onde você está.

Se não funcionou, confira se o quadrado está ao lado da equipe e já foi descoberto, ou se o nó está ligado ao lugar onde você está.

### Zoom, troca e geração de mapas

- **Zoom.** Use **Zoom in** (o sinal de mais) e **Zoom out** (o sinal de menos) no canto superior direito. O zoom vai de 75% a 180%, em intervalos de 25%.
- **Trocar de mapa.** Quando um jogo tem mais de um mapa ou região, um menu suspenso no topo do painel permite ver outro. O mapa em que você está fica marcado com **(Current)**.
- **Gerar um mapa.** Clique no botão de varinha **Generate another map** (gerar outro mapa), no canto superior esquerdo, para substituir o mapa atual por um novo. Um jogo sem mapa mostra **No map yet** e um botão **Generate** (gerar), que faz a mesma coisa.

## Como definir o dia e a hora manualmente

O controle de dia e hora fica no topo do painel de mapa. Ele mostra **Day** (dia) e um número, além de um ícone de céu.

1. Clique no controle **Day**.
2. Digite um número de dia de 1 a 9999.
3. Escolha uma hora do dia: **Dawn**, **Morning**, **Afternoon**, **Evening**, **Night** ou **Midnight**.
4. Clique fora do controle ou pressione <kbd>Enter</kbd> para salvar.

Esse é um ajuste manual, à parte do relógio automático. O relógio também pode mostrar **Noon** sozinho, mas Noon não é uma opção manual.

## Como o tempo passa

O relógio do jogo usa contas fixas, e não a IA. Todo jogo novo começa no Day 1, às 08:00. Cada ação adianta o relógio:

| Ação | Tempo adicionado |
| --- | --- |
| Conversar | 15 minutos |
| Explorar | 30 minutos |
| Uma rodada de combate | 5 minutos |
| Um descanso curto | 1 hora |
| Um descanso longo | 8 horas |
| Viajar | 2 horas |

Quando o relógio passa da meia-noite, o número do dia aumenta em um.

Em um jogo com mundo, o tempo também passa sozinho:

- Enquanto o overworld está na frente e o jogo espera por você, um minuto de jogo passa a cada cinco segundos reais. Ele para enquanto o GM escreve, antes de você ler a resposta dele, enquanto a visualização da cena está na frente e enquanto o aplicativo está em segundo plano.
- Uma caminhada no overworld faz passar os dias que a rota leva.
- Quando o Game Master (GM) diz que dias se passam (uma jornada, um descanso longo, uma espera), o relógio avança esses dias. Uma resposta regenerada não o move de novo. Defina o dia manualmente se a nova narração levar um tempo diferente.

## Clima

O jogo acompanha o clima com contas fixas, e não com a IA. O clima depende do bioma (o tipo de lugar onde a equipe está, como deserto, ártico, litoral ou montanha) e da estação do ano. Alguns exemplos são céu limpo, nublado, chuva, tempestade, neve, nevasca, neblina e tempestade de areia. O clima muda com mais frequência quando você viaja ou faz um descanso longo, às vezes quando explora e raramente nas outras situações. Ele dá cor à maneira como o GM descreve cada cena.

Para ver o clima na tela, ative **Dynamic weather effects (rain, snow, fog, etc.)** nas configurações de aparência. Ela vem ativada por padrão. Partículas de chuva, neve e neblina aparecem então sobre o jogo e combinam com o clima e a hora do dia. Veja [Configurações de aparência](../appearance/appearance-settings.md).

## Moral da equipe

O jogo mantém uma pontuação oculta de moral da equipe, de 0 a 100. Ela tem cinco níveis, do mais baixo ao mais alto: Broken, Low, Steady, High e Inspired.

O moral sobe quando você vence uma luta, conclui uma missão ou encontra um tesouro. Ele cai quando você perde uma luta, falha em uma missão ou perde um aliado. Com o tempo, ele volta aos poucos para o meio. O moral não aparece como número. Ele dá cor à maneira como o GM descreve o humor da equipe. Ele não muda as suas rolagens de dados.

## O overworld e os outros mapas do Overworld RPG

As seções abaixo descrevem as partidas **Overworld RPG**, que ainda não estão disponíveis. Elas só valem se o seu servidor tiver ativado o recurso.

<a id="the-overworld"></a>

### O overworld

Uma partida com mundo gerado (veja [Criar um mundo](getting-started.md#making-a-world)) abre no **overworld** (o mapa do mundo): o terreno do mundo desenhado como um mapa de pixels atrás da narração, com florestas, colinas, litorais e mares, as estradas e rotas entre os assentamentos, cada assentamento desenhado de acordo com o tamanho, e a sua equipe. Os lugares maiores aparecem com nome, assim como aquele onde você está. Arraste o mapa para olhar em volta.

1. Toque ou clique em um assentamento, ou escolha-o em **Places** (lugares: os mais próximos primeiro, com o tempo do caminho).
2. Confira o tamanho dele e a viagem desde onde você está: dias ou horas, e por quais rotas.
3. Clique em **Walk there** (ir até lá). A equipe segue pelas rotas do mundo pelo caminho mais rápido, e os dias da caminhada passam no relógio de uma vez.

O seu próximo turno conta ao GM para onde você foi, quanto tempo levou e por quais rotas, para que ele narre a chegada. Uma segunda caminhada antes do seu próximo turno continua de onde a primeira terminou.

Cavernas, minas, criptas e ruínas a poucos passos de um assentamento aparecem como **sítios**. Um mundo novo tem um ou dois em cada região, com o nome do assentamento ao lado deles ("Hollin Caves", "Ashby Ruins"). **Walk there** segue pelas rotas até o assentamento do sítio e depois sai da estrada, a pé. Em um sítio, **Enter** (entrar) abre o mapa dele (veja [Masmorras, cavernas e estações](#dungeons-caves-and-stations)). Um sítio importante para a história fica **fechado** (esmaecido, sem viagem e sem entrada) até o GM abri-lo. Um criador de mundos também pode esconder um sítio até esse momento ou deixá-lo aberto desde o início.

Um lugar em ruínas é desenhado em ruínas. Depois que escurece, o mapa fica mais escuro e as janelas se acendem. Cada família de cenário (fantasia, wuxia, dias atuais, anos 1920, ficção científica, terra devastada) tem os seus próprios tiles. Um kit sem família desenha tiles simples.

Para alternar entre as visualizações, use **Show the scene** (mostrar a cena) e **Show the overworld** (mostrar o overworld) em **Game controls**, que no celular fica no menu de três pontos **Chat tools**. O jogo lembra a sua escolha. Uma luta e a repetição de uma sessão usam telas próprias.

<a id="tile-packs"></a>

### Pacotes de tiles

Os pacotes de tiles guardam a paleta e cada tile (cada tipo de terreno, os assentamentos por tamanho, a equipe e as ruas, os telhados e os moradores de uma cidade) como linhas de pixels. Cada família de cenário tem um pacote embutido. Abra o painel **Agents** (agentes) e encontre **Tile packs** (pacotes de tiles) para:

- escolher com qual pacote cada cenário é desenhado (**Built in**, ou embutido, é o pacote do próprio cenário),
- **Import a tile pack** (importar um pacote de tiles) de um arquivo `.tilepack.json`,
- **Export** (exportar) um pacote para compartilhá-lo, ou **Remove** (remover) um pacote, o que faz todo cenário desenhado com ele voltar aos próprios tiles.

Um pacote só precisa dos tiles que ele muda, e o que ficar de fora é desenhado de forma simples. Um pacote que cita um tile que Marinara não desenha mantém o resto e diz o que deixou de fora.

<a id="the-town"></a>

### A cidade

Em um assentamento, escolha-o no overworld e escolha **Enter** para ver a cidade. Ela é disposta a partir do mundo: ruas e uma praça, os lugares que o mundo ou a história colocaram nela (com o nome nos prédios), um salão em um lugar maior, locais de trabalho dos ofícios pelos quais o lugar é conhecido e casas. As pessoas estão onde a hora as coloca: no trabalho de dia, na praça ao entardecer, em casa à noite.

Escolha um prédio ou a praça, ou escolha em **Places in town** (lugares da cidade), para ver quem está lá e a quantos minutos fica. **Walk there** atravessa a cidade pelas ruas, contornando os prédios e tudo o que uma disposição manual pintou, passando pelas pontes dela. Os minutos passam no relógio, e o seu próximo turno conta ao GM para onde a equipe foi e quem está lá. Visitar um lugar com nome, como uma estalagem que a história acrescentou, faz dele o lugar atual da equipe. **Leave town** (sair da cidade) volta para o overworld. O jogo lembra em qual visualização você estava.

Uma cidade pode ser **disposta à mão** com um editor de mundo como o Pixelforge, como parte das edições manuais do mundo.

- Os prédios podem ser movidos para outros lotes. Um prédio movido para o lote de outro troca de lugar com ele, e todo prédio continua de frente para uma rua.
- O chão pode ser pintado com ruas, calçamento, terreno aberto, árvores ou um poço, mas nunca embaixo de um prédio, diante da porta dele, no meio da praça ou embaixo de uma barraca do mercado.
- Quem mora e trabalha onde nunca muda, e uma caminhada até um prédio movido é contada a partir da nova porta.
- O editor recusa uma disposição que não cabe na cidade e diz o motivo. Os lugares que a história acrescenta durante o jogo continuam encontrando um lote.
- Uma disposição também pode colocar prédios fora dos lotes, pintar campos, trilhas de terra, água com pontes e cercas vivas, e espalhar decorações. A visualização da cidade desenha tudo isso (as decorações, só com um pacote de imagens que as tenha).

<a id="dungeons-caves-and-stations"></a>

### Masmorras, cavernas e estações

Quando a história desce para o subsolo ou embarca em algum lugar, o GM pode abrir um **mapa do lugar**: uma masmorra, caverna ou estação, desenhada sobre a cena. Ele é disposto a partir do jogo e do nome do lugar, então o mesmo lugar sempre tem as mesmas salas, e voltar a ele mantém o mapa como estava. O GM escolhe o visual entre onze: cavernas de rocha, de gelo, de cristal e de lava; uma cripta, um esgoto e um templo; e os corredores, o laboratório, o deck de motores e a hidroponia de uma estação. Com um pacote de tiles para esse visual, o mapa usa a arte dele. Sem um, ele fica em cores simples.

Um lugar da cidade onde a equipe pode descer (uma caverna, mina, cripta, esgoto ou ruína, pelo nome, ou, na ficção científica, uma nave abandonada ou um bunker) mostra **Go down** (descer) quando a equipe está lá.

- Ele abre o mesmo mapa toda vez, e sair devolve a equipe à cidade.
- Enquanto a equipe está em outro mapa, saia desse primeiro.
- Um lugar também pode ter um mapa feito à mão com um editor de mundo como o Pixelforge. **Go down** então abre esse mapa, seja qual for o nome do lugar, desenhado com o pacote que ele indica. Em um mapa assim, a saída fica onde a equipe entrou, os objetos de cenário nunca bloqueiam o caminho, e as pessoas ficam nos pontos com nome nas horas que o mapa define. O GM fica sabendo quem está lá.

Clique em um lugar do mapa, ou use as setas do teclado, para ir até lá pelo caminho mais curto. Os minutos passam no relógio (cerca de um minuto a cada trinta passos), e o seu próximo turno conta ao GM de qual área a equipe saiu e para qual foi. O rótulo no topo diz qual é a área atual. **Show the scene** e **Show the map** (mostrar o mapa) em **Game controls** (controles do jogo) alternam entre a cena e o mapa.

Para sair, volte até a saída (escada, escada de mão ou alçapão) e escolha **Leave** (sair). O GM também pode encerrar o mapa quando a história sai do lugar. Regenerar um turno que abriu um mapa, andou nele ou saiu dele devolve o mapa ao estado de antes desse turno.

## Guias relacionados

- [Game Mode: primeiros passos](getting-started.md)
- [Game Mode: widgets do HUD](hud-widgets.md)
- [Configurações de aparência](../appearance/appearance-settings.md)
