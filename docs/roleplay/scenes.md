# Scenes: Branching a Roleplay

This guide explains scenes in Guksu Motor. A scene is a short, self-contained roleplay that branches off from a Conversation chat. This guide covers how to start one, play it, and how to end, discard, fork, or convert it.

## What a scene is

A scene is a side roleplay that grows out of a Conversation chat. A Conversation chat is the messenger-style, direct-message mode. A scene lets you and a character step out of that chat into a focused roleplay moment. That moment can be a flashback, a date, or a fight. The main thread is not lost.

Each scene is its own roleplay chat. It has its own background, its own characters on stage, and its own opening message. The character or the story writes the setup for you when the scene begins.

A scene is temporary by design. While it is open, the original Conversation chat shows a small card that reads **A scene is in progress**. That card has a **Go to Scene** button that jumps you into the active scene.

When you finish, you choose what happens to the scene. You can save a summary back to the conversation, throw the scene away, or keep it as a permanent roleplay of its own. Those choices are explained below.

## Starting a scene

You start a scene from inside a Conversation chat with the `/scene` command. The command has an alias, `/rp`, that does the same thing.

Follow these steps:

1. Open a Conversation chat that already has some messages.
2. In the message box, type the scene command. You can add a short description of what you want after it.

```
/scene we sneak into the old library at midnight
```

3. Press Enter. The **Scene Prompt Setup** window opens.
4. Under **POV**, pick how the writing is framed: **First Person**, **Second Person**, or **Third Person**.
5. Under **Tense**, pick **Past**, **Present**, or **Future**.
6. Optionally, type notes in the **Extra instructions** box to steer the scene.
7. Click **Plan Scene**.

Guksu plans the scene and opens it as a new roleplay chat. You should see the new scene appear in your chat list and open automatically, with an opening message that sets the situation. If you change your mind at the setup window, click **Cancel** and no scene is created.

You can also start a scene without a description. Type just the command on its own if the conversation already has enough history to build from.

```
/scene
```

If the conversation has no messages yet, Guksu asks you to add a description or chat first before it can plan a scene.

A character can also ask to start a scene. When that happens, the same **Scene Prompt Setup** window opens, with a line like "[Character] wants to start a scene." Pick **POV** and **Tense** and click **Plan Scene** the same way, or click **Cancel** to decline.

## The scene bar: End Scene, Discard, Convert, and Back to conversation

While you are inside an active scene, a bar sits just above the message box. It holds the controls that decide what happens to the scene. The exact buttons you see depend on whether the scene has a linked conversation.

- **Back to conversation** returns you to the Conversation chat that started the scene. It leaves the scene open and running, so you can come back to it later. This button appears only when the scene has an origin conversation.
- **End Scene** finishes the scene and saves a summary. When you click it, the bar asks **End and save summary?** with a **Yes** and a **No** button. Click **Yes** to confirm. The button shows a **Saving...** state while it works. Guksu writes a short summary of the scene back to the origin conversation as a memory, then returns you to where that conversation left off.
- **Discard** throws the scene away without saving anything. When you click it, the bar asks **Discard scene?** with **Yes** and **No** buttons. Click **Yes** to delete the scene and go back to the conversation. Nothing is written back.
- **Convert** turns the scene into a standalone roleplay chat of its own. It is explained in its own section below, because it changes the scene permanently.

Take your time before you click **End Scene** or **Discard**, because both remove the scene from your conversation. **End Scene** keeps a memory of what happened. **Discard** keeps nothing.

## Cloning a scene from a message

Inside a scene chat, each message has a small action button whose tooltip reads **Clone from here**. This lets you fork scene content into a brand new roleplay chat, copied up to and including that message.

To use it:

1. Hover over the message you want to branch from.
2. Click the **Clone from here** action.

Guksu creates a fresh standalone roleplay from the scene, copying the messages up to that point. Your original scene stays open and active, so this is a safe way to explore a different path. You should see a confirmation that the scene was cloned as a roleplay, and the new chat opens.

Cloning keeps the original scene. Converting, described next, does not.

## Converting a scene into a standalone roleplay

The **Convert** button in the scene bar detaches the scene and makes it a permanent roleplay chat on its own. When you click **Convert**, a confirmation window opens titled **Convert this scene into a standalone roleplay?**

The window explains what will happen. It creates a new roleplay chat from the current scene and detaches the original scene from its conversation. No scene summary and no character memory are written back to the original conversation. Click **Convert** to go ahead, or **Cancel** to keep things as they are.

Use **Convert** when a scene has grown into a story you want to keep and continue as a normal roleplay. Use **Clone from here** instead when you want a copy but also want the original scene to stay put.

To keep the two fork paths clear: **Clone from here** lets you fork scene branches while the original stays active. **Convert** lets you convert scene branches into a standalone roleplay, and it removes the original from its conversation.

## Why scenes do not inherit connected chat context

A Conversation chat can be connected to a roleplay so that context flows between them. Scenes work differently on purpose. A scene is self-contained.

A scene does not automatically pull in the back-and-forth context from a connected conversation, even when the parent chat does. A connected conversation can quietly pass short steering notes into a linked roleplay to nudge its story, but a scene ignores those notes. This keeps a scene focused on its own moment instead of dragging in the whole conversation.

This is why a scene reads cleanly as its own little story. If you want the ongoing two-way link between a conversation and a roleplay, use a connected chat rather than a scene. See the connected chats guide linked below for that feature.

## Related guides

- [Roleplay Mode: Getting Started](getting-started.md)
- [Chat Branches](../chats/branches.md)
- [Connecting a Conversation to a Roleplay or Game](../chats/connected-chats.md)
