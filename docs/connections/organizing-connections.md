# Organizing Connections

This guide covers keeping your accounts and models tidy in the **Connections** panel: collapsing, starring, moving, removing, folders, Shuffle, and export. To add an account, see [Connecting to an AI Provider](connecting-to-a-provider.md).

## The account list

Below the **Jobs** box, the panel lists your accounts. Each account shows its picture, name, number of models, and address. A model row shows the model's picture, its name, and badges such as the job it does (**Main**, **Agents**, **Images**), **Custom settings**, its price, or **Plan** for models included in a subscription. The **Built-in model** card sits under the **Jobs** box. See [Built-in Model Setup](local-model.md).

Click an account's row to fold its models away, and click again to show them. Marinara remembers which accounts you folded. **More actions** (three dots) at the top of the panel has these items:

| Item | What it does |
| --- | --- |
| **Fold all accounts**, **Open all accounts** | Folds or opens every account. |
| **Show only Off or Needs key** | Lists only accounts that need attention. |
| **Show cost badges** | Shows each model's price. |
| **Group by folder**, **Group by account** | Switches how models are grouped. See [Folders](#folders). |
| **Import account**, **Export all accounts** | See [Export and import](#export-and-import). |

In a wide panel the sort dropdown is beside **Search models and accounts**. In a narrow panel, sorting is in **More actions**. The sort choices are **Custom**, **A–Z**, **Z–A**, **Newest**, and **Oldest**. **Search models and accounts** filters the list as you type.

Some accounts reach models from several makers, such as NanoGPT or a proxy. Their models are grouped under headings such as **via NanoGPT**.

### Account actions

Click **⋯** on an account's row:

| Action | What it does |
| --- | --- |
| **Edit account** | Opens its settings, including **Name**, **Address**, **API key**, and **Use this account**. |
| **Replace key** | Pastes a new key. If the old key is on other accounts, Marinara asks whether to update them too. |
| **Test** | Checks the key and shows the result. |
| **Add model** | Opens the account's model list. **Add image model** shows for services that also make images. |
| **Select models** | Lets you move or delete several models at once. |
| **Duplicate** | Adds a copy of the account with copies of its models. |
| **Turn off** / **Turn on** | Stops or resumes Marinara using the account. |
| **Delete account** | See below. |

To delete an account, click **Delete account**. Marinara asks you to confirm and lists what uses its models, under **Used by**: chats, agents, models, and jobs. Click **Delete with its N models** to remove the account and its models. Those chats and jobs then need another model. If a model cannot be removed, the editor lists it under **This account still has models. Remove these first:**. Open each one and remove it.

In **Edit account**, **Test account** checks the key, **Usage and balance** shows plan usage, and **More options** has **Requests per minute** and **Parallel requests**.

### Provider icons

Each account shows its service's icon. The icons come with Marinara and are never loaded from the internet. A custom address shows the icon of a known server or gateway when its address or name contains one, such as Ollama, LM Studio, KoboldCpp, Bifrost, or LiteLLM. Otherwise it shows the first letter of its name. To choose your own, click an account's picture, then pick a service logo, upload an image, or use letters.

## Starred models

A star marks the models you want to find fast. Starred models are listed under **Starred** near the top of every model picker: the **Jobs** box's **Model for** windows, **Model for this chat**, and the model fields in **Chat Settings** and the agent editor.

To star a model, click its star in the account's **Add model** list, or choose **Star** in the model's **⋯** menu. Giving a model a job also saves it.

To unstar a model, click its star again. Marinara removes the model and shows **Undo** for a few seconds. The model stays, without its star, when a chat uses it, it has a role in **Jobs**, it has its own settings, or it is the last model of its account. The message names the reason.

## Model actions

Click **⋯** on a model row:

| Action | What it does |
| --- | --- |
| **Make default for…** | Gives the model a job, the same as picking it in the **Jobs** box. |
| **Edit model** | Opens its settings. Clicking the model row does the same. |
| **Move to account…** | Moves the model to another account. It then uses that account's key. |
| **Folder** | Puts the model in a folder. |
| **Duplicate** | Makes a full copy with the same settings. |
| **Add to Shuffle** / **Remove from Shuffle** | See [Shuffle](#shuffle). |
| **Change picture** | Opens the picture choices. |
| **Remove** | Deletes the model after you confirm. The confirmation lists what uses it. |

When you move a model, its name, picture, jobs, and chats move with it, and service options reset.

On a computer, you can drag a model row onto a chat to use that model in the chat.

## Folders

Folders group your models, for example **RP** and **Work**. Choose **Group by folder** in **More actions** to show them. A model sits in one folder.

1. Click **⋯** on a model and choose **Folder**.
2. Pick a folder, or click **New folder…**, type a name, and click **Create**.

A folder can have an icon and a color. To rename or delete a folder, open its **⋯** menu. Deleting a folder keeps its models, under **Not in a folder**.

## Shuffle

Shuffle lets a chat pick a different model each time it writes a reply. Use it to spread requests across several services or models.

1. Click **⋯** on each model you want in the pool and choose **Add to Shuffle**.
2. In a chat, open **Model for this chat** from the chat input, or **Chat Settings → Connection → Model**, and choose **Shuffle**.

Each reply then picks a random model from your Shuffle pool.

If the model a reply picked fails and **Main** has an **If it fails** model, that model writes the reply instead. A notice names the model that failed and a short reason, such as "key rejected", "rate limited", or "not found". The reply keeps a small **Fallback** label. Tap it, or point at it, to see the same line again.

A pick in **Model for this chat** changes only that chat. To change the model for new chats, set **Main** in the **Jobs** box.

## Export and import

You can export accounts to a file to back them up or move them to another install, then import them later.

> **Warning:** Exports never include API keys. After you import, open each account and enter its key again. Never share a key with anyone.

- **Export one model:** open it with **Edit model** and click **Export model**.
- **Export everything:** open **More actions** and choose **Export all accounts**. Marinara reminds you that the file has no keys. Click **Export**.
- **Import:** open **More actions** and choose **Import account**. Drop one or more files (`.json`, `.jsonl`, or `.zip`) on the window, or click to browse. This includes the `marinara-connections.zip` you exported. Each imported account has an empty key until you fill it in.

One model downloads as a `.connection.json` file. Several download together as `marinara-connections.zip`. Stars are included. The service's model catalog is not, so it loads again the first time you open the account's models.

## Related guides

- [Connecting to an AI Provider](connecting-to-a-provider.md)
- [Chat Settings Overview](../chats/chat-settings.md)
