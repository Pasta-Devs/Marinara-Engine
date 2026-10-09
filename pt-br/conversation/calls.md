# Chamadas de áudio e vídeo no Conversation Mode

Este guia explica as chamadas do Conversation Mode no Marinara Engine. Aqui você vê como uma chamada funciona, como configurar tudo, como conversar durante a chamada e como resolver os problemas mais comuns.

As chamadas existem apenas no Conversation Mode. Chats de Roleplay e de Game não têm tela de chamada.

Calls é um pacote de agente opcional. Instale **Calls** em **Agents → Download Agents** antes de seguir a configuração abaixo e reinicie Marinara quando o catálogo pedir.

## O que é uma chamada

A chamada abre uma tela ao vivo, no estilo do Discord, onde você conversa com um ou mais personagens. Ela fica por cima do chat normal do Conversation enquanto durar.

Durante a chamada:

- Personagens com uma voz de Text to Speech (TTS) funcionando falam as falas em voz alta. TTS é a conversão de texto em voz.
- Personagens sem voz respondem por mensagens escritas no chat da chamada.
- Você responde pelo microfone ou digitando.
- Se quiser, você também vê clipes de vídeo em loop gerados por IA no lugar do avatar parado.

A chamada não é uma ligação ponto a ponto. Marinara grava o microfone ou a câmera do navegador local. Esse material vai para o modelo escolhido naquele Conversation. As respostas saem faladas pelo provedor de TTS, e os dados da chamada ficam guardados na sua própria máquina.

Quando a chamada termina, Marinara escreve um resumo curto da chamada de áudio de volta no Conversation normal. A transcrição completa fica em um armazenamento separado, e não é copiada mensagem por mensagem para o chat principal.

## Antes de começar

Para ter uma chamada de voz funcionando, monte estas peças nesta ordem. As etapas marcadas como Opcional podem ser puladas.

1. Um chat no Conversation Mode com pelo menos um personagem.
2. Uma conexão de modelo normal selecionada para esse chat. É esse modelo que escreve as respostas do personagem durante a chamada.
3. A opção **Audio/Video Calls** (chamadas de áudio e vídeo) ativada nesse chat – veja a seção "Ative as chamadas em um chat", abaixo.
4. A opção **Call Audio Pipeline** ativada. Ela é obrigatória para iniciar qualquer chamada, mesmo uma em que você só digita ou só escuta. É ela também que libera a entrada de microfone.
5. Text to Speech configurado, para que os personagens possam falar. Sem isso, todo personagem entra só como texto.
6. Opcional: o Local Whisper baixado em Connections depois da instalação do Calls, caso o navegador não faça um reconhecimento de fala confiável (o Firefox precisa disso). Ou o seu próprio servidor de conversão de fala em texto, no lugar do Local Whisper.
7. Opcional: uma conexão de vídeo e clipes gerados, se você quiser usar **Character Video Presence**.
8. Opcional: uma conexão de imagem definida como Selfie Connection do chat, se você quiser que os personagens mandem selfies na chamada.

### Configure o Text to Speech

O Text to Speech define quais personagens podem falar e qual voz cada um usa. É um recurso compartilhado, então tem um guia próprio.

O passo a passo completo está em [Configuração de Text to Speech (TTS)](../media/tts-setup.md). Em resumo, abra **Connections** (Conexões) e depois **Text to Speech**, e então:

1. Ative o Text to Speech.
2. Escolha uma fonte: **OpenAI-compatible**, **ElevenLabs**, **PocketTTS** ou **xAI Voice**.
3. Informe a chave do provedor ou o endereço do servidor local dessa fonte.
4. Escolha um modelo e uma voz.
5. Defina a opção **Voice Option** como **One voice for all characters** ou **Selected per character**.
6. Salve e use o botão de prévia para confirmar que o áudio sai.

Em uma chamada em grupo, vozes por personagem facilitam muito saber quem está falando. Se Marinara não conseguir resolver a voz de um personagem, ele entra na chamada só como texto.

### Escolha um modo de entrada de microfone

Com **Call Audio Pipeline** ativado, aparece o menu suspenso **Audio input mode** (modo de entrada de áudio) com quatro opções. Escolha a que combina com o navegador e o provedor.

- **Mic recording + Local Whisper**: grava enquanto você está sem mudo, ignora o silêncio e converte a fala em texto na sua própria máquina. É o padrão e a melhor escolha no Firefox.
- **Browser speech recognition**: usa o recurso Web Speech do navegador. A Web Speech API é uma ferramenta embutida no navegador que transforma fala em texto. O suporte varia de navegador para navegador, e Marinara recorre ao Local Whisper quando ele não existe.
- **Manual system dictation**: apenas põe o cursor na caixa de texto da chamada, para que o ditado do sistema operacional digite ali. Nesse modo, Marinara não grava o microfone por conta própria.
- **Provider-native audio/video**: manda o áudio ou o vídeo gravado direto para o modelo do Conversation, quando esse modelo aceita mídia diretamente. Se o modelo não aceitar, use o Local Whisper ou o reconhecimento de fala do navegador.

Os botões de câmera e de tela só aparecem quando **Camera and screen input** está ativado. E eles funcionam apenas no modo **Provider-native audio/video**. Em qualquer outro modo os botões aparecem, mas ficam desativados.

### Baixe o Local Whisper

O Local Whisper transforma a fala em texto na própria máquina que roda Marinara. O áudio do microfone nunca sai dessa máquina para ser transcrito. Ainda assim, o texto resultante é enviado ao modelo do Conversation como parte da chamada.

O Local Whisper pertence ao pacote Calls e é o caminho de microfone mais confiável em navegadores com suporte fraco a fala, incluindo o Firefox. Depois de instalar Calls, abra **Connections**, abra **Local Model**, expanda o card e procure **Local Speech Model**. A seção fica oculta quando Calls não está instalado. Sobre o card **Local Model** em geral, veja [Como configurar o Local Model](../connections/local-model.md).

1. Escolha um modelo. **Whisper Tiny (Multilingual)** é o padrão. São cerca de 180 MB de download e cerca de 350 MB de memória em uso. É a melhor primeira escolha para celulares e máquinas mais antigas.
2. Ou escolha **Whisper Base (Multilingual)** para mais precisão com falas confusas. São cerca de 320 MB de download e cerca de 650 MB de memória.
3. Clique em **Download Whisper**.
4. Espere a barra de progresso chegar ao fim.

Depois do download, aparece o controle **Delete Local Whisper** (ícone de lixeira), caso você queira remover o modelo.

Desinstalar Calls também exclui todo modelo Whisper baixado e a seleção salva. Assim você recupera o espaço em disco do modelo. Reinstalar Calls traz os controles de download de volta, mas nada é baixado de novo até você escolher um modelo.

<a id="use-your-own-speech-to-text-server"></a>

### Use seu próprio servidor de conversão de fala em texto

Se o Local Whisper tiver dificuldade com o seu idioma ou o seu sotaque, você pode enviar a voz gravada para outro modelo de conversão de fala em texto. Isso funciona com qualquer servidor que ofereça o endpoint `/audio/transcriptions` no estilo da OpenAI. Entram aí servidores auto-hospedados, como Speaches, servidores faster-whisper, LocalAI e o servidor do whisper.cpp (iniciado com `--inference-path /v1/audio/transcriptions`), e provedores como OpenAI ou Groq.

1. Instale Calls, depois abra **Connections** e procure o card **Speech to Text** (conversão de fala em texto). O card fica oculto enquanto Calls não estiver instalado.
2. Expanda o card e informe a **Server URL** (URL do servidor), por exemplo `http://localhost:8000/v1` para um servidor na sua própria máquina.
3. Informe uma **API key** (chave de API) se o servidor ou o provedor exigir uma. Ela é salva criptografada, e o card só a mostra mascarada.
4. Informe em **Model** (modelo) o nome do modelo que o servidor usa. Deixe vazio para enviar `whisper-1`.
5. Opcional: informe um código em **Language** (idioma), como `pl` ou `de`. Dizer ao modelo qual é o seu idioma costuma melhorar a precisão. Deixe vazio para o servidor detectar sozinho.
6. Clique em **Test** (testar). Marinara envia um clipe silencioso de um segundo e informa se o servidor respondeu.
7. Ative o botão liga/desliga do card.

Enquanto o botão estiver ativado, **Mic recording + Local Whisper** envia a sua fala para esse servidor, no lugar do Local Whisper. Para isso, você não precisa baixar o Local Whisper. Desative o botão para voltar ao Local Whisper. O seu áudio vai para o servidor informado, então use um servidor de confiança.

Um servidor na mesma máquina do Marinara funciona sem ajustes. Um servidor em outra máquina da sua rede doméstica é recusado, a menos que você defina `STT_LOCAL_URLS_ENABLED=true` no arquivo `.env` do servidor. Veja [Referência de configuração do servidor](../CONFIGURATION.md).

Isso exige uma versão do Calls com suporte a esse recurso. Se as chamadas continuarem usando o Local Whisper depois que você ativar o botão, atualize Calls em **Agents → Download Agents**.

## Ative as chamadas em um chat

As chamadas podem ser ativadas durante a criação de um Conversation ou mais tarde, nas configurações do chat.

Em um Conversation novo, termine primeiro o assistente de configuração, depois abra as configurações desse chat e siga os mesmos passos abaixo. As configurações do pacote opcional só aparecem depois que Calls está instalado.

Em um Conversation que já existe:

1. Abra o chat.
2. Abra **Chat Settings** (configurações do chat).
3. Vá até a seção **Agents**.
4. Abra **Calls**.
5. Ative **Audio/Video Calls**. Um botão de chamada deve aparecer ao lado do nome da conversa.
6. Ative **Call Audio Pipeline**. Nenhuma chamada começa sem ele, mesmo que você nunca use microfone.
7. Escolha um **Audio input mode**.

A opção **Audio/Video Calls** e o comando **Calls** são duas configurações diferentes. **Audio/Video Calls** mostra o botão de chamada, para você ligar para um personagem. O comando **Calls** deixa os personagens ligarem para você. Se você desativar **Calls**, ainda pode iniciar chamadas, mas os personagens não devem iniciar chamadas recebidas.

A seção **Agents** também traz um botão liga/desliga geral, o **Commands**, quando há algum pacote de comandos instalado. Ele precisa estar ativado para os comandos ocultos da chamada funcionarem. A chamada em si começa normalmente mesmo com ele desativado.

### Configurações e valores padrão

A maior parte das configurações de chamada fica em **Chat Settings**, depois **Agents**, depois **Calls**. Algumas delas são globais: mudar em um chat muda em todas as chamadas de Conversation do aplicativo.

| Configuração | Alcance | Padrão |
|---|---|---|
| **Audio/Video Calls** | Por chat | Off |
| **Calls** (comando) | Por chat | On |
| **Generate voice cues in [tags]** | Por chat | On |
| **Call Audio Pipeline** | Global | Off |
| **Audio input mode** | Global | Mic recording + Local Whisper |
| **Camera and screen input** | Global | Off |
| **Character video presence** | Global | Off |
| **Automatic video clips generation** | Global | Off |
| **Custom clips** | Global | Off |

A opção **Generate voice cues in [tags]** pede ao modelo que insira deixas curtas entre colchetes, como `[whispering]`, `[laughing]` ou `[sighs]`, dentro das falas. Essas deixas mudam a forma como o TTS lê a linha e ajudam a escolher os clipes de reação. Vem ativada por padrão. Desative para deixar as falas sem marcações.

## Iniciar, receber e encerrar uma chamada

### Iniciar uma chamada

Com as chamadas ativadas no chat, um botão de telefone aparece ao lado do nome da conversa. A dica dele diz **Start call** quando não há chamada ativa, ou **Open call** quando já existe uma em andamento.

Clique em **Start call**. A tela cheia da chamada abre na hora.

Só pode haver uma chamada ativa ou tocando por chat. Se você iniciar uma chamada com outra já em andamento, Marinara reabre a chamada existente em vez de criar outra.

### Chamadas recebidas de personagens

Um personagem pode ligar para você quando o comando **Calls** está ativado. Nesse caso, se você estiver dentro do chat, aparece a faixa **Incoming call** acima da caixa de mensagem. A faixa traz o botão **Decline call** e o botão **Answer call**.

Se você estiver em outra parte do Marinara, aparece uma notificação de chamada recebida, parecida com a notificação de mensagem autônoma de personagem. Toca um sinal curto de chamada. Marinara nunca atende por você, então é preciso clicar em **Answer call**.

Só entram na chamada os personagens disponíveis no momento. Se uma agenda ou um status marca o personagem como offline, ele não entra na chamada, mesmo fazendo parte do chat.

### Encerrar uma chamada

Você pode encerrar a chamada a qualquer momento com o botão vermelho **End call**. Ele fica na tela da chamada e também na janela flutuante minimizada. Um personagem também pode sair ou encerrar a chamada por um comando interno.

Quando a chamada termina, Marinara para a gravação, fecha a mídia com segurança e acrescenta um card ao Conversation normal.

## A tela de chamada e os controles

O palco da chamada mostra um bloco por participante, incluindo a persona e cada personagem disponível. Quem está falando fica destacado.

O chat da chamada guarda as mensagens digitadas e as respostas de personagens que só usam texto. No computador ele fica em um painel lateral. No celular, fica escondido atrás do botão **Open call chat**. O chat abre como um painel lateral inteiro, e você o fecha com **Close call chat**. As falas viram áudio, mas não se repetem como balões de chat separados.

O compositor da chamada tem a caixa **Message in call** e o botão **Send**. Tem também um seletor de emoji, GIF e figurinha, além de um seletor rápido de conexão. Anexar arquivos ao chat da chamada ainda não é possível.

A barra de controles na parte de baixo do palco tem botões de ícone:

- Microfone: liga ou desliga o mudo. A dica muda conforme o modo de entrada, por exemplo **Unmute microphone with Local Whisper**.
- **Turn camera on** e **Turn camera off**: só ficam ativos no modo **Provider-native audio/video** com **Camera and screen input** ligado.
- **Share screen** e **Stop sharing screen**: mesma regra da câmera.
- **Character volume**: abre um balão com um botão de mudo e um controle deslizante de volume de 0 a 100. O padrão é 100 por cento, e a escolha fica salva no navegador.
- **Soundboard**: abre uma lista de sons com um controle **Upload**.
- **End call**: o botão vermelho de desligar.

Se você ficar muito tempo no mudo, aparece um lembrete: "You are muted! Remember to unmute yourself first if you want to talk."

Se você sair do Conversation com uma chamada ativa, ela encolhe em uma pequena janela flutuante. Essa janela mostra o nome do chat, o tempo decorrido e um botão vermelho **End call**. Clique no corpo da janela flutuante para voltar à tela cheia da chamada. Marinara mantém a chamada rodando enquanto você navega por outros painéis.

### Soundboard

O soundboard é uma pequena biblioteca de sons que você pode tocar em qualquer chamada. Quatro sons já vêm incluídos: **Soft Chime**, **Tap**, **Sparkle** e **Pop**. Os sons embutidos não podem ser excluídos.

Você pode fazer upload dos seus próprios sons com o botão **Upload**. Os formatos aceitos são mp3, wav, ogg, webm e m4a, com até 8 MB cada. Os sons enviados por você têm um controle de exclusão. Os personagens também podem tocar um som pelo comando do soundboard.

## Character Video Presence e clipes de vídeo da chamada

A opção **Character Video Presence** troca o bloco do avatar parado por um clipe de vídeo em loop do personagem, gerado por IA. Vem desativada por padrão. O botão liga/desliga é o **Character video presence**, em **Chat Settings**, depois **Agents**, depois **Calls**.

Para preparar os clipes de vídeo da chamada:

1. Crie uma conexão de Video Generation em **Settings** (Configurações), depois **Connections**.
2. Marque uma conexão como **Default for Videos** ou escolha uma conexão de vídeo a cada geração.
3. Abra o editor de um personagem ou de uma persona.
4. Abra a aba **Sprites** e depois a sub-aba **Clips**.
5. Use **Generate Clips** ou **Upload extra** para acrescentar os clipes que quiser.

Para saber mais sobre sprites e sobre o editor, veja [Sprites de Personagem (Expressões e Corpo Inteiro)](../characters/sprites.md).

O botão **Generate Clips** abre a janela **Generate Call Clips**. Ali você escolhe uma **Video Generation Connection** e escolhe **Use avatar as reference**. Depois seleciona quais clipes padrão serão feitos. Também é possível definir um clipe personalizado, com um **Clip name** e a descrição de uma ação.

Os seis tipos de clipe padrão são **Idle**, **Talking**, **Laughing**, **Angry**, **Crying** e **Sighing**. Durante uma fala, Marinara lê as deixas de voz da linha, como `[sighs]` ou `[laughs]`. Escolhe o clipe de reação correspondente e depois devolve o personagem ao Idle.

Com **Character video presence** ativado, aparecem mais dois botões liga/desliga abaixo dele:

- **Automatic video clips generation**: desativado por padrão. Quando ativado, Marinara gera sozinha apenas os dois clipes básicos, **Idle** e **Talking**, para o participante da chamada que precisar deles. Clipes de reação e clipes personalizados nunca são gerados automaticamente. Esses você cria à mão, pela sub-aba **Clips**.
- **Custom clips**: desativado por padrão. Quando ativado, o personagem pode, raramente, pedir um clipe avulso durante a chamada ao vivo, e depois reexibir um clipe personalizado já pronto. Isso serve para pedidos visuais especiais, não para cada humor ou cada fala.

A falta de clipes nunca impede uma chamada. O personagem apenas aparece com o avatar parado até um clipe ficar pronto. Se você cortar um clipe, ele entra em loop dentro do trecho definido.

Ao desativar **Character video presence**, também são desativados **Automatic video clips generation** e **Custom clips**.

Os clipes de vídeo da chamada não são a mesma coisa que os **Videos** da galeria. Os Videos da galeria guardam vídeos de cena dos chats de Roleplay, Game ou Conversation. A sub-aba **Clips** guarda os loops de presença reutilizáveis descritos aqui.

## Comandos ocultos dentro da chamada

Na chamada, os personagens usam os mesmos comandos ocultos entre colchetes que usam nas mensagens normais do Conversation. Cada comando precisa do botão liga/desliga correspondente em **Chat Settings → Agents**, e o botão geral **Commands** dessa seção precisa estar ativado. Esses comandos rodam em silêncio: nunca são falados nem exibidos como texto.

- **Selfies**: o personagem gera e envia uma foto no chat da chamada. Isso exige uma **Selfie Connection** definida para o chat. Veja [Selfies](selfies.md).
- **Memories**: o personagem salva uma lembrança sobre outro personagem com base na chamada.
- **Music**: o personagem toca uma música pelo Music Player, se houver uma fonte de música conectada.
- **Haptics**: o personagem controla um dispositivo háptico conectado durante momentos íntimos, se houver um dispositivo conectado.
- **Reactions**: o personagem reage com um emoji à sua última mensagem digitada na chamada.
- **Cross-Post**: o personagem leva o assunto atual para outro chat de Conversation compartilhado.
- **Schedule Updates**: o personagem muda o próprio status – online, ausente, não perturbe ou offline – e a atividade por um tempo, depois volta à agenda. Veja [Agendas de Personagem e Mensagens Autônomas](schedules.md#characters-can-change-their-own-status).
- **Notes** e **Influence**: salvam uma nota duradoura ou um empurrãozinho único, e só aparecem quando o chat tem um chat conectado configurado.
- **Soundboard**: o personagem toca um dos sons do soundboard da chamada.
- Sair e encerrar: o personagem pode sair sozinho da chamada ou encerrar a chamada para todo mundo.

Alguns comandos acrescentam uma pequena entrada de sistema ao chat da chamada. Uma selfie, por exemplo, mostra a entrada "sent a selfie" com a imagem, e um clipe personalizado mostra um espaço reservado enquanto o clipe é renderizado.

## O resumo do fim da chamada

Quando a chamada termina, Marinara acrescenta um card à transcrição normal do Conversation. O card mostra o status da chamada. Você pode ver estes títulos:

- **Call Started**
- **Incoming Call**
- **Call Ended**, com a duração da chamada
- **Call Declined**
- **Missed Call**

Depois de um card **Call Ended**, Marinara gera em segundo plano um resumo curto da chamada de áudio, se algo relevante tiver acontecido. Em seguida, acrescenta esse resumo ao Conversation como contexto oculto, que o modelo pode ler. Assim o modelo fica a par do que foi dito, sem que a chamada inteira seja copiada para o chat visível.

A transcrição detalhada da chamada fica em um armazenamento separado. Só o resumo curto volta para o chat normal.

## Solução de problemas

### O início da chamada falha e diz que o áudio não está ativado

Se você clicar em **Start call** e vir "Conversation call audio is not enabled in Chat Settings", ative o **Call Audio Pipeline**. Abra **Chat Settings**, depois **Agents**, depois **Calls**, e ative a opção. Ela é obrigatória em toda chamada, mesmo naquelas em que você só digita. Como é global, ativá-la em um chat ativa em todas as chamadas de Conversation.

### Eu ouço os personagens, mas eles não me ouvem

Abra **Chat Settings**, depois **Agents**, depois **Calls**, e confirme que **Call Audio Pipeline** está ativado. Depois confirme que o navegador deu à página do Marinara permissão para usar o microfone.

Se você usa Firefox, ou se o reconhecimento de fala do navegador não funciona, instale Calls e baixe o Local Whisper. Abra **Connections**, depois **Local Model**, depois **Local Speech Model**. Em seguida escolha **Mic recording + Local Whisper**.

### O Local Whisper aparece como indisponível

O Local Whisper precisa do runtime nativo ONNX da sua plataforma. ONNX é o motor que roda o modelo de fala local. Se o modelo foi preparado para outra build do Node, reinstale as dependências com a mesma build do Node que você usa para rodar Marinara e reinicie.

Se você roda uma build "Lite" do Marinara, o Local Whisper está desativado nela. O aplicativo mostra: "Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model." Use uma instalação completa para ter o Local Whisper.

### A opção de fala do navegador não faz nada

O reconhecimento de fala do navegador depende do suporte de cada navegador. O Firefox não oferece o mesmo reconhecimento Web Speech dos navegadores Chromium e do Safari. Use **Mic recording + Local Whisper** para capturar sem as mãos, ou use **Manual system dictation** para digitar com o ditado do sistema operacional.

### Um personagem só digita, em vez de falar

Verifique as configurações de Text to Speech e a atribuição de vozes. O personagem precisa da voz global única ou de uma voz própria que o provedor de TTS consiga resolver. Veja [Configuração de Text to Speech (TTS)](../media/tts-setup.md).

### O modelo entende minha fala errado

Experimente o **Whisper Base (Multilingual)** no lugar do Whisper Tiny, para mais precisão. Reduza o ruído de fundo e a música. Se o modelo aceitar, mude o **Audio input mode** para **Provider-native audio/video**, para que o modelo ouça o áudio diretamente. Para um idioma com que o Whisper lida mal, [use seu próprio servidor de conversão de fala em texto](#use-your-own-speech-to-text-server) com um modelo que conheça esse idioma e defina o código dele em **Language**.

### O teste do Speech to Text falha

Leia a mensagem abaixo do botão **Test**. "Could not reach the speech-to-text server" significa que o endereço está errado ou que o servidor não está rodando. Uma mensagem que cita `STT_LOCAL_URLS_ENABLED` significa que o servidor está em outra máquina da sua rede; defina essa variável como `true` no `.env`. Um número como 401 ou 404 vem do seu servidor: 401 costuma indicar uma chave de API errada, e 404, um endereço ou um nome de modelo errado.

### O botão de câmera ou de tela está desativado

Esses botões só funcionam no modo **Provider-native audio/video** com **Camera and screen input** ativado. Mude o **Audio input mode**, ative **Camera and screen input** e tente de novo. Além disso, eles só ajudam quando o modelo realmente consegue usar a entrada de câmera ou de tela.

### A chamada não funciona no meu celular

No celular, o chat da chamada abre pelo botão **Open call chat** e fecha com **Close call chat**. Se um personagem não fala, confirme que o Text to Speech está configurado. Para problemas de microfone no celular, valem os mesmos passos de Local Whisper e de permissão descritos acima.

### Um personagem parou de responder no meio da chamada

Os personagens respondem apenas enquanto a conexão de modelo escolhida para o chat estiver funcionando. Se as respostas pararem, verifique essa conexão e tente enviar outra mensagem no chat da chamada.

## Guias relacionados

- [Configuração de Text to Speech (TTS)](../media/tts-setup.md)
- [Como configurar o Local Model](../connections/local-model.md)
- [Sprites de Personagem (Expressões e Corpo Inteiro)](../characters/sprites.md)
- [Conversation Mode: primeiros passos](getting-started.md)
