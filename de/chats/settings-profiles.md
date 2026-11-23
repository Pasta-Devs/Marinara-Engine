# Einstellungsprofile

Ein Einstellungsprofil ist ein benanntes Bündel wiederverwendbarer Chat-Einstellungen: Verbindung, Prompt-Preset, Agenten, Tools, Übersetzung, Memory Recall, erweiterte Parameter und mehr. Wende es auf einen anderen Chat an, statt diese Optionen noch einmal einzustellen.

Profile sitzen ganz oben in **Chat Settings** (Chat-Einstellungen). Sie funktionieren in Conversation und Roleplay. Game-Chats zeigen die Profil-Bedienelemente nicht.

Ein **Prompt-Preset** ist etwas anderes. Es steuert den Aufbau des System-Prompts und die Generierungswerte, und du bearbeitest es im Presets-Panel. Siehe [Preset-Editor und Prompt-Manager](../prompts/presets.md). Ein Einstellungsprofil ist das umfassendere Bündel und kann ein Prompt-Preset als einen Bestandteil enthalten.

## Ein Profil anwenden

1. Öffne den Chat, den du ändern willst, und dann **Chat Settings**. Siehe [Chat Settings im Überblick](chat-settings.md).
2. Öffne das Dropdown-Menü **Profile** (Profil) mit der Beschriftung **Apply a settings profile to this chat**.
3. Wähl ein Profil über seinen Namen aus.

Der Chat übernimmt die Werte sofort. Schaltet das Profil **Hide summarised messages** (zusammengefasste Nachrichten ausblenden) ein oder aus, werden die zusammengefassten Nachrichten des Chats im selben Moment vor dem Modell verborgen oder ihm wieder gezeigt.

Wenn es nicht funktioniert hat: Passen die Werte des Chats zu keinem gespeicherten Profil, zeigt das Dropdown-Menü **Custom settings profile**. Wurde das angewendete Profil gelöscht, zeigt es **Missing profile - choose a profile**. Wähl ein anderes Profil.

## Ein Profil anlegen oder bearbeiten

1. Tippe neben dem Dropdown-Menü auf **New** (Neu, „New profile from this chat's settings“). Der Profil-Builder öffnet sich mit den Einstellungen dieses Chats in seinen Steckplätzen. Um ein gespeichertes Profil zu ändern, wähl es aus und klick auf **Edit** (Bearbeiten). Das Profil Default lässt sich nicht bearbeiten.
2. Gib einen **Profile name** (Profilnamen) ein.
3. Füll die Steckplätze (siehe die Liste unten).
4. Tippe auf **Save and choose chats…** (speichern und Chats wählen).
5. Um das Profil für neue Chats zu verwenden, hak **Make this the default** (als Standard festlegen) an. Die Liste beginnt mit **New conversation chats** oder **New roleplay chats**.
6. Hak die bestehenden Chats an, die das Profil jetzt bekommen sollen.
7. Tippe auf **Apply to N chats** oder, wenn nichts angehakt ist, auf **Save** (Speichern).

Der Builder gruppiert die Steckplätze unter **Chat**, **Story**, **Pictures** (Bilder) und **Behind the scenes** (hinter den Kulissen). Die Steckplätze sind:

- **Connection** (Verbindung), **Prompt preset** und **Parameters** (Parameter)
- **Agents** (Agenten), **Tools** und **Memory & summary** (Gedächtnis und Zusammenfassung)
- **Persona**, **Lorebooks** und **Background** (Hintergrund)
- **Image style** (Bildstil) und **Translation** (Übersetzung)

So füllst du die Steckplätze:

- Tippe auf das Feld eines Steckplatzes. Ein Auswahlfenster mit Suche und deinen Bibliotheksordnern öffnet sich, wie bei der Auswahl von Presets und Lorebooks. Bei einem Steckplatz für nur einen Eintrag wählst du **None** (keinen), um ihn zu leeren.
- **Agents** und **Lorebooks** erlauben mehrere Einträge. Hak sie im Fenster an oder nutze **Add all** (Alle hinzufügen) bei einem Ordner. Jeder gewählte Eintrag steht mit einer Schaltfläche zum Entfernen unter dem Feld. **Clear selection** (Auswahl aufheben) leert den Steckplatz. **Tools** ist eine Liste mit Kontrollkästchen. Hak jedes Tool an, das du einschalten willst.
- Am Computer kannst du die Seitenleiste einer Bibliothek öffnen, während der Editor offen bleibt, und einen Eintrag auf sein Feld ziehen.
- **Parameters**, **Memory & summary** und **Translation** zeigen nur an, ob das Profil sie enthält. Ändere sie in Chat Settings und speichere sie dann im Profil.

Im Einrichtungsassistenten für neue Chats hat der Schritt **Use a Profile** (Profil verwenden) die Schaltfläche **New** (Neu) neben dem Profilfeld und **Edit** neben einem gespeicherten Profil. Nach dem Speichern wählt der Assistent dieses Profil aus.

<a id="the-profiles-tab"></a>

## Der Tab Profiles

Um Profile außerhalb eines Chats zu verwalten, öffne das Panel **Presets** und wähl den Tab **Profiles** (Profile). Er listet alle Conversation- und Roleplay-Profile auf, mit dem jeweiligen Profil **Default** zuerst. Die Schaltflächen über der Liste (**All** (Alle), **Conversation**, **Roleplay**) filtern nach Modus, **Search profiles** (Profile durchsuchen) nach Name. Ein Stern markiert je Modus den Standard für neue Chats.

- Klick auf ein Profil, um es im Profileditor in der Bildschirmmitte zu öffnen. **Back** (Zurück) speichert deine Änderungen, **Cancel** (Abbrechen) verwirft sie. Die Profile **Default** lassen sich weder bearbeiten noch öffnen.
- **Create settings profile** (Einstellungsprofil erstellen) öffnet ein leeres Profil. Wähl seinen Modus mit **Conversation** oder **Roleplay**. Ein gespeichertes Profil behält seinen Modus.
- Zeig auf eine Zeile, um das Profil als Standard zu markieren, zu duplizieren, zu exportieren oder zu löschen. Auf dem Handy stehen diese Schaltflächen immer am rechten Rand der Zeile.
- Mit **Select profiles** (Profile auswählen) exportierst oder löschst du mehrere Profile auf einmal. **Select all profiles** (Alle Profile auswählen) überspringt die Profile **Default**, die sich nicht löschen lassen. Jedes Profil wird als eigene Datei exportiert.
- **Import settings profile (.json)** (Einstellungsprofil importieren (.json)) lädt eine Datei vom Typ `.marinara-settings-profile.json`.

**Edit** in Chat Settings öffnet den Editor weiterhin in einem Fenster über dem Chat.

## Chat-Einstellungen in einem Profil speichern

Um ein Profil über einen Chat zu aktualisieren, wende es an, ändere den Chat und nutze dann die Symbolleiste unter dem Dropdown-Menü.

| Schaltfläche | Beschriftung | Ergebnis |
| --- | --- | --- |
| Save | **Save current chat settings into this profile** | Ersetzt die gespeicherten Werte des Profils. |
| Rename | **Rename profile** | Ändert den Namen. |
| Import | **Import settings profile (.json)** | Lädt eine Profildatei. |
| Export | **Export settings profile (.json)** | Lädt das Profil herunter. |
| Delete | **Delete profile** | Entfernt das Profil endgültig. |

### Andere Chats aktualisieren, die das Profil nutzen

Jeder Chat behält seine eigene Kopie der Einstellungen eines Profils. Speicherst du ein Profil, ändern sich andere Chats deshalb nicht von selbst. Nutzen andere Chats desselben Modus das Profil, fragt der Dialog **Other chats use this profile**:

- **Save to this profile only** (nur in diesem Profil speichern) speichert das Profil und lässt andere Chats in Ruhe.
- **Save and update N other chats** (speichern und N andere Chats aktualisieren) kopiert zusätzlich die Chat Settings des Profils in diese Chats. Ihre eigenen Änderungen an diesen Einstellungen werden ersetzt, und eine Einstellung, die du im Chat, aus dem du speicherst, auf ihrem Standardwert gelassen hast, kehrt auch dort zu ihrem Standardwert zurück.

Nutzt kein anderer Chat das Profil, funktioniert **Save** ohne Rückfrage. Räume im Mehrspielermodus werden auf diesem Weg nie aktualisiert.

<a id="choosing-the-default-profile"></a>

## Das Standardprofil festlegen

Der Stern neben dem Dropdown-Menü markiert das Profil, das neue Chats in diesem Modus automatisch bekommen. Pro Modus kann nur ein Profil der Standard sein. Die Beschriftungen lauten **Mark this profile as default for new chats in this mode**, **This profile is the default for new chats in this mode** und **Select a profile to mark it as default**. Du kannst auch im Builder **Make this the default** anhaken.

## Ein Profil importieren und exportieren

**Export settings profile (.json)** lädt eine Datei `.marinara-settings-profile.json` herunter, die du als Backup aufheben oder weitergeben kannst. **Import settings profile (.json)** legt aus einer passenden Datei ein neues Profil an und überschreibt nie ein vorhandenes. Auch ältere Exporte lassen sich weiterhin importieren. Schlägt ein Import fehl, erscheint **Import failed**.

Profile speichern Einstellungen, keine Zugangsdaten von Anbietern. Ein exportiertes oder importiertes Profil lässt außerdem den Webhook des Discord-Mirrors, die DeepLX-Adresse, den DeepL-Key und die Intiface-Adresse weg. Profile, die du in dieser Installation speicherst, behalten sie. Exportierte Dateien enthalten weder Persona noch Lorebooks noch die Auswahl für Preset-Variablen, da diese zu dieser Installation gehören.

## Das Profil „Default“

Conversation und Roleplay haben jeweils ein eingebautes Profil **Default**. Wendest du es an, kehren die vom Profil gesteuerten Einstellungen auf Marinaras Standardwerte für diesen Modus zurück. Es lässt sich weder umbenennen noch überschreiben oder löschen. Die deaktivierten Bedienelemente zeigen dazu **Cannot save into the Default profile**, **Cannot rename the Default profile** und **Cannot delete the Default profile**.

<a id="favorite-window-layouts"></a>

## Bevorzugte Fensteranordnungen

Der Stern neben **Reset View** (Ansicht zurücksetzen) in der Titelleiste von Chat Settings speichert eine Lieblingsanordnung für neue Chats. Der Stern neben dem Dropdown-Menü **Profile** legt dagegen das Standardprofil fest. Die Schritte stehen unter [Eine Anordnung für neue Chats wählen](chat-settings.md#choosing-a-layout-for-new-chats).

Nutzt ein neuer Chat ein Standardprofil mit gespeicherter Anordnung, hat diese Anordnung Vorrang vor der Lieblingsanordnung. Ein Profil ohne gespeicherte Anordnung behält die Anordnung des Chats bei, auch wenn sie von einem Favoriten stammt. Ein Profil übernimmt weiterhin seine eigene Einstellung für die Hinweise zur Anordnung (ältere Profile ohne diese Einstellung zeigen die Hinweise an) und seinen eigenen Modus für Scoped Regex Scripts oder, wenn es keinen hat, den Standard des Prompt-Presets.

## Was in einem Profil steckt

Ein Profil hält fest, wie der Chat mit dem Modell spricht:

- Verbindung.
- Prompt-Preset (in Conversation heißt es Prompt-Quelle), mit deiner Auswahl für seine [Preset-Variablen](../prompts/preset-variables.md). Wendest du das Profil an, übernimmt der Chat diese Auswahl. Ein Profil, das gespeichert wurde, bevor es diese Auswahl enthalten konnte, lässt die eigene Auswahl des Chats unverändert.
- Agenten und Tools.
- Übersetzung, Memory Recall und Advanced Parameters.
- Fenster- und Schaltflächenanordnung: Positionen, Größen, Anheftungen, Sperren, welche Tools in Chat Settings liegen oder herausgelöst sind, offene Steuerungsfenster und Schaltflächenpositionen am Computer und Telefon. Profile ohne gespeicherte Anordnung, etwa **Default**, lassen die Anordnung des Chats unverändert.
- Ob die Hinweise zur Anordnung verborgen sind. Wendest du **Default** oder ein älteres Profil ohne diese Auswahl an, erscheinen die Hinweise wieder.
- Weitere wiederverwendbare Chat-Optionen.

Ein Profil kann auch **Startauswahlen** enthalten: eine Persona, zu aktivierende Lorebooks und einen Hintergrund.

- Wendest du das Profil an, werden die Auswahlen in den Chat kopiert. Lässt das Profil eine davon leer, behält der Chat seine eigene.
- Die übrigen Einstellungen im Profil ersetzen weiterhin die Einstellungen des Chats.
- Die Auswahlen bleiben nicht verknüpft. Eine spätere Änderung im Chat bleibt in diesem Chat.
- **Save current chat settings into this profile** ersetzt die Lorebooks des Profils durch die Lorebooks, die dem Chat mit **Add Lorebook** (Lorebook hinzufügen) oder durch das Anwenden eines Profils hinzugefügt wurden. Ein Lorebook, das Lorebook Keeper für den Chat angelegt hat, wird nicht gespeichert. Wurden keine Lorebooks hinzugefügt, hat das Profil nach dem Speichern keine. Das Profil behält seine eigene Persona und seinen eigenen Hintergrund. Ein Profil ohne Hintergrund übernimmt beim Speichern den Hintergrund des Chats.
- Das Aktualisieren anderer Chats ändert nie deren Persona, Lorebooks oder Hintergrund.

Chat-eigene Inhalte ersetzt ein Profil nicht: Charaktere, Sprites, Zusammenfassung, Tags, Szenen-Prompt und **Autorennotizen**. Es enthält auch keinen Chatverlauf und keinen laufenden Zustand wie Makrovariablen, die Charaktere, die du ausgeschaltet hast, oder einen Raum im Mehrspielermodus. Ein in einer früheren Version gespeichertes Profil kann noch **Autorennotizen** enthalten, beim Anwenden bleiben aber die eigenen Notizen des Chats erhalten.

### Was Save and update kopiert

**Save and update** kopiert Folgendes in die anderen Chats:

- Generierungs- und Kontextoptionen.
- Optionen für Gruppenchats.
- Funktions- und Befehlsschalter.
- Agenten und ihre Optionen.
- Gedächtnis- und Zusammenfassungseinstellungen.
- Übersetzung.
- Die Fensteranordnung.
- Die Auswahl für Preset-Variablen, nur in Chats, die dasselbe Prompt-Preset wie das Profil verwenden.

Alles andere behält jeder Chat so, wie er es hat:

- Seine Verbindung, sein Prompt-Preset und sein eigener Prompt.
- Seine Geschichte und seine Charaktere.
- Seine Lorebooks und sein Hintergrund.
- Seine **Autorennotizen** und sein Fortschritt.
- Welche Roleplay-Befehle nur sein Erzähler verwenden darf.
- Ob Noodle seine Nachrichten verwenden darf.

Advanced Parameters und die Bildbeschreibung (an oder aus und welche Verbindung Bilder beschreibt) ändern sich nur in Chats, die die Verbindung des Profils nutzen, weil sie für diese Verbindung festgelegt werden. Charakter-Zeitpläne ändern sich nur, wenn sie im Chat, aus dem du speicherst, ein- oder ausgeschaltet wurden. Knowledge Retrieval, Knowledge Router, Lorebook Keeper und Expression Engine bleiben samt ihren Prompt-Vorlagen so an oder aus, wie jeder Chat sie eingestellt hat. Ihre Quellen, ihr Lorebook oder ihre Sprites wählt jeder Chat selbst.
