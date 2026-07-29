# World Maps: Configuración, creación y viajes

> **Compatibilidad actual:** Esta guía corresponde a World Maps **1.2.0** en
> Marinara Engine **2.3.5**. El paquete admite Roleplay y chats de juegos.

World Maps agrega un estado mundial persistente a Roleplay y al juego. en lugar de
manteniendo una ubicación de texto libre, representa el mundo como lugares anidados:

```text
The Shattered Coast
└── Brinewatch
    ├── Harbor District
    │   ├── Tideglass Inn
    │   └── Quest Hall
    └── Old Sewers
```

Marinara mantiene una posición actual autorizada en esta jerarquía. la corriente
ruta de navegación, detalles de ubicación exacta, destinos cercanos y enlaces elegibles
la tradición puede fundamentar la siguiente respuesta. Los mapas también pueden seguir una narración completa.
viaje a un lugar conocido o agregue un lugar recién descubierto cuando la historia realmente
llega allí.

Cada chat recibe su propia copia de trabajo de un mapa. Las plantillas para toda la cuenta le permiten
Prepare un mundo original o fandom una vez y luego agregue una copia limpia a cualquier
Roleplay o chat de juego.

## Descripción general de funciones

World Maps 1.2.0 proporciona:

- regiones, asentamientos, lugares, edificios, pisos y habitaciones anidados;
- rutas de navegación y una ubicación autorizada de la historia actual;
- vistas de lista, mapa posicionado y capas ordenadas para ubicaciones secundarias;
- viajes entre padres e hijos, enlaces directos y planificación de rutas de múltiples vueltas;
- movimiento validado a partir de la narración completa y descubrimiento de nuevas ubicaciones;
- plantillas de mapas para toda la cuenta creadas manualmente, con IA o mediante importación;
- Borradores y expansiones de mapas asistidos por IA basados ​​en la configuración o la historia seleccionada;
- descripciones de ubicaciones públicas, memoria de modelos privada y conocimientos sobre ubicaciones exactas;
- una imagen de referencia Gallery opcional para cada ubicación;
- un fondo Gallery separado para cada mapa secundario colocado;
- Se revisó la generación de lotes para detectar obras de arte de ubicación faltantes;
- una anulación del mensaje de arte de Maps global y basado en variables;
- soporte de referencia de ubicación para ilustraciones Roleplay y Game Storyboards;
- importar, exportar, archivar, editar teniendo en cuenta el historial y vincular mapas del juego; y
- Bibliotecas de mensajes globales para la creación de mapas de IA y la inserción de ubicación en tiempo de ejecución.

Los destinos disponibles se incluyen en el contexto del modelo. Cuando las opciones CYOA son
habilitado, el modelo puede por lo tanto ofrecer a los niños actuales o lugares conectados como
las siguientes opciones. Las opciones exactas siguen siendo generadas por modelos.

## Inicio rápido

1. Abra **Agents**, haga clic en **Download Agents** e instale **World Maps**.
2. Reinicie Marinara cuando se le solicite. El paquete contiene código de servidor.
3. Abra un Roleplay o un chat de juego.
4. Abre **Agents → World Maps** y habilítalo para el chat actual. También
   puedes habilitarlo desde la sección **Chat Settings → Agents** de ese chat.
5. Cree el mapa con **Use template**, **Create with AI** o **Construir
   manualmente**. Los chats existentes también pueden importar un archivo de mapa.
6. Revise la jerarquía de trabajo, elija una ubicación inicial, habilite el mapa,
   y haga clic en **Save**.
7. Abra **Story map** mientras chatea. Seleccione un destino accesible y
   envíe el siguiente turno o describa el viaje de forma natural y deje que la respuesta se actualice
   la ubicación cuando se complete la llegada.
8. Opcionalmente, asigne ilustraciones Gallery a ubicaciones o use **Location artwork**
   para revisar y generar las imágenes faltantes.

La aplicación de una plantilla, un borrador AI o un archivo importado solo cambia la configuración del editor.
copia de trabajo. No afecta las respuestas hasta que la jerarquía esté habilitada y
salvado.

## Instalar y activar el paquete

Abre **Agents** desde la pestaña Sparkles en la barra lateral derecha. Haz clic
en **Download Agents**, selecciona **World Maps** y pulsa **Install**. Si el
catálogo ofrece **Update**, instálalo también. Sigue la indicación de reinicio
antes de usar el paquete.

La página World Maps informa la versión y preparación del paquete instalado,
ofrece la biblioteca de plantillas para toda la cuenta y muestra el mapa del chat actual
estado. La instalación del paquete lo hace disponible pero no lo habilita en
cada charla.

### Roleplay

1. Abra el chat Roleplay.
2. Abra **Chat Settings** con el botón de engranaje.
3. Encienda **Enable Agents**.
4. En **Tracker Agents**, habilite **World Maps**.
5. Abra **Edit world map** o la biblioteca **Map templates**.

La biblioteca de plantillas se comporta igual si se abre desde los Agentes principales
página o desde Roleplay Configuración de chat. Utilice **Add to chat** para copiar una plantilla en
el chat activo.

### Juego

Durante la configuración del juego, elija World Maps y luego seleccione una de sus configuraciones
rutas:

- **Create with AI** prepara una jerarquía generada para su revisión.
- **Use template** abre el selector de plantillas antes de crear el Juego.
- **Build manually** comienza con una jerarquía en blanco editable.

Después de elegir **Use template**, seleccione y confirme una plantilla específica. Configuración
crea una copia de trabajo propiedad del Juego para su revisión; nunca edita la cuenta
plantilla. Las ubicaciones de la plantilla seleccionada se convierten en el inicio jerárquico.
mundo. Un mapa de juego normal alternativo no se promociona en su lugar.

También puedes agregar World Maps a un juego existente más adelante desde **Chat
Configuración → Agentes**.

## Crear y reutilizar plantillas de mapas

Abra **Agents → World Maps → Open map templates**. Las plantillas pertenecen a
su cuenta en lugar de un chat, por lo que son adecuados para fandom reutilizables
mundos, escenarios de campaña, mazmorras, ciudades o mapas de inicio personales.

Desde la biblioteca puedes:

- crear una plantilla manualmente;
- utilice **Create with AI** para redactarlo;
- importar un archivo `.hierarchical-map.json`;
- buscar, ver, editar, exportar o eliminar una plantilla;
- utilizar **Add to chat** en un Roleplay abierto o en un chat de juego; o
- Elige **Use template** durante la configuración del juego.

Cada aplicación crea una copia de trabajo independiente. Ediciones posteriores al
La plantilla no cambia los chats que ya la copiaron, y las ediciones del chat no
cambiar la plantilla.

Las plantillas no copian la obra de arte Gallery del chat. Los ID de imagen pertenecen a la fuente
el chat es Gallery y no sería portátil. Agregar o generar los chats de trabajo.
referencias de ubicación y fondos de mapas después de aplicar la plantilla.

## Entender el editor de mapas

En el escritorio, el editor muestra tres paneles. En una pantalla estrecha, cambie entre
Pestañas **Hierarchy**, **Local** y **Details**.

- **Hierarchy** muestra el árbol completo. Al seleccionar una ubicación, se edita.
  **Enter** cambia la parte de la jerarquía que se está viendo; no mueve el
  historia.
- **Local** muestra los hijos inmediatos de la ubicación actual como una lista,
  mapa posicionado, o capas ordenadas.
- **Details** edita el texto de la ubicación, la jerarquía, la historia, el arte, los enlaces, el estado y
  Enlaces de mapas de juego.

El encabezado del editor contiene controles de construcción de IA, **Templates**, **Export**,
**Import**, el interruptor habilitado y **Save**. Los cambios no guardados están marcados
**Unsaved**. Salir con trabajo no guardado plantea si se debe descartar o no.

### Qué puede contener una ubicación

Cada ubicación puede tener:

- un padre y cualquier número de hijos;
- un tipo de Región, Asentamiento, Lugar, Edificio, Piso o Habitación;
- un nombre y un icono;
- una descripción pública y una memoria de modelo privada;
- un breve resumen de sensibilización;
- enlaces de libros de historia con la ubicación exacta;
- enlaces directos unidireccionales o bidireccionales con otros lugares;
- una presentación secundaria de Lista, Mapa o Capas;
- una imagen de referencia de ubicación y alternancia opcional de uso de imágenes;
- un fondo de mapa infantil independiente cuando se utiliza la presentación de mapas; y
- estado activo o archivado.

Para la presentación **Map**, arrastre los niños a su lugar o ingrese X e Y precisos
posiciones de 0 a 100. El padre seleccionado también puede tener una imagen Gallery
detrás de sus hijos. Para **Layers**, asigne a cada niño un orden de capas distinto.

Los enlaces directos pueden conectar cualquier lugar válido en la jerarquía: un ferry entre
ciudades, escaleras entre pisos seleccionados, un portal entre mundos o un secreto
paso entre habitaciones de diferentes edificios.

Una torre de 25 pisos normalmente debería modelar los pisos como hermanos debajo de una torre,
no como una cadena principal de 25 de profundidad. Los mapas permiten hasta 500 ubicaciones y 20 jerarquías.
niveles.

## Redactar o ampliar un mapa con IA

Desde un mapa vacío, haga clic en **Create with AI** o **Draft with AI**. Para un existente
mapa, haga clic en **Expand with AI**.

### Elige lo que lee el constructor

En **Build from**, elija una de estas fuentes:

- **Game setup** utiliza la configuración y los caracteres actuales. En el juego, esto incluye
  la visión general del mundo y los personajes de la fiesta.
- **Selected lore** utiliza libros de historia elegidos. **Strict canon** crea sólo
  lugares respaldados por la tradición. **Canon + expansion** permite realizar ampliaciones.

El constructor no lee el historial de turnos. Agregue todo lo que falte en la configuración o la historia
a **What should this world include?** o **What should be added?**

Elige una talla:

| Tamaño | Resultado aproximado |
| ---------- | ------------------ |
| **Small** | 8 plazas |
| **Medium** | 16 plazas |
| **Large** | 28 plazas |

La generación crea un borrador, no un mapa guardado. Buscar o ampliar el completo
obtener una vista previa, seleccionar ubicaciones y revisar sus rutas, descripciones, modelo privado
memoria y procedencia del saber. Utilice **Edit prompt**, **Regenerate** o **Descartar
borrador** antes de continuar.

Haga clic en **Continue to editor** para ver un nuevo mapa o en **Add to working map** para ver un
expansión. Después de que el historial de la campaña haga referencia a los ID de ubicación, Maps los protege
referencias al permitir la expansión en lugar de un reemplazo mayorista no relacionado.

## Construir o editar un mapa manualmente

Desde un mapa vacío, haga clic en **Build manually**. Maps crea un amplio punto de partida
ubicación. Selecciónelo en la jerarquía, luego use:

- **Add child** para un lugar dentro de la ubicación seleccionada;
- **Add sibling** para un lugar al lado bajo el mismo padre;
- **Duplicate** para copiar un subárbol de ubicación y luego editarlo; y
- **Archive** jubilar un lugar sin borrar referencias históricas.

Establece el lugar inicial de la historia con **Set as starting location**. Una jerarquía
necesita una ubicación de inicio activa antes de poder habilitarse. Enciende **Enabled**
y haga clic en **Save** después de resolver cualquier problema mostrado por el editor.

## Entender lo que llega al modelo

Cada generación con un mapa guardado habilitado recibe un mapa autorizado
bloque de contexto espacial que contiene:

- la ruta de navegación actual;
- el ID exacto de la ubicación actual y la descripción pública;
- la memoria privada del modelo de la ubicación actual exacta, cuando esté presente;
- destinos actualmente accesibles con un solo movimiento; y
- un índice acotado de ubicaciones conocidas activas y sus identificaciones exactas.

El índice de ubicación conocida permite que la respuesta reconozca una llegada a otro lugar del
el mundo salvado. Los destinos cercanos también pueden informar prosa ordinaria o CYOA
opciones.

Los nombres de los padres proporcionan orientación, pero las descripciones de los padres son privadas.
la memoria, el arte original y la tradición vinculada a los padres no se heredan. si el actual
La ubicación es `Tower → Floor 7 → Alchemy Lab`, los detalles del laboratorio están activos mientras
la torre y el piso aportan sólo sus nombres a la ruta de navegación.

**Private model memory** es una nota guardada solo para IA, no una memoria que se actualiza automáticamente. uso
buscar secretos, atmósfera, peligros persistentes, reglas locales o hechos que
debe estar activo sólo en ese lugar exacto. Poner información que debe llegar al
modelo en la descripción pública o en la memoria del modelo privado en lugar de depender de
el resumen de concientización solo.

## Mover durante una historia

Maps admite viajes explícitos, rutas planificadas y llegadas narradas validadas.
El movimiento se guarda con el turno para que la ubicación siga el mensaje seleccionado.
historial y deslizar.

### Poner en cola un destino explícito

Seleccionar un destino pone en cola un movimiento; no se mueve inmediatamente. el movimiento
se compromete con el siguiente mensaje que envíe, manteniendo la ubicación y entregando
sincronización.

Los destinos de un solo movimiento son:

- el padre de la ubicación actual;
- hijos activos de la ubicación actual; y
- ubicaciones conectadas por un enlace directo disponible.

Por turno sólo se puede realizar un paso jerárquico. Utilice la X en el
destino pendiente para cancelarlo. Si la revisión del mapa o la ubicación actual
cambios antes de enviar, el movimiento pendiente se convierte en **Needs review**.

### Planifique una ruta de varias vueltas

Seleccione una ubicación activa distante en el mapa mundial. Si el padre/hijo y
El gráfico de enlaces disponibles contiene una ruta, Maps muestra la ruta más corta y ofrece
**Plan route**.

Una ruta pone en cola su primer paso. Cada turno posterior confirma un paso y se pone en cola.
el siguiente hasta alcanzar el objetivo. Cancelar la ruta en cualquier momento. si el mapa
o la ubicación actual cambia inesperadamente, la ruta se convierte en **Needs review**
en lugar de adivinar un nuevo camino.

Por ejemplo, viajar desde el Piso 1 a su hermano Piso 25 normalmente toma un turno.
para salir hacia la torre y otro para entrar al Piso 25. Un enlace directo puede hacer
ese viaje un paso.

### Sigue viajes narrados y descubre nuevos lugares.

El modelo recibe instrucciones cautelosas para su llegada completa:

- Si la respuesta realmente llega a una ubicación activa conocida, Maps puede moverse
  la ubicación actual allí. Si la historia reveló una nueva ruta, Maps registra una
  Conexión directa disponible.
- Si la respuesta realmente llega a un lugar desconocido y duradero, Maps puede agregarla.
  como niño o ubicación conectada, muévase allí y conserve la ruta de regreso.
- Intenciones, menciones, viajes fallidos o inconclusos, campamentos temporales, pasillos,
  y los vehículos no crean una ubicación ni mueven el marcador.

Por ejemplo, después de que el usuario dice "Consigamos misiones del Salón de misiones", aparece
La respuesta que completa la llegada puede mover el siguiente estado de la historia a Quest.
Salón. "Deberíamos visitar el Quest Hall más tarde" debería abandonar la ubicación actual.
sin cambios.

Este comportamiento es validado por la aplicación, pero el modelo aún tiene que
identificar que se produjo la llegada. Utilice **Set destination** cuando necesite un
movimiento determinista.

### Roleplay viajes

El control **Story location** aparece encima del cuadro de mensaje.

1. Abra el mapa de la historia para inspeccionar la jerarquía y la ruta de navegación actual.
2. Seleccione una ubicación para leer su descripción.
3. Utilice **Explore inside**, **Browse up** o la ruta de navegación para navegar sin
   en movimiento.
4. Haga clic en **Set destination** para ver un lugar accesible o en **Plan route** para ver un
   objetivo distante alcanzable.
5. Envíe el siguiente mensaje para confirmar el paso en cola.

### Viajes de juego

Game Mode agrega un **Hierarchical world map**. **You are here** marca la corriente
ubicación de la historia. Navegar, centrar e inspeccionar no mueve al grupo.
Ponga en cola un destino o ruta y luego envíe el siguiente turno de juego.

La respuesta del Juego generada también puede actualizar la ubicación jerárquica después de un
Llegada narrada completa. Los detalles de la ubicación actual luego castigan al DJ, al grupo,
arte de escena y referencia de Storyboard elegible.

## Mapa mundial jerárquico versus el mapa normal del juego

El juego puede contener dos sistemas de mapas:

- **World Maps** es la historia autorizada o la ubicación mundial, como
  `The Shattered Coast → Brinewatch → Tideglass Inn`.
- Una cuadrícula de juego normal o un mapa de nodos es un detalle local o táctico dentro de esa historia.
  ubicación y también participa en el tiempo y el clima del juego.

Cuando World Maps posee el inicio del juego, su plantilla seleccionada o revisada
El draft suministra el mundo inicial. El mapa normal del juego no se reutiliza según se indica.
entrada o promovida como una jerarquía alternativa.

Para configuraciones avanzadas, una ubicación jerárquica se puede vincular a un mapa de juego completo, uno
celda de la cuadrícula o un nodo. Al seleccionar una posición de juego ligada se pone en marcha la correspondiente
movimiento jerárquico; Las posiciones libres mantienen un comportamiento táctico normal. guardar el
jerarquía antes de editar enlaces. Borrar un enlace tampoco elimina
mapa.

## Agregar identidad visual a las ubicaciones

Las referencias de ubicación y los fondos de los mapas secundarios son independientes incluso cuando
reutilice la misma imagen Gallery.

| Obra de arte | Propósito | ¿Enviado a generación de imágenes?                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Location reference image** | Ancla la identidad visual del lugar actual exacto. Elija entre Gallery o cree con IA.                          | Sí, cuando **Use for Roleplay illustrations and Game storyboards** está habilitado y la solicitud es elegible. |
| **Child map background** | Aparece detrás de ubicaciones secundarias móviles para un padre que usa la presentación de mapa. Cada capa del mapa puede tener su propio fondo. | No. Es sólo de visualización.                                                                                   |

Las referencias de carácter o persona preservan quién está presente; la referencia de ubicación
preserva donde ocurre la escena. Cuando el proveedor lo admite, combinar
Ayudan a mantener la coherencia tanto de los personajes como de los fondos en todas las imágenes.

La canalización de imágenes agrega esta instrucción cuando se encuentra una referencia de ubicación elegible.
adjunto:

> Manejo de ubicación: está disponible una imagen de referencia de ubicación adjunta. Úselo
> to set the scene location.

Los proveedores tienen sus propios límites de imágenes de referencia. Referencias de solicitudes explícitas
y las referencias de personajes pueden reducir la cantidad de referencias automáticas que caben.

### Establecer una referencia de ubicación

Seleccione una ubicación en el editor y abra **Location reference image**.

- **Choose from Gallery** asigna una imagen revisada existente.
- **Create with AI** abre un mensaje de imagen de establecimiento editable y guarda el
  resultado a Gallery antes de decidir si usarlo.
- **Use for Roleplay illustrations and Game storyboards** controla si el
  la imagen seleccionada participa en la generación elegible.

Para un padre que usa la presentación del mapa, abra **Child map background** por separado.
Elija una imagen Gallery y luego colóquela detrás de los marcadores secundarios. Esta imagen es
nunca se envía a un proveedor simplemente porque se muestra en el mapa.

### Generar ilustraciones de ubicaciones faltantes en un lote

La sección **Location artwork** del editor encuentra ubicaciones a las que les faltan referencias o
fondos de mapas infantiles.

1. Haga clic en **Review requests**.
2. Revise el recuento de solicitudes antes de gastar las solicitudes del proveedor.
3. Confirme la conexión de la imagen, el modelo, el estilo del motor, el estado del estilo artístico de la campaña,
   instrucciones de la imagen guardada y tamaño de salida.
4. Edite todos los mensajes positivos y negativos si es necesario.
5. Cancele la revisión o haga clic en **Generate N images** para confirmar.
6. Revise la obra de arte generada en el mapa de trabajo y haga clic en **Save**.

Cada imagen distintiva que falta es una solicitud de proveedor independiente. Los mundos grandes pueden ser
lento o costoso, por lo que la revisión se puede desplazar y mantiene el recuento de solicitudes
visible. Las obras de arte existentes se reutilizan sin otra solicitud cuando sea posible. un
La nueva imagen se convierte en la referencia de ubicación y también en el fondo del mapa infantil cuando
ese mapa necesita uno.

Las indicaciones positivas y negativas editadas exactas que se muestran en la revisión se envían al
proveedor. El material de mensaje positivo no se copia en el mensaje negativo.

## Personaliza el mensaje de arte automático

Abra **Settings → Generations → Prompt Overrides** y seleccione **Ubicación de mapas
obra de arte**. Esta es la plantilla global que se utiliza cuando Maps obtiene una vista previa y genera
obra de arte de ubicación automática. Las variables utilizan la sintaxis `${variableName}` y se pueden
insertado desde el editor.

| Variables | Significado |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `${locationName}` | Nombre de la ubicación |
| `${locationDescription}` | Descripción pública de la ubicación exacta |
| `${locationType}` | Región, Asentamiento, Lugar, Edificio, Piso o Habitación |
| `${locationPrompt}` | Aviso de establecimiento de respaldo completo preparado por Maps |
| `${parentLocationName}` | Nombre principal directo o vacío en la raíz |
| `${parentLocationDescription}` | Descripción pública directa de los padres o vacía |
| `${locationPath}` | Ruta de navegación completa de raíz a ubicación |
| `${genre}` / `${genreLine}` | Género de juego crudo o puntuado; Juego exterior vacío |
| `${campaignArtStyle}` / `${campaignArtStyleLine}` | Estilo de campaña solo cuando **Use campaign art style** está activo |
| `${imageInstructions}` / `${imageInstructionsLine}` | Instrucciones de imagen sin formato o formateadas guardadas en Configuración de chat |

La plantilla incorporada utiliza el mensaje de ubicación exacta más un género opcional,
estilo de campaña e instrucciones de imágenes guardadas. Intencionalmente no incluye
la descripción principal o la ruta completa de forma predeterminada, lo que evita forzar a un padre
punto de referencia, como una torre, en cada niño o imagen del piso.

Personalizaciones comunes:

- Elimine `${genreLine}` si el género del juego no debería aparecer en el mapa automático.
  obra de arte.
- Mantenga `${campaignArtStyleLine}` solo si el **Use campaign art style** por chat
  alternar debería controlar ese material. Cuando el interruptor está desactivado, la variable es
  vacío.
- Agregue `${parentLocationName}`, `${parentLocationDescription}` o
  `${locationPath}` solo cuando el proveedor necesita ese contexto más amplio.
- Utilice **Reset to default** para restaurar la plantilla incorporada.

El perfil de estilo del motor y la configuración global de imagen positiva y negativa son
aplicado después de esta plantilla. Siguen siendo parte de la imagen/ilustrador compartido.
flujo de trabajo en lugar de configuraciones específicas de Maps. Si queda texto inesperado en el
mensaje negativo, inspeccione la configuración global de imagen negativa y la opción editable.
campo de revisión.

## Vincular la historia a las ubicaciones

World Maps usa la tradición de dos maneras:

1. El creador de IA puede leer libros de historia seleccionados mientras los redacta o los expande.
2. Una ubicación guardada puede activar entradas mientras esa ubicación exacta esté actual.

Para adjuntar información sobre el tiempo de ejecución, seleccione la ubicación, abra **Linked lore**, busque el
entradas disponibles, adjunte las entradas deseadas y guárdelas.

Las entradas vinculadas no pasan de padre a hijo. Historia adjunta a Brinewatch
no se activa en Tideglass Inn a menos que esté conectado allí también.

La historia de la ubicación actual no necesita una concordancia de palabras clave, pero no evita
controles del libro de historia. Los libros y entradas deshabilitados o excluidos del chat permanecen
no está disponible y las condiciones de entrada, el momento, la probabilidad y los presupuestos de tokens aún
aplicar. Las referencias faltantes permanecen visibles en el editor para que puedan repararse
o desprendido.

## Configuración de mensajes de mapas avanzados

La página principal **Agents → World Maps** posee dos sistemas de avisos globales:

- **Generation prompt** es una biblioteca de juegos/Marikeep0001MARI llamada para borradores de mapas de IA y
  expansiones. Cada chat puede seleccionar una opción de forma independiente. El resuelto
  La vista previa utiliza la configuración en vivo, los personajes, la historia y el contexto del mapa sin hacer un
  solicitud de modelo.
- **Turn prompt insert** controla el texto global Roleplay/sistema de juego que
  presenta la ubicación actual durante los turnos ordinarios. Marinara mantiene el
  contenedor `<spatial_context>` propiedad de la aplicación y autoridad requerida
  variables a su alrededor.

El **Connection Override** en la misma página afecta los borradores de mapas de IA y
expansiones. Déjelo vacío para usar la conexión de chat actual. Estas configuraciones no
no reemplaza la anulación **Maps location artwork** separada en global
Configuración de generación.

Estos controles están destinados a una personalización avanzada. Conservar requerido
variables y utilizar las vistas previas resueltas antes de guardar.

## Importar, exportar y archivar de forma segura

Utilice **Export** para descargar la jerarquía de trabajo como un archivo `.world-map.json`.
Deje **Include map artwork** habilitado para agrupar imágenes de ubicaciones referenciadas y
fondos de mapas secundarios en el mismo archivo. Desactívala cuando quieras un tamaño más pequeño,
copia de seguridad de sólo definición. Los archivos `.hierarchical-map.json` más antiguos siguen siendo importables.

Utilice **Import** para cargar una jerarquía en la copia de trabajo. Las ilustraciones incluidas son
se restaura al Gallery del chat de destino y sus enlaces de imágenes se reasignan.
Revise el resultado y haga clic en **Save** para que tenga autoridad. La importación no
guardar inmediatamente.

Una vez que el historial de la campaña hace referencia a un mapa, los cambios importados deben conservar los existentes.
ID de ubicación. Agregue o actualice ubicaciones en lugar de reemplazar la jerarquía con
identificaciones no relacionadas.

El archivo conserva las referencias antiguas. Antes de archivar una ubicación:

- mover o archivar sus hijos activos;
- elija otra ubicación de inicio activa si es necesario; y
- elija un reemplazo activo si es la ubicación de ejecución actual.

Las ubicaciones archivadas se pueden restaurar desde el panel Detalles.

## Solución de problemas

### World Maps no está en la configuración del chat

Confirme que el paquete esté instalado y que Marinara se haya reiniciado. el activo
el chat debe ser Roleplay o Juego. Encienda **Enable Agents**, luego habilite
**World Maps** bajo **Tracker Agents**.

### Falta Agregar al chat en la biblioteca de plantillas

Abra un Roleplay o un chat de juego compatible antes de abrir la biblioteca. la biblioteca
muestra **Add to chat** desde la página principal World Maps o desde ese chat
ajustes. Durante la configuración del juego, la acción equivalente es **Use template**.

### La configuración del juego utilizó ubicaciones incorrectas o alternativas

Elija **Use template**, seleccione una plantilla concreta en el selector y confirme
antes de completar la configuración del juego. Revisa la copia de trabajo propiedad del juego y guárdala.
eso. La plantilla de cuenta permanece sin cambios.

### El mapa no se puede habilitar

Cree al menos una ubicación activa y establezca una ubicación de inicio activa. resolver
cada número que se muestra en la parte superior del editor, luego habilítelo y guárdelo nuevamente.

### La generación de mapas AI no está disponible

Asegúrese de que el chat o Maps **Connection Override** tenga un modelo de idioma de trabajo
conexión. Guarde o descarte los cambios existentes en el editor antes de volver a abrir la IA
constructor. Para una expansión, elige un objetivo activo. Para la historia
generación, seleccione al menos un libro de historia habilitado y no excluido.

### La ubicación actual no siguió un mensaje

El movimiento automático requiere que la respuesta generada complete una llegada y
producir una directiva de mapas oculta válida. Intención, discusión, viaje fallido y
Los lugares transitorios no mueven el marcador. Utilice **Set destination** para una
movimiento determinista del siguiente turno.

### Un destino o ruta dice Necesita revisión

La revisión del mapa o la ubicación actual cambiaron después de que el movimiento se pusiera en cola. Abre el
Story Map, revise la ruta actual y seleccione el destino o la ruta nuevamente.

### No se puede seleccionar una ubicación distante

Utilice **Plan route** si existe una ruta principal/secundaria/enlace activa. De lo contrario agregue un
enlace directo disponible o viajar a través de lugares accesibles un giro a la vez.
Los controles de navegación nunca mueven la historia.

### El mensaje de arte automático siempre incluye el género del juego.

Abra **Settings → Generations → Prompt Overrides → Maps location artwork** y
elimine `${genreLine}` de la plantilla. Guarde la anulación y luego vuelva a abrir el
revisión de obras de arte.

### El estilo de campaña aparece cuando debería estar desactivado

Marque **Chat Settings → Illustrator → Use campaign art style**. Con esa palanca
desactivado, `${campaignArtStyle}` y `${campaignArtStyleLine}` resuelven vaciar. el
El resumen de la revisión debe informar que el estilo artístico de la campaña es **Off**.

### Aparece un punto de referencia principal en cada imagen secundaria

Evite `${parentLocationDescription}` y `${locationPath}` en la obra de arte global
plantilla a menos que sean necesarios. El mensaje de ubicación predeterminado tiene como alcance
la ubicación exacta y omite esos campos amplios.

### El mensaje de imagen negativa contiene material inesperado

Revise y edite el campo negativo antes de confirmar. Luego inspecciona el compartido
configuración global de imagen negativa. La plantilla de arte de Maps construye lo positivo
rápido; no se copia en el campo negativo.

### No se utiliza una referencia de ubicación en imágenes o Storyboards

Confirme que la imagen Gallery todavía existe y **Úsela para Roleplay
Las ilustraciones y los guiones gráficos del juego** están habilitados en la ubicación actual exacta.
El fondo del mapa secundario es de solo visualización y no puede sustituir a una referencia.
a menos que también se asigne la misma imagen Gallery como referencia de ubicación.

### El modelo ignora el mapa.

Confirme que World Maps esté activo para el chat, la jerarquía es
**Enabled**, se guardaron los últimos cambios y aparece una ubicación actual en
el control de ubicación de la historia. Utilice la vista previa resuelta **Turn prompt insert** para
Diagnóstico avanzado.

### La historia vinculada no se activa

Confirme que la entrada esté adjunta a la ubicación actual exacta. comprueba eso
la entrada y el libro de historia están habilitados y el libro de historia no está excluido del
charlar.

## Guías relacionadas

- [Agentes: ayudantes de IA para sus chats](agents-overview.md)
- [Referencia de Agentes Descargables](built-in-agents.md)
- [Libros de historia](../lorebooks/overview.md)
- [Modo Roleplay: Introducción](../roleplay/getting-started.md)
- [Game Mode: Primeros pasos](../game/getting-started.md)
- [Game Mode: mapa, hora y clima](../game/map-time-weather.md)
