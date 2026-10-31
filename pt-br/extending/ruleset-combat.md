# Combate de conjuntos de regras

Esta página faz parte de [Escrever conjuntos de regras de Game Mode](writing-rulesets.md). Como um conjunto de regras participa de uma luta: o bloco `battle`, que empresta a ficha ao combate do Marinara, e o bloco `combat`, que resolve a luta inteira pelas próprias regras do conjunto, com seu bestiário, tabuleiro, reações e disputas.

<a id="battles-lending-the-sheet-to-marinaras-combat"></a>

## Batalhas: emprestar a ficha ao combate do Marinara

Por padrão, uma batalha não conhece a ficha. Constrói os combatentes como sempre, e um personagem pode sair da luta sem mudar os pontos de vida na ficha.

O bloco opcional `battle` muda isso numa única direção: empresta os números à luta e grava seu resultado de volta. **Ele não faz o combate seguir suas regras.** A matemática, quem acerta e quanto dano causa continuam sendo do Marinara. Por isso a saúde é transferida como proporção do máximo, não como seu número: meia saúde na ficha começa com meia barra daquela criada pelo Marinara. Sua reserva de 9 pontos nunca entra diretamente numa luta em que um golpe causa 12.

```json
"battle": {
  "health": { "pool": "grit" },
  "energy": { "pool": "luck" },
  "skills": [{ "list": "knacks" }]
}
```

- `health`: obrigatório. Reserva viva que representa pontos de vida na luta. Precisa pertencer a `sheet.live.pools`, não ser uma lista cujas linhas são reservas.
- `energy`: opcional. Reserva que a luta pode gastar e que vira a barra MP. Precisa ser diferente de `health`, pois a luta não pode gastar saúde como energia.
- `slots`: opcional. Reservas gastas uma unidade por vez, cada uma com `level` de 1 a 9: `[{ "pool": "slots_1", "level": 1 }]`. Cada nível e reserva são usados uma única vez.
- `skills`: opcional, até oito. Listas cujas linhas viram habilidades de combate. Só contam linhas dos seus catálogos cuja entrada tenha `mechanics`: uma linha digitada à mão não expressa efeitos numéricos. `onlyWhen` nomeia uma coluna booleana que deve estar ativa, como uma magia preparada. `alwaysWhen` nomeia uma coluna e um valor que permitem entrar mesmo assim, como magias sem preparação. É a exceção a `onlyWhen` e é recusada sem ele.

### O que entra e o que volta

**Na entrada**, para cada membro cuja ficha a partida possui: a proporção de saúde determina o início na barra do Marinara; energia vira MP; cada reserva de espaços vira espaços daquele nível; linhas marcadas viram habilidades. Saúde máxima, ataque, defesa, velocidade e nível continuam sendo números do Marinara. Saúde zero faz começar caído; acima de zero, o personagem nunca começa com menos de um ponto, para que uma proporção pequena não o derrube por arredondamento.

**Na saída**, depois de terminar a luta: a proporção final da barra é convertida para a escala da reserva, e a diferença desde o início é aplicada como dano ou cura. Energia e espaços são quantidades, não proporções, e voltam como estão. Tudo segue as regras dos botões da ficha; uma mudança recusada é ignorada e informada, não forçada. Uma luta que não mudou a saúde não escreve mudança nenhuma, para que as duas conversões não alterem a ficha sozinhas.

**Em nenhuma direção**: rolagens de ataque, salvaguardas, concentração e efeitos de um custo maior. Isso fica em `mechanics` para um sistema completo de combate ler um dia; esta ponte não aplica esses efeitos e o conjunto não deve afirmar que aplica.

Uma batalha abandonada não grava nada de volta. Se você excluir a mensagem que a iniciou ou ela nunca terminar, a ficha continua igual: a luta não aconteceu.

### Como uma entrada vira habilidade

O bloco `mechanics` é lido assim:

- `kind` vira o tipo da habilidade. Entradas `utility` e as marcadas `reaction` são omitidas, pois o combate do Marinara não tem onde aplicá-las.
- `amount` define a força como multiplicador do ataque do combatente, não como número de dano. Dados maiores nunca acertam mais fraco; o multiplicador fica na faixa das habilidades geradas.
- `range` e `area.size` são divididos por `units.distance.perCell` do catálogo para obter casas, nunca arredondando para zero. Uma explosão usa o raio, um cone a metade e uma linha uma casa. Áreas atingem todos os inimigos cobertos e respeitam `friendlyFire`.
- `damageType` vira o elemento. `targets` não é transferido: Marinara decide os alvos de curas, melhorias e ataques pelo tipo da habilidade.
- Um `cost` de energia vira custo MP; vários são somados. Um `cost` de exatamente um espaço gasta um daquele nível. Marinara cobra uma quantidade de energia ou um espaço, nunca ambos: omite entradas com dois espaços, espaços de dois níveis ou espaço mais energia. Também omite custos em outras reservas, como saúde ou recurso de classe, para não concedê-los de graça.
- `buff` e `debuff` viram os efeitos próprios do Marinara. Outras promessas do texto, como remover uma condição da ficha, não são aplicadas. Omita `mechanics` se o efeito só fizer sentido fora da batalha.

`coverage.combat` continua separado e mantém seu significado: ative apenas quando as batalhas realmente seguem as regras do seu sistema.

<a id="combat-a-fight-your-own-rules-resolve"></a>

## Combate: uma luta resolvida pelas suas próprias regras

O bloco `battle` acima empresta à luta os números da ficha, enquanto a aritmética continua sendo do Marinara. O bloco opcional `combat` é a outra coisa: define como suas regras RESOLVEM a luta. Ele parametriza um tipo de combate do Engine, assim como `resolution` parametriza um tipo de teste, e todos os nomes nele são seus. Há três tipos: `attack-vs-defense`, em que os dados são somados e comparados com um número, `dice-pool`, em que a luta rola as próprias reservas do seu conjunto `dice-pool` e conta sucessos (veja Uma luta em reservas de dados, abaixo), e `symbol-pool`, em que a luta rola os dados narrativos do seu conjunto `symbol-pool` e gasta o que sobra (veja Uma luta com dados de símbolos, abaixo).

**Uma partida cujo conjunto declara `combat` luta conforme esse bloco.** Os números do grupo vêm das fichas, os oponentes do bestiário ou da escala de ameaça, e cada turno é resolvido pelos seus dados. Tudo que um personagem gasta ou perde é gravado na ficha imediatamente: fechar a aba no meio não perde nada. A tela usa seus termos: ataques e habilidades no menu, orçamentos, condições e registro com os cálculos reais. As limitações estão na seção sobre o que ainda falta.

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "grit" },
  "defense": { "derived": "guard" },
  "initiative": { "dice": { "count": 2, "sides": 6 }, "modifier": { "abilityMod": "wits" } },
  "attackRoll": { "dice": { "count": 2, "sides": 6 } },
  "economy": { "budgets": [{ "id": "act", "label": "Action", "per": "turn", "count": 1 }] },
  "attacks": [
    {
      "list": "gear",
      "budget": "act",
      "name": "name",
      "toHit": { "ability": { "column": "swing" } },
      "damage": { "dice": { "column": "damage" }, "ability": { "column": "swing" }, "type": { "column": "harm" } }
    }
  ],
  "abilities": [{ "list": "knacks", "budget": "act" }],
  "standard": ["dodge", "help"],
  "conditions": [
    { "condition": "shaken", "effects": ["own-attacks-disadvantage", "ends-on-damage"] },
    { "condition": "pinned", "effects": ["cannot-act", "speed-zero"] }
  ]
}
```

Esse é o bloco inteiro de Ember Roads, e suas partidas o usam para lutar. O rascunho 5e usa as mesmas chaves para d20:

```json
"combat": {
  "kind": "attack-vs-defense",
  "health": { "pool": "hp" },
  "defense": { "field": "ac" },
  "initiative": { "dice": { "count": 1, "sides": 20 }, "modifier": { "derived": "initiative" } },
  "attackRoll": {
    "dice": { "count": 1, "sides": 20 },
    "advantage": true,
    "naturals": { "max": "critical", "min": "miss" },
    "critical": "double-dice"
  },
  "economy": {
    "budgets": [
      { "id": "action", "label": "Action", "per": "turn", "count": 1 },
      { "id": "bonus", "label": "Bonus action", "per": "turn", "count": 1 },
      { "id": "reaction", "label": "Reaction", "per": "turn", "count": 1 }
    ],
    "movement": { "field": "speed" }
  },
  "abilities": [
    {
      "list": "spells",
      "onlyWhen": "prepared",
      "alwaysWhen": { "column": "level", "equals": 0 },
      "budget": "action",
      "toHit": { "derived": "spell_attack" },
      "saveDifficulty": { "derived": "spell_save_dc" }
    }
  ],
  "concentration": { "text": "concentration", "save": "con_save", "floor": 10, "fromDamage": 0.5 }
}
```

<a id="every-key"></a>

### Todas as chaves

- `kind`: `"attack-vs-defense"` (um lado rola dados contra a defesa do outro; acertar causa dano), `"dice-pool"` (veja Uma luta em reservas de dados) ou `"symbol-pool"` (veja Uma luta com dados de símbolos). Cada chave abaixo significa o mesmo em todos, lida do jeito que aquele tipo lê números.
- `health`: obrigatório. O que a luta retira: `{ "pool": "grit" }`, uma reserva que diminui e cujo buffer temporário absorve o dano primeiro, se existir; ou `{ "track": "harm" }`, uma trilha de ferimentos que recebe MARCAS. Uma trilha de ferimentos exige `damageKinds` ao lado. Ou `{ "track": "wounds" }`, que nomeia uma trilha simples (sem `levels` nem `boxes`) que se PREENCHE de `min` até `max` (Capability API 1.383): o dano soma os pontos, uma cura os retira, e uma trilha em `max` está fora da luta, como uma reserva em zero. Wounds de Genesys é uma delas, com Wound Threshold como `max`; um sistema em que você só cai DEPOIS do limiar define `max` como um a mais que ele. Uma trilha de saúde simples começa em `default` (não em `startFrom`), não pode começar em `max` e não aceita `damageKinds`. Um `max` calculado pela ficha é próprio de cada personagem, como o máximo de uma reserva. Nenhuma trilha concede pontos temporários.
- `defense`: obrigatório, referência de valor. Um campo digitado pelo jogador ou um valor derivado calculado.
- `initiative`: obrigatório. Dados rolados uma vez no início e referência opcional de modificador. Empates favorecem o maior modificador e depois a ordem de preparação da luta. `"each": "round"` rola de novo a iniciativa de todos no início de cada nova rodada, com o modificador como estiver naquele momento (então um modificador que lê uma trilha de ferimentos fica mais lento depois de ferido), e a rodada começa por quem estiver primeiro na nova ordem. Capability API 1.47. Uma luta `dice-pool` pode rolá-la como reserva: `pool` (uma referência de valor) é quantos dados, e os sucessos deles mais `plus` são o número, sem `dice` nem `modifier` ao lado. `resource`, que exige `pool`, mantém esse número e deixa os ataques movê-lo (veja "Iniciativa que os ataques movem", abaixo). Capability API 1.48.
- `attackRoll`: obrigatório em `attack-vs-defense` e recusado em `dice-pool`, que rola as próprias reservas da sua resolução. Define dados, se rola duas vezes e mantém uma (`advantage`), efeitos das faces extremas de um dado (`naturals.max`: `critical`, `hit` ou `none`; `naturals.min`: `miss` ou `none`) e efeito do crítico (`critical`: `double-dice` rola novamente os dados de dano; `max-dice` adiciona uma vez suas faces máximas; `none` é um acerto comum). Faces especiais exigem um único dado, como nos testes. Salvaguardas durante a luta usam esses mesmos dados. `criticalFrom` amplia a face crítica: um valor lido da ficha do atacante que é a menor face natural que conta como crítico, como `{ "field": "critical_from" }` para um Champion de 5e cuja ficha diz 19. Ele fica limitado à face máxima do dado, um valor abaixo de 2 significa nenhuma faixa (só a face máxima, como para um personagem cujo campo ficou em 0), e exige um único dado com `naturals.max` definido como `critical`. Capability API 1.81.
- `economy`: obrigatório. `budgets` define o que cabe num turno: ID, rótulo, `per` (`turn` recarrega no início do turno do portador; `round`, no início da rodada) e `count`. O PRIMEIRO orçamento é o principal, gasto por ações padrão. `movement` é uma referência opcional de distância percorrida por turno, na sua unidade. Lutas em tabuleiro a leem; veja Posições.
- `attacks`: opcional. Listas da ficha cujas linhas são armas. `name` é a coluna de nome; `damage.dice`, a de dados; `toHit.ability`, `toHit.proficiency`, `toHit.bonus`, `damage.ability`, `damage.bonus` e `damage.type` nomeiam colunas da mesma lista. Uma coluna `ability` é um `enum` com um ID de atributo; outros valores não acrescentam nada. `proficiency` é `boolean`: ativar adiciona o bônus de proficiência. Sem dados legíveis, a linha não é um ataque; uma corda continua sendo corda. `toHit.skill` nomeia uma coluna `enum` com um dos seus IDs de perícia: a linha soma o que um teste daquela perícia soma, com o `ability` da própria linha no lugar do da perícia quando ela nomeia um, exatamente como o `with=` de um teste faz a troca (Capability API 1.47). `abilityChoices` mapeia um valor da coluna de atributo da linha para dois ou mais dos seus IDs de atributo (Capability API 1.793): uma linha que o lê ataca com o que mais soma para acertar e causa dano com esse mesmo atributo. Ele existe para representar a propriedade Finesse do SRD 5.1, escrita como `{ "finesse": ["str", "dex"] }`, com `finesse` entre os valores da coluna. O valor é recusado quando ele próprio é um atributo, nomeia um atributo que a ficha não tem ou não é oferecido por uma coluna de atributo. `toHit.sheetBonus` (Capability API 1.800) soma um número lido da ficha para acertar: `value` é qualquer referência de valor, e `when: { "column": ..., "equals": ... }` o restringe às linhas cuja coluna contém esse valor. Archery do SRD 5.1, "+2 de bônus nas rolagens de ataque que você faz com armas à distância", lê o `listSum` de uma coluna de habilidades nas linhas cujo `reach` é 0, então uma adaga arremessada não recebe esse bônus. `strikes` referencia quantos ataques UM gasto do orçamento compra. Escolher uma linha sem ataques disponíveis gasta o orçamento e deixa os restantes disponíveis. Enquanto houver algum, todas as linhas que declaram `strikes` são gratuitas: trocar de arma, alvo ou andar entre ataques decorre do próprio menu. `strikesCappedBy` nomeia uma coluna booleana que limita SUA linha a um único ataque, independentemente de quantos a lista compra: serve para armas que disparam uma vez por turno, como a propriedade Loading do SRD 5.1. Não faz sentido, e é recusado, numa lista que já compra um ataque por gasto. Os ataques disponíveis pertencem ao COMBATENTE, não a uma lista: duas listas com `strikes` compartilham a mesma quantidade, qualquer que seja a linha usada. São removidos ao terminar o turno que os comprou. Sem declaração, cada gasto compra um ataque, como antes.

  ```json
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "strikes": { "field": "attacks_per_action" },
    "damage": { "dice": { "column": "damage" } }
  }
  ```

- `abilities`: opcional. Listas cujas linhas marcadas por catálogo são habilidades, filtradas como `battle.skills` com `onlyWhen` e `alwaysWhen`. Os efeitos são o `mechanics` da entrada; o bloco define o `budget` padrão, o `toHit` adicionado quando rola para acertar e a `saveDifficulty` das salvaguardas. Uma entrada que pede salvaguarda, própria ou para terminar uma condição aplicada, é recusada se a lista não tiver `saveDifficulty`: uma salvaguarda contra nada sempre passaria. Com a Capability API 1.108, `byColumn: { "column": "class", "values": { "cleric": { "toHit": { "derived": "spell_attack_cleric" }, "saveDifficulty": { "derived": "spell_dc_cleric" } }, "wizard": { "toHit": { "derived": "spell_attack_wizard" }, "saveDifficulty": { "derived": "spell_dc_wizard" } } }` escolhe as referências pela classe de uma linha. Um clérigo 3 / mago 2 pode derivar o ataque do clérigo da proficiência mais Wisdom, e a CD de 8 mais esse ataque, e os do mago a partir de Intelligence. A coluna precisa existir na lista da fonte, e `values` comporta de 1 a 20 entradas. Cada entrada pode substituir qualquer uma das referências; uma referência omitida, um valor de coluna ausente ou um valor não listado mantém a referência própria da fonte. O combate, o resumo de linhas da ficha e o resumo do Game Master leem os mesmos números por linha. Tanto `stamp` quanto `byColumn` exigem schemaVersion 2 e capabilityApi 1.108 ou mais recente.
- `standard`: opcional, lista fechada `dash`, `disengage`, `dodge`, `help`, `hide`, `ready`. `dodge` (ataques recebidos rolam duas vezes e mantêm o pior) e `help` (próximo ataque do aliado rola duas vezes e mantém o melhor) sempre são resolvidos. `dash` (outra cota completa de movimento) e `disengage` (ninguém ataca por você se afastar neste turno) são resolvidos no tabuleiro e apenas registrados fora dele. `hide` e `ready` são aceitos, mas ainda não fazem nada.
- `standardEffects`: opcional, efeitos de uma ação padrão ausentes de seu indicador. Hoje só `dodge` tem isso: `{ "dodge": { "saves": ["dex_save"] } }` informa quais salvaguardas rolam duas vezes e mantêm a melhor enquanto durar. Nomeie só salvaguardas declaradas e apenas se `standard` incluir `dodge`. Sem isso, esquivar continua dificultando acertos e nada mais. `{ "help": { "beside": true } }` (Capability API 1.771) oferece Help (ajudar) só ao lado de um oponente, e a ajuda só vale contra um oponente que estava ao lado de quem ajudou; exige `help` na lista `standard`.
- `conditions`: opcional. Mapeia SEUS IDs de condições para seus efeitos, unindo ficha e luta num registro: um personagem envenenado continua assim depois. Lista fechada: `own-attacks-advantage`, `own-attacks-disadvantage`, `attacks-against-advantage`, `attacks-against-disadvantage`, `attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `cannot-act`, `cannot-react`, `speed-zero`, `half-move-to-stand`, `ends-on-damage`, `own-saves-advantage`, `own-saves-disadvantage`, `own-checks-advantage`, `own-checks-disadvantage`, `resist-all`, `cannot-target-source`, `cannot-target-source-side` (1.278) e `cannot-approach-source`. `failsSaves` nomeia salvaguardas que falham sem rolar. Os seis efeitos que precisam de distância ou movimento (`attacks-against-adjacent-advantage`, `attacks-against-far-disadvantage`, `attacks-from-adjacent-critical`, `speed-zero`, `half-move-to-stand`, `cannot-approach-source`) só atuam no tabuleiro; veja Posições. `cannot-react` exclui o portador das janelas abertas por movimento, então ele nunca é consultado. Há mais quatro chaves ao lado dos efeitos:
  - `modifiers`: os números que a condição altera enquanto vale. Veja Números que uma condição altera, abaixo.
  - `saves`: salvaguardas a que se referem os dois efeitos de salvaguarda e qualquer modificador de salvaguardas. Sem ela, todas; declará-la sem nenhum dos dois é recusado.
  - `skills`: perícias a que se referem os dois efeitos de teste e qualquer modificador de testes que não nomeie perícias próprias. Sem ela, todas; declará-la sem nenhum dos dois é recusado. As disputas de uma luta rolam os próprios testes da luta, não perícias, então algo restrito a perícias nunca chega a uma disputa; um teste fora de uma luta com uma dessas perícias o lê (veja [Testes fora de uma luta](ruleset-items.md#checks-outside-a-fight)). Capability API 1.53.
  - `whileSourceInSight`: o que só vale enquanto quem aplicou a condição estiver visível para o portador. `true` condiciona a condição inteira; uma lista de efeitos condiciona só esses e mantém os demais, como medo que impede aproximação mesmo sem ver a origem. Efeitos ausentes da condição são recusados. Sem tabuleiro, não há linha de visão para romper, então tudo vale igualmente.
  - `endsWhenSourceDown`: a condição termina quando quem a aplicou cai.
  - Sentidos (Capability API 1.127): o `lacks` de uma condição nomeia sentidos que quem a porta não tem, e o `mechanics.needs` de uma entrada de catálogo ou o `needs` de uma ação de criatura nomeia sentidos que um alvo precisa ter para que ela funcione nele. Para o Deafened de 5e, escreva `"lacks": ["hearing"]`; para Command, escreva `"needs": ["hearing"]` nas mecânicas dela. Um alvo surdo fica fora do menu de alvos de Command. Um efeito de área ou de vários alvos que precisa de audição pula esse alvo por completo: sem salvaguarda, dano nem condições. Quando Deafened termina, o alvo volta a ser válido. Cada lista tem de um a quatro IDs de sentido únicos, nas palavras do próprio conjunto; o Engine não conhece nenhum nome de sentido.
  - Utilizável só enquanto a ficha permitir (Capability API 1.166): o `mechanics.usableWhen` de uma entrada de catálogo é `{ "value": <value reference>, "atLeast": n, "atMost": n }` (um limite ou os dois). Numa luta, a entrada só é oferecida, no turno de quem a tem ou numa janela de reação, enquanto o valor lido da ficha, do estado vivo e dos itens de quem a tem estiver dentro dos limites; ele é lido toda vez que o menu é montado. A Protection de 5e exige um escudo na mão: `"usableWhen": { "value": { "itemStat": { "from": "worn", "pick": "count", "category": "shield" } }, "atLeast": 1 }`. O "no heavy armor" de Rage é o mesmo com `"atMost": 0` na contagem de armaduras pesadas. Uma criatura escrita como bloco de estatísticas não tem ficha, então nada a impede.
  - Condições aplicadas só enquanto a ficha de quem as aplica permitir (Capability API 1.167): uma entrada de `applies` nas mecânicas de uma entrada de catálogo ou no uso de um item pode ter `"when"`, no mesmo formato de `usableWhen`. Ele é lido da ficha, do estado vivo e dos itens de quem a aplica, no momento em que ela seria imposta, e uma entrada fora dos limites é pulada; as outras ainda se aplicam. O Rage de 5e aplica `raging` e uma de três condições de dano dentro do limite de quatro entradas: `{ "condition": "raging_damage_2", "duration": { "rounds": 10 }, "when": { "value": { "derived": "barbarian_level" }, "atMost": 8 } }`, depois `raging_damage_3` com `"atLeast": 9, "atMost": 15` e `raging_damage_4` com `"atLeast": 16`. Quem aplica sem ter ficha aplica todas as entradas. O bloco de estatísticas de uma criatura e o `onEnd` de uma condição não têm ficha de quem aplica para ler, então `when` é recusado ali. Exige schemaVersion 2 e capabilityApi 1.167 ou mais recente.
  - Tipos de criatura e testes de alvo (Capability API 1.168): `combat.creatureTypes` lista o que um combatente pode ser, `{ "types": [{ "id": "dragon", "label": "Dragon" }, ...], "tags": [{ "id":
"devil", "label": "devil" }], "field": "race", "default": "humanoid" }`.
    Uma criatura nomeia o próprio `type` e as próprias `tags`; o tipo de um personagem é o valor do campo de texto ou de escolha `field` quando ele é um dos tipos, senão `default` (personagens de 5e são humanoides). Um teste de alvo é `{ "types": [...], "tags": [...] }` e passa com qualquer correspondência; um combatente sem tipo e sem tags nunca corresponde. Ele vai em três lugares: o `targetIs` de uma cláusula de dano causa essa cláusula só a um alvo que corresponde (uma dragon slayer: `"plus": [{ "dice": "3d6", "type": "slashing", "targetIs": { "types": ["dragon"] } }]`, água benta: `{ "dice": "2d6", "type": "radiant", "targetIs": { "types": ["fiend", "undead"] } }`); o `targetIs` de uma entrada de `applies` só impõe essa condição a um alvo que corresponde; e `mechanics.targetTypes: { "is": test, "not": test }` diz quem pode ser escolhido ou pego (Animal Friendship: `{ "is": { "types": ["beast"] } }`; Sleep: `{ "not": { "types": ["undead"] } }`). Uma área passa por quem `targetTypes` deixa de fora sem pegá-lo. Uma previsão só conta uma cláusula `targetIs` contra um alvo que ela alcançaria; a média simples da ficha a deixa de fora. O painel de batalha e o Game Master veem o tipo e as tags de cada combatente. Exige schemaVersion 2 e capabilityApi 1.168 ou mais recente.
  - Fins de condição (Capability API 1.125): Charm Person usa `"endsWhen": ["harmed-by-source-side"]`. Dano acima de zero vindo de quem a aplicou ou de alguém do lado dessa pessoa, ou o fato de mirarem quem a porta com um ataque, uma salvaguarda ou uma condição nociva, a encerra depois que a ação nociva se resolve por completo, mesmo que o ataque erre ou a salvaguarda tenha sucesso. `"saveWhenDamaged": true` repete uma salvaguarda de turno ao receber dano: cada dano acima de zero repete o `saveEnds` da ação que a aplicou, na CD guardada; um sucesso a encerra. Sem uma salvaguarda ou CD guardada, nada é rolado. Hypnotic Pattern usa `"endsWhen": ["damaged"]` e `"shakeOff": { "budget": "action" }`: qualquer dano acima de zero a encerra na hora, ou outro combatente do lado de quem a porta pode gastar esse orçamento no próprio turno para encerrá-la. `shakeOff.reach` fica na unidade de distância do conjunto e tem padrão de uma célula; sem tabuleiro, nenhuma distância é medida. A economia precisa declarar o orçamento dele. `endsWhen` tem uma ou duas entradas únicas. Essas chaves não mudam os fins por queda da origem e por concentração. Para uma salvaguarda só com dano acima de zero, nunca no início ou no fim do turno, use `saveEnds.at: "damaged"` (Capability API 1.129): o applies de Dominate Person é `{"condition":"dominated","duration":"until-save","saveEnds":{"save":"wis_save","at":"damaged"}}`, que rola uma vez por golpe na CD guardada da ação que a aplicou, sem precisar de `saveWhenDamaged`.
  - A economia de ações (Capability API 1.76), como Haste e Slow a mudam:
    - `budgets`: `[{ "budget": "haste", "flat": 1 }]` dá a quem a porta essa quantidade a mais (ou a menos) de um orçamento de turno a cada turno, nunca abaixo de nenhum. Só um orçamento que recarrega `per` turno pode ser mudado dessa forma. Um orçamento pode ser declarado com `"count": 0` para um que só uma condição preenche, e a tela só o mostra enquanto alguém tiver algum. Um oponente inventado nunca gasta um.
    - `grants`: `{ "budget": "haste", "standard": ["dash", "disengage", "hide"], "attacks": true,
"items": true }` diz em que esse orçamento pode ser gasto:
      as ações padrão nomeadas (da lista `standard` do próprio conjunto, nunca no primeiro orçamento, onde todas as ações padrão já estão), um ataque com arma de um único golpe (sejam quantos forem os ataques que uma ação disponibilizaria; para uma criatura, um ataque do seu bloco de estatísticas contra um alvo, nunca um ataque múltiplo) e o uso de um item: `true` para qualquer item, ou `{ "tags": ["mundane"] }` só para um item com uma dessas tags de item (o Use an Object de 5e é o de um item comum, nunca a ativação de um item mágico). Elas são oferecidas depois que o orçamento que normalmente gastariam acabou, e só no próprio turno de quem a porta: uma concessão nunca paga uma reação.
    - `exclusive`: `["action", "bonus"]`, dois orçamentos dos quais um turno só gasta um: gastar qualquer um esvazia o outro.
    - `attacksPerTurn`: quantos ataques (ações que rolam para acertar, cada parte de uma sequência que ataca e uma disputa que ocupa o lugar de um golpe, como um agarrão) quem a porta faz no próprio turno, seja o que for que uma ação daria. Uma reação no turno de outra pessoa não é limitada nem contada.
    - `onEnd`: `{ "applies": [{ "condition": "lethargic", "duration": { "rounds": 1 } }] }`, o que ela deixa para trás quando termina de vez (se esgota, uma salvaguarda ou um dano a encerra, a concentração se rompe), nunca quando é imposta de novo. Ela dura algumas `rounds` (nunca `"until-save"` ou `"instant"`). Deixada para trás no meio do próprio turno de quem a porta, as rodadas dela começam no turno seguinte, então uma rodada é o turno seguinte inteiro.
  - Quando uma luta termina, seja como for, toda condição que ela impôs com relógio, com `endsAfter` ou com concentração sai da ficha sem deixar nada para trás, e a concentração termina. Uma condição sem relógio (o caído de uma queda) permanece.

  `own-saves-advantage` e seu oposto rolam duas vezes e mantêm uma, como ataques; eles se anulam. `own-checks-advantage` e seu oposto fazem o mesmo com o lado de quem a porta numa disputa, que é onde uma luta faz seus testes de atributo, e com os testes dessa pessoa fora de uma luta. `resist-all` reduz todo dano pela metade além das defesas próprias do alvo e se anula com uma vulnerabilidade da mesma forma. `cannot-target-source` impede mirar qualquer coisa em quem aplicou a condição (`cannot-target-source-side`, 1.278: nem em ninguém do lado dessa pessoa, a menos que seja o do próprio portador). `cannot-approach-source` impede chegar mais perto que a casa atual, incluindo o caminho: contornar até uma casa igualmente distante é permitido, mas passar perto e sair do outro lado não.

  ```json
  { "condition": "restrained", "effects": ["own-saves-disadvantage"], "saves": ["dex_save"] }
  ```

  **Dano que uma condição altera (Capability API 1.133).** `damage` muda o que quem a porta causa; `damage-taken` muda o que quem a porta recebe. Os dois aceitam `flat`, `dice` (e `minus`) ou `times: 0.5 | 2`. Os acréscimos acontecem uma vez por acerto de ataque, mesmo quando o acerto tem várias cláusulas de dano; os críticos dobram os dados acrescentados como o conjunto dobra os outros dados. Salvaguardas e acertos automáticos não recebem nada. `times` muda o acerto inteiro depois dos acréscimos e antes da resistência, arredondando o total para baixo uma única vez considerando todas as cláusulas. As quantidades acrescentadas enfrentam a resistência pelo próprio `damageType`, ou pelo tipo do acerto quando omitido. Acréscimos do mesmo tipo se juntam a essa quantidade antes da resistência.

  `attacks` é `weapon`, `spell` ou `any` (o padrão). As linhas de lista de ataques e os ataques de itens equipados são armas, assim como as rolagens de ataque de alvo único de blocos de estatísticas; as habilidades de catálogo (inclusive a conjuração de criaturas) e os usos de itens são ataques de magia ou de outro tipo. `blow: "melee" | "ranged"` segue a 1.118, então uma arma de arremesso ao alcance é corpo a corpo. `ability` nomeia o atributo de fato escolhido para a rolagem de ataque: o atributo de uma linha, ou o primeiro melhor atributo oferecido por um item (inclusive acuidade). Ações simples de blocos de estatísticas não têm nenhum e nunca coincidem com uma restrição de atributo. Essas chaves e `damageType` são recusados em outros alvos de modificador. `fromSource: true` é só para `damage-taken`: o acerto precisa vir de quem aplicou a condição acompanhada. Uma condição não acompanhada, um nível ou um item não tem origem que a aplicou e não pode coincidir com ele.

  Em 5e, declare estes IDs de condição na ficha e coloque estas entradas em `combat.conditions`:

  ```json
  [
    {
      "condition": "divine_favor",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "dice": "1d4", "damageType": "radiant" }]
    },
    {
      "condition": "rage",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "blow": "melee", "ability": "str", "flat": 2 }]
    },
    {
      "condition": "enfeebled",
      "modifiers": [{ "to": "damage", "attacks": "weapon", "ability": "str", "times": 0.5 }]
    },
    {
      "condition": "hunters_mark",
      "modifiers": [{ "to": "damage-taken", "attacks": "weapon", "fromSource": true, "dice": "1d6" }]
    }
  ]
  ```

  Divine Favor e Rage são impostos em quem os conjura; Ray of Enfeeblement e Hunter's Mark, no alvo. Hex usa a entrada `damage-taken` da marca com `attacks: "any"` e `damageType: "necrotic"`. Os níveis e os efeitos `worn`, `carried` e `otherwise` de exigência dos itens compartilham esses modificadores. O menu de ataque só conta os próprios acréscimos e multiplicadores de quem a porta; a marca de um alvo nunca é prometida ali. Os resumos da ficha e do prompt descrevem os modificadores de dano próprios de quem a porta, e a visão da batalha também descreve os recebidos. Pacotes que usam qualquer um dos dois alvos exigem schemaVersion 2 e capabilityApi 1.133 ou mais recente, inclusive quando o item fica num arquivo de catálogo separado.

  **Números que uma condição altera.** Cada entrada em `modifiers` nomeia o que altera, `to`, e em quanto:
  - `defense`: o número que um ataque contra quem a porta precisa alcançar. Só um número fixo.
  - `attacks`, `saves`, `checks`: as próprias rolagens de ataque, salvaguardas e testes de disputa de quem a porta. Um número fixo, ou `dice` rolados toda vez que a rolagem é feita (`"1d4"`); `minus: true` subtrai os dados em vez de somá-los.
  - `speed`: quanto quem a porta anda, na sua própria unidade de distância (`flat`), ou `times` 0.5 ou 2 para metade ou o dobro, aplicado depois de toda mudança fixa. Lido só num tabuleiro, como `speed-zero`.
  - `health-max`: `times` 0.5 e nada mais reduz à metade o máximo de saúde de quem a porta, arredondado para baixo e nunca abaixo de 1 (Capability API 1.115). Uma trilha de saúde em casas não tem máximo para reduzir à metade. A saúde acima do máximo reduzido se perde quando a luta começa, e a cura nunca passa dele.

  Um modificador de `checks` pode nomear as próprias `skills`, e um de `saves` as próprias `saves`, que o restringem no lugar das da condição. Qualquer um deles pode rolar duas vezes com `mode: "advantage"` ou `"disadvantage"`, contado junto com os efeitos de mesmo nome e se anulando como eles, com ou sem um número ao lado; assim, uma condição pode tornar Sneak mais difícil e Climb mais fácil ao mesmo tempo. Essas três chaves exigem Capability API 1.53.

  ```json
  { "condition": "muddy", "modifiers": [{ "to": "checks", "skills": ["sneak"], "mode": "disadvantage" }] }
  ```

  Um número fixo carrega o próprio sinal, e 0 é recusado. Todo modificador aparece no registro ao lado da rolagem que alterou, com o nome da condição ("12 + 5 + 3 (Blessed) = 20"), e a chance de acertar e a chance de vencer do menu o levam em conta. Condições se acumulam umas com as outras; a mesma condição duas vezes continua sendo uma condição.

  ```json
  "conditions": [
    { "condition": "blessed", "modifiers": [{ "to": "attacks", "dice": "1d4" }, { "to": "saves", "dice": "1d4" }] },
    { "condition": "shielded", "modifiers": [{ "to": "defense", "flat": 5 }] },
    { "condition": "slowed", "modifiers": [{ "to": "speed", "times": 0.5 }, { "to": "defense", "flat": -2 }] }
  ]
  ```

- `levels`: opcional. Níveis de uma trilha viva que contam como condições enquanto a trilha estiver alta o bastante, que é como se expressa uma condição que piora em etapas, como a exaustão. Cada entrada nomeia uma `track` comum (não uma trilha de ferimentos), o nível `at` em que começa e o que faz, com os mesmos `effects`, `modifiers`, `failsSaves`, `saves` e `skills` de uma condição. Todo nível que a trilha atingiu conta, então eles se somam conforme ela sobe. Um nível não tem origem e só termina quando o que ele lê diminui, então `half-move-to-stand`, `ends-on-damage`, `cannot-target-source`, `cannot-target-source-side` e `cannot-approach-source` são recusados num nível. Só um combatente com ficha tem trilhas. O registro nomeia um nível pela trilha e pelo número ("- 1 (Heat 3)").

  No lugar de `track`, um nível pode ler um valor `derived` (Capability API 1.54), calculado com o estado vivo e os itens do personagem, para que ninguém precise marcar nada: Ember Roads deixa mais lento qualquer um que carregue 10 de volume ou mais.

  ```json
  {
    "derived": "bulk_carried",
    "at": 10,
    "modifiers": [
      { "to": "speed", "flat": -2 },
      { "to": "checks", "skills": ["sneak"], "flat": -1 }
    ]
  }
  ```

  Um limiar que muda de um personagem para outro (mais de cinco vezes a Força, por exemplo) é um valor derivado que o subtrai: `scale` por -1 dá a parte a tirar, e uma `sum` das duas é o que o nível lê.

  ```json
  "levels": [
    { "track": "exhaustion", "at": 1, "effects": ["own-checks-disadvantage"] },
    { "track": "exhaustion", "at": 2, "modifiers": [{ "to": "speed", "times": 0.5 }] },
    { "track": "exhaustion", "at": 3, "effects": ["own-attacks-disadvantage", "own-saves-disadvantage"] },
    { "track": "exhaustion", "at": 4, "modifiers": [{ "to": "health-max", "times": 0.5 }] },
    { "track": "exhaustion", "at": 5, "effects": ["speed-zero"] },
    { "track": "exhaustion", "at": 6, "defeats": true }
  ]
  ```

  `"defeats": true` tira quem o tem da luta de vez quando ela começa, antes de qualquer um se mover (Capability API 1.115). Ele e a saúde perdida por um máximo reduzido à metade são resolvidos uma única vez, quando a luta começa; todos os outros níveis são lidos sempre que o número que mudam é lido.

  Os oponentes também têm trilhas (Capability API 1.115). Um sem ficha começa nas `tracks` que lhe são dadas, pelos IDs das suas trilhas: uma criatura que o Game Master propõe pode nomeá-las (`"tracks": { "exhaustion": 2 }`), e um oponente do bestiário colocado numa luta também. Os `conditionImmunities` de uma criatura podem nomear uma trilha que um nível lê, e então nenhum dos níveis dessa trilha a afeta, com ficha ou não: os mortos-vivos e os constructos de 5e, imunes à exaustão.

  Modificadores, níveis e os efeitos de teste exigem Capability API 1.45.

- `checks` e `contests`: opcionais. O que uma disputa lê e as disputas que qualquer um numa luta pode iniciar: agarrar, empurrar, se soltar. Veja Disputas, abaixo. Capability API 1.43.
- `concentration`: opcional. Campo vivo `text` que registra o efeito mantido, `save` exigida pelo dano, `floor` mínimo da dificuldade e `fromDamage`, proporção do dano que a define quando maior. Iniciar outra habilidade de concentração termina a primeira; falhar a salvaguarda a encerra e remove as condições mantidas por ela.
- `dying`: opcional, `kind: "saves"`. Duas trilhas que contam as rolagens (a quantidade necessária é o máximo de cada uma), `dice`, `succeedAt`, efeitos das faces extremas (`naturals.max`: `revive-1` ou `success`; `naturals.min`: `one-failure` ou `two-failures`), custo de dano enquanto caído (`damageWhileDown`, `criticalWhileDown`) e `condition` do personagem caído. Sem o bloco, saúde zero só o deixa caído e cura o traz de volta.
- `damageTypes`: opcional. Tipos do sistema, comparados sem distinguir maiúsculas.
- `damageKinds`: obrigatório se `health` nomeia uma trilha de ferimentos e recusado para uma reserva, pois só uma marca mantém um tipo (veja [Trilhas de ferimentos](ruleset-sheets.md#wound-tracks-health-that-is-a-track-not-a-number)). Define quais `kinds` o golpe marca e quantas casas. `default` recebe o que não foi mapeado, inclusive dano sem tipo; `byType` mapeia `damageTypes` para tipos de marca, ignorando maiúsculas: `"Fire"` e `"fire"` são uma chave e declarar ambas é recusado. `marks` não tem padrão porque as respostas são opostas: `"per-point"` conta níveis de saúde pelo dano, então três de dano marcam três casas e reduzi-lo ajuda; `"per-blow"` marca uma casa se o golpe acerta, qualquer que seja a força. Um golpe com várias cláusulas ainda marca uma casa, usando o tipo mais grave que entrou. Informe qual seu sistema usa: `{ "default": "bashing", "byType": { "fire": "aggravated" }, "marks": "per-point" }`.
- `pool`: obrigatório em `dice-pool` e recusado em `attack-vs-defense`. Veja Uma luta em reservas de dados.
- `spendLimits`: opcional. Quanto de uma reserva viva um combatente pode gastar por `turn` ou por `round` numa luta, seja qual for o tipo: `[{ "pool": "blood", "max": { "derived": "blood_per_turn" }, "per": "turn" }]`. `max` é lido uma vez quando a luta começa. Um custo além do que resta do limite não pode ser pago, então fica fora do menu, por mais que haja na reserva. Um limite por turno recomeça no início do próprio turno de quem o tem, e um por rodada quando a rodada começa. Um oponente escrito com números simples não paga nada de uma ficha, então um limite nunca o restringe; um oponente escrito como ficha paga das próprias reservas e fica sujeito ao limite como qualquer outro. Capability API 1.47.
- `threat`: opcional e necessário para bestiários. `tiers` é a escala de oponentes: ID, rótulo, faixa `health`, `defense`, `toHit`, faixa `damagePerRound` e `saveDifficulty`. Toda criatura nomeia um patamar; um oponente não escrito é ajustado ao que o GM pediu, sem sair da escala. `damagePerRound` expressa o que causa a UM alvo por rodada, incluindo toda a sequência.
  Um patamar pode ter `worth`, o valor que uma criatura dele representa no orçamento de um encontro (os pontos de experiência por nível de desafio de 5e), e `threat` pode ter `budget`, o que uma luta pode conter para a equipe que a enfrenta (Capability API 1.803):
  - `level`: os campos numéricos cuja soma é o nível de um membro (5e: um por classe).
  - `steps`: as etapas de dificuldade, da menor para a maior, cada uma `{ "id", "label" }`.
  - `byLevel`: `[{ "level": 5, "worth": [500, 750, 1100] }]`, um valor por etapa para um membro nesse nível ou acima, com os níveis em ordem crescente.
  - `crowd`: opcional, `[{ "from": 2, "times": 1.5 }]`, o fator pelo qual o valor dos oponentes é multiplicado quando eles chegam a essa quantidade; `smallParty` e `largeParty` leem uma linha acima para uma equipe menor que o primeiro limite e uma linha abaixo para uma maior que o segundo (os multiplicadores de 5e 2014). Omita para usar o orçamento do SRD 5.2, que soma os valores como estão.
  - `forGame`: opcional, a etapa em que cada dificuldade de jogo (`casual`, `normal`, `hard`, `brutal`) é jogada. Se não for declarado, elas usam as etapas em ordem, e qualquer uma além da última usa a última.

  O Game Master recebe o valor de cada patamar e o orçamento da equipe antes de escrever uma luta. Uma luta que ele inventa cujo valor excede o orçamento é reduzida: o oponente inventado de maior valor desce um patamar, repetidamente, até caber; uma luta com um chefe pode chegar à etapa seguinte. Uma criatura de bestiário e uma que volta de uma luta anterior são contadas como estão, e uma luta de história é definida por seu autor. As reduções são informadas nos ajustes da luta.

### Salvaguardas contra condições, dano ou magia

Um modificador com `to: "saves"` pode ter `against`. Ele precisa de pelo menos um entre `conditions` (IDs de condição da ficha), `damage` (tipos de dano) ou `magic: true`. Basta uma correspondência; `saves` continua restringindo qual salvaguarda, como um E lógico. Use o `mode: "advantage"` do modificador, não `effects`, para restringir a vantagem dessa forma. Esses modificadores funcionam em condições, em níveis de trilha atingidos ou derivados e em efeitos de itens. Para características de raça, derive um valor a partir da raça escolhida na ficha e associe o modificador a um nível atingido quando esse valor é 1. Exemplos de modificadores:

```json
[
  {
    "$comment": "Dwarven Resilience",
    "to": "saves",
    "mode": "advantage",
    "against": { "conditions": ["poisoned"], "damage": ["poison"] }
  },
  { "$comment": "Fey Ancestry", "to": "saves", "mode": "advantage", "against": { "conditions": ["charmed"] } },
  {
    "$comment": "Gnome Cunning",
    "to": "saves",
    "saves": ["int_save", "wis_save", "cha_save"],
    "mode": "advantage",
    "against": { "magic": true }
  }
]
```

Brave usa `conditions: ["frightened"]`. Magic Resistance usa `magic: true` sem `saves`, num nível derivado da ficha de uma criatura ou num nível de trilha. O `applies` de uma ação conta mesmo que a salvaguarda impeça a condição; o dano dela inclui todas as cláusulas `plus`. Os nomes de dano são comparados sem distinguir maiúsculas. Magia significa a qualidade `"magical"` da 1.101: o `mechanics.qualities` de um catálogo (mesmo sem dano), o `damage.qualities` de uma ação de criatura ou as tags de um item de arma. Uma magia precisa ter essa qualidade; o nome ou o catálogo dela, sozinhos, não a tornam mágica. Uma salvaguarda para encerrar uma condição, inclusive `saveWhenDamaged` e `saveEnds.at: "damaged"`, é só contra essa condição. As salvaguardas de concentração e contra a morte não são contra nada. Fora do combate, os pedidos de salvaguarda do Game Master não levam origem nem condição estruturadas; `against` nunca coincide com esses pedidos. A ficha, os detalhes do item, os detalhes da batalha e o resumo de ficha do Game Master mostram essas restrições. Exige schemaVersion 2 e capabilityApi 1.134 ou mais recente.

### Uma luta em reservas de dados: `dice-pool`

Um conjunto `dice-pool` conta sucessos em vez de somar dados, e suas lutas também podem fazer isso. `"kind": "dice-pool"` exige que `resolution.kind` seja `"dice-pool"` e lê a ficha como seus testes de reserva já leem: **todo número que uma rolagem soma é uma quantidade de dados, e todo número que ela enfrenta é uma contagem de sucessos.** Então nada é renomeado:

- Um número para acertar (o de uma linha de ataque, o `toHit` de uma lista de habilidades, o de uma ação de criatura) é a reserva que um ataque rola. O dado, o alvo que um dado precisa atingir e as faces em que ele dobra, explode, anula e falha criticamente são os da sua `resolution`. A trilha de ferimentos que seu `resolution.penaltyFrom` nomeia tira sua penalidade da reserva, como faz num teste.
- `defense` é quantos sucessos um ataque precisa, e nunca menos de um. O modificador de `defense` de uma condição, e a cobertura (`cover.bonus` ou `cover.threeQuarters`), somam a ele.
- Cada sucesso além dos necessários adiciona um dado de dano. Uma falha crítica erra, seja o que for que tenha contado. Não há críticos: um acerto forte vale pelos dados extras.
- O número de uma salvaguarda é sua reserva, e sua dificuldade, os sucessos de que precisa. Uma disputa rola o teste de cada lado como reserva, e o lado com mais sucessos vence.
- O modificador de uma condição para ataques, salvaguardas ou testes é uma quantidade de dados somada ou retirada, então é um número `flat`: um modificador rolado (`dice`) é recusado.
- O dano é medido em dados do seu dado: o `dice` de uma quantidade (de uma criatura, de uma entrada) diz quantos, e precisa ser do seu dado, e sua parte `flat` são sucessos automáticos, nunca rolados. A coluna de dados de dano de uma linha de ataque é lida pela contagem, `damage.ability` soma a pontuação daquele atributo em dados, e `damage.bonus` soma sucessos automáticos. `perCostStep` e `scales` somam dados, como sempre. Cura e pontos temporários são quantidades e se somam como antes.
- A iniciativa é uma soma (`initiative.dice` e `modifier`) ou uma reserva, quando você pede uma (`initiative.pool`, abaixo), e uma regra de morte mantém os próprios dados.

O que uma luta de reserva rola além disso é definido pelo bloco `pool`:

```json
"pool": {
  "advantage": true,
  "damageTarget": 6,
  "soak": { "roll": true, "byKind": { "knock": { "abilityMod": "sinew" } } }
}
```

- `advantage`: se uma rolagem que pende para um lado é rolada duas vezes, mantendo a que teve mais sucessos (uma falha crítica conta como menos que qualquer rolagem sem falha crítica). Sem isso, uma luta rola uma vez, diga o que disser uma condição.
- `damageTarget`: o alvo por dado contra o qual são rolados os dados de dano e de absorção. É o alvo padrão da sua resolução quando você o omite. Esses dados contam uma vez cada face igual ou superior a ele e nada mais: nada dobra, explode, anula ou falha criticamente neles.
- `soak`: o que um alvo tira do dano de um acerto, por tipo de dano. `all` é uma referência de valor para qualquer tipo, e `byKind`, uma por tipo da sua trilha de saúde, que prevalece sobre `all` para o seu tipo; um tipo que nenhum dos dois nomeia não é absorvido. Com `"roll": true`, o alvo rola essa quantidade de dados contra o alvo de dano, e cada sucesso tira um. Com `"roll": false`, o número sai dos dados de dano antes de serem rolados, então nunca afeta sucessos automáticos, que a absorção rolada tira como qualquer outro. Nada fica abaixo de zero, e nada é rolado para absorver um golpe que não contou nada. Uma criatura define os próprios números como `soak: { "all": 1, "byKind": { "knock": 3 } }`, o que exige que o `soak` do bloco diga como a absorção é feita. Resistência, vulnerabilidade, imunidade e `resist-all` se aplicam depois da absorção, ao que restar.
- `hardness`: uma referência de valor para a dureza de um combatente, quando a iniciativa é um número que os ataques movem. Veja [Armaduras e efeitos de itens vestidos numa luta](ruleset-items.md#armor-and-worn-effects-in-a-fight).

O dano de cada alvo é rolado para aquele alvo, porque o que um acerto ganhou além dos sucessos necessários, e o que o alvo absorve, são dele. A segunda cláusula de um golpe, e um efeito adicional, são cada um uma reserva de dano própria, do seu tipo, sem dados extras do acerto. O menu prevê uma reserva com exatidão: a chance de alcançar os sucessos necessários e quanto valem os dados de dano depois do que o primeiro alvo absorve.

Gravewatch é escrito assim: seus guardiões rolam uma pontuação e um ofício, absorvem pancadas com Sinew e não absorvem rasgos, podem gastar um ponto de Resolve por turno e rolam a iniciativa de novo a cada rodada.

**Declarar em ordem inversa não está implementado.** Alguns sistemas fazem todos declararem sua ação antes de qualquer um agir, do mais lento ao mais rápido. Numa luta em que cada combatente escolhe uma ação quando chega seu turno, declarar primeiro não muda nada que alguma regra leia, então não há nada que uma chave possa dizer.

<a id="a-fight-thrown-in-symbol-dice-symbol-pool"></a>

### Uma luta com dados de símbolos: `symbol-pool`

Um conjunto `symbol-pool` lê símbolos em vez de números, e suas lutas também podem fazer isso, então o Engine conduz a luta inteira sem perguntar ao Game Master o que uma vantagem comprou. `"kind": "symbol-pool"` exige que `resolution.kind` seja `"symbol-pool"` e lê a ficha como seus testes de símbolos já fazem:

- Um número para acertar representa os dados do atacante. A partir de uma ficha, o número de uma linha de ataque representa em conjunto seu atributo e as graduações de sua perícia: o maior é quantos dados são rolados e o menor é quantos deles são aprimorados, como `pool.build: "larger-upgraded"` monta um teste. Uma ação de criatura o diz como `toHit` (seus dados) e `upgrades` (quantos deles são aprimorados), o que exige uma reserva com um dado `upgrade` que não seja montada por `sum`.
- `defense` é quantos dados de dificuldade são rolados contra os do atacante. A `defense` de uma criatura é seu próprio número deles. A cobertura e o modificador de uma condição em `defense` acrescentam dados de dificuldade.
- O modificador de uma condição em ataques, salvaguardas ou testes, e a penalidade de ferimentos que seu `penaltyFrom` nomeia, são dados de impulso quando ajudam e de revés quando atrapalham, então são números `flat`: um modificador rolado (`dice`) é recusado. Uma rolagem que pende para um lado (longo alcance, a desvantagem de uma condição) rola mais um dado de revés, ou mais um dado de impulso quando pende para o outro lado.
- Sucessos líquidos (a quantidade em `success.needed`) acertam um golpe. O número de uma salvaguarda representa seus dados, e sua dificuldade representa os dados contra eles; uma disputa rola os dados de cada lado, e vence quem tiver mais sucessos líquidos. A iniciativa pode ser rolada como reserva (`initiative.pool`): seus sucessos líquidos são o número.
- O dano é somado como numa luta `attack-vs-defense`. Cada sucesso líquido soma `damage.perSuccess` (um) a um acerto, todo sucesso (`"counts": "all"`) ou só aqueles além dos que um acerto exige (`"beyond"`), e a absorção do alvo é retirada do golpe inteiro, nunca abaixo de zero.
- Nada falha criticamente e nada dobra uma rolagem de dano. Um crítico é algo que um gasto compra.

O que os símbolos fazem é definido pelo bloco `symbols`:

```json
"symbols": {
  "damage": { "perSuccess": 1, "counts": "all" },
  "soak": { "all": { "derived": "soak" } },
  "spends": [
    { "id": "boost", "label": "Boost an ally", "by": "attacker", "symbol": "a", "cost": 1, "boost": { "dice": 1, "on": "attacker-ally" } },
    { "id": "crit", "label": "Critical", "by": "attacker", "symbol": "a", "cost": 2, "when": "hit", "critical": true, "condition": { "id": "injured", "on": "target", "rounds": 3 } },
    { "id": "triumph", "label": "Triumphant blow", "by": "attacker", "symbol": "t", "cost": 1, "when": "hit", "critical": true, "damage": 2 },
    { "id": "strain", "label": "Overextend", "by": "target", "symbol": "h", "cost": 2, "track": { "id": "strain", "by": 1, "on": "attacker" } },
    { "id": "setback", "label": "Opening", "by": "target", "symbol": "h", "cost": 1, "setback": { "dice": 1, "on": "attacker" } },
    { "id": "despair", "label": "Weapon slips", "by": "target", "symbol": "d", "cost": 1, "condition": { "id": "disarmed", "on": "attacker" } }
  ]
}
```

- `soak`: o que um alvo retira de cada acerto, lido de sua ficha. `all` é uma referência de valor para qualquer tipo de dano, e `byKind`, uma por tipo da sua trilha de saúde, que prevalece sobre `all` para seu tipo. Uma criatura informa o próprio valor como `soak: { "all": 2 }`, o que exige que este `soak` seja declarado.
- `spends`: até 16 coisas que um símbolo restante na rolagem de um ataque compra. A quantidade `cost` de `symbol` a compra uma vez, e `max` (um) diz quantas vezes uma rolagem pode comprá-la; um gasto que dá uma `condition` ou um `critical` se aplica uma vez, então seu `max` continua sendo um, e dois gastos não impõem uma condição (nem duas de um tipo `oneAtATime`) na mesma pessoa na mesma rolagem. Um gasto não é comprado quando não faria nada: sua condição não seria imposta (impedida, ou uma do seu tipo já está presente), ou sua trilha não tem espaço para um passo inteiro naquela direção (espaço que um gasto anterior na mesma rolagem pode ter usado). `by` diz qual lado o escolhe: o atacante gasta os símbolos que o favorecem (vantagem, triunfo), e o alvo, os que favorecem o alvo (ameaça, desespero). Cada símbolo é gasto por um único lado, e um gasto nunca é pago com os sucessos, que já acertam o golpe e somam ao seu dano.
- `when`: comprado só num `hit`, só num `miss` ou em qualquer um (`any`, o padrão). `damage` (dano somado ao acerto, antes da absorção) e `critical` (o acerto é crítico, então uma cláusula que diz `onCritical` se aplica e o registro o diz) exigem `"when": "hit"` e `"by": "attacker"`.
- O que um gasto faz, qualquer combinação de: `condition` impõe uma das suas condições a alguém, pelo número de rodadas em `rounds` ou até que algo a encerre; `track` move uma trilha viva simples em `by` (tensão, estresse), nunca a trilha de saúde; `boost` e `setback` acrescentam essa quantidade de dados à próxima rolagem que quem os recebe faz nesta luta, consumidos por essa rolagem. `on` é `attacker`, `target`, `attacker-ally` ou `target-ally`; um aliado é o próximo daquele lado a ter um turno, e um gasto que precisaria de um aliado quando não há nenhum não é comprado.
- `worth`: opcional, em quantos pontos de dano a IA avalia o gasto. Sem isso, o Engine o calcula a partir dos efeitos: dano vale seus pontos, uma condição vale dois, um dado na próxima rolagem vale um pouco mais de meio, e um passo de uma trilha vale meio, contra o outro lado, ou a favor do lado de quem escolhe quando reduz uma trilha ou acrescenta impulso ali. Um gasto que não vale nada para quem o escolhe nunca é comprado.

O Engine compra, para cada lado, os gastos que mais valem com os símbolos que ele tem, tanto para jogadores quanto para oponentes, e diz cada um no registro. Um jogador pode escolher os próprios gastos no lugar: com "Choose my own symbol spends" marcado na tela de luta, uma rolagem que deixa algo para comprar a um membro do grupo que ele controla espera enquanto ele escolhe gastos um a um, aceita a escolha do Engine para o restante ou não gasta mais nada. A escolha segue as mesmas regras que a do Engine (custo, `max`, `when` e o que se aplicaria), e o Engine continua escolhendo para todos os outros. Um conjunto não precisa de nada para isso. Símbolos que ninguém gasta permanecem na rolagem para o Game Master narrar. A previsão do menu conta todas as formas como a rolagem pode sair: a chance de acertar e o dano que um acerto causa com seus sucessos e gastos, depois da absorção. A IA avalia cada ataque por isso, descontando o que os gastos do outro lado lhe custariam.

**O que fica com o Game Master.** O custo de um gasto é do conjunto, não de cada arma, então uma arma com sua própria pontuação de crítico é escrita como um gasto que o conjunto compartilha; a tabela própria de um crítico cabe ao Game Master rolar. Vantagem numa salvaguarda, num teste ou numa disputa não compra nada: só a rolagem de um ataque é gasta. Aprimorar os dados de dificuldade numa luta não foi implementado.

### Dados mínimos de dano

Uma luta de reserva pode manter dados mesmo contra uma absorção alta, como faz o **Overwhelming** de Exalted:

```json
"damage": { "minimum": { "derived": "overwhelming" } }
```

Isso é `combat.damage.minimum`, uma referência de valor lida da ficha atual do **atacante**. Depois que a absorção fixa tira dados da primeira reserva de dano de um acerto, a reserva é elevada a pelo menos esse número. São dados inteiros, arredondados para baixo e limitados entre zero e `resolution.pool.max`, não sucessos automáticos: todo dado que sobra pode falhar. A absorção rolada ainda tira sucessos depois da rolagem de dano; ela não reduz uma reserva de dados, então o mínimo não protege os sucessos dela. Resistência e imunidade continuam valendo. Golpes que gastam iniciativa ignoram o mínimo, assim como ignoram o dano da arma e a absorção; golpes que tomam iniciativa o usam.

Uma arma pode substituir o mínimo comum com `item.attack.damage.minimum`. Ele aceita as mesmas referências de valor de quem a empunha, ou `{ "stat": "overwhelming" }` para uma das estatísticas numéricas do próprio item. Um zero declarado também substitui o mínimo comum. Isso é diferente do `floor` de arma existente, que garante uma quantidade de dano depois da absorção. Cláusulas de dano extras e efeitos adicionais não recebem outro mínimo. Os dados salvos da luta e o registro mostram o mínimo resolvido ao lado dos dados. Tanto a chave de combate quanto a chave de arma exigem **Capability API 1.146** num pacote, inclusive para armas em arquivos de catálogo externos.

### Um acerto que atordoa

```json
"daze": {
  "over": { "abilityScore": "stamina" },
  "measure": "damage",
  "condition": "dazed",
  "text": "The blow leaves them reeling until their next turn passes."
}
```

`combat.daze` serve para lutas de reserva. `over` lê a ficha atual do **alvo**, imediatamente antes do acerto. Um único acerto precisa causar **estritamente mais** dano do que esse número, depois da absorção, das salvaguardas e da resistência. As cláusulas de dano dele contam juntas; acertos separados nunca se acumulam para atordoar. Numa trilha que marca por golpe, um acerto que causa dano conta como um nível. Um golpe que toma iniciativa em vez de saúde não pode atordoar. `measure` hoje só pode ser `"damage"`.

O alvo perde exatamente o próximo turno. Outros acertos que atordoam antes desse turno não acumulam turnos perdidos a mais. O turno perdido ainda faz avançar os relógios das condições e o resto da contabilidade do turno, inclusive as mudanças de rodada e a iniciativa rolada de novo. Salvar e recarregar a luta preserva o turno perdido pendente. `condition`, quando presente, nomeia uma condição declarada da ficha. A luta a marca até o turno perdido passar, ou até a luta terminar. Uma condição que já está presente fica onde está; a imunidade à condição impede a marca, mas não impede a perda do turno. `text` é uma narração opcional, não outro efeito. O registro e o contexto da luta do Game Master registram o acerto e o turno perdido. A chave exige **Capability API 1.147**.

### O alvo escolhe o tipo de ferimento

Acrescente `remap` ao mapeamento `combat.damageKinds` existente; mantenha seus `default`, `byType` e `marks`:

```json
"damageKinds": {
  "default": "bashing",
  "byType": { "bullet": "lethal", "fire": "aggravated" },
  "marks": "per-point",
  "remap": [
    { "when": { "field": "vampire" }, "from": "lethal", "to": "bashing", "tags": ["firearm"] }
  ]
}
```

Uma luta de reserva primeiro escolhe o tipo do ataque pelo mapeamento comum e depois lê o `when` de cada remapeamento no **alvo**. Um número diferente de zero ativa a regra. `from` e `to` precisam ser os dois tipos da trilha de ferimentos de saúde. A primeira regra que corresponde vence; os remapeamentos não se encadeiam. Podem ser dados no máximo 12. Com `tags`, pelo menos uma precisa corresponder ao ataque: uma arma já leva `item.tags`, e as mecânicas de catálogo e o dano de criatura já levam `qualities`. Esses nomes vêm de `items.tags`. Sem `tags`, qualquer ataque desse tipo pode corresponder. Nenhum campo novo de tag de ataque é necessário.

O tipo resultante decide tanto a **absorção** quanto as marcas de ferimento. Assim, o acerto letal de uma arma de fogo pode virar contundente contra um vampiro e usar a absorção de contundente; a mesma arma de fogo contra outra pessoa, ou uma lâmina contra esse vampiro, mantém o tipo comum. O _tipo_ de dano original do ataque não muda para resistência e imunidade. Cada cláusula de dano usa o próprio tipo e as tags do ataque. Os dados salvos da luta e o registro mostram os tipos original e remapeado, e a previsão de dano lê a mesma regra. Uma criatura simples sem ficha pode satisfazer uma referência constante, mas não pode fornecer valores de ficha para essas regras; dê a ela uma ficha de criatura para isso. Só a nova chave `remap` exige **Capability API 1.148**; os mapeamentos de tipo de dano mais antigos mantêm a compatibilidade atual.

### Iniciativa que os ataques movem

Alguns sistemas de reserva mantêm a iniciativa como um número durante a luta inteira e deixam os ataques movê-lo: uma forma de atacar a tira do alvo, outra gasta a do próprio atacante como dano, e quem cai até uma linha definida entra em colapso. Uma luta `dice-pool` pode declarar isso (Capability API 1.48):

```json
"initiative": {
  "pool": { "abilityMod": "nerve" },
  "plus": 3,
  "resource": {
    "base": 3,
    "styles": [
      { "id": "press", "label": "Press", "takes": { "gain": 1 } },
      { "id": "telling", "label": "Telling blow", "spends": { "onMiss": [[0, 1], [6, 2], [11, 3]] } }
    ],
    "crash": { "at": 0, "condition": "reeling", "bonus": 5, "recoverAfter": 3 }
  }
}
```

- **A abertura.** Todos rolam `pool` dados quando a luta começa, e os sucessos mais `plus` são o seu número; por isso `resource` exige `pool`: dados somados são uma ordem, não uma quantidade de dados. O `initiativeModifier` de uma criatura é sua reserva, já que todo número que uma luta de reserva soma é em dados. O número é mantido: nunca é rolado de novo (`each` é recusado ao lado de `resource`), e no início de cada rodada a ordem é organizada pelos números como estiverem.
- **Estilos.** Todo ataque (uma linha de ataque, uma habilidade ou entrada de catálogo que rola para acertar e causa dano, uma ação de criatura que faz isso e uma ação feita de outras ações) é oferecido uma vez por estilo, e o jogador escolhe o estilo antes do alvo. Até quatro, cada um toma ou gasta, e pelo menos um toma. Uma escolha que não nomeia estilo é feita no primeiro; uma num estilo em que o ataque não é oferecido é recusada. Um ataque mantém o estilo em que foi feito até terminar, mesmo quando uma resposta muda o número de quem o fez antes que ele acerte.
- **Um estilo que toma.** Num acerto, o dano é rolado como de costume (os dados extras do acerto, os dados da arma, a absorção por tipo, os sucessos automáticos), e o que ele conta sai do número do alvo em vez da saúde dele. O atacante ganha tudo isso mais `gain`.
- **Um estilo que gasta.** Oferecido só enquanto o número do atacante está acima da linha de colapso (0 quando você não define `crash`), e nunca para uma ação feita de outras ações, já que um número é gasto num único golpe. Num acerto, o dano é o número do atacante no momento do ataque, em dados contra o alvo de dano, e nada mais: sem dados da arma, sem dados extras do acerto, sem sucessos automáticos, sem absorção. Ele marca a saúde pelo próprio tipo de dano do ataque. Quando o ataque termina, um número que acertou alguém volta para `base`, e um que não acertou ninguém perde o que `onMiss` diz para o número com que foi feito (uma tabela de patamares: pares `[at least, lose]`, em ordem crescente; nada abaixo do primeiro patamar).
- **Colapso.** Um número que cai até `crash.at` ou abaixo entra em colapso: a `condition` (uma das suas, e opcional) é imposta a quem o tem, e quem o levou até ali ganha `bonus`. Um erro que leva o próprio autor ao colapso não dá bônus a ninguém. Um combatente em colapso não pode gastar. O colapso termina, com condição e tudo, quando o número dele volta a ficar acima da linha, depois de `recoverAfter` dos próprios turnos (o número volta para `base` no início desse turno) e quando a luta termina, seja como for. Quem tem a rolagem de abertura na linha ou abaixo começa a luta em colapso. `base` precisa ficar acima de `crash.at`, ou voltar a ela causaria um novo colapso.

O menu mostra a previsão de cada estilo: a chance de acertar e o que um estilo que toma tomaria ou o dano que um que gasta causaria. O painel de status mostra o número de todos, e o registro diz cada mudança e o motivo: "Ada gains 5 initiative for crashing Rats, and is on 14." O seletor do Engine avalia um golpe que toma com um turno de antecedência: tomar e depois gastar, contra gastar agora e de novo a partir da base.

<a id="what-a-fight-reads-from-mechanics"></a>

### O que um combate lê de `mechanics`

`kind` determina se `amount` é dano ou cura; qualquer entrada marcada como `reaction` fica fora do menu, assim como uma entrada `utility`, a menos que ela mude o que o próprio turno pode conter (veja abaixo). `attackRoll` faz uma rolagem contra a defesa do alvo com o `toHit` da lista; `autoHit` pula isso inteiramente. `save` rola a salvaguarda do próprio alvo contra a `saveDifficulty` da lista, e `onSuccess` determina se um sucesso recebe metade ou nada. `targetCount` indica quantos alvos ela pode atingir. Uma habilidade que não rola ataque (uma área contra a qual todos fazem salvaguardas, algo que simplesmente acerta) rola seus dados UMA VEZ para todos eles; uma que rola para acertar cada alvo rola seus dados novamente a cada acerto. `applies` impõe condições ao que afeta, cada uma com uma `duration` de `instant` (sem relógio próprio: permanece até que algo a remova), `until-save` (que precisa de `saveEnds` ao lado) ou `{ "rounds": n }`, e um `saveEnds` opcional que nomeia a salvaguarda e indica se ela se repete em `turn-end` ou `turn-start`. As rodadas contam os próprios turnos de quem a porta, diminuindo ao fim de cada um; `{ "rounds": 1, "at": "turn-start" }` as conta no início de cada um, que é como se diz até o início do seu próximo turno. `"of": "source"` (Capability API 1.119) conta os turnos de quem a impôs, a partir do próximo dessa pessoa, que é como se diz "até o fim do seu próximo turno" a respeito de outra pessoa. O `{ "duration": { "rounds": 1, "of": "source" }, "endsAfter": "attacked" }` de Guiding Bolt dá vantagem à próxima rolagem de ataque contra o alvo antes do fim do próximo turno do conjurador. Se a origem sair da luta, as rodadas passam a contar nos turnos do próprio portador. O `delays` de uma condição de combate (Capability API 1.120) adia o que quem a porta usa: uma ação de um dos seus `catalogs`, paga com o `budget` dela, rola um dado de `chance.sides` e, com `chance.atLeast` ou mais, ainda não acontece. No início do próximo turno de quem a porta, ela é concluída com esse mesmo orçamento e segue como teria seguido, com respostas e tudo, e se a pessoa não puder agir ou não tiver nada desse orçamento, ela se perde. O que ela custou continua gasto de qualquer forma. O Slow de 5e é `"delays": { "catalogs": ["spells"], "budget": "action", "chance": { "sides": 20, "atLeast": 11 } }`. `endsAfter` remove a condição depois do primeiro `own-attack` (a próxima rolagem de ataque de quem a porta), `attacked` (a próxima rolagem de ataque feita contra quem a porta) ou `own-save` (a próxima salvaguarda de quem a porta), diga o que disser o relógio dela; assim, `{ "duration": { "rounds": 1 }, "endsAfter": "own-attack" }` significa no próximo ataque, antes do fim do próximo turno. Uma condição que dura um ataque dura o ataque inteiro, inclusive o dano, e uma nova que o mesmo golpe impõe permanece. Ambos exigem Capability API 1.45. `temporary` concede pontos temporários à reserva de saúde, e eles nunca se acumulam: permanece a maior proteção. `scales` aumenta a quantidade pelos DADOS extras que sua tabela indica para o valor lido. `cost` é pago pelo comando `use` da própria ficha, e `budget` substitui qual parte da economia é gasta.

`plus` contém até três quantidades A MAIS no mesmo golpe, ao lado de `amount`, cada uma com sua própria rolagem e tipo ("and 2d6 fire"). Uma cláusula é `{ "dice": "2d6", "flat": 1, "type": "fire" }` e pode carregar sua própria `save`, `{ "save": "con_save", "difficulty": 13, "onSuccess": "none" | "half" }`, que o ALVO rola independentemente do que a ação já lhe pediu: `none` elimina toda essa cláusula em um sucesso e `half` deixa metade, enquanto o restante do golpe permanece intacto nos dois casos. Sem `difficulty`, ela recorre ao número usado pela salvaguarda da própria ação e, depois, à `saveDifficulty` da lista. Um crítico dobra os dados de cada cláusula pela mesma regra que dobra os da primeira quantidade; uma cláusula sem `type` usa o tipo de dano do próprio golpe, e o golpe inteiro continua sendo UM teste de concentração, com o dano somado, e um teste para cair. Uma cláusula precisa de um `amount` para acompanhar, e um `heal` não carrega nenhuma.

```json
{
  "kind": "attack",
  "attackRoll": true,
  "amount": { "dice": "1d8" },
  "damageType": "piercing",
  "plus": [{ "dice": "2d6", "type": "fire" }]
}
```

Três chaves dizem o que uma entrada faz com a economia do próprio turno, e uma entrada `utility` que declara qualquer uma delas é oferecida em vez de descartada:

- `free`: não custa orçamento algum. Ainda paga o `cost` que indicar e não pode também indicar um `budget`.
- `gives`: `[{ "budget": "action", "count": 1 }]`, até quatro. Usá-la adiciona a esses orçamentos imediatamente, com limite igual ao que um turno comporta mais a concessão, para que nada possa ser guardado para um turno posterior.
- `standard`: `{ "actions": ["dash", "disengage", "hide"], "budget": "bonus" }`. Seu portador pode executar essas ações padrão com ESSE orçamento. Elas são oferecidas ao lado das comuns como `standard:<id>@<budget>`, e a própria entrada fica fora do menu quando é apenas essa permissão, pois uma permissão não é algo que alguém execute.

Uma entrada do novo `kind: "rider"` é PASSIVA: ninguém a executa, ela nunca aparece no menu e adiciona automaticamente mais uma cláusula de dano ao primeiro acerto qualificado de um período. Ela carrega `rider` e nada mais que possa ser executado:

```json
{
  "kind": "rider",
  "rider": {
    "on": "hit",
    "sources": ["attacks"],
    "requires": { "column": "finesse" },
    "when": ["advantage", "ally-adjacent-no-disadvantage"],
    "oncePer": "turn",
    "amount": { "dice": "1d6" }
  },
  "scales": {
    "from": { "field": "level" },
    "table": [
      [1, 0],
      [3, 1]
    ]
  }
}
```

`sources` nomeia as listas de ataques de onde ela vem e `requires` uma coluna verdadeira de suas linhas, de modo que um efeito adicional que só dispara com certas armas pode especificá-las sem que o Engine saiba o que é uma arma; não nomear nenhum significa qualquer acerto de seu portador. Uma arma empunhada tirada da bolsa não é uma linha, então `weapons` (Capability API 1.70) também nomeia as tags de item com que ele dispara: `"weapons": { "tags": ["finesse",
"ranged"] }` dispara num acerto com uma arma empunhada que tenha qualquer uma das tags, inclusive o golpe com a mão inábil. Nomear só `weapons` não dispara com nenhuma linha, e nomear só linhas não dispara com nenhuma arma empunhada. `when` aceita QUALQUER das opções: `advantage` é a inclinação final da rolagem de ataque, e `ally-adjacent` é um aliado do atacante que esteja de pé e possa agir, a uma célula do alvo em um tabuleiro ou em qualquer lugar sem tabuleiro. `ally-adjacent-no-disadvantage` (Capability API 1.126) também exige que a rolagem final não esteja com desvantagem depois que vantagem e desvantagem se anulam; o exemplo acima o usa para Sneak Attack. `oncePer` é `turn` (renovado no começo de todos os turnos, de modo que um golpe desferido enquanto outra pessoa age ainda pode carregar um) ou `round`. `amount` cresce com o `scales` da própria entrada, e `type` é o tipo de dano, por padrão o do próprio golpe.

<a id="creatures-a-bestiary-a-fight-reads"></a>

### Criaturas: um bestiário que o combate lê

Um catálogo que declara `"holds": "creatures"` contém oponentes em vez de linhas de ficha. Ele não alimenta nenhuma lista, o seletor do editor de fichas nunca o oferece e todos os seus números usam as chaves que seu bloco `combat` já declara. Ele precisa de um bloco `combat` e de uma escala `threat`, pois uma criatura é classificada em um dos seus próprios níveis.

```json
{
  "id": "road_trouble",
  "label": "Road trouble",
  "holds": "creatures",
  "filters": [{ "id": "tier", "label": "How bad", "type": "text" }],
  "entries": [
    {
      "id": "rust-jackal",
      "label": "Rust Jackal",
      "summary": "A lean thing that lives on the metal roads.",
      "filters": { "tier": "Pack trouble" },
      "creature": {
        "health": { "dice": "3d6" },
        "defense": 6,
        "initiativeModifier": 1,
        "speed": 16,
        "abilities": { "brawn": 1, "wits": 0, "heart": -1 },
        "tier": "pack",
        "actions": [
          {
            "id": "bite",
            "name": "Bite",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d6", "flat": 1, "type": "cut" },
            "reach": 2
          },
          {
            "id": "worry",
            "name": "Worry",
            "budget": "act",
            "toHit": 2,
            "damage": { "dice": "1d4", "type": "cut" },
            "applies": [{ "condition": "shaken", "duration": { "rounds": 2 } }]
          },
          {
            "id": "snap_and_worry",
            "name": "Snap and worry",
            "budget": "act",
            "sequence": [
              { "action": "bite", "times": 1 },
              { "action": "worry", "times": 1 }
            ]
          }
        ]
      }
    }
  ]
}
```

Os números abaixo são a maneira direta de escrever uma criatura. Uma escrita nos termos do seu próprio conjunto de regras, como `sheet`, obtém `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves`, `checks`, `soak` e `hardness` dessa ficha (veja "Uma criatura escrita nos termos do seu conjunto de regras", abaixo).

- `health`: um número, ou `{ "dice": "3d6", "flat": 2 }`, rolado uma vez quando o combate é criado. Uma previsão lê a média, para que um menu nunca prometa um dado que ninguém rolou.
- `defense`, `initiativeModifier`, `speed`: contra o que um ataque é rolado, o que é somado à iniciativa (ou, quando a iniciativa é rolada como reserva, quantos dados ela rola) e quanto ela anda em um turno, na sua própria unidade de distância.
- `abilities` e `saves`: usam como chaves os identificadores de atributos e salvaguardas que sua ficha declara. Uma salvaguarda ausente é lida como zero.
- `checks`: o que ela soma numa disputa, com os IDs de `combat.checks` como chaves. Um que ela não nomeia é lido como zero. Capability API 1.43.
- `soak`: só numa luta `dice-pool`, o que ela absorve: `all` para qualquer dano, `byKind` para um tipo da sua trilha de saúde. Capability API 1.47.
- `hardness`: quando a iniciativa é um número que os ataques movem, um golpe que gasta cujos dados ficam abaixo dela não faz nada. Capability API 1.56.
- `speeds` e `hover`: como ela se move além de andar (veja Outras formas de se mover, em Posições). Capability API 1.113.
- `shield: true`: as mãos dela estão ocupadas, então a alternativa `twoHanded` de uma ação não vale. Capability API 1.102.
- `size`: um dos `combat.sizes`, pelo ID, que o `maxSizeAbove` de uma disputa lê (veja Tamanhos e CDs de fuga). Capability API 1.103.
- `type` e `tags`: um dos `combat.creatureTypes.types` e até oito das `tags` dele, pelo ID, que os testes de alvo leem (veja Tipos de criatura e testes de alvo). Capability API 1.168.
- `resist`, `vulnerable`, `immune`: tipos de dano, comparados sem distinguir maiúsculas, e validados contra `combat.damageTypes` quando você declara algum. Uma entrada `resist` ou `immune` também pode dizer o que a atravessa, `{ "type": "tearing", "except": ["silver"] }`: um golpe de uma arma que tenha uma dessas tags de item é recebido por inteiro (Capability API 1.55, veja [Armas numa luta](ruleset-items.md#weapons-in-a-fight)), assim como uma ação cujo `damage.qualities`, ou uma entrada de catálogo cujo `mechanics.qualities`, nomeie uma delas (Capability API 1.101). `conditionImmunities` nomeia suas próprias condições, ou uma trilha que seus `combat.levels` leem (Capability API 1.115).
- `tier`: a qual degrau de `combat.threat` ela pertence.
- `loot` (Capability API 1.63): o ID da tabela de loot que uma luta vencida rola para ela (veja [Loot](ruleset-items.md#loot)).
- `inventory` (Capability API 1.795): o que ela pode carregar quando uma luta começa, até 16 linhas. Cada linha nomeia um dos seus itens (`item`, como `<catalog>/<entry>`) ou uma das suas tabelas de loot (`table`), com `chance` (em cem, padrão 100) e `count` (um número ou dados, padrão 1; uma tabela é rolada essa quantidade de vezes). Ela usa o que pode na luta: uma criatura com uma `sheet` usa seus itens como um membro da equipe, e um bloco de estatísticas simples usa um item cujo `use` se esgota ao ser usado e não lê nada de quem o usa (uma poção, um óleo). O que sobra cai quando ela é derrotada, junto com seu `loot`; uma que foge leva tudo consigo. O Game Master pode, em vez disso, dar a um oponente um inventário próprio (`carrying` no encontro), que substitui essas linhas.
- `traits`: pares curtos de nome e texto mostrados ao Game Master. Nunca são resolvidos; portanto, qualquer coisa com números pertence a uma ação.
- `signaturePoints`: pontos devolvidos no início do próprio turno, gastos em ações `signature`.
- `riders`: até quatro, iguais ao `rider` de uma entrada de catálogo, escritos no bloco. Cada um é `{ "id": "pack", "name": "Pack", "on": "hit", "oncePer": "turn" | "round", "amount": { "dice": "1d6" } }`, com um `type` opcional e um `actions` opcional que nomeia em quais ações do próprio bloco ele dispara. O efeito adicional de um bloco não lê listas de ficha; por isso, `sources` e `requires` são as duas chaves que ele não possui. Uma criatura escrita como ficha recebe os efeitos adicionais de suas listas, exatamente como um personagem.
- `actions`: até doze, cada uma com seu próprio `id`. Uma ação carrega o que um bloco de estatísticas escrito à mão carrega (`toHit`, `autoHit`, `damage`, `save`, `applies`, `targetCount`, `reach`, `range`, `area`), mais quatro coisas exclusivas das criaturas. `reach` indica até onde ela golpeia, `range` até onde é arremessada ou disparada e `area` a forma em que atinge, tudo na sua própria unidade de distância; `range` pode ser um número simples ou `{ "normal": 30, "long": 120 }` quando ainda alcança mais longe com uma penalidade, e `area` é `{ "shape": "burst" | "cone" | "line", "size": n, "friendlyFire": false }` (veja Posições):
  - `uses`: `{ "per": "encounter" | "day", "count": n }`. Quando se esgotam, a ação sai do menu.
  - `recharge`: `{ "dice": { "count": 1, "sides": 6 }, "from": 5 }`. Ela começa o combate disponível, é gasta ao ser usada e rola no início do próprio turno da criatura: `from` ou mais a recupera. O registro contém os dados nos dois casos.
  - `damage.alternatives` (Capability API 1.102): até quatro quantidades que ela causa no lugar da primeira, cada uma `{ "when": ..., "dice": "1d10", "flat": 3 }`, vencendo a primeira que valer. O tipo, as cláusulas e as qualidades continuam sendo os da ação. `"when": "twoHanded"` vale a menos que a criatura tenha `"shield": true`, que é o "or 8 (1d10 + 3) slashing damage if used with two hands" de 5e; `"when": { "selfHealthAtMost": 0.5 }` vale enquanto a saúde dela for no máximo essa fração do máximo, que é o "or 5 (2d4) piercing damage if the swarm has half of its hit points or fewer" de um enxame. A previsão do menu e o golpe a leem como está.
  - `sequence`: outras ações do mesmo bloco, em ordem, cada uma com seu próprio alvo. **É assim que se escreve uma criatura que golpeia duas vezes em uma ação.** Um orçamento paga a sequência inteira. Uma sequência não carrega nada próprio e nunca pode nomear outra sequência.
  - `signature`: `{ "cost": n }`, comprada com os pontos da própria criatura em vez de um orçamento e apenas enquanto outra pessoa age: o combate a oferece na janela entre um turno e o seguinte (veja Janelas).
  - `reaction`: o mesmo objeto que o `mechanics.reaction` de uma entrada de catálogo (veja Janelas): a ação não aparece no menu de nenhum turno e é oferecida no momento que ela nomeia. Uma reação não é também uma ação característica, e nenhuma sequência pode incluir uma.
  - `self: true`: ela atinge a própria criatura em vez de outra pessoa, e por isso não aceita `targetCount` nem `area`. Ambos exigem Capability API 1.46. Um Parry é as duas coisas, com uma condição `parrying` que soma 2 à defesa:

    ```json
    {
      "id": "parry",
      "name": "Parry",
      "budget": "reaction",
      "self": true,
      "reaction": { "on": "hit" },
      "applies": [{ "condition": "parrying", "duration": { "rounds": 1 }, "endsAfter": "attacked" }]
    }
    ```

- Uma salvaguarda precisa de uma dificuldade na própria ação: `save.difficulty` para uma salvaguarda imposta pela ação, ou `saveDifficulty` para uma condição que termina com uma salvaguarda quando a ação não tem a sua própria. Uma ação de bloco é escrita com números simples mesmo em uma criatura com ficha; portanto, esse número fica na ação. A salvaguarda de uma cláusula pode omitir sua `difficulty` e recorrer ao mesmo número.
- `damage.plus` é a mesma lista de cláusulas que o `plus` de uma entrada de catálogo e é lida exatamente da mesma forma: `"damage": { "dice": "1d6", "flat": 2, "type": "piercing", "plus": [{ "dice": "1d4", "type": "fire" }] }` é uma mordida cujo calor tem sua própria quantidade, resistida e dobrada separadamente.

Uma ação de criatura pode devolver pontos de vida com `heal` (dados, um valor fixo ou os dois), limitados ao máximo do alvo. `targets: "ally"` alcança o próprio lado, inclusive a si mesma; `targets: "any"` alcança qualquer lado. Sem `targets`, ela alcança o outro lado, como antes. Essas chaves exigem Capability API 1.121. Uma cura não leva `damage`, `toHit`, `save` nem `area`; `targets` não aceita `self` nem `sequence`, e uma sequência não leva nenhuma das duas chaves. O Healing Touch de um deva é:

```json
{
  "id": "healing_touch",
  "name": "Healing Touch",
  "budget": "action",
  "heal": { "dice": "4d8", "flat": 2 },
  "targets": "ally",
  "uses": { "per": "day", "count": 3 }
}
```

O `spellcasting` de uma criatura (Capability API 1.123) conjura magias de catálogo sem gastar espaços nem pontos. Seus `saveDifficulty` e `toHit` fornecem os números da magia; uma criatura com `sheet` pode omiti-los para usar os números de conjuração da ficha. Uma criatura simples precisa fornecer todo número de que suas magias precisam. Cada `entry` nomeia uma entrada de catálogo existente com `mechanics`. `uses` omitido significa à vontade; `level` é o nível de conjuração para a escala de `perCostStep`, ou a base da entrada quando omitido. A entrada ainda fornece orçamento, alvos, concentração, reações, áreas e invocações. A lista de uma dríade poderia ser escrita assim; esses IDs de magia são ilustrativos e precisam ser fornecidos num catálogo `spells`:

```json
"spellcasting": {
  "saveDifficulty": 14,
  "spells": [
    { "entry": "spells/druidcraft" },
    { "entry": "spells/entangle", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/goodberry", "uses": { "per": "day", "count": 3 } },
    { "entry": "spells/barkskin", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/pass-without-trace", "uses": { "per": "day", "count": 1 } },
    { "entry": "spells/shillelagh", "uses": { "per": "day", "count": 1 } }
  ]
}
```

Para um coven de bruxas, acrescente `"coven": { "id": "marsh_hags", "size": 3, "within": 30 }` ao lado de `spells` e `"coven": true` em cada magia compartilhada. Essas magias só são oferecidas enquanto pelo menos três combatentes de pé do lado do conjurador tiverem esse ID de coven, cada um a até 30 unidades de distância do conjunto do conjurador, pela simples distância em células. Sem tabuleiro, todos os membros de pé contam. Os usos de cada magia são uma única reserva compartilhada nesse coven, identificada pelo ID do coven e pela entrada. Um bloco de coven exige uma magia de coven, e uma magia de coven exige o bloco; entradas duplicadas são recusadas. Uma criatura proposta pelo Game Master perde `spellcasting` ao ser ajustada, porque uma escala de ameaça não pode limitar uma lista de magias.

A cópia de um rascunho de 5e usada pelo Engine para testes, `docs/development/ruleset-5e-2014.example.json`, tem um bestiário de cinco criaturas escritas à mão, cobrindo uma sequência, uma recarga, uma salvaguarda com condição, resistências e imunidades, usos limitados, pontos de ações lendárias e uma criatura escrita como ficha. O bestiário completo do SRD é o `catalogs/creatures.json` do [pacote 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014).

#### Uma criatura escrita nos termos do seu conjunto de regras

Uma criatura não precisa ser escrita com números simples. Dê a ela uma `sheet`, com exatamente a estrutura de uma ficha de personagem, e o combate a constrói como um membro do grupo: sua saúde, defesa, salvaguardas, iniciativa, velocidade e todos os ataques e habilidades das listas são o que suas próprias fórmulas de ficha determinarem. É assim que um conjunto de regras indica que seus oponentes têm os mesmos atributos, perícias e listas que seus personagens, sejam quais forem. O Toll Warden de Ember Roads:

```json
{
  "id": "toll-warden",
  "label": "Toll Warden",
  "creature": {
    "tier": "pack",
    "traits": [{ "name": "Knows the road", "text": "It will not follow anyone past the last milestone." }],
    "sheet": {
      "abilities": { "brawn": 2, "wits": 1, "heart": 1 },
      "skills": { "sway": "trained" },
      "fields": { "calling": "Hauler", "toughness": 3 },
      "lists": {
        "gear": [{ "name": "Toll hook", "swing": "brawn", "damage": "1d6", "harm": "cut" }],
        "knacks": [{ "name": "Hold the Line", "_catalog": "knacks/hold-the-line" }]
      }
    }
  }
}
```

- **Todas as partes são opcionais**: `abilities`, `skills`, `saves`, `bonuses`, `fields` e `lists`, com os identificadores declarados pela ficha como chaves. Tudo que for omitido usa o padrão da própria ficha, exatamente como em um personagem em branco. O Grit do guardião é 9 porque seu `grit_max` soma 4, a Toughness e o Brawn dele, e sua Guard é 7 por um motivo semelhante.
- **Cada número tem uma única origem.** Uma criatura com ficha não fornece também `health`, `defense`, `initiativeModifier`, `speed`, `abilities`, `saves` ou `checks`, e o Engine recusa o arquivo se ela fizer isso. Ela pode não ter `actions` próprias, pois suas listas definem o que faz. Uma criatura sem ficha ainda fornece os três primeiros e pelo menos uma ação.
- **Ela é validada como os dados de autoria que é.** Cada identificador deve ser declarado pela ficha; uma perícia ou salvaguarda recebe um dos níveis de proficiência oferecidos para ela; um campo, pontuação, bônus ou coluna contém o que declara aceitar (um inteiro dentro do intervalo, um de seus valores e assim por diante), e uma lista não contém mais linhas do que permite. Não há parte `live`, pois o combate guarda o que a criatura gastou.
- **Uma linha pode vir de um catálogo.** `_catalog: "<catalog>/<entry>"` nomeia a entrada de onde uma linha foi escolhida, como na ficha de um personagem, e é nessa entrada que o combate lê o que a linha custa e faz. O catálogo precisa alimentar essa lista. Quando o catálogo está escrito no próprio arquivo, a entrada deve estar nele; quando tem seu próprio arquivo, uma linha que nomeia uma entrada ausente do arquivo simplesmente não dá nada à criatura. Os catálogos nomeados pelas fichas de um bestiário são carregados para o combate junto com o bestiário.
- **O que a entrada declara ao lado da ficha ainda conta**: `tier`, `traits`, `actions`, `signaturePoints`, `riders`, `resist`, `vulnerable`, `immune` e `conditionImmunities`.
- **Ela paga com suas próprias reservas.** Elas começam cheias, são gastas no que suas listas fornecem, e as formas maiores de pagamento (uma magia com um espaço superior) são oferecidas exatamente como para um membro do grupo, seja o Engine ou o Game Master quem decide por ela. Hold the Line custa Luck ao guardião.
- **Com uma trilha de ferimentos, a saúde é a trilha.** Um golpe marca a própria trilha da criatura segundo seus `damageKinds`, depois da aplicação de `resist`, `vulnerable` e `immune`, de modo que uma criatura imune a um tipo de dano não recebe nenhuma marca dele.
- **Ela continua sendo um oponente.** A zero, fica fora de combate em vez de morrer aos poucos; nunca rola contra a morte; a tela mostra o que sempre mostrou de um oponente e nada da ficha, e nada do que ela gastou é gravado de volta em outro lugar, mesmo quando um personagem compartilha seu nome.
- **Uma ficha cuja saúde total seja zero** fica fora do combate, e o registro inicial explica por quê, em vez de introduzir algo que ninguém pode ferir.
- Uma camada que remova um valor de um dos campos enumerados nunca elimina uma criatura que o use: enquanto a camada estiver ativa, esse campo usa seu padrão para a criatura, exatamente como para um personagem, e a criatura não é recusada por isso.
- Um Game Master também pode inventar uma, que fica limitada ao seu nível (veja Oponentes que ninguém escreveu).
- Um pacote que inclua uma declara Capability API 1.34.

O Toll Sergeant do rascunho de 5e é a mesma coisa em uma ficha d20: sua Armor Class, pontos de vida, salvaguardas e dois golpes por ação vêm de seus próprios campos e de sua lista de ataques.

#### Oponentes que ninguém escreveu

Quando um Game Master inventa um oponente, o Engine ajusta a proposta à sua escala `threat` antes de qualquer rolagem: a saúde fica na faixa do nível; defesa, ataque e dificuldades de salvaguarda ficam no máximo dois acima dos valores do nível; e o dano é reduzido até que a melhor rodada da criatura (sua sequência mais forte ou ação individual mais forte, medida contra um alvo) caiba no `damagePerRound` do nível. Primeiro reduz a quantidade de dados, depois a parte fixa, depois um golpe de uma sequência e só então o tamanho do dado, sem nunca reduzir nada a zero. Nomes ausentes do seu conjunto de regras são descartados: tipos de dano, condições e salvaguardas desconhecidos, e qualquer ação além das seis primeiras. Um nível que você nunca declarou recorre à base da escala. Cada alteração retorna como uma frase simples, para que o registro possa dizer o que foi feito.

Uma invenção também pode ser escrita como `sheet`, da mesma forma que uma criatura de bestiário; é assim que um mago inventado recebe espaços e magias. O Game Master vê os identificadores da ficha e o que cada um pode conter, as listas lidas pelo combate e os nomes que seus catálogos oferecem para elas, para que uma magia seja nomeada em vez de descrita: uma linha que nomeia uma entrada de catálogo, com qualquer combinação de maiúsculas, torna-se essa entrada, e os valores próprios do Game Master (como uma magia estar preparada) são aplicados por cima. A ficha é lida com tolerância, pois foi escrita por um modelo: um nome ausente do seu conjunto de regras é descartado, um valor é ajustado ao seu campo ou coluna e os números escritos ao lado da ficha não são usados.

Uma criatura inventada que não seja um chefe fica limitada ao que seu conjunto de regras lhe abre. Um filtro de catálogo com `startFrom` nomeia o campo de ficha pelo qual suas entradas são organizadas (a lista de magias do pacote 5e por `class`), e uma criatura inventada mantém apenas as entradas cujo filtro corresponde ao seu próprio valor desse campo, comparado como o seletor faz ao abrir. Assim, um Sorcerer nunca tem a lista inteira de magias, e quem não nomeia uma classe não recebe nada de um catálogo organizado por classe. As escolhas que ficaram abertas são preenchidas sem perguntar novamente ao Game Master: para cada lista cujas linhas só contam depois de escolhidas (`onlyWhen` em uma fonte de habilidades de combate), entre as entradas disponíveis que pode pagar com suas próprias reservas, cada reserva recebe um pequeno número de entradas (mais para uma criatura mais competente), assim como aquilo que pode usar à vontade. O que ela recebe depende do temperamento e da competência, os mesmos com que luta: uma criatura protetora ou de apoio busca o que sustenta seu lado; uma imprudente, dano; uma metódica ou paciente, o que detém o inimigo; e quanto mais competente for, maior a chance de carregar uma reação, uma contra-ação ou qualquer outra coisa que altere o turno. A seleção usa a semente do próprio combate, de modo que o mesmo combate sempre é preenchido da mesma maneira. Uma linha nomeada pelo Game Master de uma lista assim conta como escolhida.

Um chefe fica inteiramente a cargo do Game Master, como a exceção que pode ser: nada é retirado e nada é preenchido.

Depois, ambos ficam limitados ao seu nível:

- A saúde entra na faixa do nível pelo único campo do qual ela é lida: o máximo da reserva é esse campo ou uma `sum` com exatamente um campo (o máximo de pontos de vida de 5e, a Toughness de Ember Roads). Uma fórmula de saúde sem um campo único fica como foi escrita, e o registro informa isso. O comprimento de uma trilha de ferimentos é seu e nunca é alterado.
- Depois que a criatura é construída, defesa, ataque e dificuldades de salvaguarda ficam limitados a dois acima dos valores do nível, e o dano é reduzido até que sua melhor rodada caiba no `damagePerRound` do nível, contando o maior pagamento que ela pode fazer. Primeiro é reduzido o que um pagamento maior compra, depois os dados, a parte fixa, um golpe e só então o tamanho do dado.

Seu próprio bestiário nunca é limitado. São dados que você escreveu, portanto o Engine os aceita como estão.

### Posições: um combate no tabuleiro

Um combate acontece no teatro da mente até que seu bloco diga quanto vale uma célula do tabuleiro. Declare `distance` e ele poderá acontecer em uma grade; então movimento, alcance, distâncias, áreas, linha de visão, cobertura e golpes contra quem se afasta passam a ter significado. Cada um é um número que você escreveu; o Engine fornece o tabuleiro e nada mais.

```json
"distance": { "label": "ft", "perCell": 5 },
"ranged": { "long": "disadvantage", "adjacentFoe": "disadvantage" },
"cover": { "bonus": 2, "threeQuarters": 5, "saves": ["dex_save"], "creatures": true },
"opportunity": { "budget": "reaction" }
```

Ember Roads declara uma linha disso e nada mais; esse é o objetivo: o restante não é obrigatório.

```json
"distance": { "label": "paces", "perCell": 2 }
```

**A célula.** `distance.perCell` indica quanto da SUA unidade vale uma célula, e `label` é o nome dessa unidade. Todas as distâncias do mundo do bloco a usam: `economy.movement`, a `speed` de uma criatura, o `reach` e o `range` de uma arma e o `reach` e o `range` de uma ação de criatura. Um catálogo que declara seu próprio `units.distance` converte seus `mechanics.range` e `area.size` com seu próprio `perCell`; um que não declara usa este. Uma distância acima de zero é arredondada para a célula mais próxima, nunca para nenhuma; assim, tudo a que você deu um número alcança pelo menos uma. Zero não é uma distância curta e mantém seu próprio significado: um `mechanics.range` de 0 significa si mesmo ou toque (e tocar outra pessoa alcança a célula vizinha), e uma coluna de arma `reach` ou `range` com valor 0 em uma linha significa que essa linha não tem essa distância.

**Se o combate usa um tabuleiro.** Duas coisas precisam coincidir: seu bloco declara `distance` e a partida do jogador usa o estilo de combate Tactical. Com o estilo Classic, ou um conjunto de regras sem `distance`, o combate continua no teatro da mente: qualquer um pode mirar em qualquer um, e nada abaixo é lido.

**Quais estilos uma partida pode usar.** `combat.styles` nomeia por ID os estilos de combate que uma partida no seu conjunto pode usar: `classic`, `tactical` ou um estilo que um cliente registrou (até 8, cada um uma vez, e pelo menos um entre `classic` e `tactical`). Se omitido, todos os estilos são oferecidos, como antes. Um conjunto cujas regras precisam de um tabuleiro (áreas, alcance, cobertura, flanqueamento) diz `"styles": ["tactical"]`: o assistente New Game e as configurações da partida passam a oferecer só Tactical, então suas lutas sempre têm posições. Uma partida já salva num estilo que você não lista usa o primeiro que você lista e que o cliente consegue desenhar (o primeiro integrado que você lista, num cliente sem um estilo registrado que você lista), e não é possível criar uma partida, nem alterá-la nas configurações, para um estilo que você deixa de fora. Uma luta já em andamento mantém o estilo em que começou. A lista vale com ou sem o diretor de combate ativado, então também restringe as batalhas Classic e Tactical do próprio Marinara no seu conjunto. Um conjunto que usa `styles` exige Capability API 1.379.

```json
"combat": {
  "kind": "attack-vs-defense",
  "styles": ["tactical"],
  "distance": { "label": "feet", "perCell": 5 }
}
```

**O que o jogador vê.** O tabuleiro é desenhado com o terreno do próprio estilo tático. Cada quadrado é um botão, acessível pelo ponteiro ou pelas teclas de direção, e informa o que é, quem está nele e o que a escolha parcialmente feita significa para ele. Caminhar ilumina os quadrados oferecidos pelo menu, cada um com seu custo NA SUA UNIDADE, desenha o caminho e marca em âmbar qualquer quadrado cujo caminho provocaria um golpe de alguém, nomeando essa pessoa abaixo do tabuleiro. Uma opção que recebe um alvo ilumina quem pode ser escolhido, no tabuleiro e na lista ao mesmo tempo. Uma opção com `area` mira em um quadrado, e o quadrado sob o ponteiro informa quem seria atingido, incluindo aliados. O restante do deslocamento permitido aparece ao lado dos orçamentos, também na sua unidade. A tela não mede nada: cada quadrado, custo, caminho, alvo e ponto de mira é enviado pelo servidor.

**Movimento.** O deslocamento permitido de um turno é `economy.movement` para um membro do grupo, ou a `speed` da própria criatura, dividido por `perCell` e arredondado PARA BAIXO, nunca menos de uma célula enquanto ela puder se mover. Ele é reposto no início do próprio turno de seu portador e pode ser gasto antes, entre e depois das ações: caminhar, golpear, caminhar de novo. Entrar em uma célula custa um, ou mais em terreno difícil. Oito direções, todas com o mesmo custo, pois é assim que se jogam as grades de RPG de mesa a que isso se destina. É possível passar por um aliado, mas não parar sobre ninguém; um oponente é uma parede; não se pode entrar em nada sólido nem cortar um canto entre duas células sólidas.

**Outras formas de se mover** (Capability API 1.113). Os `speeds` de uma criatura dão como ela se move além de andar, `{ "fly": 60, "swim": 30, "climb": 30, "burrow": 20 }` na sua unidade, e `"hover": true` diz que um voador não precisa se mover para continuar no ar (exige uma velocidade `fly`). As de um membro do grupo vêm da ficha por `economy.movementModes`, referências de valor com as mesmas chaves, como seriam a velocidade de natação de uma raça ou a velocidade de voo de uma magia; um zero significa que ele não se move dessa forma. `speed` e `economy.movement` continuam sendo a caminhada. Num tabuleiro:

- o deslocamento permitido é o da forma mais rápida com que eles se movem, e cada célula percorrida sai de todas as formas ao mesmo tempo, então uma criatura que anda 30 e voa 60 pode andar 10 e depois voar 40, e nunca andar mais que 30;
- um voador entra em qualquer lugar que não seja sólido por uma célula, inclusive água e um degrau de qualquer altura;
- um nadador atravessa água por uma célula e anda em terra;
- um escalador sobe um degrau de qualquer altura pelo custo do terreno em que pisa;
- a velocidade de um escavador fica registrada para o Game Master e se move como uma caminhada, já que um tabuleiro não tem chão para escavar túneis.

Cada passo é dado da forma mais barata que ainda tenha deslocamento suficiente. Uma luta sem tabuleiro não lê nada disso, e quem só anda se move exatamente como antes.

**Altura de voo** (Capability API 1.114). Num tabuleiro cujo conjunto dá `combat.elevation.levelHeight` e `combat.distance.perCell`, um voador recebe as opções Fly up e Fly down onde está, cada uma custando o equivalente a um nível do seu voo (um nível de 5 pés em células de 5 pés é uma célula). Até 20 níveis acima do chão sobre o qual está. Enquanto está no alto:

- ele só voa, uma célula por passo sobre qualquer coisa que não seja sólida;
- a distância entre ele e qualquer outra pessoa é a maior entre a distância plana e a altura entre os dois, então uma espada com 5 pés de alcance não toca um dragão a 30 pés de altura, e a mordida dele também não toca o cavaleiro;
- ele tem o terreno elevado sobre qualquer um abaixo, como uma colina lhe daria;
- sair do alcance de alguém para quem ele está alto demais não provoca golpe;
- derrubado, deixado caído ou com a velocidade reduzida a zero, ele cai no chão abaixo como `falling` diz, a menos que tenha `hover`.

Voar até um terreno tão alto quanto ele está, ou mais, o faz pousar, como um voador no chão voa até um penhasco. Nenhuma chave nova: um Engine anterior à 1.114 mantém os voadores no chão, então um pacote que depende de altura declara 1.114.

**No ar** (Capability API 1.354). Em qualquer tabuleiro, estar no ar é um estado próprio de cada voador: um sem caminhada, ou com `hover`, começa no ar; um no chão decola com a ação gratuita Take off, voando para cima ou dando um passo que só seu voo permite (sobre água, ou onde voar custa menos que caminhar), e desce com a ação gratuita Land (só um com caminhada) ou quando é deixado caído, derrubado ou tem a velocidade reduzida a zero, a menos que paire. Voar para baixo até o chão o mantém no ar à altura do chão até pousar. A arte da criatura é sua arte de voo enquanto ela está no ar. Nada mais nas regras lê esse estado ainda.

**Alcance e distância.** Uma linha de arma os obtém de `combat.attacks[].reach` e `.range`, cada um sendo uma coluna da mesma lista ou o mesmo número em todas as linhas:

```json
"attacks": [
  {
    "list": "attacks",
    "budget": "action",
    "name": "name",
    "toHit": { "ability": { "column": "ability" } },
    "damage": { "dice": { "column": "damage" } },
    "reach": { "column": "reach" },
    "range": { "normal": { "column": "range" }, "long": { "column": "long_range" } }
  }
]
```

Uma coluna com valor 0 em uma linha indica que essa linha não possui tal distância; assim, uma espada comum pode estar na mesma lista que um machado de arremesso. Uma linha sem alcance chega a uma célula. Uma ação de criatura usa seu próprio `reach` ou `range`, e uma habilidade de catálogo usa `mechanics.range` (0 significa si mesmo ou toque, equivalente a uma célula quando mira em outra pessoa).

Uma linha com AMBOS é uma arma de arremesso: dentro do alcance, é um golpe; além dele, um disparo. Portanto, as regras abaixo para disparos não a afetam na mão de alguém, e ela serve para golpear quem passa, algo que um arco não faz.

Uma ação de criatura também pode carregar a `area` em que atinge, na sua própria unidade: `{ "shape": "cone",
"size": 15 }`, com `"friendlyFire": false` para poupar seu lado. É assim que uma arma de sopro se torna um cone real no tabuleiro em vez de um número de alvos. Uma sequência não tem forma própria; as ações que nomeia têm as suas. Um combate sem tabuleiro ignora a forma e usa `targetCount`, de modo que uma entrada de criatura pode carregar ambos e ser fiel nos dois casos.

**Até onde uma forma pode ser enviada.** `range` informa isso: uma bola lançada a cem pés possui um. Sem distância, uma explosão ocorre onde é colocada, na célula do próprio ator, e um cone ou linha pode mirar em qualquer lugar dentro do comprimento que desenha, pois ali a célula só indica a direção. Isso vale tanto para o `mechanics.area` de uma entrada de catálogo quanto para a área de uma criatura.

`ranged` indica o custo de um disparo feito além de sua distância comum `normal`, ou com alguém do outro lado na célula vizinha. Cada um é `"disadvantage"` ou `"normal"`; omita o bloco e nenhum custa nada. Um golpe nunca é um disparo, então nenhuma regra o afeta, nem uma arma de arremesso usada dentro do próprio alcance.

**Áreas.** O `mechanics.area` de uma entrada se torna uma forma real no tabuleiro, mirando em uma célula em vez de alguém, e `targetCount` não determina nada: a forma decide quantos alcança. Todos que estiverem nas células são atingidos, amigos e inimigos, a menos que a entrada diga `"friendlyFire": false`.

```
burst, size 2, aimed at X        cone, size 3, aimed right      line, size 3, aimed right
. . . . .                        . . . .                        . . . .
. # # # .                        . . # .                        A # # #
. # X # .                        A # # #                        . . . .
. # # # .                        . . # .
. . . . .                        . . . .
```

Uma explosão abrange todas as células dentro do seu tamanho ao redor da célula visada. Um cone parte do ator em direção a essa célula, com largura em cada passo igual à distância percorrida. Uma linha segue da mesma forma, com uma célula de largura. Os três param em qualquer coisa sólida.

Uma linha no `mechanics.area` de uma entrada ou na `area` de uma ação de criatura pode ter `width`, na mesma unidade de `size`, arredondada para células com mínimo de uma (Capability API 1.128), por exemplo `{ "shape": "line", "size": 60, "width": 10 }` para uma linha de 60 pés com 10 pés de largura; omita-a para uma célula, e uma largura par em células coloca a coluna extra à esquerda do conjurador.

**Linha de visão e cobertura.** Uma linha reta de células entre os dois: uma parede ou uma montanha nela bloqueia um disparo e impede que uma área se espalhe além, e o alvo simplesmente não aparece no menu. A água é vista de um lado a outro: um disparo atravessa um rio, e uma área em linha continua por cima dele. As lutas próprias do Engine usam o mesmo teste de visão.

A cobertura é lida a partir de onde o atacante está, pelas linhas entre cantos da regra opcional de grade do DMG: do melhor canto do atacante, uma linha para cada canto da célula do alvo. Três ou quatro linhas que passam por uma parede ou uma montanha são cobertura de três quartos; qualquer linha que passe por uma delas, ou por um terreno que valha como cobertura (bosques, ruínas), é meia cobertura; terreno baixo sozinho nunca é mais que meia cobertura. Um alvo que o atacante não consegue ver de forma alguma tem cobertura total e não aparece no menu. Contra um ataque, um alvo num terreno que vale como cobertura tem pelo menos meia cobertura, como sempre teve; uma salvaguarda só é ajudada pelo que está entre ela e o efeito.

- `cover.bonus` é o que a meia cobertura soma à defesa contra a qual um ataque é rolado, e o registro diz isso.
- `cover.threeQuarters` (Capability API 1.74) é o que a cobertura de três quartos soma; sem ele, `bonus` vale para as duas.
- `cover.saves` (1.74) nomeia as salvaguardas que a cobertura também ajuda, contra a própria salvaguarda de uma ação (nunca uma salvaguarda que encerra uma condição ou mantém a concentração): a partir de onde uma explosão cai, e a partir de quem a criou para qualquer outra coisa. O registro também diz isso.
- `cover.creatures` (1.74) faz de qualquer um que esteja no caminho meia cobertura, amigo ou inimigo.
- Uma salvaguarda cujo texto diz que o alvo não ganha nada com cobertura (o Sacred Flame de 5e) diz `"ignoresCover": true` (1.74), no `mechanics.save` de uma entrada, no `save` de uma ação de criatura ou no `save` do uso de um item.

**Altura.** Um tabuleiro pode ter altura, até três níveis, e toda luta posicionada anda e vê conforme ela, diga o que disser o conjunto: subir um nível custa uma célula a mais, descer não custa nada, um degrau de dois níveis ou mais é um penhasco por onde ninguém anda (e para onde ninguém é empurrado), e um terreno mais alto que as duas pontas bloqueia a visão. Atirando de cima de um terreno mais alto, a cobertura baixa no meio não esconde nada. Um conjunto diz o que seu sistema acrescenta com `elevation` (Capability API 1.75, e exige `distance`):

```json
"elevation": {
  "levelHeight": 5,
  "highGround": "advantage",
  "rangeBonus": 1,
  "falling": { "per": 10, "dice": { "count": 1, "sides": 6 }, "max": 20, "type": "bludgeoning", "prone": "prone" }
}
```

- `levelHeight` é a altura de um nível na distância do próprio conjunto.
- `highGround` é o que golpear de cima de um terreno mais alto dá a uma rolagem de ataque: `"advantage"`, ou `{ "bonus": n }`, tirado da defesa contra a qual o ataque é rolado. Omitido, não dá nada.
- `rangeBonus` é quantas células a mais um disparo alcança de um terreno mais alto.
- `falling` é o que uma queda faz: quem é empurrado de um degrau de dois níveis ou mais cai embaixo e recebe `dice` para cada `per` da queda (níveis vezes `levelHeight`), no máximo `max` dados, do tipo `type`, e depois recebe a condição `prone`, quando houver uma. Os dados são rolados como o sistema rola dano: somados ou, em `dice-pool`, contados como sucessos com a absorção descontada. Uma queda é um golpe como qualquer outro, então pode derrubar alguém ou romper a concentração dele. O registro diz de que altura a pessoa caiu. Sem `falling`, a queda é anotada e não faz nada.

**Golpes contra quem se afasta.** Declare `opportunity.budget` e, quando um combatente caminhar para fora do alcance de um inimigo de pé que possa agir, tenha esse orçamento e tenha algo corpo a corpo com que golpear, a caminhada PARA onde está e esse inimigo é consultado sobre golpear. Aceitar gasta o orçamento e resolve exatamente como o mesmo ataque no próprio turno; deixar passar não custa nada. Nos dois casos, a caminhada continua de onde foi interrompida, pagando cada célula realmente cruzada, e um golpe que derruba quem se move encerra a caminhada onde caiu. Uma oportunidade para cada inimigo na caminhada inteira, independentemente de quantas vezes o caminho saia do mesmo alcance. `disengage` impede isso pelo restante do turno, e um conjunto de regras sem `opportunity` não tem nada disso.

A pergunta é uma JANELA e segura o combate inteiro: nada mais se move até que todos os consultados respondam. O jogador responde à janela de um membro do grupo, com o golpe ou **Pass** (passar) ao lado; as demais são respondidas por quem interpreta o combatente, e um chefe do Game Master pela decisão do próprio Game Master. Veja Janelas abaixo.

**O que um oponente faz com o tabuleiro.** Um oponente que ninguém interpreta avalia cada célula alcançável contra cada opção que poderia executar dali, desconta cada golpe que a caminhada provocaria e prefere não se mover quando já pode fazer o melhor de onde está. Sem nada ao alcance, aproxima-se e primeiro corre se sua lista `standard` tiver `dash`.

**Recusas que você pode ver.** `out-of-reach` (mais longe do que alcança), `no-line-of-sight` (algo sólido no caminho), `unreachable` (uma célula cujo custo a caminhada não pode pagar ou onde não pode terminar) e `bad-cell` (uma forma mirando em um lugar proibido).

### O que o combate faz com seu bloco no servidor

Uma partida cujo conjunto de regras declara `combat` recebe um combate resolvido por ele, na mesma batalha salva que o Engine sempre usou:

- **Quem participa.** O Game Master diz quem está lutando; o Engine lê os números de cada membro do grupo em sua própria ficha. Um membro sem ficha para seu conjunto de regras é recusado pelo nome, em vez de receber números que você não escreveu.
- **De onde vêm os números de um oponente**, nesta ordem: a criatura nomeada pelo Game Master no bestiário; depois uma cujo rótulo corresponda ao nome do oponente; depois um bloco de estatísticas proposto pelo Game Master para esse combate, ajustado à sua escala de ameaça; por último, uma criatura simples construída com os números do próprio degrau. Cada alternativa e cada ajuste são registrados em palavras simples para que o combate possa explicar o que fez. Um conjunto de regras sem entrada de bestiário, proposta ou escala de ameaça recusa o combate em vez de inventar um.
- **Suas fichas são o registro.** Saúde, reservas, condições, concentração e contadores da sua regra de morte são gravados pelas regras da própria ficha após cada ação aceita; assim, recarregar no meio do combate mostra exatamente o que ele deixou, sem uma contagem ao final que possa discordar.
- **Seu menu é a única fonte de legalidade.** Todo aquele que age, jogador ou oponente, escolhe um identificador no mesmo menu produzido pelo seu bloco. Um oponente controlado pelo Engine escolhe nele com as táticas do próprio Engine; um controlado pelo Game Master é instruído a escolher um identificador desse mesmo menu, vendo seus números sem jamais saber o que os dados farão.
- **Seus dados.** Um combate carrega sua própria semente e um cursor; portanto, um combate lido novamente do disco continua com os dados que teria rolado.

### Na tela

O combate acontece na tela de batalha com suas palavras. O menu contém seus ataques, suas habilidades, suas disputas e as ações padrão que você listou, cada uma informando o que gasta dos seus orçamentos e reservas. São mostrados a ordem dos turnos, a rodada, cada condição nomeada com suas rodadas restantes, os pontos temporários, a concentração e os dois contadores da sua regra de morte. O registro imprime a aritmética real nos seus termos: "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit." Cada ação aceita é gravada na ficha quando acontece; assim, recarregar no meio do combate é exato, e depois o Game Master é instruído a não alterar esses números novamente.

Um combate com posições é desenhado no tabuleiro em vez do palco de retratos; veja Posições para saber o que o jogador faz com ele. Toda distância nele, no menu e no registro, é expressa na SUA unidade: "Juno moves to 4, 6 for 6 paces and has 2 paces left."

### Disputas: agarrar, empurrar, se soltar

Alguns movimentos não são um ataque contra uma defesa, mas uma disputa: os dois lados rolam, e quem se sai melhor consegue o que quer. Agarrar alguém, derrubá-lo ou empurrá-lo para longe e se soltar têm todos a mesma forma, então um conjunto de regras declara cada um deles como dados:

```json
"checks": [
  { "id": "brawn", "label": "Brawn", "value": { "abilityMod": "brawn" } },
  { "id": "wits", "label": "Wits", "value": { "abilityMod": "wits" } }
],
"contests": [
  {
    "id": "grab",
    "label": "Grab",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn", "wits"] },
    "onWin": { "applies": [{ "condition": "held" }] }
  },
  {
    "id": "break_free",
    "label": "Break free",
    "budget": "act",
    "attacker": { "checks": ["brawn", "wits"] },
    "defender": { "checks": ["brawn"] },
    "from": { "holding": "held" },
    "onWin": { "ends": [{ "condition": "held", "on": "actor" }] }
  },
  {
    "id": "shove",
    "label": "Shove back",
    "budget": "act",
    "attacker": { "checks": ["brawn"] },
    "defender": { "checks": ["brawn"] },
    "ties": "attacker",
    "onWin": { "push": 4 }
  }
]
```

- **`checks`** são os números que uma disputa lê, cada um um valor da ficha, lido uma vez quando a luta começa, como uma defesa ou uma salvaguarda. Uma criatura escrita com números simples define os próprios (`"checks": { "brawn": 2 }`); uma com ficha os lê dela. Até doze.
- **A rolagem.** Os dois lados rolam seus `attackRoll.dice` e somam o melhor dos testes que podem usar ali (`attacker.checks`, `defender.checks`). O maior total vence; um empate fica com o defensor, a menos que `ties` diga `"attacker"`. O registro mostra os dois lados: "Juno tries Grab on Ash-hound: 12 (6 + 6) + 3 = 15 with Brawn against 2 (1 + 1) + 2 = 4 with Brawn, and wins."
- **Vencer** faz o que `onWin` diz, pelo menos uma coisa:
  - `applies` impõe condições a quem perde, com o vencedor como origem, então uma condição que você marca com `endsWhenSourceDown` termina quando quem está segurando cai. `rounds` dá um relógio à condição; sem isso, ela dura até que algo a encerre.
  - `ends` remove condições do ator ou do alvo.
  - `push` move quem perde diretamente para longe do vencedor, essa distância na sua unidade, parando antes de qualquer coisa sólida, de alguém de pé, da borda do tabuleiro e de um canto apertado demais para passar. É forçado: não gasta movimento de quem é empurrado, e ninguém o golpeia por isso. Uma luta sem tabuleiro não move ninguém. Perder não faz nada, que é o que um agarrão falhado é.
- **`from: { "holding": "held" }`** faz uma disputa mirar só em quem impôs essa condição ao ator e a coloca no menu só enquanto ela vale: é assim que se expressa se soltar.
- **`reach`**, na sua unidade de distância, é até onde ela alcança; a célula vizinha, quando você o omite. `reach` e `push` exigem `combat.distance`.
- **`strike: true`** permite que ela ocupe o lugar de um ataque quando uma ação compra vários, como faz um ataque: escolhida primeiro, gasta o orçamento e deixa o restante dos ataques disponíveis; escolhida com ataques disponíveis, custa um deles. A referência 5e agarra e empurra assim.
- **No menu**, uma disputa tem seu próprio grupo e informa sua chance de vencer. Um oponente jogado pelo Engine a avalia como qualquer outra coisa, mas com moderação: um agarrão ou um empurrão prepara algo, e se soltar vale mais, só enquanto estiver agarrado. Um Game Master que interpreta um oponente escolhe uma no mesmo menu.
- Um oponente que um Game Master inventa tem seus testes limitados ao seu nível, como sua chance de acertar.

Disputas exigem Capability API 1.43 num conjunto empacotado.

<a id="windows-holding-the-fight-open"></a>

### Janelas: manter o combate aberto

Alguns momentos pertencem a alguém que não é quem está agindo. O Engine mantém o combate aberto para essa pessoa em vez de decidir por ela, e essa pausa é uma janela.

Sete coisas abrem uma, e duas vêm do que você já declarou:

- **Alguém se afasta.** Uma caminhada que sai do alcance de um inimigo capaz de golpear para nesse passo e pergunta a ele. Veja Golpes contra quem se afasta, acima.
- **Entre um turno e o próximo.** Quando um turno termina, cada oponente com `signaturePoints` que pode pagar uma de suas próprias ações `signature` é consultado sobre comprá-la, antes do próximo turno começar. Esse é o único momento em que elas são compradas, a menos que `combat.signatureAtTurnStart` diga o contrário: uma ação característica não aparece no menu de turno de ninguém, nem no próprio.
- **O turno de um inimigo começa** (Capability API 1.805). Com `"combat": {"signatureAtTurnStart": true}`, todos com `signaturePoints` também são consultados quando o turno de um oponente começa, depois que tudo que esse início dispara (condições, salvaguardas, reações) aconteceu e antes que o oponente aja: um chefe respondendo ao herói que está prestes a agir, como faz a antecipação de uma luta genérica. As ações de um covil mantêm sua própria contagem e não são oferecidas ali. Se essa opção for omitida, as ações lendárias só são compradas entre turnos, como as ações lendárias de 5e. Um conjunto de regras que usa isso exige Capability API 1.805.
- **Alguém usa algo.** Antes de resolver, todos do OUTRO lado que possuem uma entrada esperando esse momento são consultados, seja quem for o alvo, desde que essa entrada alcance quem está usando. Uma ação padrão e uma disputa não abrem esse momento.
- **Algo mira em alguém.** Antes de resolver, todos os alvos do OUTRO lado que possuem uma entrada esperando esse momento são consultados. Um amigo curando você não é uma ameaça à qual responder, então a ação de um amigo não abre uma janela.
- **Uma rolagem de ataque acerta alguém.** Antes do dano, quem foi atingido é consultado, quando tem uma entrada esperando esse momento. O que essa pessoa faz em resposta conta para este ataque: veja O momento depois de um acerto, abaixo.
- **Algo feriu alguém.** Depois de resolver, todos que receberam dano e possuem uma entrada esperando ESSE momento são consultados, independentemente de quem causou. Ser ferido é um fato sobre você; uma entrada direcionada de volta a quem causou isso ainda não pode mirar em um amigo.
- **Alguém cai.** Antes do dano e da queda ao chão, para quem tem uma reação que alcança quem cai e permite o lado dele (Capability API 1.124).

- **Alguém começa o turno.** Antes de agir, para uma entrada que o alcança no lado-alvo dela (Capability API 1.131).

As seis últimas são as que uma entrada de catálogo, ou a própria ação de uma criatura, solicita ao nomear o momento que espera. Quando uma ação abre tanto `used` quanto `aimed`, o uso é consultado primeiro; se ninguém o cancelar, os alvos são consultados em seguida, e ela se resolve depois que os dois forem respondidos. Ser atingido é consultado conforme cada uma das suas rolagens acerta, e ser ferido depois que a ação inteira termina.

O que uma janela faz, seja qual for sua origem:

- **Nada mais se move enquanto ela está aberta.** Nem o ator de quem é o turno, nem o fim desse turno, nem outra janela. O combate espera. Uma queda retém a aterrissagem enquanto o passo da ação que a causou termina; outras quedas são consultadas depois.
- **Ela pergunta a um de cada vez**, na ordem dos turnos, uma vez a cada um. Passar sempre é uma resposta e não custa nada. Quem seria consultado e não tem nenhuma opção que possa executar é pulado em vez de consultado.
- **Ela continua exatamente de onde parou.** Uma caminhada termina pelas células restantes, pagando cada uma que realmente cruzou.
- **Quem responde é quem interpreta.** A janela do seu membro do grupo é sua, com a opção e **Pass** ao lado no menu; a de um oponente é respondida por quem o interpreta, e um chefe do Game Master é consultado pelo Game Master, com deixar o momento passar entre as respostas.
- **Ela é salva com o combate.** Uma partida fechada no meio de uma caminhada volta com as mesmas pessoas ainda a consultar e as mesmas células ainda a percorrer.

Você não declara nada para as duas primeiras: um conjunto de regras com `opportunity.budget` recebe uma, um bestiário com `signaturePoints` recebe a outra, e um conjunto de regras sem ambos nunca as vê.

**Indicar qual momento uma entrada espera.** Escreva `mechanics.reaction` como um objeto em vez de `true`:

```json
"reaction": { "on": "aimed", "at": "source", "cancels": true }
```

- `on` é `used`, `aimed`, `hit`, `harmed`, `falls` ou `turn-start`, e é o que coloca a entrada no menu dessa janela. Esses seis são os únicos momentos que o Engine observa. Uma entrada que ainda diz `"reaction": true` apenas informa que não é executada em um turno; isso não basta para oferecê-la em algum lugar, então ela não aparece em nenhum menu.
- `at` é `source` (o padrão), `target` ou `chosen`. `source` direciona o que é executado a quem causou o momento e preenche o alvo, para que ninguém precise escolher; `chosen` mantém os alvos da própria entrada e pergunta. `target` aponta para a criatura de que o momento trata. Uma resposta a `falls` recai sobre quem ela escolheu entre os que caem.
- `cancels` impede completamente que aconteça o que a janela estava segurando. Só uma entrada `used` ou `aimed` pode declará-lo: um momento que já aconteceu não pode ser cancelado, e um acerto já foi rolado.
- `against` restringe aquilo a que a entrada responde a coisas usadas de certos catálogos: `"against": { "catalogs": ["spells"] }` responde a uma magia e a nada mais. Uma ação sem entrada por trás (uma arma numa lista, a própria ação de uma criatura) não vem de nenhum catálogo, então nunca abre o momento para uma entrada que nomeia catálogos. Omita `against` e a entrada responde a qualquer coisa.

Dê a ela também um `budget`, ou ela gastará o padrão da lista. Uma reação quase sempre gasta um orçamento próprio, o que impede um turno de conter várias.

**Seu custo é gasto antes de consultar qualquer pessoa.** Uma ação cancelada é impedida de acontecer, mas não deixa de ter sido comprada: o orçamento e as reservas já foram gastos. Se seu sistema os reembolsa, ainda não pode expressar isso.

Uma contra-ação se escreve assim e, num tabuleiro, só responde a alguém dentro do próprio `range`:

```json
"mechanics": {
  "kind": "utility",
  "range": 8,
  "free": true,
  "cost": [{ "pool": "luck", "amount": 1 }],
  "reaction": { "on": "used", "cancels": true, "against": { "catalogs": ["knacks"] } }
}
```

**Uma contra-ação que só alcança até certo ponto** (Capability API 1.116). `"upTo": "paid"` numa reação `used` que cancela só impede o que foi pago num nível não maior que o da própria resposta, e `"above": { "check": <value>, "dc": 10 }` é o teste que impede mesmo assim algo maior, contra `dc` mais o nível dele. O Counterspell de 5e, que impede uma magia do nível do seu espaço ou menor e pede um teste de atributo de conjuração contra 10 + o nível da magia acima disso, lançado em nível superior como qualquer magia:

```json
"reaction": {
  "on": "used",
  "cancels": true,
  "against": { "catalogs": ["spells"] },
  "upTo": "paid",
  "above": { "check": { "abilityModFromField": "spellcasting_ability" }, "dc": 10 }
}
```

O nível de qualquer coisa paga é o nível da reserva de onde saiu: o `level` da própria reserva, um valor lido da ficha de quem a tem, quando ela diz um (os espaços de pacto de 5e, conjurados no nível de espaço do bruxo), e caso contrário o lugar dela no grupo, sendo a primeira reserva o nível 1. Algo que não custou nada, ou que saiu de uma reserva sem grupo, é de nível 0, então toda contra-ação assim o impede. O teste usa os próprios dados da luta com as condições de quem responde sobre testes; uma luta `dice-pool` não tem CD a alcançar e recusa `above`. Uma criatura sem ficha escreve o teste como `{ "const": n }`. O registro diz o nível e a rolagem sempre que a resposta alcança acima de si mesma, e a linha de sempre vem em seguida quando ela o impede. Sem `above`, algo maior simplesmente não é impedido, e o que a resposta custou continua gasto.

**O momento depois de um acerto.** Uma entrada em `hit` é como se expressam Shield, um Parry e Uncanny Dodge. O ataque fica retido depois da rolagem, e quem foi atingido é consultado antes de qualquer dano. O que essa pessoa faz conta para aquele ataque: a rolagem não é feita de novo, mas verificada de novo, contra a defesa dela como estiver agora, então uma condição que soma à defesa pode transformar o acerto em erro, e uma face natural que sempre acerta continua acertando. Uma condição que dura um ataque (`endsAfter: "attacked"`) imposta como resposta cobre este ataque, inclusive o dano, e é consumida por ele, que é como se expressa reduzir à metade o dano daquele ataque: `resist-all` para um ataque.

```json
"mechanics": {
  "kind": "buff",
  "targets": "self",
  "budget": "reaction",
  "reaction": { "on": "hit" },
  "applies": [{ "condition": "shielded", "duration": { "rounds": 1, "at": "turn-start" } }]
}
```

O ataque continua exatamente de onde ficou retido: o restante dos alvos e, para uma ação de criatura feita de outras ações, o restante das partes. Cada rolagem que acerta alguém com essa resposta fica retida na sua vez, e uma luta salva enquanto a janela está aberta volta da mesma forma. Um ataque feito dentro de uma janela (um golpe contra quem se afasta, uma ação característica, uma resposta) nunca fica retido, porque nada aberto dentro de uma janela abre outra. O registro mostra a rolagem e contra o que ela foi feita quando a janela abre e, quando a resposta mudou a defesa, se agora ela erra. Oponentes jogados pelo Engine só usam uma proteção quando ela transforma o acerto em erro.

Um pacote que nomeia um momento precisa da Capability API 1.33, e um que usa `used` ou `against` precisa da 1.44. Um que espera `hit` precisa da 1.46.

**Responder a uma magia pelo nome** (Capability API 1.117). `against` pode nomear `entries` como `<catalog>/<entry>` ao lado de `catalogs`, e qualquer um que corresponda abre o momento. `also` usa a mesma resposta em até mais três momentos, cada um com o próprio `against`. O `noDamageFrom` de uma condição mantém o dano dessas entradas totalmente longe de quem a porta enquanto ela vale, seja qual for o tipo de dano. O Shield de 5e é usado quando um ataque acerta e quando Magic Missile mira o conjurador, e sob ele Magic Missile não faz nada:

```json
"reaction": {
  "on": "hit",
  "also": [{ "on": "aimed", "against": { "entries": ["spells/magic-missile"] } }]
}
```

```json
{
  "condition": "shielded",
  "modifiers": [{ "to": "defense", "flat": 5 }],
  "noDamageFrom": ["spells/magic-missile"]
}
```

Só o primeiro momento pode cancelar, então uma reação que cancela não tem `also`. O catálogo que uma entrada nomeia precisa ser um que o conjunto tenha. Uma entrada que não está nele simplesmente nunca abre o momento. Um golpe evitado dessa forma aparece no registro como um ao qual o alvo é imune.

**Responder só a alguns golpes** (Capability API 1.118). Um momento `hit` pode dizer `"blow": "melee"` ou `"blow": "ranged"`. Um golpe é corpo a corpo enquanto o alvo está ao alcance da arma, então uma adaga arremessada de longe é à distância, e a mesma adaga usada ao lado do alvo é corpo a corpo. Uma arma com alcance e sem distância é sempre corpo a corpo, e uma com distância e sem alcance é sempre à distância. Numa luta sem tabuleiro, uma arma que tem alcance é considerada brandida na mão. `"seesSource": true`, em qualquer momento exceto `falls`, só o abre enquanto quem a tem vê quem o causou. Isso significa uma linha de visão entre os dois no tabuleiro (sem tabuleiro, todos veem todos), e nunca alguém que fez a ação padrão Hide até que ela perca o efeito no início do próximo turno dessa pessoa. O Parry de 5e tem as duas coisas:

```json
"reaction": { "on": "hit", "blow": "melee", "seesSource": true }
```

As duas chaves também podem ser escritas num momento em `also`, e `blow` só num momento `hit`.

**Amparar uma queda** (Capability API 1.124). Uma reação em `falls`, inclusive em `also`, responde a uma criatura que cai de uma borda ou a um voador forçado ao chão, antes de a queda causar dano ou deixá-la caída. O alcance e o lado-alvo dela são verificados em relação a quem cai, e a resposta recai sobre essa criatura. Para Feather Fall, dê à entrada estas mecânicas e declare `feather_falling` nas condições vivas da ficha:

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 60,
  "budget": "reaction",
  "cost": [{ "pool": "slots_1", "amount": 1 }],
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

A entrada de `combat.conditions` dela é `{ "condition": "feather_falling", "fallsSafely": true }`. Enquanto vale, essa condição impede o dano da queda e a condição de caído que uma queda aplicaria; ela não remove uma condição que causou a queda. Use `targets: "self"` para uma resposta só à queda do próprio conjurador. Uma queda não tem entrada de origem, então a reação dela não pode ter `cancels`, `blow`, `seesSource` nem `against`. Uma entrada de alvo único pergunta sobre cada queda separadamente. Isso resolve a aterrissagem; não acompanha uma descida lenta.

**Responder por outra criatura** (Capability API 1.131). `for` é `self` por padrão; `ally` exclui quem a tem, enquanto `any` o inclui. Os dois perguntam a quem a tem do lado do alvo dentro do `within` exigido, na unidade de distância do catálogo, e só em `aimed` ou `hit`. Essas chaves também funcionam em cada momento de `also`. `seesSource` ainda exige ver o atacante. Protection impõe `own-attacks-disadvantage` à origem antes de os dados do ataque serem rolados. A duração `this-action` dela termina quando a ação se resolve ou é cancelada. Sem um alcance explícito até a origem, a resposta de um espectador alcança essa origem; `within` mede a distância até a criatura protegida. Declare `protected_attack` na ficha e dê à condição de combate dele esse efeito:

```json
{
  "kind": "debuff",
  "targets": "enemy",
  "budget": "reaction",
  "reaction": { "on": "aimed", "for": "ally", "within": 5, "at": "source", "seesSource": true },
  "applies": [{ "condition": "protected_attack", "duration": "this-action" }]
}
```

**Colocar a resposta no alvo.** `at: "target"` se aplica à criatura atacada, enquanto `source` continua sendo o atacante. Shield Guardian representa quem usa o amuleto como um aliado a até 5; `parrying` concede `+2` de defesa. O acerto retido verifica de novo a defesa desse aliado depois da resposta:

```json
{
  "kind": "buff",
  "targets": "ally",
  "range": 5,
  "budget": "reaction",
  "reaction": { "on": "hit", "for": "ally", "within": 5, "at": "target" },
  "applies": [{ "condition": "parrying", "duration": "this-action" }]
}
```

**No início de um turno.** `on: "turn-start"` pergunta quando uma criatura do lado-alvo da entrada começa o turno dentro do alcance dela, antes que essa criatura aja. Essa criatura é a `source`. Uma entrada nociva responde ao outro lado, e uma entrada benéfica, ao próprio lado. Ela não pode ter `cancels`, `blow`, `against` nem `upTo`. A ação de criatura Unnerving Mask pede uma salvaguarda de Wisdom; uma rodada no relógio da criatura afetada dura este turno inteiro e expira no fim dele (deixe `of: "source"` de fora):

```json
{
  "id": "unnerving_mask",
  "name": "Unnerving Mask",
  "range": 30,
  "budget": "reaction",
  "reaction": { "on": "turn-start", "at": "source", "seesSource": true },
  "save": { "save": "wis_save", "difficulty": 14, "onSuccess": "negates" },
  "applies": [{ "condition": "frightened", "duration": { "rounds": 1 } }]
}
```

**Cancelar com uma salvaguarda.** `cancelSave: { save, dc }` exige `cancels`; quem a tem rola com os modificadores de salvaguarda de costume. O sucesso cancela, a falha deixa a ação original se resolver, e os dois gastam a reação. `against.actions` nomeia de uma a doze ações de bloco de estatísticas, comparando o nome inteiro sem distinguir maiúsculas (no máximo 80 caracteres cada). Rock Catching representa pegar a pedra cancelando o ataque inteiro, inclusive todo o dano dele, e não só o dano contundente. Os IDs de salvaguarda são os do seu conjunto (`dex` aqui; `dex_save` no exemplo de 5e incluído):

```json
{
  "on": "aimed",
  "cancels": true,
  "cancelSave": { "save": "dex", "dc": 10 },
  "against": { "actions": ["Rock"] }
}
```

**Amparar várias quedas.** Uma entrada `falls` com `targetCount` maior que um oferece as criaturas elegíveis que caem por causa de um mesmo golpe ou efeito, dentro do alcance e no lado-alvo dela. O menu e o diretor escolhem por padrão todas as elegíveis até a contagem, das mais próximas para as mais distantes; o jogador pode mudar a seleção. Uma queda posterior é um evento separado. Feather Fall usa a mesma condição `fallsSafely` de cima:

```json
{
  "kind": "buff",
  "targets": "ally",
  "targetCount": 5,
  "range": 60,
  "budget": "reaction",
  "reaction": { "on": "falls" },
  "applies": [{ "condition": "feather_falling", "duration": { "rounds": 10 } }]
}
```

### Ainda não

Dito claramente, pois um conjunto de regras não deve prometer o que o Engine não faz:

- **Além do tabuleiro modesto**: não há voo sobre obstáculos. Uma criatura só é movida pela própria caminhada, pela caminhada de uma montaria, por um teleporte, pelo que a empurra (uma disputa, uma entrada, a ação de uma criatura ou uma zona) e por quem a arrasta.
- **Uma disputa é simples.** A rolagem dela não abre janela, mas uma queda que ela cause pode ser respondida.
- **Uma entrada só pode esperar seis momentos**, `used`, `aimed`, `hit`, `harmed`, `falls` e `turn-start` (veja Janelas, acima). São os momentos que o Engine percebe em nome de uma entrada; as outras duas janelas, alguém se afastando e a pausa entre dois turnos, são abertas pelo próprio combate e não são momentos que uma entrada pode solicitar. Não há momento para uma salvaguarda ser rolada nem para uma morte.
- **Sem encadeamento.** O combate mantém uma janela em vez de uma pilha, então nada aberto dentro de uma janela abre outra: uma contra-ação não pode ser anulada por outra, o que uma reação causa não abre outro momento, e um ataque feito dentro de uma janela não fica retido quando acerta. Uma queda que pode ser respondida, causada durante uma janela, fica retida até ela se fechar e depois é consultada na sua vez.
- **Só uma rolagem de ataque é um acerto.** Algo que atinge sem rolagem (dardos que simplesmente acertam, uma área contra a qual todos fazem salvaguardas) não abre o momento `hit`.
- **Modificadores de dano pertencem a acertos de ataque.** Uma resposta pode impor um modificador de dano a quem a tem ou reduzir à metade o dano recebido com `resist-all`; modificadores de dano nunca mudam um efeito que só pede salvaguarda.
- **Nada é reembolsado.** O custo de uma ação cancelada permanece gasto.
- **O que uma condição altera é uma lista fechada.** Defesa, rolagens de ataque, salvaguardas, testes de disputa, velocidade, máximo de saúde, dano causado e dano recebido (o mesmo vale para níveis e efeitos de itens). Modificadores de dano só mudam acertos de ataque; nunca se somam a dano baseado em salvaguarda nem a acertos automáticos.
- **Uma criatura escrita com números simples não tem trilha de ferimentos.** Em um conjunto de regras cuja saúde é uma trilha, essa criatura ainda perde pontos; dê a ela uma `sheet` e os golpes recebidos marcarão casas, mitigados primeiro pelos próprios `resist`, `vulnerable` e `immune`.
- **Um efeito adicional dispara sozinho.** `on` tem um valor, `hit`, então o primeiro acerto qualificado do período o aplica, sem um momento em que você seja consultado sobre gastá-lo.
- **Um número que os ataques movem é simples.** Um golpe que gasta rola o número e nada mais, então nenhuma arma o altera, inclusive seu `floor` (um alvo resistente absorve um golpe que toma, e sua dureza detém um que gasta, mas nada mais reduz nenhum dos dois); um colapso termina depois de um número fixo de turnos, por mais fundo que tenha ido; e um ataque feito numa janela (um golpe contra quem se afasta, uma reação, uma ação característica) é feito no primeiro estilo.
- **Um oponente inventado não absorve nada e não tem dureza.** Uma criatura que o Game Master cria para uma luta fica limitada à sua escala de ameaça, que não diz nada sobre absorção ou dureza, então ela não tem nenhuma das duas.
