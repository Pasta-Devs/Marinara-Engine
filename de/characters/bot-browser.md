# Card Browser: Charaktere finden und importieren

In dieser Anleitung erfährst du, wie der **Card Browser** in Marinara Engine funktioniert – das eingebaute Werkzeug, mit dem du Charakterkarten auf öffentlichen Seiten findest und in die eigene Bibliothek holst. Beschrieben werden die Quellen, Suche und Filter sowie der Umgang mit Erwachseneninhalten je Quelle. Außerdem geht es darum, wie du einen Charakter importierst oder als Datei speicherst. In älteren Versionen hieß dieser Tab **Bot Browser** oder **Browser**.

Eine Charakterkarte ist eine Datei mit Name, Persönlichkeit, Begrüßung und weiteren Angaben zu genau einem Charakter. Normalerweise lädst du so eine Karte von einer Website herunter und anschließend in Marinara hoch. Der **Card Browser** erledigt beide Schritte an einer Stelle.

## Was der Card Browser ist

Der **Card Browser** durchsucht mehrere öffentliche Charakterkarten-Seiten direkt aus Marinara heraus. Unterstützt werden fünf Quellen: **ChubAI**, **JannyAI**, **Pygmalion**, **Wyvern** und **DataCat**. **CharacterTavern** steht weiterhin in der Liste, lässt sich vorerst aber nicht durchsuchen (siehe [CharacterTavern](#charactertavern)). Du durchsuchst eine Quelle, filterst die Ergebnisse und siehst dir alle Details eines Charakters an. Danach importierst du den Charakter in die eigene Bibliothek oder speicherst ihn als PNG-Datei. Zum Stöbern und Importieren brauchst du mit den Standardeinstellungen weder ein Konto noch einen API-Key (ein geheimer Zugangscode, ähnlich einem Passwort).

## Den Card Browser öffnen

Es gibt zwei Wege, den **Card Browser** zu öffnen.

1. Klick auf das **Card Browser**-Symbol in der oberen Leiste. Es sitzt rechts in der Reihe der Panel-Schaltflächen.
2. Oder öffne das **Card Browser**-Panel in der rechten Seitenleiste und klick dort oben auf die Schaltfläche **Download Cards** (Karten herunterladen).

So oder so wechselt der gesamte Inhaltsbereich in die vollständige **Card Browser**-Ansicht. Sie ersetzt den Chatbereich und ist kein kleines Pop-up-Fenster.

Zum Verlassen klickst du oben links im Kopfbereich des **Card Browser** auf die Zurück-Pfeil-Schaltfläche. Du landest wieder auf dem Bildschirm, von dem du gekommen bist.

Der **Card Browser** bleibt geladen, solange die App offen ist. Schließt du ihn und öffnest ihn erneut, sind die letzte Suche, die Filter und der ausgewählte Charakter noch da. Erst ein Neuladen der ganzen App setzt alles zurück.

## Eine Quelle wählen

Klick auf die Quellen-Schaltfläche im Kopfbereich. Sie zeigt den Namen der aktuellen Quelle und einen kleinen Pfeil. Es öffnet sich ein Menü mit den Quellen in dieser Reihenfolge: **ChubAI**, **JannyAI**, **CharacterTavern**, **Pygmalion**, **Wyvern** und **DataCat**. **CharacterTavern** ist dort als **Unavailable** gekennzeichnet.

Beim ersten Öffnen des **Card Browser** ist **ChubAI** ausgewählt. Beim Wechsel der Quelle werden Suchtext, Tags (Schlagwörter) und Filter zurückgesetzt. Jede Quelle merkt sich Login und Einstellung für Erwachseneninhalte getrennt; eine Änderung wirkt sich also nicht auf die anderen aus.

Noch eine Anmerkung zu den Namen: Im Menü steht **ChubAI**, auf der Detailseite eines Charakters heißt der Link nach außen dagegen **View on Chub**. So nennt sich die Seite selbst. Bei den anderen Quellen ist der Name an beiden Stellen gleich.

## CharacterTavern

CharacterTavern hat seine Website neu aufgebaut und bietet den Zugang nicht mehr an, über den Marinara Karten gesucht und heruntergeladen hat. Wählst du **CharacterTavern**, zeigt der **Card Browser** statt Suchergebnissen einen kurzen Hinweis. Stellt CharacterTavern künftig einen API-Zugang bereit, ist das Stöbern dort vielleicht wieder möglich.

Bis dahin kannst du Charaktere von CharacterTavern weiterhin von Hand in Marinara holen:

1. Klick im Hinweis auf **Open CharacterTavern** (CharacterTavern öffnen). Die Seite öffnet sich in einem neuen Tab.
2. Lade die Charakterkarte als Datei von character-tavern.com herunter.
3. Klick im Hinweis auf **Import Character** (Charakter importieren) und wähle die heruntergeladene Datei aus. Siehe [Charakterkarten importieren und exportieren](import-export.md).

Charaktere, die du bereits von CharacterTavern importiert hast, bleiben in deiner Bibliothek.

## Suchen, sortieren, blättern

Tipp in das Feld **Search characters...** (Charaktere suchen), um zu suchen. Enter musst du nicht drücken. Marinara wartet nach dem Tippen einen Moment (etwa eine halbe Sekunde) und sucht dann automatisch. Auch das Leeren des Feldes oder eine geänderte Filtereinstellung startet die Suche neu.

Neben dem Suchfeld liegt ein Dropdown-Menü zum Sortieren. Die Optionen unterscheiden sich je Quelle, und jede Quelle startet mit ihrer eigenen Standardsortierung:

| Quelle    | Standardsortierung |
| --------- | ------------------ |
| ChubAI    | Most Downloaded    |
| JannyAI   | Newest             |
| Pygmalion | Downloads          |
| Wyvern    | Popular            |
| DataCat   | Relevance          |

Klick auf die Schaltfläche **Refresh** (Aktualisieren, das Symbol mit dem Kreispfeil), um die aktuelle Suche erneut auszuführen.

Unter den Ergebnissen stehen die Schaltflächen **Previous** (Zurück) und **Next** (Weiter) sowie eine Seitenangabe wie **Page 2**. Kann die Quelle keine genaue Gesamtzahl liefern, erscheint nur die aktuelle Seitenzahl.

Ein Hinweis zu **DataCat**: Die Sortierung **Fresh** liefert nur dann frische Ergebnisse, wenn weder ein Tag-Filter noch ein Suchtext gesetzt ist. Sobald du suchst oder ein Tag wählst, fällt **DataCat** auf die normale Relevanzsortierung zurück.

## Nach Tags filtern

Klick auf die Schaltfläche **Tags** in der Werkzeugleiste, um das Tag-Panel zu öffnen.

- Tipp in das Feld **Search tags...** (Tags suchen), um die Tag-Liste einzugrenzen.
- Klick auf das grüne Häkchen neben einem Tag, um es einzuschließen. Das rote Minus schließt es aus. Beides gleichzeitig geht nicht.
- Eingeschlossene Tags erscheinen als grüner Chip, ausgeschlossene als roter. Ein Klick auf einen Chip entfernt ihn.
- Die Schaltfläche **Clear** (Leeren) entfernt alle aktiven Tags.

Bei den meisten Quellen entsteht die Tag-Liste aus den Charakteren der letzten Suchen. Vor der ersten Suche steht im Panel **Tags will appear after searching**. Fehlt ein gewünschtes Tag, tipp seinen Namen ein. Dann erscheinen zwei Schaltflächen: eine nimmt es als Filter auf, die andere sperrt es aus den Ergebnissen aus.

**DataCat** funktioniert anders: Dort werden die beliebtesten Tags sofort geladen, denn die Tag-Liste ist sehr groß. Jeden anderen Tag-Namen kannst du weiterhin von Hand eintippen.

## Weitere Filter

Manche Quellen zeigen zusätzlich eine Schaltfläche **Filters** (Filter) in der Werkzeugleiste. Sie erscheint nur, wenn die Quelle überhaupt Filter anbietet – bei **DataCat** also nicht. Ein kleines Badge zeigt, wie viele Filter aktiv sind.

Das Filter-Panel kann Folgendes enthalten:

- Kontrollkästchen für Inhalte, etwa **Lorebook** oder **Alt Greetings**, die nur Charaktere mit dieser Eigenschaft übrig lassen. Ein Lorebook ist eine Sammlung von Weltwissen, die ein Charakter mitbringen kann.
- **Sort Direction** (Sortierrichtung) mit **Descending** oder **Ascending**, bei **ChubAI** und **Pygmalion**.
- Die Zahlenfelder **Min Tokens** und **Max Output Tokens** begrenzen die Ergebnisse nach Größe; ein Token ist ein kleines Textstück. Bleiben die Felder leer, gilt der Standard der Quelle.
- **JannyAI** hat einen Schalter **Show Low Quality**. Er ist standardmäßig aus und blendet Charaktere aus, die **JannyAI** als minderwertig markiert hat. Schalte ihn ein, um sie einzublenden.

Hinweis zu **Wyvern**: Die Kontrollkästchen **Lorebook** und **Alt Greetings** erscheinen dort ebenso wie die Felder **Min Tokens** und **Max Output Tokens**. Auf die Ergebnisse von **Wyvern** wirkt sich davon nichts aus. Grenze die Treffer stattdessen über das Sortier-Dropdown und über Tags ein.

## Erwachseneninhalte (NSFW) je Quelle

Erwachseneninhalte heißen in der App **NSFW** (Not Safe For Work, also nicht jugendfrei). In der Werkzeugleiste gibt es dafür ein einziges Kontrollkästchen **NSFW**, doch jede Quelle geht anders damit um. Das ist die häufigste Frage – lies den Abschnitt also genau.

- **ChubAI** und **JannyAI**: Das Kontrollkästchen **NSFW** wirkt sofort, ganz ohne Login. Standardmäßig ist es aus.
- **Pygmalion**: Das Kontrollkästchen **NSFW** ist ausgegraut, bis du dich anmeldest. Der Tooltip (Kurzhinweis beim Draufzeigen) verweist auf die Anmeldung. Nach dem Login richtet sich die App nach deinen Kontoeinstellungen bei Pygmalion. Das Kästchen heißt dann **NSFW depends on your account settings**. Einen eigenen Ein- und Ausschalter gibt es nach dem Login nicht mehr.
- **Wyvern**: Das Kontrollkästchen **NSFW** ist immer ausgegraut. Ein Hinweis lautet **Use "🔞 Popular NSFW" sort for NSFW content**. Für Erwachseneninhalte auf **Wyvern** wählst du im Sortier-Dropdown die Option **🔞 Popular NSFW**.
- **DataCat**: Dort ist jeder Charakter als Erwachseneninhalt markiert, das Kästchen bleibt also fest aktiviert. Beim ersten Aufruf von **DataCat** erscheint ein Dialogfenster mit dem Titel **DataCat is NSFW only**. Klick auf **Continue to DataCat**, um zu stöbern, oder auf **Don't continue to DataCat**, um zurückzugehen.

Charaktere mit Erwachseneninhalten tragen ein kleines rotes **NSFW**-Badge in der Ecke ihres Vorschaubilds.

## Anmelden bei Pygmalion

**Pygmalion** versteckt Erwachseneninhalte hinter einer Anmeldung. Für normale, öffentliche Charaktere brauchst du keinen Login. Er schaltet ausschließlich Erwachseneninhalte frei.

Zum Anmelden klickst du in der Werkzeugleiste auf die Schaltfläche **Log In** (Anmelden). Es öffnet sich ein Anmeldefenster. Dort fügst du einen Wert ein, den du zuvor in deinem Pygmalion-Konto kopiert hast. Nach dem Passwort fragt Marinara nicht.

Bei **Pygmalion** heißt das Fenster **Pygmalion Authentication** und verlangt ein **Auth Token**:

1. Geh auf pygmalion.chat und melde dich bei deinem Konto an.
2. Öffne die Entwicklerwerkzeuge des Browsers, in den meisten Browsern mit der Taste F12. Die Entwicklerwerkzeuge sind ein eingebautes Browser-Panel für fortgeschrittene Nutzende.
3. Öffne den Tab **Application**, dann **Local Storage**.
4. Such den Eintrag `authn` und kopiere seinen Wert.
5. Füge den Wert in Marinara in das Feld **Auth Token** ein.
6. Klick auf **Save & Connect**. Es sollte eine Meldung erscheinen, dass NSFW-Inhalte aktiviert sind.

Das Fenster enthält einen Hilfebereich, der diese Schritte wiederholt, und einen Link **Website**, der pygmalion.chat öffnet. Zum Abmelden öffnest du das Anmeldefenster erneut und klickst auf **Log Out**.

Wichtig: Dieser Login liegt ausschließlich im Arbeitsspeicher des Servers. In eine Datei schreibt Marinara ihn nie. Startest du den Marinara-Server neu, bist du abgemeldet und musst das Token erneut einfügen. Marinara weist dich dann mit einer Meldung darauf hin.

## Einen Charakter vor dem Import prüfen

Klick auf eine beliebige Ergebniskarte, um die Detailansicht zu öffnen. Über **Back to results** (Zurück zu den Ergebnissen) geht es zurück.

Die Detailansicht zeigt Avatar, Name, Ersteller, einen kurzen Slogan und bis zu zwanzig Tag-Chips. Dazu kommt ein Link **View on**, der die Originalseite des Charakters in einem neuen Tab öffnet.

Darunter stehen alle Details des Charakters, allerdings nur, soweit die Quelle sie liefert. Diese Abschnitte tragen Überschriften wie **Creator's Notes**, **Personality**, **Scenario**, **First Message** und **Alternate Greetings**. Trägt der Charakter ein Lorebook mit sich, erscheint ein bernsteinfarbenes Badge **Has embedded lorebook**.

Nicht jede Quelle liefert immer vollständige Details. Lädt gar nichts, weist die Ansicht darauf hin, dass sich der Charakter auch mit seinen Grunddaten importieren lässt.

## Einen Charakter importieren oder herunterladen

In der Detailansicht stehen zwei Schaltflächen bereit. **Import** (Importieren) fügt den Charakter der Marinara-Bibliothek hinzu. **Download as PNG** (Als PNG herunterladen) speichert ihn als Datei auf dem Gerät, ohne ihn in die Bibliothek aufzunehmen.

So importierst du Charakterkarten in die eigene Bibliothek:

1. Öffne die Detailansicht eines Charakters.
2. Wähle eine Option unter **Imported tags** (siehe Tabelle unten).
3. Klick auf **Import**. Während des Vorgangs zeigt die Schaltfläche **Importing...**.
4. Warte auf die Erfolgsmeldung. Es sollte eine Meldung erscheinen, dass der Charakter importiert wurde.
5. Öffne das Panel **Characters** (Charaktere), um den importierten Charakter zu finden, bevor du einen Chat startest.

Der importierte Charakter verhält sich wie jeder andere. Zum Chatten brauchst du zusätzlich eine funktionierende Verbindung zu einem Anbieter. Siehe [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md).

### Imported tags

Das Panel **Imported tags** neben dem Avatar steuert, welche Tags der Charakter mitbringt. Standard ist **All tags**.

| Option        | Wirkung                                              |
| ------------- | ---------------------------------------------------- |
| All tags      | Übernimmt die Tags der Quelle.                       |
| No tags       | Übernimmt keine Tags der Quelle.                     |
| Existing only | Übernimmt nur Tags, die du in Marinara schon nutzt.  |

### Nachfrage bei eingebettetem Lorebook

Trägt der Charakter ein eingebettetes Lorebook, erscheint beim Import ein kleines Bestätigungsfenster des Webbrowsers. Es fragt, ob du das Lorebook zusätzlich als eigenständiges Marinara-Lorebook speichern willst. Klick auf **OK**, um das separate Lorebook anzulegen, zusätzlich zu der Kopie am Charakter. Klick auf **Cancel**, um das Lorebook nur am Charakter zu belassen.

### Download as PNG

Klick auf **Download as PNG**, um den Charakter als normale PNG-Charakterkarte zu speichern. Während des Vorgangs zeigt die Schaltfläche **Building PNG...**. Das funktioniert bei jeder Quelle. Die gespeicherte Datei trägt den Namen des Charakters, zum Beispiel `Some_Character.png`. Du kannst sie weitergeben oder später in eine andere App importieren.

JSON und PNG sind zwei gängige Formate für dieselben Charakterdaten. JSON ist ein reines Textformat. Eine PNG-Karte ist eine Bilddatei, in der die Charakterdaten stecken. Beide enthalten den vollständigen Charakter.

## Deine importierten Charaktere

Das **Card Browser**-Panel in der rechten Seitenleiste führt eine eigene Liste der Charaktere, die du über den **Card Browser** importiert hast. Selbst angelegte oder auf anderem Weg importierte Charaktere tauchen hier nicht auf. In der Hauptbibliothek **Characters** stehen sie trotzdem alle.

- Die Schaltfläche **Download Cards** öffnet die vollständige **Card Browser**-Ansicht.
- Das Feld **Search imported...** (Importierte suchen) filtert diese Liste.
- Das Sortier-Dropdown bietet **A-Z**, **Z-A**, **Newest** und **Oldest**.
- Per Rechtsklick auf eine Zeile oder über deren Schaltflächen erreichst du **Quick Start Roleplay** und **Quick Start Conversation**. Beide starten einen neuen Chat mit diesem Charakter. Hier lässt sich der Charakter außerdem aus der Liste löschen.

## Fehlerbehebung

**Suche oder Details bei JannyAI scheitern mit einem Cloudflare-Fehler.** Manche Seiten blockieren automatisierte Anfragen. Ruf jannyai.com einmal im selben Webbrowser auf, bestehe die dort angezeigte Prüfung und such danach in Marinara erneut.

**Der Login bei Pygmalion funktioniert nicht mehr.** Ein Neustart des Marinara-Servers löscht diesen Login. Öffne das Fenster **Log In** erneut und füge das Token noch einmal ein.

**CharacterTavern zeigt nur einen Hinweis.** Das ist normal. Wie du Karten von dort als Datei importierst, steht unter [CharacterTavern](#charactertavern).

**Eine Suche schlägt fehl oder eine Quelle funktioniert nicht mehr.** Öffentliche Seiten ändern ihre Seiten oder sperren den Zugriff jederzeit. Versuch es später noch einmal. Scheitert eine Quelle dauerhaft, öffne den Charakter direkt auf der Seite und lade die Karte selbst herunter. Anschließend holst du sie über den normalen Import herein. Siehe [Charakterkarten importieren und exportieren](import-export.md).

## Verwandte Anleitungen

- [Charakterkarten importieren und exportieren](import-export.md)
- [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md)
- [Fehlerbehebung](../TROUBLESHOOTING.md)
