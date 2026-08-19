# 個人用拡張機能

個人用拡張機能は、Professor Mariが作る非公開のコード草案です。**Settings**(設定) > **Addons**(アドオン) > **Personal Extensions**(個人用拡張機能)を開きます。

最初は次のメッセージが表示されます(有効にしてコードのハッシュをそのまま承認するまで何も実行されない、という内容です)。

> Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash.

このセクションには新しい草案を作る操作も、インポートの操作もありません。草案の作成や修正はProfessor Mariに頼みます。Professor Mariはコードを保存できますが、承認したり有効にしたりはできません。

自分でパッケージを作成してインポートする場合は、[個人用拡張機能の作成ガイド](writing-personal-extensions.md)を参照してください。自作パッケージは、個別に許可を求めるExternal Extensionsのフローを使用します。

## コードの確認と有効化

草案は必ず無効の状態から始まります。Marinaraは実行されるコードそのものをSHA-256でフィンガープリント化します。草案を開いてコードを読み、表示されているハッシュを照合したうえで、そのバージョンを受け入れられる場合にだけ**Review and Run**(確認して実行)を選びます。実行されるコードを編集したり、以前のリビジョンを復元したりすると、拡張機能は無効に戻り、あらためて承認が必要になります。

サンドボックスは権限を狭めますが、任意のコードを信頼できるものに変えるわけではありません。悪意のある拡張機能でも、ウォッチドッグが止めるまでCPUを浪費する、制限の範囲内で自分のストレージを埋め尽くす、ログで欺くといったことはできます。全ページアクセスの拡張機能は、この分離を意図的に手放したものです。有効にする前に、必ずコードを確認してください。

## 実行環境の分離

ブラウザー拡張機能は、opaque originのサンドボックス化されたiframeの中で、専用のWorkerとして動きます。MarinaraのページやDOM、Cookie、ブラウザーのストレージ、オリジンのAPI、ネットワークにはアクセスできません。使えるのは、拡張機能専用の非公開ストレージ、ログ出力、管理されたタイマー、クリーンアップの登録、制限付きのウィンドウ、安全なホスト側のコントリビューション枠、そして現在のチャットとキャラクターIDの読み取り専用スナップショットだけです。現在のキャラクターカードや選択中のペルソナの一部の項目を受け取れるのは、対応する権限が宣言され、承認されている場合だけです。

拡張機能は`marinara.ui.registerContribution(...)`で、上部バーの操作、**Extensions**メニューの項目、右側に常駐するパネルを追加できます。Marinaraはこうした表示面を、現在のテーマと決められたコントロール一式で描画します。使えるのは、見出し、テキスト、整形済みの出力、ボタン、テキスト入力、セレクト、トグル、スライダー、色のコントロール、スペーサーです。拡張機能が渡せるのは内容と状態だけで、HTML、CSS、URL、Reactコンポーネント、ホスト側のイベントハンドラーは渡せません。

これらのUIの機能と規則は、配布元にかかわらず、サンドボックス化されたブラウザー拡張機能すべてで共通です。インポートしたサードパーティー製の外部拡張機能も、パッケージが明示的に**Full page access**(全ページアクセス)を要求するか、後述するサンドボックス導入前の`marinara.extension`形式を使っていないかぎり、この安全な実行環境で動きます。

### Marinaraが描画するパネルの追加

```js
const panel = marinara.ui.registerContribution({
  id: "weather-settings",
  kind: "panel",
  label: "Weather controls",
  description: "Tune a weather scene without leaving Marinara.",
  icon: "sparkles",
  elements: [
    { kind: "heading", text: "Atmosphere" },
    {
      kind: "select",
      id: "weather",
      label: "Weather",
      value: "rain",
      options: [
        { value: "rain", label: "Rain" },
        { value: "snow", label: "Snow" },
        { value: "aurora", label: "Aurora" },
      ],
    },
    { kind: "slider", id: "intensity", label: "Intensity", min: 0, max: 100, value: 60 },
    { kind: "toggle", id: "lightning", label: "Lightning", checked: false },
    { kind: "color", id: "tint", label: "Tint", value: "#6d8cff" },
    { kind: "button", id: "apply", label: "Apply" },
  ],
  onActivate: async () => {
    const settings = await marinara.storage.get();
    // Update the panel when stored state should be reflected in the controls.
  },
  onEvent: async ({ elementId, values }) => {
    if (elementId !== "apply") return;
    await marinara.storage.patch(values);
  },
});

marinara.onCleanup(() => panel.remove());
```

簡潔な操作には`kind: "button"`を、Extensionsメニューの操作には`kind: "menu-item"`を使います。ボタンの既定値は`surface: "top-bar"`です。代わりに`chats`、`bots`、`characters`、`personas`、`lorebooks`、`presets`、`connections`、`agents`、`settings`を対象とし、`position`を`header`、`before-content`、`after-content`に設定できます。`icon`にはMarinaraが対応するkebab-caseのLucideアイコン名を指定できます。どちらの操作も`onActivate`を呼び出します。`panel`は開かれたときに`onActivate`を呼び出し、そのボタンは全コントロールの現在値を添えて`onEvent`を呼び出します。ハンドルは種類別の更新に対応し、`button`は`label`、`description`、`icon`、`surface`、`position`、`menu-item`は`label`、`description`、`icon`、`panel`は`label`、`description`、`icon`、`elements`を受け取ります。すべて`remove()`に対応します。IDには英字、数字、`.`、`_`、`-`を使えます。

次の例では、Presetsパネルの内容より上にネイティブ操作を配置します。

```js
marinara.ui.registerContribution({
  id: "preset-helper",
  kind: "button",
  label: "Preset helper",
  description: "Run the preset helper",
  icon: "list-sparkles",
  surface: "presets",
  position: "before-content",
  onActivate: () => {
    // Run extension behavior here.
  },
});
```

複雑なツールでは、イベントのあとにパネルの要素を更新して、複数ステップの画面を組み立てられます。アプリの状態は`marinara.storage`に持たせ、マークアップに埋め込まないでください。

### 現在のチャットのコンテキストの利用

ブラウザー拡張機能APIのバージョン5では、Marinaraがいま表示しているチャットの識別子を、中身のわからない値として取得できます。

```js
const renderForContext = async ({ chatId, characterId, characterIds, personaId, characters, persona }) => {
  if (!chatId) return; // Home, a library, or another surface without an active chat.

  const storage = await marinara.storage.get();
  const tab = storage.tabsByChat?.[chatId];

  // characterId is available only for a single-Character chat.
  // Use characterIds for group chats.
  marinara.log.debug("Loaded Notepad tab", {
    chatId,
    characterId,
    characterIds,
    personaId,
    characterNames: characters.map((character) => character.name),
    personaName: persona?.name ?? null,
    tab,
  });
};

const unsubscribe = marinara.context.subscribe(renderForContext);
marinara.onCleanup(unsubscribe);
```

`marinara.context.get()`は、購読せずに同じ最新のスナップショットを返します。開いているチャットがないときは、`chatId`が`null`になり、`characterIds`は空になります。`characterId`に値が入るのは、参加しているキャラクターがちょうど1人のときだけです。グループチャットでは参加者全員が`characterIds`に入り、`characterId`は`null`のままです。`personaId`に値が入るのは、`read_active_persona`が承認されている場合だけです。

チャットとキャラクターのIDは常に取得でき、拡張機能が自分の非公開ストレージを名前空間で分けるのに使えます。レコードの項目を受け取るには、拡張機能のマニフェストで次のオプション権限の片方、または両方が必要です。

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters`があると、現在のチャットに参加しているカードの情報が`characters`に入ります。
- `read_active_persona`があると、現在のチャットで選ばれているペルソナの情報が`persona`に入ります。

権限がなければ、値は`[]`または`null`のままです。Marinaraは要求されたすべての権限を**Requested access**(要求されている権限)に表示し、ハッシュを承認するウィンドウでも再度表示します。権限を追加したり削除したりすると実行コードのハッシュが変わるため、拡張機能は無効になり、あらためて承認が必要になります。

キャラクターのスナップショットに含まれるのは、`id`、`name`、`description`、`personality`、`scenario`、`firstMessage`、`exampleDialogue`、`creator`、`characterVersion`、`tags`、`backstory`、`appearance`、`aboutMe`、`conversationDisplayName`だけです。ペルソナのスナップショットに含まれるのは、`id`、`name`、`description`、`personality`、`scenario`、`backstory`、`appearance`、`tags`、`aboutMe`、`conversationDisplayName`だけです。テキストはサンドボックスの境界を越える前に長さを制限します。

Marinaraは、メッセージ、作成者ノート、システムプロンプト、履歴の後ろに置く指示、コメント、アバターの画像パス、キャラクターやペルソナのライブラリー全体、宣言されていない項目、チャットのメタデータ、データベースのハンドル、ネットワークアクセス、書き換えの操作を、いっさい渡しません。コンテキストの更新は承認済みのコードハッシュに結び付いたままで、現在のチャット、参加キャラクターの一覧、選択中のペルソナが変わったときに届きます。

### 旧形式と全ページアクセスの拡張機能

天気を操作するツール、プロンプトのエディター、その他の本格的なワークフローは、コントリビューションの用途として妥当です。安全な形に移植する場合は、メニューや上部バーのランチャーに、順次更新していくパネルを組み合わせられます。DOMのオーバーレイを挿入する、MarinaraのCSSセレクターを参照する、Reactの内部構造をたどる、同一オリジンの`/api`ルートを呼び出す、といった既存のパッケージは、そのままでは安全な実行環境にインポートできません。

UIのコントリビューションが提供するのは画面であって、暗黙の権限ではありません。コンテキストAPIが常に公開するのは現在のチャットとキャラクターのIDだけで、それ以外は上に挙げた、宣言済みで現在有効なレコードの項目にかぎられます。メッセージ、プリセット、ロアブック、宣言されていないキャラクターやペルソナのデータ、画面の演出が必要な機能には、Marinaraが用意する用途を絞った別の仲介機能が必要です。拡張機能が、ホストのDOMアクセスや無制限のネットワーク通信でそれを代用してはいけません。

外部拡張機能がホストのDOMアクセスをどうしても必要とする場合は、次のように要求できます。

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**Full page accessはサンドボックスの機能ではありません。** 承認されたJavaScriptとCSSは、Marinaraのページの中で動きます。そのコードは、いま開いているブラウザーのセッションから見えるものをすべて読み取ったり書き換えたりでき、チャットやカードを調べ、ブラウザーのストレージを使い、ネットワーク通信を行い、同一オリジンのMarinaraのAPIを呼び出せます。実質的な権限は、ブラウザーのコンソールに貼り付けたコードと変わりません。Professor Mariの草案がこれを要求することはできません。

Marinaraは、`capabilities`項目を明示していない古い`kind: "marinara.extension"`のv1形式を、サンドボックス導入前のパッケージとみなし、インポート時に**Full page access**を割り当てます。これにより、WeatherTweakerのような旧来のパッケージが、Workerの中で黙って失敗する代わりに、正しい確認の流れに進みます。この形式を使いながら安全な実行環境で動かしたい最近のパッケージは、`"capabilities": []`を明記してください。

外部拡張機能の2つのゲートと、ハッシュどおりの承認は引き続き必要です。コード、CSS、権限のいずれかが変わると拡張機能は無効になり、あらためて承認が必要になります。無効にすると、Marinaraはスクリプトとスタイルシートのノードを取り除き、互換API経由で作られたタイマーを取り消し、`marinara.onCleanup(...)`で登録されたコールバックを実行します。ページ側のコードは、登録されていないリスナー、タイマー、グローバル変数、DOMの変更を作れるため、後片付けは可能な範囲にとどまります。無効にしたあとに何か残っているようなら、ページを再読み込みしてください。

古い`marinara.ui.showWindow(...)`APIも引き続き使えます。opaque originのiframeの中に一時的なウィンドウを開くためのものです。使えるコントロールは同じで、`update(...)`と`close()`のハンドルを返します。Marinaraの通常の画面移動からツールに行き着くようにしたい場合は、コントリビューションのほうを選んでください。

サーバー拡張機能は、macOSのSeatbeltまたはLinuxのBubblewrapの中で、権限を制限した別のNodeプロセスとして動きます。Marinaraのファイル、利用者のファイル、引き継がれたサーバーの秘密情報、ネットワーク、子プロセス、ワーカー、ネイティブアドオンにはアクセスできません。対応するOSのサンドボックスを用意できない場合、サーバー拡張機能は無効のままです。

### 対応プラットフォーム

ブラウザー拡張機能はブラウザー自身がサンドボックス化するため、どの環境でも動きます。サーバー拡張機能には対応するOSのサンドボックスが必要で、それがない環境では無効のままとなり、有効にできません。Marinaraがサンドボックスなしで実行に切り替えることは絶対にありません。

| プラットフォーム | サンドボックス化されたブラウザー拡張機能 | 全ページアクセスの外部拡張機能 | サーバー拡張機能 |
| ----------------------- | ---------------------------- | ----------------------------- | ------------------------------------- |
| macOS | ✅ サンドボックス化 | ⚠️ 明示的な信頼が必要 | ✅ サンドボックス化(Seatbelt) |
| Linux(Bubblewrapあり) | ✅ サンドボックス化 | ⚠️ 明示的な信頼が必要 | ✅ サンドボックス化(Bubblewrap) |
| Linux(`bwrap`なし) | ✅ サンドボックス化 | ⚠️ 明示的な信頼が必要 | ⛔ 無効(`bwrap`をインストール) |
| Windows | ✅ サンドボックス化 | ⚠️ 明示的な信頼が必要 | ⛔ 無効(ブラウザー拡張機能を使用) |
| Android | ✅ サンドボックス化 | ⚠️ 明示的な信頼が必要 | ⛔ 無効(ブラウザー拡張機能を使用) |

WindowsとAndroidには対応するOSのプロセスサンドボックスがないため、サーバー拡張機能は仕様として使えません。代わりにブラウザー拡張機能を使うか、サーバー拡張機能が必要な場合はMarinaraのサーバーをmacOSかLinux(`bwrap`あり)で動かしてください。

## 外部拡張機能

サードパーティー製のインポートは、デフォルトでロックされ、表示もされません。使うには2つの手順が必要です。

1. Marinaraを動かしているホストで、`.env`に`ENABLE_EXTERNAL_EXTENSIONS=true`を設定します。
2. **Settings** > **Advanced** > **Danger Zone**を開き、データ削除の操作より下までスクロールして、警告を読んだうえで**Allow third-party extension imports**(サードパーティー製拡張機能のインポートを許可)を有効にします。

ここまで済むと、**Settings** > **Addons**に**External Extensions**が現れ、ファイルとフォルダーのインポート操作が使えるようになります。対応形式は常に展開して表示されます。

- `.personal-extension.zip`と、互換性のある`.zip`パッケージ
- `.json`のマニフェスト
- `.css`
- `.js`、`.mjs`、`.cjs`
- `.server.js`、`.server.mjs`、`.server.cjs`

インポートしただけでは承認されず、拡張機能が自分自身を有効にすることもできません。旧形式のもの、プロファイルからインポートされたもの、手作業で保存されたもの、出所が不明なレコードも外部として扱います。これらは隠されたままで承認できず、2つのゲートが両方とも開くまで、どちらの実行環境からも除外されます。

ハッシュを承認する前に、**Requested access**の一覧を確認してください。ほとんどのブラウザー拡張機能は、安全なサンドボックスの中に置いたままにするべきです。**Full page access**と表示されたパッケージは意図的に分離されていないので、そのバージョンのコードを自分で読み、信頼できると判断したときにだけ有効にしてください。

どちらかのゲートをオフにすると、動作中の外部サーバープロセスが止まり、ブラウザーのワーカーと全ページ実行環境のノードが取り除かれ、保存済みの外部レコードが無効になります。ゲートを開き直しても、自動的に再び実行されることはありません。全ページアクセスの拡張機能が、クリーンアップに登録していない変更を残した場合は、ページを再読み込みしてください。

サードパーティー製の拡張機能には、悪意のあるコードや危険なコードが含まれている可能性があります。ダウンロード、インポート、有効化のいずれの前にも、必ず全行に目を通してください。実行の責任はすべて実行する側にあります。

## エクスポート、リビジョン、トラブル時の対処

拡張機能のエクスポート操作を使うと、持ち運べるパッケージをダウンロードできます。エクスポートしたパッケージも、復元したパッケージも無効のままです。リビジョンを復元した場合も、無効の草案に戻ります。

拡張機能の動作がおかしいときは**Disable**(無効化)を選びます。画面を操作できない場合は、Marinaraを停止し、該当する`installed_extensions`レコードの`enabled`の値を`"false"`にします。`approvedHash`を手作業で書き換えては絶対にいけません。

## 関連ガイド

- [個人用拡張機能を作成する](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [サーバー設定リファレンス](../CONFIGURATION.md)
- [バックアップと復元](../data/backup-and-restore.md)
- [リモートアクセス](../REMOTE_ACCESS.md)
