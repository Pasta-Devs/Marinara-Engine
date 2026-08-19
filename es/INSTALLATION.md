# Instalación de Marinara Engine

Esta guía te ayuda a elegir la forma correcta de instalar Marinara Engine para tu dispositivo. Marinara se ejecuta en tu propia máquina, así que tus chats y tus datos se quedan en local. Cada plataforma de abajo tiene su propia guía paso a paso, enlazada desde la tabla.

## Elige tu plataforma

Elige la guía que corresponda al dispositivo en el que quieres ejecutar Marinara.

| Plataforma | Guía de instalación |
|---|---|
| Windows | [Instalación en Windows](installation/windows.md) |
| macOS o Linux | [Instalación en macOS y Linux](installation/macos-linux.md) |
| Docker o Podman | [Instalación en contenedor](installation/containers.md) |
| Teléfono o tableta Android | [Descargar APK](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk) · [Guía de instalación en Android](installation/android-termux.md) |
| iPhone o iPad | [iOS e iPadOS](installation/ios-pwa.md) |

Algunas cosas que conviene saber antes de elegir:

- En **iPhone o iPad**, Marinara no ejecuta el servidor por sí mismo. El servidor lo ejecutas en una computadora, en un servidor doméstico o en un dispositivo Android. Después lo abres en Safari en tu iPhone o iPad. La guía de iOS explica esto.
- En **Android**, Marinara se ejecuta dentro de **Termux**. Termux es una app gratuita que da a Android un pequeño entorno de Linux. Toca la descarga directa del APK, aprueba los avisos obligatorios de instalación y permisos de Termux de Android y deja que la app gestione automáticamente su credencial privada de localhost. Los instaladores nunca proporcionan credenciales de firma de Android ni ese secreto local.

## Cuál debería elegir

Si esto es nuevo para ti y quieres la menor configuración posible, elige una de estas opciones:

- En **Windows**, usa el **Windows installer** (instalador de Windows). Descarga y configura todo por ti, y añade un acceso directo en el escritorio.
- En **Android**, usa el enlace **Descargar APK** de arriba. Abre el archivo descargado y toca **Install / Start Marinara** en la app.
- En **macOS**, **Linux** o un servidor doméstico, usa **Docker**. Un solo comando ejecuta la app. La imagen ya contiene Node.js, todas las dependencias y una copia compilada de la app. Te ahorras instalar Node.js y compilar la app tú mismo.

Si te sientes cómodo con una terminal y quizás quieras editar el código, ejecuta desde el código fuente. "Ejecutar desde el código fuente" significa que descargas el código y compilas la app en tu máquina. Las guías de **Windows**, **macOS y Linux** y **Android (Termux)** cubren todas este camino.

## Notas mínimas del sistema

- Necesitas una computadora o dispositivo que pueda ejecutar un servidor: Windows, macOS, Linux o Android.
- Para ejecutar desde el código fuente, necesitas **Node.js** versión 24 y **Git**. Node.js ejecuta la app, y Git descarga y actualiza el código. Las guías de cada plataforma enlazan a ambas descargas.
- Las instalaciones con **Docker** y **Podman** no necesitan Node.js. La configuración recomendada de Compose sigue usando Git para descargar los archivos del proyecto. La guía de contenedor cubre esto.
- De forma predeterminada, la app se ejecuta en tu propia máquina en esta dirección:

```text
http://127.0.0.1:7860
```

- La dirección `127.0.0.1` significa tu propia computadora, y `7860` es el puerto predeterminado. Para llegar a Marinara desde tu teléfono u otro dispositivo de tu red, consulta las [preguntas frecuentes](FAQ.md) sobre el acceso por LAN.

## A dónde ir después de instalar

Cuando Marinara esté en ejecución y abierto en tu navegador, lee [Primeros pasos con Marinara Engine](home/welcome.md). Te guía por tus primeros pasos: añadir una conexión, crear o importar un personaje y empezar un chat.

Para mantener tu instalación actualizada más adelante, consulta [Actualizar Marinara Engine](UPGRADING.md).

## Guías relacionadas

- [Instalación en Windows](installation/windows.md)
- [Instalación en macOS y Linux](installation/macos-linux.md)
- [Instalación en contenedor](installation/containers.md)
- [Instalación en Android (Termux)](installation/android-termux.md)
- [iOS e iPadOS](installation/ios-pwa.md)
- [Actualizar Marinara Engine](UPGRADING.md)
- [Primeros pasos con Marinara Engine](home/welcome.md)
