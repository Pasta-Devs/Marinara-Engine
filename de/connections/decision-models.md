# Decision-Modelle

Ein Decision-Modell ist ein kleines Modell, das Marinara Ja/Nein-Fragen beantwortet, etwa „Verlegt die neueste Nachricht die Szene an einen neuen Ort?“. Lorebooks, eigene Agenten, Prompts und Gruppenchats nutzen es. Es ist optional. Ohne eines funktionieren Chats weiterhin, und jede Funktion nutzt das Ersatzverhalten, das unter [Wo Marinara es verwendet](#where-marinara-uses-it) beschrieben ist.

Seine Antworten steuern, was Marinara tut, und erscheinen nie im Chat. Es bewertet eine Aussage mit einer Zahl von 0 bis 1. Marinara vergleicht diese Zahl mit einer Schwelle und behandelt das Ergebnis als ja oder nein. Das Modell kann auch eine Antwort aus einer kurzen Liste wählen, etwa „wütend“, „traurig“ oder „keine davon“.

Unser Rat: Lass es auf **None** (keines), wenn du unsicher bist. Willst du Decisions nutzen, nimm das eingebaute Modell, das du vielleicht schon hast, oder ein Chat-Modell auf einem Server, den du bereits betreibst. Beides kostet nichts extra.

## Ein Decision-Modell auswählen

Lies vorher [Welche Möglichkeit passt?](#which-one-to-pick).

1. Klick in der oberen Leiste auf **Connections** (Verbindungen) und öffne den Bereich **Jobs** (Aufgaben).
2. Klick unter **Behind the scenes** (hinter den Kulissen) auf die Zeile **Decision**. Eine Liste öffnet sich.
3. Wähle ein Modell. Die Liste hat drei Gruppen:
   - **None (decisions off)** ist der Standard. Es wird nichts gefragt, und die Felder für Aktivierungsfragen im Agenten-Editor bleiben deaktiviert.
   - **Built-in model** (eingebautes Modell) listet die Modelle, die Marinara auf deinem Rechner ausführt: **Built-in model**, **Built-in model (utility)** und **Built-in model (decisions)**. Nichts verlässt deinen Rechner.
   - **Connections** listet deine Konten, die Decisions beantworten können: gehostete oder ein Chat-Modell auf einem Server, den du bereits betreibst.
4. Zum Testen klick in der Zeile auf das Zahnrad **Decision settings** (Decision-Einstellungen) und dann auf **Test**. Diese Schaltfläche erscheint bei den Einträgen des eingebauten Modells. Bei einem Konto von TypeSafe oder OpenRouter öffnest du bei seinem Modell **Edit model** (Modell bearbeiten) und klickst auf **Test provider** (Anbieter testen). Bei einem Konto vom Typ **Own decision server** (eigener Decision-Server) nutzt du **Test** im Menü **⋯** des Kontos.

Ein bestandener Test zeigt die Wahrscheinlichkeit für ja und wie lange die Antwort gedauert hat. Bei einem Modell auf deinem Rechner nennt er außerdem, ob Log-Wahrscheinlichkeiten verfügbar waren und ob das Modell direkt antwortet. Log-Wahrscheinlichkeiten sind die Zahlen, mit denen das Modell angibt, wie sicher es sich bei jedem Wort ist, das es schreiben könnte. Der Test sendet ein festes Beispiel, nicht deinen Chat.

Hat es nicht funktioniert, nennt die Meldung den Grund. Häufige Ursachen: Der Key wurde abgelehnt, der Dienst begrenzt Anfragen, das eingebaute Modell läuft nicht, oder die Antwort lag über dem Zeitlimit. Siehe [Fehlerbehebung](#troubleshooting).

Einträge, die gerade nicht antworten können, bleiben ausgegraut und mit Begründung in der Liste. Wählst du **None**, schaltest du Decisions aus, ohne eine Aktivierungsfrage oder Decision-Aussage zu löschen.

<a id="which-one-to-pick"></a>

### Welche Möglichkeit passt?

- **Ein Modell, das bereits im eingebauten Modell läuft.** Kostet nichts extra. Am besten für die meisten, die das eingebaute Modell nutzen.
- **Ein Chat-Modell auf deinem eigenen Server** (Ollama, LM Studio, llama.cpp oder ein anderer OpenAI-kompatibler Server). Kostet nichts extra. Gut, wenn dein Modell außerhalb von Marinara läuft, damit es nicht doppelt geladen wird.
- **Ein gehostetes Decision-Konto** (Key von TypeSafe oder OpenRouter). Wird pro Anfrage abgerechnet, und ein Zug kann mehrere auslösen. Gut für Handys und Rechner, auf denen kein lokales Modell läuft.
- **Das eingebaute Decision-Modell.** Belegt eigenen Festplatten- und GPU-Speicher. Braucht Linux x86-64 und eine unterstützte NVIDIA-GPU. Für ein eigenes Decision-Modell neben deinem Chat-Modell.

Läuft bei dir schon ein lokales Modell, probier es zuerst und teste Züge aus deinen eigenen Chats. Die Formulierung macht viel aus. Siehe [Aussagen formulieren](../prompts/conditional-prompts.md#writing-statements).

Jev und Open-Jev sind unterschiedliche Modelle. Jev ist das gehostete Modell von TypeSafe, direkt oder über OpenRouter verfügbar. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) ist ein separat veröffentlichtes Modell auf Qwen-Basis, das Marinara lokal ausführen kann. Die Tests mit Open-Jev messen nicht das gehostete Jev.

Unter Android (Termux) kann das **Built-in decision model** (eingebautes Decision-Modell) nicht laufen, und ein kleines lokales Modell auf dem Prozessor eines Handys kann zu langsam sein. Praktisch ist dort ein gehostetes Konto, etwa Jev über OpenRouter. Siehe [Eine Decision-Verbindung einrichten](#set-up-a-decision-connection).

Schreib Presets, Karten und Agenten für „ein Decision-Modell“, niemals mit „benötigt Jev“. Sie verwenden mit jedem Modell dieselbe Aussage-Syntax, aber Modelle können unterschiedlich antworten. Importierst du Inhalte, die Decisions nutzen, auch eigene Agenten und Installationen aus dem Agent Organizer, zeigt Marinara einen Hinweis mit einem Link hierher. Beim Wiederherstellen eines vollständigen Profil-ZIP erscheint er nicht.

## Das eingebaute Modell verwenden

Hast du das eingebaute Modell heruntergeladen, kannst du es ohne Konto und ohne Kosten für Decisions verwenden. Siehe [Eingebautes Modell einrichten](local-model.md).

1. Klick im Bereich **Jobs** unter **Behind the scenes** auf die Zeile **Decision**.
2. Wähle **Built-in model** (oder **Built-in model (utility)**, falls du eines hast).
3. Klick auf das Zahnrad **Decision settings** und dann auf **Test**.

Marinara stellt dem Modell eine Ja/Nein-Frage, lässt es ein Token schreiben und liest die Antwort aus den Wahrscheinlichkeiten dieses Tokens. Es wird keine Chat-Antwort geschrieben, daher bleibt die Anfrage kurz. Eine Auswahl zwischen mehreren Antworten wird als eine Ja/Nein-Frage pro Antwort gestellt.

Die Einstellung **Thinking** (Nachdenken) legt fest, was passiert, wenn ein Modell nicht mit einem Wort antworten kann. Manche Modelle denken immer zuerst nach.

| Thinking | Was es bewirkt |
| --- | --- |
| **Auto (try one word, allow thinking if the model cannot)** | Standard. Nach zwei fehlgeschlagenen Ein-Wort-Antworten hintereinander darf das Modell zuerst nachdenken, und Marinara sagt dir Bescheid. |
| **Off (always answer in one word)** | Ein Modell, das nicht mit einem Wort antworten kann, liefert keine Antwort. |
| **Allowed (let the model think first)** | Bittet das Modell nie, das Nachdenken zu überspringen. |

Ein Modell, das zuerst nachdenkt, braucht Sekunden. Deshalb antwortet es standardmäßig nur bei Prüfungen, die laufen, nachdem die Antwort auf dem Bildschirm steht, etwa für nachverarbeitende Agenten. Soll es auch über Agenten entscheiden, die vor der Antwort laufen, schalte **Also gate agents that run before the reply** (auch Agenten vor der Antwort prüfen) ein. Dann wartet jede Antwort darauf.

Die Ja/Nein-Wahrscheinlichkeiten eines allgemeinen Chat-Modells taugen für eine Schwelle, wurden aber nicht darauf trainiert, so kalibriert zu sein wie die eines eigens dafür entwickelten Decision-Modells. Eine Laufzeit, die keine Log-Wahrscheinlichkeiten liefert, antwortet schlicht mit 1 oder 0. Stimm die Schwellen anhand deiner eigenen Chats ab.

<a id="on-a-server-you-already-run"></a>

### Auf einem bereits laufenden Server

Läuft dein Chat-Modell in Ollama, LM Studio, llama.cpp oder einem anderen OpenAI-kompatiblen Server, kann es Decisions beantworten, ohne dass Marinara eine zweite Kopie lädt.

1. Klick im Panel **Connections** bei diesem Modell auf **⋯** und wähle **Use this model for decisions** (dieses Modell für Entscheidungen verwenden). Das Fenster **Add account** (Konto hinzufügen) öffnet sich beim Decision-Schritt, mit derselben Adresse, demselben Modell und demselben Key.
2. Wähle das Modell und klick dann auf **Test decision** (Entscheidung testen). Ein bestandener Test nennt, ob der Server Log-Wahrscheinlichkeiten geliefert hat und ob das Modell zuerst nachdenken musste. Klick auf **Done** (Fertig).
3. Klick unter **Behind the scenes** auf die Zeile **Decision** und wähle das neue Modell.

Du kannst es auch selbst anlegen. Nimm ein Decision-Konto mit der Quelle **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**, derselben Adresse wie dein Chat-Konto (zum Beispiel `http://localhost:11434/v1` für Ollama) und dem Modellnamen, den der Server verwendet.

Es wird gefragt wie das eingebaute Modell: ein Ja/Nein-Wort pro Aussage. Aussagen gehen einzeln hinaus, weil Marinara nicht wissen kann, wie viele Anfragen dein Server gleichzeitig bearbeitet. **Thinking** ist für ein Konto immer **Auto**. Ein Server auf einem anderen Rechner braucht `PROVIDER_LOCAL_URLS_ENABLED`. Siehe [Ein lokales oder selbst gehostetes Modell verbinden](local-self-hosted.md).

<a id="set-up-a-decision-connection"></a>

## Eine Decision-Verbindung einrichten

Ein gehostetes Decision-Konto sendet die ausgewählten jüngsten Nachrichten und Aussagen an den Dienst und kann Geld kosten. Die Smart-Antwortreihenfolge sendet zusätzlich eine [Charakterliste](#what-the-model-sees).

1. Klick in der oberen Leiste auf **Connections** und dann auf **Add** (Hinzufügen).
2. Klick unter **Decisions** (Entscheidungen) auf **TypeSafe** oder **Own decision server**. Für OpenRouter klickst du unter **Chat** auf **OpenRouter**, verbindest es und nutzt dann **Use this key for decisions** (diesen Key für Decisions verwenden) im Menü **⋯** des Modells.
3. Gib den **API key** ein oder bei **Own decision server** die **Server address** (Serveradresse). Klick auf **Connect** (Verbinden). Das Fenster schließt sich, und das Panel zeigt das neue Konto.
4. Klick unter **Behind the scenes** auf die Zeile **Decision** und wähle das neue Modell.
5. Zum Testen klick im Panel auf das Modell, um **Edit model** zu öffnen, und dann in der Karte **Provider tests** (Anbietertests) auf **Test provider**. Ein Modell vom Typ **Own decision server** hat dort keine Schaltfläche **Test provider**. Öffne stattdessen im Panel das Menü **⋯** des Kontos und klick auf **Test**.

Ein bestandener **Test provider** zeigt die Wahrscheinlichkeit, wie lange die Antwort gedauert hat, und das Zeitlimit des Kontos. **Test** im Menü **⋯** des Kontos sagt nur, ob es funktioniert hat und wie lange es gedauert hat. Der Test wartet mindestens 10 Sekunden oder 5 Sekunden über ein längeres Limit hinaus. Hat die Antwort länger als das Limit gedauert, steht das im Ergebnis: Im Chat würde diese Antwort als keine Antwort zählen.

Hat es nicht funktioniert, sieh unter [Fehlerbehebung](#troubleshooting) nach.

Der Decision-Editor (**Edit model** bei einem Decision-Modell) hat diese Felder:

| Feld | Was es bewirkt |
| --- | --- |
| **Decision source** (Decision-Quelle) | **TypeSafe**, **OpenRouter**, **Custom System One endpoint** (eigener System-One-Endpunkt) oder **OpenAI-compatible chat model (Ollama, LM Studio, llama.cpp)**. Sie wird beim Anlegen des Modells festgelegt. |
| **API key source** (API-Key-Quelle) | **Enter a separate key (optional for local servers)** oder **Use key from …** (Key von … verwenden) mit einem anderen Konto. Verknüpfte Keys folgen späteren Änderungen am Key. Ein Modell mit eigenem System-One-Endpunkt oder ein OpenAI-kompatibles Modell kann den Key eines eigenen Chat-Kontos nur ausleihen, wenn beide Adressen dasselbe Schema, denselben Host und denselben Port haben. |
| **Recent-message token budget** (Token-Budget der jüngsten Nachrichten) | Wie viele geschätzte Tokens aus dem Chat gesendet werden. 1 bis 30.000. Standard 30.000 bei TypeSafe und OpenRouter und 3.500 bei eigenen Servern. Marinara entfernt zuerst ältere Nachrichten und kürzt dann den ältesten Teil der neuesten Nachricht. Eine abgelehnte oder das Budget überschreitende Anfrage liefert keine Antwort. |
| **Time limit (seconds)** | Wie lange während eines Chats auf jede Aussage gewartet wird. 0,5 bis 30. Standard 1,5 oder 4 bei einem OpenAI-kompatiblen Chat-Modell. Siehe [Zeitlimits](#time-limits). |

TypeSafe sendet an `https://api.typesafe.ai`. Du kannst die **Base URL** durch einen anderen Server ersetzen, der die API von TypeSafe bereitstellt, ohne `/v1/systemone`. Er braucht trotzdem deinen TypeSafe-Key, der an diesen Server geht. **Custom System One endpoint** nimmt einen System-One-Server an, den du betreibst, etwa Open-Jev oder [Strands decider](#run-strands-decider-yourself). Gib seine Adresse ohne `/v1/systemone` ein. Ein Server für Chat-Modelle wie Ollama spricht kein System One. Nimm dafür **OpenAI-compatible chat model**.

Manche gehosteten Dienste antworten zeitweise langsamer als 1,5 Sekunden; dann wirken Decisions zufällig kaputt. Teste mehrmals und setz das Limit über die langsamste Antwort. Aussagen, die vor der Antwort gefragt werden, etwa die Decisions eines Presets oder die Aktivierungsfrage eines Agenten, der vor der Antwort läuft, können die Antwort jeweils bis zu dieser Dauer aufhalten.

Löschst du ein Konto, dessen Key für Decisions verwendet wird, erscheint eine Warnung. Das Decision-Konto muss danach neu verknüpft werden; bis dahin liefern Decisions keine Antwort. Importierte Verbindungsdateien enthalten nie API-Keys oder Verknüpfungen zu ausgeliehenen Konten, stell sie also von Hand wieder her.

<a id="where-marinara-uses-it"></a>

## Wo Marinara es verwendet

- [Aktivierungsfragen](../agents/custom-agents.md#activation-questions) entscheiden, ob ein eigener Agent läuft. Ohne Antwort: Die Frage hält ihn nicht auf. Schlüsselwörter und **Trigger Cadence** (Ausführungstakt) gelten weiterhin.
- [Prompt-Aussagen](../prompts/conditional-prompts.md#asking-the-decision-model) wählen Text aus, wenn ein Chat- oder Agenten-Prompt zusammengesetzt wird. Ohne Antwort: Die Decision gilt als nein, ein Decision-Block nutzt also seinen `{{else}}`-Zweig, falls es einen gibt.
- [Decision-Felder im Lorebook](../lorebooks/entries.md#decision-activation) prüfen Require oder Trigger beim Lorebook-Scan. Ohne Antwort: Require kann keinen neuen Eintrag zulassen, und Trigger ergänzt keinen Aktivierungsweg. Sticky-Haltezeiten und gewöhnliche Trigger-Aktivierungswege gelten weiterhin.
- Die [Smart-Antwortreihenfolge](../chats/group-chats.md#response-order-individual-only) bewertet, wenn sie eingeschaltet ist, wer in einem Gruppenchat als Nächstes spricht. Ohne Antwort: Die Smart-Reihenfolge macht ihren gewöhnlichen KI-Aufruf.
- [Aktive Charaktere automatisieren](../chats/group-chats.md#automate-active-characters-merged-only) fragt vor jeder Antwort in einer Merged-Roleplay-Gruppe, wer in der Szene ist, wenn die Option auf **Decision model** (Entscheidungsmodell) steht. Ohne Antwort: Bekommt kein Charakter eine Antwort, nutzt es die letzte Szene des Character Trackers oder behält die Liste bei.
- [Advanced Memory Recall](../agents/memory.md#optional-decision-model) kann für Szenengrenzen in Roleplay und die Auswahl von Erinnerungen ein eigenes Decision-Modell nutzen. Schalte **Use Decision model** (Entscheidungsmodell verwenden) in den Advanced-Memory-Einstellungen dieses Chats ein. Ohne Antwort: Fehlgeschlagene Decisions fallen auf den normalen Abruf oder die normale Szenenprüfung zurück. Zusammenfassungen nutzen weiterhin das Hilfsmodell.

Eine Aktivierungsfrage entscheidet, ob ein Agent läuft. Eine Decision-Aussage in seinem Prompt entscheidet, was dieser laufende Agent gesagt bekommt. Verwende `{{#if decision:"..."}}` für Ja/Nein-Bedingungen und `{{#if decision_choice:"..." == "..."}}` für die Wahl zwischen mehreren Antworten.

<a id="what-the-model-sees"></a>

## Was das Modell sieht

Bei Aktivierungsfragen und Aussagen in Prompts und Lorebooks bekommt das Modell die Aussage und die jüngsten Nachrichten so, wie sie im Chat gespeichert sind. Es bekommt weder dein Preset noch die Charakterkarte, die Persona, Lorebook-Einträge (auch keine Constant-Einträge), Zusammenfassungen oder Agentenausgaben. Text, der zwischen Nachrichten eingefügt wird, etwa ein Eintrag auf **@ Depth**, bleibt ebenfalls außen vor. Hängt eine Aussage von etwas davon ab, muss sie die Tatsache selbst nennen.

- Aussagen in Prompts und Lorebooks, die Smart-Antwortreihenfolge und Aktive Charaktere automatisieren lesen die letzten 5 Nachrichten. Diese Zahl ist fest.
- Aktivierungsfragen lesen die **Scan Depth** (Scan-Tiefe) des Agenten, standardmäßig 5.
- Jede Nachricht trägt den Namen ihres Sprechers. Vor der KI verborgene Nachrichten werden ausgelassen.
- Eine Prüfung, die nach der Antwort läuft, etwa die Frage eines nachverarbeitenden Agenten, sieht auch die geschriebene Antwort.
- Makros in der Aussage werden zuerst ausgefüllt; `{{char}}` kommt also als Name des Charakters an.
- Passen die Nachrichten nicht in das Budget des Modells, werden zuerst ältere Nachrichten weggelassen.

**Smart response order** (Smart-Antwortreihenfolge) sendet zusätzlich eine Charakterliste: Name, Status, Aktivität und Gesprächigkeit jedes Kandidaten, soweit bekannt, dazu bis zu 300 Zeichen Persönlichkeit oder, wenn diese leer ist, Beschreibung.

**Automate active characters** (Aktive Charaktere automatisieren) sendet ebenfalls eine Charakterliste: den Namen jedes Charakters und bis zu 300 Zeichen Beschreibung oder, wenn diese leer ist, Persönlichkeit, gekürzt auf 100 Zeichen oder auf reine Namen, wenn eine große Besetzung nicht hineinpasst, dazu die Namen, die der Character Tracker zuletzt gesehen hat. Lassen selbst reine Namen zu wenig Platz für die Nachrichten, wird das Modell nicht gefragt, und der Character Tracker springt ein. Antworten in einer Merged-Gruppe sind mit „the narrator“ gekennzeichnet, weil eine Antwort für alle spricht.

Ein gehosteter Decision-Dienst erhält diese Charakterlisten zusätzlich zu den Nachrichten.

**Advanced Memory** nutzt ein eigenes Decision-Modell pro Chat und nicht die Regel der letzten 5 Nachrichten. Szenenprüfungen lesen das betreffende Transkriptfenster. Der Abruf sendet aktuellen Gesprächstext und bis zu 24 vorausgewählte archivierte Zusammenfassungen – mehr, wenn **Maximum recalled scenes** (maximal abgerufene Szenen) höher ist –, danach Originalnachrichten aus den Szenen, die das Modell gewählt hat, nachdem der Charakterzugriff geprüft wurde. Gehostete Dienste erhalten diese Texte, manchmal in mehreren Paketen. Jeder Abrufdurchgang bekommt normalerweise 10 bis 25 Sekunden, je nach Geschwindigkeit des Modells. Beide Durchgänge teilen sich 40 Sekunden pro Antwort, sodass ein Durchgang auch weniger als 10 Sekunden bekommen kann. Erinnerungen ohne rechtzeitige Antwort fallen auf den normalen Abruf zurück. Siehe [Optionales Decision-Modell](../agents/memory.md#optional-decision-model).

<a id="thresholds"></a>

## Schwellenwerte

Wahrscheinlichkeiten lassen sich zwischen Modellen nicht vergleichen. Dasselbe Beispiel kann bei einem Modell 0,99 erreichen und bei einem anderen 0,2. Die Standardschwelle für ja oder nein hängt vom Modell ab:

- **Eingebautes Modell oder ein Konto für ein OpenAI-kompatibles Chat-Modell:** 0,5
- **Konto für TypeSafe, OpenRouter oder Custom System One:** 0,5
- **Eingebautes Decision-Modell:** die Empfehlung aus dem Modellmanifest: 0,1 für Open-Jev 2B und 9B

**Run when probability is at least** (ab dieser Wahrscheinlichkeit ausführen) eines Agenten überschreibt diesen Wert. Weicht der gespeicherte Wert ab, bietet der Editor an, die Empfehlung des Modells wiederherzustellen. Prüf ihn bei jedem Modellwechsel. Prompt-Aussagen und Decision-Felder im Lorebook nutzen den Standard des Modells; die Schwelle eines Agenten ändert ihren nicht.

Ein selbst gehostetes Open-Jev hinter einem Custom-System-One-Konto nutzt weiterhin 0,5, weil Marinara beliebige eigene Endpunkte nicht kalibrieren kann. Seine Ergebnisse können vom eingebauten Open-Jev abweichen; unter anderem gilt ein positives Ergebnis unter 0,5 dann als nein.

<a id="time-limits"></a>

## Zeitlimits

Eine Decision, die nicht rechtzeitig ankommt, liefert keine Antwort, und die Generierung läuft mit dem Ersatzverhalten der Funktion weiter (siehe [Wo Marinara es verwendet](#where-marinara-uses-it)). Jedes Limit gilt pro Aussage. Eine Anfrage mit mehreren Aussagen bekommt das Limit für jede davon, und jede Choice-Antwort zählt als eine Aussage. Ein lokales Modell bearbeitet nur wenige Anfragen gleichzeitig. Aussagen warten deshalb, bis sie an der Reihe sind, und die Zeit einer Aussage beginnt, wenn das Modell mit ihr anfängt.

- **Konto für TypeSafe, OpenRouter oder Custom System One:** 1,5 Sekunden oder dein **Time limit**
- **Konto für ein OpenAI-kompatibles Chat-Modell:** 4 Sekunden oder dein **Time limit**. Ein Modell, das zuerst nachdenken muss, bekommt mindestens 20 Sekunden.
- **Eingebautes Modell:** 4 Sekunden. Ein Modell, das zuerst nachdenken muss, bekommt 20 Sekunden.
- **Eingebautes Decision-Modell:** 4 Sekunden für die erste Aussage. Jede weitere bekommt die gemessene Zeit des Modells: 0,35 Sekunden bei Open-Jev 2B und 0,8 Sekunden bei Open-Jev 9B. Ein Modell, das du aus einem Repository installiert hast, bekommt für jede 4 Sekunden.

Decision-Anfragen enden, wenn du eine Generierung abbrichst.

## Weitere Einstellungen

Diese findest du hinter dem Zahnrad **Decision settings**:

- **Also use it to pick who speaks in Smart response order** (auch die Sprecherwahl bei Smart-Reihenfolge übernehmen) ist standardmäßig aus. Siehe [Gruppenchats](../chats/group-chats.md#response-order-individual-only).
- **Decision statements per turn** (Decision-Aussagen pro Zug) begrenzt die Planung von Prompt- und Lorebook-Aussagen. Standard 32, höchstens 255. Das Aussagenkontingent gilt in mehreren Phasen und ist keine einzelne Obergrenze für alle Anfragen oder Kosten eines Zuges. Aktivierungsfragen von Agenten und die Smart-Antwortreihenfolge sind davon getrennt. Siehe [Grenzen und Kosten](../prompts/conditional-prompts.md#limits-and-cost).
- **Also gate agents that run before the reply** und **Thinking** erscheinen bei den Einträgen des eingebauten Modells, die nachdenken können. Das **Built-in decision model** denkt nie nach und hat deshalb keine der beiden Optionen.

## Falsche Antworten einplanen

Jedes Modell kann falsch antworten, und richtige Ja-Antworten können knapp an der Schwelle liegen.

- Nutze eine Decision zur Feinabstimmung einer Antwort, niemals für etwas, auf das der Chat nicht verzichten kann. Eine verpasste Decision soll eine Antwort weniger passgenau machen, sie aber nicht kaputt machen.
- Mach Einverständnis, Inhaltshinweise oder Sicherheitsanweisungen nicht von einer Decision abhängig.
- Setz bei einem Agenten, der nur über eine Aktivierungsfrage läuft, **Bypass the question after this many messages** (Frage nach dieser Anzahl Nachrichten umgehen), damit ein Modell, das immer wieder nein antwortet, ihn nicht für immer stilllegt.

<a id="troubleshooting"></a>

## Fehlerbehebung

- **Der Test schlägt fehl.** Die Meldung nennt den Grund: Der Key wurde abgelehnt, der Dienst begrenzt Anfragen, das eingebaute Modell läuft nicht, das Decision-Modell ist nicht installiert, das Modell hat nicht mit ja oder nein geantwortet, oder die Zeit ist abgelaufen.
- **Der Server hat keinen solchen Endpunkt.** Die Decision-Quelle passt nicht zum Server. Ollama, LM Studio und andere Server für Chat-Modelle brauchen **OpenAI-compatible chat model**. **Custom System One endpoint** ist nur für System-One-Server wie Open-Jev gedacht.
- **Die Antwort lag über dem Zeitlimit, oder Decisions funktionieren nur manchmal.** Der Dienst ist zeitweise langsamer als das **Time limit**. Teste mehrmals und erhöh das Limit über die langsamste Antwort.
- **Ein Agent mit Aktivierungsfrage läuft jeden Zug.** Es ist kein Decision-Modell festgelegt, oder es antwortet nicht; der Agent läuft deshalb, als hätte er keine Frage. Führ einen Test durch.
- **Ein Decision-Zweig in einem Prompt erscheint nie.** Siehe [Wenn ein Decision-Zweig nie erscheint](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **Die Smart-Antwortreihenfolge macht weiterhin ihren gewöhnlichen KI-Aufruf.** Der Schalter ist aus, oder das Decision-Modell hat in diesem Zug nicht geantwortet.
- **Aktive Charaktere automatisieren folgt dem Character Tracker.** Das Modell hat nicht für jeden Charakter geantwortet, es denkt zuerst nach und **Also gate agents that run before the reply** ist aus, oder die Besetzung ist selbst mit reinen Namen zu groß für die Eingabe des Modells.

Um Decision-Werte und -Ausgaben während der Generierung zu sehen, schalte Debug Mode ein oder setz das Log-Level auf debug. Siehe [Log-Stufen](../CONFIGURATION.md#logging-levels). Um eigene Aussagen zu testen, ohne eine Antwort zu generieren, öffne **Peek Prompt → Decision diagnostics → Test decisions** (Peek Prompt → Entscheidungsdiagnose → Entscheidungen testen). Ausdrückliche Tests rufen das gewählte Modell auf und können bei einem gehosteten Dienst Geld kosten. Siehe [Entscheidungsaussagen testen](../chats/peek-prompt.md#testing-decision-statements).

<a id="let-marinara-install-a-decision-model"></a>

## Marinara ein Decision-Modell installieren lassen

Das **Built-in decision model** ist ein experimentelles, eigens dafür entwickeltes Decision-Modell, das Marinara herunterlädt und als eigenen lokalen Prozess neben deinem Chat-Modell ausführt. Sein Speicherbedarf kommt zu dem deines Chat-Modells hinzu. Hast du schon ein lokales Modell, probier zuerst dessen Decisions.

Die Open-Jev-Modelle brauchen Linux **x86-64**, eine NVIDIA-GPU mit Compute Capability 7,5 oder neuer (Turing, die RTX-20-Serie oder neuer) und Treiber 580 oder neuer. Linux-ARM und ältere Karten werden nicht unterstützt. Wo ein Modell nicht laufen kann, bleibt die Option sichtbar, nennt den Grund und bietet **Set up a Decision provider instead** (stattdessen einen Decision-Anbieter einrichten) an.

| Modell | Modell-Download | Festplatte mit Laufzeit | GPU-Speicher |
| --- | --- | --- | --- |
| Open-Jev 2B | Etwa 4,6 GB | Etwa 10 GB | Etwa 4,8 GB (4,5 GiB) |
| Open-Jev 9B | Etwa 19,4 GB | Etwa 25,3 GB | Etwa 23,6 GB (22 GiB) |

Das sind die Schätzungen des Katalogs. Das 9B-Modell lässt auf einer GPU mit 24 GB wenig Reserve. Beachte die Einschätzung des Installers für deine Karte.

1. Klick im Panel **Connections** auf **Add** und unter **Decisions** auf **Built-in model (decisions)**. Ein Fenster mit dem Titel **Built-in decision model** öffnet sich. Du kannst es auch über die Seite der Karte **Built-in model** öffnen.
2. Lies die Warnung und schalte dann **Use the built-in decision model** (eingebautes Decision-Modell verwenden) ein. Ein Dialogfenster mit dem Titel **Turn on the built-in decision model?** zeigt die Einschätzung für deinen Rechner. Klick auf **Enable** (Aktivieren) oder, wenn die Einschätzung eine Warnung ist, auf **Enable anyway** (trotzdem aktivieren).
3. Wähle unter **Available decision models** (verfügbare Decision-Modelle) **Open-Jev 2B** oder **Open-Jev 9B**. Klick auf **Download and install** (herunterladen und installieren) und bestätige Größe, Hardwareeinschätzung und Lizenzen. Vorher wird nichts heruntergeladen.
4. Klick unter **Behind the scenes** auf die Zeile **Decision** und wähle **Built-in model (decisions)**.

Weitere Bedienelemente im Fenster:

- **Install from a repository** (aus einem Repository installieren) nimmt ein Decision-Modell von HuggingFace als `owner/model-name` an. Klick auf **Check** (Prüfen). Marinara liest das eigene Manifest des Repositorys, prüft, ob es zu einer Laufzeit passt, die dieser Build mitbringt, und zeigt die Basisgewichte und die Gesamtgröße. Ein Repository, für das Marinara nicht einstehen kann, wird mit Begründung abgelehnt. Klick dann auf **Download and install this one** (dieses herunterladen und installieren).
- **GPU** wählt auf einem Rechner mit mehreren NVIDIA-GPUs die Karte. Ein Wechsel stoppt das Modell, das dann auf der neuen Karte neu startet.
- **Start this model when Marinara starts** (dieses Modell beim Start von Marinara starten) ist optional. Ist es aus, startet das Modell, sobald ein Agent es zum ersten Mal braucht.
- **Remove files** (Dateien entfernen) löscht das Modell und seine Laufzeit. Schaltest du das Modell aus, wird der Prozess beendet, und die Dateien bleiben erhalten.

Die erste Antwort eines Modells nach dem Start ist langsamer. Marinara stellt deshalb beim Laden eine Frage zum Aufwärmen. Schlägt sie fehl, startet das Modell trotzdem, und die Verzögerung fällt bei der ersten echten Frage an. Ein Zug mit vielen Aussagen dauert bei einem langen Chat länger. Open-Jev 2B braucht bei einem langen Chat etwa eine Viertelsekunde pro Aussage.

<a id="run-strands-decider-yourself"></a>

### Strands decider selbst betreiben

[Strands decider 2B](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19) ist ein weiteres offenes Decision-Modell (Apache-2.0), das System One spricht. Marinara kann es nicht installieren, aber es funktioniert als **Custom System One endpoint**, solange du es laufen lässt.

1. Installiere es in einer Umgebung mit Python 3.10 oder neuer und starte seinen Server:

   ```bash
   pip install strands-decider
   strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
   ```

   Es nutzt eine NVIDIA-GPU oder Apple silicon, wenn es eines davon findet, und sonst langsamer den Prozessor. Beim ersten Start werden das Modell und etwa 4,6 GB Basisgewichte heruntergeladen; seine Python-Pakete belegen etwa 5,5 GB. Der Server hat kein Passwort, lass ihn deshalb auf `127.0.0.1`.

2. Leg ein Konto vom Typ **Own decision server** mit der **Server address** `http://127.0.0.1:8000` an. Jeder Modellname funktioniert.
3. Wähle es in der Zeile **Decision** und teste es dann mit **Test** im Menü **⋯** des Kontos. Seine erste Antwort nach dem Start dauert etwa 2 Sekunden, länger als das Standard-Zeitlimit; teste es deshalb einmal, bevor du chattest.

Seine Wahrscheinlichkeiten sind kalibriert, deshalb passt die Standardschwelle 0,5 zu ihm, anders als bei einem selbst gehosteten Open-Jev (siehe [Schwellenwerte](#thresholds)). Seine Antworten hängen von der Formulierung ab, halte dich also an [Aussagen formulieren](../prompts/conditional-prompts.md#writing-statements).

## Verwandte Anleitungen

- [Eigene Agenten erstellen](../agents/custom-agents.md)
- [Bedingte Prompts](../prompts/conditional-prompts.md)
- [Gruppenchats](../chats/group-chats.md)
- [Eingebautes Modell einrichten](local-model.md)
- [Verbindung zu einem KI-Anbieter herstellen](connecting-to-a-provider.md)
