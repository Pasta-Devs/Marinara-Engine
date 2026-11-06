# Guia do criador de conjuntos de regras

Use esta página para planejar um conjunto de regras de Game Mode para o seu próprio sistema de mesa antes de abrir as páginas de referência. Ela explica como as partes de um conjunto de regras se encaixam, quais escolhas mais importam e o que aprendemos ao converter 16 sistemas muito diferentes. A referência de cada chave começa em [Escrever conjuntos de regras de Game Mode](../extending/writing-rulesets.md), e cada seção abaixo traz um link para a página que resume.

Um conjunto de regras é um arquivo JSON (ou um pacote de arquivos) que informa ao Marinara Engine como o seu sistema funciona. O Engine então rola cada teste, aplica cada mudança na ficha e pode conduzir lutas inteiras pelas suas regras. Nada em um conjunto de regras é código, então você cria o sistema preenchendo mecânicas que o Engine já conhece. Uma mecânica que ele não conhece exige uma solicitação de recurso para o Engine.

Um número entre parênteses após uma chave, como (1.135), indica a versão secundária da Capability API que a adicionou. Um pacote que usa a chave declara essa versão secundária ou uma mais recente. Quando não há número, ele é informado na página de referência vinculada (veja [Versionamento, testes e publicação](#versioning-testing-and-publishing)).

É fácil confundir dois termos:

- **Classic e Tactical** são _estilos de combate_: uma batalha por menus com fileiras de frente e de trás, ou uma batalha num tabuleiro. Toda partida, com ou sem conjunto de regras, usa um deles.
- **As regras próprias do Marinara** são o que uma partida usa quando não tem conjunto de regras. Um conjunto de regras as substitui.

## Anatomia de um conjunto de regras

Um conjunto de regras é um arquivo JSON de no máximo 512 KB, validado por inteiro na importação. Conjuntos de regras maiores dividem os catálogos em um pacote. Comece copiando o exemplo mais próximo dos seus dados:

- [`ember-roads.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/ember-roads.json): 2d6 mais um atributo.
- [`gravewatch.json`](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/examples/rulesets/gravewatch.json): uma reserva de d10.
- O [pacote 5e (SRD 5.1)](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014) completo no Marinara-Agents.

Aponte o editor para o [JSON Schema](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/extending/ruleset.schema.json) com uma linha `$schema` para ter preenchimento automático e verificação de erros de digitação.

| Chave | Conteúdo | Referência |
| --- | --- | --- |
| `schemaVersion`, `id`, `version`, `name`, `edition`, `license` | Identidade. `version` é um número inteiro aumentado a cada mudança publicada | [Escrever conjuntos de regras](../extending/writing-rulesets.md) |
| `coverage` | O que o conjunto de regras cobre (testes, combate e assim por diante) e o resumo de uma linha no assistente de configuração | [Escrever conjuntos de regras](../extending/writing-rulesets.md) |
| `resolution` | Como um teste é rolado: um de cinco tipos, mais faixas de resultado, gastos e novas rolagens | [Testes](../extending/ruleset-checks.md) |
| `sheet` | Atributos, perícias, campos, listas, reservas vivas, trilhas, estados, trilhas de ferimentos, penalidades, migrações | [Fichas](../extending/ruleset-sheets.md) |
| `party`, `clocks` | Uma ficha compartilhada do grupo (tripulação, nave, pontos de história) e relógios de progresso | [Fichas](../extending/ruleset-sheets.md) |
| `rests` | O que cada descanso restaura e limpa | [Fichas](../extending/ruleset-sheets.md) |
| `gm`, `gmReference` | Texto do Game Master, o resumo por personagem, quem joga com os oponentes e uma referência de regras de até 16,000 caracteres | [Fichas](../extending/ruleset-sheets.md) |
| `catalogs` | Entradas prontas (magias, talentos, criaturas), cada uma com um bloco `mechanics` opcional | [Catálogos](../extending/ruleset-catalogs.md), [Mecânicas](../extending/ruleset-mechanics.md), [Construtor](../extending/ruleset-character-builder.md) |
| `items` | Categorias, armas, armaduras, munição, saque, dinheiro, equipamento inicial, mercados | [Itens](../extending/ruleset-items.md) |
| `battle` | Empresta os números da ficha às lutas Classic e Tactical do próprio Marinara | [Combate](../extending/ruleset-combat.md) |
| `combat` | Conduz a luta inteira pelas suas regras, com bestiário, tabuleiro, reações e disputas | [Combate](../extending/ruleset-combat.md) |
| `layers` | Variantes que um jogador ativa para uma partida (Low magic, Hard winter) | [Camadas e traduções](../extending/ruleset-layers-and-translations.md) |

**IDs.** O ID do conjunto de regras usa letras minúsculas, dígitos e hífens simples (`ember-roads`). Os IDs dentro da ficha usam letras minúsculas, dígitos e sublinhados, começando com uma letra (`grit_max`). Mantenha os IDs estáveis depois de publicar, porque personagens salvos, outros conjuntos de regras que aproveitam seus catálogos e sobreposições de Experiences apontam para eles.

**Texto seguro para prompts.** Tudo o que chega ao modelo (nomes, rótulos, texto do Game Master) ocupa uma linha, sem colchetes e sem `{{` ou `}}`.

**Pacotes.** Um conjunto de regras grande demais para um arquivo é distribuído como `<id>.ruleset.json`: um manifesto mais `ruleset.json`, até 12 arquivos `catalogs/<id>.json` de 2 MB cada e até 40 traduções, tudo em base64. Zips são recusados. Um editor de conjuntos de regras como o Pixelforge cria esse arquivo para você. O manifesto declara a versão secundária da Capability API de que o conjunto de regras precisa.

**Onde um conjunto de regras é classificado.** Um arquivo importado se torna `local/<id>`, o de um repositório do GitHub se torna `<owner>/<id>` e o do catálogo oficial mantém apenas seu ID. Dois autores podem publicar um `v20` cada um sem conflito.

## Testes, dados e a ficha

A primeira e maior decisão é `resolution.kind`, porque todo o resto é lido por meio dela. O Game Master só indica uma perícia e uma dificuldade. O Engine rola, faz os cálculos com os valores da ficha e informa o resultado ao modelo, então nunca escreva texto de Game Master que peça ao modelo para fazer contas.

| Tipo | Como rola | Sistemas a que se aplica |
| --- | --- | --- |
| `dice-sum` | Rola dados, soma números da ficha, alcança ou supera uma dificuldade. Há suporte a faces personalizadas, cadeias abertas e dados explosivos | Jogos d20, 2d6 mais atributo, Fate (4dF com faces −1/0/+1), Rolemaster |
| `dice-pool` | Rola uma quantidade de dados lida da ficha e conta os que atingem um alvo. O alvo pode vir da ficha, por teste, acima ou abaixo | World of Darkness, Exalted, jogos semelhantes a Shadowrun, Lasers & Feelings |
| `dice-highest` | Rola uma reserva e lê o maior dado, ou soma alguns dos maiores. Há suporte a uma regra para zero dados e a um segundo conjunto "sombrio" | Blades in the Dark e outros jogos Forged in the Dark, Trophy Dark |
| `roll-against` | Rola igual ou abaixo (ou acima) do número da ficha | Call of Cthulhu, GURPS, BRP, X em 6 de jogos da velha escola |
| `symbol-pool` | Monta e aprimora dados narrativos, anula símbolos opostos | Genesys e semelhantes |

Depois adicione o que o seu sistema precisa. Tudo está em [Testes de conjuntos de regras](../extending/ruleset-checks.md):

- **Faixas de resultado** (`resolution.outcomes`, 1.135): de dois a oito resultados com rótulos por margem ou total, como graus de sucesso, "sucesso a um custo" ou sucessos difíceis e extremos. Cada faixa pode conter uma linha que informa ao Game Master o que ela significa na mesa. Esse foi o recurso mais necessário entre os sistemas que convertemos.
- **Testes que rolam do próprio jeito** (`resolution.overrides`, 1.140): algumas perícias com dados diferentes, como perícias de ladrão com d100 e Open Doors com d6 num jogo d20.
- **Gastar para mudar uma rolagem** (`resolution.spend`) e novas rolagens gratuitas (`resolution.reroll`): força de vontade por um sucesso, Luck, pontos de herói. `perCheck` limita o que uma rolagem pode comprar, então uma reserva cheia não pode comprar um resultado garantido.
- **Um amuleto que muda uma rolagem**: coloque `mechanics.check` na entrada de catálogo que um personagem escolheu, pago com o custo da própria entrada.

**O que um teste ainda não pode fazer.** Reservas opostas (duas rolagens comparadas) e reservas somadas com um dado curinga, como em OpenD6. Ambas precisam de um novo tipo de resolução dentro do Engine. Se o seu sistema depende de uma delas, abra uma solicitação de recurso no repositório do Engine com algumas rolagens resolvidas; elas viram os testes.

**A ficha** ([Fichas de conjuntos de regras](../extending/ruleset-sheets.md)) contém atributos, perícias, campos, listas e valores derivados, além do estado vivo que o Engine altera durante a partida:

- **Reservas** como pontos de vida, força de vontade, partículas de essência ou espaços de magia, gastas e restauradas por comandos de ficha e descansos.
- **Trilhas** como estresse, Ruin ou XP, com gatilhos quando ficam cheias.
- **Trilhas de ferimentos**, para saúde representada por níveis nomeados ou caixas numeradas em vez de um número, com penalidades nas rolagens.
- **Estados vivos** como uma forma, uma postura ou anima, que podem alterar as rolagens enquanto duram.
- **Ficha do grupo e relógios**: tripulação, nave ou pontos de história compartilhados e relógios de progresso de 4, 6 ou 8 segmentos.

O Game Master altera a ficha por meio de comandos de ficha que o Engine ensina a ele automaticamente, usando os seus próprios IDs, então você não os explica em `gm.sheetGuidance`. O avanço permanente (XP, novos pontos, aumentos de nível) usa comandos de ficha de catálogo; veja [Catálogos de conjuntos de regras](../extending/ruleset-catalogs.md).

**Criar personagens.** O [construtor de personagens](../extending/ruleset-character-builder.md) conduz um jogador pelas etapas que você define: origem e classe, pontuações (roladas, compradas ou atribuídas), proficiências, magias, equipamento e dinheiro inicial, com verificações de validade e criação compartilhada do grupo. Catálogos podem aproveitar o catálogo de outro conjunto de regras instalado com `from` (1.220), então uma variante de 5e pode reutilizar as criaturas e magias do SRD em vez de copiá-las.

**Texto do Game Master.** `gm.checkGuidance` e `gm.sheetGuidance` (1,500 caracteres cada) são enviados a cada turno, então mantenha-os concisos. `gm.worldGuidance` é lido uma vez, quando o mundo é criado ("sem pólvora", "magia é rara"). `gmReference` contém até 16,000 caracteres de regras mais completas no prompt de sistema estável. `gm.sheetSummary` escolhe o que o modelo vê por personagem, e tudo ali custa tokens a cada turno. Escreva tudo com as suas próprias palavras, nunca copiando texto de um livro de regras.

## Combate

Um conjunto de regras participa das lutas em um de três níveis de profundidade. Você pode começar de forma simples e aprofundar depois. Escolha conforme a importância das lutas para a identidade do seu sistema.

| Profundidade | O que você escreve | O que acontece numa luta | Indicado para |
| --- | --- | --- | --- |
| Nenhuma | Nenhum bloco `battle` ou `combat` | O combate Classic ou Tactical do próprio Marinara monta os combatentes por conta própria. A ficha não é alterada | Sistemas narrativos em que as lutas são ficção (Fate, Blades, Trophy) |
| Emprestar a ficha | Um bloco `battle`: reserva de saúde, reserva de energia opcional, espaços de magia, até 8 listas de perícias | Os cálculos e dados são os do Marinara, mas a saúde começa na mesma proporção da barra que na ficha, e o resultado é escrito de volta | Sistemas leves que querem consequências duradouras |
| Suas próprias regras | Um bloco `combat` | Seus dados resolvem cada ataque, salvaguarda e disputa. Os oponentes vêm do bestiário ou da escala de ameaça, e cada custo é escrito na ficha assim que ocorre | Sistemas táticos com regras detalhadas (5e, Pathfinder, Storyteller, Genesys) |

**O bloco `combat`** parametriza um dos três tipos que o Engine conhece: `attack-vs-defense` (dados contra um número de defesa), `dice-pool` (suas reservas, contando sucessos) ou `symbol-pool` (dados narrativos com gastos, 1.382). O essencial é `health` (uma reserva que diminui, uma trilha de ferimentos marcada ou uma trilha comum que se enche, 1.383), `defense`, `initiative`, `attackRoll`, uma `economy` de ações e as listas que se tornam `attacks` e `abilities`. Um bloco pequeno completo tem cerca de 25 linhas; o bloco de Ember Roads em [Combate de conjuntos de regras](../extending/ruleset-combat.md#combat-a-fight-your-own-rules-resolve) é um bom modelo.

Além do essencial, adicione o que o seu sistema precisa:

- **Condições**, com efeitos de uma lista fechada (defesa, rolagens de ataque, salvaguardas, disputas, velocidade, saúde máxima, dano causado e recebido).
- **Salvaguardas**, concentração, regras para personagens morrendo e reações mantidas em **janelas** (uma entrada pode esperar por `used`, `aimed`, `hit`, `harmed`, `falls` ou `turn-start`).
- **Disputas** para agarrar, empurrar e se soltar.
- **Criaturas**: um catálogo de bestiário que a luta lê, com blocos de estatísticas, ações, sentidos e conjuração. Uma **escala de ameaça** permite ao Game Master inventar um oponente para uma luta, e `combat.threat.budget` (1.803) monta encontros com um orçamento de experiência por dificuldade.
- **Mecânicas de entradas** nas entradas de catálogo: formatos de área, zonas duradouras, paredes, invocações, curas e sentidos. Veja [Mecânicas de entradas de conjuntos de regras](../extending/ruleset-mechanics.md).

**Classic ou Tactical.** Suas próprias lutas só recebem um tabuleiro se `combat` declarar `distance` (`label`, `perCell`) e a ficha ou as criaturas fornecerem movimento. Sem isso, uma partida Tactical ainda joga pelas suas regras no teatro da mente. Se as suas regras dependem de posição (áreas, alcance, flanqueamento), defina `"styles": ["tactical"]` (1.379) para que toda partida com o seu conjunto de regras tenha um tabuleiro.

**A arte das criaturas** é separada das regras: um [pacote de criaturas](../extending/writing-creature-packs.md) (`.creatures.json`, mais fácil de criar no Pixelforge) desenha o bestiário no tabuleiro Tactical pela correspondência de IDs de criaturas. Tudo que não tem arte mantém um token.

**Os limites conhecidos** estão em [Ainda não](../extending/ruleset-combat.md#not-yet). Os que mais afetaram as conversões foram rolagens de defesa opostas (Dodge e Fight Back, Parry e Block), locais de acerto, iniciativa por lado e reações a reações. O Game Master narra essas partes ao redor da luta do Engine.

## A IA das lutas: mentes, temperamentos e quem joga com os oponentes

O Engine joga com cada oponente e companheiro de IA que ninguém mais controla, sem chamar o modelo a cada turno. Ele é independente do conjunto de regras: ele foi testado em conversões de Storyteller, Exalted, jogos da velha escola, Call of Cthulhu, GURPS e Genesys, além de 5e. Funciona sem nenhuma das chaves abaixo; elas fazem suas criaturas lutarem de acordo com suas características. Todas estão em [Mecânicas de entradas de conjuntos de regras](../extending/ruleset-mechanics.md), e o design está em [IA de combate de Game Mode](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/game-combat-ai.md).

| Chave | O que controla | API |
| --- | --- | --- |
| `mind` em uma criatura, ou graus de `combat.minds` associados a um atributo | Quanto ela pensa: `mindless`, `instinct`, `cunning`, `tactical`, `genius`. Feras usam instinto por padrão, construtos e limos não raciocinam | 1.761 |
| `behavior.temperament` | Como luta: reckless, cautious, opportunistic, protective, supportive, disciplined, cowardly, patient, methodical, coordinated | 1.763 |
| Temperamentos atribuídos apenas pela história | `fanatical` (nunca perde a coragem), `arrogant` (se contém, alça voo quando é lendária e está perdendo), `territorial`, `cruel`, `honourable` (oferece Surrender (render-se) ao grupo), `hungry` (arrasta uma vítima para longe). Nunca atribuídos ao acaso | 1.778 a 1.784 |
| `behavior.role` | bruiser, bulwark, skirmisher, marksman, spellcaster, supporter, controller, `solo` (1.776). Atribuído a partir das capacidades da criatura quando não é informado | 1.763 |
| `behavior.targets`, `opens`, `pack`, `ambush` | Prioridades de alvo, uma ação de abertura, táticas de matilha, esperar escondido | 1.763 |
| `behavior.shifts` | Um temperamento que muda quando a criatura fica ensanguentada, um aliado cai, o líder cai ou ela fica encurralada | 1.779 |
| `combat.morale` | Quando e como os inimigos testam a coragem (2d6 abaixo de uma pontuação, ou uma salvaguarda) e quem se rende | 1.762, 1.775 |
| `gm.opposition: "game-master"` | O Game Master joga com cada oponente, escolhendo entre as opções legais do Engine, com o Engine como alternativa | 1.774 |

`behavior` pode ficar no bloco `combat` inteiro, num tipo de criatura ou num bloco de estatísticas, cada um prevalecendo sobre o anterior. Exemplos do SRD: um lobo `{"targets": ["wounded"], "pack": true}`, um goblin `{"temperament": "cowardly", "targets": ["weakest"]}`, um carniçal `{"ambush": true}`.

**Para lutas no tabuleiro, a IA precisa de** `combat.distance`, movimento (`combat.economy.movement` ou um `speed` de criatura), um `range` em ataques à distância e linhas de armas e uma `area` em tudo que atinge uma zona. Sem alcance, uma pistola só funciona à distância de um braço. Sem áreas, a IA nunca se espalha.

**Sistemas narrativos.** Por padrão, o Engine joga com inimigos comuns e o Game Master joga com chefes. Para um sistema cuja oposição é ficção em vez de dano (Fate, Blades, Trophy, Lasers & Feelings), `gm.opposition: "game-master"` permite ao modelo jogar com cada oponente sem sair do personagem. Isso só tem efeito quando o jogador ativou "GM directs bosses" na configuração, porque essa é a autorização dele para chamadas ao modelo durante as lutas.

**Sem um bloco de combate**, suas partidas ainda têm moral nas lutas Classic e Tactical: cada inimigo que não é chefe e que raciocina recebe uma pontuação de 2 a 12 a partir da mente e do temperamento, e inimigos que pensam podem se render. Quem escreve o encontro pode marcar o `leader` de um lado.

**Temperamento do grupo.** Cada membro do grupo recebe um temperamento a partir de sua Description (descrição) quando uma partida começa, e ele muda apenas por motivos da história na revisão de fim de sessão. Companheiros de IA lutam de acordo com ele. Um conjunto de regras não o define, mas o texto do Game Master pode se apoiar nele.

## Camadas, sobreposições e migrações

Três mecanismos alteram um conjunto de regras sem criar uma cópia independente dele. Use uma camada para uma variante que o jogador escolhe, uma sobreposição para conteúdo que pertence a uma aventura e uma migração quando você muda a estrutura da ficha.

**Camadas** (`layers`, até 12) são botões liga/desliga no assistente de configuração de New Game (nova partida), fixos por toda a duração da partida. Uma camada só pode restringir ou adicionar texto, nunca adicionar regras:

- acrescentar orientações do Game Master (`gm.guidance`, `gm.worldGuidance`; 4,000 caracteres por camada);
- remover valores de um campo enumerado, substituir a escala de dificuldade ou ocultar entradas de catálogo por um filtro declarado;
- remover moedas (1.64), remover vendedores do mercado, marcar itens como não vendidos ou trocar tabelas de saque (1.813);
- declarar `conflicts` com outras camadas.

Uma camada não pode adicionar campo, valor, perícia, reserva, descanso, vendedor ou tabela de saque, mudar o tipo de resolução nem alterar números de combate. Os personagens mantêm tudo que uma camada remove. A camada **Low magic** do SRD é um bom modelo: magias limitadas ao nível 5, itens acima de incomum mais raros e normalmente indisponíveis para venda, criaturas de alta magia fora de encontros aleatórios e orientações de mundo que pedem ao Game Master para explicar por que a magia é rara. Outros autores podem copiá-la. Ainda não há suporte a camadas escritas para o conjunto de regras de outra pessoa.

**Sobreposições** (1.355) permitem ao pacote de mapas de uma Experience adicionar criaturas, condições, condições de ficha, itens e trilhas (1.367) ao seu conjunto de regras enquanto essa Experience está ativa. Mantenha monstros e saques específicos da aventura numa sobreposição, em vez de colocá-los no conjunto de regras base. Uma sobreposição que reutiliza um dos seus IDs, ou que não se encaixa, é descartada por inteiro, mais um motivo para manter os IDs estáveis. Referência: [sobreposições de conjuntos de regras](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/optional-agent-packages.md#capability-api-1355-ruleset-overlays).

**Migrações** (`sheet.migrations`, 1.77) dizem como transferir personagens salvos quando você renomeia um campo, divide um nível em níveis por classe ou divide uma reserva. Adicionar coisas não exige migração; aumente `sheet.version` quando a estrutura da ficha mudar. Referência: [Camadas, traduções e migrações de conjuntos de regras](../extending/ruleset-layers-and-translations.md).

## Traduções

Escreva o conjunto de regras em inglês e distribua cada outro idioma como um arquivo de tradução próprio (1.811). As traduções são apenas para exibição: regras, comandos de ficha e tudo que é informado ao Game Master permanecem em inglês, então uma tradução nunca pode impedir uma partida de funcionar.

Uma tradução usa a string em inglês como chave, palavra por palavra:

```json
{
  "_meta": { "locale": "ru", "direction": "ltr" },
  "package": { "name": "5e (SRD 5.1)" },
  "ruleset": { "Prone": "Лежащий", "Fire Bolt": "Огненный снаряд", "Goblin": "Гоблин" }
}
```

- Os códigos de idioma correspondem aos do próprio Engine (`ru`, `pt-BR`, `zh-Hans`). Uma string ausente ou vazia aparece em inglês, e `pt-BR` recorre a `pt` primeiro.
- **Num arquivo de pacote compartilhado**, coloque-as em `locales/<language>.json`, até 40 de 8 MB cada. A importação mantém apenas o idioma atual do Engine; para trocar, mude o idioma e importe novamente.
- **No catálogo oficial**, cada idioma é um pacote separado, `<id>-<version>.<language>.json`, listado em `locales` na entrada do catálogo com URL, sha256, tamanho e nome e descrição traduzidos para a loja. O Engine baixa apenas o pacote do idioma atual e o troca quando o idioma muda. Distribuir todos os 11 idiomas do SRD num único arquivo aumentou o download de 7 MB para 34 MB, por isso os pacotes são separados.
- Uma tradução corrigida não precisa de uma nova `version`.

O pacote do SRD distribui 11 idiomas dessa forma e é o modelo a copiar. Referência: [Traduções](../extending/ruleset-layers-and-translations.md#translations).

## O pacote 5e (SRD 5.1): um exemplo completo

O [pacote ruleset-5e-2014](https://github.com/Pasta-Devs/Marinara-Agents/tree/staging/packages/ruleset-5e-2014) no Marinara-Agents usa quase todos os recursos desta página, então consulte-o quando quiser ver uma chave em uso real. O que vale a pena copiar:

- **Estrutura**: `ruleset.json` mais um arquivo por catálogo em `catalogs/` (criaturas, magias, itens mágicos e mais), reunidos num pacote `.ruleset.json`. Seu README e MODELING.md explicam como cada regra foi modelada.
- **Licenciamento**: atribuição CC BY 4.0 em `license`, uma linha de "sem afiliação" e nenhum nome de produto protegido por marca registrada em lugar algum.
- **Combate completo**: um bloco d20 `attack-vs-defense` com orçamentos de ação, ação bônus e reação, concentração, reações como Shield e Counterspell, um tabuleiro, um bestiário completo com mentes e temperamentos e um orçamento de encontro.
- **Construtor**: raça, classe, pontuações roladas ou compradas, proficiências, magias e equipamento inicial.
- **Uma camada** (Low magic) e **11 traduções** como pacotes sob demanda.
- **IDs estáveis**: outros conjuntos de regras aproveitam suas criaturas e magias, então seus IDs nunca mudam.
- **Testes de regressão** rodam como uma tarefa própria de CI a cada mudança.

Se o seu sistema é uma variante de d20, considere aproveitar os catálogos dele com `from` (1.220) em vez de copiá-los.

## Criar sistemas semelhantes: o que as conversões nos ensinaram

Convertemos 16 sistemas de uma coleção da comunidade para este formato, de jogos narrativos com poucas regras a Rolemaster. A maior lição: aqui, um conjunto de regras é aplicado, não sugerido. O Engine rola cada teste e aplica cada mudança na ficha, então tudo o que você deixa para "o GM cuida disso" fica de fato sem resolução. Decida cedo o que cabe ao Engine e o que o Game Master narra.

| Família de sistemas | Exemplos | Resolução | Chaves que fizeram funcionar | O que ficou para o Game Master |
| --- | --- | --- | --- | --- |
| Regras detalhadas de d20 e d% | 5e, Pathfinder 2e, Rolemaster | `dice-sum` | Faixas de resultado para graus de sucesso; `openEnded` e `unmodified` para Rolemaster; `gmReference` para tabelas grandes | Tipos de bônus de Pathfinder que não se acumulam; tabelas de críticos de Rolemaster além das faixas |
| Velha escola | OSE | `dice-sum` | `resolution.overrides` para perícias de ladrão (d100) e X em 6 (d6); moral com 2d6 | Iniciativa por lado (jogada como individual) |
| Rolar abaixo | Call of Cthulhu 7e, GURPS Lite | `roll-against` | `against`, dados `tens` de bônus e penalidade, faces críticas, faixas difíceis e extremas | Dodge, Fight Back e Parry opostos; locais de acerto de GURPS |
| Reservas de Storyteller | V20, W20, Exalted 3e, Exalted WoD | `dice-pool` | Trilhas de ferimentos com penalidades, estados vivos (formas, anima), substituições para resultados 1 que não anulam, um bloco `combat` baseado em reservas | Disciplines e Gifts de área, a menos que sejam escritos como entradas |
| Forged in the Dark | Blades in the Dark, Trophy Dark | `dice-highest` | `keep`, `zeroDice`, um conjunto de dados `dark`, faixas (6 / 4 a 5 / 1 a 3), trilhas com `onFull`, relógios, uma ficha do grupo para a tripulação | Lutas, por meio de `gm.opposition: "game-master"` |
| Reservas de postura | Lasers & Feelings, um jogo original | `dice-pool` | `target` lido da ficha, `stances` (abaixo ou acima), `exact` para uma correspondência exata, uma ficha do grupo para a nave | Lutas, como ficção |
| Fate | Fate Core | `dice-sum` | Faces personalizadas para 4dF, faixas para empate e sucesso com estilo | Invocar e forçar como parte da história; lutas como ficção |
| Dados narrativos | Genesys | `symbol-pool` | `combat.kind: "symbol-pool"` com `symbols.spends`, absorção e saúde numa trilha Wounds que se enche | Gastos em testes fora de lutas |

**Conselhos práticos dessas conversões:**

1. **Comece pelos dados, depois a ficha, depois o texto do Game Master.** Faça um teste rolar corretamente antes de adicionar catálogos ou combate.
2. **Use faixas de resultado em todo lugar em que o seu sistema as tem.** O `text` de cada faixa informa ao modelo o que acontece na mesa, que é onde os sistemas narrativos ganham vida.
3. **Prefira não ter bloco de combate a ter um parcialmente correto.** Um sistema narrativo funciona melhor com as lutas próprias do Marinara (ou com oposição do Game Master) do que com um bloco de combate que modela suas regras pela metade.
4. **Se escrever combate, forneça o básico do tabuleiro**: `distance`, movimento, alcances nas armas à distância e ao menos um ataque de área. Toda conversão que testamos com IA carecia de algumas dessas coisas, e suas lutas emperravam ou nunca usavam posicionamento.
5. **Confira o movimento em relação à escala.** Com 2 metros por casa, uma criatura com velocidade 2 não conseguia subir colinas e as lutas emperravam.
6. **Registre as suas fontes.** Mantenha um arquivo de notas por conjunto de regras listando cada regra da fonte e como ela foi convertida, especialmente quando você escolheu entre interpretações conflitantes. É a primeira coisa que os revisores pedem.
7. **Quando de fato falta uma mecânica no Engine**, deixe-a para o Game Master em `gmReference` e abra uma solicitação de recurso com exemplos resolvidos. Muitos recursos desta página (faixas de resultado, `dice-highest`, `roll-against`, lutas de símbolos, relógios, fichas do grupo) existem porque uma conversão os pediu.

<a id="versioning-testing-and-publishing"></a>

## Versionamento, testes e publicação

**Dois números de versão importam.** A `version` do conjunto de regras é um número inteiro que você aumenta a cada mudança publicada. Uma versão instalada nunca é reescrita, e toda partida fica vinculada à versão exata em que foi criada, então uma campanha em andamento nunca muda os cálculos. A versão da **Capability API** diz de quais recursos do Engine o arquivo precisa. O manifesto de um pacote declara `schemaVersion: 2` e `capabilityApi: { "major": 1, "minor": N }`, onde N é a maior versão secundária de qualquer chave que você usa, para que um Engine mais antigo nunca receba a oferta do seu conjunto de regras. Conjuntos de regras do catálogo oficial precisam de pelo menos 1.374. Um arquivo simples que você importa não precisa de nada, porque o Engine que o lê o valida.

**O ciclo de rascunho.** Edite, aumente `version`, importe, inicie uma partida nova. Importar a mesma versão com conteúdo diferente é recusado. Versões antigas continuam instaladas até você remover o conjunto de regras. Aumente `sheet.version` quando a estrutura da ficha mudar e escreva uma migração quando os valores mudarem de lugar.

**Testes.**

- Use a linha `$schema` para que o editor detecte erros de digitação e tipos errados enquanto você escreve.
- Importe: ative **Settings → Advanced → Danger Zone → Allow custom Agent imports** (Configurações → Avançado → Zona de perigo → permitir importações de agentes personalizados), depois use **Agents → Import agents → Game Mode ruleset** (agentes → importar agentes → conjunto de regras do Game Mode). A revisão lista cada problema com seu caminho antes de salvar qualquer coisa, incluindo nomes que não apontam para nada.
- Jogue alguns testes de cada tipo que declarou, incluindo substituições, gastos e cada faixa de resultado. O registro mostra os cálculos reais.
- Se você tem um bloco `combat`, lute tanto em Classic quanto em Tactical, com companheiros de IA, contra criaturas de cada mente. Fique atento a impasses (ninguém consegue alcançar ninguém), fogo amigo de áreas e inimigos que nunca usam suas melhores ações.
- Ative e desative cada camada e mude o idioma do Engine se você distribui traduções.
- Se uma Experience sobrepõe conteúdo ao seu conjunto de regras, `POST /api/game/experience/check` informa o que não se encaixa.
- Peça a alguém que testa jogos e não conhece o seu sistema para criar um personagem com o construtor.

**Publicação.** Há cinco caminhos, começando pelo mais simples (detalhes em [Compartilhar o seu conjunto de regras](../extending/writing-rulesets.md#sharing-your-ruleset)):

1. Envie o arquivo `.json`.
2. Envie um pacote `.ruleset.json`, com catálogos e traduções dentro.
3. Coloque-o num repositório público do GitHub em `rulesets/` (no máximo 32 arquivos). Os usuários adicionam o repositório como fonte personalizada, e ele é classificado sob o seu nome do GitHub.
4. Proponha-o para o catálogo oficial com um pull request para [Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), estruturado como `ruleset-5e-2014`. Isso é indicado para sistemas muito jogados com licenciamento claro.
5. Distribua uma Experience cujo pacote de mapas sobreponha conteúdo de aventura ao seu conjunto de regras.

**Licenciamento.** Publique apenas texto de regras que você tem o direito de compartilhar. Muitos sistemas têm um documento de referência com licença aberta; coloque o ID SPDX e a atribuição exigida em `license`. Um conjunto de regras precisa principalmente de nomes e números, então escreva todo o texto do Game Master com as suas próprias palavras.

### Antes de compartilhar

- [ ] Os IDs são definitivos e seguem as regras de IDs.
- [ ] `license` tem o ID SPDX e a atribuição, e nenhum nome protegido por marca registrada é usado sem permissão.
- [ ] Cada tipo de teste, substituição, gasto e faixa foi rolado ao menos uma vez numa partida.
- [ ] `gm.checkGuidance` e `gm.sheetGuidance` são curtos, nunca pedem ao modelo para fazer contas e estão escritos com as suas próprias palavras.
- [ ] As lutas foram jogadas em cada estilo que o conjunto de regras permite, ou `combat.styles` os limita.
- [ ] O manifesto do pacote declara a versão secundária correta da Capability API.
- [ ] `version` foi aumentada desde o último arquivo que qualquer outra pessoa tem.
- [ ] Um arquivo de notas explica como cada regra da fonte foi convertida.

## Guias relacionados

- [Escrever conjuntos de regras de Game Mode](../extending/writing-rulesets.md)
- [Arquitetura de Game Mode](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/game-mode-architecture.md), para alterar o código de regras do Engine
- [IA de combate de Game Mode](https://github.com/Pasta-Devs/Marinara-Engine/blob/staging/docs/development/game-combat-ai.md)
- [Jogar com um conjunto de regras](../game/rulesets.md)
