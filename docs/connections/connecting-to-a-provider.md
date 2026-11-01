# Connecting to an AI Provider

This guide shows you how to connect Marinara Engine to an AI provider so your characters can reply. You add an account, paste its key, and pick the model that answers your chats.

## Accounts and models

An **account** is one key, sign-in, or address for an AI provider. It stores the provider, the key, the address, and its limits. If you use two keys for the same provider, you have two accounts.

A **model** is one AI model you saved from an account, such as GPT or Claude. Each saved model keeps its own settings. Models sit under their account in the **Connections** panel.

An API key is a secret code from your AI provider. It works like a password. Marinara stores your key on the computer that runs Marinara, and it is never included when you export.

Marinara Engine does not come with a ready-made account or a free starter key. You must add at least one account before you can start a chat. The **Built-in model** under **On your computer** is the one exception: it runs on your own computer without an account (see [Local Model Setup](local-model.md)).

## The Connections panel

You manage accounts in the **Connections** panel on the right side of the app. From top to bottom it shows:

- **Search models and accounts**, which filters the list as you type.
- **Add**, which opens the **Add account** window, and **More actions** (three dots), which has **Import account**, **Export all accounts**, folding, and grouping. In a wide panel, the sort dropdown is beside **Search models and accounts**. In a narrow panel, sorting is in **More actions**.
- The **Jobs** box. It says which model does each job, such as **Main** for chat replies or **Images** for pictures. See [Choosing the model for each job](#choosing-the-model-for-each-job).
- Your accounts, each with its saved models under it. See [Organizing Connections](organizing-connections.md).

## Adding an account

1. In the **Connections** panel, click **Add**. The **Add account** window lists providers under **Popular**, **Subscriptions**, **On your computer**, and **All providers**. Type in **Search providers** to find one.
2. Click a provider, such as **OpenAI**, **Anthropic**, or **OpenRouter**.
3. Paste the key into **API key**. **Where do I find my key?** opens the provider's key page. The eye button shows or hides the key. **More options** has the optional **Name**, the **Address**, **Requests per minute**, and **Parallel jobs**.
4. Click **Connect**. Marinara tests the key. When it fails, the window shows why and **Try again**. Servers on your computer also offer **Continue anyway**.
5. When you add your first account without a Main model, or add an account while starting a chat, the window continues to model selection. Pick a model. **Make … my Main** sets it as Main when that choice is shown. Click **Done** to finish, or **Start chatting** when you started from a new chat. If you already have Main and add an account from the panel, the window closes after Connect and the panel shows the new account. Image, video, and voice services use their own setup controls; the built-in model uses its local setup screen.

You can change the model for each job later in the **Jobs** box.

If you leave **Name** empty, Marinara names the account after the provider. A second account for the same provider without a typed name gets the last 4 characters of its key, for example `OpenAI · …a1b2`. A name you type is never changed.

You usually do not need to touch **Address**. Marinara fills it in for known providers. Change it only for a proxy or a server on your computer.

Some providers use a sign-in on your computer instead of a key. They are under **Subscriptions** and have no key field. See [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md). To connect a model running on your own computer, see [Connecting a Local or Self-Hosted Model](local-self-hosted.md). For every supported provider and where to get each key, see [Supported AI Providers](providers-reference.md).

### Starting a chat with no account

If you start a chat before you have a model, Marinara opens the **Add account** window first. After **Connect**, it shows the provider's models. Click one, then click **Start chatting**. The footer can also make that model your **Main** model.

## Choosing the model for each job

The **Jobs** box lists every job a model can do, in four groups:

- **Chat**: **Main** writes replies in your chats. **Agents** runs the helper agents. **Impersonate** writes as you.
- **Omnibar**: **Professor Mari** and **Quick answers**.
- **Pictures & sound**: **Images**, **Video**, and **Voice (Text to Speech)**.
- **Behind the scenes**: **Decision**, **Embeddings**, and **Image reading**.

Each row shows the model doing that job and its provider, or what the job does without one, such as **Follows Main** or **Off**. A job that needs a model shows **Choose a model**.

Click a row to open **Model for** that job. It shows the model doing the job under **Now**, your **Starred** models, and then your saved models by account. **All models** under an account opens its full catalog. Type in **Search all models or paste a model ID** to search every catalog at once. Click any model to give it the job; you do not have to save it first. **If it fails** at the top of the window picks a second model that answers when the first one fails. **Add account** at the bottom opens the Add window.

Click **Jobs** to fold the box down to its header.

### When a feature needs a model

An agent or feature that cannot work without a kind of model says so with a **Needs an image model** label (or video, audio, decision, or chat). It shows on the agent's card in the **Agents** panel, in **Chat Settings**, in the agent editor, and in the image and video windows. Click **Set up** next to it to open **Model for** that job, where you can pick a model or click **Add account**. The label goes away once the job has a model. When a reply fails because no image model is set, the message's **Set up** opens the **Connections** panel.

## Testing an account

**Connect** already tests the key. To test it again later, open the account's **⋯** menu in the panel and click **Test**. The account editor (**Edit account**) has **Test account**, which checks the key and address as you typed them, before you save.

## Choosing a model for one chat

A new chat uses your **Main** model. To give one chat a different model, open the **Connections** menu in the chat input, or the **Model** field in **Chat Settings → Connection**. Both open **Model for this chat**:

- **Now** shows the model the chat uses. **This chat only** means the chat has its own pick; **follows Main** means it uses Main.
- **Recent** and **Starred** list your models by account.
- **Search models or paste an ID…** searches every catalog. **Browse** opens one account's full list.
- **Follow Main** clears the chat's own pick. **Shuffle** picks a different model each time.

A pick changes only that chat. The message after a pick offers **Make it my Main model** and **Undo**. In Game Mode the field is labeled **GM / Party Model**.

## Common errors

If a test or a message fails, check these first:

- A wrong or expired key. Open the account's **⋯** menu, click **Replace key**, and paste the key again. An account without a key shows **Needs key**.
- An account that is off. It shows **Off**; click **Turn on** in its **⋯** menu.
- A key from the wrong provider. Each provider needs its own key.
- A blocked or unreachable **Address**. Leave it empty to use the provider's own, unless you use a proxy or a server on your computer.

For more fixes, see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

## Related guides

- [Organizing Connections](organizing-connections.md)
- [Supported AI Providers](providers-reference.md)
- [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md)
- [Connecting a Local or Self-Hosted Model](local-self-hosted.md)
- [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md)
