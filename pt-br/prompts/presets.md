# Editor de presets e gerenciador de prompts

Um preset é uma planta salva do prompt, o texto que Marinara envia ao modelo a cada resposta. Ele decide o que entra e em que ordem: as suas instruções, o card de personagem, a sua persona, o histórico do chat, as entradas de lorebook e mais. Use o **Preset Editor** (editor de presets) para montar um e depois atribua-o a um chat.

Os presets montam o prompt nos chats de **Roleplay**. Os chats de **Conversation** e **Game** usam um único campo de prompt (veja [Chats de Conversation e Game](#conversation-and-game-chats)). Os presets não precisam de chave de API, mas você ainda precisa de uma conta funcionando para enviar o prompt. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

## Atribuir um preset a um chat

Um preset não faz nada até um chat usá-lo. Em um chat de **Roleplay**, use qualquer uma das duas formas. Para escolher um, atribua-o. Para criar o seu, veja [Criar um preset](#create-a-preset).

Pelo painel **Presets**:

1. Abra o chat.
2. No painel **Presets**, encontre a linha de um preset. No computador, aponte o mouse para a linha para mostrar os botões dela.
3. Clique no botão de marca de seleção **Assign to chat** (atribuir ao chat). Uma marca de seleção mostra que o preset está em uso. Clique de novo para desfazer a atribuição.

Por **Chat Settings** (configurações do chat):

1. Abra o chat e depois **Chat Settings**.
2. Encontre **Prompt Preset** (preset de prompt) e escolha um preset no menu suspenso.

Se o preset tiver variáveis, a janela **Configure Preset Variables** (configurar as variáveis do preset) abre. Veja [Variáveis de preset](preset-variables.md). Trocar de preset limpa as escolhas de variáveis feitas antes.

<a id="create-a-preset"></a>

## Criar um preset

1. Abra o painel **Presets** pela barra superior.
2. Clique em **New** (novo, o ícone de mais). A janela **Create Preset** (criar preset) abre.
3. Digite um **Name** (nome). Ele é obrigatório. Acrescente uma **Description** (descrição), se quiser.
4. Clique em **Create** (criar). O preset abre no **Preset Editor**.
5. Monte o prompt na aba **Sections** (seções).
6. Clique em **Save** (salvar), no canto superior direito.

O editor não salva sozinho. Clique em **Save** depois de cada mudança. Se você sair com edições não salvas, um aviso oferece **Keep editing** (continuar editando), **Discard** (descartar) e **Save & close** (salvar e fechar).

Para exportar um preset, clique no ícone de seta para cima na barra superior (dica **Export preset**). Marinara pede para você salvar antes, se houver edições não salvas. Para excluí-lo, clique no ícone de lixeira.

## O painel Presets

O painel tem quatro abas: **Prompts** (prompts), **Regexes** (scripts de regex), **Tools** (ferramentas) e **Profiles** (perfis). Cada aba tem a mesma fileira de botões no topo e uma caixa de busca. Na aba **Prompts**, use **Create preset** (criar preset) para criar um preset, **Import preset** (importar preset) para carregar um arquivo `.json` ou **Select presets** (selecionar presets) para exportar ou excluir vários de uma vez. **Select all presets** (selecionar todos os presets) marca todos os presets nos resultados da busca. A aba **Regexes** reúne os scripts de regex. Veja [Scripts de regex](../extending/regex-scripts.md#manage-your-scripts). A aba **Tools** reúne as ferramentas personalizadas. Veja [Ferramentas personalizadas](../extending/custom-tools.md). A aba **Profiles** reúne os perfis de configurações de chat. Veja [Perfis de configurações](../chats/settings-profiles.md#the-profiles-tab).

- **Search presets** (buscar presets) filtra a lista.
- O menu de ordenação oferece **Manual order** (ordem manual), **A-Z**, **Z-A**, **Newest**, **Oldest**, **Most tokens** (mais tokens) e **Fewest tokens** (menos tokens). A contagem inclui o texto das seções ativadas, ou seja, as instruções que o preset sempre envia. Seções marcadoras, como personagem, lorebook e histórico do chat, são preenchidas para cada chat e ficam fora da contagem. Cada linha mostra a estimativa. Com **Manual order**, arraste uma linha, ou pressione <kbd>Alt</kbd>+<kbd>Up</kbd> ou <kbd>Alt</kbd>+<kbd>Down</kbd> em uma linha selecionada. Em uma tela sensível ao toque, mantenha uma linha pressionada para pegá-la.
- **New Folder** (nova pasta) agrupa os presets. Arraste um preset para uma pasta, e dê um duplo clique ou um toque duplo em uma pasta para renomeá-la.

Cada linha mostra o nome, o formato de envelopamento, a quantidade de seções e o autor. O selo **DEFAULT** marca o preset padrão marcado com estrela. Clique em uma linha para abri-la.

## As abas do Preset Editor

| Aba | O que ela guarda |
| --- | --- |
| **Overview** (visão geral) | Nome, descrição, formato de envelopamento e autor. |
| **Sections** | A estrutura do prompt, montada com blocos e marcadores. |
| **Prompts** | Os prompts de modo dos chats de Conversation e Game. |
| **Parameters** (parâmetros) | As configurações de geração iniciais. Veja [Parâmetros de geração](generation-parameters.md). |
| **Regex** | Os scripts de regex vinculados a este preset e o **Scoped regex default** (padrão de regex com escopo). Veja [Scripts de regex](../extending/regex-scripts.md). |

### Aba Overview

- **Name** é o título no painel **Presets**.
- **Description** é um resumo curto.
- **Wrap Format** (formato de envelopamento) controla como as seções são formatadas (veja [Formatos de envelopamento](#wrap-formats)).
- **Author** (autor) é um nome opcional de quem criou o preset, útil quando você compartilha um preset.

Dois cartões somente leitura mostram as contagens de **Sections** e **Groups**.

### Aba Prompts

- **Conversation Mode** é uma caixa de texto para o prompt de Conversation deste preset. Deixe vazia para usar o prompt integrado.
- **Roleplay Mode** não é editável aqui. O Roleplay usa o prompt montado a partir das suas **Sections**.
- **Game Mode** é uma caixa de texto para o prompt de Game deste preset. Deixe vazia para usar o prompt integrado.

#### Configurações de história do jogo

Um preset pode levar um estilo de história, um nível de violência e limites de conteúdo para o Game Mode, para que você não precise defini-los em cada jogo. Veja [Estilo da história, violência e limites de conteúdo](../game/getting-started.md#story-style-violence-and-content-boundaries).

1. Na aba **Prompts**, em **Game story settings** (Configurações de história do jogo), ative **Bring story settings to games that use this preset** (Levar as configurações de história para os jogos que usam este preset).
2. Escolha um **Story style** (Estilo da história) e um nível de **Violence** (Violência). **Follow rating** (Seguir a classificação) mantém a violência de cada jogo no padrão da classificação dele.
3. Opcional: escreva os **Content boundaries** (Limites de conteúdo), um por linha.
4. Clique em **Save** (Salvar).

Quando você escolhe o preset para um jogo, no assistente de configuração ou em **Chat Settings → Prompt Preset** (Configurações do chat → Preset de prompt), o jogo assume o estilo de história e a violência do preset. Os limites do preset são acrescentados aos que o jogo já tem, então nenhum dos limites do próprio jogo é removido. Edições posteriores no preset não mudam os jogos que já o escolheram. A configuração é mantida quando você duplica, exporta ou importa o preset.

O **Marinara's Universal Preset** integrado fornece o texto do prompt, mas nenhum parâmetro de geração. As configurações antigas de amostragem, raciocínio, formatação e tokens salvas nele são ignoradas, e no lugar delas valem as configurações da sua conta, as substituições do chat e os padrões do aplicativo. Crie uma cópia editável para personalizá-lo.

## Seções e marcadores

A aba **Sections** é onde você monta o prompt. As seções são montadas de cima para baixo.

1. Clique em **Add Section** (adicionar seção).
2. Escolha **Prompt Block** ou um marcador.

Um **Prompt Block** é um texto que você escreve: instruções de sistema, regras de tom, qualquer coisa que você queira em todo prompt. Um marcador não tem texto próprio. Marinara o preenche com o conteúdo atual do chat quando envia o prompt.

| Marcador | O que insere |
| --- | --- |
| **Character Info** | Os detalhes do card de personagem ativo. |
| **Persona** | Os detalhes da sua persona ativa. |
| **Chat History** | As mensagens do chat. |
| **Chat Summary** | O resumo compilado do chat. |
| **Dialogue Examples** | Os diálogos de exemplo do personagem. |
| **Lorebook Marker (All)** | Todas as entradas de lorebook ativas. |
| **Lorebook Marker (Before)** | As entradas de lorebook configuradas para ir antes. |
| **Lorebook Marker (After)** | As entradas de lorebook configuradas para ir depois. |
| **Recuperação de memórias** | As memórias que a [Recuperação de memórias](../agents/memory.md) encontra para cada resposta. Sem este marcador, elas ficam logo antes do histórico do chat. |

A linha de um marcador mostra o selo **MARKER**. Não é possível digitar na maioria dos marcadores. Use **Lorebook Marker (All)**, a menos que você queira dividir as entradas de lorebook entre antes e depois.

Três marcadores mais raros:

- **Current Scene Summary** e **Recalled Scenes** posicionam os resumos que o Advanced Memory Recall cria. Sem um marcador **Recalled Scenes**, eles aparecem antes do histórico do chat. Veja [Memória](../agents/memory.md).
- **ID Macro Cards** posiciona os cards de personagem que você puxa para um prompt digitando o ID do card de um personagem entre chaves duplas. Sem esse marcador, eles vão para o lugar padrão. Veja [Macros de prompt](macros.md).

Sem um marcador **Dialogue Examples** ativado, os diálogos de exemplo preenchidos são acrescentados ao **Character Info** depois do cenário, no formato de envelopamento do preset. Acrescente o marcador para escolher a posição. Marinara nunca os inclui duas vezes.

Se o seu chat tiver lorebooks ativos, mas o preset não tiver marcador de lorebook, um aviso diz: "Add a lorebook marker when this preset should receive active lorebook entries." Acrescente um marcador para que as entradas cheguem ao modelo. Veja [Visão geral dos lorebooks](../lorebooks/overview.md).

Se você tem agentes personalizados com "inject as section" ativado, o menu de adição mostra **Agent Sections** (seções de agente). Cada uma insere a saída mais recente daquele agente, e você pode acrescentar as suas próprias instruções em volta dela.

### Editar uma seção

1. Clique no nome ou na seta de uma seção para expandi-la.
2. Mude o **Name** ou o papel dela (**System**, **User** ou **Assistant**).
3. Em um **Prompt Block**, edite **Content** (conteúdo). Ele aceita [macros](macros.md).
4. Clique em **Save**, no canto superior direito.

Os controles da linha:

- **Duplicate** (duplicar) copia a seção.
- O ícone de olho liga ou desliga a seção.
- **Delete** (excluir) remove a seção.
- Para reordenar, arraste pela alça, use as setas para cima e para baixo, ou pressione e segure em uma tela sensível ao toque.

### Grupos

Um grupo envolve várias seções em um só contêiner.

1. Na aba **Sections**, clique em **Groups** (grupos) e depois em **New Group** (novo grupo).
2. Clique no nome do grupo para renomeá-lo.
3. Expanda uma seção e escolha o grupo no menu suspenso **Group** dela.

Com **XML**, um grupo vira uma marcação pai. Com **MARKDOWN**, ele vira um título. Se as seções de um mesmo grupo não estiverem uma ao lado da outra, cada uma recebe sua própria marcação ou título. Excluir um grupo não exclui as seções dele. Elas só deixam de ter grupo.

### Posição e profundidade

Cada seção tem uma **Position** (posição) no editor dela.

- **Ordered (in sequence)** (em sequência) coloca a seção onde ela está na lista. Essa é a escolha normal.
- **Depth (from end of chat)** (a partir do fim do chat) coloca a seção um número definido de mensagens acima do fim do chat, usando o número **Depth** (profundidade). Uma profundidade de 0 coloca a seção depois da última mensagem. Use para lembretes que o modelo deve ver perto das mensagens mais recentes.

<a id="wrap-formats"></a>

## Formatos de envelopamento

**Wrap Format**, na aba **Overview**, define como cada seção é envelopada.

| Formato | Resultado |
| --- | --- |
| **XML** | Cada seção fica entre marcações. Os grupos viram marcações pai. Este é o padrão. |
| **MARKDOWN** | Cada seção ganha um título. Os grupos viram títulos de nível mais alto. |
| **NONE** | Nenhum envelopamento. O conteúdo é enviado como foi escrito. |

XML serve para a maioria dos modelos. Teste os outros só se um modelo responder melhor sem marcações.

Para enviar um único **Prompt Block** sem a marcação ou o título dele, expanda o bloco e ligue **Send without wrapper** (enviar sem envelopamento). A marcação de um grupo ainda pode ficar em volta dele, então tire o bloco do grupo para enviá-lo totalmente sem envelopamento. Os marcadores sempre mantêm o envelopamento, e o botão liga/desliga fica oculto quando o formato é **NONE**.

<a id="conversation-and-game-chats"></a>

## Chats de Conversation e Game

Esses chats não montam o prompt a partir das Sections. Eles usam um único prompt de modo. Em **Chat Settings**, a seção **Prompt Preset** tem um menu suspenso **Prompt source** (origem do prompt) com os seus presets. Ele começa em **Default conversation prompt** ou **Default game prompt**, ou mostra **No presets available** quando você não tem nenhum. No painel **Presets**, o botão de atribuir mostra "Prompt presets are not available in conversation mode."

Abaixo do menu suspenso, um selo mostra de onde vem o prompt.

| Selo | Significado |
| --- | --- |
| **Default** | O prompt integrado. |
| **Preset** | O prompt do preset escolhido. |
| **Style** | O prompt do estilo de prompt do GM selecionado. Só em chats de Game. |
| **Custom** | Uma edição local, só para este chat. Ela prevalece sobre todas as outras. |

A caixa de texto mostra o prompt em uso. Edite-a para criar uma cópia local deste chat. Se o seu texto for idêntico ao do preset ou ao padrão, Marinara o considera não personalizado. Enquanto existe uma edição personalizada, aparece um ícone de redefinir (dica **Reset to default prompt**).

Os chats de Game acrescentam mais controles. **Story style**, **Violence**, **Content boundaries** e **Rating guidelines** (Diretrizes da classificação) definem o que a história do jogo pode conter. Veja [Mudar durante um jogo](../game/getting-started.md#change-them-during-a-game). Outros dois moldam o prompt. **GM prompt style** (estilo de prompt do GM) substitui só o prompt de Game, e uma edição local do chat ainda prevalece. **Extra instructions** (instruções extras) acrescenta texto ao prompt de Game, até 2000 caracteres, como "Write in the style of Terry Pratchett."

## Ordenar as seções para o cache de prompts

O cache de prompts permite que um serviço reutilize o começo de um prompt que já leu, para que chats longos custem menos e recebam respostas mais rápido. O serviço reutiliza o prompt só até o primeiro texto que mudou desde a última mensagem. As memórias recuperadas mudam a cada mensagem, ou quase, então, antes do histórico do chat, impedem que o histórico inteiro entre no cache.

Para posicioná-las, adicione um marcador **Recuperação de memórias** ao preset. Arraste-o para baixo de **Histórico do chat**, ou defina sua **Posição** como **Profundidade (a partir do fim do chat)** para colocá-lo dentro do histórico. Memórias lidas antes da história mantêm as respostas mais próximas delas, então o padrão continua sendo antes do histórico.

<a id="decision-blocks-and-prompt-caching"></a>

## Blocos de decisão e cache de prompts

Uma seção pode conter um bloco de decisão, `{{#if decision:"..."}}`, para que essa parte só seja enviada quando uma declaração sobre o chat for verdadeira. Veja [Consultar o modelo de decisão](conditional-prompts.md#asking-the-decision-model).

Coloque os blocos de decisão que mudam com frequência no fim do prompt, como nas instruções após o histórico. Um ramo alterado pode impedir que um provedor reutilize o prompt a partir daquele ponto, então uma mudança no início perde a maior parte da economia do cache. Uma parte anterior que não mudou ainda pode ser reutilizada. Mantenha uma decisão perto do topo só quando a resposta dela muda raramente. Veja [Cache de prompts](conditional-prompts.md#prompt-caching).

As declarações em seções e grupos desativados nunca são perguntadas e não contam para **Decision statements per turn** (declarações de decisão por turno).

## Conferir o que a IA recebeu

**Peek Prompt** mostra o prompt montado por inteiro para uma mensagem. É o jeito mais rápido de investigar uma resposta estranha. Veja [Peek Prompt: veja o que a IA recebeu](../chats/peek-prompt.md).

## Guias relacionados

- [Variáveis de preset](preset-variables.md)
- [Macros de prompt](macros.md)
- [Parâmetros de geração](generation-parameters.md)
- [Perfis de configurações](../chats/settings-profiles.md)
- [Visão geral do painel Chat Settings](../chats/chat-settings.md)
- [Peek Prompt: veja o que a IA recebeu](../chats/peek-prompt.md)
