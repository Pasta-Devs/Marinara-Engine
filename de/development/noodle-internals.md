# Noodle-Prompt-Interna (Entwicklung)

Entwickler-Referenz: wo die Generierungs-Prompts von Noodle im Code liegen, wie du sie anpasst und wie du die fertigen Prompts debuggst. Ein Prompt ist der Text, den Marinara an die KI schickt. Endnutzende konfigurieren Noodle über das **Settings**-Panel (Einstellungen); dazu gibt es die Noodle-Anleitungen in `docs/noodle/`.

Noodle ist ein herunterladbares Paket. Seine Routen (`/api/noodle`, registriert beim Aktivieren des Pakets) und sein Generierungscode liegen im Noodle-Paket in [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), unter `packages/noodle/src/engine/packages/server/src/`. In der Tabelle unten ist eine mit **package** markierte Quelle relativ zu diesem Ordner angegeben. Die Engine behält das gemeinsame Noodle-Schema und die Typen, den Noodle-Speicher, die registrierten Prompt-Overrides, die Settings auflistet, und den Standardtext des Timeline-Prompts in `packages/server/src/services/noodle/noodle-prompt.ts`. Das Paket hat eigene Kopien von `services/prompt-overrides/registry/noodle.ts` und `services/noodle/noodle-prompt.ts`.

## Übersicht der Prompt-Quellen

Noodle hat einen zusammengesetzten Timeline-Prompt, einen inline hinterlegten Profil-Prompt und drei registrierte Prompt-Overrides: zwei für den System-Prompt der Timeline und einen für Post-Bilder.

| Zweck                                                       | Quelle                                                             | Hauptsymbol                                     | Anpassung                                                                                                                      |
| ----------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Timeline-Posts, Antworten, Follows, Umfragen, Stimmen und Digests | **package** `services/noodle/noodle-public-prompt.service.ts`      | `buildRefreshPrompt()`                          | Die System-Nachricht besteht aus dem Override **Noodle Timeline Prompt**, gefolgt vom Override **Noodle Timeline Voice & Tone** (beide unten). Die beiden Nutzer-Nachrichten, der Kontext (Accounts, Persona, Profile, Zeitpläne, Lore, freigegebener Chat-Kontext, die Timeline, aktivierte Funktionen und Kontingente) und die Nachricht `# JSON Output Format` werden im Code zusammengesetzt. |
| Basis-System-Prompt der Timeline                             | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_BASE` (`noodle.timelineBase`)   | Bearbeite **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Prompt** (Einstellungen → Generierungen → Prompt-Overrides für die Bildgenerierung) oder ändere `NOODLE_TIMELINE_BASE_DEFAULT_PROMPT` in `noodle-prompt.ts` im Code. Der Standard enthält die Regeln zur Plattform für Erwachsene, zur Autorschaft der Persona, zu Interaktionen und zu JSON, eine Umformulierung kann also das Parsen von `noodleGeneratedRefreshSchema` zerstören. |
| Anweisungen zu Stimme und Ton der Timeline (nach der Basis angehängt) | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_VOICE` (`noodle.timelineVoice`) | Bearbeite **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Voice & Tone** oder ändere den registrierten Standard (`noodleTimelineVoiceDefaultText(enhanced, allowRandomUsers)` in `noodle-prompt.ts`) im Code. Solange niemand den Standard bearbeitet, richtet er sich nach der Noodle-Einstellung `enableEnhancedTimelineWriting` (`ctx.enhanced`; deaktiviert entspricht das der ursprünglichen einzeiligen Ton-Anweisung) und danach, ob zufällige Nutzer erlaubt sind. Sobald jemand einen eigenen Override-Text speichert, gilt dieser unabhängig von diesen Einstellungen. |
| Erstmalige Profile für Charakter-Accounts                       | **package** `services/noodle/noodle-public-profiles.service.ts`    | `generateMissingNoodleProfiles()`               | Bearbeite die inline hinterlegten System- und Nutzer-Nachrichten im Code. Zuerst läuft die Auswahl der Teilnehmenden; an diesen Prompt gehen nur ausgewählte Charakter-Accounts ohne `profileGenerated`.                       |
| Prompt für generierte Post-Bilder                                 | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_IMAGE_POST` (`noodle.imagePost`)        | Bearbeite **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Post Image** oder ändere den registrierten Standard im Code. |
| Standardmäßige Noodle-spezifische Bildanweisungen                  | `packages/shared/src/schemas/noodle.schema.ts`                     | `DEFAULT_NOODLE_SETTINGS.imageGenerationPrompt` | Ändere die Noodle-Einstellung in der Oberfläche oder den Schema-Standard im Code.                                                                    |
| Freigegebener Chat-Kontext, der in die Timeline-Generierung einfließt     | **package** `services/noodle/noodle-public-prompt.service.ts`      | `buildOptedInChatContext()`                     | Ändere den Aufbau des Kontexts im Code; die Freigabe bleibt in den Einstellungen des jeweiligen Chats.                                                     |
| Bild-Eingaben für Timeline-Posts und -Antworten                        | **package** `services/noodle/noodle-vision.ts`                     | `prepareNoodleVisionAttachments()`              | Ändere Bildauswahl, Normalisierung, Limits oder den reinen Text-Fallback für Kompatibilität im Code.                                           |
| Noodle-Aktivität, die in Chat-Prompts einfließt                  | **package** `services/noodle/noodle-context.ts`                    | `buildRecentSocialMediaActivityBlock()`         | Das Paket registriert sie als Dienst `noodle:prompt-context`. Ändere Filterung oder Blockaufbau im Code; Zielmodi und Element-Limits steuern die Nutzenden in den Noodle-Einstellungen, und der eingebettete Block hat eine harte Obergrenze von 8.192 Tokens.                                  |
| Generierter JSON-Vertrag                                     | `packages/shared/src/schemas/noodle.schema.ts`                     | `noodleGeneratedRefreshSchema`                  | Nur zusammen mit dem Prompt, der Routen-Verarbeitung, den gemeinsamen Typen und der Regressionsabdeckung ändern.                                            |
| Lorebook-Welt- und Lore-Kontext, der in die Timeline-Generierung einfließt | **package** `services/noodle/noodle-public-prompt.service.ts`    | `buildRefreshPrompt()` (ruft `processLorebooks()` auf) | Hängt an der Noodle-Einstellung **Lorebook context** (`enableLorebookContext`, standardmäßig aus). Ein Lorebook ist eine Sammlung von Weltwissen. Genutzt wird dasselbe `processLorebooks()` für mehrere Charaktere wie in Gruppenchats, mit einem Noodle-eigenen Token-Budget aus `noodleLorebookTokenBudget()` in `noodle-prompt.ts`. Es skaliert mit der Zahl aktiver Charaktere und ist hart auf 8.192 Tokens gedeckelt. Der Aufruf läuft mit `previewOnly: true`, weil Noodle keinen Slot pro Chat hat, um Timing-Zustände für Sticky und Cooldown zu speichern. |

Der Profil-Prompt steht nicht in der Oberfläche unter Prompt Overrides. Die Vorlagen **Noodle Timeline Prompt**, **Noodle Timeline Voice & Tone** und **Noodle Post Image** stehen dort. Ist **Noodle image generation** (Noodle-Bildgenerierung) an (`enableImagePrompts`), geht die Noodle-Einstellung **Image instructions (sent to your LLM)** an das Timeline-Modell, das sie befolgt, wenn es die Bildidee jedes Posts schreibt. Die Standardvorlage **Noodle Post Image** hängt sie nicht mehr an, eigene Vorlagen können sie aber weiterhin als `${userInstructions}` nutzen.

Der Bilddienst (**package** `services/noodle/noodle-public-images.service.ts`) lädt `NOODLE_IMAGE_POST` und schickt das Ergebnis durch `compileImagePrompt()`, bevor es an den Bild-Anbieter geht. Auf die fertige Anfrage wirken sich deshalb auch das gewählte Bildstil-Profil und die Standardwerte der Verbindung aus.

## Fertige Prompts prüfen

Läuft ein manueller Refresh bei aktiviertem **Debug Mode** (Debug-Modus), schreibt der gemeinsame Server-Logger die fertigen Modell-Nachrichten für Profil und Timeline ins Log. Achte auf:

```text
[debug/noodle] Profile prompt sent to model
[debug/noodle] Prompt sent to model
[debug/noodle] Attached N timeline image input(s) to the refresh prompt
```

Bilddaten der Timeline landen nie als Base64 im Debug-Log. Der protokollierte Text enthält dieselben Anhang-Schlüssel für Posts und Antworten, die auch an das Modell gehen, dazu die Anzahl der nativen Bild-Eingaben. Noodle normalisiert und begrenzt diese Eingaben in `noodle-vision.ts`. Lehnt ein Anbieter Vision-Inhalte ausdrücklich ab, protokolliert das Paket das und schickt stattdessen den zusammengebauten reinen Text-Prompt.

Für Bilder aktivierst du **Expose media prompts before sending** (Medien-Prompts vor dem Senden anzeigen) unter **Settings -> Generations -> Overall Generations**. Dann lassen sich der fertige positive und negative Prompt vor dem Absenden noch prüfen und bearbeiten.

## Sicher bearbeiten

Der Aufbau des Prompts ist eine Kompatibilitätsgrenze mit hohem Risiko. Halte bei Änderungen den Prompt, `noodleGeneratedRefreshSchema`, die Routen-Verarbeitung sowie die Regressionen für Noodle-Erwähnungen und Umfragen im Einklang. Führe in der Engine mindestens aus:

```bash
pnpm check
pnpm regression:prompt
pnpm regression:noodle
```

Änderungen an Code, der dem Paket gehört, werden in Marinara-Agents vorgenommen und dort gegen den Branch `staging` validiert.

## Verwandte Anleitungen

- [Noodle: die In-App-Social-Timeline](../noodle/overview.md)
- [Noodle-Einstellungen und Chat-Übernahme](../noodle/settings.md)
- [Optionale Agent- und Capability-Pakete](optional-agent-packages.md)
- [Architektur-Übersicht (Entwicklung)](architecture-map.md)
