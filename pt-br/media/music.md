# Music DJ: Spotify, YouTube e músicas locais

Neste guia você aprende a tocar música de fundo no Marinara Engine com o agente **Music DJ** (DJ de música). Veja como conectar o Spotify, o YouTube ou os arquivos de música que você tem no computador. O guia também explica o player de música, o montador de playlists **DJ Mari** e a música no Game Mode.

## O que é o Music DJ

**Music DJ** é um agente opcional que precisa ser baixado. Um agente é um ajudante que roda sozinho, em segundo plano, durante o chat. Abra a seção **Agents** (Agentes), selecione **Download Agents** (baixar agentes) e instale **Music DJ** antes de configurá-lo. Depois de cada resposta, Music DJ identifica o clima da cena e toca uma música de fundo combinando com ela.

**Music DJ** toca música de três fontes:

- **Spotify**: controla a reprodução na sua conta real do Spotify e nos seus dispositivos.
- **YouTube**: faz uma busca no YouTube e toca o resultado em um player pequeno dentro do aplicativo. Não precisa fazer login.
- **Custom**: toca os arquivos de áudio guardados em uma pasta da máquina que roda Marinara.

A fonte ativa aparece como um **Music Player** (player de música) pequeno, fixado na barra superior do aplicativo. No celular e em janelas estreitas, ele vira um widget redondo flutuante que você pode arrastar.

Depois da instalação, **Music DJ** vem desativado. Ative-o em um chat como qualquer outro agente. Ele funciona nos chats de **Roleplay** e no modo **Game**, por meio de um botão liga/desliga separado (veja Music DJ no Game Mode, mais adiante). No modo **Conversation**, use o comando **Music** no lugar dele (veja O comando Music no Conversation Mode, mais adiante).

A configuração de **Music DJ** fica toda em um lugar só. Abra o painel lateral **Agents**, à direita, e depois abra **Music DJ**. Outra opção: clique no ícone de engrenagem do mini player. A dica dele diz **Music DJ setup**.

### Escolher a fonte de música

No editor de **Music DJ**, o campo **Music Player** tem três botões: **Spotify**, **YouTube** e **Custom**. O texto de ajuda diz "Choose which service Music DJ should use for future music picks. The same choice switches the visible player surface."

Abaixo dos botões, uma linha mostra qual fonte está ativa no momento, por exemplo "Visible player: Spotify. Saved provider: Spotify." Essa escolha de fonte vale para o aplicativo inteiro. Ela não é salva por chat.

Veja um resumo rápido para escolher:

| Fonte | Conta necessária | Custo | Melhor para |
|---|---|---|---|
| **Spotify** | Sua conta do Spotify mais o Spotify Premium para tocar | Configuração gratuita, Premium para tocar | Músicas reais, com nome, nos seus dispositivos |
| **YouTube** | Uma chave de API do Google, gratuita | Gratuito | Tocar música sem login e sem Premium |
| **Custom** | Nenhuma | Gratuito | Os arquivos de áudio que você tem no computador |

## Configurar o Spotify

O Spotify usa um aplicativo de desenvolvedor gratuito, criado por você. Basta colar um **Spotify Client ID**. Não existe client secret para preencher.

Abra o editor de **Music DJ** e localize o campo **Spotify Connection**. Depois siga estes passos:

1. Abra o **Spotify Developer Dashboard** pelo link que aparece no aplicativo.
2. Crie um aplicativo novo e selecione "Web API".
3. Nos Redirect URIs do aplicativo, adicione exatamente o endereço de redirecionamento que Marinara mostra na etapa 3 da caixa de configuração. O endereço de redirecionamento é o endereço da web para onde o Spotify te devolve depois do login.
4. Copie o **Client ID** do seu aplicativo do Spotify e cole no campo **Spotify Client ID**.
5. Salve o agente e clique em **Connect Spotify Account**.

Abre-se uma janela de login e permissão do Spotify. Depois que você aprova, a janela mostra uma página curta com "Spotify Connected!" e fecha. De volta a Marinara, aparece uma marca verde escrita **Connected to Spotify**. O botão **Disconnect** remove a conexão salva.

O aplicativo mostra este aviso: "Requires Spotify Premium. Tokens refresh automatically, no need to reconnect." Uma conta gratuita do Spotify consegue se conectar, mas tocar, pausar, pular faixa e controlar o volume exige o Spotify Premium, que é o plano pago do serviço.

### Observações sobre dispositivos do Spotify

O Spotify toca por meio de um dispositivo: o celular, o aplicativo do Spotify no computador ou um player dentro do aplicativo.

No computador, a própria aba do navegador pode virar um dispositivo do Spotify. Clique no ícone de notebook no mini player. A dica dele diz **Enable Marinara player** ou **Use Marinara player**. Isso registra um dispositivo do Spotify chamado "Marinara Engine", e a música passa a tocar na aba. Esse streaming dentro do aplicativo também exige o Spotify Premium.

No celular, o player dá preferência ao dispositivo do Spotify do próprio aparelho. Então, ao tocar em play, a música sai no celular, e não na aba do navegador que ficou em segundo plano.

Quando um dispositivo do Spotify não aceita controle remoto de volume, o controle deslizante some e no lugar dele aparece o botão **Use device volume**. Nesse caso, use os botões de volume do próprio dispositivo.

### Spotify em outra máquina

O Spotify só aceita endereços de redirecionamento seguros `https://` ou o endereço de loopback `http://127.0.0.1`. Loopback quer dizer o mesmo computador. Se Marinara roda em outra máquina, por `http` simples, a janela de login pode não carregar.

Duas opções resolvem isso:

- Durante a conexão, abra a seção "Browser couldn't reach the callback?", logo abaixo do botão **Connect Spotify Account**. Copie o endereço completo da janela que falhou, cole na caixa e clique em **Complete connection**.
- Ou defina um endereço de redirecionamento fixo com uma variável de ambiente no servidor. A variável de ambiente é uma configuração do servidor lida na inicialização.

```
SPOTIFY_REDIRECT_URI=https://your-address/api/spotify/callback
```

Veja a [Referência de configuração do servidor](../CONFIGURATION.md) para saber como definir variáveis de ambiente.

## Configurar o YouTube

O modo YouTube precisa de uma chave de API gratuita do YouTube Data. A chave de API é um código secreto que permite a Marinara usar um serviço em seu nome. Não é preciso fazer login em uma conta do YouTube nem ter Premium.

Abra o editor de **Music DJ** e localize o campo **YouTube Connection**. Depois siga estes passos:

1. Abra o **Google Cloud Console** pelo link que aparece no aplicativo e crie ou escolha um projeto.
2. Ative a **YouTube Data API v3**.
3. Vá em Credentials, depois Create credentials e depois API key.
4. Cole a chave no campo **YouTube Data API Key**.
5. Clique em **Save Key**. Depois de salvar, o botão passa a mostrar **Update Key** e aparece uma marca verde escrita "API key configured". O link **Remove** exclui a chave.

Deixe a chave sem restrição, ou restrinja apenas por API e escolha a YouTube Data API v3. Não restrinja por referenciador HTTP. A busca roda no servidor, então uma restrição por referenciador bloquearia tudo.

O aplicativo mostra este aviso: "The free quota (~100 searches/day) is plenty for a personal DJ." Quota é o limite diário de uso. Esse número vem do próprio texto do aplicativo e pode mudar com o tempo. A chave fica no servidor, e Marinara a criptografa antes de salvar.

## Músicas em Custom (arquivos locais)

O modo Custom toca os arquivos de áudio da máquina que roda o servidor do Marinara. Os tipos de arquivo compatíveis são `.mp3`, `.ogg`, `.wav`, `.flac`, `.m4a`, `.aac` e `.webm`.

Abra o editor de **Music DJ** e localize o campo **Custom Music Library**. Ele tem um único botão liga/desliga: **Use Game Assets music folder**.

- Ativado: o modo Custom lê os áudios que você enviou para o Game Assets. Game Assets é a biblioteca de recursos que já vem no Marinara para o Game Mode. Use o campo **Game Assets music folder** para escolher uma pasta. Digite `music` para a biblioteca de música inteira, ou uma subpasta como `music/combat`. O botão **Open Folder** abre essa pasta na máquina do servidor.
- Desativado: o modo Custom lê uma pasta do dispositivo do servidor. Use **Select Folder** para abrir um seletor de pastas na máquina do servidor, ou cole o caminho no campo **Music folder on this device**.

A configuração do chat de Roleplay e a do Game mostram a mesma fonte selecionada. Se você escolheu uma pasta no dispositivo do servidor, as configurações de Music DJ do chat mostram esse caminho salvo e um botão **Choose Folder**, em vez de pedir um caminho do Game Assets.

Tocar a partir de uma pasta fora do Game Assets exige acesso local no servidor. Se você usa Marinara de outro dispositivo, sem senha nem admin secret, esse recurso específico pode ficar bloqueado. Veja [Acesso remoto: Basic Auth e lista de IPs permitidos](../REMOTE_ACCESS.md).

## Usar o player de música

O **Music Player** aparece como uma pequena marca na barra superior no computador, ou como um widget flutuante que você arrasta no celular. Uma configuração permite mostrar ou ocultar o player.

Abra **Settings** (Configurações), vá na aba **General** e localize a seção **App Behavior**. Ative ou desative **Music Player**. O texto de ajuda diz "Shows the compact Music Player. Switch between Spotify, YouTube, and Custom from the player itself or the Music DJ agent settings." Esse botão liga/desliga está sempre disponível e vem ativado por padrão. Se ele estiver ativado sem o Music DJ instalado, o player do computador ou do celular mostra **Download Music DJ Agent to configure** e oferece um botão **Download Agents**.

Em um perfil novo, a fonte visível começa como **YouTube**. A fonte pode ser trocada de três maneiras:

- Use o pequeno botão redondo de troca de fonte no player. A dica dele diz "Switch to ... player".
- Use os botões de **Music Player** no editor de **Music DJ**.
- Use as configurações de **Music DJ** de um chat.

O player mostra a capa ou miniatura da faixa atual, o título e o artista ou canal. Os controles mudam conforme a fonte.

- Spotify: aleatório, **Previous**, tocar ou pausar, **Next**, repetir, um controle deslizante de volume com mudo, o botão **DJ**, o botão de notebook **Marinara player** e a engrenagem **Music DJ setup**.
- YouTube: tocar ou pausar, uma seta de expandir que abre um pequeno painel de vídeo em 16:9, um botão **Stop** e um controle deslizante de volume com mudo.
- Custom: tocar ou pausar e volume, usando os arquivos locais.

Quando o Spotify ainda não está conectado, o player mostra "Spotify not connected" e, ao tocar nele, abre **Music DJ setup**.

### Fonte do Spotify por chat

Quando **Music DJ** roda em um chat de **Roleplay**, o card de configurações dele mostra um menu suspenso **Spotify source** com quatro opções.

- **Liked Songs**: escolhe primeiro entre as faixas que você salvou.
- **Playlist**: mantém as escolhas dentro de uma playlist do Spotify. Um menu suspenso **Playlist** lista as suas playlists.
- **Artist**: busca só em torno de um artista específico. Aparece um campo de texto **Artist**.
- **Any Spotify**: deixa o DJ usar a busca do Spotify quando fizer sentido.

## DJ Mari: montador de playlists com IA

O botão **DJ** no mini player do Spotify monta uma playlist temática para você. A dica dele diz "DJ Mari composes a playlist for you!"

**DJ Mari** pede ao modelo de IA conectado que monte uma playlist a partir da persona, do personagem que você mais usa e dos chats recentes de todas as suas conversas. Em seguida, adiciona as músicas encontradas a uma nova playlist do Spotify chamada "DJ Mari" mais a data de hoje, e começa a tocar.

**DJ Mari** precisa de duas coisas:

- Uma conexão de modelo atribuída ao agente **Music DJ**. Sem ela, aparece a mensagem "Configure a model connection on the Music DJ agent before using DJ Mari." Veja [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md).
- Músicas encontradas em quantidade suficiente no Spotify. São necessárias pelo menos 25 músicas, e o limite é 50. Se encontrar menos de 25, ele pede que você adicione mais Liked Songs e tente de novo.

Quando dá certo, aparece a mensagem "DJ Mari playlist is ready" com um botão **Open playlist**.

## Music DJ no Game Mode

O Game Mode tem música de fundo própria, vinda do Game Assets. Para usar **Music DJ** no lugar dela, ative o botão liga/desliga **Music DJ** na configuração do Game. A descrição dele diz "Use the Music DJ for this game instead of local music assets." Esse botão vem desativado por padrão.

Com ele ativado, você tem as mesmas opções **Spotify**, **YouTube** e **Custom**, e os mesmos campos de cada fonte que existem no Roleplay.

O Spotify funciona de um jeito um pouco diferente no Game Mode. Depois de cada cena, o servidor monta uma lista curta de músicas reais candidatas, tiradas da fonte escolhida. A IA então escolhe uma música dessa lista. Assim a IA não inventa uma música que não existe. O Game Mode escolhe uma música por vez e a repete em loop.

Abra **Game controls** e escolha **Retry Music DJ** para pedir uma nova seleção para a cena atual. Funciona no computador e no celular. Veja [Os controles do jogo](../game/getting-started.md#the-games-controls).

## O comando Music no Conversation Mode

No modo **Conversation** não é possível adicionar **Music DJ** como agente. Em vez disso, os personagens tocam músicas pelo comando **Music**.

Abra a seção **Commands** do chat. Primeiro ative o botão liga/desliga principal, **Commands**. Depois ative o botão **Music**. A descrição dele diz "Let characters play songs through the active Music Player."

A partir daí, o personagem pode citar o nome de uma música para o Spotify, ou descrever uma faixa para o YouTube, e Marinara toca pela fonte ativa. Isso funciona mesmo com **Music DJ** desativado em todos os lugares. Basta o Spotify estar conectado ou uma chave do YouTube estar salva.

Se o Spotify não estiver conectado ou não tiver permissão de reprodução, o comando de música do Spotify não faz nada e não mostra erro nenhum. Então, se as músicas não tocam, configure a fonte primeiro.

## Solução de problemas

- O mini player sumiu. Ative **Music Player** em **Settings**, aba **General**, seção **App Behavior**.
- O Spotify não toca nada. O controle de reprodução exige o Spotify Premium e um dispositivo do Spotify ativo. Abra o aplicativo do Spotify em um dispositivo, ou clique em **Enable Marinara player** no computador.
- A janela de login do Spotify falha em outra máquina. Use a caixa de colar de "Browser couldn't reach the callback?", ou defina a variável `SPOTIFY_REDIRECT_URI` no servidor.
- A busca do YouTube falha. Confira se a **YouTube Data API v3** está ativada no seu projeto e se a chave não está restrita por referenciador HTTP. Se você bateu a quota diária, tente no dia seguinte ou use outra chave.
- A música em Custom não toca a partir de uma pasta do dispositivo quando o acesso é remoto. Essa pasta exige acesso local no servidor. Veja [Acesso remoto: Basic Auth e lista de IPs permitidos](../REMOTE_ACCESS.md).
- O comando de música de um personagem não faz nada no Conversation Mode. Conecte o Spotify ou salve uma chave do YouTube, e verifique se os botões **Commands** e **Music** estão ativados.

## Guias relacionados

- [Referência dos agentes para download](../agents/built-in-agents.md)
- [Agentes: ajudantes de IA para os seus chats](../agents/agents-overview.md)
- [Conectando a um provedor de IA](../connections/connecting-to-a-provider.md)
- [Recursos do jogo: música, som, sprites e planos de fundo](../game/game-assets.md)
- [Conversation Mode: primeiros passos](../conversation/getting-started.md)
