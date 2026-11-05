# Haptic Feedback Setup

Haptic feedback lets an AI character send touch cues to a connected haptic device (an intimate toy) during a chat. This guide shows how to install the helper app, add the **Haptic Feedback** agent to a chat, connect to your device and adjust the touch settings.

Marinara Engine does not talk to the device directly. It sends commands to a free companion app, **Intiface Central**, which talks to your device. Intiface Central speaks **Buttplug.io**, an open standard many toys and apps support. Marinara connects to it over a network address. Haptic feedback is a chat agent (an AI helper you add to a chat). It works in Conversation, Roleplay and Game modes.

## Before you start

1. Install **Intiface Central** from `https://intiface.com/central/`.
2. Open it and start its server with the server start button.
3. Pair your device inside Intiface Central so the app can see it.

Without Intiface Central running with its server started, Marinara cannot send touch cues. You also need the **Haptic Feedback** agent installed. See [Agents overview](../agents/agents-overview.md).

## Add the Haptic Feedback agent

1. Open a Conversation, Roleplay or Game chat.
2. Open **Chat Settings** and go to **Agents**.
3. Add the **Haptic Feedback** agent. A **Haptic Feedback** card appears in the **Agents** list.
4. Turn on the **Haptic Feedback** toggle at the top of the card.

The toggle is off by default. Off, the description reads "Allow this agent to send touch cues during the chat." On, it reads "Touch cues are enabled for this chat." With it on, the AI sends hidden touch cues while it writes. They do not show as chat text. They go to every connected device.

## Connect and scan

When you open the card, Marinara tries to connect to Intiface Central using the saved address. The status row shows a green dot when connected and a red dot when not. Next to it is **Connect** when you are offline and **Disconnect** when connected.

1. Click **Connect**. On success the row shows "Connected" with the server address.
2. Click **Scan for devices** to search again. The button reads "Scanning..." while it runs.

The card shows "No devices found" or the number of devices, and lists each with its exact Intiface name and supported actions. Marinara also gives the Haptic Agent that name, a toy type derived from its abilities and its actions, so it picks the right device and action instead of assuming every toy vibrates.

If it did not work: a failed connect shows a message asking you to make sure Intiface Central is running and its server is started, with a link to its website.

## Supported actions and patterns

Marinara uses every output type Intiface reports for a device: vibration, rotation, oscillation, constriction, inflation, linear position, temperature, spray and lighting. Linear position controls stroking, thrusting or pumping devices. Inflation controls air-pressure pumping devices.

The agent can apply **Steady**, **Tap**, **Pulse**, **Wave**, **Ramp** or **Impact** patterns to any non-stop action. Positional patterns alternate real movement targets, so a pumping or stroking pattern runs over time instead of sending several movements at once.

## The Intiface URL field

**Intiface URL** is the WebSocket address of your Intiface Central server. A WebSocket address is a link the two apps use to talk. The default is:

```text
ws://127.0.0.1:12345
```

`127.0.0.1` means this same computer. If you leave the field blank, Marinara uses the server default, which you can change with the `INTIFACE_URL` environment variable in `.env`. See the [Server Configuration Reference](../CONFIGURATION.md). Marinara saves your address with the chat and remembers it in this browser, so other chats you open here start with it.

The address stays on this Marinara install. Chat exports, exported settings profiles and **Export Profile** files leave it out, and importing any of them never sets it. Enter it again after you move a chat to another install.

If you run Marinara in Docker, or open it in a browser on a different device, `127.0.0.1` will not reach Intiface Central. Enter the address of the computer that runs it, replacing the numbers with its real address:

```text
ws://192.168.1.50:12345
```

## Touch sensitivity

The card shows a **Touch sensitivity** control in every chat mode. It guides how readily the agent picks gentle or strong output. It is not a ceiling: every choice can use the full `0.0-1.0` intensity range when the action calls for it. Marinara validates every command against Intiface's physical range.

| Choice | Feel |
| --- | --- |
| **Subtle** | Favors gentler feedback. |
| **Standard** | Balanced feedback for most scenes. This is the default. |
| **Intense** | Chooses stronger feedback more readily. |

## Incidental contact

The **Incidental contact** toggle ("Tiny taps for accidental brushes and bumps.") is off by default. Off, the AI ignores small accidental touches and sends cues only for deliberate or firm contact. Turn it on to get small taps for brushes and bumps too.

## Use it from another device

By default, Marinara accepts haptic commands only from the computer that runs the Marinara server. This keeps device control private. So haptic feedback does not work when you open Marinara from a phone or another device that reaches a server elsewhere. Connect, scan and command actions are refused.

To allow it, turn on the server setting `HAPTICS_ALLOW_REMOTE`, and set up access protection, a login or an admin secret. See the [Server Configuration Reference](../CONFIGURATION.md) and the [Remote Access guide](../REMOTE_ACCESS.md). You enter admin access in **Settings → Advanced → Admin Access**.

## If something is not working

If the AI never triggers your device, check in order:

1. Intiface Central is open and its server is started.
2. Your device is paired and shows in the list after **Scan for devices**.
3. The status dot is green and the **Haptic Feedback** toggle is on.
4. If you are on a phone or remote device, see [Use it from another device](#use-it-from-another-device).

When Intiface Central is not connected, or no device is attached, Marinara skips the cue quietly and shows no error in the chat.

## Related guides

- [Agents: AI Helpers for Your Chats](../agents/agents-overview.md)
- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Remote Access: Login and IP Allowlist](../REMOTE_ACCESS.md)
