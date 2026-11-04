# Home Assistantとの連携

この連携を使うと、AIキャラクターがチャットの中から、照明、空調、カバー、メディアプレイヤーなどの実際のスマートホームデバイスを操作できます。Home AssistantのオートメーションからMarinara Engineへメッセージを送ることもできます。Home Assistantは、スマートホームデバイス向けの無料のオープンソースプラットフォームです。Home Assistantを使っていない場合、このガイドは必要ありません。

## この連携で追加されるもの

この連携は、Home Assistantの中にインストールして、Marinaraサーバーと結び付ける小さなソフトウェアです。初回セットアップで、次のものを自動で作ります。ツールのアドレスをコピーしたり、ツールを手作業で設定したりする必要はありません。

- Presetsパネルの**Functions**(関数)セクションに、スマートホーム用のツール。[カスタムツールと関数呼び出し](../extending/custom-tools.md)を参照してください。
- **Home Assistant**という名前のエージェント1つ。チャットと並行して動くAIのヘルパーです。[エージェント: チャットを支えるAIヘルパー](../agents/agents-overview.md)を参照してください。
- Home Assistant側からMarinaraを監視、操作するための、Home Assistantのエンティティー(デバイス、センサー、コントロール)。

## 始める前に

- Home Assistantのバージョン2024.1.0以降。
- Home AssistantにインストールされたHACS。HACSはHome Assistant Community Storeの略で、カスタム統合をインストールするためのツールです。
- 動作中で、Home Assistantのコンピューターから到達できるMarinara。デフォルトのアドレスは`localhost:7860`です。
- Marinaraの`.env`ファイルにある`WEBHOOK_LOCAL_URLS_ENABLED=true`。

`.env`ファイルは、Marinaraサーバーの設定を書いたプレーンテキストのファイルです。場所は[サーバー設定リファレンス](../CONFIGURATION.md)を参照してください。この連携はWebhookを使います。Webhookとは、あるアプリから別のアプリへデータを送るためのWebアドレスです。Home AssistantのWebhookはローカルの平文`http`アドレスで、Marinaraは安全のため、こうしたアドレスをデフォルトでブロックします。この設定で、それを許可します。次の行を追加して保存してください。再起動しなくても反映されます。ふつうは数秒以内(長くても約30秒)です。

```text
WEBHOOK_LOCAL_URLS_ENABLED=true
```

### Home Assistantが別のデバイスで動いている場合

この連携はユーザー名もパスワードも使わずに接続し、セットアップの画面にも入力欄はありません。

- 同じコンピューター: そのままで接続できます。
- 別のデバイス: Marinaraはデフォルトで接続をブロックします。`.env`の`IP_ALLOWLIST`に、そのデバイスのIPアドレス(ネットワーク上のデバイスを示す番号のアドレス)を追加してください。完全に信頼できる家庭内ネットワークであれば、代わりに`ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true`を設定してもかまいません。
- Marinaraが`BASIC_AUTH_USER`と`BASIC_AUTH_PASS`(ログイン)を使っている場合、連携はサインインできません。その場合は、同じコンピューターか、`IP_ALLOWLIST`に載っているデバイスからしか動きません。

どの方法を選ぶかは、[リモートアクセス](../REMOTE_ACCESS.md)を参照してください。

## 連携をインストールする

### HACSに追加する

1. Home Assistantで**HACS**を開きます。
2. 三点メニューを開き、**Custom repositories**(カスタムリポジトリー)をクリックします。
3. リポジトリーの入力欄に`https://github.com/Pasta-Devs/Marinara-Engine`を入力します。
4. カテゴリーを**Integration**にして、**Add**をクリックします。
5. **Marinara Engine**を検索してインストールします。
6. Home Assistantを再起動します。

### セットアップする

1. **Settings → Devices & Services**(設定 → デバイスとサービス)を開き、**Add Integration**(統合を追加)をクリックします。
2. **Marinara Engine**を検索します。
3. Marinaraが動いている**Host**と**Port**を入力します。デフォルトは`localhost`と`7860`です。
4. **Submit**をクリックします。

うまくいかなかった場合: Marinaraに到達できないと、Home Assistantはエラーを表示します。[トラブルシューティング](#troubleshooting)を参照してください。

成功すると、連携はHome Assistantに専用のWebhookを登録します。さらに、そのWebhookを指すツールをMarinaraの**Functions**セクションに作り、有効なツールをすべて列挙した**Home Assistant**エージェントを作り、後述のエンティティーを作ります。

## エージェントをチャットに追加する

エージェントを作っても、すべてのチャットに付くわけではありません。スマートホームを操作したいチャットごとに追加してください。

1. チャットを開き、**Chat Settings**(チャット設定)をクリックします。
2. **Agents**セクションを開きます。
3. **Home Assistant**エージェントを追加します。

Roleplay、Conversation、Gameのどのチャットでも動きます。追加すると、そのチャットのAIがツールを使えるようになります。ほかにオンにするものはありません。

### 動作を確認する

1. そのチャットで、`Turn on the office lights`のようなふつうの文章で依頼を入力して送信します。
2. AIが`ha_turn_on`などのツールを呼び出し、照明が点灯するはずです。そのあとAIが実行したことを伝えます。

何も起きない場合は、`WEBHOOK_LOCAL_URLS_ENABLED=true`が設定されているか確かめ、[トラブルシューティング](#troubleshooting)を参照してください。

## AIに使わせるツールを選ぶ

ツールは8つのカテゴリーに分かれています。Marinaraにどれを使わせるかを選ぶには、**Settings → Devices & Services**(設定 → デバイスとサービス)を開き、**Marinara Engine**をクリックしてから**Configure**(設定)をクリックします。項目は2つあります。

- **Primary Chat**: Home Assistantのサービスが対象にするデフォルトのチャットです。
- **Exposed Tool Categories**: Marinaraが使えるカテゴリーです。

| カテゴリー | デフォルト | ツール |
| --- | --- | --- |
| Lights & Switches | On | ha_turn_on, ha_turn_off, ha_toggle, ha_set_brightness, ha_set_color, ha_set_color_temp |
| Climate | On | ha_set_temperature, ha_set_hvac_mode |
| Covers (Blinds & Garage) | On | ha_open_cover, ha_close_cover, ha_set_cover_position |
| Locks | Off | ha_lock, ha_unlock |
| Media Players | On | ha_media_play, ha_media_pause, ha_set_volume |
| Scenes & Scripts | On | ha_activate_scene, ha_run_script |
| Query | On | ha_get_state, ha_list_areas, ha_list_entities, ha_notify |
| Generic Service Calls (Advanced) | Off | ha_call_service |

> **Warning:** **Generic Service Calls (Advanced)**を使うと、AIはHome Assistantの任意のサービスを呼び出せます。**Locks**を使うと、ドアの施錠と解錠ができます。どちらもデフォルトでオフです。必要な場合だけオンにしてください。

ほとんどのツールは、デバイス1つか部屋の名前を受け付けます。部屋の名前を指定すると、その部屋にある該当デバイスすべてに作用します。カテゴリーの変更は、**Marinara Sync HA Tools**を押すか、Home Assistantを再起動すると反映されます。

## Home Assistantのエンティティー

この連携は、**Marinara Engine**という名前のデバイスの下に、次のエンティティーを作ります。

| エンティティー | 種類 | 動作 |
| --- | --- | --- |
| Marinara Chat Count | センサー | Marinaraのチャットの総数 |
| Marinara Active Agent Count | センサー | 有効になっているMarinaraのエージェントの数 |
| Marinara Active Chat | セレクト | サービスが対象にするチャットを選びます |
| Marinara Agent: (name) | スイッチ | エージェントを1つオンまたはオフにします。エージェントごとに1つずつあります |
| Marinara Abort Generation | ボタン | 生成中のAIの返信を中止します |
| Marinara Sync HA Tools | ボタン | すべてのツールを送り直し、Home Assistantエージェントを作り直します |

この連携は、新しいチャットやエージェントがないかを30秒ごとにMarinaraへ確認します。そのため、作ったばかりのものが表示されるまで最大30秒かかることがあります。

### 設定を変えたあとの同期

**Marinara Engine**デバイスのページで**Marinara Sync HA Tools**を押します。既存のツールをその場で更新し、**Home Assistant**エージェントを削除していた場合は作り直し、カテゴリーをオフにしたツールを無効にします(削除はしません)。Marinaraの中でHome Assistantのツールを手作業で編集しないでください。次の同期で編集内容が上書きされ、ツールも再びオンに戻ります。

## オートメーションからMarinaraを操作する

この連携は、オートメーション用にHome Assistantのサービスを2つ追加します。これらはMarinaraではなく、Home Assistantの中で動きます。どちらもデフォルトで**Primary Chat**を対象にします。

### Send Message (marinara_engine.send_message)

- `message`: メッセージの本文です。必須です。
- `chat_id`: 送信先のチャットです。空欄にすると、Primary Chatを使います。
- `role`: `user`、`assistant`、`system`、`narrator`のいずれかです。デフォルトは`user`です。
- `trigger_generation`: trueにすると、AIも返信します。デフォルトはfalseです。

玄関のドアが開いたことをAIに伝えるオートメーションです。

```yaml
automation:
  trigger:
    platform: state
    entity_id: binary_sensor.front_door
    to: "on"
  action:
    service: marinara_engine.send_message
    data:
      message: "Someone has arrived at the front door."
      trigger_generation: true
```

### Trigger Generation (marinara_engine.trigger_generation)

目に見えるメッセージを送らずに、AIの返信を始めます。

- `chat_id`: 対象のチャットです。空欄にすると、Primary Chatを使います。
- `user_message`: 返信のターンに含める任意のメッセージです。

<a id="troubleshooting"></a>

## トラブルシューティング

### セットアップ画面に接続できないと表示される

Marinaraが動いていること、**Host**と**Port**が待ち受けているアドレス(デフォルトは`localhost`と`7860`)と一致していることを確かめてください。Home Assistantが別のデバイスにある場合、そのデバイスが`IP_ALLOWLIST`に載っていないかぎり、Marinaraはブロックします。連携はパスワードを送れないので、ログインで保護されたMarinaraも連携を拒否します。[リモートアクセス](../REMOTE_ACCESS.md)を参照してください。これらの条件はセットアップ後も変わりません。あとからMarinaraがそのデバイスをブロックすると、センサーとチャットの一覧は何も表示しないまま更新されなくなります。

### AIがデバイスのツールを使おうとするが何も起きない

Webhookの呼び出しがブロックされている可能性が高いです。`.env`に`WEBHOOK_LOCAL_URLS_ENABLED=true`を追加して保存してください。設定していないと、`http`が許可されていない、またはプライベートアドレスが拒否された、という内容でツールの呼び出しが失敗することがあります。MarinaraとHome Assistantが同じコンピューターにある場合、連携は内部アドレスを自動で使います。Marinaraが別のデバイスにある場合は、Home Assistantのローカルアドレスにそのデバイスから到達できるか確かめてください。

### ツールがFunctionsに出てこない

**Marinara Sync HA Tools**を押すか、Home Assistantを再起動してから、Presetsパネルの**Functions**を確認します。

### Home Assistantエージェントがチャットに出てこない

MarinaraのAgentsにエージェントがあるか確認します。ない場合は、**Marinara Sync HA Tools**を押して作り直します。そのあと**Chat Settings → Agents**(チャット設定 → エージェント)で追加します。

### Webhookのアドレスを手動で調べる

各ツールにはアドレスが設定済みなので、これが必要になることはほとんどありません。Home Assistantで**Settings → Devices & Services → Marinara Engine**(設定 → デバイスとサービス → Marinara Engine)を開きます。Webhookは次の形式です(8123はHome Assistantのデフォルトのポート番号です)。

```text
http://<homeassistant-ip>:8123/api/webhook/<webhook-id>
```

## アンインストール

Home Assistantの**Settings → Devices & Services → Marinara Engine**(設定 → デバイスとサービス → Marinara Engine)で連携を削除します。これでエンティティーは消えます。Marinaraの**Functions**セクションにあるツールと**Home Assistant**エージェントは残ります。不要であれば、Marinaraで手動で削除してください。

## 関連ガイド

- [カスタムツールと関数呼び出し](../extending/custom-tools.md)
- [エージェント: チャットを支えるAIヘルパー](../agents/agents-overview.md)
- [サーバー設定リファレンス](../CONFIGURATION.md)
- [リモートアクセス](../REMOTE_ACCESS.md)
