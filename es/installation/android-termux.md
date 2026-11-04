# Guía de instalación en Android (Termux)

Ejecuta Marinara Engine en un teléfono o una tableta Android. Marinara se ejecuta dentro de Termux, una app gratuita que le da a tu teléfono un pequeño sistema Linux. Puedes configurarlo con la app de Android de Marinara (lo más fácil) o a mano en Termux.

## Acerca de Termux y F-Droid

Marinara es un servidor Linux, no una app nativa de Android, así que necesita Termux para ejecutarse. F-Droid es una tienda de apps gratuita y de código abierto. La configuración de la app de Android descarga la versión estable de Termux desde F-Droid. Termux también tiene una versión experimental en Google Play. Si ya está instalada, Marinara la acepta, pero esta guía recomienda F-Droid.

Instala Termux desde [Termux en F-Droid](https://f-droid.org/en/packages/com.termux/). No mezcles Termux ni sus apps complementarias de fuentes distintas, porque sus firmas deben coincidir. Consulta las [notas oficiales de instalación de Termux](https://github.com/termux/termux-app#installation).

## Instalar con la app de Android

La app de Android de Marinara Engine configura Termux y luego abre Marinara cuando el servidor local está funcionando. Por el camino, Android te pide que apruebes algunos avisos del sistema.

1. Toca [Descargar el APK más reciente de Android](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk). Un APK es un archivo de instalación de app de Android.
2. Instala el APK y luego abre la app.
3. Toca **Install / Start Marinara** (Instalar / Iniciar Marinara).
4. Si Termux no está instalado, aprueba los avisos de instalación de Android, incluido el que permite a la app instalar apps, para que pueda instalar Termux desde F-Droid.
5. Cuando Android lo pida, concede el permiso **Run commands in Termux environment** (Ejecutar comandos en el entorno de Termux).
6. Si Termux bloquea la configuración, la app copia un comando `allow-external-apps` y abre Termux. Mantén pulsada la pantalla de Termux, toca **Paste** (Pegar), pulsa Enter, luego vuelve y toca **Install / Start Marinara** de nuevo.
7. Espera mientras Termux instala las dependencias (las partes que necesita la app) y compila Marinara. Termux muestra texto que se desplaza. La primera compilación tarda unos minutos.
8. Vuelve a la app Marinara Engine cuando Termux termine. La app se conecta e inicia sesión por sí sola cuando el servidor está listo, y ves la pantalla de inicio de Marinara.

Para usar tu navegador en su lugar, selecciona **Open in browser** (Abrir en el navegador) en el lanzador de la app. La app recuerda la elección, y el inicio de sesión también es automático allí.

Si no funcionó: toca **Install / Start Marinara** de nuevo después de resolver el aviso que lo bloqueó. Si la app no puede abrir localhost, actualiza el APK y toca **Install / Start Marinara**. Consulta [Ayuda de inicio de sesión de localhost en Android](../TROUBLESHOOTING.md#android-localhost-opens-the-login-page-or-returns-401503).

La app no necesita ninguna clave de firma, contraseña ni cambio en `CSRF_TRUSTED_ORIGINS`. Crea su propia credencial privada de localhost. No añadas `null` a `CSRF_TRUSTED_ORIGINS`.

## Instalar a mano en Termux

Usa esta opción si no quieres la app. Abre Termux, luego mantén pulsada la pantalla y toca **Paste** para pegar este comando (cópialo entero):

```bash
pkg upgrade -y && pkg install -y git nodejs-lts && \
([ -d "$HOME/Marinara-Engine/.git" ] || \
  git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && \
cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

En orden, el comando:

1. Actualiza todos los paquetes de Termux. Un Node.js más reciente no puede iniciarse con bibliotecas de Termux más antiguas, así que Termux necesita una actualización completa. Si te pregunta si quieres conservar un archivo de configuración, pulsa Enter para conservar el tuyo.
2. Instala Git y Node.js. Marinara admite Node.js 24, 25 y 26.
3. Descarga Marinara, a menos que ya esté ahí.
4. Hace ejecutable el lanzador (`start-termux.sh`) y lo ejecuta.

El lanzador instala las dependencias, compila Marinara en tu dispositivo e inicia el servidor local. Actualiza Node.js si tu versión es demasiado antigua. La primera ejecución es lenta y Termux muestra texto que se desplaza. Las ejecuciones posteriores son más rápidas.

Cuando indique que el servidor está en ejecución, abre esta dirección en tu navegador de Android:

```text
http://127.0.0.1:7860
```

Si estableces un `PORT` distinto, usa ese número. Para obtener un icono parecido al de una app, usa la opción del menú de tu navegador que añade la página a la pantalla de inicio. El nombre varía entre navegadores.

## Iniciar y detener Marinara

Con la app, ábrela y toca **Install / Start Marinara** si el servidor está detenido. Para cambiar entre la app y tu navegador, usa **Open in browser** en el lanzador y luego **Retry connection** (Reintentar conexión). Desde la app, vuelve al lanzador con **Settings → General → App Behavior → Open Android launcher (app or browser)** (Configuración → General → Comportamiento de la app → Abrir el lanzador de Android: app o navegador).

Con una instalación manual, abre Termux y ejecuta:

```bash
cd Marinara-Engine
./start-termux.sh
```

Para detener el servidor, pulsa <kbd>Ctrl</kbd>+<kbd>C</kbd> en Termux.

## Actualizar Marinara

Cada vez que ejecutas `./start-termux.sh`, el lanzador comprueba en GitHub si hay una versión más nueva y actualiza antes de iniciarse. Para iniciar sin actualizar, añade `--skip-update`. Para ver más opciones y los pasos para actualizar el APK, consulta [Actualizar Marinara Engine](../UPGRADING.md#android-termux).

El lanzador también elimina los paquetes sin usar de su caché local de pnpm durante las actualizaciones. Esto evita que las versiones antiguas llenen varios gigabytes de almacenamiento. No toca tus chats ni tu configuración.

## Abrir Marinara desde otro dispositivo

El lanzador permite que otros dispositivos de tu red Wi-Fi lleguen a Marinara, pero los bloquea hasta que definas un inicio de sesión. Consulta las [preguntas frecuentes](../FAQ.md#how-do-i-access-marinara-engine-from-my-phone-or-another-device) y [Acceso remoto](../REMOTE_ACCESS.md).

Si otro dispositivo no puede iniciar sesión después de una actualización, consulta [Bloqueado después de actualizar](../REMOTE_ACCESS.md#locked-out-after-updating). En Termux, este comando elimina el inicio de sesión de la app y cierra la sesión en todos los navegadores:

```bash
cd "$HOME/Marinara-Engine" && node scripts/reset-login.mjs
```

## Guías relacionadas

- [Instalación de Marinara Engine](../INSTALLATION.md)
- [Guía de PWA para iOS / iPadOS](ios-pwa.md)
- [Actualizar Marinara Engine](../UPGRADING.md)
- [Preguntas frecuentes](../FAQ.md)
