# Onboarding interativo

Este guia explica o **onboarding interativo**, um recurso do card de personagem que permite aos jogadores montar a própria persona respondendo às perguntas do autor do card ao começar um chat de Roleplay. Ele mostra como os autores configuram o recurso no Character Editor (editor de personagens) e o que os jogadores veem no assistente de configuração de novo chat.

## O que ele faz

A persona é o personagem que representa você em um chat. Veja [Personas do usuário](personas.md). Normalmente, você mesmo escreve uma persona antes de jogar. Com o onboarding interativo, o card de personagem traz no lugar disso um modelo de persona. O modelo é formado pelos cinco campos de persona (**Description**, **Personality**, **Backstory**, **Appearance** e **Scenario**), com lacunas para o jogador preencher, e pelas perguntas que preenchem essas lacunas.

Quando um jogador começa um chat de Roleplay com o card, ele pode escolher **Create your persona** (criar a sua persona), responder às perguntas e receber uma persona nova e comum. As respostas são escritas no texto uma única vez. O resultado é uma persona normal, que o jogador pode editar, manter ou excluir como qualquer outra. O card em si não muda.

Um card também pode fazer **perguntas do personagem**, cujas respostas são salvas naquele chat em vez de em uma persona. Veja [Perguntas do personagem](#character-questions) mais abaixo.

O onboarding usa a sintaxe de macros que já existe. Ele não roda nenhum script.

## Configurar o recurso como autor

1. Abra o personagem no Character Editor. Veja [Criando e editando personagens](creating-and-editing-characters.md).
2. Abra a aba **Onboarding**, ao lado de **Card**.
3. Ative o botão liga/desliga **Interactive onboarding** (onboarding interativo). Um guia curto, **How onboarding works** (como o onboarding funciona), aparece abaixo do botão.

Desativar o botão esconde os campos de onboarding, mas mantém o que você escreveu.

### Deixar a Professor Mari escrever

Você também pode pedir à [Professor Mari](../home/professor-mari.md) que escreva o onboarding, por exemplo: "Escreva um onboarding divertido para a Queen Ayrene, com uma persona modelo." Ela escreve as perguntas e os campos da persona e ativa o onboarding. O aplicativo confere o trabalho dela antes de salvar, então um nome com erro de digitação, um `{{name}}` sem pergunta ou uma condição sem o `#` volta para ela corrigir. Para uma pergunta do personagem, ela também coloca o `{{name}}` correspondente em um dos campos do próprio card. As mudanças dela aparecem em um card de mudança que você pode revisar ou desfazer, como as outras edições dela.

### Adicionar perguntas

Em **Persona Questions** (perguntas da persona), clique em **Add Question** (adicionar pergunta). Cada pergunta funciona como uma variável de preset. Veja [Editor de presets e gerenciador de prompts](../prompts/presets.md). Um card pode ter até 100 perguntas.

- **Variable Name** (nome da variável) é o nome que você usa nos campos, como `faction`. Escolha qualquer nome com letras, números e sublinhados que comece com uma letra ou um sublinhado. Os nomes diferenciam maiúsculas de minúsculas: `Gender` e `gender` são diferentes.
- **Question (shown to user)** (a pergunta mostrada ao usuário) é o que o jogador lê. Ela pode usar respostas anteriores, como `What does {{player}} look like?`. Aqui, `{{char}}` é o nome do card e `{{user}}` é o nome do jogador.
- **Options** (opções) transformam a pergunta em uma escolha. A primeira opção vem selecionada por padrão. Sem opções, o jogador digita uma resposta livre.
- **Value** (valor) é o que entra na persona. As maiúsculas e minúsculas ficam do jeito que você digitar; as macros dentro dele são preenchidas como no resto dos campos. Deixe em branco para usar o rótulo da opção. Digite um valor em minúsculas, como `ranger`, se a resposta entrar no meio de uma frase.
- **Help text for players** (texto de ajuda para os jogadores) é um texto opcional mostrado abaixo da opção.
- **Allow own answer** (permitir resposta própria) acrescenta a escolha **Write your own** (escrever a sua) ao lado das suas opções.
- **Multi-Select** (seleção múltipla) permite que o jogador escolha várias opções. Elas são unidas pelo separador.

Uma pergunta chamada `player` define o nome da persona. Se você não criar essa pergunta, o aplicativo pergunta primeiro o nome do jogador.

O editor avisa quando um nome está vazio, é inválido, foi usado duas vezes ou pertence a uma macro embutida, e também quando nenhum campo usa uma pergunta.

<a id="character-questions"></a>

### Perguntas do personagem

Mais abaixo, na mesma aba, há uma segunda lista, **Character Questions** (perguntas do personagem). As perguntas funcionam exatamente como as de cima, mas as respostas são salvas no **chat**, não em uma persona. Coloque o nome em um dos campos do próprio card: **Description**, **Personality**, **Backstory**, **Appearance** ou **Scenario**.

```
{{char}} treats {{relationshipToUser}} with open warmth.
```

Esses cinco campos são os que o modelo lê, então são os únicos que uma resposta de personagem consegue alcançar.

As respostas são guardadas como variáveis do chat, então o card lê um valor diferente em cada chat e nunca precisa ser editado. Uma pergunta do card é feita sempre que o card está no chat, quer o jogador crie uma persona, quer não. A janela mostra uma seção **About you** (sobre você) apenas quando uma persona está sendo criada.

Há três coisas que o autor deve saber:

- **Uma resposta que nunca é preenchida continua como uma tag literal.** Uma pergunta de texto livre sem valor padrão não é preenchida de antemão, então um chat iniciado sem o assistente mostra `{{name}}` exatamente como está escrito. As perguntas de escolha preenchem a primeira opção, o que cobre a maioria dos cards.
- **Se dois cards no mesmo chat declararem o mesmo nome, eles compartilham um valor.** Um chat guarda uma resposta por nome, então a última salva é a que os dois cards leem. A janela avisa quando isso acontece.
- **Um card que sai de um chat leva as respostas junto.** Quando um personagem é removido, as variáveis do chat que pertencem às perguntas do personagem dele são excluídas, a menos que outro personagem que continua no chat declare o mesmo nome. Um nome compartilhado permanece, porque o card que ficou ainda pode lê-lo.

### Escrever os campos da persona

Escreva os cinco campos como os de uma persona sua e coloque `{{name}}` onde deve entrar uma resposta:

```
Name: {{player}}
Class: {{class}}
Role: {{player}} is a {{class}} sworn to {{faction}}.
```

Quando você clica em um campo, as **Available variables** (variáveis disponíveis) dele aparecem logo abaixo. Clique em uma para inseri-la onde está o cursor.

Use `{{#if}}` para mostrar um texto só para algumas respostas:

```
{{#if knowsHer == yes}}Grew up next door to {{char}}. {{relationToAna}}{{/if}}
```

Uma pergunta que só aparece dentro de um `{{#if}}` só é feita quando essa condição é verdadeira. No exemplo, `relationToAna` é uma pergunta de acompanhamento que aparece quando o jogador responde **yes**. As comparações ignoram maiúsculas e minúsculas.

`{{user}}` e `{{char}}` continuam como macros na persona criada, então funcionam como em qualquer persona. Outras macros, como `{{random}}`, `{{time}}` ou `{{getvar}}`, são preenchidas uma única vez, quando a persona é criada, ou ficam vazias se não tiverem valor nesse momento.

A **Rendered preview** (prévia renderizada), no fim, mostra a persona montada a partir de respostas de exemplo e lista as perguntas feitas, na ordem.

## Responder às perguntas como jogador

1. Comece um novo chat de Roleplay. Na etapa **Persona & Characters** (persona e personagens), os cards com onboarding mostram um pequeno ícone de pessoa com um sinal de mais na lista de personagens.
2. Adicione o personagem. Para obter uma nova persona a partir dele, selecione a linha **Create your persona** no topo de **Your Persona** (a sua persona). Ela mostra o nome do card a que pertence. Qualquer outra escolha (ou **None**) pula a persona e mantém a sua.
3. Clique em **Next** (avançar). A janela de perguntas abre sempre que algum card do chat tiver perguntas do personagem, quer você crie uma persona, quer não.
4. Responda às perguntas. As **Character questions** (perguntas do personagem) vêm primeiro, com uma seção por card, e depois **About you** quando uma persona está sendo criada. As perguntas de acompanhamento aparecem assim que as suas respostas as tornam relevantes.
5. Clique em **Review persona** (revisar persona) para ver o nome e os campos que as suas respostas produzem, exatamente como serão salvos. As partes que as suas respostas preencheram ficam destacadas. A prévia não grava nada; só **Create persona** (criar persona) grava.
6. Clique em **Create persona** ou, se você não estiver criando uma, em **Save answers** (salvar respostas). As respostas do personagem são salvas no chat, e o assistente de configuração continua.

As perguntas do onboarding são feitas no assistente de configuração de novo chat de Roleplay. Quick Start, a configuração do Conversation e começar um chat direto de um card de personagem ainda não as fazem. Um chat iniciado assim ainda preenche a primeira opção de cada pergunta, então `{{relationshipToUser}}` é resolvido em vez de mostrar a tag. Responder no assistente substitui esse valor padrão, apenas para aquele chat.

Os dois caminhos também funcionam depois da configuração, em **Chat Settings** (configurações do chat):

- O seletor **Persona** de um chat de Roleplay lista **Create your persona** para cada card do chat que oferece essa opção. Use quando tiver pulado o assistente ou quiser uma persona nova mais tarde.
- O marcador de onboarding ao lado de um personagem em **Characters** (personagens) reabre só as perguntas do personagem daquele card. Ele abre com as respostas que o chat já guarda, então salvar uma mudança mantém as outras como estavam; salvar de novo também restaura uma resposta que você excluiu de Chat Variables (variáveis do chat). As respostas dos outros cards não são alteradas – exceto um nome que dois cards compartilham, que é um único valor, então os dois cards leem a nova resposta.

## Compartilhar cards com onboarding

O onboarding fica guardado com o card. As exportações **Marinara Native** e **Compatible PNG Card** mantêm o recurso, então um jogador que importa o card também recebe as perguntas. A exportação **Compatible JSON** deixa o onboarding de fora. Um card importado com mais de 100 perguntas mantém as 100 primeiras. Veja [Importar e exportar cards de personagem](import-export.md).

## Guias relacionados

- [Criando e editando personagens](creating-and-editing-characters.md)
- [Personas do usuário: criar e editar](personas.md)
- [Escolhendo a persona de um chat](choosing-your-persona.md)
- [Macros de prompt](../prompts/macros.md)
- [Importar e exportar cards de personagem](import-export.md)
