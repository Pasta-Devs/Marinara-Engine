# Connecting a Local or Self-Hosted Model

This guide connects Marinara Engine to an AI model that runs on your own computer or server, through a program such as Ollama, LM Studio, KoboldCpp, or llama.cpp. For the small model Marinara runs by itself, with no separate server, see [Built-in Model Setup](local-model.md).

## Set up a Custom connection

In the app, this kind of account is called **OpenAI-compatible**. It means the server accepts the same request format as the OpenAI chat API. Ollama, LM Studio, KoboldCpp, and llama.cpp all do.

Before you start, install a model server, start it, and load a model in it. For example, download Ollama from `ollama.com` and follow its steps to pull a model. Marinara connects to the server and does not start it for you. The server answers requests at a web address on your computer, called an endpoint.

1. Click **Connections** in the top bar, then click **Add**. The **Add account** window opens.
2. Under **Chat**, click your server: **Ollama**, **LM Studio**, **KoboldCpp**, or **llama.cpp**. These tiles have the tag **Self-hosted**. For any other server, click **OpenAI-compatible address**.
3. Check **Server address**. For the four named servers it is filled in. For another server, type its address. See the table below.
4. Leave **API key (optional)** empty. Most local servers need no key. To name the account, type a **Name (optional)**.
5. Click **Connect**. Marinara tests the address. **Connected** means it reached the server.
6. What happens next depends on whether you already have a Main model. If you do not, or you opened Add from a new chat, the window shows the models your server reports. Pick one, or type a model ID in **Search or enter model ID…**, then click **Done**. If you already have a Main model, the window closes and a message says the account was added. Then click **⋯** on the account and choose **Add model**.

The panel now shows the account. Test it before you rely on it (see [Test the connection](#test-the-connection)).

If it did not work:

- **Marinara could not reach** the address. Check that the server is running and that the address and port match. **Continue anyway** saves the account without a passing test.
- The address is on another computer. See [Reach a server on another computer](#reach-a-server-on-another-computer).

## Addresses of common local servers

A port is the numbered channel a server uses on your computer. `localhost` means this same computer, so these addresses work as written when Marinara and the server run on one computer.

| Server | Address |
| --- | --- |
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |
| llama.cpp | `http://localhost:8080/v1` |

In **Edit model**, the address field warns: "Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys." Enter only an address you set up yourself or fully trust.

On Windows, a running server can still be blocked. If Marinara does not detect it, Windows Defender Firewall may be blocking it. Open **Windows Security → Firewall & network protection → Allow an app through firewall**, and add Node.js or your server program.

## Test the connection

**Connect** already checked the address. The model editor has a **Provider tests** card for a second check.

1. Click your model in the **Connections** panel. The model editor opens.
2. Click **Test provider**. It checks that the address is reachable and shows how long it took.
3. Pick a model if you have not yet, then click **Send test message**. It sends a short message and shows the reply.

If both pass, open a chat and pick the account in **Model for this chat**. See [Choosing a model for one chat](connecting-to-a-provider.md#choosing-a-model-for-one-chat).

If a test fails, check that the server is running with a model loaded, and that the address and port match exactly. For a server on another computer, check the steps below.

## Reach a server on another computer

Addresses such as `localhost` and `127.0.0.1` always work. If your model server is on another computer on your network, Marinara blocks that private address by default. The person who runs the Marinara server can allow it with an environment variable, a setting the server reads when it starts.

1. Open the server's `.env` file. On a normal install it is in the Marinara project folder. For Docker and Podman, see [Server Configuration Reference](../CONFIGURATION.md#edit-the-env-file).
2. Add this line:

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

3. Save the file and restart the Marinara server.
4. Use the other computer's address, such as `http://192.168.1.50:11434/v1`.

On Android, this setting is on by default when you do not set it.

## Use the model for decisions

The same model can answer decision questions, such as agent activation checks, without loading a second copy. Click **⋯** on the model in the panel and choose **Use this model for decisions**. It shows for an OpenAI-compatible model that has a model name. See [Decision Models](decision-models.md#on-a-server-you-already-run).

## Treat as local/custom endpoint

In **Edit model**, a toggle named **Treat as local/custom endpoint** sits under **Local / custom endpoint**. It is off by default. It shows only for older models that are not tied to an account. Models you add now never show it.

Turn it on for a proxy or self-hosted server that is not a known service. It makes Marinara always attempt tool calls, and it lets Professor Mari use a backup tool method (a JSON tool protocol) in place of native tool calls only. Turn it on if Professor Mari stops after using a tool, or if your server claims OpenAI compatibility but does not handle tool calls well. If your model works without it, leave it off.

## Related guides

- [Connecting to an AI Provider](connecting-to-a-provider.md)
- [Built-in Model Setup](local-model.md)
- [Decision Models](decision-models.md)
- [Server Configuration Reference](../CONFIGURATION.md)
