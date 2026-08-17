# Haptic Feedback Setup

This guide shows you how to let an AI character control connected haptic devices in Marinara Engine. It covers installing the helper app, adding the **Haptic Feedback** agent to a chat, connecting to your device, and the touch settings you can adjust.

## What haptic feedback is

Haptic feedback lets an AI character send touch cues to a connected haptic device (an intimate toy) during a chat. Marinara Engine does not talk to the device directly. Instead, it sends commands to a free companion app called **Intiface Central**, and that app talks to your device.

**Intiface Central** speaks a device protocol called **Buttplug.io**. This is the same open standard that many toys and other apps support. You install **Intiface Central** once, pair your device with it, and Marinara connects to it over a local network address.

Haptic feedback is built as one of the chat **Agents**, the AI helpers you can add to a chat. It works in Conversation, Roleplay, and Game modes.

## Before you start

You need three things ready before you turn on haptic feedback.

1. Install **Intiface Central** from the official website. Open this address in your browser.

```
https://intiface.com/central/
```

2. Open **Intiface Central** and start its server. Look for the server start button inside the app.
3. Pair or connect your device inside **Intiface Central** so the app can see it.

If **Intiface Central** is not running with its server started, Marinara cannot send any touch cues.

## Add the Haptic Feedback agent

You add haptic feedback the same way you add any other agent, from the chat's settings.

1. Open a Conversation, Roleplay, or Game chat.
2. Open **Chat Settings** for that chat.
3. Go to the **Agents** section.
4. Add the **Haptic Feedback** agent to the chat.
5. Find the **Haptic Feedback** card that now appears in the **Agents** list.

Turn on the **Haptic Feedback** toggle at the top of the card. When it is off, the description reads "Allow this agent to send touch cues during the chat." When it is on, the description reads "Touch cues are enabled for this chat." The toggle is off by default.

Once the toggle is on, the AI can send hidden touch cues while it writes. These cues do not show up as text in the chat. They are sent to every connected device.

## Connect, scan, and find your device

When you open the **Haptic Feedback** card, Marinara tries to connect to **Intiface Central** automatically using the saved address. You can also connect by hand.

The card shows a status row with a colored dot. A green dot means connected. A red dot means not connected. Next to it is a button that reads **Connect** when you are offline and **Disconnect** when you are connected.

To connect by hand, click **Connect**. If it works, the row shows "Connected" with the server address.

If it fails, you see a message that says the app could not connect. It asks you to make sure **Intiface Central** is running and the server is started. The message includes a link to the **Intiface Central** website.

Once connected, the card shows how many devices are found. It reads "No devices found" when none are attached, or the number of devices when some are. Click **Scan for devices** to search again. The button reads "Scanning..." while a scan runs. The card lists each device with its exact Intiface name and the actions it supports. Marinara also gives that name, a capability-derived toy type, and the supported actions to the Haptic Agent so it can select the correct device and action instead of assuming every toy is a vibrator.

## Supported actions and patterns

Marinara uses every output type Intiface reports for a connected device: vibration, rotation, oscillation, constriction, inflation, linear position, temperature, spray, and lighting. Linear position controls stroking, thrusting, or pumping devices; inflation controls air-pressure pumping devices.

The Agent can apply **Steady**, **Tap**, **Pulse**, **Wave**, **Ramp**, or **Impact** patterns to any non-stop action. Positional patterns alternate real movement targets, so a pumping or stroking pattern is executed over time instead of sending several movements at once.

### The Intiface URL field

The **Intiface URL** field holds the network address of your **Intiface Central** server. This is a WebSocket address, which is just a local link the two apps use to talk. The default is shown below.

```
ws://127.0.0.1:12345
```

The address `127.0.0.1` means "this same computer". If you leave the field blank, Marinara uses the server default. Marinara also remembers your address in the browser, so it is reused across chats and devices.

If you run Marinara in Docker, or you open Marinara in a browser on a different device, `127.0.0.1` will not reach your **Intiface Central**. In that case, enter the address of the computer running **Intiface Central**. It looks like the example below, where you replace the numbers with that computer's real address.

```
ws://192.168.1.50:12345
```

## Touch sensitivity

The **Haptic Feedback** card shows a **Touch sensitivity** control with three choices in every chat mode. Sensitivity guides how readily the Agent selects gentle or strong output; it does not impose a hard ceiling. Every choice can use the full `0.0-1.0` device intensity range when the current action calls for it.

The three choices guide the Agent's response style.

| Choice | Feel | Notes |
|---|---|---|
| **Subtle** | Favors gentler feedback | Full range remains available |
| **Standard** | Balanced feedback for most scenes | The default; full range available |
| **Intense** | Chooses stronger feedback more readily | Can use full output |

**Standard** is selected by default. Pick the response style that feels right for your scene. Marinara still validates every command against Intiface's physical `0.0-1.0` range.

## Incidental contact

Below the sensitivity control, every chat mode also shows an **Incidental contact** toggle. It reads "Tiny taps for accidental brushes and bumps." This toggle is off by default.

When it is off, the AI ignores small accidental touches in the story. It only sends cues for deliberate or firm contact. Turn it on if you want small taps for brushes and bumps too.

## Using it from another device

By default, Marinara only accepts haptic commands from the same computer that runs the Marinara server. This keeps device control local and private.

Because of this, haptic feedback will not work if you open Marinara from a phone or another device. This applies when that device reaches a Marinara server running elsewhere. The connect, scan, and command actions are refused unless you change the server settings.

To allow haptic control from another device, turn on a server setting called `HAPTICS_ALLOW_REMOTE`. You must also set up access protection, such as Basic Auth or an admin secret. See the [Server Configuration Reference](../CONFIGURATION.md) for the setting. See the [Remote Access guide](../REMOTE_ACCESS.md) for the access protection. You enter admin access under **Settings** in the **Advanced** area, in the **Admin Access** section.

## If something is not working

If the AI never triggers your device, check these in order.

1. Make sure **Intiface Central** is open and its server is started.
2. Make sure your device is paired and shows in the device list after you click **Scan for devices**.
3. Make sure the status dot is green and the **Haptic Feedback** toggle is on.
4. If you are on a phone or a remote device, review the remote access notes above.

When **Intiface Central** is not connected, or no device is attached, Marinara skips the AI touch cue quietly. You will not see an error in the chat.

## Related guides

- [Agents: AI Helpers for Your Chats](../agents/agents-overview.md)
- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Remote Access: Basic Auth and IP Allowlist](../REMOTE_ACCESS.md)
