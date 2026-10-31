# Game Mode: combate

Este guia explica o combate no Game Mode do Marinara Engine. Na etapa **World** (mundo) do assistente, escolha **Classic** (combate por menus) ou **Tactical** (combate em grade) em **Combat Preference** (preferência de combate). O Game Master de IA (GM) define o encontro e narra os resultados; o motor resolve as ações de combate.

## Começar um encontro

O combate nunca começa por sua iniciativa. É o GM que inicia a luta quando a história pede, por exemplo quando você provoca um inimigo ou cai numa emboscada. Nesse momento, uma tela de batalha completa se abre por cima da narração. Marinara monta a luta a partir do que está acontecendo na história: a equipe, os inimigos, os atributos de cada um e as regras especiais.

A tela de batalha mostra a equipe de um lado e os inimigos do outro. Cada combatente tem uma barra de vida (HP, pontos de vida) e, se usar habilidades, uma barra de magia (MP, pontos de magia). A ordem dos turnos aparece no topo, como **Next:** seguido do nome de quem age em seguida. Um contador mostra **Round** e o número da rodada atual.

Em uma partida cujo conjunto de regras resolve suas próprias lutas, como 5e (SRD 5.1), a luta segue o conjunto de regras, e não o combate descrito nesta página. Veja [Lutas com um conjunto de regras](fighting-on-a-ruleset.md). Um conjunto de regras que empresta sua ficha às batalhas mantém o combate desta página; veja [O que acontece nas batalhas](rulesets.md#what-happens-in-battles).

<a id="tactical-battles-and-terrain"></a>

## Batalhas táticas e terreno

O combate tático posiciona seu grupo e os inimigos no campo de batalha. Selecione uma unidade, confira o alcance de movimento, escolha destino e ação e confirme. Quem age e quando depende da **Turn order** (ordem dos turnos) da batalha; veja [Ordem dos turnos](#turn-order). As previsões de ataque mostram as consequências esperadas antes da confirmação.

Não há configurações de campo de batalha para preencher ao criar uma partida. Cada luta recebe um tabuleiro próprio, gerado a partir de uma nova semente e da descrição breve do GM para aquela cena.

O GM fornece ambiente, formação e uma descrição breve do terreno. O motor cria as casas e posições iniciais exatas. A descrição pode pedir áreas e barreiras perto do centro ou das bordas do mapa. O campo aceito fica salvo; recarregar restaura esse tabuleiro.

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

A invocação ainda não faz parte do combate próprio do Marinara.

## Batalhas clássicas

Uma batalha Classic não tem tabuleiro. Todos os integrantes da equipe participam, mas a ação escolhida controla o primeiro integrante vivo da equipe; os demais companheiros agem por conta própria. O menu de ações e os cálculos de combate abaixo descrevem como as batalhas Classic funcionam.

## O menu de ações

No seu turno, escolha uma ação do menu. As seis ações são:

- **Attack** (atacar): golpeia um inimigo com um ataque básico.
- **Skills** (habilidades): usa uma habilidade especial. Habilidades podem custar MP. Algumas curam um aliado, outras ferem um inimigo e outras aplicam um efeito positivo ou negativo.
- **Special** (ação livre): descreva uma ação com suas próprias palavras e clique em **Ask GM**. Por exemplo: "Eu chuto areia na lente rachada do Ruin Guard." O GM decide o que acontece.
- **Defend** (defender): aumenta a Defesa até o fim da rodada, para sofrer menos dano.
- **Items** (itens): usa um item da bolsa. Escolha **Full inventory** para abrir o inventário completo por ali mesmo. Em uma partida com conjunto de regras, os itens do próprio conjunto fazem o que o conjunto diz: quanto curam ou ferem e as condições que aplicam. Um item com cargas é oferecido enquanto restar um uso, e um que pede um teste antes tem esse teste rolado quando é usado: se falhar, ele é gasto à toa. Um item ao qual o conjunto não dá uso não é oferecido. O resto dos seus itens faz o que o Game Master avaliou quando a luta começou, a menos que o conjunto desative os itens próprios do Game Mode.
- **Flee** (fugir): sai da luta na hora. Fugir encerra o combate imediatamente.

Depois da escolha, a rodada acontece. Os resultados aparecem como números de dano flutuantes, mudanças nas barras de vida e linhas no registro de combate.

<a id="how-combat-math-works"></a>

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

- [Game Mode: lutas com um conjunto de regras](fighting-on-a-ruleset.md)
- [Game Mode: Dados e Testes de Perícia](dice-and-skill-checks.md)
- [Game Mode: Equipe e NPCs](party-and-npcs.md)
- [Game Mode: Primeiros Passos](getting-started.md)
- [Encontros de combate (Roleplay)](../roleplay/combat-encounters.md)
