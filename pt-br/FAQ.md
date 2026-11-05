# Perguntas frequentes

Respostas curtas para as dúvidas mais comuns sobre Marinara Engine. Cada uma traz o link do guia com o passo a passo completo.

<a id="how-do-i-access-marinara-engine-from-my-phone-or-another-device"></a>

## Como acesso Marinara Engine pelo celular ou por outro dispositivo?

Marinara roda como um servidor em um computador, e você o abre em um navegador. Os scripts de inicialização deixam outros dispositivos alcançarem o servidor, mas o controle de acesso os bloqueia até você definir um login (um nome de usuário e uma senha) no computador anfitrião. Até lá, um dispositivo remoto só vê uma página **Access blocked** (acesso bloqueado).

1. Mantenha Marinara em execução no computador anfitrião.
2. Descubra o endereço IP local do anfitrião. No Windows, execute `ipconfig` e veja **IPv4 Address**. No macOS ou no Linux, execute `hostname -I`.
3. No outro dispositivo, abra `http://<host IP>:7860` em um navegador, por exemplo `http://192.168.1.42:7860`. `7860` é a porta padrão.
4. Defina um login. No outro dispositivo, abra Marinara: a página bloqueada tem um formulário **Setup code** (código de configuração). Encontre o código de uso único no log do servidor, no computador anfitrião (no Docker, execute `docker logs <container> 2>&1 | grep "setup code"`), e digite-o com um novo nome de usuário e uma nova senha. Ou, em um navegador que já tem sessão iniciada no anfitrião, abra **Settings → Advanced → Access** (Configurações → Avançado → Acesso).
5. Entre. Para adicionar mais dispositivos sem digitar a senha, use **Add a device** (adicionar um dispositivo) em **Settings → Advanced → Access**.

Nas instalações comuns de desktop, o próprio computador (`127.0.0.1`) não precisa de senha. Um proxy reverso no mesmo computador conta como visitante remoto e precisa do login. Para todas as opções, os códigos de configuração e o Docker, veja [Acesso remoto](REMOTE_ACCESS.md#option-1-login-recommended). Para dispositivos em redes diferentes, use o Tailscale: veja [Conectar de qualquer lugar com o Tailscale](REMOTE_ACCESS.md#connect-from-anywhere-with-tailscale). Se você não conseguir se conectar, veja [Solução de problemas](TROUBLESHOOTING.md).

## Existe um aplicativo de celular para Marinara?

Não existe um aplicativo nativo separado. No celular ou no tablet, use o aplicativo web em um navegador. A maioria dos navegadores oferece **Add to Home Screen** ou **Install App** (adicionar à tela inicial ou instalar o aplicativo), o que salva o aplicativo como um PWA (um site que abre como um aplicativo, sem a barra do navegador).

No Android, também é possível [baixar o APK mais recente](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Ele roda Marinara no celular pelo Termux. Veja [Instalação no Android](installation/android-termux.md). No iPhone e no iPad, veja o [Guia do PWA para iOS](installation/ios-pwa.md).

No aplicativo Android, o inicializador oferece **Open in browser** (abrir no navegador), **Retry connection** (tentar conectar novamente) e **Install / Start Marinara**. Para mudar a sua escolha depois, use **Settings → General → App Behavior → Open Android launcher (app or browser)** (Configurações → Geral → Comportamento do aplicativo → Abrir o inicializador Android: aplicativo ou navegador). APKs antigos fazem login manualmente em `/android-login`.

<a id="can-i-play-with-other-people"></a>

## Posso jogar com outras pessoas?

Sim. O multijogador opcional permite que várias pessoas compartilhem um mesmo chat de Conversation, Roleplay ou Game. Cada pessoa ativa a configuração e depois hospeda ou entra. Convidados não precisam de chave de IA. Uma senha não torna seguro um anfitrião desconhecido. Leia a [configuração, os avisos e os limites do multijogador](CONFIGURATION.md#optional-multiplayer) antes de ativá-lo.

## Quais são os três modos de chat?

- **Conversation**: um chat no estilo de aplicativo de mensagens com um personagem.
- **Roleplay**: uma cena de história imersiva, com narração e avatares dos personagens.
- **Game**: uma aventura de texto conduzida por um game master de IA.

Veja [Primeiros passos com Marinara Engine](home/welcome.md#choose-a-chat-mode) para escolher um.

## Como mudo o fuso horário usado pelas agendas do Conversation Mode?

Abra um chat Conversation e escolha **Schedule timezone** (fuso horário da agenda) em Chat Settings (configurações do chat). **Use device** (usar o dispositivo) volta para o fuso horário do seu dispositivo. É uma configuração global para todos os chats Conversation, e ela sincroniza com os outros dispositivos do mesmo servidor. Veja [Conversation Mode: primeiros passos](conversation/getting-started.md).

## Cada chat Conversation tem a própria agenda?

Não. A agenda pertence ao personagem, então todo chat Conversation com esse personagem a usa. Edite-a em **Character Editor → Convo → Weekly schedule** (editor de personagem → Convo → agenda semanal).

Para receber respostas instantâneas em um chat, desligue **Conversation schedules** (agendas do Conversation) nas Chat Settings desse chat. Uma substituição manual de status, como **dnd**, continua valendo, e ela pertence ao personagem em todos os chats. Use **clear** para removê-la.

## Preciso de uma chave de API para usar Marinara?

Sim, para os serviços de IA online. Uma **chave de API** é um código secreto de um serviço de IA que deixa Marinara usar a sua conta nesse serviço. Você precisa de pelo menos uma conta antes de iniciar um chat. Abra **Connections** (Conexões) e clique em **Add** (adicionar). Escolha um serviço, cole a sua chave e clique em **Connect** (conectar). Veja [Conectando a um provedor de IA](connections/connecting-to-a-provider.md).

Algumas opções não precisam de chave. As opções por assinatura (Claude, ChatGPT e Grok) fazem login por uma ferramenta de linha de comando. O **Built-in model** (modelo embutido) roda no seu computador. Veja [Como configurar o Built-in model](connections/local-model.md).

## Quais provedores de IA são compatíveis?

Marinara tem suporte a OpenAI, Anthropic, Google Gemini, OpenRouter e muitos outros serviços de geração de texto, de imagens e de vídeos, além de servidores **OpenAI-compatible** (compatíveis com OpenAI), como Ollama, LM Studio e KoboldCpp. A lista completa está em [Provedores de IA compatíveis](connections/providers-reference.md). Para adicionar um, veja [Conectando a um provedor de IA](connections/connecting-to-a-provider.md).

## Preciso pagar para usar Marinara?

Marinara é gratuito. Você paga o que o seu serviço de IA cobra. Algumas opções não custam nada para testar: as imagens do **Pollinations** dispensam chave, o **Stable Horde** é gratuito e o **Built-in model** roda no seu computador. As opções por assinatura usam um plano pago que talvez você já tenha.

## Minhas chaves de API estão seguras?

Sim. Toda chave de API é criptografada com AES-256 antes de ser salva. As exportações de conta e de perfil deixam os valores secretos de fora, então digite as suas chaves de novo depois de usar **Import Profile** (importar perfil), inclusive em um ZIP de backup completo. Um ZIP de backup completo contém os registros criptografados e o arquivo de chave que os abre, então mantenha-o em sigilo. Veja [Fazer backup e restaurar](data/backup-and-restore.md).

## O que é um card de personagem?

Um card de personagem é o perfil salvo de um personagem de IA: nome, avatar, personalidade, história de fundo e saudação inicial. Você cria cards no **Character Editor** ou os importa de outros aplicativos. Veja [Criando e editando personagens](characters/creating-and-editing-characters.md).

## O que é um lorebook e como uso um deles com vários personagens?

Um lorebook é um conjunto de fatos do mundo. Cada entrada entra no prompt só quando as palavras de acionamento dela aparecem no chat. Você pode:

1. Preencher **Linked Characters** (personagens vinculados) ou **Linked Personas** (personas vinculadas) no editor de lorebooks. Assim, o lorebook funciona em qualquer chat com eles.
2. Abrir **Chat Settings → Lorebooks → Add Lorebook** (configurações do chat → lorebooks → adicionar um lorebook) para anexá-lo a um chat.
3. Limitar entradas individuais a certos personagens.

Veja [Lorebooks](lorebooks/overview.md).

## O que é um agente?

Um agente é um ajudante de IA opcional que roda durante um chat para fazer uma tarefa bem definida, como acompanhar a cena ou acrescentar mapas. Instalações novas não vêm com nenhum. Abra **Agents → Agent Organizer** (agentes → Organizador de agentes), escolha um e instale. Depois, ative-o em cada chat, em **Chat Settings**. Veja [Agentes](agents/agents-overview.md).

## Como configuro Noodle?

Noodle é uma rede social fictícia e local para os seus personagens. Instale o **Noodle** em **Agents → Agent Organizer**, reinicie Marinara quando o aplicativo pedir e depois abra **Home → Noodle**. Veja [Noodle: a linha do tempo social dentro do aplicativo](agents/noodle.md).

## Por que o meu personagem não responde?

Normalmente, o chat não tem conta nem modelo, a chave de API está errada ou a conta está sem crédito. Veja [Meu personagem não responde](TROUBLESHOOTING.md#my-character-does-not-reply).

## Por que meu personagem não lembra das mensagens antigas?

Os modelos só leem uma quantidade limitada de texto de uma vez, então as mensagens antigas saem de vista nos chats longos. Duas ferramentas ajudam. O **Memory Recall** traz de volta as mensagens antigas relevantes, e os resumos comprimem as mensagens antigas em recapitulações. Os dois ficam em **Chat Settings**. Para chats longos de Roleplay, use **Advanced Memory Recall** (recuperação avançada de memória) em **Chat Settings → Memory Recall**. Veja [Memória e resumos](agents/memory.md).

## Como faço backup dos meus dados?

Abra **Settings → Advanced → Backup & Export** (Configurações → Avançado → Backup e exportação) e clique em **Download Backup** (baixar o backup). Isso salva um `.zip` com os seus dados e os arquivos que você enviou. Para restaurar, use **Import Profile (JSON/ZIP)** em **Settings → Imports** (Configurações → Importações). A mesma seção pode fazer um backup diário, semanal ou mensal. Veja [Fazer backup e restaurar](data/backup-and-restore.md).

## Como funcionam as extensões e posso importar código de terceiros?

Por padrão, só a Professor Mari cria rascunhos de Personal Extension. Um rascunho começa desativado, e você aprova o código exato dele antes que ele rode. As importações de terceiros ficam ocultas até o anfitrião definir `ENABLE_EXTERNAL_EXTENSIONS=true` no `.env` e você aceitar o aviso em **Settings → Advanced → Danger Zone** (Configurações → Avançado → Zona de perigo). Veja [Extensões pessoais](extending/personal-extensions.md).

## Onde meus dados ficam guardados?

No computador que executa Marinara, na pasta `data` da sua instalação. Nada fica guardado na nuvem. Veja [Onde os seus dados ficam guardados](data/where-data-is-stored.md).

## Vou perder meus dados ao atualizar?

Não. A atualização mantém os seus personagens, chats e configurações. Mesmo assim, faça um backup antes. Voltar para uma versão anterior pode fazer você perder dados que só a versão mais nova armazena. Veja [Atualizando](UPGRADING.md) e [Como voltar para uma versão anterior](UPGRADING.md#downgrading-to-an-older-version).

## O que a Professor Mari pode fazer?

Professor Mari é a assistente integrada da tela inicial. Ela explica o aplicativo e cria ou edita personagens, personas, lorebooks e presets quando você pede. Cada mudança mostra um card com **Undo** (desfazer). Veja [Professor Mari](home/professor-mari.md).

## O que é o agente Storyboard e como usá-lo no Game Mode?

Ele transforma o texto já concluído da história em imagens. Instale o **Storyboard** em **Agents → Agent Organizer** e depois ative-o no chat. Veja o [Guia do agente Storyboard](game/storyboard.md).

## Os personagens podem falar em voz alta em uma chamada?

Sim, no modo Conversation. Você precisa do **Text to Speech** (conversão de texto em voz) configurado em **Connections**. Veja [Chamadas](conversation/calls.md) para o passo a passo, inclusive o reconhecimento de fala do seu microfone.

## Marinara consegue gerar imagens?

Sim. Adicione uma conta de geração de imagens, como o **Pollinations** (dispensa chave) ou um serviço pago. Veja [Conectando a um provedor de IA](connections/connecting-to-a-provider.md).

## Como leio a documentação dentro do aplicativo?

Na tela inicial, clique em **Documentation** (documentação) nos favoritos. No celular, abra primeiro o menu de favoritos. No FAQ da tela inicial, você também pode clicar em **Open Documentation** (abrir a documentação).

## Onde consigo ajuda ou relato um problema?

Comece por [Solução de problemas](TROUBLESHOOTING.md). Na tela inicial, **Discord** abre o chat da comunidade e **Support** abre a página de suporte do projeto. Relate bugs e peça recursos novos na página do projeto no GitHub.

## Guias relacionados

- [Solução de problemas](TROUBLESHOOTING.md)
- [Instalação](INSTALLATION.md)
- [Acesso remoto](REMOTE_ACCESS.md)
- [Conectando a um provedor de IA](connections/connecting-to-a-provider.md)
