# Acesso remoto: login e lista de IPs permitidos

Neste guia você aprende a acessar Marinara Engine a partir de outro dispositivo, como o celular, um notebook ou um contêiner Docker. Ele cobre a opção principal, um login. Também trata da lista de IPs permitidos, dos proxies de login, do HTTPS, do Admin Access e da mensagem de bloqueio ao salvar (CSRF). Quase tudo aqui é configurado no arquivo `.env` do servidor, e não dentro do aplicativo.

Um rápido glossário para acompanhar o guia:

- Arquivo `.env`: um arquivo de configurações em texto simples, na pasta do Marinara Engine, ao lado do arquivo `package.json`.
- Loopback: a própria máquina que está rodando o servidor. O endereço dela é `127.0.0.1` ou `localhost`.
- Acesso remoto: abrir Marinara em qualquer dispositivo que NÃO seja a máquina que roda o servidor.

## O que Marinara bloqueia por padrão

Para proteger os seus dados, uma instalação nova do Marinara recusa conexões de outros dispositivos até você configurar o controle de acesso. Por padrão, só três tipos de cliente são confiáveis:

1. Loopback (`127.0.0.1` ou `::1`), a própria máquina que roda o servidor. Os visitantes que um proxy reverso ou túnel na mesma máquina repassa não contam; veja [Proxies reversos e túneis no mesmo computador](#reverse-proxies-and-tunnels-on-the-same-computer).
2. Dispositivos Tailscale da sua tailnet. Tailscale é uma ferramenta de rede privada, e os endereços dela usam a faixa `100.64.0.0/10`.
3. Clientes Docker no mesmo host. Marinara reconhece a faixa de bridge usual `172.16.0.0/12` e o gateway padrão exato do contêiner, o que cobre também o Docker Desktop e faixas de endereços personalizadas.

Todo o resto, como o celular na mesma rede Wi-Fi ou um cliente vindo da internet pública, fica bloqueado até você definir um login. Um dispositivo bloqueado que abre Marinara no navegador vê uma página escura de configuração. O título dela diz **This Marinara Engine install needs a login before remote devices can connect.** A página tem um formulário para o código de configuração de uso único do log do servidor, para que você defina o login a partir desse dispositivo.

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
2. Você quer acessar Marinara pelo celular, tablet ou notebook na rede Wi-Fi de casa. Defina um login (Opção 1, abaixo).
3. Você está expondo Marinara à internet pública. Defina um login e use HTTPS.
4. Um proxy de login na sua rede, como tinyauth, Authelia ou Authentik, já pede a cada visitante que faça login. Leia [Proxies de login (forward auth)](#login-proxies-forward-auth).

Um login é a escolha mais flexível. Funciona a partir de qualquer IP, não exige configuração em cada dispositivo, e cada navegador continua conectado.

<a id="option-1-login-recommended"></a>

## Opção 1: login (recomendado)

Um login é um nome de usuário e uma senha que todo dispositivo remoto precisa. Você pode defini-lo de três maneiras:

- **Em Settings.** Em um navegador que já está conectado, ou no computador que roda Marinara (abra `http://localhost:7860`), vá em **Settings → Advanced → Access** (Configurações → Avançado → Acesso). Defina um nome de usuário e uma senha em **Remote login**. Enquanto não existe login, um dispositivo que Marinara recusa, como o navegador em um host Docker, pode digitar o código de configuração do log do servidor no mesmo lugar.
- **Com o código de configuração, de qualquer dispositivo.** Enquanto nenhum login está definido e o servidor escuta além do loopback, ele imprime um código de configuração de uso único no log. A linha do log começa com `[login] One-time setup code:`. Encontre-a no terminal que roda Marinara. No Docker, execute `docker logs <container> 2>&1 | grep "setup code"`. O aviso de recusa no log repete o código enquanto não existe login. Depois abra Marinara em qualquer dispositivo. A página que bloqueia o dispositivo tem um formulário para o código de configuração, um nome de usuário e uma senha. O código tem esta forma: `XXXX-XXXX-XXXX-XXXX`. Letras maiúsculas, espaços e traços não importam. Cada código funciona uma vez; uma reinicialização ou um reset imprime um novo. No Docker, a página também mostra como definir o login no arquivo `.env` da pasta de dados (`/app/data/.env`) ou na lista `environment:` do seu arquivo compose (depois execute `docker compose up -d`). Use esse caminho em instalações Docker e NAS sem navegador no host. Marinara mostra um banner sobre o login ausente para visitantes locais e sessões conectadas, como um cartão na parte de baixo da tela.
- **No `.env`.** Adicione duas linhas:

```env
BASIC_AUTH_USER=alice
BASIC_AUTH_PASS=correct-horse-battery-staple
```

Um login no `.env` tem prioridade sobre um login definido no app, e você só o muda no `.env`. Salve o `.env`; a mudança entra em vigor em poucos segundos, sem reiniciar.

Escolha uma senha forte e exclusiva. O app pede pelo menos 10 caracteres. É possível gerar uma senha aleatória:

```bash
openssl rand -base64 24
```

Depois, siga estes passos a partir do dispositivo remoto.

1. Abra Marinara no navegador usando o endereço do servidor, por exemplo `http://192.168.1.50:7860`.
2. Entre na página de login com o seu nome de usuário e a sua senha.
3. Você deve ver o app carregar. O navegador permanece conectado por até um ano, até você sair. Scripts e clientes de API enviam o nome de usuário e a senha a cada requisição (Basic Auth).

Para entrar em outro dispositivo sem digitar a senha, use um código de pareamento. Em um dispositivo que já está conectado, abra **Settings → Advanced → Access** e escolha **Add a device** (adicionar um dispositivo). Depois digite o código na página de login do novo dispositivo. O código funciona uma vez, por alguns minutos. Um código expirado recebe a sua própria mensagem; gere um novo. Em **Signed-in devices** (dispositivos conectados), você vê cada dispositivo com o seu método de login e a data do primeiro login. Você pode desconectar qualquer dispositivo, inclusive o que você usa. Você também pode mudar ou remover a senha. Para isso, Marinara pede a senha atual, a menos que você trabalhe no computador que roda Marinara ou tenha definido `ADMIN_SECRET`.

Se você esquecer a senha, execute `pnpm reset-login` no computador que roda Marinara. No Docker, execute `docker exec <container> node scripts/reset-login.mjs`. Ele remove o login definido no app e desconecta todos os navegadores. Se o servidor escuta além do loopback, ele então imprime um novo código de configuração. Só se esse comando não funcionar, apague `.remote-login.json` e `.remote-sessions.json` da pasta de dados. Com o `/app/data` padrão, execute `docker exec <container> rm -f /app/data/.remote-login.json /app/data/.remote-sessions.json`; se você mudou `DATA_DIR`, use essa pasta. Um login no `.env` que você muda no `.env`.

**Servidor sem navegador?** Uma instalação nativa em um servidor sem navegador escuta só no loopback e não imprime código de configuração. No seu próprio computador, execute `ssh -L 7860:127.0.0.1:7860 user@server`. Depois abra `http://localhost:7860` ali e use **Settings**.

Depois de 10 senhas ou códigos errados diferentes em 15 minutos, Marinara recusa logins desse endereço com **429 Too Many Requests** (muitas requisições) até os 15 minutos acabarem. Uma senha correta antes disso zera a contagem. Os visitantes que usam um proxy reverso ou túnel no host repassam compartilham uma única contagem, e o login de um deles não a zera. Reiniciar o servidor também zera a contagem. Um navegador que já entrou antes continua entrando com a senha correta, então as senhas erradas de outras pessoas não podem bloquear você em um dispositivo que você já usa. A página de login informa quantos minutos esperar. Se você esquecer a senha, a página de login tem uma dica **Forgot the password?**.

Por padrão, o aviso do navegador mostra **Marinara Engine**. Esse texto pode ser alterado com a variável `BASIC_AUTH_REALM`.

Alguns clientes pulam a senha mesmo com Basic Auth ativo:

- Loopback (`127.0.0.1`, `::1`), então você nunca precisa de senha na própria máquina do servidor. Os visitantes que um proxy reverso ou túnel nessa máquina repassa continuam precisando dela.
- Qualquer endereço na variável `IP_ALLOWLIST`. Atenção: definir uma lista de IPs permitidos também bloqueia todos os endereços que não estiverem nela (veja a Opção 2).
- O tráfego direto do Tailscale (`100.64.0.0/10`), a menos que você desative a liberação dele.
- O tráfego de bridge/gateway do Docker, só enquanto nenhum login, lista de IPs permitidos ou `TRUSTED_AUTH_PROXY` estiver definido (veja [Liberação para Tailscale e Docker](#tailscale-and-docker-bypass)).
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
- O tráfego direto do Tailscale também ignora a lista. O tráfego de bridge/gateway do Docker só a ignora enquanto nenhum login, lista de IPs permitidos ou `TRUSTED_AUTH_PROXY` válido estiver definido (veja [Liberação para Tailscale e Docker](#tailscale-and-docker-bypass)).
- Entradas inválidas são ignoradas e registradas no log. Elas não derrubam o servidor.
- A lista continua rígida mesmo com Basic Auth ativo. Os endereços listados pulam o pedido de senha. Todos os outros endereços continuam bloqueados com **403 Forbidden** e nunca recebem o pedido de login.

A lista não cria uma configuração mista em que os dispositivos listados pulam a senha e todos os outros fazem login. Se você quer que os outros dispositivos entrem com senha, deixe a variável `IP_ALLOWLIST` sem valor e use só Basic Auth.

É possível suspender a aplicação da regra por um tempo sem excluir a lista. Isso ajuda ao investigar problemas a partir de um IP novo. Coloque a chave de ativação em false:

```env
IP_ALLOWLIST_ENABLED=false
```

## Liberação para redes privadas (referência)

Algumas chaves removem o bloqueio de uma rede privada confiável. Elas servem para configurações especiais. Um login é a melhor escolha. Veja [Controle de acesso](CONFIGURATION.md#access-control) para as chaves e seus riscos.

<a id="tailscale-and-docker-bypass"></a>

## Liberação para Tailscale e Docker

Por padrão, Marinara confia em um dispositivo que se conecta diretamente pela sua rede Tailscale. Ela também confia no próprio host de um contêiner Docker. Um login, uma lista de IPs permitidos ou `TRUSTED_AUTH_PROXY` interrompe a confiança automática no Docker, então todo dispositivo passa a precisar do seu login ou do seu lugar na lista. Para as chaves que mudam isso, veja [Controle de acesso](CONFIGURATION.md#access-control).

<a id="reverse-proxies-and-tunnels-on-the-same-computer"></a>

## Proxies reversos e túneis no mesmo computador

Um proxy reverso ou túnel na máquina que roda Marinara, como nginx, Caddy, Traefik, Cloudflare Tunnel, Tailscale Serve ou Funnel, ou ngrok, se conecta a Marinara pelo loopback. Marinara reconhece isso pelos cabeçalhos de encaminhamento que o proxy acrescenta: `Forwarded`, `X-Forwarded-For`, `X-Real-IP`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `CF-Connecting-IP`, `True-Client-IP`, os cabeçalhos de identidade do Tailscale ou `Via`. Marinara também reconhece uma requisição que chega por HTTP/1.0, porque os navegadores nunca o usam, mas o `proxy_pass` padrão do nginx usa. Marinara também reconhece uma requisição cujo Host aponta para outro computador, como um domínio ou um endereço da LAN, mesmo quando o proxy não acrescenta cabeçalhos. Ela então trata cada requisição como o visitante remoto que ela é realmente:

- O login se aplica (veja [Opção 1](#option-1-login-recommended)). Sem um, os visitantes veem a página de configuração. Defina o login em **Settings** neste computador ou no `.env`.
- `IP_ALLOWLIST` bloqueia os visitantes encaminhados, porque o proxy esconde os endereços reais deles.
- As ações privilegiadas exigem o segredo de administrador, e os recursos exclusivos do loopback continuam indisponíveis.

O seu próprio navegador nessa máquina, aberto em `http://127.0.0.1:7860` ou `http://localhost:7860`, continua sem senha.

Caddy, Traefik, Cloudflare Tunnel, Tailscale e ngrok acrescentam cabeçalhos de encaminhamento por padrão. No nginx, esta linha continua recomendada no bloco `location`:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Ferramentas que encaminham conexões brutas, como `socat` ou `ssh -R`, não acrescentam cabeçalhos, então o tráfego delas parece local. Não as use para publicar Marinara.

Se o seu proxy já faz todo visitante entrar com um login antes de encaminhar qualquer coisa, você pode pular as verificações do próprio Marinara para o tráfego dele. Faça isso apenas quando o próprio proxy exigir login de todo visitante. Leia [Proxies de login (forward auth)](#login-proxies-forward-auth).

<a id="login-proxies-forward-auth"></a>

## Proxies de login (forward auth)

Um proxy de forward auth, como [tinyauth](https://tinyauth.app), [Authelia](https://www.authelia.com), [Authentik](https://goauthentik.io) ou oauth2-proxy, pede a cada visitante que faça login antes de encaminhar a requisição. Se esse proxy é o único jeito de alcançar Marinara, você pode pular o segundo login do Marinara. Não faça isso sem um proxy assim.

Coloque o endereço do proxy no `.env`:

```env
TRUSTED_AUTH_PROXY=192.168.1.5
```

Marinara então deixa passar toda requisição cuja conexão venha desse endereço. Marinara não pede o próprio login para elas, e não imprime código de configuração. Marinara confere o endereço da própria conexão. Ela ignora cabeçalhos de encaminhamento como `X-Forwarded-For` para essa decisão. As requisições do proxy também passam por `IP_ALLOWLIST`, porque o proxy decide quem entra. Elas não contam como locais, então as ações privilegiadas ainda precisam do segredo de administrador. **Settings → Advanced → Access** mostra **Trusted login proxy: Set** enquanto a configuração está ativa.

Antes de defini-la:

- **O proxy deve pedir um login em todo caminho.** Isso inclui `/api/`, conexões WebSocket e arquivos estáticos. Um caminho que o proxy deixa passar sem login fica aberto a todos.
- **Marinara não pode estar acessível sem passar pelo proxy.** Associe Marinara a um endereço que só o proxy consiga alcançar, ou bloqueie a porta dela com um firewall. No Docker, coloque o proxy e Marinara na mesma rede Docker, dê ao proxy um endereço fixo nela e não publique a porta do Marinara. Se o proxy roda no host Docker, publique a porta só no loopback (`127.0.0.1:7860:7860`): o Docker Desktop e o OrbStack mostram todo cliente LAN de uma porta publicada no endereço do gateway do Docker, o mesmo endereço do proxy. Se outro dispositivo consegue se conectar diretamente a Marinara, ele pula o login do proxy.
- **Liste só o endereço do próprio proxy.** Uma faixa deve ficar dentro do espaço de endereços privados; Marinara ignora as outras faixas. Ela registra um aviso para cada faixa, porque todo dispositivo em uma faixa pula o login.
- **Acrescente o nome público como para qualquer outro proxy.** Coloque o nome do host em `TRUSTED_HOSTS` e a origem em `CSRF_TRUSTED_ORIGINS` (veja [Por que meu salvamento está bloqueado (CSRF)](#why-is-my-save-blocked-csrf)).

Quando `TRUSTED_AUTH_PROXY` está definido, Marinara também interrompe a confiança automática no Docker. Os visitantes diretos que não são o proxy precisam do login do Marinara ou da lista de IPs permitidos. Marinara então também mostra um banner "no login yet".

Se o proxy roda no mesmo computador que Marinara, use `TRUSTED_AUTH_PROXY=127.0.0.1` e aponte o proxy para `127.0.0.1:7860`, não para `localhost`. Um proxy que disca `localhost` pode se conectar por `::1`, que não corresponde a `127.0.0.1`. Então todo outro proxy ou túnel nesse computador também é confiável, por isso use isso só quando o proxy de login for o único. Isso não dá aos visitantes do proxy o acesso da máquina local.

Um exemplo de Caddy, com Marinara em `192.168.1.20:7860`:

```caddy
marinara.example.com {
  forward_auth tinyauth:3000 {
    uri /api/auth/caddy
  }
  reverse_proxy 192.168.1.20:7860
}
```

Para o Authelia, use `forward_auth authelia:9091` com `uri /api/authz/forward-auth`. O Authentik também serve as próprias páginas de login pelo proxy. Coloque-as em um bloco `route` para que o Caddy mantenha a ordem delas e o caminho do outpost não passe pelo próprio forward auth:

```caddy
marinara.example.com {
  route {
    reverse_proxy /outpost.goauthentik.io/* authentik-server:9000
    forward_auth authentik-server:9000 {
      uri /outpost.goauthentik.io/auth/caddy
    }
    reverse_proxy 192.168.1.20:7860
  }
}
```

Para Traefik e nginx, siga o guia de forward auth do seu proxy. Marinara não precisa de nada além do endereço do proxy.

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

<a id="why-is-my-save-blocked-csrf"></a>

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
2. Defina um login (Opção 1 acima). No celular, você pode fazê-lo na página que bloqueia o dispositivo, com o código de configuração do log do servidor.
3. Descubra o endereço IP local da máquina do servidor (por exemplo `192.168.1.50`).
4. No celular, abra `http://192.168.1.50:7860` em um navegador. A porta padrão é `7860`.
5. Entre com o seu nome de usuário e a sua senha.

Se a página não carregar de jeito nenhum, talvez o servidor não esteja acessível. Confira `HOST=0.0.0.0` e o valor da variável `PORT`. Se aparecer um 403, o dispositivo alcança o servidor, mas ainda não tem permissão. Revise a opção que você escolheu acima.

<a id="locked-out-after-updating"></a>

## Bloqueado depois de atualizar

As versões mais novas pedem login quando uma visita chega por um proxy reverso, um túnel, o Tailscale Serve ou o Tailscale Funnel. As versões antigas deixavam essas visitas entrarem sem senha. Se agora você vê uma página de login, uma página de configuração ou um **403**, é por isso.

**Nota de atualização:** se você usa o Tailscale Serve, ou outro proxy no mesmo computador, e nunca definiu uma senha, os seus outros dispositivos ficam bloqueados depois da atualização. Um proxy no mesmo computador geralmente fala com um servidor que escuta só no loopback, então o servidor não imprime código de configuração. Defina o login no computador que roda Marinara.

Para voltar a entrar:

1. Abra Marinara no computador que o executa, em `http://localhost:7860` (ou na sua própria `PORT`). O uso local não precisa de senha. Em um servidor sem navegador, primeiro execute `ssh -L 7860:127.0.0.1:7860 user@server` no seu próprio computador, depois abra `http://localhost:7860` ali. No Docker, isso só vale enquanto não houver login nem `IP_ALLOWLIST` definidos. Caso contrário, digite o código de configuração do log do servidor (`docker logs <container> 2>&1 | grep "setup code"`) na página que bloqueia você ou em **Settings → Advanced → Access**, ou use um navegador que ainda esteja conectado.
2. Vá em **Settings → Advanced → Access** e defina um nome de usuário e uma senha em **Remote login**. Ou abra o arquivo `.env` nesse computador e defina `BASIC_AUTH_USER` e `BASIC_AUTH_PASS`. Se `IP_ALLOWLIST` estiver definido, adicione o endereço do seu outro dispositivo a ele ou remova-o, porque um dispositivo que não está na lista recebe um **403** mesmo com login.
3. Entre pelo seu outro dispositivo com esse nome de usuário e essa senha.

## Mecanismos de busca

O Marinara pede aos mecanismos de busca que não indexem as suas páginas (`X-Robots-Tag: noindex, nofollow`). Isso não protege a sua instalação nem remove páginas que já foram indexadas. Use os controles de acesso acima para manter a sua instalação privada.

## Guias relacionados

- [Referência de configuração do servidor](CONFIGURATION.md) para a lista completa das configurações do arquivo `.env` e dos casos especiais.
- [Solução de problemas do Marinara Engine](TROUBLESHOOTING.md) para erros de conexão, acesso pelo celular e mais.
- [Perguntas frequentes](FAQ.md) para um passo a passo rápido de como acessar Marinara de outro dispositivo.
