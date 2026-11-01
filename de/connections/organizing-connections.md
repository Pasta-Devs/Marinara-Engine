# Verbindungen organisieren

In dieser Anleitung erfährst du, wie du Konten und Modelle in Marinara Engine aufgeräumt hältst. Es geht um die Kontoliste, mit Stern markierte Modelle, das Verschieben und Entfernen von Modellen, Ordner, Shuffle sowie Export und Import. Ein Konto ist ein Key, eine Anmeldung oder eine Adresse für einen KI-Anbieter; ein Modell ist ein einzelnes KI-Modell, das du daraus gespeichert hast. Wie du ein Konto hinzufügst, steht unter [Verbindung zu einem KI-Anbieter herstellen](connecting-to-a-provider.md).

## Die Kontoliste

Unter dem Bereich **Jobs** (Aufgaben) listet das Panel **Connections** (Verbindungen) deine Konten. Jedes Konto zeigt sein Bild, seinen Namen, die Zahl seiner Modelle und seine Adresse. Eine Modellzeile zeigt das Bild des Modells, seinen Namen und Badges, etwa die Aufgabe, die es übernimmt (**Main**, **Agents**, **Images**), **Custom settings**, seinen Preis oder **Plan** für Modelle, die in einem Abo enthalten sind.

Ein Klick auf die Zeile eines Kontos klappt seine Modelle ein, ein weiterer Klick zeigt sie wieder. Marinara merkt sich, welche Konten du eingeklappt hast. **More actions** (Weitere Aktionen) oben im Panel enthält **Fold all accounts** (alle Konten einklappen) und **Open all accounts** (alle Konten aufklappen), **Show only Off or Needs key** (nur Off oder Needs key anzeigen) und **Show cost badges** (Kosten-Badges anzeigen). In einem breiten Panel steht das Dropdown-Menü für die Sortierung neben **Search models and accounts** (Modelle und Konten durchsuchen). In einem schmalen Panel liegt die Sortierung unter **More actions**.

Ein Gateway-Konto, das mehrere Modellhersteller erreicht, etwa ein Proxy oder LinkAPI, gruppiert seine Modelle unter **via**-Überschriften wie **via NanoGPT**, jeweils mit dem Symbol des Herstellers.

Die Karte **Built-in model** (eingebautes Modell) unter dem Bereich Jobs zeigt das Modell, das auf deinem Rechner läuft, und seinen Zustand. Siehe [Local Model einrichten](local-model.md).

### Kontoaktionen

Klick in der Zeile eines Kontos auf **⋯**:

- **Edit account** (Konto bearbeiten) öffnet seine Einstellungen: **Name**, **API key**, **Address** (Adresse), **Usage and limits** (Nutzung und Limits) und **Use this account** (dieses Konto verwenden).
- **Replace key** (Key ersetzen) fügt einen neuen Key ein.
- **Test** prüft den Key und zeigt das Ergebnis.
- **Add model** (Modell hinzufügen) öffnet die Modellliste des Kontos. **Add image model** (Bildmodell hinzufügen) erscheint bei Anbietern, die auch Bilder erzeugen.
- **Select models** (Modelle auswählen) lässt dich mehrere Modelle auf einmal verschieben oder löschen.
- **Duplicate** (Duplizieren) legt eine Kopie des Kontos mit Kopien seiner Modelle an.
- **Turn off** (ausschalten) sorgt dafür, dass Marinara das Konto nicht nutzt, bis du es mit **Turn on** (einschalten) wieder einschaltest.
- **Delete account** (Konto löschen). Marinara listet vorher die Aufgaben, Chats und Agenten auf, die seine Modelle noch nutzen.

### Anbietersymbole

Jedes Konto zeigt das Symbol seines Anbieters. Die Symbole werden mit Marinara ausgeliefert, daher lädt Marinara sie nie aus dem Internet. Ein Konto mit eigener Adresse zeigt das Symbol eines bekannten Servers oder Gateways, wenn seine Adresse oder sein Name einen solchen enthält, zum Beispiel Ollama, LM Studio, KoboldCpp, Bifrost oder LiteLLM. Andernfalls zeigt es den ersten Buchstaben seines Namens. Klick auf das Bild eines Kontos, um ein eigenes zu wählen.

## Mit Stern markierte Modelle

Ein Stern markiert die Modelle, die du griffbereit haben willst. Mit Stern markierte Modelle stehen unter **Starred** (mit Stern markiert) weit oben in jeder Modellauswahl: in den Fenstern **Model for** (Modell für) des Bereichs **Jobs**, in **Model for this chat** (Modell für diesen Chat) des Chats und in den Modellfeldern der **Chat Settings** (Chat-Einstellungen) und des Agenten-Editors.

Um ein Modell mit einem Stern zu markieren, klick in der Liste **Add model** des Kontos auf seinen Stern oder wähl **Star** (mit Stern markieren) im Menü **⋯** des Modells. Auch wenn du einem Modell eine Aufgabe gibst, wird es gespeichert.

Um den Stern zu entfernen, klick erneut darauf. Marinara entfernt das Modell und zeigt einige Sekunden lang **Undo** (rückgängig). Ohne Stern bleibt ein Modell erhalten, wenn es im Bereich **Jobs** noch eine Rolle hat, eigene Einstellungen besitzt oder das letzte Modell seines Kontos ist. Die Meldung nennt den Grund.

## Modellaktionen

Klick in einer Modellzeile auf **⋯**:

- **Make default for…** (Standard für … machen) gibt dem Modell eine Aufgabe, genau wie die Auswahl im Bereich **Jobs**.
- **Edit model** (Modell bearbeiten) öffnet seine Einstellungen. Ein Klick auf die Modellzeile bewirkt dasselbe.
- **Move to account…** (in ein Konto verschieben) verschiebt das Modell in ein anderes Konto desselben Anbieters oder in ein neues Konto. Danach nutzt das Modell den Key und den Katalog dieses Kontos. Chats, die das Modell nutzen, funktionieren weiter.
- **Folder** (Ordner) legt das Modell in einen Ordner. Ordner erscheinen, wenn du unter **More actions** die Option **Group by folder** (nach Ordner gruppieren) wählst.
- **Duplicate** legt ohne Rückfrage eine vollständige Kopie mit denselben Einstellungen an.
- **Add to Shuffle** (zu Shuffle hinzufügen) oder **Remove from Shuffle** (aus Shuffle entfernen).
- **Change picture** (Bild ändern).
- **Remove** (Entfernen) löscht das Modell nach einer Bestätigung.

Am Computer kannst du eine Modellzeile auf einen Chat ziehen, um das Modell in diesem Chat zu verwenden.

## Suche

**Search models and accounts** oben im Panel filtert die Liste beim Tippen. Passt nichts, weist das Panel darauf hin.

## Shuffle

Mit Shuffle wählt ein Chat jedes Mal ein anderes Modell, wenn er eine Antwort schreibt. Praktisch, wenn du die Anfragen über mehrere Anbieter oder Modelle verteilen willst.

Um ein Modell zu Shuffle hinzuzufügen, wähl in seinem Menü **⋯** die Option **Add to Shuffle**. Damit ein Chat Shuffle nutzt, öffne **Model for this chat** im Eingabebereich des Chats oder über **Chat Settings → Connection → Model** (Chat-Einstellungen → Verbindung → Modell) und wähl **Shuffle** (Zufallsauswahl). Jede Antwort greift dann auf ein zufälliges Modell aus deinem Shuffle zurück.

Scheitert das Modell, das für eine Antwort gezogen wurde, und hat **Main** ein Modell unter **If it fails** (falls es fehlschlägt), schreibt stattdessen dieses Modell die Antwort. Ein Hinweis nennt das gescheiterte Modell und einen kurzen Grund wie „key rejected“, „rate limited“ oder „not found“, damit du erkennst, welches Modell repariert werden muss. Die Antwort behält eine kleine Markierung **Fallback**; tipp darauf oder zeig darauf, um dieselbe Zeile erneut zu sehen.

Eine Auswahl in **Model for this chat** ändert nur diesen Chat. Um das Modell für neue Chats zu ändern, leg **Main** im Bereich **Jobs** fest.

## Exportieren und importieren

Konten lassen sich in eine Datei exportieren – als Backup oder für den Umzug auf eine andere Installation. Später importierst du sie einfach wieder.

**Ein Export enthält niemals die API-Keys.** Öffne nach dem Import jedes Konto und trag seinen Key erneut ein. Sterne sind enthalten, der Katalog des Anbieters dagegen nicht. Er wird neu geladen, wenn du die Modelle des Kontos zum ersten Mal öffnest.

Um ein einzelnes Modell zu exportieren, öffne es mit **Edit model** und klick auf seine Schaltfläche **Export** (das Upload-Symbol). Um alles zu exportieren, öffne **More actions** und wähl **Export all accounts** (alle Konten exportieren). Vor dem Download erinnert dich Marinara daran, dass die Datei keine Keys enthält.

Ein einzelnes Modell wird als `.connection.json`-Datei heruntergeladen. Mehrere kommen gemeinsam als `marinara-connections.zip`-Datei.

Zum Importieren öffnest du **More actions** und wählst **Import account** (Konto importieren). Zieh eine oder mehrere `.json`-Dateien in das Fenster oder klick, um sie auszuwählen. Jedes importierte Konto hat einen leeren Key, bis du ihn ausfüllst.

## Verwandte Anleitungen

- [Verbindung zu einem KI-Anbieter herstellen](connecting-to-a-provider.md)
- [Überblick über die Chat Settings](../chats/chat-settings.md)
