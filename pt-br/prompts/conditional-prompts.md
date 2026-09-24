# Prompts condicionais ({{#if}})

Este guia explica como usar os blocos `{{#if}}` no Marinara Engine. Um prompt é o texto que Marinara envia para a IA, e um bloco condicional inclui um trecho desse texto só quando um valor combina com a regra que você definiu. Os condicionais fazem parte do sistema de macros, então funcionam em todo lugar onde as macros funcionam: cards de personagem, personas, entradas de lorebook e presets de prompt.

## Para que servem os prompts condicionais

Uma macro é um marcador escrito entre `{{double-brace}}` que Marinara Engine troca por um valor real na hora de montar o prompt. O bloco condicional vai um passo além. Ele analisa um valor, mantém um trecho de texto e descarta o resto.

Você escreve a condição, o texto usado quando ela é verdadeira e, se quiser, o texto usado quando ela é falsa. Marinara lê a condição toda vez que monta um prompt. Com isso, o mesmo card ou preset se comporta de um jeito diferente para cada personagem, persona ou chat.

Um uso comum são instruções específicas de personagem dentro de um único preset compartilhado. Outro uso comum é incluir um campo apenas quando ele tem conteúdo, para não mandar um rótulo vazio para o modelo.

## A sintaxe básica

O bloco condicional começa com `{{#if condition}}` e termina com `{{/if}}`. Tudo que estiver entre os dois é o texto usado quando a condição é verdadeira.

```
{{#if condition}}
Text used when the condition is true.
{{/if}}
```

Para o caso falso, acrescente um ramo `{{else}}`:

```
{{#if condition}}
Text used when true.
{{else}}
Text used when false.
{{/if}}
```

Outra opção: encadear condições extras com `{{else if}}`. Marinara analisa cada ramo em ordem, de cima para baixo. Ele mantém o primeiro ramo cuja condição é verdadeira, resolve as macros dentro dele e descarta todos os outros. Se nenhuma condição for verdadeira e não houver `{{else}}`, o bloco inteiro não gera texto nenhum.

```
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

O bloco pode ocupar várias linhas, como nos exemplos acima, ou ficar em uma linha só. Você também pode aninhar um condicional dentro do ramo de outro condicional maior.

## Operadores disponíveis

Em geral, a condição tem um valor à esquerda, um operador e um valor à direita, como em `char == "Alice"`. A tabela abaixo lista todos os operadores disponíveis. Cada operador aparece em estilo de código.

| Operador | Significado |
| --- | --- |
| `==`, `=`, `is` | Igual. |
| `!=`, `is not` | Diferente. |
| `>` | Maior que (só com números). |
| `<` | Menor que (só com números). |
| `>=` | Maior ou igual (só com números). |
| `<=` | Menor ou igual (só com números). |
| `contains`, `includes` | O valor da esquerda contém o valor da direita como texto. |
| `not contains`, `not includes` | O valor da esquerda não contém o valor da direita. |

Algumas regras controlam como a comparação acontece:

1. Com `==`, `=`, `is`, `!=` e `is not`, se os dois lados parecem números, Marinara compara os dois como números. Ou seja, `5` é igual a `5.0`. Caso contrário, a comparação é feita como texto, sem diferenciar maiúsculas de minúsculas. Ou seja, `Mari` é igual a `mari`.
2. Com `>`, `<`, `>=` e `<=`, os dois lados precisam ser números. Se um dos lados não for número, a condição é falsa.
3. Com `contains`, `includes`, `not contains` e `not includes`, a comparação não diferencia maiúsculas de minúsculas. Ou seja, `contains "dr"` combina com o texto `Dr Smith`.

## Combinar condições com OR e AND

Use `||` quando qualquer uma das condições puder combinar. Use `&&` quando todas as condições precisarem combinar.

```
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared Maukie and Pantalone instructions.
{{/if}}

{{#if characters contains "Maukie" && characters contains "Pantalone"}}
Both characters are present in this chat.
{{/if}}
```

O operador `&&` é avaliado antes do `||`. Use parênteses quando quiser definir a ordem de forma explícita:

```
{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

Quando houver várias opções de igualdade para o mesmo valor, o lado esquerdo repetido pode ser omitido depois do `||`:

```
{{#if character == "Maukie" || "Pantalone"}}
Use the shared instructions.
{{/if}}
```

Essa forma abreviada significa `character == "Maukie" || character == "Pantalone"`. Ela vale para os operadores de igualdade `==`, `=` e `is`. Já dos dois lados do `&&`, escreva condições completas, porque um valor raramente é igual a duas opções diferentes ao mesmo tempo.

### Verificação de valor preenchido (sem operador)

Se você escrever uma condição sem operador, Marinara faz uma verificação de valor preenchido. A pergunta é simples: esse valor tem conteúdo de verdade?

```
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

A verificação de valor preenchido é verdadeira quando o valor não está vazio e não é uma destas palavras: `false`, `0`, `no`, `off`, `null` ou `undefined`. Essa comparação de palavras não diferencia maiúsculas de minúsculas. Use a verificação de valor preenchido quando quiser incluir o texto apenas se o campo estiver preenchido.

### O que pode ser comparado

O lado esquerdo ou direito da condição aceita qualquer um destes elementos:

1. Uma palavra-chave de campo ou de identidade, como `char`, `user`, `group`, `persona`, `description`, `personality`, `scenario`, `input` ou `model`. Elas leem os mesmos valores das macros correspondentes. A palavra `group` lista os outros personagens ativos do chat, sem contar quem está respondendo no momento.
2. Um valor literal entre aspas, como `"Alice"`.
3. O nome de uma variável de preset, como `length`. A variável de preset é um valor com nome que você define em um preset de prompt. Veja [Variáveis de preset](preset-variables.md).
4. Uma consulta explícita de variável, escrita como `var:name` ou `var.name`.
5. Outra macro, cujo valor é resolvido primeiro e só depois comparado.
6. Perguntas e opções Decision, como `decision:"..."` e `decision_choice:"..."`. Elas pedem um julgamento rápido ao Decision model selecionado antes de montar o prompt. Veja [Perguntar ao modelo de decisão](#asking-the-decision-model).

Se você escrever uma palavra solta que não seja palavra-chave, Marinara a trata como nome de variável. Quando não existe variável com esse nome, a própria palavra vira texto simples. Colocar os valores literais entre aspas evita essa confusão, então use aspas sempre que tiver dúvida.

## Regras de aspas

Ao comparar com um texto fixo, coloque esse texto entre aspas. Assim Marinara o trata como um literal exato, e não como palavra-chave ou variável.

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{/if}}
```

Use aspas duplas retas ou aspas simples retas. Marinara também aceita aspas curvas (tipográficas), mas as aspas retas são mais seguras e combinam com todos os exemplos do aplicativo. Dentro de um valor entre aspas, escape uma aspa com barra invertida e escreva `\n` para quebrar a linha.

Sempre coloque entre aspas um literal que tenha espaço, como `"Dr Smith"`. Um valor de várias palavras sem aspas é lido como um único nome de variável, o que quase nunca é o que você quer.

## Blocos de grupo para vários personagens

Em um chat em grupo com dois ou mais personagens, o bloco de grupo repete o mesmo texto uma vez para cada personagem. Assim você escreve um único bloco que descreve todos os personagens da cena.

Para criar um bloco de grupo, coloque um `[` sozinho em uma linha, depois o texto e depois um `]` sozinho em outra linha. O bloco precisa conter uma macro de personagem, como `{{char}}` ou `{{description}}`, ou uma condição baseada em personagem, como `{{#if char == "Alice"}}`. Marinara então repete o bloco uma vez por personagem e resolve as macros de personagem para cada um deles.

```
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

Em um chat em grupo com Alice e Bob, o bloco roda duas vezes. Na primeira passagem, entra o nome de Alice e o ramo dela é escolhido. Na segunda, entra o nome de Bob e o ramo dele é escolhido. Fora de um bloco de grupo, a macro de personagem se resolve apenas para o personagem atual ou principal.

Os blocos de grupo só se expandem em um chat com dois ou mais personagens. Em um chat individual, as linhas com `[` e `]` continuam como texto comum.

## Exemplos completos (antes e depois)

Veja três exemplos completos, com o resultado que chega ao modelo.

Tom específico de personagem dentro de um preset compartilhado:

```
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

Para um personagem chamado `Dottore`, o modelo recebe `Speak in a cold, clinical tone.` Para todos os outros personagens, ele recebe `Speak warmly and casually.`

Incluir um campo somente quando ele está preenchido:

```
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

Se o personagem tem um campo **Backstory** (história de origem) preenchido, o modelo recebe essa linha com o texto correspondente. Se o campo **Backstory** estiver vazio, o bloco inteiro não gera texto nenhum, então nenhum rótulo vazio é enviado.

Combinar parte do nome do usuário:

```
{{#if user contains "Dr"}}
Address the user as Doctor.
{{/if}}
```

Se o nome da persona contém `Dr`, o modelo recebe a instrução de chamar você de Doutor. Se não contém, o bloco não gera texto nenhum.

<a id="asking-the-decision-model"></a>

## Consultar o Decision model

Uma condição também pode perguntar ao **Decision model** (modelo de decisão) o que acontece no chat. É o modelo escolhido em **Decision model** no painel Connections: o modelo local que você já roda, uma conexão Decision hospedada ou um modelo de decisão instalado. Ele lê as últimas mensagens e uma declaração escrita por você e informa se ela é verdadeira. Nunca escreve no chat. [Modelos de decisão](../connections/decision-models.md) explica o que é e como escolher um.

Isso permite que um preset, card, entrada de lorebook ou prompt de agente envie instruções apenas nos turnos pertinentes, em vez de enviar "se X acontecer, faça Y" em todo turno. Para decidir se uma entrada inteira de lorebook ativa, em vez de cortar seu texto, use o campo [Decision](../lorebooks/entries.md#decision-activation). Algumas ideias:

- **Mudanças de cena.** Descrever um novo lugar ou salto no tempo apenas quando a cena realmente mudou.
- **Tipos de cena.** Carregar regras de ritmo de combate, intimidade ou tensão apenas enquanto esse tipo de cena acontece.
- **Responder à pergunta primeiro.** `{{#if decision:"In the latest message, {{user}} asks a direct question"}}Answer it before anything else.{{/if}}`
- **Humores nos cards.** Um card pode conter comportamentos para constrangimento ou raiva que só aparecem quando as mensagens recentes os mostram.
- **Controles de ritmo.** Um preset de desenvolvimento lento pode segurar instruções de intensificação até a relação avançar visivelmente.
- **Cenas em grupo.** Em um bloco de grupo, `{{#if decision:"{{char}} is addressed in the latest message"}}` manda apenas a seção do personagem abordado responder diretamente.

### Sim ou não: `decision:`

```
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

A condição é verdadeira quando o Decision model considera a declaração verdadeira. Funciona com tudo neste guia: `{{else}}`, `{{else if}}`, `&&`, `||`, parênteses, aninhamento e blocos de grupo.

```
{{#if char == "Dottore" && decision:"In the latest message, {{user}} says something that contradicts what they said earlier"}}
Dottore notices the inconsistency and files it away.
{{/if}}
```

As macros da declaração são preenchidas primeiro; assim, `{{user}}` e `{{char}}` funcionam. Em um bloco de grupo, uma declaração com `{{char}}` é avaliada uma vez por personagem.

### Uma entre várias respostas: `decision_choice:`

`decision_choice:` pede ao Decision model que escolha uma opção. As opções são os valores com que você o compara em qualquer parte do prompt:

```
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

Aqui o modelo escolhe entre "angry", "sad" e "none of these". A forma curta também funciona: `decision_choice:"The weather in the latest message" == "rain" || "snow"` oferece as duas opções. Escreva a declaração como um tema, como "Kaelen's mood in the latest message", e as opções como respostas curtas.

<a id="sticky-and-cooldown"></a>

### Sticky e cooldown

Uma declaração pode manter sua resposta por alguns turnos em vez de ser avaliada em cada um. Escreva `sticky:` e `cooldown:` depois da declaração:

```
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- **sticky:N.** Depois de um sim, a declaração continua sim nos próximos N turnos sem ser avaliada; o conteúdo controlado por ela permanece no prompt.
- **cooldown:N.** Começa ao terminar sticky, ou logo depois do sim se não houver sticky. Por N turnos, a declaração vale não e não é avaliada. Depois volta a ser perguntada.
- Um turno é cada mensagem nova que o Decision model lê. Regenerar ou mudar o swipe da mesma mensagem é o mesmo turno; refazer uma resposta nunca reduz um temporizador.
- Enquanto sticky ou cooldown retém uma declaração, ela não é avaliada nem conta em **Decision statements per turn** (declarações de decisão por turno), deixando sua vaga para outra.
- Para `decision_choice:`, sticky mantém a opção escolhida e cooldown faz toda comparação valer não. Escolher nenhuma opção não inicia nada.
- Uma declaração escrita em vários lugares usa os maiores valores de sticky e cooldown informados.
- Peek Prompt mostra a resposta retida e nunca avança um temporizador.

Juntos, servem para algo que deve aparecer uma vez e depois esperar: uma transição de cena, lembrete pontual ou humor que dure alguns turnos. Para uma entrada ativada pelo campo **Decision**, use seus próprios **Sticky** e **Cooldown**: uma entrada sticky permanece sem reavaliar a declaração, e uma entrada em cooldown não é avaliada.

<a id="checking-every-few-turns"></a>

### Verificar a cada poucos turnos

Algumas declarações não precisam ser avaliadas em todo turno. Escreva `every:` depois para perguntar apenas a cada N turnos:

```
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- Ela é avaliada no primeiro turno em que é alcançada, depois 3 turnos mais tarde e assim por diante.
- Mudar o número tem efeito imediato: a próxima verificação conta a partir do último turno em que foi avaliada.
- Entre verificações, vale não, não é avaliada e não conta em **Decision statements per turn**.
- Turnos contam como em sticky e cooldown; regenerar ou mudar swipe não avança a programação. A reutilização de respostas segue as [regras do cache de respostas](#answer-reuse).
- Sticky e cooldown continuam retendo a resposta; `every:` só decide quando avaliar uma declaração que eles não retêm.
- Uma declaração escrita em vários lugares usa o menor `every:` informado.

<a id="priority"></a>

### Prioridade

Quando um plano de prompt tem mais declarações que o orçamento de **Decision statements per turn**, `priority:` decide quais são avaliadas. O orçamento vale em [várias etapas](#statement-allowance):

```
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- Declarações `priority:high` são avaliadas primeiro e `priority:low` por último. Sem prioridade, a declaração tem prioridade média.
- Na mesma prioridade, continua valendo a ordem de aparição no prompt.
- Acima do limite, as de menor prioridade são descartadas primeiro: valem não e Peek Prompt as lista.
- Uma declaração em vários lugares usa a maior prioridade informada.
- As declarações do próprio prompt (preset, cards, persona e notas do autor) são planejadas primeiro. As do texto de entradas de lorebook são planejadas quando a análise identifica as entradas ativas, com as vagas restantes; nunca tiram a vaga das do prompt, qualquer que seja sua prioridade.

Todos os modificadores podem ser combinados em qualquer ordem: `decision:"..." priority:high sticky:3 cooldown:5 every:2`.

### Sem resposta significa não

Uma condição de decisão é **falsa** sempre que não há resposta: nenhum Decision model foi definido, o modelo não respondeu a tempo ou falhou. Para `decision_choice:`, toda comparação é falsa. Assim, um usuário sem Decision model recebe o ramo `{{else}}` ou nada.

Planeje levando isso em conta:

- Use uma decisão para **acrescentar ou cortar orientações**, nunca para conteúdo indispensável à história. Um ramo perdido deve deixar a resposta um pouco menos adaptada, não quebrá-la.
- Dê a cada bloco um padrão sensato: nada ou um `{{else}}` adequado a qualquer turno.
- Não encadeie decisões de modo que uma resposta errada mude várias outras.
- Não condicione consentimento, avisos de conteúdo ou instruções de segurança a decisões. Mantenha-os sempre presentes.

Qualquer modelo pode errar. Escreva para "um modelo de decisão", nunca "exige Jev": um modelo de chat local também pode responder. A sintaxe é compartilhada, mas respostas e precisão variam entre modelos.

<a id="writing-statements"></a>

### Escrever declarações

Estas orientações vêm de testes com um modelo de chat local e Open-Jev 2B e 9B:

- **Declare um fato verdadeiro ou falso**, como uma linha de relatório. Não uma pergunta ("Did the scene change?") nem uma instrução ("If the scene changed, describe it"). Um modelo de chat local respondeu não à instrução todas as vezes; o bloco nunca rodava.
- **Diga "in the latest message"** para se referir a este turno. O modelo lê várias mensagens e respondeu sim a "Mira asks questions" porque uma anterior fazia uma pergunta.
- **Nomeie de quem se trata.** "He is angry" foi atribuído ao personagem errado.
- **Descreva algo visível no texto**, uma ação ou fala, não um humor que o modelo precisa interpretar ("The scene is intense") ou intenção oculta ("Mira is lying").
- Seja breve. Um simples "and" ou uma negação funcionaram bem nos testes; escreva o que soar natural.

Para testar a redação:

1. Selecione um modelo em **Decision model** e clique em **Test** (testar). Isso verifica a conexão com uma amostra fixa; não testa sua declaração nem lê o chat atual.
2. Adicione a declaração ao prompt e envie mensagens representativas: algumas em que ela deve ser verdadeira e outras em que deve ser falsa.
3. Use **Peek Prompt** para inspecionar o ramo enviado. Para ver a probabilidade e o resultado sim/não, ative os [logs de depuração](../CONFIGURATION.md#logging-levels).
4. Ajuste a redação e teste novamente. Use novas mensagens ou altere a declaração para testar um novo caso: respostas bem-sucedidas podem ser [reutilizadas](#answer-reuse). Abrir uma nova prévia de Peek Prompt não consulta o modelo.

O que os testes mostraram. Cada redação foi testada em quatro turnos de Roleplay rotulados (dois esperados como sim e dois como não) com Open-Jev 2B, Open-Jev 9B e um modelo local Gemma 4 E4B. É uma amostra pequena de uma cena, não uma avaliação geral de precisão nem um teste do Jev hospedado. A tabela registra observações dessa amostra, sem prometer o mesmo resultado com outro modelo ou chat.

| Escreva | Evite | O que aconteceu com a redação a evitar |
| --- | --- | --- |
| The latest message moves the scene to a new place. | Did the scene change? | A pergunta fez os turnos "não" do Open-Jev 2B ultrapassarem o limiar. O modelo local não foi afetado. |
| In the latest message, a character draws a weapon or attacks someone. | The scene is intense. | Os três chamaram uma discussão acalorada de "intensa". Com uma palavra vaga, o modelo decide o significado, não você. |
| In the latest message, Mira asks Kaelen a direct question. | Mira asks questions. | O modelo local e Open-Jev 9B disseram sim quando a última mensagem de Mira não perguntava nada, porque uma anterior perguntava. |
| Kaelen is angry in the latest message. | He is angry. | O modelo local interpretou "he" como o taverneiro com raiva. |
| In the latest message, Mira says something that contradicts what she said earlier. | Mira is lying. | Nenhum modelo identificou uma contradição como mentira com confiabilidade. |
| The latest message moves the scene to a new place. | If the scene changed, describe the new location in two sentences. | O modelo local respondeu não à instrução todas as vezes; o bloco nunca rodava. |
| Someone is injured in the latest message. | A fight starts and someone is injured and the city guards arrive. | Tratado corretamente. Separar ainda facilita reutilização e depuração. |
| In the latest message, the characters stay in the same place. | The characters did not leave the room. | Sem diferença. Escreva o que soar natural. |

As redações recomendadas acertaram 31 de 32 no Open-Jev 2B, 31 de 32 no Open-Jev 9B e 32 de 32 no modelo local. As redações a evitar acertaram 26, 25 e 24. Esses resultados de amostra pequena ilustram escolhas de redação; use seus casos para decidir qual modelo combina com seus chats.

<a id="limits-and-cost"></a>

### Limites e custo

<a id="statement-allowance"></a>

#### Orçamento de declarações

**Decision statements per turn**, em **Decision model**, tem padrão de 32. Apesar do nome, não é um limite global para todas as solicitações Decision ou gastos. Marinara aplica o orçamento em etapas:

1. Declarações do prompt principal são planejadas dentro do orçamento. As decisões de lorebook usam depois o que o plano deixa disponível.
2. Para agentes que rodam antes ou durante a resposta, Marinara combina as declarações do prompt principal e dos prompts desses agentes, usando novamente o orçamento configurado. Esta etapa não desconta o uso anterior do lorebook; por isso, o total pode superar a configuração.
3. Agentes de pós-processamento recebem um orçamento separado após a resposta. Suas declarações leem a resposta concluída.

As **perguntas de ativação** de agentes e **Smart response order** (ordem de resposta Smart) são separadas desse ajuste.

Só entram no plano declarações utilizáveis na etapa atual: seções e grupos de preset ativados, opções de variáveis selecionadas e conteúdo de entradas de lorebook ativas. Uma condição fixa pode excluir uma declaração: `{{#if char == "Dottore" && decision:"..."}}` não é avaliada quando o personagem é Mira. Variáveis podem mudar durante a montagem do prompt; uma condição de variável não exclui uma declaração antecipadamente.

Uma declaração retida por [sticky, cooldown](#sticky-and-cooldown) ou [`every:`](#checking-every-few-turns) não ocupa vaga. A [prioridade](#priority) escolhe quais cabem em um plano. A ativação de lorebooks usa o orçamento restante conforme considera as entradas. Declarações de fora valem não e Peek Prompt as lista.

#### Solicitações e tempo

Um turno pode fazer várias solicitações cobradas em uma conexão Decision hospedada. Declarações podem ser agrupadas, mas ativação de lorebooks, conteúdo recém-ativado, correspondências recursivas e fases de agentes podem exigir mais lotes. Perguntas de ativação são agrupadas por Scan Depth e fase; Smart faz sua própria solicitação. O orçamento de declarações não limita quantidade de solicitações nem dinheiro.

Um modelo de chat local acrescenta processamento em vez de cobranças hospedadas. Responde a `decision_choice:` com uma pergunta sim/não por opção; uma escolha pode exigir várias gerações.

Cada solicitação tem um [tempo limite](../connections/decision-models.md#time-limits): 1,5 segundo por padrão para uma conexão Decision, ou o orçamento do backend local. Várias solicitações podem somar uma espera maior. Um modelo local que precisa raciocinar antes se abstém antes da resposta, salvo se você ativar **Also gate agents that run before the reply** (avaliar também agentes que rodam antes da resposta).

<a id="answer-reuse"></a>

#### Reutilização de respostas

Respostas bem-sucedidas normalmente são reutilizadas para o mesmo turno e Decision model; regenerar costuma enviar os mesmos ramos sem nova solicitação. Esse cache vive no servidor em execução e guarda até 200 chaves de turno. Reinício ou descarte do cache pode gerar outra solicitação. Uma mensagem mais recente nova ou editada, outro modelo, uma declaração modificada ou opções alteradas também podem precisar de nova resposta.

Respostas ausentes ou que falharam não são armazenadas como respostas "não" obtidas com sucesso: repetir o mesmo turno pode perguntar novamente e usar outro ramo. Os temporizadores sticky/cooldown são separados desse cache.

Declarações de prompts de agentes seguem as mesmas regras. Agentes anteriores/paralelos leem o turno antes da resposta; os de pós-processamento leem a resposta concluída, então mudar o swipe pode exigir novas respostas. Rodar um agente manualmente reutiliza respostas bem-sucedidas ainda em cache para suas entradas. Veja [Declarações de decisão no prompt do agente](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

<a id="prompt-caching"></a>

#### Cache de prompts

O **cache de prompts** do provedor é separado do cache de respostas Decision do Marinara. Ele pode reutilizar um prefixo inalterado do prompt enviado ao modelo de chat. Mudar um ramo de decisão pode impedir reutilização a partir dali; um prefixo anterior intacto ainda pode se qualificar. A parte reutilizável e a cobrança dependem do provedor, dos limites do cache, do comprimento mínimo e da duração.

**Coloque blocos de decisão variáveis no fim do prompt**, como instruções depois do histórico ou uma nota do autor pouco profunda. Uma mudança no início pode perder a maior parte da economia de cache. Mantenha uma decisão no início somente quando sua resposta raramente muda e as instruções pertencem ali. O mesmo vale para opções de variáveis de preset: seu texto aparece onde está `{{name}}`.

Em uma conexão direta Anthropic com **Enable prompt caching** (ativar cache de prompts), Marinara marca o fim do prompt de sistema e uma mensagem **Cache depth** (profundidade do cache) mensagens antes da mais recente (5 por padrão). Uma mudança antes do histórico pode invalidar o limite do sistema e o histórico posterior, embora um prefixo anterior correspondente continue reutilizável. Uma mudança depois do limite marcado no histórico pode preservar esse prefixo em cache. Entre os dois limites, pode preservar o prefixo de sistema e perder parte do histórico em cache. Leituras e gravações do cache têm preços diferentes.

Comprimentos mínimos de cache e limites aceitos variam por modelo e podem mudar. Consulte o [guia atual de cache de prompts da Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) ou o [guia de cache de prompts da OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching) para detalhes e regras de cobrança.

<a id="when-a-decision-branch-never-appears"></a>

### Quando um ramo de decisão nunca aparece

Se um usuário relata que um ramo nunca aparece, as causas prováveis, em ordem, são:

1. **Nenhum Decision model definido.** Toda condição de decisão é falsa em todos os turnos. O editor avisa sob qualquer campo que use uma.
2. **O Decision model não responde.** Conexão hospedada com chave errada, sem créditos ou limitada; modelo local parado ou lento demais; ou modelo de decisão instalado que não iniciou.
3. **É um modelo de raciocínio** que se abstém antes da resposta.
4. **Declarações demais na etapa de planejamento pertinente**, acima do orçamento.
5. **Ele responde, mas abaixo do limiar.** Geralmente pela redação ou porque o modelo pontua aquele turno abaixo do esperado.

Pergunte qual Decision model foi selecionado e o que **Test** informa. **Peek Prompt** mostra os ramos realmente enviados. Quando precisa montar uma nova prévia, lista declarações sem resposta, que ali valem não. No nível de log debug, cada declaração, sua resposta e sua interpretação como sim são registradas; veja [Níveis de log](../CONFIGURATION.md#logging-levels).

A correção raramente está no preset. Quando está, costuma ser a redação ou um ramo com algo indispensável ao prompt.

## Guias relacionados

- [Modelos de decisão](../connections/decision-models.md)
- [Macros de prompt](macros.md)
- [Variáveis de preset](preset-variables.md)
- [Chats em grupo e conversas em grupo](../chats/group-chats.md)
