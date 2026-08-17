# Entradas de lorebook: chaves, posição e momento de acionar

Este guia explica como montar as entradas dentro de um lorebook (um conjunto de fatos do seu mundo). Ele apresenta a aba **Entries** (entradas), as palavras-chave de gatilho e os três tipos de entrada. Também mostra onde cada entrada entra no prompt (o texto que Marinara envia para a IA) e quais controles decidem o momento em que ela é acionada. Se você nunca mexeu com lorebooks, leia antes a [Visão geral dos lorebooks](overview.md).

Uma entrada é um bloco de texto mais as regras que decidem quando Marinara Engine acrescenta esse texto ao prompt da IA. Quando a entrada é ativada, Marinara insere o conteúdo dela e a IA passa a "lembrar" de um fato que você nunca digitou no chat.

## A aba Entries

Abra um lorebook pelo painel **Lorebooks** para chegar ao editor de página inteira. O editor tem duas abas laterais: **Overview** (visão geral) e **Entries**. Clique em **Entries** para ver a lista de entradas. O selo da aba mostra quantas entradas o lorebook tem.

A barra de ferramentas no topo da aba **Entries** traz estes controles:

- A caixa **Search entries…** (buscar entradas): filtra a lista por nome, chaves ou conteúdo da entrada.
- Um menu suspenso de ordenação com **Order**, **Entries**, **Name A→Z**, **Name Z→A**, **Tokens ↓**, **Keys ↓**, **Newest** e **Oldest**. As opções com ↓ ordenam do maior para o menor.
- O botão **Select** (selecionar): liga a seleção múltipla, para copiar, mover ou excluir várias entradas de uma vez.
- O botão **Add Folder** (adicionar pasta): cria uma pasta para agrupar entradas (veja a seção sobre pastas de entradas mais abaixo).
- O botão **Add Entry** (adicionar uma entrada): cria uma entrada em branco no topo da lista.

Abaixo da barra de ferramentas, uma linha de resumo mostra a quantidade de entradas, a quantidade de pastas e o tamanho total estimado, em tokens, de todo o conteúdo das entradas.

## Adicionar e editar uma entrada

Para criar uma entrada, siga estes passos:

1. Abra o lorebook e clique na aba **Entries**.
2. Clique em **Add Entry**. Uma nova linha aparece na lista.
3. Digite um nome no campo de nome da linha. Toda entrada precisa de um nome.
4. Clique na linha (ou na seta em forma de chevron) para expandir o painel lateral com o editor completo.
5. Preencha as palavras-chave e o conteúdo, descritos nas seções abaixo.

Marinara salva as edições sozinha. Enquanto você digita, o painel lateral mostra **Autosaving…**, depois **Saving…** e por fim **Saved automatically**. Se um salvamento falhar, o texto continua onde está e Marinara tenta de novo na edição seguinte. Entradas não têm botão de salvar separado.

Cada entrada aparece como uma única linha compacta. A linha reúne os controles mais usados. Expanda a linha para chegar ao resto.

Para duplicar uma entrada, passe o mouse sobre a linha e clique no botão **Duplicate** (duplicar). Para removê-la, clique no botão **Delete** (excluir). Marinara pede uma confirmação com a pergunta "Delete this lorebook entry?".

## Conteúdo e chaves da entrada

Expanda uma entrada para editar os campos principais.

- **Primary Keys** (chaves primárias): as palavras-chave que acionam a entrada. Quando qualquer uma dessas palavras aparece no chat recente, a entrada é ativada. Digite uma palavra-chave e pressione Enter para adicioná-la como etiqueta.
- **Content** (conteúdo): o texto que Marinara insere no prompt da IA quando a entrada é ativada. Escreva como um fato simples que você quer que a IA saiba. O conteúdo aceita macros de prompt, e uma estimativa de tokens em tempo real aparece abaixo da caixa.
- **Secondary Keys** (chaves secundárias): palavras-chave extras, usadas só quando o tipo da entrada é **Selective**. Veja a seção sobre tipos de entrada abaixo.
- **Description** (descrição): um resumo curto da entrada. Só o agente **Knowledge Router** lê esse campo, para decidir se insere a entrada. Ele nunca vai como conteúdo para a IA principal. Veja [Fontes de conhecimento](../agents/knowledge-sources.md).

Veja um exemplo simples.

- Nome: `Silverhaven`
- Primary Keys: `Silverhaven`, `the capital`
- Content: `Silverhaven is the mountain capital. Its people mine blue crystal and distrust outsiders.`

Quando você ou a IA mencionam `Silverhaven` ou `the capital` no chat, a IA recebe esse fato automaticamente.

Essa é a entrada mais simples possível: um nome, duas ou três chaves e um fato. As seções **Estratégia de escrita** e **Exemplo prático**, mais abaixo, mostram quando recorrer aos outros controles e como montar uma ambientação pequena do zero.

## Regras de correspondência das palavras-chave

Por padrão, uma chave primária corresponde se a palavra aparecer em qualquer lugar do texto recente do chat, sem diferenciar maiúsculas de minúsculas. Três controles mudam esse comportamento. As opções **Whole Words** e **Case Sensitive** ficam no painel lateral expandido. O botão liga/desliga **Regex** é o ícone pequeno da linha compacta, e fica laranja quando está ativado.

| Controle | Onde fica | Padrão | O que faz |
|---|---|---|---|
| **Whole Words** | Painel da entrada | Off | A chave precisa corresponder à palavra inteira, não a um pedaço de uma palavra maior. |
| **Case Sensitive** | Painel da entrada | Off | Maiúsculas e minúsculas precisam bater exatamente. |
| **Regex** | Linha compacta | Off | Trata cada chave como um padrão de expressão regular, e não como texto simples. |

Uma expressão regular (regex) é uma linguagem de busca por padrões em texto. Use esse recurso só se você já conhece regex. Marinara executa cada chave de regex com um tempo limite curto de segurança. Um padrão que demora demais não corresponde naquela varredura, então mantenha os padrões simples.

## Tipos de entrada: Normal, Constant, Selective

Toda entrada tem um tipo. Clique no pontinho colorido da linha da entrada para abrir o menu de tipos e escolher um.

- **Normal** (ponto verde): aciona quando uma chave primária corresponde ao texto varrido. É o padrão.
- **Constant** (ponto amarelo): insere o conteúdo toda vez que o lorebook está ativo, sem precisar de palavra-chave. Use para fatos que precisam estar sempre presentes.
- **Selective** (ponto vermelho): as chaves primárias precisam corresponder, e a lógica das chaves secundárias também precisa passar.

Uma entrada **Constant** continua obedecendo ao momento de acionar, à probabilidade e a qualquer filtro que você definir. Ela só não precisa de palavra-chave.

Quando a entrada é **Selective**, acrescente uma ou mais **Secondary Keys** e escolha um botão em **Logic** (lógica) no painel lateral:

- **AND Any**: pelo menos uma chave secundária também precisa aparecer.
- **AND All**: todas as chaves secundárias precisam aparecer.
- **NOT Any**: a entrada é bloqueada se qualquer chave secundária aparecer.
- **NOT All**: a entrada só é bloqueada se todas as chaves secundárias aparecerem.

Veja um exemplo: uma entrada **Selective** com a chave primária `king` e a chave secundária `Silverhaven`, definida como **AND Any**. Ela só é acionada quando o chat menciona tanto o rei quanto Silverhaven. Assim uma palavra genérica como `king` não aciona a entrada na cena errada.

## Position, Depth e Order

Esses controles decidem onde a entrada ativada entra no prompt. Eles ficam na linha compacta em telas largas. Em telas estreitas, toque no botão de controles rápidos da linha para chegar até eles.

- **Position** (posição): escolha entre **Before chat**, **After chat**, **@ Depth** e **Outlet**. Before chat e After chat colocam a entrada em volta do histórico do chat. A opção **@ Depth** insere a entrada dentro do histórico do chat. A opção **Outlet** não insere a entrada automaticamente; ela disponibiliza o conteúdo ativado para uma macro `{{outlet::name}}` com nome. Em telas largas, a linha mostra as três primeiras posições com as etiquetas curtas **↑Char**, **↓Char** e **@Depth**.
- **Depth** (profundidade): aparece só quando **Position** está em **@ Depth**. Define quantas mensagens antes da última a entrada é inserida. O padrão é 4.
- **Order** (ordem): a ordem de inserção quando várias entradas são ativadas ao mesmo tempo. Número menor vem antes no prompt. O padrão é 100.

Use a opção **@ Depth** com moderação e sempre com um motivo claro. Como ela insere a entrada *dentro* das mensagens recentes, e não em volta delas, o texto soa como uma interrupção jogada no meio da conversa:

> **John:** Vamos visitar o castelo do Vlad.
> **Bob:** Fechado.
> *O ponto fraco do conde é o alho, uma alergia extrema que ele esconde a todo custo.*
> **John:** Ótimo, quer ir amanhã? Estou de folga.

Recorra a essa opção só quando a nota realmente precisar ficar ao lado do último turno, como uma regra que o modelo vive esquecendo ou um fato que acabou de mudar. Deixe a lore comum em **Before chat** ou **After chat**.

Ao escolher **Outlet**, aparece o campo **Outlet name** (nome do outlet). Informe um nome exato, com diferença entre maiúsculas e minúsculas, como `character_rules`, e depois coloque `{{outlet::character_rules}}` em uma seção do prompt. Cada entrada atribuída a esse Outlet continua seguindo as próprias regras de palavra-chave, constante, probabilidade, filtro, momento de acionar, limite de entradas e orçamento de tokens. Marinara reúne apenas as entradas ativadas para a geração atual. Entradas que compartilham o mesmo nome de Outlet são unidas na ordem de **Order**, separadas por quebras de linha.

Uma macro de Outlet sem entradas ativas correspondentes não gera nada. O conteúdo de um Outlet não pode chamar outra macro de Outlet, o que evita laços recursivos de Outlet. As macros de Outlet funcionam nas seções de prompt dos modos Conversation, Roleplay e Game.

## Probabilidade do gatilho

Cada entrada tem um valor em **Probability** (probabilidade), mostrado como porcentagem na linha. O padrão é 100%, ou seja, a entrada sempre é acionada quando as chaves correspondem. Reduza esse valor para que a entrada seja acionada só de vez em quando. Por exemplo, 25% significa uma chance em quatro de ativação a cada correspondência das chaves.

## Momento de acionar: Sticky, Cooldown, Delay, Ephemeral

Os campos em **Timing** (momento de acionar), no painel lateral, controlam o comportamento da entrada ao longo de várias mensagens. **Sticky**, **Cooldown** e **Delay** contam mensagens. **Ephemeral** conta ativações. Os quatro começam desligados (0, ou seja, sem efeito).

- **Sticky** (fixar): depois de a entrada ser acionada, ela continua ativa por esta quantidade de mensagens, mesmo sem uma nova correspondência de palavra-chave.
- **Cooldown** (espera): depois de a entrada ser acionada, ela espera esta quantidade de mensagens até poder ser acionada de novo.
- **Delay** (atraso): a entrada espera esta quantidade de mensagens no chat até poder ser ativada pela primeira vez.
- **Ephemeral** (efêmera): a entrada se desativa depois desta quantidade de ativações. O valor 0 significa ilimitado.

Por exemplo, defina **Sticky** como 3 para manter um fato no prompt por alguns turnos depois que ele surgir. Assim a IA não esquece o fato no meio da cena.

## Outras opções da entrada

O painel lateral expandido tem mais alguns campos.

- **Role** (papel): define se o texto inserido é marcado como **System**, **User** ou **Assistant**. Isso só importa quando **Position** está em **@ Depth**. O padrão é **System**.
- **Group** (grupo) e **Tag** (tag): coloque entradas no mesmo **Group** para que só uma delas seja ativada por vez. O campo **Tag** é uma etiqueta de texto livre, para você organizar do seu jeito.
- **Locked** (bloqueada): impede que o agente **Lorebook Keeper** altere esta entrada. Veja a [Referência dos agentes para download](../agents/built-in-agents.md).
- A opção **No Vector** e o selo de status de vetor têm a ver com a busca semântica. Veja [Busca semântica para lorebooks](semantic-search.md).

O painel lateral também tem a seção **Context filters & matching sources** (filtros de contexto e fontes de correspondência). Nela você limita a entrada a determinados personagens, tags de personagem ou tipos de geração. Também é possível varrer campos extras do card de personagem (a descrição do personagem, por exemplo) atrás das palavras-chave da entrada.

## Estratégia de escrita: escolher a entrada certa

As seções acima descrevem o que cada controle faz. Esta seção liga esses controles às decisões que você toma ao escrever um lorebook: qual tipo escolher, quando restringir uma palavra-chave e como manter o prompt enxuto. Comece por uma pergunta: *quando a IA deve ver este fato?*

- **O fato precisa ser sempre verdadeiro**: a premissa da ambientação, o ano, o tom, uma regra que influencia todas as cenas. Marque a entrada como **Constant**: ela é inserida toda vez que o lorebook está ativo, sem precisar de palavra-chave. Use poucas assim. Cada entrada Constant gasta tokens em todas as mensagens, e uma página delas espreme o chat de verdade.
- **O fato só importa quando o assunto surge**: uma pessoa, um lugar, uma facção ou um item. Use o tipo padrão **Normal** com três a oito **Primary Keys** específicas: o nome mais as formas como os personagens realmente se referem a ele (`Castle Dracul`, `the castle`, `the fortress`). Esse é o tipo mais usado; a maioria das entradas é Normal.
- **A palavra-chave é uma palavra comum**, que acionaria a entrada na cena errada (`king`, `home`, `hunter`): ative **Whole Words** para que `art` pare de corresponder a `start`, ou torne a entrada **Selective** e acrescente **Secondary Keys** que a prendam ao contexto certo.
- **Várias entradas ocupam o mesmo lugar e nunca podem aparecer juntas**: três versões de um mesmo castelo, duas histórias de fundo alternativas. Coloque todas no mesmo **Group**, assim só uma é carregada por vez.
- **O fato é importante, mas quase nunca é dito com todas as letras**: um tema, uma relação, uma regra que ninguém verbaliza. Deixe a entrada como **Normal** e ative a correspondência semântica, para que ela seja lembrada pelo sentido (veja [Busca semântica](semantic-search.md)). A correspondência semântica precisa de um modelo de embeddings. Sem ele, recorra a **Constant** (quando o fato realmente precisa estar sempre presente) ou a chaves mais amplas.

Alguns hábitos mantêm os lorebooks saudáveis:

- **Dê a cada entrada uma forma de ser acionada.** Uma entrada **Normal** sem chaves não oferece nada para a correspondência por palavra-chave encontrar. Ela só é ativada se a busca semântica a lembrar pelo sentido, o que exige um lorebook vetorizado e um modelo de embeddings (veja [Busca semântica](semantic-search.md)). Se o fato precisa estar sempre presente, marque a entrada como **Constant**. Caso contrário, dê chaves a ela para que seja acionada sem depender da busca semântica.
- **Prefira chaves específicas.** Uma chave como `he`, `it` ou `the city` corresponde a quase toda mensagem e desperdiça orçamento. Quando uma chave for ampla demais, use nomes exatos, a opção **Whole Words** ou as chaves secundárias de uma entrada **Selective**.
- **Preencha o campo Description** em toda entrada que o agente **Knowledge Router** deve rotear. Ele lê a descrição, e não o conteúdo, para decidir a relevância (veja [Fontes de conhecimento](../agents/knowledge-sources.md)).
- **Deixe Position, Depth, Order e Role nos valores padrão**, a menos que você tenha um motivo. Use **Order** quando várias entradas são acionadas e o orçamento está apertado: a entrada com o número menor é carregada primeiro e sobrevive ao corte. Use **@ Depth** só para o lembrete raro que precisa ficar ao lado da última mensagem, como já avisado acima. Fique de olho nos campos **Token Budget** (orçamento de tokens) e **Entry Limit** (limite de entradas) do lorebook (veja [Orçamento de tokens e recursão](token-budgets.md)).

### Organize a lore como uma árvore

Ambientações grandes são mais fáceis de cuidar em forma de árvore do que como um monte de entradas soltas. Além de uma entrada para cada personagem, lugar ou item, crie **entradas centrais** para os grupos a que eles pertencem. Uma entrada para *The Empire* descreve o império e lista os membros de destaque; uma entrada de reino lista as cidades importantes. A entrada central dá um mapa à IA: quando o império entra em cena, o modelo vê o que ele é e quem faz parte dele, sem a entrada completa de cada membro entupir o prompt.

Deixe a recursão desativada nas entradas centrais. O botão liga/desliga **Recursive** (varredura recursiva) do lorebook e o botão **Recursion** (recursão) da entrada já vêm desativados, e é exatamente disso que uma entrada central precisa: ela entrega a visão geral ao modelo e deixa a entrada de cada membro aparecer só quando esse membro é citado. Se você ativar a recursão em outras entradas para encadear lore relacionada, mantenha-a desativada nas entradas centrais. Caso contrário, citar o grupo puxa a entrada completa de todos os membros de uma vez, milhares de tokens de detalhe que ainda não interessam.

### Reaproveitar a lore em vários personagens e chats

O lugar onde o lorebook fica decide quais chats enxergam esse lorebook. Escolha onde guardá-lo de acordo com o tipo de lore:

- **Regras de um mundo compartilhado**, a ambientação a que todos os personagens da sua biblioteca pertencem, vão em um lorebook **Global**, que fica ativo em todos os chats (ative o botão liga/desliga **Global** na aba **Overview** do lorebook).
- **A lore do próprio personagem**, como história de fundo, segredos e relações, vai em um lorebook **vinculado** a esse personagem. Assim ele é ativado sozinho nos chats dele e em nenhum outro. Quando vários personagens dividem o mesmo lorebook, acrescente um **filtro** de personagem nas entradas que pertencem só a um deles.
- **Um card que você pretende compartilhar**: **embuta** o lorebook no card de personagem, para a World Info viajar junto na exportação. Embutir vale só para personagens, e cada card comporta um lorebook embutido por vez.
- **Lore de uma história só**: fixe o lorebook naquele chat pelas configurações do próprio chat.

Veja a [Visão geral dos lorebooks](overview.md) para entender como funciona a ativação, e [Vincular lorebooks a personagens e personas](linking-to-characters.md) para conhecer os controles que atribuem, delimitam e embutem o lorebook.

## Exemplo prático: uma ambientação pequena

Imagine um roleplay de terror gótico ambientado na Valáquia da década de 1890. Um lorebook raso seria um monte de entradas com nome e conteúdo. Um lorebook bem montado usa os controles acima para cada fato aparecer exatamente na hora certa. Veja como um punhado de entradas poderia ser configurado, e por quê.

Comece pela base: um fato sempre ativo e alguns detalhes com chave.

**A premissa** – *Constant.*

- Content: `The year is 1890. Vampires are real and hunt the Carpathian nights; the living bar their windows after dark.`
- Por que **Constant**: as regras básicas influenciam todas as respostas, então a entrada fica sempre presente, sem palavra-chave. Essa é a única entrada que se justifica como sempre ativa. Resista à vontade de marcar mais entradas como Constant.

**Castle Dracul** – *Normal.*

- Primary Keys: `Castle Dracul`, `the castle`, `the fortress`
- Content: `A black-stone fortress on the ridge above the village, the seat of the vampire count.`
- Por que **Normal** com essas chaves: o castelo só importa quando está em cena, então a entrada espera uma palavra-chave. As chaves cobrem o nome dele e as formas como os personagens se referem ao castelo.

**Count Vlad** – *Normal, com Whole Words ativado.*

- Primary Keys: `Vlad`
- Description: `The setting's central vampire.`
- Content: `The immortal count who rules Wallachia after dark — charming, patient, and without mercy.`
- Por que **Whole Words**: `Vlad` é curto e poderia aparecer dentro de outra palavra, então a correspondência por palavra inteira evita acionamentos errados. O campo **Description** está preenchido para o Knowledge Router conseguir rotear a entrada, caso você use esse agente.

### Empilhar vários controles em uma entrada

A maioria das entradas precisa de um ou dois controles; algumas poucas merecem vários de uma vez. Veja a regra sobre como o vilão pode ser morto de verdade, um fato que a IA costuma esquecer na pior hora:

**O ponto fraco do conde** – *Selective (AND Any), Whole Words ativado, Order 10 e uma Description preenchida.*

- Primary Keys: `weakness`, `kill`, `destroy`, `stake`
- Secondary Keys: `Vlad`, `the count`
- Description: `How Count Vlad can actually be destroyed.`
- Content: `Vlad can only be destroyed by a blackthorn stake through the heart, driven at dawn. Sunlight alone merely weakens him.`

Por que esta entrada em especial merece vários controles avançados:

- **Selective** com essas chaves secundárias: `weakness`, `kill` e `destroy` são palavras genéricas de combate, que surgem sempre que a equipe luta contra qualquer coisa. As chaves secundárias prendem a entrada ao conde. Assim ela fica quieta quando a equipe mata um lobo ou trama contra um rival, e só é acionada quando a morte *dele* está em jogo.
- **Whole Words**: sem esse controle, `stake` corresponderia dentro de `mistake` e `kill`, dentro de `skill`. Chaves curtas e comuns quase sempre pedem correspondência por palavra inteira.
- **Order 10**: uma cena de clímax ativa muitas entradas ao mesmo tempo e pode estourar o orçamento de tokens. Uma ordem baixa carrega esta entrada primeiro. Se o fim da lista for cortado, o único fato do qual a cena depende sobrevive.
- **Description**: o agente Knowledge Router lê esse campo para rotear a entrada pelo sentido. Assim a regra aparece mesmo quando as chaves exatas não estão na última mensagem.

### Versões alternativas que não devem se acumular

A fofoca do vilarejo sobre o conde deve soar inconsistente, mas dois boatos contraditórios nunca podem sair na mesma resposta. Coloque os dois no mesmo **Group** e use a probabilidade para deixá-los raros:

**Boato: o pacto** e **Boato: a linhagem** – *os dois no Group `count-rumor`, com Probability 40%.*

- Chaves das duas: `rumor`, `they say`, `the count`
- Conteúdos: `They say the count was once a crusader who bargained with something in the dark.` e `They say the count is not one man but a line of them, each wearing the last one's face.`
- Por que o **Group** `count-rumor`: entradas do mesmo grupo se excluem, e só uma é ativada por geração. Assim os dois boatos nunca se contradizem na mesma mensagem. Por que **Probability 40%**: um boato que aparece toda vez que o assunto surge deixa de parecer boato. Com uma chance menor, ele vira um comentário ocasional, que dá tempero à cena.

No lorebook inteiro, só a premissa é Constant, uma entrada combina lógica seletiva com uma ordem baixa e todo o resto espera pelas próprias chaves. É isso que mantém o prompt enxuto e ainda coloca o fato certo diante da IA no momento certo.

## Casos de uso por parâmetro

A estratégia e o exemplo prático acima mostram esses controles em conjunto. Esta seção é uma consulta rápida: para que *serve* cada controle, com um exemplo de cada.

### Correspondência

**Whole Words** – impede que a chave corresponda dentro de uma palavra maior.

- Use para: chaves curtas ou de uma sílaba só, siglas, ou uma chave que é pedaço de outras palavras.
- *Exemplo:* a chave `Ash` (um personagem) corresponde a "Ash", mas não a "ashes" nem a "cash".

**Case Sensitive** – a chave precisa bater exatamente em maiúsculas e minúsculas.

- Use para: uma chave que também é uma palavra comum em minúsculas; siglas e abreviações; códigos em que a caixa das letras muda o sentido.
- *Exemplo:* `IT` (o departamento de tecnologia) corresponde a "IT", mas não à palavra "it".

**Regex** – trata a chave como um padrão de expressão regular.

- Use para: várias grafias ou formas de uma vez, sufixos opcionais, ou números e códigos com um padrão. Mantenha os padrões simples, porque cada um roda com um tempo limite curto de segurança.
- *Exemplo:* `\bVlad(?:'s)?\b` corresponde a "Vlad" e a "Vlad's" como palavras inteiras.

### Tipo de entrada

**Constant** – insere o conteúdo em todo turno, sem palavra-chave.

- Use para: a premissa e as regras básicas da ambientação, uma diretriz de tom ou de estilo, ou um fato tão central que a IA nunca deve ficar sem ele.
- *Exemplo:* uma entrada Constant sem chaves, com o texto "Todo mundo fala o inglês da época, do século XIX.", está presente em toda resposta.

**Selective (chaves secundárias + lógica)** – acrescenta uma segunda condição de palavra-chave em cima das chaves primárias.

- Use para: uma chave primária comum que aciona a entrada na cena errada, lore que só deve aparecer em uma combinação específica de assuntos, ou bloquear a entrada quando um certo termo aparece.
- *Exemplo (AND Any):* chave primária `king`, chave secundária `Silverhaven`. A entrada do rei só é acionada quando Silverhaven também é citada.
- *Exemplo (NOT Any):* chave primária `the prophecy`, chave secundária `fulfilled`. A entrada da profecia não cumprida fica bloqueada assim que a profecia se cumpre.

### Posicionamento

**Before chat / After chat** – onde a entrada fica em relação à conversa.

- Use para: a maior parte da lore (Before chat, o padrão); um empurrãozinho que deve ficar o mais perto possível da próxima resposta do modelo (After chat).
- *Exemplo:* o resumo de uma facção em Before chat; um lembrete curto de "não saia do personagem" em After chat.

**@ Depth (com Depth e Role)** – insere a entrada *dentro* das mensagens recentes. Use com moderação; veja o aviso na seção **Position, Depth e Order**, acima.

- Use para: uma regra que o modelo vive esquecendo no meio da cena, ou um fato que acabou de mudar e precisa ficar ao lado do último turno. O campo **Role** marca a linha inserida como **System**, **User** ou **Assistant**.
- *Exemplo:* "A taverna está pegando fogo." em @ Depth 1, com Role System.

**Order** – a sequência em que as entradas ativadas são carregadas.

- Use para: fazer uma entrada vencer quando várias são acionadas e o orçamento está apertado, ou controlar a ordem de entradas relacionadas.
- *Exemplo:* uma regra essencial para a trama em Order 10 é carregada antes das entradas de detalhe, que ficam no padrão 100, e sobrevive ao corte do orçamento.

**Outlet** – reúne as entradas ativadas em uma macro com nome, em vez de inseri-las direto.

- Use para: juntar várias entradas em um único ponto do prompt, ou montar um bloco dinâmico que você mesmo posiciona.
- *Exemplo:* três entradas com Position em Outlet e o nome `house_rules`. Coloque `{{outlet::house_rules}}` em uma seção do prompt: só as entradas ativadas naquele turno aparecem ali, unidas na ordem de Order.

### Quando e com que frequência a entrada é acionada

**Probability** – a chance, em porcentagem, de a entrada ser acionada quando as chaves correspondem.

- Use para: detalhes ocasionais, eventos aleatórios, ou uma mania que só deve aparecer de vez em quando.
- *Exemplo:* "o estalajadeiro está de mau humor hoje" em Probability 30%.

**Sticky** – mantém a entrada ativa por um número definido de mensagens depois do acionamento.

- Use para: segurar um fato no prompt por alguns turnos, para o modelo não esquecê-lo no meio da cena.
- *Exemplo:* um segredo revelado em Sticky 3 continua ativo por três mensagens depois de surgir.

**Cooldown** – impede que a entrada seja acionada de novo por um número definido de mensagens.

- Use para: evitar que uma entrada dramática ou pesada se repita em toda mensagem, ou dar ritmo a um evento recorrente.
- *Exemplo:* um presságio de "a terra treme" em Cooldown 5 é acionado no máximo uma vez a cada cinco mensagens.

**Delay** – a entrada só pode ser acionada depois de um número definido de mensagens no chat.

- Use para: lore que não deve aparecer logo no começo; uma reviravolta ou um fato de um arco posterior, guardado até a história se desenvolver.
- *Exemplo:* uma entrada de "o mentor era o traidor desde o início" em Delay 20.

**Ephemeral** – a entrada se desativa depois de um número definido de ativações.

- Use para: conteúdo de uma vez só (ou de poucas vezes), como uma introdução, uma nota do primeiro encontro ou uma dica de tutorial.
- *Exemplo:* "Você acorda sem lembrar como chegou aqui." em Ephemeral 1 é acionada uma vez e depois se desliga.

### Organização e controle

**Group** – torna as entradas mutuamente exclusivas; só uma entrada do grupo é ativada por resposta.

- Use para: alternativas (um entre vários boatos, humores ou versões), ou um sorteio entre opções.
- *Exemplo:* três entradas de "o tempo hoje" no Group `weather`: exatamente uma é escolhida por resposta.

**Tag** – uma etiqueta de texto livre, para você organizar do seu jeito. Não afeta a ativação.

- Use para: organizar e filtrar as entradas dentro do editor.
- *Exemplo:* marque entradas com `npc`, `location` ou `wip` para achá-las e cuidar delas rapidamente.

**Description** – um resumo que o agente Knowledge Router lê para rotear a entrada; nunca vai como conteúdo para a IA.

- Use para: dar a uma entrada densa ou cheia de macros um resumo em linguagem simples, que o roteador consiga associar pelo sentido, ou deixar um lembrete para você mesmo.
- *Exemplo:* uma entrada cheia de macros de formatação recebe a Description "as regras da arena de duelos".

**Recursion (por entrada)** – permite que o conteúdo desta entrada acione outras entradas. Vem desativado por padrão.

- Use para: uma entrada que você *quer* encadear com um conjunto limitado de lore relacionada. Mantenha o controle desativado nas entradas centrais (veja **Organize a lore como uma árvore**, acima).
- *Exemplo:* "A equipe entra na floresta de Thornwood." com Recursion ativado e um conteúdo que cita os pontos de referência da floresta, para essas entradas também serem ativadas.

**No Vector** – deixa a entrada fora da busca semântica.

- Use para: impedir que uma entrada genérica ou padronizada suje as correspondências por sentido, ou para uma entrada que só deve ser acionada pelas chaves exatas.
- *Exemplo:* marque uma entrada de instrução de formatação como No Vector, assim ela nunca aparece como resultado semântico de "lore relacionada".

**Locked** – protege a entrada do agente Lorebook Keeper.

- Use para: uma entrada ajustada à mão, que uma passagem automática não deve reescrever.
- *Exemplo:* bloqueie a premissa que você escreveu com tanto cuidado, para o Keeper não conseguir editá-la.

**Context filters** – limitam a entrada a determinados personagens, tags de personagem ou tipos de geração.

- Use para: lore que vale só para alguns personagens ou só para alguns tipos de geração.
- Filtrar por personagem faz mais do que esconder a entrada dos outros chats. No chat em grupo, o filtro também mantém a entrada fora das respostas *dos outros personagens*, ativando-a só quando o personagem filtrado é quem responde. Isso torna o filtro ideal para histórias de fundo privadas, segredos e conhecimentos que só um personagem tem.
- *Exemplo:* filtre a lealdade secreta de uma espiã para ela mesma. A informação orienta as respostas dela e nunca vaza nas respostas dos personagens que ela engana.

## Usar macros no conteúdo da entrada

O campo **Content** da entrada é expandido como qualquer outro texto do prompt: as macros são resolvidas antes de o conteúdo ser inserido. Veja algumas macros úteis dentro das entradas de lorebook:

- `{{char}}` e `{{user}}`: os nomes do personagem atual e do usuário ou da persona, para uma entrada compartilhada soar natural em qualquer chat.
- `{{random::a::b::c}}` e `{{roll:1d6}}`: sorteiam uma opção ou rolam os dados, para um detalhe que muda a cada acionamento da entrada. Acrescente pesos com `@`, como em `{{random::common@3::rare@1}}`, para deixar algumas opções mais prováveis que outras.
- `{{#if ...}}...{{else}}...{{/if}}`: muda o texto conforme quem está falando, o valor de uma variável ou o personagem ativo.
- `{{getvar::name}}` e `{{setvar::name::value}}`: leem ou definem uma variável persistente local do chat, para a entrada reagir ao estado ou alterá-lo nos turnos seguintes sem levar o valor a outros chats.

O sorteio com pesos combina bem com **Probability** e resume uma tabela inteira em uma única entrada. Em vez de um grupo com vinte entradas de monstros, dê a uma entrada de "encontro aleatório" uma **Probability** baixa (assim o encontro é ocasional) e uma lista com pesos do que pode aparecer:

`{{random::a lone wolf@5::a bandit scout@3::a wounded traveler@2::a displacer beast@1}}`

A entrada é acionada só de vez em quando e, quando é, escolhe um encontro. Os pesos fazem os inimigos comuns aparecerem mais que os raros, e você não precisa manter um compêndio de entradas separadas.

Use a **macro de comentário** para deixar uma anotação que nunca chega à IA:

- `{{// draft wording, revisit later}}`: tudo que está dentro de `{{// ... }}` é removido da saída.

**Uma observação sobre a recursão.** Com a varredura **Recursive** ativada no lorebook (veja [Orçamento de tokens e recursão](token-budgets.md)), Marinara varre de novo o conteúdo *já expandido* das entradas ativadas em busca de mais palavras-chave. Como as macros são resolvidas primeiro, o texto que uma macro produz pode acionar outras entradas. Por exemplo, um conteúdo que se expande em um nome consegue ativar a entrada com aquele nome como chave. A macro `{{// comment}}` é a exceção: ela é removida por completo antes da nova varredura, então o texto dela nunca aciona nada. Os comentários servem só para anotações; se quiser que um texto alimente a recursão, escreva-o normalmente.

## Erros comuns

- **A entrada nunca é acionada.** Uma entrada **Normal** sem chaves não oferece nada para a correspondência por palavra-chave encontrar. Dê chaves a ela ou marque-a como **Constant**. (Uma entrada sem chaves ainda pode ser lembrada pelo sentido, mas só com a busca semântica toda configurada: o botão **Vectors** (vetores) ativado, um modelo de embeddings definido e a entrada vetorizada; veja [Busca semântica](semantic-search.md).) Confira também se o lorebook está ativado e ativo no chat.
- **Uma palavra-chave parou de funcionar.** As chaves só são procuradas nas últimas mensagens, conforme o campo **Scan Depth** (profundidade de varredura) do lorebook, que vem com o padrão 2. Quando a palavra de gatilho sai dessa janela, a entrada silencia. Aumente o **Scan Depth**, acrescente **Sticky** para o fato permanecer depois de acionado, ou marque a entrada como **Constant**.
- **A entrada é acionada nas cenas erradas.** Uma chave ampla como `home` ou `king` corresponde a coisa demais. Restrinja a chave com **Whole Words**, controle a entrada com as chaves secundárias de **Selective**, ou filtre a entrada para o personagem certo.
- **A lore importante fica sempre de fora.** Quando mais entradas correspondem do que o orçamento permite, o fim da lista é cortado. Dê um **Order** menor às entradas que importam, aumente o **Token Budget**, ou passe a lore volumosa de consulta para o agente Knowledge Router. O painel **Active Context** (contexto ativo) mostra exatamente o que foi pulado e por quê (veja [Orçamento de tokens e recursão](token-budgets.md)).
- **A IA ignora a sua lore.** Confirme no painel **Active Context** que a entrada realmente foi ativada. Lembre também que ela disputa espaço com o resto do prompt: um fato enterrado longe do último turno pesa menos que um em **After chat** ou, com moderação, em **@ Depth**.

## Checklist de escrita

Uma conferência rápida para cada entrada que você escrever:

1. **Dê um nome claro.** O nome serve para você e para a busca, não para a IA.
2. **Decida como ela é acionada:** um fato sempre verdadeiro → **Constant**; qualquer outro caso → **Normal** com três a oito **chaves** específicas.
3. **Contenha as chaves amplas demais** com **Whole Words** ou distribua-as em chaves secundárias de **Selective**.
4. **Escreva o conteúdo** como um fato simples, com o menor número possível de tokens.
5. **Preencha o campo Description** se você usa o agente Knowledge Router.
6. **Deixe o posicionamento nos valores padrão**, a menos que a entrada realmente precise de **Position**, **Depth** ou **Order** diferentes.
7. **Agrupe** as alternativas mutuamente exclusivas em um mesmo **Group**; **filtre** a lore de um personagem específico para esse personagem.
8. **Teste** a entrada no painel **Keyword test** e depois acompanhe o **Active Context** em um chat de verdade, para confirmar que ela é acionada e cabe no orçamento.

## A ferramenta Keyword test

O painel **Keyword test** (teste de palavras-chave), no topo da aba **Entries**, permite conferir as palavras-chave sem começar um chat. Expanda o painel e cole na caixa um parágrafo de exemplo ou algumas mensagens.

As entradas cujas chaves corresponderiam ganham um destaque verde e uma etiqueta **Would activate**. Entradas **Constant** ganham a etiqueta **Always active**, porque são acionadas independentemente do que o texto diz. Uma linha de contagem mostra quantas das entradas ativas seriam acionadas.

Esse teste verifica só as regras de palavra-chave. Ele ignora o momento de acionar, a probabilidade, os filtros de personagem e a correspondência semântica, então o chat ao vivo ainda pode se comportar de forma diferente da prévia.

## Pastas de entradas

As pastas agrupam entradas dentro de um mesmo lorebook. Elas são independentes das pastas da biblioteca no painel principal **Lorebooks**.

- Clique em **Add Folder** para criar uma pasta e renomeie na própria linha.
- Arraste uma entrada para cima de uma pasta para guardá-la ali, ou use o seletor **Folder** da entrada.
- Arraste uma pasta para cima de outra para aninhá-la, ou arraste-a para a faixa do topo para tirá-la do aninhamento.
- Cada pasta tem um botão liga/desliga **Enabled** (ativada). Ao desativar uma pasta, todas as entradas dentro dela param de ser ativadas, mesmo que o botão da própria entrada esteja ligado.
- O cabeçalho da pasta também traz **Clone** (clonar) e **Delete**. O botão **Clone** faz uma cópia completa da pasta, com todas as entradas e subpastas. O botão **Delete** remove só a pasta em si. As entradas e subpastas dela sobem para o nível superior.

As pastas só aparecem como grupos quando a ordenação está em **Order** e não há busca ativa. Qualquer outra ordenação, ou uma busca, muda a exibição para uma lista simples e mostra o aviso "Folder view paused (clear search and sort by Order)".

## Guias relacionados

- [Visão geral dos lorebooks](overview.md)
- [Orçamento de tokens e recursão em lorebooks](token-budgets.md)
- [Busca semântica para lorebooks](semantic-search.md)
- [Fontes de conhecimento: agentes Retrieval e Router](../agents/knowledge-sources.md)
