# Card Browser: Charaktere finden und importieren

Der **Card Browser** findet Charakterkarten auf öffentlichen Seiten und importiert sie direkt aus Marinara in deine Bibliothek, sodass du keine Dateien von Hand herunter- und wieder hochladen musst. In älteren Versionen hieß er **Bot Browser** oder **Browser**.

Eine Charakterkarte ist eine Datei mit Name, Persönlichkeit, Begrüßung und weiteren Angaben zu einem Charakter. Zum Stöbern und Importieren brauchst du mit den Standardeinstellungen weder ein Konto noch einen API-Key.

## Den Card Browser öffnen

1. Klick in der oberen Navigationsleiste auf **Characters** (Charaktere) oder **Personas**. Siehst du sie nicht, öffne zuerst **More** (Mehr).
2. Klick oben auf die Schaltfläche **Download** (Herunterladen). Ihr Tooltip lautet **Download character cards**.

Der Card Browser füllt den gesamten Inhaltsbereich aus und trägt den Titel **Browse character cards online**. Zum Verlassen klickst du oben links auf den Zurück-Pfeil.

Schließt du ihn und öffnest ihn erneut, sind deine letzte Suche, die Filter und der ausgewählte Charakter noch da. Ein Neuladen der App setzt sie zurück.

## Eine Quelle wählen

Klick auf die Quellen-Schaltfläche im Kopfbereich. Das Menü listet in dieser Reihenfolge: **ChubAI**, **JannyAI**, **CharacterTavern**, **Pygmalion**, **Wyvern**, **DataCat**, **PlotLight** und **PlotLight Personas**. Beim ersten Mal ist **ChubAI** ausgewählt. Ein Wechsel der Quelle leert Suchtext, Tags und Filter. Jede Quelle behält ihre eigene Einstellung für Erwachseneninhalte und ihren eigenen Login.

| Quelle | Erwachseneninhalte (NSFW) |
| --- | --- |
| **ChubAI** | Das Kontrollkästchen **NSFW** funktioniert. Standardmäßig aus. |
| **JannyAI** | Das Kontrollkästchen **NSFW** funktioniert. Standardmäßig aus. |
| **Pygmalion** | Ausgegraut, bis du dich [anmeldest](#log-in-to-pygmalion). Danach richtet es sich nach deinen Kontoeinstellungen bei Pygmalion. |
| **Wyvern** | Immer ausgegraut. Wähl stattdessen die Sortierung **🔞 Popular NSFW**. |
| **DataCat** | Jede Karte ist als Erwachseneninhalt markiert, deshalb ist das Kontrollkästchen fest aktiviert. |
| **PlotLight** und **PlotLight Personas** | Immer ausgegraut. PlotLight wendet eigene Regeln an. Ergebnisse, die als Erwachseneninhalt markiert sind, bekommen ein **NSFW**-Badge. |

Du weißt nicht, wo du anfangen sollst? Nimm **ChubAI**, die erste Quelle. Jede Quelle startet mit ihrer eigenen Sortierung, die du im Sortier-Dropdown ändern kannst.

Karten mit Erwachseneninhalten tragen ein kleines rotes **NSFW**-Badge auf ihrem Vorschaubild. Im Menü steht **ChubAI**, der Link nach außen auf einer Karte heißt aber **View on Chub** – so nennt sich die Seite selbst.

### DataCat

Wählst du **DataCat** zum ersten Mal, erscheint ein Dialogfenster mit dem Titel **DataCat is NSFW only**. Klick auf **Continue to DataCat**, um zu stöbern, oder auf **Don't continue to DataCat**, um zurückzugehen. Die Sortierung **Fresh** zeigt nur dann frische Ergebnisse, wenn weder ein Tag-Filter noch ein Suchtext gesetzt ist.

### CharacterTavern

CharacterTavern hat seine Website neu aufgebaut und bietet den Zugang, den Marinara genutzt hat, nicht mehr an. Wählst du die Quelle, ersetzt ein Hinweis die Ergebnisse. Bietet CharacterTavern künftig einen API-Zugang an, ist das Stöbern dort vielleicht wieder möglich. Bis dahin importierst du die Karten von Hand:

1. Klick im Hinweis auf **Open CharacterTavern** (CharacterTavern öffnen). Die Seite öffnet sich in einem neuen Tab.
2. Lade die Kartendatei von character-tavern.com herunter.
3. Klick im Hinweis auf **Import Character** (Charakter importieren) und wähl die Datei aus. Siehe [Charakterkarten importieren und exportieren](import-export.md).

Charaktere, die du bereits von dort importiert hast, bleiben in deiner Bibliothek.

### PlotLight

PlotLight teilt öffentliche Charaktere und Personas. **PlotLight** listet Charakterkarten auf. **PlotLight Personas** listet Personas auf, also die Charaktere, die dich in Chats darstellen. Ein PlotLight-Konto brauchst du nicht. Die Detailansicht hat einen Link **View on PlotLight** zur Originalseite.

Marinara lädt die Datei herunter, die PlotLight anbietet. Eine Charakterkarte kommt meist als PNG mit ihrem Porträt und jedem Lorebook, das der Ersteller freigibt. Eine Persona kommt als Textdatei, und Marinara kopiert ihr Bild separat. Beide Arten kannst du als Charakter oder als Persona importieren.

PlotLight begrenzt, wie schnell Apps dort anfragen dürfen. Bist du zu schnell, meldet Marinara **PlotLight is busy** mit einer Zahl von Sekunden und wartet so lange. Für Suche und Import gelten getrennte Limits.

Manche Karten lassen sich nicht herunterladen, etwa wenn der Ersteller es nicht erlaubt. Marinara meldet dann **PlotLight doesn't offer this for download.** Du kannst diese Karte weder importieren noch ihre Details ansehen, aber ihr Bild, ihr Ersteller und der Link **View on PlotLight** bleiben.

## Suchen, sortieren und blättern

Tipp in **Search characters** (Charaktere suchen). <kbd>Enter</kbd> musst du nicht drücken. Marinara sucht einen Moment, nachdem du aufhörst zu tippen, und erneut, wenn du das Feld leerst oder einen Filter änderst. Jede Quelle hat ihr eigenes Sortier-Dropdown. Klick auf die Schaltfläche **Refresh** (Aktualisieren, Kreispfeil), um die Suche erneut auszuführen.

Unter den Ergebnissen stehen **Previous** (Zurück) und **Next** (Weiter) mit einer Angabe wie **Page 2**. Kann eine Quelle keine Gesamtzahl liefern, erscheint nur die aktuelle Seite. **PlotLight** liefert nie eine Gesamtzahl, deshalb steht im Kopfbereich **Browsing PlotLight**. Eine PlotLight-Seite kann wenige Karten oder gar keine enthalten und trotzdem weitere Seiten haben. **Next** bleibt aktiv, sodass du weiterblättern kannst.

## Nach Tags filtern

1. Klick in der Werkzeugleiste auf **Tags**.
2. Tipp in **Search tags** (Tags suchen), um die Liste einzugrenzen.
3. Klick auf das grüne Häkchen neben einem Tag, um es einzuschließen, oder auf das rote Minus, um es auszuschließen. Beides gleichzeitig geht nicht.
4. Klick auf einen Chip, um dieses Tag zu entfernen, oder auf **Clear** (Leeren), um alle zu entfernen.

Bei den meisten Quellen entsteht die Liste aus den Charakteren deiner letzten Suchen. Vor der ersten Suche steht im Panel **Tags will appear after searching**. Fehlt ein gewünschtes Tag, tipp seinen Namen ein. Dann erscheinen zwei Schaltflächen: Eine nimmt es als Filter auf, die andere sperrt es. **DataCat** lädt seine beliebtesten Tags sofort, und du kannst trotzdem andere eintippen. Bei **PlotLight** schlägt Marinara ein eingetipptes Tag in der eigenen Liste von PlotLight nach, und ein Tag, das PlotLight nicht hat, findet nichts.

## Weitere Filter

Die meisten Quellen haben zusätzlich eine Schaltfläche **Filters** (Filter) mit einem Badge, das die aktiven Filter zählt. Bei **DataCat** und **PlotLight** erscheint sie nicht. Das Panel kann Folgendes enthalten:

- Kontrollkästchen für Inhalte wie **Lorebook** oder **Alt Greetings**, die nur Charaktere mit dieser Eigenschaft übrig lassen. Ein Lorebook ist zusätzliches Hintergrundwissen, das ein Charakter mitbringt.
- **Sort Direction** (Sortierrichtung), **Descending** oder **Ascending**, bei **ChubAI** und **Pygmalion**.
- Die Felder **Min Tokens** und **Max Output Tokens**, die die Ergebnisse nach Größe begrenzen. Lass sie leer, um den Standard der Quelle zu verwenden.
- Einen Schalter **Show Low Quality** bei **JannyAI**. Er ist aus und blendet damit Karten aus, die JannyAI als minderwertig markiert hat.

Bei **Wyvern** erscheinen die Kontrollkästchen **Lorebook** und **Alt Greetings** sowie die Token-Felder, ändern aber nichts an den Ergebnissen. Nutz stattdessen das Sortier-Dropdown und Tags.

## Einen Charakter prüfen

Klick auf ein Ergebnis, um seine Detailansicht zu öffnen. **Back to results** (Zurück zu den Ergebnissen) führt zur Liste zurück.

Die Detailansicht zeigt Avatar, Name, Ersteller, einen kurzen Slogan, bis zu zwanzig Tag-Chips und einen Link **View on** zur Originalseite. Darunter stehen die vollständigen Details, sofern die Quelle sie liefert, unter Überschriften wie **Creator's Notes**, **Personality**, **Scenario**, **First Message** und **Alternate Greetings**. Trägt die Karte ein Lorebook mit sich, erscheint ein bernsteinfarbenes Badge **Has embedded lorebook**. Liefert eine Quelle keine Details, weist die Ansicht darauf hin, dass du trotzdem mit den Grunddaten importieren kannst.

## Einen Charakter importieren

Bevor du anfängst: Zum Chatten mit dem Charakter brauchst du eine funktionierende Textverbindung. Siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

1. Öffne die Detailansicht eines Charakters.
2. Wähl neben dem Avatar eine Option unter **Imported tags** (importierte Tags). Standard ist **All tags**. Siehe [Importoptionen](import-export.md#import-options).
3. Klick auf **Import** (Importieren). Das Fenster **Import Card** öffnet sich und fragt **Where should this card live?**
4. Kreuz optional **Split description into fields** (Beschreibung in Felder aufteilen) an. Siehe [Importoptionen](import-export.md#import-options).
5. Klick auf **Import as Character**, um die Karte zu **Characters** hinzuzufügen, oder auf **Import as Persona**, um sie zu **Personas** hinzuzufügen.
6. Hat die Karte ein eingebettetes Lorebook, zeigt ein Panel **Embedded lorebook found**, wie viele Einträge es hat. Klick auf **Import Lorebook**, um zusätzlich ein eigenständiges Lorebook anzulegen, oder auf **No Import**, um es nur in der Karte zu behalten. **Back** führt zurück zu Schritt 5.
7. Warte, solange die Schaltfläche **Importing...** zeigt. Eine Meldung lautet `Imported "Name" successfully!`
8. Öffne **Characters** (oder **Personas**), um die importierte Karte zu finden.

Wenn es nicht funktioniert hat: Lies die Fehlermeldung in der Toast-Meldung. Bei **JannyAI** ist eine Cloudflare-Sperre die häufigste Ursache (siehe Fehlerbehebung unten).

### Download as PNG

Klick in der Detailansicht auf **Download as PNG** (Als PNG herunterladen), um die Karte als normale PNG-Charakterkarte auf deinem Gerät zu speichern, ohne sie deiner Bibliothek hinzuzufügen. Während des Vorgangs zeigt die Schaltfläche **Building PNG...**. Das funktioniert bei jeder Quelle, und die Datei trägt den Namen des Charakters, etwa `Some_Character.png`. Eine PNG-Karte ist ein Bild, in dem die Charakterdaten stecken. Du kannst sie weitergeben oder in eine andere App importieren.

## Fehlerbehebung

| Problem | Lösung |
| --- | --- |
| Suche oder Details bei **JannyAI** scheitern mit einem Fehler, der Cloudflare erwähnt (eine Sicherheitsprüfung, die automatische Anfragen blockiert), oder die vollständige Definition der Karte wird blockiert. | Ruf jannyai.com einmal im selben Browser auf und bestehe eine etwaige Prüfung. Such dann erneut. Ist die Karte weiterhin blockiert, öffne sie auf JannyAI, lade ihr PNG herunter und importiere diese Datei. |
| Mein Pygmalion-Login funktioniert nicht mehr. | Ein Neustart des Servers löscht ihn. Melde dich mit einem frischen Token erneut an. |
| **CharacterTavern** zeigt nur einen Hinweis. | Das ist normal. Siehe [CharacterTavern](#charactertavern). |
| **PlotLight is busy.** | Warte die in der Meldung genannten Sekunden ab und versuch es dann erneut. |
| **PlotLight doesn't offer this for download.** | Möglicherweise erlaubt der Ersteller keine Downloads, oder die Karte ist nicht mehr öffentlich. Prüf das über **View on PlotLight**. |
| Eine Suche schlägt fehl oder eine Quelle funktioniert nicht mehr. | Öffentliche Seiten ändern sich oder sperren den Zugriff jederzeit. Versuch es später, oder lade die Karte von der Seite herunter und nutz den normalen Import. Siehe [Charakterkarten importieren und exportieren](import-export.md). |

<a id="log-in-to-pygmalion"></a>

## Bei Pygmalion anmelden

Pygmalion versteckt seine Erwachseneninhalte hinter einer Anmeldung. Öffentliche Charaktere brauchen keinen Login. Marinara fragt nie nach deinem Passwort. Du fügst einen Wert ein, den du aus deinem eigenen Konto kopiert hast.

1. Klick in der Werkzeugleiste auf **Log In** (Anmelden). Das Fenster **Pygmalion Authentication** öffnet sich.
2. Geh in deinem Browser auf pygmalion.chat und melde dich an.
3. Öffne die Entwicklerwerkzeuge deines Browsers, ein eingebautes Panel für fortgeschrittene Nutzende. In den meisten Desktop-Browsern drückst du dafür <kbd>F12</kbd>. Browser auf dem Smartphone haben sie meist nicht, nimm für diesen Schritt also einen Computer.
4. Öffne den Tab **Application**, dann **Local Storage**.
5. Such den Eintrag namens `authn` und kopier seinen Wert.
6. Füg ihn in Marinara in **Auth Token** ein. Das Feld verbirgt, was du einfügst.
7. Klick auf **Save & Connect**. Eine Meldung bestätigt, dass NSFW-Inhalte aktiviert sind.

Das Fenster hat einen Hilfebereich, der diese Schritte wiederholt, und einen Link **Website** zu pygmalion.chat.

Marinara prüft das Token zuerst bei Pygmalion. Lehnt Pygmalion es ab, wird nichts gespeichert, und eine Meldung nennt den Grund. Akzeptiert Pygmalion es später nicht mehr, meldet Marinara dich ab und bittet dich, dich erneut anzumelden.

Der Login liegt nur im Arbeitsspeicher des Servers. In einer Datei wird er nie gespeichert, deshalb meldet dich ein Neustart des Marinara-Servers ab. Um dich selbst abzumelden, öffne das Fenster erneut und klick auf **Log Out** (Abmelden). Für eine vollständige Abmeldung meldest du dich zusätzlich auf pygmalion.chat ab.

## Verwandte Anleitungen

- [Charakterkarten importieren und exportieren](import-export.md)
- [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md)
- [Fehlerbehebung](../TROUBLESHOOTING.md)
