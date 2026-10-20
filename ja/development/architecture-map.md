# アーキテクチャマップ(開発者向け)

このガイドは、コントリビューター向けの開発資料です。Marinara Engineのコードがどう構成されているかを説明します。共通の土台、機能ごとのシステム、モードごとの担当範囲、そして各コードの置き場所が対象です。あわせて、現時点で大きくなっているファイルと、今後のリファクタリングの方向性も示します。

対象範囲は`packages/client/src`、`packages/server/src`、`packages/shared/src`です。このリポジトリーには一般的な`.test.ts`のテストスイートはありません。自動検証は、リポジトリーで管理している回帰スクリプトとPlaywrightのスモークテストが担います。一時的な`.test.ts`の検証ファイルはgitignoreの対象で、使い終わったら削除します。

ファイル数、行数、ルート数はリポジトリーの変化にあわせて動きます。このマップが示すのはおおよその形と名前です。正確な数字は、そのつど現在のツリーで確認してください。

## セクションコード

移動の計画を立てるとき、Issueにラベルを付けるとき、まだ移動できないコードに短いファイルヘッダーを添えるときは、次のコードを使います。

| コード | 意味 | 主な置き場所 |
| --- | --- | --- |
| `CORE-CONTRACT` | クライアントとサーバーで共有する型、スキーマ、定数、純粋なヘルパー | `packages/shared/src` |
| `CLIENT-APP` | Reactアプリのブートストラップ、レイアウトのシェル、全体のUI配線 | `packages/client/src/App.tsx`、`main.tsx`、`components/layout` |
| `CLIENT-SHARED` | クライアント専用のUIプリミティブ、共通フック、共通のブラウザー用ヘルパー、グローバルストア | `packages/client/src/components/ui`、`hooks`、`lib`、`stores` |
| `SERVER-APP` | Fastifyアプリのブートストラップ、ミドルウェア、ルート登録、ランタイム設定 | `packages/server/src/app.ts`、`index.ts`、`middleware`、`config` |
| `SERVER-SHARED` | サーバー専用のストレージ、DB、LLM、プロンプト、ロアブック、インポート、連携の土台 | `packages/server/src/services`、`db`、`utils`、`lib` |
| `MODE-CONVERSATION` | Conversation専用のUIとサーバー側の動作 | conversationのコンポーネント、`/api/conversation`、conversationのサービス |
| `MODE-ROLEPLAY` | RoleplayのUI、シーン、スプライト、エンカウント用ヘルパー | roleplayのチャットコンポーネント、`/api/scene`、`/api/encounter`、`/api/sprites` |
| `MODE-GAME` | Game ModeのUI、GMプロンプト、ダイス、パーティー、マップ、戦闘、アセット、セッション | `components/game`、`/api/game`、gameのサービス |
| `FEATURE-AGENTS` | エージェントの定義、実行、デバッグ状態、知識のルーティング | エージェントのコンポーネント、エージェントストア、エージェントのルートとサービス |
| `FEATURE-ASSETS` | 背景、アバター、ギャラリー、生成画像、スプライト、ゲームのアセット | アセットのルート、ギャラリーのストレージ、画像サービス |
| `FEATURE-SIDECAR` | ローカルモデルのランタイム、シーン解析、ダウンロード、プロセス制御 | sidecarストア、`/api/sidecar`、sidecarのサービス |
| `FEATURE-TTS` | TTSの設定、音声のルーティング、キャッシュキー、音声再生 | TTSの設定、フック、ルート、サービス |
| `FEATURE-IMPORT` | SillyTavernとMarinaraのインポーター、および移行用ヘルパー | インポートのルートとサービス |
| `TEST` | 管理下の回帰テストとブラウザーのスモークテスト、必要に応じた一時的な検証テスト | `scripts/regressions`、`e2e`、および使用後に削除する一時的な`packages/server/src/**/__tests__/`のファイル |

セクションはパスそのもので伝わる形が理想です。`// Section: MODE-GAME`のようなコメントが役に立つのは、そのファイルがまだ混在したディレクトリーに置かれている間だけです。

## パッケージの境界

### packages/shared

`CORE-CONTRACT`です。このパッケージはランタイムに依存しない状態を保ちます。

現在の中身:

- `types`: チャット、キャラクター、ゲーム、ゲームの状態、戦闘、シーン、sidecar、TTS、エージェント、プロンプト、ロアブック、エクスポート、テーマ。
- `schemas`: 永続化するエンティティーと共有エンティティーのZodスキーマ。
- `constants`: プロバイダー、デフォルト、チャットモード、モデル一覧、エージェントのプロンプト。
- `utils`: マクロ展開、XMLラップ、音楽のスコアリングなどの純粋なヘルパー。
- `features`: エージェントのマニフェストとレジストリー、function callの定義、フォルダーパッケージ、UNO、Chess、Pokerのターン制ゲームエンジン、Game Modeのルールセットとその戦闘(`rulesets`、`ruleset-combat`、`tactical-combat`と`combat-*`のファイル群)、共有ファイル(舞台設定キット、世界、タイル・盤面・クリーチャーのパック)を含む`world`の世界ジェネレーター。

ルール:

- React、DOM、Fastify、サーバーのストレージ、ファイルシステム、ネットワーク、プロバイダーのSDKに関わるコードは置きません。
- ここへコードを移すのは、クライアントとサーバーの両方が同じ契約か同じ純粋なアルゴリズムを必要とする場合だけです。
- `shared`をクライアント専用ヘルパーの置き場にしないでください。

### packages/client

React 19とVite PWAです。現時点でソースファイルは数百あります。

現在のトップレベルの構成:

- `App.tsx`、`main.tsx`: アプリのブートストラップ、React Query、PWA、グローバルな副作用。
- `components/layout`: アプリのシェル、サイドバー、トップバー、ウィンドウのレンダラー。
- `components/ui`: 再利用できるUIプリミティブ。
- `components/chat`: 共通のチャット、conversation、roleplay、シーン、スプライト、エンカウントのUIが混在しています。
- `components/game`: Game Modeの画面とパネル。
- `components/panels`、`components/modals`、各エンティティーのエディター: 設定とリソース管理。
- `features`: 切り出した機能モジュール。現時点ではChat Settingsの各セクション、トラッカーパネルの部品、マルチプレイヤー、アバターエージェントの契約・セットアップ・ステージ・レンダラー(`features/avatars`)が入っています。
- `hooks`: ほとんどのAPI機能に対応するReact Queryのフックとランタイム用フック。
- `lib`: ブラウザー用とクライアント用のヘルパー。現時点では共通ヘルパーとGame Mode専用のヘルパーが混在しています。
- `stores`: UI、チャットのランタイム、エージェント、ゲームの状態、Game Mode、アセット、sidecar、翻訳、ギャラリー、エンカウント、ターン制ゲームのZustandストア。
- `styles`: グローバルのスタイルシートとテーマごとのCSS。

現時点で注意したい依存の交差:

- `components/game`は、天候やギャラリーのパネルなど共通の見た目の部品を`components/chat`から読み込んでいます。
- `components/chat`は、Roleplayの機能のためにゲームの状態とエンカウントの状態を読み込んでいます。
- `hooks/use-generate.ts`は、チャットの状態、エージェントの状態、ゲームの状態、Game Modeの状態、翻訳の状態、UIの設定に触れています。
- `lib/game-*`のヘルパーはGame Mode専用ですが、グローバルなヘルパーと同じ場所に置かれています。

### packages/server

Fastify製のAPI、ファイルネイティブのストレージ、プロバイダー連携です。現時点でソースファイルは数百あります。

現在のトップレベルの構成:

- `app.ts`、`index.ts`: アプリのファクトリー、ブートストラップ、静的配信、ファイルストレージのハイドレーション、シーダー。
- `routes`: 多数のルートファイル。大半は薄いCRUD APIですが、`generate.routes.ts`と`game.routes.ts`は大きなオーケストレーションのファイルです。`routes/generate/`フォルダーには、これまでに生成パスから切り出した部品が入っています。トークン出力のチェーン(`generation-stream-output.ts`)、ツール呼び出しのラウンド(`tool-rounds.ts`)、返信のコマンド解析とテキストの整理、返信の保存(`save-generated-reply.ts`)などです。
- `services/storage`: チャット、キャラクター、プロンプト、ロアブック、設定、アセット、テーマ、ゲームの状態に対するストレージのファサード層。
- `services/llm`: プロバイダーのレジストリー、プロバイダーの基底契約、OpenAI互換プロバイダー、ローカルのsidecarブリッジ。
- `services/prompt`: Game Mode以外の生成で共通に使うプロンプト組み立て。
- `services/conversation`: スケジュール、自動メッセージ、awareness、conversationのプロファイル、conversationのコマンド処理。
- `services/game`: GMプロンプト、ダイス、戦闘、ステートマシン、パーティーのプロンプト、マップ、天候、時間、セッション、チェックポイント、評判、アセット。
- `services/sidecar`: ローカルランタイム、モデル管理、シーン解析、シーンの後処理。
- `services/agents`: エージェントの実行と知識のルーティング。
- 機能の土台: `services/import`、`services/lorebook`、`services/image`、`services/haptic`、`services/tools`、`services/regex`、`services/professor-mari`、`services/mari-db`、`services/turn-games`、`services/spotify`、`services/video`、`services/generation`、`services/chat-summary`、`services/achievements`、`services/prompt-overrides`、`services/setup`、`services/noodle`、`services/memory-recall`、`services/avatars`(アバターエージェント向けのアバターモデルの保存、生成、感情分類)、`speech-to-text.service.ts`、`discord-webhook.ts`。
- `db/schema`: `DATA_DIR/storage`の下に保存するデータのファイルテーブル定義。
- `db/file-schema.ts`、`db/file-query.ts`: ネイティブテーブルのメタデータとクエリー式。
- `db/file-backed-store.ts`: インメモリーのテーブルストア、トランザクションの境界、クラッシュからの復旧、JSONスナップショットの永続化。[ファイルネイティブストレージ](file-storage.md)を参照してください。

現時点で注意したい依存の交差:

- ルートは、ストレージ、LLM、プロンプト、ロアブック、game、sidecar、各機能のサービスを直接読み込んでいます。
- `generate.routes.ts`は、ConversationとRoleplayの主要な生成パスに加えて、エージェントのパイプラインも担っています。
- `game.routes.ts`はゲームのオーケストレーションを担当しつつ、LLM、sidecar、ロアブック、画像、ストレージ、Discord webhookの動作にも手を伸ばしています。
- シーン解析はsidecarのサービスにありますが、Game Modeはsidecar経由でも、選択したLLMの接続経由でも実行できます。

## モードごとの担当範囲

### すべてのモードで共有するもの

次のものは全体の土台です。

- チャットとメッセージの永続化: `packages/server/src/routes/chats.routes.ts`、`packages/server/src/services/storage/chats.storage.ts`、共有のチャット型とスキーマ。
- キャラクターとペルソナ: キャラクターのルート、ストレージ、スキーマ、クライアント側のキャラクター用フックとエディター。
- 接続とプロバイダー: 接続のルート、ストレージ、共有のプロバイダー定数、`services/llm`。
- プロンプトプリセット、ロアブック、正規表現、カスタムツール: 共通の作成基盤とプロンプト挿入の土台。
- 生成のトランスポート: `packages/client/src/hooks/use-generate.ts`、`packages/server/src/routes/generate.routes.ts`、プロバイダーのレジストリー。
- TTS、翻訳、ギャラリー、テーマ、設定、インポート、バックアップ。

### Conversationモード

主なコード:

- クライアント: `components/chat/ChatConversationSurface.tsx`、`ConversationView.tsx`、`ConversationMessage.tsx`、`ConversationInput.tsx`、`ChatArea.tsx`にあるconversationのクイックスタートの配線。
- クライアントのフック: `use-autonomous-messaging.ts`、`use-background-autonomous.ts`。
- サーバー: `/api/conversation`、`services/conversation/*`。
- 共有のメタデータ: `conversationSchedulesEnabled`、`characterSchedules`、`scheduleWeekStart`、日次と週次の要約。

想定する境界:

- Conversationが担当するのは、スケジュール、自動的な声かけ、conversationのアクティビティー、Roleplay以外のメッセージ表示です。
- Conversationは、ゲームのダイス、GMタグ、クイックタイムイベント、ゲームのマップ、ゲームの戦闘を知る必要はありません。

### Roleplayモード

主なコード:

- クライアント: `components/chat/ChatRoleplaySurface.tsx`、`ChatMessage.tsx`、`ChatInput.tsx`、`RoleplayHUD`の各コンポーネント、`SpriteOverlay.tsx`、`SceneBanner.tsx`、`CyoaChoices.tsx`、`EncounterModal.tsx`。
- サーバー: `/api/scene`、`/api/encounter`、`/api/sprites`、`/api/generate`の一部。
- 共有の契約: `scene`、Roleplay関連のチャットのメタデータ項目、スプライトの配置に関する型。

想定する境界:

- Roleplayが担当するのは、シーン、スプライトの表示、CYOAの選択肢、RoleplayのHUD、Roleplayのエンカウント補助フローです。
- Game Modeでも使う共通の視覚効果は、`components/chat`の外へ移します。

### Game Mode

主なコード:

- クライアント: `components/game/*`、`hooks/use-game.ts`、`hooks/use-scene-analysis.ts`、`stores/game-mode.store.ts`、`stores/game-state.store.ts`、`stores/game-asset.store.ts`、`lib/game-*`、`lib/party-dialogue-parser.ts`。
- サーバー: `/api/game`、`/api/game-assets`、`services/game/*`、`services/sidecar/scene-analyzer.ts`と`scene-postprocess.ts`のゲーム関連部分。
- 共有の契約: `types/game.ts`、`types/game-state.ts`、`types/combat-encounter.ts`、`ChatMetadata`のゲーム関連の項目。

想定する境界:

- Game Modeが担当するのは、GMプロンプト、パーティーのプロンプト、ダイス、スキル判定、クイックタイムイベント、ゲームの戦闘、マップ、移動と休息、天候と時間、NPCの評判、ゲームセッションの要約、生成したゲームのアセット、ゲームのログです。
- Game Modeは、共有プリミティブか明示的に共有した機能コンポーネントを介する場合を除き、チャットモードのUIに依存しないようにします。

## 現時点で大きいファイル

次のファイルは、多くの関心事を1か所に抱えているため、今後の作業の足かせになりやすいものです。行数は頻繁に変わるので、この一覧では正確なサイズではなく、おおよその順序と抱えている関心事を示します。

| ファイル | セクション | 抱えている関心事 |
| --- | --- | --- |
| `packages/server/src/routes/generate.routes.ts` | 生成とエージェントの共通部分 | ルート、ストリーミング、プロンプト、エージェント、ストレージ、副作用が1つのファイルに同居しています。 |
| `packages/server/src/routes/game.routes.ts` | `MODE-GAME` | APIのハンドラー、GMのフロー、シーン解析、アセット、戦闘、永続化が密結合しています。 |
| `packages/client/src/components/game/GameSurface.tsx` | `MODE-GAME` | 描画、状態のオーケストレーション、アセット、ログ、ナレーション、戦闘、演出が密結合しています。 |
| `packages/client/src/components/chat/ChatSettingsDrawer.tsx` | チャット設定の混在 | セクションの切り出しを`features/chat-settings`で進めていますが、パネル本体はまだ大きいままです。 |
| `packages/client/src/components/game/GameNarration.tsx` | `MODE-GAME` | 表示の描画とコマンドの整形が密結合しています。 |
| `packages/client/src/components/game/GameCombatUI.tsx` | `MODE-GAME` | 戦闘の表示、操作、ログは、より小さなパネルとフックに分けられます。 |
| `packages/client/src/components/chat/RoleplayHUD.tsx` | `MODE-ROLEPLAY` | `RoleplayHUDActionsMenu.tsx`と`RoleplayHUDPanels.tsx`への分割が途中まで進んでいます。 |

## 目指す構造

これは今後のリファクタリングの方向性です。すべてを一度に移す必要はありません。

### クライアントの目標

```text
packages/client/src/
  app/                         # App bootstrap, shell integration, providers
  shared/
    components/                # UI primitives and mode-agnostic widgets
    hooks/                     # cross-feature client hooks
    lib/                       # browser/runtime helpers
    stores/                    # global client stores only
  features/
    agents/
    assets/
    gallery/
    sidecar/
    tts/
    translation/
  modules/
    conversation/
      components/
      hooks/
      lib/
    roleplay/
      components/
      hooks/
      lib/
    game/
      components/
      hooks/
      lib/
      stores/
```

### サーバーの目標

```text
packages/server/src/
  app/                         # Fastify setup, route registration, middleware
  shared/
    db/
    storage/
    llm/
    prompt/
    lorebook/
    utils/
  features/
    agents/
    assets/
    haptic/
    image/
    import/
    sidecar/
    tts/
  modules/
    chat/
    conversation/
    roleplay/
      scene/
      encounter/
      sprites/
    game/
      routes/
      services/
      prompts/
```

### sharedの目標

```text
packages/shared/src/
  contracts/
    chat/
    conversation/
    roleplay/
    game/
    providers/
  constants/
  utils/
```

かつての平坦な`types`、`schemas`、`constants`の構成だけでは、もう全体を説明できません。現在は`packages/shared/src/features/`がエージェント、function call、フォルダーパッケージ、ターン制ゲーム、ルールセットと戦闘、世界ジェネレーターを抱えています。sharedの最初の整理は、あくまで型のレベルで少しずつ進めるべきで、ファイルの一括移動にはしません。

## 移行のルール

1. 新しいコードは、正しい範囲のうち最も狭いセクションに置きます。
2. 2つ以上のモードが同じクライアントコンポーネントを使う場合は、モード固有の振る舞いを追加する前に`CLIENT-SHARED`へ移します。
3. クライアントとサーバーの両方が型、スキーマ、純粋なヘルパーを必要とする場合は、`CORE-CONTRACT`へ移します。
4. サーバーだけが必要とするものは、`packages/shared`に入れません。
5. ルートのファイルは、HTTPの入力を検証してサービスを呼ぶところまでにします。ドメインの判断はサービス側へ移します。
6. ストアはグローバル(`ui`、`chat`、`sidecar`)か、モード固有(`game-mode`、`encounter`)のどちらかにします。1つのストアが複数のモードを暗黙のうちに抱える形は避けてください。
7. メタデータは`ChatMode`で判別できる形にします。共通のメタデータに、conversation、roleplay、gameの項目が加わる構造です。
8. 移動は1つの機能ずつ進めます。広く使われているインポートパスがリポジトリー全体を揺らすときは、互換用のエクスポートやラッパーを残してください。
9. 移動のたびにlintを実行します。

   ```bash
   pnpm lint
   ```

   そのうえで、変更したファイルにPrettierのチェックをかけます。

## 最初のリファクタリング候補

次に挙げるものは、動作を変えずに結合を減らせるため、最初の整理として適しています。

1. `components/chat`を、共通、conversation、roleplayのグループに分割する。
   - 共通の候補: `ChatCommonOverlays`、`ChatBranchSelector`、`ChatGalleryDrawer`、`WeatherEffects`、共通のメッセージと入力のプリミティブ。
   - conversationの候補: `ChatConversationSurface`、`ConversationView`、`ConversationMessage`、`ConversationInput`。
   - roleplayの候補: `ChatRoleplaySurface`、`SpriteOverlay`、`SceneBanner`、`CyoaChoices`、`EncounterModal`。RoleplayのHUDの分割は`RoleplayHUDActionsMenu.tsx`と`RoleplayHUDPanels.tsx`で途中まで進んでいます。
2. Game Mode専用のクライアントヘルパーをgameのモジュール配下へ移す。
   - 候補: `game-audio`、`game-tag-parser`、`game-full-body-pose`、`game-character-name-match`、`game-segment-edits`、`party-dialogue-parser`。
3. `GameSurface.tsx`をランタイムのフックと小さめのコンテナーに分割する。
   - フックの候補: ナレーションのランタイム、アセットのランタイム、シーン解析のランタイム、戦闘のランタイム、ログと履歴のランタイム、音声のランタイム。
4. `GameNarration.tsx`を、コマンドの解析と整形、および表示コンポーネントに分割する。
5. `game.routes.ts`をハンドラーのグループごとに分割する。
   - グループの候補: セットアップとセッション、ターンの生成、ダイスとスキルとクイックタイムイベント、ジャーナルとインベントリー、マップと移動と天候、戦闘、アセットとシーン解析。
6. `generate.routes.ts`を、生成のトランスポート、エージェントのパイプライン処理、リトライのルート、コマンドと後処理のヘルパーに分割する。Issue #7573で着手済みです。トークン出力のチェーン、ツールのラウンド、返信のコマンド、返信テキストの整理、保存メッセージの生成情報、隠しコマンドのアンカー、返信の保存は、それぞれ専用の回帰テスト付きで`routes/generate/`に移りました。
7. `ChatMetadata`をモードごとのメタデータの契約に分割する。
8. gameがチャットの内部をこれ以上読み込む前に、共通のRoleplayとGame Modeの視覚要素を`components/chat`の外へ移す。

## 実際の進め方

次の整理のPRでは、この順番で進めてください。

1. 1つの領域だけ、目標のディレクトリーを作ります。
2. まず純粋なヘルパーを移します。
3. 次にリーフのコンポーネントを移します。
4. 大きなオーケストレーターは、そのインポートの大半が新しいモジュールを指すようになるまで、その場に残します。
5. 互換用の再エクスポートは、インポートの揺れが本題の変更を見えにくくする箇所にだけ追加します。
6. lintを実行します。

   ```bash
   pnpm lint
   ```

   そのうえで、変更したファイルにPrettierのチェックをかけます。

## 関連ガイド

- [フロントエンドアーキテクチャ(開発者向け)](frontend.md)
- [ファイルネイティブストレージ](file-storage.md)
