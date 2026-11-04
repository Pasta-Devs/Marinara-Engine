# Vincular lorebooks a personajes y personas

Vincula un lorebook (libro de trasfondo) a un personaje o a una persona y se activará por sí solo en los chats correctos. También puedes incrustar un lorebook dentro de una tarjeta de personaje y controlar los lorebooks de un solo chat. ¿Es la primera vez que usas lorebooks? Empieza por [Resumen de lorebooks](overview.md).

## Vincular o incrustar

| Aspecto | Vincular (asignar) | Incrustar |
| --- | --- | --- |
| Qué ocurre | El personaje o la persona apunta a un lorebook de tu biblioteca. | El lorebook se escribe dentro de la tarjeta de personaje. |
| Se activa | En los chats con ese personaje o esa persona. | Igual, y viaja con la tarjeta. |
| Se exporta con la tarjeta | No | Sí |
| Disponible para | Personajes y personas | Solo personajes |

Casi siempre, vincula. Incrusta solo cuando planees compartir la tarjeta con su lorebook.

## La pestaña Lorebook en el editor

Tanto el editor de personajes como el editor de personas tienen una pestaña **Lorebook**.

1. Abre un personaje o una persona para editar.
2. Haz clic en la pestaña **Lorebook**. La sección **Lorebooks** tiene dos botones, **New** (Nuevo) y **Assign Lorebook** (Asignar lorebook).

**New** crea un lorebook ya vinculado a este personaje o persona, con su categoría establecida en **Character** (Personaje). **Assign Lorebook** vincula un lorebook que ya tienes.

## Asignar un lorebook existente

Antes de empezar: el selector solo muestra los lorebooks cuya **Category** (Categoría) es **Character**, también para las personas. Si falta un lorebook, ábrelo, establece **Category** en **Character** en la pestaña **Overview** (Resumen) y vuelve a intentarlo.

1. En la pestaña **Lorebook**, haz clic en **Assign Lorebook**.
2. Escribe parte del nombre en el cuadro de búsqueda.
3. Haz clic en el lorebook. Aparece una marca de verificación.
4. Deja **Scope** (Alcance) en **All chats with** (Todos los chats con) seguido del nombre, o cámbialo (consulta abajo).
5. Haz clic en **Assign** (Asignar).

El lorebook aparece ahora en la lista de asignados. Usa el botón **Scope** de su fila para cambiar el alcance, y el icono de la papelera para quitar el vínculo. Haz clic en el nombre para abrir el lorebook.

Un lorebook global no puede estar también vinculado. Consulta [Resumen de lorebooks](overview.md).

### Scope

**Scope** decide qué chats pueden usar el lorebook vinculado. Solo se tienen en cuenta los chats con este personaje, o que usan esta persona.

| Scope | Resultado |
| --- | --- |
| **All chats with** (el nombre) | El predeterminado. Se activa en todos esos chats. |
| **Disabled for all chats** (Desactivado para todos los chats) | El vínculo se mantiene, pero el lorebook nunca se activa. Úsalo para pausarlo. |
| **Specific chats** (Chats específicos) | Solo los chats que marques en la lista. Marca al menos uno antes de poder guardar. |

Para cambiar el alcance más tarde, haz clic en **Scope** en la fila, ajústalo y vuelve a hacer clic en **Assign**.

## Incrustar un lorebook en una tarjeta de personaje

Antes de empezar: asigna primero el lorebook al personaje (consulta arriba).

1. Abre el personaje y haz clic en la pestaña **Lorebook**.
2. En la fila del lorebook, haz clic en **Embed into card** (Incrustar en la tarjeta).

Aparece una insignia **Embedded** (Incrustado) en la fila, y ahora las entradas se exportan con la tarjeta.

Una tarjeta contiene un solo lorebook incrustado. Si ya tiene uno, **Embed into card** está desactivado, y su tooltip (texto de ayuda) indica que quites primero el lorebook incrustado actual.

Después de editar el lorebook vinculado, haz clic en **Refresh** (Actualizar) en su fila para reescribir la copia incrustada a partir de las entradas actuales.

### Gestionar un lorebook incrustado

Cuando una tarjeta tiene un lorebook incrustado, estos controles aparecen debajo de la lista de asignados, junto con una lista de solo lectura de sus entradas.

- **Import Embedded Lorebook** (Importar lorebook incrustado) convierte las entradas de la tarjeta en un lorebook normal de tu biblioteca, vinculado de vuelta al personaje. Una vez que existe una copia vinculada, el botón dice **Reimport Embedded Lorebook** (Reimportar lorebook incrustado).
- **Edit Embedded Lorebook** (Editar lorebook incrustado) abre ese lorebook vinculado. Tus ediciones se sincronizan de vuelta en la copia de la tarjeta.
- **Remove from card** (Quitar de la tarjeta) elimina la copia incrustada. Un lorebook vinculado por separado queda intacto.

Muchas tarjetas importadas de otras herramientas llegan con un lorebook incrustado. Haz clic en **Import Embedded Lorebook** para obtener una versión editable.

## La sección Lorebooks de Chat Settings

Cada chat tiene sus propios controles de lorebooks.

1. Abre un chat.
2. Abre **Chat Settings** (Ajustes del chat).
3. Busca la sección **Lorebooks**. Una insignia muestra cuántos lorebooks están activos.

Cada lorebook activo tiene una insignia que indica por qué está activado.

| Insignia | Significado |
| --- | --- |
| **Chat** | Lo añadiste a este chat. |
| **Global** | Es un lorebook global. |
| **Character** | Está vinculado a un personaje de este chat. |
| **Persona** | Está vinculado a la persona de este chat. |

Puedes cambiar lo que está activo solo para este chat.

- **Add Lorebook** (Añadir lorebook) añade un lorebook a este chat. Muestra la insignia **Chat**.
- El icono de la papelera (**Remove from chat**, Quitar del chat) quita un lorebook que añadiste.
- El icono del ojo tachado (**Disable in this chat**, Desactivar en este chat) oculta aquí un lorebook automático sin desvincularlo. Después muestra un nombre tachado y una insignia **Disabled** (Desactivado).
- El icono del ojo (**Enable in this chat**, Activar en este chat) lo vuelve a activar.

### Lorebook Token Budget

**Lorebook Token Budget** (Presupuesto de tokens del lorebook) limita cuántos tokens (fragmentos de texto) de texto de lorebook puede añadir este chat. El predeterminado es 8192, y 0 significa sin límite. Se aplica además del **Token Budget** propio de cada lorebook. Consulta [Presupuestos de tokens y recursión de lorebooks](token-budgets.md).

## Guías relacionadas

- [Resumen de lorebooks](overview.md)
- [Presupuestos de tokens y recursión de lorebooks](token-budgets.md)
- [Importar y exportar lorebooks](import-export.md)
- [Crear y editar personajes](../characters/creating-and-editing-characters.md)
- [Resumen de Chat Settings](../chats/chat-settings.md)
