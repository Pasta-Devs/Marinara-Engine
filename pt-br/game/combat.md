# Game Mode: combate

O combate no Game Mode tem dois tipos: batalhas **Classic**, com menus, e batalhas **Tactical**, em grade. Você escolhe entre eles em **Combat Preference** (preferência de combate), na etapa **World** (mundo) do assistente de configuração. Para mudar depois, abra **Chat Settings** (configurações do chat) e expanda **Combat Style** (estilo de combate). Ali, escolha um **Battle system** (sistema de batalha). Um conjunto de regras que conduz as próprias lutas pode limitar as opções. O Game Master (GM, a IA que conduz o jogo) monta o encontro e narra o resultado. Marinara resolve as ações de batalha com uma matemática de dados fixa, então a IA nunca decide quem acerta.

## Começar um encontro

Você não começa o combate. O GM inicia uma luta quando a história pede, por exemplo quando você provoca um inimigo ou cai numa emboscada. Uma tela de batalha completa então se abre por cima da narração, montada a partir do que está acontecendo na história: a sua equipe, os inimigos, os atributos deles e eventuais regras especiais.

A tela mostra a sua equipe de um lado e os inimigos do outro. Cada combatente tem uma barra de vida (HP, pontos de vida) e, se usar habilidades, uma barra de magia (MP, pontos de magia). O topo mostra **Next:** (próximo) e o nome de quem age em seguida, e **Round** (rodada) com o número da rodada.

> **Observação:** Em uma partida com um conjunto de regras que resolve as próprias lutas, como 5e (SRD 5.1), a luta segue o conjunto de regras, e não esta página. Veja [Lutas com um conjunto de regras](fighting-on-a-ruleset.md). Um conjunto de regras que só empresta a ficha dele às batalhas mantém o combate daqui. Veja [O que acontece nas batalhas](rulesets.md#what-happens-in-battles).

## Jogar uma batalha Classic

Uma batalha Classic não tem tabuleiro. Todos os integrantes da equipe participam. Você escolhe a ação de um personagem, o primeiro integrante vivo da equipe. Os outros companheiros agem por conta própria.

No seu turno, escolha uma ação:

| Ação | O que faz |
| --- | --- |
| **Attack** (atacar) | Golpeia um inimigo com um ataque básico. |
| **Skills** (habilidades) | Usa uma habilidade especial. Habilidades podem custar MP. Algumas curam um aliado, outras atingem um inimigo e outras aplicam um efeito positivo ou negativo (buff ou debuff). |
| **Special** (ação livre) | Digite uma ação livre com as suas próprias palavras e depois pressione **Ask GM** (perguntar ao GM), por exemplo "Eu chuto areia na lente rachada do Ruin Guard." O GM decide o que acontece. |
| **Defend** (defender) | Aumenta a sua Defesa até o fim da rodada, então você sofre menos dano. |
| **Items** (itens) | Usa um item da sua bolsa. **Full inventory** (inventário completo) abre a lista completa dos seus itens. |
| **Flee** (fugir) | Sai da luta na hora. Sempre funciona e encerra o combate imediatamente. |

Depois da escolha, a rodada acontece. Os resultados aparecem como números de dano flutuantes, mudanças nas barras de vida e linhas em **Combat Log** (registro de combate). Uma faixa **Victory!** aparece quando você vence, e uma faixa **Defeat...** se a sua equipe cair.

Em uma partida com um conjunto de regras, **Items** faz o que o conjunto de regras diz para os itens do próprio conjunto: quanto eles curam ou ferem e quais condições acrescentam. Um item com cargas é oferecido enquanto restar um uso. Um item que pede um teste antes tem esse teste rolado, e, se o teste falhar, o item é gasto à toa. Um item ao qual o conjunto de regras não dá uso não é oferecido. Os outros itens fazem o que o GM avaliou quando a luta começou, a menos que o conjunto de regras desative os itens próprios do Game Mode.

## Jogar uma batalha Tactical

O combate Tactical coloca a sua equipe e os inimigos em um campo de batalha em grade. Cada quadrado é uma casa, como **Plains** (planície) ou **Forest** (floresta).

1. Quando for o seu turno (o tabuleiro mostra **Player Phase**, ou o nome de uma unidade seguido de "'s turn"), clique em uma das suas unidades na grade. O alcance de movimento dela aparece no tabuleiro.
2. Clique em uma casa de destino e depois em **Confirm Move** (confirmar movimento). Clique em **Reset Move** (refazer movimento) para escolher de novo.
3. Depois de mover, o tabuleiro diz "Already moved — choose an action." Escolha **Attack**, **Defend** ou **Item**. **Flee** também fica aqui.
4. Em **Attack**, o tabuleiro diz **Select an enemy** (selecione um inimigo). Clique em um. A previsão de ataque mostra o resultado esperado. Clique em **Confirm** (confirmar) para efetivar. **← Back** (voltar) volta um passo.
5. Clique em **End Turn** (encerrar turno) quando terminar. Na ordem de turnos em que a equipe age primeiro, a **Enemy Phase** (fase inimiga) acontece em seguida.

Se o tabuleiro mostrar **Resolving…**, espere um momento. **Restart** (reiniciar) recomeça a batalha do início no mesmo campo de batalha, depois que você confirmar.

Quem age e quando depende de **Turn order** (ordem dos turnos). Veja [Ordem dos turnos](#turn-order). Os tabuleiros feitos à mão e as regras de terreno estão em [Batalhas táticas e terreno](#tactical-battles-and-terrain).

## Interromper o GM

Enquanto o GM escreve, você pode cortar a narração com o botão **Interrupt** (interromper). Nada do que você digita é registrado antes do envio.

1. Clique em **Interrupt**. Abre-se uma janela chamada **Attempt to Interrupt?** (tentar interromper?).
2. Escolha uma opção:
   - **No** (não) cancela e deixa o GM continuar escrevendo.
   - **Force Interrupt** (forçar interrupção) corta a narração direto. O GM não fica sabendo que você interrompeu. A sua caixa de mensagem ganha um contorno verde.
   - **Yes** (sim) tenta uma interrupção dentro da história, à qual o GM pode resistir. A sua caixa de mensagem fica vermelha e o aplicativo sugere "using dice recommended" enquanto o botão de dados pulsa. Rolar os dados pode ajudar.
3. Digite a sua mensagem e envie.

Para mudar de ideia, pressione **Resume** (retomar). Isso descarta a interrupção pendente e a narração continua.

## Quick-Time Events

O GM pode acionar um Quick-Time Event (QTE) em momentos rápidos, como desviar de um golpe ou perseguir alguém. O overlay mostra uma barra de contagem regressiva que encolhe, o aviso **React quickly!** (reaja rápido!) e um botão numerado para cada opção. Clique na ação que você quer antes de o tempo acabar para ganhar um bônus. Quanto mais rápida a reação, maior o bônus. Se o tempo acabar, você leva uma penalidade. Um QTE não usa dados.

Para jogar com leitor de tela ou sem limite de tempo, desligue os QTEs: desative **Quick Time Events** na etapa **Features** (recursos) do assistente.

## Combate no celular

No celular, os botões de ação ficam fixos na parte de baixo da tela. Os painéis que não cabem vão para uma gaveta que sobe de baixo, com quatro abas: **Party** (os integrantes e a vida deles), **Boss Mechanics** (as regras especiais da luta), **Dialogue** (as falas de batalha dos combatentes) e **Combat Log** (o registro rodada a rodada). Toque em uma aba para abrir a gaveta dela. Toque fora da gaveta ou no botão de fechar dela para fechá-la.

<a id="how-combat-math-works"></a>

## Como funciona a matemática do combate

Cada rodada é decidida por uma matemática de dados fixa, e não pela IA. Assim o combate fica justo e consistente. Um d20 é um dado de vinte lados (de 1 a 20). As regras de iniciativa, ataque e dano abaixo são as das batalhas Classic. São as regras próprias do Marinara, e não as de um conjunto de regras. Para as batalhas Tactical, veja [Ordem dos turnos](#turn-order) e [Visão, cobertura e altura](#sight-cover-and-height).

**Iniciativa.** No início de cada rodada, todo combatente rola um d20 e soma um bônus vindo da Velocidade (a Velocidade dividida por 5, arredondada para baixo). Os totais mais altos agem primeiro. Um combatente pula a rodada se estiver congelado, atordoado ou aprisionado, ou se a Velocidade dele tiver caído para 0.

**Ataque e defesa.** Quando um combatente ataca outro:

1. O atacante rola um d20 e soma um bônus vindo do atributo de Ataque.
2. O defensor rola um d20 e soma um bônus vindo do atributo de Defesa.
3. Se o total do atacante for menor, o ataque erra.
4. Um acerto crítico acontece com um 20 natural, ou quando o atacante supera o defensor por 10 ou mais.

**Dano.** No acerto, o dano-base vem do atributo de Ataque do atacante e cresce com o nível. Somam-se dados d6 extras, e combatentes de nível mais alto rolam mais deles. Um acerto crítico multiplica o total por 1,5. Em seguida, a Defesa do defensor bloqueia desse dano até 40 por cento do próprio valor.

<a id="difficulty-scaling"></a>

### Ajuste pela dificuldade

Depois, o dano é ajustado pela **Difficulty** (dificuldade) que você definiu no assistente de configuração. Os modificadores de clima e de efeitos de status entram depois disso. O multiplicador vale só para os ataques dos inimigos, então uma partida mais difícil faz os inimigos baterem mais forte, enquanto o dano da sua equipe continua o mesmo.

| Dificuldade | Multiplicador do dano inimigo |
| --- | --- |
| Casual | 0,6 |
| Normal | 1,0 |
| Hard | 1,3 |
| Brutal | 1,6 |

Esses multiplicadores fazem parte das regras próprias do Marinara. Um conjunto de regras traz a própria política de dificuldade.

## Efeitos de status e reações elementais

Um efeito de status é uma mudança temporária no Ataque, na Defesa, na Velocidade ou no HP de um combatente. Os efeitos positivos ajudam e os negativos atrapalham. Um status dura um número definido de rodadas e depois passa. Efeitos do tipo veneno drenam HP a cada rodada, e efeitos do tipo regeneração devolvem HP. Congelado, atordoado e aprisionado fazem o combatente perder o turno.

Alguns ataques e habilidades carregam um elemento. O primeiro elemento a atingir um alvo deixa uma aura, um rastro que continua ali. Quando um elemento diferente atinge o mesmo alvo, ele aciona uma reação elemental, que acrescenta dano bônus e, muitas vezes, um efeito de status. Entre as reações estão Melt, Shatter, Overload, Superconduct, Toxic Blaze, Purification, Eclipse e Electrotoxin. Elas acontecem automaticamente, e você não precisa ativá-las.

### Elementos

Quais elementos existem depende do cenário:

- Sem kit de cenário, ou com um kit que não nomeia nenhum: os seis clássicos (fogo, gelo, raio, veneno, sagrado, sombra).
- Wuxia: as cinco fases (madeira, fogo, terra, metal, água), cada uma superando a seguinte.
- Cyberpunk e space opera: cinético, térmico, EM e químico ou plasma.
- Dias atuais e anos 1920: nenhum.

Chuva e tempestades em terreno aberto enfraquecem os elementos parecidos com fogo e fortalecem os parecidos com raio. Em uma luta tática, um elemento bate mais forte contra um que ele supera e mais fraco contra um que o supera. Você pode mudar os elementos e as reações de um kit em **Change its words** (mudar as palavras). Veja [Escolher um kit de cenário](getting-started.md#choosing-a-setting-kit).

## Mecânicas de chefe e loot

Inimigos fortes podem ter mecânicas de chefe, regras especiais que o GM escreve para aquela luta. Uma mecânica é acionada em um intervalo definido, como a cada tantas rodadas, ou quando a vida do chefe cai abaixo de um valor definido. Ela pode atingir a equipe inteira, fortalecer o chefe ou aplicar um efeito de status. Quando uma é acionada, **Combat Log** mostra isso para você poder reagir.

Quando você vence, os inimigos deixam loot (itens caídos), que vai direto para as bolsas da equipe. Os itens têm uma raridade, de common a uncommon, rare, epic e legendary. A dificuldade mais alta puxa os itens para as raridades maiores e entrega um pouco mais deles. Uma notificação diz o que caiu, e o GM fica sabendo que os itens já estão nas suas bolsas.

O que cai depende do seu cenário. Uma partida com kit de cenário deixa o loot do próprio kit (uma partida de dias atuais deixa um vale-presente ou um kit de primeiros socorros, nunca uma espada encantada), e você pode mudar essas palavras em **Change its words**. Uma partida sem kit deixa o que o gênero dela costuma ter. Um gênero sem kit inicial, como Steampunk, deixa coisas simples que não pertencem a nenhum cenário. Em uma partida cujo conjunto de regras tem tabelas de loot próprias, os inimigos deixam os itens do conjunto, e um conjunto de regras que desativa os itens próprios do Game Mode deixa só os dele.

## Referência: batalhas táticas

<a id="tactical-battles-and-terrain"></a>

### Batalhas táticas e terreno

Não há configurações de campo de batalha para preencher ao criar uma partida. Cada luta recebe um tabuleiro próprio, gerado a partir de uma nova semente e da descrição breve do GM para a cena. O GM fornece o ambiente, a formação e uma descrição breve do terreno, que pode pedir áreas de terreno e barreiras perto do centro ou de uma borda. Marinara cria as casas exatas e as posições iniciais. O campo de batalha aceito fica salvo, então recarregar a página restaura esse tabuleiro.

Marinara verifica a descrição e a disposição. O terreno pedido é preservado, e o encontro continua alcançável.

Se as restrições não couberem juntas, a batalha informa o problema. **Use generated terrain** (usar terreno gerado) então começa sem os elementos de terreno rejeitados. Eles nunca são removidos em silêncio.

Um mundo também pode ter campos de batalha feitos à mão: tabuleiros pintados casa por casa para um dos lugares dele, com um editor de mundos como o Pixelforge. Quando uma luta começa nesse lugar, ou dentro dele, ela usa um desses tabuleiros em vez de um gerado.

- O tabuleiro é usado exatamente como foi pintado. Se o lugar tiver vários, a semente da luta (um número que escolhe um deles) decide.
- A descrição de terreno do GM não é usada nesse caso, mas a formação dele continua decidindo onde cada lado começa. O GM fica sabendo que o tabuleiro foi feito para esse lugar.
- Um tabuleiro feito à mão precisa seguir três regras: ele tem um dos três tamanhos de tabuleiro, as duas colunas de cada lado são planícies, onde os lados se posicionam, e toda casa em que um combatente pode ficar se conecta ao resto. O criador recusa um tabuleiro que quebre uma regra e diz por quê.

Esses tabuleiros ficam guardados com as edições manuais do mundo, então viajam em arquivos de mundo, pacotes de mapa e na biblioteca.

| Terreno | Caminhada | Defesa e esquiva |
| --- | --- | --- |
| Planície | Custa 1 ponto de movimento | Sem bônus |
| Floresta | Custa 2 pontos de movimento | +1 de defesa, +15 pontos percentuais de esquiva |
| Ruínas | Custa 1 ponto de movimento | +1 de defesa, +10 pontos percentuais de esquiva |
| Montanha, água, parede | Bloqueia a caminhada | Sem bônus |

Unidades com uma capacidade estabelecida de voo ou teletransporte se movem de outra forma:

- **Caminhada** segue casas de chão alcançáveis. Unidades inimigas bloqueiam o caminho, e as unidades não podem terminar em uma casa ocupada.
- **Voo** atravessa terreno e unidades a um ponto de movimento por casa, inclusive florestas. Uma unidade voadora pode pairar sobre uma casa que de outra forma estaria bloqueada, mas não pode terminar sobre outra unidade.
- **Teletransporte** ignora o terreno e as unidades no caminho. O destino precisa estar dentro do alcance de movimento, desocupado e ser transitável a pé. Não pode terminar dentro de uma parede, sobre uma montanha nem sobre água sem apoio.

Os dois modos especiais usam a capacidade de movimento atual e a distância em linha reta (não diagonal) entre casas. Eles mantêm os bônus de defesa e esquiva do terreno de destino e ignoram a altura. A altitude de uma unidade voadora, tetos, custos específicos de magias e exigências de visão específicas de magias não são representados. A invocação ainda não faz parte do combate próprio do Marinara.

<a id="turn-order"></a>

### Ordem dos turnos

Uma batalha Tactical organiza os turnos de uma de duas formas:

- **One at a time, by initiative** (um por vez, por iniciativa): cada unidade recebe um lugar em uma ordem rolada, e só a unidade da vez pode agir. O tabuleiro mostra a ordem. As partidas Overworld RPG novas usam esta forma.
- **Your whole party, then the enemies** (toda a sua equipe, depois os inimigos): cada unidade da equipe pode agir, e depois acontece a fase inimiga. As partidas Classic usam esta forma.

Para mudar, abra **Chat Settings**, expanda **Combat Style** e escolha uma **Turn order**. A opção aparece enquanto o **Battle system** é Tactical, a menos que o conjunto de regras da partida conduza as próprias lutas. A mudança vale a partir da próxima batalha. Uma batalha em andamento mantém a ordem dela.

<a id="sight-cover-and-height"></a>

### Visão, cobertura e altura

- **Visão.** Paredes e montanhas bloqueiam a visão. Uma unidade só pode atacar, usar uma habilidade ou usar um item em um alvo que consegue ver.
- **Cobertura.** Algo entre o atacante e o alvo protege o alvo. Uma casa de floresta ou de ruínas no caminho, ou uma parede ou montanha que bloqueia parte da visão, dá meia cobertura. Uma parede ou montanha que bloqueia a maior parte da visão dá cobertura de três quartos. A meia cobertura tira 15 pontos percentuais da chance de acerto, e a de três quartos, 30. O bônus da própria casa do alvo e a cobertura dele não se somam: vale o melhor.
- **Altura.** Em um tabuleiro com montanhas, uma montanha tem dois níveis de altura, e o chão em volta dela, um nível. Subir um nível custa um ponto de movimento a mais, e descer não custa nada. Um degrau de dois níveis ou mais é um penhasco, que ninguém consegue atravessar a pé. Um terreno mais alto também bloqueia a visão entre duas casas mais baixas. Atacar de cima para baixo a partir de um terreno mais alto soma 10 à chance de acerto, um ataque à distância a partir de um terreno mais alto alcança uma casa a mais, e uma cobertura baixa, como uma floresta, não esconde um alvo visto de cima. Campos de batalha feitos à mão podem ter os próprios penhascos.

### Cenas de campo de batalha

Um tabuleiro tático é disposto como o tipo de lugar onde a luta acontece: uma floresta tem árvores para se esconder, uma masmorra tem paredes e corredores, uma cidade tem ruas. Uma partida com kit de cenário nomeia as próprias cenas com as palavras dele, então uma luta cyberpunk acontece em um terraço ou em um corredor de megabloco, e uma luta wuxia em uma floresta de bambu ou em uma casa de chá. As casas do tabuleiro também usam as palavras do cenário (cobertura e destroços em vez de floresta e ruínas). Você pode mudar as cenas e as palavras das casas de um kit em **Change its words**.

## Guias relacionados

- [Game Mode: lutas com um conjunto de regras](fighting-on-a-ruleset.md)
- [Game Mode: dados e testes de perícia](dice-and-skill-checks.md)
- [Game Mode: equipe e NPCs](party-and-npcs.md)
- [Game Mode: primeiros passos](getting-started.md)
- [Encontros de combate (Roleplay)](../roleplay/combat-encounters.md)
