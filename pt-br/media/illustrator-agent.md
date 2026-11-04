# Agente Illustrator

O **Illustrator** (ilustrador) é um agente para download que desenha imagens das suas cenas enquanto você conversa. Este guia mostra como ativá-lo, escolher um estilo de arte e um modelo de imagem e criar clipes. Um agente é um pequeno ajudante de IA que roda automaticamente em um chat.

## O que o Illustrator faz

O Illustrator é um agente de pós-processamento, então roda depois que a IA termina cada resposta. Ele lê a resposta mais recente e decide se o momento merece uma imagem. Se merecer, escreve um prompt de imagem (o texto que diz ao modelo de imagem o que desenhar) e o envia ao seu serviço de imagens. Toda imagem que ele cria é salva na **Gallery** (galeria) do chat.

Ele não desenha a cada mensagem. Depois de criar uma imagem, por padrão ele espera 5 mensagens aceitas do usuário e do assistente antes de poder criar outra. Cada chat de Roleplay pode mudar esse número. Dar swipe ou regenerar uma resposta não faz a contagem avançar. Se ele decidir que um momento não vale uma imagem, pula esse momento.

Ele funciona em chats de Roleplay e de Game Mode. Instalá-lo também adiciona as selfies e as [mensagens em vídeo](../conversation/selfies.md#video-messages) do Conversation. A configuração deste guia é para Roleplay. O Game Mode usa um único botão liga/desliga (veja [Game Mode](#game-mode-the-game-illustrator-toggle)).

## Antes de começar

O Illustrator escreve o prompt, mas quem desenha a imagem é um modelo de imagem separado. Você precisa de um. Veja [Provedores de geração de imagens e configuração](image-providers.md).

Há dois jeitos de dar um modelo de imagem a ele.

1. Defina a tarefa **Images** em **Defaults** (padrões), no painel **Connections** (conexões).
2. Ou dê ao Illustrator um modelo de imagem próprio na tela **Open Setup** (abrir a configuração) dele.

Se nenhum modelo de imagem for encontrado, a imagem falha e o aplicativo pede que você escolha um.

## Como ativar o Illustrator

Antes de começar: instale o **Illustrator** pelo **Agent Organizer** (organizador de agentes). Veja [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md).

1. Abra o chat de Roleplay que você quer ilustrar.
2. Abra **Chat Settings** (configurações do chat) e encontre **Agents**.
3. Ative **Enable Agents**.
4. No grupo **Misc Agents**, encontre o **Illustrator** e adicione-o com o botão de mais.

Aparece um cartão do **Illustrator** com opções próprias. Os agentes consomem tokens extras e podem acrescentar chamadas ao modelo a cada turno. As estimativas de tokens cobrem só as instruções dos agentes.

<a id="game-mode-the-game-illustrator-toggle"></a>

### Game Mode: o botão Game Illustrator

O Game Mode não tem as opções **Prompt Mode** nem **Prompt Model**. Abra o **Chat Settings** do jogo e ative **Game Illustrator** ("Auto-generate scene illustrations, NPC portraits, and location backgrounds during gameplay").

## Escolha um estilo de arte

O seletor **Prompt Mode** (que aparece como **Prompt** no cartão) define o estilo de arte de todo prompt que o Illustrator escreve. Um Illustrator novo começa em **Background**.

| Estilo | O que desenha |
|---|---|
| **Illustration** | Uma única imagem de cena bem acabada. É o estilo geral. |
| **Comic Page** | Uma página de quadrinhos com quadros, balões de fala, legendas e efeitos sonoros. |
| **Colored Manga** | Uma cena de mangá colorido, com balões estilizados e efeitos sonoros. |
| **B&W Manga** | Uma página de mangá em preto e branco, com traço a nanquim e sombreado em retícula. |
| **Background** | Um cenário ou plano de ambientação, sem personagens. |
| **Selfie** | Uma selfie feita pelo personagem ou um retrato informal. |

A aparência final também depende do seu perfil de estilo. Veja [Perfis de estilo de imagem](style-profiles.md).

## Escolha o modelo do prompt

O **Prompt Model** é o modelo de texto que escreve o prompt de imagem. Ele não desenha. Escolha-o na lista **Prompt Model** do cartão. O padrão é **Main chat model** (modelo principal do chat), que reaproveita o modelo do seu chat. Escolha outro modelo de texto se quiser que outro modelo escreva os prompts.

O modelo de imagem que desenha a imagem é o que você definiu em **Antes de começar**.

## Mantenha os personagens coerentes

Duas configurações do cartão ajudam os personagens a manter a mesma aparência de uma imagem para outra. As duas começam desativadas.

**Attach Card Appearance** (anexar aparência do card) acrescenta ao prompt de imagem o texto de aparência salvo de cada personagem visível. Em um chat de Roleplay, é uma lista com quatro opções.

- **Off** (desativado)
- **Images only** (só imagens), o comportamento habitual.
- **Videos only** (só vídeos): um clipe recebe o texto de aparência dos personagens que ele mostra. Isso importa mais em um clipe **Prompt only**, que não tem imagem.
- **Images and videos** (imagens e vídeos): as duas coisas.

Com essa opção ativada, um card ou uma persona com **Image Appearance Override** (aparência alternativa para imagens) ativado envia essa alternativa no lugar do texto de **Appearance** (aparência). Use quando **Appearance** foi escrito para o narrador, mas não funciona bem para um modelo de imagem. Mantenha a descrição completa em **Appearance** e coloque uma versão mais curta, em forma de tags, na alternativa. Com a alternativa desativada ou vazia, os prompts de imagem usam **Appearance**. O narrador sempre vê o **Appearance** completo. O botão liga/desliga fica abaixo de **Appearance** nos editores de personagem e de persona.

**Send Avatar References** (enviar avatares como referência) envia ao serviço de imagens os avatares de personagens e personas, ou os sprites deles, como imagens de referência, para que o modelo possa copiar um rosto ou uma roupa. Nem todo serviço aceita essas imagens. Em um chat de Roleplay, é uma lista como **Attach Card Appearance**. Com vídeos incluídos, um clipe cujo **First frame** (primeiro quadro) é **Prompt only** começa com o avatar ou o sprite do personagem, e a opção aparece como **Prompt only (avatar from Send Avatar References)**.

## Controle a frequência das imagens

O cartão do Illustrator tem um botão **Open Setup**, que abre a tela completa de configuração. Lá você define o intervalo de execução padrão e dá ao agente um modelo de imagem próprio.

Cada chat de Roleplay tem o próprio **Image Run Interval** (intervalo de execução de imagens) no cartão em **Chat Settings** ("Messages between automatic images in this chat. 0 means only when you ask."). Um chat sem valor definido usa o valor da tela de configuração, **5** por padrão. O cartão mostra **Using agent default** ou **Chat override**. Clique em **Use agent default** (usar o padrão do agente) para voltar. Quando você adiciona o Illustrator a um chat, a janela de adição mostra o mesmo campo e salva o valor só nesse chat.

Defina **Image Run Interval** como **0** para o modo só manual. Isso interrompe as execuções automáticas, inclusive os planos de fundo de cena automáticos, mas mantém o agente disponível para as ações da Gallery. Defina um número positivo para retomar.

Para criar uma imagem agora, abra **Chat Settings**, expanda **Gallery** e clique em **Illustrate** (ilustrar). O Illustrator roda uma vez, imediatamente, e o botão mostra **Generating...**.

## Crie clipes

Em um chat de Roleplay, **Chat Settings → Agents → Illustrator** tem a configuração **Illustrator makes** (o que o Illustrator cria).

- **Pictures** (padrão): só imagens.
- **Pictures and clips**: o Illustrator também pode transformar uma imagem nova em um clipe curto quando o movimento é o ponto central, como ação, uma perseguição ou algo quebrando. Isso inclui imagens que o narrador pede com `[illustrate]`. Ele mesmo escreve o movimento, seguindo as **Video prompting instructions** (instruções de prompt de vídeo) do modelo de vídeo. A imagem aparece primeiro, e o clipe entra na mesma mensagem quando fica pronto.
- **Clips only**: sempre que o Illustrator mostraria uma imagem, ele mostra um clipe curto. A imagem que ele desenha vira o quadro inicial do clipe e vai para a Gallery, não para a resposta. Se o clipe falhar, a imagem aparece.

Os clipes usam o modelo de vídeo de **Scene Videos** (vídeos de cena), e cada clipe é uma solicitação de vídeo. Sem um modelo de vídeo funcionando, o Illustrator cria imagens, mesmo com **Clips only**. Agentes personalizados que criam imagens seguem a mesma configuração. Veja [Geração de vídeo de cena](scene-video.md).

**Video Run Interval** (intervalo de execução de vídeos) aparece quando o Illustrator passa a criar clipes. É quantas mensagens do usuário e do assistente precisam passar depois de um clipe até o próximo, e é separado de **Image Run Interval**.

- Com **Clips only**, toda execução é um clipe, o **Video Run Interval** define a frequência com que o Illustrator roda, e o **Image Run Interval** fica oculto.
- Um chat sem valor usa o **Video Run Interval** da tela **Open Setup**, ou 5.
- **0**: nenhum clipe por conta própria, inclusive para as imagens de `[illustrate]`, que recebem a imagem no lugar.
- Uma resposta recebe no máximo **Videos per reply** clipes (**Settings → Generations → Video Generation**).
- Você ainda pode animar uma imagem pela Gallery. Com **Clips only**, o botão **Illustrate** de uma mensagem cria um clipe.
- Um swipe de uma resposta que recebeu um clipe conta como uma resposta nova e pode receber o próprio clipe. O swipe anterior mantém o clipe dele.

**First frame**, na mesma seção, define de onde parte todo clipe de Roleplay: os clipes do Illustrator, `/video` e o botão **Video** da Gallery. As opções são uma nova imagem do Illustrator, o avatar ou sprite do personagem citado, a imagem com o avatar como alternativa ou nenhuma imagem. As mensagens em vídeo do Conversation usam a mesma configuração.

- **Clips only** com o avatar ou sem imagem: nenhuma imagem é desenhada. O clipe é criado a partir da cena e do movimento escritos pelo Illustrator.
- **Pictures and clips**: a imagem continua aparecendo, e só o clipe começa com o avatar ou sem nada.
- Nenhum quadro inicial escolhido: um clipe nunca desenha uma imagem só para si. **Pictures and clips** anima a imagem que o Illustrator acabou de criar. **Clips only**, `/video` e **Video** criam o clipe só a partir da cena.

Um clipe sem imagem própria descreve todos que cita, incluindo a sua persona. O quadro inicial de avatar parte de quem for citado primeiro.

Executar o Illustrator de novo pelo botão **Illustrate** de uma mensagem também segue **Illustrator makes** e **First frame**.

## Vários personagens na NovelAI

Quando o modelo de imagem do Illustrator é a NovelAI com um modelo V4, V4.5 ou V5, o modelo que escreve o prompt acrescenta uma descrição de personagem para cada personagem visível. Cada descrição traz a aparência, a expressão, a pose e a posição aproximada daquele personagem no quadro. Marinara compara as descrições com a lista de personagens da cena, descarta as que não consegue associar e envia as demais à NovelAI como prompts nativos de personagem, junto com o prompt principal. Isso evita que cabelo, roupas e outros traços se misturem entre os personagens. As imagens de **Illustrate** e do comando `[illustrate]` de um personagem recebem as mesmas descrições.

O V5 aceita até 22 personagens. O V4 e o V4.5 aceitam até 6. Com mais personagens visíveis, os mais importantes são mantidos e os demais viram figuras de fundo sem nome.

Os traços fixos vêm do campo **Appearance**. Se ele já contém tags Danbooru, elas são copiadas como estão. Se contém prosa, o modelo que escreve o prompt a converte em tags. As roupas vêm do traje atual no tracker de personagens, quando o tracker está rodando, e também são convertidas em tags.

Com **Attach Card Appearance** ativado, esse modelo também recebe o texto completo de Appearance de cada card e persona do chat, para que cards longos ou com vários personagens não sejam cortados. Cards com vários personagens descritos no formato `[NAME] tags | [NAME] tags` são listados por personagem. O modelo copia os traços fixos para a descrição correspondente, trata as tags de roupas do card como um padrão que o tracker ou a cena substitui e ignora personagens que não estão na cena. Quando as descrições voltam, Marinara não acrescenta mais nada. Sem descrições, como no caso de um só personagem, a linha habitual de aparência é acrescentada ao prompt principal, como antes.

Não é preciso configurar nada. As descrições só aparecem com a NovelAI no próprio servidor dela, então um proxy ou outro serviço não é afetado. Com **Expose media prompts before sending** (mostrar os prompts de mídia antes de enviar) ativado, a janela de revisão lista as descrições abaixo do prompt principal, somente leitura. Edite o prompt principal como de costume.

## Salvar nas galerias e inspecionar o prompt

Em **Settings → Generations → Image Generation** (configurações → gerações → geração de imagens), **Automatically save generated images to character galleries** (salvar automaticamente imagens geradas nas galerias dos personagens) vem ativado por padrão. Desative para não adicionar mais ilustrações e selfies do chat às galerias dos personagens e personas retratados. As imagens continuam aparecendo na conversa e na Gallery do chat, e os salvamentos explícitos na galeria continuam funcionando. As entradas existentes não mudam. As galerias compartilham arquivos de imagem, então a opção controla a presença nas galerias, não a exclusão.

Nas novas ilustrações da NovelAI, o inspetor de imagens mostra o prompt de cena e estilo seguido das descrições positivas de personagem, separadas por ` | `. O prompt salvo na galeria é o mesmo.

Para desenhar uma ilustração de novo com um prompt alterado, sem gerar a resposta de novo, abra-a e use **Regenerate image** (gerar a imagem de novo). Veja [Gerar uma imagem de novo](scene-backgrounds.md#regenerating-an-image).

Para ilustrar uma mensagem anterior de Roleplay ou um intervalo de mensagens, use `/illustrate range=12` ou `/illustrate range=12-18`. Veja [Comandos de barra](../chats/slash-commands.md).

## Guias relacionados

- [Provedores de geração de imagens e configuração](image-providers.md)
- [Perfis de estilo de imagem](style-profiles.md)
- [Planos de fundo de cena e a galeria](scene-backgrounds.md)
- [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
