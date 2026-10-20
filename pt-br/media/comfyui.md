# Configuração de workflows do ComfyUI

Marinara Engine envia pedidos de geração de imagens e de vídeos para um servidor ComfyUI local, e pedidos de imagem para um endpoint RunPod Serverless que roda ComfyUI. Uma conexão de imagem local pode usar o workflow básico embutido no Marinara, enquanto as conexões de vídeo e as configurações avançadas de imagem usam um workflow personalizado em formato de API.

O JSON do workflow colado no Marinara é uma fotografia daquele momento. Marinara não mantém um vínculo ativo com o workflow aberto no ComfyUI. Sempre que você mudar o workflow no ComfyUI, teste de novo, exporte de novo e substitua o JSON salvo na conexão do Marinara.

## Antes de começar

Instale o ComfyUI, adicione os checkpoints e os nós personalizados que o workflow precisa e inicie o servidor dele. O endereço local mais comum é `http://127.0.0.1:8188`.

Se o ComfyUI roda em outro computador da sua rede doméstica, o servidor dele precisa escutar em um endereço que Marinara consiga alcançar. As conexões de imagem também exigem `IMAGE_LOCAL_URLS_ENABLED=true` no arquivo `.env` do Marinara; veja a [Referência de configuração do servidor](../CONFIGURATION.md). Se a conexão continuar falhando, confira o firewall do outro computador.

Um modelo de linguagem local e um modelo de imagem podem não caber juntos na memória da GPU, ainda mais em uma placa de 8 GB. A fila de imagens do Marinara impede que vários trabalhos de imagem rodem ao mesmo tempo, mas ela não faz dois modelos carregados caberem na mesma VRAM. Se a memória acabar, use um modelo de linguagem na nuvem ou hospedado à parte, rode o ComfyUI em outro dispositivo ou tire um modelo da memória antes de usar o outro.

## Crie a conexão no Marinara

1. Abra a seção **Connections** (Conexões) e crie uma conexão de **Image Generation** (geração de imagens).
2. Escolha **ComfyUI** para um servidor local ou **RunPod Serverless (ComfyUI)** para um endpoint do RunPod.
3. No caso do ComfyUI local, informe a Base URL. Nenhuma chave de API é necessária. Se o campo **ComfyUI Workflow** (workflow do ComfyUI) estiver vazio, Marinara usa um workflow básico embutido de texto para imagem.
4. No caso do RunPod, informe a chave de API e o Endpoint ID. Aqui um workflow personalizado é obrigatório.
5. Ajuste a seção **Local Image Defaults** (padrões de imagem local). Esses valores substituem os marcadores correspondentes dentro do workflow.
6. Salve a conexão e use o botão **Test Image** (testar imagem) depois de adicionar o workflow.

## Monte e exporte um workflow

1. Crie no ComfyUI um workflow separado para Marinara.
2. Configure e ligue como de costume o checkpoint, os LoRAs, o VAE, os codificadores de prompt, os nós de imagem latente ou de entrada de imagem, o sampler e os nós de saída.
3. Coloque o workflow na fila do ComfyUI e confirme que ele produz a imagem esperada.
4. Inclua um nó de saída. O **SaveImage** é a escolha mais segura, porque Marinara lê as imagens ou animações prontas no histórico de workflows do ComfyUI.
5. Salve o workflow editável com um nome fácil de reconhecer, como `Marinara_Workflow`.
6. Exporte o workflow em formato de API. Dependendo da versão da interface do ComfyUI, essa ação pode se chamar **Save (API Format)**, **Export (API)** ou **Export to API**. Se ela estiver escondida, ative as opções de desenvolvedor ou o dev-mode do ComfyUI.
7. Abra o arquivo `.json` exportado em um editor de texto.

Um workflow em formato de API é diferente do workflow normal do editor visual. As chaves de nível mais alto dele são IDs de nó, e cada nó em geral tem `class_type` e `inputs`. Exporte a versão de API; não cole o arquivo de workflow comum, que traz o layout visual do editor.

<a id="comfyui-video-workflows"></a>

## Workflows de vídeo do ComfyUI

Crie uma conexão de **Video Generation** (geração de vídeos), escolha **ComfyUI** e cole um workflow em formato de API no campo obrigatório **ComfyUI Workflow**. WAN 2.2 e outros grafos de vídeo locais têm suporte, desde que o mesmo workflow rode no ComfyUI e salve um MP4 por uma saída como o nó **SaveVideo** do núcleo.

Os workflows de vídeo aceitam estes marcadores entre aspas:

| Marcador                 | Valor fornecido por Marinara                                        |
| ------------------------ | ------------------------------------------------------------------- |
| `%prompt%`               | O prompt compilado da cena ou da animação.                          |
| `%width%`, `%height%`    | `832×480` para 480p ou `1280×720` para 720p, invertidos no 9:16.    |
| `%seed%`                 | Uma nova seed aleatória de 32 bits.                                 |
| `%length%`               | A duração do clipe como número de quadros a 16 fps.                 |
| `%model%`                | O valor Model da conexão, quando houver um definido.                |
| `%reference_image_name%` | O nome do arquivo do primeiro quadro enviado, para um nó **LoadImage** do ComfyUI. |

Marinara coloca o workflow na fila pelo `/prompt`, consulta o `/history` e baixa o MP4 indicado em uma saída `gifs` ou `images`. As ações de imagem para vídeo fornecem `%reference_image_name%`; os testes de conexão só com texto não fornecem, então deixe essa entrada opcional quando o mesmo workflow precisar atender aos dois casos.

Renderizações locais do WAN podem passar de 30 minutos em GPUs intermediárias. Os trabalhos de vídeo do ComfyUI usam `VIDEO_GEN_TIMEOUT_MS`, e não o `COMFYUI_GEN_TIMEOUT`, que vale só para imagens; aumente o tempo limite de vídeo e reinicie Marinara se um workflow válido estiver sendo cortado antes da hora.

## Adicione os marcadores do Marinara

Troque pelos marcadores abaixo os valores que Marinara deve controlar.

Em uma conexão de **ComfyUI local**, mantenha todos os marcadores dentro das aspas do JSON. Marinara primeiro interpreta o workflow e depois converte em número de verdade um marcador exatamente numérico, como `"%width%"`. Assim ele continua válido para os nós que exigem entrada numérica.

Em uma conexão de **RunPod Serverless (ComfyUI)**, mantenha entre aspas os marcadores de texto, como `"%prompt%"`, `"%model%"` e `"%sampler%"`, mas deixe sem aspas os marcadores numéricos, como `%width%`, `%height%`, `%seed%`, `%steps%`, `%cfg%`, `%denoise%` e `%clip_skip%`. No RunPod a substituição acontece antes que o Marinara interprete o workflow, então o número inserido deixa o JSON enviado válido. O editor de conexões pode marcar esse modelo temporariamente como JSON inválido, já que o token sem aspas só é substituído na hora da geração; esse aviso não impede que a conexão seja salva.

As partes relevantes de um workflow de API **local** básico podem ficar assim:

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": "%seed%",
      "steps": "%steps%",
      "cfg": "%cfg%",
      "sampler_name": "%sampler%",
      "scheduler": "%scheduler%",
      "denoise": "%denoise%"
    }
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": {
      "width": "%width%",
      "height": "%height%",
      "batch_size": 1
    }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "portrait, %prompt%, masterpiece"
    }
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": {
      "text": "watermark, %negative_prompt%"
    }
  }
}
```

Isto é só um fragmento: mantenha as ligações entre nós e as demais entradas do workflow exportado. Um marcador de prompt pode ficar dentro de um texto maior, para acrescentar tags fixas antes ou depois. Já um marcador numérico normalmente deve ser o valor inteiro. Na cópia do workflow usada no RunPod, tire as aspas em volta desses tokens numéricos. Outra opção: deixe qualquer configuração fixa no código quando não quiser que os padrões da conexão do Marinara mudem aquele valor.

| Marcador              | Valor fornecido por Marinara                                                                |
| --------------------- | ------------------------------------------------------------------------------------------- |
| `%prompt%`            | O prompt positivo da imagem. O editor de conexões avisa quando ele está faltando.           |
| `%negative_prompt%`   | O prompt negativo da imagem.                                                                |
| `%width%`, `%height%` | As dimensões pedidas para a imagem.                                                         |
| `%seed%`              | A seed da conexão; `-1` gera uma nova seed aleatória.                                       |
| `%model%`             | O modelo salvo na conexão. Use o valor de checkpoint exato que o nó de carregamento espera. |
| `%steps%`             | Os passos de amostragem.                                                                    |
| `%cfg%`               | A escala CFG. `%cfg_scale%` e `%scale%` também são aceitos.                                 |
| `%sampler%`           | O nome do sampler.                                                                          |
| `%scheduler%`         | O nome do scheduler.                                                                        |
| `%denoise%`           | A força do denoise. `%denoising_strength%` também é aceito.                                 |
| `%clip_skip%`         | O valor de Clip Skip para um nó compatível.                                                 |

Depois de editar, salve o JSON, copie o arquivo inteiro, cole no campo **ComfyUI Workflow** da conexão de imagem, salve a conexão e clique em **Test Image**.

## Use imagens de referência

Marinara consegue fornecer até quatro imagens de referência quando o recurso que inicia a geração tem imagens para enviar. O workflow personalizado precisa ter nós de entrada e marcadores compatíveis; acrescentar um marcador não cria nem liga esses nós sozinho.

### ComfyUI local: nomes de arquivo enviados para o LoadImage

Em um nó **LoadImage** padrão do ComfyUI, use um marcador de nome de arquivo:

```json
{
  "12": {
    "class_type": "LoadImage",
    "inputs": {
      "image": "%reference_image_name%",
      "upload": "image"
    }
  }
}
```

Marinara faz upload da referência para a pasta de entrada do ComfyUI e troca o marcador pelo nome de arquivo devolvido pelo ComfyUI. O `%reference_image_name%` indica a primeira imagem. Workflows com várias entradas de referência podem usar de `%reference_image_name_01%` até `%reference_image_name_04%`.

Se o workflow sempre exigir uma entrada de imagem, ative a opção **Upload a 1x1 placeholder when no reference image is provided** na seção **Local Image Defaults**. Marinara passa a enviar uma imagem minúscula de preenchimento quando o pedido não tem uma referência de verdade.

### Dados de imagem em base64 puro

Use `%reference_image%` para a primeira imagem em base64 puro, ou de `%reference_image_01%` até `%reference_image_04%` para entradas numeradas. Esses valores trazem os dados em base64 sem o prefixo `data:image/...` e só funcionam com nós personalizados que aceitam esse formato direto.

Os workflows do RunPod aceitam os marcadores de base64 puro. Já os marcadores de nome de arquivo enviado servem para o ComfyUI local e não estão disponíveis pelo handler do RunPod.

## Mantenha workflows por personagem

Você pode criar um workflow exportado e uma conexão de imagem no Marinara para cada personagem que precise de um checkpoint específico, de uma pilha de LoRAs, de uma configuração de ControlNet ou de um arranjo próprio de imagens de referência. Depois é só selecionar a conexão de imagem certa onde aquele personagem ou recurso de imagem permitir escolher.

O resultado costuma ser mais consistente do que com um workflow genérico único, mas cada conexão continua guardando a própria cópia do JSON. Depois de mudar no ComfyUI o workflow de um personagem, repita para aquela conexão os passos de exportar, editar, copiar e colar.

## Solução de problemas

| Problema                                          | O que verificar                                                                                                                                                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Marinara diz que o JSON do workflow é inválido    | No ComfyUI local, confira aspas, vírgulas e chaves depois de adicionar os marcadores. No RunPod, só os marcadores numéricos ficam sem aspas; os marcadores de texto e todo o resto do modelo continuam precisando de JSON correto. |
| O prompt ou o marcador chega literalmente a um nó | Confirme que o token está escrito exatamente como na lista e que o workflow colado é a versão de API recém-exportada.                                                                                                          |
| A imagem ignora as dimensões pedidas              | Coloque `%width%` e `%height%` no nó de imagem latente ou de tamanho equivalente que realmente alimenta o sampler.                                                                                                             |
| O ComfyUI não encontra o modelo                   | Use o nome de checkpoint exato que o nó de carregamento espera, ou deixe o checkpoint fixo no workflow em vez de usar `%model%`.                                                                                               |
| O ComfyUI diz que falta um nó ou uma entrada      | Instale os mesmos pacotes de nós personalizados usados na montagem do workflow e confirme que os nomes das entradas não mudaram.                                                                                               |
| O trabalho termina, mas Marinara não recebe imagem | Adicione uma saída **SaveImage** conectada e teste o workflow direto no ComfyUI de novo.                                                                                                                                      |
| Um nó de imagem de referência falha               | Em um nó **LoadImage** local comum, use um marcador `%reference_image_name...%`. Só use base64 puro com um nó feito para isso e confirme que o recurso do Marinara realmente enviou uma referência.                            |
| Uma URL de ComfyUI remota ou na rede local é bloqueada | Nas conexões de imagem, ative `IMAGE_LOCAL_URLS_ENABLED`. Faça o ComfyUI escutar na interface de rede e confira o firewall do computador. Nunca exponha um servidor ComfyUI sem autenticação à internet pública.          |
| Erro: `Outbound response exceeded N bytes` | A resposta passou do limite configurado, que por padrão é de 30 MiB. Metadados de workflow ou de imagem de referência embutidos podem causar isso. Desligue os metadados no ComfyUI ou aumente `IMAGE_GEN_MAX_RESPONSE_BYTES` no arquivo `.env` do Marinara e reinicie Marinara. |
| Uma geração de imagem longa estoura o tempo limite | Aumente `COMFYUI_GEN_TIMEOUT` no arquivo `.env` do Marinara. O valor é medido em segundos e o padrão é `2400`.                                                                                                                |
| Uma geração de vídeo longa estoura o tempo limite  | Aumente `VIDEO_GEN_TIMEOUT_MS` no arquivo `.env` do Marinara. O valor é medido em milissegundos e o padrão é `1800000` (30 minutos).                                                                                          |
| A geração fica sem memória de GPU                 | Reduza as dimensões da imagem ou o tamanho do modelo, tire o modelo de linguagem local da memória, use um modelo de linguagem remoto ou passe o ComfyUI para outro dispositivo.                                                    |

## Guias relacionados

- [Provedores de geração de imagens e configuração](image-providers.md) reúne todos os serviços de imagem compatíveis e as configurações de imagem comuns.
- [Geração de vídeo de cena](scene-video.md) trata das conexões de vídeo e de todas as telas de vídeo de cena.
- [Storyboards com LTX 2.3 no Game Mode](../game/ltx-2-3-storyboards.md) apresenta um workflow da API LTX Director, os marcadores e as configurações recomendadas em Game.
- [Perfis de estilo de imagem](style-profiles.md) explica os estilos de prompt reutilizáveis do Marinara.
- [Agente Illustrator](illustrator-agent.md) trata da ilustração automática das cenas.
- [Referência de configuração do servidor](../CONFIGURATION.md) documenta o acesso pela rede local e os tempos limite do ComfyUI.
- [Conceitos de workflow do ComfyUI](https://docs.comfy.org/development/core-concepts/workflow) explica os workflows na documentação oficial do ComfyUI.
