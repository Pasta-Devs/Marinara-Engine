# Darstellungseinstellungen

In dieser Anleitung gehen wir den Tab **Settings -> Appearance** in Marinara Engine Abschnitt für Abschnitt durch: Farben, Textgröße, Chat-Layout, das Aussehen der Nachrichten in jedem Modus und der Weg zurück zu den Standardwerten.

Für Schriftarten, Hintergründe und eigene CSS-Themes gibt es jeweils eine eigene Anleitung. Diese Seite verlinkt sie an der passenden Stelle.

## Die Darstellungseinstellungen öffnen

1. Öffne **Settings** (Einstellungen).
2. Wähle den Tab **Appearance** (Darstellung).

Der Tab besteht aus mehreren Abschnitten, durch die du scrollst: **App Style**, **Text & Scale**, **Conversation Display**, **Tracker Panel**, **Roleplay Messages**, **Game Presentation**, **Atmosphere**, **Conversation Theme** und **Backgrounds**.

## Color Scheme (Dark oder Light)

Das Dropdown-Menü **Color Scheme** (Farbschema) findest du im Abschnitt **App Style**. Es hat zwei Optionen:

- **Dark** (der Standard). Schont die Augen in dunklen Räumen.
- **Light**.

Mehrere der folgenden Farben haben getrennte Standardwerte für Dark und Light. Sie richten sich automatisch nach dem aktiven Color Scheme, bis du eine eigene Farbe festlegst.

## Visual Style

**Visual Style** (visueller Stil) bestimmt das Aussehen der gesamten App. Zur Auswahl stehen zwei Karten:

- **Default (Marinara)** (der Standard). Ein Retro-Y2K-Look mit Leuchteffekten.
- **SillyTavern**. Ein aufgeräumter, minimalistischer Look nach dem Vorbild des originalen SillyTavern.

Das ist reine Optik. Mit dem Import von Daten aus SillyTavern hat es nichts zu tun – das ist ein eigenständiges Werkzeug.

## Background Color und Accent Color

Diese beiden Bedienelemente sitzen im Abschnitt **App Style**. Beide akzeptieren eine einfarbige Angabe oder einen Farbverlauf. Ein Farbverlauf ist ein weicher Übergang zwischen zwei oder mehr Farben.

- **Background Color** (Hintergrundfarbe) färbt die Grundfläche der App hinter allen Inhalten. Der Standard ist `#050312` im Dark-Modus und `#faf8ff` im Light-Modus.
- **Accent Color** (Akzentfarbe) färbt Schaltflächen, aktive Symbole, Fokusrahmen, Hervorhebungen und Panel-Umrandungen. Der Standard ist `#d4acfb` in beiden Schemata.

Ein Wert wie `#d4acfb` ist ein Hex-Farbcode, eine Kurzschreibweise für eine Farbe. Zurück zum Standard des Schemas geht es über **Reset to default** (auf Standard zurücksetzen), das den Wert im Feld löscht.

Zwei Schalter verändern das Verhalten der Accent Color:

- **Accent Pulse** (standardmäßig aus) animiert die Accent Color sanft. Einfarbige Töne werden heller und wieder dunkler. Farbverläufe wandern durch ihre Farben.
- **RGB Mode** (standardmäßig aus) schickt den Akzent durch eine Regenbogenpalette, solange der Schalter aktiv ist. Die gespeicherte Accent Color bleibt unverändert.

Beides gleichzeitig geht nicht. **RGB Mode** einzuschalten deaktiviert **Accent Pulse**, und umgekehrt schaltet **Accent Pulse** den **RGB Mode** ab. Accent Pulse zeigt sich sofort in der Vorschau, solange der Appearance-Tab geöffnet ist. Ist am Gerät reduzierte Bewegung eingestellt, entfallen beide Animationen.

## Chat widget style

Unten in **App Style** wählst du **Default** (Standard), **Dottore** oder **Prof. Mari** für verschiebbare Chat-Schaltflächen, Fenster und Abschnitte. Schrift, Rahmenform und die drei Hauptfarben kannst du einzeln ändern. Die Farbwähler unterstützen auch Farbverläufe.

**Button size (px)** (Schaltflächengröße in Pixeln) ändert verschiebbare Chat-Schaltflächen und ihre Symbole, ohne Display Size zu ändern. Gib eine Größe von 32 bis 96 Pixeln ein. Lass das Feld leer oder nutze seine Schaltfläche zum Zurücksetzen, um den aktuellen Standard beizubehalten. Die Größe wird mit deinen Darstellungseinstellungen gespeichert und bleibt beim Wechsel des Presets gleich.

Unter den Farbwählern sorgen **Apply preset font** (Preset-Schrift anwenden), **Apply preset shape** (Preset-Form anwenden) und **Apply preset colors** (Preset-Farben anwenden) dafür, dass der restliche Chat dazu passt. Sie sind anfangs aus und funktionieren unabhängig voneinander. Sie gelten für Nachrichten, Eingabefelder und Chat-Bedienelemente. In Game Mode gelten sie außerdem für HUD-Widgets, das Kartenpanel, Randbemerkungen, Charakterbögen, Protokolle, das Inventar, Kampfpanels und Dialogfenster. Conversation-Nachrichten übernehmen auf Wunsch Schrift und Farben, behalten aber ihre eigene Form. Deine eigene Schrift, Form und Farben sind mit eingeschlossen. Ist **Apply preset colors** an, nutzt wörtliche Rede weiterhin die eigene Dialogue Highlight Color des jeweiligen Charakters oder der jeweiligen Persona. Beispiele und eigene Themes findest du unter [Eigene CSS-Themes](custom-css-themes.md#ready-made-chat-window-styles).

## Custom Mouse Pointer

**Custom Mouse Pointer** (eigener Mauszeiger, standardmäßig an) zeigt in der ganzen App den Marinara-Zeiger in der Akzentfarbe. Schalte die Option aus, um den gewohnten Systemzeiger zu nutzen oder den Zeiger von einem eigenen CSS-Theme steuern zu lassen.

## Display Size und Chat Font Size

Diese beiden Bedienelemente sitzen im Abschnitt **Text & Scale**.

- **Display Size** (Anzeigegröße) legt die Basis-Textgröße der gesamten App auf diesem Gerät fest. Zur Wahl stehen **Tiny**, **Small**, **Medium**, **Default** (17px), **Large** und **Huge**.
- **Chat Font Size** (Chat-Schriftgröße) ist ein Schieberegler für die Textgröße in Chat-Nachrichten. Der Bereich reicht von 12px bis 48px, der Standard liegt bei 16px.

Im selben Abschnitt sitzt das Dropdown-Menü **Font**. Wie du eigene Schriftarten hinzufügst oder welche von Google Fonts herunterlädst, steht unter [Eigene Schriftarten und Google Fonts](fonts.md).

## Textfarben und Kontur im Chat

Ebenfalls im Abschnitt **Text & Scale** steuern vier Bedienelemente, wie gut sich Chat-Text vom Hintergrund abhebt.

- **Chat Text Color** (Chat-Textfarbe) legt die Hauptfarbe für den Text der Chat-Nachrichten fest. Der Standard ist `#d4d4d4` im Dark-Modus und `#1a1025` im Light-Modus.
- **Default Dialogue Color** färbt wörtliche Rede, wenn eine Charakterkarte oder Persona keine eigene Dialogue Highlight Color definiert. Kartenspezifische Farben haben Vorrang. Solange **Apply preset colors** eingeschaltet ist, nutzt diese wörtliche Rede stattdessen die Textfarbe des Chat-Widget-Stils.
- **Chat Chrome Text Color** legt die Farbe für gewöhnlichen Text in Tracker-Widgets, Ordnerbeschriftungen und Beschreibungen in den Einstellungen fest. Es gelten dieselben Standardwerte wie bei **Chat Text Color**.
- **Text Outline / Stroke** legt eine Kontur um den Chat-Text, damit er auch vor unruhigen Hintergründen lesbar bleibt. Stell die Konturfarbe und eine **Width** (Breite) von 0px bis 5px ein. Der Standard beträgt 0.5px. Bei einer Breite von 0 verschwindet die Kontur.

Jede Farbe folgt dem Standard des Color Scheme, bis du eine eigene festlegst. Leerst du ein Farbfeld, springt es auf diesen Standard zurück und bleibt nicht leer.

## Chat Layout (Conversation Display)

Der Abschnitt **Conversation Display** enthält ein einziges Bedienelement: **Chat Layout** verändert das Aussehen der Nachrichten im Conversation Mode. Eine Live-Vorschau zeigt jede Auswahl sofort.

- **Linear** (der Standard). Zeilen im Chat-Stil.
- **Bubbles**. Sprechblasen wie im Messenger.

## Tracker Panel

Der Abschnitt **Tracker Panel** gestaltet das seitliche Tracker-Panel im Roleplay. Dieses Panel ist eine eigene Funktion mit eigener Anleitung. Siehe [Roleplay-HUD und Tracker](../roleplay/hud-and-trackers.md).

## Darstellung der Roleplay-Nachrichten

Der Abschnitt **Roleplay Messages** gestaltet die Nachrichten in Roleplay-Chats.

- **Chat position** legt fest, wo die Nachrichten und das Eingabefeld auf breiten Bildschirmen sitzen: **Left**, **Center** (der Standard) oder **Right**. Beide bewegen sich gemeinsam, und eine geöffnete Seitenleiste oder ein Tracker Panel auf derselben Seite schiebt sie mit, damit der Chat nie darunter liegt. Auf dem Handy und in schmalen Fenstern behält der Chat die volle Breite, und im Game Mode bleibt die Dialogbox mittig.
- **Roleplay Messages Background Opacity** ist ein Schieberegler von 0% bis 100%, standardmäßig 90%. Senke den Wert, damit der Hintergrund durch die Sprechblasen scheint.
- **Roleplay Avatars** bestimmt den Avatar-Stil neben jeder Nachricht. Es gibt vier Optionen: **None**, **Small Circles** (der Standard), **Small Rectangles** und **Glued Side Panel**.
- **Scrollable Avatars** (standardmäßig aus) hält die Avatare sichtbar, während du durch eine lange Nachricht scrollst.
- **Message avatar scale** ist ein Schieberegler von 75% bis 250%, standardmäßig 100%.
- **Default sprite scale** ist ein Schieberegler von 50% bis 175%, standardmäßig 100%. Eine Sprite-Größe, die im einzelnen Chat gesetzt ist, hat weiterhin Vorrang vor diesem Standard.

## Game Presentation

Der Abschnitt **Game Presentation** skaliert die Grafiken im Game Mode. Der Game Mode kann sowohl ein Dialogporträt als auch ein Ganzkörper-Sprite zeigen. Diese beiden Schieberegler bestimmen deren Größe.

- **Dialogue portrait scale** ist ein Schieberegler von 75% bis 175%, standardmäßig 100%.
- **Full-body sprite scale** ist ein Schieberegler von 75% bis 275%, standardmäßig 135%.

**Game Dialogue Display** bestimmt das Verhalten der Dialogbox:

- **Classic VN** (der Standard). In der Dialogbox steht genau ein aktives Segment. Ältere Zeilen stecken hinter der Schaltfläche **Logs**.
- **History Above VN**. Frühere Segmente erscheinen oberhalb der Dialogbox. Die komplette Sitzung bleibt dort scrollbar.

## Wettereffekte unter Atmosphere

Der Abschnitt **Atmosphere** enthält einen einzigen Schalter: **Dynamic weather effects (rain, snow, fog, etc.)** ist standardmäßig an. Er zeigt animierte Wetterpartikel, passend zu Wetter und Tageszeit der Geschichte.

Sichtbar wird davon nur etwas, wenn der Agent **World State** für den Chat aktiviert ist. Dieser Agent liest das Wetter aus der Geschichte. Ohne ihn bleibt der Schalter wirkungslos. Siehe [Agenten: KI-Helfer für deine Chats](../agents/agents-overview.md).

## Conversation Theme

Der Abschnitt **Conversation Theme** legt einen zweifarbigen Verlauf als Hintergrund für jeden Chat im Conversation Mode fest. Getrennte Tabs für **Dark** und **Light** sorgen dafür, dass jedes Color Scheme seinen eigenen Verlauf behält. Das ist ein geräteweiter Standard für Conversation-Chats, keine Einstellung pro Chat.

## Backgrounds

Im Abschnitt **Backgrounds** importierst und wählst du Hintergrundbilder für den Chat und stellst einen **Background Blur** (Hintergrundunschärfe) ein. Weil das ein eigener Funktionsbereich mit eigener Bibliothek ist, gibt es dafür eine eigene Anleitung. Siehe [Chat-Hintergründe](chat-backgrounds.md).

## Reset Appearance

Die Schaltfläche **Reset Appearance** (Darstellung zurücksetzen) sitzt ganz oben im Abschnitt **App Style**. Sie setzt den kompletten Tab **Appearance** auf die Marinara-Standardwerte zurück – Farben, Textgrößen, Layout, Avatar- und Sprite-Skalierung sowie Farbverläufe.

Außerdem entfernt das Zurücksetzen den Hintergrund des aktuellen Chats und deaktiviert ein eventuell aktives eigenes Theme aus der Theme Library. Nutze es, wenn die Gestaltung unübersichtlich geworden ist und du sauber neu anfangen willst.

## Einstellungen, die nur auf diesem Gerät gelten

Die meisten Appearance-Einstellungen werden mit den anderen Geräten synchronisiert. Zwei nicht: **Display Size** und **Chat Font Size** gelten nur im gerade genutzten Browser und werden nie synchronisiert.

Welche Einstellungen sich über Geräte hinweg synchronisieren und welche lokal bleiben, zeigt [Überblick über die Einstellungen](../settings/settings-overview.md).

## Verwandte Anleitungen

- [Eigene Schriftarten und Google Fonts](fonts.md)
- [Chat-Hintergründe](chat-backgrounds.md)
- [Eigene CSS-Themes (Theme Library)](custom-css-themes.md)
- [Anleitung zum CSS-Theming von Charakterkarten](card-css-theming.md)
- [Überblick über die Einstellungen](../settings/settings-overview.md)
