# Generierungsparameter

In dieser Anleitung erfährst du, was die Generierungsparameter in Marinara Engine tun. Sie steuern, wie die KI jede Antwort schreibt – dazu gehören **Temperature** (Zufälligkeit) und **Max Output Tokens** (maximale Antwortlänge). Eingestellt werden sie pro Chat im Panel **Advanced Parameters** (erweiterte Parameter).

## Was Generierungsparameter bewirken

Ein Generierungsparameter ist eine Sampling-Einstellung. Er formt, wie das Modell aus dem Prompt – dem Text, den Marinara an die KI schickt – fertigen Text macht. Am Inhalt dessen, was du der KI sagst, ändert er nichts. Er ändert die Art, wie die KI antwortet.

Ein Parameter macht Antworten zum Beispiel zufälliger und kreativer. Ein anderer legt fest, wie lang eine Antwort höchstens werden darf. Die meisten Leute brauchen davon nie etwas. Für normales Chatten und Roleplay reichen die Standardwerte völlig.

Ändere diese Einstellungen nur, wenn du ein konkretes Problem beheben willst. Gegen Ende listet diese Anleitung typische Probleme samt passendem Parameter auf.

## Wo du sie findest

Generierungsparameter stecken in jedem einzelnen Chat, nicht in einem globalen Menü.

1. Öffne den Chat, den du ändern willst.
2. Öffne **Chat Settings** (Chat-Einstellungen) über das Zahnradsymbol des aktiven Chats.
3. Such den Bereich **Advanced Parameters** und klick darauf, um ihn aufzuklappen.

Dort steht ein Hinweis: "Override generation parameters for this chat. Only change these if you know what you're doing." Alle folgenden Einstellungen sitzen innerhalb von **Advanced Parameters**.

**Advanced Parameters** gibt es in jedem Chat-Modus (Conversation, Roleplay und Game).

## Jeder Parameter in einfachen Worten

Jeder numerische Parameter hat ein Eingabefeld und einen eigenen Ein-/Aus-Schalter. Dieser Schalter entscheidet, ob der Parameter überhaupt ans Modell geht. Mehr dazu im nächsten Abschnitt.

**Temperature** steuert die Zufälligkeit. Der Bereich reicht von 0 bis 2. Niedrige Werte machen Antworten fokussierter und vorhersehbarer. Hohe Werte machen sie kreativer und abwechslungsreicher. Ein Wert um 1 ist der übliche Mittelweg.

**Max Output Tokens** legt fest, wie lang eine Antwort pro Zug höchstens ausfallen darf. Ein Token ist ein kleines Textstück, ungefähr ein kurzes Wort oder ein Wortteil. Erhöhe den Wert, wenn Antworten ständig abbrechen. Eine feste Obergrenze hat das Feld nicht.

**Top P** heißt auch Nucleus Sampling. Der Bereich reicht von 0 bis 1. Das Modell wählt nur aus den wahrscheinlichsten Wörtern, deren Wahrscheinlichkeiten zusammen diesen Wert erreichen. Niedrige Werte machen Antworten fokussierter. Bei 1 zieht das Modell alles in Betracht.

**Top K** beschränkt das Modell bei jedem Schritt auf die wenigen wahrscheinlichsten Wörter. Der Bereich reicht von 0 bis 500. Der Wert 0 schaltet die Grenze ab. Viele Anbieter ignorieren diese Einstellung.

**Frequency** bestraft Wörter umso stärker, je öfter sie schon vorkamen. Der Bereich reicht von -2 bis 2. Ein positiver Wert reduziert Wortwiederholungen. Das ist die Frequency Penalty, in der App als **Frequency** bezeichnet.

**Presence** bestraft Wörter, die überhaupt schon vorkamen – unabhängig davon, wie oft. Der Bereich reicht von -2 bis 2. Ein positiver Wert schiebt das Modell zu neuen Themen. Das ist die Presence Penalty, in der App als **Presence** bezeichnet.

Zusammen bilden **Frequency** und **Presence** die Wiederholungsstrafen.

**Reasoning Effort** sagt einem Modell mit Denkmodus, wie ausführlich es vor der Antwort nachdenken soll. Ein Modell mit Denkmodus arbeitet ein Problem zuerst in verborgenen Schritten durch. Zur Wahl stehen **None**, **Low**, **Medium**, **High**, **Xhigh** und **Maximum**. Beherrscht das Modell die gewählte Stufe nicht, senkt Marinara sie auf die höchste Stufe ab, die dieses Modell zulässt.

Ist der Parameter-Schalter an, fordert **None** den Anbieter ausdrücklich auf, das Nachdenken abzuschalten – die Einstellung wird also nicht bloß weggelassen. Diese anbieterspezifische Aus-Anweisung schickt Marinara nur an Modelle, von denen sie bekanntermaßen unterstützt wird. Manche Modelle sind zwingend auf Reasoning ausgelegt, lassen sich nicht abschalten und liefern trotzdem Reasoning zurück; soll gar nicht nachgedacht werden, nimm ein Modell ohne Denkmodus. Den Parameter-Schalter selbst auszuschalten ist etwas anderes: Dann geht überhaupt keine Vorgabe raus und der Anbieter bleibt bei seinem Standardverhalten.

**Verbosity** steuert, wie lang und detailliert Antworten ausfallen sollen. Zur Wahl stehen **None**, **Low**, **Medium** und **High**. **Low** hält Antworten kurz. **High** ermutigt zu längeren, ausführlicheren Antworten. Nur manche Modelle werten diese Einstellung aus.

## Der Send-Schalter

Jeder numerische Parameter hat neben seinem Namen einen kleinen Ein-/Aus-Schalter, ebenso **Reasoning Effort** und **Verbosity**. In der App trägt dieser Schalter keine Beschriftung; diese Anleitung nennt ihn den Send-Schalter. Zeig mit der Maus darauf, dann erscheint "This parameter is sent to the model" oder "This parameter is not sent to the model."

Steht der Send-Schalter eines Parameters auf an, nimmt Marinara diesen Parameter in die Anfrage an den Anbieter auf. Steht er auf aus, lässt Marinara den Parameter komplett weg. Der Anbieter greift dann auf seinen eigenen Standard zurück.

Den Send-Schalter auszuschalten ist etwas anderes, als einen Wert wie 1 oder 0 zu setzen. Eine 1 gibt dem Anbieter immer noch eine Vorgabe. Ein ausgeschalteter Schalter sagt gar nichts – dann entscheidet das Modell.

Der Send-Schalter hilft, wenn ein Anbieter meldet, dass sich zwei Einstellungen ausschließen. Schalte eine davon ab und versuch es erneut. Genauso bei Fehlermeldungen, wonach ein Parameter nicht akzeptiert wird oder zwingend nötig ist: Schalter aus, wenn er nicht akzeptiert wird, Schalter an, wenn er verlangt wird.

In den **Advanced Parameters** eines Chats steht der Send-Schalter standardmäßig nur bei **Max Output Tokens** und **Reasoning Effort** auf an. Alle anderen starten ausgeschaltet.

## Standardwerte

Neue Chats starten von einer eingebauten Grundlinie. Die Tabelle zeigt diese Startwerte und ob der jeweilige Parameter standardmäßig mitgeschickt wird.

| Parameter | Startwert | Standardmäßig gesendet |
|---|---|---|
| Temperature | 1 | Nein |
| Max Output Tokens | 4096 in Conversation, 8192 in Roleplay und Game | Ja |
| Top P | 1 | Nein |
| Top K | 0 (aus) | Nein |
| Frequency | 0 | Nein |
| Presence | 0 | Nein |
| Reasoning Effort | Maximum | Ja |
| Verbosity | High | Nein |

Der Wert bleibt im Feld sichtbar, auch wenn der **Send toggle** aus ist. Er geht nur eben nicht raus, solange der Schalter aus ist.

## Assistant Prefill

**Assistant Prefill** (vorgegebener Antwortanfang) ist optionaler Text, der ganz am Anfang der KI-Antwort steht, direkt nach deiner Nachricht. Die meisten Leute lassen das Feld leer.

Sinnvoll ist es nur bei Modellen, die ein Prefill oder ein festes Eröffnungs-Tag unterstützen. Du könntest dort etwa ein Eröffnungs-Tag wie im Platzhaltertext eintragen, um dem Modell einen bestimmten Einstieg aufzuzwingen. Im Zweifel lass das Feld leer.

## Assistant Reasoning Prefill

**Assistant Reasoning Prefill** (vorgegebener Anfang des Denkprozesses) ist optionaler verborgener Text, der ganz am Anfang des Denkprozesses der KI steht, bevor sie die sichtbare Antwort schreibt. Die meisten Leute lassen das Feld leer.

Sinnvoll ist es nur bei Modellen, die ein separates Reasoning-Prefill unterstützen, etwa Kimi K3. Du kannst es zusammen mit **Assistant Prefill** verwenden: Das eine gibt den Anfang des verborgenen Reasonings vor, das andere den Anfang der sichtbaren Antwort. Wenn du nicht sicher bist, ob dein Modell das unterstützt, lass das Feld leer.

## Thinking Tags

**Thinking Tags** (Denk-Tags) sagen Marinara, mit welchen Markierungen ein Modell sein verborgenes Reasoning im normalen Text kennzeichnet. Manche Modelle klammern ihr Reasoning in Tags ein. Kennt Marinara diese Tags, versteckt es das Reasoning hinter der Aktion **View thoughts**, statt es in der Antwort anzuzeigen.

Pro Zeile trägst du eine Klammerung ein, mit einer Lücke in der Mitte für den verborgenen Text. Gängige Klammerungen wie think, thinking, thought, Pipe, Channel und Klammerpaare erkennt Marinara bereits. Das Feld brauchst du nur für Modelle mit ungewöhnlicher Klammerung.

## Custom Parameters

Über **Custom Parameters** (eigene Parameter) fügst du rohe Einstellungen hinzu, für die Marinara kein eigenes Feld anbietet. Du tippst ein JSON-Objekt ein, und Marinara mischt es in die Anfrage an den Anbieter.

Als Verbindungsstandard gespeicherte Custom Parameters gehen bei jeder API-gestützten Textgenerierung über diese Verbindung mit – in Conversation, Roleplay, Game, Noodle, bei Zusammenfassungen und bei Agenten. Das gilt auch für eigene Endpunkte auf dem eigenen Rechner. Custom Parameters pro Chat kommen für diesen Chat dazu und überschreiben gleichnamige Schlüssel aus der Verbindung.

Das Feld ist etwas für Fortgeschrittene. Ein falscher Schlüssel kann dazu führen, dass der Anbieter die Anfrage ablehnt. Im Objekt müssen `true`, `false` und `null` kleingeschrieben stehen. Lass es leer, solange dich nicht die Anleitung eines Anbieters zu einem bestimmten Schlüssel auffordert.

## OpenRouter Service Tier

**OpenRouter Service Tier** taucht nur auf, wenn die Verbindung des Chats den Anbieter OpenRouter nutzt. Damit legst du fest, wie OpenRouter die Anfrage weiterleitet. Zur Wahl stehen **Default**, **Flex** und **Priority**. **Flex** kann günstiger und langsamer sein. **Priority** kann schneller sein und mehr kosten. **Default** schickt gar keine Stufe mit.

## Grenze für Kontextnachrichten

**Limit Context Messages** (Kontextnachrichten begrenzen) steuert, wie viel Chatverlauf ans Modell geht. Aktiviere die Option, um statt des ganzen Chats nur die letzten N Nachrichten zu schicken.

Beim Aktivieren steht die Anzahl auf 50. Möglich ist jeder Wert von 1 bis 9999. Eine kleinere Zahl schickt weniger Verlauf mit, was Kosten senken und das Tempo erhöhen kann. Dafür erinnert sich die KI schlechter an ältere Teile des Chats. Standardmäßig ist die Einstellung aus.

## Exclude Past Reasoning

**Exclude Past Reasoning** (früheres Reasoning ausschließen) ist standardmäßig an. Gespeicherte Denk- und Reasoning-Texte aus früheren Zügen bleiben damit aus neuen Prompts heraus. Dieses Reasoning geht also kein zweites Mal ans Modell.

Lass die Option an, solange du keinen klaren Grund hast, altes Reasoning erneut ins Modell zu füttern.

## Image Captioning

**Image Captioning** (Bildbeschreibung) ändert, wie die KI mit angehängten Bildern umgeht. Ist die Option an, beschreibt Marinara jedes angehängte Bild über eine Verbindung deiner Wahl in Textform, statt das Bild selbst zu schicken.

Das hilft bei Modellen, die keine Bilder sehen können. Wähl nach dem Aktivieren eine Verbindung im Dropdown-Menü **Captioning Connection**. Ein reiner Text-Endpunkt kann scheitern, wenn du die falsche Verbindung angibst. Standardmäßig ist die Einstellung aus.

## Save as Connection Default

Ganz unten in **Advanced Parameters** schreibt die Schaltfläche **Save as Connection Default** (als Verbindungsstandard speichern) die aktuellen Parameterwerte in die Verbindung selbst. Neue Chats über dieselbe Verbindung starten danach mit diesen Werten.

Die Schaltfläche erscheint nur bei einer normalen, gespeicherten Verbindung. Beim Zufallspool an Verbindungen und beim eingebauten lokalen Modell bleibt sie ausgeblendet.

Die Schaltfläche **Reset to Defaults** (auf Standard zurücksetzen) darunter verwirft jede Parameteränderung dieses Chats und stellt die Grundlinie des Modus wieder her.

## Wie Standards sich schichten und überschreiben

Die tatsächlich wirksamen Parameter entstehen aus drei Schichten. Jede Schicht schlägt die vorherige, und zwar Einstellung für Einstellung.

1. Die Grundlinie des Modus. Das ist der eingebaute Startpunkt für den Modus des Chats.
2. Die gespeicherten Standards der Verbindung. Das sind die Werte, die du mit **Save as Connection Default** hinterlegt hast.
3. Die **Advanced Parameters** dieses Chats. Das sind die Werte, die du direkt hier setzt – sie gewinnen.

Ein Wert aus **Advanced Parameters** schlägt also immer den Verbindungsstandard und die Grundlinie des Modus.

Game Mode ist ein Sonderfall. Game Mode setzt einige Parameter selbst, damit seine strukturierten Züge funktionieren. Im Game Mode greifen deshalb manche Änderungen aus **Advanced Parameters** nicht vollständig. Das ist so gewollt.

## Manche Modelle ignorieren manche Parameter

Nicht jedes Modell akzeptiert jeden Parameter. Weiß Marinara, dass ein Modell eine Einstellung ablehnt, lässt es sie aus der Anfrage heraus. Regler und Feld bleiben in der App sichtbar, bewirken bei diesem Modell aber nichts.

Häufig ist das bei bestimmten Reasoning- und Denkmodellen, die Sampling-Einstellungen wie Temperature verweigern. Wenn eine Einstellung wirkungslos scheint, nimmt das Modell sie vermutlich nicht an. Das Verhalten hängt außerdem stark vom gewählten Modell ab, derselbe Wert wirkt also von Modell zu Modell anders.

Nutzt du ein Auto-Routing-Modell, bei dem jedes Mal ein anderes Modell antworten kann, verhalten sich die Parameter womöglich von Zug zu Zug unterschiedlich. Ein fest gewähltes Modell hält das Verhalten stabil.

## Tuning-Tipps nach Symptom

Die meisten Leute ändern hier nie etwas. Wenn du es versuchen willst, ändere immer nur eine Einstellung auf einmal – nur so erkennst du, was geholfen hat.

- Antworten wirken steif oder wiederholen sich: **Temperature** leicht anheben, etwa von 1 auf einen Wert zwischen 1.1 und 1.3.
- Antworten wirken chaotisch oder gehen am Thema vorbei: **Temperature** senken, etwa auf einen Wert zwischen 0.7 und 0.9.
- Antworten brechen mittendrin ab: **Max Output Tokens** anheben.
- Ein Charakter wiederholt ständig dieselben Formulierungen: **Frequency** oder **Presence** leicht anheben, etwa auf einen Wert zwischen 0.3 und 0.6.

Das sind Faustregeln, keine getesteten Empfehlungen. Modelle reagieren unterschiedlich, ein Wert von einer Verbindung lässt sich also nicht zwingend auf die nächste übertragen.

Welche Parameter für eine Nachricht tatsächlich rausgingen, zeigt **Peek Prompt**. Dort siehst du den zusammengebauten Prompt sowie Modell, Temperature, Max Tokens, Reasoning Effort und mehr.

## Verwandte Anleitungen

- [Preset-Editor und Prompt Manager](presets.md)
- [Peek Prompt: sehen, was die KI bekommen hat](../chats/peek-prompt.md)
- [Mit einem KI-Anbieter verbinden](../connections/connecting-to-a-provider.md)
