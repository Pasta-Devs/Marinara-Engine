# Provedores de geração de imagens e configuração

A geração de imagens alimenta as ilustrações de cena, as selfies, os planos de fundo de cena e os avatares, retratos e sprites gerados. Este guia mostra como adicionar um serviço de imagem e o que cada serviço exige. Depois que um modelo de imagem funciona, todos os recursos de imagem do aplicativo podem usá-lo.

## Como adicionar um serviço de imagem

A chave de API é um código secreto que um serviço dá a você para que Marinara possa usar a sua conta. Marinara preenche o endereço web de cada serviço para você, então raramente é preciso digitar um.

1. Clique em **Connections** (Conexões) na barra superior e depois em **Add** (adicionar). A janela **Add account** (adicionar conta) abre.
2. Encontre o serviço. Clique em **Image** (imagem) nos filtros de tipo ou digite em **Search providers** (buscar provedores).
3. Cole a sua chave no campo **API key** (chave de API). Serviços gratuitos e locais não precisam de chave. Para um servidor que você mesmo roda, preencha o campo de endereço.
4. Clique em **Connect** (conectar). Marinara testa a conta.
5. Em **Found in … — use it for:**, marque **Images** (imagens). Se o serviço não tiver uma lista de modelos, digite o ID do modelo na linha. Clique em **Done** (concluir).
6. Abra o modelo de imagem e clique em **Test image** (testar imagem). Marinara gera uma pequena imagem de teste.
7. Marcar **Images** no passo 5 também define a tarefa **Images** na página **Jobs** (tarefas) do painel **Connections**. Para alterá-la depois, clique em **Images** ali.

Para adicionar outro modelo de imagem a uma conta, clique em **⋯** na linha da conta e escolha **Add model** (adicionar modelo). Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md) para conhecer a janela inteira.

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

- **OpenAI (DALL-E)**: oferece os modelos DALL-E e GPT Image. Só o GPT Image 2.6 gera GIFs em loop. Veja [GPT Image 2.6](#gpt-image-26).
- **Stability AI**: modelos Stable Diffusion e Stable Image.
- **Together AI**: FLUX e outros modelos de imagem abertos.
- **OpenRouter Images**: alcança os modelos de imagem pela interface de chat do OpenRouter, então os modelos variam de conta para conta.
- **xAI / Grok Imagine**: usa o Grok Imagine.
- **NanoGPT**: é um agregador, então use a lista de modelos dele. Marinara envia a cada modelo os tamanhos que o NanoGPT lista para ele, por exemplo `1.5k` com uma proporção de tela em vez de `1344x768`, e só a quantidade de imagens de referência que o modelo aceita. Se um modelo recusar um prompt negativo, Marinara desenha a imagem sem ele e registra um aviso no servidor.
- **Pollinations**: a forma mais rápida de experimentar a geração de imagens. Não exige conta.
- **Stable Horde**: uma rede colaborativa. Uma chave gratuita dá mais prioridade na fila.
- **SD Web UI** e **Draw Things**: inicie o programa com a interface de aplicação ativada. Marinara trata o Draw Things como um servidor AUTOMATIC1111 (o aplicativo roda no macOS ou no iOS).
- **Block Entropy**: Marinara não tem um tratamento dedicado para ele, então envia requisições compatíveis com OpenAI. A compatibilidade não está confirmada. Teste com **Test image** antes de depender dele.

## Serviços com configuração especial

### GPT Image 2.6

O GPT Image 2.6 roda em uma conta **OpenAI (DALL-E)**. O **GPT Image 2.6 Flare** é o modelo mais rápido. O **GPT Image 2.6 Sunburst** oferece qualidade maior e se mantém mais estável de uma edição para outra. Os dois aceitam os mesmos tamanhos e fundos transparentes que o GPT Image 2.5, e **Image quality** (qualidade da imagem) vai até **Max**.

O modelo planeja cada imagem antes de desenhá-la. Para que ele planeje menos, acrescente `{"complexity": "low"}` ou `{"complexity": "medium"}` ao campo **Custom Parameters** (parâmetros personalizados) do modelo de imagem. O padrão é `high`. Uma complexidade maior pode demorar mais e pode mudar mais do que você pediu em uma edição.

O GPT Image 2.6 também pode gerar um GIF curto em loop. Marinara só pede um onde um recurso ou um agente baixado oferece GIFs:

| Limite | Valor |
| --- | --- |
| Conta | **OpenAI (DALL-E)** com uma chave de API |
| Modelos | GPT Image 2.6 Flare ou Sunburst |
| Quadros | De 2 a 12, 9 por padrão |
| Duração do quadro | De 20 a 2000 ms, 200 ms por padrão |
| Tamanho do quadro | Cerca de 0,66 MP: 816x816 quadrado, 608x1088 vertical |
| Imagens enviadas | Nenhuma. Um GIF é desenhado só a partir do prompt |
| Fundo transparente | Não |

A OpenAI permite mais quadros, mas não publica quantos pixels um GIF pode ter, então Marinara se limita a 12 quadros pequenos. **ChatGPT (Codex login)**, **OpenRouter Images**, **NanoGPT**, ToAPIs e outros serviços não conseguem gerar GIFs. Marinara recusa essas requisições antes de enviar qualquer coisa, então você não paga nada. Com uma conta **OpenAI-compatible** (compatível com OpenAI), Marinara tenta do mesmo jeito que na OpenAI.

Um GIF que falha nunca é substituído por uma imagem estática. Se o serviço responder com uma imagem estática, a requisição falha. O modelo em **If it fails** (se falhar) da tarefa **Images** só é tentado quando consegue gerar GIFs.

> **Aviso:** a OpenAI não publica o preço de um GIF. Espere que um GIF custe o equivalente a várias imagens, e uma imagem estática devolvida no lugar dele também é cobrada.

### ChatGPT (Codex login)

Este serviço usa o seu plano do ChatGPT em vez de uma chave de API, então as imagens não precisam de crédito da API da OpenAI.

1. No computador que roda Marinara, instale o CLI do Codex e execute `codex login` uma vez. É o mesmo login que a conta de chat do ChatGPT usa. Veja [Conexões por assinatura do Claude, do ChatGPT e do Grok](../connections/subscription-clis.md#openai-chatgpt).
2. Escolha o serviço. Não há chave nem endereço para preencher. Marinara preenche o modelo `gpt-image-2`, o que o Codex usa para imagens.

**Test provider** só verifica se Marinara consegue ler o seu login do Codex. **Test image** gera uma imagem de verdade e conta nos seus limites de imagem do ChatGPT. Este serviço não consegue gerar GIFs, mesmo com um ID de modelo do GPT Image 2.6. Com imagens de referência, Marinara envia uma requisição de edição com até 16 delas. O ChatGPT pode devolver um tamanho em pixels diferente, então Marinara também informa no prompt a proporção de tela desejada. Este serviço usa o endpoint de imagem do ChatGPT que o Codex usa, e não a API pública da OpenAI, então a OpenAI pode mudá-lo sem aviso prévio.

### Arli AI

Roda modelos Stable Diffusion hospedados. Um modelo é obrigatório, então digite o nome do modelo de imagem da Arli AI que você quer. Usa os mesmos campos de **Local Image Defaults** (padrões de imagem local) do SD Web UI (veja [Local Image Defaults](#local-image-defaults-per-connection)). A primeira imagem de referência é usada como imagem inicial. Este serviço é só para imagens. Para os modelos de chat da Arli AI, veja [Provedores de IA compatíveis](../connections/providers-reference.md#arli-ai).

### NovelAI

A NovelAI é focada em arte no estilo anime. Nos modelos V4, V4.5 e V5, Marinara envia prompts nativos de personagem, com posições, para storyboards, cenas do Illustrator e imagens da Professor Mari com vários personagens. As imagens de referência precisas funcionam nos modelos V4.5 e V5.

### Venice.ai

Marinara usa o endpoint de imagem nativo da Venice, desativa o desfoque opcional do modo seguro da Venice e converte os tamanhos pedidos para o formato de tamanho de cada modelo. Ainda assim, as políticas da própria Venice ou os limites do modelo podem recusar uma requisição.

### Z.AI

Use uma chave de API comum da Z.AI. As chaves do GLM Coding Plan e o endereço `/api/coding/paas/v4` não funcionam para imagens. Escolha **GLM-Image** ou **CogView 4**. Marinara converte a proporção de tela para um tamanho que o modelo aceita e baixa o resultado temporário para o armazenamento local. Só faz texto para imagem e não envia imagens de referência.

### Atlas Cloud

Marinara carrega o catálogo atual de modelos de texto para imagem e de imagem para imagem do Atlas Cloud. Se não conseguir, mostra uma lista inicial (Nano Banana, Gemini Flash Image, FLUX 1.1 Pro). Você sempre pode digitar o ID exato de um modelo. As tarefas rodam de forma assíncrona, então Marinara inicia a tarefa e fica consultando até a imagem ficar pronta. As imagens de referência são enviadas para os IDs de modelo que anunciam suporte a imagem para imagem, edição ou Kontext. Os esquemas dos modelos do Atlas variam, então consulte a documentação do modelo no Atlas Cloud para outros IDs.

### fal.ai

Crie uma chave de API em [fal.ai](https://fal.ai/dashboard/keys). A lista inicial tem `fal-ai/flux/schnell` e `fal-ai/flux/dev`. Você pode digitar o ID de outro endpoint de texto para imagem com entrada e saída compatíveis. **Test provider** só verifica a configuração. **Test image** envia uma requisição real e gasta crédito do fal.ai.

Marinara envia o prompt e os tamanhos e baixa a primeira imagem devolvida. Os prompts negativos são acrescentados como texto. Use **Custom Parameters** para opções do modelo, como `seed`, `num_inference_steps` ou `image_size`. Ele usa requisições síncronas de texto para imagem, não envia imagens de referência e não retoma tarefas interrompidas. Veja a [referência da API](https://fal.ai/models/fal-ai/flux/schnell/api) do modelo.

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

## Editar uma imagem existente

Abra uma imagem em uma galeria e escolha **Regenerate image** (gerar a imagem de novo). Para um avatar, escolha **Edit avatar** (editar avatar) no editor de um personagem ou de uma persona. Selecione um modelo de imagem e depois escolha **Edit image** (editar imagem). Os controles dependem do serviço selecionado:

| Serviço | Edição da imagem inteira | Edição com máscara pintada |
| --- | --- | --- |
| NovelAI nativa | Sim | Sim |
| SD Web UI (AUTOMATIC1111 / Forge) | Sim | Sim |
| Draw Things | Sim | Não |

Mude o prompt e **Strength** (intensidade) e depois escolha **Apply edit** (aplicar edição). Onde as ferramentas de máscara estão disponíveis, pinte a área que deve ser redesenhada e escolha **Inpaint image** (aplicar inpainting à imagem). **Noise** (ruído) e **Reuse original seed** (reutilizar seed original) só estão disponíveis na NovelAI nativa. Os outros serviços continuam permitindo gerar a imagem de novo da forma comum, com um prompt alterado.

As edições usam a imagem exibida como tela de origem. Trocar para um serviço sem suporte a máscara limpa a máscara pintada. A edição de um avatar continua como pré-visualização até você escolher **Use as avatar** (usar como avatar).

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
| NovelAI | Steps | Automático |
| NovelAI | Prompt guidance | Automático |
| NovelAI | Sampler | k_euler_ancestral |
| NovelAI | Noise schedule | karras |

Cada serviço também tem os campos **Prompt prefix** e **Negative prefix**. O texto colocado ali entra na frente de todo prompt deste modelo. AUTOMATIC1111 / Forge e ComfyUI têm um campo **Clip skip**. AUTOMATIC1111 / Forge acrescenta um botão liga/desliga **Restore faces**. ComfyUI acrescenta um botão liga/desliga para fazer upload de uma imagem de preenchimento 1x1 quando nenhuma imagem de referência é fornecida, o que só importa em fluxos de trabalho personalizados com marcadores de referência. NovelAI acrescenta **Guidance rescale** e **UC preset**.

Os campos **Steps** e **Prompt guidance** da NovelAI ficam vazios por padrão, o que significa **Automatic** (automático): Marinara envia o padrão da própria NovelAI para o modelo, mostrado no campo vazio. São 23 passos, com orientação do prompt de 7 no V5, 5 no V4.5 e 5,5 no V4. Digite um número para usar o seu próprio valor. Limpe o campo para voltar ao valor automático. Uma conexão salva antes de essa configuração existir, com os antigos valores embutidos de 28 passos ou orientação do prompt 6, agora usa o valor automático.

A NovelAI também tem a opção **Background dataset for backgrounds** (conjunto de dados de planos de fundo para gerar fundos), desativada por padrão. Quando ela está ativada, as imagens de fundo (planos de fundo da Galeria do personagem e da Galeria da persona, planos de fundo de cena do chat e do Illustrator, imagens de locais da galeria do chat e planos de fundo de jogo) começam com a tag `background dataset` da NovelAI nos modelos V4.5 e V5. O conjunto de dados de planos de fundo da NovelAI tende ao estilo fotográfico, então deixe a opção desativada se os planos de fundo devem combinar com um chat no estilo anime.

## Fundos transparentes

Sprites e folhas de stickers ou emojis ficam melhores com fundo transparente. Cada modelo de imagem tem uma configuração **Fundos transparentes** que indica se ele consegue desenhar assim:

- **Automático** usa o que Marinara sabe sobre o modelo. Mostra **Automático (com suporte)** para GPT Image 1, 1.5, 2.5 e 2.6 no OpenAI, OpenRouter ou ChatGPT (Codex login), e para NovelAI V5 (Full ou Curated) no serviço da própria NovelAI. Mostra **Automático (sem suporte)** para todos os outros, incluindo GPT Image 2.
- **Com suporte**: o modelo ou fluxo de trabalho retorna imagens com fundo realmente transparente, por exemplo um fluxo de trabalho do ComfyUI que remove o fundo antes de salvar.
- **Sem suporte**: sempre usa a cor uniforme que Marinara remove, mesmo em um modelo que poderia fazer melhor.

Quando o modelo desenha imagens transparentes, a geração de sprites e folhas pede esse tipo de imagem e mantém o resultado exatamente como foi desenhado. Caso contrário, o modelo recebe o pedido de um fundo liso verde, magenta ou ciano, e Marinara o remove. Seja qual for a configuração, uma imagem que chega transparente nunca passa pela limpeza de novo. Uma imagem que um modelo com suporte retorna com fundo sólido é mantida como foi desenhada e marcada na etapa de revisão dos sprites, onde **Aplicar a limpeza** remove o fundo.

A requisição à NovelAI usa as tags próprias dela, `transparent background, alpha transparency`, sem a alternativa de fundo de cor uniforme, que um modelo baseado em tags interpretaria como algo para pintar.

Um servidor compatível com OpenAI que precisa de uma opção própria para transparência pode recebê-la em **Parâmetros personalizados**, por exemplo `"background": "transparent"`.

## O suporte a imagens de referência varia conforme o serviço

Uma imagem de referência é uma figura já existente que você envia junto com o prompt, para que a nova imagem mantenha o rosto de um personagem ou um estilo de arte.

| Serviço | Imagens de referência |
| --- | --- |
| OpenAI (DALL-E) | Até 16, só nos modelos GPT Image. Nenhuma para um GIF |
| ChatGPT (Codex login) | Até 16 |
| NovelAI | Até 16, somente nos modelos V4.5 e V5 |
| xAI / Grok Imagine | Até 3 |
| NanoGPT | Até 3, dentro do limite do modelo. Nenhuma para modelos de texto para imagem |
| ComfyUI, RunPod Serverless (ComfyUI), SwarmUI | Até 4, por meio dos marcadores do fluxo de trabalho |
| Stability AI, Arli AI, SD Web UI, Draw Things | Somente a primeira imagem, como imagem para imagem |
| Atlas Cloud | Primeira imagem, em IDs de modelo compatíveis com imagem para imagem, edição ou Kontext |
| SpicyAPI | Só modelos de edição, até o limite do modelo, reduzidas para caber |
| OpenRouter Images | Com suporte, sem limite fixo |
| Venice.ai, Z.AI | Sem suporte em texto para imagem |
| Together AI, Pollinations, Stable Horde, fal.ai | Sem suporte |

A referência precisa da NovelAI funciona nos modelos V4.5 e V5, como `nai-diffusion-4-5-full` ou `nai-diffusion-5-full`. Em um modelo mais antigo, Marinara gera a imagem sem as referências e registra um aviso no servidor. O V5 não tem fidelidade ao estilo, então ignora **Style fidelity (V4.5 only)**. Cada referência custa o preço da própria NovelAI, 5 Anlas por imagem.

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
