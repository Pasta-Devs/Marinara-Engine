# Cores do personagem e Status de Roleplay

As abas **Colors** (cores) e **Stats** (status) aparecem tanto no Character Editor (editor de personagem) quanto no Persona Editor (editor de persona). As cores mudam a aparência de um personagem ou de uma persona no chat. Os status criam valores que você pode acompanhar, como vida ou fome.

## A aba Colors

A aba **Colors** define três cores: a cor do nome, a cor do diálogo e a cor da caixa de mensagem. Deixe um campo vazio para usar a cor do tema do aplicativo naquela parte.

1. Abra um personagem ou uma persona no editor correspondente.
2. Clique na aba **Colors**.
3. Um cartão **Preview** (pré-visualização) ao vivo mostra um nome de exemplo e um balão de mensagem de exemplo, com os campos de cor abaixo dele. A prévia muda conforme você altera cada cor, antes de salvar.

### Extract Colors from Avatar

**Extract Colors from Avatar** (extrair as cores do avatar) escolhe as três cores a partir da imagem do avatar. Enquanto não existe avatar, o botão fica desativado e mostra **Upload an avatar first**. Depois, você ainda pode mudar qualquer cor manualmente.

### As três cores

Defina cada uma pelo campo de cor ou digite um valor:

| Campo | O que ele colore | Exemplo de valor |
| --- | --- | --- |
| **Name Display Color** | O nome. Também aceita um gradiente, veja abaixo. | `#f59e0b` |
| **Dialogue Highlight Color** | O texto dentro das aspas de diálogo. | `#ffd700` |
| **Message Box Color** | O fundo do balão de mensagem do Roleplay. | `#123456` |

**Name Display Color** também aceita um gradiente CSS, uma transição suave entre cores:

```text
linear-gradient(90deg, #f59e0b, #ef4444)
```

A aba **Colors** de um personagem também tem **Name Aliases** (apelidos do nome). Digite nomes extras ou apelidos, separados por vírgulas, como `Kate, Kitty, Katherine`. Eles recebem a cor do nome do personagem quando aparecem nas mensagens do chat. O nome principal sempre entra. Ative o recurso por chat em **Chat Settings → Characters** (configurações do chat → personagens).

Para mudar a transparência, use **Settings → Appearance → Roleplay Presentation → Roleplay Messages Background Opacity** (Configurações → Aparência → Apresentação do Roleplay → Opacidade do plano de fundo das mensagens Roleplay).

O controle deslizante substitui a transparência salva nas cores de fundo de personagens, personas e presets, incluindo as cores extraídas. Os valores de cor que você salvou continuam como estão. As cores do nome e do diálogo não são afetadas.

Os pontos de personalização do plano de fundo dos temas personalizados e o Card CSS ainda podem substituir o estilo dos balões do aplicativo.

<a id="where-your-colors-show"></a>

### Onde as cores aparecem

- A cor do nome pinta o nome exibido nas mensagens do chat. No caso de um personagem, ela também pinta o nome nas abas da barra lateral. No caso de uma persona, ela também pinta o nome nos seletores de persona.
- A cor do diálogo pinta o texto dentro das aspas de diálogo, com aspas retas e com os outros estilos de aspas. Você também pode deixar esse texto em negrito em **Settings**. Os chats de Conversation não usam essa cor.
- A cor da caixa de mensagem define o fundo dos balões de mensagem daquele personagem ou daquela persona nos chats de Roleplay. Os chats de Conversation e de Game não usam essa cor.

## A aba Stats

A aba **Stats** define números como HP (pontos de vida), STR (força) ou uma barra de fome. Quando você ativa os status, Marinara acrescenta os valores ao prompt para que a IA conheça a situação atual. Os valores que você define são o ponto de partida padrão dos chats novos. Depois, os agentes podem mudar alguns deles durante o jogo (veja [Como os agentes atualizam os status](#how-agents-update-your-stats)).

As abas **Stats** do personagem e da persona são organizadas de formas diferentes.

### Status do personagem

O personagem tem um botão liga/desliga, **Enable Roleplay Stats** (Ativar Status de Roleplay). Desligado, nada do que vem abaixo aparece nem é enviado. Ligado, surgem duas seções:

- **Pools** são barras com nome, valor atual, máximo e cor. Personagens novos começam com HP e MP, cada um com 100 de 100.
- **Attributes** são números com nome. Personagens novos começam com STR, DEX, CON, INT, WIS e CHA, cada um em 10.

Clique em **Add** (adicionar) para criar um pool ou um atributo, e no X de uma linha para removê-lo.

### Status da persona

A aba **Stats** de uma persona tem dois blocos separados, cada um com seu próprio botão liga/desliga.

- **Persona Status Bars** (barras de status da persona), ativadas com **Enable Persona Stats**, acompanham necessidades físicas e mentais. As barras iniciais são Satiety, Energy, Hygiene e Mood, cada uma com 100 de 100. Em **Status Bars**, cada barra tem nome, valor atual, máximo e cor. Clique em **Add** para criar uma e no X para remover uma.
- **Enable Roleplay Stats** (Ativar Status de Roleplay) funciona como em um card de personagem. Ele dá à sua persona **Pools** (começando com HP e MP em 100 de 100) e **Attributes** (começando com STR, DEX, CON, INT, WIS e CHA em 10).

<a id="mrpg-picks-on-a-card"></a>

### Escolhas de MRPG em um card

As duas abas **Stats** têm uma seção **Game Mode** com um bloco **MRPG**, para partidas com classes MRPG (toda partida nova). Cada partida rola de novo os status MRPG de cada personagem, então o card não guarda números, só três escolhas. Um assistente guiado pede cada uma delas em uma etapa:

1. **Árvore**: a árvore em que o personagem começa. **Auto** deduz a árvore a partir da descrição e da personalidade do card e mostra em qual árvore isso resulta.
2. **Forte em**: até dois status nos quais o personagem progride bem. Cada status diz o que faz.
3. **Fraco em**: um status no qual ele progride mal, ou nenhum.
4. **Revisão**: a classe em que o personagem começa uma partida nova, no nível 1, com a fileira, todos os status, MP e Stamina.

Cada escolha é preservada à medida que você a faz, e **Voltar**, **Avançar** e os nomes das etapas permitem mudar de etapa. Clique em **Concluir** na última etapa. Em seguida, o bloco mostra a revisão: a classe inicial e os status dela, com os fortes e o fraco marcados. Clique em **Editar** para passar pelo assistente de novo. Salve o card normalmente para manter as mudanças.

As escolhas de pontos fortes e fracos influenciam o crescimento oculto do personagem em cada partida. A árvore irmã vem do temperamento dele na partida, e não do card. Veja [Game Mode: classes MRPG](../game/mrpg-classes.md#choose-a-characters-trees).

Os **Status de Roleplay** abaixo do bloco são os pools e os atributos descritos acima. Os chats de Roleplay e as partidas Legacy usam esses valores. Uma partida MRPG usa o bloco MRPG e nunca cria uma ficha a partir deles.

<a id="game-mode-icon"></a>

### Ícone de Game Mode

As duas abas **Stats** têm um bloco **Game Mode Icon** (ícone de Game Mode). Ele define a imagem no token redondo deste personagem ou desta persona no tabuleiro durante um combate em Game Mode. Um pequeno token ao lado das opções mostra o que o tabuleiro vai desenhar.

- **Avatar** é o padrão. Usa o avatar ou, quando não há avatar, as iniciais.
- **Custom image** (imagem personalizada) usa uma imagem da própria galeria do card. Escolha uma das imagens exibidas ali ou envie uma nova, que é adicionada à galeria. Salve o card uma vez antes de usar esta opção.
- **Initials** (iniciais) sempre mostra as iniciais, mesmo com um avatar.

A mesma imagem aparece para este personagem nos outros estilos de combate. Se você excluir a imagem escolhida da galeria, o bloco avisa. Escolha outra ou volte para **Avatar**.

<a id="ruleset-sheets"></a>

### Fichas de conjuntos de regras

Quando um conjunto de regras de Game Mode está instalado, como 5e (SRD 5.1), as duas abas **Stats** ganham um bloco **Ruleset sheets** (fichas de conjuntos de regras) abaixo das seções acima. Ele tem uma entrada recolhível para cada conjunto instalado. O bloco também aparece quando um card ainda guarda uma ficha de um conjunto que você não tem mais.

Uma ficha é a configuração inicial desse personagem para aquele conjunto. Uma nova partida com o conjunto leva uma cópia. As mudanças feitas dentro de uma partida ficam nessa partida e nunca voltam para o card.

1. Abra a entrada e clique em **Add a sheet** (adicionar uma ficha). Você recebe uma ficha em branco, com todos os valores no padrão do conjunto.
2. Preencha a ficha. O layout vem do próprio conjunto: valores de atributo com os modificadores, campos agrupados por seção, listas como ataques e magias, e as perícias e salvaguardas, cada uma com um nível de treinamento e um bônus extra. Valores calculados, como o bônus de proficiência ou a Percepção passiva, se atualizam enquanto você digita e não podem ser editados.
3. Salve o personagem ou a persona normalmente.

Você também pode pedir à Professor Mari que preencha ou altere uma ficha, por exemplo "dê a Rook um Brawn de 2 e acrescente um pé de cabra ao equipamento de Rook". Ela escreve apenas na ficha daquele conjunto, mantém todos os valores dentro dos limites dele e mostra a alteração em um card de mudança.

Alguns conjuntos trazem magias, ataques e características prontas. As listas que eles preenchem têm um botão **Add from catalog** (adicionar do catálogo), que abre um seletor com busca. As linhas que ele adiciona são cópias que você edita como qualquer outra.

- Uma célula que o conjunto mantém para você, como usos que acompanham um valor de atributo ou um recurso de classe que cresce com o nível, aparece no lugar, mas não aceita digitação. Ela traz a observação "Set by the ruleset" e é recalculada toda vez que você edita a ficha.
- Quando o texto do próprio conjunto para uma dessas linhas mudou desde que você a escolheu, uma linha abaixo da lista diz quantas linhas têm texto mais novo, com um botão **Review** (revisar). A revisão mostra cada linha com o seu texto ao lado do texto do conjunto, e uma marcação por linha. **Update selected** (atualizar as selecionadas) grava só as linhas marcadas. Só o texto é comparado. Números, botões liga/desliga e tudo o que você digitou em outra coluna ficam como estão.

Uma ficha de um conjunto que você não tem instalado é mantida. Ela aparece como uma linha com um botão **Remove** (remover), nunca é enviada à IA, volta a ser editável quando você instala esse conjunto e vai junto com o card quando você o exporta. Uma ficha de um conjunto instalado que esta versão não consegue ler, por exemplo uma salva por uma versão mais nova, também é mantida como está. A entrada dela só oferece **Remove this sheet** (remover esta ficha), para que uma ficha nova nunca a sobrescreva por acidente. Cada ficha tem um limite de 64 KB.

As fichas de conjuntos de regras são independentes de **Enable Roleplay Stats**. Uma partida com as regras próprias do Marinara as ignora. Uma partida com um conjunto de regras usa a ficha no lugar dos Attributes acima para os testes.

<a id="how-agents-update-your-stats"></a>

## Como os agentes atualizam os status

A aba **Stats** define o estado inicial do chat. Os agentes atualizam só os valores controlados pelos trackers.

| Valor | Quem muda |
| --- | --- |
| **Pools** do personagem, como HP | O agente **Character Tracker**, conforme o combate, a cura e os acontecimentos da história. Ele não acompanha a persona do jogador. |
| **Persona Status Bars** | O agente **Persona Stats**, depois de cada mensagem. |
| **Roleplay Stats** (Status de Roleplay), como STR e DEX | Nenhum agente. Eles são enviados com o card para o combate e o Game Mode, e para as rolagens opcionais no Roleplay ou no Game Mode. |

Se você não ativar o agente correspondente, os valores controlados pelos trackers ficam nos padrões que você definiu. A aba **Stats** sozinha não atualiza nada durante o jogo. Para ativar esses agentes, veja [Referência dos agentes para download](../agents/built-in-agents.md).

## Como os status aparecem no HUD

Os status ativados aparecem no HUD durante um chat. O HUD é o painel pequeno que mostra os seus valores ao vivo. As barras aparecem como gradientes com cores. Veja [HUD e trackers](../roleplay/hud-and-trackers.md) para saber como mover ou esconder esse painel.

## Guias relacionados

- [Criando e editando personagens](creating-and-editing-characters.md)
- [Personas](personas.md)
- [HUD e trackers](../roleplay/hud-and-trackers.md)
- [Referência dos agentes para download](../agents/built-in-agents.md)
