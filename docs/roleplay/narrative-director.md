# Narrative Director and Secret Plot

This guide explains the Narrative Director agent in Marinara Engine. It covers the Push Story button, the Natural and Random Event modes, and the hidden Secret Plot arc. These features are for Roleplay Mode.

## What the Narrative Director is

An agent is an AI helper that runs behind your chat to do a background job. The Narrative Director is one of these agents. It writes a one-time direction for the next reply, so the story moves the way you want. To learn how agents work in general, see the [Agents overview](../agents/agents-overview.md).

The Narrative Director works in Roleplay Mode only. It does nothing on its own. It acts only when you arm it (switch it on for one reply) with the **Push Story** button, or when you turn on the **Secret Plot** feature.

To use it, you first add the agent to your chat. Open **Chat Settings**, go to the **Agents** section, and enable the **Narrative Director** agent. Once it is active, a **Push Story** button appears above your message box, and a **Narrative Director** settings card appears in the **Agents** section.

## Push Story

**Push Story** is a one-shot button. It shapes the next reply only, then turns itself off. Use it when the scene feels stuck and you want the AI to move things along.

Follow these steps to use it.

1. Open a Roleplay chat that has the **Narrative Director** agent active.
2. Find the **Push Story** button above your message box.
3. Click **Push Story**. In Natural mode you should see the message "The next time a character responds, they will push the story forward naturally!" In Random Event mode the message ends with "randomly!" instead.
4. Send your next message, or generate a new reply.
5. The AI writes that one reply with the story push applied.
6. After the reply, **Push Story** turns off by itself.

If you change your mind before you send, click **Push Story** again to turn it off. You should see the message "Push Story disarmed."

The **Push Story** button is not available while a reply is still generating. Wait for the current reply to finish, then arm it.

## Natural and Random Event modes

**Push Story** has two modes. You pick the mode in the **Narrative Director** card inside **Chat Settings**. The mode you pick changes what kind of push you get.

The two modes are:

- **Natural**: Push the existing plot forward. The AI advances the threads that are already in your story.
- **Random Event**: Add a plausible surprise. The AI introduces a new twist that still fits the scene.

**Natural** is the default. To change the mode, open **Chat Settings**, go to **Agents**, find the **Narrative Director** card, and click the mode you want.

The tooltip on the **Push Story** button tells you which mode is armed. In **Natural** mode it reads "Arm a natural Narrative Director push for the next response." In **Random Event** mode it reads "Arm a random Narrative Director event for the next response."

## Secret Plot

**Secret Plot** is a hidden long-term arc for your roleplay. The AI keeps a secret plan for where the story is going. This plan is added to the prompt, but it stays hidden from you unless you choose to reveal it. It is off by default.

Unlike **Push Story**, which acts once, **Secret Plot** runs over many replies. It updates its hidden plan on a set schedule as the chat continues.

### Turning on Secret Plot

1. Open **Chat Settings** and go to the **Agents** section.
2. Find the **Narrative Director** card.
3. Turn on the **Secret Plot** toggle. Its label reads "Maintain a hidden long-term arc for this roleplay."

### Run Interval

When **Secret Plot** is on, a **Run Interval** field appears. This sets how many user and assistant messages pass between updates to the hidden arc.

The default is 8. You can set any whole number from 1 to 100. A lower number updates the plan more often. A higher number updates it less often.

### Reveal and edit the hidden arc

Below the **Run Interval** field is the **Secret plot** panel. Use it to look at and change the hidden plan.

Click the reveal button to show the arc. It reads **Reveal spoilers** once an arc exists, or **Reveal empty arc** if the AI has not written one yet. Click **Hide spoilers** to hide it again. While the arc is hidden, the panel shows "Spoilers hidden".

When the arc is revealed, you can edit these fields:

- **Arc description**: the overall hidden storyline.
- **Protagonist arc**: where your character is heading.
- **Character arc**: where one selected character in the roleplay is heading.
- **Completed**: a checkbox you tick when the arc is finished.

After you edit a field, use the save button to keep your changes.

To throw away the current arc and have the AI write a fresh one, click **Regenerate**. A dialog titled "Regenerate Secret Plot" asks you to confirm. Choose **Regenerate** to replace it, or **Keep Current Arc** to cancel.

### The arc stays with the agent

The hidden arc is stored with the **Narrative Director** agent. Clearing your chat's agent runs and memory does not erase it. The arc is deleted only when you remove the **Narrative Director** agent from the chat. If you remove the agent, a warning tells you the hidden arc will be wiped and cannot be undone.

## Related guides

- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Roleplay Mode: Getting Started](getting-started.md)
- [Guided Generation and Impersonate](../chats/guided-and-impersonate.md)
