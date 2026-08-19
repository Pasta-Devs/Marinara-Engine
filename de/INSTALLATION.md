# Marinara Engine installieren

Diese Anleitung hilft dir, den passenden Installationsweg für dein Gerät zu finden. Marinara läuft auf dem eigenen Rechner – Chats und Daten bleiben also lokal. Für jede Plattform gibt es eine eigene Schritt-für-Schritt-Anleitung, verlinkt in der Tabelle.

## Plattform wählen

Nimm die Anleitung, die zu dem Gerät passt, auf dem Marinara laufen soll.

| Plattform | Installationsanleitung |
|---|---|
| Windows | [Installation unter Windows](installation/windows.md) |
| macOS oder Linux | [Installation unter macOS und Linux](installation/macos-linux.md) |
| Docker oder Podman | [Installation im Container](installation/containers.md) |
| Android-Handy oder -Tablet | [APK herunterladen](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) · [Android-Installationsanleitung](installation/android-termux.md) |
| iPhone oder iPad | [iOS und iPadOS](installation/ios-pwa.md) |

Zwei Dinge solltest du vorher wissen:

- Auf **iPhone oder iPad** betreibt Marinara den Server nicht selbst. Den Server betreibst du auf einem Computer, einem Heimserver oder einem Android-Gerät und öffnest Marinara dann in Safari auf dem iPhone oder iPad. Die iOS-Anleitung erklärt das im Detail.
- Unter **Android** läuft Marinara in **Termux**. Termux ist eine kostenlose App, die Android eine kleine Linux-Umgebung verpasst. Tippe auf den direkten APK-Download, bestätige die erforderlichen Installations- und Termux-Berechtigungsabfragen von Android und lass die App ihre privaten localhost-Zugangsdaten automatisch verwalten. Installer fragen nie nach Android-Signaturdaten oder diesem lokalen Geheimwert.

## Was passt zu mir

Wenn du neu dabei bist und möglichst wenig einrichten willst, nimm eine dieser beiden Varianten:

- Nimm unter **Windows** den **Windows-Installer**. Er lädt alles herunter, richtet alles ein und legt eine Verknüpfung auf dem Desktop an.
- Nimm unter **Android** den Link **APK herunterladen** oben. Öffne die heruntergeladene Datei und tippe dann in der App auf **Install / Start Marinara**.
- Nimm unter **macOS**, **Linux** oder auf einem Heimserver **Docker**. Ein einziger Befehl startet die App. Das Image enthält bereits Node.js, sämtliche Abhängigkeiten und eine fertig gebaute Version der App. Node.js installieren und die App selbst bauen musst du damit nicht.

Wer sich im Terminal wohlfühlt und vielleicht am Code schrauben möchte, startet stattdessen aus dem Quellcode. „Aus dem Quellcode starten“ heißt: Du lädst den Code herunter und baust die App auf dem eigenen Rechner. Die Anleitungen für **Windows**, **macOS und Linux** sowie **Android (Termux)** beschreiben alle diesen Weg.

## Kurz zu den Systemanforderungen

- Du brauchst einen Computer oder ein Gerät, auf dem ein Server laufen kann: Windows, macOS, Linux oder Android.
- Für den Start aus dem Quellcode brauchst du **Node.js** in Version 24 und **Git**. Node.js führt die App aus, Git lädt den Code herunter und hält ihn aktuell. Die Plattform-Anleitungen verlinken beide Downloads.
- Bei **Docker** und **Podman** ist Node.js nicht nötig. Das empfohlene Compose-Setup nutzt allerdings weiterhin Git, um die Projektdateien herunterzuladen. Die Container-Anleitung geht darauf ein.
- Standardmäßig läuft die App auf dem eigenen Rechner unter dieser Adresse:

```text
http://127.0.0.1:7860
```

- `127.0.0.1` steht für den eigenen Computer, `7860` ist der Standard-Port. Wie du Marinara vom Handy oder einem anderen Gerät im Netzwerk erreichst, steht unter LAN-Zugriff in den [FAQ](FAQ.md).

## Und nach der Installation?

Sobald Marinara läuft und im Browser geöffnet ist, lies [Erste Schritte mit Marinara Engine](home/welcome.md). Dort gehst du die ersten Schritte durch: eine Verbindung anlegen, einen Charakter erstellen oder importieren und einen Chat starten.

Wie du die Installation später aktuell hältst, steht unter [Marinara Engine aktualisieren](UPGRADING.md).

## Verwandte Anleitungen

- [Installation unter Windows](installation/windows.md)
- [Installation unter macOS und Linux](installation/macos-linux.md)
- [Installation im Container](installation/containers.md)
- [Installation unter Android (Termux)](installation/android-termux.md)
- [iOS und iPadOS](installation/ios-pwa.md)
- [Marinara Engine aktualisieren](UPGRADING.md)
- [Erste Schritte mit Marinara Engine](home/welcome.md)
