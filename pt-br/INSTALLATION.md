# Instalação do Marinara Engine

Marinara roda no seu próprio dispositivo. Escolha abaixo o guia do seu dispositivo.

## Escolha a plataforma

| Seu dispositivo | Guia |
| --- | --- |
| Windows | [Instalação no Windows](installation/windows.md) |
| macOS ou Linux | [Guia de instalação no macOS / Linux](installation/macos-linux.md) |
| Docker ou Podman | [Rodar em contêiner (Docker / Podman)](installation/containers.md) |
| Celular ou tablet Android | [Guia de instalação no Android](installation/android-termux.md) |
| iPhone ou iPad | [Guia do PWA para iOS / iPadOS](installation/ios-pwa.md) |

## Qual devo escolher?

- **Windows:** use o instalador do Windows. Ele configura tudo e cria um atalho na área de trabalho.
- **Android:** [baixe o APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Abra o arquivo baixado e toque em **Install / Start Marinara** (instalar / iniciar Marinara) no aplicativo.
- **macOS, Linux ou um servidor doméstico:** escolha uma das duas opções. O guia nativo roda Marinara direto no computador com um script de inicialização. O Docker não precisa de Node.js e não compila nada, mas você precisa instalar o Docker antes.
- **iPhone ou iPad:** Marinara não consegue rodar o servidor nesses dispositivos. Rode o servidor em um computador, em um servidor doméstico ou em um dispositivo Android e depois abra Marinara no Safari. O guia de iOS explica como.
- **Você quer editar o código:** rode a partir do código-fonte. Isso significa baixar o código e compilar o aplicativo no seu dispositivo. Os guias de Windows, de macOS e Linux e de Android cobrem esse caminho.

No Android, Marinara roda dentro do **Termux**, um aplicativo Android gratuito que dá ao celular um pequeno sistema Linux. O APK configura o Termux para você.

## Do que você precisa

- Para rodar a partir do código-fonte: **Node.js** 24, 25 ou 26, e **Git**. O Node.js executa o aplicativo. O Git baixa o código e o atualiza. Os guias de cada plataforma trazem os links dos dois downloads.
- Para Docker ou Podman: sem Node.js. A configuração recomendada com Compose usa o Git uma vez, para baixar os arquivos do projeto.

## Abrir Marinara

Com Marinara rodando, abra este endereço em um navegador no mesmo dispositivo. Não use esse endereço a partir de outro dispositivo.

```text
http://127.0.0.1:7860
```

`127.0.0.1` significa este dispositivo. `7860` é a porta padrão, o número em que o aplicativo escuta. Os inicializadores (os scripts que iniciam Marinara) também deixam outros dispositivos da sua rede alcançá-lo, mas esses dispositivos ficam bloqueados até você definir um login. Uma instalação com Docker ou Podman só responde neste dispositivo até você mudar a linha da porta; veja [Contêineres](installation/containers.md#open-marinara-from-another-device).

## Abrir Marinara no celular

1. Instale e inicie Marinara em um computador, em um servidor doméstico ou em um celular Android.
   Com Docker ou Podman, siga antes [Abrir Marinara a partir de outro dispositivo](installation/containers.md#open-marinara-from-another-device).
2. Defina um login nesse dispositivo. Veja [Acesso remoto](REMOTE_ACCESS.md#option-1-login-recommended).
3. Descubra o endereço IP desse dispositivo. As [Perguntas frequentes](FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) mostram como.
4. No celular, abra `http://` seguido do endereço IP e de `:7860`.

Para iPhone, veja [Guia do PWA para iOS / iPadOS](installation/ios-pwa.md).

## Depois de instalar

Leia [Primeiros passos com Marinara Engine](home/welcome.md) para adicionar uma conexão, criar ou importar um personagem e começar um chat. Para atualizar mais tarde, veja [Atualizando Marinara Engine](UPGRADING.md).

## Guias relacionados

- [Instalação no Windows](installation/windows.md)
- [Guia de instalação no macOS / Linux](installation/macos-linux.md)
- [Rodar em contêiner (Docker / Podman)](installation/containers.md)
- [Instalação no Android (Termux)](installation/android-termux.md)
- [Guia do PWA para iOS / iPadOS](installation/ios-pwa.md)
- [Atualizando Marinara Engine](UPGRADING.md)
- [Primeiros passos com Marinara Engine](home/welcome.md)
