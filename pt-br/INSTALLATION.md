# Instalação do Marinara Engine

Este guia ajuda a escolher a melhor forma de instalar Marinara Engine no seu dispositivo. Marinara roda na sua própria máquina, então os chats e os dados ficam locais. Cada plataforma abaixo tem um guia passo a passo próprio, com link na tabela.

## Escolha a plataforma

Escolha o guia que corresponde ao dispositivo onde você quer rodar Marinara.

| Plataforma | Guia de instalação |
|---|---|
| Windows | [Instalação no Windows](installation/windows.md) |
| macOS ou Linux | [Guia de instalação no macOS / Linux](installation/macos-linux.md) |
| Docker ou Podman | [Rodar em contêiner (Docker / Podman)](installation/containers.md) |
| Celular ou tablet Android | [Baixar APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) · [Guia de instalação no Android](installation/android-termux.md) |
| iPhone ou iPad | [Guia do PWA para iOS / iPadOS](installation/ios-pwa.md) |

Alguns pontos importantes antes da escolha:

- No **iPhone ou iPad**, Marinara não roda o servidor. O servidor fica em um computador, em um servidor doméstico ou em um dispositivo Android. Depois você abre o aplicativo no Safari do iPhone ou do iPad. O guia de iOS explica isso.
- No **Android**, Marinara roda dentro do **Termux**. Termux é um aplicativo gratuito que dá ao Android um pequeno ambiente Linux. Toque no link direto do APK, aceite os avisos obrigatórios de instalação e de permissão do Termux e deixe o aplicativo cuidar automaticamente da credencial privada do localhost. O instalador nunca pede credenciais de assinatura do Android nem esse segredo local.

## Qual devo escolher

Se você está começando agora e quer a configuração mais simples, escolha uma destas opções:

- No **Windows**, use o **instalador do Windows**. Ele baixa e configura tudo para você, e ainda cria um atalho na área de trabalho.
- No **Android**, use o link **Baixar APK** acima. Abra o arquivo baixado e toque em **Install / Start Marinara** no aplicativo.
- No **macOS**, no **Linux** ou em um servidor doméstico, use o **Docker**. Um único comando roda o aplicativo. A imagem já traz o Node.js, todas as dependências e uma cópia compilada do aplicativo. Assim você não precisa instalar o Node.js nem compilar o aplicativo por conta própria.

Se você se dá bem com o terminal e talvez queira editar o código, rode a partir do código-fonte. "Rodar a partir do código-fonte" significa baixar o código e compilar o aplicativo na sua máquina. Os guias de **Windows**, **macOS e Linux** e **Android (Termux)** cobrem esse caminho.

## Requisitos mínimos

- Você precisa de um computador ou dispositivo capaz de rodar um servidor: Windows, macOS, Linux ou Android.
- Para rodar a partir do código-fonte, você precisa do **Node.js** versão 24 e do **Git**. O Node.js executa o aplicativo, e o Git baixa e atualiza o código. Os guias de cada plataforma trazem os links dos dois downloads.
- Instalações com **Docker** e **Podman** não precisam do Node.js. A configuração recomendada com Compose ainda usa o Git para baixar os arquivos do projeto. O guia de contêiner explica isso.
- Por padrão, o aplicativo roda na sua própria máquina neste endereço:

```text
http://127.0.0.1:7860
```

- O endereço `127.0.0.1` significa o seu próprio computador, e `7860` é a porta padrão. Para acessar Marinara pelo celular ou por outro dispositivo da rede, veja o acesso pela rede local nas [Perguntas frequentes](FAQ.md).

## O que fazer depois da instalação

Com Marinara rodando e aberto no navegador, leia [Primeiros passos com Marinara Engine](home/welcome.md). O guia acompanha você nas primeiras etapas: adicionar uma conexão, criar ou importar um personagem e começar um chat.

Para manter a instalação em dia mais adiante, veja [Atualizando Marinara Engine](UPGRADING.md).

## Guias relacionados

- [Instalação no Windows](installation/windows.md)
- [Guia de instalação no macOS / Linux](installation/macos-linux.md)
- [Rodar em contêiner (Docker / Podman)](installation/containers.md)
- [Instalação no Android (Termux)](installation/android-termux.md)
- [Guia do PWA para iOS / iPadOS](installation/ios-pwa.md)
- [Atualizando Marinara Engine](UPGRADING.md)
- [Primeiros passos com Marinara Engine](home/welcome.md)
