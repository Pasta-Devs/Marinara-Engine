# Personal Extensionsの作成

このガイドは、Marinara Engine用の拡張機能を自作する方向けです。拡張機能のインストール、確認、安全な実行については、先に[Personal Extensions](personal-extensions.md)を参照してください。

自分で作成してインポートしたコードは、**External Extension**(外部拡張機能)として扱われます。初期状態では無効であり、内容を確認して正確なSHA-256ハッシュを承認するまで実行できません。

## 始める前の準備

External Extensionsは、2つの安全ゲートを両方開くまで表示されません。

1. Marinaraホストの`.env`ファイルで`ENABLE_EXTERNAL_EXTENSIONS=true`を設定します。
2. **Settings** > **Advanced** > **Danger Zone**を開き、**Allow third-party extension imports**を有効にします。

拡張機能のインポートと管理には、localhostからのアクセスまたは設定済みの**Admin Access**も必要です。スマートフォン、LANアドレス、リモートブラウザーからMarinaraを使用する場合は、サーバーで`ADMIN_SECRET`を設定し、**Settings** > **Advanced** > **Admin Access**に同じ値を入力してください。

目的を果たせる範囲で、最も権限の小さいランタイムを選んでください。

| ランタイム | 用途 | 重要な境界 |
| --- | --- | --- |
| Sandboxed Browser Extension | 非公開状態、アクティブチャットのコンテキスト、ボタン、メニュー操作、Marinaraが描画するパネル | MarinaraのDOM、Cookie、ブラウザーストレージ、ネットワーク、任意のHTMLにはアクセス不可 |
| Server Extension | 管理対象タイマーと拡張機能専用ストレージを必要とするバックグラウンドロジック | 独立したOSサンドボックス。Marinaraのファイルやシークレット、ネットワーク、子プロセス、ネイティブモジュールにはアクセス不可 |
| Full-page External Extension | Marinaraのページまたは同一オリジンAPIを本当に必要とするレガシーコード | サンドボックスなし。内容を完全に確認し、全面的に信頼できるコードにのみ使用 |

Browser Extensionsは、サポート対象のすべてのプラットフォームで動作します。Server Extensionsには、macOSのSeatbeltまたはLinuxのBubblewrapが必要です。Server Extensionを選ぶ前に[プラットフォーム表](personal-extensions.md#platform-support)を確認してください。

## Browser Extensionクイックスタート

次の構成でフォルダーを作成します。

```text
Hello Panel/
  manifest.json
  extension.js
  extension.css
```

次の`manifest.json`を使用します。

```json
{
  "kind": "marinara.personal-extension",
  "version": 1,
  "config": {
    "name": "Hello Panel",
    "version": "1.0.0",
    "description": "A minimal sandboxed Browser Extension.",
    "runtime": "client",
    "capabilities": [],
    "jsPath": "extension.js",
    "cssPath": "extension.css"
  }
}
```

次の`extension.js`を使用します。

```js
const saved = await marinara.storage.get();
let count = Number(saved.count) || 0;

const statusElement = () => ({
  kind: "text",
  text: `Button pressed ${count} time${count === 1 ? "" : "s"}.`,
});
const elements = () => [
  statusElement(),
  { kind: "button", id: "increment", label: "Count one" },
];

const panel = marinara.ui.registerContribution({
  id: "hello-panel",
  kind: "panel",
  label: "Hello Panel",
  description: "Minimal Personal Extension example",
  icon: "hand",
  elements: elements(),
  onEvent: async ({ elementId }) => {
    if (elementId !== "increment") return;
    count += 1;
    await marinara.storage.patch({ count });
    panel.update({ elements: elements() });
    marinara.ui.showWindow({ title: "Hello Panel", elements: [statusElement()] });
  },
});

marinara.log.info("Hello Panel loaded");
marinara.onCleanup(() => panel.remove());
```

ボタンから開く制限付きiframeウィンドウのスタイルには、次の`extension.css`を使用します。

```css
[data-ext-root] {
  font-size: 16px;
}
```

続いて、拡張機能をインポートして実行します。

1. **Settings** > **Addons** > **External Extensions**を開きます。
2. **Import Folder**を選んで`Hello Panel`を指定するか、フォルダーをZIPにしてインポートします。
3. 無効な下書きを開き、マニフェストとJavaScriptを確認します。
4. **Review and Run**を選び、表示された正確なハッシュを承認します。
5. Extensionsメニューを開き、**Hello Panel**を選びます。

同じ実行可能な例は、リポジトリの`docs/examples/personal-extensions/browser-minimal/`にあります。

## Browser APIリファレンス

サンドボックス化されたBrowser Extensionsには、`marinara`という1つの凍結済みグローバルオブジェクトが渡されます。

| API | 用途 |
| --- | --- |
| `runtime`, `version` | ランタイム名(`client`)と現在のBrowser APIバージョン |
| `extensionId`, `extensionName`, `capabilities` | この拡張機能リビジョンの識別情報と承認済み機能 |
| `log.debug/info/warn/error(...)` | タグ付きエントリーをブラウザーコンソールへ出力 |
| `storage.get()` | この拡張機能専用のJSONオブジェクトを読み取り |
| `storage.patch(object)` | 専用ストレージへ値をマージし、新しいオブジェクトを返却 |
| `storage.delete()` | 専用ストレージを消去 |
| `context.get()` | 現在のアクティブチャットのスナップショットを読み取り |
| `context.subscribe(listener)` | コンテキスト変更を受信。購読解除関数を返却 |
| `ui.registerContribution(options)` | 安全なボタン、Extensionsメニュー項目、Marinaraが描画するパネルを追加 |
| `ui.showWindow(options)` | 制限付きiframeウィンドウを開く |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | 拡張機能の停止時に削除される管理対象タイマー |
| `onCleanup(callback)` | 追加のクリーンアップ処理を登録 |

通常のUIには[Marinaraが描画するパネル](personal-extensions.md#add-a-marinara-rendered-panel)を使用し、チャットに応じた動作には[アクティブチャットのコンテキスト](personal-extensions.md#use-active-chat-context)を使用してください。拡張機能の状態はブラウザーストレージではなく`marinara.storage`に保存します。

`showWindow({ title, elements, onEvent, onClose })`は、`update({ title?, elements? })`と`close()`を持つハンドルを返します。パッケージCSSはサンドボックス化されたiframeウィンドウを装飾します。ホストが描画するコントリビューションは、常にMarinara独自のテーマとコントロールを使用します。

安全なBrowserランタイムには、DOM APIもネットワークAPIもありません。この境界を回避しないでください。必要な機能がない場合は、既定でページ全体へのアクセスへ切り替えず、範囲を絞ったホスト機能をリクエストしてください。

### コンテキスト機能

任意のレコードアクセスを`config.capabilities`で宣言します。

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters`は、アクティブチャット内のCharacterカードについて、範囲を限定したフィールドを設定します。
- `read_active_persona`は、選択したPersonaについて、範囲を限定したフィールドを設定します。
- `full_page_access`は、サンドボックスのない互換ランタイムを選択します。External Extensionsでのみ使用できます。

機能を変更すると実行可能コードのハッシュが変わり、拡張機能が無効になって、再レビューが必要になります。

## Server Extensionクイックスタート

次のフォルダーを作成します。

```text
Server Counter/
  manifest.json
  server-extension.js
```

次の`manifest.json`を使用します。

```json
{
  "kind": "marinara.personal-server-extension",
  "version": 1,
  "config": {
    "name": "Server Counter",
    "version": "1.0.0",
    "description": "A minimal sandboxed Server Extension.",
    "runtime": "server",
    "capabilities": [],
    "serverJsPath": "server-extension.js"
  }
}
```

次の`server-extension.js`を使用します。

```js
const saved = await marinara.storage.get();
const starts = (Number(saved.starts) || 0) + 1;
await marinara.storage.patch({ starts });

marinara.log.info(`Server Counter started ${starts} time${starts === 1 ? "" : "s"}`);

const timer = marinara.setInterval(() => {
  marinara.log.debug("Server Counter heartbeat");
}, 60_000);

marinara.onCleanup(() => marinara.clearInterval(timer));
```

同じ実行可能なパッケージは`docs/examples/personal-extensions/server-minimal/`にあります。

サーバーコードには、`marinara.runtime`、`marinara.version`、拡張機能の識別情報、`log`、`storage`、管理対象タイマー、`onCleanup`が渡されます。ファイルシステム、プロセス、ネットワーク、モジュール読み込み、Marinaraデータベースにはアクセスできません。

ホストがSeatbeltまたはBubblewrapを確立できない場合、Server Extensionsは無効なままです。これはプラットフォームの制限であり、拡張機能のエラーではありません。

## パッケージとマニフェストのリファレンス

| フィールド | 説明 |
| --- | --- |
| `kind` | `marinara.personal-extension`または`marinara.personal-server-extension` |
| top-level `version` | パッケージエンベロープのバージョン。現在は`1` |
| `config.name` | 必須の表示名。1-200文字 |
| `config.version` | `1.2.0`などの任意の拡張機能バージョン。数字をピリオドで区切ったバージョンでは、ダウングレード警告を利用可能 |
| `config.description` | 任意の説明。最大2,000文字 |
| `config.runtime` | `client`または`server`。既定値は`client` |
| `config.capabilities` | 要求するBrowser機能。Server Extensionsでは空のリストが必須 |
| `config.jsPath` / `config.serverJsPath` | マニフェストからの相対JavaScriptファイルパスまたはパスの順序付き配列 |
| `config.cssPath` | 任意のCSSファイルパスまたは順序付き配列。安全なランタイムのCSSはサンドボックス化されたiframe内に限定 |
| `config.js`, `config.serverJs`, `config.css` | 個別ファイルが不要な場合のインライン代替項目 |

プレーンなJavaScriptを使用してください。MarinaraはTypeScriptをコンパイルせず、拡張機能の依存関係もインストールしません。必要な場合は、インポート前に依存関係をJavaScriptへバンドルしてください。

単独の`.js`、`.mjs`、`.cjs`、`.server.js`、`.server.mjs`、`.server.cjs`、`.css`ファイルも直接インポートできます。識別情報、ランタイム、バージョン、機能、ファイル順を明示的に記録できるため、マニフェストを推奨します。

### 検証上限

| 内容 | 現在の境界 |
| --- | --- |
| 名前 / バージョン / 説明 | 200文字 / 64文字 / 2,000文字 |
| BrowserまたはServerのJS | フィールドごとのソース上限なし。外側のファイル、アーカイブ、リクエストの上限は適用 |
| CSS | 256 KiB |
| インポートするZIP | 圧縮時32 MiB、テキストエントリーごとに2 MiB、展開したテキスト全体で16 MiB |
| 専用ストレージ | 拡張機能ごとにシリアライズ済みJSONを1,000,000バイト |

ZIP、リクエスト、サンドボックスメッセージ、ストレージの各上限は、それぞれ異なる転送境界またはランタイム境界を保護します。実行可能ソースコードのポリシーではありません。

## 更新と復旧のライフサイクル

- 新しくインポートした項目は、必ず無効かつ未承認の状態で開始します。
- コード、CSS、ランタイム、機能を編集すると承認が解除され、拡張機能が無効になります。
- 同じ名前を再インポートすると、確認後に既存レコードが更新されます。バイト単位で同一の再インポートでは、現在のハッシュと承認が維持されます。実行可能な内容が変わると承認が解除されます。数字のバージョンがダウングレードを示す場合、Marinaraが警告します。
- **Export**は、現在のマニフェストとソースファイルをポータブルパッケージに書き出します。承認はエクスポートされません。
- リビジョンの復元、プロファイルのインポート、バックアップの復元後は、再レビューするまで拡張機能が無効なままです。
- **Disable**は、ランタイムと登録済みのクリーンアップを停止します。ページ全体のコードが未登録の副作用を作成した場合、ページの再読み込みが必要になることがあります。
- **Delete**は、インストール済みレコードを削除します。後でソースが必要になる可能性がある場合は、先にエクスポートしてください。

## デバッグ

| 症状 | 確認事項 |
| --- | --- |
| 外部インポートのコントロールが表示されない | 上記のExternal Extension用安全ゲートを両方開く |
| 管理画面にlocalhostまたはAdmin Accessが必要と表示される | `ADMIN_SECRET`を設定し、**Admin Access**に保存する |
| インポートで拡張機能が見つからない | `manifest.json`と相対パスを確認する。ServerにはJS、BrowserにはCSSまたはJSが必要 |
| 編集後に拡張機能が無効になる | 想定どおりの動作。新しい正確なハッシュを確認して承認する |
| Browserコードから`document`、`window`、`fetch`、ローカルストレージを使用できない | 安全なサンドボックスでは想定どおり。文書化されたブローカーAPIを使用する |
| Server Extensionを使用できない | macOS SeatbeltまたはBubblewrapを備えたLinuxを使用するか、Browser Extensionへ切り替える |
| Browser Extensionが例外をスローする | ブラウザー開発者ツールを開く。`marinara.log`と起動エラーには拡張機能名が付く |
| Server Extensionが例外をスローする | **Settings** > **Addons**の状態とMarinaraサーバーログを確認する |

CSS、専用ストレージ、インポートアーカイブ、ランタイムメッセージには、それぞれ独立した安全上限があります。Marinaraは実行エラーとして扱うのではなく、パッケージを拒否した境界を報告する必要があります。

## 関連ガイド

- [Personal Extensions](personal-extensions.md)
- [サーバー設定](../CONFIGURATION.md)
- [トラブルシューティング](../TROUBLESHOOTING.md)
- [Personal Extensionアーキテクチャ](../development/personal-extensions.md)
