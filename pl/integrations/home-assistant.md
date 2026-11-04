# Integracja z Home Assistant

Ta integracja pozwala postaciom AI sterować prawdziwymi urządzeniami inteligentnego domu prosto z czatu, na przykład światłami, klimatyzacją, roletami i odtwarzaczami multimediów. Pozwala też automatyzacjom Home Assistant wysyłać wiadomości do aplikacji Marinara Engine. Home Assistant to darmowa platforma open source do obsługi urządzeń inteligentnego domu. Jeśli z niej nie korzystasz, ten przewodnik nie jest ci potrzebny.

## Co dodaje integracja

Integracja to niewielki program, który instaluje się wewnątrz platformy Home Assistant i łączy ją z serwerem Marinara Engine. Przy pierwszej konfiguracji sama tworzy poniższe elementy. Nigdzie nie trzeba kopiować adresów narzędzi ani konfigurować narzędzi ręcznie.

- Narzędzia inteligentnego domu w sekcji **Functions** (funkcje) panelu Presets. Zobacz [Własne narzędzia](../extending/custom-tools.md).
- Jednego agenta o nazwie **Home Assistant**, czyli pomocnika AI, który pracuje obok czatu. Zobacz [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md).
- Encje Home Assistant (urządzenia, czujniki i kontrolki), dzięki którym można podglądać aplikację Marinara Engine i sterować nią z platformy Home Assistant.

## Zanim zaczniesz

- Home Assistant w wersji 2024.1.0 lub nowszej.
- HACS zainstalowany w platformie Home Assistant. HACS to Home Assistant Community Store, narzędzie do instalowania niestandardowych integracji.
- Aplikacja Marinara Engine uruchomiona i dostępna z komputera z platformą Home Assistant. Domyślny adres to `localhost:7860`.
- Ustawienie `WEBHOOK_LOCAL_URLS_ENABLED=true` w pliku `.env` aplikacji Marinara Engine.

Plik `.env` to zwykły tekstowy plik ustawień serwera Marinara Engine. Gdzie go znaleźć, wyjaśnia przewodnik [Konfiguracja serwera](../CONFIGURATION.md). Integracja korzysta z webhooka, czyli adresu internetowego, przez który jedna aplikacja przesyła dane do drugiej. Webhook platformy Home Assistant to lokalny adres w zwykłym protokole `http`, a Marinara ze względów bezpieczeństwa domyślnie blokuje takie adresy. To ustawienie na nie zezwala. Dopisz tę linię i zapisz plik. Ustawienie zaczyna działać bez ponownego uruchamiania, zwykle w ciągu kilku sekund (najwyżej po około 30 sekundach):

```text
WEBHOOK_LOCAL_URLS_ENABLED=true
```

### Kiedy Home Assistant działa na innym urządzeniu

Integracja łączy się bez nazwy użytkownika i hasła, a w formularzu konfiguracji nie ma pól, w które dałoby się je wpisać.

- Ten sam komputer: połączenie działa od razu.
- Inne urządzenie: Marinara domyślnie je blokuje. Dopisz adres IP tego urządzenia (jego liczbowy adres w sieci) do zmiennej `IP_ALLOWLIST` w pliku `.env`. W całkowicie zaufanej sieci domowej można zamiast tego ustawić `ALLOW_UNAUTHENTICATED_PRIVATE_NETWORK=true`.
- Jeśli aplikacja Marinara Engine używa zmiennych `BASIC_AUTH_USER` i `BASIC_AUTH_PASS` (logowania), integracja nie ma jak się zalogować. Działa wtedy wyłącznie z tego samego komputera albo z urządzenia wpisanego do `IP_ALLOWLIST`.

Którą opcję wybrać, wyjaśnia przewodnik [Dostęp zdalny](../REMOTE_ACCESS.md).

## Instalacja integracji

### Dodanie do HACS

1. W platformie Home Assistant otwórz **HACS**.
2. Otwórz menu z trzema kropkami i kliknij **Custom repositories**.
3. W polu repozytorium wpisz `https://github.com/Pasta-Devs/Marinara-Engine`.
4. Ustaw kategorię na **Integration** i kliknij **Add**.
5. Wyszukaj **Marinara Engine** i zainstaluj integrację.
6. Uruchom ponownie platformę Home Assistant.

### Konfiguracja

1. Przejdź do **Settings → Devices & Services** (ustawienia, urządzenia i usługi) i kliknij **Add Integration**.
2. Wyszukaj **Marinara Engine**.
3. Wpisz **Host** i **Port**, pod którymi działa aplikacja Marinara Engine. Domyślne wartości to `localhost` i `7860`.
4. Kliknij **Submit**.

Jeśli się nie udało: Home Assistant pokazuje błąd, gdy nie może połączyć się z aplikacją Marinara Engine. Zobacz [Rozwiązywanie problemów](#troubleshooting).

Po udanej konfiguracji integracja rejestruje prywatny webhook w platformie Home Assistant, tworzy w sekcji **Functions** aplikacji Marinara Engine narzędzia wskazujące na ten webhook, tworzy agenta **Home Assistant** z listą wszystkich włączonych narzędzi i tworzy encje opisane niżej.

## Dodanie agenta do czatu

Utworzenie agenta nie podpina go do każdego czatu. Dodaj go do każdego czatu, w którym chcesz sterować inteligentnym domem.

1. Otwórz czat i kliknij **Chat Settings** (ustawienia czatu).
2. Otwórz sekcję **Agents** (agenci).
3. Dodaj agenta **Home Assistant**.

Agent działa w czatach Roleplay, Conversation i Game. Po dodaniu narzędzia są dostępne dla AI w tym czacie. Nic więcej nie trzeba włączać.

### Sprawdzenie, czy działa

1. W tym czacie napisz zwykłą prośbę, na przykład `Turn on the office lights`, i wyślij ją.
2. AI powinno wywołać narzędzie, na przykład `ha_turn_on`, światła powinny się zapalić, a AI to potwierdza.

Jeśli nic się nie dzieje, sprawdź, czy ustawiono `WEBHOOK_LOCAL_URLS_ENABLED=true`, i zajrzyj do sekcji [Rozwiązywanie problemów](#troubleshooting).

## Wybór narzędzi, z których może korzystać AI

Narzędzia są podzielone na osiem kategorii. Żeby wybrać, z których Marinara może korzystać, otwórz **Settings → Devices & Services**, kliknij **Marinara Engine**, a potem **Configure**. Są tam dwie opcje:

- **Primary Chat**: domyślny czat, do którego kierują usługi Home Assistant.
- **Exposed Tool Categories**: kategorie, z których Marinara może korzystać.

| Kategoria | Domyślnie | Narzędzia |
| --- | --- | --- |
| Lights & Switches (światła i przełączniki) | On | ha_turn_on, ha_turn_off, ha_toggle, ha_set_brightness, ha_set_color, ha_set_color_temp |
| Climate (klimatyzacja) | On | ha_set_temperature, ha_set_hvac_mode |
| Covers (Blinds & Garage) (rolety i brama garażowa) | On | ha_open_cover, ha_close_cover, ha_set_cover_position |
| Locks (zamki) | Off | ha_lock, ha_unlock |
| Media Players (odtwarzacze multimediów) | On | ha_media_play, ha_media_pause, ha_set_volume |
| Scenes & Scripts (sceny i skrypty) | On | ha_activate_scene, ha_run_script |
| Query (zapytania) | On | ha_get_state, ha_list_areas, ha_list_entities, ha_notify |
| Generic Service Calls (Advanced) (ogólne wywołania usług) | Off | ha_call_service |

> **Ostrzeżenie:** **Generic Service Calls (Advanced)** pozwala AI wywołać dowolną usługę Home Assistant. **Locks** pozwala mu zamykać i otwierać zamki w drzwiach. Obie kategorie są domyślnie wyłączone. Włącz je tylko wtedy, gdy naprawdę mają być używane.

Większość narzędzi przyjmuje jedno urządzenie albo nazwę pomieszczenia. Po podaniu nazwy pomieszczenia narzędzie działa na wszystkich pasujących urządzeniach w tym pomieszczeniu. Zmiany kategorii zaczynają obowiązywać po naciśnięciu przycisku **Marinara Sync HA Tools** albo po ponownym uruchomieniu platformy Home Assistant.

## Encje w platformie Home Assistant

Integracja tworzy te encje w ramach urządzenia o nazwie **Marinara Engine**.

| Encja | Typ | Do czego służy |
| --- | --- | --- |
| Marinara Chat Count | Sensor | Łączna liczba czatów w aplikacji Marinara Engine |
| Marinara Active Agent Count | Sensor | Liczba włączonych agentów w aplikacji Marinara Engine |
| Marinara Active Chat | Select | Wybiera czat, do którego kierują usługi |
| Marinara Agent: (nazwa) | Switch | Włącza i wyłącza jednego agenta, po jednym przełączniku na agenta |
| Marinara Abort Generation | Button | Przerywa trwające generowanie odpowiedzi AI |
| Marinara Sync HA Tools | Button | Wysyła ponownie wszystkie narzędzia i odbudowuje agenta Home Assistant |

Integracja sprawdza w aplikacji Marinara Engine nowe czaty i nowych agentów co 30 sekund, więc coś, co utworzono przed chwilą, może pojawić się z opóźnieniem do 30 sekund.

### Synchronizacja po zmianie ustawień

Naciśnij **Marinara Sync HA Tools** na stronie urządzenia **Marinara Engine**. Przycisk aktualizuje istniejące narzędzia w miejscu, odbudowuje agenta **Home Assistant**, jeśli został usunięty, i wyłącza (nie usuwa) narzędzia z wyłączonych kategorii. Nie edytuj ręcznie narzędzi Home Assistant w aplikacji Marinara Engine. Kolejna synchronizacja nadpisuje takie zmiany i włącza narzędzia z powrotem.

## Sterowanie aplikacją Marinara Engine z automatyzacji

Integracja dodaje dwie usługi Home Assistant do automatyzacji. Działają one w platformie Home Assistant, a nie w aplikacji Marinara Engine. Obie domyślnie kierują do czatu **Primary Chat**.

### Send Message (marinara_engine.send_message)

- `message`: treść wiadomości. To pole jest wymagane.
- `chat_id`: czat, do którego trafia wiadomość. Puste pole oznacza czat Primary Chat.
- `role`: `user`, `assistant`, `system` lub `narrator`. Domyślnie `user`.
- `trigger_generation`: przy wartości true AI też odpowiada. Domyślnie false.

Ta automatyzacja informuje AI o otwarciu drzwi wejściowych:

```yaml
automation:
  trigger:
    platform: state
    entity_id: binary_sensor.front_door
    to: "on"
  action:
    service: marinara_engine.send_message
    data:
      message: "Someone has arrived at the front door."
      trigger_generation: true
```

### Trigger Generation (marinara_engine.trigger_generation)

Ta usługa uruchamia odpowiedź AI bez widocznej wiadomości.

- `chat_id`: czat. Puste pole oznacza czat Primary Chat.
- `user_message`: opcjonalna wiadomość dołączana do tury z odpowiedzią.

<a id="troubleshooting"></a>

## Rozwiązywanie problemów

### Formularz konfiguracji zgłasza brak połączenia

Sprawdź, czy aplikacja Marinara Engine działa i czy **Host** i **Port** odpowiadają temu, gdzie nasłuchuje (domyślnie `localhost` i `7860`). Jeśli Home Assistant działa na innym urządzeniu, Marinara je blokuje, chyba że urządzenie jest wpisane do `IP_ALLOWLIST`. Integracja nie potrafi wysłać hasła, więc aplikacja Marinara Engine chroniona logowaniem także ją odrzuca. Zobacz [Dostęp zdalny](../REMOTE_ACCESS.md). Te zasady obowiązują także po konfiguracji. Jeśli Marinara później zablokuje urządzenie, czujniki i lista czatów po cichu przestają się aktualizować.

### AI próbuje użyć narzędzia urządzenia, ale nic się nie dzieje

Najprawdopodobniej blokowane jest wywołanie webhooka. Dopisz `WEBHOOK_LOCAL_URLS_ENABLED=true` do pliku `.env` i zapisz go. Bez tego wywołania narzędzi mogą kończyć się komunikatem o niedozwolonym protokole `http` albo o odrzuconym adresie prywatnym. Kiedy Marinara Engine i Home Assistant działają na tym samym komputerze, integracja sama używa adresu wewnętrznego. Kiedy Marinara Engine działa na innym urządzeniu, sprawdź, czy lokalny adres platformy Home Assistant jest z niego osiągalny.

### Narzędzia nie pojawiają się w sekcji Functions

Naciśnij **Marinara Sync HA Tools** albo uruchom ponownie platformę Home Assistant, a potem sprawdź sekcję **Functions** w panelu Presets.

### Agenta Home Assistant nie ma w moim czacie

Sprawdź, czy agent istnieje w aplikacji Marinara Engine w sekcji Agents. Jeśli go nie ma, naciśnij **Marinara Sync HA Tools**, żeby go odbudować. Potem dodaj go w **Chat Settings → Agents**.

### Ręczne odszukanie adresu webhooka

Rzadko jest to potrzebne, bo każde narzędzie ma już ten adres. Otwórz w platformie Home Assistant **Settings → Devices & Services → Marinara Engine**. Webhook korzysta z takiego wzorca, gdzie 8123 to domyślny port platformy Home Assistant:

```text
http://<homeassistant-ip>:8123/api/webhook/<webhook-id>
```

## Odinstalowanie

Usuń integrację w platformie Home Assistant w **Settings → Devices & Services → Marinara Engine**. Usuwa to encje. Narzędzia w sekcji **Functions** aplikacji Marinara Engine i agent **Home Assistant** zostają. Jeśli nie są już potrzebne, usuń je ręcznie w aplikacji Marinara Engine.

## Powiązane przewodniki

- [Własne narzędzia](../extending/custom-tools.md)
- [Agenci: pomocnicy AI w czatach](../agents/agents-overview.md)
- [Konfiguracja serwera](../CONFIGURATION.md)
- [Dostęp zdalny](../REMOTE_ACCESS.md)
