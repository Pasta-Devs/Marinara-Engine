# Provedores de IA compatíveis

Este guia lista todos os provedores de IA aos quais Marinara Engine consegue se conectar. Para cada um, você vê onde conseguir a chave de API, a URL base padrão e as particularidades que valem atenção. A chave de API é um código secreto, parecido com uma senha, que o provedor fornece para Marinara conversar com o serviço de IA dele.

Para conhecer os passos gerais de como adicionar uma conexão, leia antes [Conectando a um provedor de IA](connecting-to-a-provider.md). Esta página é uma referência para consultar quando você quiser detalhes de um provedor específico.

## Como usar esta página

Você escolhe o provedor ao criar uma conexão no painel **Connections** (Conexões). Cada provedor tem um botão **Provider** (provedor) na janela **Create Connection** (criar conexão), com exatamente o nome mostrado abaixo.

A maioria dos provedores desta página são serviços de nuvem que hospedam a IA para você. Você cria uma conta no provedor, copia a chave de API e cola no campo **API Key** (chave de API). Três provedores por assinatura usam um login local em vez de uma chave. As seções deles avisam isso.

Dois termos aparecem o tempo todo:

- URL base: o endereço para onde Marinara envia as requisições. A maioria dos provedores já preenche esse campo. Você só muda em servidores locais ou personalizados.
- Modelo: o modelo de IA que você escolhe depois de definir o provedor. Os modelos disponíveis mudam com frequência, por isso esta página não lista nenhum. Veja a lista atual no menu suspenso **Model** (modelo) ou no botão **Fetch Models from API** (buscar modelos na API), dentro do editor de conexão.

## OpenAI

- Onde conseguir a chave: `https://platform.openai.com/api-keys`
- URL base padrão: `https://api.openai.com/v1`

**OpenAI** mantém a família de modelos GPT. Depois de colar a chave, escolha um modelo no menu suspenso ou clique em **Fetch Models from API** para carregar a lista atual. Esta conexão serve só para modelos de chat. Para imagens do DALL-E, use o provedor **Image Generation** (geração de imagens) e o serviço **OpenAI (DALL-E)**.

## Anthropic

- Onde conseguir a chave: `https://console.anthropic.com/settings/keys`
- URL base padrão: `https://api.anthropic.com/v1`

**Anthropic** mantém os modelos Claude. Há suporte a cache de prompt (o prompt é o texto que Marinara envia para a IA), o que pode baratear os chats longos. Ative esse recurso no botão liga/desliga **Enable prompt caching** (ativar o cache de prompt), no editor de conexão.

**Anthropic** não oferece embeddings. O embedding é a representação numérica de um texto: com ela, Marinara consegue buscar dentro dos lorebooks (conjuntos de fatos do seu mundo) e da memória. Para esses recursos, use uma conexão de embedding separada (veja a seção Embeddings mais abaixo).

## Google Gemini

- Onde conseguir a chave: `https://aistudio.google.com/apikey`
- URL base padrão: `https://generativelanguage.googleapis.com/v1beta`

**Google Gemini** roda os modelos Gemini pelo Google AI Studio. Das duas opções do Google, esta é a mais simples.

## Google Vertex AI

- Documentação das credenciais: `https://cloud.google.com/vertex-ai/docs/authentication`
- URL base padrão: `https://us-central1-aiplatform.googleapis.com/v1/projects/YOUR_PROJECT_ID/locations/us-central1`

**Google Vertex AI** roda os modelos Gemini dentro de um projeto do Google Cloud. A configuração dá mais trabalho que a de **Google Gemini**. Edite o campo **Base URL** (URL base) e troque `YOUR_PROJECT_ID` pelo ID real do projeto. Mude também a região, se não for `us-central1`.

O campo **API Key** aceita qualquer um destes três tipos de credencial, e Marinara identifica sozinho qual foi colado:

1. Uma chave JSON de conta de serviço.
2. Um token de acesso OAuth, por exemplo o gerado por `gcloud auth print-access-token`.
3. Uma chave de API da Vertex.

## Mistral

- Onde conseguir a chave: `https://console.mistral.ai/api-keys`
- URL base padrão: `https://api.mistral.ai/v1`

**Mistral** mantém a família de modelos Mistral. Fora a chave de API, não é preciso configurar mais nada.

## Cohere

- Onde conseguir a chave: `https://dashboard.cohere.com/api-keys`
- URL base padrão: `https://api.cohere.ai/compatibility/v1`

**Cohere** usa por padrão o endpoint compatível com OpenAI. Se você colar uma URL antiga da v2 da Cohere, Marinara troca sozinho pelo endpoint de compatibilidade. As requisições continuam funcionando.

## OpenRouter

- Onde conseguir a chave: `https://openrouter.ai/keys`
- URL base padrão: `https://openrouter.ai/api/v1`

**OpenRouter** é um agregador. Uma única chave dá acesso a muitos modelos de muitas empresas. Ele acrescenta duas opções no editor de conexão:

- **Preferred Provider** (provedor preferido): campo de texto que obriga **OpenRouter** a usar um backend específico. O nome tem que ser igual ao que aparece na página de modelos do OpenRouter. Deixe vazio para o roteamento automático.
- **Enable prompt caching**: envia as dicas de cache para os modelos Claude roteados pelo **OpenRouter**. A maioria dos outros modelos do **OpenRouter** faz o cache por conta própria e não precisa disso.

## NanoGPT

- Onde conseguir a chave: `https://nano-gpt.com/api`
- URL base padrão: `https://nano-gpt.com/api/v1`

**NanoGPT** também é um agregador. Ele não traz uma lista de modelos embutida, então o menu suspenso **Model** começa vazio. Depois de colar a chave, clique em **Fetch Models from API** para carregar os modelos que a conta pode usar.

## xAI / Grok

- Onde conseguir a chave: `https://console.x.ai`
- URL base padrão: `https://api.x.ai/v1`

**xAI / Grok** mantém os modelos Grok. Ao escolher esse provedor na janela **Create Connection**, Marinara já preenche o modelo com Grok 4.5. Você pode trocar o modelo depois.

## Z.AI

- Onde conseguir a chave: `https://z.ai/manage-apikey/apikey-list`
- URL base padrão: `https://api.z.ai/api/paas/v4`

**Z.AI** oferece os modelos GLM (GLM 5.3, GLM 5.3 Flash e anteriores) pela própria API. A lista **Model** mostra os modelos GLM atuais, e **Fetch Models from API** a atualiza a partir da sua conta. Os modelos GLM 5.3 sempre usam raciocínio: o ajuste **Reasoning Effort** (esforço de raciocínio) do seu preset é convertido nos três níveis aceitos pela Z.AI: **Low** (baixo), **High** (alto) e **Maximum** (máximo). Se você não definir esse ajuste, será usado o padrão da Z.AI: **Maximum**. A URL base padrão é o endpoint com cobrança por uso. O Coding Plan da Z.AI usa outro endpoint que a política de uso reserva às ferramentas da lista do provedor, então não se espera que uma chave desse plano funcione aqui.

## Claude (Subscription)

- Chave de API: nenhuma. Em vez disso, você faz login em uma ferramenta local.

**Claude (Subscription)** usa o plano Anthropic Pro ou Max pela ferramenta Claude Code. A ferramenta roda no computador que hospeda o servidor Marinara, e o login é feito uma vez só. Os campos **API Key** e **Base URL** ficam escondidos nesse provedor. Ele não oferece embeddings (veja a seção Embeddings mais abaixo).

Os passos de instalação e login estão em [Conexões por assinatura do Claude, do ChatGPT e do Grok](subscription-clis.md).

## OpenAI (ChatGPT)

- Chave de API: nenhuma. Em vez disso, você faz login em uma ferramenta local.

**OpenAI (ChatGPT)** usa a conta do ChatGPT pela ferramenta Codex. A ferramenta roda no computador que hospeda o servidor Marinara, e o login é feito uma vez só. Os campos **API Key** e **Base URL** ficam escondidos nesse provedor. Ele não oferece embeddings (veja a seção Embeddings mais abaixo).

Os passos de instalação e login estão em [Conexões por assinatura do Claude, do ChatGPT e do Grok](subscription-clis.md).

## Grok CLI (Subscription)

- Chave de API: nenhuma. Em vez disso, você faz login em uma ferramenta local.

**Grok CLI (Subscription)** usa a conta SuperGrok ou X Premium+ pela ferramenta Grok CLI. A ferramenta roda no computador que hospeda o servidor Marinara, e o login é feito uma vez só. Os campos **API Key** e **Base URL** ficam escondidos nesse provedor. Ele não oferece embeddings (veja a seção Embeddings mais abaixo).

Os passos de instalação e login estão em [Conexões por assinatura do Claude, do ChatGPT e do Grok](subscription-clis.md).

## Custom (OAI-Compatible)

- URL base padrão: nenhuma. Você precisa digitar uma.

Escolha **Custom (OAI-Compatible)** para conectar um servidor de modelos local ou hospedado por você, como Ollama, LM Studio ou KoboldCpp. Serve também para qualquer proxy hospedado que fale o formato de chat da OpenAI. Na maioria dos servidores locais, o campo **API Key** pode ficar vazio. Coloque o endereço do servidor no campo **Base URL**.

Para a configuração passo a passo e para o botão liga/desliga **Treat as local/custom endpoint** (tratar como endpoint local/personalizado), leia [Conectar um modelo local ou auto-hospedado](local-self-hosted.md). Para o modelo pequeno que já vem dentro do Marinara, leia [Como configurar o Local Model](local-model.md).

## Image Generation

**Image Generation** é um provedor especial. Depois de escolhê-lo, você escolhe também um **Service** (serviço), que é o backend de imagem responsável pelo trabalho. Cada serviço tem a própria URL base padrão e a própria regra sobre exigir ou não uma chave de API. Entre os serviços há APIs de nuvem pagas, como **OpenAI (DALL-E)**, **Stability AI**, **NovelAI** e **Z.AI**. Há também opções gratuitas, como **Pollinations** e **Stable Horde**. Servidores locais como **ComfyUI** e **SD Web UI (AUTOMATIC1111 / Forge)** também funcionam.

A lista completa dos serviços de imagem, a configuração de cada um e os ajustes de geração estão em [Provedores de geração de imagens e configuração](../media/image-providers.md).

## Video Generation

**Video Generation** também é um provedor especial, com um seletor próprio: o **Video Service** (serviço de vídeo). Game Mode usa esse provedor para criar vídeos MP4 curtos das cenas. Os serviços são **Google AI Studio**, **xAI Imagine**, **OpenRouter Video** e **Seedance 2.0**. Todo serviço precisa de uma chave de API.

A configuração completa e os limites de cada serviço de vídeo estão em [Geração de vídeo de cena](../media/scene-video.md).

## Embeddings

Os embeddings são a base da busca semântica dos lorebooks e do **Memory Recall**. Eles transformam texto em listas de números, e assim Marinara encontra as entradas relacionadas. Na maioria dos provedores de chat, você define um **Embedding Model** (modelo de embedding) e, se quiser, uma **Embedding Endpoint URL** (URL do endpoint de embedding) no editor de conexão.

Alguns provedores não geram embeddings. **Anthropic**, **Claude (Subscription)**, **OpenAI (ChatGPT)** e **Grok CLI (Subscription)** não oferecem esse recurso. Nesses casos, use o menu suspenso **Embedding Connection** (conexão de embedding) para emprestar outra conexão, como uma compatível com OpenAI, **Google Gemini** ou o **Local Model** embutido.

## Guias relacionados

- [Conectando a um provedor de IA](connecting-to-a-provider.md)
- [Conexões por assinatura do Claude, do ChatGPT e do Grok](subscription-clis.md)
- [Conectar um modelo local ou auto-hospedado](local-self-hosted.md)
- [Provedores de geração de imagens e configuração](../media/image-providers.md)
- [Geração de vídeo de cena](../media/scene-video.md)
