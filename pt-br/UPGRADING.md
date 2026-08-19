# Atualizando Marinara Engine

Este guia explica como atualizar Marinara Engine para uma versão mais nova. Aqui você vê todos os tipos de instalação, as ferramentas de atualização dentro do aplicativo e o que fazer quando uma atualização falha. Os chats e as configurações continuam intactos depois de atualizar.

## Os dados ficam preservados

Atualizar Marinara Engine não exclui nada. Chats, personagens, personas, lorebooks, presets, conexões e configurações continuam todos no lugar.

Marinara mantém os dados em uma pasta local, na máquina que roda o servidor. Docker e Podman mantêm tudo no volume `marinara-data`. A atualização troca apenas o código do aplicativo, e não essa pasta nem esse volume.

Ao atualizar a partir de uma versão que já vinha com agentes próprios, mapas, chamadas ou jogos de Conversation embutidos, a primeira inicialização baixa os pacotes opcionais correspondentes no catálogo oficial. As escolhas feitas nos chats, as configurações dos agentes, os dados de execução armazenados e o histórico são preservados. Mantenha o servidor online nessa primeira inicialização. Se o catálogo estiver fora do ar, Marinara repete a migração na próxima inicialização, em vez de excluir ou desativar a configuração armazenada.

Se você usa um idioma de documentação baixado (**Settings** (Configurações) → **General** → **Documentation Language**), a primeira inicialização depois de uma atualização também verifica se o pacote daquele idioma mudou e o atualiza sozinha. Se a origem do download estiver fora do ar, Marinara mantém o pacote instalado (os guias que faltarem nele aparecem em inglês) e tenta de novo na inicialização seguinte. A escolha de idioma nunca é redefinida por uma atualização.

Para saber onde os dados ficam e como salvar uma cópia, veja [Fazer backup e restaurar Marinara](data/backup-and-restore.md).

## Faça um backup antes

Atualizar é seguro, mas um backup é um seguro barato. Faça um antes de qualquer salto grande entre versões.

1. Abra **Settings**.
2. Vá até a aba **Advanced**.
3. Localize a seção **Backup & Export**.
4. Clique em **Download Backup** (baixar o backup).
5. Salve o arquivo `.zip` em um lugar seguro.

O botão muda para **Creating backup…** enquanto o processo roda. No fim, o navegador salva um arquivo `.zip` com os dados.

Os passos completos de backup e restauração estão em [Fazer backup e restaurar Marinara](data/backup-and-restore.md).

## Atualização por plataforma

Escolha a seção que corresponde à forma como você instalou Marinara. Onde se lê "git checkout" abaixo, entenda uma cópia instalada com a ferramenta Git. Um "clone" é uma cópia baixada com o Git.

### Windows

Se você usou o instalador do Windows ou um git checkout, o inicializador atualiza tudo sozinho.

1. Feche Marinara Engine.
2. Abra de novo pelo atalho do Menu Iniciar, ou execute `start.bat`.

O inicializador busca o código mais novo, reinstala o que mudou, recompila o aplicativo e inicia a nova versão. Isso vale tanto para o instalador quanto para um clone feito à mão.

Para uma única inicialização, execute `start.bat --skip-update`. Para manter a versão instalada do Engine em todas as inicializações, defina `AUTO_UPDATE_ENABLED=false` no arquivo `.env` do projeto. Isso desativa somente as atualizações automáticas do Engine; os comandos manuais e o botão **Settings → Advanced → Check for Updates** continuam disponíveis.

Se o inicializador avisar que o Node.js está velho demais, instale o Node.js 24 LTS e inicie Marinara de novo. LTS quer dizer Long Term Support, ou suporte de longo prazo: é a versão estável recomendada do Node.js.

Outra opção: baixe o instalador mais novo na página de Releases do GitHub e execute-o. Ele usa o mesmo caminho baseado em Git, então as próximas atualizações continuam passando pelo inicializador.

### macOS e Linux

Feche Marinara Engine e execute o inicializador na pasta onde Marinara está instalado.

```bash
./start.sh
```

O inicializador busca o código mais novo, reinstala as dependências que mudaram, recompila e inicia a nova versão.

Use `./start.sh --skip-update` para uma única inicialização, ou defina `AUTO_UPDATE_ENABLED=false` no arquivo `.env` para desativar de vez. Os comandos manuais de atualização e os controles dentro do aplicativo continuam disponíveis.

Se aparecer o aviso de que o Node.js está velho demais, instale o Node.js 24 LTS e execute o inicializador de novo.

### Docker ou Podman

Instalações em contêiner se atualizam pelo download de uma nova imagem, e não pelo inicializador. Execute isto na pasta que contém o arquivo Compose.

```bash
docker compose down && docker compose pull && docker compose up -d
```

No Podman, use os mesmos comandos com `podman`.

```bash
podman compose down && podman compose pull && podman compose up -d
```

As imagens de cada versão são publicadas como `ghcr.io/pasta-devs/marinara-engine:X.Y.Z` e `:latest`, junto com as tags `-lite` correspondentes. Baixe `:latest` ou a tag da versão mais nova, a não ser que você queira ficar em uma versão antiga de propósito. O pull não mexe nos dados do volume `marinara-data`.

### Android (Termux)

Termux é um terminal e ambiente Linux para Android. O inicializador dele atualiza Marinara toda vez que você o executa.

1. Abra o Termux.
2. Execute o inicializador.

```bash
cd Marinara-Engine
./start-termux.sh
```

O inicializador atualiza o código, atualiza o Node.js quando é preciso, recompila e inicia o servidor local.

Se uma atualização vier quebrada e você precisar continuar na cópia atual, pule a verificação de atualização.

```bash
cd Marinara-Engine
./start-termux.sh --skip-update
```

Para desativar de vez, defina `AUTO_UPDATE_ENABLED=false` no arquivo `.env` do projeto. Isso afeta somente as atualizações do Engine feitas pelo inicializador; as atualizações manuais e os controles dentro do aplicativo continuam disponíveis.

Se você usa o ícone do aplicativo Android (o APK), [baixe o APK mais recente](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) e abra o arquivo baixado para o Android atualizar o próprio invólucro. Depois abra Marinara Engine e toque em **Install / Start Marinara** para atualizar e iniciar a cópia do Termux. O aplicativo preserva e troca automaticamente a credencial privada do localhost; uma atualização nunca pede credenciais de assinatura nem esse segredo.

### iPhone e iPad

iPhone e iPad não rodam o servidor Marinara. Eles abrem, pelo Safari, um servidor que roda em outro dispositivo. A cópia na Tela de Início é um PWA, sigla de Progressive Web App. Um PWA é um site que você adiciona à Tela de Início e que abre como se fosse um aplicativo.

1. Atualize o computador, o host Docker ou o dispositivo Android que realmente roda o servidor Marinara. Use a seção correspondente acima.
2. Recarregue o PWA da Tela de Início ou a aba do Safari no iPhone ou no iPad.

Se o Safari continuar mostrando uma versão antiga depois de o host ser atualizado, limpe a cópia em cache.

1. Remova o ícone da Tela de Início.
2. Limpe os dados de site do Safari referentes ao host do Marinara.
3. Adicione o ícone à Tela de Início de novo.

## Verificar e aplicar atualizações dentro do aplicativo

Marinara consulta o GitHub para ver se existe uma versão mais nova, sem você sair do aplicativo. Algumas instalações também aplicam a atualização direto pelo navegador.

1. Abra **Settings**.
2. Vá até a aba **Advanced**.
3. Localize a seção **Updates**.

### Release Channel

O menu suspenso **Release Channel** (canal de versões) define quais compilações você acompanha. Ele tem duas opções.

- **Latest Stable**: acompanha as versões marcadas como `vX.Y.Z`. É a escolha normal para a maioria dos usuários.
- **Staging/UAT**: acompanha as compilações de teste, anteriores ao lançamento. Elas podem estar inacabadas. Faça backup dos dados antes de usá-las.

Ao escolher **Staging/UAT**, aparece o aviso: "Staging builds are pre-release tester builds. Back up your app data before applying them."

Trocar de canal é tratado como uma escolha deliberada. Quando você escolhe outro canal em um navegador na máquina que roda o servidor, o botão de atualização muda para **Switch to** seguido do nome do canal, e funciona mesmo com as atualizações dentro do aplicativo desligadas. Enquanto roda, ele mostra **Switching…**. As atualizações normais, dentro do mesmo canal, ainda exigem a configuração descrita em Apply Update abaixo, e os dispositivos remotos exigem sempre.

### Check for Updates

Clique em **Check for Updates** (verificar atualizações). O botão mostra **Checking…** enquanto trabalha.

Abaixo do botão aparecem a versão em **Release** e o código de commit em **Build**. Uma linha **Branch** também aparece quando o branch é conhecido.

- Se você já está em dia, uma linha verde com um sinal de confirmação diz "You're on the latest ... target", junto com a versão.
- Se existe uma versão mais nova, um card mostra "vX.Y.Z available" com um link **Release notes**.
- Em uma instalação via Git que está apenas atrasada, o card mostra "N commits behind". Um commit é uma alteração salva no código, então essa contagem pode incluir trabalho ainda não lançado.

Os resultados da verificação ficam em cache. A verificação da versão de lançamento fica em cache por cerca de 15 minutos. A contagem de "commits behind" fica em cache por cerca de 5 minutos. Clicar em **Check for Updates** logo em seguida pode mostrar os mesmos números.

### Apply Update

O botão **Apply Update** (aplicar a atualização) só aparece quando a instalação consegue se atualizar pelo navegador. Para isso, as duas condições abaixo precisam ser atendidas.

- A instalação é baseada em Git (instalações em Docker e instalações empacotadas não atualizam por esse caminho).
- O dono do servidor definiu `UPDATES_APPLY_ENABLED=true` no arquivo `.env` do servidor. O arquivo `.env` reúne as configurações do servidor.

Se você clicar em **Apply Update** na própria máquina que roda o servidor, isso já basta. Nenhum segredo é exigido ali.

Aplicar a atualização de outro dispositivo vem desativado por padrão. Nesse caso, as três condições abaixo precisam ser atendidas.

- O dono do servidor definiu `UPDATES_ALLOW_REMOTE_APPLY=true` no arquivo `.env`.
- O dono do servidor definiu `ADMIN_SECRET` (uma senha para ações protegidas) no arquivo `.env`.
- Você salvou esse mesmo segredo em **Settings -> Advanced -> Admin Access** no seu dispositivo.

Ao clicar em **Apply Update**, o botão mostra **Updating...**. O servidor busca o código novo, reinstala as dependências, recompila e então se desliga. Em seguida aparece: "Update applied successfully. Please relaunch the app to use the new version." Inicie Marinara de novo para concluir.

Quando **Apply Update** não está disponível, Marinara explica o motivo e o que fazer no lugar.

- Instalações em contêiner mostram a tag da imagem e o comando `docker compose pull && docker compose up -d` para você rodar no host.
- Instalações via Git com a aplicação desligada mostram um comando de atualização manual que você pode copiar.
- As demais instalações mostram um link **Download** para a versão no GitHub.

Se a própria verificação falhar, aparece: "Could not check for updates. Try again later." Isso costuma indicar um problema de rede ou do GitHub, então tente de novo daqui a pouco.

## O botão Refresh App

O botão **Refresh App** (atualizar o aplicativo) fica na mesma seção **Updates**. Ele não atualiza o servidor. Ele apenas recarrega o aplicativo no navegador que você está usando.

**Refresh App** remove o registro do service worker, limpa os caches do navegador e recarrega a página. Um service worker é um pequeno script que o navegador usa para abrir o aplicativo rápido e offline. Os chats, as configurações e os demais dados locais continuam intactos.

Use **Refresh App** quando o aplicativo parecer desatualizado ou mostrar uma tela em branco depois de uma atualização, mas o servidor já estiver rodando a versão nova. Isso resolve uma página travada. Como não muda o código do servidor, não substitui uma atualização de verdade.

O botão mostra **Refreshing…** enquanto trabalha, e depois o aplicativo recarrega.

## Como voltar para uma versão anterior

As atualizações são sempre seguras, mas nem sempre é possível voltar diretamente. As versões novas do Marinara armazenam as mensagens de chat em um formato mais recente no disco, que uma versão anterior ao formato dos dados não consegue ler. Para proteger o histórico, o inicializador ignora atualizações automáticas que levariam a uma versão incompatível e o atualizador do aplicativo se recusa a aplicá-las.

Se você precisar de uma versão anterior mesmo assim, um comando de conversão coloca primeiro os dados no formato antigo. Consulte [Os chats não mostram mensagens depois de trocar para uma versão anterior](TROUBLESHOOTING.md#chats-show-no-messages-after-switching-to-an-older-version) para ver as etapas.

## Quando a atualização falha

A maior parte dos problemas de atualização vem de uma versão antiga do Node.js, de um download incompleto ou de um cache velho no navegador.

- Se o inicializador disser que o Node.js está velho demais, instale o Node.js 24 LTS e inicie de novo.
- Se o aplicativo parecer quebrado depois de o servidor ter sido atualizado, use o botão **Refresh App** descrito acima.
- Se uma instalação via Git não conseguir atualizar direito, execute os comandos manuais de atualização da sua plataforma, que estão no guia de instalação correspondente.

Para mensagens de erro e soluções passo a passo, veja [Solução de problemas do Marinara Engine](TROUBLESHOOTING.md).

## Guias relacionados

- [Fazer backup e restaurar Marinara](data/backup-and-restore.md)
- [Solução de problemas do Marinara Engine](TROUBLESHOOTING.md)
- [Guia de instalação no Windows](installation/windows.md)
- [Guia de instalação no macOS / Linux](installation/macos-linux.md)
- [Rodar em contêiner (Docker / Podman)](installation/containers.md)
- [Guia de instalação no Android (Termux)](installation/android-termux.md)
- [Guia do PWA para iOS / iPadOS](installation/ios-pwa.md)
