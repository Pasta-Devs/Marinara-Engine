# Fichas de conjuntos de regras

Esta página faz parte de [Escrever conjuntos de regras de Game Mode](writing-rulesets.md). O que vai na ficha de personagem de um conjunto de regras: atributos, perícias, campos e listas, estados vivos, trilhas de ferimentos, penalidades, descansos e o texto do Game Master, além da ficha do grupo e dos relógios de progresso.

## A ficha

- `sections` agrupa elementos no editor. Campos, valores derivados e listas nomeiam a seção em que ficam com `section`, e atributos, perícias e salvaguardas também podem fazer isso: o editor, a ficha da partida e o bloco de ficha do GM os mostram sob esse título (uma ficha que não nomeia seção neles os mostra exatamente como antes). Uma seção também pode ter uma regra `untrained` (abaixo).
- `abilities` contém as pontuações principais. `skills` e `saves` podem nomear o atributo de suas rolagens, um `cap` e uma regra `untrained` (abaixo).
- `fields` contém valores individuais. Tipos: `number`, `text`, `longtext`, `boolean`, `enum` (lista fixa de escolhas) e `dice` (texto como `1d8`). Um campo `text` ou uma coluna de lista pode adicionar `suggestions` (Capability API 1.796): até 40 palavras oferecidas como sugestões clicáveis abaixo dele, cada uma acrescentada ao que está escrito, e o campo continua permitindo digitação livre, como os inimigos favoritos de um patrulheiro dentre os tipos de criatura. Esse campo também pode dizer quantos escolher com `pick` (Capability API 1.797), um valor lido da ficha, como uma contagem derivada que cresce com o nível de classe: o editor diz "Choose N", mostra quantos estão escolhidos e para de oferecer mais sugestões clicáveis quando N já foram incluídos, embora o que é digitado nunca seja recusado.
- Valores `derived` são calculados a partir de outros e não podem ser sobrescritos na digitação. Uma ficha pode ter até 800 deles (Capability API 1.729; 400 a partir da 1.111, 240 a partir da 1.88, 120 a partir da 1.84, 60 antes disso); um pacote com mais de 240 declara 1.111, e um com mais de 400 declara 1.729. Operações: `sum`, `min`, `max`, `scale` (multiplicar por um número fixo e arredondar), `multiply` (de dois a seis valores multiplicados entre si, como um modificador de Constitution vezes o nível; Capability API 1.82), `stepTable` (consultar limiares, como quando um nível define o bônus de proficiência) e `enumTable` (um número para cada valor de um campo enum ou de um estado vivo; veja Estados vivos abaixo).
- `lists` contém tabelas com colunas próprias, como equipamento, magias ou características. Uma lista tem até 24 colunas; um pacote com uma lista de mais de 12 declara Capability API 1.165. Uma lista com `pools` transforma cada linha num recurso com máximo próprio, para características de classe com usos limitados. Uma coluna numérica pode ser preenchida por uma rolagem: `"roll": { "count": 1, "sides": 8 }`, em que `sides` é um número, outra coluna da mesma linha (`{ "column": "die" }`, uma coluna numérica ou um enum cujos valores se leem como dados, como `d8`) ou um valor da ficha. O editor de fichas mostra um botão Roll que rola os próprios dados do Engine e escreve o total, mantido entre o `min` e o `max` da coluna (Capability API 1.85).
- `live` é o que muda durante a partida: `pools` (pontos de vida, espaços de magia, Grit), `tracks` (número numa escala, como exaustão, ou trilha de ferimentos com casas), `text` (notas curtas, como concentração), `conditions` e `states` (um valor de um conjunto fechado, como uma forma ou uma postura).

Tudo que lê um número o nomeia com uma referência de valor: um objeto com exatamente uma chave entre `const`, `field`, `derived`, `abilityScore`, `abilityMod`, `abilityModFromField`, `skillMod`, `saveMod`, `listSum`, `livePool`, `liveTrack` e `itemStat`. Por exemplo, uma reserva cujo máximo é derivado: `"max": { "derived": "grit_max" }`.

- `listSum` soma uma coluna numérica de uma lista: `{ "listSum": { "list": "gear", "column": "bulk", "onlyWhen": "packed" } }`. `onlyWhen` é opcional e nomeia uma coluna booleana; só contam as linhas em que ela está ativada. Uma célula vazia conta como o padrão da coluna, e uma lista ocultada por `hideWhen` não soma nada. Ember Roads calcula Burden assim, a partir do equipamento que o personagem leva na mochila, então ele nunca se desencontra da lista como um número digitado poderia. Uma coluna escalada de catálogo não pode ler uma soma de lista, nem por meio de um valor derivado: uma lista pode conter células escaladas, próprias ou que a leem de volta, e o recálculo nunca se estabilizaria.
- `livePool` lê o que resta numa das suas `live.pools` (a reserva de uma linha de lista não é uma delas). `liveTrack` lê uma das suas `live.tracks`, com um `read` opcional: `"value"`, onde ela está (o padrão); `"filled"`, quanto está acima do `min`; `"remaining"`, quanto falta para o `max`; ou, só numa trilha de ferimentos, `"penalty"`, a penalidade ativa. Uma reserva ou trilha oculta lê 0. O "Harm still to take" de Gravewatch é `{ "liveTrack": "harm", "read": "remaining" }`.
- Uma leitura viva pega o estado vivo como está quando um teste é rolado, uma luta começa ou o bloco de ficha do GM é escrito. Quando ainda não existe um (no editor de fichas, na revisão de uma importação), lê o estado em que a partida começa: uma reserva cheia ou vazia conforme seu `start`, uma trilha no seu `default`, uma trilha de ferimentos sem marcas.
- Nada calculado antes de existir um estado vivo pode ler um: o `max` de uma reserva ou de uma trilha, o bônus de proficiência ou a coluna escalada ou a escala de um catálogo. Isso vale também por meio de um valor derivado que lê um e por meio de uma perícia limitada por um valor vivo, e a importação nomeia o valor responsável.
- Esses três exigem Capability API 1.39 num conjunto empacotado.
- `itemStat` lê os itens que o personagem tem, como o valor de guard da armadura que veste, e segue a mesma regra de uma leitura viva. Veja [Itens na ficha](ruleset-items.md#items-on-the-sheet). Capability API 1.52.

**O que um teste faz sem treinamento.** Uma perícia ou salvaguarda em que o personagem não tem treinamento (seu nível é o primeiro) rola normalmente, a menos que o conjunto diga o contrário, com `untrained` na perícia ou salvaguarda ou na seção em que ela fica (a regra da própria perícia ou salvaguarda prevalece):

```json
"sections": [{ "id": "labour", "label": "Labour", "untrained": { "by": -1 } }],
"skills": [
  { "id": "dig", "label": "Dig", "ability": "sinew", "section": "labour", "untrained": "refuse" },
  { "id": "listen", "label": "Listen", "ability": "nerve", "untrained": "harder" }
]
```

- `"normal"`: normalmente (o padrão).
- `{ "by": -3 }`: somado ao número do teste, de -20 a 20: dados numa reserva, um valor fixo numa soma. Faz parte do número que a ficha mostra e que todo teste rola, antes de qualquer `cap`.
- `"harder"`: um passo mais difícil. Numa reserva, o alvo por dado sobe um (e fica dentro da faixa do alvo), então exige um conjunto de reserva cujo alvo possa se mover; em qualquer outro caso é recusado na importação, porque nunca poderia mudar uma rolagem.
- `"refuse"`: o teste não é rolado. O Engine devolve o pedido do GM com `reason="untrained"`, o que o encerra: nada o rola depois, o GM é informado de que o personagem não pôde tentar, e a narração diz isso. O endpoint de teste de perícia responde a esse teste com um 400 (`skill_check_untrained`), e uma ramificação feita a partir dele não mantém nenhuma das duas metades. O editor de fichas não mostra número para ele.
- Um personagem sem ficha não tem treinamento a ler, então nenhuma regra de falta de treinamento se aplica a ele.
- O lembrete do GM lista as regras de falta de treinamento, por seção ou por perícia, para que ele peça testes que o personagem possa fazer.

Seções em atributos, perícias e salvaguardas, e `untrained` em qualquer lugar, exigem Capability API 1.41 num conjunto empacotado.

Uma perícia ou salvaguarda pode ter um `cap`, uma referência de valor que é o máximo que seu teste pode alcançar: uma pontuação que ela não pode superar ou uma trilha que a segura. Gravewatch limita Soothe ao Resolve que resta a um guardião, `"cap": { "livePool": "resolve" }`. O número limitado é o que a ficha mostra e que todo teste rola, e uma troca com `with=` é calculada sobre o número antes do teto e depois limitada de novo. Um teto não pode ler um modificador de perícia ou de salvaguarda, e o valor derivado que ele lê, ou qualquer valor derivado declarado acima desse, também não pode, para que a ficha continue sendo calculada uma única vez, de cima para baixo. Capability API 1.39.

`hideWhen` oculta um campo, um valor derivado, uma lista, uma reserva ou uma trilha comum pelo valor de outro campo, de exatamente uma de três formas: `equals` um valor, `notEquals` um valor (oculto sempre que o campo contém qualquer outra coisa; é assim que algo fica restrito a um tipo de personagem) ou `in` uma lista de valores. Cada valor nomeado precisa ser um que o campo possa conter, ou a regra nunca coincidiria, e isso é verificado um valor por vez; para `notEquals` e `in`, isso inclui a faixa de um campo numérico e o comprimento de um campo de texto. A regra lê o valor que o editor de fichas mostra: um campo não definido é o valor com que uma ficha em branco começa, e um valor enum que o conjunto não oferece mais é o padrão do campo. O arquivo 5e usa `equals` para ocultar espaços de magia de um personagem que não lança magias; Gravewatch mantém o óleo de lanterna fora da ficha de todo guardião que não está na vigília noturna com `"hideWhen": { "field": "watch", "notEquals": "night" }`. Uma camada não pode remover um valor com o qual qualquer uma dessas regras compara. Uma trilha de ferimentos não pode ser ocultada, porque rolagens e lutas a leem seja o que for que a ficha mostre. `notEquals` e `in` exigem Capability API 1.39.

O `max` de uma trilha comum pode ser uma referência de valor em vez de um número, para que uma pontuação do personagem defina até onde ela vai: `"max": { "field": "willpower_rating" }`. Seus `min` e `default` continuam sendo números. Uma trilha de ferimentos com níveis nomeados tem um `max` igual ao seu número de níveis; uma trilha de casas numeradas tem o comprimento do próprio `max` (veja Casas numeradas abaixo). `alwaysShow: true` imprime uma trilha no bloco de ficha do GM mesmo no seu padrão, para uma pontuação que importa em todo turno; sem isso, uma trilha no padrão é omitida, porque três salvaguardas contra a morte em zero não dizem nada. Esses três exigem Capability API 1.37 num conjunto empacotado.

## Estados vivos: uma forma, uma postura, uma luz

Um campo enum é escolhido quando o personagem é criado e continua escolhido, e uma condição só está ativa ou não. Um **estado vivo** é um valor de um conjunto fechado que muda durante a partida: a forma de um metamorfo, uma postura de luta, quão acesa está uma lanterna.

```json
"live": {
  "states": [
    {
      "id": "stance",
      "label": "Stance",
      "values": ["guarded", "steady", "reckless"],
      "valueLabels": { "guarded": "Guarded", "steady": "Steady", "reckless": "Reckless" },
      "default": "steady"
    }
  ]
}
```

- `values` são de dois a quarenta, cada um mostrado como sua entrada em `valueLabels` ou como ele mesmo. Seguem a regra de todo rótulo (uma linha, sem colchetes, sem chaves de macro) e nunca contêm aspas duplas, porque o comando de ficha os coloca entre aspas. Até doze estados.
- `default` é onde toda ficha começa, e o primeiro valor quando você o omite. Só um estado que saiu do padrão é salvo, e um valor salvo que o estado não oferece mais é lido como o padrão.
- `hideWhen` tira um estado da ficha pelo valor de um campo, como faz com uma reserva: ele não é mostrado, não é definido por comando e é lido por uma tabela (abaixo) como nenhum valor.
- O GM define um com `[sheet: who="Name" op="state" state="Stance" value="Reckless"]`, nomeando o estado pelo ID ou rótulo e o valor por ele mesmo ou por seu rótulo. Um estado ou valor que a ficha não tem é recusado (`unknown-state`, `unknown-value`). O Engine ensina o comando e lista cada valor só quando seu conjunto tem um estado, e todo bloco de ficha diz o valor de cada estado, inclusive o padrão, porque estar em forma humana é um fato de que a narração precisa a cada turno.
- A tela de ficha da partida mostra um seletor para cada estado.
- Um descanso restaura um estado com um passo de restauração que o nomeia: `{ "state": "stance", "to": "default" }`, ou `"to"` um dos seus valores.

**Números que acompanham.** Um valor derivado com `"op": "enumTable"` dá um número para cada valor de um campo enum ou de um estado vivo:

```json
{
  "id": "stance_brawn",
  "label": "Stance on Brawn",
  "op": "enumTable",
  "from": { "liveState": "stance" },
  "table": { "guarded": -1, "reckless": 2 },
  "default": 0
}
```

- `from` nomeia exatamente um entre `field` (um campo enum) e `liveState`. Cada linha de `table` é um valor que ele pode conter, de um a quarenta. Um valor que a tabela omite, e um estado que a ficha oculta, leem `default` (0 quando você o omite).
- Um campo é fixado quando o personagem é criado, então uma tabela baseada nele pode alimentar um máximo: Gravewatch dá um Resolve a mais a um guardião da vigília da aurora. Um estado vivo muda durante a partida, então uma tabela baseada nele é uma leitura viva, como `liveTrack`: nada calculado antes de existir um estado vivo pode lê-la, diretamente ou por meio de outro valor derivado. Por isso a chave é `liveState` e não `state`: toda leitura do estado vivo leva `live` no nome, e é assim que você e a importação sabem o que um máximo não pode usar.
- Para levar o número aos dados, aponte `resolution.adjust` para ele (veja Modificadores da ficha). Ember Roads soma sua Stance a toda rolagem de Brawn; Gravewatch aplica a toda rolagem de Nerve uma penalidade quando a lanterna está fechada ou apagada.
- Uma camada pode retirar de um campo um valor para o qual a tabela tem uma linha. Essa linha simplesmente nunca é lida enquanto a camada estiver ativa.

Estados vivos, `enumTable` e um passo de descanso que nomeia um `state` exigem Capability API 1.42 num conjunto empacotado.

<a id="wound-tracks-health-that-is-a-track-not-a-number"></a>

## Trilhas de ferimentos: saúde marcada numa trilha

Muitos sistemas não contam pontos de vida. Têm uma coluna de casas, cada uma pior que a anterior, e você marca uma ao se ferir. Dê a uma entrada `live.tracks` os `kinds` e também `levels` nomeados ou `boxes` numeradas (abaixo) para que ela deixe de ser um número numa escala e vire uma dessas trilhas:

**Qual formato seu sistema precisa?** Uma reserva registra QUANTO dano entrou; uma trilha registra quanto E o tipo de cada parte. Se um ferimento é contundente, letal ou agravado e o tipo ainda importa após o golpe (porque o agravado cura mais devagar, não pode ser absorvido ou acaba matando), precisa continuar registrado após a rolagem. Só uma marca carrega isso. Uma reserva não pode: depois de subtrair o dano, só resta um número menor, sem lembrar quais pontos eram de cada tipo. Por isso `combat.damageKinds` é recusado quando a saúde é uma reserva, em vez de ignorado. Uma reserva ainda pode ter `damageTypes`, e oponentes podem resistir ou ser imunes a eles: isso trata de quanto dano entra, não de qual ferimento fica depois.

```json
{
  "id": "harm",
  "label": "Harm",
  "min": 0,
  "max": 4,
  "levels": [
    { "label": "Scuffed", "penalty": 0 },
    { "label": "Winded", "penalty": -1 },
    { "label": "Bleeding", "penalty": -3 },
    { "label": "Down", "penalty": -99 }
  ],
  "kinds": [
    { "id": "knock", "label": "K", "severity": 0 },
    { "id": "tear", "label": "T", "severity": 1 }
  ]
}
```

- `levels` tem 1–16 patamares, do melhor ao pior. Cada um tem `label` e `penalty` inteiro igual ou inferior a 0. Um número negativo grande expressa ficar fora de ação, então `-99` é válido.
- `kinds` tem 1–6 tipos de dano aceitos, cada um com `id`, `label` curto para a casa e `severity`. As gravidades precisam ser distintas; só a ordem importa, não os números em si, então distribua-os como quiser.
- Os dois andam juntos. `kinds` sem `levels` ou `boxes` é recusado porque não haveria onde marcar, e `levels` ou `boxes` sem `kinds` é recusado porque uma marca precisa ter um tipo. Uma trilha tem `levels` ou `boxes`, nunca os dois.
- **Separe os dois termos.** `kinds` define o que uma marca PODE SER. Uma MARCA é um desses tipos colocado na trilha durante a partida. A definição contém tipos; a ficha contém marcas.
- Uma trilha de ferimentos começa sem marcas, então seu `min` é 0. Uma trilha com níveis nomeados tem o comprimento dos seus níveis, então seu `max` é `levels.length`; qualquer outro valor é recusado em vez de corrigido, para que o arquivo nunca contenha dois comprimentos contraditórios. Uma trilha de casas tem o comprimento do próprio `max`, que pode ser um valor calculado pela ficha (veja Casas numeradas abaixo).

**As regras exatas**, porque uma leitura vaga produz a trilha errada:

- As marcas ficam ordenadas, **as mais graves primeiro**. Sete níveis comportam no máximo sete marcas.
- Uma marca é **inserida por ordem de gravidade**, nunca simplesmente no fim. Ocupa o nível mais alto que lhe cabe e empurra as leves para baixo.
- A penalidade ativa é a do **nível marcado mais baixo**, nunca a soma. Três marcas no exemplo dão `-3`, não `0 + -1 + -3`.
- `amount` é a quantidade de marcas de um tipo, **aplicadas uma por vez**. Uma trilha que enche no meio do processo segue a mesma regra de uma que já estava cheia.
- Marcar uma trilha **cheia** **aumenta um passo a gravidade da marca mais leve**, em vez de adicionar outra. Um passo na sua escala de tipos, qualquer que fosse o tipo da marca nova.
- Uma marca que passaria da gravidade máxima fica nela; a que não coube conta como **transbordamento**. Isso é salvo, para que recarregar não esqueça dano já recebido.
- **Curar usa o mesmo comando com quantidade negativa.** Limpa o transbordamento antes de qualquer marca. Uma cura que nomeia um dos tipos da trilha limpa só marcas desse tipo; assim, curar o dano contundente e deixar o letal é `kind="bashing"` com quantidade negativa. Uma cura que não nomeia nenhum tipo da trilha limpa primeiro as marcas mais leves.

**Marcar durante a partida.** O GM escreve `[sheet: op="damage" track="harm" kind="knock" amount="1"]` e cura com `amount` negativo. Numa trilha preenchida por casa, ele adiciona `box="3"` para indicar a casa que o golpe atinge. A forma de reserva de `damage`, que nomeia `pool=`, não muda. O comando comum `track` é recusado em trilhas de ferimentos: um número não identifica os tipos das novas marcas. O jogador também pode marcar e limpar casas manualmente na ficha, como esses sistemas esperam.

**Uma luta também pode marcá-la.** Aponte `combat.health` para a trilha em vez de uma reserva: um golpe acertado marca as casas indicadas por `combat.damageKinds.marks`, do tipo ao qual esse bloco mapeia seu tipo de dano. Um personagem com a trilha cheia está caído, o estado lido pela regra de morte. Numa trilha preenchida por casa, o dano `per-point` nomeia a casa que atinge e o `per-blow` mira a primeira, e um golpe que nenhuma casa pode receber derruba o personagem, que é o que ser posto fora de combate significa nos sistemas que usam esse tipo de trilha. Cura limpa uma marca, a mais leve, de qualquer tipo. Pontos temporários são recusados porque a trilha não tem um espaço para eles. O Engine lê a trilha como níveis RESTANTES; o restante da luta, cair, reviver, o registro e o resumo continuam iguais.

**Um descanso pode curar a trilha.** Uma restauração com `"to"` a reduz àquela quantidade de marcas, incluindo transbordamento; com um `"by"` NEGATIVO, limpa aquela quantidade, começando pelo transbordamento, então `"by": { "const": -2 }` limpa duas. Um passo que também nomeia um `kind` limpa só marcas desse tipo: o "Catch your breath" de Gravewatch é `{ "track": "harm", "kind": "knock", "to": "min" }`, que cura as pancadas e deixa os rasgos. Um passo que ADICIONARIA marcas não faz nada, porque um descanso não marca dano, e isso inclui um `"by"` positivo: ele é ignorado sem aviso, então escreva o sinal de menos.

### Casas numeradas em vez de níveis nomeados

Quando uma trilha tem o comprimento da resistência do personagem, dê a ela `boxes` em vez de `levels`. Ela tem tantas casas quanto o próprio `max`, que pode ser um valor calculado pela ficha (nunca um que leia o estado vivo), até 64:

```json
{
  "id": "strain",
  "label": "Strain",
  "min": 0,
  "max": { "derived": "strain_boxes" },
  "boxes": {
    "penalty": {
      "by": "remaining",
      "table": [
        [0, -1],
        [1, 0]
      ]
    }
  },
  "kinds": [{ "id": "strain", "label": "S", "severity": 0 }],
  "fill": "indexed",
  "onFull": "refuse"
}
```

- A penalidade ativa é lida em `table` (uma tabela de patamares, como a de um valor derivado, com penalidades iguais ou inferiores a 0) no número de casas `filled` ou `remaining`, seja qual for esse número, então uma tabela pode custar algo sem nada marcado. Ela não depende de quais casas estão marcadas.
- As casas são numeradas: a ficha mostra "Box 3", e o bloco de ficha do GM diz quantas estão marcadas de quantas, em vez de nomear um nível.

### Preencher por casa e trilhas que recusam

- `"fill": "indexed"` coloca uma marca na casa que o comando nomeia com `box=` (a primeira casa, quando não nomeia nenhuma) ou na próxima casa livre acima dela, e nunca move uma marca depois de colocada. Uma cura limpa a mais alta das marcas mais leves. A tela de ficha permite ao jogador clicar em qualquer casa livre.
- `"onFull": "refuse"` recusa uma marca que não tem casa livre, em vez de aumentar a gravidade da marca mais leve. O comando inteiro é recusado, então três marcas com duas casas livres não colocam nenhuma. Uma trilha indexada sempre recusa; declare isso com `"onFull": "refuse"` ao lado.

### Níveis que uma lista adiciona

`"extra": { "list": "scars", "countColumn": "levels", "penaltyColumn": "penalty" }` numa trilha com níveis nomeados permite que uma lista da ficha a alongue por personagem. Cada linha, em ordem, adiciona sua quantidade de níveis (no máximo 16) com sua penalidade, depois do último nível cuja penalidade seja pelo menos tão boa, com o nome desse nível quando as penalidades coincidem e com o da penalidade caso contrário. As cicatrizes de Gravewatch funcionam assim. Uma lista que a ficha oculta não adiciona nada e, se uma linha for excluída enquanto seus níveis estão marcados, as marcas que não cabem mais ficam como transbordamento: editar a ficha não desfaz dano.

`boxes`, `fill`, `onFull`, `extra` e o `kind` de um passo de descanso exigem Capability API 1.40 num conjunto empacotado.

## A penalidade nas rolagens

`resolution.penaltyFrom` nomeia a trilha de ferimentos cuja penalidade afeta todo teste do conjunto. É declarada, não presumida: sem ela, as rolagens continuam como antes da existência das trilhas.

O EFEITO da penalidade depende do tipo de resolução, assim como o número da ficha:

- Em `dice-pool`, ela **retira dados da reserva**, sem baixar de `pool.min`. Um `pool.min` de 1 permite rolar um dado mesmo no último patamar; um `pool.min` de 0 permite não rolar nenhum e falhar sem lançamento.
- Em `dice-sum`, é um **modificador fixo na rolagem**, incorporado ao mesmo número ao qual atributo e treinamento já contribuem.

Ela precisa nomear uma trilha de ferimentos. Uma trilha comum não tem penalidade e é recusada na importação. O resultado indica a penalidade aplicada para explicar ao jogador seus dados a menos; o bloco de ficha do GM também mostra o patamar e seu custo.

## Modificadores da ficha

Alguns números da ficha acompanham toda rolagem que afetam: uma mochila pesada em toda escalada, uma penalidade de armadura em toda tentativa de furtividade, uma bênção em tudo. `resolution.adjust` declara isso, nos dois tipos:

```json
"adjust": [{ "value": { "derived": "burdened" }, "abilities": ["brawn"] }]
```

- `value` é um valor da ficha, na mesma forma que um valor derivado lê, incluindo o estado vivo. Um número negativo subtrai. Ember Roads soma o volume do equipamento que o personagem leva na mochila num Burden, e uma tabela de patamares transforma cada três pontos disso em um a menos em cada rolagem de Brawn. Uma tabela baseada num estado vivo é como uma forma ou uma postura chega aos dados (veja Estados vivos).
- `abilities` é opcional. Com ele, o modificador só se aplica a um teste rolado com um desses atributos: o próprio atributo, uma perícia ou salvaguarda que o usa, uma perícia rolada com ele por `with=` ou um par de atributos que o inclui. Sem ele, aplica-se a todo teste.
- É aplicado onde a penalidade de ferimentos é aplicada: dados numa reserva, sob o mesmo piso `pool.min`, e um número fixo numa soma, dentro do modificador que o registro soma. Até oito entradas, somadas em cada teste.
- Uma luta do conjunto o soma a toda rolagem que monta a partir de uma ficha, quando a luta começa: um ataque rolado com um atributo ou perícia, uma salvaguarda, um teste de disputa e a iniciativa lidos de um atributo, perícia ou salvaguarda recebem as entradas daquele atributo, e qualquer outra rolagem recebe só as entradas que valem para toda rolagem.
- Um personagem sem ficha não recebe nada disso, assim como não recebe modificador.

O resultado informa o que a ficha adicionou (`adjust="-2"` no registro e uma linha no cartão de dados), para que o jogador veja por que a rolagem saiu assim. Exige Capability API 1.38 num conjunto empacotado.

## Descansos

Um descanso lista restaurações e elementos a limpar. Cada passo nomeia um alvo (`pool`, `poolGroup`, `listPools`, `track` ou `state`) e o define (`"to": "max"`, `"to": "min"` ou um número) ou modifica (`"by": { "const": 1 }` ou `"by": { "fractionOfMax": 0.5 }`). Se nomeia uma trilha de ferimentos, só pode curá-la, então seu `by` é negativo; veja acima. Se nomeia um estado vivo, só pode defini-lo, como `"default"` ou um dos seus valores. Um passo `poolGroup` com `fractionOfMax` muda cada reserva do grupo pela própria fração; acrescente `"shared": true` (Capability API 1.77) para calcular a fração sobre o máximo do grupo inteiro e distribuí-la entre as reservas do grupo na ordem em que a ficha as lista, cada uma até o que lhe falta. O descanso longo de 5e, "metade do número total de" dados de vida do personagem, guardados numa reserva por tipo de dado, é `{ "poolGroup": "hit_dice", "by": { "fractionOfMax": 0.5, "round": "down", "min": 1 }, "shared": true }`.

## Texto do Game Master

- `checkGuidance` substitui o parágrafo integrado que ensina a pedir um teste. Informe o sistema e quando rolar. O GM só nomeia perícia e dificuldade. O Engine rola e calcula a partir da ficha: não peça matemática ao modelo.
- `sheetGuidance` apresenta as fichas no prompt. Explique quais recursos importam e quando gastá-los.
- `worldGuidance` é opcional e lido uma vez ao gerar o mundo, para adequar a ambientação às regras: sem pólvora, magia rara, mortos que andam. Nunca chega a um turno.
- `opposition` diz quem joga pelo outro lado de uma luta (Capability API 1.774). `"game-master"` entrega o turno de cada oponente ao Game Master, que escolhe uma das opções oferecidas pelo Engine, recorrendo ao seletor do próprio Engine quando o Game Master não responde. Isso se aplica apenas em uma partida cujo jogador permitiu que o Game Master jogasse com chefes, e em todos os estilos de combate, inclusive uma luta Classic ou Tactical para um conjunto de regras sem bloco `combat`. Use para um sistema narrativo cuja oposição é jogada como ficção em vez de uma soma de dano: Fate, Blades in the Dark, Trophy, Lasers & Feelings. `"engine"`, ou a omissão da chave, mantém o seletor do Engine, com chefes (e, quando o jogador pede, oponentes com nome e de intelecto genial) a cargo do Game Master. Um conjunto de regras que usa a chave exige Capability API 1.774.
- `sheetSummary` escolhe campos, valores derivados e linhas de listas que o GM vê por personagem. O Engine sempre mostra modificadores de atributo, perícias e salvaguardas treinadas e valores vivos. Mantenha o restante curto, pois é enviado a cada turno. O `nameColumn` de uma lista do resumo pode ser uma coluna de texto ou enum (um enum mostra o rótulo do seu valor), e `columns` nomeia até mais três colunas da própria linha para imprimir depois do nome, de modo que o bloco diga `Gear: Crowbar 1d6` em vez de mostrar só nomes. Uma coluna booleana imprime seu rótulo quando está ativada. Ambos exigem Capability API 1.37 num conjunto empacotado.
- Você não precisa ensinar o comando de ficha em `sheetGuidance`. O Engine ensina cada comando sozinho, com os nomes que seu arquivo declara, e, quando seu conjunto tem uma trilha de ferimentos, adiciona o comando `op="damage"` para marcá-la e lista seus níveis e tipos de dano. Quando ele tem estados vivos, adiciona o comando `op="state"` e lista os valores que cada um pode assumir.

## Referência completa de regras para o GM

O `gmReference` opcional, no **nível superior** do arquivo, contém a referência completa de regras do conjunto para o Game Master, com até 16.000 caracteres. Coloque aqui as regras detalhadas de arbitragem e mantenha as instruções curtas de testes e recursos em `gm.checkGuidance` e `gm.sheetGuidance`. Esses campos, e `gm.worldGuidance`, continuam com seus limites de 1.500 caracteres; as orientações das camadas também mantêm seus limites atuais.

```json
"gmReference": "When a journey crosses hostile country, judge supplies, shelter and exposure before the next leg. A failed navigation check costs time rather than silently moving the party to its destination."
```

A referência aparece sob **Game Master rules reference** (referência de regras do Game Master) no prompt de sistema estável, uma vez por requisição. Ela nunca é copiada para o lembrete de cada turno. Como qualquer outro texto seguro para prompt, precisa ter uma única linha, sem caracteres de controle, colchetes nem chaves de macro (`{{` e `}}`). Quando a requisição ainda passa do limite de contexto depois dos ajustes habituais no histórico e no orçamento da resposta, a referência é encurtada com um corte marcado antes que as instruções principais sejam cortadas. Deixe-a sem definir para manter os prompts atuais. Um pacote que a use precisa declarar no manifesto `schemaVersion: 2` e `capabilityApi: { "major": 1, "minor": 145 }` ou mais recente.

## Relógios de progresso do grupo e da cena (`clocks`)

A Capability API **1.143** acrescenta um objeto `clocks` opcional no nível superior. Omita-o para manter os comandos de relógio desativados. O objeto é estrito: só estas três chaves são aceitas.

```json
"clocks": {
  "sizes": [4, 6, 8],
  "max": 8,
  "text": "Create clocks for looming threats and long projects. Tick them when the fiction advances."
}
```

`sizes` permite de uma a seis quantidades de segmentos inteiras e distintas, cada uma de 2 a 12; o padrão é `[4, 6, 8]`. `max` é o número máximo de relógios mantidos ao mesmo tempo, de 1 a 12, com padrão 8. O `text` opcional é uma linha segura para prompt, de até 400 caracteres, que explica quando o GM deve criar e avançar relógios. Um objeto vazio ativa os padrões.

Os relógios pertencem ao grupo e à cena, não a um personagem. O lembrete do GM lista os nomes e o preenchimento deles a cada turno e ensina estes comandos:

- `[clock: name="Alarm raised" size="6"]` cria um relógio vazio. Um tamanho não permitido, um nome que já existe (sem distinguir maiúsculas) ou ter chegado a `max` recusam a criação.
- `[clock: name="Alarm raised" tick="2"]` acrescenta segmentos. Avanços negativos os retiram; o preenchimento fica limitado a `0..size`. Um relógio cheio está concluído, continua visível e conta para `max` até ser removido. Um avanço negativo pode reabri-lo.
- `[clock: name="Alarm raised" clear]` remove o relógio nomeado.

Os nomes são linhas únicas de 1 a 100 caracteres, sem aspas duplas, colchetes, caracteres de controle nem chaves de macro. Cada tag pede exatamente uma ação. Os comandos se aplicam na ordem da resposta, então um relógio pode ser criado e avançado na mesma resposta. O Engine reescreve cada tag com `result="ok" now="4/6"` (ou `now="cleared"`), ou com `result="refused" reason="..."`. Atributos de resultado fornecidos pelo modelo são descartados. Relógios desconhecidos e pedidos malformados são recusados; no máximo 40 comandos se aplicam por resposta.

Game Mode mostra um círculo segmentado, o nome e o preenchimento ao lado do status do grupo. As tags ficam na resposta salva como comprovantes e são ocultadas da narração. Os relógios são guardados em cada instantâneo do estado da partida como `rulesetClocks`; dados ausentes significam nenhum relógio. Regenerar parte do instantâneo anterior, continuar parte do atual, e selecionar ou remover swipes/mensagens restaura os relógios junto com o resto daquele instantâneo.

## Ficha do grupo: um bando, uma nave ou Story Points compartilhados

A Capability API **1.144** acrescenta um `party` opcional no nível superior, ao lado de `sheet`. Ele contém uma ficha compartilhada por partida, como o bando de Blades, a nave de Lasers & Feelings ou os Story Points de Genesys:

```json
"party": {
  "label": "Crew",
  "fields": [
    { "id": "heat", "label": "Heat", "type": "number", "min": 0, "max": 9, "default": 0 },
    { "id": "vault", "label": "Vault capacity", "type": "number", "min": 0, "max": 16, "default": 8 },
    { "id": "upgrades", "label": "Upgrades", "type": "text", "maxLength": 400 }
  ],
  "pools": [{ "id": "coin", "label": "Coin", "max": { "field": "vault" }, "start": "empty" }],
  "advancement": { "fields": ["heat", "vault", "upgrades"], "text": "Record heat after a score." },
  "text": "Coin belongs to the crew."
}
```

`fields` usa o mesmo esquema de campo de `sheet.fields`; `pools` usa o de `sheet.live.pools`, inclusive `start`, `group`, `hideWhen` e `allowTemp`. É preciso pelo menos um campo ou uma reserva, e seus IDs precisam ser únicos dentro da ficha do grupo. IDs de personagem e do grupo podem coincidir. Nesta versão, fichas do grupo não têm seções, listas, atributos, valores derivados nem migrações de ficha de personagem. O `max` de uma reserva lê uma constante ou um campo numérico do grupo. Fórmulas de personagem não podem ler valores do grupo, e fórmulas do grupo não podem ler valores de personagem. `hideWhen` também só nomeia campos do grupo.

`advancement.fields` nomeia campos number, text ou longtext que o GM pode mudar de forma permanente. `advancement.text` e `text` aceitam, cada um, uma linha segura para prompt de no máximo 400 caracteres. O `summary` opcional reaproveita `gm.sheetSummary`: seus `fields` escolhem campos do grupo; `derived` e `lists` precisam ficar vazios. Sem resumo, todos os campos visíveis do grupo são mostrados. As reservas sempre aparecem.

```text
[sheet: sheet="party" op="restore" pool="coin" amount="3"]
[sheet: sheet="party" op="spend" pool="coin" amount="2"]
[sheet: sheet="party" op="advance" field="heat" by="2"]
[sheet: sheet="party" op="advance" field="upgrades" to="Hidden vault"]
```

`sheet="party"` escolhe a ficha compartilhada; deixe `who` de fora. O `who="party"` existente continua se aplicando a cada **personagem** e nunca muda a ficha compartilhada. Esta versão permite `spend`, `restore` e o `advance` de um campo na ficha do grupo. Fichas desconhecidas, operações sem suporte, reservas insuficientes, avanços não declarados e valores inválidos são recusados e reescritos com o resultado do Engine. As reservas do grupo seguem a mesma aritmética de valor atual e máximo e os mesmos padrões das reservas de personagem.

O GM recebe o rótulo, os campos e as reservas do grupo ao lado dos blocos de ficha dos personagens a cada turno. Game Mode oferece uma ficha do grupo recolhível e somente leitura ao lado dos retratos dos personagens, com a mesma apresentação de ficha. Os valores permanentes ficam uma única vez nos metadados do chat (`gamePartySheet`), ao lado de `gameCharacterCards`, e compartilham os comprovantes de avanço. As reservas vivas usam a entrada reservada `$party` de `rulesetLive`; nomes de personagem normalizados não podem colidir com ela. Regenerar parte de antes da resposta, e selecionar ou excluir um swipe restaura os valores permanentes e os vivos pelo histórico existente. Conjuntos sem `party` mantêm o comportamento atual.

**Criação compartilhada do grupo (Capability API 1.163).** Uma ficha do grupo pode ter `lists` (até 12, escritas como as listas da ficha de personagem), um `builder` guiado próprio e `fromMembers`: até 8 campos numéricos do grupo lidos dos personagens do grupo, cada um `{ "field", "count": true }` (quantos personagens há) ou `{ "field", "sum": "<character number field>" }` (quanto os deles somam, como os pontos de Totem). Os campos de membros são calculados a partir dos personagens como estiverem sempre que a ficha compartilhada é lida, então um personagem que entra ou sai os muda na hora. Com listas, o `summary.lists` do grupo pode nomeá-las.

O construtor é escrito exatamente como o de um personagem (reservas, etapas, linhas com preço, ofertas de gasto, perfis) e segue as mesmas regras, aplicadas aos campos e às listas do próprio grupo. Suas etapas de catálogo e de cópia de linhas podem ler os catálogos do conjunto que alimentam listas do grupo. Em Game Mode, qualquer jogador abre o Edit da ficha compartilhada, que oferece a configuração guiada, e a salva para o grupo inteiro. Cada salvamento nomeia a revisão em que foi aberto (`gamePartySheetRevision` nos metadados do chat, aumentada a cada salvamento e pelas mudanças da própria história): um salvamento aberto antes de o de outra pessoa entrar é recusado, a ficha mais nova é mostrada, e o rascunho do jogador continua aberto, então salvar de novo é escolha dele para substituí-la.

```json
"party": {
  "label": "The Crew",
  "fields": [
    { "id": "tier", "label": "Tier", "type": "number", "min": 0, "max": 4, "default": 0 },
    { "id": "size", "label": "Crew size", "type": "number", "min": 0, "max": 12, "default": 0 }
  ],
  "lists": [{ "id": "upgrades", "label": "Upgrades", "columns": [{ "id": "name", "label": "Name", "type": "text" }] }],
  "builder": { "steps": [{ "id": "upgrades", "label": "Upgrades", "kind": "rows", "list": "upgrades" }] },
  "fromMembers": [{ "field": "size", "count": true }]
}
```
