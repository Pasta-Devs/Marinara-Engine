# Verbindung zu einem KI-Anbieter herstellen

Zum Chatten braucht Marinara Engine ein KI-Modell. Du kannst ein Konto für einen KI-Dienst hinzufügen, seinen API-Key einfügen und ein Modell wählen. Ein API-Key ist ein geheimer Code des Dienstes, mit dem Marinara dein Konto dort nutzen kann. Behandle ihn wie ein Passwort. Du kannst auch das [eingebaute Modell](local-model.md) nutzen, ein kleines Modell, das ohne Key auf deinem Rechner läuft.

## Ein Konto hinzufügen

Bevor du anfängst, hol dir einen API-Key von dem Dienst, den du nutzen willst. Das Fenster **Add account** (Konto hinzufügen) hat für jeden Dienst einen Link **Where do I find my key?** (Wo finde ich meinen Key?). Für die gängigen Dienste öffnet er diese Seiten.

- OpenRouter (hat kostenlose Modelle): `openrouter.ai/keys`
- NanoGPT: `nano-gpt.com/api`
- OpenAI: `platform.openai.com/api-keys`
- Anthropic: `console.anthropic.com/settings/keys`
- Google Gemini: `aistudio.google.com/apikey`

Bei den meisten Diensten musst du dich erst registrieren, bei manchen auch Guthaben aufladen, bevor ein Key funktioniert. Andere Dienste findest du unter [Unterstützte KI-Anbieter](providers-reference.md). Wie du ohne Key ein Modell auf deinem eigenen Rechner nutzt, steht unter [Eingebautes Modell einrichten](local-model.md).

1. Klick in der oberen Leiste auf **Connections** (Verbindungen). Das Panel öffnet sich rechts. Hast du noch keine Konten, fragt es **Where do your models come from?** und zeigt einige Dienste. Klick auf einen Dienst, nicht auf **Built-in model** (eingebautes Modell). Das Fenster **Add account** öffnet sich direkt beim Schritt für den Key. Mach bei Schritt 4 weiter.
2. Klick auf **Add** (Hinzufügen). Das Fenster **Add account** öffnet sich.
3. Klick auf den gewünschten Dienst. Um ihn zu finden, tipp in das Feld **Search providers** (Anbieter suchen). Die Liste hat die Abschnitte **Chat**, **Images & video** (Bilder und Video), **Voice** (Stimme) und **Decisions** (Entscheidungen). Ein normales Chat-Modell findest du unter **Chat**.
4. Klick auf **API key** und füge deinen Key ein. Klick auf die Schaltfläche mit dem Auge, um zu prüfen, ob du den Key vollständig eingefügt hast.
5. Klick auf **Connect** (Verbinden). Marinara testet den Key. Klappt es, siehst du **Connected** und die Zahl der gefundenen Modelle.
6. Wie es weitergeht, hängt davon ab, ob du schon ein Main-Modell hast. Main ist die Aufgabe, deine Chat-Antworten zu schreiben.
   - **Noch kein Main-Modell, oder du hast Add aus einem neuen Chat geöffnet:** Das Fenster zeigt die Modelle des Dienstes. Modelle mit **Recommended** (empfohlen) stehen oben. Klick auf ein Modell, um es hinzuzufügen, oder tipp einen Namen in **Search or enter model ID…** (Modell-ID suchen oder eingeben). Weißt du nicht, welches du nehmen sollst, nimm eines mit **Recommended**. Du kannst es später ändern. Lass **Make … my Main model** (… zu meinem Main-Modell machen) angehakt. Die Option erscheint nur, wenn du noch kein Main-Modell hast. Hast du Add aus einem neuen Chat geöffnet und schon ein Main-Modell, erscheint stattdessen die Schaltfläche **Set … as Main** (… als Main festlegen). Klick dann auf **Done** (Fertig) oder, aus einem neuen Chat heraus, auf **Start chatting** (Chat beginnen).
   - **Du hast schon ein Main-Modell:** Das Fenster schließt sich, und eine Meldung sagt, dass das Konto mit seiner Zahl an Modellen hinzugefügt wurde. Um weitere Modelle hinzuzufügen, klick am Konto auf **⋯** und wähl **Add model** (Modell hinzufügen).

Das Panel zeigt dein Konto. **Connected** in Schritt 5 bedeutet bereits, dass der Key funktioniert. Ist das neue Modell dein Main-Modell, starte einen Chat und schick eine Nachricht: Kommt eine Antwort, funktioniert alles. Hattest du schon ein Main-Modell, nutzen neue Chats weiterhin dieses. Um das neue Konto zu nutzen, füge ihm ein Modell hinzu (**⋯** → **Add model**) und wähl dieses Modell dann für einen Chat oder eine Aufgabe (siehe [Das Modell für jede Aufgabe wählen](#choosing-the-model-for-each-job)).

Wenn es nicht funktioniert hat:

- **The key was not accepted. Check that you copied all of it.** Füge den Key erneut ein und klick auf **Try again** (erneut versuchen). Der Key muss von dem Dienst stammen, den du gewählt hast.
- **The service is busy, or your credit is used up.** Lade auf der Website des Dienstes Guthaben auf, oder warte und versuch es erneut.
- **Marinara could not reach** den Dienst. Prüf deine Internetverbindung und klick dann auf **Try again**.

### Optionale Kontofelder

Der Schritt für den Key zeigt außerdem diese Felder. Lass sie leer, solange du sie nicht brauchst.

- **Name (optional)**: der Name, den das Panel anzeigt. Leer bedeutet: der Name des Dienstes. Ein zweites Konto für denselben Dienst bekommt die letzten 4 Zeichen seines Keys, etwa `OpenAI · …a1b2`.
- **Address** (Adresse): wohin Marinara die Anfragen schickt. Ist das Feld leer, nutzt Marinara die eigene Adresse des Dienstes. Füll es nur für einen Proxy, ein Gateway oder einen Server aus, den du selbst betreibst. Dienste mit Anmeldung auf deinem Rechner zeigen es nicht an.
- **Requests per minute** (Anfragen pro Minute): bremst Marinara bei diesem Konto. Leer bedeutet kein Limit. Erlaubt sind Werte von 1 bis 600.
- **Parallel jobs** (parallele Aufgaben): wie viele Anfragen gleichzeitig laufen. Leer bedeutet kein Limit. Erlaubt sind Werte von 1 bis 16. In **Edit account** (Konto bearbeiten) heißt dieselbe Einstellung **Parallel requests** (parallele Anfragen).

Manche Dienste nutzen statt eines Keys eine Anmeldung auf deinem Rechner. Sie tragen die Markierung **Sign in** und haben kein Key-Feld. Siehe [Abo-Verbindungen für Claude, ChatGPT und Grok](subscription-clis.md). Für einen Server auf deinem eigenen Rechner siehe [Ein lokales oder selbst gehostetes Modell verbinden](local-self-hosted.md). Nach einem fehlgeschlagenen Test erscheint **Continue anyway** (trotzdem fortfahren). Damit speicherst du das Konto ohne bestandenen Test.

### Einen Chat ohne Konto starten

Startest du einen Chat, bevor du ein Modell hast, öffnet Marinara zuerst das Fenster **Add account**. Klick nach **Connect** auf ein Modell und dann auf **Start chatting**.

## Das Connections-Panel

Konten verwaltest du im Panel **Connections**. Von oben nach unten zeigt es:

- Ein Suchfeld, das die Liste beim Tippen filtert. Es trägt die Beschriftung **Search models and accounts** (Modelle und Konten durchsuchen).
- **Add**, das **Add account** öffnet, und **More actions** (Weitere Aktionen, drei Punkte) mit **Import account** (Konto importieren), **Export all accounts** (alle Konten exportieren), Einklappen und Gruppieren. In einem breiten Panel steht das Dropdown-Menü für die Sortierung neben der Suche. In einem schmalen Panel liegt die Sortierung unter **More actions**.
- Den Bereich **Jobs** (Aufgaben). Er zeigt, welches Modell welche Aufgabe übernimmt.
- Die Karte **Built-in model**. Siehe [Eingebautes Modell einrichten](local-model.md).
- Deine Konten, jeweils mit den gespeicherten Modellen darunter. Siehe [Verbindungen organisieren](organizing-connections.md).

Ein **Konto** ist ein gespeicherter Key, eine gespeicherte Anmeldung oder eine gespeicherte Adresse für einen Dienst. Nutzt du zwei Keys für denselben Dienst, hast du zwei Konten. Ein **Modell** ist ein einzelnes KI-Modell, das du aus einem Konto gespeichert hast. Jedes gespeicherte Modell behält seine eigenen Einstellungen.

<a id="choosing-the-model-for-each-job"></a>

## Das Modell für jede Aufgabe wählen

Eine Aufgabe ist etwas, das ein Modell für dich erledigt. Der Bereich **Jobs** listet sie in vier Gruppen:

| Gruppe | Aufgaben |
| --- | --- |
| **Chat** | **Main** schreibt die Antworten in deinen Chats. **Agents** (Agenten) betreibt die Hilfsagenten. **Impersonate** schreibt in deinem Namen. |
| **Omnibar** | **Professor Mari** und **Quick answers** (schnelle Antworten). |
| **Pictures & sound** (Bild und Ton) | **Images** (Bilder), **Video**, **Voice (Text to Speech)** und, sofern verfügbar, **Dictation (Speech to Text)**. |
| **Behind the scenes** (hinter den Kulissen) | **Decision**, **Embeddings** und **Image reading** (Bilder lesen). |

Jede Zeile zeigt das Modell, das die Aufgabe übernimmt, oder was die Aufgabe ohne Modell tut, etwa **Follows Main** oder **Off**. Eine Aufgabe, die ein Modell braucht, zeigt **Choose a model**. Klick auf **Jobs**, um den Bereich einzuklappen.

Um das Modell für eine Aufgabe zu ändern, klick auf ihre Zeile. Dann öffnet sich **Model for** (Modell für) für diese Aufgabe – außer bei drei Zeilen. **Decision** und **Embeddings** öffnen eigene Bedienelemente (siehe [Decision-Modelle](decision-models.md) und [Unterstützte KI-Anbieter](providers-reference.md#embeddings)). **Dictation (Speech to Text)** öffnet die Spracheinrichtung.

In **Model for**:

1. Sieh dir die Liste an.
2. Klick auf ein Modell. Die Liste zeigt es unter **Now** (jetzt), danach deine Modelle unter **Starred** (mit Stern markiert) und dann deine gespeicherten Modelle nach Konto. **All models** (alle Modelle) unter einem Konto öffnet dessen vollständige Liste. Tipp in **Search all models or paste a model ID** (alle Modelle durchsuchen oder Modell-ID einfügen), um alle Konten auf einmal zu durchsuchen. Speichern musst du ein Modell vorher nicht.

**If it fails** (falls es fehlschlägt) oben im Fenster wählt ein zweites Modell, das antwortet, wenn das erste fehlschlägt. **Add account** unten öffnet das Fenster zum Hinzufügen.

### Wenn eine Funktion ein Modell braucht

Eine Funktion, die ohne eine bestimmte Art von Modell nicht arbeiten kann, zeigt den Hinweis **Needs an image model** (oder entsprechend für Video, Audio, Decision oder Chat). Du siehst ihn auf der Karte des Agenten im Panel **Agents**, in den **Chat Settings** (Chat-Einstellungen), im Agenten-Editor sowie in den Fenstern für Bilder und Videos. Klick daneben auf **Set up** (Einrichten) und wähl dann ein Modell oder klick auf **Add account**. Der Hinweis verschwindet, sobald die Aufgabe ein Modell hat.

## Ein Konto testen

**Connect** testet den Key bereits. Um später erneut zu testen, öffne im Panel das Menü **⋯** des Kontos und klick auf **Test**. Der Konto-Editor (**Edit account**) hat **Test account** (Konto testen). Das prüft Key und Adresse so, wie du sie eingetippt hast, noch vor dem Speichern.

<a id="choosing-a-model-for-one-chat"></a>

## Ein Modell für einen einzelnen Chat wählen

Ein neuer Chat nutzt dein **Main**-Modell. Um einem einzelnen Chat ein anderes Modell zu geben, klick im Eingabebereich des Chats auf die Modell-Schaltfläche (das Link-Symbol, beschriftet mit dem aktuellen Modell) oder nutze das Feld **Model** (Modell) unter **Chat Settings → Connection** (Chat-Einstellungen → Verbindung). Beide öffnen **Model for this chat** (Modell für diesen Chat):

- **Now** zeigt das Modell, das der Chat nutzt. **This chat only** bedeutet, dass der Chat eine eigene Auswahl hat. **follows Main** bedeutet, dass er Main nutzt.
- **Recent** (zuletzt genutzt) und **Starred** listen deine Modelle nach Konto.
- **Search models or paste an ID…** (Modelle suchen oder ID einfügen) durchsucht alle Konten. **Browse** (Durchsuchen) öffnet die vollständige Liste eines Kontos.
- **Follow Main** (Main folgen) hebt die eigene Auswahl des Chats auf. **Shuffle** (Zufallsauswahl) wählt jedes Mal ein anderes Modell.

Eine Auswahl ändert nur diesen Chat. Die Meldung nach einer Auswahl bietet **Make it my Main model** (zu meinem Main-Modell machen) und **Undo** (rückgängig) an. Im Game Mode heißt das Feld **Game Master model**.

## Häufige Fehler

Schlägt ein Test oder eine Nachricht fehl, prüf zuerst diese Punkte:

- Ein falscher oder abgelaufener Key. Klick am Konto auf **⋯**, wähl **Replace key** (Key ersetzen) und füge den Key erneut ein. Ein Konto ohne Key zeigt **Needs key**.
- Ein ausgeschaltetes Konto. Es zeigt **Off**. Klick in seinem Menü **⋯** auf **Turn on** (einschalten).
- Ein Key von einem anderen Dienst. Jeder Dienst braucht seinen eigenen Key.
- Eine blockierte **Address**. Bleibt das Feld leer, gilt die eigene Adresse des Dienstes.

Weitere Lösungen stehen unter [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md).

## Verwandte Anleitungen

- [Verbindungen organisieren](organizing-connections.md)
- [Unterstützte KI-Anbieter](providers-reference.md)
- [Abo-Verbindungen für Claude, ChatGPT und Grok](subscription-clis.md)
- [Ein lokales oder selbst gehostetes Modell verbinden](local-self-hosted.md)
