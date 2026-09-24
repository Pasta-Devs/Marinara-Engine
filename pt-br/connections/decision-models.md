# Modelos de decisão

Este guia explica **Decision model** (modelo de decisão): o que é, as três formas de obter um, como configurar cada opção e onde Marinara o usa. Ele é opcional. Sem um modelo, os chats continuam gerando respostas, mas cada recurso usa o comportamento alternativo descrito abaixo.

## O que é um modelo de decisão

Um modelo de decisão responde a um tipo de pergunta. Ele recebe as mensagens recentes de um chat e uma declaração, como "The latest message moves the scene to a new place", e informa a probabilidade de ela ser verdadeira com um número de 0 a 1. Marinara compara esse número com um limiar e trata o resultado como sim ou não. Ele também pode escolher uma resposta em uma lista curta, como "angry", "sad" ou "none of these".

As respostas controlam o comportamento do Marinara; elas não são publicadas como respostas no chat. Um modelo criado para decisões pontua as declarações diretamente. Um modelo de chat local normalmente recebe um pedido de um único token de sim/não, embora alguns modelos precisem raciocinar antes. As decisões podem ser mais rápidas que uma resposta completa, mas muitas declarações ou um modelo que raciocina podem acrescentar um tempo perceptível.

<a id="where-marinara-uses-it"></a>

## Onde Marinara o usa

- **[Perguntas de ativação](../agents/custom-agents.md#activation-questions)** decidem se um agente personalizado roda, antes do trabalho do agente na sua fase. Sem resposta, a pergunta não o impede; as palavras-chave e **Trigger Cadence** (cadência de ativação) continuam valendo.
- **[Declarações em prompts](../prompts/conditional-prompts.md#asking-the-decision-model)** escolhem texto ao preparar um prompt de chat ou agente. Sem resposta, a decisão vale não; portanto, um bloco de decisão simples usa seu ramo `{{else}}`, se houver.
- **[Campos Decision de lorebooks](../lorebooks/entries.md#decision-activation)** verificam Require ou Trigger durante a análise dos lorebooks do chat. Sem resposta, Require não pode admitir uma nova entrada e Trigger não acrescenta uma via de ativação. Retenções Sticky existentes e vias normais de ativação de entradas Trigger continuam valendo.
- **[Ordem de resposta Smart](../chats/group-chats.md#response-order-individual-only)** pontua quem deve falar em seguida em um chat em grupo, se ativada. Sem resposta, a ordem Smart faz sua chamada normal à IA.

Uma pergunta de ativação controla se um agente roda; uma declaração de decisão dentro do prompt controla as instruções que esse agente recebe ao rodar. Use `{{#if decision:"..."}}` para condições de prompt de sim/não e `{{#if decision_choice:"..." == "..."}}` para escolher entre respostas.

<a id="what-the-model-sees"></a>

## O que o modelo vê

Nas perguntas de ativação e declarações de prompts/lorebooks, o modelo recebe a declaração e as mensagens recentes como foram salvas no chat. Ele não recebe o restante do prompt montado: preset, card de personagem, descrição da persona, entradas de lorebook (inclusive Constant), resumos ou resultados de agentes. Textos inseridos entre mensagens, como um preset ou entrada de lorebook em **@ Depth** (em uma profundidade), também ficam de fora. Uma declaração que depende de um desses fatos precisa incluir o próprio fato.

**A ordem de resposta Smart também envia uma lista de personagens.** Ela inclui nome, status, atividade e sociabilidade de cada candidato quando disponíveis, além de até 300 caracteres da personalidade ou, se estiver vazia, da descrição. Um provedor Decision hospedado recebe essa lista junto com as mensagens recentes.

- As declarações de decisão em prompts e entradas de lorebook e a ordem de resposta Smart leem as últimas 5 mensagens. Esse número é fixo.
- As perguntas de ativação leem a **Scan Depth** (profundidade de análise) do agente, 5 por padrão.
- Cada mensagem é identificada pelo nome de quem fala. Mensagens ocultas da IA ficam de fora.
- Tudo que é verificado depois da resposta, como a pergunta de ativação de um agente de pós-processamento ou uma declaração no seu prompt, também vê a resposta recém-escrita.
- As macros da declaração são preenchidas primeiro; assim, `{{char}}` chega como o nome do personagem.
- Se as mensagens não couberem no orçamento do modelo, as mais antigas são descartadas primeiro. Veja [Configurar uma conexão Decision](#set-up-a-decision-connection) para o orçamento hospedado.

## Escolher um modelo de decisão

Abra **Connections** (conexões), depois **Connection defaults** (conexões padrão), e escolha em **Decision model**. A lista tem três grupos:

- **None** (nenhum), o padrão. Nada é perguntado e os campos de perguntas de ativação ficam desativados no editor de agentes.
- **Local models** (modelos locais): o **Primary local model** (modelo local principal) ou **Utility local model** (modelo local auxiliar) que você já roda. Nada é baixado e nada sai da máquina. O **Decision sidecar** (processo auxiliar de decisão), se instalado, também aparece aqui.
- **Connections**: qualquer conexão Decision criada por você, hospedada ou executada por conta própria.

Opções que não podem responder agora continuam na lista, acinzentadas com o motivo, para você saber o que corrigir. Clique em **Test** (testar) depois de escolher. O teste envia uma amostra fixa, não o seu chat.

### Qual escolher

Se você já roda um modelo local, experimente-o primeiro. Em um pequeno teste de redação com uma cena de Roleplay, Gemma 4 E4B respondeu corretamente a 32 de 32 declarações recomendadas, e Open-Jev 2B e 9B a 31 cada. Isso exemplifica a importância da redação; não é uma classificação geral de precisão. Teste turnos representativos dos seus próprios chats; veja [Escrever declarações](../prompts/conditional-prompts.md#writing-statements).

**Jev e Open-Jev são modelos diferentes.** Jev é o modelo hospedado da TypeSafe, disponível diretamente ou pelo OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) é um modelo publicado separadamente, baseado em Qwen, que Marinara pode rodar localmente. Os testes de redação do Open-Jev não medem a precisão do Jev hospedado.

| Opção | Custos | Precisa de | Indicada para |
| --- | --- | --- | --- |
| Um modelo que você já roda | Nada extra | Um modelo local em **Local Model** (modelo local) | A maioria de quem roda um modelo local |
| Uma conexão Decision hospedada | Solicitações cobradas; um turno pode fazer várias | Uma chave de API (TypeSafe ou OpenRouter) | Celulares e PCs sem modelo local |
| O modelo de decisão instalável | Espaço em disco e memória da GPU separados; veja [tamanhos dos modelos](#let-marinara-install-a-decision-model) | Linux x86-64 e uma GPU NVIDIA compatível | Um modelo de decisão separado junto do modelo de chat |

**No Android (Termux),** o modelo de decisão instalável não pode rodar, pois exige um PC com GPU NVIDIA. Um modelo local pequeno no processador do celular também pode ser lento demais para o tempo limite. Uma conexão Decision hospedada é a escolha prática no celular, por exemplo Jev pelo OpenRouter. Veja [Configurar uma conexão Decision](#set-up-a-decision-connection).

Presets, cards e agentes devem ser escritos para "um modelo de decisão", nunca "exige Jev". A sintaxe das declarações é a mesma independentemente do modelo escolhido, mas modelos diferentes podem dar respostas diferentes.

Quando alguém importa conteúdo que usa decisões, Marinara mostra um aviso com um link para este guia. Isso inclui agentes personalizados e instalações do catálogo de Agents. Sem Decision model selecionado, o aviso explica o comportamento alternativo: declarações em prompts valem não, entradas de lorebook não podem ativar por decisão e perguntas de ativação deixam o agente rodar sempre que suas palavras-chave e **Trigger Cadence** permitirem. Defina também uma cadência se o agente não deve rodar em todo turno sem Decision model. A restauração de um perfil completo por ZIP não mostra esse aviso de importação.

<a id="use-a-model-you-already-run"></a>

## Usar um modelo que você já roda

Se você tem um modelo local em **Local Model**, pode usá-lo para decisões sem criar uma conexão nem pagar por uma solicitação.

1. Em **Connections**, abra **Connection defaults** e defina **Decision model** como **Primary local model**, ou **Utility local model** se houver um configurado.
2. Clique em **Test**. Um resultado bem-sucedido mostra a probabilidade e a duração da solicitação, além de duas informações específicas de modelos locais: se havia log-probabilidades disponíveis e se o modelo responde diretamente.

Marinara faz uma única pergunta de sim/não ao modelo, permite a produção de um token e lê a resposta nas probabilidades desse token. Nenhuma resposta de chat é escrita, então a solicitação é curta. Uma escolha entre várias respostas vira uma pergunta de sim/não por resposta. Quantas mensagens recentes cabem é calculado a partir do tamanho de contexto do próprio slot.

**Raciocínio.** A maioria dos modelos responde em uma palavra. Alguns sempre raciocinam antes, independentemente do pedido. A configuração **Thinking** (raciocínio), abaixo do menu suspenso, controla isso:

- **Auto** (padrão) tenta o método rápido de uma palavra e, se o modelo não conseguir responder assim duas vezes seguidas, permite que ele raciocine antes e avisa você.
- **Off** (desativado) sempre usa o método de uma palavra. Um modelo que não consegue responder assim não fornece resposta.
- **Allowed** (permitido) nunca pede ao modelo para pular o raciocínio.

Um modelo que raciocina antes leva segundos; por padrão, ele só responde para tarefas que acontecem depois que a resposta aparece na tela, como agentes de pós-processamento. Antes da resposta, ele não fornece resposta, a menos que você ative **Also gate agents that run before the reply** (avaliar também os agentes que rodam antes da resposta), fazendo cada resposta esperar por ele.

**Sobre os números.** As probabilidades de sim/não de um modelo geral de chat podem ser usadas com um limiar, mas nunca foram treinadas para ser calibradas como as de um modelo criado para decisões. Um ambiente que não retorna log-probabilidades responde com 1 ou 0 fixos. Ajuste os limiares com seus chats, em vez de confiar no padrão.

<a id="set-up-a-decision-connection"></a>

## Configurar uma conexão Decision

1. Em **Connections**, crie uma conexão com o provedor **Decision** (decisão).
2. Escolha **TypeSafe**, **OpenRouter** ou **Custom System One endpoint** (endpoint System One personalizado). Fontes hospedadas precisam de chave de API. Custom aceita um servidor System One que você já roda, inclusive Open-Jev; informe a URL base sem `/v1/systemone` e use o nome de modelo que ele aceita.
3. Para OpenRouter, escolha uma conexão OpenRouter salva em **API key source** (origem da chave de API) ou informe uma chave separada. Seu editor também oferece **Use this key for decisions (Jev)** (usar esta chave para decisões com Jev). Chaves vinculadas acompanham mudanças posteriores automaticamente. Conexões personalizadas só podem usar a chave de uma conexão de chat personalizada quando as duas URLs têm a mesma origem (esquema, host e porta).
4. Salve, selecione em **Decision model** e clique em **Test**. Um resultado bem-sucedido mostra a probabilidade, quanto a resposta demorou e o tempo limite da conexão. Test espera pelo menos 10 segundos e 5 segundos além de um limite maior, para informar o tempo real de uma resposta lenta. Se ela ultrapassar o limite, o resultado informa: durante um chat, ela contaria como ausência de resposta.

O padrão de Decision é separado dos padrões de chat, agentes, imagem, vídeo e áudio. Escolher **None** desativa as decisões sem excluir perguntas de ativação ou declarações de decisão.

Decisões hospedadas enviam as mensagens recentes selecionadas e as declarações ao provedor escolhido e podem gerar cobranças. A ordem de resposta Smart também inclui a [lista de personagens](#what-the-model-sees). **Recent-message token budget** (orçamento de tokens de mensagens recentes) tem padrão de 30.000 tokens estimados para fontes hospedadas e 3.500 para servidores personalizados. Reduza se o servidor tiver um limite de contexto menor. Marinara descarta primeiro mensagens mais antigas e depois corta a parte mais antiga da mensagem mais recente. A estimativa pode diferir do tokenizador do servidor; uma solicitação recusada ou acima do orçamento não fornece resposta.

**Time limit (seconds)** (tempo limite em segundos) define quanto cada conexão Decision espera por uma resposta durante chats, de 0,5 a 30 segundos (1,5 por padrão). Uma resposta posterior conta como ausência de resposta. Alguns provedores hospedados às vezes demoram mais de 1,5 segundo, dando a impressão de falhas aleatórias. Clique em **Test** algumas vezes e defina o limite acima da resposta mais lenta. A contrapartida: uma declaração avaliada antes da resposta, como uma decisão em um preset ou a pergunta de ativação de um agente que roda antes da resposta, pode atrasá-la por todo esse tempo.

Excluir uma conexão usada para uma chave vinculada mostra um aviso e deixa a conexão Decision precisando de novo vínculo. Arquivos de conexão independentes importados também precisam que chaves ou vínculos sejam restaurados; eles nunca contêm chaves de API nem IDs de conexões emprestadas.

<a id="let-marinara-install-a-decision-model"></a>

## Deixar Marinara instalar um modelo de decisão

Marinara também pode baixar e rodar um modelo criado para decisões. Ele roda em um processo local próprio, com ou sem um modelo de chat local em execução. Sua memória se soma à do modelo de chat. Se você já tem um modelo local, teste suas decisões antes de baixar outro.

Os modelos Open-Jev integrados exigem Linux **x86-64**, uma GPU NVIDIA com capacidade de computação 7.5 ou superior (Turing, série RTX 20 ou posterior) e driver 580 ou superior. Esses pacotes não têm suporte a dispositivos Linux ARM nem a placas Pascal ou anteriores. Quando um modelo não pode rodar, a opção continua visível, informa o motivo e oferece configurar uma conexão Decision.

| Modelo integrado | Download do modelo | Disco com ambiente de execução | Memória da GPU |
| --- | --- | --- | --- |
| Open-Jev 2B | Cerca de 4,6 GB | Cerca de 10 GB | Cerca de 4,8 GB (4,5 GiB) |
| Open-Jev 9B | Cerca de 19,4 GB | Cerca de 25,3 GB | Cerca de 23,6 GB (22 GiB) |

São estimativas do catálogo baseadas nas versões fixadas dos modelos e em cargas de trabalho medidas. Uso da GPU e velocidade variam com a carga. O modelo 9B deixa pouca margem em uma GPU de 24 GB; confira o parecer do instalador para a placa selecionada e os outros modelos em execução.

1. Abra **Connections**, expanda **Local Model** e escolha **Decision sidecar (experimental)** (processo auxiliar de decisão experimental).
2. Leia o aviso e ative **Enable decision sidecar** (ativar processo auxiliar de decisão). A confirmação mostra o parecer para sua máquina, e o botão diz **Enable anyway** (ativar mesmo assim) quando o parecer é um aviso.
3. Escolha um modelo e confirme tamanho, parecer do hardware e licenças. Nada é baixado antes desse ponto. **Open-Jev 2B** precisa de muito menos memória que **Open-Jev 9B**; nenhum garante respostas corretas para seu chat.
4. Selecione **Decision sidecar** em **Decision model**.

Você também pode colar o repositório HuggingFace de um modelo de decisão. Marinara lê o manifesto do próprio repositório, verifica se o tipo de artefato corresponde a um ambiente incluído nesta compilação e mostra os pesos base que baixará e o tamanho total antes de oferecer a instalação. Um repositório que não pode ser verificado é recusado com o motivo, em vez de instalado sem garantia.

Em uma máquina com mais de uma GPU NVIDIA, o menu **GPU** escolhe a placa em que o modelo carrega. Os pareceres valem para essa placa; trocá-la para o modelo para que ele reinicie nela.

Desativar o processo auxiliar para o processo e mantém os arquivos. **Remove files** (remover arquivos) exclui o modelo e o ambiente de execução e continua disponível com o processo auxiliar desativado.

<a id="thresholds"></a>

## Limiares

As probabilidades não são diretamente comparáveis entre modelos. O mesmo exemplo positivo pode pontuar 0,99 em um modelo e 0,2 em outro. O limiar padrão do Marinara depende de como o modelo é conectado:

| Backend selecionado | Limiar padrão de sim/não |
| --- | --- |
| Modelo de chat local Primary ou Utility | 0,5 |
| Conexão Decision TypeSafe, OpenRouter ou Custom System One | 0,5 |
| Decision sidecar gerenciado | Recomendação do manifesto do modelo; 0,1 para os Open-Jev 2B e 9B integrados |

O ajuste **Run when probability is at least** (rodar quando a probabilidade for pelo menos) de um agente pode substituir esse padrão. O editor oferece restaurar a recomendação do backend quando o valor salvo difere. Confira a configuração sempre que trocar de modelo.

Declarações em prompts e campos Decision de lorebooks usam o padrão do backend; mudar o limiar de um agente não muda o deles. **Um Open-Jev hospedado por você em uma conexão Custom System One continua usando 0,5.** Marinara não consegue identificar e calibrar automaticamente endpoints personalizados arbitrários. Assim, os resultados podem diferir dos do processo auxiliar Open-Jev gerenciado, inclusive tratando um resultado positivo abaixo de 0,5 como não.

<a id="time-limits"></a>

## Tempos limite

Uma decisão que não chega a tempo não fornece resposta. A geração continua usando o [comportamento alternativo do recurso](#where-marinara-uses-it); isso pode omitir um ramo do prompt ou uma entrada obrigatória de lorebook.

- **1,5 segundo** para uma conexão Decision, salvo alteração de **Time limit** (tempo limite). Veja [Configurar uma conexão Decision](#set-up-a-decision-connection).
- **4 segundos** para um modelo local ou processo auxiliar de decisão. Quando um turno avalia muitas declarações, Open-Jev 9B recebe um pouco mais de tempo para cada declaração extra.
- **20 segundos** para um modelo local que precisa raciocinar primeiro.

Solicitações de decisão param quando você cancela uma geração.

## Outras configurações de Decision model

- **Also use it to pick who speaks in Smart response order.** (Usar também para escolher quem fala na ordem Smart). Desativada por padrão. Veja [Chats em grupo](../chats/group-chats.md#response-order-individual-only).
- **Decision statements per turn.** (Declarações de decisão por turno). Limita o planejamento de declarações de prompts e lorebooks, 32 por padrão e até 255. O orçamento é aplicado em várias etapas; não é um único limite para todas as solicitações Decision ou gastos durante um turno. Perguntas de ativação de agentes e ordem Smart são separadas. Veja [Limites e custo](../prompts/conditional-prompts.md#limits-and-cost) para o escopo, os lotes e as regras de prioridade.
- **Also gate agents that run before the reply** e **Thinking** aparecem para um modelo local. Veja [Usar um modelo que você já roda](#use-a-model-you-already-run).

## Precisão: prepare-se para respostas erradas

Qualquer modelo pode responder errado. No pequeno teste de redação acima, vários "sim" corretos do Open-Jev 2B ficaram pouco acima do limiar. Prepare-se para respostas ausentes ou equivocadas:

- Use decisões para refinar, nunca para algo indispensável ao chat. Uma decisão perdida deve tornar a resposta um pouco menos adaptada, não quebrá-la.
- Não condicione consentimento, avisos de conteúdo ou instruções de segurança a uma decisão.
- Para um agente que só roda por pergunta de ativação, configure **Bypass the question after this many messages** (ignorar a pergunta após este número de mensagens) para impedir que um modelo que sempre responde "não" o silencie para sempre.

Para exemplos concretos de redação e uma forma de testá-los nos seus chats, veja [Escrever declarações](../prompts/conditional-prompts.md#writing-statements).

## Solução de problemas

- **Test falha.** A mensagem informa por quê: chave recusada, limite de frequência do provedor, modelo local parado, modelo de decisão não instalado, ausência de resposta sim/não ou tempo esgotado.
- **Test informa que a resposta ultrapassou o limite, ou decisões só funcionam às vezes.** O provedor responde mais devagar que o **Time limit** da conexão pelo menos algumas vezes. Teste novamente algumas vezes e aumente o limite acima da resposta mais lenta.
- **Um agente com pergunta de ativação roda em todo turno.** Nenhum Decision model está definido, ou ele não responde; portanto, o agente roda como se não tivesse pergunta. Confira **Test**.
- **Um ramo de decisão em um prompt nunca aparece.** Veja [Quando um ramo de decisão nunca aparece](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **A ordem de resposta Smart continua fazendo sua chamada normal à IA.** O controle está desligado ou o Decision model não respondeu naquele turno.
- **Para ver cada declaração e sua resposta,** defina o nível de log como debug. Veja [Níveis de log](../CONFIGURATION.md#logging-levels).

## Guias relacionados

- [Criar agentes personalizados](../agents/custom-agents.md)
- [Prompts condicionais](../prompts/conditional-prompts.md)
- [Chats em grupo](../chats/group-chats.md)
- [Configurar o Local Model](local-model.md)
- [Conectar a um provedor de IA](connecting-to-a-provider.md)
