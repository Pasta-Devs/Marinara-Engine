# Roleplay: jogar com um conjunto de regras

Um chat de Roleplay pode ser jogado com um conjunto de regras de mesa, do mesmo tipo que o Game Mode usa. O narrador pede um teste quando acontece algo incerto, o Marinara rola os dados a partir da ficha do personagem e a resposta conta o que a rolagem decidiu. Use isso quando quiser dados de verdade e uma ficha de personagem em um roleplay sem começar uma partida de Game Mode.

Qualquer conjunto de regras que você tenha instalado para o Game Mode funciona, como 5e (SRD 5.1), e as fichas que você já fez para ele no editor de personagens e de personas também.

## Ativar um conjunto de regras em um chat

Antes de começar: instale um conjunto de regras. Veja [Obter um conjunto de regras](../game/rulesets.md#get-a-ruleset).

1. Abra o chat de Roleplay.
2. Abra **Chat Settings** (Configurações do chat) e encontre a seção **Ruleset** (Conjunto de regras).
3. Escolha um conjunto de regras na lista. Ela mostra os conjuntos que você tem instalados.
4. O Marinara dá uma ficha a cada membro do chat e diz quantas acrescentou. Cada membro aparece listado abaixo do conjunto de regras.

Cada membro recebe uma cópia da própria ficha para esse conjunto de regras, vinda do editor de personagens ou de personas (veja [Fichas de conjuntos de regras](../characters/colors-and-stats.md#ruleset-sheets)). Um membro sem ficha recebe uma em branco, marcada como **blank sheet** (ficha em branco) na lista, para montar no chat. Sua persona vem primeiro. As mudanças no chat ficam no chat e nunca voltam para o personagem ou a persona.

Se não funcionou: um conjunto de regras importado precisa de **Allow custom Agent imports** (permitir importações de agentes personalizados) ativado. Veja [Obter um conjunto de regras](../game/rulesets.md#get-a-ruleset).

### Montar uma ficha em branco

1. Na seção **Ruleset**, clique em **Build sheet** (montar ficha) ao lado do membro.
2. A ficha de personagem abre no editor de fichas. Quando o conjunto de regras tem um construtor passo a passo, ele abre ali primeiro, igual ao Game Mode e ao editor de personagens.
3. Faça suas escolhas e clique em **Save sheet** (salvar ficha).

### Acrescentar uma ficha para um novo membro

Quando um personagem entrar no chat mais tarde, clique em **Add missing sheets** (adicionar as fichas que faltam). Os membros que já têm ficha continuam com ela.

### Remover uma ficha

Um membro que não deveria ter ficha, como um card de narrador, pode perdê-la.

1. Na seção **Ruleset**, clique no ícone de lixeira ao lado do membro.
2. Clique em **Remove sheet** (remover ficha).

O chat lembra disso, então **Add missing sheets** e uma versão mais nova do conjunto de regras deixam esse membro de fora. Para dar uma ficha de novo, clique no botão dele depois de **No sheet:** (Sem ficha), como **Give Mira a sheet** (Dar uma ficha a Mira).

### Trocar o conjunto de regras ou desligá-lo

- Escolha **None** (Nenhum) para parar de jogar com o conjunto de regras. As fichas são mantidas, então escolher o mesmo conjunto outra vez continua de onde você parou.
- Escolher outro conjunto recomeça todas as fichas, porque uma ficha feita para um conjunto não significa nada para outro.

## Testes durante o jogo

Você escreve seu turno como de costume. Quando seu personagem tenta algo incerto cujo resultado importa, o narrador escreve um teste em vez de decidir o resultado. O Marinara rola o teste a partir da ficha, e então o narrador escreve o que a rolagem decidiu.

A mensagem pronta mostra um cartão de dados onde o teste aconteceu, com a perícia, a dificuldade, os dados e **Success** (Sucesso) ou **Failure** (Falha). Ações comuns que não podem falhar de verdade não recebem teste.

> **Dica:** Alguns modelos ignoram a instrução de pedir testes e decidem o resultado sozinhos. Se nenhum teste aparecer, tente um modelo mais forte na **Connection** (Conexão) do chat.

Testes não são rolados em turnos de **Impersonate** (Personificar). Uma sala multijogador não pode jogar com um conjunto de regras.

## Usar as fichas de personagem

Clique em **Open sheet** (Abrir ficha) ao lado de um membro na seção **Ruleset**. A ficha é a mesma que o Game Mode mostra. O botão de pergaminho no topo do Tracker Panel abre a ficha da sua persona.

- Clique em **−** e **+** ao lado de uma reserva ou trilha, como pontos de vida ou estresse, para mudá-la. A mudança é salva com a mensagem atual, então acompanha os swipes (respostas alternativas) e as ramificações.
- Clique em **Edit ruleset sheet** (editar a ficha do conjunto) para mudar valores, graduações de perícia, campos e listas, e depois em **Save sheet** (salvar ficha).

O narrador lê as fichas em cada turno e as muda com comandos de ficha na resposta, que o Marinara aplica e esconde da mensagem. Para descansar, diga isso no seu turno, por exemplo "a gente faz um descanso longo". O narrador registra o descanso, e as fichas recuperam o que o descanso do conjunto de regras restaura. Você também pode clicar em **Rest** (Descanso) em uma ficha.

## Criar seu próprio conjunto de regras

O construtor de conjuntos de regras cria um conjunto de regras pequeno a partir de um formulário: como os testes são rolados, o que vai na ficha e o que é dito ao narrador. Use-o para um sistema que o Marinara não tem. Um conjunto de regras criado por você funciona como um instalado, no Roleplay e no Game Mode.

Antes de começar: ative **Allow custom Agent imports**, porque o construtor salva o conjunto de regras do mesmo jeito que uma importação. Veja [Obter um conjunto de regras](../game/rulesets.md#get-a-ruleset).

1. Em **Chat Settings → Ruleset**, clique em **New ruleset…** (novo conjunto de regras).
2. Digite um **Name** (nome).
3. Em **Dice** (dados), escolha como os testes são rolados (veja a tabela abaixo). Escolher um preenche os atributos, as reservas e as trilhas iniciais, que você pode mudar.
4. Mude **Difficulties** (dificuldades), **Stats** (atributos), **Skills** (perícias) e o resto do formulário. A maioria das seções se explica em uma linha abaixo do título.
5. Clique em **Create ruleset** (criar conjunto de regras).

O Marinara salva o conjunto de regras. Em um chat sem conjunto de regras, ele também ativa o novo. Um chat que já tem um conjunto de regras continua com ele e com as fichas dele; para trocar, escolha o novo conjunto de regras na lista.

Se um conjunto de regras instalado já rola do jeito que você escolheu, a seção **Dice** o nomeia. Cada conjunto de regras é uma ficha separada em cada personagem, então, para manter uma só ficha por personagem, jogue com esse conjunto de regras ou edite-o em vez de criar outro.

| Dados | Como um teste é rolado |
| --- | --- |
| **d20 + modifier** (d20 + modificador) | Um d20 mais o atributo e a perícia, contra um número de dificuldade. |
| **2d6 bands** (patamares de 2d6) | 2d6 mais o atributo: 10 ou mais é um acerto forte, 7 a 9 um acerto fraco e 6 ou menos uma falha. |
| **Dice pool** (parada de dados) | Um dado por ponto de atributo e de perícia. Cada dado que alcança o número-alvo conta. Você escolhe d6 ou d10 e o alvo. |
| **Highest d6** (d6 mais alto) | Um d6 por ponto, ficando com o mais alto: 6 é um sucesso completo, 4 ou 5 um parcial, e dois 6 um crítico. |
| **Percentile** (percentil) | Um d100. O teste é bem-sucedido com um resultado igual ou menor que o número da perícia. |
| **Hope and Fear** (Esperança e Medo) | Dois d12 mais o atributo. O dado mais alto diz se o resultado vem com Esperança ou com Medo. |
| **No dice** (sem dados) | Nenhum dado é rolado. O atributo e a perícia são somados e comparados com a dificuldade. |

### Mudar um conjunto de regras que você criou

1. Ative o conjunto de regras em um chat.
2. Em **Chat Settings → Ruleset**, clique em **Edit ruleset** (editar o conjunto de regras).
3. Faça suas alterações e clique em **Save new version** (salvar nova versão).

O chat passa para a nova versão e mantém todas as fichas. Renomear um atributo, uma perícia, uma reserva ou uma coluna de lista mantém o que cada personagem tem ali. Outro chat com o mesmo conjunto de regras passa para a nova versão quando você clica em **Add missing sheets** nesse chat.

**Edit ruleset** aparece para um conjunto de regras que você criou ou importou de um arquivo, quando o formulário consegue contê-lo inteiro: um feito pelo construtor, ou um arquivo escrito à mão que usa só o que o formulário mostra. Ele não aparece para um conjunto de regras de um pacote ou de um repositório. O construtor nunca abre um conjunto de regras com algo a mais, como regras de combate ou comentários, então não pode perder o que não mostra. Ele também só aparece em um chat que joga a versão mais nova; em um chat com uma mais antiga, clique primeiro em **Add missing sheets**.

### Organizar a ficha

| No formulário | Na ficha |
| --- | --- |
| A ordem das linhas | Atributos, perícias, reservas, trilhas, campos e abas de listas aparecem na ordem do formulário. Arraste uma linha pela alça para movê-la, ou dê foco à alça e pressione as setas para cima e para baixo. |
| O **Group** (grupo) de um atributo ou de uma perícia | Atributos ou perícias com o mesmo grupo aparecem sob um mesmo título. |
| **Skill ranks** (graduações de perícia) | As graduações que você escolhe para cada perícia na ficha, cada uma com o que acrescenta: ao total em uma rolagem de d20 ou de 2d6, dados em uma parada, pontos em um percentil. |
| **Show ranks on the sheet as** (mostrar as graduações na ficha como) | O que a ficha mostra ao lado de cada perícia e salvaguarda treinada: **Check value (+2)** (valor de teste), o **Rank name** (nome da graduação), **Dots (●●○)**, **Roman numerals (II)** ou o **Rank number (2)**. Os testes e a cópia da ficha que o narrador recebe continuam iguais. |
| **Practice meter** (medidor de prática) | Cada perícia treinada mostra quanto já avançou rumo à próxima graduação, de 0 a 99%. A prática na história faz o medidor subir, e uma subida de graduação o faz recomeçar. Você pode corrigi-lo na ficha. Em **No meter for:** (sem medidor para), marque um grupo para deixar as perícias dele de fora. |
| **Number** (número), **Bar** (barra) ou **Dots** (bolinhas) em uma reserva ou trilha | Só o número, uma barra de preenchimento ao lado dele ou uma fileira de bolinhas preenchidas até ele, uma bolinha por ponto. Mais de 20 bolinhas aparecem como uma barra. |
| **Lists** (listas) | Cada lista ganha a própria aba, com o nome da lista, a menos que você digite outro nome de aba. Listas com o mesmo nome de aba dividem uma aba. |
| As colunas de uma lista | Toda linha tem um nome, mais as suas colunas: **Text** (texto), **Number** ou **Checkbox** (caixa de seleção). A primeira coluna de caixa de seleção aparece como uma marca de seleção ao lado de cada nome. |

### Contar as suas regras ao narrador

A seção **Prompts** guarda o que é dito ao narrador sobre o seu conjunto de regras. **Checks** (testes) e **Keeping the sheets** (manter as fichas) mostram um texto padrão; deixe qualquer um dos dois vazio para usá-lo. As quebras de linha viram espaços. Nomes e prompts não podem conter colchetes nem chaves duplas, porque as marcações e as macros do narrador os usam.

| Caixa | Para que serve |
| --- | --- |
| **Checks** | Quando pedir um teste e como escolher a perícia e a dificuldade. |
| **Keeping the sheets** | Como as fichas mudam durante o jogo. |
| **Rules reference** (referência de regras) | Regras da casa e qualquer outra coisa que o narrador deva ter sempre diante de si. |
| **World (Game Mode)** (mundo: Game Mode) | É lido uma vez quando uma partida de Game Mode é criada com o conjunto de regras, para que o mundo dela combine com as regras. |

## Solução de problemas

| Sintoma | Solução |
| --- | --- |
| **This chat's ruleset is not installed here, so its checks and sheets are paused.** | Instale o conjunto de regras de novo ou escolha outro. |
| O narrador nunca pede testes. | Use um modelo mais forte para o chat. Alguns modelos ignoram a instrução dos testes. |
| Um personagem novo não tem ficha. | Clique em **Add missing sheets**. |

## Guias relacionados

- [Game Mode: jogar com um conjunto de regras](../game/rulesets.md)
- [Game Mode: dados e testes de perícia](../game/dice-and-skill-checks.md)
- [Roleplay Mode: primeiros passos](getting-started.md)
