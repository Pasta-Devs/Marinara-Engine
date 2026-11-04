# Guía de PWA para iOS / iPadOS

Usa Marinara Engine en un iPhone o iPad. Apple no deja que el servidor de Marinara corra en estos dispositivos, así que abres en Safari un servidor que corre en otro dispositivo. Después puedes guardarlo en tu pantalla de inicio como una PWA. Una PWA (Progressive Web App, aplicación web progresiva) es un sitio web que se abre en su propia ventana, como una app.

## Ruta rápida

1. Instala e inicia Marinara en una computadora, un servidor doméstico o un teléfono Android (consulta la lista de abajo). Déjalo corriendo.
2. Define un inicio de sesión en esa computadora. Consulta [Acceso remoto](../REMOTE_ACCESS.md#option-1-login-recommended).
3. Encuentra la dirección IP de la computadora (consulta abajo).
4. En tu iPhone o iPad, abre **Safari** y ve a `http://` seguido de esa dirección IP y `:7860`.

No uses `127.0.0.1` en tu iPhone o iPad. Esa dirección significa el propio iPhone.

## Dónde corre el servidor

El servidor puede correr en:

- Una PC con Windows: [Guía de instalación en Windows](windows.md).
- Una computadora Mac o Linux: [Guía de instalación en macOS / Linux](macos-linux.md).
- Un teléfono Android con Termux: [Guía de instalación en Android (Termux)](android-termux.md).
- Un contenedor de Docker o Podman: [Ejecutar mediante contenedor](containers.md).

## Conéctate desde Safari

Antes de empezar: el servidor debe estar corriendo y dejar entrar a tu dispositivo, normalmente con un inicio de sesión. Consulta [Acceso remoto](../REMOTE_ACCESS.md).

1. Pon el dispositivo del servidor y tu iPhone o iPad en la misma red, como el Wi-Fi de tu casa. Para conectarte desde otro lugar, usa Tailscale, una herramienta gratuita que enlaza tus dispositivos en una red privada a través de internet.
2. Encuentra la dirección IP del dispositivo del servidor. En la computadora del servidor, ejecuta un comando en una terminal (una ventana donde escribes comandos) y lee la dirección, que se ve como `192.168.1.42`.

   - Windows (Símbolo del sistema): `ipconfig`. Lee la **IPv4 Address** (Dirección IPv4).
   - Linux: `hostname -I`.
   - macOS: `ipconfig getifaddr en0`.

3. Abre **Safari** y ve a esta dirección. Reemplaza `<host-ip>` con esa dirección IP. El puerto predeterminado es `7860`.

```text
http://<host-ip>:7860
```

4. Se carga la pantalla de inicio de Marinara.

Si ves una página de inicio de sesión, inicia sesión con el usuario y la contraseña del servidor. Si ves una página de configuración, escribe el código de configuración de un solo uso del registro del servidor y elige un usuario y una contraseña. Consulta [Acceso remoto](../REMOTE_ACCESS.md).

Si no funcionó: verifica que el servidor siga corriendo y que ambos dispositivos estén en la misma red o en Tailscale. Revisa la dirección IP y el puerto. Consulta [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

## Agregar a la pantalla de inicio

1. Abre tu servidor de Marinara en **Safari**.
2. Toca el botón Compartir, el icono cuadrado con una flecha que apunta hacia arriba.
3. Desplázate hacia abajo en la hoja para compartir y toca **Add to Home Screen** (Agregar a pantalla de inicio).
4. Cambia el nombre si quieres y luego toca **Add** (Agregar).

Aparece un icono de Marinara en tu pantalla de inicio. Tócalo para abrir Marinara en su propia ventana, sin la barra de direcciones de Safari.

## Usa HTTPS si la app falla

Una PWA funciona mejor sobre HTTPS, una conexión segura que empieza con `https://`. Una dirección `http://` simple funciona en Safari. Algunas versiones de iOS y iPadOS limitan una app de la pantalla de inicio en una dirección `http://` simple. Si eso pasa, sirve Marinara sobre HTTPS, o guárdala como marcador de Safari.

Tailscale por sí solo no convierte una dirección en HTTPS. Usa una configuración de Tailscale que sirva HTTPS, o pídele al dueño del servidor que ponga Marinara detrás de HTTPS. Consulta [Acceso remoto](../REMOTE_ACCESS.md#serving-over-https).

<a id="clearing-and-reinstalling-the-pwa"></a>

## Borrar y reinstalar la PWA

A veces Safari conserva una versión anterior de la app, o la app guardada se queda atascada. Reinstalarla suele arreglar esto. Tus chats, personajes y ajustes están en el servidor, así que reinstalar no los elimina.

1. Mantén presionado el icono de Marinara en tu pantalla de inicio.
2. Toca la opción para quitar la app y luego confirma.
3. Abre la app **Settings** (Configuración) en tu iPhone o iPad.
4. Toca **Safari**. En versiones más nuevas de iOS y iPadOS, puede estar dentro de **Apps**, luego **Safari**.
5. Toca **Advanced** (Avanzado) y luego **Website Data** (Datos de sitios web).
6. Encuentra la entrada de tu dirección de Marinara. Si no la ves, toca **Show All Sites** (Mostrar todos los sitios).
7. Desliza hacia la izquierda sobre la entrada y toca **Delete** (Eliminar).
8. Abre Marinara otra vez en **Safari** y agrégala de nuevo a la pantalla de inicio, con los pasos de arriba.

## Solución de problemas

**La página no carga en Safari.** Verifica que el servidor esté corriendo, que ambos dispositivos estén en la misma red o en Tailscale, y que la dirección IP y el puerto `7860` sean correctos. Consulta [Acceso remoto](../REMOTE_ACCESS.md) y [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

**Safari muestra una página de inicio de sesión o de configuración tras una actualización.**

- Inicia sesión en `/login` con el usuario y la contraseña del servidor.
- Si no existe ningún inicio de sesión, escribe en la página de configuración el código de configuración de un solo uso del registro del servidor.
- Si el servidor no imprime ningún código, define el inicio de sesión en el dispositivo del servidor en **Settings → Advanced → Access**.
- Un **403** puede significar que tu iPhone no está en `IP_ALLOWLIST`. El dueño del servidor cambia esa lista.
- La PWA no puede restablecer el inicio de sesión del servidor. El dueño del servidor ejecuta `node scripts/reset-login.mjs` en la carpeta de Marinara del servidor (en Docker: `docker exec <container> node scripts/reset-login.mjs`), o cambia un inicio de sesión definido en `.env`.

Consulta [Bloqueado después de actualizar](../REMOTE_ACCESS.md#locked-out-after-updating).

**Safari sigue mostrando una compilación antigua.** Recarga la página. Si aún se ve antigua, reinstala la PWA con los pasos de arriba.

**La app de la pantalla de inicio se cierra o queda en blanco durante una generación.** Ábrela otra vez y vuelve al chat. Un servidor que funciona correctamente sigue trabajando: las respuestas del chat y las solicitudes de imagen de Illustrator siguen ejecutándose en el servidor, y el chat reabierto se actualiza cuando terminan. **Stop** sigue cancelando la generación del chat seleccionado. Si la pantalla en blanco sigue volviendo, infórmalo con tus Support Diagnostics.

**Un banner rojo dice que los guardados fallarán en silencio.** Esto es una advertencia de confianza de red del servidor, no un problema de tu iPhone o iPad. El dueño del servidor necesita confiar en tu dirección. Consulta [Acceso remoto](../REMOTE_ACCESS.md#why-is-my-save-blocked-csrf).

**Las acciones privilegiadas están bloqueadas.** Algunas acciones de mantenimiento necesitan el secreto de administrador (una segunda contraseña) del dueño del servidor. Guárdalo en tu iPhone o iPad en **Settings → Advanced → Admin Access** (Configuración → Avanzado → Acceso de administrador). Consulta [Acceso remoto](../REMOTE_ACCESS.md#admin-access-and-privileged-actions).

## Guías relacionadas

- [Acceso remoto: inicio de sesión y lista de IP permitidas](../REMOTE_ACCESS.md)
- [Preguntas frecuentes](../FAQ.md)
- [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md)
- [Guía de instalación en Android (Termux)](android-termux.md)
