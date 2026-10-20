# Noodleプロンプトの内部構造(開発者向け)

Noodleの生成プロンプトがコードのどこにあるか、どうカスタマイズするか、最終的なプロンプトをどう調べるかをまとめた開発者向けの資料です。エンドユーザーはNoodleの**Settings**(設定)パネルから設定します。使い方は`docs/noodle/`のNoodleガイドを参照してください。

Noodleはダウンロードして追加するパッケージです。そのルート(パッケージの有効化時に登録される`/api/noodle`)と生成のコードは、[Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents)のNoodleパッケージ内の`packages/noodle/src/engine/packages/server/src/`にあります。下の表で**package**と記した所在は、そのフォルダーからの相対パスです。Engine側には、共有のNoodleのスキーマと型、Noodleのストレージ、Settingsに表示される登録済みのプロンプトの上書き、`packages/server/src/services/noodle/noodle-prompt.ts`にあるタイムラインのデフォルトのプロンプト文が残っています。パッケージは、`services/prompt-overrides/registry/noodle.ts`と`services/noodle/noodle-prompt.ts`の独自のコピーを持っています。

## プロンプトの所在マップ

Noodleには、組み立てられるタイムラインのプロンプトが1つ、コードに直接書かれたプロフィールのプロンプトが1つ、登録済みのプロンプトの上書きが3つあります。上書きのうち2つはタイムラインのシステムプロンプト用、1つは投稿の画像用です。

| 用途 | 所在 | 主なシンボル | カスタマイズの方法 |
| ----------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| タイムラインの投稿、返信、フォロー、アンケート、投票、ダイジェスト | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()` | システムメッセージは、**Noodle Timeline Prompt**の上書きの後に**Noodle Timeline Voice & Tone**の上書きを続けたものです(どちらも下の表を参照)。2つのユーザーメッセージ、コンテキスト(アカウント、ペルソナ、プロフィール、スケジュール、ロア、同意済みチャットのコンテキスト、タイムライン、有効な機能と割り当て)、`# JSON Output Format`のメッセージは、コード内で組み立てます。 |
| タイムラインの基本のシステムプロンプト | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_BASE` (`noodle.timelineBase`) | **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Prompt**で編集するか、コード側で`noodle-prompt.ts`の`NOODLE_TIMELINE_BASE_DEFAULT_PROMPT`を変更します。デフォルトには成人向けプラットフォーム、ペルソナの執筆、やり取り、JSONの規則が入っているため、書き換えると`noodleGeneratedRefreshSchema`の解析が壊れることがあります。 |
| タイムラインの文体に関する指示(基本のプロンプトの後に追加) | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_VOICE` (`noodle.timelineVoice`) | **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Voice & Tone**で編集するか、登録されているデフォルト(`noodle-prompt.ts`の`noodleTimelineVoiceDefaultText(enhanced, allowRandomUsers)`)をコード側で変更します。編集していないデフォルトは、Noodleの設定`enableEnhancedTimelineWriting`(`ctx.enhanced`。オフのときは元の1行の文体指示になります)と、ランダムユーザーを許可しているかどうかに従います。独自の上書きテキストを保存すると、これらの設定に関係なくそちらが優先されます。 |
| 初回に作られるキャラクターアカウントのプロフィール | **package** `services/noodle/noodle-public-profiles.service.ts` | `generateMissingNoodleProfiles()` | コード内のシステムメッセージとユーザーメッセージを直接編集します。先に参加者の選定が走り、選ばれたキャラクターアカウントのうち`profileGenerated`がないものだけがこのプロンプトに渡ります。 |
| 生成した投稿の画像プロンプト | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_IMAGE_POST` (`noodle.imagePost`) | **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Post Image**で編集するか、登録されているデフォルトをコード側で変更します。 |
| Noodle専用の画像指示のデフォルト | `packages/shared/src/schemas/noodle.schema.ts` | `DEFAULT_NOODLE_SETTINGS.imageGenerationPrompt` | UIでNoodleの設定を変更するか、コード側でスキーマのデフォルトを変更します。 |
| タイムライン生成に挿入する、同意済みチャットのコンテキスト | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildOptedInChatContext()` | コンテキストの組み立てをコード側で変更します。参加の同意は各チャットの設定のままです。 |
| タイムラインの投稿と返信に渡す画像入力 | **package** `services/noodle/noodle-vision.ts` | `prepareNoodleVisionAttachments()` | 画像の選択、正規化、上限、テキストのみへのフォールバックをコード側で変更します。 |
| チャットのプロンプトに挿入するNoodleの活動 | **package** `services/noodle/noodle-context.ts` | `buildRecentSocialMediaActivityBlock()` | パッケージはこれを`noodle:prompt-context`サービスとして登録します。絞り込みやブロックの組み立てをコード側で変更します。対象モードと件数の上限はNoodle Settingsから操作でき、生成されるブロック全体には8,192トークンの上限があります。 |
| 生成JSONの取り決め | `packages/shared/src/schemas/noodle.schema.ts` | `noodleGeneratedRefreshSchema` | プロンプト、ルートの処理、共有の型、回帰テストと必ずまとめて変更します。 |
| タイムライン生成に挿入するロアブックの世界設定 | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()`(`processLorebooks()`を呼び出す) | Noodleの設定**Lorebook context**(`enableLorebookContext`、デフォルトはオフ)で制御します。グループチャットと同じ複数キャラクター対応の`processLorebooks()`を再利用し、`noodle-prompt.ts`の`noodleLorebookTokenBudget()`が返すNoodle専用のトークン枠を使います。この枠は有効なキャラクター数に応じて増減し、8,192トークンで頭打ちになります。Noodleにはsticky/cooldownのタイミングを保持するチャットごとの領域がないため、`previewOnly: true`で動きます。 |

プロフィールのプロンプトは、Prompt OverridesのUIに並んでいません。**Noodle Timeline Prompt**、**Noodle Timeline Voice & Tone**、**Noodle Post Image**のテンプレートは並んでいます。**Noodle image generation**(`enableImagePrompts`)がオンのとき、Noodleの設定**Image instructions (sent to your LLM)**はタイムラインのモデルに渡り、モデルは各投稿の画像の案を書くときにそれに従います。デフォルトの**Noodle Post Image**テンプレートはこれを追加しなくなりましたが、カスタムテンプレートでは引き続き`${userInstructions}`として使えます。

画像サービス(**package** `services/noodle/noodle-public-images.service.ts`)は`NOODLE_IMAGE_POST`を読み込み、その結果を`compileImagePrompt()`に通してから画像のプロバイダーへ送ります。そのため、最終的なリクエストは選択中の画像スタイルプロファイルや接続のデフォルトからも影響を受けます。

## 最終的なプロンプトを調べる

**Debug Mode**(デバッグモード)をオンにして手動で更新すると、モデルへ送られた最終的なプロフィールとタイムラインのメッセージが共有のサーバーロガーに記録されます。次の行を探してください。

```text
[debug/noodle] Profile prompt sent to model
[debug/noodle] Prompt sent to model
[debug/noodle] Attached N timeline image input(s) to the refresh prompt
```

タイムラインの画像データがbase64のままデバッグログに書き出されることはありません。記録されるテキストには、モデルへ送ったものと同じ投稿と返信の添付キー、そしてネイティブの画像入力の数だけが含まれます。Noodleはこれらの入力を`noodle-vision.ts`で正規化し、件数を制限します。プロバイダーが画像入力を明確に拒否した場合、パッケージはその旨を記録し、代わりに組み立て済みのテキストのみのプロンプトを送ります。

画像については、**Settings -> Generations -> Overall Generations**の**Expose media prompts before sending**をオンにすると、リクエストを送る前に、最終的に組み立てられた肯定プロンプトと否定プロンプトを確認して編集できます。

## 安全に編集するために

プロンプトの組み立ては互換性を壊しやすい境界です。編集するときは、プロンプト、`noodleGeneratedRefreshSchema`、ルートの処理、そしてNoodleのメンションとアンケートの回帰テストを揃えて保ってください。Engineでは、最低限、次を実行します。

```bash
pnpm check
pnpm regression:prompt
pnpm regression:noodle
```

パッケージが所有するコードの変更は、Marinara-Agentsで、その`staging`ブランチを対象に行い、検証します。

## 関連ガイド

- [Noodle: アプリ内のソーシャルタイムライン](../noodle/overview.md)
- [Noodleの設定とチャットへの引き継ぎ](../noodle/settings.md)
- [任意のエージェントパッケージと機能パッケージ](optional-agent-packages.md)
- [アーキテクチャマップ(開発者向け)](architecture-map.md)
