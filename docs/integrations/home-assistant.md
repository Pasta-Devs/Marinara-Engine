# Home Assistant Integration

This integration lets your AI characters control real smart home devices from a chat, such as lights, climate, covers and media players. It also lets Home Assistant automations send messages into Marinara Engine. Home Assistant is a free, open source platform for smart home devices. If you do not run it, you do not need this guide.

## What the integration adds

The integration is a small piece of software that installs inside Home Assistant and links it to your Marinara server. On first setup it creates the following for you. You never copy tool addresses or set up tools by hand.

- Smart home tools in the **Functions** section of the Presets panel. See [Custom Tools](../extending/custom-tools.md).
- One agent named **Home Assistant**, an AI helper that runs alongside your chat. See [Agents Overview](../agents/agents-overview.md).
- Home Assistant entities (devices, sensors and controls) so you can watch and control Marinara from Home Assistant.

## Before you start

- Home Assistant version 2024.1.0 or newer.
- HACS installed in Home Assistant. HACS is the Home Assistant Community Store, a tool for installing custom integrations.
- Marinara running and reachable from the Home Assistant machine. The default address is `localhost:7860`.
- `WEBHOOK_LOCAL_URLS_ENABLED=true` in Marinara's `.env` file.

The `.env` file is the plain text settings file for the Marinara server. See [Server Configuration](../CONFIGURATION.md) for where it is. The integration uses a webhook, a web address that lets one app send data to another. Home Assistant's webhook is a local, plain `http` address, and Marinara blocks those by default for safety. This setting allows them. Add this line and save. It takes effect without a restart, usually within seconds (up to about 30 seconds):

```text
WEBHOOK_LOCAL_URLS_ENABLED=true
```

### If Home Assistant runs on a different device

The integration connects without a username or password, and the setup form has no place to enter one.

- Same machine: the connection works out of the box.
- Different device: Marinara blocks it by default. Add that device's IP address (its number address on your network) to `IP_ALLOWLIST` in `.env`. On a fully trusted home network you can set `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true` instead.
- If Marinara uses `BASIC_AUTH_USER` and `BASIC_AUTH_PASS` (the login), the integration cannot sign in. It then works only from the same machine or a device in `IP_ALLOWLIST`.

See [Remote Access](../REMOTE_ACCESS.md) for which option to pick.

## Install the integration

### Add it to HACS

1. In Home Assistant, open **HACS**.
2. Open the three-dot menu and click **Custom repositories**.
3. In the repository box, enter `https://github.com/Pasta-Devs/Marinara-Engine`.
4. Set the category to **Integration** and click **Add**.
5. Search for **Marinara Engine** and install it.
6. Restart Home Assistant.

### Set it up

1. Go to **Settings → Devices & Services** and click **Add Integration**.
2. Search for **Marinara Engine**.
3. Enter the **Host** and **Port** where Marinara runs. The defaults are `localhost` and `7860`.
4. Click **Submit**.

If it did not work: Home Assistant shows an error when it cannot reach Marinara. See [Troubleshooting](#troubleshooting).

On success the integration registers a private webhook in Home Assistant, creates the tools in Marinara's **Functions** section pointed at that webhook, creates the **Home Assistant** agent listing every enabled tool, and creates the entities described below.

## Add the agent to a chat

Creating the agent does not attach it to every chat. Add it to each chat where you want smart home control.

1. Open the chat and click **Chat Settings**.
2. Open the **Agents** section.
3. Add the **Home Assistant** agent.

It works in Roleplay, Conversation and Game chats. Once added, the tools are available to the AI in that chat. Nothing else needs turning on.

### Check that it works

1. In that chat, type a plain request, for example `Turn on the office lights`, and send it.
2. The AI should call a tool such as `ha_turn_on`, the lights should turn on, and the AI confirms.

If nothing happens, check that `WEBHOOK_LOCAL_URLS_ENABLED=true` is set, and see [Troubleshooting](#troubleshooting).

## Choose which tools the AI may use

The tools are in eight categories. To choose which Marinara may use, open **Settings → Devices & Services**, click **Marinara Engine**, then **Configure**. It has two options:

- **Primary Chat**: the default chat that the Home Assistant services target.
- **Exposed Tool Categories**: the categories Marinara may use.

| Category | Default | Tools |
| --- | --- | --- |
| Lights & Switches | On | ha_turn_on, ha_turn_off, ha_toggle, ha_set_brightness, ha_set_color, ha_set_color_temp |
| Climate | On | ha_set_temperature, ha_set_hvac_mode |
| Covers (Blinds & Garage) | On | ha_open_cover, ha_close_cover, ha_set_cover_position |
| Locks | Off | ha_lock, ha_unlock |
| Media Players | On | ha_media_play, ha_media_pause, ha_set_volume |
| Scenes & Scripts | On | ha_activate_scene, ha_run_script |
| Query | On | ha_get_state, ha_list_areas, ha_list_entities, ha_notify |
| Generic Service Calls (Advanced) | Off | ha_call_service |

> **Warning:** **Generic Service Calls (Advanced)** lets the AI call any Home Assistant service. **Locks** lets it lock and unlock doors. Both are off by default. Turn them on only if you want them.

Most tools accept one device or a room name. With a room name, the tool acts on every matching device in that room. Category changes take effect after you press **Marinara Sync HA Tools** or restart Home Assistant.

## Entities in Home Assistant

The integration creates these entities under a device named **Marinara Engine**.

| Entity | Type | What it does |
| --- | --- | --- |
| Marinara Chat Count | Sensor | Total number of Marinara chats |
| Marinara Active Agent Count | Sensor | How many Marinara agents are enabled |
| Marinara Active Chat | Select | Picks which chat the services target |
| Marinara Agent: (name) | Switch | Turns one agent on or off, one switch per agent |
| Marinara Abort Generation | Button | Cancels any AI response being generated |
| Marinara Sync HA Tools | Button | Re-sends all tools and rebuilds the Home Assistant agent |

The integration checks Marinara for new chats and agents every 30 seconds, so something you just made may take up to 30 seconds to appear.

### Sync after you change settings

Press **Marinara Sync HA Tools** on the **Marinara Engine** device page. It updates existing tools in place, rebuilds the **Home Assistant** agent if you deleted it, and disables (does not delete) tools whose category you turned off. Do not hand-edit the Home Assistant tools in Marinara. The next sync overwrites your edits and turns the tools back on.

## Control Marinara from automations

The integration adds two Home Assistant services for automations. They run inside Home Assistant, not Marinara. Both target your **Primary Chat** by default.

### Send Message (marinara_engine.send_message)

- `message`: the message text. Required.
- `chat_id`: which chat to send to. Blank uses the Primary Chat.
- `role`: `user`, `assistant`, `system` or `narrator`. The default is `user`.
- `trigger_generation`: when true, the AI also replies. The default is false.

This automation tells the AI when the front door opens:

```yaml
automation:
  trigger:
    platform: state
    entity_id: binary_sensor.front_door
    to: "on"
  action:
    service: marinara_engine.send_message
    data:
      message: "Someone has arrived at the front door."
      trigger_generation: true
```

### Trigger Generation (marinara_engine.trigger_generation)

This starts an AI reply without a visible message.

- `chat_id`: which chat. Blank uses the Primary Chat.
- `user_message`: an optional message to include with the reply turn.

## Troubleshooting

### The setup form says it cannot connect

Make sure Marinara is running and that **Host** and **Port** match where it listens (default `localhost` and `7860`). If Home Assistant is on a different device, Marinara blocks it unless the device is in `IP_ALLOWLIST`. The integration cannot send a password, so a login-protected Marinara also rejects it. See [Remote Access](../REMOTE_ACCESS.md). These rules still apply after setup. If Marinara later blocks the device, the sensors and chat list quietly stop updating.

### The AI tries a device tool but nothing happens

The webhook call is probably blocked. Add `WEBHOOK_LOCAL_URLS_ENABLED=true` to `.env` and save. Without it, tool calls can fail with a message about `http` not being allowed or a private address being refused. If Marinara and Home Assistant are on the same machine, the integration uses the internal address automatically. If Marinara is on a different device, make sure Home Assistant's local address is reachable from it.

### The tools do not appear in Functions

Press **Marinara Sync HA Tools**, or restart Home Assistant, then check **Functions** in the Presets panel.

### The Home Assistant agent is not in my chat

Check that the agent exists in Marinara under Agents. If not, press **Marinara Sync HA Tools** to rebuild it. Then add it in **Chat Settings → Agents**.

### Find the webhook address by hand

You rarely need it, since each tool already has the address. Open **Settings → Devices & Services → Marinara Engine** in Home Assistant. The webhook uses this pattern, where 8123 is the default Home Assistant port:

```text
http://<homeassistant-ip>:8123/api/webhook/<webhook-id>
```

## Uninstall

Delete the integration in **Settings → Devices & Services → Marinara Engine** in Home Assistant. This removes the entities. The tools in Marinara's **Functions** section and the **Home Assistant** agent stay. Delete them by hand in Marinara if you no longer want them.

## Related guides

- [Custom Tools](../extending/custom-tools.md)
- [Agents Overview](../agents/agents-overview.md)
- [Server Configuration](../CONFIGURATION.md)
- [Remote Access](../REMOTE_ACCESS.md)
