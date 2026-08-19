# World Maps: Einrichten, Erstellen und Reisen

> **Aktuelle Kompatibilität:** Diese Anleitung beschreibt World Maps **1.3.1**. Das Paket unterstützt Marinara Engine **2.3.5 bis 3.x** und funktioniert in Roleplay- und Game-Chats. Marinara Engine **2.4.1** ergänzt die passende Bereinigung des Bewegungs-Streams und aktualisiert die Lorebooks-Ansicht nach portablen Importen sofort. Engine **2.3.5 bis 2.4.0** bleibt kompatibel, benötigt nach einem Import jedoch eine manuelle Aktualisierung der Lorebooks und enthält diese Stream-Bereinigung nicht.

World Maps ergänzt Roleplay und Game um einen dauerhaften Weltzustand. Statt eines einzelnen Ortes als Freitext bildet es die Welt als verschachtelte Orte ab:

```text
The Shattered Coast
└── Brinewatch
    ├── Harbor District
    │   ├── Tideglass Inn
    │   └── Quest Hall
    └── Old Sewers
```

Marinara führt in dieser Hierarchie einen maßgeblichen aktuellen Ort. Der Breadcrumb zeigt dabei den Pfad von der Wurzel bis zu diesem Ort. Breadcrumb, genaue Ortsdetails, Ziele in der Nähe und infrage kommende verknüpfte Lore dienen der nächsten Antwort als Grundlage. Maps kann außerdem einer Bewegung oder Entdeckung folgen, die deine letzte Nachricht ausdrücklich festlegt. Die sichtbare KI-Erzählung darf das Ergebnis beschreiben, die Karte aber weder bewegen noch von sich aus Orte erfinden.

Karten können pro Chat eigenständig sein oder mit einer gemeinsamen, kontoeigenen Welt verknüpft werden. Vorlagen erzeugen saubere Kopien, die sich danach auseinanderentwickeln dürfen. Eine gemeinsame Welt hält dagegen genau eine kanonische Hierarchie samt Grafiken bereit. Jeder verknüpfte Chat behält trotzdem den eigenen aktuellen Ort, den eigenen Reiseverlauf, eigene Snapshots (Momentaufnahmen) und eigene Game-Bindungen.

## Funktionsübersicht

World Maps 1.3.1 bietet:

- verschachtelte Regionen, Siedlungen, Orte, Gebäude, Stockwerke und Räume;
- Breadcrumbs und einen maßgeblichen aktuellen Story-Ort;
- Ansichten für untergeordnete Orte als Liste, als positionierte Karte oder als geordnete Ebenen;
- Reisen zwischen über- und untergeordneten Orten, Direktverknüpfungen und Routenplanung über mehrere Züge;
- geprüfte Bewegung und Entdeckung, die deine letzte Nachricht festlegt;
- kontoeigene gemeinsame Welten, die sich über Roleplay- und Game-Chats hinweg verknüpfen lassen;
- geprüfte Entwürfe pro Chat mit Bedienelementen für Veröffentlichen, Verwerfen, Konflikte und Lösen;
- kontoweite Kartenvorlagen, die von Hand, mit KI oder per Import entstehen;
- KI-gestützte Kartenentwürfe und Erweiterungen auf Basis der Einrichtung oder ausgewählter Lore;
- öffentliche Ortsbeschreibungen, privates Modellgedächtnis und Lore für genau einen Ort;
- ein optionales Referenzbild je Ort aus der **Gallery** (Galerie) des Chats oder aus der **Global Gallery**;
- einen eigenen Hintergrund je positionierter Unterkarte, ebenfalls aus Chat- oder Global Gallery;
- geprüfte Stapelgenerierung für fehlende Ortsgrafiken;
- eine globale, variablenbasierte Überschreibung für den Grafik-Prompt von Maps;
- Unterstützung für Ortsreferenzen in Roleplay-Illustrationen und Game-Storyboards;
- Import, Export, Archivierung, verlaufsbewusstes Bearbeiten und Bindungen zur Game-Karte; und
- globale Prompt-Bibliotheken für den KI-Kartenbau und den Ortseinschub zur Laufzeit.

Die verfügbaren Ziele stehen im Kontext des Modells. Sind CYOA-Auswahlen aktiv – CYOA steht für Choose Your Own Adventure –, kann das Modell also die aktuellen untergeordneten Orte oder verbundene Orte als nächste Optionen anbieten. Welche Auswahl genau erscheint, entscheidet weiterhin das Modell.

## Die richtige Kartenbeziehung wählen

Die Bibliothek enthält zwei wiederverwendbare, kontoeigene Ressourcen. Jeder Chat führt daneben seinen eigenen Laufzeit-Ort und seinen eigenen Verlauf. Der sprechende Name einer Ressource ist nicht ihre Identität: World Maps 1.3.1 hängt **(copy)** oder eine Zahl an, wenn eine neu gespeicherte Ressource sonst denselben Namen hätte.

| Ressource oder Zustand | Gehört zu | Wähle das, wenn | Worauf spätere Änderungen wirken |
| --- | --- | --- | --- |
| **Unabhängige Chat-Karte** | einem Roleplay- oder Game-Chat | diese Geschichte eine eigene Welt haben soll | nur auf diesen Chat |
| **Unabhängige Vorlage** | deinem Konto | du einen wiederverwendbaren Ausgangspunkt willst | nur auf neue Kopien; bestehende Chats ändern sich nicht |
| **Kanonische gemeinsame Welt** | deinem Konto | mehrere Chats eine gepflegte Hierarchie nutzen sollen | auf die gemeinsame Definition, die verknüpfte Chats lesen |
| **Entwurf im verknüpften Chat** | einem verknüpften Chat bis zur Veröffentlichung | eine verknüpfte Geschichte etwas entdeckt oder bearbeitet hat, das in die gemeinsame Welt gehören könnte | auf keinen anderen Chat, bis du **Publish** wählst |
| **Gelöste unabhängige Kopie** | einem zuvor verknüpften Chat | diese Geschichte die aktuelle Karte behalten, aber keine Änderungen der gemeinsamen Welt mehr bekommen soll | nur auf den gelösten Chat |

Kopieren ist kein Verknüpfen. **Use template**, **Add to chat** und **Independent copy** erzeugen jeweils eine eigene Karte. **Use shared world** während der Game-Einrichtung und **Link to chat** in der Bibliothek hängen den Chat dagegen an die kanonische gemeinsame Welt.

## Schnellstart

1. Öffne **Agents** (Agenten), klick auf **Download Agents** (Agenten herunterladen) und installiere **World Maps**.
2. Starte Marinara neu, wenn du dazu aufgefordert wirst. Das Paket enthält Servercode.
3. Öffne einen Roleplay- oder Game-Chat.
4. Öffne das eigene Globus-Symbol für **World Maps**, falls deine Engine es anbietet, oder geh über **Agents → World Maps**, und aktiviere Maps für den aktuellen Chat. Möglich ist das auch im Abschnitt **Chat Settings → Agents** dieses Chats.
5. Leg die Karte mit **Use template**, **Create with AI** oder **Build manually** an. Bestehende Chats können außerdem eine Kartendatei importieren.
6. Prüf die Arbeitshierarchie, wähl einen Startort, aktiviere die Karte und klick auf **Save** (Speichern).
7. Öffne beim Chatten die **Story map**. Wähl ein erreichbares Ziel und schick den nächsten Zug ab – oder leg die Bewegung der Party direkt in deiner Nachricht fest, damit Maps die Ankunft prüfen und übernehmen kann.
8. Optional weist du Orten Grafiken aus der Galerie zu oder nutzt **Location artwork**, um die fehlenden Bilder zu prüfen und zu generieren.

Wendest du eine Vorlage, einen KI-Entwurf oder eine importierte Datei an, ändert das nur die Arbeitskopie im Editor. Auf die Antworten wirkt sich das erst aus, wenn die Hierarchie aktiviert und gespeichert ist.

## Das Paket installieren und aktivieren

Öffne **Agents** über den Tab mit den Funkeln in der rechten Seitenleiste. Klick auf **Download Agents**, wähl **World Maps** und klick auf **Install** (Installieren). Bietet der Katalog danach ein **Update** an, installiere das ebenfalls. Folge der Aufforderung zum Neustart, bevor du das Paket nutzt.

Die Seite von World Maps nennt die installierte Paketversion und den Bereitschaftsstatus, öffnet die kontoweite Weltkarten-Bibliothek, benennt den gerade angesteuerten Chat und zeigt dessen Kartenstatus. Installiert ist das Paket damit verfügbar – aktiv ist es deshalb noch nicht in jedem Chat.

### Roleplay

1. Öffne den Roleplay-Chat.
2. Öffne **Chat Settings** (Chat-Einstellungen) über die Zahnrad-Schaltfläche.
3. Aktiviere **Enable Agents** (Agenten aktivieren).
4. Aktiviere unter **Tracker Agents** den Eintrag **World Maps**.
5. Öffne **Edit world map** oder die **World map library**. In unterstützten Engine-Builds öffnet der Globus in der oberen Leiste am Rechner dieselbe Bibliothek; am Handy nutzt du den Globus im Chats-Panel.

Die Bibliothek verhält sich gleich, egal ob du sie über die Hauptseite **Agents** oder über die Chat Settings von Roleplay öffnest. **Add to chat** liefert eine unabhängige Kopie der Vorlage, **Link to chat** eine dauerhafte gemeinsame Welt.

### Game

Wähl während der Game-Einrichtung World Maps aus und danach eine seiner Einrichtungsrouten:

- **Create with AI** bereitet eine generierte Hierarchie zur Prüfung vor.
- **Use template** öffnet die Weltbibliothek, bevor das Game entsteht.
- **Build manually** startet mit einer leeren, bearbeitbaren Hierarchie.

Nach **Use template** zeigt das Auswahlfenster zuerst **Shared worlds** und danach **Independent templates**:

- **Use shared world** verknüpft das neue Game mit dieser kanonischen, kontoeigenen Welt. Das Game behält trotzdem den eigenen aktuellen Ort, den eigenen Verlauf, eigene Snapshots, eigene Bindungen und unveröffentlichte Entdeckungen.
- **Use template** legt eine Game-eigene Arbeitskopie zur Prüfung an. Die Vorlage im Konto bleibt dabei unberührt.

Die Orte der gewählten Ressource werden zur hierarchischen Startwelt. Eine gewöhnliche Game-Karte rückt nicht ersatzweise an ihre Stelle.

World Maps lässt sich auch später noch über **Chat Settings → Agents** zu einem bestehenden Game hinzufügen.

## Kartenvorlagen anlegen und wiederverwenden

Öffne **World Maps → Open world library**. Vorlagen gehören zu deinem Konto und nicht zu einem einzelnen Chat. Damit eignen sie sich für wiederverwendbare Fandom-Welten, Kampagnen-Settings, Dungeons, Städte oder eigene Startkarten.

Aus der Bibliothek heraus kannst du:

- eine Vorlage von Hand anlegen;
- sie über **Create with AI** entwerfen lassen;
- eine `.hierarchical-map.json`-Datei importieren;
- eine Vorlage suchen, ansehen, bearbeiten, exportieren oder löschen;
- **Add to chat** in einem offenen Roleplay- oder Game-Chat nutzen; oder
- während der Game-Einrichtung **Use template** wählen.

Jede Anwendung erzeugt eine unabhängige Arbeitskopie. Spätere Änderungen an der Vorlage ändern nichts an Chats, die sie schon kopiert haben – und Änderungen im Chat ändern nichts an der Vorlage.

Vorlagen behalten kontoweite Grafikverweise auf die **Global Gallery**. Nutzt du in einem Chat **Save as template**, stuft Maps die referenzierten Chat-Grafiken in die Global Gallery hoch und greift auf ein identisches gemeinsames Bild zurück, falls es schon existiert. Jeder Chat, der die Vorlage anwendet, zeigt danach auf dieselbe gemeinsame Grafik, ohne eine weitere Kopie in der Galerie anzulegen.

Gemeinsam ist nur die Grafik. Jede angewendete Kartendefinition bleibt eine unabhängige Arbeitskopie; die Vorlage zu bearbeiten aktualisiert keine Karten, die bereits in Chats liegen.

## Chats mit einer gemeinsamen Welt verknüpfen

Nutze **Shared worlds** in der World map library, wenn mehrere Roleplay- oder Game-Chats dieselbe kanonische Hierarchie lesen sollen. Leg eine leere gemeinsame Welt an, importiere eine, stufe eine vorhandene Vorlage mit **Make shared** hoch oder öffne eine gespeicherte Chat-Karte und wähl dort **Make shared**. Die letzte Variante stuft die referenzierten Chat-Grafiken in die Global Gallery hoch, erstellt die kontoeigene Welt und verknüpft den ursprünglichen Chat wieder mit ihr.

Wähl **Link to chat**, um den Chat anzuhängen, den die Zielchat-Anzeige der Bibliothek nennt. Der aktuelle Ort und alle Orts-IDs, die der Kampagnenverlauf schon nutzt, müssen in der gemeinsamen Welt vorhanden sein. Andernfalls nimmst du **Independent copy** oder überführst die aktuelle Karte des Chats zuerst in eine neue gemeinsame Welt.

Verknüpfte Chats teilen sich nur die Kartendefinition und die Grafiken der Global Gallery. Nicht geteilt werden Nachrichten, aktuelle Orte, Reise-Snapshots, Spielzustand, Bindungen zur Game-Karte, Verbindungen zu Anbietern und Zugangsdaten.

Änderungen und Entdeckungen innerhalb eines verknüpften Chats landen als unveröffentlichter Entwurf bei diesem Chat. An der kanonischen Welt und an anderen Chats ändert sich nichts, bis du **Publish** wählst. Alternativ verwirfst du den Entwurf mit **Discard** oder beendest das Teilen mit **Detach and keep copy** und behältst die aktuelle Fassung des Chats. Ändert sich die kanonische Welt, während ein Entwurf offen ist, meldet Maps einen Konflikt. Dann ist ein Lösen oder Verwerfen nötig – stillschweigend überschrieben wird keine der beiden Fassungen.

Bearbeitest du eine gemeinsame Welt aus der Bibliothek heraus, ändert das die kanonische Definition direkt. Der Editor für gemeinsame Welten bietet kein endgültiges Löschen von Orten an; archiviere Orte stattdessen, damit ihre stabilen IDs verfügbar bleiben. Auch ein verknüpfter Chat kann keinen Ort endgültig löschen, solange du nicht **Detach and keep copy** wählst. Und eine gemeinsame Welt selbst lässt sich erst löschen, wenn alle verknüpften Chats gelöst oder neu verknüpft sind.

Gemeinsame Welten und Vorlagen behalten Grafikverweise auf die Global Gallery, ohne die Bilddatei in jeden Chat zu kopieren. Marinara blockiert das Löschen eines Bildes aus der Global Gallery, solange eine gespeicherte Vorlage, eine gemeinsame Welt, eine unabhängige Chat-Karte oder ein Entwurf in einem verknüpften Chat darauf verweist. Löse also zuerst die Grafikverweise, wenn du das Bild selbst löschen willst.

## Lösen, ersetzen oder neu anfangen

Diese Aktionen beantworten unterschiedliche Fragen:

- Willst du das Teilen beenden, aber die aktuelle Hierarchie des verknüpften Chats behalten, speicherst oder verwirfst du offene Änderungen im Editor und wählst dann **Detach and keep copy**. Der Chat wird eigenständig und bekommt keine kanonischen Updates mehr.
- Willst du weiter teilen, aber eine andere kanonische Welt nutzen, öffne die Weltbibliothek für den genannten Zielchat und wähl **Link to chat** beim Ersatz. Die Prüfungen auf Verlaufs-Kompatibilität gelten weiterhin.
- Willst du eine unabhängige Chat-Karte ersetzen, öffne ihren Editor und wähl **Replace / start over**. Vorher kannst du eine Vorlage speichern oder ein Backup exportieren; danach wählst du **Create with AI**, **Use template or shared world**, **Import map file** oder **Start blank**.
- Willst du einem Chat eine völlig andere Karte geben, nimm denselben Weg zum Ersetzen. Den Agenten zu entfernen und neu hinzuzufügen setzt die Karte nicht zurück.

Der Ersatz bleibt eine Arbeitskopie, bis du **Save** klickst. Speicherst du einen Ersatz, verfallen vorgemerkte Ziele und Routen. Sobald der Nachrichtenverlauf auf Orts-IDs verweist, lehnt Maps einen unpassenden Ersatz womöglich ab, um die historischen Breadcrumbs zu erhalten. Behalte in diesem Fall eine unabhängige Kopie und erweitere oder archiviere die vorhandene Karte.

## Den Karteneditor verstehen

Am Rechner zeigt der Editor drei Panels. Auf einem schmalen Bildschirm wechselst du zwischen den Tabs **Hierarchy**, **Local** und **Details**.

- **Hierarchy** zeigt den kompletten Baum. Wählst du dort einen Ort aus, bearbeitest du ihn. **Enter** wechselt nur den betrachteten Ausschnitt der Hierarchie; die Geschichte bewegt sich dadurch nicht.
- **Local** zeigt die direkt untergeordneten Orte des aktuellen Ortes – als Liste, als positionierte Karte oder als geordnete Ebenen.
- **Details** bearbeitet Ortstext, Hierarchie, Lore, Grafiken, Verknüpfungen, Status und Bindungen zur Game-Karte.

Die Kopfzeile des Editors enthält die Bedienelemente für den KI-Kartenbau, dazu **Templates**, **Export**, **Import**, den Schalter Enabled und **Save**. Ungespeicherte Änderungen sind mit **Unsaved** markiert. Verlässt du den Editor mit offener Arbeit, fragt Marinara, ob sie verworfen werden soll.

### Was ein Ort enthalten kann

Jeder Ort kann Folgendes haben:

- einen übergeordneten Ort und beliebig viele untergeordnete;
- einen Typ: Region, Settlement, Place, Building, Floor oder Room;
- einen Namen und ein Symbol;
- eine öffentliche Beschreibung und ein privates Modellgedächtnis;
- eine kurze Orientierungs-Zusammenfassung;
- Lorebook-Verknüpfungen für genau diesen Ort – ein Lorebook ist eine Sammlung von Weltwissen;
- Direktverknüpfungen zu anderen Orten, in eine oder in beide Richtungen;
- eine Darstellung der untergeordneten Orte als List, Map oder Layers;
- ein Referenzbild samt optionalem Schalter für die Bildnutzung;
- einen eigenen Hintergrund der Unterkarte, wenn die Darstellung Map genutzt wird; und
- den Status aktiv oder archiviert.

Bei der Darstellung **Map** ziehst du die untergeordneten Orte an ihre Position oder gibst genaue X- und Y-Werte von 0 bis 100 ein. Der gewählte übergeordnete Ort kann zusätzlich ein Galeriebild hinter seinen untergeordneten Orten zeigen. Bei **Layers** bekommt jeder untergeordnete Ort eine eigene Position in der Ebenen-Reihenfolge.

Direktverknüpfungen können beliebige gültige Orte der Hierarchie verbinden: eine Fähre zwischen zwei Städten, eine Treppe zwischen ausgewählten Stockwerken, ein Portal zwischen Welten oder einen Geheimgang zwischen Räumen in verschiedenen Gebäuden.

Ein Turm mit 25 Stockwerken sollte diese Stockwerke normalerweise als Geschwister unter einem Turm abbilden, nicht als 25 Stufen tiefe Kette übergeordneter Orte. Maps erlaubt bis zu 500 Orte und 20 Hierarchiestufen.

## Eine Karte mit KI entwerfen oder erweitern

Klick bei einer leeren Karte auf **Create with AI** oder **Draft with AI**. Bei einer bestehenden Karte klickst du auf **Expand with AI**.

### Festlegen, was der Builder liest

Wähl unter **Build from** eine dieser Quellen:

- **Game setup** nutzt die aktuelle Einrichtung und die Charaktere. In Game gehören der Weltüberblick und die Charaktere der Party dazu.
- **Selected lore** nutzt ausgewählte Lorebooks. **Strict canon** erzeugt nur Orte, die durch Lore gedeckt sind. **Canon + expansion** erlaubt passende Ergänzungen.

Der Builder liest den bisherigen Spielverlauf nicht mit. Ergänze alles, was in Einrichtung oder Lore fehlt, unter **What should this world include?** oder **What should be added?**

Wähl eine Größe:

| Größe | Ungefähres Ergebnis |
| --- | --- |
| **Small** | 8 Orte |
| **Medium** | 16 Orte |
| **Large** | 28 Orte |

Die Generierung erzeugt einen Entwurf, keine gespeicherte Karte. Durchsuche die vollständige Vorschau oder klapp sie auf, wähl Orte aus und prüf ihre Pfade, Beschreibungen, das private Modellgedächtnis und die Herkunft aus der Lore. Nutze **Edit prompt**, **Regenerate** oder **Discard draft**, bevor es weitergeht.

Klick auf **Continue to editor** für eine neue Karte oder auf **Add to working map** für eine Erweiterung. Sobald der Kampagnenverlauf auf Orts-IDs verweist, schützt Maps diese Verweise: Erlaubt ist dann nur noch das Erweitern, nicht der vollständige Austausch durch etwas Fremdes.

## Eine Karte von Hand bauen oder bearbeiten

Klick bei einer leeren Karte auf **Build manually**. Maps legt einen einzigen, groß gefassten Startort an. Wähl ihn in der Hierarchie aus und nutze dann:

- **Add child** für einen Ort innerhalb des gewählten Ortes;
- **Add sibling** für einen Ort daneben unter demselben übergeordneten Ort;
- **Duplicate**, um einen Teilbaum zu kopieren und anschließend zu bearbeiten; und
- **Archive**, um einen Ort stillzulegen, ohne historische Verweise zu löschen.

Leg den Anfangsort der Geschichte mit **Set as starting location** fest. Ohne aktiven Startort lässt sich eine Hierarchie nicht aktivieren. Schalte **Enabled** ein und klick auf **Save**, sobald alle vom Editor gemeldeten Probleme behoben sind.

## Verstehen, was beim Modell ankommt

Jede Generierung mit einer aktivierten, gespeicherten Karte erhält genau einen maßgeblichen Block mit Raumkontext. Darin stehen:

- der aktuelle Breadcrumb-Pfad;
- die genaue ID und die öffentliche Beschreibung des aktuellen Ortes;
- das private Modellgedächtnis genau dieses Ortes, falls vorhanden;
- die Ziele, die aktuell in einem Schritt erreichbar sind; und
- ein begrenzter Index der aktiven bekannten Orte samt ihrer genauen IDs.

Über den Index bekannter Orte kann die Antwort auch eine Ankunft an anderer Stelle der gespeicherten Welt erkennen. Ziele in der Nähe können außerdem in gewöhnliche Prosa oder in CYOA-Auswahlen einfließen.

Namen übergeordneter Orte geben Orientierung. Vererbt werden dagegen weder deren Beschreibungen noch deren privates Modellgedächtnis, deren Grafiken oder deren verknüpfte Lore. Steht der aktuelle Ort auf `Tower → Floor 7 → Alchemy Lab`, sind nur die Details des Labors aktiv; Turm und Stockwerk steuern lediglich ihre Namen zum Breadcrumb bei.

**Privates Modellgedächtnis** ist eine gespeicherte Notiz nur für die KI, kein Gedächtnis, das sich selbst fortschreibt. Nutze es für Geheimnisse, Atmosphäre, dauerhafte Gefahren, lokale Regeln oder Fakten, die nur an genau diesem Ort gelten sollen. Was das Modell unbedingt erreichen muss, gehört in die öffentliche Beschreibung oder ins private Modellgedächtnis – verlass dich nicht allein auf die Orientierungs-Zusammenfassung.

## Während der Geschichte reisen

Maps unterstützt vorgemerkte Reisen, geplante Routen und geprüfte Ankünfte, die du selbst anstößt. Die Bewegung wird zusammen mit dem Zug gespeichert; der Ort folgt damit dem ausgewählten Nachrichtenverlauf und dem ausgewählten Swipe – ein Swipe ist eine alternative Antwort. Ein Neustart von Marinara setzt den aktuellen Ort nicht absichtlich zurück. Wechselst du zu einer Verzweigung oder zu einem anderen Swipe, stellt Maps den Snapshot des Raumzustands wieder her, der zu diesem Verlauf gespeichert wurde.

### Ein Ziel ausdrücklich vormerken

Wählst du ein Ziel aus, wird die Bewegung nur vorgemerkt – sofort bewegt sich nichts. Übernommen wird sie mit der nächsten Nachricht, die du abschickst. So bleiben Ort und Zug im Gleichtakt.

In einem Schritt erreichbar sind:

- der übergeordnete Ort des aktuellen Ortes;
- die aktiven untergeordneten Orte des aktuellen Ortes; und
- Orte, die über eine verfügbare Direktverknüpfung verbunden sind.

Pro Zug lässt sich nur ein hierarchischer Schritt übernehmen. Über das X am vorgemerkten Ziel brichst du es ab. Ändert sich vor dem Absenden die Kartenrevision oder der aktuelle Ort, wechselt die vorgemerkte Bewegung auf **Needs review**.

### Eine Route über mehrere Züge planen

Wähl auf der Weltkarte einen weiter entfernten aktiven Ort. Gibt es im Graph aus über- und untergeordneten Orten und verfügbaren Verknüpfungen einen Weg, zeigt Maps die kürzeste Route und bietet **Plan route** an.

Eine Route merkt ihren ersten Schritt vor. Jeder weitere Zug, den du abschickst, übernimmt einen Schritt und merkt den nächsten vor, bis das Ziel erreicht ist; eine eigene Schaltfläche zum Weiterschalten gibt es nicht. Die Route lässt sich jederzeit abbrechen. Ändert sich die Karte oder der aktuelle Ort unerwartet, wechselt die Route auf **Needs review**, statt einen neuen Weg zu raten.

Ein Beispiel: Von Stockwerk 1 zum Geschwister-Stockwerk 25 braucht es normalerweise einen Zug hinaus in den Turm und einen zweiten hinein in Stockwerk 25. Eine Direktverknüpfung macht daraus einen einzigen Schritt.

### Nutzergeführte Reisen übernehmen und neue Orte entdecken

Für automatische Kartenänderungen ist deine letzte Nachricht maßgeblich:

- Bewegt sich die Party im Fokus direkt im Präsens oder im Imperativ, gilt die Ankunft als festgelegt. „Wir gehen in die Küche“ und „Sie geht nach draußen; wir folgen ihr“ können zu passenden bekannten Orten führen.
- Kommt die Party ausdrücklich an einem bedeutsamen, benannten, dauerhaften und wieder besuchbaren Ort an oder entdeckt ihn, kann Maps ihn zur Welt hinzufügen. „Wir entdecken einen verborgenen Raum“ kann diesen Ort anlegen und betreten.
- Die sichtbare Antwort darf die Folge erzählen. Eine KI-Erzählung allein rechtfertigt aber nie eine Bewegung oder einen neuen Ort.
- Absichten für später, gescheiterte oder abgebrochene Reisen, bloße Erwähnungen, Bewegungen reiner NPCs (Nicht-Spieler-Charaktere), vorgestellte Orte, Lager auf Zeit, Flure, Fahrzeuge und andere flüchtige Details erzeugen und bewegen keine Orte.

Trotzdem muss das Modell deine Formulierung deuten und einen verborgenen Maps-Befehl ausgeben, den die App anschließend prüft. Bei mehrdeutiger Prosa können sich Sprachmodelle unterschiedlich verhalten. Nimm **Set destination** für eine eindeutige Bewegung im nächsten Zug oder **Set current story location**, um bereits gespeicherten Zustand zu korrigieren.

Eine geprüfte, von dir angestoßene Ankunft darf die Ein-Schritt-Regel umgehen: Maps trägt dafür bei Bedarf eine verfügbare Direktverknüpfung vom aktuellen Ort ein. War bereits ein Ziel vorgemerkt, wird diese Bewegung zuerst mit deiner Nachricht gespeichert; die von dir angestoßene Ankunft wird dann zum endgültigen Ort an der KI-Antwort, und die einmalige Vormerkung ist erledigt. Auf einer geplanten Route rückt die Ankunft am nächsten geplanten Schritt normal vor. Eine Ankunft anderswo – auch ein Sprung zu einem späteren Routenschritt – setzt die Route auf **Needs review**, damit Maps den Plan nicht stillschweigend umschreibt. Brich die Route dann ab oder plane sie vom neuen aktuellen Ort aus neu.

### Startort im Vergleich zum aktuellen Story-Ort

Der **Startort** ist der Standard, wenn eine neue Geschichte beginnt. Der **aktuelle Story-Ort** ist der Ort, an dem genau dieser Chat gerade steht. Änderst du den Startort, repariert das nicht die aktuelle Position eines bestehenden Chats.

Zum Korrigieren des gespeicherten Zustands wählst du im Panel **Details** des Editors einen aktiven Ort aus und klickst auf **Set current story location**. Das ist eine administrative Korrektur, keine erzählte Reise. Wirksam wird sie beim Klick auf **Save**; sie löscht vorgemerktes Ziel oder Route und schreibt frühere Nachrichten nicht um.

### Reisen in Roleplay

Das Bedienelement **Story location** sitzt über dem Nachrichtenfeld.

1. Öffne die Story map, um Hierarchie und aktuellen Breadcrumb zu prüfen.
2. Wähl einen Ort aus, um seine Beschreibung zu lesen.
3. Nutze **Explore inside**, **Browse up** oder den Breadcrumb, um dich umzusehen, ohne dich zu bewegen.
4. Klick auf **Set destination** für einen erreichbaren Ort oder auf **Plan route** für ein erreichbares, weiter entferntes Ziel.
5. Schick die nächste Nachricht ab, um den vorgemerkten Schritt zu übernehmen.

### Reisen in Game

Game Mode ergänzt eine **Hierarchical world map**. **You are here** markiert den aktuellen Story-Ort. Umsehen, Zentrieren und Prüfen bewegen die Party nicht. Merk ein Ziel oder eine Route vor und schick dann den nächsten Game-Zug ab.

Legt deine letzte Nachricht die Ankunft der Party fest, darf die generierte Game-Antwort den verborgenen Befehl ausgeben, der den hierarchischen Ort aktualisiert. Die Details des aktuellen Ortes dienen dann dem GM – der KI, die das Spiel leitet –, der Party, der Szenengrafik und der infrage kommenden Storyboard-Referenz als Grundlage.

## Hierarchische Weltkarte im Vergleich zur gewöhnlichen Game-Karte

Game kann zwei Kartensysteme enthalten:

- **World Maps** liefert den maßgeblichen Story- oder Weltort, etwa `The Shattered Coast → Brinewatch → Tideglass Inn`.
- Eine gewöhnliche Game-Karte als Raster oder Knotenpunkt-Netz zeigt lokale oder taktische Details innerhalb dieses Story-Ortes und nimmt zusätzlich an Spielzeit und Wetter teil.

Übernimmt World Maps den Start eines Games, liefert die dort gewählte Vorlage oder der geprüfte Entwurf die Startwelt. Die gewöhnliche Game-Karte wird dann weder als Prompt-Eingabe wiederverwendet noch als Ersatzhierarchie hochgestuft.

Für fortgeschrittene Aufbauten lässt sich ein hierarchischer Ort an eine ganze Game-Karte, an eine einzelne Rasterzelle oder an einen einzelnen Knotenpunkt binden. Wählst du eine gebundene Game-Position aus, merkt das die passende hierarchische Bewegung vor; ungebundene Positionen verhalten sich taktisch wie gewohnt. Speichere die Hierarchie, bevor du Bindungen bearbeitest. Eine Bindung zu lösen löscht keine der beiden Karten.

## Orten ein eigenes Aussehen geben

Ortsreferenzen und Unterkarten-Hintergründe sind voneinander unabhängig, selbst wenn sie dasselbe Galeriebild nutzen.

| Grafik | Zweck | Geht an die Bildgenerierung? |
| --- | --- | --- |
| **Location reference image** | Verankert das Aussehen genau des aktuellen Ortes. Wähl eine Grafik aus dem Chat oder aus der gemeinsamen Global Gallery – oder erstelle sie mit KI. | Ja, wenn **Use for Roleplay illustrations and Game storyboards** aktiv ist und die Anfrage infrage kommt. |
| **Child map background** | Erscheint hinter den verschiebbaren untergeordneten Orten eines übergeordneten Ortes mit der Darstellung Map. Jede Kartenebene kann einen eigenen Hintergrund haben. | Nein. Er dient nur der Anzeige. |

Charakter- oder Persona-Referenzen halten fest, wer anwesend ist; die Ortsreferenz hält fest, wo die Szene spielt. Unterstützt der Anbieter beides zusammen, bleiben Charaktere und Hintergründe über mehrere Bilder hinweg stimmiger.

Liegt eine infrage kommende Ortsreferenz an, ergänzt die Bild-Pipeline diese Vorgabe:

> Location handling: an attached location reference image is available. Use it to set the scene location.

Anbieter haben eigene Grenzen für Referenzbilder. Ausdrückliche Referenzen in der Anfrage und Charakter-Referenzen können den Platz für automatische Referenzen verringern.

### Eine einzelne Ortsreferenz festlegen

Wähl im Editor einen Ort aus und öffne **Location reference image**.

- **Choose artwork** weist ein geprüftes Bild aus dem aktuellen Chat oder aus der gemeinsamen Global Gallery zu. Die Auswahl kennzeichnet jede Quelle.
- **Create with AI** öffnet einen bearbeitbaren Prompt für ein Establishing-Bild und speichert das Ergebnis in der Galerie, bevor du entscheidest, ob du es nutzt.
- **Use for Roleplay illustrations and Game storyboards** steuert, ob das gewählte Bild bei infrage kommenden Generierungen mitwirkt.

Für einen übergeordneten Ort mit der Darstellung Map öffnest du **Child map background** getrennt davon. Wähl ein Galeriebild und positioniere es hinter den Markern der untergeordneten Orte. Dieses Bild geht nie an einen Anbieter, nur weil es auf der Karte zu sehen ist.

### Fehlende Ortsgrafiken im Stapel generieren

Der Abschnitt **Location artwork** im Editor findet Orte ohne Referenzbild oder ohne Unterkarten-Hintergrund.

1. Klick auf **Review requests**.
2. Prüf die Anzahl der Anfragen, bevor du Anfragen beim Anbieter verbrauchst.
3. Kontrollier Bildverbindung, Modell, Engine-Stil, den Zustand von **Use campaign art style**, die gespeicherten Bildanweisungen und die Ausgabegröße.
4. Bearbeite bei Bedarf jeden positiven und negativen Prompt.
5. Brich die Prüfung ab oder klick auf **Generate N images**, um zu bestätigen.
6. Sieh dir die generierten Grafiken in der Arbeitskarte an und klick auf **Save**.

Jedes einzelne fehlende Bild ist eine eigene Anfrage beim Anbieter. Große Welten werden dadurch langsam oder teuer; deshalb bleibt die Prüfung scrollbar und zeigt die Anzahl der Anfragen dauerhaft an. Vorhandene Grafiken werden nach Möglichkeit ohne weitere Anfrage wiederverwendet. Ein neues Bild wird zur Ortsreferenz und zusätzlich zum Unterkarten-Hintergrund, falls diese Karte einen braucht.

An den Anbieter gehen genau die bearbeiteten positiven und negativen Prompts aus der Prüfung. Material aus dem positiven Prompt landet dabei nicht im negativen.

## Den automatischen Grafik-Prompt anpassen

Öffne **Settings → Generations → Prompt Overrides** und wähl **Maps location artwork**. Das ist die globale Vorlage für Vorschau und Generierung automatischer Ortsgrafiken. Variablen nutzen die Syntax `${variableName}` und lassen sich aus dem Editor heraus einfügen.

| Variable | Bedeutung |
| --- | --- |
| `${locationName}` | Name des Ortes |
| `${locationDescription}` | Öffentliche Beschreibung genau dieses Ortes |
| `${locationType}` | Region, Settlement, Place, Building, Floor oder Room |
| `${locationPrompt}` | Vollständiger Ersatz-Prompt für ein Establishing-Bild, von Maps vorbereitet |
| `${parentLocationName}` | Name des direkt übergeordneten Ortes, an der Wurzel leer |
| `${parentLocationDescription}` | Öffentliche Beschreibung des direkt übergeordneten Ortes, sonst leer |
| `${locationPath}` | Vollständiger Breadcrumb von der Wurzel bis zum Ort |
| `${genre}` / `${genreLine}` | Game-Genre roh oder mit Satzzeichen; außerhalb von Game leer |
| `${campaignArtStyle}` / `${campaignArtStyleLine}` | Kampagnenstil nur, wenn **Use campaign art style** an ist |
| `${imageInstructions}` / `${imageInstructionsLine}` | In den Chat Settings gespeicherte Bildanweisungen, roh oder formatiert |

Die eingebaute Vorlage nutzt den Prompt genau dieses Ortes und ergänzt optional Genre, Kampagnenstil und gespeicherte Bildanweisungen. Beschreibung des übergeordneten Ortes und vollständiger Pfad fehlen absichtlich. So drängt sich ein übergeordnetes Wahrzeichen – etwa ein Turm – nicht in jedes Bild eines untergeordneten Ortes oder Stockwerks.

Häufige Anpassungen:

- Entferne `${genreLine}`, wenn das Game-Genre nicht in automatischen Kartengrafiken auftauchen soll.
- Behalte `${campaignArtStyleLine}` nur, wenn der Schalter **Use campaign art style** pro Chat dieses Material steuern soll. Steht der Schalter aus, ist die Variable leer.
- Ergänze `${parentLocationName}`, `${parentLocationDescription}` oder `${locationPath}` nur, wenn der Anbieter diesen weiteren Kontext braucht.
- Mit **Reset to default** stellst du die eingebaute Vorlage wieder her.

Das Stilprofil der Engine sowie die globalen positiven und negativen Bild-Einstellungen greifen erst nach dieser Vorlage. Sie gehören zum gemeinsamen Illustrator- und Bild-Ablauf und sind keine Maps-eigenen Einstellungen. Bleibt unerwarteter Text im negativen Prompt stehen, sieh dir die globale negative Bild-Einstellung und das bearbeitbare Feld in der Prüfung an.

## Lore mit Orten verknüpfen

World Maps nutzt Lore auf zwei Arten:

1. Der KI-Builder darf beim Entwerfen oder Erweitern ausgewählte Lorebooks lesen.
2. Ein gespeicherter Ort kann Einträge aktivieren, solange genau dieser Ort aktuell ist.

Zum Anhängen von Lore zur Laufzeit wählst du den Ort aus, öffnest **Linked lore**, durchsuchst die verfügbaren Einträge, hängst die gewünschten an und speicherst.

Öffnest du einen verknüpften Lorebook-Eintrag, verlässt du den Karteneditor. Speichere die Karte vorher, wenn du andere offene Änderungen behalten willst – oder bestätige bewusst, dass sie verworfen werden dürfen. World Maps 1.3.1 warnt dich, bevor diese Aktion ungespeicherte Kartenänderungen verwerfen kann.

Verknüpfte Einträge werden nicht von oben nach unten vererbt. Lore, die an Brinewatch hängt, wird im Tideglass Inn nicht aktiv, solange sie nicht auch dort hängt.

Lore des aktuellen Ortes braucht keinen Schlüsselwort-Treffer, umgeht aber die Steuerung der Lorebooks nicht. Deaktivierte oder vom Chat ausgeschlossene Bücher und Einträge bleiben unerreichbar; Bedingungen, Timing, Wahrscheinlichkeit und Token-Budgets der Einträge gelten weiterhin. Fehlende Verweise bleiben im Editor sichtbar, damit du sie reparieren oder lösen kannst.

## Erweiterte Prompt-Einstellungen von Maps

Die Hauptseite **Agents → World Maps** verwaltet zwei globale Prompt-Systeme:

- **Generation prompt** ist eine benannte Bibliothek für Roleplay und Game, aus der KI-Kartenentwürfe und Erweiterungen schöpfen. Jeder Chat wählt seine Option unabhängig. Die aufgelöste Vorschau nutzt die aktuelle Einrichtung sowie Charakter-, Lore- und Kartenkontext, ohne dafür das Modell anzufragen.
- **Turn prompt insert** steuert den globalen Systemtext für Roleplay und Game, der den aktuellen Ort in gewöhnlichen Zügen vorstellt. Die Klammer `<spatial_context>` und die nötigen Autoritätsvariablen darum herum verwaltet Marinara selbst.

Die **Connection Override** auf derselben Seite wirkt auf KI-Kartenentwürfe und Erweiterungen. Lass sie leer, damit die Verbindung des aktuellen Chats greift. Diese Einstellungen ersetzen nicht die getrennte Überschreibung **Maps location artwork** unter den globalen Generation-Einstellungen.

Diese Bedienelemente richten sich an Fortgeschrittene. Erhalte die nötigen Variablen und schau dir vor dem Speichern die aufgelösten Vorschauen an.

## Sicher importieren, exportieren und archivieren

### Eine portable Karte exportieren

Nutze **Export** im Editor eines Chats, einer Vorlage oder einer gemeinsamen Welt, um die Arbeitshierarchie als `.world-map.json`-Datei herunterzuladen. Wähle vorher, wie viel verknüpfte Lore mitreisen soll:

| Lore-Option | Inhalt der Datei |
| --- | --- |
| **Map only** | Hierarchie und lesbare Zuordnung von Orten zu Lore, aber kein Lorebook-Inhalt. Fehlende Einträge lassen sich nicht wiederherstellen. |
| **Map + linked entries** | Nur von der Karte verknüpfte Einträge sowie die benötigten Ordnerpfade. Dies ist die empfohlene portable Option. |
| **Map + complete lorebooks** | Alle Einträge und Ordner jedes verknüpften Lorebooks, auch Material ohne Kartenbezug. |

Prüfe vor dem Teilen die aufgelisteten Lorebooks, die Eintragszahl, die geschätzte Größe und die ausklappbare Ortszuordnung. Vollständige Lorebooks können private oder unbeteiligte Notizen enthalten. Lass **Include map artwork** aktiv, damit referenzierte Ortsbilder und Unterkarten-Hintergründe in derselben Datei landen. Schalte es für ein kleineres Backup aus. Ältere `.hierarchical-map.json`-Dateien lassen sich weiterhin importieren.

### Eine Karte importieren und portable Lore wiederherstellen

Nutze **Import**, um eine Hierarchie in eine Chat-Arbeitskopie, eine unabhängige Vorlage oder eine gemeinsame Welt zu laden. Enthält die Datei Lorebook-Inhalte, zeigt **Restore portable map lore** die Gruppen **Exact IDs**, **Unique content**, **Need a choice** und **New entries**.

Eine genaue Eintrags-ID ist nur im Ziel-Lorebook verbindlich. Eine ID aus einer anderen Quelle ist mehrdeutig: Wähle die genaue Zeile `Lorebook → Entry (ID)` oder **Import a new copy**. Ohne ID verwendet World Maps einen Eintrag nur wieder, wenn dessen vollständiger portabler Inhalt und Einstellungen genau einen Treffer ergeben; der Name allein reicht nie.

Wähle nach der Vorschau eine Gesamtstrategie:

- **Import separate copies** verwendet keine Einträge wieder und erzeugt unabhängige Lorebooks wie `Original Lorebook - Map Name (World Map)`, mit **(copy)** oder **(copy N)** gegen Namenskollisionen.
- **Reuse matches & import the rest** behält genaue und eindeutige Treffer, übernimmt deine Auswahl bei mehrdeutigen Zeilen und erstellt nur für übrige Einträge neue Lorebooks.

Danach nennt Maps die konkret wiederverwendeten und erstellten Lorebooks. Erstellte Kopien bleiben in der Bibliothek, wenn die Karte später gelöscht wird. Engine **2.4.1** oder neuer aktualisiert die Lorebooks-Ansicht sofort; unter **2.3.5 bis 2.4.0** lade Marinara nach der Wiederherstellung einmal neu.

Mitgelieferte Grafiken werden ebenfalls wiederhergestellt und neu zugeordnet. Chat-eigene Grafiken landen in der Galerie des Zielchats; gemeinsame Grafiken werden aus der Global Gallery wiederverwendet oder dort einmal ergänzt. Prüf das Ergebnis und klick auf **Save**, damit es maßgeblich wird. Der Import speichert nicht sofort. Ein **Map only**-Export erhält lesbare Herkunft und vorhandene genaue ID-Verknüpfungen, kann gelöschte Lorebooks oder Einträge ohne deren Inhalt aber nicht wiederherstellen.

Sobald der Kampagnenverlauf auf eine Karte verweist, müssen importierte Änderungen die vorhandenen Orts-IDs beibehalten. Ergänze oder aktualisiere Orte, statt die Hierarchie durch fremde IDs zu ersetzen.

### Orte archivieren oder endgültig löschen

Archivieren erhält alte Verweise. Bevor du einen Ort archivierst:

- verschiebe oder archiviere seine aktiven untergeordneten Orte;
- wähl bei Bedarf einen anderen aktiven Startort; und
- wähl einen aktiven Ersatz, falls es der aktuelle Laufzeit-Ort ist.

Archivierte Orte lassen sich im Panel Details wiederherstellen. World Maps 1.3.1 bietet zusätzlich **Delete permanently** für einen archivierten Ort oder einen vollständig archivierten Zweig, sofern das gefahrlos möglich ist. Der Editor sperrt diese Aktion, wenn der Ort der gespeicherte Startort oder aktuelle Story-Ort ist, im Nachrichtenverlauf vorkommt, eine Bindung zur Game-Karte hat, an einem vorgemerkten Ziel oder einer Route beteiligt ist oder zu einem Chat gehört, der noch mit einer gemeinsamen Welt verknüpft ist. Die Editoren für gemeinsame Welten und Vorlagen bieten kein endgültiges Löschen von Orten an. Löse also zuerst die genannte Abhängigkeit, koppel bei Bedarf den verknüpften Chat ab oder lass den Ort einfach archiviert.

Endgültiges Löschen entfernt den Ort aus dem Arbeitsentwurf und räumt beim Klick auf **Save** seine Hierarchie- und Direktverknüpfungs-Verweise auf. Schließt du ohne zu speichern, verfällt auch die Löschung. Gelöschte Orte tauchen in Exporten nicht mehr auf; geschützte archivierte Orte werden weiterhin exportiert, damit ihre stabilen IDs Verlauf und verknüpfte Daten tragen können. Bearbeite die exportierte JSON-Datei nicht, um diese Schutzmechanismen zu umgehen.

## Fehlerbehebung

### World Maps fehlt in Chat Settings

Vergewissere dich, dass das Paket installiert ist und Marinara neu gestartet wurde. Der aktive Chat muss Roleplay oder Game sein. Aktiviere **Enable Agents** und danach **World Maps** unter **Tracker Agents**.

### Add to chat oder Link to chat fehlt in der Weltbibliothek

Öffne einen unterstützten Roleplay- oder Game-Chat, bevor du die Bibliothek öffnest. Die Bibliothek nennt den Zielchat und zeigt **Add to chat** für Vorlagen oder **Link to chat** für gemeinsame Welten. Während der Game-Einrichtung heißen die entsprechenden Aktionen **Use template** und **Use shared world**.

Listet die Bibliothek während der Game-Einrichtung zwar gemeinsame Welten, zeigt aber kein **Use shared world**, läuft im Browser womöglich noch ein älterer Paket-Client von vor dem Update. Speichere in jedem offenen Karteneditor die Karte oder verwirf den Entwurf bewusst, und schließ den Editor. Sichere danach unabhängige Arbeit, lade Marinara einmal per Hard Refresh neu und öffne die Game-Einrichtung erneut. Neuere Engine-Builds weisen ausdrücklich darauf hin, wenn ein Paket-Update dieses Neuladen braucht.

### Die Game-Einrichtung hat falsche oder Ersatz-Orte genutzt

Wähl **Use template** und bestätige dann entweder **Use template** für eine unabhängige Kopie oder **Use shared world** für eine kanonische Verknüpfung, bevor du die Game-Einrichtung abschließt. Prüf und speichere die Game-Karte. Eine Vorlage bleibt unverändert; ein verknüpftes Game hält seine Änderungen unveröffentlicht, bis du **Publish** wählst.

### Ein verknüpfter Chat zeigt noch eine ältere gemeinsame Welt

Saubere Editoren verknüpfter Chats, die in demselben Browser-Tab zwischengespeichert sind, in dem du veröffentlichst, aktualisieren sich automatisch. Ein Chat mit ungespeicherten oder unveröffentlichten Änderungen behält seinen Entwurf und zeigt stattdessen einen Konflikt. Öffne Chats in anderen Tabs oder Fenstern erneut, um die neue kanonische Version zu laden.

### Die Karte lässt sich nicht aktivieren

Leg mindestens einen aktiven Ort an und setz einen aktiven Startort. Behebe jedes Problem, das oben im Editor gemeldet wird, und aktiviere und speichere danach erneut.

### Die KI-Kartengenerierung ist nicht verfügbar

Achte darauf, dass der Chat oder die **Connection Override** von Maps eine funktionierende Verbindung zu einem Sprachmodell hat. Speichere oder verwirf offene Editor-Änderungen, bevor du den KI-Builder erneut öffnest. Für eine Erweiterung wählst du ein aktives Ziel. Für eine Lore-gestützte Generierung wählst du mindestens ein aktiviertes, nicht ausgeschlossenes Lorebook.

### Die KI-Kartengenerierung meldet unvollständiges oder fehlerhaftes JSON

Endete die Antwort vor einem vollständigen JSON-Dokument, erhöhe **Max Output Tokens** der Verbindung oder wähle eine kleinere Kartengröße und generiere erneut. World Maps verbraucht keine weitere Anfrage zur Reparatur unvollständiger Antworten.

Bei fehlerhaftem JSON wurde bereits eine reine Syntaxreparatur versucht. Generiere erneut; liefert dasselbe Modell wiederholt fehlerhafte Daten, verwende eine andere Verbindung oder ein anderes Modell. **Max Output Tokens** hilft nur beim unvollständigen Fall.

### Der aktuelle Ort ist einer Nachricht nicht gefolgt

Automatische Bewegung setzt zweierlei voraus: Deine letzte Nachricht muss die Ankunft der Party im Fokus direkt festlegen, und das Modell muss einen gültigen verborgenen Maps-Befehl erzeugen. KI-Erzählung allein, Absichten, Besprechungen, gescheiterte Reisen, Bewegungen reiner NPCs und flüchtige Orte verschieben die Markierung nicht. Versuch es mit einer klaren Formulierung wie „Wir gehen in die Küche.“ Nimm **Set destination** für eine eindeutige Bewegung im nächsten Zug.

### Der aktuelle Ort hat sich nach dem erneuten Öffnen des Chats geändert

Prüf, welche Verzweigung und welcher Swipe ausgewählt sind; der aktuelle Ort folgt dem Snapshot des Raumzustands, der zu diesem Verlauf gespeichert wurde. Stimmt der gewählte Verlauf, die Markierung aber nicht, öffne den Karteneditor, wähl den richtigen aktiven Ort, klick auf **Set current story location** und dann auf **Save**.

### Ein Ziel oder eine Route meldet Needs review

Nach dem Vormerken haben sich die Kartenrevision oder der aktuelle Ort geändert. Öffne die Story map, sieh dir den aktuellen Pfad an und wähl Ziel oder Route erneut. Ist das angezeigte Ziel noch vorgemerkt, brich es ab, bevor du es neu auswählst.

### Eine geplante Route rückt nicht vor

Jeder Zug von dir sollte den angezeigten nächsten Schritt übernehmen und den folgenden vormerken. Ein eigenes Bedienelement zum Weiterschalten gibt es nicht. Rückt die Route nach einem abgeschlossenen Zug nicht vor, brich sie ab und plane sie vom aktuellen Ort aus neu. Ist der gespeicherte Ort schon falsch, nimm **Set current story location** und **Save**; diese administrative Korrektur räumt die veraltete Route gleich mit weg.

### Dieser Chat soll eine völlig andere Karte nutzen

Öffne den Karteneditor und wähl **Replace / start over**. Sichere vorher bei Bedarf eine Vorlage oder einen Export, und erstelle, importiere, kopiere oder verknüpfe danach den Ersatz. Ist der Chat verknüpft und soll seine aktuelle Hierarchie behalten, nimm zuerst **Detach and keep copy**. World Maps zu entfernen und neu hinzuzufügen löscht seine Karte nicht.

### Ein weit entfernter Ort lässt sich nicht auswählen

Nutze **Plan route**, wenn es einen aktiven Weg über über- und untergeordnete Orte oder über Verknüpfungen gibt. Andernfalls ergänze eine verfügbare Direktverknüpfung oder reise Zug für Zug über erreichbare Orte. Die Bedienelemente zum Umsehen bewegen die Geschichte nie.

### Der automatische Grafik-Prompt enthält immer das Game-Genre

Öffne **Settings → Generations → Prompt Overrides → Maps location artwork** und entferne `${genreLine}` aus der Vorlage. Speichere die Überschreibung und öffne danach die Grafik-Prüfung erneut.

### Der Kampagnenstil taucht auf, obwohl er aus sein sollte

Prüf **Chat Settings → Illustrator → Use campaign art style**. Steht der Schalter aus, lösen sich `${campaignArtStyle}` und `${campaignArtStyleLine}` zu leerem Text auf. Die Zusammenfassung in der Prüfung sollte den Kampagnen-Bildstil als **Off** melden.

### Ein übergeordnetes Wahrzeichen taucht in jedem untergeordneten Bild auf

Vermeide `${parentLocationDescription}` und `${locationPath}` in der globalen Grafik-Vorlage, solange sie nicht wirklich nötig sind. Der Standard-Prompt für Orte bleibt auf genau diesen Ort beschränkt und lässt diese breiten Felder weg.

### Der negative Bild-Prompt enthält unerwartete Inhalte

Prüf und bearbeite das negative Feld vor dem Bestätigen. Sieh dir danach die gemeinsame globale negative Bild-Einstellung an. Die Grafik-Vorlage von Maps baut den positiven Prompt auf; kopiert wird er nicht ins negative Feld.

### Eine Ortsreferenz wird in Bildern oder Storyboards nicht genutzt

Vergewissere dich, dass das Galeriebild noch existiert und **Use for Roleplay illustrations and Game storyboards** an genau dem aktuellen Ort aktiv ist. Der Unterkarten-Hintergrund dient nur der Anzeige und ersetzt keine Referenz – es sei denn, dasselbe Galeriebild ist zusätzlich als Ortsreferenz zugewiesen.

### Das Modell ignoriert die Karte

Vergewissere dich, dass World Maps für den Chat aktiv ist, die Hierarchie auf **Enabled** steht, die letzten Änderungen gespeichert sind und im Bedienelement Story location ein aktueller Ort erscheint. Für eine genauere Diagnose hilft die aufgelöste Vorschau von **Turn prompt insert**.

### Verknüpfte Lore wird nicht aktiv

Vergewissere dich, dass der Eintrag an genau dem aktuellen Ort hängt. Prüf außerdem, ob Eintrag und Lorebook aktiviert sind und das Lorebook nicht vom Chat ausgeschlossen ist.

**Weitere Regeln in World Maps 1.3.1:** Geführte Generierung, Regenerierung und Fortsetzung erzeugen keinen neuen Nutzerzug und verbrauchen daher kein vorgemerktes Ziel oder Routensegment. **Impersonate** erzeugt eine Nutzernachricht: Ein erfolgreicher Zug übernimmt die Bewegung einmal, ein Providerfehler übernimmt nichts, und eine veraltete Bewegung wechselt zu **Needs review**.

Mit Marinara Engine **2.4.1** oder neuer werden vollständige Bewegungs- und Entdeckungsanweisungen von Maps aus gestreamtem Text und gespeicherten Nachrichten entfernt, ohne gewöhnliche Klammertexte oder Abstände zu verändern. Erscheint eine rohe Maps-Anweisung, aktualisiere Engine und World Maps, starte bei Aufforderung neu und regeneriere oder entferne die betroffene Nachricht.

Verwendet ein Galerie-Bild beide Grafikrollen, behält **Remove reference only** es als Unterkarten-Hintergrund; **Reject both and create replacement** ersetzt beide, und **Use for both** weist ein neues Bild beiden Rollen zu. Als fehlend gilt auch ein gespeicherter Galerie-Link, dessen Bild nicht mehr existiert. Ergebnisse einer laufenden Generierung füllen nur weiterhin fehlende Rollen und überschreiben keine inzwischen gewählte Grafik, Referenzoption, Hintergrundposition, Archivierung oder andere Entwurfsänderung.

**Open** bei verknüpfter Lore verlässt den Kartenarbeitsbereich und öffnet das Lorebook. Bei einem sauberen Entwurf schließt er direkt; bei ungespeicherten Änderungen musst du zuerst speichern oder das Verwerfen ausdrücklich bestätigen. Wird importierte Lore nicht aktiviert, prüfe die Importzusammenfassung: **Map only** enthält keine wiederherstellbaren Inhalte. Verwende **Map + linked entries** oder **Map + complete lorebooks** und wähle den vorgesehenen exakten Treffer, das mehrdeutige Ziel oder eine getrennte Kopie. Verknüpfte Lore eines übergeordneten Ortes wird nicht an untergeordnete Orte vererbt.

## Verwandte Anleitungen

- [Agenten: KI-Helfer für deine Chats](agents-overview.md)
- [Referenz der herunterladbaren Agenten](built-in-agents.md)
- [Lorebooks – Überblick](../lorebooks/overview.md)
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md)
- [Game Mode: Erste Schritte](../game/getting-started.md)
- [Game Mode: Karte, Zeit und Wetter](../game/map-time-weather.md)
