# Custom Tools and Function Calling

This guide explains custom tools, also called Functions, in Marinara Engine. A custom tool teaches the AI to run a small action during a chat. It can return a fixed piece of text, call an outside web address, or run a short script on the server. You will learn how to build one, turn tool use on for a chat, and keep script tools safe.

## What function calling is

Function calling lets the AI ask the app to run an action and then use the result in its reply. The app already ships built-in tools, such as dice rolls, lorebook search, and game state updates. Custom tools sit next to those built-in tools in the same **Function Calling** system.

You might want a custom tool to do things like these:

- Return a fixed fact, such as your store hours or a set of house rules.
- Ask an outside service for live data, such as the weather or a smart-home device.
- Do a quick calculation, such as adding numbers or rolling a custom result.

A custom tool is not attached to a character card. Instead, you turn it on for a chat, or you attach it to an agent. An agent is a helper that runs alongside your chat. Both paths are covered below.

## The Functions section

You create and manage custom tools in the **Presets** panel.

1. Open the top bar and click **Presets**.
2. Find the **Functions** section (its icon is a wrench).
3. Under the header you will see the caption **Custom function calls available from Chat Settings**.

The section header has three icon buttons:

- **Create function** (plus icon) opens a blank tool editor.
- **Import functions from ZIP or JSON** (download icon) opens a file picker.
- **Export functions to ZIP** (upload icon) saves all your tools to one file. It is greyed out when you have no tools.

Each tool in the list shows its name and two small pills (the type and the parameter count). It also shows a short description, an on/off switch, an **Edit function** button, and a **Delete function** button. A **Script** tool also shows an amber **Script disabled** pill when script tools are turned off on the server. The Execution type: Script section below explains how to turn them on. You can drag a tool by its handle to reorder the list. Order is only for display and does not change behavior. When you have no tools yet, the list reads **No functions yet**.

Managing tools (create, edit, delete, reorder, and the on/off switch) uses a protected part of the app. If you manage tools from another device instead of the computer running the server, you must first save an admin secret. See the [Server Configuration Reference](../CONFIGURATION.md) and the note under Script safety below.

## Creating a tool

Follow these steps to build a tool.

1. In the **Functions** section, click **Create function**. The full tool editor opens.
2. In the name field at the top, type a name in lowercase snake_case. This is the exact name the AI uses to call the tool. A valid name starts with a lowercase letter, then uses only lowercase letters, numbers, and underscores. Example: `check_weather`.
3. Fill in the **Description** field. Write it as an instruction to the AI, because the AI reads it to decide when to call the tool. Example: `Get the current weather for a city the user names.`
4. Add any **Parameters** the tool needs (see the next section).
5. Pick an **Execution Type**: **Static Result**, **Webhook**, or **Script**.
6. Fill in the field for the type you picked.
7. Click **Save**. You should see a green **Saved** flash near the button.

A few rules to know:

- The name must be 1 to 100 characters. The description must be 1 to 500 characters.
- Two tools cannot share a name. You also cannot use a built-in tool name (see Reserved names below).
- If you leave the editor with unsaved changes, a banner offers **Keep editing**, **Discard**, or **Save & close**.

## The Parameters builder

Parameters are the inputs the AI passes when it calls your tool. Each parameter has a name, a type, a required flag, and a description.

1. In the **Parameters** group, click **Add Parameter**.
2. Type a parameter name, such as `city`.
3. Pick a type from the dropdown: `string`, `number`, `boolean`, `array`, or `object`.
4. Turn on **Required** if the AI must always send this value.
5. Write a description that tells the AI what the value means. Example: `The city name to look up, such as Tokyo.`

You can add more rows with **Add Parameter**, or remove a row with its minus button. A row left with an empty name is dropped when you save. Good parameter descriptions matter, because they are how the AI learns what to send.

If a tool never seems to get called, a broken parameter setup is a common cause. This mostly happens when you import a tool from a hand-edited file with an invalid parameter setup. In that case the app quietly skips the tool during generation and only writes a note to the server log.

## Execution type: Static Result

A **Static Result** tool returns a fixed piece of text every time the AI calls it. It needs no outside service and works right away for anyone. Its card reads **Returns a fixed string when called.**

The one field is **Static Result**, a multi-line box. Whatever you type is returned to the AI when it calls the tool. If you leave it empty, the tool returns `OK`.

Worked example. Make a tool named `store_hours` with an empty parameter list. In the **Static Result** box, type this:

```
We are open Monday to Friday, 9am to 5pm. We are closed on weekends.
```

Now, when the AI calls `store_hours`, it receives that text back and can tell the user your hours. The AI sees your text together with the tool name and any arguments it sent, not the raw line by itself.

## Execution type: Webhook

A **Webhook** tool sends your tool call to an outside web address and returns that service's reply to the AI. A webhook is a web address that accepts data and sends data back. Its card reads **Sends a POST request to an external URL.**

The one field is **Webhook URL**. The app sends a POST request to that address. A POST request is a way to send data to a web service. The request body is JSON, a plain text format for structured data, shaped like this:

```
{ "tool": "your_tool_name", "arguments": { ... } }
```

The service should reply with JSON or plain text. That reply is returned to the AI.

Worked example. Make a tool named `check_weather` with one required string parameter named `city`. Set the **Webhook URL** field to your own service address:

```
https://api.example.com/weather
```

When the AI calls `check_weather` with `city` set to Tokyo, your service receives the request, looks up the weather, and replies. The AI then uses that reply in its message.

Things to know about webhooks:

- The reply is capped at 512 KB.
- Each call has a time limit set by the server. The default is 60 seconds.
- By default only `https://` addresses are allowed. Private and local addresses, such as `localhost` or a home network address, are blocked. A server admin must turn on a setting to allow local addresses. See the [Server Configuration Reference](../CONFIGURATION.md).
- If the call fails or times out, the AI receives an error result instead of crashing the chat.

## Execution type: Script

A **Script** tool runs a short piece of JavaScript on the server and returns the result. JavaScript is a common programming language. Its card reads **Runs a JavaScript expression server-side.**

Script tools are turned off by default for safety. If your server has not turned them on, the **Script** card is greyed out and a warning appears. To turn scripts on, the server admin sets this line in the server's `.env` file and restarts the app:

```
CUSTOM_TOOL_SCRIPT_ENABLED=true
```

The one field is **Script Body**. Your script can read `args` (the values the AI sent) and must `return` a result. You also have access to `JSON`, `Math`, and `Date`.

Worked example. Make a tool named `add_numbers` with two required number parameters named `x` and `y`. In the **Script Body** box, type this:

```
const result = args.x + args.y;
return { sum: result };
```

When the AI calls `add_numbers` with `x` set to 2 and `y` set to 3, the tool returns a sum of 5. If your script throws an error, the AI receives an error result instead of a crash. Read the Script safety section below before you turn scripts on.

## Include hidden chat context

Both **Webhook** and **Script** tools can receive a hidden context object. This is extra chat data that the AI does not see as tool inputs. Turn on the switch labeled **Include hidden chat context** in the tool editor. The default is off.

When it is on, your webhook or script receives a `context` value alongside the arguments. It can include the chat mode, the active persona name, and the character names in the chat. It can also include saved chat variables and, in Game Mode, the game state. This lets your tool personalize its result without the AI having to pass all that data itself.

## Turning on tool use for a chat

Creating a tool does not make the AI use it. You must also turn tool use on for the chat.

1. Open a chat and click the gear to open **Chat Settings**.
2. Open the **Function Calling** section (its icon is a wrench).
3. Turn on **Enable Tool Use**. Its description reads **Allow AI to call functions (dice rolls, game state, etc.)**. It is off by default for a new chat.

With **Enable Tool Use** on and no tools added below, the chat can use all globally enabled tools. That means the built-in tools, like dice rolls and lorebook search, plus every custom tool you have switched on in the **Functions** section. To limit a chat to a chosen set, add specific tools:

1. Click **Add Functions**. A picker opens with a search box.
2. Check the tools you want. The list mixes built-in tools and your own custom tools.
3. Click **Add Selected** to add them.

Once you add one or more tools, only those tools work in that chat. You can also click **New Custom Function** in the picker to jump straight to the tool editor. The picker's search box matches tool names only, not descriptions.

## Attaching tools to an agent

You can also give a tool to an agent instead of a chat. An agent is a semi-autonomous helper, such as a lorebook keeper or a music picker, that runs during generation.

1. Open the **Agents** panel and open an agent.
2. Open its **Tools / Function Calling** group.
3. Turn on the tools you want that agent to use.

Even with an agent set up, you still turn on **Enable Tool Use** in the chat's **Function Calling** section. One note on wording. The agent editor's footer text says to enable "Enable Function Calling". The actual switch you click is labeled **Enable Tool Use**. They mean the same control. For a deeper walkthrough of agents, see [Creating Custom Agents](../agents/custom-agents.md).

## Script safety

A **Script** tool runs real code on your server, so treat it with care. The app runs each script in a sandbox. A sandbox is a walled-off area that limits what the code can do. The limits are:

- No network access. A script cannot call the internet or any web address.
- No file access. A script cannot read or write files on the server.
- No access to environment variables or server secrets.
- A time limit. A long-running script is stopped. The default limit is 60 seconds.

This protects against accidents and blocks network and file access. It is not full operating-system isolation. Someone who can create tools could still write a script that wastes server CPU or memory. Only turn on script tools on servers you trust. Be careful when you import script tools written by other people.

Managing tools from another device is also protected. If you are not on the computer running the server, save an admin secret under **Settings**, then **Advanced**, then **Admin Access**. This secret must match the server's setting. See the [Server Configuration Reference](../CONFIGURATION.md) for the server side.

## Exporting and importing

You can move tools between installs.

- To export one tool, open it and click **Export function**. This saves a `.json` file.
- To export every tool, click **Export functions to ZIP** in the **Functions** section.
- To import, click **Import functions from ZIP or JSON** and pick a `.json` or `.zip` file. A message reports how many tools imported.

Imported webhook tools are always saved with the tool disabled and **Include hidden chat context** off, even if the file asks for either permission. After the import, Marinara shows the webhook's destination origin and the permissions the file requested. Open each imported webhook, inspect its complete URL and hidden-context setting, then turn it on only if you trust the destination. Static and Script tools keep their imported enabled state.

An import skips any tool whose name clashes with an existing tool or a built-in tool name. Agent packages do not bundle or import custom tools: export trusted functions separately, review them in **Function Calls**, and explicitly attach them after importing the agent.

## Reserved names

Your custom tool name cannot match a built-in tool name. Built-in names include `roll_dice`, `update_game_state`, `set_expression`, `trigger_event`, `search_lorebook`, `web_search`, and `update_about_me`, among others. If you try to save one, you get this message:

```
"your_name" is a reserved built-in tool name.
```

Two custom tools also cannot share a name. Reusing a name shows a message that a tool with that name already exists.

## Troubleshooting

The AI never calls my tool.

- Confirm **Enable Tool Use** is on in the chat's **Function Calling** section.
- If you added specific tools to the chat, confirm your tool is in that list.
- Confirm the tool's on/off switch in the **Functions** section is on.
- Make your **Description** and parameter descriptions clearer, so the AI knows when to call the tool.
- If you imported the tool, a broken parameter setup can make the app skip it. Rebuild the parameters by hand.

The Script card is greyed out.

- Scripts are off on this server. Ask the admin to set `CUSTOM_TOOL_SCRIPT_ENABLED=true` and restart. See the [Server Configuration Reference](../CONFIGURATION.md).

My webhook fails or times out.

- Confirm the address starts with `https://` and is reachable.
- A local address is blocked unless the admin allows local addresses. See the [Server Configuration Reference](../CONFIGURATION.md).
- Slow services can hit the 60 second time limit.

I cannot create or edit tools from my phone or another device.

- Save a matching admin secret under **Settings**, then **Advanced**, then **Admin Access**.

## Related guides

- [Creating Custom Agents](../agents/custom-agents.md)
- [Home Assistant Integration](../integrations/home-assistant.md)
- [Server Configuration Reference](../CONFIGURATION.md)
