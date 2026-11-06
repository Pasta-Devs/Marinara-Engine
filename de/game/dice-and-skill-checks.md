# Game Mode: Würfel und Fertigkeitsproben

Mit der Würfel-Schaltfläche würfelst du im Game Mode für den Game Master (GM). Diese Anleitung zeigt außerdem, wie der GM eine Fertigkeitsprobe gegen eine Difficulty Class (DC) abwickelt, die Zahl, die ein Wurf erreichen oder übertreffen muss.

## Würfeln

Die Eingabeleiste hat eine Würfel-Schaltfläche. Ihr Tooltip lautet **Roll dice** (Würfeln).

1. Klick auf die Würfel-Schaltfläche, um das Schnellwürfel-Menü zu öffnen.
2. Klick auf ein Preset: d20, d6, 2d6, d10, d100, d4, d8 oder d12.
3. In der Eingabeleiste erscheint ein Chip, etwa `🎲 d20`. Der Wurf steht in der Warteschlange und ist noch nicht gesendet.
4. Schick deine Nachricht ab. Marinara würfelt und hängt das Ergebnis als Tag ans Ende deiner Nachricht. Der GM liest es und erzählt passend dazu weiter.

Um einen wartenden Wurf vor dem Senden zu entfernen, klick am Chip auf **Clear queued roll** (wartenden Wurf entfernen).

Ein einzelner Würfel ohne Bonus sieht so aus:

```text
[dice: d20 = 14]
```

Bei mehreren Würfeln oder mit Bonus stehen auch die Einzelwerte dabei:

```text
[dice: 3d8+2 = 18 (4, 6, 6 +2)]
```

Der GM kann in seiner Erzählung auch mit `[dice: 3d8+2]` einen Wurf anfordern. Marinara liefert die tatsächlichen Zahlen und zeigt dieselbe animierte Karte. Das funktioniert auch mit reinen Textverbindungen, einschließlich Claude- und Grok-Abonnements. Würfelt der GM in einem Zug mehrmals, wartet jede Würfelkarte, bis sie an der Reihe ist: Schließe eine, um die nächste zu sehen. Alle Würfe werden im aktiven Swipe (der alternativen Antwort) dieses Zugs gespeichert und bleiben nach dem Neuladen unter **Logs** (Protokolle) erhalten. Beim Fortsetzen eines Zugs bleiben seine früheren Würfe bestehen. Beim erneuten Generieren entsteht ein neuer Satz für den neuen Swipe.

## Eigene Würfel werfen

Das Würfelmenü hat ein Textfeld für einen eigenen Wurf in `NdM`-Notation: `N` Würfel mit je `M` Seiten, optional mit einem Bonus oder Abzug am Ende. Das Feld zeigt das Beispiel `3d8+2` (drei 8-seitige Würfel, 2 addieren).

1. Öffne das Würfelmenü.
2. Tipp deine Notation ein, zum Beispiel `2d6+1`.
3. Drück <kbd>Enter</kbd> oder klick auf die Papierflieger-Schaltfläche. Der Wurf steht als Chip in der Warteschlange.

| Notation | Bedeutung |
| --- | --- |
| `d20` | Ein 20-seitiger Würfel |
| `4d8-1` | Vier 8-seitige Würfel, 1 abziehen |
| `4d6kh3` | Vier 6-seitige Würfel werfen, die höchsten drei behalten |
| `2d20kl1` | Den niedrigsten behalten: ein Wurf mit Nachteil |
| `4d6dl1+2` | Den niedrigsten Würfel verwerfen, 2 addieren |

`kh` und `kl` behalten die höchsten oder niedrigsten Würfel, `dh` und `dl` verwerfen sie. Jeder geworfene Würfel wird aufgezeichnet, und nur die behaltenen werden addiert.

Wenn es nicht funktioniert hat: Text, der weder `NdM` noch ein einzelnes `dM` ist, optional gefolgt von `kh`, `kl`, `dh` oder `dl` und einer Zahl, schlägt mit einer Fehlermeldung fehl, die das erwartete Format nennt.

Du kannst höchstens 100 Würfel auf einmal werfen, und jeder Würfel darf höchstens 1.000 Seiten haben. Ein einfacher Wurf darüber wird auf die Grenzen gekürzt, und die Karte zeigt die gekürzte Notation: Aus `500d6` wird eine `100d6`-Karte. Ein Wurf, der Würfel behält oder verwirft und die Grenzen überschreitet, etwa `101d6kh3`, wird mit einer Fehlermeldung wegen Bereichsüberschreitung abgelehnt, weil eine Kürzung ändern würde, welche Würfel behalten werden.

<a id="skill-checks"></a>

## Fertigkeitsproben

Eine Fertigkeitsprobe testet etwas Riskantes, etwa Anschleichen, einen Hinweis entdecken oder einen NPC (Nicht-Spieler-Charakter) überzeugen. Du startest keine selbst. Der GM fordert sie in seiner Erzählung an, und Marinara macht daraus einen animierten d20-Wurf mit einem Ergebnis-Banner. Das Banner zeigt die Fertigkeit und die Zielzahl, zum Beispiel **Stealth Check** mit **DC 15**. Jede ausgewertete Probe bekommt ein eigenes Banner, nach etwaigen wartenden Würfelkarten.

<a id="how-the-result-is-decided"></a>

### Wie das Ergebnis zustande kommt

Die Probe wirft einen d20 und addiert zwei Modifikatoren:

- Einen Fertigkeits-Modifikator aus der Fertigkeitsstufe, die das Spiel für deinen Charakter mitführt. Hat das Spiel für diese Fertigkeit noch keine Stufe, beträgt er 0.
- Einen Attribut-Modifikator aus dem Attribut, das für die Fertigkeit zuständig ist. Jede Fertigkeit ist automatisch einem Attribut zugeordnet: Stealth (Heimlichkeit) nutzt Dexterity (Geschicklichkeit), Perception (Wahrnehmung) nutzt Wisdom (Weisheit), Persuasion (Überredung) nutzt Charisma. Eine Fertigkeit, die Marinara nicht kennt, nutzt Intelligence (Intelligenz).

In einem Spiel mit **MRPG**-Klassen stammt der Attributsmodifikator stattdessen aus den MRPG-Werten des Charakters, die ihm seine aktive Klasse gibt (siehe [MRPG-Klassen](mrpg-classes.md)). Legacy-Attribute, die nach einem Upgrade noch auf einer Karte stehen, werden nicht verwendet. Jede Fertigkeit stützt sich auf einen Wert:

| Wert | Fertigkeiten |
| --- | --- |
| Strength | Athletics, Intimidation |
| Speed | Acrobatics, Stealth |
| Skill | Sleight of Hand, Investigation, Perception, Medicine, Survival, Animal Handling und jede hier nicht aufgeführte Fertigkeit |
| Defense | Endurance, Constitution |
| Magic | Arcana, History, Nature, Intelligence |
| Resistance | Insight, Religion, Wisdom |
| Luck | Persuasion, Deception, Performance, Charisma |

Die Probe addiert ein Drittel dieses Werts, abgerundet, minus eins. Das entspricht ungefähr +1 oder +2 beim besten Wert eines neuen Charakters, +3 oder +4 auf Stufe 10 und +8 auf der höchsten Stufe.

Erreicht oder übertrifft die Summe die DC, gelingt die Probe. Zwei Würfe setzen die Rechnung außer Kraft:

- Eine natürliche 20 ist ein **CRITICAL SUCCESS** und gelingt immer.
- Eine natürliche 1 ist ein **CRITICAL FAILURE** und misslingt immer.

Das Banner zeigt **CRITICAL SUCCESS**, **SUCCESS**, **FAILURE** oder **CRITICAL FAILURE**.

### Vorteil und Nachteil

Der GM kann eine Probe mit Vorteil (zwei d20 werfen, den höheren behalten) oder mit Nachteil (den niedrigeren behalten) ansetzen. Das Banner zeigt den Modus neben der DC und markiert den verwendeten Würfel. Fordert der GM beides zugleich an, lässt Marinara diese Probe unverändert, statt zu raten, und du bekommst dafür kein Banner.

### Eigenen d20 vorab werfen

Leg vor der Probe über das Würfelmenü einen `d20` in die Warteschlange. Die Probe nimmt dann deine Zahl, statt einen neuen Würfel zu werfen. Deine Fertigkeits- und Attribut-Modifikatoren gelten weiterhin.

Wie der GM einen Zug nach einem Wurf abschließt und was das kostet, steht unter [Wie ein gewürfelter Zug erzählt wird](#how-a-rolled-turn-is-narrated).

<a id="games-that-use-a-ruleset"></a>

### Spiele mit einem Regelsatz

In einem Spiel mit Regelsatz, etwa 5e (SRD 5.1), nutzen Proben die eigenen Würfel des Regelsatzes, seine Schwierigkeitsskala und seine Modifikatoren aus dem Charakterbogen, bei manchen Regelsätzen auch einen Würfelpool oder Symbolwürfel. Siehe [Proben mit einem Regelsatz](rulesets.md#checks-on-a-ruleset).

## Referenz

<a id="how-a-rolled-turn-is-narrated"></a>

### Wie ein gewürfelter Zug erzählt wird

Fordert der GM im Text eine Probe an, wertet Marinara die Würfel aus und hat drei Wege, den Ausgang abzuschließen. Alle drei stehen unter **Chat Settings → Function Calling**.

| Einstellung | Standard | Was passiert |
| --- | --- | --- |
| **Finish rolled turns in one request** (gewürfelte Züge mit einer Anfrage abschließen) | An | Eine Anfrage. Der GM schreibt den Ausgang ohne Zahlen, und Marinara setzt sie ein. Siehe unten. |
| **Narrate dice outcomes immediately** (Würfelergebnisse sofort erzählen) | An | Zwei Anfragen. Der GM schreibt einen Entwurf, Marinara würfelt, dann sendet eine weitere Anfrage den Prompt mit den tatsächlichen Ergebnissen erneut, damit der GM den Ausgang im selben Zug abschließt. Das kostet mehr Eingabe- und Ausgabe-Tokens. |
| Beide aus | | Die tatsächlichen Ergebnisse werden für den nächsten Zug aufbewahrt, ohne zusätzliche Anfrage. |

Scheitert bei **Narrate dice outcomes immediately** die zusätzliche Anfrage, behält der Zug die ausgewerteten Ergebnisse in seinem Protokoll, ohne einen geratenen oder unvollständigen Ausgang zu speichern. Ein Hinweis mit der Schaltfläche **Regenerate turn** (Zug neu generieren) bleibt am Zug, auch nach dem Neuladen. Eine Anfrage ohne tatsächliche Würfe löst die zusätzliche Anfrage nie aus.

Bei einer Verbindung, die das Würfel-Tool unterstützt, kann der GM stattdessen schon während der Generierung einen echten Wurf bekommen. Die Würfelkarte erscheint, sobald das Tool antwortet, und die abgeschlossene Probe übernimmt dieses Ergebnis, ohne erneut zu würfeln.

<a id="finishing-a-rolled-turn-in-one-request"></a>

#### Einen gewürfelten Zug mit einer Anfrage abschließen

Ohne diese Option kostet ein Zug mit Würfelwurf zwei Anfragen. **Finish rolled turns in one request** entfernt die zweite. Die Option ist standardmäßig an. Schalte sie in einem Chat aus, damit dieser Chat stattdessen jeden gewürfelten Zug mit den tatsächlichen Zahlen neu schreibt.

Das funktioniert, weil der GM seinen Text festlegt, bevor irgendeine Zahl existiert. Er sieht keinen Wurf, bevor er entscheidet, was passiert, und kann den Ausgang deshalb nicht steuern. Marinara würfelt danach und speichert ein eigenes Protokoll. Solange der Schalter an ist, schreibt der GM eine Probe auf eine von drei Arten:

- **Zwei Ausgänge.** Der GM schreibt die Probe ohne Zahlen, dann eine Erfolgs- und eine Fehlschlagzeile. Marinara würfelt, behält die Hälfte, die der Wurf ausgewählt hat, und löscht die andere, bevor du den Zug liest.
- **Nur eine Zahl.** Für Schaden, Heilung, Gold, eine Dauer, eine Anzahl oder eine Entfernung schreibt der GM mitten in den Satz einen Platzhalter wie `[[roll: 2d6+3]]`, und Marinara setzt an seiner Stelle die Zahl ein. Ein Platzhalter kann einen Modifikator aus dem Charakterbogen nennen, etwa `[[roll: 1d8+STR]]`. Diese Form wird nur angeboten, wenn dein Spiel einen lesbaren Charakterbogen hat, und ein Name, den Marinara nicht auflösen kann, wird abgelehnt, statt als null zu gelten. Zeig auf eine Zahl aus einem Platzhalter, um ihre Würfel zu sehen. Jede erscheint außerdem als eigene Wurfzeile in **Logs**.
- **Drei oder mehr Ausgänge.** Der GM fragt nach dem Wert und hält an. Marinara würfelt und protokolliert ihn, der Zug endet ohne Ausgang, und der GM erzählt zu Beginn des nächsten Zugs, was die Zahl bedeutet hat.

Eine Probe, die in keiner dieser Formen geschrieben ist, fällt auf das letzte Verhalten zurück, sodass nichts unaufgelöst bleibt und nichts erfunden wird.

- **Narrate dice outcomes immediately** wird währenddessen nicht verwendet. Die Option bleibt sichtbar, aber deaktiviert, und ihr gespeicherter Wert bleibt erhalten und gilt wieder, sobald du diese Option ausschaltest.
- Bestehende Züge ändern sich nicht. Der Schalter betrifft nur Züge, die nach dem Einschalten generiert werden.
- In zwei Fällen kann ein Zug weiterhin mehr als eine Anfrage kosten: wenn **Enable Tool Use** (Tool-Nutzung aktivieren) an ist und das Würfel-Tool in deiner Tool-Liste steht (ein Tool-Aufruf kostet eine volle zusätzliche Runde), oder wenn ein anderer **Game tool provider** (Anbieter für Game-Tools) als **Same as narrator** (wie der Erzähler) eingestellt ist (er stellt immer eine Planungsanfrage).
- Lässt sich etwas nicht würfeln, ersetzt ein kurzer Hinweis die Zahl, nie ein erfundener Wert. **Logs** sagt, was ausgelassen wurde.
- Während der Zug geschrieben wird, bleiben Platzhalter und Zweigblöcke aus dem Streaming-Text heraus, sodass du nie siehst, wie sich eine Zahl ändert.

<a id="symbol-dice-by-name"></a>

### Symbolwürfel nach Namen

In einem Spiel, dessen Regelsatz Symbolwürfel wirft (ein `symbol-pool`-Regelsatz, etwa ein System im Stil von Genesys), nimmt das Feld für eigene Würfe diese Würfel auch nach Namen an. Gib für jede Art eine Anzahl und einen Würfelnamen an, zum Beispiel `2 ability 1 proficiency vs 2 difficulty`. Namen können die ID oder die Beschriftung eines Würfels sein, in beliebiger Groß- und Kleinschreibung, getrennt durch Leerzeichen, Kommas, `+` oder `vs`. Ein Wurf kann bis zu 40 Würfel benennen.

Die Karte zeigt jeden Würfel mit den Symbolen seiner Seite, dann die Symbole, die nach dem gegenseitigen Aufheben übrig bleiben, und ob das ein Erfolg ist. Das Tag der Nachricht enthält dasselbe, zum Beispiel `[dice: 2 ability vs 1 difficulty = 1 Success, 1 Advantage; success]`. Auch das Würfel-Tool des GM nimmt diese Namen an. Einfaches `NdM` funktioniert weiterhin in jedem Spiel.

### Andere Würfel in einer Fertigkeitsprobe

Der GM kann eine andere Notation angeben, etwa `[skill_check: skill="Endurance" dc="12" dice="3d6+2"]`. Solche Proben verwenden den festen Modifikator der Notation statt der d20-Modifikatoren des Charakterbogens und gelingen, wenn die Summe die DC erreicht. Die Regeln für eine natürliche 1 und eine natürliche 20 gelten nur für die Standard-d20-Probe.

Ein Erfolgspool muss sowohl einen Schwellenwert pro Würfel als auch die Zahl der benötigten Erfolge angeben: `[skill_check: skill="Intimidation" dc="4" dice="6d10" resolution="successes" threshold="6"]` würfelt sechs d10, zählt jeden Würfel, der mindestens 6 zeigt, und gelingt ab vier Erfolgen. Marinara errät keinen fehlenden Schwellenwert und setzt weder explodierende Würfel noch Patzer oder andere besondere Poolregeln um. Ein Pool ohne gültigen Schwellenwert bleibt unaufgelöst, und erfundene Zahlen werden entfernt.

Diesen Pool bekommt ein Spiel ohne Regelsatz. Ein Spiel mit einem Regelsatz, der auf Würfelpools aufbaut, funktioniert anders: Siehe [Proben mit einem Regelsatz](rulesets.md#checks-on-a-ruleset).

Das Attribut `dice=` einer Probe nimmt nur einfaches `NdM` an. Anfragen wie `4d6kh3`, `3d6!` oder `4dF` werden nicht gewürfelt: Marinara protokolliert die nicht unterstützte Notation und entfernt erfundene Zahlen, und der Ausgang bleibt offen.

### Dem Game Master einen Würfel jeder Größe zeigen

**Let the Game Master see one die of each size** (dem Game Master einen Würfel jeder Größe zeigen) steht unter **Finish rolled turns in one request**. Die Option ist standardmäßig aus. Sie dient einem Fall, den die blinden Formen nicht abdecken: einer Zahl, die zwischen drei oder mehr Ausgängen wählen muss, etwa einer Erfolgsspanne oder einer Trefferzonentabelle. Ohne sie beendet eine solche Probe den Zug und wird im nächsten Zug erzählt.

Ist sie an, wirft Marinara vor dem Zug einen Würfel jeder Standardgröße und zeigt dem GM den jeweils nächsten Wert, damit er im selben Durchlauf schreiben kann, was er bedeutet.

> **Warnung:** Der GM sieht die Zahl dann, bevor er entscheidet, was er prüft und wie schwer er es macht. Er kann eine Schwierigkeit wählen, die der Würfel, den er kennt, schafft, oder bei einer schlechten Zahl ganz auf eine Probe verzichten. Marinara kann nicht beurteilen, ob eine Schwierigkeit zur Geschichte passt, und das daher nicht erkennen. Ein auffällig heldenhafter Spielverlauf kann zurechtgebogenes Glück sein.

Was Marinara ohne die Mitarbeit des GM durchsetzt:

- Werte werden der Reihe nach ausgegeben, und keiner kommt zweimal.
- Jede Zahl im Protokoll stammt von Marinara. Wurf, Modifikator, Summe und Ergebnis werden aus der Warteschlange und deinem Charakterbogen neu berechnet. Eine abweichende Zahl wird ersetzt, und **Logs** vermerkt das.
- Die Schwierigkeit bleibt zwischen 1 und 40. Ein Spiel mit Regelsatz darf bis an die Schwierigkeitsskala seines Regelsatzes gehen.
- Swipe, Neugenerierung und Fortsetzung desselben Zugs bekommen dieselben Werte, Neuwürfeln für mehr Glück gibt es also nicht.
- **Values shown per size** (angezeigte Werte je Größe) legt fest, wie viele Werte der GM je Größe sieht. Standard ist 1. Spätere Würfe dieser Größe in einem Zug bleiben ungesehen und werden im nächsten Zug erzählt.
- **Rethrow after idle turns** (nach ungenutzten Zügen neu würfeln) wirft einen ungenutzten Würfel nach so vielen Zügen neu, standardmäßig nach 3. Ohne das könnte ein niedriger Wert für den Rest des Chats vorne liegen bleiben. Mit 0 schaltest du das Neuwürfeln aus.
- Fordert der GM mehr Würfe an, als die Warteschlange enthält, behält die Probe ihre Frage, verliert alle Zahlen und wird im nächsten Zug erzählt. **Logs** nennt den Zug.

## Verwandte Anleitungen

- [Game Mode: Mit einem Regelsatz spielen](rulesets.md)
- [Game Mode: Kampf](combat.md)
- [Game Mode: Erste Schritte](getting-started.md)
- [Game Mode: Party und NPCs](party-and-npcs.md)
