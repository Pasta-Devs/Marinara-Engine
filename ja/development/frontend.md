# フロントエンドアーキテクチャ(開発者向け)

これは開発者向けの資料で、エンドユーザー向けのガイドではありません。Marinara Engineのクライアントがどう作られているかを説明します。扱う範囲は、Reactアプリの構成、Zustandストア、React Queryのフック、主要なコンポーネント、そしてサーバーAPIのマップです。アプリの使い方を知りたい場合は、ユーザーガイドから読んでください。

## 概要

Marinara Engineは、Conversation、Roleplay、Game Modeの3つのモードを備えたAIチャットアプリです。クライアントはReact 19のシングルページアプリで、Viteが配信し、Tailwind CSS v4でスタイルを当て、Progressive Web App (PWA)としてパッケージ化しています。

クライアントの実体は`packages/client`にあります。Fastify製のAPIサーバー(`packages/server`)とはRESTおよびServer-Sent Events (SSE)で通信します。両者で共有するデータ契約(型、Zodスキーマ、定数)は`packages/shared`にあり、双方から読み込みます。

## アプリのアーキテクチャ

### 3カラムレイアウト

画面はDiscord風の3カラム構成で、`components/layout/AppShell.tsx`が管理します。

```
+-------------+-----------------------------+--------------+
|  Left       |         Center              |  Right       |
|  Sidebar    |                             |  Panel       |
|             |  Chat area or Editor        |              |
|  Chat list  |  (lazy-loaded)              |  Characters  |
|  Folders    |                             |  Lorebooks   |
|  Mode tabs  |  ChatConversationSurface    |  Presets     |
|             |  ChatRoleplaySurface        |  Connections |
|             |  GameSurface                |  Agents      |
|             |  CharacterEditor            |  Personas    |
|             |  LorebookEditor             |  Settings    |
|             |  PresetEditor               |  Browser     |
|             |  ...other editors           |              |
+-------------+-----------------------------+--------------+
```

- 左サイドバー(`components/layout/ChatSidebar.tsx`): チャット一覧です。フォルダー単位で整理し、モード(Conversation、Roleplay、Game)で絞り込めます。
- 中央ペイン: アクティブなチャット画面か、全画面のエディター(キャラクター、ロアブック、プリセットなど)のどちらかです。同時に表示するのは片方だけで、エディターを開くとチャット領域と入れ替わります。
- 右パネル(`components/layout/RightPanel.tsx`): リソースの一覧と設定です。トップバーから開閉します。一度マウントしたパネルはCSSで非表示にするだけでDOMに残し、スクロール位置とローカルな状態を保ちます。
- トップバー(`components/layout/TopBar.tsx`): 各右パネルへ素早く切り替えるボタンが並びます。

### ナビゲーション

ナビゲーションは状態が駆動します。URLルーターはありません。何を描画するかは`stores/ui.store.ts`のZustandストアが決めます。

| 遷移先                 | ストアの項目          | 呼び出す関数                                      |
| ---------------------- | -------------------- | ------------------------------------------------- |
| キャラクターエディターを開く  | `characterDetailId`  | `openCharacterDetail(id)`                          |
| ロアブックエディターを開く  | `lorebookDetailId`   | `openLorebookDetail(id)`                           |
| プリセットエディターを開く  | `presetDetailId`     | `openPresetDetail(id)`                             |
| 接続エディターを開く      | `connectionDetailId` | `openConnectionDetail(id)`                         |
| エージェントエディターを開く | `agentDetailId`      | `openAgentDetail(id)`                              |
| ペルソナエディターを開く   | `personaDetailId`    | `openPersonaDetail(id)`                            |
| 右パネルを切り替える      | `rightPanel`         | `openRightPanel(name)` / `toggleRightPanel(name)` |
| ウィンドウを開く         | `modal`              | `openModal(type, props?)`                          |

### コード分割

主要なエディターと重量級のコンポーネントは、`AppShell.tsx`で`React.lazy()`と`Suspense`を使って遅延読み込みします。これで初期バンドルを小さく保てます(後述のバンドルサイズの上限を参照)。

## 状態管理

### Zustandストア(クライアント側の状態)

UIと実行時の状態には、`packages/client/src/stores/`にあるZustandストア群を使います。永続化しているストアは`ui.store.ts`だけです。残りは、チャット、エージェント、ゲーム、ローカルモデルのランタイム、翻訳、ダイアログ、バックフィル、テーブルゲームの実行時状態を保持します。

現在のストアファイルは次のとおりです: `agent.store.ts`、`backfill.store.ts`、`chat.store.ts`、`chess-game.store.ts`、`dialog.store.ts`、`encounter.store.ts`、`gallery.store.ts`、`game-asset.store.ts`、`game-mode.store.ts`、`game-state.store.ts`、`poker-game.store.ts`、`sidecar.store.ts`、`translation.store.ts`、`ui.store.ts`、`uno-game.store.ts`。

#### `ui.store.ts`: 設定とUIの外枠

唯一の永続化ストアです(Zustandの`persist`ミドルウェア経由でlocalStorageに保存します)。保持する内容は次のとおりです。

- テーマ: `visualTheme`(「default」または「sillytavern」)、`data-theme`の値(darkまたはlight)、色の個別上書き。
- 外観: `fontSize`、`chatFontSize`、`fontFamily`、カスタムフォント、カーソルのスタイル。
- チャットの表示: `boldDialogue`、`showTimestamps`、`showModelName`、`messagesPerPage`。
- 文字の装飾: チャットの文字色、Roleplayのメッセージ背景の不透明度、文字の縁取り。
- ストリーミング: `enableStreaming`と`streamingSpeed`。
- Conversationのテーマ: メッセージ吹き出しのグラデーション色。
- サウンド: `convoNotificationSound`と`rpNotificationSound`。
- 挙動: `confirmBeforeDelete`、`enterToSendRP`、`enterToSendConvo`、`weatherEffects`、`guideGenerations`。
- ナビゲーション: `rightPanel`、`rightPanelOpen`、`sidebarOpen`、`settingsTab`、`*DetailId`のすべての項目、`modal`。

同期されるカスタムテーマは`ui.store.ts`には保存しません。React Query経由でサーバーから取得し、同じMarinaraインスタンスに接続したデバイス間でミラーリングします。

#### `chat.store.ts`: チャットの実行時状態

永続化しません。アクティブなチャットセッションを追跡します。

- `activeChatId`: 表示中のチャット。
- `messages`: 現在のメッセージ配列。
- `isStreaming`、`streamBuffer`: 生成中の状態。
- `inputDrafts`: チャットごとの下書きメッセージ。
- `currentInput`: チャット入力欄の現在の値。
- `perChatTyping`: 入力中インジケーターの状態。
- `unreadCounts`、`chatNotifications`: 通知バッジ。
- `abortControllers`: 実行中の生成をキャンセルするためのもの。

#### `agent.store.ts`: エージェントの実行

生成中と生成後のエージェントパイプラインの状態を追跡します。

- `activeAgents`: 実行中のエージェント。
- `thoughtBubbles`: リアルタイムに表示するエージェントの思考。
- `echoMessages`: エコーチェンバー(視聴者のチャットを模したもの)。
- `cyoaChoices`: 分岐選択肢のUI。
- `debugLog`: パフォーマンス指標とトークン使用量。
- `failedAgentTypes`: エラーになったエージェント(再試行UI用)。

#### `game-state.store.ts`: RPGコンパニオン

Roleplayモードのシーンと世界の状態を保持します。

- `current`(GameState): 日付、時刻、場所、天候、登場中のキャラクター、イベント、プレイヤーの能力値、クエスト、インベントリー。
- `isVisible`、`expandedSections`: HUDの表示状態。

#### `encounter.store.ts`: 戦闘システム

ターン制戦闘の状態です。

- `active`: エンカウント中かどうか。
- `party`、`enemies`: HP、攻撃手段、状態異常を持つ戦闘参加者。
- `environment`: 戦場の詳細。
- `playerActions`、`encounterLog`: 行動キューと履歴。
- `combatResult`: 勝利、敗北、逃走、中断のいずれか。

#### `gallery.store.ts`: 画像のオーバーレイ

- `pinnedImages`: チャット領域にオーバーレイとしてピン留めした画像。

### React Query(サーバーのデータ)

サーバーのデータはすべてTanStack React Queryで取得してキャッシュします。設定は`main.tsx`にあります。

- Stale time: 30秒(全体のデフォルト)。
- リトライ: 1回。
- フォーカス時の再取得: 無効。
- キャッシュ: メモリー上のみ(永続化なし)。

エンティティーごとに専用のフックファイルがあり、クエリーとミューテーションのフックをエクスポートします。

## フックのリファレンス

フックはすべて`src/hooks/`にあり、`use-{entity}.ts`という命名に従います。

### チャットのフック(`use-chats.ts`)

| フック                              | 種類           | 説明                                          |
| ---------------------------------- | -------------- | -------------------------------------------- |
| `useChats()`                       | クエリー          | すべてのチャット                                    |
| `useChat(id)`                      | クエリー          | IDで指定した1件のチャット                            |
| `useChatMessages(chatId, perPage)` | 無限クエリー | チャットのメッセージをページ単位で取得                |
| `useChatGroup(groupId)`            | クエリー          | チャットグループ                                   |
| `useCreateChat()`                  | ミューテーション       | チャットを新規作成                            |
| `useDeleteChat()`                  | ミューテーション       | チャットを削除                            |
| `useUpdateChatMetadata()`          | ミューテーション       | チャットのメタデータを更新(エージェント、スプライトなど) |
| `useBranchChat()`                  | ミューテーション       | 指定したメッセージからチャットを分岐させる        |
| `useUpdateMessage()`               | ミューテーション       | メッセージ本文を編集(楽観的更新)     |
| `useDeleteMessage()`               | ミューテーション       | メッセージを1件削除                     |
| `useDeleteMessages()`              | ミューテーション       | メッセージを複数削除                     |
| `useSetActiveSwipe()`              | ミューテーション       | 別の生成結果のスワイプに切り替える       |
| `usePeekPrompt()`                  | ミューテーション       | 組み立て後のプロンプトをプレビュー             |
| `useClearAllData()`                | ミューテーション       | すべて削除(元に戻せません)              |

### キャラクターのフック(`use-characters.ts`)

| フック                  | 種類     | 説明                            |
| ---------------------- | -------- | -------------------------------------- |
| `useCharacters()`      | クエリー    | すべてのキャラクター                         |
| `useCharacter(id)`     | クエリー    | 1件のキャラクター(カードデータを解析済み) |
| `useCreateCharacter()` | ミューテーション | キャラクターを作成                       |
| `useUpdateCharacter()` | ミューテーション | キャラクターカードのデータを更新            |
| `useDeleteCharacter()` | ミューテーション | キャラクターを削除                       |
| `useUploadAvatar()`    | ミューテーション | アバター画像をアップロード                    |
| `usePersonas()`        | クエリー    | すべてのペルソナ                         |
| `usePersona(id)`       | クエリー    | 1件のペルソナ                         |
| `useCreatePersona()`   | ミューテーション | ペルソナを作成                       |
| `useUpdatePersona()`   | ミューテーション | ペルソナを更新                       |
| `useDeletePersona()`   | ミューテーション | ペルソナを削除                       |
| `useCharacterGroups()` | クエリー    | キャラクターグループ                       |
| `usePersonaGroups()`   | クエリー    | ペルソナグループ                       |

### プリセットのフック(`use-presets.ts`)

| フック                           | 種類     | 説明                                                          |
| ------------------------------ | -------- | ---------------------------------------------------------- |
| `usePresets()`                 | クエリー    | すべてのプリセット                                                |
| `usePreset(id)`                | クエリー    | 1件のプリセット                                              |
| `usePresetFull(id)`            | クエリー    | セクション、グループ、選択肢を含むプリセット                  |
| `useDefaultPreset()`           | クエリー    | デフォルトのプリセット                                         |
| `useCreatePreset()`            | ミューテーション | プリセットを作成                                              |
| `useUpdatePreset()`            | ミューテーション | プリセットを更新                                              |
| `useDeletePreset()`            | ミューテーション | プリセットを削除                                              |
| `usePresetSections(presetId)`  | クエリー    | プリセットのプロンプトセクション                               |
| `usePresetGroups(presetId)`    | クエリー    | セクションのグループ                                           |
| `usePresetVariables(presetId)` | クエリー    | プリセット変数(旧称: choice block)                  |
| `usePreviewPreset()`           | ミューテーション | `{ presetId, chatId, choices }`に対する描画後のプロンプトプレビュー |

### エージェントのフック(`use-agents.ts`)

| フック                | 種類     | 説明                     |
| -------------------- | -------- | ------------------------------- |
| `useAgentConfigs()`  | クエリー    | すべてのエージェント設定        |
| `useAgentConfig(id)` | クエリー    | 1件のエージェント設定             |
| `useCreateAgent()`   | ミューテーション | カスタムエージェントを作成             |
| `useUpdateAgent()`   | ミューテーション | エージェント設定を更新            |
| `useDeleteAgent()`   | ミューテーション | エージェントを削除                    |
| `useToggleAgent()`   | ミューテーション | 組み込みエージェントをオンまたはオフにする |

### 生成のフック(`use-generate.ts`)

いちばん複雑なフックです。`{ generate, retryAgents }`を返します。

`generate(params)`はオプションオブジェクトを1つ受け取ります。項目には`chatId`、`connectionId`、`userMessage`、`regenerateMessageId`、`continueMessageId`、`impersonate`、`attachments`などがあります。そのチャットですでに生成が実行中の場合は`false`を返します。処理の流れは次のとおりです。

1. `chat.store.ts`のストリーミング状態を立てる。
2. 生成リクエストを`/api/generate`へ送る。
3. `token`、`agent_start`、`agent_result`、`agent_error`、`thinking`、`tool_call`、`game_state`、`game_state_patch`、`text_rewrite`、`scene_created`、`done`、`error`といったSSEイベントを解析する。
4. 新しいメッセージでReact Queryのキャッシュを更新する。
5. 思考バブルとデバッグ情報をエージェントストアに入れる。
6. エラーはトースト通知で扱う。

### そのほかのフック

`src/hooks/`フォルダーには、機能ごとのフックが多数あります。代表的なものは次のとおりです。

| ファイル                        | 用途                                       |
| ------------------------------ | ----------------------------------------- |
| `use-connections.ts`           | API接続のCRUDと接続テスト             |
| `use-lorebooks.ts`             | ロアブックとエントリーのCRUD                    |
| `use-scene.ts`                 | シーンの計画、作成、終了       |
| `use-encounter.ts`             | 戦闘エンカウントの開始、行動、要約     |
| `use-autonomous-messaging.ts`  | 自律メッセージ送信のポーリングとスケジュール  |
| `use-idle-detection.ts`        | 10分間の無操作を検出                 |
| `use-background-autonomous.ts` | 非アクティブなチャットへのバックグラウンドポーリング      |
| `use-translate.ts`             | テキストの翻訳                          |
| `use-apply-regex.ts`           | メッセージへの正規表現スクリプトの適用         |
| `use-custom-tools.ts`          | カスタムツールのCRUD                           |
| `use-knowledge-sources.ts`     | 知識ソースの管理                |
| `use-gallery.ts`               | チャットのギャラリー画像                      |
| `use-chat-folders.ts`          | チャットフォルダーのCRUDと並べ替え          |
| `use-regex-scripts.ts`         | 正規表現スクリプトのCRUD                       |
| `use-haptic.ts`                | ハプティックデバイスの接続とコマンド      |

## コンポーネントガイド

### チャットシステム(`components/chat/`)

チャットシステムは最も大きな機能領域です。`ChatArea.tsx`が3つの描画サーフェス(Conversation、Roleplay、Game Mode)を遅延読み込みします。

#### Conversationモード(`ChatConversationSurface.tsx`)

メッセンジャー風の吹き出しチャットです。ユーザーのメッセージが右、アシスタントのメッセージが左に並びます。主な機能は次のとおりです。

- 無限スクロールのページング(上へスクロールすると古いメッセージを読み込みます)。
- メッセージ単位の操作: 編集、コピー、再生成、削除、分岐、プロンプトの確認。
- 添付ファイル(画像とファイル)への対応。
- 絵文字とGIFのピッカー。
- スラッシュコマンド。
- 新着メッセージの通知音。
- チャットごとの下書き保持。

#### Roleplayモード(`ChatRoleplaySurface.tsx`)

暗く没入感のあるRPG風のインターフェイスです。Conversationの機能をすべて備えたうえで、次の要素が加わります。

- キャラクターのスプライト。表情はexpressionエージェントが切り替えます。
- ゲームの状態(時刻、場所、天候、登場中のキャラクター)を表示するRoleplay HUD。
- 天候エフェクト(シーンの天候に合わせたパーティクルのオーバーレイ)。
- エコーチェンバーのパネル(視聴者の反応を模したもの)。
- ターン制の行動システムを備えた戦闘エンカウント。
- 有効なロアブックのエントリーを表示する世界情報のパネル。
- ミニロールプレイに分岐するためのシーンシステム。
- クロスフェードで切り替わる背景画像。

#### Game Mode(`GameSurface.tsx`)

AIゲームマスター(GM)の画面です。chatフォルダーの外、`components/game/GameSurface.tsx`にあります。チャットのモードが`game`のとき、`ChatArea.tsx`がこれを描画します。専用のゲームストア(`game-mode.store.ts`、`game-asset.store.ts`、`game-state.store.ts`)を読み取り、`use-game.ts`と`use-game-storyboards.ts`のフックを通じてセッション、ダイスロール、スキル判定、マップ、ターンごとの絵コンテを動かします。

#### 主要なコンポーネント

- `ChatArea.tsx`: 中心となる司令塔です。すべてのデータ(メッセージ、キャラクター、ペルソナ)を取得し、キャラクターのマップを組み立て、チャットのモードを判定して、適切なサーフェスを描画します。
- `ChatMessage.tsx`: メッセージ1件を描画します。Markdownの表示、スワイプの切り替え、編集、操作メニューを担当します。編集中の再描画を避けるため、非制御の`EditTextarea`サブコンポーネントを使います。
- `ChatInput.tsx`: 入力欄です。高さの自動調整、下書きの保持、スラッシュコマンドの補完、添付ファイルの処理、絵文字やGIFの挿入に対応します。

### エディターのコンポーネント

リソースの種類ごとに、チャット領域と入れ替わる全画面エディターがあります。

| エディター            | ファイル                                          | 扱う内容                                                                         |
| ----------------- | --------------------------------------------- | ------------------------------------------------------------------------------- |
| Character Editor  | `components/characters/CharacterEditor.tsx`   | キャラクターカードの項目、アバター、挨拶メッセージ、性格、システムプロンプト、メタデータ   |
| Lorebook Editor   | `components/lorebooks/LorebookEditor.tsx`     | ロアブックのメタデータと、キー、発動条件、挿入設定を持つエントリー   |
| Preset Editor     | `components/presets/PresetEditor.tsx`         | プロンプトのセクション、グループ、マーカー、生成パラメーター、choice block          |
| Connection Editor | `components/connections/ConnectionEditor.tsx` | APIプロバイダー、ベースURL、モデル、コンテキストウィンドウ、各種フラグ                            |
| Agent Editor      | `components/agents/AgentEditor.tsx`           | エージェントのプロンプトテンプレート、フェーズ、接続、ツール、設定                       |
| Persona Editor    | `components/personas/PersonaEditor.tsx`       | 名前、説明、能力値、アバターを持つペルソナ                              |

### ウィンドウシステム(`components/modals/`)

ウィンドウは`components/layout/ModalRenderer.tsx`が描画します。`ui.store.modal`を読み取り、対応するコンポーネントを`Suspense`の内側に描画します。ウィンドウのコンポーネントは`components/modals/`以下にあります。

現在のウィンドウの種類には次のようなものがあります(網羅ではなく代表例です)。

| 種類                        | コンポーネント                     | 用途                                    |
| -------------------------- | ----------------------------- | ------------------------------------------ |
| `create-character`         | `CreateCharacterModal`        | キャラクターの簡易作成(名前とアバター) |
| `create-connection`        | `CreateConnectionModal`       | 接続の簡易作成                   |
| `create-persona`           | `CreatePersonaModal`          | ペルソナの簡易作成                      |
| `create-lorebook`          | `CreateLorebookModal`         | ロアブックの簡易作成                     |
| `create-preset`            | `CreatePresetModal`           | プリセットの簡易作成                       |
| `import-character`         | `ImportCharacterModal`        | ファイル(JSONまたはPNG)からインポート             |
| `import-connection`        | `ImportConnectionModal`       | 接続パッケージのインポート              |
| `import-lorebook`          | `ImportLorebookModal`         | ファイルからインポート                          |
| `import-preset`            | `ImportPresetModal`           | ファイルからインポート                          |
| `import-persona`           | `ImportPersonaModal`          | ファイルからインポート                          |
| `character-card-update`    | `CharacterCardUpdateModal`    | エージェントが提案したカード更新の確認       |
| `agent-write-approval`     | `AgentWriteApprovalModal`     | エージェントの書き込みに対する同意と確認             |
| `docs-viewer`              | `DocsViewerModal`             | アプリ内のドキュメントビューアー               |
| `st-bulk-import`           | `STBulkImportModal`           | SillyTavernのデータを一括インポート             |
| `about-me-viewer`          | `AboutMeViewerModal`          | ConversationモードのAbout Meを表示          |
| `scene-prompt-preferences` | `ScenePromptPreferencesModal` | シーンプロンプトの設定                     |

ウィンドウの共通パターン: どのウィンドウも`{ open, onClose }`を受け取り、中身を`Modal`ベースコンポーネントで包み、API呼び出しにはミューテーションを使い、`mutation.isPending`から読み込み中の表示を出します。

### パネルシステム(`components/panels/`)

右側のパネルは、検索、並べ替え、絞り込みができるリソース一覧です。リソースをクリックすると、中央ペインにそのエディターが開きます。

パネルは`RightPanel.tsx`の2か所に登録します。

1. `PANEL_CONFIG`: タイトル、アイコン、グラデーションの色。
2. `PANELS`: コンポーネントの対応表。

パネルはモジュールレベルで状態を保持します。訪問済みのパネルは`mountedPanels`というSetで管理します。一度マウントしたパネルは状態を保つためDOMに残り、`display: none`または`aria-hidden`で隠れているだけです。

### UIプリミティブ(`components/ui/`)

| コンポーネント          | 説明                                                            |
| ------------------ | --------------------------------------------------------------------- |
| `Modal`            | 基本のウィンドウ。背景クリック、Escキー、開閉アニメーションに対応 |
| `ColorPicker`      | 単色またはグラデーションのピッカー。プリセットの見本付き                   |
| `ExpandedTextarea` | 長い文章を編集するための全画面ポータルオーバーレイ              |
| `EmojiPicker`      | 検索できる絵文字のポップオーバー(ポータルで描画)                            |
| `GifPicker`        | Giphy APIを使ったGIF検索                                          |
| `HelpTooltip`      | ホバーするとポータルで位置決めしたツールチップを表示するアイコン                     |

UIコンポーネントはすべて制御コンポーネント(valueとonChange)として作り、オーバーレイはポータルで描画します。

## APIクライアント(`lib/api-client.ts`)

サーバーとの通信はすべて`api`オブジェクトを経由します。

```typescript
import { api, ApiError } from "@/lib/api-client";
```

| メソッド                         | シグネチャ           | 説明                           |
| ------------------------------ | ------------------- | ------------------------------------- |
| `api.get<T>(path)`             | `GET /api{path}`    | JSONを取得                            |
| `api.post<T>(path, body)`      | `POST /api{path}`   | JSONを送信し、JSONを受け取る               |
| `api.put<T>(path, body)`       | `PUT /api{path}`    | 全体を更新                            |
| `api.patch<T>(path, body)`     | `PATCH /api{path}`  | 一部を更新                            |
| `api.delete(path)`             | `DELETE /api{path}` | リソースを削除                       |
| `api.upload(path, FormData)`   | `POST /api{path}`   | multipartでのファイルアップロード                 |
| `api.download(path, filename)` | `GET /api{path}`    | ダウンロードと保存先ウィンドウの表示          |
| `api.stream(path, body)`       | `POST /api{path}`   | SSEの非同期ジェネレーター(トークンのみ)     |
| `api.streamEvents(path, body)` | `POST /api{path}`   | SSEの非同期ジェネレーター(すべてのイベント種別) |

エラーは`ApiError`としてthrowされます。`status`と`message`のプロパティーを持ちます。

## スタイリングの仕組み

### Tailwind CSS v4

このプロジェクトはTailwind CSS v4を`@tailwindcss/vite`プラグインで使います(PostCSSの設定は不要です)。テーマのトークンは`globals.css`のCSSカスタムプロパティーから対応付けます。

```css
@theme {
  --color-primary: var(--primary);
  --color-background: var(--background);
  --color-border: var(--border);
  /* ... */
}
```

### テーマのアーキテクチャ

`globals.css`はラベル付きのセクションに分かれています。Tailwindの`@theme`マッピング、ダークテーマの変数、ライトテーマの上書き、ベースのリセット、カスタムカーソル、スクロールバー、ガラス風パネル、グロー系ユーティリティー、UIコンポーネント、キーフレームアニメーションなどが含まれます。ほかにも、チャットのアニメーション、モードごとのチャットのスタイル、スプライトとゲームのHUD、関数呼び出しカード、レスポンシブの規則、取り込んだSillyTavernテーマ、アクセシビリティーの規則、パフォーマンスのヒントを扱うセクションがあります。

### カスタムテーマ

カスタムテーマは自由に作成できます。テーマの定義はMarinaraのサーバーに保存し、接続中のデバイス間で同期します。有効になっているカスタムテーマも共有されます。CSSは`CustomThemeInjector.tsx`が`style`タグとして挿入します。

同期されるテーマのCSSからは、`--marinara-theme-accent-pulse: enabled`で組み込みのAccent Pulseエンジンを呼び出せます。現在のAppearanceのアクセント色ではなく特定のテーマのアクセント色でパルスさせたいときは、`--marinara-theme-accent-pulse-source: #a78bfa`(またはグラデーション)を追加します。

### Personal Extensions

Personal Extensionsは、サーバーに保存され、ハッシュの完全一致で承認される、サンドボックス内で動くコードです。AddonsのUIは`use-personal-extensions.ts`を使います。`PersonalExtensionInjector.tsx`は、承認済みのBrowser用コードを不透明オリジンのサンドボックス化iframe内の専用Workerで実行し、変更不可のアクティブチャットのコンテキストスナップショットを仲介します。コンテキストの項目は常に存在します。アクティブなチャットがないときは`chatId`と`characterId`が`null`になり、`characterIds`は空になります。アクティブなキャラクターカードと選択中のペルソナの一部の項目を読むには、別途宣言してハッシュに紐づけた権限が必要です。サーバー側の拡張機能は、macOSのSeatbeltまたはLinuxのBubblewrap内の独立したNodeプロセスで動き、どちらのバックエンドも使えない場合は動作を停止します。外部ソースを使うには、`.env`のゲートに加えて、一覧表示、承認、実行の各境界でDanger Zoneのオプトインが必要です。

この機能を変更する前に、[Personal Extensionのアーキテクチャ](personal-extensions.md)を読んでください。

## 共有パッケージ(`packages/shared`)

フロントエンドは`@marinara-engine/shared`から型、スキーマ、定数を読み込みます。

### 定数

`packages/shared/src/constants/`の主なファイルは次のとおりです。

- `defaults.ts`: `APP_VERSION`、`PROFESSOR_MARI_ID`、`DEFAULT_CONNECTION_ID`、`DEFAULT_GENERATION_PARAMS`、`MAX_FILE_SIZES`、`LIMITS`などをエクスポートします。バージョンの出所であり、生成設定のデフォルト値も持ちます。
- `providers.ts`: `PROVIDERS`をエクスポートします。APIプロバイダーの設定(OpenAI、Anthropic、Googleなど)で、URLと認証方法を含みます。
- `model-lists.ts`: プロバイダーごとの静的なモデル一覧と、画像生成プロバイダー向けの`IMAGE_GENERATION_SOURCES`です。
- `agent-prompts.ts`: 基本の要約プロンプトとsecret plotのプロンプトに加えて、インストール済みのエージェントパッケージが提供するプロンプトを実行時に引くための仕組みです。

### スキーマ(Zod)

入力の検証はすべて`packages/shared/src/schemas/`のZodスキーマで行います。代表的なファイルは次のとおりです。

| スキーマファイル             | 対象エンティティー                                                           |
| ----------------------- | ------------------------------------------------------------------ |
| `agent.schema.ts`       | AgentConfigの作成と更新、エージェントのフェーズ、結果の種別          |
| `character.schema.ts`   | キャラクターカード、互換性のメタデータ、character book、グループ   |
| `chat.schema.ts`        | チャットの作成、メッセージの作成、生成リクエスト                   |
| `connection.schema.ts`  | API接続の作成と更新                                   |
| `custom-tool.schema.ts` | カスタムツールの定義                                            |
| `lorebook.schema.ts`    | ロアブックとエントリーの作成/更新、発動条件、スケジュール |
| `prompt.schema.ts`      | プリセット、セクション、グループ、choice block、生成パラメーター         |
| `regex.schema.ts`       | 正規表現スクリプトの作成と更新                                   |
| `personal-extension.schema.ts` | Personal Extensionの下書き、ハッシュ完全一致による承認、ロールバック、専用ストレージ |

このフォルダーには、アプリ設定、チャットの設定プロファイル、Conversationの通話、カスタム絵文字とスタンプ、Noodle、テーマのスキーマもあります。

### 型

エンティティーの型定義は`packages/shared/src/types/`にあります。主なファイルの例は次のとおりです。

| 型のファイル             | 主なインターフェイス                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `agent.ts`            | `AgentConfig`, `AgentResult`, `AgentContext`, `ToolDefinition`, `ToolCall`, `ToolResult`, `BUILT_IN_AGENTS` |
| `character.ts`        | `Character`, `CharacterCardV2`, `CharacterData`, `RPGStatsConfig`                                           |
| `chat.ts`             | `Chat`, `ChatMetadata`, `Message`, `MessageExtra`, `GenerationInfo`, `StreamEvent`                          |
| `connection.ts`       | `APIConnection`, `ModelInfo`, `ModelCapabilities`, `ConnectionTestResult`                                   |
| `combat-encounter.ts` | `CombatPartyMember`, `CombatEnemy`, `CombatActionResult`, `EncounterSettings`                               |
| `game-state.ts`       | `GameState`, `PresentCharacter`, `PlayerStats`, `QuestProgress`, `InventoryItem`                            |
| `lorebook.ts`         | `Lorebook`, `LorebookEntry`, `ActivationCondition`, `LorebookSchedule`, `QuestData`                         |
| `persona.ts`          | `Persona`, `PersonaStatsConfig`                                                                             |
| `personal-extension.ts` | `PersonalExtension`、実行時のメタデータ、リビジョン、ソース、サーバー側の実行状態                         |
| `prompt.ts`           | `PromptPreset`, `PromptSection`, `PromptGroup`, `ChoiceBlock`, `GenerationParameters`                       |
| `scene.ts`            | `SceneMeta`, `SceneFullPlan`                                                                                |
| `haptic.ts`           | `HapticDevice`, `HapticStatus`, `HapticDeviceCommand`                                                       |

### ユーティリティー

| ファイル              | 用途                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `macro-engine.ts` | `resolveMacros(template, context)`: `{{date}}`、`{{char}}`、`{{random}}`、`{{roll:2d6}}`、`{{getvar::name}}`などのマクロを置き換えます     |
| `xml-wrapper.ts`  | `nameToXmlTag()`: 表示名をXMLタグ用のスラッグに変換します(「World Info (Before)」は「world_info_before」になります)                           |

## APIエンドポイント

サーバー(`packages/server`)は`/api`以下にREST APIを公開します。以下は全体像であり、網羅した一覧ではありません。正確な情報は`packages/server/src/routes/index.ts`と個々のルートファイルにあります。

### 主要リソース

| プレフィックス               | メソッド                  | 説明                                                                                |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------- |
| `/api/characters`    | GET, POST, PATCH, DELETE | キャラクターのCRUD、グループ、エクスポート(JSONまたはPNG)                                               |
| `/api/chats`         | GET, POST, PATCH, DELETE | チャットのCRUD、メッセージ、メタデータ、接続と接続解除                                     |
| `/api/prompts`       | GET, POST, PATCH, DELETE | プリセットのCRUD、セクション、グループ、choice block、エクスポート                                      |
| `/api/connections`   | GET, POST, PATCH, DELETE | API接続のCRUD、複製、テスト                                                      |
| `/api/agents`        | GET, POST, PATCH, DELETE | エージェントのCRUD、エコーメッセージ、実行履歴。組み込みエージェントの切り替えは`PUT /api/agents/toggle/:agentType`を使います |
| `/api/lorebooks`     | GET, POST, PATCH, DELETE | ロアブックのCRUD、エントリー、エクスポート                                                            |
| `/api/custom-tools`  | GET, POST, PATCH, DELETE | カスタムツールのCRUD                                                                          |
| `/api/regex-scripts` | GET, POST, PATCH, DELETE | 正規表現スクリプトのCRUD                                                                          |

エージェントの記憶機能のツールは`/api/agents/memory/:agentType/:chatId`を使います。`agentType`はエージェントの種別文字列、`chatId`は対象チャットのidです。

### 生成

| エンドポイント                     | メソッド | 説明                                          |
| ---------------------------- | ------ | ---------------------------------------------------- |
| `/api/generate`              | POST   | エージェントパイプラインを伴うメインのSSE生成          |
| `/api/generate/retry-agents` | POST   | 呼び出し側が指定したエージェント種別をSSEで再実行 |

### チャットの機能

| プレフィックス                    | エンドポイント                        | 説明                  |
| ------------------------- | -------------------------------- | ---------------------------- |
| `/api/chat-folders`       | CRUDと並べ替え                | チャットフォルダーの管理       |
| `/api/conversation`       | schedule, status, message, check | 自律メッセージ送信の仕組み  |
| `/api/scene`              | create, plan, conclude           | シーンの分岐             |
| `/api/encounter`          | init, action, summary            | 戦闘エンカウント            |
| `/api/translate`          | POST                             | テキストの翻訳             |
| `/api/game`               | CRUDと各種アクション                 | Game Modeのセッションと状態 |
| `/api/game-assets`        | CRUDとアップロード                 | ゲームのアセット                  |
| `/api/turn-games`         | Chess、UNO、Pokerのルート         | Conversationのテーブルゲーム     |
| `/api/conversation-calls` | 通話とセッションのルート          | Conversationの音声通話     |

### メディアとアセット

| プレフィックス                        | 説明                  |
| ----------------------------- | ---------------------------- |
| `/api/avatars/file/:filename` | アバター画像の配信         |
| `/api/backgrounds`            | 背景のCRUDとアップロード  |
| `/api/sprites/:characterId`   | スプライトの表情の管理 |
| `/api/fonts`                  | カスタムフォントの管理       |
| `/api/gallery/:chatId`        | チャットごとのギャラリー画像      |
| `/api/global-gallery`         | 全体のギャラリー画像        |
| `/api/tts`                    | 音声合成のルート        |
| `/api/youtube`                | YouTube DJのルート         |
| `/api/custom-emojis`          | カスタム絵文字のアセット          |
| `/api/custom-stickers`        | カスタムスタンプのアセット        |
| `/api/gifs/search`            | GIF検索(Giphyのプロキシ)     |

### 外部サービスとの連携

| プレフィックス                          | 説明                  |
| ------------------------------- | ---------------------------- |
| `/api/bot-browser/chub/*`       | Chubのキャラクター検索        |
| `/api/bot-browser/chartavern/*` | CharacterTavernの検索           |
| `/api/bot-browser/janny/*`      | JannyAIの検索                  |
| `/api/bot-browser/pygmalion/*`  | Pygmalionの検索               |
| `/api/bot-browser/wyvern/*`     | Wyvernの検索                  |
| `/api/bot-browser/datacat/*`    | DataCatの検索                 |
| `/api/haptic/*`                 | ハプティックデバイスの制御        |
| `/api/spotify/*`                | Spotifyの認証                 |
| `/api/knowledge-sources`        | 検索用のナレッジベース |

### システム

| エンドポイント                        | 説明                             |
| ------------------------------- | --------------------------------------- |
| `/api/updates/check`            | GitHubのリリースとのバージョン比較   |
| `/api/updates/latest`           | 最新リリースのメタデータ                 |
| `/api/updates/commits-behind`   | Gitでインストールした場合のアップデートの遅れ             |
| `/api/backup`                   | フルバックアップ、エクスポート、インポート             |
| `/api/import/*`                 | SillyTavernとMarinaraのプロファイルのインポート |
| `/api/admin/clear-all`          | 全データの削除                    |
| `/api/themes`                   | 同期されるカスタムテーマ                |
| `/api/personal-extensions`      | サンドボックス化した拡張機能のポリシー、下書き、承認、実行、専用ストレージ |
| `/api/app-settings`             | サーバー側のアプリ設定                |
| `/api/sidecar`                  | ローカルモデルのランタイム                     |
| `/api/chat-presets`             | チャットの設定プロファイル(名称は旧来のまま) |
| `/api/connection-folders`       | 接続のフォルダー                      |
| `/api/prompt-overrides`         | 組み込みプロンプトの上書き               |
| `/api/achievements`             | 実績の解除                    |
| `/api/noodle`                   | Noodleのソーシャルタイムライン                  |
| `/api/professor-mari/workspace` | Professor Mariのワークスペース操作     |

## PWAへの対応

このアプリはVitePWAで構成したProgressive Web Appです。

- マニフェスト: `public/manifest.json`。アプリ名は「Marinara Engine」、表示モードはstandalone、テーマはダークです。
- アイコン: 64pxのファビコン、192pxと512pxのマスカブルアイコン、スプラッシュ用のロゴ。
- Service Worker: Workboxを使い、自動アップデート方式です。
- キャッシュ: 静的アセットはキャッシュし、`/api/*`のルートはNetworkOnlyです。
- キープアライブ: `lib/keep-alive.ts`がWeb Locks APIとBroadcastChannelのpingを使い、タブがスリープしないようにします。

### バージョン不一致の検出

`App.tsx`は5分ごとに`/api/health`をポーリングします。サーバーのバージョンがクライアントのキャッシュしたバージョンと異なる場合、クライアントはService Workerの登録を解除します。あわせてキャッシュも消去し、強制的にアップデートします。

## エージェントシステム

エージェントシステムは、設定可能なパイプラインでAIの応答を処理します。エージェントは3つのフェーズで動きます。

1. 生成前: メインのLLM呼び出しの前(例: コンテキストの挿入、知識の取得)。
2. 並行: メインの生成と同時(例: 世界の状態の追跡、戦闘)。
3. 後処理: メインの応答の後(例: 文章の書き直し、ロアブックの更新)。

再試行のリクエストは、明示的な`agentTypes`の一覧を付けて`/api/generate/retry-agents`へ送ります。**Re-run Trackers**(トラッカーの再実行)のような広い範囲のUI操作は、有効なトラッカーの種別をすべて渡します。個々のウィジェットの操作は、対象のトラッカーだけを渡します。

エージェントの記憶機能のツール(Narrative DirectorのSecret Plotパネルなど)は`/api/agents/memory/:agentType/:chatId`を使います。このルートは、チャットごとの記憶を保存するよう設定されたエージェントに適用されます。Secret Plotの記憶は、現在の設定では`director`の下に保存しますが、以前のチャット向けに`secret-plot-driver`も引き続き受け付けます。

### 公式のダウンロード可能なエージェント

軽量なEngine本体は、実行時のエージェントレジストリーが空の状態で出荷されます。公開カタログの[Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents)からインストールしたパッケージが、検証済みのエージェントマニフェスト、クライアントとサーバーの機能エントリーポイント、UIのスロットを実行時に追加します。有効な定義は互換性のために`BUILT_IN_AGENTS`から参照できますが、実体は同梱の実装ではなくインストール済みパッケージです。公式カタログには次のパッケージがあります。

| エージェント                    | フェーズ           | 機能                                                      |
| ------------------------ | --------------- | ----------------------------------------------------------------- |
| `prose-guardian`         | post_processing | 文章の質を保つ(繰り返しの抑制、描写重視)       |
| `continuity`             | post_processing | 整合性の問題を検出し、書き直しの指示を出せる        |
| `director`               | pre_generation  | 物語の方向づけと、任意でSecret Plotの状態を挿入する       |
| `echo-chamber`           | parallel        | 観客の反応をシミュレートする                                      |
| `world-state`            | post_processing | 物語から日付、時刻、場所、天候を抽出する     |
| `expression`             | post_processing | キャラクターのスプライトの表情を選ぶ                                |
| `quest`                  | post_processing | クエストの作成、更新、完了を追跡する                    |
| `background`             | post_processing | 場面に合う背景画像を選ぶ                                |
| `character-tracker`      | post_processing | キャラクターの状態の変化を追跡する                                |
| `persona-stats`          | post_processing | プレイヤーのペルソナの能力値の変化を追跡する                                |
| `custom-tracker`         | post_processing | 自分で定義した構造化データの状態を追跡する                              |
| `inventory-tracker`      | post_processing | 通貨、装備中の品、持ち物を追跡する                                      |
| `illustrator`            | post_processing | シーンの画像プロンプトとメディアのリクエストを生成する                  |
| `lorebook-keeper`        | post_processing | ロアブックのエントリーを自動で作成、更新する                            |
| `card-evolution-auditor` | post_processing | キャラクターカードを点検し、成長の案を出す                    |
| `combat`                 | parallel        | 戦闘のラウンド、HP、行動順、結果を追跡する            |
| `html`                   | post_processing | 完成したRoleplayの応答を書き直し、作中世界に馴染むHTMLの演出を加える |
| `spotify`                | post_processing | Music DJの再生を制御する(Spotify、YouTube、ローカルの音楽)     |
| `knowledge-retrieval`    | pre_generation  | 知識ソースからコンテキストを取得する                       |
| `knowledge-router`       | pre_generation  | 関連するロアブックと知識のエントリーを振り分ける                    |
| `haptic`                 | post_processing | ハプティックデバイスへコマンドを送る                                |
| `cyoa`                   | post_processing | 選択肢のプロンプトを生成する                                    |
| `conversation-calls`     | feature         | Conversationに音声/動画通話と関連設定を追加する          |
| `hierarchical-maps`      | feature         | RoleplayとGame Modeにマップ、空間的なコンテキスト、移動を追加する             |
| `uno`                    | feature         | ConversationにUNOのテーブルを追加する                               |
| `chess`                  | feature         | ConversationにChessの盤面を追加する                              |
| `poker`                  | feature         | ConversationにTexas Hold'emのテーブルを追加する                         |
| `eightball`              | feature         | Conversationに8-Ball Poolのテーブルを追加する                       |
| `tic-tac-toe`            | feature         | ConversationにTic-Tac-Toeの盤面を追加する                        |
| `rock-paper-scissors`    | feature         | ConversationにRock-Paper-Scissorsの対戦を追加する                     |

### エージェントの結果の種別

エージェントは型付きの結果を返し、フロントエンドがそれを処理します。`packages/shared/src/types/agent.ts`の`AgentResultType`ユニオンには次の値が含まれます。

`game_state_update`、`text_rewrite`、`sprite_change`、`echo_message`、`quest_update`、`image_prompt`、`context_injection`、`continuity_check`、`director_event`、`lorebook_update`、`character_card_update`、`background_change`、`character_tracker_update`、`persona_stats_update`、`custom_tracker_update`、`spotify_control`、`youtube_control`、`local_music_control`、`haptic_command`、`cyoa_choices`、`secret_plot`、`game_master_narration`、`party_action`、`game_map_update`、`game_state_transition`、`prompt_patch`、`frontend_theme_update`、`about_me_update`。

## チャットのモード

### Conversationモード

1人または複数のAIキャラクターとの純粋な会話形式です。キャラクターには状態(オンライン、離席、取り込み中、オフライン)を設定でき、返信のタイミングや文体に影響します。組み込みエージェントは全体で有効にするのではなく、チャットごとに追加します。

### Roleplayモード

ゲームの状態を追跡する、没入型の物語体験です。シーンのコンテキスト(場所、時刻、天候)、キャラクターの登場状況と気分、プレイヤーの能力値、インベントリーとクエスト、戦闘エンカウント、ロアブックからの世界情報、スプライトの表情を扱います。

### Game Mode

AIゲームマスター(GM)によるセッションです。パーティーメンバー、ダイス、ゲームの状態、アセット、絵コンテ、ジャーナル、そして構造化されたセッションの進行を備えます。Game Modeは、ゲームの状態、アセット、テーブルゲーム、シーンの動画、絵コンテのために専用のストアとルートを使います。利用者向けの操作の流れは[Game Mode: はじめに](../game/getting-started.md)を参照してください。

## 開発

### コマンド

依存関係をインストールします。

```bash
pnpm install
```

サーバーとクライアントをホットリロード付きで起動します。

```bash
pnpm dev
```

クライアントの開発サーバーだけを起動します。

```bash
pnpm dev:client
```

APIサーバーだけを起動します。

```bash
pnpm dev:server
```

基本の検証(TypeScriptとESLint)を実行します。

```bash
pnpm check
```

本番用にビルドします。

```bash
pnpm build
```

### バンドルサイズの上限

- メインのエントリー: 最大1 MB。
- チャンクごと: 最大500 KB。
- ベンダーの分割: react、tanstack、motion、zustand、icons、misc。

### パスエイリアス

TypeScriptとViteのどちらの設定でも、`@/*`は`./src/*`に解決されます。

## 関連ガイド

- [アーキテクチャマップ(開発者向け)](architecture-map.md)
- [ファイルネイティブストレージ](file-storage.md)
