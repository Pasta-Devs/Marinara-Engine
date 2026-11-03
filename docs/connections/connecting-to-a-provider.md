# Connecting to an AI Provider

Marinara Engine does not come with an AI model of its own to talk to. To chat, you add an account for an AI service, paste its API key, and pick a model. An API key is a secret code from the service that lets Marinara use your account there. Treat it like a password.

## Adding an account

Before you start, get an API key from a service you want to use. The **Add account** window has a **Where do I find my key?** link for each service. The pages below are the ones it opens for the common services.

| Service | Where to get the key |
| --- | --- |
| OpenRouter (has free models) | `https://openrouter.ai/keys` |
| NanoGPT | `https://nano-gpt.com/api` |
| OpenAI | `https://platform.openai.com/api-keys` |
| Anthropic | `https://console.anthropic.com/settings/keys` |
| Google Gemini | `https://aistudio.google.com/apikey` |

Most services ask you to sign up, and some ask you to add credit, before a key works. For other services, see [Supported AI Providers](providers-reference.md). To use a model on your own computer with no key, see [Built-in Model Setup](local-model.md).

1. Click **Connections** in the top bar. The panel opens on the right. If you have no accounts yet, it asks **Where do your models come from?** and shows a few services. Click one and go to step 4.
2. Click **Add**. The **Add account** window opens.
3. Click the service you want. Type in **Search providers** to find it. The list has the sections **Chat**, **Decisions**, **Images & video**, and **Voice**. For a normal chat model, look under **Chat**.
4. Click **API key** and paste your key. Click the eye button to check that you pasted all of it.
5. Click **Connect**. Marinara tests the key. When it works, you see **Connected** with the number of models it found.
6. Pick a model. The next screen lists the service's models. **Recommended** models are at the top. Click a model to add it, or type a name in **Search or enter model ID…** to find one. If you do not know which to choose, take a **Recommended** one. You can change it later.
7. Leave **Make … my Main model** checked. This sets the model that writes your chat replies. The box shows only when you have no Main model yet.
8. Click **Done**. If you opened the window from a new chat, click **Start chatting** instead.

The panel now shows your account with its model under it. Start a chat and send a message. A reply means it works.

If it did not work:

- **The key was not accepted. Check that you copied all of it.** Paste the key again and click **Try again**. The key must come from the service you picked.
- **The service is busy, or your credit is used up.** Add credit on the service's website, or wait and try again.
- **Marinara could not reach** the service. Check your internet connection, then click **Try again**.

For more fixes, see [Troubleshooting Marinara Engine](../TROUBLESHOOTING.md).

### Optional account fields

The key step also shows these fields. Leave them empty unless you have a reason.

| Field | What it does |
| --- | --- |
| **Name (optional)** | The name shown in the panel. Empty means the service's name. A second account for the same service gets the last 4 characters of its key, such as `OpenAI · …a1b2`. A name you type is never changed. |
| **Address** | The web address Marinara sends requests to. Marinara fills it in for known services. Change it only for a proxy, a gateway, or a server you run. |
| **Requests per minute** | Limits how fast Marinara sends requests on this account. Empty means no limit. Allowed values are 1 to 600. |
| **Parallel jobs** | Limits how many requests run at the same time. Empty means no limit. Allowed values are 1 to 16. |

Some services use a sign-in on your computer instead of a key. They show a **Sign in** tag and have no key field. See [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md). For a server on your own computer, see [Connecting a Local or Self-Hosted Model](local-self-hosted.md). After a failed test, **Continue anyway** appears. It saves the account without a passing test.

### Starting a chat with no account

If you start a chat before you have a model, Marinara opens the **Add account** window first. After **Connect**, click a model, then click **Start chatting**.

## The Connections panel

You manage accounts in the **Connections** panel. From top to bottom it shows:

- **Search models and accounts**, which filters the list as you type.
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
| **Pictures & sound** | **Images**, **Video**, and **Voice (Text to Speech)**. |
| **Behind the scenes** | **Decision**, **Embeddings**, and **Image reading**. |

Each row shows the model doing that job, or what the job does without one, such as **Follows Main** or **Off**. A job that needs a model shows **Choose a model**. Click **Jobs** to fold the box.

To change the model for a job:

1. Click the job's row. **Model for** that job opens.
2. Click a model. You see it under **Now**, then your **Starred** models, then your saved models by account. **All models** under an account opens its full list. Type in **Search all models or paste a model ID** to search every account at once. You do not have to save a model first.

**If it fails** at the top of the window picks a second model that answers when the first one fails. **Add account** at the bottom opens the Add window.

### When a feature needs a model

A feature that cannot work without a kind of model shows a **Needs an image model** label (or video, audio, decision, or chat). You see it on the agent's card in the **Agents** panel, in **Chat Settings**, in the agent editor, and in the image and video windows. Click **Set up** next to it, then pick a model or click **Add account**. The label goes away once the job has a model.

## Testing an account

**Connect** already tests the key. To test again later, open the account's **⋯** menu in the panel and click **Test**. The account editor (**Edit account**) has **Test account**, which checks the key and address as you typed them, before you save.

## Choosing a model for one chat

A new chat uses your **Main** model. To give one chat a different model, open the **Connections** menu in the chat input, or the **Model** field in **Chat Settings → Connection**. Both open **Model for this chat**:

- **Now** shows the model the chat uses. **This chat only** means the chat has its own pick. **follows Main** means it uses Main.
- **Recent** and **Starred** list your models by account.
- **Search models or paste an ID…** searches every account. **Browse** opens one account's full list.
- **Follow Main** clears the chat's own pick. **Shuffle** picks a different model each time.

A pick changes only that chat. The message after a pick offers **Make it my Main model** and **Undo**. In Game Mode the field is labeled **GM / Party Model**.

## Common errors

If a test or a message fails, check these first:

- A wrong or expired key. Open the account's **⋯** menu, click **Replace key**, and paste the key again. An account without a key shows **Needs key**.
- An account that is off. It shows **Off**. Click **Turn on** in its **⋯** menu.
- A key from the wrong service. Each service needs its own key.
- A blocked or unreachable **Address**. Leave it empty to use the service's own, unless you use a proxy or a server on your computer.

## Related guides

- [Organizing Connections](organizing-connections.md)
- [Supported AI Providers](providers-reference.md)
- [Claude, ChatGPT, and Grok Subscription Connections](subscription-clis.md)
- [Connecting a Local or Self-Hosted Model](local-self-hosted.md)
