# Professor Mari, deine Assistentin in der App

Professor Mari ist die eingebaute Assistentin von Marinara Engine auf dem Home-Bildschirm. In dieser Anleitung erfährst du, wo du sie findest, was sie kann, wie sie ihre Änderungen umkehrbar hält und wie du typische Probleme löst.

<a id="where-to-find-her"></a>

## Wo du sie findest

Professor Mari wohnt auf dem Home-Bildschirm. Der Home-Bildschirm ist das, was du siehst, solange kein Chat geöffnet ist.

Halte Ausschau nach dem Widget **Professor Mari** mit ihrer Pixel-Grafik und klick dann auf **Ask Professor Mari** (Professor Mari fragen), um ihr komplettes Chatfenster zu öffnen. Auch der Tab **Professor** oben auf Home öffnet es. Ihr Fenster öffnet sich innerhalb der Suche, du erreichst sie also von jedem Bildschirm aus: Tipp etwas in das Suchfeld und wähl **Ask Prof. Mari** (Prof. Mari fragen), drück Strg+J (Cmd+J auf dem Mac) oder zieh auf dem Handy von der oberen Leiste nach unten. Eine Statuszeile im Kopf ihres Fensters zeigt **Ready to help** („bereit zu helfen“), wenn sie nichts zu tun hat, und **Working on it...**, während sie arbeitet.

Mit ihr sprichst du in ganz normaler Sprache. Tipp eine Nachricht in das Feld und drück Enter zum Abschicken. Shift und Enter zusammen fügen stattdessen eine neue Zeile ein. Schaltest du in ihren Einstellungen **Enter sends to Professor Mari** (Enter sendet an Professor Mari) aus, fügt Enter eine neue Zeile ein, und Strg+Enter (Cmd+Enter auf dem Mac) sendet.

Die allererste Nachricht an sie schaltet die Errungenschaft **Hello World** frei.

Ihren Zustand zeigt außerdem auf jedem Bildschirm eine dünne Linie am unteren Rand der oberen Leiste der App: Die Linie bewegt sich in Wellen, während Professor Mari arbeitet, wird grün, wenn sie fertig ist, golden, solange eine Freigabe wartet, und rot, wenn der letzte Durchlauf fehlgeschlagen ist. Sobald du ihren Chat öffnest, verschwindet die Linie wieder. Solange **Ask Professor Mari from Search** (Professor Mari aus der Suche fragen) ausgeschaltet ist, bleibt sie aus. Solange ihr Fenster geschlossen ist, zeigt ein kleines Statusabzeichen in der oberen Leiste denselben Zustand als **Working**, **Needs you**, **Done** oder **Failed**. Ein Klick auf das Abzeichen bringt dich zurück zu ihrem Chat. Alle ihre Einstellungen findest du in den Einstellungen für Suche und Professor Mari: über das Zahnrad in der Suche oder unter **Settings** (Einstellungen) > **General** (Allgemein) > **Search and Professor Mari settings** (Einstellungen für Suche und Professor Mari) > **Open** (öffnen).

Am Computer kannst du dort auch die Größe ihres Fensters ändern. Nutze die Schieberegler **Height** (Höhe) und **Width** (Breite) unter **Professor Mari window** (Fenster von Professor Mari). Die Regler unter **Search window** (Suchfenster) tun dasselbe für die Suche; ihre Höhe steht anfangs auf **Automatic** (automatisch). Auf dem Handy füllen beide Fenster immer den Bildschirm.

## Professor Mari aus deiner aktuellen Arbeit heraus fragen

Professor Mari ist mehr als ein Frage-Feld. Sie erklärt die App, hilft bei der Einrichtung und baut auf Zuruf Dinge für dich.

Du kannst Professor Mari genau dort öffnen, wo du Hilfe brauchst. Diese Einstiegspunkte legen einen bearbeitbaren Entwurf an und hängen eine kleine, typisierte Zusammenfassung des Kontexts an. Den angehängten Kontext kannst du vor dem Absenden wieder entfernen.

- Editoren für **Character**, **Persona**, **Lorebook** und **Preset**: Frag nach dem geöffneten Objekt oder nach einem ausgewählten Feld.
- Antworten in der **FAQ**: Mit **Ask Prof. Mari about this** (Prof. Mari dazu fragen) übernimmst du die gefundene Frage samt ihrer geschriebenen Antwort als Ausgangspunkt.
- **Search** (Suche): Drück `Cmd/Ctrl+K`, wähl ein Ergebnis aus und nimm es dann mit **Ask Prof. Mari** in den Entwurf auf. Die Suche selbst schickt keine Anfrage an ein Modell, es sei denn, eine schnelle Antwort ist eingeschaltet – siehe **Quick answers in Search** (schnelle Antworten in der Suche) weiter unten.
- **Recent Chats** (Letzte Chats) und andere Fehlerzustände: Mit **Ask Professor Mari** neben **Try again** (erneut versuchen) übergibst du ihr die Fehlerbeschreibung und die gewünschte Reparatur.
- Der normale Charakter-Chat mit Professor Mari und der Arbeitsbereich-Chat auf dem Home-Bildschirm nutzen dasselbe Übergabeformat.

Die angehängten Elemente erscheinen als Chips **Context** (Kontext) über ihrem Nachrichtenfeld. Entferne ein Kontextelement, wenn es nicht passt. Größere Inhalte eines Objekts lädt Professor Mari erst nach dem Absenden auf dem Server nach, innerhalb des Kontextbudgets. Ein vollständiges Objekt bekommt sie nicht schon deshalb, weil du einen Editor geöffnet hast.

Bei all dem kannst du sie um Hilfe bitten:

- Eine Einstellung, einen Modus oder ein Konzept erklären, bevor du irgendetwas änderst.
- Einen Charakter anlegen oder bearbeiten. Ein Charakter ist eine Karte, die der KI einen Namen, eine Persönlichkeit und eine Stimme gibt. Sie kann auch das [interaktive Onboarding](../characters/interactive-onboarding.md) einer Karte schreiben, also die Fragen, die Spieler beantworten, um ihre Persona aufzubauen.
- Eine Persona anlegen oder bearbeiten. Die Persona ist die Identität, die du im Chat spielst – das „Ich“ in der Geschichte.
- Den [Regelsatzbogen](../characters/colors-and-stats.md#ruleset-sheets) eines Charakters oder einer Persona für einen installierten Game-Mode-Regelsatz ausfüllen oder ändern: Werte, Ausbildungsstufen, Felder und Listenzeilen wie Ausrüstung. Sie nutzt die Namen und Grenzen des Regelsatzes selbst. Passt ein Wert nicht zum Regelsatz, wird die Änderung mit Begründung abgelehnt.
- Ein Lorebook anlegen oder bearbeiten. Ein Lorebook ist eine Sammlung von Weltwissen, die die KI heranzieht, sobald sie zum Thema passt.
- Ein Theme, einen Agenten, ein Prompt-Preset oder einen Entwurf für eine **Personal Extension** (persönliche Erweiterung) anlegen oder bearbeiten. Professor Mari ist die einzige Erweiterungs-Autorin im Standard-Umfang. Ihre Entwürfe bleiben deaktiviert, bis du den Code in der Sandbox geprüft, alle angeforderten aktiven Berechtigungen für Charakterkarten oder Personas durchgesehen und den exakten Hash unter **Settings** > **Addons** freigegeben hast.
- Einen einzelnen Teil eines Prompt-Presets an Ort und Stelle bearbeiten. Sie listet die einzelnen Abschnitte, Prompt-Gruppen und Auswahlvariablen eines Presets auf und zeigt dir jedes dieser Elemente auf Wunsch vollständig an. Ergänzen, ändern oder entfernen kann sie dann genau dieses eine Stück – etwa eine zusätzliche Zeile in einem bestimmten Abschnitt. Sie muss also nicht das ganze Preset neu anlegen oder ersetzen.
- Alle 33 offiziellen herunterladbaren Agenten und Feature-Pakete vergleichen, erklären, welche Modi sie unterstützen, und empfehlen, welche zum jeweiligen Ziel passen. Sie unterscheidet dabei, was im Katalog steht und was tatsächlich installiert ist, verweist bei Bedarf auf **Agents → Download Agents** und weiß, dass Paketquellen und der vollständige Katalog unter [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) liegen.
- Bilder generieren oder zuweisen, etwa Avatare, Sprites und Hintergründe. Ein Sprite ist ein Charakterbild – ein Porträt oder eine Ganzkörper-Pose –, das während eines Chats angezeigt wird.
- Öffentliche Fandom-Wiki-Seiten nachschlagen, damit du zu einem Charakter oder einer Welt recherchieren kannst.
- Dich über die Vorschlags-Chips oberhalb der Chat-Eingabe durch eine mehrstufige Erstellung oder Bearbeitung führen; ihre Farbe richtet sich nach dem Objekttyp.

Bevor sie etwas bearbeitet, liest sie es; bei vagen Anfragen fragt sie die fehlenden Angaben nach. Für Bild-Aufgaben brauchst du vorher eine funktionierende Verbindung zur Bildgenerierung. Die legt sie nicht für dich an.

## Schnelle Antworten in der Suche

Tippst du eine Frage in die Suche und passt kein Ergebnis, kann Professor Mari eine kurze Antwort schreiben. Sie erscheint als Karte **Quick answer · Read-only** (schnelle Antwort, schreibgeschützt) unter der Zeile **Ask Prof. Mari**.

- Eine schnelle Antwort umfasst bis zu drei Sätze aus den Marinara-Anleitungen. Professor Mari sieht dabei nur, was du getippt hast, und die Antwort ändert nichts.
- Die Karte nennt die Anleitungen, auf die sich die Antwort stützt. Stellst du dieselbe Frage erneut, wird fünf Minuten lang eine gespeicherte Kopie verwendet.
- Unter der Antwort stehen **Copy** (kopieren), **Answer again** (erneut antworten) und **Continue with Prof. Mari** (mit Prof. Mari weitermachen). **Continue with Prof. Mari** öffnet ihr Fenster in einem neuen Chat, der nach deiner Frage benannt ist, mit der schnellen Antwort als Anhang. Über **Ask Prof. Mari more…** (Prof. Mari mehr fragen) stellst du in ihrem Fenster eine Anschlussfrage. Schnelle Antworten selbst bieten keine Anschlussfragen.
- Eine schnelle Antwort wartet, bis du aufhörst zu tippen. **Wait after typing** (nach dem Tippen warten) legt fest, wie lange die Suche wartet.
- Wer antwortet, wählst du unter **Settings** > **General** > **Search and Professor Mari settings** > **Quick answers** (schnelle Antworten) > **Answer with** (antworten mit): ein lokales Modell, das du heruntergeladen hast, **Same as Prof. Mari** (dieselbe Verbindung wie Prof. Mari) oder eine andere Verbindung. Jede Antwort ist eine kurze Anfrage. Über eine kostenpflichtige Verbindung kann das Geld kosten.
- Schlägt eine Antwort fehl, nennt die Karte den Grund, zum Beispiel, dass das Modell nicht geantwortet hat. **Try again** (erneut versuchen) und **Continue with Prof. Mari** stehen immer zur Verfügung. **Choose a model** (Modell wählen) erscheint nur, wenn ein API-Key oder ein Modell fehlt. Die eigene Meldung des Anbieters findest du unter **Details**.
- Schnelle Antworten sind aus, bis du sie in derselben Gruppe mit **Quick answers in Search** einschaltest.

## Geführte Vorschlags-Chips

In einem leeren Chat mit Professor Mari erleichtern Start-Chips wie **Create a Character**, **Create a Lorebook** und **Create a Persona** den Einstieg in häufige Aufgaben. Während einer geführten Erstellung oder Bearbeitung passen sich die Chips dem jeweils nächsten Schritt an. Ein Klick auf einen Chip füllt den Eingabe-Entwurf; diesen Entwurf kannst du vor dem Absenden noch bearbeiten.

Geführte Abläufe stellen eine gezielte Frage nach der anderen, statt dir gleich ein langes Formular vorzusetzen.

Bei einer vollständigen Anfrage zum Erstellen oder Bearbeiten kann Professor Mari einen begrenzten geführten Plan liefern. Jeder Schritt bietet eine kleine Auswahl an Vorschlägen. Wählst du einen davon, füllt er den aktuellen Entwurf, und der Plan rückt lokal einen Schritt weiter. Wechselst du zu einem anderen Vorschlag, bleibt dein Text im Entwurf erhalten. Der Plan gehört zum aktuellen Professor-Mari-Chat; ein Chatwechsel, ein Restart, das Stoppen eines Durchlaufs oder der Abschluss des Plans räumt veraltete Schritte deshalb ab. Fehlerhafte oder überzählige Vorschläge werden verworfen, und solange Professor Mari arbeitet, sind die Chips deaktiviert.

Vorschläge gibt es nur in Chats mit Professor Mari. Andere Charaktere bekommen die Chips von Professor Mari nicht.

## Sie kann auch die Programmdateien der App lesen und bearbeiten

Professor Mari kann in die Programmdateien von Marinara hineinschauen, sie ändern und Befehle in einer Sandbox ausführen. Das ist eine echte und mächtige Fähigkeit – deshalb lohnt es sich, die Grenzen genau zu kennen.

Die Vertrauensgrenze in einfachen Worten:

- Ihre Datei-Werkzeuge bleiben in dem Ordner, in dem Marinara installiert ist. Reine Shell-Befehle dürfen den Arbeitsbereich und die nötigen Systemprogramme lesen, kommen aber nicht an deine übrigen persönlichen Dateien.
- Dateien mit Umgebungs-Geheimnissen wie `.env`, die Schlüsseldatei, die deine gespeicherten API-Keys schützt, sowie die internen Dateien von Git bleiben für ihre Datei-Werkzeuge und die Shell gesperrt.
- In deinen gespeicherten Datenordner, in dem Charaktere und Chats liegen, kann sie weder mit ihren Datei-Werkzeugen noch über die Shell direkt schreiben. Stattdessen nutzt sie den weiter unten beschriebenen Prüfablauf.
- Reine Shell-Befehle haben keinen Netzwerkzugriff, erben keine Server-Geheimnisse und dürfen nur gewöhnliche Dateien im Arbeitsbereich sowie ein privates temporäres Verzeichnis beschreiben.
- Normale Quelldateien darf sie weiterhin direkt bearbeiten. Änderungen an Abhängigkeits-Manifesten, Lockfiles, Startern, Installern und CI-Workflows werden vorgemerkt und dir gezeigt, bevor Marinara sie anwendet.
- Die gebauten App-Dateien von Marinara – die `dist`-Ordner, aus denen die App ausgeführt wird – kann sie lesen, aber nicht anlegen, bearbeiten, verschieben oder löschen. Stattdessen ändert sie die Quelldateien. Neu gebaut werden diese Dateien nur über `mari code check`, und zwar in derselben Sandbox.
- Braucht eine Quelltext-Änderung eine öffentliche npm-Bibliothek, fordert sie ein konkretes Paket an. Marinara löst `latest` zu einer exakten Version auf, zeigt die Registry-Integrität in einer Prüfkarte und installiert erst nach deiner Freigabe. Lifecycle-Skripte der Pakete bleiben abgeschaltet.
- Kann Marinara seine Shell-Sandbox unter macOS oder Linux nicht bereitstellen, sind reine Shell-Befehle und `mari code check` deaktiviert. Die sichereren strukturierten Werkzeuge für Dateien und App-Daten stehen ihr weiterhin zur Verfügung.
- Befehle, die sie ausführt, brechen nach kurzer Zeit von selbst ab. Ein hängender Befehl läuft also nicht endlos weiter.

Die meisten Menschen brauchen das nie. Es existiert, damit sie die App selbst untersuchen oder reparieren kann, wenn etwas kaputt ist.

## Eine Verbindung auswählen

Zum Denken braucht Professor Mari eine Verbindung. Eine Verbindung koppelt Marinara über einen API-Key an einen KI-Anbieter. Ein API-Key ist ein geheimer Zugangscode dieses Anbieters, ähnlich einem Passwort.

Klick auf die Verbindungsschaltfläche neben der Büroklammer. Sie zeigt ein Link-Symbol und den Namen der Verbindung, die Professor Mari nutzt, oder **Select connection** (Verbindung auswählen), wenn keine gewählt ist. Sie öffnet die Liste **Connections** (Verbindungen). Wähle dort eine beliebige eingerichtete Verbindung zur Textgenerierung. Hast du das eingebaute lokale Modell heruntergeladen, taucht es hier ebenfalls auf, und zwar als **Local Model (sidecar)**. Kennt die App den Namen des Modells, steht dieser Name stattdessen in der Klammer. Deine Auswahl wird mit deinen App-Einstellungen gespeichert.

Dasselbe Menü listet auch die Modelle der gewählten Verbindung auf. Klick auf ein Modell, um es zu nutzen. Das Modell wird wie in einem normalen Chat in der Verbindung gespeichert, sodass andere Chats mit dieser Verbindung ebenfalls darauf wechseln. Auf dem Handy oder in einem schmalen Fenster tippst du auf eine Verbindung, um zu ihr zu wechseln, oder auf den Pfeil am Ende ihrer Zeile, um zuerst ihre Modelle zu sehen. Das eingebaute lokale Modell hat keine Modellliste.

Gibt es noch keine Verbindungen, zeigt die Liste stattdessen **Add a connection** (Verbindung hinzufügen). Klick darauf, um eine anzulegen. Schickst du eine Nachricht ohne Verbindung ab, öffnet sich die Liste **Connections** von selbst, damit du eine auswählen kannst.

Die komplette Anleitung dazu findest du im Verbindungs-Leitfaden am Ende der Seite.

## Die Pi-Runtime ausprobieren (experimentell)

Professor Mari kann auf zwei Arten arbeiten. **Classic** ist die Standardeinstellung. **Pi** ist ein Test: Sie denkt damit vor einer Aktion mehr nach und arbeitet längere Aufgaben ab.

Zum Umschalten öffnest du **Search and Professor Mari settings** (Einstellungen für Suche und Professor Mari) und änderst **Runtime** (Laufzeit) unterhalb von **Permissions mode** (Berechtigungsmodus). Die Änderung gilt ab ihrer nächsten Antwort. Berechtigungsmodus, Änderungskarten und **Undo** funktionieren in beiden gleich.

Pi funktioniert mit jeder Verbindung, auch mit dem lokalen Modell. Verhält sich Professor Mari auf Pi merkwürdig, wechsle zurück zu Classic.

## Ihr Aussehen ändern

Öffne die **Search and Professor Mari settings** und scroll zu **Appearance** (Aussehen). Wähl ein Aussehen für sie, etwa **Basic**, **Prof. Mari loves Dottore** oder **Safari Prof. Mari**. Ihr neues Aussehen erscheint in ihrem Chat, in der Suche, auf Home und in der oberen Leiste. Manche Looks werden erst nach genug Spielzeit freigeschaltet. Ein gesperrter Look zeigt, wie viele Stunden du bisher gespielt hast.

## Das Büroklammer-Menü

Klick auf die Büroklammer-Schaltfläche mit der Beschriftung **Attach** (anhängen), um ein Menü mit drei Abschnitten zu öffnen:

- **Attach**: **Attach files or photos** (Dateien oder Fotos anhängen), **Add chat history** (Chatverlauf hinzufügen; damit teilst du einen deiner früheren Chats mit ihr) und **View attached context** (angehängten Kontext ansehen).
- **Reference**: **Link with @** (mit @ verknüpfen) tippt `@` in das Nachrichtenfeld und öffnet die weiter unten beschriebene Liste zum Verknüpfen.
- **Mari**: **New chat**, **Chat history**, **Skills**, **Memories**, **Model** (Modell) und **Permissions**. **Pending approvals** (ausstehende Freigaben) erscheint hier, solange eine Änderung auf dich wartet.

Dieselben Befehle kannst du auch mit `/` tippen, wie unter [Befehle mit /](#commands-with-) beschrieben.

## Dateien anhängen

Wähl im Büroklammer-Menü **Attach files or photos** oder tipp `/attach`, um deiner Nachricht eine Datei beizulegen.

Sie nimmt Bilder, PDF-Dateien und gängige Textdateien wie `.txt`, `.md`, `.json`, `.csv` und `.log` an. Jede Datei darf bis zu 20 MB groß sein. Angehängte Dateien erscheinen vor dem Absenden als entfernbare Chips über dem Nachrichtenfeld.

Damit sie ein Bild lesen kann, muss das Modell der gewählten Verbindung Bilder als Eingabe unterstützen.

## Dinge mit @ verknüpfen

Tipp `@` in das Nachrichtenfeld, um sie auf etwas in deiner Bibliothek zu verweisen, damit sie nicht danach suchen muss. Beim Tippen öffnet sich eine Liste, gruppiert nach **Characters** (Charaktere), **Personas**, **Lorebooks**, **Presets**, **Skills**, **Memories**, **Chats**, **Agents** (Agenten) und **Docs**. Weitertippen grenzt sie ein; Namen mit Leerzeichen brauchen keine Anführungszeichen (`@Alice in Wonderland`).

- Mit den Pfeiltasten bewegst du dich durch die Liste, mit **Enter** oder **Tab** wählst du aus, mit **Escape** schließt du sie. Bei einem Lorebook zeigt der Pfeil nach rechts seine **Entries** (Einträge), damit du einen einzelnen Eintrag verknüpfen kannst; der Pfeil nach links geht zurück.
- Sitzt ihr Fenster neben einem Editor, verknüpft die erste Zeile, **Open beside me** (neben mir öffnen), das, was dieser Editor gerade geöffnet hat.
- Neben dem Charakter-Editor hat die Zeile **Open beside me** ein › (oder drück ArrowRight), das die **Fields** (Felder) dieses Editors auflistet; tippst du nach `@` weiter, erscheinen direkt die passenden. Wählst du eines aus (`@scen` → Scenario), wechselt das Feld, an dem sie arbeitet – genauso, als hättest du hineingeklickt, bevor du sie öffnest. Es ersetzt den Feld-Chip in ihrer Kontextzeile, und der Editor scrollt zu diesem Feld. Ein Feld ist keine Verknüpfung, deshalb bleibt kein `@`-Text in deiner Nachricht stehen. **Onboarding** ist ein einziges Feld für den ganzen Block: Solange es ihr Feld ist, schickt jede Nachricht mit, was `character.onboarding.get` zurückgibt (die Fragen, eventuelle Probleme und eine Beispiel-Persona), sodass sie vom Block ausgeht, wie er gespeichert ist.
- Ein gewählter Name wird in deiner Nachricht hervorgehoben und erscheint als Chip über dem Nachrichtenfeld. Bearbeitest oder löschst du den Namen, verschwindet die Verknüpfung mit ihm; das **×** am Chip entfernt die Verknüpfung, lässt aber deinen Text stehen.
- In normalem Text vervollständigt **Tab** einen Namen, den sie grau vorschlägt. Drück **Tab** ein zweites Mal, um ihn in eine Verknüpfung zu verwandeln.

Was jede Verknüpfung mitschickt:

| Verknüpfung | Was sie bekommt |
| --- | --- |
| Charakter, Persona, Preset | Das ganze Objekt, so wie sie es selbst lesen würde |
| Lorebook | Seine Einstellungen und die Liste seiner Einträge (verknüpfe einen Eintrag für den vollen Text) |
| Lorebook-Eintrag | Den Eintrag und das Lorebook, zu dem er gehört |
| Skill | Die Anweisungen deines eigenen Skills. Ein integrierter Skill öffnet sich stattdessen als ihr Handbuch für diese Nachricht. Verknüpfst du den Onboarding-Skill mit einem Charakter, bekommt sie außerdem den Onboarding-Block dieses Charakters |
| Memory | Der volle Text der Erinnerung, auch wenn sie ausgeschaltet ist. Erinnerungen mit **Persistent** stehen nicht in der Liste, weil sie sie ohnehin immer hat |
| Chat | Die Details des Chats und seine 30 neuesten Nachrichten |
| Agent | Die Einstellungen des Agenten |
| Doc | Die ganze Seite aus dieser Dokumentation |

Eine Verknüpfung wird **einmal** gesendet, und zwar mit der Nachricht, in der du sie setzt. In späteren Zügen sieht sie nur einen einzeiligen Hinweis, dass du sie verknüpft hast, und liest sie bei Bedarf noch einmal. Eine Nachricht trägt bis zu 8 Verknüpfungen. Summieren sie sich auf mehr als etwa ein Viertel des Kontexts deiner Verbindung (höchstens 60.000 Zeichen), werden die letzten nicht gesendet; stattdessen bekommt sie einen Hinweis und kann sie selbst lesen.

Verknüpfte Objekte gelten als Information, nie als Anweisung: Eine Charakterkarte oder ein Lorebook-Eintrag kann ihr nicht sagen, was sie tun soll.

<a id="commands-with-"></a>

## Befehle mit /

Tipp `/` am Zeilenanfang, um ihre Befehle aufzulisten. Tipp weiter, um zu filtern, und drück dann **Enter**, um einen auszuführen. Das getippte `/word` wird aus deiner Nachricht entfernt.

| Befehl | Was er tut |
| --- | --- |
| `/new` | Startet einen neuen Chat; der aktuelle wird in **Chats** gespeichert (`/restart` funktioniert ebenfalls) |
| `/history` | Öffnet deine früheren Chats mit ihr |
| `/skills` | Öffnet das Panel **Skills** |
| `/memories` | Öffnet das Panel **Memories** |
| `/context` | Zeigt, was an diesen Chat angehängt ist |
| `/attach` | Wählt Dateien oder Fotos zum Senden aus |
| `/model` | Wählt die Verbindung, die sie nutzt |
| `/permissions` | Legt fest, was sie ändern darf |
| `/approvals` | Öffnet Änderungen, die auf dich warten (nur solange eine aussteht) |

Die Liste mit `/` zeigt auch deine **Skills** und **Memories**. Wählst du eines davon aus, wird es verknüpft, genau wie bei `@`.

## Ihre Änderungen prüfen

Ändert Professor Mari etwas, speichert sie die Änderung sofort und zeigt unter ihrer Antwort eine Änderungskarte. Die Karte listet jedes geänderte Feld auf. Bei einer Textänderung siehst du die alten und die neuen Wörter, bei einem Lorebook seine Einträge. Eine Änderung tiefer in einem Objekt, etwa am Onboarding einer Karte, bekommt ein eigenes Feld, das nennt, was sich geändert hat. Öffne **Show all** (alle anzeigen), um jedes Feld zu sehen. **Technical details** (technische Details) zeigt den rohen Befehl.

Die Karte hat nur eine Aktion:

- **Undo** (rückgängig) holt die zuvor gespeicherte Fassung zurück. Jede Änderung lässt sich rückgängig machen, in jedem Berechtigungsmodus. Der Berechtigungsmodus entscheidet nur, ob sie vorher fragt.
- Eine Änderung, die nicht gespeichert wurde, zeigt **Not saved** und den Grund. **Try again** bittet sie erneut darum.
- Die Anzeige **Undo until** erscheint auf der Karte nur in den letzten 24 Stunden. Eine Kopie zum Rückgängigmachen hält bis zu 14 Tage, und nur die neuesten 50 werden aufbewahrt. Danach bleibt die Änderung bestehen, und auf der Karte steht **Undo closed**.

Anders ist es bei einer Änderung, die auf dich wartet. Eine zurückgehaltene Änderung (im Modus Manual oder bei einer Änderung an einer heiklen Datei oder einer Abhängigkeit) zeigt **Apply** (anwenden) und **Don't apply** (nicht anwenden). Eine Löschung zeigt **Delete** (löschen) und **Put back** (zurücklegen). Die Suche listet ihre Änderungen nicht auf: Öffne Professor Mari, um sie anzusehen, anzuwenden oder rückgängig zu machen.

- Eine Karte gehört zu dem Professor-Mari-Chat, in dem sie die Änderung vorgenommen hat. Ein neuer Chat beginnt ohne Karten anderer Chats. Wenn du einen Chat löschst, bleiben seine Änderungen erhalten, seine Karten werden entfernt. Eine Änderung über den Terminalbefehl `mari` gehört zu keinem Chat; ihre Karte erscheint deshalb in jedem Professor-Mari-Chat.
- Eine Bearbeitung, die nichts ändern würde, wird nicht gespeichert und erhält keine Karte.
- Ein Schritt in ihrer Arbeitsliste mit dem Status **Previewed**, der mit **· not saved** endet, war nur eine Vorschau. Es wurde nichts geändert, und es gibt keine Karte.
- Professor Mari kann ihre eigene Charakterkarte weder bearbeiten noch löschen. Marinara setzt sie bei jedem Start auf die integrierte Fassung zurück.
- Charaktere und Personas führen zusätzlich in ihren Editoren eine eigene Versionshistorie. Dort lässt sich als zweites Sicherheitsnetz eine ältere Fassung wiederherstellen.

Erstellt oder aktualisiert Professor Mari einen Charakter, eine Persona, ein Lorebook oder ein Preset, kann das Ergebnis **Open** anzeigen. Damit öffnest du genau dieses Objekt, nachdem die App ihre Daten aktualisiert hat. Ein aktualisiertes Ergebnis kann zusätzlich **Review** (prüfen) anzeigen, wenn eine Prüfung aussteht. **Review** öffnet die Bedienelemente für die ausstehende Änderung. Neue Objekte haben meist keine Prüfung, weil dabei nichts Bestehendes überschrieben wurde.

Zwei riskantere Änderungen warten, statt zuerst angewendet zu werden:

- **Sensitive file changes** (Änderungen an heiklen Dateien) zeigen den Pfad und den vorgeschlagenen Inhalt zusammen mit **Apply change** (Änderung anwenden) und **Discard** (verwerfen). Das betrifft Abhängigkeitsdateien, Starter, Installer und CI-Workflows. Gewöhnliche Bearbeitungen an TypeScript, React, CSS, Prompts, Routen und Dokumentation bleiben ohne diese zusätzliche Hürde möglich.
- **Dependencies** (Abhängigkeiten) zeigen das exakte öffentliche npm-Paket, die Version, den Ziel-Arbeitsbereich, den Abhängigkeitstyp, die Registry-Integrität und die deklarierten direkten Abhängigkeiten, dazu **Install** (installieren) und **Not now** (jetzt nicht). Reine Installationsbefehle wie `npm`, `pnpm`, `yarn`, `pip` und Ähnliches sind in ihrer Shell gesperrt, auch als Installation aus dem Cache.

Wer eine Bibliothek freigibt, vertraut ihrem Code – Marinara importiert und führt ihn später aus. Abgeschaltete Lifecycle-Skripte verhindern zwar die Ausführung während der Installation, machen eine Bibliothek zur Laufzeit aber nicht harmlos.

## Inhalte mit Decisions erstellen

Professor Mari kann **Activation questions** (Aktivierungsfragen) für Agenten, **Decision**-Aussagen für Lorebook-Einträge und bedingte Prompts in Presets, Karten, Lorebooks und Agenten-Prompts schreiben. Bevor sie solche Funktionen einführt, prüft sie das ausgewählte Decision-Modell. Eine Auswahl beschreibt die Konfiguration; sie beweist weder die Erreichbarkeit eines Anbieters noch, dass sich ein lokales Modell erfolgreich laden lässt.

Ohne ausgewähltes Decision-Modell führt sie bei gewöhnlichen Erstellungen und Bearbeitungen keine neuen Decision-Abhängigkeiten ein. Vorhandene Decision-Inhalte bleiben bei anderen Änderungen erhalten. Bittest du ausdrücklich um Decision-Inhalte, erklärt sie das jeweilige Ersatzverhalten und fragt einmal in diesem Professor-Mari-Chat, ob sie fortfahren soll. Das merkt sie sich auch nach erneutem Öffnen und in Gesprächen, die länger sind als ihr Fenster der jüngsten Nachrichten. Eine unbeantwortete Frage oder Ablehnung ist keine Erlaubnis.

Du kannst ihr sagen: **„Erinnere mich nicht mehr daran, ein Decision-Modell einzurichten.“** Sie hört im aktuellen Chat damit auf und kann diese Präferenz als Memory speichern. Mit **Turn on** (einschalten) gilt sie auch für künftige Chats. Deaktivieren oder Löschen dieses Memory hebt die dauerhafte Präferenz auf. Unterdrückte Einrichtungshinweise sind keine Einladung, gewöhnliche Aufträge um Decisions zu ergänzen.

Ist ein Modell ausgewählt, folgt sie deinen passenden aktivierten Memories und Skills. Enthalten diese keine Präferenz zur Erstellung solcher Inhalte, fragt sie, ob du Decisions verwenden und dir diese Antwort merken lassen möchtest. Du kannst zustimmen, ablehnen oder nur den aktuellen Auftrag erlauben. Ein Skill, der lediglich die Decision-Syntax erklärt, gilt nicht als Erlaubnis. Ein direkter Auftrag wie „ergänze diesen Eintrag um Decision-Aktivierung“ erlaubt dies bereits für diese Aufgabe.

Standardmäßig setzt sie Decisions sparsam mit geeigneter Zeitsteuerung ein: **Sticky** oder **Cooldown** bei Lorebook-Einträgen, **Trigger Cadence** (Ausführungstakt) für Agentenaktivierung sowie `sticky`, `cooldown` oder `every` in Prompt-Bedingungen. Sticky und Cooldown verringern wiederholte Prüfungen nach einer positiven Aktivierung; sie verhindern keine wiederholten Prüfungen bei anhaltendem nein. `every` lässt Prüfungen zwischen den vorgesehenen Zügen aus und gilt dann als nein. Für flüchtige Ereignisse ist das daher nicht immer geeignet.

Professor Mari versucht außerdem, den frühen Teil des zusammengesetzten Prompts stabil zu halten. Bevor sie wechselnde Inhalte früh im Prompt oder Kontext mitten im Chatverlauf einfügt, fragt sie nach, sofern dein Auftrag oder eine aktivierte Präferenz diese Platzierung nicht bereits erlaubt. Eine allgemeine Regel „nach 1.000 Tokens sicher“ gibt es nicht: Die Cache-Wiederverwendung hängt von Anbieter, Modell und übereinstimmendem fertig zusammengesetztem Präfix ab. Die Zustimmung zu Decisions erlaubt solche Platzierungen nicht automatisch.

Für ihre Bearbeitungen gelten weiterhin der übliche Berechtigungsmodus und die üblichen Prüfregeln. Von Professor Mari gespeicherte Memories bleiben aus, bis du sie aktivierst. Welche Inhalte die einzelnen Decision-Funktionen sehen, ihr Ersatzverhalten und Beispiele findest du unter [Decision-Modelle](../connections/decision-models.md), [Bedingte Prompts](../prompts/conditional-prompts.md), [Eigene Agenten](../agents/custom-agents.md#activation-questions) und [Lorebook-Einträge](../lorebooks/entries.md#decision-activation).

## Eigene Skills

Ein Skill ist ein kurzes Anweisungsdokument, das du schreibst, um zu ändern, wie Professor Mari eine bestimmte Art von Anfrage behandelt.

Klick auf die Schaltfläche **Skills** in ihrer Chat-Kopfzeile, um das Panel **Professor Mari skills** zu öffnen. Von dort aus kannst du:

- Auf **New** (neu) klicken, um einen Skill aus einer Vorlage zu starten.
- Auf **Upload** (hochladen) klicken, um einen Skill aus einer `.md`- oder `.txt`-Datei hinzuzufügen.
- Jeden Skill ein- oder ausschalten. Ein ausgeschalteter Skill bleibt erhalten, wird aber nicht verwendet.
- Einen Skill auswählen und **Name**, **Description** und **Instructions** bearbeiten, dann auf **Save** (speichern) klicken. Über **Delete** verschwindet er wieder.

Solange es noch keine Skills gibt, steht im Panel **No custom skills yet** („noch keine eigenen Skills“).

### Integrierte Skills

Unter deinen eigenen Skills listet das Panel unter **Always on** (immer aktiv) die Skills auf, die Marinara mitliefert. Jeder ist mit **Built-in** gekennzeichnet. Das sind ihre Handbücher für Charaktere und Personas, Lorebooks, Onboarding, Presets, Themes, Personal Extensions, Home-Widgets, Decisions und das Reparieren einer Antwort. Sie liest eines, wenn eine Anfrage es erfordert, sodass die Handbücher nicht in jeder Nachricht Platz belegen.

Ein integrierter Skill ist schreibgeschützt: Du kannst ihn weder bearbeiten noch ausschalten oder löschen, und ein App-Update ersetzt ihn durch die neue Fassung. Um zu ändern, wie sie etwas angeht, kopiere seine Anweisungen in einen neuen eigenen Skill.

Standardmäßig wird in jedem Chat ihre erste Änderung in einem Bereich mit integriertem Skill zurückgewiesen, bis sie diesen Skill gelesen hat. Das hilft kleineren und lokalen Modellen. Größere Modelle kommen meist ohne diese Vorgabe zurecht. Um ihnen einen Schritt zu sparen, öffne **Search and Professor Mari settings** und schalte **Read the handbook before the first write** (Handbuch vor der ersten Änderung lesen) unter **Runtime** aus. Nur du kannst diese Einstellung ändern, Professor Mari nicht.

## Gespeicherte Erinnerungen

Professor Mari merkt sich deine dauerhaften Vorlieben, damit du sie nicht in jedem Chat wiederholen musst: wie deine Lorebooks oder Charakterkarten formatiert sein sollen, welche Namenskonventionen gelten oder wie sie sich verhalten soll.

Eine Erinnerung bekommt sie auf zwei Wegen:

- **Sag es ihr.** Zum Beispiel: „Merk dir, dass ich Lorebook-Einträge immer über den Namen des Charakters und seinen Spitznamen auslöse.“ Sie speichert das und zeigt dir eine Änderungskarte mit dem genauen Wortlaut. Eine so gespeicherte Erinnerung ist zunächst **deaktiviert** (aus) und ändert nichts, bis du sie einschaltest. Mit **Turn on** auf der Karte schaltest du sie sofort ein.
- **Leg sie selbst an.** Klick auf die Schaltfläche **Memories** (Erinnerungen) in ihrer Chat-Kopfzeile, um das Panel **Memories** zu öffnen. Dort legst du Erinnerungen an, bearbeitest sie, schaltest sie ein oder aus und löschst sie. Über **Upload** wird außerdem der Inhalt einer `.md`- oder Textdatei zu einer Erinnerung.

Sie speichert oder ändert eine Erinnerung nur, wenn **du** sie darum bittest – nie, weil etwas Gelesenes es ihr aufträgt: ein Charakter, ein Lorebook oder eine Datei.

Wie sie die Erinnerungen nutzt – und warum das ihren Prompt kaum belastet:

- Bei jedem Zug sieht sie nur einen kurzen **Index** deiner *eingeschalteten* Erinnerungen: Titel und je eine Zeile Beschreibung. Das kostet fast nichts. Passt eine Erinnerung zu dem, was du gerade tust, schlägt sie den vollen Text nach und richtet sich danach. So bleibt ihr Prompt klein, auch wenn du viele Erinnerungen anlegst – dauerhaft dabei ist nur der kurze Index. Die Ausnahme ist eine Erinnerung mit **Persistent** (siehe unten): Ihr voller Text wandert bei jedem Zug in den Prompt, deshalb sollten es wenige und kurze sein. Eine ausgeschaltete Erinnerung bleibt erhalten, wird aber ignoriert. So kannst du eine kurz abschalten, etwas anderes ausprobieren und sie später wieder einschalten.
- Bei einem Widerspruch **haben gespeicherte Erinnerungen Vorrang vor ihrem Standardverhalten**. Eine Erinnerung wie „Wenn ich frage, wie etwas geht, mach es einfach“ bringt dich zurück zum Bearbeiten ohne Rückfrage – ihre übliche Gewohnheit, vorher nachzufragen, tritt dann in den Hintergrund.
- Eine seltene Vorgabe, die bei *jedem* Zug gelten muss, stellst du auf **Persistent**. Dann hat sie den vollen Text immer vor Augen. Leg nur wenige solcher Erinnerungen an und halte sie kurz, denn jede steckt dauerhaft in ihrem Prompt. Nutz sie nur für Verhalten, das immer gelten soll.

Verwalten kannst du deine Erinnerungen im Panel **Memories** – oder du fragst sie einfach: „Woran erinnerst du dich?“, „Ergänz in meiner Erinnerung zur Lorebook-Formatierung auch die Titel“ oder „Vergiss das“.

## Chatverlauf und Restart

Professor Mari führt ihre eigenen, getrennten Chats. In deiner normalen Chatliste tauchen sie nicht auf.

Klick auf die Schaltfläche **Chats** in ihrer Kopfzeile, um die gespeicherten Chats mit Professor Mari zu öffnen. Ist die Liste leer, weist das Panel darauf hin: „New chat keeps this one here.“ Mit **Search Prof. Mari chats** (Prof.-Mari-Chats durchsuchen) findest du einen bestimmten. Ein Klick auf einen gespeicherten Chat öffnet ihn; umbenennen und löschen geht ebenfalls.

Klick auf die Schaltfläche **New chat** (neuer Chat), um einen frischen Chat mit ihr zu beginnen. Sie speichert den aktuellen Chat zuerst in der Liste **Chats**. Dasselbe erreichst du mit `/new` (oder `/restart`) im Nachrichtenfeld. Du siehst die Meldung „Professor Mari's previous chat was saved.“

Während sie arbeitet, wird die Senden-Schaltfläche zu einer Schaltfläche **Stop**. Ein Klick darauf bricht die laufende Aufgabe ab.

## Ihr Fenster verlassen

Du kannst ihr Fenster schließen und die App weiter nutzen, während sie arbeitet. Die Linie und das Statusabzeichen in der oberen Leiste zeigen, wie es ihr geht, wie unter [Wo du sie findest](#where-to-find-her) beschrieben. Ein Klick auf das Abzeichen bringt dich zurück zu ihrem Chat.

## Vertrauens- und Wiederherstellungsstatus

Öffne **Context** in der Kopfzeile von Professor Mari, um zu sehen, was mit deiner nächsten Nachricht mitgeht, was in diesem Professor-Mari-Chat bleibt und wie sie arbeitet: mit welchem Modell sie antwortet, wie groß das Kontextbudget ist und ob ihre Shell-Befehle in einer Sandbox laufen. Die Kopfzeile zeigt außerdem ausstehende Freigaben, Skills und Memories. Prüf das vor einer Anfrage, wenn du wissen musst, was Professor Mari lesen kann.

Folgenreiche Änderungen im Arbeitsbereich hält Professor Mari hinter den bestehenden Freigabe- und Prüfregeln des Servers. **Context** gewährt keinen zusätzlichen Zugriff. Änderungen an heiklen Dateien und an Abhängigkeiten, Shell-Grenzen und die Prüfung der App-Daten setzt weiterhin der Server durch.

Schlägt eine Anfrage fehl, behält der Chatverlauf den Fehlergrund und zeigt **Retry** (wiederholen), wenn sich die Anfrage erneut senden lässt. Behebe zuerst das angezeigte Problem mit Verbindung, Sandbox, Fähigkeit oder Fernzugriff und versuch es dann erneut. Wurde deine Frage nicht gespeichert, kommt sie samt ihren Dateien zurück ins Nachrichtenfeld, sodass du sie vorher ändern kannst. **Retry** und **Retry with another model** (mit einem anderen Modell wiederholen) senden dann, was im Feld steht. Ein erneuter Versuch startet nie stillschweigend aus einer Suche, der FAQ oder einem Fehlerzustand heraus. Er bleibt eine Aktion von dir.

## Die FAQ ist vom Chat getrennt

Klick auf dem Home-Bildschirm auf das Lesezeichen **FAQ** oder im Widget **Learn the engine** (die Engine kennenlernen) auf **Read FAQ** (FAQ lesen), um **Professor Mari's FAQ** zu öffnen. Das ist eine feste, geschriebene Liste aus Fragen und Antworten – nicht der KI-Chat.

Tipp in das Feld **Search FAQ** (FAQ durchsuchen), um die Fragen zu filtern. Jede Frage trägt ein farbiges Kategorie-Tag, etwa **Setup**, **Connections** oder **Game Mode**. Ein Tipp auf eine Frage zeigt die Antwort.

Weil die FAQ fest in der App steht, kennt sie deine aktuelle Einrichtung nicht. Für alles rund um deine eigenen Daten oder den aktuellen Zustand nimm den Chat.

## Grenzen und Sicherheit

Professor Mari ist eine Helferin, nicht die vollständige Dokumentation. Behalte diese Grenzen im Blick:

- Sie kann nicht garantieren, dass ihr eingebautes Wissen zu genau deiner App-Version passt. Bei allem, was versionsabhängig ist oder sich kürzlich geändert hat, gelten zuerst die Anleitungen und die Release Notes.
- Neue Inhalte anzulegen ist meist unbedenklich, weil dabei nichts überschrieben wird. Bestehende Inhalte zu bearbeiten verlangt mehr Sorgfalt.
- Eine freigegebene Abhängigkeit ist fremder Code mit denselben Laufzeitrechten wie der Marinara-Code, der ihn importiert. Prüfe Paketname, exakte Version, Zweck und Integrität in der Freigabekarte.
- Nenne bei Bearbeitungen genau das Objekt und genau das Feld, das sich ändern soll. „Schreib diesen Charakter komplett neu“ ist riskanter als „mach Lunas Begrüßung kürzer, lass ihre Persönlichkeit gleich“.
- Nutze bei mehrstufigen Erstellungen die Vorschlags-Chips und beantworte eine gezielte Frage nach der anderen, statt alle Felder auf einmal liefern zu wollen.
- Behauptet sie, eine Aufgabe erledigt zu haben, die App zeigt sie aber nicht – dann glaub der App. Erledige die Aufgabe selbst im passenden Panel.
- Erreichst du Marinara von einem anderen Gerät statt vom selben Rechner, brauchen ihre Bearbeitungs-Aktionen einen eingerichteten Fernzugriff. Siehe die Anleitung zum Fernzugriff.

## Fehlerbehebung

- Gar keine Antwort: Prüfe die Verbindung, die unter **Context** angezeigt wird, oder wähle mit der Verbindungsschaltfläche eine aus. Ist noch keine eingerichtet, öffne das Panel **Connections** und leg eine an.
- Eine Übergabe enthält das falsche Objekt: Entferne das Kontextelement, starte neu oder wechsle in den richtigen Professor-Mari-Chat und öffne die Übergabe erneut an der Ausgangsstelle. Der Kontext gilt nur für die Übergabe und den aktuellen Professor-Mari-Chat.
- Ein Ergebnis erscheint nicht in einem Editor: Nutze **Open** auf der Ergebniskarte. Möglicherweise hat Professor Mari den Befehl abgeschlossen, während die Objektliste veraltet war.
- Eine Anfrage schlägt fehl: Lies den Fehlerstatus, behebe das genannte Einrichtungsproblem und nutze **Retry**. Frag Professor Mari nur dann erneut von der ursprünglichen Stelle aus, wenn der Kontext selbst nicht mehr stimmt.
- Beim Absenden öffnet sich die Liste **Connections**: Es ist noch keine Verbindung gewählt. Wähle eine aus der Liste oder nutze zuerst **Add a connection**.
- Sie kann dein angehängtes Bild nicht lesen: Das Modell muss Bilder als Eingabe unterstützen. Wechsle zu einer Verbindung, deren Modell Bilder sehen kann.
- Fandom-Abfragen schlagen fehl: Dafür braucht es eine Internetverbindung, denn Fandom ist eine externe Website.
- Ihre Aktionen scheitern mit einem Berechtigungsfehler: Du erreichst Marinara über ein Netzwerk, nicht vom selben Rechner. Richte zuerst den Fernzugriff ein.

## Verwandte Anleitungen

- [Erste Schritte mit Marinara Engine](welcome.md)
- [Das Tutorial für den ersten Start](tutorial.md)
- [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md)
- [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md)
- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
- [Fernzugriff: Anmeldung und IP-Allowlist](../REMOTE_ACCESS.md)
