# Noodle-Einstellungen und Chat-Carryover

In dieser Anleitung geht es Abschnitt für Abschnitt durch das Panel **Noodle settings** (Noodle-Einstellungen) – mit allen Standardwerten und Grenzen. Außerdem erfährst du, wie sich Noodle mit den Chats verbindet. Dafür gibt es zwei Funktionen: **Carryover to chats** (Übernahme in Chats) und den Schalter **Allow Noodle references** (Noodle-Bezüge erlauben) pro Chat. Sie wirken in entgegengesetzte Richtungen.

Noodle ist die eingebaute Social-Media-Timeline von Marinara Engine. Wenn du neu dabei bist, lies zuerst [Noodle: Die eingebaute Social-Timeline](overview.md). Eine Persona ist der Charakter, den du im Chat selbst spielst. Eine Verbindung führt gespeichert zu einem KI-Anbieter, der Text oder Bilder generiert. Siehe [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md).

## Das Panel „Noodle settings“ öffnen

1. Öffne Noodle über die obere Leiste.
2. Klick in der linken Seitenleiste auf die Schaltfläche **Settings** (Einstellungen, das Zahnradsymbol).
3. In der Kopfzeile des Panels steht **Noodle settings**.

Alle Noodle-Einstellungen gelten global – für jede Persona und jeden Chat, nicht nur für einen einzelnen. Änderungen speichert Marinara sofort.

## Invites

Im Abschnitt **Invites** (Einladungen) legst du fest, welche Charaktere an einem Noodle-Refresh teilnehmen. Ein Refresh ist der Durchlauf, bei dem die KI für die eingeladenen Accounts einen Schwung Posts, Antworten, Reposts und Likes schreibt.

- **Professor Mari participates**: ein Schalter, standardmäßig **on**. Schalte ihn aus, um Professor Mari aus der Noodle-Account-Suche auszublenden und sie von künftigen generierten Posts, Antworten, Reaktionen, Erwähnungen, der Profilgenerierung und dem Chat-Carryover auszuschließen. Der bisherige Timeline-Verlauf bleibt erhalten, und beim Wiedereinschalten kehrt ihr Account zurück.
- **Characters to Invite**: ein Suchfeld. Tipp hier, um sowohl die Ordnerliste als auch die Charakterliste darunter zu filtern.
- **Add from Folder**: Klick darauf, um die Liste der Charakter-Ordner aufzuklappen. Setz bei einem oder mehreren Ordnern das Häkchen und klick dann unten auf die Einladen-Schaltfläche. Ihre Beschriftung richtet sich nach deiner Auswahl:
  - **Select folders to invite**, wenn nichts angehakt ist.
  - **Selected folder characters are invited**, wenn bereits alle eingeladen sind.
  - **Invite N characters**, wenn neue Charaktere dazukommen.
- **Characters**: eine scrollbare Liste aller Charaktere der Bibliothek. Jede Zeile hat eine Schaltfläche zum Einladen oder Entfernen. Als Status steht dort **Invited**, **Included by folder** oder **Not invited**.

Das Einladen über einen Ordner ist eine einmalige Sammelaktion, keine laufende Synchronisierung. Charaktere, die du später in diesen Ordner legst, sind nicht automatisch eingeladen.

## Refresh

Der Abschnitt **Refresh** (Aktualisierung) bestimmt, über welche KI-Verbindung Noodle schreibt und wie oft Noodle von allein aktualisiert.

- **Generation connection**: ein Dropdown-Menü. Wähl hier die Verbindung, über die Noodle Posts, Antworten, Reposts, Likes und Profiltexte schreibt. Anfangs ist nichts gewählt, im Feld steht der Platzhalter **Choose connection**. Ohne diese Auswahl läuft kein Refresh. Bildfähige Modelle bekommen zusätzlich bis zu acht aktuelle, passende Bilder aus Noodle-Posts und -Kommentaren. Reine Textmodelle, die solche Bildeingaben ablehnen, werden automatisch ohne die Bilder erneut angefragt.
- **Refreshes/day**: eine Zahl von 0 bis 24, standardmäßig **2**. So viele automatische Refreshes führt Marinara pro Tag aus. Bei 0 sind automatische Refreshes aus. Wie oft du von Hand aktualisierst, begrenzt der Wert nicht.

### Automatic schedule

Steht **Refreshes/day** über 0, teilt Marinara den Tag in gleich große Fenster und wählt in jedem Fenster eine zufällige Uhrzeit. Die geplanten Zeiten stehen samt Zeitzone unter **Automatic schedule**. Klick auf den Stift neben einer künftigen Zeit, um sie auf eine andere Stunde zu verschieben. Vergangene, bereits erledigte und doppelte Zeiten lassen sich nicht wählen.

Automatische Refreshes laufen im Marinara-Server. Die Noodle-Seite muss dafür nicht offen bleiben – Marinara selbst muss aber laufen. Scheitert ein Refresh, zeigt der Zeitplan den Fehler und versucht es später erneut, nach wiederholten Fehlschlägen mit längerer Wartezeit. Fallen mehrere geplante Zeiten aus, holt ein einziger erfolgreicher Refresh sie gemeinsam nach, statt die Timeline zu überschwemmen.

## Active Accounts

Der Abschnitt **Active Accounts** (aktive Accounts) legt fest, wie viele infrage kommende Accounts an einem Refresh teilnehmen. Infrage kommen deine eingeladenen Charaktere, über Ordner eingebundene Charaktere und – falls aktiviert – die **Random users**.

- **Active selection**: ein Dropdown-Menü, standardmäßig **Random range**. Zur Wahl stehen **Random range**, **Exact count** und **All invited**.
- Bei **Random range** erscheinen zwei Felder: **Min active** (1 bis 100, Standard **2**) und **Max active** (1 bis 100, Standard **5**). Jeder Refresh würfelt eine Anzahl dazwischen aus.
- Bei **Exact count** erscheint ein Feld: **Active count** (1 bis 100). Es legt eine feste Anzahl an Accounts fest.
- Bei **All invited** nimmt jeder infrage kommende Account teil, ohne Obergrenze.

Die aktive Persona kommt zu diesen Accounts immer noch obendrauf. Professor Mari ist dabei, solange **Professor Mari participates** eingeschaltet ist.

Noodle wählt die aktiven Accounts aus, bevor es erstmalige Profile vorbereitet. Nur aktive Charaktere ohne bereits generiertes Noodle-Profil bekommen eine Anfrage zur Profilgenerierung; inaktive eingeladene Charaktere bleiben außen vor. Ebenso enthält die Anfrage zum Schreiben der Timeline nur die Charakterkarten der Accounts, die für diesen Refresh ausgewählt wurden.

## Activity

Der Abschnitt **Activity** (Aktivität) begrenzt, wie viel ein einzelner Refresh erzeugen darf. Jedes Feld ist eine Obergrenze pro Refresh.

| Feld | Standard | Bereich |
|---|---|---|
| **Posts** | 8 | 0 bis 100 |
| **Replies** | 12 | 0 bis 200 |
| **Reposts** | 4 | 0 bis 100 |
| **Likes** | 18 | 0 bis 500 |

Setz ein Feld auf 0, damit die KI diese Art von Aktivität gar nicht erzeugt.

## Image Generation

Der Abschnitt **Image Generation** (Bildgenerierung) erlaubt Noodle, an manche Posts KI-generierte Bilder zu hängen. Dafür braucht es eine Bildgenerierungs-Verbindung, also eine Verbindung, die auf das Erzeugen von Bildern eingerichtet ist. Siehe [Unterstützte KI-Anbieter](../connections/providers-reference.md).

- **Image generation**: ein Schalter, standardmäßig **off**. Schalte ihn ein, damit die KI Post-Bilder generiert.
- Ist er an, kommen weitere Bedienelemente dazu:
  - **Image generation connection**: ein Dropdown-Menü, standardmäßig **Default image generation connection**. Auf Default nutzt Noodle die Verbindung, die im Panel **Connections** als Standard für die Bildgenerierung markiert ist.
  - **Prompt instructions**: ein Textfeld mit vorbelegtem Text, maximal 4000 Zeichen. Diese Zusatzhinweise fließen in den Bild-Prompt ein.
  - **Use avatar references**: ein Schalter, standardmäßig **on**. Schickt den Avatar oder die Referenzbilder des Charakters an das Bildmodell.
  - **Include descriptions**: ein Schalter, standardmäßig **on**. Nimmt die geschriebenen Aussehensnotizen des Charakters in den Bild-Prompt auf.
  - **Images/refresh**: eine Zahl von 0 bis 50, standardmäßig **3**. Das begrenzt die generierten Post-Bilder für jeden manuellen und automatischen Refresh getrennt.
- **Attach gallery images**: ein eigener Schalter, standardmäßig **off**. Er bleibt sichtbar, auch wenn **Image generation** aus ist. Statt ein neues Bild zu erzeugen, darf ein Post damit ein Bild aus der Galerie des Charakters oder aus einem Chat wiederverwenden, in dem er vorkommt.

Schaltest du **Image generation** ein, hast aber keine brauchbare Bild-Verbindung, blockiert Marinara den Refresh. Es erscheint die Meldung „Choose an image generation connection for Noodle first.“ Ein fehlgeschlagenes Bild wird einmal wiederholt. Scheitert auch der zweite Versuch, läuft der Refresh weiter und veröffentlicht einen sauberen reinen Textpost, statt den ungenutzten Bild-Prompt offenzulegen.

Die Vorlage, mit der Noodle diese Bild-Prompts schreibt, heißt **Noodle Post Image**. Bearbeiten kannst du sie unter **Settings** > **Generations** > **Image Generation Prompt Overrides**. Dein Text aus **Prompt instructions** geht in diese Vorlage ein, und das Ergebnis durchläuft anschließend dein übliches Bildstil-Profil. Siehe [Prompt-Overrides für Bild und Video](../prompts/prompt-overrides.md) und [Bildstil-Profile](../media/style-profiles.md). Professor Mari hat keine Charakterkarte, deshalb greifen ihre Bildposts auf ihren eingebauten Avatar und ihre Referenzbilder zurück.

## Timeline Writing

Der Abschnitt **Timeline Writing** (Timeline-Texte) stellt Tonfall und Langzeitgedächtnis des Refresh-Schreibers ein.

- **Enhanced tone & continuity**: ein Schalter, standardmäßig **off**. Ist er an, gründet sich die Stimme jedes Accounts stärker auf dessen eigene Personality/Description/Backstory statt auf einen standardmäßig gut gelaunten Ton, Accounts sollen im selben Refresh stärker auf Posts der anderen reagieren, sie zitieren oder ihnen widersprechen, ältere Posts kommen häufiger zur Sprache (bevorzugt solche, die zu den gerade aktiven Accounts passen, statt rein zufällig gewählter), und die Rückgriff-Anweisung erlaubt Bezüge, statt von ihnen abzuraten. Ausgeschaltet verhält sich Noodle exakt wie ursprünglich bei Ton und Rückgriff – nur mit diesem Schalter ändern sich deine Timelines also.
- **Use generated character schedules**: ein Schalter, standardmäßig **off**. Ist er an, nimmt Noodle für jeden teilnehmenden Charakter den heutigen bereits generierten Conversation-Zeitplan mit auf, sofern vorhanden. Noodle selbst erzeugt oder aktualisiert keine Zeitpläne. Das aktuelle lokale Datum samt Uhrzeit steckt in jedem Timeline-Refresh, unabhängig von diesem Schalter.

## Die Stimme des Timeline-Schreibers anpassen

Noodles Refresh-Schreiber folgt einem eingebauten Satz an Vorgaben zu Ton und kreativer Freiheit: wie viel Persönlichkeit die Posts eines Accounts tragen sollen und wie sehr Accounts miteinander plaudern, scherzen oder aneinandergeraten dürfen. Diesen Text kannst du unter **Settings** > **Generations** > **Image Generation Prompt Overrides** > **Noodle Timeline Voice & Tone** neu schreiben (der Abschnittstitel sagt „Image“, die Liste enthält aber alle anpassbaren Noodle- und Conversation-Textprompts, nicht nur die für Bilder). Der dort angezeigte Standardtext richtet sich nach dem Schalter **Enhanced tone & continuity** von oben, bis du ihn anpasst; sobald du eigenen Text speicherst, gilt dieser unabhängig vom Schalter.

Dieses Override betrifft nur Stimme und Ton. Die Regeln, die die Ausgabe eines Refreshs gültig halten – welche strukturierten Aktionen erlaubt sind, wie Interaktionen adressiert sein müssen und so weiter –, stecken nicht in diesem Text und gelten immer. Eine umgeschriebene Stimme kann einen Refresh also nicht kaputt machen.

## World / Lore

Der Abschnitt **World / Lore** (Welt/Hintergrund) erlaubt einem Refresh, Lorebook-Einträge heranzuziehen – aus demselben Lorebook-System, das auch die Chat-Generierung nutzt. Ein Lorebook ist eine Sammlung von Weltwissen.

- **Lorebook context**: ein Schalter, standardmäßig **off**. Ist er an, durchsucht jeder Refresh die jüngsten Noodle-Post- und -Antworttexte sowie die Profile der aktiven Charaktere nach Lorebook-Schlüsselwörtern und übergibt passende Einträge als Welt-/Hintergrundkontext an die beteiligten Accounts. Auslösen können nur Lorebooks, die mit einem aktiven Charakter verknüpft oder als global markiert sind. Für ausgelöste Welt-/Hintergrundinhalte gilt pro Refresh ein hartes Budget von 8.192 Tokens. Ein Token ist ein kleines Textstück. Standardmäßig ist die Option aus, bestehende Timelines bleiben also unverändert, bis du sie einschaltest.

## Carryover

Der Abschnitt **Carryover** (Übernahme) schiebt aktuelle Noodle-Aktivität in deine Chats. Ist er an, bekommt der Prompt eines Chats einen Block „Recent Social Media Activity“, der beschreibt, was deine Charaktere auf Noodle so getrieben haben. Der Prompt ist der Text, den Marinara an die KI schickt.

- **Carryover to chats**: drei getrennte Schalter, alle standardmäßig **off**: **Conversations**, **Roleplays** und **Games**. Schalte die Modi ein, die Noodle-Aktivität erhalten sollen.
- **Carry hours**: eine Zahl von 1 bis 720, standardmäßig **48**. So viele Stunden schaut Noodle für die Übernahme zurück.
- **Carry items**: eine Zahl von 1 bis 50, standardmäßig **8**. So viele Aktivitätszusammenfassungen kommen höchstens zu einem Chat-Zug dazu.

Das Carryover holt nur Aktivität von Charakteren, die auf Noodle eingeladen sind, plus die aktive Persona des Chats. Eine reine Ordner-Einbindung genügt hier nicht.
Für den kompletten umschlossenen Carryover-Block gilt pro Chat-Generierung ein eigenes hartes Budget von 8.192 Tokens. Sprengt die Anzahl der Einträge dieses Budget, behält Marinara die neuesten passenden Zusammenfassungen und gibt sie in zeitlicher Reihenfolge aus.

## Reset Noodle

Der Abschnitt **Reset Noodle** (Noodle zurücksetzen) leert die Timeline, behält aber Accounts und Einstellungen.

1. Klick auf die Schaltfläche **Reset Noodle Timeline**.
2. Es erscheint ein Dialogfenster mit dem Titel **Reset Noodle Timeline**. Darin steht „This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay.“
3. Klick zur Bestätigung auf **Reset timeline**.

Gelöscht werden nur Timeline-Inhalte. Accounts, Handles, Bios, Follows, Einladungen und sämtliche Noodle-Einstellungen bleiben erhalten.

## Random users

**Random users** sind sechs eingebaute Hintergrund-Accounts, die nicht aus deiner Bibliothek stammen: Thread Countess, Packet Soup, Orbit Notice, Glass Bulletin, Moth Hour und Brine Index. Jeder hat eine kurze, augenzwinkernde Bio.

Einschalten lassen sie sich über die Zeile **Random users** ganz oben in der Liste **Characters** im Abschnitt **Invites**. Standardmäßig ist sie **off**. Als Unterzeile steht dort **Enabled**, wenn sie an ist, sonst **Ambient fake profiles**. Ist sie an, dürfen diese Accounts während eines Refreshs posten, liken, reposten, antworten und folgen. Ihnen selbst folgen kann man aus einem Profil heraus nie.

## Noodle mit den Chats verbinden

Noodle und die Chats teilen Kontext in zwei Richtungen. Das sind zwei getrennte Funktionen: Wer die eine einschaltet, schaltet die andere nicht mit ein.

**Carryover to chats** (in den Noodle-Einstellungen) schickt Noodle-Aktivität in einen Chat. Es hängt den Block „Recent Social Media Activity“ an den Prompt dieses Chats, wie oben im Abschnitt Carryover beschrieben.

**Allow Noodle references** ist ein Schalter pro Chat. Er schickt Chat-Aktivität in die andere Richtung, nach Noodle. Zu finden ist er in den Einstellungen des jeweiligen Chats, in der Nähe des Bereichs **Connected Chats**. Siehe [Chat-Einstellungen im Überblick](../chats/chat-settings.md). Für jeden Chat ist er standardmäßig **off**. Seine Beschreibung lautet „Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt.“ Läuft in diesem Chat außerdem ein [Conversation-Zeitplan für Charaktere](../conversation/schedules.md), kommen zu den Nachrichten der aktuelle Status und die Aktivität des Charakters in dieser Geschichte dazu (zum Beispiel „currently dnd (At the office)“) – begrenzt auf genau diesen Chat.

Damit Noodle-Aktivität in einem Chat auftaucht, schalte den passenden **Carryover to chats**-Modus ein. Damit ein Noodle-Refresh aus einem Chat lesen darf, schalte in diesem Chat **Allow Noodle references** ein. Beides geht einzeln oder zusammen.

## Fehlerbehebung

- **Refresh now erzeugt nichts**: Wähl eine **Generation connection**, lade mindestens einen Charakter ein (oder schalte die **Random users** ein) und sieh dir den Fehler im Abschnitt **Refresh** an.
- **Automatische Refreshes bleiben aus**: Setz **Refreshes/day** über 0, lass den Marinara-Server laufen und prüf die geplanten Zeiten samt Zeitzone unter **Automatic schedule**. Zeigt der Zeitplan einen Fehler, behebe das Problem mit der Verbindung oder dem Ratenlimit und lass den erneuten Versuch laufen.
- **Posts erwähnen einen aktuellen Chat nicht**: Schalte in den Einstellungen dieses Chats **Allow Noodle references** ein und achte darauf, dass der Charakter eingeladen ist. Chat-Kontext ist für die KI eine Orientierung, keine Garantie.
- **Noodle-Aktivität taucht in Chats nicht auf**: Schalte den passenden **Carryover to chats**-Modus ein und erhöhe **Carry hours**, falls die Aktivität zu alt ist.
- **Posts haben keine Bilder**: Schalte **Image generation** ein, wähl eine funktionierende Bild-Verbindung und prüf die Grenze bei **Images/refresh**.

## Einstellungen und Standardwerte

Diese Tabelle listet jede Noodle-Einstellung mit Standardwert und Bereich.

| Einstellung | Standard | Bereich oder Optionen |
|---|---|---|
| **Generation connection** | keine | jede Textverbindung (für den Refresh nötig) |
| **Professor Mari participates** | on | on oder off |
| **Refreshes/day** | 2 | 0 bis 24 (0 schaltet automatische Refreshes aus) |
| **Automatic posting schedule** | on | on oder off |
| **Posts/day** | 4 | 1 bis 24 |
| **Night quiet** | on | Character-Creator überspringen 23:00–07:00 Uhr |
| **Automatic pro Creator** | off | Die geführte Einrichtung kann es einschalten |
| **Images pro Creator** | off | Die geführte Einrichtung kann es einschalten |
| **Automatische Creator-Antworten** | 10 pro 24 Stunden | installationsweit, nicht pro Creator |
| **Active selection** | Random range | Random range, Exact count, All invited |
| **Min active** | 2 | 1 bis 100 (nur bei Random range) |
| **Max active** | 5 | 1 bis 100 (nur bei Random range) |
| **Active count** | entspricht Max active | 1 bis 100 (nur bei Exact count) |
| **Posts** | 8 | 0 bis 100 |
| **Replies** | 12 | 0 bis 200 |
| **Reposts** | 4 | 0 bis 100 |
| **Likes** | 18 | 0 bis 500 |
| **Image generation** | off | on oder off |
| **Image generation connection** | Default | jede Bildgenerierungs-Verbindung |
| **Prompt instructions** | vorbelegter Text | bis zu 4000 Zeichen |
| **Use avatar references** | on | on oder off |
| **Include descriptions** | on | on oder off |
| **Images/refresh** | 3 | 0 bis 50 |
| **Attach gallery images** | off | on oder off |
| **Lorebook context** | off | on oder off |
| **Enhanced tone & continuity** | off | on oder off |
| **Carryover: Conversations** | off | on oder off |
| **Carryover: Roleplays** | off | on oder off |
| **Carryover: Games** | off | on oder off |
| **Carry hours** | 48 | 1 bis 720 |
| **Carry items** | 8 | 1 bis 50 |
| **Allow Noodle references** (pro Chat) | off | on oder off |

## Verwandte Anleitungen

- [Noodle: Die eingebaute Social-Timeline](overview.md)
- [Chat-Einstellungen im Überblick](../chats/chat-settings.md)
- [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md)
- [Unterstützte KI-Anbieter](../connections/providers-reference.md)
