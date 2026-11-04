# Como configurar o Built-in model

O **Built-in model** (modelo embutido) é um modelo de IA pequeno que Marinara baixa e executa no seu próprio computador. Ele não precisa de chave de API nem de conta online, e nada sai do seu computador.

Como é pequeno, ele serve para tarefas auxiliares em segundo plano: os agentes tracker (ajudantes que acompanham os detalhes da história), os efeitos de cena do Game Mode, os embeddings de lorebook e as verificações de decisão. Ele é fraco demais para um bom roleplay ou para as edições da Professor Mari. Para isso, use uma conta mais forte. Veja [Conectando a um provedor de IA](connecting-to-a-provider.md).

Se o card **Built-in model** não aparece, a sua instalação é "Lite", uma versão enxuta que vem sem o runtime local.

## Como baixar o Built-in model

Antes de começar, confira se há espaço livre em disco e memória (RAM) suficientes para o modelo. Os tamanhos estão na tabela abaixo.

1. Clique em **Connections** (Conexões) na barra superior.
2. Encontre o card **Built-in model** abaixo da caixa **Jobs** (tarefas). Ele mostra **Not downloaded**.
3. Clique no card ou no botão **Download** (baixar) dele. Abre uma janela com o título **Built-in model**.
4. Em **Which model?** (qual modelo?), escolha um modelo. **Gemma 4 E2B — Q8 (Best Quality)** vem marcado como **Recommended** (recomendado). Se o seu computador tem pouca memória, escolha **Q4_K_M**. Ele precisa de cerca de 3,4 GB de RAM em vez de 5,4 GB.
5. Clique no botão **Download**, embaixo. Ele mostra o tamanho do modelo, por exemplo **Download 5.0 GB**.
6. Espere. A janela mostra três etapas: **Install runtime**, **Download model** e **Start and test** (instalar o runtime, baixar o modelo, iniciar e testar). Um runtime é o programa que executa o modelo. Marinara instala o runtime primeiro quando ele não existe.
7. Quando a janela mostrar o nome do modelo com um ponto verde, clique em **Test** (testar). Uma caixa com o título **Local test message** mostra **Succeeded** e quanto tempo a resposta levou.
8. Clique em **Done** (concluir).

O card agora mostra **Ready**, com o tamanho do modelo e as tarefas que ele faz.

Se não funcionou:

- **Sidecar runtime install is disabled** (uma mensagem de erro). Instalar o runtime é uma ação protegida. Veja [Como liberar a instalação do runtime](#allow-runtime-installs).
- **Local runtime failed to start.** Veja [Solução de problemas](#troubleshooting).
- **Download failed.** A janela mostra o erro. Confira a sua conexão com a internet e o espaço livre em disco, depois clique de novo no botão de download.

Você também chega a essa janela por **Add** (adicionar), no painel **Connections**, em **Built-in model** na janela **Add account** (adicionar conta).

### Presets prontos

A janela oferece dois presets prontos do Gemma 4 E2B, um modelo pequeno do Google. Os computadores com Apple Silicon recebem versões MLX em vez de arquivos GGUF. GGUF e MLX são dois formatos de arquivo para modelos locais. Os tamanhos abaixo são os que a janela mostra (em GB, onde 1 GB é 1024 × 1024 × 1024 bytes).

| Preset | Download | RAM em execução |
| --- | --- | --- |
| Q8 (Best Quality) | 5,0 GB | 5,4 GB |
| Q4_K_M (Smaller, Faster) | 3,0 GB | 3,4 GB |

No Apple Silicon, aparecem dois presets MLX no lugar desses:

| Preset | Download | RAM em execução |
| --- | --- | --- |
| 8-bit MLX (Best Quality) | 5,5 GB | 7,0 GB |
| 4-bit MLX (Smaller, Faster) | 3,4 GB | 4,5 GB |

Marinara mantém um Built-in model no disco por vez. Escolher outro modelo substitui o primeiro. Para trocar depois, abra o card e clique em **Change model** (trocar de modelo) na janela **Built-in model**. Na página do card, os botões ao lado de **Model** (modelo) trocam entre os presets e pedem que você confirme o tamanho do download antes.

### Como usar um modelo seu

Em **Your own model** (o seu próprio modelo) você pode usar um modelo GGUF do Hugging Face (um site público de compartilhamento de modelos) ou um arquivo no computador em que Marinara roda.

1. Clique em **Your own model** e escolha uma aba: **Hugging Face** ou **File on the server** (arquivo no servidor).
2. Em **Hugging Face**, digite o nome do repositório no formato `owner/repo` e clique em **Find files** (encontrar arquivos). Escolha um arquivo da lista.
3. Em **File on the server**, digite o caminho completo do arquivo `.gguf`. Marinara usa o arquivo onde ele está e não faz uma cópia.
4. Clique no botão de baixo: **Download**, ou **Use this file** (usar este arquivo) para um arquivo no servidor.

No Apple Silicon, **Find files** aparece como **Validate repo** (validar o repositório), e o repositório precisa ser nativo de MLX. Um arquivo GGUF no servidor continua funcionando ali e usa o llama.cpp em vez do MLX.

## Como usar o Built-in model nas tarefas auxiliares

Depois do download, abra o card **Built-in model**. A página dele mostra o estado, o uso de memória e **Used by** (usado por), e tem estes controles:

| Controle | O que faz |
| --- | --- |
| **Use for tracker agents (roleplay)** | Mantém o modelo rodando para os agentes tracker. Vem desativado por padrão. |
| **Use for game scene analysis** | Mantém o modelo rodando para os efeitos de cena do Game Mode, como planos de fundo, música e clima. Vem ativado por padrão. |
| **Use the built-in model for all tracker agents** | Aponta todos os agentes tracker nativos para este modelo. Não ativa os agentes. |
| **Change in Defaults** | Abre a caixa **Jobs**, onde você pode dar outras tarefas ao modelo. |

Se os dois botões liga/desliga estiverem desativados, o modelo não inicia sozinho. Ele inicia quando você ativa um deles, ou quando um chat ou uma tarefa o usa. Veja [Memory Recall e resumos do chat](../agents/memory.md) para saber como ativar os agentes.

Na configuração do Game Mode, o **Scene effects model** (modelo de efeitos de cena) pode usar o Built-in model. Veja [Game Mode: primeiros passos](../game/getting-started.md).

### Embeddings de lorebook

Os embeddings são números que permitem a um lorebook buscar pelo significado. Para usar o Built-in model neles, escolha **Built-in model (on this device)** (modelo embutido: neste dispositivo) como modelo de vetorização do lorebook. Ative antes **Use for tracker agents (roleplay)** ou **Use for game scene analysis**, ou a requisição falha. Esse caminho precisa do runtime GGUF, então não funciona no MLX do Apple Silicon. Veja [Busca semântica para lorebooks](../lorebooks/semantic-search.md).

### Modelo de decisão

Você também pode escolher o Built-in model como o seu Decision model (modelo de decisão). Veja [Modelos de decisão](decision-models.md).

### Modelo de chat

Para conversar com o Built-in model:

1. Abra um chat e clique no botão de modelo na caixa de mensagem (o ícone de link).
2. Em **Model for this chat** (modelo para este chat), escolha **Built-in model (on this device)**. Ele fica no fim da lista e aparece depois que o modelo é baixado.
3. Envie uma mensagem. Um aviso diz que o modelo é pequeno, então as respostas podem sair lentas, curtas ou de baixa qualidade.

## Configurações do runtime

Para abri-las, clique em **Runtime settings** (configurações do runtime) na página do card, ou clique em **Settings** (Configurações) na janela **Built-in model**. Elas ficam em quatro grupos. Os menus suspensos e os botões liga/desliga são salvos na hora. Os campos numéricos são salvos quando você clica em **Apply settings** (aplicar as configurações). **Physical batch size** e **Custom GPU layers** têm cada um o próprio botão **Apply** (aplicar).

**Speed** (velocidade)

| Configuração | Padrão | O que faz |
| --- | --- | --- |
| **Runtime target** | Auto detect | Para qual família de placa de vídeo Marinara faz a instalação. |
| **GPU offload** | Auto offload | Quanto trabalho vai para a placa de vídeo. Escolha **Auto offload**, **CPU only** ou **Custom GPU layers** (de 1 a 1024). |

**Memory** (memória)

| Configuração | Padrão | O que faz |
| --- | --- | --- |
| **Context window** | 8192 | Quanto texto o modelo lê de uma vez, em tokens. 512 ou mais. |
| **KV cache type** | f16 | Como o modelo guarda o que já leu. Escolha f16, q8_0 ou q4_0. Os dois últimos usam menos memória e precisam de suporte a Flash Attention. |

**Replies** (respostas)

| Configuração | Padrão | O que faz |
| --- | --- | --- |
| **Max response tokens** | 4096 | A resposta mais longa que o modelo pode escrever. 64 ou mais. |
| **Temperature** | 0.3 | O quanto as respostas são aleatórias. De 0 a 2. |
| **Top P** | 0.95 | Um limite na escolha das palavras. Acima de 0, até 1. |
| **Top K** | 64 | Um limite na escolha das palavras. De 0 a 500. |

**Expert** (especialista)

| Configuração | Padrão | O que faz |
| --- | --- | --- |
| **Native tool calls** | On | Permite que o modelo use ferramentas. A Professor Mari e os agentes personalizados precisam dessa opção ativada. |
| **Max parallel agent jobs** | 2 | Quantas tarefas rodam ao mesmo tempo. De 1 a 16. |
| **Pooling type** | None | Como o modelo transforma o texto em números para a busca no lorebook. Escolha **Mean** para os embeddings de lorebook. |
| **Physical batch size** | 512 | O texto por lote de embedding de lorebook. De 128 a 32768. Aumente quando entradas longas falharem. O Gemma costuma funcionar com 1024. |

Algumas configurações mudam conforme o sistema:

- **Runtime target** no Windows e no Linux (x64) oferece Auto detect, NVIDIA GPU, AMD GPU, Intel GPU, Vulkan GPU, CPU only e System llama-server. Os outros sistemas oferecem menos opções.
- No Apple Silicon, o MLX escolhe o acelerador por você. **Runtime target**, **GPU offload**, **KV cache type**, **Native tool calls**, **Pooling type** e **Physical batch size** não aparecem.
- **Max response tokens** não limita a análise de cena do Game Mode, que tem o próprio limite.
- **Diagnostics** (diagnóstico), em **Expert**, mostra a build do runtime, a placa de vídeo detectada e o último comando de inicialização.

<a id="allow-runtime-installs"></a>

### Como liberar a instalação do runtime

Instalar ou reinstalar o runtime é uma ação protegida. As instalações de um clique do Windows já liberam isso para você. No macOS, no Linux e no Docker, faça uma destas coisas e tente de novo:

- Digite o segredo de administrador em **Settings → Advanced → Admin Access** (Configurações → Avançado → acesso de administrador). O segredo de administrador é uma segunda senha para as ações arriscadas. Você o cria em **Admin Access** no próprio computador do servidor ou o define como `ADMIN_SECRET` no arquivo `.env` do servidor. Veja [Admin Access](../REMOTE_ACCESS.md#admin-access-and-privileged-actions).
- Adicione `SIDECAR_RUNTIME_INSTALL_ENABLED=true` ao arquivo `.env` do servidor e reinicie o Marinara. O arquivo `.env` é um arquivo de texto na pasta do Marinara. Veja [Editar o arquivo .env](../CONFIGURATION.md#edit-the-env-file).

Marinara baixa apenas as versões de llama.cpp, MLX e uv aprovadas para a sua versão e confere o tamanho e a soma de verificação SHA-256 de cada arquivo antes de executar qualquer coisa.

## Modelo de fala local

O **Local speech model** (modelo de fala local) transforma a sua voz em texto no seu próprio computador, para as chamadas de Conversation. É um modelo Whisper, um modelo de fala para texto. Ele precisa do pacote de agente **Calls**, que você instala em **Agents → Agent Organizer** (agentes → Organizador de agentes).

1. Abra o painel **Connections** e clique no item **Speech to text** (fala para texto) em **On this device** (neste dispositivo).
2. Em **Local speech model**, escolha um modelo no menu suspenso.
3. Clique em **Download Whisper** (baixar o Whisper).
4. Espere aparecer **Ready**. Reinicie o Marinara por completo antes de usar o Calls.

| Modelo | Download | RAM em execução |
| --- | --- | --- |
| Whisper Tiny (Multilingual) | cerca de 180 MB | cerca de 350 MB |
| Whisper Base (Multilingual) | cerca de 320 MB | cerca de 650 MB |

O Tiny é a melhor primeira escolha para celulares e computadores mais antigos. O Base é mais preciso com fala confusa, mas demora mais para iniciar. Clique em **Delete Local Whisper** (o botão de lixeira) para remover o modelo baixado. Desinstalar o Calls também o remove.

O seu áudio fica no seu computador. Só o texto vai para o seu modelo de chat. Para usar isso em uma chamada, defina a entrada de áudio da chamada como Local Whisper. Veja [Chamadas de áudio e vídeo no Conversation](../conversation/calls.md). Se, em vez disso, você ativar o servidor **Speech to text**, as chamadas enviam a sua fala para ele. Veja [Use o seu próprio servidor de speech-to-text](../conversation/calls.md#use-your-own-speech-to-text-server).

<a id="troubleshooting"></a>

## Solução de problemas

| Sintoma | Solução |
| --- | --- |
| **Sidecar runtime install is disabled** (uma mensagem de erro). | Veja [Como liberar a instalação do runtime](#allow-runtime-installs). |
| **Local runtime failed to start.** A janela mostra o erro e o caminho de um arquivo de log. O card mostra **Local runtime unavailable**. | Clique em **Retry startup** (tentar iniciar de novo). Se não resolver, clique em **Reinstall runtime** (reinstalar o runtime) ou escolha outro **Runtime target**. **Continue without local AI** (continuar sem IA local) desativa os botões liga/desliga auxiliares e mantém o Marinara funcionando sem o modelo. |
| O download do runtime acusa divergência de tamanho ou de SHA-256. | Marinara descartou o arquivo. Atualize o Marinara e tente de novo. Se continuar falhando, não abra o arquivo por conta própria. Informe o runtime target e o erro. |
| A busca no lorebook diz que o modelo local não está ativado. | Ative **Use for tracker agents (roleplay)** ou **Use for game scene analysis** e faça a vetorização de novo. |
| Um aviso do Game Mode diz **Local scene helper failed to start**. | Clique em **Open Local AI Model** no aviso para tentar de novo, trocar de modelo ou desativar a análise de cena local. |

Para mais ajuda, veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

## Guias relacionados

- [Conectando a um provedor de IA](connecting-to-a-provider.md)
- [Modelos de decisão](decision-models.md)
- [Conectar um modelo local ou auto-hospedado](local-self-hosted.md)
- [Memory Recall e resumos do chat](../agents/memory.md)
- [Chamadas de áudio e vídeo no Conversation](../conversation/calls.md)
- [Game Mode: primeiros passos](../game/getting-started.md)
- [Busca semântica para lorebooks](../lorebooks/semantic-search.md)
