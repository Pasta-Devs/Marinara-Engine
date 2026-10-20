# Game Mode: mapa, tempo e clima

Neste guia você conhece o painel de mapa do Game Mode e os sistemas que acompanham o mundo ao redor da equipe. Esses sistemas são o dia e a hora, o clima e o moral da equipe. O guia explica as visualizações do mapa, como se mover e dar zoom, e como definir o dia e a hora manualmente.

## O painel de mapa

Game Mode mostra um pequeno painel de mapa na tela do jogo. O painel traz o nome do mapa atual, o dia de jogo e um ícone de céu que indica a hora do dia.

No computador, o mapa é um painel embutido, fácil de consultar num relance. Você pode arrastar o painel e travá-lo no lugar. Para entender como funcionam os painéis arrastáveis, veja o guia de widgets do HUD indicado no fim da página.

No celular, toque em **Map** (mapa) para abrir o painel de mapa. O botão dele começa perto do canto superior esquerdo e pode ser arrastado pelo chat. Use o botão **Lock window** (travar janela) do painel para manter o botão do mapa no lugar; **Close** (fechar) volta para esse botão. A posição fica salva com o chat. O mapa do celular usa o estilo de widget do chat definido em **Settings → Appearance → App**, e o botão dele fica separado do menu de três pontos **Chat tools** (ferramentas do chat).

<a id="the-overworld"></a>

## O overworld

Um jogo com mundo gerado (veja [Criar um mundo](getting-started.md#making-a-world)) abre no **overworld** (o mapa do mundo): o terreno do mundo desenhado como um mapa de pixels atrás da narração, com as florestas, colinas, litorais e mares, as estradas e rotas entre os assentamentos, cada assentamento desenhado de acordo com o tamanho, e a sua equipe. Os lugares maiores aparecem com nome no mapa, assim como aquele onde você está. Arraste o mapa para olhar em volta.

Toque ou clique em um assentamento, ou escolha-o em **Places** (lugares: os mais próximos aparecem primeiro, com o tempo do caminho), para ver o tamanho dele e a viagem desde onde você está: quantos dias ou horas de caminho, e por quais rotas. **Walk there** (ir até lá) leva a equipe até ele pelas rotas do mundo, pelo caminho mais rápido, e os dias da caminhada passam no relógio de uma vez. A partir daí a equipe está lá, e **o seu próximo turno conta ao Game Master** para onde vocês foram, quanto tempo levou e por quais rotas, para que ele narre a chegada. Os dias do próprio mundo passam junto, como acontece quando o Game Master diz que o tempo passou. Uma segunda caminhada antes do seu próximo turno continua de onde a primeira terminou.

Cavernas, minas, criptas e ruínas a poucos passos de um assentamento aparecem no overworld como **sítios**: um mundo novo tem um ou dois em cada região, com o nome do assentamento ao lado deles ("Hollin Caves", "Ashby Ruins"), e um criador de mundos pode adicionar mais, com um nome assim ou um mapa feito para ele. Um mundo criado antes dos sítios mantém os lugares como estavam. **Walk there** leva a um sítio como leva a um assentamento: pelas rotas do mundo até o assentamento dele e depois, fora da estrada, a pé. Em um sítio, o cartão dele oferece **Enter** (entrar), que abre o mapa do sítio (veja [Masmorras, cavernas e estações](#dungeons-caves-and-stations)); sair dele devolve a equipe ao overworld, no sítio. Um sítio importante para a história do jogo fica **fechado** (desenhado esmaecido, sem viagem até ele e sem entrada) até o Game Master abri-lo quando a história chegar lá; um criador de mundos também pode deixar um sítio escondido do mapa até esse momento, ou aberto desde o início.

Um lugar em ruínas é desenhado em ruínas. Depois que escurece, o mapa fica mais escuro e as janelas dos assentamentos se acendem. Cada família de cenário tem os seus próprios tiles: fantasia, wuxia, dias atuais, anos 1920, ficção científica e terra devastada têm cada um as suas cores e construções. Um kit de cenário sem família é desenhado com tiles simples.

O overworld é uma visualização, e a visualização da cena (os planos de fundo e a arte dos personagens do jogo) fica a um clique de distância. Use **Show the scene** (mostrar a cena) em **Game controls** (controles do jogo), que no celular fica no menu de três pontos **Chat tools**. Para voltar, use **Show the overworld** (mostrar o overworld). O jogo lembra qual você escolheu. Uma luta e a repetição de uma sessão usam telas próprias.

<a id="tile-packs"></a>

### Pacotes de tiles

O overworld e as cidades são desenhados a partir de **pacotes de tiles**: uma paleta e cada tile (cada tipo de terreno, os assentamentos por tamanho, a equipe e as ruas, os telhados e os moradores da cidade) como linhas de pixels. Cada família de cenário tem o seu próprio pacote embutido. Abra o painel **Agents** (agentes) e encontre **Tile packs** (pacotes de tiles) para:

- escolher com qual pacote cada cenário é desenhado (**Built in**, ou embutido, é o pacote do próprio cenário);
- **Import a tile pack** (importar um pacote de tiles) de um arquivo `.tilepack.json` que alguém compartilhou;
- **Export** (exportar) um pacote para compartilhá-lo, ou **Remove** (remover) um pacote, o que faz todo cenário desenhado com ele voltar aos próprios tiles.

Um pacote só precisa dos tiles que ele muda: o que ficar de fora é desenhado de forma simples. Um pacote que cita um tile que Marinara Engine não desenha mantém o resto e diz o que deixou de fora.

<a id="the-town"></a>

### A cidade

Quando a equipe está em um assentamento, escolha-o no overworld e escolha **Enter** para ver a cidade. Ela é disposta a partir do mundo: as ruas e a praça, os lugares que o mundo ou a história colocaram nela (com o nome nos prédios), o salão principal em um lugar maior, os locais de trabalho dos ofícios pelos quais ela é conhecida e as casas. Os moradores estão onde a hora os coloca: no trabalho de dia, na praça ao entardecer, em casa à noite.

Uma cidade também pode ser **disposta à mão** com um editor como o Pixelforge, como parte das edições manuais do mundo: os prédios podem ser movidos para outros lotes (um prédio movido para o lote de outro troca de lugar com ele, e todo prédio continua de frente para uma rua), e o chão pode ser pintado com ruas, calçamento, terreno aberto, árvores ou um poço (nunca embaixo de um prédio ou diante da porta dele, no meio da praça ou embaixo de uma barraca do mercado). Quem mora e trabalha onde nunca muda, e uma caminhada até um prédio movido é contada a partir da nova porta. O editor recusa uma disposição que não cabe na cidade e diz o motivo; os lugares que a história acrescenta durante o jogo continuam encontrando um lote. Uma disposição também pode colocar prédios fora dos lotes, pintar campos, trilhas de terra, água com pontes por cima e cercas vivas, e espalhar decorações pela cidade; a visualização da cidade desenha tudo isso (as decorações, só com um pacote de imagens que as tenha).

Escolha um prédio ou a praça, ou escolha em **Places in town** (lugares da cidade), para ver quem está lá agora e a quantos minutos fica. **Walk there** leva a equipe pela cidade, pelas ruas, contornando os prédios (e as árvores, os poços, a água e as cercas vivas que uma disposição manual pintou, passando pelas pontes dela): os minutos do caminho passam no relógio, e **o seu próximo turno conta ao Game Master** para onde a equipe foi e quem está lá. Visitar um lugar com nome, como uma estalagem que a história acrescentou, faz dele o lugar onde a equipe está. **Leave town** (sair da cidade) volta para o overworld. O jogo lembra em qual visualização você estava.

<a id="dungeons-caves-and-stations"></a>

### Masmorras, cavernas e estações

Em um jogo Overworld RPG (veja [Classic ou Overworld RPG](getting-started.md#classic-or-overworld-rpg)), quando a história desce para o subsolo ou embarca em algum lugar, o Game Master pode abrir um **mapa do lugar**: uma masmorra, uma caverna ou uma estação, desenhada sobre a cena. Cada um é disposto a partir do jogo e do nome do lugar, então o mesmo lugar sempre tem as mesmas salas, e voltar a um lugar onde a equipe já está mantém o mapa como estava. O Game Master também escolhe o visual entre onze: cavernas de rocha, de gelo, de cristal e de lava; uma cripta, um esgoto e um templo; e os corredores, o laboratório, o deck de motores e a hidroponia de uma estação. Com um pacote de tiles para esse visual na biblioteca de pacotes de tiles, o mapa é desenhado com a arte dele; sem um, é desenhado em cores simples.

Um lugar da cidade onde a equipe pode descer (uma caverna, uma mina, uma cripta, um esgoto ou uma ruína, pelo nome; em um cenário de ficção científica, uma nave abandonada ou um bunker) tem **Go down** (descer) quando a equipe está lá. Ele abre o mapa desse lugar do mesmo jeito, sempre o mesmo mapa, e sair dele devolve a equipe à cidade, no ponto onde ela desceu. Enquanto a equipe está em outro mapa, saia desse primeiro. Um lugar também pode ter um mapa **feito à mão** para ele com um editor como o Pixelforge: aí **Go down** abre esse mapa, seja qual for o nome do lugar, desenhado com o pacote que ele indica. Em um mapa assim, a saída fica onde a equipe entrou, os objetos de cenário nunca atrapalham o caminho, e as pessoas ficam nos pontos com nome nas horas que o mapa define; o Game Master fica sabendo quem está lá.

Clique em um lugar do mapa, ou use as setas do teclado, para ir até lá pelo caminho mais curto. Os minutos passam no relógio (cerca de um minuto a cada trinta passos), e **o seu próximo turno conta ao Game Master** de qual área a equipe saiu e para qual foi. O rótulo no topo diz em qual área a equipe está. **Show the scene** e **Show the map** (mostrar o mapa) em **Game controls** alternam entre o mapa e a cena; o jogo lembra em qual você estava.

Para sair, volte até a saída (escada, uma escada de mão ou um alçapão, conforme o visual do lugar) e escolha **Leave** (sair). O Game Master também pode encerrar o mapa quando a história sai do lugar. Regenerar um turno que abriu, percorreu ou fechou um mapa devolve o mapa ao estado de antes desse turno. Jogos sem mapa funcionam como antes.

## Visualização em grade e visualização em nós

O mapa tem duas visualizações. Marinara Engine escolhe a visualização de acordo com o tipo de lugar que o mapa representa. Não é preciso trocar de visualização manualmente.

- A visualização **grid** (grade) serve para áreas abertas, como um mundo, uma região ou uma cidade. Ela mostra quadrados coloridos conforme o terreno: grama, floresta, água, montanha, deserto, neve, vila, estrada e caverna.
- A visualização **node** (nós) serve para áreas fechadas, como masmorras e interiores. Ela mostra os lugares como círculos ligados por linhas. Um lugar ainda não descoberto aparece com um ícone de interrogação. A linha tracejada indica um caminho por onde você ainda não passou. A linha contínua indica um caminho já percorrido.

## Como mover a equipe

Para viajar, escolha um lugar no mapa. Só alguns lugares podem ser escolhidos. No mapa em grade, o quadrado precisa estar ao lado da equipe e já ter sido descoberto. No mapa em nós, o nó precisa estar ligado ao lugar atual ou já ter sido descoberto. Os demais quadrados e nós não fazem nada quando você clica neles.

1. Clique em um quadrado da grade ou em um nó do mapa em nós.
2. Uma etiqueta **Destination:** (destino) aparece acima da caixa de mensagem com o nome do lugar.
3. Escreva a mensagem e envie. Marinara acrescenta uma linha curta como `*moves to <place>*` no começo da mensagem.

Para cancelar, clique no pequeno botão de limpar (o X) na etiqueta **Destination:**.

No celular, o caminho é um pouco diferente. Toque uma vez no nó para selecioná-lo e depois toque em **Set destination** (definir destino) no rodapé. O nó marcado com **You are here** é o lugar onde a equipe está.

## Zoom do mapa

Cada mapa tem um controle de zoom no canto superior direito.

- Clique em **Zoom in** (o botão de mais) para aproximar.
- Clique em **Zoom out** (o botão de menos) para afastar e enxergar mais.

O zoom vai de 75% a 180%, em intervalos de 25%.

## Como alternar entre mapas

Alguns jogos têm mais de um mapa ou região. Quando existe mais de um mapa, um pequeno menu suspenso aparece no topo do painel de mapa. Use esse menu para ver outro mapa. O mapa em que a equipe realmente está fica marcado com **(Current)**.

## Como gerar um novo mapa

O painel de mapa tem um botão de varinha no canto superior esquerdo, chamado **Generate another map** (gerar outro mapa). Clique nele para substituir o mapa atual por um novo.

Se o jogo ainda não tiver mapa, o painel mostra **No map yet** e um botão **Generate**, que faz a mesma coisa.

## Como definir o dia e a hora manualmente

O controle de dia e hora fica no topo do painel de mapa. Ele mostra **Day** (dia) e um número, além de um pequeno ícone de céu para a hora do dia.

1. Clique no controle **Day**.
2. Digite um novo número de dia na caixa. O dia vai de 1 a 9999.
3. Escolha uma hora do dia no menu suspenso. As opções são **Dawn**, **Morning**, **Afternoon**, **Evening**, **Night** e **Midnight**.
4. Clique fora do controle ou pressione Enter para salvar.

Esse é um ajuste manual. Você define o dia e a hora por conta própria, à parte do relógio automático descrito a seguir. O relógio também pode mostrar **Noon** sozinho, mas Noon não é uma das opções manuais.

## Como o tempo passa automaticamente

O relógio do jogo anda sozinho. Ele usa contas fixas, e não a IA, então o resultado é sempre coerente. Todo jogo novo começa no Day 1, às 08:00 da manhã. Cada ação que você faz adianta o relógio em uma quantidade definida.

| Ação | Tempo adicionado |
|---|---|
| Conversar | 15 minutos |
| Explorar | 30 minutos |
| Uma rodada de combate | 5 minutos |
| Um descanso curto | 1 hora |
| Um descanso longo | 8 horas |
| Viajar | 2 horas |

Quando o relógio passa da meia-noite, o número do dia aumenta em um.

Em um jogo com mundo, o tempo também passa sozinho:

- Enquanto o overworld está na frente e o jogo espera por você, um minuto de jogo passa a cada cinco segundos reais. Ele para enquanto o Game Master escreve, antes de você ler a resposta dele, enquanto a visualização da cena está na frente e enquanto o aplicativo está em segundo plano.
- Uma caminhada no overworld faz passar os dias que a rota leva.
- Quando o Game Master diz que dias se passam (uma jornada, um descanso longo, uma espera), o relógio também avança esses dias. Uma resposta regenerada não o move de novo; defina o dia manualmente se a nova narração levar um tempo diferente.

## Clima

O jogo também acompanha o clima por conta própria, com contas fixas e sem IA. O clima depende do bioma e da estação do ano. O bioma é o tipo de lugar onde a equipe está, como deserto, ártico, litoral ou montanha. Alguns exemplos de clima: céu limpo, nublado, chuva, tempestade, neve, nevasca, neblina e tempestade de areia.

O clima pode mudar quando você age. Ele muda com mais frequência quando a equipe viaja ou faz um descanso longo, às vezes quando explora e raramente nas outras situações. O clima dá cor à maneira como o Game Master descreve cada cena.

Para ver o clima na tela, ative a opção **Dynamic weather effects (rain, snow, fog, etc.)** nas configurações de aparência do aplicativo. Ela vem ativada por padrão. Com ela ativa, partículas animadas de chuva, neve e neblina aparecem sobre o jogo. Elas combinam com o clima e a hora do dia do momento. Para mais opções de exibição, veja o guia de configurações de aparência indicado no fim da página.

## Moral da equipe

O jogo mantém uma pontuação oculta de moral da equipe, de 0 a 100. São cinco níveis, do mais baixo ao mais alto: Broken, Low, Steady, High e Inspired.

O moral muda conforme o que acontece na história. Vencer uma luta, concluir uma missão ou encontrar um tesouro faz o moral subir. Perder uma luta, falhar em uma missão ou perder um aliado faz o moral cair. Com o tempo, o moral volta aos poucos para o meio da escala.

O moral não aparece como um número no jogo. Ele age nos bastidores. O moral altera as rolagens de dados, de mais 2 em Inspired até menos 2 em Broken. Ele também influencia a forma como o Game Master descreve o humor da equipe.

## Guias relacionados

- [Game Mode: primeiros passos](getting-started.md)
- [Game Mode: widgets do HUD](hud-widgets.md)
- [Configurações de aparência](../appearance/appearance-settings.md)
