# Horarios de personajes y mensajes autónomos

Esta guía explica cómo los personajes en Conversation Mode te escriben primero, y cómo tú decides cuándo lo hacen. Cubre los mensajes autónomos, los horarios de los personajes, el comando **/status** y tu propio estado de presencia. Estas funciones solo funcionan en Conversation Mode.

## Qué hacen los mensajes autónomos y los horarios

Un mensaje autónomo es un mensaje que un personaje te envía primero, sin que tú escribas nada. Marinara Engine (Marinara para abreviar) los envía cuando llevas un rato en silencio, para que el chat se sienta como una relación real de mensajería.

Dos ajustes controlan este comportamiento:

- **Autonomous Messages** (Mensajes autónomos) decide si los personajes pueden escribirte o no.
- **Schedules** (Horarios) da a cada personaje una rutina semanal, para que parezcan despiertos, ocupados o dormidos en distintos momentos.

Los horarios son opcionales. Con los mensajes autónomos activados pero los horarios desactivados, los personajes igual te escriben según su locuacidad y tu estado. La locuacidad es un ajuste por personaje que define con qué frecuencia un personaje inicia una conversación por su cuenta.

## Activa los mensajes autónomos

Esto lo controlas desde el chat, no desde la tarjeta de personaje. Todos estos controles están en la sección **Autonomous Messaging** (Mensajería autónoma) de **Chat Settings** (Ajustes del chat).

1. Abre un chat de Conversation.
2. Abre **Chat Settings** (el icono de engranaje).
3. Busca la sección **Autonomous Messaging**.
4. Activa el interruptor **Autonomous Messages**.

En el asistente de configuración de chat nuevo, **Autonomous Messages** está activado de forma predeterminada. Puedes desactivarlo en cualquier momento en **Chat Settings**.

### Chat Check-In Cap

Debajo del interruptor, **Chat Check-In Cap** (Límite de saludos del chat) limita cuántas veces al día pueden escribirte los personajes en este chat.

- La opción predeterminada es **Default chat ceiling (talkativeness-based)** (Tope de chat predeterminado, según la locuacidad). El límite viene de la locuacidad de cada personaje.
- Elige **Numeric value** (Valor numérico) para mostrar un campo de número e introducir cualquier tope positivo en números enteros. Los topes más altos pueden generar muchas solicitudes al modelo y muchas notificaciones.

Este límite es un tope para todo el chat. El límite propio de un personaje, fijado en su horario, solo puede bajar este número, nunca subirlo.

El valor predeterminado basado en la locuacidad funciona así:

| Locuacidad del personaje | Saludos predeterminados por día |
|---|---|
| 80 o más | 8 |
| 60 a 79 | 6 |
| 40 a 59 | 5 |
| 20 a 39 | 3 |
| menos de 20 | 2 |

### Activa los horarios

**Schedules** (horarios) está en **Autonomous Messaging**. Las rutinas guardadas pertenecen a los personajes y se reutilizan en chats Conversation, también al añadir un personaje a un chat existente. Desactivarlas explícitamente en un chat conserva esa elección sin borrar la rutina del personaje.

1. Activa el interruptor **Schedules**.
2. Las rutinas existentes aparecen inmediatamente. Activar horarios no genera nuevos; pulsa **Generate** cuando los quieras.
3. Cuando existen rutinas, aparece una lista **Edit schedules** (Editar horarios) con una fila por personaje.

La renovación semanal automática está desactivada hasta que la habilites para el personaje en **Character Schedule Manager** (gestor de horarios). Un fallo no se reintenta continuamente al reabrir el chat; usa los controles de generación para reintentar.

Cada fila muestra cuántos días están completos, por ejemplo **3 days scheduled** (3 días programados), o **Create schedule** (Crear horario) si ese personaje aún no tiene ninguno. Un botón **Generate** (Generar) (con la etiqueta **Regenerate** una vez que existen rutinas) reconstruye las rutinas cuando quieras.

## El editor de Schedules

Haz clic en la fila de un personaje en la lista **Edit schedules** para abrir el editor de horarios. El título de la ventana muestra **Edit** seguido del nombre del personaje y **Schedule**.

Arriba, el área **Routine profile** (Perfil de rutina) muestra un resumen en lenguaje sencillo de la semana. Usa el botón **Generate summary** (Generar resumen) para crearlo, o **Refresh summary** (Actualizar resumen) para ponerlo al día. Si cambias el horario después de hacer un resumen, aparece una nota **Summary may be stale** (El resumen puede estar desactualizado).

### Tuning

Abre la sección **Tuning** (Ajuste fino) para los controles principales.

- **Chat talkativeness** (Locuacidad del chat) es un control deslizante con cinco pasos: **Rare**, **Quiet**, **Balanced**, **Social** y **Very frequent**. **Balanced** es el punto medio predeterminado. Este valor anula la locuacidad predeterminada del personaje donde se utilice su horario. Afecta con qué frecuencia el personaje inicia mensajes, envía seguimientos y participa en la charla grupal. También fija el límite diario predeterminado del personaje.
- **Wait before checking in** (Esperar antes de saludar) es el tiempo de silencio, en minutos, antes de que este personaje pueda iniciar un saludo. El rango es de 15 a 360 minutos. El valor predeterminado es **120**.
- **Check-in moments** (Momentos de saludo) son los motivos que el personaje puede usar para escribirte. Las etiquetas son **Morning**, **Goodnight**, **Meal breaks**, **After busy** y **Long absence**. Todas están activadas de forma predeterminada. Haz clic en una para desactivarla.

### Advanced timing

Dentro de **Tuning**, abre **Advanced timing** (Tiempos avanzados) para tres controles más.

- **Daily safety limit** (Límite diario de seguridad) es un máximo estricto para este único personaje, ya sea **Default** o un número del 1 al 8 por día. Solo puede bajar el límite del chat, no subirlo. Normalmente déjalo en **Default**.
- **Delay while you're away** (Retraso mientras estás ausente) fija cuántos minutos espera este personaje antes de enviar un mensaje mientras su propio estado es **Away**. Déjalo en blanco para usar el valor predeterminado, un tiempo aleatorio de 1 a 3 minutos. El rango es de 0 a 120 minutos.
- **Delay while you're busy** (Retraso mientras estás ocupado) hace lo mismo mientras el estado del personaje es **Busy**. Déjalo en blanco para usar el valor predeterminado, un tiempo aleatorio de 2 a 5 minutos. El rango es de 0 a 120 minutos.

### Schedule AI: redacta la semana de nuevo

Abre la sección **Schedule AI** para que el modelo reescriba la rutina por ti. Elige una **Week action** (Acción de la semana):

- **Rewrite** hace un borrador nuevo de la semana completa.
- **Adjust** conserva la mayor parte de la rutina y aplica tus indicaciones.
- **Vary** hace que la semana sea claramente distinta pero aún creíble.
- **Repair** corrige huecos y problemas evidentes con cambios pequeños.

Escribe pistas opcionales en el cuadro **Week guidance** (Indicaciones de la semana), por ejemplo:

```
make weekdays more nocturnal, keep weekends social
```

Luego haz clic en el botón que nombra tu acción, como **Rewrite week**. El resultado es solo un borrador. Nada se guarda hasta que haces clic en **Save schedule**. Si el modelo devuelve JSON inválido, corrígelo en **Edit generated schedule JSON** (editar JSON del horario generado) y elige **Apply to draft** (aplicar al borrador). Las correcciones validadas y los días generados correctamente permanecen en el borrador hasta guardar. Un fallo detiene la llamada sin reintentos automáticos. **Stop** o cerrar el editor cancela la solicitud activa. Cerrar el gestor o los ajustes del chat también cancela la generación iniciada allí.

### Bloques diarios

Debajo de las secciones, cada día de lunes a domingo tiene su propia fila. Un día sin nada configurado muestra **No blocks scheduled for this day** (No hay bloques programados para este día).

Cada bloque tiene tres partes, con la etiqueta **Status, time & activity** (Estado, hora y actividad):

- Un **status** (estado) que eliges entre **Online**, **Away**, **Busy** u **Offline**.
- Un rango de horas, escrito así: `09:00-11:30`.
- Una nota breve de actividad, por ejemplo `at work`.

Usa **Add block** (Añadir bloque) para agregar un rango de horas. Usa el icono de papelera para quitar uno. Cada día también tiene su propio cuadro de indicaciones, con la etiqueta **Guide Monday**, **Guide Tuesday**, y así sucesivamente. Escribe una pista ahí y haz clic en el botón correspondiente, como **Regenerate Monday**, para volver a redactar solo ese día.

El estado del bloque cambia lo que hace un personaje cuando llega la hora del saludo. Un personaje con un bloque **Offline** nunca escribe primero durante ese tiempo. Un personaje con un bloque **Busy** espera tres veces más de lo normal antes de escribirte.

Cuando termines, haz clic en **Save schedule**. **Cancel** cierra el editor sin guardar.

### Mueve un horario entre personajes o instalaciones

Usa **Export schedule** (Exportar horario), al final del editor, para descargar el borrador actual como un archivo JSON. La exportación incluye los bloques semanales, el resumen de la rutina, la locuacidad, los momentos de saludo y los ajustes de tiempos avanzados.

Abre el editor de horarios de otro personaje y elige **Import schedule** (Importar horario) para cargar ese archivo. Marinara valida el archivo antes de reemplazar el borrador del editor, y mueve la rutina importada a la semana actual. La importación no se guarda sola: elige **Save schedule** para conservarla, o **Cancel** para dejar el horario del personaje sin cambios.

### Schedule generation preferences

De vuelta en **Chat Settings**, el cuadro **Schedule generation preferences** (Preferencias de generación de horarios) contiene indicaciones de texto libre sobre cómo se escriben las rutinas. Este ajuste es global. Se aplica a cada chat de Conversation la próxima vez que se generen horarios, a mano o por la app. Por ejemplo:

```
Make everyone go to sleep before midnight. I work 9-5 on weekdays.
```

## Fija un estado puntual con /status

El comando **/status** fija o borra un estado temporal para un personaje, sin cambiar su horario guardado. Solo funciona en Conversation Mode.

La forma del comando es:

```
/status <online|idle|dnd|offline|clear> [character name]
```

Escribe `idle` para Away y `dnd` para Busy. Estos son los mismos cuatro estados que se usan en los bloques del horario. Para que un personaje llamado Mira aparezca ocupado ahora mismo:

```
/status dnd Mira
```

Para borrar esa anulación y devolver a Mira a su horario:

```
/status clear Mira
```

Si el chat tiene un solo personaje, puedes omitir el nombre. Ejecuta **/status** sin opciones para ver la lista de personajes y la ayuda de uso.

## Cómo se dosifican los mensajes autónomos

Marinara dosifica los mensajes autónomos para que un personaje nunca te sature. Las reglas de abajo usan el horario propio de cada personaje.

- Un personaje espera hasta que llevas en silencio su tiempo de **Wait before checking in**. El valor predeterminado es 120 minutos.
- Un personaje cuyo estado actual es **Offline** no escribe primero.
- Un personaje cuyo estado actual es **Busy** espera tres veces más.
- Después del primer mensaje, un personaje puede enviar hasta dos más mientras sigues en silencio. Eso son tres mensajes en total por cada tramo de silencio.
- Cada seguimiento espera más que el anterior. El primer seguimiento espera el doble del tiempo base, y el segundo espera el cuádruple del tiempo base.
- Cuando respondes, la cuenta se reinicia. El siguiente silencio empieza de cero.

Si varios personajes están listos a la vez, el que tiene mayor locuacidad y mejor momento va primero.

## Tu estado de presencia

Tu propio estado les dice a los personajes si estás disponible. El control de estado está en el pie de página de la barra lateral y permanece visible en todos los modos de chat. Su efecto sobre la mensajería solo se aplica en Conversation Mode.

Haz clic en la píldora de estado para abrir cuatro opciones:

- **Active**: estás en línea y disponible.
- **Idle**: se muestra cuando estás ausente.
- **Do Not Disturb**: detiene todos los mensajes autónomos.
- **Invisible**: oculta tu estado a los personajes.

**Idle** es casi automático. Si tu estado es **Active** y no haces nada durante 10 minutos, Marinara te pone en **Idle**. Te vuelve a poner en **Active** cuando regresas. También puedes elegir **Idle** tú mismo desde el panel emergente. Elegir cualquier estado a mano desactiva el cambio automático hasta que vuelves a elegir **Active**.

Pon **Do Not Disturb** cuando quieras silencio. Ningún personaje te escribirá primero mientras esté activado. **Idle** no bloquea los mensajes autónomos. Los personajes igual pueden saludarte mientras estás ausente.

Junto a la píldora de estado hay un campo **What are you doing?** (¿Qué estás haciendo?). Escribe una actividad personalizada breve, de hasta 120 caracteres. Las entradas recientes aparecen bajo una lista **Recent status** (Estado reciente) para que puedas reutilizarlas.

## Guías relacionadas

- [Conversation Mode: primeros pasos](getting-started.md)
- [Perfiles de Conversation Mode (Display Name, About Me, Behavior)](profiles.md)
- [Resumen de Chat Settings](../chats/chat-settings.md)
