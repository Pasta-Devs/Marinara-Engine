# Generation Parameters

Generation parameters are the settings that control how the model writes each reply, such as **Temperature** and **Max Output Tokens**. Presets and accounts provide defaults, and the **Advanced Parameters** section of **Chat Settings** overrides them for one chat. The defaults work well for normal chatting and roleplay, so change these only to fix a specific problem.

## Where to find them

| What | Where |
| --- | --- |
| Starting values for a preset | **Presets**, open a preset, **Parameters** tab |
| Values saved on an account | **Connections**, open the account, **Chat defaults** section |
| Overrides for one chat | **Chat Settings**, **Advanced Parameters** section |

Presets do not set context or output token limits. Set the context window in **Connections**, and output limits in **Connections** or **Advanced Parameters**. Older preset files still load, but their saved token limits are ignored. The built-in **Marinara's Universal Preset** contributes no generation parameters.

To override parameters for one chat:

1. Open the chat.
2. Open **Chat Settings**.
3. Find **Advanced Parameters** and click it to expand it.
4. Find the parameter, for example **Temperature**, and type a new value.
5. Check the small switch beside its name. If it is off, turn it on. A parameter whose switch is off is not sent, so your change does nothing. **Temperature** starts with its switch off (see [The Send switch](#the-send-switch)).

You see a note: "Change generation settings for this chat only. Leave these alone unless you know what they do." **Advanced Parameters** is available in Conversation, Roleplay and Game chats.

## Each parameter in plain language

Each numeric parameter has an input box and a Send switch (see below).

| Parameter | What it does | Range |
| --- | --- | --- |
| **Temperature** | Randomness. Lower is more focused and predictable. Higher is more creative. Near 1 is a common middle. | 0 to 2 |
| **Max Output Tokens** | The longest reply the model may write in one turn. Tokens are small pieces of text. Raise it if replies are cut off. | No fixed upper limit |
| **Top P** | The model picks only from the most likely words whose combined chance reaches this value. 1 considers everything. | 0 to 1 |
| **Top K** | Limits the model to the top few likely words at each step. 0 turns it off. Many services ignore it. | 0 to 500 |
| **Frequency** | Penalizes words more the more often they already appeared. Positive values cut repeated words. | -2 to 2 |
| **Presence** | Penalizes words that appeared at all. Positive values push toward new topics. | -2 to 2 |

**Frequency** and **Presence** are the repetition penalties.

**Reasoning Effort** tells a thinking-capable model, one that works through a problem in hidden steps first, how much to reason before it answers. The choices are **Off**, **Low**, **Medium**, **High**, **Extra high** and **Maximum**. If the model does not support your tier, Marinara lowers it to the strongest tier the model allows. After you pick a model, the buttons are named after the level that model gets, so **Maximum** can show as **Max**, **Extra high** or **High**.

- With the Send switch on, **Off** asks the service to turn thinking off, when the model is known to support that. Some models cannot turn thinking off and may still return reasoning. Choose a non-reasoning model when thinking must be absent.
- With the Send switch off, no reasoning preference is sent, and the service uses its own default.

**Verbosity** sets how long and detailed replies should be: **None**, **Low**, **Medium** or **High**. Only some models use it.

## Tuning tips

Change one setting at a time so you can tell what helped. These are rules of thumb, and models differ.

| Problem | Try |
| --- | --- |
| Replies feel stiff or repetitive | Raise **Temperature** a little, to between 1.1 and 1.3. |
| Replies feel chaotic or off-topic | Lower **Temperature**, to between 0.7 and 0.9. |
| Replies are cut off | Raise **Max Output Tokens**. |
| A character repeats the same phrasing | Raise **Frequency** or **Presence** a little, to between 0.3 and 0.6. |

To see which parameters were sent for a message, use **Peek Prompt**. It shows the assembled prompt plus the model, temperature, max tokens, reasoning effort and more.

## The Send switch

Every numeric parameter, plus **Reasoning Effort** and **Verbosity**, has a small switch by its name. It has no text label. Hover over it to see "This parameter is sent to the model" or "This parameter is not sent to the model."

- On: Marinara includes the parameter in the request.
- Off: Marinara leaves it out, and the service uses its own default. This differs from a value such as 0 or 1, which still tells the service what to use.

Use it when a service says two settings cannot be used together (turn one off), or when an error says a parameter is not accepted (turn it off) or is required (turn it on).

In a chat's **Advanced Parameters**, only **Max Output Tokens** and **Reasoning Effort** are sent by default.

## Default values

These are the values the editor shows, not always what is sent. Without a preset, generation starts at 4096 output tokens before account and chat overrides. An active scene can use 8192. The **Effective** line shows the resolved value.

| Parameter | Starting value | Sent by default |
| --- | --- | --- |
| Temperature | 1 | No |
| Max Output Tokens | 4096 in Conversation, 8192 in Roleplay; no Game override | Yes |
| Top P | 1 | No |
| Top K | 0 (off) | No |
| Frequency | 0 | No |
| Presence | 0 | No |
| Reasoning Effort | Maximum | Yes |
| Verbosity | High | No |

A value still shows in the box when its Send switch is off. It is not sent until you turn the switch on.

## Prefills and thinking tags

**Assistant Prefill** is optional text added at the start of the AI's reply. Leave it empty unless a model supports it.

- It is the last thing sent, after your message and every instruction that follows it.
- If the chat ends on an AI reply and **Post-Processing Messages** is **Apply**, the prefill is added to the end of that reply.
- Some models refuse a prompt that ends on the AI's own words, including **Claude (Subscription)** with any model. For them, Marinara adds the prefill to the start of the AI's last reply instead, so the new reply does not start with it.
- In a chat with no AI reply yet, the prefill is sent as your message at the end.

**Assistant Reasoning Prefill** is optional hidden text added at the start of the AI's reasoning, before the visible reply. Use it only with models that support a separate reasoning prefill, such as Kimi K3. It can be used with **Assistant Prefill**.

**Thinking Tags** tell Marinara how a model marks its hidden reasoning in plain text, so it can hide that reasoning behind **View model thoughts**. Write one wrapper per line, with a slot in the middle for the hidden text. Common wrappers such as think, thinking, thought, pipe, channel and bracket pairs are already recognized. You need this only for an unusual wrapper.

## Custom Parameters

**Custom Parameters** lets you add raw settings Marinara has no field for. Type a JSON object, and Marinara merges it into the request.

- Saved as account defaults, they are sent for every text generation that uses the account: Conversation, Roleplay, Game, Noodle, summaries, agents and installed agent packages. This includes custom endpoints on your own machine.
- Per-chat Custom Parameters are added for that chat and override matching account keys.
- A wrong key can make the service reject the request. Use lowercase `true`, `false` and `null`. Leave this empty unless a service's guide tells you to add a key.

## Service Tier

**Service Tier** appears only when the chat's account uses OpenRouter or NanoGPT. It picks how the service routes your request. **Default** sends no tier. **Flex** can be cheaper and slower. **Priority** can be faster and cost more.

## Context message limit

**Limit Context Messages** (also labeled **Context message limit**) sends only the last N messages instead of the whole chat. It is off by default. When you turn it on, the count starts at 50, and you can set 1 to 9999. A smaller number lowers cost and speeds things up, and the AI remembers less.

In a Roleplay chat with **Advanced Memory Recall** on, this limit is not used. Advanced Memory Recall sets how much history is sent with **Maximum allowed context before compression (tokens)**. To send less, lower that setting in **Chat Settings → Memory Recall**. See [Advanced Memory Recall](../agents/memory.md#advanced-memory-recall-roleplay-and-game-mode).

## Exclude Past Reasoning

**Exclude Past Reasoning** is on by default. It keeps saved reasoning from earlier turns out of new prompts. Leave it on unless you have a clear reason to feed old reasoning back.

Turning it off shows **Past reasoning blocks**. The default is 1, which keeps the most recent available reasoning block. A value of 0 includes all available blocks. This does not delete stored thoughts, and only reasoning the current account supports can be replayed.

## Image captioning

**Image captioning** makes Marinara describe each attached image in words, using another model, instead of sending the image. Use it for models that cannot see images. It is off by default.

1. In **Advanced Parameters**, turn on **Image captioning**.
2. Pick a model in the **Captioning model** dropdown.
3. Optionally edit the **Captioning Prompt**, the instructions sent with each image. The reset button, or clearing the box, restores the default. The prompt is saved for this chat only, and **Save as Connection Default** does not copy it.

If it did not work: when captioning fails, because the captioning account is broken, deleted or returns nothing, the reply stops with an **Image captioning failed** error. Marinara does not send the image instead. Fix or change the captioning model, or turn **Image captioning** off.

## Save as Connection Default

At the bottom of **Advanced Parameters**, **Save as Connection Default** writes your current values onto the account. New chats that use that account then start from them. It appears only for a saved, normal account. It is hidden for the random pool and the built-in model.

**Reset to Defaults** clears every per-chat change and returns the chat to its inherited settings. Inherited Send switches follow the selected account. A Send switch you changed yourself stays a chat override until you reset it.

## How defaults layer and override

Marinara resolves each parameter through this list. Later items override earlier ones.

1. The preset's **Parameters**, or built-in defaults when no preset is used. Output starts at 4096 tokens, because presets cannot set output limits. In Roleplay, an account's preset override beats the chat's selected preset.
2. The account's **Chat defaults**.
3. This chat's **Advanced Parameters**.
4. Mode rules. An active scene chat sets output to 8192, reasoning to **Maximum** and verbosity to **High**. Game uses saved account and chat parameters without forcing sampling, reasoning or a minimum output size.
5. Output limits. Game applies the model's known output limit, and the account's **Max output tokens override** caps requests in every mode. Available context can reduce the budget further.

The **Effective** line beside a parameter shows the value that wins and which layer it came from, for example **Effective: 16384 · this chat**, or **Effective: 4096 · output token cap** when an account cap applies. A disabled Send switch shows **not sent**. Services can still require parameters or adjust unsupported values. Custom Parameters and context fitting may change the final request. Resetting chat parameters removes only this chat's override (item 3). The value then comes from the account's **Chat defaults** if set, otherwise from the preset. Mode rules and output limits (items 4 and 5) still apply afterwards.

## Parameters for agents

Agent calls use the **Chat defaults** saved on the account they run on: the agent's own account, or the chat's account when the agent has none. The Send switches and model limits apply as for a chat reply. Presets and a chat's **Advanced Parameters** do not change agent calls, except for the temperature rule below.

- **Sent to agents:** Temperature, Top P, Top K, Frequency, Presence, Reasoning Effort, Verbosity, Service Tier, Custom Parameters, custom headers, and the extra parameters you add under **Settings**, then **Advanced**, then **Parameters** (such as Top A or a seed). A parameter whose Send switch is off is not sent.
- **Not sent to agents:** Max Output Tokens, stop sequences, prefills, Thinking Tags and other prompt-format settings. Each agent keeps its own **Max Output Tokens**.
- **Temperature:** an agent uses the account's temperature, or 0.7 when none is saved. Beholder always uses 0, and the Illustrator's prompt writer uses its own value. During a chat reply, agents on the chat's account take the temperature and Send switches the chat resolved. Retries use the account's saved values.
- **Reasoning Effort:** a level you pick, or **Off**, applies to every agent on that account whose model takes it. **Use custom defaults for this model** starts Reasoning Effort at **Maximum** on most accounts (**Default** on Codex), so agents think at the highest level, which is slower and costs more. Pick a lower level, or turn its Send switch off, to make them think less. With no level saved, agents that answer in JSON ask for thinking off, and other agents leave the model's default.
- **Room to think:** when the account saves a Reasoning Effort, Marinara adds room for thinking on top of the agent's **Max Output Tokens**, within the account's output cap, the model's limit and the free context. A custom endpoint gets it even when it does not send the level.

Installed agent packages follow the same account values. A value the account saves and sends replaces what the package asks for, and anything unset keeps the package's own setting. **Reasoning Effort** or **Max Output Tokens** switched off on the account is not sent, even if the package asks. Temperature and Verbosity start switched off, so the package's own value stays.

## Some models ignore some parameters

Not every model accepts every parameter. When Marinara knows a model rejects a setting, it leaves it out of the request. The control still shows, but changing it has no effect. This is common with reasoning models, which refuse sampling settings such as temperature. With an auto-routing model that changes which model answers each time, parameters can behave differently from turn to turn. Pin one model to keep behavior steady.

## Related guides

- [Preset Editor and Prompt Manager](presets.md)
- [Peek Prompt: See What the AI Received](../chats/peek-prompt.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
