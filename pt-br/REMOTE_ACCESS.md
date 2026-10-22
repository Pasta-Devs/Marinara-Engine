# Acesso remoto: Basic Auth e lista de IPs permitidos

Neste guia você aprende a acessar Marinara Engine a partir de outro dispositivo, como o celular, um notebook ou um contêiner Docker. Ele explica as duas opções principais: Basic Auth e a lista de IPs permitidos. Também trata da liberação para redes privadas, do HTTPS, do Admin Access e da mensagem de bloqueio ao salvar (CSRF). Quase tudo aqui é configurado no arquivo `.env` do servidor, e não dentro do aplicativo.

Um rápido glossário para acompanhar o guia:

- Arquivo `.env`: um arquivo de configurações em texto simples, na pasta do Marinara Engine, ao lado do arquivo `package.json`.
- Loopback: a própria máquina que está rodando o servidor. O endereço dela é `127.0.0.1` ou `localhost`.
- Acesso remoto: abrir Marinara em qualquer dispositivo que NÃO seja a máquina que roda o servidor.

## O que Marinara bloqueia por padrão

Para proteger os seus dados, uma instalação nova do Marinara recusa conexões de outros dispositivos até você configurar o controle de acesso. Por padrão, só três tipos de cliente são confiáveis:

1. Loopback (`127.0.0.1` ou `::1`), a própria máquina que roda o servidor. Os visitantes que um proxy reverso ou túnel na mesma máquina repassa não contam; veja [Proxies reversos e túneis no mesmo computador](#reverse-proxies-and-tunnels-on-the-same-computer).
2. Dispositivos Tailscale da sua tailnet. Tailscale é uma ferramenta de rede privada, e os endereços dela usam a faixa `100.64.0.0/10`.
3. Clientes Docker no mesmo host. Marinara reconhece a faixa de bridge usual `172.16.0.0/12` e o gateway padrão exato do contêiner, o que cobre também o Docker Desktop e faixas de endereços personalizadas.

Todo o resto, como o celular na mesma rede Wi-Fi ou um cliente vindo da internet pública, fica bloqueado até você escolher uma das opções abaixo. Um dispositivo bloqueado que abre Marinara no navegador vê uma página escura de configuração. O título dela diz **This Marinara Engine install needs access control before remote devices can connect.** A página mostra o IP do próprio dispositivo e dois trechos do arquivo `.env` prontos para copiar e colar.

Se você não fizer nada e nunca definir uma senha, Marinara continua restrito a essas três origens confiáveis. Esse é o padrão seguro.

## Onde fica o arquivo .env

Todas as configurações de acesso ficam no arquivo `.env`, na raiz do projeto, ao lado do arquivo `package.json`. Se você ainda não tem um, copie o exemplo:

```bash
cp .env.example .env
```

Abra o arquivo `.env` em qualquer editor de texto. A maioria das configurações de acesso, incluindo Basic Auth, a lista de IPs permitidos, o segredo de administrador e as origens de CSRF, entra em vigor em poucos segundos, sem reiniciar. Algumas configurações de baixo nível ainda precisam de reinício, entre elas a variável `PORT`, a variável `HOST` e os caminhos dos certificados HTTPS.

Pode acontecer de outros dispositivos não alcançarem o servidor de jeito nenhum, com um tempo limite em vez de um 403. Nesse caso, o servidor talvez esteja escutando só na máquina local. Configure o servidor para escutar em todas as interfaces de rede:

```env
HOST=0.0.0.0
```

O endereço de bind padrão depende de como você inicia o Marinara:

| Forma de iniciar | Padrão de `HOST` |
| --- | --- |
| `pnpm start`, `start-local.bat` | `127.0.0.1` |
| `start.sh`, `start.bat`, instalador do Windows, `start-termux.sh` | `0.0.0.0` |
| Imagem Docker | `0.0.0.0` dentro do contêiner |
| `docker-compose.yml` | Publica a porta somente em `127.0.0.1` |

## Qual opção escolher

Leia os itens na ordem e pare no primeiro que corresponder ao seu caso.

1. Você só se conecta pelo Tailscale, ou só a partir de contêineres Docker no mesmo host. Não precisa fazer nada. Já funciona.
2. Você quer acessar Marinara pelo celular, tablet ou notebook na rede Wi-Fi de casa. Use Basic Auth (Opção 1, abaixo).
3. Você está expondo Marinara à internet pública. Use Basic Auth com HTTPS.
4. Os dispositivos clientes têm endereços IP fixos e você prefere não digitar senha. Use a lista de IPs permitidos (Opção 2, abaixo).
5. Toda a sua rede é confiável e você nunca quer senha. Use a liberação para redes privadas (Opção 3, abaixo). Leia primeiro o aviso que está lá.

Basic Auth é a escolha mais flexível. Funciona a partir de qualquer IP, não exige configuração em cada dispositivo, e o navegador guarda o login.

## Opção 1: Basic Auth (recomendada)

Basic Auth significa que o navegador pede um nome de usuário e uma senha antes de liberar o acesso. Para ativar, acrescente duas linhas ao arquivo `.env`:

```env
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

Escolha uma senha forte e exclusiva. Basic Auth envia o login em toda requisição, então trate essa senha como a de qualquer outra conta. É possível gerar uma senha aleatória:

```bash
openssl rand -base64 24
```

Salve o arquivo `.env`. A mudança entra em vigor em poucos segundos, sem reiniciar. Depois, siga estes passos no dispositivo remoto.

1. Abra Marinara no navegador usando o endereço do servidor, por exemplo `http://192.168.1.50:7860`.
2. Digite o nome de usuário e a senha que você definiu quando o navegador pedir.
3. O aplicativo deve carregar. O navegador guarda o login pelo resto da sessão.

Depois de 10 senhas erradas diferentes em 15 minutos, Marinara recusa logins desse endereço com **429 Too Many Requests** (muitas requisições) até os 15 minutos acabarem. Uma senha correta antes disso zera a contagem. Os visitantes que um proxy reverso ou túnel no host repassa compartilham uma única contagem, e o login de um deles não a zera. Reiniciar o servidor também zera a contagem. Um navegador que já entrou antes continua entrando com a senha correta, então as senhas erradas de outras pessoas não podem bloquear você em um dispositivo que você já usa.

Por padrão, o aviso do navegador mostra **Marinara Engine**. Esse texto pode ser alterado com a variável `BASIC_AUTH_REALM`.

Alguns clientes pulam a senha mesmo com Basic Auth ativo:

- Loopback (`127.0.0.1`, `::1`), então você nunca precisa de senha na própria máquina do servidor. Os visitantes que um proxy reverso ou túnel nessa máquina repassa continuam precisando dela.
- Qualquer endereço na variável `IP_ALLOWLIST`. Atenção: definir uma lista de IPs permitidos também bloqueia todos os endereços que não estiverem nela (veja a Opção 2).
- O tráfego direto do Tailscale (`100.64.0.0/10`), a menos que você desative a liberação dele.
- O tráfego de bridge/gateway do Docker, só quando você define `BYPASS_AUTH_DOCKER=true`. Com Basic Auth ativo, a confiança automática no Docker fica desligada (veja [Liberação para Tailscale e Docker](#tailscale-and-docker-bypass)).
- O endereço `/api/health`, para que os monitores de disponibilidade continuem funcionando. Quem não puder abrir o app recebe só `{"status": "ok"}`; os detalhes de versão, sistema e modelos ficam neste computador, nas redes confiáveis e nos navegadores com sessão iniciada.

Importante: Basic Auth apenas codifica a senha. Não criptografa. Quem estiver observando uma conexão sem criptografia consegue ler a senha. Se você expõe Marinara à internet pública, combine Basic Auth com HTTPS (veja abaixo).

## Opção 2: lista de IPs permitidos

A lista de IPs permitidos libera endereços específicos sem senha. É uma boa opção quando os dispositivos têm endereços IP estáveis. Defina uma lista de endereços ou faixas separados por vírgula:

```env
IP_ALLOWLIST=192.168.1.0/24,203.0.113.42
```

O `/24` do exemplo é notação CIDR. CIDR é uma forma curta de escrever uma faixa inteira de endereços em uma única entrada. Por exemplo, `192.168.1.0/24` cobre todos os endereços de `192.168.1.0` até `192.168.1.255`. Um endereço sozinho, sem barra, como `203.0.113.42`, corresponde apenas àquele dispositivo.

Como a lista de IPs permitidos funciona:

- Qualquer endereço fora da lista é recusado com **403 Forbidden**.
- Loopback é sempre permitido, então você não corre o risco de perder o acesso local. Os visitantes que um proxy reverso ou túnel na mesma máquina repassa não são loopback, então a lista os bloqueia. Atrás de um proxy, use Basic Auth.
- No Docker Desktop, no OrbStack e no Docker sem root, todo dispositivo chega ao contêiner pelo mesmo endereço de gateway, então a lista não consegue diferenciá-los. Nesses casos, use Basic Auth.
- O tráfego direto do Tailscale também ignora a lista, a menos que você desative a liberação dele. O tráfego de bridge/gateway do Docker só a ignora quando você define `BYPASS_AUTH_DOCKER=true` (veja [Liberação para Tailscale e Docker](#tailscale-and-docker-bypass)).
- Entradas inválidas são ignoradas e registradas no log. Elas não derrubam o servidor.
- A lista continua rígida mesmo com Basic Auth ativo. Os endereços listados pulam o pedido de senha. Todos os outros endereços continuam bloqueados com **403 Forbidden** e nunca recebem o pedido de login.

A lista não cria uma configuração mista em que os dispositivos listados pulam a senha e todos os outros fazem login. Se você quer que os outros dispositivos entrem com senha, deixe a variável `IP_ALLOWLIST` sem valor e use só Basic Auth.

É possível suspender a aplicação da regra por um tempo sem excluir a lista. Isso ajuda ao investigar problemas a partir de um IP novo. Coloque a chave de ativação em false:

```env
IP_ALLOWLIST_ENABLED=false
```

## Opção 3: liberação para redes privadas (sem senha)

Talvez toda a sua rede seja confiável, por exemplo uma LAN doméstica (rede local) sem encaminhamento de portas. Nesse caso, você pode remover o bloqueio sem definir senha:

```env
ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true
```

Isso restaura o comportamento antigo de "aberto na LAN, bloqueado na internet pública". Vale apenas para as faixas privadas padrão, por exemplo `10.0.0.0/8`, `172.16.0.0/12` e `192.168.0.0/16`. A faixa CGNAT `100.64.0.0/10` não entra na conta, porque alguns provedores de internet a compartilham entre clientes sem relação entre si; adicione-a a `TRUSTED_PRIVATE_NETWORKS` somente se você confiar nela. Endereços da internet pública continuam bloqueados com um 403. Alguns provedores de internet e de telefonia móvel dão aos clientes endereços nessa faixa. Se você a adicionar, os outros clientes do mesmo provedor também contam como clientes de rede privada. `TRUSTED_PRIVATE_NETWORKS` substitui as faixas padrão, então mantenha na lista as faixas de LAN de que ainda precisar.

Aviso: qualquer pessoa na mesma rede passa a acessar Marinara sem senha. Isso não é problema em uma rede que você controla. Já em um Wi-Fi compartilhado de cafeteria, aeroporto ou alojamento, é. Na dúvida, use Basic Auth.

Existe também uma chave mais ampla, `ALLOW_UNAUTHENTICATED_REMOTE=true`, que libera o acesso sem senha a partir de QUALQUER endereço, inclusive da internet pública. Não ative essa chave. Se você realmente precisa de acesso público, use Basic Auth com HTTPS, ou coloque na frente um proxy reverso que cuide do login.

<a id="tailscale-and-docker-bypass"></a>

## Liberação para Tailscale e Docker

Duas chaves permitem que o tráfego direto de Tailscale e Docker pule tanto a lista de IPs permitidos quanto Basic Auth, do mesmo jeito que o loopback faz. Deixe-as vazias para a detecção automática:

```env
BYPASS_AUTH_TAILSCALE=
BYPASS_AUTH_DOCKER=
```

O modo automático confia em um dispositivo Tailscale somente quando ele se conecta diretamente ao endereço Tailscale deste computador. No Linux, uma interface Tailscale com nome personalizado (`tailscaled --tun=...`) não é confiável automaticamente; entre na conta ou defina `BYPASS_AUTH_TAILSCALE=true`. Ele confia no tráfego Docker somente quando Marinara está rodando em um contêiner e a origem corresponde a uma interface de contêiner detectada ou ao seu gateway exato. Assim, a configuração privada comum de Tailscale e Docker no mesmo host continua funcionando sem tratar tráfego não relacionado de CGNAT, LAN, rede do host ou proxy como autenticado.

A confiança automática no Docker só vale enquanto nem Basic Auth nem `IP_ALLOWLIST` estiverem definidos. O Docker Desktop, o OrbStack e o Docker sem root fazem todo dispositivo que abre uma porta publicada passar pelo gateway do contêiner, então Marinara não consegue diferenciar o seu navegador de um celular ou de um desconhecido na rede. Depois que você define uma senha ou uma lista de IPs permitidos, todo cliente Docker precisa passar por elas, inclusive o navegador no host. Defina `BYPASS_AUTH_DOCKER=true` só se você confiar em todo dispositivo que consegue alcançar a porta publicada.

Defina uma chave como `false` se quiser aplicar a esses clientes as verificações normais de Basic Auth e da lista de IPs permitidos. Defina como `true` para manter a antiga liberação ampla quando a detecção automática não estiver disponível: o Tailscale passa a confiar em toda a faixa `100.64.0.0/10`, enquanto o Docker também confia nas interfaces e no gateway detectados e na faixa antiga `172.16.0.0/12`. \1 Os visitantes do Tailscale Serve e do Funnel se conectam pelo loopback com cabeçalhos de encaminhamento, então precisam fazer login. Não existe chave para desligar isso. Uma conexão direta `100.x` continua sem senha.

Por exemplo, se a sua tailnet tem pares menos confiáveis, desative a liberação do Tailscale:

```env
BYPASS_AUTH_TAILSCALE=false
```

Se você não quiser que os pares Docker detectados pulem a autenticação, desative a liberação do Docker e acrescente clientes específicos a `IP_ALLOWLIST` se necessário:

```env
BYPASS_AUTH_DOCKER=false
```

Marinara também pode estar atrás de um contêiner de proxy reverso ou de túnel na bridge do Docker ou no gateway detectado. Os cabeçalhos de encaminhamento, como `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host` ou `X-Forwarded-Proto`, indicam que o par Docker representa outro cliente. Um Host que aponta para outro computador, como `marinara:7860` ou um nome público, ou uma requisição HTTP/1.0 tem o mesmo efeito. Por isso, o Marinara aplica por padrão as verificações normais de Basic Auth e da lista de IPs permitidos. Uma requisição para `localhost` ou `127.0.0.1` vinda do navegador do próprio host continua sem senha enquanto nenhum login ou lista de permissões estiver definido:

```env
REQUIRE_AUTH_FOR_DOCKER_PROXY=true
```

Para voltar ao comportamento antigo de liberação, defina essa chave como `false`. Faça isso apenas quando o próprio proxy exigir login de todo visitante, porque os clientes encaminhados herdam o acesso sem senha do Docker. Se você colocar um proxy na frente do Docker, mantenha a publicação da porta em `127.0.0.1` no `docker-compose.yml` e defina um login primeiro.

O servidor registra um aviso `[auth-bypass]` no log na primeira vez que uma dessas liberações deixa uma requisição passar. Esse aviso confirma que a liberação está ativa.

<a id="reverse-proxies-and-tunnels-on-the-same-computer"></a>

## Proxies reversos e túneis no mesmo computador

Um proxy reverso ou túnel na máquina que roda Marinara, como nginx, Caddy, Traefik, Cloudflare Tunnel, Tailscale Serve ou Funnel, ou ngrok, se conecta a Marinara pelo loopback. Marinara reconhece isso pelos cabeçalhos de encaminhamento que o proxy acrescenta: `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `CF-Connecting-IP`, `True-Client-IP`, os cabeçalhos de identidade do Tailscale ou `Via`. \1também reconhece uma requisição que chega por HTTP/1.0, porque os navegadores nunca o usam, mas o `proxy_pass` padrão do nginx usa. \1\2 aponta para outro computador, como um domínio ou um endereço da LAN, mesmo quando o proxy não adiciona cabeçalhos. Aí trata cada requisição como o visitante remoto que ela realmente é:

- Basic Auth se aplica, então defina `BASIC_AUTH_USER` e `BASIC_AUTH_PASS`. Sem eles, os visitantes veem a página de configuração.
- `IP_ALLOWLIST` bloqueia os visitantes encaminhados, porque o proxy esconde os endereços reais deles.
- As ações privilegiadas exigem o segredo de administrador, e os recursos exclusivos do loopback continuam indisponíveis.

O seu próprio navegador nessa máquina, aberto em `http://127.0.0.1:7860` ou `http://localhost:7860`, continua sem senha.

Caddy, Traefik, Cloudflare Tunnel, Tailscale e ngrok acrescentam cabeçalhos de encaminhamento por padrão. No nginx, esta linha continua recomendada no bloco `location`:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Ferramentas que encaminham conexões brutas, como `socat` ou `ssh -R`, não acrescentam cabeçalhos, então o tráfego delas parece local. Não as use para publicar Marinara.

Se o seu proxy já faz todo visitante entrar com login antes de encaminhar qualquer coisa, você pode pular as verificações do próprio Marinara para o tráfego dele. Faça isso apenas quando o próprio proxy exigir login de todo visitante:

```env
REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false
```

Assim, os visitantes recebem o mesmo acesso total da máquina host, inclusive ações privilegiadas sem o segredo de administrador. \1 Se você só acessa o Marinara por um nome que adicionou em `/etc/hosts`, não use esta chave. Use um nome `*.localhost`, por exemplo `marinara.localhost`.

## Servir por HTTPS

HTTPS criptografa a conexão usando TLS. TLS é a criptografia que transforma um endereço `http` comum em um endereço `https` seguro. Use sempre HTTPS em qualquer instalação acessível fora de uma rede privada totalmente confiável, principalmente com Basic Auth.

Há duas formas de fazer isso.

1. TLS integrado. Aponte o servidor para um arquivo de certificado e um de chave privada:

```env
SSL_CERT=/path/to/cert.pem
SSL_KEY=/path/to/key.pem
```

2. Proxy reverso. Coloque Marinara atrás do nginx, Caddy, Traefik ou de um Cloudflare Tunnel. O proxy cuida da parte de HTTPS e encaminha para Marinara por HTTP simples na mesma máquina. Leia antes [Proxies reversos e túneis no mesmo computador](#reverse-proxies-and-tunnels-on-the-same-computer).

Você precisa de um certificado e de uma chave antes de definir as variáveis `SSL_CERT` e `SSL_KEY`. Uma ferramenta como o `mkcert` cria um certificado para uso local, e o `certbot` cria um para um domínio público. Se os arquivos estiverem faltando ou ilegíveis, o servidor para na inicialização e informa os caminhos exatos que tentou usar.

## Admin Access e ações privilegiadas

Algumas ações são especialmente delicadas: limpar dados, criar ou baixar backups, importar e exportar perfis, instalar temas e instalar o runtime de modelo local. Elas exigem um segredo compartilhado à parte, chamado segredo de administrador, além da opção de acesso que você escolheu acima.

Na máquina de loopback, essas ações costumam funcionar sem o segredo de administrador. Em um dispositivo remoto, você precisa configurar o segredo. Siga estes passos.

1. No arquivo `.env`, defina um valor aleatório forte e salve. Ele entra em vigor em poucos segundos, sem reiniciar.

```env
ADMIN_SECRET=some-long-random-string
```

2. No dispositivo remoto, abra Marinara e vá em **Settings** (Configurações), depois na aba **Advanced** e então na seção **Admin Access** (acesso de administrador).
3. Cole o mesmo valor no campo (o texto de exemplo dele diz **ADMIN_SECRET**) e clique em **Save**.
4. A mensagem **Admin secret saved for this browser** deve aparecer.

Alguns pontos importantes sobre o segredo de administrador:

- Ele fica guardado só naquele navegador. Não sincroniza entre dispositivos. Cada navegador que precisa das ações privilegiadas tem que receber o valor colado separadamente.
- Clicar em **Save** com o campo vazio limpa o valor e mostra **Admin secret cleared**.
- Se quem administra o servidor definir `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true`, até a máquina de loopback passa a precisar do segredo.
- Isso é independente de Basic Auth. Os dois podem ser usados juntos. Basic Auth protege o aplicativo inteiro, e o segredo de administrador protege as ações perigosas.

Quando uma ação privilegiada falha em um dispositivo remoto, Marinara mostra uma mensagem de erro com duas soluções. Uma é abrir o aplicativo pelo localhost. A outra é definir a variável `ADMIN_SECRET` no arquivo `.env` do servidor e depois colar o mesmo valor em **Settings** > **Advanced** > **Admin Access**.

## Por que o salvamento está bloqueado (CSRF)

CSRF quer dizer cross-site request forgery, ou falsificação de requisição entre sites. É uma proteção que impede outro site aberto no navegador de fazer mudanças no Marinara sem a sua permissão, sem você perceber. Ela funciona automaticamente. Não existe configuração para ativá-la.

Às vezes o CSRF bloqueia os seus próprios salvamentos. Isso costuma acontecer quando você acessa Marinara por um nome de domínio público ou por uma porta incomum em que o servidor ainda não confia. Duas coisas avisam quando isso acontece.

- Uma faixa vermelha no topo do aplicativo avisa que **Saves will silently fail**, porque essa origem não é confiável. A faixa mostra a linha exata a acrescentar no arquivo `.env` e tem um botão **Copy**.
- Se um salvamento for mesmo recusado, aparece uma pequena mensagem pop-up. O título dela é **Save blocked: missing CSRF header**, **Save blocked: cross-site request rejected** ou **Save blocked: origin not trusted**.

Para resolver, acrescente o seu endereço à lista de confiança no arquivo `.env`:

```env
CSRF_TRUSTED_ORIGINS=https://chat.example.com,http://203.0.113.10:7831
```

Ao usar um domínio público ou de proxy reverso, libere também o nome do host:

```env
TRUSTED_HOSTS=chat.example.com
```

Endereços diretos de LAN, Tailscale, IPv4 e IPv6 não precisam da variável `TRUSTED_HOSTS`. Nomes locais `.local`/`.home.arpa` e nomes de máquina de rótulo único são aceitos automaticamente. Um nome de host exato já listado na variável `CSRF_TRUSTED_ORIGINS` também é aceito.

Origens de loopback, endereços comuns de LAN, Tailscale (`100.64.0.0/10`) e bridge do Docker (`172.16.0.0/12`) são confiáveis automaticamente. Você só precisa listar endereços IP públicos e nomes de domínio. A mudança entra em vigor em poucos segundos, sem reiniciar.

## Uma observação sobre provedores locais bloqueados

Digamos que você conecte Marinara a um provedor de IA local, por exemplo um que roda na sua própria máquina. A requisição pode ser recusada com uma mensagem sobre uma "private, loopback, metadata, or reserved IP range". Essa é outra verificação de segurança, chamada proteção contra SSRF. SSRF quer dizer server-side request forgery, ou falsificação de requisição pelo lado do servidor. Ela impede o servidor de chamar endereços privados sem a sua autorização. O erro informa a variável exata a definir no arquivo `.env`, como `PROVIDER_LOCAL_URLS_ENABLED`. Veja a [Referência de configuração do servidor](CONFIGURATION.md) para a lista completa.

## Acesso pelo celular ou tablet

Para abrir Marinara no celular ou no tablet dentro da mesma rede:

1. Verifique se o servidor escuta em todas as interfaces, com `HOST=0.0.0.0` no arquivo `.env`.
2. Escolha uma das opções de acesso acima. Basic Auth é a mais simples para um celular na rede Wi-Fi de casa.
3. Descubra o endereço IP local da máquina do servidor (por exemplo `192.168.1.50`).
4. No celular, abra `http://192.168.1.50:7860` em um navegador. A porta padrão é `7860`.
5. Se você configurou Basic Auth, digite o nome de usuário e a senha quando forem pedidos.

Se a página não carregar de jeito nenhum, talvez o servidor não esteja acessível. Confira `HOST=0.0.0.0` e o valor da variável `PORT`. Se aparecer um 403, o dispositivo alcança o servidor, mas ainda não tem permissão. Revise a opção que você escolheu acima.

<a id="locked-out-after-updating"></a>

## Bloqueado depois de atualizar

As versões mais novas pedem login quando uma visita chega por um proxy reverso, um túnel, o Tailscale Serve ou o Tailscale Funnel. As versões antigas deixavam essas visitas entrarem sem senha. Se agora você vê uma página de login, uma página de configuração ou um **403**, é por isso.

Para voltar a entrar:

1. Abra o Marinara no computador que o executa, em `http://localhost:7860` (ou na sua própria `PORT`). O uso local não precisa de senha. No Docker, isso só vale enquanto não houver login nem `IP_ALLOWLIST` definidos. Caso contrário, use o seu login.
2. Abra o arquivo `.env` nesse computador e defina `BASIC_AUTH_USER` e `BASIC_AUTH_PASS`. Se `IP_ALLOWLIST` estiver definido, adicione o endereço do seu outro dispositivo a ele ou remova-o, porque um dispositivo que não está na lista recebe um **403** mesmo com login.
3. Salve o arquivo. O Marinara percebe a mudança em alguns segundos. Se não perceber, ou se você usa Docker, reinicie o Marinara. Depois entre pelo seu outro dispositivo com esse usuário e essa senha.

## Mecanismos de busca

O Marinara pede aos mecanismos de busca que não indexem as suas páginas (`X-Robots-Tag: noindex, nofollow`). Isso não protege a sua instalação nem remove páginas que já foram indexadas. Use os controles de acesso acima para manter a sua instalação privada.

## Guias relacionados

- [Referência de configuração do servidor](CONFIGURATION.md) para a lista completa das configurações do arquivo `.env` e dos casos especiais.
- [Solução de problemas do Marinara Engine](TROUBLESHOOTING.md) para erros de conexão, acesso pelo celular e mais.
- [Perguntas frequentes](FAQ.md) para um passo a passo rápido de como acessar Marinara de outro dispositivo.
