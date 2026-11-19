# Game Mode: mapa, tempo e clima

Use o painel de mapa para ver onde a sua equipe está e para movê-la. Este guia também trata dos sistemas que acompanham o mundo ao redor da equipe: o dia e a hora, o clima e o moral da equipe.

## O painel de mapa

Game Mode mostra um painel de mapa na tela do jogo. Ele traz o nome do mapa atual, o dia de jogo e um ícone de céu que indica a hora do dia.

- **No computador**, o mapa é um painel embutido, fácil de consultar num relance. Você pode arrastá-lo e travá-lo no lugar. Para entender como funcionam os painéis arrastáveis, veja [Game Mode: widgets do HUD](hud-widgets.md).
- **No celular**, toque em **Map** (mapa) para abrir o painel. O botão dele começa perto do canto superior esquerdo e pode ser arrastado pelo chat. Use **Lock window** (travar janela) para manter o botão no lugar e **Close** (fechar) para voltar a ele. A posição fica salva com o chat. O mapa do celular usa o estilo de widget do chat definido em **Settings → Appearance → App**, e o botão dele fica separado do menu de três pontos **Chat tools** (ferramentas do chat).

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

## Clima

O jogo acompanha o clima com contas fixas, e não com a IA. O clima depende do bioma (o tipo de lugar onde a equipe está, como deserto, ártico, litoral ou montanha) e da estação do ano. Alguns exemplos são céu limpo, nublado, chuva, tempestade, neve, nevasca, neblina e tempestade de areia. O clima muda com mais frequência quando você viaja ou faz um descanso longo, às vezes quando explora e raramente nas outras situações. Ele dá cor à maneira como o GM descreve cada cena.

Para ver o clima na tela, ative **Dynamic weather effects (rain, snow, fog, etc.)** nas configurações de aparência. Ela vem ativada por padrão. Partículas de chuva, neve e neblina aparecem então sobre o jogo e combinam com o clima e a hora do dia. Veja [Configurações de aparência](../appearance/appearance-settings.md).

## Moral da equipe

O jogo mantém uma pontuação oculta de moral da equipe, de 0 a 100. Ela tem cinco níveis, do mais baixo ao mais alto: Broken, Low, Steady, High e Inspired.

O moral sobe quando você vence uma luta, conclui uma missão ou encontra um tesouro. Ele cai quando você perde uma luta, falha em uma missão ou perde um aliado. Com o tempo, ele volta aos poucos para o meio. O moral não aparece como número. Ele dá cor à maneira como o GM descreve o humor da equipe. Ele não muda as suas rolagens de dados.

<a id="dungeons-caves-and-stations"></a>

## Guias relacionados

- [Game Mode: primeiros passos](getting-started.md)
- [Game Mode: widgets do HUD](hud-widgets.md)
- [Configurações de aparência](../appearance/appearance-settings.md)
