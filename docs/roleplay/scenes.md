# Scenes: Branching a Roleplay

A scene is a short roleplay that branches off a Conversation chat. Use one for a flashback, a date or a fight, without losing the main thread.

Each scene is its own Roleplay chat with its own background, characters and opening message. While it is open, the original Conversation chat shows a card that reads **A scene is in progress**, with a **Go to Scene** button.

While a scene runs, its characters do not reply in the Conversation chat, and a notice says they are in an active scene. To let them answer you there anyway, turn on **Allow replies here** on the card. It starts off. With it on, scene characters reply when you message them, but they still do not message on their own.

## Start a scene

Before you start: open a Conversation chat that already has some messages. See [Conversation Mode: Getting Started](../conversation/getting-started.md).

1. In the message box, type `/scene` and a short description. `/rp` does the same. For example: `/scene we sneak into the old library at midnight`
2. Press <kbd>Enter</kbd>. **Scene Prompt Setup** opens.
3. If you see **Scene persona**, choose who plays you. **Use the Conversation persona** keeps the persona of the Conversation.
4. If you see **Scene characters**, leave **Let the scene planner choose characters** on to let Marinara pick. Or turn it off and choose at least one character.
5. Choose a **Prompt preset**. Leave it on **None** to use the preset of your default Roleplay [settings profile](../chats/settings-profiles.md#choosing-the-default-profile). Marinara remembers your choice for the next scene.
6. Under **POV**, pick **First Person**, **Second Person** or **Third Person**.
7. Under **Tense**, pick **Past**, **Present** or **Future**.
8. Optional: type notes in **Extra instructions** to steer the scene.
9. Click **Plan Scene**.

The scene opens as a new Roleplay chat in your chat list, with an opening message that sets the situation. Click **Cancel** in the setup window to stop without creating a scene.

`/scene` alone also works when the conversation has enough history. If the conversation has no messages yet, Marinara asks you to add a description or chat first.

A character can also ask to start a scene. A **Set up scene** invitation appears beside their reply. Click it to open **Scene Prompt Setup**, then continue from step 3. **Cancel** closes setup, and the invitation stays available, even after a reload.

How the scene opens:

- It starts from your default Roleplay settings profile, like any new Roleplay chat. A [settings profile](../chats/settings-profiles.md) is a saved set of chat settings.
- When the scene plan has them, a short note on how to play the scene is posted first as a narrator message, then the scene's description as a second narrator message. A plan without one skips it.
- With one character, the opening is in that character's voice, with spoken words in double quotes unless your writing instructions set another style.
- In a group scene, the opening follows the profile's group mode. **Merged (Narrator)** is the default: one reply voices every character. In **Individual** mode, the character who opens the scene writes it. See [Group Chats](../chats/group-chats.md#choose-who-speaks).

## Use the scene bar

Inside a scene, a bar above the message box decides what happens to it. Which buttons show depends on whether the scene has an origin conversation.

| Button | What it does |
| --- | --- |
| **Back to conversation** | Returns to the Conversation chat that started the scene. The scene stays open. Shown only when there is an origin conversation. |
| **End Scene** | Saves a summary and finishes the scene. Click **Yes** at **End and save summary?**. |
| **Discard** | Deletes the scene and saves nothing. Click **Yes** at **Discard scene?**. |
| **Convert** | Turns the scene into its own standalone Roleplay. See below. |

**End Scene** shows **Saving...**, writes a short summary into the conversation as a memory, and returns you there. **Discard** keeps nothing. Both remove the scene from your conversation.

## Clone a scene from a message

To copy a scene up to one message and continue it separately, while the original stays open:

1. Hover over the message you want to branch from.
2. Click its **Clone from here** action.

Marinara makes a new standalone Roleplay with the messages up to and including that one, shows a confirmation, and opens it.

## Convert a scene into a Roleplay

Use **Convert** when a scene has grown into a story you want to keep as a normal Roleplay.

1. Click **Convert** in the scene bar.
2. Read **Convert this scene into a standalone roleplay?** It makes a new Roleplay chat from the scene and detaches the original scene from its conversation. No scene summary or character memory is written back.
3. Click **Convert**, or **Cancel** to change nothing.

Clone keeps the original scene open. Convert does not.

## Scenes and connected chats

A scene is self-contained. It does not pull in context from a connected Conversation, even when the parent chat does, and it ignores the short steering notes a connected conversation can send to a linked Roleplay. For an ongoing two-way link between a conversation and a roleplay, use a connected chat. See [Connecting a Conversation to a Roleplay or Game](../chats/connected-chats.md).

## Related guides

- [Roleplay Mode: Getting Started](getting-started.md)
- [Chat Branches](../chats/branches.md)
- [Connecting a Conversation to a Roleplay or Game](../chats/connected-chats.md)
