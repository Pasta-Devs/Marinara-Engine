# Chamadas de áudio e vídeo no Conversation

Uma chamada é uma tela ao vivo, como em um aplicativo de bate-papo por voz, em que você fala com um ou mais personagens pelo microfone ou digitando. Ela fica sobre o chat normal de Conversation enquanto está em andamento. As chamadas existem só no Conversation Mode.

Calls é um pacote opcional. Instale **Calls** em **Agents → Agent Organizer**. Se o catálogo pedir para reiniciar, pare o Marinara e inicie-o de novo do jeito que você costuma iniciá-lo (veja [Instalação](../INSTALLATION.md)).

Durante uma chamada, os personagens com uma voz de Text to Speech (TTS, texto transformado em áudio falado) que funciona falam em voz alta. Os personagens sem voz respondem com mensagens digitadas no chat da chamada. Você também pode mostrar clipes de vídeo em loop, feitos por IA, de um personagem no lugar de um avatar parado.

O Marinara grava o seu microfone ou a sua câmera no seu navegador. Dependendo do modo de entrada (abaixo), a sua fala é transformada em texto no seu próprio computador ou enviada ao modelo que você escolheu para o chat. As respostas são faladas pelo seu serviço de TTS. Quando a chamada termina, um resumo curto volta para a Conversation. A transcrição completa fica em um armazenamento de chamadas separado.

## O que você precisa

- **Calls** instalado.
- Um chat de Conversation com pelo menos um personagem e uma conta para o modelo que escreve as respostas.
- **Audio/Video Calls** e **Call Audio Pipeline** ativados nas configurações do chat.
- Opcional: uma conta de Text to Speech, para os personagens falarem. Sem ela, eles respondem em texto.
- Opcional: o modo de microfone padrão precisa de um download único do Local Whisper (veja [Baixe o Local Whisper](#download-local-whisper)). Você pode, em vez disso, digitar no chat da chamada.

## Configure a sua primeira chamada

Antes de começar: você precisa de um chat de Conversation com pelo menos um personagem e de uma conta para o modelo que escreve as respostas (veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)).

1. Opcional: configure o Text to Speech (veja [Configure o Text to Speech](#set-up-text-to-speech)). Sem ele, todo personagem entra só em texto.
2. Abra o chat e depois abra **Chat Settings → Agents → Calls**.
3. Ative **Audio/Video Calls**. Um botão de chamada aparece ao lado do nome da conversa.
4. Ative **Call Audio Pipeline**. Nenhuma chamada pode começar sem ele, mesmo que você só digite ou só ouça. Ele também habilita o microfone.
5. Escolha um **Audio input mode** (abaixo).
6. Clique em **Start call**.

Se não funcionou: quando você vê "Conversation call audio is not enabled in Chat Settings", **Call Audio Pipeline** está desativado. Ele é uma configuração global, então ativá-lo em um chat o ativa para todas as chamadas de Conversation.

Em um chat novo, termine primeiro o assistente de configuração e depois abra o **Chat Settings** desse chat. As configurações de Calls só aparecem quando o Calls está instalado.

Duas chaves parecem iguais, mas fazem coisas diferentes:

- **Audio/Video Calls** mostra o botão de chamada, para você poder ligar para um personagem.
- O comando **Calls** deixa os personagens ligarem para você primeiro. Com ele desativado, você ainda pode iniciar chamadas você mesmo.

A chave geral **Commands** na mesma seção precisa estar ativada para os comandos durante a chamada. A chamada em si pode começar com ela desativada.

<a id="set-up-text-to-speech"></a>

### Configure o Text to Speech

O Text to Speech decide quais personagens podem falar e com qual voz. Leia [Configuração do Text to Speech (TTS)](../media/tts-setup.md) para o passo a passo completo. Em resumo, abra **Connections**, clique em **Add account** e escolha **Text to speech**. Se ele já está listado em **On this device**, abra-o ali. Depois:

1. Ative o Text to Speech.
2. Escolha uma fonte: **OpenAI-compatible**, **ElevenLabs**, **PocketTTS** ou **xAI Voice**.
3. Digite a chave de API ou o endereço do servidor local dessa fonte.
4. Escolha um modelo e uma voz.
5. Defina **Voice option** como **One voice for all** ou **Selected per character or persona**. Vozes por personagem deixam as chamadas em grupo mais fáceis de acompanhar.
6. Salve e depois use o botão de prévia para confirmar que você ouve áudio.

Se um personagem não tem uma voz que o Marinara consiga resolver, esse personagem fica só em texto na chamada.

### Escolha um Audio input mode

Quando **Call Audio Pipeline** está ativado, a lista **Audio input mode** aparece. Se você não tem certeza, mantenha o padrão.

| Modo | O que ele faz |
| --- | --- |
| **Mic recording + Local Whisper** (padrão) | Grava enquanto você está com o som ligado, ignora o silêncio e transforma a sua fala em texto no seu próprio computador. O melhor para o Firefox. |
| **Browser speech recognition** | Usa a ferramenta de fala embutida no seu navegador. O suporte varia. O Marinara volta para o Local Whisper quando ela falta. |
| **Manual system dictation** | Só coloca o cursor na caixa de texto da chamada, para o ditado do seu sistema operacional digitar ali. O Marinara não grava. |
| **Provider-native audio/video** | Envia o seu áudio ou vídeo gravado direto ao modelo, se o modelo aceita mídia. |

Os botões de câmera e de tela precisam de **Camera and screen input** ativado e funcionam só no modo **Provider-native audio/video**. Nos outros modos, eles aparecem, mas ficam desativados.

## Inicie, atenda e encerre uma chamada

**Inicie uma chamada.** Com as chamadas ativadas, um botão de telefone fica ao lado do nome da conversa. A dica dele é **Start call**, ou **Open call** quando uma chamada está em andamento. Clique nele e a tela da chamada se abre. Só uma chamada pode estar ativa ou tocando por chat. Iniciar outra reabre a atual.

**Atenda uma chamada.** Um personagem pode ligar para você quando o comando **Calls** está ativado. Nesse chat, um banner **Incoming call** aparece acima da caixa de mensagem, com **Decline call** e **Answer call**. Em outras partes do Marinara, você recebe uma notificação de chamada recebida e um toque curto. O Marinara nunca atende por você. Só entram os personagens que estão disponíveis: um personagem cuja agenda ou status está offline não entra.

**Encerre uma chamada.** Clique no botão vermelho **End call** na tela da chamada ou na janela flutuante minimizada. Um personagem também pode sair da chamada ou encerrá-la com um comando durante a chamada. O Marinara então para de gravar e adiciona um cartão à Conversation.

## A tela da chamada

O palco mostra um bloco por participante, a sua persona e cada personagem disponível, e destaca quem está falando. O chat da chamada guarda as mensagens digitadas e as respostas só em texto. As falas não se repetem ali. No computador, ele é um painel lateral. No celular, ele se abre como uma gaveta com **Open call chat** e se fecha com **Close call chat**.

O campo de escrita da chamada tem uma caixa **Message in call**, **Send**, um seletor de emojis, GIFs e stickers e um seletor rápido de modelo. Anexos de arquivo não são aceitos no chat da chamada.

| Controle | O que ele faz |
| --- | --- |
| Microfone | Silencia ou liga o som para você. A dica muda com o modo, por exemplo **Unmute microphone with Local Whisper**. |
| **Turn camera on** / **Turn camera off** | Só no modo Provider-native audio/video com **Camera and screen input** ativado. |
| **Share screen** / **Stop sharing screen** | A mesma regra da câmera. |
| **Character volume** | Um botão de silenciar e um controle deslizante de 0 a 100. Padrão 100, salvo no navegador. |
| **Soundboard** | Uma lista de sons com um controle **Upload**. |
| **End call** | O botão vermelho de desligar. |

Se você fica um tempo silenciado, aparece "You are muted! Remember to unmute yourself first if you want to talk."

Se você sai da Conversation durante uma chamada, ela encolhe em uma janela flutuante com o nome do chat, o tempo decorrido e **End call**. Clique na janela para voltar. A chamada continua enquanto você navega.

### Soundboard

O soundboard tem quatro sons embutidos que você não pode excluir: **Soft Chime**, **Tap**, **Sparkle** e **Pop**. Clique em **Upload** para adicionar os seus (mp3, wav, ogg, webm ou m4a, de até 8 MB cada). Você pode excluir os seus próprios envios. Os personagens podem tocar um som com o comando do soundboard.

## Character Video Presence

Esta parte é opcional e avançada. **Character video presence** troca um bloco de avatar parado por um clipe em loop do personagem, feito por IA. Ela vem desativada. A chave fica em **Chat Settings → Agents → Calls**.

Antes de começar: adicione uma conta de Video Generation em **Connections** e marque uma como **Default for Videos**, ou escolha uma a cada vez.

1. Abra o editor de um personagem ou de uma persona.
2. Abra a aba **Sprites** e depois a subaba **Clips**.
3. Clique em **Generate Clips**, ou em **Upload extra** para adicionar os seus.
4. Na janela **Generate Call Clips**, escolha uma **Video Generation Connection** e marque **Use avatar as reference**.
5. Escolha os clipes padrão a criar: **Idle**, **Talking**, **Laughing**, **Angry**, **Crying**, **Sighing**. Você também pode definir um clipe personalizado, com um **Clip name** e uma descrição da ação.

Durante um turno falado, o Marinara lê as indicações de voz em uma linha, como `[sighs]`, escolhe um clipe de reação correspondente e depois volta para Idle. Um clipe ausente nunca bloqueia uma chamada: o personagem mostra um avatar parado. Um clipe cortado fica em loop dentro do intervalo cortado. Veja [Sprites de personagem (expressões e corpo inteiro)](../characters/sprites.md).

Mais duas chaves aparecem em **Character video presence** quando ela está ativada:

- **Automatic video clips generation** (desativada por padrão) cria só **Idle** e **Talking** para um participante que precisa deles. Os clipes de reação e os personalizados nunca são criados automaticamente.
- **Custom clips** (desativada por padrão) deixa um personagem pedir raramente um clipe avulso em uma chamada ao vivo e reproduzir um clipe personalizado já pronto. Ela serve para pedidos especiais, não para todo humor.

Desativar **Character video presence** também desativa as duas. Os clipes aqui são loops de presença reutilizáveis, não os **Videos** da Gallery, que guardam vídeos de cena.

## Configuração de speech-to-text (avançado)

Necessária só para o modo **Mic recording + Local Whisper**, ou se você quer o seu próprio servidor de speech-to-text.

<a id="download-local-whisper"></a>

### Baixe o Local Whisper

O Local Whisper transforma a sua fala em texto no computador que executa o Marinara, então o áudio do seu microfone não sai dele para a transcrição. O texto ainda é enviado ao seu modelo como parte da chamada. É o caminho de microfone mais confiável para navegadores com suporte fraco a fala, como o Firefox.

Antes de começar: instale o Calls. A seção fica escondida sem ele.

1. Abra **Connections** e encontre **Speech to text** em **On this device**. Se ele não está listado, clique em **Add account** e escolha **Speech to text**.
2. Encontre **Local speech model** nessa página.
3. Escolha um modelo:
   - **Whisper Tiny (Multilingual)**: cerca de 180 MB para baixar e 350 MB de memória. O melhor para celulares e computadores mais antigos.
   - **Whisper Base (Multilingual)**: cerca de 320 MB para baixar e 650 MB de memória. Melhor com fala confusa.
4. Clique em **Download Whisper** e espere a barra de progresso.
5. Reinicie o Marinara por completo antes de usar o Calls.

Um ícone de lixeira, **Delete Local Whisper**, remove o modelo. Desinstalar o Calls também exclui os modelos Whisper baixados. Reinstalar não baixa um de novo até você escolhê-lo.

Se não funcionou: em uma versão Lite do Marinara, você vê "Local Whisper is disabled in Lite mode. Use a full Marinara install to download and run the local speech model." Se você vê uma mensagem sobre o "native ONNX runtime", falta o mecanismo de fala para a sua plataforma. Reinstale as dependências com a mesma versão do Node com que você executa o Marinara e depois reinicie.

<a id="use-your-own-speech-to-text-server"></a>

### Use o seu próprio servidor de speech-to-text

Se o Local Whisper tem dificuldade com o seu idioma ou sotaque, envie a sua voz a outro servidor de speech-to-text. Qualquer servidor que aceite o formato de speech-to-text da OpenAI (o endereço `/audio/transcriptions`) funciona, seja um que você mesmo executa ou um serviço como OpenAI ou Groq.

1. Abra **Connections** e abra **Speech to text** em **On this device**. Se ele não está listado, clique em **Add account** e escolha **Speech to text**. Ele fica escondido enquanto o Calls não está instalado.
2. Digite a **Server URL**, por exemplo `http://localhost:8000/v1`.
3. Digite uma **API key** se o servidor precisar de uma. Ela é salva criptografada e mostrada mascarada.
4. Digite o nome do **Model** que o seu servidor usa. Deixe vazio para enviar `whisper-1`.
5. Opcional: digite um código de **Language**, como `pl` ou `de`. Deixe vazio para o servidor detectar.
6. Clique em **Test**. O Marinara envia um clipe silencioso de um segundo. Você vê "The server answered." ou "The test failed."
7. Ative **Use your own speech-to-text server**.

Enquanto ele está ativado, **Mic recording + Local Whisper** envia a sua fala a este servidor, e você não precisa baixar o Local Whisper. O seu áudio vai para esse servidor, então use um em que você confie.

Um servidor no mesmo computador funciona sem mais nada. Um servidor em outro computador da sua rede é recusado, a menos que você defina `STT_LOCAL_URLS_ENABLED=true` no `.env` (veja a [Referência de configuração do servidor](../CONFIGURATION.md)).

Se não funcionou: leia a mensagem abaixo de **Test**. "Could not reach the speech-to-text server" significa que o endereço está errado ou o servidor está desligado. Uma mensagem que cita `STT_LOCAL_URLS_ENABLED` significa que o servidor está em outro computador. Um número vem do seu servidor: 401 normalmente significa uma chave de API errada, 404 um endereço ou nome de modelo errado. Se as chamadas ainda usam o Local Whisper, atualize o Calls em **Agents → Agent Organizer**.

## Configurações e padrões

As configurações **Per chat** valem para um chat. As configurações **Global** valem para toda chamada de Conversation.

| Configuração | Escopo | Padrão |
| --- | --- | --- |
| **Audio/Video Calls** | Por chat | Desativada |
| **Calls** (comando) | Por chat | Ativada |
| **Generate voice cues in [tags]** | Por chat | Ativada |
| **Call Audio Pipeline** | Global | Desativada |
| **Audio input mode** | Global | Mic recording + Local Whisper |
| **Camera and screen input** | Global | Desativada |
| **Character video presence** | Global | Desativada |
| **Automatic video clips generation** | Global | Desativada |
| **Custom clips** | Global | Desativada |

Uma configuração global mudada em um chat muda para toda chamada de Conversation. **Generate voice cues in [tags]** pede ao modelo que adicione indicações curtas, como `[whispering]`, `[laughing]` ou `[sighs]`, dentro das falas. Elas moldam como o TTS lê a linha e ajudam a escolher os clipes de reação. Desative para manter as falas simples.

## Commands em uma chamada

Os personagens usam em uma chamada os mesmos comandos ocultos que usam em mensagens normais. Cada um precisa da sua chave em **Chat Settings → Agents → Commands** e da chave geral **Commands** ativada. Veja [Escolha quais Commands um personagem pode usar](getting-started.md#choose-which-commands-a-character-can-use). Eles rodam em silêncio e nunca são falados.

Dois extras funcionam em uma chamada: **Soundboard** (um personagem toca um som do soundboard) e sair ou encerrar (um personagem sai da chamada, ou a encerra para todos). **Notes** e **Influence** aparecem só quando o chat tem um chat conectado (veja [Chats conectados](../chats/connected-chats.md)). Uma selfie precisa de um **Selfie model** (veja [Selfies](selfies.md)). Alguns comandos adicionam uma pequena entrada ao chat da chamada, como "sent a selfie" com a imagem.

## O resumo de fim de chamada

Quando uma chamada termina, um cartão aparece na Conversation. O título dele é **Call Started**, **Incoming Call**, **Call Ended** (com a duração), **Call Declined** ou **Missed Call**. Depois de **Call Ended**, se algo relevante aconteceu, o Marinara escreve um resumo curto em segundo plano e o adiciona como contexto oculto que o modelo pode ler. Isso mantém o modelo ciente da chamada sem copiá-la para o chat visível.

## Solução de problemas

| Sintoma | Solução |
| --- | --- |
| Os personagens não conseguem me ouvir | Confirme que **Call Audio Pipeline** está ativado e que o seu navegador permite o microfone para a página do Marinara. No Firefox, ou se a fala do navegador não funciona, baixe o Local Whisper e use **Mic recording + Local Whisper**. |
| A opção de fala do navegador não faz nada | O Firefox não tem o reconhecimento Web Speech que os navegadores Chromium e Safari têm. Use **Mic recording + Local Whisper**, ou **Manual system dictation**. |
| Um personagem digita em vez de falar | Confira as suas configurações de Text to Speech e as atribuições de voz. Veja [Configuração do Text to Speech (TTS)](../media/tts-setup.md). |
| O modelo entende mal a minha fala | Tente **Whisper Base (Multilingual)**, reduza o ruído, ou use **Provider-native audio/video** se o seu modelo aceita. Para um idioma que o Whisper trata mal, [use o seu próprio servidor de speech-to-text](#use-your-own-speech-to-text-server) e defina o **Language** dele. |
| O botão de câmera ou de tela está desativado | Use o modo **Provider-native audio/video** e ative **Camera and screen input**. O seu modelo também precisa aceitar entrada de câmera ou de tela. |
| Um personagem para de responder no meio da chamada | Confira a conta de modelo do chat e depois envie uma mensagem no chat da chamada de novo. |
| A chamada não funciona no meu celular | O chat da chamada se abre com **Open call chat**. Para a fala, confirme que o TTS está configurado. Para o microfone, valem os mesmos passos do Local Whisper e de permissão. |

## Guias relacionados

- [Configuração do Text to Speech (TTS)](../media/tts-setup.md)
- [Configuração do modelo embutido](../connections/local-model.md)
- [Sprites de personagem (expressões e corpo inteiro)](../characters/sprites.md)
- [Conversation Mode: primeiros passos](getting-started.md)
