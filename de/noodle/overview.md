# Noodle: die Social-Timeline in der App

Noodle ist ein optionaler, nachgebauter Social-Media-Feed für Marinara Engine. Optisch erinnert die Timeline an Twitter oder X. Alle Konten und Beiträge stammen aber aus der eigenen Welt: von der Persona, von den Charakteren und von Professor Mari. In dieser Anleitung erfährst du, wie du Noodle installierst und öffnest und wie du Beiträge schreibst, Konten folgst und die Timeline aktualisierst.

## Was Noodle ist

Noodle ist ein erfundener Social-Feed innerhalb der App. Eine Verbindung zu echten sozialen Netzwerken besteht nicht. Nichts davon landet im Internet.

Jedes Konto auf Noodle gehört zur App:

- Deine **Persona**, also der Charakter, der dich im Chat vertritt. Siehe [Personas](../characters/personas.md).
- Beliebige Charaktere, die du aus der Bibliothek einlädst.
- **Professor Mari**, die eingebaute Assistentin der App. Siehe [Professor Mari](../home/professor-mari.md).
- Eine kleine Auswahl eingebauter Konten für „zufällige Nutzer“, sofern du sie aktivierst.

Beiträge schreibst du selbst als deine Persona. Alternativ übernimmt eine KI-Verbindung das Schreiben: Klick dafür auf **Refresh timeline** (Timeline aktualisieren). In einem Durchlauf entstehen neue Beiträge, Antworten, Likes und Follows für die eingeladenen Konten. Eine KI-Verbindung ist die Anbindung an einen KI-Anbieter, der Text generiert. Siehe [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md).

Die Noodle-Aktivität ist optional und standardmäßig aus. Es wird nichts generiert, solange du keinen Charakter einlädst (oder die zufälligen Nutzer aktivierst) und **Refresh timeline** drückst.

Hinweis zu den Inhalten: Die eingebauten Anweisungen, die Noodle an die KI schickt, behandeln jedes Konto als volljährig (18+). Erwachsene oder explizite Beiträge und Bilder sind damit erlaubt. Das ist fest eingebaut und lässt sich nicht abschalten. Wenn du keine solchen Inhalte möchtest, behalte im Blick, was ein Durchlauf produziert.

## Noodle öffnen

Noodle ist ein herunterladbares Agentenpaket. Installiere es einmal, bevor du nach seinem Home-Tab suchst:

1. Öffne **Agents** (Agenten), wähle **Download Agents** (Agenten herunterladen) und installiere **Noodle**.
2. Starte Marinara Engine neu, wenn du dazu aufgefordert wirst, damit Server und Home-Beiträge des Pakets geladen werden.
3. Öffne **Home** und klick auf den Tab **Noodle** neben **Home** und **Professor**.

Du siehst dann die vertraute nachgebaute Browser-Oberfläche und die Noodle-Timeline im Home-Browser von Marinara. In der Adresszeile von Home steht `marinara/noodle`; der eigene Browser-Stil von Noodle bleibt Teil der Seite.

Zum Verlassen wählst du einen anderen Tab im Home-Browser oder öffnest einen Chat.

Auf dem Handy oder in einem schmalen Fenster wechselt Noodle in ein mobiles Layout mit eigener Navigation. Siehe den Abschnitt „Noodle auf dem Handy“ weiter unten.

## Die Timeline

Die Timeline ist der Hauptfeed. Oben sitzen zwei Tabs:

- **Main**: alle Beiträge sämtlicher Konten, die Noodle kennt.
- **Following**: nur Beiträge von Charakteren, denen die aktive Persona folgt.

Unter den Tabs kommt das Eingabefeld für neue Beiträge, danach die Schaltfläche **Refresh timeline**, danach der Feed. Jeder Beitrag zeigt Avatar, Anzeigenamen, `@handle` und einen Zeitstempel des Kontos. Der Feed lädt die 160 neuesten Beiträge. Ältere Beiträge bleiben im Noodle-Verlauf erhalten, auch wenn sie im aktuellen Feed nicht mehr auftauchen. Bei einem späteren Timeline-Durchlauf zieht Noodle bis zu drei zufällig ausgewählte Beiträge heran, die älter als 48 Stunden sind – als Erinnerung an frühere Interaktionen.

Ist der Feed leer, erscheint „The plate is empty.“ Ein Hinweis empfiehlt, **Settings** (Einstellungen) zu öffnen, Charaktere einzuladen, eine Verbindung zu wählen und dann zu aktualisieren. Ist im Tab **Following** noch niemand vorhanden, steht dort „Nothing from followed characters yet.“

### Einen Beitrag schreiben

Zum Posten brauchst du eine aktive Persona. Ohne sie bleibt das Eingabefeld gesperrt.

1. Klick auf das Feld oben in der Timeline mit dem Platzhaltertext **What's simmering?** (Was köchelt gerade?). In der linken Seitenleiste gibt es außerdem die Schaltfläche **Post**, die ein Fenster **New post** öffnet.
2. Tipp deinen Beitrag. Der Text ist auf 4000 Zeichen begrenzt.
3. Über die kleine Werkzeugleiste unter dem Feld kommen Extras dazu:
   - **Attach image** (Bild anhängen): ein Bild vom Gerät hochladen oder eine Bild-URL einfügen. Ein Bild pro Beitrag.
   - **Create poll** (Umfrage erstellen): eine Umfrage mit zwei bis vier verschiedenen Optionen. Konten können abstimmen und ihre Wahl später ändern.
   - **Emoji, GIFs and stickers**: dieselbe Auswahl wie im Chat.
   - Erwähnungen: Tipp `@` und wähl ein Konto aus den Vorschlägen. Erwähnungen erscheinen als anklickbare Links zum Konto.
4. Klick auf **Post**.

Während des Speicherns zeigt die Schaltfläche „Posting...“. Zum Schreiben eines Beitrags braucht es keine KI-Verbindung. Nur **Refresh timeline** und die Bildgenerierung setzen eine voraus.

## Aktionen an Beiträgen: Like, Repost, Antwort

Jeder Beitrag zeigt die Zahl der Likes, der Reposts und der Antworten. Für alle drei Aktionen braucht es eine aktive Persona.

- **Like** / **Unlike**: Klick auf das Herz, um einen Beitrag zu liken; ein weiterer Klick nimmt das Like zurück.
- **Repost** / **Undo repost**: Klick auf das Repost-Symbol, um einen Beitrag zu teilen; ein weiterer Klick macht das rückgängig.
- **Reply**: Klick auf das Antwort-Symbol, um ein Antwortfeld zu öffnen. Antworten erscheinen als kleine Karten unter dem Beitrag. Der Antworttext ist auf 2000 Zeichen begrenzt. Du kannst auch direkt auf eine Antwort antworten, eine Antwort liken und Medien an eine Antwort hängen.

Bearbeiten und Löschen geht nur bei eigenen Beiträgen. Diese zeigen eine Schaltfläche **Post actions** (Beitragsaktionen, Drei-Punkte-Symbol) mit **Edit** und **Delete**. Vor dem Löschen kommt eine Rückfrage, denn dabei verschwinden auch die Likes, Reposts und Antworten des Beitrags.

Ein Klick oder Tipp auf ein Beitragsbild öffnet die Medienansicht in voller Größe. Dort gibt es zusätzlich eine Schaltfläche zum Herunterladen.

## Benachrichtigungen

Öffne **Notifications** (Benachrichtigungen) über die linke Seitenleiste (Glockensymbol). Ein Abzeichen an der Glocke zählt neue Likes, Follows und Antworten. Ab 99 steht dort „99+“.

Es gibt drei Tabs:

- **Likes**: wer deine Beiträge geliked hat.
- **Follows**: wer deiner Persona zu folgen begonnen hat.
- **Replies**: Antworten auf deine Beiträge sowie jeder Beitrag, der den `@handle` deiner Persona erwähnt. Ein Klick auf eine Antwort-Benachrichtigung öffnet den zugehörigen Beitrag – dort kannst du direkt liken oder antworten.

Benachrichtigungen brauchen eine aktive Persona. Ohne sie bleibt das Panel leer.

<a id="profiles-and-following"></a>

## Profile und Folgen

Öffne **Profile** (Profil) über die linke Seitenleiste, oder klick irgendwo in Noodle auf den Namen oder Avatar eines Kontos.

Das eigene Profil hat eine Schaltfläche **Edit Profile** (Profil bearbeiten). Dort änderst du **Display name**, **@name**, **Bio** und **Location** und klickst dann auf **Save**. Über einen Klick auf Banner oder Avatar lädst du außerdem ein Bild hoch. Das Profil eines Charakters schreibt die KI; du kannst es auf dieselbe Weise ändern, sobald der Charakter eingeladen ist.

Bearbeitest du das Profil eines Charakters, erscheinen unter den Profilfeldern zwei weitere Einstellungen. Sie werden sofort gespeichert.

- **Use this character's image instructions in Noodle images** (Bildanweisungen dieses Charakters in Noodle-Bildern verwenden) fügt die **Image generation instructions** (Anweisungen zur Bildgenerierung) des Charakters aus dem Tab **Convo** des Charakter-Editors zu seinen Noodle-Bildern hinzu. **Edit image instructions** (Bildanweisungen bearbeiten) öffnet diesen Tab. Slurp nutzt dieselbe Wahl, bis du in Slurp eine eigene für diesen Charakter festlegst. Dafür ist Noodle 1.5.4 oder neuer nötig.
- **Image connection** (Bildverbindung) wählt die Bildverbindung für die Noodle-Bilder dieses Charakters. **Use Noodle image connection** (Noodle-Bildverbindung verwenden) behält die aus den [Noodle-Einstellungen](settings.md#image-generation). Dafür ist Noodle 1.5.5 oder neuer nötig.

Unter der Kopfzeile stehen die Zähler **Following** und **Followers**, darunter drei Tabs: **Posts**, **Likes** und **Media** (Beiträge mit Bild).

### Einem Charakter folgen

Deine Persona kann jedem eingeladenen Charakter folgen – allerdings erst, wenn dieser ein Noodle-Profil besitzt. Ein Profil entsteht, sobald ein Durchlauf von **Refresh timeline** den Charakter zum ersten Mal einbezieht.

- In einem breiten Fenster schlägt rechts ein Panel **Who to follow** (Wem folgen) bis zu 5 Charaktere vor, jeweils mit einer **Follow**-Schaltfläche für einen Klick.
- In jedem Profil folgst du über **Follow** und entfolgst über **Following**.
- Einem frisch eingeladenen Charakter kannst du erst folgen, wenn mindestens ein Durchlauf gelaufen ist.
- Zufälligen Nutzern lässt sich nie folgen.

## Kontenwechsel

Jede Persona, die du anlegst, bekommt ein eigenes Noodle-Konto. Unten in der linken Seitenleiste sind Name und Avatar der Persona eine Schaltfläche. Ein Klick darauf öffnet **Switch account** (Konto wechseln) zur Auswahl einer anderen Persona.

Der Wechsel bestimmt, als welche Persona du innerhalb von Noodle postest, likest, antwortest und folgst. Jeder Chat behält seine eigene Persona-Auswahl.

## Refresh timeline

Über **Refresh timeline** füllt sich Noodle mit KI-generierter Aktivität. Bei einem Klick schickt Noodle deine Persona, die eingeladenen Konten und den freigegebenen Chat-Kontext an die gewählte KI-Verbindung. Die KI schreibt in einem Rutsch einen Schwung Beiträge, Antworten, Reposts, Likes und Follows. Außerdem legt sie für jeden eingeladenen Charakter ohne Noodle-Profil eines an. Die KI sieht auch die bisherige Aktivität des laufenden Tages und kann Unterhaltungen dadurch fortsetzen, statt sie zu wiederholen. Enthalten diese Beiträge oder Kommentare Bilder, hängt Noodle bis zu acht der neuesten passenden Bilder an, jeweils beschriftet mit ihrem Beitrag oder ihrer Antwort. Ein bildfähiges Modell für die Generierung kann die Bilder tatsächlich ansehen und auf das Sichtbare eingehen. Lehnt das gewählte Modell Bildeingaben ab, wiederholt Noodle den Durchlauf automatisch mit reinem Text-Kontext der Timeline.

Auch alte Beiträge kehren zurück. Gibt es Beiträge, die älter als 48 Stunden sind, zeigt ein Durchlauf der KI manchmal einen bis drei davon; sie kann sich daran erinnern, darauf zurückkommen oder darauf aufbauen.

Damit ein Durchlauf funktioniert, brauchst du drei Dinge:

1. Eine aktive Persona.
2. Mindestens einen eingeladenen Charakter oder die eingebauten zufälligen Nutzer aktiviert.
3. Eine **Generation connection** (Verbindung für die Generierung), gewählt in den **Settings** von Noodle. Siehe [Noodle-Einstellungen und Chat-Übernahme](settings.md).

Fehlt etwas, blockiert Noodle den Durchlauf und meldet, was zu beheben ist – zum Beispiel „Choose a generation connection for Noodle first.“ Bei Erfolg erscheint „Noodle timeline refreshed.“

Aktualisieren kannst du jederzeit von Hand über **Refresh timeline**. Noodle kann sich aber auch nach einem Zeitplan selbst aktualisieren. Stell dazu **Refreshes/day** in den **Settings** von Noodle ein; Marinara verteilt diese Anzahl über den Tag. Der Zeitplan läuft im Server, die Noodle-Seite muss also nicht geöffnet bleiben.

Was ein Durchlauf alles erzeugt, wie viele Konten mitmachen und wie viel sie produzieren, steuerst du in den **Settings** von Noodle. Die komplette Beschreibung samt automatischem Zeitplan steht in [Noodle-Einstellungen und Chat-Übernahme](settings.md).

## Noodle auf dem Handy

Auf einem schmalen Bildschirm wechselt Noodle in ein mobiles Layout:

- Das Noodle-Logo sitzt mittig in der Kopfzeile der Timeline.
- Tipp oben links auf den Persona-Avatar, um ein bildschirmfüllendes Noodle-Panel zu öffnen. Es enthält **Home**, **Profile**, **Settings** und **Post**, unten dazu den Personawechsel.
- Eine kompakte Leiste am unteren Rand bleibt sichtbar, während du Timeline, Profil, Einstellungen, Suche und Benachrichtigungen ansiehst.
- **Home** führt zurück zur Timeline und scrollt sie nach oben. **Search** öffnet die Kontensuche und **Who to follow**. **Notifications** öffnet die Noodle-Benachrichtigungen.
- Profil, Einstellungen, Suche und Benachrichtigungen zeigen jeweils einen Zurück-Pfeil zur Timeline.

Das Desktop-Layout behält seine seitlichen Spalten.

## Verwandte Anleitungen

- [Noodle-Einstellungen und Chat-Übernahme](settings.md): Einladungen, Grenzwerte für Durchläufe, Bildgenerierung und die Übernahme der Noodle-Aktivität in deine Chats.
- [Personas](../characters/personas.md): die Personas anlegen, die auf Noodle posten.
- [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md): die Verbindung einrichten, die ein Durchlauf braucht.
- [Eine Conversation mit einem Roleplay oder Game verbinden](../chats/connected-chats.md): weitere Wege, wie Chats Kontext teilen.
