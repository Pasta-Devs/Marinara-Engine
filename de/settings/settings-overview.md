# Überblick über die Einstellungen

Finde heraus, welcher Teil von **Settings** (Einstellungen) welche Steuerung enthält, richte den Tab **General** ein und erfahre, wie sich deine Einstellungen zwischen Geräten abgleichen.

## Das Settings-Panel und seine sechs Tabs

Öffne **Settings** über das Zahnradsymbol in der oberen Leiste. Das Feld **Search settings** (Einstellungen durchsuchen) ganz oben findet eine Einstellung über ihren Namen. Tipp ein Wort wie `delete`, `streaming` oder `quotes` ein, und Marinara springt zum passenden Abschnitt. Die Suche findet Namen in deiner Oberflächensprache und auf Englisch.

Das Panel hat sechs Tabs. Jeder Tab hat eigene Abschnitte.

### Ich möchte …

| Ich möchte … | Gehe zu |
| --- | --- |
| Die Sprache ändern | **Settings → General → App Behavior → Language** |
| Den Text vergrößern | **Settings → Appearance → App → Text & Scale** |
| Theme oder Farben ändern | **Settings → Appearance → App → App Style** |
| Einen Benachrichtigungston festlegen | **Settings → General → Notifications** |
| Die Löschbestätigung abschalten | **Settings → General → App Behavior** |
| Schnelle Antworten hinzufügen | **Settings → General → Input & Editing** |
| Ein Backup erstellen | **Settings → Advanced → Backup & Export** |
| Meine Daten löschen | **Settings → Advanced → Danger Zone** |
| Marinara aktualisieren | **Settings → Advanced → Updates** |

### Was jeder Tab enthält

**General** (diese Anleitung):

- **App Behavior** (mit der Zeile **Search and Professor Mari settings**)
- **Notifications**
- **Responses**
- **Input & Editing**
- **Text Rules**
- **Game Playback**

**Appearance** hat vier Schaltflächen. Siehe [Darstellungseinstellungen](../appearance/appearance-settings.md).

- **App**: **App Style**, **Text & Scale**, **Atmosphere**, **Backgrounds**
- **Conversation**: **Conversation Display**, **Conversation Theme**
- **Roleplay**: **Tracker Panel**, **Roleplay Presentation**
- **Game**: **Game Presentation**

**Generations** hat **Overall Generations**, **Image Generation**, **Video Generation** und **Prompt Overrides**. Bis du den Agenten Illustrator installierst, zeigt dieser Tab nur eine Aufforderung zum Herunterladen. Siehe [Stilprofile](../media/style-profiles.md) und [Szenenvideo](../media/scene-video.md).

**Addons** enthält die Versionshistorie der Erweiterungen, **Personal Extensions**, **External Extensions** (nur nach der Freischaltung) und die **Theme Library**. Siehe [Personal Extensions](../extending/personal-extensions.md) und [Eigene CSS-Themes](../appearance/custom-css-themes.md).

**Imports** enthält **Profile & Marinara**, **SillyTavern Import** und **Game Assets**. Siehe [Marinara sichern und wiederherstellen](../data/backup-and-restore.md) und [Aus SillyTavern importieren](../data/importing-from-sillytavern.md).

**Advanced** hat diese Abschnitte in dieser Reihenfolge. Siehe [Der Tab Advanced](#the-advanced-tab).

- **Multiplayer WIP**
- **Access**
- **Admin Access**
- **Features**
- **Updates**
- **Support Diagnostics**
- **Request timeouts**
- **Parameters**
- **Message Tools**
- **Backup & Export**
- **Storage Optimization**
- **Danger Zone**

## Der Tab General

Jeder Abschnitt des Tabs **General** liegt unter **Settings → General**.

| Abschnitt | Was er steuert |
| --- | --- |
| **App Behavior** | Sprache, Löschschutz, Schalter zum Ein- und Ausblenden und die Zeile **Search and Professor Mari settings**. Siehe [App Behavior](#app-behavior). |
| **Notifications** | Benachrichtigungstöne sowie Benachrichtigungen im Browser und unter Android. Siehe [Notifications](#notifications). |
| **Responses** | Streaming, Kürzen und **Messages per page**. Siehe [Nachrichten senden und streamen](../chats/sending-and-streaming.md). |
| **Input & Editing** | **Send on Enter**, **Quick replies**, Tastenkürzel für Swipes und Bearbeiten. Siehe [Input & Editing](#input-and-editing). |
| **Text Rules** | Wie Chat-Text formatiert wird. Siehe [Text Rules](#text-rules). |
| **Game Playback** | Lesen und Navigieren im Game Mode. Siehe [Game Mode: Erste Schritte](../game/getting-started.md). |

### App Behavior

| Einstellung | Was sie bewirkt |
| --- | --- |
| **Language** | Legt die Sprache der Oberfläche fest. Sie ändert keine Prompts ans Modell und keinen Chat-Inhalt. Noch nicht übersetzter Text erscheint auf Englisch. Arabisch nutzt ein Layout von rechts nach links. Standard: Englisch. |
| **Documentation Language** | Legt die Sprache der eingebauten Anleitungen fest. Siehe unten. Standard: Englisch. |
| **Confirm before deleting** | Fragt nach, bevor Marinara einen Chat, einen Charakter oder ein anderes Element endgültig löscht. Standard: an. |
| **Hide chat Help button** | Blendet die Schaltfläche **Help** in Conversation-, Roleplay- und Game-Chats aus. Standard: aus. |
| **Show Android status bar** | Lässt Uhrzeit, Akkustand und Benachrichtigungssymbole über Marinara sichtbar. Wirkt nur in der Android-App. Standard: aus. |
| **Achievements** | Zählt Errungenschaften, zeigt Hinweise zur Freischaltung sowie das Lesezeichen und das Widget auf dem Home-Bildschirm. Siehe [Errungenschaften](../home/achievements.md). Standard: an. |
| **Disable seasonal ME themes** | Schaltet die saisonalen Themes von Marinara ab. Standard: aus. |
| **Music Player** | Zeigt den kompakten Music Player. Er braucht den Agenten **Music DJ** unter **Agents → Agent Organizer** und bleibt ausgegraut, bis du ihn installierst. Siehe [Musik](../media/music.md). Standard: an. |

**Search and Professor Mari settings** ist eine Zeile am Ende von **App Behavior**. Wähle **Open** (Öffnen), um zur Einstellungsseite für die Suche, schnelle Antworten und Professor Mari zu gehen. Siehe [Professor Mari](../home/professor-mari.md).

Die Oberfläche gibt es auf Arabisch, in vereinfachtem Chinesisch, auf Englisch, Französisch, Deutsch, Hindi, Japanisch, Koreanisch, Polnisch, in brasilianischem Portugiesisch, auf Russisch und Spanisch. Wenn du eine Übersetzung verbessern oder eine Sprache hinzufügen willst, siehe [UI-Lokalisierung](../development/localization.md).

Bei **Documentation Language** ist Englisch fest eingebaut. Wähle eine andere Sprache und klicke auf **Download & Replace** (Herunterladen & Ersetzen). Marinara lädt dieses Sprachpaket einmal herunter und entfernt das vorherige, sodass immer nur eine heruntergeladene Sprache gespeichert ist. Anleitungen, die noch nicht übersetzt sind, öffnen sich auf Englisch mit einem kleinen `EN`-Badge. Die Doku-Suche arbeitet in der aktiven Sprache. Deine Wahl bleibt bei Updates erhalten, und das Paket wird nach einem Update aufgefrischt, wenn sich seine Übersetzungen geändert haben. Fehlen die heruntergeladenen Anleitungen oder sind sie beschädigt, erscheint die Schaltfläche **Fix documentation** (Dokumentation reparieren). Sie lädt das Paket erneut herunter oder setzt die Anleitungen auf Englisch zurück, wenn die Download-Quelle nicht erreichbar ist.

### Notifications

Marinara spielt einen eingebauten Ton für Benachrichtigungen ab. So nutzt du deinen eigenen Ton:

1. Öffne **Settings → General → Notifications**.
2. Lade unter **Custom sound** eine Datei hoch: MP3, WAV, OGG, M4A, MP4 oder WebM, bis zu 10 MB.

Der Ton spielt auf jedem Gerät, das mit diesem Server verbunden ist. Du kannst ihn anhören, ersetzen oder entfernen. Kann Marinara die Datei nicht lesen, spielt es den eingebauten Ton. Die Datei ist Teil von Backups und Profil-Exporten.

**Background Notifications** gelten für Conversation-Nachrichten, die Charaktere von sich aus senden. **Generation Completion Notifications** gelten für Antworten, die du selbst in Conversation, Roleplay und Game Mode startest. Beide funktionieren, solange Marinara geöffnet, aber nicht im Vordergrund ist. Sie zeigen nie den Inhalt von Nachrichten.

<a id="input-and-editing"></a>

### Input & Editing

Diese Einstellungen findest du unter **Settings → General → Input & Editing**:

| Einstellung | Was sie bewirkt |
| --- | --- |
| **Send on Enter** | Legt fest, welche Modi beim Druck auf Enter senden. |
| **Keep guidance after regenerating** | Lässt deine Vorgabe nach einem geführten Neugenerieren im Nachrichtenfeld stehen. Standardmäßig an. |
| **Add CYOA choices to the message box instead of sending them** | Legt eine angeklickte Auswahl in dein Nachrichtenfeld, damit du sie zuerst bearbeiten kannst. |
| **Quick replies** | Fügt neben der Senden-Schaltfläche Entwurfsaktionen hinzu. Siehe [Geführte Generierung und Impersonate](../chats/guided-and-impersonate.md). |
| **Speech-to-text microphone** | Zeigt in Chat-Eingaben eine Mikrofon-Schaltfläche. |
| **Intuitive swipe navigation** | Wechselt mit Pfeiltasten oder per Wischgeste zwischen Swipes (mehreren Antworten, die in einer Nachricht gespeichert sind). |
| **Reroll past the newest swipe** | Erzeugt eine neue Antwort, wenn du über den neuesten Swipe hinauswischst. |
| **Up Arrow edits last message** | Pfeil nach oben bei leerer Eingabe bearbeitet deine letzte Nachricht. |
| **Double-click edits messages** | Ein Doppelklick auf eine Roleplay-Nachricht öffnet sie zum Bearbeiten. |

Der Abschnitt **Responses** hat **Enable streaming**, **Streaming speed**, **Trim incomplete sentences from the response**, **Add a new line before /continue text** (standardmäßig an) und **Messages per page**. Siehe [Nachrichten senden und streamen](../chats/sending-and-streaming.md). Zu den Nachrichtenaktionen siehe [Nachrichtenaktionen](../chats/messages.md).

### Text Rules

Diese Regeln ändern, wie Chat-Text unter **Settings → General → Text Rules** behandelt wird. **Bold dialogue in quotes** und **Convert LaTeX symbols** ändern nur, wie Text aussieht, deine gespeicherten Nachrichten bleiben also gleich. **Quote style** schreibt die Anführungszeichen in dem Text um, den du tippst und speicherst.

| Einstellung | Was sie bewirkt |
| --- | --- |
| **Bold dialogue in quotes** | Zeigt Text in Anführungszeichen fett. Standardmäßig an. |
| **Convert LaTeX symbols** | Zeigt LaTeX-Mathebefehle als Symbole. Code bleibt unangetastet. Standardmäßig an. |
| **Quote style** | **Straight** behält einfache Zeichen bei (Standard). **Typographic** schreibt sie in geschwungene Anführungszeichen und Apostrophe um. |
| **Load images from other websites in messages** | Steuert Bilder, die auf anderen Websites liegen. Standardmäßig aus. |

#### Bold dialogue in quotes

Ist die Regel an, erscheinen die Wörter in den Anführungszeichen von `"I missed you," she said.` fett. Schalte sie aus, damit der Dialog seine Farbe behält, aber nicht fett ist.

#### Convert LaTeX symbols

Manche Modelle schreiben Mathe als LaTeX-Befehle. Ist die Regel an, erscheinen `\rightarrow`, `\neq`, `\times` und `\alpha` als `→`, `≠`, `×` und `α`.

#### Load images from other websites in messages

Ist die Einstellung aus, zeigt ein Bild von einer anderen Website in einer Nachricht, einer Begrüßung oder einer Kartenvorschau den Namen der Website und die Schaltfläche **Load image** (Bild laden). So kann eine Nachricht nicht von sich aus andere Websites kontaktieren. Wähle **Load image**, um dieses Bild anzuzeigen. Marinara merkt sich deine Wahl auf all deinen Geräten. Schalte die Einstellung ein, um jedes Bild sofort anzuzeigen. Bilder, die in Marinara gespeichert sind, etwa Galeriebilder, Avatare und Sprites, erscheinen immer.

<a id="the-advanced-tab"></a>

## Der Tab Advanced

| Abschnitt | Mehr dazu |
| --- | --- |
| **Admin Access** | [Fernzugriff](../REMOTE_ACCESS.md) |
| **Features** | [Funktionsschalter](../configuration/features.md) |
| **Updates** | [Marinara Engine aktualisieren](../UPGRADING.md) |
| **Message Tools** | [Message Tools](#message-tools) |
| **Backup & Export** | [Marinara sichern und wiederherstellen](../data/backup-and-restore.md) |
| **Danger Zone** | [Daten löschen oder zurücksetzen](../data/clearing-data.md) |

### Message Tools

Diese Schalter findest du unter **Settings → Advanced → Message Tools**. Alle sind standardmäßig aus, außer **Show context usage** und **Show "older messages not sent" note**.

| Schalter | Was er bewirkt |
| --- | --- |
| **Show message timestamps** | Zeigt Datum und Uhrzeit an jeder Nachricht. |
| **Show characters in Persona pickers** | Listet deine Charaktere in den Persona-Auswahlen auf, damit du als einer von ihnen spielen kannst. |
| **Show model name on messages** | Zeigt, welches Modell jede Antwort geschrieben hat. |
| **Show token usage on messages** | Zeigt pro Nachricht die Tokens für Prompt und Antwort. |
| **Show context usage** | Zeigt in den Verbindungswechslern und in den Chat-Einstellungen von Game, wie voll das Kontextfenster bei der zuletzt gemessenen Anfrage war. |
| **Show message numbers** | Zeigt an jeder Nachricht eine Nummer. |
| **Show "older messages not sent" note** | Zeigt unter der neuesten Antwort einen Hinweis, wenn ältere Nachrichten nicht mehr in den Prompt gepasst haben. Eine abgeschnittene oder leere Antwort zeigt weiterhin ihren eigenen Hinweis. |
| **Guide swipes/regens with chat input** | Nutzt deinen Entwurf als Vorgabe, wenn du neu generierst. |
| **Include reasoning in exports** | Nimmt die verborgenen Denkschritte des Modells in Chat-Exporte auf. |
| **Include private notes in exports** | Nimmt deine privaten Notizen zu Nachrichten in JSONL- und Text-Exporte auf. Lass den Schalter aus, wenn du ein Transkript teilst. |
| **Debug mode** | Protokolliert Modell-Payloads in der Serverkonsole für den Support. |

Mehr dazu in [Nachrichtenaktionen](../chats/messages.md), [Personas](../characters/personas.md), [Ein Modell für einen einzelnen Chat wählen](../connections/connecting-to-a-provider.md#choosing-a-model-for-one-chat), [Peek Prompt](../chats/peek-prompt.md), [Geführte Generierung und Impersonate](../chats/guided-and-impersonate.md), [Chats exportieren und importieren](../chats/export-import.md) und [Fehlerbehebung](../TROUBLESHOOTING.md).

## Wie sich Einstellungen zwischen Geräten abgleichen

Marinara speichert die meisten Einstellungen auf dem Server, damit sie dir zwischen Browsern und Geräten folgen.

1. Du änderst eine Einstellung unter **Settings**.
2. Etwa eine Sekunde später speichert Marinara sie auf dem Server.
3. Ein anderer Browser, der denselben Marinara-Server öffnet, lädt diese Einstellungen.

Die neueste Änderung gewinnt. Öffnest du Marinara kurz nach einer Änderung auf einem zweiten Gerät, kann dessen ältere Fassung deine Änderung ersetzen. Warte einen Moment, bevor du das Gerät wechselst.

Zwei Einstellungen gleichen sich nie ab. Stelle sie auf jedem Gerät erneut ein, unter **Settings → Appearance → Text & Scale**:

- **Display Size**, die Textgröße der Oberfläche
- **Chat Font Size**, die Textgröße im Chat

Siehe [Darstellungseinstellungen](../appearance/appearance-settings.md). Ist der Server nicht erreichbar, arbeitet die App mit deinen lokalen Einstellungen weiter und versucht es bei deiner nächsten Änderung erneut.

## Verwandte Anleitungen

- [Darstellungseinstellungen](../appearance/appearance-settings.md)
- [Nachrichtenaktionen](../chats/messages.md)
- [Wo Marinara deine Daten speichert](../data/where-data-is-stored.md)
- [Fehlerbehebung](../TROUBLESHOOTING.md)
