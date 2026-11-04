# Prompts condicionais ({{#if}})

Um bloco `{{#if}}` inclui um trecho do prompt só quando uma condição é verdadeira. Use-o para dar a um único preset compartilhado instruções diferentes para cada personagem, persona ou chat, ou para deixar de fora um campo vazio. Os condicionais fazem parte do sistema de macros, então funcionam em todo lugar onde as [macros](macros.md) funcionam: cards de personagem, personas, entradas de lorebook e presets.

Marinara verifica a condição toda vez que monta um prompt, mantém o texto correspondente e descarta o resto. Este é um recurso avançado, e a maioria dos chats nunca precisa dele.

## A sintaxe básica

O bloco começa com `{{#if condition}}` e termina com `{{/if}}`. Acrescente `{{else}}` para o caso falso e `{{else if}}` para encadear mais condições. Marinara verifica cada ramo de cima para baixo e mantém o primeiro que for verdadeiro. Se nenhum for verdadeiro e não houver `{{else}}`, o bloco não gera texto nenhum.

```text
{{#if length == "short"}}
Keep your reply to one or two sentences.
{{else if length == "long"}}
Write a detailed, multi-paragraph reply.
{{else}}
Write a reply of normal length.
{{/if}}
```

O bloco pode ficar em uma linha só ou ocupar várias, e você pode aninhar blocos.

## Operadores

Em geral, a condição tem um valor à esquerda, um operador e um valor à direita, como em `char == "Alice"`.

| Operador | Significado |
| --- | --- |
| `==`, `=`, `is` | Igual. |
| `!=`, `is not` | Diferente. |
| `>`, `<`, `>=`, `<=` | Maior que, menor que, maior ou igual, menor ou igual (só com números). |
| `contains`, `includes` | O valor da esquerda contém o valor da direita como texto. |
| `not contains`, `not includes` | O valor da esquerda não contém o valor da direita. |

Regras de comparação:

1. Com os operadores de igualdade, se os dois lados parecem números, Marinara os compara como números, então `5` é igual a `5.0`. Caso contrário, compara como texto, sem diferenciar maiúsculas de minúsculas, então `Mari` é igual a `mari`.
2. Com `>`, `<`, `>=` e `<=`, os dois lados precisam ser números. Caso contrário, a condição é falsa.
3. `contains` e `includes` não diferenciam maiúsculas de minúsculas, então `contains "dr"` combina com `Dr Smith`.

### Combinar condições

Use `||` para OR e `&&` para AND. O `&&` é avaliado antes do `||`. Use parênteses para definir a ordem.

```text
{{#if character == "Maukie" || character == "Pantalone"}}
Use the shared instructions.
{{/if}}

{{#if (character == "Maukie" || character == "Pantalone") && scenario contains "lake"}}
Use the lakeside instructions for either character.
{{/if}}
```

Quando houver várias opções de igualdade para o mesmo valor, você pode omitir o lado esquerdo repetido: `character == "Maukie" || "Pantalone"`. Isso vale para `==`, `=` e `is`. Dos dois lados do `&&`, escreva condições completas.

### Verificações de valor preenchido

Uma condição sem operador é verdadeira quando o valor tem conteúdo de verdade. Ela é falsa quando o valor está vazio ou é um destes: `false`, `0`, `no`, `off`, `null` ou `undefined`, em maiúsculas ou minúsculas.

```text
{{#if scenario}}
Current scene: {{scenario}}
{{else}}
No specific scene is set.
{{/if}}
```

### O que pode ser comparado

Qualquer um dos lados da condição pode ser:

1. Uma palavra-chave de campo ou de identidade, como `char`, `user`, `group`, `persona`, `description`, `personality`, `scenario`, `input`, `model` ou `reasoning`. Elas leem os mesmos valores das macros correspondentes. `group` lista os outros personagens ativos, sem contar quem está respondendo no momento.
2. Um valor literal entre aspas, como `"Alice"`.
3. O nome de uma variável de preset, como `length`. Veja [Variáveis de preset](preset-variables.md).
4. Uma consulta explícita de variável, escrita como `var:name` ou `var.name`.
5. Outra macro, que é resolvida primeiro.
6. Uma pergunta para o seu modelo de decisão: `decision:"..."` ou `decision_choice:"..."`. Veja [Consultar o modelo de decisão](#asking-the-decision-model).

Uma palavra solta que não seja palavra-chave é tratada como nome de variável. Se nenhuma variável tiver esse nome, ela é usada como texto simples. Coloque os valores literais entre aspas para evitar confusão.

### Aspas

Coloque o texto fixo entre aspas duplas retas ou aspas simples retas. Dentro de um valor entre aspas, escape uma aspa com barra invertida e escreva `\n` para quebrar a linha. Sempre coloque entre aspas um literal que tenha espaço, como `"Dr Smith"`. Um valor de várias palavras sem aspas é lido como um único nome de variável.

## Blocos de grupo para vários personagens

Em um chat em grupo com dois ou mais personagens, o bloco de grupo repete o texto uma vez para cada personagem. Coloque um `[` sozinho em uma linha, depois o texto e depois um `]` sozinho em outra linha. O bloco precisa conter uma macro de personagem, como `{{char}}` ou `{{description}}`, ou uma condição baseada em personagem.

```text
[
{{char}}'s current attitude:
{{#if char == "Alice"}}cheerful and open{{else}}guarded and quiet{{/if}}
]
```

Com Alice e Bob, o bloco roda duas vezes, uma por personagem. Fora de um bloco de grupo, a macro de personagem se resolve apenas para o personagem atual ou principal. Em um chat com um personagem só, as linhas com `[` e `]` continuam como texto comum.

## Exemplos

Tom diferente para cada personagem:

```text
{{#if char == "Dottore"}}
Speak in a cold, clinical tone.
{{else}}
Speak warmly and casually.
{{/if}}
```

Incluir um campo somente quando ele está preenchido. Com o campo **Backstory** (história de origem) vazio, o bloco não gera texto nenhum, então nenhum rótulo vazio é enviado.

```text
{{#if backstory}}
Backstory to remember: {{backstory}}
{{/if}}
```

Instruções para uma família de modelos. `model` é o ID do modelo, como `claude-opus-5-5`, então `contains` corresponde a todas as versões do Opus e `==` corresponde a um modelo exato.

```text
{{#if model contains "opus"}}
Keep replies under 400 words.
{{/if}}
```

Instruções de planejamento que dependem do raciocínio. Com o raciocínio ligado em qualquer nível, o modelo recebe a primeira linha. Com o raciocínio desligado, `{{reasoning}}` vale `off`, que é lido como falso. Para agir sobre um nível específico, compare-o, como em `{{#if reasoning == "max"}}`.

```text
{{#if reasoning}}
Plan the reply in your thinking before you write it.
{{else}}
Before replying, write your plan inside <plan></plan> tags.
{{/if}}
```

<a id="asking-the-decision-model"></a>

## Consultar o modelo de decisão

Uma condição pode perguntar ao seu modelo de decisão o que está acontecendo no chat. O modelo de decisão é um modelo pequeno que lê as últimas mensagens e uma declaração escrita por você e informa se ela é verdadeira. Ele nunca escreve no chat. Isso permite que um preset, card, entrada de lorebook ou prompt de agente envie uma instrução apenas nos turnos em que ela se aplica.

Antes de começar: escolha um modelo de decisão em **Decision model** (modelo de decisão) no painel **Connections** (Conexões). Veja [Modelos de decisão](../connections/decision-models.md) para saber o que é e como escolher um. Para decidir se uma entrada inteira de lorebook é ativada, use o campo [Decision](../lorebooks/entries.md#decision-activation) da entrada.

Algumas ideias: descrever um novo lugar apenas quando a cena mudou, carregar regras de ritmo de combate apenas durante uma luta, segurar a intensificação em um preset de desenvolvimento lento ou fazer só o personagem abordado responder diretamente em um bloco de grupo.

### Sim ou não: `decision:`

```text
{{#if decision:"The latest message moves the scene to a new place"}}
Open your reply by describing the new location in one or two sentences.
{{/if}}
```

A condição é verdadeira quando o modelo de decisão diz que a declaração é verdadeira. Ela funciona com `{{else}}`, `&&`, `||`, parênteses, aninhamento e blocos de grupo. As macros da declaração são preenchidas primeiro, então `{{user}}` e `{{char}}` funcionam. Em um bloco de grupo, uma declaração que cita `{{char}}` é perguntada uma vez por personagem.

### Uma entre várias respostas: `decision_choice:`

`decision_choice:` pede ao modelo que escolha uma opção. As opções são os valores com que você o compara.

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen's lines are short and clipped.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and looks away.
{{else}}
Kaelen is his usual self.
{{/if}}
```

O modelo escolhe entre "angry", "sad" e "none of these". Escreva a declaração como um tema e as opções como respostas curtas. A forma curta `== "rain" || "snow"` oferece as duas opções.

Para dizer o que uma opção significa na sua história, acrescente critérios depois dela, separados por dois-pontos, com o mesmo tipo de aspas nas duas partes: `== "angry":"Kaelen raises his voice, makes threats or breaks something"`. O modelo continua respondendo "angry". Se uma opção tiver critérios diferentes em vários lugares, valem os primeiros.

<a id="sticky-and-cooldown"></a>

### Sticky e cooldown

Acrescente `sticky:` e `cooldown:` depois de uma declaração para manter a resposta dela por alguns turnos, em vez de perguntar em todo turno.

```text
{{#if decision:"The latest message starts a fight" sticky:3 cooldown:5}}
Keep combat pacing rules in effect.
{{/if}}
```

- `sticky:N`: depois de um sim, a declaração continua sim por N turnos sem ser perguntada.
- `cooldown:N`: começa quando o sticky termina, ou logo depois do sim. Por N turnos, a declaração vale não e não é perguntada.
- Um turno é cada mensagem nova que o modelo de decisão lê. Regenerar ou dar swipe na mesma mensagem é o mesmo turno, então refazer uma resposta nunca reduz um temporizador.
- Uma declaração retida não é perguntada e não conta em **Decision statements per turn** (declarações de decisão por turno).
- Para `decision_choice:`, o sticky mantém a opção escolhida, e o cooldown faz toda comparação valer não.
- Uma declaração escrita em vários lugares usa o sticky e o cooldown mais longos.
- O Peek Prompt mostra a resposta retida e nunca avança um temporizador.

Para uma entrada de lorebook ativada pelo campo **Decision** dela, use os próprios **Sticky** e **Cooldown** da entrada.

<a id="until-and-while"></a>

### Until e while

Para manter um bloco ativo enquanto algo durar, acrescente `until:` ou `while:` com uma segunda declaração.

```text
{{#if decision:"A fight starts in the latest message" until:"The fight ends in the latest message"}}
Keep combat pacing rules in effect.
{{/if}}
```

- Depois de um sim, o bloco continua ativo. A primeira declaração não é perguntada. No lugar dela, a declaração `until` é perguntada a cada turno, e o bloco se desativa no turno em que ela for verdadeira.
- `while:` funciona ao contrário: o bloco continua ativo enquanto a declaração dele for verdadeira e se desativa quando ela for falsa.
- Use um ou outro. Se os dois forem escritos, só o primeiro conta.
- Quando o bloco se desativa, o cooldown começa como de costume. Sem resposta em um turno, o bloco continua ativo.
- A declaração `until` ou `while` conta em **Decision statements per turn**. A primeira declaração não conta enquanto o bloco estiver ativo.
- Isso funciona com `decision:`, não com `decision_choice:`.

Com **sticky**, acrescente `:and` (também `:restrict`) ou `:or` (também `:extend`) depois da segunda declaração para escolher como as duas se combinam.

| Escrito | Depois do sim, o bloco continua ativo |
| --- | --- |
| `until:"..." sticky:5` ou `until:"...":and sticky:5` | Por no máximo mais 5 turnos, e se desativa mais cedo se a declaração until for verdadeira. |
| `until:"...":or sticky:5` | Por pelo menos mais 5 turnos, e depois até a declaração until ser verdadeira. |
| `while:"..." sticky:5` ou `while:"...":or sticky:5` | Por pelo menos mais 5 turnos, e depois enquanto a declaração while for verdadeira. |
| `while:"...":and sticky:5` | Por no máximo mais 5 turnos, e se desativa mais cedo se a declaração while for falsa. |

<a id="checking-every-few-turns"></a>

### Verificar a cada poucos turnos

Acrescente `every:N` para perguntar uma declaração apenas a cada N turnos.

```text
{{#if decision:"The weather changes in the latest message" every:3}}
Describe the new weather in a sentence.
{{/if}}
```

- Ela é perguntada no primeiro turno em que é alcançada, depois 3 turnos mais tarde, e assim por diante. Entre as verificações, ela vale não, não é perguntada e não conta em **Decision statements per turn**.
- Regenerar ou dar swipe não avança a programação.
- Sticky e cooldown continuam retendo a resposta. `every:` só decide quando perguntar uma declaração que não está retida.
- Uma declaração escrita em vários lugares usa o menor `every:`.

<a id="priority"></a>

### Prioridade

Quando um plano de prompt tem mais declarações que o orçamento de **Decision statements per turn**, `priority:high` ou `priority:low` decide quais são perguntadas. Sem prioridade, a declaração tem prioridade média.

```text
{{#if decision:"In the latest message, a character is badly hurt" priority:high}}...{{/if}}
{{#if decision:"The latest message mentions food" priority:low}}...{{/if}}
```

- As declarações de prioridade alta são perguntadas primeiro e as de prioridade baixa, por último. Na mesma prioridade, decide a ordem no prompt.
- As declarações acima do limite valem não, começando pela menor prioridade, e o Peek Prompt as lista.
- Uma declaração escrita em vários lugares usa a maior prioridade.
- As declarações do próprio prompt (preset, cards, persona, notas do autor) são planejadas primeiro. As declarações de lorebook usam as vagas que sobram, qualquer que seja a prioridade delas.

Você pode combinar todos os modificadores em qualquer ordem: `decision:"..." priority:high sticky:3 cooldown:5 every:2`.

### Sem resposta significa não

Uma condição de decisão é falsa sempre que não há resposta: nenhum modelo de decisão foi definido, ele não respondeu a tempo ou falhou. Para `decision_choice:`, toda comparação é falsa. Planeje levando isso em conta.

- Use uma decisão para acrescentar ou cortar orientações, nunca para levar conteúdo de que a história depende.
- Dê a cada bloco de decisão um padrão: nada, ou um `{{else}}` adequado a qualquer turno.
- Não encadeie decisões de modo que uma resposta errada mude várias outras.
- Não condicione consentimento, avisos de conteúdo ou instruções de segurança a uma decisão.

Qualquer modelo pode errar. Escreva para "um modelo de decisão", não para um produto específico.

<a id="writing-statements"></a>

### Escrever declarações

- Declare um fato verdadeiro ou falso, como uma linha de relatório. Não uma pergunta ("Did the scene change?") nem uma instrução ("If the scene changed, describe it"). Modelos pequenos costumam responder não a uma instrução, e o bloco nunca roda.
- Diga "in the latest message" quando quiser se referir a este turno. O modelo lê várias mensagens, e uma anterior pode fazê-lo responder sim.
- Nomeie de quem se trata. "He is angry" pode ser atribuído ao personagem errado.
- Descreva algo visível no texto, como uma ação ou uma fala. Evite palavras de humor ("The scene is intense") e intenções ocultas ("Mira is lying").
- Seja breve. Divida uma declaração longa em partes se quiser reutilizá-las ou depurá-las.

Para testar a redação:

1. Selecione um modelo em **Decision model** e clique em **Test** (testar). Isso verifica a conexão com uma amostra fixa. Não testa a sua declaração.
2. Adicione a declaração ao prompt e envie mensagens em que ela deve ser verdadeira e mensagens em que deve ser falsa.
3. Use o **Peek Prompt** para ver qual ramo foi enviado. Abra **Decision diagnostics** (diagnóstico de decisões) e escolha **Test decisions** (testar decisões) para obter novas respostas sem gerar uma réplica. Testes hospedados podem gerar cobranças. Veja [Como testar declarações de decisão](../chats/peek-prompt.md#testing-decision-statements).
4. Ajuste a redação e teste novamente. Para ver as respostas das gerações em andamento, ative Debug Mode ou os [logs de depuração](../CONFIGURATION.md#logging-levels).

<a id="limits-and-cost"></a>

### Limites e custo

<a id="statement-allowance"></a>

#### Orçamento de declarações

**Decision statements per turn**, em **Decision model**, tem padrão de 32. Não é um limite único para todas as solicitações de decisão nem para os gastos. Marinara o aplica em etapas.

1. As declarações do prompt principal do chat são planejadas dentro do orçamento. As decisões de lorebook usam o que sobra.
2. Os agentes que rodam antes ou durante a resposta recebem um plano combinado com o prompt principal, usando o orçamento de novo. Esta etapa não desconta o uso do lorebook, então o total pode superar a configuração.
3. Os agentes de pós-processamento recebem um orçamento separado depois da resposta.

As perguntas de ativação de agentes e a ordem de resposta Smart são separadas dessa configuração.

Só entram no plano de uma etapa as declarações que ela pode usar: seções e grupos de preset ativados, opções de variáveis selecionadas e conteúdo de entradas de lorebook ativadas. Uma condição fixa pode excluir uma declaração, como `{{#if char == "Dottore" && decision:"..."}}` enquanto o personagem é Mira. Uma condição de variável não exclui, porque as variáveis podem mudar durante a montagem do prompt. As declarações retidas por sticky, cooldown ou `every:` não ocupam vaga. As declarações que ficam de fora valem não.

#### Solicitações e tempo

Em uma conta Decision hospedada, um turno pode fazer várias solicitações cobradas. As declarações podem ser agrupadas, mas a ativação de lorebooks, o conteúdo de entradas recém-ativadas, as correspondências recursivas e as fases de agentes podem exigir mais lotes. Um modelo de chat local acrescenta tempo de processamento em vez de cobranças e responde a um `decision_choice:` com uma pergunta de sim ou não por opção.

Cada solicitação tem um tempo limite: 1,5 segundo por padrão para uma conta Decision hospedada, ou 4 segundos para uma conta de modelo de chat compatível com OpenAI ou um modelo local. Veja [Tempos limite](../connections/decision-models.md#time-limits). Um modelo local de raciocínio se abstém antes da resposta, a menos que você ative **Also gate agents that run before the reply** (avaliar também os agentes que rodam antes da resposta).

<a id="answer-reuse"></a>

#### Reutilização de respostas

Marinara normalmente reutiliza as respostas bem-sucedidas para o mesmo turno e o mesmo modelo de decisão, então regenerar costuma enviar os mesmos ramos sem uma nova solicitação. O cache vive no servidor em execução e guarda até 200 turnos. Um reinício, um descarte do cache, uma mensagem mais recente nova ou editada, outro modelo, ou uma declaração ou um conjunto de opções modificado podem exigir uma nova resposta.

As respostas ausentes ou que falharam não vão para o cache, então uma nova tentativa pode perguntar de novo e seguir outro ramo. As declarações dos prompts de agentes seguem as mesmas regras. Rodar um agente de novo manualmente reutiliza as respostas ainda em cache para as entradas dele. Veja [Declarações de decisão no prompt do agente](../agents/custom-agents.md#decision-statements-in-the-agents-prompt).

<a id="prompt-caching"></a>

#### Cache de prompts

O cache de prompts do provedor é separado do cache de respostas do Marinara. Ele pode reutilizar um início inalterado do prompt enviado ao seu modelo de chat. Mudar um ramo de decisão pode impedir a reutilização a partir daquele ponto, embora uma parte anterior inalterada ainda possa se qualificar. A cobrança depende do provedor.

Coloque os blocos de decisão que mudam com frequência no fim do prompt, como nas instruções depois do histórico ou em uma nota do autor pouco profunda. Mantenha uma decisão perto do início somente quando a resposta dela raramente muda. As opções de variáveis de preset funcionam do mesmo jeito, porque o texto delas entra onde `{{name}}` aparece.

Em uma conta Anthropic direta com **Enable prompt caching** (ativar o cache de prompt) ligado, Marinara marca o fim do prompt de sistema e uma mensagem do chat que fica **Cache depth** (profundidade do cache) mensagens antes da mais recente (5 por padrão). Uma mudança antes do histórico pode invalidar o limite do sistema e o histórico posterior. Uma mudança depois do limite marcado no histórico pode preservar a parte em cache. Os comprimentos mínimos de cache variam por modelo. Veja o guia atual do provedor: o [guia de cache de prompts da Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) ou o [guia de cache de prompts da OpenAI](https://developers.openai.com/api/docs/guides/prompt-caching).

<a id="when-a-decision-branch-never-appears"></a>

### Quando um ramo de decisão nunca aparece

Causas prováveis, em ordem:

1. Nenhum modelo de decisão foi definido. Toda condição de decisão é falsa. O editor mostra um aviso sob qualquer campo que use uma.
2. O modelo de decisão não está respondendo: chave errada, falta de créditos ou limite de solicitações em uma conta hospedada, um modelo local parado ou lento demais, ou um modelo de decisão instalado que não iniciou.
3. É um modelo de raciocínio que se abstém antes da resposta.
4. Há declarações demais na etapa de planejamento, acima do orçamento.
5. Ele responde, mas abaixo do limiar. Geralmente é a redação.

Veja o que o **Test** informa e use o **Peek Prompt** para ver os ramos que foram enviados. Ele lista as declarações ainda sem resposta, que valem não. Com o nível de log em debug, cada declaração, a resposta dela e se ela foi lida como sim ficam registradas. Veja [Níveis de log](../CONFIGURATION.md#logging-levels). A correção raramente está no preset. Geralmente é a redação, ou um ramo que leva algo de que o prompt não pode abrir mão.

## Guias relacionados

- [Modelos de decisão](../connections/decision-models.md)
- [Macros de prompt](macros.md)
- [Variáveis de preset](preset-variables.md)
- [Chats em grupo e conversas em grupo](../chats/group-chats.md)
