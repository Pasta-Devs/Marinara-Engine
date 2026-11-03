# Daten löschen oder zurücksetzen

Lösche einen Teil deiner Daten oder alle Daten endgültig über die **Danger Zone** (Gefahrenbereich). Es gibt kein Rückgängig.

Um einen einzelnen Chat oder Charakter zu löschen, nutze stattdessen seine eigene Löschen-Schaltfläche. Siehe [Chats verwalten](../chats/managing-chats.md) und [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md).

**Bevor du anfängst:** Erstelle ein Backup. Es gibt keinen Papierkorb. Siehe [Marinara sichern und wiederherstellen](backup-and-restore.md). Nutzt du Marinara von einem anderen Gerät aus, brauchst du außerdem das Admin-Secret. Siehe [Fernzugriff](../REMOTE_ACCESS.md).

## Einige Kategorien löschen

1. Öffne **Settings → Advanced** und scrolle zur **Danger Zone**.
2. Kreuze jede Kategorie an, die du löschen willst. **Select All** kreuzt alle Kästchen an. Sind alle angekreuzt, heißt dieselbe Schaltfläche **Clear Selection** und entfernt die Häkchen wieder.
3. Klicke auf **Clear Selected Data**. Sie bleibt deaktiviert, bis du eine Kategorie ankreuzt.
4. Lies die Warnung. Sie zeigt, wie viele Kategorien du gewählt hast.
5. Klicke auf **Confirm Delete**, oder auf **Cancel**, um abzubrechen. Bis du bestätigst, wird nichts gelöscht.

Hat es geklappt, meldet eine Nachricht, dass die gewählten Daten gelöscht wurden. Schlägt die Anfrage fehl, erscheint eine Fehlermeldung („Failed to clear selected data.“). Manche Daten können schon gelöscht sein. Prüfe daher, was übrig ist. Prüfe auch, ob du Admin-Zugang hast.

## Alles löschen

1. Klicke in der **Danger Zone** auf **Clear All Data**. Du musst kein Kästchen ankreuzen.
2. Die Warnung fragt: „Delete all supported data categories except Professor Mari? There is no undo.“
3. Klicke auf **Confirm Delete**, oder auf **Cancel**, um abzubrechen.

Das Ergebnis ist dasselbe, als würdest du alle acht Kästchen ankreuzen.

## Die acht Datenkategorien

Jede Kategorie löscht nur, was in ihrer Zeile steht, mit Ausnahme des Galerieordners unter der Tabelle.

| Kategorie | Was sie löscht |
| --- | --- |
| **Chats & Messages** | Alle Chats und ihren Inhalt sowie den ganzen Ordner `gallery` und Szenenvideos aus Game Mode. |
| **Characters** | Alle Charaktere und Gruppen samt ihren Avataren, außer Professor Mari. |
| **Personas** | Alle Personas und Gruppen samt ihren Avataren. |
| **Lorebooks** | Alle Lorebooks, Einträge und Ordner. |
| **Presets** | Alle Prompt-Presets und Preset-Ordner, außer dem eingebauten Standard-Preset. |
| **Connections** | Alle gespeicherten Konten sowie die damit verbundenen Modellauswahlen und Spracheinstellungen. |
| **Automation & Addons** | Alle Agenten-Einstellungen, eigene Tools, Regex-Skripte und synchronisierte Themes. Nicht Personal Extensions oder External Extensions. |
| **Media & Assets** | Hintergründe, Avatare, Sprites, Galerie, Szenenvideos, Schriftarten und Dateien von Wissensquellen. |

Mehr Details:

- **Chats & Messages** löscht auch Swipes (mehrere Antworten, die in einer Nachricht gespeichert sind), Erinnerungen, Agenten-Ergebnisse, Spielstände von Game Mode und Chat-Bilder.
- **Characters** und **Personas** löschen auch 2D- und 3D-Avatarmodelle.
- **Presets** löscht auch ihre Gruppen, Abschnitte und Variablen. Wenn ein anderes Preset der Standard war, wird das eingebaute Preset zum Standard.
- **Connections** leert auch die Einstellungen für Text-to-Speech und Speech-to-Text, die Modelle für Funktionen und einen Tripo-API-Key, der auf der Seite **3D Avatars** gespeichert war.
- **Automation & Addons** löscht auch Agenten-Ergebnisse, Agenten-Gedächtnis, Agenten-Ordner und Agenten-Widgets auf dem Home-Bildschirm.
- **Media & Assets** löscht auch die Asset-Liste und Chat-Bilder.
- Dateien von Wissensquellen sind Dateien, die du für Wissens-Agenten hochgeladen hast. Synchronisierte Themes sind deine eigenen Themes, die in Marinara gespeichert sind.

Manche Kategorien greifen auf Dateien außerhalb ihres Namens zu. **Chats & Messages** löscht den ganzen Ordner `gallery`, auch die Galeriebilder von Charakteren und Personas, selbst wenn du **Characters** oder **Personas** nicht angekreuzt hast.

Das Löschen berührt deine übrigen Einstellungen nicht, den Ordner `backups/` und die Datei `.encryption-key`. Es lässt außerdem Personal Extensions, Assets von Game Mode, eigene Emojis und Sticker, deinen Benachrichtigungston, Bilder von Lorebooks, Presets, Agenten und Konten sowie Daten des Langzeitgedächtnisses unberührt. Siehe [Wo Marinara deine Daten speichert](where-data-is-stored.md).

## Professor Mari bleibt erhalten

Professor Mari ist der eingebaute Assistent auf dem Home-Bildschirm. Die **Danger Zone** löscht sie nie, auch nicht mit **Clear All Data**.

## Verwandte Anleitungen

- [Marinara sichern und wiederherstellen](backup-and-restore.md)
- [Wo Marinara deine Daten speichert](where-data-is-stored.md)
- [Fernzugriff](../REMOTE_ACCESS.md)
