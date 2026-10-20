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

Ein Spiel kann statt Marinaras eigener Regeln einen Regelsatz verwenden, etwa 5e (SRD 5.1). Der Regelsatz gehört zu diesem einen Spiel und bleibt bei ihm. Du wählst ihn beim Anlegen des Spiels im Einrichtungsassistenten unter **Rules** (Regeln) aus (siehe [Regeln auswählen](getting-started.md#choosing-rules)). Ein Spiel ohne Regelsatz verhält sich genau wie oben beschrieben.

Hat ein Spiel einen Regelsatz, gilt Folgendes:

- Der Game Master nennt weiterhin nur die Fertigkeit oder den Rettungswurf und legt eine Schwierigkeit fest. Statt der eingebauten Skala bekommt er die Schwierigkeitsskala des Regelsatzes mitgeteilt. Eine Schwierigkeit darf so weit reichen wie diese Skala, auch über die 1 bis 40 hinaus, die Marinaras eigene Regeln erlauben. Ein Weg bleibt auch in einem Regelsatz-Spiel bei 1 bis 40: der Ersatzweg, der eine Probe würfelt, die eine gespeicherte Runde noch schuldet.
- Die Engine würfelt mit den Würfeln des Regelsatzes und addiert den Modifikator aus dem **Regelsatzbogen** des Charakters. Er besteht aus den Teilen, die der Regelsatz deklariert: dem Attributsmodifikator, wenn die Fertigkeit oder der Rettungswurf ein Attribut nennt, dem Bonus für die Ausbildungsstufe (ein Vielfaches eines Übungsbonus, ein fester Wert oder beides) und einem Zusatzbonus, der auf dem Bogen eingetragen ist. Die eingebauten Fertigkeitsboni und Attribute werden nicht verwendet.
- Eine Probe kann einem Partymitglied gelten. Der Game Master ergänzt das Tag um `who="Name"`, und die Engine nimmt den Bogen dieses Charakters. Ohne `who` würfelt der Spieler. Ein Partymitglied, das noch keinen Bogen hat, würfelt auf einem leeren Bogen, auf dem jeder Wert dem Standard des Regelsatzes entspricht. Ein Name, der zu niemandem in der Party passt oder den zwei Partymitglieder teilen, würfelt ganz ohne Modifikator. Die einzige Ausnahme ist der Name deines eigenen Charakters: Trägt ein Partymitglied denselben Namen, meint dieser Name trotzdem dich und nutzt deinen Bogen. Die Engine leiht sich nie den Bogen eines anderen.
- Natürliche Ergebnisse folgen dem Regelsatz. Unter 5e (SRD 5.1) hat eine natürliche 20 oder 1 bei Proben und Rettungswürfen keine besondere Wirkung. Eine natürliche 20, die die Schwierigkeit verfehlt, scheitert also. Das weicht absichtlich von Marinaras eigenen Regeln ab.
- Zahlen, die der Game Master selbst schreibt, gelten nicht als verlässlich. Ein Tag, das fertig aussieht, wird neu gewürfelt und ersetzt, wenn sein Modifikator nicht der vom Bogen ist, wenn es eine andere Anzahl oder Größe von Würfeln geworfen hat als der Regelsatz, wenn der gezählte Würfel nicht der ist, den sein Wurfmodus behält, oder wenn es ein natürliches Ergebnis behauptet, das der Regelsatz nicht kennt.
- Einen Würfel, den du vor der Probe selbst geworfen hast, nutzt die Engine nur, wenn der Regelsatz einen einzelnen d20 würfelt. Ein Regelsatz mit anderen Würfeln, etwa 2d6 oder einem Pool, ignoriert ihn und würfelt normal.
- Der Game Master kann eine Fertigkeit oder einen Rettungswurf mit einem anderen Attribut als dem üblichen würfeln lassen, indem er dem Tag `with="Ability"` hinzufügt. Es zählt nur ein Attribut, das dein Regelsatz deklariert. Alles andere wird ignoriert, und die Fertigkeit behält ihr eigenes.
- Der Game Master kann statt einer Zahl eine Stufe der Schwierigkeitsskala nennen, etwa `difficulty="Hard"`. Die Engine würfelt gegen die Zahl dieser Stufe, und die gespeicherte Probe zeigt die Zahl. Ein Name, den die Skala nicht kennt, wird ignoriert.
- Würfelplatzhalter können die Attribute, Fertigkeiten und Rettungswürfe des Regelsatzes nennen, und `PROF` für den Übungsbonus, wenn der Regelsatz einen hat.
- Fehlt das Paket des Regelsatzes oder ist es älter als das, mit dem das Spiel erstellt wurde, werden Proben ohne Zahlen gespeichert und bleiben ausstehend. Sie werden nie mit den Regeln eines anderen Systems gewürfelt.
- Verändert etwas auf deinem Bogen einen Wurf, etwa ein Talisman, der misslungene Würfel neu wirft, nennt der Game Master es an der Probe, und die Engine erledigt den Rest: Sie zieht die Kosten des Talismans ab, wendet seine Wirkung an und würfelt. Ein Talisman, den du nicht gewählt hast oder nicht bezahlen kannst, wirkt nicht und kostet nichts.
- Erlaubt der Regelsatz, eine Ressource auszugeben, um einen Wurf abzusichern, sagt der Game Master das direkt an der Probe, und die Engine erledigt beides auf einmal: Sie zieht die Punkte ab, ergänzt, was damit gekauft wurde, und würfelt. Reicht der Pool nicht, wird nichts ausgegeben, und der Wurf bleibt so, wie er ohnehin gewesen wäre. Das Protokoll zeigt, was tatsächlich bezahlt wurde, nicht, was angefordert war. Wie viel eine Probe kaufen darf, legt der Regelsatz fest: eine feste Zahl, eine Zahl auf deinem Bogen oder so viel, wie die Probe Würfel hat.
- Sagt der Regelsatz, dass eine Zahl auf deinem Bogen bei bestimmten Würfen mitläuft, etwa schweres Gepäck bei jedem Brawn-Wurf, addiert die Engine sie zu jeder Probe, für die sie gilt. Die Würfelkarte nennt, was der Bogen hinzugefügt hat.
- Ein Regelsatz kann festlegen, was bei einer Probe passiert, wenn du in der Fertigkeit keine Ausbildung hast: Sie kann dich Würfel oder Punkte kosten, eine Stufe schwerer sein oder gar nicht möglich sein. Eine Probe, die du ohne Ausbildung nicht versuchen kannst, wird nicht gewürfelt, und die Erzählung sagt das, statt ein Ergebnis zu zeigen. Dein Bogen zeigt für eine solche Fertigkeit keine Zahl, bis du sie erlernst.
- Hat der Regelsatz eine Wundleiste und sagt, dass ihr Abzug für Würfe gilt, erschweren Verletzungen jede Probe. Unter einem Pool-Regelsatz nimmt der Abzug entsprechend viele Würfel aus dem Pool, aber nie unter den kleinsten Pool, den dieser Regelsatz erlaubt; manche Systeme setzen ihn auf null. Unter einem Regelsatz, der Würfel addiert, ist er ein fester Abzug auf den Wurf. In beiden Fällen nennt die Probe, wie viel abgezogen wurde, damit du siehst, warum du weniger Würfel geworfen hast. Siehe [Der Regelsatzbogen](party-and-npcs.md#the-ruleset-sheet).
- Der Game Master hält außerdem Ressourcen, Zustände und Rasten jedes Charakters auf dem Bogen aktuell, und die Engine lehnt eine Änderung ab, die der Bogen nicht erlaubt. Siehe [Der Regelsatzbogen](party-and-npcs.md#the-ruleset-sheet).

### Regelsätze mit Würfelpools

Manche Systeme addieren keinen Bonus zum Wurf. Stattdessen gibt die Zahl auf dem Bogen an, wie viele Würfel du wirfst, und du zählst die, die hoch genug ausfallen. Ein Regelsatz kann so geschrieben sein, und ein Spiel damit verhält sich etwas anders:

- **Die Zahl auf dem Bogen steht für Würfel.** Ein Wert von 3 und ein Beruf mit 2 ergeben fünf Würfel. Dein Bogen zeigt das als „5 dice“ statt „+5“, im Editor und in dem, was der Game Master liest.
- **Die Schwierigkeit ist eine Anzahl von Erfolgen.** Eine schwere Aufgabe verlangt drei Erfolge, nicht eine Summe von 15. Die Schwierigkeitsskala des Regelsatzes sagt, wie viele jede Stufe braucht.
- **Die Engine wirft die Würfel und zählt sie.** Welche Augenzahlen zählen, ob eine hohe Augenzahl einen weiteren Würfel wirft oder doppelt zählt, ob niedrige Augenzahlen Erfolge aufheben und was als Patzer oder als herausragender Erfolg gilt, all das kommt aus dem Regelsatz. Die Würfelkarte zeigt jeden geworfenen Würfel, hebt die, die das Ziel erreicht haben, von den übrigen ab und nennt, wie viele Erfolge gefallen sind und wie viele die Probe brauchte. Ein großer Pool bricht in weitere Zeilen um, statt zu schrumpfen, und die Karte zeigt nie eine Summe, zu der die Würfel gar nicht addiert wurden.
- **Der Game Master kann eine einzelne Probe anpassen**, wenn der Regelsatz es erlaubt: ein höheres oder niedrigeres Ziel pro Würfel, Würfel, die je nach Umständen hinzukommen oder wegfallen, und eine niedrigere Augenzahl, ab der Würfel neu geworfen werden oder doppelt zählen. Alles bleibt in dem Bereich, den der Regelsatz deklariert. Eine Stufe der Schwierigkeitsskala kann ihr eigenes Ziel pro Würfel haben, das gilt, wenn der Game Master diese Stufe wählt. Die Würfelkarte sagt es, wenn eine Probe bei einer anderen als der üblichen Augenzahl des Regelsatzes neu geworfen oder doppelt gezählt hat.
- **Würfel können neu geworfen werden**, wenn der Regelsatz eine Regel dafür hat: Der Game Master nennt sie an der Probe, wenn die Lage es verlangt, und die niedrig gefallenen Würfel werden neu geworfen, einmal oder so lange, bis sie höher ausfallen. Eine Ressource, die du ausgibst, kann dasselbe kaufen. Ein Wurf wird nur auf eine Art neu geworfen; würden zwei gelten, zählt die, die mehr Würfel erfasst.
- **Zwei Attribute können zusammen gewürfelt werden**, wenn der Regelsatz es vorsieht: Eine Attributsprobe kann die Würfel eines zweiten Attributs hinzunehmen, sodass zwei Werte als ein Pool geworfen werden.
- **Bei manchen Regelsätzen kann neben dem Ergebnis etwas schiefgehen.** In einem Regelsatz, der niedrige Augenzahlen auf mindestens der Hälfte der Würfel als Patzer zählt, behält eine Probe, die trotzdem ihre Erfolge erreicht hat, ihr Ergebnis, und die Würfelkarte ergänzt, dass daneben etwas schiefgegangen ist. Ganz ohne Erfolge ist es ein kritischer Fehlschlag.
- **Der Game Master liefert nie die Zahlen.** Ein Poolergebnis, das in der Erzählung steht, wird immer durch den eigenen Wurf der Engine ersetzt. Vorteil gilt nicht, ebenso wenig ein Würfel, den du vor der Probe selbst geworfen hast.
- **Dem Game Master einen Würfel jeder Größe zu zeigen, gilt für diese Proben nicht.** Die Würfel, die er sieht, sind zwanzigseitig. Eine Poolprobe würfelt die Engine blind, und sie wird wie jeder andere blinde Wurf erzählt.

### Weitere Würfelarten eines Regelsatzes

Ein Regelsatz kann seine Proben auch auf andere Arten würfeln. Die Engine wirft weiterhin die Würfel, und die Würfelkarte folgt dem Regelsatz:

- **Die höchsten Würfel behalten.** Wirf eine Handvoll Würfel und lies den höchsten, die zwei höchsten oder die drei höchsten ab, je nachdem, was der Regelsatz vorgibt.
- **Gegen deinen Bogen würfeln.** Würfle gleich oder unter einer Zahl auf deinem Bogen, etwa einem Fertigkeitswert in Prozent, statt einen Bonus zu den Würfeln zu addieren.
- **Würfel mit eigenen Seiten.** Seiten können etwas anderes wert sein als ihre Zahl, etwa Minus, leer und Plus. Manche Würfel tragen statt Zahlen Symbole, etwa Erfolg, Vorteil und ihre Gegenteile.
- **Ergebnisse in Bereichen.** Eine Probe kann in einem von mehreren Ergebnissen landen, etwa einem kritischen Erfolg oder einem Erfolg mit Preis, statt einfach zu gelingen oder zu scheitern. Die Würfelkarte nennt den Bereich, und der Game Master erzählt ihn.
- **Einige Proben anders gewürfelt.** Ein Regelsatz kann die meisten Proben auf eine Art würfeln und einige nennen, die anders gewürfelt werden.

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
