# Catálogos de conjuntos de regras

Esta página faz parte de [Escrever conjuntos de regras de Game Mode](writing-rulesets.md). Entradas prontas que o editor de fichas oferece num seletor: o cabeçalho do catálogo, entradas, valores que o conjunto de regras mantém, comandos de ficha e o comando de uso.

Digitar uma lista de magias, tabela de equipamento ou página de características linha por linha é cansativo. Um catálogo é uma coleção nomeada de entradas prontas distribuída com o conjunto. O editor as oferece num seletor em cada lista alimentada pelo catálogo; escolher uma preenche a linha.

Catálogos são opcionais. Um conjunto pode ter até doze; o Engine não conhece o assunto deles: cada ID, coluna, filtro e palavra vem do arquivo.

## O cabeçalho

O cabeçalho fica em `catalogs`, no nível superior do arquivo, ao lado de `gm`.

```json
"catalogs": [
  {
    "id": "knacks",
    "label": "Knacks",
    "feeds": ["knacks", "tricks"],
    "filters": [
      { "id": "grit", "label": "Grit cost", "type": "number" },
      { "id": "road", "label": "Road", "type": "text" },
      { "id": "callings", "label": "Calling", "type": "tags", "startFrom": { "field": "calling" } }
    ],
    "units": { "distance": { "label": "paces", "perCell": 2 } },
    "entries": []
  }
]
```

- `id` e `label`: o ID segue as regras de IDs da ficha; o rótulo dá nome ao seletor.
- `holds`: `"rows"` (padrão, usado por todos os catálogos anteriores a esta versão), `"creatures"` ou `"items"`. Um catálogo de criaturas é um bestiário lido pela luta, e um catálogo de itens lista o que um grupo carrega. Nenhum dos dois escreve em fichas, declara `feeds` ou aparece no seletor. Veja [Criaturas](ruleset-combat.md#creatures-a-bestiary-a-fight-reads) e [Itens](ruleset-items.md) abaixo.
- `feeds`: de uma a oito listas da ficha onde as entradas podem escrever. Obrigatório num catálogo de linhas e recusado num catálogo de criaturas ou de itens. Uma entrada não pode escrever em outra lista nem colocar um valor que suas colunas não aceitam.
- `filters`: opcional, até oito. Define como filtrar o seletor: `number`, um valor `text` ou `tags` (várias palavras). `startFrom` nomeia um campo usado ao abrir: um personagem cujo Calling é Tinker vê primeiro entradas Tinker.
- `units`: opcional. Define o significado de alcance ou tamanho de área no bloco `mechanics` de uma entrada.

## Uma entrada

```json
{
  "id": "road-sense",
  "label": "Road Sense",
  "summary": "You read a road the way other people read a face.",
  "filters": { "grit": 0, "road": "Ash Flats", "callings": ["Scout", "Courier"] },
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Road Sense", "notes": "Sneak to notice where a road turns bad." }
    }
  ]
}
```

- `id`: letras minúsculas, dígitos e hífens simples, único no catálogo.
- `label` e `summary`: o que o seletor mostra. O resumo é opcional, numa linha e com até 300 caracteres.
- `filters`: valores dos filtros declarados no cabeçalho. `number` recebe um número; `text`, uma string; `tags`, uma lista de strings.
- `rows`: o que a escolha escreve, de uma a seis linhas. `list` pertence a `feeds`; as chaves de `values` são os IDs de colunas dessa lista.
- `creature`: um oponente em vez de linhas, num catálogo cujo `holds` indica criaturas. Cada entrada tem exatamente um entre `rows` e `creature`. Uma criatura não contém `mechanics`: informa seus efeitos nas próprias ações.

Cada valor é verificado contra as colunas de destino. Nome incorreto ou número fora da faixa é informado com sua entrada de origem. Entradas incluídas no arquivo de regras são verificadas ao carregá-lo, o que significa durante a importação de um arquivo importado. Um catálogo separado de pacote é verificado na primeira solicitação do seletor; se tiver erro, mostra os motivos em vez das entradas.

## Uma entrada, várias listas

Uma característica com usos limitados ocupa duas linhas: a característica e seu contador. Continua sendo uma única escolha.

```json
{
  "id": "last-ember",
  "label": "Last Ember",
  "rows": [
    {
      "list": "knacks",
      "values": { "name": "Last Ember", "notes": "Spend 1 Grit to give a downed friend 3 Grit back." }
    },
    { "list": "tricks", "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" } }
  ]
}
```

## Valores mantidos atualizados pelo conjunto

Os números de uma linha pertencem ao jogador depois da escolha. Há uma exceção útil: máximos que acompanham o personagem, como usos iguais a um atributo ou um recurso de classe que cresce com o nível. Uma linha pode nomear até quatro colunas numéricas próprias num mapa `scaled`; o editor mantém essas células atualizadas.

```json
{
  "list": "tricks",
  "values": { "name": "Last Ember", "uses": 1, "recharge": "camp" },
  "scaled": { "uses": { "from": { "abilityScore": "heart" } } }
}
```

- A chave é uma das colunas `number` da lista.
- `from` é uma referência de valor comum, com o mesmo vocabulário fechado usado no restante. Para algo mais complexo, declare um valor `derived` e aponte `from` para ele (`"from": { "derived": "lay_on_hands_max" }`). Nenhuma aritmética nova é adicionada aqui.
- `table` é opcional. Consulta a referência numa tabela por patamares, como quando um nível define um número: `"scaled": { "max": { "from": { "field": "level" }, "table": [[1, 2], [3, 3], [6, 4]] } }`.
- `values` ainda precisa conter um número comum para a coluna; omiti-lo é recusado. Esse é o valor antes de conhecer a ficha e o que uma ficha sem a referência mantém.
- Uma linha com `scaled` deve ser a única da entrada para aquela lista; assim, uma linha marcada sempre corresponde a uma única especificação. Ou então (Capability API 1.92) toda linha que a entrada escreve nessa lista precisa ter o próprio nome na coluna de nome da lista (o `nameColumn` das suas reservas ou, sem ele, sua primeira coluna de texto). A linha da ficha passa a corresponder à sua especificação por esse nome, então uma característica pode dar dois usos que crescem cada um por conta própria; uma linha que o jogador renomeia fica intacta.

O valor é calculado ao editar, nunca ao ler: uma linha salva sempre contém o número que declara. Ele é ajustado à coluna: limitado entre `min` e `max` e arredondado para baixo quando a coluna usa inteiros. No exemplo, Heart 3 dá três usos; Heart 0 ou menos não dá nenhum. A linha permanece com 0 usos; como um contador com máximo 0 não é uma reserva, não há nada para gastar em jogo.

Colunas escaladas exigem Capability API 1.23 para conjuntos empacotados. Um conjunto comunitário importado é validado pelo Engine que o lê, sem precisar de mais nada.

## Linhas escolhidas são cópias

Cada linha escolhida é copiada para a ficha com uma chave extra, `_catalog`, contendo `<catalog id>/<entry id>`. IDs de colunas começam com letra, então essa chave nunca pode ser uma das suas.

A cópia pertence ao personagem. O jogador pode editá-la, a ficha continua funcionando sem o conjunto instalado e publicar uma versão nova nunca reescreve personagens. A marca permite ao seletor mostrar o que a ficha já tem e à atualização descrita abaixo reconhecer a origem.

## Atualizar a partir do conjunto

Graças à marca, o editor pode avisar quando seu texto novo difere da linha. Uma mensagem curta sob a lista informa quantas linhas têm texto novo; **Review** (Revisar) mostra o conteúdo da ficha ao lado do conjunto, com uma caixa por linha. Nada é escrito antes de **Update selected** (Atualizar selecionadas); só as colunas diferentes das linhas marcadas mudam. Todo o restante é preservado, inclusive a marca.

A comparação é deliberadamente restrita:

- Valores existentes só são comparados em colunas `text`, `longtext`, `dice` e `enum`. Valores `number` e `boolean` pertencem ao jogador e são preservados, inclusive 0 e false. Uma coluna ainda ausente pode ser oferecida com seu valor tipado, incluindo números e interruptores. Uma coluna escalada é excluída porque já acompanha a ficha.
- Só as colunas definidas pela entrada são comparadas. Uma coluna omitida nunca é tocada, qualquer que seja seu conteúdo.
- Um valor recusado pela própria coluna, como um `enum` retirado ou texto acima de `maxLength`, é ignorado em vez de escrito.
- A linha corresponde à de origem pela posição entre as linhas com a mesma marca naquela lista, enquanto a ficha mantiver tantas linhas quanto a entrada escreve. Caso contrário, só funciona se a entrada escrever uma única linha nessa lista. Se o jogador excluir uma de duas linhas, a entrada fica intacta em vez de ser adivinhada.
- Uma linha cuja entrada não existe mais no catálogo fica intacta, silenciosamente.

Assim, reformular ou renomear pode chegar aos personagens que já escolheram a entrada, se aceitarem. Mudar o significado de um número não pode e não vai: essa coluna pertence ao jogador desde que a linha é dele.

## Comandos de ficha: avanço permanente

Um conjunto pode permitir mudanças na construção permanente do personagem com `sheet.advancement`:

```json
"advancement": {
  "fields": ["xp", "level", "humanity", "discipline"],
  "abilities": true,
  "skills": true,
  "saves": true,
  "text": "Award XP at the end of a session; change other values only when earned."
}
```

Inclua só IDs de campo que sua ficha declara como número ou texto (`text` ou `longtext`), no máximo 24. Os booleanos permitem, respectivamente, todos os atributos, perícias ou salvaguardas; omitidos ou falsos significam nenhuma permissão. Um conjunto vazio de permissões, um campo desconhecido, um tipo de campo sem suporte ou uma chave desconhecida são recusados na importação. `text` é uma orientação opcional de no máximo 400 caracteres seguros para prompt. Sem `advancement`, os comandos existentes funcionam como antes e todo pedido `advance` é recusado.

```
[sheet: op="advance" field="xp" by="250" who="party"]
[sheet: op="advance" field="xp" to="1200"]
[sheet: op="advance" field="humanity" by="-1"]
[sheet: op="advance" field="discipline" to="Auspex"]
[sheet: op="advance" ability="str" by="1"]
[sheet: op="advance" ability="str" to="16"]
[sheet: op="advance" skill="stealth" tier="expert"]
[sheet: op="advance" save="will" tier="trained"]
```

Nomeie exatamente um alvo. Campos e atributos aceitam exatamente um entre `by` e `to`; texto só aceita `to`. Nomes e níveis coincidem com IDs ou rótulos, sem distinguir maiúsculas. Perícias e salvaguardas aceitam qualquer nível declarado em `resolution.proficiencyTiers`. Campos numéricos respeitam `integer`, `min` e `max`; atributos respeitam seus limites inteiros; texto respeita `maxLength`. Um valor inválido é recusado com um motivo `bad-amount` que informa o limite, nunca ajustado em silêncio. Avanço desativado, alvos não permitidos, nomes desconhecidos e níveis desconhecidos também são recusados. A tag reescrita leva `result` e o novo valor em `now`. Omita `who` para o jogador, ou use `who="party"` para cada card do grupo sem ambiguidade; recusas parciais nomeiam quais cards não puderam avançar.

O Engine salva a construção no card da partida pelo mesmo armazenamento de metadados de uma edição do jogador, mantendo a versão da ficha e recalculando os valores derivados a partir da nova construção. Os cards da biblioteca não mudam. Como nos comandos vivos, um swipe alternativo ou uma resposta regenerada parte de antes das mudanças da resposta substituída. Cada resposta registra a construção com que termina, inclusive respostas sem avanço. Selecionar um swipe restaura o instantâneo dele; excluir a resposta mais recente revela o instantâneo anterior. Excluir uma resposta mais antiga deixa em vigor um instantâneo posterior até que essa resposta posterior seja removida. Uma continuação atualiza o instantâneo da mesma resposta. Desfazer só muda valores que ainda coincidem com o resultado registrado, então edições posteriores do jogador sobrevivem, e edições não relacionadas não impedem que uma concessão de XP seja desfeita.

<a id="the-use-command-letting-the-game-master-spend-a-price-you-wrote"></a>

## O comando `use`: deixar o Game Master pagar um preço que você escreveu

Enquanto narra, o GM atualiza fichas com comandos `[sheet: ...]`: `spend`, `restore` (`heal` tem o mesmo sentido), `damage`, `temp`, `track`, `condition`, `note` e `rest`. Um conjunto com catálogos recebe mais um:

```
[sheet: who="Mira" op="use" name="Fireball"]
[sheet: who="Mira" op="use" name="Fireball" pool="3rd-level slots"]
```

`op="cast"` equivale a `op="use"` e `spell=` a `name=`; assim, a expressão escolhida pelo GM funciona sem o formato precisar conhecer a palavra "spell".

O nome é comparado sem distinguir maiúsculas às linhas do personagem vindas dos seus catálogos. Uma linha responde ao nome mostrado ao GM (coluna de nome de `sheetSummary`, depois `pools.nameColumn`, depois a primeira coluna de texto) e ao `label` da entrada de origem. Renomear uma linha não faz perder seu acesso. Nomes sem correspondência ou compartilhados por duas entradas diferentes são recusados.

O que é gasto:

- Cada termo de `mechanics.cost`. Um termo que nomeia uma reserva viva paga dela; um que nomeia um GRUPO paga da primeira reserva do grupo capaz de cobrir o custo, na ordem de declaração. Não há subida automática para uma reserva superior, porque um grupo nem sempre é uma escala.
- Mais um de cada reserva de linha escrita pela mesma entrada, como o contador de usos de uma característica: a segunda linha de `Last Ember`. Um contador com máximo 0 não tem usos; o comando é recusado em vez de executado de graça.

`pool=` é o lançamento em nível superior: o mesmo preço único, pago de outra reserva do grupo. Só é aceito se o custo tiver um único termo e a reserva nomeada compartilhar o grupo desse termo ou pagar por ele. Qualquer outra situação é recusada sem reinterpretar.

**Uma reserva que paga por outro grupo** (Capability API 1.171). O `pays` de uma reserva viva nomeia até quatro outros grupos cujos custos ela também pode pagar, no próprio nível (o `level` dela, ou o lugar dela no próprio grupo), e nunca um custo de nível maior que o dela. Os espaços de pacto de 5e pagam magias custeadas pelos espaços de magia, como um bruxo multiclasse pode fazer:

```json
{
  "id": "pact_slots",
  "label": "Pact Slots",
  "group": "pact",
  "max": { "field": "pact_slot_count" },
  "level": { "field": "pact_slot_level" },
  "pays": ["slots"]
}
```

Uma luta oferece uma reserva assim ao lado das reservas maiores do próprio grupo da magia, e um pagamento com ela aumenta a magia em tantos passos quantos o nível dela estiver acima do da magia: um espaço de pacto de 3º nível paga Magic Missile como um espaço de 3º nível pagaria. Um uso cuja própria reserva está vazia continua sendo oferecido, pago só por uma reserva maior ou por uma que paga por ela, então uma magia de 1º nível é conjurada com um espaço de 2º nível depois que os espaços de 1º nível acabam. `targetsPerCostStep` (1.171, de 1 a 10) nas `mechanics` de uma entrada soma essa quantidade de alvos para cada passo acima em que é paga, até no máximo 20: Hold Person é `"targetCount": 1,
"targetsPerCostStep": 1`.

É tudo ou nada. Se qualquer parte não puder ser paga, o comando inteiro é recusado, nada muda e o jogador é avisado. Uma entrada sem custo, como um truque ou característica passiva, é aceita sem mudar nada.

## Dentro do arquivo ou num arquivo próprio

Um catálogo pequeno fica dentro de `ruleset.json`, em `entries` do cabeçalho. Um longo fica num arquivo próprio, nomeado por `asset` no cabeçalho. Cada catálogo tem exatamente uma dessas opções.

```json
{ "id": "knacks", "label": "Knacks", "feeds": ["knacks"], "asset": "catalogs/knacks.json" }
```

O caminho sempre é `catalogs/<the catalog's id>.json`. O arquivo tem este formato:

```json
{ "schemaVersion": 1, "catalog": "knacks", "entries": [] }
```

Arquivos de catálogo separados vêm num pacote: um publicado pelo catálogo oficial ou um arquivo de pacote de conjunto que você mesmo importa (veja [Compartilhar seu conjunto de regras](writing-rulesets.md#sharing-your-ruleset)). O pacote os lista em `contributions.assets.paths` junto a `ruleset.json` e precisa de Capability API 1.21. Um catálogo de criaturas, incluído ou separado, precisa de Capability API 1.27, e um catálogo de itens precisa de 1.49. **Um conjunto importado como arquivo único ou compartilhado pelo GitHub contém os catálogos dentro do arquivo**, então precisam caber no limite total de 512 KB. Isso comporta algumas centenas de entradas curtas.

Os limites são doze catálogos por conjunto, 2000 entradas por catálogo em ambos os formatos e 2 MB por arquivo de catálogo. Um pacote cujo `ruleset.json` passa de 256 KB, ou com um arquivo de catálogo acima de 1 MB, precisa de Capability API 1.340, que aumentou os dois limites.
