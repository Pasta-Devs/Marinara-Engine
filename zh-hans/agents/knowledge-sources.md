# 知识源：Knowledge Retrieval 与 Knowledge Router 智能体

**Knowledge Retrieval**(知识检索) 和 **Knowledge Router**(知识路由) 只在场景真正用得上的时候，才把世界书里的设定取出来放进聊天，这样就不必把每一个细节都塞进每一次的提示词。这两个智能体都只能在 Roleplay(角色扮演) 聊天里使用，而且都不是默认开启的。

## 为什么要用它们

世界书是一组世界设定或角色设定笔记，其中每一条叫作条目。每一回合都把全部条目发过去，会白白浪费 Token(模型读取、按量计费的文本小单位)，还容易让 AI 抓不住重点。

这两个智能体采用 retrieval-augmented generation(检索增强生成，RAG)：Marinara 会找出符合当前场景的条目，只把这些条目加进这一回合的提示词。

## 选择 Retrieval 还是 Router

| 问题 | Knowledge Retrieval | Knowledge Router |
| --- | --- | --- |
| 内容怎么加进来 | 先把知识源概括成摘要 | 把选中的条目原样加入 |
| 每回合的花费 | 较高 | 较低 |
| 能不能读上传的文件 | 能 | 不能 |
| 适合什么情况 | 知识源较小，或者想要一份干净的摘要 | 条目描述写得好的大型世界书 |

- **Knowledge Retrieval** 会读取所选世界书里每一条启用的条目，外加上传的文件，然后请 AI 概括出符合最近消息的事实。因为 AI 要读全部原始文本，所以花费更高。
- **Knowledge Router** 会给条目建一份小目录，每一行包含一个 ID、一个名称、几个关键词和一句摘要。AI 从目录里挑选条目，再由 Marinara 把它们完整加入。AI 从来不会通读每一条条目，所以世界书再大，路由的开销也很低。

两个智能体可以加进同一个聊天，但它们的作用有重叠，花费也会跟着涨。两个都配置好时，智能体编辑器会提醒你。只选一个就好。

## 把知识类智能体加进聊天

开始之前：先从 **Agent Organizer**(智能体管理器) 安装智能体。见[智能体概览](agents-overview.md)。

1. 在 Roleplay 聊天里打开 **Chat Settings**(聊天设置)。
2. 找到 **Agents**(智能体) 一节，开启 **Enable Agents**(启用智能体)。
3. 点击 **Add Agent**(添加智能体)。
4. 展开 **Writer Agents**(写作智能体) 分组，选择 **Knowledge Retrieval** 或 **Knowledge Router**。
5. 在设置窗口里挑选知识源（见下文）。

随后，智能体的设置卡片会出现在 **Agents** 里，并在每一个新回合运行。Knowledge Retrieval 工作时，进度提示里可能显示 **Retrieving knowledge...**。

> **注意：** 这些智能体只在新回合运行。重新生成回复时，它们不会再跑一次。

## 选择知识源

两个智能体共用同一套知识源控件。

- **Use chat-active lorebooks**(使用聊天中已启用的世界书) 默认开启。智能体编辑器里同一个开关叫 **Use this chat's active lorebooks**。开关开着、又没有选任何固定世界书时，智能体会读取当前聊天启用的世界书。
- **Fixed source override**(固定来源覆盖)（设置窗口里叫 **Fixed Source Lorebooks**）会把智能体锁定在你选的世界书上。只要选了固定世界书，它就一定优先于聊天启用的世界书，在每一个用到这个智能体的聊天里都是如此。

想让某个智能体始终读同一本参考世界书时，就用固定知识源。想让它跟着聊天用的世界书走，就保持开关开启、不选任何固定世界书。

## 上传文件（仅限 Knowledge Retrieval）

在 **Knowledge Retrieval** 的设置里点击 **Upload file**(上传文件)。上传的文件对每一个用到 Knowledge Retrieval 的聊天都有效。

支持的类型有 `.txt`、`.md`、`.csv`、`.json`、`.xml`、`.html`、`.htm`、`.log`、`.yaml`、`.yml`、`.tsv` 和 `.pdf`，其他类型在文件选择器里选不了。每个文件会显示名称和大小，旁边有一个删除按钮。

- 除 PDF 之外的文件都按纯文本读取。不是文本的文件，比如改名成 `.txt` 的图片，虽然能上传，但加进来的只会是读不了的内容。
- 扫描件或纯图片的 PDF 没有文字层。智能体会插入一段占位内容来代替正文。请使用文字可以选中的 PDF。

## 把条目描述写好

这对 Knowledge Router 最重要，因为它按条目的 **Description**(描述) 来挑选条目。

1. 在世界书编辑器里打开条目。
2. 在 **Description** 里填一句简短、具体的摘要，说清这条条目讲的是什么。

路由只拿描述来挑选条目，不会把它当作故事内容发给主 AI。没有描述时，路由会退而使用条目正文的开头部分，准确度会差一些。

给路由选好知识源世界书之后，**Fixed source override** 旁边会出现一个描述完成度角标，比如 **75% described (9/12)**。圆点在 75% 及以上是绿色，25% 到 74% 是琥珀色，低于 25% 是红色。世界书里没有条目时，它显示 **No entries yet**。目标是拿到绿色。

## 可选：按含义筛选候选条目

Knowledge Router 还能按含义而不只是按关键词来找候选条目。这要用到嵌入模型，也就是一个把文本转成数字、让 Marinara 能比较含义的小模型。不用它，路由照样能工作。

1. 打开世界书编辑器，找到 **Semantic search (embeddings)**(语义搜索与嵌入)。
2. 选一个带嵌入模型的账号。如果你在 **Connections → Defaults**(连接 → 默认值) 下设置了 **Embeddings**(嵌入) 默认值，这里会自动替你选上它，除非你之前选过别的来源。
3. 使用和聊天账号相同的嵌入来源。维度不同的向量会被跳过。
4. 点击向量化按钮。按钮会显示还有多少条目需要向量。**Re-vectorize all**(全部重新向量化) 会把每个条目都重做一遍。

世界书没有向量，或者没有可用的嵌入模型时，路由只靠关键词生成候选清单，功能不会坏。见[世界书的语义搜索](../lorebooks/semantic-search.md)。

## 相关指南

- [世界书的语义搜索](../lorebooks/semantic-search.md)
- [世界书总览](../lorebooks/overview.md)
- [智能体：聊天里的 AI 帮手](agents-overview.md)
