# Provedores de geração de imagens e configuração

A geração de imagens alimenta as ilustrações de cena, as selfies, os planos de fundo de cena e os avatares, retratos e sprites gerados. Este guia mostra como adicionar um serviço de imagem e o que cada serviço exige. Depois que um modelo de imagem funciona, todos os recursos de imagem do aplicativo podem usá-lo.

## Como adicionar um serviço de imagem

A chave de API é um código secreto que um serviço dá a você para que Marinara possa usar a sua conta. Marinara preenche o endereço web de cada serviço para você, então raramente é preciso digitar um.

1. Clique em **Connections** (Conexões) na barra superior e depois em **Add** (adicionar). A janela **Add account** (adicionar conta) abre.
2. Encontre o serviço. A lista tem uma seção **Images & video** (imagens e vídeo), e a caixa **Search providers** (buscar provedores) ajuda você a encontrá-lo.
3. Cole a sua chave no campo **API key** (chave de API). Serviços gratuitos e locais não precisam de chave. Para um servidor que você mesmo roda, preencha o campo de endereço.
4. Clique em **Connect** (conectar). Marinara testa a conta.
5. Escolha um modelo de imagem na lista ou digite o ID de um modelo. Esse é o seu modelo de imagem. Ele aparece abaixo da conta no painel **Connections**.
6. Abra o modelo de imagem e clique em **Test image** (testar imagem). Marinara gera uma pequena imagem de teste.
7. Para que ele seja o modelo que o aplicativo usa para as imagens, defina a tarefa **Images** (imagens) em **Defaults** (padrões), no topo do painel **Connections**.

Para adicionar outro modelo de imagem a uma conta, abra o menu **⋯** dela e clique em **Add image model** (adicionar modelo de imagem). Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md) para conhecer a janela inteira.

Se não funcionou: **Test image** falha quando a chave ou o endereço está errado. Confira os dois primeiro. **Test provider** (testar provedor) só verifica se Marinara consegue alcançar o serviço. **Test image** gera uma imagem de verdade e pode gastar crédito.

## Como obter uma imagem em um chat

Depois que um modelo de imagem estiver definido na tarefa **Images**, peça uma imagem em um chat.

1. Adicione o agente Illustrator a um chat de Roleplay. Veja [Agente Illustrator](illustrator-agent.md).
2. Abra **Chat Settings**, expanda **Gallery** (galeria) e clique em **Illustrate** (ilustrar).
3. Espere o **Generating...** terminar. A imagem aparece na Gallery.

Em um chat de Roleplay, você também pode usar o comando `/illustrate`. Veja [Comandos de barra](../chats/slash-commands.md).

## Como escolher um serviço

Marinara preenche o endereço de cada serviço para você. Os serviços de nuvem exigem uma conta, e a maioria exige uma chave de API. Os serviços gratuitos não exigem chave. Os serviços locais rodam um programa de imagens no seu próprio computador.

**Começo mais fácil:** escolha **Pollinations**. É gratuito e não exige conta nem chave. Escolha um serviço mais forte depois, se quiser imagens melhores.

| Serviço | Chave de API | Onde roda |
| --- | --- | --- |
| OpenAI (DALL-E) | Sim | Nuvem |
| ChatGPT (Codex login) | Não, usa `codex login` | Nuvem |
| Stability AI | Sim | Nuvem |
| Together AI | Sim | Nuvem |
| Arli AI | Sim | Nuvem |
| NovelAI | Sim | Nuvem |
| OpenRouter Images | Sim | Nuvem |
| xAI / Grok Imagine | Sim | Nuvem |
| Venice.ai | Sim | Nuvem |
| Z.AI | Sim | Nuvem |
| Atlas Cloud | Sim | Nuvem |
| fal.ai | Sim | Nuvem |
| SpicyAPI | Sim | Nuvem |
| NanoGPT | Sim | Nuvem |
| Block Entropy | Sim | Nuvem |
| RunPod Serverless (ComfyUI) | Sim | Nuvem |
| Pollinations | Não | Nuvem gratuita |
| Stable Horde | Opcional | Nuvem gratuita |
| SD Web UI (AUTOMATIC1111 / Forge) | Não | Local |
| ComfyUI | Não | Local |
| SwarmUI | Opcional | Local |
| Draw Things | Não | Local |

Observações sobre os serviços simples:

- **OpenAI (DALL-E)**: oferece os modelos DALL-E e GPT Image.
- **Stability AI**: modelos Stable Diffusion e Stable Image.
- **Together AI**: FLUX e outros modelos de imagem abertos.
- **OpenRouter Images**: alcança os modelos de imagem pela interface de chat do OpenRouter, então os modelos variam de conta para conta.
- **xAI / Grok Imagine**: usa o Grok Imagine.
- **NanoGPT**: é um agregador, então use a lista de modelos dele.
- **Pollinations**: a forma mais rápida de experimentar a geração de imagens. Não exige conta.
- **Stable Horde**: uma rede colaborativa. Uma chave gratuita dá mais prioridade na fila.
- **SD Web UI** e **Draw Things**: inicie o programa com a interface de aplicação ativada. Marinara trata o Draw Things como um servidor AUTOMATIC1111 (o aplicativo roda no macOS ou no iOS).
- **Block Entropy**: Marinara não tem um tratamento dedicado para ele, então envia requisições compatíveis com OpenAI. A compatibilidade não está confirmada. Teste com **Test image** antes de depender dele.

## Serviços com configuração especial

### ChatGPT (Codex login)

Este serviço usa o seu plano do ChatGPT em vez de uma chave de API, então as imagens não precisam de crédito da API da OpenAI.

1. No computador que roda Marinara, instale o CLI do Codex e execute `codex login` uma vez. É o mesmo login que a conta de chat do ChatGPT usa. Veja [Conexões por assinatura do Claude, do ChatGPT e do Grok](../connections/subscription-clis.md#openai-chatgpt).
2. Escolha o serviço. Não há chave nem endereço para preencher. Marinara preenche o modelo `gpt-image-2`, o que o Codex usa para imagens.

**Test provider** só verifica se Marinara consegue ler o seu login do Codex. **Test image** gera uma imagem de verdade e conta nos seus limites de imagem do ChatGPT. Com imagens de referência, Marinara envia uma requisição de edição com até 16 delas. O ChatGPT pode devolver um tamanho em pixels diferente, então Marinara também informa no prompt a proporção de tela desejada. Este serviço usa o endpoint de imagem do ChatGPT que o Codex usa, e não a API pública da OpenAI, então a OpenAI pode mudá-lo sem aviso prévio.

### Arli AI

Roda modelos Stable Diffusion hospedados. Um modelo é obrigatório, então digite o nome do modelo de imagem da Arli AI que você quer. Usa os mesmos campos de **Local Image Defaults** (padrões de imagem local) do SD Web UI (veja [Local Image Defaults](#local-image-defaults-per-connection)). A primeira imagem de referência é usada como imagem inicial. Este serviço é só para imagens. Para os modelos de chat da Arli AI, veja [Provedores de IA compatíveis](../connections/providers-reference.md#arli-ai).

### NovelAI

A NovelAI é focada em arte no estilo anime. Nos modelos V4, V4.5 e V5, Marinara envia prompts nativos de personagem, com posições, para storyboards e cenas do Illustrator com vários personagens. As imagens de referência precisas só funcionam em um modelo V4.5.

### Venice.ai

Marinara usa o endpoint de imagem nativo da Venice, desativa o desfoque opcional do modo seguro da Venice e converte os tamanhos pedidos para o formato de tamanho de cada modelo. Ainda assim, as políticas da própria Venice ou os limites do modelo podem recusar uma requisição.

### Z.AI

Use uma chave de API comum da Z.AI. As chaves do GLM Coding Plan e o endereço `/api/coding/paas/v4` não funcionam para imagens. Escolha **GLM-Image** ou **CogView 4**. Marinara converte a proporção de tela para um tamanho que o modelo aceita e baixa o resultado temporário para o armazenamento local. Só faz texto para imagem e não envia imagens de referência.

### Atlas Cloud

Marinara carrega o catálogo atual de modelos de texto para imagem e de imagem para imagem do Atlas Cloud. Se não conseguir, mostra uma lista inicial (Nano Banana, Gemini Flash Image, FLUX 1.1 Pro). Você sempre pode digitar o ID exato de um modelo. As tarefas rodam de forma assíncrona, então Marinara inicia a tarefa e fica consultando até a imagem ficar pronta. As imagens de referência são enviadas para os IDs de modelo que anunciam suporte a imagem para imagem, edição ou Kontext. Os esquemas dos modelos do Atlas variam, então consulte a documentação do modelo no Atlas Cloud para outros IDs.

### fal.ai

Crie uma chave de API em [fal.ai](https://fal.ai/dashboard/keys). A lista inicial tem `fal-ai/flux/schnell` e `fal-ai/flux/dev`. Você pode digitar o ID de outro endpoint de texto para imagem com entrada e saída compatíveis. **Test provider** só verifica a configuração. **Test image** envia uma requisição real e gasta crédito do fal.ai.

Marinara envia o prompt e os tamanhos e baixa a primeira imagem devolvida. Os prompts negativos são acrescentados como texto. Use **Custom Parameters** (parâmetros personalizados) para opções do modelo, como `seed`, `num_inference_steps` ou `image_size`. Ele usa requisições síncronas de texto para imagem, não envia imagens de referência e não retoma tarefas interrompidas. Veja a [referência da API](https://fal.ai/models/fal-ai/flux/schnell/api) do modelo.

### SpicyAPI

Crie uma chave no [console da SpicyAPI](https://spicyapi.ai/console/keys) e escolha **SpicyAPI**. Marinara preenche o modelo `alibaba/z-image-spicy-pro/text-to-image`. Você pode digitar outro ID, como `bytedance/seedream-5.0-pro/text-to-image`. **Test provider** lê a lista de modelos, então não custa nada. **Test image** gera uma imagem de verdade e usa o seu saldo.

Escolha o serviço **SpicyAPI**. Não use **OpenAI (DALL-E)** nem uma conta compatível com OpenAI com um endereço da SpicyAPI. O endereço no estilo OpenAI da SpicyAPI só trabalha com texto.

Cada modelo tem as próprias configurações. Marinara pergunta à SpicyAPI quais delas o modelo aceita e envia só essas, no formato mais próximo que ele oferece (proporção de tela, largura e altura, ou um tamanho fixo). Em um modelo sem campo de prompt negativo, o prompt negativo é acrescentado ao fim do prompt. Use **Custom Parameters** para outras opções, como `seed`, `resolution` ou `loras`.

Cada imagem é uma tarefa. Marinara espera, volta a verificar depois de cerca de um minuto e então baixa o resultado. Se a conexão cair, Marinara retoma a mesma tarefa em vez de pagar por uma nova. Os modelos de edição (IDs que terminam em `/edit`) recebem as suas imagens de referência. A SpicyAPI aceita até 1 MB por imagem e 2 MB por requisição, então Marinara reduz as imagens maiores e deixa de fora as extras que não couberem.

### SwarmUI

O SwarmUI pode distribuir o trabalho do ComfyUI pela própria fila. Um servidor local sem contas não precisa de chave. Se o seu servidor exigir uma conta, cole um Swarm Auth Token em **API key**. A lista de modelos mostra os modelos do seu servidor SwarmUI.

O campo **ComfyUI workflow (optional)** (fluxo de trabalho do ComfyUI, opcional) pode ficar vazio. Deixe-o vazio para usar as configurações de imagem do próprio SwarmUI, ou cole um fluxo de trabalho (veja abaixo). Ative **Save images in SwarmUI** (salvar imagens no SwarmUI) em **Local Image Defaults** para guardar também cada imagem na pasta de saída do SwarmUI. Marinara mantém a própria cópia de qualquer forma.

### Serviços locais na sua rede

`localhost` significa o computador que roda Marinara. Servidores de imagem locais nesse computador funcionam sem nenhuma configuração extra. Se o servidor roda em outro computador da sua rede, libere os endereços de rede local na configuração do servidor. Veja a [Referência de configuração do servidor](../CONFIGURATION.md).

Quando um serviço devolve uma URL em vez dos dados da imagem, Marinara baixa as URLs públicas de CDN passando pelas verificações normais de requisições de saída. Uma URL de resultado privada ou de loopback só é aceita quando o esquema, o nome do host e a porta batem exatamente com os do serviço de imagem configurado. Redirecionamentos a partir dessa origem não podem pular para outro serviço local. Se um proxy local armazena os resultados em outra origem privada, faça o proxy servir esses arquivos pela mesma origem da API de imagens dele.

## JSON de fluxo de trabalho do ComfyUI e RunPod

Para **ComfyUI**, **SwarmUI** e **RunPod Serverless (ComfyUI)**, aparece um campo **ComfyUI workflow (optional)** ou **(required)**. Cole nele um JSON de fluxo de trabalho que você exportou do ComfyUI com **Save (API Format)**, **Export (API)** ou **Export to API**, conforme a versão do seu ComfyUI. Ele é opcional para o ComfyUI e o SwarmUI e obrigatório para o RunPod, que exige o seu token de API do RunPod como chave de API, um **RunPod endpoint ID** (ID do endpoint do RunPod) e o fluxo de trabalho.

Coloque estas marcas de texto no fluxo de trabalho, onde Marinara deve preencher um valor:

- `%prompt%` e `%negative_prompt%` para os prompts.
- `%width%`, `%height%` e `%seed%` para o tamanho e a seed.
- `%model%`, `%steps%`, `%cfg%`, `%sampler%`, `%scheduler%` e `%denoise%` para as configurações de geração.
- `%reference_image%` e `%reference_image_01%` até `%reference_image_04%` para os dados das imagens de referência.
- `%reference_image_name%` e `%reference_image_name_01%` até `%reference_image_name_04%` para fazer upload das imagens de referência e preencher os nomes de arquivo delas em um nó LoadImage de um ComfyUI local.

O `%prompt%` é o mais importante. O editor avisa quando ele está faltando. No ComfyUI, um campo vazio usa um fluxo de trabalho padrão embutido. No SwarmUI, usa as configurações do próprio SwarmUI. O RunPod não tem padrão, então o fluxo de trabalho é obrigatório. Os três aceitam até 4 imagens de referência em base64 puro. Os marcadores de upload por nome de arquivo só funcionam no ComfyUI local.

Veja [Configuração de workflows do ComfyUI](comfyui.md) para os passos completos de exportação, exemplos, regras de aspas, imagens de referência, fluxos de trabalho por personagem, acesso pela rede e solução de problemas.

<a id="local-image-defaults-per-connection"></a>

## Local Image Defaults por conexão

Um painel **Local image defaults** aparece em um modelo de imagem de **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **NovelAI**, **Draw Things**, **Arli AI**, **SwarmUI** e **RunPod Serverless (ComfyUI)**. O Draw Things e a Arli AI mostram os campos do SD Web UI. O SwarmUI e o RunPod mostram os campos do ComfyUI. Essas configurações só valem quando este modelo gera uma imagem. **Reset** (redefinir) restaura os valores embutidos.

Todo serviço tem um campo **Seed**. O valor -1 mantém cada imagem aleatória. Qualquer outro número reaproveita essa seed todas as vezes. Os demais campos dependem do serviço.

| Serviço | Campo | Padrão |
| --- | --- | --- |
| AUTOMATIC1111 / Forge | Steps | 20 |
| AUTOMATIC1111 / Forge | CFG scale | 7 |
| AUTOMATIC1111 / Forge | Sampler | Euler a |
| AUTOMATIC1111 / Forge | Img2img denoise | 0.6 |
| ComfyUI | Steps | 20 |
| ComfyUI | CFG scale | 7 |
| ComfyUI | Sampler | euler_ancestral |
| ComfyUI | Scheduler | normal |
| ComfyUI | Denoise | 1 |
| NovelAI | Steps | 28 |
| NovelAI | Prompt guidance | 6 |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise schedule | karras |

Cada serviço também tem os campos **Prompt prefix** e **Negative prefix**. O texto colocado ali entra na frente de todo prompt deste modelo. AUTOMATIC1111 / Forge e ComfyUI têm um campo **Clip skip**. AUTOMATIC1111 / Forge acrescenta um botão liga/desliga **Restore faces**. ComfyUI acrescenta um botão liga/desliga para fazer upload de uma imagem de preenchimento 1x1 quando nenhuma imagem de referência é fornecida, o que só importa em fluxos de trabalho personalizados com marcadores de referência. NovelAI acrescenta **Guidance rescale** e **UC preset**.

## O suporte a imagens de referência varia conforme o serviço

Uma imagem de referência é uma figura já existente que você envia junto com o prompt, para que a nova imagem mantenha o rosto de um personagem ou um estilo de arte.

| Serviço | Imagens de referência |
| --- | --- |
| OpenAI (DALL-E) | Até 16, só nos modelos GPT Image |
| ChatGPT (Codex login) | Até 16 |
| NovelAI | Até 16, somente no modelo V4.5 |
| xAI / Grok Imagine | Até 3 |
| NanoGPT | Até 3 |
| ComfyUI, RunPod Serverless (ComfyUI), SwarmUI | Até 4, por meio dos marcadores do fluxo de trabalho |
| Stability AI, Arli AI, SD Web UI, Draw Things | Somente a primeira imagem, como imagem para imagem |
| Atlas Cloud | Primeira imagem, em IDs de modelo compatíveis com imagem para imagem, edição ou Kontext |
| SpicyAPI | Só modelos de edição, até o limite do modelo, reduzidas para caber |
| OpenRouter Images | Com suporte, sem limite fixo |
| Venice.ai, Z.AI | Sem suporte em texto para imagem |
| Together AI, Pollinations, Stable Horde, fal.ai | Sem suporte |

A referência precisa da NovelAI só funciona em um modelo V4.5, como `nai-diffusion-4-5-full`. A NovelAI não lançou o Precise Reference para o V5. Se você pedir referências em outro modelo, Marinara gera a imagem sem elas e registra um aviso no servidor.

<a id="queue-media-generation-requests"></a>

## Enfileirar as requisições de geração de mídia

O botão liga/desliga **Queue media generation requests** (enfileirar requisições de geração de mídia) fica em **Settings → Generations → Overall Generations** (Configurações → Gerações → Gerações em geral). Ele vem ativado por padrão.

Com ele ativado, Marinara envia os trabalhos de imagem para cada conta de imagem um de cada vez, e os trabalhos de vídeo para cada conta de vídeo um de cada vez, em filas separadas. Uma imagem e um vídeo da mesma conta podem rodar juntos. Isso vale para todo recurso que os pede: o Illustrator, os trackers, os comandos, a galeria, os recursos de Game e os agentes baixados, como o Slurp. Dois modelos com o mesmo endereço e a mesma chave de API dividem uma fila. Contas diferentes continuam rodando ao mesmo tempo. A NovelAI também ganha uma pequena pausa entre os trabalhos e, quando responde que está ocupada, Marinara espera e tenta mais duas vezes.

Mantenha a opção ligada nos serviços que recusam duas requisições simultâneas. Desative apenas se o seu serviço aguentar muitas ao mesmo tempo e você quiser velocidade.

## Guias relacionados

- [Configuração de workflows do ComfyUI](comfyui.md)
- [Agente Illustrator](illustrator-agent.md)
- [Perfis de estilo de imagem](style-profiles.md)
- [Planos de fundo de cena e a galeria](scene-backgrounds.md)
- [Selfies](../conversation/selfies.md)
- [Provedores de IA compatíveis](../connections/providers-reference.md)
