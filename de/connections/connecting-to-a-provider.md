# Verbindung zu einem KI-Anbieter herstellen

In dieser Anleitung erfährst du, wie du Marinara Engine mit einem KI-Anbieter verbindest, damit die Charaktere antworten können. Du fügst ein Konto hinzu, trägst seinen Key ein und wählst das Modell, das in deinen Chats antwortet.

## Konten und Modelle

Ein **Konto** ist ein Key, eine Anmeldung oder eine Adresse für einen KI-Anbieter. Es speichert den Anbieter, den Key, die Adresse und seine Limits. Nutzt du zwei Keys für denselben Anbieter, hast du zwei Konten.

Ein **Modell** ist ein einzelnes KI-Modell, das du aus einem Konto gespeichert hast, etwa GPT oder Claude. Jedes gespeicherte Modell behält seine eigenen Einstellungen. Im Panel **Connections** (Verbindungen) stehen die Modelle unter ihrem Konto.

Ein API-Key ist ein geheimer Zugangscode vom KI-Anbieter, ähnlich einem Passwort. Marinara speichert den Key auf dem Rechner, auf dem Marinara läuft, und beim Export ist er nie dabei.

Marinara Engine bringt weder ein fertiges Konto noch einen kostenlosen Einsteiger-Key mit. Mindestens ein Konto muss also stehen, bevor ein Chat starten kann. Die einzige Ausnahme ist das **Built-in model** (eingebautes Modell) unter **On your computer** (auf deinem Rechner): Es läuft ohne Konto auf deinem eigenen Rechner (siehe [Local Model einrichten](local-model.md)).

## Das Connections-Panel

Konten verwaltest du im Panel **Connections** am rechten Rand der App. Von oben nach unten zeigt es:

- **Search models and accounts** (Modelle und Konten durchsuchen), das die Liste beim Tippen filtert.
- **Add** (Hinzufügen), das das Fenster **Add account** (Konto hinzufügen) öffnet, und **More actions** (Weitere Aktionen, drei Punkte) mit **Import account** (Konto importieren), **Export all accounts** (alle Konten exportieren), Einklappen und Gruppieren. In einem breiten Panel steht das Dropdown-Menü für die Sortierung neben **Search models and accounts**. In einem schmalen Panel liegt die Sortierung unter **More actions**.
- Den Bereich **Jobs** (Aufgaben). Er zeigt, welches Modell welche Aufgabe übernimmt, etwa **Main** für Chat-Antworten oder **Images** (Bilder) für die Bildgenerierung. Siehe [Das Modell für jede Aufgabe wählen](#choosing-the-model-for-each-job).
- Deine Konten, jeweils mit den gespeicherten Modellen darunter. Siehe [Verbindungen organisieren](organizing-connections.md).

## Ein Konto hinzufügen

1. Klick im Panel **Connections** auf **Add**. Das Fenster **Add account** listet die Anbieter unter **Popular** (Beliebt), **Subscriptions** (Abos), **On your computer** und **All providers** (alle Anbieter). Tipp in **Search providers** (Anbieter suchen), um einen zu finden.
2. Klick auf einen Anbieter, etwa **OpenAI**, **Anthropic** oder **OpenRouter**.
3. Füge den Key in **API key** ein. **Where do I find my key?** (Wo finde ich meinen Key?) öffnet die Key-Seite des Anbieters. Die Schaltfläche mit dem Auge blendet den Key ein oder aus. Unter **More options** (Weitere Optionen) liegen der optionale **Name**, die **Address** (Adresse), **Requests per minute** (Anfragen pro Minute) und **Parallel jobs** (parallele Aufgaben).
4. Klick auf **Connect** (Verbinden). Marinara testet den Key. Schlägt das fehl, zeigt das Fenster den Grund und **Try again** (erneut versuchen). Bei Servern auf deinem Rechner gibt es außerdem **Continue anyway** (trotzdem fortfahren).
5. Fügst du dein erstes Konto ohne Main-Modell hinzu oder fügst du ein Konto beim Starten eines Chats hinzu, geht das Fenster weiter zur Modellauswahl. Wähle ein Modell. **Make … my Main** (… zu meinem Main machen) legt es als Main fest, wenn diese Option angezeigt wird. Klick auf **Done** (Fertig), um abzuschließen, oder auf **Start chatting** (Chat beginnen), wenn du von einem neuen Chat aus gestartet bist. Hast du schon ein Main-Modell und fügst ein Konto über das Panel hinzu, schließt sich das Fenster nach Connect, und das Panel zeigt das neue Konto. Bild-, Video- und Sprachdienste haben eigene Bedienelemente für die Einrichtung; das eingebaute Modell nutzt seinen lokalen Einrichtungsbildschirm.

Das Modell für jede Aufgabe kannst du später im Bereich **Jobs** ändern.

Lässt du **Name** leer, benennt Marinara das Konto nach dem Anbieter. Ein zweites Konto desselben Anbieters ohne eingetippten Namen bekommt die letzten 4 Zeichen seines Keys, zum Beispiel `OpenAI · …a1b2`. Einen Namen, den du selbst eintippst, ändert Marinara nie.

Das Feld **Address** brauchst du normalerweise nicht anzufassen. Bei bekannten Anbietern trägt Marinara es selbst ein. Ändere es nur für einen Proxy oder einen Server auf deinem Rechner.

Manche Anbieter nutzen statt eines Keys eine Anmeldung auf deinem Rechner. Sie stehen unter **Subscriptions** und haben kein Key-Feld. Siehe [Abo-Verbindungen für Claude, ChatGPT und Grok](subscription-clis.md). Wie du ein Modell auf dem eigenen Rechner verbindest, steht unter [Ein lokales oder selbst gehostetes Modell verbinden](local-self-hosted.md). Alle unterstützten Anbieter und die jeweilige Bezugsquelle für den Key findest du unter [Unterstützte KI-Anbieter](providers-reference.md).

### Einen Chat ohne Konto starten

Startest du einen Chat, bevor du ein Modell hast, öffnet Marinara zuerst das Fenster **Add account**. Nach **Connect** zeigt es die Modelle des Anbieters. Klick auf eines und dann auf **Start chatting**. Die Fußzeile kann dieses Modell außerdem zu deinem **Main**-Modell machen.

<a id="choosing-the-model-for-each-job"></a>

## Das Modell für jede Aufgabe wählen

Der Bereich **Jobs** listet jede Aufgabe, die ein Modell übernehmen kann, in vier Gruppen:

- **Chat**: **Main** schreibt die Antworten in deinen Chats. **Agents** (Agenten) betreibt die Hilfsagenten. **Impersonate** schreibt in deinem Namen.
- **Omnibar**: **Professor Mari** und **Quick answers** (schnelle Antworten).
- **Pictures & sound** (Bild und Ton): **Images**, **Video** und **Voice (Text to Speech)**.
- **Behind the scenes** (hinter den Kulissen): **Decision**, **Embeddings** und **Image reading** (Bilder lesen).

Jede Zeile zeigt das Modell, das die Aufgabe übernimmt, samt Anbieter – oder was die Aufgabe ohne Modell tut, etwa **Follows Main** oder **Off**. Eine Aufgabe, die ein Modell braucht, zeigt **Choose a model**.

Klick auf eine Zeile, um **Model for** (Modell für) diese Aufgabe zu öffnen. Das Fenster zeigt unter **Now** (jetzt) das Modell, das die Aufgabe gerade übernimmt, dann deine Modelle unter **Starred** (mit Stern markiert) und danach deine gespeicherten Modelle nach Konto. **All models** (alle Modelle) unter einem Konto öffnet dessen vollständigen Katalog. Tipp in **Search all models or paste a model ID** (alle Modelle durchsuchen oder Modell-ID einfügen), um alle Kataloge auf einmal zu durchsuchen. Klick auf ein beliebiges Modell, um ihm die Aufgabe zu geben; speichern musst du es vorher nicht. **If it fails** (falls es fehlschlägt) oben im Fenster wählt ein zweites Modell, das antwortet, wenn das erste fehlschlägt. **Add account** unten öffnet das Fenster zum Hinzufügen.

Klick auf **Jobs**, um den Bereich bis auf seine Kopfzeile einzuklappen.

### Wenn eine Funktion ein Modell braucht

Ein Agent oder eine Funktion, die ohne eine bestimmte Art von Modell nicht arbeiten kann, zeigt das mit dem Hinweis **Needs an image model** an (oder entsprechend für Video, Audio, Decision oder Chat). Er erscheint auf der Karte des Agenten im Panel **Agents**, in den **Chat Settings** (Chat-Einstellungen), im Agenten-Editor sowie in den Fenstern für Bilder und Videos. Klick daneben auf **Set up** (Einrichten), um **Model for** für diese Aufgabe zu öffnen. Dort kannst du ein Modell wählen oder auf **Add account** klicken. Der Hinweis verschwindet, sobald die Aufgabe ein Modell hat. Scheitert eine Antwort, weil kein Bildmodell festgelegt ist, öffnet **Set up** in der Nachricht das Panel **Connections**.

## Ein Konto testen

**Connect** testet den Key bereits. Um ihn später erneut zu testen, öffne im Panel das Menü **⋯** des Kontos und klick auf **Test**. Der Konto-Editor **Edit account** (Konto bearbeiten) hat **Test account** (Konto testen). Das prüft Key und Adresse so, wie du sie eingetippt hast, noch vor dem Speichern.

<a id="choosing-a-model-for-one-chat"></a>

## Ein Modell für einen einzelnen Chat wählen

Ein neuer Chat nutzt dein **Main**-Modell. Um einem einzelnen Chat ein anderes Modell zu geben, öffne das Menü **Connections** im Eingabebereich des Chats oder das Feld **Model** (Modell) unter **Chat Settings → Connection** (Chat-Einstellungen → Verbindung). Beide öffnen **Model for this chat** (Modell für diesen Chat):

- **Now** zeigt das Modell, das der Chat nutzt. **This chat only** bedeutet, dass der Chat eine eigene Auswahl hat; **follows Main** bedeutet, dass er Main nutzt.
- **Recent** (zuletzt genutzt) und **Starred** listen deine Modelle nach Konto.
- **Search models or paste an ID…** (Modelle suchen oder ID einfügen) durchsucht alle Kataloge. **Browse** (Durchsuchen) öffnet die vollständige Liste eines Kontos.
- **Follow Main** (Main folgen) hebt die eigene Auswahl des Chats auf. **Shuffle** (Zufallsauswahl) wählt jedes Mal ein anderes Modell.

Eine Auswahl ändert nur diesen Chat. Die Meldung nach einer Auswahl bietet **Make it my Main model** (zu meinem Main-Modell machen) und **Undo** (rückgängig) an. Im Game Mode trägt das Feld die Beschriftung **GM / Party Model**.

## Häufige Fehler

Schlägt ein Test oder eine Nachricht fehl, prüf zuerst diese Punkte:

- Ein falscher oder abgelaufener Key. Öffne das Menü **⋯** des Kontos, klick auf **Replace key** (Key ersetzen) und füge den Key erneut ein. Ein Konto ohne Key zeigt **Needs key**.
- Ein ausgeschaltetes Konto. Es zeigt **Off**; klick in seinem Menü **⋯** auf **Turn on** (einschalten).
- Ein Key vom falschen Anbieter. Jeder Anbieter braucht seinen eigenen Key.
- Eine blockierte oder nicht erreichbare **Address**. Lass sie leer, damit die Adresse des Anbieters greift – außer du nutzt einen Proxy oder einen Server auf deinem Rechner.

Weitere Lösungen stehen unter [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

## Verwandte Anleitungen

- [Verbindungen organisieren](organizing-connections.md)
- [Unterstützte KI-Anbieter](providers-reference.md)
- [Abo-Verbindungen für Claude, ChatGPT und Grok](subscription-clis.md)
- [Ein lokales oder selbst gehostetes Modell verbinden](local-self-hosted.md)
- [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md)
