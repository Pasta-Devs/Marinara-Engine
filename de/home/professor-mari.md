# Professor Mari, deine Assistentin in der App

Professor Mari ist die eingebaute Assistentin von Marinara Engine auf dem Home-Bildschirm. In dieser Anleitung erfährst du, wo du sie findest, was sie kann, wie sie ihre Änderungen umkehrbar hält und wie du typische Probleme löst.

## Wo du sie findest

Professor Mari wohnt auf dem Home-Bildschirm. Der Home-Bildschirm ist das, was du siehst, solange kein Chat geöffnet ist.

Halte Ausschau nach der Karte mit ihrer Pixel-Grafik und der Überschrift **Professor Mari**. Eine Statuszeile zeigt **Ready to help** („bereit zu helfen“), wenn sie nichts zu tun hat, und **Working on it...**, während sie arbeitet. Klick auf die Schaltfläche **Ask Professor Mari** (Professor Mari fragen), um ihr komplettes Chatfenster zu öffnen.

Mit ihr sprichst du in ganz normaler Sprache. Tipp eine Nachricht in das Feld und drück Enter zum Abschicken. Shift und Enter zusammen fügen stattdessen eine neue Zeile ein.

Die allererste Nachricht an sie schaltet die Errungenschaft **Hello World** frei.

## Was sie kann

Professor Mari ist mehr als ein Frage-Feld. Sie erklärt die App, hilft bei der Einrichtung und baut auf Zuruf Dinge für dich.

Bei all dem kannst du sie um Hilfe bitten:

- Eine Einstellung, einen Modus oder ein Konzept erklären, bevor du irgendetwas änderst.
- Einen Charakter anlegen oder bearbeiten. Ein Charakter ist eine Karte, die der KI einen Namen, eine Persönlichkeit und eine Stimme gibt.
- Eine Persona anlegen oder bearbeiten. Die Persona ist die Identität, die du im Chat spielst – das „Ich“ in der Geschichte.
- Ein Lorebook anlegen oder bearbeiten. Ein Lorebook ist eine Sammlung von Weltwissen, die die KI heranzieht, sobald sie zum Thema passt.
- Ein Theme, einen Agenten, ein Prompt-Preset oder einen Entwurf für eine **Personal Extension** (persönliche Erweiterung) anlegen oder bearbeiten. Professor Mari ist die einzige Erweiterungs-Autorin im Standard-Umfang. Ihre Entwürfe bleiben deaktiviert, bis du den Code in der Sandbox geprüft, alle angeforderten aktiven Berechtigungen für Charakterkarten oder Personas durchgesehen und den exakten Hash unter **Settings** (Einstellungen) > **Addons** freigegeben hast.
- Einen einzelnen Teil eines Prompt-Presets an Ort und Stelle bearbeiten. Sie listet die einzelnen Abschnitte, Prompt-Gruppen und Auswahlvariablen eines Presets auf und zeigt dir jedes dieser Elemente auf Wunsch vollständig an. Ergänzen, ändern oder entfernen kann sie dann genau dieses eine Stück – etwa eine zusätzliche Zeile in einem bestimmten Abschnitt. Sie muss also nicht das ganze Preset neu anlegen oder ersetzen.
- Alle 33 offiziellen herunterladbaren Agenten und Feature-Pakete vergleichen, erklären, welche Modi sie unterstützen, und empfehlen, welche zum jeweiligen Ziel passen. Sie unterscheidet dabei, was im Katalog steht und was tatsächlich installiert ist, verweist bei Bedarf auf **Agents → Download Agents** und weiß, dass Paketquellen und der vollständige Katalog unter [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents) liegen.
- Bilder generieren oder zuweisen, etwa Avatare, Sprites und Hintergründe. Ein Sprite ist ein Charakterbild – ein Porträt oder eine Ganzkörper-Pose –, das während eines Chats angezeigt wird.
- Öffentliche Fandom-Wiki-Seiten nachschlagen, damit du zu einem Charakter oder einer Welt recherchieren kannst.
- Dich über die Vorschlags-Chips oberhalb der Chat-Eingabe durch eine mehrstufige Erstellung oder Bearbeitung führen; ihre Farbe richtet sich nach dem Objekttyp.

Bevor sie etwas bearbeitet, liest sie es; bei vagen Anfragen fragt sie die fehlenden Angaben nach. Für Bild-Aufgaben brauchst du vorher eine funktionierende Verbindung zur Bildgenerierung. Die legt sie nicht für dich an.

## Geführte Vorschlags-Chips

In einem leeren Chat mit Professor Mari erleichtern Start-Chips wie **Create a Character**, **Create a Lorebook** und **Create a Persona** den Einstieg in häufige Aufgaben. Während einer geführten Erstellung oder Bearbeitung passen sich die Chips dem jeweils nächsten Schritt an. Ein Klick auf einen Chip füllt den Eingabe-Entwurf; diesen Entwurf kannst du vor dem Absenden noch bearbeiten.

Geführte Abläufe stellen eine gezielte Frage nach der anderen, statt dir gleich ein langes Formular vorzusetzen.

## Sie kann auch die Programmdateien der App lesen und bearbeiten

Professor Mari kann in die Programmdateien von Marinara hineinschauen, sie ändern und Befehle in einer Sandbox ausführen. Das ist eine echte und mächtige Fähigkeit – deshalb lohnt es sich, die Grenzen genau zu kennen.

Die Vertrauensgrenze in einfachen Worten:

- Ihre Datei-Werkzeuge bleiben in dem Ordner, in dem Marinara installiert ist. Reine Shell-Befehle dürfen den Arbeitsbereich und die nötigen Systemprogramme lesen, kommen aber nicht an deine übrigen persönlichen Dateien.
- Dateien mit Umgebungs-Geheimnissen wie `.env` sowie die internen Dateien von Git bleiben für ihre Datei-Werkzeuge und die Shell gesperrt.
- In deinen gespeicherten Datenordner, in dem Charaktere und Chats liegen, kann sie nicht direkt schreiben. Stattdessen nutzt sie den weiter unten beschriebenen Prüfablauf.
- Reine Shell-Befehle haben keinen Netzwerkzugriff, erben keine Server-Geheimnisse und dürfen nur gewöhnliche Dateien im Arbeitsbereich sowie ein privates temporäres Verzeichnis beschreiben.
- Normale Quelldateien darf sie weiterhin direkt bearbeiten. Änderungen an Abhängigkeits-Manifesten, Lockfiles, Startern, Installern und CI-Workflows werden vorgemerkt und dir gezeigt, bevor Marinara sie anwendet.
- Braucht eine Quelltext-Änderung eine öffentliche npm-Bibliothek, fordert sie ein konkretes Paket an. Marinara löst `latest` zu einer exakten Version auf, zeigt die Registry-Integrität in einer Prüfkarte und installiert erst nach deiner Freigabe. Lifecycle-Skripte der Pakete bleiben abgeschaltet.
- Kann Marinara seine Shell-Sandbox unter macOS oder Linux nicht bereitstellen, sind reine Shell-Befehle deaktiviert. Die sichereren strukturierten Werkzeuge für Dateien und App-Daten stehen ihr weiterhin zur Verfügung.
- Befehle, die sie ausführt, brechen nach kurzer Zeit von selbst ab. Ein hängender Befehl läuft also nicht endlos weiter.

Die meisten Menschen brauchen das nie. Es existiert, damit sie die App selbst untersuchen oder reparieren kann, wenn etwas kaputt ist.

## Eine Verbindung auswählen

Zum Denken braucht Professor Mari eine Verbindung. Eine Verbindung koppelt Marinara über einen API-Key an einen KI-Anbieter. Ein API-Key ist ein geheimer Zugangscode dieses Anbieters, ähnlich einem Passwort.

Klick auf das Link-Symbol neben der Büroklammer, um das Dropdown-Menü **Connections** (Verbindungen) zu öffnen. Wähle dort eine beliebige eingerichtete Verbindung zur Textgenerierung. Hast du das eingebaute lokale Modell heruntergeladen, taucht es hier ebenfalls auf, und zwar als **Local Model (sidecar)**. Kennt die App den Namen des Modells, steht dieser Name stattdessen in der Klammer. Deine Auswahl merkt sich der Browser.

Gibt es noch keine Verbindungen, zeigt das Dropdown-Menü **Add a connection** (Verbindung hinzufügen). Schickst du eine Nachricht ohne Verbindung ab, öffnet sich das Panel **Connections** von selbst. Außerdem erscheint diese Einblendmeldung (Toast genannt):

> You haven't set up a connection yet! Click the link icon beside the paperclip to select one.

Die komplette Anleitung dazu findest du im Verbindungs-Leitfaden am Ende der Seite.

## Dateien anhängen

Klick auf die Büroklammer-Schaltfläche mit der Beschriftung **Attach files** (Dateien anhängen), um deiner Nachricht eine Datei beizulegen.

Sie nimmt Bilder, PDF-Dateien und gängige Textdateien wie `.txt`, `.md`, `.json`, `.csv` und `.log` an. Jede Datei darf bis zu 20 MB groß sein. Angehängte Dateien erscheinen vor dem Absenden als entfernbare Chips über dem Nachrichtenfeld.

Damit sie ein Bild lesen kann, muss das Modell der gewählten Verbindung Bilder als Eingabe unterstützen.

## Ihre Änderungen prüfen

Bearbeitet Professor Mari etwas, das es schon gibt, speichert sie die Änderung sofort und zeigt anschließend eine Prüfkarte. So kannst du sie rückgängig machen, wenn dir das Ergebnis nicht gefällt.

Die Karte trägt den Titel **Review Mari's changes** (Maris Änderungen prüfen). Sie zeigt, was Mari getan hat und welche Daten davon betroffen waren. Dazu gibt es zwei Schaltflächen:

- **Keep** bestätigt die Änderung. Du siehst die Meldung „Kept Mari's workspace change.“
- **Restore** holt die zuvor gespeicherte Fassung zurück. Du siehst die Meldung „Restored the previous app data snapshot.“

Ein paar Dinge dazu:

- Brandneue Objekte, etwa ein frischer Charakter oder ein neues Lorebook, überspringen diesen Schritt meistens. Es wurde nichts Bestehendes überschrieben, also gibt es auch nichts rückgängig zu machen.
- Eine Prüfkarte verfällt nach 10 Minuten von selbst, wenn du nicht reagierst.
- Charaktere und Personas führen zusätzlich in ihren Editoren eine eigene Versionshistorie. Dort lässt sich als zweites Sicherheitsnetz eine ältere Fassung wiederherstellen.

Zwei riskantere Änderungen warten, statt zuerst angewendet zu werden:

- **Sensitive file changes** (Änderungen an heiklen Dateien) zeigen den Pfad und den vorgeschlagenen Inhalt zusammen mit **Apply change** (Änderung anwenden) und **Discard** (verwerfen). Das betrifft Abhängigkeitsdateien, Starter, Installer und CI-Workflows. Gewöhnliche Bearbeitungen an TypeScript, React, CSS, Prompts, Routen und Dokumentation bleiben ohne diese zusätzliche Hürde möglich.
- **Dependencies** (Abhängigkeiten) zeigen das exakte öffentliche npm-Paket, die Version, den Ziel-Arbeitsbereich, den Abhängigkeitstyp, die Registry-Integrität und die deklarierten direkten Abhängigkeiten, dazu **Install** (installieren) und **Not now** (jetzt nicht). Reine Installationsbefehle wie `npm`, `pnpm`, `yarn`, `pip` und Ähnliches sind in ihrer Shell gesperrt, auch als Installation aus dem Cache.

Wer eine Bibliothek freigibt, vertraut ihrem Code – Marinara importiert und führt ihn später aus. Abgeschaltete Lifecycle-Skripte verhindern zwar die Ausführung während der Installation, machen eine Bibliothek zur Laufzeit aber nicht harmlos.

## Eigene Skills

Ein Skill ist ein kurzes Anweisungsdokument, das du schreibst, um zu ändern, wie Professor Mari eine bestimmte Art von Anfrage behandelt.

Klick auf die Schaltfläche **Skills** in ihrer Chat-Kopfzeile, um das Panel **Professor Mari Skills** zu öffnen. Von dort aus kannst du:

- Auf **New** (neu) klicken, um einen Skill aus einer Vorlage zu starten.
- Auf **Upload** (hochladen) klicken, um einen Skill aus einer `.md`- oder `.txt`-Datei hinzuzufügen.
- Jeden Skill ein- oder ausschalten. Ein ausgeschalteter Skill bleibt erhalten, wird aber nicht verwendet.
- Einen Skill auswählen und **Name**, **Description** und **Instructions** bearbeiten, dann auf **Save** (speichern) klicken. Über **Delete** (löschen) verschwindet er wieder.

Solange es noch keine Skills gibt, steht im Panel **No custom skills yet** („noch keine eigenen Skills“).

## Gespeicherte Erinnerungen

Professor Mari merkt sich deine dauerhaften Vorlieben, damit du sie nicht in jedem Chat wiederholen musst: wie deine Lorebooks oder Charakterkarten formatiert sein sollen, welche Namenskonventionen gelten oder wie sie sich verhalten soll.

Eine Erinnerung bekommt sie auf zwei Wegen:

- **Sag es ihr.** Zum Beispiel: „Merk dir, dass ich Lorebook-Einträge immer über den Namen des Charakters und seinen Spitznamen auslöse.“ Sie speichert das und zeigt dir eine Prüfkarte **Keep/Restore** mit dem genauen Wortlaut. Eine so gespeicherte Erinnerung ist zunächst **deaktiviert** (aus) und ändert nichts, bis du sie einschaltest. Dafür gibt es auf der Karte eine dritte Schaltfläche, **Keep & Enable**: speichern und sofort einschalten.
- **Leg sie selbst an.** Klick auf die Schaltfläche **Memories** (Erinnerungen) in ihrer Chat-Kopfzeile, um das Panel **Memories** zu öffnen. Dort legst du Erinnerungen an, bearbeitest sie, schaltest sie ein oder aus und löschst sie. Über **Upload** wird außerdem der Inhalt einer `.md`- oder Textdatei zu einer Erinnerung.

Sie speichert oder ändert eine Erinnerung nur, wenn **du** sie darum bittest – nie, weil etwas Gelesenes es ihr aufträgt: ein Charakter, ein Lorebook oder eine Datei.

Wie sie die Erinnerungen nutzt – und warum das ihren Prompt kaum belastet:

- Bei jedem Zug sieht sie nur einen kurzen **Index** deiner *eingeschalteten* Erinnerungen: Titel und je eine Zeile Beschreibung. Das kostet fast nichts. Passt eine Erinnerung zu dem, was du gerade tust, schlägt sie den vollen Text nach und richtet sich danach. So bleibt ihr Prompt klein, auch wenn du viele Erinnerungen anlegst – dauerhaft dabei ist nur der kurze Index. Die Ausnahme ist eine Erinnerung mit **Persistent** (siehe unten): Ihr voller Text wandert bei jedem Zug in den Prompt, deshalb sollten es wenige und kurze sein. Eine ausgeschaltete Erinnerung bleibt erhalten, wird aber ignoriert. So kannst du eine kurz abschalten, etwas anderes ausprobieren und sie später wieder einschalten.
- Bei einem Widerspruch **haben gespeicherte Erinnerungen Vorrang vor ihrem Standardverhalten**. Eine Erinnerung wie „Wenn ich frage, wie etwas geht, mach es einfach“ bringt dich zurück zum Bearbeiten ohne Rückfrage – ihre übliche Gewohnheit, vorher nachzufragen, tritt dann in den Hintergrund.
- Eine seltene Vorgabe, die bei *jedem* Zug gelten muss, stellst du auf **Persistent**. Dann hat sie den vollen Text immer vor Augen. Leg nur wenige solcher Erinnerungen an und halte sie kurz, denn jede steckt dauerhaft in ihrem Prompt. Nutz sie nur für Verhalten, das immer gelten soll.

Verwalten kannst du deine Erinnerungen im Panel **Memories** – oder du fragst sie einfach: „Woran erinnerst du dich?“, „Ergänz in meiner Erinnerung zur Lorebook-Formatierung auch die Titel“ oder „Vergiss das“.

## Chatverlauf und Restart

Professor Mari führt ihre eigenen, getrennten Chats. In deiner normalen Chatliste tauchen sie nicht auf.

Klick auf die Schaltfläche **Chats** in ihrer Kopfzeile, um die gespeicherten Chats mit Professor Mari zu öffnen. Das Panel weist darauf hin: „Restart saves the current chat here.“ Ein Klick auf einen gespeicherten Chat öffnet ihn; umbenennen und löschen geht ebenfalls.

Klick auf die Schaltfläche **Restart** (neu starten), um einen frischen Chat mit ihr zu beginnen. Restart speichert den aktuellen Chat zuerst in der Liste **Chats**. Dasselbe erreichst du mit `/restart` im Nachrichtenfeld. Du siehst die Meldung „Professor Mari's previous chat was saved.“

Während sie arbeitet, erscheint in der Kopfzeile eine Schaltfläche **Stop**. Ein Klick darauf bricht die laufende Aufgabe ab.

## Die schwebende Chat-Blase

Lässt du ihr Chatfenster offen und wechselst dann auf eine andere Seite, folgt dir Professor Mari als kleine schwebende Blase.

Auf dem Handy oder einem schmalen Bildschirm wird sie zu einem kleinen runden Avatar, den du herumziehen kannst. Ein Tipp darauf öffnet den vollen Chat wieder. Auf einem breiten Bildschirm erscheint ein kleines, verschiebbares **Ask Professor Mari**-Fenster. Beide Varianten haben ein Bedienelement, mit dem du die Blase für den Rest der Sitzung ausblendest.

## Die FAQ ist vom Chat getrennt

Neben ihrer Chat-Karte zeigt der Home-Bildschirm ein Panel namens **FAQ**. Das ist eine feste, geschriebene Liste aus Fragen und Antworten – nicht der KI-Chat.

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

- Gar keine Antwort: Prüfe über das Link-Symbol, ob eine Verbindung ausgewählt ist. Ist noch keine eingerichtet, öffne das Panel **Connections** und leg eine an.
- Einblendmeldung „You haven't set up a connection yet“: Wähle im Dropdown-Menü hinter dem Link-Symbol eine Verbindung aus oder leg zuerst eine an.
- Sie kann dein angehängtes Bild nicht lesen: Das Modell muss Bilder als Eingabe unterstützen. Wechsle zu einer Verbindung, deren Modell Bilder sehen kann.
- Fandom-Abfragen schlagen fehl: Dafür braucht es eine Internetverbindung, denn Fandom ist eine externe Website.
- Ihre Aktionen scheitern mit einem Berechtigungsfehler: Du erreichst Marinara über ein Netzwerk, nicht vom selben Rechner. Richte zuerst den Fernzugriff ein.

## Verwandte Anleitungen

- [Erste Schritte mit Marinara Engine](welcome.md)
- [Das Tutorial für den ersten Start](tutorial.md)
- [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md)
- [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md)
- [Referenz der herunterladbaren Agenten](../agents/built-in-agents.md)
- [Fernzugriff: Basic Auth und IP-Allowlist](../REMOTE_ACCESS.md)
