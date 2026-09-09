# Provedores de geração de imagens e configuração

Neste guia você aprende a conectar um serviço de geração de imagens ao Marinara Engine. Ele também mostra o que cada um dos 17 serviços exige. A geração de imagens alimenta as ilustrações de cena, as selfies, os planos de fundo de cena e os avatares, retratos e sprites gerados.

A geração de imagens é configurada como um tipo especial de conexão. Depois que uma conexão de imagem funciona, todos os recursos de imagem do aplicativo podem usá-la.

## Como adicionar uma conexão de geração de imagens

Uma **API key** (chave de API) é uma senha secreta do provedor que autoriza Marinara a usar a sua conta. A **Base URL** (endereço base) é o endereço web da interface de aplicação do serviço. Marinara preenche a Base URL correta assim que você escolhe um serviço.

Siga estes passos para adicionar uma conexão de imagem:

1. Abra o painel **Connections** (Conexões).
2. Clique em **New** (novo) para abrir a janela **Create Connection**.
3. Digite um nome e escolha o provedor **Image Generation**.
4. No editor de conexão, escolha um **Service** na grade.
5. Cole a chave de API no campo **API Key**, caso o serviço exija uma. Serviços gratuitos e locais não exigem.
6. Escolha um **Model** na lista ou digite o ID de um modelo. Alguns serviços oferecem **Fetch Models from API** (buscar modelos pela API) para carregar a lista atual.
7. Clique em **Save** (salvar).
8. Clique em **Test Image** (testar imagem) para confirmar que funciona. Marinara gera uma pequena imagem de teste.

Se o botão **Test Image** devolver uma figura, a conexão está pronta. Se falhar, confira a chave de API e a Base URL.

## Como escolher um serviço

Os 17 serviços se dividem em três grupos. Os serviços de nuvem exigem uma chave de API e uma conta. Os serviços gratuitos não exigem chave. Os serviços locais rodam um programa de imagens no seu próprio computador.

A tabela abaixo mostra cada serviço de relance. Os detalhes e as particularidades vêm nas seções de cada serviço.

| Serviço | Chave de API | Onde roda |
| --- | --- | --- |
| OpenAI (DALL-E) | Sim | Nuvem |
| Stability AI | Sim | Nuvem |
| Together AI | Sim | Nuvem |
| NovelAI | Sim | Nuvem |
| OpenRouter Images | Sim | Nuvem |
| xAI / Grok Imagine | Sim | Nuvem |
| Venice.ai | Sim | Nuvem |
| Z.AI | Sim | Nuvem |
| Atlas Cloud | Sim | Nuvem |
| NanoGPT | Sim | Nuvem |
| Block Entropy | Sim | Nuvem |
| RunPod Serverless (ComfyUI) | Sim | Nuvem |
| Pollinations | Não | Nuvem gratuita |
| Stable Horde | Opcional | Nuvem gratuita |
| SD Web UI (AUTOMATIC1111 / Forge) | Não | Local |
| ComfyUI | Não | Local |
| Draw Things | Não | Local |

## OpenAI (DALL-E)

Serviço de nuvem com a Base URL padrão `https://api.openai.com/v1`. Exige uma chave de API da sua conta OpenAI. Oferece os modelos DALL-E e GPT Image. Aceita até 16 imagens de referência.

## Stability AI

Serviço de nuvem com a Base URL padrão `https://api.stability.ai/v2beta`. Exige uma chave de API da Stability AI. Oferece os modelos Stable Diffusion e Stable Image.

## Together AI

Serviço de nuvem com a Base URL padrão `https://api.together.xyz/v1`. Exige uma chave de API da Together AI. Oferece FLUX e outros modelos de imagem abertos.

## NovelAI

Serviço de nuvem com a Base URL padrão `https://image.novelai.net`. Exige uma chave de API da NovelAI. É focado em arte no estilo anime. Nos modelos V4, V4.5 e V5, Marinara envia prompts nativos de personagem com posições para storyboards e cenas do Illustrator com vários personagens. Alguns recursos mais novos, como as imagens de referência precisas, só funcionam em um modelo V4.5.

## OpenRouter Images

Serviço de nuvem com a Base URL padrão `https://openrouter.ai/api/v1`. Exige uma chave de API do OpenRouter. Ele alcança os modelos de imagem pela interface de chat do OpenRouter, então os modelos disponíveis variam de conta para conta.

## xAI / Grok Imagine

Serviço de nuvem com a Base URL padrão `https://api.x.ai/v1`. Exige uma chave de API da xAI. Usa o Grok Imagine para gerar as imagens.

## Venice.ai

Serviço de nuvem com a Base URL padrão `https://api.venice.ai/api/v1`. Exige uma chave de API da Venice. Use **Fetch Models from API** para carregar os modelos de imagem disponíveis na sua conta. Marinara usa o endpoint de imagem nativo da Venice, desativa o desfoque opcional do modo seguro da Venice e converte automaticamente as dimensões pedidas para o formato de tamanho de cada modelo, seja em pixels, em proporção de tela ou em faixas de resolução. Ainda assim, as políticas do provedor ou os limites do modelo podem recusar uma requisição.

## Z.AI

Serviço de nuvem com a Base URL padrão `https://api.z.ai/api/paas/v4`. Exige uma chave de API comum da Z.AI; as chaves do GLM Coding Plan e o endpoint `/api/coding/paas/v4` não valem para a geração de imagens. Use **Fetch Models from API** para escolher **GLM-Image** ou **CogView 4**. Marinara converte a proporção de tela pedida para um tamanho aceito pelo modelo escolhido, envia a requisição ao endpoint de imagem nativo da Z.AI e baixa para o armazenamento local a URL temporária do resultado. Esta primeira versão só faz texto para imagem e não envia imagens de referência.

## Atlas Cloud

Serviço de nuvem com a Base URL padrão `https://api.atlascloud.ai/api/v1`. Exige uma chave de API da Atlas Cloud. Marinara traz um pequeno catálogo inicial com Nano Banana, Gemini Flash Image e FLUX 1.1 Pro, e você pode digitar o ID exato de outro modelo de imagem da Atlas Cloud. Os trabalhos rodam de forma assíncrona: Marinara inicia a geração e consulta a Atlas Cloud repetidamente até a imagem ficar pronta. Os controles comuns de texto para imagem são convertidos automaticamente; as imagens de referência são enviadas para os IDs de modelo que anunciam comportamento de imagem para imagem, de edição ou Kontext. Como os esquemas dos modelos da Atlas variam, consulte a documentação da Atlas Cloud sobre o modelo escolhido ao usar outro ID de modelo.

## NanoGPT

Serviço de nuvem com a Base URL padrão `https://nano-gpt.com/api/v1`. Exige uma chave de API da NanoGPT. NanoGPT é um agregador, então use **Fetch Models from API** para carregar a lista de modelos dele.

## Block Entropy

Serviço de nuvem com a Base URL padrão `https://api.blockentropy.ai`. Exige uma chave de API. Marinara não tem um tratamento dedicado para o Block Entropy, então envia as requisições no formato compatível com OpenAI. A compatibilidade real não está confirmada: teste com **Test Image** antes de depender dele.

## RunPod Serverless (ComfyUI)

Serviço de nuvem com a Base URL padrão `https://api.runpod.ai/v2`. Ele roda um fluxo de trabalho do ComfyUI em um endpoint serverless do RunPod. Exige três coisas: o token de API do RunPod no campo **API Key**, um **RunPod Endpoint ID** e um JSON de **ComfyUI Workflow**. Veja a seção sobre o fluxo de trabalho do ComfyUI mais abaixo.

## Pollinations

Serviço de nuvem gratuito com a Base URL padrão `https://image.pollinations.ai`. Não exige conta nem chave de API. É a forma mais rápida de experimentar a geração de imagens.

## Stable Horde

Serviço de nuvem gratuito com a Base URL padrão `https://stablehorde.net/api/v2`. É uma rede colaborativa. A chave de API é opcional. Uma chave gratuita dá mais prioridade na fila.

## SD Web UI (AUTOMATIC1111 / Forge)

Serviço local com a Base URL padrão `http://localhost:7860`. Ele conversa com um Stable Diffusion Web UI rodando no seu próprio computador. Você precisa iniciar esse programa com a interface de aplicação ativada. Nenhuma chave de API é necessária.

## ComfyUI

Serviço local com a Base URL padrão `http://127.0.0.1:8188`. Ele conversa com um servidor ComfyUI rodando no seu próprio computador. Aceita um fluxo de trabalho personalizado, descrito abaixo. Nenhuma chave de API é necessária.

## Draw Things

Serviço local com a Base URL padrão `http://localhost:7860`. Ele conversa com o aplicativo Draw Things no macOS ou no iOS. Marinara o trata como um servidor AUTOMATIC1111. Nenhuma chave de API é necessária.

## Serviços locais na sua rede

A palavra `localhost` (também chamada de loopback) significa o mesmo computador que roda Marinara. Servidores de imagem locais nesse mesmo computador funcionam sem nenhuma configuração extra.

Se o servidor de imagens roda em outro computador da rede doméstica, você precisa liberar os endereços de rede local na configuração do servidor. Veja a [Referência de configuração do servidor](../CONFIGURATION.md) para saber como fazer isso.

Alguns provedores devolvem uma URL em vez dos bytes da imagem. Nesse caso, o Marinara baixa as URLs públicas de CDN passando pelas verificações de segurança normais para requisições de saída. Uma URL de resultado privada ou de loopback só é aceita quando o esquema, o nome do host e a porta batem exatamente com os do provedor de imagens configurado. Redirecionamentos a partir dessa origem privada não podem pular para outro serviço local. Se um proxy local armazena os resultados em outra origem privada, configure o proxy para servir esses arquivos pela mesma origem da API de imagens dele.

## JSON de fluxo de trabalho do ComfyUI e RunPod

Para **ComfyUI** e **RunPod Serverless (ComfyUI)**, aparece um campo **ComfyUI Workflow**. Cole nele um JSON de fluxo de trabalho exportado do ComfyUI com **Save (API Format)**, **Export (API)** ou **Export to API**, conforme a versão do frontend. O campo aparece como Optional para **ComfyUI** e como Required para **RunPod Serverless (ComfyUI)**.

Marinara preenche o fluxo de trabalho por meio de marcadores. Coloque estas marcas de texto no fluxo de trabalho, onde cada valor deve entrar.

- `%prompt%` e `%negative_prompt%` para os prompts.
- `%width%`, `%height%` e `%seed%` para o tamanho da imagem e a seed.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%` e `%denoise%` para as configurações de geração.
- `%reference_image%` e `%reference_image_01%` até `%reference_image_04%` para inserir os dados das imagens de referência.
- `%reference_image_name%` e `%reference_image_name_01%` até `%reference_image_name_04%` para fazer upload das imagens de referência e inserir os nomes de arquivo delas em um nó LoadImage de um ComfyUI local.

O marcador `%prompt%` é o mais importante. O editor avisa quando ele está faltando. No caso do **ComfyUI**, deixar o campo vazio faz Marinara usar um fluxo de trabalho padrão embutido. No caso do **RunPod Serverless (ComfyUI)**, o fluxo de trabalho é obrigatório, porque o endpoint não tem um padrão. Os dois aceitam até 4 imagens de referência em base64 puro; os marcadores de upload por nome de arquivo existem apenas para o ComfyUI local.

Veja [Configuração de workflows do ComfyUI](comfyui.md) para o processo completo de exportação, exemplos de JSON, regras de aspas nos marcadores, configuração das imagens de referência, fluxos de trabalho por personagem, acesso pela rede local e solução de problemas.

## Local Image Defaults por conexão

Quando o serviço é **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI** ou **Draw Things**, aparece na conexão um painel **Local Image Defaults** (padrões de imagem local). No caso do **Draw Things**, o painel mostra os mesmos campos e os mesmos padrões do **SD Web UI (AUTOMATIC1111 / Forge)**. Essas configurações só valem quando esta conexão gera uma imagem. O botão **Reset** (redefinir) restaura os valores embutidos.

Todos esses quatro serviços mostram um campo **Seed**. O valor -1 mantém cada imagem aleatória. Qualquer outro número reaproveita exatamente a mesma seed todas as vezes.

Os demais campos dependem do serviço.

| Serviço | Campo | Padrão |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG Scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2Img Denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG Scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt Guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise Schedule | karras |

Cada serviço também tem os campos de texto **Prompt Prefix** e **Negative Prefix**. O texto colocado ali entra na frente de todo prompt desta conexão. Tanto AUTOMATIC1111 / Forge quanto ComfyUI têm um campo **Clip Skip**. AUTOMATIC1111 / Forge acrescenta um botão liga/desliga **Restore faces**. ComfyUI acrescenta um botão liga/desliga chamado **Upload a 1x1 placeholder when no reference image is provided**. Ele só importa em fluxos de trabalho personalizados que tenham marcadores de imagem de referência. NovelAI acrescenta os campos **Guidance Rescale** e **UC Preset**.

## O suporte a imagens de referência varia conforme o provedor

Uma **imagem de referência** é uma figura já existente que você envia junto com o prompt. Ela ajuda a nova imagem a manter o rosto de um personagem ou um estilo de arte. Cada provedor aceita uma quantidade diferente.

| Provedor | Imagens de referência |
| --- | --- |
| OpenAI (DALL-E) | Até 16 |
| NovelAI | Até 16, somente no modelo V4.5 |
| xAI / Grok Imagine | Até 3 |
| Venice.ai | Sem suporte na geração de texto para imagem |
| Z.AI | Sem suporte na integração atual de texto para imagem |
| Atlas Cloud | Primeira imagem, em IDs de modelo compatíveis com imagem para imagem, edição ou Kontext |
| NanoGPT | Até 3 |
| Stability AI | Somente a primeira imagem, usada como imagem para imagem |
| OpenRouter Images | Com suporte, sem limite fixo |
| ComfyUI e RunPod Serverless (ComfyUI) | Até 4, por meio dos marcadores do fluxo de trabalho |
| Together AI, Pollinations, Stable Horde | Sem suporte |

As imagens de referência precisas da NovelAI só funcionam em um modelo V4.5, como `nai-diffusion-4-5-full`. A NovelAI ainda não lançou o Precise Reference para o V5. Se você pedir referências em outro modelo, Marinara gera a imagem sem elas e registra um aviso no log do servidor.

## Enfileirar as requisições de geração de imagens

O botão liga/desliga **Queue image generation requests** fica em **Settings** (Configurações), depois **Generations**, depois **Image Generation**. Ele vem ativado por padrão.

Com ele ativado, Marinara envia os trabalhos de imagem um de cada vez. Mantenha assim nos serviços que recusam duas requisições simultâneas. Desative apenas se o serviço aguentar muitas requisições ao mesmo tempo e você quiser mais velocidade.

## Guias relacionados

- [Configuração de workflows do ComfyUI](comfyui.md) explica passo a passo o JSON de fluxo de trabalho local e do RunPod.
- [Agente Illustrator](illustrator-agent.md) configura as ilustrações de cena automáticas.
- [Perfis de estilo de imagem](style-profiles.md) define a aparência de todas as imagens geradas.
- [Planos de fundo de cena e a galeria](scene-backgrounds.md) trata dos planos de fundo de cena gerados.
- [Selfies](../conversation/selfies.md) é o comando de selfie do personagem no Conversation Mode.
- [Provedores de IA compatíveis](../connections/providers-reference.md) lista todos os provedores de chat, imagem e vídeo.
