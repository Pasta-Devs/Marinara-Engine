# Game Mode: jogar com um conjunto de regras

Um conjunto de regras informa ao Game Mode como funciona um sistema de mesa: quais dados um teste rola, o que há na ficha, quais recursos são gastos, o que um descanso recupera e, em alguns conjuntos de regras, como uma luta inteira é travada. Use este guia para obter um conjunto de regras, escolhê-lo para uma partida e ver o que muda ao jogar. Uma partida sem conjunto de regras usa as regras do próprio Marinara, descritas nos outros guias de Game Mode.

## Obter um conjunto de regras

Para instalar um conjunto de regras oficial, como 5e (SRD 5.1):

1. Abra o painel **Agents** (agentes) pelo ícone de estrelinhas.
2. Selecione **Agent Organizer** (organizador de agentes).
3. Encontre o conjunto de regras. Os conjuntos de regras aparecem marcados como **Rules** (regras).
4. Selecione **Install** (instalar).

Depois, comece uma partida nova e escolha o conjunto (veja abaixo). Os conjuntos de regras vêm de dois lugares:

- Os conjuntos **Official** (oficiais) são instalados como descrito acima.
- Os conjuntos **Community** (da comunidade) são importados de um arquivo ou do repositório GitHub de um autor. Eles ficam arquivados pela origem, como `local/ember-roads` ou `alice/v20`.

A importação usa o mesmo botão liga/desliga **Allow custom Agent imports** (permitir importações de agentes personalizados) dos agentes importados. Enquanto ele está desligado, os conjuntos importados ficam de fora das partidas novas, e as partidas que já usam um continuam funcionando. Uma partida com um conjunto importado sempre joga na versão exata em que foi criada. Para escrever o seu, veja [Escrever conjuntos de regras de Game Mode](../extending/writing-rulesets.md).

O texto do próprio conjunto de regras, como os nomes das perícias, as magias e o texto do Game Master (GM), segue o idioma definido em **Settings** (Configurações). Um conjunto de regras oficial baixa apenas a tradução desse idioma, busca uma nova quando você muda de idioma e usa o inglês para um idioma que ele não tem. Um conjunto de regras importado de um arquivo mantém apenas a tradução do idioma que você usava ao importá-lo. Para mudar, importe o arquivo de novo.

## Escolher um conjunto de regras para uma partida

**Rules** aparece na etapa **World** (mundo) do assistente só quando há pelo menos um conjunto de regras instalado, e só para uma partida nova. Essa opção é separada de **Combat Preference** (preferência de combate): **Rules** define como funcionam os testes e as fichas, e **Combat Preference** define como as batalhas são mostradas.

1. No assistente de configuração, abra a etapa **World**.
2. Em **Rules**, mantenha **Marinara's own rules** (regras próprias do Marinara: os testes d20 integrados e a ficha de seis atributos) ou escolha um conjunto de regras como **5e (SRD 5.1)**.
3. Leia o resumo. Ele lista o que o conjunto cobre e traz uma linha sobre as batalhas (veja [O que acontece nas batalhas](#what-happens-in-battles)).
4. Opcional: ative as **layers** (camadas), descritas abaixo.
5. Na etapa **Party**, confira quem **Has a sheet** (tem ficha) e quem **Starts on a blank sheet** (começa com ficha em branco). Uma ficha é formada pelos números do personagem neste conjunto de regras, como os valores de atributo e os pontos de vida. Uma ficha em branco usa os valores padrão do conjunto. Você pode preenchê-la depois.

O conjunto de regras é definido quando a partida é criada. Não é possível trocá-lo nem acrescentar um depois.

**Layers** são variantes nomeadas de um conjunto de regras, como Low magic ou Hard winter. Elas aparecem como botões liga/desliga abaixo do conjunto, com uma linha sobre o que cada uma faz. Uma camada pode:

- deixar as dificuldades mais duras,
- restringir uma escolha na ficha,
- esconder algumas entradas prontas do seletor do editor de fichas,
- mudar o que as lojas vendem e quais tesouros caem,
- dar instruções extras ao GM, inclusive para o mundo que ele cria.

Algumas camadas excluem umas às outras, e o assistente desativa a que você não pode ter. As camadas ficam fixas quando a partida começa. Uma ficha que já usa algo que uma camada retira continua com isso.

Uma ficha é adicionada em **Stats** no editor de personagem ou de persona (veja [Fichas de conjuntos de regras](../characters/colors-and-stats.md#ruleset-sheets)). A partida copia cada ficha quando gera o mundo, e nada do que você muda na partida volta para o personagem ou a persona. Um integrante sem ficha recebe uma em branco, com todos os valores no padrão do conjunto. A geração do mundo nunca inventa valores.

Um arquivo de configuração compartilhado lembra o conjunto de regras dele. Se você importar um e não tiver esse conjunto, ou tiver uma versão mais antiga, o assistente diz qual era o conjunto, e a partida usa as regras próprias do Marinara, a menos que você o instale e o escolha.

<a id="what-happens-in-battles"></a>

## O que acontece nas batalhas

O que um conjunto de regras faz em uma luta depende de como ele foi escrito. A linha do assistente abaixo do conjunto diz qual destas opções se aplica.

| O conjunto de regras | Batalhas |
| --- | --- |
| Resolve as próprias lutas, como 5e (SRD 5.1) | Travadas segundo as regras do próprio conjunto, na tela de batalha dele. Veja [Lutas com um conjunto de regras](fighting-on-a-ruleset.md). |
| Empresta a ficha para as batalhas | O combate do próprio Marinara, usando a saúde, os espaços de magia e as habilidades da ficha (veja abaixo). |
| Não diz nada sobre batalhas | O combate do próprio Marinara, exatamente como sem conjunto de regras. Veja [Combate](combat.md). |

Quando um conjunto empresta a ficha, o combate do Marinara a usa assim:

- Cada integrante da equipe começa a luta com a reserva de recursos e os espaços de magia que o conjunto preparou para batalhas, como estão na ficha naquele momento.
- As habilidades escolhidas nos catálogos do conjunto viram habilidades de combate quando o combate do Marinara consegue usá-las. Uma entrada que só descreve algo fora de combate, uma reação ou uma cujo custo a batalha não consegue cobrar fica de fora.
- Os pontos de vida são levados como fração do máximo, e não como o número da ficha. Um personagem com metade da vida começa com metade da barra de vida da tela de batalha, então uma ficha com 9 de vida nunca entra em uma luta em que um golpe causa 12.
- Quando a luta termina, a vida perdida ou recuperada volta do mesmo jeito, e os espaços e recursos gastos são gravados como estão.

O resto não muda. A matemática dos dados continua sendo a do Marinara (veja [Como funciona a matemática do combate](combat.md#how-combat-math-works)), e as rolagens de ataque, as salvaguardas e a concentração do sistema de mesa não são aplicadas. Uma luta que você abandona excluindo a mensagem em que ela começou não grava nada.

<a id="checks-on-a-ruleset"></a>

## Testes com um conjunto de regras

O GM pede testes como em qualquer partida (veja [Testes de perícia](dice-and-skill-checks.md#skill-checks)), mas o conjunto de regras decide como eles são rolados.

- O GM só nomeia a perícia ou a salvaguarda e define uma dificuldade. Ele recebe a escala de dificuldade do conjunto, e não a integrada. Uma dificuldade pode ir até onde essa escala for, mesmo além do intervalo de 1 a 40 das regras do Marinara. Um caminho continua limitado a 1 a 40: a alternativa que rola um teste que um turno salvo ainda deve.
- Marinara rola os dados do conjunto e soma o modificador da **ficha do conjunto** do personagem: o modificador de atributo quando a perícia ou a salvaguarda nomeia um atributo, o bônus do nível de treinamento (um múltiplo de um bônus de proficiência, um número fixo ou os dois) e qualquer bônus extra da ficha. Os bônus de perícia e os atributos integrados não são usados.
- Os resultados seguem o conjunto. Em 5e (SRD 5.1), um 20 natural ou um 1 natural não tem efeito especial em testes e salvaguardas, então um 20 natural que não alcança a dificuldade falha.
- Se o pacote do conjunto estiver ausente ou for mais antigo que aquele com que a partida foi criada, os testes são salvos sem números e continuam pendentes. Eles nunca são rolados com as regras de outro sistema.

Marinara não confia nos números que o GM escreve. Uma marcação com cara de concluída é rolada de novo e substituída quando o modificador não é o da ficha, quando rolou uma quantidade ou um tamanho de dados diferente do que o conjunto usa, quando o dado contado não é o que o modo de rolagem mantém, ou quando alega um resultado natural que o conjunto não tem.

### O que o GM pode acrescentar a um teste

| O GM escreve | Efeito |
| --- | --- |
| `who="Name"` | O teste usa a ficha desse integrante da equipe. Sem isso, o teste é do jogador. Um integrante sem ficha rola com uma em branco. Um nome que não corresponde a ninguém, ou que dois integrantes compartilham, rola sem modificador. Se um integrante tiver o mesmo nome do seu próprio personagem, esse nome continua significando você. Marinara nunca pega emprestada a ficha de outra pessoa. |
| `with="Ability"` | Rola a perícia ou a salvaguarda com outro atributo. Só vale um atributo que o conjunto declara. Qualquer outro é ignorado. |
| `difficulty="Hard"` | Nomeia um degrau da escala em vez de um número. Marinara rola contra o número desse degrau, e o teste salvo mostra o número. Um nome desconhecido é ignorado. |
| Marcadores de rolagem | Podem nomear os atributos, as perícias e as salvaguardas do conjunto, e `PROF` para o bônus de proficiência quando o conjunto tem um. |

Um dado que você mesmo rolou antes do teste só é usado quando o conjunto rola um único d20. Um conjunto que rola outros dados, como 2d6 ou uma parada, o ignora.

### Efeitos da ficha em uma rolagem

- **Amuletos que mudam uma rolagem.** O GM nomeia o amuleto no teste, e Marinara cobra o custo dele, aplica o efeito e rola. Um amuleto que você não escolheu, ou que não consegue pagar, não faz nada e não custa nada.
- **Gastar um recurso para firmar uma rolagem.** O GM indica isso no teste. Marinara cobra os pontos, soma o que eles compraram e rola. Se a reserva não cobrir o custo, nada é gasto. O registro mostra o que realmente foi pago. O conjunto define quanto um teste pode comprar: um número fixo, um número da sua ficha ou tantos quantos dados o teste tiver.
- **Números que acompanham a rolagem.** Se o conjunto diz que um número da ficha vale em certas rolagens, como uma mochila pesada em toda rolagem de Brawn, Marinara o soma a todo teste em que ele se aplica, e o cartão de dados diz o que a ficha acrescentou.
- **Perícias sem treinamento.** Um conjunto pode fazer um teste sem treinamento custar dados ou pontos, ficar um degrau mais difícil ou ser impossível. Um teste que você não pode tentar não é rolado, e a narração diz isso. A sua ficha não mostra número para uma perícia assim até você treiná-la.
- **Ferimentos.** Se o conjunto tem uma trilha de ferimentos e diz que a penalidade dela vale nas rolagens, estar ferido deixa todo teste mais difícil. Em um conjunto de paradas, ela tira essa quantidade de dados da parada, nunca abaixo da menor parada que o conjunto permite (alguns permitem nenhuma). Em um conjunto que soma os dados, é uma penalidade fixa. O teste diz quanto foi aplicado. Veja [A ficha do conjunto](#the-ruleset-sheet).

O GM também mantém atualizados na ficha os recursos, as condições e os descansos de cada personagem, e Marinara recusa uma alteração que a ficha não permite.

### Conjuntos que rolam uma parada de dados

Alguns sistemas contam dados em vez de somar um bônus. O número da ficha é quantos dados você rola, e você conta os que saem altos o bastante.

- **O número da ficha é uma quantidade de dados.** Um atributo 3 e um ofício que vale 2 rolam cinco dados. A ficha mostra "5 dice" em vez de "+5".
- **A dificuldade é uma contagem de sucessos.** Um trabalho difícil pede três sucessos, não um total de 15. A escala do conjunto diz quantos cada degrau exige.
- **Marinara rola e conta.** O conjunto decide quais faces contam, se uma face alta rola outro dado ou conta em dobro, se faces baixas cancelam sucessos e o que conta como tropeço (fumble) ou como sucesso excepcional. O cartão de dados mostra todos os dados, destacando os que alcançaram o alvo, e compara os sucessos com o número exigido. Uma parada grande ocupa mais linhas, e o cartão nunca mostra uma soma quando os dados não foram somados.
- **O GM pode ajustar um teste**, se o conjunto permitir: um alvo por dado mais difícil ou mais fácil, dados acrescentados ou retirados pelas circunstâncias, e uma face mais baixa a partir da qual os dados rolam de novo ou contam em dobro. Cada ajuste fica dentro do intervalo do conjunto. Um degrau da escala pode ter o próprio alvo por dado. O cartão de dados avisa quando um teste usou uma face diferente da habitual do conjunto.
- **Os dados podem ser rolados de novo**, se o conjunto tiver uma regra para isso. O GM a nomeia no teste, e os dados que caíram baixo são rolados de novo, uma vez ou até saírem mais altos. Um recurso que você gasta pode comprar o mesmo. Uma rolagem só é refeita de um jeito. Quando dois se aplicam, vale o que alcança mais dados.
- **Dois atributos podem ser rolados juntos**, se o conjunto disser: dois valores são rolados como uma só parada.
- **Um tropeço pode vir junto com um resultado.** Em um conjunto que trata como tropeço faces baixas em metade dos dados ou mais, um teste que ainda conseguiu os sucessos mantém o resultado, e o cartão acrescenta que algo deu errado. Sem nenhum sucesso, é uma falha crítica.
- **O GM nunca fornece os números.** Um resultado de parada escrito na narração é substituído pela rolagem do próprio Marinara. Vantagem e um dado rolado antes não se aplicam.
- **Ver um dado de cada tamanho não se aplica.** Os dados mostrados ao GM são de vinte lados. Um teste de parada é rolado às cegas e narrado como qualquer rolagem às cegas.

### Outras formas de um conjunto rolar

Marinara continua rolando os dados, e o cartão de dados segue o conjunto:

- **Ficar com os dados mais altos.** Role um punhado de dados e leia o mais alto, os dois mais altos ou os três mais altos.
- **Rolar contra a ficha.** Role um valor igual ou menor que um número da sua ficha, como a porcentagem de uma perícia.
- **Dados com faces próprias.** As faces podem valer outra coisa além do número, como menos, branco e mais, ou trazer símbolos, como sucesso, vantagem e os opostos deles.
- **Resultados em patamares.** Um teste pode cair em um patamar, como um sucesso crítico ou um sucesso com custo, em vez de um simples passou ou falhou. O cartão nomeia o patamar, e o GM o narra.
- **Alguns testes rolados de outro jeito.** Um conjunto pode rolar a maioria dos testes de um jeito e nomear alguns que rolam de forma diferente.

<a id="the-ruleset-sheet"></a>

## A ficha do conjunto

Em uma partida com um conjunto de regras, cada ficha de personagem começa com um bloco **Ruleset sheet** (ficha do conjunto). A disposição dele vem do conjunto, então uma ficha de 5e e a de outro sistema têm aparências diferentes. Uma partida sem conjunto de regras não tem esse bloco. Veja também [Character Profiles](party-and-npcs.md#character-profiles).

| Parte | Como funciona |
| --- | --- |
| **Recursos** | Pontos de vida, espaços de magia ou um recurso de classe mostram quanto resta do máximo. Use os botões de menos e de mais, ou digite um número. Um recurso com uma reserva temporária também mostra **Temp** (temporário). |
| **Trilhas** | Como exaustão. Sobem e descem dentro do intervalo delas. |
| **Notas** | Caixas de texto curtas, como aquilo em que um personagem está concentrado. |
| **Condições** | Botões que você liga e desliga. |
| **Estados** | Uma forma ou uma postura: um valor de uma lista por vez. Um estado pode mudar os números que vêm depois dele, como dados acrescentados às rolagens, e um descanso pode redefini-lo. |
| **Botões de descanso** | Aplicam um dos descansos do conjunto. O conjunto define o que um descanso recupera. Ele também pode devolver cargas de itens, como as de uma varinha, e a linha abaixo dos botões diz o que voltou. Em 5e (SRD 5.1), um descanso longo recupera os pontos de vida e os espaços de magia e devolve metade dos dados de vida, no mínimo um. |
| Resumo da criação | Modificadores de atributo, perícias e salvaguardas treinadas, e valores que o conjunto escolhe, como a classe de armadura. |

**Trilhas de ferimentos** são uma fileira de caixas em vez de um número, para sistemas que marcam o dano em vez de contá-lo. Cada caixa diz como se chama aquele nível de ferimento e o que ele tira das suas rolagens.

1. Se o conjunto tiver mais de um tipo de dano, escolha o tipo primeiro.
2. Clique em **Mark** (marcar) ou em **Clear one** (limpar uma). Você também pode clicar na próxima caixa vazia para acrescentar uma marca, ou na última caixa marcada para limpar uma. As outras caixas não respondem a cliques.

Uma marca mais grave ocupa a caixa mais alta e empurra as mais leves para baixo. A linha de baixo diz qual penalidade está valendo e o que não coube na trilha. Alguns conjuntos numeram as caixas em vez de dar nome a elas, às vezes tantas quanto o seu próprio valor, e alguns põem cada marca na caixa a que ela se destina. Nesses, você pode clicar em qualquer caixa livre, **Clear one** tira a marca mais leve da caixa mais alta, e uma trilha cheia recusa outra marca em vez de piorar uma antiga. Um conjunto pode acrescentar caixas a partir de uma lista da sua ficha, e fazer um descanso ou uma cura limpar só um tipo de dano.

### Como o GM muda a ficha

O GM mantém a ficha atualizada enquanto narra. Quando um personagem gasta um recurso, sofre dano, se cura, ganha ou perde uma condição, muda de estado ou descansa, o GM registra a mudança, e Marinara a confere com a ficha. Uma mudança impossível, como uma magia lançada sem nenhum espaço sobrando, é recusada. Nada muda, e um aviso informa você.

Quando um personagem usa algo escolhido nos catálogos do conjunto, como uma magia ou uma característica de classe, o GM o nomeia e Marinara paga o preço inteiro: o custo que o conjunto define, mais um uso de cada contador que veio junto. Uma magia que custa um espaço é paga com o nível de espaço que o conjunto indica, e o GM pode pedir um nível mais alto. Marinara nunca sobe para um espaço mais alto por conta própria. Se qualquer parte do preço não puder ser paga, tudo é recusado e nada é gasto. Algo gratuito, como um truque, é apenas narrado.

Alguns números da ficha pertencem ao conjunto: um recurso de classe cujo máximo acompanha o seu nível, ou usos que acompanham um valor de atributo, são definidos pelo conjunto e mantidos corretos quando você edita a ficha. Um conjunto também pode calcular um número a partir de um recurso ou de uma trilha como estão no momento, dar um número para cada valor de um estado, somar uma coluna de uma lista (como o peso do equipamento na mochila) ou limitar uma perícia a um número assim, de modo que uma perícia pode diminuir enquanto um recurso está baixo. A ficha da partida mostra esses valores atuais, e um teste ou uma luta usa o valor daquele momento. O editor de ficha de um card de personagem não tem partida para ler, então mostra esses valores como estariam no início do jogo.

Os valores ao vivo pertencem à mensagem em que aconteceram. Se você der swipe para outra versão de um turno, ou regenerá-lo, a ficha volta a ser como era antes daquele turno, então nada é gasto duas vezes.

### Editar a ficha do conjunto

Mude a própria configuração do personagem, por exemplo depois de subir de nível.

1. Abra a ficha do personagem e clique em **Edit ruleset sheet** (editar a ficha do conjunto).
2. Mude os valores, os campos, as listas como as magias e o treinamento de perícias e salvaguardas. Os valores calculados se atualizam enquanto você digita. Quando o conjunto tem um construtor passo a passo, escolha **Guided** (guiado) para ser conduzido por cada escolha, como valores, perícias e equipamento inicial, ou **All fields** (todos os campos) para ver tudo de uma vez.
3. Clique em **Save sheet** (salvar ficha).

É o mesmo editor do card de personagem. Dá para acrescentar linhas a partir dos catálogos do conjunto, as células que o conjunto controla aparecem mas não aceitam digitação, e uma lista cujo texto no conjunto mudou oferece **Review** (revisar). Salvar muda só a cópia desta partida. A ficha guardada no personagem ou na persona nunca é alterada por uma partida.

O botão separado **Edit card** (editar card) edita a ficha geral, com classe, habilidades e pontos fortes, e não mexe na ficha do conjunto. Veja [Editar a ficha à mão](party-and-npcs.md#edit-a-sheet-by-hand).

Se não funcionou e o pacote do conjunto foi removido ou é mais antigo que aquele com que a partida foi criada, o bloco mostra um aviso no lugar. Os testes não podem ser rolados até o pacote ser instalado de novo.

## A ficha da equipe e os relógios de progresso

Alguns conjuntos mantêm uma ficha para a equipe inteira, como uma tripulação ou uma companhia. Ela aparece na tela do jogo perto do mapa, com o nome que o próprio conjunto dá a ela. Clique no nome para abri-la. O GM a mantém atualizada como a ficha de cada personagem e, onde o conjunto permite, você também pode editá-la. Se outra pessoa salvou a ficha da equipe enquanto você editava, você vê a versão dessa pessoa. **Save** (salvar) a substitui pela sua, e **Cancel** (cancelar) mantém a dela.

Um conjunto também pode usar **Progress clocks** (relógios de progresso): círculos divididos em segmentos que o GM preenche conforme algo avança, como um alarme sendo dado. Eles aparecem perto do mapa, cada um com quantos segmentos estão preenchidos, e mostram **Done** (concluído) quando ficam cheios.

## Guias relacionados

- [Game Mode: lutas com um conjunto de regras](fighting-on-a-ruleset.md)
- [Game Mode: dados e testes de perícia](dice-and-skill-checks.md)
- [Game Mode: equipe e NPCs](party-and-npcs.md)
- [Cores do personagem e status de RPG: fichas de conjuntos de regras](../characters/colors-and-stats.md#ruleset-sheets)
- [Escrever conjuntos de regras de Game Mode](../extending/writing-rulesets.md)
