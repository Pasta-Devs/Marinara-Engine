# Agent System

Marinara agents are small model-driven workers that run around a chat turn. Built-in agents track world state, choose expressions, retrieve knowledge, rewrite prose, drive music, manage memories, and more. Custom agents let you add your own workers without editing code.

## Where To Manage Agents

- Open the **Agents** panel to create, import, export, duplicate, and organize custom agents.
- Open **Chat Settings -> Agents** to choose which agents are attached to one chat.
- In Roleplay, the HUD **Agents** button shows recent activity and cached prompt injections.
- In Chat Settings, **Agent Suite** opens the current chat's agent memory, tracker state, and custom-agent outputs so you can review or edit them.

## Agent Phases

Each agent has a pipeline phase. User changes made in the agent editor are respected for both built-in and custom agents.

- **Pre-generation** agents add context before the main model replies.
- **Parallel** agents run alongside generation when their output does not need to block the reply.
- **Post-processing** agents rewrite or enrich the finished response. Prose Guardian, Continuity Checker, and Immersive HTML belong here.

## Building A Custom Agent

In the **Agents** panel, create an agent and fill in:

- Name, description, and optional folder.
- Prompt and output format.
- Result type, such as prompt section, tracker state, memory, command, or custom output.
- Phase and trigger settings.
- Optional tools from the Functions list.
- Connection override, if this agent should use a different model from the chat.

Keep custom-agent prompts narrow. Agents work best when one agent owns one job: "extract inventory changes" is easier to verify than "track everything."

## Import And Export

Agents can be exported and imported as folder-based packages. Use this when sharing an agent with another install or storing a known-good version before editing. Importing an agent does not automatically attach it to every chat; add it in Chat Settings for the chats where it should run.

## Agent Suite

**Chat Settings -> Agents -> Agent Suite** lets you inspect the state agents have stored for the active chat:

- Agent memory.
- Tracker state.
- Custom-agent outputs.

You can edit values manually or use AI-assisted rewrites. Select text, give an instruction, optionally attach grounding context such as character cards or active lorebook entries, choose a connection, and review the proposed rewrite before saving.

## Debugging

Turn on **Settings -> Advanced -> Debug mode** or set `LOG_LEVEL=debug` in `.env` when you need proof of what an agent saw and returned. Debug logs can include full prompts, character cards, lorebook entries, and private chat content, so redact them before sharing.

