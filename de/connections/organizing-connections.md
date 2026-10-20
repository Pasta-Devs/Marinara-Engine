# Verbindungen organisieren

In dieser Anleitung erfährst du, wie du die gespeicherten Verbindungen in Marinara Engine aufgeräumt hältst. Es geht um Verbindungs-Ordner, Suche und Sortierung, Duplizieren und Löschen, den Zufallspool, den Quick Connection Switcher sowie den Export und Import von Verbindungen. Eine Verbindung ist eine gespeicherte Konfiguration, die Marinara sagt, wie es einen KI-Dienst erreicht.

Das alles erledigst du im **Connections**-Panel (Verbindungen). Öffne es, dann erscheinen die gespeicherten Verbindungen als Liste von Zeilen. Jede Zeile zeigt den Namen der Verbindung, darunter Anbieter und Modell.

## Verbindungs-Ordner

Mit Verbindungs-Ordnern gruppierst du zusammengehörende Verbindungen. Leg zum Beispiel alle lokalen Modelle in einen Ordner und alle kostenpflichtigen Anbieter in einen anderen.

So legst du einen Ordner an:

1. Klick auf die Schaltfläche **New Folder** (Neuer Ordner) über der Verbindungsliste.
2. Ein neuer Ordner namens „unnamed“ erscheint.
3. Benenn ihn gleich um, damit du ihn auseinanderhalten kannst (siehe unten).

Zum Umbenennen doppelklickst du auf die Ordnerzeile – auf dem Touchscreen genügt ein Doppeltipp. Alternativ markierst du die Ordnerzeile und drückst **F2**. Tipp den neuen Namen ein und drück Enter.

Um eine Verbindung in einen Ordner einzusortieren, zieh die Verbindungszeile auf den Ordner. Zieh sie auf die Fläche unterhalb der Ordner, um sie wieder herauszuholen. Beim Ziehen erscheint der Hinweis **Drop here to move out of folder** (hier ablegen, um sie aus dem Ordner zu holen).

Auf einem Touchscreen hältst du eine Zeile gedrückt, um sie aufzunehmen, und ziehst sie dann. Eine normale Wischbewegung scrollt weiterhin die Liste.

Ein Klick auf die Ordnerzeile klappt den Ordner zu oder wieder auf. Eine kleine Zahl in der Ordnerzeile zeigt, wie viele Verbindungen darin liegen.

Zum Löschen klickst du auf das Papierkorb-Symbol in der Ordnerzeile. Liegen noch Verbindungen darin, fragt Marinara im Dialogfenster **Delete Folder** (Ordner löschen) nach. Einen leeren Ordner löscht Marinara sofort, ganz ohne Rückfrage. Das Löschen eines Ordners löscht die enthaltenen Verbindungen nicht. Sie wandern stattdessen zurück in den Bereich der nicht einsortierten Verbindungen.

## Suche und Sortierung

Das Feld **Search connections** (Verbindungen durchsuchen) filtert die Liste beim Tippen. Gesucht wird in Name, Anbieter, Modell, Basis-URL, Bild- oder Video-Dienst und Embedding-Modell der Verbindung. Passt nichts, erscheint „No connections match your search“.

Das Dropdown-Menü **Sort order** (Sortierung) neben dem Suchfeld ändert die Reihenfolge der Liste. Es hat fünf Optionen:

| Option | Wirkung |
|---|---|
| **Custom** | Deine eigene Reihenfolge per Drag-and-drop. |
| **A-Z** | Sortiert nach Namen, A bis Z. |
| **Z-A** | Sortiert nach Namen, Z bis A. |
| **Newest** | Neueste Verbindungen zuerst. |
| **Oldest** | Älteste Verbindungen zuerst. |

Für eine eigene Reihenfolge ziehst du die Verbindungszeilen nach oben oder unten. Sobald du eine Verbindung ziehst, stellt Marinara die Sortierung automatisch auf **Custom** um. Eine fokussierte Zeile kannst du auch mit Alt+Pfeil nach oben oder Alt+Pfeil nach unten verschieben.

## Duplizieren und Löschen

Zeig mit der Maus auf eine Verbindungszeile – auf dem Touchscreen schau einfach auf die Zeile –, dann erscheinen die Schaltflächen für Aktionen.

Zum Duplizieren einer Verbindung klickst du auf die Schaltfläche **Duplicate** (Duplizieren, das Kopier-Symbol). Marinara legt eine vollständige Kopie an, inklusive gespeichertem API-Key. Die Kopie öffnet sich direkt im Editor, sodass du sie umbenennen kannst. Eine Rückfrage gibt es nicht.

Um eine einzelne Verbindung zu löschen, klick auf ihre Schaltfläche **Delete** (Löschen, das Papierkorb-Symbol). Marinara zeigt das Dialogfenster **Delete Connection** (Verbindung löschen) mit dem Text Delete "your connection name"? This cannot be undone. Klick zur Bestätigung auf **Delete**.

Um mehrere Verbindungen auf einmal zu löschen oder zu exportieren, klick oben im Panel auf **Select** (Auswählen). Damit schaltet der Auswahlmodus ein. Tipp die gewünschten Verbindungen an und nutz dann in der Aktionsleiste unten **Export** (Exportieren) oder **Delete**. Beim Sammellöschen erscheint vorher das Dialogfenster **Delete Connections** (Verbindungen löschen).

<a id="the-random-pool-and-quick-connection-switcher"></a>

## Zufallspool und Quick Connection Switcher

Mit dem Zufallspool wählt ein Chat für jede Antwort eine andere Verbindung. Praktisch, wenn du die Anfragen über mehrere Anbieter oder Modelle verteilen willst.

Um eine Verbindung in den Zufallspool aufzunehmen, klick auf das Mischen-Symbol in ihrer Zeile. Der Tooltip (Kurzhinweis beim Draufzeigen) lautet **Add to random pool**. Sobald die Verbindung im Pool liegt, ändert er sich zu **In random pool (click to remove)**. Ein weiterer Klick auf das Symbol nimmt die Verbindung wieder heraus.

Damit ein Chat den Zufallspool nutzt, öffne **Chat Settings** (Chat-Einstellungen), geh zum Abschnitt **Connection** und wähl im Dropdown-Menü **🎲 Random**. Im Game Mode heißt dieses Dropdown-Menü **GM / Party Model**. Jede Antwort greift dann auf eine zufällige Verbindung aus dem Pool zurück.

Scheitert die Verbindung, die für eine Antwort gezogen wurde, und hast du für **Main** eine Fallback-Verbindung festgelegt, schreibt stattdessen der Fallback die Antwort. Ein Hinweis nennt die gescheiterte Verbindung, ihr Modell und einen kurzen Grund wie „key rejected“, „rate limited“ oder „not found“, damit du erkennst, welche Verbindung im Pool repariert werden muss. Die Antwort behält eine kleine Markierung **Fallback**; tipp darauf oder zeig darauf, um dieselbe Zeile erneut zu sehen.

Noch schneller wechselst du die Verbindung für den aktuellen Chat – und ihr Modell – mit dem **Quick Connection Switcher** (schneller Verbindungswechsel). Klick dafür auf das Link-Symbol im Eingabebereich des Chats. Links zeigt er deine Verbindungen, rechts die **Models** (Modelle) der gewählten Verbindung:

- Klick auf eine Verbindung, um sie sofort für den aktuellen Chat zu verwenden. Das Menü bleibt offen, damit du als Nächstes eines ihrer Modelle wählen kannst.
- Klick auf ein Modell, um es zu verwenden. Marinara speichert das Modell in dieser Verbindung, wählt die Verbindung für den Chat aus, falls sie es noch nicht war, und schließt das Menü. Ein Häkchen markiert das Modell, das die Verbindung gerade nutzt. Wie im Verbindungs-Editor aktualisiert die Wahl eines gelisteten Modells auch das Kontextfenster der Verbindung und ihr Ausgabelimit, sofern der Anbieter diese Werte meldet.
- Tipp in das Feld **Search or enter model ID…** (suchen oder Modell-ID eingeben), um die Liste zu filtern. Enter wählt das Modell, dessen ID oder Namen du eingegeben hast, oder das einzige Modell, das noch in der Liste steht. Für ein Modell, das nicht in der Liste steht, gibst du seine exakte ID ein: Drück Enter, wenn nichts in der Liste dazu passt, oder klick auf die Zeile **Use "…"**.
- Klick auf den Stern neben einem Modell, um es anzuheften. Angeheftete Modelle bleiben oben unter **Pinned** (Angeheftet), auch die, die du von Hand eingegeben hast. Ein weiterer Klick auf den Stern hebt das Anheften wieder auf.
- Wenn du die Modelle einer Verbindung zum ersten Mal öffnest, lädt Marinara die Liste vom Anbieter und speichert sie in der Verbindung. Bei späteren Besuchen erscheint sie dann sofort. Mit der Aktualisieren-Schaltfläche neben dem Suchfeld lädst du die Liste neu, etwa wenn der Anbieter neue Modelle hinzugefügt hat. Auch wenn du API-Key, Basis-URL oder Anbieter der Verbindung änderst, lädt Marinara eine frische Liste.
- Hat der Anbieter keine Modellliste oder ist er nicht erreichbar, weist das Menü darauf hin. Eine Modell-ID kannst du trotzdem eingeben.
- Die Würfel-Schaltfläche oben im Menü schaltet den Zufallspool für diesen Chat ein oder aus.
- Ist der Zufallspool aktiv, nimmt ein Klick auf eine Verbindung sie stattdessen in den Pool auf oder entfernt sie daraus. Ein Häkchen zeigt, welche Verbindungen im Pool liegen. Die Spalte **Models** ist dann ausgeblendet, weil der Pool keine einzelne Verbindung hat.

Auf dem Handy tippst du neben dem Nachrichtenfeld auf den Pfeil und öffnest den Tab **Connections**. Ein Tipp auf eine Verbindung stellt den Chat auf sie um, und das Menü schließt sich. Willst du ein Modell wählen, tipp stattdessen auf den Pfeil am rechten Ende der Verbindungszeile. Ihre Modelle öffnen sich im selben Menü, und der Chat wechselt erst, wenn du eines auswählst. Mit dem Zurück-Pfeil kehrst du zur Verbindungsliste zurück.

**Ein Modellwechsel gilt überall, wo die Verbindung genutzt wird.** Der Hinweis unten im Menü, „Model changes are saved to this connection.“, bedeutet: Agenten, Hilfsfunktionen und andere Chats, die dieselbe Verbindung nutzen, wechseln ebenfalls auf das neue Modell. Andere Modell-Einstellungen der Verbindung, etwa ihr Embedding-Modell oder die Verbindung für die Bildbeschreibung, bleiben unverändert. Willst du nur für einen bestimmten Zweck ein anderes Modell, dupliziere die Verbindung und ändere die Kopie.

## Verbindungen exportieren und importieren

Verbindungen lassen sich in eine Datei exportieren – als Backup oder für den Umzug auf eine andere Installation. Später importierst du sie einfach wieder.

**Ein Export enthält niemals die API-Keys.** Nach dem Import musst du jede Verbindung öffnen und den API-Key erneut eintragen. Angeheftete Modelle sind enthalten, die gespeicherte Modellliste dagegen nicht. Sie wird neu geladen, wenn du die Modelle der Verbindung zum ersten Mal öffnest.

Um eine einzelne Verbindung zu exportieren, öffne sie im Editor und klick auf ihre Schaltfläche **Export** (das Upload-Symbol). Für mehrere auf einmal nutzt du den **Select**-Modus im Panel und klickst in der Aktionsleiste auf **Export**. Vor dem Download zeigt Marinara das Dialogfenster **Export Connection Data** (Verbindungsdaten exportieren) mit dieser Warnung: This will export your connection data, WITHOUT your provided API Key. Remember to never share those with others! Klick auf **Export**, um fortzufahren.

Eine einzelne Verbindung wird als `.connection.json`-Datei heruntergeladen. Mehrere Verbindungen kommen gemeinsam als `marinara-connections.zip`-Datei.

Zum Importieren klickst du oben im Connections-Panel auf **Import** (Importieren). Das Fenster **Import Connections** (Verbindungen importieren) öffnet sich. Zieh eine oder mehrere `.json`-Dateien hinein oder klick, um sie auszuwählen. Das Fenster erinnert dich: Imported connections never include API keys. Add each key again after import. Nach dem Import hat jede neue Verbindung einen leeren API-Key, bis du ihn ausfüllst.

## Verwandte Anleitungen

- [Verbindung zu einem KI-Anbieter herstellen](connecting-to-a-provider.md)
- [Überblick über die Chat Settings](../chats/chat-settings.md)
