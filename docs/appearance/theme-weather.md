# Weather in Your Theme

When a story has weather, Marinara draws it over the chat: rain, snow, fog, falling leaves, petals, stars, a sun or a moon. Your theme can give all of it its own look. You can recolour the rain, make snow fall as pixel squares, swap leaves for pictures you drew, or turn your backdrop grey when it rains.

This guide walks you through it step by step. You need a theme of your own first. If you don't have one yet, the [Theme Author Guide](theme-author-guide.md) shows you how to make one in a few minutes. The [Weather](theme-author-guide.md#weather) section there is the short reference version of this page.

## How the weather works

The weather comes from the story. In a Roleplay or Game chat, the **World State** agent keeps track of the weather and the time of day, such as "heavy rain" and "night". Marinara reads those words and picks what to draw: rain streaks for "rain", flakes for "snow", stars and a moon for "night", and so on.

The app always does the drawing itself. Your theme doesn't draw anything. It sets a few `--mari-weather-` tokens (named settings, like `--primary`), and the app reads them and draws the weather your way. This keeps themes safe: nothing in a theme can run code, and the user's own settings, such as reduced motion, always win.

### The weather with no theme

This is a rainy night with no theme: thin pale streaks over a dark blue wash. The pictures further down show the same chat with three starter themes.

## See the weather while you work

You don't need to wait for the story to rain. You can set the weather yourself.

1. Open **Library → Settings → Appearance** and check that **Dynamic weather effects** is on (under **Effects**) and **Reduce Ambient Animations & Effects** is off.
2. Open a Roleplay chat, then open **Chat Settings → Agents** and turn on **World State**.
3. Open the **World State** tracker. On a computer it's in the Tracker Panel. On a phone, tap the **World State** button.
4. Click the **Weather** value and type a weather word, such as `heavy rain`. Click **Time** and type `night`.
5. The weather starts at once. The chat now has its own tab in the top bar.

While you work on your theme, Settings fills the middle of the window and the weather pauses behind it. Save your theme, then click the chat's tab in the top bar to see the result. To try other weather, change the words in step 4. The table under **Which words make which weather** below lists them all.

> **Tip:** Lock the Weather value (lock mode in the tracker) so the AI doesn't change it while you test. See [Roleplay HUD and Trackers](../roleplay/hud-and-trackers.md).

## Your first weather look, step by step

Let's give the rain a colour and make the streaks longer, the way the NEON//GRID starter theme does.

1. Open **Library → Settings → Appearance → CSS Themes** and click **Edit theme CSS** (the code icon) on your theme.
2. Find the `:root {` line near the top of your CSS. If your theme doesn't have one, add `:root {` on a new line and `}` on the line after it.
3. Add these lines inside it, before the `}`:

```css
  --mari-weather-rain-color: #3ff0ff;
  --mari-weather-rain-length: 2.2;
  --mari-weather-strength: 1.4;
```

4. Click **Save**. If Marinara asks **Keep this theme?**, click **Keep theme**.
5. Click your test chat's tab in the top bar. The rain is now cyan, the streaks are about twice as long, and they show more strongly.

What each line does:

- `--mari-weather-rain-color` is the colour of the raindrops. Any colour works: a hex code such as `#3ff0ff`, a name such as `skyblue`, or `rgb(63 240 255)`.
- `--mari-weather-rain-length` makes the streaks longer or shorter. `1` is normal, `2.2` is a bit more than twice as long.
- `--mari-weather-strength` makes every particle show more (above `1`) or less (below `1`).

### What you get

This is the same rainy night in NEON//GRID, which uses these three lines and a few more.

### Pick the colours for day and night

Colours that look good on a dark backdrop can vanish on a light one. Put day colours in a `[data-theme="light"]` block and night colours in a `[data-theme="dark"]` block, the same way you set any other colour:

```css
:root[data-theme="light"] {
  --mari-weather-rain-color: #1aa7c4;
  --mari-weather-snow-color: #22b8d6;
}
:root[data-theme="dark"] {
  --mari-weather-rain-color: #3ff0ff;
  --mari-weather-snow-color: #7af7ff;
}
```

## Which words make which weather

Each kind of weather has a short name. You use that name in the token, such as `snow` in `--mari-weather-snow-color`.

| When the story says | The app draws | Name in the tokens |
| --- | --- | --- |
| rain, downpour | Rain streaks | `rain` |
| storm, thunder, lightning | Heavy rain with lightning flashes | `rain` (flash: `lightning-color`, bolts: `lightning-bolt`) |
| snow, sleet, blizzard, frost, cold | Snowflakes | `snow` |
| hail | Hailstones | `hail` |
| fog, mist, haze | Soft fog banks low on the screen over ground mist | `fog` |
| sand, dust storm | Blowing sand | `sand` |
| ash, smoke, volcanic | Falling ash | `ash` |
| fire, embers, inferno | Rising embers | `ember` |
| wind, breeze, gusts | Falling leaves | `leaf` |
| cherry blossom, petals | Falling petals | `petal` |
| aurora, northern lights | Aurora ribbons | `aurora` |
| clear, sunny, cloudy, anything else | A few floating motes | `dust` |
| night (the time) | Stars and fireflies | `star`, `firefly` |
| dusk, evening (the time) | Fireflies | `firefly` |
| morning, day, dusk (clear sky) | The sun | `sun` |
| night (clear sky) | The moon | `moon` |

Stars skip foggy and snowy nights, and fireflies stay away from rain. The sun and moon only show when the sky is clear.

## Change colour, size and shape

Every kind in the table takes the same three settings. Put the kind's name in the middle of the token.

| Token | What it does | Values |
| --- | --- | --- |
| `--mari-weather-snow-color` | The colour | A plain colour: `#fff0f7`, `white`, `rgb(...)`, `hsl(...)` |
| `--mari-weather-snow-size` | How big each particle is | `0.5` (half) to `3` (three times) |
| `--mari-weather-snow-shape` | Round dots or little squares | `round` or `square` |

Swap `snow` for any other name from the table, such as `--mari-weather-ember-color` or `--mari-weather-leaf-shape`.

Example: "data snow" for a computer-style theme, with small cyan squares instead of flakes.

```css
:root {
  --mari-weather-snow-color: #7af7ff;
  --mari-weather-snow-shape: square;
  --mari-weather-snow-size: 1.2;
}
```

Shapes don't apply to rain, fog or the aurora, which keep their own form. For fog, `--mari-weather-fog-color` tints both the drifting banks and the ground mist, and `--mari-weather-tint-strength` makes the mist thinner or thicker.

## Use your own pictures

Instead of dots and streaks, each kind can fall as pictures you made: maple leaves, sakura petals, paper stars, little pixel snowflakes.

1. Draw or find small pictures with see-through backgrounds, such as PNGs. Keep them small: a leaf about 24 to 64 pixels across is plenty. Anything bigger is shrunk to 160 pixels on its longest side.
2. In the theme editor, open **Pictures and sharing details** and click **Add pictures**. Add up to four pictures for one kind.
3. In your CSS, list them in the kind's `-image` token, with a space between each:

```css
:root {
  --mari-weather-leaf-image: url("theme:leaf-1.png") url("theme:leaf-2.png") url("theme:leaf-3.png");
  --mari-weather-leaf-size: 0.8;
}
```

4. Save, open your test chat and set its weather to `windy`. Your leaves now drift down, and each one picks one of your pictures.

Tips for pictures:

- Click a picture's name under **Pictures and sharing details** to put its `url("theme:...")` into your CSS at the cursor, so you don't have to type the name.
- A picture keeps the file name you added, ending and all, such as `leaf-1.png`. Use the name exactly as the list shows it.
- A picture is drawn with its own colours, so the `-color` token does nothing for that kind.
- Use `-size` to make all of them bigger or smaller. Smooth style also varies the size a little, so they don't all look the same.
- Leaves, petals and ash turn gently as they fall in smooth style. Other kinds stay upright.
- Pictures must be inside your theme. A link to a picture on another website is ignored.

The Lantern Path starter theme uses four painted leaves this way.

## Pixel style

Pixel style puts the whole weather layer on a grid of big square pixels, so it matches pixel-art themes. Raindrops, flakes and stars become crisp little blocks.

```css
:root {
  --mari-weather-style: pixel;
  --mari-weather-pixel-size: 3px;
  --mari-weather-petal-image: url("theme:wx-petal-1.png") url("theme:wx-petal-2.png");
  --mari-weather-petal-size: 3;
}
```

- `--mari-weather-style: pixel` turns pixel style on. `smooth` (or leaving it out) is the normal look.
- `--mari-weather-pixel-size` is how big each block is, from `2px` to `6px`. `3px` is a good start.
- In pixel style, your pictures are drawn at their own size times `-size`. Draw your pixel art at 1 pixel per art pixel, and set `-size` to the same number as the pixel size, so your art's pixels line up with the weather's. Petal OS draws 11-pixel petals at size `3`.
- In pixel style, pictures don't turn as they fall and are drawn solid (they fade in and out in three hard steps), so pixel art stays crisp.

### Example: Petal OS

This is the Petal OS starter theme on a blossom night. The petals are its own 11-pixel drawings, and the stars sit on the same 3 px grid.

## The sun and the moon

The sun and the moon take a colour, a size and one picture, like any other kind:

```css
:root {
  --mari-weather-sun-color: #ffe9a8;
  --mari-weather-moon-color: #ffe2f0;
  --mari-weather-moon-size: 1.5;
}
```

If your backdrop already has a painted moon, turn the app's moon off so there aren't two:

```css
:root[data-theme="dark"] {
  --mari-weather-moon: none;
}
```

`--mari-weather-sun: none` does the same for the sun.

## Calm it down or turn it up

These settings change the whole weather layer at once:

| Token | What it does | Values |
| --- | --- | --- |
| `--mari-weather-amount` | How many particles fall | `0.25` (a quarter) to `1` (normal). A theme can thin the weather out but never add more. |
| `--mari-weather-speed` | How fast things fall | `0.5` (half speed) to `1.5` |
| `--mari-weather-strength` | How strongly particles show | `0.5` (faint) to `1.5` (bold) |
| `--mari-weather-tint-strength` | The coloured wash over the chat (blue in rain, dark at night) | `0` (none) to `1` (normal) |
| `--mari-weather-lightning-color` | The colour of the lightning flash | A plain colour. The flash stays gentle and slow, so it's safe for people sensitive to flashing light. |
| `--mari-weather-lightning-bolt` | Draws a forked lightning bolt with each flash, in the lightning colour | `on`, or a width from `0.5` to `3`. `none` (the default) keeps the flash only. |

For a quiet reading theme, try `--mari-weather-amount: 0.5;` and `--mari-weather-tint-strength: 0.3;`.

### Lightning bolts

By default a storm only flashes the screen. Add `--mari-weather-lightning-bolt` to draw a real forked bolt with each flash:

```css
:root {
  --mari-weather-lightning-color: #e8f2ff;
  --mari-weather-lightning-bolt: 1.2;
}
```

The bolt strikes down the left or right edge of the screen, never across the middle where the chat text is. It forks into several branches and glows in your lightning colour. It only shows while the app's own flash is up and fades with it, so a theme can't add flashes or make them faster. In pixel style the bolt is drawn in blocks on the pixel grid. Every new starter theme uses bolts: Dewglass, Velvet Casket, Copperplate Engine and Gutterlight.

## Make your backdrop follow the weather

Your theme's own art can change with the weather too. While a chat shows weather, Marinara adds two words to the page that your CSS can check:

- `data-mari-weather` is one of `clear`, `cloudy`, `rain`, `storm`, `snow`, `hail`, `fog`, `sand`, `ash`, `embers`, `wind`, `blossom` or `aurora`.
- `data-mari-sky` is one of `dawn`, `day`, `dusk` or `night`.

These are always one of the words above, never the story's own text. They go away when the chat has no weather or the user turns weather off.

### Example: Lantern Path in the rain

Lantern Path swaps its sunny forest for a grey, overcast one when it rains. Left: a clear morning. Right: the same chat in the rain.

### Swap your backdrop

To do the same, add a block that only applies in rain or storms, and give it a second backdrop picture:

```css
:root {
  --mari-app-backdrop: url("theme:forest-sunny.webp");
}
:root[data-mari-weather="rain"],
:root[data-mari-weather="storm"] {
  --mari-app-backdrop: url("theme:forest-overcast.webp");
}
```

How to read it: `:root[data-mari-weather="rain"]` means "only while it's raining". The comma means "or".

- If your theme sets `--mari-app-backdrop-layers` instead of `--mari-app-backdrop`, change `--mari-app-backdrop-layers` in the weather block too, because it wins over the single picture.
- To match day and night as well, add the scheme: `:root[data-theme="dark"][data-mari-weather="rain"]` is "a rainy night in Dark".
- `data-mari-sky` works the same way, for example `:root[data-mari-sky="dusk"]` for a sunset version of your art.

### Don't double the weather

If your theme has its own ambient overlay with falling leaves or rain (`--mari-ambient`), it can pile on top of the story's weather. Turn it off whenever real weather is falling:

```css
:root[data-mari-weather]:not([data-mari-weather="clear"], [data-mari-weather="cloudy"]) {
  --mari-ambient: none;
}
```

This reads: "when there is weather, and it's not clear or cloudy, hide the ambient overlay".

## What stays the user's choice

Your theme changes how the weather looks, never whether people see it:

- A theme can't turn weather on or off. **Dynamic weather effects** in Settings decides.
- With **Reduce Ambient Animations & Effects** on, or the device's reduce-motion setting, no weather is drawn at all. Backdrops still follow `data-mari-weather`, because a picture swap doesn't move.
- **Reduced paint effects** drops the tint and glows and draws fewer particles.
- **Theme art strength** fades your weather like your backdrop, and **High contrast** keeps it faint.
- The weather pauses while a panel, an editor or Mari covers the chat, to save battery.

## If it did not work

- **Nothing changed.** Check the token is inside a `{ }` block and ends with `;`. Check the spelling: it's `--mari-weather-rain-color`, with `color` spelled the American way.
- **A value is ignored.** Numbers outside a token's range are moved to the nearest end of it, and values the app doesn't understand are dropped. Colours must be plain colours: gradients and `url()` are ignored.
- **My pictures don't show.** The picture must be in your theme's picture list, and the name in `url("theme:...")` must match it exactly, with the right ending (`.webp` or `.png`).
- **No weather at all.** Check that **World State** is on for the chat, the Weather value has a word from the table, **Dynamic weather effects** is on and **Reduce Ambient Animations & Effects** is off.
- **The weather shows in Roleplay but not in Conversation.** That's expected. Weather shows in Roleplay and Game chats only.

## Learn from the starter themes

Every starter theme in the theme gallery shows off weather. Download one, click **Clone + Edit** and scroll to the part of its CSS marked `Weather` to see how it's done.

- **NEON//GRID**: long cyan rain streaks, square "data snow", magenta sparks for leaves and petals. Its painted rain overlay steps aside when real weather falls.
- **Petal OS**: pixel style on a 3 px grid, its own pixel petals, pale pink rain at night and deep berry rain by day, and a city that greys over in bad weather.
- **Lantern Path**: its own painted leaves, warm fireflies, no app sun (the backdrop paints its own light) and backdrops that turn overcast or snowy with the weather.
- **Dewglass**: its own soap bubbles for motes, code-drawn crystal snowflakes, aqua rain, cyan lightning bolts and lagoon backdrops that turn overcast, frozen or misty.
- **Velvet Casket**: a different storm for day and night: pink bolts and lilac rain by day, violet-white bolts and silver rain over the cemetery at night, with its own bats and rose petals in the wind.
- **Copperplate Engine**: fog turns into warm engine steam, wind blows punched-card chads, and violet galvanic bolts strike down the side gutters.
- **Gutterlight**: cold comic-book rain, torn newsprint in the wind, sodium-yellow smog, and a storm backdrop with water pouring off the gargoyles as the bolts strike.

## Related guides

- [Theme Author Guide](theme-author-guide.md)
- [Custom CSS Themes](custom-css-themes.md)
- [Roleplay HUD and Trackers](../roleplay/hud-and-trackers.md)
- [Appearance Settings](appearance-settings.md)
