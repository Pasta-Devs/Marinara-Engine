# Configuração de Text to Speech (TTS)

Neste guia você aprende a configurar Text to Speech no Marinara Engine para que o aplicativo leia mensagens e narração de jogo em voz alta. Text to Speech (TTS) é a conversão de texto em voz: o texto escrito no chat vira áudio falado. Aqui você vê como escolher um provedor de voz, definir as vozes, ativar a leitura automática e usar os controles de reprodução de cada mensagem.

## Onde ficam as configurações de TTS

Quase toda configuração de TTS fica em um lugar só. Abra o painel **Connections** (Conexões) e procure o card **Text to Speech**. Esse card vem fechado por padrão, então clique no cabeçalho dele para expandir.

O aplicativo envia as requisições de TTS pelo próprio servidor. Marinara criptografa a chave de API do provedor antes de salvar no servidor. Uma chave de API é um código secreto do provedor que comprova que a requisição é sua. Depois de salvar a chave, o campo mostra um valor mascarado, uma sequência de pontinhos, no lugar da chave real. A chave real nunca volta para o navegador.

Ativar o TTS não faz nada falar sozinho. Isso só revela o botão **Speak** (falar) em cada mensagem e as opções de **Auto-play** (leitura automática). A escolha do que é lido e de quando isso acontece continua sendo sua.

Os mesmos ajustes de reprodução também permitem ativar **Skip text inside HTML and custom tags** (ignorar texto dentro de tags HTML e personalizadas), **Skip fenced code blocks** (ignorar blocos de código delimitados) ou **Skip text inside square brackets** (ignorar texto entre colchetes). Os blocos de código são ignorados por padrão; os outros dois filtros começam desativados. O filtro de tags remove o texto contido nelas, como um bloco oculto `<simulation>...</simulation>`, mas preserva as tags de falante usadas para escolher vozes. Esses filtros se aplicam à reprodução manual e automática, incluindo a narração Game e a identificação de falantes em Roleplay.

## Etapa 1: ative o TTS e escolha um Source

1. Abra o painel **Connections** e expanda o card **Text to Speech**.
2. Clique no botão liga/desliga no cabeçalho do card para ativar o TTS. Passe o mouse por cima dele para ver a dica: **Enable TTS** quando está desligado, **Disable TTS** quando está ligado.
3. Abra o menu suspenso **Source** (origem) e escolha o provedor.

Um **Source** é o serviço que produz o áudio. São quatro opções:

- **OpenAI-compatible**: OpenAI, ou qualquer servidor que copie o formato de TTS da OpenAI.
- **ElevenLabs**: o serviço de voz da ElevenLabs.
- **PocketTTS**: um servidor de voz gratuito que roda no seu próprio computador.
- **xAI Voice**: o serviço de voz da xAI.

O Source padrão é **OpenAI-compatible**. Marinara guarda um perfil separado para cada Source, com a chave de API criptografada, o endereço, o modelo, as vozes e os parâmetros do provedor. Ao trocar de Source, a configuração anterior daquele Source volta; um Source ainda não configurado começa com os valores padrão.

## Etapa 2: preencha Base URL, API Key e Model

Cada Source precisa de um endereço na web e, na maioria dos casos, de uma chave de API.

1. Confira o campo **Base URL** (endereço base). Cada Source já vem com um valor padrão sensato, listado na tabela abaixo. Só mude esse valor se você usa um proxy ou um servidor próprio.
2. Cole a chave do provedor no campo **API Key** (chave de API). Para manter a chave que já está salva, deixe os pontinhos mascarados como estão. Para remover uma chave salva, limpe o campo.
3. Confira o campo **Model** (modelo). Cada Source já traz um modelo padrão. Você pode digitar o nome de outro modelo compatível com o provedor.

O aplicativo preenche estes valores padrão em cada Source:

| Source            | Base URL padrão           | Modelo padrão          | Voz que o aplicativo já preenche |
| ----------------- | ------------------------- | ---------------------- | ------------------------------- |
| OpenAI-compatible | https://api.openai.com/v1 | tts-1                  | alloy                           |
| ElevenLabs        | https://api.elevenlabs.io | eleven_multilingual_v2 | nenhuma (você precisa escolher) |
| PocketTTS         | http://localhost:49112    | pocket-tts             | alba                            |
| xAI Voice         | https://api.x.ai/v1       | grok-tts               | eve                             |

No caso do **ElevenLabs**, o campo **Model** carrega os modelos de fala disponíveis na sua conexão e mantém a lista inteira visível sempre que você abre o campo. Escolha um modelo de fala comum. Os modelos cujo ID contém `ttv` servem para desenhar vozes, não para falar, e não conseguem ler texto em voz alta. Se você escolher um deles por engano, a reprodução falha com um erro pedindo que você use um modelo de fala.

### PocketTTS é um programa separado

PocketTTS não faz parte do Marinara Engine. O adaptador do Marinara usa o [servidor PocketTTS compatível com a OpenAI](https://github.com/teddybear082/pocket-tts-openai_streaming_server), que expõe tanto o endpoint de fala quanto o de lista de vozes que Marinara precisa. Instale e execute esse servidor seguindo as instruções dele; Marinara não baixa nem gerencia esse programa para você.

Esse servidor compatível usa `http://localhost:49112` por padrão. Deixe o campo **Base URL** com esse valor, a não ser que você tenha mudado a porta do servidor. Endereços personalizados de PocketTTS que já existiam continuam como estão.

## Etapa 3: escolha uma voz (Voice Option)

A configuração **Voice Option** (opção de voz) define como as vozes são distribuídas:

- **One voice for all characters**: todo mundo fala com a mesma voz. Esta é a opção padrão.
- **Selected per character**: você dá vozes próprias aos personagens que escolher.

### Uma voz para todos os personagens

Escolha a voz no campo **All Characters Voice**. No PocketTTS, o menu suspenso mostra as vozes que o servidor retorna e, ao lado, fica um campo de texto para um ID, endereço ou caminho de voz personalizado.

Para carregar a lista real de vozes do provedor, preencha os dados da conexão e clique no botão **Refresh voices** (o ícone de seta circular). Isso funciona mesmo antes de você liberar a reprodução. A atualização salva o card primeiro, então uma chave de API recém-digitada já é usada na hora. Antes da conexão, o aplicativo mostra uma lista curta embutida para o campo não ficar vazio. Se o provedor retornar erro, o erro aparece: essa lista de reserva nunca é apresentada como se fosse uma atualização bem-sucedida.

No **ElevenLabs**, escolher uma voz é obrigatório. Marinara carrega a biblioteca da conta em páginas, incluindo as vozes pessoais, as do espaço de trabalho, as salvas e as padrão. O seletor tem uma caixa de busca e uma barra de rolagem sempre visível quando a biblioteca é maior que o painel. Ele também informa quantas vozes foram carregadas. O seletor começa em "Select an ElevenLabs voice", e a reprodução fica bloqueada até você escolher uma voz de verdade.

### Vozes por personagem

1. Coloque a configuração **Voice Option** em **Selected per character**.
2. A tabela **Character Voices** aparece, com as colunas **Character** e **Voice**.
3. Clique em **Add character voice** para adicionar uma linha.
4. Escolha um personagem no menu suspenso da esquerda e uma voz no da direita.
5. Repita para cada personagem que deve ganhar uma voz própria.

O botão **Refresh** dentro da caixa Character Voices recarrega a mesma biblioteca do provedor sem que você precise voltar para o modo de voz única. Antes disso, é preciso criar os personagens. Se você ainda não tem nenhum, o aplicativo avisa para adicionar personagens na aba Characters antes de distribuir as vozes. Os personagens sem voz própria usam a voz global. Veja [Criando e editando personagens](../characters/creating-and-editing-characters.md).

## Narrator Voice

A narração é o texto que nenhum personagem fala, como a descrição de uma cena ou as falas do mestre do jogo. Ela pode ganhar uma voz separada.

1. Na caixa **Narrator Voice** (voz do narrador), ative a opção **Use separate narrator voice**.
2. Escolha uma voz no seletor que aparece.

O aplicativo usa essa voz quando quem fala é Narrator, GM, Game Master ou System. Isso vale para as mensagens de Roleplay e de Conversation. Também vale para as linhas de narração do Game Mode que não têm um falante com nome. Se você usa ElevenLabs, escolha aqui uma voz de narrador. Se deixar o campo vazio, a narração só recorre à voz global quando existe uma voz global definida.

## Random NPC Voices (só no Game Mode)

Este recurso distribui vozes livres para os personagens secundários do jogo. Ele funciona apenas no Game Mode e apenas para os NPCs que o Game Mode acompanha. Um NPC é um personagem não jogável. No Roleplay e no Conversation, o recurso não tem efeito.

1. Na caixa **Random NPC Voices**, ative a opção **Use default voices for random NPCs**.
2. Aparecem duas grades de caixas de seleção: **Male NPC defaults** e **Female NPC defaults**.
3. Marque as vozes que cada conjunto pode usar.

Um NPC acompanhado que não tenha voz própria recebe uma escolha estável do conjunto correspondente. Esse NPC mantém a mesma voz durante toda a sessão. Um NPC com voz de personagem atribuída sempre fica com a voz atribuída. Se o aplicativo não conseguir identificar vozes marcadas como masculinas ou femininas, cada conjunto passa a usar a lista completa de vozes.

## Audio Format e Speed

A configuração **Audio Format** (formato do áudio) escolhe entre **MP3** (o padrão) e **WAV**. Use WAV em servidores locais ou próprios que não conseguem gerar MP3. Duas observações:

- O controle **Audio Format** fica oculto no ElevenLabs, que sempre usa MP3.
- O controle aparece no xAI Voice, mas não tem efeito ali. O xAI Voice sempre devolve MP3.

O controle deslizante **Speed** (velocidade) define a rapidez da fala. A faixa permitida depende do Source:

- OpenAI-compatible e PocketTTS: de 0.25 a 4.0 vezes a velocidade normal.
- ElevenLabs: de 0.7 a 1.2 vezes.
- xAI Voice: de 0.7 a 1.5 vezes.

Se a velocidade salva estiver fora da faixa do Source atual, o aplicativo ajusta o valor para o limite mais próximo na hora de falar.

Só no **ElevenLabs**, aparecem dois controles extras. O campo **Language** força um idioma de fala, ou fica em **Auto detect**. O controle **Stability** equilibra uma fala mais expressiva de um lado e mais constante do outro.

## Auto-play: ler as mensagens automaticamente

Sob o título **Auto-play**, cada botão liga/desliga manda o aplicativo ler um tipo de mensagem nova assim que ela termina de ser gerada. Todos eles dependem de **Enable TTS** estar ligado antes. Todos começam desligados.

- **Roleplay messages**: lê as novas respostas do Roleplay.
- **Conversation messages**: lê as novas respostas do Conversation Mode.
- **Game narration**: lê a narração e as linhas de combate novas do Game Mode.
- **Progressive playback**: quando a resposta tem várias linhas, começa a tocar a primeira linha na hora, em vez de esperar a resposta inteira.
- **Only read dialogues**: lê apenas as falas entre aspas ou marcadas como fala e pula a narração comum.

A leitura automática acontece uma vez só, na resposta mais recente, no momento em que ela termina. Mensagens antigas não são lidas de novo quando você reabre ou rola o chat.

## Falar uma mensagem específica

Com o TTS ligado, um botão **Speak** (um ícone de microfone) aparece na barra de ferramentas embaixo de cada mensagem de personagem ou de narrador. Ele lê aquela mensagem quando você pedir.

- Clique em **Speak** para ler a mensagem. Enquanto o áudio é buscado, o botão mostra um estado de carregamento.
- Clique de novo durante a reprodução para parar. A dica muda para **Stop speaking** enquanto a mensagem toca.
- Uma mensagem sem texto legível (só uma imagem, por exemplo) mostra **No dialogue to speak** e fica desativada.

Enquanto a mensagem é falada, surgem mais dois botões. **Pause speaking** e **Resume speaking** pausam e retomam a reprodução. **Restart speaking** recomeça a mensagem do início.

O botão com ícone de alto-falante abre o controle deslizante **Line volume**, de 0 a 100 por cento, com 50 por padrão. Esse volume é uma configuração salva à parte. Ele é independente do mixer do Game Mode e do volume da chamada no Conversation, então mexer em um não muda os outros.

## Trechos em cache

O aplicativo salva o áudio gerado no navegador para não precisar gerar a mesma linha duas vezes. O painel **Cached clips** mostra a quantidade e o tamanho total em tempo real.

Clique no botão **Export cached TTS clips** (o ícone de download) para salvar todos os trechos do cache no seu dispositivo, cada um como um arquivo de áudio. O cache descarta os trechos mais antigos sozinho. Não existe um botão de limpeza manual dentro do aplicativo: para esvaziar o cache, limpe os dados do navegador.

## O TTS em cada modo de chat

A mesma configuração de TTS serve para todos os modos, com alguns detalhes próprios de cada um:

- O Roleplay usa o botão liga/desliga **Roleplay messages** da leitura automática e os controles **Speak** de cada mensagem. Veja [Roleplay Mode: primeiros passos](../roleplay/getting-started.md).
- O Conversation Mode usa o botão **Conversation messages** e os mesmos controles **Speak**. As chamadas de áudio faladas são um recurso maior, explicado em [Chamadas de áudio e vídeo no Conversation Mode](../conversation/calls.md).
- O Game Mode usa o botão **Game narration**. O Game Mode também tem o próprio mixer de áudio, com um canal **TTS** ao lado de **Master**, **Music**, **Sound Effects** e **Ambient**. Esse canal define o volume geral do áudio falado no jogo e começa em 100 por cento. Veja [Game Mode: primeiros passos](../game/getting-started.md).

## Nome fonético (pronúncia nas chamadas)

Se o nome de um personagem ou de uma persona for escrito de um jeito que a voz pronuncia errado, use o campo **Phonetic name** (nome fonético). No **Character Editor**, ele fica ao lado do campo **Name** do personagem. No **Persona Editor**, fica junto dos outros campos de informação básica. Digite ali como o nome deve soar.

Esse ajuste vale apenas durante as chamadas de áudio e vídeo do Conversation. O botão **Speak** de cada mensagem, a leitura automática do chat e a narração do Game Mode não usam esse campo.

## Solução de problemas

- Nada é falado: confirme se o botão **Enable TTS** está ligado. Depois verifique o botão de **Auto-play** do modo certo, ou use o botão **Speak** da mensagem. O botão **Speak** e as opções de leitura automática só aparecem depois que o TTS é ativado.
- Nenhuma voz no menu suspenso: salve o card com o TTS ativado e uma chave de API válida, depois clique em **Refresh voices**. No PocketTTS, confira também se `<Base URL>/v1/voices` responde no servidor compatível.
- O ElevenLabs não fala: verifique se você escolheu uma voz de verdade, e não o texto de exemplo "Select an ElevenLabs voice". Confira também se o campo **Model** tem um modelo de fala, e não um modelo de desenho de voz com `ttv` no ID.
- Um servidor de TTS próprio em endereço local está bloqueado: ative a configuração de servidor `TTS_LOCAL_URLS_ENABLED`. Com isso, o aplicativo alcança um endereço local ou privado em servidores no formato OpenAI-compatible ou ElevenLabs. O PocketTTS não precisa dessa configuração. Veja [Referência de configuração do servidor](../CONFIGURATION.md).
- Para testar tudo rapidamente: clique no botão **Preview** dentro do card e ouça uma frase curta de amostra com as configurações atuais.

## Guias relacionados

- [Chamadas de áudio e vídeo no Conversation Mode](../conversation/calls.md)
- [Roleplay Mode: primeiros passos](../roleplay/getting-started.md)
- [Game Mode: primeiros passos](../game/getting-started.md)
- [Provedores de IA compatíveis](../connections/providers-reference.md)
- [Criando e editando personagens](../characters/creating-and-editing-characters.md)
- [Referência de configuração do servidor](../CONFIGURATION.md)
