# Copia de seguridad y restauración de Marinara

Guarda una copia de los datos de tu Marinara Engine y vuelve a ponerla más tarde. Hazlo antes de actualizar, cambiar a un dispositivo nuevo o [borrar tus datos](clearing-data.md).

## Cuál elegir

| Opción | Qué crea | Úsala para |
| --- | --- | --- |
| **Download Backup** (Descargar copia de seguridad) | Un `.zip` con todos tus datos y archivos. | Una copia completa de todo. |
| **Export Profile** (Exportar perfil) | Un archivo más pequeño con los datos de tu cuenta (personajes, chats, lorebooks y más). | Una copia sin secretos, o archivos para otras herramientas. |

Un `.zip` es un solo archivo que contiene muchos archivos. Las dos opciones están en **Settings → Advanced → Backup & Export**. La restauración está en **Settings → Imports → Profile & Marinara**.

**Antes de empezar:** en la computadora que ejecuta Marinara, estas herramientas funcionan de inmediato. Desde un teléfono, una tableta o cualquier otro dispositivo, define el secreto de administrador en el servidor y escribe el mismo valor en **Settings → Advanced → Admin Access**. El secreto de administrador es una contraseña que va en el archivo `.env` del servidor, como el ajuste `ADMIN_SECRET`. Consulta la sección "Privileged APIs (ADMIN_SECRET)" de la [Referencia de configuración del servidor](../CONFIGURATION.md) y de [Acceso remoto](../REMOTE_ACCESS.md).

## Download Backup

1. Abre **Settings**.
2. Ve a **Advanced**.
3. En **Backup & Export**, haz clic en **Download Backup**. El botón muestra **Creating backup...**.
4. Guarda el archivo cuando el navegador lo pida, o búscalo en tu carpeta de descargas.

El `.zip` contiene:

- tus datos de texto guardados (personajes, chats, lorebooks, presets, conexiones, ajustes);
- tus archivos subidos y generados, como avatares, sprites, fondos, imágenes de la galería, fuentes, emoji y stickers personalizados, y tu sonido de notificación personalizado;
- el archivo `.encryption-key`, cuando existe;
- una nota `RESTORE.txt` sobre cómo restaurar los archivos a mano (consulta [Restaurar a mano](#restore-by-hand)).

Para ver los nombres de las carpetas, consulta [Dónde guarda Marinara tus datos](where-data-is-stored.md).

> **Advertencia:** una copia de seguridad contiene tus API keys (claves de API) guardadas y el archivo `.encryption-key` que las desbloquea. No la compartas nunca. Guárdala en un lugar privado.

En Android no puedes acceder a la carpeta de datos de la app, así que **Download Backup** es la forma de sacar una copia del dispositivo.

Si no funcionó: si ves "Backup preparation timed out after one hour.", inténtalo de nuevo. Si otro dispositivo no puede descargar, revisa **Admin Access** (consulta arriba).

<a id="automatic-backups"></a>

## Copias de seguridad automáticas

Marinara puede hacer una copia de seguridad completa según un calendario, en la computadora que la ejecuta.

1. Abre **Settings → Advanced → Backup & Export**.
2. Activa **Automatic backups**.
3. Elige **Daily**, **Weekly** o **Monthly**.
4. Define **Automatic backups kept** con un valor de 1 a 9999.

Marinara hace la primera copia poco después de que la actives. Tras cada ejecución conserva las copias automáticas más recientes hasta tu número y borra las automáticas más antiguas. Nunca borra las copias de seguridad que hiciste con **Download Backup**.

Las copias de seguridad automáticas están en la carpeta `backups/` dentro de la carpeta de datos. La más reciente es `marinara-automatic-backup.zip`. Las más antiguas tienen una fecha y una hora en el nombre. Usan el mismo formato que **Download Backup**.

Cada ejecución necesita espacio libre para una copia completa más, porque la copia anterior se conserva hasta que termina la nueva. Si no hay espacio suficiente, Marinara omite la ejecución y muestra el motivo junto al ajuste. Lo intenta de nuevo cuando haya espacio libre.

> **Consejo:** guarda una segunda copia fuera de la carpeta de datos. Un disco perdido o una app borrada también eliminan las copias de seguridad automáticas.

<a id="export-a-profile"></a>

## Exportar un perfil

1. Abre **Settings → Advanced → Backup & Export**.
2. Haz clic en **Export Profile**. Se abre un cuadro de diálogo con el mismo título.
3. Elige un formato.
4. Tu navegador descarga el archivo.

- **Marinara Native** conserva tus personajes, personas, chats, lorebooks, presets, agentes, temas, el código de Personal Extension y los medios. No restaura las API keys, los enlaces de webhook ni algunos ajustes de chat (consulta [Vuelve a escribir tus claves](#enter-your-keys-again)). Puedes restaurarlo en Marinara.
- **Compatible JSON** crea un `.zip` de archivos simples de personaje, persona y lorebook para otras herramientas. No puedes restaurarlo en Marinara.

Un perfil nativo se descarga como `marinara-profile.json`. Si es demasiado grande, Marinara ofrece un archivo ZIP en su lugar. Haz clic en **Export ZIP** para descargar `marinara-profile.zip`.

Un perfil nativo conserva el código de Personal Extension, pero no si está activada ni aprobada. Cada extensión restaurada llega desactivada. Revísala de nuevo en **Settings → Addons**.

Un perfil nativo conserva los scripts de regex, sus carpetas y el ajuste de pausa de cada carpeta. Para compartir scripts individuales como JSON, consulta [Scripts de regex](../extending/regex-scripts.md#import-and-replace-scripts).

## Restaurar con Import Profile

**Import Profile** carga un archivo de perfil o un `.zip` de **Download Backup**.

1. Abre **Settings → Imports**.
2. En **Profile & Marinara**, haz clic en **Import Profile (JSON/ZIP)**.
3. Elige `marinara-profile.json`, `marinara-profile.zip` o un `.zip` de copia de seguridad. El botón muestra **Scanning Profile...**.
4. Lee el cuadro de diálogo **Import Profile**. Enumera lo que Marinara encontró. Los elementos que ya están en Marinara se reemplazan por las versiones del archivo, a menos que [solo agregues lo que falta](#only-add-whats-missing).
5. Haz clic en **Import** para continuar, o en **Cancel** para detenerla. El botón muestra **Importing Profile...**. Marinara primero guarda una copia de protección de tus datos y luego aparece una barra de progreso. Cuando termina, un mensaje indica que se importó el perfil.

Si no funcionó:

- A menos que abras Marinara en `localhost`, `127.0.0.1` o `[::1]`, la importación de perfiles necesita HTTPS. El error es "Profile import requires HTTPS outside local development." Abre Marinara mediante una dirección HTTPS.
- Si a un `.zip` le faltan algunos archivos de medios, la importación termina igualmente. Una advertencia enumera lo que falta y Marinara importa el resto.
- Si el disco está demasiado lleno para la copia de protección, no se importa nada. El error empieza por "Nothing was imported, because a safety copy could not be saved first." Libera más o menos el espacio que ocupa una copia de seguridad completa y vuelve a importar.

Si importas el mismo perfil dos veces, Marinara actualiza tus elementos y no los copia. Los perfiles de versiones mucho más antiguas pueden crear duplicados.

<a id="only-add-whats-missing"></a>

### Solo agregar lo que falta

Para recuperar algo que borraste sin perder los cambios que hiciste desde entonces, activa **Keep my current versions, only add what's missing** (Conservar mis versiones actuales y solo agregar lo que falta) encima de **Import Profile (JSON/ZIP)** y luego importa como se indica arriba. Cada elemento y archivo que ya está en Marinara se queda como está, y solo se agrega lo que Marinara no tiene. Eso incluye todo lo que borraste desde que se guardó el archivo, como mensajes sueltos o entradas de lorebook, no solo el elemento que querías recuperar. La memoria a largo plazo cuenta como un solo elemento: si Marinara ya tiene alguna, no se agrega la del archivo.

Nada se reemplaza, así que Marinara no guarda ninguna copia de protección, y **Undo Last Import** (Deshacer la última importación) sigue deshaciendo la importación anterior a esta.

Los perfiles de versiones mucho más antiguas no pueden hacer esto: siempre agregan sus elementos junto a los tuyos, y el cuadro de diálogo **Import Profile** lo indica.

### Deshacer una importación

Antes de cada importación que reemplaza elementos, Marinara guarda una copia completa de tus datos en la carpeta `backups/` de la carpeta de datos, como un archivo cuyo nombre empieza por `marinara-before-import-` seguido de la fecha y la hora. Cuando termina la importación, se borra la copia de la importación anterior, así que solo se conserva la más reciente.

1. Abre **Settings → Imports**.
2. En **Profile & Marinara**, haz clic en **Undo Last Import**. La línea de debajo muestra cuándo se guardó la copia de protección.
3. Haz clic en **Undo Last Import** en el cuadro de diálogo para confirmar.

Deshacer devuelve tus versiones de los elementos y archivos que reemplazó la última importación. Si cambiaste alguno de esos elementos después de la importación, ese cambio se pierde. Todo lo demás se queda como está, incluidos los elementos que agregó la importación. Puedes deshacer una importación una vez y luego se borra la copia de protección.

Deshacer no vuelve a activar lo que la importación desactivó por seguridad. Vuelve a activar esto a mano:

- tu tema activo;
- las Personal Extensions (revísalas de nuevo en **Settings → Addons**);
- las herramientas personalizadas que ejecutan un script o un webhook;
- las memorias de Professor Mari.

Si la importación dejó en blanco la API key de una conexión, vuelve a escribirla (consulta [Vuelve a escribir tus claves](#enter-your-keys-again)). Si era tu conexión predeterminada o de respaldo, vuelve a definirla como tal.

Las ramas de chat que reemplazó la importación quedan desvinculadas del chat del que se crearon. La importación ya quitó ese vínculo y Deshacer no puede recuperarlo.

Los perfiles de versiones mucho más antiguas solo agregan elementos, así que Marinara no guarda ninguna copia de protección para ellos y no hay nada que deshacer.

La copia de protección ocupa tanto espacio como una copia de seguridad completa. Para liberar ese espacio sin deshacer la importación, haz clic en **Delete Safety Copy** (Eliminar la copia de protección) en **Profile & Marinara** y luego confirma. Tus datos se quedan como están, pero ya no puedes deshacer esa importación. Si se interrumpió una importación, **Delete Safety Copy** puede aparecer por sí solo; en ese caso la copia no se puede usar para deshacer, pero aún puedes borrarla.

<a id="enter-your-keys-again"></a>

## Vuelve a escribir tus claves

**Import Profile** nunca recupera las API keys ni los enlaces de webhook, ni siquiera de un `.zip` de **Download Backup**. Una API key (clave de API) es el código secreto que te da un servicio. El archivo de perfil y el perfil dentro de una copia de seguridad tienen estos valores en blanco. Por eso, tras importar en una computadora nueva, debes escribirlos de nuevo:

1. Abre **Connections** (Conexiones) desde la barra superior.
2. Abre cada cuenta que uses, escribe su API key y guárdala. Consulta [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md).
3. Escribe el enlace de webhook en cada herramienta personalizada que lo use.

Algunos ajustes con direcciones o claves (Discord, DeepL, Intiface) también vuelven en blanco. Escríbelos de nuevo en los **Chat Settings** de cada chat.

Importar nunca borra las claves que ya tienes en la misma instalación.

## Mudarte a una computadora nueva

1. Instala Marinara en la computadora nueva y ábrela. Consulta [Instalación](../INSTALLATION.md).
2. Abre **Settings → Imports → Profile & Marinara** y haz clic en **Import Profile (JSON/ZIP)**.
3. Elige tu `.zip` de **Download Backup** o tu archivo de perfil, y luego haz clic en **Import**.
4. Vuelve a escribir tus API keys, como se describe arriba.

El archivo de clave de una copia de seguridad solo te sirve si copias a mano toda la carpeta de datos, como se explica a continuación.

<a id="restore-by-hand"></a>

## Restaurar a mano

Usa esto solo si no puedes usar **Import Profile**. El `.zip` tiene una carpeta dentro, por ejemplo `marinara-backup-...`, con una nota `RESTORE.txt`.

1. Detén Marinara.
2. Descomprime la copia de seguridad.
3. Copia las carpetas y el archivo `.encryption-key` de la carpeta descomprimida a tu carpeta de datos. Consulta [Dónde guarda Marinara tus datos](where-data-is-stored.md).
4. Inicia Marinara.

Mantén el archivo `.encryption-key` en la carpeta `storage`, o no se podrán leer las API keys guardadas.

La lista **Existing backups** de **Backup & Export** normalmente está vacía. No la necesitas.

## Guías relacionadas

- [Dónde guarda Marinara tus datos](where-data-is-stored.md)
- [Borrar o restablecer tus datos](clearing-data.md)
- [Actualizar Marinara Engine](../UPGRADING.md)
- [Conectarse a un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Acceso remoto: inicio de sesión y lista de IP permitidas](../REMOTE_ACCESS.md)
