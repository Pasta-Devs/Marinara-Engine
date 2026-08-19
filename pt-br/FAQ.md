# Perguntas frequentes

Aqui estão as respostas para as dúvidas mais comuns sobre Marinara Engine, organizadas por assunto. Cada resposta traz o link do guia completo, caso você queira se aprofundar.

## Como acesso Marinara Engine pelo celular ou por outro dispositivo?

Marinara Engine funciona como um servidor local em um computador, e você abre tudo em um navegador. Esta resposta explica como entrar pelo celular, pelo tablet ou por outro computador da mesma rede.

Os scripts de inicialização (`start.sh`, `start.bat` e `start-termux.sh`) já deixam o servidor escutando em todas as interfaces de rede (`0.0.0.0`). Outros dispositivos conseguem alcançar o servidor pela rede, mas o controle de acesso bloqueia essa entrada por padrão. Enquanto você não configurar o acesso no computador anfitrião, o dispositivo remoto só vê uma página **Access blocked** (acesso bloqueado) com instruções de configuração.

Siga estes passos:

1. Mantenha Marinara em execução no computador anfitrião.
2. No computador anfitrião, configure o controle de acesso: Basic Auth (um nome de usuário e uma senha) ou uma lista de IPs permitidos (a relação de endereços de dispositivos confiáveis). O guia [Acesso remoto](REMOTE_ACCESS.md) explica cada opção, inclusive a liberação para redes privadas totalmente confiáveis.
3. Descubra o endereço IP local do computador anfitrião. No Windows, execute este comando e veja o campo **IPv4 Address**:

```
ipconfig
```

No macOS ou no Linux, execute este comando:

```
hostname -I
```

4. No outro dispositivo, abra um navegador e digite o IP do anfitrião seguido da porta. A porta padrão é `7860`:

```
http://192.168.1.42:7860
```

Troque `192.168.1.42` pelo endereço IP do seu anfitrião.

5. Faça login se o navegador pedir o nome de usuário e a senha do Basic Auth. Se aparecer a página **Access blocked**, volte e conclua o passo 2 no anfitrião.

Nas instalações comuns de desktop, você não precisa de senha no próprio computador (`127.0.0.1`). As instalações no Android gerenciadas pelo APK adicionam um login privado no localhost para impedir que outro aplicativo Android se passe pelo Marinara, mas o invólucro do Android cria e usa essa credencial automaticamente. Os outros dispositivos ficam bloqueados até você configurar o controle de acesso (Basic Auth ou lista de IPs permitidos). Cada opção está explicada em [Acesso remoto](REMOTE_ACCESS.md).

Se os dois dispositivos não estiverem na mesma rede, uma ferramenta como Tailscale ajuda. Tailscale dá a cada dispositivo um endereço privado fixo. Com isso, você se conecta de qualquer lugar sem expor Marinara à internet pública. Se a conexão não funcionar, veja [Solução de problemas do Marinara Engine](TROUBLESHOOTING.md).

## Existe um aplicativo de celular para Marinara?

Não existe um aplicativo nativo separado. No celular ou no tablet, você usa o mesmo aplicativo web pelo navegador. A maioria dos navegadores de celular oferece a opção **Add to Home Screen** ou **Install App** (adicionar à tela inicial ou instalar o aplicativo), o que dá a sensação de um aplicativo de verdade, sem a barra do navegador. Isso se chama PWA (Progressive Web App, um site que você instala como se fosse um aplicativo).

No Android, também é possível [baixar diretamente o APK mais recente](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Ele executa Marinara localmente no celular pelo Termux. A instalação não exige chave de assinatura, senha nem segredo de acesso local; veja [Instalação no Android](installation/android-termux.md) para os avisos de permissão do Android. No iPhone e no iPad, veja o [Guia do PWA para iOS / iPadOS](installation/ios-pwa.md).

O invólucro do Android faz login automaticamente quando abre o servidor do Termux gerenciado pelo APK. A credencial privada só fica visível para quem abre deliberadamente o servidor em outro navegador no mesmo celular: abra `/android-login`, rode `cat ~/.marinara-engine/android-secret` no Termux e cole o valor exibido. A CLI local `mari` lê automaticamente esse mesmo segredo gerenciado pelo inicializador. Instalações manuais do Termux mantêm as regras normais de localhost e acesso pela rede.

## Quais são os três modos de chat?

Marinara tem três modos de chat, mostrados como abas quando você abre a lista de chats:

- **Conversation**: um chat no estilo mensagem de texto, como se você trocasse mensagens com um personagem em um aplicativo de mensagens.
- **Roleplay**: uma cena de história imersiva, com narração, avatares dos personagens e arte opcional dos personagens.
- **Game Mode**: uma aventura de texto guiada, conduzida por um game master, com imagens e vídeos de cena opcionais.

Cada modo tem o próprio guia de primeiros passos. Comece pelo modo que você quer usar e depois explore os guias detalhados dele.

## Como mudo o fuso horário usado pelas agendas do Conversation Mode?

Abra um chat Conversation e escolha **Schedule timezone** (fuso horário da agenda) em Chat Settings (configurações do chat). A escolha também aparece durante a criação de agendas no fluxo de configuração do Conversation Mode. Marinara começa com o fuso horário informado pelo dispositivo, mas você pode selecionar qualquer fuso IANA compatível ou escolher **Use device** para voltar ao padrão. Essa é uma preferência global para todos os chats Conversation, inclusive para as mensagens autônomas geradas no servidor, e ela sincroniza com os outros dispositivos ligados ao mesmo servidor Marinara.

## Preciso de uma chave de API para usar Marinara?

Quase sempre, sim. Uma **conexão** é um vínculo salvo que informa a Marinara como chegar a um serviço de IA: qual provedor, qual modelo e o seu login nele. Uma **chave de API** é um código secreto, parecido com uma senha. Você pega esse código com um provedor de IA para que Marinara converse com esse provedor em seu nome.

É preciso ter pelo menos uma conexão antes de iniciar qualquer chat. Para criar uma, abra o painel **Connections** (conexões), clique em **New**, escolha um provedor, cole a chave em **API Key** e selecione um modelo. O passo a passo completo está em [Conectando a um provedor de IA](connections/connecting-to-a-provider.md).

Alguns poucos provedores não usam chave de API. As opções por assinatura (Claude, ChatGPT e Grok) fazem login por uma ferramenta de linha de comando, e o Local Model embutido roda na sua própria máquina, sem chave nenhuma.

## Quais provedores de IA são compatíveis?

Marinara é compatível com vários provedores. Você escolhe um por conexão.

Para o texto de chat e de roleplay, as opções são **OpenAI**, **OpenAI (ChatGPT)**, **Anthropic**, **Claude (Subscription)**, **Grok CLI (Subscription)**, **Google Gemini**, **Google Vertex AI**, **Mistral**, **Cohere**, **OpenRouter**, **NanoGPT**, **xAI / Grok** e **Custom (OAI-Compatible)**, esta última para modelos locais ou hospedados por você, como Ollama, LM Studio e KoboldCpp.

Para a geração de imagens, as opções incluem **OpenAI (DALL-E)**, **Stability AI**, **Together AI**, **NovelAI**, **OpenRouter Images**, **xAI / Grok Imagine**, **Venice.ai**, **Atlas Cloud**, **Pollinations**, **Stable Horde**, **SD Web UI (AUTOMATIC1111 / Forge)**, **ComfyUI**, **RunPod Serverless (ComfyUI)**, **Draw Things**, **NanoGPT** e **Block Entropy**.

Para a geração de vídeos, as opções são **Google AI Studio**, **xAI Imagine**, **OpenRouter Video**, **Atlas Cloud**, **Seedance 2.0** e fluxos de trabalho locais no formato de API do **ComfyUI**.

Você pode salvar várias conexões ao mesmo tempo e usar uma diferente em cada chat. Veja [Conectando a um provedor de IA](connections/connecting-to-a-provider.md).

## Preciso pagar para usar Marinara?

Marinara em si é gratuito e roda no seu próprio computador. O que você paga é o valor cobrado pelo provedor de IA escolhido, que muda conforme o provedor e o modelo.

Algumas opções não custam nada para testar. A geração de imagens do **Pollinations** dispensa chave. O **Stable Horde** é gratuito, e a chave é opcional, apenas para ganhar prioridade na fila. O **Local Model** embutido roda na sua máquina sem chave. As opções por assinatura (Claude, ChatGPT e Grok) usam um plano pago que talvez você já tenha, no lugar de uma chave de API cobrada por uso.

## Minhas chaves de API estão seguras?

Sim. Marinara criptografa toda chave de API com AES-256 antes de salvá-la no disco. As exportações de conexão e de perfil removem os
valores secretos. Um backup completo é diferente: ele contém os registros criptografados e, quando existe, o arquivo da chave de criptografia
necessário para abri-los. Por isso, mantenha os ZIPs de backup completo em sigilo.

Como a importação de perfil deixa os valores secretos de fora de propósito, você precisa digitar de novo cada chave de API depois de importar um
perfil, inclusive quando usa o botão **Import Profile** (importar perfil) em um ZIP de backup completo. Já a restauração manual da pasta de dados completa preserva
as chaves criptografadas, desde que o arquivo da chave de criptografia correspondente também seja restaurado.

## O que é um card de personagem?

Um **card de personagem** é o perfil salvo de um personagem de IA: nome, avatar, personalidade, história de fundo e saudação inicial. Você cria e edita os cards no **Character Editor** (editor de personagens). Também é possível importar cards feitos em outros aplicativos. Veja [Criando e editando personagens](characters/creating-and-editing-characters.md).

## O que é um lorebook e como uso um deles com vários personagens?

Um **lorebook** é um conjunto de entradas com informações do seu mundo. Cada entrada acrescenta fatos ao prompt (o texto que Marinara envia para a IA) só quando as palavras-chave dela aparecem no chat. Isso economiza tokens e mantém a lore coerente. Existem três formas de definir o alcance de um lorebook. Escolha a que combina com o seu caso:

1. Vincule o lorebook a personagens ou personas. No editor de lorebooks, preencha **Linked Characters** ou **Linked Personas**. Assim, o lorebook é acionado em qualquer chat que tenha um personagem vinculado ou use uma persona vinculada. Os dois campos aceitam mais de uma entrada, então adicione todos os personagens que quiser.
2. Anexe o lorebook a um chat. Abra **Chat Settings**, encontre a seção **Lorebooks** e use o botão **Add Lorebook**. Faça isso quando a lore pertencer a um chat específico.
3. Filtre entradas individuais por personagem. Dentro de um lorebook compartilhado, marque cada entrada para ser acionada só quando certos personagens estiverem presentes. Isso funciona bem em um lorebook grande de mundo, no qual algumas entradas são específicas de um personagem.

Para conhecer o recurso inteiro, veja [Visão geral dos lorebooks](lorebooks/overview.md).

## O que é um agente?

Um **agente** é um ajudante de IA opcional que trabalha durante o chat com uma tarefa bem definida. Alguns exemplos: acompanhar a cena atual, cuidar da qualidade da escrita, acrescentar mapas ou chamadas, ou conduzir um jogo de mesa no Conversation Mode. Uma instalação nova não vem com agentes opcionais. Abra o painel **Agents** (agentes), clique em **Download Agents**, leia os detalhes de um item e instale. Depois, ative os agentes compatíveis em cada chat, em **Chat Settings**. Quando um pacote oficial instalado tem uma atualização compatível, Marinara pergunta antes de baixá-la. Ao escolher **No**, a versão atual continua no lugar e o botão **Update** fica disponível em Download Agents para depois. Se o servidor estiver fora do ar ou a verificação falhar, a versão instalada continua funcionando. O catálogo também cuida da remoção completa dos pacotes. Veja [Agentes: ajudantes de IA para os seus chats](agents/agents-overview.md) e o [repositório público Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents).

## Como configuro Noodle?

Noodle é a rede social fictícia e local do Marinara para os seus personagens. Abra a aba **Noodle** e entre em **Settings** (configurações). Convide personagens ou pastas de personagens, escolha uma conexão de geração em **Refresh** e selecione **Refresh now** para gerar a primeira atividade. Também é possível definir horários de atualização automática, geração de imagens, usuários aleatórios e o aproveitamento do conteúdo nos seus chats.

Os guias completos são [Noodle: a linha do tempo social dentro do aplicativo](noodle/overview.md) e [Configurações do Noodle e transferência para os chats](noodle/settings.md).

## Por que meu personagem não lembra das mensagens antigas?

Os modelos de IA só conseguem segurar uma quantidade limitada de texto de uma vez, então as mensagens antigas somem de vista nos chats longos. Marinara tem dois sistemas de memória que ajudam:

- O **Memory Recall** busca nas mensagens anteriores e recoloca discretamente os trechos mais relevantes no prompt. Ative em **Chat Settings**, na seção **Memory Recall**.
- Os resumos comprimem as mensagens antigas em recapitulações curtas. Os chats de Roleplay usam **Chat Summary**, e os chats Conversation usam **Automatic Summarization**.

Para a configuração e os detalhes, veja [Memory Recall e resumos do chat](agents/memory.md).

## Como faço backup dos meus dados?

Abra **Settings**, vá para a aba **Advanced**, encontre a seção **Backup & Export** e clique em **Download Backup** (baixar o backup). Isso salva um único arquivo `.zip` com os seus dados e os arquivos que você enviou. Para restaurar depois, use **Import Profile (JSON/ZIP)** em **Settings**, na aba **Imports**, e escolha esse mesmo `.zip`.

Na mesma seção, você também pode ativar um backup automático rotativo diário, semanal ou mensal. Os ZIPs de backup completo podem
conter os registros criptografados e o arquivo de chave necessário para abri-los, então guarde-os em sigilo. O botão **Import Profile** continua
deixando os segredos dos provedores em branco, então digite as chaves de novo depois de importar. O guia completo é
[Fazer backup e restaurar](data/backup-and-restore.md).

## Como funcionam as extensões e posso importar código de terceiros?

Por padrão, só Professor Mari pode criar um rascunho de Personal Extension para você. Ele já nasce desativado, e você precisa inspecionar o código e aprovar o hash SHA-256 exato antes de ele rodar.

Por padrão, o código de navegador usa um Worker dedicado, dentro de um iframe de origem opaca. Além das permissões limitadas de log, de armazenamento privado, de temporizador, de limpeza e de interface declarativa, ele recebe os IDs opacos do chat ativo e dos personagens. Assim, extensões como o Notepad conseguem guardar um estado próprio para cada chat. Uma Browser Extension pode pedir à parte cópias limitadas apenas dos cards de personagem que participam daquele chat e/ou da persona escolhida para ele. Essas permissões aparecem na hora da aprovação por hash exato; sem elas, os registros correspondentes nem existem. As extensões isoladas nunca recebem mensagens, bibliotecas inteiras de personagens ou personas, campos não declarados, metadados do chat, acesso ao DOM, acesso à rede nem APIs de alteração. O código de servidor roda em um processo separado, isolado pelo sistema operacional, em hosts macOS e Linux compatíveis, e não recebe o contexto de chat do navegador.

As importações de terceiros ficam ocultas por padrão. O operador do host precisa definir `ENABLE_EXTERNAL_EXTENSIONS=true` no arquivo `.env`, e depois o usuário precisa aceitar o aviso em **Settings → Advanced → Danger Zone**. Enquanto essas duas travas não forem abertas, os registros externos, inclusive os guardados manualmente e os que vieram de importação de perfil, não aparecem, não podem ser aprovados e não podem ser executados.

Uma External Extension pode pedir o **Full page access** (acesso total à página) quando a compatibilidade com código antigo realmente exige o DOM do Marinara. Esse modo não é isolado: o código exato aprovado roda dentro da página do Marinara. Ele alcança o conteúdo da página, o armazenamento do navegador, as APIs de rede e a sessão atual de mesma origem. Os rascunhos da Professor Mari não podem pedir essa permissão. Ative só depois de inspecionar aquela versão exata e confiar nela. Se sobrarem alterações não registradas, recarregue a página depois de desativar. Veja [Extensões pessoais](extending/personal-extensions.md).

## Onde meus dados ficam guardados?

Tudo fica no computador que executa Marinara, dentro da pasta `data` da sua instalação. Os personagens, os chats, as personas, os lorebooks, os presets e as configurações são salvos ali. Nada vai para a nuvem. Veja [Onde Marinara salva os seus dados](data/where-data-is-stored.md).

## Vou perder meus dados ao atualizar?

Não. A atualização do Marinara preserva os personagens, os chats e as configurações. Ainda assim, é prudente fazer um backup antes de uma atualização grande, por precaução. Os passos de atualização em cada plataforma estão em [Atualizando Marinara Engine](UPGRADING.md).

## O que Professor Mari faz?

Professor Mari é a assistente embutida na tela Home. Chame por ela com o botão **Ask Professor Mari** (falar com a Professor Mari). Ela explica o aplicativo e ajuda na configuração. Ela também cria ou edita os seus dados quando você pede em linguagem comum: personagens, personas, lorebooks, presets de prompt (modelos de instrução salvos) e chats novos.

Acima do campo de digitação, ela ainda mostra sugestões rápidas em forma de etiquetas, para guiar criações e edições de várias etapas sem que você precise digitar cada detalhe.

Quando ela mexe nos seus dados, aparece um card de revisão com os botões **Keep** e **Restore**, para você desfazer o que não quiser. Ela é uma ajudante, e não substitui estes guias quando o assunto depende da versão. A lista completa do que ela faz está em [Professor Mari](home/professor-mari.md).

Professor Mari também consegue editar os arquivos de código comuns do Marinara. Já os arquivos de dependências, os iniciadores, os instaladores e os fluxos de CI ficam esperando uma revisão explícita. Se a mudança dela precisar de uma biblioteca pública do npm, Marinara mostra a versão exata resolvida e a integridade do registro antes de instalar, com os scripts de ciclo de vida desativados.

Observação: em um endereço remoto comum, as ações da Professor Mari que alteram dados exigem Basic Auth e também um segredo de administrador. Rotas de rede confiáveis ou com IP na lista de permissões podem usar as liberações descritas em [Acesso remoto](REMOTE_ACCESS.md).

## O que é o agente Storyboard e como usá-lo no Game Mode?

O agente **Storyboard**, que você baixa à parte, transforma o texto já concluído da história em uma sequência ordenada de quadros-chave. Ele também pode transformar cada quadro-chave em um clipe curto animado. No **Game Mode**, ele monta o storyboard de um turno de narração já concluído do GM (o mestre do jogo) e mostra os quadros em um visualizador flutuante ou como plano de fundo do Game. No **Roleplay**, ele reúne as trocas recém-concluídas em um episódio embutido.

Para usá-lo no Game Mode, instale o agente **Storyboard** em **Agents > Download Agents**. Abra o Game, abra a seção **Chat Settings > Agents**, ative **Enable Agents** e **Enable Storyboards** e defina uma conexão de imagem no Game ou na configuração global do Storyboard. Termine um turno de narração do GM, depois abra a **Gallery** (galeria) e clique em **Create storyboard**. Use **View storyboard** para reabrir o visualizador.

Para os Storyboards automáticos do Game, ative **Automatic Storyboard Illustrations**. Quando quiser clipes, ative também **Automatic Storyboard Animations** e escolha uma conexão de geração de vídeos. A apresentação **Storyboard Optimized** do assistente de configuração do novo jogo só molda a narração do GM; ela não instala nem ativa o agente. A configuração no Game e no Roleplay, os prompts, os visualizadores, o comportamento na migração e a solução de problemas estão no [Guia do agente Storyboard](game/storyboard.md).

## Os personagens podem falar em voz alta em uma chamada?

Sim, no modo **Conversation**. As chamadas de áudio e vídeo existem apenas nesse modo. Para ouvir um personagem falar, primeiro configure o **Text to Speech** (conversão de texto em voz) no painel **Connections**.

Se você quiser responder pelo microfone e o reconhecimento de fala do próprio navegador não for confiável, instale antes o agente **Calls** em **Agents > Download Agents**. Depois abra o painel **Connections**, expanda o card **Local Model**, encontre **Local Speech Model**, escolha **Whisper Tiny (Multilingual)** ou **Whisper Base (Multilingual)** e clique em **Download Whisper**. Ao desinstalar Calls, os downloads do Whisper também saem, liberando espaço em disco. A configuração completa das chamadas está em [Chamadas](conversation/calls.md).

## Marinara consegue gerar imagens?

Sim. Adicione uma conexão de geração de imagens, por exemplo **Pollinations** (dispensa chave) ou um provedor pago. Com isso, Marinara cria avatares de personagem, arte de cena, selfies e os quadros-chave do agente Storyboard no Roleplay ou no Game Mode. Para adicionar uma conexão, veja [Conectando a um provedor de IA](connections/connecting-to-a-provider.md).

## Como leio a documentação dentro do aplicativo?

Toda instalação já vem com o conjunto completo de guias. Você lê tudo sem sair do aplicativo:

- Na tela Home, clique no botão **Documentation** no rodapé, ao lado de **Replay Tutorial**.
- No FAQ da tela Home, abra a pergunta sobre documentação e clique em **Open Documentation**.

Os dois botões abrem o mesmo leitor interno. Ele lista todos os guias e exibe o conteúdo dentro do Marinara.

## Onde consigo ajuda ou relato um problema?

Comece por [Solução de problemas do Marinara Engine](TROUBLESHOOTING.md), que está organizado por sintoma. No rodapé da tela Home, o botão **Discord** abre o chat da comunidade e o botão **Support** abre a página de suporte do projeto. Para relatar bugs e pedir recursos novos, use a página do projeto no GitHub.

## Guias relacionados

- [Solução de problemas do Marinara Engine](TROUBLESHOOTING.md)
- [Instalação](INSTALLATION.md)
- [Acesso remoto](REMOTE_ACCESS.md)
- [Conectando a um provedor de IA](connections/connecting-to-a-provider.md)
