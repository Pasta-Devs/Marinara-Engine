# Copia de seguridad y restauración de Marinara

Esta guía te muestra las dos formas de guardar una copia de todo lo que hay en Marinara Engine, y cómo volver a colocar esa copia más tarde. Úsala antes de actualizar, cambiar de dispositivo o restablecer tus datos.

## Dos formas de guardar tus datos

Marinara te ofrece dos opciones para guardar. Están en lugares distintos y hacen tareas distintas.

- **Download Backup** (Descargar copia de seguridad) crea un archivo comprimido **.zip** completo con todo lo que hay en el disco. Un **.zip** es un único archivo comprimido que contiene muchos archivos dentro. Esta es la copia más completa, y la mejor protección contra la pérdida de datos.
- **Export Profile** (Exportar perfil) crea un archivo más ligero con los datos de tu cuenta (personajes, personas, chats, lorebooks, presets, agentes, temas y Personal Extensions). Un perfil es la copia portátil que Marinara hace de tu cuenta. Puedes restaurarlo más tarde dentro de Marinara.

Si solo quieres una copia segura de todo, usa **Download Backup**. Usa **Export Profile** cuando quieras un archivo más pequeño o una versión que otras herramientas de roleplay puedan leer.

Ambas opciones para guardar están en **Settings** (Configuración), en la pestaña **Advanced**, dentro de la sección **Backup & Export**.

## Acceso desde el mismo dispositivo o desde otro

En la computadora que ejecuta Marinara, estas herramientas funcionan de inmediato. Este es el caso de loopback, es decir, abriste la app en `localhost` o `127.0.0.1` en la misma máquina.

Desde un teléfono, una tableta o cualquier otro dispositivo, la copia de seguridad y la restauración necesitan el secreto de **Admin Access** (Acceso de administrador). Configura el secreto en el servidor y luego pega el mismo valor en **Settings**, en la pestaña **Advanced**, bajo **Admin Access**. Consulta la guía de acceso remoto enlazada al final.

## Download Backup

**Download Backup** crea un solo archivo **.zip** con tu base de datos, tus ajustes y todas tus carpetas de medios (avatares, sprites, fondos, imágenes de la galería, fuentes, tu sonido de notificación personalizado y más).

1. Abre **Settings**.
2. Ve a la pestaña **Advanced**.
3. Busca la sección **Backup & Export**.
4. Haz clic en **Download Backup**.
5. El botón muestra **Creating backup…** mientras trabaja.
6. Cuando el archivo comprimido está listo, Marinara lo transmite directamente al navegador sin conservar el archivo completo en la memoria de la página.
7. Según los ajustes de descarga, el navegador abre su ventana **Save As** habitual o guarda el archivo en la carpeta de descargas.

Este paso importa sobre todo en Android e iOS. En esos dispositivos, la propia carpeta de datos de la app normalmente no es accesible. Eso hace que **Download Backup** sea la única forma fácil de sacar una copia del dispositivo. Guárdala en un lugar seguro y privado, como tu propio almacenamiento en la nube.

El **.zip** también contiene un archivo de texto plano llamado `RESTORE.txt`. Explica cómo recuperar tus datos a mano si alguna vez lo necesitas. Trata la copia de seguridad como algo privado: puede contener archivos secretos que se usan para desbloquear tus API keys guardadas. Para saber qué contiene cada carpeta, consulta la guía de ubicación de datos enlazada más abajo.

## Copias de seguridad automáticas

La sección **Backup & Export** también puede crear una copia de seguridad automática completa que va rotando en el dispositivo que ejecuta Marinara.
Activa **Automatic Backups** (Copias de seguridad automáticas), elige **Daily**, **Weekly** o **Monthly** y configura
**Automatic backups kept** con un valor de 1 a 9999. Marinara crea la primera copia poco después de que la actives. Después de
cada ejecución exitosa, conserva el número configurado de archivos automáticos más recientes y elimina el archivo automático
sobrante más antiguo. Este límite de retención nunca elimina copias de seguridad manuales ni las guardadas con **Download Backup**.

Las copias de seguridad automáticas se guardan dentro de `backups/`, en la carpeta de datos de Marinara. El archivo más reciente
se llama `marinara-automatic-backup.zip`; los archivos automáticos anteriores que se conservan usan nombres con marca de tiempo.
Usan el mismo formato de archivo restaurable y transmitido que **Download Backup**, incluidos los medios subidos y el archivo de
la clave de cifrado cuando existe uno. Mantén una copia aparte, fuera de la carpeta de datos de Marinara, si necesitas protección
frente a un disco perdido, un almacenamiento de la app borrado o un restablecimiento del dispositivo.

## Export Profile

**Export Profile** crea un archivo más pequeño con los datos de tu cuenta. Los medios se incluyen, así que los avatares, las imágenes y tu sonido de notificación personalizado también vienen con él.

1. Abre **Settings**.
2. Ve a la pestaña **Advanced**.
3. Busca la sección **Backup & Export**.
4. Haz clic en **Export Profile**.
5. Se abre una ventana titulada **Export Profile** con dos opciones.
6. Elige un formato (se explica más abajo).
7. El archivo se descarga en tu dispositivo.

La ventana ofrece dos formatos:

| Formato | Qué es | ¿Restaurable en Marinara? |
| --- | --- | --- |
| **Marinara Native** | Conserva los campos de Marinara, las carpetas de lorebook, los datos de personaje y persona, los presets, los agentes, los temas, los borradores de Personal Extension y los medios incrustados. | Sí |
| **Compatible JSON** | Archivos simples de personaje, persona y lorebook para otras herramientas de roleplay. | No |

Elige **Marinara Native** para conservar una copia que puedas restaurar en Marinara más tarde. Los perfiles más pequeños se descargan como
`marinara-profile.json`; los perfiles más grandes se ofrecen como un `marinara-profile.zip` transmitido cuyos datos se dividen en
archivos de tabla acotados, para que una biblioteca grande no tenga que caber en una sola cadena JSON en memoria.

El código de una Personal Extension se conserva en un perfil nativo, pero su estado de activación y su aprobación de ejecución no. Cada extensión restaurada llega desactivada y debe revisarse de nuevo en **Settings** > **Addons**.

Elige **Compatible JSON** solo cuando quieras mover personajes o lorebooks a otra herramienta. Descarga un **.zip** de archivos simples. No puedes volver a restaurar este archivo en Marinara con **Import Profile**.

## Restaurar con Import Profile

Para volver a colocar un perfil guardado o un archivo de **Download Backup**, usa **Import Profile** (Importar perfil). Está en una pestaña distinta de las herramientas para guardar.

1. Abre **Settings**.
2. Ve a la pestaña **Imports**.
3. Busca la sección **Profile & Marinara**.
4. Haz clic en **Import Profile (JSON/ZIP)**.
5. Elige tu archivo. Puede ser un `marinara-profile.json`, un `marinara-profile.zip` o un **.zip** completo de **Download Backup**.
6. Marinara analiza el archivo primero. El botón muestra **Scanning Profile...**.
7. Aparece una ventana titulada **Import Profile**. Enumera lo que encontró, por ejemplo el número de personajes y personas.
8. La ventana advierte que la importación no se puede deshacer. Léela y luego haz clic en **Import** para continuar, o en **Cancel** para detenerte.
9. La importación se ejecuta y muestra **Importing Profile...** con una barra de progreso.

Un perfil de Marinara reciente se restaura haciendo coincidir la identidad propia de cada elemento, no su nombre. Así que, si importas el mismo perfil dos veces, actualiza tus elementos existentes en su sitio en lugar de crear duplicados.

Los archivos de perfil muy antiguos (de versiones mucho más viejas) no tienen este comportamiento. Volver a importar uno de esos puede crear personajes, personas y lorebooks duplicados. Si solo restauras exportaciones recientes, no te encontrarás con esto.

Si eliges el archivo y luego lo cambias en el disco antes de confirmar, la importación se detiene con una advertencia. Solo vuelve a elegir el archivo.

Si a un **.zip** le faltan algunos archivos de medios, la importación termina de todos modos. Muestra una advertencia de color ámbar que enumera los archivos que faltan e importa todo lo demás.

## Después de restaurar: vuelve a introducir tus claves

**Export Profile** quita los valores secretos del archivo de perfil. Tus API keys guardadas y tus enlaces de webhook quedan en blanco dentro de él. Eso hace que el archivo de perfil sea seguro para guardar y compartir. Una API key (clave de API) es la contraseña que conecta Marinara con un proveedor de IA.

Un archivo de **Download Backup** es distinto. Marinara no quita los secretos de él. El **.zip** de la copia de seguridad es una copia en bruto de tus datos. Contiene tus claves guardadas y el archivo secreto que puede desbloquearlas. Nunca compartas un **.zip** de copia de seguridad. Guárdalo en un lugar privado.

**Import Profile** restaura a partir del archivo de perfil, incluso cuando eliges un **.zip** de copia de seguridad. El archivo contiene una copia del perfil dentro, y la importación lee esa copia. Por eso los elementos creados por la importación llegan con las claves y los enlaces de webhook en blanco.

Después de importar un perfil, haz esto:

1. Abre **Settings**.
2. Ve a la pestaña **Connections**.
3. Vuelve a introducir la API key de cada proveedor que uses.

Si usas herramientas personalizadas que llaman a un enlace de webhook, vuelve a introducir ese enlace también en cada herramienta.

Importar no borra las claves que ya tengas configuradas. Si vuelves a importar un perfil antiguo, Marinara conserva las claves y los enlaces de webhook activos en los elementos que aún existen. Una reimportación no los deja en blanco.

## La lista Existing backups

La sección **Backup & Export** puede mostrar una lista **Existing backups** (Copias de seguridad existentes) con un botón de eliminar. En el uso normal esta lista queda vacía. **Download Backup** guarda el archivo directamente en tu dispositivo. No deja una copia en esta lista, y el control **Automatic Backups** gestiona en su lugar el número configurado de archivos automáticos conservados. No necesitas esta lista para crear ni conservar una copia de seguridad descargada.

## Guías relacionadas

- [Dónde guarda Marinara tus datos](where-data-is-stored.md)
- [Borrar o restablecer tus datos](clearing-data.md)
- [Actualizar Marinara Engine](../UPGRADING.md)
- [Conectar con un proveedor de IA](../connections/connecting-to-a-provider.md)
- [Acceso remoto: autenticación básica y lista de IP permitidas](../REMOTE_ACCESS.md)
