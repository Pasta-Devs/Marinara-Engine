# Como configurar o Local Model

Este guia explica o **Local Model** (modelo local), um modelo de IA pequeno que Marinara Engine baixa e executa na sua própria máquina. Ele não precisa de chave de API nem de conta online. Aqui você vê como fazer a configuração, o que faz cada opção em **Runtime Settings** (configurações de execução) e como o Local Model alimenta recursos auxiliares como os agentes tracker, os efeitos de cena do Game Mode e a transcrição de chamadas offline.

## O que é o Local Model

O **Local Model** é um modelo de linguagem compacto (Gemma) que roda inteiramente no seu computador. A chave de API é um código secreto que permite a Marinara conversar com um serviço de IA online. O Local Model não precisa de chave de API, porque nada sai da sua máquina.

O Local Model é pequeno de propósito. Ele serve para tarefas auxiliares em segundo plano, não para o chat principal nem para o roleplay. Marinara usa o modelo nestes trabalhos:

- Os agentes tracker no Roleplay Mode.
- Os efeitos de cena no Game Mode, como planos de fundo, música e clima.
- Os embeddings de lorebook para a busca semântica.
- A transcrição do microfone nas chamadas de Conversation, por meio de um modelo de fala separado.

- Responder a perguntas de ativação e declarações de decisão, se você o escolher como Decision model. Veja [Modelos de decisão](decision-models.md).
A janela de configuração chama esse recurso de **Local AI Model**. Os menus suspensos de conexão mostram **Local Model (sidecar)**. É tudo a mesma coisa.

Não use o Local Model para o chat principal, para o roleplay, para a narração do Game Master nem para as edições da Professor Mari. Ele é pequeno demais para dar bons resultados nessas tarefas. Prefira uma conexão mais forte. Veja [Conectando a um provedor de IA](connecting-to-a-provider.md).

## Como abrir o card Local Model

O Local Model fica no painel **Connections** (conexões).

1. Abra o painel **Connections**.
2. Encontre o card com o título **Local Model**.
3. Clique no card ou no botão de engrenagem chamado **Open local model settings**.

O botão de engrenagem abre a janela de configuração completa, chamada **Local AI Model**. Se nenhum modelo tiver sido baixado ainda, o card também mostra o botão **Download now** e o botão **Choose model options**. Os dois abrem a mesma janela.

Dentro da janela de configuração aparece uma caixa de aviso com o título **Local Model is for helpers, not main roleplay**. É o mesmo lembrete: o modelo serve só para tarefas auxiliares.

## Hardware e sistemas operacionais compatíveis

O Local Model baixa um runtime (o programa que executa o modelo) e um arquivo de modelo. O computador precisa de espaço livre em disco e de memória (RAM) suficientes para os dois.

O suporte muda conforme o sistema operacional:

- **Windows (64 bits) e Linux (64 bits)**: você tem o seletor **Runtime Target** completo, então pode escolher a família da sua placa de vídeo (GPU) ou rodar só no processador (CPU).
- **Windows em ARM e Linux em ARM**: um conjunto reduzido de opções, quase todas baseadas em CPU.
- **macOS com Apple Silicon**: Marinara usa o runtime MLX, ajustado para os chips da Apple. Os modelos personalizados são repositórios do HuggingFace, e não arquivos únicos.
- **macOS com Intel e Android**: na prática, só CPU.

O Local Model não existe nas instalações "Lite". A instalação Lite é uma versão enxuta, que deixa o runtime local de fora para economizar espaço. Nela, o card **Local Model** não aparece.

## Primeira configuração

Instale o runtime primeiro e só depois escolha um modelo.

1. Abra a janela de configuração **Local AI Model**.
2. Clique em **Install Runtime**. No Apple Silicon, esse botão se chama **Install MLX Runtime**.
3. Espere a instalação do runtime terminar. Uma barra de progresso mostra o download.
4. Escolha um modelo conforme a seção **Como baixar um modelo**, abaixo.
5. Espere o download do modelo terminar.
6. Quando o status mostrar **Ready**, clique em **Done**.

Se você não quiser terminar agora, clique em **Skip for Now**. Depois que existir um modelo, esse botão passa a se chamar **Close**.

Instalar ou reinstalar o runtime é uma ação protegida. Nas instalações de um clique do Windows, ela já vem liberada. No macOS, no Linux e no Docker, pode ser preciso liberar na mão. Veja a seção **Solução de problemas**, abaixo.

Marinara baixa apenas as versões de llama.cpp, MLX e uv aprovadas para a sua versão do Engine. Antes de extrair ou executar qualquer coisa, Marinara confere o tamanho exato do arquivo e a soma de verificação SHA-256. O conjunto de dependências Python do MLX também tem versão fixa e hash verificado, e o código revisado do mlx-lm é instalado sem resolver pacotes extras. Assim, as atualizações do runtime chegam por atualizações revisadas do Marinara, em vez de seguir em silêncio uma build "latest" do projeto original.

## Como baixar um modelo

A janela de configuração oferece dois caminhos para conseguir um modelo.

### Presets prontos

Em **Curated Gemma 4 Presets** você escolhe entre duas opções prontas. Em hardware que não é da Apple, elas usam o formato GGUF:

| Preset | Tamanho do download | RAM em execução |
| --- | --- | --- |
| Q8 (Best Quality) | cerca de 5,4 GB | cerca de 5,8 GB |
| Q4_K_M (Smaller, Faster) | cerca de 3,2 GB | cerca de 3,6 GB |

A opção Q8 vem marcada como **Recommended**. É a que dá a melhor qualidade. A opção Q4_K_M é menor e mais rápida, e consome menos memória.

No Apple Silicon, esses presets viram presets MLX. O preset MLX de 8 bits pede cerca de 5,9 GB de download e cerca de 7,5 GB de RAM. O preset MLX de 4 bits pede cerca de 3,6 GB de download e cerca de 4,8 GB de RAM.

Para baixar um preset:

1. Selecione o preset que você quer.
2. Clique em **Use Curated Preset**. Se já houver um modelo, esse botão se chama **Switch to Curated Preset**.

### Como usar um modelo seu

Em **Use Your Own Model From HuggingFace** você pode indicar um modelo seu, hospedado no HuggingFace, um site público de compartilhamento de modelos.

1. Digite o nome do repositório no campo. O formato é `owner/repo`.
2. Clique em **List Models**. No Apple Silicon, esse botão se chama **Validate Repo**.
3. Em hardware que não é da Apple, escolha um arquivo específico no menu suspenso e clique em **Download Selected GGUF**.
4. No Apple Silicon, depois que o repositório for validado, clique em **Use Validated MLX Repo**.

Marinara mantém apenas um arquivo de Local Model no disco por vez. Quando você baixa um modelo novo, Marinara exclui o antigo antes. Não existe um botão separado para excluir o Local Model principal. Para removê-lo, baixe outro modelo por cima.

## Referência de Runtime Settings

Abra a seção **Runtime Settings** dentro da janela de configuração para ajustar como o modelo roda. Os campos são salvos de formas diferentes:

- Os menus suspensos e o botão liga/desliga **Native Tool Calls** são salvos assim que você muda o valor.
- Os campos **Context Window**, **Max Response Tokens**, **Temperature**, **Top P** e **Top K** só valem depois que você clica em **Apply Settings**.
- O campo **Physical Batch Size** tem o próprio botão **Apply**. O mesmo vale para o campo de quantidade de camadas, que aparece quando **GPU Offload** está em **Custom GPU layers**.

| Configuração | Padrão | O que controla |
| --- | --- | --- |
| Runtime Target | Auto detect | Para qual família de GPU Marinara faz a instalação |
| GPU Offload | Auto offload | Quanto trabalho vai para a GPU |
| Native Tool Calls | On | Permite que o modelo use ferramentas e chamadas de função |
| Pooling Type | None | O cálculo de embedding para a busca em lorebooks |
| Physical Batch Size | 512 | O tamanho do lote nas requisições de embedding de lorebook |
| Context Window | 8192 | Quanto texto o modelo lê de uma vez |
| Max Response Tokens | 4096 | O tamanho máximo da resposta do modelo |
| Temperature | 0.3 | O quanto as respostas são aleatórias |
| Top P | 0.95 | Um limite de amostragem na escolha das palavras |
| Top K | 64 | Um limite de amostragem na escolha das palavras |

Observações sobre os campos mais complicados:

- **Runtime Target** e **GPU Offload** só aparecem no runtime GGUF. No Apple Silicon, o MLX escolhe o acelerador por você.
- **Pooling Type** e **Physical Batch Size** também só aparecem no runtime GGUF, sob o título **Embedding Endpoint**. Eles ajustam apenas os embeddings de lorebook. Não mudam as respostas normais do chat.
- **Pooling Type** vem em **None** por padrão. Mude para **Mean** quando usar o Local Model nos embeddings de lorebook.
- **Physical Batch Size** define quanto texto o endpoint de embedding processa em um lote. Aumente esse valor quando entradas longas de lorebook falharem na vetorização. O aplicativo sugere 1024 para o Gemma.
- **Native Tool Calls** precisa estar ativado para as ferramentas funcionarem. O aviso diz que a Professor Mari e os agentes personalizados precisam dessa opção ativada antes de o modelo local usar ferramentas. Essa opção não existe no runtime MLX.
- **Max Response Tokens** limita as respostas normais do chat e dos agentes. Não limita a análise de cena do Game Mode, que tem o próprio limite interno.

## Send Test Message

Use o botão **Send Test Message** para conferir se o runtime funciona. Ele fica na seção Runtime e só é liberado depois que um modelo foi baixado e o runtime instalado.

1. Clique em **Send Test Message**.
2. Espere a caixa de resultado.
3. Em caso de sucesso, a caixa mostra **Local Test Message Succeeded** e o tempo de ida e volta.
4. Em caso de falha, a caixa mostra **Local Test Message Failed** e o erro.

O teste usa um prompt fixo. Ele ignora as configurações de Temperature e de tokens, então é uma verificação limpa de que o modelo responde.

## Como usar o Local Model nas tarefas auxiliares

Depois que um modelo é baixado, o card **Local Model** mostra dois botões liga/desliga:

- **Use for tracker agents (roleplay)**. Vem desativado por padrão.
- **Use for game scene analysis**. Vem ativado por padrão.

Esses dois botões decidem se Marinara mantém o Local Model rodando em segundo plano. Se os dois ficarem desativados, o runtime não inicia sozinho. Ao ativar qualquer um deles, Marinara passa a iniciar o servidor local automaticamente. A primeira inicialização depois disso pode demorar um pouco.

O card também tem o botão **Use local model for all tracker agents**. Ele aponta todos os agentes tracker nativos para o Local Model de uma só vez. Uma linha abaixo mostra quantos agentes tracker estão apontando para o modelo local, por exemplo "3/7 built-in tracker agents currently point at the local model." Isso muda apenas qual modelo os agentes usam. Não ativa os agentes. Veja [Memory Recall e resumos do chat](../agents/memory.md) e o guia do seu modo para saber como ativá-los.

No Game Mode você também pode direcionar o trabalho de cena para o Local Model. Na configuração do Game, o menu suspenso **Scene Effects Connection** oferece a opção **Local Model (Gemma)**. Ao escolher essa opção, o botão **Use for game scene analysis** é ativado. Veja [Game Mode: primeiros passos](../game/getting-started.md).

### O Local Model nos embeddings de lorebook

Você pode usar o Local Model para a busca semântica em lorebooks. Nos controles de vetorização do lorebook, escolha **Local Model (sidecar)** como conexão. Para isso, **Use for tracker agents (roleplay)** ou **Use for game scene analysis** precisa estar ativado antes. Se os dois estiverem desativados, a requisição falha com uma mensagem dizendo que o modelo local precisa estar ativado para os trackers ou para a análise de cena do jogo. Esse caminho usa o runtime GGUF e não existe no MLX do Apple Silicon. Veja [Busca semântica para lorebooks](../lorebooks/semantic-search.md).

## Como usar o Local Model como conexão de chat

Depois que um modelo é baixado, o Local Model aparece no fim da maioria dos seletores de conexão. Ele aparece como **Local Model (sidecar)** ou como **Local Model** com o nome do modelo entre parênteses, quando esse nome é conhecido.

Se você escolher essa opção para um chat normal, aparece um aviso. Ele diz que o Local Model é minúsculo e feito para tarefas auxiliares. O aviso também lembra que as respostas do chat principal e do roleplay podem ficar lentas, curtas ou de baixa qualidade. Essa entrada não é uma conexão salva de verdade, então não é possível salvar padrões de conexão para ela.

Ao selecionar essa opção em um chat, o servidor local inicia sob demanda, mesmo com os dois botões auxiliares desativados. O menu suspenso do modelo principal do Game Mode não lista essa opção. O Game Mode usa o Local Model somente pelo campo **Scene Effects Connection**.

## O Local Speech Model nas chamadas

O **Local Speech Model** é um download opcional do Calls para transcrever o microfone offline. Ele funciona nas chamadas de Conversation quando você escolhe transcrever a sua voz na própria máquina. É um modelo Whisper, um modelo de fala para texto que transforma as palavras faladas em texto escrito.

Primeiro instale o **Calls** em **Agents > Download Agents**. Depois disso, o Whisper é gerenciado pelo card **Local Model**, em Connections, sob o título **Local Speech Model**. O título e os controles de download ficam escondidos enquanto o Calls não estiver instalado.

Há duas opções:

- **Whisper Tiny (Multilingual)**: cerca de 180 MB de download e cerca de 350 MB de RAM. A melhor primeira escolha para celulares e máquinas mais antigas.
- **Whisper Base (Multilingual)**: cerca de 320 MB de download e cerca de 650 MB de RAM. Mais preciso com fala confusa, porém mais lento para iniciar.

Veja como configurar:

1. Abra o card **Local Model** e expanda-o.
2. Em **Local Speech Model**, escolha um modelo no menu suspenso.
3. Clique em **Download Whisper**.
4. Quando aparecer **Ready**, está tudo pronto.

Para remover só o modelo selecionado, clique no botão de lixeira chamado **Delete Local Whisper**. Ao desinstalar o Calls, Marinara exclui automaticamente todas as opções de Whisper baixadas e a seleção salva, liberando o espaço em disco. Se você reinstalar o Calls mais tarde, os controles do Local Speech Model voltam e o Whisper pode ser baixado de novo.

O áudio gravado nunca sai da sua máquina. Só o texto transcrito vai para a conexão de chat escolhida. Para usar isso em uma chamada, defina o modo de entrada de áudio da chamada como a opção Local Whisper. Veja [Chamadas de áudio e vídeo no Conversation Mode](../conversation/calls.md).

## Solução de problemas

**"Sidecar runtime install is disabled."** Instalar ou reinstalar o runtime é uma ação protegida. As instalações de um clique do Windows já liberam isso. No macOS, no Linux e no Docker, há duas saídas. Defina `SIDECAR_RUNTIME_INSTALL_ENABLED=true` no arquivo `.env` do servidor, assim:

```
SIDECAR_RUNTIME_INSTALL_ENABLED=true
```

Ou informe uma vez o segredo de Admin Access em **Settings -> Advanced -> Admin Access** e tente de novo. Veja [Referência de configuração do servidor](../CONFIGURATION.md).

**O runtime não iniciou.** A janela de configuração mostra uma caixa com o título **Local runtime failed to start**, o erro e o caminho do arquivo de log. Clique em **Retry Startup**. Se não resolver, clique em **Reinstall Runtime** ou tente outro **Runtime Target**. Você pode clicar em **Continue Without Local AI** para continuar usando Marinara sem o Local Model. O card em Connections mostra o mesmo problema como **Local runtime unavailable**.

**O download do runtime acusa divergência de tamanho ou de SHA-256.** Marinara descartou o download antes de extrair. Atualize o Marinara primeiro e tente de novo, para que o manifesto de runtime aprovado e o download combinem. Se a mesma versão continuar falhando, não extraia nem execute o arquivo compactado na mão. Informe aos mantenedores qual runtime target você usava e qual foi o erro.

**A busca em lorebooks diz que o modelo local não está ativado.** Ative **Use for tracker agents (roleplay)** ou **Use for game scene analysis** no card **Local Model** e tente a vetorização de novo.

**Um aviso do Game Mode mostra "Local scene helper failed to start."** Clique em **Open Local AI Model** no aviso para tentar de novo, trocar de modelo ou desativar a análise de cena local.

Para mais ajuda, veja [Solução de problemas do Marinara Engine](../TROUBLESHOOTING.md).

## Guias relacionados

- [Conectando a um provedor de IA](connecting-to-a-provider.md)
- [Modelos de decisão](decision-models.md)
- [Conectar um modelo local ou auto-hospedado](local-self-hosted.md)
- [Memory Recall e resumos do chat](../agents/memory.md)
- [Chamadas de áudio e vídeo no Conversation Mode](../conversation/calls.md)
- [Game Mode: primeiros passos](../game/getting-started.md)
- [Busca semântica para lorebooks](../lorebooks/semantic-search.md)
