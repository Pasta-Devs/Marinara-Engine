# Entradas de lorebook: chaves, posição e momento de acionar

Uma entrada é um fato de um lorebook, mais as regras que decidem quando Marinara a acrescenta ao prompt. Este guia mostra como adicionar entradas, escolher as chaves e o tipo de entrada, decidir onde uma entrada entra no prompt e controlar o momento de acionar.

Antes de começar: crie um lorebook e abra-o. Veja a [Visão geral dos lorebooks](overview.md).

## A aba Entries

Abra um lorebook pelo painel **Lorebooks**. O editor tem duas abas, **Overview** (visão geral) e **Entries** (entradas). Clique em **Entries** para ver a lista. O selo na aba mostra quantas entradas você tem.

A barra de ferramentas tem estes controles.

- **Search entries…** (buscar entradas) filtra por nome, chaves ou conteúdo.
- O menu de ordenação oferece **Order**, **Entries**, **Name A→Z**, **Name Z→A**, **Tokens ↓**, **Keys ↓**, **Fired ↓**, **Newest** e **Oldest**. As opções com ↓ ordenam do maior para o menor.
- **Select** (selecionar) liga a seleção múltipla, para você copiar, mover ou excluir várias entradas.
- **Add Folder** (adicionar pasta) cria uma pasta (veja [Pastas de entradas](#entry-folders)).
- **Add Entry** (adicionar entrada) acrescenta uma entrada em branco no topo.

Uma linha abaixo da barra de ferramentas mostra a quantidade de entradas, a quantidade de pastas e o total estimado de tokens de todo o conteúdo das entradas.

## Adicionar e editar uma entrada

1. Clique em **Add Entry**. Uma nova linha aparece.
2. Digite um nome na linha. Toda entrada precisa de um. O nome serve para você e para a busca, não para a IA.
3. Clique na linha, ou na seta dela. Um painel abre abaixo da linha com todos os campos.
4. Digite uma chave em **Primary Keys** (chaves primárias) e pressione <kbd>Enter</kbd>. Depois escreva o texto para a IA em **Content** (conteúdo). Veja [Conteúdo e chaves](#content-and-keys).

As edições são salvas sozinhas. A gaveta mostra **Autosaving…**, depois **Saving…** e depois **Saved automatically**. Se um salvamento falhar, o seu texto continua ali e Marinara tenta de novo na sua próxima edição.

Para copiar uma entrada, clique em **Duplicate entry** (duplicar entrada) na linha dela. Para removê-la, clique em **Delete entry** (excluir entrada) e confirme. No computador, esses botões aparecem quando você aponta o mouse para a linha.

<a id="content-and-keys"></a>

### Conteúdo e chaves

| Campo | O que é |
| --- | --- |
| **Primary Keys** | As palavras que acionam a entrada. Digite uma chave e pressione <kbd>Enter</kbd> para adicioná-la. Qualquer correspondência ativa uma entrada **Normal**. |
| **Content** | O texto enviado para a IA. Escreva um fato simples. Ele aceita [macros](../prompts/macros.md), e uma estimativa de tokens aparece abaixo da caixa. |
| **Secondary Keys** (chaves secundárias) | Chaves extras, usadas só por entradas **Selective**. |
| **Description** (descrição) | Um resumo curto que só o agente **Knowledge Router** (roteador de conhecimento) lê. Ele nunca é enviado ao modelo principal. Veja [Fontes de conhecimento](../agents/knowledge-sources.md). |

Uma lista com mais de 10 chaves mostra as 10 primeiras. Clique em **Show N more** (mostrar mais N) para ver o resto e em **Collapse** (recolher) para escondê-las. As chaves escondidas continuam correspondendo.

Por exemplo, uma entrada chamada `Silverhaven`, com as chaves `Silverhaven` e `the capital` e o conteúdo `Silverhaven is the mountain capital. Its people mine blue crystal and distrust outsiders.`, chega à IA sempre que qualquer uma das chaves aparece no chat recente.

### Regras de correspondência

Por padrão, uma chave corresponde quando aparece em qualquer lugar do chat recente, sem diferenciar maiúsculas de minúsculas. Três controles mudam isso.

- **Whole Words** (palavras inteiras; no painel da entrada, desligado por padrão): a chave precisa ser uma palavra completa. `Ash` corresponde a "Ash", mas não a "cash".
- **Case Sensitive** (diferenciar maiúsculas e minúsculas; no painel da entrada, desligado por padrão): as maiúsculas e minúsculas precisam bater. `IT` corresponde a "IT", mas não a "it".
- **Regex** (um ícone na linha com a dica **Enable regex key matching**, desligado por padrão): trata cada chave como uma expressão regular, um padrão de busca em texto. O ícone fica laranja quando está ligado.

Use **Regex** só se você conhece expressões regulares. Cada padrão roda com um tempo limite curto, e um padrão que demora demais não corresponde, então mantenha os padrões simples. Por exemplo, `\bVlad(?:'s)?\b` corresponde a "Vlad" e a "Vlad's".

## Escolher o tipo de entrada

Clique no ponto colorido da linha para abrir o menu de tipos.

- **Normal** (ponto verde, o padrão): é ativada quando uma chave primária corresponde. Use para a maioria das entradas: pessoas, lugares, itens. Dê a cada uma de três a oito chaves específicas.
- **Constant** (ponto amarelo): é ativada toda vez que o lorebook está ativo, sem chave. Use para os poucos fatos que precisam estar sempre presentes, como o ano ou o tom. O momento de acionar, a probabilidade e os filtros continuam valendo.
- **Selective** (ponto vermelho): é ativada quando uma chave primária corresponde e a lógica das chaves secundárias passa. Use quando uma chave comum acionaria a entrada na cena errada.

Cada entrada **Constant** gasta tokens em todas as mensagens, então use poucas.

Em uma entrada **Selective**, acrescente **Secondary Keys** e escolha um botão em **Logic** (lógica).

| Lógica | A entrada é acionada quando |
| --- | --- |
| **AND Any** | Pelo menos uma chave secundária também aparece. |
| **AND All** | Todas as chaves secundárias também aparecem. |
| **NOT Any** | Nenhuma chave secundária aparece. |
| **NOT All** | Nem todas as chaves secundárias aparecem juntas. |

Por exemplo, a chave primária `king` com a chave secundária `Silverhaven` e **AND Any** só é acionada quando o chat menciona as duas.

Se não funcionou: uma entrada **Normal** sem chaves não tem nada para corresponder. Acrescente chaves ou torne-a **Constant**. Uma entrada sem chaves ainda pode ser encontrada pelo sentido, mas só quando a [busca semântica](semantic-search.md) está toda configurada.

## Position, Depth e Order

Esses controles decidem onde uma entrada ativada entra no prompt. Em uma tela larga, eles ficam na linha compacta. Em uma tela estreita, toque no botão **Entry quick controls** (controles rápidos da entrada) da linha.

| Controle | O que faz |
| --- | --- |
| **Position** (posição) | Onde a entrada vai. O padrão é **Before character definitions** (antes das definições do personagem). |
| **Before character definitions** | Antes do card de personagem no prompt. Etiqueta na linha: **↑Char**. |
| **After character definitions** (depois das definições do personagem) | Depois do card de personagem. Etiqueta na linha: **↓Char**. |
| **@ Depth** | Dentro do histórico do chat. Etiqueta na linha: **@Depth**. |
| **Outlet** | Em nenhum lugar automaticamente (veja abaixo). |
| **Depth** (profundidade) | Aparece só com **@ Depth**. Quantas mensagens antes da mais recente a entrada fica. Padrão 4. |
| **Order** (ordem) | A sequência quando várias entradas são ativadas. Um número menor vem primeiro e sobrevive ao corte quando o orçamento está apertado. Padrão 100. |

**Role** (papel) fica no painel expandido da entrada, não nos controles rápidos. Ele marca o texto inserido como **System**, **User** ou **Assistant**, só importa com **@ Depth** e tem **System** como padrão.

Deixe esses controles nos valores padrão, a menos que uma entrada precise de mais. Use **@ Depth** com moderação. O texto cai entre as mensagens recentes como uma interrupção, então reserve essa opção para uma regra que o modelo vive esquecendo ou um fato que acabou de mudar. Por exemplo, "A taverna agora está pegando fogo." em **@ Depth** 1.

### Outlet

Uma entrada **Outlet** só aparece onde você coloca uma macro.

1. Defina **Position** como **Outlet**. Aparece o campo **Outlet name** (nome do outlet).
2. Digite um nome exato, que diferencia maiúsculas de minúsculas, como `character_rules`.
3. Coloque `{{outlet::character_rules}}` em uma seção de prompt do seu [preset](../prompts/presets.md).

As entradas que compartilham um nome são unidas na ordem de **Order**, separadas por quebras de linha. As macros de Outlet funcionam nas seções de prompt dos chats de Conversation, Roleplay e Game. Só aparecem as entradas que foram ativadas para esta resposta. Elas continuam seguindo as chaves, a probabilidade, os filtros, o momento de acionar, **Entry Limit** (limite de entradas) e **Token Budget** (orçamento de tokens). Sem entradas ativas, a macro não acrescenta nada. Uma entrada Outlet não pode chamar outra macro de Outlet. Veja [macros](../prompts/macros.md) para saber mais sobre a macro.

## Probabilidade e momento de acionar

**Probability** (probabilidade) é a chance de uma entrada ser acionada quando as chaves dela correspondem. O padrão é 100%. Defina 25% para uma chance em quatro a cada vez.

Os campos de **Timing** (momento de acionar) controlam o comportamento ao longo de várias mensagens. Os quatro começam não definidos, ou seja, desligados.

| Campo | O que faz | Exemplo |
| --- | --- | --- |
| **Sticky** (fixar) | Depois que a entrada é acionada, ela continua ativa por mais esta quantidade de mensagens, mesmo sem correspondência de chave. | Um segredo revelado em 3 continua no prompt por três mensagens. |
| **Cooldown** (espera) | Depois de acionada, ela espera esta quantidade de mensagens antes de poder ser acionada de novo. | Um presságio em 5 é acionado no máximo uma vez a cada cinco mensagens. |
| **Delay** (atraso) | Ela não pode ser acionada até o chat chegar a esta quantidade de mensagens. | Uma reviravolta em 20 fica escondida no começo. |
| **Ephemeral** (efêmera) | Ela se desliga depois desta quantidade de ativações. 0 significa sem limite. | Uma nota de introdução em 1 é acionada uma vez. |

**Sticky**, **Cooldown** e **Delay** contam mensagens. **Ephemeral** conta ativações.

<a id="decision-activation"></a>

## Ativação por Decision

O campo **Decision** (decisão) permite que o seu modelo de decisão, um modelo pequeno que responde perguntas de sim ou não, decida se uma entrada se aplica. Escreva uma declaração sobre o chat recente, como `In the latest message, a dragon is physically present`, e escolha um modo.

| Modo | Efeito |
| --- | --- |
| **Off** (desativado) | A entrada é ativada normalmente. Este é o padrão. |
| **Require** (exigir) | A entrada é ativada normalmente, e só quando a declaração também é verdadeira. Isso filtra menções passageiras. |
| **Trigger** (acionar) | A declaração é outra forma de ativar a entrada, mesmo sem nenhuma chave presente. Ela capta paráfrases e situações. |

Você pode usar macros como `{{user}}` e `{{char}}` na declaração.

Antes de começar: escolha um modelo de decisão em **Decision model**, no painel **Connections** (Conexões). Sem um modelo de decisão, ou sem resposta, a declaração conta como não. O editor avisa quando nenhum está definido.

- **Require** nunca admite uma entrada nova nesse caso, embora uma retenção **Sticky** já existente possa manter uma entrada ativa.
- **Trigger** não acrescenta nenhuma via, e a entrada ainda pode ser ativada pelas chaves.

Dê também uma via comum às entradas importantes, e use **Require** só para filtrar lore opcional.

**Require** verifica apenas uma entrada que já se qualifica por chaves, correspondência semântica, **Constant** ou um local de mapa e, mesmo assim, só se a declaração também for verdadeira. Em uma entrada **Constant**, ele torna a entrada situacional, por exemplo regras de combate com `A fight is happening in the latest message`. Ele não analisa toda entrada não usada.

As declarações de decisão acrescentam requisições ao modelo e dividem o limite de **Decision statements per turn** (declarações de decisão por turno). Para dicas de redação, limites, custo e reutilização de respostas, veja [Escrever declarações](../prompts/conditional-prompts.md#writing-statements), [Limites e custo](../prompts/conditional-prompts.md#limits-and-cost) e [Reutilização de respostas](../prompts/conditional-prompts.md#answer-reuse). Para configurar o modelo, veja [Modelos de decisão](../connections/decision-models.md).

Mais detalhes:

- Uma entrada **sticky** não é perguntada de novo enquanto a retenção dura, e uma entrada em cooldown não é perguntada de forma alguma.
- A lista de lorebooks ativos mostra **decision** para uma entrada que uma declaração **Trigger** ativou.
- **Peek Prompt** nunca pergunta. Ele mostra as respostas que o turno já tem.
- A ativação por decisão vale só para turnos de chat. A configuração de Game e as varreduras que os agentes fazem para si mesmos leem as entradas de decisão como não.
- Um `{{#if decision:"..."}}` dentro do conteúdo da entrada é diferente. Ele corta o texto de uma entrada que já foi ativada.

## Grupos, filtros e outras opções

A gaveta expandida tem mais campos.

| Campo | O que faz |
| --- | --- |
| **Group** (grupo) | As entradas do mesmo grupo são mutuamente exclusivas. Só uma é ativada por resposta. Use para alternativas, como três entradas de "o tempo hoje". Combine com uma **Probability** baixa para os boatos aparecerem só de vez em quando. |
| **Tag** | Uma etiqueta de texto livre, para você organizar do seu jeito. Não afeta a ativação. |
| **Locked** (bloqueada) | Impede que o agente **Lorebook Keeper** altere esta entrada. Veja a [Referência dos agentes para download](../agents/built-in-agents.md). |
| **No Vector** | Deixa a entrada fora da busca semântica. Veja [Busca semântica para lorebooks](semantic-search.md). |
| **Recursion** (recursão) | Permite que o conteúdo desta entrada acione outras entradas. Desligado por padrão. Veja [Orçamento de tokens e recursão em lorebooks](token-budgets.md). |

A seção **Context filters & matching sources** (filtros de contexto e fontes de correspondência) limita uma entrada a determinados personagens, tags de personagem ou tipos de geração. Ela também permite varrer campos extras do card, como a descrição do personagem, atrás das chaves da entrada. Em um chat em grupo no modo **Individual** (respostas individuais), cada resposta conta só o personagem que a escreve, então um filtro de personagem mantém a entrada fora das respostas dos outros personagens. Em uma resposta **Merged (Narrator)** (mesclado: narrador), todos os personagens do chat contam, então a entrada continua se qualquer personagem filtrado estiver no chat. Use isso para segredos que só um personagem conhece.

## Escolher as configurações de um fato

Pergunte-se quando a IA deve ver o fato e use esta tabela.

| O fato | Configuração |
| --- | --- |
| Sempre verdadeiro | **Constant**. Use poucas assim. |
| Só importa quando é citado | **Normal** com chaves específicas, como `Castle Dracul`, `the castle`, `the fortress`. |
| A chave é uma palavra comum, como `king` ou `home` | **Whole Words**, ou **Selective** com chaves secundárias. |
| Importante, mas raramente citado | **Normal** com [busca semântica](semantic-search.md), ou chaves mais amplas. |
| Várias versões que não podem aparecer juntas | O mesmo **Group**. |
| Uma regra que o modelo esquece no meio de uma cena | **@ Depth** perto de 1 a 4. |

Hábitos que mantêm um lorebook enxuto:

- Use chaves específicas. Uma chave como `he` ou `the city` corresponde a quase toda mensagem e desperdiça orçamento.
- Preencha **Description** em toda entrada que você espera que o **Knowledge Router** encaminhe. Ele lê a descrição, não o conteúdo.
- Monte as ambientações grandes como uma árvore. Acrescente uma entrada central para um grupo, como uma para The Empire que lista os membros, ao lado de uma entrada para cada membro.
- Deixe **Recursion** desligado nas entradas centrais. Caso contrário, citar o grupo puxa de uma vez a entrada completa de todos os membros para o prompt.

Por exemplo, pense na regra de como um vilão pode ser morto, que a IA costuma esquecer. Torne a entrada **Selective** com **AND Any**, **Whole Words** ativado e **Order** 10. Use as chaves primárias `weakness`, `kill`, `destroy`, `stake` e as chaves secundárias `Vlad`, `the count`. As chaves secundárias a mantêm quieta quando a equipe mata um lobo. **Whole Words** impede que `stake` corresponda a "mistake". A ordem baixa evita que ela seja cortada em uma cena cheia.

O lugar onde um lorebook fica decide quais chats o enxergam. Veja a [Visão geral dos lorebooks](overview.md) e [Vincular lorebooks a personagens e personas](linking-to-characters.md) para saber mais sobre lorebooks globais, vinculados e embutidos.

## Macros no conteúdo da entrada

**Content** é expandido como qualquer outro texto de prompt antes de ser enviado. Macros úteis:

- `{{char}}` e `{{user}}` dão os nomes, para uma entrada compartilhada soar bem em qualquer chat.
- `{{roll:1d6}}` rola um dado. `{{setvar::mood::angry}}` guarda um valor para este chat, e `{{getvar::mood}}` o lê de volta.
- `{{random::a::b::c}}` escolhe uma opção. Acrescente pesos, como em `{{random::common@3::rare@1}}`. Combine com uma **Probability** baixa para resumir uma tabela inteira de encontros em uma única entrada.
- `{{include::Entry name}}` insere o texto de outra entrada do mesmo lorebook, mesmo de uma entrada desativada. Veja [Macro de inclusão de lorebook](../prompts/macros.md#lorebook-include-macro).
- `{{// note}}` é um comentário. Ele é removido antes de a IA vê-lo, e antes das varreduras de recursão, então nunca aciona nada.

Para a lista completa, veja [Macros de prompt](../prompts/macros.md).

Com **Recursive** (varredura recursiva) ativado, Marinara varre de novo o conteúdo expandido das entradas ativadas. O texto que uma macro produz pode acionar outras entradas.

## A ferramenta Keyword test

O painel **Keyword test** (teste de palavras-chave), no topo da aba **Entries**, confere as suas chaves sem um chat.

1. Expanda **Keyword test**.
2. Cole na caixa um parágrafo de exemplo ou algumas mensagens.

As entradas que corresponderiam ganham um destaque verde e uma etiqueta **Would activate** (seria ativada). As entradas **Constant** ganham a etiqueta **Always active** (sempre ativa). Uma linha de contagem mostra quantas entradas ligadas seriam ativadas. O botão liga/desliga **Include other lorebooks** (incluir outros lorebooks) também confere as entradas ligadas dos seus outros lorebooks.

O teste ignora o momento de acionar, a probabilidade, os filtros de personagem e de persona e a correspondência pelo sentido, então um chat ao vivo ainda pode se comportar de outro jeito.

<a id="entry-folders"></a>

## Pastas de entradas

As pastas agrupam entradas dentro de um mesmo lorebook. Elas são independentes das pastas da biblioteca no painel **Lorebooks**.

- Clique em **Add Folder** e renomeie a pasta ali mesmo.
- Arraste uma entrada para cima de uma pasta, ou use o seletor **Folder** (pasta) da entrada (funciona com toque).
- Arraste uma pasta para cima de outra para aninhá-la, ou para a faixa do topo para tirá-la do aninhamento.
- Cada pasta tem um botão liga/desliga de ativação (dica "Folder enabled"). Quando ele está desligado, todas as entradas dentro dela param de ser ativadas.
- **Clone folder** (clonar pasta) copia a pasta com todas as entradas e subpastas.
- **Delete folder** (excluir pasta) remove só a pasta. O conteúdo dela sobe para o nível superior.

As pastas só aparecem como grupos quando você ordena por **Order** sem busca. Caso contrário, você vê uma lista simples e o aviso **Folder view paused (clear search and sort by Order)**.

## Solução de problemas

| Sintoma | Solução |
| --- | --- |
| Uma entrada nunca é acionada. | Dê chaves a ela ou torne-a **Constant**. Confira se o lorebook está ativado e ativo no chat. |
| Uma chave funcionava e parou. | Marinara varre só as últimas mensagens (**Scan Depth**, padrão 2). Aumente o **Scan Depth** (profundidade de varredura), acrescente **Sticky** ou torne a entrada **Constant**. |
| Uma entrada é acionada nas cenas erradas. | Use **Whole Words**, chaves secundárias de **Selective** ou um filtro de personagem. |
| A lore importante fica de fora. | Dê a ela um **Order** menor ou aumente o **Token Budget**. **Active Context** (contexto ativo), em **Chat Settings** (configurações do chat), mostra o que foi pulado e por quê. Veja [Orçamento de tokens e recursão em lorebooks](token-budgets.md). |
| A IA ignora uma entrada. | Confira **Active Context** para confirmar que ela foi ativada. Um fato longe da última mensagem pesa menos que um fato colocado perto da última mensagem com **@ Depth**. |

## Guias relacionados

- [Visão geral dos lorebooks](overview.md)
- [Modelos de decisão](../connections/decision-models.md)
- [Orçamento de tokens e recursão em lorebooks](token-budgets.md)
- [Busca semântica para lorebooks](semantic-search.md)
- [Fontes de conhecimento: agentes Retrieval e Router](../agents/knowledge-sources.md)
