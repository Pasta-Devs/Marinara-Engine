# Generation Parameters

This guide explains the generation parameters in Marinara Engine. These are the settings that control how the AI writes each reply, such as **Temperature** and **Max Output Tokens**. You change them per chat in the **Advanced Parameters** panel.

## What generation parameters do

A generation parameter is a sampling setting. It shapes how the model turns your prompt into text. It does not change what you say to the AI. It changes how the AI writes back.

For example, one parameter makes replies more random and creative. Another sets the longest reply the model may write. Most people never need to touch these. The defaults work well for normal chatting and roleplay.

Change these settings only when you want to fix a specific problem. This guide lists common problems and which parameter to try near the end.

## Where to find them

Generation parameters live in each chat, not in a global menu.

1. Open the chat you want to change.
2. Open **Chat Settings** (the gear icon for the active chat).
3. Find the **Advanced Parameters** section and click it to expand it.

You should see a help note that reads: "Override generation parameters for this chat. Only change these if you know what you're doing." Every setting below sits inside **Advanced Parameters**.

**Advanced Parameters** is available in every chat mode (Conversation, Roleplay, and Game).

## Each parameter in plain language

Each numeric parameter has an input box and its own on and off switch. That switch decides if the parameter is sent to the model. It is explained in the next section.

**Temperature** controls randomness. The range is 0 to 2. Lower values make replies more focused and predictable. Higher values make replies more creative and varied. A value near 1 is a common middle ground.

**Max Output Tokens** sets the longest reply the model may write in one turn. A token is a small chunk of text, roughly a short word or part of a word. Raise this if replies keep getting cut off. There is no fixed upper limit in the box.

**Top P** is called nucleus sampling. The range is 0 to 1. The model only picks from the most likely words whose combined chance reaches this value. Lower values make replies more focused. A value of 1 lets the model consider everything.

**Top K** limits the model to the top few most likely words at each step. The range is 0 to 500. A value of 0 turns this limit off. Many providers ignore this setting.

**Frequency** penalizes words the more often they already appeared. The range is -2 to 2. A positive value reduces repeated words. This is the frequency penalty, shown in the app as **Frequency**.

**Presence** penalizes words that appeared at all, no matter how often. The range is -2 to 2. A positive value pushes the model toward new topics. This is the presence penalty, shown in the app as **Presence**.

Together, **Frequency** and **Presence** are the repetition penalties.

**Reasoning Effort** tells a thinking-capable model how much to reason before it answers. A thinking-capable model is one that works through a problem in hidden steps first. The choices are **None**, **Low**, **Medium**, **High**, **Xhigh**, and **Maximum**. If the model does not support the tier you pick, Marinara lowers it to the strongest tier that model allows.

**Verbosity** controls how long and detailed replies should be. The choices are **None**, **Low**, **Medium**, and **High**. **Low** keeps replies short. **High** encourages longer, more descriptive replies. Only some models use this setting.

## The Send switch

Every numeric parameter, plus **Reasoning Effort** and **Verbosity**, has a small on and off switch next to its name. The switch has no text label in the app; this guide calls it the Send switch. Hover it to see "This parameter is sent to the model" or "This parameter is not sent to the model."

When a parameter's Send switch is on, Marinara includes that parameter in the request to the provider. When it is off, Marinara leaves that parameter out completely. The provider then uses its own default for that setting.

Turning the Send switch off is different from setting a value like 1 or 0. A value of 1 still tells the provider what to use. Turning the switch off tells the provider nothing, so the model decides.

Use the Send switch when a provider says two settings cannot be used together. Turn one of them off and try again. You will also use it when an error says a parameter is not accepted or is required. Turn that parameter's switch off if it is not accepted, or on if it is required.

In a chat's **Advanced Parameters**, only **Max Output Tokens** and **Reasoning Effort** have their Send switch on by default. The others start off.

## Default values

New chats start from a built-in baseline. The table below shows those starting values and whether each one is sent by default.

| Parameter | Starting value | Sent by default |
|---|---|---|
| Temperature | 1 | No |
| Max Output Tokens | 4096 in Conversation, 8192 in Roleplay and Game | Yes |
| Top P | 1 | No |
| Top K | 0 (off) | No |
| Frequency | 0 | No |
| Presence | 0 | No |
| Reasoning Effort | Maximum | Yes |
| Verbosity | High | No |

The value still shows in the box even when the **Send toggle** is off. It is just not sent until you turn the toggle on.

## Assistant Prefill

**Assistant Prefill** is optional text added at the very start of the AI's reply, right after your message. Most people leave it empty.

Use it only for models that support a prefill or a set opening tag. For example, you might type an opening tag like the one shown in the placeholder to force the model to start in a certain way. If you are not sure you need this, leave it blank.

## Thinking Tags

**Thinking Tags** tell Marinara how a model marks its hidden reasoning inside plain text. Some models wrap their reasoning in tags. If Marinara knows those tags, it can hide that reasoning behind the **View thoughts** action instead of showing it in the reply.

You write one wrapper per line, with a slot in the middle for the hidden text. Common wrappers such as think, thinking, thought, pipe, channel, and bracket pairs are already recognized. You only need this field for models that use an unusual wrapper.

## Custom Parameters

**Custom Parameters** lets you add raw settings that Marinara does not show as its own field. You type a JSON object, and Marinara merges it into the request sent to the provider.

Custom Parameters saved as connection defaults are sent for every API-backed text generation that uses that connection, including Conversation, Roleplay, Game, Noodle, summaries, and agents. This also applies to custom endpoints running on your own machine. Per-chat Custom Parameters are added for that chat and override matching connection-level keys.

This is an advanced field. A wrong key can make the provider reject the request. The object must use lowercase `true`, `false`, and `null`. Leave this empty unless a provider's guide tells you to add a specific key.

## OpenRouter Service Tier

**OpenRouter Service Tier** only appears when the chat's connection uses the OpenRouter provider. It picks how OpenRouter routes your request. The choices are **Default**, **Flex**, and **Priority**. **Flex** can be cheaper and slower. **Priority** can be faster and cost more. **Default** sends no tier at all.

## Context message limit

**Limit Context Messages** controls how much chat history is sent to the model. Turn it on to send only the last N messages instead of the whole chat.

When you enable it, the count starts at 50. You can set any number from 1 to 9999. A smaller number sends less history, which can lower cost and speed things up. It also means the AI remembers less of the older conversation. This setting is off by default.

## Exclude Past Reasoning

**Exclude Past Reasoning** is on by default. It keeps saved thinking and reasoning from earlier turns out of new prompts. That reasoning is not sent to the model again.

Leave it on unless you have a clear reason to feed old reasoning back into the model.

## Image Captioning

**Image Captioning** changes how the AI handles image attachments. When it is on, Marinara describes each attached image in text using a connection you choose, instead of sending the image itself.

Use this for models that cannot see images. When you turn it on, pick a connection in the **Captioning Connection** dropdown. A text-only endpoint may fail if you point it at the wrong connection. This setting is off by default.

## Save as Connection Default

At the bottom of **Advanced Parameters**, the **Save as Connection Default** button writes your current parameter values onto the connection itself. After that, new chats using that same connection start from these values.

The button only appears for a normal, saved connection. It is hidden for the random connection pool and for the built-in local model.

The **Reset to Defaults** button below it clears every per-chat parameter change and returns this chat to the mode's baseline.

## How defaults layer and override

Your effective parameters come from three layers. Each layer wins over the one before it, one setting at a time.

1. The mode baseline. This is the built-in starting point for the chat's mode.
2. The connection's saved defaults. These are the values you stored with **Save as Connection Default**.
3. This chat's **Advanced Parameters**. These are the values you set right here, and they win.

So a value you set in **Advanced Parameters** always beats the connection default and the mode baseline.

Game Mode is a special case. Game Mode sets some parameters on its own to keep its structured turns working. In Game Mode, a few of your **Advanced Parameters** changes may not fully apply. This is expected.

## Some models ignore some parameters

Not every model accepts every parameter. When Marinara knows a model rejects a setting, it leaves that setting out of the request. The slider or box still shows in the app, but changing it has no effect for that model.

This is common with certain reasoning and thinking models, which refuse sampling settings like temperature. If a setting seems to do nothing, the model may not accept it. Model behavior also depends heavily on which model you picked, so the same value can feel different across models.

If you use an auto-routing model that can change which model answers each time, your parameters may behave differently from turn to turn. Pinning one specific model keeps behavior steady.

## Symptom-based tuning tips

Most people never change these. If you want to try, change one setting at a time so you can tell what helped.

- Replies feel stiff or repetitive: raise **Temperature** a little, for example from 1 to a value between 1.1 and 1.3.
- Replies feel chaotic or off-topic: lower **Temperature**, for example to a value between 0.7 and 0.9.
- Replies get cut off in the middle: raise **Max Output Tokens**.
- A character keeps repeating the same phrasing: raise **Frequency** or **Presence** a little, for example to a value between 0.3 and 0.6.

These are rules of thumb, not tested recommendations. Different models respond differently, so a value that works on one connection may not carry over to another.

To see exactly which parameters were sent for a message, use **Peek Prompt**. It shows the assembled prompt plus the model, temperature, max tokens, reasoning effort, and more.

## Related guides

- [Preset Editor and Prompt Manager](presets.md)
- [Peek Prompt: See What the AI Received](../chats/peek-prompt.md)
- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
