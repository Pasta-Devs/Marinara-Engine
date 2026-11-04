# Provedores de IA compatíveis

Esta página é uma referência dos principais serviços aos quais Marinara Engine consegue se conectar: onde conseguir a chave de API de cada um, o endereço padrão e as particularidades. Para adicionar uma conta passo a passo, leia antes [Conectando a um provedor de IA](connecting-to-a-provider.md).

Você escolhe um serviço na janela **Add account** (adicionar conta), na seção do que ele faz: **Chat**, **Images & video**, **Voice** ou **Decisions**. O botão de cada serviço usa o nome mostrado abaixo. O endereço é o endereço web para onde Marinara envia as requisições. Ele se chama **Address** (endereço) no editor da conta e **Base URL** (URL base) no editor do modelo. Marinara o preenche nos serviços conhecidos. Só mude esse campo para um proxy ou um servidor que você executa.

Os modelos mudam com frequência, por isso esta página não os lista. Depois que você conecta, a lista de modelos carrega no seletor. Clique em **Refresh model list** (atualizar a lista de modelos) no seletor para recarregá-la.

## Serviços de chat

Estes serviços usam uma chave de API, exceto os três serviços por assinatura, que usam um login no seu computador.

| Serviço | Onde conseguir a chave |
| --- | --- |
| LinkAPI | `linkapi.ai` |
| OpenAI | `platform.openai.com/api-keys` |
| Anthropic | `console.anthropic.com/settings/keys` |
| Google Gemini | `aistudio.google.com/apikey` |
| Google Vertex AI | `cloud.google.com/vertex-ai/docs/authentication` (guia de credenciais) |
| Mistral | `console.mistral.ai/api-keys` |
| Cohere | `dashboard.cohere.com/api-keys` |
| OpenRouter | `openrouter.ai/keys` |
| NanoGPT | `nano-gpt.com/api` |
| xAI / Grok | `console.x.ai` |
| Arli AI | `www.arliai.com/account` |
| Z.AI | `z.ai/manage-apikey/apikey-list` |
| DeepSeek | `platform.deepseek.com/api_keys` |
| OpenAI-compatible, Claude (Subscription), OpenAI (ChatGPT), Grok CLI (Subscription) | Sem página de chave. Veja as notas abaixo. |

Endereços padrão, que Marinara preenche para você:

- LinkAPI: `https://linkapi.ai/v1` (um gateway compatível com OpenAI, com chave própria)
- OpenAI: `https://api.openai.com/v1`
- Anthropic: `https://api.anthropic.com/v1`
- Google Gemini: `https://generativelanguage.googleapis.com/v1beta`
- Google Vertex AI:
  `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`
- Mistral: `https://api.mistral.ai/v1`
- Cohere: `https://api.cohere.ai/compatibility/v1`
- OpenRouter: `https://openrouter.ai/api/v1`
- NanoGPT: `https://nano-gpt.com/api/v1`
- xAI / Grok: `https://api.x.ai/v1`
- Arli AI: `https://api.arliai.com/v1`
- Z.AI: `https://api.z.ai/api/paas/v4`
- DeepSeek: `https://api.deepseek.com/v1`
- OpenAI-compatible e os serviços por assinatura: nenhum. Você informa um endereço, ou nenhum é necessário.

Todas as páginas de chave começam com `https://`.

Os três serviços por assinatura escondem os campos **API key** (chave de API) e de endereço. Eles não oferecem embeddings. Os passos de instalação e login estão em [Conexões por assinatura do Claude, do ChatGPT e do Grok](subscription-clis.md), que também trata do uso do plano.

Um agregador é um serviço em que uma única chave dá acesso a modelos de muitas empresas. OpenRouter e NanoGPT são agregadores. Um gateway é a mesma ideia para um proxy que você executa ou aluga.

## Notas sobre os serviços

### OpenAI

**OpenAI** roda os modelos GPT. Para imagens do DALL-E, adicione **OpenAI** e escolha modelos **Image** (imagem) na mesma conta. O mesmo vale para os outros serviços que fazem imagens com a mesma chave.

### Anthropic

**Anthropic** roda os modelos Claude. O cache de prompt permite que o serviço reaproveite o início do seu prompt, o que pode baratear os chats longos. Ative esse recurso com **Enable prompt caching** (ativar o cache de prompt), no editor do modelo. **Anthropic** não oferece embeddings (veja [Embeddings](#embeddings)).

### Google Gemini e Google Vertex AI

**Google Gemini** roda os modelos Gemini pelo Google AI Studio. É a opção mais simples do Google. Nas duas opções do Google, Marinara desliga os filtros de segurança ajustáveis do Google, exceto nas categorias que você mesmo definir em **Custom Parameters** (parâmetros personalizados). As proteções essenciais do Google, como a segurança infantil, continuam valendo.

**Google Vertex AI** roda o Gemini por um projeto do Google Cloud e dá mais trabalho para configurar. Edite o endereço e troque `YOUR_PROJECT_ID` pelo ID do seu projeto. Mude a região se ela não for `us-central1`. O campo **API key** aceita qualquer um destes, e Marinara identifica sozinho qual você colou:

1. Uma chave JSON de conta de serviço (um arquivo que o Google Cloud fornece e que identifica uma conta de serviço).
2. Um token de acesso OAuth, por exemplo o gerado por `gcloud auth print-access-token`.
3. Uma chave de API da Vertex.

**Gemini 4 Argon** só roda nas localizações `global`, `us` e `eu`, e não em uma única região como `us-central1`, segundo uma nota no código do Marinara que segue a documentação do Google. Para usá-lo, defina o endereço como `https://aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/global`. Com outra localização, o Google devolve um erro e Marinara mostra esse erro.

### Cohere

**Cohere** usa o endpoint compatível com OpenAI da Cohere. Se você colar um endereço antigo da v2 da Cohere, Marinara troca sozinho pelo endpoint de compatibilidade.

### OpenRouter

**OpenRouter** é um agregador com duas opções extras no editor do modelo:

- **Preferred provider** (provedor preferido) força o roteamento para um backend específico. O nome tem que ser igual ao da página de modelos do OpenRouter. Deixe vazio para o roteamento automático.
- **Enable prompt caching** envia dicas de cache para os modelos Claude roteados pelo OpenRouter. A maioria dos outros modelos faz cache por conta própria.

### NanoGPT

**NanoGPT** é um agregador sem lista de modelos embutida. Depois que você conecta, o seletor carrega os modelos que a sua conta pode usar. Ele lê o catálogo detalhado do NanoGPT e marca quais modelos a sua assinatura cobre:

| Indicador | Significado |
| --- | --- |
| `1x` em verde | Incluído na sua assinatura, com consumo normal. |
| Um valor maior, como `2x` | Incluído, mas cada token de entrada consome essa quantidade de tokens da sua cota. |
| **Paid** (pago) | Não incluído. O uso é cobrado do seu saldo pago. |
| Sem indicador | O NanoGPT não tinha dados de assinatura para ele. |

#### Uso da assinatura

Com uma assinatura do NanoGPT, a conta pode mostrar a sua cota atual.

1. Clique em **⋯** na linha da conta, escolha **Edit account** (editar conta) e abra **Usage and balance** (uso e saldo).
2. Se as leituras externas estiverem desligadas, clique em **Turn on** (ativar). Para adicionar uma chave de gerenciamento, clique em **Add a usage-only key** (adicionar uma chave só de uso), cole a chave e clique em **Show usage** (mostrar o uso).
3. Ative **Show the usage meter on the card** (mostrar o medidor de uso no card) e salve.

O medidor mostra as suas cotas semanais e diárias de tokens de entrada, com o que resta e quando cada uma é reiniciada, por exemplo `42M remaining · resets in 4d`. Uma cota que o NanoGPT não consegue informar aparece como desconhecida, e não como não utilizada. Uma assinatura inativa é indicada explicitamente, em vez de aparecer como cheia. O botão de atualizar faz a leitura de novo.

Duas credenciais podem ler o uso:

- **Management key** (chave de gerenciamento), a recomendada. Crie uma em `https://nano-gpt.com/settings#management-api-tokens` só para leituras de uso. Ela lê as cotas, mas não pode executar modelos nem gastar o seu saldo. Marinara a armazena criptografada e a envia só ao endpoint de gerenciamento do NanoGPT.
- **Sua chave de API**, usada quando não há chave de gerenciamento salva. Funciona, mas a leitura da cota passa a usar uma chave que pode gastar o seu saldo.

O mesmo medidor aparece abaixo da barra de contexto no seletor de conexão de um chat e nas configurações de **Connection** (conexão) do chat. Ele só aparece quando o modelo do chat é do NanoGPT e está com o medidor ativado, e não aparece em **Shuffle** (sortear).

### xAI / Grok

**xAI / Grok** roda os modelos Grok. Grok 4.6 e 4.7 têm uma janela de contexto de 500.000 tokens e raciocínio até **Extra high** (extra alto). Eles têm suporte às ferramentas do chat, incluindo **Web Search** (pesquisa na web), para que os resultados de pesquisa alimentem a resposta final.

### Arli AI

**Arli AI** é um serviço de chat hospedado sem lista de modelos embutida. Depois que você conecta, o seletor carrega os modelos dele. Para imagens da Arli AI, adicione **Arli AI** e escolha modelos **Image** na mesma conta.

### Z.AI

**Z.AI** oferece os modelos GLM (GLM 5.3, GLM 5.3 Flash e anteriores) pela própria API. Os modelos GLM 5.2 e 5.3 aceitam o nível de raciocínio **Maximum** (máximo). O endereço padrão é o endpoint com cobrança por uso. O Coding Plan da Z.AI usa outro endpoint, então uma chave do Coding Plan pode não funcionar aqui.

### DeepSeek

**DeepSeek** oferece `deepseek-flash` e `deepseek-v4-pro`. A DeepSeek raciocina por padrão. O **Reasoning Effort** (esforço de raciocínio) dela usa os níveis próprios da DeepSeek, e **Off** (desativado) desliga o raciocínio naquela requisição. A DeepSeek trata uma requisição de nível médio como High. O raciocínio aparece na resposta, na exibição habitual do raciocínio.

Alguns parâmetros não se aplicam, por isso o painel os deixa de fora: **Verbosity**, **Top K** e as penalidades foram descontinuados e são ignorados. **Temperature** (temperatura) e **Top P** formam um par, porque a DeepSeek usa um de cada vez. Você vê **Temperature** quando o raciocínio está desativado e **Top P** quando está ativado.

Conecte a DeepSeek pelo botão próprio dela, e não apontando **OpenAI** para o endereço da DeepSeek. O serviço OpenAI espera os modelos da OpenAI; por isso, com um modelo da DeepSeek, ele esconde os controles de geração e não envia quase nenhum dos seus ajustes.

### OpenAI-compatible

**OpenAI-compatible** (compatível com OpenAI) conecta um servidor ou proxy que aceita o formato de requisição da OpenAI, como Ollama, LM Studio ou KoboldCpp. Na janela **Add account**, ele aparece como **OpenAI-compatible address** (endereço compatível com OpenAI). Na maioria dos servidores locais, a chave pode ficar vazia. Você informa o endereço. Veja [Conectar um modelo local ou auto-hospedado](local-self-hosted.md). Para o modelo pequeno que Marinara roda sozinho, veja [Como configurar o Built-in model](local-model.md).

## Imagens e vídeo

Em **Images & video** (imagens e vídeo), cada botão tem o próprio endereço e a própria regra sobre exigir ou não uma chave. Os botões são Stability AI, Together AI, NovelAI, Venice.ai, Atlas Cloud, fal.ai, SpicyAPI, Pollinations, Stable Horde, Seedance 2.0 e servidores locais: ComfyUI, SD Web UI (AUTOMATIC1111 / Forge), SwarmUI, RunPod Serverless (ComfyUI), Draw Things e Block Entropy. Draw Things, ComfyUI, SwarmUI, SD Web UI e RunPod têm a etiqueta **Self-hosted** (auto-hospedado).

Os modelos de imagem e vídeo da OpenAI, do OpenRouter, da xAI, do NanoGPT, da Arli AI, da Z.AI e do Google vêm da sua conta de chat desse serviço. Adicione a conta de chat e escolha nela modelos **Image** ou **Video** (vídeo).

Veja [Provedores de geração de imagens e configuração](../media/image-providers.md) e [Geração de vídeo de cena](../media/scene-video.md).

## Decisão

Em **Decisions** (decisões), os botões são **TypeSafe** (endereço padrão `https://api.typesafe.ai`), **Own decision server** e **Built-in model (decisions)**. Os serviços de chat que usam o formato de chat da OpenAI também podem fazer decisões, mas só com um modelo que retorne log-probabilidades (pontuações para cada resposta possível). Um modelo de decisão responde a perguntas de sim ou não sobre o seu chat. Veja [Modelos de decisão](decision-models.md).

<a id="audio"></a>

## Áudio

Em **Voice** (voz), um serviço de áudio fala as vozes dos personagens e a narração. Escolha uma **Audio source** (fonte de áudio):

| Fonte | O que é |
| --- | --- |
| ElevenLabs | Vozes de personagens e narração. |
| OpenAI-compatible | OpenAI, ou qualquer servidor que copie o formato de fala da OpenAI. |
| PocketTTS | Um servidor de voz gratuito que você roda no seu próprio computador. |
| xAI Voice | O serviço de voz da xAI. |

Cada fonte preenche um endereço e um modelo padrão. **Default voice** (voz padrão) é a voz usada quando nada mais específico, como uma voz por personagem, está definido. **Request timeout (seconds)** (tempo limite da requisição, em segundos) é quanto tempo Marinara espera por uma fala. Aumente esse valor para um servidor de voz lento.

Para escolher a conta de fala que Marinara usa por padrão, clique na linha **Voice (Text to Speech)** (voz: texto para fala) da caixa **Jobs** (tarefas). Para ler mensagens em voz alta com uma delas, escolha-a como **Source** (origem) no card **Text to Speech**. Veja [Configuração de Text to Speech (TTS)](../media/tts-setup.md) e [Usar uma conexão de áudio](../media/tts-setup.md#use-an-audio-connection).

<a id="music--sound-effects"></a>

## Música e efeitos sonoros

Este tipo de conta gera música instrumental e efeitos sonoros, separadamente da fala. A janela **Add account** não tem um botão para ele. Essas contas vêm de uma atualização (veja abaixo) ou de uma importação. Você edita uma delas com **Edit model** (editar modelo). Ali, escolha o serviço dela e ative **Music generation** (geração de música), **Sound-effect generation** (geração de efeitos sonoros) ou as duas opções. A configuração de Game pede uma em **Music & Sound Effects account** (conta de música e efeitos sonoros), e a opção padrão é **Use the default Music & Sound Effects account** (usar a conta padrão de música e efeitos sonoros).

Os serviços:

- **ElevenLabs**: endereço padrão `https://api.elevenlabs.io`. Precisa de uma chave da ElevenLabs. Música e efeitos sonoros têm campos de modelo separados.
- **SunoAPI**: endereço padrão `https://apibox.erweima.ai`. Precisa de uma chave de [sunoapi.org](https://sunoapi.org/) e, quando a música está ativada, de uma **SunoAPI music callback URL** (URL de callback de música da SunoAPI) pública em HTTPS. Este é o serviço próprio da SunoAPI, não um login de assinatura do Suno.
- **Custom compatible server** (servidor compatível personalizado): o endereço do seu servidor. Precisa de um caminho explícito de endpoint de música ou de efeitos sonoros e de um formato de requisição compatível. Veja [contratos de áudio compatível](../media/tts-setup.md#game-music-and-sound-effects-on-a-compatible-audio-server).

Observações:

- A SunoAPI precisa do endereço de callback, embora Marinara verifique por conta própria quando a faixa fica pronta. Você fornece o endereço. Marinara não cria um.
- Os prompts de estilo musical aceitam até 1.000 caracteres. Os prompts de efeitos sonoros aceitam até 500.
- Cada requisição pode ter um custo no seu provedor. Veja a [API de música](https://docs.sunoapi.org/suno-api/generate-music) e a [API de efeitos sonoros](https://docs.sunoapi.org/suno-api/generate-sounds). Os efeitos sonoros da SunoAPI ainda não foram verificados com uma conta paga.

Na atualização, cada conta de Audio com geração ativada ganha uma conta separada de Music & Sound Effects. As configurações antigas e independentes da ElevenLabs para Game podem criar uma conta própria, então pode aparecer mais de uma. As contas de fala e as vozes atribuídas não mudam, e os IDs de conta salvos de Game também não. A geração só funciona quando a conta migrada correspondente está disponível e tem a opção de música ou de efeitos sonoros ativada. Caso contrário, escolha outra conta adequada. Remover uma conta migrada não a recria na próxima inicialização. Endpoints restaurados de um perfil ficam indisponíveis até que você os revise e salve localmente.

Ative o áudio gerado em cada Game, ou ative **Sound effects** (efeitos sonoros) nas configurações de comandos de Roleplay para usar `[sound: description]`. O Gacha Forge tem uma configuração própria de áudio generativo. O áudio padrão de Game continua disponível quando a geração está desligada.

## Embeddings

Os embeddings transformam texto em listas de números para que Marinara encontre textos relacionados. Eles são a base da busca semântica dos lorebooks e do Memory Recall. A maioria dos serviços de chat permite definir um modelo de embedding e, se quiser, uma **Embedding endpoint URL** (URL do endpoint de embedding) em **Semantic search (embeddings)** (busca semântica por embeddings), no editor do modelo.

**Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)** e **Grok CLI (Subscription)** não geram embeddings. Nesses casos, use o menu suspenso **Embedding provider** (provedor de embeddings) para emprestar outra conta, como uma compatível com OpenAI, **Google Gemini** ou o **Built-in model** (modelo embutido).

Para usar uma mesma fonte de embedding em todas as contas que não têm configurações de embedding próprias, clique na linha **Embeddings** da caixa **Jobs**. **Marinara's own search** (a busca do próprio Marinara) mantém o modelo de embedding embutido. O modelo de embedding próprio de uma conta, ou o **Embedding provider** dela, continua tendo prioridade. Vetorize de novo os seus lorebooks e memórias depois de mudar essa opção. Veja [Busca semântica para lorebooks](../lorebooks/semantic-search.md).

## Tempos limite

Modelos lentos podem atingir os tempos limite do servidor para respostas do chat e chamadas de agentes. As configurações do servidor para eles estão em [Referência de configuração do servidor](../CONFIGURATION.md).

## Guias relacionados

- [Conectando a um provedor de IA](connecting-to-a-provider.md)
- [Conexões por assinatura do Claude, do ChatGPT e do Grok](subscription-clis.md)
- [Conectar um modelo local ou auto-hospedado](local-self-hosted.md)
- [Provedores de geração de imagens e configuração](../media/image-providers.md)
- [Geração de vídeo de cena](../media/scene-video.md)
- [Modelos de decisão](decision-models.md)
- [Configuração de Text to Speech (TTS)](../media/tts-setup.md)
