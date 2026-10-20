# Überblick über die Einstellungen

In dieser Anleitung erfährst du, wie das **Settings**-Panel (Einstellungen) von Marinara Engine aufgebaut ist: sechs Tabs und was sich in jedem davon steuern lässt. Ausführlich behandelt werden der Tab **General**, die **Text Rules** (Textregeln) für die Formatierung des Chat-Texts und der Abgleich der Einstellungen zwischen deinen Geräten.

## Das Settings-Panel und seine sechs Tabs

Öffne **Settings** über das Zahnradsymbol in der oberen Leiste. Ganz oben im Panel sitzt das Feld **Search settings** (Einstellungen durchsuchen). Tipp ein beliebiges Wort ein – etwa `delete`, `streaming` oder `quotes` – und Marinara springt direkt zum passenden Abschnitt. Eine Einstellung findet die Suche über ihren Namen in deiner Oberflächensprache oder auf Englisch.

Das Panel hat sechs Tabs. Die Tabelle zeigt, was sich in welchem Tab einstellen lässt.

| Tab | Was du dort einstellst |
| --- | --- |
| **General** | App-Verhalten, Benachrichtigungen, Antworten, Eingabe, Textregeln und Wiedergabe im Game Mode. |
| **Appearance** | Theme, Farben, Schriften, Chat-Layout, Bewegung und Hintergründe. |
| **Generations** | Standardwerte für Bild und Video sowie wiederverwendbare Prompt-Vorlagen. |
| **Addons** | Professor Maris abgeschottete Entwürfe für **Personal Extensions**, optional freigeschaltete **External Extensions** und eigene Themes. |
| **Imports** | Vollständige Profile wiederherstellen und aus anderen Apps importieren. |
| **Advanced** | Admin-Zugang, optionale Funktionsschalter, Updates, Werkzeuge für Nachrichten, Backups und unwiderrufliche Zurücksetzungen. |

Mehr zu den einzelnen Tabs steht hier:

- **General**: auf dieser Seite (siehe die Abschnitte weiter unten).
- **Appearance**: siehe [Darstellungseinstellungen](../appearance/appearance-settings.md).
- **Generations**: siehe [Stilprofile](../media/style-profiles.md) und [Szenenvideo](../media/scene-video.md).
- **Addons**: siehe [Personal Extensions](../extending/personal-extensions.md) und [Eigene CSS-Themes](../appearance/custom-css-themes.md).
- **Imports**: siehe [Aus SillyTavern importieren](../data/importing-from-sillytavern.md) und [Backup und Wiederherstellung](../data/backup-and-restore.md).
- **Advanced**: siehe den Abschnitt **Message Tools** weiter unten, [Funktionsschalter](../configuration/features.md) sowie [Marinara Engine aktualisieren](../UPGRADING.md), [Fernzugriff](../REMOTE_ACCESS.md) und [Daten löschen](../data/clearing-data.md).

## Einstellungen, Tab General

Der Tab **General** enthält sechs Abschnitte. Zwei davon behandelt diese Seite vollständig: **App Behavior** (App-Verhalten) und **Text Rules**. Die übrigen fasst diese Seite nur kurz zusammen; ausführlich stehen sie in ihren eigenen Anleitungen.

- **App Behavior**: Sprache, Löschschutz und Schalter zum Ein- und Ausblenden. Siehe unten.
- **Notifications**: Benachrichtigungstöne plus getrennte Regler für Browser und Android-App. Lade unter **Custom sound** eine eigene Datei im Format MP3, WAV, OGG, M4A/MP4 oder WebM hoch (bis 10 MB), um Marinaras eingebauten Ton für alle Geräte an diesem Server zu ersetzen. Du kannst sie jederzeit anhören, austauschen oder entfernen; lässt sich die Datei nicht lesen, greift wieder der eingebaute Ton. Sie landet außerdem in Backups und Profil-Exporten. **Background Notifications** gelten für autonome Nachrichten im Modus Conversation, **Generation Completion Notifications** dagegen für Antworten, die du in Conversation, Roleplay und Game selbst anstößt. Beide greifen, solange Marinara geöffnet, aber nicht im Vordergrund ist; der Nachrichteninhalt bleibt verborgen.
- **Responses**: wie Antworten gestreamt, gespeichert und auf Seiten verteilt werden. Siehe [Nachrichten senden und streamen](../chats/sending-and-streaming.md).
- **Input & Editing**: Nachrichteneingabe und schnelle Bearbeitung. Siehe [Nachrichtenaktionen](../chats/messages.md).
- **Text Rules**: Formatierung für den Chat-Text. Siehe unten.
- **Game Playback**: Lesen und Navigieren im Game Mode.

## App Behavior

Diesen Abschnitt findest du unter **Settings** > **General** > **App Behavior**. Er steuert das tägliche Verhalten der App und ein paar Schalter zum Ein- und Ausblenden.

- **Language**: Sprache der Oberfläche. Marinara bringt derzeit Arabisch, vereinfachtes Chinesisch, Englisch,
  Französisch, Deutsch, Hindi, Japanisch, Koreanisch, Polnisch, brasilianisches Portugiesisch, Russisch und Spanisch mit. Arabisch nutzt ein
  Layout von rechts nach links. Noch nicht übersetzte Oberflächentexte erscheinen auf Englisch. Diese Einstellung ändert
  Marinaras Bedienelemente und Hinweise, nicht die Prompts ans Modell oder den Chat-Inhalt. Wenn du eine Übersetzung verbessern oder eine weitere
  Sprache beisteuern willst, siehe [UI-Lokalisierung](../development/localization.md).
- **Documentation Language**: die Sprache der eingebauten Anleitungen, unabhängig von der Oberflächensprache darüber. Englisch ist fest eingebaut und wird nie heruntergeladen. Wählst du eine andere Sprache als Englisch, erscheint die Schaltfläche **Download & Replace** (Herunterladen & Ersetzen). Sie lädt das Sprachpaket einmalig herunter und entfernt das vorherige Paket – es bleibt also nur eine heruntergeladene Sprache gespeichert. Noch nicht übersetzte Anleitungen öffnen sich auf Englisch mit einem kleinen `EN`-Badge, und die Doku-Suche arbeitet in der aktiven Sprache. Deine Wahl übersteht Updates. Haben sich die Übersetzungen geändert, frischt Marinara das Paket nach dem Update automatisch auf. Fehlen die heruntergeladenen Anleitungen oder sind sie beschädigt, erscheint die Schaltfläche **Fix documentation** (Dokumentation reparieren): Sie lädt das Paket neu und schaltet auf Englisch zurück, wenn die Download-Quelle nicht erreichbar ist.
- **Confirm before deleting**: standardmäßig an. Ist der Schalter an, fragt Marinara nach, bevor ein Chat, ein Charakter oder ein anderes Element endgültig verschwindet. Lass ihn an, damit nichts versehentlich gelöscht wird.
- **Hide chat Help button**: standardmäßig aus. Ist der Schalter an, verschwindet die Schaltfläche **Help** (Hilfe) aus Conversation-, Roleplay- und Game-Chats.
- **Show Android status bar**: standardmäßig aus und nur in der Android-App von Marinara Engine wirksam. Ist der Schalter an, bleiben Uhrzeit, Akkustand und Benachrichtigungssymbole über Marinara sichtbar.
- **Achievements**: standardmäßig an. Ist der Schalter an, zeigt der Home-Bildschirm das Lesezeichen **Achievements** und meldet freigeschaltete Errungenschaften. Das optionale Widget **Achievements** erscheint, wenn du es deinem Home-Layout hinzugefügt hast. Aus bleibt die Zählung im Hintergrund still. Siehe [Errungenschaften](../home/achievements.md).
- **Music Player**: standardmäßig an. Ist der Schalter an, erscheint der kompakte Music Player. Er braucht den Agenten **Music DJ** aus **Agents** > **Download Agents**, und der Schalter bleibt ausgegraut, bis du ihn installierst. Siehe [Musik](../media/music.md).
- **Search and Professor Mari settings**: Wähle **Open** (Öffnen), um zu ihrer Einstellungsseite zu wechseln. Dort liegen alle Einstellungen für Suche und Professor Mari, aufgeteilt in diese Gruppen:

  - **Search**: das Angebot, ein Feld zu verbessern, und der Suchverlauf.
  - **Quick answers**: **Quick answers in Search**, **Answer with** und **Wait after typing**.
  - **Search window** (Suchfenster) und **Professor Mari window** (Professor-Mari-Fenster): Jedes der beiden Fenster hat die Einstellungen **Height** (Höhe) und **Width** (Breite). Auf Handys sind diese Gruppen nicht zu sehen.
  - **Professor Mari**: Professor Mari aus der Suche fragen, der Berechtigungsmodus, **Runtime** (Laufzeitumgebung), die Antwort-Chips, wie sich Änderungskarten öffnen, und ob Enter an Professor Mari sendet.
  - **Around the app**: Besuche von Mini Professor Mari.
  - **Appearance**: ihr Aussehen. Jedes Paket zeigt ihr Porträt. Das aktive trägt **In use**. Bei einem gesperrten Paket siehst du, wie viel Spielzeit du bis zur Freischaltung schon gesammelt hast.

  Das Zahnrad in der Suche öffnet dieselbe Seite. Suchst du nach einer dieser Einstellungen – unter ihrem neuen oder alten Namen –, landest du direkt bei ihr.

## Text Rules

Diesen Abschnitt findest du unter **Settings** > **General** > **Text Rules**. Diese Regeln bestimmen, wie Marinara mit dem Chat-Text umgeht. **Bold dialogue in quotes** und **Convert LaTeX symbols** betreffen nur die Anzeige und rühren die gespeicherten Nachrichten nie an. **Quote style** ist anders: Diese Regel schreibt die Anführungszeichen in dem Text um, den du tippst und speicherst.

### Bold dialogue in quotes

Standardmäßig an. Ist die Regel an, erscheint Text in Anführungszeichen fett. Nimm diese Zeile:

```
"I missed you," she said.
```

Mit aktivem **Bold dialogue in quotes** stehen die Wörter `I missed you` fett da. Schalte die Regel aus, wenn der Dialog seine Farbe behalten soll, aber nicht fett sein darf.

### Convert LaTeX symbols

Standardmäßig an. Manche Modelle schreiben Formeln mit LaTeX-Befehlen. Ist die Regel an, zeigt Marinara gängige Befehle wie `\rightarrow`, `\neq`, `\times` und `\alpha` als normale Symbole an. `\times` erscheint zum Beispiel als Malzeichen `×` und `\alpha` als griechischer Buchstabe `α`. Code-Schnipsel bleiben unangetastet.

### Quote style

Legt fest, wie Marinara die Anführungszeichen vereinheitlicht. Anders als die beiden Regeln oben ändert das den Text selbst: Nachrichten, die du tippst und speicherst, werden auf den gewählten Stil umgeschrieben. Es gibt zwei Optionen:

- **Straight**: behält einfache Schreibmaschinenzeichen bei, etwa `"Hello," it's me.` Das ist der Standard.
- **Typographic**: ersetzt gerade Zeichen durch typografische Anführungszeichen und Apostrophe.

### Load images from other websites in messages

Standardmäßig aus. Ist die Einstellung aus, zeigt ein Bild von einer anderen Website in einer Nachricht, einer Begrüßung oder einer Kartenvorschau stattdessen den Namen der Website und die Schaltfläche **Load image** (Bild laden). So kann eine Nachricht nicht von sich aus andere Websites kontaktieren. Wähle **Load image**, um dieses Bild anzuzeigen; Marinara merkt sich das auf all deinen Geräten. Schalte die Einstellung ein, um jedes Bild sofort anzuzeigen. Bilder, die in Marinara gespeichert sind, etwa Galeriebilder, Avatare und Sprites, erscheinen immer.

## Responses und Input & Editing

Diese beiden Abschnitte im Tab **General** regeln, wie Antworten eintreffen und wie du tippst und bearbeitest. Hier die Bedienelemente, jeweils mit Link zur vollständigen Anleitung.

Der Abschnitt **Responses** steuert:

- **Enable streaming**: den KI-Text Wort für Wort anzeigen, während er entsteht.
- **Streaming speed**: wie schnell der gestreamte Text erscheint.
- **Trim incomplete sentences from the response**: einen angefangenen Satz am Ende vor dem Speichern abschneiden.
- **Add a new line before /continue text**: Text, den `/continue` ergänzt, nach einer Leerzeile beginnen lassen. Standardmäßig an.
- **Messages per page**: wie viele Nachrichten auf einmal geladen werden.

Mehr dazu in [Nachrichten senden und streamen](../chats/sending-and-streaming.md).

Der Abschnitt **Input & Editing** steuert:

- **Send on Enter**: in welchen Modi Enter die Nachricht abschickt.
- **Keep guidance after regenerating**: deine Vorgabe nach einem geführten Neugenerieren im Nachrichtenfeld stehen lassen. Standardmäßig an.
- **Add CYOA choices to the message box instead of sending them**: Eine angeklickte CYOA-Auswahl landet in deinem Nachrichtenfeld, sodass du sie vor dem Senden bearbeiten kannst.
- **Quick replies**: weitere Entwurfsaktionen neben der Senden-Schaltfläche. Siehe [Geführte Generierung und Impersonate](../chats/guided-and-impersonate.md).
- **Speech-to-text microphone**: eine Mikrofon-Schaltfläche in den Chat-Eingaben anzeigen.
- **Intuitive swipe navigation**: mit Pfeiltasten oder Wischgesten zwischen alternativen Antworten wechseln.
- **Reroll past the newest swipe**: eine neue Antwort erzeugen, wenn du über den neuesten Swipe hinauswischst.
- **Up Arrow edits last message**: Pfeil nach oben bei leerer Eingabe bearbeitet die letzte Nachricht.
- **Double-click edits messages**: ein Doppelklick auf eine Roleplay-Nachricht öffnet sie zum Bearbeiten.

Mehr dazu in [Nachrichtenaktionen](../chats/messages.md).

## Message Tools

Den Abschnitt **Message Tools** findest du unter **Settings** > **Advanced** > **Message Tools**. Er bündelt Schalter für Anzeige und Reparatur. Alle Schalter unten sind standardmäßig aus, außer **Show context usage** (Kontextauslastung anzeigen) und **Show "older messages not sent" note** (Hinweis „ältere Nachrichten nicht gesendet“ anzeigen), die an sind. Die Tabelle zeigt, was sie bewirken und wo mehr dazu steht.

| Schalter | Wirkung | Ausführliche Anleitung |
| --- | --- | --- |
| **Show message timestamps** | Zeigt Datum und Uhrzeit an jeder Nachricht. | [Nachrichtenaktionen](../chats/messages.md) |
| **Show characters in Persona pickers** | Listet deine Charaktere in den Persona-Auswahlen auf, damit du einen von ihnen spielen kannst. | [Personas](../characters/personas.md) |
| **Show model name on messages** | Zeigt, welches KI-Modell die jeweilige Antwort geschrieben hat. | [Nachrichtenaktionen](../chats/messages.md) |
| **Show token usage on messages** | Zeigt pro Nachricht die Tokens für Prompt und Antwort. | [Nachrichtenaktionen](../chats/messages.md) |
| **Show context usage** | Zeigt in den Verbindungswechslern und in den Chat-Einstellungen von Game, wie voll der Kontext des Modells bei der zuletzt gemessenen Anfrage war. | [Verbindungen organisieren](../connections/organizing-connections.md#the-random-pool-and-quick-connection-switcher) |
| **Show message numbers** | Zeigt an jeder Nachricht im Chat eine Nummer. | [Nachrichtenaktionen](../chats/messages.md) |
| **Show "older messages not sent" note** | Zeigt unter der neuesten Antwort einen Hinweis, wenn ältere Nachrichten nicht mehr in den Prompt gepasst haben. Ausgeschaltet bleibt dieser Hinweis in langen Chats verborgen. Eine abgeschnittene oder leere Antwort zeigt weiterhin ihren eigenen Hinweis. | [Peek Prompt](../chats/peek-prompt.md) |
| **Guide swipes/regens with chat input** | Nutzt deinen aktuellen Entwurf als Vorgabe beim neu Generieren. | [Geführte Generierung und Impersonate](../chats/guided-and-impersonate.md) |
| **Include reasoning in exports** | Nimmt die verborgenen Denkschritte in Chat-Exporte auf. | [Chats exportieren und importieren](../chats/export-import.md) |
| **Include private notes in exports** | Nimmt deine privaten Notizen zu Nachrichten in JSONL- und Text-Exporte von Chats auf. Lass den Schalter aus, wenn du ein Transkript teilst. | [Chats exportieren und importieren](../chats/export-import.md) |
| **Debug mode** | Protokolliert die Modell-Payloads in der Serverkonsole für den Support. | [Fehlerbehebung](../TROUBLESHOOTING.md) |

Der Rest des Tabs **Advanced** wird an anderer Stelle erklärt. Zu **Updates** siehe [Marinara Engine aktualisieren](../UPGRADING.md), zu **Admin Access** siehe [Fernzugriff](../REMOTE_ACCESS.md), zu **Backup & Export** siehe [Backup und Wiederherstellung](../data/backup-and-restore.md) und zu **Danger Zone** siehe [Daten löschen](../data/clearing-data.md).

## Wie sich Einstellungen zwischen Geräten abgleichen

Marinara speichert die meisten Einstellungen auf dem Server, damit sie dir zwischen Browsern und Geräten folgen. So funktioniert der Abgleich der Einstellungen.

Und so läuft es ab:

1. Du änderst irgendwo in **Settings** eine Einstellung.
2. Rund eine Sekunde später schreibt Marinara die Änderung mit Zeitstempel auf den Server.
3. Öffnet ein anderer Browser denselben Marinara-Server, lädt er diese gespeicherten Einstellungen.

Jedes Gerät behält die neuere Fassung. Es gilt also: Der letzte Schreibvorgang laut Zeitstempel gewinnt. Eine Folge dieser Regel solltest du im Blick behalten. Öffnest du Marinara auf einem zweiten Gerät, kann dessen Fassung stillschweigend eine Einstellung überschreiben, die du gerade auf dem ersten Gerät geändert hast. Gib der App kurz Zeit für den Abgleich, bevor du das Gerät wechselst.

Zwei Einstellungen gleichen sich nie ab. Sie bleiben in dem Browser, in dem du sie gesetzt hast:

- **Display Size** (die Textgröße der Oberfläche)
- **Chat Font Size** (die Textgröße im Chat)

Beide sitzen unter **Settings** > **Appearance** > **Text & Scale**. Stell sie auf jedem Gerät erneut ein. Siehe [Darstellungseinstellungen](../appearance/appearance-settings.md).

Ist der Server nicht erreichbar, arbeitet die App mit den lokalen Einstellungen weiter und versucht es beim nächsten Mal erneut, sobald du etwas änderst.

## Verwandte Anleitungen

- [Darstellungseinstellungen](../appearance/appearance-settings.md)
- [Nachrichtenaktionen](../chats/messages.md)
- [Nachrichten senden und streamen](../chats/sending-and-streaming.md)
- [Chats exportieren und importieren](../chats/export-import.md)
- [Wo deine Daten liegen](../data/where-data-is-stored.md)
- [Marinara Engine aktualisieren](../UPGRADING.md)
- [Fehlerbehebung](../TROUBLESHOOTING.md)
- [Errungenschaften](../home/achievements.md)
- [Personal Extensions](../extending/personal-extensions.md)
- [UI-Lokalisierung](../development/localization.md)
