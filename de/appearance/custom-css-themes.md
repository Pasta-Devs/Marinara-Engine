# Eigene CSS-Themes (Theme Library)

In dieser Anleitung erfährst du, wie du das gesamte Erscheinungsbild von Marinara Engine mit einem eigenen CSS-Theme umgestaltest. Du lernst, Themes anzulegen, zu importieren, zu exportieren und zu aktivieren. Außerdem siehst du, welche CSS-Variablen sich ändern lassen und wie Themes mit Card CSS zusammenspielen.

## Fertige Stile für Chat-Fenster

Für eine schnelle Änderung ohne eigenen CSS-Code öffne **Settings > Appearance > App** (Einstellungen, Darstellung, App) und such **Chat widget style** unten in **App Style**. **Dottore** gibt den Bedienelementen cyanfarbene Instrumentenrahmen und abgeschrägte Ecken. **Mari** ergänzt Rahmen in Rosa und Gold mit Primogems an den Fenstertiteln. Seine Schaltflächen nutzen denselben Hintergrund wie die Fenster. Jedes Preset hat eine eigene Schrift, passt zum hellen und dunklen Modus und gestaltet Schaltflächen, Fenster und aufklappbare Abschnitte gemeinsam.

Mit **Font** (Schrift) und **Shape** (Form) änderst du diese Details einzeln. **Preset font** (Preset-Schrift) und **Preset shape** (Preset-Form) folgen dem ausgewählten Stil.

Darunter stehen drei Farbeinstellungen. Jede bietet einen Farbwähler für eine einheitliche Farbe und einen Farbverlauf, der mehrere Farben ineinander übergehen lässt:

- **Border & Buttons Color** (Rahmen- und Schaltflächenfarbe) färbt Umrisse und Schaltflächensymbole. Symbole nutzen die erste Farbe eines Farbverlaufs.
- **Background Color** (Hintergrundfarbe) füllt Schaltflächen, Fenster, aufklappbare Abschnitte und Eingabefelder.
- **Text Color** (Textfarbe) färbt den Widget-Text. Farbverläufe erscheinen auf Überschriften und Beschriftungen; Text in Eingabefeldern nutzt die erste Farbe.

Die dekorativen Embleme behalten ihre ursprünglichen Farben.

Mit **Reset color** (Farbe zurücksetzen) neben einer Einstellung folgst du wieder den hellen oder dunklen Farben des Presets. Die Auswahl eines Presets setzt **Font**, **Shape** und alle drei Farben zurück. **Default** (Standard) stellt das ursprüngliche Aussehen wieder her. Deine Fensterpositionen bleiben erhalten.

Eigene CSS-Themes können diese Presets weiterhin überschreiben. Die öffentlichen Variablen für Fenster und Abschnitte weiter unten haben Vorrang vor den Preset-Farben. Nutze `--mari-window-font-family` für die Fensterschrift, `--mari-drawer-radius` für die Ecken der Abschnitte und `--mari-window-ornament: none`, um die Verzierung am Titel auszublenden. Um alle Preset-Verzierungen zu entfernen, wähle zuerst **Default**.


## Was ein eigenes Theme ist

Ein eigenes Theme ist ein Block CSS, der Marinara neu einfärbt. CSS steht für Cascading Style Sheets und ist der Code, der in der ganzen App Farben, Rahmen und Abstände festlegt. Ein Theme kann den Seitenhintergrund ändern, dazu die Akzentfarbe, Karten, Rahmen, Text und vieles mehr.

Eigene Themes liegen in der **Theme Library** (Theme-Bibliothek). Marinara speichert sie auf dem Server, deshalb erscheinen sie auf jedem Gerät und in jedem Browser, der sich mit demselben Server verbindet. Die meisten anderen Darstellungs-Einstellungen bleiben dagegen auf einem einzigen Gerät. Mehr dazu in der Anleitung [Darstellungs-Einstellungen](appearance-settings.md).

Aktiv sein kann immer nur ein eigenes Theme. In der Bibliothek dürfen beliebig viele liegen, und du wechselst jederzeit zwischen ihnen.

## Wo die Theme Library steckt

1. Öffne **Settings** (Einstellungen).
2. Öffne den Tab **Addons**.
3. Suche den Bereich **Theme Library**.

Der Bereich heißt **Theme Library** und trägt den Untertitel "Create, import, activate, edit, export, or remove custom CSS themes."

## Ein Theme anlegen

1. Klick im Bereich **Theme Library** auf **Create Theme** (Theme anlegen).
2. Gib im Feld **Theme name** (Theme-Name) einen Namen ein.
3. Schreib das CSS in das große Textfeld oder füge es dort ein.
4. Lass **Preview** (Vorschau) an, damit du die Änderungen beim Tippen sofort in der App siehst. Schalte **Preview** aus, um die Live-Vorschau zu beenden.
5. Klick auf **Save** (Speichern).

Ein neues Theme startet mit einer Vorlage. Darin stehen gängige Variablen als auskommentierte Beispiele: Entferne die Kommentarzeichen und trag eigene Werte ein. Speicherst du ein brandneues Theme, aktiviert Marinara es sofort. Dazu kommt eine Bestätigung mit dem Theme-Namen, etwa: Theme "My Theme" saved and activated.

Später änderst du ein Theme über die Liste **Installed Themes** (installierte Themes). Klick dort auf das Code-Symbol – sein Tooltip lautet **Edit theme CSS**, also ein Kurzhinweis beim Draufzeigen –, bearbeite das CSS und klick auf **Save**. Beim Bearbeiten eines gespeicherten Themes ändert sich nur dessen Inhalt, nicht das aktive Theme.

## Themes importieren und exportieren

Themes lassen sich als Datei weitergeben. Praktisch, um ein Theme auf einen anderen Server zu holen oder einer Freundin zu schicken.

So importierst du ein Theme:

1. Klick im Bereich **Theme Library** auf **Import File** (Datei importieren).
2. Wähle eine `.css`- oder eine `.json`-Datei.
3. Lies die Toast-Meldung. Sie nennt, wie viele Themes importiert, übersprungen oder abgelehnt wurden.

Aus einer `.css`-Datei wird ein Theme, benannt nach der Datei. Eine `.json`-Datei kann ein oder mehrere Themes enthalten, und es gibt zwei Sorten davon.

Die erste Sorte stammt aus einem Export von Marinara. Jedes Theme steckt dort in zusätzlichen Feldern, die Marinara beim Export ergänzt. Du musst die Datei weder lesen noch bearbeiten. Importiere sie einfach unverändert.

Die zweite Sorte ist eine kleine Datei, die du selbst schreibst. Für ein einzelnes Theme reicht das hier:

```
{ "name": "My Theme", "css": "..." }
```

Importierte Themes landen ebenfalls auf dem Server, aktivieren sich aber nicht von selbst. Existiert auf dem Server bereits ein Theme mit demselben Namen und demselben CSS, überspringt Marinara es, statt es doppelt anzulegen.

Zum Exportieren suchst du das Theme in der Liste **Installed Themes** und klickst auf das Upload-Symbol (Tooltip: **Export theme**). Marinara lädt eine `.json`-Datei herunter, die du anderswo importieren kannst.

## Ein Theme aktivieren

Die Liste **Installed Themes** zeigt alle Themes und ganz oben zusätzlich den Eintrag **Default Theme** (Standard-Theme).

1. Klick auf den Namen eines Themes, um es zu aktivieren. Ein Häkchen markiert das aktive Theme.
2. Klick auf **Default Theme**, um eigene Themes abzuschalten und zum eingebauten Marinara-Look zurückzukehren.

Die Schaltfläche **Reset Appearance** (Darstellung zurücksetzen) sitzt oben im Bereich **App Style** unter **Settings -> Appearance**. Sie schaltet auch das aktive eigene Theme ab.

Willst du ein Theme endgültig loswerden, klick in seiner Zeile auf das Papierkorb-Symbol (Tooltip: **Remove theme**) und bestätige im Fenster **Delete Theme**. Damit löscht Marinara das CSS dauerhaft vom Server.

## Die CSS-Variablen-Referenz

Im Theme-Editor gibt es eine ausklappbare **CSS Variable Reference** (CSS-Variablen-Referenz). Ein Klick darauf zeigt die nützlichsten Variablen, die sich überschreiben lassen. Ein Theme verändert die App, indem es diese Variablen in einem `:root`-Block setzt. Die Referenz listet folgende Variablen:

| Variable | Wirkung |
| --- | --- |
| `--background` | Seitenhintergrund |
| `--foreground` | Haupttext |
| `--primary` | Akzent und Schaltflächen |
| `--primary-foreground` | Text auf Primärfarbe |
| `--secondary` | Karten und Eingabefelder |
| `--card` | Kartenhintergrund |
| `--border` | Rahmen |
| `--muted-foreground` | Gedimmter Text |
| `--sidebar` | Hintergrund der Seitenleiste |
| `--sidebar-border` | Rahmen der Seitenleiste |
| `--marinara-shell-edge-border` | Linker und rechter Rand der Hülle |
| `--destructive` | Fehler und Löschen |
| `--popover` | Hintergrund des Dropdown-Menüs |
| `--accent` | Hervorhebung beim Draufzeigen |

Auf diese Liste bist du nicht festgelegt. Ein Theme kann jede CSS-Variable setzen, die Marinara verwendet, und darüber hinaus eigene Stile ergänzen.

Manche visuellen Effekte haben eigene Variablen. Die pulsierende Akzent-Animation etwa fordert ein Theme mit `--marinara-theme-accent-pulse: enabled` an.

Aus Sicherheitsgründen bereinigt Marinara das CSS eigener Themes, bevor es wirkt. Stile, die eine Datei von einer fremden Website nachladen, funktionieren nicht. Bilder oder Schriften bindest du deshalb als `data:`-URI ein statt als Web-Link. Eine `data:`-URI trägt den Dateiinhalt direkt im CSS.

## Chat-Fenster und aufklappbare Abschnitte gestalten

Am Computer öffnet sich **Chat Settings** als verschiebbares Fenster. Seine aufklappbaren Abschnitte heißen **drawers**. Ein Abschnitt lässt sich in ein eigenes Fenster herauslösen und anschließend zu einer kleinen verschiebbaren Schaltfläche minimieren, einer **bubble**.

Auch andere Chat-Tools nutzen diese Fenster und Schaltflächen: Game controls, Session, Volume, Game Assets, verknüpfte Chats und Paket-Bedienelemente. Am Telefon öffnen sich Fenster als Panels über die ganze Breite; das Tracker Panel hat eine eigene verschiebbare Schaltfläche.

Mit den folgenden Klassen, Datenattributen und Variablen gestaltet ein Theme diese Teile gemeinsam. Deine Theme-Regeln überschreiben die Standardwerte ohne `!important`.

### Klassen

| Teil | Klasse |
| --- | --- |
| Fenster | `.mari-window` |
| Titelleiste | `.mari-window__header` |
| Titel und sein Symbol | `.mari-window__title-row` |
| Titel | `.mari-window__title` |
| Schaltflächen der Titelleiste (Reset View, Favoritenstern, Tracker Panel, Minimieren, Anheften, Sperren, Schließen, Put back) | `.mari-window__controls` (jede Schaltfläche hat `.mari-window__control`) |
| Fensterinhalt | `.mari-window__body` |
| Kanten und Ecken zur Größenänderung | `.mari-window__resize-handle` |
| Eckmarkierung, wenn Mauszeiger oder Tastaturfokus im Fenster liegen | `.mari-window__resize-grip` |
| Aufklappbarer Abschnitt | `.mari-drawer` |
| Kopfzeile und Titel des Abschnitts | `.mari-drawer__header`, `.mari-drawer__title` |
| Symbol, Anzahl und **?** des Abschnitts | `.mari-drawer__icon`, `.mari-drawer__count`, `.mari-drawer__help` |
| Vorschau eines zugeklappten Abschnitts (das kleine Tracker-Widget) | `.mari-drawer__summary` |
| Schaltflächen neben dem Pfeil und zum Herauslösen | `.mari-drawer__actions`, `.mari-drawer__popout` |
| Pfeil und Inhalt des Abschnitts | `.mari-drawer__arrow`, `.mari-drawer__body` |
| Vorschau, die beim Herausziehen eines Abschnitts dem Mauszeiger folgt | `.mari-drawer-ghost` |
| Schaltfläche eines minimierten Fensters (bubble) | `.mari-window-bubble` |
| Hilfslinie beim Ausrichten einer gezogenen Schaltfläche an einer anderen | `.mari-window-snap-guide` |
| Punkt während der Arbeit von Agenten (Chat-Settings-Schaltfläche, Trackers-Fenster) | `.mari-agents-running-dot` |

### Datenattribute

- `data-window` benennt ein Fenster und seine Schaltfläche: `chat-settings`, `trackers`, die Steuerungsfenster `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` und `control:beholder:<package>` sowie `drawer:<window>:<drawer>` für einen herausgelösten Abschnitt, etwa `drawer:chat-settings:chat-name`.
- `data-drawer` benennt einen Abschnitt, etwa `chat-name`. Einige Namen beginnen mit dem Chat-Modus, zum Beispiel `roleplay-agents` oder `conversation-agents`. Tracker nutzen `tracker-world`, `tracker-persona`, `tracker-characters`, `tracker-quests`, `tracker-inventory`, `tracker-custom` und `agent-activity`.
- `data-presentation` ist bei einem Computerfenster `"window"` und bei einem Telefon-Panel `"sheet"`.
- `data-pinned` und `data-locked` sind `"true"`, solange das Fenster angeheftet oder gesperrt ist.
- `data-window-control` benennt jede Schaltfläche der Titelleiste: `"minimize"`, `"pin"`, `"lock"`, `"close"` oder `"put-back"`. Eine aktivierte Anheft- oder Sperrschaltfläche hat außerdem `aria-pressed="true"`.
- `data-chat-settings-control` kennzeichnet die zusätzlichen Schaltflächen in der Titelleiste von Chat Settings: `"reset-view"`, `"favorite-layout"` und `"tracker-panel"`. Der Favoritenstern hat `aria-pressed="true"` und ein ausgefülltes Symbol, wenn die aktuelle Anordnung zum gespeicherten Favoriten passt.
- `data-edge` ist an den jeweiligen Größenänderungsgriffen `"n"`, `"s"`, `"e"`, `"w"`, `"ne"`, `"nw"`, `"se"` oder `"sw"`.
- Die Schaltfläche eines offenen Abschnitts innerhalb von `.mari-drawer__header` hat `aria-expanded="true"`.
- `data-drawer-control="pop-out"` kennzeichnet die Schaltfläche zum Herauslösen eines Abschnitts.
- `data-outside="true"` kennzeichnet eine Ziehvorschau, die weit genug außerhalb ihres Fensters liegt, um beim Loslassen herausgelöst zu werden.
- `data-axis` ist `"x"` bei einer senkrechten Ausrichtungslinie und `"y"` bei einer waagerechten.
- `data-detached` ist `"true"`, wenn ein Abschnitt in einem eigenen Fenster erscheint, sowohl am Fenster als auch am Abschnitt darin. Das Fenster eines herausgelösten Abschnitts heißt `data-window="drawer:<window>:<drawer>"`, etwa `data-window="drawer:chat-settings:chat-name"`; `data-drawer-host` benennt sein Ursprungsfenster.
- `data-dragging` ist am Abschnitt `"true"`, während du seinen Titel ziehst. `data-drop-target` ist an einem Fenster `"true"`, während du einen herausgelösten Abschnitt darüber hältst, um ihn zurückzulegen.
- Eine Fensterschaltfläche trägt das `data-window` ihres Fensters und `data-minimized="true"`, etwa `.mari-window-bubble[data-window="control:volume"]`. Steuerungsfenster heißen `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` und `control:beholder:<package>`. Während du die Schaltfläche ziehst, ist ihr `data-dragging` gleich `"true"`.
- Eine gesperrte Fensterschaltfläche hat `data-locked="true"`, auch die Chat-Settings-Schaltfläche. Sie öffnet weiterhin das Fenster, lässt sich aber erst nach dem Entsperren bewegen. Mit `.mari-window-bubble[data-locked="true"]` kannst du diese Schaltflächen anders gestalten.
- Am Telefon haben Fenster und ihre etwas größeren Schaltflächen `data-presentation="sheet"`. Die Schaltfläche des Tracker Panel ist `.mari-window-bubble[data-tracker-panel-toggle="bubble"]`.
- Auch die Chat-Settings-Schaltfläche ist eine bubble: `.mari-window-bubble[data-chat-settings-button]`. Solange Chat Settings offen ist, hat sie `data-open="true"`.
- Ein herausgelöster Abschnitt verkleinert sich zu einer Schaltfläche mit `data-drawer-host` (dem Ursprungsfenster). Die **Put back**-Schaltfläche seines Fensters ist `[data-window-control="put-back"]`.

### Variablen

Jede Variable fällt auf die gemeinsamen Farben der Chat-Bedienelemente zurück. Ein Theme muss deshalb nur die Werte festlegen, die es ändern soll.

| Variable | Was sie steuert |
| --- | --- |
| `--mari-window-bg` | Fensterhintergrund |
| `--mari-window-text` | Fenstertext |
| `--mari-window-border`, `--mari-window-border-width` | Fensterrahmen |
| `--mari-window-radius` | Rundung der Fensterecken |
| `--mari-window-shadow` | Fensterschatten |
| `--mari-window-backdrop-filter` | Unschärfe hinter dem Fenster |
| `--mari-window-header-bg`, `--mari-window-header-text`, `--mari-window-header-border` | Farben der Titelleiste |
| `--mari-window-header-padding` | Innenabstände der Titelleiste |
| `--mari-window-control-color`, `--mari-window-control-color-hover`, `--mari-window-control-bg-hover` | Schaltflächen der Titelleiste, einschließlich Favoritenstern |
| `--mari-window-control-color-active`, `--mari-window-control-bg-active` | Aktivierte Titelleisten-Schaltflächen, einschließlich Anheften, Sperren und ausgefülltem Favoritenstern |
| `--mari-window-control-radius`, `--mari-window-control-gap` | Rundung und Abstand der Schaltflächen |
| `--mari-window-focus-ring` | Umriss für den Tastaturfokus und für das Fenster, in das ein Abschnitt zurückgelegt wird |
| `--mari-window-resize-handle-size` | Breite der Kanten zur Größenänderung |
| `--mari-window-bubble-size`, `--mari-window-bubble-radius`, `--mari-window-bubble-shadow` | Größe, Rundung und Schatten der Fensterschaltfläche |
| `--mari-window-bubble-bg`, `--mari-window-bubble-bg-hover`, `--mari-window-bubble-border` | Hintergrund und Rahmen der Fensterschaltfläche |
| `--mari-window-bubble-text`, `--mari-window-bubble-text-hover` | Symbolfarbe der Fensterschaltfläche |
| `--mari-window-snap-guide` | Farbe der Ausrichtungslinie |
| `--mari-drawer-bg`, `--mari-drawer-border` | Hintergrund und Trennlinie des Abschnitts |
| `--mari-drawer-header-bg`, `--mari-drawer-header-bg-hover` | Farben der Abschnittskopfzeile |
| `--mari-drawer-header-padding`, `--mari-drawer-body-padding-inline`, `--mari-drawer-body-padding-bottom` | Abstände im Abschnitt |
| `--mari-drawer-title-color`, `--mari-drawer-icon-color`, `--mari-drawer-arrow-color` | Text und Symbole der Abschnittskopfzeile |
| `--mari-drawer-count-bg`, `--mari-drawer-count-text` | Anzahl-Markierung am Abschnitt |

Setze eine Variable in `:root`, um alle Fenster zu ändern, oder an einem Selektor für ein einzelnes Fenster:

```css
:root {
  --mari-window-radius: 0.5rem;
  --mari-window-bubble-bg: #3b0764;
}

[data-window="chat-settings"] .mari-drawer[data-drawer="chat-name"] {
  --mari-drawer-border: transparent;
}
```

## Grenzen für Größe und Name

Ein Theme-Name darf bis zu 200 Zeichen lang sein. Das CSS selbst darf bis zu 256 KiB umfassen, gemessen in UTF-8-Bytes statt in Zeichen. Größere Themes lehnt Marinara beim Speichern oder Importieren ab.

## Admin Access bei Zugriff aus der Ferne

Themes anlegen, bearbeiten, importieren, aktivieren und entfernen sind geschützte Aktionen. Relevant wird das nur, wenn du Marinara über ein Netzwerk öffnest.

Öffnest du Marinara auf demselben Rechner, auf dem der Server läuft, also über Loopback (auch localhost genannt), klappen diese Aktionen ohne Weiteres. Rufst du Marinara von einem anderen Gerät auf – vom Handy etwa oder von einem anderen Rechner im Netzwerk –, braucht der Server zuerst ein Admin-Secret.

So verwaltest du Themes über das Netzwerk:

1. Setze auf dem Server `ADMIN_SECRET` in der Datei `.env`.
2. Öffne in der App **Settings -> Advanced -> Admin Access** und trag denselben Wert ein.

Ohne das schlagen Theme-Änderungen über das Netzwerk fehl. Die komplette Einrichtung beschreiben die [Server-Konfigurationsreferenz](../CONFIGURATION.md) und die [Anleitung zum Fernzugriff](../REMOTE_ACCESS.md).

## Wie Themes und Card CSS zusammenspielen

Marinara kennt zwei Wege, eigenes CSS einzubringen. Es sind getrennte Funktionen, und beide dürfen gleichzeitig aktiv sein.

Ein eigenes Theme färbt die ganze App neu. Es darf Marinaras Kernvariablen überschreiben, `!important` verwenden und `position: fixed` setzen. Genau dafür ist ein Theme da.

Card CSS funktioniert anders. Wer eine Charakterkarte oder eine Persona erstellt, kann CSS darin einbetten, und du schaltest es pro Chat frei. Card CSS bereinigt Marinara strenger: Kernvariablen der App bleiben unangetastet, `!important` fliegt raus, und aus `position: fixed` wird `position: absolute`. Es gestaltet die Nachrichten im Chat, nicht die ganze App. Siehe die [Anleitung zu Card-CSS-Themes](card-css-theming.md).

Sieht die App verkorkst aus, lohnt der Blick auf beides – auf das aktive Theme und auf Card CSS. Beides kommt als Ursache infrage.

## Verwandte Anleitungen

- [Anleitung zu Card-CSS-Themes](card-css-theming.md)
- [Darstellungs-Einstellungen](appearance-settings.md)
- [Server-Konfigurationsreferenz](../CONFIGURATION.md)
- [Fernzugriff: Basic Auth und IP-Allowlist](../REMOTE_ACCESS.md)
