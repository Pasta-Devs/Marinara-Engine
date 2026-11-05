# Referência de configuração do servidor

Este guia lista as configurações do servidor que você pode mudar com variáveis de ambiente, que são configurações que o servidor lê de um arquivo de texto simples chamado `.env`. Marinara funciona sem nenhuma configuração. A maioria das pessoas só precisa dela para deixar outros dispositivos se conectarem, proteger um servidor compartilhado, mudar a pasta de dados de lugar, aumentar o detalhamento do log ou dar mais tempo para tarefas lentas.

As suas contas de IA, os personagens e as opções de chat são definidos dentro do aplicativo. Para adicionar uma conta de IA, veja [Conectando a um provedor de IA](connections/connecting-to-a-provider.md).

<a id="edit-the-env-file"></a>

## Editar o arquivo .env

Marinara cria um arquivo `.env` vazio na primeira vez que inicia. Cada linha segue o formato `KEY=value`. As linhas que começam com `#` são comentários.

| Instalação | Onde fica o `.env` |
| --- | --- |
| Instalação normal | A pasta raiz do projeto |
| Imagem oficial de Docker ou Podman | `/app/data/.env`, no mesmo volume dos seus dados |

1. Abra o arquivo `.env.example` na mesma pasta. Ele lista todas as configurações com o valor padrão.
2. Copie a linha que você quer para o arquivo `.env`.
3. Mude o valor depois do `=` e salve o arquivo.

```text
PORT=8080
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

O arquivo `.env` guarda dados, não é um script de shell. Marinara não executa `$`, `$(...)` nem outra sintaxe de shell em um valor. Um valor já definido no ambiente do inicializador tem prioridade sobre a mesma entrada do `.env`.

O servidor lê o `.env` não importa como você o inicia. Os inicializadores (`start.bat`, `start.sh`, `start-termux.sh`) também definem `HOST=0.0.0.0`, para que outros dispositivos se conectem, e abrem o navegador quando o servidor fica pronto. `AUTO_OPEN_BROWSER=false` desativa essa abertura. Com o `pnpm start` puro, o servidor escuta só neste computador, a não ser que você defina `HOST`.

<a id="restart-or-hot-reload"></a>

## Reiniciar ou recarregar na hora

Marinara observa o `.env` enquanto está em execução. A maioria das configurações passa a valer quase na hora, sem reiniciar. O log mostra uma linha `[env-watcher]` a cada mudança. Se a observação não conseguir começar, o servidor confere o arquivo a cada 30 segundos e avisa isso no log.

Se as suas edições não forem detectadas, por exemplo quando você edita o arquivo de outra máquina ou dentro de um bind mount de contêiner, defina `MARINARA_ENV_WATCH=poll`. Para desligar a observação, defina `MARINARA_ENV_WATCH=0`. As duas são opções avançadas.

Estas configurações só são lidas na inicialização. Mudar uma delas exige reinício, e o log avisa você:

- `PORT`, `HOST`, `SSL_CERT` e `SSL_KEY`
- `DATA_DIR`, `FILE_STORAGE_DIR` e `ENCRYPTION_KEY`
- `MARINARA_ENV_FILE`, `MARINARA_ENV_WATCH` e `TZ`
- `AUTO_OPEN_BROWSER`, `AUTO_UPDATE_ENABLED` e `AUTO_CREATE_DEFAULT_CONNECTION`
- `LOG_DISABLE_REQUEST_LOGGING` e `LOG_FORMAT`
- `STORAGE_CACHE_WINDOWS_BOOT_ID`, `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` e `SHUTDOWN_FORCE_EXIT_ON_REPEAT`
- As configurações de tempo limite e de consulta de imagem, vídeo, sprite e ComfyUI: `IMAGE_GEN_TIMEOUT_MS`, `IMAGE_GEN_MAX_RESPONSE_BYTES`, `VIDEO_GEN_TIMEOUT_MS`, `VIDEO_GEN_MAX_RESPONSE_BYTES`, `SPRITE_GENERATION_TIMEOUT_MS`, `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS`, `COMFYUI_GEN_TIMEOUT` e as quatro configurações `*_VIDEO_POLL_INTERVAL_MS`

As configurações de controle de acesso e os segredos (`BASIC_AUTH_USER`, `BASIC_AUTH_PASS`, `IP_ALLOWLIST`, `ADMIN_SECRET`, `CSRF_TRUSTED_ORIGINS`) não exigem reinício.

<a id="access-control"></a>

## Controle de acesso

O controle de acesso decide quem pode alcançar um servidor em execução. Para o passo a passo e exemplos, veja [Acesso remoto: login e lista de IPs permitidos](REMOTE_ACCESS.md).

Você também pode definir o login sem o `.env`: use **Settings → Advanced → Access** (Configurações → Avançado → Acesso) em um navegador que já está conectado, ou o código de configuração de uso único do log do servidor. O servidor imprime esse código somente enquanto nenhum login está definido e ele escuta além do loopback. O login é salvo em `DATA_DIR/.remote-login.json`. `node scripts/reset-login.mjs` (executado na pasta do Marinara) remove o login e desconecta todos os navegadores. Um login no `.env` tem prioridade. Mudar ou remover o login exige a senha atual. Para proxies de login, veja [Proxies de login (forward auth)](REMOTE_ACCESS.md#login-proxies-forward-auth).

Termos usados adiante:

- **Loopback**: o próprio computador em que o servidor roda, em `127.0.0.1` ou `localhost`.
- **Faixa CIDR**: uma forma curta de escrever um bloco de endereços IP, como `192.168.1.0/24`.
- **Basic Auth**: um nome de usuário e uma senha enviados a cada requisição. Scripts e clientes de API usam esse método, e os navegadores usam a página `/login`. As credenciais são apenas codificadas, não criptografadas, então use HTTPS em um servidor público.

Sem nenhum login definido, o servidor aceita só origens confiáveis: o loopback, os endereços em `IP_ALLOWLIST`, o Tailscale e o tráfego da ponte do Docker no mesmo host. Todo o resto, inclusive a sua rede doméstica, recebe `403 Forbidden`. Para que outros dispositivos consigam se conectar, o servidor precisa se associar a um endereço acessível: defina `HOST=0.0.0.0`.

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `BASIC_AUTH_USER` | vazio | Nome de usuário do login. Defina junto com `BASIC_AUTH_PASS`. |
| `BASIC_AUTH_PASS` | vazio | Senha do login. Deixe qualquer um dos dois vazio para desligar o login. |
| `BASIC_AUTH_REALM` | `Marinara Engine` | Nome do realm no desafio de Basic Auth. |
| `IP_ALLOWLIST` | vazio | IPs ou faixas CIDR separados por vírgula que têm acesso sempre liberado. O loopback direto é sempre permitido. Um proxy reverso na mesma máquina, não. |
| `IP_ALLOWLIST_ENABLED` | `true` | `false` mantém a lista, mas para de aplicá-la. |
| `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK` | `false` | Permite o acesso sem senha de redes privadas quando nenhum login está definido. Exclui `100.64.0.0/10`, que os provedores de internet compartilham entre clientes. Adicione essa faixa a `TRUSTED_PRIVATE_NETWORKS` somente se você confiar nela. |
| `ALLOW_UNAUTHENTICATED_REMOTE` | `false` | Permite o acesso sem senha de qualquer endereço, inclusive da internet. Não recomendado. |
| `TRUSTED_PRIVATE_NETWORKS` | faixas internas | Substitui as faixas privadas padrão. Inclua os padrões que você ainda quiser manter. |
| `BYPASS_AUTH_TAILSCALE` | automático | Vazio: um dispositivo pula o login somente quando se conecta diretamente ao endereço Tailscale deste computador. Tailscale Serve, Funnel ou outro proxy continuam exigindo login. `true`: liberação antiga de toda a faixa `100.64.0.0/10`. `false`: controle de acesso normal. |
| `BYPASS_AUTH_DOCKER` | automático | Vazio: confia somente em uma interface de contêiner detectada e no gateway dela, e só enquanto nenhum login, `IP_ALLOWLIST` ou `TRUSTED_AUTH_PROXY` estiver definido. `true`: redes antigas ou personalizadas. `false`: controle de acesso normal. |
| `REQUIRE_AUTH_FOR_DOCKER_PROXY` | `true` | Exige o login ou a lista de IPs permitidos para o tráfego do Docker que um proxy repassa. Defina `false` só quando o próprio proxy exigir login de todo visitante. |
| `REQUIRE_AUTH_FOR_LOOPBACK_PROXY` | `true` | Trata como remotas as requisições que um proxy ou túnel na mesma máquina encaminha, inclusive HTTP/1.0, como o `proxy_pass` padrão do nginx. Defina `false` só quando o próprio proxy exigir login de todo visitante. |
| `TRUSTED_AUTH_PROXY` | vazio | IPs ou CIDRs de um proxy de forward auth (tinyauth, Authelia, Authentik, oauth2-proxy) que exige login de todo visitante. As requisições dele pulam o login e `IP_ALLOWLIST`. Ele precisa proteger todos os caminhos, e Marinara não pode estar acessível sem passar por ele. |
| `TRUSTED_HOSTS` | vazio | Nomes de host públicos ou de proxy adicionais que Marinara atende, como `chat.example.com`. IPs diretos, `localhost`, `.local`, `.home.arpa` e nomes de rede local de rótulo único funcionam sem esta variável. Nomes em `CSRF_TRUSTED_ORIGINS` ou `CORS_ORIGINS` também são aceitos. |
| `SSL_CERT` | vazio | Caminho de um certificado TLS. Defina junto com `SSL_KEY` para servir HTTPS diretamente. |
| `SSL_KEY` | vazio | Caminho da chave privada TLS. |
| `CSRF_TRUSTED_ORIGINS` | vazio | Origens de navegador adicionais com permissão para salvar mudanças, para um domínio público ou uma porta fora do comum. O valor literal `null` é ignorado, inclusive para o APK do Android. |

> **Aviso:** uma faixa pública ampla em `IP_ALLOWLIST`, como `0.0.0.0/0`, pode deixar clientes da internet entrarem sem login. Liste apenas endereços em que você confia.

## Armazenamento

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `DATA_DIR` | `packages/server/data` | Pasta raiz de todos os dados do usuário. As imagens Docker definem `/app/data`. |
| `FILE_STORAGE_DIR` | `storage` dentro de `DATA_DIR` | Substitui a pasta de armazenamento de arquivos. |
| `ENCRYPTION_KEY` | vazio | Chave que criptografa as chaves de API salvas. |
| `MARINARA_MAX_RESIDENT_CHATS` | `0` (ilimitado); `8` no SteamOS e no Termux | Número máximo de chats mantidos em memória ao mesmo tempo. Passado o limite, o chat usado menos recentemente e sem alterações não salvas é descartado da memória (nunca do disco) depois de cada salvamento. Um texto inválido volta ao padrão da plataforma. Valores positivos abaixo de `2` viram `2`. `0` desativa o descarte. |
| `MARINARA_EAGER_STORAGE` | desligado | `1` carrega todos os chats na inicialização, como antes da versão 2.4.5. Usa muito mais memória em perfis grandes. Exige reinício. |

Gere uma chave de criptografia e cole-a em `ENCRYPTION_KEY`:

```bash
openssl rand -hex 32
```

Marinara guarda os seus dados como arquivos JSON simples, então você pode copiar e ler os backups. Para saber o que cada pasta guarda, veja [Onde o Marinara guarda os seus dados](data/where-data-is-stored.md).

<a id="logging-levels"></a>

## Níveis de log

`LOG_LEVEL` define quanto o servidor imprime. Ele esconde tudo o que fica abaixo do nível escolhido.

| Nível | O que mostra |
| --- | --- |
| `error` | Só falhas graves. |
| `warn` | Erros e avisos. É o padrão. |
| `info` | Acrescenta os logs de inicialização e de cada requisição. |
| `debug` | Tudo, inclusive os prompts completos e as respostas do modelo. Gera muitas linhas. |

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `LOG_LEVEL` | `warn` | O nível acima. |
| `LOG_PRESET` | `default` | `prompt-connections` mostra o mesmo detalhe de prompt e modelo que `debug`, mas esconde linhas de requisição de rotina, como `GET /api/chats`. |
| `LOG_DISABLE_REQUEST_LOGGING` | `false` | `true` esconde as linhas de requisição de rotina e mantém o seu nível. Exige reinício. |
| `LOG_FORMAT` | automático | `pretty` imprime linhas legíveis em qualquer lugar, por exemplo para ler os prompts do **Debug mode** (modo de depuração) em `docker logs`. `json` imprime um objeto JSON por linha. Exige reinício. |

Em um terminal, o servidor imprime linhas legíveis. Em outros lugares, como os logs do Docker, um servidor de produção imprime linhas JSON. O inicializador do Termux pede linhas legíveis. O log do navegador é separado e não é controlado por `LOG_LEVEL`.

## Tempos limite

Um tempo limite é o máximo que o servidor espera por uma tarefa lenta. Abra **Settings → Advanced → Request timeouts** (Configurações → Avançado → Tempos limite das requisições) para mudar, em segundos, os limites de texto, agentes, prompts de imagem do Game, imagens, vídeos, ComfyUI e embeddings. Limites maiores ajudam backends locais lentos. Eles não podem substituir um limite que o próprio serviço impõe. Para salvar, é preciso ter acesso de administração do servidor.

Essas configurações valem para todos os perfis e são salvas ao lado do `.env` ativo como `.env.timeouts.json` (ou `<custom-env-path>.timeouts.json`). Elas têm prioridade sobre as variáveis correspondentes sem editar o `.env`. Mudanças de texto, agentes, prompts de imagem do Game e embeddings valem para novas requisições. Mudanças de mídia e pacotes de agentes instalados exigem reinício. Para voltar às variáveis, exclua esse arquivo e reinicie.

Os valores são em milissegundos, salvo quando o nome diz outra coisa. Valores inválidos, zerados, negativos ou fora da faixa nos tempos limite validados de chat, de agente e de prompt de imagem do Game geram um aviso no log e usam o padrão. Para saber mais sobre as tarefas de vídeo, veja [Vídeo de cena](media/scene-video.md).

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `CHAT_GENERATION_TIMEOUT_MS` | `300000` (5 min) | Tempo até o primeiro token e intervalo entre pedaços da resposta nas respostas de Conversation, Roleplay e Game. Também é o prazo das tarefas em segundo plano sem tempo limite próprio (Professor Mari, atualização do Noodle, respostas do Slurp). Faixa `10000`-`3600000`. Não altera os tempos limite de agentes, mídia, embeddings ou ferramentas. |
| `AGENT_CALL_TIMEOUT_MS` | `300000` (5 min) | Tempo máximo sem dados antes ou durante uma chamada de modelo feita por um agente, inclusive agentes para download. Os dados recebidos renovam esse prazo. Faixa `10000`-`3600000`. O Illustrator mantém pelo menos o seu prazo interno de 30 minutos de inatividade. |
| `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS` | `45000` (45 s) | Limite de tempo total da chamada ao modelo que transforma uma cena do Game em um prompt de imagem. Faixa `10000`-`3600000`. |
| `EMBEDDING_TIMEOUT_MS` | `300000` (5 min) | Tempo para uma requisição de embedding. |
| `IMAGE_GEN_TIMEOUT_MS` | `1800000` (30 min) | Tempo para uma requisição de geração de imagem. |
| `IMAGE_GEN_MAX_RESPONSE_BYTES` | `31457280` (30 MiB) | Maior resposta de imagem aceita. Aumente quando um ComfyUI local embutir metadados grandes. |
| `VIDEO_GEN_TIMEOUT_MS` | `1800000` (30 min) | Tempo para uma requisição de vídeo de cena, inclusive fluxos de vídeo do ComfyUI. |
| `VIDEO_GEN_MAX_RESPONSE_BYTES` | `167772160` (160 MiB) | Maior download de vídeo de cena aceito. |
| `COMFYUI_GEN_TIMEOUT` | `2400` (40 min, em segundos) | Tempo para um fluxo de imagem do ComfyUI depois de entrar na fila. |
| `SPRITE_GENERATION_TIMEOUT_MS` | `IMAGE_GEN_TIMEOUT_MS` | Tempo para uma tarefa de sprite por IA. |
| `CUSTOM_TOOL_TIMEOUT_MS` | `60000` (1 min) | Tempo para uma chamada de ferramenta personalizada. |
| `MAX_TOOL_ROUNDS` | `100` | Número máximo de rodadas de chamada de ferramenta antes de o modelo ter que responder. Um turno do Game recebe no máximo 4, um agente 16 e um preenchimento retroativo de lorebook 64, ou este valor, se for menor. |

## APIs privilegiadas (ADMIN_SECRET)

Ações destrutivas ou arriscadas, como fazer backup, limpar os dados, aplicar atualizações e instalar temas, exigem um segredo a mais, além das checagens normais de acesso. Você pode criar um em **Settings → Advanced → Admin Access** (Configurações → Avançado → Acesso de administrador) no próprio computador do servidor (veja [Admin Access](REMOTE_ACCESS.md#admin-access-and-privileged-actions)) ou definir um valor longo e aleatório no servidor:

```text
ADMIN_SECRET=replace-this-with-a-long-random-secret
```

No próprio computador do servidor, essas ações costumam funcionar sem o segredo. Uma requisição que um proxy ou túnel nesse computador encaminha conta como remota, a não ser que `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false`. Requisições diretas de outro dispositivo precisam do segredo. Cole o mesmo valor em **Settings → Advanced → Admin Access**, e o aplicativo o envia por você. O `ADMIN_SECRET` do `.env` prevalece sobre um segredo criado no aplicativo. Sem segredo de administrador, as ações privilegiadas falham em todos os dispositivos, menos no próprio computador do servidor, e a mensagem de erro pede que você defina um. Os agentes instalados funcionam em qualquer dispositivo que entrou com o login; instalar, atualizar e remover agentes exige o segredo.

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `ADMIN_SECRET` | vazio | Segredo para ações privilegiadas vindas de dispositivos remotos. |
| `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK` | `false` | `true` exige o segredo também no próprio computador do servidor. |
| `UPDATES_APPLY_ENABLED` | `false` | Permite que o navegador aplique atualizações do mesmo canal (**Apply Update**, aplicar a atualização). Uma troca de canal de versão feita por um navegador no computador do servidor funciona sem esta opção. Só em instalações via Git. |
| `UPDATES_APPLY_DISABLED` | não definido | Recusa toda aplicação de atualizações no servidor, inclusive a troca de canal. Prevalece sobre `UPDATES_APPLY_ENABLED`. Os inicializadores de desenvolvimento e de e2e definem esta variável. |
| `UPDATES_ALLOW_REMOTE_APPLY` | `false` | Permite que um dispositivo remoto aplique atualizações, com um segredo válido. |
| `HAPTICS_ALLOW_REMOTE` | `false` | Permite que um dispositivo remoto execute ações hápticas, com um segredo válido. |
| `CUSTOM_TOOL_SCRIPT_ENABLED` | `false` | Ativa as ferramentas de script personalizadas. Mantenha desligado no caso de ferramentas não confiáveis ou importadas. |
| `MARI_DB_ALLOW_UNSAFE_TRANSFORMS` | `false` | Permite que os scripts de transformação de banco de dados da Professor Mari rodem em hosts sem sandbox do sistema operacional (macOS Seatbelt ou Linux Bubblewrap, usados quando existem). Mantenha desligado, a não ser que você tenha revisado o script. |
| `ENABLE_CUSTOM_AGENT_REPOS` | `false` | Ativa a pré-visualização e a sincronização manual de repositórios de agentes do GitHub no Agent Organizer. Veja [Repositórios de agentes personalizados](#custom-agent-repositories). |
| `MARINARA_OVERWORLD_GAMES` | `false` | Permite que os jogadores criem partidas Overworld (um kit de cenário e um mundo gerado) e transformem uma partida antiga em uma delas. Desligado, o assistente oferece só partidas Classic. |
| `ENABLE_EXTERNAL_EXTENSIONS` | `false` | Primeira das duas travas para importar extensões de terceiros. Veja [Extensões externas](#external-extensions). |
| `IMPORT_ALLOWED_ROOTS` | vazio | Pastas que a importação em massa pode ler sem token de seleção. |
| `PROFILE_EXPORT_JSON_LIMIT_BYTES` | `268435456` (256 MiB) | Maior exportação de perfil em JSON, em um arquivo só, que o servidor monta. |

## Liberação de endereços locais

Por padrão, as requisições de saída para serviços de IA, serviços de imagem e webhooks se recusam a alcançar endereços privados ou locais. Isso bloqueia o SSRF (server-side request forgery), em que uma requisição é enganada para alcançar um endereço interno. Os servidores de modelo em loopback continuam funcionando. Ative só a opção de que você precisa para um serviço hospedado por você em outra máquina da rede privada.

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `PROVIDER_LOCAL_URLS_ENABLED` | `false` | URLs de serviços de IA podem alcançar endereços privados ou da rede local. Vem ativado por padrão no Android. |
| `IMAGE_LOCAL_URLS_ENABLED` | `false` | URLs de serviços de imagem podem alcançar endereços privados ou da rede local. As URLs privadas de resultado ainda precisam bater com a origem exata do serviço. |
| `TTS_LOCAL_URLS_ENABLED` | `false` | URLs de conversão de texto em voz podem alcançar endereços privados ou da rede local. |
| `STT_LOCAL_URLS_ENABLED` | `false` | A URL do servidor de Speech to text pode alcançar endereços privados ou da rede local. Um servidor na mesma máquina funciona sem isso. |
| `DEEPLX_LOCAL_URLS_ENABLED` | `false` | URLs de tradução DeepLX podem alcançar endereços privados ou da rede local. |
| `WEBHOOK_LOCAL_URLS_ENABLED` | `false` | Webhooks de ferramentas personalizadas podem alcançar endereços privados ou da rede local. |

Para conectar um modelo local ou auto-hospedado, veja [Conectar um modelo local ou auto-hospedado](connections/local-self-hosted.md).

<a id="feature-switches"></a>

## Chaves de recursos

Comportamentos opcionais do servidor, como repetir chamadas de provedor que falharam ou manter estáveis as seleções de grupos do lorebook, ficam em **Settings → Advanced → Features** (Configurações → Avançado → Recursos). Todos vêm desligados por padrão. Alguns têm uma variável que, quando definida, prevalece sobre a chave. Veja [Chaves de recursos](configuration/features.md).

<a id="marinara-notices"></a>

## Avisos do Marinara

Os avisos são alertas curtos dos mantenedores, por exemplo sobre um problema de segurança ou um passo manual de que a sua versão precisa. Eles aparecem como um banner.

- Na inicialização e depois a cada hora, o servidor baixa um arquivo pequeno, `notices.json`, da branch `notices` do repositório do Marinara Engine. Ele guarda apenas os avisos que citam a sua versão. O seu navegador pede esses avisos ao seu próprio servidor uma vez quando a página carrega e depois a cada hora.
- Se um download falhar, o servidor mantém os avisos que já tem e a inicialização não atrasa.
- A requisição não envia dados sobre você, os seus chats ou as suas configurações. Só os mantenedores podem alterar a branch `notices`, e cada alteração passa por revisão.
- Um aviso é texto simples, com limite de tamanho. Os links só são mantidos quando apontam para `https://github.com/Pasta-Devs/`. Um aviso não pode instalar, executar nem alterar nada.
- Só você vê os avisos: no próprio computador do servidor, a partir de um endereço em `IP_ALLOWLIST` ou depois de entrar com o seu login. Os outros visitantes recebem uma lista vazia.

Para desativar os avisos, defina `MARINARA_NOTICES_ENABLED=false`.

> **Aviso:** com os avisos desativados, Marinara não pode informar você sobre correções de segurança ou passos necessários. Acompanhe você mesmo as [versões no GitHub](https://github.com/Pasta-Devs/Marinara-Engine/releases).

Forks podem apontar `MARINARA_NOTICES_URL` para o próprio arquivo.

<a id="optional-multiplayer"></a>

## Multijogador opcional

O multijogador vem desativado por padrão. Ele permite que pessoas compartilhem uma sala privada de Conversation, Roleplay ou Game sem limite fixo de participantes. Cada convidado usa o próprio Marinara confiável. Os convidados não precisam de conta de IA. O anfitrião fornece as contas de IA e pode ler e guardar o conteúdo compartilhado. Enquanto qualquer uma das duas travas estiver desligada, Marinara não faz verificações de sessão, de certificado ou de pares em segundo plano.

1. Defina `MULTIPLAYER_ENABLED=true` no `.env` de cada Marinara participante e reinicie-o. Só o valor exato `true` funciona, e a recarga na hora não o aplica.
2. Abra **Settings → Advanced → Multiplayer** (Configurações → Avançado → Multijogador), leia o aviso e ative a configuração. Isso não abre uma porta de escuta nem entra em uma sala.
3. Para hospedar, use **Create shared session** (criar sessão compartilhada) ou **Play together** (jogar juntos) no fluxo de modo ou de configuração. Revise a configuração, o seu nome de exibição e o texto da persona que você compartilha. Um chat existente compartilha só as escolhas de configuração, nunca o histórico, as notas ou as memórias.
4. No anfitrião, defina `SSL_CERT` e `SSL_KEY` com um certificado válido para o hostname da sala e confiável para os convidados. Escolha um endereço HTTPS e uma porta separados para a sala, como `https://room.example.org:7861`. A ação de hospedar abre essa porta. Libere no firewall ou no roteador apenas a porta da sala. Não exponha a API normal do Marinara. Marinara não configura encaminhamento de portas, retransmissão nem desvio de certificado por você.
5. Defina uma senha de sala com pelo menos 12 caracteres, diferente das suas credenciais de administrador. Envie o convite com validade e a senha separadamente para pessoas em quem você confia. O convidado confere a impressão digital do hostname, o nome da sala e o texto da persona e então pede para entrar. O anfitrião aprova cada pedido em **Players** (jogadores) antes de qualquer histórico ser enviado.

Limites e comportamento:

- O TLS confere a cadeia do certificado e o hostname, além da impressão digital do certificado no convite, antes de enviar uma senha. Certificados autoassinados não são aceitos silenciosamente. Um certificado renovado exige um novo convite.
- Os convites expiram em 30 minutos. As sessões admitidas duram no máximo 12 horas. Substituir ou revogar invalida os convites não usados. **Kick** (expulsar) remove um convidado admitido.
- O anfitrião controla as respostas automáticas ou manuais, **Pause**/**Resume** (pausar/retomar) e **Stop** (parar). O limite padrão é de 100 turnos de geração coordenada por sessão hospedada. Um turno de grupo ou a configuração do Game pode fazer mais de uma chamada ao modelo. É um limite de turnos, não uma estimativa de preço.
- No Game, revise o grupo antes de **Start Game** (iniciar o jogo). Cada jogador necessário envia uma ação ou passa, e o GM resolve quando todos estão prontos. Um jogador desconectado continua necessário até voltar ou até o anfitrião passar a vez dele ou removê-lo. Rodadas pausadas ou interrompidas nunca repetem sozinhas uma requisição paga nem efeitos do mundo já gravados.
- **Stop**, **Leave** (sair), desativar a configuração e reiniciar o servidor encerram a sessão ativa. Um reinício nunca hospeda nem entra em uma sala sozinho.
- Ferramentas personalizadas e de pacotes e comandos inseguros continuam indisponíveis nas salas. Os convidados nunca executam um agendador nem comandos locais a partir do texto recebido. As agendas de Conversation usam o agendador do anfitrião.
- Novos jogadores e mudanças de persona valem a partir da rodada seguinte.
- As salas transmitem só texto de tamanho limitado. Não há transferência de arquivos, mídia, extensões ou pacotes. O wrapper nativo do Android não pode entrar.

> **Aviso:** conecte-se apenas a pessoas em quem você confia e use o seu próprio cliente Marinara. Nunca instale um cliente, uma extensão ou um arquivo fornecido pelo anfitrião. O anfitrião pode ler o que você compartilha, e o conteúdo compartilhado pode ir para os serviços de IA dele. Conexões diretas revelam endereços de rede. Não compartilhe senhas, chaves de API ou informações pessoais. Saia na hora se algo parecer errado.

Para as restrições exatas e as plataformas testadas, veja o [registro de compatibilidade e verificação](development/multiplayer.md). Para problemas, veja [Solução de problemas](TROUBLESHOOTING.md#multiplayer-connection-or-turn-problems).

## Agentes e extensões

Instale os agentes oficiais opcionais dentro do aplicativo: **Agents → Agent Organizer** (Agentes → Organizador de agentes). Marinara escolhe o catálogo [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) que corresponde à sua versão principal.

- **Atualizações:** Marinara pergunta antes de baixar uma versão nova de um pacote instalado. **Not now** (agora não) mantém a versão atual e deixa o botão **Update** (atualizar) no Agent Organizer. Uma instalação nova não tem pacotes.
- **Onde os pacotes ficam:** `DATA_DIR/capability-packages`. Volumes do Docker, pastas de dados personalizadas, backups e atualizações normais preservam esses pacotes. Isso vale para o computador, o Docker e o Termux. O iOS e outros navegadores usam os pacotes do servidor que os hospeda.
- **Uso de disco:** Marinara mantém a versão atual e a anterior de cada pacote e exclui as versões mais antigas e as cópias temporárias em `DATA_DIR/capability-runtime-snapshots`. Os dados dos pacotes nunca são excluídos.
- **Offline:** os pacotes instalados continuam funcionando na versão em que estão quando o GitHub está inacessível, quando uma atualização é recusada ou quando a verificação falha.

### Importação de agentes personalizados

Arquivos, pastas e repositórios externos de agentes vêm bloqueados. Para liberá-los, ative **Allow custom Agent imports** (permitir importações de agentes personalizados) em **Settings → Advanced → Danger Zone** (Configurações → Avançado → Zona de perigo). Isso não exige variável de ambiente. Os controles de importação ficam cinza até você ativar a opção.

Toda importação mostra primeiro as capacidades que o agente solicita. As permissões precisam de aprovação explícita. Funções embutidas e seleções de ferramentas não são importadas, o CSS gerado passa por limpeza e as ações de resultado são conferidas com base nas capacidades aprovadas. Desligar a trava faz os agentes importados pararem. Os agentes criados no Marinara e os pacotes oficiais não são afetados.

<a id="custom-agent-repositories"></a>

### Repositórios de agentes personalizados

Os repositórios vêm desativados por padrão, porque os prompts e as ferramentas deles não passam por revisão. Defina `ENABLE_CUSTOM_AGENT_REPOS=true`, ative **Allow custom Agent imports** e abra **Agents → Agent Organizer → Custom Sources** (Agentes → Organizador de agentes → Fontes personalizadas) para pré-visualizar um repositório público do GitHub. Adicionar uma fonte e aplicar mudanças posteriores exigem confirmação. A sincronização é manual, e Marinara nunca clona nem consulta repositórios em segundo plano. Apenas URLs da raiz de repositórios do GitHub são aceitas.

Um repositório publica agentes, conjuntos de regras de Game Mode ou ambos. Na raiz:

- `agents.json` é um array no formato de agentes para download:

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

- `rulesets` contém um conjunto de regras por arquivo `.json`, até 32 arquivos de 512 KB. Só os arquivos que ficam diretamente dentro dessa pasta são lidos. A prévia lista o nome, a versão e a cobertura de cada conjunto. O texto de Game Master de um conjunto vai para o modelo em toda partida que o usa, então instale apenas conjuntos de pessoas em quem você confia.

Os conjuntos importados recebem o nome do dono do repositório, como `alice/my-5e`, então nunca tomam um nome oficial. Toda versão é mantida, e uma partida roda na versão exata com que começou. Se a mesma versão chegar com conteúdo diferente, Marinara mantém a instalada e avisa para você pedir ao autor que aumente o número da versão. Um arquivo que Marinara não consegue ler aparece na lista com o motivo e é ignorado.

Na sincronização, os valores remotos de prompt, configurações e ferramentas substituem os valores gerenciados pelo repositório que aparecem na prévia. As suas escolhas de conta e de imagens continuam locais. Se um agente sumir da origem, ele continua como um agente local comum e perde só o vínculo com o repositório. Remover uma fonte funciona do mesmo jeito, e os conjuntos de regras dela continuam instalados.

Agentes personalizados também podem ativar **Previous output** (saída anterior) em Context Sources para ler a própria última saída bem-sucedida. Com **JSON context output** (saída de contexto em JSON), retorne `{"text":"main prompt content","agent-context":"private continuation context"}`. Apenas `text` entra no prompt principal. **Hide output as spoilers** (ocultar a saída como spoiler) mantém as saídas salvas recolhidas. As regenerações deixam de fora o turno substituído, e mensagens excluídas ou swipes inativos não podem fornecer contexto.

<a id="external-extensions"></a>

### Extensões externas

A importação de extensões de terceiros exige dois consentimentos. A variável de ambiente é a permissão de quem opera o servidor. O botão liga/desliga da Danger Zone é a aceitação do usuário.

1. Defina `ENABLE_EXTERNAL_EXTENSIONS=true` no `.env`.
2. Abra **Settings → Advanced → Danger Zone**, role para baixo até passar dos controles de exclusão de dados, leia o aviso e ative **Allow third-party extension imports** (permitir a importação de extensões de terceiros).

Então a seção **External Extensions** (extensões externas) aparece em **Settings → Addons** (Configurações → Complementos). Fechar qualquer uma das travas desativa os registros externos e para o código deles. Registros salvos manualmente, antigos, importados de um perfil ou de origem desconhecida contam como externos, então largar arquivos em uma pasta não burla as travas. Os rascunhos da Professor Mari não precisam de nenhuma das travas. Eles começam desativados e exigem aprovação do hash exato do código.

As Sandboxed Browser Extensions (extensões de navegador isoladas) são o padrão. Alguns pacotes mais antigos mostram **Full page access** (acesso à página inteira), porque precisam da página do Marinara. Esse modo roda o código aprovado na página do Marinara, com acesso ao conteúdo da página, ao armazenamento do navegador, às APIs de rede e à sua sessão. Ele só existe para as External Extensions com as duas travas abertas e exige uma confirmação de aviso separada. Recarregue a página depois de desativá-lo.

## Referência completa das variáveis de ambiente

As tabelas anteriores cobrem controle de acesso, armazenamento, log, tempos limite, ações privilegiadas e liberação de endereços locais. As demais estão aqui.

### Servidor e inicialização

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `PORT` | `7860` | A porta em que o servidor escuta. Use o mesmo valor no Android, no Docker e no Termux. |
| `HOST` | `127.0.0.1` (`0.0.0.0` nos inicializadores e nas imagens Docker) | A interface de rede a que o servidor se associa. Use `0.0.0.0` para acesso pela rede local. O arquivo Compose padrão publica a porta do Docker apenas em `127.0.0.1`. |
| `MARINARA_ANDROID_SECRET` | vazio | Segredo interno para instalações do Termux gerenciadas pelo APK. O aplicativo Android o cria e o inicializador do Termux o exporta. Nunca peça aos usuários que o definam. Precisa ter exatamente 64 caracteres hexadecimais. Um valor inválido e não vazio faz as requisições locais do dispositivo falharem com HTTP 503. |
| `MARINARA_ANDROID_SECRET_FILE` | `~/.marinara-engine/android-secret` | Arquivo de segredo usado pelo inicializador do Termux e pelo comando local `mari`. O APK e o inicializador gerenciam esse arquivo. |
| `AUTO_OPEN_BROWSER` | `true` | Define se os inicializadores abrem a URL do aplicativo. `false` desativa isso. A configuração gerenciada pelo APK desliga essa opção. |
| `AUTO_UPDATE_ENABLED` | `true` | Define se os inicializadores baseados em Git buscam e aplicam atualizações antes de iniciar. `false` desliga isso a partir do próximo início. O inicializador ainda faz uma checagem somente leitura de versões publicadas mais novas e imprime um lembrete. `--skip-update` pula as duas checagens em um único início. |
| `MARINARA_NOTICES_ENABLED` | `true` | Define se o servidor busca os avisos dos mantenedores. Veja [Avisos do Marinara](#marinara-notices). |
| `MARINARA_NOTICES_URL` | `notices.json` na branch `notices` | Substitui o arquivo de avisos, para forks e espelhos. O arquivo é validado do mesmo jeito, e links fora de `https://github.com/Pasta-Devs/` são descartados. |
| `MARINARA_ENV_FILE` | o `.env` na raiz do projeto | Caminho alternativo para o arquivo `.env`. Defina antes de iniciar. |
| `MARINARA_MEDIA_GENERATION_CONCURRENCY` | `4` | Número máximo de requisições de imagem ou vídeo ao mesmo tempo, no servidor inteiro. Diminua para 1-2 se um ComfyUI ou SwarmUI local ficar sem VRAM. `0` remove o teto. Valores inválidos são ignorados com um aviso. Tarefas em lote nunca ocupam a última vaga. Funciona além da opção **Queue media generation requests** (enfileirar requisições de geração de mídia), em **Settings → Generations → Overall Generations** (Configurações → Gerações → Gerações em geral), ligada por padrão, que enfileira as tarefas de imagem e de vídeo por conta. |
| `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS` | `600000` (10 min) | Quanto tempo uma requisição espera por uma vaga livre antes de falhar. `0` espera para sempre. |
| `MARINARA_SHARED_GPU_HOSTS` | vazio | Lista de `host:port` separados por vírgula para uma GPU compartilhada por um modelo local e um backend local de imagem ou vídeo, como o llama-swap. As requisições de texto e de mídia a um host da lista se alternam, para que uma imagem não espere para sempre atrás das respostas do chat. Uma imagem ou um clipe espera no máximo `MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS`. Os embeddings não ficam em espera. Vale para novas requisições sem reiniciar. |
| `MARINARA_ENV_WATCH` | `1` | Como o `.env` é observado. Padrão: eventos de mudança (com espera de cerca de 250 ms), com a checagem a cada 30 segundos como alternativa. `poll`: sempre a checagem de 30 segundos. `0`: desligado. Veja [Reiniciar ou recarregar na hora](#restart-or-hot-reload). |
| `TZ` | padrão do sistema | Fuso horário de reserva do host para as tarefas do servidor, como `Europe/Warsaw`. Deixe sem valor ou vazio para usar o fuso horário do host. Um **Schedule timezone** (fuso horário da agenda) salvo no Conversation tem prioridade para as agendas. |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Origens de navegador com permissão para fazer requisições entre origens diferentes. |
| `AUTO_CREATE_DEFAULT_CONNECTION` | `true` | Opção antiga. As versões atuais não trazem chave inicial embutida, então isso não cria nada. Adicione a sua própria conta dentro do aplicativo. |

O **Schedule timezone** usa por padrão o fuso horário do seu dispositivo. Você pode mudá-lo durante a configuração do Conversation, nas Chat Settings (configurações do chat) do Conversation ou no editor de agenda do personagem. É uma configuração global única, compartilhada por todos os chats de Conversation e sincronizada com os outros clientes do mesmo servidor.

### Ferramentas de mídia e de sprite

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `FFMPEG_PATH` | vazio | Caminho do `ffmpeg`, usado nos GIFs de expressão animada. Na falta dele, vale o `ffmpeg` do seu PATH. |
| `SPRITE_ANIMATED_FFMPEG_TIMEOUT_MS` | `180000` (3 min) | Tempo para converter um clipe de expressão animada. |
| `SPRITE_BACKGROUND_REMOVAL_ENGINE` | `auto` | `auto` tenta a limpeza embutida e depois a ferramenta de IA opcional. `builtin` usa só a limpeza embutida. `backgroundremover` força a ferramenta de IA. |
| `BACKGROUNDREMOVER_AUTO_INSTALL` | `false` | `true` instala o removedor de plano de fundo por IA, que é opcional, ao iniciar. |
| `BACKGROUNDREMOVER_COMMAND` | vazio | Caminho de um programa `backgroundremover` do sistema. |
| `BACKGROUNDREMOVER_PYTHON` | vazio | Caminho de um Python em que `backgroundremover` está instalado. |
| `BACKGROUNDREMOVER_TIMEOUT_MS` | `600000` (10 min) | Tempo para uma chamada de remoção de plano de fundo por IA. |

### Provedores de vídeo de cena

As contas de vídeo são configuradas dentro do aplicativo. Estas configurações apenas ajustam as tarefas. Os valores são em milissegundos.

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `GOOGLE_VEO_VIDEO_POLL_INTERVAL_MS` | `10000` | De quanto em quanto tempo o servidor consulta uma tarefa do Google Veo. |
| `XAI_VIDEO_POLL_INTERVAL_MS` | `5000` | De quanto em quanto tempo ele consulta uma tarefa do xAI Imagine. |
| `OPENROUTER_VIDEO_POLL_INTERVAL_MS` | `10000` | De quanto em quanto tempo ele consulta uma tarefa de vídeo do OpenRouter. |
| `SEEDANCE_VIDEO_POLL_INTERVAL_MS` | `10000` | De quanto em quanto tempo ele consulta uma tarefa do Seedance. |
| `VIDEO_REFERENCE_PUBLIC_BASE_URL` | vazio | Endereço HTTPS público deste servidor, para serviços que precisam buscar uma imagem de referência por URL. |

<a id="lorebooks"></a>

### Lorebooks

As duas vêm desligadas por padrão e valem na próxima geração depois de uma mudança no `.env`. Quando `LOREBOOK_STABLE_GROUP_WINNERS` está definida, ela prevalece sobre a chave **Stable lorebook picks** (seleções estáveis de lorebook) em **Settings → Advanced → Features**. Caso contrário, a chave decide. Veja [Chaves de recursos](configuration/features.md).

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `LOREBOOK_STABLE_GROUP_WINNERS` | `false` | Mantém o mesmo vencedor do grupo de inclusão por chat enquanto os candidatos continuarem os mesmos, em vez de sortear de novo a cada geração. Mantém o início do prompt estável para o cache de prompt do provedor. |
| `LOREBOOK_COMPACT_STORED_SCANS` | `false` | Guarda o texto completo das entradas ativadas só na mensagem mais recente do assistente ou do narrador. As mensagens antigas mantêm os IDs, as chaves e as pontuações das entradas. Deixa muito menores os chats com lorebooks grandes. Se mensagens mais novas forem excluídas, Active Context e as novas tentativas de agentes mostram o texto atual da entrada para a mensagem que volta a ser a mais recente. |

`scripts/compact-lorebook-scans.mjs` aplica a mesma regra aos chats mais antigos. Pare o servidor primeiro. O script só faz uma simulação, a não ser que você passe `--apply`, e faz backup das duas tabelas de mensagens antes de gravar.

<a id="robustness"></a>

### Robustez

Todas vêm desligadas por padrão, o que mantém o comportamento antigo. `STORAGE_CACHE_WINDOWS_BOOT_ID`, `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` e `SHUTDOWN_FORCE_EXIT_ON_REPEAT` exigem reinício. As demais valem depois de uma mudança no `.env`. Quando `PROVIDER_RETRY_TRANSIENT_ERRORS` está definida, ela prevalece sobre a chave **Retry failed provider calls** (repetir chamadas de provedor que falharam) em **Settings → Advanced → Features**. Caso contrário, a chave decide.

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | `false` | Repete uma conexão recusada ou inacessível, ou um erro 502 ou 503, até duas vezes, com espera de no máximo 5 s, e só antes de algum texto chegar até você. Um 504 ou uma conexão interrompida nunca é repetido. Não é usado quando a conta tem um fallback, que é tentado na hora. Um host que falha devagar pode atrasar o erro em cerca de 20 s. |
| `STORAGE_SKIP_UNCHANGED_WRITES` | `false` | Um salvamento deixa de reescrever um arquivo de chat ou `manifest.json` quando o conteúdo é igual ao último que este servidor gravou e o arquivo no disco não mudou. Um arquivo recém-restaurado do `.bak` é sempre reescrito. |
| `STORAGE_YIELDING_SERIALIZE` | `false` | Prepara arquivos grandes de chat para salvar em fatias curtas, para que salvar um chat muito longo não pause outras requisições. Os bytes gravados são os mesmos. |
| `STORAGE_CACHE_WINDOWS_BOOT_ID` | `false` | Somente Windows. Memoriza, até a próxima reinicialização do sistema, a verificação do horário de boot que o bloqueio de armazenamento faz a cada início (cerca de 1,5 a 2 s de PowerShell), em `.writer-boot-id.json` dentro de `DATA_DIR`. |
| `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS` | `false` | Somente Windows. <kbd>Ctrl</kbd>+<kbd>Break</kbd> e fechar o console também param o servidor corretamente e gravam os salvamentos pendentes. O fechamento do console usa prazos menores para caber nos cerca de 5 s que o Windows permite. |
| `SHUTDOWN_FORCE_EXIT_ON_REPEAT` | `false` | Pressionar <kbd>Ctrl</kbd>+<kbd>C</kbd> ou <kbd>Ctrl</kbd>+<kbd>Break</kbd> de novo mais de 1,5 s depois da primeira vez encerra o servidor na hora. Salvamentos não gravados podem ser perdidos. Sem isso, as repetições são ignoradas e vale o limite de encerramento de 8 s. |
| `SHUTDOWN_EARLY_FLUSH` | `false` | Começa a gravar os salvamentos pendentes quando chega um sinal de parada, enquanto as conexões ainda estão fechando. O reinício em Advanced Settings não usa isso. |
| `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` | `0` | Quanto tempo um sinal de parada espera pelos runtimes em segundo plano (pacotes, extensões, modelo embutido) antes de fechar o armazenamento. `0` espera todos eles. No máximo `2500`, para que o armazenamento feche dentro do limite de 8 s. O reinício em Advanced Settings continua esperando todos. |

### Integrações e extras

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `CLAUDE_SUBSCRIPTION_USE_INSTALLED_CLI` | `true` | Define se as contas **Claude (Subscription)** usam o Claude Code deste computador quando ele é pelo menos tão novo quanto a cópia incluída. O Android não tem cópia incluída e precisa desta opção ativada. `false` usa sempre a cópia incluída. Passa a valer em até cinco minutos. |
| `DOCS_I18N_BASE_URL` | a branch `docs-i18n` oficial | De onde os pacotes de idioma da documentação e da interface são baixados. Os pacotes da interface usam a subárvore `ui/`. Precisa ser um host público `https://`. |
| `GIPHY_API_KEY` | vazio | Chave do Giphy para a busca de GIFs no modo Conversation. A busca fica desligada até você defini-la e reiniciar. |
| `INTIFACE_URL` | `ws://127.0.0.1:12345` | Endereço padrão do aplicativo háptico Intiface. |
| `SPOTIFY_REDIRECT_URI` | derivado da requisição | Substitui o retorno do login do Spotify. Defina quando o TLS terminar antes do servidor. |
| `MARI_WIKI_CONTENT_MAX_BYTES` | `50000` | Maior conteúdo de página de wiki que a Professor Mari lê antes de cortar. |
| `MARI_WIKI_REQUEST_TIMEOUT_MS` | `30000` | Tempo para uma requisição de wiki feita pela Professor Mari. |
| `MARI_WIKI_CACHE_TTL_MS` | `300000` | Por quanto tempo a Professor Mari guarda em cache uma leitura de wiki. |
| `SIDECAR_RUNTIME_INSTALL_ENABLED` | `false` (o inicializador do Windows define `true`) | Permite instalar o runtime do **Built-in model** (modelo embutido) sem cabeçalho de administrador no loopback. |

Sobre o **Built-in model**, veja [Como configurar o Built-in model](connections/local-model.md).

<a id="outbound-http-proxy"></a>

### Proxy HTTP de saída

Algumas redes só chegam à internet por um proxy HTTP, por exemplo o v2rayN sem o modo TUN. Marinara pode enviar por esse proxy as requisições aos serviços de IA, aos serviços de imagem, aos servidores de embedding e ao catálogo de agentes. Defina estas variáveis no ambiente que inicia Marinara ou no `.env` e depois reinicie.

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `NODE_USE_ENV_PROXY` | não definido | `1` ativa o proxy. Sem isso, Marinara ignora as configurações de proxy, como o Node.js faz. |
| `HTTP_PROXY` | vazio | Endereço do proxy, como `http://127.0.0.1:10809`. Usado em toda requisição quando `HTTPS_PROXY` não está definido. |
| `HTTPS_PROXY` | vazio | Proxy para endereços `https://`, quando for diferente de `HTTP_PROXY`. |
| `NO_PROXY` | vazio | Hosts separados por vírgula que não passam pelo proxy. Adicione os servidores de modelo da sua rede. `localhost`, `127.0.0.1` e `::1` sempre ficam fora do proxy. |

## Guias relacionados

- [Chaves de recursos](configuration/features.md)
- [Acesso remoto: login e lista de IPs permitidos](REMOTE_ACCESS.md)
- [Onde o Marinara guarda os seus dados](data/where-data-is-stored.md)
- [Conectando a um provedor de IA](connections/connecting-to-a-provider.md)
- [Vídeo de cena](media/scene-video.md)
- [Solução de problemas do Marinara Engine](TROUBLESHOOTING.md)
