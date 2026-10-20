# Cores do personagem e status de RPG

Este guia explica a aba **Colors** (cores) e a aba **Stats** (status) do Marinara Engine. As duas aparecem no editor de personagem e no editor de persona. As cores mudam a aparência de um personagem ou da sua persona no chat. Os status criam valores acompanháveis, como vida ou fome.

## A aba Colors

Todo personagem e toda persona tem uma aba **Colors** no editor. Ela define três cores: a cor do nome, a cor do diálogo e a cor da caixa de mensagem. Deixe o campo vazio para usar a cor padrão do tema do aplicativo naquela parte.

Para abrir a aba Colors:

1. Abra um personagem no editor de personagem, ou uma persona no editor de persona.
2. Clique na aba **Colors**, na lista de abas.
3. Um card **Preview** (pré-visualização) ao vivo aparece, com três campos de cor logo abaixo.

O card **Preview** mostra um nome de exemplo e um balão de mensagem de exemplo. Ele muda conforme você ajusta cada cor, e assim você vê o resultado antes de salvar.

### Extract Colors from Avatar

O botão **Extract Colors from Avatar** (extrair as cores do avatar) escolhe sozinho uma cor de nome, uma cor de diálogo e uma cor de caixa de mensagem a partir da imagem do avatar. O botão só fica ativo quando já existe um avatar. Antes do upload de um avatar, ele fica desativado e mostra **Upload an avatar first**. Depois da extração, as três cores continuam podendo ser alteradas manualmente.

### As três cores

Defina cada cor pelo campo de cor ou digite um valor:

- **Name Display Color**: a cor do nome. Este campo também aceita um gradiente CSS. Um gradiente é uma transição suave entre cores. Exemplo de valor: `linear-gradient(90deg, #f59e0b, #ef4444)`.
- **Dialogue Highlight Color**: a cor do texto que está entre aspas de diálogo. Exemplo de valor: `#ffd700`.
- **Message Box Color**: a cor de fundo do balão de mensagem do chat. Uma cor semitransparente dá o melhor resultado. Exemplo de valor: `rgba(0, 0, 0, 0.5)`.

Uma cor semitransparente deixa parte do plano de fundo aparecer através do balão. O formato `rgba` é vermelho, verde, azul e um valor alfa que vai de 0 (transparente) a 1 (sólido).

<a id="where-your-colors-show"></a>

## Onde as cores aparecem

Cada cor afeta uma parte diferente do chat:

- A cor do nome pinta o nome exibido nas mensagens do chat. No caso de um personagem, ela também pinta o nome nas abas da barra lateral. No caso de uma persona, ela também pinta o nome nos seletores de persona.
- A cor do diálogo pinta o texto que está entre aspas de diálogo. Funciona com aspas retas e com os outros estilos de aspas. Esse texto também pode ficar em negrito, pela seção **Settings** (Configurações). Os chats Conversation não usam essa cor.
- A cor da caixa de mensagem define o plano de fundo dos balões de mensagem daquele personagem ou daquela persona nos chats Roleplay. Os chats Conversation e Game não usam essa cor.

## A aba Stats

Todo personagem e toda persona também tem uma aba **Stats**. Os status são números como HP (pontos de vida), STR (força) ou uma barra de fome. Com os status ativados, o aplicativo acrescenta os valores ao prompt (o texto que Marinara envia para a IA), e assim a IA conhece a situação atual. Os valores definidos aqui são o ponto de partida padrão dos chats novos. Depois, os agentes podem mudá-los durante a história. Veja a seção sobre agentes mais adiante.

A aba **Stats** do personagem e a aba **Stats** da persona são organizadas de formas diferentes, então cada uma é descrita separadamente abaixo.

### Status do personagem: Enable RPG Stats

O personagem tem um botão liga/desliga: **Enable RPG Stats** (ativar os status de RPG). Desligado, nada do que vem abaixo aparece nem é enviado. Ligado, surgem duas seções:

- **Pools**: barras com nome, valor atual, máximo e cor. Personagens novos começam com uma barra de HP e uma de MP, cada uma com 100 de 100. Clique em **Add** (adicionar) para criar outra barra. Clique no X da linha para removê-la.
- **Attributes**: valores numéricos com nome. Personagens novos começam com STR, DEX, CON, INT, WIS e CHA, cada um em 10. Clique em **Add** para criar outro atributo. Clique no X da linha para removê-lo.

### Status da persona: duas seções

A aba **Stats** da persona tem dois blocos separados, cada um com seu próprio botão liga/desliga.

O primeiro bloco é **Persona Status Bars** (barras de status da persona), ativado pela opção **Enable Persona Stats**. Essas barras acompanham necessidades físicas e mentais. Ao ativar, as barras iniciais são Satiety, Energy, Hygiene e Mood, cada uma com 100 de 100. A lista fica na seção **Status Bars**. Cada barra tem nome, valor atual, máximo e cor. Clique em **Add** para criar uma barra e no X para remover uma.

O segundo bloco é **RPG Attributes** (atributos de RPG), ativado pela opção **Enable RPG Attributes**. Funciona igual a um card de personagem. Ele dá à sua persona as seções **Pools** (começando com HP e MP em 100 de 100) e **Attributes** (começando com STR, DEX, CON, INT, WIS e CHA em 10).

<a id="ruleset-sheets"></a>

### Fichas de conjuntos de regras

Quando um conjunto de regras de Game Mode está instalado, como 5e (SRD 5.1), as duas abas **Stats** ganham um bloco **Ruleset sheets** (fichas de conjuntos de regras) abaixo das seções acima. Ele tem uma entrada recolhível para cada conjunto instalado. O bloco também aparece quando um card ainda guarda uma ficha de um conjunto que você não tem mais.

1. Abra a entrada e clique em **Add a sheet** (adicionar uma ficha). Você recebe uma ficha em branco, com todos os valores no padrão do conjunto.
2. Preencha a ficha. O layout vem do próprio conjunto: valores de atributo com os modificadores, campos agrupados por seção, listas como ataques e magias, e as perícias e salvaguardas, cada uma com um nível de treinamento e um bônus extra. Valores calculados, como o bônus de proficiência ou a Percepção passiva, se atualizam enquanto você digita e não podem ser editados.
3. Salve o personagem ou a persona normalmente.

Uma ficha aqui é a **configuração inicial** desse personagem para aquele conjunto. Uma nova partida com o conjunto leva uma cópia. As mudanças feitas dentro de uma partida ficam nessa partida e nunca voltam para o card.

Alguns conjuntos trazem magias, ataques e características prontas. As listas que eles preenchem têm um botão **Add from catalog** (adicionar do catálogo), que abre um seletor com busca, e as linhas que ele adiciona são cópias que você edita como qualquer outra. Daí vêm duas coisas:

- Uma célula que o conjunto mantém para você, como usos que acompanham um valor de atributo ou um recurso de classe que cresce com o nível, aparece no lugar, mas não aceita digitação, com a observação "Set by the ruleset". Ela é recalculada a partir do resto da ficha toda vez que você a edita.
- Quando o texto do próprio conjunto para uma dessas linhas mudou desde que você a escolheu, uma linha abaixo da lista diz quantas linhas têm texto mais novo, com um botão **Review** (revisar). A revisão mostra cada linha com o que a sua ficha guarda ao lado do que o conjunto diz, e uma marcação por linha. **Update selected** (atualizar as selecionadas) grava as linhas marcadas e nada mais. Só o texto é comparado: números, botões liga/desliga e tudo o que você digitou em outra coluna ficam como estão, assim como toda linha que você desmarcar.

Uma ficha de um conjunto que você não tem instalado é mantida, não excluída. Ela aparece como uma linha com um botão **Remove** (remover), nunca é enviada à IA e volta a ser editável quando você instala esse conjunto. Ela também vai junto com o card quando você o exporta. Cada ficha tem um limite de 64 KB.

Uma ficha de um conjunto instalado que esta versão do Marinara não consegue ler, por exemplo uma salva por uma versão mais nova, também é mantida como está. A entrada dela só oferece **Remove this sheet** (remover esta ficha), para que adicionar uma ficha nova nunca a sobrescreva por acidente.

Essas fichas são independentes de **Enable RPG Stats** e **Enable RPG Attributes**. As regras próprias do Marinara Engine as ignoram; partidas com conjunto as usam no lugar dos atributos comuns para testes.

## Como os agentes atualizam os status

Os valores da aba **Stats** viram o estado inicial do chat. Os agentes podem atualizar os valores controlados pelos trackers, descritos abaixo. Os RPG Attributes, como STR e DEX, são contexto do card, e não valores de tracker gerenciados por agentes.

- O agente **Character Tracker** ajusta os Stats rastreados do personagem, inclusive Pools como HP, conforme o combate, a cura e os acontecimentos da história. Ele não acompanha a persona do jogador.
- O agente **Persona Stats** ajusta as **Persona Status Bars** depois de cada mensagem, de acordo com o que acontece na história.
- Os **RPG Attributes** do personagem e da persona são enviados com o card para Combat e Game Mode, e para as rolagens opcionais no Roleplay ou no Game Mode. Os agentes não atualizam esses atributos.

Sem o agente tracker correspondente ativado, os valores controlados pelos trackers ficam nos padrões que você definiu. A aba **Stats** sozinha não atualiza nada. Veja o guia dos agentes integrados para ativar esses agentes.

## Como os status aparecem no HUD

Com os status ativados, eles aparecem no widget de HUD durante o chat. HUD é a faixa de informações no topo do chat, um painel pequeno que mostra os valores ao vivo. As barras usam gradientes coloridos, o que facilita a leitura de relance. O guia do HUD explica a exibição completa e como mover ou esconder esse painel.

## Guias relacionados

- [Criando e editando personagens](creating-and-editing-characters.md)
- [Personas do usuário: criar e editar](personas.md)
- [HUD e trackers](../roleplay/hud-and-trackers.md)
- [Referência dos agentes para download](../agents/built-in-agents.md)
