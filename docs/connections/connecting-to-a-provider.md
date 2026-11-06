# Connecting to an AI Provider

To chat, Marinara Engine needs an AI model. You can add an account for an AI service, paste its API key, and pick a model. An API key is a secret code from the service that lets Marinara use your account there. Treat it like a password. You can also use the [Built-in model](local-model.md), a small model that runs on your computer with no key.

## Adding an account

Before you start, get an API key from a service you want to use. The **Add account** window has a **Where do I find my key?** link for each service. These are the pages it opens for the common services.

- OpenRouter (has free models): `openrouter.ai/keys`
- NanoGPT: `nano-gpt.com/api`
- OpenAI: `platform.openai.com/api-keys`
- Anthropic: `console.anthropic.com/settings/keys`
- Google Gemini: `aistudio.google.com/apikey`

Most services ask you to sign up, and some ask you to add credit, before a key works. For other services, see [Supported AI Providers](providers-reference.md). To use a model on your own computer with no key, see [Built-in Model Setup](local-model.md).

1. Click **Connections** in the top bar. The panel opens on the right. If you have no accounts yet, it asks **Where do your models come from?** and shows a few services. Click a service (not **Built-in model**). The **Add account** window opens on the key step. Go to step 4.
2. Click **Add**. The **Add account** window opens.
3. Click the service you want. Type in the box labeled **Search providers** to find it. The list has the sections **Chat**, **Images & video**, **Voice**, and **Decisions**. For a normal chat model, look under **Chat**.
4. Click **API key** and paste your key. Click the eye button to check that you pasted all of it.
5. Click **Connect**. Marinara tests the key. When it works, you see **Connected** with the number of models it found.
6. What happens next depends on whether you already have a Main model. Main is the job of writing your chat replies.
   - **No Main model yet, or you opened Add from a new chat:** the window shows the service's models. **Recommended** models are at the top. Click a model to add it, or type a name in **Search or enter model ID…**. If you do not know which to choose, take a **Recommended** one. You can change it later. Keep **Make … my Main model** checked. It shows only when you have no Main model. When you opened Add from a new chat and already have a Main model, a **Set … as Main** button shows instead. Then click **Done**, or **Start chatting** from a new chat.
   - **You already have a Main model:** the window closes and a message says the account was added with its number of models. To add more models, click **⋯** on the account and choose **Add model**.

The panel shows your account. **Connected** in step 5 already means the key works. If the new model is your Main model, start a chat and send a message: a reply means everything works. If you already had a Main model, new chats still use it. To use the new account, add a model to it (**⋯** → **Add model**), then choose that model for a chat or a job (see [Choosing the model for each job](#choosing-the-model-for-each-job)).

If it did not work:

- **The key was not accepted. Check that you copied all of it.** Paste the key again and click **Try again**. The key must come from the service you picked.
- **The service is busy, or your credit is used up.** Add credit on the service's website, or wait and try again.
- **Marinara could not reach** the service. Check your internet connection, then click **Try again**.

### Optional account fields

The key step also shows these fields. Leave them empty unless you need them.

- **Name (optional)**: the name shown in the panel. Empty means the service's name. A second account for the same service gets the last 4 characters of its key, such as `OpenAI · …a1b2`.
- **Address**: where Marinara sends requests. Marinara uses the service's own address when it is empty. Fill it in only for a proxy, a gateway, or a server you run. Services that sign in on your computer do not show it.
- **Requests per minute**: slows Marinara down on this account. Empty means no limit. Allowed values are 1 to 600.
- **Parallel jobs**: how many requests run at the same time. Empty means no limit. Allowed values are 1 to 16. In **Edit account** the same setting is called **Parallel requests**.

Some services use a sign-in on your computer instead of a key. They show a **Sign in** tag and have no key field. See [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md). For a server on your own computer, see [Connecting a Local or Self-Hosted Model](local-self-hosted.md). After a failed test, **Continue anyway** appears. It saves the account without a passing test.

### Starting a chat with no account

If you start a chat before you have a model, Marinara opens the **Add account** window first. After **Connect**, click a model, then click **Start chatting**.

## The Connections panel

You manage accounts in the **Connections** panel. From top to bottom it shows:

- A search box that filters the list as you type. Its label is **Search models and accounts**.
- **Add**, which opens **Add account**, and **More actions** (three dots), which has **Import account**, **Export all accounts**, folding, and grouping. In a wide panel, the sort dropdown is beside the search. In a narrow panel, sorting is in **More actions**.
- The **Jobs** box. It says which model does each job.
- The **Built-in model** card. See [Built-in Model Setup](local-model.md).
- Your accounts, each with its saved models under it. See [Organizing Connections](organizing-connections.md).

An **account** is one saved key, sign-in, or address for one service. If you use two keys for the same service, you have two accounts. A **model** is one AI model you saved from an account. Each saved model keeps its own settings.

## Choosing the model for each job

A job is something a model does for you. The **Jobs** box lists them in four groups:

| Group | Jobs |
| --- | --- |
| **Chat** | **Main** writes replies in your chats. **Agents** runs the helper agents. **Impersonate** writes as you. |
| **Omnibar** | **Professor Mari** and **Quick answers**. |
| **Pictures & sound** | **Images**, **Video**, **Voice (Text to Speech)**, and **Dictation (Speech to Text)** when it is available. |
| **Behind the scenes** | **Decision**, **Embeddings**, and **Image reading**. |

Each row shows the model doing that job, or what the job does without one, such as **Follows Main** or **Off**. A job that needs a model shows **Choose a model**. Click **Jobs** to fold the box.

To change the model for a job, click its row. **Model for** that job opens, except for three rows. **Decision** and **Embeddings** open their own controls (see [Decision Models](decision-models.md) and [Supported AI Providers](providers-reference.md#embeddings)). **Dictation (Speech to Text)** opens speech setup.

In **Model for**:

1. Look at the list.
2. Click a model. The list shows it under **Now**, then your **Starred** models, then your saved models by account. **All models** under an account opens its full list. Type in **Search all models or paste a model ID** to search every account at once. You do not have to save a model first.

**If it fails** at the top of the window picks a second model that answers when the first one fails. **Add account** at the bottom opens the Add window.

### When a feature needs a model

A feature that cannot work without a kind of model shows a **Needs an image model** label (or video, audio, decision, or chat). You see it on the agent's card in the **Agents** panel, in **Chat Settings**, in the agent editor, and in the image and video windows. Click **Set up** next to it, then pick a model or click **Add account**. The label goes away once the job has a model.

## Testing an account

**Connect** already tests the key. To test again later, open the account's **⋯** menu in the panel and click **Test**. The account editor (**Edit account**) has **Test account**, which checks the key and address as you typed them, before you save.

## Choosing a model for one chat

A new chat uses your **Main** model. To give one chat a different model, click the model button in the chat input (the link icon, labeled with the current model), or use the **Model** field in **Chat Settings → Connection**. Both open **Model for this chat**:

- **Now** shows the model the chat uses. **This chat only** means the chat has its own pick. **follows Main** means it uses Main.
- **Recent** and **Starred** list your models by account.
- **Search models or paste an ID…** searches every account. **Browse** opens one account's full list.
- **Follow Main** clears the chat's own pick. **Shuffle** picks a different model each time.

A pick changes only that chat. The message after a pick offers **Make it my Main model** and **Undo**. In Game Mode the field is labeled **Game Master model**.

## Common errors

If a test or a message fails, check these first:

- A wrong or expired key. Click **⋯** on the account, choose **Replace key**, and paste the key again. An account without a key shows **Needs key**.
- An account that is off. It shows **Off**. Click **Turn on** in its **⋯** menu.
- A key from another service. Each service needs its own key.
- A blocked **Address**. Empty uses the service's own address.

For more fixes, see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

## Related guides

- [Organizing Connections](organizing-connections.md)
- [Supported AI Providers](providers-reference.md)
- [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md)
- [Connecting a Local or Self-Hosted Model](local-self-hosted.md)
