# Guia de instalação no Android (Termux)

Neste guia você aprende a rodar Marinara Engine em um celular ou tablet Android. Marinara roda dentro do Termux, um ambiente Linux gratuito para Android. A instalação tem dois caminhos: o mais fácil, com o aplicativo Android, ou o manual, digitando os comandos no terminal do Termux.

## O que são Termux e F-Droid

Termux é um aplicativo gratuito que instala um pequeno sistema Linux e uma linha de comando no celular. Marinara Engine precisa dele porque Marinara é um servidor Linux, não um aplicativo Android nativo.

F-Droid é uma loja de aplicativos Android gratuita e de código aberto. A configuração automática do Marinara baixa a versão estável do Termux pelo F-Droid. O Termux também tem uma versão experimental separada no Google Play; se ela já estiver instalada, Marinara reconhece a assinatura oficial, mas o F-Droid continua sendo o caminho recomendado neste guia.

Instale o Termux pelo F-Droid neste endereço: [Termux no F-Droid](https://f-droid.org/en/packages/com.termux/). Não misture o Termux nem os aplicativos de plugin de fontes diferentes, pois as assinaturas precisam coincidir. Veja as [notas oficiais de instalação do Termux](https://github.com/termux/termux-app#installation) para os detalhes de cada fonte.

## Instalação pelo aplicativo Android (APK)

O caminho mais fácil usa o aplicativo Android do Marinara Engine. APK é o arquivo de instalação de um aplicativo Android. Esse aplicativo é um auxiliar pequeno: ele prepara o Termux para você e abre Marinara assim que o servidor local estiver rodando. O trabalho pesado continua sendo do Termux, então o Android vai pedir algumas autorizações do sistema no caminho. Instalar o APK pronto não exige chave de assinatura, senha, segredo de acesso local nem alteração em `CSRF_TRUSTED_ORIGINS`. O aplicativo gera e troca automaticamente a credencial privada do localhost. Não adicione `null` a `CSRF_TRUSTED_ORIGINS`; ele é tratado de propósito como não definido e a troca do APK não precisa dele.

1. Toque em [Baixar o APK mais recente do Android](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk).
2. Instale o APK e abra o aplicativo.
3. Toque em **Install / Start Marinara** (instalar / iniciar Marinara).
4. Se o Termux ainda não estiver instalado, aceite os avisos de instalação do Android para que o aplicativo possa baixar e instalar o Termux pelo F-Droid.
5. Quando o Android pedir, conceda a permissão **Run commands in Termux environment** (executar comandos no ambiente do Termux).
6. Se o Termux bloquear a preparação, o aplicativo copia um comando `allow-external-apps` para você. Cole esse comando no Termux uma vez e toque em **Install / Start Marinara** de novo.
7. Espere enquanto o Termux instala as dependências e compila Marinara. A primeira compilação leva alguns minutos.
8. Volte ao aplicativo Marinara Engine quando o Termux terminar. O aplicativo se conecta e faz login automaticamente quando o servidor local estiver pronto.

Se você quer um ícone na tela inicial que abre Marinara como um aplicativo comum, esse mesmo aplicativo Android faz isso. Ele é só uma casca em volta do servidor no Termux, então o servidor precisa estar configurado antes. Ele não consegue pular os avisos de instalação e de permissão do Android, mas não pede para você configurar nenhum segredo de instalação do Marinara.

## Instalação manual no Termux

Se preferir não usar o aplicativo, instale Marinara na mão. Abra o Termux e cole este comando único:

```
pkg update -y && pkg install -y git nodejs-lts && ([ -d "$HOME/Marinara-Engine/.git" ] || git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

Esse comando único faz cinco coisas:

1. Atualiza os pacotes do Termux.
2. Instala Git e Node.js. Marinara funciona com as versões 24, 25 e 26 do Node.js.
3. Baixa Marinara Engine, a menos que já esteja instalado.
4. Torna o inicializador (o script `start-termux.sh`) executável.
5. Roda o inicializador pela primeira vez.

O inicializador instala as dependências do aplicativo, compila Marinara no dispositivo e sobe o servidor local. Ele também atualiza o Node.js quando a versão instalada é antiga demais. A primeira execução é lenta porque compila o aplicativo. As seguintes são bem mais rápidas.

Quando terminar, abra este endereço no navegador do Android:

```
http://127.0.0.1:7860
```

Marinara escuta na porta definida por `PORT` (a porta de rede que o aplicativo usa). O padrão é 7860. Se você definiu outro valor na variável `PORT`, use esse número.

Dica: para ganhar um ícone parecido com o de um aplicativo, abra o menu do navegador e escolha a opção que adiciona Marinara à tela inicial. O nome exato dessa opção muda de navegador para navegador.

## Iniciar Marinara de novo

Depois da primeira configuração, não é preciso repetir a instalação. Abra o Termux e execute:

```
cd Marinara-Engine
./start-termux.sh
```

O inicializador procura atualizações e depois abre Marinara. Para iniciar a cópia atual sem consultar o GitHub, acrescente `--skip-update`:

```
cd Marinara-Engine
./start-termux.sh --skip-update
```

O inicializador também remove pacotes sem uso do cache local do pnpm durante a atualização das dependências. Assim as versões antigas não acumulam vários gigabytes no celular. Nada disso mexe nos chats, nas configurações ou em outros dados do usuário do Marinara.

## Acesso a partir de outro dispositivo

Por padrão, o inicializador deixa Marinara acessível na rede local. Ou seja, um notebook ou outro celular no mesmo Wi-Fi consegue abrir. Para o passo a passo de como descobrir o endereço certo, veja as [Perguntas frequentes](../FAQ.md).

## Atualização

Toda vez que você roda o inicializador (`./start-termux.sh`), ele consulta o GitHub em busca de uma versão mais nova e atualiza antes de iniciar. Então a forma mais simples de ficar sempre em dia é abrir Marinara normalmente.

Para iniciar a cópia instalada sem atualizar, use a opção de pular:

```
./start-termux.sh --skip-update
```

Para manter a versão instalada da Engine entre uma execução e outra, acrescente `AUTO_UPDATE_ENABLED=false` ao arquivo `.env` do projeto. Isso não desativa os comandos manuais de atualização nem o caminho **Settings → Advanced → Updates**.

Também é possível procurar atualizações dentro do aplicativo. Abra a seção **Settings** (Configurações), vá até a aba **Advanced** (avançado) e abra a seção **Updates** (atualizações). Clique em **Check for Updates** (procurar atualizações) para ver se existe uma versão mais nova. O botão **Apply Update** (aplicar a atualização) dentro do aplicativo vem desativado por padrão e precisa de configuração. Para saber como ativar e usar esse botão, veja [Atualizando Marinara Engine](../UPGRADING.md).

## Guias relacionados

- [Instalação do Marinara Engine](../INSTALLATION.md)
- [Guia do PWA para iOS / iPadOS](ios-pwa.md)
- [Atualizando Marinara Engine](../UPGRADING.md)
- [Perguntas frequentes](../FAQ.md)
