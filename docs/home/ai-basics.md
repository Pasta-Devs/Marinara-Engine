# AI Basics: Models, Tokens and Context

New to AI chat? This page explains the few words the rest of the guides use. You don't need an account to read it. The **AI basics** tour on the Home screen walks through it step by step.

## What an AI model is

An AI model (also called a large language model, or LLM) is a program that has read a huge amount of text and learned to predict what comes next. When you send a message, it writes the reply one small piece at a time, each time picking a likely next piece.

It does not look things up while it writes. Everything it knows comes from what it read before it was finished, plus what Marinara sends it with your message. That is why a character only knows what's in its card, the chat, and the lore Marinara adds.

## Where a model runs

Marinara is the app you chat in. It does not contain a big model itself. It sends your chat to one:

- **A service on the internet**, such as OpenRouter, NanoGPT, OpenAI or Anthropic. You make an account there, get an API key (a secret code that lets Marinara use your account), and the service runs the model. Most services charge per use. Some have free models.
- **A model on your own computer**, such as the [Built-in model](../connections/local-model.md). It needs no account and costs nothing, but it is smaller and slower than the big services, and your computer does the work.

See [Connecting to an AI Provider](../connections/connecting-to-a-provider.md) to add either one.

## Tokens

Models read and write in tokens, small pieces of text. A token is about three quarters of an English word, so 100 tokens is about 75 words. Services count tokens to set prices and limits: you usually pay for the tokens you send and the tokens you get back.

## The context window

A model can read only a limited number of tokens at once. That limit is its context window. Every reply, Marinara sends the model the instructions, the character card, your persona, any lore, and as much of the chat as fits.

In a long chat the oldest messages no longer fit, so the model forgets them. Marinara can bring the important parts back with summaries and Memory Recall. See [Memory Recall and Chat Summaries](../agents/memory.md).

## Different models for different jobs

Marinara can use more than one kind of model:

| Kind                       | What it does                                                                                                               | Needed?                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Chat model**             | Writes the replies.                                                                                                        | Yes, one is enough to start.       |
| **Decision model**         | Answers small yes-or-no questions, such as "did the scene move to a new place?".                                           | Optional.                          |
| **Embedding model**        | Turns text into numbers that capture its meaning, so Marinara can find lore and memories by meaning. It never writes text. | Optional. A small one is built in. |
| **Image reading**          | A model that can look at a picture and describe it.                                                                        | Optional.                          |
| **Image, video and voice** | Separate services that make pictures, clips and speech. A chat model can't.                                                | Optional.                          |

You can use one chat model for everything to start, and add the others when a feature asks for one. See [Choosing the model for each job](../connections/connecting-to-a-provider.md#choosing-the-model-for-each-job).

## Prompts and presets

The prompt is everything Marinara sends the model for one reply. A preset decides what goes in the prompt and in what order. **Peek prompt** in a chat shows the exact prompt that was sent. See [Preset Editor and Prompt Manager](../prompts/presets.md).

## Related guides

- [Connecting to an AI Provider](../connections/connecting-to-a-provider.md)
- [Decision Models](../connections/decision-models.md)
- [Semantic Search for Lorebooks](../lorebooks/semantic-search.md)
- [Professor Mari](professor-mari.md)
