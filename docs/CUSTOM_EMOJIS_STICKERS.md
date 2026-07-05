# Custom Emojis And Stickers

Conversation Mode can offer custom emojis and stickers to users and to characters.

## Uploading Emojis

Use the emoji picker or custom emoji tab to upload a small image and assign it a name. The name becomes the shortcode the app can display, such as `:sparkly_mari:`.

Use square images when possible. The UI is tuned for compact emoji sizes, so large detailed art may become hard to read.

## Stickers

Stickers are larger reaction-style images. Upload them through the sticker picker and organize them by character or pack when that helps discovery.

## Model Selection Settings

Per chat, Marinara can decide which custom emojis and stickers to offer the model:

- **Semantic** chooses items by similarity to the current context. If the local embedder is unavailable, it falls back to random selection.
- **Random** offers a random subset.
- **Tool-call** lets a model/tool choose from the set when the configured connection supports that flow.

Keep the maximum offered count modest. Too many emoji and sticker choices spend prompt tokens and can distract weaker models.

