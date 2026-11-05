# Variáveis de preset

A variável de preset é uma escolha com rótulo embutida em um preset de prompt. Quem cria o preset a define uma vez, e quem usa o preset escolhe as opções ao atribuí-lo a um chat. Use uma para que um mesmo preset se comporte de jeitos diferentes sem mexer no texto do prompt.

Você dá um nome à variável, escreve uma pergunta e lista as opções. Depois digita o nome entre chaves duplas, como `{{tone}}`, em qualquer seção de prompt. Quando a IA gera uma resposta, Marinara troca `{{tone}}` pelo valor da opção que o usuário escolheu.

As variáveis de preset precisam de um preset de prompt, então funcionam nos chats de Roleplay. Elas não valem nos chats de Conversation nem de Game, que usam um único texto de prompt em vez de seções. Para os presets em si, veja [Editor de presets e gerenciador de prompts](presets.md).

## Os tipos de variável de preset

Uma variável com várias opções é, por padrão, uma escolha única. O usuário escolhe uma opção, exibida como botões de rádio. Três configurações mudam isso.

| Tipo | Como obter | Comportamento |
| --- | --- | --- |
| **Boolean Toggle** | Dê à variável exatamente uma opção. | Um botão liga/desliga. Ligado, insere o valor da opção. Desligado, não insere nada. |
| **Multi-Select** (seleção múltipla) | Ative **Multi-Select**. | O usuário escolhe várias opções. Os valores são unidos por um separador, `, ` por padrão. Romance, Fantasy e Action viram "Romance, Fantasy, Action". |
| **Random Pick** (escolha aleatória) | Ative **Random Pick**. | Em uma variável de seleção única, Marinara pré-seleciona uma opção aleatória para cada chat novo, e a escolha fica fixa até você mudá-la. Com **Multi-Select** ativado, o usuário escolhe um conjunto e cada resposta sorteia uma opção dele. |

## Como adicionar uma variável de preset

1. Abra o painel **Presets** e clique em um preset para abrir o **Preset Editor** (editor de presets).
2. Vá para a aba **Sections** e role até o painel **Preset Variables**, lá embaixo.
3. Clique em **Add Variable** (adicionar variável). Um novo cartão de variável aparece. Clique nele para expandi-lo.
4. Defina o **Variable Name** (nome da variável). O campo aceita só letras, números e sublinhados. É esse o nome que você digita entre chaves.
5. Preencha **Question (shown to user)** (a pergunta mostrada ao usuário). O usuário lê esse texto na hora de escolher.
6. Edite a lista **Options** (opções). Cada opção tem um **Label**, que o usuário vê, e um **Value**, o texto inserido no prompt. Um valor em branco não insere nada.
7. Em **Presentation**, escolha **Auto**, um estilo de botões (**Radios** ou **Checkboxes**) ou um estilo compacto (**Dropdown** ou **Listbox**). Ative **Alphabetical option display** (exibição das opções em ordem alfabética) para ordenar as opções pelo rótulo.
8. Pressione <kbd>Escape</kbd> ou clique em **Done** (concluir). As alterações são salvas sozinhas, e o rodapé diz "Changes auto-save. Press Escape to close."

Agora digite o nome entre chaves em uma seção de prompt. Por exemplo, coloque `{{tone}}` em uma seção e crie uma variável chamada `tone` com uma opção **Gentle** e outra **Harsh**. Quando o usuário escolhe **Harsh**, a seção recebe o valor dela.

Uma variável sempre mantém pelo menos uma opção. Se você tentar excluir a última, Marinara a mantém.

## Como responder às variáveis

Quando você atribui a um chat um preset que tem variáveis, a janela **Configure Preset Variables** (configurar as variáveis do preset) se abre. Ela diz: "This preset has configurable variables. Select option(s) for each to customize your experience."

Cada variável mostra a pergunta, o token dela, como `{{tone}}`, e um selo (**Boolean toggle**, **Multi-select** ou **Random pick**) quando se aplica.

1. Escolha um valor para cada variável.
2. Clique em **Confirm Choices** (confirmar as escolhas).

Os outros botões:

- **Save as default** (salvar como padrão) guarda as suas escolhas no preset, para elas já virem preenchidas na próxima vez.
- **Skip** (pular) fecha a janela sem salvar.

**Confirm Choices** fica desativado até toda variável de escolha única ter um valor. As variáveis **Boolean toggle** e **Multi-select** não o bloqueiam, mesmo sem nada escolhido. Ao trocar para outro preset, as suas escolhas para o anterior são descartadas.

## Como mudar as respostas depois

Em **Chat Settings** (configurações do chat), a seção **Prompt Preset** mostra um botão de lápis, **Edit preset variables** (editar as variáveis do preset), quando o preset selecionado tem variáveis. Clique nele para reabrir a janela com as suas escolhas atuais.

## Nomes que não são variáveis

Marinara resolve primeiro as macros nativas, como `{{user}}` e `{{char}}`. Depois compara qualquer outro `{{NAME}}` (letras, números e sublinhados) com as suas variáveis de preset. Se nenhuma corresponder, tenta as variáveis do próprio chat, da seção **Chat Variables** (variáveis do chat) de **Chat Settings**. A variável de preset tem prioridade quando as duas têm o mesmo nome. Se nenhuma tiver o nome, o texto fica exatamente como foi digitado, sem erro. Veja [Macros de prompt](macros.md).

## Blocos de decisão nas opções

O valor de uma opção pode conter um bloco de decisão, `{{#if decision:"..."}}`, como qualquer outro texto de prompt. Só as opções que o chat selecionou são perguntadas, e elas contam para **Decision statements per turn** (declarações de decisão por turno). Em uma variável **Random Pick**, todas as opções do conjunto são perguntadas, porque qualquer uma pode ser sorteada. Veja [Consultar o modelo de decisão](conditional-prompts.md#asking-the-decision-model).

O valor de uma variável vai para onde está o `{{name}}` dela. Se uma decisão mudar esse valor perto do início de um preset, você pode perder boa parte da reutilização do cache de prompt do serviço. Coloque o conteúdo que muda com frequência mais adiante. Veja [Blocos de decisão e cache de prompts](presets.md#decision-blocks-and-prompt-caching).

## Saudações

As variáveis de preset também são resolvidas nas saudações dos personagens, inclusive as escolhas confirmadas depois que a saudação foi criada. A saudação original continua editável, com as macros intactas.

## Guias relacionados

- [Editor de presets e gerenciador de prompts](presets.md)
- [Macros de prompt](macros.md)
