# Noodle-Einstellungen und Chat-Carryover

Im Panel **Noodle settings** (Noodle-Einstellungen) legst du fest, wer an der Timeline teilnimmt, wie viel gepostet wird und wie Noodle Kontext mit deinen Chats teilt. Zwei Funktionen teilen Kontext in entgegengesetzte Richtungen: **Carryover to chats** (Übernahme in Chats) und der Schalter **Allow Noodle references** (Noodle-Bezüge erlauben) pro Chat.

Wenn du neu bei Noodle bist, lies zuerst [Noodle: die Social-Timeline in der App](noodle.md). Eine Persona ist der Charakter, den du im Chat selbst spielst. Zu KI-Konten siehe [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md).

## Die Einstellungen öffnen

1. Öffne Noodle über **Home**.
2. Klick in der linken Seitenleiste auf **Settings** (Einstellungen), das Zahnradsymbol. In der Kopfzeile steht **Noodle settings**.
3. Wähl mit den Schaltflächen unter der Kopfzeile eine Seite.

| Seite | Abschnitte |
| --- | --- |
| **General** (Allgemein) | [Refresh](#refresh), [Translation](#translation) |
| **Timeline** | [Activity](#activity), [Image Generation](#image-generation) |
| **Participants** (Teilnehmende) | [Invites](#invites), [Random users](#random-users) (**Ambient Profiles**), [Active Accounts](#active-accounts) |
| **Advanced** (Erweitert) | **Noodle Prompt**, [Image Understanding](#image-understanding), [Timeline Writing](#timeline-writing), [World / Lore](#world--lore), [Carryover](#carryover), [Reset Noodle](#reset-noodle) |

Alle Noodle-Einstellungen gelten global, also für jede Persona und jeden Chat. Änderungen werden sofort gespeichert. Eine vollständige Liste der Standardwerte steht unter [Einstellungen und Standardwerte](#settings-and-defaults).

## Refresh

Ein Refresh ist der Durchlauf, bei dem die KI für die eingeladenen Accounts einen Schwung Posts, Antworten, Reposts und Likes schreibt. Dieser Abschnitt legt fest, mit welchem Modell Noodle schreibt und wie oft Noodle von allein aktualisiert.

- **Generation model**: das Modell, mit dem Noodle Posts, Antworten, Reposts, Likes und Profiltexte schreibt. Anfangs ist nichts gewählt, im Feld steht der Platzhalter **Choose connection**. Bevor ein Refresh läuft, musst du eines wählen. Ein Modell, das Bilder sehen kann, bekommt zusätzlich bis zu acht neuere, passende Bilder aus Posts und Kommentaren. Ein reines Textmodell, das sie ablehnt, wird ohne die Bilder erneut angefragt.
- **Refreshes/day**: 0 bis 24, Standard **2**. So viele automatische Refreshes laufen pro Tag. 0 schaltet sie aus. Manuelle Refreshes begrenzt der Wert nicht.

### Automatic schedule

Steht **Refreshes/day** über 0, teilt Marinara den Tag in gleich große Fenster und wählt in jedem eine zufällige Uhrzeit. Die geplanten Zeiten stehen samt Zeitzone unter **Automatic schedule**. Klick auf den Stift neben einer künftigen Zeit, um sie auf eine andere Stunde zu verschieben. Vergangene, erledigte und doppelte Zeiten lassen sich nicht wählen.

Automatische Refreshes laufen im Server. Die Noodle-Seite darf also geschlossen sein, Marinara muss aber laufen. Scheitert ein Refresh, zeigt der Zeitplan den Fehler und versucht es später erneut, nach wiederholten Fehlschlägen mit längerer Wartezeit. Fallen mehrere geplante Zeiten aus, holt ein einziger erfolgreicher Refresh sie gemeinsam nach.

## Translation

**Translate posts automatically** (standardmäßig **off**, ab Noodle 1.5.0) zeigt unter jedem Post und jedem Kommentar, den keine deiner Personas geschrieben hat, eine Übersetzung an, ohne dass du bei jedem einzeln auf **Translate** (Übersetzen) klicken musst. Noodle nutzt die Übersetzungs-Standardwerte, die du in einem Chat unter **Translation** (Übersetzung) mit **Save translator defaults** (Übersetzungs-Standardwerte speichern) gespeichert hast. Ohne gespeicherte Standardwerte übersetzt Noodle mit Google Translate ins Englische. Siehe [Nachrichtenübersetzung](../integrations/message-translation.md). Steht ein Text schon in der Zielsprache, erscheint keine zusätzliche Kopie. Eine ausgeblendete Übersetzung bleibt ausgeblendet, und beim Ausschalten stoppt Noodle die noch ausstehenden Übersetzungen.

Übersetzungen bleiben in diesem Browser gespeichert, egal ob sie automatisch entstanden sind oder über **Translate**. Nach einem Refresh, nach dem Verlassen von Noodle oder nach dem Neuladen erscheinen sie wieder. Auf einem anderen Gerät oder in einem Browser mit gelöschten Daten wird neu übersetzt. Auch **Reset Noodle Timeline** (Noodle-Timeline zurücksetzen) verwirft sie.

## Invites

**Invites** (Einladungen) legt fest, welche Charaktere an einem Refresh teilnehmen können.

- **Professor Mari participates**: standardmäßig **on**. Schalte es aus, um Professor Mari aus der Account-Suche auszublenden und sie von neuen Posts, Antworten, Reaktionen, Erwähnungen, der Profilgenerierung und dem Chat-Carryover auszuschließen. Der bisherige Verlauf bleibt erhalten, und beim Wiedereinschalten kehrt ihr Account zurück.
- **Characters to Invite**: ein Suchfeld, das sowohl die Ordnerliste als auch die Charakterliste filtert.
- **Add from Folder**: klappt deine Charakter-Ordner auf. Setz bei einem oder mehreren das Häkchen und klick dann unten auf die Einladen-Schaltfläche. Ihre Beschriftung lautet **Select folders to invite**, wenn nichts angehakt ist, **Selected folder characters are invited**, wenn bereits alle eingeladen sind, und **Invite N characters**, wenn neue dazukommen.
- **Characters**: alle Charaktere deiner Bibliothek. Jede Zeile hat eine Schaltfläche zum Einladen oder Entfernen und einen Status: **Invited**, **Included by folder** oder **Not invited**.

Das Einladen über einen Ordner ist eine einmalige Sammelaktion, keine laufende Synchronisierung. Charaktere, die du später in den Ordner legst, sind nicht automatisch eingeladen.

## Random users

Random users (zufällige Nutzer) sind sechs eingebaute Hintergrund-Accounts, die nicht aus deiner Bibliothek stammen: Thread Countess, Packet Soup, Orbit Notice, Glass Bulletin, Moth Hour und Brine Index. Jeder hat eine kurze Bio.

Einschalten lassen sie sich über die Zeile **Random users** ganz oben in der Liste **Characters** unter **Invites**. Sie ist standardmäßig **off** und zeigt **Ambient fake profiles**, solange sie aus ist, und **Enabled**, wenn sie an ist. Sind sie an, dürfen sie während eines Refreshs posten, liken, reposten, antworten und folgen. Ihnen selbst kann man nie folgen.

Unter **Ambient Profiles** (Hintergrundprofile) auf der Seite **Participants** kannst du diese Identitäten bearbeiten oder einen anderen Satz generieren. Neu würfeln behält Posts und Beziehungen, entfernt aber die Profilbilder.

## Active Accounts

**Active Accounts** (aktive Accounts) legt fest, wie viele infrage kommende Accounts an einem Refresh teilnehmen. Infrage kommen deine eingeladenen Charaktere, über Ordner eingebundene Charaktere und die Random users, falls sie an sind. Deine aktive Persona kommt immer noch obendrauf, ebenso Professor Mari, solange sie teilnimmt.

- **Active selection**, standardmäßig **Random range**: **Random range**, **Exact count** oder **All invited**.
- **Random range** zeigt **Min active** (1 bis 100, Standard 2) und **Max active** (1 bis 100, Standard 5). Jeder Refresh würfelt eine Anzahl dazwischen aus.
- **Exact count** zeigt **Active count** (1 bis 100).
- **All invited**: Jeder infrage kommende Account nimmt teil, ohne Obergrenze.

Noodle wählt die aktiven Accounts aus, bevor es erstmalige Profile vorbereitet. Nur aktive Charaktere ohne generiertes Profil bekommen eine Profilanfrage. Die Anfrage zum Schreiben der Timeline bekommt nur die Charakterkarten der Accounts, die für diesen Refresh ausgewählt wurden.

## Activity

Jedes Feld begrenzt, was ein einzelner Refresh erzeugen darf. Setz ein Feld auf 0, um diese Art von Aktivität abzuschalten.

| Feld | Standard | Bereich |
| --- | --- | --- |
| **Posts** | 8 | 0 bis 100 |
| **Replies** | 12 | 0 bis 200 |
| **Reposts** | 4 | 0 bis 100 |
| **Likes** | 18 | 0 bis 500 |

## Image Generation

In diesem Abschnitt erlaubst du Noodle, an manche Posts KI-generierte Bilder zu hängen. Dafür braucht es ein Bildmodell. Siehe [Unterstützte KI-Anbieter](../connections/providers-reference.md) und [Anbieter für Bildgenerierung und Einrichtung](../media/image-providers.md).

- **Image generation**: standardmäßig **off**. Schalte es ein, damit die KI Post-Bilder erzeugt. Dann erscheinen weitere Bedienelemente.
- **Image width** und **Image height**: 64 bis 4096 Pixel, Standard **1024** mal **1536**.
- **Image generation connection**: standardmäßig **Default image generation connection**. Damit nutzt Noodle das Modell, das unter **Connections** (Verbindungen) als Standard für Bilder markiert ist. Ein Charakter kann sein eigenes nutzen (siehe [Profile und Folgen](noodle.md#profiles-and-following)).
- **Image instructions (sent to your LLM)**: vorbelegter Text, bis zu 4.000 Zeichen. Das Timeline-Modell folgt ihm, wenn es die Bildbeschreibung jedes Posts schreibt. Schreib also Anweisungen, keine Bild-Tags. Für Stil-Tags, die direkt an das Bildmodell gehen, nutzt du ein Stilprofil.
- **Use avatar references**: standardmäßig **on**. Schickt den Avatar oder die Referenzbilder des Charakters an das Bildmodell.
- **Interpret image prompts**: standardmäßig **on**. Ein Textmodell schreibt jeden Bild-Prompt neu und folgt dabei den **Image prompting instructions** (Anweisungen für Bild-Prompts) deines Bildmodells und dem Stiltext deines Stilprofils. Ist es aus, werden die Anweisungen nicht genutzt, und der Stiltext wird unverändert angehängt.
- **Include descriptions**: standardmäßig **on**. Nimmt die geschriebenen Aussehensnotizen des Charakters in den Bild-Prompt auf. Ist **Interpret image prompts** an, arbeitet das Textmodell sie ein, statt sie einfach einzufügen.
- **Images/refresh**: 0 bis 50, Standard **3**. Begrenzt die generierten Post-Bilder für jeden manuellen oder automatischen Refresh.

**Attach gallery images** (standardmäßig **off**) ist ein eigener Schalter, der auch sichtbar bleibt, wenn die Bildgenerierung aus ist. Statt ein neues Bild zu erzeugen, kann ein Post damit ein Bild aus der Galerie des Charakters oder aus einem Chat wiederverwenden, in dem er vorkommt.

Wenn es nicht funktioniert hat: Ist die Bildgenerierung an, aber kein brauchbares Bildmodell vorhanden, wird ein Refresh mit „Choose an image generation connection for Noodle first.“ blockiert. Ein fehlgeschlagenes Bild wird einmal wiederholt. Scheitert es erneut, läuft der Refresh weiter und veröffentlicht einen sauberen reinen Textpost.

Die Vorlage für diese Bild-Prompts heißt **Noodle Post Image**. Bearbeiten kannst du sie unter **Settings → Generations → Image Generation Prompt Overrides**. Deine Bildanweisungen gehen in diese Vorlage ein, und das Ergebnis durchläuft dein Stilprofil. Siehe [Prompt Overrides für Bild und Video](../prompts/prompt-overrides.md) und [Bild-Stilprofile](../media/style-profiles.md). Professor Mari hat keine Charakterkarte, deshalb nutzen ihre Bildposts ihren eingebauten Avatar und ihre Referenzbilder.

## Image Understanding

Dieser Abschnitt legt fest, wie der Timeline-Schreiber Bilder sieht, die schon auf der Timeline sind.

- **Show images to the writer**: standardmäßig **on**. Der Schreiber bekommt bis zu acht neuere Timeline-Bilder, wenn sein Modell Bilder annimmt. Ist es aus, bekommt er keine.
- **Image captioning**: Ein bildfähiges Modell beschreibt die Timeline-Bilder, sodass auch ein reiner Text-Schreiber ihnen folgen kann. Solange du es nicht änderst, folgt es der Einstellung zur Bildbeschreibung des **Generation model**. **Use connection default** kehrt dorthin zurück.
- **Captioning model**: erscheint, wenn die Bildbeschreibung an ist. **Use Noodle generation connection** nutzt das **Generation model**. Wähl ein anderes, wenn dieses Modell keine Bilder sehen kann.

Auch wenn **Show images to the writer** aus ist, schickt die Bildbeschreibung die Timeline-Bilder weiterhin an das Modell für die Bildbeschreibung.

## Timeline Writing

Dieser Abschnitt stellt Tonfall und Gedächtnis des Refresh-Schreibers ein.

- **Enhanced tone & continuity**: standardmäßig **off**. Ist es an, stützt sich die Stimme jedes Accounts stärker auf dessen eigene Personality, Description und Backstory statt auf einen standardmäßig gut gelaunten Ton. Accounts werden ermutigt, im selben Refresh auf Posts der anderen zu reagieren, sie zu zitieren oder mit ihnen zu streiten. Ältere Posts kommen häufiger zur Sprache, bevorzugt solche, die zu aktiven Accounts passen. Die Rückgriff-Anweisung erlaubt Bezüge, statt von ihnen abzuraten. Ausgeschaltet bleiben Ton und Rückgriff exakt so, wie Noodle sie ursprünglich hatte.
- **Use generated character schedules**: standardmäßig **off**. Ist es an, nimmt Noodle für jeden teilnehmenden Charakter den heutigen bereits generierten Conversation-Zeitplan mit auf, sofern vorhanden. Noodle selbst erzeugt oder aktualisiert keine Zeitpläne. Das aktuelle lokale Datum samt Uhrzeit steckt so oder so in jedem Refresh.

### Die Stimme des Schreibers anpassen

Die eingebauten Vorgaben des Schreibers zu Ton und kreativer Freiheit kannst du unter **Settings → Generations → Image Generation Prompt Overrides → Noodle Timeline Voice & Tone** neu schreiben. Der Abschnittstitel sagt „Image“, die Liste enthält aber alle anpassbaren Noodle- und Conversation-Textprompts. Der dort angezeigte Standardtext richtet sich nach **Enhanced tone & continuity**, bis du eigenen Text speicherst. Dann gilt dein Text, unabhängig vom Schalter.

Dieses Override betrifft nur Stimme und Ton. Die Regeln, die einen Refresh gültig halten, etwa welche strukturierten Aktionen erlaubt sind, gelten immer.

## World / Lore

**Lorebook context** (standardmäßig **off**) erlaubt einem Refresh, Lorebook-Einträge zu nutzen. Ist es an, durchsucht jeder Refresh die jüngsten Noodle-Post- und -Antworttexte sowie die Profile der aktiven Charaktere nach Lorebook-Schlüsselwörtern. Passende Einträge gehen als Weltkontext an die Accounts in diesem Refresh. Auslösen können nur Lorebooks, die mit einem aktiven Charakter verknüpft oder als global markiert sind. Für ausgelöste Inhalte gilt pro Refresh ein hartes Budget von 8.192 Tokens.

## Carryover

**Carryover** (Übernahme) schiebt aktuelle Noodle-Aktivität in deine Chats. Ist es an, bekommt der Prompt eines Chats einen Block „Recent Social Media Activity“ darüber, was deine Charaktere auf Noodle getan haben.

- **Carryover to chats**: drei Schalter, alle standardmäßig **off**: **Conversations**, **Roleplays** und **Games**. Schalte die Modi ein, die Noodle-Aktivität bekommen sollen.
- **Carry hours**: 1 bis 720, Standard **48**. So viele Stunden schaut Noodle zurück.
- **Carry items**: 1 bis 50, Standard **8**. So viele Zusammenfassungen kommen höchstens zu einem Chat-Zug dazu.

Das Carryover holt nur Aktivität von Charakteren, die auf Noodle eingeladen sind, plus die aktive Persona des Chats. Eine reine Ordner-Einbindung genügt nicht. Für den gesamten Carryover-Block gilt pro Chat-Generierung ein hartes Budget von 8.192 Tokens. Würde die Anzahl der Einträge es sprengen, behält Marinara die neuesten Zusammenfassungen, die hineinpassen, und zeigt sie in zeitlicher Reihenfolge.

## Reset Noodle

Damit leerst du die Timeline. Deine Accounts und Einstellungen bleiben.

1. Klick auf **Reset Noodle Timeline**.
2. Lies den Dialog: „This removes all posts, replies, likes, reposts, activity digests, and refresh records. Profiles, follows, invites, and settings stay.“
3. Klick zur Bestätigung auf **Reset timeline**.

Gelöscht werden nur Timeline-Inhalte. Accounts, Handles, Bios, Follows, Einladungen und sämtliche Einstellungen bleiben erhalten.

## Noodle mit deinen Chats verbinden

Noodle und Chats können Kontext in zwei Richtungen teilen. Wer das eine einschaltet, schaltet das andere nicht mit ein.

- **Carryover to chats** (in den Noodle-Einstellungen) schickt Noodle-Aktivität in einen Chat. Siehe [Carryover](#carryover).
- **Allow Noodle references** ist ein Schalter pro Chat, der Chat-Aktivität nach Noodle schickt. Du findest ihn in den Einstellungen des jeweiligen Chats in der Nähe von **Connected Chats**. Siehe [Chat Settings im Überblick](../chats/chat-settings.md). Er ist standardmäßig **off**. Seine Beschreibung lautet „Timeline refreshes may include recent messages from this chat, with the chat name, mode, and participants stated in the prompt.“ Läuft in diesem Chat außerdem ein [Conversation-Zeitplan für Charaktere](../conversation/schedules.md), kommen der aktuelle Status und die Aktivität des Charakters in dieser Geschichte dazu, zum Beispiel „currently dnd (At the office)“, begrenzt auf diesen Chat.

Du kannst beides einzeln oder zusammen nutzen.

## Fehlerbehebung

- **Ein Refresh erzeugt nichts**: Wähl ein **Generation model**, lade mindestens einen Charakter ein (oder schalte die Random users ein) und lies den Fehler im Abschnitt **Refresh**.
- **Automatische Refreshes bleiben aus**: Setz **Refreshes/day** über 0, lass Marinara laufen und prüf die geplanten Zeiten samt Zeitzone unter **Automatic schedule**. Zeigt der Zeitplan einen Fehler, behebe das Problem mit dem Konto oder dem Ratenlimit und lass den erneuten Versuch laufen.
- **Posts erwähnen einen aktuellen Chat nicht**: Schalte in diesem Chat **Allow Noodle references** ein und achte darauf, dass der Charakter eingeladen ist. Chat-Kontext ist für die KI eine Orientierung, keine Garantie.
- **Noodle-Aktivität taucht in Chats nicht auf**: Schalte den passenden Modus unter **Carryover to chats** ein und erhöhe **Carry hours**, falls die Aktivität zu alt ist.
- **Posts haben keine Bilder**: Schalte **Image generation** ein, wähl ein funktionierendes Bildmodell und prüf **Images/refresh**.

<a id="settings-and-defaults"></a>

## Einstellungen und Standardwerte

| Einstellung | Standard | Bereich oder Optionen |
| --- | --- | --- |
| **Generation model** | keines | jedes Textmodell (für den Refresh nötig) |
| **Professor Mari participates** | on | on oder off |
| **Refreshes/day** | 2 | 0 bis 24 (0 schaltet automatische Refreshes aus) |
| **Translate posts automatically** | off | on oder off |
| **Active selection** | Random range | Random range, Exact count, All invited |
| **Min active** | 2 | 1 bis 100 (nur bei Random range) |
| **Max active** | 5 | 1 bis 100 (nur bei Random range) |
| **Active count** | entspricht Max active | 1 bis 100 (nur bei Exact count) |
| **Posts** | 8 | 0 bis 100 |
| **Replies** | 12 | 0 bis 200 |
| **Reposts** | 4 | 0 bis 100 |
| **Likes** | 18 | 0 bis 500 |
| **Image generation** | off | on oder off |
| **Image width** | 1024 | 64 bis 4096 |
| **Image height** | 1536 | 64 bis 4096 |
| **Image generation connection** | Default | jedes Bildmodell |
| **Image instructions (sent to your LLM)** | vorbelegter Text | bis zu 4.000 Zeichen |
| **Use avatar references** | on | on oder off |
| **Interpret image prompts** | on | on oder off |
| **Include descriptions** | on | on oder off |
| **Images/refresh** | 3 | 0 bis 50 |
| **Attach gallery images** | off | on oder off |
| **Show images to the writer** | on | on oder off |
| **Image captioning** | folgt dem Generation model | on oder off |
| **Captioning model** | Use Noodle generation connection | jedes Modell, das Bilder sehen kann |
| **Use connection default** | on | on oder off; stellt die Bildbeschreibungs-Einstellung des Generation model wieder her |
| **Lorebook context** | off | on oder off |
| **Enhanced tone & continuity** | off | on oder off |
| **Use generated character schedules** | off | on oder off |
| **Carryover: Conversations** | off | on oder off |
| **Carryover: Roleplays** | off | on oder off |
| **Carryover: Games** | off | on oder off |
| **Carry hours** | 48 | 1 bis 720 |
| **Carry items** | 8 | 1 bis 50 |
| **Allow Noodle references** (pro Chat) | off | on oder off |

## Verwandte Anleitungen

- [Noodle: die Social-Timeline in der App](noodle.md)
- [Chat Settings im Überblick](../chats/chat-settings.md)
- [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md)
- [Unterstützte KI-Anbieter](../connections/providers-reference.md)
