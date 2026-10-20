# Erste Schritte mit Marinara Engine

Willkommen bei Marinara Engine. In dieser Anleitung erfährst du, was die App überhaupt macht, was auf dem Home-Bildschirm zu sehen ist und wie du zum ersten Chat kommst. Sie richtet sich an Neueinsteiger, Vorwissen zur Einrichtung brauchst du also nicht.

## Was Marinara Engine ist

Marinara Engine ist eine lokale App zum Chatten und Rollenspielen mit KI-Charakteren. Sie läuft auf dem eigenen Rechner und wird mit einem KI-Dienst deiner Wahl verbunden. Charaktere erstellst oder importierst du selbst, dann wählst du die Art des Chats und legst los. Eine eigene KI bringt Marinara nicht mit, deshalb steht am Anfang immer eine Verbindung. Die meisten entscheiden sich für einen Online-KI-Anbieter. Es gibt außerdem ein kleines eingebautes **Local Model** (lokales Modell) zum Herunterladen. Für leichte Hilfsaufgaben taugt es gut, für den Haupt-Chat nicht; siehe [Lokales Modell einrichten](../connections/local-model.md). Nach dieser ersten Einrichtung läuft alles direkt in der App.

## Der Home-Bildschirm im Überblick

Den Home-Bildschirm siehst du immer dann, wenn kein Chat geöffnet ist. Er erinnert ein wenig an einen Webbrowser: oben Tabs und Lesezeichen, darunter ein Schreibtisch voller Widgets.

Oben findest du diese Teile:

- **Tabs.** **Home** (Startseite) ist die Hauptseite. **Professor** öffnet Professor Mari, die eingebaute Assistentin, die die App erklärt und bei der Einrichtung hilft. Manche installierten Agenten fügen einen eigenen Tab hinzu.
- **Suchleiste.** Am Computer klickst du auf die Leiste unter den Tabs oder drückst Strg+K (Cmd+K auf dem Mac), um Chats, Charaktere, Einstellungen und mehr zu finden.
- **Lesezeichen.** Schnelllinks zu **Discord**, **Support**, **Credits**, **Documentation** (Dokumentation), **Tutorial**, **FAQ**, **Achievements** (Errungenschaften) und **Widgets**. **Achievements** erscheint nur, wenn die Achievements-Einstellung aktiviert ist. Auf dem Handy tippst du links neben den Tabs auf die Lesezeichen-Schaltfläche, um sie als Liste zu sehen.

In der Mitte siehst du das App-Logo, den Schriftzug **Marinara Engine** und die Versionsnummer. Darunter startet jede der Schaltflächen **Conversation**, **Roleplay** und **Game** einen neuen Chat im jeweiligen Modus.

Beim allerersten Start führt dich eine kurze Tour zu den wichtigsten Schaltflächen und Chat-Modi. Den kompletten Durchlauf beschreibt [Das Tutorial beim ersten Start](tutorial.md).

<a id="home-widgets"></a>

## Home-Widgets

Der restliche Home-Bildschirm besteht aus Widgets: kleinen Karten, die du ein- und ausblenden und verschieben kannst. Diese Widgets bringt die App mit:

| Widget | Was es tut | Anfangs sichtbar |
| --- | --- | --- |
| **Professor Mari** | Klick auf **Ask Professor Mari** (Professor Mari fragen), um ihren Chat zu öffnen. | Ja |
| **Recent chats** (Letzte Chats) | Zeigt deine neuesten Chats mit ihrer letzten Nachricht. Klick auf einen, um ihn wieder zu öffnen. Hast du noch keine, steht dort **Your chats will show here**. | Ja |
| **Learn the engine** (die Engine kennenlernen) | Links zu **Documentation**, **Replay tutorial** (Tutorial wiederholen) und **Read FAQ** (FAQ lesen). | Ja |
| **What's New** (Neuigkeiten) | **See what's new** (Neuigkeiten ansehen) öffnet das Fenster What's New für diese Version erneut, auch wenn du es schon geschlossen hattest. **Read release notes** (Release Notes lesen) öffnet die vollständigen Release Notes im Web. | Ja |
| **Community** | Links zu **Discord**, **Support** und **Credits**. | Ja |
| **Character Library** (Charakterbibliothek) | Jeden Tag eine neue Auswahl deiner Charaktere. | Nein |
| **Discovery desk** (Entdeckungstisch) | Schlägt Agenten vor, die du noch nicht installiert hast. Mit den Pfeilen siehst du weitere, mit **Browse agents** (Agenten durchsuchen) öffnest du den Katalog. | Nein |
| **Character of the Day** (Charakter des Tages) | Ein Charakter aus deiner Bibliothek, mit **Start a chat** (Chat starten) und **View character** (Charakter ansehen). | Nein |
| **Clock & calendar** (Uhr und Kalender) | Das heutige Datum und die Uhrzeit. | Nein |
| **Achievements** | Deine zuletzt freigeschalteten und deine fast erreichten Errungenschaften. Nur verfügbar, wenn die Achievements-Einstellung aktiviert ist. | Nein |

Manche installierten Agenten fügen ebenfalls Widgets hinzu. Professor Mari kann dir außerdem ein persönliches Widget bauen, wenn du sie darum bittest.

Um deine Widgets auszuwählen, klick in den Lesezeichen auf **Widgets**. Das Fenster **Home Widgets** (Home-Widgets) listet sie unter **Built-in** (eingebaut), **Agents** (Agenten) und **Personal** (persönlich) auf. Klick auf die Augen-Schaltfläche neben einem Widget, um es ein- oder auszublenden. Ein wieder eingeblendetes Widget kommt an den ersten freien Platz auf Home. Persönliche Widgets haben außerdem Schaltflächen zum Bearbeiten und Löschen.

Um ein Widget zu verschieben, ziehst du den Griff in seiner oberen rechten Ecke. Am Computer erscheint der Griff, wenn du auf das Widget zeigst. Mit der Tastatur fokussierst du den Griff und nutzt die Pfeiltasten. Deine Widget-Anordnung wird in diesem Browser gespeichert.

Unten im Fenster **Home Widgets** hat **Browser chrome** (Browser-Rahmen) drei Schalter: **Show URL bar** (URL-Leiste anzeigen) blendet die Suchleiste ein oder aus, und **Other-tab bookmarks (desktop)** und **Other-tab bookmarks (mobile)** lassen die Lesezeichen auch auf anderen Tabs als **Home** sichtbar.

## Deine ersten Schritte

Arbeite diese Schritte der Reihe nach ab, dann steht der erste Chat.

1. Installiere Marinara Engine und öffne die App im Browser. Deine Plattform findest du unter [Marinara Engine installieren](../INSTALLATION.md).
2. Lege eine Verbindung an, damit die App einen KI-Dienst erreicht. Eine Verbindung speichert Anbieter, API-Key und Modell. Ein API-Key ist ein geheimer Zugangscode, ähnlich einem Passwort, den du beim KI-Anbieter bekommst. Siehe [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md).
3. Erstelle oder importiere einen Charakter zum Chatten. Öffne das Panel **Characters** (Charaktere) und klick auf **New** (Neu), um das Fenster **Create Character** (Charakter erstellen) zu öffnen. Über **Import** holst du stattdessen eine Charakterkarte aus einer Datei herein. Siehe [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md).
4. Starte einen Chat. Wähle in der Chat-Seitenleiste einen Modus-Tab und klick dann auf die Schaltfläche **+**. Passend zum Tab heißt sie **New Conversation**, **New Roleplay** oder **New Game**. Der neue Chat öffnet sich mit einem Einrichtungsfenster, das dich durch den Rest führt. Ist noch keine Verbindung gespeichert, erscheint zuerst ein Fenster **Set Up Conversation**, **Set Up Roleplay** oder **Set Up Game**. Wähle dort die Verbindung aus und klick auf **Create Chat** (Chat erstellen).

Wenn du bei einem Schritt hängen bleibst, frag die eingebaute Assistentin. Was sie alles kann, steht in [Professor Mari, deine Assistentin in der App](professor-mari.md).

## Die drei Chat-Modi

Marinara hat drei Chat-Modi. Beim Anlegen eines neuen Chats wählst du einen davon aus.

- **Conversation**: ein schlichter, direkter KI-Chat ohne Rollenspiel, aufgemacht wie ein Messenger. Siehe [Conversation Mode: Erste Schritte](../conversation/getting-started.md).
- **Roleplay**: dichtes Rollenspiel mit Charakteren, Szenenverfolgung und Weltzustand. Siehe [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md).
- **Game**: ein Einzelspieler-Rollenspiel, das eine KI als Game Master (GM) leitet, mit Party, Würfeln, Karten und Quests. Siehe [Game Mode: Erste Schritte](../game/getting-started.md).

## Wo du Hilfe bekommst

Hilfe findest du an mehreren Stellen, ganz ohne die App zu verlassen:

- Frag **Professor Mari** auf dem Home-Bildschirm nach Unterstützung bei der Einrichtung und nach Antworten auf Wie-geht-das-Fragen.
- Lies die **FAQ** auf dem Home-Bildschirm, dort stehen schnelle Antworten auf häufige Fragen.
- Öffne die Anleitungen in der App über das Lesezeichen **Documentation** auf dem Home-Bildschirm.
- Klick auf das Lesezeichen **Discord**, um zur Community zu kommen, oder auf **Support**, um das Projekt zu unterstützen.

Wenn etwas kaputt ist oder nicht funktioniert, hilft [Fehlerbehebung in Marinara Engine](../TROUBLESHOOTING.md) weiter.

## Verwandte Anleitungen

- [Marinara Engine installieren](../INSTALLATION.md)
- [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md)
- [Charaktere anlegen und bearbeiten](../characters/creating-and-editing-characters.md)
- [Das Tutorial beim ersten Start](tutorial.md)
- [Professor Mari, deine Assistentin in der App](professor-mari.md)
- [Conversation Mode: Erste Schritte](../conversation/getting-started.md)
- [Roleplay Mode: Erste Schritte](../roleplay/getting-started.md)
- [Game Mode: Erste Schritte](../game/getting-started.md)
