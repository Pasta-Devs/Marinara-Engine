# Extensiones personales

Una Personal Extension (extensión personal) es un pequeño fragmento de código que añade un botón, un panel o una utilidad a Marinara. Professor Mari puede escribir una para ti, y tú decides si llega a ejecutarse alguna vez. Esta guía explica cómo revisar, activar, exportar y recuperar extensiones. Para escribir la tuya, consulta [Escribir extensiones personales](writing-personal-extensions.md).

## Cuál es cada tipo

| Nombre | Qué es |
| --- | --- |
| Personal Extension | Una extensión que Professor Mari escribió para ti. Aparece como borrador en **Settings → Addons** (Configuración → Complementos). |
| External Extension (extensión externa) | Una extensión de otra persona, o una que escribiste tú. Necesita los pasos adicionales de [Permitir importaciones de terceros](#allow-third-party-imports). |
| Browser Extension (extensión de navegador) | Se ejecuta dentro de tu navegador, en un sandbox. Es segura de forma predeterminada. |
| Server Extension (extensión de servidor) | Se ejecuta en la computadora que ejecuta Marinara, en un sandbox del sistema operativo. Necesita una plataforma compatible. |
| Full page access (acceso completo a la página) | Un permiso que quita el sandbox. Solo para código en el que confías plenamente. |

## Instalar una extensión que alguien compartió

Antes de empezar, haz los dos pasos de [Permitir importaciones de terceros](#allow-third-party-imports). Sin ellos, los botones de importación están ocultos.

1. Abre **Settings → Addons**. En **External Extensions** (Extensiones externas), elige **Import Extension File** (Importar archivo de extensión) para un archivo `.zip`, `.json`, `.css` o `.js`, o **Import Extension Folder** (Importar carpeta de extensión) para una carpeta.
2. Abre el borrador nuevo. Está desactivado y muestra su código y un hash, una huella corta de ese código exacto (Marinara usa SHA-256).
3. Lee el código y la lista **Requested access** (Acceso solicitado).
4. Elige **Review and Run** (Revisar y ejecutar) solo si aceptas esa versión exacta. Entonces la extensión aparece como activada.

Si no funcionó: si faltan los botones de importación, no has hecho uno de los dos pasos. Recuerda reiniciar Marinara después de cambiar `.env`.

## Revisar una extensión de Professor Mari

Antes de empezar, pídele a [Professor Mari](../home/professor-mari.md) que cree una extensión. Ella puede guardar el código, pero no puede aprobarlo ni activarlo. Esta sección no tiene un botón de nuevo borrador ni un control de importación.

1. Abre **Settings → Addons → Personal Extensions** (Configuración → Complementos → Extensiones personales). Si no hay borradores, dice: "Ask Professor Mari to create an extension for you. Nothing runs until you enable it and approve the exact code hash."
2. Abre el borrador y lee el código. Comprueba el hash y la lista **Requested access**.
3. Elige **Review and Run** solo si aceptas esa versión exacta.

Cada borrador empieza desactivado. Cualquier edición del código, cambio de permisos o revisión restaurada desactiva la extensión y necesita una nueva aprobación.

> **Advertencia:** un sandbox limita lo que puede hacer el código, pero no hace que el código sea confiable. Una extensión dañina todavía puede malgastar tiempo de procesador hasta que un watchdog (un temporizador que detiene el código descontrolado) la detenga, llenar su propio almacenamiento hasta el límite o engañarte a través de los registros. Las extensiones de página completa renuncian al sandbox a propósito. Lee el código antes de activarlo e inspecciona cada línea del código de terceros.

Si no funcionó: las ediciones de Professor Mari y cualquier revisión restaurada devuelven el borrador al estado desactivado. Revísalo de nuevo y comprueba que el hash del cuadro de diálogo es el que leíste.

## Qué puede hacer una extensión

Una Browser Extension se ejecuta en un sandbox (un área aislada) dentro de tu navegador. No puede acceder a la página de Marinara, a las cookies, al almacenamiento del navegador ni a la red. Puede:

- tener almacenamiento privado y escribir registros
- añadir botones, elementos de menú y paneles que Marinara dibuja con tu tema
- leer los IDs del chat abierto
- leer campos seleccionados de los personajes activos o de la persona activa, solo cuando apruebas esos permisos

La lista completa está en [Escribir extensiones personales](writing-personal-extensions.md#what-a-browser-extension-can-do).

Una Server Extension se ejecuta en un proceso de Node aparte (un programa en la computadora del servidor) dentro de un sandbox del sistema operativo. No puede acceder a los archivos de Marinara, a tus archivos, a los secretos del servidor, a la red, a procesos hijos, a workers ni a complementos nativos.

<a id="platform-support"></a>

### Compatibilidad de plataformas

El navegador aísla las Browser Extensions en un sandbox, así que funcionan en todas partes. Las Server Extensions necesitan un sandbox del sistema operativo compatible. Donde no existe ninguno, permanecen desactivadas, y Marinara nunca las ejecuta sin él.

| Plataforma | Server Extensions |
| --- | --- |
| macOS | Aisladas con Seatbelt, el sandbox de macOS |
| Linux con Bubblewrap | Aisladas con Bubblewrap, una herramienta de sandbox de Linux |
| Linux sin `bwrap` | Desactivadas: instala `bwrap` |
| Docker (predeterminado) | Desactivadas: privilegios del contenedor |
| Windows | Desactivadas: usa una Browser Extension |
| Android | Desactivadas: usa una Browser Extension |

Las Browser Extensions están aisladas en un sandbox en todas las plataformas. Las External Extensions de página completa no están aisladas en ninguna y siempre necesitan tu confianza explícita.

La imagen oficial de Docker contiene Bubblewrap, pero su contenedor predeterminado no puede crear los espacios de nombres anidados ni los montajes que necesita Bubblewrap. Marinara comprueba el sandbox en tiempo de ejecución y deja desactivadas las Server Extensions cuando el contenedor lo impide. Consulta [Solución de problemas](../TROUBLESHOOTING.md#a-server-extension-says-no-supported-sandbox-is-available) para conocer la modificación de los permisos de Docker y sus implicaciones de seguridad.

En Windows y Android no hay un sandbox de procesos compatible, así que las Server Extensions no están disponibles. Usa una Browser Extension, o ejecuta el servidor de Marinara en macOS o en Linux con `bwrap`.

<a id="allow-third-party-imports"></a>

## Permitir importaciones de terceros

Las importaciones de terceros están bloqueadas y ocultas de forma predeterminada, porque ejecutan código escrito por otras personas. Dos pasos las desbloquean:

1. En la computadora que ejecuta Marinara, establece `ENABLE_EXTERNAL_EXTENSIONS=true` en el archivo `.env` y luego reinicia Marinara. Consulta la [Referencia de configuración del servidor](../CONFIGURATION.md).
2. Abre **Settings → Advanced → Danger Zone** (Configuración → Avanzado → Zona de peligro), desplázate por debajo de los controles de eliminación de datos, lee la advertencia y activa **Allow third-party extension imports** (Permitir importaciones de extensiones de terceros).

Entonces **Settings → Addons** muestra **External Extensions** con controles para importar archivos y carpetas. Formatos compatibles:

- paquetes `.personal-extension.zip` y `.zip` compatibles
- manifiestos `.json`
- `.css`
- `.js`, `.mjs` y `.cjs`
- `.server.js`, `.server.mjs` y `.server.cjs`

Las importaciones nunca traen aprobación y no pueden activarse por sí mismas. La mayoría de las Browser Extensions deberían quedarse en el sandbox seguro. Un paquete marcado con **Full page access** (Acceso completo a la página) es diferente:

- Su código se ejecuta en la página de Marinara, sin sandbox.
- Puede leer chats y tarjetas, usar el almacenamiento del navegador, hacer peticiones de red y llamar a las propias APIs de Marinara.
- Actívalo solo después de haber inspeccionado esa versión exacta y de confiar en ella.
- Los borradores de Professor Mari no pueden solicitarlo.

Los registros antiguos, importados de un perfil, almacenados manualmente y de origen desconocido también se tratan como externos. Permanecen ocultos, no se pueden aprobar y no se ejecutan hasta que los dos pasos estén hechos.

Si desactivas cualquiera de los dos pasos, se desactivan todas las extensiones importadas. Volver a activarlo no las ejecuta de nuevo. Recarga la página si una extensión de página completa dejó cambios atrás.

Si no funcionó: si los controles de importación no aparecen, comprueba que los dos pasos estén hechos y que estés en la computadora del servidor o hayas guardado el secreto de administrador en **Settings → Advanced → Admin Access** (Configuración → Avanzado → Acceso de administrador).

## Exportación, revisiones y recuperación

Usa la acción de exportar de una extensión para descargar un paquete portátil. Los paquetes exportados y restaurados permanecen desactivados. Restaurar una revisión también la devuelve a un borrador desactivado.

**Settings → Addons → Extension revision history** (Configuración → Complementos → Historial de revisiones de extensiones) establece cuántas versiones anteriores del código se conservan para todas las Personal Extensions y External Extensions. El valor predeterminado es **10**. Elige de **0** a **10**, donde **0** desactiva el historial. Al reducir el límite, se pide confirmación antes de eliminar permanentemente las revisiones antiguas. Se conservan el código actual, las aprobaciones, el estado de activación y los datos guardados de la extensión. Las ediciones hechas a través de Professor Mari siguen el mismo límite.

Si una extensión se comporta mal, elige **Disable** (Desactivar). Si la interfaz no está disponible, detén Marinara y establece en `"false"` el valor `enabled` del registro `installed_extensions` correspondiente. Nunca establezcas `approvedHash` a mano.

## Guías relacionadas

- [Escribir extensiones personales](writing-personal-extensions.md)
- [Professor Mari](../home/professor-mari.md)
- [Configuración del servidor](../CONFIGURATION.md)
- [Copia de seguridad y restauración](../data/backup-and-restore.md)
- [Acceso remoto](../REMOTE_ACCESS.md)
