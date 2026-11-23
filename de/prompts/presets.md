# Preset-Editor und Prompt-Manager

Ein Preset ist eine gespeicherte Blaupause für den Prompt – den Text, den Marinara für jede Antwort an das Modell schickt. Es legt fest, was hineinkommt und in welcher Reihenfolge: deine Anweisungen, die Charakterkarte, deine Persona, der Chatverlauf, Lorebook-Einträge und mehr. Im **Preset Editor** (Preset-Editor) baust du eines, danach weist du es einem Chat zu.

Presets bauen den Prompt in **Roleplay**-Chats. **Conversation**- und **Game**-Chats nutzen stattdessen ein einzelnes Prompt-Feld (siehe [Conversation- und Game-Chats](#conversation-and-game-chats)). Presets brauchen keinen API-Key, zum Senden des Prompts brauchst du aber trotzdem ein funktionierendes Konto. Siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

## Ein Preset einem Chat zuweisen

Ein Preset bewirkt nichts, bis ein Chat es nutzt. In einem **Roleplay**-Chat geht das auf zwei Wegen. Willst du ein vorhandenes nehmen, weist du es zu. Wie du ein eigenes erstellst, steht unter [Ein Preset anlegen](#create-a-preset).

Über das Panel **Presets**:

1. Öffne den Chat.
2. Such im Panel **Presets** eine Preset-Zeile. Am Computer zeigst du auf die Zeile, damit ihre Schaltflächen erscheinen.
3. Klick auf die Häkchen-Schaltfläche **Assign to chat** (dem Chat zuweisen). Ein Häkchen zeigt, dass das Preset in Gebrauch ist. Ein erneuter Klick hebt die Zuweisung auf.

Über **Chat Settings** (Chat-Einstellungen):

1. Öffne den Chat und dann **Chat Settings**.
2. Such **Prompt Preset** und wähl im Dropdown-Menü ein Preset.

Hat das Preset Variablen, öffnet sich das Fenster **Configure Preset Variables** (Preset-Variablen konfigurieren). Siehe [Preset-Variablen](preset-variables.md). Wechselst du das Preset, gehen frühere Variablen-Auswahlen verloren.

<a id="create-a-preset"></a>

## Ein Preset anlegen

1. Öffne das Panel **Voreinstellungen** über die obere Leiste.
2. Klick auf **New** (das Plus-Symbol). Das Fenster **Create Preset** (Preset erstellen) öffnet sich.
3. Gib einen **Name** ein. Das Feld ist Pflicht. Ergänze bei Bedarf eine **Description** (Beschreibung).
4. Klick auf **Create**. Das Preset öffnet sich im **Preset Editor**.
5. Bau den Prompt auf dem Tab **Sections** (Abschnitte) zusammen.
6. Klick oben rechts auf **Save** (Speichern).

Der Editor speichert nicht von selbst. Klick nach jeder Änderung auf **Save**. Verlässt du ihn mit ungespeicherten Änderungen, bietet eine Warnung **Keep editing**, **Discard** und **Save & close** an.

Zum Exportieren klickst du in der oberen Leiste auf das Symbol mit dem Pfeil nach oben (Tooltip **Export preset**). Bei ungespeicherten Änderungen bittet Marinara dich, zuerst zu speichern. Zum Löschen klickst du auf das Papierkorb-Symbol.

## Das Presets-Panel

Das Panel hat vier Tabs: **Prompts**, **Regexes**, **Tools** (Werkzeuge) und **Profiles** (Profile). Jeder Tab hat oben dieselbe Schaltflächenleiste und ein Suchfeld. Im Tab **Prompts** erstellst du mit **Create preset** ein Preset, lädst mit **Import preset** eine `.json`-Datei oder exportierst oder löschst mit **Select presets** mehrere Presets auf einmal. **Select all presets** (Alle Presets auswählen) markiert alle Presets, die die Suche anzeigt. Der Tab **Regexes** enthält deine Regex-Skripte. Siehe [Regex-Skripte](../extending/regex-scripts.md#manage-your-scripts). Der Tab **Tools** enthält deine eigenen Tools. Siehe [Eigene Tools](../extending/custom-tools.md). Der Tab **Profiles** enthält deine Chat-Einstellungsprofile. Siehe [Einstellungsprofile](../chats/settings-profiles.md#the-profiles-tab).

- **Search presets** (Presets durchsuchen) filtert die Liste.
- Das Sortiermenü bietet **Manual order** (manuelle Reihenfolge), **A-Z**, **Z-A**, **Newest** , **Oldest**, **Most tokens** (meiste Tokens) und **Fewest tokens** (wenigste Tokens). Die Größe zählt den eigenen Text der aktivierten Abschnitte, also die Anweisungen, die ein Preset immer sendet. Marker-Abschnitte wie Charakter, Lorebook und Chatverlauf werden pro Chat befüllt und zählen nicht mit. Jede Zeile zeigt die Schätzung. Bei **Manual order** ziehst du eine Zeile oder drückst auf einer fokussierten Zeile <kbd>Alt</kbd>+<kbd>Up</kbd> oder <kbd>Alt</kbd>+<kbd>Down</kbd>. Auf einem Touchscreen hältst du eine Zeile gedrückt, um sie aufzunehmen.
- **New Folder** gruppiert Presets. Zieh ein Preset auf einen Ordner; ein Doppelklick oder Doppeltipp auf einen Ordner benennt ihn um.

Jede Zeile zeigt Name, Wrap-Format, Anzahl der Abschnitte und Autor. Das Abzeichen **DEFAULT** kennzeichnet den mit Stern markierten Standard. Ein Klick auf eine Zeile öffnet das Preset.

## Die Tabs im Preset Editor

| Tab | Was er enthält |
| --- | --- |
| **Overview** | Name, Beschreibung, Wrap-Format und Autor. |
| **Sections** | Der Prompt-Aufbau aus Blöcken und Markern. |
| **Prompts** | Die Modus-Prompts für Conversation- und Game-Chats. |
| **Parameters** | Die anfänglichen Generierungseinstellungen. Siehe [Generierungsparameter](generation-parameters.md). |
| **Regex** | Mit diesem Preset verknüpfte Regex-Skripte und der **Scoped regex default** (Standard für bereichsbezogene Regex-Skripte). Siehe [Regex-Skripte](../extending/regex-scripts.md). |

### Tab Overview

- **Name** ist der Titel im Panel **Presets**.
- **Description** ist eine kurze Zusammenfassung.
- **Wrap Format** steuert, wie Abschnitte formatiert werden (siehe [Wrap-Formate](#wrap-formats)).
- **Author** ist ein optionaler Name der erstellenden Person, praktisch, wenn du ein Preset weitergibst.

Zwei schreibgeschützte Karten zeigen die Anzahl der **Sections** und **Groups**.

### Tab Prompts

- **Conversation Mode** ist ein Textfeld für den Conversation-Prompt dieses Presets. Lass es leer, um den eingebauten Prompt zu nutzen.
- **Roleplay Mode** lässt sich hier nicht bearbeiten. Roleplay nutzt den Prompt, der aus deinen **Sections** zusammengesetzt wird.
- **Game Mode** ist ein Textfeld für den Game-Prompt dieses Presets. Lass es leer, um den eingebauten Prompt zu nutzen.

#### Erzähleinstellungen für Game Mode

Ein Preset kann einen Erzählstil, eine Gewaltstufe und inhaltliche Grenzen in Game Mode übernehmen, damit du sie nicht für jedes Spiel neu festlegen musst. Siehe [Erzählstil, Gewalt und inhaltliche Grenzen](../game/getting-started.md#story-style-violence-and-content-boundaries).

1. Schalte auf dem Tab **Prompts** unter **Game story settings** (Erzähleinstellungen für Game Mode) die Option **Bring story settings to games that use this preset** (Erzähleinstellungen für Spiele mit diesem Preset übernehmen) ein.
2. Wähle einen **Story style** (Erzählstil) und eine Stufe für **Violence** (Gewalt). **Follow rating** (Altersfreigabe folgen) belässt die Gewalt in jedem Spiel beim Standard seiner Altersfreigabe.
3. Optional: Trag **Content boundaries** (Inhaltliche Grenzen) ein, eine pro Zeile.
4. Klick auf **Save**.

Wenn du das Preset im Einrichtungsassistenten oder unter **Chat Settings → Prompt Preset** (Chat-Einstellungen → Prompt-Preset) für ein Spiel wählst, übernimmt das Spiel dessen Erzählstil und Gewaltstufe. Die Grenzen des Presets werden zu den bereits vorhandenen Grenzen des Spiels hinzugefügt, sodass keine eigenen Grenzen des Spiels entfernt werden. Spätere Änderungen am Preset ändern keine Spiele, die es bereits ausgewählt haben. Die Einstellung bleibt beim Duplizieren, Exportieren und Importieren des Presets erhalten.

Das integrierte **Marinara's Universal Preset** liefert Prompt-Text, aber keine Generierungsparameter. Seine älteren gespeicherten Einstellungen für Sampling, Reasoning, Formatierung und Tokens werden ignoriert; stattdessen gelten deine Kontoeinstellungen, Chat-Überschreibungen und die Standardwerte der App. Erstelle eine bearbeitbare Kopie, um es anzupassen.

## Abschnitte und Marker

Auf dem Tab **Sections** baust du den Prompt. Die Abschnitte werden von oben nach unten zusammengesetzt.

1. Klick auf **Add Section** (Abschnitt hinzufügen).
2. Wähl **Prompt Block** oder einen Marker.

Ein **Prompt Block** ist Text, den du selbst schreibst: System-Anweisungen, Vorgaben zum Ton, alles, was in jedem Prompt stehen soll. Ein Marker hat keinen eigenen Text. Marinara füllt ihn beim Senden des Prompts mit aktuellen Inhalten aus dem Chat.

| Marker | Was er einfügt |
| --- | --- |
| **Character Info** | Die Details der aktiven Charakterkarte. |
| **Persona** | Die Details deiner aktiven Persona. |
| **Chat History** | Die Chat-Nachrichten. |
| **Chat Summary** | Die zusammengestellte Chat-Zusammenfassung. |
| **Dialogue Examples** | Die Beispieldialoge des Charakters. |
| **Lorebook Marker (All)** | Alle aktiven Lorebook-Einträge. |
| **Lorebook Marker (Before)** | Lorebook-Einträge, die davor eingefügt werden sollen. |
| **Lorebook Marker (After)** | Lorebook-Einträge, die danach eingefügt werden sollen. |
| **Memory Recall** | Die Erinnerungen, die [Memory Recall](../agents/memory.md) für jede Antwort findet. Ohne diesen Marker stehen sie direkt vor dem Chatverlauf. |

Die Zeile eines Markers trägt das Abzeichen **MARKER**. In die meisten Marker kannst du nichts tippen. Nimm **Lorebook Marker (All)**, außer du willst Lorebook-Einträge in davor und danach aufteilen.

Drei seltenere Marker:

- **Current Scene Summary** und **Recalled Scenes** platzieren die Zusammenfassungen, die Advanced Memory Recall erstellt. Ohne einen Marker **Recalled Scenes** erscheinen sie vor dem Chatverlauf. Siehe [Memory Recall und Chat-Zusammenfassungen](../agents/memory.md).
- **ID Macro Cards** platziert Charakterkarten, die du in einen Prompt holst, indem du die Karten-ID eines Charakters in doppelte geschweifte Klammern schreibst. Ohne diesen Marker landen sie an der Standardstelle. Siehe [Prompt-Makros](macros.md).

Ohne aktivierten Marker **Dialogue Examples** hängt Marinara vorhandene Beispieldialoge hinter dem Szenario an **Character Info** an, im Wrap-Format des Presets. Füg den Marker hinzu, um die Platzierung selbst zu wählen. Doppelt fügt Marinara die Beispiele nie ein.

Hat dein Chat aktive Lorebooks, das Preset aber keinen Lorebook-Marker, erscheint die Warnung: „Add a lorebook marker when this preset should receive active lorebook entries.“ Füg einen hinzu, damit die Einträge beim Modell ankommen. Siehe [Lorebooks – Überblick](../lorebooks/overview.md).

Hast du eigene Agenten mit eingeschaltetem „inject as section“, zeigt das Menü zum Hinzufügen **Agent Sections**. Jeder davon fügt die jüngste Ausgabe des jeweiligen Agenten ein, und du kannst eigene Anweisungen darum herum ergänzen.

### Einen Abschnitt bearbeiten

1. Klick auf den Namen oder den Pfeil eines Abschnitts, um ihn aufzuklappen.
2. Ändere seinen **Name** oder seine Rolle (**System**, **User** oder **Assistant**).
3. Bei einem **Prompt Block** bearbeitest du **Content** (Inhalt). Dort funktionieren [Makros](macros.md).
4. Klick oben rechts auf **Save**.

Die Bedienelemente der Zeile:

- **Duplicate** (Duplizieren) kopiert den Abschnitt.
- Das Augensymbol schaltet ihn ein oder aus.
- **Delete** (Löschen) entfernt ihn.
- Zum Umsortieren ziehst du am Griff, nutzt die Pfeile nach oben und unten oder drückst auf dem Touchscreen lange.

### Gruppen

Eine Gruppe fasst mehrere Abschnitte in einem Container zusammen.

1. Klick auf dem Tab **Sections** auf **Groups** (Gruppen) und dann auf **New Group** (Neue Gruppe).
2. Klick auf den Namen der Gruppe, um sie umzubenennen.
3. Klapp einen Abschnitt auf und wähl die Gruppe in seinem Dropdown-Menü **Group**.

Bei **XML** wird eine Gruppe zu einem übergeordneten Tag. Bei **MARKDOWN** wird sie zu einer Überschrift. Abschnitte derselben Gruppe, die nicht direkt nebeneinander stehen, bekommen jeweils ein eigenes Tag oder eine eigene Überschrift. Löschst du eine Gruppe, bleiben ihre Abschnitte erhalten. Sie verlieren nur die Gruppenzuordnung.

### Position und Tiefe

Jeder Abschnitt hat in seinem Editor die Einstellung **Position**.

- **Ordered (in sequence)** setzt den Abschnitt dorthin, wo er in der Liste steht. Das ist der Normalfall.
- **Depth (from end of chat)** setzt ihn eine feste Anzahl Nachrichten vor das Ende des Chats; die Anzahl legt das Zahlenfeld **Depth** fest. Die Tiefe 0 setzt ihn hinter die letzte Nachricht. Nimm das für Hinweise, die das Modell nahe an den neuesten Nachrichten sehen soll.

<a id="wrap-formats"></a>

## Wrap-Formate

**Wrap Format** auf dem Tab **Overview** legt fest, wie jeder Abschnitt umschlossen wird.

| Format | Ergebnis |
| --- | --- |
| **XML** | Jeder Abschnitt steckt in Tags. Gruppen werden zu übergeordneten Tags. Das ist der Standard. |
| **MARKDOWN** | Jeder Abschnitt bekommt eine Überschrift. Gruppen werden zu Überschriften höherer Ebene. |
| **NONE** | Keine Umschließung. Der Inhalt geht so raus, wie du ihn geschrieben hast. |

XML passt für die meisten Modelle. Probier die anderen nur, wenn ein Modell ohne Tags besser antwortet.

Soll ein einzelner **Prompt Block** ohne sein Tag oder seine Überschrift gesendet werden, klapp ihn auf und schalte **Send without wrapper** (ohne Umschließung senden) ein. Das Tag einer Gruppe kann ihn trotzdem umschließen; nimm den Block also aus seiner Gruppe, wenn er völlig ohne Umschließung gesendet werden soll. Marker behalten ihre Umschließung immer, und beim Format **NONE** ist der Schalter ausgeblendet.

<a id="conversation-and-game-chats"></a>

## Conversation- und Game-Chats

Diese Chats bauen den Prompt nicht aus Sections, sondern nutzen einen einzelnen Modus-Prompt. In **Chat Settings** hat der Bereich **Prompt Preset** ein Dropdown-Menü **Prompt source** (Prompt-Quelle) mit deinen Presets. Es steht anfangs auf **Default conversation prompt** oder **Default game prompt** oder zeigt **No presets available**, wenn du keine hast. Im Panel **Presets** zeigt die Schaltfläche zum Zuweisen „Prompt presets are not available in conversation mode.“

Unter dem Dropdown-Menü zeigt ein Abzeichen, woher der Prompt stammt.

| Abzeichen | Bedeutung |
| --- | --- |
| **Default** | Der eingebaute Prompt. |
| **Preset** | Der Prompt des gewählten Presets. |
| **Style** | Der Prompt des gewählten GM-Prompt-Stils. Nur in Game-Chats. |
| **Custom** | Eine chatlokale Bearbeitung, die nur für diesen Chat gilt. Sie hat Vorrang vor allen anderen. |

Das Textfeld zeigt den Prompt, der gerade gilt. Bearbeite ihn, um eine chatlokale Kopie anzulegen. Stimmt dein Text exakt mit dem Preset oder dem Standard überein, wertet Marinara ihn nicht als Anpassung. Solange eine eigene Bearbeitung existiert, erscheint ein Symbol zum Zurücksetzen (Tooltip **Reset to default prompt**).

Game-Chats haben weitere Bedienelemente. **Story style**, **Violence**, **Content boundaries** und **Rating guidelines** (Richtlinien zur Altersfreigabe) legen fest, was in der Geschichte des Spiels vorkommen darf. Siehe [Während eines Spiels ändern](../game/getting-started.md#change-them-during-a-game). Zwei weitere gestalten den Prompt. **GM prompt style** (GM-Prompt-Stil) ersetzt nur den Game-Prompt, und eine chatlokale Bearbeitung hat weiterhin Vorrang. **Extra instructions** (zusätzliche Anweisungen) ergänzt den Game-Prompt um Text, bis zu 2.000 Zeichen, etwa „Write in the style of Terry Pratchett.“

## Abschnitte für Prompt-Caching anordnen

Beim Prompt-Caching kann ein Dienst den bereits gelesenen Anfang eines Prompts wiederverwenden. Dadurch kosten lange Chats weniger und antworten schneller. Der Dienst verwendet den Prompt nur bis zum ersten Text wieder, der sich seit der letzten Nachricht geändert hat. Abgerufene Erinnerungen ändern sich mit fast jeder Nachricht. Stehen sie vor dem Chatverlauf, verhindern sie deshalb, dass der gesamte Verlauf aus dem Cache genutzt wird.

Um sie selbst zu platzieren, füge dem Preset einen Marker **Memory Recall** hinzu. Zieh ihn unter **Chatverlauf**, oder setze seine **Position** auf **Tiefe (ab dem Ende des Chats)**, um ihn innerhalb des Verlaufs einzufügen. Liest das Modell Erinnerungen vor der Geschichte, orientieren sich seine Antworten stärker daran. Deshalb bleibt die Standardposition vor dem Verlauf.

<a id="decision-blocks-and-prompt-caching"></a>

## Decision-Blöcke und Prompt-Caching

Ein Abschnitt kann einen Decision-Block `{{#if decision:"..."}}` enthalten. Dieser Teil wird dann nur gesendet, wenn eine Aussage über den Chat wahr ist. Siehe [Das Decision-Modell fragen](conditional-prompts.md#asking-the-decision-model).

Setz Decision-Blöcke, die sich oft ändern, spät im Prompt ein, etwa in Anweisungen nach dem Verlauf. Ein veränderter Zweig kann verhindern, dass ein Anbieter den Prompt ab dieser Stelle wiederverwendet; eine frühe Änderung kostet daher den Großteil der Cache-Ersparnis. Ein unveränderter früherer Teil kann weiterhin wiederverwendet werden. Lass eine Decision nur dann weit oben, wenn ihre Antwort selten wechselt. Siehe [Prompt-Caching](conditional-prompts.md#prompt-caching).

Aussagen in deaktivierten Abschnitten und Gruppen werden nie gefragt und zählen nicht zu **Decision statements per turn** (Decision-Aussagen pro Zug).

## Prüfen, was bei der KI angekommen ist

**Peek Prompt** zeigt den vollständig zusammengesetzten Prompt einer Nachricht. Das ist der schnellste Weg, eine merkwürdige Antwort aufzuklären. Siehe [Peek Prompt: Sieh nach, was die KI bekommen hat](../chats/peek-prompt.md).

## Verwandte Anleitungen

- [Preset-Variablen](preset-variables.md)
- [Prompt-Makros](macros.md)
- [Generierungsparameter](generation-parameters.md)
- [Einstellungsprofile](../chats/settings-profiles.md)
- [Chat Settings im Überblick](../chats/chat-settings.md)
- [Peek Prompt: Sieh nach, was die KI bekommen hat](../chats/peek-prompt.md)
