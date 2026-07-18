# Connecting a Local or Self-Hosted Model

This guide shows you how to connect Guksu Motor to an AI model that runs on your own computer or your own server. It covers popular local model servers like Ollama, LM Studio, and KoboldCpp, plus the settings that make them work.

## What self-hosted means

A self-hosted model is an AI model that runs on hardware you control. You install a local model server, that server loads a model, and the server answers requests at a web address on your machine. Guksu Motor then talks to that address instead of a paid cloud service.

Common local model servers include Ollama, LM Studio, and KoboldCpp. Each one runs on your computer and gives you a private endpoint. An endpoint is the web address where the server listens for requests.

This guide is about external local servers that you install and run yourself. Guksu also ships its own small built-in model that needs no separate server. If you want that instead, see the [Local Model Setup](local-model.md) guide.

Before you start, make sure your local model server is already installed, running, and has a model loaded. Guksu does not start that server for you. It only connects to it.

## Set up a Custom connection

Guksu connects to local servers through the **Custom (OAI-Compatible)** provider. OAI-compatible means the server speaks the same request format as the OpenAI Chat Completions API. Ollama, LM Studio, and KoboldCpp all offer this format.

Follow these steps to create the connection.

1. Open the **Connections** panel from the right side of the app.
2. Click the **New** button (the plus icon). The **Create Connection** modal opens.
3. Type a name in the **Name** field, for example `Ollama Local`.
4. Choose **Custom (OAI-Compatible)** from the provider grid.
5. Click **Create**. The connection editor opens for your new connection.
6. Find the **Base URL** field. Enter the address of your local server (see the table below).
7. Leave the **API Key** field empty. Most local servers do not need a key.
8. Choose a model. Click **Fetch Models from API** to load the list your server reports, then pick one. You can also type a model ID by hand.
9. Click **Save**.

You should now see the connection saved in the **Connections** panel. Test it before you use it in a chat. See the "Test your connection" section below.

The **API Key** field is optional for local servers. For the **Custom (OAI-Compatible)** provider, the editor shows a reminder under this field. It says you can leave the key empty for local models such as Ollama, LM Studio, and KoboldCpp. Just set the Base URL instead.

## Base URLs for common local servers

The **Base URL** tells Guksu where your local server listens. Each server has a default address and port. A port is the numbered channel a server uses on your machine. Use the address for the server you run.

| Local server | Base URL |
|---|---|
| Ollama | `http://localhost:11434/v1` |
| LM Studio | `http://localhost:1234/v1` |
| KoboldCpp | `http://localhost:5001/v1` |

Here `localhost` means "this same computer." If Guksu runs on the same computer as your model server, these addresses work as written.

The **Base URL** field shows a safety warning: "Only use URLs from providers you trust. A malicious endpoint could intercept your messages and API keys." Only enter an address you set up yourself or fully trust.

### Windows firewall note

On Windows, a local server can be blocked even when it is running. The editor shows this note for the **Custom (OAI-Compatible)** provider: if your proxy or local server is not detected, Windows Defender Firewall may be blocking the connection. To fix it, open Windows Security, then Firewall and network protection, then Allow an app through firewall, and add Node.js or your server application.

## The Treat as local/custom endpoint toggle

The connection editor has a **Local / Custom Endpoint** section with a toggle labeled **Treat as local/custom endpoint**. It is off by default. Turn it on for self-hosted or proxied endpoints, especially a custom web address that points at a model server on your local network.

When this toggle is off, Guksu plays it safe with tool calls for models it does not recognize. Turning the toggle on tells Guksu to always attempt tool calls. It also tells Professor Mari to use a backup tool method (a JSON tool protocol) instead of native tool calls only. Professor Mari is the in-app assistant.

Turn this toggle on if Professor Mari stops after using a tool. Turn it on too if your endpoint claims OpenAI compatibility but does not reliably support tool calls. If your local model works fine without it, you can leave it off.

## Reaching a server on another computer

Guksu always allows connections to your own computer. Addresses like `localhost` and `127.0.0.1` are called loopback addresses, meaning "this same machine." These always work for a connection, with no extra setup.

If your model server runs on a different computer on your home or office network, that is a private network address. Guksu blocks private network addresses by default for safety. To allow them, the person who runs the Guksu server must set an environment variable. An environment variable is a setting the server reads when it starts.

Add this line to the server `.env` file:

```
PROVIDER_LOCAL_URLS_ENABLED=true
```

Save the file and restart the Guksu server for the change to take effect. After that, you can use a Base URL that points at another machine on your network, such as `http://192.168.1.50:11434/v1`.

On Android, this setting is turned on by default when you do not set it. For more about the `.env` file and server settings, see the [Server Configuration Reference](../CONFIGURATION.md).

## Test your connection

The connection editor has a **Connection Tests** card at the bottom. Use it before you rely on the connection in a chat.

1. Click your connection in the **Connections** panel. The connection editor opens.
2. Click **Test Connection**. This checks that your Base URL and setup are reachable and reports how long it took.
3. Pick a model if you have not yet.
4. Click **Send Test Message**. This sends the word "hi" to your chosen model and shows the reply.

If both tests succeed, your local model is ready to use in a chat. Open a chat, open its settings, and pick this connection.

If a test fails, first check that your local server is still running and that the model is loaded. Then check that the **Base URL** matches the server's address and port exactly. For a server on another computer, confirm that `PROVIDER_LOCAL_URLS_ENABLED` is set and that you restarted the Guksu server.

## Related guides

- [Connecting to an AI Provider](connecting-to-a-provider.md)
- [Local Model Setup](local-model.md)
- [Server Configuration Reference](../CONFIGURATION.md)
