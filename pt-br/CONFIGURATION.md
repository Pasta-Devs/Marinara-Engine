# Referência de configuração do servidor

Este guia explica como mudar as configurações de servidor do Marinara Engine por meio de variáveis de ambiente. Uma variável de ambiente é uma configuração que você escreve em um arquivo de texto simples e o servidor lê. A maioria dos usuários nunca precisa desta página. A lista completa de variáveis fica perto do fim.

## Quando vale a pena configurar Marinara?

Marinara Engine funciona de imediato, sem nenhuma configuração. Esta página serve para um número pequeno de tarefas. Quase todas envolvem usar o servidor para atender a mais de um dispositivo.

Talvez você precise editar a configuração para:

- Deixar outros dispositivos da rede alcançarem o servidor (controle de acesso).
- Proteger um servidor compartilhado com uma senha ou com uma lista de IPs permitidos.
- Mudar o lugar onde os dados ficam salvos no disco.
- Aumentar o detalhamento do log para investigar um problema.
- Dar mais tempo para tarefas lentas de imagem, vídeo ou embedding terminarem (tempos limite).
- Liberar ações privilegiadas, como backups ou atualizações, a partir de um dispositivo remoto.

Quase todo o resto, como as chaves de API dos provedores de IA, os personagens e as opções de chat, fica dentro do aplicativo, não aqui. Para adicionar um provedor de IA, veja [Conectando a um provedor de IA](connections/connecting-to-a-provider.md).

Os agentes oficiais opcionais também são gerenciados dentro do aplicativo. Abra **Agents → Download Agents** (baixar agentes) para instalar ou desinstalar. Marinara escolhe sozinho a trilha do catálogo [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) que corresponde à versão principal do Engine.

Ciclo de vida e armazenamento dos pacotes:

- **Atualizações:** Marinara verifica se os pacotes oficiais já instalados têm atualizações compatíveis e pergunta antes de baixar cada versão nova. Ao escolher **No**, a versão atual continua em uso e a ação manual **Update** permanece disponível em Download Agents. Uma instalação nova fica vazia até você escolher os pacotes.
- **Plataformas:** o comportamento é o mesmo no computador, no Docker e no Android com Termux. No iOS e em outros clientes de navegador, valem os pacotes instalados no servidor Marinara que os hospeda.
- **Persistência:** os pacotes ficam em `DATA_DIR/capability-packages`. Volumes do Docker, pastas de dados personalizadas, backups e atualizações normais preservam esses arquivos.
- **Resistência offline:** os pacotes existentes continuam funcionando na versão instalada quando o acesso HTTPS ao GitHub está indisponível, quando você recusa uma atualização ou quando uma atualização falha na verificação.

### Importação de agentes personalizados

Arquivos, pastas e repositórios personalizados de agentes vêm bloqueados por padrão. Para liberar, abra **Settings → Advanced → Danger Zone** (Configurações → Avançado → Zona de perigo) e ative a opção **Allow custom Agent imports**. Diferente das extensões externas, essa trava é controlada pelo usuário e não depende de variável de ambiente. Os controles de importação ficam desativados até você ativá-la.

Toda importação mostra as capacidades solicitadas pelo agente antes de salvar qualquer coisa. As permissões precisam ser aprovadas de forma explícita, funções embutidas e seleções de ferramentas não são importadas, o CSS gerado passa por sanitização e as ações de resultado são conferidas com base no conjunto de capacidades aprovado. Ao desligar a trava, os agentes importados de fora param de rodar. Os agentes personalizados criados dentro do Marinara e os pacotes oficiais instalados por **Download Agents** continuam funcionando e não dependem dessa trava.

### Repositórios de agentes personalizados

Os repositórios personalizados vêm desativados por padrão, porque os prompts e as ferramentas deles são conteúdo de terceiros sem revisão. Defina `ENABLE_CUSTOM_AGENT_REPOS=true`, ative a opção **Allow custom Agent imports** na Danger Zone e abra **Agents → Download Agents → Custom Sources** para pré-visualizar um repositório público do GitHub. Adicionar uma fonte e aplicar qualquer mudança de conteúdo posterior exigem confirmação explícita. A sincronização é manual: Marinara não clona repositórios nem os consulta em segundo plano.

A raiz do repositório precisa ter um array `agents.json` no mesmo formato de definição de agente usado pelos pacotes que podem ser baixados. Um arquivo mínimo fica assim:

```json
[
  {
    "id": "continuity-helper",
    "name": "Continuity Helper",
    "description": "Checks recent turns for contradictions.",
    "phase": "post_processing",
    "enabledByDefault": false,
    "category": "writer",
    "defaultPromptTemplate": "Check {{messages}} for continuity errors."
  }
]
```

Marinara aceita apenas URLs da raiz de repositórios do GitHub e valida o arquivo compactado, dentro de um limite de tamanho, e cada definição de agente antes de mostrar a pré-visualização. Durante a sincronização, os valores remotos de prompt, configurações e ferramentas substituem os valores gerenciados pelo repositório que aparecem nessa pré-visualização. As escolhas de conexão e de imagens continuam locais. Se um agente sumir do repositório de origem, Marinara o mantém como um agente personalizado local comum e remove só o vínculo com o repositório. Ao remover uma fonte, vale a mesma política de manter o que é local.

### Extensões externas

A importação de extensões externas exige dois consentimentos independentes. Defina `ENABLE_EXTERNAL_EXTENSIONS=true` no arquivo `.env`, abra **Settings → Advanced → Danger Zone**, role para baixo até passar dos controles de exclusão de dados, leia o aviso e ative a opção **Allow third-party extension imports**. Só então a seção **External Extensions** aparece em **Settings → Addons**.

A variável de ambiente é a permissão de quem opera o servidor; o botão liga/desliga da Danger Zone é a aceitação explícita do usuário. A seção, as rotas de importação, as rotas de aprovação e os dois carregadores em tempo de execução aplicam a política combinada. Ao fechar qualquer uma das duas travas, os registros externos são desativados e o código externo em execução para. Registros de extensão salvos manualmente, antigos, importados de um perfil ou de origem desconhecida contam como externos, então largar arquivos em uma pasta ligada a extensões não burla as travas.

Os rascunhos da Professor Mari continuam disponíveis sem essa opção. Eles nascem desativados e ainda exigem aprovação do hash exato do código.

O modo **Sandboxed Browser Extensions** (extensões de navegador isoladas) continua sendo o padrão. Alguns pacotes de terceiros mais antigos vêm marcados como **Full page access** (acesso total à página), porque dependem do DOM do Marinara. Nesse modo, o código aprovado roda exatamente como está dentro da página do Marinara e alcança o conteúdo da página, o armazenamento do navegador, as APIs de rede e a sessão atual de mesma origem. Ele só fica disponível para as External Extensions depois que as duas travas estão abertas e exige uma confirmação de aviso separada. Desative o modo e recarregue a página se a extensão deixar mudanças visuais ou de comportamento para trás.

## Onde fica o arquivo .env

A configuração fica em um arquivo chamado `.env`. É um arquivo de texto simples, com uma configuração por linha, no formato `KEY=value`. As linhas que começam com `#` são comentários e o servidor as ignora.

O arquivo `.env` guarda dados, não é um script de shell. Marinara não executa `$`, substituições de comando como `$(...)` nem outra sintaxe de shell encontrada em um valor. Os inicializadores de macOS/Linux e Termux seguem a mesma regra de não avaliar nada no pequeno conjunto de configurações de que precisam antes de o servidor iniciar. Um valor já presente no ambiente do inicializador tem prioridade sobre a entrada correspondente do arquivo `.env`.

Marinara cria um arquivo `.env` vazio para você na primeira vez que inicia, então não é preciso criar um na mão.

- Em instalações normais, o arquivo `.env` fica na pasta raiz do projeto.
- Nas imagens oficiais de Docker ou Podman, ele fica em `/app/data/.env`, dentro do mesmo volume de armazenamento dos seus dados.

Um arquivo chamado `.env.example`, na mesma pasta, lista todas as configurações com o valor padrão. Para mudar uma configuração, copie a linha do arquivo `.env.example` para o arquivo `.env` e edite o valor depois do sinal `=`.

Veja um exemplo de arquivo `.env` que muda a porta e ativa uma senha:

```
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

O servidor lê o arquivo `.env` sozinho, não importa como você o inicia. Isso vale inclusive para o comando `pnpm start` direto. Os inicializadores de shell (`start.bat`, `start.sh`, `start-termux.sh`) acrescentam duas coisas. Eles definem `HOST=0.0.0.0`, para que outros dispositivos alcancem o servidor, e abrem o navegador para você. Com o comando `pnpm start` puro, o servidor escuta só neste computador, a não ser que você mesmo defina a variável `HOST`.

## Reiniciar ou recarregar na hora

Marinara observa o arquivo `.env` enquanto está em execução. Quando você salva uma mudança, a maioria das configurações passa a valer em cerca de 2 segundos, sem reiniciar. O servidor escreve uma linha de log começando com `[env-watcher]` a cada mudança aplicada.

Um grupo pequeno de configurações de baixo nível fica travado no momento em que o servidor inicia. Mudar essas configurações exige reinício completo. São elas:

- `PORT`, `HOST`
- `SSL_CERT`, `SSL_KEY`
- `DATA_DIR`, `FILE_STORAGE_DIR`
- `ENCRYPTION_KEY`
- `MARINARA_ENV_FILE`
- `TZ`
- `AUTO_OPEN_BROWSER`, `AUTO_UPDATE_ENABLED`, `AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING`
- As configurações de tempo limite e de consulta de imagem, vídeo, sprite e ComfyUI (`IMAGE_GEN_TIMEOUT_MS`, `VIDEO_GEN_TIMEOUT_MS`, `VIDEO_GEN_MAX_RESPONSE_BYTES`, `SPRITE_GENERATION_TIMEOUT_MS`, `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`, `COMFYUI_GEN_TIMEOUT` e as quatro configurações `*_VIDEO_POLL_INTERVAL_MS`)

Quando uma delas muda, o log avisa que o reinício é necessário. As configurações de controle de acesso e os segredos, como `BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, `IP_ALLOWLIST`, `ADMIN_SECRET` e `CSRF_TRUSTED_ORIGINS`, não pedem reinício.

## Controle de acesso

O controle de acesso decide quem tem permissão para alcançar um servidor em execução. Esta seção é uma referência rápida. Para um passo a passo com exemplos, leia [Acesso remoto: Basic Auth e lista de IPs permitidos](REMOTE_ACCESS.md).

Alguns termos usados adiante:

- Loopback é o próprio computador em que o servidor roda. Você chega nele por `127.0.0.1` ou `localhost`.
- Uma faixa CIDR é uma forma curta de escrever um bloco inteiro de endereços IP, como `192.168.1.0/24`. CIDR quer dizer Classless Inter-Domain Routing.
- As faixas RFC 1918 são as faixas de endereços privados padrão usadas dentro de redes domésticas e de escritório, como `10.x.x.x` e `192.168.x.x`.

Por padrão, quando nenhuma senha é definida, o servidor aceita conexões só de origens confiáveis. São elas: loopback, qualquer endereço em `IP_ALLOWLIST`, Tailscale e o tráfego da ponte/gateway do Docker no mesmo host. Todo o resto, inclusive a sua rede doméstica comum, recebe um `403 Forbidden` até você escolher uma das opções abaixo.

As principais configurações de controle de acesso são:

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `BASIC_AUTH_USER` | vazio | Nome de usuário para a solicitação de senha. Defina junto com `BASIC_AUTH_PASS` para exigir login. |
| `BASIC_AUTH_PASS` | vazio | Senha da solicitação de login. Deixe qualquer um dos dois campos vazio para desligar o login. |
| `BASIC_AUTH_REALM` | `Marinara Engine` | Texto exibido na caixa de senha do navegador. |
| `IP_ALLOWLIST` | vazio | IPs ou faixas CIDR separados por vírgula que têm acesso sempre liberado. Loopback é sempre permitido. |
| `IP_ALLOWLIST_ENABLED` | `true` | Defina como `false` para manter a lista, mas pausar a aplicação dela. |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false` | Devolve o acesso sem senha a partir de redes privadas quando nenhum login está definido. |
| `ALLOW_UNAUTHENTICATED_REMOTE` | `false` | Libera o acesso sem senha de qualquer endereço, inclusive da internet pública. Não recomendado. |
| `TRUSTED_PRIVATE_NETWORKS` | padrões internos | Substitui as faixas de rede privada padrão. Inclua também os padrões que você quiser manter. |
| `BYPASS_AUTH_TAILSCALE` | automático | Quando vazio, confia em sockets diretos do Tailscale somente se as duas pontas usam endereços da tailnet. Defina como `true` para manter a liberação antiga de toda a faixa `100.64.0.0/10` ou como `false` para exigir o controle de acesso normal. |
| `BYPASS_AUTH_DOCKER` | automático | Quando vazio, confia somente em uma interface de contêiner detectada e no seu gateway exato. Defina como `true` para manter a compatibilidade com redes antigas ou personalizadas, ou como `false` para exigir o controle de acesso normal. |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY` | `true` | Exige as verificações normais de login e de lista de permissões para o tráfego do Docker encaminhado por proxy. Defina como `false` só quando todo cliente na frente do servidor for confiável. |
| `TRUSTED_HOSTS` | vazio | Nomes de host públicos ou de proxy reverso adicionais que Marinara pode atender. IP direto, localhost, `.local`, `.home.arpa` e nomes de rede local de rótulo único funcionam sozinhos. |
| `SSL_CERT` | vazio | Caminho de um arquivo de certificado TLS. Defina junto com `SSL_KEY` para servir HTTPS diretamente. |
| `SSL_KEY` | vazio | Caminho do arquivo de chave privada TLS. |
| `CSRF_TRUSTED_ORIGINS` | vazio | Origens de navegador adicionais com permissão para salvar mudanças. Use para um domínio público ou uma porta fora do comum. O valor literal `null` é ignorado e não deve ser usado para o APK do Android; as rotas de login com autenticação própria funcionam sem confiar globalmente em uma origem opaca. |

Basic Auth é a abreviação de HTTP Basic Authentication, uma solicitação simples de nome de usuário e senha. As credenciais dela são apenas codificadas, não criptografadas, então use sempre junto com HTTPS quando o servidor estiver exposto à internet pública. HTTPS é a versão segura e criptografada do HTTP. Para ligar o HTTPS diretamente, defina `SSL_CERT` e `SSL_KEY`, ou coloque um proxy reverso na frente do Marinara.

Para que outros dispositivos consigam alcançar o servidor, ele precisa escutar em uma interface acessível. Defina `HOST=0.0.0.0`. Os inicializadores de shell fazem isso por você, mas o comando `pnpm start` escuta só no loopback.

Celulares, tablets, pares do Tailscale e outros computadores continuam se conectando pelo endereço IP do servidor, sem precisar entrar em `TRUSTED_HOSTS`. Se você publicar Marinara em um nome de host público ou de proxy reverso, adicione esse nome exato, por exemplo `TRUSTED_HOSTS=chat.example.com`. Nomes que já estejam em `CSRF_TRUSTED_ORIGINS` ou `CORS_ORIGINS` também são aceitos, por compatibilidade. Essa checagem de Host impede que o nome DNS de um site público seja redirecionado para o endereço de loopback do Marinara.

## Armazenamento

As configurações de armazenamento controlam onde ficam os dados locais. Esses dados incluem chats, personagens, avatares e a mídia gerada.

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `DATA_DIR` | `packages/server/data` | Pasta raiz de todos os dados do usuário. As imagens Docker usam `/app/data`. |
| `FILE_STORAGE_DIR` | a pasta `storage` dentro de `DATA_DIR` | Substitui a pasta de armazenamento de arquivos. |
| `ENCRYPTION_KEY` | vazio | Chave usada para criptografar as chaves de API salvas. Gere uma com o comando abaixo. |

Marinara guarda os dados como arquivos JSON simples. Assim fica fácil copiar e conferir os backups.

Para gerar uma chave de criptografia, rode este comando e cole o resultado em `ENCRYPTION_KEY`:

```
openssl rand -hex 32
```

Para saber o que cada pasta de dados guarda, veja [Onde Marinara salva os seus dados](data/where-data-is-stored.md).

## Níveis de log

O log controla quanto detalhe o servidor imprime no console. O controle principal é `LOG_LEVEL`. O servidor esconde tudo abaixo do nível escolhido.

| Nível | O que mostra |
| --- | --- |
| `error` | Só as falhas graves, das quais não é possível se recuperar. |
| `warn` | Os erros mais os avisos não fatais. É o padrão. |
| `info` | Os avisos mais os logs de inicialização e de cada requisição. |
| `debug` | Tudo, inclusive os prompts completos e as respostas do modelo. Muito verboso. |

Escolhas recomendadas:

- Mantenha o padrão `warn` no uso normal. Ele é discreto e mostra só problemas reais.
- Use `info` quando quiser ver as requisições e os marcos importantes sem inundar o console.
- Use `debug` quando precisar ver o prompt exato enviado ao modelo e a resposta. Espere muitas linhas no console.

Para ler os detalhes de prompt e conexão sem os logs de requisição de rotina, defina um preset em vez de um nível:

```
LOG_PRESET=prompt-connections
```

Esse preset mostra o mesmo detalhe de prompt e modelo que o nível `debug`, mas esconde linhas repetidas de requisição, como `GET /api/chats`. Para silenciar só essas linhas de rotina e manter o nível atual, defina isto e reinicie:

```
LOG_DISABLE_REQUEST_LOGGING=true
```

O log do navegador é separado e não obedece a `LOG_LEVEL`.

## Tempos limite

Um tempo limite é o tempo máximo que o servidor espera por uma tarefa lenta antes de desistir. Tarefas de mídia, como a geração de imagens e de vídeos, podem demorar, então os tempos limite delas já vêm generosos. Todos os valores de tempo limite são em milissegundos, salvo quando o nome diz outra coisa.

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `CHAT_GENERATION_TIMEOUT_MS` | `300000` (5 minutos) | Tempo limite de cabeçalhos do provedor, de primeiro token e entre pedaços da resposta nas gerações comuns de Conversation, Roleplay e Game, além do prazo até o primeiro byte para gerações em segundo plano que não têm tempo limite próprio (atualização da linha do tempo do Noodle, respostas do Noodler). Faixa válida: `10000`-`3600000`. Não altera os tempos limite de agentes, mídia, embeddings ou ferramentas. |
| `AGENT_CALL_TIMEOUT_MS` | `300000` (5 minutos) | Limite de duração total de uma chamada de LLM feita por um agente (trackers, reformatador de HTML e outros agentes), aplicado mesmo enquanto a resposta ainda está em streaming. Aumente para modelos locais lentos que precisam de mais de 5 minutos por passagem de agente. Faixa válida: `10000`-`3600000`. O Illustrator mantém pelo menos o prazo interno de 30 minutos. |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000` (45 segundos) | Limite de duração total da chamada ao modelo que transforma a cena atual do Game em um prompt dinâmico de imagem. Aumente para modelos locais mais lentos. Faixa válida: `10000`-`3600000`. |
| `EMBEDDING_TIMEOUT_MS` | `300000` (5 minutos) | Tempo permitido para uma requisição de embedding. Um valor maior ajuda servidores locais de embedding lentos. |
| `IMAGE_GEN_TIMEOUT_MS` | `1800000` (30 minutos) | Tempo permitido para uma requisição de geração de imagens. |
| `VIDEO_GEN_TIMEOUT_MS` | `1800000` (30 minutos) | Tempo permitido para uma requisição de geração de vídeo de cena, inclusive fluxos de vídeo locais do ComfyUI. |
| `VIDEO_GEN_MAX_RESPONSE_BYTES` | `167772160` (160 MiB) | Maior download de vídeo de cena que o servidor aceita. |
| `COMFYUI_GEN_TIMEOUT` | `2400` (40 minutos, em segundos) | Tempo permitido para um fluxo de imagem do ComfyUI depois de entrar na fila. |
| `SPRITE_GENERATION_TIMEOUT_MS` | usa `IMAGE_GEN_TIMEOUT_MS` como alternativa | Tempo permitido para uma tarefa de geração de sprite por IA. |
| `CUSTOM_TOOL_TIMEOUT_MS` | `60000` (1 minuto) | Tempo permitido para uma chamada de ferramenta personalizada. |
| `MAX_TOOL_ROUNDS` | `100` | Número máximo de rodadas de chamada de ferramenta antes de o modelo ter que dar uma resposta final. |

Os tempos limite de imagem, vídeo, sprite e ComfyUI ficam travados na inicialização, então mudá-los exige reinício. Os tempos limite de geração de chat, de agente, de prompt dinâmico de imagem do Game, de embedding e de ferramenta personalizada passam a valer na próxima requisição ou execução de agente, sem reinício. Valores inválidos, zerados, negativos ou fora da faixa nos tempos limite validados de chat, de agente e de prompt dinâmico de imagem do Game geram um aviso no log e usam com segurança os padrões documentados. Aumente um tempo limite de mídia quando tarefas grandes ou de alta qualidade falharem no meio do caminho. Para saber mais sobre as tarefas de vídeo, veja [Vídeo de cena](media/scene-video.md).

## APIs privilegiadas (ADMIN_SECRET)

Algumas ações são destrutivas ou de alto risco, então exigem um segredo a mais, além das checagens normais de acesso. É o caso de fazer backup, limpar os dados, aplicar atualizações e instalar temas.

Defina um valor longo e aleatório para `ADMIN_SECRET` no servidor:

```
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

Na máquina em que o servidor roda (loopback), essas ações costumam funcionar sem o segredo. De outro dispositivo, o aplicativo precisa enviar o segredo. Cole o mesmo valor no aplicativo em **Settings**, depois **Advanced**, depois **Admin Access** (acesso de administrador). A partir daí, o aplicativo envia o segredo por você.

Configurações privilegiadas relacionadas:

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `ADMIN_SECRET` | vazio | Segredo compartilhado exigido para ações privilegiadas vindas de dispositivos remotos. |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false` | Com `true`, exige o segredo até na máquina local. |
| `UPDATES_APPLY_ENABLED` | `false` | Permite que o navegador aplique atualizações comuns do mesmo canal. Uma troca deliberada de canal de versão feita pelo navegador na própria máquina do servidor funciona sem esta opção. Só em instalações via Git. |
| `UPDATES_ALLOW_REMOTE_APPLY` | `false` | Permite que um dispositivo remoto aplique atualizações, com um segredo válido. |
| `HAPTICS_ALLOW_REMOTE` | `false` | Permite ações de dispositivo háptico a partir de um dispositivo remoto, com um segredo válido. |
| `CUSTOM_TOOL_SCRIPT_ENABLED` | `false` | Ativa as ferramentas de script personalizadas. Mantenha desligado no caso de ferramentas importadas ou não confiáveis. |
| `ENABLE_CUSTOM_AGENT_REPOS` | `false` | Ativa a pré-visualização e a sincronização manual de repositórios de agentes do GitHub no Agents Manager. Agentes de terceiros não passam por revisão e exigem confirmação explícita antes da importação ou da atualização. |
| `ENABLE_EXTERNAL_EXTENSIONS` | `false` | Primeira das duas travas para importar extensões de terceiros. O usuário também precisa consentir em Settings → Advanced → Danger Zone. |
| `IMPORT_ALLOWED_ROOTS` | vazio | Pastas do sistema de arquivos que a importação em massa pode ler sem token de seleção. |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES` | `268435456` (256 MiB) | Maior exportação de perfil em JSON, em um arquivo só, que o servidor monta. |

Se `ADMIN_SECRET` não estiver definido no servidor, as ações privilegiadas falham em qualquer dispositivo, menos na máquina local. A mensagem de erro pede que você defina o segredo e cole o valor em **Admin Access**.

## Liberação de endereços locais

Por padrão, as requisições de saída para provedores, serviços de imagem e webhooks se recusam a alcançar endereços privados ou locais. Isso bloqueia um tipo de ataque chamado SSRF (server-side request forgery), em que uma requisição é enganada para alcançar um endereço interno. Os endereços de provedor em loopback continuam liberados, para que os servidores de modelo local sigam funcionando.

Ative só a opção de que você precisa para um serviço próprio hospedado em outra máquina da rede privada.

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | Permite que URLs de provedor de IA alcancem endereços privados ou da rede local. Vem ativado no Android. |
| `IMAGE_LOCAL_URLS_ENABLED` | `false` | Permite que URLs de provedor de imagem alcancem endereços privados ou da rede local. As URLs privadas de resultado das imagens geradas ainda precisam bater com a origem exata do provedor configurado. |
| `TTS_LOCAL_URLS_ENABLED` | `false` | Permite que URLs de conversão de texto em voz alcancem endereços privados ou da rede local. |
| `DEEPLX_LOCAL_URLS_ENABLED` | `false` | Permite que URLs de tradução DeepLX alcancem endereços privados ou da rede local. |
| `WEBHOOK_LOCAL_URLS_ENABLED` | `false` | Permite que webhooks de ferramentas personalizadas alcancem endereços privados ou da rede local. |

Para conectar um modelo local ou hospedado por você, veja [Conectar um modelo local ou auto-hospedado](connections/local-self-hosted.md).

## Referência completa das variáveis de ambiente

Esta seção lista as configurações restantes, agrupadas por finalidade. As tabelas anteriores já cobrem controle de acesso, armazenamento, log, tempos limite, ações privilegiadas e liberação de endereços locais.

### Servidor e inicialização

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `PORT` | `7860` | A porta em que o servidor escuta. Use o mesmo valor no Android, no Docker e no Termux. |
| `HOST` | `127.0.0.1` (`0.0.0.0` nos inicializadores de shell) | A interface de rede a que o servidor se associa. Use `0.0.0.0` para acesso pela rede local. |
| `MARINARA_ANDROID_SECRET` | vazio | Segredo interno de autenticação local para instalações do Termux gerenciadas pelo APK. Não é uma entrada do instalador: o invólucro do Android o gera e provisiona, e o inicializador do Termux o exporta automaticamente. Não peça aos usuários do APK que o forneçam nem o defina em instalações comuns de desktop ou manuais do Termux. Quando definido, ele deve ter exatamente 64 caracteres hexadecimais. Um valor inválido e não vazio faz as requisições locais do dispositivo falharem com HTTP 503 em vez de enfraquecer a autenticação. |
| `MARINARA_ANDROID_SECRET_FILE` | `~/.marinara-engine/android-secret` | Caminho do arquivo privado de segredo usado pelo inicializador do Termux e pela CLI local `mari`. O APK e o inicializador gerenciam esse arquivo automaticamente; usuários comuns do APK nunca precisam ler ou copiar o arquivo. |
| `AUTO_OPEN_BROWSER` | `true` | Define se os inicializadores de shell abrem o endereço do aplicativo para você. Defina como `false` para desligar. A configuração gerenciada pelo APK desativa a abertura automática do navegador nessa inicialização para que o aplicativo Android já autenticado se conecte. |
| `AUTO_UPDATE_ENABLED` | `true` | Define se os inicializadores baseados em Git para Windows, macOS/Linux e Termux buscam e aplicam atualizações do Engine antes de iniciar. Defina como `false` para desligar de vez; isso passa a valer no próximo início. O inicializador ainda faz uma checagem somente leitura de versões publicadas mais novas e imprime um lembrete de download quando existe uma, enquanto as checagens manuais, a aplicação dentro do aplicativo, as atualizações de pacotes e as atualizações de modelos continuam disponíveis. Use `--skip-update` para pular as duas checagens do inicializador em um único início. |
| `MARINARA_ENV_FILE` | o arquivo `.env` na raiz do projeto | Caminho alternativo, opcional, para o arquivo `.env`. Defina antes de iniciar. |
| `TZ` | padrão do sistema | Fuso horário de reserva do host para as tarefas no servidor. As agendas do Conversation Mode usam o fuso horário global escolhido nos controles de agenda, quando já houver um salvo. Deixe `TZ` sem valor para herdar o fuso do host; um `TZ=` vazio também conta como não definido. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Origens de navegador com permissão para fazer requisições entre origens diferentes. |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true` | Opção antiga. As versões atuais não trazem chave inicial embutida, então isso não cria nada. Adicione a sua conexão dentro do aplicativo. |

`AUTO_CREATE_DEFAULT_CONNECTION` só continua existindo por causa das instalações antigas. As versões novas não trazem mais uma conexão inicial embutida, então deixar essa opção ligada não faz nada. Para começar a conversar, adicione uma conexão seguindo [Conectando a um provedor de IA](connections/connecting-to-a-provider.md).

Os controles de agenda do Conversation Mode usam, por padrão, o fuso horário informado pelo navegador ou pelo dispositivo. O campo **Schedule timezone** (fuso horário da agenda) pode ser alterado durante a criação da Conversation, nas Chat Settings (configurações do chat) da Conversation ou no editor de agenda do personagem. O fuso horário IANA escolhido é uma preferência global, compartilhada por todos os chats de Conversation e sincronizada com os outros clientes Marinara ligados ao mesmo servidor.

### Ferramentas de mídia e de sprite

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `FFMPEG_PATH` | vazio | Caminho de um programa `ffmpeg`. Usado nos GIFs de expressão animada. Na falta dele, vale o `ffmpeg` do seu PATH. |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000` (3 minutos) | Tempo permitido para converter um clipe de expressão animada. |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE` | `auto` | Motor de limpeza do sprite. `auto` tenta a limpeza adaptativa de recorte antes da alternativa opcional por IA; `builtin` mantém só o caminho de recorte; `backgroundremover` força a ferramenta de IA. |
| `BACKGROUNDREMOVER_AUTO_INSTALL` | `false` | Com `true`, instala o removedor de plano de fundo por IA, que é opcional, ao iniciar. |
| `BACKGROUNDREMOVER_COMMAND` | vazio | Caminho de um programa `backgroundremover` do sistema. |
| `BACKGROUNDREMOVER_PYTHON` | vazio | Caminho de um programa Python onde `backgroundremover` está instalado. |
| `BACKGROUNDREMOVER_TIMEOUT_MS` | `600000` (10 minutos) | Tempo permitido para uma chamada de remoção de plano de fundo por IA. |

### Provedores de vídeo de cena

Os provedores de vídeo de cena são configurados como conexões dentro do aplicativo, não como variáveis de ambiente. As configurações abaixo apenas ajustam as tarefas por trás disso. Todos os valores são em milissegundos.

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | De quanto em quanto tempo o servidor consulta uma tarefa do Google Veo. |
| `XAI_VIDEO_POLL_INTERVAL_MS` | `5000` | De quanto em quanto tempo o servidor consulta uma tarefa do xAI Imagine. |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | De quanto em quanto tempo o servidor consulta uma tarefa de vídeo do OpenRouter. |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS` | `10000` | De quanto em quanto tempo o servidor consulta uma tarefa do Seedance. |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL` | vazio | Endereço HTTPS público deste servidor, usado quando um provedor precisa buscar uma imagem de referência por URL. |

### Integrações e extras

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `DOCS_I18N_BASE_URL` | a branch `docs-i18n` oficial | De onde os pacotes de documentação traduzida são baixados (Settings → General → Documentation Language). Precisa ser um host `https://` público; forks e espelhos podem apontar para a própria cópia da branch `docs-i18n`. |
| `GIPHY_API_KEY` | vazio | Chave do Giphy para a busca de GIFs no Conversation Mode. Sem ela, a busca fica desligada. |
| `INTIFACE_URL` | `ws://127.0.0.1:12345` | Endereço padrão do aplicativo háptico Intiface. |
| `SPOTIFY_REDIRECT_URI` | derivado da requisição | Substitui a URL de retorno do login do Spotify. Defina quando o TLS for tratado antes do servidor. |
| `MARI_WIKI_CONTENT_MAX_BYTES` | `50000` | Maior conteúdo de página de wiki que a Professor Mari lê antes de cortar. |
| `MARI_WIKI_REQUEST_TIMEOUT_MS` | `30000` | Tempo permitido para uma requisição de wiki feita pela Professor Mari. |
| `MARI_WIKI_CACHE_TTL_MS` | `300000` | Por quanto tempo a Professor Mari guarda em cache uma leitura de wiki. |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false` (o inicializador do Windows define `true`) | Permite instalar o runtime de modelo local sem cabeçalho de administrador no loopback. |
| `SSL_CERT` | vazio | Caminho de um certificado TLS. Veja a seção Controle de acesso, acima. |
| `SSL_KEY` | vazio | Caminho de uma chave privada TLS. Veja a seção Controle de acesso, acima. |

Sobre a chave do Giphy, vale lembrar: a busca de GIFs fica indisponível até você definir `GIPHY_API_KEY` e reiniciar. Sobre o modelo local embutido, veja [Como configurar o Local Model](connections/local-model.md).

## Guias relacionados

- [Acesso remoto: Basic Auth e lista de IPs permitidos](REMOTE_ACCESS.md)
- [Onde Marinara salva os seus dados](data/where-data-is-stored.md)
- [Conectando a um provedor de IA](connections/connecting-to-a-provider.md)
- [Vídeo de cena](media/scene-video.md)
- [Solução de problemas do Marinara Engine](TROUBLESHOOTING.md)
