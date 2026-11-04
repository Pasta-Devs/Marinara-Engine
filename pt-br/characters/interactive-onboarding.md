# Onboarding interativo

Você só precisa deste guia se faz cards para outras pessoas jogarem. O onboarding interativo permite que um card de personagem faça perguntas ao jogador quando ele começa um chat de Roleplay e depois monte uma persona a partir das respostas. Os autores configuram o recurso no Character Editor (editor de personagem). Os jogadores respondem no assistente de configuração de novo chat.

## O que ele faz

A persona é o card de personagem que representa você em um chat. Veja [Personas](personas.md). Normalmente, você mesmo escreve uma antes de jogar. Com o onboarding, o card traz um modelo de persona no lugar disso: os cinco campos de persona (**Description**, **Personality**, **Backstory**, **Appearance** e **Scenario**) com lacunas para o jogador, mais as perguntas que as preenchem.

Quando um jogador começa um chat de Roleplay com o card, ele pode escolher **Create your persona** (criar a sua persona), responder às perguntas e receber uma persona nova e comum. As respostas são escritas no texto uma única vez. O jogador pode editar, manter ou excluir a persona como qualquer outra. O card não muda.

Um card também pode fazer perguntas do personagem, cujas respostas são salvas naquele chat em vez de em uma persona. Veja [Perguntas do personagem](#character-questions). O onboarding usa a sintaxe de macros que já existe e não roda nenhum script.

## Configurar o recurso como autor

1. Abra o personagem no Character Editor. Veja [Criando e editando personagens](creating-and-editing-characters.md).
2. Abra a aba **Onboarding**, ao lado de **Card**.
3. Ative o botão liga/desliga **Interactive onboarding** (onboarding interativo). Um guia curto, **How onboarding works** (como o onboarding funciona), aparece abaixo do botão.

Desativar o botão esconde os campos de onboarding, mas mantém o que você escreveu.

### Deixar a Professor Mari escrever

Peça à [Professor Mari](../home/professor-mari.md), por exemplo: "Escreva um onboarding divertido para a Queen Ayrene, com uma persona modelo." Ela escreve as perguntas e os campos da persona e ativa o onboarding. O aplicativo confere o trabalho dela antes de salvar. Um nome com erro de digitação, um `{{name}}` sem pergunta ou uma condição sem o `#` volta para ela corrigir. Para uma pergunta do personagem, ela também coloca o `{{name}}` correspondente em um dos campos do próprio card. As mudanças dela aparecem em um card de mudança que você pode revisar ou desfazer.

### Adicionar perguntas da persona

Em **Persona Questions** (perguntas da persona), clique em **Add Question** (adicionar pergunta). Cada pergunta funciona como uma variável de preset, uma lacuna com nome que uma resposta preenche. Veja [Editor de presets e gerenciador de prompts](../prompts/presets.md). Um card pode ter até 100 perguntas.

| Campo | O que faz |
| --- | --- |
| **Variable Name** (nome da variável) | O nome que você usa nos campos, como `faction`. Use letras, números e sublinhados, começando com uma letra ou um sublinhado. Os nomes diferenciam maiúsculas de minúsculas: `Gender` e `gender` são diferentes. |
| **Question (shown to user)** (a pergunta mostrada ao usuário) | O que o jogador lê. Pode usar respostas anteriores, como `What does {{player}} look like?`. `{{char}}` é o nome do card e `{{user}}`, o nome do jogador. |
| **Options** (opções) | Transforma a pergunta em uma escolha. A primeira opção vem selecionada por padrão. Sem opções, o jogador digita uma resposta livre. |
| **Value** (valor) | O que entra na persona. As maiúsculas e minúsculas ficam do jeito que você digitar, e as macros dentro dele são preenchidas. Deixe em branco para usar o rótulo da opção. Use um valor em minúsculas, como `ranger`, se a resposta entrar no meio de uma frase. |
| **Help text for players** (texto de ajuda para os jogadores) | Texto opcional abaixo da opção. |
| **Allow own answer** (permitir resposta própria) | Acrescenta uma escolha **Write your own** (escrever a sua) ao lado das suas opções. |
| **Multi-Select** (seleção múltipla) | Permite que o jogador escolha várias opções, unidas pelo separador. |

Uma pergunta chamada `player` define o nome da persona. Sem ela, o aplicativo pergunta primeiro o nome do jogador. O editor avisa quando um nome está vazio, é inválido, foi usado duas vezes ou pertence a uma macro embutida, e também quando nenhum campo usa uma pergunta.

### Escrever os campos da persona

Escreva os cinco campos como os de uma persona sua e coloque `{{name}}` onde deve entrar uma resposta. Clique em um campo para ver as **Available variables** (variáveis disponíveis) dele e clique em uma para inseri-la onde está o cursor.

```text
Name: {{player}}
Class: {{class}}
Role: {{player}} is a {{class}} sworn to {{faction}}.
```

Use `{{#if}}` para mostrar um texto só para algumas respostas:

```text
{{#if knowsHer == yes}}Grew up next door to {{char}}. {{relationToAna}}{{/if}}
```

Uma pergunta que só aparece dentro de um `{{#if}}` só é feita quando a condição é verdadeira. Aqui, `relationToAna` é uma pergunta de acompanhamento que aparece quando o jogador responde **yes**. As comparações ignoram maiúsculas e minúsculas.

`{{user}}` e `{{char}}` continuam como macros na persona criada. Outras macros (marcadores que Marinara preenche, como `{{random}}` para um número aleatório ou `{{time}}` para a hora) são preenchidas uma única vez, quando a persona é criada, ou ficam vazias se não tiverem valor nesse momento.

A **Rendered preview** (prévia renderizada), no fim, mostra a persona montada a partir de respostas de exemplo e lista as perguntas feitas, na ordem.

<a id="character-questions"></a>

### Perguntas do personagem

A mesma aba tem uma segunda lista, **Character Questions** (perguntas do personagem). Elas funcionam como as perguntas da persona, mas as respostas são salvas no chat, não em uma persona. Coloque o nome em um dos campos do próprio card (**Description**, **Personality**, **Backstory**, **Appearance** ou **Scenario**), porque esses são os campos que o modelo lê.

```text
{{char}} treats {{relationshipToUser}} with open warmth.
```

Uma saudação pode usar o `{{name}}` de uma pergunta do personagem e mostra a resposta do jogador. Uma saudação também pode usar o `{{name}}` de uma pergunta da persona, como `Ah, so you are a {{class}}`, mas ele só é preenchido quando o jogador cria essa persona no assistente de configuração de novo chat, na primeira mensagem e nas saudações alternativas dela. Com uma persona existente ou com o Quick Start, a tag aparece como foi escrita, e o Character Editor avisa você. Clique em uma saudação e as **Available variables** dela listam os dois tipos, com rótulo.

As respostas são guardadas como variáveis do chat, então o card lê um valor diferente em cada chat e nunca precisa ser editado. Uma pergunta do personagem é feita sempre que o card está no chat, quer o jogador crie uma persona, quer não. A janela mostra **About you** (sobre você) apenas quando uma persona está sendo criada.

Três coisas que você precisa saber:

- **Uma resposta que nunca é preenchida continua como uma tag literal.** Uma pergunta de texto livre sem valor padrão não é preenchida de antemão, então um chat iniciado sem o assistente mostra `{{name}}` como foi escrito. As perguntas de escolha preenchem de antemão a primeira opção, o que cobre a maioria dos cards.
- **Dois cards no mesmo chat que declaram o mesmo nome compartilham um único valor.** A última resposta salva é a que os dois leem. A janela avisa você.
- **Um card que sai de um chat leva as respostas junto.** Quando um personagem é removido, as variáveis do chat que pertencem às perguntas do personagem dele são excluídas, a menos que outro personagem do chat declare o mesmo nome.

## Responder às perguntas como jogador

1. Comece um novo chat de Roleplay. Na etapa **Persona & Characters** (persona e personagens), os cards com onboarding mostram um pequeno ícone de pessoa com um sinal de mais na lista de personagens.
2. Adicione o personagem. Para obter uma nova persona, selecione **Create your persona** no topo de **Your Persona** (a sua persona). Essa opção mostra o nome do card a que pertence. Qualquer outra escolha, incluindo **None** (nenhuma), pula a persona.
3. Clique em **Next** (avançar). A janela de perguntas abre sempre que algum card do chat tiver perguntas do personagem, quer você esteja criando uma persona, quer não.
4. Responda às perguntas. As perguntas do personagem vêm primeiro, uma seção por card, e depois **About you** quando uma persona está sendo criada. As perguntas de acompanhamento aparecem conforme as suas respostas as tornam relevantes.
5. Clique em **Review persona** (revisar persona) para ver o nome e os campos que as suas respostas produzem. As partes que as suas respostas preencheram ficam destacadas. A prévia não salva nada.
6. Clique em **Create persona** (criar persona) ou, quando você não estiver criando uma, em **Save answers** (salvar respostas). As respostas do personagem são salvas no chat, e o assistente continua.

Se não funcionou: se a persona foi criada, mas não foi escolhida, escolha-a em **Your Persona**. Se as respostas não puderam ser salvas, o chat usa no lugar delas o texto padrão de cada card.

As perguntas do onboarding são feitas no assistente de configuração de novo chat de Roleplay. O Quick Start, a configuração do Conversation e começar um chat direto de um card de personagem ainda não as fazem. Um chat iniciado assim preenche a primeira opção de cada pergunta, então `{{relationshipToUser}}` é resolvido em vez de mostrar a tag. Responder no assistente substitui esse valor padrão apenas para aquele chat.

Você também pode responder depois da configuração, em **Chat Settings** (configurações do chat):

- O seletor **Persona** de um chat de Roleplay lista **Create your persona** para cada card do chat que oferece essa opção. Use quando tiver pulado o assistente ou quiser uma persona nova mais tarde. Veja [Escolhendo a persona de um chat](choosing-your-persona.md).
- O marcador de onboarding ao lado de um personagem em **Characters** (personagens) reabre só as perguntas do personagem daquele card. Ele abre com as respostas que o chat já guarda, então salvar uma mudança mantém as outras como estavam. Salvar também restaura uma resposta que você excluiu de **Chat Variables** (variáveis do chat). As respostas dos outros cards não são alteradas, exceto um nome que dois cards compartilham, que é um único valor, então os dois cards leem a nova resposta.

Adicionar um card com perguntas do personagem a um chat de Roleplay em andamento, por **Chat Settings** ou soltando o card sobre o chat, faz as perguntas dele primeiro. Depois, o card oferece a saudação dele com as suas respostas preenchidas e destacadas.

## Compartilhar cards com onboarding

O onboarding fica guardado com o card. As exportações **Marinara Native** e **Compatible PNG Card** mantêm o recurso, então um jogador que importa o card também recebe as perguntas. **Compatible JSON** deixa o onboarding de fora. Um card importado com mais de 100 perguntas mantém as 100 primeiras. Veja [Importar e exportar cards de personagem](import-export.md).

## Guias relacionados

- [Criando e editando personagens](creating-and-editing-characters.md)
- [Personas](personas.md)
- [Escolhendo a persona de um chat](choosing-your-persona.md)
- [Macros de prompt](../prompts/macros.md)
- [Importar e exportar cards de personagem](import-export.md)
