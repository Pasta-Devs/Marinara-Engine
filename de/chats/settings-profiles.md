# Einstellungsprofile

Ein Einstellungsprofil ist ein benanntes Bündel wiederverwendbarer Chat-Einstellungen. Darin stecken die Verbindung eines Chats, das Prompt-Preset, Agenten, Tools, Übersetzung, Memory Recall, erweiterte Parameter und weitere Optionen pro Chat. Wende das Profil auf einen anderen Chat an, statt alles noch einmal einzustellen.

Verwaltet werden Profile ganz oben in den **Chat Settings** (Chat-Einstellungen). Sie funktionieren in den Modi Conversation und Roleplay. Im Game Mode erscheinen die Profil-Bedienelemente nicht.

## Einstellungsprofile und Prompt-Presets

Von **Preset** spricht Marinara ausschließlich bei Prompt-Vorlagen:

- Ein **Prompt-Preset** steuert den Aufbau des System-Prompts und die Generierungsparameter. Bearbeitet wird es im Presets-Panel. Siehe [Preset-Editor und Prompt Manager](../prompts/presets.md).
- Ein **Einstellungsprofil** ist die umfassendere wiederverwendbare Konfiguration. Es kann das ausgewählte Prompt-Preset enthalten, dazu die Verbindung, Agenten und weitere Chat-Einstellungen.

Ein Prompt-Preset ist also nur ein Bestandteil eines Einstellungsprofils.

## Was in einem Profil steckt

Ein Profil hält fest, wie der Chat mit der KI spricht:

- Verbindung
- Prompt-Preset (im Conversation Mode heißt es Prompt-Quelle)
- Agenten und Tools
- Übersetzung
- Memory Recall
- Advanced Parameters
- Weitere wiederverwendbare Chat-Optionen
- Fenster- und Schaltflächenanordnung: Positionen und Größen, Anheftungen und Sperren, eingebettete oder herausgelöste Tools, offene Steuerungsfenster und Schaltflächenpositionen am Computer und Telefon. Profile ohne gespeicherte Anordnung, etwa **Default**, lassen die Anordnung des Chats unverändert.
- Ob die Hinweise zur Anordnung in Chat Settings verborgen sind. **Default** und ältere Profile ohne diese Auswahl zeigen die Hinweise wieder an.

Chat-eigene Inhalte ersetzt ein Profil nicht: Charaktere, Persona, Lorebooks, Sprites, Zusammenfassung, Tags oder Szenen-Prompt bleiben unberührt. Auch der Chatverlauf steckt nicht darin.

## Ein Profil anwenden

Das Profil-Dropdown sitzt ganz oben in den **Chat Settings**. Sein Tooltip (Kurzhinweis beim Draufzeigen) lautet **Apply a settings profile to this chat**.

1. Öffne den Chat, den du ändern willst.
2. Öffne die **Chat Settings**.
3. Öffne das **Profile**-Dropdown.
4. Wähle ein Profil über seinen Namen aus.

Der Chat übernimmt die Werte sofort. Passen die aktuellen Werte zu keinem gespeicherten Profil, zeigt das Dropdown **Custom settings profile**. Existiert ein zuvor angewendetes Profil nicht mehr, steht dort **Missing profile - choose a profile**.

## Ein Profil speichern

Die Symbolleiste unter dem Dropdown bietet diese Aktionen:

| Schaltfläche | Tooltip | Ergebnis |
|---|---|---|
| Save | **Save current chat settings into this profile** | Überschreibt die gespeicherten Werte des ausgewählten Profils |
| Rename | **Rename profile** | Ändert den Namen des ausgewählten Profils |
| Save As | **Save current chat settings as a new profile** | Legt aus dem aktuellen Chat ein weiteres Profil an |
| Import | **Import settings profile (.json)** | Lädt eine Profil-Datei |
| Export | **Export settings profile (.json)** | Lädt das ausgewählte Profil herunter |
| Delete | **Delete profile** | Entfernt das ausgewählte Profil dauerhaft |

Für das erste eigene Profil richtest du einen Chat ein und wählst **Save current chat settings as a new profile**. Zum Aktualisieren später: Profil anwenden, den Chat anpassen, dann **Save current chat settings into this profile** wählen.

## Das Standardprofil festlegen

Der Stern neben dem Dropdown markiert das Profil, das neue Chats in diesem Modus automatisch bekommen. Pro Modus kann nur ein Profil der Standard sein.

Die Tooltips beschreiben den aktuellen Zustand:

- **Mark this profile as default for new chats in this mode**
- **This profile is the default for new chats in this mode**
- **Select a profile to mark it as default**

## Bevorzugte Fensteranordnungen

Der Stern neben **Reset View** in der Titelleiste von Chat Settings speichert eine Lieblingsanordnung für neue Chats im aktuellen Modus. Er merkt sich auch, ob die Hinweise zur Anordnung ausgeblendet sind. Du kannst ihn in Conversation, Roleplay und Game nutzen. Der Stern neben dem Dropdown **Profile** legt weiterhin das Standard-Einstellungsprofil fest.

Beim Update einer bestehenden Installation wird die vertraute Anordnung der Tool-Schaltflächen zum Favoriten für neue Chats in allen drei Modi. Das passiert einmal; bereits gespeicherte oder ausdrücklich entfernte Favoriten bleiben unberührt. Diese Anordnung bleibt der Standard, bis du sie selbst änderst. Eine neue Installation startet mit den Chat-Tools in Chat Settings und ohne ausgewählten Favoriten.

Ordne deine Fenster und Schaltflächen an und klick auf den Stern in der Titelleiste, um sie zu speichern. Er ist ausgefüllt, solange die aktuelle Anordnung und die Hinweise zum Favoriten passen. Änderst du die Anordnung oder verschiebst ein Fenster, ersetzt ein weiterer Klick den Favoriten. Klick auf den ausgefüllten Stern, um ihn zu entfernen und für künftige Chats wieder die Standardanordnung zu nutzen. Bestehende Chats bleiben unverändert.

Nutzt ein neuer Chat ein Standard-Einstellungsprofil, hat die darin gespeicherte Anordnung Vorrang vor dem Favoriten. Profile ohne gespeicherte Anordnung lassen den Chat unverändert, auch wenn seine Anordnung von einem Favoriten stammt. Ein Profil übernimmt weiterhin seine eigene Einstellung für die Hinweise; ältere Profile ohne diese Einstellung zeigen die Hinweise an.

Die Schritte stehen unter [Eine Anordnung für neue Chats wählen](chat-settings.md#choosing-a-layout-for-new-chats).

## Profile importieren und exportieren

**Export settings profile (.json)** lädt eine Datei `.marinara-settings-profile.json` herunter, die du als Backup aufheben oder weitergeben kannst. **Import settings profile (.json)** legt aus einer passenden Datei ein neues Profil an, ohne ein vorhandenes zu überschreiben. Auch ältere Profil-Exporte lassen sich weiterhin importieren.

Profile speichern Einstellungen, keine Zugangsdaten von Anbietern.

## Das Profil „Default“

Conversation und Roleplay haben jeweils ein eingebautes Profil **Default**. Wendest du es an, kehren die vom Profil gesteuerten Einstellungen auf Marinaras Standardwerte für diesen Modus zurück.

Das Profil **Default** lässt sich weder umbenennen noch überschreiben oder löschen. Die deaktivierten Bedienelemente erklären das mit **Cannot save into the Default profile**, **Cannot rename the Default profile** und **Cannot delete the Default profile**.

## Verwandte Anleitungen

- [Chat Settings im Überblick](chat-settings.md)
- [Preset-Editor und Prompt Manager](../prompts/presets.md)
- [Generierungsparameter](../prompts/generation-parameters.md)
