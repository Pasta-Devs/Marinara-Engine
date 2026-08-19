# Guía de instalación en Android (Termux)

Esta guía te muestra cómo ejecutar Marinara Engine en un teléfono o una tableta Android. Marinara se ejecuta dentro de Termux, un entorno Linux gratuito para Android. Puedes configurarlo de la forma fácil con la app de Android, o a mano en la terminal de Termux.

## Qué son Termux y F-Droid

Termux es una app gratuita que le da a tu teléfono un pequeño sistema Linux y una línea de comandos. Marinara Engine la necesita porque Marinara es un servidor Linux, no una app nativa de Android.

F-Droid es una tienda de apps gratuita y de código abierto para Android. La configuración automática de Marinara descarga la versión estable de Termux desde F-Droid. Termux también tiene una versión experimental distinta en Google Play; si ya está instalada, Marinara reconoce su firma oficial, pero F-Droid sigue siendo la ruta recomendada en esta guía.

Instala Termux desde F-Droid aquí: [Termux en F-Droid](https://f-droid.org/en/packages/com.termux/). No mezcles Termux ni sus apps complementarias de fuentes distintas porque sus firmas deben coincidir. Consulta las [notas oficiales de instalación de Termux](https://github.com/termux/termux-app#installation) para ver los detalles de cada fuente.

## Instalación con la app de Android (APK)

La ruta más fácil usa la app de Android de Marinara Engine. Un APK es un archivo de instalación de app de Android. Esta app es un pequeño ayudante: configura Termux por ti y luego abre Marinara una vez que el servidor local está funcionando. Aun así necesita Termux para hacer el trabajo real, así que Android te pedirá que apruebes algunos avisos del sistema. Instalar el APK precompilado no requiere una clave de firma, contraseña, secreto de acceso local ni cambiar `CSRF_TRUSTED_ORIGINS`. La app genera e intercambia automáticamente su credencial privada de localhost. No añadas `null` a `CSRF_TRUSTED_ORIGINS`; se trata intencionadamente como no configurado y el intercambio del APK no lo necesita.

1. Toca [Descargar el APK más reciente de Android](https://github.com/Pasta-Devs/Marinara-Engine/releases/latest/download/marinara-engine-android.apk).
2. Instala el APK y luego abre la app.
3. Toca **Install / Start Marinara** (Instalar / Iniciar Marinara).
4. Si Termux aún no está instalado, aprueba los avisos de instalación de Android para que la app pueda descargar e instalar Termux desde F-Droid.
5. Cuando Android lo pida, concede el permiso **Run commands in Termux environment** (Ejecutar comandos en el entorno de Termux).
6. Si Termux bloquea la configuración, la app copia por ti un comando `allow-external-apps`. Pega ese comando en Termux una vez y luego toca **Install / Start Marinara** de nuevo.
7. Espera mientras Termux instala las dependencias y compila Marinara. La primera compilación tarda unos minutos.
8. Vuelve a la app Marinara Engine cuando Termux termine. La app se conecta e inicia sesión automáticamente cuando el servidor local está listo.

Si prefieres un icono en la pantalla de inicio que abra Marinara como una app normal, esta misma app de Android lo ofrece. Es una envoltura alrededor del servidor de Termux, así que el servidor debe configurarse primero. No puede saltarse los avisos de instalación y de permisos de Android, pero no te pide configurar ningún secreto de instalación de Marinara.

## Instalación manual en Termux

Si prefieres no usar la app, puedes instalar Marinara a mano. Abre Termux y pega este único comando:

```
pkg update -y && pkg install -y git nodejs-lts && ([ -d "$HOME/Marinara-Engine/.git" ] || git clone https://github.com/Pasta-Devs/Marinara-Engine.git "$HOME/Marinara-Engine") && cd "$HOME/Marinara-Engine" && chmod +x start-termux.sh && ./start-termux.sh
```

Este único comando hace cinco cosas:

1. Actualiza los paquetes de Termux.
2. Instala Git y Node.js. Marinara admite las versiones 24, 25 y 26 de Node.js.
3. Descarga Marinara Engine, a menos que ya esté instalado.
4. Hace ejecutable el lanzador (el script `start-termux.sh`).
5. Ejecuta el lanzador por primera vez.

El lanzador instala las dependencias de la app, compila Marinara en tu dispositivo e inicia el servidor local. También actualiza Node.js por ti si tu versión es demasiado antigua. La primera ejecución es lenta porque compila la app. Las ejecuciones posteriores son mucho más rápidas.

Cuando termine, abre esta dirección en tu navegador de Android:

```
http://127.0.0.1:7860
```

Marinara escucha en el puerto definido por `PORT` (el puerto de red que usa la app). El valor predeterminado es 7860. Si estableces un `PORT` distinto, usa ese número en su lugar.

Consejo: para obtener un icono parecido al de una app, abre el menú de tu navegador y elige la opción que añade Marinara a tu pantalla de inicio. El nombre exacto del menú varía entre navegadores.

## Iniciar Marinara de nuevo

Después de la primera configuración, no repites la instalación. Abre Termux y ejecuta:

```
cd Marinara-Engine
./start-termux.sh
```

El lanzador comprueba si hay actualizaciones y luego inicia Marinara. Para iniciar tu copia actual sin comprobar en GitHub, añade `--skip-update`:

```
cd Marinara-Engine
./start-termux.sh --skip-update
```

El lanzador también elimina los paquetes sin referencias de su caché local de pnpm durante las actualizaciones de dependencias. Esto evita que las versiones antiguas acumulen varios gigabytes en el teléfono; no toca los chats, la configuración ni otros datos de usuario de Marinara.

## Acceder desde otro dispositivo

De forma predeterminada, el lanzador hace que Marinara sea accesible en tu red local. Esto significa que una computadora portátil u otro teléfono en la misma red Wi-Fi puede abrirlo. Para instrucciones paso a paso sobre cómo encontrar la dirección correcta, consulta las [Preguntas frecuentes](../FAQ.md).

## Actualización

Cada vez que ejecutas el lanzador (`./start-termux.sh`), comprueba si hay una versión más nueva en GitHub y actualiza antes de iniciarse. Así que la forma sencilla de mantenerte al día es simplemente iniciar Marinara de la manera habitual.

Para iniciar tu copia instalada sin actualizar, usa la opción de omisión:

```
./start-termux.sh --skip-update
```

Para mantener la versión del Engine instalada entre inicios, añade `AUTO_UPDATE_ENABLED=false` al `.env` del proyecto. Esto no desactiva los comandos de actualización manual ni **Settings → Advanced → Updates** (Configuración → Avanzado → Actualizaciones).

También puedes comprobar si hay actualizaciones dentro de la app. Abre **Settings** (Configuración), ve a la pestaña **Advanced** (Avanzado) y abre la sección **Updates** (Actualizaciones). Haz clic en **Check for Updates** (Buscar actualizaciones) para ver si existe una versión más nueva. El botón **Apply Update** (Aplicar actualización) dentro de la app está desactivado de forma predeterminada y requiere configuración. Para saber cómo activarlo y usarlo, consulta [Actualizar Marinara Engine](../UPGRADING.md).

## Guías relacionadas

- [Instalación de Marinara Engine](../INSTALLATION.md)
- [Guía de PWA para iOS / iPadOS](ios-pwa.md)
- [Actualizar Marinara Engine](../UPGRADING.md)
- [Preguntas frecuentes](../FAQ.md)
