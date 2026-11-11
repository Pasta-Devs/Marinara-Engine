# Roleplay Mode: Erste Schritte

Roleplay ist der Chat-Modus für Geschichten. Er stellt eine Bühne hinter deine Nachrichten (einen Hintergrund und Charakter-Sprites) und zeigt ein Heads-up-Display (HUD) mit Details zur Geschichte. Ein Agent ist ein Helfer, der neben den Antworten mitläuft, zum Beispiel einer, der das Wetter mitführt oder ein Sprite auswählt.

Nimm Roleplay für eine Szene aus einer Geschichte. Nimm [Conversation](../conversation/getting-started.md) für schlichtes Chatten oder [Game Mode](../game/getting-started.md) für ein strukturiertes Spiel mit Party, Kampf und Würfeln. Ohne Bildgenerierung funktioniert Roleplay als reiner Text-Chat: Die Sprite-Plätze bleiben leer, der Hintergrund ist einfarbig, und das HUD führt die Geschichte trotzdem mit.

## Eine Rollenspielrunde starten

Bevor du anfängst: Leg im Panel **Connections** (Verbindungen) rechts in der App ein Konto an. Siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

1. Klick in der Chat-Seitenleiste auf den Tab **RP**.
2. Klick oben in der Seitenleiste auf die Schaltfläche **+**. Ihr Tooltip lautet **New Roleplay**.

Der Chat öffnet sich mit **Chat Settings** (Chat-Einstellungen) und einem Einrichtungsassistenten mit fünf Schritten. Nur das Konto ist Pflicht. Alles lässt sich später ändern.

1. **Name & Connection** (Name und Verbindung). Benenne die Rollenspielrunde (optional) und wähle die Verbindung, die antwortet.
2. **Pick a Preset** (Preset wählen). Ein Preset legt den Aufbau des Prompts und die Werte für die Generierung fest. Für die meisten Chats passt das Standard-Preset.
3. **Persona & Characters** (Persona und Charaktere). Wähle deine Persona und die Charaktere in der Szene. In diesem Schritt kann dir eine Schaltfläche namens **Create your persona** (deine Persona erstellen) anhand einiger Fragen eine Persona bauen. Siehe [Interaktives Onboarding](../characters/interactive-onboarding.md).
4. **Attach Lorebooks** (Lorebooks anhängen). Ein Lorebook ist eine Sammlung von Weltwissen, die die KI liest, sobald die passenden Schlüsselwörter auftauchen. Optional.
5. **Enable Agents** (Agenten aktivieren). Wähle, welche Agenten in diesem Chat laufen. Ändern kannst du das später unter **Chat Settings → Agents**.

Danach siehst du den Chat mit einem Nachrichtenfeld. Tipp deine erste Nachricht ein und schick sie ab.

## Die Bühne: Hintergrund, Sprites und HUD

- **Hintergrund**: ein Bild über die ganze Szene hinter deinen Nachrichten, das bei einem Wechsel weich überblendet. Der Agent **Background** kann in jedem Zug eines auswählen, oder du legst pro Chat einen festen Hintergrund fest. Siehe [Roleplay-Hintergründe](backgrounds.md).
- **Sprites**: Charakterbilder auf der Bühne. Jeder Charakter mit aktivierten Sprites kann erscheinen. Ein Charakter braucht eine Sprite-Bibliothek auf seiner Karte, sonst bleibt sein Platz leer. Siehe [Charakter-Sprites](../characters/sprites.md).
- **HUD**: deine Tracker (Datum, Uhrzeit, Wetter, Ort, wer anwesend ist, Inventar, Quests, Werte). Schalte sie unter **Chat Settings → Agents** ein. Siehe [Roleplay-HUD und Tracker](hud-and-trackers.md).

### Steuerung der Sprite-Darstellung

Öffne **Chat Settings** (die Schieberegler-Schaltfläche im Chat), geh zu **Agents** und such die Karte **Expression Engine**. Das ist der Agent, der die Gesichtsausdrücke der Sprites auswählt. Diese Steuerelemente erscheinen, sobald mindestens ein Charakter Sprites aktiviert hat.

| Steuerelement | Was es bewirkt |
| --- | --- |
| **Sprite Source** (Sprite-Quelle) | Wähle **Expressions**, **Full-body** oder beides. Eins muss aktiv bleiben. |
| **Expression Size**, **Full-body Size** | Legt fest, wie groß jede Art von Sprite ist. |
| **Expression Opacity**, **Full-body Opacity** | Legt fest, wie durchsichtig jede Art ist. |
| **Default Side** (Standardseite) | **Left** oder **Right**: die Seite, auf der neue Sprites starten. |
| **Expression Avatars** | Ist es an, zeigen die Avatare an den Nachrichten das aktuelle Gesichtsausdruck-Sprite des Charakters. |

Die vier Regler für Größe und Durchsichtigkeit werden nur in diesem Browser gespeichert. Sie werden nicht mit anderen Geräten synchronisiert.

So verschiebst du Sprites von Hand:

1. Klick auf **Arrange** (Anordnen), die Schaltfläche auf der Szene. Sie wird zu **Done** (Fertig).
2. Zieh ein Sprite und klick dann zur Bestätigung auf den kleinen Haken darüber.
3. Klick zum Abschluss auf **Done**. **Reset** (Zurücksetzen) verwirft alle eigenen Platzierungen.

Um einen Gesichtsausdruck per Eingabe zu setzen, schick `/emote happy` für die Szene oder `/emote "Aria" angry` für einen einzelnen Charakter. Schick `/emote` allein, um die Gesichtsausdrücke jedes Charakters aufzulisten.

Wenn es nicht funktioniert hat: Sprites brauchen eine hochgeladene Sprite-Bibliothek am Charakter. Ohne sie läuft der Agent für Gesichtsausdrücke zwar, hat aber nichts zum Anzeigen.

## Die Chat-Tools

Die Tools des Chats (Suche, Verzweigungen, Zusammenfassung, aktiver Kontext, Agent activity, Author's Notes, Gallery) sind Abschnitte von **Chat Settings**. Öffne die Einstellungen über die Schieberegler-Schaltfläche im Chat. Was jedes Tool tut, steht unter [Chat Settings](../chats/chat-settings.md); siehe auch [Einen Abschnitt in einem eigenen Fenster öffnen](../chats/chat-settings.md#popping-a-section-out-into-its-own-window).

<a id="authors-notes"></a>

### Author's Notes

**Author's Notes** (Autorennotizen) ist eine Notiz, die die KI bei jeder Antwort mitliest. Nutze sie für einen dauerhaften Hinweis, etwa eine Regel zum Tonfall oder eine verborgene Tatsache.

1. Öffne **Chat Settings** und klapp unter **Agents** den Abschnitt **Author's Notes** auf.
2. Schreib deine Notiz, zum Beispiel: „Halte den Ton düster und spannungsgeladen.“
3. Lass **Injection Depth** (Einfügetiefe) unverändert, wenn du unsicher bist. Der Wert legt fest, wo die Notiz im Chat sitzt: 0 steht hinter der neuesten Nachricht, 4 liegt vier Nachrichten vor dem Ende.

Für eine längere Notiz ziehst du am Computer an der unteren Ecke des Felds. Author's Notes funktioniert in Game Mode und Conversation Mode genauso.

<a id="agent-activity"></a>

## Agent activity

**Agent activity** (Agentenaktivität) zeigt, was die Agenten des Chats getan haben. Der Abschnitt erscheint, sobald der Chat Agenten oder Advanced Memory nutzt. Du findest ihn als eigenen Abschnitt direkt unter **Agents** in **Chat Settings**, unten im Tracker Panel und am Computer unten im Trackers-Fenster.

- Tab **Activity** (Aktivität): die Ausgaben, die Agenten gespeichert haben, die sogenannten Gedankenblasen. Blende eine aus oder nutze **Clear all** (alle löschen). Auch die Ausgaben eigener Agenten erscheinen hier.
- Während Agenten arbeiten, wird das Symbol des Abschnitts zu einem drehenden Ladesymbol. Scheitert ein Agent, erscheint ein Punkt auf dem Symbol, bis du den Abschnitt öffnest.
- Gescheiterte Agenten stehen in einer Liste mit einer Schaltfläche zum erneuten Versuch. Du kannst auch laufende Agenten stoppen, die Tracker neu ausführen und **Clear Trackers** (Tracker leeren) nutzen.
- Tab **Injections**: erscheint nur, wenn unter **Settings → Advanced** (Einstellungen → Erweitert) der **Debug mode** (Debug-Modus) an ist. Er listet die Prompt-Schnipsel, die schreibende Agenten vor der letzten Antwort gespeichert haben. Zu diesen Agenten zählen **Prose Guardian**, der Antworten an deine Stilregeln anpasst, und der **Narrative Director**, der die Handlung lenkt. Du kannst einen Schnipsel ansehen, bearbeiten und erneut ausführen. Eine Bearbeitung ändert nur, was beim erneuten Generieren derselben Antwort verwendet wird, damit das Neugenerieren wiederholbar bleibt. Die Antwort auf dem Bildschirm ändert sie nicht.

Alle Agenten stellt [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md) vor. Zum Agenten, der die Geschichte lenkt, siehe [Narrative Director und Secret Plot](narrative-director.md).

## Kampf und Szenen

- Roleplay bringt eine schlanke Kampfebene mit. Füg den Agenten Combat hinzu und klick dann über dem Nachrichtenfeld auf **Encounter** (Begegnung). Siehe [Kampfbegegnungen (Roleplay)](combat-encounters.md).
- Eine Szene ist eine Nebenverzweigung für eine Rückblende oder einen Nebenschauplatz. Siehe [Szenen: Ein Roleplay verzweigen](scenes.md).
- Wie du die Handlung lenkst, steht unter [Narrative Director und Secret Plot](narrative-director.md).
- Wie du nach Tischregeln spielst, mit Würfelproben und Charakterbögen, steht unter [Roleplay: Mit einem Regelsatz spielen](rulesets.md).

## Modelle auswählen

Deine Chat-Verbindung schreibt die Prosa der Charaktere. Ein stärkeres Modell hält den Tonfall eines Charakters über lange Szenen hinweg stabil. Deine Agent-Verbindungen erledigen kleine, strukturierte Aufgaben, etwa den Zustand auslesen oder einen Gesichtsausdruck wählen, und kleine Modelle machen dabei leicht Fehler. Viele lassen den Chat auf einem starken Modell laufen und die Agenten auf einem schnellen, günstigen. Liegen HUD-Werte oder Sprites immer wieder daneben, stell die Agenten auf ein stärkeres Modell um. Zu den Sampler-Einstellungen siehe [Generierungsparameter](../prompts/generation-parameters.md).

## Befehle

Diese Funktionen sind optional. Befehle sind Aktionen, die ein Charakter von sich aus ausführen kann. Er schreibt sie als kurzen Text in eckigen Klammern in seine Antwort, etwa `[illustrate: ...]`. Marinara liest die Klammer, führt die Aktion aus und blendet die Klammer in der Nachricht aus.

### Einen Befehl einschalten

1. Öffne **Chat Settings → Agents** und klapp **Commands** (Befehle) auf.
2. Schalte oben den Schalter **Commands** ein. Jeder Befehl darin ist anfangs aus.
3. Schalte die Befehle ein, die du willst. Ein ausgegrauter Befehl zeigt an, was ihm noch fehlt.

- **Illustrations** (Illustrationen), **Video clips** (Videoclips): Füg diesem Chat den Agenten Illustrator hinzu.
- **Combat** (Kampf): Füg diesem Chat den Agenten Combat hinzu.
- **Soundtrack**: Füg den Agenten Music DJ hinzu und schalte Agenten ein.
- **Personal Notes** (persönliche Notizen), **Reminders** (Merkzettel), **Whisper** (Flüstern): Nutze einen Einzelchat oder einen Gruppenchat mit der Generierung **Individual** (einzeln).
- **Sound Cues** (Sound-Cues): Wähl eine Verbindung für Music & Sound Effects, bei der Soundeffekte an sind.
- **Documents** (Dokumente), **HTML Artifacts** (HTML-Artefakte), **Rolls** (Würfe), **Direct Messages** (Direktnachrichten), **Interruptions** (Unterbrechungen): nichts weiter.

Bei **Rolls**, **Combat**, **Documents** und **Whisper** legst du außerdem fest, wer sie nutzen darf: **All** (alle) Charaktere oder nur der **Narrator** (Erzähler). Der Erzähler ist der Charakter, den du unter **Narrator character** (Erzählercharakter) wählst. Er kann Befehle nutzen, die nur dem Erzähler vorbehalten sind, und die Notizen, Merkzettel und Flüsternachrichten aller lesen.

Wenn es nicht funktioniert hat: Einem ausgegrauten Befehl fehlt sein Agent oder die passende Chat-Art. Lies die Zeile unter seinem Schalter.

### Illustrationen

Bevor du anfängst: Füg dem Chat den Agenten Illustrator hinzu und schalte **Illustrations** ein.

Ein Charakter kann jetzt mit `[illustrate: subject="..." characters="..."]` ein Bild anfordern. Das Bild nutzt die Illustrator-Einstellungen des Chats und erscheint unter der Nachricht.

Schalte **Render in-line** (in der Nachricht anzeigen) ein, damit jedes Bild innerhalb der Nachricht erscheint, an der Stelle, an der der Charakter den Befehl geschrieben hat. Wähl ein Bild aus, um seinen Prompt zu sehen, oder entferne es mit **X**. Die Einstellung gilt nur für neue Bilder. Bilder, die der Agent Illustrator von sich aus erstellt, und das Visual-Novel-Layout ändern sich nicht.

Du kannst eine Illustration auch selbst mit `/illustrate` erstellen. In Roleplay braucht das den Agenten Illustrator.

<a id="artifacts-on-demand"></a>

### Artefakte auf Abruf

Schalte **HTML Artifacts** ein, damit der Erzähler ein einzelnes Objekt aus der Spielwelt erstellen kann, etwa eine Seite aus einem Zauberbuch, ein Schild, eine Skizze auf einem Brief oder eine Terminalausgabe. Der Befehl lautet `[html: prompt="..."]`. Er braucht keinen Agenten. Du kannst auch selbst ein Artefakt mit `/html <what you want>` anfordern.

Das Artefakt erscheint, sobald die Antwort fertig ist, an der Stelle, an der der Erzähler den Befehl platziert hat. Im Visual-Novel-Layout siehst du nur eine Markierung. Eine Antwort kann höchstens 3 Artefakte erstellen, und jedes ist eine eigene Anfrage an das Modell. Die Anfrage nutzt die Verbindung des Agenten **Immersive HTML**, falls er eine hat, sonst deine Standardverbindung für Agenten, sonst die Verbindung des Chats. Wie viele gleichzeitig laufen, legt die Einstellung **Parallel requests** (parallele Anfragen) dieser Verbindung im Konto-Editor fest. Für eine schlicht gestaltete Seite sind die eingebauten Arten unter **Documents** kostenlos und sofort verfügbar.

Der Erzähler sieht das HTML des Artefakts nicht. In späteren Zügen sieht er eine kurze Fassung als reinen Text: den lesbaren Text des Artefakts und eine Zeile dazu, wie es aussieht. Öffne die Markierung „used html command“ unter der Nachricht, um diesen Text zu lesen oder zu bearbeiten oder um das Artefakt zu löschen; das entfernt es auch aus dem Gedächtnis des Erzählers. Schlägt ein Durchlauf fehl, nennt die Markierung den Grund.

<a id="whispers-and-secrets"></a>

### Flüstern und Geheimnisse

Schalte **Whisper** für private Bemerkungen, Geheimnisse und Visionen innerhalb einer Antwort ein. Der Befehl lautet `[whisper: character="name" text="the secret"]`. Nenne genau einen Charakter im Chat oder deine Persona. Nur dieser Charakter und der Erzähler erhalten den Text in ihren Prompts. Ein unbekannter oder mehrdeutiger Name wird ignoriert, damit das Geheimnis nicht durchsickert.

- **Reveal a secret** (Geheimnis aufdecken) zeigt eine Flüsternachricht auf deinem Bildschirm. Das ändert nur, was du siehst, nicht, was Charaktere wissen. Flüsternachrichten an deine Persona sind sofort sichtbar.
- Mit **Edit whisper** (Flüsternachricht bearbeiten) änderst du den Text; danach wählst du **Save** (Speichern). Um eine Flüsternachricht zu entfernen, leere ihren Text und wähle **Save**. **Cancel** (Abbrechen) lässt sie, wie sie war.
- Du kannst eine Flüsternachricht in deine eigene Nachricht schreiben, um einem Charakter etwas zuzuflüstern. Dieselbe Klammer funktioniert, wenn du die Nachricht eines Charakters oder des Erzählers bearbeitest. Der Text darf sich über mehrere Zeilen ziehen und Anführungszeichen behalten, etwa `text=""I love you.""`.
- Eine Nachricht, die nur eine Flüsternachricht enthält, bleibt vor den Charakteren verborgen, die sie nicht erreicht.
- Verbirgst du eine Nachricht mit **Hide from AI** (vor der KI verbergen) vor einigen Charakteren, erhält der Empfänger der Flüsternachricht sie trotzdem, aber nichts vom Rest der Nachricht.

Auch Agenten können Flüsternachrichten lesen:

- Diese Agenten lesen sie: Echo Chamber, Tracker, Lorebook Keeper und Long-Term Memory. In Gruppenchats liest sie auch die Antwortreihenfolge **Smart**, sodass eine Flüsternachricht dazu führen kann, dass gerade dieser Charakter als Nächster antwortet.
- Jede Flüsternachricht ist als privat gekennzeichnet und nennt ihren Empfänger. Was ein Agent daraus schreibt, etwa einen Lorebook-Eintrag oder eine Tracker-Notiz, kann trotzdem andere Charaktere erreichen.
- In einem gehosteten Raum im Mehrspielermodus erhalten Agenten und die Antwortreihenfolge **Smart** keine Flüsternachrichten.
- Relationship Tracker und Memory Nag lesen den Chat selbst und sehen Flüsternachrichten noch nicht.

<a id="your-private-notes"></a>

### Deine privaten Notizen

Schalte **Personal Notes** ein und schreib dann `[notes: content="your private note"]` in deine eigene Nachricht. Nur der Erzähler erhält diese Notizen, nicht andere Charaktere oder gemeinsame Agenten. Über die Befehlsdetails der Nachricht bearbeitest oder löschst du eine. Wird ein Charakter deaktiviert oder aus der Gruppe entfernt, erhält der Erzähler die Notizen dieses Charakters nicht mehr. Schaltest du den Charakter wieder ein, stehen sie wieder zur Verfügung.

Du kannst auch eine Notiz zu einer einzelnen Nachricht speichern:

1. Wähle unter der Nachricht **Bookmark, pin or note** (Lesezeichen, anheften oder Notiz).
2. Schreib eine **Private note** (private Notiz). Standardmäßig bleibt sie privat und wird nicht an das Modell gesendet.
3. Um sie mit dem Modell zu teilen, schalte **Show the note to the narrator character** (Notiz dem Erzählercharakter zeigen) ein und wähle einen Charakter. Nur dieser Charakter erhält die Notiz, und zwar direkt bei dieser Nachricht. Zum Teilen brauchst du einen Einzelchat oder die Gruppengenerierung **Individual**.

**Remove note** (Notiz entfernen) beendet auch das Teilen.

<a id="video-clips"></a>

### Videoclips

Bevor du anfängst: Füg dem Chat den Agenten Illustrator hinzu und wähle unter **Scene Videos** (Szenenvideos) des Illustrators eine Videoverbindung.

Schalte **Video clips** ein, damit Charaktere mit `[video: subject="the moment" motion="what moves and how the camera moves" characters="names"]` einen kurzen Clip eines wichtigen Moments anfordern können. Das Modell wird angewiesen, das gegenüber `[illustrate]` zu bevorzugen, wenn es in dem Moment um Bewegung geht. Der Clip beginnt mit dem Bild, das Illustrators Einstellung **First frame** (Startbild) festlegt: ein neues Illustrator-Bild, der Avatar oder das Sprite des Charakters oder keines. Sobald er fertig ist, wird er in der Antwort abgespielt. Ein Clip wird nur angeboten, solange **Video Run Interval** (Video-Laufintervall) es zulässt, und er zählt zu **Videos per reply** (Videos pro Antwort).

### Unterbrechungen durch Charaktere

Schalte **Interruptions** ein, damit ein Charakter die letzte Nachricht abbrechen kann, wenn eine Unterbrechung passt. Der Befehl lautet `[interrupt: part="a verbatim phrase of at least three words"]`. Marinara sucht diese Phrase in der Nachricht unmittelbar vor der Antwort, behält den Text bis zu dieser Phrase und beendet ihn mit einem Gedankenstrich. Dialog behält sein schließendes Anführungszeichen. Fehlt die Phrase oder passt sie an zwei Stellen, bleibt die Nachricht, wie sie ist.

Um das Original zurückzuholen, öffne die Befehlsinformationen der Antwort und wähle **Restore original message** (Originalnachricht wiederherstellen). Eine Neugenerierung stellt zuerst das vollständige Original wieder her, damit die neue Antwort neu entscheiden kann. Wählst du einen vorhandenen Swipe (eine alternative Antwort), wird dessen Unterbrechung angewendet, sofern du sie nicht wiederhergestellt hast. Deine späteren manuellen Änderungen bleiben erhalten.

## Echo Chamber

**Echo Chamber** ist ein optionaler Agent, der ein Live-Publikum hinzufügt, das auf deine Szene reagiert, wie ein Streaming-Chat, der in festen Zeitabständen eine neue Reaktion postet. Schalte ihn unter **Chat Settings → Agents** auf der Karte **Echo Chamber** ein.

- Am Computer verschiebst du das Fenster an seiner Titelleiste und änderst seine Größe an einem Rand. Hefte es an, damit es offen bleibt. **X** verkleinert es zu einer verschiebbaren Schaltfläche.
- Am Telefon startet Echo Chamber als kompaktes Fenster über den Nachrichten. Zieh seine Titelleiste, um es zu verschieben, oder eine Kante oder Ecke, um seine Größe zu ändern. Anheften hält es offen, wenn du woanders tippst, und Sperren verhindert versehentliches Verschieben.
- Echo Chamber folgt deinem **Chat widget style** (Chat-Widget-Stil) unter **Settings → Appearance → App** (Einstellungen → Darstellung → App). Jeder Chat merkt sich sein Layout.

## CYOA-Auswahlmöglichkeiten

CYOA steht für Choose Your Own Adventure, also „Wähle dein eigenes Abenteuer“. Der Agent CYOA Choices ist standardmäßig aus und funktioniert nur in Roleplay. Ist er an, ergänzt er nach einer Antwort anklickbare Auswahl-Schaltflächen, und ein Klick auf eine davon schickt sie als deine nächste Nachricht ab. Willst du Auswahlmöglichkeiten kombinieren oder eine vorher bearbeiten, schalte unter **Settings → General → Input & Editing** die Einstellung **Add CYOA choices to the message box instead of sending them** (CYOA-Auswahlmöglichkeiten ins Nachrichtenfeld einfügen, statt sie abzuschicken) ein. Ein Klick auf eine Auswahl fügt ihren Text dann in dein Nachrichtenfeld ein.

## Fehlerbehebung

| Symptom | Lösung |
| --- | --- |
| Ein HUD-Wert ist falsch. | Bearbeite ihn von Hand und sperre ihn, damit der nächste Durchlauf ihn in Ruhe lässt. Siehe [Roleplay-HUD und Tracker](hud-and-trackers.md). Driften die Werte immer wieder ab, nimm ein stärkeres Modell für die Agenten. |
| Sprites ändern sich nicht. | Prüf, ob der Charakter eine Sprite-Bibliothek hat. Du kannst auch `/emote` nutzen. |
| Der Hintergrund wechselt nie. | Der Agent **Background** wählt aus deiner Bibliothek aus, also füg weitere Hintergründe hinzu. Siehe [Roleplay-Hintergründe](backgrounds.md). |
| Eine neu generierte Antwort schlägt weiter die falsche Richtung ein. | Schalte **Debug mode** ein, öffne **Agent activity → Injections** und bearbeite oder wiederhole den gespeicherten Schnipsel, bevor du neu generierst. |

Weitere Hilfe bietet [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

## Verwandte Anleitungen

- [Roleplay-Hintergründe](backgrounds.md)
- [Roleplay-HUD und Tracker](hud-and-trackers.md)
- [Kampfbegegnungen (Roleplay)](combat-encounters.md)
- [Narrative Director und Secret Plot](narrative-director.md)
- [Roleplay: Mit einem Regelsatz spielen](rulesets.md)
- [Szenen: Ein Roleplay verzweigen](scenes.md)
- [Charakter-Sprites](../characters/sprites.md)
- [Eine Conversation mit einem Roleplay oder Game verknüpfen](../chats/connected-chats.md)
- [Makros](../prompts/macros.md)
