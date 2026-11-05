# Guia de instalação no Android (Termux)

Rode Marinara Engine em um celular ou tablet Android. Marinara roda dentro do Termux, um aplicativo gratuito que dá ao celular um pequeno sistema Linux. Você pode configurá-lo com o aplicativo Android do Marinara (o jeito mais fácil) ou à mão, no Termux.

## Sobre o Termux e o F-Droid

Marinara é um servidor Linux, não um aplicativo Android nativo, então precisa do Termux para rodar. F-Droid é uma loja de aplicativos gratuita e de código aberto. A configuração do aplicativo Android baixa a versão estável do Termux pelo F-Droid. O Termux também tem uma versão experimental no Google Play. Se ela já estiver instalada, Marinara a aceita, mas este guia recomenda o F-Droid.

Instale o Termux pela página [Termux no F-Droid](https://f-droid.org/en/packages/com.termux/). Não misture o Termux nem os aplicativos de plugin dele de fontes diferentes, pois as assinaturas precisam coincidir. Veja as [notas oficiais de instalação do Termux](https://github.com/termux/termux-app#installation).

## Instalação pelo aplicativo Android

O aplicativo Android do Marinara Engine configura o Termux e depois abre Marinara quando o servidor local estiver rodando. No caminho, o Android pede que você aprove alguns avisos do sistema.

1. Toque em [Baixar o APK mais recente do Android](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). APK é o arquivo de instalação de um aplicativo Android.
2. Instale o APK e abra o aplicativo.
3. Toque em **Install / Start Marinara** (instalar / iniciar Marinara).
4. Se o Termux não estiver instalado, aprove os avisos de instalação do Android, inclusive a permissão para o aplicativo instalar aplicativos, para que ele consiga instalar o Termux pelo F-Droid.
5. Quando o Android pedir, conceda a permissão **Run commands in Termux environment** (executar comandos no ambiente do Termux).
6. Se o Termux bloquear a configuração, o aplicativo copia um comando `allow-external-apps` e abre o Termux. Toque e segure a tela do Termux, toque em **Paste** (colar), pressione Enter, depois volte e toque em **Install / Start Marinara** de novo.
7. Espere enquanto o Termux instala as dependências (as partes de que o aplicativo precisa) e compila Marinara. O Termux mostra um texto rolando na tela. A primeira compilação leva alguns minutos.
8. Volte ao aplicativo Marinara Engine quando o Termux terminar. Ele se conecta e faz login por conta própria quando o servidor estiver pronto, e você vê a tela inicial do Marinara.

Para usar o navegador em vez do aplicativo, selecione **Open in browser** (abrir no navegador) no inicializador do aplicativo. O aplicativo lembra da escolha, e o login também é automático no navegador.

Se não funcionou: resolva o aviso que bloqueou a instalação e toque em **Install / Start Marinara** de novo. Se o aplicativo não conseguir abrir o localhost, atualize o APK e toque em **Install / Start Marinara**. Veja [Ajuda com o login do localhost no Android](../TROUBLESHOOTING.md#android-localhost-opens-the-login-page-or-returns-401503).

O aplicativo não precisa de chave de assinatura, senha nem alteração em `CSRF_TRUSTED_ORIGINS`. Ele cria a própria credencial privada do localhost. Não adicione `null` a `CSRF_TRUSTED_ORIGINS`.

## Instalação manual no Termux

Use este caminho se você não quiser o aplicativo. Abra o Termux, toque e segure a tela e toque em **Paste** para colar este comando (copie o comando inteiro):

```bash
pkg upgrade -y && pkg install -y git nodejs-lts && \
([ -d "$HOME/Marinara-Engine/.git" ] || \
  git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && \
cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

Em ordem, ele:

1. Atualiza todos os pacotes do Termux. Um Node.js mais novo não consegue iniciar com bibliotecas mais antigas do Termux, então o Termux precisa de uma atualização completa. Se ele perguntar se você quer manter um arquivo de configuração, pressione Enter para manter o seu.
2. Instala o Git e o Node.js. Marinara funciona com o Node.js 24, 25 e 26.
3. Baixa Marinara, a menos que ele já esteja lá.
4. Torna o inicializador (`start-termux.sh`) executável e o executa.

O inicializador instala as dependências, compila Marinara no dispositivo e sobe o servidor local. Ele atualiza o Node.js se a sua versão for antiga demais. A primeira execução é lenta, e o Termux mostra um texto rolando na tela. As execuções seguintes são mais rápidas.

Quando ele avisar que o servidor está rodando, abra este endereço no navegador do Android:

```text
http://127.0.0.1:7860
```

Se você definiu outro `PORT`, use esse número. Para ter um ícone parecido com o de um aplicativo, use a opção do menu do navegador que adiciona a página à tela inicial. O nome dessa opção muda de navegador para navegador.

## Iniciar e parar Marinara

Com o aplicativo, abra-o e toque em **Install / Start Marinara** se o servidor estiver parado. Para alternar entre o aplicativo e o navegador, use **Open in browser** no inicializador e depois **Retry connection** (tentar conectar novamente). De dentro do aplicativo, volte ao inicializador por **Settings → General → App Behavior → Open Android launcher (app or browser)** (Configurações → Geral → Comportamento do aplicativo → Abrir o inicializador Android: aplicativo ou navegador).

Em uma instalação manual, abra o Termux e execute:

```bash
cd Marinara-Engine
./start-termux.sh
```

Para parar o servidor, pressione <kbd>Ctrl</kbd>+<kbd>C</kbd> no Termux.

## Atualizar Marinara

Toda vez que você roda `./start-termux.sh`, o inicializador consulta o GitHub em busca de uma versão mais nova e atualiza antes de iniciar. Para iniciar sem atualizar, acrescente `--skip-update`. Para mais opções e os passos de atualização do APK, veja [Atualizando Marinara Engine](../UPGRADING.md#android-termux).

Durante as atualizações, o inicializador também remove pacotes sem uso do cache local do pnpm. Assim as versões antigas não ocupam vários gigabytes de armazenamento. Isso não mexe nos seus chats nem nas suas configurações.

## Abrir Marinara a partir de outro dispositivo

O inicializador deixa outros dispositivos do seu Wi-Fi alcançarem Marinara, mas os bloqueia até você definir um login. Veja as [Perguntas frequentes](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) e o guia [Acesso remoto](../REMOTE_ACCESS.md).

Se outro dispositivo não conseguir fazer login depois de uma atualização, veja [Bloqueado depois de atualizar](../REMOTE_ACCESS.md#locked-out-after-updating). No Termux, este comando remove o login do aplicativo e desconecta todos os navegadores:

```bash
cd "$HOME/Marinara-Engine" && node scripts/reset-login.mjs
```

## Guias relacionados

- [Instalação do Marinara Engine](../INSTALLATION.md)
- [Guia do PWA para iOS / iPadOS](ios-pwa.md)
- [Atualizando Marinara Engine](../UPGRADING.md)
- [Perguntas frequentes](../FAQ.md)
