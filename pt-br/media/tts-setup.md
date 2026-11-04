# Configuração de Text to Speech (TTS)

O Text to Speech (TTS), a conversão de texto em voz, lê em voz alta as mensagens do chat e a narração do jogo. Este guia mostra como ativá-lo, escolher um serviço de voz e as vozes, configurar a leitura automática e usar os controles de cada mensagem.

## Início rápido

1. Abra o card de Text to Speech (passos abaixo) e ative **Use text to speech** (usar a conversão de texto em voz).
2. Escolha um **Source** (origem) e cole a sua chave em **API key** (chave de API).
3. Clique em **Preview** (ouvir) para escutar uma amostra.
4. Em um chat, clique em **Speak** (falar) embaixo de uma mensagem.

## Ative o Text to Speech

Quase toda configuração de TTS fica em um card só. Ativar o TTS não faz nada falar sozinho. Isso revela o botão **Speak** em cada mensagem e as opções de **Auto-play** (leitura automática). A escolha do que é lido e de quando isso acontece continua sendo sua.

1. Clique em **Connections** (Conexões) na barra superior e depois em **Add** (adicionar). A janela **Add account** (adicionar conta) abre.
2. Em **Voice** (voz), escolha **Text to speech**. O card abre. Se você já usa o PocketTTS, o mesmo card também fica em **On this device** (neste dispositivo).
3. Ative **Use text to speech**. Enquanto essa opção estiver desligada, nada é lido em voz alta.
4. Abra a lista **Source** e escolha um serviço.

Um **Source** é o serviço que produz o áudio.

- **OpenAI-compatible**: a OpenAI, ou qualquer servidor que copie o formato de TTS da OpenAI. Esta é a opção padrão.
- **ElevenLabs**: o serviço de voz da ElevenLabs.
- **PocketTTS**: um servidor de voz gratuito que roda no seu próprio computador.
- **xAI Voice**: o serviço de voz da xAI.

Marinara guarda um perfil salvo separado para cada Source: a chave, o endereço, o modelo, as vozes e os parâmetros. Ao trocar de Source, a configuração anterior daquele Source volta. Um Source que você ainda não configurou começa com os valores padrão.

As requisições passam pelo próprio servidor do Marinara. A sua chave de API é guardada criptografada no servidor. Depois que você a salva, o campo mostra pontinhos mascarados, e a chave real nunca volta para o seu navegador.

<a id="use-an-audio-connection"></a>

### Usar uma conexão de áudio

Se você já adicionou uma conta **Audio** (veja [Provedores de IA compatíveis](../connections/providers-reference.md#audio)), não precisa digitar os dados dela de novo. Ela aparece na lista **Source**, em **Audio providers** (provedores de áudio), com o tipo de fonte entre colchetes.

1. Abra a lista **Source** e escolha a conta.
2. Escolha as vozes dela e as outras configurações abaixo.

Marinara passa a usar o endereço, a chave, o modelo e o **Request timeout (seconds)** (tempo limite da requisição, em segundos) dessa conta, então o card esconde esses campos. A chave fica na conta e nunca é copiada para o card nem enviada ao seu navegador. As mudanças na conta, como uma chave nova, valem na hora.

As vozes, a velocidade e as outras configurações de fala são salvas por conta. Duas contas do mesmo tipo nunca as compartilham. As suas configurações dos quatro Sources normais continuam como estavam. O botão liga/desliga do card continua ligando e desligando o TTS normal.

Se a conta escolhida for excluída ou não puder ser usada, o card mostra **Missing Audio provider** (provedor de áudio ausente) e nada é falado até você escolher outro Source. Marinara nunca troca sozinho. Se a conta lista as vozes dela, o card indica qualquer voz salva que não esteja na lista.

## Defina o endereço, a chave e o modelo

Pule esta parte se você escolheu uma conta Audio. A conta fornece esses dados.

1. Confira **Base URL** (endereço base). Cada Source preenche um valor padrão (tabela abaixo). Só mude esse valor para um proxy ou um servidor que você executa.
2. Cole a sua chave em **API key**. Para manter uma chave existente, deixe os pontinhos mascarados. Para removê-la, limpe o campo.
3. Confira **Model** (modelo). Cada Source preenche um valor padrão. Você pode digitar outro modelo que o seu serviço aceite.

| Source | Base URL padrão | Modelo padrão | Voz padrão |
| --- | --- | --- | --- |
| OpenAI-compatible | `https://api.openai.com/v1` | `tts-1` | `alloy` |
| ElevenLabs | `https://api.elevenlabs.io` | `eleven_multilingual_v2` | nenhuma, você precisa escolher uma |
| PocketTTS | `http://localhost:8000` | `pocket-tts` | `alba` |
| xAI Voice | `https://api.x.ai/v1` | `grok-tts` | `eve` |

No **ElevenLabs**, a lista **Model** carrega os modelos de fala que a sua conta pode usar. Escolha um modelo de fala comum. Os IDs de modelo que contêm `ttv` são modelos de desenho de voz, que não conseguem ler texto. Se você escolher um deles, a reprodução falha com um erro pedindo que você use um modelo de fala.

### PocketTTS

O PocketTTS não vem embutido no Marinara. Instale [o servidor oficial do PocketTTS](https://github.com/kyutai-labs/pocket-tts) separadamente e inicie-o com `uvx pocket-tts serve`. Marinara não baixa nem gerencia esse programa. O servidor oficial usa `http://localhost:8000`. Mantenha esse valor em **Base URL**, a menos que você tenha mudado o host ou a porta. Marinara detecta a API multipart oficial `/tts`. As URLs personalizadas do [adaptador PocketTTS compatível com a OpenAI](https://github.com/teddybear082/pocket-tts-openai_streaming_server) continuam funcionando.

<a id="request-timeout"></a>

### Tempo limite da requisição

Marinara espera até 60 segundos por cada fala. Um servidor de voz no seu próprio computador, principalmente em um notebook, pode precisar de mais tempo para uma fala longa. Aumente **Request timeout (seconds)**, abaixo de **Model**. A faixa vai de 10 a 3.600 segundos.

Uma conta Audio tem o próprio **Request timeout (seconds)**, abaixo de **Default voice** (voz padrão), no editor dela. Os chats que falam por uma conta Audio, inclusive uma escolhida como **Source**, usam esse limite. O limite do card vale para a fala feita pelas configurações do próprio card, inclusive pelo **Preview**. Se uma fala demorar demais, o erro diz quantos segundos Marinara esperou e qual configuração aumentar.

## Escolha as vozes

**Voice option** (opção de voz) define como as vozes são distribuídas.

- **One voice for all** (uma voz para todos): todos os falantes usam a mesma voz. Esta é a opção padrão.
- **Selected per character or persona** (selecionada por personagem ou persona): você dá vozes próprias aos personagens e às personas que escolher.

### Uma voz para todos

Escolha a voz em **Shared voice** (voz compartilhada). Para carregar a lista real de vozes do seu serviço, preencha os dados dele e clique em **Refresh voices from provider** (atualizar as vozes do provedor), o ícone de seta circular. Isso salva o card primeiro, então uma chave recém-digitada já é usada na hora. Antes de você conectar, aparece uma lista curta embutida para o campo não ficar vazio. Se o serviço retornar um erro, o erro aparece, em vez de a lista de reserva ser apresentada como uma atualização bem-sucedida.

O servidor oficial do PocketTTS não tem um endpoint para listar vozes, então Marinara mostra as vozes embutidas dele e mantém um campo de texto ao lado da lista para outro nome embutido ou uma URL de voz compatível. Os servidores adaptadores compatíveis podem retornar a própria lista e aceitar IDs ou caminhos personalizados.

No **ElevenLabs**, você precisa escolher uma voz. Marinara carrega a biblioteca inteira da conta: as vozes pessoais, as do espaço de trabalho, as salvas e as padrão. O seletor tem uma caixa de busca e um contador das vozes carregadas. Ele começa em "Select an ElevenLabs voice", e a reprodução fica bloqueada até você escolher uma voz de verdade.

### Selecionada por personagem ou persona

1. Defina **Voice option** como **Selected per character or persona**.
2. Em **Character and persona voices** (vozes de personagens e personas), clique em **Add voice** (adicionar voz).
3. Escolha um personagem ou uma persona na lista da esquerda e uma voz na lista da direita.
4. Repita para cada um.

Você também pode definir a voz de um personagem na aba **Voice** do **Character Editor** (editor de personagem). Ela altera a mesma linha. **Refresh** (atualizar), nesta caixa, recarrega a lista de vozes. Crie os seus personagens antes. Se você não tiver nenhum, o aplicativo avisa para adicionar um personagem ou uma persona antes de distribuir as vozes.

Um personagem sem voz própria usa a voz de um card com nome correspondente, como o original de uma cópia AU. Caso contrário, ele usa a voz compartilhada. Veja [Criando e editando personagens](../characters/creating-and-editing-characters.md).

### Voz do narrador

A narração é o texto que nenhum personagem em particular fala, como a descrição de uma cena ou as falas do mestre do jogo.

1. Em **Narrator voice** (voz do narrador), ative **Use separate narrator voice** (usar uma voz de narrador separada).
2. Escolha uma voz.

Ela é usada quando quem fala em uma linha é Narrator, GM, Game Master ou System, nas mensagens de Roleplay e de Conversation, e na narração do Game Mode sem um falante com nome. No ElevenLabs, escolha aqui uma voz de narrador. Se você deixar o campo vazio, a narração só recorre a outra voz quando existe uma voz global definida.

### Vozes aleatórias para NPCs (só no Game Mode)

Este recurso dá vozes livres aos personagens secundários do jogo que o Game Mode acompanha. Ele não tem efeito no Roleplay nem no Conversation.

1. Em **Random NPC voices** (vozes aleatórias para NPCs), ative **Use default voices for random NPCs** (usar vozes padrão para NPCs aleatórios).
2. Marque vozes em **Male NPC defaults** e **Female NPC defaults**.

Um NPC (personagem não jogável) acompanhado que não tenha voz própria recebe uma escolha estável do conjunto correspondente e fica com ela durante a sessão. Um NPC com voz atribuída fica com essa voz. Os NPCs de gênero indefinido escolhem dos dois conjuntos. Se o aplicativo não encontrar vozes marcadas como masculinas ou femininas, cada conjunto usa a lista completa.

## Formato do áudio e velocidade

**Audio format** (formato do áudio) é **MP3** (o padrão) ou **WAV**. Use WAV em servidores locais que não conseguem gerar MP3. O controle fica oculto no ElevenLabs, que sempre usa MP3. Ele aparece no xAI Voice, mas não tem efeito, porque a xAI sempre devolve MP3.

A faixa do controle deslizante **Speed** (velocidade) depende do Source:

| Source | Faixa |
| --- | --- |
| OpenAI-compatible | 0,25 a 4,0 vezes |
| PocketTTS | 0,25 a 4,0 nos adaptadores compatíveis. O servidor oficial controla a velocidade por conta própria. |
| ElevenLabs | 0,7 a 1,2 vezes |
| xAI Voice | 0,7 a 1,5 vezes |

Uma velocidade salva fora da faixa é ajustada para o valor permitido mais próximo. No ElevenLabs há mais dois controles: **Language** (forçar um idioma ou deixar em **Auto detect**) e **Stability** (de mais expressiva a mais constante).

## Auto-play

Cada botão liga/desliga de **Auto-play** lê um tipo de mensagem nova assim que ela termina de ser gerada. Eles precisam de **Use text to speech** ligado. Todos começam desligados.

- **Roleplay messages**: as novas respostas do Roleplay.
- **Conversation messages**: as novas respostas do Conversation.
- **Game narration**: a narração e as linhas de combate novas do Game Mode.
- **Progressive playback**: começa a tocar na hora a primeira linha de uma resposta com várias linhas, em vez de esperar a resposta inteira.
- **Only read dialogues**: lê apenas as falas entre aspas ou marcadas como fala e pula a narração comum.

A leitura automática acontece uma vez só, na resposta mais recente, quando ela termina. Ela não lê de novo as mensagens antigas quando você reabre ou rola um chat.

Em Roleplay, a preparação da voz começa assim que a resposta principal é salva. Se um agente ativo reescrever a resposta, como o Prose Guardian, Marinara espera pelo texto final.

### Filtros de texto e orientações de emoção

Esses filtros se aplicam à reprodução manual e à leitura automática, incluindo a narração do Game e a identificação de falantes em Roleplay. Os blocos de código são ignorados por padrão. Os outros dois começam desligados.

- **Skip text inside HTML and custom tags** (ignorar texto dentro de tags HTML e personalizadas): remove o texto contido nelas, como um bloco oculto `<simulation>...</simulation>`. As tags de falante usadas para escolher vozes ficam.
- **Skip fenced code blocks** (ignorar blocos de código delimitados).
- **Skip text inside square brackets** (ignorar texto entre colchetes).

Ative **Roleplay speaker extractor** (identificação de falantes em Roleplay) para ver **Enable emotion indicators** (ativar indicadores de emoção). Isso acrescenta orientações de voz sem mudar as palavras do diálogo. Com os indicadores de emoção ativados, o texto entre colchetes vai para o serviço de voz mesmo quando **Skip text inside square brackets** está ativado. Isso pode incluir notas. Para que as notas entre colchetes fiquem fora da fala, desative os indicadores de emoção e mantenha a opção de ignorar ativada. Orientações como `[Low, steady voice, restrained urgency]` ficam inteiras quando uma linha longa é dividida. As marcações conhecidas de falante e de cena continuam sendo removidas. O modelo de voz decide como usar cada orientação. Com **Use text to speech**, **Game narration** e os indicadores de emoção ativados, os diálogos de cena, da equipe e de combate do Game também podem incluir orientações.

## Falar uma mensagem

Com o TTS ligado, um botão **Speak** (um ícone de microfone) aparece na barra de ferramentas embaixo de cada mensagem de personagem ou de narrador.

- Clique em **Speak** para ler a mensagem. O botão mostra um estado de carregamento enquanto busca o áudio.
- Clique de novo durante a reprodução para parar. A dica mostra **Stop speaking**.
- Uma mensagem sem texto legível, como uma que tenha só uma imagem, mostra **No dialogue to speak** e fica desativada.

Enquanto uma mensagem é falada, aparecem os botões **Pause speaking**, **Resume speaking** e **Restart speaking**. O botão com ícone de alto-falante abre o controle deslizante **Line volume** (volume da fala), de 0 a 100% (50 por padrão). Ele é separado do mixer do Game Mode e do volume da chamada no Conversation.

Se não funcionou, veja [Solução de problemas](#troubleshooting).

## Clipes em cache

Marinara salva o áudio gerado no seu navegador para não gerar a mesma fala duas vezes. O painel **Cached clips** (clipes em cache) mostra a quantidade e o tamanho total em tempo real. Clique em **Export cached TTS clips** (exportar os clipes de TTS em cache), o ícone de download, para salvar cada clipe do cache como um arquivo de áudio separado. O cache descarta os clipes mais antigos por conta própria. Não existe um botão de limpeza no aplicativo. Limpe os dados do navegador para esvaziá-lo.

## O TTS em cada modo de chat

- O **Roleplay** usa o botão liga/desliga **Roleplay messages** e os controles **Speak**. Veja [Roleplay Mode: primeiros passos](../roleplay/getting-started.md).
- O **Conversation** usa o botão **Conversation messages** e os mesmos controles. As chamadas de áudio são explicadas em [Chamadas de áudio e vídeo no Conversation](../conversation/calls.md).
- O **Game Mode** usa o botão **Game narration**. O mixer dele tem um canal **TTS** ao lado de **Master**, **Music**, **Sound Effects** e **Ambient**. Esse canal define o volume do áudio falado do jogo e começa em 100%. Veja [Os controles do jogo](../game/getting-started.md#the-games-controls).

### Nome fonético (pronúncia nas chamadas)

Se a voz pronunciar errado o nome de um personagem ou de uma persona, adicione um **Phonetic name** (nome fonético) e digite como ele deve soar. No **Character Editor**, ele fica na aba **Voice**. No **Persona Editor** (editor de persona), ele fica junto dos campos de informação básica. Ele só é usado nas chamadas de áudio e vídeo do Conversation. O **Speak**, a leitura automática e a narração do Game Mode o ignoram.

<a id="troubleshooting"></a>

## Solução de problemas

- **Nada é falado**: confirme se **Use text to speech** está ligado. Depois confira o botão de **Auto-play** certo, ou use **Speak** em uma mensagem.
- **O card mostra Missing Audio provider**: a conta escolhida como **Source** foi excluída ou não pode ser usada. Escolha outro Source. Veja [Usar uma conexão de áudio](#use-an-audio-connection).
- **Nenhuma voz na lista**: salve o card com o TTS ativado e uma chave válida, depois clique em **Refresh voices from provider**. O servidor oficial do PocketTTS usa a lista embutida do Marinara. Para um adaptador compatível do PocketTTS, verifique se `<Base URL>/v1/voices` responde.
- **O ElevenLabs não fala**: escolha uma voz de verdade, e não o marcador "Select an ElevenLabs voice". Confira se **Model** é um modelo de fala, e não um modelo de desenho de voz com `ttv` no ID.
- **Uma fala para com "No audio after 60 s"**: o servidor de voz precisa de mais tempo. Aumente **Request timeout (seconds)** onde a mensagem indicar. Veja [Tempo limite da requisição](#request-timeout).
- **Um servidor próprio em um endereço local está bloqueado**: ative `TTS_LOCAL_URLS_ENABLED` no `.env`. Com isso, Marinara alcança um endereço local ou privado em servidores no formato OpenAI-compatible ou ElevenLabs. O PocketTTS não precisa disso. Veja [Referência de configuração do servidor](../CONFIGURATION.md).
- **Teste rápido**: clique em **Preview** no card para ouvir uma amostra curta com as configurações atuais.

## Referência: música, efeitos sonoros e Gacha Forge

Estas seções são para configurações avançadas.

<a id="game-music-and-sound-effects-on-a-compatible-audio-server"></a>

### Música e efeitos sonoros de Game em um servidor de áudio compatível

1. Em **Connections**, abra a sua conta **Music & Sound Effects** (música e efeitos sonoros) com **Edit model** (editar modelo) e escolha **Custom compatible server** (servidor compatível personalizado). A janela **Add account** não tem um botão para esse tipo de conta; ela vem de uma atualização ou de uma importação (veja [a referência de contas](../connections/providers-reference.md#music--sound-effects)).
2. Informe o endereço, a chave e o modelo do seu servidor de música ou de efeitos sonoros.
3. Defina **Generation API format** (formato da API de geração) e informe os caminhos dos endpoints que o seu servidor oferece. Um caminho vazio deixa essa função indisponível.
4. Ative **Music generation** (geração de música), **Sound-effect generation** (geração de efeitos sonoros) ou as duas opções.
5. Selecione essa conta na configuração do Game ou nas configurações de áudio da partida. Mantenha a sua conta de fala selecionada separadamente no card de TTS.

Os caminhos dos endpoints são acrescentados à Base URL da conta. Para `http://localhost:8002/v1`, use `chat/completions` para acessar `/v1/chat/completions`. Endpoints HTTP locais exigem `TTS_LOCAL_URLS_ENABLED=true` no `.env`, como as demais requisições locais de áudio compatível.

Há dois formatos de API com suporte:

- **Prompt JSON → MP3 audio** envia `{ "model": "your-model", "prompt": "the requested sound", "duration": 5, "response_format": "mp3" }` e espera bytes MP3. A música de Game usa a duração da faixa de contexto (120 segundos por padrão). Os efeitos sonoros pedem 5 segundos.
- **Chat Completions → inline audio (ACE-Step compatible)** envia `model`, uma entrada de usuário em `messages`, `stream: false` e `audio_config` com `duration`, `instrumental: true` e `format: "mp3"`. Ele aceita MP3 embutido em `choices[0].message.audio`: um array de URLs de áudio ACE-Step contendo uma URL de dados base64 ou um objeto com `data` em base64. Veja o [contrato de API compatível com ACE-Step](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/Openrouter_API_DOC.md). URLs remotas de resultado e APIs de tarefas assíncronas não têm suporte.

Ative apenas o que o seu servidor implementa. Um endpoint de fala compatível com OpenAI, sozinho, não significa suporte a música ou a efeitos sonoros. Um serviço como o Infermatic precisa oferecer um desses formatos ou fornecer um adaptador. O endpoint de música real dele não foi verificado aqui. Para geração nativa com ElevenLabs ou SunoAPI, use a fonte correspondente em **Music & Sound Effects**. Veja [a referência de contas](../connections/providers-reference.md#music--sound-effects).

A música de contexto gerada é composta uma vez por área ou nível de encontro e reutilizada. Efeitos sonoros repetidos usam o cache de áudio. Um erro de geração mantém o cache disponível para uma nova tentativa.

<a id="gacha-forge-dialogue-and-audio"></a>

### Diálogo e áudio do Gacha Forge

O Gacha Forge 1.11.0 ou posterior usa a conta selecionada no card de TTS e as vozes atribuídas a cada personagem nela. - Ative **Read character dialogue** (ler diálogos dos personagens) para ler os diálogos de personagens importados que tenham uma voz atribuída. Essa opção fica na etapa **Lore** (conhecimento do mundo) da configuração de um mundo novo, ou nas configurações de mundo do próprio Gacha Forge, para um mundo existente. Narração, pensamentos, unidades geradas sem um ID de personagem do Engine e personagens sem voz ficam em silêncio. Só o nome nunca faz um personagem usar a voz de outro.
- Uma conta Audio selecionada pode ser usada quando o botão liga/desliga de TTS do mundo está ligado. Quando você usa diretamente as configurações de fonte do próprio card, **Use text to speech** também precisa estar ligado.
- A música e os efeitos sonoros incluídos de Game não precisam de uma conta de geração. Para compor faixas novas, ative **Generate music and sound effects** (gerar música e efeitos sonoros) no Gacha Forge e escolha uma conta Music & Sound Effects em **Audio connection** (conexão de áudio). Esse seletor aparece quando a geração está ativada. As faixas da tela inicial, de combate, de chefe, de cenas de história e de histórias de personagens são geradas no primeiro uso e depois reutilizadas. Essas requisições usam a sua conta no serviço.
- O botão de silenciar no canto superior direito silencia música, diálogo e efeitos sonoros juntos. As configurações visuais do Gacha Forge têm controles de volume separados para os três, inclusive volume zero, além da pausa da reprodução automática (padrão de **3 segundos**, depois da revelação do texto e de qualquer diálogo falado). As escolhas continuam esperando pelo jogador. O diálogo falado é cancelado quando você sai de uma cena. Sair do mundo interrompe o áudio dele.

Atualize o pacote instalado do Gacha Forge e também o Engine para ter esses controles.

## Guias relacionados

- [Chamadas de áudio e vídeo no Conversation](../conversation/calls.md)
- [Sincronia labial com a conversão de texto em voz](../agents/avatars.md#lip-sync-with-text-to-speech), para avatares 2D e 3D
- [Roleplay Mode: primeiros passos](../roleplay/getting-started.md)
- [Game Mode: primeiros passos](../game/getting-started.md)
- [Provedores de IA compatíveis](../connections/providers-reference.md)
- [Criando e editando personagens](../characters/creating-and-editing-characters.md)
- [Referência de configuração do servidor](../CONFIGURATION.md)
