# Custom Tools And Function Calling

Custom tools let models call small functions from agents. They live in the **Functions** section of the Presets panel and can be attached to agents.

## Tool Types

- **Static Result** returns a fixed string.
- **Webhook** sends a POST request to an external URL.
- **Script** runs a server-side JavaScript expression. Script tools require `CUSTOM_TOOL_SCRIPT_ENABLED=true`.

Webhook tools reject private/LAN URLs by default. Set `WEBHOOK_LOCAL_URLS_ENABLED=true` only when you intentionally call local services such as Home Assistant.

## Parameters

Each tool can define JSON-style parameters with names, descriptions, and required flags. Write descriptions as instructions to the model: explain what the value means and when it should be supplied.

## Attaching Tools To Agents

Creating a tool does not make every model call see it. Open the relevant agent in the Agents panel and enable the tool in that agent's tool list. The model can only call tools exposed to the agent that is currently running.

## Built-In Web Search

Some connections expose built-in web search or function calling. Custom tools are separate: use them for your own webhooks, scripts, or fixed context snippets.

## Safety

Custom tool create/update/delete and reorder operations are privileged APIs. Remote browsers need `ADMIN_SECRET` saved in **Settings -> Advanced -> Admin Access**. Script tools can execute local server-side code, so only enable them on trusted installs.

