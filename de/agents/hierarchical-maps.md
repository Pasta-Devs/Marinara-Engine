# World Maps: Einrichtung, Erstellung und Reise

> **Aktuelle Kompatibilität:** Dieser Leitfaden entspricht World Maps **1.2.0** auf
> Marinara Engine **2.3.5**. Das Paket unterstützt Roleplay und Game-Chats.

World Maps fügt Roleplay und Game einen dauerhaften Weltzustand hinzu. Statt
Es behält einen Freitextort bei und stellt die Welt als verschachtelte Orte dar:

```text
The Shattered Coast
└── Brinewatch
    ├── Harbor District
    │   ├── Tideglass Inn
    │   └── Quest Hall
    └── Old Sewers
```

Marinara behält in dieser Hierarchie einen maßgeblichen aktuellen Platz. Der Strom
Breadcrumb, genaue Standortdetails, Ziele in der Nähe und geeignete Links
Überlieferungen können die nächste Reaktion begründen. Karten können auch einer abgeschlossenen Erzählung folgen
Reisen Sie zu einem bekannten Ort oder fügen Sie einen neu entdeckten Ort hinzu, wenn die Geschichte wahr ist
kommt dort an.

Jeder Chat erhält eine eigene Arbeitskopie einer Karte. Mit kontoweiten Vorlagen können Sie
Bereiten Sie einmal eine Original- oder Fandom-Welt vor und fügen Sie dann einer beliebigen Welt eine saubere Kopie hinzu
Roleplay oder Game-Chat.

## Funktionsübersicht

World Maps 1.2.0 bietet:

- verschachtelte Regionen, Siedlungen, Orte, Gebäude, Stockwerke und Räume;
- Brotkrümel und ein maßgeblicher aktueller Story-Standort;
- Listen-, positionierte Karten- und geordnete Ebenenansichten für untergeordnete Standorte;
- Eltern-Kind-Reisen, Direktverbindungen und Routenplanung mit mehreren Abzweigungen;
- validierte Bewegung aus abgeschlossener Erzählung und Entdeckung neuer Orte;
- Kontoweite Kartenvorlagen, die manuell, mit KI oder durch Import erstellt wurden;
- KI-gestützte Kartenentwürfe und -erweiterungen basierend auf dem Setup oder ausgewählten Überlieferungen;
- öffentliche Standortbeschreibungen, privater Modellspeicher und genaue Standortinformationen;
- ein optionales Gallery-Referenzbild für jeden Standort;
- ein separater Gallery-Hintergrund für jede positionierte untergeordnete Karte;
- Batch-Generierung für fehlende Standortgrafiken überprüft;
- eine globale, variablenbasierte Überschreibung der Eingabeaufforderung für Maps-Grafiken;
- Standortreferenzunterstützung für Roleplay-Illustrationen und Game Storyboards;
- Import, Export, Archivierung, geschichtsbewusste Bearbeitung und Spielkartenbindungen; und
- Globale Eingabeaufforderungsbibliotheken für die KI-Kartenerstellung und das Einfügen von Laufzeitstandorten.

Verfügbare Ziele sind im Modellkontext enthalten. Bei CYOA stehen Auswahlmöglichkeiten zur Verfügung
aktiviert, kann das Modell daher aktuelle Kinder oder verbundene Orte anbieten
die nächsten Optionen. Die genauen Auswahlmöglichkeiten bleiben modellgeneriert.

## Schnellstart

1. Öffnen Sie **Agents**, klicken Sie auf **Download Agents** und installieren Sie **World Maps**.
2. Starten Sie Marinara neu, wenn Sie dazu aufgefordert werden. Das Paket enthält Servercode.
3. Öffnen Sie einen Roleplay- oder Game-Chat.
4. Öffne **Agents → World Maps** und aktiviere das Paket für den aktuellen Chat. Du
   kannst es auch über den Abschnitt **Chat Settings → Agents** dieses Chats aktivieren.
5. Erstellen Sie die Karte mit **Use template**, **Create with AI** oder **Build
   manuell**. Bestehende Chats können auch eine Kartendatei importieren.
6. Überprüfen Sie die Arbeitshierarchie, wählen Sie einen Startort, aktivieren Sie die Karte,
   und klicken Sie auf **Save**.
7. Öffnen Sie beim Chatten die Datei **Story map**. Wählen Sie ein erreichbares Ziel und
   Senden Sie die nächste Abzweigung oder beschreiben Sie die Reise auf natürliche Weise und lassen Sie die Antwort aktualisieren
   der Ort, an dem die Ankunft abgeschlossen ist.
8. Ordnen Sie optional Gallery-Grafiken Standorten zu oder verwenden Sie **Location artwork**
   um die fehlenden Bilder zu überprüfen und zu generieren.

Das Anwenden einer Vorlage, eines KI-Entwurfs oder einer importierten Datei ändert nur die Änderungen des Herausgebers
Arbeitskopie. Es wirkt sich nicht auf Antworten aus, bis die Hierarchie aktiviert ist und
gespeichert.

## Installieren und aktivieren Sie das Paket

Öffne **Agents** über den Sparkles-Tab in der rechten Seitenleiste. Klicke auf
**Download Agents**, wähle **World Maps** aus und klicke auf **Install**. Wenn der
Katalog anschließend **Update** anbietet, installiere auch dieses. Folge der
Neustart-Aufforderung, bevor du das Paket verwendest.

Die Seite World Maps meldet die installierte Paketversion und -bereitschaft.
Bietet die kontoweite Vorlagenbibliothek und zeigt die Karte des aktuellen Chats an
Status. Durch die Installation des Pakets wird es verfügbar gemacht, aber nicht aktiviert
bei jedem Chat.

### Roleplay

1. Öffnen Sie den Roleplay-Chat.
2. Öffnen Sie **Chat Settings** mit der Zahnradtaste.
3. Schalten Sie **Enable Agents** ein.
4. Aktivieren Sie unter **Tracker Agents** **World Maps**.
5. Öffnen Sie **Edit world map** oder die Bibliothek **Map templates**.

Die Vorlagenbibliothek verhält sich gleich, unabhängig davon, ob sie von den Hauptagenten aus geöffnet wird
Seite oder in den Roleplay Chat-Einstellungen. Verwenden Sie **Add to chat**, um eine Vorlage hinein zu kopieren
der aktive Chat.

### Spiel

Wählen Sie während der Spieleinrichtung World Maps und dann eines seiner Setups aus
Routen:

- **Create with AI** bereitet eine generierte Hierarchie zur Überprüfung vor.
- **Use template** öffnet die Vorlagenauswahl, bevor das Spiel erstellt wird.
- **Build manually** beginnt mit einer bearbeitbaren leeren Hierarchie.

Wählen Sie nach der Auswahl von **Use template** eine bestimmte Vorlage aus und bestätigen Sie sie. Einrichtung
erstellt eine spieleigene Arbeitskopie zur Überprüfung; Das Konto wird nie bearbeitet
Vorlage. Die Speicherorte der ausgewählten Vorlage werden zum hierarchischen Ausgangspunkt
Welt. Eine reguläre Ersatzspielkarte wird nicht an ihre Stelle befördert.

Sie können World Maps auch später über **Chat zu einem bestehenden Spiel hinzufügen
Einstellungen → Agenten**.

## Kartenvorlagen erstellen und wiederverwenden

Öffnen Sie **Agents → World Maps → Open map templates**. Vorlagen gehören dazu
Ihr Konto und nicht ein einziger Chat, sodass sie für wiederverwendbares Fandom geeignet sind
Welten, Kampagneneinstellungen, Dungeons, Städte oder persönliche Starterkarten.

In der Bibliothek können Sie:

- manuell eine Vorlage erstellen;
- Verwenden Sie **Create with AI**, um es zu entwerfen;
- eine `.hierarchical-map.json`-Datei importieren;
- eine Vorlage suchen, anzeigen, bearbeiten, exportieren oder löschen;
- Verwenden Sie **Add to chat** in einem offenen Roleplay- oder Game-Chat; oder
- Wählen Sie **Use template** während der Spieleinrichtung.

Jede Anwendung erstellt eine unabhängige Arbeitskopie. Spätere Änderungen an der
Die Vorlage ändert keine Chats, die sie bereits kopiert haben, und Chat-Änderungen tun dies nicht
Ändern Sie die Vorlage.

Vorlagen kopieren keine Chat Gallery-Grafiken. Bild-IDs gehören zur Quelle
Der Chat lautet Gallery und wäre nicht portierbar. Fügen Sie die funktionierenden Chats hinzu oder generieren Sie sie
Standortreferenzen und Kartenhintergründe nach Anwendung der Vorlage.

## Den Karteneditor verstehen

Auf dem Desktop zeigt der Editor drei Bereiche an. Wechseln Sie auf einem schmalen Bildschirm zwischen
Registerkarten **Hierarchy**, **Local** und **Details**.

- **Hierarchy** zeigt den kompletten Baum. Wenn Sie einen Standort auswählen, wird dieser bearbeitet.
  **Enter** ändert den angezeigten Teil der Hierarchie; es bewegt sich nicht
  Geschichte.
- **Local** zeigt die unmittelbar untergeordneten Elemente des aktuellen Standorts als Liste an.
  positionierte Karte oder geordnete Ebenen.
- **Details** bearbeitet Standorttext, Hierarchie, Überlieferung, Grafik, Links, Status und
  Spielkartenbindungen.

Der Editor-Header enthält KI-Gebäudesteuerungen, **Templates**, **Export**,
**Import**, der aktivierte Schalter, und **Save**. Nicht gespeicherte Änderungen werden markiert
**Unsaved**. Wenn Sie mit nicht gespeicherter Arbeit gehen, werden Sie gefragt, ob Sie sie verwerfen möchten.

### Was ein Standort enthalten kann

Jeder Standort kann Folgendes haben:

- ein Elternteil und beliebig viele Kinder;
- eine Region, eine Siedlung, ein Ort, ein Gebäude, eine Etage oder ein Raumtyp;
- ein Name und ein Symbol;
- eine öffentliche Beschreibung und einen privaten Modellspeicher;
- eine kurze Zusammenfassung der Sensibilisierung;
- Links zu Lorebooks mit genauen Standorten;
- Direktverbindungen zu anderen Standorten in eine Richtung oder in beide Richtungen;
- eine untergeordnete Präsentation „Liste“, „Karte“ oder „Ebenen“;
- ein Standortreferenzbild und optionale Bildnutzungsumschaltung;
- ein separater untergeordneter Kartenhintergrund bei Verwendung der Kartendarstellung; und
- Aktiver oder archivierter Status.

Ziehen Sie für die **Map**-Präsentation die untergeordneten Elemente an ihre Position oder geben Sie genaue X- und Y-Werte ein
Positionen von 0 bis 100. Das ausgewählte übergeordnete Element kann auch ein Gallery-Bild haben
hinter seinen Kindern. Geben Sie für **Layers** jedem untergeordneten Element eine eindeutige Ebenenreihenfolge.

Direkte Links können alle gültigen Orte in der Hierarchie verbinden: eine Fähre dazwischen
Städte, Treppen zwischen ausgewählten Etagen, ein Portal zwischen Welten oder ein Geheimnis
Durchgang zwischen Räumen in verschiedenen Gebäuden.

Ein 25-stöckiger Turm sollte normalerweise die Etagen als Geschwister unter einem Turm modellieren.
nicht als 25-tiefe Elternkette. Karten ermöglichen bis zu 500 Standorte und 20 Hierarchien
Ebenen.

## Entwerfen oder erweitern Sie eine Karte mit KI

Klicken Sie in einer leeren Karte auf **Create with AI** oder **Draft with AI**. Für eine bestehende
Klicken Sie auf der Karte auf **Expand with AI**.

### Wählen Sie aus, was der Builder liest

Wählen Sie unter **Build from** eine dieser Quellen aus:

- **Game setup** verwendet das aktuelle Setup und die aktuellen Zeichen. Im Spiel umfasst dies auch
  der Weltüberblick und Partycharaktere.
- **Selected lore** verwendet ausgewählte Lorebooks. **Strict canon** erstellt nur
  Überlieferungsbasierte Orte. **Canon + expansion** ermöglicht passende Ergänzungen.

Der Builder liest den Turn-Verlauf nicht. Fügen Sie alles hinzu, was im Setup oder in der Überlieferung fehlt
zu **What should this world include?** oder **What should be added?**

Wählen Sie eine Größe:

| Größe | Ungefähres Ergebnis |
| ---------- | ------------------- |
| **Small** | 8 Plätze |
| **Medium** | 16 Plätze |
| **Large** | 28 Plätze |

Bei der Generierung wird ein Entwurf erstellt, keine gespeicherte Karte. Suchen oder erweitern Sie das Ganze
Sehen Sie sich eine Vorschau an, wählen Sie Standorte aus und überprüfen Sie deren Pfade, Beschreibungen und private Modelle
Erinnerung und Herkunft der Überlieferungen. Verwenden Sie **Edit prompt**, **Regenerate** oder **Verwerfen
Entwurf**, bevor Sie fortfahren.

Klicken Sie auf **Continue to editor** für eine neue Karte oder auf **Add to working map** für eine
Erweiterung. Nachdem sich der Kampagnenverlauf auf Standort-IDs bezieht, schützt Maps diese
Referenzen durch Ermöglichung einer Erweiterung anstelle eines unabhängigen Großhandelsersatzes.

## Erstellen oder bearbeiten Sie eine Karte manuell

Klicken Sie in einer leeren Karte auf **Build manually**. Maps schafft einen umfassenden Ansatz
Standort. Wählen Sie es in der Hierarchie aus und verwenden Sie dann:

- **Add child** für einen Ort innerhalb des ausgewählten Standorts;
- **Add sibling** für einen Platz daneben unter demselben Elternteil;
- **Duplicate**, um einen Standort-Teilbaum zu kopieren und ihn dann zu bearbeiten; und
- **Archive**, um einen Ort zurückzuziehen, ohne historische Bezüge zu löschen.

Legen Sie den Anfangsort der Geschichte mit **Set as starting location** fest. Eine Hierarchie
benötigt einen aktiven Startort, bevor es aktiviert werden kann. Aktivieren Sie **Enabled**
und klicken Sie auf **Save**, nachdem Sie alle vom Editor angezeigten Probleme behoben haben.

## Verstehen, was das Modell erreicht

Jede Generation mit aktivierter gespeicherter Karte erhält eine Autorität
Raumkontextblock mit:

– der aktuelle Breadcrumb-Pfad;
- die genaue aktuelle Standort-ID und öffentliche Beschreibung;
- der genaue private Modellspeicher des aktuellen Standorts, sofern vorhanden;
- Ziele, die derzeit in einem Zug erreichbar sind; und
– ein begrenzter Index aktiver bekannter Standorte und ihrer genauen IDs.

Mithilfe des Index bekannter Standorte kann die Antwort eine Ankunft an einem anderen Ort erkennen
die gerettete Welt. Nahe gelegene Ziele können auch gewöhnliche Prosa oder CYOA informieren
Entscheidungen.

Die Namen der Eltern geben Orientierung, die Beschreibungen der Eltern sind jedoch privat
Erinnerung, übergeordnetes Kunstwerk und mit dem übergeordneten Element verknüpfte Überlieferungen werden nicht vererbt. Wenn der Strom
Der Standort ist `Tower → Floor 7 → Alchemy Lab`, die Details des Labors sind aktiv, solange
Der Turm und das Stockwerk tragen nur ihre Namen zum Brotkrumen bei.

**Private model memory** ist eine gespeicherte reine KI-Notiz, kein selbstaktualisierender Speicher. Benutzen
es für Geheimnisse, Atmosphäre, anhaltende Gefahren, örtliche Regeln oder Fakten, die
sollte nur an genau dieser Stelle aktiv sein. Geben Sie Informationen ein, die die erreichen müssen
Modell in der öffentlichen Beschreibung oder im privaten Modellspeicher speichern, anstatt sich darauf zu verlassen
allein die Bekanntheitszusammenfassung.

## Bewegen Sie sich während einer Geschichte

Maps unterstützt explizite Reisen, geplante Routen und validierte Ankunftskommentare.
Die Bewegung wird mit der Drehung gespeichert, sodass der Standort der ausgewählten Nachricht folgt
Geschichte und Wischen.

### Stellen Sie ein explizites Ziel in die Warteschlange

Durch die Auswahl eines Ziels wird ein Umzug in die Warteschlange gestellt. es bewegt sich nicht sofort. Der Umzug
wird mit der nächsten von Ihnen gesendeten Nachricht festgeschrieben, wobei der Standort und die Eingabe beibehalten werden
synchronisieren.

One-Move-Ziele sind:

- das übergeordnete Element des aktuellen Standorts;
- aktive Kinder des aktuellen Standorts; und
- Standorte, die über einen verfügbaren Direktlink verbunden sind.

Mit einer Runde kann nur eine Hierarchiestufe begangen werden. Verwenden Sie das X auf dem
ausstehendes Ziel, um es abzubrechen. Ob die Kartenversion oder der aktuelle Standort
Änderungen vor dem Senden, der ausstehende Umzug wird zu **Needs review**.

### Planen Sie eine Route mit mehreren Abzweigungen

Wählen Sie einen entfernten aktiven Standort auf der Weltkarte aus. Wenn das Elternteil/Kind und
Das Diagramm „Verfügbare Links“ enthält einen Pfad, „Karten“ zeigt die kürzeste Route und Angebote an
**Plan route**.

Eine Route stellt ihren ersten Schritt in die Warteschlange. Bei jeder weiteren Runde wird ein Schritt ausgeführt und es kommt zu einer Warteschlange
die nächste, bis das Ziel erreicht ist. Sie können die Route jederzeit stornieren. Wenn die Karte
oder sich der aktuelle Standort unerwartet ändert, wird die Route zu **Needs review**
anstatt einen neuen Weg zu erraten.

Beispielsweise dauert die Reise von Etage 1 zur benachbarten Etage 25 normalerweise eine Runde
um zum Turm zu gehen, und ein weiterer, um die 25. Etage zu betreten. Eine direkte Verbindung kann hergestellt werden
diese Reise einen Schritt.

### Folgen Sie der erzählten Reise und entdecken Sie neue Orte

Das Modell erhält bewachte Anweisungen für die abgeschlossene Ankunft:

– Wenn die Antwort tatsächlich an einem bekannten aktiven Standort eintrifft, kann Maps verschoben werden
  den aktuellen Standort dort. Wenn die Geschichte eine neue Route enthüllt, zeichnet Maps eine auf
  direkt verfügbare Verbindung.
- Wenn die Antwort tatsächlich an einem unbekannten Ort eintrifft, kann Maps sie hinzufügen
  B. als untergeordneter oder verbundener Standort, dorthin verschieben und die Route zurück beibehalten.
- Absichten, Erwähnungen, gescheiterte oder nicht beendete Reisen, provisorische Lager, Flure,
  und Fahrzeuge erstellen keinen Standort und verschieben die Markierung nicht.

Wenn der Benutzer beispielsweise sagt: „Lass uns Quests aus der Questhalle holen“, a
Eine Antwort, die die Ankunft abschließt, kann den nächsten Story-Status auf „Quest“ verschieben
Halle. „Wir sollten später die Questhalle besuchen“ sollte den aktuellen Standort verlassen
unverändert.

Dieses Verhalten wird von der Anwendung validiert, das Modell muss dies jedoch noch tun
identifizieren, dass die Ankunft stattgefunden hat. Verwenden Sie **Set destination**, wenn Sie eine benötigen
deterministischer Zug.

### Roleplay Reisen

Das Steuerelement **Story location** wird über dem Meldungsfeld angezeigt.

1. Öffnen Sie die Story Map, um die Hierarchie und den aktuellen Breadcrumb zu überprüfen.
2. Wählen Sie einen Ort aus, um dessen Beschreibung zu lesen.
3. Verwenden Sie **Explore inside**, **Browse up** oder den Breadcrumb zum Durchsuchen ohne
   bewegen.
4. Klicken Sie auf **Set destination** für einen erreichbaren Ort oder auf **Plan route** für einen
   erreichbares entferntes Ziel.
5. Senden Sie die nächste Nachricht, um den in der Warteschlange befindlichen Schritt festzuschreiben.

### Spielreise

Game Mode fügt einen **Hierarchical world map** hinzu. **You are here** markiert den Strom
Ort der Geschichte. Durchsuchen, Zentrieren und Inspizieren bewegen die Partei nicht.
Stellen Sie ein Ziel oder eine Route in die Warteschlange und senden Sie dann die nächste Spielrunde.

Die generierte Spielantwort kann auch den hierarchischen Standort nach a aktualisieren
abgeschlossene erzählte Ankunft. Die aktuellen Standortdetails verbieten dann den GM, die Gruppe,
Szenenbild und geeignete Storyboard-Referenz.

## Hierarchische Weltkarte im Vergleich zur regulären Spielkarte

Das Spiel kann zwei Kartensysteme enthalten:

- **World Maps** ist die maßgebliche Geschichte oder der Weltstandort, z
  `The Shattered Coast → Brinewatch → Tideglass Inn`.
- Ein reguläres Spielraster oder eine Knotenkarte ist ein lokales oder taktisches Detail innerhalb dieser Geschichte
  Ort und nimmt auch an Spielzeit und Wetter teil.

Wenn World Maps das Spiel startet, wird die ausgewählte Vorlage ausgewählt oder überprüft
Draft liefert die Startwelt. Die reguläre Spielkarte wird nicht als Eingabeaufforderung wiederverwendet
eingegeben oder als Fallback-Hierarchie gefördert werden.

Bei erweiterten Setups kann ein hierarchischer Standort mit einer ganzen Spielkarte verknüpft werden
Gitterzelle oder ein Knoten. Die Auswahl einer gebundenen Spielposition führt zu den entsprechenden Schritten
hierarchischer Umzug; Ungebundene Positionen behalten ihr normales taktisches Verhalten bei. Speichern Sie die
Hierarchie vor dem Bearbeiten von Bindungen. Auch das Löschen einer Bindung führt nicht zum Löschen
Karte.

## Fügen Sie Standorten eine visuelle Identität hinzu

Standortverweise und untergeordnete Kartenhintergründe sind unabhängig voneinander, selbst wenn sie vorhanden sind
Verwenden Sie dasselbe Gallery-Bild erneut.

| Kunstwerk | Zweck | Zur Bildgenerierung gesendet?                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **Location reference image** | Verankert die visuelle Identität des genauen aktuellen Ortes. Wählen Sie aus Gallery oder erstellen Sie mit KI.                          | Ja, wenn **Use for Roleplay illustrations and Game storyboards** aktiviert ist und die Anfrage berechtigt ist. |
| **Child map background** | Erscheint hinter verschiebbaren untergeordneten Standorten für ein übergeordnetes Element, das die Kartendarstellung verwendet. Jede Kartenebene kann einen eigenen Hintergrund haben. | Nein. Es dient nur der Anzeige.                                                                                   |

Charakter- oder Persona-Referenzen bewahren, wer anwesend ist; die Standortreferenz
bewahrt den Ort, an dem die Szene stattfindet. Wenn vom Anbieter unterstützt, kombinieren
Sie tragen dazu bei, dass Charaktere und Hintergründe in allen Bildern konsistent bleiben.

Die Bildpipeline fügt diese Anweisung hinzu, wenn eine geeignete Standortreferenz vorhanden ist
beigefügt:

> Standortverwaltung: Ein angehängtes Standortreferenzbild ist verfügbar. Benutze es
> um den Ort der Szene festzulegen.

Anbieter haben ihre eigenen Referenzbildgrenzen. Explizite Anfragereferenzen
und Zeichenreferenzen können die Anzahl der automatischen Referenzen reduzieren.

### Legen Sie eine Standortreferenz fest

Wählen Sie im Editor einen Speicherort aus und öffnen Sie **Location reference image**.

- **Choose from Gallery** weist ein vorhandenes überprüftes Bild zu.
- **Create with AI** öffnet eine bearbeitbare Eingabeaufforderung zum Erstellen eines Bildes und speichert die
  Geben Sie das Ergebnis an Gallery weiter, bevor Sie entscheiden, ob Sie es verwenden möchten.
- **Use for Roleplay illustrations and Game storyboards** steuert, ob die
  Das ausgewählte Bild nimmt an der berechtigten Generierung teil.

Für ein übergeordnetes Element, das die Kartendarstellung verwendet, öffnen Sie **Child map background** separat.
Wählen Sie ein Gallery-Bild aus und positionieren Sie es hinter den untergeordneten Markierungen. Dieses Bild ist
wird niemals an einen Anbieter gesendet, nur weil es auf der Karte angezeigt wird.

### Fehlende Standortgrafiken in einem Stapel generieren

Der Abschnitt **Location artwork** des Herausgebers findet Orte, an denen Referenzen fehlen oder
Untergeordnete Kartenhintergründe.

1. Klicken Sie auf **Review requests**.
2. Überprüfen Sie die Anzahl der Anfragen, bevor Sie Anbieteranfragen ausgeben.
3. Bestätigen Sie die Bildverbindung, das Modell, den Engine-Stil, den Status des Kampagnenkunststils,
   gespeicherte Bildanweisungen und Ausgabegröße.
4. Bearbeiten Sie bei Bedarf jede positive und negative Eingabeaufforderung.
5. Brechen Sie die Überprüfung ab oder klicken Sie zur Bestätigung auf **Generate N images**.
6. Überprüfen Sie das generierte Bildmaterial in der Arbeitskarte und klicken Sie auf **Save**.

Jedes einzelne fehlende Bild ist eine separate Anbieteranfrage. Große Welten können sein
langsam oder teuer, sodass die Bewertung scrollbar bleibt und die Anzahl der Anfragen erhalten bleibt
sichtbar. Vorhandene Kunstwerke werden nach Möglichkeit ohne weitere Anfrage wiederverwendet. A
Das neue Bild wird zur Standortreferenz und auch zum Hintergrund der untergeordneten Karte
Diese Karte braucht eine.

Die genauen bearbeiteten positiven und negativen Eingabeaufforderungen, die in der Überprüfung angezeigt werden, werden an gesendet
Anbieter. Positives Eingabeaufforderungsmaterial wird nicht in die negative Eingabeaufforderung kopiert.

## Passen Sie die automatische Bildaufforderung an

Öffnen Sie **Settings → Generations → Prompt Overrides** und wählen Sie **Kartenstandort
Kunstwerk**. Dies ist die globale Vorlage, die bei der Vorschau und Generierung von Maps verwendet wird
automatische Standortdarstellung. Variablen verwenden die `${variableName}`-Syntax und können sein
aus dem Editor eingefügt.

| Variable | Bedeutung |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `${locationName}` | Standortname |
| `${locationDescription}` | Genaue öffentliche Beschreibung des Standorts |
| `${locationType}` | Region, Siedlung, Ort, Gebäude, Stockwerk oder Raum |
| `${locationPrompt}` | Vollständige Eingabeaufforderung für die Fallback-Einrichtung, vorbereitet von Maps |
| `${parentLocationName}` | Direkter übergeordneter Name oder leer im Stammverzeichnis |
| `${parentLocationDescription}` | Öffentliche Beschreibung des direkten übergeordneten Elements oder leer |
| `${locationPath}` | Vollständiger Root-to-Location-Breadcrumb |
| `${genre}` / `${genreLine}` | Rohes oder unterbrochenes Spielgenre; leer außerhalb des Spiels |
| `${campaignArtStyle}` / `${campaignArtStyleLine}` | Kampagnenstil nur, wenn **Use campaign art style** aktiviert ist |
| `${imageInstructions}` / `${imageInstructionsLine}` | Rohe oder formatierte Bildanweisungen, gespeichert in den Chat-Einstellungen |

Die integrierte Vorlage verwendet die genaue Standortaufforderung plus optionales Genre.
Kampagnenstil und gespeicherte Bildanweisungen. Es enthält absichtlich nicht
Standardmäßig die übergeordnete Beschreibung oder der vollständige Pfad, wodurch das Erzwingen eines übergeordneten Elements vermieden wird
Fügen Sie in jedes Kinder- oder Etagenbild ein Wahrzeichen wie einen Turm ein.

Häufige Anpassungen:

- Entfernen Sie `${genreLine}`, wenn das Spielgenre nicht in der automatischen Karte erscheinen soll
  Kunstwerk.
- Behalten Sie `${campaignArtStyleLine}` nur bei, wenn pro Chat **Use campaign art style** gilt
  Der Schalter sollte dieses Material steuern. Wenn der Schalter ausgeschaltet ist, ist die Variable aktiviert
  leer.
- Fügen Sie `${parentLocationName}`, `${parentLocationDescription}` oder hinzu
  `${locationPath}` nur, wenn der Anbieter diesen breiteren Kontext benötigt.
- Verwenden Sie **Reset to default**, um die integrierte Vorlage wiederherzustellen.

Das Engine-Stilprofil und die globalen positiven und negativen Bildeinstellungen sind
nach dieser Vorlage angewendet. Sie bleiben Teil des freigegebenen Illustrators/Bildes
Workflow statt Maps-spezifischer Einstellungen. Wenn unerwarteter Text in der bleibt
Negativ-Eingabeaufforderung, überprüfen Sie die globale Negativbildeinstellung und die bearbeitbaren
Überprüfungsfeld.

## Verknüpfen Sie Überlieferungen mit Orten

World Maps nutzt Überlieferungen auf zwei Arten:

1. Der KI-Builder kann beim Entwerfen oder Erweitern ausgewählte Lorebooks lesen.
2. Ein gespeicherter Standort kann Einträge aktivieren, solange dieser genaue Standort aktuell ist.

Um Laufzeitinformationen anzuhängen, wählen Sie den Speicherort aus, öffnen Sie **Linked lore** und suchen Sie nach
Verfügbare Einträge anzeigen, gewünschte Einträge anhängen und speichern.

Verknüpfte Einträge werden nicht vom übergeordneten Element zum untergeordneten Element übertragen. Überlieferungen zu Brinewatch
wird im Tideglass Inn nicht aktiviert, es sei denn, es ist auch dort angebracht.

Für Überlieferungen zum aktuellen Standort ist keine Schlüsselwortübereinstimmung erforderlich, diese wird jedoch nicht umgangen
Lorebook-Steuerelemente. Deaktivierte oder vom Chat ausgeschlossene Bücher und Einträge bleiben bestehen
nicht verfügbar und die Teilnahmebedingungen, der Zeitpunkt, die Wahrscheinlichkeit und die Token-Budgets sind noch vorhanden
bewerben. Fehlende Referenzen bleiben im Editor sichtbar, sodass sie repariert werden können
oder losgelöst.

## Einstellungen für erweiterte Kartenaufforderungen

Die Hauptseite **Agents → World Maps** verfügt über zwei globale Eingabeaufforderungssysteme:

- **Generation prompt** ist eine benannte Roleplay/Spielbibliothek für KI-Kartenentwürfe und
  Erweiterungen. Jeder Chat kann eine Option unabhängig auswählen. Das gelöst
  Die Vorschau verwendet Live-Setup, Charakter, Überlieferung und Kartenkontext, ohne eine zu erstellen
  Modellanfrage.
- **Turn prompt insert** steuert den globalen Systemtext Roleplay/Game
  Zeigt den aktuellen Standort während normaler Runden an. Marinara behält das
  Anwendungseigener `<spatial_context>`-Wrapper und erforderliche Berechtigung
  Variablen um ihn herum.

Der **Connection Override** auf derselben Seite wirkt sich auf KI-Kartenentwürfe und aus
Erweiterungen. Lassen Sie es leer, um die aktuelle Chat-Verbindung zu verwenden. Diese Einstellungen funktionieren
Ersetzt nicht die separate Überschreibung **Maps location artwork** unter global
Generierungseinstellungen.

Diese Steuerelemente sind für eine erweiterte Anpassung gedacht. Konservierung erforderlich
Variablen und verwenden Sie die aufgelösten Vorschauen vor dem Speichern.

## Sicher importieren, exportieren und archivieren

Verwenden Sie **Export**, um die Arbeitshierarchie als `.world-map.json`-Datei herunterzuladen.
Lassen Sie **Include map artwork** aktiviert, um referenzierte Standortbilder und zu bündeln
Untergeordnete Kartenhintergründe in derselben Datei. Deaktivieren Sie es, wenn Sie eine kleinere,
Nur-Definition-Backup. Ältere `.hierarchical-map.json`-Dateien bleiben weiterhin importierbar.

Verwenden Sie **Import**, um eine Hierarchie in die Arbeitskopie zu laden. Gebündelte Kunstwerke sind
Die Datei wird im Gallery des Ziel-Chats wiederhergestellt und die Bildlinks werden neu zugeordnet.
Überprüfen Sie das Ergebnis und klicken Sie auf **Save**, um es verbindlich zu machen. Beim Import geht das nicht
sofort speichern.

Sobald sich der Kampagnenverlauf auf eine Karte bezieht, müssen importierte Änderungen beibehalten werden
Standort-IDs. Fügen Sie Standorte hinzu oder aktualisieren Sie sie, anstatt die Hierarchie durch zu ersetzen
nicht verwandte IDs.

Durch die Archivierung bleiben alte Referenzen erhalten. Vor dem Archivieren eines Standorts:

- seine aktiven Kinder verschieben oder archivieren;
- Wählen Sie bei Bedarf einen anderen aktiven Startort; und
- Wählen Sie einen aktiven Ersatz, wenn es sich um den aktuellen Laufzeitstandort handelt.

Archivierte Standorte können im Detailbereich wiederhergestellt werden.

## Fehlerbehebung

### World Maps fehlt in den Chat-Einstellungen

Bestätigen Sie, dass das Paket installiert ist und Marinara neu gestartet wurde. Der Aktive
Chat muss Roleplay oder Game sein. Aktivieren Sie **Enable Agents** und aktivieren Sie es
**World Maps** unter **Tracker Agents**.

### „Zum Chat hinzufügen“ fehlt in der Vorlagenbibliothek

Öffnen Sie einen unterstützten Roleplay- oder Game-Chat, bevor Sie die Bibliothek öffnen. Die Bibliothek
Zeigt **Add to chat** entweder von der Hauptseite World Maps oder von diesem Chat an
Einstellungen. Während des Spielaufbaus lautet die entsprechende Aktion **Use template**.

### Beim Spiel-Setup wurden die falschen oder Ersatzorte verwendet

Wählen Sie **Use template**, wählen Sie im Picker eine konkrete Vorlage aus und bestätigen Sie
bevor Sie die Spieleinrichtung abschließen. Überprüfen Sie die spieleigene Arbeitskopie und speichern Sie sie
es. Die Kontovorlage bleibt unverändert.

### Die Karte kann nicht aktiviert werden

Erstellen Sie mindestens einen aktiven Standort und legen Sie einen aktiven Startstandort fest. Lösen
Alle oben im Editor angezeigten Ausgaben, dann aktivieren und erneut speichern.

### Die Generierung von KI-Karten ist nicht verfügbar

Stellen Sie sicher, dass der Chat oder Maps **Connection Override** über ein funktionierendes Sprachmodell verfügt
Verbindung. Speichern oder verwerfen Sie vorhandene Editoränderungen, bevor Sie die KI erneut öffnen
Baumeister. Wählen Sie für eine Erweiterung ein aktives Ziel. Für wissensbasierte
Generation, wählen Sie mindestens ein aktiviertes, nicht ausgeschlossenes Lorebook aus.

### Dem aktuellen Standort ist keine Nachricht gefolgt

Die automatische Bewegung erfordert, dass die generierte Reaktion eine Ankunft abschließt und
Erzeugen Sie eine gültige versteckte Maps-Direktive. Absicht, Diskussion, gescheiterte Reise und
Vorübergehende Orte verschieben die Markierung nicht. Verwenden Sie **Set destination** für a
deterministischer nächster Zug.

### Ein Ziel oder eine Route lautet „Überprüfung erforderlich“.

Die Kartenrevision oder der aktuelle Standort haben sich geändert, nachdem die Verschiebung in die Warteschlange gestellt wurde. Öffnen Sie die
Gehen Sie zur Story Map, überprüfen Sie den aktuellen Pfad und wählen Sie das Ziel oder die Route erneut aus.

### Ein entfernter Ort kann nicht ausgewählt werden

Verwenden Sie **Plan route**, wenn ein aktiver übergeordneter/untergeordneter/Link-Pfad vorhanden ist. Andernfalls fügen Sie eine hinzu
Verfügbare Direktverbindungen oder Reisen durch erreichbare Orte Zug für Zug.
Browsing-Steuerelemente verschieben die Story nie.

### Die automatische Bildaufforderung enthält immer das Spielgenre

Öffnen Sie **Settings → Generations → Prompt Overrides → Maps location artwork** und
Entfernen Sie `${genreLine}` aus der Vorlage. Speichern Sie die Überschreibung und öffnen Sie sie dann erneut
Kunstwerk-Rezension.

### Der Kampagnenstil wird angezeigt, obwohl er deaktiviert sein sollte

Überprüfen Sie **Chat Settings → Illustrator → Use campaign art style**. Mit diesem Schalter
aus, `${campaignArtStyle}` und `${campaignArtStyleLine}` lösen sich auf, um zu leeren. Die
In der Rezensionszusammenfassung sollte der Kampagnenkunststil als **Off** angegeben werden.

### In jedem untergeordneten Bild erscheint ein übergeordneter Orientierungspunkt

Vermeiden Sie `${parentLocationDescription}` und `${locationPath}` im globalen Bildmaterial
Vorlage, sofern sie nicht erforderlich sind. Die standardmäßige Standortaufforderung ist auf diesen Bereich beschränkt
den genauen Standort und lässt diese breiten Felder weg.

### Die negative Bildaufforderung enthält unerwartetes Material

Überprüfen und bearbeiten Sie das negative Feld, bevor Sie es bestätigen. Überprüfen Sie dann die Freigabe
globale negative Bildeinstellung. Die Maps-Grafikvorlage bildet das Positive
prompt; es wird nicht in das Negativfeld kopiert.

### Eine Standortreferenz wird in Bildern oder Storyboards nicht verwendet

Bestätigen Sie, dass das Bild Gallery noch vorhanden ist, und **verwenden Sie es für Roleplay
Illustrationen und Spiel-Storyboards** sind genau am aktuellen Standort aktiviert.
Der Hintergrund der untergeordneten Karte dient nur der Anzeige und kann keine Referenz ersetzen
es sei denn, das gleiche Gallery-Bild wird auch als Standortreferenz zugewiesen.

### Das Modell ignoriert die Karte

Bestätigen Sie, dass World Maps für den Chat aktiv ist, die Hierarchie ist es
**Enabled**, die letzten Änderungen wurden gespeichert und ein aktueller Standort erscheint in
die Story-Standortsteuerung. Verwenden Sie die aufgelöste Vorschau von **Turn prompt insert** für
fortgeschrittene Diagnose.

### Verknüpfte Überlieferungen werden nicht aktiviert

Bestätigen Sie, dass der Eintrag mit dem genauen aktuellen Standort verknüpft ist. Überprüfen Sie das
Der Eintrag und das Lorebook sind aktiviert und das Lorebook ist nicht von der ausgeschlossen
chatten.

## Verwandte Anleitungen

- [Agenten: KI-Helfer für Ihre Chats](agents-overview.md)
- [Herunterladbare Agentenreferenz](built-in-agents.md)
- [Lorebooks](../lorebooks/overview.md)
- [Roleplay-Modus: Erste Schritte](../roleplay/getting-started.md)
- [Game Mode: Erste Schritte](../game/getting-started.md)
- [Game Mode: Karte, Zeit und Wetter](../game/map-time-weather.md)
