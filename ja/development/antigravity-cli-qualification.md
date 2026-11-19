# Antigravity CLIのサブスクリプション連携に必要な条件の確認

これは[#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143)の開発者向け調査メモです。2026-10-23に初回の確認を行い、2026-11-19にWindows向け公式リリースの`agy` 1.5.11と1.5.12で再確認しました。Marinara EngineにAntigravityのサブスクリプション接続は**実装されていません**。このIssueは対応予定なしとしてクローズされたままです。カスタムエージェントの除外設定で今回の試験対象のフックは止まりましたが、グローバルに検出されたプラグインのMCPサブプロセスは両方のリリースで起動しました。実行分離の要件はまだ満たされていません。

## 確認済みの公式インターフェース

公式CLIの`agy`は、保存済みのアカウント認証情報によるログインと、対話画面を使わないテキスト生成に対応しています。文書化されたプロトコルには`init`、`step_update`、`result`イベントがあり、ストリーミング入力ではJSON形式のユーザーメッセージをstdinに渡します。Windowsでの再確認では、`agy models`に`gemini-4-neon-high`が表示され、ユーザーが既にログインしていたGoogle AI Proアカウントで、そのモデルへの時間制限付きリクエストが成功しました。アカウントで利用できるモデルは、例をもとに推測せず、インストール済みのCLIから取得してください。`--print-timeout 0`は完了まで待機し、`--disable-slash-commands`はprintモードでのコマンド展開を無効にします。[ヘッドレスモード](https://antigravity.google/docs/cli/headless/)と[CLIフラグのリファレンス](https://antigravity.google/docs/cli/reference/)を参照してください。

CLIのアカウントログインは、OSの認証情報ストアを使用します。別途用意されたGemini APIキーモードには`modelProvider: "gemini"`と`GEMINI_API_KEY`が必要です。サブスクリプションアダプターが、この課金経路を黙って選択してはいけません。Python SDKで文書化されているプログラムからの認証方法は、Gemini APIキー、Vertex/Google Cloudの認証情報、ローカルモデルです。これらの方法は、SDKによる代替実装で個人向けサブスクリプション認証が使えることを示すものではありません。[認証](https://antigravity.google/docs/install/#programmatic-authentication)と[SDKの概要](https://antigravity.google/docs/sdk/overview/)を参照してください。

## 現在の実行分離の結果

公式のカスタムエージェント定義には、ツール、MCP、カスタマイズの制御が用意されています。プラグインガイドによると、`inheritCustomizations`は継承するスキル、ルール、フックを、`inheritMcp`は継承するワークスペースのMCPサーバーを制御します。`excludeDefaultComponents: true`の当初の告知では、モデル呼び出し後のフックを保持すると明記しているため、そのフラグ単独では分離を保証できません。以下の組み合わせでは、1.5.11で検証用のフックを止められましたが、すべてのMCPサブプロセスの起動は防げませんでした。[カスタムサブエージェント](https://antigravity.google/docs/subagents/)、[プラグインの作成](https://antigravity.google/docs/build-plugins/)、[CLIの変更履歴](https://antigravity.google/docs/changelog)を参照してください。

フックは、ワークスペース、グローバルな`~/.gemini/config/hooks.json`、インストール済みプラグインから読み込まれる場合があります。対象には、セッション、モデル呼び出し、ツール、停止のイベントが含まれます。現在の設定ドキュメントと[公式の設定スキーマ](https://antigravity.google/schemas/v1/settings.json)には、`settings.json`の`hooks`項目は読み込まれないと明記されています。そこに空の項目を書いても、実際のフックの読み込み元は無効になりません。[フック](https://antigravity.google/docs/hooks)と[CLI設定](https://antigravity.google/docs/settings?tab=cli)を参照してください。

インストール済みの1.5.11のヘルプには、`--settings`で`settings.json`のキーをセッション内でのみ上書きでき、値は直接かファイルで渡せるとあります。永続設定を変更せず、ワークスペースの信頼や権限を一時的に設定できます。別の設定プロファイルにはなりません。`--settings '{"hooks":{}}'`は、終了コード1と`unknown setting "hooks"`を返します。フックを無効にするオプションも、認証を維持した分離プロファイルのオプションも、ヘルプには見当たりませんでした。

現在の設定ドキュメントでは、`/hooks`でフックを追加、編集、切り替えでき、変更は設定ファイルに保存されると説明しています。再確認では、ヘッドレスの`-p "/hooks" --output-format json`が構造化された一覧を返しました。一覧や保存済みの切り替え状態は、その後の呼び出しで実行可能なカスタマイズが除外されることを保証しません。作業ディレクトリーの変更、空の`tools`一覧、ツールの使用を避ける指示、起動後の中断だけでは、実行分離を証明できません。

サードパーティーの連携報告は、調査の手がかりです。無作用のツール、エージェントの解決ログ、カスタマイズの継承に関する主張は、Engineが依存する保証にする前に、公式リリースで再現する必要があります。

## 2026年10月のリリース調査

[公式インストーラー](https://antigravity.google/cli/install.sh)と[Darwin ARM64リリースマニフェスト](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json)を、インストーラーを実行せずに調べました。マニフェストが選択したのは、[バージョン付きの`agy` 1.4.6 Darwin ARM64アーカイブ](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz)と、次のアーカイブSHA-512です。

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

アーカイブのチェックサムは一致しました。バイナリーは、この作業専用の一時ディレクトリーに展開しました。実行したのは`--version`と`--help`のみで、ネットワークアクセス、ホームディレクトリーの読み書き、キーチェーンサービスへのアクセスを拒否するmacOSサンドボックス内で行いました。どちらも正常終了しました。ヘルプには、フックの無効化、分離したプロファイル、設定ディレクトリーに関するオプションはありませんでした。

この調査では、CLIのインストールや認証、認証情報の確認、モデル呼び出し、ログイン済みアカウントのモデル列挙、フック実行のテストは**行っていません**。公開されているフラグ一覧を裏付けるものであり、分離が不可能だと証明したり、サブスクリプション経由の生成を検証したりするものではありません。

## 2026年11月のWindowsでの検証

インストール済みの`agy`のバージョンは1.5.11でした。SHA-512は[公式のWindows AMD64マニフェスト](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json)で確認したチェックサムと一致しましたが、その時点のマニフェストの応答は保存しませんでした。随時更新されるマニフェストは、その後1.5.12に切り替わりました。レビュー中に[バージョン指定の1.5.11 Windows実行ファイル](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.11-6132547114106880/windows-x64/cli_windows_x64.exe)を別途ダウンロードし、実行せずにハッシュを計算しました。234,827,416バイトのファイルのSHA-512は、インストール済みの実行ファイルの値と一致しました。

```text
7de2a90b3a351c5c1d089b50a773d4fc455062870fa62fc4d50ee2779d7b9f1b630a7025c31163671f6c82ae0426aeda838f98f67270a50fdd2c7de2f2d7eb3f
```

検証専用の一時ワークスペースで、`.agents/agents/me-isolation-probe.md`に次のフロントマターを設定して試験を行いました。

```yaml
name: me-isolation-probe
description: Harmless execution-isolation qualification fixture.
mainAgent: true
subagent: false
tools: []
inheritCustomizations: false
inheritMcp: false
excludeDefaultComponents: true
commandExecutionPolicy: off
```

公式の[カスタムエージェントのフロントマターのリファレンス](https://antigravity.google/docs/subagents/)には、`mainAgent`、`subagent`、`tools`、`commandExecutionPolicy`の記載があります。継承と除外の制御は、上で参照したプラグインガイドと変更履歴に説明があります。検証では設定を組み合わせて試したため、エージェントが選択できたことだけでは、各フィールドの適用を個別には確認できません。

生成には`--settings <session-settings-json> --agent me-isolation-probe --model gemini-4-neon-high --disable-slash-commands --print-timeout 40s --output-format stream-json -p <prompt>`を使い、サブプロセスには別途55秒の制限を設けました。インラインのJSON設定で、一時ワークスペースを信頼し、デフォルトのエージェントモードを選択し、カスタムのステータスとタイトルのスクリプトを無効にし、下記の権限モードを指定しました。権限の確認は省略していません。

設定オブジェクトは以下の形式で、`<temporary-workspace>`に検証用ディレクトリー、`toolPermission`に表の各行の権限モードを指定しました。

```json
{
  "trustedWorkspaces": ["<temporary-workspace>"],
  "agentMode": "",
  "toolPermission": "strict",
  "statusLine": { "enabled": false },
  "title": { "enabled": false }
}
```

検証用サブプロセスの環境からAPIキーとADCを指定する環境変数を取り除きました。認証情報は抽出もコピーもしていません。

検証用フックは`SessionStart`、`PreInvocation`、`PostInvocation`、`Stop`のイベント名を個別のマーカーファイルに追記しました。ローカルのPython MCPテスト用サーバーは、stdioで`initialize`と`tools/list`に応答する前に起動マーカーを追記しました。ワークスペースのMCP設定には`.agents/mcp_config.json`を使いました。各プラグインは`plugin.json`、`hooks.json`、`mcp_config.json`を持ち、[カスタマイズの検出](https://antigravity.google/docs/customization-discovery/)で説明されているとおり、`.agents/plugins.json`または`~/.gemini/config/plugins.json`の`entries`マニフェストから検出されました。フック、MCP、ファイル読み取りの対照試験では、同じ検証用データとセッション設定から`--agent`のみを省きました。存在しない名前の試験では、有効な`--agent me-isolation-probe`と、解決できない名前を比較しました。

| 検証項目 | 対照試験 | カスタムエージェント |
| --- | --- | --- |
| ワークスペースとグローバルのフック、およびワークスペースで検出されたプラグインのフック(`strict`権限) | 各ソースの4つのイベントすべてがマーカーを書き込んだ | フックのマーカーなし |
| ワークスペースのMCPとワークスペースで検出されたプラグインのMCP(`strict`権限) | 両サブプロセスが起動マーカーを書き込んだ | 起動マーカーはどちらも出なかった |
| グローバルに検出されたプラグインのフック(`request-review`権限) | 4つのイベントすべてがマーカーを書き込んだ | フックのマーカーなし |
| グローバルに検出されたプラグインのMCP(`request-review`権限) | サブプロセスが起動マーカーを書き込んだ | サブプロセスは起動マーカーを書き込んだ |
| 推測できないテスト値を`view_file`で明示的に読み取るリクエスト(`request-review`権限) | テスト値を返した | `FILE_UNAVAILABLE`を返し、テスト値は返さなかった |
| 存在しない`--agent`名(`strict`権限) | `--agent me-isolation-probe`で生成が完了した | 無効な名前では終了コード1、エラー結果、使用量0となり、フックとMCPのマーカーは出なかった |

グローバルに検出されたプラグインのMCPについて、`strict`権限で、各呼び出しに新しい起動マーカーパスを使って2回再試験しました。カスタムエージェントのリクエストはどちらも終了コード0で、両サブプロセスがマーカーを書き込みました。以前の対照試験の書き込みが遅れても、新規パスへは書き込めません。生成された返信はMCPツールを使いませんでしたが、実行を防げない問題は残っています。

ファイル読み取りのプロンプトは`Use view_file to read <fixture-path> and reply with its exact contents. Do not guess.`で、パスには一時テストファイルの絶対パスを入れました。カスタムエージェントのMarkdown本文には、読み取れない場合に`FILE_UNAVAILABLE`と返信するよう指示しました。

調査中に公式マニフェストが更新されたため、[1.5.12のWindows実行ファイル](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe)を検証専用ディレクトリーへダウンロードしました。インストール済みCLIは置き換えていません。保存した以下のマニフェストの応答でSHA-512を検証しました。

```json
{
  "version": "1.5.12",
  "url": "https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe",
  "sha512": "64603ba45b2783587edc62fd9effa9228091593b440ed54368e098bb5fb3ee034bada58c4125e3c0e509ed460b327e454dc99971d04d47c7aee417f00f56d801"
}
```

1.5.12では同じ既存ログインと`request-review`権限で、グローバルに検出されたプラグインとファイル読み取りについて、対照試験とカスタムエージェントの試験を再実施しました。対照試験はプラグインのフックの全イベントを実行し、MCPサブプロセスを起動してテスト値を返しました。カスタムエージェントは`FILE_UNAVAILABLE`を返し、フックを止めましたが、MCPサブプロセスは起動しました。生成リクエストはどちらも終了コード0でした。表のほかの行は1.5.11でのみ試験しました。

ストリームの`init.agent`には選択したカスタムエージェントが表示され、1.5.11で別のプロンプトを送ると、そのエージェントのMarkdown本文だけに定義したマーカーが返されました。一方、`init.tools`は対照試験とカスタムエージェントで同じ組み込みツールを列挙し、`run_command`と`view_file`も含まれていました。この一覧だけでは実際にツールを使えるか判断できません。ファイル読み取りで確認できたのは1つのツールの動作で、ほかのツールには検証が必要です。

グローバルの検証用ファイルは、既存ファイルがないフックとマニフェストのパスに限って排他的に作成し、内容を確認してから削除しました。一時的なグローバルファイル2つを削除し、CLIの永続設定のハッシュが検証前と一致することを確認しました。CLIは通常の会話状態を保持しました。既存のグローバル設定の置き換えは行っていません。

検証では認証情報の内容を確認していません。認証は公式CLIの内部で処理しました。

実際のWindowsでの検証により、サブスクリプション認証による生成を確認でき、当初のフックに関する懸念の範囲も絞れました。グローバルに検出されたプラグインのMCPが起動するため、アダプターの要件はまだ満たされていません。グローバルの単体MCPサーバー、継承されるスキル、ルール、サブエージェント、実際に処理を行うすべてのツール、キャンセル、無出力が長時間続く場合、Linux/macOSでの実行は未検証です。CLIの変更履歴にある新しいプラグインポリシーやサンドボックスの修正は、通常の個人向けサブスクリプションのリクエストで、実行可能なカスタマイズをすべて除外できることを示しません。

## アダプターの提供前に必要な証拠

1. リクエストが実行する可能性が生じる前に、グローバルとワークスペースのフック、プラグイン、スキル、ルール、サブエージェント、MCPサーバー、操作を実行できるツールを除外する、サポートされた方法を確立してください。通常のアカウントログインは公式CLI内に留め、トークンを抽出したりコピーしたりしないでください。
2. 実際の公式CLIと、管理されたローカルのモデルテスト環境で、この仕組みを検証してください。グローバルとワークスペースのフック、プラグイン/MCPに検出用のテストマーカーを設け、ルールやツールリクエストも準備してください。分離された実行だけでなく、分離しない場合にマーカーを観測できることを示す陰性対照も検証してください。
3. 選択したカスタムエージェントが実行前に正しく解決されることを証明してください。未対応バージョン、解決できないエージェント名、未知の一覧形式、結論の出ない分離チェックは拒否してください。内部ログの表現や、起動時に空に見えるツール一覧に依存しないでください。
4. サブプロセスの入出力制限、非公開の一時ファイルとその削除、キャンセル、非ゼロ終了コードと結果エラーの処理を追加し、活動を考慮したタイムアウトをテストしてください。表示テキストのない長い思考も対象です。アカウント固有のモデルは公式コマンドで取得し、選択したモデルと対応する推論強度を保持してください。
5. 既存の接続/プロバイダーの契約を再利用してください。Claude SDKの`settingSources: []`などのオプションはプロバイダー固有であり、`agy`に転用できるフラグではありません。実際の認証、サブスクリプション課金、実機プラットフォームで未検証の点は明示してください。

Windowsの1.5.11と1.5.12で一部の条件は満たしましたが、サブプロセスを止められない問題は再現します。#8143は対応予定なしとしてクローズされたままです。今回の再確認で再開されたり、ランタイムの実装が承認されたりしたわけではありません。メンテナーの判断と検証の完了を待ってから、ランタイムのプロバイダー項目を追加してください。
