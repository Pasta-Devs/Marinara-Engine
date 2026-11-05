# Generierungsparameter

Generierungsparameter sind die Einstellungen, die steuern, wie das Modell jede Antwort schreibt, etwa **Temperature** und **Max Output Tokens**. Presets und Konten liefern Standardwerte, und der Bereich **Advanced Parameters** (erweiterte Parameter) in **Chat Settings** (Chat-Einstellungen) überschreibt sie für einen einzelnen Chat. Die Standardwerte funktionieren für normales Chatten und Roleplay gut; ändere diese Einstellungen also nur, um ein konkretes Problem zu beheben.

## Wo du sie findest

| Was | Wo |
| --- | --- |
| Startwerte für ein Preset | **Presets**, ein Preset öffnen, Tab **Parameters** (Parameter) |
| Werte, die in einem Konto gespeichert sind | **Connections** (Verbindungen), das Konto öffnen, Bereich **Chat defaults** (Chat-Standardwerte) |
| Überschreibungen für einen Chat | **Chat Settings**, Bereich **Advanced Parameters** |

Presets legen keine Kontext- oder Ausgabe-Token-Limits fest. Das Kontextfenster stellst du unter **Connections** ein, Ausgabelimits unter **Connections** oder **Advanced Parameters**. Ältere Preset-Dateien werden weiterhin geladen, ihre gespeicherten Token-Limits aber ignoriert. Das integrierte **Marinara's Universal Preset** steuert keine Generierungsparameter bei.

So überschreibst du Parameter für einen einzelnen Chat:

1. Öffne den Chat.
2. Öffne **Chat Settings**.
3. Such **Advanced Parameters** und klick darauf, um den Bereich aufzuklappen.
4. Such den Parameter, zum Beispiel **Temperature**, und gib einen neuen Wert ein.
5. Prüf den kleinen Schalter neben seinem Namen. Ist er aus, schalte ihn ein. Ein Parameter mit ausgeschaltetem Schalter wird nicht gesendet, deine Änderung bewirkt dann also nichts. Bei **Temperature** ist der Schalter anfangs aus (siehe [Der Send-Schalter](#the-send-switch)).

Dort steht ein Hinweis: „Change generation settings for this chat only. Leave these alone unless you know what they do.“ **Advanced Parameters** gibt es in Conversation-, Roleplay- und Game-Chats.

## Jeder Parameter in einfachen Worten

Jeder numerische Parameter hat ein Eingabefeld und einen Send-Schalter (siehe unten).

| Parameter | Was er bewirkt | Bereich |
| --- | --- | --- |
| **Temperature** | Zufälligkeit. Niedrigere Werte sind fokussierter und vorhersehbarer. Höhere Werte sind kreativer. Ein Wert um 1 ist ein üblicher Mittelweg. | 0 bis 2 |
| **Max Output Tokens** | Die längste Antwort, die das Modell in einem Zug schreiben darf. Tokens sind kleine Textstücke. Erhöhe den Wert, wenn Antworten abbrechen. | Keine feste Obergrenze |
| **Top P** | Das Modell wählt nur aus den wahrscheinlichsten Wörtern, deren Wahrscheinlichkeiten zusammen diesen Wert erreichen. Bei 1 zieht es alles in Betracht. | 0 bis 1 |
| **Top K** | Beschränkt das Modell bei jedem Schritt auf die wenigen wahrscheinlichsten Wörter. 0 schaltet die Grenze ab. Viele Dienste ignorieren diese Einstellung. | 0 bis 500 |
| **Frequency** | Bestraft Wörter umso stärker, je öfter sie schon vorkamen. Positive Werte reduzieren Wortwiederholungen. | -2 bis 2 |
| **Presence** | Bestraft Wörter, die überhaupt schon vorkamen. Positive Werte schieben das Modell zu neuen Themen. | -2 bis 2 |

**Frequency** und **Presence** sind die Wiederholungsstrafen.

**Reasoning Effort** sagt einem Modell mit Denkmodus – einem Modell, das ein Problem zuerst in verborgenen Schritten durcharbeitet –, wie viel es vor der Antwort nachdenken soll. Zur Wahl stehen **Off** (aus), **Low**, **Medium**, **High**, **Extra high** und **Maximum**. Unterstützt das Modell deine Stufe nicht, senkt Marinara sie auf die höchste Stufe ab, die das Modell zulässt. Sobald du ein Modell gewählt hast, tragen die Schaltflächen den Namen der Stufe, die dieses Modell bekommt; **Maximum** kann also als **Max**, **Extra high** oder **High** erscheinen.

- Ist der Send-Schalter an, fordert **Off** den Dienst auf, das Nachdenken abzuschalten, sofern das Modell das bekanntermaßen unterstützt. Manche Modelle können das Nachdenken nicht abschalten und liefern womöglich trotzdem Reasoning zurück. Soll gar nicht nachgedacht werden, nimm ein Modell ohne Denkmodus.
- Ist der Send-Schalter aus, geht keine Reasoning-Vorgabe raus, und der Dienst nutzt seinen eigenen Standard.

**Verbosity** legt fest, wie lang und detailliert Antworten ausfallen sollen: **None**, **Low**, **Medium** oder **High**. Nur manche Modelle werten die Einstellung aus.

## Tuning-Tipps

Ändere immer nur eine Einstellung auf einmal, damit du erkennst, was geholfen hat. Das sind Faustregeln, und Modelle verhalten sich unterschiedlich.

| Problem | Versuch |
| --- | --- |
| Antworten wirken steif oder wiederholen sich | **Temperature** leicht anheben, auf einen Wert zwischen 1,1 und 1,3. |
| Antworten wirken chaotisch oder gehen am Thema vorbei | **Temperature** senken, auf einen Wert zwischen 0,7 und 0,9. |
| Antworten brechen ab | **Max Output Tokens** anheben. |
| Ein Charakter wiederholt dieselben Formulierungen | **Frequency** oder **Presence** leicht anheben, auf einen Wert zwischen 0,3 und 0,6. |

Welche Parameter für eine Nachricht gesendet wurden, zeigt **Peek Prompt**. Dort siehst du den zusammengebauten Prompt sowie Modell, Temperature, Max Tokens, Reasoning Effort und mehr.

<a id="the-send-switch"></a>

## Der Send-Schalter

Jeder numerische Parameter hat neben seinem Namen einen kleinen Schalter, ebenso **Reasoning Effort** und **Verbosity**. Er hat keine Textbeschriftung. Zeig mit der Maus darauf, dann erscheint „This parameter is sent to the model“ oder „This parameter is not sent to the model.“

- An: Marinara nimmt den Parameter in die Anfrage auf.
- Aus: Marinara lässt ihn weg, und der Dienst nutzt seinen eigenen Standard. Das ist etwas anderes als ein Wert wie 0 oder 1, der dem Dienst immer noch vorgibt, was er nutzen soll.

Nutz ihn, wenn ein Dienst meldet, dass sich zwei Einstellungen nicht zusammen verwenden lassen (schalte eine ab), oder wenn eine Fehlermeldung sagt, dass ein Parameter nicht akzeptiert wird (schalte ihn ab) oder zwingend nötig ist (schalte ihn ein).

In den **Advanced Parameters** eines Chats werden standardmäßig nur **Max Output Tokens** und **Reasoning Effort** gesendet.

## Standardwerte

Das sind die Werte, die der Editor anzeigt, nicht immer die, die gesendet werden. Ohne Preset beginnt die Generierung mit 4.096 Ausgabe-Tokens, bevor Konto- und Chat-Überschreibungen greifen. Eine aktive Szene kann 8.192 verwenden. Die Zeile **Effective** (wirksamer Wert) zeigt den aufgelösten Wert.

| Parameter | Startwert | Standardmäßig gesendet |
| --- | --- | --- |
| Temperature | 1 | Nein |
| Max Output Tokens | 4.096 in Conversation, 8.192 in Roleplay; keine Überschreibung durch Game | Ja |
| Top P | 1 | Nein |
| Top K | 0 (aus) | Nein |
| Frequency | 0 | Nein |
| Presence | 0 | Nein |
| Reasoning Effort | Maximum | Ja |
| Verbosity | High | Nein |

Ein Wert bleibt im Feld sichtbar, auch wenn sein Send-Schalter aus ist. Gesendet wird er erst, wenn du den Schalter einschaltest.

## Prefills und Thinking Tags

**Assistant Prefill** (vorgegebener Antwortanfang) ist optionaler Text, der an den Anfang der KI-Antwort gesetzt wird. Lass das Feld leer, solange ein Modell es nicht unterstützt.

- Es ist das Letzte, was gesendet wird – nach deiner Nachricht und nach jeder Anweisung, die darauf folgt.
- Endet der Chat mit einer KI-Antwort und steht **Post-Processing Messages** auf **Apply**, wird das Prefill ans Ende dieser Antwort angehängt.
- Manche Modelle lehnen einen Prompt ab, der mit den eigenen Worten der KI endet, darunter **Claude (Subscription)** mit jedem Modell. Bei ihnen setzt Marinara das Prefill stattdessen an den Anfang der letzten KI-Antwort, sodass die neue Antwort nicht damit beginnt.
- In einem Chat ohne bisherige KI-Antwort wird das Prefill am Ende als deine Nachricht gesendet.

**Assistant Reasoning Prefill** (vorgegebener Anfang des Denkprozesses) ist optionaler verborgener Text, der an den Anfang des Reasonings der KI gesetzt wird, vor der sichtbaren Antwort. Nutz es nur bei Modellen, die ein separates Reasoning-Prefill unterstützen, etwa Kimi K3. Du kannst es zusammen mit **Assistant Prefill** verwenden.

**Thinking Tags** (Denk-Tags) sagen Marinara, wie ein Modell sein verborgenes Reasoning im normalen Text markiert, damit Marinara dieses Reasoning hinter **View model thoughts** verstecken kann. Trag pro Zeile eine Klammerung ein, mit einer Lücke in der Mitte für den verborgenen Text. Gängige Klammerungen wie think, thinking, thought, Pipe, Channel und Klammerpaare erkennt Marinara bereits. Das Feld brauchst du nur für eine ungewöhnliche Klammerung.

## Custom Parameters

Über **Custom Parameters** (eigene Parameter) fügst du rohe Einstellungen hinzu, für die Marinara kein eigenes Feld hat. Tipp ein JSON-Objekt ein, und Marinara mischt es in die Anfrage.

- Als Konto-Standardwerte gespeichert, gehen sie bei jeder Textgenerierung über dieses Konto mit: Conversation, Roleplay, Game, Noodle, Zusammenfassungen, Agenten und installierte Agentenpakete. Das gilt auch für eigene Endpunkte auf deinem eigenen Rechner.
- Custom Parameters pro Chat kommen für diesen Chat hinzu und überschreiben gleichnamige Schlüssel aus dem Konto.
- Ein falscher Schlüssel kann dazu führen, dass der Dienst die Anfrage ablehnt. Schreib `true`, `false` und `null` klein. Lass das Feld leer, solange dich nicht die Anleitung eines Dienstes auffordert, einen Schlüssel hinzuzufügen.

## Service Tier

**Service Tier** erscheint nur, wenn das Konto des Chats OpenRouter oder NanoGPT nutzt. Damit legst du fest, wie der Dienst deine Anfrage weiterleitet. **Default** schickt keine Stufe mit. **Flex** kann günstiger und langsamer sein. **Priority** kann schneller sein und mehr kosten.

## Grenze für Kontextnachrichten

**Limit Context Messages** (Kontextnachrichten begrenzen), auch als **Context message limit** beschriftet, schickt statt des ganzen Chats nur die letzten N Nachrichten. Standardmäßig ist die Option aus. Schaltest du sie ein, steht die Anzahl auf 50; möglich sind 1 bis 9.999. Eine kleinere Zahl senkt die Kosten und beschleunigt alles, dafür erinnert sich die KI an weniger.

In einem Roleplay-Chat mit eingeschaltetem **Advanced Memory Recall** (erweiterter Erinnerungsabruf) gilt diese Grenze nicht. Wie viel Verlauf mitgeht, legt Advanced Memory Recall über **Maximum allowed context before compression (tokens)** fest. Willst du weniger senden, senk diesen Wert unter **Chat Settings → Memory Recall**. Siehe [Advanced Memory Recall](../agents/memory.md#advanced-memory-recall-roleplay-and-game-mode).

## Exclude Past Reasoning

**Exclude Past Reasoning** (früheres Reasoning ausschließen) ist standardmäßig an. Gespeichertes Reasoning aus früheren Zügen bleibt damit aus neuen Prompts heraus. Lass die Option an, solange du keinen klaren Grund hast, altes Reasoning erneut einzuspeisen.

Schaltest du sie aus, erscheint **Past reasoning blocks** (frühere Reasoning-Blöcke). Der Standard ist 1 und behält den neuesten verfügbaren Reasoning-Block. Der Wert 0 nimmt alle verfügbaren Blöcke auf. Gespeicherte Gedanken werden dadurch nicht gelöscht, und erneut gesendet werden kann nur Reasoning, das das aktuelle Konto unterstützt.

## Image captioning

Mit **Image captioning** (Bildbeschreibung) beschreibt Marinara jedes angehängte Bild mithilfe eines anderen Modells in Worten, statt das Bild selbst zu senden. Nutz das bei Modellen, die keine Bilder sehen können. Standardmäßig ist die Option aus.

1. Schalte in **Advanced Parameters** die Option **Image captioning** ein.
2. Wähl im Dropdown-Menü **Captioning model** (Modell für die Bildbeschreibung) ein Modell.
3. Bearbeite optional den **Captioning Prompt**, also die Anweisungen, die mit jedem Bild mitgehen. Die Schaltfläche zum Zurücksetzen oder ein Leeren des Felds stellt den Standard wieder her. Der Prompt wird nur für diesen Chat gespeichert, und **Save as Connection Default** (als Verbindungsstandard speichern) übernimmt ihn nicht.

Wenn es nicht funktioniert hat: Schlägt die Bildbeschreibung fehl, weil das Konto dafür defekt oder gelöscht ist oder nichts zurückliefert, bricht die Antwort mit dem Fehler **Image captioning failed** ab. Marinara sendet dann nicht ersatzweise das Bild. Repariere oder wechsle das Modell für die Bildbeschreibung, oder schalte **Image captioning** aus.

## Save as Connection Default

Ganz unten in **Advanced Parameters** schreibt **Save as Connection Default** deine aktuellen Werte in das Konto. Neue Chats mit diesem Konto starten danach mit diesen Werten. Die Schaltfläche erscheint nur bei einem gespeicherten, normalen Konto. Beim Zufallspool und beim eingebauten Modell bleibt sie ausgeblendet.

**Reset to Defaults** (auf Standard zurücksetzen) verwirft jede Änderung dieses Chats und stellt seine geerbten Einstellungen wieder her. Geerbte Send-Schalter folgen dem gewählten Konto. Ein Send-Schalter, den du selbst geändert hast, bleibt bis zum Zurücksetzen eine Chat-Überschreibung.

## Wie Standards sich schichten und überschreiben

Marinara löst jeden Parameter über diese Liste auf. Spätere Punkte überschreiben frühere.

1. Die **Parameters** des Presets oder die eingebauten Standardwerte, wenn kein Preset genutzt wird. Die Ausgabe beginnt bei 4.096 Tokens, weil Presets keine Ausgabelimits setzen können. In Roleplay hat die Preset-Überschreibung eines Kontos Vorrang vor dem im Chat gewählten Preset.
2. Die **Chat defaults** des Kontos.
3. Die **Advanced Parameters** dieses Chats.
4. Modusregeln. Ein aktiver Szenen-Chat setzt die Ausgabe auf 8.192, Reasoning auf **Maximum** und Verbosity auf **High**. Game nutzt die gespeicherten Konto- und Chat-Parameter, ohne Sampling, Reasoning oder eine Mindestgröße für die Ausgabe zu erzwingen.
5. Ausgabelimits. Game wendet das bekannte Ausgabelimit des Modells an, und **Max output tokens override** des Kontos begrenzt Anfragen in jedem Modus. Der verfügbare Kontext kann das Budget weiter verringern.

Die Zeile **Effective** neben einem Parameter zeigt den Wert, der sich durchsetzt, und aus welcher Schicht er stammt, zum Beispiel **Effective: 16384 · this chat** oder **Effective: 4096 · output token cap**, wenn ein Limit des Kontos greift. Ein ausgeschalteter Send-Schalter erscheint als **not sent**. Dienste können trotzdem Parameter verlangen oder nicht unterstützte Werte anpassen. Custom Parameters und die Anpassung an den Kontext können die endgültige Anfrage verändern. Das Zurücksetzen der Chat-Parameter entfernt nur die Überschreibung dieses Chats (Punkt 3). Der Wert kommt dann aus den **Chat defaults** des Kontos, falls gesetzt, sonst aus dem Preset. Modusregeln und Ausgabelimits (Punkte 4 und 5) gelten danach weiterhin.

<a id="parameters-for-agents"></a>

## Parameter für Agenten

Agentenaufrufe nutzen die **Chat defaults**, die in dem Konto gespeichert sind, über das sie laufen: im eigenen Konto des Agenten oder im Konto des Chats, wenn der Agent keines hat. Send-Schalter und Modellgrenzen gelten wie bei einer Chat-Antwort. Presets und die **Advanced Parameters** eines Chats ändern Agentenaufrufe nicht, abgesehen von der Temperaturregel unten.

- **An Agenten gesendet:** Temperature, Top P, Top K, Frequency, Presence, Reasoning Effort, Verbosity, Service Tier, Custom Parameters, eigene Header und die zusätzlichen Parameter, die du unter **Settings** (Einstellungen), dann **Advanced** (Erweitert), dann **Parameters** hinzufügst, etwa Top A oder einen Seed. Ein Parameter mit ausgeschaltetem Send-Schalter wird nicht gesendet.
- **Nicht an Agenten gesendet:** Max Output Tokens, Stoppsequenzen, Prefills, Thinking Tags und andere Einstellungen für das Promptformat. Jeder Agent behält seinen eigenen Wert für **Max Output Tokens**.
- **Temperature:** Ein Agent nutzt die Temperatur des Kontos oder 0,7, wenn keine gespeichert ist. Beholder nutzt immer 0, und der Prompt-Autor von Illustrator nutzt seinen eigenen Wert. Während einer Chat-Antwort übernehmen Agenten auf dem Konto des Chats die Temperatur und die Send-Schalter, die der Chat ermittelt hat. Wiederholungen nutzen die gespeicherten Werte des Kontos.
- **Reasoning Effort:** Eine gewählte Stufe oder **Off** gilt für jeden Agenten auf diesem Konto, dessen Modell sie annimmt. **Use custom defaults for this model** (eigene Standardwerte für dieses Modell verwenden) lässt Reasoning Effort bei den meisten Konten auf **Maximum** beginnen, bei Codex auf **Default** (Standard). Die Agenten denken dann auf der höchsten Stufe nach, was langsamer ist und mehr kostet. Wähl eine niedrigere Stufe oder schalte den Send-Schalter aus, damit sie weniger nachdenken. Ist keine Stufe gespeichert, fordern Agenten, die in JSON antworten, ausgeschaltetes Denken an, und andere Agenten belassen den Standard des Modells.
- **Platz zum Nachdenken:** Speichert das Konto einen Reasoning Effort, gibt Marinara zusätzlich zu **Max Output Tokens** des Agenten Platz zum Nachdenken – innerhalb der Ausgabegrenze des Kontos, des Modelllimits und des freien Kontexts. Ein eigener Endpunkt bekommt diesen Platz auch dann, wenn er die Stufe nicht sendet.

Installierte Agentenpakete folgen denselben Kontowerten. Ein Wert, den das Konto speichert und sendet, ersetzt die Vorgabe des Pakets; alles, was nicht gesetzt ist, behält die eigene Einstellung des Pakets. Sind **Reasoning Effort** oder **Max Output Tokens** im Konto ausgeschaltet, werden sie nicht gesendet, auch wenn das Paket sie anfordert. Temperature und Verbosity sind anfangs ausgeschaltet, daher bleibt bei ihnen der eigene Wert des Pakets.

## Manche Modelle ignorieren manche Parameter

Nicht jedes Modell akzeptiert jeden Parameter. Weiß Marinara, dass ein Modell eine Einstellung ablehnt, lässt es sie aus der Anfrage heraus. Das Bedienelement bleibt sichtbar, eine Änderung daran bewirkt aber nichts. Häufig ist das bei Reasoning-Modellen, die Sampling-Einstellungen wie Temperature verweigern. Bei einem Auto-Routing-Modell, bei dem jedes Mal ein anderes Modell antworten kann, verhalten sich Parameter womöglich von Zug zu Zug unterschiedlich. Leg dich auf ein Modell fest, damit das Verhalten stabil bleibt.

## Verwandte Anleitungen

- [Preset-Editor und Prompt-Manager](presets.md)
- [Peek Prompt: Sieh nach, was die KI bekommen hat](../chats/peek-prompt.md)
- [Verbindung zu einem KI-Anbieter herstellen](../connections/connecting-to-a-provider.md)
