# Eigene CSS-Themes (Theme Library)

Ein eigenes CSS-Theme färbt ganz Marinara neu ein. In der **Theme Library** (Theme-Bibliothek) legst du Themes an, importierst und exportierst sie und wechselst zwischen ihnen. Diese Anleitung listet außerdem die CSS-Variablen und Klassen auf, die ein Theme nutzen kann, und erklärt, wie Themes mit Card CSS zusammenspielen. Für eine schnelle Änderung ohne CSS siehe [Fertige Stile für Chat-Fenster](#ready-made-chat-window-styles).

Bevor du anfängst: Öffnest du Marinara von einem anderen Gerät aus, etwa vom Handy, braucht der Server ein Admin-Secret, bevor du Themes anlegen, bearbeiten, importieren, aktivieren oder entfernen kannst. Auf dem Rechner, auf dem der Server läuft, ist kein Secret nötig.

1. Setze auf dem Server `ADMIN_SECRET` in der Datei `.env`.
2. Öffne in der App **Settings → Advanced → Admin Access** (Einstellungen → Erweitert → Admin-Zugriff) und trag denselben Wert ein.

Siehe die [Referenz zur Server-Konfiguration](../CONFIGURATION.md) und die [Anleitung zum Fernzugriff](../REMOTE_ACCESS.md). Willst du zu einem Theme wechseln, das dir jemand gegeben hat, geh zu [Ein Theme aktivieren](#activating-a-theme).

## Was ein eigenes Theme ist

CSS steht für Cascading Style Sheets und ist der Code, der Farben, Rahmen und Abstände festlegt. Ein Theme ist ein Block CSS, der den Seitenhintergrund, die Akzentfarbe, Karten, Rahmen, Text und mehr ändern kann.

Themes liegen in der **Theme Library** auf deinem Marinara-Server und erscheinen deshalb auf jedem Gerät, das sich mit demselben Server verbindet. Die meisten anderen Darstellungseinstellungen bleiben auf einem einzigen Gerät. Aktiv sein kann immer nur ein Theme, behalten kannst du so viele, wie du willst.

## Wo die Theme Library steckt

1. Öffne **Settings**.
2. Öffne den Tab **Addons**.
3. Such den Bereich **Theme Library**.

## Ein Theme anlegen

1. Klick im Bereich **Theme Library** auf **Create Theme** (Theme anlegen).
2. Gib im Namensfeld einen Namen ein (dort steht „Theme name...“).
3. Schreib dein CSS in das große Textfeld oder füg es dort ein.
4. Lass **Preview** (Vorschau) an, um deine Änderungen beim Tippen live zu sehen. Schalte sie aus, um die Live-Vorschau zu beenden.
5. Klick auf **Save** (Speichern).

Ein neues Theme startet mit einer Vorlage, die gängige Variablen als auskommentierte Beispiele auflistet. Entferne die Kommentarzeichen und trag eigene Werte ein. Ein brandneues Theme wird beim Speichern aktiviert, und du siehst: Theme "My Theme" saved and activated.

Um ein Theme später zu ändern, such es unter **Installed Themes** (installierte Themes), klick auf das Code-Symbol (Tooltip **Edit theme CSS**), bearbeite es und klick auf **Save**. Das Bearbeiten ändert nicht, welches Theme aktiv ist.

## Themes importieren und exportieren

So importierst du ein Theme:

1. Klick im Bereich **Theme Library** auf **Import File** (Datei importieren).
2. Wähle eine `.css`- oder `.json`-Datei.
3. Lies die Meldung. Sie nennt, wie viele Themes importiert, übersprungen oder nicht übernommen wurden.

Aus einer `.css`-Datei wird ein Theme, benannt nach der Datei. Eine `.json`-Datei kann ein oder mehrere Themes enthalten. Importiere eine aus Marinara exportierte Datei unverändert, oder schreib selbst eine kleine:

```json
{ "name": "My Theme", "css": "..." }
```

Importierte Themes aktivieren sich nicht von selbst. Ein Theme mit demselben Namen und demselben CSS wie eines, das schon auf dem Server liegt, wird übersprungen.

Zum Exportieren klickst du in der Zeile des Themes unter **Installed Themes** auf das Upload-Symbol (Tooltip **Export theme**). Marinara lädt eine `.json`-Datei herunter, die du anderswo importieren kannst.

<a id="activating-a-theme"></a>

## Ein Theme aktivieren

**Installed Themes** listet alle Themes auf, ganz oben mit dem Eintrag **Default Theme** (Standard-Theme).

1. Klick auf den Namen eines Themes, um es zu aktivieren. Ein Häkchen zeigt das aktive Theme.
2. Klick auf **Default Theme**, um eigene Themes abzuschalten und zum eingebauten Aussehen zurückzukehren.

**Reset Appearance** (Darstellung zurücksetzen) oben in **App Style** (App-Stil) unter **Settings → Appearance** (Einstellungen → Darstellung) schaltet ebenfalls das aktive Theme ab.

Um ein Theme zu löschen, klick auf das Papierkorb-Symbol (Tooltip **Remove theme**) und bestätige im Dialogfenster **Delete Theme**. Damit wird sein CSS dauerhaft vom Server gelöscht.

Wenn es nicht funktioniert hat: Sieht die App falsch aus, prüf sowohl das aktive Theme als auch etwaiges Card CSS im Chat. Siehe [Themes und Card CSS](#themes-and-card-css).

<a id="ready-made-chat-window-styles"></a>

## Fertige Stile für Chat-Fenster

Bevor du anfängst: Dafür brauchst du kein CSS.

1. Öffne **Settings → Appearance → App**.
2. Such unten in **App Style** den Eintrag **Chat widget style** (Chat-Widget-Stil).
3. Wähl einen Stil.

| Stil | Aussehen |
| --- | --- |
| **Default** (Standard) | Das ursprüngliche Aussehen. |
| **Dottore** | Eisblaue Instrumentenrahmen, helle Metallkanten und abgeschrägte Ecken. |
| **Prof. Mari** | Goldgesäumte Märchenbuchrahmen, Edelsteinblau und Primogems an den Fenstertiteln. Seine Schaltflächen nutzen denselben Hintergrund wie seine Fenster. |

Jeder Stil hat eine eigene Schrift, funktioniert im hellen und dunklen Modus und gestaltet Schaltflächen, Fenster und aufklappbare Abschnitte gemeinsam. Die Wahl eines Stils setzt **Font** (Schrift), **Shape** (Form) und alle drei Farben zurück. Deine Fensterpositionen bleiben erhalten.

Diese Einstellungen kannst du einzeln ändern:

- **Font** und **Shape** folgen dem Stil (**Preset font**, **Preset shape**), bis du etwas anderes wählst.
- **Border & Buttons Color** (Rahmen- und Schaltflächenfarbe) färbt Umrisse und Schaltflächensymbole. Symbole nutzen die erste Farbe eines Farbverlaufs.
- **Background Color** (Hintergrundfarbe) füllt Schaltflächen, Fenster, aufklappbare Abschnitte und Eingabefelder.
- **Text Color** (Textfarbe) färbt den Widget-Text. Farbverläufe erscheinen auf Überschriften und Beschriftungen, und Eingabefelder nutzen die erste Farbe.

Jede Farbe hat einen Farbwähler für eine einheitliche Farbe und eine Option für einen Farbverlauf. **Reset color** (Farbe zurücksetzen) neben einer Einstellung folgt wieder den hellen oder dunklen Farben des Stils. Dekorative Embleme behalten ihre ursprünglichen Farben.

### Den Stil in den Chat übertragen

Drei Schalter unter den Farbwählern erweitern den Stil. Jeder ist anfangs aus und funktioniert für sich. Schaltest du einen aus, kehrt dieser Teil zur üblichen Chatgestaltung zurück, und die Wahl eines anderen Stils behält deine Schalterstellungen bei.

| Schalter | Was er anwendet |
| --- | --- |
| **Apply preset font** (Preset-Schrift anwenden) | Die Widget-Schrift, für Nachrichten, Eingabefelder und Chat-Bedienelemente. |
| **Apply preset shape** (Preset-Form anwenden) | Die Rahmenform, für Roleplay-Nachrichten (klassisch und Visual Novel), das Game-Dialogfeld, Eingabefelder und Bedienelemente. Conversation-Nachrichten behalten ihre eigene Form. |
| **Apply preset colors** (Preset-Farben anwenden) | Die Rahmen-, Hintergrund- und Textfarben für diese Bereiche, einschließlich Conversation-Nachrichten. Auch deine eigenen Farben und Farbverläufe gelten dort. Wörtliche Rede behält die eigene Dialogue Highlight Color des jeweiligen Charakters oder der jeweiligen Persona. Eine Nachricht aus HTML, etwa die gestaltete Karte eines Agenten, behält die Textfarben, die sie selbst festlegt. |

Die Verlaufsschaltflächen **Load More** (Mehr laden) und **Show older** (Ältere anzeigen) folgen den Schaltern wie andere Chat-Bedienelemente. Im Game Mode gelten die Schalter außerdem für Randbemerkungen, HUD-Widgets, das Kartenpanel, Charakterbögen, Protokolle, das Inventar, Kampfpanels und Dialogfenster. Professor Mari kann auch eigene Themes für diese Bereiche erstellen.

Ein eigenes Theme kann die Stile weiterhin überschreiben. Die Variablen für Fenster und Abschnitte weiter unten haben Vorrang vor den Farben des Stils. Nutze `--mari-window-font-family` für die Fensterschrift, `--mari-drawer-radius` für die Ecken der Abschnitte und `--mari-window-ornament: none`, um die Verzierung am Titel auszublenden. Um alle Verzierungen des Stils zu entfernen, wähle zuerst **Default**.

<a id="themes-and-card-css"></a>

## Themes und Card CSS

Marinara kennt zwei Wege, eigenes CSS einzubringen, und beide können gleichzeitig aktiv sein.

- Ein eigenes Theme färbt die ganze App neu ein. Es darf Marinaras Kernvariablen überschreiben, `!important` verwenden und `position: fixed` nutzen.
- Card CSS ist in eine Charakterkarte oder Persona-Karte eingebettet und wird pro Chat eingeschaltet. Es wird strenger bereinigt: Es kann keine Kernvariablen überschreiben, `!important` wird entfernt, und aus `position: fixed` wird `position: absolute`. Es gestaltet Chatnachrichten, nicht die ganze App. Siehe die [Anleitung zum Card-CSS-Theming](card-css-theming.md).

## Grenzen für Größe und Name

Ein Theme-Name darf bis zu 200 Zeichen lang sein. Das CSS darf bis zu 256 KiB umfassen, gemessen in UTF-8-Bytes. Ein größeres Theme wird beim Speichern oder Importieren abgelehnt. Das CSS eigener Themes wird außerdem bereinigt, bevor es wirkt: Stile, die eine Datei von einer anderen Website laden, funktionieren nicht. Bette ein Bild oder eine Schrift stattdessen als `data:`-URI ein.

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

Ein Theme kann jede CSS-Variable setzen, die Marinara verwendet, nicht nur diese. Manche Effekte haben eigene Variablen. Zum Beispiel fordert `--marinara-theme-accent-pulse: enabled` die pulsierende Akzent-Animation an.

## Chat-Fenster und aufklappbare Abschnitte gestalten

Am Computer öffnet sich **Chat Settings** als verschiebbares Fenster. Seine aufklappbaren Abschnitte heißen **drawers**. Ein Abschnitt lässt sich in ein eigenes Fenster herauslösen und anschließend zu einer kleinen verschiebbaren Schaltfläche minimieren, einer **bubble**.

Auch andere Chat-Tools nutzen diese Fenster und Schaltflächen: Game controls, Session, Volume, Game Assets, verknüpfte Chats und Paket-Bedienelemente. Am Telefon öffnen sich die meisten Fenster als Panels über die ganze Breite; Echo Chamber bleibt ein kompaktes Fenster, das du verschieben und dessen Größe du ändern kannst. Aus Chat Settings herausgelöste Tools erscheinen im verschiebbaren Drei-Punkte-Menü **Chat tools** (Chat-Tools); Tracker-Schaltflächen bleiben separat.

Mit den folgenden Klassen, Datenattributen und Variablen gestaltet ein Theme diese Teile gemeinsam. Deine Theme-Regeln überschreiben die Standardwerte ohne `!important`.

### Klassen

| Teil | Klasse |
| --- | --- |
| Fenster | `.mari-window` |
| Titelleiste | `.mari-window__header` |
| Titel und sein Symbol | `.mari-window__title-row` |
| Titel | `.mari-window__title` |
| Schaltflächen der Titelleiste (Reset View, Favoritenstern, Tracker Panel, Anheften, Sperren, Schließen, Put back) | `.mari-window__controls` (jede Schaltfläche hat `.mari-window__control`) |
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
| Aktuelle Übersicht, die eine Fensterschaltfläche statt ihres Symbols zeigt (das Banner von World State) | `.mari-window-bubble__banner` |
| Hilfslinie beim Ausrichten einer gezogenen Schaltfläche an einer anderen | `.mari-window-snap-guide` |
| Punkt während der Arbeit von Agenten (Chat-Settings-Schaltfläche, Trackers-Fenster) | `.mari-agents-running-dot` |

### Datenattribute

- `data-window` benennt ein Fenster und seine Schaltfläche: `chat-settings`, `trackers`, die Steuerungsfenster `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` und `control:beholder:<package>` sowie `drawer:<window>:<drawer>` für einen herausgelösten Abschnitt, etwa `drawer:chat-settings:chat-name`.
- `data-drawer` benennt einen Abschnitt, etwa `chat-name`. Einige Namen beginnen mit dem Chat-Modus, zum Beispiel `roleplay-agents` oder `conversation-agents`. Tracker nutzen `tracker-world`, `tracker-persona`, `tracker-characters`, `tracker-quests`, `tracker-inventory`, `tracker-custom` und `agent-activity`.
- `data-presentation` ist bei einem Computerfenster `"window"` und bei einem Telefon-Panel `"sheet"`.
- `data-pinned` und `data-locked` sind `"true"`, solange das Fenster angeheftet oder gesperrt ist.
- `data-window-control` benennt jede Schaltfläche der Titelleiste: `"pin"`, `"lock"`, `"close"` oder `"put-back"`. Eine aktivierte Anheft- oder Sperrschaltfläche hat außerdem `aria-pressed="true"`.
- `data-chat-settings-control` kennzeichnet die zusätzlichen Schaltflächen in der Titelleiste von Chat Settings: `"reset-view"`, `"favorite-layout"` und `"tracker-panel"`. Der Favoritenstern hat `aria-pressed="true"` und ein ausgefülltes Symbol, wenn die aktuelle Anordnung zum gespeicherten Favoriten passt.
- `data-edge` ist an den jeweiligen Größenänderungsgriffen `"n"`, `"s"`, `"e"`, `"w"`, `"ne"`, `"nw"`, `"se"` oder `"sw"`.
- Die Schaltfläche eines offenen Abschnitts innerhalb von `.mari-drawer__header` hat `aria-expanded="true"`.
- `data-drawer-control="pop-out"` kennzeichnet die Schaltfläche zum Herauslösen eines Abschnitts.
- `data-outside="true"` kennzeichnet eine Ziehvorschau, die weit genug außerhalb ihres Fensters liegt, um beim Loslassen herausgelöst zu werden.
- `data-axis` ist `"x"` bei einer senkrechten Ausrichtungslinie und `"y"` bei einer waagerechten.
- `data-detached` ist `"true"`, wenn ein Abschnitt in einem eigenen Fenster erscheint, sowohl am Fenster als auch am Abschnitt darin. Das Fenster eines herausgelösten Abschnitts heißt `data-window="drawer:<window>:<drawer>"`, etwa `data-window="drawer:chat-settings:chat-name"`; `data-drawer-host` benennt sein Ursprungsfenster.
- `data-dragging` ist am Abschnitt `"true"`, während du seinen Titel ziehst. `data-drop-target` ist an einem Fenster `"true"`, während du einen herausgelösten Abschnitt darüber hältst, um ihn zurückzulegen.
- Eine Fensterschaltfläche trägt das `data-window` ihres Fensters und `data-minimized="true"`, etwa `.mari-window-bubble[data-window="control:volume"]`. Steuerungsfenster heißen `control:game`, `control:session`, `control:volume`, `control:assets`, `control:connected-chat`, `control:package:<package>` und `control:beholder:<package>`. Während du die Schaltfläche ziehst, ist ihr `data-dragging` gleich `"true"`. Eine Fensterschaltfläche, die statt ihres Symbols eine aktuelle Übersicht zeigt, etwa ein minimierter World-State-Tracker, hat `data-banner="true"` und wird so breit wie die Übersicht.
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

<a id="styling-messages-input-boxes-and-chat-controls"></a>

## Nachrichten, Eingabefelder und Chat-Bedienelemente gestalten

Mit den drei **Apply preset**-Schaltern kann auch ein eigenes Theme das Widget-Design im restlichen Chat nutzen. Ein Theme kann jeden Teil mit den folgenden Variablen überschreiben. Bitte Professor Mari um ein passendes Chat-Theme, wenn du das CSS nicht selbst schreiben möchtest.

| Teil | Klasse |
| --- | --- |
| Nachrichtenfelder in Roleplay und Game, Randbemerkungen, HUD-Widgets, Kartenpanel und Charakterbögen in Game sowie Chat-Eingabefelder | `.mari-chat-style-surface` |
| Protokolle, Inventar, Kampfpanels, Entscheidungen und Dialogfenster in Game; die Panels tragen zusätzlich `data-game-section` mit ihrem Namen, etwa `logs`, `inventory` oder `combat-actions` | `.mari-game-section.mari-chat-style-surface` |
| Game-Inhalte in einem Fenster wie dem Journal, die sich nach den Farben des Fensters richten | `.mari-game-section` |
| Conversation-Nachrichten (nur Schrift und Farben) | `.mari-chat-style-conversation` |
| Conversation-Nachrichtentext ohne Rahmen | `.mari-chat-style-text` |
| Chat-Bedienelemente, einschließlich Calls und Conversation-Gruppensteuerung | `.mari-chat-style-control` |
| Verlaufsschaltflächen: **Load More**, **Show older**, **Show newer**, **Latest** sowie **Older**, **All** und **Show more older logs** in den Game-Protokollen. Sie haben zusätzlich `.mari-chat-style-control` | `.mari-chat-history-pager` |
| Eine Nachricht aus HTML, etwa die gestaltete Karte eines Agenten. Darin gesetzte Textfarben bleiben erhalten, wenn **Apply preset colors** an ist | `.mari-html-content` |

| Variable | Wirkung |
| --- | --- |
| `--mari-chat-font-family` | Schrift für die zugehörigen Chatbereiche |
| `--mari-chat-bg` | Hintergrund der Felder; nimmt eine Farbe oder einen Farbverlauf an |
| `--mari-chat-text` | Lesbare einheitliche Textfarbe |
| `--mari-chat-border` | Umriss der Felder; nimmt eine Farbe oder einen Farbverlauf an |
| `--mari-chat-border-color` | Einheitliche Ersatzfarbe für den Rahmen |
| `--mari-chat-radius` | Eckenrundung, außer bei Conversation-Nachrichten |
| `--mari-chat-control-bg`, `--mari-chat-control-bg-hover` | Hintergründe der Chat-Schaltflächen |
| `--mari-chat-control-color`, `--mari-chat-control-radius` | Symbolfarbe und Rundung der Chat-Schaltflächen |
| `--mari-chat-input-bg` | Hintergrund in Eingabefeldern |

Ein Beispiel mit eingeschaltetem **Apply preset font** und **Apply preset colors**:

```css
:root {
  --mari-chat-font-family: Georgia, serif;
  --mari-chat-bg: #251e29;
  --mari-chat-text: #f4e8dc;
  --mari-chat-border: linear-gradient(100deg, #d6aa66, #dda0b2);
}
```

Nicht gesetzte Variablen folgen den Widget-Einstellungen und dem Preset. Damit diese Variablen über die eingebaute Gestaltung wirken, muss der zugehörige Schalter an sein. Conversation-Nachrichten behalten ihre eigene Form, auch wenn **Apply preset shape** an ist. Eigene Themes können die Klassen auch direkt ansprechen; Fokusumrisse, Menüs und Nachrichteninhalte dürfen dabei nicht von dekorativen Formen abgeschnitten werden.

Am Telefon klappt das Drei-Punkte-Menü zu runden Schaltflächen auf. Sein Auslöser ist `[data-chat-tools-menu-button]`, die geöffnete Spalte ist `[data-chat-tools-menu]`, und bei jedem Listeneintrag enthält `data-chat-tools-menu-item` die Fenster-ID. Tool-Schaltflächen nutzen `.mari-window-bubble.mari-chat-tools-button` und `data-chat-tools-menu-tool` mit derselben ID. Die Spalte hat keinen Fensterrahmen. Ihre Schaltflächen folgen den Widget-Farben und der Schaltflächengröße unabhängig von den drei Schaltern für den restlichen Chat und behalten dabei ihre runde Form.

## Verwandte Anleitungen

- [Anleitung zum Card-CSS-Theming](card-css-theming.md)
- [Darstellungseinstellungen](appearance-settings.md)
- [Referenz zur Server-Konfiguration](../CONFIGURATION.md)
- [Fernzugriff: Anmeldung und IP-Allowlist](../REMOTE_ACCESS.md)
