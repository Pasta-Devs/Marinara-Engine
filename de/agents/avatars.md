# 2D- und 3D-Avatare

Zwei herunterladbare Agenten geben deinen Charakteren und Personas einen animierten Avatar, der reagiert, während eine Antwort eintrifft. **2D Avatars** (2D-Avatare) zeigt Sprites im PNGTuber-Stil oder Mesh-Avatare, **3D Avatars** (3D-Avatare) zeigt VRM-Modelle. Die Gesichter folgen der Antwort, und die Münder bewegen sich mit dem Text oder mit der Sprachausgabe (Text to Speech).

Diese Funktion ist noch im Aufbau. Die folgenden Abschnitte füllen sich, sobald der jeweilige Teil auf `staging` landet.

Live2D-Modelle werden nicht unterstützt. Die Lizenz von Live2D verlangt selbst für kostenlose Open-Source-Apps eine eigene Vereinbarung mit Live2D, und die Live2D-Laufzeitumgebung kann nicht mit Marinara Engine ausgeliefert werden.

## Die Agenten herunterladen

Beide Agenten werden noch getestet. Vorerst bietet **Download Agents** (Agenten herunterladen) sie nur an, wenn Marinara Engine auf dem `staging`-Branch läuft.

**2D Avatars** und **3D Avatars** sind getrennte Downloads. Du kannst also nur den installieren, den du willst. Beide funktionieren für Charaktere und Personas in Roleplay- und Game-Chats.

1. Öffne **Agents → Download Agents** und installiere **2D Avatars**, **3D Avatars** oder beide. Keiner der beiden braucht einen Neustart.
2. Richte jeden Avatar auf der Seite des Agenten unter **Agents** (Agenten) ein. Siehe [Einen Avatar einrichten](#setting-up-an-avatar).
3. Öffne in einem Roleplay- oder Game-Chat **Chat Settings → Agents → Misc Agents** (Chat-Einstellungen → Agenten → sonstige Agenten) und füge den Agenten hinzu.

Während du chattest, schicken die Agenten keine zusätzlichen Anfragen an deine KI-Verbindungen. Beide brauchen eine Engine mit Capability API 1.73; eine ältere Engine verweigert ihre Installation.

<a id="setting-up-an-avatar"></a>

## Einen Avatar einrichten

Avatare richtest du auf der eigenen Seite des jeweiligen Agenten ein. Öffne **Agents**, dann **2D Avatars** oder **3D Avatars**, und nutze den Abschnitt **Avatars** (Avatare) weit oben.

1. Wähle unter **Character or persona** (Charakter oder Persona), wer den Avatar bekommt. Namen mit dem Zusatz „(has an avatar)“ haben bereits einen gespeicherten Avatar.
2. Wähle unter **Avatar type** (Avatar-Typ) die Art, die du einrichten willst. 2D Avatars bietet **PNGTuber sprites** und **Mesh avatar**, 3D Avatars bietet **VRM model**.
3. Richte ihn im eigenen Abschnitt dieses Typs unter den Schaltern ein: Nutze deine Sprites oder importiere eine Datei, wähle das Gesicht für jedes Gefühl oder entferne ihn. Siehe [2D-Avatare](#2d-avatars-pngtuber-sprites-and-mesh-avatars) und [3D-Avatare](#3d-avatars-vrm-models).
4. Unter **Preview** (Vorschau) siehst du ihn. **Try a face** (Gesicht ausprobieren) wechselt zwischen den Gefühlen, und **Talk** (Sprechen) bewegt den Mund. Gibt es noch nichts zu zeigen, zeigt die Vorschau einen Beispiel-Avatar.

Ein Charakter oder eine Persona mit Ausdrucks-Sprites hat auf der Seite von 2D Avatars bereits einen PNGTuber-Avatar. Chats, in denen 2D Avatars eingeschaltet ist, zeigen ihn also, ohne dass etwas gespeichert ist.

**Show this avatar in chats** (diesen Avatar in Chats zeigen) schaltet den Avatar an oder aus, ohne ihn zu löschen. **Movement** (Bewegung) hat drei Schalter, die für jeden Typ gelten: **Lip sync** (Lippensynchronisation) bewegt den Mund, **Blinking** (Blinzeln) lässt den Avatar alle paar Sekunden blinzeln, und **Idle motion** (Bewegung im Leerlauf) lässt ihn beim Warten atmen und leicht schwanken. Hat ein Charakter mehr als einen Avatar-Typ, legt **Show this one** (diesen zeigen) fest, welchen Typ die Chats verwenden. Ist der Agent dieses Typs in einem Chat aus, zeigt der Chat einen anderen Typ, dessen Agent an ist. Entfernst du einen Typ, werden seine Dateien gelöscht; deine Sprites bleiben erhalten, und ein Avatar, den du ausgeschaltet hast, bleibt aus.

Ein Avatar erscheint in einem Roleplay-, Visual-Novel- oder Game-Chat, wenn im Chat die Agenten eingeschaltet sind und der passende Agent hinzugefügt ist. Er funktioniert mit und ohne Expression Engine. Der Avatar blendet das Ganzkörper-Sprite nicht aus. Schalte es also selbst aus, wenn der Avatar es ersetzen soll. Avatare stehen dort, wo das Ganzkörper-Sprite stehen würde, und haben dieselbe Größe. Verschieben kannst du sie mit dem Modus **Arrange** (Anordnen) der Sprites in den Sprite-Einstellungen der Expression Engine.

Importierte Dateien werden geprüft, bevor sie gespeichert werden. Unterhalb des normalen Upload-Limits des Servers gibt es kein eigenes Größenlimit für Avatare. Avatar-Dateien liegen im Datenordner unter `avatar-models/<character or persona>/<id>/`, neben einer `avatar.json` mit den Einstellungen. Backups und Profil-Exporte enthalten diesen Ordner. Löschst du einen Charakter oder eine Persona, wird auch der Avatar gelöscht – auch dann, wenn die Danger Zone in den Einstellungen alle **Characters** (Charaktere) oder **Personas** löscht. Leerst du dort **Media & Assets**, wird der Ordner geleert. Charakterkarten-Exporte enthalten nie Avatare.

<a id="2d-avatars-pngtuber-sprites-and-mesh-avatars"></a>

## 2D-Avatare: PNGTuber-Sprites und Mesh-Avatare

**2D Avatars** zeigt eine von zwei Arten von Avataren: **PNGTuber-Sprites**, flache Bilder, die das Gesicht wechseln, den Mund öffnen und blinzeln, und **Mesh-Avatare**, Zeichnungen, die Kopf, Augen und Mund fließend bewegen. Beide richtest du auf der Seite des Agenten im Agent-Editor ein, nachdem du einen Charakter oder eine Persona gewählt hast.

### PNGTuber-Sprites

Ein Charakter oder eine Persona mit Ausdrucks-Sprites hat bereits einen PNGTuber-Avatar: Die Sprites sind die Gesichter, einzurichten ist nichts. Gibt es Porträt-Sprites, werden diese verwendet, sonst die Ganzkörper-Sprites. Ein Avatar mischt die beiden also nie.

- **Bilder zum Sprechen und Blinzeln**: Füge Sprites hinzu, die nach einem Gesicht benannt sind, mit `_talk` für den offenen Mund und `_blink` für geschlossene Augen, zum Beispiel `happy_talk` und `happy_blink`, und `happy_blink_talk` für beides. `_talking`, `_speak`, `_mouth_open`, `_blinking` und `_eyes_closed` funktionieren auch. Ein Gesicht ohne diese Bilder hüpft trotzdem, während es spricht.
- **Face for each feeling** (Gesicht für jedes Gefühl): Wähle, welches Gesicht bei Neutral, Happy, Angry, Sad, Relaxed und Surprised erscheint. **Resting face** (Ruhegesicht) verwendet das Gesicht für Neutral. Wählt die Expression Engine oder der Game Master ein Sprite, das du hast, erscheint genau dieses Gesicht.
- **Movement**: **Hop while talking** (beim Sprechen hüpfen) und **Hop height** (Hüpfhöhe) steuern das Hüpfen im PNGTuber-Stil. **Time between blinks** (Zeit zwischen dem Blinzeln) ist der Durchschnitt; jedes Blinzeln kommt etwas früher oder später, damit es nie mechanisch wirkt. Ist auf deinem Gerät reduzierte Bewegung eingeschaltet, hüpft und atmet der Avatar nicht, aber Gesicht und Mund ändern sich weiterhin.
- **Use my sprites** (meine Sprites verwenden) speichert die Sprites als Gesichter des Avatars. Auch wenn du ein Gesicht wählst oder die Bewegung änderst, wird er gespeichert. **Update from sprites** (aus Sprites aktualisieren) übernimmt Sprites, die du später hinzugefügt hast, und behält die Gesichter, die du für jedes Gefühl gewählt hast. Wähle nach einem Import **Remove** (Entfernen), um zu deinen Sprites zurückzukehren.

**Import PNGTuber Plus save** (PNGTuber-Plus-Speicherstand importieren) liest einen Avatar, der mit [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) gespeichert wurde (eine `.save`-Datei). Jedes Kostüm wird zu einem Gesicht, und seine Ebenen fürs Sprechen und Blinzeln werden zu den Bildern zum Sprechen und Blinzeln. Kostüme werden den Gefühlen über die Namen der Bilder zugeordnet, die sie zeigen, etwa `angry eyes.png`. Wähle ein Gesicht für jedes Gefühl, das die Namen nicht abdecken. Manches wird nicht übernommen:

- Wackeln, Nachziehen, Drehung und Dehnung werden nicht importiert; der Avatar zeigt jede Ebene in Ruhestellung.
- Animierte Ebenen zeigen nur ihr erstes Einzelbild.
- Sehr alte Speicherstände enthalten nur die Pfade ihrer Bilder auf dem Rechner des Urhebers. Speichere sie zuerst mit einer neueren Version von PNGTuber Plus erneut.
- Ein sehr großer Avatar wird auf 2.048 Pixel verkleinert, damit Handys jedes Bild im Speicher halten können.

Für den Import eines Speicherstands braucht der Server Bildverarbeitung. Manche Android-Installationen (Termux) haben sie nicht. Dort wird der Import deshalb mit einer entsprechenden Meldung abgelehnt.

### Mesh-Avatare

Ein Mesh-Avatar ist eine `.mavatar`-Datei. Marinara Engine kann einen aus einem deiner Sprites erstellen (siehe [Einen Avatar aus einem Sprite erstellen](#mesh-avatar)), oder du erstellst einen mit [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) (siehe [Ein eigenes Modell erstellen](#mesh-avatar-studio)). Mit **Import .mavatar file** (.mavatar-Datei importieren) fügst du einen hinzu, mit **Replace file** (Datei ersetzen) tauschst du ihn aus. Ist die Bewegung im Leerlauf eingeschaltet, atmet der Avatar und schaut sich von selbst um. Er blinzelt, und sein Mund folgt der Antwort. Enthält die Datei gezeichnete Mundformen, werden diese verwendet; sonst werden einfache Mundformen für ihn gezeichnet.

Unter **Look for each feeling** (Aussehen für jedes Gefühl) wählst du, was jedes Gefühl zeigt: eines der sechs Gefühle oder **Smile** (Lächeln), **Shy** (schüchtern), **Half-closed eyes** (halb geschlossene Augen) oder **Wink** (Zwinkern).

Jede Datei wird beim Import geprüft, und eine beschädigte Datei wird mit einer kurzen Begründung abgelehnt. Das gilt auch für eine Datei, die zu detailliert ist, um flüssig zu laufen, oder die entpackt größer als das Upload-Limit ist. Nur die Teile, die der Avatar braucht, werden behalten. Die Originalillustration in der Datei wird also nicht gespeichert. Das Artwork gehört seinem Urheber; prüfe die Lizenz, bevor du es weitergibst.

Mesh-Avatare brauchen WebGL2, das aktuelle Browser mitbringen. Fehlt es oder stoppt der Browser die Grafik des Avatars, um Arbeitsspeicher zu sparen, zeigt der Avatar stattdessen deine PNGTuber-Einrichtung oder deine Sprites.

<a id="3d-avatars-vrm-models"></a>

## 3D-Avatare: VRM-Modelle

**3D Avatars** zeigt VRM-Modelle, das Format, das VRoid Studio, das VRM Add-on for Blender und UniVRM für Unity exportieren. Dateien mit VRM 1.0 und VRM 0.x funktionieren beide.

1. Öffne **3D Avatars** im Agent-Editor und wähle den Charakter oder die Persona.
2. Wähle unter **VRM model** (VRM-Modell) **Import VRM** (VRM importieren) und dann eine `.vrm`-Datei.
3. Lies **The author's terms** (die Bedingungen des Urhebers). Sie stammen aus der Modelldatei und legen fest, wer das Modell als Avatar nutzen darf, ob kommerzielle Nutzung erlaubt ist, ob du das Modell verändern darfst, ob sexuelle oder sehr gewalttätige Inhalte erlaubt sind und bei VRM-1.0-Modellen, ob du den Urheber nennen musst und die Datei weitergeben darfst. Verlinkt die Datei auf eine Lizenz oder auf eigene Bedingungen des Urhebers, öffne auch diese. Marinara Engine zeigt die Bedingungen an, setzt sie aber nicht durch. Halte dich also bitte selbst daran.
4. Prüf unter **Faces and mouth shapes** (Gesichter und Mundformen), welcher Ausdruck des Modells jedes Gesicht (Neutral, Happy, Angry, Sad, Relaxed und Surprised), jede Mundform (A, I, U, E und O) und das Blinzeln zeigt. Das meiste ist schon für dich ausgefüllt: **Set by the model** bedeutet, dass das Modell den Standard-VRM-Ausdruck hat, und **Guessed from its name** bedeutet, dass einer seiner eigenen Ausdrücke einen passenden Namen hat. Ein Ausdruck, den das Modell leer gelassen hat, verändert nichts. Er wird deshalb nie für ein anderes Gesicht als Neutral eingetragen (Neutral ist das Modell in Ruhe), und der Import meldet, wenn er einen übersprungen hat. Wähl einen anderen Ausdruck oder **None** (keiner), wann immer eine Vermutung falsch aussieht.
5. Füge optional unter **Idle animation** (Animation im Leerlauf) eine `.vrma`-Datei hinzu, die das Modell abspielt, während es wartet. Ohne sie atmet das Modell und schwankt leicht.

**Replace model** (Modell ersetzen) behält die Idle-Animation, denn VRM-Animationen passen zu jedem VRM-Modell. **Remove model** (Modell entfernen) löscht das Modell und seine Idle-Animation.

Während ein Chat läuft, schaut dich das Modell an, blinzelt von selbst, wenn es einen Blinzel-Ausdruck hat, und neigt den Kopf, während es nachdenkt oder zuhört. Sein Kopf bleibt nahe am oberen Rand seines Platzes: Ein breiter Platz zeigt Kopf und Schultern, ein schmalerer mehr vom Körper. Manche VRM-1.0-Modelle halten den Mund still, während sie ein Gesicht zeigen. Spricht ein solches Modell, erscheint dieses Gesicht nur teilweise, damit sich der Mund trotzdem bewegen kann. Bei reduzierter Bewegung ändern sich Gesicht und Mund weiterhin, aber das Modell hört auf zu schwanken, zu atmen und seine Idle-Animation abzuspielen.

Manche Dateien lassen sich nicht verwenden, und der Import nennt den Grund:

- **Komprimierte Modelle**: Dateien, die mit Draco- oder meshopt-Komprimierung oder mit KTX2-Texturen gespeichert wurden, laden nicht. Exportiere das Modell erneut mit ausgeschalteter Komprimierung.
- **Einfache 3D-Modelle**: Ein `.glb`- oder `.gltf`-Modell ohne VRM-Daten hat keine Gesichtsausdrücke und kein humanoides Skelett. Wandle es zuerst in VRM um, zum Beispiel mit dem VRM Add-on for Blender (siehe [Ein eigenes Modell erstellen](#blender-with-the-vrm-add-on-for-blender)).
- **Unvollständige Modelle**: Ein Modell wird abgelehnt, wenn seinem Skelett Knochen fehlen, die VRM braucht, wenn es auf Teile verweist, die nicht in der Datei sind, oder wenn es auf Dateien außerhalb von sich selbst verweist.

Über das übliche Upload-Limit der App hinaus gibt es kein Größenlimit, aber große Modelle laden länger, besonders auf Handys.

## Wie Gesichter und Münder der Antwort folgen

Avatare reagieren von selbst; für diesen Teil musst du nichts einrichten.

**Gesichter im Roleplay.** Während eine Antwort eintrifft, liest Marinara Engine jeden fertigen Satz und schätzt seine Stimmung ein. Damit das Gesicht nicht flackert, gilt:

- Das Gesicht wechselt nur, wenn die neue Stimmung deutlich stärker ist als die aktuelle.
- Ein Gesicht bleibt mindestens zwei Sekunden.
- Das Gesicht wird erst nach zwei ruhigen Sätzen in Folge wieder ruhig.
- Etwa vier Sekunden nach dem Ende der Antwort entspannt sich das Gesicht wieder.

**So wird die Stimmung gelesen.** Deine Chat-Verbindung wird nicht gefragt. Dein Chat-Text bleibt in deiner eigenen Installation von Marinara Engine und wird nie an einen externen Dienst geschickt.

- Eine eingebaute Wortliste antwortet sofort, überall, und kennt gängige Stimmungswörter in mehreren Sprachen.
- Auf Rechnern, die es ausführen können, liest Marinara Engine die Sätze stattdessen mit einem kleinen Emotionsmodell, der Stimmungserkennung (in der App „Mood reader“). Sie versteht 36 Sprachen. Sie wird einmalig heruntergeladen, etwa 300 MB, wenn du zum ersten Mal einen Roleplay-Chat öffnest, in dem 2D Avatars oder 3D Avatars eingeschaltet ist. Solange beide Agenten aus sind, wird sie nicht heruntergeladen. Die Seite jedes Avatar-Agenten unter **Agents** zeigt den Fortschritt des Downloads, und ein gescheiterter Download startet etwa 10 Minuten später von selbst neu. Bis die Stimmungserkennung bereit ist, antwortet die Wortliste. Nach dem Download funktioniert die Stimmungserkennung offline. Im Einsatz belegt sie etwa 1 GB Arbeitsspeicher, und nach 10 Minuten ohne Nutzung wird sie entladen. Lite-Installationen, Android und Rechner mit weniger als 3 GB Arbeitsspeicher behalten die Wortliste.

**Gesichter im Game Mode.** Jede Zeile, die der Game Master zeigt, bringt einen Ausdruck mit, und der Avatar des sprechenden Charakters übernimmt ihn. Die inneren Gedanken eines Charakters ändern das Gesicht, aber nicht den Mund.

**Die Expression Engine.** Ist sie im Chat eingeschaltet, ist ihre Wahl nach der Antwort das endgültige Gesicht für diese Antwort. Eine Wahl, die erst ankommt, nachdem du deine nächste Nachricht geschickt hast, bleibt bei der Antwort, für die sie gedacht war. Avatare funktionieren auch ohne sie.

**Münder.** Folgt der Mund dem Text, bewegt er sich nur bei Dialog (Wörter in Anführungszeichen, `[Name]:`-Zeilen und Sprecher-Tags), nicht bei Erzählung, und zwar ungefähr im Sprechtempo. Erscheint der Text schneller, als ihn jemand sprechen könnte, wird der Mund schneller und springt dann vor, damit er bei den Wörtern auf dem Bildschirm bleibt. Bei ausgeschaltetem Streaming wird der Dialog einer Antwort innerhalb von acht Sekunden gesprochen. Spielt die Sprachausgabe eine Zeile ab, bewegt stattdessen die Stimme den Mund. Liest die Stimme eines Charakters dessen Erzählung vor, bewegt sich also auch dabei sein Mund.

**Körper.** Vom Moment des Sendens bis zu seinen ersten Worten denkt ein Avatar nach. Er spricht, während sich sein Mund bewegt, hört zu, während jemand anderes spricht oder du tippst, und ruht ansonsten.

**Gruppenchats.** In einem Individual-Gruppenchat spricht das Mitglied, das gerade antwortet, auch wenn du bei der Nachricht eines Mitglieds swipst. In einem Merged-Gruppenchat gehört jeder Absatz dem ersten Charakter, den er nennt, oder sonst dem Charakter des Absatzes davor. Solange ein Absatz, der niemanden nennt, noch erscheint, wartet sein Dialog, bis ein Name oder das Ende des Absatzes zeigt, wer ihn spricht. Bei ausgeschaltetem Streaming bewegt in einem Individual-Gruppenchat vorerst nur die Antwort des letzten Mitglieds einen Avatar.

## Lippensynchronisation mit Sprachausgabe

Liest die Sprachausgabe eine Roleplay-Antwort vor, bewegt der Avatar des sprechenden Charakters seinen Mund mit der Stimme. Bei lauten Lauten öffnet sich der Mund weiter, in Pausen schließt er sich. Er ändert auch seine Form: Bei dunklen Lauten wie „u“ rundet er sich, bei Lauten wie „s“ zeigt er die Zähne. Zusätzlich einrichten musst du nichts. Schalte die Sprachausgabe ein, wie in [Text to Speech (TTS) einrichten](../media/tts-setup.md) beschrieben, dann funktioniert die Lippensynchronisation mit **Auto-play** (automatische Wiedergabe) und mit der Schaltfläche **Speak** (Vorlesen) an einer Nachricht, auch im Visual-Novel-Layout.

- **Wer spricht**: Es bewegt sich der Mund des Charakters, dessen Stimme die Zeile vorliest – also des Charakters, für den **Voice Option** eine Stimme wählt. Hat eine Antwort mehrere Sprecher, bewegt sich der Mund jedes Charakters nur während seiner eigenen Zeilen. Zeilen, die mit der Erzählerstimme gelesen werden, und Sprecher, die keine Charaktere im Chat sind, bewegen keinen Mund. Ist **Only read dialogues** (nur Dialoge vorlesen) aus, wird die eigene Erzählung eines Charakters mit seiner Stimme gelesen, und dann bewegt sich auch dabei sein Mund.
- **Pause, Stopp und Chatwechsel**: Pausierst oder stoppst du die Stimme, stoppt auch der Mund. Wechselst du in einen anderen Chat, während eine Antwort noch vorgelesen wird, bleiben die Avatare dort still. Kehrst du in den ersten Chat zurück, während die Stimme noch läuft, greift sein Avatar die Stimme wieder auf.
- **Lautstärke**: Der Regler **Line volume** (Zeilenlautstärke) ändert, wie laut die Stimme ist, nicht wie weit sich der Mund öffnet.
- **Personas**: Der Mund einer Persona bewegt sich bei deinen eigenen Nachrichten nicht, ob mit oder ohne Sprachausgabe.
- **Game Mode**: Die Erzählung im Game Mode läuft über das eigene Audio des Game Mode. Im Game Mode folgen die Münder der Avatare deshalb vorerst dem Text.

Die Lippensynchronisation ändert nichts daran, wie die Stimme abgespielt wird. Marinara Engine liest eine separate Kopie jedes Sprachclips, um den Mund zu takten. Die Wiedergabe funktioniert also wie bisher, auch in Safari und auf iPhone und iPad. Kann dein Browser einen Clip nicht lesen, läuft die Stimme trotzdem, und nur der Mund folgt ihr nicht mehr.

<a id="making-an-avatar-from-a-sprite"></a>

## Einen Avatar aus einem Sprite erstellen

Wähle auf der Seite **2D Avatars** im Agent-Editor einen Charakter oder eine Persona und nutze dann **Make an avatar from a sprite** (Avatar aus einem Sprite erstellen). Das funktioniert mit den Sprites, die der Charakter oder die Persona bereits hat. Dein Avatar bleibt unverändert, bis du ein Ergebnis speicherst. Du kannst es also so oft versuchen, wie du willst.

### Bilder zum Blinzeln und Sprechen

1. Wähle ein oder mehrere Sprites und dann **Eyes closed** (Augen geschlossen), **Mouth open** (Mund offen) oder beides. Hat der Charakter oder die Persona Porträt-Sprites, werden nur diese angeboten, denn der Avatar mischt nie Porträt- und Ganzkörper-Gesichter.
2. Prüf die **Image connection** (Bildverbindung) – deine Standard-Bildverbindung ist schon ausgewählt – und wähle **Make pictures** (Bilder erstellen). Jedes Bild ist eine Bildanfrage. Ist **Expose media prompts before sending** (Medien-Prompts vor dem Senden anzeigen) in den Einstellungen eingeschaltet, siehst du jeden Prompt vorher und kannst ihn bearbeiten.
3. Die neuen Bilder erscheinen nacheinander. Wähle **Keep** (Behalten) bei denen, die passen, und **Try again** (erneut versuchen) bei den anderen. **Cancel** (Abbrechen) stoppt das Bild, das gerade entsteht. Bilder, die du schon hast, bleiben erhalten, wenn du weitere erstellst: **Make pictures** erstellt nur die fehlenden, und wenn **Try again** scheitert, bleibt das alte Bild. Um ein behaltenes Bild neu zu erstellen, wähle zuerst **Kept**, um es freizugeben.
4. Wähle **Save kept pictures** (behaltene Bilder speichern). Sie werden zu den Bildern zum Blinzeln und Sprechen des PNGTuber-Avatars für diese Ausdrücke, neben einer Kopie des Sprites, aus dem sie gezeichnet wurden, damit sie immer deckungsgleich sind. Hat der Avatar deine Sprites bisher unverändert gezeigt, behält er alle und bekommt die neuen Bilder dazu. Ersetzt du ein Sprite vor dem Speichern, erstelle seine Bilder neu.

Am besten funktionieren Bildmodelle, die Bilder bearbeiten, denn sie bekommen dein Sprite als Referenz. Dein Sprite wird in der Größe und Form gesendet, die das Modell akzeptiert, und danach wieder aus dem Ergebnis ausgeschnitten. Ein Modell, das das Bild an seinem Platz lässt, liefert also deckungsgleiche Bilder. Ändert ein Bild mehr als Augen oder Mund, springt der Avatar beim Blinzeln oder Sprechen; versuch es bei diesem Bild erneut.

### Mesh-Avatar

1. Wähle ein Sprite. Am besten eignet sich ein Brustbild von vorn (Kopf und Schultern); auf einem Ganzkörper-Sprite ist das Gesicht klein.
2. Wähle die **Chat connection that can see pictures** (Chat-Verbindung, die Bilder sehen kann). **The agent's connection** (die Verbindung des Agenten) nutzt die Verbindung, die auf der Seite von 2D Avatars eingestellt ist, und sonst deine Standard-Verbindung für Agenten. Ihr Modell muss Bilder annehmen.
3. Wähle **Make mesh avatar** (Mesh-Avatar erstellen). Das Chat-Modell findet das Gesicht, und Marinara Engine baut den Avatar aus deinem Sprite. **Cancel** stoppt den Vorgang.
4. Prüf die Vorschau: Die Umrisse sollten auf Augen, Brauen und Mund liegen. Wähle **Save as mesh avatar** (als Mesh-Avatar speichern) oder **Discard** (Verwerfen) und versuch es mit einem anderen Sprite oder Modell.

Ein erstellter Mesh-Avatar bewegt Kopf, Augen, Brauen und Mund und blinzelt und spricht mit seinen eigenen Lidern und seinem eigenen Mund. Seine Haare bewegen sich mit dem Kopf; Hände, einzelne Haarsträhnen und herabhängende Accessoires werden nicht animiert. Füllt das Gesicht den größten Teil eines großen Sprites aus, wird der Avatar aus einer kleineren Kopie gebaut, damit die Erstellung schnell bleibt.

Dein Sprite wird für Bilder zum Blinzeln und Sprechen an die Bildverbindung geschickt (und an deren Fallback-Bildverbindung, falls sie scheitert und eine eingestellt ist), für einen Mesh-Avatar an die Chat-Verbindung. Die Prompts bringt der Agent 2D Avatars mit. Ist **Expose media prompts before sending** eingeschaltet, kannst du den Prompt jedes Bildes lesen und ändern, bevor er gesendet wird. Im Debug-Modus wird jeder Prompt ins Server-Log geschrieben.

## Ein eigenes Modell erstellen

Zum Start musst du nichts erstellen. Ein Charakter oder eine Persona mit Ausdrucks-Sprites hat bereits einen PNGTuber-Avatar, und [Einen Avatar aus einem Sprite erstellen](#making-an-avatar-from-a-sprite) ergänzt Bilder zum Blinzeln und Sprechen oder baut einen Mesh-Avatar für dich. Willst du stattdessen ein eigenes Modell erstellen, nutze eines dieser Werkzeuge. Sprites erscheinen, sobald du sie hinzufügst, und jede Datei importierst du auf der Seite des Agenten unter **Agents**.

| Was du willst | Werkzeug | Was du bekommst |
| --- | --- | --- |
| PNGTuber-Sprites | Eine beliebige Zeichen-App, danach der Tab **Sprites** des Charakters | Die Sprites |
| PNGTuber-Sprites mit Ebenen und Kostümen | [PNGTuber Plus](https://github.com/kaiakairos/PNGTuber-Plus) | Eine `.save`-Datei |
| Ein Mesh-Avatar | [Mesh Avatar Studio](https://github.com/shinshin86/mesh-avatar-studio) | Eine `.mavatar`-Datei |
| Ein 3D-Modell | [VRoid Studio](https://vroid.com/en/studio) oder Blender mit dem [VRM Add-on for Blender](https://vrm-addon-for-blender.info/en-us/) | Eine `.vrm`-Datei und optional eine Idle-Animation als `.vrma` |

### Deine eigenen Sprites

1. Zeichne ein Bild für jedes Gefühl, alle gleich groß und mit dem Charakter an derselben Stelle. Benenne jedes nach seinem Gefühl: `neutral`, `happy`, `angry`, `sad`, `relaxed` und `surprised`. Namen, die ein Gefühlswort enthalten, funktionieren auch, etwa `smile`, `cry`, `calm` oder `shock`.
2. Für einen beweglichen Mund zeichne dasselbe Bild, nur mit offenem Mund, und häng `_talk` an seinen Namen an, zum Beispiel `happy_talk`. Fürs Blinzeln schließ nur die Augen und häng `_blink` an; für beides häng `_blink_talk` an. Ein Gefühl ohne diese Bilder hüpft trotzdem, während es spricht.
3. Füge die Bilder im Tab **Sprites** des Charakters oder der Persona unter **Facial Expressions** (Gesichtsausdrücke) hinzu. **Upload Folder** (Ordner hochladen) fügt einen ganzen Ordner hinzu und benennt jedes Sprite nach seiner Datei. Siehe [Charakter-Sprites](../characters/sprites.md).
4. Chats, in denen 2D Avatars eingeschaltet ist, zeigen sie sofort. Wie du das Gesicht für ein Gefühl oder die Bewegung änderst, steht unter [PNGTuber-Sprites](#pngtuber-sprites).

### PNGTuber Plus

1. Bau den Avatar aus getrennten Ebenen auf. Stell den offenen Mund so ein, dass er nur beim Sprechen erscheint, und den geschlossenen Mund nur, wenn der Avatar still ist. Stell die geschlossenen Augen so ein, dass sie nur beim Blinzeln erscheinen, und die offenen Augen nur, wenn der Avatar nicht blinzelt.
2. Leg für jedes Gefühl ein Kostüm an, das die Augen oder den Mund austauscht, und benenne diese Bilder nach dem Gefühl, zum Beispiel `angry eyes.png` oder `happy_mouth.png`. Kostüm 1 ist das Ruhegesicht.
3. Speichere den Avatar, um eine `.save`-Datei zu erhalten.
4. Öffne **2D Avatars** unter **Agents**, wähle den Charakter oder die Persona, dann **PNGTuber sprites** und **Import PNGTuber Plus save**. Wähle ein Gesicht für jedes Gefühl, das die Namen nicht abdecken.

### Mesh Avatar Studio

1. Beginne mit einem Bild von vorn, das Kopf und Schultern zeigt, mit transparentem Hintergrund. Mesh Avatar Studio läuft mit Node.js auf deinem Rechner, und ein Coding-Agent wie Claude Code oder Codex richtet das Bild für die Animation ein. Die README führt dich durch die Schritte.
2. Füge optional unter **Drawn variants** gezeichnete Augen und Münder hinzu. Marinara Engine verwendet die Mundformen (`mouth_a`, `mouth_i`, `mouth_o` und `mouth_a_half`) und die geschlossenen Augen (`eyes_closed_0` und `eyes_closed_1`) von selbst. Jeder Mesh-Avatar hat die sechs Gefühle eingebaut, du musst also nichts benennen.
3. Wähle **Export .mavatar**. Pack den Projektordner nicht selbst als ZIP.
4. Öffne **2D Avatars** unter **Agents**, wähle den Charakter oder die Persona, dann **Mesh avatar** und **Import .mavatar file**.

### VRoid Studio

1. Erstelle den Charakter in VRoid Studio. Seine Gesichter, Mundformen und das Blinzeln sind Standard-VRM-Ausdrücke und werden deshalb automatisch gefunden.
2. Exportiere ihn als VRM. VRM 1.0 und VRM 0.0 funktionieren beide. Trag die Angaben und Bedingungen des Modells ein, wenn VRoid Studio danach fragt.
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
- **Einfaches glTF**: Einer einfachen `.glb`- oder `.gltf`-Datei fehlen die VRM-Daten, die ihre Gesichter und ihr Skelett benennen. Exportiere stattdessen eine `.vrm`-Datei.
- **Getrennte Dateien**: Ein Modell, dessen Texturen oder Daten in getrennten Dateien liegen, lässt sich nicht verwenden. Exportiere eine einzige `.vrm`-Datei.
- **Extras aus PNGTuber Plus**: Wackeln, Nachziehen und Animation werden nicht übernommen. Jede Ebene erscheint in Ruhestellung, und eine animierte Ebene zeigt ihr erstes Einzelbild.

## Leistung und Geräte

Der Zeichencode jedes Avatar-Typs wird erst heruntergeladen, wenn zum ersten Mal ein Avatar dieses Typs erscheint. Chats ohne Avatare laden also nichts zusätzlich.

| | Handys | Desktop-Rechner |
| --- | --- | --- |
| Gleichzeitig gezeichnete Avatare | 2 | 4 |
| Bilder pro Sekunde beim Sprechen | 30 | 30 |
| Bilder pro Sekunde im Leerlauf | 20, oder 15, wenn das Handy ausgelastet ist | 30 |
| Schärfe (Pixelverhältnis) | bis zu 1,5× | bis zu 2× |

Ein Chat zeigt Avatare in der Reihenfolge seiner Charaktere, danach deine Persona, bis zu diesem Limit. Avatare hören ganz auf zu zeichnen, solange der Tab verborgen ist, das Fenster im Hintergrund liegt, die Appearance-Einstellungen offen sind oder der Chat nicht zu sehen oder von einem Panel oder Editor verdeckt ist. Ist **Reduce Ambient Animations & Effects** (Umgebungsanimationen und Effekte reduzieren) oder die Einstellung für reduzierte Bewegung deines Geräts eingeschaltet, wechseln Avatare weiterhin das Gesicht und bewegen den Mund, lassen aber Atmen, Schwanken und die Wartehaltungen weg.

## Verwandte Anleitungen

- [Agenten: KI-Helfer für deine Chats](agents-overview.md)
- [Referenz der herunterladbaren Agenten](built-in-agents.md)
