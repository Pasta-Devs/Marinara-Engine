# Decision-Modelle

In dieser Anleitung erfährst du, was ein **Decision model** (Entscheidungsmodell) ist, welche drei Wege zu einem solchen Modell führen, wie du sie einrichtest und wo Marinara es verwendet. Es ist optional. Ohne eines erzeugen Chats weiterhin Antworten; jede Funktion verwendet dann das unten beschriebene Ersatzverhalten.

## Was ein Entscheidungsmodell ist

Ein Entscheidungsmodell beantwortet eine bestimmte Art von Frage. Es erhält die jüngsten Chat-Nachrichten und eine Aussage, etwa „Die neueste Nachricht verlegt die Szene an einen anderen Ort“, und bewertet deren Wahrscheinlichkeit mit einer Zahl zwischen 0 und 1. Marinara vergleicht diese Zahl mit einer Schwelle und behandelt das Ergebnis als ja oder nein. Das Modell kann auch eine Antwort aus einer kurzen Liste wählen, etwa „wütend“, „traurig“ oder „keine davon“.

Seine Antworten steuern Marinara; sie erscheinen nicht als Chat-Antworten. Ein eigens dafür entwickeltes Entscheidungsmodell bewertet Aussagen direkt. Ein lokales Chat-Modell wird normalerweise nach einem einzelnen Ja/Nein-Token gefragt; manche Modelle müssen aber zuerst nachdenken. Decisions können schneller sein als eine vollständige Antwort, doch viele Aussagen oder ein nachdenkendes Modell können spürbar Zeit kosten.

<a id="where-marinara-uses-it"></a>

## Wo Marinara es verwendet

- **[Aktivierungsfragen](../agents/custom-agents.md#activation-questions)** entscheiden vor der Arbeit eines eigenen Agenten in dessen Phase, ob er läuft. Ohne Antwort hält die Frage ihn nicht auf; Schlüsselwörter und **Trigger Cadence** (Ausführungstakt) gelten weiterhin.
- **[Prompt-Aussagen](../prompts/conditional-prompts.md#asking-the-decision-model)** wählen Text beim Vorbereiten eines Chat- oder Agenten-Prompts. Ohne Antwort gilt die Decision als nein; ein einfacher Decision-Block verwendet also seinen `{{else}}`-Zweig, falls vorhanden.
- **[Decision-Felder im Lorebook](../lorebooks/entries.md#decision-activation)** prüfen Require oder Trigger beim Lorebook-Scan des Chats. Ohne Antwort kann Require keinen neuen Eintrag zulassen und Trigger ergänzt keinen Aktivierungsweg. Bestehende Sticky-Haltezeiten und gewöhnliche Aktivierungswege von Trigger-Einträgen gelten weiter.
- **[Smart-Antwortreihenfolge](../chats/group-chats.md#response-order-individual-only)** bewertet bei aktivierter Option, wer in einem Gruppenchat als Nächstes sprechen soll. Ohne Antwort verwendet Smart seinen gewöhnlichen KI-Aufruf.
- **[Advanced Memory Recall](../agents/memory.md#optional-decision-model)** kann ein eigens gewähltes lokales Modell oder eine eigene Entscheidungsverbindung für Roleplay-Szenengrenzen und Erinnerungsauswahl nutzen. Aktiviere **Use Decision model** in den Advanced-Memory-Einstellungen dieses Chats. Zusammenfassungen schreibt weiterhin das Hilfsmodell. Bei fehlgeschlagenen Entscheidungen greifen normaler Abruf oder Szenenprüfung.

Eine Aktivierungsfrage steuert, ob ein Agent läuft; eine Decision-Aussage in seinem Prompt steuert, welche Anweisungen dieser laufende Agent erhält. Verwende `{{#if decision:"..."}}` für Ja/Nein-Bedingungen und `{{#if decision_choice:"..." == "..."}}` für die Auswahl zwischen mehreren Antworten.

<a id="what-the-model-sees"></a>

## Was das Modell sieht

Bei Aktivierungsfragen und Aussagen in Prompts oder Lorebooks erhält das Modell die Aussage und die jüngsten Nachrichten so, wie sie im Chat gespeichert sind. Den übrigen zusammengesetzten Prompt sieht es nicht: weder Preset, Charakterkarte, Persona-Beschreibung, Lorebook-Einträge einschließlich Constant-Einträgen noch Zusammenfassungen oder Agentenausgaben. Auch zwischen Nachrichten eingefügter Text, etwa ein Preset oder Lorebook-Eintrag an **@ Depth**, bleibt außen vor. Hängt eine Aussage von solchen Informationen ab, muss sie diese selbst enthalten.

**Smart-Antwortreihenfolge sendet zusätzlich eine Charakterliste.** Sie enthält Namen, Status, Aktivität und Gesprächigkeit der Kandidaten, soweit vorhanden, sowie bis zu 300 Zeichen ihrer Persönlichkeit oder ersatzweise Beschreibung. Ein gehosteter Decision-Anbieter erhält diese Liste zusätzlich zu den jüngsten Nachrichten.

- Decision-Aussagen in Prompts und Lorebook-Einträgen sowie Smart lesen die letzten 5 Nachrichten. Diese Zahl ist fest.
- Aktivierungsfragen lesen die **Scan Depth** (Scan-Tiefe) des Agenten, standardmäßig 5.
- Jede Nachricht trägt den Namen ihres Sprechers. Vor der KI ausgeblendete Nachrichten werden ausgelassen.
- Prüfungen nach der Antwort, etwa die Aktivierungsfrage eines nachverarbeitenden Agenten oder eine Aussage in seinem Prompt, sehen auch die gerade geschriebene Antwort.
- Makros in der Aussage werden zuerst aufgelöst; `{{char}}` kommt also als Charaktername an.
- Passen die Nachrichten nicht in das Budget des Modells, werden zuerst ältere entfernt. Das Budget gehosteter Verbindungen steht unter [Eine Decision-Verbindung einrichten](#set-up-a-decision-connection).

**Advanced Memory verwendet ein eigenes Decision-Modell pro Chat.** Szenenprüfungen lesen das betreffende Transkriptfenster. Der Abruf sendet nach Prüfung des Charakterzugriffs aktuelle Gesprächsteile und bis zu 24 vorausgewählte archivierte Zusammenfassungen – mehr, wenn **Maximum recalled scenes** (maximal abgerufene Szenen) höher ist –, danach Originalnachrichten aus den Szenen, die das Modell gewählt hat; die feste Regel der letzten 5 Nachrichten gilt hier nicht. Gehostete Anbieter erhalten diese Texte gegebenenfalls in mehreren begrenzten Paketen. Jeder Abrufdurchgang greift nach 10 Sekunden auf den normalen Abruf zurück. Siehe [Optionales Decision-Modell](../agents/memory.md#optional-decision-model).

## Ein Decision-Modell auswählen

Öffne **Connections** (Verbindungen), dann **Connection defaults** (Standardverbindungen), und wähle unter **Decision model**. Die Liste hat drei Gruppen:

- **None** (keines), der Standard. Es wird nichts gefragt, und die Felder für Aktivierungsfragen im Agenten-Editor bleiben deaktiviert.
- **Local models** (lokale Modelle): das bereits laufende **Primary local model** (primäres lokales Modell) oder **Utility local model** (lokales Hilfsmodell). Nichts wird heruntergeladen und nichts verlässt deinen Rechner. Auch ein installierter **Decision sidecar** steht hier.
- **Connections**: selbst angelegte Decision-Verbindungen: gehostet, ein eigener System-One-Server oder ein Chat-Modell auf einem bereits laufenden Server wie Ollama oder LM Studio.

Gerade nicht verfügbare Einträge bleiben ausgegraut samt Begründung in der Liste, damit du weißt, was zu beheben ist. Klick nach der Auswahl auf **Test**. Der Test sendet ein festes Beispiel, nicht deinen Chat.

### Welche Möglichkeit passt?

Läuft bereits ein lokales Modell, probiere es zuerst. In einem kleinen Formulierungstest aus einer Roleplay-Szene beantwortete Gemma 4 E4B alle 32 empfohlenen Aussagen richtig, Open-Jev 2B und 9B jeweils 31. Das zeigt, warum Formulierungen wichtig sind; es ist keine allgemeine Rangliste der Genauigkeit. Prüfe typische Züge aus deinen eigenen Chats; siehe [Aussagen formulieren](../prompts/conditional-prompts.md#writing-statements).

**Jev und Open-Jev sind unterschiedliche Modelle.** Jev ist das gehostete Modell von TypeSafe, direkt oder über OpenRouter verfügbar. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) ist ein separat veröffentlichtes Modell auf Qwen-Basis, das Marinara lokal ausführen kann. Die Formulierungstests mit Open-Jev messen nicht die Genauigkeit des gehosteten Jev.

| Möglichkeit | Kosten | Voraussetzungen | Geeignet für |
| --- | --- | --- | --- |
| Ein bereits laufendes Modell | Keine zusätzlichen Kosten | Ein lokales Modell unter **Local Model** | Die meisten Nutzer mit einem lokalen Modell |
| Ein Chat-Modell auf deinem eigenen Server | Keine zusätzlichen Kosten | Ein bereits laufender Server mit Ollama, LM Studio, llama.cpp oder einer anderen OpenAI-kompatiblen API | Nutzer, deren Modell außerhalb von Marinara läuft, damit es nicht doppelt geladen wird |
| Eine gehostete Decision-Verbindung | Berechnete Anfragen; ein Zug kann mehrere auslösen | Ein API-Key von TypeSafe oder OpenRouter | Handys und PCs ohne lokales Modell |
| Das installierbare Entscheidungsmodell | Zusätzlicher Festplatten- und GPU-Speicher; siehe [Modellgrößen](#let-marinara-install-a-decision-model) | Linux x86-64 und eine unterstützte NVIDIA-GPU | Ein eigenes Entscheidungsmodell neben dem Chat-Modell |

**Unter Android (Termux)** läuft das installierbare Entscheidungsmodell nicht, weil es einen PC mit NVIDIA-GPU braucht. Auch ein kleines lokales Modell auf dem Prozessor eines Handys kann für das Zeitlimit zu langsam sein. Auf einem Handy ist daher eine gehostete Decision-Verbindung praktisch, etwa Jev über OpenRouter. Siehe [Eine Decision-Verbindung einrichten](#set-up-a-decision-connection).

Schreib Presets, Karten und Agenten für „ein Decision-Modell“, niemals mit „benötigt Jev“. Unabhängig von der Auswahl gilt dieselbe Aussage-Syntax; verschiedene Modelle können jedoch unterschiedlich antworten.

Beim Import von Inhalten mit Decisions zeigt Marinara einen Hinweis mit Link zu dieser Anleitung. Das gilt auch für eigene Agenten und Installationen aus dem Agentenkatalog. Ohne ausgewähltes Decision-Modell erklärt der Hinweis das Ersatzverhalten: Prompt-Aussagen gelten als nein, Lorebook-Einträge können nicht über eine Decision aktiviert werden, und Aktivierungsfragen lassen Agenten laufen, sobald Schlüsselwörter und **Trigger Cadence** es erlauben. Lege deshalb auch einen Takt fest, wenn ein Agent ohne Decision-Modell nicht jeden Zug laufen soll. Beim Wiederherstellen eines vollständigen Profil-ZIP erscheint dieser Importhinweis nicht.

<a id="use-a-model-you-already-run"></a>

## Ein bereits laufendes Modell verwenden

Ein lokales Modell unter **Local Model** kannst du für Decisions verwenden, ohne eine Verbindung anzulegen oder Anfragen zu bezahlen.

1. Öffne unter **Connections** die **Connection defaults** und setze **Decision model** auf **Primary local model** oder, falls eingerichtet, **Utility local model**.
2. Klick auf **Test**. Bei Erfolg siehst du Wahrscheinlichkeit und Anfragezeit sowie zwei Angaben speziell für lokale Modelle: ob Log-Wahrscheinlichkeiten verfügbar waren und ob das Modell direkt antwortet.

Marinara stellt eine einzelne Ja/Nein-Frage, lässt das Modell ein Token erzeugen und liest die Antwort aus dessen Wahrscheinlichkeiten. Es wird keine Chat-Antwort geschrieben, daher bleibt die Anfrage kurz. Eine Auswahl zwischen mehreren Antworten wird als eine Ja/Nein-Frage pro Antwort gestellt. Wie viele jüngste Nachrichten hineinpassen, richtet sich nach der Kontextgröße des jeweiligen Modellplatzes.

**Thinking** (Nachdenken). Die meisten Modelle antworten mit einem Wort. Manche denken unabhängig vom Auftrag zuerst nach. Das steuert **Thinking** unter dem Auswahlfeld:

- **Auto**, der Standard, versucht die schnelle Einwortmethode. Kann das Modell zweimal hintereinander so nicht antworten, darf es zuerst nachdenken und du erhältst einen Hinweis.
- **Off** (aus) verwendet immer die Einwortmethode. Ein dafür ungeeignetes Modell liefert keine Antwort.
- **Allowed** (erlaubt) bittet das Modell nie, das Nachdenken zu überspringen.

Ein zuerst nachdenkendes Modell braucht Sekunden. Deshalb beantwortet es standardmäßig nur Prüfungen nach der sichtbaren Antwort, etwa für nachverarbeitende Agenten. Vor der Antwort liefert es kein Ergebnis, außer du aktivierst **Also gate agents that run before the reply** (auch Agenten vor der Antwort prüfen). Dann wartet jede Antwort darauf.

**Zu den Zahlen.** Die Ja/Nein-Wahrscheinlichkeiten eines allgemeinen Chat-Modells lassen sich mit einer Schwelle vergleichen, wurden aber nie so kalibriert wie die eines eigens dafür entwickelten Entscheidungsmodells. Eine Laufzeit ohne Log-Wahrscheinlichkeiten liefert schlicht 1 oder 0. Passe Schwellen anhand deiner Chats an, statt dem Standard blind zu vertrauen.

<a id="on-a-server-you-already-run"></a>

### Auf einem bereits laufenden Server

Läuft dein Chat-Modell bereits in Ollama, LM Studio, llama.cpp oder einem anderen OpenAI-kompatiblen Server, kann es Entscheidungen beantworten, ohne dass Marinara eine zweite Kopie lädt.

1. Öffne die **Custom**-Verbindung für diesen Server und klick auf **Use this model for decisions** (dieses Modell für Entscheidungen verwenden). Das erstellt eine Decision-Verbindung mit der Quelle **OpenAI-compatible chat model** (OpenAI-kompatibles Chat-Modell) und derselben Basis-URL, demselben Modell und Key. Du kannst sie auch selbst anlegen: eine Decision-Verbindung mit dieser Quelle, derselben Basis-URL wie die Chat-Verbindung (etwa `http://localhost:11434/v1` für Ollama) und dem vom Server angebotenen Modellnamen.
2. Wähle sie unter **Decision model** und klick auf **Test**. Das Ergebnis nennt auch, ob der Server Log-Wahrscheinlichkeiten geliefert hat und ob das Modell zuerst nachdenken musste.

Die Abfrage funktioniert wie bei einem lokalen Modell: ein Ja/Nein-Wort pro Aussage, abgelesen aus seinen Wahrscheinlichkeiten. Aussagen werden einzeln gesendet, weil Marinara nicht weiß, wie viele Anfragen dein Server gleichzeitig bearbeiten kann. **Thinking** ist für eine Verbindung immer **Auto**. Ein Modell, das zuerst nachdenken muss, wechselt deshalb nach zwei fehlgeschlagenen Antworten zur Denkvariante und beantwortet danach nur Prüfungen nach der Antwort, sofern **Also gate agents that run before the reply** nicht eingeschaltet ist. Ein Server auf einem anderen Rechner im Netzwerk benötigt wie jeder lokale Anbieter zusätzlich `PROVIDER_LOCAL_URLS_ENABLED`; siehe [Ein lokales oder selbst gehostetes Modell verbinden](local-self-hosted.md).

<a id="set-up-a-decision-connection"></a>

## Eine Decision-Verbindung einrichten

1. Erstelle unter **Connections** eine Verbindung mit dem Anbieter **Decision**.
2. Wähle **TypeSafe**, **OpenRouter**, **Custom System One endpoint** (eigener System-One-Endpunkt) oder **OpenAI-compatible chat model**. Gehostete Quellen brauchen einen API-Key. TypeSafe sendet Anfragen an `https://api.typesafe.ai`, außer du ersetzt die **Base URL** durch die Adresse eines anderen Servers, der die API von TypeSafe bereitstellt – ohne `/v1/systemone`. Auch dann brauchst du deinen TypeSafe-Key, der an diesen Server gesendet wird. Ein Server auf einem anderen Rechner im lokalen Netzwerk benötigt wie jeder lokale Anbieter `PROVIDER_LOCAL_URLS_ENABLED`; unter Android ist diese Einstellung standardmäßig an. Custom akzeptiert einen bereits laufenden System-One-Server einschließlich Open-Jev oder [Strands decider](#run-strands-decider-yourself). Gib dessen Basis-URL ohne `/v1/systemone` und einen unterstützten Modellnamen ein. Chat-Modell-Server wie Ollama oder LM Studio sprechen kein System One: Wähle dafür **OpenAI-compatible chat model**, wie unter [Auf einem bereits laufenden Server](#on-a-server-you-already-run) beschrieben.
3. Wähle für OpenRouter unter **API key source** (API-Key-Quelle) eine gespeicherte OpenRouter-Verbindung oder gib einen eigenen Key ein. Ihr Editor bietet auch **Use this key for decisions** (diesen Key für Decisions verwenden), womit Jev über OpenRouter eingerichtet wird. Verknüpfte Keys folgen späteren Änderungen automatisch. Custom-System-One- und OpenAI-kompatible Chat-Modell-Verbindungen dürfen den Key einer eigenen Chat-Verbindung nur ausleihen, wenn beide URLs denselben Ursprung haben: Schema, Host und Port.
4. Speichere, wähle die Verbindung unter **Decision model** und klick auf **Test**. Ein Erfolg zeigt Wahrscheinlichkeit, Antwortdauer und Zeitlimit der Verbindung. Test wartet mindestens 10 Sekunden sowie 5 Sekunden über ein längeres Limit hinaus, um auch langsame Antworten mit ihrer wirklichen Dauer zu melden. Überschreitet die Antwort das Limit, steht das im Ergebnis: Im Chat würde sie als keine Antwort gelten.

Der Decision-Standard ist unabhängig von den Standards für Chat, Agenten, Bilder, Video und Audio. **None** schaltet Decisions aus, ohne Aktivierungsfragen oder Decision-Aussagen zu löschen.

Gehostete Decisions senden die ausgewählten jüngsten Nachrichten und Aussagen an den gewählten Anbieter und können Kosten verursachen. Smart sendet zusätzlich die [Charakterliste](#what-the-model-sees). Das **Recent-message token budget** (Token-Budget der jüngsten Nachrichten) beträgt standardmäßig 30.000 geschätzte Tokens bei gehosteten Quellen und 3.500 bei eigenen Servern. Verringere es bei kleinerem Server-Kontext. Marinara entfernt zuerst ältere Nachrichten und kürzt danach den ältesten Teil der neuesten Nachricht. Die Schätzung kann vom Tokenizer des Servers abweichen; eine abgelehnte oder zu große Anfrage liefert keine Antwort.

**Time limit (seconds)** (Zeitlimit in Sekunden) legt fest, wie lange eine Decision-Verbindung während eines Chats auf die Antwort jeder einzelnen Aussage wartet: 0,5 bis 30 Sekunden, standardmäßig 1,5 oder 4 bei einer **OpenAI-compatible chat model**-Verbindung. Fragt ein Zug mehrere Aussagen in einer Anfrage ab, gilt diese Zeit für jede davon. Spätere Antworten gelten als keine Antwort. Manche gehosteten Anbieter brauchen gelegentlich mehr als 1,5 Sekunden; dann wirken Decisions zufällig defekt. Klick deshalb mehrmals auf **Test** und setze das Limit oberhalb der langsamsten Antwort. Der Preis dafür: Aussagen vor der Antwort, etwa Decisions in einem Preset oder die Aktivierungsfrage eines vorher laufenden Agenten, können die Chat-Antwort jeweils bis zu dieser Dauer aufhalten.

Löschst du eine Verbindung, deren Key verknüpft ist, erscheint eine Warnung; die Decision-Verbindung muss anschließend neu verknüpft werden. Auch importierte einzelne Verbindungsdateien brauchen neue Keys oder Verknüpfungen; sie enthalten niemals API-Keys oder IDs ausgeliehener Verbindungen.

<a id="run-strands-decider-yourself"></a>

### Strands decider selbst betreiben

[Strands decider 2B](https://huggingface.co/StrandsAgents/strands-decider-2B-hobson-v19) ist ein weiteres offenes Decision-Modell (Apache-2.0), das System One unterstützt. Marinara kann es nicht installieren, aber du kannst es als **Custom System One endpoint** verwenden, solange du es selbst laufen lässt.

1. Installiere es in einer Umgebung mit Python 3.10 oder neuer und starte seinen Server:

   ```bash
   pip install strands-decider
   strands-decider serve StrandsAgents/strands-decider-2B-hobson-v19 --port 8000
   ```

   Wenn verfügbar, nutzt es eine NVIDIA-GPU oder Apple silicon; andernfalls läuft es langsamer auf dem Prozessor. Beim ersten Start werden das Modell und etwa 4,6 GB Basisgewichte heruntergeladen; seine Python-Pakete belegen etwa 5,5 GB. Der Server hat kein Passwort, betreibe ihn deshalb nur auf `127.0.0.1`.
2. Erstelle eine Decision-Verbindung mit der Quelle **Custom System One endpoint** und der Basis-URL `http://127.0.0.1:8000`. Jeder Modellname funktioniert.
3. Wähle sie unter **Decision model** und klick auf **Test**. Die erste Antwort nach dem Start dauert etwa 2 Sekunden und damit länger als das standardmäßige **Time limit**. Teste es deshalb einmal vor dem Chatten.

Seine Wahrscheinlichkeiten sind kalibriert. Deshalb passt die Standardschwelle 0,5 einer eigenen Verbindung, anders als bei einem selbst gehosteten Open-Jev (siehe [Schwellenwerte](#thresholds)). In einem kleinen Roleplay-Test mit 80 Aussagen auf einer RTX 5090 beantwortete es 73 richtig, gegenüber 74 bei Open-Jev 2B, und belegte etwa 5,1 GB (4,7 GiB) GPU-Speicher. Für eine bis acht Aussagen brauchte es 0,04 bis 0,1 Sekunden, gegenüber 0,1 bis 0,14 bei Open-Jev 2B; bei einem langen Chat lagen beide bei etwa 0,3 Sekunden. Seine Antworten hängen stärker von der Formulierung ab. Beachte deshalb [Aussagen formulieren](../prompts/conditional-prompts.md#writing-statements) und teste Züge aus deinen eigenen Chats.

Zum Wechsel zwischen diesem Modell und dem Decision-Sidecar wählst du eines davon unter **Decision model**. Beide bleiben eingerichtet.

<a id="let-marinara-install-a-decision-model"></a>

## Marinara ein Entscheidungsmodell installieren lassen

Marinara kann ein eigens entwickeltes Entscheidungsmodell herunterladen und ausführen. Es läuft als eigener lokaler Prozess, auch ohne lokales Chat-Modell. Sein Speicherbedarf kommt zum Chat-Modell hinzu. Probiere bei einem vorhandenen lokalen Modell erst dessen Decisions, bevor du ein weiteres herunterlädst.

Die eingebauten Open-Jev-Modelle brauchen Linux **x86-64**, eine NVIDIA-GPU mit Compute Capability 7,5 oder neuer (Turing, RTX-20-Serie oder neuer) und Treiber 580 oder neuer. Linux-ARM-Geräte und Pascal-Karten oder ältere GPUs werden von diesen Paketen nicht unterstützt. Kann ein Modell nicht laufen, bleibt die Option mit Begründung sichtbar und bietet stattdessen die Einrichtung einer Decision-Verbindung an.

| Eingebautes Modell | Modell-Download | Festplatte einschließlich Laufzeit | GPU-Speicher |
| --- | --- | --- | --- |
| Open-Jev 2B | Etwa 4,6 GB | Etwa 10 GB | Etwa 4,8 GB (4,5 GiB) |
| Open-Jev 9B | Etwa 19,4 GB | Etwa 25,3 GB | Etwa 23,6 GB (22 GiB) |

Dies sind Katalogschätzungen anhand festgelegter Modellversionen und gemessener Aufgaben. GPU-Bedarf und Geschwindigkeit hängen von der Aufgabe ab. 9B lässt auf einer GPU mit 24 GB wenig Reserve; beachte die Einschätzung des Installers für deine gewählte Karte und andere laufende Modelle.

1. Öffne **Connections**, klapp **Local Model** auf und wähle **Decision sidecar (experimental)** (experimenteller Decision-Sidecar).
2. Lies die Warnung und aktiviere **Enable decision sidecar** (Decision-Sidecar aktivieren). Nach der Bestätigung erscheint die Einschätzung für deinen Rechner. Ist sie eine Warnung, heißt die Schaltfläche **Enable anyway** (trotzdem aktivieren).
3. Wähle ein Modell und bestätige Größe, Hardwareeinschätzung und Lizenzen. Vorher wird nichts heruntergeladen. **Open-Jev 2B** benötigt viel weniger Speicher als **Open-Jev 9B**; keines garantiert richtige Antworten für deinen Chat.
4. Wähle unter **Decision model** den **Decision sidecar**.

**Geschwindigkeit.** Die erste Antwort eines frisch gestarteten Modells ist langsamer. Marinara stellt deshalb beim Laden eine Frage zum Aufwärmen. Gelingt das, zeigen **Test** und der erste Zug die normale Geschwindigkeit. Schlägt es fehl, startet das Modell trotzdem; die Verzögerung fällt dann bei der ersten Frage an. Jede Aussage liest den jüngsten Chat erneut. Ein Zug mit vielen Aussagen dauert bei langem Verlauf daher länger: Open-Jev 2B benötigt bei einem langen Chat ungefähr eine Viertelsekunde pro Aussage.

Du kannst auch das HuggingFace-Repository eines Entscheidungsmodells einfügen. Marinara liest dessen eigenes Manifest, prüft den Artefakttyp gegen die in diesem Build enthaltenen Laufzeiten und zeigt Basisgewichte und Gesamtgröße vor dem Installationsangebot. Ein nicht überprüfbares Repository wird mit Begründung abgelehnt.

Bei mehreren NVIDIA-GPUs wählst du im Menü **GPU** die Karte zum Laden. Die Einschätzung gilt für diese Karte. Ein Wechsel stoppt das Modell, damit es dort neu startet.

Ausschalten des Sidecars beendet den Prozess und behält die Dateien. **Remove files** (Dateien entfernen) löscht Modell und Laufzeit und bleibt auch bei ausgeschaltetem Sidecar verfügbar.

<a id="thresholds"></a>

## Schwellenwerte

Wahrscheinlichkeiten verschiedener Modelle sind nicht direkt vergleichbar. Dasselbe positive Beispiel kann bei einem Modell 0,99 und bei einem anderen 0,2 erhalten. Marinaras Standardschwelle hängt von der Verbindungsart ab:

| Gewähltes Backend | Standard-Ja/Nein-Schwelle |
| --- | --- |
| Primäres oder lokales Hilfs-Chat-Modell oder eine Verbindung zu einem OpenAI-kompatiblen Chat-Modell | 0,5 |
| Decision-Verbindung über TypeSafe, OpenRouter oder Custom System One | 0,5 |
| Verwalteter Decision-Sidecar | Empfehlung seines Modellmanifests; 0,1 für die eingebauten Open-Jev 2B und 9B |

**Run when probability is at least** (ab dieser Wahrscheinlichkeit ausführen) eines Agenten kann den Standard überschreiben. Weicht der gespeicherte Wert ab, bietet der Editor die Wiederherstellung der Backend-Empfehlung an. Prüfe die Einstellung bei jedem Modellwechsel.

Prompt-Aussagen und Decision-Felder im Lorebook verwenden den Backend-Standard; eine geänderte Agentenschwelle ändert diesen nicht. **Ein selbst gehostetes Open-Jev hinter einer Custom-System-One-Verbindung verwendet weiterhin 0,5.** Marinara kann beliebige eigene Endpunkte nicht automatisch identifizieren und kalibrieren. Ergebnisse können deshalb vom verwalteten Open-Jev-Sidecar abweichen; etwa gilt ein positives Ergebnis unter 0,5 als nein.

<a id="time-limits"></a>

## Zeitlimits

Eine zu späte Decision liefert keine Antwort. Die Generierung läuft mit dem [Ersatzverhalten der Funktion](#where-marinara-uses-it) weiter; dadurch können ein Prompt-Zweig oder ein mit Require gesperrter Lorebook-Eintrag fehlen.

Jedes Zeitlimit gilt pro Aussage. Eine Anfrage mit mehreren Aussagen erhält das Limit für jede davon; jede Choice-Antwort zählt als eine Aussage. Ein lokales Modell bearbeitet nur wenige Anfragen gleichzeitig. Aussagen warten deshalb auf ihren Platz, und ihre Zeit beginnt erst, wenn das Modell sie bearbeitet.

- **1,5 Sekunden** pro Aussage bei einer Decision-Verbindung über TypeSafe, OpenRouter oder Custom System One, sofern du ihr **Time limit** nicht änderst. Siehe [Eine Decision-Verbindung einrichten](#set-up-a-decision-connection).
- **4 Sekunden** pro Aussage bei einer Verbindung zu einem OpenAI-kompatiblen Chat-Modell, sofern du ihr **Time limit** nicht änderst. Ein zuerst nachdenkendes Modell erhält mindestens 20 Sekunden.
- **4 Sekunden** pro Aussage bei einem lokalen Modell.
- **4 Sekunden** für die erste Aussage des Decision-Sidecars. Jede weitere erhält die gemessene Modellzeit: 0,35 Sekunden bei Open-Jev 2B und 0,8 Sekunden bei Open-Jev 9B. Ein durch Einfügen seines Repositorys installiertes Modell erhält jeweils 4 Sekunden.
- **20 Sekunden** pro Aussage bei einem lokalen Modell, das zuerst nachdenken muss.

Decision-Anfragen enden beim Abbruch einer Generierung.

## Weitere Einstellungen unter Decision model

- **Also use it to pick who speaks in Smart response order.** Standardmäßig aus. Siehe [Gruppenchats](../chats/group-chats.md#response-order-individual-only).
- **Decision statements per turn** (Decision-Aussagen pro Zug). Begrenzt die Planung von Prompt- und Lorebook-Aussagen; Standard 32, höchstens 255. Das Kontingent gilt in mehreren Phasen, nicht als einzelne Obergrenze für sämtliche Decision-Anfragen oder Kosten eines Zuges. Aktivierungsfragen und Smart sind davon unabhängig. Geltungsbereich, Bündelung und Priorität stehen unter [Grenzen und Kosten](../prompts/conditional-prompts.md#limits-and-cost).
- **Also gate agents that run before the reply** und **Thinking** erscheinen für **Primary local model** und **Utility local model**. Der Decision-Sidecar denkt nie erst nach und hat deshalb keine der beiden Optionen. Siehe [Ein bereits laufendes Modell verwenden](#use-a-model-you-already-run).

## Genauigkeit: Falsche Antworten einplanen

Jedes Modell kann falsch antworten. Im kleinen Formulierungstest oben lagen mehrere richtige Ja-Antworten von Open-Jev 2B nur knapp über seiner Schwelle. Plane fehlende und falsche Antworten ein:

- Verwende Decisions zur Feinabstimmung, niemals für unverzichtbare Chat-Inhalte. Eine verpasste Decision soll eine Antwort etwas weniger passend machen, sie aber nicht unbrauchbar werden lassen.
- Mache Einverständnis, Inhaltshinweise und Sicherheitsanweisungen nicht von einer Decision abhängig.
- Setze bei einem nur über eine Aktivierungsfrage laufenden Agenten **Bypass the question after this many messages** (Frage nach dieser Anzahl Nachrichten umgehen), damit ein anhaltendes nein ihn nicht dauerhaft stilllegt.

Konkrete Formulierungsbeispiele und Tests für eigene Chats stehen unter [Aussagen formulieren](../prompts/conditional-prompts.md#writing-statements).

## Fehlerbehebung

- **Test schlägt fehl.** Die Meldung nennt den Grund: abgelehnter Key, Anbieter begrenzt Anfragen, lokales Modell läuft nicht, Entscheidungsmodell nicht installiert, keine Ja/Nein-Antwort oder Zeitüberschreitung.
- **Test meldet, dass dieser Endpunkt auf dem Server nicht existiert.** Die Decision-Quelle passt nicht zum Server. Ollama, LM Studio und andere Chat-Modell-Server benötigen **OpenAI-compatible chat model**. **Custom System One endpoint** ist nur für System-One-Server wie Open-Jev gedacht.
- **Test meldet eine Antwort nach dem Zeitlimit oder Decisions funktionieren nur gelegentlich.** Der Anbieter antwortet zumindest gelegentlich langsamer als das **Time limit** der Verbindung. Teste mehrmals und erhöhe das Limit über die langsamste Antwort hinaus.
- **Ein Agent mit Aktivierungsfrage läuft jeden Zug.** Kein Decision-Modell ist gewählt oder es antwortet nicht; der Agent läuft so, als hätte er keine Frage. Prüfe **Test**.
- **Ein Decision-Zweig im Prompt erscheint nie.** Siehe [Wenn ein Decision-Zweig nie erscheint](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **Smart verwendet weiterhin seinen gewöhnlichen KI-Aufruf.** Der Schalter ist aus oder das Decision-Modell hat in diesem Zug nicht geantwortet.
- **Um Entscheidungswerte und Ausgaben während der Generierung zu sehen**, aktiviere Debug Mode oder setze das Log-Level auf debug. Logs zu Prompt-Entscheidungen enthalten Schwellenwerte, Ergebnisse und Angaben dazu, ob Antworten wiederverwendet oder durch Zeitregeln gehalten wurden. Siehe [Logging-Level](../CONFIGURATION.md#logging-levels).
- **Um eigene Aussagen ohne Generierung einer Antwort zu testen**, öffne **Peek Prompt → Decision diagnostics → Test decisions** (Peek Prompt → Entscheidungsdiagnose → Entscheidungen testen). Eingabevorschauen sind passiv; ausdrückliche Tests rufen das gewählte Modell auf und können bei gehosteten Modellen Gebühren verursachen. Siehe [Entscheidungsaussagen testen](../chats/peek-prompt.md#testing-decision-statements).

## Verwandte Anleitungen

- [Eigene Agenten erstellen](../agents/custom-agents.md)
- [Bedingte Prompts](../prompts/conditional-prompts.md)
- [Gruppenchats](../chats/group-chats.md)
- [Ein lokales Modell einrichten](local-model.md)
- [Mit einem KI-Anbieter verbinden](connecting-to-a-provider.md)
