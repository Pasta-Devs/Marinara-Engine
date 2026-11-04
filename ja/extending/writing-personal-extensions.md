# Personal Extensionsの作成

このガイドでは、Browser ExtensionまたはServer Extensionを作成し、パッケージ化してインポートする方法を説明します。JavaScriptを書ける方向けです。拡張機能の確認と実行については、[Personal Extensions](personal-extensions.md)を参照してください。

自分で作成してインポートしたコードは、**External Extension**(外部拡張機能)として扱われます。初期状態では無効であり、内容を確認して正確なSHA-256ハッシュを承認するまで実行できません。

## 始める前の準備

External Extensionsは、[サードパーティー製拡張機能のインポートを許可する](personal-extensions.md#allow-third-party-imports)にある2つの安全上の手順を両方とも済ませるまで表示されません。2つの手順とは、`.env`の`ENABLE_EXTERNAL_EXTENSIONS=true`と、**Settings → Advanced → Danger Zone**(設定 → 詳細設定 → 危険な操作)にある**Allow third-party extension imports**(サードパーティー製拡張機能のインポートを許可)です。

拡張機能のインポートと管理には、localhostからのアクセスまたは管理者用シークレットも必要です。スマートフォン、LANアドレス、リモートブラウザーから使う場合は、サーバーで`ADMIN_SECRET`を設定し、**Settings → Advanced → Admin Access**(設定 → 詳細設定 → 管理者アクセス)に同じ値を入力してください。

目的を果たせる範囲で、最も権限の小さいランタイムを選んでください。

| ランタイム | 用途 | 重要な境界 |
| --- | --- | --- |
| Sandboxed Browser Extension | 非公開状態、アクティブチャットのコンテキスト、ボタン、メニュー操作、Marinaraが描画するパネル | MarinaraのDOM、Cookie、ブラウザーストレージ、ネットワーク、任意のHTMLにはアクセス不可 |
| Server Extension | 管理対象タイマーと拡張機能専用ストレージを必要とするバックグラウンドロジック | 独立したOSサンドボックス。Marinaraのファイルやシークレット、ネットワーク、子プロセス、ネイティブモジュールにはアクセス不可 |
| Full-page External Extension | Marinaraのページまたは同一オリジンAPIを必要とするレガシーコード | サンドボックスなし。内容を完全に確認し、全面的に信頼できるコードにのみ使用 |

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

1. **Settings → Addons → External Extensions**(設定 → アドオン → 外部拡張機能)を開きます。
2. **Import Extension Folder**(拡張機能のフォルダーをインポート)を選んで`Hello Panel`を指定するか、フォルダーをZIPにして**Import Extension File**(拡張機能のファイルをインポート)でインポートします。
3. 無効な下書きを開き、マニフェストとJavaScriptを確認します。
4. **Review and Run**(確認して実行)を選び、表示された正確なハッシュを承認します。
5. Extensionsメニューを開き、**Hello Panel**を選びます。

同じ実行可能な例は、リポジトリーの`docs/examples/personal-extensions/browser-minimal/`にあります。

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
| `dice.registerFormat(options)` | `/roll`に独自の記法を追加し、指定したダイスをMarinaraが振る |
| `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` | 拡張機能の停止時に削除される管理対象タイマー |
| `onCleanup(callback)` | 追加のクリーンアップ処理を登録 |

通常のUIには[Marinaraが描画するパネル](#add-a-marinara-rendered-panel)を、チャットに応じた動作には[アクティブチャットのコンテキスト](#use-active-chat-context)を、独自の`/roll`記法には[ダイス形式](#add-a-dice-format)を使用してください。拡張機能の状態はブラウザーストレージではなく`marinara.storage`に保存します。

`showWindow({ title, elements, onEvent, onClose })`は、`update({ title?, elements? })`と`close()`を持つハンドルを返します。パッケージCSSはサンドボックス化されたiframeウィンドウを装飾します。ホストが描画するコントリビューションは、常にMarinara独自のテーマとコントロールを使用します。

安全なBrowserランタイムには、DOM APIもネットワークAPIもありません。この境界を回避しないでください。役に立つ機能が足りない場合は、デフォルトの選択として全ページアクセスへ切り替えるのではなく、範囲を絞ったホスト機能をリクエストしてください。

### コンテキスト機能

任意のレコードアクセスを`config.capabilities`で宣言します。

```json
{
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters`は、アクティブチャット内のキャラクターカードについて、範囲を限定したフィールドを設定します。
- `read_active_persona`は、選択したペルソナについて、範囲を限定したフィールドを設定します。
- `full_page_access`は、サンドボックスのない互換ランタイムを選択します。External Extensionsでのみ使用できます。

機能を変更すると実行可能コードのハッシュが変わり、拡張機能が無効になって、再レビューが必要になります。

<a id="what-a-browser-extension-can-do"></a>

### Browser Extensionでできること

Browser Extensionは、opaque originのサンドボックス化されたiframeの中で、専用のWorkerとして動きます。MarinaraのページやDOM、Cookie、ブラウザーストレージ、オリジンのAPI、ネットワークにはアクセスできません。使える機能は、拡張機能専用の非公開ストレージ、ログ出力、管理対象タイマー、クリーンアップの登録、制限付きのウィンドウ、安全なホスト側のコントリビューション枠、そしてアクティブチャットとキャラクターIDの読み取り専用スナップショットです。アクティブなキャラクターカードや選択中のペルソナから一部のフィールドを受け取れるのは、対応する権限が宣言され、承認されている場合だけです。

拡張機能は`marinara.ui.registerContribution(...)`で、上部バーやサイドパネルの操作、Extensionsメニューの項目、右側に常駐するパネルを追加できます。Marinaraはこうした表示面を、現在のテーマと決められたコントロール一式で描画します。使えるのは、見出し、テキスト、整形済みの出力、ボタン、テキスト入力、セレクト、トグル、スライダー、色のコントロール、スペーサーです。拡張機能が渡せるのは内容と状態だけで、HTML、CSS、URL、Reactコンポーネント、ホスト側のイベントハンドラーは渡せません。

これらのUIの機能と規則は、配布元にかかわらず、サンドボックス化されたBrowser Extensionすべてで共通です。インポートしたサードパーティー製の拡張機能(External Extension)も、パッケージが明示的に**Full page access**(ページ全体へのアクセス)を要求するか、後述するサンドボックス導入前の`marinara.extension`形式を使っていないかぎり、この安全なランタイムで動きます。

### テキストのトークン数を推定する

Browser、Full page access、ServerのPersonal Extensionsでは、Marinaraに組み込まれたテキストのトークン数推定機能を使えます。

```js
const tokens = marinara.estimateTextTokens(text);
```

シグネチャは`estimateTextTokens(text: string): number`です。`@marinara-engine/shared`からエクスポートされる`PersonalExtensionTokenApi`型にも定義されています。呼び出しは同期的に処理され、追加の機能は必要ありません。返される値はモデルに依存しないMarinaraの推定トークン数で、トークナイザーによる正確な計数ではありません。古いEngineでは、呼び出す前に`typeof marinara.estimateTextTokens === "function"`を確認してください。

<a id="add-a-marinara-rendered-panel"></a>

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

簡潔な操作には`kind: "button"`を、Extensionsメニューの操作には`kind: "menu-item"`を使います。同じ拡張機能のリビジョンにある既存のコントリビューションを起動するCommand Centerの項目には、`kind: "command"`を使います。コマンドには`targetContributionId`が必須で、`onActivate`や`onEvent`は使えません。

```js
marinara.ui.registerContribution({
  id: "open-weather",
  kind: "command",
  label: "Open weather controls",
  targetContributionId: "weather-settings",
});
```

ホストがコマンドを解決するのは、対象の拡張IDとコンテンツハッシュが同じ場合だけです。対象が見つからない場合、別の拡張機能の対象の場合、古いリビジョンの対象の場合は、いずれもフェイルクローズします。ボタンのデフォルトは`surface: "top-bar"`です。代わりに`chats`、`bots`、`characters`、`personas`、`lorebooks`、`presets`、`connections`、`agents`、`settings`を対象とし、`position`を`header`、`before-content`、`after-content`に設定できます。`icon`にはMarinaraが対応するkebab-caseのLucideアイコン名を指定できます。どちらの操作の種類も`onActivate`を呼び出します。`panel`は開かれたときに`onActivate`を呼び出し、そのボタンはパネルの全コントロールの現在値を添えて`onEvent`を呼び出します。返されるハンドルは種類別の更新に対応し、`button`は`label`、`description`、`icon`、`surface`、`position`、`menu-item`は`label`、`description`、`icon`、`panel`は`label`、`description`、`icon`、`elements`を受け取ります。どのハンドルも`remove()`に対応します。IDには英字、数字、`.`、`_`、`-`を使えます。

たとえば次の例では、Presetsパネルの内容より上にネイティブ操作を配置します。

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

<a id="use-active-chat-context"></a>

### アクティブチャットのコンテキストの利用

Browser Extension APIのバージョン5では、Marinaraがいま表示しているチャットの識別子を、中身のわからない値として公開します。

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

`marinara.context.get()`は、購読せずに同じ最新のスナップショットを返します。アクティブなチャットがないときは、`chatId`が`null`になり、`characterIds`は空になります。`characterId`に値が入るのは、参加しているキャラクターがちょうど1人のときだけです。グループチャットでは参加者全員が`characterIds`に入り、`characterId`は`null`のままです。`personaId`に値が入るのは、`read_active_persona`が承認されている場合だけです。

チャットとキャラクターのIDは常に取得でき、拡張機能が自分の非公開ストレージを名前空間で分けるのに使えます。レコードのフィールドを受け取るには、拡張機能のマニフェストで次の任意の権限の片方、または両方が必要です。

```json
{
  "runtime": "client",
  "capabilities": ["read_active_characters", "read_active_persona"]
}
```

- `read_active_characters`があると、アクティブチャットに参加しているカードの情報が`characters`に入ります。
- `read_active_persona`があると、アクティブチャットで選ばれているペルソナの情報が`persona`に入ります。

権限がなければ、値は`[]`または`null`のままです。Marinaraは要求されたすべての権限を**Requested access**(要求されている権限)に表示し、正確なハッシュを承認するダイアログでも再度表示します。権限を追加したり削除したりすると実行可能コードのハッシュが変わるため、拡張機能は無効になり、あらためて承認が必要になります。

キャラクターのスナップショットに含まれるのは、`id`、`name`、`description`、`personality`、`scenario`、`firstMessage`、`exampleDialogue`、`creator`、`characterVersion`、`tags`、`backstory`、`appearance`、`aboutMe`、`conversationDisplayName`だけです。ペルソナのスナップショットに含まれるのは、`id`、`name`、`description`、`personality`、`scenario`、`backstory`、`appearance`、`tags`、`aboutMe`、`conversationDisplayName`だけです。テキストは、サンドボックスのブリッジを越える前に長さが制限されます。

Marinaraは、メッセージ、作成者ノート、システムプロンプト、履歴の後ろに置く指示、コメント、アバターのパス、キャラクターやペルソナのライブラリー全体、宣言されていないフィールド、チャットのメタデータ、データベースのハンドル、ネットワークアクセス、書き換えの操作を、いっさい渡しません。コンテキストの更新は承認済みのコードハッシュに結び付いたままで、アクティブチャット、その参加キャラクターの一覧、そのチャットで選ばれているペルソナが変わったときに届きます。

<a id="add-a-dice-format"></a>

### ダイス形式の追加

Browser Extension APIのバージョン6では、ナラティブダイスのプールなど、拡張機能独自の記法を`/roll`に追加できます。拡張機能が記法を読み取って振るダイスを指定し、Marinaraが自身の安全なダイスローラーでそれを振って、出目を返します。拡張機能が決められるのはロールの意味であって、出目そのものではありません。

```js
const SYMBOLS = { boost: [0, 0, 1, 1, 2, 1], setback: [0, 0, -1, -1, 0, 0] };

const format = marinara.dice.registerFormat({
  id: "narrative",
  label: "Narrative dice",
  // Return null for notation this format does not read.
  parse(notation) {
    const terms = [...notation.matchAll(/(\d+)\s*(boost|setback)/g)];
    if (!terms.length) return null;
    const kinds = terms.flatMap(([, count, kind]) => Array(Number(count)).fill(kind));
    return { dice: kinds.map(() => 6), kinds };
  },
  // rolls[i] is the face Marinara threw for dice[i]; plan is what parse returned.
  read({ notation, dice, rolls, plan }) {
    const net = rolls.reduce((sum, face, i) => sum + SYMBOLS[plan.kinds[i]][face - 1], 0);
    return { total: net, text: net > 0 ? `${net} success` : "failure" };
  },
});
marinara.onCleanup(() => format.remove());
```

これで`/roll 2 boost 1 setback`を使うと、出目、合計、拡張機能のテキストが、その形式の名前を添えて投稿されます。`2d6`や`4d6kh3`などの通常の記法は、常にこれまでどおりに振られ、拡張機能には渡されません。それ以外の記法は登録された各形式に順番に渡され、`parse`が最初にダイスを返した形式で振ります。

- `parse(notation)`は`null`、または2-1000面のダイス1-100個を指定する`{ dice: [sides, ...] }`を返します。オブジェクトのそれ以外の内容はサンドボックス内にとどまり、`plan`として`read`に渡されます。
- `read(...)`は`{ total, text?, kept? }`を返します。有限の数値、最大200文字のプレーンテキスト、任意で採用したダイスの位置を昇順に指定します。`/roll`は、それ以外のダイスに取り消し線を引きます。
- 拡張機能ごとに4つの形式を登録できます。記法は最大100文字です。`parse`と`read`は非同期でもかまいませんが、それぞれ2秒以内に応答する必要があります。
- テキストはプレーンテキストとして表示され、リンク、画像、書式、HTMLはエスケープされます。

ダイス形式が対応するのは、ブラウザーの`/roll`です。Game Masterの`roll_dice`ツールと、それ以外のサーバー側のロールでは、引き続き組み込みの記法とルールセットのダイスを使います。古いEngineで呼び出す前に、`typeof marinara.dice?.registerFormat === "function"`を確認してください。

### 旧形式と全ページアクセスの拡張機能

天気を操作するツール、プロンプトのエディター、その他の本格的なワークフローは、コントリビューションの用途として妥当です。安全な形に移植する場合は、メニューや上部バーのランチャーに、順次更新していくパネルを組み合わせられます。DOMのオーバーレイを挿入する、MarinaraのCSSセレクターを参照する、Reactの内部構造をたどる、同一オリジンの`/api`ルートを呼び出す、といった既存のパッケージは、そのままでは安全なランタイムにインポートできません。

UIのコントリビューションが提供するのは画面であって、暗黙の権限ではありません。コンテキストAPIが常に公開するのはアクティブチャットとキャラクターのIDで、それ以外に公開できるのは上に挙げた、宣言済みのアクティブなレコードのフィールドだけです。メッセージ、プリセット、ロアブック、宣言されていないキャラクターやペルソナのデータ、画面の演出が必要な機能には、Marinaraが用意する、用途を絞った別の仲介機能が引き続き必要です。拡張機能が、ホストのDOMアクセスや無制限のネットワーク通信でそれを代用してはいけません。

External ExtensionがホストのDOMアクセスに依存する場合は、次のように要求できます。

```json
{
  "runtime": "client",
  "capabilities": ["full_page_access"]
}
```

**Full page accessはサンドボックスの機能ではありません。** 承認されたJavaScriptとCSSは、Marinaraのページの中で動きます。そのコードは、いま開いているブラウザーのセッションから見えるものをすべて読み取ったり書き換えたりでき、チャットやカードを調べ、ブラウザーストレージを使い、ネットワーク通信を行い、同一オリジンのMarinaraのAPIを呼び出せます。実質的なページ上の権限は、ブラウザーのコンソールに貼り付けたコードと変わりません。Professor Mariの草案がこれを要求することはできません。

全ページアクセスの拡張機能では、ネットワークリクエストに`marinara.fetch(...)`を使ってください。シグネチャと戻り値は`window.fetch`と同じですが、**Settings > Addons > External Extensions**(設定 > アドオン > 外部拡張機能)に、その拡張機能のセッション中のリクエスト数、レスポンスが報告する転送バイト数、直近のリクエスト頻度、トラフィックが多い状態が続いた場合の警告を表示できます。全ページアクセスは信頼されたページコードとして動くため、`window.fetch`の直接呼び出しも引き続き利用できます。ただし、そのリクエストを拡張機能に紐付けることはできません。

Marinaraは、`capabilities`フィールドを明示していない古い`kind: "marinara.extension"`のv1形式を、サンドボックス導入前のパッケージとみなし、インポート時に**Full page access**を割り当てます。これにより、WeatherTweakerのような旧来のパッケージが、Workerの中で黙って失敗する代わりに、正しい確認の流れに進みます。この形式を使いながら安全なランタイムで動かしたい最近のパッケージは、`"capabilities": []`を明記してください。

External Extensionの2つのゲートと、正確なハッシュの承認は引き続き適用されます。コード、CSS、権限のいずれかが変わると拡張機能は無効になり、あらためて承認が必要になります。無効にすると、Marinaraはスクリプトとスタイルシートのノードを取り除き、互換API経由で作られたタイマーを取り消し、`marinara.onCleanup(...)`で登録されたコールバックを実行します。ページ側のコードは、登録されていないリスナー、タイマー、グローバル変数、DOMの変更を作れるため、後片付けは可能な範囲にとどまります。拡張機能を無効にしたあとに何か残っているようなら、ページを再読み込みしてください。

古い`marinara.ui.showWindow(...)`APIも引き続き使えます。opaque originのiframeの中に一時的なウィンドウを開くためのものです。使えるコントロールは同じで、`update(...)`と`close()`のハンドルを返します。Marinaraの通常の画面移動からツールに行き着くようにしたい場合は、コントリビューションのほうを選んでください。

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
| トップレベルの`version` | パッケージエンベロープのバージョン。現在は`1` |
| `config.name` | 必須の表示名。1-200文字 |
| `config.version` | `1.2.0`などの任意の拡張機能バージョン。数字をピリオドで区切ったバージョンでは、ダウングレード警告を利用可能 |
| `config.description` | 任意の説明。最大2,000文字 |
| `config.runtime` | `client`または`server`。デフォルトは`client` |
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
- **Export**(エクスポート)は、現在のマニフェストとソースファイルをポータブルパッケージに書き出します。承認はエクスポートされません。
- リビジョンの復元、プロファイルのインポート、バックアップの復元後は、再レビューするまで拡張機能が無効なままです。
- **Disable**(無効にする)は、ランタイムと登録済みのクリーンアップを停止します。全ページアクセスのコードが未登録の副作用を作成した場合、ページの再読み込みが必要になることがあります。
- **Delete**(削除)は、インストール済みレコードを削除します。後でソースが必要になる可能性がある場合は、先にエクスポートしてください。

## デバッグ

| 症状 | 確認事項 |
| --- | --- |
| 外部インポートのコントロールが表示されない | 上記のExternal Extension用安全ゲートを両方開く |
| 管理画面にlocalhostまたはAdmin Accessが必要と表示される | `ADMIN_SECRET`を設定し、**Admin Access**(管理者アクセス)に保存する |
| インポートで拡張機能が見つからない | `manifest.json`と相対パスを確認する。ServerにはJS、BrowserにはCSSまたはJSが必要 |
| 編集後に拡張機能が無効になる | 想定どおりの動作。新しい正確なハッシュを確認して承認する |
| Browserコードから`document`、`window`、`fetch`、ローカルストレージを使用できない | 安全なサンドボックスでは想定どおり。文書化されたブローカーAPIを使用する |
| Server Extensionを使用できない | macOS SeatbeltまたはBubblewrapを備えたLinuxを使用するか、Browser Extensionへ切り替える |
| Browser Extensionが例外をスローする | ブラウザー開発者ツールを開く。`marinara.log`と起動エラーには拡張機能名が付く |
| Server Extensionが例外をスローする | **Settings → Addons**(設定 → アドオン)の状態とMarinaraサーバーログを確認する |

CSS、専用ストレージ、インポートアーカイブ、ランタイムメッセージには、それぞれ独立した安全上限があります。Marinaraは実行エラーとして扱うのではなく、パッケージを拒否した境界を報告する必要があります。

## 関連ガイド

- [Personal Extensions](personal-extensions.md)
- [サーバー設定](../CONFIGURATION.md)
- [トラブルシューティング](../TROUBLESHOOTING.md)
- [Personal Extensionのアーキテクチャ](../development/personal-extensions.md)
