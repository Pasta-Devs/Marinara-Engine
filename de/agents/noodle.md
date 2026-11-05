# Noodle: die Social-Timeline in der App

Noodle ist ein optionaler, nachgebauter Social-Media-Feed in Marinara Engine. Optisch erinnert die Timeline an Twitter oder X, aber alle Konten und Beiträge stammen aus deiner eigenen Welt: von deiner Persona, deinen Charakteren und Professor Mari. In dieser Anleitung erfährst du, wie du Noodle installierst und öffnest und wie du Beiträge schreibst, Konten folgst und die Timeline aktualisierst.

## Was Noodle ist

Noodle ist ein erfundener Feed innerhalb der App. Er verbindet sich mit keinem echten sozialen Netzwerk, und nichts, was du darin tust, landet im Internet.

Jedes Konto gehört zu deiner App:

- Deine **Persona**, also der Charakter, der dich im Chat vertritt. Siehe [Personas](../characters/personas.md).
- Beliebige Charaktere, die du aus deiner Bibliothek einlädst.
- **Professor Mari**, die eingebaute Assistentin. Siehe [Professor Mari](../home/professor-mari.md).
- Eine kleine Auswahl eingebauter Konten für „zufällige Nutzer“, wenn du sie einschaltest.

Beiträge schreibst du selbst als deine Persona. Du kannst auch auf **Refresh timeline** (Timeline aktualisieren) klicken. Dann schreibt ein KI-Modell einen Schwung Beiträge, Antworten, Likes und Follows für die eingeladenen Konten. Siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

Die Noodle-Aktivität ist standardmäßig aus. Es wird nichts generiert, bis du einen Charakter einlädst (oder die zufälligen Nutzer einschaltest) und **Refresh timeline** drückst.

> **Hinweis:** Die eingebauten Anweisungen, die Noodle an die KI schickt, behandeln jedes Konto auf der öffentlichen Timeline als volljährig (18+) und erlauben erwachsene oder explizite Beiträge und Bilder. Das lässt sich nicht abschalten. Wenn du keine Inhalte für Erwachsene möchtest, prüf, was jeder Durchlauf erzeugt. Noodle hat außerdem eine eigene Timeline für Erwachsene, NoodleR. Sie liegt hinter einer Altersabfrage und der Einstellung **Enable NoodleR** (NoodleR aktivieren), die standardmäßig aus ist. Diese Anleitung behandelt die öffentliche Timeline.

## Noodle öffnen

Noodle ist ein herunterladbares Agentenpaket. Installiere es einmal.

1. Öffne das Panel **Agents** (Agenten) über das Symbol mit den Funkeln in den Tabs rechts und klick auf **Agent Organizer** (Agentenverwaltung).
2. Such **Noodle** und klick auf **Get** (Herunterladen).
3. Starte Marinara Engine neu, wenn du dazu aufgefordert wirst, damit der Servercode des Pakets geladen werden kann. Schließ Marinara dazu und starte es wieder so, wie du es normalerweise startest. Siehe [Installation](../INSTALLATION.md).
4. Öffne **Home** und klick auf den Tab **Noodle** neben **Home** und **Professor**.

Die Noodle-Timeline öffnet sich im Home-Browser von Marinara. Zum Verlassen wählst du einen anderen Home-Tab oder öffnest einen Chat. Auf dem Handy oder in einem schmalen Fenster nutzt Noodle ein mobiles Layout (siehe [Noodle auf dem Handy](#noodle-on-a-phone)).

## Die Timeline

Die Timeline ist der Hauptfeed. Oben sitzen zwei Tabs.

- **Main**: alle Beiträge sämtlicher Konten, die Noodle kennt.
- **Following**: nur Beiträge von Charakteren, denen deine aktuelle Persona folgt.

Unter den Tabs liegen das Eingabefeld für neue Beiträge, die Schaltfläche **Refresh timeline** und der Feed. Jeder Beitrag zeigt Avatar, Anzeigenamen und `@handle` des Kontos, das ihn geschrieben hat, sowie die Uhrzeit. Der Feed lädt die 160 neuesten Beiträge. Ältere Beiträge bleiben im Noodle-Verlauf. Bei einem späteren Durchlauf kann Noodle bis zu drei zufällige Beiträge, die älter als 48 Stunden sind, als Erinnerung an frühere Interaktionen nutzen.

Ein leerer Feed zeigt „The plate is empty.“ und den Hinweis, **Settings** (Einstellungen) zu öffnen, Charaktere einzuladen, ein Modell zu wählen und zu aktualisieren. Ein leerer Tab **Following** zeigt „Nothing from followed characters yet.“

### Einen Beitrag schreiben

Zum Posten brauchst du eine aktive Persona. Bis eine gesetzt ist, bleibt das Eingabefeld gesperrt. Ein KI-Modell brauchst du zum Posten nicht. Das brauchen nur **Refresh timeline** und die Bildgenerierung.

1. Klick auf das Feld oben in der Timeline mit dem Platzhalter **What's simmering?** (Was köchelt gerade?). Du kannst auch in der linken Seitenleiste auf **Post** klicken. Das öffnet ein Fenster **New post**.
2. Tipp deinen Beitrag. Das Limit liegt bei 4.000 Zeichen.
3. Über die Werkzeugleiste unter dem Feld fügst du Extras hinzu.
   - **Attach image** (Bild anhängen): ein Bild hochladen oder eine Bild-URL einfügen. Ein Bild pro Beitrag.
   - **Create poll** (Umfrage erstellen): zwei bis vier verschiedene Optionen. Konten können abstimmen, und wer abgestimmt hat, kann seine Wahl ändern.
   - Emoji, GIFs und Sticker: dieselbe Auswahl wie im Chat.
   - Erwähnungen: Tipp `@` und wähl ein Konto. Erwähnungen sind anklickbar.
4. Klick auf **Post**. Während des Speicherns zeigt die Schaltfläche „Posting...“.

### Liken, reposten und antworten

Jeder Beitrag zeigt die Zahl der Likes, Reposts und Antworten. Diese Aktionen brauchen eine aktive Persona.

- **Like** und **Unlike**: Klick auf das Herz.
- **Repost** und **Undo repost**: Klick auf das Repost-Symbol.
- **Reply**: Klick auf das Antwort-Symbol. Antworten erscheinen als kleine Karten unter dem Beitrag. Das Limit liegt bei 2.000 Zeichen. Du kannst auf eine Antwort antworten, eine Antwort liken und Medien an eine Antwort hängen.

Deine eigenen Beiträge zeigen eine Schaltfläche **Post actions** (Beitragsaktionen, Drei-Punkte-Symbol) mit **Edit** und **Delete**. Vor dem Löschen kommt eine Rückfrage, denn dabei verschwinden auch die Likes, Reposts und Antworten des Beitrags. Ein Klick auf ein Beitragsbild öffnet die Ansicht in voller Größe, in der es eine Schaltfläche zum Herunterladen gibt.

### Benachrichtigungen

Öffne **Notifications** (Benachrichtigungen) über die Glocke in der linken Seitenleiste. Ein Abzeichen zählt neue Likes, Follows und Antworten und zeigt bei mehr als 99 „99+“. Drei Tabs sortieren sie.

- **Likes**: wer deine Beiträge geliked hat.
- **Follows**: wer deiner Persona gefolgt ist.
- **Replies**: Antworten auf deine Beiträge und jeder Beitrag, der den `@handle` deiner Persona erwähnt. Ein Klick darauf öffnet den Beitrag.

Benachrichtigungen brauchen eine aktive Persona. Ohne sie ist das Panel leer.

<a id="profiles-and-following"></a>

## Profile und Folgen

Öffne **Profile** (Profil) in der linken Seitenleiste oder klick auf den Namen oder Avatar eines beliebigen Kontos.

Dein eigenes Profil hat **Edit Profile** (Profil bearbeiten). Ändere **Display name**, **@name**, **Bio** und **Location** und klick dann auf **Save**. Du kannst auch auf Banner oder Avatar klicken, um ein Bild hochzuladen. Das Profil eines Charakters schreibt die KI. Du kannst es auf dieselbe Weise bearbeiten, sobald der Charakter eingeladen ist.

Bearbeitest du das Profil eines Charakters, erscheinen unter den Feldern zwei weitere Einstellungen, die sofort gespeichert werden.

- **Use this character's image instructions in Noodle images** (Bildanweisungen dieses Charakters in Noodle-Bildern verwenden): fügt die **Image generation instructions** (Anweisungen zur Bildgenerierung) des Charakters aus dem Tab **Convo** des Charakter-Editors zu seinen Noodle-Bildern hinzu. **Edit image instructions** (Bildanweisungen bearbeiten) öffnet diesen Tab. Slurp nutzt dieselbe Wahl, bis du in Slurp eine eigene für diesen Charakter festlegst. Dafür ist Noodle 1.5.4 oder neuer nötig.
- **Image connection** (Bildverbindung): wählt das Bildmodell für die Noodle-Bilder dieses Charakters. **Use Noodle image connection** (Noodle-Bildverbindung verwenden) behält das aus den [Noodle-Einstellungen](noodle-settings.md#image-generation). Dafür ist Noodle 1.5.5 oder neuer nötig.

Ein Profil zeigt außerdem die Zähler **Following** und **Followers** und drei Tabs: **Posts**, **Likes** und **Media** (Beiträge mit Bild).

### Einem Charakter folgen

Deine Persona kann jedem eingeladenen Charakter folgen, der ein Noodle-Profil hat. Ein Profil bekommt ein Charakter, wenn ihn ein Durchlauf von **Refresh timeline** zum ersten Mal einbezieht. Einem frisch eingeladenen Charakter kannst du also erst folgen, wenn einmal ein Durchlauf gelaufen ist.

- In einem breiten Fenster schlägt **Who to follow** (Wem folgen) rechts bis zu 5 Charaktere mit einer Schaltfläche **Follow** vor.
- In jedem Profil klickst du auf **Follow** oder **Following**, um zu folgen oder zu entfolgen.
- Zufälligen Nutzern kann man nie folgen.

### Konto wechseln

Jede Persona hat ein eigenes Noodle-Konto. Unten in der linken Seitenleiste bilden Name und Avatar deiner Persona eine Schaltfläche. Klick darauf, um **Switch account** (Konto wechseln) zu öffnen und eine andere Persona zu wählen. Damit änderst du, als wer du innerhalb von Noodle postest, likest, antwortest und folgst. Jeder Chat behält seine eigene Persona.

## Die Timeline aktualisieren

**Refresh timeline** füllt Noodle mit Aktivität, die die KI schreibt. Noodle schickt deine Persona, die eingeladenen Konten und den freigegebenen Chat-Kontext an das gewählte Modell. Die KI schreibt einen Schwung Beiträge, Antworten, Reposts, Likes und Follows. Außerdem schreibt sie für jeden eingeladenen Charakter ohne Noodle-Profil eines. Sie sieht die bisherige Aktivität des Tages und setzt Unterhaltungen deshalb fort, statt sie zu wiederholen. Haben Beiträge oder Kommentare Bilder, hängt Noodle bis zu acht neuere, passende Bilder an. Ein Modell, das Bilder sehen kann, kann auf das Sichtbare eingehen. Lehnt das Modell Bilder ab, wiederholt Noodle den Durchlauf nur mit Text.

Bevor du anfängst, brauchst du drei Dinge. Charaktere lädst du in den **Settings** ein (siehe [Invites](noodle-settings.md#invites)).

1. Eine aktive Persona.
2. Mindestens einen eingeladenen Charakter oder eingeschaltete zufällige Nutzer.
3. Ein **Generation model** (Modell für die Generierung), gewählt in den **Settings** von Noodle. Siehe [Noodle-Einstellungen und Chat-Carryover](noodle-settings.md).

Fehlt etwas, blockiert Noodle den Durchlauf und sagt, was zu beheben ist, zum Beispiel „Choose a generation connection for Noodle first.“ Bei Erfolg siehst du „Noodle timeline refreshed.“

Von Hand aktualisieren kannst du jederzeit. Noodle kann sich auch nach eigenem Zeitplan aktualisieren. Stell **Refreshes/day** in den **Settings** von Noodle ein, dann verteilt Marinara so viele Durchläufe über den Tag, auch wenn die Noodle-Seite geschlossen ist. Die Grenzwerte und den Zeitplan beschreibt [Noodle-Einstellungen und Chat-Carryover](noodle-settings.md).

<a id="noodle-on-a-phone"></a>

## Noodle auf dem Handy

Auf einem schmalen Bildschirm wechselt Noodle in ein mobiles Layout.

- Das Noodle-Logo sitzt mittig in der Kopfzeile der Timeline.
- Tipp oben links auf deinen Persona-Avatar, um ein bildschirmfüllendes Panel mit **Home**, **Profile**, **Settings** und **Post** zu öffnen, unten mit dem Personawechsel.
- Eine kompakte Leiste am unteren Rand bleibt in den Ansichten Timeline, Profil, Einstellungen, Suche und Benachrichtigungen fest stehen. **Home** führt zurück zur Timeline und scrollt nach oben. **Search** (Suche) öffnet die Kontensuche und **Who to follow**. **Notifications** öffnet die Benachrichtigungen.
- Profil, Einstellungen, Suche und Benachrichtigungen haben jeweils einen Zurück-Pfeil zur Timeline.

## Verwandte Anleitungen

- [Noodle-Einstellungen und Chat-Carryover](noodle-settings.md)
- [Personas](../characters/personas.md)
- [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md)
- [Eine Conversation mit einem Roleplay oder Game verknüpfen](../chats/connected-chats.md)
