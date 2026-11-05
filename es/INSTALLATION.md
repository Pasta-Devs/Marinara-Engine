# Instalación de Marinara Engine

Marinara se ejecuta en tu propio dispositivo. Elige abajo la guía para tu dispositivo.

## Elige tu plataforma

| Tu dispositivo | Guía |
| --- | --- |
| Windows | [Instalación en Windows](installation/windows.md) |
| macOS o Linux | [Instalación en macOS y Linux](installation/macos-linux.md) |
| Docker o Podman | [Instalación en contenedor](installation/containers.md) |
| Teléfono o tableta Android | [Guía de instalación en Android](installation/android-termux.md) |
| iPhone o iPad | [iOS e iPadOS](installation/ios-pwa.md) |

## ¿Cuál debería elegir?

- **Windows:** usa el instalador de Windows. Configura todo y añade un acceso directo en el escritorio.
- **Android:** [descarga el APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Abre el archivo descargado y luego toca **Install / Start Marinara** en la app.
- **macOS, Linux o un servidor doméstico:** elige una de las dos. La guía nativa ejecuta Marinara directamente en tu computadora con un script lanzador. Docker no necesita Node.js ni compila nada, pero primero instalas Docker.
- **iPhone o iPad:** Marinara no puede ejecutar el servidor en estos dispositivos. Ejecútalo en una computadora, un servidor doméstico o un dispositivo Android y luego ábrelo en Safari. La guía de iOS explica cómo.
- **Quieres editar el código:** ejecuta desde el código fuente. Esto significa que descargas el código y compilas la app en tu dispositivo. Las guías de Windows, de macOS y Linux, y de Android cubren todas este camino.

En Android, Marinara se ejecuta dentro de **Termux**, una app gratuita de Android que le da a tu teléfono un pequeño sistema Linux. El APK configura Termux por ti.

## Qué necesitas

- Para ejecutar desde el código fuente: **Node.js** 24, 25 o 26, y **Git**. Node.js ejecuta la app. Git descarga el código y lo actualiza. Las guías de cada plataforma enlazan a ambas descargas.
- Para Docker o Podman: no hace falta Node.js. La configuración recomendada de Compose usa Git una vez, para descargar los archivos del proyecto.

## Abrir Marinara

Cuando Marinara esté en ejecución, abre esta dirección en un navegador del mismo dispositivo. No la uses desde otro dispositivo.

```text
http://127.0.0.1:7860
```

`127.0.0.1` significa este dispositivo. `7860` es el puerto predeterminado, el número en el que escucha la app. Los lanzadores (los scripts que inician Marinara) también permiten que otros dispositivos de tu red lleguen a Marinara, pero esos dispositivos siguen bloqueados hasta que definas un inicio de sesión. Una instalación con Docker o Podman solo responde en este dispositivo hasta que cambies su línea de puerto; consulta [Contenedores](installation/containers.md#open-marinara-from-another-device).

## Abrir Marinara en tu teléfono

1. Instala e inicia Marinara en una computadora, un servidor doméstico o un teléfono Android.
   Con Docker o Podman, sigue primero [Abrir Marinara desde otro dispositivo](installation/containers.md#open-marinara-from-another-device).
2. Define allí un inicio de sesión. Consulta [Acceso remoto](REMOTE_ACCESS.md#option-1-login-recommended).
3. Busca la dirección IP de ese dispositivo. Las [preguntas frecuentes](FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) muestran cómo.
4. En tu teléfono, abre `http://` seguido de la dirección IP y `:7860`.

Para un iPhone, consulta [iOS e iPadOS](installation/ios-pwa.md).

## Después de instalar

Lee [Primeros pasos con Marinara Engine](home/welcome.md) para añadir una conexión, crear o importar un personaje y empezar un chat. Para actualizar más adelante, consulta [Actualizar Marinara Engine](UPGRADING.md).

## Guías relacionadas

- [Instalación en Windows](installation/windows.md)
- [Instalación en macOS y Linux](installation/macos-linux.md)
- [Instalación en contenedor](installation/containers.md)
- [Instalación en Android (Termux)](installation/android-termux.md)
- [iOS e iPadOS](installation/ios-pwa.md)
- [Actualizar Marinara Engine](UPGRADING.md)
- [Primeros pasos con Marinara Engine](home/welcome.md)
