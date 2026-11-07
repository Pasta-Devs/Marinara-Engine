# Music DJ: Spotify, YouTube e músicas locais

O **Music DJ** (DJ de música) toca música de fundo que combina com a sua cena. Este guia mostra como conectar o Spotify, o YouTube ou os seus próprios arquivos de áudio, usar o player de música e usar música no Game Mode e no Conversation.

## O que é o Music DJ

O **Music DJ** é um agente opcional para download. Um agente é um ajudante que roda em segundo plano em um chat. Depois de cada resposta, ele pode ler o clima da cena e tocar uma música que combine com ela.

Antes de começar: abra **Agents** (agentes), selecione **Agent Organizer** (organizador de agentes) e instale o **Music DJ**. Ele vem desativado depois da instalação. Ative-o em um chat como qualquer outro agente. Ele funciona nos chats de Roleplay, no Game Mode por um botão liga/desliga separado ([Music DJ no Game Mode](#music-dj-in-game-mode)) e no Conversation pelo comando **Music** ([O comando Music do Conversation](#the-conversation-music-command)).

Ele toca música de três fontes.

| Fonte | Conta necessária | Custo | Melhor para |
|---|---|---|---|
| **Spotify** | A sua própria conta do Spotify, e o Spotify Premium para tocar | Configuração gratuita, Premium para tocar | Músicas reais, com nome, nos seus próprios dispositivos |
| **YouTube** | Uma chave de API do Google, gratuita | Gratuito | Tocar música sem login e sem Premium |
| **Custom** | Nenhuma | Gratuito | Os seus próprios arquivos de áudio |

A fonte ativa aparece como um pequeno **Music Player** (player de música) fixado na barra superior. No celular e em janelas estreitas, ele vira um pequeno widget redondo flutuante que você pode arrastar.

A configuração do Music DJ fica em um único lugar compartilhado. Abra o painel **Agents**, à direita, e depois **Music DJ**. Você também pode clicar no ícone de engrenagem do mini player (dica **Music DJ setup**).

### Escolha uma fonte de música

No editor do **Music DJ**, o campo **Music Player** tem três botões: **Spotify**, **YouTube** e **Custom**. Uma linha abaixo deles mostra o que está ativo, por exemplo "Visible player: Spotify. Saved provider: Spotify." Essa escolha vale para o aplicativo inteiro e não é salva por chat. A pasta de onde o **Custom** toca pode ser diferente para cada chat ou personagem: veja [Use uma pasta diferente para um chat ou personagem](#use-a-different-folder-for-a-chat-or-character).

## Configure o Spotify

O Spotify usa um aplicativo de desenvolvedor do Spotify, gratuito e criado por você. Você cola apenas um **Spotify Client ID**. Não há client secret.

1. No editor do **Music DJ**, localize **Spotify Connection**.
2. Abra o **Spotify Developer Dashboard** pelo link que aparece no aplicativo.
3. Crie um aplicativo novo e selecione "Web API".
4. Nos Redirect URIs do aplicativo, adicione exatamente o endereço de redirecionamento que Marinara mostra na etapa 3 da caixa de configuração do aplicativo. O endereço de redirecionamento é para onde o Spotify envia você depois do login.
5. Copie o **Client ID** e cole em **Spotify Client ID**.
6. Salve o agente e clique em **Connect Spotify Account**.

Abre-se uma janela de login e permissão do Spotify. Depois que você aprova, ela mostra uma página curta de sucesso e fecha. Marinara mostra uma marca verde **Connected to Spotify**. **Disconnect** remove a conexão salva.

> **Observação:** o Spotify Premium (o plano pago) é necessário para tocar, pausar, pular faixa e controlar o volume. Uma conta gratuita consegue se conectar. Os tokens são renovados automaticamente.

Se não funcionou: em outra máquina, a janela de login pode falhar (veja abaixo). Caso contrário, confira se o endereço de redirecionamento é exatamente igual.

### Dispositivos do Spotify

O Spotify toca por meio de um dispositivo, como o seu celular, o aplicativo do Spotify no computador ou um player dentro do aplicativo.

- No computador, clique no ícone de notebook do mini player (**Enable Marinara player** ou **Use Marinara player**) para transformar a aba do navegador em um dispositivo do Spotify chamado "Marinara Engine". O streaming na aba exige Premium.
- No celular, o player dá preferência ao dispositivo do Spotify do próprio aparelho, então a música toca no celular, e não em uma aba em segundo plano.
- Se um dispositivo não permite controle remoto de volume, o controle deslizante é substituído por **Use device volume**. Use os botões de volume do próprio dispositivo.

### Spotify em outra máquina

O Spotify só aceita endereços de redirecionamento seguros `https://` ou o endereço de loopback `http://127.0.0.1` (o mesmo computador). Se Marinara roda em outra máquina por `http` simples, a janela de login pode falhar. Há duas soluções:

- Durante a conexão, abra "Browser couldn't reach the callback?", abaixo de **Connect Spotify Account**. Copie o endereço completo da janela que falhou, cole na caixa e clique em **Complete connection**.
- Ou defina um endereço de redirecionamento fixo como variável de ambiente (uma configuração do servidor lida na inicialização):

```text
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

Veja a [Referência de configuração do servidor](../CONFIGURATION.md).

### Escolha onde o Spotify busca as músicas (Roleplay)

Quando o Music DJ roda em um chat de Roleplay, o cartão dele tem uma lista **Spotify source** (fonte do Spotify).

- **Liked Songs**: escolhe primeiro entre as faixas que você salvou.
- **Playlist**: fica dentro de uma playlist, escolhida na lista **Playlist**.
- **Artist**: busca em torno de um artista, digitado no campo **Artist**.
- **Any Spotify**: deixa o DJ usar a busca do Spotify quando fizer sentido.

## Configure o YouTube

O modo YouTube precisa de uma chave gratuita da YouTube Data API. Uma chave de API é um código secreto que permite que Marinara use um serviço por você. Não é preciso fazer login no YouTube nem ter Premium.

1. No editor do **Music DJ**, localize **YouTube Connection**.
2. Abra o **Google Cloud Console** pelo link do aplicativo e crie ou escolha um projeto.
3. Ative a **YouTube Data API v3**.
4. Vá em Credentials, Create credentials, API key.
5. Cole a chave em **YouTube Data API Key**.
6. Clique em **Save Key**. O botão passa a mostrar **Update Key** e aparece uma marca verde "API key configured". **Remove** exclui a chave.

Deixe a chave sem restrição, ou restrinja apenas por API, à YouTube Data API v3. Não restrinja por referenciador HTTP. A busca roda no servidor, então um limite por referenciador a bloquearia. O aplicativo diz que a cota gratuita (cerca de 100 buscas por dia) é suficiente para um DJ pessoal. Esse número vem do texto do aplicativo e pode mudar. A sua chave fica no servidor, criptografada.

## Use os seus próprios arquivos de música

O modo Custom toca arquivos de áudio da máquina que roda Marinara. Os tipos compatíveis são `.mp3`, `.ogg`, `.wav`, `.flac`, `.m4a`, `.aac` e `.webm`.

No editor do **Music DJ**, localize **Custom Music Library**. Ele tem um único botão liga/desliga, **Use Game Assets music folder**.

- **Ativado**: o modo Custom lê os áudios que você enviou para o Game Assets, a biblioteca de recursos do Marinara para o Game Mode. Use **Game Assets music folder** para escolher uma pasta. Digite `music` para a biblioteca inteira ou uma subpasta como `music/combat`. **Open Folder** abre a pasta na máquina do servidor.
- **Desativado**: o modo Custom lê uma pasta do dispositivo do servidor. Use **Select Folder** para abrir um seletor na máquina do servidor, ou cole o caminho em **Default music folder on this device** (pasta de música padrão neste dispositivo). Todo chat sem uma pasta própria usa essa pasta.

Tocar a partir de uma pasta fora do Game Assets exige acesso local no servidor. Salvar um caminho de pasta digitado exige o mesmo acesso que o seletor de pastas. De outro dispositivo, sem login nem segredo de administrador, os dois podem ficar bloqueados. Veja [Acesso remoto: login e lista de IPs permitidos](../REMOTE_ACCESS.md).

<a id="use-a-different-folder-for-a-chat-or-character"></a>

### Use uma pasta diferente para um chat ou personagem

Um chat ou um personagem pode ter uma pasta de música própria, para que cada história toque a sua própria trilha sonora. A pasta de um personagem toca em todos os chats em que ele é o único personagem.

1. Abra o chat e depois **Chat Settings** (configurações do chat).
2. Nas configurações do **Music DJ**, com o player **Custom** selecionado, abra **Apply to** (aplicar a) e escolha onde a pasta fica salva.
3. Clique em **Choose Folder** (escolher pasta), ou cole o caminho em **Music folder on this device** (pasta de música neste dispositivo).

| Apply to | Quais chats usam a pasta |
| --- | --- |
| **This chat** (este chat) | Só este chat. Uma ramificação começa com a mesma pasta e pode trocá-la. |
| O nome do personagem | Todos os chats em que esse personagem é o único personagem. Só aparece em um chat com apenas um personagem. |
| **All chats (default)** (todos os chats, padrão) | Todos os chats sem uma pasta própria. É a pasta padrão do editor do **Music DJ**. |

O Music DJ usa a primeira pasta que encontra: a pasta deste chat, depois a pasta do personagem, depois a padrão. Um chat em grupo nunca usa a pasta de um personagem. A pasta de um chat ou de um personagem toca mesmo quando a fonte padrão é o Game Assets.

Enquanto um chat toca a partir do Game Assets (ele não tem uma pasta própria neste dispositivo), a opção **This chat** também mostra o campo **Game Assets Music Folder** (pasta de música do Game Assets). Digite uma subpasta do Game Assets, como `music/combat`, para tocá-la só neste chat. Deixe o campo vazio para usar a pasta padrão.

**In use:** (em uso) mostra a pasta que este chat toca e de onde ela vem: **This chat**, **From** seguido do nome do personagem, ou **Default** (padrão).

- **Use default** (usar padrão) remove a pasta deste chat. O chat passa a tocar a pasta do personagem, ou a padrão.
- **Unlink from** (desvincular de) seguido do nome do personagem remove a pasta do personagem de todos os chats.

A mesma opção **Apply to** aparece quando você adiciona o Music DJ a um chat. A pasta própria de um chat fica fora das exportações de chat, dos perfis de configurações e dos arquivos do **Export Profile** (exportar perfil). As exportações de agentes deixam de fora a pasta padrão e as pastas de personagem. Cada caminho aponta para arquivos neste servidor, então não significa nada em outro.

## Use o player de música

O **Music Player** é uma pequena marca na barra superior no computador e um widget que você arrasta no celular. Para mostrar ou ocultar o player, abra **Settings → General → App Behavior** (Configurações → Geral → Comportamento do aplicativo) e ative ou desative **Music Player**. Ele vem ativado por padrão. Com ele ativado e o Music DJ não instalado, o player mostra **Download Music DJ Agent to configure** e oferece um botão **Agent Organizer**.

Em um perfil novo, a fonte começa como **YouTube**. Troque-a pelo botão redondo de troca de fonte no player (dica "Switch to ... player"), pelos botões de **Music Player** no editor ou pelas configurações de **Music DJ** de um chat.

O player mostra a capa ou miniatura da faixa, o título e o artista ou canal. Os controles dependem da fonte.

- **Spotify**: aleatório, **Previous**, tocar ou pausar, **Next**, repetir, volume com mudo, **DJ**, o botão de notebook **Marinara player** e a engrenagem **Music DJ setup**. Quando o Spotify não está conectado, o player mostra "Spotify not connected", e um toque nele abre **Music DJ setup**.
- **YouTube**: tocar ou pausar, uma seta que abre um pequeno painel de vídeo em 16:9, **Stop** e volume com mudo.
- **Custom**: tocar ou pausar e volume.

## DJ Mari: montador de playlists com IA

O botão **DJ** no mini player do Spotify ("DJ Mari composes a playlist for you!") monta uma playlist temática. DJ Mari pede ao seu modelo de IA conectado que monte a playlist a partir da sua persona, do personagem que você mais usa e dos chats recentes de todas as conversas. Em seguida, adiciona as músicas encontradas a uma nova playlist do Spotify chamada "DJ Mari" mais a data de hoje e começa a tocá-la.

DJ Mari precisa de duas coisas.

- Um modelo atribuído ao agente **Music DJ**. Sem ele, aparece "Configure a model connection on the Music DJ agent before using DJ Mari." Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).
- Pelo menos 25 músicas do Spotify encontradas. São escolhidas até 50. Com menos de 25, DJ Mari pede que você adicione mais Liked Songs e tente de novo.

Quando dá certo, você vê "DJ Mari playlist is ready" com um botão **Open playlist**.

<a id="music-dj-in-game-mode"></a>

## Music DJ no Game Mode

O Game Mode tem música de fundo própria, vinda do Game Assets. Para usar o Music DJ no lugar dela, ative o botão liga/desliga **Music DJ** na configuração do Game ("Use the Music DJ for this game instead of local music assets"). Ele vem desativado por padrão. Assim, você tem as mesmas opções **Spotify**, **YouTube** e **Custom**, e os mesmos campos, que no Roleplay.

Com o Spotify, depois de cada cena o servidor monta uma lista curta de músicas reais candidatas, tiradas da fonte escolhida, e a IA escolhe uma. Isso impede que ela invente uma música. O Game Mode toca uma música por vez, em loop. Para pedir uma nova escolha para a cena atual, abra **Game controls** (controles do jogo) e escolha **Retry Music DJ**. Veja [Os controles do jogo](../game/getting-started.md#the-games-controls).

<a id="the-conversation-music-command"></a>

## O comando Music do Conversation

No Conversation, não é possível adicionar o Music DJ como agente. Em vez disso, os personagens tocam músicas pelo comando **Music**.

1. Abra a seção **Commands** (comandos) do chat e ative o botão liga/desliga principal **Commands**.
2. Ative **Music** ("Let characters play songs through the active Music Player").

A partir daí, um personagem pode citar uma música para o Spotify, ou descrever uma faixa para o YouTube, e Marinara a toca pela fonte ativa. Isso funciona mesmo com o Music DJ desativado em todos os lugares. Basta o Spotify estar conectado ou uma chave do YouTube estar salva. Se o Spotify não estiver conectado ou não tiver permissão de reprodução, um comando de música do Spotify não faz nada e não mostra erro.

## Solução de problemas

- **O mini player sumiu**: ative **Music Player** em **Settings → General → App Behavior**.
- **O Spotify não toca nada**: a reprodução exige o Spotify Premium e um dispositivo do Spotify ativo. Abra o aplicativo do Spotify para computador em um dispositivo, ou clique em **Enable Marinara player** no computador.
- **A janela de login do Spotify falha em outra máquina**: use a caixa de colar de "Browser couldn't reach the callback?", ou defina `SPOTIFY_REDIRECT_URI` no servidor.
- **A busca do YouTube falha**: confirme que a **YouTube Data API v3** está ativada no seu projeto e que a chave não está restrita por referenciador HTTP. Se você atingiu a cota diária, tente no dia seguinte ou use outra chave.
- **Com acesso remoto, a música em Custom não toca a partir de uma pasta do dispositivo, ou um caminho de pasta digitado não é salvo**: os dois exigem acesso local no servidor. Veja [Acesso remoto: login e lista de IPs permitidos](../REMOTE_ACCESS.md).
- **Um chat toca a pasta errada**: confira **In use:** nas configurações do **Music DJ** do chat. **This chat** tem prioridade sobre a pasta do personagem, então clique em **Use default** para voltar a seguir o personagem.
- **O comando de música de um personagem não faz nada no Conversation**: conecte o Spotify ou salve uma chave do YouTube, e confira se os botões **Commands** e **Music** estão ativados.

## Guias relacionados

- [Referência dos agentes para download](../agents/built-in-agents.md)
- [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Recursos do jogo: música, som, sprites e planos de fundo](../game/game-assets.md)
- [Conversation Mode: primeiros passos](../conversation/getting-started.md)
