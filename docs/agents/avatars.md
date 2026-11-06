# 2D and 3D Avatars

Two downloadable agents give characters and personas an animated avatar that reacts while a reply streams in. **2D Avatars** shows PNGTuber-style sprites or mesh avatars. **3D Avatars** shows VRM, MMD PMX, GLB and FBX models. Faces follow the reply, and mouths move with the text or with text-to-speech.

Live2D models are not supported. Live2D's licence needs a separate agreement even for free open-source apps, and its runtime cannot ship with Marinara Engine.

## Install the avatar agents

Both agents are in **Agent Organizer** for every install, under the **Roleplay** and **Game** filters. They need Marinara Engine 2.5.1 or newer. An older Engine refuses to install them. They are separate downloads, so install only the one you want. Both work for characters and personas in Roleplay and Game chats, and send no extra requests to your AI models while you chat.

1. Open **Agents → Agent Organizer** and install **2D Avatars**, **3D Avatars** or both. Neither needs a restart.
2. Set up each avatar on the agent's page (see [Set up an avatar](#set-up-an-avatar)).
3. In a Roleplay or Game chat, open **Chat Settings → Agents → Misc Agents** and add the agent.

An avatar shows in a Roleplay, Visual Novel or Game chat when agents are on and the matching agent is added. It works with or without the Expression Engine. The avatar does not hide the full-body sprite, so turn that off yourself if the avatar replaces it. Avatars stand where the full-body sprite would and share its size.

## Set up an avatar

Open **Agents**, open **2D Avatars** or **3D Avatars**, and use the **Avatars** section near the top.

1. In **Character or persona**, choose who gets the avatar. Names marked "(has an avatar)" already have one.
2. In **Avatar type**, choose the kind. 2D Avatars offers **PNGTuber sprites** and **Mesh avatar**. 3D Avatars offers **VRM model**, **MMD PMX model** and **GLB or FBX model**.
3. Set it up in that type's section below: use your sprites or import a file, choose the face for each feeling, or remove it.
4. Use **Preview** to check it. **Try a face** switches feelings and **Talk** moves the mouth. With nothing to show yet, the preview shows an example avatar.
5. Turn on **Show this avatar in chats**.

**Show this avatar in chats** turns a configured avatar on or off without deleting it. It stays off until you set up an avatar or usable sprites. A profile picture alone does not create a 2D avatar.

**Movement** has three switches for every type: **Lip sync** moves the mouth, **Blinking** blinks every few seconds, and **Idle motion** breathes and sways while waiting. If a character has more than one avatar type, **Show this one** picks the type chats use. When that type's agent is off in a chat, the chat shows another type whose agent is on. Removing a type deletes its files. Your sprites stay.

### Size and move avatars in a chat

1. Open **Chat Settings → Agents** and open **Avatars**.
2. Pick an avatar in the list and use its size slider.
3. Select **Arrange** to move avatars. Drag them with a mouse or finger, or focus one and use the arrow keys (hold <kbd>Shift</kbd> to move further).
4. Select **Done**. Avatars stay where you put them and clicks go to the chat again. **Reset** puts every avatar back.

A 3D avatar also has **Framing**: **Portrait** shows head and shoulders (the default), **Half body** shows down to the hips, and **Full body** shows the whole model. The avatar keeps its size and a taller framing shows more of the model. 2D avatars have no framing.

The layout is saved for that chat on this device. It does not sync to other devices. The Expression Engine's own **Arrange** button moves avatars too.

### Where avatar files live

Imported files are checked before they are stored. The only size limit is the server's normal upload limit. Files live in the data folder under `avatar-models/<character or persona>/<id>/`, next to an `avatar.json` with the settings. Backups and profile exports include this folder. Deleting a character or persona deletes its avatar, and so does clearing all **Characters**, **Personas** or **Media & Assets** in the Danger Zone of Settings. Character card exports never include avatars.

### Group chats

Group chats show every member with a saved, enabled avatar whose agent is on, with no fixed limit. In **Individual** mode, the responding character speaks and emotes. In **Merged (Narrator)** mode, speaker tags and named dialogue direct the matching character. With voices on, lip sync follows the character whose voice is playing.

## 2D avatars: PNGTuber sprites and mesh avatars

**2D Avatars** shows one of two kinds of avatar. **PNGTuber sprites** are flat pictures that swap faces, open their mouth and blink. **Mesh avatars** are drawings that move their head, eyes and mouth smoothly. Set both up on the agent's page after you pick a character or persona.

### PNGTuber sprites

A character or persona with expression sprites can use them as a PNGTuber avatar, with the sprites as the faces. Portrait sprites are used when there are any, and full-body sprites otherwise, so one avatar never mixes the two. Preview them, then turn on **Show this avatar in chats** or save them with **Use my sprites**.

- **Talking and blinking pictures.** Add sprites named after a face with `_talk` for the open mouth and `_blink` for closed eyes, for example `happy_talk`, `happy_blink` and `happy_blink_talk` for both. `_talking`, `_speak`, `_mouth_open`, `_blinking` and `_eyes_closed` work too. A face without them still hops while it talks.
- **Face for each feeling.** Choose which face shows for Neutral, Happy, Angry, Sad, Relaxed and Surprised. **Resting face** uses the Neutral face. Every sprite is offered, including ones added later, up to 64 faces. A PNGTuber Plus import offers only its own faces. When the Expression Engine or the Game Master picks a sprite you have, that exact face shows.
- **More feelings.** Under **Face for each feeling**, open **More feelings** to choose a face for 23 more specific feelings, grouped under the six (table below). Each uses its main feeling's face until you pick another. A sprite named after one, such as `fear`, `amusement` or a word like `scared` or `laughing`, is used for it with no setup.
- **Movement.** **Hop while talking** and **Hop height** set the bounce. **Time between blinks** is the average. Each blink comes a little sooner or later. With reduced motion on in your device, the avatar does not hop or breathe, but its face and mouth still change.
- **Sprites show as they are.** A sprite drawn on a background shows with it, and your files are never changed. For faces without a background, use [Faces from the avatar](#faces-from-the-avatar).
- **Use my sprites** saves the sprites as the faces. Choosing a face or changing movement saves too. **Update from sprites** picks up sprites you added later and keeps your chosen faces. After an import, choose **Remove** to go back to your sprites.

| More feelings, grouped under | Feelings |
| --- | --- |
| Neutral | Curiosity |
| Happy | Admiration, Amusement, Desire, Embarrassment, Excitement, Gratitude, Optimism, Pride |
| Angry | Annoyance, Disapproval, Disgust |
| Sad | Disappointment, Grief, Nervousness, Remorse |
| Relaxed | Approval, Caring, Love, Relief |
| Surprised | Confusion, Fear, Realization |

**Import PNGTuber Plus save** reads an avatar saved by [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) (a `.save` file). Each costume becomes one face, and its talking and blinking layers become the talking and blinking pictures. Costumes are matched to feelings by picture names such as `angry eyes.png`. Choose a face for any feeling the names did not cover. Some things do not come across:

- Wobble, drag, rotation and stretch are not imported. The avatar shows each layer at rest.
- Animated layers show only their first frame.
- Very old saves keep only picture paths on the author's computer. Save them again in a newer PNGTuber Plus first.
- A very large avatar is scaled down to 2048 pixels so phones can hold every picture.

Importing a save needs image processing on the server. Some Android (Termux) installs do not have it, and the import is refused there with a message.

### Mesh avatars

A mesh avatar is a `.mavatar` file. Marinara can make one from a sprite (see [Mesh avatar](#mesh-avatar)), or you can make one with [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) (see [Mesh Avatar Studio](#mesh-avatar-studio)). Choose **Import .mavatar file** to add one, or **Replace file** to swap it. With idle motion on, the avatar breathes and looks around on its own. It blinks, and its mouth follows the reply. Drawn mouth shapes in the file are used. Otherwise simple ones are drawn.

Under **Look for each feeling**, choose what each feeling shows: one of the six feelings, or **Smile**, **Shy**, **Half-closed eyes** or **Wink**.

Every file is checked on import. A damaged file, a file too detailed to play smoothly, or one that unpacks to more than the upload limit is refused with a short reason. Only the parts the avatar needs are kept, so the original illustration inside is not stored. The artwork belongs to its creator, so check its licence before you share it.

Mesh avatars need WebGL2, which current browsers have. Without it, or when the browser stops the graphics to save memory, the avatar shows your PNGTuber setup or sprites instead.

## 3D avatars: VRM models

**3D Avatars** shows VRM models, the format that VRoid Studio, the VRM add-on for Blender and UniVRM for Unity export. VRM 1.0 and 0.x files both work. With no model yet, [make one in VRoid Studio](#get-a-3d-model), a free app.

1. Open **3D Avatars** and pick the character or persona.
2. Under **VRM model**, select **Import VRM** and choose a `.vrm` file.
3. Read **The author's terms**. They come from the model file and say who may use it as an avatar, whether commercial use, changes and sexual or very violent content are allowed, and for VRM 1.0 whether you must credit the author and may share the file. Open any license link in the file too. Marinara shows the terms but does not enforce them, so follow them yourself.
4. Under **Faces and mouth shapes**, check which of the model's expressions shows each face (Neutral, Happy, Angry, Sad, Relaxed, Surprised), each mouth shape (A, I, U, E, O) and blinking. **Set by the model** means it has the standard VRM expression. **Guessed from its name** means one of its own expressions has a matching name. An empty expression changes nothing, so it is filled in only for Neutral. Pick another expression, or **None**, when a guess looks wrong.
5. Optional: under **Idle animation**, add a `.vrma` file for the model to play while waiting. Without one it breathes and sways gently.

**Replace model** keeps the idle animation, since VRM animations fit any VRM model. **Remove model** deletes both.

In a chat the model looks at you, blinks on its own when it has a blink expression, and tilts its head while it thinks or listens. Some VRM 1.0 models keep the mouth still while they show a face. While such a model talks, that face shows at partial strength so the mouth can move. With reduced motion on, faces and mouth still change, but the model stops swaying, breathing and playing its idle animation.

If it did not work, the import says why. The usual causes:

- **Compressed models.** Draco or meshopt compression, or KTX2 textures, do not load. Export again with compression off.
- **Plain 3D models.** A `.glb` or `.gltf` without VRM data has no expressions or humanoid skeleton. Import a rigged `.glb` as a **GLB or FBX model** (see [GLB and FBX avatars](#glb-and-fbx-avatars-rigged-models)), or convert it to VRM (see [Blender](#blender-with-the-vrm-add-on-for-blender)).
- **Incomplete models.** A model missing bones VRM needs, or pointing to parts not in the file or to files outside it, is refused.

Large models load more slowly, especially on phones.

## MMD avatars: PMX models and VMD motions

1. On the **3D Avatars** page, choose **MMD PMX model** under **Avatar type**.
2. Select **Import PMX or ZIP**. Choose a ZIP with one PMX model and its pictures. Keep the model's folders and filenames, including Japanese names. A model that needs no pictures can be a `.pmx` alone.
3. Under **Faces and mouth shapes**, choose the face for each feeling, mouth shape and blink. Common English and Japanese names are matched for you. Check the preview and correct guesses. A model without suitable faces can still show and move its body.
4. Optional: under **VMD motion**, add a `.vmd` made for that model. It plays while **Idle motion** is on, and your chosen faces still follow the chat. Without a VMD the model sways gently.

Missing pictures, unsafe paths and damaged files are refused before they replace your saved model. Setup lists the first 256 expression names and warns if there are more. Replacing a PMX removes its old VMD, so add a motion for the new model. Removing an MMD model deletes its pictures and motion and leaves other avatar types. Reduced motion stops the animation but keeps faces and lip sync.

Supported: PMX 2.0 and compatible PMX 2.1 models, with PNG, JPEG, BMP and TGA pictures, including `.sph` and `.spa`. Some newer PMX 2.1 features are not supported, and the import says why. PMD models, VPD poses and camera or light motion are not supported. Physics is not simulated, so hair and clothes can differ from MikuMikuDance. Models with more than 256 picture paths, very long paths, pictures needing too much memory or overly complex rigs are refused. Test your model, especially on a phone.

MMD avatars need WebGL2 and use the same pause, frame-rate and framing controls as other avatars. Models load only from your Engine. Follow the authors' licenses and terms. Importing or playing one sends nothing to an AI service.

## GLB and FBX avatars: rigged models

1. On the **3D Avatars** page, choose **GLB or FBX model** under **Avatar type**.
2. Select **Import GLB or FBX** and choose one `.glb` or `.fbx` file of a rigged character.

A plain model has no VRM data naming its bones, so the import matches bones by name. Rigs from Mixamo, Unity, VRoid, Unreal, Blender, 3ds Max, Maya HumanIK, Character Creator and DAZ use names it recognises. The section shows how many body bones matched. The model needs at least the hips, spine, head and both upper and lower arms. Otherwise the import refuses it and names the missing bones. Rename them in your 3D app or rig the model with Mixamo. Models in an A-pose, facing away or made in centimetres are straightened, turned and sized for you.

Faces come from the model's blend shapes (shape keys or morph targets). Under **Faces and mouth shapes**, common names are matched: VRoid, VRChat and Oculus mouth shapes (`aa`, `A`, `viseme_aa`, `Fcl_MTH_A`), an open jaw (`mouthOpen`, `jawOpen`), feelings (`happy`, `Joy`, `mouthSmile`) and blinking (`blink`, or a left and right pair such as ARKit's `eyeBlinkLeft` and `eyeBlinkRight`). Check the preview and correct guesses. A model without blend shapes still moves its body and nods as it talks.

Supported: binary glTF (`.glb`) with everything embedded, and FBX 2014 (7.4) or newer, binary or ASCII. Export FBX with **Embed Media** (or **Embed Textures**) on, or the model shows without its pictures. Draco, meshopt and KTX2 compression do not load, and a separate `.gltf` with its own files cannot be used. A VRM saved as `.glb` belongs under **VRM model**. The model's own animations, physics and pose editing are not supported. Follow the author's terms. Importing or playing one sends nothing to an AI service.

## Get a 3D model

If the character or persona has no VRM model, make one in VRoid Studio. It is a free app from pixiv for Windows, macOS and iPad. Models you make in it are yours to use, but a few built-in items and any textures you buy have their own terms. Its models include the six faces, five mouth shapes and blinking, so faces and lip sync work at once.

On the **3D Avatars** page, pick the character or persona. Under **Get a 3D model**, **Read the guide** opens this section and **Copy prompt** copies a description of their look.

1. Download and install [VRoid Studio](https://vroid.com/en/studio).
2. Optional: select **Copy prompt**, paste it into an image generator and use the picture as a reference. VRoid Studio has no box for a prompt.
3. In VRoid Studio, create a new model. Pick the hair, face, eyes, body and outfit closest to the character, then change shapes and colours to match.
4. Export the model as VRM (1.0 or 0.0). Fill in the model's details and terms when asked.
5. Open **3D Avatars** in **Agents**, pick the character or persona, and select **Import VRM** under **VRM model**. A VRoid Studio model already has every face, mouth shape and blink filled in.

The prompt describes the character for tools that make a picture or 3D model from text: a full-body anime-style character in a T-pose, seen from the front on a plain background. The look comes from the **Appearance** field, from the **Image Appearance Override** tags when those are on, or from the description when there is no appearance. It holds the name and look only, nothing else from the card and nothing from your chats. It is in English. Change it as you like.

A VRM from another tool may have fewer or no expressions. **Faces and mouth shapes** shows which it has. Some websites say they make a VRM with face expressions from a picture, but none could be confirmed in October 2026, so this guide does not recommend one. A model made earlier with the removed Tripo generator still loads and moves its body, but its face does not move.

## How faces and mouths follow the reply

Avatars react on their own. Nothing to set up here.

**Faces in Roleplay.** While a reply streams in, Marinara reads each finished sentence and guesses its mood. To stop flicker:

- The face changes only when the new mood is clearly stronger than the current one.
- A face stays for at least two seconds.
- The face returns to calm after two calm sentences in a row, and about four seconds after the reply ends.

With streaming off, each sentence still gets its own mood, and faces change in order over the reply's speaking time. When text to speech reads the reply, faces follow the voice instead (see below).

A PNGTuber avatar with faces for [more feelings](#pngtuber-sprites) can show a more specific feeling, such as Amusement while happy. It follows the same rules, and a feeling without its own face shows its main feeling's face. Expression Engine and Game Master picks work the same way: with no face named `scared`, the avatar shows Fear. 3D and mesh avatars show the six feelings only.

**How the mood is read.** Your chat model is not asked, and your chat text is never sent to an outside service.

- A built-in word list answers at once, everywhere, and knows common mood words in several languages.
- On computers that can run it, a small emotion model, the mood reader, reads sentences instead. It understands 36 languages. It downloads once, about 300 MB, the first time you open a Roleplay chat with 2D Avatars or 3D Avatars on. Each avatar agent's page in **Agents** shows progress. A failed download retries about 10 minutes later. The word list answers until it is ready, and afterward it works offline. It uses about 1 GB of memory while in use and unloads after 10 idle minutes. Lite installs, Android and computers with less than 3 GB of memory keep the word list.

**Faces in Game Mode.** Each line the Game Master shows comes with an expression, and the speaking character's avatar takes it, even when a voice reads the line. Inner thoughts change the face but not the mouth.

**Expression Engine.** When it is on, its pick after the reply is the final face for that reply. A pick that arrives after you send your next message stays with its own reply. With text to speech, the pick shows when the voice finishes.

**Mouths.** From text, the mouth moves only for dialogue (words in quotes, `[Name]:` lines and speaker tags), not narration, at about the pace of speech. If text appears faster than anyone could say it, the mouth speeds up and then skips ahead. With streaming off, a reply's dialogue is spoken within eight seconds. When text-to-speech plays a line, the voice moves the mouth instead.

**Body.** An avatar thinks from the moment you send until its first words, talks while its mouth moves, listens while someone else talks or you type, and rests otherwise.

**Group chats.** In an Individual group, the replying member speaks, including when you swipe one member's message. In a Merged group, a speaker tag directs that character's dialogue and face, even in a paragraph that names someone else. Named dialogue also follows its speaker. Untagged prose belongs to the first character it names, or the one before it. While a paragraph that names nobody is still appearing, its dialogue waits until a name or the paragraph's end shows who speaks. With streaming off in an Individual group, only the last member's reply moves an avatar for now.

## Lip sync with text-to-speech

When text to speech reads a Roleplay reply, the speaking character's avatar moves its mouth with the voice. The mouth opens wider on loud sounds, closes in pauses, rounds on sounds like "oo" and shows teeth on sounds like "s". To turn it on, set up text to speech as described in [Text to Speech (TTS) Setup](../media/tts-setup.md). It then works with **Auto-play** and the **Speak** button on a message, including the visual novel layout.

When the reply is read aloud with **Auto-play** on, the voice usually starts a few seconds after the text appears, so the avatar waits for it.

- While the text appears, the avatar blinks and moves as usual, but its mouth stays shut and its face does not change yet.
- When the voice starts, the mouth follows the voice, and the face changes as the voice reaches each sentence, unless the Expression Engine already picked the face.
- The face relaxes about four seconds after the voice ends. Short pauses between lines do not relax it.
- If the voice fails or does not start within a few seconds, the avatar plays the reply's faces and mouth from the text once. If it fails later, it shows the last mood and relaxes.
- After 30 seconds with no voice, the avatar stops waiting. A voice that starts later still moves the mouth.

Details:

- **Who speaks.** The mouth that moves belongs to the character whose voice reads the line, the one the **Voice option** picks a voice for. Each character's mouth moves only during their own lines. Narrator-voice lines and speakers who are not characters in the chat move no mouth. With **Only read dialogues** off, a character's own narration is read in their voice and moves their mouth.
- **Pause, stop and switching chats.** Pausing or stopping the voice stops the mouth. If you switch chats while a reply is read, avatars there stay still. Return while the voice still plays and the avatar picks it up.
- **Volume.** **Line volume** changes loudness, not how wide the mouth opens.
- **Personas.** A persona's mouth does not move for your own messages.
- **Game Mode.** With text to speech and **Auto-play** on, mouths wait for their character's voice and follow it. Lines without a voice keep their text animation. Narrator and player voices move no character's mouth. Inner thoughts stay unspoken.

Lip sync does not change how the voice plays. Marinara reads a separate copy of each clip to time the mouth, so playback works as before, including in Safari and on iPhone and iPad. If the first clip starts before timing is ready, its text moves the mouth until the voice timing takes over. If your browser cannot read a clip, the voice still plays and only the mouth stops following it.

## Making an avatar from a sprite

On the **2D Avatars** page, choose a character or persona, then use **Make an avatar from a sprite**. It works from the sprites they already have. Your avatar stays the same until you save a result, so you can try as often as you like.

### Faces from the avatar

**Make faces from the avatar** makes faces without a background, also for a character or persona with no sprites yet. It needs an avatar and an image generation account. It opens the same sprite generation as the character and persona editors, with the avatar as the reference.

1. Choose **All faces** (all 29 feelings), **Main faces** (the six) or pick faces yourself. Each extra feeling sits in its main face's row until it has its own face.
2. Faces are drawn in batches, main faces first. Older GPT Image models draw one face per picture. A picture that fails is tried once more. If it fails again, the run stops with **Retry picture**. **Cancel** keeps the faces already made.
3. With **Expose media prompts before sending** on, you review every prompt at once before the first is sent. Every face is drawn with open eyes and a closed mouth, so blink and talk pictures have something to close and open.
4. Marinara draws the faces on a plain color, removes it, and saves them as the character's or persona's sprites. A new sprite replaces one with the same name, so rename it in the last step to keep the old one.

When the avatar is already saved, each new face becomes the face of the feeling it was drawn for, even if renamed. Other sprites stay. A face made again starts without blink and talk pictures, because the old ones would not match. Make new ones under [Blink and talk pictures](#blink-and-talk-pictures). A PNGTuber Plus import keeps its own faces.

### Blink and talk pictures

Each face the avatar shows for a feeling is one row, with its **Eyes closed** and **Mouth open** pictures next to the **Face**. These are pictures you saved, `_blink` and `_talk` sprites you added, or new ones. With portrait sprites, only those are used, because an avatar never mixes portrait and full-body faces. A face that is not one of your sprites, such as from a PNGTuber Plus import, shows its pictures but cannot get new ones.

1. Check **Image model** (your default image account is picked for you).
2. Click **Make** for one missing picture, or the **Make N pictures** button for all. Each picture is one image request. With **Expose media prompts before sending** on (in Settings), you see and edit each prompt first.
3. New pictures appear one at a time. Select **Keep** on good ones and **Try again** on the others. **Try again** also redraws a picture you already have. The picture being redrawn stays dimmed with a spinner. **Cancel** stops it, on the server too. If **Try again** fails, the old picture stays. To redo a kept picture, select **Kept** to let it go first.
4. Select **Save kept pictures**. They become the avatar's blink and talk pictures next to a copy of the sprite they were drawn from, so they always line up. If you replace a sprite before saving, make its pictures again.

With an image account that accepts a reference picture, your sprite is the only reference, at the size and shape the model accepts, with a prompt that asks to change only the eyes or mouth. Models move, scale or pad the picture they return, so it is lined up with your sprite first. Only the eyes (for a blink) or the mouth (for talking) are taken from it. Everything else stays your sprite's own pixels, so the avatar does not jump. If the eyes did not close, the mouth did not open, or the picture was too far off to line up, the picture fails with a message. Try again.

Some accounts cannot edit pictures, such as Pollinations, Together AI, Horde, DALL-E, or a ComfyUI workflow with no reference slot. With one of them, **Make** draws a new face with its blink and talk pictures in one picture, so the three match, as [Faces from the avatar](#faces-from-the-avatar) does. The row shows **New face**. **Keep** keeps the face and both pictures together, and saving makes the new face that feeling's face. Your sprite is not changed. This needs an appearance or description on the character or persona.

### Mesh avatar

1. Pick a **Sprite to use**. The full-body neutral sprite is picked for you when there is one. A front-facing full-body or bust sprite works best.
2. Choose the **Chat provider that can see pictures**. **The agent's provider** uses the one set on the 2D Avatars page, then your default agent account. Its model must accept pictures.
3. Select **Make mesh avatar**. The chat model finds the face, and Marinara builds the avatar from your sprite as it is. **Cancel** stops it.
4. Check the preview: outlines should sit on the eyes, brows and mouth. Select **Save as mesh avatar**, or **Discard** and try another sprite or model.

A generated mesh avatar moves its head, eyes, brows and mouth, and blinks and talks with its own eyelids and mouth. Hair moves with the head. Hands, single hair strands and hanging accessories are not rigged. Small sprites are built from a bigger copy so the mouth fits the face. When the face fills most of a large sprite, a smaller copy is used to stay quick.

Your sprite goes to the image account for blink and talk pictures (and to its fallback image account if one is set and accepts a reference), and to the chat model for a mesh avatar. An account that cannot edit pictures gets only the prompt, which includes the appearance. The prompts come with the 2D Avatars agent. With **Expose media prompts before sending** on you can read and change each prompt. With debug mode on, every prompt is written to the server log.

## Make your own model

A character or persona can use its expression sprites as a PNGTuber avatar with no drawing. [Making an avatar from a sprite](#making-an-avatar-from-a-sprite) adds blink and talk pictures or builds a mesh avatar for you. To make your own model, use one of these tools. Import every file on the agent's page in **Agents**, and turn on **Show this avatar in chats**.

| What you want | Tool | What you get |
| --- | --- | --- |
| PNGTuber sprites | Any drawing app, then the character's **Sprites** tab | The sprites |
| PNGTuber sprites with layers and costumes | [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) | A `.save` file |
| A mesh avatar | [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) | A `.mavatar` file |
| A 3D model | [VRoid Studio](https://vroid.com/en/studio), or Blender with the [VRM Add-on for Blender](https://vrm-addon-for-blender.info/en-us/) | A `.vrm` file, optionally a `.vrma` idle animation |

### Your own sprites

1. Draw one picture per feeling, all the same size, with the character in the same place. Name each after its feeling: `neutral`, `happy`, `angry`, `sad`, `relaxed`, `surprised`. Names containing a feeling word work too, such as `smile`, `cry`, `calm` or `shock`. For the optional [more feelings](#pngtuber-sprites), name pictures such as `amusement`, `fear` or `gratitude`.
2. For a moving mouth, draw the same picture with the mouth open and add `_talk`, for example `happy_talk`. For blinking, close the eyes and add `_blink`. With both, add `_blink_talk`.
3. Add the pictures on the **Sprites** tab, under **Facial Expressions**. Each file name becomes its sprite's name. See [Character Sprites](../characters/sprites.md#upload-your-own-sprites).
4. Open **2D Avatars** in **Agents**, choose the character or persona, and turn on **Show this avatar in chats**.

### PNGTuber Plus

1. Build the avatar from separate layers. Show the open mouth only while talking and the closed mouth only while quiet. Show closed eyes only while blinking and open eyes only while not.
2. For each feeling, make a costume that swaps the eyes or mouth, and name those pictures after the feeling, for example `angry eyes.png` or `happy_mouth.png`. Specific feelings work the same, such as `fear eyes.png`. Costume 1 is the resting face.
3. Save the avatar to get a `.save` file.
4. Open **2D Avatars** in **Agents**, choose the character or persona, then **PNGTuber sprites** and **Import PNGTuber Plus save**. Choose a face for any feeling the names did not cover.

### Mesh Avatar Studio

1. Start from a front-facing head-and-shoulders picture with a transparent background. Mesh Avatar Studio runs on your computer with Node.js, and a coding agent such as Claude Code or Codex rigs the picture. Its README walks you through it.
2. Optional: add drawn eyes and mouths under **Drawn variants**. Marinara uses the mouth shapes `mouth_a`, `mouth_i`, `mouth_o` and `mouth_a_half`, and the closed eyes `eyes_closed_0` and `eyes_closed_1`. Every mesh avatar has the six feelings built in, so nothing needs naming.
3. Choose **Export .mavatar**. Do not zip the project folder yourself.
4. Open **2D Avatars** in **Agents**, choose the character or persona, then **Mesh avatar** and **Import .mavatar file**.

### VRoid Studio

1. Make the character in VRoid Studio. Its faces, mouth shapes and blink are standard VRM expressions and are found automatically.
2. Export as VRM (1.0 or 0.0). Fill in the model's details and terms when asked.
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

- **Compression.** Draco or meshopt compression and KTX2 textures do not load. The VRM exports above never use them, but Blender's plain glTF export offers Draco and model optimizers can add all three. Export again with compression off.
- **Plain glTF.** A plain `.glb` lacks the VRM data that names faces and skeleton. Import it as a **GLB or FBX model**, or export a `.vrm`.
- **Separate files.** A model whose textures or data sit in separate files cannot be used. Export one `.vrm` file.
- **PNGTuber Plus extras.** Wobble, drag and animation do not come across. Each layer shows at rest, and an animated layer shows its first frame.

## Performance and devices

Each avatar type's drawing code downloads only the first time an avatar of that type shows, so chats without avatars load nothing extra.

| | Phones | Desktops |
| --- | --- | --- |
| Avatars drawn at once | No fixed limit | No fixed limit |
| Frames per second while talking | 30 | 30 |
| Frames per second while idle | 20, or 15 when the phone is busy | 30 |
| Sharpness (pixel ratio) | up to 1.5× | up to 2× |

A chat shows every configured, enabled avatar in the order of its characters, then your persona. Size and arrange the cast to suit your screen. Avatars stop drawing while the tab is hidden, the window is in the background, the Appearance settings are open, or the chat is off screen or covered by a panel or editor. With **Reduce Ambient Animations & Effects** or your device's reduced-motion setting on, avatars still change faces and move mouths but skip breathing, swaying and waiting poses.

## Related guides

- [Agents: AI Helpers for Your Chats](agents-overview.md)
- [Downloadable Agents Reference](built-in-agents.md)
