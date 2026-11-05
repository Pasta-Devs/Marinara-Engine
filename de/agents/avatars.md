# 2D- und 3D-Avatare

Zwei herunterladbare Agenten geben Charakteren und Personas einen animierten Avatar, der reagiert, während eine Antwort eintrifft. **2D Avatars** (2D-Avatare) zeigt Sprites im PNGTuber-Stil oder Mesh-Avatare. **3D Avatars** (3D-Avatare) zeigt VRM-, MMD-PMX-, GLB- und FBX-Modelle. Die Gesichter folgen der Antwort, und die Münder bewegen sich mit dem Text oder mit der Sprachausgabe (Text to Speech).

Live2D-Modelle werden nicht unterstützt. Die Lizenz von Live2D verlangt selbst für kostenlose Open-Source-Apps eine eigene Vereinbarung, und die Live2D-Laufzeitumgebung kann nicht mit Marinara Engine ausgeliefert werden.

## Die Avatar-Agenten installieren

Beide Agenten stehen bei jeder Installation unter **Agent Organizer** (Agentenverwaltung) in den Filtern **Roleplay** und **Game** bereit. Sie brauchen Marinara Engine 2.5.1 oder neuer. Eine ältere Engine verweigert ihre Installation. Es sind getrennte Downloads, installiere also nur den, den du willst. Beide funktionieren für Charaktere und Personas in Roleplay- und Game-Chats und schicken keine zusätzlichen Anfragen an deine KI-Modelle, während du chattest.

1. Öffne **Agents → Agent Organizer** (Agenten → Agentenverwaltung) und installiere **2D Avatars**, **3D Avatars** oder beide. Keiner der beiden braucht einen Neustart.
2. Richte jeden Avatar auf der Seite des Agenten ein (siehe [Einen Avatar einrichten](#set-up-an-avatar)).
3. Öffne in einem Roleplay- oder Game-Chat **Chat Settings → Agents → Misc Agents** (Chat-Einstellungen → Agenten → sonstige Agenten) und füge den Agenten hinzu.

Ein Avatar erscheint in einem Roleplay-, Visual-Novel- oder Game-Chat, wenn die Agenten eingeschaltet sind und der passende Agent hinzugefügt ist. Er funktioniert mit und ohne Expression Engine. Der Avatar blendet das Ganzkörper-Sprite nicht aus. Schalte es also selbst aus, wenn der Avatar es ersetzt. Avatare stehen dort, wo das Ganzkörper-Sprite stehen würde, und haben dieselbe Größe.

<a id="set-up-an-avatar"></a>

## Einen Avatar einrichten

Öffne **Agents**, dann **2D Avatars** oder **3D Avatars**, und nutze den Abschnitt **Avatars** (Avatare) weit oben.

1. Wähle unter **Character or persona** (Charakter oder Persona), wer den Avatar bekommt. Namen mit dem Zusatz „(has an avatar)“ haben bereits einen.
2. Wähle unter **Avatar type** (Avatar-Typ) die Art. 2D Avatars bietet **PNGTuber sprites** und **Mesh avatar**. 3D Avatars bietet **VRM model** (VRM-Modell), **MMD PMX model** (MMD-PMX-Modell) und **GLB or FBX model** (GLB- oder FBX-Modell).
3. Richte ihn im Abschnitt dieses Typs weiter unten ein: Nutze deine Sprites oder importiere eine Datei, wähle das Gesicht für jedes Gefühl oder entferne ihn.
4. Prüf ihn unter **Preview** (Vorschau). **Try a face** (Gesicht ausprobieren) wechselt zwischen den Gefühlen, und **Talk** (Sprechen) bewegt den Mund. Gibt es noch nichts zu zeigen, zeigt die Vorschau einen Beispiel-Avatar.
5. Schalte **Show this avatar in chats** (diesen Avatar in Chats zeigen) ein.

**Show this avatar in chats** schaltet einen eingerichteten Avatar an oder aus, ohne ihn zu löschen. Der Schalter bleibt aus, bis du einen Avatar oder brauchbare Sprites einrichtest. Ein Profilbild allein erzeugt keinen 2D-Avatar.

**Movement** (Bewegung) hat drei Schalter, die für jeden Typ gelten: **Lip sync** (Lippensynchronisation) bewegt den Mund, **Blinking** (Blinzeln) lässt den Avatar alle paar Sekunden blinzeln, und **Idle motion** (Bewegung im Leerlauf) lässt ihn beim Warten atmen und leicht schwanken. Hat ein Charakter mehr als einen Avatar-Typ, legt **Show this one** (diesen zeigen) fest, welchen Typ die Chats verwenden. Ist der Agent dieses Typs in einem Chat aus, zeigt der Chat einen anderen Typ, dessen Agent an ist. Entfernst du einen Typ, werden seine Dateien gelöscht. Deine Sprites bleiben erhalten.

### Größe und Position der Avatare in einem Chat ändern

1. Öffne **Chat Settings → Agents** und dann **Avatars**.
2. Wähle in der Liste einen Avatar und nutze seinen Größenregler.
3. Wähle **Arrange** (Anordnen), um Avatare zu verschieben. Zieh sie mit der Maus oder dem Finger, oder fokussiere einen und nutze die Pfeiltasten (halt <kbd>Shift</kbd> gedrückt, um ihn weiter zu verschieben).
4. Wähle **Done** (Fertig). Die Avatare bleiben dort, wo du sie hingestellt hast, und Klicks gehen wieder an den Chat. **Reset** (Zurücksetzen) stellt jeden Avatar an seinen Platz zurück.

Ein 3D-Avatar hat außerdem **Framing** (Bildausschnitt): **Portrait** (Porträt) zeigt Kopf und Schultern (der Standard), **Half body** (Halbkörper) zeigt den Körper bis zu den Hüften, und **Full body** (Ganzkörper) zeigt das ganze Modell. Der Avatar behält seine Größe, und ein größerer Ausschnitt zeigt mehr vom Modell. 2D-Avatare haben keinen Bildausschnitt.

Die Anordnung wird für diesen Chat auf diesem Gerät gespeichert. Mit anderen Geräten wird sie nicht abgeglichen. Auch die eigene Schaltfläche **Arrange** der Expression Engine verschiebt Avatare.

### Wo Avatar-Dateien liegen

Importierte Dateien werden geprüft, bevor sie gespeichert werden. Das einzige Größenlimit ist das normale Upload-Limit des Servers. Die Dateien liegen im Datenordner unter `avatar-models/<character or persona>/<id>/`, neben einer `avatar.json` mit den Einstellungen. Backups und Profil-Exporte enthalten diesen Ordner. Löschst du einen Charakter oder eine Persona, wird auch der Avatar gelöscht, und dasselbe gilt, wenn du in der Danger Zone der Einstellungen alle **Characters** (Charaktere), **Personas** oder **Media & Assets** leerst. Charakterkarten-Exporte enthalten nie Avatare.

### Gruppenchats

Gruppenchats zeigen jedes Mitglied mit einem gespeicherten, eingeschalteten Avatar, dessen Agent an ist, ohne festes Limit. Im Modus **Individual** spricht und reagiert der antwortende Charakter. Im Modus **Merged (Narrator)** steuern Sprecher-Tags und namentlich zugeordnete Dialoge den passenden Charakter. Sind Stimmen an, folgt die Lippensynchronisation dem Charakter, dessen Stimme gerade spielt.

<a id="2d-avatars-pngtuber-sprites-and-mesh-avatars"></a>

## 2D-Avatare: PNGTuber-Sprites und Mesh-Avatare

**2D Avatars** zeigt eine von zwei Arten von Avataren. **PNGTuber-Sprites** sind flache Bilder, die das Gesicht wechseln, den Mund öffnen und blinzeln. **Mesh-Avatare** sind Zeichnungen, die Kopf, Augen und Mund fließend bewegen. Beide richtest du auf der Seite des Agenten ein, nachdem du einen Charakter oder eine Persona gewählt hast.

### PNGTuber-Sprites

Ein Charakter oder eine Persona mit Ausdrucks-Sprites kann sie als PNGTuber-Avatar nutzen; die Sprites sind dann die Gesichter. Gibt es Porträt-Sprites, werden diese verwendet, sonst die Ganzkörper-Sprites. Ein Avatar mischt die beiden also nie. Sieh sie dir in der Vorschau an und schalte dann **Show this avatar in chats** ein oder speichere sie mit **Use my sprites** (meine Sprites verwenden).

- **Bilder zum Sprechen und Blinzeln**: Füge Sprites hinzu, die nach einem Gesicht benannt sind, mit `_talk` für den offenen Mund und `_blink` für geschlossene Augen, zum Beispiel `happy_talk`, `happy_blink` und `happy_blink_talk` für beides. `_talking`, `_speak`, `_mouth_open`, `_blinking` und `_eyes_closed` funktionieren auch. Ein Gesicht ohne diese Bilder hüpft trotzdem, während es spricht.
- **Face for each feeling** (Gesicht für jedes Gefühl): Wähle, welches Gesicht bei Neutral, Happy, Angry, Sad, Relaxed und Surprised erscheint. **Resting face** (Ruhegesicht) verwendet das Gesicht für Neutral. Angeboten wird jedes Sprite, auch später hinzugefügte, bis zu 64 Gesichter. Ein Import aus PNGTuber Plus bietet nur seine eigenen Gesichter an. Wählt die Expression Engine oder der Game Master ein Sprite, das du hast, erscheint genau dieses Gesicht.
- **More feelings** (weitere Gefühle): Öffne unter **Face for each feeling** den Bereich **More feelings**, um ein Gesicht für 23 spezifischere Gefühle zu wählen, gruppiert nach den sechs (Tabelle unten). Jedes davon nutzt das Gesicht seines Hauptgefühls, bis du ein anderes wählst. Ein Sprite, das nach einem davon benannt ist, etwa `fear`, `amusement` oder ein Wort wie `scared` oder `laughing`, wird ohne jede Einrichtung dafür verwendet.
- **Movement**: **Hop while talking** (beim Sprechen hüpfen) und **Hop height** (Hüpfhöhe) steuern das Hüpfen. **Time between blinks** (Zeit zwischen dem Blinzeln) ist der Durchschnitt; jedes Blinzeln kommt etwas früher oder später. Ist auf deinem Gerät reduzierte Bewegung eingeschaltet, hüpft und atmet der Avatar nicht, aber Gesicht und Mund ändern sich weiterhin.
- **Sprites erscheinen so, wie sie sind**: Ein Sprite, das auf einen Hintergrund gezeichnet ist, erscheint mit diesem Hintergrund, und deine Dateien werden nie verändert. Für Gesichter ohne Hintergrund nutze [Gesichter aus dem Avatar](#faces-from-the-avatar).
- **Use my sprites** speichert die Sprites als Gesichter. Auch wenn du ein Gesicht wählst oder die Bewegung änderst, wird gespeichert. **Update from sprites** (aus Sprites aktualisieren) übernimmt Sprites, die du später hinzugefügt hast, und behält die Gesichter, die du gewählt hast. Wähle nach einem Import **Remove** (Entfernen), um zu deinen Sprites zurückzukehren.

| Weitere Gefühle, gruppiert unter | Gefühle |
| --- | --- |
| Neutral | Curiosity |
| Happy | Admiration, Amusement, Desire, Embarrassment, Excitement, Gratitude, Optimism, Pride |
| Angry | Annoyance, Disapproval, Disgust |
| Sad | Disappointment, Grief, Nervousness, Remorse |
| Relaxed | Approval, Caring, Love, Relief |
| Surprised | Confusion, Fear, Realization |

**Import PNGTuber Plus save** (PNGTuber-Plus-Speicherstand importieren) liest einen Avatar, der mit [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) gespeichert wurde (eine `.save`-Datei). Jedes Kostüm wird zu einem Gesicht, und seine Ebenen fürs Sprechen und Blinzeln werden zu den Bildern zum Sprechen und Blinzeln. Kostüme werden den Gefühlen über Bildnamen wie `angry eyes.png` zugeordnet. Wähle ein Gesicht für jedes Gefühl, das die Namen nicht abdecken. Manches wird nicht übernommen:

- Wackeln, Nachziehen, Drehung und Dehnung werden nicht importiert. Der Avatar zeigt jede Ebene in Ruhestellung.
- Animierte Ebenen zeigen nur ihr erstes Einzelbild.
- Sehr alte Speicherstände enthalten nur die Pfade ihrer Bilder auf dem Rechner des Urhebers. Speichere sie zuerst mit einer neueren Version von PNGTuber Plus erneut.
- Ein sehr großer Avatar wird auf 2.048 Pixel verkleinert, damit Handys jedes Bild im Arbeitsspeicher halten können.

Für den Import eines Speicherstands braucht der Server Bildverarbeitung. Manche Android-Installationen (Termux) haben sie nicht, und dort wird der Import mit einer Meldung abgelehnt.

### Mesh-Avatare

Ein Mesh-Avatar ist eine `.mavatar`-Datei. Marinara kann einen aus einem Sprite erstellen (siehe [Mesh-Avatar](#mesh-avatar)), oder du erstellst einen mit [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) (siehe [Mesh Avatar Studio](#mesh-avatar-studio)). Mit **Import .mavatar file** (.mavatar-Datei importieren) fügst du einen hinzu, mit **Replace file** (Datei ersetzen) tauschst du ihn aus. Ist die Bewegung im Leerlauf eingeschaltet, atmet der Avatar und schaut sich von selbst um. Er blinzelt, und sein Mund folgt der Antwort. Enthält die Datei gezeichnete Mundformen, werden diese verwendet. Sonst werden einfache Mundformen gezeichnet.

Unter **Look for each feeling** (Aussehen für jedes Gefühl) wählst du, was jedes Gefühl zeigt: eines der sechs Gefühle oder **Smile** (Lächeln), **Shy** (schüchtern), **Half-closed eyes** (halb geschlossene Augen) oder **Wink** (Zwinkern).

Jede Datei wird beim Import geprüft. Eine beschädigte Datei, eine Datei, die zu detailliert ist, um flüssig zu laufen, oder eine, die entpackt größer als das Upload-Limit ist, wird mit einer kurzen Begründung abgelehnt. Nur die Teile, die der Avatar braucht, werden behalten; die Originalillustration in der Datei wird also nicht gespeichert. Das Artwork gehört seinem Urheber, prüfe also seine Lizenz, bevor du es weitergibst.

Mesh-Avatare brauchen WebGL2, das aktuelle Browser mitbringen. Fehlt es oder stoppt der Browser die Grafik, um Arbeitsspeicher zu sparen, zeigt der Avatar stattdessen deine PNGTuber-Einrichtung oder deine Sprites.

<a id="3d-avatars-vrm-models"></a>

## 3D-Avatare: VRM-Modelle

**3D Avatars** zeigt VRM-Modelle, das Format, das VRoid Studio, das VRM Add-on for Blender und UniVRM für Unity exportieren. Dateien mit VRM 1.0 und VRM 0.x funktionieren beide. Hast du noch kein Modell, [erstelle eines in VRoid Studio](#get-a-3d-model), einer kostenlosen App.

1. Öffne **3D Avatars** und wähle den Charakter oder die Persona.
2. Wähle unter **VRM model** die Schaltfläche **Import VRM** (VRM importieren) und dann eine `.vrm`-Datei.
3. Lies **The author's terms** (die Bedingungen des Urhebers). Sie stammen aus der Modelldatei und legen fest, wer das Modell als Avatar nutzen darf, ob kommerzielle Nutzung, Änderungen sowie sexuelle oder sehr gewalttätige Inhalte erlaubt sind und bei VRM 1.0, ob du den Urheber nennen musst und die Datei weitergeben darfst. Öffne auch jeden Lizenzlink in der Datei. Marinara zeigt die Bedingungen an, setzt sie aber nicht durch. Halte dich also selbst daran.
4. Prüf unter **Faces and mouth shapes** (Gesichter und Mundformen), welcher Ausdruck des Modells jedes Gesicht (Neutral, Happy, Angry, Sad, Relaxed, Surprised), jede Mundform (A, I, U, E, O) und das Blinzeln zeigt. **Set by the model** bedeutet, dass das Modell den Standard-VRM-Ausdruck hat. **Guessed from its name** bedeutet, dass einer seiner eigenen Ausdrücke einen passenden Namen hat. Ein leerer Ausdruck verändert nichts, deshalb wird er nur für Neutral eingetragen. Wähl einen anderen Ausdruck oder **None** (keiner), wenn eine Vermutung falsch aussieht.
5. Optional: Füge unter **Idle animation** (Animation im Leerlauf) eine `.vrma`-Datei hinzu, die das Modell abspielt, während es wartet. Ohne sie atmet es und schwankt leicht.

**Replace model** (Modell ersetzen) behält die Idle-Animation, denn VRM-Animationen passen zu jedem VRM-Modell. **Remove model** (Modell entfernen) löscht beides.

In einem Chat schaut dich das Modell an, blinzelt von selbst, wenn es einen Blinzel-Ausdruck hat, und neigt den Kopf, während es nachdenkt oder zuhört. Manche VRM-1.0-Modelle halten den Mund still, während sie ein Gesicht zeigen. Spricht ein solches Modell, erscheint dieses Gesicht nur teilweise, damit sich der Mund bewegen kann. Bei reduzierter Bewegung ändern sich Gesicht und Mund weiterhin, aber das Modell hört auf zu schwanken, zu atmen und seine Idle-Animation abzuspielen.

Hat es nicht funktioniert, nennt der Import den Grund. Die üblichen Ursachen:

- **Komprimierte Modelle**: Draco- oder meshopt-Komprimierung und KTX2-Texturen laden nicht. Exportiere das Modell erneut mit ausgeschalteter Komprimierung.
- **Einfache 3D-Modelle**: Ein `.glb` oder `.gltf` ohne VRM-Daten hat keine Gesichtsausdrücke und kein humanoides Skelett. Importiere ein geriggtes `.glb` als **GLB or FBX model** (siehe [GLB- und FBX-Avatare](#glb-and-fbx-avatars-rigged-models)) oder wandle es in VRM um (siehe [Blender](#blender-with-the-vrm-add-on-for-blender)).
- **Unvollständige Modelle**: Ein Modell wird abgelehnt, wenn seinem Skelett Knochen fehlen, die VRM braucht, oder wenn es auf Teile verweist, die nicht in der Datei sind, oder auf Dateien außerhalb von ihr.

Große Modelle laden langsamer, besonders auf Handys.

<a id="mmd-avatars-pmx-models-and-vmd-motions"></a>

## MMD-Avatare: PMX-Modelle und VMD-Animationen

1. Wähle auf der Seite **3D Avatars** unter **Avatar type** die Option **MMD PMX model**.
2. Wähle **Import PMX or ZIP** (PMX oder ZIP importieren). Wähle eine ZIP-Datei mit einem PMX-Modell und seinen Bildern. Behalte die Ordner und Dateinamen des Modells bei, auch japanische Namen. Ein Modell, das keine Bilder braucht, kann auch eine einzelne `.pmx` sein.
3. Wähle unter **Faces and mouth shapes** das Gesicht für jedes Gefühl, jede Mundform und das Blinzeln. Übliche englische und japanische Namen werden automatisch zugeordnet. Prüf die Vorschau und korrigiere falsche Vermutungen. Ein Modell ohne passende Gesichter kann trotzdem angezeigt werden und seinen Körper bewegen.
4. Optional: Füge unter **VMD motion** (VMD-Animation) eine `.vmd` hinzu, die für dieses Modell gemacht wurde. Sie wird abgespielt, während **Idle motion** an ist, und die gewählten Gesichter folgen weiter dem Chat. Ohne VMD schwankt das Modell leicht.

Fehlende Bilder, unsichere Pfade und beschädigte Dateien werden abgewiesen, bevor sie dein gespeichertes Modell ersetzen. Die Einrichtung zeigt die ersten 256 Ausdrucksnamen und warnt, wenn es mehr gibt. Wenn du ein PMX ersetzt, wird die bisherige VMD entfernt; füge also für das neue Modell eine Animation hinzu. Entfernst du ein MMD-Modell, werden seine Bilder und seine Animation gelöscht, andere Avatar-Typen bleiben erhalten. Reduzierte Bewegung stoppt die Animation, behält aber die Gesichter und die Lippensynchronisation bei.

Unterstützt werden PMX-2.0- und kompatible PMX-2.1-Modelle mit PNG-, JPEG-, BMP- und TGA-Bildern, auch `.sph` und `.spa`. Einige neuere PMX-2.1-Funktionen werden nicht unterstützt; der Import nennt den Grund. PMD-Modelle, VPD-Posen sowie Kamera- oder Lichtanimationen werden nicht unterstützt. Physik wird nicht simuliert, daher können Haare und Kleidung anders aussehen als in MikuMikuDance. Modelle mit mehr als 256 Bildpfaden, sehr langen Pfaden, Bildern mit zu hohem Speicherbedarf oder übermäßig komplexen Rigs werden abgewiesen. Teste dein Modell, besonders auf einem Handy.

MMD-Avatare brauchen WebGL2 und verwenden dieselben Steuerelemente für Pause, Bildrate und Bildausschnitt wie die anderen Avatare. Modelle werden nur aus deiner Engine geladen. Halte dich an die Lizenzen und Bedingungen der Urheber. Beim Import oder Abspielen eines solchen Avatars wird nichts an einen KI-Dienst gesendet.

<a id="glb-and-fbx-avatars-rigged-models"></a>

## GLB- und FBX-Avatare: geriggte Modelle

1. Wähle auf der Seite **3D Avatars** unter **Avatar type** die Option **GLB or FBX model**.
2. Wähle **Import GLB or FBX** (GLB oder FBX importieren) und dann eine einzelne `.glb`- oder `.fbx`-Datei eines geriggten Charakters.

Einem einfachen Modell fehlen die VRM-Daten, die seine Knochen benennen. Der Import ordnet die Knochen deshalb über ihre Namen zu. Rigs aus Mixamo, Unity, VRoid, Unreal, Blender, 3ds Max, Maya HumanIK, Character Creator und DAZ verwenden Namen, die er kennt. Der Abschnitt zeigt, wie viele Körperknochen zugeordnet wurden. Das Modell braucht mindestens Hüfte, Wirbelsäule, Kopf sowie beide Ober- und Unterarme. Sonst lehnt der Import es ab und nennt die fehlenden Knochen. Benenne sie in deiner 3D-App um oder gib dem Modell mit Mixamo ein Rig. Modelle, die in A-Pose stehen, nach hinten schauen oder in Zentimetern gebaut sind, werden für dich gerade ausgerichtet, umgedreht und auf die richtige Größe gebracht.

Die Gesichter stammen aus den Blend Shapes des Modells (Shape Keys oder Morph Targets). Unter **Faces and mouth shapes** werden gängige Namen zugeordnet: Mundformen aus VRoid, VRChat und Oculus (`aa`, `A`, `viseme_aa`, `Fcl_MTH_A`), ein offener Kiefer (`mouthOpen`, `jawOpen`), Gefühle (`happy`, `Joy`, `mouthSmile`) und das Blinzeln (`blink` oder ein linkes und rechtes Paar wie `eyeBlinkLeft` und `eyeBlinkRight` aus ARKit). Prüf die Vorschau und korrigiere falsche Vermutungen. Ein Modell ohne Blend Shapes bewegt trotzdem seinen Körper und nickt beim Sprechen.

Unterstützt werden binäres glTF (`.glb`), in das alles eingebettet ist, sowie FBX 2014 (7.4) oder neuer, binär oder ASCII. Exportiere FBX-Dateien mit eingeschaltetem **Embed Media** (oder **Embed Textures**), sonst erscheint das Modell ohne seine Bilder. Draco-, meshopt- und KTX2-Komprimierung laden nicht, und eine separate `.gltf` mit eigenen Dateien lässt sich nicht verwenden. Ein als `.glb` gespeichertes VRM gehört unter **VRM model**. Die eigenen Animationen des Modells, Physik und Posenbearbeitung werden nicht unterstützt. Halte dich an die Bedingungen des Urhebers. Beim Import oder Abspielen eines solchen Avatars wird nichts an einen KI-Dienst gesendet.

<a id="get-a-3d-model"></a>

## Ein 3D-Modell besorgen

Hat der Charakter oder die Persona noch kein VRM-Modell, erstelle eines mit VRoid Studio. Das ist eine kostenlose App von pixiv für Windows, macOS und iPad. Modelle, die du damit erstellst, darfst du selbst verwenden, aber für einige der eingebauten Elemente und für gekaufte Texturen gelten eigene Bedingungen. Die Modelle bringen die sechs Gesichter, die fünf Mundformen und das Blinzeln mit, sodass Gesichter und Lippensynchronisation sofort funktionieren.

Wähle auf der Seite **3D Avatars** den Charakter oder die Persona. Unter **Get a 3D model** (3D-Modell besorgen) öffnet **Read the guide** (Anleitung lesen) diesen Abschnitt, und **Copy prompt** (Prompt kopieren) kopiert eine Beschreibung des Aussehens.

1. Lade [VRoid Studio](https://vroid.com/en/studio) herunter und installiere es.
2. Optional: Wähle **Copy prompt**, füge den Prompt in einen Bildgenerator ein und nutze das Bild als Vorlage. VRoid Studio hat kein Feld für einen Prompt.
3. Erstelle in VRoid Studio ein neues Modell. Wähle die Haare, das Gesicht, die Augen, den Körper und das Outfit, die dem Charakter am nächsten kommen, und ändere dann Formen und Farben, bis sie passen.
4. Exportiere das Modell als VRM (1.0 oder 0.0). Trag die Angaben und Bedingungen des Modells ein, wenn danach gefragt wird.
5. Öffne **3D Avatars** unter **Agents**, wähle den Charakter oder die Persona und dann **Import VRM** unter **VRM model**. Bei einem Modell aus VRoid Studio sind alle Gesichter, Mundformen und das Blinzeln schon ausgefüllt.

Der Prompt beschreibt den Charakter für Werkzeuge, die aus Text ein Bild oder ein 3D-Modell erstellen: einen Ganzkörper-Charakter im Anime-Stil in T-Pose, von vorn gesehen auf einfarbigem Hintergrund. Das Aussehen stammt aus dem Feld **Appearance** (Aussehen), aus den Tags unter **Image Appearance Override** (eigene Aussehensbeschreibung für Bilder), wenn diese eingeschaltet sind, oder aus der Beschreibung, wenn kein Aussehen eingetragen ist. Er enthält nur Namen und Aussehen, nichts anderes aus der Karte und nichts aus deinen Chats. Er ist auf Englisch. Ändere ihn nach Belieben.

Ein VRM aus einem anderen Werkzeug hat vielleicht weniger oder gar keine Ausdrücke. **Faces and mouth shapes** zeigt, welche es hat. Manche Websites geben an, aus einem Bild ein VRM mit Gesichtsausdrücken zu erstellen, doch keine davon ließ sich im Oktober 2026 bestätigen. Diese Anleitung empfiehlt deshalb keine. Ein Modell, das früher mit dem inzwischen entfernten Tripo-Generator erstellt wurde, lädt weiterhin und bewegt seinen Körper, aber sein Gesicht bewegt sich nicht.

## Wie Gesichter und Münder der Antwort folgen

Avatare reagieren von selbst. Hier musst du nichts einrichten.

**Gesichter im Roleplay.** Während eine Antwort eintrifft, liest Marinara jeden fertigen Satz und schätzt seine Stimmung ein. Damit das Gesicht nicht flackert, gilt:

- Das Gesicht wechselt nur, wenn die neue Stimmung deutlich stärker ist als die aktuelle.
- Ein Gesicht bleibt mindestens zwei Sekunden.
- Das Gesicht wird nach zwei ruhigen Sätzen in Folge wieder ruhig, und ebenso etwa vier Sekunden nach dem Ende der Antwort.

Bei ausgeschaltetem Streaming bekommt trotzdem jeder Satz seine eigene Stimmung, und die Gesichter wechseln während der Sprechzeit der Antwort der Reihe nach. Liest die Sprachausgabe die Antwort vor, folgen die Gesichter stattdessen der Stimme (siehe unten).

Ein PNGTuber-Avatar mit Gesichtern für [weitere Gefühle](#pngtuber-sprites) kann auch ein spezifischeres Gefühl zeigen, etwa Amusement bei fröhlicher Stimmung. Dafür gelten dieselben Regeln, und ein Gefühl ohne eigenes Gesicht zeigt das Gesicht seines Hauptgefühls. Bei der Wahl der Expression Engine und des Game Masters ist es genauso: Gibt es kein Gesicht mit dem Namen `scared`, zeigt der Avatar Fear. 3D- und Mesh-Avatare zeigen nur die sechs Gefühle.

**So wird die Stimmung gelesen.** Dein Chat-Modell wird nicht gefragt, und dein Chat-Text wird nie an einen externen Dienst geschickt.

- Eine eingebaute Wortliste antwortet sofort, überall, und kennt gängige Stimmungswörter in mehreren Sprachen.
- Auf Rechnern, die es ausführen können, liest stattdessen ein kleines Emotionsmodell die Sätze, die Stimmungserkennung. Sie versteht 36 Sprachen. Sie wird einmalig heruntergeladen, etwa 300 MB, wenn du zum ersten Mal einen Roleplay-Chat öffnest, in dem 2D Avatars oder 3D Avatars eingeschaltet ist. Die Seite jedes Avatar-Agenten unter **Agents** zeigt den Fortschritt. Ein gescheiterter Download startet etwa 10 Minuten später neu. Bis die Stimmungserkennung bereit ist, antwortet die Wortliste. Danach funktioniert die Stimmungserkennung offline. Im Einsatz belegt sie etwa 1 GB Arbeitsspeicher, und nach 10 Minuten ohne Nutzung wird sie entladen. Lite-Installationen, Android und Rechner mit weniger als 3 GB Arbeitsspeicher behalten die Wortliste.

**Gesichter im Game Mode.** Jede Zeile, die der Game Master zeigt, bringt einen Ausdruck mit, und der Avatar des sprechenden Charakters übernimmt ihn, auch wenn eine Stimme die Zeile vorliest. Innere Gedanken ändern das Gesicht, aber nicht den Mund.

**Expression Engine.** Ist sie eingeschaltet, ist ihre Wahl nach der Antwort das endgültige Gesicht für diese Antwort. Eine Wahl, die erst ankommt, nachdem du deine nächste Nachricht geschickt hast, bleibt bei ihrer eigenen Antwort. Mit Sprachausgabe erscheint die Wahl, sobald die Stimme fertig ist.

**Münder.** Folgt der Mund dem Text, bewegt er sich nur bei Dialog (Wörter in Anführungszeichen, `[Name]:`-Zeilen und Sprecher-Tags), nicht bei Erzählung, und zwar ungefähr im Sprechtempo. Erscheint der Text schneller, als ihn jemand sprechen könnte, wird der Mund schneller und springt dann vor. Bei ausgeschaltetem Streaming wird der Dialog einer Antwort innerhalb von acht Sekunden gesprochen. Spielt die Sprachausgabe eine Zeile ab, bewegt stattdessen die Stimme den Mund.

**Körper.** Ein Avatar denkt vom Moment des Sendens bis zu seinen ersten Worten nach, spricht, während sich sein Mund bewegt, hört zu, während jemand anderes spricht oder du tippst, und ruht ansonsten.

**Gruppenchats.** In einem Individual-Gruppenchat spricht das Mitglied, das gerade antwortet, auch wenn du bei der Nachricht eines Mitglieds swipst. In einem Merged-Gruppenchat steuert ein Sprecher-Tag Dialog und Gesicht dieses Charakters, auch in einem Absatz, der jemand anderen nennt. Namentlich zugeordnete Dialoge folgen ebenfalls ihrem Sprecher. Prosa ohne Sprecher-Tag gehört dem ersten Charakter, den sie nennt, oder dem des Absatzes davor. Solange ein Absatz, der niemanden nennt, noch erscheint, wartet sein Dialog, bis ein Name oder das Ende des Absatzes zeigt, wer spricht. Bei ausgeschaltetem Streaming bewegt in einem Individual-Gruppenchat vorerst nur die Antwort des letzten Mitglieds einen Avatar.

<a id="lip-sync-with-text-to-speech"></a>

## Lippensynchronisation mit Sprachausgabe

Liest die Sprachausgabe eine Roleplay-Antwort vor, bewegt der Avatar des sprechenden Charakters seinen Mund mit der Stimme. Bei lauten Lauten öffnet sich der Mund weiter, in Pausen schließt er sich, bei Lauten wie „u“ rundet er sich, und bei Lauten wie „s“ zeigt er die Zähne. Um die Lippensynchronisation einzuschalten, richte die Sprachausgabe ein, wie in [Text to Speech (TTS) einrichten](../media/tts-setup.md) beschrieben. Dann funktioniert sie mit **Auto-play** (automatische Wiedergabe) und mit der Schaltfläche **Speak** (Vorlesen) an einer Nachricht, auch im Visual-Novel-Layout.

Wird die Antwort mit eingeschaltetem **Auto-play** vorgelesen, setzt die Stimme meist erst ein paar Sekunden nach dem Erscheinen des Textes ein. Der Avatar wartet deshalb auf sie.

- Während der Text erscheint, blinzelt und bewegt sich der Avatar wie gewohnt, aber sein Mund bleibt geschlossen, und sein Gesicht ändert sich noch nicht.
- Setzt die Stimme ein, folgt der Mund der Stimme, und das Gesicht ändert sich, sobald die Stimme den jeweiligen Satz erreicht, es sei denn, die Expression Engine hat das Gesicht bereits gewählt.
- Das Gesicht entspannt sich etwa vier Sekunden nach dem Ende der Stimme. Kurze Pausen zwischen den Zeilen entspannen es nicht.
- Scheitert die Stimme oder setzt sie nicht innerhalb weniger Sekunden ein, spielt der Avatar die Gesichter und den Mund der Antwort einmal anhand des Textes ab. Scheitert sie später, zeigt er die letzte Stimmung und entspannt sich dann.
- Nach 30 Sekunden ohne Stimme wartet der Avatar nicht mehr. Eine Stimme, die später einsetzt, bewegt trotzdem noch den Mund.

Einzelheiten:

- **Wer spricht**: Es bewegt sich der Mund des Charakters, dessen Stimme die Zeile vorliest – also des Charakters, für den **Voice option** eine Stimme wählt. Der Mund jedes Charakters bewegt sich nur während seiner eigenen Zeilen. Zeilen mit der Erzählerstimme und Sprecher, die keine Charaktere im Chat sind, bewegen keinen Mund. Ist **Only read dialogues** (nur Dialoge vorlesen) aus, wird die eigene Erzählung eines Charakters mit seiner Stimme gelesen und bewegt seinen Mund.
- **Pause, Stopp und Chatwechsel**: Pausierst oder stoppst du die Stimme, stoppt auch der Mund. Wechselst du in einen anderen Chat, während eine Antwort vorgelesen wird, bleiben die Avatare dort still. Kehrst du zurück, während die Stimme noch läuft, greift der Avatar sie wieder auf.
- **Lautstärke**: **Line volume** (Zeilenlautstärke) ändert die Lautstärke, nicht wie weit sich der Mund öffnet.
- **Personas**: Der Mund einer Persona bewegt sich bei deinen eigenen Nachrichten nicht.
- **Game Mode**: Sind Sprachausgabe und **Auto-play** eingeschaltet, warten die Münder auf die Stimme ihres Charakters und folgen ihr. Zeilen ohne Stimme behalten ihre Textanimation. Erzähler- und Spielerstimmen bewegen keinen Charaktermund. Innere Gedanken werden nicht vorgelesen.

Die Lippensynchronisation ändert nichts daran, wie die Stimme abgespielt wird. Marinara liest eine separate Kopie jedes Clips, um den Mund zu takten. Die Wiedergabe funktioniert also wie bisher, auch in Safari und auf iPhone und iPad. Beginnt der erste Clip, bevor das Timing bereit ist, bewegt sein Text den Mund, bis das Timing der Stimme übernimmt. Kann dein Browser einen Clip nicht lesen, läuft die Stimme trotzdem, und nur der Mund folgt ihr nicht mehr.

<a id="making-an-avatar-from-a-sprite"></a>

## Einen Avatar aus einem Sprite erstellen

Wähle auf der Seite **2D Avatars** einen Charakter oder eine Persona und nutze dann **Make an avatar from a sprite** (Avatar aus einem Sprite erstellen). Das funktioniert mit den Sprites, die der Charakter oder die Persona bereits hat. Dein Avatar bleibt unverändert, bis du ein Ergebnis speicherst. Du kannst es also so oft versuchen, wie du willst.

<a id="faces-from-the-avatar"></a>

### Gesichter aus dem Avatar

**Make faces from the avatar** (Gesichter aus dem Avatar erstellen) erstellt Gesichter ohne Hintergrund, auch für einen Charakter oder eine Persona, die noch keine Sprites hat. Dafür brauchst du einen Avatar und ein Konto für die Bildgenerierung. Es öffnet dieselbe Sprite-Generierung wie die Editoren für Charaktere und Personas, mit dem Avatar als Referenz.

1. Wähle **All faces** (alle Gesichter) für alle 29 Gefühle, **Main faces** (Hauptgesichter) für die sechs oder such dir selbst Gesichter aus. Jedes zusätzliche Gefühl steht in der Zeile seines Hauptgesichts, bis es ein eigenes Gesicht hat.
2. Die Gesichter werden in Gruppen gezeichnet, Hauptgesichter zuerst. Ältere GPT-Image-Modelle zeichnen ein Gesicht pro Bild. Ein fehlgeschlagenes Bild wird einmal erneut versucht. Schlägt es wieder fehl, hält der Durchgang mit **Retry picture** (Bild wiederholen) an. **Cancel** (Abbrechen) behält die bereits erstellten Gesichter.
3. Ist **Expose media prompts before sending** (Medien-Prompts vor dem Senden anzeigen) eingeschaltet, prüfst du alle Prompts auf einmal, bevor der erste gesendet wird. Jedes Gesicht wird mit offenen Augen und geschlossenem Mund gezeichnet, damit die Bilder zum Blinzeln und Sprechen etwas zum Schließen und Öffnen haben.
4. Marinara zeichnet die Gesichter auf einer einfarbigen Fläche, entfernt diese Farbe wieder und speichert die Gesichter als Sprites des Charakters oder der Persona. Ein neues Sprite ersetzt das gleichnamige, benenne es also im letzten Schritt um, wenn du das alte behalten willst.

Ist der Avatar bereits gespeichert, wird jedes neue Gesicht zum Gesicht des Gefühls, für das es gezeichnet wurde, auch wenn du es umbenannt hast. Andere Sprites bleiben erhalten. Ein neu erstelltes Gesicht beginnt ohne Bilder zum Blinzeln und Sprechen, weil die alten nicht dazu passen würden. Erstelle neue unter [Bilder zum Blinzeln und Sprechen](#blink-and-talk-pictures). Ein Import aus PNGTuber Plus behält seine eigenen Gesichter.

<a id="blink-and-talk-pictures"></a>

### Bilder zum Blinzeln und Sprechen

Jedes Gesicht, das der Avatar für ein Gefühl zeigt, ist eine Zeile, mit seinen Bildern für **Eyes closed** (Augen geschlossen) und **Mouth open** (Mund offen) neben dem **Face** (Gesicht). Das sind Bilder, die du gespeichert hast, `_blink`- und `_talk`-Sprites, die du hinzugefügt hast, oder neue. Gibt es Porträt-Sprites, werden nur diese verwendet, denn ein Avatar mischt nie Porträt- und Ganzkörper-Gesichter. Ein Gesicht, das keines deiner Sprites ist, etwa eines aus einem Import von PNGTuber Plus, zeigt seine Bilder, bekommt aber keine neuen.

1. Prüf **Image model** (Bildmodell). Dein Standard-Bildkonto ist schon für dich ausgewählt.
2. Klick auf **Make** (Erstellen), um ein fehlendes Bild zu zeichnen, oder auf die Schaltfläche **Make N pictures** (N Bilder erstellen) für alle. Jedes Bild ist eine Bildanfrage. Ist **Expose media prompts before sending** (in den Einstellungen) eingeschaltet, siehst du jeden Prompt vorher und kannst ihn bearbeiten.
3. Die neuen Bilder erscheinen nacheinander. Wähle **Keep** (Behalten) bei denen, die passen, und **Try again** (erneut versuchen) bei den anderen. **Try again** zeichnet auch ein Bild neu, das du schon hast. Das Bild, das neu gezeichnet wird, bleibt abgedunkelt und zeigt eine Ladeanzeige. **Cancel** stoppt es, auch auf dem Server. Wenn **Try again** scheitert, bleibt das alte Bild. Um ein behaltenes Bild neu zu erstellen, wähle zuerst **Kept**, um es freizugeben.
4. Wähle **Save kept pictures** (behaltene Bilder speichern). Sie werden zu den Bildern zum Blinzeln und Sprechen des Avatars, neben einer Kopie des Sprites, aus dem sie gezeichnet wurden, damit sie immer deckungsgleich sind. Ersetzt du ein Sprite vor dem Speichern, erstelle seine Bilder neu.

Bei einem Bildkonto, das ein Referenzbild annimmt, ist dein Sprite die einzige Referenz, in der Größe und Form, die das Modell akzeptiert, mit einem Prompt, der nur Änderungen an Augen oder Mund verlangt. Modelle verschieben oder skalieren das Bild, das sie zurückschicken, oder ergänzen Ränder. Deshalb wird es zuerst an deinem Sprite ausgerichtet. Daraus werden nur die Augen (fürs Blinzeln) oder der Mund (fürs Sprechen) übernommen. Alles andere bleibt Pixel für Pixel dein Sprite, sodass der Avatar nicht springt. Haben sich die Augen nicht geschlossen, hat sich der Mund nicht geöffnet oder war das Bild zu weit verschoben, um es auszurichten, schlägt das Bild mit einer Meldung fehl. Versuch es erneut.

Manche Konten können keine Bilder bearbeiten, etwa Pollinations, Together AI, Horde, DALL-E oder ein ComfyUI-Workflow ohne Platz für ein Referenzbild. Mit einem davon zeichnet **Make** ein neues Gesicht samt seinen Bildern zum Blinzeln und Sprechen in einem einzigen Bild, damit die drei zusammenpassen, so wie bei [Gesichter aus dem Avatar](#faces-from-the-avatar). Die Zeile zeigt **New face** (neues Gesicht). **Keep** behält das Gesicht und seine beiden Bilder zusammen, und beim Speichern wird das neue Gesicht zum Gesicht dieses Gefühls. Dein Sprite bleibt unverändert. Dafür braucht der Charakter oder die Persona ein Aussehen oder eine Beschreibung.

### Mesh-Avatar

1. Wähle unter **Sprite to use** (zu verwendendes Sprite) ein Sprite. Gibt es ein neutrales Ganzkörper-Sprite, ist es schon für dich ausgewählt. Am besten eignet sich ein Ganzkörper-Sprite oder Brustbild von vorn.
2. Wähle den **Chat provider that can see pictures** (Chat-Anbieter, der Bilder sehen kann). **The agent's provider** (der Anbieter des Agenten) nutzt den Anbieter, der auf der Seite von 2D Avatars eingestellt ist, und sonst dein Standardkonto für Agenten. Sein Modell muss Bilder annehmen.
3. Wähle **Make mesh avatar** (Mesh-Avatar erstellen). Das Chat-Modell findet das Gesicht, und Marinara baut den Avatar aus deinem Sprite, so wie es ist. **Cancel** stoppt den Vorgang.
4. Prüf die Vorschau: Die Umrisse sollten auf Augen, Brauen und Mund liegen. Wähle **Save as mesh avatar** (als Mesh-Avatar speichern) oder **Discard** (Verwerfen) und versuch es mit einem anderen Sprite oder Modell.

Ein erstellter Mesh-Avatar bewegt Kopf, Augen, Brauen und Mund und blinzelt und spricht mit seinen eigenen Lidern und seinem eigenen Mund. Die Haare bewegen sich mit dem Kopf. Hände, einzelne Haarsträhnen und herabhängende Accessoires werden nicht geriggt. Kleine Sprites werden aus einer vergrößerten Kopie gebaut, damit der Mund zum Gesicht passt. Füllt das Gesicht den größten Teil eines großen Sprites aus, wird eine kleinere Kopie verwendet, damit es schnell bleibt.

Dein Sprite geht für Bilder zum Blinzeln und Sprechen an das Bildkonto (und an dessen Fallback-Bildkonto, falls eines eingestellt ist und es eine Referenz annimmt), für einen Mesh-Avatar an das Chat-Modell. Ein Konto, das keine Bilder bearbeiten kann, bekommt nur den Prompt, der das Aussehen enthält. Die Prompts bringt der Agent 2D Avatars mit. Ist **Expose media prompts before sending** eingeschaltet, kannst du jeden Prompt lesen und ändern. Im Debug-Modus wird jeder Prompt ins Server-Log geschrieben.

## Ein eigenes Modell erstellen

Ein Charakter oder eine Persona kann die eigenen Ausdrucks-Sprites ganz ohne Zeichnen als PNGTuber-Avatar nutzen. [Einen Avatar aus einem Sprite erstellen](#making-an-avatar-from-a-sprite) ergänzt Bilder zum Blinzeln und Sprechen oder baut einen Mesh-Avatar für dich. Um ein eigenes Modell zu erstellen, nutze eines dieser Werkzeuge. Jede Datei importierst du auf der Seite des Agenten unter **Agents**; schalte dann **Show this avatar in chats** ein.

| Was du willst | Werkzeug | Was du bekommst |
| --- | --- | --- |
| PNGTuber-Sprites | Eine beliebige Zeichen-App, danach der Tab **Sprites** des Charakters | Die Sprites |
| PNGTuber-Sprites mit Ebenen und Kostümen | [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) | Eine `.save`-Datei |
| Ein Mesh-Avatar | [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) | Eine `.mavatar`-Datei |
| Ein 3D-Modell | [VRoid Studio](https://vroid.com/en/studio) oder Blender mit dem [VRM Add-on for Blender](https://vrm-addon-for-blender.info/en-us/) | Eine `.vrm`-Datei, optional eine Idle-Animation als `.vrma` |

### Deine eigenen Sprites

1. Zeichne ein Bild pro Gefühl, alle gleich groß und mit dem Charakter an derselben Stelle. Benenne jedes nach seinem Gefühl: `neutral`, `happy`, `angry`, `sad`, `relaxed`, `surprised`. Namen, die ein Gefühlswort enthalten, funktionieren auch, etwa `smile`, `cry`, `calm` oder `shock`. Für die optionalen [weiteren Gefühle](#pngtuber-sprites) benenne Bilder etwa `amusement`, `fear` oder `gratitude`.
2. Für einen beweglichen Mund zeichne dasselbe Bild mit offenem Mund und häng `_talk` an, zum Beispiel `happy_talk`. Fürs Blinzeln schließ die Augen und häng `_blink` an. Für beides häng `_blink_talk` an.
3. Füge die Bilder im Tab **Sprites** unter **Facial Expressions** (Gesichtsausdrücke) hinzu. Jeder Dateiname wird zum Namen seines Sprites. Siehe [Charakter-Sprites](../characters/sprites.md#upload-your-own-sprites).
4. Öffne **2D Avatars** unter **Agents**, wähle den Charakter oder die Persona und schalte **Show this avatar in chats** ein.

### PNGTuber Plus

1. Bau den Avatar aus getrennten Ebenen auf. Zeig den offenen Mund nur beim Sprechen und den geschlossenen Mund nur, wenn der Avatar still ist. Zeig die geschlossenen Augen nur beim Blinzeln und die offenen Augen nur, wenn er nicht blinzelt.
2. Leg für jedes Gefühl ein Kostüm an, das die Augen oder den Mund austauscht, und benenne diese Bilder nach dem Gefühl, zum Beispiel `angry eyes.png` oder `happy_mouth.png`. Spezifischere Gefühle funktionieren genauso, etwa `fear eyes.png`. Kostüm 1 ist das Ruhegesicht.
3. Speichere den Avatar, um eine `.save`-Datei zu erhalten.
4. Öffne **2D Avatars** unter **Agents**, wähle den Charakter oder die Persona, dann **PNGTuber sprites** und **Import PNGTuber Plus save**. Wähle ein Gesicht für jedes Gefühl, das die Namen nicht abdecken.

### Mesh Avatar Studio

1. Beginne mit einem Bild von vorn, das Kopf und Schultern zeigt, mit transparentem Hintergrund. Mesh Avatar Studio läuft mit Node.js auf deinem Rechner, und ein Coding-Agent wie Claude Code oder Codex gibt dem Bild ein Rig. Die README führt dich durch die Schritte.
2. Optional: Füge unter **Drawn variants** gezeichnete Augen und Münder hinzu. Marinara verwendet die Mundformen `mouth_a`, `mouth_i`, `mouth_o` und `mouth_a_half` und die geschlossenen Augen `eyes_closed_0` und `eyes_closed_1`. Jeder Mesh-Avatar hat die sechs Gefühle eingebaut, du musst also nichts benennen.
3. Wähle **Export .mavatar**. Pack den Projektordner nicht selbst als ZIP.
4. Öffne **2D Avatars** unter **Agents**, wähle den Charakter oder die Persona, dann **Mesh avatar** und **Import .mavatar file**.

### VRoid Studio

1. Erstelle den Charakter in VRoid Studio. Seine Gesichter, Mundformen und das Blinzeln sind Standard-VRM-Ausdrücke und werden deshalb automatisch gefunden.
2. Exportiere ihn als VRM (1.0 oder 0.0). Trag die Angaben und Bedingungen des Modells ein, wenn danach gefragt wird.
3. Öffne **3D Avatars** unter **Agents**, wähle den Charakter oder die Persona und dann **Import VRM**.

<a id="blender-with-the-vrm-add-on-for-blender"></a>

### Blender mit dem VRM Add-on for Blender

1. Installiere das VRM Add-on for Blender über **Get Extensions** in den **Preferences** von Blender. Blender-Versionen vor 4.2 installieren stattdessen die ZIP-Datei des Add-ons unter **Add-ons**.
2. Gib dem Modell ein humanoides Skelett (Armature) und weise seine VRM-Knochen zu. Das Add-on kann sie automatisch zuweisen.
3. Richte die Ausdrücke im VRM-Panel des Add-ons ein: **Expressions** für VRM 1.0 oder **VRM 0.x Blend Shape Proxy** für VRM 0.x. Jeder Ausdruck muss einen Shape Key oder ein Material bewegen: Ein leerer Ausdruck verändert nichts, deshalb verwendet der Import ihn nur für Neutral. Eigene Ausdrücke mit eindeutigem Namen, etwa `Smile` oder `Shock`, werden ebenfalls zugeordnet.
   - Gesichter: **Happy**, **Angry**, **Sad**, **Relaxed** und **Surprised**. VRM 0.x nennt die ersten vier **Joy**, **Angry**, **Sorrow** und **Fun** und hat kein Preset für „überrascht“. Leg deshalb ein eigenes mit dem Namen `Surprised` an.
   - Mundformen: **Aa**, **Ih**, **Ou**, **Ee** und **Oh** (**A**, **I**, **U**, **E** und **O** in VRM 0.x).
   - Blinzeln: **Blink**.
4. Exportiere mit **File → Export → VRM (.vrm)**. Für eine Idle-Animation animierst du das Skelett und nutzt **File → Export → VRM Animation (.vrma)**. Das Add-on exportiert eine Animation nur aus einem Modell, das auf VRM 1.0 eingestellt ist. Wähle also in Schritt 3 VRM 1.0, wenn du eine willst.
5. Öffne **3D Avatars** unter **Agents**, wähle den Charakter oder die Persona und dann **Import VRM**. Füge die Animation mit **Add animation** (Animation hinzufügen) unter **Idle animation** hinzu.

### Was du beim Export vermeiden solltest

- **Komprimierung**: Mesh-Komprimierung mit Draco oder meshopt und KTX2-Texturen laden nicht. Die VRM-Exporte oben verwenden sie nie, aber der einfache glTF-Export von Blender bietet Draco an, und Modell-Optimierer können alle drei hinzufügen. Exportiere erneut mit ausgeschalteter Komprimierung.
- **Einfaches glTF**: Einer einfachen `.glb`-Datei fehlen die VRM-Daten, die Gesichter und Skelett benennen. Importiere sie als **GLB or FBX model** oder exportiere eine `.vrm`-Datei.
- **Getrennte Dateien**: Ein Modell, dessen Texturen oder Daten in getrennten Dateien liegen, lässt sich nicht verwenden. Exportiere eine einzige `.vrm`-Datei.
- **Extras aus PNGTuber Plus**: Wackeln, Nachziehen und Animation werden nicht übernommen. Jede Ebene erscheint in Ruhestellung, und eine animierte Ebene zeigt ihr erstes Einzelbild.

## Leistung und Geräte

Der Zeichencode jedes Avatar-Typs wird erst heruntergeladen, wenn zum ersten Mal ein Avatar dieses Typs erscheint. Chats ohne Avatare laden also nichts zusätzlich.

| | Handys | Desktop-Rechner |
| --- | --- | --- |
| Gleichzeitig gezeichnete Avatare | Kein festes Limit | Kein festes Limit |
| Bilder pro Sekunde beim Sprechen | 30 | 30 |
| Bilder pro Sekunde im Leerlauf | 20, oder 15, wenn das Handy ausgelastet ist | 30 |
| Schärfe (Pixelverhältnis) | bis zu 1,5× | bis zu 2× |

Ein Chat zeigt jeden eingerichteten, eingeschalteten Avatar in der Reihenfolge seiner Charaktere, danach deine Persona. Passe Größe und Anordnung der Besetzung an deinen Bildschirm an. Avatare hören auf zu zeichnen, solange der Tab verborgen ist, das Fenster im Hintergrund liegt, die Appearance-Einstellungen offen sind oder der Chat nicht zu sehen oder von einem Panel oder Editor verdeckt ist. Ist **Reduce Ambient Animations & Effects** (Umgebungsanimationen und Effekte reduzieren) oder die Einstellung für reduzierte Bewegung deines Geräts eingeschaltet, wechseln Avatare weiterhin das Gesicht und bewegen den Mund, lassen aber Atmen, Schwanken und die Wartehaltungen weg.

## Verwandte Anleitungen

- [Agenten: KI-Helfer für deine Chats](agents-overview.md)
- [Referenz der herunterladbaren Agenten](built-in-agents.md)
