# Modelos de decisão

Um modelo de decisão é um modelo pequeno que responde a perguntas de sim ou não para Marinara, como "Does the latest message move the scene to a new place?". Lorebooks, agentes personalizados, prompts e chats em grupo o usam. Ele é opcional. Sem um, os chats continuam funcionando e cada recurso usa o comportamento alternativo descrito em [Onde Marinara o usa](#where-marinara-uses-it).

As respostas dele controlam o que Marinara faz e nunca são publicadas no chat. Ele dá a uma declaração uma pontuação de 0 a 1. Marinara compara esse número com um limiar e trata o resultado como sim ou não. Ele também pode escolher uma resposta em uma lista curta, como "angry", "sad" ou "none of these".

Nossa recomendação: deixe em **None** (nenhum) se estiver em dúvida. Se quiser decisões, use o modelo embutido que você talvez já tenha, ou um modelo de chat em um servidor que você já executa. Nenhum dos dois custa nada a mais.

## Escolher um modelo de decisão

Antes de começar, veja [Qual escolher](#which-one-to-pick).

1. Clique em **Connections** (Conexões) na barra superior e abra a caixa **Jobs** (tarefas).
2. Em **Behind the scenes** (nos bastidores), clique na linha **Decision** (decisão). Uma lista se abre.
3. Escolha um modelo. A lista tem três grupos:
   - **None (decisions off)** (nenhum: decisões desligadas) é o padrão. Nada é perguntado, e os campos de perguntas de ativação no editor de agentes ficam desativados.
   - **Built-in model** (modelo embutido) lista os modelos que Marinara roda no seu computador: **Built-in model**, **Built-in model (utility)** e **Built-in model (decisions)**. Nada sai do seu computador.
   - **Connections** lista as suas contas que podem responder decisões: hospedadas, ou um modelo de chat em um servidor que você já executa.
4. Para testá-lo, clique na engrenagem **Decision settings** (configurações de decisão) da linha e clique em **Test** (testar). Esse botão aparece nas opções do modelo embutido. Para uma conta TypeSafe ou OpenRouter, abra **Edit model** (editar modelo) no modelo dela e clique em **Test provider** (testar provedor). Para uma conta **Own decision server** (servidor de decisão próprio), use **Test** no menu **⋯** da conta.

Um teste bem-sucedido mostra a probabilidade de sim e quanto tempo a resposta levou. Para um modelo no seu computador, ele também informa se havia log-probabilidades disponíveis e se o modelo responde diretamente. Log-probabilidades são os números de confiança do modelo para cada palavra que ele poderia escrever. O teste envia uma amostra fixa, não o seu chat.

Se não funcionar, a mensagem diz por quê. Causas comuns: a chave foi recusada, o serviço está limitando as solicitações, o modelo embutido não está rodando ou a resposta passou do tempo limite. Veja [Solução de problemas](#troubleshooting).

As opções que não podem responder agora continuam na lista, em cinza, com o motivo. Escolher **None** desativa as decisões sem excluir nenhuma pergunta de ativação nem declaração de decisão.

<a id="which-one-to-pick"></a>

### Qual escolher

- **Um modelo que você já roda no modelo embutido.** Não custa nada a mais. É a melhor opção para a maioria de quem usa o modelo embutido.
- **Um modelo de chat no seu próprio servidor** (Ollama, LM Studio, llama.cpp ou outro servidor compatível com OpenAI). Não custa nada a mais. Boa opção quando o seu modelo roda fora do Marinara, para que ele não seja carregado duas vezes.
- **Uma conta Decision hospedada** (chave da TypeSafe ou do OpenRouter). Cobrada por solicitação, e um turno pode fazer várias. Boa opção para celulares e computadores que não rodam um modelo local.
- **O modelo de decisão embutido.** Usa espaço em disco e memória da GPU separados. Precisa de Linux x86-64 e de uma GPU NVIDIA compatível. Para ter um modelo de decisão separado, ao lado do seu modelo de chat.

Se você já roda um modelo local, experimente-o primeiro e teste turnos dos seus próprios chats. A redação faz muita diferença. Veja [Escrever declarações](../prompts/conditional-prompts.md#writing-statements).

Jev e Open-Jev são modelos diferentes. Jev é o modelo hospedado da TypeSafe, disponível diretamente ou pelo OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) é um modelo publicado separadamente, baseado em Qwen, que Marinara pode rodar localmente. Os testes do Open-Jev não medem o Jev hospedado.

No Android (Termux), o **Built-in decision model** (modelo de decisão embutido) não pode rodar, e um modelo local pequeno no processador do celular pode ser lento demais. Uma conta hospedada é a escolha prática, por exemplo Jev pelo OpenRouter. Veja [Configurar uma conexão Decision](#set-up-a-decision-connection).

Escreva presets, cards e agentes para "um modelo de decisão", nunca "exige Jev". Eles usam a mesma sintaxe de declarações com qualquer modelo, mas os modelos podem dar respostas diferentes. Quando você importa conteúdo que usa decisões, inclusive agentes personalizados e instalações do Agent Organizer, Marinara mostra um aviso com um link para esta página. Restaurar um ZIP de perfil completo não mostra esse aviso.

## Usar o modelo embutido

Se você baixou o modelo embutido, pode usá-lo para decisões sem conta e sem custo. Veja [Como configurar o Built-in model](local-model.md).

1. Clique na linha **Decision**, em **Behind the scenes**, na caixa **Jobs**.
2. Escolha **Built-in model** (ou **Built-in model (utility)**, se você tiver um).
3. Clique na engrenagem **Decision settings** e depois em **Test**.

Marinara faz uma única pergunta de sim ou não ao modelo, deixa que ele escreva um token e lê a resposta nas probabilidades desse token. Nenhuma resposta é escrita, então a solicitação é curta. Uma escolha entre várias respostas vira uma pergunta de sim ou não por resposta.

A configuração **Thinking** (raciocínio) controla o que acontece quando um modelo não consegue responder em uma palavra. Alguns modelos sempre raciocinam antes.

| Thinking | O que faz |
| --- | --- |
| **Auto (try one word, allow thinking if the model cannot)** (automático: tentar uma palavra e permitir raciocínio se o modelo não conseguir) | Padrão. Depois de duas respostas de uma palavra malsucedidas seguidas, o modelo pode raciocinar antes, e Marinara avisa você. |
| **Off (always answer in one word)** (desativado: sempre responder em uma palavra) | Um modelo que não consegue responder em uma palavra não fornece resposta. |
| **Allowed (let the model think first)** (permitido: deixar o modelo raciocinar antes) | Nunca pede ao modelo para pular o raciocínio. |

Um modelo que raciocina antes leva segundos; por isso, por padrão, ele só responde nas verificações que rodam depois que a resposta aparece na tela, como as de agentes de pós-processamento. Para que ele também avalie os agentes que rodam antes da resposta, ative **Also gate agents that run before the reply** (avaliar também os agentes que rodam antes da resposta). Assim, cada resposta passa a esperar por ele.

As probabilidades de sim ou não de um modelo de chat geral funcionam com um limiar, mas não foram treinadas para ser calibradas como as de um modelo criado para decisões. Um ambiente de execução que não retorna log-probabilidades responde com 1 ou 0 fixos. Ajuste os limiares com os seus próprios chats.

<a id="on-a-server-you-already-run"></a>

### Em um servidor que você já executa

Se o seu modelo de chat roda no Ollama, LM Studio, llama.cpp ou outro servidor compatível com OpenAI, ele pode responder decisões sem que Marinara carregue uma segunda cópia.

1. Clique em **⋯** nesse modelo, no painel **Connections**, e escolha **Use this model for decisions** (usar este modelo para decisões). A janela **Add account** (adicionar conta) abre na etapa de decisão, com o mesmo endereço, modelo e chave.
2. Escolha o modelo e clique em **Test decision** (testar decisão). Um teste bem-sucedido informa se o servidor retornou log-probabilidades e se o modelo precisou raciocinar antes. Clique em **Done** (concluir).
3. Clique na linha **Decision**, em **Behind the scenes**, e escolha o modelo novo.

Você também pode criá-lo por conta própria. Use uma conta Decision com a fonte **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)** (modelo de chat compatível com OpenAI), o mesmo endereço da sua conta de chat (por exemplo, `http://localhost:11434/v1` para Ollama) e o nome do modelo que o servidor usa.

Ele é consultado como o modelo embutido: uma palavra de sim ou não por declaração. As declarações vão uma por vez, porque Marinara não tem como saber quantas solicitações o seu servidor processa ao mesmo tempo. **Thinking** é sempre **Auto** para uma conta. Um servidor em outro computador precisa de `PROVIDER_LOCAL_URLS_ENABLED`. Veja [Conectar um modelo local ou auto-hospedado](local-self-hosted.md).

<a id="set-up-a-decision-connection"></a>

## Configurar uma conexão Decision

Uma conta Decision hospedada envia ao serviço as mensagens recentes selecionadas e as declarações, e pode gerar cobranças. A ordem de resposta Smart também envia uma [lista de personagens](#what-the-model-sees).

1. Clique em **Connections** na barra superior e depois em **Add** (adicionar).
2. Em **Decisions** (decisões), clique em **TypeSafe** ou **Own decision server**. Para o OpenRouter, clique em **OpenRouter** em **Chat**, conecte a conta e use **Use this key for decisions** (usar esta chave para decisões) no menu **⋯** do modelo.
3. Informe a **API key** (chave de API) ou, para **Own decision server**, o **Server address** (endereço do servidor). Clique em **Connect** (conectar). A janela fecha e o painel mostra a conta nova.
4. Clique na linha **Decision**, em **Behind the scenes**, e escolha o modelo novo.
5. Para testá-lo, clique no modelo no painel para abrir **Edit model** e depois clique em **Test provider** no cartão **Provider tests** (testes do provedor). Um modelo de **Own decision server** não tem o botão **Test provider** ali. Em vez disso, abra o menu **⋯** da conta no painel e clique em **Test**.

Um **Test provider** bem-sucedido mostra a probabilidade, quanto tempo a resposta levou e o tempo limite da conta. O **Test** da conta, no menu **⋯**, só informa se funcionou e quanto tempo levou. O teste espera pelo menos 10 segundos, ou 5 segundos além de um limite maior. Se a resposta demorar mais que o limite, o resultado avisa: nos chats, essa resposta contaria como ausência de resposta.

Se não funcionar, veja [Solução de problemas](#troubleshooting).

O editor de Decision (**Edit model** em um modelo de decisão) tem estes campos:

| Campo | O que faz |
| --- | --- |
| **Decision source** (fonte de decisão) | **TypeSafe**, **OpenRouter**, **Custom System One endpoint** (endpoint System One personalizado) ou **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**. Ela fica fixa a partir da criação do modelo. |
| **API key source** (origem da chave de API) | **Enter a separate key (optional for local servers)** (informar uma chave separada: opcional para servidores locais) ou **Use key from …** (usar a chave de) outra conta. As chaves vinculadas acompanham as alterações posteriores da chave. Um modelo System One personalizado ou compatível com OpenAI só pode emprestar a chave de uma conta de chat personalizada quando os dois endereços têm o mesmo esquema, host e porta. |
| **Recent-message token budget** (orçamento de tokens de mensagens recentes) | Quantos tokens estimados do chat enviar. De 1 a 30.000. Padrão de 30.000 para TypeSafe e OpenRouter, e de 3.500 para servidores personalizados. Marinara descarta primeiro as mensagens mais antigas e depois corta a parte mais antiga da mensagem mais recente. Uma solicitação recusada ou acima do orçamento não fornece resposta. |
| **Time limit (seconds)** (limite de tempo em segundos) | Quanto tempo esperar por cada declaração durante os chats. De 0,5 a 30. Padrão de 1,5, ou 4 para um modelo de chat compatível com OpenAI. Veja [Tempos limite](#time-limits). |

TypeSafe envia para `https://api.typesafe.ai`. Você pode trocar a **Base URL** (URL base) dela pelo endereço de outro servidor que execute a API da TypeSafe, sem `/v1/systemone`. A chave da TypeSafe continua necessária e é enviada a esse servidor. **Custom System One endpoint** aceita um servidor System One que você executa, como Open-Jev ou [Strands decider](#run-strands-decider-yourself). Informe o endereço dele sem `/v1/systemone`. Um servidor de modelos de chat como o Ollama não fala System One. Para ele, use **OpenAI-compatible chat model**.

Alguns serviços hospedados às vezes levam mais de 1,5 segundo para responder, o que faz as decisões parecerem falhar ao acaso. Teste algumas vezes e defina o limite acima da resposta mais lenta. As declarações feitas antes da resposta, como as decisões de um preset ou a pergunta de ativação de um agente que roda antes da resposta, podem atrasar a resposta por até esse tempo cada uma.

Excluir uma conta cuja chave é usada para decisões mostra um aviso. A conta Decision passa a precisar de um novo vínculo e, até lá, as decisões não fornecem resposta. Arquivos de conexão importados nunca contêm chaves de API nem vínculos com contas emprestadas, então restaure-os manualmente.

<a id="where-marinara-uses-it"></a>

## Onde Marinara o usa

- As [perguntas de ativação](../agents/custom-agents.md#activation-questions) decidem se um agente personalizado roda. Sem resposta: a pergunta não o impede. As palavras-chave e a **Trigger Cadence** (cadência de ativação) continuam valendo.
- As [declarações em prompts](../prompts/conditional-prompts.md#asking-the-decision-model) escolhem texto quando o prompt de um chat ou agente é montado. Sem resposta: a decisão vale não; assim, um bloco de decisão usa o seu ramo `{{else}}`, se houver.
- Os [campos Decision de lorebooks](../lorebooks/entries.md#decision-activation) verificam Require ou Trigger durante a análise dos lorebooks. Sem resposta: Require não pode admitir uma nova entrada e Trigger não acrescenta nenhuma via. As retenções Sticky e as vias normais de Trigger continuam valendo.
- A [ordem de resposta Smart](../chats/group-chats.md#response-order-individual-only) pontua quem fala em seguida em um chat em grupo, se estiver ativada. Sem resposta: a ordem Smart faz a chamada normal à IA.
- [Automate active characters](../chats/group-chats.md#automate-active-characters-merged-only) pergunta quem está na cena antes de cada resposta em um grupo de Roleplay no modo Merged, se estiver definido como **Decision model** (modelo de decisão). Sem resposta: se nenhum personagem receber resposta, usa a última cena do Character Tracker ou mantém a lista.
- O [Advanced Memory Recall](../agents/memory.md#optional-decision-model) pode usar um modelo de decisão próprio para os limites de cena e a seleção de memórias em Roleplay. Ative **Use Decision model** (usar modelo de decisão) nas configurações de Advanced Memory desse chat. Sem resposta: as decisões que falham recorrem à recuperação normal ou às verificações de cena normais. Os resumos continuam usando o modelo auxiliar.

Uma pergunta de ativação decide se um agente roda. Uma declaração de decisão dentro do prompt dele decide o que esse agente recebe ao rodar. Use `{{#if decision:"..."}}` para condições de sim ou não e `{{#if decision_choice:"..." == "..."}}` para uma escolha entre respostas.

<a id="what-the-model-sees"></a>

## O que o modelo vê

Nas perguntas de ativação e nas declarações de prompts e lorebooks, o modelo recebe a declaração e as mensagens recentes como foram salvas no chat. Ele não recebe o seu preset, card de personagem, persona, entradas de lorebook (nem as Constant), resumos ou resultados de agentes. Textos colocados entre mensagens, como uma entrada definida como **@ Depth** (em uma profundidade), também ficam de fora. Uma declaração que depende de um desses itens precisa informar o próprio fato.

- As declarações de prompts e lorebooks, a ordem de resposta Smart e Automate active characters leem as últimas 5 mensagens. Esse número é fixo.
- As perguntas de ativação leem a **Scan Depth** (profundidade de varredura) do agente, 5 por padrão.
- Cada mensagem leva o nome de quem fala. Mensagens ocultas da IA ficam de fora.
- Uma verificação que roda depois da resposta, como a pergunta de um agente de pós-processamento, também vê a resposta que foi escrita.
- As macros da declaração são preenchidas primeiro; assim, `{{char}}` chega como o nome do personagem.
- Quando as mensagens não cabem no orçamento do modelo, as mais antigas são descartadas primeiro.

A **ordem de resposta Smart** também envia uma lista de personagens: nome, status, atividade e sociabilidade de cada candidato, quando conhecidos, além de até 300 caracteres da personalidade ou, se estiver vazia, da descrição.

**Automate active characters** também envia uma lista de personagens: o nome de cada personagem e até 300 caracteres da descrição ou, se estiver vazia, da personalidade, reduzidos a 100 caracteres ou só aos nomes quando um elenco grande não cabe, além dos nomes que o Character Tracker viu por último. Se mesmo só com os nomes sobrar pouco espaço para as mensagens, o modelo não é consultado e o Character Tracker assume. As respostas em um grupo Merged são rotuladas como "the narrator", já que uma única resposta dá voz a todos.

Um serviço de decisão hospedado recebe essas listas junto com as mensagens.

**Advanced Memory** usa um modelo de decisão próprio por chat, e não a regra das últimas 5 mensagens. As verificações de cena leem a janela relevante do histórico. A recuperação envia o texto da conversa recente e até 24 resumos arquivados pré-selecionados, ou mais, se **Maximum recalled scenes** (máximo de cenas recuperadas) for maior, e depois as mensagens originais das cenas que o modelo escolheu, após as verificações de acesso dos personagens. Os serviços hospedados recebem esses textos, às vezes em vários lotes. Cada etapa da recuperação normalmente recebe de 10 a 25 segundos, de acordo com a velocidade do modelo. As duas etapas dividem 40 segundos por resposta, então uma etapa pode receber menos de 10 segundos. As memórias sem resposta a tempo recorrem à recuperação normal. Veja [Modelo de decisão opcional](../agents/memory.md#optional-decision-model).

<a id="thresholds"></a>

## Limiares

As probabilidades não são comparáveis entre modelos. O mesmo exemplo pode pontuar 0,99 em um e 0,2 em outro. O limiar padrão de sim ou não depende do modelo:

- **Modelo embutido ou conta de modelo de chat compatível com OpenAI:** 0,5
- **Conta TypeSafe, OpenRouter ou Custom System One:** 0,5
- **Modelo de decisão embutido:** a recomendação do manifesto do modelo: 0,1 para Open-Jev 2B e 9B

O ajuste **Run when probability is at least** (rodar quando a probabilidade for pelo menos) de um agente substitui esse padrão. O editor oferece restaurar a recomendação do modelo quando o valor salvo é diferente. Confira esse ajuste sempre que trocar de modelo. As declarações em prompts e os campos Decision de lorebooks usam o padrão do modelo, e o limiar de um agente não muda o deles.

Um Open-Jev hospedado por você em uma conta Custom System One continua usando 0,5, porque Marinara não consegue calibrar endpoints personalizados arbitrários. Os resultados dele podem diferir dos do Open-Jev embutido, inclusive tratando como não um resultado positivo abaixo de 0,5.

<a id="time-limits"></a>

## Tempos limite

Uma decisão que não chega a tempo não fornece resposta, e a geração continua com o comportamento alternativo do recurso (veja [Onde Marinara o usa](#where-marinara-uses-it)). Todo limite é por declaração. Uma solicitação com várias declarações recebe o limite para cada uma, e cada resposta Choice conta como uma declaração. Um modelo local processa só algumas solicitações por vez; por isso, as declarações aguardam a sua vez, e o tempo de uma declaração começa quando o modelo começa a processá-la.

- **Conta TypeSafe, OpenRouter ou Custom System One:** 1,5 segundo, ou o seu **Time limit**
- **Conta de modelo de chat compatível com OpenAI:** 4 segundos, ou o seu **Time limit**. Um modelo que precisa raciocinar antes recebe pelo menos 20 segundos.
- **Modelo embutido:** 4 segundos. Um modelo que precisa raciocinar antes recebe 20 segundos.
- **Modelo de decisão embutido:** 4 segundos para a primeira declaração. Cada uma das seguintes recebe o tempo medido do modelo: 0,35 segundo para Open-Jev 2B e 0,8 segundo para Open-Jev 9B. Um modelo que você instalou a partir de um repositório recebe 4 segundos para cada uma.

As solicitações de decisão param quando você cancela uma geração.

## Outras configurações

Estas ficam na engrenagem **Decision settings**:

- **Also use it to pick who speaks in Smart response order** (usar também para escolher quem fala na ordem Smart) vem desativada por padrão. Veja [Chats em grupo](../chats/group-chats.md#response-order-individual-only).
- **Decision statements per turn** (declarações de decisão por turno) limita o planejamento das declarações de prompts e lorebooks. Padrão de 32, até 255. Essa cota se aplica em várias etapas e não é um limite único para todas as solicitações ou gastos de um turno. As perguntas de ativação de agentes e a ordem de resposta Smart são separadas. Veja [Limites e custo](../prompts/conditional-prompts.md#limits-and-cost).
- **Also gate agents that run before the reply** e **Thinking** aparecem nas opções do modelo embutido que podem raciocinar. O **Built-in decision model** nunca raciocina, então não tem nenhuma das duas.

## Prepare-se para respostas erradas

Qualquer modelo pode responder errado, e respostas sim corretas podem ficar perto do limiar.

- Use uma decisão para refinar uma resposta, nunca para algo indispensável ao chat. Uma decisão perdida deve deixar a resposta menos adaptada, não quebrá-la.
- Não condicione consentimento, avisos de conteúdo ou instruções de segurança a uma decisão.
- Para um agente que só roda por pergunta de ativação, configure **Bypass the question after this many messages** (ignorar a pergunta após este número de mensagens), para impedir que um modelo que sempre responde não o silencie para sempre.

<a id="troubleshooting"></a>

## Solução de problemas

- **O teste falha.** A mensagem diz por quê: a chave foi recusada, o serviço está limitando as solicitações, o modelo embutido não está rodando, o modelo de decisão não está instalado, o modelo não respondeu sim ou não, ou o tempo acabou.
- **O servidor não tem esse endpoint.** A fonte Decision não corresponde ao servidor. Ollama, LM Studio e outros servidores de modelos de chat precisam de **OpenAI-compatible chat model**. **Custom System One endpoint** serve só para servidores System One, como Open-Jev.
- **A resposta passou do tempo limite, ou as decisões só funcionam às vezes.** O serviço às vezes é mais lento que o **Time limit**. Teste algumas vezes e aumente o limite para acima da resposta mais lenta.
- **Um agente com pergunta de ativação roda em todo turno.** Nenhum modelo de decisão está definido, ou ele não está respondendo; por isso, o agente roda como se não tivesse pergunta. Faça um teste.
- **Um ramo de decisão em um prompt nunca aparece.** Veja [Quando um ramo de decisão nunca aparece](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **A ordem de resposta Smart continua fazendo a chamada normal à IA.** O controle está desligado, ou o modelo de decisão não respondeu naquele turno.
- **Automate active characters segue o Character Tracker.** O modelo não respondeu para todos os personagens, ele raciocina antes e **Also gate agents that run before the reply** está desativada, ou o elenco é grande demais para a entrada do modelo, mesmo só com os nomes.

Para ver as pontuações e as saídas das decisões durante a geração, ative o Debug Mode ou defina o nível de log como debug. Veja [Níveis de log](../CONFIGURATION.md#logging-levels). Para testar as suas próprias declarações sem gerar uma resposta, abra **Peek Prompt → Decision diagnostics → Test decisions** (Peek Prompt → diagnóstico de decisões → testar decisões). Os testes explícitos chamam o modelo selecionado e podem gerar cobranças em um serviço hospedado. Veja [Como testar declarações de decisão](../chats/peek-prompt.md#testing-decision-statements).

<a id="let-marinara-install-a-decision-model"></a>

## Deixar Marinara instalar um modelo de decisão

O **Built-in decision model** é um modelo de decisão experimental, criado para decisões, que Marinara baixa e roda como um processo local próprio, ao lado do seu modelo de chat. O uso de memória dele se soma ao do seu modelo de chat. Se você já tem um modelo local, experimente as decisões dele primeiro.

Os modelos Open-Jev precisam de Linux **x86-64**, de uma GPU NVIDIA com capacidade de computação 7.5 ou superior (Turing, série RTX 20 ou posterior) e de driver 580 ou superior. Linux ARM e placas mais antigas não têm suporte. Quando um modelo não pode rodar, a opção continua visível, informa o motivo e oferece **Set up a Decision provider instead** (configurar um provedor de decisão em vez disso).

| Modelo | Download do modelo | Disco com ambiente de execução | Memória da GPU |
| --- | --- | --- | --- |
| Open-Jev 2B | Cerca de 4,6 GB | Cerca de 10 GB | Cerca de 4,8 GB (4,5 GiB) |
| Open-Jev 9B | Cerca de 19,4 GB | Cerca de 25,3 GB | Cerca de 23,6 GB (22 GiB) |

São estimativas do catálogo. O modelo 9B deixa pouca margem em uma GPU de 24 GB. Confira o parecer do instalador para a sua placa.

1. Clique em **Add** no painel **Connections** e clique em **Built-in model (decisions)** em **Decisions**. Abre-se uma janela com o título **Built-in decision model**. Você também pode abri-la pela página do card **Built-in model**.
2. Leia o aviso e ative **Use the built-in decision model** (usar o modelo de decisão embutido). Uma caixa de diálogo com o título **Turn on the built-in decision model?** (ativar o modelo de decisão embutido?) mostra o parecer para o seu computador. Clique em **Enable** (ativar), ou em **Enable anyway** (ativar mesmo assim) quando o parecer for um aviso.
3. Em **Available decision models** (modelos de decisão disponíveis), escolha **Open-Jev 2B** ou **Open-Jev 9B**. Clique em **Download and install** (baixar e instalar) e confirme o tamanho, o parecer do hardware e as licenças. Nada é baixado antes disso.
4. Clique na linha **Decision**, em **Behind the scenes**, e escolha **Built-in model (decisions)**.

Outros controles da janela:

- **Install from a repository** (instalar de um repositório) aceita um modelo de decisão do HuggingFace no formato `owner/model-name`. Clique em **Check** (verificar). Marinara lê o manifesto do próprio repositório, verifica se ele corresponde a um ambiente de execução incluído nesta compilação e mostra os pesos base e o tamanho total. Um repositório que Marinara não pode garantir é recusado com o motivo. Depois, clique em **Download and install this one** (baixar e instalar este).
- **GPU** escolhe a placa em um computador com várias GPUs NVIDIA. Trocar a placa interrompe o modelo, que inicia de novo na placa nova.
- **Start this model when Marinara starts** (iniciar este modelo quando Marinara iniciar) é opcional. Com essa opção desativada, o modelo inicia na primeira vez que um agente precisar dele.
- **Remove files** (remover arquivos) exclui o modelo e o ambiente de execução dele. Desativar o modelo para o processo e mantém os arquivos.

A primeira resposta de um modelo depois que ele inicia é mais lenta; por isso, Marinara faz uma pergunta de aquecimento enquanto ele carrega. Se ela falhar, o modelo inicia mesmo assim e a primeira pergunta real absorve o atraso. Um turno com muitas declarações em um chat longo demora mais. Em um chat longo, Open-Jev 2B leva cerca de um quarto de segundo por declaração.

<a id="run-strands-decider-yourself"></a>

### Como executar Strands decider por conta própria

[Strands decider 2B](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19) é outro modelo de decisão aberto (Apache-2.0) que usa System One. Marinara não pode instalá-lo, mas ele funciona como **Custom System One endpoint** enquanto você o mantém em execução.

1. Em um ambiente com Python 3.10 ou mais recente, instale o modelo e inicie o servidor:

   ```bash
   pip install strands-decider
   strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
   ```

   Ele usa uma GPU NVIDIA ou Apple silicon quando encontra um deles; caso contrário, usa o processador, com menor velocidade. A primeira inicialização baixa o modelo e cerca de 4,6 GB de pesos base, e seus pacotes Python ocupam cerca de 5,5 GB. O servidor não tem senha, então mantenha-o em `127.0.0.1`.

2. Adicione uma conta **Own decision server** com o **Server address** `http://127.0.0.1:8000`. Qualquer nome de modelo funciona.
3. Escolha-a na linha **Decision** e teste-a com **Test**, no menu **⋯** da conta. A primeira resposta depois que ele inicia leva cerca de 2 segundos, mais que o tempo limite padrão; por isso, teste uma vez antes de conversar.

As probabilidades dele são calibradas; por isso, o limiar padrão de 0,5 é adequado, ao contrário de um Open-Jev auto-hospedado (veja [Limiares](#thresholds)). As respostas dele dependem da redação, então siga [Escrever declarações](../prompts/conditional-prompts.md#writing-statements).

## Guias relacionados

- [Como criar agentes personalizados](../agents/custom-agents.md)
- [Prompts condicionais](../prompts/conditional-prompts.md)
- [Chats em grupo](../chats/group-chats.md)
- [Como configurar o Built-in model](local-model.md)
- [Conectando a um provedor de IA](connecting-to-a-provider.md)
