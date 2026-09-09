# Game Mode: Würfel und Fertigkeitsproben

In dieser Anleitung erfährst du, wie das Würfeln im Game Mode von Marinara Engine funktioniert: das Schnellwürfel-Menü, die eigene Würfelnotation und die Grenzen für eigene Würfe. Außerdem geht es darum, wie der Game Master (die KI, die das Spiel leitet) eine Fertigkeitsprobe gegen eine Difficulty Class (DC) abwickelt.

## Würfeln

Die Eingabeleiste in einem Game-Mode-Chat hat eine Würfel-Schaltfläche. Zeig mit der Maus darauf, dann erscheint der Tooltip **Roll dice** (Kurzhinweis beim Draufzeigen). Ein Klick öffnet das Schnellwürfel-Menü.

Das Menü bietet acht Presets für einen Klick:

| Preset | Würfelt |
|---|---|
| d20 | einen 20-seitigen Würfel |
| d6 | einen 6-seitigen Würfel |
| 2d6 | zwei 6-seitige Würfel |
| d10 | einen 10-seitigen Würfel |
| d100 | einen 100-seitigen Würfel |
| d4 | einen 4-seitigen Würfel |
| d8 | einen 8-seitigen Würfel |
| d12 | einen 12-seitigen Würfel |

So kommst du zu einem schnellen Wurf:

1. Öffne die Eingabeleiste in einem Game-Mode-Chat.
2. Klick auf die Würfel-Schaltfläche.
3. Klick auf eines der acht Presets, zum Beispiel **d20**.
4. In der Eingabeleiste erscheint ein kleiner Chip, etwa `🎲 d20`.

Der Wurf geht nicht sofort raus, sondern wandert in die Warteschlange. Zum Entfernen klick auf die Lösch-Schaltfläche am Chip; ihr Tooltip lautet **Clear queued roll**.

Gerechnet wird erst, wenn du die nächste Nachricht abschickst. Die App hängt das Ergebnis als Tag (Schlagwort) ans Ende der Nachricht. Ein einzelner Würfel ohne Bonus sieht so aus:

```
[dice: d20 = 14]
```

Bei mehreren Würfeln oder mit Bonus stehen auch die Einzelwerte dabei:

```
[dice: 3d8+2 = 18 (4, 6, 6 +2)]
```

Der Game Master liest dieses Tag und erzählt passend zum Ergebnis weiter.

Wenn der Game Master in einem Zug mehrmals würfelt, erhält jede Würfelkarte einen eigenen Platz in der Warteschlange. Schließe eine Karte, um die nächste zu sehen. Alle Würfe werden im aktiven Swipe (der alternativen Antwort) dieses Zugs gespeichert und bleiben nach dem Neuladen unter **Logs** (Protokolle) erhalten. Beim Fortsetzen bleiben frühere Würfe bestehen; beim erneuten Generieren entsteht ein eigener Satz für den neuen Swipe.

Der Game Master kann auch in der Erzählung mit `[dice: 3d8+2]` einen Wurf anfordern. Die Engine liefert die tatsächlichen Zahlen und zeigt dieselbe animierte Karte. Das funktioniert auch mit reinen Textverbindungen, einschließlich Claude- und Grok-Abonnements. Es gelten dieselbe Notation und dieselben Grenzen wie im Würfelmenü.

## Eigene Würfelnotation

Im Würfelmenü gibt es zusätzlich ein Textfeld für einen eigenen Wurf. Es versteht die übliche `NdM`-Notation: `N` ist die Anzahl der Würfel, `M` die Zahl der Seiten pro Würfel. Am Ende lässt sich ein Bonus oder ein Abzug anhängen.

Der Platzhalter im Feld zeigt ein Beispiel: `3d8+2`. Das heißt: drei 8-seitige Würfel werfen und 2 zur Summe addieren.

So nutzt du einen eigenen Wurf:

1. Klick auf die Würfel-Schaltfläche, um das Menü zu öffnen.
2. Tipp die Notation ins Textfeld, zum Beispiel `2d6+1`.
3. Drück Enter oder klick auf die kleine Papierflieger-Schaltfläche (senden) neben dem Feld.
4. Der Wurf steht als Chip bereit und wartet auf das Absenden.

Weitere Beispiele zum Ausprobieren:

- `d20` wirft einen 20-seitigen Würfel.
- `4d8-1` wirft vier 8-seitige Würfel und zieht 1 ab.
- `2d6+3` wirft zwei 6-seitige Würfel und addiert 3.

Zwei Grenzen sind fest eingebaut: höchstens 100 Würfel auf einmal und höchstens 1000 Seiten pro Würfel. Verlangst du mehr, lehnt die App den Wurf nicht ab, sondern stutzt ihn auf diese Grenzen zurecht. Entspricht der Text keiner gültigen `NdM`-Notation, scheitert der Wurf und du bekommst eine Fehlermeldung, die das erwartete Format nennt.

## Fertigkeitsproben

Eine Fertigkeitsprobe entscheidet, ob dir etwas Riskantes gelingt – anschleichen, einen Hinweis entdecken oder einen NPC (Nicht-Spieler-Charakter) überzeugen. Du startest eine Probe nicht selbst. Der Game Master fordert sie mitten in seiner Erzählung ein. Die App macht daraus einen animierten d20-Wurf mit einem Ergebnis-Banner.

Eine per Text angeforderte Probe beginnt mit dem Versuch. Die Engine würfelt und sendet dann eine zusätzliche Modellanfrage mit den tatsächlichen Ergebnissen, damit der Game Master den Ausgang noch im selben Zug erzählen kann. So wird auch ein Entwurf korrigiert, der den Ausgang schon vor dem Wurf geraten hat. Die zusätzliche Anfrage sendet den Prompt erneut und verbraucht weitere Eingabe- und Ausgabetokens. Schlägt sie fehl, bleiben die ermittelten Ergebnisse erhalten, ohne einen geratenen oder unvollständigen Ausgang zu speichern.

Bei einer Verbindung mit Unterstützung für das Würfel-Tool kann der Game Master bereits während der Generierung einen echten Wurf erhalten. Die Würfelkarte erscheint, sobald das Tool antwortet; die abgeschlossene Probe übernimmt dieses Ergebnis, ohne erneut zu würfeln. Jede ausgewertete Fertigkeitsprobe erhält ein eigenes Banner nach den wartenden Würfelkarten.

Das Banner nennt die Fertigkeit und die Zielzahl, zum Beispiel **Stealth Check** und daneben **DC 15**. DC steht für Difficulty Class, also den Schwierigkeitsgrad: die Zahl, die dein Wurf erreichen oder übertreffen muss.

### Wie das Ergebnis zustande kommt

Die Probe wirft einen 20-seitigen Würfel und addiert zwei Modifikatoren:

- einen Fertigkeits-Modifikator aus der Fertigkeitsstufe, die das Spiel für den Charakter mitführt. Fehlt für diese Fertigkeit noch eine Stufe, beträgt der Modifikator 0.
- einen Attribut-Modifikator aus dem Attribut, das für diese Fertigkeit zuständig ist.

Würfelwurf plus beide Modifikatoren ergeben das Gesamtergebnis. Erreicht oder übertrifft es die DC, ist die Probe bestanden. Bleibt es darunter, ist sie misslungen. Jede Fertigkeit hängt automatisch an einem zuständigen Attribut. Stealth (Heimlichkeit) nutzt zum Beispiel Dexterity (Geschicklichkeit), Perception (Wahrnehmung) nutzt Wisdom (Weisheit) und Persuasion (Überredung) nutzt Charisma. Kennt die App eine Fertigkeit nicht, greift sie auf Intelligence (Intelligenz) zurück.

### Kritischer Erfolg und kritischer Fehlschlag

Zwei Würfelergebnisse setzen die Rechnung außer Kraft:

- Eine natürliche 20 (der Würfel selbst zeigt 20) ist ein **CRITICAL SUCCESS**. Sie gelingt immer, auch gegen eine hohe DC.
- Eine natürliche 1 (der Würfel selbst zeigt 1) ist ein **CRITICAL FAILURE**. Sie misslingt immer, auch bei großen Modifikatoren.

Das Banner zeigt eines von vier Ergebnissen: **CRITICAL SUCCESS**, **SUCCESS**, **FAILURE** oder **CRITICAL FAILURE**.

### Andere Würfelsysteme

Der Game Master kann eine andere Notation angeben, etwa `[skill_check: skill="Endurance" dc="12" dice="3d6+2"]`. Solche Proben verwenden den festen Modifikator der Notation statt der d20-Modifikatoren des Charakterbogens und gelingen, wenn die Summe den DC erreicht. Die Regeln für eine natürliche 1 und eine natürliche 20 gelten nur für die oben beschriebene Standard-d20-Probe.

Erfolgspools müssen sowohl den Schwellenwert pro Würfel als auch die benötigte Anzahl an Erfolgen angeben: `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]` würfelt sechs d10, zählt jeden Würfel mit mindestens 6 einmal und gelingt ab vier Erfolgen. Die Engine errät keinen fehlenden Schwellenwert und setzt weder explodierende Würfel noch Patzer oder andere besondere Poolregeln um. Ein Pool ohne gültigen Schwellenwert bleibt unaufgelöst; vom Modell erfundene Zahlen werden entfernt.

### Vorteil und Nachteil

Der Game Master kann eine Probe mit Vorteil oder mit Nachteil ansetzen. Beides zusammen kommt bei einer Probe nie vor.

- Mit Vorteil wirft die App zwei 20-seitige Würfel und behält den höheren.
- Mit Nachteil wirft die App zwei Würfel und behält den niedrigeren.

Ist eines von beiden aktiv, zeigt das Banner den Modus neben der DC an und markiert, welchen Würfel es verwendet hat.

### Eigenen Würfel vorab werfen

Du kannst vor der Probe einen eigenen `d20` über das Würfelmenü in die Warteschlange legen. Dann übernimmt die Fertigkeitsprobe deine gewürfelte Zahl, statt neu zu würfeln. Fertigkeits- und Attribut-Modifikator kommen weiterhin obendrauf.

## Verwandte Anleitungen

- [Game Mode: Kampf](combat.md)
- [Game Mode: Erste Schritte](getting-started.md)
- [Game Mode: Party und NPCs](party-and-npcs.md)
