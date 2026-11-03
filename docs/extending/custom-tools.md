# Custom Tools and Function Calling

A custom tool (also called a function) lets the AI run a small action during a chat. The action can return a fixed piece of text, call a web address, or run a short script on the server. Use one when you want the AI to look something up or calculate something instead of guessing.

Function calling means the AI asks the app to run an action and then uses the result in its reply. Marinara already ships built-in tools such as dice rolls, lorebook search and game state updates. Your custom tools work next to them. A custom tool is not attached to a character card. You turn it on for a chat, or attach it to an agent (a helper that runs alongside your chat).

> **Note:** Tools need a connection that supports them. Claude and Grok subscription connections ignore tool definitions, so **Chat Settings** shows a notice and disables the tool controls for them. Text commands and dice tags still work.

## Create a tool

Before you start, open the **Presets** panel from the top bar. Tools live in its **Functions** section (wrench icon). If you open Marinara from another device, save the admin secret first under **Settings → Advanced → Admin Access**. It must match the server's `ADMIN_SECRET`; see the [Server Configuration Reference](../CONFIGURATION.md).

For a first try, pick **Static Result**: it needs nothing else.

### Creating a tool

1. Open **Presets** and find **Functions**.
2. Click **Create function** (plus icon). A blank tool editor opens.
3. Type a name in lowercase snake_case, such as `check_weather`. This is the exact name the AI calls. It starts with a lowercase letter, then uses lowercase letters, numbers and underscores.
4. Fill in **Description**. Write it as an instruction to the AI, because the AI reads it to decide when to call the tool. Example: `Get the current weather for a city the user names.`
5. Add any parameters the tool needs (see [Add parameters](#add-parameters)).
6. Pick an **Execution Type**: **Static Result**, **Webhook** or **Script**.
7. Fill in the field for that type (see [Choose an execution type](#choose-an-execution-type)).
8. Click **Save**. A green **Saved** flash appears near the button.

Rules for names and descriptions:

- The name is 1 to 100 characters. The description is 1 to 500 characters.
- Two tools cannot share a name, and a tool cannot use a built-in name such as `roll_dice`, `update_game_state`, `set_expression`, `trigger_event`, `search_lorebook`, `web_search` or `update_about_me`. A clash shows a message such as `"your_name" is a reserved built-in tool name.`
- If you leave the editor with unsaved changes, a banner offers **Keep editing**, **Discard** or **Save & close**.

The **Functions** header has three icon buttons:

- **Create function** (plus icon)
- **Import functions from ZIP or JSON**
- **Export functions to ZIP** (greyed out when you have no tools)

Each tool in the list shows:

- its name, type, parameter count and description
- an on/off switch
- **Edit function** and **Delete Function**

Drag a tool by its handle to reorder the list. The order is for display only. With no tools, the list reads **No functions yet**.

## Add parameters

Parameters are the inputs the AI sends when it calls your tool. Each has a name, a type, a required flag and a description.

1. In the **Parameters** group, click **Add Parameter**.
2. Type a name, such as `city`.
3. Pick a type: `string`, `number`, `boolean`, `array` or `object`.
4. Turn on **Required** if the AI must always send this value.
5. Write a description that tells the AI what the value means, such as `The city name to look up, such as Tokyo.`

Add more rows with **Add Parameter**, or remove a row with its minus button. A row with an empty name is dropped when you save.

If the AI never seems to call an imported tool, its parameters may be invalid, and the app then skips the tool without telling you. Delete the parameters and add them again by hand.

## Choose an execution type

### Static Result

A **Static Result** tool returns the same text every time. It needs no outside service. Its card reads **Returns a fixed string when called.**

The one field is **Static Result**, a multi-line box. If you leave it empty, the tool returns `OK`.

Example: a tool named `store_hours` with no parameters and this **Static Result**:

```text
We are open Monday to Friday, 9am to 5pm. We are closed on weekends.
```

When the AI calls `store_hours`, it receives that text with the tool name and any arguments it sent, and can tell the user your hours.

### Webhook

A **Webhook** tool sends the call to a web address and returns that service's reply to the AI. A webhook is an address that accepts data and sends data back. Its card reads **Sends a POST request to an external URL.**

The one field is **Webhook URL**. The app sends a POST request, which is a way to send data to a web service. The body is JSON, a plain-text format for structured data, shaped like this:

```json
{ "tool": "your_tool_name", "arguments": { ... } }
```

If you turn on **Include hidden chat context**, the body also has a `context` value. The service replies with JSON or plain text, and that reply goes back to the AI.

Example: a tool named `check_weather` with one required string parameter `city`, and this **Webhook URL**:

```text
https://api.example.com/weather
```

When the AI calls it with `city` set to Tokyo, your service looks up the weather and replies, and the AI uses the reply in its message.

Limits:

- The reply is capped at 512 KB.
- Each call has a time limit. The default is 60 seconds (`CUSTOM_TOOL_TIMEOUT_MS`).
- Only `https://` addresses are allowed by default. Private and local addresses such as `localhost` or a home network address are blocked until a server admin allows them. See the [Server Configuration Reference](../CONFIGURATION.md).
- If the call fails or times out, the AI receives an error result and the chat keeps going.

If it did not work: check the address starts with `https://` and is reachable. A local address stays blocked unless the admin allows it. A slow service can hit the 60-second limit.

### Script

A **Script** tool runs a short piece of JavaScript on the server and returns the result. JavaScript is a common programming language. Its card reads **Runs a JavaScript expression server-side.**

Script tools are off by default. If your server has not turned them on, the **Script** card is greyed out and an amber **Script disabled** pill shows. To turn them on, the server admin adds this line to the server's `.env` file and restarts Marinara:

```text
CUSTOM_TOOL_SCRIPT_ENABLED=true
```

The one field is **Script Body**. The script reads `args` (the values the AI sent) and must `return` a result. `JSON`, `Math` and `Date` are available.

Example: a tool named `add_numbers` with two required number parameters `x` and `y`, and this **Script Body**:

```js
const result = args.x + args.y;
return { sum: result };
```

When the AI calls it with `x` set to 2 and `y` set to 3, the tool returns a sum of 5. If the script throws an error, the AI receives an error result.

A script runs real code on your server, inside a sandbox (a walled-off area that limits what code can do):

- No network access and no file access.
- No access to environment variables or server secrets.
- A time limit. The default is 60 seconds.

The sandbox is not full operating-system isolation. Someone who can create tools could still write a script that wastes CPU or memory. Turn script tools on only for servers you trust, and be careful with scripts written by other people.

If it did not work: when the **Script** card is greyed out, ask the admin to set `CUSTOM_TOOL_SCRIPT_ENABLED=true` and restart.

### Include hidden chat context

**Webhook** and **Script** tools can receive extra chat data that the AI does not see as tool inputs. Turn on **Include hidden chat context** in the tool editor (off by default). Your tool then receives a `context` value that can include:

- the chat mode
- the active persona name and the character names
- saved chat variables
- in Game Mode, the game state

This lets a tool personalize its result without the AI passing all that data.

## Turn on tools for a chat

Creating a tool does not make the AI use it. You also turn tool use on for the chat.

1. Open a chat, then open **Chat Settings**.
2. Open the **Function Calling** section (wrench icon).
3. Turn on **Enable Tool Use**. Its description reads **Allow AI to call functions (dice rolls, game state, etc.)**. It is off by default for a new chat.
4. Check it works: ask the AI something your tool answers, such as "What are your store hours?" for the `store_hours` example. The reply should use the tool's text.

With **Enable Tool Use** on and nothing added below it, the chat can use every globally enabled tool it supports: the built-in tools plus each custom tool whose switch is on in **Functions**. Game chats also need **Let the GM search lore** for `search_lorebook`.

To limit a chat to a chosen set:

1. Click **Add Functions**. A picker opens with a search box that matches tool names only.
2. Check the tools you want. The list mixes built-in and custom tools.
3. Click **Add Selected**.

Once you add any tools, only those tools work in that chat. **New Custom Function** in the picker jumps to the tool editor.

Game chats can use a separate connection for tool planning. See [Optional tool planning and lore searches](../game/getting-started.md#optional-tool-planning-and-lore-searches) for its cost and behavior.

If it did not work: confirm **Enable Tool Use** is on, the tool is in the chat's list if you added specific tools, and the tool's switch in **Functions** is on. A clearer **Description** and clearer parameter descriptions help the AI decide when to call it.

## Attach tools to an agent

You can also give a tool to an agent instead of a chat.

1. Open the **Agents** panel and open an agent.
2. Open its **Tools / Function Calling** group.
3. Turn on the tools that agent may use.

You still turn on **Enable Tool Use** in the chat's **Function Calling** section. The agent editor's footer reminds you of this. For agents in general, see [Creating Custom Agents](../agents/custom-agents.md).

## Export and import tools

- To export one tool, open it and click **Export function**. This saves a `.json` file.
- To export every tool, click **Export functions to ZIP**.
- To import, click **Import functions from ZIP or JSON** and pick a `.json` or `.zip` file. A message reports how many tools imported.

Imported webhook and script tools are always saved turned off, with **Include hidden chat context** off, even if the file asks for either. Marinara then shows the type, the webhook address and the permissions the file asked for. Open each imported tool, inspect it, and turn it on only if you trust it. Static tools keep their imported on/off state.

An import skips any tool whose name clashes with an existing or built-in tool. Agent packages do not bundle custom tools: export and review them separately, then attach them after you import the agent.

## Related guides

- [Creating Custom Agents](../agents/custom-agents.md)
- [Home Assistant Integration](../integrations/home-assistant.md)
- [Server Configuration Reference](../CONFIGURATION.md)
