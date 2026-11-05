# Установка Marinara Engine

Marinara работает на вашем собственном устройстве. Выберите ниже руководство для своего устройства.

## Выбор платформы

| Ваше устройство | Руководство |
| --- | --- |
| Windows | [Руководство по установке на Windows](installation/windows.md) |
| macOS или Linux | [Установка на macOS и Linux](installation/macos-linux.md) |
| Docker или Podman | [Запуск в контейнере (Docker / Podman)](installation/containers.md) |
| Телефон или планшет на Android | [Руководство по установке на Android](installation/android-termux.md) |
| iPhone или iPad | [Руководство по приложению PWA для iOS / iPadOS](installation/ios-pwa.md) |

## Что выбрать?

- **Windows:** используйте установщик для Windows. Он сам все настраивает и добавляет ярлык на рабочий стол.
- **Android:** [скачайте APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Откройте скачанный файл, затем нажмите в приложении **Install / Start Marinara**.
- **macOS, Linux или домашний сервер:** выберите один из вариантов. В руководстве по нативной установке Marinara запускается прямо на компьютере скриптом запуска. Docker не требует Node.js и ничего не собирает, но сначала нужно установить сам Docker.
- **iPhone или iPad:** на этих устройствах Marinara не может запустить сервер. Запустите его на компьютере, домашнем сервере или устройстве Android, а затем откройте в Safari. Как это сделать, объясняет руководство по iOS.
- **Вы хотите менять код:** запускайте приложение из исходного кода. Это значит, что вы скачиваете код и собираете приложение на своем устройстве. Этот способ описывают все руководства: по Windows, по macOS и Linux и по Android.

На Android приложение Marinara работает внутри **Termux**. Termux – это бесплатное приложение для Android, которое дает телефону небольшую систему Linux. APK настраивает Termux за вас.

## Что понадобится

- Для запуска из исходного кода: **Node.js** 24, 25 или 26 и **Git**. Node.js запускает приложение. Git скачивает код и обновляет его. Ссылки для скачивания обоих есть в руководствах по платформам.
- Для Docker или Podman: Node.js не нужен. Рекомендуемый вариант с Compose один раз использует Git, чтобы скачать файлы проекта.

## Открытие Marinara

Когда Marinara запущена, откройте этот адрес в браузере на том же устройстве. Не открывайте его с другого устройства.

```text
http://127.0.0.1:7860
```

`127.0.0.1` означает это устройство. `7860` – это порт по умолчанию, то есть номер, который слушает приложение. Скрипты запуска (скрипты, которыми запускается Marinara) также позволяют другим устройствам в вашей сети подключаться к ней, но эти устройства остаются заблокированными, пока вы не зададите вход. Установка через Docker или Podman отвечает только на этом устройстве, пока вы не измените в ней строку с портом; см. руководство [Запуск в контейнере (Docker / Podman)](installation/containers.md#open-marinara-from-another-device).

## Открытие Marinara на телефоне

1. Установите и запустите Marinara на компьютере, домашнем сервере или телефоне с Android.
   Для Docker или Podman сначала выполните шаги из раздела [Открытие Marinara с другого устройства](installation/containers.md#open-marinara-from-another-device).
2. Задайте там вход. См. [Удаленный доступ](REMOTE_ACCESS.md#option-1-login-recommended).
3. Узнайте IP-адрес этого устройства. Как это сделать, показано в руководстве [Частые вопросы](FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device).
4. На телефоне откройте адрес, который состоит из `http://`, IP-адреса и `:7860`.

Для iPhone см. [Руководство по приложению PWA для iOS / iPadOS](installation/ios-pwa.md).

## После установки

Прочитайте руководство [Начало работы с приложением Marinara Engine](home/welcome.md), чтобы добавить подключение, создать или импортировать персонажа и начать чат. Как обновлять приложение позже, описано в руководстве [Обновление приложения Marinara Engine](UPGRADING.md).

## Смежные руководства

- [Руководство по установке на Windows](installation/windows.md)
- [Установка на macOS и Linux](installation/macos-linux.md)
- [Запуск в контейнере (Docker / Podman)](installation/containers.md)
- [Руководство по установке на Android (Termux)](installation/android-termux.md)
- [Руководство по приложению PWA для iOS / iPadOS](installation/ios-pwa.md)
- [Обновление приложения Marinara Engine](UPGRADING.md)
- [Начало работы с приложением Marinara Engine](home/welcome.md)
