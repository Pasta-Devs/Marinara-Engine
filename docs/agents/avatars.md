# 2D and 3D Avatars

Two downloadable agents give your characters and personas an animated avatar that reacts while a reply streams in. **2D Avatars** shows PNGTuber-style sprites or mesh avatars, and **3D Avatars** shows VRM models. Faces follow the reply, and mouths move with the text or with text-to-speech.

This feature is still being built. The sections below fill in as each part lands on `staging`.

Live2D models are not supported. Live2D's licence needs a separate agreement with Live2D even for free open-source apps, and its runtime cannot be shipped with Marinara Engine.

## Downloading the agents

Both agents are being tested. For now, **Download Agents** offers them only when Marinara Engine runs on the `staging` branch.

**2D Avatars** and **3D Avatars** are separate downloads, so you can install only the one you want. Both work for characters and personas in Roleplay and Game chats.

1. Open **Agents → Download Agents** and install **2D Avatars**, **3D Avatars**, or both. Neither needs a restart.
2. Set up each avatar on the agent's page in **Agents**. See [Setting up an avatar](#setting-up-an-avatar).
3. In a Roleplay or Game chat, open **Chat Settings → Agents → Misc Agents** and add the agent.

The agents send no extra requests to your AI connections while you chat. They need an Engine with Capability API 1.73, and an older Engine refuses to install them.

## Setting up an avatar

Avatars are set up on each agent's own page. Open **Agents**, open **2D Avatars** or **3D Avatars**, and use the **Avatars** section near the top.

1. In **Character or persona**, choose who gets the avatar. Names marked "(has an avatar)" already have one saved.
2. In **Avatar type**, choose the kind to set up. 2D Avatars offers **PNGTuber sprites** and **Mesh avatar**. 3D Avatars offers **VRM model**.
3. Set it up in that type's own section below the switches: use your sprites or import a file, choose the face for each feeling, or remove it. See [2D avatars](#2d-avatars-pngtuber-sprites-and-mesh-avatars) and [3D avatars](#3d-avatars-vrm-models).
4. Use **Preview** to see it. **Try a face** switches feelings and **Talk** moves the mouth. When there is nothing to show yet, the preview shows an example avatar.

A character or persona with expression sprites already has a PNGTuber avatar on the 2D Avatars page, so chats with 2D Avatars on show it with nothing saved.

**Show this avatar in chats** turns the avatar on or off without deleting it. **Movement** has three switches that apply to every type: **Lip sync** moves the mouth, **Blinking** blinks every few seconds, and **Idle motion** breathes and sways while waiting. If a character has more than one avatar type, **Show this one** picks the type chats use. When that type's agent is off in a chat, the chat shows another type whose agent is on. Removing a type deletes its files; your sprites stay, and an avatar you turned off stays off.

An avatar shows in a Roleplay, Visual Novel or Game chat when the chat has agents on and the matching agent added. It works with or without the Expression Engine. The avatar does not hide the full-body sprite, so turn that off yourself if the avatar replaces it. Avatars stand where the full-body sprite would and share its size. To move them, use the sprites' **Arrange** mode in the Expression Engine's sprite settings.

Imported files are checked before they are stored, and there is no avatar-specific size limit below the server's normal upload limit. Avatar files live in the data folder under `avatar-models/<character or persona>/<id>/`, next to an `avatar.json` with the settings. Backups and profile exports include this folder. Deleting a character or persona deletes its avatar, also when the Danger Zone of Settings clears all **Characters** or **Personas**, and clearing **Media & Assets** there empties the folder. Character card exports never include avatars.

## 2D avatars: PNGTuber sprites and mesh avatars

**2D Avatars** shows one of two kinds of avatar: **PNGTuber sprites**, flat pictures that swap faces, open their mouth and blink, and **mesh avatars**, drawings that move their head, eyes and mouth smoothly. Set both up on the agent's page in the Agent editor after you pick a character or persona.

### PNGTuber sprites

A character or persona with expression sprites already has a PNGTuber avatar: its sprites are the faces, with nothing to set up. Portrait sprites are used when there are any, and full-body sprites otherwise, so one avatar never mixes the two.

- **Talking and blinking pictures.** Add sprites named after a face with `_talk` for the open mouth and `_blink` for closed eyes, for example `happy_talk` and `happy_blink`, and `happy_blink_talk` for both. `_talking`, `_speak`, `_mouth_open`, `_blinking` and `_eyes_closed` work too. A face without them still hops while it talks.
- **Face for each feeling.** Choose which face shows for Neutral, Happy, Angry, Sad, Relaxed and Surprised. **Resting face** uses the Neutral face. Every sprite is offered, including ones added after you saved the avatar, up to 64 faces. A PNGTuber Plus import offers only its own faces. When the Expression Engine or the Game Master picks a sprite you have, that exact face shows.
- **More feelings.** Under **Face for each feeling**, open **More feelings** to choose a face for 23 more specific feelings, grouped under the six: Curiosity under Neutral; Admiration, Amusement, Desire, Embarrassment, Excitement, Gratitude, Optimism and Pride under Happy; Annoyance, Disapproval and Disgust under Angry; Disappointment, Grief, Nervousness and Remorse under Sad; Approval, Caring, Love and Relief under Relaxed; and Confusion, Fear and Realization under Surprised. They are optional. Each one uses its main feeling's face until you pick another. A sprite named after one of them, such as `fear`, `amusement` or a word like `scared` or `laughing`, is used for it without any setup.
- **Movement.** **Hop while talking** and **Hop height** set the PNGTuber-style bounce. **Time between blinks** is the average; each blink comes a little sooner or later, so it never looks mechanical. With reduced motion turned on in your device, the avatar does not hop or breathe, but its face and mouth still change.
- **Sprites show as they are.** A sprite drawn on a background shows with it, and your sprite files are never changed. For faces without a background, use [Faces from the avatar](#faces-from-the-avatar).
- **Use my sprites** saves the sprites as the avatar's faces. Choosing a face or changing the movement saves it too. **Update from sprites** picks up sprites you added later and keeps the faces you chose for each feeling. After an import, choose **Remove** to go back to your sprites.

**Import PNGTuber Plus save** reads an avatar saved by [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) (a `.save` file). Each costume becomes one face, and its talking and blinking layers become the talking and blinking pictures. The pictures come in as they are, with any background they have. Costumes are matched to feelings by the names of the pictures they show, such as `angry eyes.png`. Choose a face for any feeling the names did not cover. Some things do not come across:

- Wobble, drag, rotation and stretch are not imported; the avatar shows each layer at rest.
- Animated layers show only their first frame.
- Very old saves keep only the paths of their pictures on the author's computer. Save them again with a newer PNGTuber Plus first.
- A very large avatar is scaled down to 2048 pixels so phones can hold every picture.

Importing a save needs image processing on the server. Some Android installs (Termux) do not have it, so the import is refused there with a message saying so.

### Mesh avatars

A mesh avatar is a `.mavatar` file. Marinara Engine can make one from one of your sprites (see [Making an avatar from a sprite](#mesh-avatar)), or you can make one with [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) (see [Make your own model](#mesh-avatar-studio)). Choose **Import .mavatar file** to add one, or **Replace file** to swap it. With idle motion on, the avatar breathes and looks around on its own. It blinks, and its mouth follows the reply. If the file has drawn mouth shapes, they are used; otherwise simple ones are drawn for it.

Under **Look for each feeling**, choose what each feeling shows: one of the six feelings, or **Smile**, **Shy**, **Half-closed eyes** or **Wink**.

Every file is checked when you import it, and a damaged file is refused with a short reason. So is a file too detailed to play smoothly, or one that unpacks to more than the upload limit. Only the parts the avatar needs are kept, so the original illustration inside the file is not stored. The artwork belongs to its creator; check its licence before you share it.

Mesh avatars need WebGL2, which current browsers have. Without it, or when the browser stops the avatar's graphics to save memory, the avatar shows your PNGTuber setup or your sprites instead.

## 3D avatars: VRM models

**3D Avatars** shows VRM models, the format that VRoid Studio, the VRM add-on for Blender and UniVRM for Unity export. VRM 1.0 and VRM 0.x files both work.

You can also make a VRM model from a full-body sprite with Tripo, using your own Tripo account. See [Make a 3D model with Tripo](#make-a-3d-model-with-tripo).

1. Open **3D Avatars** in the Agent editor and pick the character or persona.
2. Under **VRM model**, select **Import VRM** and choose a `.vrm` file.
3. Read **The author's terms**. They come from the model file and say who may use the model as an avatar, whether commercial use is allowed, whether you may change the model, whether sexual or very violent content is allowed, and for VRM 1.0 models whether you must credit the author and may share the file. When the file links to a license or to the author's own terms, open them too. Marinara Engine shows the terms but does not enforce them, so please follow them yourself.
4. Under **Faces and mouth shapes**, check which of the model's expressions shows each face (Neutral, Happy, Angry, Sad, Relaxed and Surprised), each mouth shape (A, I, U, E and O) and blinking. Most are filled in for you: **Set by the model** means the model has the standard VRM expression, and **Guessed from its name** means one of its own expressions has a matching name. An expression the model left empty changes nothing, so it is never filled in for any face but Neutral, which is the model at rest, and the import says when it skipped one. Pick another expression, or **None**, whenever a guess looks wrong.
5. Optionally, under **Idle animation**, add a `.vrma` file for the model to play while it waits. Without one, the model breathes and sways gently.

**Replace model** keeps the idle animation, because VRM animations fit any VRM model. **Remove model** deletes the model and its idle animation.

While a chat runs, the model looks at you, blinks on its own when it has a blink expression, and tilts its head while it thinks or listens. Its head stays near the top of its spot: a wide spot shows the head and shoulders, and a narrower one shows more of the body. Some VRM 1.0 models keep the mouth still while they show a face; while such a model talks, that face shows at partial strength so the mouth can still move. With reduced motion on, the face and mouth still change, but the model stops swaying, breathing and playing its idle animation.

Some files can't be used, and the import says why:

- **Compressed models.** Files saved with Draco or meshopt compression, or with KTX2 textures, don't load. Export the model again with compression turned off.
- **Plain 3D models.** A `.glb` or `.gltf` model without VRM data has no face expressions or humanoid skeleton. Convert it to VRM first, for example with the VRM add-on for Blender (see [Make your own model](#blender-with-the-vrm-add-on-for-blender)).
- **Incomplete models.** A model whose skeleton is missing bones VRM needs or points to parts that aren't in the file, or that points to files outside itself, is refused.

There is no size limit beyond the app's usual upload limit, but large models take longer to load, especially on phones.

## Get a 3D model

If the character or persona has no VRM model yet, make one with VRoid Studio. It's a free app from pixiv for Windows, macOS and iPad, and models you make in it are yours to use. A few of its built-in items and any textures you buy have their own terms, so check those first. Its models come with the six faces, the five mouth shapes and blinking, so faces and lip sync work right away.

Or let Tripo make one from a full-body sprite, with your own Tripo account: see [Make a 3D model with Tripo](#make-a-3d-model-with-tripo). It costs Tripo credits, and the model's face doesn't move.

On the **3D Avatars** page, pick the character or persona. Under **Get a 3D model**, **Read the guide** opens this section and **Copy prompt** copies a description of their look.

1. Download [VRoid Studio](https://vroid.com/en/studio) and install it.
2. Optionally, make a picture to work from: select **Copy prompt** and paste it into an image generator. VRoid Studio has no box for a prompt, so the picture is only something to look at while you build.
3. In VRoid Studio, create a new model. Pick the hair, face, eyes, body and outfit closest to the character, then change their shapes and colours until they match.
4. Export the model as VRM. VRM 1.0 and VRM 0.0 both work. Fill in the model's details and terms when VRoid Studio asks.
5. Open **3D Avatars** in **Agents**, pick the character or persona, and select **Import VRM** under **VRM model**. Under **Faces and mouth shapes**, every face, mouth shape and blink of a VRoid Studio model is already filled in.

**What the prompt is for.** It describes the character for tools that make a picture or a 3D model from text: a full-body anime-style character standing in a T-pose, seen from the front on a plain background, with its look. The look comes from the **Appearance** field, from the **Image Appearance Override** tags instead when those are on, or from the description when there is no appearance. The prompt has the name and look only: nothing else from the card and nothing from your chats. It's in English; change it as you like before you use it.

**What moves.** The face follows the reply and the mouth moves with the text or the voice when the model has expressions for them. A VRM from another tool may have fewer or none, and **Faces and mouth shapes** shows which it has. Some websites say they make a VRM with face expressions from a picture or a description, but none could be confirmed when this guide was written (October 2026), so this guide doesn't recommend one.

### Make a 3D model with Tripo

Tripo is a paid service that makes 3D models from pictures. On the **3D Avatars** page, **Make 3D model** under **Get a 3D model** turns one full-body sprite into a VRM model with your own Tripo account. A model costs about 60 Tripo credits (about $0.60) and takes about 3 minutes.

1. Sign in at Tripo, then create an API key on [Tripo's key page](https://developers.tripo3d.ai/en/keys). Buy credits there too.
2. Open **3D Avatars** in **Agents** and pick the character or persona. Under **Get a 3D model**, paste the key into **Tripo API key** and select **Save**. **Get a key** next to it opens Tripo's key page. The key is kept for every character and persona, so you paste it only once. **Remove** deletes it.
3. With the key saved, your Tripo balance shows. The full-body neutral sprite is picked for you; you can choose another. Use a full-body sprite where the whole character is visible: a bust or a cropped sprite gives a model without legs, and it is refused.
4. Check your balance and the cost, then select **Make 3D model**. Each step shows as it finishes, with the credits used so far: Tripo draws the sprite standing in a T-pose (5 credits), makes the 3D model (30 credits) and adds a skeleton (25 credits), then Marinara Engine turns it into a VRM file.
5. Look at the pictures, then select **Save as the VRM model**, or **Discard**. Saving replaces the character's or persona's current VRM model.

**Body only.** A Tripo model moves its body, arms and head, but its face doesn't move: it has no face expressions, so it can't smile, blink or move its mouth. **Faces and mouth shapes** says so instead of offering faces to pick. Hair, coats and tails are part of the body and don't swing, and the hands have no fingers to bend.

**Cancel** stops waiting at once. Tripo can't stop a step it has already started, so it may still finish that step and charge for it. Tripo gives back the credits of a step that fails.

If something goes wrong, the setup says what to do:

- **Key not accepted:** paste a working key into **Tripo API key** on the **3D Avatars** page and select **Save**. **Get a key** opens Tripo's key page.
- **Not enough credits:** top up at Tripo. The balance is checked before anything starts, so nothing is spent.
- **Content policy:** Tripo refused the picture. Try another sprite.
- **Busy:** try again in a minute.
- **Arms down or no legs:** the model can't move like an avatar, so it's refused before anything is saved. Try another full-body sprite.

**What is sent.** Your sprite goes to Tripo, with its background removed first when it has one. The key is stored encrypted on the server, is sent only to Tripo's API, and is never shown in the app, written to a log or included in a profile export. With debug mode on, the server log shows each Tripo request's settings and task numbers.

**Who may use the model.** Under Tripo's terms, models made by paying users belong to them, and Tripo keeps the rights to models made for free. The art in your sprite may also belong to someone else. So the model file claims only personal, non-commercial use by you, asks for credit, says not to share the file, and links to [Tripo's terms](https://developers.tripo3d.ai/en/terms). **The author's terms** shows these. Check them before you share the model.

## How faces and mouths follow the reply

Avatars react on their own; there is nothing to set up for this part.

**Faces in Roleplay.** While a reply streams in, Marinara Engine reads each finished sentence and guesses its mood. To keep the face from flickering:

- The face changes only when the new mood is clearly stronger than the current one.
- A face stays for at least two seconds.
- The face goes back to calm only after two calm sentences in a row.
- About four seconds after the reply ends, the face relaxes back to calm.

A PNGTuber avatar with faces for [more feelings](#pngtuber-sprites) can also show the more specific feeling a sentence reads as, such as Amusement while it is happy. That face follows the same rules: it needs a clear reading and stays for at least two seconds, and a feeling without its own face shows its main feeling's face. Expression Engine and Game Master picks work the same way: when the avatar has no face with the picked name, such as `scared`, it shows that feeling's face, here Fear. 3D and mesh avatars show the six feelings only.

**How the mood is read.** Your chat connection is not asked. Your chat text stays with your own Marinara Engine and is never sent to an outside service.

- A built-in word list answers at once, everywhere, and knows common mood words in several languages.
- On computers that can run it, Marinara Engine reads the sentences with a small emotion model instead, the mood reader. It understands 36 languages. It downloads once, about 300 MB, the first time you open a Roleplay chat with 2D Avatars or 3D Avatars turned on. It does not download while both agents are off. Each avatar agent's page in **Agents** shows the download's progress, and a failed download tries again by itself about 10 minutes later. The word list answers until the mood reader is ready, and after the download it works offline. It uses about 1 GB of memory while in use and unloads after 10 idle minutes. Lite installs, Android and computers with less than 3 GB of memory keep the word list.

**Faces in Game mode.** Each line the Game Master shows comes with an expression, and the speaking character's avatar takes it. A character's inner thoughts change the face but not the mouth.

**The Expression Engine.** When it is on in the chat, its pick after the reply is the final face for that reply. A pick that arrives after you sent your next message stays with the reply it was for. Avatars work without it too.

**Mouths.** From the text, the mouth moves only for dialogue (words in quotes, `[Name]:` lines and speaker tags), not for narration, at about the pace of speech. If the text appears faster than anyone could say it, the mouth speeds up and then skips ahead so it stays with the words on screen. With streaming off, a reply's dialogue is spoken within eight seconds. When text-to-speech plays a line, the voice moves the mouth instead, so a character's narration read in their voice moves their mouth too.

**Body.** An avatar thinks from the moment you send until its first words, talks while its mouth moves, listens while someone else talks or while you type, and rests otherwise.

**Group chats.** In an Individual group, the member who is replying speaks, including when you swipe one member's message. In a Merged group, each paragraph belongs to the first character it names, or to the one before it. While a paragraph that names nobody is still appearing, its dialogue waits until a name or the paragraph's end shows who says it. With streaming off in an Individual group, only the last member's reply moves an avatar for now.

## Lip sync with text-to-speech

When text to speech reads a Roleplay reply, the avatar of the character who is speaking moves its mouth with the voice. The mouth opens wider on loud sounds and closes in pauses. It also changes shape: it rounds on dark sounds like "oo" and shows the teeth on sounds like "s". There is nothing extra to set up. Turn on text to speech as described in [Text to Speech (TTS) Setup](../media/tts-setup.md), and lip sync works with **Auto-play** and with the **Speak** button on a message, including the visual novel layout.

- **Who speaks:** the mouth that moves belongs to the character whose voice reads the line, the same character the **Voice Option** picks a voice for. When a reply has several speakers, each character's mouth moves only during their own lines. Lines read in the narrator's voice, and speakers who are not characters in the chat, move no mouth. With **Only read dialogues** off, a character's own narration is read in their voice, so their mouth moves for it too.
- **Pause, stop and switching chats:** pausing or stopping the voice stops the mouth. If you switch to another chat while a reply is still being read, the avatars there stay still. Come back to the first chat while the voice is still playing, and its avatar picks the voice up again.
- **Volume:** the **Line volume** slider changes how loud the voice is, not how wide the mouth opens.
- **Personas:** a persona's mouth does not move for your own messages, with or without text to speech.
- **Game Mode:** Game narration plays through Game Mode's own audio, so in Game Mode avatar mouths follow the text for now.

Lip sync does not change how the voice plays. Marinara Engine reads a separate copy of each voice clip to time the mouth, so playback works as before, including in Safari and on iPhone and iPad. If your browser cannot read a clip, the voice still plays and only the mouth stops following it.

## Making an avatar from a sprite

On the **2D Avatars** page in the Agent editor, choose a character or persona, then use **Make an avatar from a sprite**. It works from the sprites the character or persona already has. Your avatar stays the same until you save a result, so you can try as often as you like.

### Faces from the avatar

**Make faces from the avatar** makes faces without a background, also for a character or persona with no sprites yet. It opens sprite generation, the same one as in the character and persona editors, with the avatar checked as the reference. It starts with the six main faces, Neutral, Happy, Angry, Sad, Relaxed and Surprised, and offers 23 more feelings, such as Pride, Grief and Realization. Each extra feeling sits in the row of the main face it shows until it has its own face. Choose **All faces** for all 29, **Main faces** for the six, or any faces you like. The faces are drawn in batches, main faces first, with as many in each picture as the grid holds; older GPT Image models draw one face per picture. A picture that fails is tried again once; if it fails again, the run stops with **Retry picture**, and **Cancel** keeps the faces already made. With **Expose media prompts before sending** on, you review the prompts for every picture at once before the first is sent. Every face is drawn with open eyes and a closed mouth, so its blink and talk pictures have something to close and open. It draws new expression sprites from the avatar on a plain color, removes that color, and saves them as the character's or persona's sprites. A new sprite replaces the one with the same name, so rename it in the last step to keep the old one. When the avatar is already saved, each new face becomes the face of the feeling it was drawn for, even one you renamed; your other sprites stay, and you can choose them again under **Face for each feeling**. It needs an avatar and an image generation connection.

### Blink and talk pictures

1. Each face the avatar shows for a feeling is one row, named after the feelings that show it. Next to the **Face** are its **Eyes closed** and **Mouth open** pictures: ones you saved, `_blink` and `_talk` sprites you added, or new ones. When the character or persona has portrait sprites, only those are used, because the avatar never mixes portrait and full-body faces. A face that isn't one of your sprites, such as one from a PNGTuber Plus import, shows its pictures, but new ones can't be drawn for it.
2. Check the **Image connection** (your default image connection is picked for you). It must accept a reference picture; a connection that can't is refused before anything is drawn. **Make** draws one missing picture, and **Make pictures** draws all of them. Every picture is one image request. With **Expose media prompts before sending** on (Settings), you see and can edit each prompt first.
3. The new pictures appear one at a time. Select **Keep** on the ones that look right and **Try again** on the others; **Try again** also redraws a picture you already have. The picture being redrawn stays dimmed with a spinner until the new one arrives. **Cancel** stops the picture being made, on the server too, and drops the pictures that weren't made yet. If **Try again** fails, the old picture stays. To redo a kept picture, select **Kept** to let it go first.
4. Select **Save kept pictures**. They become the PNGTuber avatar's blink and talk pictures for those expressions, next to a copy of the sprite they were drawn from so they always line up. If the avatar was still showing your sprites as they are, it keeps all of them and gains the new pictures. If you replace a sprite before saving, make its pictures again.

These pictures need an image connection that accepts a reference picture, because your sprite is sent as the only reference, with a prompt that asks to change only the eyes or the mouth. Some connections draw a new picture instead, such as Pollinations, Together AI, Horde, DALL-E, or a ComfyUI workflow with no slot for a reference picture. They are refused before anything is drawn. Your sprite is sent at the size and shape the model accepts, a cut-out on a white background, and cut back out of the result with the sprite's own outline, so a model that keeps the picture in place gives pictures that line up. If a picture changes more than the eyes or mouth, the avatar jumps when it blinks or talks; try that one again.

### Mesh avatar

1. Pick one sprite. The full-body neutral sprite is picked for you when the character has one, otherwise the neutral sprite; you can choose another. A front-facing full-body or bust sprite works best.
2. Choose the **Chat connection that can see pictures**. **The agent's connection** uses the connection set on the 2D Avatars page, then your default agent connection. Its model must accept pictures.
3. Select **Make mesh avatar**. The chat model finds the face, and Marinara Engine builds the avatar from your sprite as it is. **Cancel** stops it.
4. Check the preview: the outlines should sit on the eyes, brows and mouth. Select **Save as mesh avatar**, or **Discard** and try another sprite or model.

A generated mesh avatar moves its head, eyes, brows and mouth, and blinks and talks with its own eyelids and mouth. Its hair moves with the head; hands, single hair strands and hanging accessories are not rigged. When the face fills most of a large sprite, the avatar is built from a smaller copy so making it stays quick.

Your sprite is sent to the image connection for blink and talk pictures (and to that connection's fallback image connection if it fails, one is set, and it accepts a reference picture), and to the chat connection for a mesh avatar. The prompts come with the 2D Avatars agent. With **Expose media prompts before sending** on, you can read and change each picture's prompt before it is sent. With debug mode on, every prompt is written to the server log.

## Make your own model

You don't have to make anything to start. A character or persona with expression sprites already has a PNGTuber avatar, and [Making an avatar from a sprite](#making-an-avatar-from-a-sprite) adds blink and talk pictures or builds a mesh avatar for you. To make your own model instead, use one of these tools. Sprites show as soon as you add them, and every file is imported on the agent's page in **Agents**.

| What you want | Tool | What you get |
| --- | --- | --- |
| PNGTuber sprites | Any drawing app, then the character's **Sprites** tab | The sprites |
| PNGTuber sprites with layers and costumes | [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) | A `.save` file |
| A mesh avatar | [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) | A `.mavatar` file |
| A 3D model | [VRoid Studio](https://vroid.com/en/studio), or Blender with the [VRM Add-on for Blender](https://vrm-addon-for-blender.info/en-us/) | A `.vrm` file, and optionally a `.vrma` idle animation |

### Your own sprites

1. Draw one picture for each feeling, all the same size and with the character in the same place. Name each after its feeling: `neutral`, `happy`, `angry`, `sad`, `relaxed` and `surprised`. Names that contain a feeling word work too, such as `smile`, `cry`, `calm` or `shock`. For the optional [more feelings](#pngtuber-sprites), add pictures named after them too, such as `amusement`, `fear` or `gratitude`.
2. For a moving mouth, draw the same picture with only the mouth open and add `_talk` to its name, for example `happy_talk`. For blinking, close only the eyes and add `_blink`; with both, add `_blink_talk`. A feeling without these pictures still hops while it talks.
3. Add the pictures on the **Sprites** tab of the character or persona, under **Facial Expressions**. **Upload Folder** adds a whole folder and names each sprite after its file. See [Character Sprites](../characters/sprites.md).
4. Chats with 2D Avatars on show them right away. To change the face for a feeling or the movement, see [PNGTuber sprites](#pngtuber-sprites).

### PNGTuber Plus

1. Build the avatar from separate layers. Set the open mouth to show only while talking and the closed mouth only while quiet. Set the closed eyes to show only while blinking and the open eyes only while not blinking.
2. For each feeling, make a costume that swaps the eyes or the mouth, and name those pictures after the feeling, for example `angry eyes.png` or `happy_mouth.png`. The more specific feelings work the same way, for example `fear eyes.png`. Costume 1 is the resting face.
3. Save the avatar to get a `.save` file.
4. Open **2D Avatars** in **Agents**, choose the character or persona, then **PNGTuber sprites** and **Import PNGTuber Plus save**. Choose a face for any feeling the names did not cover.

### Mesh Avatar Studio

1. Start from a front-facing head-and-shoulders picture with a transparent background. Mesh Avatar Studio runs on your computer with Node.js, and a coding agent such as Claude Code or Codex rigs the picture. Its README walks you through it.
2. Optionally, add drawn eyes and mouths under **Drawn variants**. Marinara Engine uses its mouth shapes (`mouth_a`, `mouth_i`, `mouth_o` and `mouth_a_half`) and closed eyes (`eyes_closed_0` and `eyes_closed_1`) by themselves. Every mesh avatar has the six feelings built in, so there is nothing to name.
3. Choose **Export .mavatar**. Don't zip the project folder yourself.
4. Open **2D Avatars** in **Agents**, choose the character or persona, then **Mesh avatar** and **Import .mavatar file**.

### VRoid Studio

1. Make the character in VRoid Studio. Its faces, mouth shapes and blink are standard VRM expressions, so they are found automatically.
2. Export it as VRM. VRM 1.0 and VRM 0.0 both work. Fill in the model's details and terms when VRoid Studio asks.
3. Open **3D Avatars** in **Agents**, choose the character or persona, and select **Import VRM**.

### Blender with the VRM Add-on for Blender

1. Install the VRM Add-on for Blender from **Get Extensions** in Blender's **Preferences**. Blender before 4.2 installs the add-on's ZIP file under **Add-ons** instead.
2. Give the model a humanoid armature and assign its VRM bones. The add-on can assign them automatically.
3. Set up the expressions in the add-on's VRM panel: **Expressions** for VRM 1.0, or **VRM 0.x Blend Shape Proxy** for VRM 0.x. Each one must move a shape key or a material: an empty expression changes nothing, so the import uses it only for Neutral. Custom expressions with a clear name, such as `Smile` or `Shock`, are matched too.
   - Faces: **Happy**, **Angry**, **Sad**, **Relaxed** and **Surprised**. VRM 0.x calls the first four **Joy**, **Angry**, **Sorrow** and **Fun**, and has no surprised preset, so add a custom one named `Surprised`.
   - Mouth shapes: **Aa**, **Ih**, **Ou**, **Ee** and **Oh** (**A**, **I**, **U**, **E** and **O** in VRM 0.x).
   - Blinking: **Blink**.
4. Export with **File → Export → VRM (.vrm)**. For an idle animation, animate the armature and use **File → Export → VRM Animation (.vrma)**. The add-on exports an animation only from a model set to VRM 1.0, so choose VRM 1.0 in step 3 if you want one.
5. Open **3D Avatars** in **Agents**, choose the character or persona, and select **Import VRM**. Add the animation with **Add animation** under **Idle animation**.

### What to avoid when exporting

- **Compression.** Draco or meshopt mesh compression and KTX2 textures don't load. The VRM exports above never use them, but Blender's plain glTF export offers Draco, and model optimizers can add all three. Export again with compression turned off.
- **Plain glTF.** A plain `.glb` or `.gltf` file lacks the VRM data that names its faces and skeleton. Export a `.vrm` instead.
- **Separate files.** A model whose textures or data sit in separate files can't be used. Export one `.vrm` file.
- **PNGTuber Plus extras.** Wobble, drag and animation don't come across: each layer shows at rest, and an animated layer shows its first frame.

## Performance and devices

Each avatar type's drawing code downloads only the first time an avatar of that type shows, so chats without avatars load nothing extra.

| | Phones | Desktops |
| --- | --- | --- |
| Avatars drawn at once | 2 | 4 |
| Frames per second while talking | 30 | 30 |
| Frames per second while idle | 20, or 15 when the phone is busy | 30 |
| Sharpness (pixel ratio) | up to 1.5× | up to 2× |

A chat shows avatars in the order of its characters, then your persona, up to that limit. Avatars stop drawing completely while the tab is hidden, the window is in the background, the Appearance settings are open, or the chat is off screen or covered by a panel or editor. With **Reduce Ambient Animations & Effects** or your device's reduced-motion setting on, avatars still change faces and move their mouths but skip breathing, swaying and the waiting poses.

## Related guides

- [Agents: AI Helpers for Your Chats](agents-overview.md)
- [Downloadable Agents Reference](built-in-agents.md)
