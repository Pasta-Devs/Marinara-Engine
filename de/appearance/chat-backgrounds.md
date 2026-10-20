# Chat-Hintergründe

In dieser Anleitung geht es um die Hintergrund-Bibliothek von Marinara Engine. Darin liegen Bilder, die du selbst hochlädst und von Hand hinter den Chat legst. Der **Background**-Agent (Hintergrund) sucht dagegen bei jedem Zug selbst einen Szenen-Hintergrund aus – dazu mehr unter [Roleplay-Hintergründe](../roleplay/backgrounds.md). Wie du Szenen-Hintergründe per KI aus der Galerie erzeugst, steht unter [Szenen-Hintergründe und die Galerie](../media/scene-backgrounds.md).

## Wo die Hintergründe liegen

Alle Hintergründe verwaltest du an einer einzigen Stelle: **Settings** (Einstellungen), dann der Tab **Appearance** (Darstellung), dann der Abschnitt **Backgrounds** (Hintergründe).

Der Abschnitt **Backgrounds** besteht aus drei Teilen:

1. Die Auswahl **Chat Background** (Chat-Hintergrund) für das Bild im aktuellen Chat.
2. Der Schieberegler **Background Blur** (Hintergrund-Unschärfe).
3. Die Hintergrund-Bibliothek zum Importieren, Sortieren, Filtern, Taggen, Umbenennen, Herunterladen und Löschen von Bildern.

Ein Chat-Hintergrund erscheint nur in Roleplay- und Game-Mode-Chats. Conversation nutzt stattdessen einen Farbverlauf, den du im Abschnitt **Conversation Theme** (Conversation-Design) festlegst. Näheres dazu unter [Darstellungs-Einstellungen](appearance-settings.md).

## Die Hintergrund-Bibliothek

In der Bibliothek liegt jedes Bild, das zur Auswahl steht. Deine eigenen Uploads stehen dort neben den mitgelieferten Bildern von Marinara. Eine kleine Beschriftung an jedem Bild zeigt, woher es stammt:

- **Library**: ein Bild, das du selbst hochgeladen hast. Solche Bilder lassen sich umbenennen, taggen und löschen.
- **Game asset**: ein mitgeliefertes Bild von Marinara. Diese Bilder sind schreibgeschützt und lassen sich weder umbenennen noch taggen oder löschen.

### Einen Hintergrund importieren

1. Suche das Feld **Import Backgrounds** (Hintergründe importieren) oben in der Bibliothek.
2. Zieh eine oder mehrere Bilddateien auf das Feld, oder klick darauf und wähle Dateien aus.
3. Warte, bis der Upload durch ist. Währenddessen zeigt das Feld **Importing...** an.
4. Die neuen Bilder erscheinen im Raster darunter mit der Beschriftung **Library**.

Mehrere Dateien auf einmal sind kein Problem. Jede Datei muss ein Bild in einem dieser Formate sein: JPG, PNG, GIF, WebP oder AVIF. Pro Datei sind bis zu 20 MB erlaubt.

Marinara prüft den echten Inhalt jeder Datei, nicht nur den Namen. Benennst du eine Datei, die kein Bild ist, auf `.png` um, lehnt Marinara den Upload ab.

### Einen Hintergrund für den aktuellen Chat wählen

1. Öffne **Settings**, dann **Appearance**, dann **Backgrounds**.
2. Klick im Raster auf das gewünschte Vorschaubild.
3. Auf dem gewählten Bild erscheint ein Häkchen. Es wird zum Hintergrund des geöffneten Chats.
4. Zurück zum Standard geht es mit einem erneuten Klick auf das gewählte Vorschaubild oder über die Schaltfläche **Remove** (Entfernen) neben **Chat Background**.

### Die Bibliothek durchsuchen

Über dem Raster filterst du mit dem Feld **Search backgrounds** (Hintergründe suchen) nach Name, Tag oder Herkunft. Die Zählzeile zeigt die Zahl der Treffer, etwa „3 of 20 backgrounds“. Ein Klick auf das kleine X im Suchfeld leert die Suche.

Mit der Auswahl neben der Suche sortierst du die Hintergründe nach **A-Z**, **Z-A**, **Newest** oder **Oldest**. **All** hebt alle Tag-Filter auf; unter **Tags** wählst du ein Tag (Schlagwort) oder mehrere aus. Bei mehreren gewählten Tags genügt ein einziger Treffer, damit ein Hintergrund angezeigt wird.

### Hintergründe in Ordnern sortieren

Ordner sortieren die Bibliothek, ohne die dahinterliegenden Bilddateien zu verschieben oder auszublenden.

1. Klick auf **New Folder** (Neuer Ordner). Marinara legt einen Ordner mit eindeutigem Namen an.
2. Ein Doppelklick oder Doppeltipp auf den Ordnernamen benennt ihn um. Alternativ fokussierst du ihn und drückst F2.
3. Am Rechner ziehst du eine Hintergrund-Zeile in einen Ordner. Auf Handy oder Tablet hältst du die Zeile gedrückt und ziehst sie dann.
4. Zieh einen Hintergrund zurück in den Bereich ohne Ordner, um ihn aus seinem Ordner zu nehmen.

Marinara speichert Ordner und Zuordnungen auf dem Server und nimmt sie in Backups mit auf. Löschst du einen Ordner, wandern seine Hintergründe zurück in die Liste ohne Ordner – die Bilder selbst bleiben erhalten. Such- und Tag-Filter zeigen passende Einträge automatisch auch innerhalb der Ordner an.

Der **Background**-Agent sieht weiterhin jeden verfügbaren Hintergrund, auch die in Ordnern. Ordner wirken sich nur auf die Sortierung in **Settings** aus.

### Einen Hintergrund umbenennen

Umbenennen lassen sich nur Bilder mit der Beschriftung **Library**.

1. Zeig auf die Bildzeile und klick auf das Stift-Symbol (**Rename**, umbenennen).
2. Gib den neuen Namen ein. Die Dateiendung brauchst du nicht mitzutippen.
3. Klick auf **Save** (Speichern).

### Einen Hintergrund taggen

Tags helfen beim Gruppieren und Suchen der eigenen Uploads. Taggen lassen sich nur Bilder mit der Beschriftung **Library**.

1. Klick in der Bildzeile auf das Tag-Symbol (**Edit tags**, Tags bearbeiten).
2. Gib im Feld **Add tag...** ein Tag ein. Beim Tippen schlägt Marinara bereits verwendete Tags vor.
3. Drück Enter oder klick auf **Add** (Hinzufügen).
4. Um ein Tag zu entfernen, klick darauf. Solange die Tag-Bearbeitung geöffnet ist, erscheint jedes Tag als Schaltfläche mit einem X.

<a id="download-a-background"></a>

### Einen Hintergrund herunterladen

Herunterladen lassen sich alle Hintergründe, auch die mitgelieferten. Zeig auf die Bildzeile und klick auf das Download-Symbol (**Download background**, Hintergrund herunterladen). Das Bild wird unter seinem Dateinamen gespeichert. Auf iPhone oder iPad öffnet sich das Teilen-Menü, über das du es sichern kannst. Öffnet es sich nicht, tippe in der eingeblendeten Meldung auf **Save file** (Datei speichern).

### Einen Hintergrund löschen

Löschen lassen sich nur Bilder mit der Beschriftung **Library**. Zeig auf die Bildzeile, klick auf das Papierkorb-Symbol und bestätige das Löschen. War das Bild der aktuelle Chat-Hintergrund oder der Standard-Hintergrund für Roleplay, wechselt Marinara automatisch zurück zum mitgelieferten Standard.

## Einen Standard-Hintergrund für Roleplay festlegen

Der Standard-Hintergrund für Roleplay ist das Bild, mit dem jeder neue Roleplay-Chat startet, bevor er sich ein eigenes sucht. Einmal festgelegt, gilt er für alle neuen Roleplay-Chats.

1. Suche im Abschnitt **Backgrounds** das gewünschte Bild im Raster.
2. Klick in dessen Bildzeile auf das Stecknadel-Symbol (**Set as default for new Roleplay chats**, als Standard für neue Roleplay-Chats festlegen).
3. Die Stecknadel-Schaltfläche bleibt hervorgehoben, und auf dem Vorschaubild erscheint die Beschriftung **Default**. Neue Roleplay-Chats starten ab jetzt mit diesem Bild.

Der Stern oben links im Bild fügt es deinen Favoriten hinzu. Am Standard ändert er nichts.

Zurück geht es mit einem Klick auf die Stecknadel des aktuellen Standardbilds. Genauso funktioniert die Schaltfläche **Reset Roleplay default** (Roleplay-Standard zurücksetzen) oben am Raster. Diese Schaltfläche erscheint nur, wenn dein Standard-Hintergrund vom mitgelieferten abweicht.

## Background Blur

**Background Blur** zeichnet das Hintergrundbild hinter dem Chat weich, damit der Text besser lesbar bleibt. Die Einstellung wirkt auf Roleplay- und Game-Mode-Hintergründe.

1. Suche im Abschnitt **Backgrounds** den Schieberegler **Background Blur**.
2. Zieh ihn auf einen Wert von 0 bis 24. Je höher der Wert, desto stärker die Unschärfe.
3. Bei 0 bleiben die Hintergründe scharf. Der Wert 0 wird als **Off** angezeigt.

Der Standard ist 0 (**Off**).

## Wie eigene Uploads und mitgelieferte Hintergründe zusammenspielen

Die Bibliothek zeigt deine Uploads und die mitgelieferten **Game asset**-Bilder gemeinsam in einem Raster. Ausgewählt wird bei beiden gleich. Der Unterschied: **Game asset**-Bilder sind schreibgeschützt, deshalb fehlen dort die Bedienelemente zum Umbenennen, Taggen und Löschen.

Auch KI-generierte Szenen-Hintergründe aus der Galerie landen in derselben Bibliothek und lassen sich später wiederverwenden. Näheres unter [Szenen-Hintergründe und die Galerie](../media/scene-backgrounds.md).

## Wo die Hintergrund-Auswahl gespeichert wird

Drei verschiedene Einstellungen bestimmen den Hintergrund eines Chats – und alle drei werden unterschiedlich gespeichert:

- Den **Chat Background** eines Chats speichert Marinara zusammen mit dem Chat auf dem Server. Er begleitet den Chat auf jedes Gerät, auf dem du ihn öffnest.
- Hintergrund-Ordner samt Zuordnungen liegen auf dem Server und begleiten die Bibliothek auf andere Geräte.
- Der Standard-Hintergrund für Roleplay und **Background Blur** werden pro Gerät gespeichert. Sie werden nicht zwischen Browsern oder Geräten synchronisiert. Das vollständige Sync-Modell steht unter [Darstellungs-Einstellungen](appearance-settings.md).

## Automatische und KI-generierte Hintergründe

In dieser Anleitung geht es um die Bibliothek, aus der du von Hand auswählst. Zwei verwandte Funktionen übernehmen die Auswahl für dich:

- Der **Background**-Agent sucht in Roleplay-Chats Zug für Zug selbstständig einen Szenen-Hintergrund aus der Bibliothek aus. Siehe [Roleplay-Hintergründe](../roleplay/backgrounds.md).
- Die Galerie erzeugt aus der aktuellen Szene per KI einen komplett neuen Szenen-Hintergrund. Siehe [Szenen-Hintergründe und die Galerie](../media/scene-backgrounds.md).

## Verwandte Anleitungen

- [Roleplay-Hintergründe](../roleplay/backgrounds.md): der Background-Agent, der Zug für Zug automatisch einen Hintergrund aussucht.
- [Szenen-Hintergründe und die Galerie](../media/scene-backgrounds.md): KI-generierte Szenen-Hintergründe aus der Galerie.
- [Darstellungs-Einstellungen](appearance-settings.md): der komplette Tab **Appearance**, inklusive der Frage, welche Einstellungen synchronisiert werden und welche auf einem Gerät bleiben.
