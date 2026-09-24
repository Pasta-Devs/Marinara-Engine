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

## Ein Decision-Modell auswählen

Öffne **Connections** (Verbindungen), dann **Connection defaults** (Standardverbindungen), und wähle unter **Decision model**. Die Liste hat drei Gruppen:

- **None** (keines), der Standard. Es wird nichts gefragt, und die Felder für Aktivierungsfragen im Agenten-Editor bleiben deaktiviert.
- **Local models** (lokale Modelle): das bereits laufende **Primary local model** (primäres lokales Modell) oder **Utility local model** (lokales Hilfsmodell). Nichts wird heruntergeladen und nichts verlässt deinen Rechner. Auch ein installierter **Decision sidecar** steht hier.
- **Connections**: selbst angelegte Decision-Verbindungen, gehostet oder selbst betrieben.

Gerade nicht verfügbare Einträge bleiben ausgegraut samt Begründung in der Liste, damit du weißt, was zu beheben ist. Klick nach der Auswahl auf **Test**. Der Test sendet ein festes Beispiel, nicht deinen Chat.

### Welche Möglichkeit passt?

Läuft bereits ein lokales Modell, probiere es zuerst. In einem kleinen Formulierungstest aus einer Roleplay-Szene beantwortete Gemma 4 E4B alle 32 empfohlenen Aussagen richtig, Open-Jev 2B und 9B jeweils 31. Das zeigt, warum Formulierungen wichtig sind; es ist keine allgemeine Rangliste der Genauigkeit. Prüfe typische Züge aus deinen eigenen Chats; siehe [Aussagen formulieren](../prompts/conditional-prompts.md#writing-statements).

**Jev und Open-Jev sind unterschiedliche Modelle.** Jev ist das gehostete Modell von TypeSafe, direkt oder über OpenRouter verfügbar. [Open-Jev](https://huggingface.co/ZefanCai/Open-Jev-2B) ist ein separat veröffentlichtes Modell auf Qwen-Basis, das Marinara lokal ausführen kann. Die Formulierungstests mit Open-Jev messen nicht die Genauigkeit des gehosteten Jev.

| Möglichkeit | Kosten | Voraussetzungen | Geeignet für |
| --- | --- | --- | --- |
| Ein bereits laufendes Modell | Keine zusätzlichen Kosten | Ein lokales Modell unter **Local Model** | Die meisten Nutzer mit einem lokalen Modell |
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

<a id="set-up-a-decision-connection"></a>

## Eine Decision-Verbindung einrichten

1. Erstelle unter **Connections** eine Verbindung mit dem Anbieter **Decision**.
2. Wähle **TypeSafe**, **OpenRouter** oder **Custom System One endpoint** (eigener System-One-Endpunkt). Gehostete Quellen brauchen einen API-Key. Custom akzeptiert einen bereits laufenden System-One-Server einschließlich Open-Jev. Gib dessen Basis-URL ohne `/v1/systemone` und einen unterstützten Modellnamen ein.
3. Wähle für OpenRouter unter **API key source** (API-Key-Quelle) eine gespeicherte OpenRouter-Verbindung oder gib einen eigenen Key ein. Ihr Editor bietet auch **Use this key for decisions (Jev)** (diesen Key für Decisions verwenden). Verknüpfte Keys folgen späteren Änderungen automatisch. Eigene Verbindungen dürfen den Key einer eigenen Chat-Verbindung nur ausleihen, wenn beide URLs denselben Ursprung haben: Schema, Host und Port.
4. Speichere, wähle die Verbindung unter **Decision model** und klick auf **Test**. Ein Erfolg zeigt Wahrscheinlichkeit, Antwortdauer und Zeitlimit der Verbindung. Test wartet mindestens 10 Sekunden sowie 5 Sekunden über ein längeres Limit hinaus, um auch langsame Antworten mit ihrer wirklichen Dauer zu melden. Überschreitet die Antwort das Limit, steht das im Ergebnis: Im Chat würde sie als keine Antwort gelten.

Der Decision-Standard ist unabhängig von den Standards für Chat, Agenten, Bilder, Video und Audio. **None** schaltet Decisions aus, ohne Aktivierungsfragen oder Decision-Aussagen zu löschen.

Gehostete Decisions senden die ausgewählten jüngsten Nachrichten und Aussagen an den gewählten Anbieter und können Kosten verursachen. Smart sendet zusätzlich die [Charakterliste](#what-the-model-sees). Das **Recent-message token budget** (Token-Budget der jüngsten Nachrichten) beträgt standardmäßig 30.000 geschätzte Tokens bei gehosteten Quellen und 3.500 bei eigenen Servern. Verringere es bei kleinerem Server-Kontext. Marinara entfernt zuerst ältere Nachrichten und kürzt danach den ältesten Teil der neuesten Nachricht. Die Schätzung kann vom Tokenizer des Servers abweichen; eine abgelehnte oder zu große Anfrage liefert keine Antwort.

**Time limit (seconds)** (Zeitlimit in Sekunden) legt fest, wie lange eine Decision-Verbindung während eines Chats auf eine Antwort wartet: 0,5 bis 30 Sekunden, standardmäßig 1,5. Spätere Antworten gelten als keine Antwort. Manche gehosteten Anbieter brauchen gelegentlich mehr als 1,5 Sekunden; dann wirken Decisions zufällig defekt. Klick deshalb mehrmals auf **Test** und setze das Limit oberhalb der langsamsten Antwort. Der Preis dafür: Eine Prüfung vor der Antwort, etwa eine Decision im Preset oder eine Aktivierungsfrage eines vorher laufenden Agenten, kann die Chat-Antwort bis zu dieser Dauer aufhalten.

Löschst du eine Verbindung, deren Key verknüpft ist, erscheint eine Warnung; die Decision-Verbindung muss anschließend neu verknüpft werden. Auch importierte einzelne Verbindungsdateien brauchen neue Keys oder Verknüpfungen; sie enthalten niemals API-Keys oder IDs ausgeliehener Verbindungen.

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

Du kannst auch das HuggingFace-Repository eines Entscheidungsmodells einfügen. Marinara liest dessen eigenes Manifest, prüft den Artefakttyp gegen die in diesem Build enthaltenen Laufzeiten und zeigt Basisgewichte und Gesamtgröße vor dem Installationsangebot. Ein nicht überprüfbares Repository wird mit Begründung abgelehnt.

Bei mehreren NVIDIA-GPUs wählst du im Menü **GPU** die Karte zum Laden. Die Einschätzung gilt für diese Karte. Ein Wechsel stoppt das Modell, damit es dort neu startet.

Ausschalten des Sidecars beendet den Prozess und behält die Dateien. **Remove files** (Dateien entfernen) löscht Modell und Laufzeit und bleibt auch bei ausgeschaltetem Sidecar verfügbar.

<a id="thresholds"></a>

## Schwellenwerte

Wahrscheinlichkeiten verschiedener Modelle sind nicht direkt vergleichbar. Dasselbe positive Beispiel kann bei einem Modell 0,99 und bei einem anderen 0,2 erhalten. Marinaras Standardschwelle hängt von der Verbindungsart ab:

| Gewähltes Backend | Standard-Ja/Nein-Schwelle |
| --- | --- |
| Primäres oder lokales Hilfs-Chat-Modell | 0,5 |
| Decision-Verbindung über TypeSafe, OpenRouter oder Custom System One | 0,5 |
| Verwalteter Decision-Sidecar | Empfehlung seines Modellmanifests; 0,1 für die eingebauten Open-Jev 2B und 9B |

**Run when probability is at least** (ab dieser Wahrscheinlichkeit ausführen) eines Agenten kann den Standard überschreiben. Weicht der gespeicherte Wert ab, bietet der Editor die Wiederherstellung der Backend-Empfehlung an. Prüfe die Einstellung bei jedem Modellwechsel.

Prompt-Aussagen und Decision-Felder im Lorebook verwenden den Backend-Standard; eine geänderte Agentenschwelle ändert diesen nicht. **Ein selbst gehostetes Open-Jev hinter einer Custom-System-One-Verbindung verwendet weiterhin 0,5.** Marinara kann beliebige eigene Endpunkte nicht automatisch identifizieren und kalibrieren. Ergebnisse können deshalb vom verwalteten Open-Jev-Sidecar abweichen; etwa gilt ein positives Ergebnis unter 0,5 als nein.

<a id="time-limits"></a>

## Zeitlimits

Eine zu späte Decision liefert keine Antwort. Die Generierung läuft mit dem [Ersatzverhalten der Funktion](#where-marinara-uses-it) weiter; dadurch können ein Prompt-Zweig oder ein mit Require gesperrter Lorebook-Eintrag fehlen.

- **1,5 Sekunden** bei einer Decision-Verbindung, sofern du ihr **Time limit** nicht änderst. Siehe [Eine Decision-Verbindung einrichten](#set-up-a-decision-connection).
- **4 Sekunden** bei einem lokalen Modell oder Decision-Sidecar. Fragt ein Zug viele Aussagen ab, erhält Open-Jev 9B für jede zusätzliche Aussage etwas mehr Zeit.
- **20 Sekunden** bei einem lokalen Modell, das zuerst nachdenken muss.

Decision-Anfragen enden beim Abbruch einer Generierung.

## Weitere Einstellungen unter Decision model

- **Also use it to pick who speaks in Smart response order.** Standardmäßig aus. Siehe [Gruppenchats](../chats/group-chats.md#response-order-individual-only).
- **Decision statements per turn** (Decision-Aussagen pro Zug). Begrenzt die Planung von Prompt- und Lorebook-Aussagen; Standard 32, höchstens 255. Das Kontingent gilt in mehreren Phasen, nicht als einzelne Obergrenze für sämtliche Decision-Anfragen oder Kosten eines Zuges. Aktivierungsfragen und Smart sind davon unabhängig. Geltungsbereich, Bündelung und Priorität stehen unter [Grenzen und Kosten](../prompts/conditional-prompts.md#limits-and-cost).
- **Also gate agents that run before the reply** und **Thinking** erscheinen bei einem lokalen Modell. Siehe [Ein bereits laufendes Modell verwenden](#use-a-model-you-already-run).

## Genauigkeit: Falsche Antworten einplanen

Jedes Modell kann falsch antworten. Im kleinen Formulierungstest oben lagen mehrere richtige Ja-Antworten von Open-Jev 2B nur knapp über seiner Schwelle. Plane fehlende und falsche Antworten ein:

- Verwende Decisions zur Feinabstimmung, niemals für unverzichtbare Chat-Inhalte. Eine verpasste Decision soll eine Antwort etwas weniger passend machen, sie aber nicht unbrauchbar werden lassen.
- Mache Einverständnis, Inhaltshinweise und Sicherheitsanweisungen nicht von einer Decision abhängig.
- Setze bei einem nur über eine Aktivierungsfrage laufenden Agenten **Bypass the question after this many messages** (Frage nach dieser Anzahl Nachrichten umgehen), damit ein anhaltendes nein ihn nicht dauerhaft stilllegt.

Konkrete Formulierungsbeispiele und Tests für eigene Chats stehen unter [Aussagen formulieren](../prompts/conditional-prompts.md#writing-statements).

## Fehlerbehebung

- **Test schlägt fehl.** Die Meldung nennt den Grund: abgelehnter Key, Anbieter begrenzt Anfragen, lokales Modell läuft nicht, Entscheidungsmodell nicht installiert, keine Ja/Nein-Antwort oder Zeitüberschreitung.
- **Test meldet eine Antwort nach dem Zeitlimit oder Decisions funktionieren nur gelegentlich.** Der Anbieter antwortet zumindest gelegentlich langsamer als das **Time limit** der Verbindung. Teste mehrmals und erhöhe das Limit über die langsamste Antwort hinaus.
- **Ein Agent mit Aktivierungsfrage läuft jeden Zug.** Kein Decision-Modell ist gewählt oder es antwortet nicht; der Agent läuft so, als hätte er keine Frage. Prüfe **Test**.
- **Ein Decision-Zweig im Prompt erscheint nie.** Siehe [Wenn ein Decision-Zweig nie erscheint](../prompts/conditional-prompts.md#when-a-decision-branch-never-appears).
- **Smart verwendet weiterhin seinen gewöhnlichen KI-Aufruf.** Der Schalter ist aus oder das Decision-Modell hat in diesem Zug nicht geantwortet.
- **Um jede Aussage und Antwort zu sehen**, setze das Log-Level auf debug. Siehe [Logging-Level](../CONFIGURATION.md#logging-levels).

## Verwandte Anleitungen

- [Eigene Agenten erstellen](../agents/custom-agents.md)
- [Bedingte Prompts](../prompts/conditional-prompts.md)
- [Gruppenchats](../chats/group-chats.md)
- [Ein lokales Modell einrichten](local-model.md)
- [Mit einem KI-Anbieter verbinden](connecting-to-a-provider.md)
