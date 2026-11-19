# Modelos de decisão

Um modelo de decisão é um modelo pequeno que responde a perguntas curtas sobre o seu chat para Marinara, como "A mensagem mais recente leva a cena para um novo lugar?" ou "Qual é o humor de Kaelen: irritado, triste ou calmo?". Alguns também podem analisar as imagens e os clipes do chat. Lorebooks, agentes personalizados, prompts, chats em grupo e o Illustrator o usam. Ele é opcional. Sem um, os chats continuam funcionando e cada recurso usa o comportamento alternativo descrito em [Onde Marinara o usa](#where-marinara-uses-it).

As respostas dele controlam o que Marinara faz e nunca são publicadas no chat. Veja [O que um modelo de decisão pode responder](#what-a-decision-model-can-answer) para conhecer os tipos de pergunta e exemplos.

Nossa recomendação: deixe em **None** (nenhum) se estiver em dúvida. Se quiser decisões, use o modelo embutido que você talvez já tenha, ou um modelo de chat em um servidor que você já executa. Nenhum dos dois custa nada a mais.

## O que um modelo de decisão pode responder

Cada resposta volta como um número de 0 a 1: o grau de certeza do modelo. Marinara transforma esse número na resposta de que um recurso precisa.

### Sim ou não

O modelo lê uma declaração e diz qual é a probabilidade de ela ser verdadeira. Marinara compara isso com um [limiar](#thresholds): atingir ou superar esse valor conta como sim. Esse é o tipo mais comum, usado por perguntas de ativação, campos **Decision** (decisão) de lorebooks, `{{#if decision:"..."}}` e verificações do Illustrator.

| Declaração | O que poderia controlar |
| --- | --- |
| `In the latest message, the characters move to a different location` | Um tracker atualiza o local apenas nos turnos em que ele mudou. |
| `In the latest message, a dragon is physically present` | Uma entrada de lorebook sobre dragões entra no prompt. |
| `{{user}} asked a question that {{char}} has not answered yet` | Uma linha do prompt lembra o modelo de responder. |
| `The latest message describes a fight` | Um agente de combate roda apenas neste turno. |

### Uma entre várias respostas

O modelo escolhe a opção mais adequada de uma lista curta que você escreve. Marinara pergunta sobre cada opção e mantém a que tem a maior pontuação, então você recebe uma resposta, não várias. Use `{{#if decision_choice:"..." == "..."}}`:

```text
{{#if decision_choice:"Kaelen's mood in the latest message" == "angry"}}
Kaelen speaks in short, clipped sentences.
{{else if decision_choice:"Kaelen's mood in the latest message" == "sad"}}
Kaelen speaks quietly and avoids eye contact.
{{else if decision_choice:"Kaelen's mood in the latest message" == "calm"}}
Kaelen speaks normally.
{{/if}}
```

Outras listas que funcionam bem: o tipo de cena (`combat`, `dialogue`, `exploration`, `rest`), a hora do dia (`morning`, `afternoon`, `evening`, `night`) ou em qual cômodo de uma casa a cena acontece. Mantenha as opções distintas e acrescente uma como `none of these` quando nenhuma puder se aplicar. Os agentes usam o mesmo mecanismo para escolher um entre vários conjuntos de instruções, e o Illustrator o usa para escolher o tipo de clima.

### Uma pontuação

Alguns recursos usam o próprio número em vez de um sim ou não. A [ordem de resposta Smart](../chats/group-chats.md#response-order-individual-only) pontua a probabilidade de cada personagem falar em seguida e escolhe a maior. O [Advanced Memory](../agents/memory.md#optional-decision-model) pontua a relevância de cada cena passada. **Test decisions** (testar decisões), no Peek Prompt, mostra a pontuação de cada declaração, o que ajuda você a escolher um limiar. Veja [Como testar declarações de decisão](../chats/peek-prompt.md#testing-decision-statements).

### Imagens e clipes

Um modelo de decisão embutido que lê imagens pode responder aos mesmos tipos de pergunta sobre as imagens do chat, como `The picture shows the character at the beach`. Liquid d1, Valen e Winnow leem imagens, e a versão completa do Valen também lê clipes curtos. Os outros modelos e todas as contas hospedadas ou de servidor leem apenas texto e nunca recebem imagens.

As imagens só são enviadas quando você pede, porque cada uma torna a resposta mais lenta:

- Em uma declaração, adicione `pictures:1` (até 3) ou `clips:1`. Adicione `media_within:2` para perguntar apenas quando uma das 2 mensagens mais recentes tiver uma imagem. Veja [Imagens e clipes](../prompts/conditional-prompts.md#pictures-and-clips).
- Em uma entrada de lorebook, configure **Show the decision model** (mostrar ao modelo de decisão) abaixo do campo **Decision**. Veja [Ativação por decisão](../lorebooks/entries.md#decision-activation).
- Na pergunta de ativação de um agente personalizado, configure **Show the decision model**. Veja [Perguntas de ativação](../agents/custom-agents.md#activation-questions).
- Para os recursos de imagem do próprio Marinara, veja [Recursos que analisam imagens](#features-that-look-at-pictures).

### O que a página de um modelo lista

A página de cada modelo de decisão embutido mostra duas linhas:

- **Answers** (respostas) lista o que o modelo foi criado para responder: **Yes/no**, **Weighted choice**, **Score on a scale** e, em alguns, **Boxes on a picture** (caixas em uma imagem: onde algo está em uma imagem). Marinara faz perguntas de sim ou não e de escolha e lê as pontuações. Ainda não pede caixas, então essa linha apenas descreve o modelo.
- **Reads** (lê) lista **Text**, **Pictures** e **Video**. Um tipo que apenas outra versão do modelo lê aparece depois dos demais, por exemplo "Video in its full release".

## Escolher um modelo de decisão

Antes de começar, veja [Qual escolher](#which-one-to-pick).

1. Clique em **Connections** (Conexões) na barra superior e abra a caixa **Jobs** (tarefas).
2. Em **Behind the scenes** (nos bastidores), clique na linha **Decision** (decisão). Uma lista se abre.
3. Escolha um modelo. A lista tem três grupos:
   - **None (decisions off)** (nenhum: decisões desligadas) é o padrão. Nada é perguntado, e os campos de perguntas de ativação no editor de agentes ficam desativados.
   - **Built-in model** (modelo embutido) lista os modelos que Marinara roda no seu computador: **Built-in model**, **Built-in model (utility)** e **Built-in model (decisions)**. Nada sai do seu computador.
   - **Connections** lista as suas contas que podem responder decisões: hospedadas, ou um modelo de chat em um servidor que você já executa.

   Clique em uma conta à esquerda para ver os modelos. As contas NanoGPT, OpenRouter e Google Gemini mostram primeiro seus próprios modelos de decisão em **Decision models** (modelos de decisão), com os modelos de chat logo abaixo em **Chat models** (modelos de chat). Uma conta Google Gemini mostra apenas os modelos de decisão, pois os modelos de chat dela não respondem a decisões. Um modelo de decisão escolhido antes aparece acima de **Starred** (favoritos), com o nome da conta abaixo dele.
4. Para testar o modelo, clique na engrenagem **Decision settings** (configurações de decisão) da linha e clique em **Test** (testar). Esse botão aparece nas opções de modelo embutido. Para um modelo de decisão TypeSafe, OpenRouter, NanoGPT ou Google Gemini, abra **Edit model** (editar modelo) e clique em **Test provider** (testar provedor). Para uma conta **Own decision server** (servidor de decisão próprio), use **Test** no menu **⋯** da conta.

Um teste bem-sucedido mostra a probabilidade de sim e quanto tempo a resposta levou. Para um modelo no seu computador, ele também informa se havia log-probabilidades disponíveis e se o modelo responde diretamente. Log-probabilidades são os números de confiança do modelo para cada palavra que ele poderia escrever. O teste envia uma amostra fixa, não o seu chat.

Se não funcionar, a mensagem diz por quê. Causas comuns: a chave foi recusada, o serviço está limitando as solicitações, o modelo embutido não está rodando ou a resposta passou do tempo limite. Veja [Solução de problemas](#troubleshooting).

As opções que não podem responder agora continuam na lista, em cinza, com o motivo. Escolher **None** desativa as decisões sem excluir nenhuma pergunta de ativação nem declaração de decisão.

<a id="which-one-to-pick"></a>

### Qual escolher

- **Um modelo que você já roda no modelo embutido.** Não custa nada a mais. É a melhor opção para a maioria de quem usa o modelo embutido.
- **Um modelo de chat no seu próprio servidor** (Ollama, LM Studio, llama.cpp ou outro servidor compatível com OpenAI). Não custa nada a mais. Boa opção quando o seu modelo roda fora do Marinara, para que ele não seja carregado duas vezes.
- **Um modelo de decisão hospedado** (TypeSafe, OpenRouter, NanoGPT ou Google Gemini). A cobrança é por solicitação, e um turno pode fazer várias. A assinatura do NanoGPT inclui alguns modelos de decisão, e o OpenRouter oferece alguns gratuitos. É uma boa opção para celulares e computadores sem modelo local.
- **O modelo de decisão embutido.** Um modelo criado para decisões que Marinara baixa e roda ao lado do seu modelo de chat, com espaço em disco e memória próprios. A maioria roda em quase qualquer computador, alguns apenas no processador. É a única opção que pode analisar imagens e clipes. Veja [Deixar Marinara instalar um modelo de decisão](#let-marinara-install-a-decision-model).

Se você já roda um modelo local, experimente-o primeiro e teste turnos dos seus próprios chats. A redação faz muita diferença. Veja [Escrever declarações](../prompts/conditional-prompts.md#writing-statements).

Jev e Open-Jev são modelos diferentes. Jev é o modelo hospedado da TypeSafe, disponível diretamente ou pelo OpenRouter. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) é um modelo publicado separadamente, baseado em Qwen, que Marinara pode rodar localmente. Os testes do Open-Jev não medem o Jev hospedado.

No Android (Termux), apenas JevK5 e Liquid d1 são oferecidos como **Built-in decision model** (modelo de decisão embutido), e o processador de um celular pode ser lento demais para eles. Uma conta hospedada é a escolha prática, por exemplo Jev pelo OpenRouter. Veja [Configurar uma conta Decision](#set-up-a-decision-account).

Escreva presets, cards e agentes para "um modelo de decisão", nunca "exige Jev". Uma declaração que pede imagens continua funcionando com um modelo que lê apenas texto: ele recebe só o texto. Eles usam a mesma sintaxe de declarações com qualquer modelo, mas os modelos podem dar respostas diferentes. Quando você importa conteúdo que usa decisões, inclusive agentes personalizados e instalações do Agent Organizer, Marinara mostra um aviso com um link para esta página. Restaurar um ZIP de perfil completo não mostra esse aviso.

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

1. Clique na linha **Decision** em **Behind the scenes**, na caixa **Jobs**. O seletor lista os modelos de todas as contas, inclusive o seu modelo de chat. Você também pode clicar em **⋯** no modelo e escolher **Use for…** → **Decision**.
2. Clique na engrenagem da linha **Decision** e depois em **Test**. Se passar, o teste informa se o servidor retornou log-probabilidades e se o modelo precisou raciocinar antes. Clique em **Done**.
Você também pode criá-lo por conta própria. Use uma conta Decision com a fonte **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)** (modelo de chat compatível com OpenAI), o mesmo endereço da sua conta de chat (por exemplo, `http://localhost:11434/v1` para Ollama) e o nome do modelo que o servidor usa.

Ele é consultado como o modelo embutido: uma palavra de sim ou não por declaração. As declarações vão uma por vez, porque Marinara não tem como saber quantas solicitações o seu servidor processa ao mesmo tempo. **Thinking** é sempre **Auto** para uma conta. Um servidor em outro computador precisa de `PROVIDER_LOCAL_URLS_ENABLED`. Veja [Conectar um modelo local ou auto-hospedado](local-self-hosted.md).

<a id="set-up-a-decision-connection"></a>

<a id="set-up-a-decision-account"></a>

## Configurar uma conta Decision

Uma conta Decision hospedada envia ao serviço as mensagens recentes selecionadas e as declarações, e pode gerar cobranças. A ordem de resposta Smart também envia uma [lista de personagens](#what-the-model-sees).

1. Clique em **Connections** na barra superior e depois em **Add** (adicionar).
2. Clique no filtro de tipo **Decision** e depois em **TypeSafe** ou **Own decision server**. Para o NanoGPT, veja [Pelo NanoGPT](#through-nanogpt). Para o OpenRouter ou o Google Gemini, veja [Pelo OpenRouter ou Google Gemini](#through-openrouter-or-google-gemini).
3. Informe a **API key** (chave de API) ou, para **Own decision server**, o **Server address** (endereço do servidor). Clique em **Connect** (conectar).
4. Em **Found in TypeSafe — use it for:**, marque **Decision** e clique em **Done**. A linha **Decision** em **Behind the scenes**, na caixa **Jobs**, passa a mostrar o modelo.
5. Para testá-lo, clique no modelo no painel para abrir **Edit model** e depois clique em **Test provider** no cartão **Provider tests** (testes do provedor). Um modelo de **Own decision server** não tem o botão **Test provider** ali. Em vez disso, abra o menu **⋯** da conta no painel e clique em **Test**.

Um **Test provider** bem-sucedido mostra a probabilidade, quanto tempo a resposta levou e o tempo limite da conta. O **Test** da conta, no menu **⋯**, só informa se funcionou e quanto tempo levou. O teste espera pelo menos 10 segundos, ou 5 segundos além de um limite maior. Se a resposta demorar mais que o limite, o resultado avisa: nos chats, essa resposta contaria como ausência de resposta.

Se não funcionar, veja [Solução de problemas](#troubleshooting).

O modelo de decisão tem os campos a seguir. Clique no modelo no painel para abrir **Edit model**, ou clique na engrenagem da linha **Decision** na caixa **Jobs** para abrir **Decision settings** do modelo atual.

| Campo | O que faz |
| --- | --- |
| **Decision source** (fonte de decisão) | **TypeSafe**, **OpenRouter**, **NanoGPT**, **Google Gemini**, **Custom System One endpoint** (endpoint System One personalizado) ou **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**. Ela fica fixa a partir da criação do modelo. |
| **API key source** (origem da chave de API) | **Enter a separate key (optional for local servers)** (informar uma chave separada: opcional para servidores locais) ou **Use key from …** (usar a chave de) outra conta. As chaves vinculadas acompanham as alterações posteriores da chave. Um modelo System One personalizado ou compatível com OpenAI só pode emprestar a chave de uma conta de chat personalizada quando os dois endereços têm o mesmo esquema, host e porta. |
| **Recent-message token budget** (orçamento de tokens de mensagens recentes) | Quantos tokens estimados do chat enviar. De 1 a 30.000. O padrão é 30.000 para TypeSafe, OpenRouter, NanoGPT e Google Gemini e 3.500 para servidores próprios. Um modelo de decisão de uma conta NanoGPT, OpenRouter ou Google Gemini com limite de entrada menor recebe três quartos desse limite. Marinara descarta primeiro as mensagens mais antigas e depois corta a parte inicial da mensagem mais recente. Uma solicitação recusada ou acima do orçamento fica sem resposta. |
| **Time limit (seconds)** (limite de tempo em segundos) | Quanto tempo esperar por cada declaração durante os chats. De 0,5 a 30. O padrão é 1,5 segundo, ou 4 segundos para NanoGPT e modelos de chat compatíveis com OpenAI. Veja [Tempos limite](#time-limits). |
| **Custom Request Headers** (cabeçalhos personalizados da solicitação) | Cabeçalhos extras enviados com cada solicitação de decisão, como um objeto JSON, por exemplo `{"x-billing-mode": "paygo"}`. Os cabeçalhos de autenticação são recusados, então deixe as chaves fora daqui. |

TypeSafe envia para `https://api.typesafe.ai`. Você pode trocar a **Base URL** (URL base) dela pelo endereço de outro servidor que execute a API da TypeSafe, sem `/v1/systemone`. A chave da TypeSafe continua necessária e é enviada a esse servidor. **Custom System One endpoint** aceita um servidor System One que você executa, como Open-Jev ou [Strands decider](#run-strands-decider-yourself). Informe o endereço dele sem `/v1/systemone`. Um servidor de modelos de chat como o Ollama não fala System One. Para ele, use **OpenAI-compatible chat model**.

<a id="through-nanogpt"></a>

### Pelo NanoGPT

O NanoGPT lista seus próprios modelos de decisão, como Jev Latest, e responde pela API Decisions usando sua chave do NanoGPT. Alguns modelos estão incluídos na assinatura, e os demais são cobrados do seu saldo.

1. Conecte o NanoGPT normalmente. Em **Add**, ele também aparece no filtro de tipo **Decision**.
2. Em **Found in NanoGPT — use it for:** (encontrado no NanoGPT – usar para), marque **Decision**. Marinara escolhe um modelo de decisão incluído no seu plano, dando preferência ao Jev Latest.
3. Para escolher outro, clique em **⋯** na conta NanoGPT, depois em **Add model** (adicionar modelo) e na aba **Decision**. A aba lista apenas modelos de decisão. O selo **Plan** marca os modelos incluídos na assinatura. Selecione um e clique em **Test decision**.

Os modelos de decisão ficam fora das listas de modelos de chat porque não conseguem conversar.

Por padrão, o NanoGPT decide se a solicitação usa a assinatura ou o saldo. Para sempre usar o saldo, abra **Edit model** no modelo de decisão e informe `{"x-billing-mode": "paygo"}` em **Custom Request Headers**.

<a id="through-openrouter-or-google-gemini"></a>

### Pelo OpenRouter ou Google Gemini

As contas OpenRouter e Google Gemini também listam seus próprios modelos de decisão. Marinara consulta a API de decisão do serviço com a chave da conta. O OpenRouter lista vários, alguns gratuitos (os nomes terminam em `:free`). O Google Gemini lista um, **Gemini Decision 1**.

1. Conecte o OpenRouter ou o Google Gemini normalmente.
2. Clique na linha **Decision** em **Behind the scenes**, na caixa **Jobs**, e depois na conta à esquerda. Escolha um modelo em **Decision models**.
3. Para testá-lo, abra **Edit model** e clique em **Test provider**.

Na conta OpenRouter, os modelos de chat que retornam log-probabilidades aparecem logo abaixo, em **Chat models**, e também funcionam. Uma conta Google Gemini oferece somente seu modelo de decisão.

Uma conta adicionada antes desta versão pode começar sem **Decision models** porque a lista salva é anterior a esses modelos. Clique no botão de atualizar no seletor ou aguarde a atualização automática. Marinara atualiza as listas salvas de modelos uma vez por dia.

Uma conta de decisão independente do **OpenRouter** criada em **Add** continua funcionando. Ela consulta a mesma API com sua própria chave.

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

- Os [recursos que analisam imagens](#features-that-look-at-pictures) verificam novas imagens, pulam repetições, reutilizam planos de fundo e sinalizam rostos de sprites, se estiverem ativados. Eles precisam de um modelo de decisão que lê imagens.

Uma pergunta de ativação decide se um agente roda. Uma declaração de decisão dentro do prompt dele decide o que esse agente recebe ao rodar. Use `{{#if decision:"..."}}` para condições de sim ou não e `{{#if decision_choice:"..." == "..."}}` para uma escolha entre respostas.

### Recursos que analisam imagens

Esses recursos precisam de um modelo de decisão embutido que lê imagens (Liquid d1, Valen ou Winnow). Todos ficam desligados até você ativá-los. Sem um modelo assim, ficam desativados, com um ⓘ que explica o motivo. Você ainda pode desligar um que ativou antes.

| Recurso | Onde | O que faz |
| --- | --- | --- |
| **Picture check** (verificação de imagens) | **Chat Settings → Agents → Illustrator** (configurações do chat → agentes → Illustrator) | Analisa cada nova imagem do Illustrator e selfie e verifica se mostra o que foi pedido. Uma selfie também é comparada com o avatar do personagem. **Make another if it doesn't match** (criar outra se não corresponder) desenha mais uma vez quando não corresponde. **Always make two, keep the better** (sempre criar duas e manter a melhor) desenha duas e mantém a que corresponde melhor. Cada imagem extra custa mais uma geração de imagem. |
| **Also check** (verificar também) | Abaixo de **Picture check** | Suas próprias verificações, uma por linha, até 6, como `Kaelen has short red hair`. Comece uma linha com `not:` para algo que a imagem não deve mostrar, como `not: The picture has writing or a watermark`. |
| **Skip a picture the newest one already shows** (pular uma imagem se a mais recente já mostra o mesmo) | Cartão do Illustrator | Antes de desenhar, compara a imagem mais recente do chat com o que está prestes a ser desenhado e pula a geração quando mostraria a mesma cena de novo. As imagens que você pede são sempre criadas. |
| **Reuse a library background that looks like the place** (reutilizar um plano de fundo da biblioteca parecido com o local) | Cartão do Illustrator | Quando nenhum plano de fundo da biblioteca tem o nome de um novo local, analisa até 4 que compartilham palavras com ele e mostra um que corresponda, em vez de pintar um novo. Veja [Verificar imagens com um modelo de decisão](../media/illustrator-agent.md#check-pictures-with-a-decision-model). |
| **Flag faces that don't match their expression** (sinalizar rostos que não correspondem à expressão) | Janela **Generate Sprites** (gerar sprites), apenas expressões | Analisa cada rosto depois de desenhado e marca os que talvez não mostrem a expressão esperada, para você desmarcar ou redesenhar. Veja [Gerar sprites com IA](../characters/sprites.md#generate-sprites-with-ai). |

Uma verificação que não consegue rodar porque o modelo está desligado, lento ou falha conta como aprovada: a imagem é mantida como foi criada.

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
- **Conta TypeSafe, OpenRouter, NanoGPT, Google Gemini ou Custom System One:** 0,5
- **Modelo de decisão embutido:** a recomendação do próprio modelo, medida em turnos de roleplay quando possível: 0,3 para JevK5, Liquid d1 e Valen-Decision 1.5 4B; 0,5 para a versão completa do Valen e Winnow (ainda não medidos); 0,1 para Open-Jev 2B e 9B

O ajuste **Run when probability is at least** (rodar quando a probabilidade for pelo menos) de um agente substitui esse padrão. O editor oferece restaurar a recomendação do modelo quando o valor salvo é diferente. Confira esse ajuste sempre que trocar de modelo. As declarações em prompts e os campos Decision de lorebooks usam o padrão do modelo, e o limiar de um agente não muda o deles.

Um Open-Jev hospedado por você em uma conta Custom System One continua usando 0,5, porque Marinara não consegue calibrar endpoints personalizados arbitrários. Os resultados dele podem diferir dos do Open-Jev embutido, inclusive tratando como não um resultado positivo abaixo de 0,5.

<a id="time-limits"></a>

## Tempos limite

Uma decisão que não chega a tempo não fornece resposta, e a geração continua com o comportamento alternativo do recurso (veja [Onde Marinara o usa](#where-marinara-uses-it)). Todo limite é por declaração. Uma solicitação com várias declarações recebe o limite para cada uma, e cada resposta Choice conta como uma declaração. Um modelo local processa só algumas solicitações por vez; por isso, as declarações aguardam a sua vez, e o tempo de uma declaração começa quando o modelo começa a processá-la.

- **Conta TypeSafe, OpenRouter, Google Gemini ou Custom System One:** 1,5 segundo ou o seu **Time limit**. Nos testes, OpenRouter e Google Gemini responderam em 0,2 a 0,5 segundo.
- **Modelo de decisão do NanoGPT:** 4 segundos ou o seu **Time limit**. Nos testes, respondeu em 0,4 a 2,5 segundos.
- **Conta de modelo de chat compatível com OpenAI:** 4 segundos, ou o seu **Time limit**. Um modelo que precisa raciocinar antes recebe pelo menos 20 segundos.
- **Modelo embutido:** 4 segundos. Um modelo que precisa raciocinar antes recebe 20 segundos.
- **Modelo de decisão embutido:** Open-Jev recebe 4 segundos para a primeira declaração, e cada uma das seguintes recebe o tempo medido: 0,35 segundo para 2B e 0,8 segundo para 9B. Os outros modelos medem a velocidade de leitura toda vez que iniciam, e os limites acompanham essa velocidade, então um processador lento recebe mais tempo. Cada imagem ou clipe que uma declaração pede acrescenta tempo. Até o modelo iniciar uma vez, ele recebe 4 segundos por declaração, 30 segundos por imagem e 60 por clipe.

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

- **Uma conta não mostra modelos em Decision models no seletor.** A lista salva é anterior aos modelos de decisão. Clique no botão de atualizar ao lado do nome da conta no seletor.
- **O teste falha.** A mensagem diz por quê: a chave foi recusada, o serviço está limitando as solicitações, o modelo embutido não está rodando, o modelo de decisão não está instalado, o modelo não respondeu sim ou não, ou o tempo acabou.
- **O servidor não tem esse endpoint.** A fonte Decision não corresponde ao servidor. Ollama, LM Studio e outros servidores de modelos de chat precisam de **OpenAI-compatible chat model**. **Custom System One endpoint** serve só para servidores System One, como Open-Jev.
- **A resposta passou do tempo limite, ou as decisões só funcionam às vezes.** O serviço às vezes é mais lento que o **Time limit**. Teste algumas vezes e aumente o limite para acima da resposta mais lenta.
- **Um agente com pergunta de ativação roda em todo turno.** Nenhum modelo de decisão está definido, ou ele não está respondendo; por isso, o agente roda como se não tivesse pergunta. Faça um teste.
- **Um ramo de decisão em um prompt nunca aparece.** Veja [Quando um ramo de decisão nunca aparece](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **A ordem de resposta Smart continua fazendo a chamada normal à IA.** O controle está desligado, ou o modelo de decisão não respondeu naquele turno.
- **As configurações de imagem ficam desativadas com um ⓘ.** O modelo de decisão selecionado lê apenas texto, ou nenhum modelo de decisão está definido. Escolha Liquid d1, Valen ou Winnow como **Built-in decision model**. Veja [Qual modelo de decisão embutido escolher](#which-built-in-decision-model).
- **Uma declaração com `pictures:` vale não.** Com `media_within:`, nenhuma das mensagens mais recentes tinha uma imagem. Caso contrário, a imagem fez a resposta passar do tempo limite. A linha **On this computer** (neste computador) da página do modelo mostra quanto tempo uma imagem leva.
- **Um modelo diz que não pode rodar aqui.** O motivo abaixo da lista informa o que falta, como um recurso do processador, uma geração de placa de vídeo ou uma biblioteca. Escolha outro modelo; Liquid d1 e JevK5 rodam em quase qualquer computador.
- **Automate active characters segue o Character Tracker.** O modelo não respondeu para todos os personagens, ele raciocina antes e **Also gate agents that run before the reply** está desativada, ou o elenco é grande demais para a entrada do modelo, mesmo só com os nomes.

Para ver as pontuações e as saídas das decisões durante a geração, ative o Debug Mode ou defina o nível de log como debug. Veja [Níveis de log](../CONFIGURATION.md#logging-levels). Para testar as suas próprias declarações sem gerar uma resposta, abra **Peek Prompt → Decision diagnostics → Test decisions** (Peek Prompt → diagnóstico de decisões → testar decisões). Os testes explícitos chamam o modelo selecionado e podem gerar cobranças em um serviço hospedado. Veja [Como testar declarações de decisão](../chats/peek-prompt.md#testing-decision-statements).

<a id="let-marinara-install-a-decision-model"></a>

## Deixar Marinara instalar um modelo de decisão

O **Built-in decision model** é um modelo criado para decisões que Marinara baixa e roda no seu computador, ao lado do seu modelo de chat. Nada sai do seu computador. O uso de memória dele se soma ao do seu modelo de chat. Se você já roda um modelo local, experimente as decisões dele primeiro.

### Qual modelo de decisão embutido escolher

| Modelo | Download | Lê | Idiomas | Roda em |
| --- | --- | --- | --- | --- |
| **JevK5 4B** | Cerca de 2,7 GB | Texto | Inglês | Quase qualquer computador: placa de vídeo NVIDIA, AMD, Intel ou Apple, ou apenas o processador. Usa o mesmo ambiente de execução do modelo embutido. |
| **JevK5 2B** | Cerca de 2 GB | Texto | Inglês | O mesmo que 4B. Mais rápido em um processador ou em uma placa de vídeo pequena, um pouco menos preciso. |
| **Liquid d1 3B** | Cerca de 2,3 GB | Texto, imagens | 16, incluindo japonês, chinês, coreano, alemão, espanhol e russo | Quase qualquer computador. A escolha para chats que não são em inglês. Gratuito para pessoas e empresas com receita anual inferior a 10 milhões de dólares. |
| **Valen-Decision 1.5 4B** | Cerca de 5,8 GB | Texto, imagens | 8 verificados | Linux em um processador Intel ou AMD de 64 bits, apenas no processador. |
| **Valen-Decision 1.5 2B (full release)** | Cerca de 6,4 GB | Texto, imagens, clipes | Não informado | Windows, macOS com Apple silicon e Linux, no processador. Precisa de cerca de 6 GB de memória. |
| **Valen-Decision 1.5 4B (full release)** | Cerca de 11,8 GB | Texto, imagens, clipes | 8 verificados | O mesmo que 2B. Precisa de cerca de 12 GB de memória e é mais lento, mas mais preciso. |
| **Winnow E4B** | Cerca de 9 GB | Texto, imagens | Não informado | Apenas Linux com uma placa NVIDIA da série RTX 50, as bibliotecas CUDA 13 e um processador com AVX-512 (como AMD Ryzen 7000 ou 9000; os chips Intel atuais para notebooks e computadores de mesa não têm esse recurso). Precisa de cerca de 11 GB de memória de vídeo. |
| **Open-Jev 2B** | Cerca de 4,6 GB | Texto | Inglês | Linux com uma placa NVIDIA da série RTX 20 ou posterior e driver 580 ou mais recente. Usa cerca de 4,8 GB de memória de vídeo e 10 GB de disco. |
| **Open-Jev 9B** | Cerca de 19,4 GB | Texto | Inglês | O mesmo que 2B. Usa cerca de 23,6 GB de memória de vídeo, então não cabe mais nada junto dele em uma placa de 24 GB. |

Em 20 turnos de roleplay em 8 idiomas, JevK5 4B, Liquid d1 e Valen-Decision 1.5 4B acertaram todas as 20 respostas. Escolha Liquid d1 se estiver em dúvida, ou a versão completa do Valen se quiser que leia clipes.

Antes de baixar qualquer coisa, Marinara verifica se o seu computador consegue rodar o modelo: o sistema, os recursos do processador, a placa de vídeo e suas bibliotecas e a memória livre. Um modelo que não pode rodar continua na lista, marcado como **(cannot run here)** (não pode ser executado aqui), e informa o motivo.

### Instalar um modelo

1. Clique em **Connections** na barra superior. Em **On this device** (neste dispositivo), clique em **Built-in model (decisions)**. Você também pode clicar em **Add** no painel **Connections** e em **Built-in model (decisions)**, em **Decisions**.
2. Escolha um modelo na lista **Model** (modelo). Abaixo dela, você vê a descrição, depois **Answers** e **Reads** (veja [O que a página de um modelo lista](#what-a-model-page-lists)), os idiomas e as licenças.
3. Clique em **Download** (baixar), com o nome e o tamanho do modelo. Confirme o tamanho, o parecer do hardware e as licenças. Nada é baixado antes disso.
4. Clique em **Use for Decision** (usar para Decisão), ou clique na linha **Decision**, em **Behind the scenes**, na caixa **Jobs**, e escolha **Built-in model (decisions)**.

Depois que um modelo roda, a página dele também mostra **On this computer**, com o tempo que levou ali: alguns turnos de chat, uma imagem e um clipe, para os modelos que os leem. Esses tempos vêm do seu próprio computador, então mostram quanto uma declaração fica mais lenta quando pede uma imagem.

Para trocar, escolha outro modelo na lista. Um modelo que você já baixou fica marcado como **(downloaded)** (baixado), e **Use this model** (usar este modelo) troca para ele sem baixar de novo.

Outros controles da página:

- **Turn off** (desligar) para o modelo e mantém os arquivos. **Turn on** (ligar) inicia o modelo de novo.
- **Runs on** (roda em) escolhe a placa em um computador com várias placas NVIDIA. Trocar a placa interrompe o modelo, que inicia de novo na placa nova.
- **Starts** (inicia) usa **When an agent first needs it** (quando um agente precisar dele pela primeira vez) por padrão, ou **With Marinara** (com o Marinara).
- **Install from a repository** (instalar de um repositório) aceita um modelo de decisão do Hugging Face no formato `owner/model-name`: um checkpoint Open-Jev, um GGUF que se declara um modelo de decisão ou um pacote GGUF do Valen. Adicione `:Q8_0` depois do nome para escolher um tamanho do GGUF. Clique em **Check** (verificar). Marinara lê o que os arquivos dizem sobre si mesmos e mostra o tamanho e as licenças. Um repositório que Marinara não pode garantir é recusado com o motivo. Depois, clique em **Download and install this one** (baixar e instalar este).
- **Remove files** (remover os arquivos) exclui o modelo e o ambiente de execução dele.
- **Reinstall** (reinstalar) aparece quando o modelo instalado não consegue iniciar porque os arquivos ou o ambiente de execução dele estão ausentes ou desatualizados, geralmente depois de uma atualização. O modelo fica marcado como **Needs reinstall**. Reinstalar mantém os arquivos que já foram baixados e estão íntegros, então geralmente só o ambiente de execução é baixado de novo.

A primeira resposta de um modelo depois que ele inicia é mais lenta; por isso, Marinara faz uma pergunta de aquecimento enquanto ele carrega. Se ela falhar, o modelo inicia mesmo assim e a primeira pergunta real absorve o atraso. Se o modelo parar logo depois de iniciar, a página informa o motivo, por exemplo que o processador não tem um recurso necessário.

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
