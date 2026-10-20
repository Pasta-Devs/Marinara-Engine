# Budowa promptów Noodle od środka (dla programistów)

Materiał dla programistów: gdzie w kodzie siedzą prompty (teksty, które Marinara wysyła do AI) generujące treści Noodle, jak je dostosować i jak debugować gotowe prompty. Zwykli użytkownicy konfigurują Noodle w panelu **Settings** (Ustawienia) – zobacz przewodniki Noodle w folderze `docs/noodle/`.

Noodle to pakiet do pobrania. Jego trasy (`/api/noodle`, rejestrowane przy aktywacji pakietu) i kod generowania leżą w pakiecie Noodle w repozytorium [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), w folderze `packages/noodle/src/engine/packages/server/src/`. W tabeli poniżej źródło oznaczone jako **package** jest podane względem tego folderu. Silnik przechowuje wspólny schemat i typy Noodle, magazyn Noodle, zarejestrowane nadpisania promptów wymienione w Settings oraz domyślny tekst promptu osi czasu w `packages/server/src/services/noodle/noodle-prompt.ts`. Pakiet ma własne kopie `services/prompt-overrides/registry/noodle.ts` i `services/noodle/noodle-prompt.ts`.

## Mapa źródeł promptów

Noodle ma jeden składany prompt osi czasu, wbudowany prompt profili i trzy zarejestrowane nadpisania promptów: dwa dla promptu systemowego osi czasu i jedno dla obrazów we wpisach.

| Do czego służy | Źródło | Główny symbol | Jak dostosować |
| --- | --- | --- | --- |
| Wpisy na osi czasu, odpowiedzi, obserwacje, ankiety, głosy i podsumowania | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()` | Wiadomość systemowa to nadpisanie **Noodle Timeline Prompt**, a po nim nadpisanie **Noodle Timeline Voice & Tone** (oba opisane niżej). Dwie wiadomości użytkownika, kontekst (konta, persona, profile, harmonogramy, lore, udostępniony kontekst czatów, oś czasu, włączone funkcje i limity) oraz wiadomość `# JSON Output Format` są składane w kodzie. |
| Bazowy prompt systemowy osi czasu | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_BASE` (`noodle.timelineBase`) | Edytuj **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Prompt** albo zmień w kodzie `NOODLE_TIMELINE_BASE_DEFAULT_PROMPT` w pliku `noodle-prompt.ts`. Wartość domyślna zawiera reguły platformy dla dorosłych, autorstwa persony, interakcji i formatu JSON, więc przeredagowanie może zepsuć parsowanie `noodleGeneratedRefreshSchema`. |
| Instrukcje głosu i tonu osi czasu (dołączane po promptcie bazowym) | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_VOICE` (`noodle.timelineVoice`) | Edytuj **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Voice & Tone** albo zmień w kodzie zarejestrowaną wartość domyślną (`noodleTimelineVoiceDefaultText(enhanced, allowRandomUsers)` w pliku `noodle-prompt.ts`). Nietknięta wartość domyślna zależy od ustawienia `enableEnhancedTimelineWriting` w sekcji Noodle (`ctx.enhanced`; domyślnie wyłączone odtwarza pierwotną, jednolinijkową instrukcję tonu) oraz od tego, czy dozwoleni są losowi użytkownicy. Zapisany własny tekst nadpisania ma pierwszeństwo niezależnie od tych ustawień. |
| Profile kont postaci tworzone przy pierwszym uruchomieniu | **package** `services/noodle/noodle-public-profiles.service.ts` | `generateMissingNoodleProfiles()` | Zmień w kodzie wbudowane wiadomości systemowe i wiadomości użytkownika. Najpierw działa wybór uczestników, a do tego promptu trafiają tylko wybrane konta postaci bez `profileGenerated`. |
| Prompt obrazu do wygenerowanego wpisu | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_IMAGE_POST` (`noodle.imagePost`) | Edytuj **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Post Image** albo zmień w kodzie zarejestrowaną wartość domyślną. |
| Domyślne instrukcje obrazów właściwe dla Noodle | `packages/shared/src/schemas/noodle.schema.ts` | `DEFAULT_NOODLE_SETTINGS.imageGenerationPrompt` | Zmień to ustawienie Noodle w interfejsie albo wartość domyślną w schemacie w kodzie. |
| Kontekst udostępnionych czatów wstawiany przy generowaniu osi czasu | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildOptedInChatContext()` | Zmień w kodzie sposób składania kontekstu; zgoda na udostępnienie pozostaje w ustawieniach każdego czatu. |
| Obrazy wejściowe wpisów i odpowiedzi na osi czasu | **package** `services/noodle/noodle-vision.ts` | `prepareNoodleVisionAttachments()` | Zmień w kodzie wybór obrazów, normalizację, limity albo awaryjny tryb zgodności tylko z tekstem. |
| Aktywność Noodle wstawiana do promptów czatu | **package** `services/noodle/noodle-context.ts` | `buildRecentSocialMediaActivityBlock()` | Pakiet rejestruje to jako usługę `noodle:prompt-context`. Zmień w kodzie filtrowanie albo składanie bloku; tryby docelowe i limity elementów użytkownicy ustawiają w sekcji Noodle Settings, a sam opakowany blok ma twardy limit 8192 tokenów (token to mały kawałek tekstu). |
| Kontrakt wygenerowanego formatu JSON | `packages/shared/src/schemas/noodle.schema.ts` | `noodleGeneratedRefreshSchema` | Zmieniaj tylko razem z promptem, obsługą trasy, typami współdzielonymi i pokryciem testami regresji. |
| Kontekst świata i lore z lorebooków, wstawiany przy generowaniu osi czasu | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()` (wywołuje `processLorebooks()`) | Zależy od ustawienia **Lorebook context** w sekcji Noodle (`enableLorebookContext`, domyślnie wyłączone). Korzysta z tej samej wielopostaciowej funkcji `processLorebooks()` co czaty grupowe, z limitem tokenów właściwym dla Noodle z `noodleLorebookTokenBudget()` w pliku `noodle-prompt.ts`, skalowanym liczbą aktywnych postaci i twardo ograniczonym do 8192 tokenów. Działa z `previewOnly: true`, bo Noodle nie ma slotu przy czacie, w którym dałoby się zapisać stan czasowy wpisów przyklejonych i odstępów cooldown. |

Prompt profili nie jest wymieniony w interfejsie Prompt Overrides. Szablony **Noodle Timeline Prompt**, **Noodle Timeline Voice & Tone** i **Noodle Post Image** są tam widoczne. Gdy włączone jest **Noodle image generation** (`enableImagePrompts`), ustawienie Noodle **Image instructions (sent to your LLM)** trafia do modelu osi czasu, który kieruje się nim przy pisaniu pomysłu na obraz do każdego wpisu. Domyślny szablon **Noodle Post Image** już go nie dołącza, ale własne szablony nadal mogą go użyć jako `${userInstructions}`.

Usługa obrazów (**package** `services/noodle/noodle-public-images.service.ts`) wczytuje `NOODLE_IMAGE_POST`, a wynik przepuszcza jeszcze przez `compileImagePrompt()`, zanim wyśle go do dostawcy obrazów. Na końcowe żądanie wpływa więc także wybrany profil stylu obrazu i domyślne ustawienia połączenia.

## Podgląd gotowych promptów

Ręczne odświeżenie uruchomione przy włączonym trybie **Debug Mode** zapisuje w logach (dzienniku serwera) końcowe wiadomości modelu dla profilu i osi czasu, przez wspólny logger serwera. Szukaj wpisów:

```text
[debug/noodle] Profile prompt sent to model
[debug/noodle] Prompt sent to model
[debug/noodle] Attached N timeline image input(s) to the refresh prompt
```

Dane obrazów z osi czasu nigdy nie trafiają do logów diagnostycznych w postaci base64. Zapisany tekst zawiera te same klucze załączników wpisów i odpowiedzi, które dostaje model, oraz liczbę natywnych obrazów wejściowych. Noodle normalizuje i ogranicza te dane wejściowe w pliku `noodle-vision.ts`. Jeśli dostawca wprost odrzuca treści obrazowe, pakiet zapisuje to w logach i wysyła zamiast tego przygotowany prompt awaryjny, wyłącznie tekstowy.

W przypadku obrazów włącz opcję **Expose media prompts before sending** w **Settings -> Generations -> Overall Generations**, żeby obejrzeć i poprawić gotowe prompty, pozytywny i negatywny, zanim żądanie zostanie wysłane.

## Bezpieczne wprowadzanie zmian

Składanie promptu to granica zgodności o wysokim ryzyku. Przy zmianach pilnuj, żeby prompt, `noodleGeneratedRefreshSchema`, obsługa trasy oraz testy regresji wzmianek i ankiet Noodle pozostały spójne. W silniku uruchom przynajmniej:

```bash
pnpm check
pnpm regression:prompt
pnpm regression:noodle
```

Zmiany w kodzie należącym do pakietu wprowadza się i sprawdza w repozytorium Marinara-Agents, względem jego gałęzi `staging`.

## Powiązane przewodniki

- [Noodle: wbudowana oś czasu społecznościowa](../noodle/overview.md)
- [Ustawienia Noodle i przeniesienie do czatów](../noodle/settings.md)
- [Opcjonalne pakiety agentów i możliwości](optional-agent-packages.md)
- [Mapa architektury (dla programistów)](architecture-map.md)
