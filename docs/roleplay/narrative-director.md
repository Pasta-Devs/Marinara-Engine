# Narrative Director and Secret Plot

The Narrative Director is an agent (a helper that runs alongside replies) that steers the plot of a Roleplay chat. **Push Story** nudges one reply when the scene feels stuck. **Secret Plot** keeps a hidden long-term arc that shapes many replies. It works in Roleplay only. For how agents work in general, see the [Agents overview](../agents/agents-overview.md).

## Add the Narrative Director to a chat

1. Open **Chat Settings** with the sliders button in the chat, and go to **Agents**.
2. Turn on **Enable Agents**, then add the **Narrative Director** agent.

A **Push Story** button now appears above your message box, and a **Narrative Director** card appears in **Agents**. The agent does nothing until you use **Push Story** or turn on **Secret Plot**.

## Push a story forward

**Push Story** works once. It shapes the next reply only, then turns itself off. Add the Narrative Director to the chat first (see above).

1. Click **Push Story** above your message box. A menu asks how to push:
   - **Naturally**: push the existing plot forward. The AI advances threads already in your story.
   - **Randomly**: add a plausible surprise to the scene.
2. Choose one. You see "The next time a character responds, they will push the story forward naturally!" (or "randomly!"). The button now reads **Push Story: Naturally** or **Push Story: Randomly**.
3. Send your next message, or generate a new reply. The AI writes that one reply with the push applied.
4. After the reply, **Push Story** turns off by itself.

You choose the mode from this menu each time. There is no default mode and no mode setting in **Chat Settings**.

To cancel before you send, click the armed button again. You see "Push Story disarmed."

If it did not work: **Push Story** does not respond while a reply is generating. Wait for the reply to finish, then click it.

## Turn on Secret Plot

**Secret Plot** is a hidden long-term arc. The AI keeps a secret plan for where the story goes. The plan is added to the prompt but stays hidden from you unless you reveal it. It is off by default. Unlike **Push Story**, it works over many replies and updates its plan on a schedule.

1. Open **Chat Settings → Agents** and find the **Narrative Director** card.
2. Turn on the **Secret Plot** toggle. Its label reads "Maintain a hidden long-term arc for this roleplay."
3. Set **Run Interval**, if you want. It is how many messages (yours and the AI's) pass between updates to the arc. The default is 8. You can use any whole number from 1 to 100. A lower number updates the plan more often.

## Reveal and edit the hidden arc

The **Secret plot** panel is below **Run Interval**.

1. Click **Reveal spoilers**. It reads **Reveal empty arc** if the AI has not written an arc yet. While hidden, the panel shows "Spoilers hidden". Click **Hide spoilers** to hide it again.
2. Edit the fields you want:
   - **Arc description**: the overall hidden storyline.
   - **Protagonist arc**: where your character is heading.
   - **Character arc**: where one chosen character is heading.
   - **Completed**: tick it when the arc is finished.
3. Use the save button to keep your changes.

To throw the arc away and have the AI write a new one, click **Regenerate**. A dialog titled "Regenerate Secret Plot" asks you to confirm. Choose **Regenerate** to replace the arc, or **Keep Current Arc** to cancel.

The arc is stored with the **Narrative Director** agent. Clearing the chat's agent results does not erase it. It is deleted only when you remove the agent from the chat, and a warning says so first.

## Change the Secret Plot prompt

The **Secret Plot Prompt** holds the instructions the Narrative Director follows when it writes and updates the arc. The built-in prompt treats each arc as a mystery to uncover. That suits adventure and intrigue, but may not fit a story driven by its characters.

1. Open **Agents** and edit the **Narrative Director**.
2. In the **Secret Plot** section, click **Copy default to edit**.
3. Change the text, then save the agent.

Click **Reset to default** to return to the built-in prompt, then save the agent.

> **Note:** Do not delete the last part of the prompt. It describes the reply format, and without it Marinara cannot read the arc.

The prompt is saved on the agent, so it applies to every chat that uses that Narrative Director.

## Related guides

- [Downloadable Agents Reference](../agents/built-in-agents.md)
- [Roleplay Mode: Getting Started](getting-started.md)
- [Guided Generation and Impersonate](../chats/guided-and-impersonate.md)
