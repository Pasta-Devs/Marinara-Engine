# Marinara Engineのインストール

Marinaraは自分のデバイスで動きます。下の表から、使っているデバイスに合ったガイドを選んでください。

## プラットフォームを選ぶ

| 使っているデバイス | ガイド |
| --- | --- |
| Windows | [Windowsインストールガイド](installation/windows.md) |
| macOSまたはLinux | [macOS / Linuxインストールガイド](installation/macos-linux.md) |
| DockerまたはPodman | [コンテナーでの実行(Docker / Podman)](installation/containers.md) |
| Androidのスマートフォンやタブレット | [Androidインストールガイド](installation/android-termux.md) |
| iPhoneやiPad | [iOS / iPadOS](installation/ios-pwa.md) |

## どれを選べばよいか?

- **Windows:** Windowsインストーラーを使います。すべてを設定し、デスクトップにショートカットも作ります。
- **Android:** [APKをダウンロード](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk)します。ダウンロードしたファイルを開き、アプリで**Install / Start Marinara**(Marinaraのインストール/起動)をタップします。
- **macOS、Linux、または家庭内のサーバー:** どちらかを選びます。ネイティブのガイドでは、ランチャースクリプトを使ってMarinaraをコンピューター上で直接動かします。DockerならNode.jsは不要で、ビルドも行いませんが、先にDockerをインストールする必要があります。
- **iPhoneやiPad:** これらのデバイスではMarinaraのサーバーを動かせません。コンピューター、家庭内のサーバー、Androidデバイスのいずれかでサーバーを動かし、Safariで開きます。手順はiOSのガイドで説明しています。
- **コードを編集したい場合:** ソースから実行します。コードをダウンロードし、自分のデバイスでアプリをビルドする方法です。Windows、macOSとLinux、Androidの各ガイドが、いずれもこの方法を扱っています。

Androidでは、Marinaraは**Termux**の中で動きます。Termuxは、スマートフォンに小さなLinuxシステムを用意する無料のAndroidアプリです。Termuxの準備はAPKが代わりに行います。

## 必要なもの

- ソースから実行する場合: **Node.js**のバージョン24、25、26のいずれかと、**Git**が必要です。Node.jsはアプリを動かします。Gitはコードをダウンロードし、アップデートします。どちらのダウンロード先へのリンクも、プラットフォームごとのガイドにあります。
- DockerまたはPodmanの場合: Node.jsは不要です。推奨しているCompose構成では、プロジェクトのファイルをダウンロードするために、Gitを一度だけ使います。

## Marinaraを開く

Marinaraが動いているときは、同じデバイスのブラウザーで次のアドレスを開きます。このアドレスは別のデバイスからは使わないでください。

```text
http://127.0.0.1:7860
```

`127.0.0.1`はこのデバイスを指します。`7860`はデフォルトのポートで、アプリが待ち受ける番号です。ランチャー(Marinaraを起動するスクリプト)は、同じネットワーク上のほかのデバイスからもMarinaraに届くようにしますが、ログインを設定するまでそれらのデバイスはブロックされたままです。DockerまたはPodmanでインストールした場合は、ポートの行を変更するまで、このデバイスからの接続にしか応答しません。[コンテナー](installation/containers.md#open-marinara-from-another-device)を参照してください。

## スマートフォンでMarinaraを開く

1. コンピューター、家庭内のサーバー、AndroidスマートフォンのいずれかにMarinaraをインストールして起動します。
   DockerまたはPodmanの場合は、先に[別のデバイスからMarinaraを開く](installation/containers.md#open-marinara-from-another-device)の手順に従ってください。
2. そのデバイスでログインを設定します。[リモートアクセス](REMOTE_ACCESS.md#option-1-login-recommended)を参照してください。
3. そのデバイスのIPアドレスを調べます。方法は[よくある質問](FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device)で説明しています。
4. スマートフォンで、`http://`の後にIPアドレスと`:7860`を続けたアドレスを開きます。

iPhoneの場合は、[iOS / iPadOS](installation/ios-pwa.md)を参照してください。

## インストールが終わったら

接続の追加、キャラクターの作成やインポート、チャットの開始については、[Marinara Engineをはじめる](home/welcome.md)を読んでください。後からアップデートするには、[Marinara Engineのアップデート](UPGRADING.md)を参照してください。

## 関連ガイド

- [Windowsインストールガイド](installation/windows.md)
- [macOS / Linuxインストールガイド](installation/macos-linux.md)
- [コンテナーでの実行(Docker / Podman)](installation/containers.md)
- [Android(Termux)インストールガイド](installation/android-termux.md)
- [iOS / iPadOS](installation/ios-pwa.md)
- [Marinara Engineのアップデート](UPGRADING.md)
- [Marinara Engineをはじめる](home/welcome.md)
