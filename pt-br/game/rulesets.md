# Game Mode: jogar com um conjunto de regras

Um conjunto de regras informa ao Game Mode como funciona um sistema de mesa: quais dados um teste rola, o que há na ficha, quais recursos são gastos, o que um descanso recupera e, em alguns conjuntos de regras, como uma luta inteira é travada. Este guia explica como obter um conjunto de regras, escolhê-lo para uma partida e o que muda ao jogar com ele. Uma partida sem um conjunto usa as regras do próprio Marinara, descritas nos outros guias de Game Mode.

<a id="getting-a-ruleset"></a>

## Obter um conjunto de regras

Os conjuntos de regras vêm de dois lugares. Os oficiais, como 5e (SRD 5.1), são instalados em **Agent Organizer (organizador de agentes)**, onde aparecem marcados como **Rules**. Os da comunidade são importados de um arquivo ou do repositório GitHub de um autor e ficam arquivados sob a origem deles, como `local/ember-roads` ou `alice/v20`. A importação usa a mesma opção **Allow custom Agent imports** dos agentes importados. Enquanto essa opção está desligada, os conjuntos importados ficam de fora das partidas novas, e as partidas que já usam um continuam funcionando. Uma partida com um conjunto importado sempre joga na versão exata em que foi criada. Para escrever o seu, veja [Escrever conjuntos de regras de Game Mode](../extending/writing-rulesets.md).

### Idioma

O texto do próprio conjunto de regras, como os nomes das perícias, as magias e o texto para o Game Master, segue o idioma definido em **Settings** (Configurações). Um conjunto de regras oficial baixa apenas a tradução desse idioma, busca a nova quando você muda de idioma e usa o inglês como alternativa para um idioma para o qual não foi traduzido. Um conjunto de regras importado de um arquivo mantém apenas a tradução do idioma que você usava ao importá-lo; para mudar, importe o arquivo novamente.

<a id="choosing-a-ruleset-for-a-game"></a>

## Escolher um conjunto de regras para uma partida

**Rules** (regras) só aparece quando há pelo menos um conjunto de regras instalado, e só para uma partida nova. Essa opção é separada de **Combat Preference**: uma decide como funcionam os testes e as fichas de personagem, a outra decide como as batalhas são mostradas.

- **Marinara's own rules** é o padrão: os testes d20 integrados e a ficha de seis atributos.
- **Um conjunto de regras**, como **5e (SRD 5.1)**, mostra um resumo curto do que cobre e uma linha dizendo o que as batalhas vão fazer. Um conjunto que resolve as próprias lutas diz isso. Um que só empresta a ficha diz que as batalhas rodam no combate do Marinara com a saúde, a energia e as habilidades da própria ficha. Um que não faz nenhuma das duas coisas diz que as batalhas rodam no combate do Marinara e nomeia a **Combat Preference** que você escolheu.

O conjunto de regras é definido quando a partida é criada e fica com ela. Não é possível trocá-lo nem acrescentá-lo depois.

Alguns conjuntos oferecem **layers** (camadas): variantes nomeadas, como Low magic ou Hard winter, mostradas como botões liga/desliga abaixo do conjunto, com uma linha dizendo o que cada uma faz. Uma camada pode deixar as dificuldades mais duras, restringir uma escolha na ficha de personagem, deixar algumas entradas prontas fora do seletor do editor de fichas, mudar quais lojas vendem o quê e quais tesouros caem e dar instruções extras ao Game Master, inclusive para o mundo que ele cria na configuração. Algumas camadas excluem umas às outras, e o assistente desativa a que você não pode ter. As camadas ficam fixas quando a partida começa, exatamente como o próprio conjunto, e uma ficha que já usa algo que uma camada retira continua com isso.

Depois que você escolhe um conjunto, a etapa **Party** lista a sua persona e os integrantes da equipe abaixo dos seletores e diz quem **Has a sheet** (tem ficha) para ele e quem **Starts on a blank sheet** (começa com ficha em branco). Uma ficha é adicionada em **Stats** no editor de personagem ou de persona (veja [Fichas de conjuntos de regras](../characters/colors-and-stats.md#ruleset-sheets)). A partida copia cada ficha quando o mundo é gerado. Nada do que você muda na partida volta para o personagem ou a persona. Um integrante sem ficha recebe uma em branco, com todos os valores no padrão do conjunto; a geração do mundo nunca inventa valores.

Um arquivo de configuração compartilhado lembra o conjunto dele. Se você importar um e não tiver esse conjunto, ou tiver uma versão mais antiga dele, o assistente diz qual era o conjunto, e a partida usa as regras próprias do Marinara, a menos que você o instale e o escolha.

<a id="what-happens-in-battles"></a>

## O que acontece nas batalhas

O que um conjunto de regras faz em uma luta depende de como foi escrito. A linha do assistente de configuração abaixo do conjunto informa qual destas opções se aplica.

| O conjunto de regras | Batalhas |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Resolve as próprias lutas, como 5e (SRD 5.1) | Travadas segundo as regras do próprio conjunto, na própria tela de batalha dele. Veja [Lutas com um conjunto de regras](fighting-on-a-ruleset.md). |
| Empresta a ficha para as batalhas | O combate do próprio Marinara, usando a saúde, os espaços de magia e as habilidades da ficha. Veja abaixo. |
| Não diz nada sobre batalhas | O combate do próprio Marinara, exatamente como em uma partida sem conjunto de regras. Veja [Combate](combat.md). |

Quando o conjunto empresta a ficha para as batalhas, cada integrante da equipe começa a luta com a reserva de recursos e os espaços de magia que o conjunto preparou para batalhas, como estão na ficha naquele momento. As habilidades escolhidas nos catálogos do conjunto viram habilidades de combate quando o combate do Marinara consegue usá-las: uma entrada que só descreve algo fora de combate, uma reação ou uma cujo custo a batalha não consegue cobrar fica de fora. Os pontos de vida são levados como fração do máximo, e não como o número da própria ficha: um personagem com metade da vida na ficha começa a luta com metade da barra de vida que a tela de batalha dá a ele, porque os números da batalha são os do Marinara. Uma ficha com 9 de vida não entra em uma luta em que um golpe causa 12. Quando a luta termina, a vida perdida ou recuperada volta do mesmo jeito, e os espaços e recursos gastos são gravados como estão. O resto da batalha não muda: a matemática de dados continua sendo a do Marinara (veja [Como funciona a matemática do combate](combat.md#how-combat-math-works)), e rolagens de ataque, salvaguardas e concentração do sistema de mesa não são aplicadas. Uma luta que você abandona excluindo a mensagem em que ela começou não grava nada, porque não aconteceu.

<a id="checks-on-a-ruleset"></a>

## Testes com um conjunto de regras

Com um conjunto de regras, o Game Master pede testes como em qualquer partida (veja [Testes de perícia](dice-and-skill-checks.md#skill-checks)), mas o conjunto decide como eles são rolados:

- O Game Master continua apenas nomeando a perícia ou a salvaguarda e definindo uma dificuldade. Ele recebe a escala de dificuldade do próprio conjunto, em vez da escala integrada. Uma dificuldade pode ir até onde essa escala for, mesmo além do intervalo de 1 a 40 que as regras do Marinara permitem. Um caminho continua limitado a 1–40 mesmo em uma partida com conjunto de regras: a alternativa que rola um teste ainda pendente em um turno salvo.
- O motor rola os dados do conjunto e soma o modificador da **ficha do conjunto** do personagem, formada pelas partes que o conjunto declara: o modificador de atributo quando a perícia ou a salvaguarda nomeia um atributo, o bônus do nível de treinamento (um múltiplo de um bônus de proficiência, um número fixo ou os dois) e qualquer bônus extra informado na ficha. Os bônus de perícia e os atributos integrados não são usados.
- Um teste pode ser de um integrante da equipe. O Game Master acrescenta `who="Name"` à marcação, e o motor usa a ficha desse personagem. Sem `who`, o teste é do jogador. Um integrante que ainda não tem ficha rola com uma ficha em branco, com todos os valores no padrão do conjunto. Um nome que não corresponde a ninguém da equipe, ou que dois integrantes compartilham, rola os dados sem nenhum modificador. A única exceção é o nome do seu próprio personagem: se um integrante tiver o mesmo nome, esse nome continua significando você e usa a sua ficha. O motor nunca pega emprestada a ficha de outra pessoa.
- Os resultados naturais seguem o conjunto. Em 5e (SRD 5.1), um 20 natural ou um 1 natural não tem efeito especial em testes e salvaguardas, então um 20 natural que não alcança a dificuldade falha. Isso difere de propósito das regras do próprio Marinara.
- Os números que o próprio Game Master escreve não são aceitos sem verificação. Uma marcação com cara de concluída é rolada de novo e substituída quando o modificador não é o da ficha, quando rolou uma quantidade ou um tamanho de dados diferente do que o conjunto usa, quando o dado contado não é o que o modo de rolagem mantém, ou quando alega um resultado natural que o conjunto não tem.
- Um dado que você mesmo rolou antes do teste só é usado quando o conjunto rola um único d20. Um conjunto que rola outros dados, como 2d6 ou uma parada, o ignora e rola normalmente.
- O Game Master pode rolar uma perícia ou uma salvaguarda com um atributo diferente do habitual, acrescentando `with="Ability"` à marcação. Só vale um atributo que o seu conjunto declara; qualquer outro é ignorado, e a perícia mantém o dela.
- O Game Master pode nomear uma dificuldade da escala em vez de escrever o número dela, como `difficulty="Hard"`. O motor rola contra o número desse degrau, e o teste salvo mostra o número. Um nome que a escala não tem é ignorado.
- Os marcadores de rolagem podem nomear os atributos, as perícias e as salvaguardas do conjunto, e `PROF` para o bônus de proficiência quando o conjunto tem um.
- Se o pacote do conjunto estiver ausente ou for mais antigo que aquele com que a partida foi criada, os testes são salvos sem números e continuam pendentes. Eles nunca são rolados com as regras de outro sistema.
- Se algo na sua ficha modifica uma rolagem, como um amuleto que rola de novo os dados que caíram mal, o Game Master o nomeia no teste e o motor faz o resto: cobra o custo do amuleto, aplica o efeito e rola. Um amuleto que você não escolheu, ou que não consegue pagar, não faz nada e não custa nada.
- Se o conjunto permite gastar um recurso para firmar uma rolagem, o Game Master indica isso no próprio teste e o motor faz as duas coisas de uma vez: cobra os pontos, soma o que eles compraram e rola. Se a reserva não cobrir o custo, nada é gasto e a rolagem é a que seria sem isso. O registro mostra o que realmente foi pago, não o que foi pedido. Quanto um teste pode comprar é definido pelo conjunto: um número fixo, um número da sua ficha ou tantos quantos dados o teste tiver.
- Se o conjunto diz que um número da sua ficha acompanha certas rolagens, como uma mochila pesada em toda rolagem de Brawn, o motor o soma a todo teste em que ele se aplica, e o cartão de dados diz o que a ficha acrescentou.
- Um conjunto pode dizer o que acontece com um teste quando você não tem treinamento na perícia: ele pode custar dados ou pontos, ficar um degrau mais difícil ou nem ser possível. Um teste que você não pode tentar sem treinamento não é rolado, e a narração diz isso em vez de mostrar um resultado. A sua ficha não mostra número para uma perícia assim até você treiná-la.
- Se o conjunto tem uma trilha de ferimentos e diz que a penalidade dela vale nas rolagens, estar ferido deixa todo teste mais difícil. Em um conjunto de paradas, ela tira essa quantidade de dados da parada, nunca abaixo da menor parada que o conjunto permite, que alguns sistemas definem como nenhum dado. Em um conjunto que soma os dados, é uma penalidade fixa na rolagem. De qualquer forma, o teste diz quanto foi aplicado, para que você veja por que rolou menos dados. Veja [A ficha do conjunto](#the-ruleset-sheet).
- O Game Master também mantém atualizados na ficha os recursos, as condições e os descansos de cada personagem, e o motor recusa uma alteração que a ficha não permite. Veja [A ficha do conjunto](#the-ruleset-sheet).

### Conjuntos com paradas de dados

Alguns sistemas não somam um bônus à rolagem. Em vez disso, o número da ficha é quantos dados você rola, e você conta os que saem altos o bastante. Um conjunto de regras pode ser escrito assim, e uma partida com ele se comporta de um jeito um pouco diferente:

- **O número da ficha é uma quantidade de dados.** Um atributo 3 e um ofício que vale 2 rolam cinco dados. A sua ficha mostra isso como "5 dice" em vez de "+5", no editor e no que o Game Master lê.
- **A dificuldade é uma contagem de sucessos.** Um trabalho difícil pede três sucessos, não um total de 15. A escala de dificuldade do conjunto diz quantos cada degrau exige.
- **O motor rola os dados e os conta.** Quais faces contam, se uma face alta rola outro dado ou conta em dobro, se faces baixas cancelam sucessos e o que conta como tropeço (fumble) ou como sucesso excepcional: tudo isso vem do conjunto. O cartão de dados mostra todos os dados rolados, separando os que alcançaram o alvo dos que não alcançaram, e mostra quantos sucessos saíram contra quantos o teste exigia. Uma parada grande ocupa mais linhas em vez de encolher, e o cartão nunca mostra uma soma quando os dados não foram somados.
- **O Game Master pode ajustar um teste**, se o conjunto permitir: um alvo por dado mais difícil ou mais fácil, dados acrescentados ou retirados pelas circunstâncias, e uma face mais baixa a partir da qual os dados rolam de novo ou contam em dobro. Cada ajuste fica dentro do intervalo que o conjunto declara. Um degrau da escala de dificuldade pode ter o próprio alvo por dado, que vale quando o Game Master escolhe esse degrau. O cartão de dados avisa quando um teste rolou de novo ou contou em dobro em uma face diferente da habitual do conjunto.
- **Os dados podem ser rolados de novo**, se o conjunto tiver uma regra para isso: o Game Master a nomeia no teste quando a situação pede, e os dados que caíram baixo são rolados de novo, uma vez ou até saírem mais altos. Um recurso que você gasta pode comprar o mesmo. Uma rolagem só é refeita de um jeito; quando dois jeitos se aplicariam, vale o que alcança mais dados.
- **Dois atributos podem ser rolados juntos**, se o conjunto disser: um teste de atributo pode somar os dados de um segundo atributo, para que dois valores sejam rolados como uma só parada.
- **Em alguns conjuntos, algo pode dar errado junto com o resultado.** Em um conjunto que trata como tropeço faces baixas em metade dos dados ou mais, um teste que ainda conseguiu os sucessos mantém o resultado, e o cartão de dados acrescenta que algo deu errado junto. Sem nenhum sucesso, é uma falha crítica.
- **O Game Master nunca fornece os números.** Um resultado de parada escrito na narração é sempre substituído pela rolagem do próprio motor. Vantagem não se aplica, nem um dado que você mesmo rolou antes do teste.
- **Deixar o Game Master ver um dado de cada tamanho não vale para esses testes.** Os dados mostrados a ele são de vinte lados; um teste de parada é rolado às cegas pelo motor e narrado como qualquer outra rolagem às cegas.

### Outras formas de um conjunto rolar

Um conjunto de regras também pode rolar os testes de outras formas. O motor continua rolando os dados, e o cartão de dados segue o conjunto:

- **Ficar com os dados mais altos.** Role um punhado de dados e leia o mais alto, os dois mais altos ou os três mais altos, como o conjunto determinar.
- **Rolar contra a ficha.** Role um valor igual ou menor que um número da sua ficha, como a porcentagem de uma perícia, em vez de somar um bônus aos dados.
- **Dados com faces próprias.** As faces podem valer outra coisa além do número, como menos, branco e mais. Alguns dados trazem símbolos, como sucesso, vantagem e os opostos deles, em vez de números.
- **Resultados em patamares.** Um teste pode cair em um de vários resultados, como um sucesso crítico ou um sucesso com custo, em vez de um simples passou ou falhou. O cartão de dados nomeia o patamar, e o Game Master o narra.
- **Alguns testes rolados de outro jeito.** Um conjunto pode rolar a maioria dos testes de um jeito e nomear alguns que rolam de forma diferente.

<a id="the-ruleset-sheet"></a>

## A ficha do conjunto

Em uma partida com um conjunto de regras, cada ficha de personagem começa com um bloco **Ruleset sheet** (ficha do conjunto). A disposição dele vem do conjunto, então uma ficha de 5e e a ficha de outro sistema têm aparências diferentes. Uma partida sem conjunto de regras não tem esse bloco.

- **Recursos**, como pontos de vida, espaços de magia ou um recurso de classe, mostram quanto resta do máximo. Use os botões de menos e de mais, ou digite um número. Um recurso que tem uma reserva temporária também mostra uma caixa **Temp** (temporário).
- **Trilhas**, como exaustão, sobem e descem dentro do intervalo delas.
- **Trilhas de ferimentos** são uma fileira de caixas em vez de um número, para sistemas que marcam o dano em vez de contá-lo. Cada caixa diz como se chama aquele nível de ferimento e quanto ele tira das suas rolagens. Escolha primeiro o tipo de dano quando o conjunto tiver mais de um e depois use **Mark** (marcar) ou **Clear one** (limpar uma). Você também pode clicar na próxima caixa vazia para acrescentar uma marca ou na última caixa marcada para limpar uma; as outras caixas não respondem a cliques. Uma marca mais grave ocupa a caixa mais alta e empurra as mais leves para baixo, e a linha de baixo diz qual penalidade está valendo, junto com o que não coube na trilha. Alguns conjuntos numeram as caixas em vez de dar nome a elas, às vezes tantas quanto o próprio valor de um personagem, e alguns põem cada marca na caixa a que ela se destina: nesses, você pode clicar em qualquer caixa livre, a marca mais leve na caixa mais alta é a que **Clear one** tira, e uma trilha cheia recusa outra marca em vez de piorar uma antiga. Um conjunto também pode acrescentar caixas a uma trilha a partir de uma lista da sua ficha, e fazer um descanso ou uma cura limpar só um tipo de dano. Se o conjunto disser, essa penalidade sai das suas rolagens: ela tira dados de uma parada ou entra em uma rolagem somada, e o cartão de dados diz quanto foi aplicado.
- **Notas**, como aquilo em que um personagem está concentrado, são caixas de texto curtas.
- **Condições** são botões que você liga e desliga.
- **Estados**, como uma forma ou uma postura, assumem um valor de uma lista por vez. Escolha o valor na lista. Um estado pode mudar os números que vêm depois dele, como os dados que uma postura acrescenta às suas rolagens, e um descanso pode devolvê-lo ao ponto de partida.
- **Botões de descanso** aplicam um dos descansos do conjunto. O que um descanso recupera é definido pelo conjunto, e um descanso também pode devolver as cargas dos itens que o personagem carrega, como as de uma varinha; a linha abaixo dos botões diz então o que voltou. Em 5e (SRD 5.1), um descanso longo recupera os pontos de vida e os espaços de magia e devolve metade dos dados de vida do personagem, no mínimo um.
- Abaixo disso há um resumo curto da configuração do personagem: modificadores de atributo, perícias e salvaguardas treinadas e alguns valores escolhidos pelo conjunto, como a classe de armadura.

O Game Master mantém a mesma ficha atualizada enquanto narra. Quando um personagem gasta um recurso, sofre dano, se cura, ganha ou perde uma condição, muda de estado ou descansa, o GM registra a mudança, e o motor a confere com a ficha. Uma mudança que não é possível, como uma magia lançada sem nenhum espaço sobrando, é recusada: nada muda e um aviso informa você.

Quando um personagem usa algo que escolheu nos catálogos do conjunto, como uma magia ou uma característica de classe, o Game Master nomeia o que foi usado e o motor paga o preço inteiro: o custo que o conjunto define, mais um uso de cada contador que veio junto. Uma magia que custa um espaço é paga com o nível de espaço que o conjunto indica para ela, e o Game Master pode pedir um nível mais alto em vez disso. O motor nunca sobe para um espaço mais alto por conta própria. Se qualquer parte do preço não puder ser paga, tudo é recusado e nada é gasto. Algo que não custa nada, como um truque, é apenas narrado.

Alguns números da ficha pertencem ao conjunto, e não a você. Um recurso de classe cujo máximo acompanha o seu nível, ou usos que acompanham um valor de atributo, são definidos pelo conjunto e mantidos corretos quando você edita a ficha.

Alguns valores calculados acompanham o próprio jogo: um conjunto pode calcular um número a partir de um recurso ou de uma trilha como estão no momento, dar um número para cada valor de um estado ou somar uma coluna de uma lista, como o peso do equipamento que você guardou na mochila. Ele também pode limitar uma perícia a um número assim, de modo que uma perícia pode diminuir enquanto um recurso está baixo. Esses valores mostram o valor atual na ficha da partida, e os valores que um teste ou uma luta usa são os do momento em que eles acontecem. O editor de ficha de um card de personagem, que não tem uma partida para ler, mostra esses valores como estariam no início do jogo.

Esses valores ao vivo pertencem à mensagem em que aconteceram. Se você der swipe para outra versão de um turno, ou regenerá-lo, a ficha volta a ser como era antes daquele turno, então nada é gasto duas vezes.

Clique em **Edit sheet** (editar ficha) para mudar a própria configuração do personagem, por exemplo depois de subir de nível: valores, campos, listas como as magias, e o treinamento de perícias e salvaguardas. Os valores calculados se atualizam enquanto você digita. É o mesmo editor do card de personagem, então aqui também dá para acrescentar linhas a partir dos catálogos do conjunto, as células que o conjunto controla aparecem mas não aceitam digitação, e uma lista cujo texto no conjunto mudou oferece um botão **Review** (revisar). Quando o conjunto tem um construtor passo a passo, o editor oferece **Guided** (guiado) ao lado de **All fields** (todos os campos). **Guided** conduz você por cada escolha, como valores, perícias e equipamento inicial, e diz o que cada etapa ainda espera. **All fields** mostra tudo de uma vez. Clique em **Save sheet** (salvar ficha) quando terminar. Isso muda só a cópia da ficha desta partida. A ficha guardada no personagem ou na persona nunca é alterada por uma partida.

O botão separado **Edit Sheet** (veja [Editar a ficha à mão](party-and-npcs.md#edit-a-sheet-by-hand)) continua editando a ficha geral (classe, habilidades, pontos fortes e assim por diante) e não mexe na ficha do conjunto.

Se o pacote do conjunto foi removido, ou se a cópia instalada é mais antiga que aquela com que a partida foi criada, o bloco mostra um aviso no lugar, e os testes não podem ser rolados até o pacote ser instalado de novo.

## A ficha da equipe e os relógios de progresso

Alguns conjuntos mantêm uma ficha para a equipe inteira, como uma tripulação ou uma companhia. Ela aparece na tela do jogo perto do mapa, com o nome que o próprio conjunto dá a ela. Clique no nome para abri-la. O Game Master a mantém atualizada como faz com a ficha de cada personagem e, onde o conjunto permite, você também pode editá-la. Se outra pessoa salvou a ficha da equipe enquanto você editava, ela mostra a versão dessa pessoa: **Save** (salvar) a substitui pela sua, e **Cancel** mantém a dela.

Um conjunto também pode usar **Progress clocks** (relógios de progresso): círculos divididos em segmentos que o Game Master preenche conforme algo avança, como um alarme sendo dado. Eles aparecem perto do mapa, cada um com quantos segmentos estão preenchidos, e mostram **Done** (concluído) quando ficam cheios.

## Guias relacionados

- [Game Mode: lutas com um conjunto de regras](fighting-on-a-ruleset.md)
- [Game Mode: dados e testes de perícia](dice-and-skill-checks.md)
- [Game Mode: equipe e NPCs](party-and-npcs.md)
- [Cores de personagem e estatísticas de RPG: fichas do conjunto de regras](../characters/colors-and-stats.md#ruleset-sheets)
- [Escrever conjuntos de regras de Game Mode](../extending/writing-rulesets.md)
