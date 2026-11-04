# Atualizando Marinara Engine

Atualize Marinara Engine para uma versão mais nova, verifique as atualizações dentro do aplicativo e volte atrás se algo quebrar. Os seus chats e configurações continuam intactos depois de atualizar.

## Qual é o meu método de atualização?

| Como você instalou | Como atualizar |
| --- | --- |
| Instalador do Windows ou `start.bat` | Feche Marinara e abra de novo. Veja [Windows](#windows). |
| macOS ou Linux | Execute `./start.sh` de novo. Veja [macOS e Linux](#macos-and-linux). |
| Docker ou Podman | Baixe a nova imagem e reinicie. Veja [Docker ou Podman](#docker-or-podman). |
| Aplicativo Android | Atualize o APK e depois toque em **Install / Start Marinara** (instalar / iniciar Marinara). Veja [Android (Termux)](#android-termux). |
| iPhone ou iPad | Atualize o dispositivo que roda o servidor. Veja [iPhone e iPad](#iphone-and-ipad). |

<a id="back-up-first"></a>

## Faça um backup antes

Faça um backup antes de qualquer salto grande entre versões, e sempre que houver a chance de você voltar para uma versão anterior.

1. Abra **Settings** (Configurações).
2. Vá até a aba **Advanced** (avançado).
3. Localize a seção **Backup & Export**.
4. Clique em **Download Backup** (baixar o backup).
5. Salve o arquivo `.zip` em um lugar seguro.

O botão mostra **Creating backup…** enquanto trabalha. Quando termina, o navegador salva um `.zip` com os seus dados. Para restaurar, veja [Fazer backup e restaurar o Marinara](data/backup-and-restore.md).

## Atualização por plataforma

Escolha a seção que corresponde à forma como você instalou Marinara. Uma instalação via Git é uma cópia instalada com a ferramenta Git, o que inclui o instalador do Windows e qualquer `git clone`.

### Windows

O inicializador atualiza Marinara toda vez que você o inicia.

1. Feche Marinara Engine.
2. Abra de novo pelo atalho da área de trabalho ou do Menu Iniciar, ou execute `start.bat`.

O inicializador busca o código mais novo, reinstala o que mudou, recompila e inicia a nova versão. Se você mesmo alterou o código, ele deixa as suas alterações de lado e as devolve depois da atualização. Se não conseguir, ele mantém a versão atual e mostra um aviso. Ele copia os seus dados antes de atualizar e pula uma atualização que levaria a uma versão mais antiga do que os seus dados (veja [Como voltar para uma versão anterior](#downgrading-to-an-older-version)).

Para pular a atualização uma vez, execute `start.bat --skip-update`. Para manter a versão instalada em todas as inicializações, defina `AUTO_UPDATE_ENABLED=false` no `.env` do projeto. Isso desativa só as atualizações automáticas. Os comandos manuais e **Settings → Advanced → Check for Updates** (Configurações → Avançado → Verificar atualizações) continuam funcionando.

Se o inicializador avisar que o Node.js está velho demais, instale o Node.js 24 LTS (Long Term Support, ou suporte de longo prazo: a versão estável recomendada) e inicie Marinara de novo. Você também pode baixar o instalador mais novo na página de Releases do GitHub e executá-lo.

<a id="macos-and-linux"></a>

### macOS e Linux

1. Feche Marinara Engine.
2. Execute o inicializador na pasta do Marinara.

```bash
./start.sh
```

O inicializador busca o código mais novo, reinstala as dependências que mudaram, recompila e inicia a nova versão. Use `./start.sh --skip-update` para pular a atualização uma vez, ou `AUTO_UPDATE_ENABLED=false` no `.env` para desativar as atualizações automáticas. Se o Node.js estiver velho demais, instale o Node.js 24 LTS e execute o inicializador de novo.

<a id="docker-or-podman"></a>

### Docker ou Podman

Os contêineres se atualizam com o download de uma nova imagem, e não pelo inicializador. Faça um backup e depois execute isto na pasta que contém o seu arquivo Compose.

```bash
docker compose pull && docker compose up -d
```

No Podman, use `podman compose` no lugar. As imagens de cada versão são `ghcr.io/pasta-devs/marinara-engine:X.Y.Z` e `:latest`, mais as tags `-lite` correspondentes. O pull não mexe nos seus dados no volume `marinara-data`. Veja [Instalação em contêiner](installation/containers.md).

### Android (Termux)

Termux é o aplicativo Android que roda um pequeno sistema Linux para Marinara. O inicializador dele atualiza Marinara toda vez que você o executa.

1. Abra o Termux.
2. Execute o inicializador.

```bash
cd Marinara-Engine
./start-termux.sh
```

O inicializador atualiza o código, atualiza o Node.js quando é preciso, recompila e inicia o servidor. Se uma atualização quebrar algo e você quiser continuar na cópia atual, acrescente `--skip-update`. Para desativar as atualizações automáticas, defina `AUTO_UPDATE_ENABLED=false` no `.env` do projeto.

Se você usa o aplicativo Android (APK), [baixe o APK mais recente](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) e abra o arquivo para o Android atualizar o aplicativo. Depois abra Marinara Engine e toque em **Install / Start Marinara** para atualizar e iniciar a cópia do Termux. Uma atualização nunca pede credenciais de assinatura nem um segredo.

<a id="iphone-and-ipad"></a>

### iPhone e iPad

Esses dispositivos não rodam o servidor. O ícone da Tela de Início é um PWA, um site salvo na Tela de Início que abre como um aplicativo.

1. Atualize o computador, o host de contêiner ou o dispositivo Android que roda o seu servidor Marinara. Use a seção correspondente acima.
2. Recarregue o aplicativo da Tela de Início ou a aba do Safari.

Se o Safari continuar mostrando uma compilação antiga, reinstale o PWA. Veja [Como limpar e reinstalar o PWA](installation/ios-pwa.md#clearing-and-reinstalling-the-pwa).

<a id="manual-update-git-copy-no-launcher"></a>

### Atualização manual (instalação via Git, sem inicializador)

Use isto se você roda uma instalação via Git com `pnpm start` em vez do inicializador. Execute estes comandos na pasta do Marinara.

1. Busque o código estável mais recente.

```bash
git fetch origin +refs/heads/main:refs/remotes/origin/main
```

2. Passe para esse código.

```bash
git merge --ff-only origin/main || git checkout --detach origin/main
```

3. Reinstale as dependências, recompile e inicie.

```bash
pnpm install --force --frozen-lockfile
pnpm build
pnpm start
```

Para a versão staging (de teste), execute estes dois comandos no lugar dos passos 1 e 2:

```bash
git fetch origin +refs/heads/staging:refs/remotes/origin/staging
git checkout -B staging origin/staging
```

> **Aviso:** as compilações staging são compilações de teste, anteriores ao lançamento. Faça backup dos seus dados antes de usá-las.

## Atualizar dentro do aplicativo

Marinara pode consultar o GitHub para ver se existe uma versão mais nova. Algumas instalações também conseguem aplicar a atualização pelo navegador.

1. Abra **Settings**.
2. Vá até a aba **Advanced**.
3. Localize a seção **Updates** (atualizações).

### Escolha um canal de versão

**Release Channel** (canal de versão) define quais compilações você acompanha.

- **Latest Stable:** as versões marcadas como `vX.Y.Z`. É a escolha normal.
- **Staging/UAT:** compilações de teste, anteriores ao lançamento, que podem estar inacabadas. Ao escolher esse canal, aparece o aviso "Staging builds are pre-release tester builds. Back up your app data before applying them."

Quando você escolhe outro canal em um navegador no próprio computador do servidor, o botão de atualização mostra **Switch to** (mudar para) seguido do nome do canal. Ele funciona mesmo com as atualizações normais dentro do aplicativo desligadas, e mostra **Switching…** enquanto roda. Os dispositivos remotos só conseguem fazer isso se atenderem às condições de **Apply Update** (aplicar a atualização) descritas abaixo.

### Check for Updates

Clique em **Check for Updates**. O botão mostra **Checking…** enquanto trabalha. Abaixo dele aparecem a sua versão em **Release**, o seu código de commit em **Build** e, quando é conhecido, o seu **Branch**.

- Se você está em dia, uma linha verde diz "You're on the latest" junto com a sua versão.
- Se existe uma versão mais nova, um cartão mostra "vX.Y.Z available" com um link **Release notes** (notas da versão).
- Se uma instalação via Git está atrasada, o cartão mostra "N commits behind". Um commit é uma alteração salva no código, então a contagem pode incluir trabalho ainda não lançado.

A verificação de versão fica em cache por cerca de 15 minutos, e a contagem de commits por cerca de 5 minutos, então um segundo clique logo em seguida pode mostrar os mesmos números.

Se a verificação falhar, aparece "Could not check for updates. Try again later." Isso costuma indicar um problema de rede ou do GitHub.

### Apply Update

O botão **Apply Update** atualiza uma instalação via Git pelo navegador. Ele só aparece quando todas estas condições são verdadeiras:

- A instalação é via Git. Contêineres e outras instalações não conseguem aplicar a atualização por esse caminho.
- O branch é `main`, `master` ou `staging`, ou um checkout destacado. Uma cópia em qualquer outro branch conta como uma cópia de desenvolvimento, e Marinara se recusa.
- O dono do servidor definiu `UPDATES_APPLY_ENABLED=true` no arquivo `.env` do servidor.
- `UPDATES_APPLY_DISABLED` não está definido. Ele bloqueia toda aplicação de atualização, inclusive a troca de canal, e os inicializadores de desenvolvimento o definem.

Você não precisa do segredo de administrador para aplicar a atualização no computador que roda o servidor. Abra Marinara em `http://127.0.0.1:7860` ou `http://localhost:7860`.

Duas configurações mudam isso:

- Um endereço servido por um proxy reverso ou túnel conta como outro dispositivo. `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false` faz esses visitantes contarem como locais, inclusive na dispensa local do segredo de administrador. Mantenha essa proteção ligada para um proxy ou túnel público.
- `MARINARA_REQUIRE_ADMIN_SECRET_ON_LOOPBACK=true` faz até as requisições locais precisarem do segredo.

Aplicar a atualização de outro dispositivo vem desativado por padrão. Isso exige as três condições abaixo:

- `UPDATES_ALLOW_REMOTE_APPLY=true` no `.env` do servidor.
- `ADMIN_SECRET` definido no `.env` do servidor. É uma segunda senha para ações arriscadas.
- O mesmo segredo salvo no seu dispositivo em **Settings → Advanced → Admin Access**.

Clique em **Apply Update**. O botão mostra **Updating…** enquanto o servidor busca o código, reinstala, recompila e se desliga. Em seguida aparece "Update applied successfully. Please relaunch the app to use the new version." Inicie Marinara de novo para concluir.

Se não funcionou: quando **Apply Update** não aparece, Marinara mostra o motivo.

- As instalações em contêiner mostram a tag da imagem e o comando `docker compose pull && docker compose up -d` para rodar no host.
- As instalações via Git com a aplicação desligada mostram um comando manual que você pode copiar.
- As demais instalações mostram um link **Download** para a versão no GitHub.

## Recarregar o aplicativo no navegador

O botão **Refresh App** (atualizar o aplicativo) fica na mesma seção **Updates**. Ele não atualiza o servidor. Ele remove o service worker (um pequeno script que o navegador usa para carregar o aplicativo rápido) e limpa os caches do navegador, depois recarrega a página. Os seus chats e configurações continuam no lugar.

Use esse botão quando o aplicativo parecer desatualizado ou ficar em branco depois de o servidor já ter sido atualizado. O botão mostra **Refreshing…** enquanto trabalha.

## Os seus dados e os downloads opcionais

A atualização troca o código do aplicativo, e não a sua pasta de dados nem o volume `marinara-data`. Os seus chats, personagens, personas, lorebooks, presets, conexões e configurações continuam no lugar. Para saber onde os dados ficam, leia [Fazer backup e restaurar o Marinara](data/backup-and-restore.md).

- **Pacotes opcionais.** Quando você atualiza a partir de uma versão que já vinha com agentes próprios, mapas, chamadas ou jogos de Conversation embutidos, a primeira inicialização baixa os pacotes opcionais correspondentes. As suas escolhas, as configurações e o histórico continuam. Mantenha o servidor online nessa primeira inicialização. Se a origem do download estiver inacessível, Marinara tenta de novo na próxima inicialização e não exclui nada.
- **Idioma dos guias.** Se você usa um idioma de documentação baixado (**Settings → General → Documentation Language**), a primeira inicialização depois de uma atualização atualiza esse pacote. Se a origem estiver inacessível, Marinara mantém o pacote instalado, mostra em inglês os guias que faltam e tenta de novo na próxima inicialização.
- **Idioma da interface.** Os pacotes de idioma da interface são um download separado e manual. Na primeira atualização a partir de uma versão com as traduções embutidas, a interface volta ao inglês. Escolha o seu idioma de novo em **Settings → General → Language** (Configurações → Geral → Idioma). As atualizações posteriores mantêm os pacotes baixados. Use **Refresh language pack** (atualizar o pacote de idioma) para obter traduções novas. As traduções que faltam aparecem em inglês.

## Atualizar a partir da 2.5.0

Os passos acima são os mesmos. Algumas mudanças afetam um servidor usado por outros dispositivos ou por outras pessoas. Abra os detalhes se esse for o seu caso.

<details>
<summary>Mudanças para servidores compartilhados</summary>

- **Um proxy reverso ou túnel no mesmo computador.** Os visitantes que nginx, Caddy, Cloudflare Tunnel, Tailscale Serve ou ngrok repassam ao Marinara agora contam como remotos. Sem um login, eles veem a página de configuração, e os backups e outras ações protegidas exigem o segredo de administrador. Veja [Proxies reversos e túneis no mesmo computador](REMOTE_ACCESS.md#reverse-proxies-and-tunnels-on-the-same-computer).
- **Liberação de login do Tailscale.** As conexões diretas ao endereço Tailscale deste computador ainda pulam o login. Outras conexões de `100.64.0.0/10` não o pulam mais, e os visitantes do Tailscale Serve e do Funnel precisam de um login. Veja [Liberação para Tailscale e Docker](REMOTE_ACCESS.md#tailscale-and-docker-bypass).
- **Docker com uma senha ou uma lista de IPs permitidos.** Com um login definido (um login do aplicativo ou Basic Auth), o navegador no computador host agora também precisa informá-lo. O mesmo acontece com `TRUSTED_AUTH_PROXY`, a menos que o proxy seja quem se conecta. Com só `IP_ALLOWLIST` definido, o navegador do host é recusado, a não ser que você inclua o gateway do contêiner na lista; por isso, use um login. Veja [Liberação para Tailscale e Docker](REMOTE_ACCESS.md#tailscale-and-docker-bypass).
- **Chats e perfis levados para outra instalação.** Um registro de chat, um perfil de configurações ou um perfil completo não leva mais o seu **Discord Mirror**, a **DeepLX URL**, a **DeepL API Key** (chave de API do DeepL) ou a **Intiface URL** para outra instalação. Digite esses dados de novo lá. Os seus próprios perfis, e um perfil completo restaurado na mesma instalação, mantêm esses dados.
- **Bloqueado depois de atualizar?** Veja [Bloqueado depois de atualizar](REMOTE_ACCESS.md#locked-out-after-updating).

</details>

<a id="downgrading-to-an-older-version"></a>

## Como voltar para uma versão anterior

Nem sempre é possível voltar. As versões mais novas salvam os dados em um formato de armazenamento mais novo, e uma compilação recusa dados em um formato mais novo do que o que ela conhece. As compilações atuais usam o formato de armazenamento 10. Os formatos 8, 9 e 10 acrescentaram os avatares MMD, os vínculos entre conexões e contas e os avatares GLB/FBX. Uma compilação que conhece só um formato mais antigo não consegue abrir dados salvos neles.

O inicializador pula uma atualização automática que levaria a uma versão incompatível, e o atualizador do aplicativo se recusa a aplicá-la. Para voltar a uma compilação mais antiga, pare Marinara e restaure um backup completo feito antes da atualização. O comando de conversão de arquivos de chat abaixo não consegue converter as configurações de avatares MMD. Não mude o número do formato à mão.

Se os seus dados são anteriores ao formato de armazenamento 8, uma conversão de um único comando pode colocar os arquivos de chat de volta na estrutura antiga. Veja [Os chats não mostram mensagens depois de trocar para uma versão anterior](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version).

<a id="going-back-to-250"></a>

### Voltar para a 2.5.0

A versão 2.5.0 não consegue abrir dados atualizados para o formato de armazenamento 8 ou mais novo. Use um backup feito antes da atualização.

Com dados mais antigos, que a 2.5.0 consegue abrir, ela não conhece o que os recursos mais novos acrescentaram: algumas configurações de conexão, os detalhes usados para gerar de novo as imagens do chat e partes dos checkpoints de jogo, dos relógios de conjuntos de regras e dos vídeos de cena. Quando a 2.5.0 salva um chat ou uma conexão, por exemplo quando você envia uma mensagem, joga um turno de jogo, gera uma imagem ou muda uma conexão, ela descarta esses dados mais novos do chat ou da conexão inteira. Atualizar de novo não os traz de volta.

Para voltar exatamente ao ponto em que estava, faça um backup antes de atualizar. Veja [Faça um backup antes](#back-up-first).

## Quando a atualização falha

A maioria das falhas vem de um Node.js antigo, de um download incompleto ou de um cache velho no navegador.

- Se o inicializador disser que o Node.js está velho demais, instale o Node.js 24 LTS e inicie de novo.
- Se o aplicativo parecer quebrado depois de o servidor ter sido atualizado, clique em **Refresh App**.
- Se uma instalação via Git não conseguir atualizar direito, use os comandos de [atualização manual](#manual-update-git-copy-no-launcher).

Para mensagens de erro e soluções, veja [Solução de problemas do Marinara Engine](TROUBLESHOOTING.md).

## Guias relacionados

- [Fazer backup e restaurar o Marinara](data/backup-and-restore.md)
- [Solução de problemas do Marinara Engine](TROUBLESHOOTING.md)
- [Guia de instalação no Windows](installation/windows.md)
- [Guia de instalação no macOS / Linux](installation/macos-linux.md)
- [Rodar em contêiner (Docker / Podman)](installation/containers.md)
- [Guia de instalação no Android (Termux)](installation/android-termux.md)
- [Guia do PWA para iOS / iPadOS](installation/ios-pwa.md)
