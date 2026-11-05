# Verbindungen organisieren

In dieser Anleitung erfährst du, wie du Konten und Modelle im Panel **Connections** (Verbindungen) aufgeräumt hältst: Einklappen, mit Stern markieren, Verschieben, Entfernen, Ordner, Shuffle und Export. Wie du ein Konto hinzufügst, steht unter [Verbindung zu einem KI-Anbieter herstellen](connecting-to-a-provider.md).

## Die Kontoliste

Unter dem Bereich **Jobs** (Aufgaben) listet das Panel deine Konten. Jedes Konto zeigt sein Bild, seinen Namen, die Zahl seiner Modelle und seine Adresse. Eine Modellzeile zeigt das Bild des Modells, seinen Namen und Badges, etwa die Aufgabe, die es übernimmt (**Main**, **Agents**, **Images**), **Custom settings**, seinen Preis oder **Plan** für Modelle, die in einem Abo enthalten sind. Die Karte **Built-in model** (eingebautes Modell) sitzt unter dem Bereich **Jobs**. Siehe [Eingebautes Modell einrichten](local-model.md).

Ein Klick auf die Zeile eines Kontos klappt seine Modelle ein, ein weiterer Klick zeigt sie wieder. Marinara merkt sich, welche Konten du eingeklappt hast. **More actions** (Weitere Aktionen, drei Punkte) oben im Panel enthält diese Einträge:

| Eintrag | Funktion |
| --- | --- |
| **Fold all accounts**, **Open all accounts** | Klappt alle Konten ein oder auf. |
| **Show only Off or Needs key** | Listet nur Konten, die Aufmerksamkeit brauchen. |
| **Show cost badges** | Zeigt den Preis jedes Modells. |
| **Group by folder**, **Group by account** | Wechselt, wie die Modelle gruppiert werden. Siehe [Ordner](#folders). |
| **Import account**, **Export all accounts** | Siehe [Exportieren und importieren](#export-and-import). |

In einem breiten Panel steht das Dropdown-Menü für die Sortierung neben **Search models and accounts** (Modelle und Konten durchsuchen). In einem schmalen Panel liegt die Sortierung unter **More actions**. Zur Wahl stehen **Custom** (benutzerdefiniert), **A–Z**, **Z–A**, **Newest** (neueste) und **Oldest** (älteste). **Search models and accounts** filtert die Liste beim Tippen.

Manche Konten erreichen Modelle mehrerer Hersteller, etwa NanoGPT oder ein Proxy. Ihre Modelle sind unter Überschriften wie **via NanoGPT** gruppiert.

### Kontoaktionen

Klick in der Zeile eines Kontos auf **⋯**:

| Aktion | Funktion |
| --- | --- |
| **Edit account** | Öffnet seine Einstellungen, darunter **Name**, **Address**, **API key** und **Use this account**. |
| **Replace key** | Fügt einen neuen Key ein. Steht der alte Key auch bei anderen Konten, fragt Marinara, ob es diese ebenfalls aktualisieren soll. |
| **Test** | Prüft den Key und zeigt das Ergebnis. |
| **Add model** | Öffnet die Modellliste des Kontos. **Add image model** erscheint bei Diensten, die auch Bilder erzeugen. |
| **Select models** | Lässt dich mehrere Modelle auf einmal verschieben oder löschen. |
| **Duplicate** | Legt eine Kopie des Kontos mit Kopien seiner Modelle an. |
| **Turn off** / **Turn on** | Schaltet die Nutzung des Kontos durch Marinara aus oder wieder ein. |
| **Delete account** | Siehe unten. |

Um ein Konto zu löschen, klick auf **Delete account** (Konto löschen). Marinara bittet dich um Bestätigung und listet unter **Used by** (genutzt von) auf, was seine Modelle nutzt: Chats, Agenten, Modelle und Aufgaben. Klick auf **Delete with its N models** (mit seinen N Modellen löschen), um das Konto samt seinen Modellen zu entfernen. Diese Chats und Aufgaben brauchen danach ein anderes Modell. Lässt sich ein Modell nicht entfernen, listet der Editor es unter **This account still has models. Remove these first:** auf. Öffne jedes davon und entferne es.

In **Edit account** (Konto bearbeiten) prüft **Test account** (Konto testen) den Key, **Usage and balance** (Nutzung und Guthaben) zeigt die Nutzung deines Tarifs, und **More options** (Weitere Optionen) enthält **Requests per minute** (Anfragen pro Minute) und **Parallel requests** (parallele Anfragen).

### Anbietersymbole

Jedes Konto zeigt das Symbol seines Dienstes. Die Symbole werden mit Marinara ausgeliefert und nie aus dem Internet geladen. Ein Konto mit eigener Adresse zeigt das Symbol eines bekannten Servers oder Gateways, wenn seine Adresse oder sein Name einen solchen enthält, etwa Ollama, LM Studio, KoboldCpp, Bifrost oder LiteLLM. Andernfalls zeigt es den ersten Buchstaben seines Namens. Um ein eigenes zu wählen, klick auf das Bild eines Kontos und wähl dann ein Dienst-Logo, lade ein Bild hoch oder nutze Buchstaben.

## Mit Stern markierte Modelle

Ein Stern markiert die Modelle, die du schnell finden willst. Mit Stern markierte Modelle stehen unter **Starred** (mit Stern markiert) weit oben in jeder Modellauswahl: in den Fenstern **Model for** (Modell für) des Bereichs **Jobs**, in **Model for this chat** (Modell für diesen Chat) und in den Modellfeldern der **Chat Settings** (Chat-Einstellungen) und des Agenten-Editors.

Um ein Modell mit einem Stern zu markieren, klick in der Liste **Add model** (Modell hinzufügen) des Kontos auf seinen Stern oder wähl **Star** (mit Stern markieren) im Menü **⋯** des Modells. Auch wenn du einem Modell eine Aufgabe gibst, wird es gespeichert.

Um den Stern zu entfernen, klick erneut darauf. Marinara entfernt das Modell und zeigt einige Sekunden lang **Undo** (rückgängig). Ohne Stern bleibt das Modell erhalten, wenn ein Chat es nutzt, es im Bereich **Jobs** eine Rolle hat, eigene Einstellungen besitzt oder das letzte Modell seines Kontos ist. Die Meldung nennt den Grund.

## Modellaktionen

Klick in einer Modellzeile auf **⋯**:

| Aktion | Funktion |
| --- | --- |
| **Make default for…** | Gibt dem Modell eine Aufgabe, genau wie die Auswahl im Bereich **Jobs**. |
| **Edit model** | Öffnet seine Einstellungen. Ein Klick auf die Modellzeile bewirkt dasselbe. |
| **Move to account…** | Verschiebt das Modell in ein anderes Konto. Danach nutzt es den Key dieses Kontos. |
| **Folder** | Legt das Modell in einen Ordner. |
| **Duplicate** | Legt eine vollständige Kopie mit denselben Einstellungen an. |
| **Add to Shuffle** / **Remove from Shuffle** | Siehe [Shuffle](#shuffle). |
| **Change picture** | Öffnet die Bildauswahl. |
| **Remove** | Löscht das Modell nach einer Bestätigung. Die Bestätigung listet auf, was es nutzt. |

Verschiebst du ein Modell, ziehen sein Name, sein Bild, seine Aufgaben und seine Chats mit, und die Dienstoptionen werden zurückgesetzt.

Am Computer kannst du eine Modellzeile auf einen Chat ziehen, um das Modell in diesem Chat zu verwenden.

<a id="folders"></a>

## Ordner

Ordner gruppieren deine Modelle, zum Beispiel **RP** und **Work**. Damit sie erscheinen, wähl unter **More actions** die Option **Group by folder** (nach Ordner gruppieren). Ein Modell liegt jeweils in nur einem Ordner.

1. Klick an einem Modell auf **⋯** und wähl **Folder** (Ordner).
2. Wähl einen Ordner, oder klick auf **New folder…** (neuer Ordner), tipp einen Namen ein und klick auf **Create** (Erstellen).

Ein Ordner kann ein Symbol und eine Farbe haben. Um einen Ordner umzubenennen oder zu löschen, öffne sein Menü **⋯**. Löschst du einen Ordner, bleiben seine Modelle erhalten, unter **Not in a folder**.

## Shuffle

Mit Shuffle wählt ein Chat jedes Mal ein anderes Modell, wenn er eine Antwort schreibt. Nutze es, um Anfragen über mehrere Dienste oder Modelle zu verteilen.

1. Klick an jedem Modell, das in den Pool soll, auf **⋯** und wähl **Add to Shuffle** (zu Shuffle hinzufügen).
2. Öffne in einem Chat **Model for this chat** im Eingabebereich des Chats oder **Chat Settings → Connection → Model** (Chat-Einstellungen → Verbindung → Modell) und wähl **Shuffle** (Zufallsauswahl).

Jede Antwort greift dann auf ein zufälliges Modell aus deinem Shuffle-Pool zurück.

Scheitert das Modell, das für eine Antwort gezogen wurde, und hat **Main** ein Modell unter **If it fails** (falls es fehlschlägt), schreibt stattdessen dieses Modell die Antwort. Ein Hinweis nennt das gescheiterte Modell und einen kurzen Grund wie „key rejected“, „rate limited“ oder „not found“. Die Antwort behält eine kleine Markierung **Fallback**. Tipp darauf oder zeig darauf, um dieselbe Zeile erneut zu sehen.

Eine Auswahl in **Model for this chat** ändert nur diesen Chat. Um das Modell für neue Chats zu ändern, leg **Main** im Bereich **Jobs** fest.

<a id="export-and-import"></a>

## Exportieren und importieren

Konten lassen sich in eine Datei exportieren – als Backup oder für den Umzug auf eine andere Installation. Später importierst du sie wieder.

> **Warnung:** Exporte enthalten nie API-Keys. Öffne nach dem Import jedes Konto und trag seinen Key erneut ein. Gib einen Key niemals an andere weiter.

- **Ein Modell exportieren:** Öffne es mit **Edit model** (Modell bearbeiten) und klick auf **Export model** (Modell exportieren).
- **Alles exportieren:** Öffne **More actions** und wähl **Export all accounts** (alle Konten exportieren). Marinara erinnert dich daran, dass die Datei keine Keys enthält. Klick auf **Export** (Exportieren).
- **Importieren:** Öffne **More actions** und wähl **Import account** (Konto importieren). Zieh eine oder mehrere Dateien (`.json`, `.jsonl` oder `.zip`) in das Fenster, oder klick, um sie auszuwählen. Das gilt auch für die exportierte `marinara-connections.zip`. Jedes importierte Konto hat einen leeren Key, bis du ihn ausfüllst.

Ein einzelnes Modell wird als `.connection.json`-Datei heruntergeladen. Mehrere kommen gemeinsam als `marinara-connections.zip`. Sterne sind enthalten. Der Modellkatalog des Dienstes ist es nicht; er wird neu geladen, wenn du die Modelle des Kontos zum ersten Mal öffnest.

## Verwandte Anleitungen

- [Verbindung zu einem KI-Anbieter herstellen](connecting-to-a-provider.md)
- [Chat Settings im Überblick](../chats/chat-settings.md)
