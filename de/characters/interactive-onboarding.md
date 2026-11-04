# Interaktives Onboarding

Das brauchst du nur, wenn du Karten erstellst, die andere spielen sollen. Mit interaktivem Onboarding stellt eine Charakterkarte dem Spieler Fragen, wenn er einen Roleplay-Chat startet, und baut aus den Antworten eine Persona. Autoren richten es im Charakter-Editor ein. Spieler antworten im Einrichtungsassistenten für neue Chats.

## Was es bewirkt

Eine Persona ist die Charakterkarte, die dich in einem Chat vertritt. Siehe [Personas](personas.md). Normalerweise schreibst du eine selbst, bevor du spielst. Mit Onboarding bringt die Karte stattdessen eine Persona-Vorlage mit: die fünf Persona-Felder (**Description**, **Personality**, **Backstory**, **Appearance** und **Scenario**) mit Lücken für den Spieler und dazu die Fragen, die diese Lücken füllen.

Startet ein Spieler mit der Karte einen Roleplay-Chat, kann er **Create your persona** (deine Persona erstellen) wählen, die Fragen beantworten und so eine neue, gewöhnliche Persona erhalten. Die Antworten werden einmalig in den Text geschrieben. Der Spieler kann die Persona wie jede andere bearbeiten, behalten oder löschen. Die Karte ändert sich nicht.

Eine Karte kann außerdem Charakterfragen stellen. Ihre Antworten werden im jeweiligen Chat gespeichert statt in einer Persona. Siehe [Charakterfragen](#character-questions). Onboarding nutzt die vorhandene Makro-Syntax und führt keine Skripte aus.

## Als Autor einrichten

1. Öffne den Charakter im Charakter-Editor. Siehe [Charaktere anlegen und bearbeiten](creating-and-editing-characters.md).
2. Öffne den Tab **Onboarding** neben **Card**.
3. Schalte **Interactive onboarding** (interaktives Onboarding) ein. Unter dem Schalter erscheint eine kurze Anleitung **How onboarding works** (so funktioniert Onboarding).

Schaltest du den Schalter aus, werden die Onboarding-Felder ausgeblendet, dein Text bleibt aber erhalten.

### Professor Mari schreiben lassen

Frag [Professor Mari](../home/professor-mari.md), zum Beispiel: „Schreib ein lustiges Onboarding für Königin Ayrene, mit einer Persona-Vorlage.“ Sie schreibt die Fragen und die Persona-Felder und schaltet das Onboarding ein. Die App prüft ihre Arbeit vor dem Speichern. Ein falsch geschriebener Name, ein `{{name}}` ohne zugehörige Frage oder eine Bedingung, der ihr `#` fehlt, geht zur Korrektur an sie zurück. Bei einer Charakterfrage setzt sie außerdem deren `{{name}}` in eines der eigenen Felder der Karte ein. Ihre Änderungen erscheinen auf einer Änderungskarte, die du prüfen oder rückgängig machen kannst.

### Persona-Fragen hinzufügen

Klick unter **Persona Questions** (Persona-Fragen) auf **Add Question** (Frage hinzufügen). Jede Frage funktioniert wie eine Preset-Variable, also wie eine benannte Lücke, die eine Antwort füllt. Siehe [Presets](../prompts/presets.md). Eine Karte kann bis zu 100 Fragen haben.

| Feld | Was es bewirkt |
| --- | --- |
| **Variable Name** (Variablenname) | Der Name, den du in den Feldern verwendest, etwa `faction`. Verwende Buchstaben, Ziffern und Unterstriche, beginnend mit einem Buchstaben oder einem Unterstrich. Groß- und Kleinschreibung zählt: `Gender` und `gender` sind verschieden. |
| **Question (shown to user)** | Das, was der Spieler liest. Die Frage kann frühere Antworten verwenden, etwa `What does {{player}} look like?`. `{{char}}` ist der Name der Karte und `{{user}}` der Name des Spielers. |
| **Options** (Optionen) | Machen aus der Frage eine Auswahl. Die erste Option ist vorausgewählt. Ohne Optionen tippt der Spieler eine freie Antwort. |
| **Value** (Wert) | Das, was in die Persona eingesetzt wird. Groß- und Kleinschreibung bleiben so, wie du sie tippst, und Makros darin werden ausgefüllt. Lässt du das Feld leer, wird die Beschriftung der Option verwendet. Verwende einen kleingeschriebenen Wert wie `ranger`, wenn die Antwort mitten im Satz steht. |
| **Help text for players** (Hilfetext für Spieler) | Optionaler Text unter der Option. |
| **Allow own answer** (eigene Antwort erlauben) | Ergänzt neben deinen Optionen die Auswahl **Write your own** (eigene Antwort schreiben). |
| **Multi-Select** (Mehrfachauswahl) | Lässt den Spieler mehrere Optionen wählen, verbunden mit dem Trennzeichen. |

Eine Frage namens `player` legt den Namen der Persona fest. Ohne eine solche Frage werden Spieler zuerst nach ihrem Namen gefragt. Der Editor warnt dich, wenn ein Name leer, ungültig, doppelt vergeben oder von einem eingebauten Makro belegt ist und wenn kein Feld eine Frage verwendet.

### Die Persona-Felder schreiben

Schreib die fünf Felder wie bei einer eigenen Persona und setz `{{name}}` dort ein, wo eine Antwort hingehört. Klick in ein Feld, um seine **Available variables** (verfügbare Variablen) zu sehen, und klick auf eine davon, um sie an der Cursorposition einzufügen.

```text
Name: {{player}}
Class: {{class}}
Role: {{player}} is a {{class}} sworn to {{faction}}.
```

Mit `{{#if}}` zeigst du Text nur bei bestimmten Antworten an:

```text
{{#if knowsHer == yes}}Grew up next door to {{char}}. {{relationToAna}}{{/if}}
```

Eine Frage, die nur innerhalb eines `{{#if}}` vorkommt, wird nur gestellt, wenn die Bedingung erfüllt ist. Hier ist `relationToAna` eine Anschlussfrage, die erscheint, sobald der Spieler **yes** antwortet. Vergleiche ignorieren Groß- und Kleinschreibung.

`{{user}}` und `{{char}}` bleiben in der erstellten Persona als Makros stehen. Andere Makros (Platzhalter, die Marinara ausfüllt, etwa `{{random}}` für eine Zufallszahl oder `{{time}}` für die Uhrzeit) werden beim Erstellen der Persona einmalig ausgefüllt oder bleiben leer, wenn sie zu diesem Zeitpunkt keinen Wert haben.

Die **Rendered preview** (gerenderte Vorschau) ganz unten zeigt die Persona, die aus Beispielantworten entsteht, und listet die gestellten Fragen der Reihe nach auf.

<a id="character-questions"></a>

### Charakterfragen

Derselbe Tab hat eine zweite Liste, **Character Questions** (Charakterfragen). Sie funktionieren wie Persona-Fragen, aber die Antworten werden im Chat gespeichert, nicht in einer Persona. Setz den Namen in eines der eigenen Felder der Karte ein (**Description**, **Personality**, **Backstory**, **Appearance** oder **Scenario**), denn diese Felder liest das Modell.

```text
{{char}} treats {{relationshipToUser}} with open warmth.
```

Eine Begrüßung kann das `{{name}}` einer Charakterfrage verwenden und zeigt dann die Antwort des Spielers. Eine Begrüßung kann auch das `{{name}}` einer Persona-Frage verwenden, etwa `Ah, so you are a {{class}}`. Es wird aber nur ausgefüllt, wenn der Spieler diese Persona im Einrichtungsassistenten für neue Chats erstellt, und zwar in der ersten Nachricht und ihren alternativen Begrüßungen. Bei einer vorhandenen Persona oder Quick Start erscheint das Tag unverändert, und der Charakter-Editor warnt dich. Klick in eine Begrüßung, und ihre **Available variables** zeigen beide Arten, jeweils beschriftet.

Die Antworten werden als Chat-Variablen gespeichert. So liest die Karte in jedem Chat einen anderen Wert und muss nie bearbeitet werden. Eine Charakterfrage wird immer gestellt, wenn die Karte im Chat ist, egal ob der Spieler eine Persona erstellt. Das Fenster zeigt **About you** (Über dich) nur, wenn gerade eine Persona entsteht.

Drei Dinge solltest du wissen:

- **Eine Antwort, die nie ausgefüllt wird, bleibt als Tag stehen.** Eine Freitextfrage ohne Standardwert wird nicht vorbelegt. Ein Chat, der ohne den Einrichtungsassistenten gestartet wurde, zeigt deshalb `{{name}}` unverändert an. Auswahlfragen belegen ihre erste Option vor, was die meisten Karten abdeckt.
- **Deklarieren zwei Karten in einem Chat denselben Namen, teilen sie sich einen Wert.** Beide lesen die zuletzt gespeicherte Antwort. Das Fenster warnt dich.
- **Eine Karte, die einen Chat verlässt, nimmt ihre Antworten mit.** Wird ein Charakter entfernt, werden die Chat-Variablen gelöscht, die seinen Charakterfragen gehören, außer ein anderer Charakter im Chat deklariert denselben Namen.

## Die Fragen als Spieler beantworten

1. Starte einen neuen Roleplay-Chat. Im Schritt **Persona & Characters** (Persona und Charaktere) zeigen Karten mit Onboarding in der Charakterliste ein kleines Symbol mit Person und Pluszeichen.
2. Füge den Charakter hinzu. Willst du eine neue Persona bekommen, wähl oben in **Your Persona** (deine Persona) **Create your persona** aus. Der Eintrag nennt die Karte, zu der er gehört. Jede andere Auswahl, auch **None**, überspringt die Persona.
3. Klick auf **Next** (Weiter). Das Fragenfenster öffnet sich immer dann, wenn eine Karte im Chat Charakterfragen hat, egal ob du eine Persona erstellst.
4. Beantworte die Fragen. Zuerst kommen die Charakterfragen, ein Abschnitt pro Karte, danach **About you**, wenn eine Persona entsteht. Anschlussfragen erscheinen, sobald deine Antworten sie relevant machen.
5. Klick auf **Review persona** (Persona prüfen), um den Namen und die Felder zu sehen, die aus deinen Antworten entstehen. Die Stellen, die deine Antworten ausgefüllt haben, sind hervorgehoben. Die Vorschau speichert nichts.
6. Klick auf **Create persona** (Persona erstellen) oder auf **Save answers** (Antworten speichern), wenn du keine erstellst. Die Charakterantworten werden im Chat gespeichert, und der Einrichtungsassistent macht weiter.

Wenn es nicht funktioniert hat: Wurde die Persona erstellt, aber nicht ausgewählt, wähl sie unter **Your Persona** aus. Konnten die Antworten nicht gespeichert werden, verwendet der Chat stattdessen den eigenen Standardtext jeder Karte.

Die Onboarding-Fragen werden im Einrichtungsassistenten für neue Roleplay-Chats gestellt. Quick Start, die Einrichtung eines Conversation-Chats und der Start eines Chats direkt von einer Charakterkarte aus stellen sie noch nicht. Ein so gestarteter Chat belegt die erste Option jeder Frage vor, sodass `{{relationshipToUser}}` einen Wert bekommt und nicht als Tag erscheint. Antwortest du im Einrichtungsassistenten, ersetzt das diesen Standardwert nur für diesen Chat.

Du kannst auch nach der Einrichtung antworten, über **Chat Settings** (Chat-Einstellungen):

- Die Auswahl **Persona** in einem Roleplay-Chat listet **Create your persona** für jede Karte im Chat auf, die das anbietet. Nutze sie, wenn du den Einrichtungsassistenten übersprungen hast oder später eine neue Persona willst. Siehe [Die Persona für einen Chat auswählen](choosing-your-persona.md).
- Die Onboarding-Markierung neben einem Charakter unter **Characters** (Charaktere) öffnet nur die Charakterfragen dieser Karte erneut. Sie startet mit den Antworten, die der Chat bereits hat. Speicherst du eine Änderung, bleiben die anderen Antworten also, wie sie waren. Das Speichern stellt außerdem eine Antwort wieder her, die du unter **Chat Variables** (Chat-Variablen) gelöscht hast. Die Antworten anderer Karten bleiben unberührt, außer bei einem Namen, den zwei Karten teilen: Er ist ein einziger Wert, also lesen beide Karten die neue Antwort.

Fügst du einem laufenden Roleplay-Chat eine Karte mit Charakterfragen hinzu, über **Chat Settings** oder indem du sie auf den Chat ziehst, stellt der Chat zuerst ihre Fragen. Danach bietet er ihre Begrüßung mit deinen eingesetzten und markierten Antworten an.

## Karten mit Onboarding teilen

Das Onboarding wird mit der Karte gespeichert. Exporte als **Marinara Native** und **Compatible PNG Card** behalten es, sodass ein Spieler, der die Karte importiert, die Fragen ebenfalls bekommt. **Compatible JSON** lässt es weg. Eine importierte Karte mit mehr als 100 Fragen behält die ersten 100. Siehe [Charakterkarten importieren und exportieren](import-export.md).

## Verwandte Anleitungen

- [Charaktere anlegen und bearbeiten](creating-and-editing-characters.md)
- [Personas](personas.md)
- [Die Persona für einen Chat auswählen](choosing-your-persona.md)
- [Makros](../prompts/macros.md)
- [Charakterkarten importieren und exportieren](import-export.md)
