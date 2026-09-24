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

Es gelten zwei feste Grenzen. Du kannst höchstens 100 Würfel gleichzeitig werfen, und jeder Würfel darf maximal 1000 Seiten haben. Forderst du mehr an, begrenzt die App die Anfrage, statt sie abzulehnen. Die Ergebniskarte zeigt die begrenzte Notation: Aus `500d6` wird eine `100d6`-Karte für die hundert tatsächlich geworfenen Würfel. Ist dein Text keine gültige Würfelnotation, also `NdM` oder ein einzelnes `dM` wie `d20`, schlägt der Wurf fehl und eine Fehlermeldung nennt das erwartete Format.

## Fertigkeitsproben

Eine Fertigkeitsprobe entscheidet, ob dir etwas Riskantes gelingt – anschleichen, einen Hinweis entdecken oder einen NPC (Nicht-Spieler-Charakter) überzeugen. Du startest eine Probe nicht selbst. Der Game Master fordert sie mitten in seiner Erzählung ein. Die App macht daraus einen animierten d20-Wurf mit einem Ergebnis-Banner.

Eine im Text angeforderte Probe beginnt mit dem Versuch. Die Engine würfelt und stellt dann eine zusätzliche Modellanfrage mit den tatsächlichen Ergebnissen, damit der Game Master den Ausgang in derselben Runde abschließen kann. Das korrigiert auch einen Entwurf, der vor dem Wurf ein Ergebnis geraten hat. Die zusätzliche Anfrage sendet den Prompt erneut und verbraucht weitere Eingabe- und Ausgabe-Tokens. Scheitert sie, behält die Runde die gewürfelten Ergebnisse im Protokoll, ohne einen geratenen oder unvollständigen Ausgang zu speichern. Ein Hinweis mit der Schaltfläche **Regenerate turn** (Runde neu generieren) bleibt an der Runde sichtbar, auch nach dem Neuladen des Chats.

Deaktiviere **Narrate dice outcomes immediately** (Würfelergebnisse sofort erzählen) unter **Chat Settings → Function Calling**, um die tatsächlichen Ergebnisse ohne diese zusätzliche Anfrage für die nächste Runde aufzubewahren. Die Einstellung ist standardmäßig aktiviert. Anfragen, bei denen kein tatsächlicher Wurf stattfindet, lösen niemals die zusätzliche Erzählanfrage aus.

Eine dritte Möglichkeit behält den Ausgang im selben Zug, ohne zweite Anfrage. Siehe unten [Einen gewürfelten Zug mit einer Anfrage abschließen](#finishing-a-rolled-turn-in-one-request).

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

Dieser Pool gilt unverändert für Spiele **ohne Regelsatz**. Ein Spiel mit einem Würfelpool-Regelsatz folgt dagegen den Regeln, die die Engine tatsächlich umsetzt; siehe unten [Spiele mit einem Regelsatz](#games-that-use-a-ruleset).

Nicht unterstützte Anfragen wie `4d6kh3`, `3d6!` oder `4dF` werden nicht gewürfelt. Die Engine protokolliert die nicht unterstützte Notation und entfernt erfundene Zahlen aus Probenaufzeichnungen. Diese Ausgänge bleiben offen; die Engine ersetzt nicht stillschweigend das Würfelsystem.

### Vorteil und Nachteil

Der Game Master kann eine Probe mit Vorteil oder mit Nachteil ansetzen. Beides zusammen kommt bei einer Probe nie vor.

- Mit Vorteil wirft die App zwei 20-seitige Würfel und behält den höheren.
- Mit Nachteil wirft die App zwei Würfel und behält den niedrigeren.

Fordert der Game Master beides zugleich an, lässt die App diese Probe unverändert, statt die Absicht zu erraten. Dafür erscheint dann kein Banner.

Ist eines von beiden aktiv, zeigt das Banner den Modus neben der DC an und markiert, welchen Würfel es verwendet hat.

### Eigenen Würfel vorab werfen

Du kannst vor der Probe einen eigenen `d20` über das Würfelmenü in die Warteschlange legen. Dann übernimmt die Fertigkeitsprobe deine gewürfelte Zahl, statt neu zu würfeln. Fertigkeits- und Attribut-Modifikator kommen weiterhin obendrauf.

<a id="games-that-use-a-ruleset"></a>

## Spiele mit einem Regelsatz

Wähle den Regelsatz beim Anlegen des Spiels unter **Rules**; siehe [Regeln auswählen](getting-started.md#choosing-rules). Ohne Regelsatz gelten die oben beschriebenen Regeln, einschließlich einfacher Erfolgspools ohne explodierende Würfel oder andere Sonderregeln.

- Der GM nennt Fertigkeit oder Rettungswurf und eine Schwierigkeit aus der Skala des Regelsatzes. Diese darf über 1–40 hinausgehen; der Ersatzweg für eine ausstehende Probe in einer gespeicherten Runde bleibt auf 1–40 begrenzt.
- Die Engine würfelt mit den vorgesehenen Würfeln. Der Modifikator stammt aus dem Regelsatzbogen: Attribut, Ausbildung (Vielfaches des Übungsbonus, fester Wert oder beides) und Zusatzbonus. Die eingebauten Attribute und Fertigkeitsboni werden nicht verwendet.
- `who="Name"` wählt ein Gruppenmitglied; ohne `who` ist der Spieler gemeint. Mitglieder ohne Bogen verwenden Standardwerte. Unbekannte oder mehrdeutige Namen ergeben einen Wurf ohne Modifikator. Der Name der Persona bezeichnet immer den Spieler, auch bei Namensgleichheit mit einem Gruppenmitglied. Ein fremder Bogen wird nie ersatzweise verwendet.
- Natürliche Ergebnisse folgen dem Regelsatz. Bei 5e (SRD 5.1) haben natürliche 20 und 1 bei Proben und Rettungswürfen keine Sonderwirkung; auch eine 20 kann scheitern.
- Vom GM eingetragene Zahlen werden geprüft. Falsche Modifikatoren, Würfelzahlen, Würfeltypen, ausgewählte Würfel oder nicht unterstützte natürliche Ergebnisse werden durch einen neuen Wurf ersetzt.
- Ein vorheriger eigener Wurf wird nur für eine einzelne d20 übernommen. Andere Würfel, etwa 2d6 oder Pools, werden neu gewürfelt.
- `with="Ability"` erlaubt ein anderes vom Regelsatz definiertes Attribut; unbekannte Attribute werden ignoriert. Würfelplatzhalter können Attribute, Fertigkeiten, Rettungswürfe und `PROF` nennen, sofern der Regelsatz einen Übungsbonus hat.
- Ein fehlendes oder zu altes Paket lässt die Probe ohne Zahlen ausstehend. Die Engine wechselt nicht heimlich das Regelsystem. Ressourcen, Zustände und Rasten beschreibt [Der Regelsatzbogen](party-and-npcs.md#the-ruleset-sheet).

- Verändert etwas auf deinem Bogen einen Wurf, etwa ein Talisman zum Wiederholen misslungener Würfel, nennt der Game Master es an der Probe. Die Engine bezahlt dessen Kosten, wendet seine Wirkung an und würfelt. Ein nicht gewählter oder unbezahlbarer Talisman wirkt nicht und kostet nichts.
- Erlaubt der Regelsatz Ressourcenausgaben zur Verbesserung einer Probe, nennt der Game Master sie an der Probe. Die Engine zieht die Punkte ab, ergänzt die erkaufte Wirkung und würfelt. Reicht der Pool nicht, wird nichts ausgegeben und normal gewürfelt. Das Protokoll nennt die tatsächliche Zahlung, nicht die angeforderte.
- Hat der Regelsatz eine Wundleiste mit Probenabzug, erschweren Verletzungen jede Probe. Ein Pool-Regelsatz entfernt entsprechend viele Würfel, aber nie unter seinen kleinsten erlaubten Pool, der in manchen Systemen null ist. Bei einem summierenden Regelsatz gilt ein fester Abzug auf den Wurf. Die Probe nennt dessen Höhe, damit du weniger Würfel nachvollziehen kannst. Siehe [Der Regelsatzbogen](party-and-npcs.md#the-ruleset-sheet).

### Regelsätze mit Würfelpools

Hier bestimmt der Bogenwert die Zahl der Würfel: Attribut 3 plus Fertigkeit 2 ergibt fünf Würfel. Editor und GM-Kontext zeigen "5 dice" statt "+5". Die Schwierigkeit zählt benötigte Erfolge, etwa drei, statt einer Summe von 15.

Der Regelsatz bestimmt Erfolgsschwellen, doppelte Erfolge, explodierende Würfel, durch niedrige Ergebnisse gestrichene Erfolge, Patzer und außergewöhnliche Erfolge. Die Ergebniskarte zeigt alle Würfel, hebt Erfolge hervor und vergleicht deren Anzahl mit dem Ziel. Große Pools umbrechen in weitere Zeilen, ohne die Würfel zu verkleinern oder eine erfundene Summe anzuzeigen.

Der GM darf die Schwelle pro Würfel oder die Poolgröße nur innerhalb der Regelsatzgrenzen ändern. Vom Modell erfundene Poolergebnisse werden immer neu gewürfelt. Vorteil, vorherige eigene Würfe und die dem GM vorab gezeigten d20 gelten hier nicht; der Pool wird ohne Vorschau gewürfelt.

<a id="finishing-a-rolled-turn-in-one-request"></a>

## Einen gewürfelten Zug mit einer Anfrage abschließen

Ein Zug mit Würfelwurf kostet standardmäßig zwei Modellanfragen: eine für den Entwurf und eine zum Umschreiben mit den tatsächlichen Zahlen. **Finish rolled turns in one request** (gewürfelte Züge mit einer Anfrage abschließen) unter **Chat Settings → Function Calling** entfernt die zweite. Die Option ist standardmäßig aus und gilt nur für den Chat, in dem du sie aktivierst.

Der Game Master legt dabei seinen Text fest, bevor irgendeine Zahl vorliegt. Er sieht keinen Wurf, bevor er über den Ausgang entscheidet, und kann den Ausgang deshalb nicht an einen erhaltenen Würfelwert anpassen. Die Engine würfelt anschließend; ihr Protokoll wird gespeichert.

Bei aktivierter Option soll der Game Master je nach Art des Ergebnisses eine von drei Formen wählen.

**Bei zwei möglichen Ausgängen schreibt er beide.** Auf die Probe ohne Zahlen folgt ein Block mit Erfolgs- und Fehlschlagtext. Die Engine würfelt, behält die passende Hälfte und entfernt die andere, bevor du den Zug liest. Sichtbar ist genau ein Ausgang, als wäre zuerst gewürfelt worden.

**Ist das Ergebnis nur eine Zahl, schreibt er einen Platzhalter und fährt fort.** Für Schaden, Heilung, Gold, Dauer, Anzahl oder Entfernung setzt er `[[roll: 2d6+3]]` mitten in den Satz; die Engine ersetzt es durch das Ergebnis. Ein Platzhalter kann einen Bogenmodifikator statt eines festen Werts nennen, etwa `[[roll: 1d8+STR]]`; die Engine addiert ihn selbst. Diese Form wird nur angeboten, wenn das Spiel tatsächlich einen lesbaren Bogen hat. Unbekannte Namen werden abgelehnt, nicht als null behandelt. Zeig auf eine ersetzte Zahl, um die Würfel dahinter zu sehen. Jeder Wurf steht außerdem einzeln in **Logs** (Protokolle).

**Wählt die Zahl selbst zwischen mindestens drei Ausgängen, fragt er nach dem Wert und hält an.** Das ist dieselbe knappe Probe oder `[dice:]`-Anfrage wie bisher. Die Engine würfelt und protokolliert; der Zug endet ohne erzählten Ausgang. Der Game Master erzählt dessen Bedeutung zu Beginn des nächsten Zuges, genau wie bei ausgeschaltetem **Narrate dice outcomes immediately** (Würfelergebnisse sofort erzählen).

Eine Probe außerhalb dieser Formen fällt auf dasselbe Verhalten zurück; nichts bleibt ungewürfelt und nichts wird erfunden.

Vor dem Einschalten solltest du Folgendes wissen:

- **Narrate dice outcomes immediately wird währenddessen nicht verwendet.** Die Option bleibt sichtbar, aber mit erklärendem Hinweis deaktiviert. Ihr gespeicherter Wert bleibt erhalten; nach Ausschalten der Ein-Anfrage-Würfe gilt die bisherige Einstellung wieder.
- **Bestehende Züge ändern sich nicht.** Die Option betrifft nur anschließend erzeugte Züge; gespeicherte Verläufe bleiben unverändert.
- **In zwei Fällen kann ein Zug weiterhin mehrere Anfragen kosten.** Bei **Enable Tool Use** (Tool-Nutzung aktivieren) und einem Würfel-Tool in der Tool-Liste kann der Game Master es weiterhin aufrufen; das kostet eine vollständige Zusatzrunde. Eine **Game tool connection** (Game-Tool-Verbindung) ungleich **Same as narrator** (wie der Erzähler) stellt stets eine eigene Planungsanfrage. Beides ist nicht die Ergebnisumschreibung, die dieser Schalter entfernt.
- **Nicht mögliche Würfe werden gemeldet.** Eine unlesbare Zahl wird durch einen kurzen Hinweis statt eines erfundenen Werts ersetzt. Bei einem unlesbaren Zweig bleibt der protokollierte Wurf erhalten, beide Texte werden entfernt. In **Logs** steht jeweils, was ausgelassen wurde.
- **Während des Schreibens** bleiben Platzhalter und Zweigblöcke aus dem Streaming-Text ausgeblendet; du siehst keine Zahl auftauchen und später wechseln. Der fertige Satz erscheint nach Abschluss des Zuges.

### Dem Game Master einen Würfel jeder Größe zeigen

Darunter steht **Let the Game Master see one die of each size** (dem Game Master einen Würfel jeder Größe zeigen), ebenfalls standardmäßig aus. Die Option dient dem Fall, den die beiden blinden Formen nicht abdecken: Die Zahl selbst wählt zwischen mindestens drei Ausgängen, etwa Erfolgsspanne, Trefferzonentabelle oder Reaktionswurf. Ohne sie endet eine solche Probe den Zug; die Erzählung folgt am Anfang des nächsten.

Bei aktivierter Option würfelt die Engine vor dem Zug einen Würfel jeder Standardgröße und zeigt dem Game Master den jeweils nächsten Wert. Er kann einen davon verbrauchen und dessen Bedeutung im selben Durchlauf erzählen.

**Diese Abwägung solltest du genau lesen.** Der Game Master sieht die Zahl, bevor er die Probe und ihre Schwierigkeit festlegt. Dadurch kann er den Ausgang beeinflussen, was die blinden Formen verhindern: Er kann eine mit dem bekannten Wert erreichbare Schwierigkeit wählen oder bei einem schlechten Wert ganz auf die Probe verzichten. Die Engine kann nicht beurteilen, welche Schwierigkeit zur Geschichte passt, und das daher nicht erkennen. Wer nicht weiß, dass der Game Master die Würfel gesehen hat, hält einen auffällig heldenhaften Verlauf womöglich für Glück.

Folgendes erzwingt die Engine unabhängig von der Mitarbeit des Game Masters:

- **Werte werden der Reihe nach und jeweils nur einmal ausgegeben.** Die Engine verwaltet die Warteschlange und gibt den nächsten Wert aus, unabhängig vom Text des Zuges.
- **Jede protokollierte Zahl stammt von der Engine.** Wurf, Modifikator, Summe und Ergebnis werden aus Warteschlange und Charakterbogen neu berechnet. Abweichende Modellzahlen werden ersetzt und in **Logs** vermerkt.
- **Die Schwierigkeit ist begrenzt.** Sie bleibt zwischen 1 und 40, was für geschriebene Proben zuvor nicht galt. Ein Spiel mit Regelsatz darf stattdessen dessen Schwierigkeitsskala ausschöpfen.
- **Erneutes Fragen verbessert das Glück nicht.** Swipe, Neugenerierung und Fortsetzung desselben Zuges erhalten dieselben Werte; wiederholtes Würfeln bis zum guten Ergebnis ist so nicht möglich.
- **Nur der nächste Wert jeder Größe ist sichtbar.** Das steuert **Values shown per size** (angezeigte Werte je Größe), standardmäßig 1. Weitere Würfe derselben Größe innerhalb eines Zuges bleiben ungesehen und werden erst im nächsten Zug erzählt.
- **Ein ungenutzter Würfel wird nach einiger Zeit neu geworfen.** Das steuert **Rethrow after idle turns** (nach ungenutzten Zügen neu würfeln), standardmäßig 3. Sonst könnte ein niedriger Wert für den gesamten Chat vorne liegen bleiben, während der Game Master diese Größe meidet. 0 schaltet das Neuwürfeln aus und erlaubt genau dieses Verhalten wieder.
- **Eine Anfrage über den Vorrat hinaus erzeugt keinen Wurf.** Die Probe behält ihre Frage, verliert alle Zahlen und wird im nächsten Zug erzählt. **Logs** nennt den betroffenen Zug.

## Verwandte Anleitungen

- [Game Mode: Kampf](combat.md)
- [Game Mode: Erste Schritte](getting-started.md)
- [Game Mode: Party und NPCs](party-and-npcs.md)
