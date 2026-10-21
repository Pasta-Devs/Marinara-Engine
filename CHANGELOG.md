# Changelog

This file is the release-notes source of truth for Marinara Engine. Reuse these entries when publishing GitHub Releases for tags in the `vX.Y.Z` format.

## [Unreleased]

## [2.5.1] - 2026-10-20

### Before you update

- If you reach Marinara through a tunnel or reverse proxy on the same computer, such as nginx, Caddy, Cloudflare Tunnel, Tailscale Serve or ngrok, its visitors now count as remote and see the setup page until you set Basic Auth. If the proxy has its own login, set `REQUIRE_AUTH_FOR_LOOPBACK_PROXY=false` instead. Opening Marinara directly on that computer works as before (#7816).

- On Docker Desktop, OrbStack and rootless Docker, the browser on the computer running Docker now falls under Basic Auth and `IP_ALLOWLIST` too. With Basic Auth it asks for the password once. With only `IP_ALLOWLIST`, it is refused unless you add the container's gateway address to the list or use Basic Auth instead. With neither set, nothing changes (#7816).

- Make a backup before you update. Going back to 2.5.0 later can lose data: 2.5.0 opens your chats, but when it saves a chat or a connection it drops what newer features added there, such as some connection settings, the details used to regenerate chat images and parts of game checkpoints, and updating again doesn't bring it back. **Upgrading → Going back to 2.5.0** has the details (#7838).

### Works differently now

- Images from other websites in messages, greetings and card previews now wait behind a **Load image** button that names the site, so a message can't make Marinara contact a site you didn't choose. Click it once and that image shows from then on, on all your devices. Images stored in Marinara, such as avatars, sprites and gallery pictures, always show, and GIFs you send in Conversation show without asking, though GIFs in older messages ask once. To show every image straight away as before, turn on **Load images from other websites in messages** in **Settings → General → Text Rules** (#7829).

- With that setting off, HTML cards and message styles can't load backgrounds or fonts from other websites either. Card CSS now stays inside the card's own box: rules nested inside other rules, `@property`, and selectors that start by reaching the elements next to the box (`~`, `+`) no longer apply (#7829).

- Exported chats, settings profiles and full profiles no longer include your **Discord Mirror** webhook, **DeepL API Key**, **DeepLX URL** or **Intiface URL**, and importing one no longer sets them. After moving a chat or profile to another install, enter them again there. Restoring a full profile onto the same install keeps them, and every other chat setting carries over as before (#7818).

- **Multiplayer (work in progress)**: a returning guest gets their seat back only from the same Marinara that held it, not just by using the same names, so nobody else can take over a seat with its whispers, Game sheet and round submissions. Leaving and rejoining works as before. If a guest restarts their Marinara, the host has to remove the old seat before that player can use the same persona name again. A guest still on v2.5.0 can join a newer host, but can't take back their old seat by name after leaving (#7823).

### 2D and 3D Avatars

- New **2D Avatars** and **3D Avatars** agents give characters and personas an animated avatar in Roleplay, Visual Novel and Game chats. Install either or both from **Download Agents**, set each avatar up in the **Avatars** section of the agent's page in **Agents**, and add the agent to a chat under **Chat Settings → Agents**. On that page you pick the character or persona, the avatar type and the **Movement** switches (**Lip sync**, **Blinking** and **Idle motion**), and **Preview** shows the result with **Try a face** and **Talk**. In chats, avatars stand where the full-body sprite would, at its size and on its side, with or without the Expression Engine (#7539, #7556).

- Avatars are kept light: at most two draw at once on a phone and four on a computer, and they stop drawing while the tab is hidden, the chat is covered or the Appearance settings are open. Each avatar type's drawing code downloads only the first time one shows. With reduced motion on, faces and mouths still change but breathing and swaying stop (#7556).

- Avatar files live in the data folder under `avatar-models`, are included in backups and profile exports, and are deleted with their character or persona, including from the Danger Zone. Character card exports don't include them, and imports have no size limit below the normal upload limit (#7556).

- **2D Avatars** and **3D Avatars** can be installed from **Download Agents**. They need this version of Marinara or newer and show under the **Roleplay** and **Game** filters (#7583, Marinara-Agents#1369, Marinara-Agents#1372, Marinara-Agents#1406, Marinara-Agents#1480).

- **2D Avatars** shows two kinds of avatar. A **PNGTuber sprites** avatar uses the character's or persona's expression sprites as its faces. Add sprites ending in `_talk` and `_blink`, such as `happy_talk`, for an open mouth and closed eyes, and it talks, blinks and hops while it speaks. **Import PNGTuber Plus save** brings in a PNGTuber Plus `.save`, with one face per costume. A **Mesh avatar** is a drawing that moves its head, eyes and mouth smoothly, and **Import .mavatar file** adds one made in Mesh Avatar Studio. Imported files are checked first and refused with a short reason when they are damaged or too detailed to play smoothly. Without WebGL2, a mesh avatar shows the sprites instead (#7549).

- A character or persona with expression sprites shows them as a PNGTuber avatar in chats with **2D Avatars** on, with nothing to save first. **Show this avatar in chats** turns it off, and it stays off even after you remove an avatar type. Each avatar type has its own import, face and remove controls on the setup page, and the mood reader downloads only once an avatar is on screen (#7578).

- **Make an avatar from a sprite** on the **2D Avatars** page fills in what your sprites are missing. **Blink and talk pictures** has your image connection draw an eyes-closed and a mouth-open picture for each face. Each one is shown with **Keep** and **Try again**, and your avatar stays the same until you select **Save kept pictures**. **Mesh avatar** turns one sprite into a moving mesh avatar: a chat model that can see pictures finds the face, Marinara Engine builds the avatar from your sprite, and you check the outlines before **Save as mesh avatar**. With **Expose media prompts before sending** on, you can read and change every prompt first (#7554).

- On the **2D Avatars** page, **Make faces from the avatar** at the top of **Make an avatar from a sprite** opens the sprite generator for the chosen character or persona, ready to draw expression faces from their avatar with **Transparent sprite background** on. The new faces are saved as their sprites and show in the panel at once, so a character with only an avatar can get a PNGTuber face, blinking and talking. Sprites you already have are used as they are (#7639, #7654).

- **Make faces from the avatar** on the 2D Avatars page draws every face with open eyes and a closed mouth, and shows the feeling through the brows, eyes and cheeks. That way the blink and talk pictures made from each face always change something you can see, Happy, Angry and Surprised included. Sprite generation in the character and persona editors is unchanged (#7690).

- **Make faces from the avatar** can draw all 29 faces: the six main feelings and the 23 more specific ones. Choose **All faces**, **Main faces** (the six, chosen by default) or any faces you like. It draws them in batches, main faces first, and with prompt review on you review the whole run once. **Cancel** keeps the faces already finished, and a batch that fails pauses with **Retry**. Each specific feeling comes with a short description of how it looks, such as very wide eyes for Fear, so the image model draws them differently (#7696).

- 2D avatars made from PNGTuber sprites can show 23 more specific feelings, such as Amusement, Embarrassment, Fear or Grief, each grouped under one of the six main feelings. Open **Face for each feeling**, then **More feelings**, to choose a face for any of them; until you do, a feeling uses its main feeling's face. A sprite named after a feeling, or after a common word for it such as `scared` or `blushing`, is used for it without any setup, and a PNGTuber Plus import matches costumes to feelings by their picture names. 3D and mesh avatars still show the six main feelings (#7692).

- On the 2D Avatars page, **Blink and talk pictures** shows one row for each face the talking head uses, with its **Eyes closed** and **Mouth open** pictures: ones you saved, ones you added as `_blink` and `_talk` sprites, or new ones. You can make the missing pictures or redo any of them. While **Try again** redraws a picture, it stays dimmed with a spinner; if the redraw fails, the old picture stays and the error shows under it (#7682).

- Blink and talk pictures keep the same bust as their face. The image model gets the prompt as written, without your style profile, and sees the face on plain white, so dark hair and clothes stay apart from the background (#7682).

- **Blink and talk pictures** for 2D avatars change only the eyes or the mouth. Marinara lines the image model's picture up with the face, then takes only the closed eyes or the open mouth from it, so hair, outline, clothes and edges stay exactly as they are in your sprite. If the model didn't close the eyes or open the mouth, the picture is refused with a short message, and **Try again** draws it again (#7854).

- Image connections that can't edit pictures, such as DALL-E, Pollinations, Together AI, Horde or a ComfyUI workflow without a picture input, can make blink and talk pictures too. They draw a **New face** with its **Eyes closed** and **Mouth open** pictures in one go from the character's or persona's appearance, so the three match. Keeping them makes the new face that feeling's face in the PNGTuber avatar, and your sprite file stays as it is. A character or persona without an appearance or description gets a message asking for one (#7854).

- In **2D Avatars**, faces made with **Make faces from the avatar** become the faces for their feelings, even when the character already has a saved talking head, and replace earlier picks only for the feelings made in that run. A remade face starts without the older blink and talk pictures, which would no longer match it. **Faces** and every **Face for each feeling** list offer every sprite face, including ones added after the talking head was set up (#7813).

- When the main image connection fails while editing an avatar picture, a fallback connection that can't edit pictures is skipped, so you see the main connection's error instead of paying for a new picture that ignores your sprite. SpicyAPI models that can only draw new pictures are refused for edits before a paid task starts (#7718).

- In **2D Avatars**, **Make an avatar from a sprite** → **Mesh avatar** picks the full-body neutral sprite for you, or the neutral portrait when there is no full-body one. You can still choose another sprite, and picking one never starts making the avatar (#7617).

- A mesh avatar's mouth fits its drawing. On a small sprite it sits on the painted lip line instead of opening as a second, oversized mouth below it, and its corners reach the ends of the drawn line, even where the lips fade out. When the avatar talks, its mouth opens across the whole drawn mouth instead of only the middle, and when it talks from the text, the mouth closes between words instead of holding each vowel open. Mesh avatars made earlier open across the whole mouth and close between words right away. To give one the right size and place too, make it again with **Make an avatar from a sprite** → **Mesh avatar** and save it (#7880, #7889).

- **Cancel** in **Make an avatar from a sprite** stops the work on the server as well, even when you reach Marinara through a proxy or tunnel, and the panel goes straight back to idle. Pictures already made are kept, and you can start again right away. This covers mesh avatars too (#7623).

- **3D Avatars** shows VRM models, VRM 1.0 and 0.x, such as ones made in VRoid Studio or exported from Blender. **Import VRM** checks the file before it is stored and says why one can't be used, such as Draco or meshopt compression, KTX2 textures, a plain glTF model without VRM data, or missing skeleton bones. Setup shows **The author's terms** from the file, fills in each face, mouth shape and blink from the model's own expressions, and lets you change any of them. An optional `.vrma` **Idle animation** plays while the model waits. In chats the model breathes, sways, blinks, looks at you, tilts its head while it thinks and nods while it talks (#7557).

- On the **3D Avatars** page, **Get a 3D model** under **VRM model** helps when a character or persona has no model yet. **Read the guide** walks through making one in VRoid Studio, a free app for Windows, macOS and iPad, and adding it with **Import VRM**; VRoid Studio models come with faces, mouth shapes and blinking ready to use. **Copy prompt** copies an English description of the character's look, taken from **Appearance** or the **Image Appearance Override** tags, for use in an image or 3D tool. It holds only the name and look, nothing else from the card and nothing from your chats (#7620, #7832).

- In chat, a 3D avatar is framed to include hair, ears or a hat that rise well above the head, so they aren't cut off (#7622).

- In **3D Avatars**, a VRM expression that exists but changes nothing, as the VRM add-on for Blender writes when it exports a VRM 0.x model, is no longer filled in for a face, mouth shape or blink, so a face marked **Set by the model** really moves. Neutral can still use one, since it is the model at rest, and the import says when it skipped an empty expression. You can still pick one by hand (#7580).

- The avatar guide has a new **Make your own model** section covering sprites, PNGTuber Plus, Mesh Avatar Studio, VRoid Studio and Blender, each ending with the import on the agent's page. It explains how to name expressions so they are found and what to turn off when exporting (#7580).

- A 3D avatar without face shapes, so it can't blink or move its mouth, shows life through its body instead: it sways, breathes and turns more, and nods and tilts its head with each phrase it speaks (#7820).

- Roleplay sprites without the Expression Engine, and the Expression Engine's guess for a character it skipped, now match whole mood words only, so words such as "yellow" or "terrific" no longer switch a sprite to angry or scared. They also know more mood words, including common ones in German, Spanish, French, Italian, Portuguese, Polish, Russian, Japanese, Chinese and Korean. When a character's text mentions both a mood and a blush, the happy sprite is now tried before the blush sprite (#7555).

- Avatars react while a reply streams in. In Roleplay, each finished sentence is read for its mood, and the face changes only when the mood is clear and then stays for at least two seconds. Mouths move only for dialogue, at about the pace of speech. In Game Mode, the face follows the Game Master's expression for each line. When the Expression Engine is on, its pick is the final face for that reply. In group chats, only the character who is speaking moves their mouth (#7555).

- The mood is read on your own server and never sent to your chat connection. On computers that can run it, a small emotion model that knows 36 languages (about 300 MB) downloads once, the first time you open a Roleplay chat with **2D Avatars** or **3D Avatars** turned on. The agent's page shows its progress, and it works offline after that. Lite installs, Android and computers with less than 3 GB of memory use a built-in word list instead (#7555).

- When text to speech reads a Roleplay reply, the speaking character's avatar moves its mouth with the voice: it opens wider on loud sounds, shuts in pauses and rounds on "oo" sounds. It works with **Auto-play** and with the **Speak** button, and only the avatar of the character whose voice reads the line moves. Playback itself is unchanged, including in Safari and on iPhone and iPad (#7547).

- With Text to Speech **Auto-play** on in Roleplay, avatars wait for the voice. While the reply appears, the avatar blinks and moves, but its mouth stays shut and its face doesn't change yet. When the voice starts, the mouth moves with it and the face changes as the voice reaches each sentence, then relaxes about four seconds after the voice ends. An Expression Engine pick shows once the reading is over. If the voice fails soon after the reply, the avatar plays the reply's faces and mouth from the text once instead, and after 30 seconds without a voice it stops waiting. **Speak** on a message also changes the face sentence by sentence, unless the Expression Engine already chose one for that reply. In Game Mode, avatars still follow the text (#7855).

- Avatars follow Game Mode character voices too, change faces sentence by sentence when streaming is off, and start moving with the start of each voice clip. Choosing a `.vroid` project file on the 3D Avatars page explains how to export a `.vrm` from VRoid Studio (#7876).

- Move and resize avatars in **Chat Settings → Agents → Avatars** in Roleplay, Visual Novel and Game chats. Pick an avatar and use its size slider, or select **Arrange** to drag avatars anywhere in the chat with a mouse or a finger, or move a focused one with the arrow keys (hold Shift to move further). **Done** gives clicks back to the chat, and **Reset** puts the avatars back without moving your sprites. The layout is saved for that chat on this device (#7843, #7850, #7852).

- 3D avatars have a **Framing** choice in the same drawer: **Portrait** shows the head and shoulders, **Half body** shows down to the hips and **Full body** shows the whole model from hair to shoes. The avatar keeps its size, so a taller framing shows more of the model in the same space (#7852).

- With 2D or 3D Avatars, only the avatar that is speaking draws at the talking frame rate. The others stay at the idle rate (20 frames a second on phones, 15 when the phone is struggling), so two avatars on screen cost a phone less. VRM avatars now blink every 3 to 6 seconds, like 2D avatars, instead of every 2 to 6. After you save, import or remove an avatar, its setup page shows the change at once, and a face picture you replace shows the new picture straight away. **Make an avatar from a sprite** no longer offers talking and blinking sprites as the starting picture (#7581).

- The 2D Avatars and 3D Avatars agent pages now show only the settings that affect them. Pipeline Phase, Context Sources, Agent Budget, Add as Prompt Section, Prompt Template and Tools are gone from both, since avatars never used them, and 3D Avatars no longer shows Connection Override. 2D Avatars keeps Connection Override, which it uses when it makes avatar pictures. Saved settings are unchanged (#7597).

### Video and images

- Characters in Conversation can send video messages. Type `/video` (or `/video Name` in a group), or select **Video** in the Conversation Gallery, and the character sends a short clip that plays in the chat. The clip shows what is happening in the conversation right now, written from the recent messages, and later replies know a video was sent. In Chat Settings, **Video messages** in the Illustrator section sets the **Video Connection** and the **First frame** the clip starts from: a new selfie, the avatar or sprite, or no picture. It needs the Illustrator agent and a video connection. Thanks to @JamesMowery (#7651, #7733).

- The Conversation Gallery has a **Videos** tab, and **Animate illustration** on a picture turns it into a clip under the newest reply. The prompt that writes video messages can be changed as **Conversation Video Message** under **Settings → Generations → Video Generation Prompt Overrides** (#7651).

- Roleplay Gallery animations accept WebP and AVIF pictures, converting them instead of leaving them out (#7651).

- A character's Gallery **Videos** tab lists a Conversation video message only when the clip shows that character: the character who sent it, any character it names, or everyone in the chat for a group photo or selfie. A persona's gallery lists a Conversation clip only when it names the persona. Older videos, and videos from Roleplay and Game chats, still list for everyone in their chat. Nothing is deleted; only what each gallery lists changes (#7695; thanks @JamesMowery).

- In Roleplay, a scene video you make from the Gallery no longer opens in a floating window by itself. It now plays in the chat under the newest reply, as a generated image does, even when its picture came from an earlier message. To float a clip, use **Pin video to chat** under the Gallery's **Videos** tab. The **X** on a clip removes it from the message and keeps it in the Gallery. Conversation messages play video attachments in the chat too. Videos are never sent to the model, and Advanced Memory ignores them. Game Mode is unchanged. Thanks to @JamesMowery (#7565).

- Video Generation connections have a **Video Prompting Instructions** field, like **Image Prompting Instructions** on image connections. Use it to tell the AI that writes your video prompts what your video model expects, such as how to describe camera moves, how long a prompt should be or which sound cues it understands. It is used when you animate a Roleplay gallery image and by Storyboard's **Image-aware shot planning**, and it is kept when you duplicate, export or import a connection. Game scene videos, call clips and animated sprites don't use it yet. Thanks to @JamesMowery (#7553).

- In Conversation chats, **Send Avatar References** and **Attach Card Appearance** are now dropdowns with **Off**, **Images only**, **Videos only** and **Images and videos**. They sit below **Video messages** in Chat Settings, so you can set them while selfies are off. With videos on, a video message's prompt gets the appearance of each character it names, and yours when it names you, and a clip whose **First frame** is **Prompt only** starts from the character's avatar. In Roleplay, the Illustrator's **Attach Card Appearance** has the same choice, so a clip animated from a Gallery picture gets the appearance of the characters its motion direction names. Existing chats keep their picture settings, the video side starts **Off**, and settings profiles save the new choices (#7845). Thanks to @JamesMowery.

- You can now draw an image again without regenerating the reply. Open an illustration, selfie, storyboard frame or Gallery image and click **Regenerate image** (the circular arrow next to the pin). Edit the prompt, the negative prompt and each character prompt, pick an **Image connection**, and click **Generate image**. The new picture replaces the old one in the message; the old one stays in the Gallery, so you can pin it back. Images made from now on remember their whole request, and their reference pictures are sent again from the characters' current avatars. Older images can be redrawn too, using the chat's current image connection, and the editor says when their negative and character prompts weren't saved (#7768).

- Roleplay characters can now place their illustrations inside the message. Turn on **Render in-line** under **Illustrations** in **Chat Settings → Agents → Roleplay Commands**, and each image a character asks for with `[illustrate: ...]` appears where the command was written, for example between two paragraphs, instead of all of them stacking up below the message. Click an image to see its prompt, or use the **X** to remove it. It is off by default and applies to new images only. Automatic Illustrator images and the Visual Novel layout are unchanged. On touch screens, the remove button on chat images now stays visible (#7750).

- Images that characters ask for with `[illustrate: ...]` now get the same NovelAI character captions and card appearance as illustrations you request yourself. Naming characters in the command no longer sends their avatars as references while the chat's **Send Avatar References** switch is off. With it on, only the named characters' avatars are sent (#7752).

- Images pinned from the Gallery keep their place and size after a reload, and resizing the browser window, or a phone keyboard opening, no longer resets them. A new lock button next to Dismiss keeps a pinned image from being moved or resized until you unlock it, and the lock is saved too (#7719).

- **Style Profiles** (**Settings → Generations → Image Generation**) no longer stop at 21. Past that point, **Clone** replaced your newest profile with a copy of itself named "… Custom", losing that profile's text and tags. Each copy now becomes a new profile, you can keep as many as you like, and if your settings ever get too big to save, Marinara tells you instead of quietly not saving them. Profiles that were already overwritten can't be brought back (#7828).

- When a character's greetings show images from other websites, **Dialogue & Greetings** in the character editor now has a **Save images locally** button. It downloads those images into the character's Gallery and points the greetings at the saved copies, so they keep showing when a link breaks, the image changes or you're offline. Nothing downloads until you press it, and **Restore web links** puts the original links back. Compatible JSON and PNG exports keep the original links. Only PNG, JPEG, GIF and WebP images up to 10 MB are saved, and links to your own computer or home network are refused. Lorebook images aren't covered yet (#7346).

- Conversation selfies now keep an **Image Appearance Override** exactly as written, so a LoRA trigger reaches the image prompt, and use the card's **Appearance** as background for details the override doesn't cover, such as build or clothing. Before, the override replaced the Appearance, and the prompt writer often dropped a trigger it couldn't make sense of. Custom selfie templates you saved before keep working as they did, and cards without an override are unchanged (#7256).

- In Conversation chats, `/selfie` and the gallery's selfie button now give the selfie prompt writer the character's **Personality** and **Image generation instructions**, as a selfie the character sends on its own already did. Before, both were left out, so these selfies came out blander (#7256).

- In Roleplay chats, the Gallery's **Background** button now shows whenever the **Illustrator** agent is installed, like **Illustrate**. You no longer need to add Illustrator to the chat or turn agents on to make a one-off scene background, and using the button doesn't start automatic Illustrator runs (#7301).

- The Illustrator, its scene backgrounds and selfies now leave your image connection's **Image Prompting Instructions** and your style profile's **Style text** to the AI that writes the image prompt. If that AI copies a full sentence of them word for word, the sentence is removed, so it no longer shows up as plain text in the image prompt review or in ComfyUI; short phrases and tag lists stay. The **Illustration** button and `/illustrate` now give the instructions next to the request, as the automatic Illustrator does, instead of above the whole chat. Scene backgrounds now get the instructions too, and selfies now get Style text you write into **Auto** or a copy of it (#7360).

- Images whose prompt no AI model writes, such as generated character avatars and character sheets, no longer get the **Auto** style profile's note "Infer a consistent visual style from the character, game, scene, and selected image model" pasted into the image prompt. That note is meant for the model that writes image prompts, and in tag prompts sent to ComfyUI and similar services it ended up as stray words. **Style text** from the other style profiles, and Style text you write into **Auto** or a copy of it, still applies (#7342).

- **Queue media generation requests** now sends image and video requests one at a time for each provider account, from every feature: the Illustrator, `[illustrate]`, Character Tracker NPC avatars, agent packages such as Slurp, the gallery and Game assets. Before, only a few places followed it, so NovelAI still turned images away when two features drew at once. Different accounts and providers still run side by side. NovelAI also gets a short pause between requests and two retries when it says it's busy. The gallery's generate button no longer queues while the setting is off (#7664).

- A local ComfyUI that saves its workflow and reference images inside each picture can return files over 30 MiB, which used to fail with a bare byte count. Set `IMAGE_GEN_MAX_RESPONSE_BYTES` in `.env` and restart to raise the limit. The default stays 30 MiB, and the error now names the setting (#7529).

### Search and Professor Mari

- **Search** is new: press Ctrl+K (⌘K on a Mac) anywhere in the app, even over another open window, to find anything, run a command or ask Professor Mari (#7312).
  - It finds characters, personas, lorebooks and their entries, presets, connections, agents, chats, messages in any chat, settings and help pages. Results are grouped by type with their pictures, a setting shows where it lives, such as **Appearance › Theme**, and the words that matched are marked in your accent color.
  - With nothing typed, it shows what needs you first, such as a failed reply or a change waiting for your answer, then a **Continue** row with your last chat, Professor Mari's last conversation and the last thing you edited, then your recent chats.
  - You can act from it: flip many settings in place, add a character or lorebook to the open chat, type "add Eliza to Tavern Night", "chat with Shrek", "new character Bob" or "dark mode", or start a new Conversation, Roleplay or Game. A **Fix** row offers to retry a failed reply with another of the chat's connections.
  - On a phone, pull down on the top bar: pull on the left to search, on the right to ask Professor Mari.
  - **Quick answers in Search** (off by default) answer a question in up to three sentences from Marinara's own help pages and list the pages they used. They see only what you typed and change nothing. **Continue with Prof. Mari** takes the question and the answer to her. Choose which model answers in the settings, including **Same as Prof. Mari**.
  - Press **?** while you're not typing, or search **Keyboard shortcuts**, to see every keyboard shortcut in the app. Thanks to @SirAdoni, whose command palette proposal in #6649 shaped this list and Search's keyboard handling.
  - Every Search and Professor Mari option is on one **Search and Professor Mari settings** page, and these settings are saved on the server, so they follow you to other browsers.

- Professor Mari now works inside Search. Open her with Ctrl+J (⌘J on a Mac), the pull-down on a phone, or **Ask Professor Mari** on Home (#7312).
  - She arrives knowing where you are. In a chat, an editor or Settings she shows a line about that screen and a few suggestions built from it, such as **Fix the last reply** or **Why didn't an entry fire?**. Nothing goes to a model until you pick one or type. She keeps a separate conversation for each chat or editor you open her from.
  - Her steps show in her reply as short lines, such as "Read Swamp Lore · 3 entries". With her window closed, a small pill in the top bar says **Working**, **Needs you**, **Done** or **Failed**.
  - What she changed shows on a card under her answer: every changed field with its old and new text, her reason, and **Undo**. Every change she applies can be undone, in every permissions mode. A change she holds for you reads **Apply** or **Don't apply**, and one that couldn't be saved says **Not saved** with **Try again**. The permissions mode menu has moved into her message box.
  - She can now repair a broken reply (a cut-off ending, a stray out-of-character line, broken formatting); the fix is added as a new swipe, so the old reply is one swipe away. She can explain why a lorebook entry fired or didn't, using the same scan as the lorebook's own test, and work out why a reply got worse or a character forgot things from the numbers saved with that reply. From the agent editor she can improve an agent's prompt or description, and she knows which agents you have installed and how their recent runs went.
  - When she ends on a question, she offers reply chips you can tap. Names in her answers open the record. She keeps her voice, sarcasm and the occasional kek included, while approvals and change cards stay literal.
  - Press and hold her to pick her up. She swings as you move, bonks off the screen edges, and gets dizzy if you shake her. Reduced motion keeps her still.
  - She opens faster, long conversations load and scroll faster, server replies are compressed, and her artwork went from about 41 MB to about 8 MB.

- Professor Mari has appearance packs, chosen in **Search and Professor Mari settings**: **Basic**, **Prof. Mari loves Dottore**, **Safari Prof. Mari** and **Golden Prof. Mari**, which unlocks after 100 hours of play. The look you pick shows everywhere she appears, and only that look is downloaded (#7312).

- The Home navigator, the small Professor Mari on Home who found pages by keyword, is removed along with its **Professor Mari navigation** setting. The pages she linked to (Discord, Credits, Tutorial, Home widgets and the Home tab of each installed app package, such as Noodle) are in **Search** now (#7312).

- Search and Professor Mari's window can be resized on big screens. Professor Mari's window is a little taller on computers, and height and width sliders in **Search and Professor Mari settings** set how big each one is. Both keep their current size until you move a slider, and phones keep the full-screen window (#7398, #7501).

- Professor Mari has a new, experimental **Pi** runtime, and she uses it by default, also after updating from 2.5.0. On Pi she keeps your connection's reasoning settings, can work through long tasks without the 12-round limit, and works with every connection, including the local model. Your permissions mode, change cards and Undo work the same in both, and in Manual mode **Accept** applies exactly the held changes without asking the model again. To go back to the original runtime, change **Runtime** (below **Permissions mode**) in **Search and Professor Mari settings** to **Classic**. Marinara keeps that choice (#7570, #7882).

- If Pi fails three times in a row, Professor Mari's message box offers **Switch to Classic**, and while Classic is chosen it offers **Try Pi again**. Switching keeps the conversation and sends nothing again; it applies to your next question (#7882).

- Professor Mari no longer says she changed or deleted something when she only looked at it. She can say she made a change only after actually making it in that answer (#7882).

- The grey name suggestions in Search and Professor Mari's message box no longer stop at a space: after `Lady `, the rest of **Lady Celeste** still appears (#7882).

- Professor Mari's words now show while she writes, and a step that created or changed several items lists their names on its row. Tool calls that DeepSeek, Kimi K2, GLM, Qwen3-Coder, MiniMax M2 and Mistral models write as text are now read correctly, and in Roleplay chats with function calling, the text a model writes beside such a call is kept (#7570).

- Professor Mari's composer has the same connection and model picker as the chat input: your connections on one side and the chosen connection's models, with search and pins, on the other, so you can change her model without leaving her chat. On a phone it shows one step at a time. **Retry with another model** also works after you switch models on the same connection (#7656).

- Professor Mari's change card now shows changes deeper inside an item instead of counting them as "1 more field changed". A character's onboarding, for example, gets its own row that reads **On · 5 persona questions · 1 character question** and names what changed, and a list inside a field, such as a preset's stop strings, shows its added, edited and removed entries (#7782).

- An install with no Professor Mari skills yet gets one example skill, **ask-before-building**, switched off. Turn it on in her **Skills** list and she asks a few short questions with answers you can tap, or proposes one plan, before she builds something, instead of building first from her best guess. It's an ordinary skill: edit it, switch it off or delete it, and it doesn't come back (#7822).

- When the server turns down a question to Professor Mari before saving it, the question and its attached files go back into the message box, ahead of anything you typed since, so you can change it and send it again. Before, the question disappeared. **Retry** on the error card sends what is in the message box, or the failed question when the box is empty (#7700).

- When Professor Mari leaves out a required value in one of her app actions, the error now names the argument to pass and, for a missing id, tells her to list or search first. Models such as GLM now correct the call instead of repeating it until the run stops (#7577).

- When Professor Mari changes one of a character's extra fields, such as the depth prompt, she no longer erases the card's other extra fields, like **Appearance** and **Backstory**. Her edits change only what she meant to change (#7764).

- Professor Mari can now read every entry of a big lorebook. She reads the entry list one page at a time and asks for the next page. Before, she got the same first entries every time and couldn't review or edit the rest (#7413; thanks @bahaynes for the report and the script that reproduced it).

- Professor Mari can now read every chat. About one chat in 4,096 has an ID that starts with two dashes, and for those her chat and message lookups failed with a usage error. Searching chats for text that starts with two dashes failed the same way, and listing the chats of a character whose ID starts with two dashes returned every chat (#7291).

- Settings search, the settings results in Cmd+K / Ctrl+K search and Professor Mari's setting cards show setting names and descriptions in your app language when a translation exists. Before, most descriptions and some names always showed in English. Searching in English still finds them (#7683).

- In Conversation and Roleplay chats, a reply that failed leaves a quiet **Failed · Retry** line under your message after the error toast fades. A reply that was cut off, or whose prompt dropped older messages or shrank the reply limit to fit, gets a line such as **Cut off · Check**. **Check** lists what happened, with a link to the setting that fixes it (**Max output tokens**, **Max context window**, the lorebook token budget or the character card). It uses the numbers saved with the reply and makes no model call (#7312).

- **Not now** in the **Agent updates available** dialog now closes it at once and declines every listed update in one step. With many updates waiting it could stay locked for over a minute, and a reload could bring the updates back (#7312).

- Quick answers and the bulk decline of agent updates now have request limits of their own, and the help viewer no longer serves Marinara's internal development notes (#7312).

### Interactive onboarding and characters

- Character cards can now offer **interactive onboarding**: the card asks the player a few questions and builds their persona from the answers. Card authors set it up in the Character Editor's new **Onboarding** tab, with free-text or multiple-choice questions, follow-up questions that appear only after certain answers, and persona fields that use the answers. When you start a Roleplay chat with such a card, the persona picker offers **Create your persona**: answer the questions and a normal persona is created and selected. Marinara and PNG exports keep the onboarding; Compatible JSON exports leave it out (#7308).

- A character card can now ask **Character Questions** as well as persona questions. The answers are saved on the chat, not the card, so the same card can read differently in every chat you start with it: write the answer's name into a card field, such as `{{relationshipToUser}}`, and each chat fills in its own answer. On the card's **Onboarding** tab the two lists are now **Persona Questions** and **Character Questions**, the persona fields sit under a **Persona Template** heading, and the card's own fields offer the answers as chips you can insert. A chat started outside the chat wizard uses each question's first option, so a field never shows a raw tag (#7439).

- While you answer a card's onboarding questions, the new **Review persona** button shows the persona your answers will create: its name and the five persona fields exactly as **Create persona** will save them, with the parts your answers filled in highlighted. It works before every question is answered, and nothing is saved until you click **Create persona** (#7778).

- A card's questions can be answered after the chat has started, not only in the setup wizard. In a Roleplay chat's **Chat Settings**, the **Persona** picker offers **Create your persona** for each character whose card can build one, and sets the new persona on that chat. In **Characters**, the questions marker beside a card (**Answer this card's questions**) opens that card's questions with the answers the chat already holds, so you can change one and keep the rest. **Add Character** shows the same marker, so you can tell which cards ask questions before adding them (#7799).

- Removing a character from a chat also removes the chat variables its questions created, unless another character still in the chat uses the same name (#7799).

- Professor Mari can write a character's interactive onboarding for you. Ask her for one, with a template persona and a character question or two, and she writes the persona questions, the persona template and the character questions, turns onboarding on, and puts each character question's answer into the card's description, personality or scenario. Her onboarding is checked before it is saved, and every problem, such as a misspelled answer name, comes back to her at once, so she fixes it instead of saving something the editor can't read. You can undo it like her other edits (#7769).

- The **Card Browser** has two new sources, **PlotLight** and **PlotLight Personas**. Search by name, sort by Popular, Recent or Top Rated, filter by tags, and import a result as a character or a persona, with no account needed. Each result shows its creator and links to its PlotLight page. Adult-tagged results carry the NSFW badge; PlotLight decides what visitors without an account can see. When PlotLight is busy, Marinara says how many seconds to wait (#7495).

- In the Card Browser's source menu, every source name now lines up, and CharacterTavern's **Unavailable** label sits under its name instead of being cut off at the menu's edge on phones (#7530).

- The tag box in the character editor's **Metadata** tab now suggests tags you already use as you type, most-used first, with how many characters have each. Tags the character already has are left out, the arrow keys, Enter and Escape work in the list, and you can still type a new tag (#7428; thanks @minikkeuen).

- The character editor now says which chats use these card fields: only Roleplay chats start with the **First Message** or an **Alternate Greeting** and use the **Message Box Color**, and Conversation chats don't use the **Dialogue Highlight Color**. The character guides say the same and no longer claim that the message box color applies in Conversation chats (#7414).

- The corner handles in **Avatar Crop** are now whole, a little larger and easy to grab when the crop reaches the edge of the picture, as it does by default for square avatars. Before, they were cut down to tiny slivers in the picture's corners (#7334).

### Trackers and the State Editor

- New **State Editor** for fixing tracker data by hand (#7737, #7739, #7780, #7790, #7793):
  - Open it with the **{ }** button (**Open in State Editor**) in the Tracker Panel's settings, in the title bar of the **Trackers** window and of every popped-out tracker, and next to lock and close on the phone **World State** and **Player & Tracker** sheets. It opens on that tracker's section, for example **Present Characters** for Present Characters and **Scene** for World State. From **Agent Suite** it opens on the section of the agent you're looking at.
  - It shows the current turn's trackers as sections (**Scene**, **Present Characters**, **Persona Stats**, **Inventory Tracker**, **Custom Tracker Fields** and **Active Quests**), searches every key and value at once, and jumps to the result you pick.
  - Each section opens as **Fields**: text, numbers and on/off values are boxes you type in, and each character, item or quest gets its own card, so fixing one mood or HP value no longer means editing JSON. An empty value offers **Text**, **Number** or **On/off**, the **×** beside a value sets it back to **No value**, lists have **Add item** and a **×** on each entry, and you can add a field to a section. A new entry copies the fields of the one above it. New present characters and quests still can't be added here. Switch to **JSON** to edit the raw data, colored in your theme's colors.
  - **Review changes** shows line by line what changes in each section before **Save changes** writes it to the turn you are viewing. A line under the search box names the message and swipe you are editing. If a new reply, a swipe or a tracker agent changes that state while you edit, the save is refused with a **Reload** button instead of overwriting it. It works on phones too, and the HUD and Trackers guide has a new **The State Editor** section.
  - **Chat Settings → Chat Variables** has a **Search and edit all in the State Editor** link that opens all of a chat's `{{name}}` variables in one searchable list. Saving changes only the variables you edited, so a `{{setvar}}` that lands meanwhile under another name is kept.
  - In **Agent Suite**, JSON tracker blocks use the same editor field with line numbers, show errors while you type, and keep **Save** off until the JSON is valid. The **Tracker Data** header links to the State Editor.

- A value you correct by hand in the **Tracker Panel** is now what the next reply starts from, also when you regenerate or swipe the reply you corrected. Before, a regeneration started from the previous reply's trackers, so the wrong value you had just fixed came back. The trackers can still change the value in the new reply. Each swipe keeps its own values, a correction goes away when you delete its swipe or reply, and a branch made from an earlier message doesn't get it. **Clear Trackers** now removes your corrections on every swipe of the chat, so a cleared correction can't come back on the next regeneration (#7288, #7290).

- **Present Characters** field locks work again in the **Trackers** window and the Tracker Panel. In lock mode the lock button now looks pressed, and every field you can lock shows a padlock that closes when you lock it. A locked name also stays put: if you rename a character matched to a card and lock the name, the Character Tracker no longer changes it back to the card's name on the next turn (#7728).

- A minimized **World State** tracker keeps the story's place, date and time in view again. On a computer, pop World State out of the Trackers window and close it: its button becomes a small banner with a location pin, calendar, clock, weather and temperature, like the World State banner before 2.5.0. Drag it anywhere, such as the top middle of the chat, and the chat remembers where. Click it to open the window again. On a phone, the World State button shows the same banner (#7340).

- Character Tracker portraits now show the outfit the tracker noted, with every style profile. Several styles used to drop it, so portraits came out in the wrong clothes or none at all. **Include the outfit in portraits**, under **Auto-Generate NPC Avatars**, is on by default. When the Character Tracker has an image connection, a character's large tracker card also has two buttons to make a new portrait, from the look alone or from the look and outfit. The old portrait stays until the new one arrives, and stays if it fails (#7516).

- The **Manual Trackers** switch is gone from Roleplay **Chat Settings → Agents**. Set trackers to manual one by one under **Individual tracker schedule** instead. Chats that had the switch on show every tracker switched to manual there and keep running them only when you ask. **Agent Menus** now sits right under **Enable Agents**, and **Attach chat summaries**, **Attach Lorebooks to Trackers**, **Review Agent Outputs** and **Individual tracker schedule** share one **Trackers Control** section that starts closed, so the drawer takes less room (#7303).

- Tracker agents' own buttons, such as the one that opens **Quartermaster**'s dock, are back at the top of the **Tracker Panel** on computers and phones, including a popped-out panel. Since the 2.5.0 chat window redesign they only showed in the Trackers window, so with the Tracker Panel on there was no way to open Quartermaster's portrait, settings or outfits (#7343).

- **Quartermaster** works from other devices again. Opened from a phone, another computer on your network or remote access, its **Tracker Panel** section and dock failed with "Invalid or missing X-Admin-Secret header" even with the Admin Secret saved, and item pictures, outfit portraits and slot icons didn't load. If the secret is missing or wrong, the message now says how to fix it (Marinara-Agents#1299; thanks @newfiesledneck).

- In Roleplay chats, the **Agent activity** icon now shows what your agents are doing. It turns into a spinner while they work, and a dot appears on it when an agent fails, until you open **Agent activity**. This works in **Chat Settings**, the **Trackers** window, the **Tracker Panel** and on a popped-out Agent activity button, on computers and phones (#7337).

- On a computer, the Tracker Panel docked beside a Roleplay chat stays usable. The **Chat Settings** button now starts just left of a panel docked on the right instead of covering the panel's **Help** button. In a window too narrow for both, such as 1024 px wide or with the chats sidebar open, the messages narrow a little instead of the panel shrinking to a thin strip or vanishing. Switching between Roleplay chats no longer hides the docked panel, and a **Chat Settings** button you moved yourself stays where you put it (#7206).

- In Roleplay on a computer, movable chat windows and buttons, such as the Trackers window and popped-out tracker windows, can be moved or stretched into the space left and right of the message box, down to the bottom of the chat. The ones beside the message box stay put when you type several lines, and nothing can cover the message box itself. Phones are unchanged (#7717).

### Advanced Memory and summaries

- **Character recollections** (Roleplay, off by default): turn it on in Chat Settings → Memory Recall → Advanced Memory, and each character who was in a scene gets a short memory of it in their own voice, shaped by their card. When the scene is recalled, a character replying alone sees only their own recollection under the scene's summary, a merged reply shows everyone's, and the Narrator sees none. A character only remembers what they could see: messages hidden from them stay out, and a recollection that copies something they couldn't know is thrown away. New scenes get their recollections from the same request that writes the scene summary, and turning the switch on in a prepared chat writes them for older scenes. Recollections count toward the **Summary and recall budget**, can be read and edited under **Access memories for this chat**, and go along with exports, imports and branches (#7605).

- In **Access memories for this chat**, each character recollection has a **Delete** button next to **Save correction**. A deleted recollection stays deleted through later updates, **Prepare** and **Resume**, and you can write a new one in its place (#7644).

- In Roleplay group chats where characters reply one by one, Advanced Memory can now decide who sees each new message. Turn on **Decide who sees new messages** in **Chat Settings → Memory Recall → Advanced Memory Recall**, and each new message is hidden with **Hide from AI** from characters who aren't in the scene, such as someone who has left the room. The Decision model decides when **Use Decision model** is on; otherwise the **Helper model** does, in the same request as its scene check when one is due. The narrator and the message's author always see the message, a character can be present without speaking, and if you change a message's **Hide from AI** yourself, your choice stays. It is off by default, isn't offered in merged group chats, and hides nothing if the model fails (#7199).

- **Decide who sees new messages** now hides a message from a character only when the Decision model is confident they can't see or hear it, for example because they are elsewhere or have left. When the model is unsure, the character keeps the message, so a character standing in the scene no longer loses a reply. The Decision model is also told who wrote the message, the Helper model follows the same rule, and the first message of a new scene now comes with the last few messages before it instead of on its own (#7265).

- In Roleplay group chats where characters reply one by one, **Decide who sees new messages** keeps hiding new messages from characters who are elsewhere, however long a scene runs. Before, once a scene had run for a few messages, it stopped hiding anyone and you had to hide messages by hand. A character now counts as away when every earlier message of the scene, at least four, was hidden from them, and the model is shown their last message so it knows where they are. A single step-out or a short cutaway doesn't make anyone away (#7391).

- In Roleplay group chats where characters reply one by one, **Decide who sees new messages** now decides your own message as soon as you post it, and its crossed-eye **Hide from AI** marker shows before the first character replies. Before, a message posted without a reply (**Manual** response order, **Post only** or `/send`) or written by **Impersonate** waited until the next reply was requested, and on a normal send the marker showed only after every character had replied. With the setting on, a message posted without a reply now appears once that decision is made, usually within a second or two (#7351).

- With **Decide who sees new messages** on, a message that carries a whisper to a character who isn't in the scene is hidden from that character like any other message, and the whisper still reaches them (#7211).

- With **Advanced Memory** on in Roleplay, a new reply that changes scene or point of view at a break line such as `***` or `---` is saved as one message per part, so each part can have its own audience. A part that follows one character alone is no longer shown to characters who were somewhere else. The break line stays at the top of the part after it, the character who wrote the reply still sees every part, and text-rewrite agents such as Prose Guardian, Continuity and Immersive HTML rewrite each part on its own. Swipes, Continue and Impersonate still give a single message, and regenerating an earlier part keeps only its own scene (#7497, #7507).

- In Roleplay chats, **Advanced Memory** now tells you when a chat's memory needs attention, even with Chat Settings closed. A steady dot appears on the **Chat Settings** button, and a notice says how many scenes have problems, once for each new problem. Press **Fix** to repair them in one run. It asks the Helper model again who was in scenes marked **Check who was there**, checks older scenes, writes new summaries for scenes whose messages, hidden messages or character names changed and for finished scenes that have none, and resumes memory work that stopped with an error. **Pause processing** and **Resume processing** work during a Fix. Fix never rewrites a summary you edited by hand, and when the Helper still can't tell who was there, no character gets more access than before. When it finishes, **Chat Settings → Memory Recall** lists the fixed scenes and the ones that need your review as scene numbers that open in **Access memories for this chat**. The notice that Advanced Memory stopped now also shows with Chat Settings closed. Before, these problems only showed in the server log or inside the memory menu, and each scene had to be fixed by hand (#7236, #7240).

- Adding a character to a Roleplay group chat no longer holds back Advanced Memory scene summaries that had a message hidden from one of the characters. Before, each such summary dropped out of the prompt for the characters who saw only part of the scene until the Helper model wrote it again, at a cost, although nothing they knew had changed. Renaming a character the summary was written for, or changing which of its messages they can see, still holds it back as before. Summaries saved by earlier versions need one **Fix** after a character joins (#7247).

- Advanced Memory no longer stops at "0 of 1 work unit completed" with "Chat Summaries changed while being combined; retry" when a chat's Chat Summaries are stored out of message order. A chat stuck this way only needs **Resume** after updating; its summaries are kept (#7876).

- When Advanced Memory's constant Chat Summaries go over their share of **Summary and recall budget**, the Helper model now also combines and shortens the summaries it wrote with private parts for some characters, such as a secret only one character knows. It gets them with their character conditions and your **Combine prompt**, and each private part stays readable only by the characters who knew it. Before, these summaries were skipped, so in group chats most of them were never combined, a character could stay over budget, and later replies kept paying to shorten the other summaries again. A result that would change who can read a private part, or that isn't really shorter, isn't saved and isn't asked for again after every reply (#7275, #7284).

- In Roleplay chats with Advanced Memory, constant Chat Summaries now stay within their share of **Summary and recall budget** in group chats too, and each character's private parts stay private. Before, in group chats they were shortened again on almost every reply but never combined, and the narrator missed summaries written for one character. **Changed:** summaries you wrote or edited yourself are now combined too when they're over the budget; the originals stay in Chat Summaries as inactive entries you can turn back on. The Advanced Memory narrator reads every summary, each once, and a character no longer sees the message range or date of a message hidden from them (#7458, #7463).

- In merged Roleplay group chats, Advanced Memory now combines only the Chat Summaries that the same characters read, as it already did in one-by-one chats. A summary only some characters could read was combined with shared ones, so the other characters got the message range and story dates of messages hidden from them. The check that stops the Helper from copying a private sentence into text every character reads now also works in Chinese, Japanese and other languages written without spaces, and on text the Helper puts next to another macro (#7285).

- In merged Roleplay group chats, adding a character partway through no longer makes Advanced Memory drop earlier scenes and Chat Summaries from the prompt. A memory is now recalled when at least one character in the chat remembers it, not counting the narrator, so memories only the narrator has stay out. Memories that not everyone present knows are marked with who does, such as "known only to Kaito", instead of character-specific summaries being read as one arbitrary character, sometimes the newcomer. A merged chat of the narrator and one character now reads its summaries as that character; before, narrator-only parts could reach the prompt and the character's own parts were left out. Group chats where characters reply one by one are unchanged (#7239).

- In merged Roleplay group chats without Advanced Memory, a Chat Summary section written for certain characters with `{{#if char == "Name"}}` now reaches every character in the chat it applies to, marked with who knows it, such as "known only to Kaito". Before, the whole summary was read as the first character in the chat, so only that character's private sections reached the prompt, and narrator-only sections did when the narrator came first. This covers summaries Advanced Memory wrote before you turned it off. Narrator-only sections now stay out, also when you pick which character replies, and **Peek Prompt** shows the summary the same way. Group chats where characters reply one by one, **Impersonate** and single-character chats are unchanged (#7254).

- Advanced Memory no longer adds an empty "Messages #…; source timeframe: unknown" line to the prompt for a Chat Summary that has nothing for the characters replying, such as one written only for another character or for the narrator. These lines no longer use up the memory budget, and **Peek Prompt** shows the same. When those messages have a known story date, the line stays for characters who saw part of that scene, so they still know when it happened, but a character who joined later no longer gets dated lines for scenes they never saw. Summaries written for other characters also no longer count toward a character's share of the budget, so they can't trigger a paid Helper call to shorten that character's summaries (#7255).

- Advanced Memory recall now finds past scenes about something you mention by name, such as your persona's pet. With **Use Decision model** on, recall used to send every past scene and message chunk to the Decision model at once, so on long chats it ran out of time and fell back to text matching, which could pick a scene about cats at an inn over the scenes about your cat. Now ordinary recall first shortlists up to 24 scenes (more if **Maximum recalled scenes** is higher), the Decision model picks scenes from that list and then which of their messages to quote, and each step gets its own time limit. In text matching, names from your latest message count for more, except the replying characters' names, your persona's name and names found in most memories. **Advanced Memory activity** shows both steps (#7187).

- With the Decision model on, Advanced Memory recall finds the right scene more often in long chats, especially for "what happened after X" questions, characters who appear in many scenes, and questions worded differently from the scene. The scenes the Decision model reads are now picked by meaning as well as by matching words, using every message you sent since the replying character last spoke, so in a group chat it also covers what you said to someone else first. Existing chats fill in what they need a little at a time after each reply; you don't need to reindex (#7701).

- Decision recall gives slower Decision backends more time, up to 25 seconds per pass and 40 seconds in total. When the work doesn't fit in that time, it judges fewer scenes, best first, instead of falling back to ordinary recall. Word matching in recall also works better for Chinese and Japanese text (#7701).

- Advanced Memory no longer drops a scene's participants when the Helper model shortens a name, such as "Kaito" for **Kaito Nakamura**. A name that could also be your persona's, or that fits two characters, gives the scene to no one; Advanced Memory warns about names it can't match, and you can check those scenes in **Access memories for this chat** with **Edit character access**. Older scene summaries get the same check, a few after each reply. A swipe now recalls again when a scene has been saved since the first reply, instead of reusing a recall that missed it, and when nothing is recalled, the memory receipt says why: nothing to recall yet, no room left, or nothing relevant (#7203).

- In Advanced Memory group chats, a scene whose Helper model doesn't say who took part now goes to every character instead of only the narrator. It is marked **Check who was there** in **Access memories for this chat**, so you can remove anyone who wasn't there with **Edit character access**. A character hidden from every message of that scene still doesn't get it, and names that fit no character still give no access (#7224).

- With **Use Decision model** on in Advanced Memory, recalled scenes now get the message excerpts the Decision model picked, up to **Maximum messages per excerpt**. Before, each excerpt held only **Minimum messages per excerpt** (at least one), and the model's other picks were dropped and shown as **Not selected** in Decision diagnostics. Every recalled scene now gets its minimum excerpt before any excerpt grows, so one long excerpt no longer leaves the next scene without one. When a recalled scene still has no excerpt, the memory receipt and **Peek Prompt → Decision diagnostics** say why: not enough memory space was left, or none of its messages can be quoted (#7277, #7278).

- Advanced Memory recall now includes message excerpts from scenes whose summaries have parts meant only for some characters. Before, only the narrator got excerpts from those scenes, so in group chats, where most summaries have such parts, recall gave scene summaries but almost never message excerpts, even with plenty of room. An excerpt quotes only the messages that character saw in the chat, so messages hidden from them stay out and whispers never appear. In a merged group chat, it quotes only the messages every character who remembers the scene saw. Each character still gets only the parts of a summary meant for them. In a chat that switches point of view without hiding messages, a character's excerpt can now quote the other point of view's lines; hide those messages from the character to keep them out of their memory (#7279).

- When Advanced Memory has to leave out recalled memories so the whole request fits the context limit, the memory receipt and **Peek Prompt → Decision diagnostics** no longer give reasons about message excerpts, such as that text matching chose them. No scene was recalled, so those reasons didn't apply and could suggest raising a budget that wouldn't help (#7281).

- With **Use Decision model** on in Advanced Memory, recall no longer asks the Decision model to pick message excerpts when no excerpt could fit in the room the scene summaries left. Before, it still sent that second request, which a hosted connection may charge for and which could hold up the reply for up to 10 seconds, and then recalled no excerpt anyway (#7283).

- In Roleplay group chats where characters reply one by one, **Peek Prompt → Decision diagnostics** now shows the inspected character's own Advanced Memory recall. Before, it showed the latest recall of whichever character had one, so a character who joined later seemed to have the Decision model judge scene summaries they could never see. The Decision model was never actually asked about those memories. This also holds when you open the prompt with `{{prompt}}`, inspect a reply from a character who is now inactive or has left, or the group is down to one character. **Preview inputs** and **Test decisions** now preview the inspected reply's character instead of the first character in the chat (#7267, #7273, #7272).

- With **Use Decision model** on in Advanced Memory, scenes end again. A scene change had to score at least 0.8, which hosted Jev never reached, so the ongoing scene kept growing and nothing new was summarized while the status said Memory Ready. The Decision model now uses its own threshold, sees the three messages before each new one and who wrote them, and also catches scene-break lines such as `***` and out-of-character POV notes. A scene can now end right where one check hands over to the next. **Peek Prompt → Decision diagnostics** lists these answers as **Scene start** (#7373).

- **Re-scan scenes** in **Chat Settings → Memory Recall** looks for scene changes again between two message numbers and summarizes the new scenes. Scenes outside those messages stay as they are, and it stops instead of changing a summary you edited by hand. It starts on the ongoing scene, so a scene that never ended can be split in one go (#7373).

- Advanced Memory's scene check now reads every message since the last check, up to twice the **Standalone scene check interval**; for a longer backlog, use **Re-scan scenes**. Before, when your message and a reply arrived together, the oldest new message could be skipped. The Helper model now also sees who wrote each message and the message the last check ended on, so a scene can end right where one check hands over to the next. It also counts a switch to characters who are elsewhere, or a scene-break line such as `***`, as a scene change (#7374).

- In Advanced Memory, **Memory Decision connection** now also lists your local models, such as the **Primary local model**, the same way the global **Decision model** does. Choosing one makes scene checks and recall ask that model. Before, only saved Decision connections were listed, so a local model that already answered lorebook decisions couldn't be picked here. A local model that is still loading doesn't hold up the reply: recall stops waiting after its usual 10 seconds, and cancelling a reply stops the wait (#7333).

- **Advanced Memory** works with a Claude model as the Helper. Before, Marinara treated every finished Claude reply as unfinished, so preparing a chat stopped at the first scene with a did-not-complete error, and each try paid for the same requests again. Replies are now judged by what they contain; one that was cut off, refused or failed is still turned away (#7637).

- Branching a Roleplay chat that uses **Advanced Memory** keeps the memory it already prepared, so the branch no longer has to prepare its whole history again. A branch made in the middle of a scene reopens that scene and drops only the memories that depended on the messages left out, and earlier scenes can be recalled straight away. Paused processing stays paused in the branch, and automatic Chat Summaries you deleted stay deleted. Branching also keeps the reply you had selected, even when its saved swipe was missing, instead of picking up an older reply (#7759).

- Long Roleplay chats with **Advanced Memory** start replying much sooner. Getting memory ready for a reply used to check every stored memory against the whole chat, so the wait before the first word grew faster than the chat itself, to about 5 seconds at 800 finished scenes. Each message is now looked up once per reply instead of once per stored memory (#7730).

- With Advanced Memory on, a dice roll or function call no longer moves the context start to the latest scene. Only the prompt sent for the narrator or a character counts, and it now cuts as soon as it reaches **Maximum allowed context before compression**, not only once it passes it. A roll or function-call follow-up that grows past that limit no longer fails the reply; only the model's own context window limits it (#7456).

- While **Advanced Memory** prepares a chat, the progress counter counts scenes steadily (3/10, then 4/10) instead of jumping to 1/1 or 1/2 when a long scene is summarized in parts (#7653).

- Parts of a summary written for one character (`{{#if}}` sections) no longer leave empty lines in the prompt of characters who don't see them. This covers Chat Summaries in one-on-one and group chats, Peek Prompt, and Advanced Memory scene and constant summaries. Your saved summaries are not changed; the cleanup happens only when the prompt is built. After updating, the first swipe in an Advanced Memory chat prepares its memory once more so the prompt matches (#7593).

- In long chats, the newest manual summaries no longer drop out of the prompt. Prompt text over 200,000 characters was cut short while macros were filled in, even when it contained no macros, so a chat with 95 summaries sent only the first 73 although the model had room for all of them (#7756).

- Advanced Memory now starts new chats with a **Summary and recall budget** of 10% of the default context, 6,500 tokens instead of 4,096. Chats that already have Advanced Memory settings keep their budget (#7601).

- In **Advanced Memory Recall**, the two budget boxes now sit side by side in Chat Settings and the Roleplay setup wizard. The help under them explains how the budget is shared and recommends at least 10% of the context, the **Helper model** help says it also writes constant summaries, and **Minimum / Maximum messages per excerpt** now has its own help: set both to 0 to leave excerpts out. The Memory guide says the same (#7595).

- In a Roleplay chat with **Advanced Memory Recall** on, **Chat Settings → Advanced Parameters** now says under **Limit Context Messages** that the limit isn't used there. Advanced Memory decides how much history to send with its **Maximum allowed context before compression (tokens)** setting, so lower that to send less. Before, the limit looked active while every message that fit Advanced Memory's cap was still sent. Conversation, Game and Roleplay chats without Advanced Memory keep using the limit (#7331).

- **Chat Summary** can now switch many entries on or off at once. On a computer, tick an entry, then Shift-click another to select every visible entry between them, and use **Enable selected** or **Disable selected** to change only those. In a long Roleplay chat with hundreds of summaries, bringing back a few of the originals kept by **Combine** no longer means toggling them one by one. On phones, tap entries to select them as before (#7166; thanks @olegpro171).

- In **Chat Summary**, a summary you **Write** while **Summary Scope** is **Range** now covers the selected messages, as **Generate** does: the entry shows its range, and with **Hide summarised messages** on, those messages are hidden. Before, it was saved as if no range was picked. With several ranges, it covers the first. If the range can't be used, **Write** or **Save** says why, and you can pick another range and save again without losing your text (#7416).

- Applying a settings profile that turns **Hide summarised messages** on or off now hides or shows the summarised messages too, as the switch in the summary popover does. Before, the switch changed but the messages did not, so they were still sent to the AI beside their summary, or stayed hidden with the switch off (#7442).

### Connections

- **Claude (Subscription)** connections now use the Claude Code installed on your computer when it is at least as new as the copy that ships with Marinara, and the model list shows the models Claude Code lists for your account. New Claude models appear without waiting for a Marinara update, and models your account can't use are left out. Without an installed Claude Code, as in Docker, Marinara uses its own copy, now updated to Claude Code 2.1.293, which knows **Claude Haiku 5.5**; Haiku 5.5 and Claude Fable 5.1 are also on the built-in model list. To always use the copy that ships with Marinara, set `CLAUDE_SUBSCRIPTION_USE_INSTALLED_CLI=false` (#7314, #7339; thanks @dariusjm290-code).

- On Android (Termux), **Claude (Subscription)** now uses the Claude Code you installed even when it is older than the copy Marinara bundles, since the bundled copy can't run on Android. Before, an older install stopped the connection from working at all. With more than one install, the newest one is preferred (#7460; thanks @qrewq5003-oss).

- **Claude (Subscription)** no longer spends your subscription limits on a hidden extra request that Claude Code makes to name each new session. It used to run on every new chat, every summary, agent run and connection test, and on every message in fold mode. Marinara also removes the context Claude Code adds for coding work, such as your account email, the server's working folder and operating system, and an empty project-notes section, so it no longer goes out with your chats or changes how the model plays a character. Noodle, Slurp and Conversation Calls get the same fix in their own updates, and a connection's **Custom Parameters** can't switch these protections off there (#7448, Marinara-Agents#1356; thanks @JurijPietrowicz).

- On a Claude (Subscription) connection with **Extended token caching (1 hour)** on, Claude now reuses the earlier chat history from its cache and only processes the newest part again. Before, each message wrote the whole history to the cache again, about 125k tokens per message in a 130k-token chat, which used up your plan faster on long chats. With the setting off, Claude reuses only the instructions at the start, as before (#7866). Thanks to @stonebystone.

- The subscription usage meter now covers **Claude (Subscription)** and **OpenAI (ChatGPT)** connections as well as NanoGPT. Turn on **Show subscription usage** to see how much of your plan's 5-hour and weekly limits is used and when each resets, in the connection editor, the chat's connection settings and the **Connections** menu by the chat input, on computers and phones. Reading it sends no prompt and costs nothing. **5-hour window** and **Weekly window** turn each bar on or off. The numbers cover your whole account, including use outside Marinara. NanoGPT's meter now also shows when its allowance resets (#7648).

- **DeepSeek** is now a built-in connection type: pick it, paste your key, and its current models, such as `deepseek-flash`, and its **Reasoning Effort** levels are ready to use. Its thinking shows in the reply like any other thinking model, and settings DeepSeek ignores are hidden instead of pretending to work. Before, an **OpenAI** connection pointed at DeepSeek hid Reasoning Effort and sent almost none of your settings. The model list drops `deepseek-chat`, `deepseek-coder` and `deepseek-reasoner`, which DeepSeek has retired (#7402).

- Mistral connections now work with **Mistral Large 4**, which has a 1M-token context and reads images. Its thinking shows in the chat instead of arriving as raw data, also while streaming, and **Reasoning Effort** offers Off or high, the two levels Mistral's reasoning models accept. Refreshing the model list picks up each model's real context size, and the connection **Test** works with it. Requests no longer send settings Mistral rejects, and a system message after a reply is sent in a form Mistral accepts (#7169).

- **Gemini 4 Argon** is in the model list for **Google Gemini (AI Studio)** and **Google Vertex AI** connections, with its 1M-token context and Low, Medium and High thinking. Argon can't turn thinking off, so a saved Off sends Medium, Google's default. Temperature, top-p, top-k and the penalties are hidden and not sent, since Argon ignores or rejects them; this also applies on OpenRouter and NanoGPT. On Vertex, Argon replies with thinking stream as they do on AI Studio, and Argon runs only in the `global`, `us` and `eu` locations. Argon counts its thinking against **Max Tokens**, so raise it if replies come back empty. A reply cut off at Argon's output limit is now reported as cut off. New Google connections still start on Gemini 3.8 Flash (#7536, #7541).

- Gemini requests through Google AI Studio and Vertex AI now turn Google's adjustable safety filters off. Before, Marinara sent no safety settings, so newer models such as Gemini 4 Argon, whose default Google doesn't document, could block replies that Gemini 3 allowed. Google's core protections, such as child safety, still apply, and when Google does block a reply the error still gives its reason (#7544).

- A safety setting you add yourself in **Custom Parameters** on a Google AI Studio or Vertex AI connection now changes only the category it names. The other categories stay off instead of going back to Google's defaults (#7552).

- Frequency and presence penalties are no longer sent for Gemini 3.5 Flash-Lite and Gemini 3.6, 3.7 and 3.8 Flash on Google AI Studio, Vertex AI, OpenRouter and NanoGPT, and the panel hides them for these models, because Google rejects them. A custom connection still sends them (#7560).

- Gemini 4 Argon, Gemini 3.5 Flash-Lite and Gemini 3.6 to 3.8 Flash no longer fail after a preset with an Assistant Prefill, or when you press Send with an empty box after a reply. Google refuses a request that ends on an AI turn for these models, so Marinara adds a short user turn asking the model to continue. Argon already had this on Google AI Studio and Vertex AI; it now works on OpenRouter, NanoGPT and custom connections too, and for the newer Flash models everywhere (#7560).

- With **Post-Processing: Don't Apply**, Gemini models on OpenRouter, NanoGPT and custom connections now get system messages that come after the first turn as user messages, in the same place. Tool calls with Gemini on OpenRouter now send back the reasoning details OpenRouter asks for (#7560).

- **Temperature**, **Top P** and **Top K** are hidden and no longer sent for Gemini 3.5 Flash-Lite and Gemini 3.6 to 3.8 Flash on Google AI Studio, Vertex AI, OpenRouter and NanoGPT, or for `google/gemini-4-argon:online` on OpenRouter. Google ignores these values for these models, so replies should not change. A custom connection still sends them (#7569).

- Regenerating one of your own messages with a Gemini model on OpenRouter, NanoGPT or a custom connection now rewrites your message, as it already did on Google AI Studio and Vertex AI. Before, the model continued the AI's last reply and Marinara saved that as your swipe. With text in the input box, your guidance now comes before the rewrite instruction, and in a merged Conversation group the group reply format is left out of the rewrite (#7569).

- Image connections have a new **SpicyAPI** service. Pick it in the connection editor, add your key (the editor links to SpicyAPI's key page) and use **Fetch Models from API** to list your account's image and edit models. Marinara sends each model only the settings it accepts, shrinks reference images to fit SpicyAPI's limits, and waits for slow images without paying twice if the connection drops. **Test Connection** costs nothing. An existing image connection with a `spicyapi.ai` Base URL and no saved service now uses SpicyAPI on its own; one saved as **OpenAI (DALL-E)** needs its service switched to **SpicyAPI**. Images only for now, not video (#7489).

- Model IDs from proxies and gateways that add tags or endings to a model's name, such as `[次]claude-opus-4-6-thinking` on LinkAPI, `claude-opus-4.6` on OpenRouter or Poe, or names ending in `-thinking`, `(high)` or a date, are now recognized as the model they stand for. They get that model's reasoning effort, thinking, sampling settings and context limits instead of being treated as an unknown model. The ID sent to the provider is never changed. When the name itself tells the proxy to turn thinking on, Marinara leaves out temperature and the other settings the provider rejects while thinking (#7713).

- When a chat's connection fails and a fallback answers, the notice names the connection that failed and why, for example "Pool A (gpt-5) failed (rate limited)." Replies written by a fallback show a small **Fallback** marker, next to the time in Roleplay and under the reply in Conversation. Tap, hover or focus it to see which connection failed and which one answered. This makes a bad key, a retired model or a rate limit in a random connection pool easy to find (#7720).

- **Connections → Defaults** has a new **Embeddings** row: one embedding model for memory and lorebook search, used by every connection that has no embedding model or **Embedding Connection** of its own. Before, such a connection quietly fell back to the built-in local model, so switching a chat to it made lorebook entries and memories you had already vectorized stop matching, with no error. A chat's or connection's own embedding settings still come first, a line under the row says how many connections use their own, and the lorebook **Vectorize** picker starts on the default. **None (built-in local model)** keeps things as they were. Re-vectorize your lorebooks and memories after changing it (#7627).

- Lorebook **Vectorize** now goes through a connection's **Embedding Connection** when it has one, the same way chat-time semantic search does. Before, Vectorize used the chat connection's own address and key, so the vectorized entries didn't match what chats searched with and were skipped without an error. If you vectorized a lorebook through such a connection, vectorize it again. The picker also lists connections that embed only through an **Embedding Connection**, and one with no embedding model anywhere tells you where to set one (#7630).

- Local models with a strict chat template, such as Mistral-family models on llama.cpp, no longer fail with "conversation roles must alternate" or "Cannot have 2 or more assistant messages at the end of the list" on Continue, swipes with an Assistant Prefill, Impersonate, agents or Professor Mari. Marinara retries once with back-to-back messages from the same role joined together; a request the server accepts is still sent exactly as before. If the retry is refused too, the error tells you to set **Post-Processing Messages** to **Single User Message** or serve the model with a less strict template. OpenRouter and other OpenAI-compatible hosts that use strict templates get the same retry (#7486).

- Local backends at a `localhost` address, such as llama.cpp at `http://localhost:8080`, now connect on systems where `localhost` points only to the IPv6 address `::1` while the backend listens on `127.0.0.1`. Before, the connection failed with `ECONNREFUSED ::1` (#7698).

- If you reach your AI provider through an HTTP proxy (`HTTP_PROXY` or `HTTPS_PROXY` with `NODE_USE_ENV_PROXY=1`, for example v2rayN without TUN mode), test messages and replies now go through the proxy. Before, the model list loaded but every message failed with "fetch failed" after about 10 seconds. Image generation, embeddings and package downloads use the proxy too. Local backends on `localhost` and hosts listed in `NO_PROXY` are still reached directly, and without `NODE_USE_ENV_PROXY` nothing changes (#7729).

- **Reasoning Effort** levels now read **Low**, **Medium**, **High**, **Extra high** and **Max** instead of low, medium, high, xhigh and max, and **Verbosity** reads **Low**, **Medium** and **High**. This applies to connection settings, presets, a chat's Advanced Parameters, the setup wizards and Peek Prompt. What is saved and sent to the provider is unchanged (#7598).

### Voice and Calls

- The **Text to Speech** card in **Connections** can now use one of your Audio connections. Choose it in **Source** under **Audio connections**: speech, **Preview**, the voice list and the Character Editor's voice previews then use that connection's address, key and model, so you don't type them twice. Each Audio connection keeps its own voices and speech settings, even when two use the same service, and the four regular sources keep their settings as before. If the chosen connection is deleted, the card shows **Missing Audio connection** and speech stops instead of quietly using another connection. A game with its own audio connection still uses it for sound effects and music (#7851). Thanks to @ebev, who proposed this in #7848.

- Text to Speech has a **Request timeout (seconds)** setting, from 10 to 3,600 seconds and 60 by default, for local voice servers that need longer for a long line. Set it on the **Text to Speech** card, or on each audio connection for that connection. When speech times out, the message says how long it waited and where to raise the limit (#7723).

- With **Enable emotion indicators** on, text in square brackets now reaches the speech service even when **Skip text inside square brackets** is on, so voice directions such as `[Low, steady voice, restrained urgency]` are no longer thrown away. This can let other bracketed notes through as well; turn emotion indicators off to filter brackets again. The **Roleplay speaker extractor** adds sparing, more descriptive directions without changing the dialogue's words, and a long line split for speech no longer cuts a direction in half. With **Enable TTS**, **Game narration** and emotion indicators on, Game scene, party and combat dialogue can carry these directions too. After you change these settings, playback uses them instead of audio saved from before (#7765).

- Calls can now send your voice to your own speech-to-text server, such as a self-hosted Whisper server or a provider, instead of Local Whisper. This helps when Local Whisper struggles with your language. Set it up in the new **Speech to Text** card in **Connections**, which appears once Calls is installed: enter the server's address, an API key if it needs one, the model and your language, then press **Test**. Calls 1.1.0 and newer use it. A server on the same computer works as is; one elsewhere on your home network needs `STT_LOCAL_URLS_ENABLED=true` (#7353).

- On a phone, closing **Connections** while a **Speech to Text** change is still being saved no longer saves it twice (#7891).

- **Calls** keeps what you say while it is still transcribing your last clip. Anything said in that time used to be thrown away with "Still processing your last voice message". Up to three clips now wait their turn and are answered in the order you spoke. Calls also uses the **Speech to Text** server set in **Connections** when there is one, and falls back to Local Whisper when there isn't or it fails. Speech that finishes transcribing after you hang up is no longer saved into the ended call or answered (Marinara-Agents#1281).

- **Calls** no longer loses some voice clips with "Selected provider/model cannot receive provider-native audio input". A short pause between words no longer ends your clip mid-sentence when the tab is hidden or busy: a clip now ends after three seconds of quiet the microphone actually measured. In a hidden or covered tab, a real pause therefore takes longer to end the clip, about 13 seconds (Marinara-Agents#1288).

- Characters can call you again. With **Calls** installed, a character's `[call]` in a Conversation reply did nothing. Now it rings: the incoming-call banner or notification appears and an "Incoming call" line is added to the chat. It needs the chat in Conversation mode with character commands, the **Calls** command and **Call Audio Pipeline** on. In a group chat, a second character's `[call]` while a call is ringing no longer relabels the first one, and a call in progress is left alone (Marinara-Agents#1335).

- On phones, the **Chat Settings** bubble no longer covers **Close call chat** during a call in **Calls**. The call chat now behaves like the app's other dialogs: floating windows hide while it is open, keyboard focus moves into it, and focus returns to **Open call chat** when you close it (Marinara-Agents#1355).

- Opening a call in **Calls** no longer changes the volume of, or mutes, a reply Marinara is reading aloud in another chat. The call's volume and mute apply only to the call's own voices. A call in a chat on the **Local Model** now answers through Marinara's Local Model, as the chat does, instead of staying silent with no error (Marinara-Agents#1497).

- When a character changes their status during a call, such as going to study for an hour, the change now goes on their character card, as it does after a Conversation reply, so it shows in every chat with them and lasts for the time they gave. Before, the call changed only this chat's copy of their schedule, and the change was soon lost (Marinara-Agents#1499).

### Install, updates and security

- Marinara refuses HTTPS certificates from eight eMudhra certificate authorities whose private keys were stolen, so whoever holds those keys can't pose as your AI provider or any other site Marinara connects to. Browsers already block them, and Node.js will in a coming release (#7900).

- On Windows, Marinara starts again after a crash or power cut instead of refusing to start because another copy seemed to be using your data, which used to mean deleting `data/storage/.writer-lease` by hand. This covers data on the computer's own drive. Data on a network drive or shared folder stays locked, so two computers never write to it at once (#7804, #7812).

- Building the app on a computer now needs about 2.5 GiB of memory for Node.js, where a 2048 MiB limit was enough for 2.5.0. If `NODE_OPTIONS` sets a lower limit, the build still stops with `JavaScript heap out of memory`, but it now says how to raise or remove the limit instead of showing only Node.js's crash report. Marinara never raises a limit you set. Android (Termux) builds are not affected (#7838).

- On Android/Termux, updating in place from 2.4.6 could leave part of the image library uninstalled, and the server then shut down as soon as a browser opened Marinara. Updating now installs the missing part. If the image library still can't load, the server stays up and shows full-size images instead of thumbnails until dependencies are reinstalled (#7179).

- The Troubleshooting guide has a new section, **Termux: server stops when you open Engine, or Sharp cannot load**, with repair steps for anyone who can't update first and a list of what stays off until the image library loads: thumbnails, sprite generation and background removal (#7183).

- On Android/Termux, updating from **Settings → Advanced → Updates** no longer downloads builds for every other platform, about 1.7 GB the phone can't use and often has no room for. It now installs only what Android needs, the same way `start-termux.sh` does, and so does the manual command shown when an update fails. Builds that earlier updates already downloaded are removed later by pnpm's regular cleanup (#7215).

- On Android/Termux, the launcher no longer writes pnpm architecture settings into `.npmrc`. pnpm never read them there, so installs already used the Android builds Termux needs, and existing installs need nothing done. Starting Marinara from the Android app no longer reinstalls dependencies and clears the package cache every time, so it starts faster (#7198).

- With Basic Auth on, an address that tries 10 different wrong passwords within 15 minutes is blocked until those 15 minutes are up, and the server log notes the first wrong password and the block. A browser that has already signed in can still get in with the right password during a block, so other people's guesses can't lock you out of your own devices. Retrying one old saved password counts only once (#7824).

- Regex scripts, including ones that come with imported character cards, now run under a time limit on every prompt message, not only long ones, so a slow pattern can't hold up the server. Typical chats with regex scripts also build their prompt faster (#7824).

- The server's downloads from web links refuse private and local network addresses in every setup, including when `TRUSTED_PRIVATE_NETWORKS` is set (#7346).

- `.charx` cards, `.marinara` packages, Agent packages and custom Agent repositories are now opened with a stricter archive reader. An archive whose own records disagree is refused with a plain message, and a `.charx` whose card or icon unpacks to more than 256 MB can't be imported. Every other size limit is unchanged, and archives that imported before still import, including ones padded at the end by the `tar` on macOS and Windows. A `.marinara` file that isn't a readable archive now says so instead of showing a server error (#7532, #7538).

- Troubleshooting has a new section for imports refused with **The file is not a readable ZIP archive** or **Could not read .marinara package**. It explains what the message means, that a partial download is the usual cause, how to make the archive again, and what the file-count limits for Agent packages and `.marinara` files mean. These limits are not new (#7550).

- A client extension that sends messages to its sandbox faster than allowed is now stopped, with the usual **Restart** notice, instead of being able to freeze Marinara. Extensions that catch up after a pause, such as an open browser dialog or a sleeping computer, keep running (#7268).

- Tightened how the server recognizes API requests, so its cross-site request check, rate limits and no-cache rules always apply (#7815).

- Updated the MCP SDK used by Claude agents and the developer MCP tool to 1.32.1, which includes a security fix for its OAuth client (#7170).

### Chats and messages

- On a slow device, such as a phone, the Android app or Termux, tapping **Conversation**, **Roleplay** or **Game** on Home right after Marinara opens no longer asks you to choose a connection when you already have one. Home now waits for your connections to load, and a quick second tap doesn't start a second chat (#7837).

- **Peek Prompt** has a **Copy assembled prompt** button beside Close. It copies the whole prompt as plain text, closed sections and chat history included, with each message under a `[system]`, `[user]` or `[assistant]` line, so you can paste it elsewhere. It copies what the window shows: a saved exact request is copied as it was sent, and nothing is sent to the model (#7807).

- Popped out of Chat Settings, **Author's Notes** has a text box that grows with its window instead of staying four lines tall, and on phones it fills the screen. Docked in Chat Settings, the box can be dragged taller on a computer (#7806).

- New **Add CYOA choices to the message box instead of sending them** setting in **Settings → General → Input & Editing**. With it on, clicking a CYOA choice adds its text to your message box and the choices stay on screen, so you can combine several into one message and edit it before sending. It takes priority over **Use CYOA as direction** (#7317; thanks @stonebystone).

- **Settings → Advanced → Message Tools** has a new **Show "older messages not sent" note** switch. Turn it off to hide that note under replies in long chats. A cut-off or empty reply still shows its own note, and **Fix: Check the last reply** in Search still opens the full checkup (#7395).

- `/send` now saves your message the way **Send** does: your input regex scripts and input translation run, and macros such as `{{user}}` and `{{random}}` are filled in. Before, `/send` saved the macros as typed. A message with macros sent right after the page opens now waits for your personas and characters to load, so `{{user}}` and `{{char}}` are no longer saved as "User" and "Character" (#7600).

- `/send` keeps the files you attached and the message you were replying to, as **Send** does. Before, it posted only the text and the attachment was lost. `/send` with a file and no text posts the file on its own. `/remind` now treats its text like a normal send, with your input regex, input translation and macros, so the reminder in the chat, its notice and the model all show the same text (#7619).

- An `{{include::…}}` in a message you send is now filled in with the lorebook entry before the message is saved, along with any macros inside that entry, so the chat shows what the model reads. If the server doesn't answer within 10 seconds, the include is kept as typed and still works in the prompt (#7615).

- Names in Korean, Japanese, Chinese, Cyrillic and other non-Latin scripts now stay in the prompt's XML tags and Markdown headings, such as `<홍길동>`, and Peek Prompt shows those sections by name. Before, such a name became an empty `<>` tag and accented names lost letters (`Amélie` became `amlie`). A persona with such a name could also be left out of the prompt, and in a group chat set to Individual, other characters' cards could stay in each character's prompt (#7393; thanks @chungchandev).

- In a group chat set to Individual with a preset that uses the Markdown wrap format, other characters no longer see the card of a character whose name has a symbol or emoji between words, such as `Tom & Jerry` (#7393; thanks @chungchandev).

- Saving a settings profile that other chats use now asks whether to update them too: **Save to this profile only** or **Save and update N other chats**. Updated chats get the profile's Chat Settings, such as generation options, agents, memory and summary settings, translation and the window layout. Each keeps its own connection, prompt preset, story, characters, lorebooks, background, notes and progress, and a setting you left at its default in the chat you saved from goes back to its default in the others. Multiplayer rooms are never updated. Profiles also stop copying one chat's own state, such as its macro variables, into other chats, and a profile that fails to save now says so instead of failing silently (#7422).

- Exporting a very long chat no longer freezes the server. A 12,000-message chat now exports in under a second instead of about 20 seconds, and other tabs and replies keep working meanwhile. Branching a chat, importing a JSONL chat and copying a scene into its own chat are also much faster on long chats (#7446).

- The **Trash** tab in **Search messages** no longer freezes the page when a chat has thousands of deleted messages. The list fills in 200 entries at a time, starting or finishing a restore or delete no longer redraws every entry, and the entries dim while it runs. A failed or partial restore warning now stays up for 15 seconds, so a slow device can't hide it before you read it (#7218).

- While the message **Trash** is restoring or deleting, a short **Restoring messages…** or **Deleting messages…** note shows over the dimmed entries, and screen readers announce it, so it is clear why the entries don't respond (#7226).

- On phones, opening a Chat Summary entry now shows its whole title and message range, with the token estimate, above the text instead of cutting them off. A summary's **Delete** button now has the same colors as **Expand** and **Edit** beside it instead of red, and it still asks before deleting (#7590).

- Accepting a Grammarly suggestion, or clicking another browser extension's popup, no longer closes Chat Settings, a popped-out drawer or another chat window, and the fix lands in the text you are editing. Pressing Escape in such a popup closes only the popup, so the expanded summary editor, **Edit Summaries** and a preset variable's value editor stay open (#7591).

- On phones, tapping a connection in the **Connections** menu by the chat input switches to it and closes the menu in one tap. The arrow at the end of the row opens that connection's models without switching. Professor Mari's connection menu works the same way on narrow screens (#7660).

- Screens that scroll over an open chat, such as an agent package's own pages, scroll more smoothly: the chat checks for selected text while you scroll only when some text is selected (#7641).

- With **Apply preset colors** on in **Chat widget style**, as with the **Mari** style, quoted dialogue in Roleplay and Game now keeps each character's and persona's own dialogue color, including italics inside the quote, instead of taking the style's text color. Game Mode speaker names keep their colors too. Dialogue from characters without a color of their own still follows the style (#7168).

- With **Apply preset colors** on in **Chat widget style**, HTML in chat messages, such as an Immersive HTML card, keeps the text colors it sets itself. Before, that text took the preset text color or your **Chat Chrome Text Color**, so black text on a light card could turn white or green. Text without a color of its own still follows the preset and Chat Chrome Text Color (#7297).

- With a chat widget style such as Mari or Dottore and its **Apply preset font**, **Apply preset shape** or **Apply preset colors** switches on, **Load More**, **Show older**, **Show newer**, **Latest** and the Game log buttons (**Older**, **All** and **Show more older logs**) now follow the style like the other chat buttons. With the switches off, **Load More** matches **Show older** beside it, and the Game log buttons use your theme colors, so **Older** and **All** are readable in light mode (#7562).

- **Load More**, **Show older**, **Show newer**, **Latest** and the Game log buttons now show a clear focus ring when you reach them with the keyboard. It uses the full app accent, or the chat style's color while **Apply preset colors** is on (#7574).

- On tablets, foldables and narrow windows, the chat's round buttons and windows no longer stay on top of other screens such as the Agents list, an agent editor, Characters, Settings or the Tracker Panel, where they covered buttons like **Back**, **Save** and the panel's close button. They come back in the same place when you return to the chat. The d20 **Trackers** button now also closes the Tracker Panel when pressed again, like the **Chat Settings** button, and when the panel opens over the chat, keyboard focus moves into it (#7181).

- On phones, a notice at the top no longer covers header buttons such as **Save**, **Close** and the star, also in landscape, and the character editor keeps its header actions on one row. In Game Mode, unpinned Game controls close after you switch between a scene and the overworld, and the floating Game buttons no longer cover the tactical combat toolbar (**Flee**, **Threat**, **Log**) (#7876).

- On phones, a notice at the top also stays clear of **Close** in the Game Mode **Inventory**, even after picking an item makes the panel taller. Pressing Escape while dragging a background cancels the drag and leaves **Background Library** open with your selection, and screen readers name the character editor's name field again (#7881).

- New `{{reasoning}}` macro: it gives the reasoning level the model is actually sent (`low` up to `max`), or `off`. A preset can use `{{#if reasoning}}…{{else}}…{{/if}}` to keep a thinking section only when the model thinks, or `{{#if reasoning == "max"}}` for one level, so you no longer switch sections by hand when you change the reasoning level. A preset or chat variable that already uses the name keeps its own value. The macro and conditional prompt guides show examples, including model-specific ones with `{{model}}` (#7705).

- Fields that have the macro reference button now complete macros as you type: type `{{ch` and `ar}}` appears in grey. Press Tab or tap the grey text to accept it; with nothing suggested, Tab indents as before. Tapping the grey suggestion also works in search and in Professor Mari's message box, so phones without a Tab key can accept it too (#7707).

- A `decision_choice:` option in a conditional prompt can now say what it means, so the Decision model doesn't have to guess. Write it as `"option":"what it means"`, for example `{{#if decision_choice:"Kaelen's mood in the latest message" == "angry":"Kaelen raises his voice, makes threats or breaks something"}}`. The model still answers with the option (`angry`), so comparisons work as before, and options without a meaning are asked exactly as before. Changing the meaning asks the question again instead of reusing the old answer (#7808).

- In a preset's choice window, an option no longer shows a value that only repeats its label, and a dropdown with nothing selected shows a blank row instead of the first option (#7308).

- With a chat's **Lorebook Token Budget** and the lorebook's own **Token Budget** both at 0, **Active Context** no longer says matching entries were skipped by token budget. An entry whose text is blank, or that macros turn into nothing, was counted as skipped by the chat budget. An entry that only sets a variable with `{{setvar}}` sets it again, so entries that check that variable get their text back. When entries really are skipped, the notice says which budget skipped them and where to change it: **Lorebook Token Budget** in **Chat Settings → Lorebooks**, the lorebook's **Token Budget** in the lorebook editor, or the fixed limit on lore attached to the current location. The notice uses your theme's accent color, held steady, instead of amber (#7329).

- In the lorebook entry editor, a keyword list longer than 10 shows the first 10 with **Show N more** and **Collapse**, separately for primary and secondary keywords. Adding a keyword opens the full list (#7522; thanks @minikkeuen).

- Deleting a lorebook now removes it from its library folder, so the folder's count drops right away. Folder counts that still included deleted lorebooks are corrected the next time Marinara starts (#7435; thanks @minikkeuen).

### Settings, appearance and library

- Drag chats, characters, personas, lorebooks, presets, connections, backgrounds, agents and folders straight from their rows instead of a small handle. On phones, hold an item to pick it up (a normal swipe still scrolls), and tap more items with a second finger to carry them together, for example into a folder. While you drag, a gap opens where the item will land and folders light up when you're over them. The order you set is saved, and Alt+Up or Alt+Down moves a focused item (#7362).

- The **What's New** widget on Home has a **See what's new** button, so you can open this version's What's New again after closing it. On phones, it sits on one line with **Read release notes** (#7810).

- Buttons in Settings now look the same wherever they do the same job: a section's main action, smaller actions in a row, toggles, choice cards such as **Visual Style** and **Chat widget style**, icon buttons and delete buttons each have one style. Before, some actions, such as **Save timeouts**, looked like pressed toggles. The selected choice card has a clear accent outline, icon-only buttons have names for screen readers, and delete buttons across the app use your theme's delete color and no longer pulse with **Accent Pulse** or **RGB Mode**. The tracker **Temperature unit** is now a °C / °F choice, **Create Theme** and **Import File** are ordinary buttons, and in the background library a pin icon sets the default Roleplay background, so a card's buttons fit on one row and no longer cover the picture you click to select it (#7175).

- Delete, remove, stop and recovery buttons use your theme's accent, held steady, instead of a fixed red or amber (#7876).

- Changing **Border & Buttons Color** in **Chat widget style** no longer removes the thin inner ring from chat buttons. Professor Mari's arched round buttons, Dottore's buttons and every **Cut corners** button keep it, now drawn in your chosen border color (#7249).

- Preset prompt fields and a character's **Example Dialogue** now use the font picked in **Settings > Appearance > Text & Scale > Font**, in their **Expand editor** window too. Typed quotes stay straight, so you can still see which quote is stored. With the default font they stay monospace, and code-like fields such as JSON, regex and variable names always do (#7514).

- Profile exports (**Export Profile**) keep each agent's **Max Output Tokens** again. The export took any agent setting with "token" in its name for a password and blanked it, so restoring the profile on a new install quietly put every agent back on the default output limit. Other token counts, such as context and summary budgets, are kept too. API keys, passwords and connected-account tokens are still left out (#7727).

- Importing a full profile on an install with agents such as **Slurp** no longer stops with "Profile table slurp2_account_subscriptions is not supported." A profile doesn't carry agent data, so the import now skips those tables, as the export already does (#7892).

- Safari and other WebKit browsers no longer drop into **Marinara hit a recoverable UI error.** when they refuse to read the page color from a canvas, which can happen when the device is low on memory. The page backing and browser bar then keep the theme's background color (#7242).

- The rare Chibi Professor Mari toast keeps her painted chibi, and she now turns up in other looks too: mirrored, upside down, Dottore, Gold, and a rarer shiny silver chibi with sparkles (#7450, #7451).

### Roleplay

- In Roleplay chats, agents now read whispers. Echo Chamber, trackers, Lorebook Keeper, Long-Term Memory and every other agent see each whisper where it was said, marked as private with the name of who it is for, and a reply that is only a whisper now goes through the agents too. In group chats, **Smart** response order reads them as well, so a whisper to a character can make that character reply next. Characters still get only the whispers meant for them, but what an agent writes, such as a lorebook entry or a rewritten reply, can now mention a whisper. In a hosted multiplayer room, agents get no whispers (#7437).

- In Roleplay, **Relationship Tracker**'s **Update from History** and **Memory Nag**'s scans now read whispers, marked as private with the name of who they are for, like the other agents. A message that is only a whisper is read too. Who is present in a scene still comes from the public text, so a whisper that names two characters doesn't add their relationship to anyone else's prompt (Marinara-Agents#1354).

- In Roleplay chats, a message that is only a whisper is now left out of every other character's context. Before, they saw it as **[Private whisper]**, which told them you were there even when you were sneaking up on someone. The character it whispers to and the narrator still get it, and so does a character you shared a private note with on that message (#7389).

- In Roleplay chats with Advanced Memory on, a message that is only a whisper, with no other text, now reaches the character it whispers to and the narrator. Before, Advanced Memory left it out of the prompt because it had no visible text, so the whisper never arrived. The same goes for a reply that is only a whisper, and regenerating a reply that missed one now includes it (#7381).

- In Roleplay chats, a whisper stays where the model wrote it after you edit the reply. Before, it moved to the bottom of the message when the edit changed the text right before it, and saving any edit with the **Typographic** quote style did that to every whisper in the message. Rewrites by agents such as Prose Guardian and continued replies keep whispers in place too, undoing an edit puts a whisper back where it was, and whispers in replies you already edited return to their place when only the quote style had changed (#7387).

- In Roleplay chats, a whisper to your persona that you type into a character's or the narrator's reply now shows in the message, for example when you fix a whisper the model wrote in the wrong format. Before, its text vanished behind a "used whisper command" notice. A typed whisper or note that still fails now shows that notice open, with the reason and your original text. A message this already happened to isn't repaired on its own: retype the whisper from **Original command** in the notice, or regenerate the message (#7412).

- In Roleplay, hiding a message from a character no longer takes away a whisper addressed to that character. They still get the whisper at that point in the story, but none of the rest of the message. Hiding a message from everyone still removes its whispers. To take a whisper back, open **Edit whisper**, clear the text and save: the whisper is removed from the message (#7196).

- In Roleplay group chats where characters reply one by one, **Add Turn To Prompt** now only reminds the model which character to reply as. It also used to invite the character to address others with @Name, so replies could end with an out-of-place ping such as @YourPersona. Conversation chats keep their @Name handoffs (#7327).

- In Roleplay group chats set to **Individual**, each character's reply keeps its own Expression Engine expression. Before, the whole turn's expressions were saved on the last reply only, so earlier replies showed no expression, and deleting or retrying the last reply removed everyone's. This makes no extra model calls (#7715).

- With **Only show active sprites** on, your persona's sprite no longer stays on screen after your persona leaves the scene. It now shows on the turn you wrote and otherwise only when the Expression Engine includes your persona, also when you retry the Expression Engine (#7379).

- The **Narrative Director**'s **Secret Plot** has an editable **Secret Plot Prompt** in the Agent Editor, so you can steer arcs away from the built-in mystery-to-uncover framing, for example in character-driven roleplay. Select **Copy default to edit** to change it and **Reset to default** to go back; keep the JSON reply format at the end, or the arc can't be read. Profile exports and backups now keep the **Secret Plot** switch and run interval, which they used to blank. Thanks to @stonebystone (#7657, #7733).

- The Illustrator's **Run Interval** is now set per Roleplay chat. Its card in **Chat Settings → Agents** has a **Run Interval** field, so one chat can get an image every message, another every 5 messages and another only when you ask (0). Adding the Illustrator to a chat saves the value you pick to that chat instead of changing it for every chat. The **Run Interval** in the Agent Editor is the default for chats that don't set their own, and **Use agent default** brings a chat back to it. Game chats keep choosing illustrations by scene (#7304).

- In group chats where characters reply one by one, with Prose Guardian, Continuity or Immersive HTML on, the last character's message no longer repeats every earlier reply from the same turn. The rewrite agents now get only that character's own reply (#7510).

### Conversation

- In Conversation chats, a character now remembers the selfies they send. Their later replies see a short note saying what the photo shows, so they no longer answer "what photo?" when you react to it. With image captioning on, your captioning model describes each new selfie once and the description is kept; otherwise the note uses the selfie's image prompt. In group chats the note says who sent it. Illustrator images still stay out of the character's view (#7417).

- In Conversation chats, a character's **Schedule Updates** command now really changes its status. When a character sets itself to **Busy** for an hour, for example, its status and activity change right away and go back to its schedule when the time is up. Before, the command was removed from the reply but changed nothing. It also works for characters without a schedule and never edits the saved schedule. A status you set yourself with **/status** or the presence menu still wins. A duration such as 1.5 hours is now read as an hour and a half instead of 5 hours, and the presence menu no longer keeps showing **Override** and the old activity after a timed status has ended (#7231).

- In a Conversation that started a Scene, the **A scene is in progress** card now has an **Allow replies here** switch. Turn it on to keep talking with the Scene's characters in the Conversation while the Scene runs. They still don't message you on their own until the Scene ends. The switch is off by default, and it goes away with the Scene (#7425).

- In a Conversation, a character who can't reply because they're taking part in an active Scene now gets a notice saying so, with its own icon, instead of being called offline while their status still showed green. The notice says how to let them reply again (#7384).

- On Android installs set up with the Marinara app, Conversation characters check in while you're away again. The background check that sends their messages was turned away by the app's local sign-in protection, so the messages only arrived once you opened the chat. Manual Termux, desktop, Docker and LAN setups were not affected (#7484).

### Game Mode

- **Game controls → Edit game data** opens the State Editor on the game's own data. **Party Cards**, **NPCs**, **Journal**, **Player Notes**, **Story** and **Session Summaries** can be edited there; everything else is shown read-only, so you can still search it. Every change is checked before it saves: names can't change, party cards can't be added or removed, NPC reputation stays between -100 and 100, and a session summary changes only in its text. If a turn changes the same data while you edit, the save is refused with a **Reload** button. A warning at the top reminds you that hand edits can break a game (#7766).

- **Edit game data** also covers the inventory, **World Edits**, the story script, the party sheet and the HUD widgets, each saved through the game's own checks. Before each save the game takes a checkpoint, marked **Before a State Editor save**, so a bad edit can be undone (#7773).

- New **Game controls → Checkpoints** lists the game's checkpoints, newest first, with what took each one and when. **Load** takes the game back to that moment after you confirm: the party's cards and sheets, the NPCs, the journal, your notes, the inventory, the session summaries, the GM's story plans, the time, weather and morale, and the **World Edits** made in the Game data editor, together with the story from that same checkpoint. A companion recruited after the checkpoint leaves the party again, and your settings stay as they are. Checkpoints taken before this update rewind only the tracker and the map. **Delete** removes a checkpoint for good. Until now the app had no way to load a checkpoint (#7746, #7773, #7787).

- In Game Mode, when the Game Master adds an NPC to your party, Marinara no longer attaches a character card from your library, or brings in a different NPC, just because the name is similar, such as a **Samantha** card for an NPC named Sam. When the NPC and one of your cards, or several cards, have exactly the same name, a window shows each card's name, title and avatar so you can pick one, or keep the game's own character. Closing the window keeps the game's own character. A single card with that name and no NPC of that name still joins as before (#7335).

- In a Game Mode game with money, the Game Master is now told when a purse is empty, and sees the player's bag even when it holds nothing. Before, an empty purse was left out of its prompt, so it could narrate a purchase as made and the game then refused it (#7466).

- Game Mode now follows **Settings → Advanced → Request timeouts → Text generation** (`CHAT_GENERATION_TIMEOUT_MS`) when starting a new game and for its other Game Master requests, instead of a fixed 5 minutes. As in chats, it is the longest wait for the model's first output and between outputs, and a reasoning model's thinking counts as output, so a slow local model that thinks for a long time no longer fails new-game setup at exactly 300 seconds (#7180).

- In Game Mode, the turns you send are saved with their macros filled in, so the **Session Logs** show the same `{{random}}` pick, persona name and variable values the Game Master read. Before, the log could show one `{{random}}` result while the model read another. A turn that changes a chat variable, such as `{{setvar}}`, is still saved as typed (#7619).

- With **Apply preset font**, **Apply preset shape** and **Apply preset colors** on, much more of Game Mode now follows your Chat widget style, custom colors and gradients included: Session Logs and combat logs, the Inventory and its item pickers, Classic and Tactical combat panels, choice cards, quick-time events, the storyboard viewer, Session Replay, and the Town and Overworld place cards. Game dialogs such as **End session** use the same look as Roleplay's chat dialogs, and the Journal follows its window's style, so it is readable with every preset. With **Default** and the switches off, nothing changes (#7604).

- In Game Mode with **Apply preset colors** on, pale party, enemy and element colors are now mixed toward your style's text color, so they stay readable on light styles such as Prof. Mari light. Warnings use your accent color held steady instead of pulsing, and icons use the same control color as the rest of the chat. The confirmations for starting combat, removing a party member, deleting a journal entry and removing a widget, and the failure banners for the scene helper, image generation and scene analysis, now take the chat style too (#7610).

- In Game Mode, a very long word, link or run of text with no spaces no longer pushes the Session Logs, dialogue box, narration, notes or translation panel wider than the screen. It now breaks inside the box, and a speaker name that long wraps instead of running past the dialogue box. Ordinary text still wraps at spaces (#7616).

### Agents and packages

- Twelve agents now use Marinara's own code instead of carrying their own copies of it: the six board and card games, Calls, Noodle, Slurp, World Maps, Long-Term Memory and Memory Nag. Loading them no longer resets settings saved only in this browser, and Calls, Noodle and Slurp share Marinara's Local Model, connection queue and ChatGPT login instead of running their own, so they can no longer start a second local model server or reply in the background while your chat is replying. The games lock their board while the character replies, and Calls' connection switcher and sticker settings change the chat you have open instead of the one that was open when the page loaded. Their downloads shrink from 23 MB to 9 MB in total, and they take much less disk space. These versions need this version of Marinara: an older Marinara doesn't install them and keeps the versions you have. Slurp no longer shows the chat emoji settings in its sticker and emoji pickers (Marinara-Agents#1494).

- Agents that run code on the server, such as Calls, Noodle and Slurp, load again after your data folder moves to a new install path, for example after reinstalling Marinara in another folder or reinstalling Termux. Before, they failed to load on every start (#7868).

- Agents can now use Marinara's own settings, chat state, services and libraries such as React instead of carrying their own copies. Agent updates built this way are smaller and stay in step with the app, for example by following the chat you have open and sharing one haptics connection. They need this version: an older Marinara doesn't install them and keeps the agent versions you already have (#7868, #7869).

- With agents installed, browser-only settings such as **Reduced paint effects** no longer reset after a reload. Older agent builds saved an outdated copy of Marinara's interface settings on every page load, and Marinara now ignores that copy (#7869).

- Confirmation dialogs open on top of everything else on screen, including agent screens (#7869).

- Agents take much less disk space. Each start copies every agent that runs code on the server, and a crash, force-quit or power cut used to leave those copies behind for good: one data folder had collected 2.2 GB of them. Marinara now deletes leftover copies when it starts, makes the copies smaller, and keeps only the current and previous version of each agent, so a failed update can still roll back. Agent data, chats and settings are never deleted. With every agent installed, one test folder went from 133 MB to 83 MB (#7870).

- The Agent updates dialog now shows the release notes of every version an update skips, not only the newest. For an Agent several versions behind, **What changed (N)** lists each version newest first, with each version's notes cut to two lines and a **More** button to read the rest. The dot now also shows when any of those versions is a change you will notice, not only the newest one (#7477).

- Installing or updating an agent that needs a newer Marinara now says which Marinara or capability API version it needs, instead of "Internal Server Error" (#7886).

- With a board or card game's agent on in a Conversation chat, the game's board now shows once instead of twice. On a phone, the extra board used to cover the whole screen (#7886).

- Client extensions keep working after you switch to another tab, put the computer to sleep or leave the app in the background. Before, Safari and other browsers that slow down hidden tabs made Marinara stop the extension after a few seconds, so its panel and buttons stayed on screen but did nothing. If Marinara does have to stop an extension that froze, its buttons and panels now disappear and a notice offers **Restart**. In Safari, client extensions also start reliably; before, their top-bar buttons were often missing after the page loaded (#7262).

- `{{include::ENTRY}}` and `{{include::BOOK::ENTRY}}` now work in agent prompts, including custom agents, edited built-in agents and retried agents. They read the same lorebooks as the chat's own prompt, so one shared agent can pick up chat-specific instructions from an entry with the same name in each chat. Before, the macro reached the model as written (#7223; thanks @usagirei for the report).

- **Character Tracker** no longer throws away a turn's mood, outfit and thought changes when the model sends them without the `presentCharacters` wrapper. Those turns counted as successful while the tracker kept the old values, and the next turn could undo recent changes. A reply with other data but no character list now logs a server warning (#7222; thanks @bahaynes for the diagnosis).

- **Echo Chamber** reactions to a new reply now show up when they are ready, instead of only after you refresh the page. The Card Evolution Auditor's update window follows the same rule for a new reply (#7599).

- The Game Master now gets at most four rounds of tool calls, such as dice rolls, per Game Mode turn, then narrates with the results it has. Any agent gets at most sixteen (a lorebook backfill, sixty-four). A model that kept asking for a roll, for example through a proxy that loses the results, could otherwise make up to a hundred paid requests in one turn. A lower `MAX_TOOL_ROUNDS` still applies. Game Mode's end-of-session, recruit and character-sheet prompts also no longer include each party member's whole ruleset sheet, so they are smaller (#7466).

- On phones, the World Maps map editor and library keep their header and **Save** in view while the keyboard is open, and the form keeps scrolling. On Android the editor used to shrink and push **Save** out of reach, so map changes could not be saved. No World Maps update is needed (#7499).

- Packages such as Long-Term Memory can now mark a text as a search query when they embed it, so embedding models that expect a query prefix, such as e5 and nomic-embed-text, get the right one. Before, a package's search queries got the document prefix, which made recall weaker. Long-Term Memory does this from version 1.4.26. For package developers: capability API 1.68 adds an optional third argument to `embeddings.embed` (#7432).

- For package developers: Capability API 1.71 adds `agentContent` to Roleplay messages, the message as built-in agents read it, with each whisper in its place. Packages that read the chat themselves can read whispers without parsing them out of `extra`. It is left out outside Roleplay and in hosted multiplayer rooms (#7488).

- For package developers: Agent and capability packages can ask the user's Decision model their own yes/no and Choice questions about text they supply, through `api.runtime.decisions.evaluate(...)`. It uses the Decision model the user picked, returns nothing when none is set, never hands the package any keys, and stays within the user's **Decision statements per turn** limit. See `docs/development/optional-agent-packages.md` (#7369).

- For package developers: `api.runtime.persistence.updateCharacterStatus(chatId, characterId, update)` changes a character's status on their card the way a `[schedule_update]` in a Conversation reply does, so the change lasts past the next presence read. It needs `chat-write`, works only for characters in a Conversation chat, and changes nothing in a shared room. It is an optional member of Capability API 1.341, so check for it before calling it (#7886).

### Long-Term Memory

- **Long-Term Memory** recall has new defaults and a recalibrated score. It now recalls up to 12 memories at a score threshold of 0.35, instead of 20 at 0. Every recall lane scores on the same 0 to 1 scale, so raising the threshold drops weaker memories step by step in every style instead of going from many to almost none. One everyday word no longer decides recall on its own, while names, phrases and two shared keywords count in full, and a character's name counts as a name even in lowercase, at the start of a sentence or in Korean. A threshold you set yourself means something different now, and one above 0.4 is read as 0.4, so check it in **Memory Settings** after updating (Marinara-Agents#1261, Marinara-Agents#1269, Marinara-Agents#1381).

- **Long-Term Memory** recall is faster when a chat's memories have many keywords. Its keyword search no longer builds a new pattern for every keyword on every recall, which took most of the recall time, and it doesn't run at all when the keyword weight is 0. A memory that shares one uncommon word with the chat is now recalled when full-text search agrees it matches: "Elena's violin was smashed in the storm" comes up when the chat mentions the violin. Everyday words, names, phrases and memories sharing two keywords score as before (Marinara-Agents#1472).

- **Long-Term Memory** recall fixes. A high-scoring memory is no longer dropped while the recall prompt is put together; the prompt's framing used to push it over the budget while smaller memories that would have fit were skipped. Memories from other chats that share a popular keyword or tag no longer crowd this chat's memories out. A keyword such as "king" no longer matches inside "looking", and one strong full-text hit no longer outranks the best match of a more important search (Marinara-Agents#1253, Marinara-Agents#1254, Marinara-Agents#1256, Marinara-Agents#1270).

- **Long-Term Memory** can bring in a memory that nearly matches the chat when a recalled memory explains it: the evidence for it, the event that caused or triggered a thread or relationship, or the event that paid a thread off. The linked memory still has to match the chat a little on its own, and recalled memories keep their places. Extraction now also records which event directly caused another, so chats extracted again gain these links. A memory reached only through a link, with no match of its own, is no longer recalled, and the graph weight now turns linked recall on or off (Marinara-Agents#1361, Marinara-Agents#1365).

- **Long-Term Memory** handles Korean better. A name followed by a particle, such as `서무진은` or `도진욱에게`, is recognised as the known character, and a short form such as `진욱` for `도진욱` goes to **Review Queue** instead of becoming a new character. Recall finds two-syllable words such as `반지` or `선물`, matches `반지를` with `반지` and `그림 선물` with `그림선물`, and finds one-syllable names such as `린` with their particles (`린이`, `린은`, `린에게`). Existing vaults rebuild their recall index once after the update (Marinara-Agents#1292, Marinara-Agents#1296, Marinara-Agents#1440).

- **Long-Term Memory** shows which embedding source recall uses, such as "Built-in local MiniLM", and says when your memories were embedded with a different one. It explains that the built-in model is English-only and that Korean, Japanese, Chinese or mixed-language vaults need a multilingual embedding model. Changing the embedding connection now rebuilds the recall index when you save, instead of slowing down the next reply, and recall searches go to the embedding model as queries, which helps models such as E5 and nomic-embed-text (Marinara-Agents#1305, Marinara-Agents#1306, Marinara-Agents#1310).

- A new chat branch now recalls the **Long-Term Memory** memories made from the history it shares with the chat it came from. Memories made from summaries written after the branch point, and memories from lorebooks, characters or typed in by hand, stay in the branch they were saved to, and memories never cross into another conversation. If that lookup fails, the branch still recalls its own memories (Marinara-Agents#1434, Marinara-Agents#1444).

- **Long-Term Memory**'s place pickers are simpler. The Vault filters, **Find sources in**, the import destination and the availability editors share two pickers with the same **All**, **Chats**, **Characters** and **Personas** tabs, and the **Branches** tab is gone: a chat with branches is one entry that covers all of them. A chat imported with **All branches** shows one chip and removing it removes every branch, bulk **Remove availability** also lists places that no longer exist, and memories already assigned to one branch keep that assignment (Marinara-Agents#1437, Marinara-Agents#1444).

- **Long-Term Memory** extraction fixes. A fact is saved to the character it names; before, the model could return another character's stored key and a fact about Alice was saved to Bob. A memory that links to one extraction later leaves out no longer makes the whole source fail on every retry; the link is removed with a warning. Valid character and relationship memories are no longer rejected for an empty key list or a relationship change of zero, a prompt template with only spaces falls back to the mode's default, the instructions no longer use example names that could get mixed up with your characters, and a relationship memory that starts with "Summary:" keeps that sentence in the chat prompt (Marinara-Agents#1284, Marinara-Agents#1425, Marinara-Agents#1454, Marinara-Agents#1458).

- **Long-Term Memory** does less work on large vaults. The Memory Vault opens and redraws in milliseconds instead of most of a second in big libraries. Recall no longer re-reads every memory when nothing has changed, and editing a memory re-embeds only the memories whose text changed; the first rebuild after updating still re-embeds everything once. Finished extraction drafts, and drafts that can no longer be applied, are cleaned up after the audit window (30 days by default), and `usage.json` no longer grows with every reply (Marinara-Agents#1271, Marinara-Agents#1370, Marinara-Agents#1427, Marinara-Agents#1445).

- **Long-Term Memory** copes better with damaged or unexpected data. A settings field written by a newer version, for example after an update is rolled back, no longer stops the package from starting, and an invalid saved recall setting falls back to the default instead of breaking settings, recall and search. A damaged `usage.json` or one bad memory no longer blocks recall of the rest, **Delete all data** also removes the backups that repairs keep (and only the newest three are kept), and extraction no longer stops for good after 10,000 rejected suggestions. When the reload after **Reset settings** or a backup import fails, **Retry** now loads the new settings instead of the old ones (Marinara-Agents#1249, Marinara-Agents#1333, Marinara-Agents#1422, Marinara-Agents#1459).

- The **Debug** tab in **Long-Term Memory**'s Memory Settings is rebuilt as a list of events beside a details pane, with search and **All**, **Problems**, **Recall** and **Extraction** filters. Each event shows its outcome, such as "7 of 12 kept", when it ran and how long it took. A recall lists each candidate with a score bar against the minimum relevance and the reason it was or wasn't added, and an empty recall says why. An extraction shows what was kept or dropped and why, with a link to **Review Queue** for pending drafts. **Open debug log** on a Vault memory opens Debug filtered to that memory, and **Copy JSON** copies the raw records (Marinara-Agents#1257, Marinara-Agents#1262, Marinara-Agents#1263, Marinara-Agents#1274, Marinara-Agents#1276, Marinara-Agents#1326, Marinara-Agents#1327, Marinara-Agents#1456).

- **Long-Term Memory**'s screens now look as designed. They used styles the Engine doesn't provide, so spacing, borders, selected-row highlights, checkbox sizes and focus rings were missing. Screen readers announce the Vault place lists as single choice, and the arrow keys move between places. Failed requests show the package's own message instead of raw text such as "Not Found", the **Review** summary after **Apply** reads as whole sentences, switching screens no longer flashes a "Loading" panel, and a **Maintenance** result shows at the top of its own tab (Marinara-Agents#1384, Marinara-Agents#1385, Marinara-Agents#1400, Marinara-Agents#1401, Marinara-Agents#1455).

- **Long-Term Memory**'s setup guide shows Professor Mari's pictures again. This version of Marinara renamed them, so an older Long-Term Memory shows broken pictures there until you update it (Marinara-Agents#1497).

### Slurp

- **Slurp** Creators whose character has a **Conversation Schedule** now follow it. Slurp couldn't read the schedule's time ranges, so every schedule was ignored, and a Creator who posted often could count as away at every check, pushing a promised follow-up back again and again. Times the schedule doesn't cover count as free time, each block's status decides whether the Creator can be reached, and a follow-up more than 12 hours late goes out even if the Creator is away (Marinara-Agents#1471).

- **Slurp** has trends. Something takes off, such as a post that gets many likes, unlocks or tips, your own page, or a trend you start with **Start a trend** in **Stir** (ten ready-made ones), and some Creators join in their own way and at their own spice level until it fades. **Steer a trend** changes what a running trend leans into. **Discover** has a **Trending on Slurp** row, posts in a trend show a chip, and trends can be searched (Marinara-Agents#1408).

- With **Carryover to chats** on, Engine chats with a Slurp character now include that character's ongoing Slurp storyline, their love life with other Creators, how close they are to you and a few facts from your DMs. Secret couples stay out, and facts private to a DM are only included for the persona who had that DM. The**Carryover to chats** setting says in how many chats with your Creators **Include Slurp activity** is on. Lorebook entries set to **At Depth** now reach Slurp DMs and posts instead of being dropped, and a DM's **Deep details** shows which lore was used. Scenes started from a DM use the connection Slurp planned with, so they start on the first try (Marinara-Agents#1399).

- **Slurp** Creators keep what is always true about their character, such as being unable to speak, being blind or speaking only one language, in every post, Story, DM and comment reply. Slurp used to keep only the start of the card and a rotating handful of details, so facts later in the card were often missing. The card reading now covers much more of the card, splits Chinese and Japanese sentences and long W++ or PList attribute lists properly, and **Life details** (Creator settings → **Memory**) lists these facts as **Always true**. Your edits in Life details now survive card changes: what you added stays, what you removed stays out, and the rest follows the card. **Read card again** still starts over (Marinara-Agents#1321).

- In **Slurp**'s post composer, a guided post is now a normal post written from your wish, with a title, text and picture and the same audience, spice level and image directions as any other post. One switch chooses between **Write it myself** (Title and Text) and **Guided** (your wish, **Add from Slurp** for a storyline, saved idea, wardrobe look, owed brand deal or collab, **Draw a picture too** and **Write it**). A photo you added stays and no picture is drawn. Writing help now also works for Creators with a hidden or hinted identity, which used to get no character brief at all (Marinara-Agents#1343, Marinara-Agents#1346).

- A **Slurp** Creator's posting strategy is now **Page style**, summed up in plain words such as "Homemade · pictures, some notes · automatic" at the top of the Production settings and on the Overview. **Suggest from card** asks the model once for a page style that fits the character, shows why and the exact changes, and changes nothing until you tap **Use this page style**. The detailed controls are under **Fine-tune page style**, where the old text-only percent is now **Lean towards words** (Marinara-Agents#1330).

- **Slurp** chat messages have **Deep details**, like posts. Choose it from a Creator reply's message menu to see the prompt that was sent, the model and its settings, the answer, and what the Creator knew at that moment, such as your relationship, their feelings and memories. Each chat keeps the newest 50 (Marinara-Agents#1332).

- In **Slurp**'s **Stir** tab, **Recent plays** follows a collab you suggested or pushed to the end. It says whether the collab is waiting, agreed, coming up, turned down (with the reason), blocked or posted, and opens the joint post once it is up. **Make it happen** pushes a collab that is still waiting for an answer, and **Undo** only shows while the collab can still be taken back (Marinara-Agents#1308).

- After a breakup in **Slurp**, you choose what the Creator does with it: keep the usual history, **Move on** while remembering, or **Forget the relationship**. The choice is in Studio's couples, **Your relationship** and **Stir**, and Stir can apply it to an existing ex. Posts and messages already published stay (Marinara-Agents#1294).

- **Slurp** has **Backstage → Messaging → Stop after one unanswered text**, off by default. With it on, a Creator texts first once and then waits for your reply, instead of reviving a quiet chat and complaining about being left on read. Replies, promised deliveries, reminders and commissions still come (Marinara-Agents#1290).

- **Slurp** follows each Creator's gender. Posts, DMs, scenes and drama use their pronouns (they/them when no gender is set), and image prompts say male or female when the appearance doesn't. A new **Clothing style** setting (**Auto**, **Feminine**, **Masculine** or **Neutral**) decides what a lingerie post means, so a male Creator gets an underwear shoot unless his clothing style says otherwise. Applying or rolling back a **Backstage** improvement no longer clears a Creator's appearance, wardrobe, locations and clothing style (Marinara-Agents#1383).

- A **Slurp** Creator's bio and stage voice now steer what they post about, so a bio about a cosplay hobby brings cosplay posts. The rule against repeating recent posts now stops the same setting, framing, outfit and wording, not a theme the bio or card keeps coming back to (Marinara-Agents#1359).

- **Slurp** Creators can see what is in their own locked posts while chatting, instead of a placeholder, and are told not to quote what you haven't unlocked; a fan's **Deep details** hides those posts too. Lorebook entries now reach DMs as well as posts (Marinara-Agents#1352).

- **Slurp** understands Engine macros, such as `{{random::red::green::blue}}`, in Creator cards and wardrobe looks instead of sending them to the model as written. Creators also stop posting the same photo over and over: a repost is never reposted, and an original that was already reused isn't picked again. **Settings → Publishing → Picture reuse** sets how often earlier pictures come back: **Off**, **Rare** or **Regular** (the old behaviour and the default) (Marinara-Agents#1267).

- More control over **Slurp** pictures. Style tags no longer appear twice in a picture prompt, and the gallery fallback takes the least recently used picture instead of the same one again. **Settings → Images → Draw missing avatars and banners** decides whether Slurp draws new avatars and banners in the background; it starts off on new installs and stays on for existing ones, and copying a card's own pictures is unaffected. Pictures are described for fan comments by person, clothes, pose and place rather than art style, and **Caption instructions** lets you write your own. **Always in their pictures** (Creator settings → **Production**) sets words that take the Creator's name's place in every picture prompt, used only for an Open identity. Clothes are in good condition unless the card or caption says otherwise (Marinara-Agents#1410).

- In **Slurp** pictures with **The image model knows this character** on, the Creator's name now comes after the style profile's tags instead of in front of them, where image models read it as part of the style. The order is art style, style tags, name, look, scene (Marinara-Agents#1317).

- **Slurp** pictures with two people, such as a collab, give the other person their own name and look, so the two characters' features mix less. The second Creator's look used to reach only the prompt writer, so with **Enhance image prompts** off it was missing, and their own **The image model knows this character** switch was ignored on someone else's page (Marinara-Agents#1319).

- For tag-based image models, a **Slurp** Creator's identity tags, such as `ryuuzaki umi, magic knight rayearth`, now open the Creator's part of the picture prompt once, instead of sitting behind `1girl, blue eyes` or appearing twice in a different order. The card name is no longer added a second time when the prompt writer already wrote it in tag order, and another person in the picture is recognised by their card name too, so they get their look and reference picture (Marinara-Agents#1430).

- When adding a **Slurp** Creator, you can turn off **The image model knows this character** right away, in quick setup, the customise path, role-play sign-up and manual **Create**, instead of switching it off in the Creator's settings afterwards (Marinara-Agents#1357).

- When a **Slurp** Creator's linked character or persona has an **Image Appearance Override**, **Use the card's image tags** under **Appearance for pictures** copies those tags into the Creator's appearance. It asks first when it would replace an appearance you wrote, and **Use linked appearance** undoes it (Marinara-Agents#1367).

- **Slurp**'s image prompt rewrite accepts answers with a line break, a trailing comma or extra text around them, which used to count as no answer and fill the server log with "Image prompt rewrite unusable". When your AI budget skips the rewrite (its mode is off, its **Enhance image prompts** row is off or the daily limit is reached), the picture gets the full draft, as with enhancing off, instead of a cut-down draft and a warning (Marinara-Agents#1325).

- When **Slurp**'s image prompt rewrite does fail, the server log says why: an empty answer, an answer cut off at the token limit, invalid JSON, a missing prompt, no text connection or a failed request, with the start of the answer and the model's name (Marinara-Agents#1341).

- **Slurp** no longer rejects an image prompt rewrite for using words from the Creator's appearance, such as an appearance that describes the body on a clothed post. When a picture falls back to a draft that is too long, the scene is kept instead of being crowded out by a long appearance (Marinara-Agents#1348).

- **Slurp**'s image prompt rewrite and its other short model calls (page design, page style, reading a look, fan voice, Stir plans and writing help) now use your connection's max tokens when that is higher than Slurp's own limit, so reasoning models no longer spend the whole limit thinking and return nothing (Marinara-Agents#1350).

- **Slurp** remembers which persona you browse as on the server, so every device shows the same Inbox. The Discover profile editor says when a Creator has reached the tag limit, and a save blocked by a Hinted identity names the tag that gives the Creator away. Creators now like and comment on each other's public posts, about two a day each, at no AI cost (Marinara-Agents#1412).

- **Slurp** fixes from player reports. DM replies can be up to 2,400 characters instead of 900 and are cut at the end of a sentence or word, never mid-word, and Creators quote their usual commission prices instead of making them up. **Cancel** ends a subscription to a removed Creator. Fans comment on what is in a picture, not its art style. The feed no longer drifts to one kind of spicy post across every Creator at once. Family members are no longer paired as couples automatically; cards that call two people lovers still are, and you can force a couple in **Stir**. Work mode blurs only real pictures and videos, not interface icons, couples pages are no longer flagged as missing a source, the sign-up scene names the connection it can't reach, and a prepared post is no longer published twice or thrown away for being too early (Marinara-Agents#1403).

- **Slurp** fixes: backups now include reports. **Create posts now** names the Creators it skipped or couldn't post for. Double-tapping to accept a commission no longer draws the picture twice. On phones, the settings search stays reachable inside a section. Commission and message data sent to the browser no longer include where the picture is stored on the server (Marinara-Agents#1315).

- **Slurp** opens faster on phones. Engine avatars come as small pictures sized for where they are shown, instead of 16 MB or more of full-size images that held up the feed, and post cards no longer build their **Report** sheet until you open it (Marinara-Agents#1387).

- On Android, adding or replacing a picture on a **Slurp** post opens the full file chooser, so you can pick pictures from any folder, not only the few albums the photo picker shows (Marinara-Agents#1379).

- Restoring a **Slurp** backup now checks each picture: only image files whose name matches their contents are restored, anything else is skipped and listed in the restore results, and AVIF pictures are no longer dropped. Slurp also serves every stored picture as the type its contents show (Marinara-Agents#1477).

- **Slurp**'s automatic work waits for your own requests on the same connection. While one of your chats is replying, or while you use **Write**, **Improve**, **Draft voice** or another Slurp tool that asks the AI, an automatic post no longer reads a Creator's card or refreshes shared ideas beside it. An automatic post no longer makes your other automatic work, Noodle's included, wait 30 seconds, and a new Creator's first automatic post is no longer refused (Marinara-Agents#1497).

### Other agents

- **Noodle** no longer puts text meant for the AI that writes its image prompts into the prompt sent to ComfyUI and other image services. The poster's **Personality**, their image habits, your image connection's **Image Prompting Instructions** and the **Auto** style sentence used to land as plain sentences in tag-only prompts. They now only guide the AI that rewrites the prompt, and if it copies one of those sentences word for word, Noodle removes it; tag lists stay. The rewrite now uses Noodle's own text connection when no **Agents** default connection is set, instead of not running at all. **Include descriptions** notes go to the AI as context while **Interpret image prompts** is on and are added as written while it is off, and a style profile's **Style text** is still used when no rewrite runs. The **Noodle Post Image** prompt override (**Settings → Generations → Prompt Overrides**) shows the new default (#7352, #7360, Marinara-Agents#1279, Marinara-Agents#1283).

- The switch that adds a character's **Image Generation Instructions** to their **Noodle** pictures moved from the character editor's **Convo** tab into Noodle: open the character's Noodle profile, choose **Edit profile** and tick **Use this character's image instructions in Noodle images**. **Edit image instructions** opens the character's **Convo** tab. Update Noodle to 1.5.4 to get it; your current choice carries over. The help text for those instructions now says that Noodle and Slurp can both use them. For package authors: packages can open a character in the editor (capability API 1.67) (#7406, Marinara-Agents#1298).

- Each **Noodle** character can have their own image connection: pick it under **Image connection** in the character's **Edit profile**. **Use Noodle image connection** is the default, and a connection that can't make images falls back to Noodle's. Noodle still needs its own or a default image connection for any pictures to be made (Marinara-Agents#1301).

- **Noodle**'s sticker, emoji, picture and poll pickers keep Noodle's look instead of being see-through, fit on a phone screen, and no longer show the chat emoji settings, which belong to a chat and do nothing in Noodle (Marinara-Agents#1494, Marinara-Agents#1497).

- **Quartermaster** has layered clothing. Torso and legs each have **Inner**, **Mid** and **Outer** slots, so a shirt, waistcoat and jacket, or stockings under shorts, can be worn together, and there are new **Socks** and **Extra Wearable** slots for worn items nothing else fits. On the portrait ring each region's layers sit in one stack: tap a tab or use the arrows to switch, and the outermost worn layer shows first. The tracker knows the layers, so putting something on under a worn layer moves the outer item up instead of replacing it, and **Build Wardrobe** puts a second piece of the same outfit one layer up instead of dropping it. Items and outfits you already have keep their slots; the old torso and legs clothing slots are now the **Inner** ones (Marinara-Agents#1439; thanks @newfiesledneck).

- **Relationship Tracker** now looks like the other **Tracker Panel** sections: the same header with an arrow, icon and title, instead of its own card with a large title. It folds like the built-in sections, remembers that after a reload and keeps text you are still editing. In the desktop **Trackers** window it no longer repeats its title, and its toolbar button matches Quartermaster's and Beholder's (Marinara-Agents#1248; thanks @NoblezDomain).

- **Relationship Tracker**'s **Update from History** no longer fails with "Persona update 1 must contain exactly five values". The model is now told how your persona's current perceptions are written, so it stops copying them back in the wrong shape. Automatic tracking had the same problem and quietly skipped your persona's perceptions; it updates them again (Marinara-Agents#1287; thanks @NoblezDomain).

- When the model's answer to **Update from History** is rejected, for example because it named someone who isn't a character card in the chat, the **Tracker Panel** now shows its changes so you can fix and save them. Each change uses character names and says what is wrong in plain words, such as "Mira" isn't a character card in this chat, and the model's raw answer is under **Details for bug reports**. Relationship changes and persona perceptions save separately. A rejected answer stays available for 30 minutes or until the next History run, and saving is refused if the chat's cards, persona or tracker changed in the meantime. Error messages now name the unknown character, and the model is told more clearly where your persona belongs, so this happens less (Marinara-Agents#1390; thanks @NoblezDomain).

- **Beholder** opened from its shortcut in a Roleplay chat now stays open until you close it. A click on a message, the composer or anywhere else in the chat used to close it, and so did dismissing its first-open note or choosing **Re-extract this turn** from its build menu. It still closes when you switch chats or leave the chat. Opened from the **Tracker Panel**, it now also stays open when you close the Tracker Panel (Marinara-Agents#1469, Marinara-Agents#1475).

- **Gacha Forge** paints location backgrounds for places named in Korean and other non-Latin scripts. Those places used to get no background, and names that differed only in non-Latin letters, such as `숲 1` and `동굴 1`, shared one picture. Backgrounds you already have keep working. On an iPhone turned sideways, the game's text is no longer oversized, the stage fits the visible screen, its **Settings** screen needs less scrolling, and the fullscreen button, which iPhone Safari can't use, is hidden (Marinara-Agents#1470).

### Docs

- The guides match this version again. Home, chats, Conversation, Roleplay, Game, characters, connections, agents, media, Noodle and the install guides describe the app as it is now, with new sections such as **Outbound HTTP proxy**, **GM intro message**, **Editing game data by hand** and **Updating from 2.5.0**. Professor Mari's reference to the downloadable agents is complete again, including Quartermaster, Relationship Tracker and Gacha Forge (#7821).

### Game mode (work in progress)

These parts of Game Mode are still being built and may not work fully yet. Overworld games stay off unless the server sets `MARINARA_OVERWORLD_GAMES=true`.

- The first step of a new game now asks for **Classic RPG** or **Overworld RPG**, and the game keeps that choice for all its sessions. Overworld games stay off unless the server sets `MARINARA_OVERWORLD_GAMES=true`, so until then the Overworld card is greyed out and new games are Classic, the way Game Mode has always played. Games made earlier play as before (#7613).

- In Overworld games (behind `MARINARA_OVERWORLD_GAMES`), town buildings have furnished rooms with people in them depending on the hour, a town can be laid out by hand, caves, mines and crypts in town have **Go down**, and the Game Master can open a place's map with `[map:]`. Caves, ruins and crypts near a settlement show on the overworld and stay closed until the story opens them. Walking a map passes time on the clock, and a story script can fire a `step` event when a walk crosses a square (#7613).

- For package developers: map packs can use image tile packs (Capability API 1.80), PNG sheets with sprites several squares wide, walking characters, and edge tiles that blend water, roads and streets into the ground (#7613).

- **Overworld games (off by default):** Game Mode has the first parts of generated worlds. A **Setting kit** on the World step gives a world its words and the kinds of change it allows: pick one of eight starters, such as wuxia, modern day or space opera, have the model write one, or change any word. **Make a world** then lays out regions, settlements and the ways between them from a seed, starting from the places your lorebooks name, gives each settlement named residents, and runs the world's history from its founding. In play, the world moves on by itself as time passes, news reaches the party, and what the party does stays done, while a swipe takes it back. These stay off unless the server sets `MARINARA_OVERWORLD_GAMES=true`; until then new games start as Classic games and the wizard says why the world choices are greyed out (#7470).

- Game Mode loot now fits the game's genre: a science-fiction or modern-day fight no longer drops Iron Shortswords, and a genre without its own loot drops plain things instead of fantasy gear. Elements come from one shared list, so a model's "pyro" counts as fire and its reactions and weather apply. The new-game wizard's setting and goal ideas come from eight kinds of setting in a new mix each time, and **Wuxia** joins the genres (#7471).

- **Overworld games (off by default):** a setting kit also names its loot, money and everyday shop, elements, battlefields, and art and music family, so a game without a ruleset can buy, sell and earn in the kit's coin, and a cyberpunk fight no longer plays the fantasy battle track (#7471).

- **Overworld games (off by default):** a game with a generated world gets a **World** tab in the journal (where the party is, how well known it is, its standing with each group, its deeds and the news it has heard), a World Maps map made straight from the world, and a pixel overworld where you pick a settlement and **Walk there** while the in-game clock runs. The party can **Enter** the town it is in and walk to its places and people. The overworld and towns are drawn from tile packs, which you can import, choose, export or remove under **Tile packs** in the Agents panel (#7472).

- **Overworld games (off by default):** setting kits and worlds can be shared as files. Setup has **Download this kit**, **Import a kit file**, **Download this world** and **Import a world file**, and a game's **World** tab has **Download the world**. A file in another format or from a newer version is refused with the reason. A world can keep hand edits (places renamed or moved, ground painted, places and people added), and the Game Master, overworld, towns and **World** tab all see them. For package developers: Capability API 1.72 lets an Experience ship its own setting kit, worlds and tile pack as a map pack (#7473).

- **Overworld games (off by default):** worlds can be kept in a library outside any game and picked under **Your worlds** in setup, and a game's next session carries on the world's deeds, days and standing. A world can carry a story script with events, cutscenes and objectives, which show under **Story** on the **World** tab; the new guide _Writing story scripts_ explains how to write one. Hand edits can also hold battlefields painted for a place, used for fights that start there, and hand-made town layouts. Text-rewrite agents such as Prose Guardian can no longer change a reply's world, place or story tags (#7474).

- In Overworld games, the world now keeps what happened in it. Each session carries on from where the last one left the world instead of rebuilding it from its recipe, and world files and setup files carry the world as it was made, so a world made with an earlier version of the world maker plays as it was made. Overworld games are off unless the server sets `MARINARA_OVERWORLD_GAMES=true` (#7568).

- A game made without a world can be given one later with **Make a world for this game** on the journal's **World** tab, written for the game's own setting. The world starts from the next turn, and earlier turns stay as they are. The button is greyed out while Overworld games are off (#7568).

- A long write in game setup now counts the seconds and says a model can take a few minutes. A market day where the world put the party now lasts across turns and counts what was bought (#7568).

- Game Mode ruleset markets can now have market days (capability API 1.69): sellers turn up rare stock, a place keeps only a few of some things each day, and the party can sell back to a seller who deals in that kind of thing. Prices are said in the coin the cost is written in, so a 5e potion costs 50 gold pieces. A ruleset rider such as 5e's Sneak Attack can now name the item tags it fires on (capability API 1.70), so it works with a weapon held from the bag (#7470).

- Tactical battles in a Game Mode ruleset can now use line of sight, cover in degrees and raised ground, so items and reactions need sight of their target and higher ground can help an attack or hurt in a fall. A ruleset can also give each fighter their own initiative, with the turn order shown on the board and only the current unit able to act, and conditions such as Haste and Slow can change what a character may do on their turn. Rulesets that use these need Capability API 1.74 to 1.76 (#7563).

- A ruleset can give characters starting gear, taken into the bag from a **Starting gear** dialog in the inventory, and can carry sheets made on an older layout over to a new one without losing their numbers. Catalog items can be risky goods or fakes that pass for something else until a sheet, a fight or a sale gives them away, and a merchant can be dishonest (Capability API 1.77 to 1.79) (#7563).

- A ruleset and its catalog files can be shared as one `.ruleset.json` file and imported under **Import agents → Game Mode ruleset**, with the same review as a ruleset file. Creature packs can give fight creatures their own art on both boards (see **Writing Creature Packs**). A refused purchase or sale is now told to the player, and the turn order is no longer covered by the map, party bar or menu (#7563).

- A Game Mode ruleset can now include a step-by-step character builder. When it does, the sheet editor offers **Guided** beside **All fields**. It walks you through choices such as class and background, ability scores (point buy, standard array, rolled or typed in), skills, saves and starting gear, says what each step still waits on, and shows the sheet's summary numbers. It changes only what it filled in itself. Rulesets that use it need Capability API 1.86 or later (#7579).

- Rulesets can also read a critical range off the sheet, multiply derived values, fill list numbers with a die roll using a **Roll** button in the editor, let a weapon add a value from its holder's sheet or reroll low damage dice when held in two hands, and give each class its own spellcasting ability. A sheet can have up to 400 derived values. **Writing Game Mode Rulesets** covers all of it (Capability API 1.81 to 1.112) (#7579).

- Game Mode rulesets can cover many more tabletop systems. Checks can use dice pools with outcome bands, keep-the-highest dice, exploding dice, rolls against a number on the sheet and narrative symbol dice. The Game Master can advance the permanent character sheet, run progress clocks shown above the game, and read a full rules reference of up to 16,000 characters, which is the first thing cut when the context is full. A party can share one party sheet and build it together. The guided character builder handles point-buy dots, priced purchases, shared point pools, creation rolls in order and starting coins. Combat adds minimum damage and dazing hits. A ruleset can now be up to 512 KB and a catalog file up to 2 MB. Ruleset authors: each feature needs the Capability API version listed in the [ruleset authoring guide](docs/extending/writing-rulesets.md) (#7629).

- A Game Mode ruleset's fights can now cover much more of a 5e encounter. Creatures have sizes and can fly, swim, climb and burrow, and fliers move up and down on boards with height. Darkvision, blindsight and truesight work, with light and darkness on the board, and using something can need verbal or somatic components. An area can stay on the board as a zone that its caster moves or that drifts on its own. Creatures can heal their own side and cast spells without slots, and conditions can end when their holder is hurt, passes a new save or attacks. A resistance or immunity can let some harm through, such as a magic weapon's, damage can change with circumstances, and exhaustion at its worst can halve the health maximum. Weapons can deal extra damage, an item can have a switch you turn on and off in a fight, such as a flame tongue's flames, and items and spells can cure named conditions. Rulesets that use these need Capability API 1.101 to 1.181 (#7584).

- Ruleset fights can now run more of 5e's monsters and magic items: large creatures that fill several squares, conditions that make a creature bigger or smaller, auras and gazes you can look away from, actions that recharge or charge up, pushes, and walls built in sections that break one section at a time. Attacks follow more of the rules around a blow: what is added once it hits, rerolls and dice taken off a roll, half damage on a miss, extra dice on a critical, opportunity attacks, and the Attack action with a held weapon. Conditions can decide what their holder does with their turn, lower a maximum, keep surprise off, or end by putting another condition on in their place, and a creature can take a second turn in the first round or roll initiative twice. Rulesets that use these need Capability API 1.182 to 1.270 (#7587).

- Ruleset fights now have real hiding, searching and readying: a creature can hide behind a wall or with camouflage, others search for it or notice it with passive Perception, and starting hidden can bring surprise. Fights can be fought in darkness or sunlight, with lights that can be put out and lit again, fog that blocks sight and wind that clears it. Spells, items and creatures can teleport, and legendary creatures get legendary actions and legendary spellcasting. Charged items follow more of 5e's rules, such as an item that turns into another when its last charge is spent, and conditions can end when their holder moves, acts or gets too far from whoever put them on. Rulesets that use these need Capability API 1.271 to 1.314 (#7588).

- A new game's **Party** step has a **GM intro message**: **None** lets the Game Master open the game as usual, **Defined** opens it with exactly the message you write, and **Guided** has the Game Master write the opening from your directions. A story can set its own intro and lock it. A defined intro is never rewritten by an agent or after a roll (#7589).

- Ruleset fights can now have lairs and bosses: lair actions, Legendary Resistance, auras that grow or linger, creatures that call others into the fight or pull people toward them, and a creature that hangs on at 1 health. The board can change as rounds pass: props on it can be attacked and broken, growth spreads across it, and the ground can carry whoever stands on it toward an edge. A rest can spend dice to heal, as 5e's Hit Dice do, from more than one pool, and an item can be used as a reaction. A fight's board can be drawn from a board pack, and catalog entries and conditions can bring their own icons, which show on the board, in the fight menu, the inventory and the party bar. Rulesets that use these need Capability API 1.315 to 1.339 (#7589).

## [2.5.0]

- Release notes too long for a GitHub release are trimmed at a whole entry and end with a link to the full changelog, so publishing a large release such as this one no longer fails (#7146).

- Added Professor Mari's v2.5.0 What's New with screenshots and recordings of the customizable chat windows and widget styles, Gacha Forge, Quartermaster, Relationship Tracker, Decision models and Advanced Memory. The **Memory Recall** help now says Advanced Recall progress appears in **Agent activity** (#7146).
- On phones and tablets, Home's browser bar now matches the color of the top bar above it instead of showing as a lighter strip. With reduced motion turned on, theme and accent changes no longer play slow transitions, and dialogs close at once. On phone-width screens in some WebKit browsers, Conversation message buttons such as Regenerate and **Bookmark, pin or note** no longer ignore a press, and Tab reaches them (#7146).

- On phones with Chromium-based browsers, tapping a chat button right after flicking it into place now opens it on the first tap instead of being ignored (#7146).

- Pressing Escape to cancel dragging a chat, character or persona, or to close a picker such as the Text to Speech voice search, no longer closes the whole side panel. Dropping a chat window button onto another one now places it neatly beside it instead of hiding one under the other. On phones, Help explains the **Chat tools** button and lists the tools inside it, labels the map and party buttons again, and keeps its instructions from covering the buttons along the top (#7146).

- Coming back to a chat before its Expression agent finished no longer shows the previous turn's sprites when **Only show active sprites** is on. Switching chats during a Game translation no longer leaves that message marked as translating. On computers, the **Trackers** button starts in the top-right corner when the Tracker Panel is on the left, so it no longer covers the panel's header and settings button (#7146).

- Game Mode combat works on phones and tablets that open Marinara over plain HTTP, such as a LAN address or Tailscale. Every action in a fight used to fail there before reaching the server, so battles in new games could not continue (#7146).

- On Android (Termux), updating to this version no longer runs out of memory while building the app. Every build path, including the first start after an automatic update from v2.4.6, the in-app updater and switching update channels, now gives the build the memory it needs (up to 1.5 GB, at most half the phone's memory) without raising the running server's limit, and a memory limit you set yourself still wins. Two Game Mode labels that showed raw text keys now show real text, and Decision model warnings use your theme's colors instead of a fixed yellow that was hard to read in light mode (#7146).

- The README and the Built-in agents guide now list **Quartermaster** and **Relationship Tracker** as regular Tracker Agents, since both are now in the stable Download Agents catalog, and link to their package guides on `main` (#7146).

- **Multiplayer (work in progress)** is sturdier. When the host stops or turns off a room, guests who are connected at that moment see that it ended instead of reconnecting for hours. A guest who leaves or restarts can rejoin under the same name and, in Game, keeps their character. **Leave** in an old chat no longer ends the session in another room. Adding or removing characters from Chat Settings in a hosted room no longer breaks replies. A stale session or a room port that fails to open no longer blocks hosting or joining again. The Players list says **Offline** instead of "Reconnecting", and turning the in-app switch off points to **Settings → Advanced → Multiplayer**. Room addresses work over IPv6. Someone outside the room can no longer lock guests out with floods of requests or idle connections, names can't hide invisible characters to look like another player, and guests see which player is the host (#7146).

- Professor Mari's `mari code check` now runs inside her shell sandbox, without network access or the server's secrets, because it runs project scripts she can edit. Where no sandbox is available, she asks you to run `pnpm check` yourself. She can no longer read, copy, change or delete the key file that protects your saved API keys, and her shell commands can't write into your saved data folder. `/api/health` still answers uptime checks and launchers without a password, but only shows local model names and GPU details to this machine, a trusted network or a signed-in browser (#7146).

- Exports and backups are more reliable. Exporting many chats at once streams the ZIP one chat at a time instead of building it all in memory. Bulk lorebook and preset exports and the compatible profile ZIP keep every item when two share a name, numbering the copies. A large-gallery character or persona export can be imported again even when it is bigger than the normal upload limit for JSON. Restoring a trashed message brings back the lorebook changes an agent made with it. Feature switches restored from a profile backup take effect right away. The server-folder backup no longer fails on Docker or Termux, and an export over the image budget says so instead of "request body is too large" (#7146).

- Jumping from a search result into a Game chat no longer shows the "not available in Game mode" notice twice in development builds. The full browser regression suite now drives the redesigned Chat Settings window and the plain-language copy, so it passes again on desktop, Android-sized and iPhone-sized browsers (#7146).

- Updated the upload parser, proxy address handling and two logging and styling helpers to their patched releases, clearing four newly published dependency advisories. The dormant Bunny Review workflow no longer lets files in a pull request replace the Python modules it runs with, and only trusts its own review markers (#7146).

- Prepared v2.5.0 across the Engine, Home version, PWA manifest, README, Windows installer, and Android bootstrap metadata. Android uses version code 48 so the APK can update existing installations, and the Credits list is refreshed (#7146).
- The lorebook sidebar's **All** view now shows one list in your selected sort order, without dividing it into category sections (#7154).

- **Advanced Memory** now offers **Pause processing** and **Resume processing**, including during initial setup. Paused work keeps its progress visible, stays paused when new replies arrive, and resumes from saved checkpoints.

- **Play As Character** now shows each character's title/comment in persona pickers and the selected identity in Chat Settings, making cards with the same name easier to tell apart. Cards without a title keep the **Character** label (#7151).

- Enabling **Advanced Memory** turns off basic **Memory Recall**, and enabling basic recall turns off Advanced Memory and stops its running work. Delayed settings saves preserve your choice. Advanced Memory can be switched off during processing or a status error, including when a saved message or narrator is gone, without deleting the chat or its prepared memories (#7150).

- Saving a connection change that affects **Long-Term Memory** now waits for the package's index refresh when supported, and reports refresh completion, failure or unavailability separately from the successful save. Unrelated connection and agent edits do not trigger LTM refreshes; older or inactive packages still allow configuration saves (#7042).

- Windows opened from message actions — including **Hide from AI**, **Model Thoughts**, **Peek Prompt**, notes, reactions and confirmations — now follow **Apply preset font**, **Apply preset shape** and **Apply preset colors** on phones and computers (#7144).

- On phones, the **Chat tools** three-dots button, lock and expanded tools now follow your selected chat widget shape, including Dottore's cut corners and custom shapes. Expanded tools stay aligned with the launcher at screen edges and use the same spacing as other snapped buttons. **Echo Chamber** places Dottore's and Mari's ornaments beside its title like other mobile windows, while keeping its movable, resizable window (#7144).

- In Game Mode, HUD widgets, the map panel on computers, characters' side remarks and character sheets now follow **Apply preset font**, **Apply preset shape** and **Apply preset colors**, like the dialogue box beside them. Widget numbers keep the game's own accent colors. With the switches off, nothing changes (#7136).

- Claude agents now keep signed thinking across tool calls, and Opus 4/4.1 batches stay within the model output limit when reasoning is enabled. Agent thinking headroom respects small context windows, including fallback connections, and connection Send switches remain effective on shared-connection agents and retries (#7131).

- Agents now use the generation settings saved on their connection under **Use custom defaults for this connection**: Top P, Top K, Frequency, Presence, Reasoning Effort, Verbosity, OpenRouter Service Tier, Custom Parameters and headers, and extra parameters such as Top A. A parameter with a Send switch is sent only while the switch is on. This covers agents on the chat's own connection, retries, knowledge agents, the Illustrator's prompt writer and installed agent packages. A Reasoning Effort you pick (custom defaults start at **Maximum**) now replaces the "off" that JSON agents asked for, and agents that think get extra output room so their answers aren't cut short; with no level saved, agents behave as before. Claude requests with thinking on no longer send Top K, which Claude rejects (#7131).

- Professor Mari clears an earlier request error when you try again, so a corrected connection or successful reply no longer leaves the old error visible until the server restarts (#7126).

- NanoGPT connections now show each model's subscription cost in the **Connections** menu by the chat input, not just in the connection editor: `1x` when the model is covered at the normal rate, a higher multiplier such as `2x` when each token sent draws more from your weekly allowance, and **Paid** when the model bills to your balance instead. These pills follow the connection's **Show subscription usage** switch, which is off by default, so they appear only on connections you have set to track usage (#7109).

- The **Trackers** button opens Tracker Panel when it is enabled for the chat, and the standard tracker window otherwise. On phones, selecting Tracker Panel also hides the old HUD tracker widgets, regardless of **Dock Tracker Panel to edge**. Detached character trackers use readable character cards that rearrange as their window is resized, with a single heading (#7128).

- Each background in the background library now has a **Download** button that saves the image with its file name, built-in backgrounds included. On iPhone and iPad it opens the share sheet, or offers **Save file** if the sheet can't open straight away (#7129).
- Exporting a character or persona with a large gallery no longer crashes the server, and an export that fails now shows an error instead of doing nothing. On iPhone and iPad, exports open the share sheet so you can save the file; if it can't open straight away, tap **Save file** on the message that appears. Character and persona ZIP exports keep every file when two share a name (#7115).
- On phones, Echo Chamber can be moved and resized, and Chat tools expands into round buttons instead of drawer rows. Dottore and Mari chat widget presets use refreshed palettes inspired by their character references, and cut-corner windows keep their backgrounds inside the frame (#7121).

- Downloaded packages can now start roleplay scenes from their own threads, such as a direct message in a social app, the same way `/scene` starts one from a Conversation. **Back** returns to the thread instead of a Conversation. When the package asks for it, the thread stays locked while the scene runs and the scene's recap goes back to the package when you end it. For package developers: capability API 1.66 adds `api.registerSceneOrigin` and the `scenes` permission (#7118).

- Roleplay chats on wide screens can now sit on the left or right instead of the center: choose **Chat position** in **Settings > Appearance > Roleplay > Roleplay Presentation**. Messages and the input box move together and stay clear of open sidebars and a Tracker Panel on the same side. **Center** remains the default, and phones and Game mode are unchanged (#7106).

- You can now change a connection's model straight from the **Connections** menu by the chat input: search or type a model ID, star favourites to pin them on top, and refresh the list when needed. On phones, tap a connection to see its models. Chat Settings → **Connection** has the same **Model** field. The model is saved to the connection, so agents and other chats that use it switch too. Fetched model lists are kept, so the menu doesn't ask the provider every time (#7098).

- Chat input popups now follow **Apply preset font**, **Apply preset shape**, and **Apply preset colors**, including emoji and media pickers, autocomplete menus, character responses, Push Story options, quick replies, and Game dice and address controls. Each switch works independently, and leaving them off keeps the existing look (#7103).

- The **Character Schedule Manager**, and the schedule editor it opens, now show each character's portrait the way you cropped it in the character editor instead of the uncropped image. In the manager's list the portrait stays in its small round slot (#7100).

- Character cards and personas have a new **Image Appearance Override** switch under **Appearance**. Turn it on to write a separate, image-prompt-ready description of that character, and **Attach Card Appearance** sends that instead of the full **Appearance** text, so clothing and other scene-specific detail from the card no longer leaks into illustrations. While the switch is off, or its box is empty, image prompts keep using **Appearance** as before, and the narrator always uses the full **Appearance** text. This covers chat illustrations, conversation selfies, and Game mode, and applies to custom image agents as well as the built-in Illustrator, including retries, characters used as the user identity, and characters left out of native image captions (#7053).
- **Button size (px)** in Chat widget style lets you resize movable chat buttons and their icons independently of Display Size. Leave it at Default to keep the existing desktop and phone sizes. The setting also covers trackers, Chat tools, Map and Character Profiles, and enlarged buttons stay within the chat area (#7092).

- Chat widget styles can also supply the font, shape and colors for chat messages, input boxes and controls through three separate switches. Conversation messages keep their own shape. On phones, sections moved out of Chat Settings are grouped in a movable three-dot menu with a lock and a saved button order; tracker buttons stay separate. The phone Map button and Character Profiles on both computers and phones are separate movable controls, with the selected widget style and saved positions and locks. Game character sheet drafts stay open with their unsaved changes when the window layout saves (#7081).

- With **Show characters in Persona pickers** on, opening a folder under **Play as a character** no longer lets a character's portrait cover the whole persona picker, in new chat setup or in **Chat Settings**. Portraits stay in their small round slots, and on phones long names in the Chat Settings persona list are shortened instead of pushing the list sideways (#7093).

- **OpenAI (ChatGPT)** connections that use your Codex login can now set how long the model thinks. Turn on **Use custom defaults for this connection** and pick a **Reasoning Effort**, or pick one in a chat's **Advanced Parameters**; the levels match the ones Codex offers for the model. **Default** keeps Codex's own level, and Codex chats keep using it until you pick a level, so the level in your preset does not change them. If a Codex connection or chat already had custom parameters, its saved Reasoning Effort now applies, so check it. When a Codex connection on **Default** falls back to a connection with no Reasoning Effort of its own, the fallback no longer uses your preset's level either. The model list now includes the GPT-6 and GPT-5.6 models Codex offers (#7083).

- A **TypeSafe** Decision connection can now send its requests to another server that runs TypeSafe's API: replace its **Base URL** with that server's address, and **Test** uses it too. The connection still needs your TypeSafe API key, which is sent to that server, and the address follows the same rules as the Base URL on any other connection. As with a **Custom System One endpoint**, a server elsewhere on your local network needs `PROVIDER_LOCAL_URLS_ENABLED`, which is on by default on Android (#7084, #7134).

- Restoring a settings profile with **Long-Term Memory** while the Long-Term Memory package is active now waits for memory reads or rebuilds in progress, then reloads the restored memory instead of continuing to serve the pre-restore copy. If the installed package is too old to coordinate this, Marinara refuses the restore with a message to update or disable it rather than publishing memory the package cannot see (#7043).

- Long-Term Memory recall now reads only the actual conversation history. Preset prompts, agent injections and other non-history text no longer fill the package's recent-message window. Normal generation prompts and other agents' inputs remain unchanged (#7044).

- In the Card Browser, the **Pygmalion** **Auth Token** box now hides what you paste and turns away values with spaces or line breaks. Marinara checks the token with Pygmalion before keeping it, and a failed login says whether Pygmalion couldn't be reached, rejected the token or was busy. If Pygmalion stops accepting the token while you browse, you're asked to log in again instead of seeing a search error. Pygmalion requests and avatars now go only to Pygmalion's servers, and error messages and logs no longer include your token (#7074).

- On phones, the small **World State** and **Player & Tracker** controls now use your chat widget style and open from movable buttons. **Echo Chamber** follows the same styling, with a movable, resizable window on computers and its compact view on phones. Detached tracker lists keep their bottom border in Default, Dottore and Mari styles, including custom gradients. Opening a sidebar keeps movable chat buttons inside the remaining chat area without stacking them on top of one another; closing it restores their saved positions. The large Tracker Panel keeps its existing layout. Fixed the staging regression check that still expected the removed minus button (#7075).

- CharacterTavern can't be browsed in the **Card Browser** for now because its rebuilt website no longer offers the connection Marinara used. Selecting it shows a short notice explaining this instead of a failed search, with buttons to open character-tavern.com and import a card file. Cards downloaded from CharacterTavern can still be imported as files, and the CharacterTavern login has been removed. Switching sites while a search is still loading no longer shows the previous site's cards or card count (#7072).

- Conversation groups in **Individual** mode no longer go silent for the rest of the day after a burst of autonomous messages. The group shares one daily check-in limit, but as soon as you went quiet, every character could check in one after another and use up the day's limit within minutes, often right after midnight or after starting Marinara. Now, once a character checks in, the next check-in waits longer, as in a one-on-one chat, and the characters who have waited long enough take turns instead of the chattiest one sending them all. After a long absence, a conversation sends one check-in instead of a burst, including while Marinara is closed in your browser. **Character Exchanges** now also work when schedules are off. In **Individual** mode, exchanges and @mention replies between characters never use the day's last check-in, so a later check-in still can. While Marinara is closed in your browser, autonomous messages take turns across all your conversations instead of only the two most recently active ones, and a conversation is no longer marked unread when nothing was sent (#7055).

- Chat tools now live in **Chat Settings**, which opens from a movable sliders button inside the chat. The Chat Settings button starts at the top right; saved positions stay where you put them. Each chat remembers where you put its buttons and windows (#7034, #7036).
  - Window title bars use a single **Close (X)** control. Removed the redundant minus button, which performed the same action. Newly popped-out sections start unpinned, so clicking elsewhere returns them to their buttons; you can pin them to keep them open.
  - **Chat Branches**, **Chat Summary**, **Active Context**, **Author's Notes**, **Agent activity**, **Gallery** and **Search messages** have their own sections. Search starts collapsed unless you previously expanded it, with a help tip explaining how to find chat history, bookmarks and removed messages. **Bookmarks** and **Trash** are beside Search.
  - On a computer, move and resize Chat Settings or pop a section out into its own window. Pin a window to keep it open, or lock it to prevent accidental moves of both the window and its button. Pinned windows reopen after a page refresh unless you closed or minimized them. Closing a popped-out section shrinks it to a button; **Put back** returns it to its original window.
  - On phones, Chat Settings and the other chat windows open as full-width panels. Popped-out sections and chat controls have movable buttons, and panels fit above the keyboard while you type. In Help, tap Chat Settings for an explanation of its controls and icons.
  - Game controls, connected chats and package controls open from movable buttons too, and can be put in Chat Settings. In Roleplay, the die in the Chat Settings title bar controls the **Tracker Panel**. When the panel is not shown, trackers appear in a **Trackers** window on computers and as compact widgets on phones. When there is not enough room beside the messages, Trackers starts as a button; saved layouts keep your chosen arrangement.
  - Existing chats keep their old tools as movable buttons, with trackers grouped in **Trackers**. When you upgrade, that familiar setup is also starred for new chats in each mode. This happens once and preserves any favorite you have already saved or cleared. Windows first open below their buttons; a window you have already placed keeps its saved position.
  - **Help** is beside the Chat Settings title. **Reset View** restores the starting positions of buttons, windows and sections after confirmation, and settings profiles can save your layout for reuse. The **star** beside Reset View saves your arrangement and hidden tips for new chats of the same mode; a profile with its own saved layout takes priority.
  - Desktop Chat Settings includes tips for arranging windows and sections. Their **X** hides them for this chat; new chats show them unless a favorite layout or settings profile saved them as hidden. Dismissing the separate reminder beside the Chat Settings button keeps it hidden across chats and page refreshes.
  - **Advanced Parameters** keeps showing the connection's current values when popped out. Rearranging windows no longer moves a chat to the top of the chat list. Windows and buttons stay within reach when sidebars, the keyboard or display size change, and closing windows keeps keyboard focus in the chat.
  - A short video introduces the customizable chat layout the first time you enter a chat after updating, on computers and phones. **Got it** keeps it dismissed across chats and page refreshes.
  - Custom themes can style windows, drawers and buttons with the shared classes and variables listed in the theming guide.
  - In **Settings > Appearance > App**, choose **Dottore** or **Mari** under **Chat widget style** for themed chat buttons, windows and sections in light or dark mode. Dottore has cyan instrument frames and his gold ornament, with inner corners that follow the cut-corner frame. Mari has rose-and-gold storybook frames, with Primogems on windows only, buttons that match the window background, and straight section edges that join into one panel. Preview icons use each preset's own colors, including with animated app accents. Decorations sit at the top, sections touch without gaps, and scrolling content stays inside the frame. Font and Shape can be changed separately. **Default** keeps the current look. Professor Mari knows the styling hooks for making custom widget themes too.
  - **Border & Buttons Color**, **Background Color** and **Text Color** let you choose solid colors or gradients for chat widgets. Reset a color to follow the preset in light or dark mode. Choosing a preset resets Font, Shape and all three colors.
  - **Agent activity** matches the Tracker Panel's text sizes, spacing and backgrounds. The panel's border follows the pulsing accent color on computers and phones.

- The Characters sidebar has its full-width **New Folder** button again. Removed **Possible duplicates**.

- The Chats sidebar status prompt now reads **What's up?** to fit its field, and Advanced Settings labels the multiplayer section **Multiplayer WIP** (#7051).

- In Roleplay **Advanced Memory**, you can now edit and save a scene summary's **Story timeframe**, or clear it when the story date is unknown (#7047).

- In Roleplay groups using **Merged (Narrator)**, characters referenced by ID macros, including through lorebooks, now join the reply's cycling avatars without being added to the group. Each swipe keeps the references used for that reply (#7045).

- Home widgets: the **Daily Encounter** message for an empty library and its **Open character library** link now fit inside the widget on desktop and phones (only the very largest text sizes can still cut off the link), Professor Mari's head is no longer cut off in **Your guide** (she can now reach over the widget's top edge instead), and hovering a widget no longer makes its glow and edges pop in after the card lifts (#7032).

- In **Chat Summary**, each message range now gets its own row across the window, and its number fields show message numbers up to five digits (four on the narrowest phones). A range that needs fixing keeps the same quiet border as the rest of the window, with a warning note under it instead of a flashing accent outline, and a range that can't be summarized no longer counts toward the messages selected. Range mode no longer opens on a range left over from a longer chat, which showed "This range is outside the chat history." right away; it starts on this chat's latest messages instead. Picking Range, or clicking into a range field, before a long chat finishes loading no longer leaves the range on that chat's first messages (#7029).

- Expanded text editors, including message command results and preset variable values, now use the same background as the sidebars in dark and light mode (#7037).

- Chats, Characters, Personas, Lorebooks, Presets, Connections, Agents, Settings and the Tracker Panel now each have a **?** at the top. Hover over it, or tap it on mobile, to read what that sidebar is for and what you can do there (#7002).

- Professor Mari can now turn **Send without wrapper** on or off for an existing prompt block, instead of failing or reporting success while leaving it unchanged. Asked to do this for a marker, which always keeps its wrapper, she reports that it cannot be done (#7014).

- On phones, **Chat Summary** keeps the summary or prompt you are typing in visible above the keyboard, including sideways. A tap while the keyboard is open no longer lands on a different setting (#6993).

- **Auto-Translate Responses** works in Game mode again. Translations of Game turns with character dialogue or game tags no longer stay hidden, including ones already made, and the translator no longer sees Marinara's internal dialogue tags. A runaway Game reply with long stretches of blank space no longer stalls the Game screen or the server (#7010).

- On phones, editing a Roleplay message now starts below the buttons at the top of the chat, and while you edit, the strip around those buttons no longer blocks taps on the text beneath it, so words along the top edge can be selected again. In Conversation mode, opening the keyboard while editing a message now keeps its first line below the bar at the top of the chat, and text that scrolls under that bar can be pressed and selected too, except right under its buttons. On iPad, opening the keyboard while editing a long Roleplay message now brings its first line back below the buttons at the top instead of under them. On iPhone, a long message being edited now fits above the keyboard together with its Save button, so scrolling inside it reaches the last lines (#6992).

- Mobile screen edges and the keyboard surround match the topbar, including when switching between dark and light mode (#7017).

- Sidebar headers, item action trays, and settings use a consistent background. Mobile screen edges follow the app surface, and Refresh App uses the shared settings button style (#7011).

- Preset prompt blocks now have a **Send without wrapper** switch. Turn it on to send one block exactly as written, without its XML tag or Markdown heading, while the rest of the preset keeps its wrap format. A group the block belongs to can still wrap it. Markers always keep their wrapper (#7006).
- UI/UX improvements: welcome-dialog frames and settings actions follow the selected accent, Game actions keep their Marinara pink, and dark sidebars match the Home menu. Tracker edit controls align with their fields on desktop; on mobile, tap a field to edit it, with a small hint beside settings instead of pencil icons (#7000).
- A damaged server file no longer keeps Marinara from starting until you reinstall. If a built server file changes after the build, the launcher names it and rebuilds the server before starting. Updating through the Windows installer or the in-app updater repairs it too. The Windows installer can also update an existing install again, instead of stopping with "Repository update did not land on the expected commit" (#6984).
- The Character Editor has a new **Voice** section where you pick the voice Text to Speech uses for that character and hear it with **Preview**. It changes the same setting as **Connections → Text to Speech**, so the two always match, and the **Phonetic name** field now lives there too. Two cards with the same name, such as an AU version, can now each keep their own voice instead of one card's voice being used for both. Until a copy gets its own voice, its **Voice** section names the voice it still uses from the other card. Picking a voice there changes only that character's voice, and its **Use a voice per character** button changes only that choice. Every other Text to Speech setting stays as it is, even one just changed in another tab or on another device (#6997, #7008).
- Professor Mari can no longer create, edit, move or delete Marinara's built app files (the `dist` folders the app runs from), so she can no longer leave a broken file there by mistake. She can still read them, and changes the source instead. A very long shell command from her also no longer freezes Marinara for minutes (#7003).

- Retrying or re-running agents now runs rewrite agents one after another, each on the text the one before left, as after a new reply. Before, retrying two of them together, such as Prose Guardian and a custom **Text Rewrite** agent, kept only the last one's edits. Agent retries now also keep to the connection's **Max Parallel Agent Jobs** limit (#6977).

- The agent editor has a new **Share requests with other agents** switch under **Connection Override**. Turn it off to send that agent in its own request instead of together with other agents, which helps local models that mix up their tasks. This also works for Prose Guardian, Continuity Checker and Immersive HTML, which otherwise rewrite the reply together. It is on by default, and agents that always run on their own show it as off (#6977).

- Updated the multipart upload parser to fix two denial-of-service vulnerabilities triggered by malformed upload headers or oversized boundaries (#6995).

- `decision_choice:` statements now get answers from System One servers that need a description for every option, such as Strands decider. Before, those servers refused the whole request, so every Choice comparison read as no. Open-Jev's answers stayed the same in testing. The Decision Models guide now explains how to run Strands decider yourself as a Decision connection (#6981).

- Reinstalling the local model's runtime, or installing a new llama.cpp runtime, no longer deletes an installed decision model such as Open-Jev 2B along with the old runtime (#6982).

- Advanced Memory, the OpenRouter connection editor and the Decision diagnostics now say **Decision model** instead of "Jev", which is only one of the models a Decision connection can use (#6983).

- In group chats, replying to a character's message now makes that character answer, the same as mentioning them with @. Before, the reply did not count when choosing who speaks next, and since a character rarely speaks twice in a row, replying to the message they just sent almost always got an answer from someone else (#6978).

- Professor Mari, and other background calls on slow local models, no longer give up when the first token takes more than two minutes. They now wait as long as the **Text generation** request timeout allows (Settings, or `CHAT_GENERATION_TIMEOUT_MS`; 5 minutes by default) (#6970).
- With streaming on, a reply no longer starts with the raw `<tool_call>…</tool_call>` text when the model writes its tool calls as text, as some KoboldCPP or Gemma setups do. Once Marinara recognises and runs the call, that text disappears from the message on screen and is not saved, the same as with streaming off (#6951).

- `{{<character ID>}}` macros now become the character's name in Conversation and Game chats, and in Roleplay chats without a preset, instead of staying as raw text. In these chats the macro gives only the name; the referenced card is not added to the prompt (#6956).

- Switching a Roleplay group between **Merged (Narrator)** and **Individual** now changes the whole prompt at once. Continuing a reply in Merged mode no longer makes the model speak as that reply's character, a message sent right after switching waits for the new mode to be saved, and Chat Settings always shows the mode replies actually use (#6959).

- **Image Captioning** in Chat Settings now shows its prompt in a box under the toggle, so you can change how images are described (for example, ask for more detail) or reset it to the default. If captioning fails, the reply now stops with an error instead of quietly sending the image to the chat model (#6960).

- GLM models on NanoGPT, such as GLM 4.7 and 5.1, now stop reasoning when Reasoning Effort is **Off**, whether the chat sets Off itself or takes it from the connection's Default Chat Parameters. Before, they kept reasoning anyway and could spend the whole reply budget on it, ending with a message to raise Max Tokens (#6961).

- In the Android app, picking a picture now offers the camera too, on Android 10 and newer, as Chrome does. Photos you take are saved to Pictures/Marinara (#6953).

- On iPad, tapping a chat in the chat list now opens it instead of leaving the list on top, and buttons that start a chat or open a page from a full-screen panel close that panel too. The keyboard no longer covers a message you are editing, and **Copy Support Diagnostics** now copies (#6944).

- Removing a chat variable in Chat Settings now asks first, so one stray tap on a phone no longer deletes it. Cancel, or tap outside the question, and the variable stays (#6942).

- Chat variables that `{{setvar}}`, `{{decvar}}` and the other variable macros change now go back with the reply that changed them, as tracker values do. A new swipe starts from the values before that reply, showing another swipe brings back its values, and deleting the reply undoes its changes, so a lorebook countdown no longer drops again on every swipe. Values you typed in Chat Settings since stay as they are (#6923).

- Agents and Download Agents now show Noodle, Slurp, Gacha Forge, Life Sim and other apps that open in their own Home tab in a separate **Apps** group at the top, instead of mixing them into Misc Agents (#6943).
- The character and persona editors now show the whole name at the top whenever there is room for it, instead of cutting it short next to the creator and version (#6946).

- A decision block can now stay on for as long as something lasts: `{{#if decision:"A fight starts" until:"The fight ends"}}` stays on after a yes and asks the until statement each turn instead, turning off when it is true. `while:"..."` turns off when its statement is false. With sticky, add `:and` to stop at whichever ends first or `:or` for whichever ends last, and cooldown starts once the block turns off (#6922).
- The new `{{include::Entry name}}` macro puts in the text of a lorebook entry, so shared text can live in one entry and be reused in other entries, presets and cards. Inside an entry it looks in that entry's lorebook, and elsewhere in the chat's lorebooks. `{{include::Lorebook name::Entry name}}` reads from any lorebook, even one the chat does not use. IDs work too, and an include that loops back to itself becomes empty (#6912).
- A character ID macro now turns into the character's name even when that character is already in the chat, instead of staying as raw `{{ID}}` text. Their card is still sent only once (#6924).

- Image Generation connections have a new **ChatGPT (Codex login)** service that makes images with your ChatGPT plan, using the `codex login` session on the computer running Marinara, so no API key or API credits are needed. Selfies, illustrations, avatars, sprites, reference images and the gallery work with it like with any other image service. Based on prisoner310's prototype (#6884).

- In Roleplay, a `roll_dice` added under **Function Calling** now reaches the model and actually rolls when called, the same as with the **Rolls** command. If **Rolls** is also on, its **Who can roll dice** choice still applies (#6945).

- Many tooltips and help texts in Chat Settings, Settings, lorebooks, connections, and the agent editor now use plain words, so it is easier to tell what each setting does (#6947).

- On phones, the top bar now looks like a small version of the desktop one: Home and Chats sit at the left and a hamburger menu sits at the right, with wider, finger-sized buttons, instead of every control stretching across the bar.

- Updated Sharp (with libvips 8.18.7), DOMPurify, @fastify/static, dotenv and nanoid, and Android APK builds now use Gradle 9.8.0. Termux installs keep Sharp's matching WebAssembly fallback for image processing. Hono, which the MCP SDK pulls in, moves to 4.13.11 for an upstream XSS fix in its JSX renderer.
- In Roleplay, a `[whisper: character="name" text="..."]` command typed while editing a character's or the narrator's message now becomes a whisper when you save, as it already did in your own messages. Whisper text can span several lines and quote dialogue as is, like `text=""I love you.""`, and the command description now says so (#6918).
- Select a word or short phrase in a chat message to get an **Add to lorebook** button, on desktop and mobile. Pick a lorebook and it opens on a new entry named after the selection, with the selection as its keyword, ready for you to write the content (#6899).
- Game Mode rulesets can have markets (Capability API 1.65): price levels on an item's cost, place sizes such as a hamlet or a city, what each place sells, and kinds of seller who may sell only to some buyers. The Game Master says where the party is, buys with `[inventory: action="buy"]` at a price the Engine works out, and is shown what the place sells; services such as a bed for the night are paid for and never carried. Gravewatch's example has a market (#6917).
- World Maps can now hold up to 5,000 locations instead of 500, enough for a whole world with its buildings, floors and rooms. Game Mode also accepts these larger maps when a game starts (Marinara-Agents#1132).
- Two ruleset regression lanes no longer fail now and then: the classic-items lane's directed battle could end on the dice before the test's second item was used, and the loot lane counted the hand axes the party already carried as loot when the table dropped another (#6913).
- Echo Chamber and other agents now see who said what in group chats: turns in individual group mode are labeled with the speaker's name, and merged replies keep their speaker tags. Reactions no longer credit one character's line to another (#6906).
- On mobile, Echo Chamber stays scrolled to its newest reaction after you finish typing or editing, instead of showing an empty box until you scroll back up (#6906).

- A message's **Private note** (under **Bookmark, pin or note**) can be shown to one Roleplay character with **Show the note to the narrator character**. That character receives it next to the message, and nobody else does. Notes stay private by default (#6895).

- The Roleplay **Whisper** command description now shows the format for whispering to another character (#6895).

- Charged and gated ruleset items now work in Classic and Tactical battles too: a wand or Gravewatch's dawn bell is offered while it has a use left and spends its charges (and may break on its last), a scroll or the page of the vigil litany rolls its check with the user's sheet first and is spent for nothing when it fails, and an item that has to be worn or bound is used only while it is, the worn one used up rather than a spare in the bag (#6909).

- In a Game Mode game whose ruleset leaves fights to Classic and Tactical battles, the ruleset's items now do what the ruleset says in a fight: a poultice heals by its own dice and a firepot burns, with the conditions they put on, instead of whatever a model guessed. An item the ruleset gives no use is not offered, and a ruleset that turns Game Mode's own items off still offers its own usable items (#6905).

- A Game Mode ruleset's money is now real: its coins are items in each character's bag, weigh what the ruleset says, and a line above the inventory shows what they are worth. The Game Master charges and pays the party with `[inventory: action="pay"]` and `action="earn"`, and a payment makes change within the coin's family, or is refused when the purse is short. Loot tables can drop coins, and a ruleset's layer can take a coin out of a variant, pricing items in the coins left. Rulesets that drop coins or take them out with a layer need Capability API 1.64 (#6901).

- A Game Mode ruleset with loot tables no longer loses its layers on the game screen, where the long night of Gravewatch was silently dropped from the sheet and picker while the Game Master still played by it (#6901).

- A won fight in Game Mode now drops loot straight into the party's bags, as the combat guide always said it did: Game Mode's own treasure without a ruleset, and a ruleset's own items where it declares loot tables and says what its creatures carry. The Game Master is told what dropped, and can roll a ruleset's table in the story with `[loot:]`. Rulesets that use loot tables need Capability API 1.63 (#6894, #6758).

- A Game Mode ruleset's items can now ask a check before they work, as a 5e scroll of a spell above the reader's level does: the Engine rolls it when the item is used, in a fight or from the Use button, skips it when the user's sheet is high enough, and a failed check uses the item up for nothing. Rulesets that use this need Capability API 1.62 (#6892).

- A Game Mode ruleset's items can now get their charges back on a rest: a wand or a bell refills when its holder takes the rest the ruleset names, from the sheet's Rest button or the Game Master's rest, and an item can break when its last charge is spent, as a 5e wand crumbles on a 1. The Game Master sees how many charges each item has left. Rulesets that use these need Capability API 1.61 (#6888).

- A Game Mode ruleset's items can now be used outside a fight: the inventory's Use button on a poultice or a potion heals whoever carries it with the Engine's dice, takes it out of the bag and tells the Game Master what happened, and the Game Master can use items the same way. An item can also give back a pool, such as a tonic that restores Resolve, in a fight or out of one. Rulesets that restore a pool need Capability API 1.60 (#6881).

- Updated brace-expansion, fast-uri, and ip-address dependencies with upstream denial-of-service and address-validation security fixes.
- Termux rebuilds now include the multiplayer guest assets required by startup checks, and dependency updates retain Sharp's matching WebAssembly fallback for Android image processing (#6883, #6859).
- Merged Roleplay groups update expressions for the active, selected cast during replies and manual retries, instead of only the first character (#6872).
- Roleplay's Gallery and `/illustrate` can generate one illustration with the installed Illustrator without enabling automatic agents or changing chat settings (#6874).
- Agent contributor guidance now explicitly prioritizes simple solutions, avoiding over-engineering, and reusing existing code.
- A Game Mode ruleset's items can now be used in a fight: a healing poultice or a potion is on the fight menu under Items, pressed on its holder or a friend, and used up; a bell or wand can hold charges that each use spends, and what is left stays on the item for the next fight. What a fight uses is saved to the inventory as it happens, the item's details say what using it does, and a party member the Engine plays uses a heal on whoever is hurt. Rulesets that use the new keys need Capability API 1.59 (#6880).

- A Game Mode ruleset's weapons can now be used more than one way: a bow can loose a two-arrow volley at two targets, a gun can fire a burst, and the fight menu asks which way with what each is expected to do. A character with a light weapon in each hand gets a second strike with the other on the ruleset's off-hand budget, a weapon can promise a least harm on every hit, and one driven in hard enough can leave a condition on its target. Rulesets that use the new keys need Capability API 1.58 (#6875).

- Roleplay group chats let you edit revealed whispers and keep the corrected text for later turns. Users can also write private whisper and notes commands in ordinary Roleplay messages. The narrator no longer receives notes from disabled or removed characters. In Individual mode with Smart or Manual response order, the response menu now starts with an accent-colored Smart option that asks the existing model or enabled Decision model to pick the next speaker without changing your saved response order.

- A Game Mode ruleset's weapons can now use up what they shoot: a bow is offered in a ruleset fight only while its archer carries arrows, each shot takes one out of the bag, and half of them can be picked up after a won fight. A pistol keeps a loaded count between fights and has to be reloaded from the fight menu. What a fight shoots and loads is saved to the inventory as it happens. Rulesets that use the new keys need Capability API 1.57 (#6871).

- Anthropic and Claude (Subscription) connections can select **Claude Sonnet 5.5** (`claude-sonnet-5-5`), with a 1M-token context window, 128K output and reasoning effort from low to max. Turning reasoning Off skips up-front thinking on Anthropic connections. On Claude (Subscription), OpenRouter and other compatible gateways, which cannot express that setting, it runs at low effort instead. Forced tool calls use automatic tool choice, and samplers are not sent (#6869).
- A Game Mode ruleset's items now count in a fight too: a ring of protection, boots that slow nobody, a cloak that makes attacks against its wearer harder, or a ring of fire resistance applies while worn or carried, and armor too heavy for its wearer can cost them speed. Ruleset fights now add the sheet's own roll modifiers (`resolution.adjust`) the way checks do, and where initiative is spent as damage, a blow below the hardness of armor or a creature's stat block still lands but does no damage. Rulesets that use the new item keys or hardness need Capability API 1.56 (#6857).

- OpenAI connections can select **GPT-6.1 Sol** (`gpt-6.1-sol`). It has a 1.05M-token context window and 128K output, and reasoning effort from low to max. Reasoning cannot be turned off for this model: Off is sent as low, and temperature and top-p are never sent (#6867).

- The Reasoning Effort and Verbosity controls are back for GPT-6 models on OpenAI connections. Sampling controls now only appear when the model would actually use them (#6867).

- Hosted image and video provider detection matches the actual URL hostname, so lookalike hosted-provider domains cannot select the wrong API. Local-tool detection still recognizes SwarmUI and ComfyUI URL markers. Game sheet command hints reject malformed pool identifiers, and tactical terrain writes reject non-integer coordinates.

- In Advanced Parameters, a long "Effective" line under a parameter stays on one line with an ellipsis (the full text shows on hover) instead of wrapping and pushing that input below its neighbour (#6863).

- Optional private multiplayer rooms support Conversation, Roleplay and shared Game rounds without a fixed human or AI roster cap, with reviewed personas, host-approved AI characters, invitations, admission, host-controlled generation and text-only guest views. Multiplayer requires an explicit environment flag, Settings activation and Host/Join; the Android native wrapper cannot join rooms (#6790). Disabled multiplayer stays idle through unrelated workspace refreshes, and successful Host/Join actions remain usable if a status refresh fails. Opening a missing chat clears its active selection instead of leaving the loading view open.

- A Game Mode ruleset's items can now be weapons: a sword, spear or bow the character holds is offered in a ruleset fight with its own to-hit, damage, reach and range, a spear deals more with a hand free, and one put away offers nothing. A weapon the Game Master invents fights like the ruleset's weapon it is most like. A creature can resist a kind of harm except from certain weapons, such as a grave wight that only silver gets through. Rulesets that use these need Capability API 1.55 (#6855).

- A Game Mode ruleset's items can now ask something of whoever wears them, such as a grave spade that needs Sinew 3 and costs a die on Dig until then, and can set or raise an ability while worn or carried, such as gauntlets that make Brawn at least 2. The sheet, checks, the Game Master and fights all read the changed ability. A condition level can also follow a value worked out from the sheet, so carrying too much can slow a character without anyone ticking a track. An item's details say what it asks and what it changes, and the Game Master can give invented items an ability bonus. Rulesets that use these need Capability API 1.54 (#6846).

- Review cards for edits to Professor Mari's own card, saved before she was stopped from making them, now clear on the next start instead of staying in every Mari chat; they could never be restored (#6842).

- Professor Mari's review cards belong to the chat she made the change in: a new chat starts clean, and deleting a chat keeps its changes and removes its cards. She can no longer edit her own built-in card, which Marinara resets on every start, an edit that changes nothing makes no card, a refused Restore explains that Keep dismisses the card, and a failed Keep or Restore says why (#6842).

- Lorebook editors can copy linked characters and personas to another lorebook without repeating each selection (#6840).
- Default muted text uses neutral colors, message marks follow chat chroma, and chat Help explains bookmarks, context pins, and private notes (#6839).
- Lorebook vectorization uses batches of ten entries to reduce timeouts with local embedding providers (#6837).

- Updated Undici, fast-uri, and ip-address dependencies to pick up upstream network and URL-handling security fixes.

- In a Game Mode game with a ruleset, a check or save outside a fight now counts the character's conditions and what they wear or carry: a poisoned or frightened character rolls with the disadvantage the ruleset gives them, a paralyzed one fails the saves it fails without a roll, and an item can say what it does while worn or only carried, such as a creaking coat that makes Sneak harder. Advantage and disadvantage cancel out with the Game Master's own, the dice card and the saved record say what changed the check, and an item's details say what it does. The Game Master can give invented items these effects, held to what each rarity allows. Rulesets that use them need Capability API 1.53 (#6832).

- In a Game Mode game whose ruleset rolls something other than one d20 (such as 2d6 or a dice pool), a check the Engine rolls during a turn is no longer rolled a second time as if nobody's sheet were read. The saved result keeps the sheet's numbers, who rolled, and any wound penalty or modifier the ruleset applied.

- A Game Mode ruleset's sheet can now read the items a character holds, with a new `itemStat` value: a stat over what they wear, what they only carry, or both, added up, the highest, the lowest or counted, optionally only one slot, category or tag. The sheet on screen, checks, the Game Master's sheet summary and the start of a fight all read it. In the Ember Roads example, a worn leather coat now adds to Guard. Rulesets that use it need Capability API 1.52 (#6826).

- A Game Mode ruleset with `native: false` now keeps new untyped items out of its games: the Game Master can still add more of, remove or give an item already held, but anything new it hands out must be one of the ruleset's items or one it invents, and it is told so. Fights no longer guess what items do or offer them, until the ruleset can say what they do. The player's typed-in items and what a party carries into a new session are unchanged (#6822).

- Regenerating a reply no longer shows the previous swipe's translation under the new text while it streams, and the new swipe does not inherit it. Swiping back shows that translation again.

- Guided regeneration keeps your direction in the chat box, so you can adjust it and regenerate once more; turn off **Keep guidance after regenerating** in Settings → General → Input & Editing to clear it instead. Sending a message still clears the box (#7060).

- In Conversation chats, a message sent right after typing no longer comes back in the chat box when you return to the chat or reload (#7060).

- In a Game Mode game with a ruleset, the Game Master can invent items in the ruleset's own words, such as a named blade: the Engine keeps only the categories, rarities, tags, stats and slots the ruleset has, holds each bonus to what its rarity allows (the new `rarityCaps`), and says what it changed, in its answer and in the item's details. The game keeps the item, and a ruleset can forbid invention with `propose: false`. Rulesets using either key need Capability API 1.51 (#6814).

- Lorebook references retain affordable images without displacing text, including recursively activated text, and image-only entries count their image budget once.
- Duplicating a lorebook entry waits for reference-image uploads and removals, and reimporting an embedded lorebook preserves its character links. Valid reference images also upload when the browser cannot identify their file type.
- Failed reference-image uploads keep the original error if cleaning up the unused image also fails.
- Portable lorebook and character exports share a 64 MiB reference-image limit per request. Split larger selections into smaller exports or use a native profile ZIP.

- Lorebook entries can attach PNG, JPEG, and WebP reference images with optional captions through a collapsed Reference images button. Activated entries send their images to compatible chat models; models that reject image input receive the text and captions with a notice. A shortcut adds `wardrobe` as an ordinary activation keyword (#6798).
- Message marks stay consistent during swipe changes and inactive-swipe edits, preserving the context-pin limit and each swipe's own data.

- Enabling or disabling selected lorebooks includes books hidden by filters, and Undo changes only the books updated by that action.

- A Game Mode ruleset's items can be worn, bound and carried. An item that takes slots has an **Equipped** button and uses its bearer's free slots; one that binds is bound up to the limit on its bearer's sheet, and a cursed one stays bound. When the ruleset says what everything weighs, each bag shows its load, an item added from **All** or by the Game Master without naming anyone goes to whoever can carry it, and nothing is given past anyone's limit. The Game Master can equip and bind items too, and sees each character's load, slots and bound items (#6801).

- Restore all preserves conflicts reported by completed batches when a later batch fails, even if no messages were restored.

- Restore all supports more than 5,000 trashed messages in one operation, reports messages already recovered if a later batch fails, and keeps remaining entries available for retry.

- Restoring several trashed messages reports an error when every write fails, while keeping failed entries available for retry and preserving successful partial restores.

- Deleting a turn with saved Game state stays permanent after changing chat modes or importing it. Mixed selections recover only ordinary messages, and recovery counts reflect that.

- Message marks remain visible in roleplay, private-note menus fit short mobile screens and close when their note is removed, and recovery reports partial restores accurately. Restoring several messages still updates chat memory when one entry fails; Game Mode rejects message-only recovery. Pin hints clarify the model token limit.

- Per-character conversation-start edits complete without hanging, including edits that also pin a message or change its visibility.

- Message recovery preserves edits that finish just before deletion, and changing a message's history-start setting no longer stalls. Bookmark menus focus their first action when opened for keyboard access.

- Expired message recovery records are cleaned up at server startup and hourly, including unopened chats. Recovery ends at 30 days; newer records are preserved, and shutdown waits for active cleanup.

- Message recovery notifications reflect whether the server actually retained deleted messages. Restoring pinned messages refuses to exceed the pin limit and keeps the recovery records intact.

- Bookmark messages, attach private notes, and pin up to ten messages for prompt context. An optional message trash setting keeps supported deleted messages for 30 days for recovery; it is off by default, and Game Mode deletion remains permanent. Private notes stay out of model prompts and are excluded from exports unless explicitly selected. Launcher downgrade protection also preserves recoverable message records (#6698).

- Bulk character tag edits continue after a rejected request and keep only failed cards selected for retry.
- Regression commands invoked through an absolute or symlink path now execute instead of silently skipping their checks.

- The terminal-shutdown regression now has enough total runner time for its six bounded server boots, without relaxing its per-case shutdown assertions or other regression limits.

- Shutdown regression checks allow time for repeated server startups on slower CI workers while keeping individual shutdown deadlines unchanged.

- Bulk character tag edits keep failed cards selected so you can retry them without selecting successful cards again.

- Bulk character tag edits include selected cards hidden by library search or pagination. Failed saves report the affected cards, preserve their tags and version history, and allow the remaining selection to finish.

- Duplicate-character comparisons return after closing the character editor on phones and desktops, and dismiss when navigating away from Characters.

- The character library can compare possible duplicate cards without deleting them and preview adding or removing tags across selected cards (#6698).

- Lorebook Markdown and CSV downloads preserve spaces and non-English characters in their filenames.

- The native shutdown regression allows cold CI servers time to start while keeping its interrupt and shutdown deadlines unchanged.

- Failed lorebook text imports leave existing entries and folders unchanged, and duplicate-key checks distinguish case-sensitive and regex matching modes.
- Windows shutdown validation reads redirected output as one string, avoiding false readiness failures while the server is writing its startup log.

- Lorebook activation statistics update after a reply is saved successfully and exclude Continue chunks.

- Lorebooks gain lint checks, a scanner preview, opt-in activation statistics, bulk entry edits, selected enable/disable actions, and Markdown/CSV import and export. Chat previews explain their context limits, and text imports enforce bounded size and entry counts (#6698).
- Lorebook Markdown export handles long whitespace runs without excessive processing time.
- Lorebook CSV exports keep spreadsheet formulas inactive and mark their escaping format so imports restore the original text without altering apostrophes in independently authored CSV files.
- Escape closes a panel from actions inside an expanded folder header, while active fields and menus keep their own Escape behavior.

- Decorative missing-avatar icons stay hidden from screen readers; named character fallbacks retain their accessible labels.

- Panels opened from the navigation bar support keyboard focus and return focus when closed. Cancelling a folder rename or leaving the activity field with Escape keeps its panel open. Profile imports are keyboard-accessible, missing library avatars have a visible fallback, and the chat sidebar shows clearer loading and retry states (#6698).

- Generation settings show controls supported by the selected provider and model, reducing settings that would be ignored. Preset editing keeps its full set of reusable controls (#6698).

- Printed HTML chat exports show included reasoning once, even if its Thinking section is collapsed on screen.

- The native restart regression gives replacement servers time to rebuild routes on slower CI runners while retaining its process-ownership and shutdown checks.

- Search across chats with phrase and filter support, inspect chat statistics and activity, and export readable Markdown or HTML transcripts. Internal and hidden-from-user content stays excluded from these views. Clearing search removes earlier matches, activity totals pick up edits even after a chat leaves memory, ambiguous timezone parameters are rejected, and Game exports label narration consistently. HTML stories embed each avatar once to keep long exports compact (#6698).

- Professor Mari discards pending package-action discovery when a package is disabled, removed or replaced, so an older activation cannot start a new action.

- Professor Mari can use actions that installed Agent packages offer her. Ask Mari which actions your packages offer, or ask her to do one, and she runs it through the new `package_service` tool. Only packages with the new `mari-actions` permission can offer actions, the package checks every input, and Plan and Manual Permissions Modes apply to each run. Package authors need Capability API 1.50 (#6799).

- A Game Mode ruleset's own items go in the inventory. **From the ruleset** picks them from the ruleset's item catalogs, with its search and filters, and a name the player or the Game Master writes that is one of them adds that item. The selected item shows its category, rarity, tags, stats and description, a stack holds only as many as the ruleset allows before a new one starts, a ruleset can take only its own items from the player, and the Game Master sees what each one is (#6795).

- Game Mode items keep who they are when renamed. Renaming a stack now gives it a nickname, shown with the item's own name beside it: it stays the same item, never merges into another one, and the Game Master can name it either way. The inventory's **Add** takes the item's name first, and adding an item a bag already has tops up its stack. The detailed inventory follows items instead of names, so an entry keeps its description through renames and gifts (#6791).

- OpenAI-compatible text-to-speech can request PCM output and play it as WAV without changing the audio samples. Custom providers must supply the sample rate and channel count; malformed or incomplete PCM is rejected instead of playing distorted audio (#6709).

- Define per-chat variables in **Chat Settings → Chat Variables**. Set `char1` to `Mary` and use `{{char1}}` in a message: the AI reads Mary while the message keeps the tag. Changes apply to earlier turns too. Values survive restarts, include variables set by prompts, and respect preset-variable precedence. Your edits take priority over pending generation writes.

- Phone navigation keeps Home and Chats visible, moves secondary panels into a keyboard-accessible More menu, and improves touch targets and stacked-dialog focus (#6698).

- Roleplay chats can tune recent summaries, older semantic matches, and minimum relevance per chat using the existing summary retrieval controls (#6705).

- Memory recall rebuilds now batch embedding requests for long chats and preserve the previous native index when a rebuild fails or is canceled (#6708).

- Everyone in a Game Mode party carries their own things. The inventory opens on **All**, which shows who carries each stack, with a tab per party member; **Give** hands some or all of a stack to someone else, and dragging a stack onto a tab gives them all of it. The Game Master can say who gains, loses or hands over an item, and its inventory changes are now made by the server when the reply is saved, so they apply even when nobody is reading and a refused one is reported back to it. Every change saves the stacks, the detailed inventory and the journal together, including items a fight uses. Regenerating a reply, or swiping to another version of it, no longer adds its inventory changes on top of the version it replaces, and deleting a version or branching the chat keeps each version's inventory with it (#6772, #6774).

- Character and persona gallery image downloads preserve the iPhone/iPad Home Screen app, using native sharing when available and keeping previews dismissible when saving is cancelled or fails (#6784).

- Character-sheet generation can optionally use the character's saved neutral full-body sprite as a reference, on its own or together with the current avatar.

- Persona sheet generation can use a saved neutral full-body sprite as a reference, alone or alongside the current avatar (#6786).

- Game Mode rulesets can describe items. An `items` block declares the categories, rarities, tags, stats, slots, binding limit, carrying and currency families a ruleset's items are written in, and a catalog of items lists each one with its stats, slots, stack size, cost and binding. Everything is checked at import, both example rulesets carry items, and the author guide explains every key (#6765).

- Decision diagnostics shows Advanced Memory's latest Jev recall and scene-end decisions, including scores, selections and fallback outcomes, without making extra model calls (#6768).

- Advanced Memory swipes respect the shared "All" history cutoff even when its message is hidden from the responding character, without applying later cutoffs to earlier replies (#6766).
- The browser test for attacks made in an initiative style no longer fails when the fight's random dice let the Grave-rat swarm down Ada before her first turn: the test's swarm throws no initiative dice, so Ada always acts first (#6763).

- Game Mode's inventory changes a stack by any amount: type a count, or +N to add and -N to take, instead of clicking once per item. A stack can be split into a size you choose (300 apples split by 100 leaves 200 and 100), and dropping a stack onto another of the same item merges them. Split stacks carry over to the next session, and the Game Master and fights still count every stack of an item together (#6759).

- Fixed a production startup regression that left Docker and installed web apps on a blank screen before React could load (#6760).

- Regex packs can be selected, exported, and deleted in bulk, with one confirmation and failed deletions retained for retry (#6755).
- Generation Settings can disable automatic character/persona gallery entries while keeping illustrations and selfies in chat. NovelAI image inspectors now include character captions alongside the scene prompt (#6752, #6748).
- Conversation's Tools tray always offers **Translate draft**, including on mobile with the optional composer shortcut and automatic translation turned off (#6751).
- Roleplay supports `/illustrate range=N` and `/illustrate range=N-M` for earlier messages, including before an Advanced Memory boundary, without branching or deleting history. Concurrent range lookups cannot start duplicate illustrations (#6722).

- Client builds no longer depend on whether the checkout folder contains `react`. The restart regression allows cold CI servers more time for their first boot while keeping the normal restart deadline (#6732, #6743).
- Game Mode rulesets whose fights throw pools can keep initiative as a number that attacks move. It opens as a thrown pool plus a number, one way of attacking takes it from the target instead of hurting them, another spends it as the damage dice and resets it on a hit or loses what the ruleset sets on a miss, and whoever falls to the ruleset's crash line crashes, cannot spend until they recover, and may carry a condition of the ruleset's own. The order follows the numbers every round, the menu asks which way to attack before whom, and the log says every change. Capability API 1.48 (#6740).

- Claude Subscription now bundles a Claude Code runtime compatible with Opus 5.5, avoiding the older-runtime rejection even when a newer global Claude Code installation is present (#6693, #6711).
- Roleplay Advanced Memory can optionally use a selected Decision connection, including Jev, to detect scene endings and choose recalled scenes and excerpts. Summaries still use the summary helper, and the existing recall remains the fallback. Advanced Memory no longer carries an Alpha label (#6749).

- Advanced Memory lets you save a requested review without changing correct text, regenerate an individually deleted scene, and see background preparation failures in a toast (#6737).

- Game Mode rulesets whose checks throw a pool of dice and count successes can fight the same way: an attack throws a pool and needs a number of successes, the successes past those add damage dice, and the damage is thrown and then soaked by the kind of harm before it marks a wound track. Wound penalties and conditions add or take away dice, and saves and contests are pools too. Rulesets of either kind can also throw initiative again every round and cap how much of a resource one turn may spend. Gravewatch, the example pool ruleset, now has fights, weapons and a small bestiary (#6736).

- A creature a ruleset fight takes from its bestiary keeps its own reaction and anything it does to itself, so a monster's Parry is asked for when a blow hits it instead of turning up as an ordinary action on its turn aimed at an enemy (#6731).

- The expression sprite and Roleplay whisper browser regressions wait for the page's own requests to finish before each reload, avoiding false WebKit access-control failures in release checks (#6677).

- Game Mode rulesets that resolve their own fights can answer an attack after it hits and before its damage: a Shield or a parry raises defense and the same roll is checked again, so the hit can become a miss, and an answer can halve that one attack's harm. Creatures can have reactions of their own, including ones that land on themselves, and opponents the Engine plays raise a guard only when it turns the hit aside. Capability API 1.46 (#6728).

- Game Mode rulesets that resolve their own fights can have conditions change numbers: raise or lower defense, add or take away a flat number or dice on attack rolls, saves and contest checks, or change speed by a number, halve it or double it. Conditions can make contests harder or easier, end at the start of their holder's turn or after one attack or save, and a track such as exhaustion can make things worse level by level. A condition that ends as a turn begins no longer shortens that turn's walk. Capability API 1.45 (#6719).

- A Decision connection can use a chat model on a server you already run, such as Ollama, LM Studio or llama.cpp, so the model is not loaded a second time just for decisions. Choose the new **OpenAI-compatible chat model** source, or click **Use this model for decisions** on a Custom connection. A Test against a server that does not offer the chosen source's endpoint now says so instead of reporting it as unreachable (#6714).
- The installed decision sidecar no longer shows a Thinking setting it does not have, which snapped back to Auto when changed. It is warmed up while it starts, so Test and the first turn show its normal speed instead of a one-time two-second delay, and Open-Jev 2B gets more time for a turn with many decision statements, which on a long chat used to run out and read every statement as no (#6716, #6717, #6718).
- Decision time limits now apply to each statement, never to a whole group. A local model answers every statement of a turn instead of dropping the ones that waited for a free slot, a Decision connection's Time limit is given to each statement a request asks, and the decision sidecar no longer cuts a large turn off at 20 seconds (#6721).

- Game Mode rulesets that resolve their own fights can write a counter: an ability that answers an opponent using something, whoever it was aimed at, and may call it off before it happens. An answer can be limited to abilities from certain catalogs, such as spells, and on a battlefield it reaches only as far as its own range. Capability API 1.44 (#6712).

- Game Mode rulesets that resolve their own fights can declare contests: grab, shove over or back, and break free, where both sides roll and add their own number and the winner holds, knocks down or pushes the loser. The menu shows the chance to win, and opponents the Engine plays use them now and then. Capability API 1.43 (#6707).

- Game Mode rulesets can give a sheet live states such as a form or a stance, one value out of a list that the Game Master or the player changes in play and a rest may put back, and derive numbers from a state or an enum field, so a stance can add dice to one ability's rolls. Capability API 1.42 (#6656).

- Positioned ruleset fights no longer freeze when a wall stands between two fighters: whoever the Engine plays walks the way round instead of waiting for a straight path that never opens (#6678).

- Game Mode rulesets can group abilities, skills and saves into sections, shown under their headings on the sheet and to the Game Master, and say what a check does untrained, by skill or by section: cost dice or points, roll one step harder, or not be attempted at all. A one-request branch check now rolls for the party member it names. Capability API 1.41 (#6655).

- Local models can use an existing GGUF file without downloading another copy, select f16/q8_0/q4_0 KV caches, and show GPU buffer allocations reported by llama.cpp after loading (#6675).
- Lorebook semantic search can optionally consider character replies as a separate query, preserving specific user cues and keeping user-only retrieval as the default (#6670).

- RunPod Serverless exposes the shared ComfyUI generation settings, including prompt prefixes, sampling, reference placeholders, and LoRAs, and applies them to submitted workflows (#6699).
- Game translations keep dialogue aligned when translators alter internal speaker tags, and preserve notes or books embedded in narration (#6687).

- Added Gemini 3.8 Flash, 3.7 Flash, 3.5 Flash-Lite and 3.1 Flash-Lite Image to the Google model list, so they arrive with their own context window and output limit instead of being treated as unknown models whose reasoning effort and output cap cannot be sent. Corrected the context and output limits of the existing Gemini image models to the ones Google documents (#6683).

- Advanced Memory finds old scenes from distinctive details even with excerpts disabled, without extra recall model calls. Characters can share access to a scene when only some messages are hidden from them; scene recaps keep shared events plain and use character conditions for private sections. Constant Chat Summaries retain their character conditions (#6679).

- Game Mode wound tracks can be numbered boxes as many as a character's rating, with a penalty table over boxes filled or remaining, take marks on the box a hit names, refuse a mark when full (a fight counts a hit no box can take as taking the character out), heal one kind of harm from a rest or a command, and gain levels from a list on the sheet. Capability API 1.40 (#6654).

- Automatic agent runs with NanoGPT Kimi K3 no longer send an unsupported request to disable reasoning (#6658).
- Manual Illustrator requests honor the configured output-token limit instead of silently capping it at 1,800 tokens (#6659).
- Development pull requests use a small Chromium smoke suite instead of the full browser matrix. Full desktop Chromium, mobile Chromium, and mobile WebKit coverage runs nightly, on demand, and before promotion to `main`; contributors run focused regressions locally before pushing (#6661).

- Game Mode rulesets can work out values from a character's live resources and tracks as they stand, add up a column of a list (such as the weight of packed gear), cap a skill or save at any sheet value, and hide sheet items when a field is not a value or is one of several. Capability API 1.39 (#6653).

- Any agent package's Home widget can open one item in its own Home tab through `onOpenPost`. Before, only Noodle could jump to an item; other agents could only open their tab.

- Decision debug output shows scores and thresholds, and Peek Prompt can test decision statements against the selected model, including local reasoning models normally deferred before a reply, without generating a reply or changing the chat's decision state (#6650).
- The **Noodle** and **Slurp** Lorebook Generation filters, and the Noodle and Slurp Remastered chat and character settings, no longer disappear after a package update that waits for a restart. The Noodle filter also shows for Slurp Legacy, which sends the Noodle trigger.
- Quartermaster and Relationship Tracker appear under the Download Agents Roleplay filter. Their guides cover staging downloads, restart and per-chat activation, key controls, and planned availability with the next main release (#6724).

- **Copy Support Diagnostics** now wraps the report in a ``` code block, so it reads cleanly when pasted into Discord or GitHub (#6668).

- A NanoGPT connection can show its subscription usage. An optional **Management Token** field accepts a NanoGPT token with the _Usage only_ scope, so quota readings never need your inference key, and a **Show subscription usage** toggle displays the weekly and daily input-token quotas beside the connection, in the chat connection picker, and in the chat's **Connection** settings while you play. A lookup that NanoGPT cannot answer reads as unknown instead of as unused quota, and the model list marks subscription-included models — including a green `1x` at the normal rate — and the ones charged at a higher input-token multiplier.

- Generation now reports when a prompt that does not fit spends the reply budget instead of dropping messages. A reply budget cut to its 128-token floor is logged as a warning, so a configured Max Tokens that never reaches the provider is visible instead of silent (#6614).

- Game Mode pool rulesets can name standing re-throws the Game Master asks for on a check (`reroll="id"`), and a spend can buy a re-throw. A spend's limit can come from the character sheet or from the check's own dice, a ruleset can declare up to four spends, and any ruleset can add numbers from the sheet to the checks they apply to, shown on the dice card. Capability API 1.38 (#6652).

- Game Mode rulesets can pick a difficulty by name (`difficulty="Hard"`) instead of a number, and a pool ruleset's ladder step now sets the per-die target it prints. A pool ruleset can let a check lower the face dice roll again or count twice on, let an ability check add a second ability, and count a fumble as low faces on half the dice or more, which on a successful check shows as a complication alongside the result. Capability API 1.37 (#6651).

- Game Mode rulesets can give a track a maximum the character sheet sets, hide a track by a field or always show it to the Game Master, print chosen columns beside a summary list's names (`Gear: Crowbar 1d6`) and name its rows with an enum column. When a ruleset has a wound track, the Game Master is taught the command that marks it without the ruleset having to explain it (#6657).

- Lorebook entry Generation filters add **Slurp**, so entries can target Slurp Remastered posts, and the Noodle and Slurp filters now show only while their package is installed. Existing filter choices stay saved when a package is removed (#6660).

- The Roleplay whisper browser regression finishes preparing visual-novel fixtures before reloading, avoiding false WebKit access-control failures in contributor checks (#6628).

- Lorebook and Chat Summary review windows start with focus on the review explanation, so continuing to type cannot accidentally discard a proposal with Space or Enter (#6638).

- Game translations use edited narration, dialogue, and readable text, preserve segment alignment, and discard translation requests invalidated by a later edit or deletion (#6615).

- Agents, including Illustrator, receive complete character card lore and persona descriptions instead of silently losing details beyond the old field limits (#6620).

- User Input prompt regexes in Roleplay’s Individual group chats also apply to other characters' messages, while each character's own replies keep AI Output rules and character-specific exclusions stay in effect (#6637).

- Roleplay Advanced Memory scans and indexes globally hidden history, including turns hidden manually or by automatic summaries, preserving scene summaries and participant access during initial and later processing. If recovery changes a manually corrected scene's boundaries, disable its old correction to keep the text for reference, or delete it, then prepare history again (#6631).

- Professor Mari can author Decision activation and conditional prompts with live model awareness, lean timing guidance, and separate preferences for use and cache-sensitive placement. Setup warnings are remembered per chat, and an enabled Memory can stop them across future chats. New invalid agent activation settings are rejected instead of silently disabling the question; legacy settings remain editable and undoable without blocking unrelated changes (#6629).

- Imports that use decisions now warn when no Decision model is selected, explain the fallback behavior, and link to the Decision Models guide. If the selection cannot be checked, the notice says so without interrupting the import. The notice also covers custom agent imports and Agent catalog installations, including agents with activation questions (#6605).

- Decision model guides now distinguish Jev from Open-Jev and clarify what each feature sends, threshold defaults, statement allowances, answer reuse, lorebook fallbacks, sidecar hardware needs, and prompt-cache costs. Author examples describe observable events and separate connection testing from testing statements in a chat.

- Add bounded agent-owned Home widget presentation metadata and full-bleed package widget surfaces.

- Agents can offer up to three Home widgets without placing them automatically. The Widget Manager groups built-in, agent, and personal widgets; users add, hide, restore, and reorder agent widgets, while custom agents can publish bounded text during their normal runs. Capability packages can supply verified interactive widgets in an Engine-owned frame. Noodle's Latest Posts widget is available through its companion agent package (#6621).
- Contributors can use an optional **Dev MCP** (`tools/dev-mcp`), a small MCP server that lets a coding agent read a local engine's prompts, cache statistics and logs, run typechecks and regressions, and restart the engine safely. It is not part of the app build or the Docker image; see `tools/dev-mcp/README.md`.

- Roleplay's optional **Whisper** command shares an inline secret only with its recipient and the appointed narrator. Recipients can be characters or your persona; revealing a hidden secret on screen does not give it to other characters' prompts (#6616).

- Roleplay's Expression Engine has an optional **Only show active sprites** toggle. It keeps the current sprites visible while expressions generate, then shows only enabled characters returned by the completed result (#6611).

- A Game Mode ruleset's bestiary creature can now be written in the ruleset's own terms: give it a `sheet` shaped exactly like a character's, as partial as you like, and a fight builds it the way it builds a party member. Its health, defense, saves, initiative, speed and the attacks and abilities on its lists come from the ruleset's own formulas, so a ruleset whose opponents use different abilities, skills or lists no longer has to squeeze them into a fixed set of numbers. Such a creature pays for its abilities out of its own pools and can pay out of a bigger one, whether the Engine or the Game Master decides for it. On a ruleset whose health is a wound track, a blow marks its boxes after its resistances and immunities have had their say. It is still an opponent: out at zero, never rolling against death, and never saved over a character who shares its name. Each number is given in one place only, so a creature with a sheet does not also list its health or defense. A creature the Game Master invents can be written on the ruleset's sheet too, so an invented mage has spell slots and spells named straight from the ruleset's catalogs. Unless it is a boss, it only gets what its ruleset opens to it (a Sorcerer's spells, not the whole list), and the spells it was not given are filled in by its temperament and competence without another request to the model: a protective caster leans to spells that hold up its side, a skilled one to counters and reactions. A boss is written in full by the Game Master. Either is still held to its threat tier, with its health, defense, to-hit, save difficulties and best round (the biggest slot it can afford included) pulled onto the tier's scale. Both example rulesets ship one, and ruleset packages that include one need Capability API 1.34. A refusal because the fight is waiting on somebody else's answer, or because that moment has already passed, now says so instead of a generic message (#6610).

- Manual Gallery and `/illustrate` requests preserve the selected custom Illustrator prompt, including perspective and layout instructions alongside or after a response schema. Requests too large for the connection's context limit report an error instead of silently cutting instructions (#6597).
- Character-browser imports and PNG downloads no longer crash when browser translation replaces their button labels before the loading icon changes (#6598).

- Update local embeddings and Whisper to Transformers.js 4 with matching ONNX runtimes and retain the native installer's private temporary directories. Upgrade Intiface integration to Buttplug 5 while preserving existing haptic intensity values, including zero, full vibration strength, and directional outputs. Reject incompatible feature ranges before starting output, and stop the device if only some features accept a command (#6603, #6604).

- Update static file serving with the latest security fix, refresh TypeScript and formatting tools, and update Android and CI build dependencies. CodeQL initialization and analysis now advance together so security checks continue to run (#6601).
- New **Settings > Advanced > Features** section for optional server behaviours. Every switch is off by default, so nothing changes until you turn one on. **Stable lorebook picks** and **Retry failed provider calls** can now be turned on there as well as with `LOREBOOK_STABLE_GROUP_WINNERS` and `PROVIDER_RETRY_TRANSIENT_ERRORS`, which still win when set. See docs/configuration/features.md.

- Decision statements take two more modifiers: `every:3` asks a statement only every 3 turns (reading as no between checks, without taking a statement slot), and `priority:high` or `priority:low` decides which statements are asked first and dropped first when a turn has more than **Decision statements per turn** allows (#6599).

- Decision statements that cannot affect a turn no longer use up **Decision statements per turn**. Only statements in enabled preset sections, selected preset variable options, lorebook entries that activate, and blocks not already ruled out are asked. Peek Prompt lists any statements the limit leaves out, and the preset guides now warn preset makers to be careful with decision blocks near the top of a preset, where a changing answer makes caching providers bill the whole prompt again (#6582).

- A decision block inside a preset variable option now works. It was planned under the wrong key, so it read as no on every turn (#6582).

- Decision statements can keep their answer for a few turns: `{{#if decision:"..." sticky:3 cooldown:5}}` stays yes for 3 turns after a yes, then reads as no for 5, without being asked or taking a statement slot meanwhile. Regenerations and swipes do not count as turns (#6582).

- RPG pool names can be cleared and typed with spaces without resetting to HP or MP while editing (#6566).
- Chat and game dialogs stay open when a drag ends on their backdrop, and overlapping pointers cannot combine into an accidental dismissal (#6576, #6577).
- Browser notifications use the app's service worker when available and alert again for each completed reply in the same chat (#6571).
- Browser checks wait for the settings search to finish focusing its result and capture the visible Advanced Memory inspector without scrolling its full container (#6578, #6579).
- In Individual group chats, characters can hand the next reply to another available character with an @mention. Conversation and Roleplay reuse the current turn queue, with one reply per character to prevent loops; swipes and continuations do not start handoffs (#6567).
- Server robustness, all opt-in and off by default (see the Robustness table in docs/CONFIGURATION.md): `PROVIDER_RETRY_TRANSIENT_ERRORS` retries a refused connection or a gateway 502/503 up to twice before any output reached the user (never on the primary of a connection with a fallback), `STORAGE_SKIP_UNCHANGED_WRITES` skips rewriting unchanged storage files, `STORAGE_YIELDING_SERIALIZE` keeps large chat saves from pausing other requests, `STORAGE_CACHE_WINDOWS_BOOT_ID` makes Windows starts about 1.5 to 2 s faster, and `SHUTDOWN_WINDOWS_CONSOLE_SIGNALS`, `SHUTDOWN_FORCE_EXIT_ON_REPEAT`, `SHUTDOWN_EARLY_FLUSH` and `SHUTDOWN_RUNTIME_STOP_BUDGET_MS` tune how the server stops. Always on, with no behaviour change: Windows identity probes run hidden instead of flashing a console window, shutdown logs which runtime stop failed or was slow, and a privileged `GET /api/admin/runtime-diagnostics` reports storage residency and whether each capability package runtime is live.
- Capability packages no longer fail with "Root plugin has already booted" (which could also stop the server) when a background task calls an internal route while startup is still registering routes: such calls now wait until registration has ended. A package whose activate() or selfCheck() calls an internal route during startup gets an error at once instead of hanging startup, and a package that fails only because the server started too early is no longer rolled back or marked as errored; it is retried on the next start.

- Roleplay Personal Notes and command instructions survive Advanced Memory context cutoffs, including when regenerating a reply (#6583).

- Each Decision connection has a **Time limit** (0.5 to 30 seconds, 1.5 by default). A hosted provider that is sometimes slower than 1.5 seconds made decisions look randomly broken, with no way to allow for it. **Test** now waits longer and shows how long the answer took next to the limit, and says when an answer would arrive too late during chats (#6580).

- Lorebook entries can be activated by your Decision model. In an entry's new **Decision** field, **Require** makes the entry activate only when a statement about the recent chat is also true (so passing mentions stay out), and **Trigger** lets the statement activate the entry without its keywords. Statements are asked only when the entry could otherwise activate, answered once per turn, and read as no without a Decision model. Imports and exports keep the setting (#6570).

- The Decision Models guide now says exactly what a decision model reads: only the statement and the recent chat messages. It never sees the preset, character cards, persona description, lorebook entries or anything inserted **@ Depth**, and decision statements read the last 5 messages.

- The full browser regression matrix uses more shards (ten for desktop Chromium and mobile WebKit, eight for mobile Chromium, instead of four each), bringing its expected runtime from about 30 minutes to under 20 and keeping it clear of the 30-minute job limit (#6573).
- Server logs are easier to follow: every line a request causes carries its `requestId` (also returned as the `x-request-id` header), startup steps are timed with one ready summary, a failure is logged once with its cause chain, user stops are logged at info, repeating failures are rate limited, and model or provider text stays at debug. See docs/development/logging.md.
- The regression runner gives every file its own temporary DATA_DIR, FILE_STORAGE_DIR and empty .env, so a regression can no longer read or lock the data folder named by a developer's .env.
- Two opt-in lorebook settings, both off by default (see the Lorebooks table in docs/CONFIGURATION.md): `LOREBOOK_STABLE_GROUP_WINNERS` keeps the same inclusion-group winner in a chat while its candidates stay the same, so the prompt prefix stays cacheable, and `LOREBOOK_COMPACT_STORED_SCANS` keeps the full text of activated lorebook entries only on the newest reply of a chat, which makes chats with large lorebooks much smaller. `scripts/compact-lorebook-scans.mjs` applies the same rule to older chats (dry run by default).

- Agent history lookups no longer compare every loaded agent run with every loaded message, preventing long server stalls as more chats are opened (#6562).

- Conditional prompts can ask your Decision model about the scene: `{{#if decision:"..."}}` for yes or no, and `{{#if decision_choice:"..." == "option"}}` to pick one option. They work in presets, cards, lorebooks and agent prompts, are answered once per turn (post-processing agents once per reply), and read as no when there is no Decision model or no answer. A new **Decision statements per turn** setting limits how many are asked, fields that use them warn when no Decision model is set, and imports that contain them say so (#6569).

- A new **Decision Models** guide explains what a decision model is, the three ways to get one (a local model you already run, a hosted Decision connection, or the installable Open-Jev), which to pick, including on Termux, and everywhere Marinara uses it. The agent guide now covers decision statements in an agent's prompt, and the package guide has notes for agent and Game Mode Experience authors.

- Open-Jev 9B can be installed as a decision model alongside 2B. It was more accurate in our tests, but it needs about 22 GB of GPU memory and takes about a second per question, so its request budget grows with the number of questions.

- Installing a decision model after a dropped connection or a sleep keeps the files that already finished, checked against their published sizes and checksums, instead of downloading everything again.

- Development servers, scripts and regression specs no longer stay open after finishing when they log while the log worker is still starting; this intermittently failed the image-dimension regression. The regression summary also names every file that did not pass (#6529).

- Smart response order in group chats can ask your Decision model who should speak, one yes/no question per character, instead of making a full AI call each turn. Turn it on under **Decision model** in the Connections panel. It is off by default. If the decision model does not answer, Smart order makes its usual AI call (#6559).

- Advanced Recall cutoff summaries report activity in the Agents menu and preserve each character POV without duplicating summary conditions (#6557).

- Message voice controls share a compact audio menu. Clear cached voice removes only that message’s audio and regenerates it on the next playback, without discarding other chats’ saved voice lines (#6514).

- Roleplay dice outcomes follow the selected accent. Message usage and Peek Prompt distinguish tool-turn totals from the last request's input size, so repeated tool requests are not mistaken for an oversized context (#6550).
- Advanced Memory also checks actual provider-reported input after the main reply, resetting to the latest known scene and reusing its recap in Chat Summaries when the input limit is exceeded. Cached input counts; output tokens and cumulative tool-turn usage do not (#6550).
- Advanced Memory summary prompts request character-name conditions for separate POV knowledge. Recall resolves those conditions for the responding character; raw excerpts are omitted when they could expose a hidden section, while the narrator retains the full recap (#6550).

- GPT-6 Sol and Luna are selectable in OpenAI connections with their documented limits, reasoning controls, and compatible streaming and tool requests (#6546).

- Claude Opus 5.5 is selectable in Claude connections with its 1M context and 128k output limits, supported reasoning settings, and compatible tool requests (#6544).

- Scene setup lets you choose its persona and Conversation characters. Characters in an active Scene pause automatic messages in the source Conversation until the Scene ends (#6542, #6541).
- Roleplay tracker widgets tolerate saved blank rows, and Custom Tracker updates discard nameless entries after applying field locks instead of making a chat unusable (#6549).

- Marinara can now download and run a purpose-built decision model for activation questions. It runs as its own local process, so it answers them whether or not you also run a local chat model. It is off by default and behind a warning, a confirmation carrying your machine's verdict, and a separate size-and-license step, because it costs about 10 GB of disk and 5 GB of GPU memory. If you already run a local chat model, that model is more accurate on roleplay questions; the decision model is faster and slightly smaller. You can also paste a decision model's repository, which is installed only when its own manifest declares a runtime this build ships.

- On a machine with several NVIDIA GPUs, the decision model installer has a GPU menu for the card it runs on. Where the machine cannot run a decision model at all, the installer offers to set up a Decision connection instead.

- The decision model preflight checks GPU compute capability, not just whether an NVIDIA card is present. Pascal cards and older cannot run the runtime whatever memory they have, and without this check the download would have been offered and then failed at load.

- Activation question thresholds now start from whatever the selected decision model actually answers around, instead of always 0.5. Probabilities are not comparable between models: a general local model answers a clear scene change at 0.99 while a purpose-built decision model answers the same turn at 0.2, so one fixed number made the second kind skip every relevant turn while appearing to work. The editor seeds new questions from the selected model and offers to put its recommended value back.

- Choosing a decision model that turns out to be unusable now leaves your current choice alone. A rejected selection reported the error but also silently switched the Decision model to None, which stopped every activation question until it was noticed.

- Activation questions can be answered by the local model you already run, on either the main or the utility slot, with no download and nothing leaving your machine. Pick it under **Decision model**, which now lists local models alongside Decision connections and shows why an unavailable entry cannot be used. A **Thinking** setting handles models that always reason first; those gate post-processing agents by default so replies do not wait.

- Support diagnostics report the server's own GPU and each local model slot: what is configured, whether it is running, and the estimated memory it needs, with a combined verdict. The existing GPU line is the browser's, which said nothing about the machine running the local model.

- Advanced Memory completes partially covered scene ranges when preparing a missing scene, preserves older manual character corrections through reindexing, and keeps original access data in exports. Scene participants can be returned by name as well as ID; only actual participants receive access (#6537).

- Advanced Memory keeps one memory per scene, assigns access to actual participants, and treats unassigned scenes as narrator-only; an explicit all-participants result grants the current chat characters access. Existing automatic assignments stay narrator-only until reviewed; preparation checks participants while keeping saved summaries (#6533).
- Custom agents can use optional activation questions with a Decision connection to skip irrelevant turns. Question and keyword controls share one activation card with consistent labels and styling. Keyword and cadence settings still apply; failed decisions leave agents eligible to run. Decision connections support TypeSafe, OpenRouter, and user-run System One endpoints, including linked OpenRouter credentials (#6530).

- Game helpers preserve unconfigured task defaults and explain when saved output limits cut off structured responses (#6511).

- Game Mode honors connection and chat generation parameters instead of replacing them with fixed sampling and output settings (#6511).
- Grok 4.6 and 4.7 keep enabled tools, including web search, instead of losing them as unrecognized models, with their supported context and reasoning settings (#6521).
- Sidebar sorting applies to folder rows as well as their contents, including names, dates, and content-based sorts; manual folder ordering remains available (#6497).

- A Game Mode party member you hand to the Engine to play can now pay a ruleset's ability out of a higher pool than it names: a spell cast out of a bigger slot, with whatever the ruleset says the extra buys. Only you could do that before, so a character played by the Engine never cast a spell that grows any bigger, on a turn or in a reaction alike. Each way of paying is weighed on its own and priced with the rungs it climbs, so the bigger version is not mistaken for a free one. Opponents built from a plain stat block are unchanged: it has no pools to pay out of (#6528).

- A Game Mode ruleset's catalog entry can now say WHICH moment it waits for, so a spell or a trick written as a reaction finally has somewhere to be taken. Two moments: before something lands on its holder, where taking it may stop that thing from happening at all, and after something has hurt them, where it is pointed back at whoever did it. What the stopped action cost is still spent, because it was paid for before anybody was asked, and an entry pointed at whoever caused the moment fills the target in rather than asking you to pick. An entry that only says it is a reaction, without naming a moment, stays off every menu exactly as before. Ruleset packages that name a moment need Capability API 1.33. The fight still keeps one window rather than a stack, so a counter cannot itself be countered, and a reaction cannot change a number on what it answers, only stop it or answer it. A combatant the Engine plays now weighs letting a moment go by against spending on it, the way it weighs ending a turn, so having a reaction to spend no longer means always spending it; that includes a strike at somebody walking away. A friend aiming something at you, like a heal, opens no window at all.

- Character, persona, and lorebook folder contents follow the selected sidebar sort order (#6497).
- The extra-actions menu sits to the left of Emoji, farther from Send, while keeping existing Post Only and Guided Generation actions (#6507).
- Conversation scene invitations stay beside the proposing reply; open setup when ready, including after cancelling or reloading (#6496).
- PWA manifest requests include credentials so Android Chrome can read the manifest behind Basic Auth (#6492).

- Advanced Memory scene recaps request 2–3 paragraphs with room for reasoning, and constant-summary consolidation no longer fails on tiny proportional token targets (#6512).
- Advanced Recall scene checks appear in agent call activity, including shared post-processing tracker calls. Reindexing preserves progress toward the next scene check (#6512).
- Advanced Memory constants use message-range titles, reject unfinished helper output, and deactivate the originals when a completed compacted replacement is saved. Ranged constants that overlap live context stay out of that prompt and its archived-summary compaction budget (#6512).
- Advanced Memory's context threshold applies to the outgoing prompt without subtracting reply tokens. Automatic scene resets apply to all characters and can be undone with the existing All flag; temporary open-scene trimming no longer creates persistent character-specific flags (#6512).
- New Start flag changes save together with Advanced Memory cutoffs, keeping the previous state intact if a save fails (#6512).

- Advanced Memory identifies corrections needing review and exposes unfinished scene summaries for targeted recovery without resetting the archive (#6526).
- Advanced Memory keeps saved scene indexes across source-text edits, swipes, illustrations and live context flags. Recalled excerpts use current message text, while character-access checks remain enforced (#6526).

- Advanced Memory reindexing rebuilds saved text vectors without rerunning scene detection or summarization. Saved scene corrections no longer depend on outdated generated-summary inputs, and stale scene corrections can be reviewed and saved without changing their text (#6509).

- Removed the obsolete root suggestion-chips implementation brief, `MARI_SUGGESTION_CHIPS_TASK.md` (#6504).

- Consolidated root coding-agent guidance in `AGENTS.md` and updated contributor and reviewer references after removing the duplicate `CLAUDE.md` (#6504).

- Advanced Memory resets live context to the latest detected scene when its context limit is reached, then keeps that cutoff while new messages accumulate until the next reset. Existing ranged summaries are reused after generation (#6503).

- Advanced Memory preserves earlier confirmed memories across personal POV start flags and lets you correct a saved scene's character access without reprocessing the chat (#6503).

- Advanced Memory shows post-generation scene checks in the Agents menu and checks the configured number of recent messages at its standalone interval (#6499).
- Mobile chat images allow native pinch zoom, including app shells that honor viewport scaling limits (#6501).
- Empty Recalled Scenes markers add no extra blank lines to the prompt (#6502).

- Tapping Author's Notes again closes its panel in the mobile Roleplay toolbar (#6495).

- Author’s Notes saves stay ordered within each roleplay chat, and pending edits finish saving before generation reads them (#6817).
- Message Peek Prompt stays tied to the selected reply and swipe after images, summaries or memory settings change, preserving the character and commands actually sent to the model (#6493).
- Advanced Memory uses enabled Chat Summaries and their character conditions even when the original messages are hidden or before a character's start flag. New and compacted constants retain character conditions; recalled scenes and raw messages keep their knowledge restrictions (#6493).

- Advanced Memory keeps applicable enabled constants in the prompt and combines them after the reply when they exceed 70% of the configured summary and recall budget. Constants have priority, followed by all selected scene summaries, then excerpts; total memory may use up to 2,000 extra tokens. Existing ranged and legacy summaries reuse Chat Summaries and its Maximum output size.
- Presets offer one **Recalled Scenes** marker for paired summaries and excerpts. Existing Recalled Messages markers remain compatible aliases.
- Recalled messages and new scene summaries omit illustration attachments and their unavailable-content notices while retaining readable text attachments.
- Post-generation scene checks receive chat message numbers and identify exact scene endings. They share eligible tracker calls when available and archive completed ranges after the reply; scenes still in live context stay excluded from recall.

- Advanced Memory uses one **Recalled Scenes** prompt section, with each scene summary immediately followed by its available excerpt. Existing preset markers and saved swipe memories remain usable without another search or archive reset.
- Advanced Memory stops polling ready archives while idle, keeping unrelated character and preset requests responsive. Long-chat replies and Peek Prompt avoid repeated metadata parsing and repeated whole-scene budget scans; previews without a preset retain message IDs so history can fit the budget (#6484).
- Advanced Memory scene recall toggles and deletion stay responsive in long chats: archive checks reuse parsed message metadata, the inspector loads summaries without resending hidden excerpts, and user edits interrupt background processing safely (#6484).
- Conversation chats reuse character-owned schedules. Enabling schedules no longer starts generation, and weekly renewal requires an explicit per-character opt-in without repeated retries after failure (#6481, #6477).
- Schedule generation stops when cancelled or when its editor, manager, or chat settings closes. Invalid model output remains editable and can be applied to the draft after validation; completed days survive a later day’s failure (#6480, #6476).
- Disabled Regex and Functions keep their switches and action buttons fully visible while dimming only their descriptions (#6463).

- OpenAI-compatible image connections can fetch models from custom provider URLs without a dedicated provider integration (#6464).

- Advanced Memory no longer starts or waits for continuity generation before the main Roleplay reply. Constants reuse existing ranged Chat Summaries, add only uncovered history after the reply, and combine only summary text when the constant-only budget is exceeded. All summary calls honor Chat Summary’s Maximum output size; replaced constants become inactive in Chat Summaries (#6474).
- Every saved scene, legacy continuity and ongoing summary has a confirmed Delete summary action at the bottom of its vault editor. Original messages remain intact (#6474).
- Toggling a Chat Summary no longer locks every entry, and Activate All / Deactivate All save together in one request. Background constant updates refresh Chat Summaries automatically (#6474).
- Connection test results survive a late save refresh and stay with the selected connection, fixing intermittent missing fal.ai feedback on iPhone Safari. The mobile drag regression now measures scrolling after cancellation has settled (#6474).

- Advanced Memory reuses the original reply's saved summaries and recalled scenes across unchanged regenerated swipes, avoiding another search or continuity-model call. Changes to source history, character access, memories or the context budget are still checked before reuse (#6474).

- Advanced Memory recalls up to three relevant past scenes by default, with a configurable maximum. Each scene summary is paired with one bounded excerpt and a grouped message range; recalled context identifies the live range and last user message. Routine recall reuses the archive, bounds optional embedding latency, and stays out of agent and auxiliary generation requests (#6471).
- Advanced Memory checks scenes independently after main Roleplay replies at the configured interval, and prepares the archive only when a scene ends. Background progress appears as **Advanced Recall** in the top-left Agents menu, including when ordinary agents are disabled (#6471).

- Advanced Memory skips scene recaps that overlap live messages and uses only fully archived manual-summary ranges for continuity, avoiding duplicate story context at cutoffs (#6468).

- Advanced Memory uses its selected helper for scene recaps, separates archived scenes from the constant-summary size limit, and sends standalone summary instructions with only the eligible source material. Completed summaries and scene detection survive Resume after an update (#6461).
- Individual scene memories can be deleted from their editor after confirmation. Original chat messages are kept, and routine preparation does not recreate the deleted summary.

- The schedule editor can generate a week one day at a time using seven smaller requests, preserves the draft on failure, and stops generation when closed (#6449). It offers connection selection and persistent errors, rejects incomplete or overlapping generated days, displays full-day blocks, prevents competing edits during generation, and refreshes the week date after day regeneration (#6455).

- A Game Mode fight can now be held open for somebody who is not the one acting. Walking out of an enemy's reach stops the walk on that step and asks them whether to strike instead of striking for them, and the walk then picks up where it left off, paying for every cell it really crossed. When a turn ends, an opponent holding its own points is asked whether to buy one of its signature actions before the next turn begins, which is the only moment those are bought in. Your own party member's window is yours to answer, with the option and a Pass on the menu; everybody else's is answered by whoever plays them, and a Game Master's boss is asked through the Game Master. Nothing else moves while a window is open, one chance each per walk, and a game closed mid-walk comes back with the same people still to ask. Ruleset packages need no change and no newer Capability API: a ruleset that declares an opportunity budget gets the first, a bestiary with signature points gets the second.

- Advanced Memory resumes unfinished summaries without replaying failed compactions or reporting completed scene detection as new work (#6461).

- Advanced Memory retains earlier scenes across shared “Mark as new start” cutoffs, shows automatic cutoffs in chat, and updates them when manual flags move or are removed. Hidden messages and character knowledge limits remain respected (#6450).

- Advanced Memory can prepare the full eligible Roleplay history through **Prepare existing history**, resumes unfinished scene detection, and shares one scene summary between characters with the same history. The narrator uses the shared archive across character participation boundaries without separate scene copies. The archive avoids redundant owner copies and uses compact memory rows; new recaps omit current-situation and open-tension sections (#6450).

- When a Game Mode fight ends, the recap the Game Master reads now names anybody still carrying a condition and says those stay until the Game Master takes them off, with the command that does it. A charm or a fright does not expire because the fighting stopped, and what would end one is the spell's own terms or the fiction rather than arithmetic, so it is a ruling to make rather than something the Engine should guess. The condition a ruleset's own dying rule puts on somebody at zero is left out of that list, because healing or stabilising them is what lifts it.

- A Game Mode ruleset can now say that one weapon is a single strike a turn however many attacks its wielder has. A weapon list that buys several strikes may name a column that holds its own rows to one, which is what a crossbow needs: 5e's Loading property says you fire once when you take the Attack action whatever your count, and until now a character with Extra Attack was offered the same number of shots with a crossbow as swings with a sword. Ruleset packages that use it need Capability API 1.32, and a list that says nothing is unchanged.

- The ruleset authoring guide now says WHY a health pool cannot carry kinds of harm, rather than only that it is refused: a pool records how much damage landed, a wound track records how much and what kind each piece of it was, so a system where a wound stays bashing, lethal or aggravated after the blow needs a track. The refusal an author sees says the same thing and names the remedy.

- Downloadable packages can use the host Engine's LLM, image and video integrations, inheriting provider fixes, queues and request safeguards without bundling stale service copies. These integrations require Capability API 1.31.
- Conversation mode now has a persisted background-image opacity control while keeping its readability gradient visible.

- Combined damage types mark one wound per hit on rulesets configured for one mark per blow, using the most severe landed kind.

- Game wound sheets describe zero-penalty wounds accurately, and saved dice cards retain the applied wound penalty after reloading.

- Roleplay dice commands accept an optional situational bonus or penalty and DC, combine the adjustment with the automatic attribute bonus, and show the DC on the existing dice card (#6417).

- Game Mode catalog abilities can modify dice-pool checks with rerolls, bonus dice, successes or thresholds. Their effects and costs appear in the picker and character prompt. Free and paid abilities use the same check command, with costs applied once. Packages using these effects require Capability API 1.30 (#6411).

- Ruleset combat can use wound tracks for health, applying the ruleset's damage kinds, healing and falling rules instead of subtracting hit points (#6407).

- Refresh from ruleset offers newly added columns, including numbers and switches, for existing picked rows while preserving values already on the sheet (#6400).

- Dice-pool rulesets can let players spend resources for extra dice or successes on a check, with costs, limits and actual spending recorded by the Engine (#6405).

- Character sheets support wound tracks, ordered damage kinds, healing and persistent overflow. A ruleset can apply the current wound penalty to its checks; these features require Capability API 1.30 (#6407).
- Atlas Cloud browser checks verify persisted model options directly, avoiding a race with the temporary save confirmation.

- Atlas Cloud video connections show a **Model options** section under **Video Defaults** with every input the selected model has beyond clip length, aspect ratio, and resolution, such as negative prompt, seed, audio, shot type, prompt expansion, and LoRA lists. Each option shows Atlas Cloud's description and default, stays unsent until changed, and is saved per model. Switching models hides the old controls until the selected schema loads; ordinary field names such as `prototype` are preserved and object inputs are validated. The section also lists the clip lengths and resolutions the model accepts and warns when a text-to-video model cannot use the gallery image (#6408).
- **Fetch Models** on an Atlas Cloud image or video connection loads Atlas Cloud's current catalog instead of a fixed starter list. Video models list image-to-video first and show their starting price per second; the starter list remains the fallback when the catalog cannot be reached (#6408).
- Atlas Cloud scene videos fit each request to the selected model's published input schema: the source illustration goes to the image field the model declares, resolution and aspect ratio become a `size` where the model requires one, clip length snaps to a length the model offers, and fields the model does not declare are left out. **Test Video** supplies a plain first frame to image-to-video models, and the server log reports when a text-to-video model cannot use the source illustration (#6408).
- Roleplay World tracker temperature and weather controls sit beside the date/time controls, with space reserved for their values on mobile and desktop (#6424).
- Roleplay dice instructions keep optional DCs and situational modifiers inside the command or tool arguments instead of announcing them in narration (#6425).

- The Inventory Tracker browser regression waits for its editing modes and disables the toolbar opening animation, avoiding missed clicks on clipped controls in CI (#6421).

- Downloaded packages using the bundled Claude Agent SDK can resolve the host's installed native CLI helper, including pnpm and container installs; managed links refresh after SDK updates (#6403).

- Automatic output translation finishes and saves on the server even after the page closes, including rewritten replies, individual swipes, and replies saved before a later processing error; completion alerts wait for the saved result while the next send remains available. Returning to a chat refreshes older cached translations even when its cached settings are stale, and older Game narration can still translate after unrelated server work finishes. Malformed Game command tags no longer cause repeated scans while preparing narration for translation (#6412).

- Desktop chat, character, and persona drags allow normal mouse-wheel scrolling while holding an item, retain chat assignment and folder drops, and cancel with Escape. The browser regression uses the same mouse flow without hanging in native drag mode (#6413, #6399).

- Game Mode ruleset combat supports multi-strike turns, several damage types per hit, action-granting abilities, automatic damage riders and additional condition effects. Catalog previews explain these mechanics before selection. Packages using the new keys require Capability API 1.29; see the [ruleset authoring guide](docs/extending/writing-rulesets.md).
- The Roleplay swipe media regression follows the continuation behavior shipped in #6396, so the node regression lane passes again on `staging`.

- Roleplay `/continue` and `/cont` display their streamed text inside the original reply, preserving its existing content and newline preference; an empty send still creates a separate reply (#6394).
- Narrator dice commands can target the active persona by name, including character cards used as personas, and apply that identity's assigned RPG attribute modifier (#6395).

- Conversation and Roleplay chats keep the latest message in view while their opening layout finishes loading, on desktop and mobile; scrolling through older history still takes precedence (#6392).
- A Game Mode fight on a ruleset that says what one square of a battlefield is worth is now played on that battlefield, on screen. The board is the same one Tactical battles use, with the same terrain, and everything on it is said in the ruleset's own distance rather than in squares: "Movement 8 paces", "Can be walked to for 15 ft", "Juno moves to 4, 6 for 6 paces and has 2 paces left". Choosing Move lights up every square your character can reach with what it costs, draws the way there as you hover or focus one, and marks in amber any square whose path someone would strike at, naming them under the board. Choosing an attack or an ability lights up who it may be pointed at and lets you click them on the board as well as in the list, and an attack that reaches nobody says "Nobody is in reach. Move closer." instead of offering a swing at nothing. Something that lands as a burst, a cone or a line is aimed at a square, and the square under your pointer says who it would catch, friends included. Movement can be spent before and after an action, so the menu comes back with what is left. The whole board is reachable from the keyboard: arrow keys move between squares, Enter takes the square, Escape leaves a half-made choice, and every square says what it is, who is on it and what it would cost. Your Combat Preference now decides how such a fight is shown: Classic plays it without positions and Tactical plays it on the board. A ruleset that says nothing about distance, a game set to Classic, and Marinara's own Tactical and Classic battles are all unchanged.

- Touch dragging in chats and resource libraries lets a second finger scroll the list while the first keeps holding the item; lifting the scrolling finger no longer drops or assigns it (#6390).

- Inventory Tracker preserves saved items when a model response is incomplete or contains malformed rows, including batched agent calls. Failed updates use the existing retry path instead of repairing missing inventory into deletions (#6387).

- Inline code in documentation follows the reader's theme so paths and settings remain readable in light mode (#6371).
- Scene summaries explicitly use a narrator's point of view and attribute thoughts and feelings to the participant they belong to (#6379).
- Conversation Presence keeps the activity editor open when a mobile keyboard resizes or pans the viewport (#6380).
- Roleplay Visual Novel paragraphs follow speech playback, with optional timed autoplay and a paragraph delay in Appearance settings (#6373).
- Termux client builds get temporary heap headroom instead of inheriting the smaller server limit; explicit memory overrides are preserved (#6381).
- A Game Mode ruleset that resolves its own fights can now say what one square of a battlefield is worth in its own distance, and a game on such a ruleset set to Tactical combat is fought on a board. How far a turn walks, how far a weapon reaches or is thrown, how far an ability carries and what a wall blocks are all the ruleset's own numbers.
- On that board an ability lands as the shape its ruleset draws, a burst, a cone or a line, a creature's breath included; cover adds what the ruleset says to the number an attack is rolled against; a shot taken too far off or with a foe at your elbow is harder when the ruleset says so; walking out of somebody's reach lets them strike at you; and the conditions that talk about distance finally mean something.
- Opponents nobody plays now move: they close the distance, get up when they are knocked down, weigh every square they could fight from, sprint when nobody is in reach, and do not walk through three people's reach for a slightly better target.
- A ruleset that says nothing about distance, and any game set to Classic combat, fights exactly as it did. The 5e example gains distances on its weapons and its creatures and Ember Roads gains one line saying a square is two paces; ruleset packages that carry any of it need Capability API 1.28, and games with no ruleset are unchanged.
- A Game Mode fight on a ruleset that resolves its own combat is now played on screen, in that ruleset's own words. The menu is your character's own attacks and abilities plus the standard actions the ruleset lists, each saying what it spends out of the ruleset's action economy and pools and what it is likely to do; choosing one that needs a target offers only the combatants the rules allow it to be pointed at, and a spell that can be paid for from a higher pool asks which one first. The panel below shows the turn order with whoever is on turn, the round, everybody's health and defence in the ruleset's own names, their conditions with the rounds left, temporary points, concentration, the two counts of the ruleset's dying rule, and an opponent's threat and traits behind a Details link. The log prints the real arithmetic, such as "Juno attacks Rust jackal with Road axe: 8 (5 + 3) + 3 = 11 against Guard 6, a hit", with advantage, criticals, saves, resistances, recharge rolls and uses left all said out loud. Turns nobody is playing run one at a time so the log can be read, the per-member manual and AI toggle still works, and a choice the rules refuse says why without changing anything. When the fight ends, the recap the Game Master is given uses the ruleset's real numbers and says the sheets are already up to date, because every accepted action was written to them as it happened. The setup wizard and the ruleset import review now say what battles will really do, read from what the ruleset file carries. Your Combat Preference is kept and not used for such a game, and games with no ruleset, or on a ruleset that does not resolve its own fights, are unchanged.
- A Game Mode fight can now be resolved by the ruleset's own rules on the server. When a game is on a ruleset that describes how it resolves combat, the battle is fought with that ruleset's dice against its own numbers: each party member's health, resources, conditions and concentration are read off their own character sheet and written back to it after every action, so closing the tab in the middle of a fight loses nothing and there is no end-of-battle tally that could disagree with the sheet. Opponents come from the ruleset's bestiary by name, or, for something the Game Master invents, from a stat block pulled onto the ruleset's own threat scale, or last from the plain numbers of the threat rung it belongs to, and the battle records in plain words every change it had to make. Opponents nobody plays choose from the same list of legal actions a player would see, and a boss the Game Master controls is asked to pick one of them and nothing else. The encounter the Game Master writes now describes each enemy in the ruleset's own terms as well. The battle screen that plays it is the entry above, and games with no ruleset are unchanged.
- Rulesets can ship a bestiary: a catalog that holds creatures instead of character-sheet rows, each written in the ruleset's own numbers, with health that can be dice rolled when a fight starts, resistances and immunities, the threat tier it belongs to, short traits the Game Master is shown, and actions that can hit, force a save, apply a condition, run out of uses, come back on a recharge roll, strike several times for one action, or be spent from the creature's own pool of points. An opponent the Game Master invents instead is pulled onto the ruleset's own threat scale before anything is rolled, and says in plain words what it changed. This part is the shared rules engine and the file format; the saved battle and the screen that use it are the two entries above. Both example rulesets in the authoring guide now ship a small bestiary of their own creatures. Ruleset packages with a bestiary need Capability API 1.27, and games with no ruleset are unchanged.
- Groundwork for Game Mode battles that follow a ruleset's own rules: a ruleset can now describe how it resolves a fight, with an optional `combat` block naming what is rolled and against what, the actions a turn may hold, which sheet lists are weapons and which are abilities, what its conditions do, concentration, what happens to a character at zero, its damage types and the scale an opponent is picked from. Its ready-made catalog entries can say how many targets something takes, whether it always lands, what conditions it applies, what temporary points it grants, how it grows with the character and which action it spends. This part is the shared rules engine and the file format; the saved battle and the screen that play it are the entries above, and a game on a ruleset without the block fights exactly as it did. The 5e example and Ember Roads both ship a combat block in the authoring guide, which also lists in plain words what is not modelled yet. Ruleset packages that ship the block need Capability API 1.26, and games with no ruleset are unchanged.
- AI translations use the selected connection's output-token budget and cap instead of always defaulting to 4,096; the existing Max Tokens setting also controls the translation fallback (#6366).
- Advanced Settings now groups text, agent, image, video, ComfyUI and embedding timeout controls for slow backends. Saved limits persist across restarts; media and installed-package changes identify when a restart is needed (#6363).
- Built-in agents can select which context sources they receive, and preserve those selections on save, export and reload. Grouped agents retain the union of their selected sources (#6356).
- SwarmUI image connections can keep generated files in the backend, send selected LoRAs and their weights, and pass reference images through the native generation API (#6350).
- Completion sounds and browser/native alerts wait until automatic output translation has finished saving, including a fallback notification if translation fails (#6352).
- OpenAI-compatible agent calls finish at the stream's completion marker even when the provider keeps the HTTP connection open (#6349).
- Saved chat defaults reuse setup choices without capturing or overwriting the new chat's name (#6355).
- The mobile chat setup wizard keeps its footer inside the available screen when Commands are expanded (#6354).
- Long Game narration can use more of the mobile screen while short messages stay compact (#6351).
- Agent category buttons show their full labels, and the Personas empty state now reads “No personas yet” (#6357, #6358).
- Home lifecycle checks scale their heap allowance with the warmed app while retaining structural leak checks. Storage shutdown regressions use production logging and verify that every autosave exit hook is released (#6353, #6360).
- Claude cache-duration documentation distinguishes Agent SDK requests from Claude Code subagents; all ten translated guides now explain the setting (#6344).
- A Game Mode ruleset can now offer layers: named variants of itself, such as Low magic or Hard winter, that you turn on for a game under the ruleset you picked. A layer can make the difficulty ladder harsher, take choices out of a character sheet field, leave some of the ruleset's ready-made catalog entries out of the sheet editor's picker, and give the Game Master extra instructions, including for the world it builds during setup. Rulesets may also say what kind of world suits them even without a layer, which world generation now reads. Layers can rule each other out, your choices are fixed for that game's lifetime exactly like the ruleset itself, and nothing on an existing sheet is rewritten: a value a layer takes away stays on a character who already had it. Ember Roads, Gravewatch and the 5e example each ship a layer in the authoring guide. Ruleset packages that offer layers or world guidance need Capability API 1.25, and games with no ruleset are unchanged.
- Game Mode rulesets can now be built on dice pools. In a pool ruleset the number on a character sheet is how many dice you throw rather than a bonus you add, and the difficulty is how many successes the check needs. The ruleset says which faces count, whether a high face rolls another die or counts twice, whether low faces cancel successes, and what counts as a fumble or a standout success; the Engine throws the dice, counts them, and replaces any result the Game Master wrote for itself. Your sheet shows those numbers as dice instead of as a bonus, and the dice card picks out the dice that reached the target and reads how many successes came up against how many the check needed. Importing a ruleset and the Rules step of game setup now say in plain words how it rolls a check, including any optional pool rules it turns on. The Game Master can also make one check harder or easier by moving the per-die target or by adding and taking dice, where the ruleset allows it, and can roll a skill with a different ability by name, which works on every ruleset. A new example ruleset, Gravewatch, ships in the authoring guide beside Ember Roads. Ruleset packages built on dice pools need Capability API 1.24, and games with no ruleset are unchanged.
- A ruleset sheet can now take the newer text of rows you added from a ruleset's catalog. When the wording of a spell, attack or feature has changed in the ruleset since you picked it, a line under that list says how many rows have newer text, with a Review button. The review shows each row with what your sheet holds beside what the ruleset says, and you tick the ones you want before anything is written. Only text is compared and only the ticked rows change, so your own numbers, switches and anything you typed in another column of the row are left alone. Cells that a ruleset keeps for you, such as uses that follow an ability score, now also show as read-only with a note saying the ruleset sets them.
- Game Mode rulesets can keep some sheet numbers themselves, and the Game Master can use an ability by name. A ruleset's ready-made entries may say that a number column follows the character, such as uses equal to an ability score or a class resource that grows with a level, and the sheet editor keeps that cell right instead of leaving it to you. The Game Master can also say that a character uses something they picked from a catalog, and the Engine pays the whole price: whatever the ruleset says it costs, plus one use of each counter that came with it. A spell paid with a slot comes out of the slot level the ruleset names for it, and the Game Master can ask for a higher one instead. If any part cannot be paid, the whole thing is refused and nothing is spent, and something that costs nothing is simply narrated. Ruleset packages that ship these values need Capability API 1.23.

- Game Mode rulesets can lend their character sheets to battles with a new optional `battle` block. A fight starts on the sheet's health, energy and spell slots, and the health lost or regained and the resources spent are written back when it ends. The block names which sheet lists supply skills: a row picked from a catalog becomes a usable skill when its catalog entry describes what it does, and rows in other lists, typed by hand, or without that description are left out. Health is carried as a share of the maximum both ways, because the numbers in battle are Marinara's: a character at half health on the sheet starts at half the battle's health bar. Battles still use Marinara's own combat math, attack rolls, saving throws and concentration are not applied, an abandoned fight writes nothing back, and a ruleset without the block leaves combat unchanged. Ruleset packages that ship the block need Capability API 1.22.
- Returning to a chat while a background translation is being saved now replaces the old translation correctly when Show Only Translation is enabled (#6337).
- Game Features switches share consistent track sizing and thumb spacing, including custom HUD widgets and narrow mobile layouts (#6339).
- Custom Tracker accepts top-level incremental updates as well as updates nested under `fields`, using the existing row merge and lock handling (#6340).
- Claude Subscription connections can request a one-hour prompt cache, and connection exports keep unsaved cache-duration changes. Cache logs report the actual five-minute and one-hour write counts and avoid cost estimates when the write duration is unknown (#6341).

- Character name resolution exposes each chat member's saved aliases alongside their canonical name, including disabled members, without changing existing name-only callers (#6328).
- Peek Prompt includes capability package context and roleplay events through the same placement path as generation, including package Agent Sections (#6331).
- Visual Novel portraits open the existing full-size image viewer with mouse, keyboard or touch (#6332).
- The Conversation sidebar's Character Schedule Manager icon keeps its intended size instead of shrinking inside button padding (#6333).
- Professor Mari's fenced code blocks have copy buttons that preserve code whitespace and report clipboard failures, sharing the Docs viewer's controls (#6334).
- OpenAI-compatible connections to OpenCode Go/Zen automatically send a stable per-chat session header and identify Marinara Engine, including nested generation, retries and chat translations (#6325).

- Mindless Tactical enemies follow the fewest legal steps instead of choosing a longer cheap detour, while still paying terrain and weather movement costs (#6324).
- Regenerating a translated reply now translates its new content instead of retaining the previous version beside the original when Show Only Translation is enabled (#6317).
- Launchers check the complete client build inventory and rebuild missing or empty assets before startup. Missing frontend files return 404 instead of HTML, with recovery guidance for blank pages after updates (#6320).
- Selfie documentation lists the supported model command forms and the Conversation-mode setup requirements (#6318).
- Reasoning-only replies without evidence of an exhausted output limit no longer suggest lowering Reasoning Effort as the cause; the error points to retrying and inspecting the response (#6321).

- Image connections support fal.ai text-to-image generation, with FLUX starter models, custom model endpoints and parameters, and the existing image previews and gallery (#6312).
- Connection tests retain fast results after automatically saving edited settings.

- Browser regression fixtures resolve dependencies from Vite's transformed imports instead of expiring resource timings. Wizard persistence checks wait for the settings drawer before reloading and preserve the original error if timeout cleanup fails (#6303, #6304).

- Built-in tracker Agent Sections use the selected turn's saved state at their preset positions, without repeating that data in the automatic context. Trackers without an active section retain their usual placement (#6308).

- Settings search opens Game Assets in Imports, where the existing asset browser, uploads and rescan controls live (#6309).
- Home and its browser header identify installed staging builds beside the version, independently of the selected update target (#6307).

- Game difficulty now affects enemy AI decision consistency in Classic and Tactical, while companions retain their own competence. Older title-case settings work throughout combat, encounters and loot; the current Traditional damage modifiers affect enemies only and are explicitly reserved for that ruleset.
- Combat accepts and saves campaign weather, applying rain's elemental modifiers, tagged projectile/sight penalties, and Tactical snow movement costs. Sheltered or uncertain exposure is neutral; conditions remain visible with weather animations off and stay fixed across reloads.
- Game creation retains Battlefield Size while removing the unused campaign Battlefield Seed control and “current style” from Classic. New battles receive individual internal seeds, while saved battle maps and restarts retain theirs.
- Combat started from a restored checkpoint uses the restored scene's weather, and Classic end-of-round elemental mechanics respect the encounter's weather modifiers.

- Linux sandbox regressions probe the actual host process instead of Bubblewrap’s isolated supervisor and accept explicit denial when reading a masked secret file, avoiding false failures without weakening the isolation checks.

- Combat AI review fixes keep Methodical units focused on real opponents, respect legacy skill ranges, and report invalid enemy MP and corrupt saves clearly. Combat events can be translated, item prompts match their targets, and mobile terrain inspection leaves battle controls accessible. Battlefield reload checks no longer depend on browser resource-timing history (#6303).

- Codex has a dedicated `AGENTS.md` with OpenAI model and tool guidance; skills remain shared through `.agents/skills → .claude/skills`. Completed, locally validated and reviewed PRs now proceed to ready for review without a separate confirmation.

- New Game Mode battles use saved combat temperaments in Classic and Tactical, including Patient, Methodical and Coordinated. Explicit Mindless hints also work for other creature types. Companion control can be chosen per member; generated enemies retain usable MP, and Classic support skills target the correct side with saved cooldowns.
- New Game Mode battles can let the GM direct authored bosses in Classic and Tactical, with legendary actions, turn-start anticipation, and optional Counterspell/guard reactions. Saved decisions protect resources across reloads, duplicate commands and late GM replies; manual party reactions show their MP or spell-slot cost.
- Restoring combat preserves the encounter anchor and mechanics instead of clearing them during screen initialization.
- Classic combat consumes items only when their accepted action executes, keeping abandoned retries and skipped turns from spending inventory, and retains spent spell slots between rounds. Tactical AI uses the same skill-power floor as combat resolution when weighing area attacks.
- Game creation describes Tactical combat without an external game comparison and no longer asks for permanent terrain guidance. Added combat AI, Summoning and versioned ruleset handoffs, with the implemented boss/reaction boundaries and remaining ruleset work.
- Groundwork for selectable Game Mode rulesets: a capability package can now ship its rules as a validated `ruleset.json` data file (Capability API 1.20, package kind `ruleset`), and chats have a place to record which ruleset a game was created on. Nothing selects a ruleset yet, so every existing and new game plays exactly as before. See `docs/development/game-rulesets-and-sheets-implementation.md`.
- Game Mode checks in a game that pinned a ruleset now use that ruleset: its dice, its difficulty ladder, the character's ruleset sheet, and its own rule for natural results (5e SRD 5.1 has no automatic success or failure on checks and saves). The Game Master can add `who="Name"` to check a party member, and a check that carries a modifier it invented itself is rolled again with the modifier from the sheet. Games without a ruleset are unchanged.
- Characters and personas can hold a sheet for each installed Game Mode ruleset, edited under **Stats** in a layout that comes from the ruleset. A sheet is a starting build that a game copies. Sheets for rulesets that are not installed are kept, shown as one removable line, and travel with exports; each sheet is limited to 64 KB.
- New games can be created on an installed Game Mode ruleset through a **Rules** choice in the setup wizard, separate from Combat Preference. The ruleset stays with the game, each party member's sheet is copied into the game (a blank one when they have none), and nothing in a game writes back to the character or persona. Shared setup files carry the ruleset and fall back to Marinara's own rules, with a notice, when it is not installed or the installed version is older than the one the file was made with. A card keeps its sheet through a session conclusion and an in-game sheet edit, and a recruited party member gets one too.
- A game on a ruleset now keeps each party member's sheet up to date as you play. The Game Master records spent and regained resources, damage, healing, conditions and rests with a `[sheet: ...]` command, and the Engine checks every one against the sheet: a spell cast with no slot left is refused and you are told. The in-game character sheet shows the ruleset sheet with live pools, conditions, rest buttons and an **Edit sheet** mode. Live values belong to the message they happened in, so a swipe or a regenerated turn never spends twice.
- The agent catalog shows the 5e (SRD 5.1) rules package under the **Game** filter, and the agents overview explains that a package marked **Rules** adds a Game Mode ruleset rather than an agent.
- Community Game Mode rulesets: a ruleset anyone wrote can be imported from a single JSON file (**Import agents** in the Agents panel, then **Game Mode ruleset**), or received from a custom agent repository that carries a `rulesets` folder. A review shows what the ruleset covers and the full text it sends to the Game Master before anything is stored. Imported rulesets are named after where they came from (`local/my-5e`, `alice/v20`), so they can never replace an official one. Every imported version is kept, and a game always plays on the exact version it was created on; a changed file needs a higher version number. Turning **Allow custom Agent imports** off hides imported rulesets from new games without touching games that already use one.
- Game Mode rulesets can now ship catalogs: ready-made spells, features or gear that fill a character sheet's lists, so nobody types every row by hand. One entry can fill more than one list, picked rows are copies you can edit, and catalog text is never sent to the model. See [Writing Game Mode Rulesets](docs/extending/writing-rulesets.md).
- The character, persona and in-game sheet editors now have **Add from catalog** on every list a catalog fills. The picker searches and filters, marks what the sheet already holds, and says what each list would gain before you add anything.
- Installed rulesets now appear in the Agents panel under **Rules**, where a rules package can be uninstalled and an imported ruleset removed. Removing one that games still play on asks again and says how many.
- The setup wizard's note for a ruleset without combat rules now names the Combat Preference you picked (Classic or Tactical) instead of saying "default combat".
- New guide for ruleset authors, [Writing Game Mode Rulesets](docs/extending/writing-rulesets.md), with a small non-d20 example ruleset and a JSON Schema for editor help (`docs/extending/ruleset.schema.json`, regenerated with `pnpm ruleset:schema`).
- Storage flushes already waiting when shutdown starts now join the final write drain, avoiding a spurious closed-store error while preserving pending data and reporting failed admitted writes even when shutdown retries successfully (#6298).

- Capability packages can now offer tools the model calls during a turn, so a package that owns live state receives structured, validated data instead of parsing it back out of the reply. Narration still streams while the call happens. See `docs/development/optional-agent-packages.md` for the package-author API.

- Deleting a chat message (or bulk-deleting messages) now cleans up lore that agents extracted from the deleted turns. The Lorebook Keeper's entries remember which messages they came from: rewriting an entry in place is undone when the turn that rewrote it is deleted, entries whose whole source turn is gone are removed, and hand-written entries are never touched.
- Regenerating a message no longer keeps lore written from the discarded swipe active in the prompt. Swiping back to the original response brings its lore back.
- Lorebook entries expose the messages they were extracted from, and the entries list can be filtered by source message, so lore left behind by a deleted message can be found and purged explicitly.
- Character schedules accept custom daily safety limits above eight, preserve them through schedule imports, and still respect the chat check-in cap (#6291).
- Local embedding launches raise the logical batch when needed so physical batches above 2,048 tokens are not silently capped by llama.cpp (#6293).
- Professor Mari validates edits and undo without scanning unrelated chat history, preserving lazy storage and avoiding repeated unrelated-error warnings. Plain-text agent memory no longer produces false JSON errors; explicit database validation still reports existing broken references without deleting data (#6294).

- Repeated keeper writes preserve the original undo snapshot, and legacy profile imports clear foreign message references so restored lore remains usable. Storage format 7 protects the new provenance fields from older builds that cannot preserve them (#6288).
- Refresh compatible dependency and CI-action versions while preserving the supported Node, schema and native-runtime compatibility pins. The sandbox regression fixture also resolves macOS temporary-directory aliases before comparing canonical store links, and restart-test failures retain startup-stage diagnostics.

- Starting a Conversation or Roleplay chat from a character card keeps that character selected when saved wizard defaults are applied (#6284).
- CI isolates language checks from live agent-catalog availability and gives cold native server startup its own deadline while preserving the restart deadline.
- Roleplay documents choose one of three built-in styles for each document kind and keep that choice with the saved command. Real dice rolls appear inside the reply where they were requested, using the existing dice animation and preserving their results after reload (#6279).
- Pinch zoom on mobile preserves the Roleplay layout and media size instead of treating the smaller visual viewport as an open keyboard (#6278).

- Mobile chat composers stay above the on-screen keyboard while the page is zoomed, and restore their layout when the keyboard closes (#6811).
- The mobile More menu uses the matching pink Characters and gray Settings icons.
- Advanced Memory scene decisions have room for reasoning models to finish, respect the helper connection's output cap, and explain output-limit failures (#6280).
- Model discovery errors expose the underlying network error code and clarify that the provider must be reachable from the Marinara server (#6268).
- Roleplay interruption instructions explicitly cover dialogue and actions, with a concrete example of a plausible intervention (#6281).

- Tactical Game Mode can combine a GM terrain brief with a reusable battlefield seed and size. Requested terrain is validated and preserved, with an explicit generated-terrain fallback when a layout cannot be used. Flying and teleporting units gain distinct movement rules while retaining terrain defense and evasion bonuses. Malformed saved grids are excluded from GM battlefield summaries (#6265).
- Added a contributor roadmap separating combat participation from battlefield rules, with follow-up plans for summoning and versioned tabletop rules profiles (#6265).
- Codex contributors review locally with CodeRabbit and resolve valid findings before requesting PR review, reducing use of the repository's shared review quota. Documented false positives or purely pedantic suggestions do not block review.

- Custom agent outputs now show separate public-output and private-context editors under the same spoiler protection. Responses that omit private context retain the previous visible turn’s value (#6254).
- Copied Support Diagnostics include only the latest five relevant client events, omitting routine visibility events and keeping reports shorter while preserving the full local recovery history (#6261).
- Character Library and Characters panel token estimates include the full character card, including example messages, alternate greetings, instructions, and embedded lore (#6255).

- Personal Extensions can use Marinara's built-in text token estimator through `marinara.estimateTextTokens(text)` (#6257).
- Character Library previews preserve saved portrait crops without stretching them in compact or mobile layouts. Library and Recent Chats hover feedback keeps image sizes stable to avoid transient resampling artifacts (#6247, #6249).
- Memory Recall reuses a continuity summary when its sources are unchanged and it still fits the adjusted context budget, avoiding duplicate entries and unnecessary summary requests (#6250).

## [2.4.6]

- Shutdown regression checks use persisted cleanup results after terminal exit, avoiding false failures when a closed terminal discards its final log output (#6245).

- Added Professor Mari’s v2.4.6 What’s New story with release screenshots and demonstrations (#6240).
- Professor Mari’s memory-processing animation alternates both legs, with a straightened rear-leg stride and rotating wheel spokes (#6240).

- Characters keeps its pink gradient on the topbar underline, sidebar header icon, and New buttons when the Chroma accent changes (#6238).

- Roleplay Visual Novel paragraph buttons and the paragraph counter follow the Chroma accent, including on hover (#6236).

- CI actions use the supported Node.js 24 runtime, and container builds include Docker's fix for workflow-command injection in metadata logs.
- Prepared v2.4.6 across the Engine, Home version, PWA manifest, Windows installer, and Android bootstrap metadata. Android uses version code 47 so the APK can update existing installations.
- Windows installers download the security-patched Node.js 24.21.0 release with its verified checksum.
- Container bases include the current Node.js security fixes, and Lite images build against the system libraries required by their Node package on both amd64 and arm64.
- Sprite listings reject invalid character paths before reading or creating directories outside that character's sprite folder.
- Platform checks now build and exercise full/Lite containers on both supported architectures, native desktop installs and update safeguards, the Windows installer, and Android APK compilation without publishing a release. Android build instructions state the required Gradle minimum, and macOS update tests use a socket path that fits the platform limit.
- Noodle and Slurp chat controls appear only while their packages are active. Chats can optionally include Slurp activity, off by default, and package context follows the preset's formatting (#6235).

- Scene preset variables are chosen before planning begins and apply to the opening message. Cancelling setup makes no generation request (#6214).
- OpenRouter prompt caching honors the connection type when using a proxy, and Gemini reports cache-hit tokens in its usage figures (#6217, #6218).
- Anthropic keeps depth-injected instructions at their position in chat history instead of moving them into the cached system prefix (#6219).
- The context bar uses the latest request’s size instead of adding together every request in a turn. Tool and dice follow-ups consistently retain all reported token totals (#6220, #6221).
- Tracker cards render reliably in WebKit with simpler neutral shading, including saved custom paints and brightness settings (#6223).
- Conversation reactions stay next to their message when action controls appear or disappear (#6224).
- Home, sidebar, editor, and Settings borders follow the selected accent, as does the mobile Home bookmark icon. Suggestion-chip borders use simpler color blends so Professor Mari opens reliably in WebKit (#6229).
- The Illustrator guide describes agent-instruction token estimates accurately; translated agent guides explain summary attachment and tappable token help (#6222, #6227).
- Chromium browser checks run in smaller parallel shards so the complete suite fits within CI time limits.

- The agent-token estimate’s help opens on tap and stays within the mobile screen (#6228).

- Roleplay agent requests omit chat summaries by default to reduce context size. Turn on **Attach chat summaries** in Chat Settings → Agents when an agent needs them; summaries remain available to the main reply (#6225).

- Game chats can finish a rolled turn in one model request. **Finish rolled turns in one request** in Chat Settings → Function Calling lets the Game Master write both halves of a check, or a `[[roll: 2d6+3]]` placeholder for a number, and the engine rolls afterwards and fills the result in. The Game Master never sees a number before it decides what happens. The setting is off by default and applies per chat (#6215).
- While one-request dice is on, the dice tool is no longer attached to a Game turn by default, **Narrate dice outcomes immediately** is shown disabled with its stored value untouched, and a chat with a separate Game tool connection is told that its planning request still applies (#6215).
- A number the engine cannot roll is replaced with a short notice instead of an invented value, a branch it cannot read keeps the recorded roll and drops both halves, and either case adds a plain line to the session log (#6215).
- One-request dice gains an optional **Let the Game Master see one die of each size**, off by default, for outcomes where the number itself has to pick between three or more endings. The engine keeps the queue, hands out values in order, never repeats one, recomputes every number in the record, bounds the difficulty, and rethrows a size that goes unspent. Its help text says plainly that the Game Master can steer outcomes it can see, which the blind forms do not allow (#6215).

- Retire the global active-persona default so chat identity follows the persona selected for that chat; Conversation message macros use the user identity instead of the message author (#6206, #6207, #6208).

- Slash-command suggestions and guides show argument formats, including optional inputs; `/hide` also accepts a message range followed by an optional character name (#6209).
- Opening Roleplay trackers tolerates missing or invalid character IDs without losing named NPCs or saved tracker data (#6202).
- Game lorebook entries keep their before/after placement around the Game Master context, while explicit depth and role settings remain respected (#6203).
- Professor Mari requests JSON command responses from Google and Vertex Gemini and uses bounded protocol recovery for malformed function-call responses (#6204).

- Push Story and Combat box borders follow the selected Chroma accent instead of retaining pink outlines (#6197).
- Translator settings can be saved as defaults for new chats, including provider, language, connection, prompts, and automatic translation options (#6199).

- Game setup keeps its normal steps when an Experience declares inline setup, with seed controls, individual lorebook entry selection, and setup-file import/export. Experiences can only be selected for new games; reopening an existing game preserves its saved Experience (#6181, #6182).
- Unsupported installed package records no longer block supported packages on updated hosts, and remain preserved during registry writes and downgrade checks (#6181).
- An Experience that requires custom HUD widgets on or off now applies that setting while it is on, locks the control with a line saying which Experience set it, and gives the earlier choice back when the Experience is turned off (#6200).
- Dismissing the malformed-JSON repair dialog with Escape no longer also dismisses the Experience setup behind it (#6200).
- Importing a game setup file now reports how many of its selected lorebook entries are missing on this machine instead of dropping them without a word (#6200).
- The world seed an Experience asks for is a whole number from 0 to 4294967295; anything else blocks Start instead of quietly building a different world, and importing a setup file that carries no usable seed keeps the prefilled random one (#6200).
- Automatic translation follows the originating chat while navigating elsewhere in the app (#6187).
- Closing a Unix terminal flushes confirmed saves and records a clean server shutdown (#6183).
- Inventory tracker items can retain editable descriptions and locations alongside their quantities (#6192).

- Scenes now offer the selected preset’s variables before entering the new chat and wait for confirmed choices to save (#6184).
- Trackers can update or remove individual rows while keeping untouched values and field locks; existing full-list responses remain supported (#6185).
- Experiences can prepare their world before the opening Game narration and provide that world’s context to the first turn (#6180).
- Scene controls use the selected Chroma colors and readable button surfaces over Roleplay text (#6186).

- Routine Advanced Memory preparation no longer opens Chat Settings after every Roleplay or guided reply; settings still open when confirmation or a blocking error needs attention (#6177).

- Stopping a Roleplay reply also stops its remaining text-reveal animation and releases the generation control promptly; an older reply cannot overwrite a newer generation's text (#6173).
- Roleplay notes now explicitly carry decisions into future turns and clarify that updated notes replace their previous contents (#6175).

- Markdown blockquotes now use the selected Chroma accent, and blockquotes plus `---`/`***` dividers keep balanced spacing above and below without removing extra paragraph breaks (#6170).
- Mixed HTML messages preserve literal code, and empty Markdown quote lines no longer absorb the following text (#6170).

- Image API connections now accept custom JSON parameters, including provider-supported LoRA fields. Parameters persist with saved, copied, and exported connections and apply to generation requests using that connection's own defaults (#6167).
- Image-generation debug logs redact credentials and embedded image data while preserving prompts and request settings for troubleshooting (#6167).

- Lorebook entries declined by the current-location reserve can still activate independently through keywords, sticky state, or recursion within the ordinary lore budget; declined constants cannot bypass the reserve (#6143).
- Chat-local lorebook toggles made during reply preparation now survive generation. Runtime countdown and timing updates preserve newer edits, legacy switches, and deletion or detach cleanup (#6144).

- Separate Game tool planning preserves narrator prefills and prompt formatting, keeps its instruction in the conversation on every provider, skips Continue, and no longer advertises duplicate local tool calls or reports the planner's finish reason as narration (#6148, #6149, #6150, #6155, #6156).
- Game dice outcome rewrites include native rolls alongside text-command rolls. They can be disabled in Chat Settings to save the extra generation cost, and no rewrite runs when nothing was rolled (#6147, #6157).
- Game replies consisting only of a refused package command explain the invalid argument instead of claiming the model returned nothing (#6151).

- Numeric settings keep text selection intact when a saved value arrives just before editing, preventing old digits from being prepended to the new value.
- Regression checks now drain development-watcher diagnostics before checking them and capture live dice screenshots without freezing animations.
- Roleplay setup now waits for preset changes to save before advancing and closes obsolete preset-variable prompts instead of leaving an empty dialog.
- Advanced Memory Recall now explains automatic context compression and summary limits, supports optional or disabled moving-context excerpts, and shares its setup with the Roleplay wizard. Existing chats get a preparation reminder; preparing/resuming responds immediately, with matching drawer controls and an improved Professor Mari running animation (#6159).
- Advanced Memory gives reasoning models a separate, bounded response allowance for short summaries and rejects incomplete output instead of saving it as finished memory. Its archive shows numbered scene summaries with story timeframes carried into recalled context, full source-message inspection, search, and confirmed deletion to restart preparation while preserving the original chat and settings (#6159).
- Ongoing scene detection now runs after generation, sharing an existing tracker request when available. Without trackers, its configurable interval defaults to five messages and sends only that recent message window with the scene instructions. Swipes invalidate outdated scene decisions, memory reset also protects pending prompt previews and preparation, and rapid numeric settings edits are saved in order (#6159).

- Character Tracker now keeps the members of a multi-character card apart. A scenario card that describes several people used to collapse into one tracked entry named after the card; each person now keeps their own name, state, and portrait across turns. Cards that mark their cast with `[CHARACTER: Name]` headers or repeated `Name:` fields are recognized up front. A stale entry carrying the card's title is cleared when a member replaces it, while manually added characters keep their identities (#6104).

- The native-dice browser regression has a longer total test budget for its multi-stage WebKit scenario, while individual action and assertion timeouts remain unchanged (#6141).

- Chat Help now updates its layout when the window crosses the mobile breakpoint, onboarding tooltips respect the available height on short desktop windows, and Conversation schedule labels and ungrouped persona headings follow the selected interface language (#6140).

- Added a remembered prompt preset choice when creating a Roleplay scene, configurable speech filters for tagged text, bracketed text, and code blocks, and an opt-in setting to run Game tasks one at a time within a chat (#6108, #6112, #6107).
- Lorebook searches now include matching entries without usable embeddings, omit unrelated semantic results, and search entry names, content, and keys (#6124, #6125, #6134).
- Re-enabling an exhausted chat-local lore entry restarts its authored activation limit. Detaching or deleting lore clears its saved entry state, chat toggles respect book scope, and duplicating an entry preserves its shared enabled state (#6120, #6131, #6132, #6133).
- The Game tool picker now explains and follows the “Let the GM search lore” setting (#6121).
- World generation accepts large lore-entry selections, respects entries disabled for the chat, and refuses context windows that leave too little answer space before making a paid call (#6122, #6126, #6129).
- Fixed Roleplay dice commands on Claude and Grok subscription connections. Game dice corrections retain justified movement and package commands, report unsupported notation, discard invented roll results, and show a retry notice if outcome narration fails (#6117, #6118, #6123, #6127, #6128).
- Peek Prompt now shows the Game tool planner’s model and token usage separately from narration (#6130).

- Windows Ctrl+C now lets the server finish saving before the launcher exits; restart and shutdown regressions use portable loader URLs and include a native Windows console check (#6119, #6135).

- Fixed Roleplay Visual Novel mode starting newly generated multi-paragraph replies on the final paragraph instead of the first, while preserving paragraph navigation after edits and selecting existing swipes.

- Added an opt-in Roleplay interrupt command: characters can cut off the latest dialogue or action, with Restore and full original context on rerolls (#6109).
- Kept Roleplay command details readable in light themes when the chat uses a custom message text color.

- Added opt-in Advanced Memory Recall (Alpha) for Roleplay: automatic scene summaries, bounded continuity, relevant historical excerpts, and character-aware context management, with resumable setup and preset placement controls (#6102).

- Professor Mari's Home navigation field is ready to type into without an extra button click, with a shorter “Looking for…?” placeholder on mobile (#6099).

- Automatic backups now check that the disk holding `backups/` has room for the next archive, including metadata and restore notes, before writing it. A run that would not fit is skipped with a clear message in Settings instead of filling the disk and retrying the full write every hour (#6087).
- Deleting a character card now removes it from every Roleplay and Conversation chat it belonged to, as it already did for Game parties, and the Characters count in Chat Settings counts only cards that still exist (#6084).

- Download Backup and automatic backups no longer include the storage writer lease, so a data folder restored by hand from the archive starts without the "Another Marinara Engine process may be using" error (#6083).

- Updated ZIP handling to adm-zip 0.6.1 to block extraction through destination symlinks and removed the temporary dependency-audit exception (#6075).

- Conversation prompts no longer lose character or persona details when ordinary prose between macros mentions identity fields such as description or personality (#6066).

- Roleplay notes and memory editors now follow Chroma colors. Personal notes are prompted to stay brief and track private state and plans for future turns instead of recapping scenes (#6069).

- Visual Novel paragraph navigation now loads older messages across history pages, shows matching translations alongside the source, and preserves source text when translated paragraph counts differ (#6044).

- Roleplay's Visual Novel display now supports paragraph-by-paragraph progression with previous and next navigation controls, allowing users to step through all paragraphs of a turn and preceding messages without opening the full history view (#6044).
- Roleplay's Visual Novel display portrait now honors configured character and persona Avatar Crops (#6044).
- Image attachments in Roleplay and Conversation no longer come out squashed when the photo carries an EXIF rotation (most phone photos): the attachment compressor now reads the orientation tag before choosing the decode size, so the browser's rotated bitmap is resized with matching width and height (#6053).
- Game Mode satellite calls that run on their own connection (Scene Analysis, the illustrator prompt rewriter, and the storyboard planner) no longer inherit the chat-wide generation parameters of the main roleplay connection, so an OpenRouter provider-routing object or other provider-specific custom parameter set for the main connection no longer breaks Scene Analysis on a different provider (#6049).
- After a Game Mode session is concluded, the composer now says so and offers a New Session button in place of the silently disabled input, so play can continue without hunting for the action in the Session panel (#6045).
- Added the `/send <message>` slash command to post a message as your persona without triggering generation (#6050).
- The Termux and Linux launcher auto-update no longer aborts with "Cannot copy a socket file" when the previous server left its storage writer lease behind: the update snapshot skips the per-process lease directory and any socket or FIFO under the data directory (#6046).
- Clicking "Manage package" from a feature agent's detail view now opens the agent's installed package rather than falling back to the first catalog entry (#6047).
- Malformed Echo Chamber reactions no longer crash the chat. Native text selections pause automatic chat scrolling and take priority over touch shortcuts and composer focus handling (#6039).
- Roleplay's notes command explicitly explains how characters can edit existing notes by supplying their full updated contents (#6039).

- Added an optional Visual Novel display for Roleplay: completed paragraphs appear above the existing composer with dialogue portraits and configured sprites. Open the attached history arrow for the full transcript and all message actions. Choose Classic or Visual Novel during setup or in Appearance → Roleplay, with separate portrait and sprite scales. Dice results and image attachments remain visible.

- Roleplay Commands settings stay responsive while saving rapid changes. Documents now offers All/Narrator access, Soundtrack requires Music DJ to be added with agents enabled and follows the selected music source, and the Combat prerequisite names the Combat agent.

- Added opt-in Roleplay Commands in the Agents drawer for illustrations, in-world documents, sound cues, soundtrack changes, private personal notes, reminders, real dice rolls, and direct messages. Commands start off; existing DM opt-ins are preserved. Notes remember motives, secrets, lies, deceptions, cover stories, and plans across turns, with access limited to their character and an optional narrator selected in individual group mode. Notes, reminders, and documents follow the selected message swipe. Rolls return an engine-generated result before narration continues. Cancelling a sound cue detaches that turn without interrupting other chats waiting for the same audio.

- A game-surface Experience can now be handed specific lorebook entries to read before it writes your world, so a place you have already written history for comes out knowing it. You pick the entries, never whole books, and nothing else tags along — a lorebook you have switched on for every chat does not add itself to this one call. An entry you ticked arrives instead of being dropped by a chance roll — though a disabled entry stays disabled and every other filter on it still applies. Every eligible entry you select is included in full. If the complete instructions and selected lore exceed the model context, the call stops with a clear context-limit error so you can choose a larger context or reduce the selection. Whenever you pick anything at all, the reply answers your picks — including when none of them made it, which comes back as "none used" rather than as silence, so an Experience can tell that answer apart from an older engine that cannot read lorebook entries and does not mistake one for the other. Experiences that do not send a selection are unaffected.

- Documented Capability API 1.14 tracker surfaces, prompt placement and agent lifecycle hooks, plus API 1.15 embedding-configuration refresh for package authors (#5900).

- Dice notation is now read by one shared grammar in the four places that read it as a command — the `roll_dice` tool, the server and client sides of `/roll`, and the GM skill-check tag — instead of four private copies, so `roll_dice` accepts a bare `d20` like the other three already did. Notation whose roll could not be totalled exactly is now rejected as invalid instead of reporting a total that cannot be trusted — both a modifier too large for the engine to count exactly, and a countable modifier whose dice would push the total past that same limit. An oversized custom roll from the Game Mode dice menu is still trimmed and rolled rather than refused, but its card and its narrator line now name the dice actually thrown, so asking for `500d6` reads `100d6` instead of claiming five hundred dice over a hundred (a typed `/roll 500d6` refuses, as it always has). The `{{roll:XdY}}` macro and the dice-roll animation keep their own parsing and are unchanged.
- Game Mode skill checks are rolled by the engine instead of written by the Game Master. The GM now asks for a check and the engine rolls every one in the turn — not just the first — applying the player's skill and attribute modifiers, keeping a die the player rolled themselves, and overwriting numbers the GM made up when its own arithmetic does not add up. Those modifiers now come from the player's own character sheet, found by name, rather than from whichever party card happened to be listed first — the old lookup leaned on the card order the model chose to emit, where the player leading the list is a convention the prompt asks for, not a guarantee anything enforces. Explicit success pools now use engine rolls too; unsupported or underspecified systems keep their requests unresolved, and a check asking for advantage and disadvantage at once is now left alone rather than rolled as one of the two. When a check cannot be rolled at all, the turn is saved carrying the plain request instead of the numbers the GM invented for it. The GM requests the roll before guessing an outcome; the engine supplies the result for a follow-up that finishes the same turn.
- Added a storage API that lets a downloaded capability package register and persist its own file tables, with strict table-name validation. No caller is wired to it yet.
- Removed the unfinished Slurp creator-feed material from the Noodle guides.
- Updated the timeout reference in `.env.example` to use Slurp consistently.
- Added a reusable Character Schedule Manager for Conversation schedules. It groups characters with and without schedules, supports bulk generation and removal, and provides per-character weekly renewal controls.
- Improved the Character Schedule Manager with character folders, avatars, current presence indicators, current schedule activity, direct schedule editing, and schedule generation without an open Conversation chat.
- Character Schedule Manager folders now use the existing read-only collapsible character-group view, matching the quick Persona switcher.
- Character Schedule Manager now puts scheduled characters above folders and shows queued, active, completed, and failed states during bulk generation.
- Moved the Conversation schedule manager to a compact icon button beside the activity field and tightened the status selector spacing.
- Restored avatar placeholders and folder headers in the schedule manager, and increased the manager icon button size.
- Fixed schedule manager status dots to preserve the character's stored status when no schedule block is active, and matched the manager button size to its neighboring controls.
- Added a description below the Bulk Character Schedule Manager header that points to each character's individual schedule editor.
- Bulk schedule generation now reports per-character failures correctly, preserves chat time zones during chatless generation, and keeps folder counts aligned with visible rows.
- Schedule renewal indicators now use the configured Conversation time zone.
- Character Schedule Manager folder parsing now ignores malformed group member data instead of failing to render the manager.
- Character Schedule Manager now uses configured Conversation calendar dates for renewal and active-block status.
- Renewal comparisons now use explicit date-only values without host-timezone shifts.
- Increased the Conversation schedule manager calendar icon size while keeping its compact button dimensions.

- Moved Noodle and Slurp image canvas settings out of Engine Settings and into their respective package settings.
- Added a compact responsive batch-summary range list with a control to clear completed ranges while retaining retryable ones.
- Added a clear-all-except-one batch range action, clearer range separators and numbering, and compact failure details behind a visible warning control.
- Batch mode now identifies multiple ranges in the source summary and shows their combined message count.
- Batch range rows now keep their number left-aligned and their separator centered between the message inputs.
- Batch range rows now keep all controls inside their borders in the compact two-column layout.
- Fixed batch summary cancellation responses, fallback range typing, summary-settings dismissal, and multiline footer regression coverage.

- Fixed PNG metadata decompression, Nano Banana full-body image requests, GPT Image 2 OpenRouter routing, capability swipe timestamps, and bounded import uploads.
- Allowed trusted backend scheduler calls to execute their own capability routes without a browser `X-Admin-Secret`, while keeping external package route requests protected.
- Prevented profile preview tokens from being sent over non-local HTTP connections.
- Moved the desktop right-panel resize hit area away from the main chat scrollbar.
- Moved the agent connection bulk assignment control from the Agents panel to Connections -> Defaults -> Agents.

### Added

- Chat search accepts a message number such as `#67` and jumps to that message, including older history (#6090).

- Added an inline "Apply persona to earlier messages…" action in Chat Settings that applies the currently selected persona to messages sent without a persona, messages sent as a specific persona, or all user messages in the chat (#6043).
- Added effective generation values and their winning preset, connection, chat, mode, or output-cap source to parameter settings, plus an editor for preset parameters (#6052). Parameter edits wait for inherited values to load so a slow response cannot discard an override.
- Added Z.AI text connections with GLM 5.3 model metadata, supported reasoning levels, and useful explanations when reasoning exhausts the output budget (#5963, #5968).
- Added native NovelAI character captions to Illustrator, reusing Storyboard validation and supporting up to 22 characters on V5 (#5833, #5834); partial captions keep uncovered character appearances, and image fallbacks retain caption identities and current outfits.
- Added random initial choices for single-select preset variables, with manual overrides preserved (#5868).

- Marinara Gradient brings the logo's pink, orange, and cyan to the color picker and becomes the default UI accent. Accent Pulse starts on for desktop and off for mobile; saved preferences remain editable and appearance resets restore the device default. Fixed pink interface accents now follow the selected accent or chrome text color (#6028).

- Character sheet images have their own resolution setting under Image Generation, independent of backgrounds (#6022).

- Reply to a whole message or selected passage in Conversation. Quote previews stay in history while only the latest user turn repeats its quote to the model (#6002).
- Larger display sizes (26, 30, and 34 px) and chat text up to 72 px improve readability on high-resolution displays (#6006).
- Refresh the loaded context limit of local KoboldCpp, TabbyAPI, and llama.cpp-compatible connections when the page opens; offline or unsupported endpoints keep the saved limit (#6003).

- Roleplay Commands now offer narrator-only dice rolls and combat, apply a named character’s RPG attribute modifiers, and pass named avatars and chat settings to Illustrator. Combat and illustration commands require their agents in the chat. Collapsed command notices reveal original requests on tap and let you edit or remove attached notes, reminders, and documents per swipe. Command settings and prompts are clearer (#5990).

- Roleplay documents appear inside messages with built-in note, letter, journal, report, poster, and terminal styles. The model supplies plain text while the Engine handles formatting, including in Visual Novel mode; saved documents remain editable and removable (#6030).

- Game chats can use a separate connection for one tool-planning request before narration and enable semantic lorebook search independently. Tool settings explain unsupported subscription connections, vectorization prerequisites, and the extra requests (#5955, #5957, #5958).

- Added OpenAI GPT Image 2.5 Flare and Sunburst for image generation and reference edits, including transparent PNGs, custom image sizes, and the new Extra high and Max quality settings.
- Conversation and Roleplay setup wizards can save mode-specific defaults independently of profiles, or reset the saved choices (#5948).
- Custom agents can read their own prior output, retain private JSON continuation context, and hide saved outputs as spoilers. Context follows visible message history; activated lorebook references include entry names (#5945).

- Advanced Parameters now offers Apply, Don't Apply, and Single User Message history formatting while keeping the leading system prompt separate (#5915).
- NanoGPT connections can use the existing Default, Flex, and Priority service-tier controls. Language connections can configure validated, non-secret custom HTTP headers (#5909, #5910).
- `/illustrate [prompt]` generates the requested subject without scene or character references; bare `/illustrate` keeps its current behavior (#5914).

- UX feedback sweep: background selection during Roleplay setup and in Roleplay/Game chat settings, scrollable App/Conversation/Roleplay/Game Appearance categories, desktop sidebar widths, and an optional daily Character Library home widget (#5916).
- Support Diagnostics includes local client build and recovery events to investigate mobile reloads and black screens without collecting chat content or changing appearance settings (#5870).
- Game Mode rolls real dice instead of letting the GM make numbers up (#5798, #5901). Every game turn now carries the dice tool, whether or not the chat has tool use switched on, and the GM is told to throw it whenever it needs an actual number before it can keep writing. The roll appears as the same animated dice card a `/roll` shows, while the turn is still being written. It is saved with the message, but the game transcript does not draw the card again when you reload the chat. Only the dice tool rides along - the rest of the tool set still waits for you to turn Function Calling on, and the Function Calling panel now says plainly what that costs on each kind of connection. `update_game_state` no longer offers stat, inventory, or quest updates: it reported those as applied and then dropped them, so it now accepts only the location and time changes it actually saves, and refuses the rest with a message that says what it can do instead. Whether those two should be saved this way at all is still open on #5898.
- An Agent package can now describe a short list of Game Master actions it wants the GM to be able to take, as a `gm-verbs.json` file shipped inside the package, and the Engine checks that description: an action cannot borrow the name of a built-in Game tag, and the chat setting an action writes has to belong to the package that asked for it (#5798).
- Capability API 1.16: the Engine now reads those Game Master actions and runs them. Each one becomes a line the GM can use during a Game turn; when the GM uses it, the Engine checks the values, takes the action out of the visible story text, and either saves it into the chat setting the package owns or hands it to the package live while you play. A package needs the `chat-write` permission for any of this, and today no released Agent describes any actions, so nothing changes in an existing game until one does (#5798).
- Advanced Parameters can keep a chosen number of eligible past assistant reasoning blocks when exclusion is off (default 1; 0 keeps all), preserving provider-native reasoning and local custom-tag thinking. The allowance follows the target-character context; prompt previews, strict role formatting, reasoning-only turns, and encrypted tool-round continuation retain the correct reasoning. Plain-text and structured replay payloads count toward the context estimate; a provider session avoids resending rejected encrypted items without deleting saved thoughts (#5785).
- Added example text to Assistant Reasoning Prefill without changing saved values (#5864).
- Illustrator accepts Run Interval 0 for manual-only generation, including typed and stepped cadence in record-based editors, preserving Gallery actions while stopping automatic runs (Marinara-Agents #629).
- The Roleplay Agents & Actions menu shows per-agent phases, incoming output activity, reported input/output tokens, time to first output, and elapsed time without enabling debug prompt logs (#5860).
- Added a Regex tab to prompt presets, with existing-script editing and preset-level scoped-regex defaults. Chats inherit the default unless they have an explicit override, and can return to the preset default at any time (#5774).

- Added separate, saved "Always display swipe menu" appearance toggles for Conversation and Roleplay, enabled by default so the right arrow can regenerate the first response (#5854).
- Made Conversation and Roleplay message action icons larger, with roomier click/tap targets and spacing across the message width on desktop and mobile (#5854).
- Added GPT-6 Astra for OpenAI connections, with its 1.05M context window, 128k output limit, reasoning levels through Maximum, and Responses API support for chats and tool-using agents (#5845).

- The server now notices when its previous session ended without a recorded shutdown (#5506): a tiny status file is refreshed silently every half minute while running (nothing is printed to the console), every deliberate ending stamps itself, and the next start reports which of those happened - a normal shutdown, a crash, an update or settings restart, or a session that simply stopped with no shutdown recorded, along with when it was last alive, how long it ran, its memory use at the time, and whether the device rebooted in between. The cause of a session that just stops is _not_ something the server can know - it is ended from outside with no chance to log anything - so the report says exactly that and leaves the diagnosis to the surrounding evidence. It never guesses elsewhere either: a first run, an unreadable record, or a second server sharing the same data folder all report "unknown" rather than claiming a shutdown nobody saw. The finding appears as one line at startup and as "Previous session" and "Sessions ended without shutdown" lines in Support Diagnostics, so reports from Android/Termux phones carry the evidence automatically.

- Agent packages can now publish release notes. The update prompt lists each waiting Agent with its version change, whether it needs a restart, and a collapsible "What changed"; Download Agents gains a Version history section on the Agent detail page. A dot marks a version the publisher flagged as a change you will notice, so routine bugfix releases do not compete for attention with real ones. Notes come from a `notes.json` published beside the Agent catalog, are English only, and render as plain text; an Agent catalog that publishes none behaves exactly as before.

- Added a Connections -> Defaults -> Agents toggle to hide the recurring warning for agents that use the configured default connection (#5767).

- Professor Mari's suggestion chips are now reachable with a mouse (#5742): drag the row to scroll it (a plain click still picks a chip), and edge fades appear only while more chips actually sit off-screen - so a cut-off chip reads as "scrollable", not broken. Touch swiping is untouched, and the fade is a mask, so it works over chat background images and both themes.
- The mobile Home browser's Bookmarks bar collapses to a compact bookmark button between Home and the tab strip (#5743): tap to open the same bookmarks in a dropdown; desktop keeps the full bar; the existing per-surface bookmark visibility settings govern it - no new toggle.
- Professor Mari now shows what she acted on (#5740): when a reply stages or applies changes, an "Acting on" line under it quotes the exact words she treated as the request or permission - your message, or the memory/instruction that directed her - truncated to one row and expandable on click; expanding also lists the commands it covered, marked when they were held for your approval. The same record (latest round only, kept in memory, never validated) rides Support Diagnostics as a "Mari last acted on" line, so behavior reports carry the signal needed to tell user error from a real Mari issue - and Mari herself sees the record for the chat, so asking her why she treated something as permission gets an answer grounded in it.

- Professor Mari has a Permissions Mode (#5725), modeled on the Claude app's mode picker: **Auto** (she judges from your words and saved memories - the default and previous behavior), **Manual** (always describes first and stages only after you accept), **Accept edits** (record edits apply without the Keep/Restore card), **Plan** (she never changes anything - mutating commands are refused server-side and she lays out the exact edits in chat), and **Bypass** (applies without asking or review cards). Plan refuses all mutations server-side before any review is needed; deletions retain their Keep/Restore card in every mode that applies changes; and in Bypass, sensitive file changes, extension drafts, and dependency installs still require approval. The mode is per-chat: the shield button in Mari's panel header sets the open chat's mode (or follows the default), and Settings -> Application sets the global default; a change applies to her next run without aborting one in flight.

- Added Claude Fable 5.1 and Claude Mythos 5.1 support for Anthropic connections, including their 1M-token context windows, 128k output limits, adaptive-thinking behavior, and automatic fallback when a preset requests unsupported forced tool use (#5735, #5737).
- Added Home Widgets settings to control the URL bar and desktop or mobile bookmarks on other tabs.
- Home Widgets URL bar and bookmark toggles now save per installation and apply across browsers and devices connected to that installation.
- Added character cards to Persona selection so you can play as any saved character in Conversation and Roleplay setup or an active chat.
- Added an opt-in setting to show character identities in Persona pickers, with collapsed folder navigation and identity transition notices.

### Changed

- Professor Mari’s window is slightly taller by default on larger screens. Adjust its height with a slider in Search and Professor Mari settings; the previous height is the minimum.

- Token estimates better account for Korean, Chinese, and Japanese text, and related prompt and context editors consistently show estimated token counts instead of character counts or no counter.

- Community UI translations download on demand from `docs-i18n`, with explicit refresh and offline English fallback. Existing non-English users reselect their language once after upgrading; English stays bundled and canonical (#5827).

- Updated image processing (including the Termux WASM fallback), Tailwind class merging, Android build tooling, and pinned CI/release actions while retaining compatible runtime and compiler major versions (#5847).

- Simplified the quick Persona switcher to one rounded character disclosure with folder artwork and viewport-safe scrolling.
- Moved the character picker toggle to Advanced Message Tools.
- Roleplay Chat Summary can now generate multiple explicit message ranges sequentially, keeping each result as its own chronological batch entry with per-range progress and retry status.

### Fixed

- SwarmUI video downloads reject foreign output URLs before sending the server's authentication cookie (#6158).

- Storyboard planning retries explicitly local connections behind proxies once without reasoning, and reports empty final answers or exhausted output limits when planning still fails (#6165).

- World generation reserves context for its reply schema, preserves selected lore after macro expansion or refuses it clearly, and no longer counts unnamed outlets as injected (#6145, #6146, #6152).

- Clean server shutdowns no longer report a launcher failure, and Restart Server works from the Windows local-build launcher (#6153, #6154).

- TTS reuses the audio element primed by a user's tap across delayed generation and later voice clips. Mobile Roleplay volume controls stay within the screen edges (#6166).

- Recalled memories, summary preparation, and context trimming respect CJK token estimates without splitting Unicode characters or discarding a usable excerpt. Short lorebook previews stop scanning once their token budget is filled (#6161).
- Preset editors tolerate malformed saved marker settings, and prompt token counters use the selected UI language and clear stale counts while loading (#6161).
- Saved translations appear when returning to a chat before a delayed translation finishes saving, without unhiding dismissed translations.
- Mobile character reordering keeps Chat Settings still during the drag; swiping outside the handle continues to scroll normally (#6098).
- Roleplay message actions keep their tapped state when opening menus on iPhone, suppress native tap flashes, and use direct tray buttons for recipient controls (#6092, #6094).
- Community and Field Notes shortcuts fit within their widget padding, including Firefox desktop layouts (#6093).
- Illustrator activity shows skipped image decisions and their reasons, and distinguishes an image request from an unusable decision (#6096).

- Full-backup ZIP imports again accept archives larger than 2 GiB through the existing streaming restore path (#6091).
- Image generation now honors the configured timeout while waiting for provider response headers and image data, avoiding an early five-minute failure on slow local or hosted image backends (#6074).
- The generation parameter guide distinguishes editor defaults from effective request values and explains where preset, connection, and chat settings apply (#6073).

- OpenRouter image generation now requests image-only output by default, fixing unsupported-modality errors for MAI and Grok Imagine while retaining text output for compatible Gemini, GPT-5 image, and automatic-routing models (#6079).
- Android can remember app or browser launch, sign the browser in automatically, and reuse an authenticated running server before starting Termux again (#6071).
- Local connections with no model name now use the loaded model for agent reruns, manual Illustrator, captioning, and auxiliary text tools (#6038).
- Character greetings resolve selected preset variables without replacing their stored macros or character/persona names (#5869).
- Compatible V2 JSON and PNG card exports retain Backstory and Appearance in the standard Description (#6065).
- NanoGPT model refresh now requests detailed context and output limits (#5856).
- Tag-based avatar profiles no longer receive a natural-language portrait lead (#5836).
- Corrected the agent overview to 36 catalog packages: 6 writers, 11 trackers, and 19 miscellaneous agents (#6063).

- Local runtime and ONNX dependency installation now extract archives into private, randomly named temporary directories, preventing pre-seeded symlinks from redirecting extracted files. Runtime retries retain the private directory. Updated Hono and YAML dependencies to their security-patched versions.

- Roleplay command notes and reminders join the existing tracker Context block, with concise narrator guidance. Each character keeps the newest three active reminders; Illustrator command guidance highlights surprises and important moments (#6027).

- Preset `{{model}}` macros now use the model selected for the generation or preview, including connection overrides (#6018).
- Restored the character DM switch under Roleplay Connected Chats, using the same permissions as Roleplay Commands (#6019).
- Illustrator keeps its automatic Run Interval when Roleplay illustration commands are enabled. Character requests add extra images, including on turns with an automatic illustration (#6020).
- Deleting a library character removes it from Game parties and saved setup choices, and party counts ignore already deleted cards (#6021).
- Reply actions appear only in Conversation, with an explanation in its Help legend (#6023).
- Visual Novel history opens at the latest message with compact controls attached to its box. Sprites retain configured sizes, inactive characters fade, and turn illustrations appear above the message behind sprites and open at full size on tap (#6024).
- Visual Novel's expanded history border ends above its attached collapse arrow, and the empty-scene instruction follows the selected chat chroma text color (#6032).
- New Game setup uses the character library for its Game Master and party pickers (#6025).

- Conversation swipe controls align with the start of the message row. Hidden mobile actions and disabled swipe controls no longer leave unused space below messages (#6009).
- New Termux storage leases can recover after a stopped server without rebooting, even when Android cannot establish PID ownership. Active writers remain protected (#6010).

- Narrative Director push actions add only the selected natural/random nudge, without an extra planning-model direction or stale cached direction on regeneration. Secret Plot runs only while enabled (#6008).
- Roleplay DMs now mark new, reused, and linked Conversation threads unread, including after reload (#6000).
- Roleplay streaming now applies the same display regexes and scope settings as completed messages, preserving incomplete fragments until a regex matches (#5994).
- Desktop message actions stay grouped, and Conversation actions become keyboard accessible; mobile controls retain their spacing (#6005).
- The hidden-turn gate now accepts actionable output from any mode's parsed commands or tools, so command-only Game replies keep their anchor without a blank visible message (#5902).

- Accent Pulse avoids a WebKit rendering crash and recurring color and shadow transition bursts on touchscreens. Appearance keeps covered Home effects paused while the accent preview continues (#5988).
- Mobile message action icons remain available after closing action dialogs such as Peek Prompt (#5825).
- Game-state tools now mark location/time changes as pending until the response is saved, then confirm storage on that message and swipe. Earlier turns stay unchanged, and refused or locked writes are reported. Failed and denied tool calls show a concise notification even when debug mode is off (#5898, #5901).
- Package persistence now requires declared chat-read/chat-write permissions for chat and spatial snapshot access, including transactions. The package detail view distinguishes installed and catalog permissions and explains which permissions are API gates or trusted-code access declarations (#5899).
- Game turns now keep every dice roll on its swipe, show dice and skill-check cards in sequence, and retain roll history in Logs and stacked history, including when displaying translated narration. Text-only connections can request ordinary dice and explicit success pools; the GM receives the real results in one follow-up request before finishing outcome narration (#5956, #5959, #5960, #5961).

- Gemini reasoning replies now stream on Google's official API endpoint, including tool-using turns. Other endpoints retain the compatibility workaround that preserves proxy thought parts (#5904).
- Professor Mari now executes a frame's edits before checking its completion claim, recovers common command formats, and repairs unrecognized commands instead of silently dropping them. Requested lorebook edits use the real save/review path; explicit previews remain read-only (#5966, #5967).

- Command-only regenerations now save a swipe on the original turn instead of appending hidden rows. Game narration, storyboards, turn progress, and logs consistently skip hidden or empty turns; regenerating prose from a command anchor makes the new swipe visible (#5926, #5927).
- Location lorebook budgets now keep rejected constant entries out of later keyword and recursive scans, so prompt contents agree with skipped-entry diagnostics (#5943).

- Restart Server now uses the launcher's console and waits for the old process to exit before replacing it, with bounded shutdown instead of detached or overlapping servers (#5934).
- World generation preserves all explicitly selected lorebook entries instead of applying automatic lore token/count budgets, and reports a clear context-limit error before sending an oversized prompt or repair to the model.
- Malformed Game combat tags no longer trigger quadratic parsing delays in the browser (#5937).
- Experience setup preserves explicit package configs without double nesting and accepts larger, bounded setup payloads (#5938).
- Lorebook entry switches in chat settings now affect only that chat, preserve ephemeral counters, and clearly distinguish shared content edits from per-chat enablement (#5954).
- Lorebook Keeper decodes XML-escaped punctuation in entry names before approval and saving, avoiding escaped-name duplicates while respecting entry locks (#5946).
- The Home lifecycle regression waits for chat initialization during warm-up, so one-time loading is not mistaken for retained navigation memory.
- Gemini tool replies preserve the provider's call identifiers, keeping parallel calls to the same function correctly paired (#5918).
- Assistant dice cards stay visible beside split Conversation text and survive continuations. Auto-attached Game tools receive local-model guidance, and location/time updates no longer require unused target fields (#5950).
- Gemini and Anthropic tool requests expose their final provider prompt when chat or agent debug logging is enabled (#5918).

- Game dice-tool guidance distinguishes an already rolled check from the sparse fallback, and Function Calling no longer claims every function is disabled while Game dice remain available (#5950).

- Stopping a Gemini or Anthropic tool-streaming turn reports it as interrupted, and failed turns release their upstream connection (#5918).
- Stabilized the swipe-control theme regression by comparing settled colors instead of WebKit transition values.
- Budgeted lore selection keeps skipped entries out of recursive scanning (#5942). Explicit world-generation selections now bypass automatic lore budgets and use the model context limit instead.
- Scoped the character-action browser fixture to its test character so unrelated catalog entries do not delay the check.

- Game narration has a Translate action and rejects stale translations after rerolls; automatic translation can start with the first response when enabled during setup. Delayed translations stay with their original chat when switching chats (#5888).
- Push Story uses the current Director result with or without a preset marker, and Mari consolidates system context for local chat templates (#5931, #5932).
- Storyboards accept more than six frames (up to the existing 200-section request safety ceiling) and retry unusable local planner output once without reasoning before falling back (#5886).
- General Settings can place error messages and other notifications at the top or bottom, using the existing saved preferences (#5933).

- Connection test messages honor saved generation parameter overrides and output limits (#5908).
- Clearing Roleplay trackers asks for confirmation before removing their state (#5911).
- Update checks read the installed release channel without waiting for GitHub, so staging does not appear as Stable before a check or when the check fails (#5912).
- Browser regression fixtures disable random Chibi Mari surprise overlays so unrelated controls remain reachable during tests (#5928).
- Grouped lorebook entries remain selected for their configured Sticky Messages duration (#5913).
- Lorebook Keeper respects an explicitly selected target during automatic runs, retries, and approval, while retaining automatic destination routing when no target is selected (#5907).
- Game NPC portraits no longer borrow unrelated same-name library cards or overwrite an existing portrait; legacy loopback avatar links resolve correctly for LAN clients (#5885, #5887).

- Mari's database CLI can address generated IDs beginning with `--` without treating them as options; exact option-name IDs can use the standard `--` separator, and mutation approval/cascade safeguards remain enforced (#5895).
- Browser regressions share the UI store's typed persistence contract instead of stale preference names/versions, and live Roleplay tests stop their stream before deleting fixtures (#5897, #5928).
- Narrow desktop windows switch to the existing overlay navigation when the configured sidebar widths leave too little room for topbar buttons. Desktop Roleplay connection/persona pickers match the other input menus, Background drawers include help, and Achievements retain inner padding on desktop and mobile (#5916).
- Editors now show their sections in one continuous form, track the section being read, and save unsaved character, persona, lorebook and preset fields before leaving; failed saves keep the editor open. Media/library sections load when approached, pending saves honor the latest navigation, and newly added lorebook entries scroll into view (#5916).
- Background Library search and actions fit mobile screens, Default uses the accent color, and the selection marker no longer overlaps the drag handle. Settings mode options use the current rounded-square styling (#5916).
- Background choices save without a cancellable debounce and stay ordered, so a delayed earlier pick cannot undo a newer choice or Clear selection (#5916).
- Home Character Library previews use equal-sized cards without scrolling or extra action buttons. A card opens its full-library details; the widget body opens the library, and the Recent Chats widget body opens Chats without interfering with drag handles or individual chat cards (#5916).
- Hidden sidebar and Settings panels suspend their effects without discarding local state, mobile panel reopening no longer remounts every previously visited panel, and iOS library/sidebar overlays avoid live backdrop blur while keeping covered text behind opaque themed surfaces. Modals release their entry transform after opening to reduce retained compositing work; physical iPhone crash confirmation remains necessary (#5916).
- A Game turn that leaves no story text behind no longer blanks the narration panel (#5798). When the GM's reply was nothing but actions, or the game saved one of its hidden bookkeeping rows, the panel dropped the scene you were reading and fell back to its empty "send an action to begin the scene" state. The last turn you can actually read now stays on screen and the turn passes silently, the way a command-only turn already does in Conversation.

- Restored Character Editor sections to the same desktop topbar row as the name, avatar, and actions. Editor section buttons adapt their size and spacing before falling back to the existing compact menu on narrow layouts (#5905).

- Professor Mari's shell sandbox closes its two remaining supply-chain gaps (#5892). Installed-package folders (`node_modules` and the pnpm stores, nested ones included) are now read-only inside the sandbox - a command can no longer plant ready-made package code there - while build-tool cache folders inside them stay writable so builds keep working. And stopping a sandboxed command now takes its whole process tree with it, so a background process it left behind can no longer keep writing after the safety scan has run.

- Gemini and Anthropic replies no longer go silent whenever a tool is attached. Both connections held the whole reply back on a tool-using turn - the bubble stayed empty for the entire generation and then filled all at once. Text now arrives as the model writes it, and tool calls are read out of the live stream, including a reply that is nothing but a tool call. Gemini connections with thinking enabled still send the reply in one piece, for the separate, older reason they always did.
- Professor Mari's self-check now audits every step of a longer job, not just the last thing she says (#5819). In a batch - "I created the first character, now doing the second" - each claim is checked against the work done since her previous checked claim, so skipping a step gets caught immediately instead of riding an earlier success. When a step is missing she is told to look first and only redo work a check shows is truly absent, never blindly.
- Mari can answer "did you finish?" truthfully again (#5830). A run that only reported on earlier work could never satisfy the old check - her honest recap was challenged twice and then replaced with an error. A recap backed by a fresh look at the actual state now passes, a wrap-up right after checked work needs nothing extra, and "I've verified..." (describing a check, not a change) no longer trips the detector at all. A claim with nothing behind it whatsoever is still challenged, and a change the store observed failing still blocks every later claim until a retry proves it saved.

- Professor Mari's shell sandbox can no longer be used to slip a new dependency or launcher file past review (#5786). The sandbox's write protections only covered sensitive files that existed when a command started, so a command could create a brand-new `package.json` or installer file nobody reviewed. Every shell command is now followed by a scan: a dependency, launcher, installer, or workflow file it created or changed without review is put back the way it was and turned into a normal approval card for you to accept or reject. (Files inside `node_modules`-style package stores are outside this net by design - writing there was always allowed for builds - and the scan protects the manifests that control what gets installed.)

- Text-to-speech no longer freezes Safari (#5889). When Safari blocked playback for lacking a recent tap - which it does for autoplay, and even for the play button once fetching the audio took longer than the click - the app retried playing in a tight loop until the tab ran out of memory and froze. Blocked playback now waits quietly, shows a "tap anywhere to play" notice, and resumes on your next tap or keypress; on iPhone/iPad the audio kept in memory is also capped so long sessions cannot balloon Safari's memory.
- Mobile Roleplay Connections/Personas now uses the same themed surface as the character response picker. The Agents menu groups each agent's reports with its outputs, preserving dismissal, saved custom-output editing, and the separate Echo Chamber window (#5883).
- Mobile image previews now bound both dimensions, including tall illustrations, and large PNG metadata no longer bypasses previews. This reduces image-arrival decoding pressure without changing appearance settings or saved originals (#5870).

- Mobile chat illustrations and gallery tiles use smaller cached display copies to reduce image decoding pressure; opening and downloading still uses the original. Saved automatic Roleplay illustrations also appear as soon as they arrive, without waiting for remaining agent work (#5870).

- Conversation swipe menus now reuse Roleplay's compact, unboxed controls on desktop and mobile, with arrows and counters following the configured chat-chrome text color instead of pink/orchid styling (#5875).
- Released temporary rendering hints after message entrance animations, reducing unnecessary compositor layers around long, growing Roleplay replies without changing their animation or layout (#5870).
- Agent connection warnings and other notifications now use the selected accent for their border in light and dark themes (#5870).
- Illustrator-only manual and retried image requests now finish saving after a browser disconnect; explicit Stop still cancels them. Reopened chats refresh saved messages and gallery images when server-side generation finishes (#5870).
- Mobile Conversation and Roleplay message actions use compact icons and share one row across the available width, while keeping the larger desktop controls and saved swipe-menu preferences (#5873).

- Restored Professor Mari preset creation after adding preset-level regex defaults, and preserved those defaults during unrelated preset edits.

- OpenAI-compatible image connections preserve non-GPT models' requested dimensions; FLUX.2 requests retry once after an explicit dimension-limit rejection using the reported bound (#5861).
- OpenRouter routes Qwen Image 3 and Muse Image to the Images API and recovers when another image-only model explicitly rejects the chat endpoint (#5750).
- SillyTavern `{{original}}` placeholders no longer leak into prompts; saved character cards and literal instruction text are preserved (#5813).
- Import and other multipart uploads check CSRF access before sending file data (#5859).
- Illustrator limits passive avatar matching to the current chat and requires an explicit, unique full name for global-library characters (#5862).

- Fixed incorrectly encoded persona and character-identity avatar crops in chat, including existing message snapshots, without changing historical persona attribution (#5843).
- Preserved zero-padded times such as "0600. Wake up" as text instead of numbered lists (#5858).
- Refetched the open chat at the committed Messages per page size, including changes made while chat loading is paused, avoiding truncated history while editing the setting (#5796).
- Kept paused weather visible across mobile viewport changes and positioned its particles for the current viewport when rendering resumes, using the community resize fix linked by luma-inibitor (#5814).

- Stopping Marinara Engine can no longer hang for half a minute or more (#5838). Shutting down used to wait forever for open browser connections before saving and exiting - long enough that system watchdogs (SteamOS's low-memory guard, Docker) would give up and force-kill it, losing unsaved changes. The engine now cuts lingering connections after 4 seconds and, if the shutdown is still stuck, exits on its own after 8 - inside every watchdog's patience, with pending saves given their chance first.
- Kept user-message actions in the same left-to-right order as assistant-message actions (#5854).
- Mobile Roleplay keeps composer boundary drags inside the input, avoids animated press transforms on message actions, opens older-message editors at their beginning, and returns the reopened Echo Chamber to its latest message (#5851).
- Mobile galleries keep generation labels and image actions within their available width, use neutral Delete controls, and give the Local Speech Model selector consistent spacing. Desktop layouts are unchanged (#5851).

- Updated transitive Browserslist, query-string, and URI parsing dependencies to address their current security advisories (#5847).

- Context Circle rings now use the configured accent color while keeping a muted background ring for separation across light and dark themes (#5840).

- Marinara Engine no longer gets silently force-killed on Steam Deck during active use (#5838). Games claim most of the Deck's shared memory, and the server used to keep every opened chat in memory until the system killed it without a trace. On SteamOS the server now keeps at most 8 chats in memory by default - the same protection Termux already had. Set `MARINARA_MAX_RESIDENT_CHATS` to raise the cap, or to `0` to turn the cap off. Termux gets the same default built into the server as well, so a typo in the setting can no longer switch that protection off silently.

- Mobile message-action icons no longer keep an iPhone-only hover color after being tapped, and Peek Prompt now shows a readable middle dot between its section and estimated-token totals (#5825).
- Mobile chat overlays stay usable around the software keyboard: focused toolbar menus remain inside the visible viewport while editing, and chats with Echo Chamber leave enough top scroll clearance to keep Load More tappable below its collapsed window (#5817, #5822).
- The button that applies changes Mari is holding for your approval is no longer labelled as a suggestion (#5820). It sat under the caption "Suggestions only. Pick one, or type your own.", which told you the one control that applies her pending edits was optional - so it looked like she had quietly done nothing. The row now says she is waiting for approval and that nothing has been changed yet, and a "Don't apply" button sits next to Accept so declining is a click rather than a typed sentence.

- A file-storage writer lease left behind by a process that could not read a stable machine ID (`hostId: null` - every Docker and Podman container, plus Linux hosts without `/etc/machine-id`) no longer blocks startup forever after a host reboot or a force-killed process (#5744). When the data directory sits on storage only this machine can mount, Marinara now applies the same staleness proofs it already trusts for same-host leases (an earlier boot, the container liveness check, or an exited or reused process ID once the lease records the same process namespace) and reclaims the lease on its own; leases on network or otherwise shareable storage still require the manual removal the error message describes.
- The "Messages per page" setting is honored by the chat transcript again (#5789): Roleplay and Conversation chats kept at most 80 messages on screen no matter what the setting said, so a value of 100 still showed 80 and 0 ("load all messages at once") still hid the older part of the loaded history behind "Show older" controls. A page size above 80 now widens the on-screen window to match, and 0 shows every loaded message; the default of 20 behaves exactly as before.
- Character Editor desktop navigation now uses the full section rail again, while mobile keeps the compact section dropdown.
- Three more ways Professor Mari could believe a change happened when it didn't are closed (#5776, #5777, #5778): a `mari` command she runs in the terminal without `--apply` is a preview and now clearly reports itself as one, so she can't treat it as a saved change; a terminal command that would write to a protected file (like `package.json` or workflow files) is now refused up front with directions to the approval flow, instead of failing silently inside the sandbox and looking successful; and editing a shortcut (symbolic link) that points at a protected file now asks for your approval just like editing the file directly - including links whose target doesn't exist yet, which also can no longer point writes outside the workspace.
- Professor Mari's self-check no longer mistakes a change that is waiting for your approval for one that was applied (#5756): a sensitive file change she stages behind the approval card now counts as pending, so re-reading the unchanged file can't satisfy her verification step and she won't report the change as done while it still needs your OK - including when the same reply also made ordinary changes that did apply. If she does claim a staged change is finished, she is corrected to say it awaits your approval instead of being told to redo it, re-staging the identical change no longer stacks duplicate approval cards, and the Support Diagnostics record reports such a round as held rather than applied. The pending-change marker is also checked in a way her own text can't imitate. Thanks to @mikemikimike for the original fix in #5757.
- Agent and chat requests for GLM 5.3 (not only GLM 5.3 Flash) no longer fail with "This model always engages in thinking and cannot be disabled": native Z.AI connections now send the documented `thinking.type: "enabled"` with the effort mapped to `low`/`high`/`max`, NanoGPT and OpenRouter keep the model's mandatory reasoning, and a reasoning-off request becomes the lightest level instead of a rejected disable (#5765).
- Lorebook entries are no longer inserted twice when a preset has more than one lorebook marker (#5716): each world-info position (Before / After) is now placed by the first marker that covers it, so a second "Lorebook Marker (All)" placeholder - or an "All" marker following a "Before" marker - no longer repeats the same entries in the prompt.
- Mobile connection drag previews now retain the configured Chat Chrome Text Color, and the Roleplay quick switcher context progress bar follows Accent Color (#5758).
- Professor Mari's applied edits now verify themselves (#5754 follow-up, proposed by a community reviewer on the issue): after every applied app-data mutation the engine re-reads the affected rows from the store and compares them against what the change asserted, and the result carries that read-back. A store-verified write needs no separate verification read at all - and a mismatch is surfaced loudly as a possible persistence failure instead of being smoothed over: once the store observes a failed write, Mari cannot report success for that run until a retry actually lands, and she is coached to tell you plainly what failed. Only the store-observed check ever counts as verification; bash and file writes keep the confirmatory-read requirement unchanged.
- Professor Mari's panel header no longer overflows into her avatar at phone widths (#5741): Skills and Memories now share one "Skills & Memories" button with a two-row menu (per-row badges preserved), and the combined label collapses to its icon below 430px.
- Starting a fresh Professor Mari chat is now discoverable (#5752): the header button is called "New chat" (it always archived the current conversation to Chats - the old "Restart" label just said the opposite), and the Chats popover gained a "+ New chat" button right where people look for one.
- Professor Mari's suggestion chips no longer vanish from unrelated activity (#5753): a regular chat starting a generation only clears chips/plans that belong to that chat, and the suggestions-disabled mount sweeps - which wiped even the held-proposal Accept chip the delivery path deliberately exempts - are gone (rendering already respects the setting).
- Professor Mari verifies her edits without the "Oops, my bad!" round (#5754): she is now taught to stage the confirmatory read in the same response as the write (commands run in order, so that satisfies verification with no extra round), and the verification coaching tells her to check matter-of-factly - never as an apology for a mistake she didn't make.
- Professor Mari can no longer answer her own permission question (#5748): once she asks whether to apply a change, that question is binding for the rest of the run - any edit she stages afterwards is held behind the Accept action instead of executing, and a hidden follow-up edit is refused with guidance. Previously an ask that rode alongside an `apply:false` preview left the engine nothing to hold, so she could pivot to applying unasked one round later ("to show you the review card"). Dry-run previews now tell her, truthfully, that the user cannot see them, and "propose your edits" maps to one described-and-held proposal instead of a preview plus a second full generation.
- Professor Mari no longer dies when the window loses focus (#5719). Her server-side run always survived backgrounding - what failed was the client: unlike regular chats, it treated the browser tearing down a hidden tab's connection as a hard error ("Professor Mari could not answer right now"), and a cleanly closed socket produced a false "did not receive a reply", in both cases never reloading the reply the server went on to persist. Mari now uses the same passive-disconnect recovery as regular chats (shared classifier, hidden-page tracking, wait-for-settle then reload), a no-reply stream close is confirmed against the workspace status before any error is shown, and a run that finishes while the client is detached - stream killed, or Mini-Mari closed and reopened - is reloaded automatically by the status poll instead of staying invisible until a manual chat switch.
- Professor Mari no longer does every requested edit twice (#5721): the server-side authorization gate added after #4838 - which rejected intent-phrased requests ("rework her personality to be more cynical") until the user typed an approval, then made Mari regenerate the identical change into the review window - is removed. An intent-authorized edit now lands directly in the existing Keep/Restore review card: one generation, one confirmation. #4838's intent-keyed read-only guidance and Mari's own ask-first deferral (with its Accept chip) are unchanged, and users who want Mari less forward can pin a saved memory saying so - Mari is now also instructed to notice a repeated mismatch herself (e.g. a user whose "propose changes" means "describe them in chat") and offer to save that preference as a disabled-until-enabled memory.
- Professor Mari's plans and questions no longer vanish into hidden reasoning on local custom connections (#5721): the hidden-reasoning disable that protects her JSON command protocol now covers custom providers pointed at local inference servers (llama.cpp, vLLM, Ollama, LM Studio - e.g. Unsloth-served GGUF builds), so the model answers in the visible reply instead of burying its brainstorming in the reasoning channel. Remote custom endpoints are deliberately untouched - strict gateways reject unknown reasoning parameters - and a local endpoint that still chokes can opt out by disabling the reasoning-effort parameter on the connection.
- Agent Home icons and client surfaces no longer disappear after an update while the new server runtime waits for restart; the Engine keeps serving the verified files from the version that remains active until restart applies the replacement (#5715).

- Closed two residual transaction-isolation gaps in the file-backed store found by the #5631 verification pass: a transaction rollback can no longer erase rows that a concurrent request lazily loaded mid-transaction (the load's snapshot mirror and healing marks now reach the active transaction's context regardless of which request performed the load, so cold chats opened during a failing transaction stay visible instead of vanishing until restart, #5651); and the transaction opening's flush wait is now a loop instead of a check-once, so a double-flush ordering can no longer let the transaction callback run concurrently with a fresh flush's I/O and persist uncommitted rows to disk with no dirty mark left after rollback (#5652). Both are pinned by a staged concurrency regression proven to fail on the unfixed code. An adversarial review of the fix surfaced two adjacent defects in the same class, closed in the same change: `flush()`'s own wait on active transactions was also check-once (reachable during shutdown, where the post-transaction flush handoff is deliberately skipped, letting flush I/O run concurrently with the next transaction's callback), and the snapshot mirror refilled the rollback snapshot with a spread call that overflows the call stack past ~100k rows — throwing after the snapshot was truncated, so a later rollback could install an empty messages table. Both are likewise regression-pinned.

- Dev and e2e server instances can no longer rewrite the developer's working repo through the browser (#5646): `pnpm dev` and the Playwright launchers now set `UPDATES_APPLY_DISABLED`, a new hard refusal that beats both `UPDATES_APPLY_ENABLED` and the loopback channel-switch bypass, and the apply route additionally refuses any checkout sitting on a development branch — previously one click of the channel selector against a dev instance stash-and-checked-out the working repo and force-rebuilt it underneath running sessions. The Settings panel explains both refusals instead of suggesting the enable flag.
- The manual-update instruction is now a complete copy-paste recipe that Windows testers can actually run (#5645): it leads with `cd` into the detected install folder (`cd /d` on Windows, so it crosses drive letters), and the hint tells Windows users to run it in Command Prompt or Git Bash — the default Windows PowerShell rejects the `&&` chains, which previously produced a wall of parser errors and ran nothing.
- The client no longer hangs indefinitely against a frozen server (the Android/Termux cached-app-freezer state where connections open but are never answered): the chat-open fetch now times out after 15s into an explicit "Server unreachable" state with a Termux-foregrounding hint instead of an endless "Opening chat..." spinner (#5657), the version check's health fetch gained a deadline and an in-flight guard so tab-switching against a frozen server can no longer leak pending requests until the browser's per-host connection pool saturates (#5658), and the Support Diagnostics health query times out — re-enabling the copy button — with server fields reading "Unreachable (request timed out)" instead of an indistinguishable "Unavailable" (#5657). `docs/TROUBLESHOOTING.md` now documents the freeze signature and no longer claims `termux-wake-lock` needs the Termux:API add-on — it ships in core `termux-tools` (#5659).
- iPhone keyboard focus now keeps the entire app and shared dialogs aligned with the visible screen across repeated keyboard open and dismiss cycles instead of panning Roleplay, Create Character, or Create Persona into the dark document backing; iOS surfaces no longer inherit a fixed body and follow the visual viewport in document coordinates. Roleplay also releases its inactive full-resolution background after each crossfade and avoids unused full-viewport compositor hints, reducing persistent WebKit visual memory (#5710, #5711).
- Character library and omnibar searches now share a generation-aware in-memory character catalog, so list views do not repeatedly scan and transfer complete character cards.
- Fixed character identity prompt previews, imports, gallery participant handling, and quick-menu scrolling and bounds.
- Fixed character identity profile routing, prompt macro resolution, sprite subjects, memory naming, and lorebook scan context.
- Fixed NanoGPT lorebook vectorization by sending the authentication header required by its embedding endpoint (#5688).
- Fixed NanoGPT agent requests so an explicit reasoning-off setting sends `reasoning_effort: "none"`, while preserving mandatory reasoning for GLM 5.3 Flash (#5582).
- Preserved historical user names and portraits across identity switches.
- Termux startup no longer prompts for GitHub credentials during public update checks; failed checks now continue with the installed version.
- Mobile Roleplay now keeps its full composer controls visible while scrolling through chat history instead of replacing them with a simplified text field (#5685).
- Available app updates now wait for an explicit refresh instead of silently reloading active sessions, and Roleplay avatars no longer request persistent compositor layers, reducing iPhone WebKit memory pressure (#5686).
- Character-backed chat identities now resolve consistently in macros and show searchable character names and descriptions in the quick pickers.
- Quick identity pickers now keep their empty messages accurate and non-duplicated when hidden characters match a search.
- JSON agents now preserve mandatory reasoning for GLM 5.3 Flash on OpenRouter and NanoGPT instead of sending a reasoning-disable request that those providers reject (#5582).
- Context usage now includes Anthropic prompt-cache input tokens, so the displayed active context matches cached long chats.

- Illustrator image downloads in the installed iPhone app now open the dismissible iOS share sheet instead of stranding the user in WebKit's full-screen file preview; choosing Save Image writes to Photos and returns to the still-open Marinara lightbox (#5681).
- Firefox on Android no longer shows the empty band above the system navigation bar on the surfaces the earlier shell fix did not cover — full-screen mobile modals, the chat settings and gallery drawers, the setup wizards, game overlays (character sheet, inventory, narration, readables), the selection action bar, the browser hub, and the floating call/launcher buttons: every remaining bottom safe-area consumer now honors the engine-specific override that zeroes Gecko's misreported inset (#5667).

## [2.4.5]

### Added

- Guided package onboarding can open the active Roleplay chat's Summary popover and assigned prompt preset Sections editor directly.
- The server now notices when it stopped running for a stretch — consistent with the host suspending it (the Android/Termux background freeze that shows as an endless "Opening chat…" until Termux is foregrounded, or a laptop sleeping) or with a severe internal stall — and logs the estimated length on thaw, so session logs carry positive evidence instead of nothing (#5655).
- The Termux launcher reports its Android wake-lock outcome to the server, and both the health endpoint and Copy Support Diagnostics now include the wake-lock status and the most recent detected freeze; a failed or unavailable wake lock is announced with a prominent launcher warning that names the fix (`pkg install termux-tools`, battery set to Unrestricted) (#5656).
- Capability API 1.15 adds `runtime.resolveEmbeddings()`, allowing packages to use the current package-specific or global embedding connection without reactivation while preserving the static embeddings host for older packages.
- Stored guidance now provides copy actions for guided directions, impersonation directions, and impersonation prompt templates, with distinct replayable command and verbatim template payloads.
- File-native storage format advances to version 6, pairing `STORAGE_VERSION` and `storage-format.json` so the launcher downgrade guard correctly rejects rollbacks to builds that do not understand the new sharded layout and writer-lease ownership model.
- Chat connection switchers can now show the latest measured context usage in their popup and around the connection button, with Game usage available under Chat Settings > Connection. The display is enabled by default and can be controlled in Advanced settings (#5577).
- Character card sprites can now be renamed after upload without replacing the image (#5575).
- Character cards now support editable metadata summaries, AI-generated summary drafts, and Character Library previews that use the saved summary when available.
- Character card Conversation profiles now provide controls to generate About Me and Conversation behavior text from the card's available information.
- The Home Character of the Day widget now uses saved character summaries and offers direct chat-start and character-view actions.

### Changed

- Lorebook entry embeddings now live outside the JavaScript heap as packed vectors, the same treatment Memory Recall chunks received — vector-heavy lorebooks stop occupying heap strings while resident, with no change to the on-disk format (#5592).
- Sending a message no longer clones the whole resident message table: storage writes now share unchanged row objects between array versions (rows are immutable once stored, all mutations replace), removing the largest remaining per-message allocation spike on big profiles and shrinking transaction snapshots from full row copies to reference arrays (#4730, #5592).
- The server can now cap how many chats stay in memory at once: set `MARINARA_MAX_RESIDENT_CHATS` and, past the cap, the least-recently-used chat with no unsaved changes is dropped from memory (never from disk) after each save and reloads transparently when next opened. The Termux launcher defaults the cap to 8 to protect phone memory; everywhere else it is off unless set. Hot storage-layer writes are now also scoped by their owning chat so an eviction mid-request degrades to a reload instead of a whole-table load (#5592).
- Chat-scoped storage tables (messages, swipes, Memory Recall chunks, game state, call logs, and the other per-chat tables) no longer load into memory at startup: each chat's data loads as one unit the first time that chat is touched and every query, write, and cascade is scoped to the units it can actually reach — the main memory reduction for long multi-chat profiles on Termux and other low-memory devices. Full-table operations such as backups still load everything they need automatically, and setting `MARINARA_EAGER_STORAGE=1` restores the previous load-everything startup (#5592).
- Stale in-progress game storyboards are now recovered per chat when that chat's storyboards are next read (including everything left over from before the current server start), replacing the startup-wide sweep (#5592).

### Fixed

- Mobile Roleplay and Game message numbers now follow Chat Chrome Text Color, and Marinara preset import and save/export feedback follows the active accent instead of fixed theme-independent colors (#5679).
- Mobile Roleplay now clears Trackers, Echo Chamber, and other agent windows while the composer is active; the app-owned composer chrome is shorter above the software keyboard; and Conversation and Roleplay message editors leave enough trailing scroll space to reach their final lines without first changing the text (#5672).
- Roleplay context usage now follows the configured chat chroma text color; mobile message editing temporarily clears agent overlays while keeping message controls available; and the Characters and Personas libraries now use concise search copy, full-width sorting fields, and a consistent action layout (#5648).
- Firefox on Android no longer shows a large empty band above the system navigation bar that obscured the bottom of the Agents, Connections, Presets, and chats panels and pushed the chat composer up: Gecko reports the navigation-bar height as a bottom safe-area inset even though its viewport already stops above the bar, so the app now zeroes its bottom safe-area padding on that engine instead of double-compensating (#5665).
- The Roleplay composer's trigger-group-response and translate-draft buttons on mobile no longer render oversized next to the send button: they now match the attach and send buttons' size, bringing the trigger and send icons closer together and returning the freed width to the typing area (#5649).
- Chat settings no longer silently revert when a slow background request finishes after a newer edit: responses that carry a chat snapshot (clearing the unread badge, saving summaries, applying a settings profile, game party changes, and similar) used to overwrite the whole cached chat, flipping a just-toggled setting back — and hiding the settings section it controls — until the app was reloaded. Snapshot responses now merge through the same per-field protection that guards ordinary settings edits, so the newest change always wins (#5641).
- Numeric settings fields no longer silently lose an edit typed while a previous change in the same field was still saving: the echo of the earlier save could overwrite the value mid-typing, and a panel re-rendering at the wrong moment could discard the edit without saving anything. In-progress typing is now protected and a pending edit is committed even when its input is torn down — this covers every numeric field built on the shared draft input (agent run intervals, connection and preset editors, game sheets, and the rest) (#5636).
- Profile preview uploads now remain available until they are imported, cancelled, or the server stops instead of expiring after 30 minutes and forcing another upload (#5624).
- Opening a Game chat on a tablet or a narrow desktop window no longer leaves the HUD widget rails sitting over the dialogue: when the custom widget state finished hydrating while the transcript was still loading, the layout was measured before its surface existed and no resize observer was attached, so it never compacted on its own and only recovered if the window happened to be resized (#5654).
- Profile imports now upload and scan the selected JSON or ZIP only once, reusing the reviewed server-side preview when import is confirmed; an unsupported or corrupt individual asset is skipped and reported as a warning while the rest of the valid profile continues restoring (#5624).
- Profile ZIP import and export no longer impose archive, individual-asset, or restored-total byte ceilings, and native character, persona, PNG card, and CharX imports no longer reject otherwise valid image galleries by byte size; paths, media contents, and archive structure remain validated, while profile executable content stays quarantined (#5624).
- Full profile backup restores no longer fail on the game-asset seeder's own empty `.native` directory markers: import now tolerates exactly that marker (empty and dot-prefixed) under `game-assets/` while still rejecting any non-empty file using the marker name, so a stock export restores cleanly on a fresh install (#5619).
- The Termux launcher's default Node.js heap now budgets roughly twice the on-disk structured profile plus headroom, bounded by one quarter of known device RAM — never below the 1 GiB baseline on low-RAM devices — or 1536 MiB when device memory cannot be read, so large profiles that ran within the pre-2.4.4 2 GiB default regain comparable headroom instead of exhausting the JavaScript heap and aborting with status 134 at the former 1536 MiB ceiling, subject to those device caps; small installs and low-RAM devices keep their bounded 1 GiB baseline, and explicit `NODE_OPTIONS` limits remain authoritative (#5585).
- Deleting a gallery image no longer makes the whole chat-image table permanently memory-resident: the shared-file reference check ("does any chat still use this picture?") now answers from resident memory plus direct reads of the on-disk chat files, loading a chat into memory only when its file needs repair — so the chat memory cap keeps holding after image deletions, and shared files are still only removed once the last chat lets go (#5613, #5592).
- Startup no longer loads every chat that has gallery images into memory: the orphaned-image recovery scan reads each chat's image records straight from disk and only loads the chats that actually have a file to re-register or a record needing repair, removing a hidden startup memory spike on image-heavy profiles (#5612, #5592).
- Game-mode tracker updates, swipe deletion, checkpoint captures, and gallery lookups no longer quietly convert their storage tables to permanently memory-resident: the remaining queries that could not name their owning chat now do, so the chat memory cap keeps holding through ordinary Game-mode play. Deletion-style endpoints that identify their target only by id now accept an optional owning-chat hint the client can start sending (#5611, #5615, #5592).
- A storage file whose content is valid JSON but not the expected shape (for example `{}` where a list of rows belongs) is now treated as corruption: it recovers from its backup when one exists and is quarantined for manual recovery otherwise, instead of silently loading as an empty chat while a healthy backup sat unused (#5601).
- A transaction rollback no longer strands a storage self-heal mid-flight: a chat whose shard file held another chat's misfiled rows could lose those rows' only on-disk copy when a rolled-back request had loaded it, because the healing rewrite ran without the paired shard writes. Rollback now re-merges load-created healing marks so the repair stays atomic (#5606).
- Memory Recall embeddings now live outside the JavaScript heap as packed vectors — the largest single memory block for long roleplay profiles on phones — and recall scoring reads them directly instead of re-parsing JSON per chunk, without changing the on-disk storage format (#5592).
- Message swipe reads are now scoped to the requested chat instead of scanning every chat's swipes on each message list, made possible by resolving list-membership filters once per query rather than per row — the cost that originally motivated the unscoped scans (#3402, #5592).
- The file store's count queries, single-table selects, boot ordering, and emptied-shard cleanup now share hardened iteration and positive-evidence semantics, groundwork pinned by regressions for the planned partial-residency work (#5592).
- Linux and Termux now reclaim a same-host file-storage writer lease from an earlier device boot even when the operating system has reused its recorded process ID (#5580).

- Avatar generation now preserves the complete user Avatar Prompt, and OpenRouter caching remains enabled for eligible unknown models (#5552, #5574).
- Permanent Delete now preserves Marinara's stock Universal Preset and its prompt structure while removing editable presets (#5568).

## [2.4.4]

### Added

- The built-in Local Model can now be the default connection for agents - selectable in the Connections panel's defaults section without a stored connection row - and the Agents panel gains a bulk action that points every agent (or resets every agent to the agents default) at any connection in one step (#5539).
- The in-app What's New notice now presents the complete v2.4.4 release story with inline Help, Memory Nag, and Roleplay thinking media (#5528).
- Hosted release validation now runs the complete Node regression suite and covers desktop Chromium, Android-sized Chromium, and iPhone-sized WebKit independently on pull requests and staging pushes (#5518, #5520).
- Download Agents can now filter the existing Writer, Tracker, and Misc sections by Conversation, Roleplay, or Game support, and a Discovery Desk recommendation opens its exact Agent instead of the catalog's first entry (#5494, #5500).
- Game HUD widgets now expose their unique model-facing ID for editing after creation (#5477).
- Professor Mari's structured `app_data` helper can now list, search, inspect, and read bounded message ranges from chats without falling back to raw database commands (#5476).
- Staging-channel Engines now merge the Agents catalog preview overlay over the published catalog, so packages marked staging-only in the Agents repository reach testers while stable Engines never resolve the overlay URL at all and the unattended startup migrations never auto-install one (#5492).
- Implemented {{lorebookSize::lorebookID}} macro, which resolves to the total number of entries inside a lorebook, when given its unique ID (#5464)
- Game Setup now includes an on-by-default Quick Time Events switch; turning it off removes the timed-reaction command from GM prompts for that campaign (#5467).
- Custom Agents can now opt into proposing complete character cards, which remain editable and require explicit approval before they are saved to the Characters library (#5456).
- Active Memory Nag packages now get a standalone Roleplay Agents settings section; inactive Memory Nag remains in Tracker Agents for initial setup and tracker scheduling (#5440, Pasta-Devs/Marinara-Agents#518).
- Pull requests and scheduled security audits now run the focused import, sandbox, host-authentication, and runtime-integrity regression lane, while the new security policy provides private vulnerability reporting without changing Marinara's local-first capabilities (#5436).
- Game setup's Review Starting Widgets step can now add, rename, re-icon, retype, duplicate, and fully edit proposed widgets before the first turn (#5426).
- Roleplay and Conversation message deletion can now keep the selected swipe and delete every alternate in one action (#5380).
- The chat Help overlay and its App Behavior visibility setting are now localized in Arabic, German, Spanish, French, Hindi, Japanese, Korean, Polish, Brazilian Portuguese, Russian, and Simplified Chinese (#5420).
- Game-surface Experience packages that keep a save in both the engine's per-message experience-state row and a chat-metadata boot cache can now tell which copy is newer: one server-assigned per-chat write ordinal is shared by both stores, returned as `writeOrdinal` on `PUT`/`GET /api/game/:chatId/experience-state` and mirrored per metadata key as `metadata.metadataWriteOrdinals`, so a session that degraded to metadata-only writes is recovered at the next boot instead of being discarded (#5406).
- Game-surface Experiences can now offer players explicit save management: a package can delete the chat's stored experience saves, export the whole campaign, and import an export back, all scoped to that chat's own experience namespace and safe for existing checkpoints (#5405).
- Downloadable Roleplay trackers can now contribute their own Chat Settings, HUD, and Tracker Panel views, prepare validated per-turn runtime context, finalize structured results, and place package-owned prompt blocks through preset Agent sections. This enables the new Memory Nag package and its per-chat vault (#5408, Pasta-Devs/Marinara-Agents#511).
- Lorebook Folders now have a 'select/deselect all inside folder' button during Batch Editing (#5413).
- Game-surface Experience packages now receive the raw stored text when a saved world state fails to parse, so a damaged save can be quarantined for recovery or a bug report before the repairing write replaces it (#5407).
- Professor Mari can now create nested lorebook folders through her existing lorebook commands, and lorebook-capable custom agents can opt into sequential, configurable history-backfill chunks with explicit target selection (#5391).
- The Roleplay Summariser can now select every entry and delete the current multi-selection in one confirmed action while safely restoring message visibility (#5394).
- Roleplay Appearance settings can now place model thinking in a collapsible field above each response, stream it live, optionally keep it expanded, and style its stable disclosure header with Chat Chrome Text Color (#5381).
- Conversation, Roleplay, and Game chats now provide a responsive Help overlay that labels available chat controls, opens automatically after the first chat setup in each mode, and can be reopened from the toolbar or hidden permanently from the overlay or App Behavior settings (#5390).
- Fresh Professor Mari chats on Home now explain how to select a connection until the first message is sent (#5375).
- Online character browsing now provides an exact page selector alongside the current page and total (#5361).
- Character, Persona, Lorebook, and Preset editors now place section navigation in the header, using compact desktop tabs and a mobile dropdown, and Conversation Chat Settings now keeps Commands, Illustrator Settings, and Calls as matching remembered collapsible subsections inside Agents (#5355, #5356, Pasta-Devs/Marinara-Agents#480).
- Settings → Generation now exposes the Character Reference Sheet prompt template, so character and Persona sheet generation can use a saved global override (#5348).
- Reusable Game Mode setups now preserve World Maps AI draft size, exact place target, and lore grounding choices, with a clear fallback warning when imported lorebooks are unavailable (#5337).
- Custom pre-generation agents can now opt in to choose the active characters for the current Conversation or Roleplay reply, keeping unused character cards out of that turn's prompt (#5310).
- Lorebook Keeper can now route entries to exact writable lorebook names or configured aliases, auto-create missing category books, and preserve the selected destination through write approval while keeping one-book behavior unchanged when no target is returned (Pasta-Devs/Marinara-Agents#439).
- File-native storage now shards every registered table by its stable owner or primary key, so routine saves no longer rewrite any global table monolith; upgrades preserve the previous files and retain the existing crash, corruption, and downgrade recovery safeguards (#5302).
- Chat Settings now shows the current chat ID with a one-click copy action, making exact chats easy to reference in Professor Mari and other tools (#5235).
- Conversation and Roleplay automatic summaries can now keep recent summaries in context while semantically retrieving relevant older summaries for long-running chats (#5240).
- Text Rules now has an opt-in "Color Character Names in Text" toggle that colors character names inline in message text using each character's assigned name color, with support for gradient colors, name aliases, and a "Force Solid Colors for Inline Names" sub-toggle for users who prefer simpler inline readability. Names inside dialogue quotes are skipped, and only characters added to the chat are eligible (inspired by the AI Dungeon "Dungeon Extension v2" extension) (#5321).
- Added `nai-diffusion-5-full` and `nai-diffusion-5-curated` to `IMAGE_GEN_MODELS` in `model-lists.ts` with display names "NAI Diffusion 5 Full" and "NAI Diffusion 5 Curated" (#5343).

### Fixed

- Release validation no longer crosses the Noodle background-admission idle boundary when the regression runner advances between two live clock reads (#5545).
- Chat Help now keeps the message-area highlight below visible toolbar controls and measures controls from the active chat surface (#5545).
- Opening Professor Mari from Home no longer crashes Safari/WebKit while resolving inherited chat chrome colors (#5545).
- Release browser validation now reopens the mobile Characters panel after a reload instead of mistaking its off-screen mounted shell for an open panel (#5543).
- Agents that must return JSON no longer fail with "invalid JSON" on the built-in Local Model: sidecar responses are grammar-constrained to a JSON object, leading thinking blocks are stripped before parsing, and Gemma 4 string delimiters are normalized the same way the tool-call path already tolerates (#5537).
- The Connections panel's Local Model card now expands and collapses from a header click in every state, so the tracker assignment action is no longer reachable only through the chevron once the model is downloaded (#5538).
- Manual and tracker Agent reruns now prepare and validate downloadable capability Agent runtime context, so Memory Nag receives real vault candidates before choosing a memory (#5531).
- Capability-package agents now publish post-processing results only after package validation, and package-defined built-ins can request a compact context instead of inheriting every lore source, so rejected or distracted tracker output cannot reach the browser as successful data (#5525).
- Professor Mari no longer rejects an explicitly requested character/persona/lorebook create or update as unauthorized when her own quoted authorization excerpt is a valid but incomplete substring of the user's message (e.g. just the character's name) or when a long pasted document (like a character card) happens to contain the word "authorized" among ordinary narrative verbs.
- Professor Mari no longer blocks German-language create/update requests ("Erstelle...", "Ändere...", "Aktualisiere...", etc.) as unauthorized, and no longer mistakes quoted example dialogue in a pasted character card (e.g. "Don't tell me it's nothing.") for the user explicitly denying the requested change.
- Professor Mari no longer mistakes an ordinary narrative sentence deep inside a long pasted character card (e.g. "Juli should never feel like a quest objective") for the user denying the requested change; the denial check now only scans the leading and trailing edges of long pasted messages, where a real user instruction actually appears.
- Download Agents mode tags now keep identical dimensions when selected, and the installed Agents sidebar reuses the same filters below New Folder for Conversation, Roleplay, and Game Agents (#5523).
- Help overlays now align compact desktop highlights exactly with their toolbar controls at responsive widths and keep mobile toolbar controls visible while people inspect highlighted sections (#5521).
- Fixed the open-issues regression lane crashing at import time because a directly loaded client utility used the browser-only `@/lib` path alias (#5516).
- Official release workflows now reject tags that do not match the canonical app version, avoid retaining checkout write credentials, and run CodeQL for both staging and main-targeted pull requests (#5510).
- Matched character, persona, and agent tags plus chat branch counts to the shared compact search-tag shape instead of capsule badges.
- Unified Quest Board, Memory Nag, and Beholder surfaces, separators, and responsive typography with the rest of the Roleplay Tracker Panel.
- Unified inactive Roleplay tracker toolbar icons at the shared muted chroma strength and removed the stray count punctuation from the mobile Characters heading.
- Download Agents now shows each package's supported chat modes directly in the mobile catalog list, while mobile shell panels cap malformed browser safe-area values so Android Firefox cannot hide the bottom of the list behind a large empty inset (#5507).
- Roleplay group chats now retain their response controls and generation behavior when only one character is enabled, while Sequential generation skips every disabled character (#5501, #5502).
- Game narration now restores choices after rewinding or switching swipes, scopes saved narration progress to the active swipe, and restarts safely when a saved cursor exceeds the available segments (#5474).
- The Roleplay active-summary and branch counters now share one themed badge treatment with the configured accent color (#5499).
- Matched full-body sprite generation now sends each expression as its own sequential request after neutral approval, giving every image an independent timeout and retry while preserving completed sprites if a later expression fails or the run is cancelled (#5497).
- Tracker launchers and panel sections now share animated theme colors and one section shell; populated Inventory launchers show only their count, Inventory items and branch counts use the character-tag pill shape, and Memory Nag receives working regenerate and lock controls. Mobile Agents and Help overlays now stay centered and evenly framed, while shared agent selectors—including Music DJ in Roleplay and Game—center their contents (#5495, Pasta-Devs/Marinara-Agents#560).
- Chat Settings now reuses shared action controls without dimming unrelated Connected Chats options during saves; Storyboard controls align evenly; mobile Home tabs collapse inactive labels; the centered mobile Agents menu and combined Trackers panel use consistent count-free sections; the mobile Help overlay keeps uniform toolbar highlights; Inventory and branch tags use compact rounded-square styling with usable delete controls; and Tracker Panel, empty Inventory, World State, and Beholder launchers follow cycling accent colors (#5490, Pasta-Devs/Marinara-Agents#555, Pasta-Devs/Marinara-Agents#557).
- Roleplay tracker controls now keep World State compact until it has content; Persona Stats, Inventory, Quests, and Custom popovers share the established header order, styling, accent treatment, and count-free titles (#5488, Pasta-Devs/Marinara-Agents#549).
- Adding Memory Nag to a Roleplay chat now explains how to create its initial memories, then opens and scrolls to its Agent Settings menu after confirmation (#5484).
- Download Agents now styles its trusted-code permission notice with the configured accent instead of a hard-coded amber warning box.
- Fixed the dev server and Playwright webServer failing to start on Windows with standalone pnpm installs: the pnpm runner now detects that `npm_execpath` points at a native `pnpm.exe` binary — which Node cannot execute — and falls back to invoking pnpm through `ComSpec` instead of crashing with `SyntaxError: Invalid or unexpected token` on the PE header.
- Profile imports now keep only the local canonical Universal Preset protected; imported copies retain their content but remain editable and deletable (#5469).
- Game creation now reports unreachable, refused, timed-out, and other GM provider failures with actionable messages instead of a bare internal-server error (#5466).
- Termux now selects a bounded 1–1.5 GiB Node.js heap from the structured profile size and device RAM while preserving explicit operator overrides; health checks, copied support diagnostics, and logs expose heap pressure for Android background failures (#5470, #5506).
- Automatic backup failures can no longer trigger a second unhandled rejection while recording their error state (#5512).
- Prompt assembly only scans every lorebook entry count when a `lorebooksize` macro is actually present, reducing per-turn memory and GC pressure without changing macro behavior (#5513).
- Personal server extensions receive a fresh heartbeat window after the host process resumes from a system-wide pause, preventing a delayed watchdog tick from killing a healthy sandbox (#5514).
- Conversation autonomy and Game agent controls now use the shared toggle design; automatic-summary, Discord Mirror, Illustrator, Prompt Preset, and widget controls reuse canonical fields and actions; muted Game audio follows the configured accent; journal entries can be deleted after confirmation; and Stop Agents cancels every attached or detached agent run without flickering or aborting the main response (#5463).
- Tracker Panel now keeps Inventory above Custom and uses the configured app accent for its frame and dice controls; Group Chat's Add Turn To Prompt setting now uses the shared toggle and muted off-state; branch counts use the compact rounded-corner tag shape instead of capsules; Conversation places Start Call beside the character or group name; and Markdown horizontal rules follow the surrounding message text color instead of the legacy border tint (#5462).
- Character and Persona editors now switch to their compact section menu before constrained Windows layouts can crush toolbar buttons together, and the menu trigger matches neighboring action heights on desktop and mobile (#5460).
- Roleplay now places Beholder directly beside Tracker Panel before Agents, groups Inventory and Memory Nag into the combined mobile tracker control, and preserves full mobile touch-target bounds in the chat Help overlay (#5457, Pasta-Devs/Marinara-Agents#533).
- Downloadable Roleplay tracker buttons now keep the built-in mobile size; Memory Nag and Inventory headers inherit the neutral Tracker Panel icon treatment; Gallery and Translation language fields reuse the standard chat field; active agent drawers omit redundant installation instructions; Storyboards toggles and Lorebook Keeper actions align evenly; Long-Term Memory uses its archive icon in every mode; and Narrative Director and Expression Engine have distinct clapperboard and theatre-mask icons (#5452, Pasta-Devs/Marinara-Agents#528, Pasta-Devs/Marinara-Agents#530, Pasta-Devs/Marinara-Agents#531).
- Roleplay tracker controls and Chat Settings now share canonical ordering, icons, labels, toggles, fields, badges, and compact actions; Memory Nag and Beholder integrate with the Tracker Panel, while Persona Stats no longer duplicates Inventory Tracker ownership and dedicated inventory changes continue filling the journal (#5450, Pasta-Devs/Marinara-Agents#525).
- Image Connection model controls now stay inside narrow Android viewports, and long message editors expand to their content on desktop while retaining the mobile height cap (#5447, #5448).
- Downloadable Roleplay trackers now receive the shared left-side toolbar control styling in full and compact layouts, while Present Characters consistently uses a silhouette icon instead of character emoji (#5445, Pasta-Devs/Marinara-Agents#523).
- Chat Settings now reuses one compact action, toggle, and segmented-control design across agent menus; World Maps, Beholder, Storyboards, Long-Term Memory, and Memory Nag have standalone active-agent cards, while Impersonate prompts use the standard expandable macro field (#5443, Pasta-Devs/Marinara-Agents#521).
- Memory Nag now shows its Roleplay badge in Download Agents, while capability-package regression coverage tracks the API version required by its runtime (#5438).
- Professor Mari now shows a one-click Accept action for proposed writes, accepts exact confirmations in any language within the pending operation's scope, resumes authorized work after output limits without exact phrasing, goes directly to supplied character or Persona IDs, and prevents hidden reasoning from consuming local JSON responses (#5431, #5434).
- Character and Persona card macros now resolve in request-scoped text and appearance context before generation and image agents consume them, without changing the saved card (#5432).
- OpenAI-compatible custom connections now preserve Anthropic-style `tool_use` content blocks, restoring visible LinkAPI Opus tool calls (#5430).
- Game narration now holds the last settled transcript throughout generation, Agent work, and scene preparation so the next line cannot appear early and then repeat (#5433).
- TTS on iPhone and iPad now avoids persistent IndexedDB Blob writes that can stall WebKit, while retaining the bounded in-memory audio cache (#5429).
- The floating Professor Mari chat now keeps action, reasoning, and status visuals within Chat Chrome colors and uses the compact sidebar-style desktop close control (#5422).
- Professor Mari can now list and create both folders inside a lorebook and folders in the main Lorebooks panel through safe, reviewable app-data actions (#5421).
- Agent requests now keep authored text inside conditional macros while omitting their control syntax and encoded quote entities from the provider prompt (#5423).
- Local ComfyUI video generation can now read large bounded history responses instead of failing at the generic 2 MiB API-response limit (#5415).
- Lorebook batch editing now includes Outlet Name among the fields that can be applied to selected entries (#5410).
- Restoring a checkpoint that has no captured world state (pre-capture checkpoints, or a corrupt capture) now timestamps the restored save the same way every other save-writer does, so a recent bulk import can no longer shadow the freshly restored world in latest-save reads, save pruning, and the next checkpoint's capture (#5418).
- Chat Summaries PopOver now doesn't close when clicking anywhere on the Summary Deletion Confirmation Pop Up, including Cancel, Delete, or just the popup itself (#5401).
- Chat Help now keeps highlight boxes separate, limits Roleplay guidance to the centered message column, explains message and Game log action icons, and uses hover details on desktop with unobtrusive tap-driven details on mobile (#5403).
- SillyTavern profile imports now restore each group chat's character roster and assign historical replies to their matching characters (#5399).
- Settings and Chat Settings switches now share one track and thumb design, keeping every toggle the same size, shape, travel distance, and vertical alignment on desktop and mobile.
- Game widget edit icons and Game log deletion actions now follow Chat Chrome Text Color instead of the app accent.
- The Conversation Start Call button now matches the adjacent participant control height on desktop and mobile.
- Conversation message actions now sit in a compact row below each message on desktop hover and mobile tap, starting beneath the avatar column and following Chat Chrome Text Color without covering the next message.
- Generic active, focus, notification, avatar-glow, and editor-reticle styling now follows the configured app accent instead of falling back to legacy fixed pink, while chat setup connection gates follow Chat Chrome Text Color and close before opening Connections; semantic mode, category, status, artwork, and color-picker palettes keep their intentional colors.
- Chat IDs in Roleplay Chat Settings are now copied by clicking the ID row, with visible click guidance, and compact option buttons across the UI use the unified square shape.
- Memory Recall and individual Tracker schedules now use the established Chat Settings toggle colors, with consistently centered toggle thumbs.
- Recreated Docker and Podman containers can now recover a storage lock left after an interrupted shutdown even when the replacement reuses the same internal PID (#5389).
- The in-field Macro reference and `/macro` help now show the supported `!=`, `is not`, `not contains`, and `not includes` conditional operators (#5383).
- Bot-browser character author notes now render their HTML and CSS through the same sanitizer and style containment as chat messages, with scripts, event handlers, links, and global page styling blocked (#5377).
- Manual Roleplay background generation from Gallery now pauses for media prompt review when that setting is enabled and sends the reviewed prompt exactly once (#5379).
- Chat branches now retain their locally configured sprite layout and display preferences (#5374).
- Agent category headers in the setup wizard now scroll with their agent rows instead of pinning over and obscuring them (#5371, #5386).
- Agent prompts now preserve user-authored lorebook entry tags and ampersands verbatim instead of sending HTML entities to the model (#5372).
- Game Mode now keeps the current scene unchanged while The Game Master finishes a turn, then reveals each generated segment once in order (#5368).
- Character and Persona editor headers now reserve visible space for the card name to the left of Creator and version information (#5369).
- Android hardware and gesture back now dismisses the topmost menu, editor, dialog, or overlay before leaving the app, with the same behavior available to browser and installed-PWA back navigation (#5366; thanks @luma-inibitor).
- Long formatted replies now batch their streaming paints on iPhone and iPad browsers, preventing WebKit from freezing while preserving the selected reveal speed (#5365).
- Roleplay CYOA choices now stay consumed after selection, impersonated choices continue into a character reply, clearing trackers also clears the active prompt, sprites can be fully transparent without covering chat choices, and PNG card exports preserve their sprite sets on Marinara re-import (#5362).
- Character editors now keep independently saved weekly schedules in sync while other card fields still have unsaved changes.
- Conversation transcript dates, timestamps, and message numbers now follow Chat Chrome Text Color instead of a legacy fixed color (#5357).
- Conversation schedules and manual status overrides now apply consistently across all chats for the same character, with per-chat schedule opt-outs still supported (#5358).
- Long-running sessions now bound chat notification history and release persisted reasoning state from server memory, mobile history stays put after the keyboard opens, and Playwright shuts down its owned test servers cleanly (#5353).
- Claude Subscription custom parameters can no longer override the provider's text-only Agent SDK isolation; model-generation overrides remain supported while tool, process, environment, filesystem, and session controls stay provider-owned (#5351).
- Manual and range-backfilled Roleplay summaries now participate in semantic retrieval alongside automatic summaries, keeping relevant history without pinning every manual entry in context (#5346).
- SwarmUI image generation now uses its progress-streaming WebSocket route, preventing long generations from losing an otherwise idle HTTP connection (#5347).
- Game transcript exports now materialize narration edits and deletions in active messages and alternate swipes, omit fully deleted messages, and remove stale segment-overlay metadata from JSONL (#5349).
- Game Storyboard planning now always receives character appearance context; the Attach Card Appearance setting remains scoped to the final render prompt and reference attachments (Pasta-Devs/Marinara-Agents#478).
- ElevenLabs audio connections now test the documented `/v1/models` endpoint, so the default base URL no longer returns a misleading 404 (#5339).
- Docker containers now repair mixed ownership inside file storage and imported top-level data folders even when the data root already belongs to the runtime user, preventing private storage hardening from blocking startup (#5323).
- Roleplay now cancels post-processing work tied to an abandoned swipe before committing the next turn, Stop Agents safely cancels detached agent work without interrupting the primary reply, and an earlier swipe's illustration no longer reappears on the selected swipe while agents finish (#5328).
- Chat Settings now presents its transient Stop Active Generation action like the neighboring neutral controls instead of making it look like an enabled destructive preference.
- Android APK chats now keep their intended message text size instead of letting WebView enlarge Conversation, Roleplay, and Game prose, the New Chat parameter toggle stays inside its card at larger text sizes, and card versioning switches now match the alignment and inactive color of other settings toggles (#5315, #5316, #5318).
- Development server watchers now exit after losing the file-storage writer lease, preventing abandoned sessions from retrying forever and repeatedly reporting `StorageWriterLeaseError` (#5312).
- Forced Agent retries such as Echo Chamber now stop from Roleplay's Agents menu, whose Stop Agents action also matches the neutral styling of neighboring actions (#5299).
- Desktop Mari now changes tabs after finding a requested destination when reduced ambient animations and effects are enabled (#5301).
- Game branches now restore Journal entries and generated HUD lists, such as Clues, to the selected story point instead of carrying future branch information (#5287).
- Advanced Settings now provides a guarded server restart control that gracefully closes storage and services before relaunching (#5285).
- Starting a new Roleplay swipe now immediately hides the previous swipe's generated image, while returning to the original swipe restores its own image (#5286).
- Merged Narrator replies in Roleplay now hide speaker tags and use the default dialogue color when no participating character has a custom dialogue color (#5282).
- Professor Mari now asks compatible OpenRouter workspace models for JSON responses and treats an explicit request to split lorebook entries as authorization to create the split-off entries as well as update the originals (#5271).
- Renamed Roleplay branches now keep their branch names in the branch selector and capability-package chat records, while the Chats sidebar, search, and alphabetical sorting use each chat's unambiguous name (#5268, #5364).
- Jumping to older messages with `/goto` no longer revives stale CYOA choices at the chat tail (#5269).
- Macro reference guidance now renders the literal `{{macro}}` example, and expanded macro editors and guides stay above Author's Notes, summary, and other floating panels at narrow viewports (#5266, #5267, #5270).
- The compact music player now stays hidden until Music DJ is installed, and its General Settings switch remains unavailable with a clear explanation until the agent is ready; installing Music DJ unlocks both immediately (#5262).
- Professor Mari's open chat now follows the user again when they move into another chat or editor, with the interactive floating window on desktop and the quick-return avatar on mobile navigation surfaces (#5263).
- The mobile Chats topbar icon now stays in the configured accent color after taps and double taps while its active underline keeps the cyan-orange-pink gradient (#5264).
- Safari backup downloads now stream the prepared ZIP directly through the browser instead of buffering the entire archive in page memory; a short-lived one-time download capability preserves remote and Docker admin protection without exposing the reusable admin secret (#5259).
- Embedding connections now accept either an OpenAI-compatible API base URL or the provider's full `/embeddings` endpoint, so documented NanoGPT and OpenRouter URLs no longer become a nonexistent doubled path (#5252).
- Windows, macOS, and Linux launchers now recognize an already-running healthy Marinara server before updating or rebuilding, then reopen that instance instead of attempting a second storage writer; genuinely conflicting or unresponsive processes remain blocked to protect user data (#5256).
- Locally hosted OpenAI-compatible models now honor Reasoning Effort set to Off, and JSON-returning Agent calls—including tool-assisted and batched runs—avoid exhausting their output budget on discarded thinking.
- Mobile full-screen navigation now places the slightly larger Home icon first, opens Chats from the right like the resource tabs, swaps between Chats and resource tabs without replaying the entrance animation, deactivates Home while another surface is open, lets Home dismiss that surface and return to the Home page, and starts the draggable Music DJ control below Home bookmarks; the Characters tab underline now also matches its pink icon on mobile and desktop (#5248).
- Docker update checks now recognize stable-to-Staging/UAT channel switches and show the correct `staging` image tag and host-side switch instructions instead of claiming the stable container is already current (#5249).
- Roleplay's Agents menu now offers a Stop Agents action while parallel or post-processing work is still running, without blocking new messages or swipes (#5237).
- ComfyUI Video Generation workflows now support the same Base64 reference-image placeholders as image workflows, including `%reference_image%` and `%reference_image_01%` through `%reference_image_04%` (#5238).
- Automatic backups, manual backups, and profile exports no longer fail at an artificial 8,192-entry ZIP ceiling; archive size and path-safety protections remain enforced (#5239).
- Professor Mari now accepts an explicit authorization clause together with the concrete character or lorebook edit in the same user message, while preserving operation and entity safeguards (#5245).
- Windows installer sources now refuse to download or install a release unless they were built or invoked with its exact commit pin, preserving the existing verified path used by official release executables.
- NovelAI Diffusion v5 models (`nai-diffusion-5-full`, `nai-diffusion-5-curated`) now generate images successfully instead of returning a 500 error, by extending the V4+ model regex in `image-generation.ts` and `game-asset-generation.ts` to match v5 model IDs and route them through the `params_version: 3` code path (#5343).
- NovelAI image connection model dropdown now shows only `nai-` prefixed models instead of the entire app-wide image model catalog, and the "Fetch from API" button is hidden for NovelAI connections since the `/oa/v1/models` endpoint returns text models, not image models (#5344).

## [2.4.3]

### Added

- Lorebook Update agents can now optionally assign an integer injection order when creating or updating entries. Omitting it keeps the existing/default order, and approval review preserves the value through editing and commit. When creating a custom agent, the prompt editor now previews the complete response shape for the selected result type, including optional fields (#5225).
- Added NanoGPT as a Video Generation connection with live model discovery, text- and image-to-video requests, asynchronous status polling, connection tests, and Game/sprite generation support (#5218).
- The Game Mode narration box can now be collapsed to a slim handle, so the scene art, map, or running Experience behind it is visible without leaving the game. The choice is a saved preference that persists across chats and sessions, and the readability scrim and stacked segment log fold away with it. The box reopens itself whenever your text input is on screen, so it can never leave you unable to take your turn; anything else it is holding — narration still to read, a generation that failed, a combat that could not start — raises an indicator on the handle instead, one click from reading it. Capability API 1.13 lets a game-surface Experience request a temporary collapse for a cutscene without touching your saved preference (#5209).
- Character and Persona cards now start at version `1.0`, automatically increase their version when saved edits change the card, and provide an enabled-by-default switch that can pause automatic versioning and revision snapshots without deleting existing history (#5202).
- Beholder's Roleplay host now sends the active Persona and a name-keyed current-state object on every call, accepts both delta responses and legacy full snapshots, and safely merges deltas into the last valid full state before saving it (#5204).
- Expanded Simplified Chinese UI localization across nearly the entire app, with the normal English fallback retained for newer strings that have not yet been translated (#5201).
- Roleplay chats with active Tracker agents now expose an opt-in **Attach Lorebooks to Trackers** setting, which forwards the exact lorebook entries activated for the main response to automatic and manually retriggered Tracker prompts while leaving Author Notes attached (#5197).
- Professor Mari (and every other connection) now survives proxy rate limits (#5183): a rate-limit response — HTTP 429, 529, or 503 with `Retry-After` — now pauses and automatically resumes the same request, honoring `Retry-After` with capped exponential backoff, instead of aborting the task the way Mari's up-to-13 back-to-back tool-call rounds previously did on a proxy capped at, say, five messages per minute. A new optional per-connection **Max Requests Per Minute** cap (Settings → Connections; `0` = unlimited, round-trips through connection import/export) proactively paces bursty callers so the limit is not exceeded in the first place, and the pause is surfaced as a "paused, resuming in Ns" status instead of a silent wait. Professor Mari also no longer discards the workspace steps she already completed when a request ultimately fails, and local-sidecar connections get a larger JSON command-protocol repair budget that no longer consumes her command-round budget, so a small local model can fumble the tool-call format a few times without starving the actual task.
- Added Beholder as an official downloadable, Roleplay-only physical-state Agent. It tracks clothing by body slot, held items, wounds, missing parts, bare slots, and species; validates and carries its full snapshot into the next turn; and exposes the latest state plus Agent setup in a native Chat Settings drawer (#5188, Pasta-Devs/Marinara-Agents#401).
- Echo Chamber now exposes an editable message delay in its Agents editor, and extensions can update the same `messageDelaySeconds` agent setting instead of relying on hardcoded reveal timing (#5177).
- Persona cards can now be referenced by copied ID with `{{persona-21-character-card-ID}}`, resolving the card name in place and adding its authored fields and eligible attached lorebook context to the prompt (#5171).
- Added **Assistant Reasoning Prefill** alongside the existing visible assistant prefill: compatible OpenAI-style endpoints can now continue hidden reasoning from `reasoning_content` on a partial assistant message, while visible-only prefills keep their existing request shape.
- Game music is now context-bound (#5161): instead of generating a throwaway 30-second clip from a fresh mood prompt nearly every turn, each map area and each encounter tier (common, miniboss, boss, special — classified by the encounter generator) gets ONE persistent instrumental composition (default 2 minutes), generated lazily on first visit or first encounter into the game-assets music library under `music/area/<slug>/` and `music/tier/<tier>/`, where the Game Assets panel can audition, rename, or replace it like any other track. Deterministic scoring now always selects music — tier track in combat, area track elsewhere, the bundled state library as the floor — and keeps the current track while it still fits, so music changes when the context changes, never mid-scene. The scene analyzer no longer writes free-text music prompts (on-demand sound effects are unchanged).
- Added first-class Audio connections: a new "Audio" provider type in Settings → Connections carries the speech backend (ElevenLabs, OpenAI-compatible, PocketTTS, xAI Voice), base URL, API key, model, default voice, and per-connection Game sound-effects / music capability toggles, with category-scoped default and fallback selection like image and video connections. TTS speech, voice/model discovery, and Game Mode audio generation now resolve through the audio connection (explicit pick → category default → fallback), the Game Setup wizard gains an audio-connection picker with per-game sound-effect and music toggles that gray out when no capable connection exists, and a one-time boot migration turns an already-configured legacy TTS settings blob into an equivalent default audio connection — the blob keeps serving playback knobs (speed, stability, extractor settings) and remains the fallback for setups without audio connections, a blob whose master TTS toggle was off migrates to no connection at all, and default-resolution keeps honoring that master toggle (only an explicitly requested connection bypasses it), so an upgrade never re-enables TTS on its own and existing installs keep working unchanged (#5146; docs follow-up: #5156).
- Added capability API 1.12: spatial transition capability events (`spatial_transition_committed`, `spatial_transition_rejected`, and the `spatial_context_refresh` nudge) are now also addressed to the game-owning Experience package, so an Experience that sent a travel command learns the outcome the moment the host does instead of inferring it from later state reads. Transitions rejected on either silent HTTP path — the pre-stream owner-turn commit or the standalone REST commit, previously plain HTTP errors with no event at all, a gap that affected World Maps too — now synthesize a `spatial_transition_rejected` event carrying the error code, and only on definitive evidence: inconclusive failures (a network error that may have lost a successful commit) deliver the untyped refresh nudge instead of a fabricated verdict (#5143).
- Added a host-run structured generation call for game-surface Experiences: `POST /api/game/:chatId/experience-generation` runs one bounded, non-streaming JSON call on the chat's GM connection with package-supplied instructions and an optional JSON schema (forwarded as provider-native structured output where supported), gated on the chat's stamped Experience, rate-limited in the one-shot-call class, serialized per chat, and answering truncation with an actionable error before the tolerant parser can repair a cut-off reply into a silently incomplete document (#5135).
- Consolidated local regression commands around the filesystem-discovered Node lane: `pnpm regression` and `pnpm regression:node` now collect all 121 Node regressions with one shared build, `pnpm regression:ui` owns the separate Playwright lane with `pnpm smoke:ui` retained as a compatibility alias, and `pnpm test` checks the installer layout before the Node-only lane. Retained focused commands use exact runner filters, and 61 package-script aliases were removed without deleting regression files (#5132).
- Grouped 31 clear-owner Launcher, Mari, Professor Mari, and Noodle regressions into domain directories while preserving all 121 automatically discovered files and stable focused commands. The move also ensures three file-backed regression fixtures close their databases before removing owned temporary storage (#5132).
- Every image and video generation path now runs under a process-wide concurrency ceiling — default 4, configurable with `MARINARA_MEDIA_GENERATION_CONCURRENCY` (`0` disables it) — enforced inside the generators themselves, so while the ceiling is enabled a batch can no longer stampede a local ComfyUI/SwarmUI GPU or fan out unbounded requests against a paid provider (setting the limit to `0` opts out and restores the old unbounded behavior). Batch/automatic work never occupies the last slot ahead of interactive requests, waits are bounded by default (`MARINARA_MEDIA_GENERATION_WAIT_TIMEOUT_MS`; `0` waits indefinitely) so saturation fails loudly instead of hanging, and fallback-connection retries reuse the original request's slot (#5097).
- Added host-owned `GET`/`PUT /api/game/:chatId/experience-state` routes so a game-surface Experience package can store its world state in the engine's per-message `game_engine_state` table instead of chat metadata: saves are scoped to the chat's stamped Experience (`experience:<id>` rows — invisible to turn-games, protected from turn-game start/resign wipes, and never able to shadow an active turn-game), anchored to the visible message so swiping or branching back to an earlier narration rewinds the world (a brand-new swipe continues from the latest save until the Experience writes one of its own), bounded per save, and pruned to the newest 100 anchors per chat (#5102).
- Game checkpoints now capture every active engine-state blob (turn-games and Experiences) by value when the checkpoint is created and restore from that copy, replacing the timestamp re-lookup that silently restored stale or no state for any game that rewrites a single anchor in place — including in-place turn games like Tic-Tac-Toe and Rock-Paper-Scissors (#5102).
- Added Inventory Tracker as an official downloadable Roleplay Agent, with separate currency, equipped, and carried-item lists; compact quantities; editable HUD and Tracker Panel grids; per-cell locks; retry support; and committed prompt context (#5105, Pasta-Devs/Marinara-Agents#361).
- Added `POST /api/sprites/pixelize`: deterministic pixel-art post-processing for AI-generated images — nearest-kernel downscale to a target cell size, palette quantization against a supplied ramp, binary alpha, and a wrap-around seam score reporting tileability — so probabilistic model output can sit beside authored pixel art; identical input always produces identical bytes (#5096).
- Character sprite-sheet generation accepts an optional `styleProfileId` so a bake can target a specific image style profile instead of always compiling against the user's active one; an absent field keeps today's resolution exactly, and unknown ids degrade the same way the gallery path degrades (#5095).
- Added capability API 1.11 Experience combat seam: `game-surface` packages receive `combatActive` (true the instant the built-in combat UI mounts, unlike the lagging narrative scene state), the effective `combatStyle`, and `requestCombat()` — which routes into the same encounter-generation pass as the manual Start Combat button, minus the confirm dialog; packages still cannot supply combatants or combat state (#5094).
- Added capability API 1.10 package assets: an Agent package manifest may declare `contributions.assets.paths`, and the Engine serves those image and JSON files over `/api/capability-packages/<id>/assets/<path>` with per-request hash verification, a passive content-type allowlist, and cheap `ETag`/`304` revalidation — so a package (for example a Game experience) can ship tilesets and sprite atlases instead of inlining art into its client bundle (#5091).
- Agent package client bundles and assets now carry strong ETags derived from their manifest hashes and answer revalidations with `304 Not Modified`, so an unchanged package no longer re-downloads in full on every app load (#5082).
- Let Professor Mari read your chat history: attach a chat from the composer's attach menu — sharing all, a range, or the last N messages — so Mari can see your roleplay and give grounded feedback, with a Context Viewer to review and remove what's attached to free up tokens (#5073).
- Added visible, one-click copy controls for lorebook and lorebook-entry IDs in their editors (#5085).
- Expanded Haptic Feedback to Conversation, Roleplay, and Game with capability-aware device descriptions, the full `0.0-1.0` intensity range, every Intiface output type, and named patterns for scalar and positional pumping actions.
- Added an optional Roleplay speaker extractor for TTS autoplay that uses a dedicated connection to queue narration and exact dialogue with assigned character voices, stable Random NPC Voices fallbacks, and optional emotion cues.
- Added an on-demand Advanced Settings storage optimizer that scans for old, unreferenced avatar images and deletes them only after an explicit confirmation (#5039).
- Roleplay now releases Swipe, Continue, and the composer as soon as a reply is durably saved while its non-rewriting post-processing agents finish against that exact message and swipe in the background; overlapping runs keep independent progress state (#5155).
- Added the official v2.4.3 What's New message to the Home experience, including the Inventory Tracker overview and screenshots.
- Added `{{addnumvar::name::value}}` for numeric variable addition without changing `{{addvar}}` string concatenation (#5024).
- Added a Personal Extension authoring guide with importable Browser and Server examples, package/API references, lifecycle guidance, and troubleshooting (#5026).

### Fixed

- Professor Mari now honors an explicit direct workspace-edit request when a smaller model omits or paraphrases its separate authorization quote, while still rejecting denials, how-to requests, wrong entities, and mismatched operations (#5325).
- Single-option preset variables now use the standard settings switch, keeping their Android touch target and proportions consistent with the rest of the app (#5326).
- Game Mode rerolls now restart narration at the beginning of the newly saved swipe, generated Timeline and Library journal entries can be edited, and the scene analyzer can repeat a beat's sound effect from one to five total plays. Branching from an earlier log entry also restores inventory and generated widgets to that point (#5287, #5327).
- Merged Narrator group replies now use the configured default dialogue color for tagged speakers without a matching colored card instead of borrowing another participant's color (#5336).
- Professor Mari's mobile message labels, action icons, context details, and suggestion guidance now follow the configured Chat Chrome Text Color, while her desktop close controls use the same full-size treatment as editor exits (#5273).
- APK-managed Android setup no longer opens a separate localhost browser that asks the user to paste Marinara's private local-access secret, and its self-authenticating WebView/session routes no longer fail CSRF when Android reports an opaque `Origin: null`; `null` remains rejected for every other unsafe API route. The generated credential stays automatic inside the app, and releases now publish a stable one-click APK download asset alongside the versioned file (#5222; docs follow-up: #5223).
- Game Mode no longer replaces a matching Character-library portrait when recovering a missing scene background or retrying a failed portrait load (#4746).
- Character-created Conversation reactions can now be removed directly by clicking their chip on desktop or long-pressing it on mobile, without discarding the user's own matching reaction (#5216).
- Character example dialogue now falls back into the Character Info marker when a prompt preset has no dedicated Dialogue Examples marker; presets that include a disabled Dialogue Examples marker continue to omit it intentionally.
- Preserved Long-Term Memory recall in Roleplay chats when a custom preset's agent marker cannot be matched, using a logged fallback injection instead of silently dropping the selected memories.
- Roleplay speaker extraction now prints the connection's raw response when debug mode is enabled, supplies the current reply's character as the fallback for ambiguous lines, and lets harmless label formatting such as `Maukie:` or `Maukie [chuckle]` resolve to the character's assigned voice instead of Random NPC Voice (#5210).
- Termux session logging now starts before update checks, dependency repair, and builds, so launcher-stage crashes create the same timestamped diagnostic log as server-stage crashes; it starts only after restrictive log permissions are confirmed, flushes before exit, reports logging failures, and preserves the server's own exit status (#5208).
- Automatic card versioning now preserves imported nonnumeric version labels instead of resetting them to `1.0` on the next content edit (#5202).
- Active Roleplay summaries now form a leading system block when no prompt preset is selected, matching the existing fallback used when a preset omits its Chat Summary marker (#5196).
- Stale file-storage writer leases on macOS now survive VPN and virtual-interface changes: new leases use the stable platform identity instead of hashing the currently visible network adapters, and existing v1 leases from the same Mac are reclaimed after their PID exits instead of blocking startup (#5194).
- Custom lorebook-writing agents now support a configurable Read Behind depth, keep each delayed run attached to the assistant reply it processed, and avoid duplicate work when the newest reply is swiped. Lorebook Keeper's mobile Backfill controls now stack inside their settings card instead of overflowing it (#5191).
- The staging update-channel warning now follows the active theme accent color instead of always rendering in amber (#5184).
- Character avatar uploads now reject path-like character IDs before constructing their storage filename, keeping uploaded files confined to the avatar directory even when a malformed route parameter is supplied (#5181).
- The Inventory Tracker section now appears for installs whose synced UI settings were saved before the section existed. The cross-device settings blob overwrote the locally migrated panel order on every load, and `trackerPanelSectionOrder` was the one tracker preference that blob never re-normalized on the way in, so the section stayed invisible until the panel was reordered by hand. Ingest now normalizes both the section order and the collapsed-section map and writes the corrected value back, so the stale order does not survive to re-arrive on another device. Any tracker section added in future would have hit the same gap.
- Inventory Tracker entries edited by hand now get the same treatment as agent output. Tracker Panel and HUD edits wrote rows straight to state, skipping name trimming, duplicate merging, the quantity clamp, and the rule that keeps equipped gear out of carried inventory — so a value the agent could never emit could still be typed in. Equipping a carried item now moves it in a single write instead of leaving it in both lists, and the same rules are enforced on the server, which previously accepted any `playerStats` payload unchecked.
- The Agent Suite JSON editor now reports malformed Inventory Tracker rows instead of accepting them. It only checked that the three keys were arrays, so a row without a name was stored as-is; validating first also avoids silently normalizing a hand-written group down to an empty list.
- Gallery routes now serve valid raster images with the format detected from their bytes, so generated Noodle images stored with a mismatched `.png` extension render instead of returning 404 (Pasta-Devs/Marinara-Agents#392).
- Opening the immutable Universal Preset no longer creates duplicate presets; its editor now offers an explicit **Create editable copy** action instead (#5142).
- Gallery files now use the image format detected from their decoded bytes, preventing JPEG output advertised as PNG from being stored under a broken `.png` name (#5147).
- Support Diagnostics now reports the Engine host OS separately from the browser OS, including correct iPadOS detection for desktop-class iPad user agents (#5157).
- SillyTavern-style `setvar`, `getvar`, `addvar`, `incvar`, and `decvar` macros now persist independently in each chat across turns and restarts, with numeric `addvar` and returned increment/decrement values matching their compatible semantics (#5158).
- Roleplay speaker-extractor emotion cues now remain inline as one or more bracketed indicators within the exact dialogue—such as `[irritated] ... [sigh]`—instead of being collapsed into a separate tone field (#5159).
- Performance diagnostics now feature-detect the browser's `longtask` observer support before registering it, avoiding the unsupported-entry console warning (#5160).
- Roleplay Spotify search now paginates requests in provider-safe batches of ten, and Music DJ restores an enabled context-repeat setting even when Spotify's immediate playback verification lags (#5163, #5165).
- Large manual backups now prepare as a short-lived server job before Safari opens the completed ZIP stream, avoiding long idle download requests that Safari could terminate (#5164).
- The Termux launcher now preserves timestamped server logs across Android process restarts and documents Android battery-optimization exclusions, making otherwise silent host-level terminations diagnosable (#5154).
- Game Mode's Spotify Music DJ no longer fails deterministically for the artist and generic-search sources on apps subject to Spotify's February 2026 `GET /search` limit reduction (Development Mode apps, capped at 10 results per request; Extended Quota Mode apps kept the old behavior): the candidate pool's default of 50 was passed straight through, producing a 400 on every request for affected apps. Search now paginates in pages of 10 up to the requested pool size — safe under both quota modes — and a transient failure on a later page returns the results already collected instead of discarding them (#5163).
- Professor Mari now wires up the preset variables she creates: her authoring guidance and worked example make her drop a variable's `{{variableName}}` macro into a prompt section, so a choice block she adds actually changes the assembled prompt instead of leaving the user a picker that does nothing (#5080).
- Preserved omitted Inventory Tracker groups, kept equipped items out of carried inventory after lock merging and name normalization, clamped oversized quantities, and migrated existing Tracker Panel layouts to show the new section (#5125).
- Kept launcher update snapshots small by excluding downloaded model caches and sidecar runtimes, while continuing to preserve user content and recovery backups (#5124).
- Explained in the Windows launcher that non-Git installations cannot use automatic updates or commit-based stale-build checks, while version-based validation still runs (#5123).
- Kept active characters in individual Conversation group chats responsive when another selected character is away, while preserving the away character's own configured delay and mention shortcut (#5122).
- Reordered Storyboard Agent settings around separate Roleplay and Game Mode active flows, showed planning and provider-formatting stages in runtime order, kept setup visible, exposed image-aware Step 3 overrides in both chat editors, nested complete prompt collection editors inside their numbered stages, renamed the Stage 4 passthrough formatter, changed the default animation duration to 5 seconds, and hid animation-only controls for still-image defaults (#5120).
- Added newly shipped built-in prompt choices to existing Storyboard agent configurations after package updates while preserving saved overrides, custom prompts, and current selections (#5118).
- Kept valid Gallery images visible on Windows when canonical paths differ only by drive-letter or directory casing, without weakening traversal and symlink containment checks (#5099).
- Made vectorized lorebook recall use model-appropriate query/document formatting, prioritize recent user turns, and reject incompatible stored vector spaces with useful debug diagnostics (#5104).
- Added a server-side pre-execution authorization gate that binds Professor Mari workspace mutations to an explicit excerpt from the active user request, while retaining Keep/Restore as a second line of defense (#5093).
- Honored each image style profile's selected prompt grammar for character avatars, portraits, and sprites instead of silently forcing compact tags (#5083).
- Game checkpoints now capture and restore the turn-game engine state, so loading a checkpoint rewinds an active turn-game (UNO, Chess, Poker, Eight Ball) along with the story and map instead of leaving it on its post-checkpoint state (#5077).
- Routed Game Mode time-advance and weather-update through the queued per-chat metadata patch path so they no longer silently revert a concurrent metadata write, which could permanently lock World Map movement as a stale definition (#5076).
- Restored docked Tracker layout so the Roleplay transcript and composer resize beside the panel on either desktop edge instead of being covered by it (#5071).
- Restored docked Tracker gutter scaling so the panel and all of its contents fit beside the centered Roleplay chat on either desktop edge without moving the transcript, composer, or scrollbar (#5071).
- Expanded SwarmUI and ComfyUI LoRA strength controls from `-2..2` to `-100..100` so slider LoRAs can use their required weights (#5072).
- Regex bundle imports now retain scripts flagged by the pattern-safety heuristic and show a warning instead of reporting those entries as skipped.
- Kept NanoGPT Illustrator generation within its 4 MB reference-upload limit, preferred immediate hosted-result downloads, and hardened base64 fallback parsing so successful images are stored instead of rendering as broken output (#5058).
- Kept Windows launcher updates from failing while protecting data by excluding the generated capability-package `node_modules` junction from update snapshots (#5052).
- Prevented stopped or terminal-disconnected dev sessions from leaving nested server and client processes behind, and reused an already healthy local server on repeat launches instead of failing on its storage writer lease (#5062).
- Started TTS autoplay as soon as assistant text is finalized instead of waiting for Illustrator, trackers, summaries, or other non-rewriting agents; active message-rewrite agents such as Prose Guardian and Continuity Checker still finish first (#5059).
- Made the Roleplay speaker extractor's structured-output request compatible with Responses API providers that require the input message itself to mention `json` (#5059).
- Kept long Roleplay speaker-extractor readings complete by packing narration into normal-sized requests, generating queued clips serially, and stopping visibly on a failed clip instead of silently skipping parts of the message (#5059).
- Gave each character voice assignment its own roomy stacked controls, removed hollow trailing dropdown controls, and kept empty character guidance on semantic theme colors.
- Improved Tracker Panel readability by giving long custom values more room to wrap and making the side control read as a neutral action instead of a selected mode (#3470).
- Preserved complete Storyboard animation prompts through planning, image-aware refinement, and final video prompt persistence instead of silently clipping them at generic 1,200- and 650-character summary limits (#5041).
- Let combat buff skills target allies and debuff skills target enemies, with accurate type labels and descriptions in both combat layouts (#5040).
- Registered Slurp's package-owned storage tables so its standalone Creator feed can persist without touching legacy NoodleR data (#5049, Pasta-Devs/Marinara-Agents#348).
- Left-aligned generated Conversation selfies with their message text on desktop instead of centering them in the message body (#5042).
- Treated a literal `CSRF_TRUSTED_ORIGINS=null` as an unset value so it no longer prevents Marinara Engine from opening (#5030).
- Stopped removed or disabled Example Dialogue markers from silently injecting character examples into prompts (#5031).
- Restored persona creation through Professor Mari by supplying the persona reference-image default expected by storage validation (#5033).
- Kept supported placement settings when importing character-scoped SillyTavern regexes that also contain unsupported placements, with a warning for the ignored values (#5036).
- Capped game auto-checkpoints to the newest five per trigger type (session start/end, combat start/end, and the rest) so a long campaign no longer duplicates every captured tracker, map, and engine-state snapshot into unbounded memory and ever-larger checkpoint shard rewrites; your own manual checkpoints are never pruned (#5110).
- Kept the caret at the chosen insertion point when typing quotes or apostrophes in expanded Character and Persona text editors (#4656).
- Prevented multiple Marinara processes from silently overwriting a shared local data directory; stale diagnostic counts are repaired without hiding stored rows (#5013).
- Let Termux recover its app-private storage lease after an Android restart instead of blocking launch on an exited process (#5029).
- Omitted runtime Agent prompt sections when their Agent produced no output (#5023).
- Presented iPad sidebars as full-width overlays in landscape as well as portrait by widening the mobile-shell breakpoint to cover newer iPad Pro 13" widths and requiring a touch-only pointer, so sidebars are no longer cramped on landscape iPads while hybrid touch laptops keep their desktop layout (#5034).

### Changed

- Split Game narration formatting, visual helpers, and tag parsing into focused chunks, reducing the main GameSurface chunk below the restored 500 KiB budget (#5215).
- Coding-agent contributors now follow a Ponytail-inspired minimalism ladder that favors reuse, platform capabilities, and the smallest correct implementation without weakening safety or validation requirements (#5186).
- Project validation now checks the maintained TypeScript and TSX source tree with Prettier before linting and building, so formatting drift is rejected by the same `pnpm check` command used in pull-request CI (#5181).
- The Inventory Tracker panel now flows its entries as wrapping pills across the full panel width, with the quantity shown as `×N` only when it is above one. The previous layout split the panel into three fixed columns and reserved a quantity cell on every row, so at the widest setting each column was around 95 px and item names truncated — while a group holding two rows sat mostly empty. The panel also establishes its own container context, so it now lays out identically in the docked sidebar and the HUD popover instead of differing between them (#5125).
- Advanced the stable release identity to v2.4.3 across the Engine, Home page, PWA manifest, Windows installer, Android bootstrap metadata, update checks, README, and release references. Android uses `versionName` `2.4.3` with `versionCode` `44` so it updates over every previously published APK.
- Removed the shared 1 MiB JavaScript field limit from Browser and Server Personal Extensions while preserving their separate archive, CSS, storage, request, and sandbox boundaries (#5025).

## [2.4.2]

### Added

- Added the v2.4.2 in-app What's New message with bundled images and looping videos so its update overview remains available without external media requests.
- Let Game setup enable Illustrator's Dynamic LLM Prompt Generation before the first image request (#4964).
- Added always-visible activation and vectorization status to lorebook entries in Professor Mari's Easy Viewer review cards: each entry now shows whether it is Constant, Selective, or Normal (using the lorebook editor's dot colors) and whether it is Vectorized, Not vectorized, or Vector excluded, with the before and after shown when Mari's edit changes them, so an entry's kind is clear at a glance instead of only when a setting happens to change (#4931).
- Added a per-entry Reject control to Professor Mari's Easy Viewer: revert a single lorebook entry of a multi-entry change while keeping the rest applied, instead of only being able to Restore the whole change. Rejecting is refused for anything that could leave a dangling reference (an entry removed as part of deleting its lorebook, or a non-entry row), and the review card shrinks to the entries that remain (#4931).
- Added a "View as prompt" preview to Professor Mari's Easy Viewer for character and preset edits: a before/after view of how the edit appears in the assembled prompt, with additions in green and removals in red. It is a synthetic preview assembled on its own (default preset, no persona or chat history), not a live chat prompt (#4931).
- Added literal message search to Conversation and Roleplay chat headers, with compact results that jump to matching messages anywhere in the current chat (#4922).
- Added a Roleplay Agents-menu stop control that appears only while the current chat has an active generation and can cancel server-side work that survived navigation or a reload (#4942).
- Added a persisted Send on Enter toggle for Professor Mari and a reusable setup download on New Game's final step before the game starts (#4928, #4930).
- Added Markdown previews to Conversation, Game, and section content in the preset editor, matching character and lorebook authoring (#4916).
- Added Discord-style `__underline__` and `-# subtext` rendering throughout chat history and other shared Markdown surfaces (#4914).
- Added an Easy Viewer to Professor Mari's Keep/Restore review cards: instead of raw `app_data` JSON, her edits now show as a readable before/after diff with removed text in red and added text in green, lorebook entries laid out like the entry editor (name, keys, content, toggles), and a per-change Dismiss control to hide reviewed items and reduce clutter. Deletions and disables are flagged prominently since they are the most consequential, and you can toggle each card between Easy and Raw independently (#4919).
- Let Professor Mari set every user-editable lorebook entry setting when she creates or edits entries, not just the keyword-matching controls: activation chance (`probability`, clamped 0-100), timing (`sticky`, `cooldown`, `delay`, `ephemeral`), recursion (`preventRecursion`, `excludeRecursion`, `delayUntilRecursion`), inclusion-group weight, per-entry scan depth, lock, folder placement, character/tag/trigger matching filters, and per-entry vectorization (which she only enables when an embedding model is configured) (#4791).
- Added shared and per-character New Start context markers to group Roleplay, with an avatar target picker and character-colored dividers that let newly introduced characters begin from a later message without truncating the rest of the cast's history (#4905).
- Added character-targeted Roleplay message hiding through `/hide <character> <number/range>`, including quoted names and the existing single, range, and comma-separated message selectors (#4906).
- Added a search box, collapsible entries, and sorting to the Professor Mari Skills and Memories panels. Each entry is now a drawer that expands in place to edit; its description shows on wider screens and collapses to just the name on small screens; both panels can be sorted by name (A to Z or Z to A), newest, or oldest; persistent memories are pinned to the top and marked with a star that stays visible while collapsed; and the open editor stays in view so saving or toggling a row no longer scrolls it away (#4868).
- Added one-click support diagnostics that copy the current version, build, platform, graphics adapter, and active text model for issue reports (#4878).
- Added SwarmUI as a video-generation backend, including authenticated distributed ComfyUI workflow submission, base64 reference images, model discovery, and MP4 retrieval (#4885).
- Added responsive batch selection to chat Galleries, with filtered Select All, confirmed multi-image downloads and deletes, and selection cleanup between chats (#4859).
- Added optional image prompting instructions to image connections, applying them inside existing selfie and Illustrator prompt-writing calls before provider review or generation.
- Added a Gallery image-agent picker that can run any active custom image-producing agent alongside the base Illustrator (#4846).
- Added an editable Storyboard Agent shot-planner stage that inspects each generated keyframe before video generation, persists its suitability classification, and falls back to the planned motion when image-aware refinement is unavailable or invalid. The Storyboard Agent page now explains the four-stage prompt workflow and orders its shared prompt editors from illustration through image-aware grounding to video generation (#4839, Pasta-Devs/Marinara-Agents#296).
- Added batch selection to Character and Persona image galleries so selected images can be downloaded or deleted together after confirmation (#4832).
- Added a persisted Auto, Low, Medium, or High output-quality choice to GPT Image generation connections (#4831).
- Added optional character and persona reference sheets under Sprites, with upload, size-bounded AI creation, safe selection cleanup, and an explicit generation-reference toggle that falls back to existing likeness art; both Galleries include the same AI creation entrypoint (#4786).
- Gave Professor Mari granular preset editing: she can now read a preset's individual sections, groups, and choice-blocks with content previews and add, update, or delete any one of them in place through the Keep/Restore review, instead of only creating or replacing a whole preset — also exposed through a new `mari presets` CLI (#4812).
- Gave Professor Mari a persistent, retrievable memory: standing preferences and behavior directives you save (or ask her to remember) that she retrieves index-and-fetch: only a lightweight title/description index of your saved memories stays in her prompt every turn (capped by both entry count and total size, and paged so a large store never truncates ids out of reach) and she pulls a memory's full text when it is relevant, so the store stays token-cheap as it grows. Memories marked Persistent inject their full body every turn (charged in full against one budget), so those are meant to be few and small. Saved memories take precedence over her default behavior where they conflict (for example, opting back into edit-without-asking). Every memory she writes goes through the Keep/Restore review and lands disabled until you turn it on (with the review card's Keep & Enable action or the new Memories panel), so nothing she reads can quietly activate a standing instruction, and a dedicated Memories manager lets you create, edit, enable, and pin them directly (#4851).
- Let Professor Mari propose safe data-only custom Home widgets for explicit confirmation, with persistent responsive cards that users can reorder, hide, restore, and delete from the Widgets manager (#4801).
- Added the **Please Handle With Care** achievement for dragging the Home navigation Professor Mari around the screen (#4805).
- Rebuilt Home as a full-width, Firefox-inspired Marinara browser with theme-matched chrome, generated bookmark and tab artwork, a responsive draggable and hideable widget desk with equal spatial slots, space-aware large-widget packing, fine-pointer hover lift and illumination, and a focused five-widget first-run composition, Community shortcuts, compact mobile chrome with fitted destination tabs and a Bookmarks menu, a live timezone-aware cyan-accented clock and calendar, visit-ordered mode-colored recent chats with band-free scene backgrounds, expression sprites, and a fitted three-card mobile view, latest-unlock and nearest-goal achievement previews with distinct shelf and launcher copy, a generated trophy bookmark that follows the master Achievements setting, separate FAQ and widget-manager windows, a highlighted Home onboarding tour, mobile-fitted Guide and Character of the Day cards, and an optional Professor Mari navigator that finds Engine destinations and named resource editors locally without AI, remembers its bounded desktop position, and dangles by her hoodie in a generated pixel animation while dragged (#4763).
- Moved Noodle into an optional downloadable package that keeps its familiar interface in a Home tab with its paired Noodle/NoodleR logo, blue/pink mobile navigation, and a persistent new-refresh badge, automatically preserves availability for existing profiles, follows the staging Agent catalog during feature review, and leaves timeline data ready for reinstall after removal (#4763, Pasta-Devs/Marinara-Agents#278).
- Added Arli AI as a built-in text provider for chat connections, using OpenAI-compatible chat completions with models loaded from the Arli AI `/models` endpoint.
- Added a custom 1–40 place target to the New Game wizard's AI world-map draft options (#4783).
- Added a compact context-budget indicator to Professor Mari Workspace when message token usage is enabled (#4752).
- Added per-chat image style overrides for custom image agents, alongside their existing connection overrides (#4718).
- Added attributed `marinara.fetch` traffic totals and sustained-rate warnings for full-page extensions (#4720).
- Added SwarmUI image generation, optional account-token authentication, model discovery, and ComfyUI workflow submission through SwarmUI's distributed generation queue (#4702).
- Added an accent-colored divider above the current Roleplay new-start boundary (#4709).
- Guided package onboarding can open the active Roleplay chat's Summary popover and assigned prompt preset Sections editor directly.
- Added explicit step-by-step and immediate World Maps travel modes, with one committed movement per accepted Roleplay or Game turn and recoverable queued routes (#4618).
- Added a single setting that reduces ambient animations and effects throughout the interface, including automatic support for the operating system's reduced-motion preference (#4631).
- Added per-chat image-connection overrides and an on-demand snapshot button for image-generating custom agents (#4686).
- Added a downgrade guard that blocks launches and updates onto an older build once chat data has been sharded, plus an offline `unshard` escape hatch to recover access to chat history (#4738).
- Added a one-time notice explaining the storage migration after upgrading, with a plain-language summary, a technical-details toggle, and a link to the storage troubleshooting guide (#4762).
- Added tiered exact, substring, and semantic resolution to Professor Mari's fetch command, letting her find characters, personas, chats, and lorebooks by partial name or description instead of an exact match only (#4778).
- Added lorebook-authoring guidance for workspace Professor Mari, exposing selective, whole-word, case-sensitive, and regex matching fields and walking her through a user-gated fidelity review so generated entries are no longer skeletal (#4796).
- Added mari CLI flags for lorebook entry secondary keys, selective matching, selective logic, whole-word matching, case sensitivity, and regex on `add-entry` and `update-entry`, matching the app-data entry editor (#4811).
- Added lorebook-authoring strategy guidance, a worked multi-control example, and macro/recursion documentation to the lorebook entries guide (#4814).
- Made Professor Mari's Keep/Restore undo durable across restarts, persisting pending reviews to disk with a 14-day retention window and a 50-item cap (#4828).
- Added optional, quota-limited synthetic audience activity for public NoodleR posts, with separate likes, replies, reposts, and a manual refresh action.
- Added a persisted local-day NoodleR fan activity plan with four deterministic platform runs and resumable activity application state.
- Preserved creator-level fan audience inheritance when editing individual archetype weights, and surfaced source-action failures in NoodleR profile controls.
- Added a configurable automatic audience-run count, kept manual audience runs available outside that daily budget, and prevented malformed generated activities from failing an entire run.
- Exposed **Max Parallel Agent Jobs** in local-model runtime settings and used it for agent scheduling and llama-server parallel slots while retaining the configured context budget per request (#4609).

### Changed

- Made Personal and External Extension cards more compact, with only power and delete actions on the card, a single-line status summary, clearer name and description regions, and package export moved into the extension editor.
- Expanded profile-import previews and quarantine to cover executable tools, personal extensions, persistent Professor Mari memories, and active themes, preserving their contents for deliberate review and re-enabling.
- Bound downloaded Agent installs and updates to the version and checksum the user reviewed, quarantined imported executable tools until review, and moved custom scripts plus Professor Mari transforms into terminable or OS-sandboxed workers while retaining an explicit reviewed-script fallback on unsupported systems.
- Repeated local checks now reuse native TypeScript and ESLint caches for unchanged client files (#4938).
- Manual Agent retries now resolve the same current settings, custom tools, and permitted built-in tools as normal Agent generation while retaining retry-specific historical context and Spotify playback verification (#4894).
- Localized achievement definitions and official capability-package Home metadata through stable locale-aware contracts with English fallback, and refreshed Home's welcome copy (#4803, #4806).
- Positioned Professor Mari's navigation helper at the bottom-left on her first appearance while preserving every remembered user placement.
- Removed the standalone Browser tab and its tutorial step, moved card downloads into split Download/Open Library controls in Characters and Personas, and replaced browser-native card destination and embedded-lorebook prompts with a themed Marinara import flow.
- Sharded stored messages and message swipes into per-chat files instead of rewriting a chat's entire history on every saved message, migrating existing installs automatically on first boot (#4735).
- Sharded fourteen more chat-keyed tables (memory, agent runs, game state, calls, gallery, influences, and notes) into per-chat files, cutting write amplification on every turn (#4754).
- Moved Home Professor Mari's available-name lists out of the system prompt into a per-turn message, stabilizing prompt caching and capping each category at 100 entries (#4771).
- Ranked Home Professor Mari's available-names list by relevance to the current conversation instead of an alphabetical slice, falling back to alphabetical when relevance data isn't available (#4779).
- Advanced the stable release identity to v2.4.2 across the Engine, PWA manifest, Windows installer, Android bootstrap APK, update checks, Home page, and release references. Android uses `versionName` `2.4.2` with `versionCode` `43` so it updates over every previously published APK (#4610).
- Required AI-agent contributions to update the Unreleased changelog for every bug fix, behavior change, and new feature, keeping release notes aligned with the implementation that introduced each change (#4613).

### Fixed

- Fixed Playwright web-server startup on Windows when pnpm launcher metadata or inherited stdin is unavailable (#5126).
- Included Noodle in Professor Mari's official 32-package catalog knowledge and corrected the current downloadable-package documentation for the v2.4.2 Agent catalog (#4992).
- Kept version-tagged Docker release images on the stable Marinara Agents catalog instead of following staging after publication.
- Kept dependency security updates pinned to patched resolutions and made the existing pnpm launcher handoff checks a required pull-request gate, protecting upgrades without forcing users onto a new package-manager major version (#4988).
- Kept inline Game dialogue and group character macros responsive on malformed or very large generated text without limiting valid authored content (#4984).
- Removed the 2 GiB application ceiling from automatic and downloadable full backups, using streamed ZIP64 archives so larger local libraries remain restorable without weakening safety limits for ordinary profile imports (#4982).
- Hardened imported and model-authored content against pathological parsing inputs and reserved metadata keys without removing supported import formats or local tools.
- Kept automatic and downloadable backups working when local media exceeds the profile importer's ordinary per-file limit, while preserving bounded streaming imports and omitting only an individual unreadable or unarchivable asset instead of failing the whole backup; any omissions are listed in `RESTORE.txt` and automatic-backup status.
- Kept visible Android browsers connected to a same-device Termux server responsive with a lightweight loopback-only heartbeat, without restoring hidden-tab or remote-client polling (#4968).
- Kept long-running SwarmUI image requests alive across idle container networking while retaining the configured ComfyUI generation deadline (#4969).
- Restored Professor Mari preset creation while keeping Engine-owned preset identifiers protected from user input.
- Updated Roleplay message-edit shortcut hints to mention Ctrl+Enter on Windows as well as Cmd+Enter on macOS (#4965).
- Kept the Message Avatar Scale and related art-size sliders wide enough to remain visible and repeatedly adjustable in Chrome, including at larger interface display sizes (#4974).
- Kept an already-installed Noodle Agent visible and usable after downloading an update while its replacement waits for the required Marinara Engine restart (#4976).
- Prevented crafted profile archives from retargeting saved credentials, serving active files as trusted app content, escaping asset directories through imported metadata, reconstructing blocked theme CSS, or exhausting the importer with oversized metadata.
- Kept Professor Mari suggestion chips in a single horizontally scrollable row on mobile instead of stacking them above the composer.
- Hardened local security without removing extension or remote-access capabilities: made Professor Mari filters data-only, encrypted webhook credentials, bounded ZIP extraction and rich-chat network/CSS behavior, restricted automatic network trust to detected runtimes, privatized local data and backups, verified downloads and release commits, and patched audited dependencies.
- Authenticated APK-managed Android localhost sessions without restricting manual Termux or LAN use, verified the pinned F-Droid Termux APK before install, bound native bridge calls to the exact Engine origin, and made release signing and bootstrap source commits fail closed.
- Imported preset regex entries even when they contain unsupported SillyTavern placements, warning about ignored placement values instead of discarding the entire regex, and let Music DJ try the next candidate when Spotify accepts but cannot verify the first selected track (#4959, #4960).
- Refreshed stale same-version browser clients when the server commit changes, so staging fixes such as NovelAI generation-setting saves and connection imports no longer remain hidden behind an older cached interface (#4957).
- Kept the Termux-hosted server awake while the launcher is running and released the Android wake lock when it stops, preventing backgrounded Termux sessions from freezing until the terminal is reopened (#4956).
- Kept Professor Mari's generated continuation suggestions available after opening and closing a lorebook (#4953).
- Made SwarmUI image requests honor the configured ComfyUI timeout instead of inheriting a shorter transport timeout (#4954).
- Kept canceled Professor Mari prompts out of the composer, made the first message edit persist, and retained retry for the latest response (#4947).
- Preserved the complete provider-ready prompt produced by Game Mode's dynamic image prompt generator through prompt review and image submission (#4948).
- Stopped Professor Mari's workspace verification guard from treating ordinary task-completion wording as an unverified data mutation (#4949).
- Enforced each connection's Max Parallel Agent Jobs limit across separate post-processing Agent batches (#4950).
- Removed deleted lorebooks from the active chat context immediately instead of leaving a stale cached attachment label (#4951).
- Made turn-game bot move prompts visible when UI debug mode or `DEBUG_AGENTS` is enabled (follow-up to #4945).
- Included custom world fields and persona inventory in Agent Suite tracker editing without replacing adjacent tracker data (#4937).
- Exposed active custom image agents in Conversation Gallery's Illustrate picker, matching the existing Roleplay and Game action (#4940).
- Resumed pending turn-game bot seats after a regular Conversation reply so UNO cannot remain frozen when a chat send wins the per-chat generation lock (#4941).
- Made the Game minimap's zoom icons follow the selected interface accent instead of retaining a fixed color (#4944).
- Matched embedded Long-Term Memory chat settings to the compact spacing, control sizing, typography, and surfaces used by other Agent menus (Pasta-Devs/Marinara-Agents#309).
- Repaired common malformed JSON in Roleplay and Conversation summaries through the shared JSON-repair path instead of falling back to raw model output (#4925).
- Kept NovelAI generation defaults from reverting when Save follows a newly committed setup field (#4929).
- Cleared embedded character-book data and pointers when Professor Mari deletes a whole lorebook, then restored both to the actual embedding character on Restore, including empty and multi-linked books (#4932).
- Preserved an enabled Spotify repeat setting when Music DJ replaces playback with a multi-song selection, looping the selected set as one context (#4934).
- Kept a character's embedded lorebook in sync when Professor Mari edits it: adding, updating, or deleting an entry (or restoring one of those changes) in a lorebook embedded in a character card now rebuilds that character's copy, instead of leaving it stale as only her edits did before (#4927).
- Gave Professor Mari a safe way to delete a single lorebook entry (`lorebook.deleteEntry`) and told her to use it instead of a raw `mari db delete`, which previously let her remove far more entries than intended when asked to delete just one (#4924).
- Preserved unsent Home Professor Mari messages across editor navigation and app restarts until they are sent or explicitly cleared (#4915).
- Taught workspace Professor Mari to revise an existing saved memory when asked, instead of declining that a matching memory "already exists": her guidance now includes a read-then-rewrite recipe and worked example for editing a memory's content in place (the same pattern she uses for preset sections), which also works on an enabled or persistent memory without turning it off (#4917).
- Made Force To Call Tool serialize native required-tool controls for Google Gemini, Vertex AI, and compatible Anthropic requests, while safely falling back to automatic choice for manual Claude extended thinking and Mythos (#4907).
- Fixed the open-issues regression failing on Windows checkouts: its chat-summary reorder check matched the entry container and the touch-reorder row within a fixed character distance that CRLF line endings pushed just over the limit, so it now verifies the shared desktop and touch reorder surface on the row element directly, independent of line endings and where the row is defined (#4911).
- Restored Music DJ Spotify playback by clearing the previous repeat mode before replacing a multi-song context, reapplying repeat only after the selected first track is verified, and surfacing persistent URI mismatches as failures instead of false pending successes (#4903).
- Made persona saves reliable: the editor now sends only the fields you actually changed, keeps edits made while a save is still running, prevents saves and avatar replacements from overlapping, blocks its own Back and Discard controls mid-write, and explains exactly which field a rejected save objected to — including an empty persona name.
- Made Reduce Ambient Animations & Effects flatten costly backdrop blur on desktop as well as mobile, including shared Conversation overlays (#4897).
- Applied embedded character-card fields when replacing an existing character's avatar, so updated card PNGs refresh the matching editor sections (#4896).
- Kept automatic summaries chronologically ordered and hidden when requested, while allowing users to rearrange summary entries by drag and drop on desktop and mobile (#4891).
- Clarified Professor Mari's character-card field guidance so requested backstory, appearance, and other sections are edited independently without replacing unrelated content (#4874).
- Rewrote the animated glow in the Card CSS Theming guide example to animate `opacity` on an overlay layer instead of the message bubble's `box-shadow`. Animating `box-shadow` forced a full repaint every frame and could pin a weak GPU; the example now demonstrates the GPU-composited pattern instead (#4897).
- Matched Feature agent pages to the shared Agent editor chrome and Chroma accent, and correctly recognized their owning package as installed. (#4892)
- Kept the Your Guide Professor Mari action icon synchronized with its label color.
- Kept Sidecar tracker counts and bulk local assignment current when capability Agent packages hydrate or refresh, and centralized Agent result-type admission behind one shared compatibility-tested vocabulary.
- Kept explicitly selected persona-linked lorebooks usable outside their owner persona while preserving automatic owner matching and chat exclusions (#4887).
- Extended the Roleplay New Start divider across the full message body for user messages as well as assistant messages (#4886).
- Applied Game image prompt overrides and the selected Illustrator prompt template to Game prompt-director requests, including manual portraits that use the Illustrator agent's image connection and explicitly customized prompt settings when the general dynamic-prompt toggle is off (#4880).
- Made Game combat use character-sheet levels, resource pools, and typed abilities instead of deriving levels from HP and treating every ability as an attack (#4881).
- Recorded the fallback provider and model on messages it actually generated instead of displaying the failed primary model (#4879).
- Remembered the Echo Chamber corner independently for each chat and flushes position changes immediately so they survive tab changes and app restarts (#4882).
- Made chat generation-parameter send toggles authoritative, so disabling Verbosity omits it from provider requests even when a preset still has a selected verbosity value (#4883).
- Fixed the Windows installer falsely rejecting the required pnpm version when its version command emits LF-only output, while continuing to reject failed commands and mismatched versions (#4875).
- Kept Random Model chats on a stable configured embedding source during Memory Recall refreshes instead of falling back to the local embedder (#4864).
- Restored installed feature-only packages such as Noodle to the Agents management pane while keeping them out of ordinary chat-agent pickers (#4865).
- Preserved bold formatting nested inside italic user messages (#4866).
- Made server-present UI settings authoritative when an older browser cache has no trustworthy timestamp, while retaining local values only for settings absent from the server (#4867).
- Protected Marinara's stock Universal Preset from deletion and direct edits, restored it when missing or changed, and preserved requested edits in a separate editable copy (#4871).
- Re-enabled Character card lorebook embedding immediately after an embedded lorebook is removed (#4872).
- Preserved Game Send-on-Enter and tutorial-dismissal preferences across their sync and local-storage boundaries, and made Session Logs honor persisted token counts and current-session markers after message metadata hydration (#4869).
- Kept Recent Chats previews separate on narrow desktop windows by limiting the constrained two-column layout to the four newest chats while preserving the existing mobile and wide-screen counts (#4858).
- Scoped image-connection prompt instructions to image-producing agents, bounded stored instructions to 20,000 characters, and kept each retry agent on its own configured image connection.
- Kept chat settings profiles within their saved chat mode, migrated legacy Visual Novel profiles to Roleplay on import, and prevented reusable profiles from overwriting branch identity (#4849).
- Served the Home shell directly for unknown routes so Termux mobile launches cannot recurse through the server's 404 handler (#4850).
- Corrected legacy Google Gemini `/v1` connection URLs to `/v1beta` for connection checks, model discovery, chat generation, and embeddings (#4854).
- Removed the decorative address bar from mobile Home and the obsolete close action from Professor Mari's Home tab while retaining the full desktop browser frame (#4855).
- Restored intuitive mobile swipe navigation for Conversation transcripts while preserving Roleplay swipes and interactive controls (#4841).
- Made Memory Recall re-vectorization exclusive with background chunking so embedding-model changes cannot leave mixed vector dimensions (#4843).
- Saved pending Lorebook vector settings before vectorization and surfaced provider or eligibility failures instead of reporting a misleading zero-vector success (#4844).
- Recovered expected sharded chat history from its preserved pre-shard backup when a restored profile contains no message shards (#4845).
- Kept Professor Mari's Home navigator enabled by default and visible with reduced effects, reset her to the default position when re-enabled, centered her drag handle, contained compact Field Notes and Community actions, and presented iPad sidebars as full-width overlays (#4826, #4827, #4829, #4830).
- Sharpened Professor Mari's read-only guardrail so a "how do I…" question is answered or offered rather than performed, even when it names the change as its goal (for example "how do I make X have Y") — while a plainly-worded request to make that change, including a polite question form like "can you set X to Y", is still carried out — so she keys on intent rather than grammar and no longer edits without a clear instruction (#4838).
- Reduced background autonomous-message polling to a lightweight candidate-id lookup instead of re-fetching the full chat list every 30 seconds (#4715).
- Stopped the server's autonomous-messaging scheduler from sweeping every 60 seconds when no chats had changed, cutting idle load on self-hosted installs (#4716).
- Stopped chat message history from being fully re-downloaded on reconnects, background generations, and Professor Mari workspace changes (#4719).
- Replaced the `.env` config watcher's 2-second stat-poll with an event-driven directory watch (falling back to a slower 30-second poll only if needed), cutting a constant idle-wakeup cost on phone and Termux installs (#4723).
- Moved the Chat Settings secret-plot reader off the shared chat transcript query, so **Load More** no longer disappears while older messages still exist and the secret-plot panel stays current after new messages arrive (#4725).
- Replaced fixed 25ms Personal Extension sandbox polling with an adaptive cadence that idles down once traffic quiets, cutting background wakeups and flash writes for every running server extension on phone and Termux installs (#4727).
- Bounded Professor Mari's workspace data reads so oversized character/lorebook fields are elided with a readable note and recoverable via drill-down, instead of being silently truncated mid-JSON (#4776).
- Stopped Professor Mari from making unrequested changes when only asked to inspect, explain, or get how-to guidance, answering informational requests without modifying anything (#4816).
- Routed every Professor Mari workspace create through the same Keep/Restore review as edits and deletes, so an unwanted creation can be undone in chat, and blocked creates from overwriting existing rows with colliding IDs (#4825).
- Corrected Home and Appearance presentation regressions affecting semantic chat-mode colors, the Square avatar preview, Noodle notification placement, compact mobile Achievements, Discovery Desk spacing, mobile Bookmarks motion, and consistent widget-manager labels (#4809, #4817, #4818, #4819, #4820, #4821, #4823).
- Restored Game party portrait file selection for Character, Persona, and NPC sheets whether or not the sheet editor is active (#4793).
- Kept legacy reaction payloads out of rendered message content, accepted `/title <name>` in Professor Mari chats, and let her navigator open an exact saved chat title (#4782, #4794, #4800).
- Standardized gradient-stop editing on Marinara's owned color controls and tightened Home responsiveness, including Guide overflow, deleted Recent Chats, semantic mode colors, decorative browser refresh behavior, larger Mari drag targeting, and pausing Home animations while the app is unfocused (#4797, #4799, #4802, #4804, #4807, #4808, #4809).
- Kept blank messages and hidden command anchors out of Home's Recent Chats previews, counted paginated chat histories without materializing every message ID, stabilized history cursors across deletions, and rejected malformed cursors.
- Applied the selected tag-import mode when a downloaded character card is imported as a persona.
- Matched the Character and Persona Download/Open Library launchers to the Chats segmented controls with an exact centered split, fixed icon sizing, and single-line labels.
- Kept Professor Mari's held navigation animation mounted, frame-snapped, paint-batched, and slightly wider so repeated grabs no longer flash the wrong sprite frame, stutter under pointer movement, or squash her proportions.
- Mirrored Professor Mari's navigation speech-bubble tail from one canonical shape when her dialog switches sides and seated it flush against either dialog edge.
- Centered the desktop **Ask Me Where Things Are** tutorial card and spotlighted Professor Mari's actual navigation bubble instead of her full-screen drag surface.
- Standardized chat-mode icons across Home, Chats, creation flows, shortcuts, and linked chats: Conversation keeps its message bubble, Roleplay uses theater masks, and Game uses a gamepad without colliding with Lorebooks.
- Kept mobile Chats, Settings, and tracker panels above the Home browser chrome so their controls remain tappable.
- Stopped hidden Home and Professor surfaces from retaining navigation timers, pending focus frames, message-history requests, Discovery rotation, and workspace-status polling after their lifecycle ended.
- Kept Professor Mari's navigation dialog controls clickable when her draggable sprite overlaps the dialog.
- Kept Professor Mari suggestion chips visible after entering her Home tab instead of briefly showing them before loaded chat history made the composer jump.
- Rejected malformed Persona create/edit fields and normalized downloaded Persona copies with fallback names plus unsafe-paint cleanup without changing saved Personas (#4857).
- Kept NovelAI V4.5 style-plate file selection inside the Connection editor across Chromium platforms (#4777).
- Deactivated and revealed lorebooks that lose their final owner, replaced Lorebook Keeper entry bodies without stacking duplicates, and added sandbox-safe structured file copy, move, and removal tools for Android/Termux (#4775).
- Let readers scroll through Professor Mari history while her response is still streaming (#4774).
- Replaced the browser-native single-chat deletion prompt in Professor Mari with Marinara's confirmation dialog (#4773).
- Preserved Tracker panel controls at their configured width, kept the panel aligned beside the right sidebar, and made closing its detached window close the panel (#4772).
- Displayed the actual error output beneath failed Professor Mari workspace tool events (#4770).
- Quarantined an automatic-generation connection for six hours after three consecutive provider failures while keeping foreground chats available (#4769).
- Moved smart group responder selection to the default Agent connection with Agent fallback and the connection's saved generation parameters instead of a fixed 512-token chat-connection call (#4765).
- Shared Professor Mari's robust JSON repair waterfall with structured agents so repairable malformed or truncated output no longer wastes retries (#4753).
- Revalidated replaceable user backgrounds so re-importing a different image under a deleted filename no longer displays stale browser-cached pixels (#4757).
- Kept NovelAI V4.5 style-plate uploads inside the Connection editor by decoding oversized images directly to a bounded preview and avoiding redundant copies of their encoded data (#4748).
- Replaced the Windows Chromium native Connection and Preset popups in new Conversation and Roleplay setup with readable themed selectors (#4750).
- Kept explicitly disabled Boolean preset choices empty instead of injecting their first option into prompts (#4740).
- Resolved current DeepSeek, MiMo, GLM, and Kimi output limits through NanoGPT, OpenRouter, and custom OAI-compatible connections, and stopped Professor Mari before executing tool calls from truncated output (#4741).
- Sent explicit OpenRouter prompt-caching markers for every compatible model, including Gemini, instead of limiting the option to Claude (#4742).
- Gave native Connection and Preset dropdown options readable theme colors in the new Conversation and Roleplay setup wizards on Chromium (#4743).
- Prepared and bounded NovelAI V4.5 style-plate uploads before previewing them so large images no longer destabilize the Connection editor (#4744).
- Let capability packages use the remote embedding source configured on their agent connection, retaining local MiniLM only as a fallback (#4745).
- Reused matching avatars from the full Character library in both Game portrait-generation paths instead of repeatedly generating replacements (#4746).
- Isolated the tracker panel's newest-message lookup from transcript pagination settings (#4724).
- Preserved speaker names and timestamps in individual Conversation group history so characters can distinguish prior speakers (#4726).
- Raised the default Termux Node.js heap limit for large profiles while preserving user-supplied limits (#4730).
- Reconciled failed-generation prompts by submission ID so API errors do not show duplicate user messages (#4731).
- Saved Echo Chamber resizing when pointer capture ends outside the resize handle, preserving its per-chat size across navigation and restarts (#4733).
- Kept the selected Narrative Director push-story instruction in every individual group responder prompt, independent of queue and Secret Plot settings (#4734).
- Allowed server extensions to finish storage writes registered through `onCleanup` during a polite stop.
- Made edits to Conversation replies that contained character commands reach the model instead of the original wording (#4728).
- Kept the full desktop Roleplay edit checkmark above overlapping message layers so its entire visible hit target remains clickable (#4700).
- Made the Windows launcher and installer detect Node.js by running it directly instead of requiring `where.exe` (#4701).
- Added the standard expanded editor and macro guide controls to Roleplay summary editors (#4710).
- Matched Chats hover loading text and visible error details, including “Internal Server Error,” to the active accent/chroma text color (#4712).
- Isolated the memoized Chat area from unrelated topbar state and stabilized message mutation callbacks, preventing unchanged Roleplay transcripts from rerendering when tabs open (#4713).
- Applied the committed-message Markdown, action, and dialogue-color formatter to Roleplay output as it streams, while keeping updates coalesced to animation frames (#4714).
- Show the localized validation error before restoring an invalid all-zero NoodleR fan activity weight.
- Asked for confirmation before permanently deleting a prompt block from preset chat settings (#4698).
- Let Professor Mari read trusted Wikipedia links through her structured wiki tools on Android while keeping raw shell networking sandboxed (#4691).
- Stopped Illustrator from appending its generic anti-text list to NovelAI negative prompts, preserving the prompt supplied by the agent (#4692).
- Converted NovelAI style-reference fidelity to the provider's inverse secondary-strength scale before sending the request (#4693).
- Bounded delayed Roleplay typewriter catch-up and disabled competing Echo Chamber smooth scrolling during the main stream, keeping parallel-agent output fluid (#4694).
- Kept Character and Persona gallery controls inside mobile cards, added deletion to their expanded image views, and matched Chat gallery delete actions to the configured accent (#4695).
- Removed app-wide color-transition storms and synchronous cursor recoloring from animated accent ticks, and deferred offscreen gallery rendering to keep long sessions responsive (#4696).
- Scoped cross-chat awareness in individual group conversations to the character currently replying (#4688).
- Reconciled just-sent Roleplay messages with their saved IDs before editing so the first edit after stopping generation persists (#4678).
- Retried one transient Roleplay message-edit save failure so remote sessions persist the edit without requiring another manual Save action (#4678).
- Kept Persona tags, stats, saved statuses, avatar crops, tracker colors, and conversation settings intact across loading, editing, duplicating, restoring, and switching Personas by returning one consistent Persona API shape (#4646).
- Included the active Conversation cast's avatar references and appearance descriptions in guided group selfies (#4676).
- Added native Arli.ai image generation with authenticated text-to-image and image-to-image requests (#4672).
- Let Professor Mari read complete lorebook entry bodies through her structured app-data tools instead of receiving only truncated entry previews (#4673).
- Removed conflicting color-environment and unused React Compiler/Babel warnings from test and lint runs, refreshed smoke coverage for the current release, schema, agent, and Noodle settings surfaces, and preserved a reader's exact mobile chat position when the keyboard opens (#4670).
- Kept source Chat Summary entries as inactive history after combining summaries in Roleplay mode instead of deleting them, and revealed that history immediately after each combine.
- Removed local Character and Persona avatar files when their cards are deleted individually or through Danger Zone, including avatars retained only by deleted card-version history (#4668).
- Installed the pinned pnpm automatically when the Windows installer cannot use Corepack, an existing pnpm, or its temporary runner (#4662).
- Exposed saved prompt choices for active Roleplay tracker agents in Chat Settings, matching the existing Game-mode selector (#4663).
- Centered the avatar-upload camera and inset the AI-generation action so both controls remain fully visible over the mini preview in Character and Persona editors (#4665).
- Simplified proactive Conversation intent hints so check-ins follow the selected moment without extra tone instructions.
- Distributed mobile topbar icons evenly across the available screen width without changing the desktop layout (#4666).
- Kept the caret at the chosen insertion point while typing in expanded Character and Preset editors instead of repeatedly focusing the field and jumping to the end (#4656).
- Restored a full, unobstructed hit target for Roleplay message edit controls so Save no longer reacts only near one corner (#4658).
- Coalesced Roleplay streaming presentation to animation frames to limit Firefox accessibility-tree churn (#4659).
- Added an independent Noodle timeline image-size setting, defaulting to the GPT-Image-compatible 1024x1536 portrait canvas instead of reusing the Illustrator dimensions (#4660).
- Made NoodleR stage-profile drafts tolerate single-item array responses, extra model fields, and decorated handles from local models while ignoring model-provided disclosure modes, discarding invalid values, and applying the requested valid mode (#4626).
- Removed deprecated generation parameters from single and bulk prompt-preset exports and ignored them when importing older Marinara or SillyTavern preset files (#4650).
- Kept the selected prompt checkmark above the Presets avatar frame instead of clipping it into the rounded image border (#4651).
- Kept Roleplay message editors open until the save is confirmed, so a delayed mobile save after stopping generation cannot briefly restore stale text or discard the first edit (#4649).
- Kept the reasoning action visible when a provider reports hidden reasoning-token usage but omits the displayable summary, and explained the missing summary in the Model Thoughts panel.
- Coalesced Professor Mari's streaming transcript work to animation frames and released her input lock before best-effort refreshes, preventing long replies and stalled cleanup requests from leaving the assistant unresponsive (#4628, #4637).
- Stopped personal extensions and their policy from polling on every screen and in background tabs; existing query invalidation now refreshes them after changes (#4629).
- Added each active Game tracker agent's available prompt templates to Chat Settings for quick per-chat selection (#4640).
- Rebuilt incomplete Android/Termux output when a dist directory exists without its required entry file, preventing the server from starting into a browser and app 404 loop (#4639).
- Raised profile ZIP import capacity from the former 1 GiB ceiling to the ZIP32 format limit while retaining per-entry and expanded-size safety limits (#4641).
- Moved full Docker images to Debian Trixie so ARM64 sidecars can load the required glibc and libstdc++ symbols (#4638).
- Matched the **Add character to active chat** button to the neighboring Character row actions in folders and standalone rows on desktop and mobile.
- Stopped the NoodleR reserve poll from scanning the prepared-post and Noodle post tables every minute when automatic posting is off and no reserve posts exist, and backed the automatic timeline-refresh poll off to 15 minutes while refreshes are disabled, cutting idle CPU wake-ups on phone and Termux installs (#4630).
- Removed duplicate safe-area padding from Noodle's mobile setup footer so the shared shell remains the single owner of spacing above Android navigation controls (#4586).
- Kept the first edit to a sent user message after canceling generation instead of discarding it when transient swipe cleanup changes the active index (#4608).
- Matched the **Add character to active chat** action to neighboring controls in folders and standalone Character rows, including a visible consistently sized icon on desktop and mobile (#4611).
- Made **Clear Trackers** use the configured accent hover treatment instead of a destructive red state (#4612).
- Made agent calls inherit the selected connection's temperature and parameter-send policy, with 0.7 as the default when no temperature is configured, and kept incompatible per-agent settings isolated during batching (#4614).
- Reduced Spotify Music DJ execution to one full-context planning request followed by deterministic playback, and clarified per-round versus cumulative timing in agent debug output (#4615).
- Added preset picture upload and replacement controls to the Presets panel and preset Overview editor, matching the existing lorebook picture workflow while cleaning up replaced and deleted artwork (#4624).
- Prevented completed NoodleR profile-draft generations from restoring an editor after the user canceled, changed sources, or moved to another draft flow.

## [2.4.1]

### Added

- Added a Creator management area to NoodleR profiles that tracks changes to the linked character or persona, shows expandable old/new source values, supports open-profile name and handle adoption, offers review-before-save re-drafting, and lets users accept the current source as the new baseline. Missing imported sources now disable generation and present a delete-only recovery state.
- Let a capability package provide an entire Game mode: a package declaring the new `game-surface` slot draws its own HUD, menus and combat over the shared narration, is chosen while a game is created from the **Experiences** block of the setup wizard, and declares which built-in systems it replaces — anything left undeclared stays built-in, so an ordinary game is unchanged. Supporting host changes: packages holding `prompt-context` can now contribute to each turn's system prompt (the permission previously had no consumer), the resource facade gained optional write methods for the player persona and lorebooks, and the asset manifest is re-scanned after packages activate so art a package installs is visible without a second restart (#4526).
- Added portable character-gallery image references: `card://self/gallery/<filename>` in a greeting or message resolves to whichever character is speaking, so gallery images embedded in a card keep working after export and import (character ids are regenerated on import, which broke id-based links). The character gallery gains a **Copy image reference** button that produces the portable form, editor field previews resolve it for the edited character, group-chat replies resolve `self` per speaker segment, and the native-export importer now preserves gallery filenames (sanitized, collision-safe) instead of renaming every image, which is the fix that makes the references survive the round trip. Documented in the Character Galleries and Sending & Streaming guides.
- Added the **Hindi** documentation language pack, covering all 124 in-app guides (developer docs included) in natural Hindi, with English UI control names preserved for following instructions against the interface and Hindi sidebar category labels in the docs viewer. Select it under **Settings → General → Documentation Language** via **Download & Replace** (#4471).
- Taught the docs viewer to render right-to-left documentation, ahead of the planned Arabic pack: each guide follows its served language's reading direction (untranslated English fallbacks stay left-to-right), code spans and fences keep their left-to-right order inside RTL prose, and lists/tables/panels use direction-aware styling. Three deliberate refinements are visible today: search highlights lose their slight inset so they can no longer sever cursive letter joining, sidebars whose category headers use non-Latin scripts (Japanese, Korean, Chinese, Hindi) drop the small-caps letter-spacing that misfit them, and the "Last updated" dates now follow the app's language instead of the browser's. Everything else renders identically for existing packs (#4489).
- Added optional prompt-preset targeting to regex scripts and refreshed the existing character target picker so scoped regexes follow the selected preset or characters without clipped controls (#4446).

### Changed

- Advanced the stable release identity to v2.4.1 across the Engine, PWA manifest, Windows installer, Android bootstrap APK, update checks, Home page, and release references. Android uses `versionName` `2.4.1` with `versionCode` `42` so it updates over every previously published APK.

### Fixed

- Updated the pinned pnpm toolchain to 10.34.5 across launchers, installers, update commands, containers, and CI as routine maintenance. The Corepack pin includes the release tarball's SHA-512 digest, mismatched global versions are rejected, and launchers reselect the repository pin after pulling future updates. Existing 10.33.2 launchers can finish this one transition without requiring an extra restart (#4581).
- Preserved full JannyAI definition fields by falling back to recovered page data when the original PNG is blocked, and stopped incomplete search metadata from masquerading as a complete character import (#4497).
- Matched PocketTTS's official `localhost:8000` multipart `/tts` API and built-in voice catalog while retaining automatic compatibility with existing OpenAI-style PocketTTS wrapper URLs (#4499).
- Let custom post-processing agents evaluate activation keywords against the completed assistant response, so Scan Depth 1 now sees the message the agent is meant to process (#4498).
- Refined Roleplay Chat Summary controls with a centered Backfill action, a Chat Summary/Combine prompt switcher, and one Edit path that keeps the active prompt visible above template editing (#4501).
- Sorted the **Settings → General → Language** dropdown by language code with English pinned first, matching the Documentation Language selector. The previous native-label sort used a different collation per entry, which scrambled the order across scripts (#4471).
- Sent Noodle image instructions to the timeline model, and stopped the default Noodle Post Image template from appending them to the image-generation prompt, so directions like "mention build, clothing, pose, lighting" now shape the generated image description instead of reaching ComfyUI as literal prompt text. Custom templates that still reference `{{userInstructions}}` continue to append it verbatim. Raw style tokens belong in an image style profile, which applies to every Noodle image.
- Stripped label text and language-model framing from the character personality and image-habit blocks in the Noodle image prompt, so the image model receives the descriptive values instead of sentences written for an LLM.
- Dropped the `Character appearance notes:` header from the shared illustrator appearance block, which every caller appends directly to an image prompt, so diffusion models stop receiving the label as drawable text.
- Kept Storyboard planner fallback warnings visible through prompt review and saved Game/Roleplay storyboards, made **Attach Card Appearance** authoritative without duplicating appearance context, and expanded fallback narration beats without cutting words (#4544).
- Let Characters, Personas, Lorebooks, Agents, Presets, and Connections sidebar labels use the full desktop row width beneath hover actions, and made Conversation Call clip-length rows size to their panel instead of clipping labels beside fixed-width fields (#4449).
- Removed accumulated duplicate built-in **Default** settings profiles during startup normalization while preserving one stable profile and active selection per chat mode (#4442).
- Kept `/scene` chats and standalone conversions out of Conversation branch groups so original conversations remain visible in the Conversation sidebar (#4443).
- Taught Professor Mari the supported custom `image_prompt` agent configuration, including marker activation and the image-generation capability, so she creates requested image agents instead of falsely refusing them (#4444).
- Kept Google Gemini API keys in the `x-goog-api-key` header when fetching models instead of duplicating them in the URL, preventing compatible proxies from rejecting the query token with HTTP 401 (#4448).
- Preserved the reader's pre-keyboard scroll position in mobile Roleplay instead of snapping the transcript to the newest message when the composer receives focus (#4589).
- Kept Characters and Personas library artwork flush with the full height of mobile cards, made Character Chat actions match the compact Copy and Delete controls on desktop and mobile, and kept folder counts clear of Delete actions across Characters, Personas, Presets, Lorebooks, Connections, and Agents.
- Kept the first confirmed edit to a sent Roleplay message after stopping generation, including on mobile where a transient missing/default swipe index previously made the edit look stale (#4592).
- Restored Chub NSFW search results, including cards whose current search payload exposes the canonical NSFW topic without a boolean flag; filtered result totals and pagination now follow Chub's reported count, and the page label has its missing space (#4593).
- Kept a provider-refused prompt out of the composer when that user turn was already saved in chat history, while still restoring drafts for requests that genuinely failed before persistence (#4594).
- Made Game Mode dice cards preserve declared dice notation and avoid presenting discarded dice or success pools as false addition equations (#4683).

## [2.4.0]

### Added

- Added validated JSON export and import for Conversation character schedules. Imports load as unsaved drafts, preserve the existing schedule until explicitly saved, and move restored routines to the current week (#4414).
- Added Z.AI as a native Image Generation service with GLM-Image and CogView 4 models, model-aware aspect-ratio sizing, authenticated native requests, and safe local storage of returned image URLs (#4350).
- Added compact multi-selection and bulk deletion to Professor Mari's chat history, including a single destructive confirmation and automatic replacement when the active chat is removed (#4353).
- Added Character-ID macros such as `{{V1StGXR8_Z5jdHi6B-myT}}` for loading another card's context into the system prompt without its greetings or example dialogue, while still applying normally activated attached lorebooks (#4336).
- Added selection and one-click condensation of multiple ordered chat summaries into a single summary entry (#4334).
- Added a visibility toggle for reimported embedded Character lorebooks so they remain linked, active, and editable without cluttering general lorebook searches and selectors (#4333).
- Added Illustrator-style image connection, reference-image, appearance, and prompt controls to custom agents whose result type is **Image Prompt** (#4337).
- Added **Recent** as the default chat sort, based on last-message activity, while **Newest** and **Oldest** now use chat creation dates (#4341).
- Added a single-shot animation director to Roleplay Gallery **Animate**. The selected Prompt Model now plans motion, camera behavior, supported dialogue, sound effects, ambience, and an ending hold from the exchange behind the Illustrator image, while the existing image remains frame zero and Game Storyboard behavior stays unchanged. Its duration-aware instructions are editable under **Settings > Generations > Video Generation Prompt Overrides** with `${durationSeconds}` support (#4311).
- Added an external-only **Full page access** compatibility mode for legacy Browser Extensions such as WeatherTweaker. The safe opaque-origin Worker remains the default; page-level code requires both External Extension gates, explicit exact-hash approval with a dedicated high-risk disclosure, and fresh approval after every code, CSS, or permission change. Pre-sandbox `marinara.extension` v1 packages without an explicit capabilities field are classified into this review flow instead of silently failing in the Worker (#4319).
- Added Browser Personal Extension API version 5 with read-only active chat and Character identifiers, plus separately reviewable permissions for bounded snapshots of the active Character cards and selected Persona. Extensions such as Notepad can keep per-chat or per-Character state and display active profile context without gaining access to messages, full libraries, undeclared fields, chat metadata, DOM, database, network, or mutation operations (#4316).
- Added per-agent context controls for custom agents, allowing each agent to request only the chat history, Character, Persona, lorebook, summary, Author's Note, tracker, and recalled-memory context it needs (#4305).
- Added Markdown preview toggles to Character, Persona, and lorebook text fields, and rendered formatted card text in library detail views (#4306).
- Added the **Simplified Chinese** documentation language pack, covering all 124 in-app guides (developer docs included) in natural Simplified Chinese (simplified characters only, the Chinese SillyTavern community's established terms such as 世界书 and 角色卡, one term and one CJK-Latin spacing convention per concept so search always matches, product names kept in Latin script), with English UI control names preserved for following instructions against the interface and Chinese sidebar category labels in the docs viewer. Select it under **Settings → General → Documentation Language** via **Download & Replace** (#4435).
- Added the **Korean** documentation language pack, covering all 123 in-app guides (developer docs included) in natural Korean (the 합니다체 register standard in Korean software, one transcription and one spacing per term so search always matches, product names kept in Latin script with correct particle attachment), with English UI control names preserved for following instructions against the interface — glossed to match the app's Korean UI translation where a shipped string exists — and Korean sidebar category labels in the docs viewer. Select it under **Settings → General → Documentation Language** via **Download & Replace** (#4374).
- Added the **Japanese** documentation language pack, covering all 123 in-app guides (developer docs included) in natural Japanese (the polite です・ます register standard in Japanese software, one katakana spelling per term and half-width Latin and digits everywhere so search always matches, product names kept in Latin script), with English UI control names preserved for following instructions against the interface and Japanese sidebar category labels in the docs viewer. Select it under **Settings → General → Documentation Language** via **Download & Replace** (#4345).
- Added the **Russian** documentation language pack, covering all 123 in-app guides (developer docs included) in natural Russian (the "вы" address of mainstream Russian software with gender-neutral phrasing, product names kept in Latin script and undeclined so search always matches, standard Cyrillic loanword declension), with English UI control names preserved for following instructions against the interface and Russian sidebar category labels in the docs viewer. Select it under **Settings → General → Documentation Language** via **Download & Replace** (#4281).
- Added the **Polish** documentation language pack, covering all 123 in-app guides (developer docs included) in natural Polish (informal address with gender-neutral phrasing, product names kept undeclined so search always matches, standard Polish loanword declension), with English UI control names preserved for following instructions against the interface and Polish sidebar category labels in the docs viewer. Select it under **Settings → General → Documentation Language** via **Download & Replace** (#4235).

- Added an optional radial-gauge layout for Persona and Character tracker stats, with editable icons, percentage readouts, subtle low-stat warnings, and improved featured-card spacing and thought placement.
- Added the **Brazilian Portuguese** documentation language pack, covering all 123 in-app guides (developer docs included) in natural Brazilian Portuguese ("você", Brazilian vocabulary and current orthography), with English UI control names preserved for following instructions against the interface and Portuguese sidebar category labels in the docs viewer. Select it under **Settings → General → Documentation Language** via **Download & Replace**. The tutorial's language suggestion now also matches region-suffixed locales, so a pt-BR interface proposes the pt-br guides on first run (#4229).

- Added the **French** documentation language pack, covering all 123 in-app guides (developer docs included) in natural standard French with informal address, English UI control names preserved for following instructions against the interface, and French sidebar category labels in the docs viewer. Select it under **Settings → General → Documentation Language** via **Download & Replace** (#4191).
- Added the **German** documentation language pack, covering all 123 in-app guides (developer docs included) in natural standard German with informal address, English UI control names preserved for following instructions against the interface, and German sidebar category labels in the docs viewer. Select it under **Settings → General → Documentation Language** via **Download & Replace** (#4157).
- Added a **Documentation Language** selector under **Settings → General** and at the end of the first-time tutorial. Languages ship as downloadable packs from the repository's `docs-i18n` branch: **Download & Replace** fetches the selected language into the data folder with per-file integrity verification and live progress, then removes the previous language's pack, so installs carry only one language and checkouts carry none. Guides without a translation open in English with an `EN` badge, the in-app docs search works in the active language, the choice survives every update path, the first start after an update automatically refreshes the pack when its translations changed, and a **Fix documentation** failsafe verifies, re-downloads, or resets a broken pack. Forks and mirrors can point `DOCS_I18N_BASE_URL` at their own copy of the branch (#4100).
- Added the first documentation language pack: **Spanish**, covering all 123 in-app guides (developer docs included) in neutral international Spanish, with UI control names kept in English so instructions can be followed against the English interface. Contributor docs now require keeping every language pack on `docs-i18n` in step when guides change (#4100).
- Added rotating daily, weekly, or monthly automatic full backups under **Settings → Advanced → Backup & Export**, with the latest run and failure state shown in the UI (#4071).
- Added a **Retry** action to Game Mode character-sheet editing. It regenerates only the selected Persona or party member from their card and the current campaign history, keeps the result as an unsaved draft for review, and preserves the original sheet unless the user saves (#4048).
- Added a compact **New Chat** launcher to Home that explains Conversation, Roleplay, and Game before opening the selected mode's existing setup wizard (#4058).
- Added a Roleplay **Illustrator image connection** override in Chat Settings, separate from the prompt-writing connection and with the Illustrator Agent's configured image model as its fallback (#4057).

### Changed

- Matched the **Read how this agent works** action to the install, update, and uninstall button typography and styling in Download Agents.
- Made Noodle and NoodleR switch to their existing mobile layouts whenever the center pane falls below the desktop width, including when sidebars reduce the available space on a desktop device.
- Standardized resource-panel sorting controls on the shared width used by the Chats tab, so the Lorebooks selector no longer expands beyond neighboring tabs.
- Made the empty **No messages yet** chat hover preview inherit the configured app accent instead of the default theme's fixed lavender-pink.
- Kept World Maps navigation inside the **Agents** tab and **Chat Settings** by removing its dedicated launchers from the Chats sidebar and top bar.
- Advanced the stable release identity to v2.4.0 across the Engine, PWA manifest, Windows installer, Android bootstrap APK, update checks, Home release link, and Professor Mari's What's New announcement. Android uses `versionName` `2.4.0` with `versionCode` `41` so it updates over every previously published APK.
- Removed the retired Visual Novel mode identifier and its remaining compatibility branches from active schemas, runtime routing, UI labels, imports, and current documentation; Marinara's supported modes are now consistently Conversation, Roleplay, and Game (#4368).
- Capitalized the native language names in the **Settings → General → Language** dropdown (Español, Français, Polski, Português (Brasil), Русский) to match the Documentation Language selector (#4191).
- Renamed reusable Chat Settings Presets to **Settings Profiles** throughout Chat Settings, Roleplay quick setup, import/export, localization, and documentation. The word **preset** now identifies prompt presets in these flows, while existing exported profile files remain importable.
- Added a Post/Impersonate quick toggle to CYOA choices and kept centered choices clear of the Tracker panel.
- Tracker panels now appear as soon as their matching tracker agents are active, allowing starting data to be entered before the first agent run.
- Refined **Impersonate** with server-backed prompt templates shared across browsers, read-only built-in previews, full-view editing, and a direct link to Quick Replies settings.
- Made the Game dynamic-image prompt timeout configurable with `GAME_DYNAMIC_IMAGE_PROMPT_TIMEOUT_MS`, retaining 45 seconds as the default and accepting values from 10 seconds to 1 hour (#4052).
- Made Game session conclusions prepare the next playable arc with refreshed goals, quest seeds, pressure clocks, factions, and named NPCs so the following session does not inherit a stale scenario plan (#4059).

### Security

- Updated the production web server, static-file serving, request client, archive, image-processing, HTML-sanitization, MCP transport, and supporting transitive dependencies to their patched releases; the shipped dependency graph now passes the production vulnerability audit with no known advisories.
- Required normal authorization for proxy-forwarded Docker traffic by default while retaining `REQUIRE_AUTH_FOR_DOCKER_PROXY=false` as an explicit legacy opt-out for fully trusted upstream clients. Direct same-host Docker bridge/gateway traffic remains compatible with `BYPASS_AUTH_DOCKER`.
- Pinned bundled llama.cpp, MLX, and uv runtime inputs to reviewed revisions and release assets with repository-owned sizes and SHA-256 digests, and locked every MLX Python dependency to hash-verified packages. Downloads now fail before extraction or execution when their content differs, cancellation remains effective between retries, and installed runtime stamps force explicit Engine-reviewed upgrades instead of following upstream `latest` or `main`.
- Bounded NovelAI ZIP image decompression to 64 MiB, rejected oversized declared output before inflation, and required actual output to match the archive metadata so malformed or highly expanding provider responses fail safely.
- Imported webhook functions now arrive disabled with hidden chat context access removed. The Functions panel shows the destination origin and requested privileges so users can inspect the full configuration before deliberately enabling it.
- Restricted private generated-image result URLs to the configured provider's exact scheme, hostname, and port. Public CDN results remain supported, while redirects from a trusted local image provider can no longer reach another private service.

### Fixed

- Updated Professor Mari's official Agent knowledge and public catalog counts to cover all 31 downloadable packages, including Long-Term Memory and Storyboard, and corrected her package-update guidance to match the user-confirmed update flow.
- Kept Noodle and NoodleR navigation, search, stage-profile, and bulk-create icons on their blue and pink mode accents, and made lorebook entry-type descriptions inherit editor chrome text instead of the default pink foreground (#4417).
- Corrected several Korean interface strings surfaced by the Korean documentation review: stale character-card update items are now labeled 오래됨 instead of the self-contradictory 적용 불가 (the modal lets you override and apply them), the Mini Mari setting keeps the product name in Latin script, Custom Sources follows the 사용자 지정 convention, the regenerate concept is unified on 재생성 across ten strings, the Verbosity parameter reads 상세도, and the release labels use the 릴리스 spelling (#4376).
- Made Name Prefix carry each responding character's identity into post-processing Agent prompts in multi-character Roleplay while keeping rewrite agents' raw response text unchanged (#4351).
- Painted submitted Roleplay user messages before waiting for message-query cancellation, removing the multi-second gap between pressing Send and seeing the local message (#4357).
- Made every Agent Run Interval count both user and assistant messages, including custom Agents, Illustrator, Lorebook Keeper, Card Evolution Auditor, About Me Keeper, Narrative Director Secret Plot maintenance, and Roleplay Storyboards (#4360).
- Stopped PR description edits, CodeRabbit comments, and non-owner reviews from recreating the outside-contributor approval gate while retaining refreshes for base changes and approval-relevant SpicyMarinara reviews (#4361).
- Isolated desktop and mobile Playwright servers and fixture data, made help tooltips non-blocking, kept focused mobile composers open during history scrolling, and aligned appearance and Tracker smoke checks with live application state so the complete browser sweep no longer fails from cross-project mutations or stale assertions (#4343).
- Built the shared workspace before `pnpm dev:server` and documented the rebuild-and-restart boundary for shared source changes (#4327).
- Removed Windows child-process calls that combined argument arrays with `shell: true`, eliminating Node.js DEP0190 warnings from startup, updates, native dependency repair, and client builds (#4332).
- Stopped generic OpenAI-compatible connections from inheriting `reasoning_effort` for unknown models, added an explicit **Off** option that sends `none`, and made the Advanced Parameters toggle omit reasoning fields entirely (#4335).
- Skipped corrupt or undecodable Noodle timeline images before captioning and multimodal generation, allowing the refresh to continue with text instead of forwarding invalid bytes to the model (#4310).
- Added the missing delete action for generated scene videos in the Chat Gallery, including destructive confirmation, pinned-view cleanup, and removal of only the selected video file and metadata (#4314).
- Made Professor Mari honor requests for only the last N chat messages or messages after a displayed post number, with range-aware pagination that no longer broadens those requests into whole-chat reads (#4308).
- Trimmed leading and trailing whitespace from Character names when cards are saved or imported (#4303).
- Made Memory Recall discard superseded message revisions and inject only the current edited message text (#4304).
- Made the right-side Character and Persona searches use the same creator, version, notes, profile fields, tags, and Unicode-safe matching as their full libraries, so author searches no longer discard valid results (#4299).
- Made Dynamic LLM Prompt generation for Game backgrounds read the latest completed GM turn as its primary scene source for both scene-analysis and Gallery requests, instead of merely rewriting the deterministic fallback prompt (#4300).
- Corrected small factual defects in the guides found during translation review: the **Text & Scale** chat-text section now says four controls (not three), the chat-backgrounds save-location list now says three settings (not two), a link to the Card Browser guide no longer uses the tab's pre-rename "Browser" title, and six occurrences across five quoted button labels (**Search models…**, **Creating backup…**, **Switching…**, **Checking…**, **Refreshing…**) now use the same ellipsis character the app actually renders, so copying them into the docs search matches the interface. Mirrored across every language pack on `docs-i18n` (#4282).
- Made `CHAT_GENERATION_TIMEOUT_MS` govern the time-to-first-byte budget for background generation as well, so a slow local model no longer fails the Noodle timeline refresh with `HeadersTimeoutError` / "fetch failed" after a fixed five minutes. The default stays at five minutes; raise the variable to give slow local models more room (#4174).
- Documented the **Documentation Language** control in the settings overview guide (in English, Spanish, and German), and made the **Fix documentation** toast report what actually happened — pack re-downloaded, guides reset to English, or leftovers cleaned up — instead of always claiming a reset (#4158).

- Rendered indented code fences correctly in the shared markdown renderer: a fence nested inside a list item (as in several developer guides) previously never closed and showed its ` ``` ` markers as literal text in the docs viewer, and list-nested code no longer renders or copies phantom leading spaces (#4100).
- Replaced the unsafe built-in **Clean HTML (Outgoing Prompt)** regex with a validator-safe tag cleaner and migrated unchanged legacy defaults, restoring HTML and group-speaker-tag cleanup for Immersive HTML and Agent prompt history without overwriting customized scripts (#4101).
- Streamed native profile and full-backup ZIP exports to disk with bounded JSONL table shards, preventing large libraries from failing with `Invalid string length` while preserving preview/import compatibility and archive integrity checks (#4064).
- Included the live Character or Persona card as the first, explicitly labelled current revision in version history; saved revisions now show stable sequence numbers and second-precision edit times (#4040).
- Made Conversation composer chrome focus the real text field, kept mobile thinking controls clear of participant names, and repaired the downloadable Calls surface's mobile participant labels and seven-button control rail (#4053, #4054).
- Removed checked marks from unselected Character and Persona multi-select controls (#4055).
- Enforced case-insensitive, globally unique public Noodle handles across Personas and Characters, including deterministic suffixes for auto-created profiles and reconciliation of older collisions (#4056).
- Routed Krea models through OpenRouter's dedicated Images API while retaining image-only modality detection for every current `krea/` model (#4061).
- Rewrote incomplete legacy UI-settings blobs with newly synced preferences, preserving an explicitly disabled Game Text Effects setting across staging updates (#4062).

## [2.3.5]

### Added

- Added a built-in **kaomoji picker** to the composer (a `(◕‿◕)` button beside the emoji picker in Roleplay/Game, and a Kaomoji tab in the Conversation media panel) with categories and fuzzy keyword search, so emoticons like `¯\_(ツ)_/¯` and `(╯°□°）╯︵ ┻━┻` can be inserted without leaving the app (#4038).
- Added user-defined **Custom Quick Replies**: create your own buttons in **Settings → General → Quick replies** that each send a fixed message, macro, or `/slash` command from the quick replies menu beside Send, in both Conversation and Roleplay/Game input (#4024).
- Added a **Show Only Translation** toggle to **Chat Settings → Translation** that displays just the translated text in place of the original once a message is translated, and rendered translated text through the same markdown pipeline as messages so bold, italics, and quotes format correctly (#4024).
- Added an `AGENT_CALL_TIMEOUT_MS` override for agent LLM calls (trackers, HTML reformatter, and other agents). The previous fixed 5-minute cap cancelled slow local models mid-stream and then burned a second 5 minutes on the automatic invalid-JSON retry; the cap is now configurable from 10 seconds to 1 hour and documented next to `CHAT_GENERATION_TIMEOUT_MS` (#3958).

- Added safe host-rendered contribution slots to Browser Personal Extensions. `marinara.ui.registerContribution(...)` can add themed top-bar buttons, Extensions menu items, and right-side panels containing bounded text, actions, inputs, selects, toggles, sliders, and color controls. Marinara validates and renders every descriptor while activation and form events return only to the exact-hash-approved sandbox Worker; extensions never receive host DOM, markup, styling, React, network, or direct API authority. The existing constrained `marinara.ui.showWindow(...)` window supports the expanded controls as well.
- Added Atlas Cloud as an image and video generation service, including curated starter models, text/reference image requests, asynchronous job polling, connection tests, and Game/scene-video routing (#3989).
- Added an Android-only **Show Android status bar** control under **Settings > General > App Behavior**, preserving fullscreen as the default while allowing the Android app to remember and restore the time, battery level, and notification icons across restarts (#3985).
- Added the UI-localization foundation with English fallback, lazily discovered locale JSON files, live Arabic, Chinese, French, German, Hindi, Japanese, Korean, Polish, Portuguese, Russian, and Spanish selection in **Settings > General**, contributor validation and documentation, and locale propagation into downloadable Agent interfaces (#3978).
- Reintroduced disabled-by-default **Personal Extensions** in **Settings > Addons** as Professor Mari-authored drafts that require the user to inspect and approve the exact SHA-256 fingerprint. Third-party imports now live in a separate **External Extensions** section that remains hidden until the host sets `ENABLE_EXTERNAL_EXTENSIONS=true` and the user accepts the Danger Zone warning and opt-in.
- Added review-gated public npm dependencies for Professor Mari's workspace changes. She can request a root, client, server, or shared package, but Marinara resolves it to an exact registry version and integrity and waits for the user before installing it with lifecycle scripts disabled.
- Added **Set as avatar** to Character and Persona Gallery images in both the grid and full-size viewer, using path-contained, image-validated server copies (#3974).
- Added separate Model and user target languages plus independent outgoing and incoming AI prompts to chat translation. Custom prompts support the `{{targetLanguage}}` placeholder, while existing single-language chat settings remain compatible (#3965).
- Added a per-chat **Images Per Generation** setting to Illustrator in Conversation, Roleplay, and Game, generating up to four sequential image variants through the existing provider queue and gallery pipeline (#3966).

### Changed

- Reworked the Chat Settings **Prompt Preset** area. Roleplay now shows the preset-section editor directly once a preset is selected instead of hiding it behind a collapsible toggle. Conversation and Game show the effective Conversation/Game prompt (from the selected preset, or the built-in default when the preset has none) in an inline editor you can type in directly, expand to a full window, and browse macros from — and the redundant "open selected preset" shortcut button was removed. Chat Settings now also remembers which sections you left expanded and restores them the next time you open the drawer.
- Synchronized the stable release identity as v2.3.5 across the Engine, PWA manifest, Windows installer, Android bootstrap APK, update checks, Home release link, and Professor Mari's What's New announcement. Android uses `versionName` `2.3.5` with `versionCode` `40` so it updates over every previously published APK.
- Confined Professor Mari's raw shell commands to macOS Seatbelt or Linux Bubblewrap with outbound network denied, inherited server secrets removed, environment-secret and Git-internal files unreadable, and filesystem writes limited to ordinary workspace files and a private temporary directory. Dependency manifests, lockfiles, launchers, installers, and CI workflows are read-only in the shell and use an explicit in-chat review; raw package-manager mutations are blocked even when a package is cached. Raw shell now fails closed when no supported sandbox is available, while structured workspace and app-data tools remain available (#3973).
- Made **Default Dialogue Color** permanently active for cards without their own dialogue color and removed its redundant Appearance toggle; Character and Persona card colors still take priority.

### Security

- Replaced full-trust Personal Extension execution with capability-restricted sandboxes. Browser code now runs in a watchdog-supervised Worker inside an opaque-origin iframe without Marinara DOM, origin, or network access. Server code now runs in a separate Node process under macOS Seatbelt or Linux Bubblewrap with a minimal environment, Node permissions, private protocol files, resource/message bounds, and no user-file, Marinara-file, network, child-process, worker, native-addon, or cross-process signal authority. Unsupported server platforms fail closed. External, legacy, profile-imported, manually stored, and unknown-source records remain invisible and unexecutable until both external-extension gates are open; closing either gate disables and stops them.
- Rejected untrusted HTTP Host names before CORS, loopback authentication bypasses, or privileged reads can process a request, preventing DNS rebinding from exposing chats, galleries, backups, and other local data. Direct LAN, Tailscale, IPv4, IPv6, localhost, and local machine-name access remains available, while intentional public and reverse-proxy names can be added through `TRUSTED_HOSTS`.
- Replaced silent startup updates for installed Agent packages with a responsive per-version confirmation. Choosing **No** records that decision without changing the installed package, and the existing **Update** action remains available in **Agents → Download Agents**.
- Restricted official Agent catalog artifacts to their canonical Marinara-Agents repository URLs while preserving explicit custom-catalog overrides.

### Fixed

- Kept the mobile chat composer above the Android Firefox software keyboard by explicitly requesting content
  resizing and sizing the app shell to the smallest live visual/layout viewport, including delayed keyboard geometry
  updates after focus (#4044).
- Improved character and persona card version history: restoring an older version now saves the current card to history first (so the newer version is never lost), each saved version keeps its own edit timestamp instead of the later save's time, and the side-by-side comparison view wraps long unbroken text such as URLs and HTML in creator notes instead of overflowing (#4040).
- Made Settings tabs—including **Appearance**—resolve duplicate English labels against the selected locale instead
  of falling back through an unrelated untranslated key, and routed the remaining static client interface copy,
  editor and library controls, chat toolbars, notices, accessibility text, and Noodle surfaces through the English
  localization catalog with an automated untranslated-UI audit.
- Moved Character and Persona creator/version metadata beside the editable card name in editor headers, with responsive truncation that preserves the version and keeps long names from displacing header actions.
- Stopped Conversation **Selfie** mode from pasting the image style profile's Generation Style Text verbatim into the final image prompt. The style now guides the prompt-building model (matching Roleplay illustration), so it still shapes the image without the redundant, CLIP-diluting copy (#4028).
- Moved the Natural/Random progression choice onto the **Push Story** button: clicking it now opens a Naturally/Randomly selector that arms the chosen mode for the next response, replacing the mode controls previously buried in **Chat Settings → Agents → Narrative Director**, the add-agent setup, and the Narrative Director editor's Story Push Mode default (#4022).
- Fetched the full Google Gemini model catalog in the connection editor by following the ListModels pagination, and refreshed the built-in Gemini/Gemma fallback list with the latest entries (#4021).
- Gave in-app updates realistic install budgets on slow devices — update steps get four times as long on Android/Termux, where switching between stable and staging forces a near-full dependency reinstall — and update failures now report the failing pnpm step, timeouts, and the tail of the process output instead of an opaque `Command failed` (#4020).
- Refreshed single- and multi-message deletion with the shared modal and control styling, including chroma-driven buttons, selection bars, checkboxes, and selected-message highlights instead of fixed destructive pink or red treatments.
- Restored the immediate **Thinking…** placeholder in Roleplay and made Conversation and Roleplay expose one reasoning control as soon as the first reasoning chunk arrives. The existing Model Thoughts viewer now stays open and updates with the live reasoning stream, while completed messages retain their saved reasoning control (#3963).
- Fixed Web Search (and other tools) returning empty or malformed parameters with GPT-5.6/5.5/5.4 and Codex models on the OpenAI Responses API. Streamed function-call arguments are keyed by the response item id rather than the call id, so the tool query is no longer dropped mid-stream (#4010).
- Kept gradient **Accent Pulse** animating while the Appearance tab is open, so color changes can be previewed where the setting is configured.
- Reworked Character and Persona avatar editing with a non-overlapping miniature AI wand, equal Upload/Generate actions in Metadata, a downward upload arrow, and accent-colored removal controls. Game Assets selection, menu, and removal states now follow the configured chroma instead of fixed pink or red treatments.
- Fixed Character Tavern imports from the Card Browser: their cards store character data in compressed zTXt PNG chunks, which every Marinara card parser (Card Browser import, file/URL import, SillyTavern bulk import) now reads alongside tEXt and iTXt. Re-exporting such a character also strips the stale compressed data instead of shipping outdated card JSON (#4002).
- Fixed the Windows launcher crash `ERR_INVALID_URL_SCHEME` in `protect-launcher-data.mjs` (and the same latent pattern in `read-launcher-env.mjs`): the run-directly guard now resolves `process.argv[1]` with `pathToFileURL`, so drive-letter paths no longer parse as URL schemes, update snapshots are created again, and auto-update is no longer skipped (#3997).
- Listed ComfyUI models from the DiffusionModels folder (UNETLoader) alongside StableDiffusion checkpoints in the connection editor's "Fetch models from API", so models such as Anima and zImage are selectable without typing their names manually (#3993).
- Let the Custom sound description use the full Settings card width and moved its actions below the copy so labels and buttons no longer collide on narrow screens.
- Made installed theme icons and the third-party extension warning follow the selected accent color instead of hard-coded pink or yellow styling.
- Disabled Venice.ai's optional `safe_mode` blur in native image requests so supported generations are returned without the provider's default censoring overlay (#3990).
- Protected launcher-driven Engine updates with a private snapshot of the configured user-data directory outside the checkout and automatic restoration if an update attempt leaves that directory missing or empty. Launcher dependency refreshes now use the pinned lockfile instead of destructive forced reinstalls, preventing the Windows Fastify plugin type failures reported after v2.3.4 updates (#3961, #3976).
- Installed and verified Sharp's WebAssembly runtime on Termux while suppressing unsupported Android native source builds, restoring NovelAI Precise Reference preprocessing without requiring an Android NDK (#3975).
- Re-checked Do Not Disturb immediately before delayed foreground, exchange, and background autonomous generations, so enabling it while a message is waiting reliably suppresses that message (#3959).
- Allowed an Agent explicitly assigned to Local Sidecar to start that runtime on demand even when the global tracker-sidecar default is disabled (#3960).
- Made explicit Gallery **Illustrate** actions generate the requested image even when the Illustrator's automatic-generation decision says no (#3963).
- Kept Conversation bubbles within the mobile viewport and exposed live Model Thoughts while a response is still streaming (#3964, #3971).
- Saved image, video, and provider-default connection parameters before the final connection refresh, preventing stale cached defaults from replacing the user's latest values (#3972).
- Enlarged generated image attachments in Conversation and Roleplay while keeping them contained within the chat viewport (#3966).
- Restored per-game asset-folder selection in the new-game wizard, kept existing-game selection in the Asset Browser, anchored asset action menus to their buttons without viewport clipping, and stopped bundling the unrelated generic fantasy sprite pack (#3962).

## [2.3.4]

### Added

- Added a read-only latest-release check to the Windows, macOS/Linux, and Termux launchers when automatic Engine updates are disabled. A newer published version now produces a console reminder with the installed version and its release-page link, while `--skip-update` still suppresses all update checks for one launch.
- Added Grouped and Individual response modes to multi-character Conversations, including sequential, smart, manual, mention-directed, and autonomous character selection with a shared daily check-in budget and a token-use warning (#3887).
- Added the user's current local time to every Noodle timeline refresh and an optional setting for attaching participating characters' existing generated schedules for the current day (#3886).
- Added disabled-by-default custom GitHub agent repositories to Agents Manager, with manual preview/apply, explicit trust confirmation, stable sync identity, and bounded SSRF-safe archive validation (#3861).
- Added explicit numeric overrides for Conversation chat check-in ceilings and removed the 50-message ceiling from Conversation and Roleplay recent-summary tails, while retaining conservative defaults and cost guidance (#3864).
- Added **Noodle** to Lorebook entry Generation filters so entries can target Noodle context without being injected into other generation paths (#3842).
- Added per-character **Hide From AI** controls to Roleplay group chats, with avatar-based multi-selection, recipient markers, and character-scoped prompt history while preserving the existing global hide option.
- Added `||` (OR), `&&` (AND), parentheses, and equality-list shorthand to conditional prompt macros, with matching in-app and documentation examples.
- Added the `{{group}}` prompt macro for listing every other active chat character, including during targeted Roleplay group generation.
- Added a chibi Professor Mari artwork icon to Marinara's Universal Preset for existing and new users.
- Added local ComfyUI video generation for API-format WAN and other workflows, including prompt, size, seed, frame-count, and uploaded first-frame placeholders (#3804).
- Added an in-app and GitHub ComfyUI workflow guide covering API-format exports, Marinara placeholders, local and RunPod reference-image inputs, character-specific workflows, LAN setup, VRAM constraints, and troubleshooting (#3749).

### Changed

- Synchronized the stable release identity as v2.3.4 across the Engine, PWA manifest, Windows installer, Android bootstrap APK, update checks, Home release link, and Professor Mari's What's New announcement. Android uses `versionName` `2.3.4` with `versionCode` `39` so it updates over every previously published APK.

### Fixed

- Removed the extension feature completely: all extension CSS, browser, and server payload execution is gone; its Settings surface, client hooks, shared contract, and API routes were deleted; startup now permanently erases every retained server record and `extension-storage:*` setting; and the UI-state migration removes browser-local extension records automatically. The extension authoring guides, examples, and Professor Mari instructions were removed with the feature.
- Prevented imported agent files from installing bundled custom functions, granting themselves tool access, or overwriting a curated Agent by reusing its internal type. Agent exports no longer bundle function definitions, and imported agents receive a fresh custom identity that requires the user to review and explicitly attach tools afterward (#3953).
- Kept healthy SSE replies streaming after a backgrounded tab becomes visible again, using a grace period before falling back to the persisted full response only when the resumed stream makes no progress.
- Expanded Music DJ's shared recent-track history to 250 Spotify tracks so 50-song candidate batches rotate across large playlists instead of repeatedly drawing from the same small recent window.
- Removed the Background agent's obsolete image-generation toggle and runtime path. The agent now only selects existing library backgrounds, while Illustrator owns automatic and Gallery background generation. Gallery-generated backgrounds are applied to the active Roleplay chat instead of being attached as ordinary illustrations.
- Stopped Roleplay generation immediately when **Stop** is pressed by sending the explicit server cancellation through the authenticated API client instead of allowing CSRF protection to discard it.
- Made renamed Chat Summary preset markers use their authored wrapper name and resolved character-dependent summary macros against each individual group responder, allowing conditional summary knowledge to remain scoped to its intended character.
- Kept Chat Summary entry editing responsive by isolating the live title and content draft from the rest of the summary popover until **Save** is pressed.
- Kept automatic Roleplay Illustrator images on the same configured illustration canvas and requested orientation as manual Gallery generation, instead of leaving unattended images in a portrait/selfie-shaped layout (#3893).
- Expanded Professor Mari's chat composer through approximately six lines before it scrolls internally (#3885).
- Consolidated Cross-Chat Awareness under Connected Chats and restored normal spacing between Noodle references and Discord webhook controls (#3889).
- Persisted enabled Conversation Selfie setup with its command toggle and default image-generation connection, keeping Generated Selfies active after chat creation (#3890).
- Made Conversation character mentions always select the mentioned responder or responders, including legacy manual-response chats, and removed the redundant Reply When Mentioned toggle (#3891).
- Made Conversation setup connect enabled Illustrator selfies to the default image-generation connection instead of leaving Generated Selfies inactive (#3880).
- Recovered every Noodle timeline collection when local models return adjacent JSON objects, preserving posts and interactions alongside follows instead of parsing only the final object (#3881).
- Routed Character and Persona sprite downloads through the Android shell's native file saver and stacked the sprite Upload action beneath its expression field on mobile so it stays inside the card (#3884).
- Kept the desktop Tracker Panel out of the centered Roleplay chat column, shrinking it, responsively reflowing its controls, and proportionally scaling its typography to the available side gutter on narrower screens instead of shifting messages and the composer sideways or clipping its contents.
- Stacked a top-corner Echo Chamber below the open Tracker Panel on the same desktop side and constrained its message area to the remaining visible height instead of letting the two panels overlap or spill below the screen.
- Kept each historical user turn under the Persona that sent it when Name Prefix History is enabled, instead of relabeling every user message with the currently selected Persona.
- Accepted the single-object array wrapper some local models return for generated Noodle profiles, preventing timeline refreshes from failing with HTTP 500 during first-time bio generation (#3871).
- Gave current semantic lorebook matches the same context-budget priority as current keyword matches, so configured entry order—not activation method—decides which entries are attached when every match cannot fit.
- Simplified Peek Prompt's exact-request view by removing redundant provider-formatting guidance.
- Returned parsed chat metadata and character IDs from public chat reads so fresh sidebar tag filters match the shared API contract (#3857).
- Deep-merged partial nested Character PATCH fields without materializing destructive defaults, preserving omitted extensions and embedded-lorebook data (#3858).
- Validated and normalized native Marinara character cards before persistence while preserving unknown embedded-lorebook properties (#3859).
- Applied enabled Connection generation defaults across every Noodle text-generation path and allowed custom OpenAI-compatible endpoints to receive explicitly enabled top-k, reasoning-effort, and verbosity parameters (#3845).
- Kept dynamic NPC portrait prompt rewrites authoritative, resolved a usable text connection instead of silently bypassing enabled rewrites, allowed custom non-JSON output, removed legacy reputation-note leakage, and preserved explicit non-human species cues (#3846).
- Removed unused agent/turn-game contract members, obsolete generated registries, duplicate tool arrays, Visual Novel types, chat-mode definitions, and redundant public aliases while preserving legacy downloadable-agent package parsing (#3847, #3848).
- Regenerated merged Roleplay group replies with the full active character roster instead of narrowing the prompt to the previously saved speaker (#3850).
- Made the Character editor's **Copy ID** action work on mobile and non-secure browser contexts and report only confirmed clipboard success (#3851).
- Deprecated the two provider-visible no-op image-style rule flags while retaining their normalized persisted shape throughout 2.x for compatibility (#3852).
- Added successful-download notices asking users to completely restart Marinara Engine after installing the local Gemma model or Local Whisper for Calls and Videos.
- Updated the curated Gemma GGUF download sizes to match the current upstream files, preventing false file-size mismatch failures after their metadata changed (#3843).
- Matched Roleplay's Active Context lorebook details to Conversation and Game, including activation sources, matched keys, semantic scores, current-location grouping, budget skips, and expandable entry content (#3840).
- Kept the Roleplay **Hide From AI** action on the selected chroma/accent color and suppressed the browser's transient tap-highlight color.
- Smoothed Roleplay typing and streamed replies by batching draft-state publication, pacing the Typewriter effect against bursty provider delivery, and replacing the repaint-heavy streaming glow with an opacity pulse (#3836).
- Kept selected Roleplay backgrounds fitted to the resized chat area and repainted weather effects immediately after relayout, preventing Firefox flashes as desktop sidebars open and close (#3836).
- Changed the TTS dialogue pause control to whole seconds from 1 through 60, migrating legacy sub-second and no-pause values to the new 1-second minimum.
- Kept Character and Persona prompt sections in editor order across preset markers, fallbacks, agent lore, and Game/scene card contexts: Description, Personality, Backstory, Appearance, Scenario, then Example Dialogue when present (#3817).
- Made PocketTTS server voices directly selectable for global, character, and narrator assignments while retaining custom voice IDs, URLs, and paths, and aligned new PocketTTS setups with the compatible server's default endpoint (#3786).
- Streamed Roleplay and Game scene-video files with standard byte-range and HEAD handling instead of synchronously buffering complete MP4 files for every playback request (#3811).
- Stopped the macOS/Linux and Termux launchers from sourcing `.env` as Bash code; launcher-owned settings now use Node's non-evaluating dotenv parser while preserving ambient-environment precedence (#3810).
- Routed the Roleplay Gallery's **Background** action through Illustrator's background prompt mode instead of bypassing the agent with a raw scene-generation prompt (#3809).
- Kept the full active Roleplay roster available while assembling a targeted character prompt so `{{group}}` lists the other character cards instead of resolving empty in manual group generation.
- Applied the selected chroma text color to installed theme names in Settings > Addons instead of inheriting the hard-coded pink accent.
- Persisted successful Roleplay tracker re-runs against the visible tracker state when a refreshed scene has no assistant reply yet, instead of spending the agent call and then reporting that no tracker changes were returned.
- Vertically centered the Character editor's Regex Script edit and delete actions against each script's enable toggle.
- Restored Character and Persona tracker-card color settings so appearance changes update the card preview immediately and persist when saved.
- Stopped HTML-escaping angle brackets in prompt leaf content so character card fields, persona, lorebook entries, memories, and scene text now reach the model verbatim — `<thinking>`, `<scenario>`, and inline HTML like `<div>` are passed through as written instead of arriving as `&lt;thinking&gt;`, which had been corrupting cards, breaking roleplay HTML, and showing raw `&lt;` in the editor. This finalizes prompt leaf content as verbatim and **supersedes** the `<`/`&` prompt-boundary escaping added in #3108 (line above) and the untrusted-card-text escaping in the "Hardened prompt assembly" entry below, for Marinara's local single-user threat model. The framework's own structural section wrappers are emitted around this content and are unaffected, and the agent value/attribute escapers are unchanged (they still escape values into machine-parsed XML).
- Made image prompt review display the subject-count-resolved dimensions actually sent to native NovelAI, kept Prompt Prefix count tokens out of scene sizing, and filled new NovelAI settings for legacy partial profiles (#3758).
- Made recalled memories, cross-chat awareness, connected Roleplay/Game context, and their command instructions honor the active Conversation preset's XML, Markdown, or unwrapped format instead of emitting hardcoded XML (#3753).
- Kept existing cropped Character and Persona avatars contained inside editor upload targets and prevented escaped image layers from hijacking page clicks (#3741, #3939).

## [2.3.3]

### Added

- Added `CHAT_GENERATION_TIMEOUT_MS` for slow Conversation, Roleplay, and Game providers and `AUTO_UPDATE_ENABLED=false` for persistent launcher update opt-out on Windows, macOS/Linux, and Termux, without disabling manual updates (#3730).
- Added persistent NovelAI V4.5 style plates with independent strength and fidelity, plus optional subject-count framing that selects portrait, square, or landscape dimensions (#3725, #3726).
- Added compatibility-aware official Agent catalog selection so each Engine major installs and updates only from its matching catalog lane (#3712).
- Added configurable pauses between generated TTS dialogue lines, with the saved preference shared across playback sessions (#3718).

### Changed

- Synchronized the stable release identity as v2.3.3 across the Engine, PWA manifest, Windows installer, Android bootstrap APK, update checks, and Home release link. Android uses `versionName` `2.3.3` with `versionCode` `38` so it updates over every previously published APK.

### Fixed

- Removed the redundant **Maps** and **Conversation Game** kind badges from Agent catalog details while preserving their manifest metadata, catalog filtering, and search labels (#3736).
- Kept native selector labels and their shared Agent and Lorebook editor shells visually stable while Accent Pulse is enabled, including Hierarchical Maps, Agent Connection Override, Lorebook Prompt Position, and Connection Defaults controls (#3733).
- Added a clearly labeled avatar upload/replace field above Name in Character Metadata, reusing the same upload and crop flow as the editor portrait so the action is discoverable on desktop and touch devices.
- Accepted dot or comma decimal input for Connection temperature, top-p, and other generation parameters without truncating fractional values (#3713).
- Kept mobile Game CYOA choices visible between compact widget rails and exposed a direct host action from the world-map surface to the full hierarchical map editor (#3691).
- Prevented duplicate style and appearance instructions in image-generation prompts while preserving configured styles through compact-token and final prompt-length limits (#3728).
- Stopped the v2.3.2 capability migration from selecting Hierarchical Maps in every Roleplay, Visual Novel, and Game chat. A one-time correction removes only the accidental selections from chats without existing map definitions or snapshots, preserving intentional Maps usage and all other agent selections (#3723).
- Made Hierarchical Maps obey each chat's **Enable Agents** master toggle across Roleplay and Game UI, prompt generation, lorebook previews, retries, tracker state patches, session carryover, and checkpoints. Disabled chats no longer initialize or call Maps services.
- Quarantined incompatible Hierarchical Maps 1.0.x runtimes before their database adapter can load, preventing the recurring `t.select is not a function` crash while leaving compatible package updates available.
- Prevented pending Game tracker edits from calling Hierarchical Maps in chats where it is inactive, eliminating the **Failed to flush 1 game-state patch callback** error that blocked message sends.
- Reset stale Character-panel search, tag, favorite, and scroll filters during the v2.3.3 update and made them session-only, so reopening Marinara shows the complete Character collection instead of an old filtered subset. Full Library sorting and position preferences remain preserved.

## [2.3.2]

### Added

- Added capability API 1.3 host services for downloadable packages, including safe model routing, persistence, history/checkpoints, resources, logging, transactions, client contribution loading, and visible readiness/retry states (#3690).
- Added reusable Game setup exports and imports. Initial Game Setup downloads now produce versioned `.marinara-game-setup.json` bundles that can refill the New Game wizard, remap available local resources, warn about missing ones, and require a replacement GM connection when necessary (#3701).
- Added Venice.ai as an Image Generation service, including authenticated live image-model discovery and native `/image/generate` support with model-aware sizing and validated base64 responses (#3682).
- Added responsive Background library folders, desktop and touch drag-and-drop organization, A-Z/Z-A/Newest/Oldest sorting, and collapsible tag filters without limiting the Background agent's available choices (#3678).
- Added Conversation, Roleplay, and Game compatibility badges to Download Agents, including catalog search by supported mode (#3676).

### Changed

- Synchronized the stable release identity as v2.3.2 across the Engine, PWA manifest, Windows installer, Android bootstrap APK, update checks, Home release link, and What's New announcement. Android uses `versionName` `2.3.2` with `versionCode` `37` so it can update over every previously published APK.
- Moved Conversation **About Me** drafting from per-editor **AI Write** controls to Professor Mari. Character and Persona Convo editors no longer expose a separate model connection or source settings; Professor Mari can inspect a saved character or persona, write the bio in their voice, and save it directly to the real About Me field.
- Changed Noodle refreshes to choose active participants before first-time profile generation, skip characters that already have generated profiles, and send only the selected character cards to the timeline model. World/lore context and chat carryover now each have an 8,192-token budget so large invited rosters cannot inflate unrelated generations.
- Renamed current user-facing Conversation Calls references to **Calls** while preserving package IDs and legacy compatibility symbols (#3676).
- Moved Hierarchical Maps controls inside its active entry in Chat Settings → Agents instead of displaying a separate top-level settings section (#3679).

### Fixed

- Kept new Roleplay chats Persona-less when the user selects no Persona, including the first optimistic message snapshot, provider prompt, scene generation, and combat context; only Conversation mode may fall back to the globally active Persona.
- Removed Roleplay Summary's 2,000-character truncation for each source message and the 64 KiB compiled-summary ceiling in `chats.json`, so chapter-length messages and accumulated summaries remain complete unless the selected model rejects the request.
- Preserved greetings, example dialogue, creator notes, system prompts, post-history instructions, character versions, and alternate greetings when Professor Mari or another app-data caller updates an unrelated Character Card field (#3708).
- Restored native undo and redo in shared text editors, including lorebook Content and Description fields, and made `Tab` / `Shift+Tab` indent or unindent every selected line without replacing the selection.
- Resolved `{{user}}`, `{{char}}`, and other prompt macros in opening greetings and `/guided` instructions at the final provider boundary, including lorebook routing and embedding scans, so late prompt injections cannot send raw identity placeholders to models (#3704).
- Raised Conversation routine-summary generations from a 512-token ceiling to an 8,192-token default, honored larger Connection overrides, and requested low reasoning effort so reasoning models still return visible summaries (#3696).
- Allowed selected custom agents to run in Conversation, Roleplay, and Game chats whenever **Enable Agents** is on, while preserving per-mode availability rules for official packages (#3692).
- Applied saved Connection Custom Parameters to every API-backed text generation that uses that connection, including Noodle and custom endpoints hosted locally, while preserving per-chat and per-call overrides.
- Routed bare Cohere API roots and versioned API URLs through Cohere's OpenAI-compatible endpoint.
- Kept the Noodle Carryover mode buttons equal-width while scaling their labels to remain fully visible with consistent spacing before each checkbox.
- Made installed Conversation games appear immediately in slash-command autocomplete and activate or deactivate their command and runtime contributions without an Engine restart, while route-bearing packages retain their safe restart path (#3699).
- Improved tracker-toolbar keyboard navigation with stable focus order, arrow/Home/End movement, and focus restoration when Escape closes the toolbar.
- Reported Agent catalog HTTP failures with their actual status and error instead of diagnosing every failure as an internet outage, while preserving installed agents offline (#3706, #3707).
- Made `@handle` mentions in Noodle replies open the referenced profile, and resolved active Persona, Character, and linked lorebook macros before Noodle refresh prompts reach the model (#3687).
- Let Connection Custom Parameters preserve arbitrary JSON values and convenient bare string values instead of discarding invalid drafts, and restored unified reasoning-effort requests for dynamically discovered OpenRouter models (#3688).
- Fixed the downloadable Conversation Calls package persisting a hardcoded assistant reply when typed-message generation failed. Package v1.0.4 no longer requires provider-native JSON mode and reports genuine provider failures instead of inventing character dialogue (#3685).
- Made native profile imports atomic across file-storage rows and assets. Present archive assets are now fully decompressed, CRC-checked, and staged before live mutation; table upserts run in a serialized transaction; and promoted files roll back if a later write or durable database flush fails, while missing assets remain warning-only (#3683).
- Fixed generated and manually replaced Game Journal NPC portraits failing to update when a reputation label was appended to the NPC name. Portrait matching now treats the display label and the tracked NPC as the same character throughout the live session (#3681).
- Increased the final Game setup generation watchdog from 300 to 500 seconds so large GM blueprints have enough time to finish without extending unrelated in-session generation limits (#3684).
- Fixed merged Roleplay group prompts stripping every historical speaker-tag example. The latest assistant message now keeps its `<speaker>` wrappers while older tags are still trimmed, and the instruction remains inside `<output_format>` when available or otherwise appends to the last user message (#3673).
- Preserved the **Enable Agents** master switch during the v2.3 capability migration, so upgrading cannot silently reactivate selected agents or their model calls. Hierarchical Maps now remains independently available when selected (#3669).
- Made the v2.3 capability migration restart-safe by writing its completion marker only after per-chat selections are migrated and flushed to durable storage; interrupted migrations retry idempotently on the next startup (#3670).
- Fixed Conversation Calls failing to recognize downloaded Local Whisper models when `DATA_DIR` was not explicitly configured. Downloaded capability runtimes now inherit Engine's resolved host data directory instead of deriving a private nested model path (#3671).
- Fixed Professor Mari returning blank character or lorebook generation turns, normalized common character-card field names, and made lorebook creation save generated entries atomically (#3674).
- Fixed Tic-Tac-Toe failing to render when an installed legacy game client expects React on the global scope (#3675).
- Kept cropped Character and Persona avatars contained inside the Colors message preview, including cards with additional sprites, instead of letting the preview image cover the editor (#3678).
- Kept the Roleplay-default star anchored in one place when its selected state changes (#3678).
- Vertically centered Chibi Professor Mari in her surprise-visit toast (#3678).

## [2.3.1]

### Added

- Installed official agents and feature packages now check the Marinara-Agents catalog during server startup and automatically upgrade to the newest compatible version before their runtimes activate. Offline, incompatible, missing, or failed package updates leave the previously installed version available, while verified server-runtime failures continue to roll back automatically.
- Conversation schedule creation now includes a global timezone selector that defaults to the browser-detected IANA timezone, can be overridden or reset to the current device zone, syncs across devices, and applies to existing and future Conversation chats. Schedule generation, presence, autonomous messages, temporal prompt context, and background server polling now honor the same saved selection.

### Changed

- Began the v2.3.1 development cycle and synchronized version metadata across packages, the PWA manifest, README release pointer, Windows installer sources, Android APK metadata, and shared update checks.
- Android `versionName` is `2.3.1` with `versionCode 35`.

### Fixed

- Restored passwordless localhost access to container installs on Docker Desktop and custom Docker address pools. Docker runtime trust now recognizes the container's exact default IPv4 gateway in addition to the conventional `172.16.0.0/12` bridge range, while the existing `BYPASS_AUTH_DOCKER=false` and proxy-auth controls remain available.
- Fixed Windows installs and updates failing during the shared-package build with `'pnpm' is not recognized` when the launcher correctly used Corepack without a global pnpm executable. The shared build now cleans its artifacts directly through Node, and the Windows installer guard prevents nested package-manager calls from returning.
- Reworked Conversation prompt assembly so Peek Prompt groups Conversation turns under **Chat History**, character join/leave notices become timestamped history events only after a chat has actually started, reaction syntax lives inside **Commands**, and merged-group speaker-prefix and character-only response boundaries are emitted last in the preset's XML, Markdown, or plain output format. The built-in Conversation prompt and Marinara preset now use identity wording that fits both one-to-one and group chats, with a safe startup migration for existing bundled presets that still have the old lead sentence.
- Restored Conversation group chats to one merged provider generation per turn, allowing the model to choose every present speaker within the grouped response instead of issuing a separate restricted request for each character. Roleplay Individual mode remains unchanged.
- Preserved distinct Noodle authorship across persona switching: posts and replies retain their originating persona account and snapshot, timeline prompts identify each persona by handle and stable identity key, and chat carryover summaries name the persona account instead of collapsing activity into the currently selected identity.
- Restored Card Browser and official agent-catalog requests when upstream services reject Undici's default identity or a Windows proxy strips the response `Content-Type`. Marinara now identifies those requests explicitly and permits only missing MIME headers for their trusted, size-capped JSON paths; present invalid content types and malformed catalog data remain rejected.

## [2.3.0]

### Added

- Added a one-time, version-aware **What's New?** window for fresh installs and updates. It waits until first-run onboarding is complete, introduces each release's main features with Professor Mari, links directly to that version's GitHub release, and remembers the exact version shown so it does not reappear until the next update. The v2.3.0 announcement spotlights downloadable Agents, Hierarchical Maps, and Tactical Combat Mode with a compact, responsive battlefield preview.
- Added an editable **Noodle Prompt** at the top of Noodle Settings, with a full-screen editor and one-click default restoration. The canonical default now contains the complete adult-platform, persona-authorship, interaction, and JSON instructions, while the separate timeline voice text is appended last. Its **Edit prompt** action now follows the standard Noodle Settings button treatment, with centered content and a clearly visible Noodle-blue pencil icon on desktop and mobile.
- Added a **Combat Preference** to Game mode, chosen in the setup wizard and changeable later from the Chat Settings **Combat Style** section: keep the classic narrative combat, or switch to a new tactical battle style inspired by grid-based tactics RPGs. Tactical encounters play out on a terrain-painted battlefield with scene-matched backdrops, unit classes, party formations, per-unit movement and attack ranges, counters, critical hits, misses, and a full enemy phase driven by a deterministic seeded engine at four difficulty levels. Battles feature animated movement, floating damage popups, a draggable unit inspector and action menu, staged moves shown as translucent previews until confirmed, defeated units leaving the battlefield, restartable encounters, and a mobile-friendly layout.
- Added a responsive full-page **Agents → Download Agents** library for installing, reading about, updating, and uninstalling official capability packages, with installed/uninstalled groupings ordered as Writer, Tracker, and Misc Agents, plus creator artwork with an Agents-star fallback. Card Evolution is classified as a Writer Agent and Hierarchical Maps as a Tracker Agent. On desktop, full-page libraries and resource editors open beside their originating sidebar; mobile keeps the focused full-screen flow. Fresh installs now contain no optional agents, while existing installations migrate their agents and chat feature selections without losing settings, runtime data, or history.
- Added **Install All** and **Uninstall All** controls beneath Download Agents search. Bulk package changes run through a safe sequential queue with visible progress, partial-failure reporting, immediate catalog refresh, and confirmation before removing every installed agent.
- Published first-party downloadable agents in the new [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) repository as individually verified packages. Its README now lists every Writer, Tracker, and Misc package, while repository contribution rules, issue and PR templates, catalog validation, protected review flow, and automatic CodeRabbit review keep future package work complete and reviewable. Conversation mode's About Me profile and `update_about_me` tool remain built into the Engine and are not downloadable agents.
- Moved Hierarchical Maps, Conversation audio/video calls, UNO, Chess, Poker, 8-Ball Pool, Tic-Tac-Toe, and Rock-Paper-Scissors into optional packages with package-owned server runtimes and responsive client surfaces. Maps can be enabled as an agent in Roleplay and during or after Game creation.
- Added a default-on Noodle setting that can exclude Professor Mari from account discovery and future generated activity without deleting existing timeline history ([#3598](https://github.com/Pasta-Devs/Marinara-Engine/issues/3598)).
- Added **Open Full Library** to Personas, with the same responsive card grid, search, sorting, preview pane, paging, scroll restoration, and editor return flow as the Character Library.
- Added separate opt-in browser and Android generation-completion notifications for manually started Conversation, Roleplay, Visual Novel, and Game replies that finish while Marinara is unfocused, without changing autonomous-message background notification preferences (#3588).

### Changed

- Categorized Marinara Engine's attributed OpenRouter traffic as **Roleplay** and **Game**, improving its visibility in OpenRouter's relevant app-ranking filters while preserving the GitHub repository as the canonical app referer.
- Renamed **Bot Browser** to **Card Browser** throughout the interface, documentation, onboarding tutorial, and Professor Mari guidance, and renamed **Browse Online** to **Download Cards**.
- Updated the Character and Persona full libraries to use the chroma text color selected in Settings for headings, counts, descriptions, metadata, tags, previews, and empty states instead of legacy fixed-color text.
- Reworked Character and Persona sprite transparency around a native-alpha-first pipeline. Providers that cannot return transparent PNGs now receive a subject-aware saturated chroma matte, followed by border-connected soft matting and color despill; the optional neural remover is reserved for genuinely complex backgrounds, while saved legacy white-background sprites remain cleanable with restore points.
- Made Local Whisper a Conversation Calls-owned download. Connections now shows Local Speech Model controls only while the Conversation Calls package is installed, and uninstalling Conversation Calls removes every downloaded Whisper model and its saved selection to reclaim disk space. Reinstalling Calls makes the models available to download again.
- Removed the retired database compatibility stack, including its runtime backend switch, startup migrations, one-time importer and repair readers, old migration scripts, database-file backup handling, and external ORM/runtime dependencies. Storage schemas and query expressions are now file-native throughout the Engine.
- Made file-native primary and natural-key constraints enforceable during atomic inserts and updates, preventing concurrent custom-media names, Noodle toggles, and lorebook links from persisting ambiguous duplicates.
- Reduced the base Engine by removing more than 25,000 lines of optional agent, map, call, and table-game implementation code. The base now exposes small validated capability registries and compatibility bridges while downloaded packages supply feature code on demand.
- Added a canonical 29-package catalog summary to both Professor Mari prompt paths and completed the public agent reference, README, and developer documentation so Mari can compare and recommend every Writer, Tracker, Misc, Maps, Calls, and Conversation-game package without confusing catalog availability with installation state.
- Consolidated Conversation command controls and renamed selfie configuration as **Illustrator Settings** inside Chat Settings → Agents. Agent sections, settings, and package-owned command toggles now appear only for agents that are actually installed, while an empty setup-wizard Agents step links directly to the Agents tab and its Download Agents action.
- Updated Professor Mari, onboarding, and agent documentation to explain the downloadable-agent workflow, package restarts, offline behavior, and backward-compatible migration.
- Began the v2.3.0 development cycle and synchronized version metadata across packages, the PWA manifest, Windows installer sources, Android APK metadata, and shared update checks.
- Android `versionName` is `2.3.0` with `versionCode 34`.

### Fixed

- Logged every Noodle timeline refresh model response in debug mode, including correction attempts, and persisted each raw attempt with its full rejection reason so malformed first responses remain auditable after a successful retry ([#3655](https://github.com/Pasta-Devs/Marinara-Engine/issues/3655)).
- Fixed Conversation **About Me → AI Write** sending literal card macros such as `{{user}}` to the model. The one-shot draft now resolves selected card fields, lorebook entries, recent chat context, and extra direction with the active Conversation persona and character before provider submission ([#3646](https://github.com/Pasta-Devs/Marinara-Engine/issues/3646)).
- Unified the online Card Browser with the Character, Persona, and Agent library shell: it now opens as **Cards Library**, introduces **Browse character cards online**, keeps the familiar back navigation and chroma-aware library background, and renders search failures in the selected chroma text color instead of legacy pink.
- Changed **Uninvite everybody** and its confirmation action from destructive red to Noodle blue, and made the disabled custom mouse-pointer preference persist immediately so Firefox, PWAs, and quickly closed sessions do not silently turn it back on.
- Fixed concluded Conversation scene summaries bypassing daily and weekly compaction because narrator history is represented as system-role prompt messages. Past scene summaries now fold into their normal day/week summaries and stay out of the verbatim recent-message tail, while current-day scene context and genuine system instructions remain intact ([#3641](https://github.com/Pasta-Devs/Marinara-Engine/issues/3641)).
- Replaced stale Spotify, YouTube, or Custom player controls with clear **Download Music DJ Agent to configure** guidance and a direct **Download Agents** action on desktop and mobile whenever the always-available **Music Player** toggle is enabled without Music DJ installed.
- Fixed Conversation selfie prompt generation ignoring the per-chat **Prompt Model** selection. Automatic character selfies and Gallery selfies now route their prompt-writing request through the selected text connection, including its provider, model, caching behavior, and local-sidecar support (#3638).
- Applied downloaded package artwork to matching installed agents in the Agents sidebar, while preserving user-uploaded pictures and the star fallback for missing or failed images.
- Restored the Characters sidebar header icon to the same pink-to-rose gradient used by the New Character action while keeping its topbar icon on the selected chroma accent.
- Calibrated Lorebook semantic similarity against an unrelated-text baseline so embedding models whose raw cosine scores cluster around 0.97 no longer inject unrelated entries at every usable threshold or suppress relevant entries near 1.0 (#3627).
- Replaced the nested presence animation used by expandable right-sidebar folders with an accessible grid transition, preventing Connections and Lorebooks folders from crashing the app shell with React hook-order errors (#3630).
- Recognized OpenRouter's positive-form `No endpoints found that support image input` rejection as a non-vision model response, allowing Noodle timeline refreshes to retry once with the existing text-only prompt (#3631).
- Moved the Game Assets manifest and rescan lifecycle out of Zustand into one React Query cache shared by Game surfaces and the Asset Browser, consolidated model/runtime and Whisper download SSE parsing, and made failed sidecar delete/unload actions propagate instead of silently succeeding (#3616).
- Fixed Game Journal tabs refusing to scroll on desktop and iOS by giving the embedded journal a bounded flex viewport, and made replaced/generated NPC portraits refresh immediately even when the server reuses the same image URL (#3624).
- Updated the Character Colors preview to render the active card's cropped avatar with an icon fallback, while keeping its sample narration free of formatting asterisks (#3622).
- Preserved the standard `<START>` example-dialogue separator through XML prompt sanitization, including cards whose importer had already encoded the marker, without allowing other XML-looking card text through unescaped (#3623).
- Removed every random-user instruction and profile placeholder from Noodle refresh prompts when Random Characters are disabled, while participant selection continues to exclude those accounts entirely (#3619).
- Consolidated Chub, CharacterTavern, and Wyvern Bot Browser JSON requests behind a shared HTTPS-only `safeFetch` boundary with explicit provider hosts, JSON content-type validation, redirect rejection, cancellation-aware timeouts, and bounded response sizes (#3617).
- Restored swipe-to-dismiss for mobile web toasts in both horizontal directions and upward, so touch users no longer need to target the small close control (#3625).
- Renamed the Connections **Illustrator** defaults category to **Images**, hid image/video generation settings and `/illustrate` or `/selfie` commands until Illustrator is installed, kept `/help` first in slash suggestions, and refreshed `/help` and `/macros` feedback with chroma-aware styling.
- Fixed Gallery generation controls appearing without an active Illustrator package. Illustrate, Selfie, Storyboard, Video, Animate, and Background actions now require Illustrator to be installed and enabled for that chat in every mode, while Roleplay Gallery replaces the separate Browse Images window with its asset search directly in the Gallery.
- Unified Chat Settings → Agents and Conversation command toggles with the same accessible chroma-aware control styling used by the rest of Chat Settings, restored spacing between installed Conversation Calls settings and schedule-generation preferences, and changed Game setup's selected SFW/NSFW rating from green/red status colors to the selected accent color.
- Fixed installed Conversation feature packages still behaving like per-chat pipeline agents. The six table games now appear in the Commands controls without separate Add Agent entries, Conversation Calls settings render directly below Illustrator settings using the native chroma controls and expand only after calls are enabled for that chat, and installed games/calls expose their surfaces and command runtimes without requiring legacy `activeAgentIds` metadata.
- Fixed downloaded Maps and Conversation Calls packages failing against file-native storage with `Unsupported table: chats`, `Unsupported table: conversation_call_sessions`, or an undefined schema name. Capability-owned file-table and column objects now resolve safely through the Engine's registered schema names instead of requiring identical JavaScript object instances, while incompatible installed package versions are quarantined before their hooks can crash generation ([#3647](https://github.com/Pasta-Devs/Marinara-Engine/issues/3647)).
- Updated Persona Status Bars’ **Add** button to follow the selected chroma accent instead of using hard-coded green styling.
- Fixed Conversation Chat Settings hiding the **Selfies** command after Illustrator was installed. Package-owned commands now appear alongside their separate agent settings as soon as the matching agent is available.
- Kept Chat Settings → Agents available in Conversation, Roleplay, and Game when no optional agents are installed. Built-in Conversation commands remain configurable without downloads, and the Conversation setup wizard now shows those commands plus only the extra commands owned by installed agents. Empty Roleplay and Game sections link directly to Download Agents, while the chat setup wizard removes its redundant decorative Agents icon from the empty state.
- Made Game setup respect installed agent ownership: Hierarchical Maps, Music DJ, Lorebook Keeper, and Illustrator controls now appear only when their packages are installed, with Visual Generation renamed to Illustrator. Empty Game and Conversation setup states link directly to Download Agents, and the Game connection guidance now follows the selected chroma accent instead of hard-coded yellow styling.
- Removed the inert **All agents** back control from the desktop Download Agents detail view while preserving its working list navigation on mobile.
- Fixed uninstalling a downloadable agent leaving its card in the already-open Agents sidebar until the panel was closed and reopened. Capability registry updates now land before React publishes the refreshed package state, so installed-agent lists and empty states update immediately.
- Fixed left and right sidebars disappearing before the desktop shell caught up, which briefly left an empty column beside the chat. Their reserved width now collapses in sync with the visible panel slide, including the full-width mobile chat sidebar. Lorebook entry filter chips now use consistent inset-safe borders so character, tag, generation, and additional-source choices are no longer clipped by their scrolling containers.
- Fixed Group Conversation replies ignoring the documented inherited-speaker format in Bubble display. Each generated line now receives its own bubble while unprefixed consecutive lines retain the preceding character's identity (#3609).
- Fixed recurring Roleplay characters losing tracker stats, custom fields, or their character-card avatar after being absent for several scenes. Character Tracker now receives card RPG configuration and bounded historical continuity, restores omitted prior values, and enforces card identity and artwork in normal and retry runs (#3606).
- Fixed graceful shutdown completing before a file-native storage flush could drain newer writes queued during its active disk write, and made persistent close-time I/O failures reject shutdown instead of silently reporting success (#3602).
- Fixed the Agent Editor custom-music folder picker omitting saved remote-admin and CSRF credentials by routing its privileged request through the shared API client (#3603).
- Fixed dense Connections editor text flickering or shifting in Chromium browsers at the accent pulse's 500 ms update cadence. Editor reading surfaces now retain the selected base accent while headers and explicit accent chrome continue to pulse (#3599).
- Fixed recalled-memory truncation splitting supplementary Unicode characters such as emoji or Lydian text into invalid UTF-16 surrogate halves, which caused strict provider JSON parsers to reject otherwise valid Conversation generations (#3596).
- Fixed selected background-library images immediately disappearing in Roleplay mode because the renderer probed the GET-only image route with an unsupported HEAD request (#3592).
- Fixed Noodle profile text edits resetting character avatars from their configured crop to the full source image. Unchanged avatars now preserve their crop, and previously lost crops recover from the matching character card on the next profile save.
- Fixed a blank `TZ=` forcing server-side schedules and date-sensitive Conversation context into the synthetic `Etc/Unknown` UTC timezone. Blank values now inherit the host timezone, Noodle warns when timezone detection is unresolved, and chats remember the browser timezone for autonomous scheduling, temporal awareness, daily memories, and tool macros (#3590).

## [2.2.1]

### Added

- Added Tic-Tac-Toe and Rock-Paper-Scissors as one-on-one Conversation-mode table games. Tic-Tac-Toe seats you against a character on a 3×3 board with a choice of X, O, or a random mark, and detects wins and draws. Rock-Paper-Scissors plays a best-of-3/5/7 match where each round's throw stays hidden from your opponent until both of you have thrown, then reveals the result. Both join the `[tic_tac_toe]`/`[rock_paper_scissors]` Conversation command family alongside `[chess]` and `[eightball]`, with `/tictactoe` (alias `/ttt`) and `/rps` slash commands, natural-language launchers, per-chat command toggles, and setup modals for opponent and game length.
- Added a compact, expandable **Defaults** section to Connections for Main, Agents, Illustrator, and Videos. Each category now supports an optional fallback connection; failed generations retry once through that category's fallback while user cancellations and already-visible partial text streams remain protected from duplicate output. A toast identifies the fallback connection and model whenever the engine switches over.
- Added drag-to-resize controls for the Echo Chamber on desktop and touch devices, with responsive text wrapping and correctly oriented handles in every screen corner.
- Added native Android notification permission and delivery support to the APK wrapper so autonomous Conversation messages can notify mobile users while the app is backgrounded (#3572).
- Added expandable Noodle poll vote details so tapping or clicking a vote count reveals which accounts selected each option (#3566).

### Changed

- Moved **Title / comment** into the primary identity fields directly below **Name** in both Character and Persona Metadata, while keeping it synchronized with the matching editor-header field.
- Changed Noodle participant selection so invited characters remain the primary cast while random-user accounts appear only occasionally as supporting activity.
- Moved media-wide queueing and prompt-review controls into a new **Overall Generations** settings group, renamed the queue option to **Queue media generation requests**, extended it to video generation, and added a Conversation toolbar hint linking users to generation settings.
- Moved weather particle rendering off the main UI thread where supported, capped canvas resolution and mobile particle density, and reduced background polling/animation work to improve foreground smoothness and mobile battery use (#3567).
- Added consistent Marinara Engine app attribution to every OpenRouter request path, including text, embeddings, image generation, model discovery, and video generation.
- Bumped release metadata to v2.2.1 across packages, the PWA manifest, README release pointer, Windows installer sources, Android APK metadata, and the home-page-visible app version.
- Android `versionName` is `2.2.1` with `versionCode 33`.

### Fixed

- Fixed NovelAI connection tests calling a retired subscription endpoint. Connection setup now directs users to Test Image, which verifies the real generation path (#3582).
- Added a confirmation step before branching a chat from a message, preventing accidental branch creation from tightly spaced mobile Roleplay controls (#3583).
- Fixed Noodle timeline prompts exposing internal character and account IDs, mentioning disabled random users, and repeatedly favoring the same early invited characters. Timeline generation now identifies accounts only by handle, omits random-user guidance when disabled, rotates the eligible roster fairly, and still prioritizes accounts involved in recent persona mentions or replies (#3584).

- Fixed desktop top-bar navigation dismissing open chat tools such as Chat Settings, Gallery, Branches, Active Context, and Conversation Presence. Desktop shell panels now reflow those tools alongside the chat, while mobile navigation continues to dismiss floating chat UI.
- Fixed Presets list metadata wrapping Regex AI/User badges above their patterns and Function badges below their names. Patterns and function names now truncate first so their badges remain beside them on one line.
- Fixed Professor Mari's chat opening below the usable mobile viewport and hiding its composer on iPhones. The expanded chat now fills the app content area beneath the top bar and reserves the device's bottom safe area (#3569).
- Fixed Professor Mari's structured `persona.create` action and `mari personas create` helper omitting required Conversation profile columns. Both creation paths now supply safe defaults and accept phonetic name, Convo display name, About Me, and Convo behavior values; the corresponding update helpers and command guidance were synchronized as well (#3571).
- Hardened generation fallbacks so output already emitted through streaming callbacks is never replaced, failed toast delivery cannot cancel a working fallback, Roleplay background generation participates in Illustrator fallback routing, and Conversation selfie galleries record the connection and model that actually produced the image.
- Fixed Present Characters tracker values crashing React when generated stats used structured `{ name, value, max, color }` objects; tracker displays now normalize those values safely (#3563).
- Fixed autonomous group Conversation exchanges stopping at one capped or cooling-down character, sequential turns leaking other speakers, valid target replies being removed by wrong-speaker pruning, and OpenAI-compatible SSE responses losing content delivered through final message frames (#3573).
- Fixed Roleplay chats opening at the oldest history position instead of the latest message, and updated **Show newer** and **Latest** controls to inherit the selected chroma text color.
- Fixed Echo Chamber batches appearing all at once or too quickly by revealing queued reactions individually at randomized 10–30 second intervals, while protecting the active chat from stale delivery writes.
- Fixed Echo Chamber corner controls pointing in the wrong vertical direction when the panel is anchored along the bottom edge.
- Fixed image and video connections retaining or claiming the language-only **Fallback for Main** role after creation or provider changes.
- Fixed corrected Noodle refreshes bypassing the same activity and authorship validation as the first attempt, empty refreshes being accepted without retry, persona IDs being offered as generated authors, and JSON-shaped image prompts without a usable prompt field being sent verbatim to image providers.
- Fixed Android/Termux updates repeatedly forcing the entire dependency store to reinstall for the same stale build. The launcher now performs one rebuild, prunes unreferenced packages left by older releases, avoids irrelevant cross-platform binary downloads, and accepts the current Node 26 Termux runtime (#3540).
- Fixed one malformed generated Noodle post, interaction, follow, or digest rejecting an otherwise valid refresh. Rows are now validated independently, while wholly malformed JSON or batches containing only invented account IDs receive one constrained retry with the exact active IDs (#3547, #3553).
- Fixed XML agent prompt-template overrides escaping literal contract tags such as `<chat_summary>` and `<existing_entries>` while continuing to escape values inserted through macros (#3548).
- Fixed Conversation group messages ignoring character-specific Convo display names in generation instructions, speaker parsing, sender labels, typing events, and historical base-name matching (#3550).
- Added profile editing for directly invited Noodle characters, including display name, handle, bio, location, avatar, and banner; manual profile identity changes are preserved when the underlying character card is refreshed (#3551).
- Fixed add-character searches in Conversation and Roleplay setup and Chat Settings ignoring card tags, descriptions, creator metadata, and title aliases (#3555).
- Fixed Noodle's default generated-image path sending the post text and prompt-building meta-instructions directly to image providers. It now sends only the model's visual idea, character appearance, Noodle image direction, and selected image-generation style settings, with recovery for legacy or JSON-wrapped image prompts (#3554).
- Fixed Noodle profile setup failing an entire refresh when one model-generated profile contains an overlong or malformed field. Generated profile text is safely bounded, invalid rows are skipped independently, and valid accounts from the same batch still apply (#3533).
- Fixed Noodle forgetting the last selected persona after a browser refresh or app restart; the account choice now persists per browser and falls back safely when that persona no longer exists (#3535).
- Fixed renamed character cards retaining their former Noodle display name. Bootstrap now refreshes entity-owned character names and avatars while preserving generated handles, bios, locations, and other Noodle profile data (#3537).
- Fixed generated chat images being saved only to the chat gallery. Illustrator generations and retries across Roleplay/Game, Conversation command and Gallery selfies, and Conversation Call selfies now also create independent copies in every depicted character or persona gallery (#3538).
- Restored Echo Chamber's queued Roleplay delivery: newly generated reactions now arrive one at a time with short delays, persistence races cannot reveal a whole batch, stale reveal counters are clamped, and inactive-chat retries cannot write into the visible chat's Echo panel.
- Fixed character Advanced prompt controls being dropped from live Conversation and Game requests. System Prompts, Post-History Instructions, and Depth Prompts now cover Conversation participants plus Game party/character-GM cards, using the same shared injection path in preset assembly, direct mode assembly, and Prompt Preview.
- Fixed Roleplay Illustrator comic and manga prompts being contradicted by an unconditional negative prompt that banned speech bubbles, captions, readable lettering, and SFX. Text suppression now remains enabled for ordinary illustrations but yields to explicit lettering requests in the final compiled prompt.
- Fixed Roleplay Text to Speech replaying the previous assistant message whenever a new output generation failed. Autoplay now requires a successful generation with a genuinely new assistant-message revision, and failed partial outputs are never queued for automatic playback.

## [2.2.0]

### Added

- Added **Noodle**, Marinara's fake social network and the headline feature of v2.2.0: invited characters and optional random users can create posts, nested replies, polls, images, likes, reposts, mentions, and notifications on a persistent generated timeline; personas can participate directly; automatic and manual refreshes support scheduling and social-memory carryover into Conversation, Roleplay, and Game; and the responsive mobile shell provides profile navigation, search, settings, notifications, and pinned bottom navigation.
- Added long-term Noodle timeline recall: refreshes can now sample up to three posts older than 48 hours so characters may naturally remember, revisit, or interact with past activity.
- Added native multimodal Noodle timeline context: refresh models can inspect images attached to recent posts and comments, with deterministic post/reply labels, bounded image inputs, and an automatic text-only fallback for models that reject vision content.
- Added optional Noodle image captioning with a selectable vision connection so text-only timeline models can understand images attached to posts and replies (#3505).
- Added prefix-matched `@handle` suggestions to Noodle post and reply composers, with click, touch, and keyboard insertion.
- Added first-class custom fields and hide controls to World State and Present Character trackers, including inline editing, lock-aware persistence, tracker-agent updates, and matching displays in the Tracker Panel and Roleplay HUD (#3518).
- Added per-agent manual scheduling for Roleplay tracker agents, so selected trackers can be excluded from automatic post-turn runs and triggered from the HUD without forcing the whole tracker suite into manual mode (#3522).
- Added batch editing for selected Lorebook entries, letting one boolean setting such as recursion, case sensitivity, whole-word matching, vector exclusion, or enabled state be applied to thousands of entries in one atomic update (#3513).
- Added Discord-style standard emoji shortcodes and Conversation autocomplete, so names such as `:crying:` render as Unicode emoji and `:cry…` suggestions appear alongside custom emoji (#3515).
- Added server-backed extension storage APIs and client/server runtime helpers so installed extensions can persist validated, size-limited settings across devices (#3524).
- Added a message-scoped Game state endpoint so extensions and integrations can retrieve the exact stored snapshot for a selected chat message and swipe (#3526).
- Documentation search in the in-app docs viewer now highlights every occurrence of the active query in the opened guide, result titles, and snippets, and opens each result at its first highlighted match.
- Added visible Game setup progress with an elapsed timer and indeterminate progress bar while the Game Master builds the initial world, plus live phase labels during the first turn (#3495).
- Added an **Initial Game Setup** section to Game Mode Session History so players can review, copy, or download a `.txt` file containing the complete setup that created a successful campaign, including preferences, prompt choices, visual/storyboard options, safe model descriptors, and effective generation parameters without credentials or local IDs.
- Added per-turn **Peek Prompt** actions to Game Mode Logs and **History Above Dialogue Box**, opening the exact cached prompt that was actually sent for that historical GM turn.
- Added read-only replay for completed Game Mode sessions from Session History, including click-through narration, stored presentation cues, and deterministic choice forks that only permit the option selected during the original session (#3465).
- Added a selectable **Comic Page Video** prompt for storyboard clips that interprets comic and manga panels as duration-aware ordered animation beats without changing the shared Game Video Prompt.
- Added an Anime Episode presentation for Game Mode with coordinated **Anime Game Prompt**, **Comic Page Animation**, and **Comic Page Video** defaults; setup-time keyframe targeting; a `{{gameStoryboardKeyframeCount}}` GM macro; and independent storyboard prompt selectors that keep **Anime Episode Director** plus **Anime Game Video** available as the alternative still-shot combination.
- Added GLM-5.2 to custom OpenAI-compatible connection model choices, including its 1M context and 128K output limits.
- Added OpenAI GPT-5.6 Sol/Terra/Luna model support, including the `gpt-5.6` Sol alias, a `gpt-5.6-sol-pro` pro-mode alias, Responses API routing, GPT-5.6 `max` reasoning effort mapping, and reuse of the existing Exclude Past Reasoning toggle for GPT-5.6 reasoning context.
- Added a configurable source picker (⚙️) for the Conversation "about me" AI-write, in both the character-card editor and the in-chat profile popout: choose which of the card fields (description, personality, scenario, backstory, appearance), the Convo behavior directive, the character's lorebook entries (with per-entry selection in the card editor), and recent chat context feed the draft. Defaults to personality only.
- Added Professor Mari suggestion chips and guided creation follow-ups so Home Mari and legacy Mari chats can surface color-coded quick replies for step-by-step creation, editing, and contextual next actions.
- Added a Revert control to the about-me editor (card editor and in-chat popout) to undo a manual or AI-write change, and an emoji picker in the about-me editor.
- Added an optional per-character toggle to declare a character's Convo display name on its card in the prompt, so the model can map the display name to the right card in group chats.
- The Convo display name is now shown as the sender label above messages in Conversation (read live, so renames reflect immediately), not only in the prompt and the profile popout.
- Added Poker (No-Limit Texas Hold'em) as a Conversation-mode table game for 2-8 players: seeded fair dealing, full no-limit betting with all-ins and side pots, showdown hand ranking with natural-language labels, and multi-hand sessions with a rotating dealer button, optional blind escalation, an optional hand limit, and player-paced "Next hand" breaks between hands.
- Added a selectable poker dealer: choose the silent house dealer or seat any chat character as the croupier, who announces hand starts, flop/turn/river reveals, showdowns, and blind increases in their own voice and personality — narration only, with dealing always seeded and fair.
- Poker joins the `[poker]` Conversation command family alongside `[uno]` and `[chess]`, with a `/poker` slash command, natural-language launcher, per-chat command toggle, and a setup modal for players, dealer, and stakes.
- Added 8-Ball Pool as a one-on-one Conversation-mode table game with a real 2D physics simulation: you aim and shoot for real — drag to aim with a guide line and ghost-ball preview, set power on a slider, and watch every shot play out with animated ball motion, collisions, cushion bounces, and pocket drops. Characters pick from an engine-computed shot menu (direct pots, bank shots, and safeties) in personality — daredevils take the showoff bank, tacticians play safe — and their choice is executed through the same physics with skill-based aim accuracy. Fouls (scratches and wrong-ball-first contact) give ball-in-hand with tap-to-place cue placement, slop counts, alternate breaks, and race-to-N matches with player-paced racks.
- Added a selectable 8-ball announcer: seat any chat character as the pool-hall commentator, who calls the break, group assignment, fouls, great shots, and rack wins in their own voice — narration only, never affecting the rules.
- 8-ball joins the `[eightball]` Conversation command family, with a `/8ball` slash command (alias `/pool`), natural-language launcher, per-chat command toggle, and a setup modal for the opponent, announcer, match length, and who breaks.
- Added an opt-in **Lorebook context** setting to Noodle (off by default): when enabled, timeline refreshes scan recent post/reply text and active character profiles for lorebook keyword matches and include activated entries as world/lore context, reusing the same multi-character lorebook system group chats already use, with a Noodle-specific token budget that scales with the active character count.
- Registered a **Noodle Timeline Voice & Tone** prompt override (Settings -> Generations -> Image Generation Prompt Overrides) so the tone and creative-freedom portion of Noodle's refresh prompt can be rewritten without code changes, while structured-action and output-format rules stay hardcoded outside the override so a rewrite cannot break refresh generation.
- Noodle's opted-in chat context now includes a character's current Conversation-schedule status and activity (for example, "currently dnd (At the office)") alongside that chat's recent messages, when the chat both has **Allow Noodle references** on and a running character schedule. Scoped per chat, with no new schedule computation or cross-chat reconciliation.
- Added an opt-in **Enhanced tone & continuity** setting to Noodle (off by default, Settings -> Timeline Writing): when enabled, each account's tone is grounded more strongly in its own Personality/Description/Backstory instead of a default upbeat voice, accounts are encouraged to react to, quote, or argue with each other's posts within the same refresh, older-post recall happens more often and favors posts relevant to currently active accounts, and the recall instruction is reworded to allow rather than discourage references. Off (the default) reproduces the prior tone and recall behavior exactly.

### Changed

- Updated UNO bot instructions and Wild tool guidance to expose the bot's remaining color counts and prefer its strongest held color instead of reflexively repeating the active color (#3512).
- Changed random and exact Noodle participant selection to prioritize directly involved accounts, then accounts absent from the previous refresh, while retaining recently active accounts as a fallback when the pool is small (#3505).
- Changed post-processing orchestration so Prose Guardian, Continuity Checker, and Immersive HTML share a dedicated rewrite call that is isolated from tracker batches, and hid the legacy About Me Keeper from the manually addable Agents library.
- Changed Noodle's generated-image quota from a daily cap to **Images/refresh**, applied independently to every manual and automatic timeline refresh while preserving each user's saved limit.
- Added a separate **Comic Page Animation** storyboard prompt with clip-duration panel budgets, causal panel order, continuity guidance, and timed motion direction while preserving the original **Comic Page** illustration prompt.
- Refined comic storyboard animations from output review: Gemini Omni now receives complete untruncated prompt components, six-second pages may use a simple third beat without overcrowding, animation pages minimize lettering and repeated cast members, full-page establishes cannot reveal later consequences early, and clips reserve a final hold.
- Changed storyboard videos to play once and hold on their final frame instead of looping. Background mode now starts each story beat's clip once with sound, lets narration display while it plays, waits before narration auto-advances, and exposes replay, play/pause, and mute controls in the desktop and mobile game toolbar.
- Removed the obsolete Visual Novel coming-soon tab and grouped legacy/imported Visual Novel chats under Roleplay while preserving their schema, importer, and achievement compatibility; Game dialogue layout labels now use Dialogue Box wording.
- Updated Noodle timeline guidance so characters may naturally be rude, petty, confrontational, revive grudges, form rivalries, and stir up interpersonal drama when it fits their established personalities and relationships.
- Restyled Noodle around the Klusek blue logo asset, replacing the always-visible settings column with a profile-triggered drawer and a more Twitter-like central feed.
- Updated Noodle image prompt generation so character posts may request either character-focused images or in-character memes when image generation is enabled.
- Updated Noodle timeline generation guidance so characters and random users know they may occasionally create and vote in polls and naturally use Unicode emoji in posts and replies; when random users are enabled, they may also very occasionally post clearly fictional parody ads or absurd fake crypto scams.
- Updated Noodle settings so selected character folders can be bulk-invited directly, and automated refreshes can be disabled by setting refreshes per day to `0`.
- Updated Noodle posts with edit/delete actions for every post, toggleable likes/reposts, a confirmed timeline reset control, multi-character image references, and automatic character-gallery saves for generated character post images.

### Fixed

- Fixed the root recovery screen hydrating the legacy default pink before the selected app accent could mount; crash details, borders, focus rings, and recovery actions now inherit the saved chroma color, and remaining old pink application-chrome fallbacks use semantic accent tokens.
- Added an actionable startup warning when the compiled client is missing, identifying the expected build path and the `pnpm build` command instead of silently serving only the API (#3529).
- Fixed Illustrator defaulting to the Background prompt in new and existing Roleplay chats after the staging update; normal Illustration is restored as the default, affected stored agent configs are repaired once, and explicit per-chat Background choices remain intact (#3517).
- Fixed the Windows uninstaller deleting current-layout user data under `packages/server/data`; uninstall now asks before application cleanup, safely preserves and restores retained data, supports the legacy root data folder, and removes the current `win` directory instead of a stale path (#3484).
- Fixed semantic Lorebook search being unreachable for ordinary keyed entries; vector similarity now acts as the documented fallback when keyword matching misses while retaining score thresholds, maximum results, filters, and probability gates (#3511).
- Fixed partially speaker-prefixed Conversation replies rendering their leading model text as narration beneath the user's message; the leading block now inherits the saved assistant character while edit and reaction attribution remain aligned (#3514).
- Fixed Conversation and other non-assembled generation paths silently disabling reasoning when the UI showed the default **Maximum** effort; shared and server runtime defaults now agree while an explicit disabled value remains respected (#3498).
- Fixed Noodle accounts repeatedly interacting with the same post or replying to their own comments without new involvement, while still allowing a return after an explicit tag or direct reply; also fixed profile validation errors rendering as `[object Object]` (#3505).
- Fixed pending persona portrait focus and zoom changes being lost when a tab was refreshed or closed before the debounce completed by flushing the save on `pagehide` with a keepalive request (#3506).
- Fixed Conversation replies leaking combined date-and-time and speaker prefixes such as `[11.07 15:53] Character: Hello!`; single and individual replies now store and display only `Hello!`, while merged group speaker boundaries remain intact.
- Fixed Lorebook Overview sections briefly rearranging after Save by handing the editor the authoritative PATCH response before clearing its dirty state; Professor Mari-created lorebooks now normalize categories and advanced numeric settings so later manual edits, including Global changes, can be saved.
- Fixed Roleplay streaming collapsing into the completed response when post-processing agents started, final response cleanup changed an already-painted prefix, the provider closed immediately after tracker work, or the browser tab lost visibility; authoritative cleanup now preserves typewriter progress, the live buffer remains authoritative through agent work, background tabs pause instead of flushing, held rewrites stream their final rewritten response before the durable message takes over, bottom-follow scrolling tracks the rewrite's committed DOM growth, and rewritten messages retain a persistent shield toggle for comparing the original and edited versions.
- Fixed editing the preceding user message during Roleplay generation temporarily rendering the saved assistant response beside its live streaming presentation.
- Fixed Text to Speech treating quotes inside generated HTML attributes and CSS as dialogue; markup is now removed before dialogue extraction, non-speech code/style blocks are discarded, and explicit speaker tags continue to route proper dialogue to the correct voice.
- Fixed desktop sidebars stuttering over dense Roleplay transcripts by replacing continuous width animation with compositor-only transform and opacity motion, retaining panel content between visits, and performing each center-layout resize only once.

- Fixed Noodle setting controls reverting to an earlier snapshot by serializing saves, keeping the edited value optimistic while the request completes, and returning the value re-read from persistent storage.
- Preserved stored votes on older Noodle polls when manual or automatic refresh hydration briefly returns an incomplete interaction snapshot.

- Fixed persona-authored Noodle comments bumping their target posts to the top of the timeline; a post now moves up only when another account directly responds to the active persona's comment.
- Fixed failed Noodle image generations leaving a visible image prompt in place of the missing picture; Noodle now retries the image provider once, then publishes a clean text-only post if the second attempt also fails and clears orphan prompts from earlier failed posts.
- Fixed provider concurrency-limit failures being reduced to generic agent errors or omitted from generation guidance; affected toasts now identify the concurrency limit and include the provider's message.
- Fixed new Roleplay chats opening without character greetings because initial character assignment inserted a hidden join notice before greeting seeding (#3472).
- Fixed the regex safety validator rejecting linear delimiter-bounded field patterns such as `([^|]+)\|([^|]+)\|([^|]+)` as polynomial backtracking risks while retaining rejection of overlapping broad-unbounded chains (#3471).
- Fixed failed Game Mode Lorebook Keeper runs leaving no obvious recovery path: Session History now surfaces the failure immediately, keeps its background status fresh, and provides a dedicated **Retry Lorebook Keeper** action.
- Fixed Game Mode status readouts written as standalone `<...>` lines being sanitized into empty narration steps, and removed segments made empty by display regex or macro processing.
- Fixed Background storyboard playback state leaking between keyframes, which could rapidly pause, restart, or appear to fast-forward animations.
- Fixed Grok CLI subscription requests failing to spawn (`E2BIG` / "Argument list too long") on long or multibyte-heavy transcripts by delivering the prompt via `--prompt-file` instead of a single inline `-p` argument; with the transport limit gone, an explicitly configured Max Context Window is now honored instead of being silently capped at 32k (the conservative 32k default is unchanged).
- Fixed Text to Speech source switching discarding the previous provider's encrypted API key, endpoint, model, voice assignments, and provider parameters; each source now restores its own saved profile when selected again (#3467).
- Fixed desktop Noodle emoji, custom emoji, and sticker insertions always appending to the end of post and reply drafts instead of replacing the active selection at the caret.
- Fixed example dialogue `<START>` sentinels being escaped as `&lt;START&gt;` in XML-wrapped prompts while continuing to escape arbitrary imported markup (#3441).
- Fixed Conversation **About Me** and Noodle avatars ignoring saved crop settings, and restored custom emoji rendering in Noodle profile bios (#3443).
- Fixed structured Game and Noodle generations being rejected when a model wraps an otherwise valid JSON object or array in thinking, metadata, or other stray text.
- Fixed GPT-5.6 Sol rejecting Noodle timeline/profile generation by supplying strict JSON schemas with `additionalProperties: false` at every object level and placing an explicit JSON instruction in Responses API input messages.
- Fixed native Z.AI GLM-5.2 connections using legacy thinking parameters; Marinara now sends the documented `thinking.type` and compatible `reasoning_effort` values while preserving JSON mode on Z.AI endpoints.
- Expanded every standard emoji picker from a hand-curated subset to the complete Unicode Emoji 17.0 base catalog, including science emoji such as 🧪 plus the previously missing travel, activity, object, symbol, animal, and flag groups.
- Fixed Quick Replies' **Post only** action saving recognized slash commands as ordinary messages; known commands now execute normally while unknown slash-prefixed text can still be posted.
- Moved **Quick replies** from Advanced settings to **General -> Input & Editing**, and clarified that image prompt review is a global generation preference rather than a Game-only option.
- Fixed manual Noodle timeline refreshes bypassing **Expose image prompts before sending**; generated Noodle images now present their final positive and negative prompts for editing before provider submission.
- Fixed character-assigned lorebooks failing validation when duplicated from the Lorebooks pane, while preserving their assignment and vector-search settings (#3433).
- Fixed the Noodle reply image picker separator inheriting a pink chrome accent instead of using Noodle blue.
- Fixed character-authored Noodle comments being read-only; their edit and delete controls now use the same flow as persona comments, while generated random-user comments remain protected.
- Fixed custom and imported preset variables disabling **Confirm Choices** when a valid blank-valued option was selected (#3429).
- Fixed turn-game bot table talk and dealer announcements leaking the model's chain-of-thought into chat when the connected model emits inline reasoning (e.g. a leading `<think>` block): narration now strips inline reasoning like the main generation pipeline, falls back to the factual event line when the output was all reasoning, and gets a larger output budget so reasoning models can still land the spoken line (#3427).
- Fixed comma-separated lorebook activation-key input so pasted key lists are trimmed, split, and deduplicated into individual keys (#3422).
- Fixed grouped Conversation reactions on mobile by keeping each speaker's reaction button visible and removing the ambiguous whole-block reaction target (#3424).
- Fixed generated and uploaded Game assets being misclassified as native merely because they lived below a bundled-assets folder, restoring move and delete actions for user-owned files (#3425).
- Fixed local git installs being unable to switch release channels from Settings unless general browser-applied updates were enabled; deliberate loopback channel switches now work while ordinary and remote update safety gates remain intact (#3426).
- Completed Noodle's automatic timeline refresh scheduling: daily refresh times are now distributed across persisted local-day windows, survive restarts, collapse overdue slots into one catch-up refresh, retry safely after failures, and update an open Noodle timeline automatically.
- Fixed PocketTTS voice refresh so built-in and custom voices returned by the provider `/v1/voices` endpoint are listed, including custom voices identified by URL/path fields (#3410).
- Fixed Conversation Call live-mic input so Local Whisper/provider media submissions cannot queue unbounded speech segments and lock the call UI behind repeated "too many requests" failures (#3411).
- Fixed Game Mode reputation widget updates accepting generated action descriptions longer than 50 characters, preventing scene-analysis reputation updates from failing on natural-language actions (#3409).
- Fixed the v2.1.1 auto-update build regression by resolving the stale TypeScript errors that broke the server/client build during update (#3401).
- Fixed the chat-specific about-me override being lost on reload or refetch — the popout read chat metadata without parsing it, so the override reset to the card default and, on save, could drop other characters' overrides.
- Fixed the about-me AI-write failing on "thinking" models (e.g. Gemini 3.x) that spent the entire output budget on reasoning and returned no content; the output ceiling was raised and reasoning effort lowered.
- Fixed the about-me source picker listing only "linked" lorebooks — a character whose lorebook is embedded now sees and can select its entries.
- Fixed the Conversation participant-profiles block labeling the persona as "the user," which nudged some models toward sycophancy; the persona is now presented as just another participant.
- Fixed the about-me profile popout on mobile (now a full-height sheet so the keyboard and emoji picker no longer overlap the field) and its overflow on desktop when the source panel is opened.
- Fixed help tooltips stacking — opening one now closes any other.

### Additional release scope

#### Added

- Added Conversation-mode profiles for characters and personas: a separate Convo display name, an "about me" profile (editable by hand or drafted by an AI-write button), and a Convo behavior directive with configurable insertion strategy, all Conversation-mode-only and never sent to the model in Roleplay, Visual Novel, or Game mode (#3368).
- Added per-chat "about me" overrides (Discord per-server-profile style): click a participant's avatar in Conversation mode to view their effective profile and set, edit, or clear a chat-specific override that supersedes their default about-me in that conversation.
- Added the opt-in **About Me Keeper** Conversation agent that lets characters keep their own about-me current on a configurable cadence, updating either their public card profile through the existing approval flow or a private, chat-specific one, and the opt-in **update_about_me** command so a character can update its own about-me in character mid-turn.
- Extended card CSS theming so the Conversation about-me profile popout is customizable from a character's or persona's Creator Notes (new `mari-about-me-*` hooks documented in the Card CSS Theming Guide), and personas can now ship creator-notes CSS for their popout.
- Added Grok 4.5 to the xAI / Grok model list and made new xAI connections default to it.
- Added Conversation prompt relocation macros for auto-inserted context: `{{context}}`/`{{status}}`, `{{commands}}`, `{{reactRules}}`, `{{memories}}`, and `{{lorebook}}`.
- Added a TTS cache export control in Text to Speech settings so generated cached voice clips can be downloaded from IndexedDB.
- Added a Roleplay Chat Summary maximum output size setting under Summary Connection, defaulting to 4096 tokens for manual and automatic summaries.
- Added a connected-chat shortcut to Game mode so connected Conversation and Game chats can switch back and forth like Conversation/Roleplay links.
- Added a scene prompt setup dialog for user- and character-initiated scenes, remembering POV, tense, and optional prompt wishes for the next scene generation.

#### Changed

- Bumped release metadata to v2.2.0 across packages, the PWA manifest, README release pointer, Windows installer sources, Android APK metadata, and the home-page-visible app version.
- Android `versionName` is `2.2.0` with `versionCode 32`.
- Tagged releases now attach a clearly named, versioned source ZIP alongside the Windows installer and Android bootstrap APK, in addition to GitHub's automatic source archives.
- Reworked Settings with search-first navigation, compact pinned controls, fixed top-level categories, and finer section shortcuts for faster navigation.
- Updated the default Illustrator prompt rules so generated image prompts carry available character builds, clothing/outfits, and appearance details instead of relying on the image model to infer them.
- Changed custom Roleplay Chat Summary prompts to apply globally across roleplay chats instead of only the currently open chat.

#### Fixed

- Fixed manual agent retry/rerun requests so only agents currently added to the chat can be resolved, preventing removed agents from being prompted by stale retry requests.
- Fixed agent prompt assembly so the required output format is appended to the terminal user message after chat history using the selected chat prompt preset wrapper (`<output_format>`, `## Output Format`, or raw text).
- Fixed non-Quest agents receiving active quest progress in current game-state context while keeping compact quest state available to the Quest Tracker when it is active.
- Fixed Roleplay/VN chat branching so tracker snapshots copy to the branch instead of only copying Game Mode snapshots (#3385).
- Fixed Lorebook Keeper approval previews and commits so updates to existing entries keep the existing text and include `newFacts` alongside proposed replacement content (#3384).
- Fixed the mobile Characters panel **Load more** footer so it no longer overlaps or blocks the last character cards (#3383).
- Fixed generated TTS playback so clips created while the tab is hidden or unfocused wait for the tab to return instead of being dropped (#3382).
- Fixed prompt identity fallback so card fields referenced by macros are not duplicated, and fields can be intentionally suppressed by placing their macro in the prompt template (#3380, #3377).
- Fixed Game Mode world setup lorebook generation so per-chat disabled lorebooks and hidden Game Lorebook Keeper books are excluded (#3376).
- Fixed active lorebook controls so a pinned lorebook that is also active via persona, character, or global scope can still be disabled in the current chat (#3375).
- Fixed Conversation command reminders so preset wrap format `None` no longer emits a literal `<commands>` XML wrapper (#3378).
- Fixed roleplay streaming recovery so parallel agent events are deferred until the main assistant stream finishes, preventing late agent updates from replacing the streamed message.
- Fixed the recovery/error page so **Internal Server Error** uses the configured chat chrome text color instead of a hard-coded pink.
- Fixed Conversation Calls on Chromium browsers by allowing same-origin microphone, camera, and screen-capture access in the server permissions policy instead of blocking the browser permission prompt.
- Fixed the Roleplay setup wizard's **Use Settings Presets** shortcut so system "joined the chat" notices no longer block seeding the selected character's first message (#3392).
- Fixed Conversation-mode prompt assembly so the user's visible status and activity are always included in context unless the persona is set to Invisible, even when a relocated context macro is configured but not present after prompt resolution.

## [2.1.1]

### Added

- Added a **Grok CLI (Subscription)** connection provider that routes chat requests through a local `grok` CLI login for SuperGrok / X Premium+ users, with in-app setup instructions and no API key or base URL fields.

### Changed

- Bumped release metadata to v2.1.1 across packages, the PWA manifest, README release pointer, Windows installer sources, Android APK metadata, and the home-page-visible app version.
- Reorganized Settings so Addons combines Themes and Extensions, Generations houses image/video generation and prompt overrides, Imports uses the plural label, generation prompt editors start collapsed, and Danger Zone uses accent-color selections with no default checked categories.
- Refreshed the in-app Credits modal from the GitHub contributors list and added credits sync/check helpers to the release workflow.
- Split the server generation route into focused prompt, provider, context, and command-runtime modules so Conversation commands, Professor Mari actions, turn games, provider setup, and post-processing paths are easier to review and maintain.
- Removed unused API Key and Base URL fields from local subscription/auth providers such as Claude Subscription, ChatGPT/Codex auth, and Grok CLI.

### Fixed

- Fixed Marinara profile/full backup exports so generated scene-video MP4s and reusable Conversation Call character video clips are included with their storage metadata and accepted on profile ZIP import (#3315).
- Fixed Card Evolution Auditor review proposals being falsely marked stale from cached character data by refreshing the character card before validation, and added an explicit stale override path that appends edited replacement text after confirmation instead of blocking the proposal outright (#3314).
- Fixed Memory Recall embedding creation for very large memories by chunking oversized recall text before sending it to embedding providers, preventing single giant entries from exceeding provider limits (#3317).
- Fixed Windows/git updater and launcher flows so they use the pinned pnpm version, avoid stale aggregate clean/build commands, and rebuild shared/server/client in update-safe package steps (#3318, #3323, #3324).
- Fixed Bot Browser avatar importing for sources that return generic or missing image content types, including Datacat, Character Tavern, Janitor/Janny, Pygmalion, and Wyvern avatar CDNs (#3319).
- Fixed Game Mode NPC portrait generation so GM-generated NPC descriptions are distilled into canonical portrait guidance for the initial and later NPC asset prompts (#3321).
- Fixed the Roleplay setup wizard's **Use Settings Presets** shortcut so it still seeds the selected character's first message when creating an empty chat (#3322).
- Added phonetic name fields to Character and Persona metadata, resolves phonetic-name macros, and uses those values when sending Conversation Call voice lines to TTS so names can be pronounced correctly (#3325).
- Fixed Conversation Call prompt macro resolution so live audio prompts, persona/character context, lorebook entries, daily history, and call transcript content resolve macros such as `{{user}}` before provider dispatch (#3326).
- Fixed custom preset choice confirmation so edited multi-select preset variables can intentionally be saved empty instead of disabling **Confirm Choices** (#3327).
- Fixed Conversation message avatars that were cropped in editors but appeared oversized in DMs/groups by restoring the relative avatar crop container (#3328).
- Fixed Conversation mode prompt assembly so selected preset wrap formats (XML, Markdown, or None) are respected for instructions, daily summary/date blocks, current context, memories, and lorebook injections instead of always wrapping supplemental sections in XML.
- Restored the Echo Chamber chat as a collapsible panel instead of making close/collapse hide the chamber permanently for the chat (#3329).
- Fixed manual group Conversation character triggers so the prompted character receives recent visible group transcript context and does not answer from profile/lorebook content alone (#3330).
- Fixed Roleplay `/guided respond for <character>` in individual group chats so Manual mode asks for an explicit target instead of no-oping, and Smart mode honors the requested character instead of the queued responder badge.
- Fixed first-turn lorebook activation so opening chat messages remain keyword-scannable during the first user generation even when the recent-message scan window would otherwise drop earlier group greetings (#3332).
- Fixed Text to Speech character voice assignment so users can add character voices using provider default voices, including ElevenLabs defaults, even before custom/account voices are loaded.
- Added a per-chat Conversation Calls setting to disable generated bracketed voice cues for TTS providers that do not accept `[whispering]`, `[laughing]`, `[sighs]`, and similar tags.
- Fixed Grok CLI (Subscription) connections so they no longer seed stale `grok-build-*` model aliases, can use the local CLI default model with a blank model field, and fetch selectable model IDs from `grok models`.
- Fixed Grok CLI (Subscription) roleplay requests by preferring the safe headless Composer model when discovered, starting Grok CLI connections with a safer 32k context window, and surfacing a clearer context-limit hint when the CLI reports `max turns reached`.
- Added Lorebook entry-status sorting, fixed continued assistant messages so appended text starts after a blank line, and removed the obsolete tracked `pr-evidence/` artifacts while ignoring future evidence folders (#3336).
- Fixed Conversation-created scene chats so their Prompt Preset selector remains visible while still defaulting to None.
- Made the Connections panel's unfiled/root drop area more forgiving so desktop users, including Windows users, can reliably drag connections out of folders without hitting a tiny target.
- Fixed native lorebook import so nested folders keep their parent/child hierarchy instead of being flattened to the top level (#3347).
- Fixed the character Lorebook tab so an embedded lorebook can be removed from the card: added a **Remove from card** action (including for cards with no linked copy), clarified that the row delete only unlinks the standalone while the embedded copy stays, and renamed **Edit Linked Lorebook** to **Edit Embedded Lorebook** (#3359).
- Fixed a growing pause after each response completes in long chats: removed two O(n²) passes over the whole message history in the post-generation path (a per-message cachedPrompt eviction scan and the swipe-count lookup), so completing a response no longer takes tens of seconds in very large chats (#3402).

## [2.1.0]

### Added

- Added an in-app documentation viewer: the guides shipped in the `docs` folder (installation, configuration, troubleshooting, macros, extensions, Game Mode, and more) can now be browsed and read inside Marinara via a **Documentation** button in the home page footer next to **Replay Tutorial**, and a new "Where can I find documentation?" FAQ entry that shows the on-disk docs path and opens the viewer (#3238).
- Added Conversation-mode audio/video calls with per-chat call toggles, character-initiated incoming calls, a Discord-style desktop/mobile call surface, call-only chat, speaking highlights, mute/camera/screen-share controls, soundboard support, minimized active-call popouts, call history cards, and post-call summary injection.
- Added Conversation Call message reactions, including user reactions in the call-only chat and hidden character `[react]` call commands that react to the user's latest written call message; character-initiated calls can now include a greeting that plays after the user answers.
- Added Conversation Call character video presence: when enabled, Marinara uses the Default for Videos connection to generate cached avatar-based idle, talking, laughing, angry, crying, and sighing clips, then plays them in-call from TTS cues while returning characters to idle after speech.
- Added per-slot Conversation Call clip generation from Character/Persona editor **Sprites -> Clips** empty/error clip cards, so individual idle/talking/reaction clips can be tested without generating the full batch.
- Added Video Generation services for Google AI Studio (Gemini Omni/Veo), OpenRouter, and Seedance 2.0, including connection defaults, asynchronous job polling, MP4 download handling, OpenRouter first-frame references, Veo first/last-frame avatar interpolation, and Seedance first/last-frame URL references for cleaner generated loops.
- Added Advanced > Video Generation settings for editing Game/Gallery scene-video defaults, Conversation Call clip lengths, and the reusable video prompt templates for Game scene videos and call presence clips.
- Added opt-in custom Conversation Call video clips: when Character Video Presence and Custom Clips are enabled, characters can sparsely use `[custom_clip]` for explicit user-requested visual clips that are saved into that character's **Sprites -> Clips** library.
- Added **Sprites -> Clips** to Character and Persona editors for reusable video-call presence clips, including standard idle/talking/reaction slots and named custom call clips.
- Renamed Gallery clips to **Videos** for broader Roleplay/Game/Conversation generated or uploaded video assets, with Character and Persona Gallery **Images** / **Videos** tabs.
- Added user-uploaded MP4 support for both Gallery **Videos** and reusable video-call clips: Character/Persona **Sprites -> Clips** can replace standard call-presence slots such as Idle or Talking or store extra custom call clips, and custom call-clip libraries now allow up to 128 entries.
- Added animated Expression Engine portrait generation: Portrait sprite generation can use Video Generation connections to create short expression clips, convert them into looping GIF sprites, and save them into expression slots, with Advanced > Video Generation controls for duration and prompt templates.
- Added Conversation call voice input through provider-native audio/video when supported, Local Whisper transcription with downloadable Whisper Tiny/Base models, browser speech recognition fallback, and manual system dictation mode.
- Added xAI as a Text-to-Speech provider option with built-in voice fallbacks and xAI speech request handling.
- Added Conversation mode reactions that can target an individual character's part of a merged multi-character reply, including per-segment add-reaction buttons, per-segment reaction rows, and prompt-visible `[User reacted with ...]` notes under the exact targeted segment (#3210).
- Added character-to-character Conversation reactions through `[react: emoji="..." to "Character Name"]`, placing the reaction on the target character's most recent matching part and showing it in both UI chips and prompt context (#3210).
- Conversation mode: character emoji reactions now have their own **Reactions** card in the per-command Commands grid (Chat Settings and the chat setup wizard), so they can be toggled independently like Selfies or Music (#3219).
- Added the Agent Suite to the Chat Settings drawer's Agents section: a window listing the agents active in the current chat where you can view and edit everything they have stored — agent memory, tracker state, and custom-agent outputs — manually or with AI-assisted rewrites (select text, give an instruction, optionally attach grounding context such as character cards or active-lorebook entries, and pick a connection) (#3160).
- Added first-class scene video generation for Game Mode, Roleplay, and Visual Novel galleries, including Video Generation connections for Gemini Omni and xAI Imagine, editable `game.video` prompts, manual Gallery video actions, per-image Animate buttons, Gallery video previews with prompt copy, live View Latest media, and draggable/resizable pinned video overlays.
- Added Game Mode turn storyboards: the active storyboard prompt preset splits completed GM narration into anchored keyframes, renders keyframe media concurrently, follows the current story section in a draggable/resizable viewer, can be reopened from Gallery, and supports off-by-default **Automatic Storyboard Animations**.
- Added per-chat Game Mode media prompt presets with separate **Illustration Prompt**, **Animation Prompt**, and **Game Video Prompt** selectors, read-only built-ins for Still Keyframes, Comic Page, Colored Manga, B&W Manga, and Cinematic Scene Video, plus chat-local editable copies.
- Added Gallery **Images** and **Videos** tabs so generated videos are reachable without scrolling through every still image first.
- Added an optional Game Illustrator toggle for Dynamic LLM Prompt Generation, letting the selected prompt model rewrite Game Mode NPC portrait, location background, and key-moment illustration prompts before image generation (#3225).
- Added `/illustrate` in Conversation, Roleplay, and Game chats to trigger the same illustration action as the Gallery **Illustrate** button without opening the Gallery first.
- Turn-game bots now choose their moves in character (#3308): move selection is steered by the character's personality, mood, and grudges instead of pure game logic, and UNO board summaries include a "What just happened" recap of recent plays so reactions track the actual game.
- Characters seated in a turn game now carry their own seat's perspective into normal chat (#3308): mid-game replies know their own UNO hand or chess color and last move, spectators and unseated characters keep a hands-hidden view, and each generation request loads the game state once instead of once per responding character.
- Turn-game hand secrecy is now personality-gated (#3308): in hidden-information games a seated character knows their hand is private and may deflect, tease, bluff, or let something slip according to their personality, while in open-information games like chess the same treatment applies to their plans.

### Changed

- Bumped release metadata to v2.1.0 across packages, the PWA manifest, README release pointer, Windows installer sources, Android APK metadata, and the home-page-visible app version.
- Documented Conversation audio/video call setup, Local Whisper download, audio input modes, character-initiated call behavior, reusable video-call clips, and Professor Mari's built-in guidance for the feature.
- Refreshed the v2.1.0 documentation set with current setup flows, provider lists, Bot Browser sources, Agent Suite behavior, knowledge sources, custom tools, emoji/sticker uploads, regex scripts, prompt presets, macros, Conversation/Roleplay/Game Mode workflows, Home Assistant setup, remote access, extension safety, container/iOS/Android update notes, storyboard/video guidance, and the current architecture map.
- Made Android/Termux update builds use low-memory build wrappers: server builds transpile runtime JS with esbuild, client builds skip memory-heavy typechecking/PWA generation on Android, and the updater builds shared, server, and client sequentially on Android devices (#3156).
- Removed the Gallery **View latest** button because galleries already show newest images and videos first.

### Fixed

- Fixed root-level Connections panel dragging by adding a Custom sort order backed by saved `sortOrder`, so unfiled connections can be reordered or moved into folders the same way foldered connections can (#3295).
- Fixed merged group Conversation autonomous-message accounting so the selected autonomous character receives the saved message attribution, follow-up count, and daily-budget count instead of every turn being charged to the first group member (#3299).
- Fixed launcher startup messages on Windows, macOS/Linux, and Termux so they show the configured bind host instead of always claiming `127.0.0.1`, while still printing/opening a browser-friendly local URL when the bind host is `0.0.0.0` (#3300).
- Fixed Game Assets create menus inside the in-game floating asset browser so portaled New menus and create modals no longer close the browser, empty names cannot be submitted, and failed create actions keep the modal open with the error visible (#3301).
- Improved mobile browser compatibility by lowering the production client bundle target for Safari and replacing newer `Array.prototype.at` / `replaceAll` usage in shared/client code paths that older iOS Safari versions may not provide (#3302).
- Fixed Game Mode background selection from Settings so a manually selected chat background overrides automatic GM scene background selection until the user removes it (#3304).
- Fixed character library favorites and non-favorites filtering so server-side pagination searches the full library before returning each 100-item page, and kept the **Load more** control in a bottom footer instead of overlapping character cards in both the side panel and full library (#3286).
- Fixed Roleplay `/as` so `/as Character "message"` posts the exact message as that character, while bare `/as Character` still asks the model to generate that character's next response.
- Fixed Roleplay tracker locks so AI tracker updates cannot bypass a locked field by renaming or replacing the locked row at the same position.
- Fixed Game Mode NPC portrait generation so GM-created NPC profile descriptions from initial world setup are rebuilt from current game state at asset-send time, sent as required canonical visual guidance for portrait prompts, and preserved when generated avatars are written back to NPC metadata.
- Fixed launcher startup ordering so `.env` values such as `BACKGROUNDREMOVER_AUTO_INSTALL=true` are loaded before optional background-remover setup begins (#3269).
- Fixed Home Assistant documentation and defaults to point at Marinara's current port, note `WEBHOOK_LOCAL_URLS_ENABLED=true` for local webhooks, and explain that re-syncing updates existing generated tools.
- Added delete controls to Character/Persona Gallery **Videos** and **Sprites -> Clips**, including call-video resets plus custom call clip and scene/game video cleanup from the originating stored media.
- Forced generated Conversation Call character video clips to play silently in calls and **Sprites -> Clips** previews so provider-generated audio tracks cannot overlap Marinara's TTS playback.
- Fixed Google AI Studio Veo reference-image clip generation by retrying with Google's alternate `bytesBase64Encoded` image payload when a Veo model rejects `inlineData`, preserving avatar first/last-frame loop requests.
- Fixed Conversation Call video clips continuing to use stale avatar references by fingerprinting the actual avatar bytes for standard clip freshness and cache-busting regenerated `idle`/`talking`/reaction MP4 URLs.
- Shortened default Conversation Call video-clip prompts so providers get crisp locked-camera loop instructions instead of long identity-preservation prompts that could invite camera drift.
- Fixed **Sprites -> Clips** call-clip generation status so stale `generating` slots from older jobs no longer light up when only one clip, such as Idle, is being generated; Google Veo video extraction now also accepts more completed-operation shapes and reports provider no-video reasons.
- Revised the default Conversation Call video-clip prompts using Google's Veo guidance so clip generation now gives providers explicit composition, subject identity, action, ambiance, locked-camera, looping, and focus instructions.
- Fixed **Sprites -> Clips** call-clip prompts to use the provider-effective clip duration, so Google Veo avatar-reference clips now ask for the same 8-second loop length that Veo actually generates.
- Trimmed Conversation Call video-clip prompts to avoid hard-coded lighting/ambiance and audio-related wording, making avatar-reference clips depend on the uploaded reference image instead of invented call-scene details.
- Added non-destructive trim points for Conversation Call clips, with a small **Sprites -> Clips** trim editor and in-call playback that loops inside the saved start/end range.
- Added a dismissible 10-second muted-microphone reminder when a Conversation Call starts, made **Sprites -> Clips** call-clip pre-generation queue provider requests one clip at a time, removed character-card description dumps from call-video generation prompts, strengthened locked-camera/reference-image loop instructions, and made standard call-video clips regenerate when the character avatar changes.
- Fixed Seedance 2.0 completed video jobs so Marinara reads MP4 URLs returned in `data.results[]` instead of reporting a missing downloadable video.
- Added an opt-in Seedance 2.0 temporary reference-frame upload toggle under **Default for Videos** in Video Generation connections, so local avatar/gallery first/last-frame references can be uploaded to temporary public URLs when Seedance cannot fetch local Marinara files directly.
- Fixed group-chat character reactions always being credited to the first character in the chat: commands placed above the first `Name:` line of a merged reply now attribute to the speaker whose section they open (leaked `[HH:MM]` timestamps no longer skew this), merged group chats now instruct models to write the `[react:]` tag inside the reacting character's own section — and that several characters may react in the same reply — and a react aimed at the user's persona name (or "User") explicitly targets the user's latest message (#3220).
- Hardened Conversation reaction processing against stalls and junk: the shared timestamp strip is no longer quadratic on pathological whitespace runs (~7s → <1ms at 100KB), each `[react:]` command persists with far fewer storage scans so multi-react group replies no longer block generations for seconds on large installs, malformed quote-bearing react tags stay visible instead of becoming junk text chips, and per-segment add-reaction buttons mount their emoji picker only while open.
- Fixed Conversation Call video-clip avatar framing by preparing call-video references as top-aligned 16:9 frames before provider upload, reducing head/hair cropping when Seedance or other video providers animate square avatars.
- Loosened Conversation Call talking-clip prompts so providers can animate natural speaking motion beyond mouth-only movement while keeping the camera, framing, and loop return stable.
- Loosened Conversation Call reaction-clip prompts for laughing, angry, crying, and sighing states so providers can create smoother natural motion while preserving the locked camera, identity, accessories, and loop return.
- Aligned Conversation Call reaction-clip prompts with the successful Talking/Idle prompt shape: one smooth restrained video-call motion, subtle breathing/body/expression motion, and a return to the first-frame pose by the final frame.
- Tightened Conversation Call custom clip generation so the command prompt becomes the clip action, the action returns to the starting pose by the final frame, and Seedance receives explicit first/final avatar references even when both frames are identical.
- Sequenced Conversation Call character video clips from ordered TTS cues, so lines like `[sighs] I thought so [soft laugh]` play sighing, talking, and laughing clips in order instead of using one reaction clip for the whole voice turn.
- Improved Seedance 2.0 task-failure handling by extracting provider failure reasons from more response fields, logging compact failed task payloads, and retrying once when Seedance only reports an opaque unknown operation error.
- Fixed lorebook entry rows collapsing when editing the entry title by making row-header inline controls opt out of the expand/collapse click handler (#3244).
- Capped NanoGPT image-generation reference payloads at three images so Qwen Image/edit-capable NanoGPT models only receive the number of references those services accept.
- Fixed Windows dark-mode contrast for prompt/chat preset dropdown option menus so preset choices no longer render as pale text on a white native popup (#3237).
- Fixed Roleplay empty-input generation so pressing Generate after an assistant reply renders the new assistant output as its own bubble, while explicit `/continue` still appends to the previous assistant message.
- Fixed Roleplay `/continue` with tracker agents enabled so late tracker/cache refreshes no longer restore the previous assistant text and make the continued output vanish.
- Fixed Conversation call prompt assembly so call output JSON format and command instructions stay attached to the latest call input, adjacent same-role call history messages are merged, older TTS cue tags are stripped from call history, command turns use the same descriptive command guidance as normal Conversation mode, and `[end_call]` waits until prior voice lines finish before ending the call.
- Fixed Conversation call command execution so hidden commands such as selfies, memories, music, haptics, influences, notes, soundboard actions, character leave, and call end are executed as call actions instead of leaking into the visible call chat.
- Fixed Conversation call media and UI reliability by keeping speech-only transcripts out of the visible call chat, returning server-resolved character IDs for playback, preserving active calls while navigating elsewhere in Marinara, stacking the call popout with Professor Mari, improving mobile control scaling/participant tiling, and keeping offline characters out of calls.
- Fixed group Conversation calls so each speaking character is prompted as its own ordered turn, server voice-capability checks match the call playback resolver more closely, and accidental voice turns for characters without a resolvable voice fall back to visible call text instead of disappearing.
- Fixed Conversation Call video prompts so generated standard/custom character clips rely on the current avatar/reference frame and concise action/loop instructions instead of stale or overlong character-card dumps, helping video providers preserve visual constraints such as masks or hidden eyes from the reference.
- Fixed Conversation Call prompts so calls with character video presence enabled explicitly tell the model that voice turns are paired with video-call clips.
- Strengthened Conversation Call and animated Expression portrait video prompts so generated clips preserve identity/outfits/framing and return to matching first/final frames for cleaner loops; reaction call clips now default to 5 seconds.
- Fixed the Connections panel Local Model card so a downloaded/running Local Whisper speech model is shown in the collapsed status instead of reporting the whole card as not downloaded when the Gemma helper model is absent.
- Fixed 1:1 Conversation prompt history so assistant turns are speaker-labeled with the character name, preserving multi-turn user/assistant roles while making prior DM replies unambiguous to the model.
- Prevented Echo Chamber from triggering on `/continue` generations; it now stays limited to fresh user messages rather than assistant continuation rewrites.
- Fixed agent pipeline phase overrides so changing built-in agents such as Echo Chamber, Prose Guardian, Continuity, Immersive HTML, Expression, or Music DJ in the agent editor is respected in storage, normal generation, and manual agent retries instead of being forced back to a built-in default.
- Fixed Android APK chat background imports by allowing WebView picker-granted `content://` image URIs and handling Android multi-select file picker results safely instead of returning null picker entries (#3233).
- Fixed the Mari CLI flag parser so boolean flags such as `--tail`, `--raw`, `--patch`, `--strict`, and `--staged` no longer swallow positional arguments in commands like `mari chats messages --tail <chat-id>` (#3222).
- Fixed Local Whisper availability after updates by adding a post-install native dependency repair step that rebuilds or refreshes `onnxruntime-node` for the Node architecture used to run Marinara, and documented the repair path for Windows, macOS/Linux, and Termux installs.
- Renamed the editable scene-video prompt template from `game.omniVideo` to `game.video`, with legacy override fallback, and shortened scene-video prompts for smaller video providers by summarizing narration into a compact story beat, excerpting source illustration prompts, and loosening default motion guidance.
- Fixed escaped roleplay HTML such as `&lt;font color=...&gt;` rendering as visible code by decoding allowed escaped tags before the existing sanitized HTML render path (#3206).
- Fixed Professor Mari preset creation so structured `app_data` `preset.create`/`preset.update` commands can create prompt groups, prompt sections, and preset variables/choice blocks in the same reversible operation (#3207).
- Added a root `pnpm mari -- --help` wrapper that exposes the built Mari CLI from source checkouts without requiring a global install or manual shell alias (#3208).
- Fixed impersonate prompt assembly so fallback chat presets still drop conflicting non-marker sections, while explicitly selected impersonate presets keep their normal prompt sections (#3209).
- Fixed Smart group response order so hidden responder selection no longer overrides `/guided` or `/impersonate` directives in Roleplay group chats (#3212).
- Fixed stopped partial replies being cache-only placeholders, so editing a kept unfinished reply persists it as a real message instead of deleting it on refresh (#3213).
- Fixed Game Mode party recruitment for mid-session NPCs by creating a game-scoped tracked NPC/card fallback instead of throwing when the NPC was not generated at setup (#3216).
- Fixed starting the next Game Mode session when backup branches exist by using the active concluded session as the source and preventing branch labels from carrying into newly created sessions (#3229).
- Removed the hard-coded three-sprite limit from Roleplay sprite selection, setup, and display paths so chats can enable all uploaded sprite owners they need (#3169).
- Let Image Captioning use any non-image-generation connection instead of hiding local or custom multimodal models behind model-name heuristics (#3170).
- Stabilized emoji and sticker popover positioning above the mobile composer when Android browsers resize the visual viewport around the keyboard (#3171).
- Switched Persona editor textarea counters from raw character counts to the same approximate token counts used elsewhere in the UI (#3172).
- Fixed Illustrator prompt tag cleanup so grouped weighted tags such as `(shaved head, bald:1.2)` stay intact during deduplication and negative-prompt extraction (#3173).
- Fixed Windows server builds failing from install paths with spaces by launching the TypeScript compiler through Node directly instead of a shell-resolved shim.
- Restored chat input and generation cleanup behavior so post-generation agents such as Illustrator keep the UI busy state without leaving a duplicate live-stream message visible, and preserved textarea caret position while quote formatting runs on apostrophes.
- Removed the agent/tool write-path size cap on lorebook entry content so large entries are no longer truncated before storage.
- Fixed readable text-file attachments being pre-truncated to 60,000 characters before prompt context fitting, so large uploaded text files can use the selected model's actual context window.
- Fixed Termux dependency refreshes so Android installs that add the `wasm32` optional-dependency architecture run `pnpm install --force`, allowing `@img/sharp-wasm32` to be linked for sprite generation and other sharp-backed image processing (#3167).
- Fixed Android/Termux git updates aborting during release rebuilds with exit status 134 by making the default package build scripts Android-aware and documenting the low-memory update path (#3156).
- Fixed `pnpm install --frozen-lockfile` failures with `ERR_PNPM_TRUST_DOWNGRADE` for older locked dependencies such as `pino` and `semver` by disabling trust-downgrade enforcement for released Marinara installs.
- Fixed partial installs after aborted pnpm runs so launchers detect missing workspace dependencies such as `chess.js` and repair `node_modules` before shared builds run.
- Fixed non-interactive launcher, installer, and in-app updater installs so pnpm can purge and recreate stale dependency folders without stopping for a TTY confirmation prompt.
- Hardened `start.bat` so the Windows launcher explicitly repairs dependencies and runs the root `pnpm build` whenever updates, version mismatches, commit mismatches, or missing build outputs require it, using Corepack/installed pnpm/temporary npx pnpm as available.

### Platform Notes

- Android `versionName` is `2.1.0` with `versionCode 29`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.9]

### Added

- Added Chess as a Conversation-mode table game, including setup UI, move validation, board state, and model/bot play support.
- Added Image Captioning in Advanced Parameters so chats can describe image attachments through a chosen vision-capable connection before sending them to non-vision models.
- Added an Anthropic connection toggle for extended 1-hour prompt-cache TTLs when users want cached context to survive longer between turns.

### Changed

- Converted Immersive HTML from static main-prompt injection into a Roleplay post-processing rewrite agent that works alongside Prose Guardian and Continuity Checker, preserving story meaning while adding diegetic HTML/CSS/JS visuals (#3094).
- Increased default image-generation and ComfyUI polling timeouts so slower image editing and local/remote workflows have more room to finish.

### Fixed

- Fixed continue generation with rewrite agents so continued assistant messages are rewritten from the full merged message instead of being overwritten by only the new continuation text.
- Added backoff for failed conversation summaries and server-side autonomous generations so permanent 4xx/model errors no longer retry every poll forever, while keeping stored failure metadata sanitized and bounded.
- Fixed staging updates so Settings can target the current checkout branch, staging applies create/update a real local `staging` branch, and Windows/macOS/Linux/Termux launchers no longer drag staging installs back to stable `main`.
- Expanded Professor Mari data commands with paginated chat message offsets, full lorebook entry lookup by entry id, entry descriptions in lorebook entry lists, and entry tag support for add/update flows.
- Polished mobile input controls by using a paperclip attachment icon in Conversation mode, placing Game mode attachments before the address selector, hiding Roleplay's mobile emoji button, and tightening Game/Roleplay composer spacing.
- Fixed migrated default agent prompts causing roleplay lag by keeping compatible agents batched with a raw JSON result map instead of wrapping JSON-only prompts in `<result>` tags, and made the default-prompt migration stop rewriting already-current named prompt options on every startup.
- Fixed agent UI flicker by scoping agent processing and failure badges to the chat that owns the run, and stopped ChatArea from repeatedly auto-switching Game chats to the newest session during chat-list refreshes.
- Reduced background request churn by stopping synced themes/extensions from polling every 15 seconds and slowing Professor Mari workspace status refreshes outside explicit workspace actions.
- Fixed rewrite-agent notification timing so held assistant messages keep their post-processing marker until the final rewritten text lands.
- Fixed failed send/generation recovery so timeout-style failures restore the submitted draft, completions, and attachments for retry.
- Hardened prompt regex scripts against polynomial ReDoS by rejecting chained broad unbounded patterns and guarding long server-side replacement runs with a VM timeout.
- Improved profile/backup ZIP import diagnostics when the selected archive does not contain `marinara-profile.json`.
- Tightened Android Firefox chat input sizing so the mobile composer grows less rigidly and leaves more room for typed text.
- Shortened mobile Roleplay and Conversation composer placeholders so command hints do not wrap and pull the input caret upward.
- Fixed XML prompt wrapping so user-authored `>` characters, including Markdown blockquotes, reach the model as typed while `<` and `&` remain escaped for prompt-boundary safety (#3108).
- Fixed legacy Immersive HTML built-in configs so stock saved prompts, descriptions, phases, and result settings migrate to the new post-processing defaults instead of showing the old static prompt.
- Added hold-until-rewrite support for Immersive HTML, pinned it to JSON text-rewrite parsing, counted it as a real post-processing call in agent load estimates, and bundled Prose Guardian, Continuity Checker, and Immersive HTML into one rewrite pass when multiple built-in rewrite agents are active.
- Added mobile chat composer minimization while scrolling through older messages, with automatic restore near the bottom, on downward scroll, or when the minimized input is tapped (#3091).
- Fixed branch switching so a valid selected branch is not cleared just because the flat chat list briefly does not include it while detail/group caches are resolving (#3087).
- Fixed provider requests so blank custom `model` parameters cannot erase the configured model, and corrected missing-model error guidance for MiMo/OpenAI-compatible endpoints (#3110).
- Reduced tracker-panel freezes on chats with world-state/character-tracker agents by scoping tracker character/persona lookups to the active chat and containing off-screen tracker card rendering (#3104).
- Reduced ChatArea render stalls by scoping chat character/persona, creator-notes CSS, and Conversation emoji/sticker lookups to the active chat instead of full libraries.
- Lowered the mounted transcript render window in Conversation and Roleplay modes so long loaded chats keep fewer message components mounted at once.
- Fixed giant imported libraries by paging character, persona, lorebook, full-library, and chat sidebar lists in 100-item batches with Load More controls, while keeping search routed across the full matching data set (#3153).
- Fixed Debug Mode and Peek Prompt previews for `/guided` so the generated narrator instruction resolves macros like `{{user}}` the same way the real generation request does (#2906).

### Platform Notes

- Android `versionName` is `2.0.9` with `versionCode 28`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.8]

### Fixed

- Slowed custom cursor recoloring during Accent Pulse/RGB Mode and skipped cursor recolor work entirely when Marinara's custom pointer is disabled.
- Hardened Windows, macOS/Linux, and Termux launcher updates so generated feature registries keep LF line endings on Windows, launchers stash untracked local files, main/detached installs reset to the exact fetched `origin/main` commit when a normal fast-forward refuses, and Git's real error prints if updating is still blocked.
- Fixed the Android APK blocked-Termux fallback so it copies a full Marinara setup command instead of telling fresh Termux users to run a missing `./start-termux.sh`, and made the copied `allow-external-apps` command tolerate Termux builds without `termux-reload-settings`.

### Platform Notes

- Android `versionName` is `2.0.8` with `versionCode 27`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.7]

### Added

- Added structured no-shell Professor Mari `app_data` actions for character, persona, lorebook, lorebook entry, and theme reads/creation/updates so local models no longer need to compose `mari ...` shell commands for common creative data work.
- Added an Android APK console shortcut under Settings > Advanced > Debug mode that opens Termux for server logs, while non-mobile-shell installs show disabled guidance (#2922).
- Added lorebook semantic-search controls for vector query message depth, score threshold, and per-lorebook vector result limits, plus Active Context vector badges and scores for semantic lorebook hits (#2923, #2924).
- Added a prominent Connections warning that the bundled Local Model is intended for tracker/helper work, not main chat, roleplay, Game Master narration, or Professor Mari creation tasks.
- Added an explicit Local Model connection option for Professor Mari and non-Game chat generation paths when the sidecar model is downloaded, for users who still want to route main chat/roleplay requests through it.
- Added persisted drag-and-drop ordering for custom Functions in the Presets panel, including desktop hover handles and mobile touch dragging.
- Added a Game Illustrator Chat Settings toggle for automatic visual generation plus a Gallery Background action for Roleplay and Game scenes that creates a background-only image, applies it to the current scene, and saves it into the Appearance background library.
- Added a Game mode decision-step branch button on the latest narration/dialogue beat so players can fork before choosing their next action.
- Added customizable RPG stat pools for characters, personas, and Game character sheets so HP-like bars such as HP, MP, EP, or Sanity can be added, colored, tracked, and passed into Present Characters/agent context (#3077).
- Added a per-chat Illustrator Prompt Model override in Chat Settings so selfie and illustration prompts can be written by a different text connection than the main chat model (#2969).
- Added an Advanced > Message Tools toggle to include saved reasoning/thinking in chat exports; exports now omit reasoning by default unless the toggle is enabled.
- Added a built-in `web_search` function-call tool under function selection so chats and agents can fetch compact current web results without custom webhook setup (#3074).
- Added an Appearance > App Style toggle for Marinara's custom mouse pointer, made cursor rules theme-overridable, and recolored the custom pointer from the live Accent Color so RGB Mode and Accent Pulse animate it too. Cursor recoloring now pauses briefly during wheel scrolling so scroll repaints keep one stable custom cursor image instead of flickering, doubling, or jumping at scroll limits.
- Added a startup migration that detects built-in agents still storing untouched pre-2.0.0 default prompt text and moves them back onto the live default prompt path so they receive current default prompt updates automatically.

### Fixed

- Fixed Professor Mari structured app-data creation so new characters, personas, lorebooks, lorebook entries, and non-activating themes save directly without a preview/approval loop.
- Changed Professor Mari reversible app-data edits to save first and show an in-chat Keep/Restore review card instead of making Mari ask the user conversationally about `apply:true` or `apply:false`.
- Fixed recursive macro parsing so character/persona field macros like `{{description}}` resolve nested macros such as `{{char}}` and `{{user}}` when used from prompt builder sections (#2925).
- Fixed memory-recall and agent prompt blocks so `{{char}}`, `{{user}}`, and related prompt macros resolve inside `<memories>` and `<agents>` payload sections (#2927).
- Fixed Illustrator image prompts in tagged/danbooru profiles so illustration, background, and selfie prompts preserve the generated tag list instead of being compacted/distilled like portraits (#2929).
- Fixed chat lists sorted by newest/oldest so simply opening a chat no longer moves it to the top; recency now follows the newest saved message instead of chat-open touches or settings metadata (#2926).
- Fixed Spotify DJ playlist and search tools so malformed model-supplied `limit` values are clamped before Spotify receives them, avoiding `Invalid limit` API errors.
- Fixed RGB accent mode so opening the Appearance settings tab no longer pauses the live rainbow cycle and snaps the app accent back to the first color.
- Fixed Game mode Journal subviews so Timeline, NPCs, Notes, and other tabs scroll inside the Session panel on both mobile and desktop (#2921).
- Fixed TogetherAI image-generation URLs so full `/images/generations` endpoint URLs are not doubled when requests are sent.
- Fixed legacy Extended Descriptions persona migration to explicitly keep the generated lorebook attached to the source persona.
- Fixed Roleplay empty-submit continuation so pressing Enter after an assistant message creates a separate regenerable assistant response, while `/continue` remains the append-to-previous-message path (#2920).
- Removed the unused Quick Replies "Group consecutive messages" setting that no longer affected chat rendering (#2920).
- Fixed Professor Mari's lorebook helper text so `update-entry <entry-id>` and `delete-entry <entry-id>` explicitly refer to lorebook entry IDs, reducing accidental use of parent lorebook IDs.
- Fixed `EXTENSIONS.md` so it documents SillyTavern-style extension folders and JavaScript behavior extensions, not only CSS styling.
- Fixed v2.0.7 version metadata across packages, the homepage-visible app version, Windows installer sources, PWA manifest, README release pointer, and Android APK metadata.
- Fixed regex scripts so display-side replacements share the server safety gate, macro values in Find are treated as literal text, macro values in Replace are not reinterpreted as replacement grammar, random Replace macros resolve once per script application, invalid flags/depth ranges show actionable validation, imports continue past bad entries with skip reasons, SillyTavern display placements import deliberately, a new Apply Mode radio supports prompt-only/display-only/both with legacy `promptOnly` migration, and script ordering/reorder writes remain stable across scoped and global scripts (#2931, #2933, #2934, #2935, #2936, #2937).
- Fixed macro conditionals so numeric comparisons (`>`, `<`, `>=`, `<=`) evaluate numerically instead of falling through as truthy text, `{{else if}}` chains and macro-bearing conditions parse without leaking raw tags, random/dice macros resolve consistently for the same message seed, and runaway nested macro expansion is capped alongside reversed `{{random:X:Y}}` ranges and zero-sided `{{roll:Xd0}}` rolls (#2938, #2939, #2940, #2942, #2943).
- Fixed group-chat join/leave markers so removing a character refreshes the visible transcript immediately and prompt previews keep the "has left the chat" event in the correct chronological position (#2901).
- Fixed the Mini Mari surprise visit toast so its custom layout includes a dismiss button like other app toasts.
- Fixed Browser back controls so they use the same icon-only editor-exit button style as card editors.
- Fixed desktop drag handles in resource panels so draggable cards reveal their grip on row hover, agents expose a matching grip, and regex rows stop showing the grip constantly.
- Fixed `{{agent::TYPE}}` prompt macro insertion so model-generated agent/tracker output is inserted as inert text instead of being re-run as dice, variable, or other macros (#2941).
- Fixed shared theme and extension CSS safety so active themes, live preview, extension CSS, and extension `addStyle()` calls strip external network/script CSS constructs before injection (#2944).
- Fixed extension imports so raw files and loose folders land disabled for review, JavaScript extension enabling asks for explicit confirmation, theme/extension deletion asks for confirmation, extension handler errors name the responsible extension, and toggling/editing one extension no longer restarts every other enabled extension (#2945, #2946, #2948, #2952).
- Fixed synced theme hardening and migration/import diagnostics by adding the extension-style privileged write gate, a 256 KiB theme CSS cap, per-entry theme import skip reasons, and legacy-theme migration backoff/permanent-error handling (#2947, #2953, #2954).
- Fixed card CSS sanitizing so app theme token protection includes popover/sidebar tokens and nested conditional at-rules preserve all outer conditions when scoped (#2950, #2951).
- Fixed client TTS sequencing so failed chunks no longer discard successfully generated audio, and added a saved Progressive Playback option for local/self-hosted TTS backends to start playback while later chunks are still being fetched (#2949).
- Fixed manual Gallery background generation so UI debug mode logs the final image prompt sent to the provider.
- Fixed Spotify mini-player startup noise so disconnected Spotify state no longer polls playback endpoints, and Spotify's Web Playback SDK only loads after the user asks to use Marinara as the playback device.
- Fixed chat tool resolution so Spotify tools stripped from provider prompts when Spotify is unavailable are also removed from the runtime allow-list, producing the intended "Tool not allowed" denial for hallucinated Spotify calls (#3020).
- Fixed preset and prompt edge cases so conversation memories are no longer destructively pruned by daily awareness filtering, imported/duplicated presets preserve `defaultChoices`, grouped Chat History markers keep message boundaries, user-edited bundled presets are not wiped by seed refreshes once a snapshot baseline exists, prompt override defaults avoid ambiguous reverse-substitution collisions, preset variable option edits use the in-flight local option list, stored preset parameters are validated before provider use, and Dry Run preserves `topP=0` like real generation (#3022, #3023, #3024, #3025, #3026, #3027, #3028, #3029, #3030).
- Fixed provider, connection, persona, folder, schedule, and impersonation edge cases so provider finish reasons survive Gemini/Anthropic/OpenAI/ChatGPT paths, Anthropic cache breakpoints stay on attachment-only turns, Local Model sampler parameters respect per-request values, connection mutation responses mask encrypted API keys, provider-category changes keep one agent default, manual model edits preserve max-output overrides, deleted characters/personas leave folders clean, stale persona activation returns 404 without clearing the active persona, character group avatars can be set, persona versions include saved status options, object-form imported persona stats survive import, conversation schedule generation uses queued metadata patches, manual conversation replies do not consume autonomous follow-up slots, in-turn group replies keep Name Prefix History context, and inline custom impersonate placeholders no longer drop whole instruction lines (#3033, #3034, #3035, #3036, #3037, #3038, #3039, #3040, #3041, #3042, #3043, #3044, #3045, #3046, #3047, #3048, #3049, #3050, #3051, #3052).
- Fixed Chat Summary placement so enabled summaries automatically append to the end of the system prompt when the active preset has no enabled Chat Summary marker, while presets with an enabled marker still control the exact insertion point.
- Hardened prompt assembly against XML/Markdown block-boundary prompt injection by escaping untrusted character/persona card text, chat history, summaries, lorebook text, recalled memory, awareness snippets, post-history instructions, and agent-result leaves before they enter engine-authored prompt wrappers.
- Hardened custom script tool execution so enabled script tools no longer receive host-realm intrinsics that could expose server globals such as `process`, and clarified that the opt-in is for trusted in-process scripts only.
- Fixed chat JSONL exports so hidden reasoning is emitted once instead of duplicated through message and swipe metadata, and stale NPC journal rows from unrelated Game chats are filtered from exported `gameJournal` metadata.
- Fixed Roleplay smart group response selection so an empty selector result falls back to a valid character instead of aborting with "No response queue was created", and incomplete auto-created DM chats are cleaned up instead of remaining as empty orphaned chats (#3019).
- Fixed Game mode History Above VN rows so stacked history messages expose the same copy, delete, edit, branch, and NPC portrait actions as the full Logs view.
- Fixed a Game mode History Above VN visual jump when deleting a stacked narration beat by holding the stacked history shell height during the delete frame.
- Fixed lorebook data edge cases so approval-gated Keeper updates append instead of overwriting entries, drawer autosaves stop clobbering header edits, nested explicit replacements still replace, character-linked lorebook sync preserves entry names/descriptions/settings, bulk imports validate folders before writing, moved entries clean up failed target copies, and entry-row optimistic toggles roll back on failed saves (#2970, #2971, #2972, #2977, #2978, #2980, #2981).
- Fixed lorebook matching and scanning so whitespace-only keywords do not match everything, whole-word matching handles non-ASCII word characters, per-lorebook recursion depths below 3 are honored, sticky carry-over does not spend ephemeral activations, and invalid create-time scope conflicts are rejected (#2973, #2974, #2975, #2976, #2979).
- Fixed chat branching so unknown cutoff message IDs are rejected instead of silently copying the full chat, every alternate swipe is preserved, active swipe indexes survive, and Game/turn-game snapshots are copied to the matching branched swipe (#2956, #2962).
- Fixed swipe persistence races so structural swipe edits, generation extras, retry-agent extras, CYOA choices, sprites, attachments, and thinking data target the correct swipe even when users switch swipes while generation is finishing (#2960).
- Fixed regenerated swipes so translations, sprites, choices, token counts, Gemini parts, attachments, and other old-swipe metadata do not leak onto the fresh swipe (#2958).
- Fixed message editing so no-op saves no longer rewrite punctuation/whitespace, empty edit saves are ignored, and classic Conversation edits preserve the raw saved name/timestamp prefix instead of saving the stripped display copy (#2957, #2959).
- Fixed imported Game JSONL transcripts so manual narration edits in `mes` override stale active-swipe content and imported source `gameId`/scene pointers are remapped or stripped so branch imports cannot drive another campaign's sessions (#2966).
- Fixed turn-game engine cleanup so UNO/turn-game state is deleted when messages, chats, groups, or swipes are removed, preventing orphaned game state from resurfacing later (#2961).
- Fixed conditional macros for persona cards by adding persona field operands/macros such as `personaDescription`, `personaPersonality`, and related fields to the shared macro engine (#2964).
- Fixed Android Firefox mobile keyboard layout by sizing the mobile shell from the visual viewport and nudging chat input bars into view after keyboard focus (#2965).
- Fixed swipe counter flashes after regenerate/switch by preserving cached swipe counts and moving optimistic swipe content/extra together with the active index (#2963).
- Fixed Peek Prompt display so the Chat History section only shows user/assistant turns and no longer repeats system prompt/history wrapper content already shown in separate prompt sections.
- Fixed agent retry and generation edge cases around Local Model sidecar fallback, built-in default tools, runtime phase normalization, retry persona/wrap-format parity, noncritical pre-generation failures, Spotify retry fallback, edit-message retry tools, lorebook-update permissions and scoping, Lorebook Keeper error isolation, message-scoped tracker effects, atomic Illustrator attachment appends, batch result parsing, text-rewrite markup preservation, JSON repair, custom-agent run listing/limits, sprite expression variants, and Custom Music DJ reset state (#2983, #2984, #2985, #2986, #2987, #2988, #2989, #2990, #2991, #2992, #2993, #2994, #2995, #2996, #2997, #2998, #2999, #3000, #3001, #3002).
- Fixed custom tool and built-in tool-call edge cases so rich parameter schemas round-trip through the editor, blank webhook/script tools cannot be saved, built-in name collisions are rejected, empty schemas represent zero-argument tools, malformed nested parameter schemas are skipped before provider calls, textual tool-call parsing handles arrays in tags and closing-tag text inside string arguments, edit-message replacements are not capped at the summary append limit, chat variable caps are enforced inside the metadata write queue, automated summary entries are bounded safely, lorebook-entry keys/modes are normalized without data loss, and Spotify volume falls back on invalid input (#3005, #3006, #3007, #3008, #3009, #3010, #3011, #3012, #3013, #3014, #3015, #3016, #3017).
- Fixed image and asset safety edge cases so image-prompt negation only moves the directly negated clause, local music file serving uses the same privileged gate as the folder picker, bundled native game assets cannot be deleted or moved through bulk routes, sprite-sheet grid dimensions validate before provider calls, reference images keep their real MIME type on chat-completions image backends, RunPod ComfyUI observes abort signals and rejects corrupt fallback image data, and chat/global gallery uploads validate real image bytes without leaving partial files or phantom-chat orphans (#3054, #3055, #3056, #3057, #3058, #3059, #3060, #3061, #3062, #3063).
- Fixed mobile UI edge cases so Roleplay exposes the emoji picker on phones, composer emoji/GIF/sticker popovers clamp to short viewports, resource-panel action pills no longer cover row text, Spotify/media floating widgets stay reachable and below open mobile panels, Game Assets toolbar menus stay onscreen, and Game narration/readable copy actions are available on mobile (#3065, #3066, #3067, #3068, #3069, #3070, #3071).
- Fixed Game Lorebook Keeper books carried from previous Game sessions so explicitly linked keeper lorebooks remain eligible for constant/keyword triggering in later sessions instead of being blocked by the old session chat ID (#3073).
- Fixed Peek Prompt display so prompt/system sections surrounding Chat History stay visible while the Chat History block itself still lists only user and assistant turns.
- Fixed `/impersonate` persona-description insertion so macros inside the persona description resolve before the impersonation instruction is appended (#3081).
- Fixed regex import safety checks so optional `?` quantifiers do not incorrectly increase star height and reject valid patterns such as `(a+)?` (#3080).
- Fixed Author's Notes autosave on fast chat switches so an outgoing chat cannot save the incoming chat's note text under the wrong chat ID (#3079).
- Fixed Game Widget setup fields so label/stat drafts can be cleared or contain trailing spaces while editing, with normalization deferred until save/import/export (#3078).

### Platform Notes

- Android `versionName` is `2.0.7` with `versionCode 26`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.6]

### Added

- Added a synced custom theme Accent Pulse opt-in so CSS themes can request the built-in pulse with `--marinara-theme-accent-pulse: enabled`.
- Added a Stable/Staging update channel selector with staging warnings and channel-aware apply checks (#2912).
- Added searchable Home FAQ controls, saved Professor Mari chat history management, Game Mode manual background generation, and lorebook vector deletion controls (#2913, #2909, #2902, #2900).
- Added Up/Down controls for alternate greetings in the Character Editor so card authors can reorder greetings without copy/paste work (#2917).
- Added native Gemini API embedding support for Google and Vertex Gemini connections so lorebook vectorization and memory recall can use Gemini embedding models (#2889).
- Added a per-chat AI translation prompt override in Chat Settings, with a restore-default action, so chats can customize the translation system prompt without losing the built-in default (#2883).
- Added llama.cpp sidecar embedding endpoint controls for pooling type and physical batch size so Gemma and other embedding GGUF models can use OpenAI-compatible lorebook/memory embeddings when they require non-default pooling (#2863).

### Changed

- Chat Branches no longer shows a separate "Active" pill; the checkmark and active row highlight identify the selected branch, while rename/delete actions remain available for the active branch.
- Memory recall chunking now behaves as read-behind storage when a chat message limit is set, keeping the active prompt tail out of durable memory chunks (#2862).

### Fixed

- Fixed compact UI layout polish around the Browser source menu, Settings tab labels, Game Assets import actions, Advanced update/admin buttons, and Lorebook overview control sizing/tooltips.
- Fixed Import Profile and Advanced Danger Zone settings buttons so they use the shared neutral Marinara chrome button styling, with Danger Zone actions stacked one per row.
- Fixed CodeRabbit review findings around recovery-boundary safety, Professor Mari chat switching, FAQ search accessibility, lorebook export/default compatibility, chat metadata patching, import mode validation, update channel checkout safety, and avatar crop normalization.
- Fixed Chats sidebar Conversation rows so they match Roleplay/Game row density while blank/new Conversation chat fallback icons use the cyan mode color instead of the custom chat accent.
- Fixed the Professor Mari home experience so desktop opens the chat inline in place of the home menu while mobile keeps its prior full-screen focus flow, the FAQ opens by default only on desktop, the FAQ/Professor launch card stays taller and evenly split with centered welcome copy on larger screens, the chat composer starts as a single-line input, achievements align to the home card width, missing-connection guidance points at the chain selector, closing the desktop chat no longer flashes homepage text, tutorial copy uses Chat Chrome text colors, Professor chat history controls live inside the chat window, and an in-progress Professor Mari chat can follow the user as an accent-bordered dismissible floating companion after they leave the home screen or open mobile detail sheets, with a DJ-sized circular mobile button and without loading the floating chat machinery while it is hidden on the home shell.
- Fixed broad app slowness paths by avoiding full chat-list refetches when opening Chat Settings, removing eager settings preloads, showing immediate settings/branch loading feedback, skipping Game snapshot copy work for non-Game branches, and stripping bulky internal prompt/debug payloads from branched/exported/imported messages (#2914, #2913).
- Fixed Game Mode setup list editing, guided generation macro resolution, game portrait/background prompt handling, NovelAI image sizing, image-prompt style compaction, and roleplay empty-send behavior (#2915, #2906, #2905, #2903, #2902, #2894, #2893, #2892).
- Fixed chat export/import fidelity by preserving mode/persona metadata, resolving macros in exported transcripts, preserving group-chat speaker snapshots after member removal, stripping internal export payloads, and exporting compatible lorebook entries as arrays (#2913, #2910, #2904, #2901, #2897, #2895).
- Fixed Professor Mari workspace/home behavior by saving previous chats on restart, exposing prior chats for rename/delete/reopen, preserving the selected persona, preventing repeated command-failure loops, asking clarifying questions before vague persona creation, and using a Termux-compatible `mari` shim path on Android (#2911, #2909, #2899, #2891).
- Fixed persistent black-screen recovery, Android/touch popover dismissal around Author Notes and Chat Settings pickers, JannyAI detail imports, blank preset variable options, and default vectorization state for new lorebooks (#2908, #2907, #2900, #2898, #2896).
- Fixed impersonation generations so preset-driven prompts skip regular preset instructions while preserving marker-provided context, preventing conflicting "respond as the assistant" system text from contaminating `/impersonate` prompts (#2886).
- Fixed Professor Mari home-chat restart so chat messages are deleted only after the workspace reset succeeds, preventing failed restarts from causing delayed chat history loss (#2887).
- Fixed Professor Mari workspace privileged-route access so trusted LAN/Tailscale clients can use the workspace when loopback-only mode is disabled, while database command execution remains loopback-only (#2884).
- Fixed privileged-route parameter errors so missing or invalid admin access is not rewritten as a generation-parameter warning (#2884).
- Fixed chat exports so saved thinking/reasoning content is included in text exports and mirrored in JSONL exports/imports (#2881).
- Fixed sprite prompt compilation so concise user descriptions survive prompt review/compaction, and reviewed prompts no longer receive a second layout/negative suffix (#2871).
- Fixed memory-recall branch contamination by pruning native chunks whose timestamp span no longer matches the current chat message log (#2862).
- Fixed v2.0.6 release metadata across packages, the homepage-visible app version, Windows installer sources, PWA manifest, README release pointer, and Android APK metadata.

### Platform Notes

- Android `versionName` is `2.0.6` with `versionCode 25`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.5]

### Added

- Added regression infrastructure with prompt regression and Playwright smoke commands so high-risk prompt/UI flows can be checked before release.
- Added A-Z, Z-A, Newest, and Oldest sorting controls to Browser, Presets, Connections, and Agents panels, with persisted sort choices.
- Added a bulk alternate-greeting swipe insert path so first-message swipes can be added during roleplay setup without many slow client round trips.

### Changed

- Professor Mari now supports streaming in the home-page chat path and no longer limits Mari chat message count/length by default.
- Professor Mari tool instructions are slimmer when the selected model supports structured `body.tools`, avoiding duplicate tool availability text in the system prompt.
- Tool-capable streaming no longer disables streaming by default just because tool calling is enabled.
- New roleplay setup opens the chat/settings wizard immediately and applies starred chat presets in the background while seeding top-level preset connection/prompt fields up front.

### Fixed

- Fixed Author's Notes leaking draft text across chats by remounting the panel per chat and resetting its local draft state when `chatId` changes.
- Fixed roleplay first-message insertion on slow/mobile devices so alternate greetings are added through the new bulk path instead of a fragile sequential browser request chain.
- Fixed dead desktop drag handles in Lorebooks/Presets-style lists so non-functional handles no longer create misleading indentation.
- Fixed chat/message editor regressions from the stabilization pass, including tracker edit targeting, prompt-editor close handling, per-chat lorebook disabling, conversation card info, summary modal interaction, and swipe navigation behavior.
- Fixed several agent editor prompt-customization paths so canon extra prompts can remain customized instead of reverting unexpectedly, while still allowing restoration to defaults.
- Fixed Game mode and image-generation stabilization issues around setup timeouts, NovelAI/background generation, and generated NPC/agent metadata handling.
- Fixed v2.0.5 release metadata across packages, the homepage-visible app version, Windows installer sources, PWA manifest, README release pointer, and Android APK metadata.

### Platform Notes

- Android `versionName` is `2.0.5` with `versionCode 24`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.4]

### Added

- Added Game mode HUD widget import/export controls in Chat Settings and the Game Setup Wizard so widget layouts can be reused between games.

### Fixed

- Fixed Roleplay streaming so failed post-processing/rewrite agent calls no longer drop the Typewriter effect from the final generated message.
- Fixed Roleplay Chat Settings preset-variable configuration so clicking inside the "Configure Preset Variables" modal no longer closes Chat Settings before users can edit choices.
- Fixed `/continue` so it can find the latest assistant message even when the transcript tail is not an assistant turn, injects a continuation cue into the prompt, and appends the model output to the continued assistant message.
- Fixed Professor Mari's home-page chat connection so the selected connection is remembered across Marinara restarts instead of resetting to the first/default connection.
- Fixed legacy group chats with the old Professor Mari character so those chats can still resolve her restored card while keeping the home-page assistant avatar out of Roleplay/Game expression matching.
- Fixed agent activation regressions after removing the old global enabled state so adding agents to chats no longer depends on a legacy per-agent flag.
- Fixed pinned Gallery images so pinned chat images persist across refresh/restart/chat switches and pinning from the full image view actually pins instead of only closing the lightbox.
- Fixed Active Context lorebook reporting so Conversation, Roleplay, and Game modes show the cached lorebook scan from the last generation instead of a best-effort rescan that could disagree with the prompt.
- Fixed Lorebook recursion defaults by making recursion opt-in with a "Recursion" toggle that is off by default for new/imported entries, and fixed keyword entry so pending keys are added when the user clicks away.
- Fixed Game mode generated NPC portrait prompts so NPC descriptions created during world setup are available to portrait generation even when the NPC is not in the character library.
- Fixed Characters and Lorebooks panel filters so search, sort, tag, category, and favorite filters persist while opening and returning from editors.
- Fixed v2.0.4 release metadata across packages, the homepage-visible app version, Windows installer sources, PWA manifest, README release pointer, and Android APK metadata.

### Platform Notes

- Android `versionName` is `2.0.4` with `versionCode 23`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.3]

### Added

- Added a Re-run action to the Echo Chamber panel so users can retry the chamber output directly from the panel.
- Added per-parameter include toggles for Advanced Parameters so strict providers can opt out of unsupported temperature, sampling, penalty, reasoning, verbosity, and max-token fields while keeping custom JSON parameters available.
- Added a Custom Music DJ mode that can pick from local Game Assets music and play tracks through Marinara Engine's embedded accent-colored player, alongside the existing Spotify and YouTube modes.
- Added a default-on Image Generation queue setting so providers that reject concurrent requests can receive one portrait/background/illustration request at a time.
- Added extension manifest documentation and examples for folder-based extension imports.

### Fixed

- Fixed Conversation mode presence/status dots in the chat list and in-chat avatar overlay so they stay synced with live manual overrides and schedule-derived statuses instead of waiting for the next generation snapshot.
- Fixed Conversation mode generation lag spikes by making repeated streaming indicator clears no-op and moving heavy generation/agent console payload logging behind Debug Mode.
- Fixed Conversation mode command history so generated commands like `[selfie]` remain visible to future chat-history assembly.
- Fixed Professor Mari connection defaults so she no longer sends the whole saved defaults object as raw custom parameters, respects connection max-token/reasoning/verbosity defaults, logs her model requests at debug level, and shows clearer parameter-rejection guidance.
- Fixed Professor Mari workspace approval cards so long commands wrap, destructive database deletes show a larger warning with delete previews, and users can see that a restore copy is journaled before approval applies.
- Fixed Professor Mari home-page sessions so the assistant path cannot schedule background autonomous messages.
- Fixed local-provider textual tool calls so local models, including Gemma-style delimiter output, can be repaired into supported tool calls without rewriting unrelated assistant text.
- Fixed curated sidecar GGUF downloads so rounded display sizes are no longer used as exact byte counts for final download validation.
- Fixed Roleplay rolling summary compression so summarized tail messages can be auto-hidden from future AI context while preserving the summary ownership metadata needed to restore or inspect them.
- Fixed summary auto-hide storage rollback reporting so a failed compensating undo is surfaced as a compound failure instead of looking like a clean all-or-nothing rollback.
- Fixed chat notification sounds so rewrite/post-processing agents do not fire the completion ping until the final message is done, with a setting to play notification sounds only when Marinara is unfocused.
- Fixed Game mode chat UI drawers so Chat Settings, Gallery, Session, Retry, Volume, Game Assets, and Active Context can swap in one click/tap without closing first, stay aligned to the toolbar, and avoid the Game-only double-open flash.
- Fixed Game mode Chat Settings startup work and message rendering so opening the drawer no longer forces unnecessary full-history work.
- Fixed image-generation prompt compilation so connection/style prompt and negative prefixes are not duplicated for ComfyUI, selfies, and Gallery Illustrate requests.
- Fixed selfie prompt shaping so the distilled prompt preserves the user's useful prompt detail instead of collapsing it too aggressively.
- Fixed Bot Browser result navigation so Back to results restores the previous mobile scroll position.
- Fixed prompt macros so date/time values resolve in the user's browser timezone and `/continue` can append continuation text to the unfinished assistant message.
- Fixed privileged-route guidance so ADMIN_SECRET setup and the `X-Admin-Secret` header are documented in Settings and configuration docs.

### Platform Notes

- Android `versionName` is `2.0.3` with `versionCode 22`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.2]

### Fixed

- Fixed Game mode world generation returning empty setup JSON on some providers by disabling implicit high-reasoning/high-verbosity defaults for the strict setup JSON call unless the user explicitly configured them.
- Fixed a Game Setup Wizard cancel path that could silently hard-delete an existing campaign when stale metadata or a setup status made the wizard appear for a real game.
- Fixed mobile editor navigation and Lorebooks controls so editor tabs remain usable on narrow screens, Lorebook category selection fits mobile layouts, and mobile sidebars/topbar controls remain reachable while editing.
- Fixed mobile chat UI popovers across Conversation, Roleplay, and Game modes so Author's Notes, Active Context, Retry, Session, Volume, Game Assets, Gallery, and Chat Settings open beside the vertical toolbar, stay on screen, and close predictably when sidebars open.
- Fixed duplicate Author's Notes popovers in Roleplay mode and restored chat export requests across all chat modes.
- Fixed mobile notification stacking so the close action dismisses the visible stack consistently instead of leaving endless messages behind.
- Fixed Preset editor mobile controls and variable-field caret behavior so options no longer spill off screen and typing does not reverse text.
- Fixed Game mode mobile button sizing for map, party, and overflow controls so they match the other chat-mode toolbar buttons.
- Fixed touch drag-and-drop ergonomics in tab libraries by limiting mobile dragging to explicit handles, preventing long-press freezes on Personas and Agents, narrowing the "drop here to move out of folder" target, and removing the unused drag handle from Agents.
- Fixed Expression Engine sprite and avatar visual settings so device-specific positions, sizes, sides, opacities, and avatar overrides are cached locally per device instead of syncing unwanted layout changes across desktop and mobile.
- Fixed Expression Engine emotion matching for non-Latin labels so Cyrillic, Chinese, comma-separated names, and other Unicode emotion names are preserved instead of collapsing into long underscores.
- Fixed chat summary injection so generated summaries use the expected `<chat_summary>` marker and are included even when the preset section label is customized.
- Fixed SD Web UI / AUTOMATIC1111-compatible image generation through llama-swap by sending the configured model as a top-level SDAPI `model` field while retaining native A1111 checkpoint override settings.
- Fixed Music DJ agent editor display so YouTube provider prompt and tool details are reflected correctly.
- Fixed Professor Mari command handling after the JSON protocol refactor so local-model command attempts are repaired through the new JSON command path instead of surfacing as broken plain text.
- Fixed v2.0.2 release metadata across packages, homepage-visible app version, PWA manifest, Windows installer sources, README release pointer, and Android APK metadata.

### Platform Notes

- Android `versionName` is `2.0.2` with `versionCode 21`.
- Windows, macOS/Linux, Termux, Docker, APK, and PWA users can update through the usual v2 updater paths once release assets are published.

## [2.0.1]

### Fixed

- Fixed the Android APK first-launch bootstrap so the app checks the local Marinara server before showing the WebView, keeps the Install / Start screen visible while Termux or Android permission prompts are active, and no longer strands users on a raw `127.0.0.1:7860` connection error page.
- Fixed Conversation Mode Active Context previews changing lorebook entries while idle by making preview-only probability and weighted group selection deterministic for unchanged chat state.
- Fixed Conversation Mode input lag and slow DM switching in large chats by reducing per-keystroke work, throttling draft sync, and limiting rendered transcript work to the visible window.
- Fixed Conversation setup flows where connection or semantic-search selectors could fail to persist selected connections, leave the picker at `None`, or keep the setup wizard/sidebar layered over the wrong newly created chat on mobile.
- Fixed Conversation presence/status wording so away messages use the character's actual name, and improved multilingual character-name matching for avatars, lookup, search, and command matching.
- Fixed Professor Mari chat behavior after v2.0.0: home-page sessions now survive refresh until manually reset, mobile layout starts below the top bar, the mobile CTA says "Ask Professor Mari", and tool/db command instructions are less likely to surface as plain text for local models.
- Fixed Roleplay and generation parameter handling so chats using connection custom defaults respect reasoning/output settings, custom provider parameters continue to be sent, and stored provider reasoning remains routed correctly.
- Fixed built-in local model generation so chat/preset Advanced Parameters control max output tokens instead of being capped by the local runtime fallback value.
- Fixed suppressed/unknown-model parameter handling so max output tokens are still sent while sampler-specific parameters remain gated.
- Fixed OpenRouter service tier handling so Flex/Priority and custom `service_tier` values still reach OpenRouter when unknown-model parameter suppression is active.
- Fixed the post-release issue sweep for chat metadata cache corruption, mobile Characters panel scroll restoration, mobile notification bubbles, Bubble-style multi-speaker messages, Professor Mari mobile restart access, memory-recall embedder retries, YouTube player default visibility, display-size overflow, mobile panel layering, local textual tool calls, new/delete chat failure handling, and visible extension/Mari workspace import errors.
- Fixed Roleplay agent toggles so enabled agents stay enabled after switching to persona, lorebook, or other editor screens instead of being overwritten by stale chat metadata.
- Fixed Roleplay chat-settings presets so metadata-only actions like Advanced Parameters, Translation, Lorebooks, Memory Recall, Tool Use, tracker actions, and agent toggles no longer reset the preset selector back to custom settings.
- Fixed mobile tab/library drag-and-drop ergonomics by requiring the explicit drag handle for touch dragging, restoring normal scrolling elsewhere, improving touch auto-scroll, and preserving folder tap open/close behavior.
- Fixed browser/source dropdown layering, chat window layering, Chat Settings/Gallery mutual closing, and mobile topbar/sidebar stacking so popovers and side panels no longer hide underneath or cover the wrong UI region.
- Fixed display-size scaling regressions where large/huge text caused topbar icons, settings buttons, regex rows, preset rows, and other tab controls to overlap or escape their containers.
- Fixed notification/toast behavior so stacked notifications fade/dismiss consistently and special Professor Mari toast variants use the unified toast styling.
- Fixed Game and Roleplay UI edge cases around widgets, branches, author-note style popovers, gallery image opening, pinned-image depth, YouTube player coloring, and chat toolbar buttons.
- Fixed Game Illustrator wiring so Gallery → Illustrate, scene illustrations, NPC portraits, and background generation use the game chat's selected image connection and scene image instructions consistently.
- Fixed Game Gallery → Illustrate so manual illustrations use the Game Illustrator image connection and asset pipeline directly, preventing false "No connection configured" errors from the retry-agent path.
- Fixed NovelAI reference-image generation so uploaded/data-URL references are normalized to the base64 payload NovelAI expects before being sent.
- Fixed ComfyUI reference-image avatar generation regressions, bot-browser import/delete flows, SillyTavern bulk import mappings, tracker field-lock serialization, and lorebook/import/export edge cases found during the post-2.0.0 stabilization pass.
- Fixed Docker Compose onboarding documentation so the root `docker-compose.yml` location is linked clearly.
- Fixed Marinara's Universal Preset v12 so the bundled language choice defaults to English instead of Polish.
- Fixed legacy persona Extended Descriptions migration so old persona description blocks become persona-linked lorebook entries just like character Extended Descriptions.
- Fixed version metadata for the v2.0.1 hotfix release across packages, the homepage-visible app version, Windows installer sources, PWA manifest, and Android APK metadata.

### Platform Notes

- Android `versionName` is `2.0.1` with `versionCode 20`; users need a rebuilt v2.0.1 APK for the bootstrap/WebView fix.
- Windows, macOS/Linux, Termux, Docker, and PWA users can update through their usual v2 updater paths.

## [2.0.0]

### Release Highlights

- Refactored major parts of the codebase, UI shell, prompt pipeline, storage/import paths, and agent orchestration so Marinara Engine is easier to extend after the 2.0 line.
- Professor Mari is now a separate assistant living on the home page, capable of not only helping and creating stuff but also changing the theme of your frontend, creating agents, and extensions for you. Aka, fully customize your experience.
- Rebuilt the app UI around unified settings controls, square-y chat/sidebar/tab affordances, accent-aware chrome, customizable text/background colors, a reset-to-default appearance action, and optional RGB/pulse accent effects. All available to customize from the Settings. Freshened up mobile view.
- Reworked all the available Agents and made it easy for anyone to create their own custom one. Agents can also now easily be exported and imported.
- Treated this as a release-stabilization pass: every known release-blocking bug and maintainer-tracked issue from the 2.0.0 sweep was addressed before preparing the release notes.
- Marinara's Universal Preset v12 (new version) was set as a new default. Now Presets also include prompts for Conversation and Game modes you can use.

### Added

- Added a Local Model runtime toggle that starts llama.cpp with `--jinja` for OpenAI-compatible native tool calls.
- Added tracker field locks for editable Roleplay HUD and Tracker Panel fields so manually pinned tracker values survive generated game-state updates.
- Added a Termux bootstrap path to the Android APK. The APK now opens a running local server when available and otherwise offers setup actions that can hand the install/start command to Termux after Android's required user permissions.
- Added folder-based import/export support for custom agents and browser extensions so more complex agents/extensions can travel with code and related files instead of only single JSON payloads.
- Added Game Mode custom-agent selection in Chat Settings and aligned the Game setup wizard shell with Conversation and Roleplay setup styling.
- Added UNO/turn-game support for Conversation chats, including in-character setup flow, bot turns, board state, and safer live snapshot handling.
- Added stronger appearance customization: default accent color alignment, chat chrome text color coverage, app background color and gradient presets, RGB mode controls, and Marinara-style home-screen star glints.
- Added release-ready Android APK naming and release-note notices for the Termux bootstrap shell.

### Changed

- Moved AI-assisted character, persona, lorebook, preset creation, and preset review workflows to Professor Mari.
- Unified UI/UX styling across Settings, Characters, Presets, Agents, Browser, Connections, Chat Settings, top bar icons, sidebar tabs, buttons, sort controls, and repeated list rows.
- Improved Game Mode setup, generation defaults, asset generation bounds, checkpoint restore paths, journal/conclusion serialization, HUD widget persistence, and tracker rendering/merging.
- Improved prompt assembly around post-history preset sections, assistant prefill steering, context-window trimming, lorebook placement, visible tracker context, and prompt/debug parity.
- Improved file-backed storage, backup/import/export fidelity, SillyTavern character/lorebook/preset mappings, avatar transcoding, browser card preservation, and JSONL chat import/export.
- Improved local sidecar lifecycle, backend-aware requests, embedding paths, model provisioning checks, and local inference hardening.
- Improved Conversation autonomous scheduling, character presence status scoping, chat settings controls, Music DJ descriptions/behavior, and top bar hover/focus behavior.
- Updated Android docs, FAQ, troubleshooting, configuration, release-note rendering, and APK artifact naming around the new bootstrap-shell behavior.

### Removed

- Removed the deprecated standalone character, persona, and lorebook maker modals (replaced by Professor Mari) and their dedicated generation routes.
- Removed the Preset editor's standalone review tab and dedicated preset-review route.

### Fixed

- Fixed the "Fetch Models" HTML error hint so non-image connections say "connection" instead of "image service."
- Fixed server responsiveness issues where long generations could block unrelated UI/API work such as chat switching and `/api/health`.
- Fixed Roleplay first-message confirmation layering so "Add Message" can be clicked without the Chat Settings drawer closing underneath it.
- Fixed light-theme dropdown/list contrast in Chat Settings.
- Fixed duplicate visual Prose Guardian/agent streaming artifacts when opening other menus mid-generation.
- Fixed YouTube Music DJ first-track behavior to avoid Shorts-style picks where possible and clarified that Music DJ supports both Spotify and YouTube.
- Fixed the Professor Mari surprise toast shape so it matches the rest of the toast UI.
- Fixed max-context-window enforcement so non-history prompt material is prioritized first, recent chat history is windowed afterward, and response/free-token headroom is preserved.
- Fixed RGB/accent styling drift across top bar icons, settings icons, hard-coded pink text, tab/list icons, New chat buttons, title gradients, and solid-color RGB pulse strength.
- Fixed pinned gallery images layering so they stay above chat messages but below Chat Settings, trackers, author notes, summaries, session menus, and other chat UI windows.
- Fixed custom agents in Game Mode chat settings so the picker appears in the Agents section and sits at the bottom of the section.
- Fixed Android, Windows, Docker, Termux, and release-note wording that still described outdated APK/install behavior.
- Fixed Claude Subscription assistant prefill steering so embedded `</assistant_prefill>` text cannot break the synthetic XML-style continuation prompt.
- Fixed malformed provider/proxy response guards for Google/Gemini and related connection paths.
- Fixed Game Mode tracker state races, retry result handling, field-lock persistence, widget persistence, malformed stats rendering, game-state snapshot integrity, and committed tracker context rendering.
- Fixed prompt post-history system sections so they preserve metadata while being injected as user-side content at the configured depth instead of being glued to pre-history system prompts.
- Fixed a broad sweep of import/export, storage, lorebook, agent, sidecar, game-generation, chat-sidebar, and provider edge cases found during the 2.0.0 stabilization pass.
- And many, many more.

### Platform Notes

- Users upgrading from v1.6.1 can follow the new [Upgrading to v2.0.0](docs/UPGRADING.md) guide. Windows, macOS/Linux, and Termux git installs update by relaunching their platform launcher; Docker/Podman users pull the new image; iOS/iPadOS users update the host server and reload the PWA.
- Windows installer sources are already set to `v2.0.0` and continue to build the Git/Node/pnpm bootstrap installer from tagged releases.
- Android `versionName` is `2.0.0` with `versionCode 19`. Release APKs are now named as Termux bootstrap shells instead of "WebView shell requires Termux" artifacts.
- Docker/GHCR release images continue to publish from `v*` tags, including regular and lite variants.
- iOS/iPadOS remains a Safari PWA flow for v2.0.0. A jailbroken/sideloaded one-tap iOS bootstrap wrapper is still future work and is not included in this release.

## [1.6.1]

### Added

- Added a Marinara-specific AI agent workflow overlay, adapted from the Chai Agent Workflow Pack, covering proof discipline, bugfix/feature lanes, issue filing, PR gates, and risky-work claim boundaries.
- Added a None option for Roleplay message avatars so messages can render without avatar attachments.
- Added default starting values for numeric Game HUD widgets, with setup/editor clamps that keep start values within the configured max.
- Added a prompt override editor for registered prompt templates, including conversation selfie overrides, collapsible settings, and draft preservation.
- Added shared drag-and-drop image upload dropzones for character avatars, chat gallery images, and background imports.
- Added a manual Game Mode combat start control with confirmation so players can trigger encounter setup when a scene should enter combat.
- Added a General quote-format preference for straight or curly dialogue quotes and apostrophes, with editor/input formatting support across chat, presets, characters, and personas.
- Added conditional prompt macros, macro comment blocks, and Macro Reference guidance so presets and character/persona cards can keep author-only notes or branch prompt text by speaker/character.
- Added Roleplay TTS narrator voice support and speaker-tagged dialogue voice routing so grouped character dialogue can queue per-character voice requests.
- Added Roleplay Expression Avatar controls so Expression Engine selections can replace character avatars for matching messages, with sprite expression blocks hidden when avatar replacement is enabled.
- Added Roleplay Music DJ source controls matching Game Mode so chats can choose playlist, liked-song, artist, or wider Spotify selection behavior.
- Added an Illustrator run interval setting so scene illustrations are only eligible after a configurable number of assistant messages, and only successful image generations reset the interval.
- Added Roleplay quick-edit gestures: double-click on desktop or double-tap on mobile opens a message editor.
- Added a Chat Settings context toggle for excluding stored provider reasoning from future prompt context, enabled by default.
- Added numbered ComfyUI reference placeholders `%reference_image_01%`-`%reference_image_04%` and `%reference_image_name_01%`-`%reference_image_name_04%`, with the legacy unnumbered placeholders kept as slot 01 aliases.
- Added OpenRouter service-tier selection to generation parameters so OpenRouter connections and chats can request Flex or Priority routing.
- Added a lorebook-level No Vector toggle so an entire lorebook can opt out of semantic embeddings without editing every entry.
- Added a dedicated Game image prompt template editor in General Settings with variables, rendered previews, enable/disable control, and reset support for NPC portrait, background, and scene illustration prompts.
- Added a copy control to stored guided-generation details so guidance can be reused as a ready-to-paste `/guided` command.

### Changed

- Removed the Conversation, Roleplay, and Game mode shortcuts from the topbar because the sidebar already owns mode navigation.
- Widened the Glued Side Panel roleplay avatar presentation so the portrait strip has more visual presence.
- Improved sprite wand cleanup with halo edge cleanup, clean/paint brush tools, unified brush controls, and better multi-pointer handling.
- Polished Tracker Panel visual controls, thought bubbles, persona/tracker card styling, responsive world-state temperature display, and color preview restore/legacy tint behavior.
- Improved Game Mode combat setup so encounter generation can run in the background after scene analysis, with debug logging and a wait state only when the player reaches combat before setup is ready.
- Removed unreliable met/unmet status tracking from Game Mode NPC prompt context.
- Improved Roleplay group chat Individual mode prompting so only the currently responding character card is included, other characters' prior messages are treated as user-side context, and the turn-owner instruction can be toggled.
- Improved Roleplay streaming so the Streaming Speed slider uses a real typewriter reveal cadence instead of dumping fast server token bursts onto the screen.
- Improved Roleplay Music DJ execution so it can trigger in Roleplay chats, respect its configured context/source constraints, strip large playlists into song candidates, and recover playable tracks from grouped post-generation agent results.
- Unified Roleplay Agents & Actions plus Roleplay/Conversation input toolbar icon styling around the neutral grey-white treatment used by the emoji picker.
- Polished mobile Roleplay/Conversation input toolbar controls with larger touch targets while keeping desktop density compact.
- Updated the Roleplay input placeholder to invite writing a response without naming the active characters.
- Limited agent-specific Chat Settings controls to chats where the matching agent has actually been added.
- Updated Gemini topK handling so a disabled topK value sends `0` instead of falling back to the provider default.
- Expanded the Roleplay Re-run Trackers action so it also retries active custom agents alongside built-in tracker agents.
- Improved Settings update checks so git, Docker, and iPhone/iPad PWA clients get platform-specific update guidance, including the Docker release image tags published from `v1.6.1`.

### Fixed

- Fixed mobile Conversation chats where optional toolbar actions could squeeze the message textarea down until it appeared missing on narrow phone viewports.
- Fixed tracker character-card lookup so active-chat card aliases from title/comment text resolve tracker rows before out-of-chat fallback cards, keeping group-chat tracker portraits and color settings attached to the intended character.
- Fixed character tracker refreshes preserving user-uploaded NPC portraits and portrait framing across agent updates, including first snapshot writes.
- Fixed the Roleplay HUD temperature chip so it respects the shared Tracker Panel Celsius/Fahrenheit display setting.
- Added a stale client artifact cleanup step for the obsolete tracker data sidebar folder so installs, updates, checks, and builds are not tripped up by leftover local files after the tracker panel refactor.
- Fixed Docker builds so the stale client artifact cleanup script is available before dependency install/build scripts run.
- Fixed streaming Roleplay messages in Glued Side Panel avatar mode so the avatar frame keeps the selected scale and is revealed by the growing message instead of rescaling while tokens arrive.
- Fixed Quest Board state merges so tracker updates no longer revert quest progress or keep completed empty-objective quests.
- Fixed profile export/import fallback handling for large assets so profile exports can recover cleanly when embedded asset payloads are too large.
- Fixed Windows installer updates for existing shallow release checkouts by fetching the resolved release commit before checkout.
- Fixed mobile Game Mode character and party controls so sheet actions stay compact, long character names can remain accessible, and crowded party rosters collapse into a scrollable mobile party picker.
- Fixed mobile Game Mode choice prompts so large choice sets stay readable and scroll inside the available play area instead of squishing buttons or pushing custom input off-screen.
- Fixed mobile Game Mode side dialogue voice playback so voiced dialogue cues can play when the side line first appears.
- Fixed Game Mode log deletion on mobile so deleting the currently viewed beat returns to the previous beat instead of the start of the turn.
- Fixed Game Mode combat presentation across desktop and mobile: combatants scale to fit tighter screens, status badges no longer misalign portraits, ally NPC avatars resolve from character/game assets, action pacing is slower, desktop dialogue bubbles avoid overlap, and mobile combat dialogue is shown as tappable cues above the action box.
- Fixed quote formatting and macro parsing so curly quotes do not break macro conditions, and quote-formatting no longer pushes editor cursors to the end while typing.
- Fixed macro comments in character and persona card fields so `{{// ...}}` text is stripped before prompt assembly.
- Fixed Roleplay prompt/debug routing around transformed group-chat messages so `<last_message>` follows the actual latest visible message and generated responses trim leading blank lines/spaces before line breaks.
- Fixed Roleplay Music DJ false failure toasts after successful queueing, malformed-summary handling, and missing playable-track extraction.
- Fixed Advanced Settings layout issues, including the Admin Access save button escaping its bounds and tooltip/expand icons crowding each other in non-Game chat settings.
- Fixed gradient character names in Roleplay generated messages so the text uses the gradient instead of rendering as a solid gradient block.
- Fixed rare Professor Mari toast visits so they can be dismissed.
- Fixed Roleplay-to-Conversation DM commands so generated DMs mirror the initiating user message, reuse an existing character DM thread, and leave cardless NPC replies visible in Roleplay instead of trying to create an invalid Conversation chat.
- Fixed Conversation prompt timestamps and current-time context so they use the browser/user timezone instead of falling back to UTC-like server time.
- Fixed Assistant Prefill so generated messages are seeded with the configured prefill text instead of only sending it as prompt-only assistant context.
- Fixed stored-guidance modals appearing underneath high-layer Roleplay controls on compact landscape screens.
- Fixed preset depth-injected sections so short chats clamp them to the chat-history span instead of letting them float above the preset prompt context.

## [1.6.0]

### Added

- Added optional image generation for the Background agent so Roleplay can create and reuse missing scene backgrounds from an agent-selected image connection.
- Added `count`/`quantity` support to Game Mode inventory tags so `[inventory: action="remove" item="Coin" count="10"]` updates stacked item quantities directly. ([#899](https://github.com/Pasta-Devs/Marinara-Engine/issues/899))
- Added `{{charSysInfo}}` and `{{charPostHistory}}` prompt macros so presets can place character system prompts and post-history instructions explicitly. ([#865](https://github.com/Pasta-Devs/Marinara-Engine/issues/865))
- Added checkbox review controls for Continuity Checker findings so users can keep selected continuity fixes instead of dismissing the whole result. ([#858](https://github.com/Pasta-Devs/Marinara-Engine/issues/858))
- Added schedule-less Conversation autonomous messaging so chatty characters can still reach out based on talkativeness and the user's status when schedules are off or missing. ([#840](https://github.com/Pasta-Devs/Marinara-Engine/issues/840))
- Added Google Vertex AI as a connection provider for Gemini models, including Vertex model URLs, model listing, service-account JSON, OAuth bearer token, and API-key credential handling. ([#826](https://github.com/Pasta-Devs/Marinara-Engine/issues/826))
- Added bulk chat transcript export from the sidebar multi-select bar, producing JSONL or text zip archives for selected chats or the full chat library. ([#823](https://github.com/Pasta-Devs/Marinara-Engine/issues/823))
- Added `LOG_PRESET=prompt-connections` and `LOG_DISABLE_REQUEST_LOGGING` so prompt/model/connection troubleshooting can surface debug diagnostics without routine Fastify request-log noise. ([#798](https://github.com/Pasta-Devs/Marinara-Engine/issues/798))
- Added explicit Illustrator try-again controls when image generation fails, including a toast action and a persistent Roleplay HUD retry button. ([#797](https://github.com/Pasta-Devs/Marinara-Engine/issues/797))
- Added Local Model sidecar as a first-class embedding source, including an Embedding Connection option, lorebook vectorization support, and a stable `/api/sidecar/v1/embeddings` endpoint. ([#780](https://github.com/Pasta-Devs/Marinara-Engine/issues/780))
- Added opt-in Turn Data Access settings for custom post-processing agents so they can receive current-turn pre-generation injections and parallel agent results without exposing that data to existing agents by default. ([#778](https://github.com/Pasta-Devs/Marinara-Engine/issues/778))
- Added Memory Recall export/import for moving chat recall data between profiles or installs.
- Added weighted random macro choices for SillyTavern-style random prompt variants.
- Added a native Appearance background blur slider for Roleplay and Game mode backgrounds. ([#763](https://github.com/Pasta-Devs/Marinara-Engine/issues/763))
- Added excluded-tag filtering for the character browser, including `-tag:"tag name"` search syntax and exclude toggles in the character tag picker. ([#702](https://github.com/Pasta-Devs/Marinara-Engine/issues/702))
- Added a server-side autonomous conversation scheduler so enabled characters can generate restrained scheduled messages while the browser poller is absent, with client-presence checks to avoid duplicate client/server generations. ([#698](https://github.com/Pasta-Devs/Marinara-Engine/issues/698))
- Reworked the avatar crop tool into a square-region selector with corner handles + interior pan, so users can pick the exact part of the source image that becomes the circle avatar. Replaces the prior zoom + pan slider on Character avatars and adds the same widget to Personas (previously had no crop UI). The original avatar file is never overwritten — the Roleplay glued side panel still shows the full portrait.
- Added in-game access to Game Assets from the top-right game controls, including per-game asset selection.
- Added `%reference_image_name%` placeholder for ComfyUI custom workflows. When the workflow contains this placeholder, Marinara uploads the reference image to ComfyUI's `input/` folder via `/upload/image` and substitutes the returned filename, so vanilla `LoadImage` nodes can use the reference without needing a base64 decode node. The existing `%reference_image%` placeholder still works for workflows that decode base64 themselves (e.g. via `ETN_LoadImageBase64`).
- Added automated Windows installer builds for tagged GitHub Releases, and hardened release-asset workflows so the `.exe` installer and Android WebView shell APK attach from `v*` tag pushes even when the release itself is created by automation.
- Added a full-screen Game Assets browser with search, previews, editing, multi-select, and bulk operations.
- Added TTS playback controls, guided-action Quick Replies, direct swipe-number jumping, and clearer visible agent failure details.
- Added Game Mode inventory amount controls, drag-swap inventory interactions, tracker card color customization, and visible unread state for background autonomous messages.
- Added connection folders, per-connection prompt preset overrides, profile import progress feedback, and JSONL chat import into existing chats as new branches.
- Added tag import controls, bulk tag removal, Grok image generation support, NovelAI prompt controls for selfies and Illustrator, and Conversation-mode function calls.
- Added Lorebook keyword testing, vectorization exclusions, budget-skip visibility, and stronger regex safety protections.

### Changed

- Guided `/guided` requests and guided manual character replies now use Chat reply lorebook triggers instead of Continue/Autonomous triggers. Move lorebook entries from Continue/Autonomous to Chat reply if they should fire for guided replies.
- Simplified `/emote` syntax so `/emote joy`, `/emote "Character" joy`, and `/emote "all" joy` work alongside the original named arguments. ([#764](https://github.com/Pasta-Devs/Marinara-Engine/issues/764))
- Increased ComfyUI image generation polling to 5 minutes by default, matching the shared image request timeout used by Game Mode assets and documenting the image timeout env settings. ([#786](https://github.com/Pasta-Devs/Marinara-Engine/issues/786))
- Increased the default image generation canvases to `1280x720` for backgrounds, `1024x1024` for portraits, and `896x1152` for selfies so newly generated assets look sharper out of the box. Existing saved image size settings are preserved. ([#913](https://github.com/Pasta-Devs/Marinara-Engine/issues/913))
- Expanded Android APK disclaimers across GitHub Release notes, release asset naming, install docs, FAQ/troubleshooting, in-app update metadata, APK build output, and the Android shell's connection screen so users know the APK is a WebView shell and still requires the Termux launcher to be running.
- Improved Game Mode Spotify and narration handling, scene prompts, startup recovery, and asset generation/regeneration flows.
- Improved Docker runtime config, Docker Lite behavior, sharp handling, Linux sidecar fallback, Termux startup reliability, and the Docker Compose `HOME` default.
- Added a Termux `--skip-update` startup option and improved startup port-collision handling.

### Fixed

- Fixed launcher and in-app updater updates for installer-created shallow release checkouts by fetching `main` into `origin/main` explicitly and moving detached release installs to the fetched `main` commit.
- Compressed oversized chat image attachments before generation and capped provider-bound image payloads so large uploads no longer deadlock OpenAI replies with 413 errors. ([#912](https://github.com/Pasta-Devs/Marinara-Engine/issues/912))
- Pruned stale prompt preset multi-select values from chat preset selections so edited option values no longer leave old strings in assembled prompts. ([#909](https://github.com/Pasta-Devs/Marinara-Engine/issues/909))
- Made CSRF rejections visible in the UI so saves can no longer silently fail when Marinara is reached through an untrusted origin (e.g. a public IP, reverse-proxy domain, or Tailscale MagicDNS hostname). Three layers cover the issue: a sticky red banner appears at the top of the app on page load when the current browser origin would be rejected, with the exact `.env` line and a one-click copy button; the existing toast still fires on any in-session mutation that hits CSRF; and the 403 response now carries a stable `code` (`CSRF_ORIGIN_NOT_TRUSTED`, `CSRF_REFERER_NOT_TRUSTED`, `CSRF_CROSS_SITE`, or `CSRF_MISSING_HEADER`). The server logs the active CSRF auto-trust scope (loopback, HOST, private-IP literals, configured origins) on startup, and a new read-only `GET /api/csrf/origin-status` endpoint reports the current origin's trust verdict. Tailscale, Docker bridge, RFC 1918, and link-local IP-literal origins remain auto-trusted; only public IPs and DNS names need to be listed in `CSRF_TRUSTED_ORIGINS`. ([#722](https://github.com/Pasta-Devs/Marinara-Engine/issues/722))
- Restored message number display in Conversation chats when the setting is enabled.
- Fixed Docker images missing the optional background remover installer script, and added the Python venv runtime needed by the regular image installer.
- Fixed fresh Docker installs so runtime `.env` creation and file-native storage stay inside the persistent `/app/data` volume.
- Fixed Game mode image prompt review so prompt review modals can appear during first-start asset generation instead of suppressing the review flow.
- Fixed Linux NVIDIA local-runtime setup in Docker by falling back to the official Vulkan/CPU llama.cpp builds when Linux CUDA release assets are unavailable.
- Fixed GLM 5.1 via NanoGPT returning thinking-only text in Professor Mari chats by explicitly disabling thinking when reasoning is off and refusing to expose GLM thinking as visible chat output.
- Fixed app settings reverting after reload when stale server-synced settings overwrote newer browser-local preferences.
- Game mode now keeps the selected Appearance background when Scene Analysis is off instead of falling back to black.
- Fixed Game Mode stuck starts, duplicated setup modals, HUD widget setup recovery, provider recovery, thinking-only or empty model replies, and scene intro recovery paths.
- Fixed Game Mode asset generation prompt review, NPC portrait matching, sprite recovery, Professor-name avatar matching, and command-prompt regeneration replay.
- Fixed Game Session Log flicker, deletion offsets, manual deletion persistence, and dice-roll dismissal when advancing dialogue.
- Fixed Game Mode weather, storm ambience, sun overlay behavior, CYOA live updates, skill checks, inventory notifications, combat voice audio, mobile party access, tracker refreshes, and tracker edit persistence.
- Fixed CJK Google font shard loading and scene-summary max-token overrides.
- Fixed manual chat file deletion persistence and regenerate replay for command prompts.
- Fixed Conversation disconnection aborts on Docker, markdown block preservation, hidden-message regeneration crashes, Up Arrow recall behavior, role editing, DM schedule inheritance, random connection schedule generation, and connected-chat placeholder branch names.
- Fixed character avatar uploads preserving unsaved drafts, chat folder click targets, drag reorder behavior, text selection while dragging, folder storage atomicity, and Professor Mari continuation after tool/fetch work.
- Fixed OpenAI ChatGPT request shape and SSE parsing, compressed provider JSON decoding (`gzip`, raw `gzip`, and Brotli), Gemini gzip decoding, provider identity handling, NovelAI V4 prompt/model handling, ComfyUI numeric workflow placeholders, Horde image endpoints, and Pygmalion avatar content-type fallback.
- Fixed macro resolution in lorebooks and regex scripts, Lorebook Keeper overwrite/update behavior, depth-zero lorebook injections, Knowledge Retrieval and built-in agent prompt sections, roleplay leakage from Knowledge Retrieval prompts, preset identity sections, and regex lorebook matching ReDoS hardening.
- Fixed Docker proxy auth behavior and clarified its network scope, and improved file-native backup/self-heal behavior.

## [1.5.9]

### Added

- Improved sprite generation for expressions and full-body ones, allowing you to create matching full-body sprites for game mode to be shown alongside the expression ones.
- Spotify music player with DJ Mari (can be toggled in Settings).
- Cross-device extension storage, so browser extensions can sync through the server instead of staying tied to one device.
- Editable agent context injections and secret plot controls.
  Configurable impersonation controls, including an option to use CYOA choices as impersonation directions.
- /hide and /unhide slash commands for bulk AI-context visibility control.
- Start Chat actions from character views and the character panel.
- Persona-specific saved status options.
- Random expression sprite groups.
- Copy-message support in Game mode.
- Documentation updates for setup, updates, troubleshooting, iOS PWA use, and platform-specific install paths.
- The `.env` is now auto-created on first run (empty placeholder pointing at .env.example).
- Per-connection Fast Mode toggle for Claude (Subscription) — currently a no-op, kept for when Anthropic restores fast-mode routing.
- "Diagnose Model Routing" button on Claude (Subscription) connections, reporting which model the SDK actually billed against.
- OpenAI (ChatGPT) connections that use the local Codex ChatGPT login instead of an OpenAI API key.
- Server-side warning when the SDK silently bills against a different model than requested.
- Roleplay avatar and default sprite scale controls in Appearance settings.
- Per-connection max parallel agent job controls, allowing agent-heavy chats to split same-connection work across multiple LLM calls.
- Editable Game Session History map JSON in the current-session spoiler section.
- Markdown rendering and live preview for Game journal notes.
- Tracker Data Sidebar for viewing and editing live tracker data from the side panel.
- `/emote name="Character" expression="expression"` for listing and manually switching roleplay sprite expressions.
- Duplicate action for individual prompt preset blocks.
- Close controls for Game mode choice prompts and quick-time event windows.
- Agent tool calls for reading and replacing chat-wide string variables.
- OpenRouter as an image generation service through the existing image connection flow.
- Game setup can now review, edit, or remove generated HUD widgets and custom stat fields before the first turn starts.
- Game mode NPC side banter now spreads long runs across later VN segments, reducing oversized popup stacks.
- Roleplay Writer Agents can now pause before the main reply so their prompt injections can be reviewed and edited.
- Game Session Logs now highlight entries included in a pending multi-message deletion.
- Conversation settings now include a Commands section for toggling hidden character commands and configuring selfie and schedule command support.
- Rare Chibi Professor Mari scroll toast easter egg with a matching thank-you response in Professor Mari chats.
- Active World Info controls in Conversation and Game mode, including mobile access through the overflow menus.

### Changed

- Agents in Roleplay display rework.
- Game mode inventory no longer has a hard item cap.
- The `.env` changes hot-reload without a server restart for most settings (auth, IP allowlist, CSRF/CORS origins, and local-URL flags). Boot-bound vars still warn on change.
- Tailscale (100.64.0.0/10) and Docker (172.16.0.0/12) traffic are trusted by default, skipping IP allowlist and Basic Auth, with BYPASS_AUTH_TAILSCALE / BYPASS_AUTH_DOCKER opt-outs.
- CORS_ORIGINS is now hot-reloadable, and same-origin requests are auto-allowed regardless of config.
- Network rejection, SSRF, CSRF, and CORS errors now name the exact env var and the line to paste into `.env` to fix them.

### Fixed

- Fixed local LM Studio connection JSON errors and .local provider endpoint validation.
- Fixed agent output leaking into the main prompt, local model fallback handling, and Narrative Director cadence in group replies.
- Fixed spurious aborts on normal generation completion and raw conversation streaming buffers appearing in the UI.
- Fixed Roleplay DM routing to linked Conversation chats and connected chat branch labels.
- Fixed retrying Conversation generation from the send button and refreshing Conversation status when opening chats.
- Fixed Memory Recall refresh after message edits, reroll invalidation, and Termux embedding handling.
- Fixed Lorebook import, embedded lorebook sync, legacy link hydration, duplicate links, stale linked counts, disabled lorebook activation, prompt preview gates, and several scoping edge cases.
- Fixed Game mode combat targeting, mobile combat layout, combat HP initialization, enemy portraits, skill-check attributes, scene time drift, map regeneration after restored turns, typed choice prompts, background switching races, and scene intro recovery after asset failures.
- Fixed grouped Conversation image attachments and selfie persistence to active swipes.
- Fixed NovelAI image request settings and V4 native prompt input.
- Fixed Google provider empty candidate handling, Claude Subscription model identity loss, llama.cpp embedding response parsing, and TTS provider diagnostics.
- Fixed Docker and Lite Docker startup/install issues, including recursive app ownership layers, CPU-only hosts, and Rollup native binary restoration.
- Fixed Lite Docker sprite generation by rebuilding the `sharp` native module after scriptless dependency installs.
- Fixed conversation schedule generation so a connection max-token override replaces the old fixed schedule budget.
- Removed the oversized Characters panel New Chat row button so character names and metadata are no longer truncated.
- Fixed Active World Info so it reflects the lorebook entries used by the last generation instead of previewing the next turn.
- Fixed Game setup JSON parsing for common LLM omissions such as a missing comma before the next property, and added line numbers to the JSON repair editor.
- Fixed Game mode Talk to GM and Talk to Party turns so they skip scene/weather analysis instead of running the full scene-prep pipeline.
- Fixed right-panel resize handle layering and custom font family normalization.
- Improved combat in Game mode.
- Claude (Subscription) silent model-identity loss; Opus and Haiku falsely self-identified as Sonnet because the SDK strips version awareness without the claude_code preset wrapping.
- Bounded the CSRF/CORS rejection-log throttle caches (capped at 2048 with FIFO eviction) so attacker-controlled origin strings can't grow process memory without bound.
- Unified the CSRF 403 response body to use origin across all branches (it was inconsistent for the Referer-not-trusted case).
- Fixed Game mode inventory item names so long names wrap instead of truncating, and removed stale item-description rendering from inventory surfaces.
- Various UI improvements.

## [1.5.8]

### Added

- Special edition of Game mode Lorebook Keeper.
- Guides for all modes.
- QoL improvements to Lorebooks handling.
- Optional intuitive swipe navigation lets Conversation and Roleplay users move through rerolls with arrow keys or touch swipes, with an opt-in reroll-at-the-end shortcut.
- Roleplay chats can now optionally let characters create direct-message Conversation chats with hidden `[dm: ...]` commands.
- Lorebook entries can now be selected in bulk and copied or moved to another lorebook.

### Fixed

- Various issues caused by the security tightening were fixed.
- Sidecar issues fixed.
- Improves the selfie regex, catching malformed commands.
- Fixed context trimming.
- MLX sidecar runtime installs the upstream `mlx-lm` source build so curated Gemma 4 MLX models can load on Apple Silicon.
- Dry-run prompt preview now trims against manually configured preset Max Context Window values instead of only connection/model limits.
- Script custom tools now show their disabled state in the editor and fail safely when `CUSTOM_TOOL_SCRIPT_ENABLED` is off instead of silently disappearing from agent tool pickers.
- Browser extensions now load under CSP through Blob module execution instead of eval, keeping extension support without adding `unsafe-eval`.
- Local sidecar runtime installation now works when the matching Admin Access secret is entered, even if `SIDECAR_RUNTIME_INSTALL_ENABLED` remains off.
- Agent traffic now warns when the default agent connection may bill a provider. Agents explicitly set to Local Model are skipped with a visible warning when the sidecar is unavailable instead of silently falling back to a paid API connection.
- Chat attachments now wait for file reads, preserve files in manual group mode, and expose supported text files like JSON/Markdown/CSV to the model instead of silently dropping them.
- Fixed rolling in Game mode.
- Lorebook Keeper updates now receive existing entry content, and append structured new facts instead of replacing user-written lorebook text.
- Docker images now repair `/app/data` volume ownership before dropping to the non-root runtime user, preventing `EACCES` startup failures during file-storage migration.
- OpenAI-compatible local streams now accept stricter and looser SSE `data:` formatting, Conversation mode visibly streams text again, and live reasoning chunks appear while a reply is still generating.
- Expression agent sprite updates now repair stale character IDs from the current character name before dropping the expression, so existing characters keep their expressions mid-session.
- Stability AI image connections now test against Stability's account endpoint, fetch legacy v1 engines when needed, and generate through the correct v2beta Stable Image task endpoints instead of probing `/models`.
- Game mode party changes made from Chat Settings now sync to game metadata and carry into future sessions.
- NanoGPT GPT Image 2 requests now normalize image size to a supported pixel budget instead of forwarding too-small canvases.
- Conversation manual generations now share the autonomous in-progress guard, preventing async catch-up replies from duplicating the same user turn.
- Edits made via "Edit Linked Lorebook" on a character with an embedded lorebook now persist back to the character's V2 `character_book`, so deleted entries no longer reappear when the character is reopened, and deleting the linked lorebook clears the embedded copy on the character and evicts the cached lorebook detail instead of leaving stale entries, a phantom Reimport button, and a ghost lorebook editor behind. Imported character cards no longer carry over a foreign `lorebookId` pointer in their extensions, the character editor verifies the linked lorebook actually exists before showing "Edit Linked Lorebook", and the lorebook editor surfaces a 404 with a toast instead of an infinite loading shimmer when opened against a deleted lorebook.

## [1.5.7]

### Added

- Guide for Game mode.
- Professor Mari can now create Lorebooks for you.
- Days tracker in Game mode that you can edit.
- Lorebook entry trigger mode can now be changed directly from the entry status dot.
- Game mode interrupt button that allows you to interrupt the GM (with or without consequences to your game).
- Various improvements to the Game mode's combat and inventory systems, more cinematic battles, better UI handling, and more overall mechanics.
- Game mode map scaling.
- New permanent tag that persists in Roleplay mode if a character passed you important information in Conversation mode.
- Improvements to the Knowledge Router agent.
- Storing the Conversation Theme background gradient separately for dark and light color schemes, so switching OS/browser theme automatically loads the correct gradient.
- Custom agents now have a chat memory.
- Prompt overrides the registry for image generation.
- Active filter tab in Lorebooks.
- Compressed Lorebooks.
- Customizable generation settings for local image generation.
- When generating schedules, they now receive context from the conversation chats you had with a character.
- Hide/unhide messages in Roleplay mode.
- Alternative display of logs for Game mode.
- Custom agents can now choose a result type, including Text Rewrite for post-processing agents that edit the generated reply.
- Setting to enable showing and editing image prompts before they're sent.
- Setting to change the image dimensions for generation.
- Various small QOL changes.
- Custom agents' outputs can now be edited in the Agents button in the Roleplay mode.
- Custom parameters field.
- Sliders to control the sprite's size and opacity in Roleplay mode.
- Custom activity statuses for the user.
- Vectorized Lorebook entries are now visibly marked.
- Character card version history with compare and restore controls.
- Prefills.
- File-backed storage now writes JSON tables under `DATA_DIR/storage`, and backups include those files.
- Allowed token size outputs in agents.
- Lorebook folders.
- Game mode setup remembers custom genre, tone, setting, and goal options from previous games.
- Optional trimming for incomplete model endings before generated messages are saved.
- Draft translation button option in chat Translation settings for Conversation, Roleplay, and Game modes.
- Native vs compatible export choices for profile, character, persona, and lorebook exports.
- PocketTTS is now available as a local TTS provider.
- Optional speech-to-text microphone buttons can be enabled for Conversation, Roleplay, and Game input fields.
- Character imports now ask before extracting embedded character-card lorebooks into standalone Marinara lorebooks.
- Home Assistant HACS integration that syncs Marinara custom tools and a Home Assistant agent for smart-home control.
- Updated the supported toolchain to Node.js 24 LTS and pnpm 10.33.2 across launchers, installers, Docker images, docs, and CI, plus refreshed dependencies within their compatible ranges.
- Lorebook entries can now be scoped by active characters, character tags, and generation triggers, and can scan selected character/persona fields as extra keyword-matching sources.
- Game mode now has an optional Lorebook Keeper that updates a game-scoped lorebook after session conclusion and automatically attaches it to that game.

### Security

- Hardened default network access so loopback remains convenient while non-loopback private-network traffic fails closed unless Basic Auth, an allowlist, or an explicit unsafe opt-in is configured.
- Added global unsafe-method CSRF/origin protections, security headers, route throttling, and shared privileged-route gates for admin, update, backup/import, sidecar, haptics, and custom-tool operations.
- Added SSRF, path containment, upload validation, bulk-import capability tokens, and response-size guards around high-risk URL, file, and archive flows.
- Disabled or gated risky execution paths by default, including API-driven update apply, custom script tools, sidecar runtime installs, and remote haptic control.
- Removed the seeded default provider key, encrypted Spotify token storage, and redacted obvious secrets from profile export.
- Hardened chat HTML sanitization and SVG/image handling, then upgraded vulnerable production and build dependencies.
- Hardened Docker, Android WebView/backup, GitHub Actions action references, and Windows installer dependency verification.
- Breaking/default changes: privileged routes now require `ADMIN_SECRET`, Docker binds to localhost by default, and update apply, custom script tools, and sidecar runtime installs are disabled until operators opt in with the documented environment switches.
- Operators who intentionally need the old exposure model must set `ADMIN_SECRET`, choose a remote bind address for Docker/launchers, and explicitly enable only the required flows such as `UPDATES_APPLY_ENABLED`, `CUSTOM_TOOL_SCRIPT_ENABLED`, or `SIDECAR_RUNTIME_INSTALL_ENABLED`.

### Fixed

- Custom OpenAI-compatible endpoints like Venice no longer receive provider-specific request fields just because a fetched model ID matches an OpenAI, xAI, OpenRouter, or Z.AI naming pattern.
- Addressed various security concerns.
- Game mode dark screen error addressed.
- Consolidated live persistence on file-backed storage, reducing release-to-release migration failures.
- File-backed recovery now checks every known historical data location and repairs snapshots that missed chats during early v1.5.7 testing.
- On mobile Roleplay, the branch quick-switcher now lives inside the three-dot toolbar menu, so it no longer overlaps the Agents' controls.
- Settings Debug Mode now prints prompt, scene-analysis, party-turn, and game asset debug logs even when `LOG_LEVEL` is not set to `debug`.
- Switching chats doesn't stop the generation of the previously triggered one.
- Cross-conversations confusions addressed.
- {{user}} and {{char}} macros now work in all modes.
- Injections at a specific depth now work correctly.
- Added Spotify OAuth redirect URI handling and manual paste-back.
- [Start the game] is being sent twice upon starting the game.
- Expression Engine now retrieves all the available sprites correctly upon retry.
- Fixed unstable message pagination cursor.
- Various errors were addressed.
- Advanced parameters are now respected by local endpoints.
- Improved the quality of some prompts.
- Ensured the daily/weekly summaries trigger consistently.
- We now handle assets in Game mode better.
- Conversation mode characters no longer reply to themselves; instead, they reply to you.
- Drag-and-drop on mobiles now works.
- Custom agents can now rewrite your messages.
- Full-body sprites in game mode now get updated properly.
- Deleted characters from group chat no longer appear as Unknown.
- Roleplay setup and connection setup dialogs now fit short screens with internal scrolling, and Custom Parameters starts empty with an example placeholder.
- File-backed storage now supports Lorebook folders during generation and migration.
- Deleting one saved character card version now leaves the rest of the version history intact.
- Removed the legacy database setup step from the installer flow.
- Fresh installs no longer install the old fallback storage packages.
- Browser-tab character imports now preserve embedded Chub lorebooks as linked Marinara lorebooks.
- OpenRouter Claude reasoning is requested with OpenRouter's unified `reasoning` payload again, restoring thinking capture for Sonnet/Opus reasoning models.
- Sprite sheet prompts now more explicitly require complete slicable grids for expression and full-body pose generation.
- Loopback LLM provider URLs are allowed by default again, so local model servers on `127.0.0.1`, `::1`, or `localhost` do not require the broad private-network URL opt-in.
- Restored the animated Marinara logo on the home screen while keeping the static logo as the inactive-page fallback.
- Tightened the home screen spacing so the logo, FAQ, credits, and special thanks fit more comfortably on desktop and mobile.
- Windows installer updates now force-refresh the release tag and verify the resolved tag commit instead of aborting on legitimate v1.5.7 hotfix retags.
- The v1.5.7 Android wrapper APK now uses a bumped `versionCode` for hotfix updates and the release workflow uploads an installable sideload APK.
- Game Lorebook Keeper now continues in the background after a session is concluded instead of holding the End Session response open.
- Launchers, installers, and in-app updates now fall back to installed or temporary pnpm when Corepack cannot resolve the exact pinned pnpm patch version.
- Explicit ComfyUI and AUTOMATIC1111 image-generation connections can use LAN/private-network hosts without the broad image URL opt-in.
- Restored scoped HTML/CSS rendering inside Roleplay messages and narrator bubbles.
- Backup and profile export failures now surface the specific server/admin-secret error instead of a generic failure toast.
- Haptic agent position commands now normalize PositionWithDuration-style outputs and continue executing later commands if one device command fails.
- Lorebook entry drawers now autosave edits, so the manual Save Entry button is no longer needed.
- Docker/LAN browser origins now pass CSRF checks when Marinara is reached through a mapped host port, and `CSRF_TRUSTED_ORIGINS=*` is honored as an explicit unsafe wildcard.
- Loopback backup/profile export requests no longer require `ADMIN_SECRET` by default; remote privileged requests still do.
- Turning off Conversation schedules now clears saved schedule metadata and resets affected character availability state.
- Removed the Workbox `index.html` navigation fallback that caused non-precached-url console noise.
- Various minor UI bugs.

## [1.5.6]

### Added

- New connection provider Claude (Subscription) that routes chat through the locally installed Claude Agent SDK so requests bill against your Anthropic Pro / Max subscription instead of an `sk-ant-*` API key. Requires `npm i -g @anthropic-ai/claude-code` and a one-time `claude login` on the host running Marinara. This is the same auth mechanism Anthropic-endorsed integrations like Zed use; no proxy or third-party shim is involved. Built-in agent tools are disabled and use Marinara's own agent/tool layer. Embeddings are not supported on this provider; configure a separate connection for them.
- The "Mari is thinking…" indicator appears above the composer while Professor Mari executes her embedded commands (create/update character, fetch, create chat, navigate). Makes it clear that her background work is running, not frozen. Bonus: Dottore is doing jumping jacks.
- Dry-run generation endpoint (`POST /api/generate/dryRun`) that runs the full generation pipeline without side effects; no messages persisted, no agents or tools invoked, no Discord webhooks. Extensions can send a `userMessage` to preview "what if I said this", use `impersonate: true` to preview the user's next in-character line, enable optional injections (lorebook, trackers, chat summary), override the preset or connection, and optionally receive the assembled prompt instead of a completion (`returnPrompt: true`). Supports both non-streaming JSON responses and SSE streaming with abort capability. Intended as a stopgap extension API for flexible prompt inspection and silent generation.
- In Game mode, NPCs can be added/removed from your party, plus now you can manage the party manually.
- If you have Image Generation enabled in Game mode, during important scenes, the model now generates immersive VN-like scenes from the player's POV.
- Overall improvements to generating expressions/full-body sprites for your characters.
- Guided generations with a visible indicator.
- Schedule generation preferences added for conversations.
- Pygmalion, Jenny, and DataCat added to the Browser.
- Pinnable taskbar shortcut via custom launcher.
- Universal Tool Support for agents.
- New Knowledge Router agent.
- You can now link Personas to Lorebooks.
- Drag-and-drop Lorebook entries.
- Added ElevenLabs for TTS support.
- TTS now supports character and NPC voices.
- You can now see spoilers for Game mode and edit the plot accordingly to your needs in the History section.
- Upon ending the Game session, you can now optionally include what you want to happen in the next session.
- Separate volume levels for different sounds in Game mode.
- Added the `/impersonate_prompt` command that allows you to change the impersonate prompt.
- Added manual mode in Conversations that only makes the character respond when you ping them with `@name`.
- Resizing sprites in game mode.
- Conversation auto-summarization now has a Day Rollover Hour (so a late-night session doesn't get cut in half when calendar midnight passes) and a Recent Message Tail (keeps the last N messages verbatim across the day boundary so characters wake up remembering the actual flow of last night, not just the gist). Defaults: 4 AM rollover, 10-message tail.
- Conversation characters can now emit durable `<note>...</note>` tags for connected roleplay and game chats. Notes persist in the target chat's prompt until cleared from Chat Settings.
- Lorebook entries now use compact rows with inline controls and an expandable inline editor.
- Lorebook entries can now be grouped into collapsible folders to reduce vertical clutter for stable or AI-managed entries. Folders have their own enable/disable toggle that gates every entry inside (regardless of each entry's own toggle) without modifying the entries' individual settings, so re-enabling a folder restores everything to how it was. Each folder is its own container — sort by Order works inside the folder, and a folder full of high-Order entries can sit above root-level entries with low Order without conflict. Move entries between folders via a per-row folder picker or drag-and-drop. Collapse state is per-browser (localStorage). Folders are flat in this release; nesting may follow.

### Fixed

- UI and other minor glitches in Game Mode.
- Image Generation in game mode is not firing up for named NPCs in a scene.
- More ComfyUI fixes.
- Various general fixes and improvements.
- Anchor link error.
- We now enable the send button immediately after branching.
- Remove background actually sticks across switches.
- Sidecar CUDA runtime setup fix.
- Light Mode readability issues.
- Removed the ability to apply presets to Conversations, which broke the format.
- Improved usability on mobile devices with small screens, where tapping tiny buttons could be difficult.
- Navigational icons under messages now scale with the display size.
- When selecting Personas during chat setups, you can now see their avatars.
- Switching between chats doesn't cancel generations in progress.
- Parameters added to Conversations and Roleplay setups.
- Bugged NPC entries in Game mode journal.
- Creating a new agent doesn't delete the old one.
- Preset names are no longer set to Default upon being selected.
- Black screen on search bar typing in chats was fixed.
- Various UI fixes applied.
- DeepSeek V4 is now supported.
- Addressed the bug that deleted your Persona fields when uploading an avatar in an unsaved state.
- Minor adjustments to some agent widgets.
- Game mode now supports multiple maps.
- Debug mode restored.
- Expression Engine retries now load available sprites, validate returned expressions, and persist the corrected sprite state.

## [1.5.5]

### Added

- New agent: Card Evolution Auditor that actively updates your characters as they grow.
- Polska gurom!!! In Game mode.
- GM can now add party members during the game and create character cards for them.
- Turn, Scene Analysis, and Assets Image Generation retry button in Game mode.
- Improved Game mode's structure and prompts.
- Custom widgets, notes/books, session summaries, and inventory in Game mode are now all editable.
- You can now upload custom NPC portraits in Game mode when clicking on the portraits.
- The Characters tab now opens a full-page library with large card browsing, creator-note previews, and a selected-card overview before editing.
- Chat galleries and character galleries now support selecting and uploading multiple images in one action.
- Chat branches can now be switched from a selector at the top of the chat bar instead of only through Manage Chat Files.
- Conversation schedules now let you customize per-character idle and DND response delays, plus inactivity follow-up timing.
- Character titles to mirror the ones Personas have.
- Various macros, see all under `/macros`.
- Game mode combat improvements (statuses, abilities).
- Bulk delete.
- Search filters for chats in the Chats tab.
- TTS support.
- FAQ on the home page.

### Fixed

- Fresh installs and client builds no longer fail with `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` because the shared package now builds from root entrypoints instead of the client package's nested `predev` and `prebuild` hooks.
- The lite container release workflow now inspects the correct `-lite` image tag instead of the nonexistent `*-lite-lite` tag, so tagged lite image publishing completes successfully again.
- Fixed sidecar startup state and enabled logs for Ollama to see what's going on.
- You can now use tab when writing lorebook entries.
- Some image generation endpoints.
- Clicking roleplay image attachments now opens them in Marinara's in-app lightbox instead of a new browser tab.
- Auto-play in game mode now pauses when you're reading a note, a book, or doing a QTE event.
- Opening a conversation no longer resets the autonomous-message inactivity timers just because the message history finished loading.
- OpenAI-compatible connections no longer send reasoning payloads to models that do not support them.
- Selfies and sprite generation no longer force a character avatar as a hidden reference image by default.
- Explicitly adding or editing an agent no longer persists it as globally disabled.
- Memory recall now stays inside a dedicated prompt budget before injection, preventing recalled history from crowding out agent and thinking context.
- Exporting a modified character to PNG no longer reuses stale embedded card metadata from the avatar image.
- Sprites get displayed automatically when you add Expression Engine to your chat, and their setup was moved to the Agents section of Chat Settings.
- More ComfyUI fixes.
- Group chats' inconsistent injections: now, upon regenerations, the model knows who should respond.
- Game mode scene-wrap now only sends the current party's character names instead of the entire imported character library, preventing large libraries from tripping the 100-name limit.
- Professor Mari now has access to all the fields in character cards/personas/lorebooks/etc. and can correctly split info into them.
- The Windows installer now downloads Git from a valid prerequisite URL again instead of failing the autodownload step with a missing PowerShell `-Uri` argument.
- Mobile UI fixes for Game mode.
- Increased the output size to 16384 tokens on the new Game setup generation to prevent malformed JSON errors.
- Decreased padding for text in boxes in the Glued Side Panel avatars option.
- Edit Sheet in Game mode black screen bug.
- CYOA choices can now be edited.
- UI fixes.
- Lorebook entries now don't stay active after they've been activated once, and the lorebooks respect the token limits of how many active entries there may be at once.
- Custom widgets now may change between sessions.
- No more looping music/ambiance in Game mode.
- If a provider accepts a smaller context size than the overall model allows, we now automatically reduce the output size to match the allowed size.

## [1.5.4]

### Added

- An option to control when the Narrative Director triggers to prevent rushing.
- Every time you add an agent to a chat, you now see a window with its description and setup.
- Macros support for {{user}} and {{char}} in Game mode.
- Added translation support to the Game mode.
- You can now address the GM directly in the Game mode.
- Refresh cache button in Advanced Settings.

### Fixed

- OpenAI endpoint now correctly re-routes all GPT-5.4 models via Responses API.
- Strengthened the regex to catch incorrect formatting of the messages in Conversations mode.
- Restored the slight delay on receiving multi-line messages in Conversations mode.
- Fixed mobile side displays of dialogues in Game mode.
- Game mode incorrect starting narration.
- ComfyUI generation for sprites and default workflow fixes.
- Removed a bugged new chat creation from Manage Chat Files.
- Bold dialogue formatting now supports Chinese and Japanese quotation marks.
- Strengthened commands in Conversations mode.
- Various mobile UI fixes.
- Scenes cannot be branched anymore (that broke them).
- Sprite generation triggering on unsupported platforms.
- Cross-awareness with game mode.
- Clicking on new conversation notifications while in Game mode now takes you to the Conversations correctly.
- All GLM models now correctly receive only the `enable_thinking` parameter with `false/true` depending on whether you chose reasoning to be `None` or any other.
- Improved Lorebook Keeper agent.
- QTE in Game mode fix.

## [1.5.3]

### Added

- Character galleries for storing reference images directly on a character instead of a specific chat.
- Conversation mode swipe controls.
- An option to delete a selected swipe instead of the entire message.
- Prompt caching support and cache hit/write visibility for OpenRouter Claude connections.
- Recommended models for the first Game generation.
- A setting to disable bold dialogue formatting while keeping dialogue colors.
- Custom parameters setup for initial Game mode generation.
- Instant display of messages in game mode.
- Discord Mirror for all chatting modes.
- No more "Preset Variables" pop-up on presets without them.

### Fixed

- We no longer use browser pop-up windows, so the users won't accidentally permanently dismiss them.
- Various setup fixes, including Docker runtime libraries and launcher/installer build steps.
- Decreased text padding in Roleplay mode inside the message box area.
- Session recordings can now be accessed.
- Addressed storage-query errors.
- Impersonate direction is now properly sent to the model.
- Inventory is now saved and stored between game sessions.
- We now apply the correct headers for official Anthropic calls.
- Multi-line messages no longer collapse after editing in Conversations.
- Character schedules now use your local timezone when generating.
- Dialogue highlight colors now keep working even when bold dialogue is turned off.
- Marinara landing-screen effects now stop rendering when they are off-screen, and they stay paused while the tab is inactive.
- Text renders in HD.
- We correctly catch Gemma-4's thinking tag.
- Audio docker fix.
- Selecting a new location in the Game mode now doesn't automatically transport you there.
- Party-only Game turns no longer commit staged travel.
- Game Discord Mirror now carries narrator labels across regular turns and new-session recaps.
- Game chat parameter changes now override setup-time defaults after the game has already been created.

## [1.5.2]

### Added

- General settings now include a persisted app-language selector at the top of the tab. It currently exposes only English and is ready for future translation PRs to extend it.
- Added a new option to display character/persona avatars in the Roleplay mode (as a side panel, bigger size). Access it in the Appearance Settings.
- NanoGPT support and improved image connection handling.
- Added a macOS Apple Silicon-only MLX backend for the local sidecar.
- Support for running different local models.

### Fixed

- Installed Windows desktop and Start Menu shortcuts now launch Marinara Engine with the correct working directory, so packaged installs no longer open and close immediately.
- Windows installers and launchers now force the repo-pinned pnpm version through Corepack when available, so older global pnpm installs no longer break setup, and the batch installer restores the Marinara icon on the desktop shortcut.
- Conversation mode no longer forces OpenAI-compatible backends like NovelAI onto the non-streaming transport path, preventing immediate cancellations while keeping complete-message rendering in the UI.
- Character maker, persona maker, lorebook maker, prompt review, retry-agents, game setup, and other system tasks now obey the global Streaming Responses toggle instead of silently forcing streamed transport.
- Image Generation connections can now keep ComfyUI selected on non-default hosts and ports, so remote ComfyUI servers still expose checkpoint fetching and custom workflow JSON.
- Connection max-context limits now trim oversized prompts before generation, and prompt inspection shows the fitted prompt that was actually sent upstream.
- OpenRouter connection provider preferences now carry through agent runs, game setup, GM/tool generations, and other helper flows instead of falling back to Auto router outside the main chat path.
- Inline reasoning blocks wrapped in `<thought>...</thought>` or `<|think|>...<|/think|>` are now extracted into stored message thoughts, and game-mode JSON helpers strip those blocks before parsing model output.
- Glued Side Panel roleplay avatars now fade and blur out more aggressively at the bottom so they merge into the message bubble instead of ending abruptly.
- Clean installs no longer warn that pnpm ignored build scripts for `onnxruntime-node` and `protobufjs`, so Windows users do not need to run `pnpm approve-builds` or patch `package.json` by hand.
- Added the no split mode flag to prevent the looping crash of Gemma-4 on multiple GPU systems.
- Tracker agents can now use the built-in local sidecar through the normal Connection Override dropdown, and the Local Model card now provides a bulk action to point every built-in tracker at the local model.
- Fixed new game mode sessions not starting after the last one concluded.

## [1.5.1]

### Added

- Display of the time of the day in the game mode.
- Custom game widgets can be moved around.

### Changed

- Removed the Quests tab from Game Mode. Game sessions deliberately do not use tracker agents for quests, so the journal now focuses on the code-driven data it actually maintains to avoid excessive generations.

### Fixed

- Returning to an active game session no longer reopens the full-screen world overview and blocks the current scene behind the black intro overlay.
- Combat encounters now wait until narration and scene presentation finish before opening, and HUD widgets hide during combat and restore correctly afterward.
- Loot drops now resolve to the correct item names instead of malformed combat-drop payloads.
- Constant lorebook entries selected for Game Mode are now injected during world generation instead of being skipped during setup.
- Non-English setup languages now propagate through setup generation and GM output formatting, so game text stays in the selected language.
- `/game/setup` now streams upstream tokens during first-turn world generation, reducing timeout failures on slower local backends.
- Map discoveries and NPC meetings now populate the journal from code-owned game state. Locations appear when discovered, and NPCs are logged when first met instead of only after a reputation change.
- Our built-in Gemma-4 will now target available GPUs during generations.
- Fixed Gemma-4 issues on Windows.
- We now only install llama-cpp if you choose to host Gemma-4.

## [1.5.0]

### Added

- Introducing the new **Game Mode**! A cross between a classic roleplay and a visual novel, fully driven by the AI GM! Embark on adventures either solo or with a party of characters of your choice. Or perhaps have one of your characters DM the game for you and others? The games span multiple sessions, and _anything_ can happen. The sky is the limit. Well, I guess your wallet, too.
  - Follow an easy and quick game setup wizard to customize your game, or ask the model to come up with the ideas for you.
  - The game's UI is a cross between RPGs (think Baldur's Gate) and visual novels. Witness dynamically changing dialogues, backgrounds, sprites, ambiance, music, sounds, and weather; all based on your current scene. The mode supports sprites and will show them with different expressions. You have an item inventory, an automatically updated journal storing information about your adventure, and an option to talk to your party whenever you feel like simply chatting with them instead of progressing.
  - Your party, and you, all have unique character cards, secrets, and goals to achieve. Remember to keep morale high.
  - Do dice rolls yourself or let the GM handle those for you.
  - Play with the interactive widgets, travel to different locations via a map, build a reputation with NPCs and factions, and explore a dynamically changing world.
  - Everything is handled on the backend. You just sit back, relax, and enjoy the experience.
  - Seriously, just try it. It's fun. I put a lot of time and effort into it, so you'd better enjoy it, or I'll explode.
- Automated sprite generation for expressions and full-body poses in character cards. These can be used for both roleplay and game modes.
- Saved presets for starting new roleplays and conversations.
- Option to save parameters (samplers) per connection.
- Select, duplicate, and manage multiple chats/characters/lorebooks/personas/etc. at once.
- More filters to sort by in lorebooks, and added an ability to lock entries from being edited by agents.
- You may now generate images based on the chat anytime by pressing the "Illustrate" button in the Gallery.
- Spellbooks were added as a separate lorebook category, used in combat.
- Added an ability to download and use Gemma-4-E2B, a tiny model that can be run even on mobile devices and can handle trackers in roleplays and scene analysis for the game mode.
- Other minor things I probably forgot about, have fun discovering them on your own.

### Fixed

- Expression Engine fix that prevented sprites from being generated.
- Messages will no longer disappear and reappear only upon page refresh.
- Scenes created out of conversations now inherit all the parameters from their original chat.
- Fixed a "niche advanced parameter bug", if you know, you know.
- Added full markdown support for roleplays.
- Various Termux/iPhone native fixes for both installation and UI.
- Text formatting with asterisks is now fixed.
- Bettered image generation support.
- Lorebook entries not working in scenes.
- Numbered lists now display correctly.
- You can now select a folder where your backup will be saved.
- No more random scroll-ups when editing lorebooks.
- Additional minor fixes that I can't be bothered enough to list, I want a break.

## [1.4.8]

### Added

- Added `pnpm check`, version-sync helpers, and PR CI checks for version drift.
- Added tracked-installer and release-note scripts plus a GitHub release workflow driven by `CHANGELOG.md`.

### Changed

- Startup config now resolves `.env` before env-sensitive server modules, normalizes repo-root data paths, and keeps `/api/*` 404s JSON-only.
- Shell launchers now align on the resolved `PORT`, honor launcher-level browser auto-open consistently, and pin pnpm to the repo version.
- Android now uses a build-time WebView server URL constant instead of a hardcoded Java literal, with optional `MARINARA_PORT` support in `android/build-apk.sh`.
- The client app shell now lazy-loads editors, right-panel surfaces, onboarding, modals, and the main chat surface to reduce initial bundle weight.

### Fixed

- **Vanishing messages after generation** — Messages could disappear at the end of streaming in Roleplay mode due to the browser and service worker serving stale cached API responses. Added triple-layer cache busting (server `Cache-Control: no-store`, client `cache: "no-store"`, and Workbox `NetworkOnly` for API routes) and hardened the streaming-to-message transition with retry-on-failure and double-rAF React commit timing.
- **Agent deletion foreign key constraint** — Deleting an agent no longer fails when chat history references its characters.
- **Mode switch caching** — Switching between Conversation and Roleplay mode now correctly invalidates the cached chat data.
- **Update system** — The in-app update check and notification flow now works reliably.
- `CORS_ORIGINS=*` now behaves as explicit allow-all without credentials, while explicit origin lists retain credentialed CORS support.
- GIF search no longer falls back to a shared embedded API key when `GIPHY_API_KEY` is unset.
- Sidebar tab text metrics were made explicit so descenders like the `y` in `Roleplay` no longer clip.
- Default log level changed to `warn` to reduce console noise.
- Cross-post redirect handling corrected.
- Restored local data-path compatibility so existing installs continue to resolve storage under `packages/server/data`.
- Update checks now resolve the newest GitHub `v*` tag even when `releases/latest` is stale.

## [1.4.7]

### Added

- **Persona Groups** — Organize personas into named groups with full CRUD and local storage.
- **Group Scenario Override** — Replace individual character scenarios with a single shared scenario for group chats.
- **AI Persona Maker** — Generate complete personas from a prompt using your LLM connection via SSE streaming.
- **Import Persona** — Import personas from PNG character cards or JSON files.
- **Quick Connection & Persona Switchers** — Floating popover switchers anchored to the chat input.
- **Notification Bubbles** — Floating avatar notification bubbles for unread messages in background chats.

### Changed

- **Personas Panel Redesign** — Search, sort, active/inactive filter, plus New and Import action buttons.
- **Quick Switcher Vertical Alignment** — Desktop quick switchers anchor to the input box container's top border.
- **Conversation Edit Simplification** — Removed keyboard shortcuts from message editing; explicit cancel/save buttons only.
- **Blank Line Collapsing** — Runs of 3+ consecutive newlines collapsed to a double newline.
- **OpenRouter Thinking/Content Block Parsing** — Correctly parses thinking and content blocks from reasoning models.
- **Claude 4.5/4.6 Temperature-Only Sampling** — Omits `top_p` for Claude models that only support temperature.

### Fixed

- Fixed quick switcher flash at (0,0) on mount.
- Fixed notification bubbles not triggering from normal generation path.
- Fixed notification character ID parsing (JSON string now properly parsed).
- Fixed empty conversation response guard.
- Fixed memory recall scoping.
- Fixed Lorebook Keeper scoping.
- Fixed missing `persona_groups` DB migration.

## [1.4.6]

### Added

- **Bot Browser** — Browse, search, and one-click import characters from Chub.ai directly inside the app. Includes paginated grid view, sort by downloads, stars, or trending, an NSFW filter toggle, and full character detail previews.
- **Chat Folders** — Organize chats into named, color-coded folders with drag-and-drop reorder. Move chats between folders, collapse or expand them, and filter by mode. State is persisted server-side.
- **Slash Commands** — Added SillyTavern-style commands with autocomplete, including `/roll`, `/sys`, `/guided`, `/continue`, `/as <character>`, `/impersonate`, `/remind <time> <message>`, `/random`, `/scene`, and `/help`.
- **AI Lorebook Maker** — Generate structured lorebook entries from a topic prompt using your LLM connection, with SSE streaming, batch support, and attach-to-existing-lorebook support.
- **Connection Duplicate & Test** — Clone existing connections, including encrypted API keys, and test connectivity with provider-specific checks.
- **ComfyUI Custom Workflows** — Paste custom workflow JSON with `%prompt%`, `%negative_prompt%`, `%width%`, `%height%`, `%seed%`, and `%model%` placeholders.
- **OpenRouter Provider Preference** — Select a preferred upstream provider when routing through OpenRouter.
- **Expanded Image Generation** — Added Pollinations, Stability AI, Together AI, NovelAI, ComfyUI, and AUTOMATIC1111 / SD Web UI alongside OpenAI-compatible image generation.
- **Plain Text Chat Export** — Export chat history as readable plain text alongside the existing JSONL format.
- **Embedding Base URL** — Configure a per-connection base URL for embedding endpoints.

### Changed

- **Performance — Streaming Re-render Optimization** — Extracted streaming UI into isolated components so the main chat area no longer re-renders on every streamed token.
- **Performance — Zustand Selector Batching** — Combined UI store selectors with shallow comparison and memoized style objects to reduce unnecessary re-renders.
- **Performance — Debounced UI Persistence** — Debounced `localStorage` writes and added unload or visibility flushes to reduce churn without losing data.
- **Chat Text Appearance** — Unified chat text color under a single setting and set the default text stroke width to `0.5px`.
- **Folder UX** — New folders now appear at the top, render above unfiled chats, and support inline rename plus hover-delete affordances.
- **Roleplay Input Responsiveness** — Tightened responsive spacing and flex behavior in the input bar to prevent overflow.
- **Home Page Mobile Layout** — Reduced mobile padding, constrained content width, and improved QuickStart card responsiveness.
- **Tracker Injection Order** — Tracker data now injects before Output Format for correct prompt ordering.
- **Settings Panel Polish** — Renamed reset actions to "Reset to default", removed redundant labels, and consolidated reset behavior.

### Fixed

- **Infinite re-render loop** — Wrapped the combined Zustand selector in `useShallow()` so `memo()` can short-circuit correctly.
- **Message background opacity** — Corrected roleplay bubble colors to match the intended Tailwind neutral palette.
- **New folders appearing at the bottom** — Fixed both the server-side sort order assignment and the client-side render ordering.
- **Missing DB column migrations** — Added `openrouter_provider`, `comfyui_workflow`, and `embedding_base_url` to startup column migrations.
- **Combat encounter `parseJSON`** — Corrected escape-sequence handling and added multi-stage sanitization for AI responses.
- **Additional fixes and polish** — Includes smaller bug fixes that shipped as part of the same release.
