# Daten löschen oder zurücksetzen

In dieser Anleitung erfährst du, wie du Daten in Marinara Engine über die **Danger Zone** (Gefahrenbereich) endgültig löschst. Du kannst einzelne Kategorien leeren oder alles auf einmal. Ein Rückgängig gibt es nicht – lies deshalb zuerst die Warnungen.

## Wo die Danger Zone liegt

Alle Werkzeuge zum Löschen sitzen an einer Stelle.

1. Öffne **Settings** (Einstellungen).
2. Wechsle zum Tab **Advanced** (Erweitert).
3. Scroll ganz nach unten zum Abschnitt **Danger Zone**.

Die Beschreibung der **Danger Zone** lautet: "Permanently clear selected categories of local data. Professor Mari is always preserved."

Greifst du von einem anderen Gerät auf Marinara zu – also nicht vom Computer, auf dem die App läuft –, brauchst du Admin-Rechte fürs Löschen. Wie du das einrichtest, steht unter [Fernzugriff](../REMOTE_ACCESS.md).

## Vorher ein Backup anlegen

Gelöschte Daten lassen sich nicht zurückholen. Es gibt weder Papierkorb noch Zwischenablage. Nach der Bestätigung sind die Daten weg.

Leg vorher ein Backup an, damit du es dir später noch anders überlegen kannst. Siehe [Marinara sichern und wiederherstellen](backup-and-restore.md).

## Die acht Datenkategorien

Die **Danger Zone** zeigt eine Liste mit acht Kategorien zum Ankreuzen. Jede davon ist ein eigener Bereich. Kreuzt du eine Kategorie an, bleiben die anderen unberührt.

| Kategorie | Was gelöscht wird |
|---|---|
| **Chats & Messages** | Chats, Ordner, Nachrichten, Szenen- und OOC-Daten sowie den Laufzeitzustand der Chats. |
| **Characters** | Charaktere und Charaktergruppen. Professor Mari bleibt immer erhalten. |
| **Personas** | Personas und Persona-Gruppen. |
| **Lorebooks** | Lorebooks (Sammlungen von Weltwissen) und Lorebook-Einträge. |
| **Presets** | Prompt-Presets (gespeicherte Prompt-Vorlagen), Gruppen, Abschnitte und Variablen. |
| **Connections** | API-Verbindungen und Modell-Endpunkte. |
| **Automation & Addons** | Agenten, Tools, Regex-Skripte, synchronisierte Themes und den Automatisierungszustand. |
| **Media & Assets** | Hintergründe, Avatare, Sprites, Galerie-Objekte, Schriften und Dateien von Wissensquellen. |

Einige Kategorien löschen mehr als nur Datenbankeinträge. **Chats & Messages** entfernt zusätzlich den kompletten Galerie-Ordner auf der Festplatte samt allen Szenen-Videodateien. Betroffen sind auch die Galeriebilder von Charakteren und Personas, selbst wenn du **Characters** oder **Personas** gar nicht angekreuzt hast. **Media & Assets** löscht die Ordner auf der Festplatte für Hintergründe, Avatare, Sprites, Galerien, Szenen-Videodateien, Schriften und Dateien von Wissensquellen. **Connections** leert außerdem die gespeicherten Einstellungen für Text to Speech (TTS, Sprachausgabe) und Speech to Text (Spracherkennung), denn die hängen an einer Verbindung.

## Ausgewählte Kategorien löschen

Nimm diesen Weg, wenn ein Teil der Daten verschwinden und der Rest bleiben soll.

1. Kreuz jede Kategorie an, die du löschen willst.
2. Alle Kästchen auf einmal schaltest du mit der Schaltfläche **Select All** (Alle auswählen) um. Sind alle angekreuzt, heißt dieselbe Schaltfläche **Clear Selection** (Auswahl aufheben) und entfernt sämtliche Häkchen wieder.
3. Klick auf **Clear Selected Data** (Ausgewählte Daten löschen). Diese Schaltfläche bleibt deaktiviert, solange keine einzige Kategorie angekreuzt ist.
4. Es erscheint ein Warnfenster. Darin steht, wie viele Kategorien du gewählt hast, und der Hinweis, dass es kein Zurück gibt.
5. Klick auf **Cancel** (Abbrechen), um abzubrechen, oder auf **Confirm Delete** (Löschen bestätigen), um zu löschen. Bis zum Klick auf **Confirm Delete** wird nichts gelöscht.

Hat alles geklappt, erscheint eine Bestätigungsmeldung. Sie besagt, dass die gewählten Daten gelöscht und die Laufzeit-Caches sofort zurückgesetzt wurden.

## Alles löschen

Nimm diesen Weg, um alle acht Kategorien in einem Schritt zu leeren.

1. Klick auf **Clear All Data** (Alle Daten löschen). Vorher etwas anzukreuzen ist nicht nötig.
2. Ein Warnfenster fragt: "Delete all supported data categories except Professor Mari? There is no undo."
3. Klick auf **Cancel**, um abzubrechen, oder auf **Confirm Delete**, um alles zu löschen.

Das Ergebnis ist dasselbe, als würdest du jedes Kästchen ankreuzen und gemeinsam löschen.

## Professor Mari bleibt immer erhalten

Professor Mari ist der eingebaute Hilfs-Charakter. Diese Funktion löscht sie nie. Auch wenn du die Kategorie **Characters** leerst oder **Clear All Data** benutzt, bleibt Professor Mari bestehen. Über die **Danger Zone** lässt sie sich nicht entfernen.

## Verwandte Anleitungen

- [Marinara sichern und wiederherstellen](backup-and-restore.md)
- [Fernzugriff](../REMOTE_ACCESS.md)
