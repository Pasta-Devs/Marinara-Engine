# Construtor de personagens de conjuntos de regras

Esta página faz parte de [Escrever conjuntos de regras de Game Mode](writing-rulesets.md). O construtor guiado: criar um personagem em etapas, de raça e classe a pontuações, proficiências, magias e equipamento.

Uma ficha pode declarar `sheet.builder` (Capability API 1.86). O editor de fichas, nos editores de personagem e de persona e no **Edit sheet** (editar ficha) de uma partida, passa a abrir numa visão **Guided** (guiada) ao lado do formulário completo (**All fields**: todos os campos): as etapas no topo, cada uma com um selo que conta as escolhas que ainda espera, **Back** (voltar) e **Next** (avançar), que nunca bloqueiam (um jogador pode deixar escolhas para depois), e o personagem como está ao lado delas: o que as etapas escreveram, os valores dos atributos, os valores que `gm.sheetSummary` nomeia (classe de armadura, bônus de proficiência) e as salvaguardas e perícias treinadas.

```json
"builder": {
  "tier": "proficient",
  "steps": [
    { "id": "race", "label": "Race", "kind": "catalog", "catalog": "races", "field": "race" },
    { "id": "subrace", "label": "Subrace", "kind": "catalog", "catalog": "races", "min": 0,
      "within": { "step": "race", "filter": "parent" } },
    { "id": "class", "label": "Class", "kind": "catalog", "catalog": "classes", "field": "class" },
    { "id": "level", "label": "Level", "kind": "fields", "fields": ["level", "background"] },
    { "id": "scores", "label": "Ability Scores", "kind": "abilities", "methods": {
      "pointBuy": { "budget": 27, "costs": [[8, 0], [9, 1], [10, 2], [11, 3], [12, 4], [13, 5], [14, 7], [15, 9]] },
      "standardArray": [15, 14, 13, 12, 10, 8],
      "roll": { "count": 4, "sides": 6, "keep": 3 },
      "manual": true } },
    { "id": "skills", "label": "Proficiencies", "kind": "trained" },
    { "id": "gear", "label": "Equipment", "kind": "startingGear" }
  ]
}
```

Até 32 etapas, cada uma `{ id, label, kind, ... }`; um pacote com mais de 16 declara Capability API 1.112, e um com mais de 24, Capability API 1.768:

- `catalog`: entradas de um catálogo de linhas, mostradas como cartões com o `summary` atrás de **Info** (informações). `min` (padrão 1) é quantas a etapa pede, e `max` (padrão 1), o máximo que ela aceita; com `max` 1, uma nova escolha substitui a anterior. Os dois podem ir até 60; um pacote com qualquer um acima de 20 declara Capability API 1.110, e um com qualquer um acima de 40, Capability API 1.768 (o grimório de um mago de nível 20 contém 44 magias). `field` nomeia um campo de texto ou enum em que os rótulos escolhidos são escritos (um campo enum recebe o ID ou o rótulo da entrada, o que for um dos seus valores). `filters` fixa valores dos filtros do catálogo, e `within: { step, filter }` só oferece entradas cujo `filter` nomeia uma entrada escolhida naquela etapa anterior, como uma sub-raça nomeia sua raça; desmarque a raça, e a sub-raça deixa de contar. `upTo: { filter, value }` (Capability API 1.87) só oferece entradas cujo `filter` numérico seja no máximo `value`, um valor lido da ficha como está, como características até o nível do personagem (`{ "filter": "level", "value": { "derived": "level" } }`); uma entrada sem o filtro é sempre oferecida, e uma escolha abaixo da qual a ficha caiu depois deixa de contar, mas é mantida. Uma escolha que muda o valor lido (uma classe que define o nível) é resolvida na mesma mudança, assim como um valor mudado em **All fields** (um nível reduzido ali retira na hora o que uma característica acima dele deu). `countFrom` (Capability API 1.90) é um valor lido da ficha da mesma forma que vale tanto como `min` quanto como `max`: quantas entradas a etapa pede e o máximo que aceita, arredondado para baixo e nunca acima de `max`, como as magias que uma classe conhece no nível do personagem (`{ "derived": "spells_known" }`). Escolhas além dele são mantidas, mas não contam até a contagem subir de novo. Uma etapa de catálogo também pode ter `stamp` (Capability API 1.108), de 1 a 4 valores de coluna escritos em toda linha que ela acrescenta, como `"stamp": { "class": "wizard" }` na etapa de magias do mago e `"stamp": { "class": "cleric" }` na do clérigo. Cada chave precisa ser uma coluna em toda lista que o catálogo alimenta; os valores são strings, números ou booleanos. O carimbo substitui o valor inicial do catálogo. As linhas existentes e as edições posteriores em **All fields** continuam sendo do jogador. Com a Capability API 1.130, um valor de carimbo pode ser um objeto cujo `fromWithin` é `"id"`, `"label"` ou um ID de filtro declarado pelo catálogo pai: ele lê o primeiro pai correspondente na ordem das escolhas, escreve uma string ou um número uma vez quando a linha é acrescentada e deixa essa coluna sem carimbo se nenhum pai corresponder ou se o filtro dele estiver ausente ou for uma matriz.

  ```json
  {
    "id": "spells",
    "label": "Spells",
    "kind": "catalog",
    "catalog": "spells",
    "within": { "step": "class", "filter": "class_ids" },
    "stamp": { "class": { "fromWithin": "label" } }
  }
  ```

- `fields`: um formulário curto de campos nomeados. O selo dele conta os que ainda estão vazios, exceto os listados em `optional` (uma subclasse escolhida num nível posterior). `shownWhen: { "field_id": { "field": "level" } }` (Capability API 1.107) mostra e conta um campo nomeado da etapa só enquanto sua referência de valor lê acima de 0 na ficha como está; campos ocultos mantêm seus valores. `total: { "fields": ["level_bard", "level_other"], "max": 20 }` (1.107) mantém pelo menos dois campos numéricos da etapa dentro de um máximo combinado (um inteiro de 1 a 1000), reduzindo o máximo de cada campo pelos valores atuais dos outros sem ficar abaixo do próprio mínimo, e soma um ao selo se o total passar do limite; **Next** continua funcionando.
- `abilities`: os valores de atributo (`abilities`, todos quando omitido), definidos por qualquer um dos `methods`: `pointBuy` (um `budget` que não passe do custo de comprar todos os valores até o topo, e o custo de cada valor a partir do mais baixo, onde todo valor começa, subindo um de cada vez; um valor digitado à mão parte do valor mais próximo da tabela), `standardArray` (um valor para cada atributo), `roll` (`count` dados de `sides`, mantendo os `keep` maiores, rolados pelos próprios dados do Engine, uma rolagem por atributo, depois distribuídas como um conjunto padrão) e `manual`. `manual: true` mantém os limites de valor existentes; `manual: { min, max }` (Capability API 1.110) restringe os valores base digitados, antes das concessões, a esses limites inteiros, com min de pelo menos -100, max de no máximo 1000 e min no máximo igual a max, enquanto os limites próprios de cada atributo continuam valendo para o total. `default` (1.87) é o método em que começa um personagem que o construtor inicia a partir de uma ficha em branco (e que ele mantém, mesmo que o padrão do conjunto mude depois), então um iniciante vê, por exemplo, a compra de pontos até escolher outro; um personagem descrito nunca o recebe, e seus valores ficam como estão até o jogador escolher um método depois de descrever; **Manual entry** (entrada manual) continua sendo a edição digitada dentro dos limites, e **All fields** está sempre lá. O que as escolhas acrescentam vai por cima: a etapa mostra base, bônus, total e modificador. No máximo uma etapa de atributos.
- `allocate` (Capability API 1.152): bolinhas distribuídas em estágios com cotas por prioridade ou orçamentos por grupo, descritas abaixo.
- `trained`: as escolhas de perícias e salvaguardas que as escolhas oferecem, e o próprio `choose: [{ "what": "skills", "count": 2, "from": [...] }]` da etapa (qualquer uma delas quando `from` é omitido).
- `startingGear`: lista o equipamento inicial do conjunto. O equipamento é pego numa partida, no inventário, como sempre.
- `choices` (Capability API 1.91): `catalog` nomeia um catálogo de linhas, e a etapa é onde são escolhidas as entradas dele que as escolhas concedem (`grants.entries`, abaixo), como um idioma à sua escolha.

Uma etapa de equipamento inicial pode ter `"strict": true` (Capability API 1.109). No modo só permitidos, o padrão, ela só oferece equipamento cujo `fits` lê verdadeiro na ficha como está, sem estado vivo, mais o equipamento sem `fits`; não há lista de outros equipamentos. Para 5e, coloque `fits: { "value": { "field": "wizard_level" }, "atLeast": 1 }` no kit do Wizard e o campo de nível de classe correspondente em cada kit de outra classe; deixe `fits` fora do kit do Acolyte para que ele sirva para todos. A edição livre oferece de novo todos os kits. O seletor do inventário limpa uma seleção que deixa de servir depois de uma mudança de classe ou ao sair da edição livre e diz por quê; ele também verifica se serve antes de pegar o equipamento. Sem equipamento que sirva, a etapa mostra o estado vazio, e Next continua disponível. Etapas sem `strict` continuam oferecendo todos os kits. O modo é local a cada tela, não é registrado com uma construção salva nem enviado ao servidor.

O que uma escolha dá são os `grants` da entrada, lidos só pelo construtor:

```json
{
  "id": "half-elf",
  "label": "Half-Elf",
  "grants": {
    "abilities": { "add": { "cha": 2 }, "choose": [{ "count": 2, "amount": 1, "except": ["cha"] }] },
    "trained": { "skills": [], "saves": [], "choose": [{ "what": "skills", "count": 2 }] },
    "sets": { "speed": 30 }
  }
}
```

- `abilities.add` soma aos valores; `abilities.choose` permite ao jogador escolher `count` atributos (nunca um duas vezes, nunca um de `except`) que recebem `amount` cada. Com `"repeat": true` (Capability API 1.93), um atributo pode ser escolhido mais de uma vez, `amount` a cada vez, então `{ "count": 2, "amount": 1, "repeat": true }` é o +2 num atributo ou +1 em dois de um aumento de valor de atributo; a etapa mostra um sinal de menos ao lado de um atributo para desfazer um. Em qualquer caso, nenhum valor passa do seu `max`. `upTo` (Capability API 1.96) limita até onde a própria escolha pode elevar um valor, depois do que todas as outras concessões somam: `{ "count": 2, "amount": 1, "repeat": true, "upTo": 20 }` é o aumento do SRD, que "can't increase an ability score above 20"; a etapa desativa um atributo que já está nesse valor. A escolha aparece na etapa de atributos, ou onde a entrada foi escolhida quando não há nenhuma.
- `trained` treina perícias e salvaguardas e oferece escolhas, mostradas na primeira etapa de treinamento ou onde a entrada foi escolhida. Elas são treinadas no `tier` da concessão, senão no `tier` do construtor, senão no primeiro nível acima de sem treinamento que a ficha oferece para perícias ou salvaguardas. Uma escolha nunca oferece o que as escolhas já treinam no seu nível ou acima, diretamente ou por uma escolha anterior (Capability API 1.104): um antecedente que treina Insight deixa a escolha de perícias de uma classe para as outras, como o SRD pede. Uma escolha guardada antes de ser tomada dessa forma não conta, então a etapa pede outra, e uma escolha sem nada a oferecer não é mostrada. Uma escolha pode dizer `"held": "<tier>"` (Capability API 1.105): ela só oferece o que as escolhas treinam nesse nível ou acima, ou o que uma escolha abaixo do próprio nível mantém ali, como a Expertise de 5e são duas perícias em que você é proficiente: `{ "tier": "expertise", "choose": [{ "what": "skills", "count": 2, "held": "proficient" }] }`. `held` fica abaixo do nível em que a escolha treina.
- `sets` escreve valores de campo: o dado de vida de uma classe, seu atributo de conjuração.
- Uma entrada de catálogo pode dizer quando uma etapa do construtor a oferece: `offeredWhen` (Capability API 1.99) é um valor lido da ficha como está, e a entrada só é oferecida enquanto ele ler acima de 0, como 5e oferece uma segunda classe só quando os pré-requisitos de multiclasse são atendidos (um valor derivado por classe). Uma escolha que depois lê 0 deixa de contar e é mantida, como as de `upTo`. Uma entrada cuja própria escolha muda o que seu `offeredWhen` lê (um valor que ela aumenta, um campo que define, uma perícia que treina, uma lista em que escreve, diretamente ou por meio de um valor derivado) é recusada, já que ela se ofereceria, se retiraria e se ofereceria de novo. Uma entrada com um grupo `exclusive` é lida na ficha sem nenhuma das escolhas que a etapa guardou nesse grupo (Capability API 1.100), já que escolhê-la as descarta: um talento tomado no lugar de um aumento de valor de atributo e que exige Strength 13 não é oferecido com a Strength que esse aumento deu. Uma escolha que uma entrada concede (`grants.entries.choose`) mantém suas opções sujeitas ao `offeredWhen` delas da mesma forma (Capability API 1.106). O seletor de catálogo em **All fields** oferece todas as entradas, como sempre.
- Uma entrada de catálogo pode nomear um grupo `exclusive` (Capability API 1.94): uma etapa do construtor mantém uma escolha de cada grupo, então escolher uma descarta a outra escolha da etapa nesse grupo, e só a mais recente conta. Um talento tomado no lugar de um aumento de valor de atributo compartilha um grupo com ele: `"exclusive": "fighter-asi-4"`. `"exclusiveDefault": true` (Capability API 1.772) faz de uma entrada aquela que uma etapa que aceita tudo o que oferece aceita de seu grupo até que o jogador escolha outra.
- `entries` (Capability API 1.91) oferece entradas de outro catálogo de linhas para escolher: `{ "choose": [{ "catalog": "languages", "count": 1 }] }`, no máximo seis escolhas. `filters` fixa valores dos filtros desse catálogo, e `ids` lista as únicas entradas oferecidas (`{ "catalog": "tools", "count": 1, "ids": ["smiths-tools", "brewers-supplies", "masons-tools"] }`). Elas são escolhidas na etapa `choices` do construtor para esse catálogo (uma concessão que nomeia um catálogo sem essa etapa é recusada), só são oferecidas entradas que escrevem linhas e as linhas delas vão para a ficha, e uma entrada escolhida para uma concessão não é oferecida a outra. As concessões delas não são aplicadas.
- Uma escolha também escreve as `rows` da entrada, uma vez. Uma entrada pode ter `grants` e nenhuma `rows` (uma classe cujas características vêm de outro catálogo), e um catálogo cujas entradas só concedem não precisa de `feeds`; o seletor de catálogo nunca oferece essas entradas.

Desmarcar retira o que uma escolha deu, e só isso: os aumentos (até onde os limites de um valor deixaram subir), o treinamento, os valores de campo e as linhas. O que a ficha já tinha do próprio jogador (uma perícia treinada à mão, uma linha acrescentada pelo seletor de catálogo) continua sendo dele, e uma edição feita em **All fields** fica até a resposta do próprio construtor para esse valor mudar. Uma entrada escolhida em duas etapas do mesmo catálogo concede uma única vez, e uma que as camadas de uma partida ocultam continua contando pelo que deu. Um campo que uma escolha define com `sets` só é escrito enquanto ainda estiver em branco, ou enquanto o construtor já responder por ele, então um nível digitado à mão nunca é sobrescrito; um valor pelo qual o construtor responde e que o jogador muda na própria etapa de campos continua sendo do construtor e some quando uma escolha posterior não o pede mais. As escolhas do jogador ficam guardadas ao lado da ficha, então uma etapa pode ser reaberta depois.

**Distribuição de pontuações em estágios (Capability API 1.152).** Uma etapa `allocate` compra uma bolinha por ponto, com orçamento e limites de criação próprios. Ela não muda o método nem as respostas salvas da etapa única `abilities`. Use etapas separadas para atributos, Virtudes e os freebies posteriores:

```json
{
  "id": "attributes",
  "label": "Attributes",
  "kind": "allocate",
  "priorities": [7, 5, 3],
  "annotations": true,
  "groups": [
    {
      "id": "physical",
      "label": "Physical",
      "targets": [{ "ability": "strength" }, { "ability": "dexterity" }, { "ability": "stamina" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "social",
      "label": "Social",
      "targets": [{ "ability": "charisma" }, { "ability": "manipulation" }, { "ability": "appearance" }],
      "base": 1,
      "min": 1,
      "max": 5
    },
    {
      "id": "mental",
      "label": "Mental",
      "targets": [{ "ability": "perception" }, { "ability": "intelligence" }, { "ability": "wits" }],
      "base": 1,
      "min": 1,
      "max": 5
    }
  ]
}
```

Há de 1 a 12 grupos, cada um com `id` estável, `label` e de 1 a 120 alvos. Os alvos são distintos dentro da etapa inteira. Um alvo nomeia exatamente um `{ ability }` existente, um `{ field }` numérico, um `{ skill }`, um `{ save }` ou um `{ bonus }`; um bônus é a entrada numérica de `build.bonuses` para uma perícia ou salvaguarda existente. Os grupos usam exatamente um modo de orçamento: `priorities` tem uma cota inteira não negativa por grupo (repetições permitidas), ou **todo** grupo declara `budget: Ref`. Os lugares de prioridade são atribuídos explicitamente, e atribuir um lugar ocupado troca os grupos. A ordem da matriz nomeia primário, secundário, terciário e depois prioridades numeradas; coloque as cotas maiores primeiro se esses nomes devem acompanhar o tamanho. Os orçamentos são de no máximo 1.200.000 pontos.

`base` é opcional; `min` e `max` são obrigatórios. Cada um aceita um inteiro ou uma `Ref` que não seja viva, como `{ "derived": "archetype_floor" }`. As pontuações precisam resultar em números inteiros de 0 a 10.000 e caber nos limites de armazenamento ou no mapa de níveis do alvo. A primeira base substitui o padrão de um alvo em branco, mantendo os valores de método e as concessões existentes; uma base posterior é um piso sobre os estágios anteriores. Sem base, o estágio começa na pontuação existente. Mínimo e máximo iguais fixam o valor de criação: `base: 0, min: 0, max: 0` expressa uma Appearance fixa. Os mínimos não compram bolinhas automaticamente. Orçamentos e limites podem usar os operadores derivados existentes, mas não podem ler alvos mudados por esta etapa ou por uma posterior, nem por meio de valores derivados. Condições em concessões gratuitas também não podem ler pontuações num grupo de distribuição que elas possam mudar, inclusive grupos conectados em outros estágios. Preços por fórmula não têm suporte: todo incremento pago custa um ponto. Uma fonte não resolvida ou inválida aparece como **not configured** (não configurado).

Alvos de perícia e de salvaguarda precisam de `sheet.builder.ratingTiers`, separadamente para cada alvo:

```json
"ratingTiers": [
  { "target": { "skill": "athletics" }, "tiers": ["none", "trained", "expert"] },
  { "target": { "save": "will" }, "tiers": ["none", "trained"] }
]
```

O índice da matriz é a pontuação numérica. Os mapas têm de 1 a 12 IDs de nível existentes, oferecidos e crescentes, começando no nível sem treinamento do conjunto; eles nunca são deduzidos dos bônus dos níveis. Alvos diferentes podem usar mapas diferentes. Coloque alvos com limites de criação diferentes em grupos separados.

O `grants.ratings` de um catálogo fornece bolinhas gratuitas, antes de **todos** os estágios pagos:

```json
"ratings": [
  { "target": { "skill": "athletics" }, "add": 1 },
  { "target": { "save": "will" }, "set": 1 }
]
```

Cada concessão tem ou um `add` positivo ou um `set` não negativo, nunca os dois. Todas as concessões `set` são pisos: a maior vence, depois todas as somas se acumulam, parando no limite de armazenamento do alvo. Duas somas gratuitas de graduação chegam, portanto, à graduação dois, sem cobrar do orçamento pago. O treinamento existente e as concessões de campo e de atributo se combinam antes dessas concessões de pontuação. As escolhas de entrada continuam só escrevendo linhas; elas nunca aplicam recursivamente as concessões da entrada escolhida.

A interface mostra as pontuações base/anterior, gratuita, comprada e total, a faixa de criação e o orçamento restante. O sinal de mais fica desativado num limite, sem orçamento ou enquanto compras inválidas ou substituições manuais precisarem de atenção. Gastar de menos, mínimos impossíveis e substituições recebem selos; Back e Next continuam disponíveis. Reatribuir uma prioridade mantém os incrementos salvos do grupo. Um grupo que gastou demais fica inativo por inteiro; uma compra acima do limite do alvo fica inativa para esse alvo. Reduza ou limpe essas respostas para corrigi-las, ou restaure a cota anterior para reativá-las. Estágios posteriores podem passar dos limites de criação anteriores. **All fields** continua sendo a edição livre, com as substituições mostradas explicitamente em vez de ajustadas às regras de criação.

O `builder.allocations[stepId]` salvo guarda os índices dos lugares de prioridade pelo ID do grupo, os incrementos pagos `bought` e `notes` opcionais por chaves de alvo estáveis `kind/id` (por exemplo, `ability/strength`). `annotations: true` oferece até 1.000 caracteres por alvo para explicações de herança ou especialidades; o construtor não julga esse texto. Os incrementos aplicados pertencem separadamente a cada estágio. Reabrir nunca concede de novo as concessões nem reabastece recursos, e descrever uma ficha existente registra as escolhas sem reescrevê-la, inclusive quando a descrição termina. Desmarcar recalcula as pontuações gratuitas e os estágios pagos, preservando as diferenças manuais.

**Orçamentos compartilhados e compras com preço (Capability API 1.153).** Declare até 12 reservas de criação em `sheet.builder.pools`. Várias etapas `spend` podem usar uma mesma reserva; reservas separadas mantêm independentes os pontos de ocupação e os de interesse pessoal. Os orçamentos são referências de valor que não são vivas, inclusive os cálculos existentes `sum`, `scale`, `multiply`, `min`, `max`, `stepTable`, `enumTable` e `listSum`. O valor resolvido precisa ser finito e estar entre 0 e 100.000. Uma fonte ausente aparece como "not configured".

```json
{
  "pools": [
    { "id": "occupation", "label": "Occupation", "budget": { "derived": "occupation_points" }, "creditLimit": 0 },
    { "id": "interest", "label": "Personal interest", "budget": { "derived": "interest_points" } }
  ],
  "steps": [
    {
      "id": "occupation_skills",
      "label": "Occupation skills",
      "kind": "spend",
      "pool": "occupation",
      "offers": [
        {
          "id": "accounting",
          "label": "Accounting",
          "target": { "field": "accounting_value" },
          "cost": { "flat": 1 },
          "min": 5,
          "max": 99
        }
      ]
    }
  ]
}
```

Cada etapa tem até 120 ofertas com `id` e `label` estáveis. Os alvos usam o mesmo contrato de exatamente um `ability`, `field` numérico, `skill`/`save` mapeado ou `bonus` dos estágios de distribuição. Compras de linhas de lista ficam reservadas para o recurso de identidade de linha (F4); esta API não identifica linhas pela posição na matriz. Os limites precisam caber nos limites de armazenamento do alvo. As pontuações iniciais e as concessões gratuitas são preservadas, nunca cobradas de novo: um Background com duas bolinhas gratuitas e cinco pagas tem sete.

Um custo é exatamente um destes:

- `{ "flat": 1 }`: um ponto por incremento de pontuação.
- `{ "perRank": 5 }`: cinco vezes a próxima graduação, então subir de 2 para 3 custa 15.
- `{ "table": [[5, 0], [5.25, 5], [5.5, 12]] }`: preços acumulados em pontuações crescentes. A próxima compra vai para a pontuação seguinte e custa a diferença (5, depois 7, aqui). Pontuações fracionárias exigem um campo numérico não inteiro; as tabelas incluem os dois limites da oferta.

O `overrides: [{ "when": { "derived": "career_affinity" }, "cost": { "perRank": 2 } }]` opcional contém no máximo 12 entradas. A primeira condição positiva vence. As condições leem a ficha antes das compras; sem correspondência, vale o preço base. Orçamentos e condições não podem ler alvos comprados, nem por meio de valores derivados, nem depender de escolhas posteriores. As concessões gratuitas e os estágios de distribuição são aplicados antes das compras com preço.

Os preços têm margens positivas, exceto créditos declarados explicitamente. Para um defeito cuja pontuação aumenta, use `"credit": true, "cost": { "flat": -1 }`. Para uma redução a partir de uma base declarada, use `"credit": true, "baseline": 10, "min": 6, "max": 10, "cost": { "flat": 1 }`: uma compra reduz 10 para 9 e registra um crédito de um ponto. O valor inicial precisa coincidir com a base. Um alvo de crédito tem uma única oferta em todo o construtor, o que impede ciclos de compra e crédito.

As reservas têm crédito zero por padrão. Defina `creditLimit` como o crédito total máximo e, opcionalmente, acrescente até 12 `caps: [{ "filter": "flaw", "maxCredit": 2 }]`. Os filtros nomeiam `tags: ["flaw"]` de ofertas, então os créditos de defeitos e de desvantagens podem ter limites separados. Os limites contam os créditos brutos, independentemente dos gastos positivos. Contagens distintas de peculiaridades continuam sendo restrições de escolha ou de linha.

**Linhas contadas e linhas que correspondem (Capability API 1.205).** Um `listSum` pode ter `where:
{ "column", "equals" }` para ler só as linhas cuja célula é igual a um valor (uma célula vazia lê o padrão da coluna), e `count: true` no lugar de `column` para contar as linhas em vez de somar uma coluna. A pirâmide de talentos de Genesys são duas contagens derivadas e uma regra de criação:

```json
{
  "id": "tier2",
  "label": "Tier 2 talents",
  "op": "sum",
  "of": [{ "listSum": { "list": "talents", "count": true, "where": { "column": "tier", "equals": 2 } } }]
}
```

com uma regra cujo `value` lê `tier2` e cujo `max` lê a contagem do nível 1 menos um.

**Preços de linha calculados por linha (Capability API 1.206).** O `cost` em forma de objeto de uma etapa de linhas pode multiplicar sua `column` por `times` e somar `add`, então `{ "column": "tier", "times": 5 }` dá a um talento de Genesys o preço de 5 XP por nível; `add` sozinho é um preço fixo escrito como objeto. `overrides` (até 4) dá um preço usado no lugar quando um valor derivado nomeado por um prefixo e pela própria célula da linha lê acima de 0 na ficha: `{ "add": 5, "overrides": [{ "derived": { "prefix": "affinity_", "cell": "ability" }, "cost": 4 }] }` dá a um Charm de Exalted o preço de 4 Bonus Points quando `affinity_<its Ability>` está acima de 0. Uma célula enum precisa ter um valor derivado para cada valor que pode conter.

**Ofertas sem preço (Capability API 1.207).** O `cost` de uma oferta de gasto (ou de uma substituição) pode ser `{ "unpriced": true }` enquanto a fonte não tiver fornecido o preço: a oferta aparece com uma nota, prende a reserva por nada e nunca é comprada. Uma compra salva com um preço que depois passa a não ter preço fica inativa e é mantida para correção.

**Mais campos (Capability API 1.208).** Uma ficha pode declarar até 240 campos; antes da 1.208, o teto é 160. As graduações de perícia, as graduações de categoria, os potenciais e os totais de Rolemaster precisam desse espaço.

**Rolagens escritas num atributo (Capability API 1.209).** A rolagem de uma etapa `roll` pode nomear `ability` em vez de `field` (exatamente um dos dois). O resultado fica dentro dos limites do próprio atributo. Com `gain`, o teste é rolado contra o valor, e só um resultado acima dele soma o ganho, que o construtor passa a manter como aumento: rolar ou comprar o valor de novo mantém a melhoria por cima. Sem `gain`, o resultado é escrito como um valor digitado, mantido até a resposta do próprio construtor para esse valor mudar. Um atributo calculado não pode ser rolado, e cada atributo é rolado no máximo uma vez por etapa.

**Colunas de lista calculadas (Capability API 1.210).** Uma coluna numérica pode nomear `sum`: até seis outras colunas numéricas da mesma linha, somadas (uma célula vazia lê o padrão da sua coluna) e mantidas entre o `min` e o `max` da coluna. A célula aparece somente leitura, é preenchida a cada leitura de uma ficha salva e é lida por somas, testes de linha e tudo o mais como uma célula digitada. Uma coluna calculada não é rolada e nunca soma outra coluna calculada. A pontuação de uma especialidade de CoC é `"sum": ["base", "occupation", "interest"]`.

**Aumentos parciais de valor (Capability API 1.211).** O `abilities.choose` de uma concessão pode nomear `partialFrom`. Um valor que já está nessa marca ou acima quando a escolha chega recebe um aumento parcial, e dois parciais dão `amount` uma vez. As escolhas contam na ordem em que o construtor as faz, depois de todos os aumentos inteiros, então os boosts posteriores de Pathfinder 2e leem `"amount": 1, "partialFrom": 4`: um modificador +4 precisa de dois boosts para chegar a +5. Combina com `upTo`.

**Testes de linha numa postura (Capability API 1.212).** Uma entrada de `checks[]` de uma lista pode nomear `stance`, uma das `resolution.stances` da reserva de dados. O teste de toda linha fica então nessa postura, como uma perícia que a postura lista: as pursuits de Stewpot contam dados do jeito STILLNESS. O lembrete do Game Master nomeia as linhas com as perícias da postura.

**Especialidades de atributo (Capability API 1.213).** O `contextual` de uma lista pode definir `"abilities": true`. A célula `skill` dela pode então nomear um atributo (pelo ID, pelo rótulo ou pela forma curta), além de uma perícia, e a linha se aplica a qualquer teste rolado com esse atributo: um teste de atributo puro, uma perícia cujo atributo próprio é ele, ou uma perícia que `with=` troca para ele. Uma especialidade de atributo de World of Darkness, "Strength: lifting", é uma linha chamada "lifting" cuja célula de perícia diz "Strength".

**Anulação desativada (Capability API 1.214).** Um `check` contextual (no `contextual` de uma lista ou no `mechanics.contextual` de uma entrada) pode definir `"cancel": false`. Numa rolagem em que ele é aplicado, faces iguais ou inferiores a `resolution.cancel.upTo` não retiram sucessos; uma falha crítica ainda as lê. O conjunto precisa ter um `resolution.cancel` para desativar.

**Itens disponíveis sem carregá-los (Capability API 1.215).** O `grants.itemAccess` de uma entrada de catálogo lista até 48 itens do conjunto (`<catalog>/<entry>`, nunca um serviço). Escolher a entrada no construtor guiado os deixa disponíveis para o personagem: a ficha e o bloco de ficha do Game Master os listam como não carregados, e nada vai para a bolsa. O Game Master acrescenta um ao inventário quando ele é pego, como um personagem de Blades declara a carga no início de um trabalho (score).

**Bolinhas de linha na criação (Capability API 1.216).** Um grupo `allocate` pode nomear `rows`, até quatro pares `{list, column}`: as bolinhas nessa coluna numérica nas linhas da lista contam contra o orçamento do grupo, ao lado dos alvos dele. As linhas são editadas na lista; um grupo com mais bolinhas de linha do que seu orçamento fica esperando o jogador. A substituição de custo de uma etapa de linhas pode dar `times`, uma taxa por unidade para a coluna de custo, no lugar de um `cost` fixo. As linhas de Craft de Exalted colocam "dots" contra os 28 pontos de Ability e dão às bolinhas "bought" o preço `times: 2`, substituído por `times: 1` onde `affinity_<ability>` está definido; uma coluna de pontuação calculada (1.210) soma os dois.

**A melhor pontuação (Capability API 1.217).** Um `check` contextual pode definir `"best": true`: um teste de perícia em que ele é aplicado rola a melhor pontuação de perícia do personagem quando ela é maior que a pedida. Um conjunto `dice-highest` pode usar um teste contextual que faça só isso; todos os outros efeitos de teste continuam exigindo uma reserva de dados. O Rook's Gambit de Blades é uma linha de habilidade especial com `"check": {"best": true}`, aplicada pelo nome.

**Custos que marcam uma trilha (Capability API 1.218).** Uma entrada de `cost` contextual pode ser `{"track": "<id>", "by": N}`, além de `{"pool", "amount"}`: aplicar a linha ou a entrada marca N nessa trilha viva comum, até onde os limites dela deixam (uma trilha de ferimentos não é marcada dessa forma). O `contextual` de uma lista também pode ter um `cost`. O Rook's Gambit de Blades é uma linha com `"check": {"best": true}` e `"cost": [{"track": "stress", "by": 2}]`. Nomes aplicados por `apply=` leem igualmente apóstrofos e aspas curvos e retos.

**Catálogos emprestados (Capability API 1.220).** Um catálogo pode pegar emprestado o catálogo de outro conjunto instalado em vez de ter o próprio: `{ "id": "creatures", "label": "Creatures", "holds": "creatures", "from": { "ruleset": "5e-2014", "catalog": "creatures" } }`. O conjunto que empresta é encontrado pelo ID, sozinho ou sob um namespace da comunidade, e as entradas dele são lidas à luz do conjunto que as pega emprestadas, então uma entrada que nomeia algo que esse conjunto não declara (uma condição, um nível de ameaça, um sentido) fica de fora e é registrada, enquanto as demais passam. `entries` ao lado de `from` se somam às emprestadas, ou substituem uma de mesmo ID; elas são verificadas quando o conjunto é lido, então o cabeçalho nomeia os `filters` que elas usam (um cabeçalho sem nenhum recebe os de quem empresta). Uma criatura emprestada escrita como ficha usa os IDs de quem empresta; `from.sheet` diz como eles são lidos no conjunto que pega emprestado: `fields` mapeia um campo para outro ID (ou `null` para deixá-lo de fora), `values` mapeia os valores de um campo, e `tiers` mapeia níveis de proficiência (os de uma criatura e os que qualquer entrada concede ou pede), como em `"sheet": { "fields": { "ac": "ac_typed", "size": null }, "values": { "hp_method": { "by_hand": "manual" } }, "tiers": { "proficient": "trained" } }`. Qualquer entrada emprestada, inclusive itens, aceita mais duas: `refs` lê um valor derivado de quem empresta como um dos valores do conjunto que pega emprestado (`"refs": { "prof_martial_weapons": { "field": "martial_weapons" }, "armor_speed_strength": { "abilityScore": "str" } }`), e `slots` coloca o espaço de um item sob o nome usado pelo conjunto que pega emprestado (`"slots": { "body": "armor" }`). Um catálogo não pode pegar emprestado do próprio conjunto nem de um catálogo que, por sua vez, também pega emprestado. A arte de uma criatura emprestada é encontrada como a de quem empresta (`5e-2014/creatures/<id>` num pacote de criaturas). Referências dentro de um catálogo emprestado, como as magias de uma criatura, são verificadas quando o catálogo é lido, não quando o conjunto é.

**Listas de avanço mais longas (Capability API 1.219).** `sheet.advancement.fields` aceita até 64 campos (eram 24), então um jogo em que um nível aumenta muitos campos, como os espaços de cada nível de magia e as listas de proficiência, pode deixar o GM aumentar todos eles. Uma lista com mais de 24 campos exige 1.219.

**Compras nos dois sentidos, possuídas e trocadas (Capability API 1.164).** `"direction": "both"` permite que uma oferta aumente e diminua a pontuação a partir de onde ela começa (sua `baseline`, quando declarada, precisa coincidir com a ficha): cada passo para cima custa o preço da curva, e cada passo para baixo além do início o devolve como crédito, limitado pelo `creditLimit` e pelos limites da reserva. O registro de compras só corre num sentido de cada vez, então reduzir uma pontuação que foi comprada desfaz a última compra pelo preço pago, e aumentar uma reduzida devolve o crédito dela; comprar e reduzir nunca gera crédito. Um alvo assim tem uma única oferta em todo o construtor. O ST de GURPS é `{ "target": { "ability": "st" }, "direction": "both", "baseline": 10, "min": 7, "max": 14,
"cost": { "flat": 10 } }`; um custo em tabela dá preço a passos fracionários, como Basic Speed. `"direction": "increase"` e `"decrease"` nomeiam diretamente uma oferta de um só sentido (`"decrease"` é a redução acima, com sua base e seu crédito).

`"effect": "ownership"` dá preço a uma oferta na própria escala, a partir da sua `baseline` (ou de `min`) para cima, e a ficha mantém o maior entre o próprio valor e o nível comprado: uma familiaridade de um ponto de GURPS é paga e listada mesmo quando um valor padrão já é melhor, e reembolsá-la não custa nada à ficha.

`"exchange": { "from": <rating>, "units": 2, "gain": 1, "floor": 9 }` faz de uma oferta uma troca fechada de criação: cada compra reduz `from` em `units` e aumenta o alvo em `gain` (padrão 1), nunca levando `from` abaixo de `floor` nem o alvo além de `max`. Ela não custa nada à reserva, então omite `cost`. Pontos trocados nunca são trocados de novo: depois que uma troca aumentou uma pontuação, nenhuma outra troca a reduz, e depois que uma reduziu uma pontuação, nenhuma outra troca a aumenta. Trocas que uma classe não pode fazer (`when`) podem nomear as mesmas pontuações no sentido inverso. Um reembolso devolve as duas pontuações. A troca de requisito principal de OSE é uma oferta por valor reduzido:

```json
{
  "id": "wis_to_int",
  "label": "Lower Wisdom to raise Intelligence",
  "target": { "ability": "int" },
  "exchange": { "from": { "ability": "wis" }, "units": 2, "floor": 9 },
  "min": 3,
  "max": 18
}
```

O construtor guarda os deltas pagos com sinal e seus preços originais sob IDs estáveis de etapa e oferta, com no máximo 1.000 linhas de compra por oferta. O reembolso remove a linha mais recente e desfaz exatamente a contribuição dela e o preço registrado, inclusive removendo um crédito. Ele nunca reembolsa uma pontuação gratuita. Nenhum XP vivo, inventário, moeda ou recurso do grupo é gasto.

Mudar de carreira, de concessões gratuitas ou de fontes de orçamento mantém o registro de compras. Compras inválidas ficam inativas; a reserva mostra o gasto original, pontos restantes negativos quando gastou demais e o novo preço proposto. Alvos compartilhados também suspendem compras dependentes em outras reservas. **Reprice saved purchases** (reajustar o preço das compras salvas) aceita explicitamente um novo preço válido para a reserva; caso contrário, reembolse linhas para corrigi-la. Nenhuma compra é excluída ou vendida em silêncio. Pontos não gastos são só informativos. Back/Next continuam disponíveis, e **All fields** preserva substituições manuais visíveis dentro dos limites do esquema. Descrever um personagem existente e reabrir escolhas salvas nunca concede bolinhas de novo.

**Linhas nomeadas (Capability API 1.154).** Uma etapa `rows` permite ao jogador acrescentar, editar e remover as próprias linhas numa das listas da ficha durante a construção: servidores, contatos, rituais e seus ingredientes, ou qualquer outra coisa que um catálogo não lista.

```json
{
  "id": "retainers",
  "label": "Retainers",
  "kind": "rows",
  "list": "retainers",
  "columns": ["name", "role", "loyalty"],
  "required": ["name"],
  "min": 1,
  "max": 4,
  "defaults": { "role": "Hireling" }
}
```

`columns` é o subconjunto das colunas da lista que a etapa edita (todas, quando omitido). `required` nomeia as colunas que uma linha precisa preencher para contar. O selo conta as linhas inteiras que ainda faltam abaixo de `min` (de 0 a 20), mais toda linha com uma célula obrigatória vazia, então um ingrediente escrito pela metade continua pendente. `max` bloqueia **Add a row** (acrescentar uma linha) e nunca passa do `maxItems` da lista. Uma linha nova parte dos padrões das próprias colunas, depois de `defaults`, que precisa caber em cada coluna.

A etapa edita a lista onde cada linha está, então dois servidores com o mesmo nome continuam sendo duas linhas, e remover um mantém o outro. Linhas que uma escolha de catálogo escreveu aparecem somente leitura com a nota "Added by a pick" e vêm e vão com a escolha. **All fields** edita todas as linhas como antes.

Uma etapa de linhas pode dizer quantas linhas quer com `countFrom` (Capability API 1.799), um valor lido da ficha: as rolagens de pontos de vida de 5e, uma por nível depois do 1º. Quando a etapa é mostrada, o construtor acrescenta linhas, cada uma como **Add a row** (acrescentar uma linha) a cria, até que as próprias linhas do jogador alcancem essa quantidade, sem nunca passar de `max` nem do `maxItems` da lista; ele nunca remove uma linha, e uma linha removida ali continua removida até que a etapa seja mostrada de novo. Um personagem que está sendo descrito não recebe linhas quando a etapa é consultada. A etapa então espera por essa quantidade de linhas inteiras como faz com `min`, o maior dos dois quando ambos são fornecidos, e mostra a mesma contagem "N of M". Um conjunto de regras que use isso exige Capability API 1.799.

```json
{
  "id": "hit_point_rolls",
  "label": "Hit point rolls",
  "kind": "rows",
  "list": "hp_rolls",
  "required": ["die", "roll"],
  "countFrom": { "derived": "hp_rolls_due" }
}
```

**Ofertas condicionais, limites lidos da ficha e regras de criação (Capability API 1.155).** Uma oferta de gasto também pode ter:

- `when: Ref`: só é oferecida enquanto ler acima de 0 na ficha antes das compras, como as perícias próprias de uma ocupação ou um Background que uma tribo pode ter. Uma oferta nunca comprada deixa a reserva como está; compras salvas numa oferta que o personagem não pode mais ter continuam, inativas, para correção.
- `minFrom: Ref` e `maxFrom: Ref`: um piso e um teto lidos da ficha, mantidos dentro de `min` e `max`. Credit Rating recebe a faixa da sua ocupação; Dodge para em DEX. Uma pontuação abaixo do piso é comprada até ele numa única compra.
- `allowedRatings: number[]`: as únicas pontuações em que uma compra pode terminar, como um Merit vendido com 1, 3 ou 5 bolinhas. Cada compra vai direto para a próxima pontuação permitida pelo preço da curva.

Assim como orçamentos e substituições, eles não podem ler um alvo comprado. Uma escolha de treinamento com `onDuplicate: "replace"` pode nomear `replacementFrom`, as perícias (ou salvaguardas) por que uma duplicata pode ser trocada, no lugar de todas as que a ficha tem; isso vale para o que é mostrado, salvo e aplicado.

`sheet.builder.constraints` comporta até 40 regras de criação. Cada uma nomeia a `step` cujo selo a leva e o `label` mostrado ali enquanto ela falha, um `when: Ref` opcional e exatamente um destes:

- `value: Ref` com `min` e/ou `max` (cada um, um número ou uma Ref).
- `rows: { list, filter?, sum? }` com `min` e/ou `max`: a contagem das linhas da lista, ou o total da coluna numérica `sum`, nas linhas que `filter` mantém (`{ column, equals?, below?, above? }`).
- `distinct: { list, column }`: nenhuma linha compartilha com outra um valor preenchido (ignorando maiúsculas e espaços).
- `approved: fieldId`: um campo booleano que precisa estar ativado, como a aprovação de um Storyteller.

```json
{
  "constraints": [
    {
      "id": "disadvantage_cap",
      "label": "Disadvantages give at most 50 points.",
      "step": "traits",
      "rows": { "list": "traits", "filter": { "column": "cost", "below": 0 }, "sum": "cost" },
      "min": -50
    }
  ]
}
```

Uma regra que falha nunca bloqueia Back, Next nem **All fields**.

**Valores calculados e efeitos aplicados a uma rolagem (Capability API 1.156).** Um atributo pode ter `value: Ref[]` (de 1 a 8): seu valor é a soma deles, mantida entre seus `min` e `max`, e aparece somente leitura. Um atributo de Blades é a soma das suas ações marcadas; a Perception de GURPS é `[{ "abilityScore": "iq" }, { "field": "perception_bought" }]`, e as perícias que rolam com ela acompanham o que foi comprado. Valores derivados, tetos e perícias podem ler um valor calculado, mas nenhum valor calculado pode ler outro, nem por meio de um valor derivado. O construtor nunca define um, e qualquer coisa guardada para ele é ignorada.

Uma lista pode declarar `contextual` para que suas linhas se apliquem a uma rolagem quando o Game Master as nomeia:

```json
{
  "id": "stunts",
  "label": "Stunts",
  "maxItems": 10,
  "columns": [
    { "id": "name", "label": "Name", "type": "text", "maxLength": 80 },
    { "id": "skill", "label": "Skill", "type": "text", "maxLength": 40 },
    { "id": "bonus", "label": "Bonus", "type": "number", "min": -5, "max": 5, "default": 2 }
  ],
  "contextual": { "name": "name", "skill": "skill", "bonus": "bonus" }
}
```

`name` é a coluna pela qual o Game Master nomeia uma linha. `skill` (opcional) contém a perícia a que uma linha se aplica, pelo ID ou pelo rótulo; uma célula vazia se aplica a qualquer teste. `bonus` (uma coluna numérica) e `dice` (uma coluna de dados) somam ao teste, como dados num conjunto de reserva. `to: "saves"` aplica as linhas a salvaguardas no lugar. Num conjunto de reserva, `check: { dice?, successes?, double?, explode? }` dá a toda linha aplicada o mesmo efeito na reserva, como uma especialidade cujos 10 explodem.

Uma entrada de catálogo pode ter `mechanics.contextual` com `effects` (`own-checks-advantage` e os outros efeitos de teste e de salvaguarda), `modifiers` em `checks` ou `saves`, `skills` e `saves` que os restringem, um efeito `check` de reserva e `cost: [{ "pool": "...", "amount": 1 }]`, pago uma vez na rolagem em que é aplicado. O Game Master escreve `apply="Strong Back; Quick Eye"` (até quatro nomes) num teste. Só os nomes que se aplicam a esse teste o mudam: uma linha de outra perícia, um nome que duas linhas compartilham e um custo que a reserva não cobre não mudam nada. Ter uma linha nunca muda uma rolagem por si só. O registro lista o que foi aplicado em `from`.

**Moedas iniciais roladas e lidas da ficha (Capability API 1.157).** Uma linha de moedas do equipamento inicial pode ter `roll` (dados como `"2d6"`) ou `countFrom` (uma Ref lida da ficha de quem a recebe) no lugar de `count`, nunca os dois, e `times` (de 1 a 10000) multiplica qualquer um deles:

```json
{ "coins": "gold", "roll": "5d4", "times": 10 }
```

O seletor mostra os dados ("5d4 gold, rolled when taken"). A rolagem acontece uma vez, quando o grupo ou quem recebe pega o pacote, então reabrir o seletor não pode rolá-la de novo. `countFrom` lê a ficha de quem recebe, como um campo de Credit Rating; quem recebe sem ficha é recusado, e uma quantidade 0 não acrescenta nada. As linhas de itens mantêm seu `count` fixo.

**Valores iniciais definidos uma vez (Capability API 1.158).** Uma etapa do construtor com `kind: "initialize"` escreve valores iniciais quando o jogador os confirma, e nunca mais por conta própria:

```json
{
  "id": "start",
  "label": "Starting values",
  "kind": "initialize",
  "writes": [
    { "field": "san_start", "value": { "abilityScore": "pow" } },
    { "field": "xp", "remaining": "creation" }
  ]
}
```

Cada escrita nomeia um campo da ficha e um `value` (um valor fixo, ou uma Ref para um campo numérico) ou `remaining`, o que uma reserva do construtor deixou sem gastar. A etapa mostra cada campo agora e o valor que ele vai receber; o selo dela espera até o jogador defini-los. Os valores escritos são salvos com o construtor, então reabri-lo, importar o personagem ou mudar POW depois nunca os escreve de novo. Quando a ficha mudou desde então, a etapa mostra o que definir de novo substituiria, e só o **Set again** (definir de novo) do jogador faz isso. Um personagem que está sendo descrito como já é nunca recebe escritas.

Uma reserva viva pode declarar `startFrom: Ref` para começar num valor lido da ficha em vez de cheia ou vazia, mantido entre 0 e o máximo dela, e uma trilha comum pode declarar `startFrom` no lugar de `default`. Apontada para um campo que uma etapa de inicialização escreveu, SAN começa no POW a partir do qual foi definida e fica onde a partida a deixar: um valor vivo guardado sempre prevalece sobre onde a reserva começa.

**Escolhas e linhas com preço (Capability API 1.159).** Uma etapa de catálogo ou uma etapa de linhas pode nomear uma `pool` do construtor e um `cost`, para que o que o jogador escolhe ou escreve seja pago com a mesma reserva das etapas de gasto. O custo de uma etapa de catálogo é um número ou `{ "filter": "tier" }`, o filtro numérico da própria entrada. O custo de uma etapa de linhas é um número ou `{ "column": "cost" }`, lido de cada linha; um preço negativo é um crédito, limitado pelo `creditLimit` da reserva, então um defeito financia traços. Uma etapa de linhas também pode nomear `from`, um catálogo de linhas que alimenta a lista dela: o jogador acrescenta uma cópia da linha de uma entrada quantas vezes quiser, e cada cópia é uma linha dele, com preço e remoção próprios:

```json
{
  "id": "charms",
  "label": "Charms",
  "kind": "rows",
  "list": "charms",
  "pool": "bonus",
  "cost": { "column": "cost" },
  "from": "charm_book"
}
```

Uma escolha que a reserva não pode pagar não é oferecida. Escolhas e linhas com preço são pagas primeiro e nunca são vendidas pelo jogador: quando retirar um defeito faz a reserva gastar demais, as compras das etapas de gasto deixam de se aplicar até o jogador corrigir isso, e o selo de cada etapa com preço conta a correção. Um total que uma coluna não pode passar (níveis de Rite) é uma regra de criação (1.155) com `rows.sum` e `max`.

**Perfis de criação e fases anteriores (Capability API 1.160).** `sheet.builder.profiles` (até 16) permite que um tipo de personagem, uma carreira ou um pacote traga as próprias etapas e orçamentos:

```json
"profiles": [
  { "id": "dragon", "label": "Dragon-Blooded", "when": { "field": "dragon" },
    "steps": ["aspect_gifts"], "budgets": { "bonus": { "const": 15 } } },
  { "id": "lunar", "label": "Lunar", "when": { "field": "lunar" },
    "steps": ["moon_gifts"], "budgets": { "bonus": { "const": 18 } } }
]
```

O primeiro perfil cujo `when` lê acima de 0 é o do personagem, e o construtor diz qual é. Uma etapa que algum perfil lista só aparece enquanto um perfil que a lista for o do personagem; as respostas dela ficam guardadas enquanto ela está oculta e não concedem nada. Os `budgets` de um perfil substituem os orçamentos próprios dessas reservas, então trocar de tipo nunca mantém o orçamento do outro tipo: compras que ele não cobre mais deixam de se aplicar até o jogador corrigi-las.

Uma etapa de catálogo ou de inicialização pode declarar `reads: { "before": "step_id" }`. O `offeredWhen` das entradas dela e seu `upTo` (ou os valores da etapa de inicialização) passam a ler a ficha como as etapas anteriores a essa etapa a deixam: tudo o que etapas posteriores escolheram, concederam ou compraram é retirado, e o que o jogador digitou é mantido. Uma etapa de multiclasse lê os valores de atributo de antes do aumento deste nível; um instantâneo de Humanity lê as Virtudes de antes dos freebies, por mais que o jogador tenha ido e voltado entre as etapas.

**Linhas que são testes por si mesmas (Capability API 1.161).** Uma lista pode declarar até quatro `checks`, para que cada linha que o jogador escreve seja um teste que o Game Master pode pedir pelo nome:

```json
"checks": [{ "id": "science", "name": "name", "rating": "rating", "ability": "edu" }]
```

`name` é a coluna de texto pela qual uma linha é chamada, e `rating`, a coluna numérica que é a pontuação dela; `ability` (opcional) é somado como o atributo de uma perícia. Science (Physics) e Science (Biology) são duas linhas e dois testes, cada um com a própria pontuação. Dois testes numa mesma lista são duas posturas apoiadas numa só pontuação, cada uma com um `label` que o Game Master diz depois do nome da linha: "Fire stew (bold)" e "Fire stew (careful)". As perícias, as salvaguardas e os atributos próprios da ficha são comparados primeiro. Um nome que duas linhas compartilham não é teste nenhum até que uma seja renomeada, e o teste de uma linha excluída some com ela. O bloco de ficha do Game Master lista todo teste de linha com o seu número, e `with=` funciona como numa perícia. Uma etapa de linhas com preço pela coluna de pontuação (1.159) compra as pontuações com a reserva de criação.

**Rolagens de criação mantidas com seus dados (Capability API 1.162).** Os dados de criação são `{ "count", "sides", "keep"?, "add"?, "multiplier"? }`: as `keep` faces maiores, mais `add`, vezes `multiplier`, então o `(2d6+6) x 5` de CoC é `{ "count": 2, "sides": 6, "add": 6, "multiplier": 5 }`.

O `methods.rolls` de uma etapa de atributos rola todos os valores em ordem, cada um com os dados do próprio grupo, e nunca deixa uma rolagem passar para outro atributo (método `"rolls"`):

```json
"rolls": [
  { "abilities": ["str", "con", "dex", "app", "pow"], "dice": { "count": 3, "sides": 6, "multiplier": 5 } },
  { "abilities": ["siz", "int", "edu"], "dice": { "count": 2, "sides": 6, "add": 6, "multiplier": 5 } }
]
```

Uma etapa de `kind: "roll"` lista até 12 `rolls`, cada uma escrita num `field` numérico: Luck, pontos de vida, dinheiro inicial. `best` (2 ou 3) rola essa quantidade de vezes e mantém a melhor; `floor` (um número ou uma Ref) é o menor valor que o resultado pode ter, como 1 ponto de vida ou um potencial nunca abaixo da sua estatística; `gain` a transforma num teste de melhoria, rolado contra o campo e somando `gain` só quando a rolagem fica acima dele, como faz a melhoria de EDU de CoC. Toda rolagem é mantida com as faces e mostrada com elas. Uma rolagem já feita vale; reabrir o construtor nunca rola de novo, e só uma etapa com `retry: true` oferece isso. Um personagem que está sendo descrito nunca recebe rolagens.

**Escolhas contadas e restrições de criação (Capability API 1.151).** Toda etapa pode ter `when: Ref` (mostrá-la e aplicá-la só enquanto o valor não vivo da ficha estiver acima de zero) e `requiredWhen: Ref` (contar escolhas pendentes no selo dela só enquanto estiver acima de zero). Etapas ocultas mantêm as respostas salvas. Next e Back continuam disponíveis mesmo com escolhas incompletas ou inválidas; All fields continua sendo a edição livre.

Etapas de catálogo podem declarar até 12 `quotas`, cada uma usando um dos filtros tipados do catálogo:

```json
{
  "id": "ratings",
  "label": "Skill ratings",
  "kind": "catalog",
  "catalog": "ratings",
  "min": 10,
  "max": 10,
  "distinctBy": "skill",
  "quotas": [
    { "filter": "rating", "value": 4, "min": 1, "max": 1 },
    { "filter": "rating", "value": 3, "min": 2, "max": 2 },
    { "filter": "rating", "value": 2, "min": 3, "max": 3 },
    { "filter": "rating", "value": 1, "min": 4, "max": 4 }
  ]
}
```

Isso é uma pirâmide no estilo de Fate quando o catálogo oferece cada perícia em cada pontuação. As entradas declaram suas concessões de treinamento com IDs de nível de proficiência explícitos; valores numéricos de filtro nunca inventam um mapeamento de níveis. Uma cota tem `0 <= min <= max <=` o máximo da etapa. Os mínimos afetam o selo; os máximos desativam novas escolhas que correspondam. `distinctBy` nomeia um filtro existente: as escolhas não podem compartilhar o valor dele (nem qualquer tag, num filtro de tags), e uma entrada sem esse filtro não pode contar. Caso contrário, a distinção é pelo ID da entrada. `quotaBelow: { "filter": "tier" }` exige estritamente mais escolhas ativas no nível n−1 do que no nível n, para níveis inteiros positivos acima de 1. O nível 1 é a base. Remover uma escolha de apoio deixa inativas as escolhas superiores em excesso, retirando suas concessões e mantendo suas respostas para correção.

Os espaços de `abilities.choose`, `trained.choose`, `choose` da etapa de treinamento e `entries.choose` aceitam:

- `id`: um ID estável da ficha. Espaços novos devem usá-lo; assim, as respostas salvas sobrevivem a uma reordenação. Espaços antigos sem ID mantêm suas chaves por posição. Os IDs são únicos entre todas as escolhas oferecidas por uma etapa de origem.
- `countFrom: Ref`, com um `max` explícito (de 1 a 20, no máximo 6 para atributos). `count` continua sendo a contagem fixa quando `countFrom` está ausente. Uma contagem dinâmica é arredondada para baixo e limitada entre zero e `max`. Ela lê operadores derivados existentes, nunca expressões executáveis.
- `excludeChoices: ["background/restricted"]`: IDs de escolhas anteriores do mesmo tipo, escritos como `source_step/choice_id`. Eles excluem as respostas ativas da escolha anterior, inclusive substituições. As referências precisam ser verificáveis na definição ou no mesmo arquivo de catálogo. Escolhas de concessão anteriores incluídas no arquivo ou etapas de treinamento explícitas podem, portanto, alimentar um arquivo de catálogo posterior; referências a outro arquivo de catálogo externo são recusadas. Os IDs de escolha entre entradas alternativas de uma mesma etapa também precisam ser únicos.

As escolhas de atributo também aceitam `from`, cruzado com os atributos da ficha e com `except`. Para boosts distintos de PF2e, uma escolha `restricted` pode oferecer `["str", "dex"]`, seguida de uma escolha `free_boost` que exclui `background/restricted`. As escolhas de entrada aceitam as mesmas `quotas`, `distinctBy` e `quotaBelow` das etapas de catálogo, limitadas por `max` ou `count`; elas continuam escrevendo linhas sem aplicar as concessões das próprias entradas escolhidas.

As escolhas de treinamento também aceitam `tier` (um nível oferecido acima de sem treinamento, que substitui o nível da concessão ou do construtor), `only: "any" | "trained" | "untrained"` e `onDuplicate: "replace"`. A elegibilidade lê o treinamento manual e as concessões ativas anteriores, excluindo as escritas anteriores do próprio construtor. Uma perícia escolhida que essas fontes já treinam abre um espaço separado de substituição entre as perícias sem treinamento do mesmo tipo, mantendo a resposta original. As substituições respeitam as exclusões e o nível da escolha. A chave salva delas é a chave do espaço original mais `/replacement`. As graduações fora da carreira de um Human podem excluir uma escolha de carreira anterior e usar `only: "untrained"`; mudar de carreira mantém as respostas posteriores inválidas.

Condições e novas contagens de espaços só podem ler valores mudados por etapas anteriores, o que impede concessões que se habilitam sozinhas ou cíclicas. Uma contagem de espaços não pode ler valores da ficha quando um arquivo de catálogo externo posterior poderia mudá-los; mova a etapa de origem dela para antes ou mantenha esse catálogo incluído no arquivo. Uma condição pode usar um `enumTable` derivado existente para tornar uma etapa de sub-raça obrigatória para uma única ancestralidade. `requiredWhen` só afeta os selos e pode ler qualquer valor não vivo válido. Novas escolhas restritas continuam pendentes quando falta conteúdo elegível, com uma explicação "not configured". Elas nunca reduzem em silêncio a contagem exigida ao conteúdo disponível. As edições manuais da ficha e os personagens descritos mantêm as regras de propriedade existentes do construtor.

Um personagem feito sem o construtor (uma ficha que não está em branco e ainda não tem escolhas do construtor) abre **descrito**: as escolhas registram o que o personagem já é (os aumentos da raça dele são considerados já incluídos nos valores) e não mudam nada na ficha, até o jogador escolher **Done: let picks change the sheet** (concluído: deixar as escolhas mudarem a ficha). A partir daí, mudar uma escolha retira o que a descrita deu.

Sem `tier`, o treinamento vai para o primeiro nível acima de sem treinamento que a ficha oferece; uma ficha que oferece um meio nível (como as perícias de 5e) define `"tier": "proficient"`.
