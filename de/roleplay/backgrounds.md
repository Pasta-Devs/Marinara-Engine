# Hintergründe im Roleplay

Ein Roleplay-Chat zeigt hinter deinen Nachrichten ein bildfüllendes Szenenbild. Du kannst es nach jeder Antwort vom Agenten **Background** (Hintergrund) aussuchen lassen, von Hand ein neues erstellen oder ein Bild fest an einen einzelnen Chat binden. Wechselt das Bild, blendet Marinara vom alten zum neuen über.

Bildgenerierung brauchst du dafür nicht. Ohne Konto für die Bildgenerierung ist der Hintergrund eine einfarbige Fläche, und der Chat läuft als Text.

## Einen Hintergrund für einen einzelnen Chat festlegen

So behältst du ein bestimmtes Bild hinter dem gerade geöffneten Chat, statt den Agenten wählen zu lassen. Das ändert nur diesen Chat.

1. Öffne den Chat. Öffne dann **Settings → Appearance** (Einstellungen → Darstellung) und such den Bereich **Backgrounds** (Hintergründe).
2. Wähle unter **Chat Background** (Chat-Hintergrund) ein hochgeladenes Bild oder einen deiner Hintergründe aus den Spiel-Assets.

Das Bild erscheint hinter deinen Nachrichten. Um zum Standard zurückzukehren, klick auf **Remove** (Entfernen) neben **Chat Background**.

Noch keine Bilder? Lade zuerst eins hoch. Siehe [Chat-Hintergründe](../appearance/chat-backgrounds.md).

## Den Hintergrund vom Agenten Background aussuchen lassen

Der Agent **Background** ist ein Helfer, der neben den Antworten mitläuft. Nach jeder Antwort liest er die aktuelle Szene und wählt aus all deinen Hintergründen das Bild, das am besten passt. Er wählt nur vorhandene Bilder aus. Neue erstellt automatisch der Agent **Illustrator**.

1. Öffne deinen Roleplay-Chat.
2. Öffne **Chat Settings** (Chat-Einstellungen) über die Schieberegler-Schaltfläche im Chat.
3. Öffne **Agents** (Agenten) und schalte **Enable Agents** (Agenten aktivieren) ein.
4. Füge den Agenten **Background** hinzu.

Der Hintergrund ändert sich jetzt von allein, wenn die Geschichte von Ort zu Ort zieht.

Wenn es nicht funktioniert hat: Hast du nur ein oder zwei Hintergründe, wählt der Agent immer wieder diese. Füge deiner Bibliothek weitere hinzu. Siehe [Chat-Hintergründe](../appearance/chat-backgrounds.md).

## Vorhandene Bilder wiederverwenden

Wenn Illustrator selbstständig Hintergründe erstellt und die Geschichte an einen neuen Ort zieht, prüft er zuerst, ob du ein Hintergrundbild an diesen Ort gebunden hast (siehe [Einen Hintergrund an einen Ort binden](#pin-a-background-to-a-place)). An einem solchen Ort zeichnet er nichts. Andernfalls sucht er in deiner Hintergrundbibliothek. Ein Bild passt zu einem Ort, wenn sein Dateiname oder eines seiner Tags mit mindestens zwei Wörtern im Ort von World State vorkommt. Zum Beispiel passt `john-bedroom.png` zu „Smith House, John's bedroom“. Groß- und Kleinschreibung, Akzente und „'s“ spielen keine Rolle, und der genaueste Name gewinnt gegenüber einem schlichten `bedroom.png`.

Ohne Ortsangabe von World State wird der Ortsname, den Illustrator für den neuen Hintergrund schreibt, auf dieselbe Weise abgeglichen. Passt ein Bild, wird es angezeigt und nichts gezeichnet. Nur für einen Ort ohne passenden Treffer entsteht ein neues Bild.

Damit ein Ort sein Bild behält, benenne die Datei nach dem Ort (`kitchen.png` für „Kitchen“). Ein Tag funktioniert ebenfalls, wenn es mindestens zwei Wörter hat, etwa `smith house kitchen`. Einwort-Tags wie `kitchen` oder `night` werden ignoriert, weil sie meist beschreiben, wie ein Bild aussieht.

## Einen Hintergrund von Hand generieren

Marinara baut aus der Szene einen Bild-Prompt (aus Genre, Setting, Ort, Wetter und Uhrzeit) und erstellt daraus einen neuen Hintergrund.

Bevor du anfängst: Installiere den Agenten **Illustrator** und leg für ihn ein Konto für die Bildgenerierung fest, oder markiere ein Konto für die Bildgenerierung als Standard. Siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md). Dem Chat hinzufügen musst du Illustrator nicht.

1. Öffne **Chat Settings** über die Schieberegler-Schaltfläche im Chat und klapp **Gallery** (Galerie) auf.
2. Klick auf **Background**. Während der Arbeit zeigt die Schaltfläche **Generating...**, und in der Gallery steht „Illustrator is generating a background image for this scene.“
3. Warte, bis sie fertig ist. Das neue Bild landet in deiner Hintergrund-Bibliothek und wird auf die Szene angewendet.

Die Generierung von Hand nutzt das Bildkonto des Agenten Illustrator, ersatzweise dein Standard-Konto für die Bildgenerierung. Sie funktioniert in den Modi Roleplay und Game, nicht in Conversation.

Wenn es nicht funktioniert hat: Die Meldung „Choose an image generation connection for the Illustrator agent, or mark one as the default image connection.“ bedeutet, dass Marinara kein Bildkonto gefunden hat. Leg eins fest und versuch es dann noch einmal. Fehlt die Schaltfläche **Background**, ist Illustrator nicht installiert.

## Einen Hintergrund an einen Ort binden

Nutze das, wenn ein Ort in deiner Geschichte immer gleich aussehen soll: Johns Schlafzimmer zeigt immer `john-bedroom`, dein eigenes Schlafzimmer immer `my-bedroom`. Kommt die Geschichte an einen Ort mit festgelegtem Hintergrund, erscheint dessen Bild, unabhängig davon, was der Agent Background ausgewählt hätte.

1. Öffne **Chat-Einstellungen** über die Schieberegler-Schaltfläche im Chat und öffne **Hintergrund**.
2. Klick unter **Angeheftete Orte** auf **Ort hinzufügen**.
3. Klick auf das leere Bild und wähle den Hintergrund. Gib den Ort so ein, wie er in der Geschichte geschrieben wird, etwa `John's bedroom`.
4. Optional: Füge darunter weitere Namen hinzu, die die Geschichte verwenden könnte, durch Kommas getrennt, etwa `John's room, the master bedroom`.

Schneller geht es so: Wenn die Geschichte gerade an einem Ort spielt und das richtige Bild angezeigt wird, klick auf **Dieses Bild an „John's bedroom“ anheften**.

So werden Orte unterschieden:

- Der genaueste Name gewinnt. `John's bedroom` und `{{user}}'s bedroom` werden nie verwechselt, und eine Zuordnung mit dem schlichten Namen `bedroom` greift nur bei Schlafzimmern, für die niemand einen Hintergrund festgelegt hat.
- Ein oder zwei Wörter dazwischen sind erlaubt: „John's guest bedroom“ passt zu `John's bedroom`, sofern keine andere Zuordnung genau diesen Ort benennt.
- `{{user}}` steht für den Namen deiner Persona und `{{char}}` für jeden Charakter im Chat. Deshalb passt `{{user}}'s bedroom` zu „Alyssa's bedroom“.
- „Mein“ und „unser“ beziehen sich auf den Verfasser der Nachricht. Steht in Johns Antwort, dass die Geschichte in „meinem Schlafzimmer“ spielt, ist Johns Schlafzimmer gemeint; „dein Schlafzimmer“ in seiner Antwort ist deines. In deiner eigenen Nachricht meint „dein Schlafzimmer“ das des Charakters, wenn nur einer im Chat ist.
- Groß- und Kleinschreibung, Akzente und Apostrophe spielen keine Rolle. Namen werden nur als ganze Wörter erkannt: `John` passt nie zu „Johnson“.
- Mit **World Maps** wählst du den Ort stattdessen aus der Liste **Ort in World Maps**. Ein für ein Gebäude festgelegter Hintergrund gilt auch für dessen Räume, sofern sie keine eigene Zuordnung haben.

Was passiert:

- Das Bild wird bei der Ankunft einmal angezeigt. Wählst du vor Ort von Hand einen anderen Hintergrund, bleibt deine Auswahl bestehen, bis die Geschichte weiterzieht.
- An einem Ort mit festgelegtem Hintergrund kann der Agent Background das Bild nicht wechseln, und Illustrator zeichnet keinen neuen Hintergrund dafür.
- Dafür wird die Ortsangabe des Agenten **World State** (oder World Maps) benötigt. Unter der Liste siehst du, wo die Geschichte gerade spielt; **Hier** markiert die verwendete Zuordnung. Zuordnungen funktionieren in Roleplay-Chats.

Wenn es nicht klappt: Prüfe, ob **Die Geschichte spielt in** unter der Liste den Ort anzeigt und ob einer der Namen der Zuordnung darin vorkommt.

### Hintergründe, die einen Charakter begleiten

Ein als Hintergrund markiertes Bild in der **Galerie** eines Charakters (oder einer Persona) erscheint in jedem Chat mit diesem Charakter. Du musst es nicht in jedem Chat einzeln einem Ort zuordnen.

1. Öffne die **Galerie** des Charakters, klick bei einem Bild auf die Tag-Schaltfläche und wähle **Als Hintergrund verwenden**.
2. Gib die dargestellten Orte durch Kommas getrennt ein, etwa `{{char}}'s bedroom, {{char}}'s room`. In der Galerie eines Charakters steht `{{char}}` für diesen Charakter; in der einer Persona steht `{{user}}` für diese Persona. Lass das Feld leer, wenn das Bild keinen bestimmten Ort darstellt.

Bilder mit Ortsnamen funktionieren in jedem Chat mit diesem Charakter wie festgelegte Hintergründe für Orte. Sie stehen unter **Angeheftete Orte** in **Chat-Einstellungen → Hintergrund**. Eine Zuordnung, die du direkt im Chat festlegst, hat Vorrang vor einem Galeriebild mit demselben Namen.

## Deine Bibliothek und Unschärfe

Die Bilder, aus denen du wählst, liegen im selben Bereich **Backgrounds**. Alles zum Importieren, zu Tags, zum Umbenennen und Löschen, zum Regler **Background Blur** (Hintergrundunschärfe) und zum Standard-Hintergrund für neue Roleplay-Chats steht in [Chat-Hintergründe](../appearance/chat-backgrounds.md).

## Verwandte Anleitungen

- [Chat-Hintergründe](../appearance/chat-backgrounds.md): die Upload-Bibliothek und die Darstellungs-Einstellungen.
- [Szenen-Hintergründe](../media/scene-backgrounds.md): KI-Szenenbilder aus deiner Gallery.
- [Roleplay Mode: Erste Schritte](getting-started.md): die Roleplay-Bühne, Sprites und das HUD.
