# 世界书的语义搜索

本指南介绍 Marinara Engine 里世界书的语义搜索。语义搜索让世界书条目按含义触发，而不只是靠精确关键词。下面会讲怎么定好嵌入来源、怎么给条目做向量化，以及怎么调整匹配效果。

## 语义搜索能带来什么

世界书是一组条目。每个条目有触发关键词和一段文字。通常只有最近的聊天里出现了条目的某个精确关键词，条目才会触发。换一个词来写，条目就沉默了。

语义搜索解决的正是这个问题。它拿最近聊天的含义和条目的含义做比较，这样即使没有关键词精确命中，条目也能触发。举个例子，关键词是“sword”的条目，也能匹配上只写了“blade”的消息。

这背后靠的是嵌入。嵌入是一串数字，用来表示一段文本的含义。Marinara 会给每个条目保存一个嵌入，它也叫向量，生成并保存的这一步叫向量化。聊天时，Marinara 把最近的消息转成嵌入，再找出含义最接近的条目。

开启语义搜索之后，关键词匹配照常工作。语义搜索只是额外多找出一些匹配，不会取代关键词。

套用世界书的条目数上限和 Token(模型切分文本的最小单位) 预算时，关键词匹配和语义匹配的优先级完全相同。如果命中的条目太多装不下，由你配置的条目顺序决定谁进谁出，触发方式本身不占优势。

## 开始之前：先定好嵌入来源

语义搜索需要一个能生成嵌入的模型，有两种选择。

无论选哪一种，你都可以把它设为整个应用的默认值：打开 **Connections**(连接)，再打开 **Connection defaults**(默认连接)，在 **Embeddings** 下选择它。没有自己设置嵌入模型或 **Embedding Connection** 的连接就会使用它。连接自己的设置仍然优先，那一行还会告诉你有多少个连接在用自己的设置。选 **None** 则保留内置的本地模型作为后备。

方案一：使用带嵌入模型的连接。

1. 打开 **Connections**(连接) 面板。
2. 打开某个连接进入编辑。
3. 找到 **Semantic Search (Embeddings)**(语义搜索与嵌入) 一节。
4. 在模型输入框里填入嵌入模型的名称，常用的一个是 `text-embedding-3-small`。
5. 保存这个连接。

并不是所有 AI 服务商都提供嵌入。如果某个服务商做不了嵌入，编辑器会提示改用专门的嵌入连接。

方案二：使用内置的本地模型。

Marinara 可以在本机跑一个小型嵌入模型，不需要 API 密钥。在世界书的嵌入来源下拉菜单里，这个选项叫 **Local Model (sidecar)**，只有下载了本地模型之后它才会出现。安装方法见[本地模型设置](../connections/local-model.md)。

如果用的是 Marinara Lite 版本，**Local Model (sidecar)** 选项不会显示。在 Lite 上，语义搜索必须依靠带嵌入模型的连接。

## 为世界书打开 Vectors 开关

新建的世界书默认关闭语义搜索，需要逐个世界书手动打开。

1. 打开想按含义检索的那个世界书。
2. 停在 **Overview**(总览) 选项卡。
3. 找到 **Vectors**(向量) 开关并打开。

**Vectors** 的说明文字是：“When on, entries in this lorebook may use semantic embeddings. When off, keyword matching still works and vectorization skips this lorebook.”

**Vectors** 关闭时，语义面板会显示这条提示：“Semantic search is disabled by the lorebook-level Vectors toggle.”

## Semantic Search (Embeddings) 面板

打开 **Vectors** 之后，**Overview** 选项卡上会出现 **Semantic Search (Embeddings)** 面板。面板上的状态标记会显示有多少条目已向量化，比如“8/12 entries vectorized”。全部完成后它会变绿并打上勾。

面板里有三个数值设置。

| 设置 | 作用 | 默认 | 取值范围 |
|---|---|---|---|
| **Query Messages** | 检索这个世界书时，把最近多少条聊天消息转成嵌入。 | 10 | 0 到 100 |
| **Score Threshold** | 条目触发所需的最低校准相似度，数值越高越严格。 | 0.3 | 0 到 1 |
| **Vector Limit** | 这个世界书单次生成最多能加入多少条语义匹配。 | 10 | 1 到 100 |

把 **Query Messages** 设为 0，就会拿完整的聊天历史来检索，而不是只看最近的一个窗口。

**Score Threshold** 决定含义要多接近才算数。设成 0.2 这类低值，进来的条目更多，但也更容易匹配到跑题的内容。设成 0.5 这类高值更严格，只有含义很接近才会命中。先用默认值，命中太多或太少时再调。

Marinara 会拿同一个嵌入模型生成的若干段互不相关的中性文本来校准这个分数。有些本地和 OpenAI 兼容的嵌入后端存在异常偏高的余弦相似度基线，不相关的文本也可能全都打到 0.95 甚至更高，校准就是为了消掉这个基线。这样一来，同一套阈值在不同嵌入模型上都好用，不必为某个模型专门设一个接近 1.0 的截断值。

**Vector Limit** 只限制语义匹配的数量，常规的 Token 预算依然在它之上生效。

## 给条目做向量化

向量化就是为每个条目生成并保存嵌入。语义匹配能工作的前提，就是先做完这一步。

1. 为这个世界书打开 **Vectors**。
2. 在 **Semantic Search (Embeddings)** 面板的下拉菜单里选择嵌入来源。第一个选项是 **No semantic search**，接下来是 **Local Model (sidecar)**(可用时才出现)，再往后是符合条件的连接。
3. 点击向量化按钮。还有条目缺向量时，按钮上写的是 **Vectorize N missing**，比如“Vectorize 5 missing”。
4. 等这一轮跑完。状态标记会更新成全部条目已向量化。

如果没有任何连接配置了嵌入模型，面板上不会出现下拉菜单，而是显示这条提示：“No connections with an embedding model configured. Set an Embedding Model on a connection first.”按上面的步骤先定好嵌入来源。

所有条目都已经有向量时，主按钮会变成 **Re-vectorize N entries**。它会重建全部已存向量，改写旧向量之前会先让你确认。

当一部分条目有向量、另一部分还缺时，会另外出现一个 **Re-vectorize all** 按钮，用它可以一次把全部重建一遍。

要清掉已存的向量，点击 **Delete vectors**。这只删除嵌入，条目正文和关键词都不动。删掉向量之后，关键词匹配照常工作。

### 跳过单个条目

可以让某个条目不参与向量化，其余照常。打开这个条目，再打开它的 **No Vector** 开关。它的说明文字是：“When enabled, bulk vectorization skips this entry and removes any stored embedding.”这个条目仍然能靠关键词触发，只是不再按含义匹配。

## 换模型之后要重新向量化

已存的向量和生成它们的嵌入模型是绑定的。换成另一个嵌入模型之后，旧向量可能就对不上了。

换过嵌入模型，就把每个向量都重建一遍。用 **Re-vectorize N entries** 或 **Re-vectorize all**，让所有条目都用同一个模型。

换模型之后不要只跑一次补缺的向量化。如果“只补缺失”的这一轮算出的向量维度和已存向量不同，服务器会拒绝，并给出这条提示：“Embedding dimensions changed. Use Re-vectorize all entries instead of only missing entries before switching embedding models.”

还有一种悄无声息的失败要留意。聊天时，Marinara 用查询模型把最近的消息转成嵌入。查询模型就是当前连接自己的嵌入模型，或者连接设了 **Embedding Connection** 时那边的模型；两者都没设的话，Marinara 会改用 **Connection defaults** 里的 **Embeddings** 默认值，默认值是 **None** 时则用内置的本地模型。查询模型产生的向量维度，可能和当初给条目做向量化的模型不一样，这时 Marinara 会在语义匹配里直接跳过这些条目，而且不会报错。想避开这个坑，就用聊天时实际使用的那个嵌入来源给条目做向量化，设一个 **Embeddings** 默认值会有帮助：向量化的选择框默认就停在它上面（除非你之前选过别的），没有自己嵌入设置的连接也用它来查询。换过模型就重新向量化一遍。

## 语义搜索如何服务 Knowledge Router 智能体

语义搜索也能帮到 **Knowledge Router** 智能体。世界书很大时，这个智能体负责挑出相关条目，把它们注入提示词（Marinara Engine 发给 AI 的那段文字）。世界书完成向量化之后，Knowledge Router 会把语义匹配和关键词匹配一起拿来生成候选条目的初选名单。

这一步对它来说是可选的。世界书没有向量化，或者没有可用的嵌入来源时，Knowledge Router 就只靠关键词匹配。向量化只是让初选名单更准。它的工作方式见[知识源：Knowledge Retrieval 与 Knowledge Router 智能体](../agents/knowledge-sources.md)。

## 相关指南

- [世界书总览](overview.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [本地模型设置](../connections/local-model.md)
- [知识源：Knowledge Retrieval 与 Knowledge Router 智能体](../agents/knowledge-sources.md)
