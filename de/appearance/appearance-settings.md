# Darstellungseinstellungen

Der Tab **Appearance** (Darstellung) bestimmt, wie Marinara aussieht: Farben, Textgröße, Chat-Layout und das Aussehen der Nachrichten in jedem Chat-Modus.

Suchst du etwas anderes?

- Eine andere Schrift: [Eigene Schriftarten und Google Fonts](fonts.md).
- Ein Hintergrundbild für den Chat: [Chat-Hintergründe](chat-backgrounds.md).
- Ein eigenes Theme (**Settings → Addons → Theme Library**): [Eigene CSS-Themes](custom-css-themes.md).
- Das eigene Aussehen eines Charakters im Chat: [Anleitung zum Card-CSS-Theming](card-css-theming.md).

## Die Darstellungseinstellungen öffnen

1. Öffne **Settings** (Einstellungen).
2. Wähle den Tab **Appearance**.
3. Wähle oben eine Schaltfläche: **App**, **Conversation**, **Roleplay** oder **Game**.

Die Schaltflächen gruppieren die Einstellungen nach Chat-Modus, und der Tab zeigt nur die Gruppe, die du wählst.

| Schaltfläche | Abschnitte |
| --- | --- |
| **App** | **App Style**, **Text & Scale**, **Atmosphere**, **Backgrounds** |
| **Conversation** | **Conversation Display**, **Conversation Theme** |
| **Roleplay** | **Tracker Panel**, **Roleplay Presentation** |
| **Game** | **Game Presentation** |

Um neu anzufangen, klick oben in **App Style** auf **Reset Appearance** (Darstellung zurücksetzen). Das setzt den ganzen Tab auf die Marinara-Standardwerte zurück, entfernt den Hintergrund des aktuellen Chats und deaktiviert ein aktives Theme aus der Theme Library.

## Die Schaltfläche App

### Color Scheme und Visual Style

In **App Style** bietet das Dropdown-Menü **Color Scheme** (Farbschema) **Dark** (der Standard) und **Light**. Die App ändert sich sofort. Farben mit getrennten Standardwerten für Dark und Light richten sich danach, bis du eigene festlegst.

**Visual Style** (visueller Stil) hat zwei Karten. **Default (Marinara)** ist ein Retro-Y2K-Look mit Leuchteffekten. **SillyTavern** ist ein aufgeräumter, minimalistischer Look. Die Wahl ändert nur das Aussehen und hat nichts mit dem Import aus SillyTavern zu tun.

### Background Color und Accent Color

Beide akzeptieren eine einfarbige Angabe oder einen Farbverlauf, also einen weichen Übergang zwischen zwei oder mehr Farben. Mit **Reset to default** (auf Standard zurücksetzen) leerst du ein Feld und kehrst zum Standard zurück.

| Einstellung | Was sie färbt | Standard |
| --- | --- | --- |
| **Background Color** (Hintergrundfarbe) | Die Grundfläche der App. | `#050312` in Dark, `#faf8ff` in Light |
| **Accent Color** (Akzentfarbe) | Schaltflächen, aktive Symbole, Fokusrahmen, Hervorhebungen, Panel-Umrandungen und die Bedienelemente rund um den Chat. | **Marinara Gradient**, ein Verlauf aus Pink, Orange und Cyan |

Ein Wert wie `#050312` ist ein Hex-Farbcode, eine Kurzschreibweise für eine Farbe.

Zwei Schalter verändern das Verhalten des Akzents. Es kann immer nur einer davon an sein.

- **Accent Pulse** animiert deinen Akzent. Einfarbige Töne werden heller und dunkler, Farbverläufe wandern durch ihre Farben. Am Desktop ist die Option standardmäßig an, auf dem Handy aus.
- **RGB Mode** schickt den Akzent durch einen Regenbogen. Deine gespeicherte **Accent Color** bleibt unverändert. Standardmäßig ist die Option aus.

Fordert dein Gerät reduzierte Bewegung an, entfallen beide Animationen.

### Weitere Bedienelemente in App Style

- **Custom Mouse Pointer** (eigener Mauszeiger, standardmäßig an) nutzt den Marinara-Zeiger in der Akzentfarbe. Schalte die Option aus, um deinen Systemzeiger zu nutzen oder den Zeiger von einem eigenen Theme steuern zu lassen.
- **Reduce Ambient Animations & Effects** (Umgebungsanimationen und Effekte reduzieren) stoppt dekorative Animationen, Umgebungspartikel, rotierende Vorschauen und das schrittweise Einblenden von Text. Marinara tut das auch, wenn dein Gerät reduzierte Bewegung anfordert.
- **Desktop sidebar width** (Breite der Seitenleisten am Desktop) legt am Desktop die Breite beider Seitenleisten fest. **Reset width** (Breite zurücksetzen) stellt sie wieder her. Auf dem Handy bleibt das Layout unverändert.

### Chat widget style

Unten in **App Style** wählst du **Default** (Standard), **Dottore** oder **Prof. Mari** für verschiebbare Chat-Schaltflächen, Fenster und Abschnitte. Schrift, Form und die drei Hauptfarben kannst du einzeln ändern, und die drei **Apply preset**-Schalter übertragen den Stil auf Nachrichten, Eingabefelder und Chat-Bedienelemente. **Button size (px)** ändert die Größe verschiebbarer Chat-Schaltflächen und ihrer Symbole, ohne **Display Size** (Anzeigegröße) zu ändern. Gib 32 bis 96 ein oder lass das Feld für den Standard leer. Alle Bedienelemente beschreibt [Eigene CSS-Themes](custom-css-themes.md#ready-made-chat-window-styles).

### Display Size und Chat Font Size

In **Text & Scale**:

- **Display Size** legt die Basis-Textgröße der gesamten App auf diesem Gerät fest. Die Änderung gilt sofort. Wähle eine dieser Größen:

| Auswahl | Größe |
| --- | --- |
| **Tiny** | 12 px |
| **Small** | 14 px |
| **Medium** | 16 px |
| **Default** | 17 px |
| **Large** | 19 px |
| **Huge** | 22 px |
| **Extra large** | 26 px |
| **Extra extra large** | 30 px |
| **Maximum** | 34 px |

- **Chat Font Size** (Chat-Schriftgröße) ist ein Schieberegler für den Text der Chat-Nachrichten, von 12 px bis 72 px. Der Standard ist 16 px.

Im selben Abschnitt sitzt das Dropdown-Menü **Font** (Schriftart). Siehe [Eigene Schriftarten und Google Fonts](fonts.md).

### Textfarben und Kontur im Chat

Ebenfalls in **Text & Scale**:

- **Chat Text Color** (Chat-Textfarbe) ist die Hauptfarbe des Nachrichtentexts. Der Standard ist `#d4d4d4` in Dark und `#1a1025` in Light.
- **Default Dialogue Color** färbt wörtliche Rede, wenn ein Charakter oder eine Persona keine eigene Dialogue Highlight Color hat. Die Farben der Karte haben Vorrang. Solange **Apply preset colors** (Preset-Farben anwenden) an ist, nutzt wörtliche Rede die Textfarbe des Chat-Stils.
- **Chat Chrome Text Color** legt den Text der Bedienelemente rund um den Chat fest: Tracker-Widgets, Ordnerbeschriftungen und Beschreibungen in den Einstellungen. Es gelten dieselben Standardwerte wie bei **Chat Text Color**.
- **Text Outline / Stroke** legt eine Kontur um den Text, damit er vor unruhigen Hintergründen lesbar bleibt. Stell die Farbe und eine **Width** (Breite) von 0 bis 5 px ein. Der Standard ist 0,5 px, und 0 schaltet die Kontur aus.

Leerst du ein Farbfeld, springt es auf den Standard des Farbschemas zurück.

### Atmosphere

**Dynamic weather effects (rain, snow, fog, etc.)** ist standardmäßig an. Die Option zeigt Wetterpartikel passend zu Wetter und Tageszeit der Geschichte. Zu sehen ist davon nur etwas, wenn der Agent **World State** für den Chat aktiviert ist. Siehe [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md).

### Backgrounds

Der Abschnitt **Backgrounds** (Hintergründe) enthält die Auswahl **Chat Background** (Chat-Hintergrund) und **Background Blur** (Hintergrundunschärfe). Dazu kommen zwei weitere Bedienelemente. **Conversation background image opacity** (Deckkraft des Hintergrundbilds in Conversation) legt fest, wie stark der Chat-Hintergrund in Conversation-Chats durchscheint; der Farbverlauf bleibt dabei sichtbar. **Chat List Backgrounds** (Hintergründe in der Chat-Liste) zeigt den Hintergrund jedes Chats als gedämpftes Banner hinter seiner Zeile in der Chat-Liste. Wähle **Active & Hovered**, **Every Row** oder **Off**. Siehe [Chat-Hintergründe](chat-backgrounds.md).

## Die Schaltfläche Conversation

- **Chat Layout** (in **Conversation Display**) ändert mit einer Live-Vorschau, wie Conversation-Nachrichten aussehen. **Linear** (der Standard) zeigt Zeilen im Chat-Stil. **Bubbles** zeigt Sprechblasen wie im Messenger.
- **Avatar Shape** (Avatar-Form) ist **Circular** oder **Square**. Die Größe der Avatare bleibt gleich.
- **Always display swipe menu** (Swipe-Menü immer anzeigen) zeigt die Pfeile für Swipes (alternative Antworten) und den Zähler schon ab der ersten Antwort. Schalte die Option aus, damit sie erst nach einer Neugenerierung erscheinen.
- **Conversation Theme** legt einen zweifarbigen Verlauf hinter jeden Conversation-Chat. Die Tabs **Dark** und **Light** behalten jeweils ihren eigenen Verlauf. Das ist ein geräteweiter Standard, keine Einstellung pro Chat.

## Die Schaltfläche Roleplay

**Tracker Panel** gestaltet das seitliche Tracker-Panel im Roleplay. Siehe [Roleplay-HUD und Tracker](../roleplay/hud-and-trackers.md).

**Roleplay Presentation** gestaltet die Roleplay-Nachrichten.

| Einstellung | Was sie tut | Standard |
| --- | --- | --- |
| **Chat position** | Wo Nachrichten und Eingabefeld auf breiten Bildschirmen sitzen: **Left**, **Center** oder **Right**. Eine geöffnete Seitenleiste oder ein Tracker Panel auf derselben Seite schiebt sie mit. Auf dem Handy behält der Chat die volle Breite. | **Center** |
| **Visual Novel display** | Zeigt jeweils einen fertigen Absatz mit Dialogporträt und deinen Sprites. Die Einstellung ändert den aktuellen Roleplay-Chat und den Standard für Chats ohne gespeicherten Stil. | Aus |
| **Roleplay Messages Background Opacity** | Ein Schieberegler von 0 % bis 100 %. Senke den Wert, damit der Hintergrund durch die Sprechblasen scheint. | 90 % |
| **Roleplay Avatars** | Der Avatar-Stil neben jeder Nachricht: **None**, **Small Circles**, **Small Rectangles** oder **Glued Side Panel**. | **Small Circles** |
| **Scrollable Avatars** | Hält die Avatare sichtbar, während du durch eine lange Nachricht scrollst. | Aus |
| **Message avatar scale** | Ein Schieberegler von 75 % bis 250 %. | 100 % |
| **Default sprite scale** | Ein Schieberegler von 50 % bis 175 %. Eine eigene Sprite-Größe des Chats hat weiterhin Vorrang. | 100 % |

Dieser Abschnitt enthält außerdem **Custom chat width**, **Always display swipe menu**, **Reduced paint effects** (vereinfacht aufwendige Transparenz und Schatten, damit die Navigation flüssig bleibt), **Show Thinking In Messages**, **Don't Collapse Thinking** und **Narrator's Cycling Avatars**. Ist **Visual Novel display** an, erscheinen zusätzlich **Auto-play VN paragraphs** mit einem **Paragraph delay**, **Dialogue portrait scale** und **Full-body sprite scale**.

## Die Schaltfläche Game

In **Game Presentation** hat **Game VN Art** zwei Schieberegler: **Dialogue portrait scale** (75 % bis 175 %, Standard 100 %) und **Full-body sprite scale** (75 % bis 275 %, Standard 135 %).

**Game Dialogue Display** bestimmt, wie sich das Dialogfeld verhält.

- **Classic Dialogue Box** (der Standard) zeigt ein einziges aktives Segment. Ältere Zeilen findest du über die Schaltfläche **Logs** (Protokolle).
- **History Above Dialogue Box** zeigt frühere Segmente oberhalb des Felds, und die ganze Sitzung bleibt dort scrollbar.

**Game text effects** (standardmäßig an) animiert dramatische Wörter, Betonungen in GROSSBUCHSTABEN, Einschübe in Klammern und Texteffekt-Tags. Schalte die Option aus, wenn du schlichten Text willst.

## Einstellungen, die nur auf diesem Gerät gelten

Die meisten Appearance-Einstellungen werden mit deinen anderen Geräten synchronisiert. **Display Size** und **Chat Font Size** nicht. Sie werden im Browser gespeichert, den du gerade nutzt. Was synchronisiert wird, steht unter [Überblick über die Einstellungen](../settings/settings-overview.md).

## Verwandte Anleitungen

- [Eigene Schriftarten und Google Fonts](fonts.md)
- [Chat-Hintergründe](chat-backgrounds.md)
- [Eigene CSS-Themes (Theme Library)](custom-css-themes.md)
- [Anleitung zum Card-CSS-Theming](card-css-theming.md)
- [Überblick über die Einstellungen](../settings/settings-overview.md)
