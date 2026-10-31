# Organizing Connections

This guide covers how to keep your accounts and models tidy in Marinara Engine. It explains the account list, starred models, moving and removing models, folders, Shuffle, and exporting or importing. An account is one key, sign-in, or address for an AI provider; a model is one AI model you saved from it. To add an account, see [Connecting to an AI Provider](connecting-to-a-provider.md).

## The account list

Below the **Jobs** box, the **Connections** panel lists your accounts. Each account shows its picture, its name, how many models it has, and its address. A model row shows the model's picture, its name, and badges such as the job it does (**Main**, **Agents**, **Images**), **Custom settings**, its price, or **Plan** for models included in a subscription.

Click an account's row to fold its models away, and click again to show them. Marinara remembers which accounts you folded. **More actions** at the top of the panel has **Fold all accounts** and **Open all accounts**, **Show only Off or Needs key**, and **Show cost badges**. In a wide panel, the sort dropdown is beside **Search models and accounts**. In a narrow panel, the sort order is in **More actions**.

A gateway account that reaches several model makers, for example a proxy or LinkAPI, groups its models under **via** headings, such as **via NanoGPT**, with that maker's icon.

The **Built-in model** card, under the Jobs box, shows the model that runs on your computer and its state. See [Local Model Setup](local-model.md).

### Account actions

Click **⋯** on an account's row:

- **Edit account** opens its settings: **Name**, **API key**, **Address**, **Usage and limits**, and **Use this account**.
- **Replace key** pastes a new key.
- **Test** checks the key and shows the result.
- **Add model** opens the account's model list. **Add image model** shows for providers that also make images.
- **Select models** lets you move or delete several models at once.
- **Duplicate** adds a copy of the account with copies of its models.
- **Turn off** stops Marinara from using the account until you **Turn on** it again.
- **Delete account**. Marinara lists the jobs, chats, and agents that still use its models first.

### Provider icons

Each account shows the icon of its provider. The icons come with Marinara, so Marinara never loads them from the internet. A custom address shows the icon of a known server or gateway when its address or name contains one, for example Ollama, LM Studio, KoboldCpp, Bifrost, or LiteLLM. Otherwise it shows the first letter of its name. Click an account's picture to choose your own.

## Starred models

A star marks the models you want close at hand. Starred models are listed under **Starred** near the top of every model picker: the **Jobs** box's **Model for** windows, the chat's **Model for this chat**, and the model fields in **Chat Settings** and the agent editor.

To star a model, click its star in the account's **Add model** list, or choose **Star** in the model's **⋯** menu. Giving a model a job also saves it.

To unstar a model, click its star again. Marinara removes the model and shows **Undo** for a few seconds. A model stays, without its star, when it still has a role in **Jobs**, has its own settings, or is the last model of its account. The message names the reason.

## Model actions

Click **⋯** on a model row:

- **Make default for…** gives the model a job, the same as picking it in the **Jobs** box.
- **Edit model** opens its settings. Clicking the model row does the same.
- **Move to account…** moves the model to another account of the same provider, or to a new account. The model then uses that account's key and catalog. Chats that use the model keep working.
- **Folder** puts the model in a folder. Folders show when you choose **Group by folder** in **More actions**.
- **Duplicate** makes a full copy with the same settings, without asking.
- **Add to Shuffle** or **Remove from Shuffle**.
- **Change picture**.
- **Remove** deletes the model after you confirm.

On a computer, you can drag a model row onto a chat to use that model in the chat.

## Search

**Search models and accounts** at the top of the panel filters the list as you type. When nothing matches, the panel says so.

## Shuffle

Shuffle lets a chat pick a different model each time it writes a reply. This is useful when you want to spread requests across several providers or models.

To add a model to Shuffle, choose **Add to Shuffle** in its **⋯** menu. To make a chat use Shuffle, open **Model for this chat** from the chat input or **Chat Settings → Connection → Model** and choose **Shuffle**. Each reply then picks a random model from your Shuffle.

If the model a reply picked fails and **Main** has an **If it fails** model, that model writes the reply instead. A notice names the model that failed and a short reason, such as "key rejected", "rate limited", or "not found", so you can tell which one needs fixing. The reply keeps a small **Fallback** label; tap it, or point at it, to see the same line again.

A pick in **Model for this chat** changes only that chat. To change the model for new chats, set **Main** in the **Jobs** box.

## Exporting and importing

You can export accounts to a file to back them up or move them to another install, then import them later.

**Your API keys are never included in an export.** After you import, open each account and enter its key again. Stars are included; the provider's catalog is not, so it loads again the first time you open the account's models.

To export one model, open it with **Edit model** and click its **Export** button (the upload icon). To export everything, open **More actions** and choose **Export all accounts**. Marinara reminds you that the file has no keys before the download starts.

One model downloads as a `.connection.json` file. Several download together as a `marinara-connections.zip` file.

To import, open **More actions** and choose **Import account**. Drop one or more `.json` files onto the window, or click to browse for them. Each imported account has an empty key until you fill it in.

## Related guides

- [Connecting to an AI Provider](connecting-to-a-provider.md)
- [Chat Settings Overview](../chats/chat-settings.md)
