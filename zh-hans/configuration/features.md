# 功能开关

部分服务器行为是可选的，可在 **Settings > Advanced > Features**(设置 > 高级 > 功能) 中开启。所有开关初始都关闭，因此从未打开此页面的服务器会保持原有行为。

更改立即生效，无需重启服务器或刷新页面。

<a id="overview"></a>

## 概览

| 开关 | 设置键 | 默认值 | 环境变量 |
| --- | --- | --- | --- |
| **Stable lorebook picks**(固定世界书选择) | `stableLorebookGroupPicks` | 关闭 | `LOREBOOK_STABLE_GROUP_WINNERS` |
| **Retry failed provider calls**(重试失败的服务商调用) | `providerRetry` | 关闭 | `PROVIDER_RETRY_TRANSIENT_ERRORS` |
| **Lorebook activation stats**(世界书激活统计) | `usageAndActivationStats` | 关闭 | 无 |
| **Recover deleted chat messages**(恢复已删除的聊天消息) | `messageTrash` | 关闭 | 无 |

在设置中搜索 `features` 可找到此部分。

<a id="where-the-settings-are-stored"></a>

## 设置存储位置

所有开关一起保存在应用设置 `features` 中，内容是布尔值组成的 JSON 对象。只保存不同于默认值的项。缺失键、空对象或无法读取的值都表示默认状态：全部关闭。

服务器在内存中保留副本，因此服务商调用、世界书扫描等高频路径无需额外读取。通过 Settings 保存或以其他方式写入 `features` 行，都会立即刷新副本。

API 是 `GET` 和 `PUT /api/app-settings/features`。`PUT` 替换整个对象，拒绝未知键和非布尔值。

<a id="switches"></a>

## 开关

<a id="stable-lorebook-picks"></a>

### 固定世界书选择

设置键：`stableLorebookGroupPicks`。环境变量：`LOREBOOK_STABLE_GROUP_WINNERS`。

开启：只要匹配候选不变，世界书包含组在该聊天中就保留同一个胜出条目。其他聊天和候选集合仍可选择不同条目。

关闭：每次生成都重新抽选胜出条目。

<a id="retry-failed-provider-calls"></a>

### 重试失败的服务商调用

设置键：`providerRetry`。环境变量：`PROVIDER_RETRY_TRANSIENT_ERRORS`。

开启：连接被拒绝或不可达、网关 502/503 时，经过带随机抖动的短暂等待后最多重试两次，且只在任何文本到达前进行。504 或已中断连接绝不重试。连接有 fallback 时不使用此机制，而是立即尝试 fallback。

关闭：与之前一样，只重试限流错误。

### 世界书激活统计

设置键：`usageAndActivationStats`。没有环境变量。

开启：每条回复成功保存后，Marinara 会记录哪些世界书条目被激活了，这样你就能在世界书编辑器里按使用情况排序和筛选条目。Continue 生成的续写片段不会增加激活记录。

关闭：不记录任何内容，世界书编辑器也会隐藏激活统计。

### 恢复已删除的聊天消息

设置键：`messageTrash`。没有环境变量。

开启：删除的聊天消息会进入聊天搜索里的 **Trash**(回收站) 选项卡。30 天内可以在那里用 **Restore**(恢复) 找回；超过 30 天就会被永久删除。Game 消息和回滚造成的删除仍然是永久的。

关闭：删除的消息会立即移除。

<a id="precedence"></a>

## 优先级

1. **环境变量。**只要设置了开关对应变量，无论开启还是关闭都优先于已保存开关。Settings 显示锁定状态及变量名。空值视为未设置。
2. **已保存开关。**Settings > Advanced > Features 中保存的值。
3. **默认值。**关闭。

| 变量 | 控制项 | 值 |
| --- | --- | --- |
| `LOREBOOK_STABLE_GROUP_WINNERS` | 固定世界书选择 | `true`、`1`、`yes` 或 `on` 开启，其他值关闭。 |
| `PROVIDER_RETRY_TRANSIENT_ERRORS` | 重试失败的服务商调用 | `true`、`1`、`yes` 或 `on` 开启，其他值关闭。 |

每次检查都会读取环境变量，因此 `.env` 更改无需重启即可生效。

<a id="for-developers"></a>

## 开发者说明

注册表是 `packages/shared/src/schemas/feature-settings.schema.ts`，包含开关名称及默认值。将新开关加入 `FEATURE_SWITCH_NAMES`、`FEATURE_SWITCH_DEFAULTS` 和 `featureSettingsSchema`，在英文语言目录的 `settings.features.<key>` 下提供标签和帮助文本，并加入 `packages/client/src/components/panels/settings/FeatureSwitchesSettings.tsx` 的 `SERVER_SWITCHES`，使其显示在 Settings。服务器使用 `packages/server/src/services/features/feature-settings.ts` 中的 `isFeatureEnabled("<key>")` 检查；客户端使用 `packages/client/src/hooks/use-feature-settings.ts` 中的 `useFeatureEnabled("<key>")`。
