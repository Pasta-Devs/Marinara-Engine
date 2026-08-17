# Macros de prompt

Este guia explica as macros de prompt no Marinara Engine. A macro é uma etiqueta curta, escrita como `{{tag}}`, que Marinara troca por um valor atual. Esse valor entra no momento em que o prompt (o texto que Marinara envia para a IA) é montado: o seu nome ou a data de hoje, por exemplo. Aqui você vê todas as macros embutidas, onde pode digitá-las e quais erros evitar.

## O que são as macros e onde funcionam

A macro é um texto literal entre chaves duplas, como `{{user}}` ou `{{char}}`. Ao montar o texto que envia para a IA, Marinara procura essas etiquetas e troca cada uma pelo valor do momento. Não existe um botão para ligar ou desligar as macros. Todo campo compatível com elas sempre as resolve.

Nas macros embutidas, maiúsculas e minúsculas não fazem diferença no nome. Ou seja, `{{user}}` e `{{USER}}` funcionam igual.

As macros podem ser digitadas em vários lugares do aplicativo:

- Campos de personagem no **Character Editor** (editor de personagem): Description, Personality, Backstory, Appearance, Scenario, Example Dialogue, System Prompt, Post-History Instructions e o campo **Depth Prompt**.
- Campos de persona no **Persona Editor** (editor de persona), que são os mesmos campos do card.
- Campos Description e Content das entradas de lorebook.
- Seções do preset de prompt no **Preset Editor** (editor de presets).
- Campos Find, Replace e Trim dos scripts de regex.
- Modelos de prompt dos agentes.
- A caixa de mensagem do chat. Digite `{{roll:1d20}}` em uma mensagem e a macro é resolvida antes do envio.

O valor de uma macro pode conter outra macro, e Marinara resolve essa segunda também.

## Antes de começar

Você não precisa configurar nada. As macros embutidas funcionam na hora, sem chave de API e sem nenhuma conexão extra. A chave de API é o código secreto que permite ao Marinara conversar com um provedor de IA, mas as macros rodam dentro do Marinara, por conta própria.

Dois recursos de macro dependem de outras partes do aplicativo:

- As variáveis de preset (o coringa `{{NAME}}`) precisam de um preset de prompt que as defina. Veja [Variáveis de preset](preset-variables.md).
- A macro de agente `{{agent::TYPE}}` só mostra texto depois que o agente correspondente roda e produz uma saída.

## Macros de identidade, personagem e persona

Estas macros trazem os nomes e os campos do card de quem fala e do personagem que responde. O usuário é você (ou a persona ativa). O personagem é o bot que está respondendo.

| Macro | Resultado |
| --- | --- |
| `{{user}}` / `{{userName}}` | O nome de exibição atual (ou o nome da persona). Sem persona definida, o padrão é `User`. |
| `{{userNamePhonetic}}` | O nome Phonetic da persona, ou `{{user}}` quando esse campo está vazio. |
| `{{char}}` / `{{charName}}` | O nome do personagem atual. O padrão é `Character`. |
| `{{<21-character-card-ID>}}` | Sintaxe de marcador para o nome de outro card de personagem. Troque o texto entre colchetes angulares pelo ID exato de 21 caracteres desse card. |
| `{{persona-21-character-card-ID}}` | Sintaxe de marcador para o nome de outra persona. Troque o texto depois de `persona-` pelo ID exato de 21 caracteres do card para incluir o contexto dele. |
| `{{charNamePhonetic}}` | O nome Phonetic do personagem, ou `{{char}}` quando esse campo está vazio. |
| `{{characters}}` | Todos os personagens do chat, separados por vírgulas. |
| `{{group}}` | Todos os outros personagens ativos do chat em grupo, sem contar quem está respondendo. A persona não faz parte dessa lista de personagens. |
| `{{persona}}` | Os campos Description, Personality, Backstory, Appearance e Scenario da persona, unidos por quebras de linha. |
| `{{personaDescription}}` | O campo Description da persona. |
| `{{personaPersonality}}` | O campo Personality da persona. |
| `{{personaBackstory}}` | O campo Backstory da persona. |
| `{{personaAppearance}}` | O campo Appearance da persona. |
| `{{personaScenario}}` | O campo Scenario da persona. |

As macros de campo do personagem leem o card do personagem atual:

| Macro | Campo do card de personagem |
| --- | --- |
| `{{description}}` | Description |
| `{{personality}}` | Personality |
| `{{backstory}}` | Backstory |
| `{{appearance}}` | Appearance |
| `{{scenario}}` | Scenario |
| `{{example}}` | Example Dialogue |
| `{{charSysInfo}}` | System Prompt |
| `{{charPostHistory}}` | Post-History Instructions |

Em um chat com um só personagem, essas macros apontam para ele. No chat em grupo, elas apontam para o primeiro personagem por padrão. Para repetir um texto para cada personagem, coloque-o dentro de um bloco de grupo entre colchetes. Os blocos de grupo estão explicados em [Prompts condicionais](conditional-prompts.md).

A macro `{{group}}` acompanha o personagem que está respondendo no momento, inclusive durante gerações individuais dentro do grupo. Por exemplo: se Pantalone responde em um grupo de Roleplay formado por Powers That Be, Maukie e Pantalone, `{{group}}` resulta em `Powers That Be, Maukie`. Um card de personagem continua nessa lista mesmo que o nome dele coincida com `{{user}}`.

O campo Phonetic tem duas funções. Ele define como o nome é pronunciado na conversão de texto em voz. E também alimenta as macros `{{charNamePhonetic}}` e `{{userNamePhonetic}}`. O campo aparece tanto no **Character Editor** quanto no **Persona Editor**.

Para citar um personagem que não está no chat atual, copie o ID do card dele e coloque esse ID direto entre chaves duplas, como `{{V1StGXR8_Z5jdHi6B-myT}}`. Marinara troca a macro pelo nome do card e adiciona ao prompt de sistema o contexto de personagem do card citado. As saudações iniciais e os diálogos de exemplo desse card ficam de fora. Os lorebooks ativados que estão ligados a esse card continuam sujeitos às regras normais de palavras-chave, entradas **Constant**, filtros, probabilidade e orçamento de tokens.

Para citar uma persona inativa, acrescente `persona-` antes do ID copiado, como em `{{persona-P1StGXR8_Z5jdHi6B-myT}}`. Marinara troca a macro pelo nome da persona e adiciona os campos Description, Personality, Appearance, Backstory e Scenario dela aos ID Macro Cards. Os lorebooks vinculados continuam seguindo as regras normais de ativação.

## Macros do Conversation Mode

Estas quatro macros só funcionam no Conversation Mode. Em qualquer outro modo, elas sempre resultam em nada, mesmo quando o mesmo texto de card ou de preset é usado em vários modos.

| Macro | Resultado |
| --- | --- |
| `{{convo_display}}` | O campo **Convo Display Name** do personagem, ou o nome do card quando ele está vazio. |
| `{{char_about}}` | O texto **About Me** atual do personagem (a substituição feita naquele chat, se houver; caso contrário, o padrão do card). |
| `{{persona_about}}` | O texto About Me atual da persona. |
| `{{convo_behavior}}` | O texto **Convo Behavior** do personagem, mas só quando a opção de inserção está configurada para colocá-lo nesta macro. |

Esses campos ficam na aba **Convo** do **Character Editor** e do **Persona Editor**. A configuração completa está em [Perfis do Conversation Mode](../conversation/profiles.md).

## Macros de posicionamento no Conversation Mode

O Conversation Mode insere vários blocos no prompt automaticamente. Com estas macros, um preset **move** um bloco para o ponto onde você colocar a macro. Ao usar uma delas, Marinara renderiza o bloco ali e **pula** a inserção automática, então o conteúdo nunca aparece duplicado. Cada macro tem um ou mais apelidos, e todos se comportam do mesmo jeito.

| Macro (e apelidos) | Insere |
| --- | --- |
| `{{context}}`, `{{status}}` | O bloco de contexto / status da conversa. |
| `{{commands}}`, `{{commandList}}` | O lembrete com os comandos disponíveis. |
| `{{reactRules}}`, `{{emojiReact}}` | As regras de **reação** com emoji personalizado. |
| `{{replyRules}}` | As regras de **resposta** com emoji personalizado e figurinha. |
| `{{memories}}`, `{{memoryRecall}}` | O bloco de memória recuperada. |
| `{{lorebook}}`, `{{lore}}` | As inserções de lorebook. |

Isso vale apenas no Conversation Mode. Em uma conversa com um só personagem, posicionar as biografias dos participantes por conta própria, com `{{char_about}}` / `{{persona_about}}` (veja acima), funciona da mesma forma: Marinara pula o bloco automático de "about me" dos participantes, e as biografias não entram duas vezes. As conversas em grupo mantêm o bloco automático, porque cada uma dessas macros no singular cobre só um participante e não pode esconder a biografia dos demais.

## Macros de contexto

Estas macros descrevem o chat atual e a requisição atual.

| Macro | Resultado |
| --- | --- |
| `{{input}}` | A mensagem mais recente do usuário disponível para o prompt. |
| `{{model}}` | O nome do modelo atual, quando há um selecionado. |
| `{{chatId}}` | O ID do chat atual. |
| `{{lastGenerationType}}` | Uma etiqueta que indica por que esta resposta está sendo gerada. |
| `{{idle_duration}}` | Quanto tempo passou desde a última atividade no chat, em texto como `8 minutes` ou `1 hour 5 minutes`. |
| `{{gameStoryboardKeyframeCount}}` | O alvo atual de **Keyframes per Turn** do Game Mode, de 1 a 6. O padrão é `3`. |
| `{{agent::TYPE}}` | A saída salva de um agente do tipo indicado. |

O valor de `{{lastGenerationType}}` é uma etiqueta simples. Entre os valores que aparecem no aplicativo estão `normal`, `continue`, `regenerate`, `impersonate`, `guided`, `autonomous`, `turn_game`, `preview`, `game_setup`, `lorebook_scan` e `retry_agents`. Essa lista pode crescer, então trate os valores como exemplos, não como um conjunto fechado.

A macro `{{gameStoryboardKeyframeCount}}` é fornecida aos prompts de GM do Game Mode, incluindo o **Storyboard Game Prompt** embutido. É um alvo narrativo, não uma exigência de ter exatamente aquela quantidade de parágrafos. O planejador do storyboard continua devolvendo menos tomadas quando o turno não tem momentos visuais distintos suficientes.

A macro `{{agent::TYPE}}` insere a saída salva de um agente (um ajudante que roda em segundo plano e preenche coisas como o tracker de cena). O jeito mais fácil de adicioná-la é pelo **Preset Editor**: clique em **Add Section**, abra o grupo **Agent Sections** e escolha um agente. Marinara cria uma seção que já contém a etiqueta `{{agent::TYPE}}` certa. Esta macro é resolvida por último, então o texto do agente não consegue inserir mais macros no prompt.

## Macros de Outlet de lorebook

A macro `{{outlet::name}}` insere o conteúdo das entradas de lorebook cujo campo **Position** está em **Outlet** e cujo campo **Outlet name** é exatamente igual a `name`. Nos nomes de outlet, maiúsculas e minúsculas fazem diferença. Por exemplo, `{{outlet::character_rules}}` não corresponde a um outlet chamado `Character_Rules`.

As entradas de outlet continuam usando a ativação normal do lorebook. Palavras-chave, modo Constant, probabilidade, filtros, momento de acionar, limites de entrada e orçamentos de tokens decidem se uma entrada está ativa na geração atual. As entradas ativas com o mesmo nome de outlet são unidas na ordem do campo **Order**, separadas por quebras de linha. Elas entram só na macro, e não também em uma posição normal de lorebook.

Use as macros de outlet em seções de prompt nos modos Conversation, Roleplay ou Game. A macro funciona mesmo quando aparece antes do marcador de lorebook do preset, e o preset não precisa de um marcador de lorebook quando usa apenas entradas de outlet. Um outlet desconhecido ou inativo resulta em nada. Uma entrada de outlet não expande outra macro de outlet, então não há recursão entre outlets.

## Macros de tempo

Todas as macros de tempo leem um mesmo instante compartilhado a cada resolução, então elas sempre concordam entre si. O fuso horário vem do navegador.

| Macro | Resultado |
| --- | --- |
| `{{date}}` | A data atual, no formato `YYYY-MM-DD`. |
| `{{time}}` | A hora atual, no formato `HH:MM`, em relógio de 24 horas. |
| `{{datetime}}` / `{{isotime}}` | Um carimbo de data e hora completo, com o deslocamento do fuso horário. Os dois nomes significam a mesma coisa. |
| `{{weekday}}` | O nome do dia da semana, como `Monday`. |
| `{{timezone}}` | O nome do fuso horário, como `Europe/Warsaw`. |

## Macros de sorteio e dados

Estas macros trazem acaso para os prompts. Use a macro de sorteio (`{{random}}`) para números e escolhas, e a macro de rolagem (`{{roll}}`) para dados.

| Macro | Comportamento |
| --- | --- |
| `{{random}}` | Um número inteiro sorteado de 0 a 100. |
| `{{random:X:Y}}` | Um número inteiro sorteado entre X e Y, incluindo os dois. |
| `{{random::A::B::C}}` | Sorteia uma das opções e resolve as macros apenas dentro da opção escolhida. |
| `{{random::A@2::B@0.5}}` | Um sorteio com peso. Veja as regras de peso abaixo. |
| `{{roll:XdY}}` | O total de uma rolagem de dados. Por exemplo, `{{roll:2d6}}` rola dois dados de seis faces e soma os resultados. |

Um sorteio simples que você pode copiar:

```text
{{random::The door creaks open.::A bell rings.::Someone laughs nearby.}}
```

### Escolhas com peso

Coloque um `@número` no fim de uma opção para definir a chance dela. O número é um peso relativo. Quanto maior, mais provável.

```text
{{random::Common event@1::Rare event@0.25}}
```

Nesse exemplo o peso total é 1,25, então as chances ficam assim:

| Opção | Peso | Chance |
| --- | --- | --- |
| Common event | 1 | 80% |
| Rare event | 0.25 | 20% |

Regras de peso:

- Uma opção sem peso conta como 1.
- Pesos decimais são aceitos, como 0.5 ou 0.01.
- O peso 0 mantém a opção na lista, mas ela nunca é sorteada.
- Se todas as opções tiverem peso 0, a macro resulta em nada.
- Só um `@número` no fim conta como peso. Um `@` em outro lugar, como em um endereço de e-mail, fica intacto.

## Variáveis dinâmicas

Com as variáveis, uma parte do prompt guarda um valor e outra parte, mais adiante, lê esse valor.

| Macro | Comportamento |
| --- | --- |
| `{{setvar::name::value}}` | Guarda um valor e não deixa nada no texto. |
| `{{getvar::name}}` | Lê um valor guardado (nada, se ele nunca foi definido). |
| `{{addvar::name::value}}` | Soma quando os dois valores são numéricos; caso contrário, acrescenta o texto. |
| `{{addnumvar::name::value}}` | Extensão do Marinara que sempre faz uma soma numérica. Valores ausentes ou inválidos contam como 0, e o estouro é ignorado. |
| `{{incvar::name}}` | Soma 1 a uma variável numérica e insere o novo valor. |
| `{{decvar::name}}` | Subtrai 1 de uma variável numérica e insere o novo valor. |

As variáveis são resolvidas da esquerda para a direita durante a montagem do prompt e salvas no chat atual. Um valor definido cedo, por exemplo em uma entrada de lorebook que vem antes, pode ser lido depois no mesmo prompt. Assim como as variáveis locais do SillyTavern, ele permanece nos turnos seguintes e depois de reiniciar, sem passar para outros chats.

Qualquer `{{NAME}}` que não seja uma macro embutida é tratado como variável de preset e procurado pelo nome. Se não existir uma variável com esse nome, a etiqueta fica no texto exatamente como você digitou. Veja em [Variáveis de preset](preset-variables.md) como definir essas variáveis.

## Macros de formatação

Estas macros dão forma ao texto ao redor delas.

| Macro | Comportamento |
| --- | --- |
| `{{newline}}` / `{{\n}}` | Insere uma quebra de linha. |
| `{{trim}}` | Some do texto e corta os espaços em volta daquele ponto. |
| `{{trimStart}}` | Corta os espaços no início do texto ao redor. |
| `{{trimEnd}}` | Corta os espaços no fim do texto ao redor. |
| `{{uppercase}}...{{/uppercase}}` | Deixa o texto envolvido em MAIÚSCULAS. |
| `{{lowercase}}...{{/lowercase}}` | Deixa o texto envolvido em minúsculas. |
| `{{noop}}` | Some da saída. Serve como marcador inofensivo enquanto você edita. |
| `{{// comment}}` | Uma nota do autor que some da saída. |
| `{{banned "text"}}` | Some da saída. Não filtra nem bloqueia nada. |

## Como mostrar chaves duplas literais

Não existe caractere de escape para macros. Se você quiser que as chaves duplas fiquem no texto, use um nome que Marinara não conheça. Qualquer `{{name}}` desconhecido fica exatamente como foi digitado, desde que nenhuma variável de preset tenha esse mesmo nome. Se precisar de uma anotação particular, que nunca chegue à IA, use `{{// like this}}`.

## A referência de macros e o comando /macros

Todo campo compatível com macros tem dois botõezinhos no canto:

- O botão **Expand editor** (expandir o editor) abre uma janela de edição maior para aquele campo.
- O botão **Macro reference** (referência de macros) abre uma janela chamada **Macro reference**, que lista todas as macros embutidas por categoria, cada uma com a sintaxe exata. Essa lista é gerada a partir da mesma fonte que o motor usa, então está sempre correta.

Você também pode digitar `/macros` na caixa do chat (a forma curta `/macro` também funciona). O comando imprime a lista completa de macros no próprio chat, como lembrete rápido.

Os blocos condicionais combinam comparações com `||` (OU), `&&` (E) e parênteses. As listas de igualdade aceitam a forma compacta `{{#if character == "Maukie" || "Pantalone"}}`. Veja em [Prompts condicionais](conditional-prompts.md) a precedência, exemplos de chat em grupo e a lista completa de operadores.

## Erros comuns

- Não escreva variáveis dentro de um bloco `{{random::...}}`. Um `{{setvar}}` dentro de uma opção do sorteio roda para todas as opções antes da escolha, e não só para a opção sorteada.
- Não use uma variável local como se fosse global. Os valores definidos com `{{setvar}}` só persistem no chat atual; cada outro chat tem o próprio valor.
- `{{prompt}}` não é uma macro. Se a mensagem inteira for `{{prompt}}`, Marinara abre o visualizador **Peek Prompt** em vez de enviá-la. Veja [Peek Prompt](../chats/peek-prompt.md).
- As Custom Tools não usam texto de `{{macro}}`. Não cole `{{roll:1d20}}` em um campo de ferramenta esperando que a macro seja resolvida.
- O modelo de prompt de **Impersonate** aceita só alguns marcadores, não a lista completa de macros. Os nomes também são diferentes, então uma macro que funciona em um card pode não funcionar ali.
- Saídas de macro muito grandes ou com muitos níveis de aninhamento são cortadas em silêncio. Não aparece nenhum erro, então mantenha as expansões em um tamanho razoável.

## Guias relacionados

- [Prompts condicionais](conditional-prompts.md)
- [Variáveis de preset](preset-variables.md)
- [Editor de presets e gerenciador de prompts](presets.md)
- [Peek Prompt](../chats/peek-prompt.md)
- [Criando e editando personagens](../characters/creating-and-editing-characters.md)
- [Perfis do Conversation Mode](../conversation/profiles.md)
