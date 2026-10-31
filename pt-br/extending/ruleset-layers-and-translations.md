# Camadas, traduções e migrações de conjuntos de regras

Esta página faz parte de [Escrever conjuntos de regras de Game Mode](writing-rulesets.md). Variantes que um jogador ativa para uma partida, traduções do texto de um conjunto de regras e a transferência de valores para novos IDs quando uma ficha muda.

## Camadas: variantes do seu próprio conjunto de regras

Uma camada é uma variante nomeada do seu conjunto de regras que o jogador ativa ao criar uma partida: pouca magia, inverno rigoroso, uma dificuldade mais dura. As camadas ficam no arquivo do conjunto de regras, em uma matriz opcional `layers`; assim, viajam com ele e nunca podem faltar em uma partida que as usou. O assistente as mostra como interruptores abaixo do conjunto de regras, e a escolha fica fixa durante toda a vida da partida, exatamente como o próprio conjunto.

```json
"layers": [
  {
    "id": "hard_winter",
    "label": "Hard winter",
    "summary": "Cold, hunger and short days. Everything is harder.",
    "conflicts": ["mud_season"],
    "gm": {
      "guidance": "Hard winter is on. Let a failed check cost warmth, food or daylight as well as progress.",
      "worldGuidance": "Hard winter is on. Build a world of closed roads, thin stores and rationed settlements."
    },
    "fields": [{ "id": "calling", "removeValues": ["Sailor"], "default": "Hauler" }],
    "difficultyLadder": [{ "label": "Easy", "dc": 7 }],
    "catalogs": [{ "id": "knacks", "hide": { "filter": "grit", "above": 0 } }]
  },
  {
    "id": "mud_season",
    "label": "Mud season",
    "summary": "Thaw, flooded roads and slow going."
  }
]
```

**O que uma camada pode fazer.** A lista é fechada, e cada efeito restringe algo ou adiciona texto:

- `gm.guidance` é acrescentado ao fim do seu `gm.checkGuidance`, depois do seu texto e do de qualquer camada anterior. `gm.worldGuidance` é acrescentado a `gm.worldGuidance` da mesma forma.
- `fields` remove valores de um campo **enumerado**. `removeValues` nomeia valores que o campo já possui; pelo menos um deve permanecer e, se o `default` do campo for removido, a camada nomeia outro `default` que permaneça.
- `difficultyLadder` substitui sua escala por outra, na estrutura do seu próprio tipo de resolução: `{label, dc}` para `dice-sum` e `{label, successes, target?}` para `dice-pool`. Ela passa exatamente pelas mesmas verificações da sua escala. Quando várias camadas ativas declaram uma, a última vence.
- `catalogs` oculta entradas do seletor do editor de fichas. Cada regra nomeia um dos `filters` declarados pelo catálogo e exatamente uma comparação: `above` ou `below` para um filtro `number`, `equals` ou `notIn` para um filtro `text` ou `tags`. Uma entrada que não define esse filtro nunca é ocultada.
- `currencies` retira moedas: `removeUnits` nomeia moedas individuais, e `removeFamilies`, famílias inteiras. A menor moeda de uma família só sai junto com a família, para que toda família restante ainda possa pagar e dar troco. Enquanto a camada estiver ativa, ninguém recebe, paga com, escolhe ou deixa cair uma moeda retirada, e a linha de moedas a omite. Um preço expresso nela é dito na maior moeda restante que o paga exatamente, pelo mesmo valor: a camada da longa noite de Gravewatch retira a crown, então uma pistola de vigia de 3 crowns custa 15 shillings. Um item cuja família inteira sumiu não tem preço.

**O que uma camada não pode fazer.** Ela não pode adicionar um valor enumerado, campo, perícia, reserva ou descanso, mudar o tipo de resolução, tocar no estado atual ou nos números de combate, nem adicionar uma chamada de modelo. Um valor que uma camada _adicionasse_ seria desconhecido de todos os outros leitores da ficha, então valores só podem ser removidos. Tudo além dessa lista é uma alteração no próprio conjunto de regras ou um segundo conjunto.

**Conflitos.** `conflicts` nomeia camadas que não podem ficar ativas juntas. Basta nomear um lado do par. O assistente desativa o outro interruptor e, se uma escolha salva tiver ambos de alguma forma, a camada declarada **depois** é descartada; assim, as mesmas duas escolhas sempre produzem as mesmas regras.

**Uma ficha que já contém um valor removido o mantém.** Nada reescreve um personagem. O editor simplesmente deixa de oferecer o valor, e um personagem que já o tinha o mostra como é. Desative a camada em uma nova partida e o valor será oferecido de novo. O mesmo vale para uma entrada de catálogo oculta: ela sai do seletor, e uma linha que o jogador já escolheu permanece na ficha. Moedas que uma camada retira e que alguém já carrega continuam na bolsa dessa pessoa.

**Limites.** 12 camadas por conjunto de regras e 4000 caracteres de orientações por camada, contando as duas strings juntas. Um conjunto de regras empacotado que declara `layers`, ou um `gm.worldGuidance` de base, precisa da Capability API 1.25, e um cujas camadas retiram moedas precisa da 1.64. Um conjunto importado é validado pelo Engine que o lê, então não precisa de nada.

**Camadas escritas por outra pessoa** (uma camada de pouca magia para um conjunto de regras que você não escreveu, distribuída no próprio arquivo) virão depois. Hoje, uma camada é distribuída dentro do conjunto de regras ao qual pertence.

## Traduções

**Traduções** (Capability API 1.811). Os textos exibidos de um conjunto de regras em outro idioma formam uma tradução por idioma, nomeada pelo código do idioma, como os pacotes de idioma do próprio Engine (`ru`, `pt-BR`, `zh-Hans`). No catálogo oficial de agentes, cada uma é um pacote de idioma ao lado do arquivo do conjunto de regras (abaixo). Um arquivo de pacote de conjunto de regras que você compartilha pode, em vez disso, contê-las, com um arquivo por idioma ao lado de `ruleset.json`: `locales/<language>.json`, listado no manifesto como os outros arquivos. Nos dois casos, cada uma é um catálogo de localização de pacote com uma seção `ruleset`: cada chave é um texto exibido do conjunto de regras ou de seus catálogos, palavra por palavra em inglês, e seu valor é esse texto no idioma do arquivo.

```json
{
  "_meta": { "locale": "ru", "direction": "ltr" },
  "package": { "name": "5e (SRD 5.1)" },
  "ruleset": { "Prone": "Лежащий", "Fire Bolt": "Огненный снаряд", "Goblin": "Гоблин" }
}
```

`_meta.locale` precisa ser o idioma que dá nome ao arquivo, e o arquivo contém `$schema`, `_meta`, `package` e `ruleset` e nada mais, com todos os valores em texto. Um texto deixado vazio ainda não foi traduzido e aparece em inglês; um arquivo sem a seção `ruleset` (a listagem em inglês do próprio pacote, `locales/en.json`) não traduz nada. As traduções servem apenas para exibição: as regras, os comandos da ficha e tudo que é informado ao Game Master continuam lendo o inglês. A tela de uma luta (nomes, condições, ações, magias, registro e ordem de turnos) mostra cada texto no idioma do jogador quando a tradução do conjunto de regras o contém, primeiro no arquivo do próprio idioma e depois no daquele do qual ele é uma variante (`pt` para `pt-BR`), e em inglês nos demais casos; "Goblin 2" lê a tradução de "Goblin" com seu número. Um arquivo de pacote com traduções exige Capability API 1.811. A importação mantém apenas a tradução no idioma em que o Engine está configurado (ou naquele do qual ele é uma variante) e descarta o resto; para ler o conjunto de regras em outro idioma, mude o idioma do Engine e importe o arquivo de novo, o que substitui a tradução mantida. As traduções não fazem parte da versão, então importar a mesma versão de novo com uma tradução corrigida também a substitui, e um arquivo dessa versão sem nenhuma tradução deixa o que foi mantido.

Um conjunto de regras do catálogo nunca contém `locales/<language>.json` dentro do arquivo (um que contenha é recusado antes de ser baixado). Suas traduções são pacotes de idioma (Capability API 1.811): um arquivo JSON por idioma, `<id>-<version>.<language>.json`, publicado ao lado de `<id>-<version>.ruleset.json` e contendo exatamente o que um `locales/<language>.json` contém (`_meta.locale` com o idioma que dá nome ao arquivo e uma seção `ruleset`). A entrada do catálogo os lista ao lado de seu `artifact`:

```json
"locales": {
  "ru": {
    "url": "https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/main/artifacts/ember-roads-1.0.0.ru.json",
    "sha256": "<64 hex>",
    "bytes": 812345,
    "name": "Угольные дороги",
    "description": "<the store card's description in Russian>"
  }
}
```

Cada pacote é uma URL https no mesmo formato que a do artefato, nomeado pela versão e pelo idioma, com seu sha256 e seu tamanho (no máximo 8 MB); um conjunto de regras lista no máximo 40, nunca `en` (o inglês é o próprio conjunto de regras), e seu manifesto declara Capability API 1.811. `name` e `description` são os do cartão da loja nesse idioma, para que o cartão seja lido no idioma do Engine sem buscar o pacote. Uma instalação busca o arquivo do conjunto de regras e depois apenas o pacote no idioma em que o Engine está configurado (ou naquele do qual ele é uma variante), verifica seu tamanho, sua soma de verificação e seu idioma, e o mantém com a versão instalada. Quando o idioma do Engine muda (e sempre que uma página é aberta nele), cada conjunto de regras do catálogo instalado que lista um pacote no novo idioma o busca, e o pacote do idioma antigo é removido. Um pacote que não pode ser obtido (sem conexão, nenhum listado ou um arquivo diferente do que o catálogo lista) deixa o conjunto de regras em inglês; a próxima instalação ou mudança de idioma tenta de novo. Uma atualização mantém a versão anterior para rollback, sem o pacote dela: depois de um rollback, a próxima mudança de idioma busca de novo o pacote dessa versão, se o catálogo ainda o listar.

## Mover valores para novos IDs: `sheet.migrations`

Acrescentar coisas não exige mais nada. Quando uma nova estrutura move um valor para outro lugar (um campo renomeado, um único nível que vira um nível por classe, uma única reserva de dados de vida que vira uma por tipo de dado), diga como em `sheet.migrations` (Capability API 1.77), para que todo personagem feito na estrutura antiga mantenha seus números: na biblioteca, nas partidas, em salvamentos antigos, ramificações e checkpoints, e em cards importados.

```json
"migrations": [
  {
    "from": 3,
    "steps": [
      { "rename": "field", "from": "xp", "to": "experience" },
      {
        "route": "level",
        "by": "class",
        "cases": [
          { "words": ["fighter"], "to": "level_fighter" },
          { "words": ["wizard"], "to": "level_wizard" }
        ],
        "else": "level_other",
        "default": 1
      },
      {
        "routeLive": "pool",
        "from": "hit_dice",
        "cases": ["hit_dice_d6", "hit_dice_d8", "hit_dice_d10", "hit_dice_d12"],
        "else": "hit_dice_d8"
      }
    ]
  }
]
```

- Cada entrada move uma ficha guardada da versão `from` para `from + 1` e é executada, em ordem, para toda ficha guardada nessa versão ou numa anterior. Nunca remova uma depois de publicada: uma ficha guardada há muito tempo ainda precisa dela. Uma versão que só acrescenta não precisa de nenhuma.
- `rename` (um `ability`, `skill`, `save` ou `field`): o valor é copiado para o novo ID. Uma perícia ou salvaguarda leva o bônus junto. Uma renomeação pode continuar uma de uma entrada anterior ou alimentar um campo que um `route` posterior envia adiante; a importação segue a cadeia até onde ela termina.
- `route`: o valor de um campo vai para o campo que o texto de outro campo nomeia. Um caso vence quando as palavras dele aparecem no texto de `by` como palavras inteiras (só letras formam uma palavra, então "Fighter3" nomeia um fighter), sem distinguir maiúsculas, e exatamente um caso vence. Se nenhum vencer, ou vários ("Fighter 3 / Wizard 2", entre os quais um único número não pode ser dividido sem perguntar), ele vai para `else`. `default` substitui o valor numa ficha que nunca o guardou. `by` é um campo que a ficha tem, ou um que uma estrutura anterior renomeou. Os alvos são campos numéricos ou de texto sem padrão, ou com padrão 0 ou vazio: o valor cai num deles e todos os outros mantêm o padrão, então qualquer outro padrão seria lido como um nível que ninguém deu. Um alvo que uma renomeação posterior move adiante é seguido até lá.
- `routeLive` (uma `pool` ou `track` do estado vivo): o valor guardado vai para aquele dos `cases` que a ficha migrada mostra (uma reserva com máximo acima de 0, uma trilha que a ficha não oculta), senão para `else`. As trilhas para onde um valor vai são todas trilhas de ferimentos (ele leva as marcas) ou todas comuns (ele leva o número).
- `setColumn` (Capability API 1.794): `{ "setColumn": { "list": "attacks", "where": { "name": ["Dagger", "Rapier"], "ability": ["str", "dex"] }, "column": "ability", "to": "finesse" } }` define uma coluna em cada linha de uma lista na qual cada coluna de `where` contém um dos valores listados (o texto é comparado sem distinguir maiúsculas de minúsculas nem espaços nas extremidades; um número precisa corresponder exatamente). Use isso para corrigir linhas criadas antes que seu conjunto de regras soubesse lidar melhor com elas, como linhas de ataque criadas antes de existir a escolha de atributo de uma arma. A lista e todas as colunas que ele nomeia precisam estar na ficha.
- Toda outra etapa sobre a construção permanente copia: o valor antigo fica onde estava, então uma versão mais antiga do seu conjunto ainda lê a ficha como lia, e a etapa nunca sobrescreve um valor que já está no alvo dela. `setColumn` é a única etapa que sobrescreve.
- A importação recusa uma entrada igual ou acima de `sheet.version`, duas entradas da mesma versão, uma etapa que escreve num ID que a ficha não tem, um caso listado duas vezes e um `rename` ou `routeLive` que lê de um ID que a ficha ainda tem (um ID retirado nunca é usado de novo, e é isso que torna seguro executar essas etapas de novo).
- As fichas são migradas sempre que são lidas, e a nova estrutura é guardada na próxima edição. O estado vivo não tem versão própria, então `routeLive` é executado a cada leitura: a chave antiga é descartada, e o valor dela só se move enquanto a chave nova ainda não existir, então um valor gasto ou recuperado num descanso desde então nunca é sobrescrito. O destino é definido pela primeira gravação depois da atualização: uma ficha corrigida depois (um nível de classe movido à mão) não o move de novo. Uma luta que já estava em andamento quando a nova versão chega ainda termina, como antes.
