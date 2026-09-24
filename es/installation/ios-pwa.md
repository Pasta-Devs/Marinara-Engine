# Guía de PWA para iOS / iPadOS

Esta guía muestra cómo usar Marinara Engine en un iPhone o iPad. iOS y iPadOS no pueden ejecutar por sí mismos el servidor de Marinara. En su lugar, te conectas a un servidor que corre en otro dispositivo y lo guardas en tu pantalla de inicio como una app web.

## En iOS el servidor corre en otro dispositivo

Marinara Engine tiene dos partes: un servidor que hace el trabajo real y una app web que ves en un navegador. En iPhone y iPad, Apple no deja que el servidor corra en el dispositivo. Así que ejecutas el servidor en otro lugar y luego lo abres desde Safari en tu iPhone o iPad.

El servidor puede correr en cualquiera de estos:

- Una PC con Windows (consulta la [Guía de instalación en Windows](windows.md)).
- Una máquina Mac o Linux (consulta la [Guía de instalación en macOS / Linux](macos-linux.md)).
- Un teléfono Android con Termux (consulta la [Guía de instalación en Android (Termux)](android-termux.md)).
- Un contenedor de Docker o Podman (consulta [Ejecutar mediante contenedor](containers.md)).

Tu iPhone o iPad alcanza ese servidor a través de la red. Es la misma idea que abrir cualquier sitio web, salvo que el sitio web es tu propio servidor de Marinara.

## Conéctate desde Safari

Sigue estos pasos una vez que el servidor esté corriendo en el dispositivo anfitrión.

1. Asegúrate de que el dispositivo anfitrión y tu iPhone o iPad estén en la misma red, o ambos en la misma red de Tailscale. LAN significa tu red local, como el Wi-Fi de tu casa. Tailscale es una herramienta gratuita que enlaza tus dispositivos en una red privada a través de internet.
2. Encuentra la dirección del servidor anfitrión. Se ve como el ejemplo de abajo. Reemplaza `<host-ip>` con la dirección IP de LAN o de Tailscale del dispositivo anfitrión. El puerto predeterminado es `7860`.

```
http://<host-ip>:7860
```

3. Abre **Safari** en tu iPhone o iPad.
4. Escribe esa dirección en la barra de direcciones de Safari y ve a ella.
5. Deberías ver cargar la pantalla de inicio de Marinara en el navegador.

Si la página no carga, o si te aparece una solicitud de contraseña, consulta la sección de Solución de problemas más abajo. El dueño del servidor controla el acceso de red y las contraseñas. Esos ajustes del servidor viven en la [guía de acceso remoto](../REMOTE_ACCESS.md), no en tu iPhone o iPad.

## Agregar a la pantalla de inicio

Puedes guardar Marinara como una PWA para que se abra como una app normal. PWA significa Progressive Web App (aplicación web progresiva), un sitio web que corre en su propia ventana con su propio icono en la pantalla de inicio.

1. Abre tu servidor de Marinara en **Safari** (consulta los pasos de arriba).
2. Toca el botón Compartir. Es el icono cuadrado con una flecha que apunta hacia arriba.
3. Desplázate hacia abajo en la hoja para compartir y toca **Add to Home Screen** (Agregar a pantalla de inicio).
4. Cambia el nombre si quieres y luego toca **Add** (Agregar).
5. Ahora deberías ver un icono de Marinara en tu pantalla de inicio.

Toca ese icono para abrir Marinara en su propia ventana, sin la barra de direcciones de Safari.

## Nota sobre HTTPS

Las PWA funcionan de forma más confiable sobre HTTPS. HTTPS significa una conexión web segura y cifrada, que se muestra con `https://` al inicio de la dirección.

El HTTP simple en tu LAN todavía funciona en Safari para el uso normal. Pero algunas versiones de iOS o iPadOS limitan el comportamiento de la PWA independiente para una dirección `http://` simple. Si eso pasa, sirve Marinara sobre HTTPS.

Tailscale le da a cada dispositivo una dirección privada estable y mejora la accesibilidad, pero Tailscale por sí solo no convierte una dirección `http://` en HTTPS. Usa una configuración de Tailscale que sirva HTTPS de forma explícita, o pídele al dueño del servidor que ponga Marinara detrás de HTTPS.

Estas opciones se explican en la [guía de acceso remoto](../REMOTE_ACCESS.md). Si una dirección de HTTP simple te da problemas como app de la pantalla de inicio, guárdala mejor como marcador de Safari.

## Borrar y reinstalar la PWA

A veces Safari sigue mostrando una versión anterior de la app, o la app web guardada se queda atascada. Reinstalar la app de la pantalla de inicio suele arreglar esto.

1. Mantén presionado el icono de Marinara en tu pantalla de inicio.
2. Toca la opción para quitar o eliminar la app y luego confirma.
3. Abre la app **Settings** (Configuración) en tu iPhone o iPad.
4. Toca **Safari**. En versiones más nuevas de iOS y iPadOS, puede estar dentro de **Apps**, luego **Safari**.
5. Toca **Advanced** (Avanzado) y luego toca **Website Data** (Datos de sitios web).
6. Encuentra la entrada de la dirección de tu anfitrión de Marinara. Si no la ves, toca **Show All Sites** (Mostrar todos los sitios).
7. Desliza hacia la izquierda sobre esa entrada y luego toca **Delete** (Eliminar). Esto quita los archivos guardados antiguos de ese servidor.
8. Abre Marinara otra vez en **Safari** con los pasos de Conéctate desde Safari.
9. Agrégalo de nuevo a tu pantalla de inicio con los pasos de Agregar a la pantalla de inicio.

Tus chats, personajes y ajustes se guardan en el servidor, no en tu iPhone o iPad. Reinstalar la app de la pantalla de inicio no los elimina.

## Solución de problemas

**La página no carga en Safari.** Verifica que el servidor siga corriendo en el dispositivo anfitrión. Verifica que ambos dispositivos estén en la misma red o en Tailscale. Confirma que la dirección IP y el puerto `7860` sean correctos. Para ayuda de red más a fondo, consulta la [guía de acceso remoto](../REMOTE_ACCESS.md) y [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

**Safari pide un usuario y una contraseña.** El dueño del servidor activó la protección con contraseña para dispositivos remotos. Consigue el usuario y la contraseña de quien administra el servidor. La configuración se cubre en la [guía de acceso remoto](../REMOTE_ACCESS.md).

**Safari sigue mostrando una compilación antigua.** Primero recarga la página. Si aún se ve antigua, sigue los pasos de Borrar y reinstalar la PWA de arriba.

**La app de la pantalla de inicio se cierra o queda en blanco durante una generación.** Ábrela otra vez y vuelve al chat. No necesitas reiniciar un servidor que funciona correctamente. Las respuestas automáticas y las solicitudes de imagen manuales o reintentadas exclusivas de Illustrator siguen ejecutándose en el servidor si se pierde la conexión del navegador. El chat reabierto comprueba el trabajo pendiente y actualiza los mensajes guardados y las imágenes de galería al terminar. **Stop** sigue cancelando la generación del chat seleccionado. Si vuelve la pantalla en blanco, informa tus Support Diagnostics y si reabrir restaura el chat; esta recuperación no diagnostica ni evita todos los fallos del navegador de iOS.

**Un banner rojo dice que los guardados fallarán en silencio.** Esto es una advertencia de confianza de red del servidor, no un problema del iPhone o iPad. El dueño del servidor necesita confiar en tu dirección. Consulta la [guía de acceso remoto](../REMOTE_ACCESS.md) y [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md).

**Las acciones privilegiadas están bloqueadas.** Algunas acciones de mantenimiento necesitan un secreto de administrador del dueño del servidor. En tu iPhone o iPad, guardas ese valor en **Settings**, luego **Advanced**, luego **Admin Access** (Acceso de administrador). La [guía de acceso remoto](../REMOTE_ACCESS.md) explica qué es el secreto de administrador y cómo conseguir uno.

## Guías relacionadas

- [Acceso remoto: autenticación básica y lista de IP permitidas](../REMOTE_ACCESS.md)
- [Preguntas frecuentes](../FAQ.md)
- [Solución de problemas de Marinara Engine](../TROUBLESHOOTING.md)
- [Guía de instalación en Android (Termux)](android-termux.md)
