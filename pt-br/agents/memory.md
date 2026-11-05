# Memory Recall e resumos do chat

Todo modelo de IA só consegue ler uma quantidade limitada de texto de cada vez, chamada de janela de contexto. Em um chat longo, as mensagens mais antigas saem dessa janela e a IA esquece o que aconteceu. Marinara Engine (chamado de Marinara daqui em diante) tem várias formas de trazer esse histórico de volta. Este guia mostra como ativar cada uma e o que fazer quando ela não funciona.

## Qual recurso de memória usar?

Comece pelo **Memory Recall**. Ele funciona sem nenhuma configuração extra, porque Marinara pode usar um modelo de embeddings embutido, no seu computador. Acrescente os resumos quando os chats ficarem muito longos.

| Recurso | O que ele faz | Funciona em |
| --- | --- | --- |
| **Memory Recall** | Procura, nas mensagens antigas, os trechos relacionados ao que você acabou de dizer e os acrescenta ao prompt. | Todos os modos |
| **Chat Summary** | Substitui as mensagens antigas por recapitulações curtas. | Roleplay |
| **Automatic Summarization** | Resume cada dia e depois cada semana. Sempre ativada. | Conversation |
| **Advanced Memory Recall** | Gerencia em conjunto o histórico atual, os resumos de cena e os trechos recuperados. Opcional. | Roleplay e Game Mode |

O Memory Recall e os resumos fazem trabalhos diferentes e podem rodar juntos. O Game Mode tem o Memory Recall e, se você quiser, o Advanced Memory Recall (veja [No Game Mode](#in-game-mode)). Ele não tem um recurso de resumo próprio.

## Memory Recall

O Memory Recall usa embeddings. Um embedding é uma impressão digital numérica do significado de uma mensagem. Marinara guarda as mensagens antigas em pequenos grupos chamados de blocos. Ele compara a impressão digital da sua nova mensagem com as impressões digitais guardadas e acrescenta ao prompt os blocos mais parecidos.

### Ativar o Memory Recall

1. Abra um chat e clique em **Chat Settings** (configurações do chat).
2. Localize a seção **Memory Recall**.
3. Ative **Enable Memory Recall** (ativar o Memory Recall).

A configuração vale para cada chat. Ela começa ativada nos chats de Conversation e nos chats de Roleplay ou Game que têm uma cena ativa. Nos outros chats, ela começa desativada. Desativá-la interrompe a recuperação, mas não exclui as memórias guardadas.

Se não funcionou: o Memory Recall precisa de uma fonte de embeddings (próxima seção). Se você não definir nenhuma, Marinara usa o modelo embutido, então a maioria das pessoas pode pular essa seção. Confira se a seção **Memory Recall** aparece. Algumas versões em contêiner, conhecidas como Marinara Lite, desativam o recurso por completo.

### Definir a fonte de embeddings (opcional)

O Memory Recall precisa de um modelo que crie as impressões digitais. Se você não definir nada, Marinara usa o modelo de embeddings embutido (veja abaixo), que é a resposta simples para a maioria das pessoas. Para usar um serviço, defina-o em uma conta, não nas configurações do chat.

Antes de começar: você precisa de uma conta que ofereça embeddings. Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).

1. Abra **Connections** (Conexões) e edite a conta.
2. Localize a seção **Semantic search (embeddings)** (busca semântica por embeddings).
3. Digite o nome de um modelo de embeddings, por exemplo `text-embedding-3-small`.
4. Opcional: defina **Embedding endpoint URL** (URL do endpoint de embedding) para mudar o endereço.
5. Opcional: use **Embedding provider** (provedor de embeddings) para emprestar a chave e o endereço de outra conta. **Same as this provider** (o mesmo deste provedor) mantém os desta conta.

Alguns serviços não oferecem embeddings. Nesse caso, Marinara pede que você escolha uma conta dedicada a embeddings, como uma compatível com OpenAI, a Google ou o modelo embutido.

Para usar uma única fonte em todo lugar, escolha-a em **Embeddings**, em **Connections → Defaults** (Conexões → Padrões). As contas sem um modelo de embeddings próprio passam a usá-la. A configuração própria de uma conta continua tendo prioridade.

Sem uma conta de embeddings e sem um padrão em **Embeddings**, Marinara recorre a um modelo de embeddings embutido. Ele é baixado uma única vez e roda no seu computador, sem chave de API. Veja [Como configurar o Built-in model](../connections/local-model.md).

A mesma configuração alimenta a busca semântica dos lorebooks, então você a configura uma vez para os dois.

### Ver e gerenciar as memórias guardadas

1. Abra **Chat Settings → Memory Recall**.
2. Clique em **Access memories for this chat** (acessar memórias deste chat). A janela **Memories for This Chat** (memórias deste chat) se abre. Com o Advanced Memory ativado, o visualizador fica dentro do painel lateral de Roleplay.

A janela mostra a quantidade de blocos guardados e uma contagem aproximada de tokens. Cada cartão de bloco mostra o período, a quantidade de mensagens, a hora de criação e um status.

| Status | Significado |
| --- | --- |
| **Vectorized** | A impressão digital foi criada e está pronta para a busca. |
| **Waiting for vector** | A impressão digital ainda está sendo criada. |
| **Embedding unavailable** | Nenhuma fonte de embeddings conseguiu criá-la. |

A barra de ferramentas tem ícones para exportar, importar, reconstruir e limpar as memórias.

- O ícone de lixeira de um bloco abre **Forget Memory** (esquecer memória). Confirme em **Forget**.
- O ícone de limpar tudo abre **Clear Memories** (limpar memórias). Confirme em **Clear**. Isso remove as memórias da recuperação, não as mensagens do chat.
- O ícone de atualizar reconstrói todos os blocos a partir das mensagens atuais. Use-o depois de trocar o modelo de embeddings.
- A exportação salva um arquivo `.marinara.json`. A importação aceita arquivos `.json` ou `.marinara` e os mescla com as memórias que já existem.

### Como o Memory Recall se comporta

- Marinara guarda blocos em segundo plano sempre que existe uma fonte de embeddings, mesmo com **Enable Memory Recall** desativado. O botão liga/desliga só controla se as memórias entram no prompt.
- Um bloco só é criado depois de pelo menos 5 mensagens novas.
- Correspondências fracas são ignoradas, então a recuperação pode não trazer nada mesmo quando existem memórias. Só uma pequena parte do prompt é usada para as memórias recuperadas.
- Depois que você troca o modelo de embeddings, os blocos antigos deixam de corresponder. Reconstrua-os.
- Excluir as mensagens de um chat também exclui os blocos dele.

## Chat Summary (Roleplay)

O Chat Summary comprime as mensagens antigas em recapitulações curtas, chamadas de entradas de resumo. Cada entrada pode ser escrita pela IA ou por você, e cada uma pode ser ativada ou desativada. Ele existe só nos chats de Roleplay.

Abra **Chat Settings** e expanda **Chat Summary**, abaixo de **Lorebooks**. No computador, você pode abri-lo em uma janela própria. Veja [Visão geral do painel Chat Settings](../chats/chat-settings.md#popping-a-section-out-into-its-own-window).

### Criar uma entrada de resumo

1. Em **Summary Scope** (escopo do resumo), escolha **Last** para as mensagens mais recentes ou **Range** para um intervalo de mensagens.
2. Clique em **Generate** (gerar) para a IA escrever uma entrada, ou em **Write** (escrever) para digitar uma você mesmo.

Cada entrada mostra um título, o intervalo de origem ou a quantidade de mensagens e uma estimativa de tokens. Você pode ativá-la ou desativá-la, expandi-la, editá-la com **Edit** ou excluí-la com **Delete**. **Show Inactive** e **Hide Inactive** mudam o que a lista mostra. **Activate All** e **Deactivate All** ativam ou desativam todas as entradas de uma vez.

Para mudar várias entradas, marque-as (no computador, clique com Shift para selecionar um intervalo) e use **Enable selected** (ativar selecionadas) ou **Disable selected** (desativar selecionadas).

Se **Review Agent Outputs** (revisar as saídas dos agentes) estiver ativado, os resumos da IA esperam a sua aprovação. Veja [Aprovações de agentes e o Agent Suite](approvals-and-agent-suite.md).

### Automatic Summaries

O painel **Automatic Summaries** (resumos automáticos) mantém os resumos em dia enquanto você conversa.

1. Ative **Enabled** (ativado).
2. Defina em **Every** (a cada) quantas mensagens do usuário passam entre um resumo e outro. O padrão é 5. A faixa vai de 1 a 200.
3. Opcional: clique em **Backfill Summary** (preencher resumos) para resumir um chat antigo que nunca teve resumos. Aparece uma barra de progresso. Clique em **Stop** (parar) para encerrar antes do fim.

### Prompt, provedor e tamanho da saída do resumo

- **Summary Prompt** (prompt de resumo): clique em **Edit** para mudar as instruções que a IA usa. Clique em **Templates** (modelos) para gerenciar os prompts salvos com **New template** (novo modelo), **Duplicate**, **Edit** e **Delete**. Os modelos de prompt são globais: escolher um em um chat de Roleplay muda o prompt de todos os chats de Roleplay.
- **Summary Provider** (provedor de resumos): a conta que escreve os resumos. Ele usa primeiro a sua conta padrão dos agentes e, depois, a do próprio chat.
- **Maximum output size** (tamanho máximo da saída): o comprimento máximo de um resumo. O padrão é 4096 tokens. A faixa vai de 1 a 32768.

### Opções de exibição

- **Hide summarised messages**: esconde as mensagens originais assim que um resumo passa a cobri-las. Desativado por padrão.
- **Recent message tail**: mantém visível esta quantidade das mensagens mais recentes, mesmo com a ocultação ativada. O padrão é 10. Qualquer número inteiro a partir de 0 funciona. Com 0, todo o lote resumido fica oculto. Valores mais altos deixam os prompts maiores e mais caros.
- **Collapse hidden messages**: muda a aparência das mensagens ocultas na transcrição.

A cauda de mensagens recentes limita as mensagens resumidas. Uma mensagem resumida mais antiga que a cauda fica de fora do prompt na hora, antes mesmo que o próximo resumo a oculte. Uma mensagem mais antiga que ainda não é coberta por nenhum resumo continua sendo enviada, porque deixá-la de fora faria com que ela se perdesse. Quando há mensagens assim, o Chat Summary mostra, abaixo de **Recent message tail**, quantas são. Clique em **Backfill Summary** para resumi-las.

### Chats em grupo mesclados

Em um chat em grupo mesclado, uma única resposta fala por todos os personagens. Uma parte de uma entrada escrita para determinados personagens, como `{{#if char == "Kaito"}}…{{/if}}`, é mantida para todos os personagens a quem ela se aplica e marcada com quem a conhece, por exemplo "known only to Kaito". Partes que só o **Narrator** (narrador) do Advanced Memory recebe ficam de fora. Em chats em grupo em que os personagens respondem um de cada vez e em chats com um só personagem, cada personagem lê as entradas como antes, e o Narrator lê todas as partes.

## Automatic Summarization (Conversation)

Os chats de Conversation resumem cada dia do calendário e depois juntam as semanas concluídas em um resumo semanal. O prompt então leva só os resumos semanais, os resumos diários da semana atual e as mensagens de hoje. Isso roda sozinho e não pode ser desativado.

### Editar os resumos

1. Abra um chat de Conversation e clique em **Chat Settings**.
2. Localize **Automatic Summarization**.
3. Clique em **Edit Summaries** (editar resumos).

A janela lista primeiro as semanas e depois os dias que ainda não entraram em uma semana. Expanda uma entrada para editar o texto de **Summary** (resumo) e as linhas de **Key Details** (detalhes principais).

### Definir quando um dia termina

- **Day Rollover Hour**: a hora em que um novo dia começa para os resumos. O padrão é 4 AM. Você pode escolher qualquer hora entre 12 AM e 11 AM. As mensagens enviadas antes desse horário contam como parte do dia anterior. Escolha um horário em que você não está conversando. Se você mudar a opção depois que já existem resumos, Marinara avisa que os resumos antigos usaram o horário anterior.
- **Recent Message Tail**: quantas das mensagens mais recentes de hoje continuam palavra por palavra depois de resumidas. O padrão é 10. Valores mais altos deixam os prompts maiores e mais caros.

### Preencher os dias que faltam

Um dia pode ficar sem resumo, por exemplo depois que você importa um chat antigo. Na janela, o painel **Missing Summaries** (resumos que faltam) tem um botão **Backfill** (preencher). Ele tenta de novo até 14 dias recentes de cada vez. Trocar o modelo de resumo não reescreve as entradas de dia ou de semana que já existem.

<a id="advanced-memory-recall-roleplay-and-game-mode"></a>

## Advanced Memory Recall (Roleplay e Game Mode)

O Advanced Memory Recall é um modo opcional que gerencia em conjunto a janela do histórico atual, os resumos de continuidade e os trechos antigos. Ele divide o chat em cenas, resume cada cena encerrada e recupera as cenas e as mensagens exatas que importam para cada resposta. Ele funciona sem o botão liga/desliga Agents e não precisa de nenhum agente baixado.

### Como ativar

1. Abra **Chat Settings → Memory Recall**.
2. Ative **Advanced Memory Recall**. Você também pode ativar **Automatic context and memory handling** (gerenciamento automático de contexto e memória), abaixo de Agents, no assistente de configuração de Roleplay.
3. Defina **Maximum allowed context before compression (tokens)** (contexto máximo permitido antes da compressão) dentro da janela de contexto do seu modelo.
4. Defina **Summary and recall budget (tokens)** (orçamento de resumos e recuperação) dentro desse teto.
5. Opcional: escolha um **Helper model** (modelo auxiliar).

Em um chat que já tem histórico, clique primeiro em **Prepare existing history** (preparar o histórico existente); veja abaixo. As configurações e o progresso aparecem no assistente e no painel lateral **Chat Settings**, no computador e no celular. O visualizador do arquivo fica no painel lateral.

### Configurações

| Configuração | Padrão | O que ela faz |
| --- | --- | --- |
| **Maximum allowed context before compression (tokens)** | 65.000 | Quando o prompt de saída alcança esse tamanho, o contexto mais antigo é cortado e resumido para a recuperação. |
| **Summary and recall budget (tokens)** | 6.500 | Quanto do contexto vai para as memórias. O recomendado é pelo menos 10% do máximo. |
| **Helper model** | Conta dos agentes, depois a conta do chat | Toma as decisões de cena e escreve os resumos e a continuidade. |
| **Maximum recalled scenes** (máximo de cenas recuperadas) | 3 | Limite máximo de cenas recuperadas por resposta. 0 desativa a recuperação opcional de cenas. |
| **Moving context** (contexto móvel) | 3 a 5 mensagens | Mensagens em cada trecho recuperado. 0 nos dois dá resumos sem trechos. |
| **Standalone scene check interval (messages)** (intervalo entre verificações de cena, em mensagens) | 5 | Quantas mensagens novas passam entre uma verificação de cena e outra. |
| **Use Decision model** (usar modelo de decisão) | Desativado | Deixa um modelo de decisão encontrar os finais de cena e escolher as memórias. |
| **Decide who sees new messages** (decidir quem vê as novas mensagens) | Desativado | Só em chats em grupo em que os personagens respondem um de cada vez. |
| **Character recollections** (recordações dos personagens) | Desativado | Dá a cada personagem a própria memória de uma cena. |

O orçamento padrão é 10% do máximo padrão. Mudar o máximo depois não o altera. O teto cobre todo o prompt de saída estimado: instruções, mensagens, contexto recuperado, ferramentas e anexos. Tokens de resposta e margem de segurança são contados à parte. É uma estimativa, não um tokenizador exato nem um limite de cobrança.

Todas as chamadas de resumo de memória usam **Chat Summary → Maximum output size**, com pelo menos 8.196 tokens de saída para dar espaço ao raciocínio.

### Preparar o histórico existente

1. Clique em **Prepare existing history**. Os modelos resolvidos aparecem antes de começar.
2. Espere. Ele percorre o histórico antigo em lotes e mostra a etapa atual.
3. Use **Cancel** (cancelar) para parar. O trabalho concluído é mantido. Use **Resume** (retomar) para continuar, mesmo depois de fechar o painel lateral, reiniciar o servidor ou atualizar o aplicativo.

Uma chamada ao modelo que falha mantém a memória válida anterior e mostra um erro para tentar de novo. Não redefina a memória depois de uma falha: **Resume** reutiliza os resumos concluídos. A última cena em andamento continua aberta e é resumida quando termina.

Se o histórico recuperado mudar uma cena coberta por uma correção manual, desative essa memória para manter o texto dela como referência, ou exclua-a, e depois prepare de novo. **Fix** (corrigir) pula essa cena e a coloca na lista, em vez de parar.

Uma ramificação criada a partir de um chat preparado, por exemplo com **Branch from here** (ramificar a partir daqui), mantém o Advanced Memory. Uma ramificação criada dentro de uma cena reabre essa cena: o resumo antigo dela é descartado, e um novo é escrito quando ela termina. Um chat importado como uma nova ramificação é preparado normalmente.

<a id="fixing-memory-problems"></a>

### Corrigir problemas de memória

Quando algo na memória de um chat está quebrado, um pontinho fixo na sua cor de destaque aparece no botão **Chat Settings**, e um aviso informa quantas cenas têm problemas. Cada conjunto de problemas é anunciado uma vez, e o pontinho continua lá até que eles sejam resolvidos. Em **Chat Settings → Memory Recall**, os problemas aparecem listados acima das configurações. **Access memories for this chat** mostra o mesmo pontinho.

Pressione **Fix**, no aviso ou na lista, para consertar todas as cenas sinalizadas de uma só vez. Ele usa o **Helper model**. **Pause processing** (pausar o processamento) o interrompe e **Resume processing** (retomar o processamento) continua. Fix:

- pergunta de novo ao auxiliar quem estava nas cenas marcadas com **Check who was there** (conferir quem estava lá). Se ele ainda não souber dizer, ninguém ganha acesso e a cena entra na lista para você;
- verifica quem estava nas cenas antigas salvas antes de existir a verificação de participantes;
- escreve novos resumos para cenas cujas mensagens, mensagens ocultas, nomes de personagens ou resumos de apoio mudaram, e para cenas encerradas sem resumo. Resumos que você excluiu continuam excluídos;
- retoma o trabalho de memória que parou com um erro.

Fix nunca reescreve um resumo que você editou à mão. Ele coloca esses resumos em **need your review** (precisam da sua revisão) e continua. Ele não pode mudar configurações por você, como o intervalo de conhecimento de um personagem ou uma conexão de decisão que funcione.

Quando termina, Fix mostra "Advanced Memory fixed N scenes" e os números das cenas que precisam de revisão. Selecione um número para abrir essa cena em **Access memories for this chat**. Se o painel Chat Settings estava fechado, um aviso com **Show** (mostrar) leva você até lá. O próximo Fix não volta a perguntar sobre uma cena que ele não conseguiu decidir, então salve você mesmo o acesso dos personagens a ela.

### Reanalisar as cenas

Se alguma mudança de cena passou despercebida, por exemplo quando uma cena nunca terminou, use **Re-scan scenes** (reanalisar as cenas) em **Chat Settings → Memory Recall**.

1. Informe o número da primeira e da última mensagem a verificar. Por padrão, o intervalo é o da cena em andamento.
2. Pressione **Re-scan** (reanalisar).

Advanced Memory volta a procurar as mudanças de cena nessas mensagens e resume as cenas que mudaram. Ele usa o modelo de decisão quando **Use Decision model** está ativado e, caso contrário, o modelo auxiliar. As cenas fora do intervalo mantêm os limites e os resumos. Se um resumo que você editou fosse mudar, a reanálise é interrompida e indica essa cena.

<a id="optional-decision-model"></a>

### Modelo de decisão opcional

Um modelo de decisão é um modelo pequeno que responde a perguntas de sim ou não. Ele vem desativado por padrão e é salvo para cada chat de Roleplay.

1. Ative **Use Decision model** no Advanced Memory.
2. Escolha um modelo em **Memory Decision connection** (conexão de decisão para memória). Em **Built-in model** (modelo embutido), ele lista os mesmos modelos que o **Decision model** (modelo de decisão) global. Um modelo que ainda não pode responder aparece acinzentado com o motivo, e um modelo parado é iniciado quando recebe uma pergunta. Em **Connections**, ele lista as suas contas de decisão salvas. Veja [Modelos de decisão](../connections/decision-models.md).

Essa escolha é independente do padrão global de decisão.

O modelo encontra os limites de cena durante a preparação do histórico e a verificação das cenas em andamento. Antes de uma nova resposta, ele escolhe as memórias em duas etapas. Veja [Como funciona a recuperação por decisão](#how-decision-recall-works) para os detalhes.

As contas hospedadas recebem o texto recente da conversa e os resumos ou mensagens pré-selecionados que estão sendo avaliados, e podem cobrar por várias requisições por resposta. A recuperação filtra o acesso dos personagens antes de enviar os candidatos.

<a id="deciding-who-sees-new-messages"></a>

### Decidir quem vê as novas mensagens

Em um chat em grupo de Roleplay em que os personagens respondem um de cada vez, Advanced Memory pode decidir quais personagens veem cada nova mensagem. Assim você não precisa ocultar cada fala de um personagem que saiu da cena. Chats em grupo mesclados e chats com um só personagem não oferecem essa opção.

1. Ative **Decide who sees new messages** no Advanced Memory.

Cada nova mensagem, sua ou de um personagem, fica oculta para os personagens que não estão na cena. Ela usa o mesmo **Hide from AI** (ocultar da IA) por personagem do botão da própria mensagem, então o marcador de olho riscado mostra quem não pode vê-la. A sua mensagem é decidida assim que você a envia. As mensagens anteriores são decididas antes de o próximo personagem responder.

- O **Narrator** escolhido aqui e o **Narrator character** (personagem narrador) escolhido nas configurações de comandos de Roleplay veem todas as mensagens. O autor de uma mensagem sempre vê a própria mensagem. O destinatário de um sussurro que não está na cena ainda recebe o sussurro.
- Com **Use Decision model** ativado, pergunta-se a esse modelo, para cada personagem, se ele claramente não pode ver nem ouvir a mensagem. Um personagem que a história nunca coloca na cena conta como estando em outro lugar. Caso contrário, quem decide é o **Helper model**. Uma mensagem só é ocultada quando o modelo tem certeza.
- O modelo lê as mensagens da cena atual até o momento e pelo menos as últimas mensagens anteriores a ela. Ele também recebe uma lista dos personagens que falaram desde o início da cena. Essa lista é só uma dica: um personagem que ouve em silêncio continua contando como presente.
- Se você mesmo mudar o **Hide from AI** de uma mensagem, ou usar `/hide` ou `/unhide`, a sua escolha permanece e Advanced Memory nunca mais altera essa mensagem.
- Cada mensagem é decidida uma única vez. Se o modelo falhar ou esgotar o tempo limite, nada é ocultado e o erro vai para o log do servidor.

Com Advanced Memory ativado, uma nova resposta de personagem pode mudar de cena ou de ponto de vista com uma linha de quebra, como `***`, `---` ou `* * *`. A resposta é então salva como mensagens separadas do mesmo personagem, uma para cada parte.

- Cada parte tem o próprio público. **Decide who sees new messages**, **Hide from AI** e os sussurros valem para cada parte.
- O autor continua vendo todas as partes. Se ele não deve ver uma parte, oculte-a dele você mesmo.
- A linha de quebra fica no topo da parte que vem depois dela. Uma quebra dentro de um bloco de código ou de um bloco HTML, como `<details>`, não conta.
- O raciocínio da resposta aparece na primeira parte. Ele não é enviado de volta ao modelo, mesmo com **Exclude Past Reasoning** (excluir o raciocínio anterior) desativado.
- As informações da mensagem, os trackers e os resultados dos agentes ficam com a última parte.
- Agentes de reescrita, como o Prose Guardian, reescrevem cada parte separadamente. Com **Hold Message Until Rewrite** (segurar a mensagem até a reescrita) ativado, cada parte espera a própria reescrita. Se uma reescrita falhar, essa parte fica como foi escrita.
- A leitura automática em voz alta lê todas as partes, em ordem.
- Dar swipe ou regenerar uma parte gera uma nova versão só daquela mensagem. Em uma parte anterior, a nova versão mantém o texto antes da primeira quebra.
- Continue e Impersonate nunca dividem a resposta.

<a id="character-recollections"></a>

### Recordações dos personagens

Ative **Character recollections** para dar a cada personagem a própria memória de uma cena. A opção vem desativada por padrão.

- Cada personagem que estava em uma cena encerrada ganha uma memória curta, com cerca de 50 a 100 palavras, em primeira pessoa e com a voz dele. O card de personagem dele decide o que ele percebe. O **Narrator**, a sua persona e os personagens que estavam em outro lugar não ganham nenhuma.
- O modelo só pode usar o que cada personagem poderia saber. Uma recordação que copia quatro palavras seguidas de algo que o personagem dela não poderia saber fica de fora. Um fato recontado com outras palavras só é protegido pelas instruções.

Como elas continuam corretas:

- Uma recordação só vale enquanto o personagem dela puder ler exatamente o que podia quando ela foi escrita. Se depois uma mensagem da cena for ocultada dele ou mostrada a ele, uma recordação gerada é escrita de novo. Uma que você editou fica fora dos prompts até você conferi-la e salvá-la de novo.
- As recordações de uma cena nova vêm da mesma requisição do resumo dela. Se um card de personagem for grande demais para isso, elas vêm depois, em requisições próprias. Um personagem cujo card ocupa mais da metade do espaço que o modelo auxiliar tem para a cena não ganha nenhuma.
- Ativar a opção em um chat com cenas já resumidas acrescenta recordações uma cena de cada vez, e o progresso aparece como **Writing character recollections** (escrevendo as recordações dos personagens). Os resumos das cenas nunca mudam. **Resume** tenta de novo as cenas que falharam.
- Se o modelo não escrever nada aproveitável, a cena guarda uma recordação vazia até que mude o resumo dela ou o texto que pode ser lido. Você pode escrever uma em **Access memories for this chat**.

Onde elas aparecem e quanto custam:

- As recordações só aparecem com cenas recuperadas, abaixo do resumo da cena e antes do trecho dela, uma linha por personagem. Em um chat em grupo em que os personagens respondem um de cada vez, cada personagem vê apenas a própria. Em uma resposta mesclada, aparece a recordação de cada personagem presente que se lembra da cena, com o nome dele.
- Elas entram na conta de **Summary and recall budget**. Primeiro vêm os resumos, depois as recordações e, por fim, os trechos. Os trechos diminuem primeiro, depois recordações inteiras ficam de fora. Uma recordação nunca é encurtada.
- As recordações nunca vão para os **Chat Summaries** e nunca decidem quais cenas são recuperadas.
- Depois que o resumo de uma cena muda, as recordações geradas dela são escritas de novo, para até três cenas depois de cada resposta, começando pelas mais recentes. **Prepare existing history**, **Re-scan scenes** e **Resume** refazem todas.

Editar e desativar:

- Em **Access memories for this chat**, abra uma cena para ler e editar cada recordação. Uma recordação editada recebe a marca **Manually edited** (editada manualmente) e nunca é substituída. **Delete** (excluir) a tira dos prompts para sempre, mas você pode digitar uma nova.
- Desativar a opção mantém as recordações salvas e as deixa fora dos prompts. Exportação, importação e ramificações incluem as recordações.

<a id="in-game-mode"></a>

### No Game Mode

Os chats de Game Mode ativam o Advanced Memory Recall em **Chat Settings → Memory Recall**, da mesma forma. Sem ele, uma sessão de Game envia todo o histórico a cada turno até o limite de contexto, então uma sessão longa custa muito mais tokens de entrada por turno. Com ele, o prompt fica abaixo de **Maximum allowed context before compression**. A cena atual vai como mensagens do histórico atual, e as cenas anteriores vão como recapitulações e os momentos que a recuperação escolhe.

- **O Game Master lê todas as memórias.** Não há escolha de Narrator, intervalos de conhecimento, visibilidade automática de mensagens nem recordações dos personagens.
- **Posição.** As recapitulações e as cenas recuperadas entram depois do histórico, logo antes das instruções de turno do GM. As instruções e o histórico que vêm antes ficam iguais de um turno para o outro, então uma conexão com cache de prompt pode reutilizá-los. Quando uma cena termina, uma requisição não aproveita o cache.
- **Fonte.** As recapitulações seguem a história como você a vê: as suas edições de segmentos são aplicadas e as tags de comando do GM ficam de fora.
- **Sessões.** Uma sessão nova mantém as suas configurações, mas começa o próprio arquivo. O GM continua recebendo as recapitulações das sessões anteriores.
- **Modelo de decisão.** Opcional e desativado por padrão. Veja [Modelo de decisão opcional](#optional-decision-model). Ele acrescenta pequenas requisições a cada turno.
- **Custo.** O modelo auxiliar escreve uma recapitulação por cena e verifica se a cena mudou a cada poucos turnos. Essas requisições são pequenas em comparação com reenviar uma sessão longa.
- A prévia do prompt de um chat de Game ainda não mostra o Advanced Memory. Use o inspetor do prompt final.

## Solução de problemas

| Problema | Solução |
| --- | --- |
| O Memory Recall não recupera nada | Confira se há uma fonte de embeddings configurada. Se os blocos mostram **Embedding unavailable**, defina um modelo em **Semantic search (embeddings)** ou use o modelo embutido. Veja [Como configurar o Built-in model](../connections/local-model.md). |
| Os blocos mostram **Waiting for vector** | Dê tempo a eles. As impressões digitais são criadas depois das respostas. |
| Nada parece relacionado | A recuperação só acrescenta memórias bem relacionadas. Não acrescentar nada é normal. |
| A recuperação piorou depois de trocar de modelo de embeddings | Use o ícone de reconstruir em **Memories for This Chat**. |
| Os resumos não são gerados | O chat precisa de uma conta de texto que funcione. O Chat Summary usa o **Summary Provider**. Se nenhuma funcionar, a geração é pulada. |
| Os resumos da IA nunca aparecem | **Review Agent Outputs** pode estar esperando a sua aprovação. |
| Um resumo está travado | Resumos com falha são tentados de novo depois de um intervalo. Use **Backfill Summary** (Roleplay) ou **Backfill** (Conversation). |
| Uma cena está marcada com **Check who was there** | Pressione **Fix**, ou abra a cena em **Access memories for this chat** e use **Edit character access** (editar acesso dos personagens). |

Para outros problemas, veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

## Referência do Advanced Memory

Detalhes de que a maioria dos leitores não precisa. As configurações acima funcionam sem que você leia isto.

### Como as cenas são detectadas e resumidas

- A detecção de cenas roda depois que a resposta principal de Roleplay é salva. Quando chega o número de mensagens novas do intervalo, o verificador recebe todas as mensagens desde a última verificação (até o dobro do intervalo), a mensagem em que a última verificação terminou, as instruções de cena e o formato de saída. Ele retorna a mensagem exata que encerra cada cena, ou nenhuma quando a cena continua. Contam as mensagens de personas e de personagens.
- Com o modo de decisão desativado, uma verificação programada compartilha uma chamada elegível de tracker de pós-processamento quando a visibilidade e o orçamento de contexto permitem. Caso contrário, o auxiliar faz uma chamada própria. Transições incertas deixam a cena aberta.
- Só um final detectado dispara a preparação, em segundo plano, do resumo e do índice de mensagens daquela cena. **Chat Settings → Agent activity** (atividade dos agentes) mostra o progresso como **Advanced Recall**, mesmo com os agentes comuns desativados.
- Cada requisição de resumo de cena leva as instruções de resumo, as mensagens elegíveis da cena, as correções por intervalo aplicáveis e o formato de saída JSON. Cenas grandes demais para uma requisição são processadas em lotes salvos e depois combinadas. As recapitulações pedem de 2 a 3 parágrafos. O prompt padrão escreve uma recapitulação histórica, sem seção de situação atual. Prompts personalizados escolhidos em **Summaries** continuam valendo.
- A detecção inicial no histórico pode usar o modelo principal ou o auxiliar. Os resumos sempre usam o auxiliar.
- Cada resumo também registra quem participou. Um nome de participante diferente do card, como "Kaito" para **Kaito Nakamura**, conta quando corresponde a exatamente um personagem e não é o nome da sua persona. Nomes compartilhados, descrições como "Kaito's sister" e nomes com observações como "(mentioned)" não dão acesso. Quando o auxiliar não diz quem participou, a cena vai para todos os personagens e, em um chat em grupo, é marcada com **Check who was there**. Uma cena que lista só você continua restrita ao narrador. Cenas salvas antes de existir a verificação de participantes continuam restritas ao narrador até que **Fix** ou **Prepare existing history** as verifiquem. Cada resposta que encerra uma cena também verifica até três.
- Em um chat em grupo antigo em que os personagens respondem um de cada vez, confirme uma vez os intervalos de conhecimento que faltam. A primeira fala de um personagem não prova que ele sabia de tudo o que aconteceu antes. Escolha um personagem real como **Narrator** apenas se ele precisar ignorar os limites de participação. O **Hide from AI** global só remove um turno da transcrição atual. Advanced Memory continua analisando, resumindo e indexando esse turno. Os marcadores de início recortam a transcrição atual.

### A janela atual e o orçamento

- A prioridade no prompt é: constantes (resumos sempre ativos), depois os resumos das cenas selecionadas, depois as recordações dos personagens, depois os trechos de mensagens. As constantes têm como meta no máximo 70% do orçamento. A memória total pode usar até 2.000 tokens extras quando necessário, dentro do teto de contexto. As mensagens atuais não contam para a parcela das constantes.
- Quando o prompt de saída alcança o teto, a janela atual recomeça no início da cena mais recente para todos os personagens e depois volta a crescer. As requisições que vêm depois de uma chamada de função ou de uma rolagem não contam. O corte aparece em **Mark as new start** (marcar como novo início) com **All** (todos) selecionado. Desmarque All para desfazê-lo. As marcas de início pessoais continuam valendo. Se uma cena não encerrada ou uma constante grande demais não couber, a requisição usa trechos de origem marcados e mantém as mensagens mais recentes. Resumos e mensagens salvos nunca são sobrescritos.
- A geração principal lê a memória salva imediatamente. Ela nunca espera uma tarefa de continuidade.
- Depois da resposta principal, Advanced Memory acrescenta **Chat Summaries** para as mensagens arquivadas que nenhum resumo cobre ainda. Em um chat em grupo em que os personagens respondem um de cada vez, todos que leram uma cena compartilham um único resumo dela.
- Quando os resumos ativos que um personagem lê passam de 70% do orçamento, **Updating continuity** (atualizando a continuidade) os combina em um único resumo com cerca da metade do tamanho deles, depois da resposta, usando o auxiliar. A resposta nunca espera. Um resumo que ainda cobre mensagens atuais espera até que elas saiam da janela atual. Se o resumo combinado ainda passar da parcela, a próxima atualização o reduz à metade outra vez.
- Cada requisição contém apenas o seu **Combine prompt** (prompt de combinação), uma linha que pede cerca da metade do tamanho, e o texto do resumo. Quando o texto tem macros como `{{user}}`, essa linha também pede que elas sejam mantidas como foram escritas. Um texto longo demais para uma única requisição é enviado em partes, e cada parte é reduzida à metade. A resposta do auxiliar pode ter o tamanho do texto mais 1.024 tokens, até 8.196 tokens ou até **Chat Summary → Maximum output size**, se esse valor for maior.
- Resumos que personagens diferentes leem são combinados em um só, inclusive os que você escreveu. As partes privadas continuam nas seções `{{#if char == "Name"}}…{{/if}}`, para exatamente os personagens que as conheciam. O texto que cada grupo de personagens lê é encurtado em uma requisição própria, sem a condição dele, e volta para dentro dessa mesma condição. Os grupos seguem a ordem em que cada um aparece pela primeira vez. Uma parte com menos de 64 tokens fica como está, sem nenhuma requisição. Resumos que usam outras macros ficam como estão. Se só eles já preenchem a parcela de um personagem, encurte-os à mão ou aumente o orçamento. As entradas substituídas ficam inativas, então você pode reativá-las.
- Se a resposta do auxiliar for cortada ao atingir o limite, vier vazia, não for mais curta ou acrescentar uma macro, ou se o resultado mudar quem pode ler uma parte, os resumos ficam como estão e a atualização termina mesmo assim. Os mesmos resumos não são enviados de novo até que um deles mude, ou até que você mude o modelo auxiliar ou o **Combine prompt**. **Resume processing** tenta de novo uma atualização que parou com um erro.
- O prompt de um personagem só mostra o intervalo de mensagens e as datas de um resumo a partir das mensagens que esse personagem pode ver. O Narrator, quando responde sozinho, lê todas as partes uma única vez.

### O que a recuperação retorna

- Uma única seção **Recalled Scenes** (cenas recuperadas) contém cada resumo seguido do trecho dele, se houver, sob um único cabeçalho de intervalo. O bloco informa o intervalo atual do histórico e o número da última mensagem do usuário, para que os acontecimentos passados não sejam confundidos com o turno atual.
- Uma cena só é recuperada quando todas as mensagens de origem dela estão fora do histórico atual enviado. **Chat Summaries** por intervalo são omitidos enquanto qualquer mensagem coberta estiver no histórico atual. Eles continuam salvos e ativos. Constantes elegíveis têm prioridade sobre a recuperação opcional. Todos os resumos selecionados reservam espaço antes de qualquer trecho.
- Anexos de ilustração e legendas de imagens são omitidos do texto recuperado e das novas entradas de resumo. Anexos de texto legíveis permanecem.
- Com o modo de decisão desativado, a recuperação lê as memórias preparadas. O embedding da consulta tem um tempo limite curto, com a correspondência de texto como alternativa. A correspondência de texto dá mais peso aos termos distintos das suas mensagens desde a última vez que o personagem que responde falou. Um nome que elas mencionam conta mais. Os nomes dos personagens que respondem e o da sua persona não contam, nem um nome que aparece na maioria das memórias. Ela não acrescenta nenhuma chamada ao modelo.
- A recuperação só roda na geração principal de Roleplay. Chamadas de agentes, reexecuções manuais de agentes e execuções de teste não a acionam nem a recebem.
- Os swipes reutilizam a primeira memória compatível salva daquela resposta. Um swipe faz uma nova recuperação quando uma cena anterior que o personagem dele podia recuperar foi salva, editada, ativada ou desativada desde então. Continuar uma resposta mantém a memória com que ela começou. Mudanças no histórico, nas configurações de acesso, nos resumos ou nas memórias invalidam os instantâneos salvos.
- Editar, dar swipe, ocultar ou excluir mensagens de origem faz a memória afetada ser verificada de novo antes do uso. A regeneração histórica só usa fontes anteriores à mensagem alvo.
- O recibo de memória mostra o tamanho estimado do contexto, o limite escolhido e as fontes recuperadas. Quando nada foi recuperado, ele informa se não havia cenas anteriores, se não sobrou espaço ou se nada era relevante. A prévia do prompt usa a memória preparada e não inicia chamadas ao modelo. O inspetor do prompt final mostra o que foi para o modelo.
- Quando uma cena recuperada não tem trecho, o recibo diz o motivo: não sobrou espaço depois dos resumos ou nenhuma das mensagens dela pode ser citada.

### Access memories for this chat

Abra essa janela para buscar resumos de cena numerados, ver os períodos e os públicos deles, editar **Summary text** (texto do resumo) ou ler as mensagens originais com **Inspect source messages** (inspecionar mensagens de origem). Você pode desativar registros, usar **Reindex** (reindexar), exportar e importar, ou usar **Delete all memories** (excluir todas as memórias) para reiniciar a preparação mantendo o chat e as configurações. As correções de resumos manuais são mantidas e invalidam a continuidade que depende deles. **Delete summary** (excluir resumo), no final de um resumo, o remove depois que você confirma o resumo e o público. Também funciona para entradas antigas de **Continuity** (continuidade) e **Ongoing scene** (cena em andamento). A preparação de rotina não recria as recapitulações excluídas.

Para manter uma cena fora da recuperação, desative o registro de memória dela. A ocultação específica por personagem continua controlando quem pode acessá-la. A ocultação global não a remove do arquivo.

### Quem pode ler uma cena

- Um personagem presente em parte de uma cena compartilha o acesso à memória dela, mesmo quando algumas mensagens estão ocultas para ele. Uma cena sem mensagens de origem acessíveis fica indisponível. Mencionar um personagem ausente não o torna participante.
- As novas recapitulações marcam a visibilidade das mensagens, descrevem os eventos compartilhados em texto simples e usam `{{#if character == "Name"}}…{{/if}}` para as partes privadas. Se a visibilidade ou o personagem para quem uma recapitulação foi escrita mudar, a recapitulação antiga fica indisponível para leitores com acesso parcial até você preparar essa cena de novo (**Fix** faz isso em todas essas cenas) ou revisar e salvar as condições privadas dela. Um personagem que entra depois não conta, a menos que só parte da cena esteja visível para ele. Recapitulações antigas precisam de um **Fix** depois que um personagem entra. Leitores com acesso a todas as mensagens de origem ainda podem recuperá-la. O texto corrigido manualmente nunca é reescrito silenciosamente.
- As datas da cena são compartilhadas por todos os participantes atribuídos. Os trechos originais nunca incluem mensagens ocultas para o personagem nem sussurros. Um resumo com partes só para alguns personagens ainda recebe um trecho, que cita apenas o que aquele personagem viu. Para manter uma mensagem fora da memória de um personagem, oculte-a dele.
- Em um chat em grupo mesclado, a recuperação inclui o que pelo menos um personagem lembra. Uma cena ou parte privada que nem todos os personagens conhecem é marcada, por exemplo "known only to Kaito". Um trecho cita apenas as mensagens que todos os personagens que lembram a cena viram. Memórias que nenhum personagem lembra, como cenas restritas ao narrador, ficam de fora. Em chats em grupo em que os personagens respondem um de cada vez, cada personagem recupera apenas as próprias.

<a id="how-decision-recall-works"></a>

### Como funciona a recuperação por decisão

- A recuperação normal primeiro pré-seleciona até 24 recapitulações de cena, ou o valor de **Maximum recalled scenes**, se for maior. A pré-seleção combina a correspondência de texto e os embeddings. Os embeddings comparam cada cena com até seis das suas mensagens desde a última vez que o personagem que responde falou. A primeira resposta usa a sua mensagem mais recente. Até que quase todas as cenas tenham embeddings, a pré-seleção usa a classificação da recuperação normal. A cena logo depois de cada uma das três melhores também ganha uma vaga.
- Cada recapitulação que o modelo avalia começa com uma linha: o intervalo de mensagens, a data na história e quem falou. O modelo escolhe as cenas relevantes e depois avalia até 12 das mensagens originais de melhor correspondência de cada cena escolhida, para escolher o trecho dela. A melhor escolha fica no centro, e as outras estendem o trecho até **Maximum messages per excerpt** (máximo de mensagens por trecho).
- A cada nova mensagem, o modelo também verifica se a história passa para outro lugar ou outro momento, muda para personagens que estão em outro lugar ou vem depois de uma linha de quebra de cena. Ele vê as três mensagens anteriores e quem as escreveu. Limites incertos deixam a cena aberta. Uma decisão válida pode não selecionar nada.
- Limites de tempo: cada etapa recebe mais ou menos o que o modelo precisa por pergunta, vezes o número de perguntas, mais a metade disso, no mínimo 10 e no máximo 25 segundos. As duas etapas juntas recebem no máximo 40 segundos por resposta. Quando um modelo não consegue responder a todas as perguntas, ele avalia menos, começando pelas melhores correspondências. As requisições são curtas, então as respostas que chegam a tempo continuam valendo. Enquanto isso, a resposta mostra o texto provisório de sempre, **Thinking…** (pensando).
- Quando uma requisição falha, esgota o tempo limite ou é grande demais, só essas memórias recorrem à recuperação normal, depois das cenas que o modelo escolheu, e o recibo informa isso. Uma conexão ausente ou uma etapa sem nenhuma resposta recorre por completo à classificação da pré-seleção e à correspondência de texto. Decisões de cena indisponíveis recorrem à verificação de cena padrão.
- Os embeddings também são criados neste modo. Uma cena recém-resumida os recebe na hora. As cenas mais antigas e as criadas com outro modelo de embeddings os recebem depois das respostas, algumas de cada vez. **Reindex** cria todos de uma vez.
- **Peek Prompt → Decision diagnostics → Advanced Memory activity** (Peek Prompt → diagnóstico de decisões → atividade do Advanced Memory) mostra os resultados salvos da última recuperação e da última verificação de cena: modelo, tempo, pontuações, memórias ou inícios de cena selecionados, estado do mecanismo alternativo e o motivo de uma cena não ter trecho. Ele guarda até 128 resultados. Eles representam atividade passada, não previsões. Abrir o painel não executa as decisões de novo. Os swipes compatíveis reutilizam as seleções salvas. Uma continuação escolhe as memórias de novo.
- As contas de decisão hospedadas recebem lotes limitados pelo orçamento de contexto delas. Os modelos Open-Jev gerenciados usam o tempo medido por pergunta, e uma conta de decisão responde às perguntas de uma requisição todas juntas, então conta cada requisição uma vez só.

### Posicionamento no preset

Os autores de presets podem posicionar estes marcadores de conteúdo com os controles de sempre de ordem das seções, nome, papel e grupo:

| Marcador | Conteúdo |
| --- | --- |
| `chat_summary` | Entradas constantes elegíveis dos Chat Summaries. |
| `current_scene_summary` | Trechos de origem da parte mais antiga de uma cena em andamento. |
| `recalled_scenes` | Todos os resumos de cenas selecionados, cada um seguido do trecho dele. |

Cada um segue o formato **XML**, **Markdown** ou **None** do preset. Componentes vazios não emitem nada. O primeiro marcador ativado determina a posição. Componentes sem um marcador ativado aparecem uma vez antes do histórico, então presets antigos continuam funcionando. O seletor de presets oferece só **Recalled Scenes**. Um marcador antigo `recalled_messages` é um alias, e um marcador `recalled_scenes` ativado tem prioridade. Esses marcadores ficam vazios com o Advanced Memory desativado.

### Limites

A recuperação é seletiva, e os resumos podem perder nuances. Guarde as correções importantes na transcrição de origem ou no editor de resumos. Se os embeddings falharem, a recuperação limitada por texto e a continuidade válida continuam disponíveis. O arquivo nunca é inserido inteiro. Se as instruções ou um anexo não couberem no teto, reduza-os ou aumente o teto. Se a reserva de resposta não couber no contexto total do modelo, reduza o tamanho da saída ou escolha um modelo com contexto maior. Advanced Memory para em vez de excluir instruções silenciosamente.

O modo avançado assume a recuperação enquanto está ativado, então o Standard Recall não insere uma segunda cópia. Ele também substitui, nesse chat, a programação normal de resumos automáticos de Roleplay. Desativá-lo restaura as configurações normais. Lorebooks existentes e agentes baixáveis mantêm as próprias regras de escopo.

## Guias relacionados

- [Como configurar o Built-in model](../connections/local-model.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Conversation Mode: primeiros passos](../conversation/getting-started.md)
- [Roleplay Mode: primeiros passos](../roleplay/getting-started.md)
- [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md)
