# Variáveis de preset

Este guia explica as **Preset Variables** (variáveis de preset), aquelas pequenas escolhas em forma de formulário que você embute em um preset de prompt. Quem cria o preset define as escolhas uma vez, e qualquer pessoa que use o preset seleciona as opções no momento em que ele é atribuído a um chat. As variáveis de preset também são chamadas de blocos de escolha.

## O que são as variáveis de preset

Um preset de prompt é uma planta reutilizável do texto enviado para a IA. A variável de preset acrescenta a essa planta uma escolha com rótulo. Você dá um nome à escolha, escreve uma pergunta e lista algumas opções.

Dentro de qualquer seção de prompt, digite o nome da variável entre chaves duplas, assim: `{{tone}}`. Na hora de gerar a resposta, Marinara Engine troca `{{tone}}` pelo valor da opção escolhida pelo usuário. Com isso, um mesmo preset produz comportamentos diferentes sem que você precise mexer no texto do prompt.

As variáveis de preset ficam dentro de um preset de prompt, então funcionam nos modos de chat que usam presets de prompt. Elas não valem no Conversation Mode. Esse modo usa uma substituição direta do texto do prompt, em vez do preset dividido em seções, e por isso não há nada para as variáveis preencherem. Para conhecer os presets em si, veja [Editor de presets e gerenciador de prompts](presets.md).

## Os três tipos de variável de preset

O comportamento da variável depende das opções dela e de dois botões liga/desliga. Por padrão, uma variável com várias opções é uma escolha única: o usuário seleciona exatamente uma opção, exibida como botões de rádio. Além dessa base, existem três tipos com nome próprio.

**Boolean Toggle.** Se a variável tem exatamente uma opção, ela vira um interruptor de liga/desliga. Quando o usuário liga, o valor da opção é inserido. Quando desliga, nada é inserido. O editor mostra a etiqueta **Boolean Toggle** nessas variáveis.

**Multi-Select.** Ative o botão liga/desliga **Multi-Select** (seleção múltipla) para que o usuário escolha mais de uma opção. Por padrão, os valores selecionados são unidos por um separador. O separador é um campo de texto curto, e o padrão é uma vírgula seguida de espaço. Por exemplo: as opções Romance, Fantasy e Action unidas por `, ` viram o texto "Romance, Fantasy, Action".

**Random Pick** (escolha aleatória). Para uma variável de seleção única, o Marinara pré-seleciona uma opção aleatória em cada chat novo. Você pode alterá-la antes de confirmar, e a escolha salva permanece fixa até ser editada. Com **Multi-Select** ativado, o aplicativo sorteia uma das opções selecionadas pelo usuário a cada geração. Isso ajuda a variar: o usuário monta um conjunto de opções, e cada resposta puxa uma delas.

## Como adicionar uma variável de preset

As variáveis são adicionadas durante a edição de um preset. Siga estes passos:

1. Abra o painel **Presets** e clique em um preset para abrir o **Preset Editor** (editor de presets).
2. Vá para a aba **Sections** e role até o painel **Preset Variables**, lá embaixo.
3. Clique em **Add Variable**. Um novo card de variável aparece. Clique nele para expandir o editor.
4. Defina o **Variable Name** (nome da variável). Ele aceita apenas letras, números e sublinhados. É esse nome que você digita entre chaves, assim: `{{variable_name}}`.
5. Preencha o campo **Question (shown to user)** (a pergunta mostrada ao usuário). É o texto que o usuário lê na hora de escolher um valor.
6. Edite a lista **Options**. Cada opção tem um **Label** (o que o usuário vê) e um **Value** (o texto inserido no prompt). Um valor em branco não insere nada.
7. Escolha um estilo de exibição na seção **Presentation**: **Auto**, o estilo de botões (**Radios** ou **Checkboxes**) ou o estilo compacto (**Dropdown** ou **Listbox**). Ative a opção **Alphabetical option display** para ordenar as opções pelo rótulo.
8. As alterações são salvas sozinhas. O rodapé do editor mostra "Changes auto-save. Press Escape to close." Pressione Escape ou clique em **Done** quando terminar.

Para usar a variável, digite o nome dela entre chaves dentro do conteúdo de qualquer seção de prompt. Por exemplo: coloque `{{tone}}` em uma seção e depois crie uma variável chamada `tone` com uma opção **Gentle** e outra **Harsh**. Quando o usuário escolhe Harsh, a seção recebe o valor correspondente.

Toda variável precisa manter pelo menos uma opção. Se você tentar excluir a última, Marinara mantém ela.

## A janela Configure Preset Variables

Quando você atribui a um chat um preset que tem variáveis, a janela **Configure Preset Variables** (configurar as variáveis do preset) abre sozinha. A introdução dela diz: "This preset has configurable variables. Select option(s) for each to customize your experience."

Cada variável mostra a pergunta, o token correspondente (como `{{tone}}`) e um selo pequeno com **Boolean toggle**, **Multi-select** ou **Random pick**, conforme o caso. Escolha um valor para cada variável.

- O botão **Save as default** salva as escolhas no próprio preset, e assim elas já vêm preenchidas na próxima vez.
- O botão **Skip** fecha a janela sem salvar as escolhas.
- O botão **Confirm Choices** salva as escolhas. Ele fica desativado enquanto alguma variável de escolha única estiver sem valor. As variáveis **Boolean toggle** e **Multi-select** não travam o botão, mesmo sem nada selecionado.

Ao trocar de preset, todas as escolhas de variável feitas para o preset atual são descartadas.

## Como mudar as respostas depois

Não é preciso reabrir o preset do zero para mudar as respostas. No painel lateral de configurações do chat, a seção **Prompt Preset** mostra um botão de lápis chamado **Edit preset variables** sempre que o preset selecionado tem variáveis. Clique nele para reabrir a janela **Configure Preset Variables** já com as escolhas atuais preenchidas.

## O curinga {{NAME}}

Marinara resolve várias macros nativas, como `{{user}}` e `{{char}}`. Depois disso, qualquer marcador restante no formato `{{NAME}}` (só letras, números e sublinhados) é comparado com as variáveis do preset.

Se existir uma variável com exatamente esse nome, o marcador vira o valor escolhido. Se nenhuma variável corresponder, o texto `{{NAME}}` fica exatamente como foi digitado. É por isso que um marcador desconhecido aparece intacto no resultado, em vez de gerar um erro. Para ver a lista completa de macros, veja [Macros de prompt](macros.md).

## Guias relacionados

- [Editor de presets e gerenciador de prompts](presets.md)
- [Macros de prompt](macros.md)

As variáveis de preset também são resolvidas nas saudações dos personagens, inclusive escolhas confirmadas depois que a saudação foi criada. A saudação original continua editável, com as macros intactas.
