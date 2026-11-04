# Marinara Engine installieren

Marinara läuft auf deinem eigenen Gerät. Wähle unten die Anleitung für dein Gerät.

## Plattform wählen

| Dein Gerät | Anleitung |
| --- | --- |
| Windows | [Installation unter Windows](installation/windows.md) |
| macOS oder Linux | [Installation unter macOS und Linux](installation/macos-linux.md) |
| Docker oder Podman | [Installation im Container](installation/containers.md) |
| Android-Handy oder -Tablet | [Android-Installationsanleitung](installation/android-termux.md) |
| iPhone oder iPad | [iOS und iPadOS](installation/ios-pwa.md) |

## Welche Anleitung passt zu mir?

- **Windows:** Nimm den Windows-Installer. Er richtet alles ein und legt eine Verknüpfung auf dem Desktop an.
- **Android:** [Lade die APK herunter](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Öffne die heruntergeladene Datei und tipp dann in der App auf **Install / Start Marinara** (Marinara installieren/starten).
- **macOS, Linux oder ein Heimserver:** Du hast die Wahl. Mit der nativen Anleitung läuft Marinara direkt auf deinem Computer, gestartet über ein Launcher-Skript. Docker braucht kein Node.js und baut nichts, dafür installierst du zuerst Docker.
- **iPhone oder iPad:** Auf diesen Geräten kann Marinara den Server nicht ausführen. Lass Marinara auf einem Computer, einem Heimserver oder einem Android-Gerät laufen und öffne es dann in Safari. Wie das geht, erklärt die iOS-Anleitung.
- **Du willst am Code arbeiten:** Starte aus dem Quellcode. Das heißt, du lädst den Code herunter und baust die App auf deinem Gerät. Die Anleitungen für Windows, für macOS und Linux sowie für Android beschreiben alle diesen Weg.

Unter Android läuft Marinara in **Termux**, einer kostenlosen Android-App, die deinem Handy ein kleines Linux-System gibt. Die APK richtet Termux für dich ein.

## Was du brauchst

- Für den Start aus dem Quellcode: **Node.js** 24, 25 oder 26 und **Git**. Node.js führt die App aus. Git lädt den Code herunter und aktualisiert ihn. Die Plattform-Anleitungen verlinken beide Downloads.
- Für Docker oder Podman: kein Node.js. Das empfohlene Compose-Setup nutzt Git einmalig, um die Projektdateien herunterzuladen.

## Marinara öffnen

Läuft Marinara, öffne diese Adresse in einem Browser auf demselben Gerät. Nutze sie nicht von einem anderen Gerät aus.

```text
http://127.0.0.1:7860
```

`127.0.0.1` steht für dieses Gerät. `7860` ist der Standard-Port, also die Nummer, auf der die App lauscht. Die Launcher (die Skripte, die Marinara starten) machen es auch für andere Geräte in deinem Netzwerk erreichbar, doch diese bleiben blockiert, bis du eine Anmeldung einrichtest. Eine Docker- oder Podman-Installation antwortet nur auf diesem Gerät, bis du ihre Port-Zeile änderst; siehe die [Container-Anleitung](installation/containers.md#open-marinara-from-another-device).

## Marinara auf dem Handy öffnen

1. Installiere und starte Marinara auf einem Computer, einem Heimserver oder einem Android-Handy.
   Folge bei Docker oder Podman zuerst [Marinara von einem anderen Gerät öffnen](installation/containers.md#open-marinara-from-another-device).
2. Richte dort eine Anmeldung ein. Siehe [Fernzugriff](REMOTE_ACCESS.md#option-1-login-recommended).
3. Finde die IP-Adresse dieses Geräts heraus. Wie das geht, zeigen die [FAQ](FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device).
4. Öffne auf deinem Handy `http://`, gefolgt von der IP-Adresse und `:7860`.

Für ein iPhone siehe [iOS und iPadOS](installation/ios-pwa.md).

## Nach der Installation

Lies [Erste Schritte mit Marinara Engine](home/welcome.md), um eine Verbindung hinzuzufügen, einen Charakter zu erstellen oder zu importieren und einen Chat zu starten. Wie du später aktualisierst, steht unter [Marinara Engine aktualisieren](UPGRADING.md).

## Verwandte Anleitungen

- [Installation unter Windows](installation/windows.md)
- [Installation unter macOS und Linux](installation/macos-linux.md)
- [Installation im Container](installation/containers.md)
- [Installation unter Android (Termux)](installation/android-termux.md)
- [iOS und iPadOS](installation/ios-pwa.md)
- [Marinara Engine aktualisieren](UPGRADING.md)
- [Erste Schritte mit Marinara Engine](home/welcome.md)
