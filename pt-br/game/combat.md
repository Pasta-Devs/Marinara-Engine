# Game Mode: combate

Este guia explica o combate no Game Mode do Marinara Engine. Na etapa **World** (mundo) do assistente, escolha **Classic** (combate por menus) ou **Tactical** (combate em grade) em **Combat Preference** (preferência de combate). O Game Master de IA (GM) define o encontro e narra os resultados; o motor resolve as ações de combate.

<a id="tactical-battles-and-terrain"></a>

## Batalhas táticas e terreno

O combate tático posiciona seu grupo e os inimigos no campo de batalha. Selecione uma unidade, confira o alcance de movimento, escolha destino e ação e confirme. Quem age e quando depende da **Turn order** (ordem dos turnos) da batalha; veja [Ordem dos turnos](#turn-order). As previsões de ataque mostram as consequências esperadas antes da confirmação.

Ao criar uma partida Tactical, as opções do campo permitem escolher uma semente, um tamanho e orientações de terreno para o GM. Deixe a semente vazia para gerar uma. Ela é um número inteiro de 0 a 4294967295, incluindo zero. Reproduz o tabuleiro com os mesmos combatentes, descrição de terreno e demais entradas da geração; não obriga o GM a criar a mesma história ou os mesmos inimigos.

O GM fornece ambiente, formação e uma descrição breve do terreno. O motor cria as casas e posições iniciais exatas. A descrição pode pedir áreas e barreiras perto do centro ou das bordas do mapa. As orientações são pedidos ao GM, não uma garantia de que cada palavra vire uma casa. O campo aceito fica salvo; recarregar restaura esse tabuleiro.

O motor verifica a descrição e a disposição resultante. Preserva o terreno pedido e garante a acessibilidade do encontro. Se as restrições forem incompatíveis, o combate informa o problema. **Use generated terrain** (usar terreno gerado) inicia explicitamente sem os elementos rejeitados; não os apaga silenciosamente.

O mundo de uma partida também pode ter **campos de batalha feitos à mão**. São tabuleiros pintados casa por casa para um dos lugares do mundo, com um editor como o Pixelforge. Quando uma luta começa com a equipe nesse lugar, ou em um lugar dentro dele, a luta usa um desses tabuleiros em vez de um gerado. O tabuleiro é usado exatamente como foi pintado, na cena para a qual foi pintado. Se o lugar tiver vários tabuleiros, a semente da luta escolhe um. A descrição de terreno do GM não é usada nesse caso, mas a formação indicada por ele continua decidindo onde cada lado começa. O GM fica sabendo que o tabuleiro foi feito para esse lugar, e a linha do campo de batalha mostra o nome do tabuleiro.

Um tabuleiro feito à mão precisa seguir três regras. Ele tem um dos três tamanhos de tabuleiro. As duas colunas de cada lado são planície, onde os lados se posicionam. Toda casa em que um combatente pode ficar se conecta ao resto. O editor recusa um tabuleiro que quebre uma regra e diz por quê. Os campos de batalha feitos à mão ficam guardados com as edições manuais do mundo, então viajam com ele em arquivos de mundo, pacotes de mapas e na biblioteca.

| Terreno | Caminhada | Defesa e esquiva |
| --- | --- | --- |
| Planície | Custa 1 ponto de movimento | Sem bônus |
| Floresta | Custa 2 pontos de movimento | +1 de defesa, +15 pontos percentuais de esquiva |
| Ruínas | Custa 1 ponto de movimento | +1 de defesa, +10 pontos percentuais de esquiva |
| Montanha, água, parede | Bloqueia caminhada | Sem bônus |

Unidades com capacidade estabelecida de voo ou teletransporte podem se mover de outra forma:

- **Caminhada** segue casas de chão alcançáveis. Inimigos bloqueiam o caminho; não é possível terminar em uma casa ocupada.
- **Voo** atravessa terreno e unidades intermediárias por um ponto de movimento por casa, incluindo florestas. Uma unidade voadora pode pairar sobre uma casa normalmente bloqueada, mas não terminar sobre outra unidade.
- **Teletransporte** ignora terreno e unidades intermediárias. O destino precisa estar no alcance, desocupado e ser transitável a pé. Não pode terminar dentro de uma parede, sobre montanha nem sobre água sem apoio.

Os dois movimentos especiais usam a capacidade atual de movimento e a distância ortogonal entre casas. Mantêm os bônus de defesa e esquiva do terreno de destino. Os dois ignoram a altura (veja abaixo). A altitude de uma unidade voadora, tetos e custos ou exigências de visão específicos de magias não são representados.

<a id="turn-order"></a>

### Ordem dos turnos

Uma batalha Tactical organiza os turnos de uma de duas formas:

- **One at a time, by initiative** (um por vez, por iniciativa): cada unidade recebe um lugar em uma ordem rolada, e só a unidade da vez pode agir. O tabuleiro mostra a ordem dos turnos. Os jogos Overworld RPG novos usam esta forma.
- **Your whole party, then the enemies** (toda a sua equipe, depois os inimigos): cada unidade da equipe pode agir, e depois acontece a fase inimiga. Os jogos Classic usam esta forma.

Para mudar, abra **Chat Settings** (configurações do chat), expanda **Combat Style** (estilo de combate) e escolha uma **Turn order**. A opção aparece enquanto o **Battle system** (sistema de batalha) é Tactical, a menos que o conjunto de regras do jogo conduza as próprias lutas. A mudança vale a partir da próxima batalha; uma batalha em andamento mantém a ordem dela.

### Visão, cobertura e altura

- **Visão.** Paredes e montanhas bloqueiam a visão. Uma unidade só pode atacar, usar uma habilidade ou usar um item em um alvo que consegue ver.
- **Cobertura.** Algo entre o atacante e o alvo protege o alvo. Uma casa de floresta ou de ruínas no caminho, ou uma parede ou montanha que bloqueia parte da visão, dá meia cobertura. Uma parede ou montanha que bloqueia a maior parte da visão dá cobertura de três quartos. A meia cobertura tira 15 pontos percentuais da chance de acerto, e a de três quartos, 30. O bônus da própria casa do alvo e a cobertura dele não se somam: vale o melhor.
- **Altura.** Em um tabuleiro com montanhas, uma montanha tem dois níveis de altura, e o chão em volta dela, um nível. Subir um nível custa um ponto de movimento a mais, e descer não custa nada. Um degrau de dois níveis ou mais é um penhasco, que ninguém consegue atravessar a pé. Um terreno mais alto também bloqueia a visão entre duas casas mais baixas. Atacar de cima para baixo a partir de um terreno mais alto soma 10 à chance de acerto, um ataque à distância a partir de um terreno mais alto alcança uma casa a mais, e uma cobertura baixa, como uma floresta, não esconde um alvo visto de cima. Campos de batalha feitos à mão podem ter os próprios penhascos.

O combate completo com invocações é um trabalho futuro separado.

## Batalhas clássicas

As próximas seções sobre menus de ações e cálculos de dados descrevem o combate Classic. Todo o grupo participa, mas o comando escolhido controla o primeiro combatente vivo do grupo; os demais companheiros agem automaticamente.

## Começar um encontro

O combate nunca começa por sua iniciativa. É o GM que inicia a luta quando a história pede, por exemplo quando você provoca um inimigo ou cai numa emboscada. Nesse momento, uma tela de batalha completa se abre por cima da narração. Marinara monta a luta a partir do que está acontecendo na história: a equipe, os inimigos, os atributos de cada um e as regras especiais.

A tela de batalha mostra a equipe de um lado e os inimigos do outro. Cada combatente tem uma barra de vida (HP, pontos de vida) e, se usar habilidades, uma barra de magia (MP, pontos de magia). A ordem dos turnos aparece no topo, como **Next:** seguido do nome de quem age em seguida. Um contador mostra **Round** e o número da rodada atual.

<a id="games-whose-ruleset-resolves-its-own-fights"></a>

### Partidas cujo conjunto de regras resolve suas próprias lutas

Um conjunto pode resolver uma luta inteira com suas próprias regras, em vez de emprestar alguns números ao combate do Marinara. Nesse caso, a tela de batalha pertence a ele: o menu contém os ataques e as habilidades do personagem, sua própria economia de ações, suas condições e um registro com os cálculos reais. Tudo é salvo na ficha assim que acontece.

O conjunto também define o que cabe em um turno. Um golpe pode causar vários tipos de dano: cada parte é rolada, resistida e submetida a uma salvaguarda separadamente, mas o conjunto continua sendo um único golpe. Gastar uma ação pode comprar vários ataques; enquanto restarem, o menu os oferece de graça e informa quantos você tem, para que possa trocar de arma ou andar entre eles. Uma habilidade pode não custar nada, devolver uma segunda ação só neste turno ou permitir correr, desengajar ou se esconder gastando uma parte menor do turno. Algo que o personagem sempre faz, como dano extra no primeiro golpe que atende às condições do turno, é adicionado automaticamente e aparece no registro. Uma condição pode dificultar ou facilitar suas próprias salvaguardas, reduzir pela metade todo tipo de dano, impedir você de atacar quem a aplicou ou de se aproximar dessa pessoa, ou terminar quando ela cair. Uma condição também pode mudar um número: somar à sua defesa, acrescentar ou tirar dados das suas rolagens de ataque, salvaguardas e disputas, ou deixar você mais lento. O registro mostra cada uma ao lado da rolagem que ela mudou, e as chances do menu a levam em conta. Algumas condições duram até o início do seu próximo turno, ou só até o próximo ataque ou salvaguarda a que se referem. E um conjunto pode contar algo como exaustão em uma trilha da sua ficha, de modo que cada nível alcançado piora um pouco as coisas enquanto durar.

Um conjunto cujos testes rolam um punhado de dados e contam os que alcançam um alvo pode lutar do mesmo jeito. Nesse caso, um ataque rola a sua parada e precisa de uma quantidade de sucessos para acertar, nunca menos de um, e cada sucesso além desses acrescenta um dado ao dano. O dano também é rolado em dados, e quem é atingido pode absorver parte dele conforme o tipo de dano, seja rolando dados de absorção que tiram um ponto cada, seja tirando dados antes de o dano ser rolado; o que sobra marca os ferimentos. A sua penalidade de ferimentos tira dados das suas paradas como tira dos seus testes, e uma condição acrescenta ou tira dados. Salvaguardas e disputas também são paradas. O registro diz quantos dados entraram, o que eles precisavam alcançar, quantos sucessos encontraram e quanto a absorção tirou. Um conjunto assim também pode rolar a iniciativa de novo no início de cada rodada, e pode limitar quanto de um recurso você pode gastar em um turno, de modo que algo que passaria do limite simplesmente não aparece no menu até o seu próximo turno. Um conjunto de paradas também pode manter a iniciativa como um número para a luta inteira, que os ataques movimentam: você escolhe como fazer cada ataque, tomando parte do número do alvo para você em vez de feri-lo ou gastando o seu próprio número como dados de dano. Um ataque de gasto que acerta redefine o seu número; um que erra custa a você o tanto que o conjunto disser. Quem cai até a linha de colapso do conjunto entra em colapso e não pode gastar até se recuperar. A ordem segue os números a cada rodada, e o número de cada um aparece ao lado da vida dele.

Um conjunto também pode permitir que qualquer um na luta inicie uma disputa: agarrar alguém, derrubá-lo ou empurrá-lo para trás, ou se soltar de uma imobilização. Os dois lados rolam e somam o próprio número, o total mais alto vence, e o menu mostra a sua chance de vencer antes de você escolher. Vencer uma agarrada prende o oponente no lugar até ele se soltar ou você cair; perder não faz nada. Soltar-se só aparece no menu enquanto algo prende você, e só contra quem está segurando. Um empurrão só move alguém em um campo de batalha, e para em paredes e em quem estiver no caminho.

Algumas habilidades respondem à jogada de outra pessoa em vez de serem usadas no seu próprio turno. Quando um oponente está prestes a usar algo, quando algo é mirado em você, quando um ataque acabou de acertar você ou quando algo acabou de ferir você, e você tem uma resposta para esse momento, a luta pausa e o menu a oferece ao lado de **Pass** (passar). Depois de um acerto, o registro diz o que o ataque rolou e contra o que foi feito, para que você veja se uma resposta como Shield o transformaria em erro; se você a usar, a mesma rolagem é verificada de novo e o registro diz se ela ainda acerta. Os oponentes também podem responder assim, com um aparo próprio. Uma anulação pode impedir a habilidade de um oponente antes de ela acontecer, seja quem for o alvo, desde que o oponente esteja dentro do alcance da anulação; um conjunto pode dizer que ela responde só a alguns tipos de habilidade, como magias. O que a habilidade impedida custou continua gasto, e nada pode responder a uma anulação.

O conjunto também pode definir quanto vale uma casa em sua própria distância, em pés, passos ou outra unidade. Se fizer isso e **Combat Preference** (Preferência de combate) estiver em **Tactical** (Tático), a luta acontece em um campo de batalha com os mesmos tabuleiros, gerados ou feitos à mão para o lugar, o mesmo terreno e o mesmo posicionamento inicial das batalhas Tactical acima. A preferência volta a ter efeito nessas partidas. Um conjunto sem distância, ou uma partida **Classic** (Clássica), luta como antes: qualquer um pode mirar em qualquer um.

Nesse campo, os números do conjunto decidem tudo. A distância por turno vem da regra de movimento ou da velocidade da criatura; o alcance de uma arma, de suas próprias linhas; a área de uma habilidade vira uma explosão, cone ou linha reais; paredes bloqueiam disparos; cobertura acrescenta o que o conjunto determina; e sair do alcance de alguém permite que essa pessoa ataque quando as regras definem o custo desse ataque. O movimento usa oito direções a uma casa cada, como as grades de RPG de mesa para as quais essas regras foram escritas, em vez das quatro direções das batalhas Tactical próprias do Marinara descritas acima.

O campo aparece na tela. Cada casa é um botão: você pode percorrer o tabuleiro com o ponteiro ou as setas, e cada casa anuncia o que é, quem a ocupa e quanto custa chegar. **Move** (Mover) ilumina as casas alcançáveis com o custo na unidade do conjunto, desenha o caminho ao passar o ponteiro ou focá-las e marca em âmbar as casas cujo caminho provoca ataques, nomeando os atacantes abaixo do tabuleiro. Uma ação que precisa de alvo ilumina os válidos e permite selecioná-los no tabuleiro ou na lista. Se ninguém estiver ao alcance, aparece **Nobody is in reach. Move closer.** (Ninguém está ao alcance. Aproxime-se.) em vez de oferecer um ataque no vazio. Uma área mira em uma casa: as origens válidas ficam iluminadas e a casa sob o ponteiro informa quem seria atingido, inclusive aliados. Você pode gastar movimento antes e depois de uma ação; o menu volta com o que resta e o painel inferior mostra isso como **Movement** (Movimento), na unidade do conjunto. Escape abandona uma escolha incompleta e devolve o foco do teclado ao menu.

Um conjunto também pode usar mais do campo de batalha: cobertura em graus, até cobertura de três quartos; terreno mais alto que muda ataques e quedas; criaturas que voam, nadam, escalam ou escavam; **Hide** (esconder-se) e **Search** (procurar) no menu; e, quando alguém se afasta de um oponente, uma pausa que pergunta ao oponente se quer atacar. Quais desses recursos uma luta usa depende do conjunto. Voar sobre obstáculos, passar por espaços apertados, montarias e arrastar alguém que você segura são trabalhos futuros separados.

<a id="games-that-use-a-ruleset"></a>

### Partidas com um conjunto de regras

Se a sua partida usa um conjunto de regras (veja [A ficha do conjunto](party-and-npcs.md#the-ruleset-sheet)) e esse conjunto diz que as batalhas podem ler a ficha, cada integrante da equipe começa a luta com a reserva de recursos e os espaços de magia que o conjunto preparou para batalhas, como estão na ficha naquele momento. As habilidades escolhidas nos catálogos do conjunto viram habilidades de combate quando o combate do Marinara consegue usá-las: uma entrada que só descreve algo fora de combate, uma reação ou uma cujo custo a batalha não consegue cobrar fica de fora. Os pontos de vida são levados como fração do máximo, e não como o número da própria ficha: um personagem com metade da vida na ficha começa a luta com metade da barra de vida que a tela de batalha dá a ele, porque os números da batalha são os do Marinara. Uma ficha com 9 de vida não entra em uma luta em que um golpe causa 12. Quando a luta termina, a vida perdida ou recuperada volta do mesmo jeito, e os espaços e recursos gastos são gravados como estão. O resto da batalha não muda: a matemática de dados desta página continua sendo a do Marinara, e rolagens de ataque, salvaguardas e concentração do sistema de mesa não são aplicadas. Uma luta que você abandona excluindo a mensagem em que ela começou não grava nada, porque não aconteceu. Um conjunto que não diz nada sobre batalhas deixa o combate exatamente como descrito aqui.

## O menu de ações

No seu turno, escolha uma ação do menu. As seis ações são:

- **Attack** (atacar): golpeia um inimigo com um ataque básico.
- **Skills** (habilidades): usa uma habilidade especial. Habilidades podem custar MP. Algumas curam um aliado, outras ferem um inimigo e outras aplicam um efeito positivo ou negativo.
- **Special** (ação livre): descreva uma ação com suas próprias palavras e clique em **Ask GM**. Por exemplo: "Eu chuto areia na lente rachada do Ruin Guard." O GM decide o que acontece.
- **Defend** (defender): aumenta a Defesa até o fim da rodada, para sofrer menos dano.
- **Items** (itens): usa um item da bolsa. Escolha **Full inventory** para abrir o inventário completo por ali mesmo. Em uma partida com conjunto de regras, os itens do próprio conjunto fazem o que o conjunto diz: quanto curam ou ferem e as condições que aplicam. Um item com cargas é oferecido enquanto restar um uso, e um que pede um teste antes tem esse teste rolado quando é usado: se falhar, ele é gasto à toa. Um item ao qual o conjunto não dá uso não é oferecido. O resto dos seus itens faz o que o Game Master avaliou quando a luta começou, a menos que o conjunto desative os itens próprios do Game Mode.
- **Flee** (fugir): sai da luta na hora. Fugir encerra o combate imediatamente.

Depois da escolha, a rodada acontece. Os resultados aparecem como números de dano flutuantes, mudanças nas barras de vida e linhas no registro de combate.

## Como funciona a matemática do combate

Começada a luta, cada rodada é decidida por uma matemática de dados fixa, e não pela IA. O GM apenas narra os resultados. Ele nunca decide quem acerta nem quanto dano cai. Assim o combate fica justo e previsível. Onde você ler "d20", entenda a rolagem de um dado de vinte lados, ou seja, um número de 1 a 20.

### Iniciativa (ordem dos turnos)

No início de cada rodada, todo combatente rola um d20 e soma um bônus de acordo com a Velocidade. Quem tem o total mais alto age primeiro. Um combatente pula a rodada inteira se estiver congelado, atordoado ou aprisionado, ou se a Velocidade dele tiver chegado a 0.

### Ataque e defesa

Quando um combatente ataca outro:

1. O atacante rola um d20 e soma um bônus vindo do atributo de Ataque.
2. O defensor rola um d20 e soma um bônus vindo do atributo de Defesa.
3. Se o total do atacante for menor que o do defensor, o ataque erra.
4. O acerto crítico acontece com um 20 natural, ou quando o atacante supera o defensor por 10 ou mais.

### Dano

No acerto, o dano-base vem do atributo de Ataque do atacante e cresce conforme o nível. Somam-se dados extras de dano, e combatentes de nível mais alto rolam mais dados. O acerto crítico multiplica o total por 1,5. Em seguida, a Defesa do defensor reduz o dano, bloqueando até 40 por cento do valor de Defesa.

### Ajuste pela dificuldade

O último passo ajusta o dano de acordo com a opção **Difficulty** (dificuldade) do jogo, definida no assistente de configuração. As quatro opções multiplicam o dano final assim:

| Dificuldade | Multiplicador de dano |
|---|---|
| Casual | 0.6 |
| Normal | 1.0 |
| Hard | 1.3 |
| Brutal | 1.6 |

Quanto maior a dificuldade, mais forte batem os dois lados. As lutas ficam mais curtas e mais arriscadas.

## Efeitos de status e reações elementais

O efeito de status é uma mudança temporária no Ataque, na Defesa, na Velocidade ou no HP de um combatente. Os efeitos positivos ajudam e os negativos atrapalham. Um status dura um número definido de rodadas e depois passa. Efeitos do tipo veneno drenam HP a cada rodada, enquanto efeitos do tipo regeneração devolvem HP. Três efeitos com nome próprio, congelado, atordoado e aprisionado, fazem o combatente afetado perder o turno.

Alguns ataques e habilidades carregam um elemento: Fire, Ice, Lightning, Poison, Holy ou Shadow. O primeiro elemento a atingir um alvo deixa uma aura, isto é, um rastro daquele elemento que continua ali. Quando um elemento diferente atinge o mesmo alvo, isso aciona uma reação elemental. A reação acrescenta dano bônus e, muitas vezes, um efeito de status.

Entre as reações possíveis estão Melt, Shatter, Overload, Superconduct, Toxic Blaze, Purification, Eclipse e Electrotoxin. Esse sistema funciona sozinho. Você não precisa ativar nem configurar nada. As reações acontecem automaticamente quando os elementos certos se encadeiam no mesmo alvo.

## Elementos

Ataques, habilidades e itens podem carregar um elemento, e um elemento que atinge um alvo ainda marcado pela aura de outro pode acionar uma reação que bate mais forte. Quais elementos existem depende do cenário: uma partida sem kit de cenário, ou com um que não nomeia nenhum, luta com os seis clássicos (fogo, gelo, raio, veneno, sagrado e sombra); uma partida wuxia, com as cinco fases (madeira, fogo, terra, metal e água, cada uma superando a seguinte); uma partida cyberpunk ou de space opera, com cinético, térmico, EM e químico ou plasma; e uma partida de dias atuais ou dos anos 1920, com nenhum. Chuva e tempestades em terreno aberto enfraquecem os elementos parecidos com fogo e fortalecem os parecidos com raio. Em uma luta tática, um elemento bate mais forte contra um que ele supera e mais fraco contra um que o supera. Você pode mudar os elementos de um kit e as reações deles em **Change its words** (mudar as palavras).

## Campos de batalha

O tabuleiro de uma luta tática é disposto como o tipo de lugar onde a luta acontece: uma floresta tem árvores para se esconder, uma masmorra tem paredes e corredores, uma cidade tem ruas. Uma partida com kit de cenário nomeia as próprias cenas com as palavras dele, cada uma disposta como um desses tabuleiros, então uma luta cyberpunk acontece em um terraço ou em um corredor de megabloco e uma luta wuxia em uma floresta de bambu ou em uma casa de chá, e as casas do tabuleiro também usam as palavras do cenário (cobertura e destroços em vez de floresta e ruínas). O mapa de uma área e os pequenos detalhes que o Game Master é instruído a notar seguem o cenário do mesmo jeito. Você pode mudar as cenas de um kit e as palavras das casas em **Change its words**.

## Mecânicas de chefe e loot

Inimigos fortes podem ter mecânicas de chefe, que são regras especiais escritas pelo GM para aquela luta. Uma mecânica pode ser acionada por agenda, a cada tantas rodadas, ou quando a vida do chefe cai abaixo de um valor definido. As mecânicas podem atingir a equipe inteira, fortalecer o chefe ou aplicar um efeito de status. Quando uma delas dispara, o efeito aparece no registro de combate para você reagir.

Ao vencer uma luta, os inimigos deixam loot, ou seja, itens caídos, que vão direto para as bolsas da equipe quando a luta termina. Cada item tem uma raridade, do mais comum ao mais raro: common, uncommon, rare, epic e legendary. A dificuldade mais alta puxa os itens para as raridades maiores e entrega um pouco mais deles. O que cai depende do seu cenário: uma partida com kit de cenário deixa o loot do próprio kit (uma partida de dias atuais deixa um vale-presente ou um kit de primeiros socorros, nunca uma espada encantada), e você pode mudar essas palavras em **Change its words**, no kit. Uma partida sem kit deixa o que o gênero dela costuma ter, e um gênero sem kit inicial, como Steampunk, deixa coisas simples que não pertencem a nenhum cenário em particular. Uma notificação diz o que caiu, e o Game Master fica sabendo que os itens já estão nas suas bolsas. Em uma partida cujo conjunto de regras tem tabelas de loot próprias, os inimigos deixam os itens do conjunto, e um conjunto que desativa os itens próprios do Game Mode deixa só os dele. Na vitória aparece o aviso **Victory!**, e se a equipe cair aparece o aviso **Defeat...**.

## Interromper o GM

Enquanto o GM ainda escreve a resposta, você pode cortar a narração com o botão **Interrupt** (interromper). Nada do que você digita é registrado antes do envio. Ao clicar em **Interrupt**, abre-se uma janela de confirmação chamada **Attempt to Interrupt?**, com três opções:

- **No**: cancela e deixa o GM continuar escrevendo.
- **Force Interrupt**: corta a narração direto. O GM não fica sabendo da interrupção. A caixa de mensagem ganha um contorno verde.
- **Yes**: tenta uma interrupção dentro da história, e o GM pode resistir. A caixa de mensagem fica vermelha e o aplicativo avisa "using dice recommended", com o botão de dados piscando. Rolar os dados aqui aumenta a chance de a tentativa dar certo.

Depois de confirmar, digite a mensagem e envie. Se mudar de ideia, clique em **Resume** para descartar a interrupção pendente e retomar a narração. Esse controle é útil num momento de tensão, como reagir no instante anterior ao início de uma luta.

## Quick-Time Events

O GM pode abrir um overlay de Quick-Time Events, também chamado de QTE, para cenas de ação rápida como desviar de um golpe ou perseguir alguém. O overlay mostra uma barra de contagem regressiva que encolhe, o aviso **React quickly!** e um botão para cada opção. Os botões são numerados (1, 2, 3 e assim por diante). Clique no botão da ação que você quer.

Escolha uma ação antes de o tempo acabar para ganhar um bônus. Quanto mais rápida a reação, maior o bônus. Se o tempo acabar antes, você leva uma penalidade. O Quick-Time Event não usa dados. Vale só a velocidade.

## Combate no celular

No celular, a tela de batalha se reorganiza para caber numa tela pequena. Os botões de ação ficam fixos na parte de baixo da tela. Os painéis que não cabem na tela vão para um painel lateral que sobe de baixo, com quatro abas:

- **Party** (equipe): os integrantes da equipe e a vida de cada um.
- **Boss Mechanics** (mecânicas de chefe): as regras especiais da luta atual.
- **Dialogue** (falas): as falas de batalha dos combatentes.
- **Combat Log** (registro de combate): o relato rodada a rodada do que aconteceu.

Toque numa aba para abrir o painel dela. Para fechar, toque fora do painel ou no botão de fechar.

## Guias relacionados

- [Game Mode: Dados e Testes de Perícia](dice-and-skill-checks.md)
- [Game Mode: Equipe e NPCs](party-and-npcs.md)
- [Game Mode: Primeiros Passos](getting-started.md)
- [Encontros de combate (Roleplay)](../roleplay/combat-encounters.md)
