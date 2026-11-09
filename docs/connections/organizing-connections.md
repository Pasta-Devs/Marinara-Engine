# Organizing Connections

This guide covers keeping your accounts and models tidy on the **Connections** page (**Library → Connections**): starring, sorting, editing, removing, Shuffle, folders and export. To add an account, see [Connecting to an AI Provider](connecting-to-a-provider.md).

## The account list

Below the **Defaults** box, the page lists your accounts in a table with **Models**, **Status** and **Balance** columns. **On this device** holds the [Built-in model](local-model.md). Click an account to show its saved models under it, and again to fold them away. A model row shows its name and badges such as the job it does (**Main**, **Agents**, **Images**), **Custom settings**, its price, or **Plan** for models included in a subscription.

Above the table:

- **All kinds** narrows the list to **Chat**, **Images**, **Video** or **Voice** accounts.
- **Search accounts and models** filters the list as you type.
- The sort menu offers **Sort: Name**, **Sort: Most models** and **Sort: Recently changed**.

Some accounts reach models from several makers, such as NanoGPT or a proxy. Their models are grouped under headings such as **via NanoGPT**.

### Account actions

Click **⋯** on an account's row:

| Action | What it does |
| --- | --- |
| **Edit account** | Opens its settings: **Name**, **Address**, **API key**, **Use this account** (turn it off without deleting it), **Test account**, **Usage and balance**, and **More options** with **Requests per minute** and **Parallel requests**. **Delete** is here too. |
| **Replace key** | Pastes a new key. If the old key is on other accounts, Marinara asks whether to update them too. |
| **Add model** | Opens the account's model list. |

To delete an account, open **Edit account** and click **Delete**. Marinara asks you to confirm and lists what uses its models, under **Used by**: chats, agents, models, and jobs. Click **Delete with its N models** to remove the account and its models. Those chats and jobs then need another model. If a model cannot be removed, the editor lists it under **This account still has models. Remove these first:**. Open each one and remove it.

### Provider icons

Each account shows its service's icon. The icons come with Marinara and are never loaded from the internet. A custom address shows the icon of a known server or gateway when its address or name contains one, such as Ollama, LM Studio, KoboldCpp, Bifrost, or LiteLLM. Otherwise it shows the first letter of its name. In the classic layout you can choose your own: click an account's picture, then pick a service logo, upload an image, or use letters.

## Starred models

A star marks the models you want to find fast. Starred models are listed under **Starred** near the top of every model picker: the **Defaults** box's **Model for** windows, **Model for this chat**, and the model fields in **Chat Settings** and the agent editor.

To star a model, click its star on its row, or in the account's **Add model** list. Giving a model a job also saves it.

To unstar a model, click its star again. Marinara removes the model and shows **Undo** for a few seconds. The model stays, without its star, when a chat uses it, it has a job in **Defaults**, it has its own settings, or it is the last model of its account. The message names the reason.

## Editing and removing a model

Click a model row to open **Edit model**, with all of its settings. **Remove** (the trash icon) deletes the model after you confirm; the confirmation lists what uses it. **Export model** saves it to a file (see [Export and import](#export-and-import)). To give a model a job, click that job in the **Defaults** box and pick it there.

On a computer, you can drag a model row onto a chat to use that model in the chat.

## Classic layout only

These tools are still in the classic Connections panel. Switch to it with **New layout** in **Settings → Appearance → Theme**, use the tool, and switch back. The new layout uses the same accounts, so nothing is lost.

### More model actions

In the classic panel, **⋯** on a model row also has:

| Action | What it does |
| --- | --- |
| **Make default for…** | Gives the model a job, the same as picking it in **Defaults**. |
| **Move to account…** | Moves the model to another account. It then uses that account's key. Its name, picture, jobs, and chats move with it, and service options reset. |
| **Folder** | Puts the model in a folder. |
| **Duplicate** | Makes a full copy with the same settings. |
| **Add to Shuffle** / **Remove from Shuffle** | See [Shuffle](#shuffle). |
| **Change picture** | Opens the picture choices. |

**⋯** on an account there also has **Test**, **Select models** (move or delete several at once), **Duplicate** and **Turn off** / **Turn on**. **More actions** (three dots) at the top of the panel has **Fold all accounts**, **Open all accounts**, **Show only Off or Needs key**, **Show cost badges**, **Group by folder** / **Group by account**, **Import account** and **Export all accounts**.

### Folders

Folders group your models, for example **RP** and **Work**. Choose **Group by folder** in **More actions** to show them. A model sits in one folder.

1. Click **⋯** on a model and choose **Folder**.
2. Pick a folder, or click **New folder…**, type a name, and click **Create**.

A folder can have an icon and a color. To rename or delete a folder, open its **⋯** menu. Deleting a folder keeps its models, under **Not in a folder**.

### Shuffle

Shuffle lets a chat pick a different model each time it writes a reply. Use it to spread requests across several services or models.

1. Click **⋯** on each model you want in the pool and choose **Add to Shuffle**.
2. In a chat, open **Model for this chat** from the chat input, or **Chat Settings → Connection → Model**, and choose **Shuffle**.

Each reply then picks a random model from your Shuffle pool.

If the model a reply picked fails and **Main** has an **If it fails** model, that model writes the reply instead. A notice names the model that failed and a short reason, such as "key rejected", "rate limited", or "not found". The reply keeps a small **Fallback** label. Tap it, or point at it, to see the same line again.

A pick in **Model for this chat** changes only that chat. To change the model for new chats, set **Main** in the **Defaults** box.

## Export and import

You can export accounts to a file to back them up or move them to another install, then import them later.

> **Warning:** Exports never include API keys. After you import, open each account and enter its key again. Never share a key with anyone.

- **Export one model:** open it with **Edit model** and click **Export model**.
- **Export everything** (classic layout): open **More actions** and choose **Export all accounts**. Marinara reminds you that the file has no keys. Click **Export**.
- **Import:** click **Import** at the top of the Connections page. Drop one or more files (`.json`, `.jsonl`, or `.zip`) on the window, or click to browse. This includes the `marinara-connections.zip` you exported. Each imported account has an empty key until you fill it in.

One model downloads as a `.connection.json` file. Several download together as `marinara-connections.zip`. Stars are included. The service's model catalog is not, so it loads again the first time you open the account's models.

## Related guides

- [Connecting to an AI Provider](connecting-to-a-provider.md)
- [Chat Settings Overview](../chats/chat-settings.md)
