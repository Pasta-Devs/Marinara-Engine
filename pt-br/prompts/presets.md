# Editor de presets e gerenciador de prompts

Este guia explica os presets de prompt (um modelo de prompt salvo) no Marinara Engine. Aqui você vê para que servem, como montar um no **Preset Editor** (editor de presets) e como atribuir um preset a um chat. O preset controla a estrutura do texto que Marinara envia para a IA.

## O que é um preset

O preset é uma planta reaproveitável. É ele que decide quais informações Marinara envia para a IA e em que ordem. Isso inclui as instruções de sistema que você escreve, o card de personagem, a persona, o histórico do chat, as entradas de lorebook e mais.

Os presets moldam o prompt (o texto que Marinara envia para a IA) nos chats de **Roleplay** e **Game**. O modo **Conversation** funciona de outro jeito e usa um único campo de prompt. Veja "Como os modos Conversation e Game se diferenciam", mais abaixo.

Os presets não precisam de chave de API nem de conta. Eles apenas descrevem como o prompt é montado. Para enviar o prompt, você ainda precisa de uma conexão funcionando. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

## Como abrir o Preset Editor

Os presets de prompt ficam na seção **Prompts** do painel **Presets**, no lado esquerdo do aplicativo. As outras seções desse painel são **Regexes** e **Functions**.

O painel tem três botões no topo:

- **New** (ícone de mais): cria um preset novo.
- **Import** (ícone de download): carrega um preset a partir de um arquivo `.json`.
- **Select** (ícone de marca de seleção): escolhe vários presets para exportar ou excluir de uma vez.

Abaixo dos botões ficam a caixa **Search presets** e um menu de ordenação com **A-Z**, **Z-A**, **Newest** e **Oldest**. O botão **New Folder** agrupa os presets em pastas. Arraste um preset até uma pasta para movê-lo. Dê um duplo clique ou um toque duplo na pasta para renomeá-la.

Cada linha de preset mostra o nome, o formato de envelopamento, a quantidade de seções e o autor. O selo **DEFAULT** aparece quando o preset é o padrão marcado com estrela. Clique na linha do preset para abri-lo no **Preset Editor**.

## Criar e editar um preset

Siga estes passos para criar um preset novo:

1. Abra o painel **Presets**.
2. Clique no botão **New**. A janela **Create Preset** abre.
3. Digite um **Name**. Esse campo é obrigatório.
4. Preencha o campo opcional **Description** para lembrar depois para que serve o preset.
5. Clique em **Create**. O preset novo abre no **Preset Editor**.
6. Monte o prompt na aba **Sections** (explicada abaixo).
7. Clique em **Save**, no canto superior direito, quando terminar.

O editor não salva sozinho. As alterações só ficam salvas depois que você clica em **Save**. Se tentar sair com edições não salvas, aparece um aviso com os botões **Keep editing**, **Discard** e **Save & close**.

Para exportar um preset, abra-o e clique no botão de exportar (ícone de seta para cima) na barra superior. Marinara pede para salvar antes, caso existam edições não salvas. Para excluir um preset, use o ícone de lixeira na barra superior.

## As abas Overview, Sections e Prompts

O **Preset Editor** tem três abas.

- **Overview**: o nome do preset, a descrição, o formato de envelopamento e o autor.
- **Sections**: a estrutura do prompt em si, montada com blocos e marcadores.
- **Prompts**: os prompts de modo usados pelos chats Conversation e Game.

### Aba Overview

A aba **Overview** tem quatro campos. O campo **Name** é o nome de exibição mostrado no painel **Presets**. O campo **Description** traz um resumo curto do preset. O campo **Wrap Format** controla a formatação das seções (veja "Formatos de envelopamento"). O campo **Author** é o nome opcional de quem criou o preset, útil quando você compartilha o preset. Dois cards somente leitura mostram a contagem de **Sections** e de **Groups**.

### Aba Prompts

A aba **Prompts** guarda os prompts de modo.

- **Conversation Mode**: uma caixa de texto usada como prompt de Conversation deste preset. Deixe vazia para usar o prompt de conversa embutido do Marinara.
- **Roleplay Mode**: não é editável aqui. O Roleplay usa o prompt montado a partir das suas **Sections**.
- **Game Mode**: uma caixa de texto usada como prompt de Game deste preset. Deixe vazia para usar o prompt de jogo embutido do Marinara.

## Seções e marcadores

A aba **Sections** é onde você monta o prompt. Cada seção vira parte do texto final enviado para a IA. As seções são montadas de cima para baixo.

Clique em **Add Section** para abrir o menu de adição. Ele oferece dois tipos de seção.

O **Prompt Block** é uma seção de texto livre, escrita por você. Use para instruções de sistema, regras de tom ou qualquer texto que deva estar em todo prompt.

O **marcador** é uma seção preenchida automaticamente. Ele não tem texto próprio. Em vez disso, Marinara o preenche na hora do envio com o conteúdo atual do chat. A tabela abaixo lista os marcadores.

| Marcador | O que insere |
|---|---|
| **Character Info** | Os detalhes do card de personagem ativo. |
| **Persona** | Os detalhes da persona ativa. |
| **Chat History** | As mensagens em andamento do chat. |
| **Chat Summary** | O resumo compilado deste chat. |
| **Dialogue Examples** | Os diálogos de exemplo do personagem. |
| **Lorebook Marker (All)** | Todas as entradas de lorebook ativas. |
| **Lorebook Marker (Before)** | As entradas de lorebook configuradas para inserção antes. |
| **Lorebook Marker (After)** | As entradas de lorebook configuradas para inserção depois. |

A seção que é um marcador mostra o selo **MARKER** na linha. Expanda a seção para ver uma nota com o nome do tipo de marcador. Na maioria dos marcadores não é possível digitar conteúdo, porque Marinara gera esse conteúdo para você.

Quando o preset não tem um marcador **Dialogue Examples** ativado, o Example Dialogue preenchido é acrescentado ao **Character Info**, depois do Scenario. A formatação segue o padrão do preset: XML, Markdown ou sem envelopamento. Adicione um marcador Dialogue Examples quando quiser controlar a posição de forma explícita; Marinara não inclui o conteúdo duas vezes.

Se o chat tiver lorebooks ativos e o preset não tiver marcador de lorebook, aparece um aviso. O texto diz: "Add a lorebook marker when this preset should receive active lorebook entries." Adicione um marcador de lorebook para que essas entradas cheguem até a IA. Veja [Visão geral dos lorebooks](../lorebooks/overview.md).

Se você configurou agentes personalizados com a opção "inject as section" ativada, o menu de adição mostra o grupo **Agent Sections**. Cada seção de agente insere a saída mais recente daquele agente no prompt. Você pode escrever instruções próprias ao redor dela.

Cada linha de seção tem controles à direita. O botão **Duplicate** copia a seção. O ícone de olho ativa ou desativa a seção. O botão **Delete** remove a seção. Para reordenar as seções, arraste pela alça, use as setas para cima e para baixo ou pressione e segure em uma tela sensível ao toque.

Expanda uma seção (clique no nome dela ou na seta) para editá-la. Você pode mudar o campo **Name** e o papel (**System**, **User** ou **Assistant**). No caso do **Prompt Block**, também é possível editar o campo **Content**. A caixa de conteúdo aceita macros. Veja [Macros de prompt](macros.md).

## Grupos e posição das seções

### Grupos

Os grupos reúnem várias seções em um só contêiner. Assim as seções relacionadas ficam juntas no prompt final.

1. Na aba **Sections**, clique no botão **Groups** da barra de ferramentas.
2. Clique em **New Group**. Aparece um grupo chamado "New Group".
3. Clique no nome do grupo para renomeá-lo.
4. Expanda uma seção e escolha o grupo no menu suspenso **Group** dela.

Com o formato de envelopamento **XML**, o grupo vira uma marcação pai em volta das seções. Com **Markdown**, o grupo vira um título. Excluir um grupo não exclui as seções dele. Elas apenas deixam de ter grupo.

### Posição e profundidade

Cada seção tem a configuração **Position** dentro do editor expandido.

- **Ordered (in sequence)**: a seção fica onde aparece na lista. Essa é a escolha normal.
- **Depth (from end of chat)**: a seção é colocada um número definido de mensagens acima do fim do chat. Ao escolher essa opção, aparece o número **Depth**. Uma profundidade de 0 coloca a seção depois da última mensagem.

Use **Depth** para lembretes que a IA deve ver perto das mensagens mais recentes, como uma nota curta de estilo.

## Formatos de envelopamento

O campo **Wrap Format**, na aba **Overview**, controla como cada seção é envelopada na montagem do prompt. São três botões.

- **XML**: cada seção é envelopada em marcações, por exemplo uma marcação com o nome em volta do conteúdo. Os grupos viram marcações pai. Esse é o padrão.
- **MARKDOWN**: cada seção é envelopada com um título. Os grupos viram títulos de nível mais alto.
- **NONE**: nenhum envelopamento é acrescentado. O conteúdo da seção é enviado exatamente como foi escrito.

XML é um bom padrão para a maioria dos modelos. Teste **MARKDOWN** ou **NONE** só quando um modelo parecer responder melhor sem marcações.

## Atribuir um preset a um chat

O preset não faz nada até ser atribuído a um chat. Há duas formas de fazer isso em um chat de **Roleplay**.

Pelo painel **Presets**:

1. Abra o chat que você quer mudar.
2. No painel **Presets**, passe o mouse sobre a linha de um preset.
3. Clique no botão **Assign to chat** (marca de seleção). Clique de novo para desfazer a atribuição.

Por **Chat Settings** (configurações do chat):

1. Abra o chat.
2. Abra **Chat Settings** (a engrenagem).
3. Encontre a seção **Prompt Preset**.
4. Escolha um preset no menu suspenso.

Se o preset tiver variáveis, a janela **Configure Preset Variables** abre no momento da atribuição. Preencha as escolhas ali. Veja [Variáveis de preset](preset-variables.md). Ao trocar para outro preset, as escolhas de variáveis feitas antes são apagadas.

Os presets de prompt não ficam disponíveis pelo painel no modo **Conversation**. Ao clicar no botão de atribuir em um chat de Conversation, aparece a mensagem: "Prompt presets are not available in conversation mode." Veja na próxima seção como os chats de Conversation e Game usam os presets.

## Como os modos Conversation e Game se diferenciam

Os chats de **Conversation** e de **Game** não montam o prompt a partir das Sections. Eles usam um único prompt de modo, que pode ser substituído em cada chat.

Nesses modos, a tela **Chat Settings** mostra a seção **Prompt Preset** com o menu suspenso **Prompt source**. O menu lista os seus presets. O padrão é "Default conversation prompt" ou "Default game prompt". Se você não tiver nenhum preset, o texto é "No presets available".

Abaixo do menu suspenso fica uma linha de status. Ela mostra um destes três estados:

- **Default**: o prompt de modo embutido está em uso.
- **Preset**: o prompt vem do preset escolhido.
- **Custom**: você digitou uma edição local, válida só para este chat.

Clique em **Edit Prompt** para escrever um prompt só para este chat. O editor abre como **Edit Conversation Prompt** ou **Edit Game Prompt**. Se a edição for idêntica ao preset ou ao padrão, Marinara a considera como não personalizada. Quando existe uma edição personalizada, aparece o botão **Reset to default prompt** para limpá-la.

Os chats de Game têm ainda a caixa **Extra instructions**. O texto dela é acrescentado ao prompt de Game. O limite é de 2000 caracteres. Um exemplo de instrução: "Write in the style of Terry Pratchett."

<a id="decision-blocks-and-prompt-caching"></a>

## Blocos de decisão e cache de prompts

Uma seção pode conter um bloco `{{#if decision:"..."}}` para enviar essa parte do preset somente nos turnos em que uma declaração sobre o chat for verdadeira. Veja [Consultar o Decision model](conditional-prompts.md#asking-the-decision-model).

**Coloque blocos de decisão variáveis no fim do prompt**, como em instruções após o histórico. Mudar um ramo pode impedir reutilização a partir daquele ponto; uma mudança no início pode perder a maior parte da economia. Um prefixo anterior intacto ainda pode se qualificar; não é obrigatório cobrar todo o prompt como novo. Mantenha decisões no início só se mudarem raramente e suas instruções pertencerem ali. Veja detalhes por provedor em [Cache de prompts](conditional-prompts.md#prompt-caching).

Declarações em seções e grupos desativados nunca são perguntadas nem contam em **Decision statements per turn** (declarações de decisão por turno).

## Conferir o que a IA recebeu

Para confirmar qual preset e quais seções chegaram de fato à IA, use o **Peek Prompt**. Ele mostra o prompt inteiro montado para uma mensagem. Esse é o caminho mais rápido para investigar uma resposta estranha. Veja [Peek Prompt: veja o que a IA recebeu](../chats/peek-prompt.md).

## Guias relacionados

- [Variáveis de preset](preset-variables.md)
- [Macros de prompt](macros.md)
- [Parâmetros de geração](generation-parameters.md)
- [Perfis de configurações](../chats/settings-profiles.md)
- [Visão geral do painel Chat Settings](../chats/chat-settings.md)
- [Peek Prompt: veja o que a IA recebeu](../chats/peek-prompt.md)
