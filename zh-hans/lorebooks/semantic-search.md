# 世界书的语义搜索

语义搜索让世界书条目可以按含义触发，而不只是靠精确的关键词。这样，关键词是“sword”的条目，也能匹配上只写了“blade”的消息。如果你的文字会用很多不同的词表达同一个意思，就用它。

它靠的是嵌入：一串用来表示一段文本含义的数字。Marinara 为每个条目保存一个嵌入，它也叫向量，生成向量的这一步叫向量化。聊天时，Marinara 把你最近的消息转成嵌入，再找出含义最接近的条目。

语义搜索只是额外增加匹配，关键词照常工作。在预算限制下，关键词匹配和语义匹配的优先级相同，所以装不下全部条目时，由条目的 **Order**(顺序) 决定。

## 设置语义搜索

先要有一个嵌入来源，然后打开 **Vectors**(向量) 开关，再跑一次向量化。

### 第 1 步：选一个嵌入来源

开始之前：你需要一个其服务提供嵌入的账号，或者使用内置模型。并不是所有服务都提供嵌入。如果你的服务不提供，编辑器会提示你改选一个专门的嵌入账号。

方案一：使用带嵌入模型的账号。

1. 打开 **Connections**(连接) 面板，打开一个账号进行编辑。
2. 打开 **Advanced**(高级)，再打开 **More**(更多)，找到 **Semantic search (embeddings)**(语义搜索与嵌入)。
3. 填入嵌入模型的名称，比如 `text-embedding-3-small`。如果不确定名称，查一下服务的文档，或者改用内置模型。
4. 保存这个账号。
5. 点击 **Test embedding**(测试嵌入) 检查。Marinara 会先保存，再把一小段示例文本转成嵌入，然后显示向量维度，比如“1536 dimensions”，或者显示服务返回的错误。

想通过另一个账号的密钥和地址发送嵌入请求，就在 **Embedding provider**(嵌入服务商) 下选择那个账号。默认是 **Same as this provider**(与此服务商相同)。如果所选账号有自己的嵌入模型，Marinara 就用它；否则使用这里填写的模型名称。

方案二：使用内置模型。它在你的电脑上运行，不需要 API 密钥，在选择器里叫 **Built-in model**(内置模型)。下载之后它才会出现，在 Lite 版本里则会隐藏。见[内置模型设置](../connections/local-model.md)。

想把某个来源设为所有没有自己设置的账号的默认来源，就打开 **Connections**，在 **Embeddings**(嵌入) 这项工作里选它。账号自己的设置仍然优先。默认选项 **Marinara's own search**(Marinara 自带的搜索) 会保留内置模型作为后备。

### 第 2 步：打开 Vectors

新建的世界书默认关闭语义搜索。

1. 打开这本世界书，停在 **Overview**(总览) 选项卡。
2. 打开 **Vectors**。开启时，条目也能按含义被找到。关闭时，关键词照常工作，这本世界书也不会被向量化。

**Vectors** 关闭时，面板会显示“Semantic search is disabled by the lorebook-level Vectors toggle.”

### 第 3 步：给条目做向量化

1. 在 **Semantic search (embeddings)** 面板的下拉菜单里选一个来源。第一个选项是 **No semantic search**(不使用语义搜索)。可用时，接下来是 **Built-in model**，然后是你符合条件的账号。
2. 点击 **Vectorize N missing**(向量化缺失的 N 个条目)，比如“Vectorize 5 missing”。
3. 等待完成。一个小标签会显示进度，比如“8/12 entries vectorized”，全部完成后它会变绿。

如果没有成功：没有任何账号配置嵌入模型时，面板会显示“No connections with an embedding model configured. Set an Embedding Model on a connection first.”完成第 1 步后再试一次。

## Semantic search (embeddings) 面板

打开 **Vectors** 之后，**Overview** 选项卡上会出现这个面板，包含以下设置。

| 设置 | 作用 | 默认 | 取值范围 |
| --- | --- | --- | --- |
| **Query Messages**(查询消息数) | 用最近多少条用户消息来检索。0 表示使用所有可用的消息。 | 10 | 0 到 100 |
| **Score Threshold**(分数阈值) | 条目触发所需的相似度，数值越高越严格。 | 0.3 | 0 到 1 |
| **Vector Limit**(向量上限) | 这本世界书在一次回复中最多能按含义加入多少个条目。 | 10 | 1 到 100 |

**Include character context**(包含角色上下文) 还会检索最近的角色回复，和你的消息分开检索，然后保留匹配更强的那个结果。它会把额外的文本转成嵌入，默认关闭。开启后，**Query Messages** 也会作用于角色回复。

**Score Threshold** 设成 0.2 这类低值，进来的条目更多，但也更容易匹配到跑题的内容。设成 0.5 这类高值，只有含义很接近才会命中。先从默认值开始。

**Vector Limit** 只计算按含义匹配的条目，常规的 Token(模型切分文本的最小单位) 预算依然生效。

## 重新向量化、删除和跳过

- 每个条目都有向量时，会出现 **Re-vectorize N entries**(重新向量化 N 个条目)。确认之后，它会重建全部向量。
- 一部分条目有向量、一部分没有时，会出现 **Re-vectorize all**(全部重新向量化)。它会一次把全部重建一遍。
- **Delete vectors**(删除向量) 只删除已存的向量。条目正文和关键词都保留，关键词也照常工作。
- 条目上的 **No Vector**(不向量化) 会跳过这个条目。它的说明文字写着：批量向量化会跳过这个条目，并删除它已存的嵌入。这个条目仍然能靠关键词触发。

### 换了嵌入模型之后

已存的向量属于生成它们的那个模型。换模型之后，用 **Re-vectorize N entries** 或 **Re-vectorize all**，让每个条目都用同一个模型。如果“只补缺失”的那一轮算出的向量维度不同，就会被拒绝，并提示“Embedding dimensions changed. Use Re-vectorize all entries instead of only missing entries before switching embedding models.”

有一种失败不会报错。聊天时，Marinara 用当前账号的嵌入模型，或者它的 **Embedding provider** 那边的模型，把你的消息转成嵌入。如果账号两者都没设，就用 **Embeddings** 这项工作的来源，或者内置模型。如果这个模型的向量维度和条目的向量不同，Marinara 会在语义匹配中跳过这些条目，而且不显示任何错误。向量化时就用聊天时实际使用的那个来源，换过模型之后也要重新向量化。

## 语义搜索与 Knowledge Router

世界书完成向量化之后，**Knowledge Router** 智能体也会用含义匹配来生成它的初选名单。没有向量时，它只用关键词匹配。见[知识源：Knowledge Retrieval 与 Knowledge Router 智能体](../agents/knowledge-sources.md)。

## 相关指南

- [世界书总览](overview.md)
- [连接 AI 服务商](../connections/connecting-to-a-provider.md)
- [内置模型设置](../connections/local-model.md)
- [知识源：Knowledge Retrieval 与 Knowledge Router 智能体](../agents/knowledge-sources.md)
