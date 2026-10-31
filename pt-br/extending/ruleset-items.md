# Itens de conjuntos de regras

Esta página faz parte de [Escrever conjuntos de regras de Game Mode](writing-rulesets.md). O que um grupo carrega: categorias, armas, armaduras, munição, saque, dinheiro, equipamento inicial e mercados.

Armaduras, armas, poções, equipamentos, munição e dinheiro são itens. Um bloco opcional `items` declara o vocabulário em que todo item do seu conjunto é escrito, e um catálogo com `holds: "items"` lista os próprios itens. Ambos exigem Capability API 1.49; `rarityCaps` e `propose` do bloco, que regem os itens que o Game Master inventa, exigem 1.51; um valor que lê os itens de um personagem (`itemStat`) exige 1.52; o que um item faz com os testes enquanto vestido ou carregado, com os tetos de `bonus` do bloco, exige 1.53; o que um item exige de quem o veste e os atributos que ele altera exigem 1.54; o `attack` de uma arma exige 1.55; o que um item faz numa luta exige 1.56; o que uma arma dispara e mantém carregado exige 1.57; os modos de uma arma, o ataque com a mão inábil, o piso e as condições num acerto exigem 1.58; o que usar um item faz numa luta, com as cargas que ele contém, exige 1.59; um uso que restaura uma reserva exige 1.60; cargas recuperadas num descanso ou um item que quebra ao se esvaziar exigem 1.61; um uso que pede um teste antes (`gate`) exige 1.62; tabelas de loot e o loot de uma criatura exigem 1.63; uma linha de loot que deixa cair moedas ou uma camada que retira moedas exige 1.64; um mercado, o lugar `sold` de um item e um `service` exigem 1.65; um dia de mercado (um caixa, `buyBack`, o `stock` de um vendedor, uma contagem `limited` ou um `sold` que não nomeia lugar) exige 1.69; um efeito adicional que dispara com armas empunhadas (`weapons`) exige 1.70; o equipamento inicial (`startingGear`) exige 1.78; um item arriscado, uma falsificação ou um vendedor desonesto exige 1.79; e o `unsold` de um mercado (ou os `items` de uma camada) exige 1.813.

## O bloco de itens

O bloco fica em `items`, no nível superior do arquivo. Este é o de Ember Roads, um pouco resumido:

```json
"items": {
  "categories": [
    { "id": "weapon", "label": "Weapon" },
    { "id": "armor", "label": "Armor" },
    { "id": "ammunition", "label": "Ammunition" }
  ],
  "rarities": [
    { "id": "common", "label": "Common" },
    { "id": "storied", "label": "Storied" }
  ],
  "tags": [
    { "id": "thrown", "label": "Thrown" },
    { "id": "ranged", "label": "Ranged" },
    { "id": "two_handed", "label": "Two-handed" },
    { "id": "arrow", "label": "Arrow" }
  ],
  "stats": [
    { "id": "bulk", "label": "Bulk", "type": "number", "min": 0, "max": 10, "default": 0 },
    { "id": "guard", "label": "Guard", "type": "number", "min": 0, "max": 4, "default": 0 },
    { "id": "damage", "label": "Damage", "type": "dice", "example": "1d6" },
    { "id": "swing", "label": "Rolls with", "type": "enum", "values": ["brawn", "wits", "heart"], "default": "brawn" },
    { "id": "reach", "label": "Reach", "type": "enum", "values": ["close", "near", "far"], "default": "close" }
  ],
  "slots": [
    { "id": "body", "label": "Body", "count": 1 },
    { "id": "hands", "label": "Hands", "count": 2 }
  ],
  "carry": { "stat": "bulk", "encumberedAbove": { "derived": "load" }, "limit": { "const": 12 } },
  "rarityCaps": [
    { "rarity": "common", "stats": { "guard": 1 }, "bonus": 1 },
    { "rarity": "storied", "stats": { "guard": 3 }, "bonus": 2 }
  ],
  "currencies": [
    {
      "id": "coin",
      "label": "Coin",
      "perWeight": 100,
      "units": [
        { "id": "bit", "label": "bits", "value": 1 },
        { "id": "mark", "label": "marks", "value": 10 },
        { "id": "sovereign", "label": "sovereigns", "value": 100 }
      ]
    },
    {
      "id": "salt",
      "label": "Salt",
      "perWeight": 10,
      "units": [
        { "id": "pinch", "label": "pinches", "value": 1 },
        { "id": "cake", "label": "cakes", "value": 20 }
      ]
    }
  ]
}
```

- `categories`: de uma a 24. Todo item tem exatamente uma, como armadura, arma ou poção.
- `rarities`: opcional, até 12. Liste-as da mais comum à mais rara.
- `tags`: opcional, até 48. Propriedades que um item pode ter, como arremessável ou prateado.
- `stats`: opcional, até 24. Os números e palavras que um item carrega, declarados exatamente como uma coluna de lista: `number`, `text`, `boolean`, `enum` ou `dice`, com faixa, valores e padrão quando o tipo os tem. `promptVisible` (padrão `true`) diz se o Game Master vê a estatística ao lado do item. Defina como `false` para algo que só o jogador deve ver, como o lugar onde um item está escondido.
- `slots`: opcional, até 12. Onde um item é vestido ou empunhado, e quantos desse espaço um personagem tem, de 1 a 20.
- `binding`: opcional. Sintonia, investidura ou qualquer outra coisa que limite quantos itens um personagem pode ter vinculados ao mesmo tempo. `label` é como isso se chama, e `max` é um valor lido da ficha do personagem, como `{ "abilityScore": "nerve" }` ou um valor derivado. Não pode ler o estado vivo, porque a quantidade de itens que um personagem pode vincular não muda a cada golpe.
- `carry`: opcional. `stat` nomeia a estatística numérica que é o peso de um item, cujo `min` é 0 ou mais. `encumberedAbove` é quanto um personagem carrega antes de ficar sobrecarregado, e `limit` (opcional), o máximo que ele consegue carregar. Ambos são lidos da ficha como `binding.max`. Sem `carry`, o peso não significa nada e ninguém fica sobrecarregado. `unit` (opcional, até 12 letras, Capability API 1.791) é a unidade em que um peso é contado, como `"lb"`: a carga do inventário, os pesos no seletor de equipamento inicial e o peso de uma opção de kit a mostram depois do número.
- `currencies`: opcional, até seis famílias de uma a dez moedas cada.
  - As moedas de uma família se convertem umas nas outras pelo `value`, que é contado na menor moeda da família. Assim, a menor moeda vale 1, e duas moedas da mesma família nunca valem o mesmo.
  - Duas famílias nunca se convertem uma na outra. A moeda de uma segunda nação, ou os favores de um cenário, formam uma família própria.
  - O ID de uma moeda é único entre todas as famílias, porque o custo de um item nomeia só a moeda.
  - O `label` de uma moeda é o nome dela para qualquer quantidade (`pennies`); `one` (Capability API 1.89) é o nome dela para exatamente uma (`penny`), dito onde quer que um preço, uma bolsa ou um mercado nomeie uma única moeda. Sem ele, o `label` também vale para uma.
  - `perWeight` (opcional, e só ao lado de `carry`) é quantas moedas da família pesam uma unidade da estatística de peso.
  - As moedas são o dinheiro do grupo, levadas nas bolsas como qualquer item (veja Dinheiro, abaixo).
- `rarityCaps`: opcional, no máximo um por raridade. O máximo que um item inventado pelo Game Master pode conceder naquela raridade: o maior valor de cada estatística numérica nomeada em `stats`, dentro da própria faixa da estatística, e um número inteiro para uma estatística que só aceita inteiros, e `bonus` (Capability API 1.53), o maior bônus fixo que um dos seus modificadores de item vestido ou carregado pode adicionar. Numa raridade com `bonus`, um bônus em dados é omitido, já que dados não podem ser limitados a um número; uma penalidade nunca é limitada. Um item inventado fica sujeito a isso; os itens que seus catálogos listam são seus e nunca são limitados.
- `propose`: `true` por padrão. `false` proíbe o Game Master de inventar itens do seu conjunto.
- `native`: `true` por padrão. `false` desativa os itens sem tipo próprios do Game Mode nas partidas do seu conjunto (veja **O que lê os itens**). O Game Master ainda pode inventar itens, escritos no vocabulário do seu conjunto.
- `freeform`: o que vira um item que o jogador digita. `"plain"` (o padrão) o mantém como um item sem regras, como hoje. `"refuse"` permite só itens do seu conjunto.
- `lootTables` (Capability API 1.63): opcional, até 24. O que as criaturas de uma luta vencida e o `[loot:]` do Game Master deixam cair (veja Loot, abaixo).

## Um item

Um catálogo de itens não declara `feeds`:

```json
{ "id": "outfitter", "label": "Outfitter", "holds": "items", "entries": [] }
```

Cada entrada contém um `item` em vez de `rows` ou de uma `creature`:

```json
{
  "id": "hunting-bow",
  "label": "Hunting bow",
  "summary": "Yew, waxed string, and a grip worn smooth by someone else's hand.",
  "item": {
    "category": "weapon",
    "rarity": "common",
    "tags": ["ranged", "two_handed"],
    "stats": { "bulk": 2, "damage": "1d8", "swing": "wits", "reach": "far" },
    "slots": { "hands": 2 },
    "cost": { "amount": 3, "unit": "sovereign" }
  }
}
```

- `id`, `label`, `summary` e `filters` funcionam como em qualquer entrada. O rótulo é o nome do item.
- `category` é obrigatório. `rarity` e `tags` são opcionais, e os três nomeiam IDs do próprio bloco. Um item só pode ter raridade quando o bloco declara alguma.
- `stats`: valores para as estatísticas do bloco. Cada um é um valor que sua estatística poderia conter.
- `slots`: quantos de cada espaço o item ocupa, nunca mais do que um personagem tem.
- `stack`: o máximo que uma pilha contém, de 1 a 999.999. Sem isso, uma pilha contém tanto quanto qualquer pilha do Game Mode. Um item que tem `charges` fica sozinho na pilha.
- `cost`: um `amount` inteiro de uma moeda, nomeada pelo ID em `unit`. O seletor o mostra, e o Game Master o vê ao lado do item (veja Dinheiro, abaixo).
- `sold` (Capability API 1.65): `{ "place": "city" }`, o menor dos lugares do seu mercado que vende o item, acima de qualquer regra que diga o contrário; com 1.69, ele pode, em vez disso ou além disso, dizer quantos um lugar mantém disponíveis num dia (`"limited": 2` ou `"limited": "1d3"`) (veja Mercados, abaixo).
- `service` (Capability API 1.65): `true` para hospedagem, passagem, uma bênção: comprado como um item e nunca carregado. Comprá-lo só paga; nada mais coloca um serviço numa bolsa (adicionar um é recusado como `service`), e o seletor deixa os serviços de fora. Um serviço tem um `cost` e nada relacionado a carregar ou usar (`slots`, `stack`, `binds`, `worn`, `carried`, `requires`, `attack`, `use`, `charges`).
- `binds`: o item precisa ser vinculado antes de fazer qualquer coisa enquanto vestido. `restriction` (opcional) diz em palavras quem pode vinculá-lo, e `cursed: true` marca um item que não se solta. Só um conjunto com `binding` pode ter itens que se vinculam.
- `worn` e `carried` (opcionais, Capability API 1.53): o que o item faz com os testes e as salvaguardas de quem o porta enquanto está vestido e enquanto está só carregado, (1.54) os atributos que ele define ou aumenta e (1.56) o que ele faz numa luta. Veja [Testes fora de uma luta](#checks-outside-a-fight) e [Armaduras e efeitos de itens vestidos numa luta](#armor-and-worn-effects-in-a-fight).
- `requires` (opcional, Capability API 1.54): o que o item exige de quem o veste e o que se aplica enquanto essa pessoa não atende à exigência. Veja [Testes fora de uma luta](#checks-outside-a-fight).
- `attack` (opcional, Capability API 1.55): o que o item faz como arma numa luta, enquanto vestido, (1.57) o que ele dispara e mantém carregado e (1.58) seus outros modos, um ataque com a mão inábil, um piso para o dano e as condições que impõe num acerto. Veja [Armas numa luta](#weapons-in-a-fight), [Munição e recarga](#ammunition-and-reloading) e [Modos, uma segunda arma, um piso e condições num acerto](#modes-a-second-weapon-a-floor-and-conditions-on-a-hit).
- `toggle` (opcional, Capability API 1.170): um botão liga/desliga que o item tem, `{ "label", "budget" }`. Uma luta o oferece como opção nesse orçamento ("Turn on Flame Tongue: Flames"), o inventário como um botão com o rótulo, e a posição em que foi deixado fica na pilha entre uma luta e outra; ele começa desligado. Um item com botão liga/desliga fica sozinho na pilha enquanto está ligado. A cláusula `plus` de uma arma com `when: "toggled"` só é causada enquanto ele está ligado. A flame tongue de 5e: `"toggle": { "label": "Flames", "budget": "bonus" }` e `"plus": [{ "dice": "2d6", "type": "fire", "when": "toggled" }]`.
- `use` e `charges` (opcionais, Capability API 1.59): o que usar o item faz, numa luta e fora dela, as cargas que ele contém para esse uso gastar e (1.60) uma reserva que ele restaura. Veja [Usar itens numa luta](#using-items-in-a-fight) e [Usar itens fora de uma luta](#using-items-outside-a-fight).

Um item não tem `mechanics`: o que ele faz é escrito no seu bloco `item`.

## O que lê os itens

Tudo acima é verificado quando o conjunto é importado, e seus catálogos de itens são distribuídos com ele. Numa partida, o inventário do Game Mode os lê:

- **Seus itens ficam na bolsa.** Uma pilha pode ser um dos seus itens e continua sendo esse item, seja qual for o nome que o jogador lhe der. O botão **From the ruleset** (do conjunto de regras) do inventário abre um seletor com todos os itens que seus catálogos listam, com a busca e os filtros do catálogo, e uma camada que oculta uma entrada também a oculta ali.
- **Nomes encontram seus itens.** Um nome que o jogador digita, ou que o Game Master escreve em `[inventory: action="add"]`, e que seja o `label` de um dos seus itens, com qualquer combinação de maiúsculas e minúsculas, adiciona esse item. Quando dois itens compartilham um rótulo, o nome encontra o que seus catálogos listam primeiro.
- **`stack`** é respeitado: adicionar, definir, juntar ou dar além dele enche a pilha e começa uma nova.
- **`freeform: "refuse"`** deixa ao jogador só os seus itens: o seletor e os nomes que são seus itens.
- **`native: false`** deixa ao Game Master só os seus itens e os que ele inventa: um nome que não é nenhum dos dois é recusado (`not-ruleset-item`), enquanto mais unidades de algo que já está com o grupo ainda podem ser adicionadas, e as instruções dele dizem isso. Uma luta não pergunta mais a um modelo o que os itens do inventário fazem, então só os seus itens lutam: numa luta do conjunto, suas armas empunhadas e os usos dos seus itens (veja Armas numa luta, abaixo), e numa batalha Classic ou Tactical, seus itens com um `use` (veja Itens nas batalhas Classic e Tactical, abaixo). O que o jogador digita continua seguindo `freeform`, e o que o grupo carregava volta numa nova sessão de qualquer forma.
- **O que um item é** aparece na pilha selecionada: sua categoria, raridade e tags pelos rótulos, as estatísticas que concede, seu resumo e quantos uma pilha comporta. O seletor também mostra seu `cost`. O Game Master vê cada um dos seus itens que estão no inventário com categoria, raridade, tags e as estatísticas que você deixou `promptVisible`, como `Hand axe [Weapon, Common, Thrown; Damage 1d6, Reach close]`.

- **`slots`**: um item que ocupa espaços pode ser equipado por quem o carrega, enquanto tiver esses espaços livres, e um item de uma pilha maior é separado numa pilha própria para ser vestido. O inventário mostra cada espaço em uso por personagem.
- **`binding`**: um item com `binds` pode ser vinculado, até `binding.max` lido da própria ficha de quem o porta (um personagem sem ficha lê uma ficha em branco). Um item `cursed`, depois de vinculado, continua vinculado: o jogador não pode desvinculá-lo, tirá-lo, dá-lo nem removê-lo, e só o Game Master pode acabar com a maldição.
- **`carry`**: um item pesa seu valor de `carry.stat` (um item sem ele não pesa nada), e a carga de um personagem é o que sua bolsa pesa, comparada a `encumberedAbove` e `limit` lidos da própria ficha. Um item adicionado à visão compartilhada do inventário, pelo jogador ou pelo Game Master sem `who=`, vai para quem puder carregá-lo sem ficar sobrecarregado (primeiro o jogador, depois o grupo em ordem), dividido pelo espaço que resta a cada um quando ninguém consegue levar tudo. Nada passa do `limit` de ninguém: o que ninguém consegue carregar fica para trás, e o Game Master é avisado. Dê `"integer": false` a uma estatística de peso para pesos como um quarto de libra.
- **O Game Master inventa itens no seu vocabulário.** A menos que você defina `propose: false`, o `[inventory: action="add"]` dele pode descrever um item novo: `like=` um dos seus itens como ponto de partida e então qualquer um entre `category=`, `rarity=`, `tags=`, `stats=` (pares `id=value`), `slots=` (`id=count`), `binds=` (`yes`, `cursed` ou `no`), `worn=` e `carried=` (mudanças separadas por `;`, cada uma `+N`, `-N`, `advantage`, `disadvantage` ou `fails` para salvaguardas, em perícias ou salvaguardas pelo nome, ou em `checks` ou `saves` para todas elas, `+N` ou `-N` no nome de um atributo para aumentá-lo ou diminuí-lo e, onde há lutas, `+N`, `-N`, vantagem ou desvantagem em ataques e `+N` ou `-N` na defesa ou na sua palavra para ela: `worn="+1 Sneak; disadvantage on Sway checks"`, `carried="+1 Brawn"`, `worn="+1 Guard"` ou `none`) e `summary=`, cada parte pelo ID ou rótulo. Uma estatística de item que sua defesa já conta (o Guard de Ember Roads soma o `guard` do que está vestido) é a forma como uma armadura a aumenta; por isso, uma mudança vestida na defesa ao lado dessa estatística é omitida, e a resposta diz isso: um modelo pequeno escreve `guard=1` e `+1 Guard` para um único +1. Ele também lê o que um modelo pequeno costuma escrever no lugar: um número depois do nome (`Brawn +1`), "bonus" depois de ataques ou defesa (`+1 attack roll bonus`), `none` para uma lista vazia de tags, estatísticas ou espaços, e `worn=`, `carried=` ou `summary=` dentro de `stats=` quando você não tem estatística com esse nome. O Engine mantém só o que seu bloco tem: uma categoria, tag, estatística, espaço, perícia ou salvaguarda desconhecida é omitida, uma raridade que você não tem vira a mais baixa, um número é limitado à faixa da sua estatística e depois a `rarityCaps` para sua raridade, um bônus vestido ou carregado ao `bonus` da sua raridade (inclusive a parte herdada de `like`), e um nome que é um dos seus itens é simplesmente esse item. A resposta informa ao Game Master o que foi alterado (nunca sobre uma estatística que você não mostra a ele), e os detalhes do item mostram cada alteração ao jogador. A partida guarda o item, então o mesmo nome é esse item pelo resto da partida, e uma nova sessão o mantém enquanto alguém ainda o tiver.
- O Game Master pode usar `equip` e `unequip` nos seus itens com o comando de inventário quando você tem `slots`, e `bind` e `unbind` quando tem `binding`: ele só aprende as ações que seu conjunto tem. Ele vê a carga de cada personagem, os itens vinculados e os espaços, e o que está vestido ou vinculado.

- **O que um item faz enquanto vestido ou carregado** aparece na pilha selecionada e no seletor ("While worn: -1 on checks (Sneak)"), e o Game Master o vê ao lado do item (`worn: -1 on checks (Sneak)`). Os testes fora de uma luta o aplicam (veja Testes fora de uma luta, abaixo).
- **O que uma arma faz** aparece da mesma forma ("Attack (Action): Brawn to hit, 1d6 + Brawn cut damage"), e uma luta a oferece enquanto ela está empunhada (veja Armas numa luta, abaixo).
- **O que usar um item faz** aparece da mesma forma ("Use (Action): heals 1d4 + 1, range 0 paces, used up"), com as cargas que lhe restam. Uma luta oferece o uso, assim como o botão **Use** (usar) do inventário e o `[inventory: action="use"]` do Game Master (veja Usar itens numa luta e Usar itens fora de uma luta, abaixo).

Numa batalha Classic ou Tactical, cada um dos seus itens com um `use` faz ali o que diz, e um item sem ele não é oferecido (veja Itens nas batalhas Classic e Tactical, abaixo). Seja o que for que `native` diga, a ficha pode ler seus itens (abaixo), uma arma empunhada é um ataque numa luta do conjunto, disparando o que tira da bolsa, o que um item faz enquanto vestido ou carregado conta nessa luta (veja Armaduras e efeitos de itens vestidos numa luta, abaixo), um item com um `use` é usado pelas próprias regras, numa luta e fora dela (veja Usar itens numa luta e Usar itens fora de uma luta, abaixo), e suas `currencies` são o dinheiro do grupo (veja Dinheiro, abaixo).

<a id="items-on-the-sheet"></a>

## Itens na ficha

Uma referência de valor pode ler os itens que um personagem tem, com `itemStat` (Capability API 1.52). Ember Roads soma ao Guard de um viajante o guard da armadura que ele veste, que é o que um golpe precisa superar:

```json
{
  "id": "guard",
  "label": "Guard",
  "op": "sum",
  "of": [{ "const": 6 }, { "abilityMod": "wits" }, { "itemStat": { "stat": "guard", "from": "worn", "pick": "sum" } }]
}
```

- `from`: `"worn"` são os itens no personagem: um item que ocupa espaços enquanto está equipado, um que tem `binds` enquanto está vinculado e um que faz as duas coisas enquanto as duas valem. Um item que não faz nenhuma das duas nunca está vestido. `"carried"` é o restante do que ele leva, e `"all"` são os dois.
- `pick`: `"sum"` soma o valor de cada item vezes a quantidade, `"max"` e `"min"` leem o maior ou o menor valor individual, e `"count"` conta os itens, pela quantidade.
- `stat` nomeia uma das suas estatísticas de item. `sum`, `max` e `min` exigem uma estatística `number`. `count` pode omiti-la para contar todos os itens, ou nomear qualquer estatística para contar só os itens que a concedem.
- `slot`, `category` e `tag` (cada um opcional) mantêm só os itens que ocupam esse espaço, são dessa categoria ou têm essa tag.
- `default` (opcional, 0 quando omitido) é o que ele lê quando nenhum item é escolhido ou nenhum deles concede a estatística.

Os itens mudam durante a partida, então `itemStat` segue a mesma regra de uma leitura viva: o `max` de uma reserva ou de uma trilha, o bônus de proficiência, `binding.max`, os números de `carry` e a coluna escalada ou a escala de um catálogo não podem lê-lo, nem por meio de um valor derivado. Em qualquer outro lugar onde um número é lido, ele pode: um valor derivado, o `adjust` de um teste, o `cap` de uma perícia, a defesa, a absorção ou a iniciativa de uma luta.

Os itens de um personagem são os da própria bolsa. O card do jogador (o nomeado como quem o chat interpreta ou, se não houver, o primeiro) lê a bolsa do jogador, e cada outro card lê a sua. Só os itens do seu conjunto contam, já que um item comum não tem estatísticas para ler. A ficha na tela, um teste, o bloco de ficha do GM e uma luta, quando começa, leem o que cada personagem tem naquele momento. Fora de uma partida, no editor de fichas ou na revisão de uma importação, ninguém tem nada e `itemStat` lê seu `default`.

<a id="checks-outside-a-fight"></a>

## Testes fora de uma luta

Um teste ou salvaguarda que o Game Master pede fora de uma luta lê mais que a ficha: as condições ativas do próprio personagem, os níveis que ele atingiu, o que seus itens fazem enquanto vestidos ou carregados e o que a exigência de um item vestido custa enquanto ele não a atende. É o mesmo vocabulário que as condições de uma luta usam (Capability API 1.53 para as chaves de item e a restrição por perícia ou salvaguarda).

Um item diz o que faz com `worn`, que vale enquanto ele está vestido (e vinculado, quando se vincula), e `carried`, que vale enquanto ele está só carregado. O casaco de couro de Ember Roads range quando você se esgueira, e uma pedra-guia faz o povo das caravanas confiar em você:

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["sneak"], "flat": -1 }] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }] }
```

Cada um aceita as partes de uma condição que um teste lê:

- `effects`: `own-checks-advantage`, `own-checks-disadvantage`, `own-saves-advantage` e `own-saves-disadvantage`.
- `modifiers`: mudanças (`to`) em testes ou salvaguardas, com `flat`, `dice` (e `minus`), `mode` e suas próprias `skills` ou `saves`, exatamente como as de uma condição.
- `failsSaves`: salvaguardas que quem o porta falha sem rolar.
- `skills` e `saves`: a quais perícias ou salvaguardas se referem os efeitos e os modificadores que não nomeiam as suas próprias.
- `abilities` (Capability API 1.54): atributos que ele altera, por ID, cada um `{ "set": N }` (pelo menos N: uma pontuação maior permanece) ou `{ "add": N }` (um número negativo o diminui). Eles se aplicam antes de a ficha ser calculada, então tudo que lê o atributo lê o valor alterado: a ficha na tela, valores derivados, testes, o bloco de ficha do GM e uma luta, quando começa. As somas vêm primeiro, depois o maior `set`, e o `min` e o `max` do próprio atributo continuam valendo. O máximo de uma reserva ou de uma trilha e o bônus de proficiência são calculados só a partir da ficha, então um item não os altera.

As manoplas de couro de boi de Ember Roads dão a uma pegada fraca a força de um tropeiro:

```json
"worn": { "abilities": { "brawn": { "set": 2 } } }
```

O que um item faz numa luta (defesa, ataques, velocidade, os outros efeitos da luta e o dano e as condições que ele evita) está em [Armaduras e efeitos de itens vestidos numa luta](#armor-and-worn-effects-in-a-fight); um teste fora de uma luta lê só as partes acima. Um item se aplica uma vez, quantas pilhas dele alguém tenha.

Um item também pode exigir algo de quem o veste, com `requires`: um valor da ficha dessa pessoa (`value`, qualquer referência de valor, lida como tudo o mais durante a partida), o mínimo que ele pode ser (`atLeast`) e o que se aplica enquanto ela não atende à exigência (`otherwise`, no mesmo vocabulário, exceto que não pode alterar um atributo, já que o que é exigido pode lê-lo). Até quatro. A pá de coveiro de Gravewatch é trabalho pesado para um guardião fraco:

```json
"requires": [
  {
    "value": { "abilityScore": "sinew" },
    "atLeast": 3,
    "otherwise": { "modifiers": [{ "to": "checks", "skills": ["dig"], "flat": -1 }] }
  }
]
```

Uma exigência lê o atributo como os itens de quem veste o deixam, então manoplas que definem Sinew como 3 atendem à exigência da pá.

Num teste:

- Todo modificador que se refere a ele soma seu número, e seus dados são rolados: um número fixo num teste somado, dados numa reserva. Um teste de atributo, e um teste que o conjunto não sabe nomear, leem só o que não está restrito a perícias específicas, e uma salvaguarda lê só o que se refere a salvaguardas.
- Vantagem e desvantagem de todas as fontes, inclusive o `mode=` do Game Master, se anulam: havendo qualquer uma de cada, o teste é rolado uma vez. Só um conjunto que rola duas vezes (`resolution.advantage`) pende para um lado.
- Uma salvaguarda que uma condição ou um item faz falhar falha sem rolagem, e nada é gasto nela.
- O registro diz o que o alterou: `effects="-1"` para o número, `from="Leather coat"` para o que o alterou e `automatic="true"` para uma salvaguarda falhada sem rolagem. O cartão de dados mostra o mesmo, e o Game Master o lê no turno seguinte. Ele é informado de que o Engine aplica isso, para não somar de novo.

Gravewatch mostra o mesmo numa reserva: o sino da aurora vinculado adiciona um dado a Ward, e Rattled tira um de Soothe e de Barter.

## Defesas por tipo vindas de condições, níveis, itens e linhas da ficha

`combat.conditions[]` e `combat.levels[]` podem conceder `resist`, `vulnerable`, `immune` (de 1 a 30 entradas cada) e `conditionImmunities` (de 1 a 40 IDs de condição). Eles se aplicam enquanto a condição vale ou o limiar do nível é atingido. Uma imunidade a condição recém-adquirida encerra essa condição, se já estiver ativa, e impede que ela seja aplicada de novo. A imunidade prevalece sobre a resistência; resistência e vulnerabilidade se anulam. Várias resistências nunca reduzem o dano à metade duas vezes.

`resist` e `immune` usam a forma das criaturas: uma palavra de dano ou `{ "type": "bludgeoning",
"except": ["magical"] }`. Qualquer tag nomeada no golpe ignora essa entrada. `vulnerable` continua sendo palavras de dano simples. A mesma forma de exceção funciona nos efeitos `worn` e `carried` dos itens. Declare as tags de exceção em `items.tags` e coloque-as nas qualidades da arma ou da magia. Por exemplo, Stoneskin é um mapeamento de condição:

```json
{
  "condition": "stoneskin",
  "resist": [
    { "type": "bludgeoning", "except": ["magical"] },
    { "type": "piercing", "except": ["magical"] },
    { "type": "slashing", "except": ["magical"] }
  ]
}
```

Armor of invulnerability usa a mesma matriz `resist` dentro do seu efeito `worn`. Protection from Energy pode conceder `resist: ["fire"]`; um traço como Brave pode conceder `conditionImmunities: ["frightened"]`. Um nível pode conceder `resist: ["poison"]` no seu limiar. Palavras de dano fixas desconhecidas são informadas quando `combat.damageTypes` declara o vocabulário, como nas criaturas; sem essa declaração, as palavras de dano são texto livre.

Para traços de ancestralidade ou de catálogo, `combat.sheetHides` comporta até oito fontes (uma matriz vazia é permitida). Cada uma nomeia uma lista da ficha, uma coluna de texto ou enum dessa lista e um dos quatro tipos. Para um anão cuja linha de traços contém `"poison"` numa coluna `resistance`:

```json
"sheetHides": [{ "list": "traits", "column": "resistance", "kind": "resist" }]
```

Cada linha contribui com palavras separadas por vírgula, sem espaços nas pontas e comparadas sem distinguir maiúsculas; palavras vazias são puladas. Acrescentar uma linha com `"fire"` acrescenta resistência a fogo; excluí-la remove essa fonte. As palavras de resistência e de imunidade podem incluir `except`, como em `"bludgeoning except magical silvered"`. Vulnerabilidades e imunidades a condição são palavras simples. Palavras de dano declaradas e desconhecidas no texto da ficha são ignoradas, assim como IDs de condição desconhecidos; uma coluna enum para imunidades a condição precisa declarar só IDs de condição na importação. Os resumos da ficha, da batalha e do Game Master incluem essas defesas e suas exceções.

<a id="weapons-in-a-fight"></a>

## Armas numa luta

Um item pode ser uma arma (Capability API 1.55). Seu `attack` tem a forma das [linhas de ataque](ruleset-combat.md#combat-a-fight-your-own-rules-resolve) de um bloco de combate, com valores no lugar de colunas, e uma [luta do conjunto](ruleset-combat.md#combat-a-fight-your-own-rules-resolve) o oferece como ataque enquanto o item está vestido: empunhado nas mãos que ocupa e vinculado, quando se vincula. Um item guardado ou só carregado não oferece nada, e as linhas de ataque e as ações próprias de uma criatura funcionam exatamente como antes. O machado de mão de Ember Roads:

```json
"attack": {
  "budget": "act",
  "toHit": { "abilities": { "stat": "swing" } },
  "damage": { "dice": { "stat": "damage" }, "abilities": { "stat": "swing" }, "type": "cut" },
  "reach": 2,
  "range": { "normal": 10, "long": 20 }
}
```

- `budget`: o orçamento que ele gasta, um de `combat.economy.budgets`.
- `toHit`: o que ele soma para acertar. `abilities` são um ou mais IDs de atributo, e conta o melhor deles (uma arma de acuidade lista dois). `skill` soma o que um teste daquela perícia soma, com o atributo do ataque no lugar do da perícia, como faz uma linha de ataque. `proficiency` é um valor da ficha de quem empunha: quando lê acima de 0, o bônus de proficiência do conjunto é somado (`{ "const": 1 }` para sempre). `bonus` é um número. `sheetBonus` é um número lido da ficha de quem empunha e somado como está, para o que quem empunha traz a toda arma de um tipo, e não para o que a arma é: o estilo de luta Archery de 5e dá `{ "derived": "archery" }` a cada arma à distância, um valor derivado que é 2 para um arqueiro e 0 para qualquer outra pessoa (Capability API 1.95; os dados do item o nomeiam pelo nome que tem na ficha). `target` é o alvo por dado próprio de uma luta de reserva para o ataque desta arma (a pá de Gravewatch conta todo dado a partir de 6 em vez do 7 da reserva), e só um conjunto `dice-pool` cujo `target` pode se mover pode definir um; numa luta somada, o `bonus` diz o mesmo.
- `damage`: os `dice` que ela causa, o melhor dos seus `abilities` de dano somado, um `bonus` e um `type`. Uma luta somada exige `dice`; numa luta de reserva, um acerto causa seus sucessos e `dice` adiciona mais essa quantidade de dados do próprio tipo de dado da reserva. `sheetBonus` (Capability API 1.97) é um número da ficha de quem empunha somado ao dano, como o de `toHit`, e com `"oneHanded": true` só conta enquanto a arma é empunhada numa mão: não uma arma `versatile` empunhada com as duas mãos, nem uma que ocupa dois de um espaço. O Dueling de 5e dá `{ "derived": "dueling" }`, 2 para um duelista que empunha uma única arma. `rerollUpTo` (Capability API 1.98) é um valor da ficha de quem empunha: os dados de dano da própria arma iguais ou inferiores a ele são rolados de novo uma vez e a nova face vale, inclusive os dados extras de um crítico, só enquanto a arma é empunhada com as duas mãos (uma arma `versatile` com as mãos livres, ou uma que ocupa dois de um espaço) e só numa luta somada. O Great Weapon Fighting de 5e dá `{ "derived": "great_weapon_fighting" }`, 2 com o estilo.
- `reach` e `range` (`normal`, e `long` para o que ela ainda alcança além disso) ficam na sua unidade de `combat.distance` e precisam dela. Uma arma com os dois é de arremesso, como uma linha de ataque: um golpe de perto, um arremesso além. Sem nenhum dos dois, ela alcança uma célula.
- `versatile`: os `dice` que ela causa no lugar enquanto cada espaço que ocupa tiver lugar para outro tanto entre o que quem a empunha veste: uma lança numa mão com a outra livre.
- `strikes`: quantos ataques um gasto compra, lido da ficha de quem empunha, como o `strikes` de uma linha de ataque. Uma arma sem isso dá um ataque por gasto, quantos ataques seu portador tenha.

Qualquer um desses números ou palavras pode ler a própria estatística do item: `{ "stat": "damage" }` é o `damage` do item, e uma estatística à qual o item não dá valor é como se o valor não estivesse escrito. `abilities` e `skill` leem uma estatística enum cujas palavras são IDs de atributo ou de perícia, e `type`, uma estatística de texto ou enum. Assim, um item que o Game Master inventa `like=` uma arma também é uma arma, que luta com as próprias estatísticas, limitada por `rarityCaps` como qualquer estatística (um valor que você escreve diretamente é copiado como está). Um item inventado sem espaço e sem vínculo nunca é vestido, então é criado sem o ataque. Um modelo pequeno tende a descrever uma arma e omitir `like=`; por isso, um item inventado numa categoria das suas armas, sem nada de onde partir, luta como a arma dessa categoria com o nome mais parecido (uma palavra contida no outro nome, em qualquer direção, então Crossbow se parece com Bow) ou como a primeira delas, herdando qualquer estatística que o ataque leia e que a proposta omitiu, e a resposta diz isso ("It fights as Hand axe does."). O formulário de proposta do Game Master também lhe diz que uma arma criada como outra luta como ela.

As tags de uma arma são o que seus golpes carregam. A entrada `resist` ou `immune` de uma criatura pode dizer o que a atravessa: `{ "type": "tearing", "except": ["silver"] }` é recebido por inteiro de uma arma com a tag `silver` e resistido de qualquer outra coisa. O grave wight de Gravewatch é escrito assim, e o prego de caixão de prata do conjunto o atravessa. Um dano que não vem de um item de arma nomeia o que carrega com `qualities` (Capability API 1.101), nas mesmas tags de item: nas `mechanics` de uma entrada de catálogo (uma magia) e no `damage` de uma ação de criatura (a maça de um deva). A "resistance to bludgeoning, piercing and slashing from nonmagical attacks" de 5e é `{ "type": "slashing", "except": ["magical"] }` ao lado do mesmo para os outros dois, com `magical` nas tags das suas armas mágicas e `"qualities": ["magical"]` nas suas magias e nos ataques de criatura que o SRD chama de mágicos.

Os detalhes da arma e a linha do Game Master dizem o que ela faz: `attack (Action): Brawn to hit, 1d6 + Brawn cut, reach 2 paces, range 10 to 20 paces`, com `1d8 with a hand free` para a lança de javali de Ember Roads e `at 6` ao lado da pá de Gravewatch.

<a id="ammunition-and-reloading"></a>

### Munição e recarga

Uma arma pode disparar algo e manter uma contagem carregada própria (Capability API 1.57). O arco de caça de Ember Roads dispara flechas, e a pistola de vigia de Gravewatch comporta uma bala, carregada a partir do chumbo e da pólvora do guardião:

```json
"ammo": { "tag": "arrow", "recover": 0.5 }
```

```json
"ammo": { "tag": "shot" },
"clip": { "max": 1, "reload": "act" }
```

- `ammo`: o que a arma dispara, por uma das suas `tags` de item. Cada ataque consome `perAttack` (1 quando não diz nada) dos itens com essa tag que quem a empunha carrega, vestidos ou não, da primeira pilha desse tipo na bolsa e depois da seguinte. A arma só é oferecida enquanto ele carrega o suficiente, e o menu da luta diz quantos restam. Depois de uma luta que o grupo vence, `recover` (de 0 a 1) do que cada um disparou volta para a pilha de onde saiu: a fração é somada na luta inteira e arredondada para baixo uma vez por pilha, então metade de cinco flechas disparadas de uma aljava dá duas. Uma luta perdida ou abandonada em fuga não devolve nada.
- `clip`: uma contagem carregada que a arma guarda em si. `max` é quanto ela comporta, escrito diretamente ou lido de uma estatística numérica do item, e `reload` é o orçamento que uma recarga gasta. Um ataque gasta o que está carregado em vez de tirar da bolsa, e a arma só é oferecida enquanto tiver carregado o suficiente para um ataque. Uma opção **Reload** (recarregar) no menu da luta gasta `reload` e a enche: a partir da bolsa quando ela tem `ammo` (tanto quanto a bolsa ainda tiver, quando for menos) e por completo quando não tem. A contagem fica na pilha da arma no inventário, então uma pistola esvaziada numa luta continua vazia na próxima. Uma arma que ninguém disparou ainda está carregada, assim como uma que o jogador junta numa pilha de várias iguais, já que uma contagem carregada pertence a uma única arma. A munição carregada não é recolhida depois de uma luta, então `recover` vale para armas que não têm essa contagem carregada.

O que uma luta dispara, carrega e recolhe é gravado no inventário a cada passo, como a saúde do grupo, e o diário diz o que foi usado. Um passo cuja pilha sumiu, ou contém menos do que a luta contava, é recusado, assim como um item gasto que a luta não encontra. O registro da luta diz cada disparo, recarga e recolhimento ("Hunting bow: 2 left to shoot.", "Ada loads 1 into Watch pistol: 1 of 1 loaded."), e os detalhes do item e a linha do Game Master dizem o que a arma dispara e comporta: `ammunition Arrow (1 an attack, 50% picked up after a won fight)` e `holds 1, reload (Act)`.

<a id="modes-a-second-weapon-a-floor-and-conditions-on-a-hit"></a>

### Modos, uma segunda arma, um piso e condições num acerto

Uma arma pode ter outras formas de fazer seu ataque, uma parceira na mão inábil, um dano mínimo e condições que impõe ao que acerta (Capability API 1.58). O arco de caça de Ember Roads pode disparar uma saraivada, e o prego de caixão de prata de Gravewatch pode ser empunhado em cada mão e marca o que fere fundo:

```json
"modes": [{ "id": "volley", "label": "Volley", "ammo": 2, "toHit": -2, "targets": 2 }]
```

```json
"offHand": true,
"onHit": [{ "condition": "marked", "atLeast": 2, "rounds": 2 }]
```

- `modes`: até seis outras formas de fazer o ataque, cada uma com um `id`, um `label` e o que ela muda. `ammo` é quantos disparos um ataque nesse modo consome, então a arma tem `ammo` ou um `clip` de onde disparar. `toHit` é o que ele soma para acertar: dados numa luta de reserva e um número numa luta somada. `target` move nessa quantidade o alvo por dado de uma luta de reserva (a partir do da própria arma, senão do da reserva; `+1` é mais difícil), quando o alvo da reserva pode se mover. `targets` é em quantos alvos ele pode ser mirado, cada um com sua própria rolagem de ataque. O menu da luta pergunta de que forma assim que o ataque é escolhido (depois do seu estilo de iniciativa, quando há estilos), cada uma com o que se espera que faça, e oferece só os modos para os quais quem empunha tem disparos. Um membro do grupo jogado pelo Engine avalia cada modo mirado num único alvo e deixa a um jogador os modos para vários alvos. Numa janela, um ataque é feito como está.
- `offHand`: uma arma para a mão inábil. O bloco de combate nomeia o orçamento que um segundo ataque gasta e se o dano dele mantém um atributo positivo:

  ```json
  "offHand": { "budget": "quick", "ability": "full" }
  ```

  Depois que quem a empunha atacou neste turno com uma arma marcada `offHand`, cada outra arma desse tipo que ele veste oferece um segundo ataque com aquele orçamento, chamado "Silver coffin nail, off hand" no menu. `ability` é `full` (o padrão) ou `penalty-only`, que soma o atributo de dano só quando ele tira algo, como faz o combate com duas armas de 5e. Um ataque com a mão inábil é um único golpe, quantos ataques o ataque principal compre, e nunca um golpe contra quem se afasta. Uma arma marcada `offHand` exige o `offHand` do bloco de combate. `fullWhen` (Capability API 1.97) é um valor da ficha de quem luta: acima de 0, a mão inábil dessa pessoa mantém o atributo inteiro, diga o que disser `ability`, como faz o estilo Two-Weapon Fighting de 5e.

- `floor`: o mínimo que um acerto causa, escrito diretamente ou lido de uma estatística numérica do item. O dano de uma luta de reserva depois da absorção, ou o dano de uma luta somada, é elevado a ele antes que uma resistência o reduza à metade, e o registro diz isso. Um golpe que gasta rola o número de quem o faz e nunca é elevado.
- `onHit`: até quatro das suas condições que o alvo recebe quando o dano que o golpe causou chegou a `atLeast`, por `rounds` dos turnos dele ou, sem isso, até que algo as remova. O dano é o que o atingiu depois da absorção e das resistências; um golpe que toma retira iniciativa em vez de causar dano, então não impõe nenhuma condição. Uma entrada também pode ter `save: { "save": <save id>, "difficulty": n }`, que o alvo rola quando a condição seria imposta, com um sucesso evitando-a, e `saveEnds: { "save", "difficulty", "at": "turn-start" | "turn-end" | "damaged" }`, que a faz durar até que quem a porta passe nessa salvaguarda no início ou no fim de cada turno dele ou ao receber dano acima de zero (ela então não tem `rounds`). As duas contam como salvaguardas contra essa condição, e contra magia quando a arma é mágica (Capability API 1.169). A sword of wounding de 5e: `{ "condition": "wounded", "atLeast": 1, "saveEnds": { "save": "con_save", "difficulty": 15, "at": "turn-start" } }`.
- `plus`: até três quantidades a mais em cada acerto, cada uma `{ "dice", "flat", "type", "save", "targetIs", "when" }` e rolada, tipada e resistida por conta própria (Capability API 1.169). `save` nomeia a própria `difficulty` e o próprio `onSuccess` (`half` ou `none`). `targetIs` só a causa a um alvo desses tipos ou tags de criatura (veja Tipos de criatura e testes de alvo em [Todas as chaves](ruleset-combat.md#every-key) na página de combate). `when: "critical"` só a causa num acerto crítico; os dados de qualquer cláusula são dobrados num acerto crítico, como os da arma. Uma javelin of lightning é `{ "dice": "4d6", "type": "lightning" }`; uma dragon slayer, `{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }`; uma sword of sharpness, `{ "flat": 14, "type": "slashing", "when": "critical" }`. Uma previsão só conta uma cláusula contra um alvo que ela alcança, e nunca uma só de crítico. `when: "toggled"` só a causa enquanto o botão liga/desliga do item está ligado (Capability API 1.170; veja `toggle` abaixo).

Os detalhes da arma e a linha do Game Master dizem tudo isso: `modes Volley (2 shots, -2 to hit, up to 2 targets)`, `off hand (Quick)`, `at least 1 on a hit before resistance`, `+3d6 slashing against Dragon` e `Marked for 2 rounds when a hit deals 2 or more`.

<a id="armor-and-worn-effects-in-a-fight"></a>

## Armaduras e efeitos de itens vestidos numa luta

O que um item faz enquanto vestido ou carregado também pode mudar uma luta (Capability API 1.56), para quem o porta, junto com suas condições e níveis. Cada um aceita as partes de uma condição que uma luta lê:

- `effects`: qualquer um dos de uma condição, exceto os cinco que um nível não pode ter (`half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side`, `cannot-approach-source`), já que ninguém colocou um item em quem o porta e ele nunca termina sozinho: `own-attacks-advantage`, `attacks-against-disadvantage`, `resist-all`, `speed-zero` e os demais.
- `modifiers`: mudanças (`to`) em defesa, ataques e velocidade, além de testes e salvaguardas, exatamente como as de uma condição; numa luta `dice-pool`, uma mudança em ataques é um número fixo de dados, como numa condição.
- `resist`, `vulnerable` e `immune`: tipos de dano dos quais quem o porta recebe metade, o dobro ou nada, como os de uma criatura (e validados contra `combat.damageTypes` quando você declara algum). `conditionImmunities`: suas próprias condições que nunca são impostas a quem o porta.

O anel da viúva amaldiçoado de Gravewatch custa um dado em todo ataque, o sino da aurora vinculado do mesmo conjunto torna quem o porta imune a Rattled, e uma pedra-guia de Ember Roads, carregada, afasta o calor:

```json
"worn": { "modifiers": [{ "to": "attacks", "flat": -1 }] }
```

```json
"worn": { "modifiers": [{ "to": "checks", "skills": ["ward"], "flat": 1 }], "conditionImmunities": ["rattled"] }
```

```json
"carried": { "modifiers": [{ "to": "checks", "skills": ["sway"], "flat": 1 }], "resist": ["burn"] }
```

Uma luta lê cada item uma vez, com o nome da pilha ("Widow's ring" ao lado de uma rolagem no registro, e numa defesa), como faz um teste; o `otherwise` de uma exigência não atendida também conta numa luta, então uma armadura pesada demais para quem a veste pode custar velocidade. Os detalhes de um item e a linha do Game Master dizem tudo isso ("While worn: -1 on attacks", "worn: +1 on checks (Ward), immune to Rattled"). Uma armadura que simplesmente soma a uma defesa ou a uma absorção é uma estatística de item lida com `itemStat` (veja Itens na ficha), como o Guard de Ember Roads lê o casaco vestido.

**Dureza.** Quando a iniciativa é um número que os ataques movem, `combat.pool.hardness` é a dureza de um combatente, lida da ficha dele quando a luta começa (a da armadura, por meio de `itemStat`), e uma criatura define a própria `hardness`. Um golpe que gasta cujos dados ficam abaixo dela acerta e não faz nada: o número de quem o fez ainda volta à base, o registro diz isso ("Ada's Grave spade lands on the warden with 5 dice, below a hardness of 6, and does nothing."), e o menu não prevê dano para ele. Só um conjunto com um estilo que gasta pode tê-la, e uma criatura escrita como ficha a obtém da ficha.

<a id="using-items-in-a-fight"></a>

## Usar itens numa luta

Um item pode ser usado numa luta (Capability API 1.59): um emplastro pressionado num corte, um tônico engolido, um sino tocado. Seu `use` diz o que usá-lo faz nas mesmas palavras que o `mechanics` de uma entrada de catálogo usa (veja [O que um combate lê de `mechanics`](ruleset-combat.md#what-a-fight-reads-from-mechanics)): `kind` (`heal`, `attack`, `buff` ou `debuff`), `amount`, `damageType`, `plus`, `attackRoll`, `save`, `applies`, `temporary`, `range`, `area`, `targets`, `targetCount`, `friendlyFire` e, desde a Capability API 1.174, `concentration` e `zone`, com o `budget` que gasta, ou `free`. O emplastro de Ember Roads e o tônico de aquecimento e o sino da aurora de Gravewatch:

```json
"use": { "kind": "heal", "budget": "act", "range": 0, "targets": "ally", "amount": { "dice": "1d4", "flat": 1 }, "consumes": true }
```

```json
"use": { "kind": "heal", "budget": "quick", "targets": "self", "amount": { "flat": 1 }, "consumes": true }
```

```json
"stack": 1,
"use": {
  "kind": "debuff",
  "budget": "act",
  "targets": "enemy",
  "save": { "save": "steel", "onSuccess": "negates" },
  "saveDifficulty": 7,
  "applies": [{ "condition": "rattled", "duration": { "rounds": 2 } }],
  "charges": 1
},
"charges": { "max": 3 }
```

- Um uso fica no menu da luta em **Items** (itens), com o nome do item ("Poultice"), seja qual for o nome da pilha. Um item que ocupa espaços ou se vincula é usado enquanto está vestido (e vinculado, quando se vincula), como o sino; qualquer outro, enquanto é carregado.
- Ele gasta um orçamento, ou é `free`, e paga com ele mesmo: `cost`, `perCostStep`, `check`, `concentration`, `reaction`, `scales`, `gives`, `standard` ou `rider` são para uma entrada de catálogo que uma ficha contém, e são recusados num uso.
- `toHit`, num uso com `attackRoll`, é o que ele soma para acertar, como o `toHit` de uma arma o define (veja Armas numa luta): atributos, uma perícia, um bônus e, numa luta de reserva, um alvo por dado. Sem ele, a rolagem não soma nada.
- `saveDifficulty`: o número contra o qual é rolada uma salvaguarda que ele pede (a sua própria, uma que termina uma condição que ele aplica ou a de uma cláusula sem `difficulty`), escrito diretamente ou lido de uma estatística numérica do item. Uma entrada numa ficha lê esse número da fonte do seu catálogo; um item não tem fonte, então diz o próprio número.
- `consumes: true` tira um da pilha do item a cada uso, e o menu diz quantos restam. O último usado leva a pilha junto.
- `restore` (Capability API 1.60) devolve parte de uma reserva de cada ficha que atinge, como uma bolsa de sangue devolve sangue: `{ "pool": "resolve", "amount": { "flat": 1 } }`, com `dice` e `flat` como num `amount`. Ele nomeia uma das suas reservas vivas, nunca a reserva de saúde (a saúde volta com uma cura), e fica num uso que ajuda, um `heal` ou um `buff`. Uma criatura não tem reservas, então não recebe nada. O registro diz isso ("Ada gets back 1 Resolve, and is on 3 of 4."), e um membro do grupo jogado pelo Engine deixa em paz uma reserva cheia. O tônico de aquecimento de Gravewatch restaura um ponto de Resolve além da cura.
- `charges` gasta essa quantidade das `charges` do próprio item, cujo `max` é quantas ele comporta, de 1 a 100, escrito diretamente ou lido de uma estatística numérica do item (um item que dá a essa estatística menos de 1 é recusado, e um acima de 100 comporta 100). A contagem fica na pilha do item no inventário, então um sino tocado duas vezes numa luta tem uma carga restante na próxima, e um que ninguém tocou está cheio. Cargas pertencem a um único item, então um item que as tem tem `stack` 1. Um uso consome o item ou gasta cargas, nunca os dois, e as cargas de um item são sempre gastas pelo seu uso. Há mais duas chaves em `charges` (Capability API 1.61), como as do sino da aurora de Gravewatch:

  ```json
  "charges": { "max": 3, "recharge": { "rests": ["vigil"], "amount": "max" }, "breaksOn": { "die": 20, "atMost": 1 } }
  ```

  - `recharge`: quais dos seus `rests` trazem as cargas de volta, e quantas: `"max"` enche o item, e uma quantidade (`{ "dice": "1d6", "flat": 1 }`) devolve essa quantidade, nunca além de `max`. Um descanso traz de volta as cargas de todo item que o personagem carrega e que nomeia esse descanso, seja pelo botão Rest da ficha, seja pelo `[sheet: op="rest"]` do Game Master; a ficha e a bolsa são gravadas juntas, e uma resposta regenerada recarrega só uma vez. A ficha diz o que voltou depois do descanso ("Dawn bell 3/3 charges"), e o Game Master vê no inventário, ao lado de cada item, as cargas restantes ("2 of 3 charges left").
  - `breaksOn`: quando um uso gasta a última carga, o Engine rola um d`die` e, com resultado igual ou inferior a `atMost`, o item quebra e some da bolsa, numa luta e fora dela. O registro da luta diz isso ("Dawn bell breaks (a 1 on its die)."), o relatório do botão Use também ("Its last charge spent, it breaks."), e o diário o conta como perdido.

- `gate` (Capability API 1.62) é um teste em que quem usa precisa passar antes de o item funcionar, como o pergaminho de uma magia acima do nível de quem o lê exige. `check` nomeia o que é rolado: `{ "skill": "ward" }`, `{ "ability": "wits" }` ou um valor da ficha (`{ "value": { "derived": "spell_mod" } }`, para um número que muda de um personagem para outro, como o modificador de conjuração de um conjurador de 5e). `difficulty` vai de 1 a 100, escrito diretamente ou lido de uma estatística numérica do item (um item que não a fornece fica fora do menu, e seu botão Use diz isso claramente). `unless` pula o teste quando um valor na ficha de quem usa é pelo menos `atLeast`. Um teste falhado consome o item (ou gasta suas cargas) por nada. Numa luta, o teste é rolado quando o item é gasto, com os próprios dados da luta (uma reserva numa luta de reserva, em que `difficulty` é o número de sucessos necessário) e o número da ficha lido quando a luta começou, e conta o que as condições e os itens vestidos de quem usa somam a esse teste, inclusive o da própria perícia. O registro diz isso ("Ada rolls Ward to use Page of the vigil litany: 2 successes from 2 dice at 7 or more (8, 9), needing 2 successes, a success."). A página da litania da vigília de Gravewatch tem um:

  ```json
  "gate": { "check": { "skill": "ward" }, "difficulty": 2, "unless": { "value": { "abilityScore": "nerve" }, "atLeast": 3 } }
  ```

O que uma luta consome e as cargas que deixa são gravados no inventário a cada passo, como os disparos de uma arma, e o diário diz o que foi usado. O registro da luta diz cada uso ("Poultice: 1 of 2 left.", "Dawn bell: 2 of 3 left."). Um membro do grupo jogado pelo Engine só usa uma cura em alguém ferido, e ninguém usa um item para golpear quem se afasta. Os detalhes do item e a linha do Game Master dizem o que usá-lo faz: "Use (Action): heals 1d4 + 1, range 0 paces, used up" e `use (Act): Steel 7 save negates it, Rattled, 1 of 3 charges`, e os detalhes mostram as cargas restantes. Um item que o Game Master inventa `like=` um dos seus é usado como aquele, com cargas e tudo.

## Itens nas batalhas Classic e Tactical

Um conjunto que não resolve as próprias lutas as deixa para as batalhas Classic e Tactical do próprio Game Mode, em que um modelo é consultado sobre o que os itens do inventário fazem quando uma luta começa. Seus itens não são adivinhados: cada um com um `use` faz o que ele diz, com os próprios números do Engine, e o palpite do Game Master só é pedido para os itens que não são seus (e para nenhum, com `native: false`).

- Um `heal` cura e um `attack` fere por uma fração da saúde máxima do alvo, a partir da média do seu `amount`: uma média de 7, o `1d8+3` de uma arma básica, é um pouco mais de um quinto dela, nunca menos de um vigésimo e no máximo tudo. Essa é a escala em que a ponte de combate lê os números de uma entrada de catálogo. O `damageType` é o elemento.
- A primeira condição em `applies` entra como um status com o próprio nome, pelos seus `rounds` (2 sem eles), e um `buff` ou `debuff` é só esse status, que aumenta ou reduz a defesa como os próprios status do Engine fazem.
- `targets` diz em quem ele é usado. Sem isso, uma cura ou uma melhoria vai para um aliado, e um ataque ou um enfraquecimento para um inimigo.
- `consumes: true` tira um da pilha, e um uso sem isso deixa o item onde está.
- Uma rolagem para acertar, uma salvaguarda, uma área, pontos temporários e uma reserva restaurada não têm lugar nessas batalhas, como acontece ali com o `mechanics` de uma entrada de catálogo: a descrição do item no menu ainda os menciona.
- Um item que ocupa espaços só é usado enquanto está vestido, e um que se vincula só enquanto está vinculado, como numa luta do conjunto. Um item consumido é tirado do que está vestido, nunca de um sobressalente na bolsa.
- Um item cujo uso gasta `charges` é oferecido enquanto resta um uso, e o menu Items conta seus usos. Cada uso gasta as cargas da pilha do item, primeiro a do próprio jogador, e o último gasto rola seu `breaksOn`: quebrado, o item some da bolsa, e o diário o conta como perdido.
- Um item que pede um teste antes (`gate`) tem esse teste rolado no servidor quando um membro do grupo o usa, com a ficha desse membro e o que ele veste (um companheiro sem card próprio rola numa ficha em branco, e só a unidade do próprio jogador recorre ao card do jogador), como o botão Use o rola, e pulado quando `unless` vale. Se falhar, o item é gasto (ou suas cargas são) e não faz nada, e o registro diz isso: "Ada rolls Ward to use Page of the vigil litany: 0 against 2, failed, and it is used up for nothing."
- Um item sem `use` não é oferecido nessas batalhas, nem uma cura sem `amount`.

O Engine calcula sozinho o efeito de cada item, então o que a tela envia nunca decide o que um dos seus itens faz.

## Loot

Uma luta vencida deixa loot em toda partida do Game Mode, uma vez, nas bolsas do grupo. Sem conjunto de regras, ele vem das tabelas próprias do Game Mode (mais itens, e mais raros, numa partida mais difícil), e o mesmo acontece num conjunto que não declara tabelas de loot e deixa `native` ativado. Um conjunto que declara tabelas de loot deixa cair os próprios itens no lugar, e um com `native: false` e sem tabelas não deixa cair nada.

`lootTables` no bloco `items` (Capability API 1.63) as lista, como fazem os bens funerários de Gravewatch:

```json
"lootTables": [
  {
    "id": "grave_goods",
    "label": "Grave goods",
    "rolls": "1d2",
    "entries": [
      { "item": "kit/shot-and-powder", "weight": 4, "count": "1d4" },
      { "item": "kit/warming-tonic", "weight": 3 },
      { "item": "kit/litany-page", "weight": 2 },
      { "filter": { "category": "arm" }, "weight": 1 },
      { "coins": "shilling", "weight": 2, "count": "1d6" }
    ]
  }
]
```

- `rolls` é quantas escolhas a tabela faz: um número de 0 a 20 ou dados (`"1d2"`), 1 por padrão.
- Cada escolha sorteia uma linha por `weight` (1 por padrão) contra as outras. Uma linha nomeia um dos seus itens como `<catalog>/<entry>`, um `filter` por `rarity`, `category` e `tag`, que escolhe por igual entre todos os itens que coincidem, ou (Capability API 1.64) `coins`, uma das suas moedas pelo ID. `count` é quantos caem, um número ou dados, 1 por padrão. Um item ou uma moeda que uma camada retira não deixa cair nada, nem um filtro que não encontra nenhum item.
- Uma criatura de bestiário nomeia a tabela que carrega com `loot` (veja [Criaturas](ruleset-combat.md#creatures-a-bestiary-a-fight-reads)). Uma luta do conjunto vencida rola a tabela de cada criatura derrotada, e uma luta que o Engine não resolve pelas suas regras não tem criaturas de bestiário, então não deixa cair nada.
- O que cai vai para a visão compartilhada como uma adição, começando pela bolsa do jogador, e o que ninguém consegue carregar fica para trás. O resumo que o Game Master recebe diz o que caiu e que isso já está nas bolsas, o diário registra, e uma notificação mostra.
- O Game Master rola uma tabela na história com `[loot: table="grave_goods" who="Ada"]` (`who=` para a bolsa de um personagem), medida a partir de onde o turno começou, como suas tags de inventário, então uma resposta regenerada deixa cair só uma vez. Cada item que cai é respondido como uma adição, e as instruções dele listam suas tabelas.

## Dinheiro

Suas `currencies` são o dinheiro do grupo. Uma moeda é um item nas bolsas, uma pilha de cada moeda como qualquer outra, nomeada pelo seu `label`:

- Ela pesa uma unidade da sua estatística de peso a cada `perWeight` moedas da família, conta para a carga de quem a porta e é colocada pela regra de carga quando entra. Uma família sem `perWeight` não pesa nada.
- O jogador adiciona moedas pela lista **Coins** (moedas) do seletor e as divide, dá e junta como qualquer pilha.
- Uma linha acima das pilhas do inventário mostra as moedas de cada família à vista e seu valor na menor moeda da família. O Game Master vê esse valor ao lado de cada bolsa (`Coin worth 432 pennies`, ou `no coins` para uma bolsa vazia, com a bolsa do jogador listada mesmo quando não tem nada), e o `cost` de um item ao lado do item (`costs 3 shillings`).
- O Game Master paga com `[inventory: action="pay" amount="3 shillings" who="Ada"]` e recebe com `action="earn"`. `amount` é uma quantidade e uma moeda, pelo ID ou rótulo, no singular ou no plural, com qualquer combinação de maiúsculas e minúsculas (`1 penny`, `12 pennies`). Um pagamento sai de uma única bolsa (a do jogador, sem `who=`), só na família da própria moeda: as maiores moedas que cabem vão primeiro, depois a menor moeda restante que cobre o que ainda se deve é trocada, e o troco volta nas moedas menores da família, das maiores para as menores. A resposta diz o que foi pago e o que voltou: 3 shillings de uma bolsa com uma crown dá `Paid with crowns ×1; shillings ×2 back.` Um pagamento que a bolsa não consegue cobrir é recusado (`cannot-afford`), assim como uma moeda que você não tem (`unknown-coin`) e qualquer pagamento num conjunto sem moedas (`no-currencies`). Um recebimento é uma adição dessa moeda, na bolsa de `who` ou dividida pela regra de carga. O diário lista o que foi gasto e recebido, e uma notificação mostra. As instruções dele listam suas moedas, e só um conjunto que tem moedas recebe essas instruções.
- Comprar é um pagamento seguido de uma adição ou, num conjunto com mercado, um `buy` (abaixo). Não há tela de loja.

## Equipamento inicial

`items.startingGear` (Capability API 1.78) lista o equipamento que um personagem pode colocar na bolsa no início: o kit de uma classe, o de um antecedente, o de uma vocação. Ele nunca é dado sozinho. O inventário mostra uma linha **Starting gear** (equipamento inicial), e o jogador escolhe um equipamento, uma opção para cada uma das escolhas dele e um item de cada lista, e então o coloca na bolsa do jogador ou na de um membro do grupo. O equipamento ao qual a ficha do personagem atende com `fits` é listado primeiro, depois o equipamento sem `fits` (para qualquer personagem, como o de um antecedente); todo equipamento é oferecido, porque o conceito de um personagem cabe ao jogador e ao Game Master combinarem.

```json
"startingGear": [
  {
    "id": "fighter", "label": "Fighter", "group": "class",
    "fits": { "value": { "field": "level_fighter" }, "atLeast": 1 },
    "lines": [{ "item": "equipment/shield", "equip": true }],
    "choices": [
      {
        "label": "Armor",
        "options": [
          { "label": "Chain mail", "lines": [{ "item": "equipment/chain-mail", "equip": true }] },
          { "label": "Leather armor and a longbow", "lines": [
            { "item": "equipment/leather-armor", "equip": true },
            { "item": "equipment/longbow" }, { "item": "equipment/arrow", "count": 20 }
          ] }
        ]
      },
      { "label": "A martial weapon", "options": [
        { "label": "Pick one", "lines": [{ "oneOf": ["equipment/longsword", "equipment/battleaxe"] }] },
        { "label": "A greataxe", "lines": [{ "item": "equipment/greataxe" }] }
      ] }
    ]
  },
  { "id": "acolyte", "label": "Acolyte", "group": "background", "lines": [{ "coins": "gp", "count": 15 }, { "name": "Vestments" }] }
]
```

- Uma linha é um dos itens do conjunto (`item`), moedas (`coins`, um ID de moeda), um item que o jogador escolhe de uma lista fixa (`oneOf`, de 2 a 48 itens) ou um item simples pelo nome (`name`, onde `freeform` permite itens simples; sujeito às regras de um rótulo, então sem colchetes, `{{` nem quebras de linha). `count` vai de 1 a 999; `equip: true` veste um item quando ele é pego, onde houver espaços livres, então a armadura conta desde o início.
- `choices` são de 0 a 8, cada uma com 2 a 6 opções com as próprias linhas.
- `group`: o equipamento que um personagem pega uma vez de cada grupo (o de uma classe e o de um antecedente). Pegar o mesmo grupo de novo é uma escolha que o jogador faz na caixa de diálogo, e se soma ao que já está na bolsa. Um equipamento sem grupo é um grupo próprio, nunca igual a um grupo de mesmo nome.
- `fits` lê a ficha sem o estado vivo, como faz a carga. Ele só ordena a lista.
- Pegar é tudo ou nada: um equipamento pesado demais para quem vai levá-lo é recusado por inteiro, e a caixa de diálogo diz quanto ele pesa em relação ao que a pessoa ainda consegue carregar. Um item que uma camada tira da partida fica de fora e é nomeado, assim como uma lista cujos itens ela tira todos; moedas de um tipo que uma camada retira são pagas na maior moeda restante de mesmo valor, e a caixa de diálogo as mostra assim. Um equipamento do qual não sobra nada é recusado, para que nunca seja marcado como pego por nada. Um serviço nunca é oferecido numa lista.
- A importação verifica todo item (num catálogo incluído no arquivo; um catálogo num arquivo próprio é verificado quando o equipamento é pego), moeda, item simples e referência de `fits`, recusa um serviço e recusa uma contagem que precisaria de mais pilhas do que uma bolsa aceita de uma vez.

## Mercados

Um `market` no bloco `items` (Capability API 1.65) diz o que um lugar vende e a que preço, em vez de toda loja vender tudo pelo preço de tabela. O de Gravewatch, um pouco resumido:

```json
"market": {
  "prices": [
    { "id": "cheap", "label": "cheap", "times": 0.75 },
    { "id": "fair", "label": "fair", "times": 1, "default": true },
    { "id": "dear", "label": "dear", "times": 1.5 }
  ],
  "places": [
    { "id": "hamlet", "label": "hamlet" },
    { "id": "village", "label": "village" },
    { "id": "town", "label": "market town" },
    { "id": "city", "label": "city" }
  ],
  "sold": [
    { "filter": { "rarity": "rare" }, "place": "town" },
    { "filter": { "category": "arm" }, "place": "village" }
  ],
  "sellers": [
    { "id": "chandler", "label": "chandler", "sells": [{ "category": "coat" }, { "category": "tonic" }] },
    { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "place": "village" },
    {
      "id": "chapel",
      "label": "chapel of the Vigil",
      "sells": [{ "category": "page" }],
      "place": "town",
      "only": { "value": { "abilityScore": "nerve" }, "atLeast": 3, "label": "wardens of Nerve 3 or more" }
    }
  ]
}
```

- `prices`: de um a oito níveis, cada um um multiplicador (`times`, acima de 0) sobre o `cost` de um item, e um deles o `default`. Um preço é o custo na menor moeda da família vezes o nível, arredondado nela (nunca abaixo de uma moeda para algo que custa alguma coisa), e expresso na moeda em que seu custo está escrito quando essa moeda o paga exatamente, senão na maior moeda que suas camadas deixam e que o paga: em `dear`, um casaco que custa 8 shillings sai por 12 shillings, e uma poção de 5e que custa 50 gp sai por 50 gold pieces, nunca 5 platinum. Pechinchar ou o humor de um vendedor mudam o nível, nunca o número.
- `places`: de um a doze tamanhos de lugar, do menor ao maior, nas suas próprias palavras.
- `sold`: regras para o menor lugar que vende o que um filtro escolhe. Um filtro nomeia `rarity`, `category` e `tag`, quaisquer deles, e coincide com um item que tem todos os que nomeia; a primeira regra que coincide com um item decide. O `sold` do próprio item prevalece sobre as regras, e um item que nada nomeia é vendido em qualquer lugar.
- `sellers`: tipos de vendedor, cada um com o que vende em `sells` (filtros, qualquer um dos quais escolhe um item), o menor `place` que tem um (qualquer lugar, sem isso) e, opcionalmente, a quem ele vende com `only`: um valor da ficha do comprador, com seu estado vivo e o que ele carrega, de pelo menos `atLeast`, informado ao Game Master como `label`. Sem `sellers`, qualquer pessoa num lugar vende o que aquele lugar vende.
- `unsold` (Capability API 1.813): filtros para o que nenhum vendedor tem entre suas mercadorias, onde quer que `sold` e `sells` o colocassem. A tabela `stock` de um vendedor ainda pode rolar um desses itens, então um lote avulso é a única forma de comprá-lo, e os vendedores ainda o compram de volta. Uma camada pode acrescentar filtros a ele (`[{ "tag": "magical" }]` de um cenário de pouca magia, veja [camadas](ruleset-layers-and-translations.md)).
- Um item sem `cost` não está à venda, nem um que uma camada oculta ou cujas moedas uma camada retirou.

**Onde o grupo está.** O Game Master diz em que lugar uma cena está e o tamanho dele com `[place: name="Millbrook" size="market town"]`, o tamanho pelo ID ou rótulo, e omite o tamanho para um lugar sem mercado (uma estrada, a natureza selvagem). O Engine responde a cada tag no lugar, recusando um tamanho que você não tem, e o último lugar respondido nas respostas do Game Master que o jogador vê, a partir do início mais recente da conversa, é o lugar em vigor até que outro seja dito. Uma tag de lugar que o jogador digita nunca conta. Uma resposta regenerada lê só o que veio antes da resposta que ela substitui.

**Comprar.** O Game Master compra com `[inventory: action="buy" item="Hand axe" count="1" level="dear" seller="smith" who="Ada"]`, sendo `level` (o padrão, sem ele) e `seller` (qualquer vendedor ali que venda o item, sem ele) opcionais. O Engine define o preço no lugar em vigor quando a resposta termina, tira o preço da bolsa do comprador (a do jogador, sem `who=`) como num pagamento, com troco, e coloca o item na bolsa dele, ou só paga, no caso de um serviço. Ou as duas coisas acontecem, ou nenhuma. A resposta diz quanto custou (`price="12 shillings"`) e o que foi pago e devolvido, e uma notificação mostra. Uma compra é recusada, sem mudar nada, quando não há lugar dito (`no-place`), quando um nível, item ou vendedor não existe no seu conjunto (`unknown-level`, `unknown-item`), quando não há preço (`not-for-sale`), quando o lugar é pequeno demais para o item (`not-here`), quando não há vendedor ali que o venda (`no-seller`), quando o comprador não atende ao `only` do vendedor (`not-to-you`), quando a bolsa não consegue pagar (`cannot-afford`) ou quando a bolsa não consegue carregar o item.

**O que o Game Master vê.** Enquanto uma cena está num lugar com mercado, um bloco MARKET nomeia o lugar e seu tamanho, os níveis de preço e cada vendedor ali com uma dúzia do que vende no nível padrão, do mais barato ao mais caro; qualquer coisa que vendam pode ser comprada pelo nome. As instruções dele ensinam `[place:]` e `buy`, e só um conjunto com mercado as tem.

### Um dia de mercado

Um dia de mercado (Capability API 1.69) faz as prateleiras de um lugar mudarem e se esgotarem, e permite que o grupo venda de volta. O de Gravewatch, um pouco resumido:

```json
"places": [
  { "id": "hamlet", "label": "hamlet", "purse": { "amount": 10, "unit": "shilling" } },
  { "id": "town", "label": "market town", "purse": { "amount": 100, "unit": "shilling" } }
],
"buyBack": 0.5,
"sold": [{ "filter": { "rarity": "rare" }, "place": "town", "limited": "1d2" }],
"sellers": [
  { "id": "smith", "label": "smith", "sells": [{ "category": "arm" }], "stock": { "table": "smiths_odd_lot" } }
]
```

- **O dia.** Um dia num lugar dura até o Game Master nomear outro lugar; ele começa um novo dia no mesmo lugar dizendo-o de novo com `day="new"` (`[place: name="Millbrook" size="market town" day="new"]`). Tudo abaixo é calculado por dia a partir das respostas do Game Master que o jogador vê, então um swipe, uma resposta regenerada ou uma ramificação não precisam de nada salvo, e um dia sempre rola a mesma prateleira.
- **`limited`** numa regra `sold` ou no `sold` do próprio item: quantos um lugar mantém disponíveis num dia, um número ou dados rolados para o dia. Uma regra pode nomear um limite sem lugar (vendido em qualquer lugar, poucos de cada vez); o lugar de um item vem da primeira regra que nomeia um lugar, e seu limite, da primeira que nomeia um limite. Depois que se esgotam, uma compra é recusada (`sold-out`) até um novo dia.
- **`stock`** num vendedor: uma das suas tabelas de loot, rolada uma vez por dia para o que aquele vendedor tem em estoque além do que vende. O que ela rola (só itens, nunca moedas) é vendido só por aquele vendedor, na quantidade rolada, seja o que for que `sells` e `sold` digam; o `only` de um vendedor continua valendo.
- **`buyBack`**: a fração (acima de 0, no máximo 1) do preço padrão de um item que um vendedor paga por ele. Um vendedor ali que vende esse tipo de coisa o compra (qualquer pessoa, sem vendedores). Sem `buyBack`, ninguém compra nada de volta.
- **`purse`** num tamanho de lugar: o caixa, isto é, o máximo que seus vendedores pagam num dia, todos juntos, numa das suas moedas. Vendas pagas na família dessa moeda contam contra ele; sem caixa, eles compram sem limite.
- **Vender.** O Game Master vende com `[inventory: action="sell" item="Silver coffin nail" count="1" seller="smith" who="Ada"]`. O Engine define o preço, tira o item da bolsa de quem vende (a do jogador, sem `who=`; nunca um item amaldiçoado vinculado) e coloca as moedas, das maiores para as menores, ou recusa e não muda nada: nenhum lugar dito, ninguém ali compra o item (`not-bought`), sem preço (`not-for-sale`), caixa do dia esgotado (`purse-spent`), nenhum em mãos, ou moedas que a bolsa não consegue carregar. A resposta diz quanto rendeu (`price="4 shillings"`), o diário o lista como vendido, e uma notificação mostra.
- O bloco MARKET adiciona o que cada vendedor tem em estoque hoje, quantos restam de um item limitado, o que os vendedores ali pagam e quanto resta do caixa do dia; as instruções dele ensinam `sell` e `day="new"`.

### Vendedores honestos e desonestos

A Capability API 1.79 permite que um item seja arriscado ou uma falsificação, e que um vendedor seja desonesto.

```json
"items": { "market": { "sellers": [
  { "id": "fence", "label": "Fence", "sells": [{ "tag": "magical" }], "place": "town", "honest": false, "stock": { "table": "fences_odd_lot" } }
] } }
```

```json
{ "id": "bag-of-devouring", "label": "Bag of Devouring", "item": { "category": "wondrous", "passesFor": "magic_items/bag-of-holding", "cost": { "amount": 5, "unit": "gp" } } }
{ "id": "wand-of-wonder", "label": "Wand of Wonder", "item": { "category": "wand", "risky": "every wave is a gamble; some effects turn on the one who waves it" } }
```

- **`risky`** num item: o que um vendedor honesto avisa antes de vendê-lo. O bloco MARKET o lista com "(warn the buyer first: ...)" ao lado da mercadoria de um vendedor honesto; um vendedor desonesto não diz nada.
- **`passesFor`** num item faz dele uma falsificação de outro item (`<catalog>/<entry>`): um item real e vendável da mesma categoria, vestido nos mesmos espaços, que se vincula se a falsificação se vincula. Isso é verificado na importação quando os dois podem ser lidos, na instalação para cada arquivo de catálogo e de novo quando um mercado o oferece, então uma falsificação cujo alvo falta ou está oculto por uma camada nunca é vendida. Um item amaldiçoado (`binds.cursed`) ou uma falsificação nunca está entre as mercadorias de ninguém, e nunca no estoque de um vendedor honesto.
- **`honest: false`** num vendedor: uma falsificação que a tabela `stock` dele rola é oferecida como o item pelo qual ela se passa, pelo preço desse item, e o bloco MARKET mostra a verdade ao Game Master ao lado dela. Uma compra que nomeia esse vendedor e esse item recebe a falsificação; uma compra que não nomeia vendedor nunca recebe.
- **Uma falsificação na bolsa** aparece como o item pelo qual se passa em todo lugar em que o jogador olha (a bolsa, o diário, as notificações, as lutas) e mantém o que realmente é. O bloco de inventário do Game Master a marca como `[FAKE: really ...]` e pede que ele continue chamando-a pelo nome com que ela aparece.
- **Descoberta**: `[inventory: action="reveal" item="Bag of Holding" who="Ada"]`, vinculá-la (a sintonia revela uma maldição), usá-la (acontece o que ela realmente faz; quando isso é algo que as regras não calculam, o Game Master o narra) ou vendê-la a um comprador honesto, que diz o que ela realmente é e paga o que isso vale (o próprio `cost` dela), ou recusa, quando ela não tem custo. Um comprador desonesto aceita uma falsificação pelo que ela parece. A partir daí, ela é o seu item verdadeiro.
- **Vestida ou carregada**: uma falsificação faz na ficha do personagem o que realmente faz (seus efeitos `worn` ou `carried` e suas estatísticas). A primeira mudança no inventário depois da qual a ficha mostra um número, ou o que um teste soma, que o item pelo qual ela se passa não mostraria a desmascara, e o diário e a tela dizem o que ela era. Uma diferença que só uma luta lê (uma resistência) não a desmascara, nem uma mudança só na ficha até a próxima mudança no inventário. Numa luta, uma arma falsa vestida ainda ataca como a arma pela qual se passa.
- No modo de confiança de um só jogador, o Peek Prompt mostra a visão do Game Master, inclusive a verdade.

<a id="spotting-fakes"></a>

### Identificar falsificações

A Capability API 1.802 permite que um personagem reconheça uma falsificação pelo que ela é, por meio de um teste que faça ou ao percebê-la antes que alguém pague. O Engine não conhece nenhum dos testes pelo nome: o conjunto de regras os escreve.

```json
{
  "id": "potion-of-poison",
  "label": "Potion of Poison",
  "item": {
    "category": "potion",
    "passesFor": "magic_items/potion-of-healing",
    "tells": [
      {
        "check": { "value": { "derived": "poisoners_kit_check" } },
        "dc": 13,
        "carries": { "anyOf": ["gear/poisoners-kit"] },
        "says": "a faint bitterness under the sweetness"
      },
      { "check": { "skill": "arcana" }, "dc": 18, "says": "its magic does not feel like healing magic" }
    ],
    "foolsReveal": ["identify"]
  }
}
```

```json
"items": {
  "namesItAt": 5,
  "revealsFakes": [{ "id": "identify", "label": "Identify" }, { "id": "detect-poison", "label": "Detect Poison and Disease", "items": ["magic_items/potion-of-poison"] }],
  "market": { "sellers": [
    { "id": "fence", "label": "Fence", "honest": false, "sells": [{ "tag": "magical" }],
      "manner": { "check": { "skill": "insight" }, "dc": 13, "advantageIf": [{ "value": { "derived": "knows_trade" }, "atLeast": 1 }], "says": "their eyes slide away when you ask about it" } }
  ] }
}
```

- **`tells`** numa falsificação (até seis): cada um é um teste que qualquer pessoa pode fazer (`check` é uma perícia, um atributo ou um valor lido da ficha, como os que o `gate` de um uso nomeia), com sua dificuldade `dc` e o que um sucesso percebe (`says`). `needs` é o que a ficha precisa atender para poder fazer o teste (com `needsAny`, basta atender a qualquer um deles), e `carries` é um item que quem faz o teste precisa ter na própria bolsa, como o kit usado num teste de ferramenta. Se qualquer uma das linhas de `advantageIf` for atendida, o teste é rolado com vantagem; se qualquer uma das linhas de `disadvantageIf` for atendida, com desvantagem.
- **`manner`** num vendedor desonesto: um teste sobre o vendedor em vez do item, com as mesmas partes. Um sucesso diz que há algo errado com o que ele vende, nunca o que é.
- **Inspecionar**: `[inventory: action="inspect" item="Potion of Healing" who="Mira"]` examina um item na bolsa de Mira, e `seller="Fence"` examina uma mercadoria que um vendedor daqui oferece hoje, antes de alguém comprar. O botão **Inspect** (inspecionar) do inventário, oferecido por um conjunto de regras cujas falsificações podem ser detectadas, diz "Examino minha Potion of Healing com cuidado antes de confiar nela." para que o Game Master escreva a tag. O Engine rola o melhor teste que o personagem pode fazer a respeito, com os dados do próprio conjunto de regras: os indícios da falsificação e a conduta de um vendedor desonesto. Um sucesso numa falsificação a torna suspeita: a resposta diz o que o personagem percebeu, e a bolsa mostra "Mira acha que é uma falsificação" enquanto o item continua sendo chamado pelo nome daquele pelo qual se passa. Um sucesso por uma margem de `items.namesItAt` ou mais (5 em 5e) num indício também a identifica, e a partir daí ela é seu item verdadeiro. Um item real rola os indícios das falsificações que se passam por ele, para que pedir o teste não revele nada, e um sucesso diz que ele parece autêntico. Cada personagem tenta uma vez por item (uma pilha mantém quem já tentou; uma mercadoria é lembrada durante o dia de mercado); uma falha diz que ele não consegue determinar. Um item que nada poderia denunciar, ou que um personagem não pode testar de forma alguma, é recusado com `nothing-to-check`, e a tentativa não é gasta.
- **Perceber antes de uma compra**: quando uma compra receberia uma falsificação de um vendedor desonesto, cada outro membro do grupo avalia cada teste que pode fazer sobre ela e sobre o vendedor, sem dados: `items.passiveBase` (10 por padrão) mais seu número, com 5 a mais com vantagem e 5 a menos com desvantagem. O primeiro que atinge uma dificuldade percebeu: nada é pago, e a compra recebe a resposta `reason="held"` com quem percebeu o quê. O Game Master recebe a instrução de encenar esse companheiro avisando o comprador dentro do personagem, sem acusar o vendedor na cara dele, a menos que a personalidade desse companheiro o levasse a fazer isso, e de deixar o comprador decidir. Nada mais é dito ao jogador. A mesma compra solicitada de novo àquele vendedor naquele dia é concluída. `items.warnBy: "roll"` rola esses testes em vez disso.
- **Desmascarar falsificações**: `items.revealsFakes` lista os meios de desmascarar falsificações que um personagem pode conjurar num item (uma magia, um ritual), cada um com um `id`, seu `label` e, para um meio que detecta apenas algumas falsificações, as `tags` que elas têm ou as próprias falsificações por referência (`items`, que só podem ser falsificações). Nomear as falsificações evita que elas tenham uma tag reveladora: uma poção de veneno com a tag "poison" se denunciaria ao lado da poção de cura pela qual se passa. `[inventory: action="inspect" item="Potion of Healing" who="Mira" with="Identify"]` nomeia um desses meios: uma falsificação que ele consegue detectar é identificada, uma cujo `foolsReveal` o lista aparece como o item pelo qual se passa, e uma falsificação que ele não consegue detectar, ou um item real, não revela nada ("autêntico" para um meio que detecta qualquer falsificação; caso contrário, "incerto"). Isso não gasta uma tentativa; qualquer custo da conjuração fica a cargo do Game Master, como o de qualquer magia.
- Um conjunto de regras que use qualquer um desses recursos exige Capability API 1.802. Os `tells` ou o `foolsReveal` de uma falsificação num item que não é uma falsificação, um item de `carries` ou de `revealsFakes` que não é um dos itens do conjunto de regras (uma falsificação, no caso de `items`) e um ID de `foolsReveal` que `revealsFakes` não lista são recusados na instalação.

<a id="using-items-outside-a-fight"></a>

## Usar itens fora de uma luta

O mesmo `use` funciona fora de uma luta (Capability API 1.60 para `restore`; o resto não precisa de nada novo). O botão **Use** do inventário, num dos seus itens com um `use`, e o `[inventory: action="use" item="Poultice" who="Juno"]` do Game Master fazem o que o item faz em quem o carrega, com os dados do Engine:

- Uma cura devolve saúde: a quantidade numa reserva de saúde ou numa trilha de saúde simples, ou uma marca limpa numa trilha de ferimentos, como faz uma cura numa luta. Pontos `temporary` vão para uma reserva de saúde, `restore` devolve sua reserva, e cada condição que ele aplica (`applies`) é imposta até que algo a remova.
- Um uso que fere, ou que mira o outro lado (`kind` `attack` ou `debuff`, ou `targets` `enemy`), não atinge ninguém: fora de uma luta, não há ninguém no tabuleiro para atingir. O item ainda é usado, e o Game Master é informado do que ele faz, para narrar.
- Ele tira um da pilha ou gasta suas cargas exatamente como numa luta, e um item sem nada restante, ou um que ocupa um espaço ou se vincula e não está vestido, é recusado e não muda nada. A ficha e a bolsa são gravadas juntas.
- Um `gate` é rolado primeiro, como um teste: os dados do próprio conjunto com o número da ficha, a penalidade de ferimentos de quem usa e o que suas condições e itens vestidos ou carregados fazem com esse teste. Um teste falhado consome o item por nada, e a linha diz isso ("Ada uses Page of the vigil litany: Ward check 1 against 2, failed; it is used up for nothing. 1 left.").

O que aconteceu é dito numa linha: "Juno uses Poultice: heals 4 (Grit 6/11). 1 left." O botão Use envia isso ao Game Master num bloco `[item_used]` depois de "I use my Poultice.", que o chat mostra como um selo; a tag do próprio Game Master é respondida com ele, medida a partir de onde o turno começou como suas outras tags, então uma resposta regenerada nunca usa um item duas vezes. Um item sem `use`, ou numa partida sem conjunto de regras, continua sendo simplesmente dito: "I use my rope."
