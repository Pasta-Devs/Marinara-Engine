# World Maps: configuración, creación y viajes

> **Compatibilidad actual:** esta guía corresponde a World Maps **1.3.1**. El paquete admite Marinara Engine **2.3.5 a 3.x** y funciona en chats de Roleplay y Game. Marinara Engine **2.4.1** añade la limpieza coordinada del flujo de movimiento y la actualización inmediata de Lorebooks tras las importaciones portátiles. Engine **2.3.5 a 2.4.0** sigue siendo compatible, pero requiere actualizar Lorebooks manualmente después de importar y no incluye esa limpieza del flujo.

World Maps agrega un estado del mundo persistente a Roleplay y Game. En lugar de guardar una sola ubicación de texto libre, representa el mundo como lugares anidados:

```text
The Shattered Coast
└── Brinewatch
    ├── Harbor District
    │   ├── Tideglass Inn
    │   └── Quest Hall
    └── Old Sewers
```

Marinara mantiene una ubicación actual con autoridad dentro de esta jerarquía. La ruta de navegación actual, los detalles de la ubicación exacta, los destinos cercanos y el trasfondo vinculado que cumpla los requisitos pueden anclar la siguiente respuesta. Maps también puede seguir el movimiento o el descubrimiento que el último mensaje del usuario deje establecido de forma explícita. La narración visible de la IA puede describir el resultado, pero no puede mover el mapa ni inventar ubicaciones por su cuenta.

Los mapas pueden ser independientes en cada chat o estar vinculados a un único mundo compartido que pertenece a tu cuenta. Las plantillas crean copias limpias que luego pueden divergir. Un mundo compartido, en cambio, mantiene una sola jerarquía canónica y un solo conjunto de ilustraciones, mientras que cada chat vinculado conserva su propia ubicación actual, su historial de viajes, sus instantáneas y sus vínculos de Game.

## Descripción general de funciones

World Maps 1.3.1 ofrece:

- regiones, asentamientos, lugares, edificios, pisos y habitaciones anidados;
- rutas de navegación y una ubicación actual de la historia con autoridad;
- vistas de lista, mapa posicionado y capas ordenadas para las ubicaciones hijas;
- viajes entre padre e hijo, enlaces directos y planificación de rutas de varios turnos;
- movimiento y descubrimiento validados que establece el último mensaje del usuario;
- mundos compartidos de tu cuenta que se pueden vincular entre chats de Roleplay y de Game;
- borradores por chat revisables, con controles para publicar, descartar, resolver conflictos y separar;
- plantillas de mapa para toda la cuenta creadas a mano, con IA o por importación;
- borradores y ampliaciones de mapa asistidos por IA, basados en la configuración o en el trasfondo que elijas;
- descripciones públicas de las ubicaciones, memoria privada del modelo y trasfondo de la ubicación exacta;
- una imagen de referencia opcional del chat o de la Global Gallery para cada ubicación;
- un fondo aparte del chat o de la Global Gallery para cada mapa de hijos posicionado;
- generación por lotes revisable para las ilustraciones de ubicación que falten;
- una anulación global del prompt (las instrucciones enviadas a la IA) de ilustraciones de Maps, basada en variables;
- soporte de referencia de ubicación para las ilustraciones de Roleplay y los Storyboards (secuencias de viñetas) de Game;
- importación, exportación, archivado, edición que respeta el historial y vínculos con el mapa de Game; y
- bibliotecas globales de prompts para la construcción de mapas con IA y para el inserto de ubicación en tiempo de ejecución.

Los destinos disponibles se incluyen en el contexto del modelo. Por eso, cuando las opciones CYOA (elige tu propia aventura) están activadas, el modelo puede ofrecer los hijos actuales o los lugares conectados como siguientes opciones. Las opciones exactas las sigue generando el modelo.

## Elige la relación de mapa adecuada

La biblioteca contiene dos recursos reutilizables que pertenecen a tu cuenta, mientras que cada chat conserva su propia ubicación y su propio historial en tiempo de ejecución. El nombre visible de un recurso no es su identidad: World Maps 1.3.1 agrega **(copy)** o un número cuando un recurso recién guardado tendría el mismo nombre que otro.

| Recurso o estado | Pertenece a | Elígelo cuando | Qué afectan las ediciones posteriores |
| --- | --- | --- | --- |
| **Mapa de chat independiente** | Un chat de Roleplay o de Game | Esta historia debe tener su propio mundo | Solo a ese chat |
| **Plantilla independiente** | Tu cuenta | Quieres un punto de partida reutilizable | Solo a las copias nuevas; los chats existentes no se actualizan |
| **Mundo compartido canónico** | Tu cuenta | Varios chats deben usar una única jerarquía mantenida | A la definición compartida que usan los chats vinculados |
| **Borrador de chat vinculado** | Un chat vinculado, hasta que publiques | Una historia vinculada descubrió o editó algo que quizá deba estar en el mundo compartido | A ningún otro chat hasta que elijas **Publish** |
| **Copia independiente separada** | Un chat que antes estaba vinculado | Esta historia debe conservar su mapa actual pero dejar de recibir ediciones del mundo compartido | Solo al chat separado |

Copiar no es vincular. **Use template**, **Add to chat** e **Independent copy** crean mapas separados. **Use shared world** durante la configuración de Game y **Link to chat** en la biblioteca conectan el chat al mundo compartido canónico.

## Inicio rápido

1. Abre **Agents** (Agentes), haz clic en **Download Agents** e instala **World Maps**.
2. Reinicia Marinara cuando se te pida. El paquete contiene código de servidor.
3. Abre un chat de Roleplay o de Game.
4. Abre el globo terráqueo dedicado de **World Maps** si tu Engine lo ofrece, o usa **Agents → World Maps**, y actívalo para el chat actual. También puedes activarlo desde la sección **Chat Settings → Agents** (Ajustes del chat → Agentes) de ese chat.
5. Crea el mapa con **Use template**, **Create with AI** o **Build manually**. Los chats existentes también pueden importar un archivo de mapa.
6. Revisa la jerarquía de trabajo, elige una ubicación inicial, activa el mapa y haz clic en **Save**.
7. Abre el **Story map** mientras chateas. Selecciona un destino alcanzable y envía el siguiente turno, o establece directamente el movimiento del grupo en tu mensaje para que Maps pueda validar y aplicar la llegada.
8. Si quieres, asigna ilustraciones de la Gallery a las ubicaciones o usa **Location artwork** para revisar y generar las imágenes que falten.

Aplicar una plantilla, un borrador de IA o un archivo importado solo cambia la copia de trabajo del editor. No afecta a las respuestas hasta que la jerarquía se active y se guarde.

## Instalar y activar el paquete

Abre **Agents** desde la pestaña Sparkles de la barra lateral derecha. Haz clic en **Download Agents**, selecciona **World Maps** y haz clic en **Install**. Si a continuación el catálogo ofrece **Update**, instálalo también. Sigue el aviso de reinicio antes de usar el paquete.

La página de World Maps informa de la versión del paquete instalado y de si está listo, ofrece la biblioteca de mapas de mundo de toda la cuenta, nombra el chat de destino actual y muestra el estado del mapa de ese chat. Instalar el paquete lo deja disponible, pero no lo activa en todos los chats.

### Roleplay

1. Abre el chat de Roleplay.
2. Abre **Chat Settings** con el botón del engranaje.
3. Activa **Enable Agents**.
4. En **Tracker Agents**, activa **World Maps**.
5. Abre **Edit world map** o la **World map library**. En las versiones compatibles de Engine, el globo terráqueo de la barra superior en computadora abre esa misma biblioteca; en el teléfono, usa el globo terráqueo del panel lateral Chats.

La biblioteca se comporta igual tanto si la abres desde la página principal de **Agents** como desde **Chat Settings** en Roleplay. Usa **Add to chat** para una copia independiente de la plantilla, o **Link to chat** para un mundo compartido duradero.

### Game

Durante la configuración de Game, elige World Maps y luego selecciona una de sus rutas de configuración:

- **Create with AI** prepara una jerarquía generada para que la revises.
- **Use template** abre la biblioteca de mundos antes de que se cree la partida de Game.
- **Build manually** empieza con una jerarquía en blanco editable.

Después de elegir **Use template**, el selector muestra primero **Shared worlds** y después **Independent templates**:

- **Use shared world** vincula la nueva partida de Game a ese mundo canónico de tu cuenta. La partida sigue conservando su propia ubicación actual, su historial, sus instantáneas, sus vínculos y sus descubrimientos sin publicar.
- **Use template** crea una copia de trabajo propia de la partida para que la revises. Nunca edita la plantilla de la cuenta.

Las ubicaciones del recurso que elijas se convierten en el mundo jerárquico inicial. No se promociona en su lugar ningún mapa de Game normal de reserva.

También puedes agregar World Maps a una partida de Game existente más adelante, desde **Chat Settings → Agents**.

## Crear y reutilizar plantillas de mapa

Abre **World Maps → Open world library**. Las plantillas pertenecen a tu cuenta y no a un solo chat, así que sirven para mundos de fandom reutilizables, ambientaciones de campaña, mazmorras, ciudades o mapas de inicio personales.

Desde la biblioteca puedes:

- crear una plantilla a mano;
- usar **Create with AI** para redactarla;
- importar un archivo `.hierarchical-map.json`;
- buscar, ver, editar, exportar o eliminar una plantilla;
- usar **Add to chat** con un chat de Roleplay o de Game abierto; o
- elegir **Use template** durante la configuración de Game.

Cada aplicación crea una copia de trabajo independiente. Las ediciones posteriores de la plantilla no cambian los chats que ya la copiaron, y las ediciones del chat no cambian la plantilla.

Las plantillas conservan las referencias a ilustraciones de la Global Gallery de toda la cuenta. Cuando usas **Save as template** desde un chat, Maps promociona a la Global Gallery las ilustraciones del chat referenciadas y reutiliza una imagen compartida idéntica cuando ya existe. Cada chat que aplique la plantilla apunta entonces a esa misma ilustración compartida, sin crear otra copia en la Gallery.

Solo se comparten las ilustraciones. Cada definición de mapa aplicada sigue siendo una copia de trabajo independiente: editar la plantilla no actualiza los mapas que ya se agregaron a los chats.

## Vincular varios chats a un mismo mundo compartido

Usa **Shared worlds** en la World map library cuando varios chats de Roleplay o de Game deban leer la misma jerarquía canónica. Crea un mundo compartido en blanco, importa uno, promociona una plantilla existente con **Make shared**, o abre un mapa de chat guardado y elige **Make shared**. Esta última opción promociona a la Global Gallery sus ilustraciones de chat referenciadas, crea el mundo que pertenece a tu cuenta y vuelve a vincular con él el chat original.

Elige **Link to chat** para conectar el chat que indica el estado de chat de destino de la biblioteca. La ubicación actual y todos los ID de ubicación que ya use el historial de la campaña deben existir en el mundo compartido. Si no, usa **Independent copy** o migra primero el mapa actual del chat a un mundo compartido nuevo.

Los chats vinculados comparten solo la definición del mapa y las ilustraciones de la Global Gallery. No comparten mensajes, ubicaciones actuales, instantáneas de viaje, estado del juego, vínculos con el mapa de Game, conexiones de proveedor ni credenciales.

Las ediciones y los descubrimientos hechos dentro de un chat vinculado se guardan como un borrador sin publicar de ese chat. No cambian el mundo canónico ni los demás chats hasta que elijas **Publish**. También puedes usar **Discard** para descartar el borrador, o **Detach and keep copy** para dejar de compartir y conservar la versión actual del chat. Si el mundo canónico cambia mientras hay un borrador pendiente, Maps informa de un conflicto y exige separar o descartar, en lugar de sobrescribir en silencio cualquiera de las dos versiones.

Editar un mundo compartido desde la biblioteca actualiza la definición canónica directamente. El editor de mundos compartidos no ofrece la eliminación permanente de ubicaciones: archívalas para que sus ID estables sigan disponibles. Un chat vinculado tampoco puede eliminar ninguna ubicación de forma permanente hasta que elijas **Detach and keep copy**. Y un mundo compartido no se puede eliminar hasta que todos los chats vinculados se separen o se vuelvan a vincular a otro.

Los mundos compartidos y las plantillas conservan las referencias a ilustraciones de la Global Gallery sin copiar el archivo de imagen a cada chat. Marinara bloquea la eliminación de una imagen de la Global Gallery mientras una plantilla guardada, un mundo compartido, un mapa de chat independiente o el borrador de un chat vinculado sigan haciendo referencia a ella. Quita primero esos enlaces con la ilustración cuando quieras eliminar el recurso en sí.

## Separar, reemplazar o empezar de cero

Estas acciones responden a preguntas distintas:

- Para dejar de compartir pero conservar la jerarquía actual del chat vinculado, guarda o descarta los cambios pendientes del editor y luego elige **Detach and keep copy**. El chat pasa a ser independiente y deja de recibir actualizaciones canónicas.
- Para seguir compartiendo pero usar otro mundo canónico, abre la biblioteca de mundos con el chat de destino indicado y elige **Link to chat** en el mundo de reemplazo. Las comprobaciones de compatibilidad con el historial se siguen aplicando.
- Para reemplazar el mapa de un chat independiente, abre su editor y elige **Replace / start over**. Puedes guardar una plantilla o exportar una copia de seguridad antes, y luego elegir **Create with AI**, **Use template or shared world**, **Import map file** o **Start blank**.
- Para darle a un chat un mapa sin relación con el anterior, usa ese mismo flujo de reemplazo. Quitar el agente y volver a agregarlo no reinicia el mapa.

El reemplazo sigue siendo una copia de trabajo hasta que pulses **Save**. Guardar un reemplazo borra cualquier destino o ruta en cola. Una vez que el historial de mensajes hace referencia a ID de ubicación, Maps puede rechazar un reemplazo sin relación para conservar las rutas de navegación históricas; en ese caso, quédate con una copia independiente y amplía o archiva el mapa existente.

## Entender el editor de mapas

En computadora, el editor muestra tres paneles. En una pantalla estrecha, cambia entre las pestañas **Hierarchy**, **Local** y **Details**.

- **Hierarchy** muestra el árbol completo. Al seleccionar una ubicación, la editas. **Enter** cambia la parte de la jerarquía que estás viendo; no mueve la historia.
- **Local** muestra los hijos inmediatos de la ubicación actual como lista, mapa posicionado o capas ordenadas.
- **Details** edita el texto de la ubicación, la jerarquía, el trasfondo, las ilustraciones, los enlaces, el estado y los vínculos con el mapa de Game.

El encabezado del editor contiene los controles de construcción con IA, **Templates**, **Export**, **Import**, el interruptor Enabled y **Save**. Los cambios sin guardar se marcan como **Unsaved**. Si sales con trabajo sin guardar, se te pregunta si quieres descartarlo.

### Qué puede contener una ubicación

Cada ubicación puede tener:

- un padre y cualquier número de hijos;
- un tipo Region, Settlement, Place, Building, Floor o Room (región, asentamiento, lugar, edificio, piso o habitación);
- un nombre y un icono;
- una descripción pública y una memoria privada del modelo;
- un breve resumen orientativo;
- enlaces a lorebooks (libros de trasfondo) de la ubicación exacta;
- enlaces directos de un solo sentido o de doble sentido con otras ubicaciones;
- una presentación de hijos List, Map o Layers;
- una imagen de referencia de ubicación y un interruptor opcional de uso de la imagen;
- un fondo aparte para el mapa de hijos cuando se usa la presentación Map; y
- estado activo o archivado.

Para la presentación **Map**, arrastra los hijos a su sitio o escribe posiciones X e Y precisas de 0 a 100. El padre seleccionado también puede tener una imagen de la Gallery detrás de sus hijos. Para **Layers**, dale a cada hijo un orden de capa distinto.

Los enlaces directos pueden conectar cualquier par de lugares válidos de la jerarquía: un ferri entre pueblos, unas escaleras entre pisos concretos, un portal entre mundos o un pasadizo secreto entre habitaciones de edificios distintos.

Una torre de 25 pisos normalmente debería modelar los pisos como hermanos bajo una misma torre, y no como una cadena de padres de 25 niveles. Maps admite hasta 500 ubicaciones y 20 niveles de jerarquía.

## Redactar o ampliar un mapa con IA

Desde un mapa vacío, haz clic en **Create with AI** o en **Draft with AI**. Si el mapa ya existe, haz clic en **Expand with AI**.

### Elige qué lee el constructor

En **Build from**, elige una de estas fuentes:

- **Game setup** usa la configuración y los personajes actuales. En Game, esto incluye la visión general del mundo y los personajes del grupo.
- **Selected lore** usa los lorebooks que elijas. **Strict canon** crea solo lugares respaldados por el trasfondo. **Canon + expansion** permite añadidos que encajen.

El constructor no lee el historial de turnos. Agrega todo lo que falte en la configuración o en el trasfondo a **What should this world include?** o a **What should be added?**

Elige un tamaño:

| Tamaño | Resultado aproximado |
| --- | --- |
| **Small** | 8 lugares |
| **Medium** | 16 lugares |
| **Large** | 28 lugares |

La generación crea un borrador, no un mapa guardado. Busca o despliega la vista previa completa, selecciona ubicaciones y revisa sus rutas, sus descripciones, su memoria privada del modelo y la procedencia de su trasfondo. Usa **Edit prompt**, **Regenerate** o **Discard draft** antes de continuar.

Haz clic en **Continue to editor** para un mapa nuevo, o en **Add to working map** para una ampliación. Cuando el historial de la campaña ya hace referencia a ID de ubicación, Maps protege esas referencias permitiendo la ampliación en lugar de un reemplazo total sin relación.

## Construir o editar un mapa a mano

Desde un mapa vacío, haz clic en **Build manually**. Maps crea una única ubicación inicial amplia. Selecciónala en la jerarquía y luego usa:

- **Add child** para un lugar dentro de la ubicación seleccionada;
- **Add sibling** para un lugar al lado, bajo el mismo padre;
- **Duplicate** para copiar el subárbol de una ubicación y luego editarlo; y
- **Archive** para retirar un lugar sin borrar las referencias históricas.

Marca el lugar inicial de la historia con **Set as starting location**. Una jerarquía necesita una ubicación inicial activa antes de poder activarse. Enciende **Enabled** y haz clic en **Save** después de resolver los problemas que muestre el editor.

## Entender qué llega al modelo

Cada generación con un mapa guardado y activo recibe un único bloque de contexto espacial con autoridad que contiene:

- la ruta de navegación actual;
- el ID exacto de la ubicación actual y su descripción pública;
- la memoria privada del modelo de esa ubicación exacta, si la hay;
- los destinos que ahora mismo se pueden alcanzar en un solo movimiento; y
- un índice acotado de las ubicaciones conocidas activas y sus ID exactos.

El índice de ubicaciones conocidas permite que la respuesta reconozca una llegada a otro punto del mundo guardado. Los destinos cercanos también pueden alimentar la prosa normal o las opciones CYOA.

Los nombres de los padres dan orientación, pero las descripciones del padre, su memoria privada, sus ilustraciones y el trasfondo vinculado a él no se heredan. Si la ubicación actual es `Tower → Floor 7 → Alchemy Lab`, los detalles del laboratorio están activos mientras que la torre y el piso solo aportan su nombre a la ruta de navegación.

**Private model memory** es una nota guardada solo para la IA, no una memoria que se actualice sola. Úsala para secretos, ambiente, peligros persistentes, reglas locales o datos que solo deban estar activos en ese lugar exacto. Pon la información que tenga que llegar al modelo en la descripción pública o en la memoria privada del modelo, en lugar de confiar solo en el resumen orientativo.

## Moverse durante una historia

Maps admite viajes en cola, rutas planificadas y llegadas validadas dirigidas por el usuario. El movimiento se guarda con el turno, así que la ubicación sigue al historial de mensajes y al swipe (respuesta alternativa) que tengas seleccionados. Reiniciar Marinara no restablece a propósito la ubicación actual; cambiar de rama de mensajes o de swipe restaura la instantánea espacial guardada con ese historial seleccionado.

### Poner un destino explícito en cola

Seleccionar un destino pone un movimiento en cola; no te mueve de inmediato. El movimiento se confirma con el siguiente mensaje que envíes, lo que mantiene sincronizados la ubicación y el turno.

Los destinos de un solo movimiento son:

- el padre de la ubicación actual;
- los hijos activos de la ubicación actual; y
- las ubicaciones conectadas por un enlace directo disponible.

Con un turno solo se puede confirmar un paso de la jerarquía. Usa la X del destino pendiente para cancelarlo. Si la revisión del mapa o la ubicación actual cambian antes de enviar, el movimiento pendiente pasa a **Needs review** (necesita revisión).

### Planificar una ruta de varios turnos

Selecciona una ubicación activa lejana en el mapa del mundo. Si el grafo de padres, hijos y enlaces disponibles contiene un camino, Maps muestra la ruta más corta y ofrece **Plan route**.

Una ruta pone en cola su primer paso. Cada turno de usuario que envías después confirma un paso y pone en cola el siguiente, hasta llegar al objetivo; no hay un botón de avance aparte. Puedes cancelar la ruta en cualquier momento. Si el mapa o la ubicación actual cambian de forma inesperada, la ruta pasa a **Needs review** en lugar de adivinar un camino nuevo.

Por ejemplo, ir del Piso 1 a su hermano el Piso 25 normalmente lleva un turno para salir a la torre y otro para entrar en el Piso 25. Un enlace directo puede convertir ese viaje en un solo paso.

### Seguir los viajes que dirige el usuario y descubrir lugares nuevos

El último mensaje del usuario es la autoridad para los cambios automáticos del mapa:

- El movimiento directo del grupo protagonista, en presente o en imperativo, establece la llegada. “Vamos a la Cocina” y “Ella entra en la zona exterior; la seguimos” pueden mover a ubicaciones conocidas que coincidan.
- La llegada explícita a un lugar significativo, con nombre, duradero y al que se pueda volver —o su descubrimiento— puede agregarlo al mundo. “Descubrimos una habitación oculta” puede crear esa ubicación y entrar en ella.
- La respuesta visible puede narrar la consecuencia, pero la narración de la IA por sí sola nunca autoriza un movimiento ni una ubicación nueva.
- Las intenciones futuras, los viajes fallidos o sin terminar, las simples menciones, el movimiento de un NPC (personaje no jugador) solo, los lugares imaginados, los campamentos temporales, los pasillos, los vehículos y otros detalles pasajeros no crean ni mueven ubicaciones.

El modelo todavía tiene que interpretar cómo se expresa el usuario y emitir una directiva oculta de Maps, que la aplicación valida. Los distintos modelos de lenguaje pueden variar ante una prosa ambigua. Usa **Set destination** para un movimiento determinista en el siguiente turno, o **Set current story location** para corregir un estado ya guardado.

Una llegada validada dirigida por el usuario puede saltarse la regla del alcance en un solo paso: Maps registra un enlace directo disponible desde la ubicación actual cuando hace falta. Si ya había un destino en cola, ese movimiento en cola se guarda primero con el mensaje del usuario y después la llegada dirigida por el usuario pasa a ser la ubicación final en la respuesta del asistente; la cola de un solo uso se limpia. En una ruta planificada, llegar al siguiente paso previsto avanza con normalidad. Llegar a otro sitio, incluido un salto a un paso posterior de la ruta, deja la ruta en **Needs review** para que Maps no reescriba el plan en silencio. Cancela esa ruta o vuelve a planificarla desde la ubicación actual resultante.

### Ubicación inicial frente a ubicación actual de la historia

La **ubicación inicial** es la predeterminada cuando empieza una historia nueva. La **ubicación actual de la historia** es donde está ahora este chat en concreto. Cambiar la ubicación inicial no arregla la posición actual de un chat que ya existe.

Para corregir el estado guardado, selecciona una ubicación activa en el panel **Details** del editor y elige **Set current story location**. Es una corrección administrativa, no un viaje narrado. Surte efecto cuando haces clic en **Save**, borra el destino o la ruta en cola y no reescribe los mensajes anteriores.

### Viajes en Roleplay

El control **Story location** aparece encima del cuadro de mensaje.

1. Abre el mapa de la historia para ver la jerarquía y la ruta de navegación actual.
2. Selecciona una ubicación para leer su descripción.
3. Usa **Explore inside**, **Browse up** o la ruta de navegación para explorar sin moverte.
4. Haz clic en **Set destination** para un lugar alcanzable, o en **Plan route** para un objetivo lejano al que se pueda llegar.
5. Envía el siguiente mensaje para confirmar el paso en cola.

### Viajes en Game

Game Mode agrega un **Hierarchical world map**. **You are here** marca la ubicación actual de la historia. Explorar, centrar el mapa e inspeccionar no mueven al grupo. Pon en cola un destino o una ruta y luego envía el siguiente turno de Game.

Cuando el último mensaje del usuario establece la llegada del grupo, la respuesta generada de Game puede emitir el comando oculto que actualiza la ubicación jerárquica. Los detalles de la ubicación actual anclan entonces al GM (director del juego), al grupo, al arte de la escena y a la referencia de Storyboard que corresponda.

## El mapa de mundo jerárquico frente al mapa de Game normal

Una partida de Game puede contener dos sistemas de mapas:

- **World Maps** es la ubicación de la historia o del mundo con autoridad, como `The Shattered Coast → Brinewatch → Tideglass Inn`.
- Un mapa de cuadrícula o de nodos normal de Game es el detalle local o táctico dentro de esa ubicación de la historia, y además participa en el tiempo y el clima de Game.

Cuando World Maps se encarga del arranque de Game, la plantilla que elijas o el borrador que revises aportan el mundo inicial. El mapa de Game normal no se reutiliza como entrada del prompt ni se promociona como jerarquía de reserva.

En configuraciones avanzadas, una ubicación jerárquica puede vincularse a un mapa de Game entero, a una celda de la cuadrícula o a un nodo. Seleccionar una posición de Game vinculada prepara el movimiento jerárquico correspondiente; las posiciones sin vincular mantienen su comportamiento táctico normal. Guarda la jerarquía antes de editar los vínculos. Borrar un vínculo no elimina ninguno de los dos mapas.

## Dar identidad visual a las ubicaciones

Las referencias de ubicación y los fondos de los mapas de hijos son independientes, incluso cuando reutilizan la misma imagen de la Gallery.

| Ilustración | Para qué sirve | ¿Se envía a la generación de imágenes? |
| --- | --- | --- |
| **Location reference image** | Ancla la identidad visual del lugar actual exacto. Elige arte del chat o de la Global Gallery compartida, o créalo con IA. | Sí, cuando **Use for Roleplay illustrations and Game storyboards** está activado y la solicitud cumple los requisitos. |
| **Child map background** | Aparece detrás de las ubicaciones hijas movibles de un padre que usa la presentación Map. Cada capa del mapa puede tener su propio fondo. | No. Es solo visual. |

Las referencias de personaje o de persona conservan quién está presente; la referencia de ubicación conserva dónde ocurre la escena. Cuando el proveedor lo admite, combinarlas ayuda a mantener coherentes tanto los personajes como los fondos entre imágenes.

La canalización de imágenes agrega esta instrucción cuando hay adjunta una referencia de ubicación que cumple los requisitos:

> Manejo de la ubicación: hay disponible una imagen de referencia de ubicación adjunta. Úsala para fijar la ubicación de la escena.

Cada proveedor tiene sus propios límites de imágenes de referencia. Las referencias que pidas de forma explícita y las referencias de personaje pueden reducir cuántas referencias automáticas caben.

### Poner una referencia de ubicación

Selecciona una ubicación en el editor y abre **Location reference image**.

- **Choose artwork** asigna una imagen revisada del chat actual o de la Global Gallery compartida. El selector indica el origen de cada una.
- **Create with AI** abre un prompt editable de imagen de ambientación y guarda el resultado en la Gallery antes de que decidas si lo usas.
- **Use for Roleplay illustrations and Game storyboards** controla si la imagen seleccionada participa en las generaciones que cumplen los requisitos.

Para un padre que usa la presentación Map, abre **Child map background** por separado. Elige una imagen de la Gallery y luego colócala detrás de los marcadores de los hijos. Esta imagen nunca se envía a un proveedor solo porque se muestre en el mapa.

### Generar por lotes las ilustraciones de ubicación que faltan

La sección **Location artwork** del editor encuentra las ubicaciones a las que les faltan referencias o fondos de mapa de hijos.

1. Haz clic en **Review requests**.
2. Revisa cuántas solicitudes son antes de gastar solicitudes del proveedor.
3. Confirma la conexión de imagen, el modelo, el estilo del Engine, el estado del estilo artístico de la campaña, las instrucciones de imagen guardadas y el tamaño de salida.
4. Edita cada prompt positivo y negativo si hace falta.
5. Cancela la revisión, o haz clic en **Generate N images** para confirmar.
6. Revisa las ilustraciones generadas en el mapa de trabajo y haz clic en **Save**.

Cada imagen distinta que falte es una solicitud aparte al proveedor. Los mundos grandes pueden ser lentos o caros, así que la revisión se puede desplazar y mantiene visible el número de solicitudes. Las ilustraciones existentes se reutilizan sin otra solicitud siempre que se puede. Una imagen nueva pasa a ser la referencia de ubicación y también el fondo del mapa de hijos cuando ese mapa necesita uno.

Al proveedor se envían exactamente los prompts positivo y negativo editados que ves en la revisión. El material del prompt positivo no se copia al prompt negativo.

## Personalizar el prompt automático de ilustraciones

Abre **Settings → Generations → Prompt Overrides** (Configuración → Generaciones → Anulaciones de prompt) y selecciona **Maps location artwork**. Esta es la plantilla global que usa Maps para previsualizar y generar las ilustraciones automáticas de ubicación. Las variables usan la sintaxis `${variableName}` y se pueden insertar desde el editor.

| Variable | Significado |
| --- | --- |
| `${locationName}` | Nombre de la ubicación |
| `${locationDescription}` | Descripción pública de la ubicación exacta |
| `${locationType}` | Region, Settlement, Place, Building, Floor o Room |
| `${locationPrompt}` | Prompt de ambientación de reserva completo que prepara Maps |
| `${parentLocationName}` | Nombre del padre directo, o vacío en la raíz |
| `${parentLocationDescription}` | Descripción pública del padre directo, o vacío |
| `${locationPath}` | Ruta de navegación completa desde la raíz hasta la ubicación |
| `${genre}` / `${genreLine}` | Género de Game sin formato o con puntuación; vacío fuera de Game |
| `${campaignArtStyle}` / `${campaignArtStyleLine}` | Estilo de campaña, solo cuando **Use campaign art style** está activado |
| `${imageInstructions}` / `${imageInstructionsLine}` | Instrucciones de imagen guardadas en **Chat Settings**, sin formato o con formato |

La plantilla integrada usa el prompt de la ubicación exacta más el género, el estilo de campaña y las instrucciones de imagen guardadas, si los hay. A propósito no incluye la descripción del padre ni la ruta completa de forma predeterminada, lo que evita meter a la fuerza un punto de referencia del padre —como una torre— en la imagen de cada hijo o de cada piso.

Personalizaciones habituales:

- Quita `${genreLine}` si el género de Game no debe aparecer en las ilustraciones automáticas del mapa.
- Conserva `${campaignArtStyleLine}` solo si el interruptor por chat **Use campaign art style** debe controlar ese material. Cuando el interruptor está apagado, la variable queda vacía.
- Agrega `${parentLocationName}`, `${parentLocationDescription}` o `${locationPath}` solo cuando el proveedor necesite ese contexto más amplio.
- Usa **Reset to default** para restaurar la plantilla integrada.

El perfil de estilo del Engine y los ajustes globales de imagen positiva y negativa se aplican después de esta plantilla. Siguen formando parte del flujo compartido de Illustrator y de imágenes, y no son ajustes propios de Maps. Si queda texto inesperado en el prompt negativo, revisa el ajuste global de imagen negativa y el campo editable de la revisión.

## Vincular trasfondo a las ubicaciones

World Maps usa el trasfondo de dos maneras:

1. El constructor de IA puede leer los lorebooks que elijas mientras redacta o amplía.
2. Una ubicación guardada puede activar entradas mientras esa ubicación exacta sea la actual.

Para adjuntar trasfondo en tiempo de ejecución, selecciona la ubicación, abre **Linked lore**, busca entre las entradas disponibles, adjunta las que quieras y guarda.

Abrir una entrada de lorebook vinculada te saca del editor de mapas. Guarda primero el mapa si quieres conservar otras ediciones pendientes, o confirma a propósito que se pueden descartar. World Maps 1.3.1 avisa antes de que esa acción descarte cambios del mapa sin guardar.

Las entradas vinculadas no pasan de padre a hijo. El trasfondo adjunto a Brinewatch no se activa en el Tideglass Inn a menos que también esté adjunto allí.

El trasfondo de la ubicación actual no necesita coincidencia de palabras clave, pero tampoco se salta los controles del lorebook. Los libros y las entradas desactivados o excluidos del chat siguen sin estar disponibles, y las condiciones de las entradas, su momento, su probabilidad y los presupuestos de tokens (fragmentos de texto) se siguen aplicando. Las referencias que falten quedan visibles en el editor para que puedas repararlas o desvincularlas.

## Ajustes avanzados de prompt de Maps

La página principal **Agents → World Maps** contiene dos sistemas globales de prompts:

- **Generation prompt** es una biblioteca con nombre para Roleplay y Game, pensada para los borradores y las ampliaciones de mapa con IA. Cada chat puede elegir una opción por su cuenta. La vista previa resuelta usa la configuración, los personajes, el trasfondo y el contexto de mapa reales, sin hacer ninguna solicitud al modelo.
- **Turn prompt insert** controla el texto global de sistema de Roleplay y Game que presenta la ubicación actual durante los turnos normales. Marinara mantiene a su alrededor el contenedor `<spatial_context>` que pertenece a la aplicación y las variables de autoridad obligatorias.

El **Connection Override** de esa misma página afecta a los borradores y las ampliaciones de mapa con IA. Déjalo vacío para usar la conexión del chat actual. Estos ajustes no reemplazan la anulación **Maps location artwork**, que está aparte, en los ajustes globales de generación.

Estos controles están pensados para personalización avanzada. Conserva las variables obligatorias y usa las vistas previas resueltas antes de guardar.

## Importar, exportar y archivar sin riesgos

### Exportar un mapa portátil

Usa **Export** desde un chat, una plantilla o el editor de un mundo compartido para descargar la jerarquía como `.world-map.json`. Antes elige cuánto trasfondo vinculado debe viajar:

| Opción de trasfondo | Contenido del archivo |
| --- | --- |
| **Map only** | La jerarquía y la procedencia legible entre ubicaciones y trasfondo, pero sin contenido de lorebooks. No puede recrear entradas ausentes. |
| **Map + linked entries** | Solo las entradas vinculadas por el mapa y las rutas de carpetas necesarias. Es la opción portátil recomendada. |
| **Map + complete lorebooks** | Todas las entradas y carpetas de cada lorebook vinculado, incluido material ajeno al mapa. |

Antes de compartir, revisa los lorebooks, el número de entradas, el tamaño estimado y el mapa desplegable entre ubicaciones y trasfondo. Los lorebooks completos pueden contener notas privadas o no relacionadas. Deja **Include map artwork** activado para incluir las imágenes y los fondos de mapas hijos; desactívalo para una copia más pequeña. Los archivos `.hierarchical-map.json` antiguos siguen siendo importables.

### Importar un mapa y restaurar trasfondo portátil

Usa **Import** para cargar una jerarquía en una copia de chat, plantilla independiente o mundo compartido. Si el archivo contiene lorebooks, **Restore portable map lore** muestra cuatro grupos: **Exact IDs**, **Unique content**, **Need a choice** y **New entries**.

Un id exacto solo es definitivo si pertenece al lorebook de destino. Un id de otra fuente es ambiguo: elige la fila exacta `Lorebook → Entry (ID)` o **Import a new copy**. Sin id, World Maps solo reutiliza una entrada cuando su contenido portátil completo y sus ajustes tienen una única coincidencia; el nombre nunca basta.

Después de revisar el resultado previsto, elige una estrategia:

- **Import separate copies** no reutiliza entradas y crea lorebooks independientes como `Original Lorebook - Map Name (World Map)`, añadiendo **(copy)** o **(copy N)** para evitar colisiones.
- **Reuse matches & import the rest** conserva coincidencias exactas y únicas, aplica tus elecciones ambiguas y crea lorebooks solo para lo que aún falta.

Maps enumera después los lorebooks reutilizados y creados. Las copias creadas permanecen en la biblioteca aunque se elimine el mapa. Engine **2.4.1** o posterior actualiza Lorebooks al instante; con **2.3.5 a 2.4.0**, recarga Marinara una vez después de restaurar el trasfondo.

Las ilustraciones también se restauran y reasignan. Las del chat vuelven a la Gallery de destino; las compartidas se reutilizan desde Global Gallery o se agregan una vez. Revisa el resultado y pulsa **Save** para hacerlo definitivo. Importar no guarda de inmediato. Una exportación **Map only** conserva la procedencia y los vínculos de id exactos existentes, pero no puede recrear lorebooks ni entradas borrados sin su contenido.

Una vez que el historial de la campaña hace referencia a un mapa, los cambios importados deben conservar los ID de ubicación existentes. Agrega o actualiza ubicaciones en lugar de reemplazar la jerarquía con ID sin relación.

### Archivar o eliminar ubicaciones permanentemente

Archivar conserva las referencias antiguas. Antes de archivar una ubicación:

- mueve o archiva sus hijos activos;
- elige otra ubicación inicial activa si hace falta; y
- elige un reemplazo activo si es la ubicación actual en tiempo de ejecución.

Las ubicaciones archivadas se pueden restaurar desde el panel **Details**. World Maps 1.3.1 también ofrece **Delete permanently** para una ubicación archivada o para una rama archivada por completo cuando se puede quitar sin riesgo. El editor desactiva esa acción cuando la ubicación es la ubicación inicial guardada o la ubicación actual de la historia, aparece en el historial de mensajes, tiene un vínculo con el mapa de Game, participa en un destino o una ruta en cola, o pertenece a un chat que sigue vinculado a un mundo compartido. Los editores de mundos compartidos y de plantillas no ofrecen la eliminación permanente de ubicaciones. Resuelve primero la dependencia que se indica, separa el chat vinculado si corresponde, o deja la ubicación archivada.

La eliminación permanente quita la ubicación del borrador de trabajo y limpia sus referencias de jerarquía y de enlaces directos cuando haces clic en **Save**. Cerrar sin guardar sigue descartando la eliminación. Las ubicaciones eliminadas ya no aparecen en las exportaciones; las ubicaciones archivadas que siguen protegidas se siguen exportando para que sus ID estables puedan dar soporte al historial y a los datos vinculados. No edites el JSON exportado para saltarte estas protecciones.

## Solución de problemas

### World Maps no aparece en Chat Settings

Comprueba que el paquete esté instalado y que Marinara se haya reiniciado. El chat activo debe ser de Roleplay o de Game. Activa **Enable Agents** y luego activa **World Maps** en **Tracker Agents**.

### Add to chat o Link to chat no aparecen en la biblioteca de mundos

Abre un chat compatible de Roleplay o de Game antes de abrir la biblioteca. La biblioteca nombra el chat de destino y muestra **Add to chat** para las plantillas o **Link to chat** para los mundos compartidos. Durante la configuración de Game, las acciones equivalentes son **Use template** y **Use shared world**.

Si la biblioteca lista mundos compartidos durante la configuración de Game pero no muestra **Use shared world**, puede que el navegador siga ejecutando un cliente del paquete anterior a la actualización. En cualquier editor de mapas abierto, guarda el mapa o descarta su borrador a propósito, y luego cierra el editor. Guarda el trabajo que no tenga relación, recarga Marinara una vez de forma forzada y vuelve a abrir la configuración de Game. Las versiones más recientes de Engine avisan explícitamente cuando una actualización de paquete necesita esa recarga.

### La configuración de Game usó ubicaciones equivocadas o de reserva

Elige **Use template** y luego confirma **Use template** para una copia independiente o **Use shared world** para un vínculo canónico, antes de terminar la configuración de Game. Revisa y guarda el mapa de Game. La plantilla no cambia; una partida de Game vinculada mantiene los cambios sin publicar hasta que elijas **Publish**.

### Un chat vinculado todavía muestra una versión anterior del mundo compartido

Los editores limpios de chats vinculados almacenados en la pestaña donde publicas se actualizan automáticamente. Un chat con cambios sin guardar o publicar conserva su borrador y muestra un conflicto. Vuelve a abrir los chats de otras pestañas o ventanas para obtener la nueva revisión canónica.

### El mapa no se puede activar

Crea al menos una ubicación activa y marca una ubicación inicial activa. Resuelve todos los problemas que se muestran en la parte de arriba del editor, y luego vuelve a activar y guardar.

### La generación de mapas con IA no está disponible

Comprueba que el chat o el **Connection Override** de Maps tengan una conexión de modelo de lenguaje que funcione. Guarda o descarta los cambios del editor antes de volver a abrir el constructor de IA. Para una ampliación, elige un objetivo activo. Para una generación basada en trasfondo, selecciona al menos un lorebook activado y no excluido.

### La generación de mapas con IA informa JSON incompleto o mal formado

Si la respuesta terminó antes de completar el JSON, aumenta **Max Output Tokens** en la conexión o elige un mapa más pequeño y vuelve a generar. World Maps no gasta otra solicitud intentando reparar una respuesta incompleta.

Si el JSON está mal formado, ya se intentó una reparación exclusiva de sintaxis. Vuelve a generar; si el modelo falla repetidamente, usa otra conexión o modelo. Cambiar **Max Output Tokens** está pensado para el caso incompleto.

### La ubicación actual no siguió a un mensaje

Para que el movimiento sea automático, el último mensaje del usuario tiene que establecer directamente la llegada del grupo protagonista, y el modelo tiene que producir una directiva oculta de Maps válida. La narración de la IA por sí sola, la intención, la conversación sobre el tema, los viajes fallidos, el movimiento de un NPC solo y los lugares pasajeros no mueven el marcador. Prueba con una frase directa como “Vamos a la Cocina”. Usa **Set destination** para un movimiento determinista en el siguiente turno.

### La ubicación actual cambió al volver a abrir el chat

Comprueba qué rama de mensajes y qué swipe están seleccionados; la ubicación actual sigue la instantánea espacial guardada con ese historial. Si el historial seleccionado es el correcto pero el marcador no lo es, abre el editor de mapas, selecciona la ubicación activa correcta, elige **Set current story location** y haz clic en **Save**.

### Un destino o una ruta dice Needs review

La revisión del mapa o la ubicación actual cambiaron después de poner el movimiento en cola. Abre el mapa de la historia, revisa la ruta actual y vuelve a seleccionar el destino o la ruta. Si el destino que se muestra sigue en cola, cancélalo antes de volver a seleccionarlo.

### Una ruta planificada no avanza

Cada turno del usuario debería confirmar el paso siguiente que se muestra y poner en cola el que viene después. No hay un control de avance aparte. Si un turno completo no hace avanzar la ruta, cancélala y vuelve a planificarla desde la ubicación actual. Si la ubicación guardada ya es incorrecta, usa **Set current story location** y **Save**; esa corrección administrativa borra la ruta obsoleta.

### Este chat debería usar un mapa completamente distinto

Abre el editor de mapas y elige **Replace / start over**. Si hace falta, guarda antes una plantilla o una exportación, y luego crea, importa, copia o vincula el reemplazo. Si el chat está vinculado y debe conservar su jerarquía actual, usa primero **Detach and keep copy**. Quitar World Maps y volver a agregarlo no borra su mapa.

### No se puede seleccionar una ubicación lejana

Usa **Plan route** si existe un camino activo de padre, hijo o enlace. Si no, agrega un enlace directo disponible o viaja por lugares alcanzables, un turno cada vez. Los controles de exploración nunca mueven la historia.

### El prompt automático de ilustraciones siempre incluye el género de Game

Abre **Settings → Generations → Prompt Overrides → Maps location artwork** y quita `${genreLine}` de la plantilla. Guarda la anulación y luego vuelve a abrir la revisión de ilustraciones.

### El estilo de campaña aparece cuando debería estar desactivado

Revisa **Chat Settings → Illustrator → Use campaign art style**. Con ese interruptor apagado, `${campaignArtStyle}` y `${campaignArtStyleLine}` se resuelven como vacío. El resumen de la revisión debería indicar el estilo artístico de la campaña como **Off**.

### Un punto de referencia del padre aparece en la imagen de cada hijo

Evita `${parentLocationDescription}` y `${locationPath}` en la plantilla global de ilustraciones salvo que sean necesarios. El prompt de ubicación predeterminado se limita a la ubicación exacta y omite esos campos amplios.

### El prompt de imagen negativo contiene material inesperado

Revisa y edita el campo negativo antes de confirmar. Después revisa el ajuste global compartido de imagen negativa. La plantilla de ilustraciones de Maps construye el prompt positivo; no se copia al campo negativo.

### Una referencia de ubicación no se usa en las imágenes ni en los Storyboards

Comprueba que la imagen de la Gallery siga existiendo y que **Use for Roleplay illustrations and Game storyboards** esté activado en la ubicación actual exacta. El fondo del mapa de hijos es solo visual y no puede sustituir a una referencia, a menos que esa misma imagen de la Gallery se asigne también como referencia de ubicación.

### El modelo ignora el mapa

Comprueba que World Maps esté activo para el chat, que la jerarquía esté **Enabled**, que los últimos cambios se hayan guardado y que aparezca una ubicación actual en el control Story location. Usa la vista previa resuelta de **Turn prompt insert** para un diagnóstico avanzado.

### El trasfondo vinculado no se activa

Comprueba que la entrada esté adjunta a la ubicación actual exacta. Revisa que la entrada y el lorebook estén activados y que el lorebook no esté excluido del chat.

**Otras reglas de World Maps 1.3.1:** la generación guiada, la regeneración y la continuación no crean un turno de usuario, por lo que no consumen un destino ni un paso de ruta en cola. **Impersonate** sí crea un mensaje de usuario: un turno correcto confirma el movimiento una vez, un fallo del proveedor no confirma nada y un movimiento obsoleto pasa a **Needs review**.

Con Marinara Engine **2.4.1** o posterior, las directivas completas de movimiento y descubrimiento de Maps se quitan del texto transmitido y de los mensajes guardados sin alterar el texto ordinario entre corchetes ni sus espacios. Si aparece una directiva sin procesar, actualiza Engine y World Maps, reinicia cuando se indique y regenera o elimina el mensaje afectado.

Si una imagen de Gallery ocupa ambos papeles, **Remove reference only** la conserva como fondo del mapa hijo; **Reject both and create replacement** sustituye ambos y **Use for both** asigna una nueva imagen a los dos. También se considera ausente un enlace de Gallery guardado cuyo archivo ya no existe. Un resultado que termina mientras editas solo llena los papeles que aún faltan y no sobrescribe una sustitución, un interruptor de referencia, la posición del fondo, el estado de archivo ni otros cambios del borrador.

**Open** en una entrada vinculada sale del mapa y abre su lorebook. Un borrador limpio se cierra directamente; con cambios sin guardar, primero guarda o confirma que se pueden descartar. Si el trasfondo importado no se activa, revisa el resumen: **Map only** no contiene contenido restaurable. Usa **Map + linked entries** o **Map + complete lorebooks** y elige la coincidencia exacta, el destino ambiguo o una copia aparte. El trasfondo vinculado a un padre no se hereda en sus hijos.

## Guías relacionadas

- [Agentes: ayudantes de IA para tus chats](agents-overview.md)
- [Referencia de agentes descargables](built-in-agents.md)
- [Descripción general de los lorebooks](../lorebooks/overview.md)
- [Modo Roleplay: primeros pasos](../roleplay/getting-started.md)
- [Game Mode: primeros pasos](../game/getting-started.md)
- [Game Mode: Mapa, tiempo y clima](../game/map-time-weather.md)
