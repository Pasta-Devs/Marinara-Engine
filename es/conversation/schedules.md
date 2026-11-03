# Horarios de personajes y mensajes autónomos

Los mensajes autónomos son mensajes que un personaje te envía primero, cuando llevas un rato en silencio. Un horario es el plan semanal de un personaje que hace que parezca despierto, ocupado o dormido a distintas horas. Ambos funcionan solo en Conversation Mode (modo Conversación).

Los horarios son opcionales. Con los horarios desactivados, los personajes igualmente te contactan según su locuacidad (con qué frecuencia un personaje inicia una conversación) y tu presencia.

Ir a: [Activar los horarios](#turn-on-schedules) si solo quieres un horario.

## Activar los mensajes autónomos

Antes de empezar: abre un chat de Conversation. Los chats nuevos empiezan con esto activado (consulta [Conversation Mode: primeros pasos](getting-started.md)).

1. Abre **Chat Settings** (Ajustes del chat) en el chat.
2. Busca la sección **Autonomous Messaging**.
3. Activa **Autonomous Messages**.

Si no funcionó: los personajes permanecen en silencio mientras tu presencia es **Do Not Disturb** (consulta [Tu estado de presencia](getting-started.md#your-presence-status)).

### Definir el límite de mensajes de contacto

En **Chat Settings → Autonomous Messaging**, **Chat Check-In Cap** limita cuántos mensajes de contacto pueden enviar los personajes por día en este chat.

- **Default chat ceiling (talkativeness-based)** toma el límite de la locuacidad de cada personaje (tabla de abajo).
- **Numeric value** muestra un campo numérico. Escribe cualquier número entero de 1 o más. Los números altos pueden significar muchas solicitudes al modelo y muchas notificaciones.

Un personaje también puede tener su propio **Daily safety limit** (se define en su horario). El límite de un personaje funciona así:

- Si el tope del chat está en **Numeric value** y hay un **Daily safety limit**: gana el número más bajo.
- Si solo hay uno de los dos: se aplica ese número, aunque sea más alto que el número de locuacidad de abajo.
- Si no hay ninguno: el número sale de la locuacidad del personaje.

| Locuacidad del personaje | Mensajes de contacto por día |
| --- | --- |
| 80 o más | 8 |
| 60 a 79 | 6 |
| 40 a 59 | 5 |
| 20 a 39 | 3 |
| menos de 20 | 2 |

<a id="turn-on-schedules"></a>

## Activar los horarios

Antes de empezar: activa **Autonomous Messages**.

1. En **Chat Settings → Autonomous Messaging**, activa **Schedules**. (En el asistente de chat nuevo, la misma opción se llama **Generate Schedules**.) Los horarios que ya existen aparecen de inmediato.
2. Elige tu zona horaria en el campo de debajo.
3. Haz clic en **Generate** para crear horarios para los personajes que no tienen ninguno. El botón dice **Regenerate** cuando ya existen horarios.
4. Espera a que termine. Entonces aparece una lista **Edit schedules** con una fila por personaje. Una fila indica cuántos días están completos (por ejemplo **3 days scheduled**) o **Create schedule**. La lista solo se muestra cuando ya existen horarios.
5. Haz clic en la fila de un personaje para abrir su editor de horarios (sección siguiente).

Un horario pertenece al personaje y se reutiliza en todos los chats de Conversation. Desactivar **Schedules** en un chat lo mantiene desactivado allí y conserva el horario.

La renovación semanal automática está desactivada a menos que actives **Renew weekly** para ese personaje en el **Character Schedule Manager**. Ábrelo con el botón de calendario del pie de la barra lateral, junto al cuadro de estado.

Marinara intenta una renovación una vez por chat cada vez que carga la página de la app. Si falla, no lo intenta de nuevo hasta que recargues la página. Haz clic en **Generate** para intentarlo otra vez.

**Schedule generation preferences**, en la misma área **Schedules** de **Chat Settings**, contiene una indicación de texto libre sobre cómo se escriben los horarios. Se aplica a todos los chats de Conversation la próxima vez que se generen horarios. Ejemplo:

```text
Make everyone go to sleep before midnight. I work 9-5 on weekdays.
```

## El editor de Schedules

El título del editor dice **Edit** más el nombre del personaje y **Schedule**.

Arriba, **Routine profile** muestra un resumen de la semana en lenguaje sencillo. Haz clic en **Generate summary** para crearlo, o en **Refresh summary** para actualizarlo. Después de cambiar el horario aparece **Summary may be stale**. **Generation model** elige el modelo que escribe los horarios.

### Tuning

Abre **Tuning** para ver los controles principales.

- **Chat talkativeness**: un control deslizante con **Rare**, **Quiet**, **Balanced**, **Social** y **Very frequent**. El valor predeterminado es **Balanced**. Define con qué frecuencia el personaje inicia mensajes y se une a la conversación grupal, y su límite diario predeterminado.
- **Wait before checking in**: minutos de silencio antes de que el personaje pueda contactarte. El valor predeterminado es 120. Puedes usar de 15 a 360.
- **Check-in moments**: chips de **Morning**, **Goodnight**, **Meal breaks**, **After busy** y **Long absence**. Todos están activados. Haz clic en uno para desactivarlo.

Abre **Advanced timing** dentro de **Tuning** para tres controles más.

- **Daily safety limit**: el máximo de mensajes de contacto por día para este personaje. Déjalo en **Default**, o escribe un número entero de 1 o más. Si el chat también tiene un tope numérico, gana el número más bajo; si no, este número reemplaza el número de locuacidad.
- **Delay while you're away**: minutos extra antes de que el personaje responda mientras su estado es **Away**. Déjalo en blanco para un tiempo aleatorio de 1 a 3 minutos. Puedes usar de 0 a 120.
- **Delay while you're busy**: lo mismo mientras su estado es **Busy**. Déjalo en blanco para un tiempo aleatorio de 2 a 5 minutos. Puedes usar de 0 a 120.

### Schedule AI: rehacer la semana

Abre **Schedule AI** para que el modelo reescriba el horario. Elige una **Week action**:

| Acción | Resultado |
| --- | --- |
| **Rewrite** | Un borrador nuevo de la semana completa. |
| **Adjust** | Conserva la mayor parte del horario y aplica tu indicación. |
| **Vary** | Una semana claramente distinta pero creíble. |
| **Repair** | Corrige huecos y problemas evidentes con cambios pequeños. |

1. Elige una **Week action**.
2. En **Weekly generation**, elige **Entire week in one request** o **One request per day**. Una solicitud por día hace siete solicitudes más pequeñas y puede usar más tokens (los fragmentos pequeños de texto que cuentan los modelos).
3. Escribe indicaciones opcionales en **Week guidance**, por ejemplo `make weekdays more nocturnal, keep weekends social`.
4. Haz clic en el botón que nombra tu acción, como **Rewrite week**.
5. Haz clic en **Save schedule** para conservar el resultado. Hasta entonces es solo un borrador (**Unsaved draft**).

Si no funcionó: tu borrador se conserva. Una llamada fallida no se reintenta, así que haz clic en el botón de nuevo. Haz clic en **Stop** o cierra el editor para cancelar una solicitud en curso. Si el editor muestra **Edit generated schedule JSON**, el modelo devolvió texto que no se pudo leer. Corrige el texto allí y haz clic en **Apply to draft**.

### Bloques diarios

Cada día, de lunes a domingo, tiene su propia fila. Un día vacío muestra **No blocks scheduled for this day**. Cada bloque tiene un estado, un intervalo de tiempo como `09:00-11:30` y una actividad corta como `at work`.

1. Haz clic en **Add block** debajo de un día.
2. Elige un estado: **Online**, **Away**, **Busy** u **Offline**.
3. Escribe el intervalo de tiempo y la actividad.
4. Haz clic en **Save schedule**. **Cancel** cierra el editor sin guardar.

Usa el icono de la papelera para quitar un bloque. Para rehacer un solo día, escribe una indicación en **Guide Monday** (o el día que quieras) y haz clic en **Regenerate Monday**.

Durante un bloque **Offline** el personaje nunca escribe primero. Durante un bloque **Busy** espera tres veces más de lo habitual.

### Mover un horario entre personajes

Haz clic en **Export schedule** para descargar el borrador como un archivo JSON (bloques semanales, resumen, locuacidad, momentos de contacto y tiempos). En el editor de otro personaje, haz clic en **Import schedule** para cargarlo. Marinara revisa el archivo y mueve el horario a la semana actual. No se guarda nada hasta que hagas clic en **Save schedule**.

## Definir un estado con /status

`/status` define o borra un estado temporal de un personaje sin cambiar su horario guardado. Funciona solo en Conversation Mode. El estado pertenece al personaje, así que se aplica en todos los chats en los que está ese personaje.

Escribe una de estas líneas en el cuadro de mensaje:

```text
/status dnd Mira
/status clear Mira
```

La primera pone a Mira en estado ocupado. La segunda la devuelve a su horario. Con un solo personaje en el chat puedes omitir el nombre. `/status` solo enumera los personajes y el uso.

La forma completa está abajo. `idle` significa **Away** y `dnd` significa **Busy**. Los corchetes indican que el nombre es opcional.

```text
/status online|idle|dnd|offline|clear [character name]
```

Un estado que defines se mantiene hasta que lo borres, y un personaje no puede reemplazarlo.

## Dejar que los personajes cambien su propio estado

Con **Schedule Updates** activado en **Chat Settings → Agents → Commands**, un personaje puede definir su propio estado y actividad temporales. Por ejemplo, si le pides que se concentre durante una hora, puede cambiar a **Busy** con la actividad "Studying".

- El cambio dura lo que diga el personaje, o una hora si no dice nada. El máximo es siete días.
- Cuando se acaba el tiempo, el personaje vuelve a su horario, o a **Online** si no tiene ninguno.
- Nunca edita el horario guardado.

## Cómo se espacian los mensajes de contacto

| Regla | Detalle |
| --- | --- |
| Primer contacto | El personaje espera hasta que hayas estado en silencio durante su tiempo de **Wait before checking in** (120 minutos de forma predeterminada). |
| Reacción | Una reacción tuya sin mensaje nuevo abre una espera más corta. |
| Estado **Offline** | Sin contacto. |
| Estado **Busy** | La espera es tres veces más larga. |
| Seguimientos | Hasta dos más mientras sigues en silencio, tres en total. El primer seguimiento llega tras el doble de la espera, el segundo tras cuatro veces la espera. |
| Tu respuesta | El conteo se reinicia. |
| Varios personajes listos | Va primero el que tiene la locuacidad más alta y el mejor momento. Un personaje que está **Online** tiene prioridad. |

En un chat grupal donde cada personaje responde en su propia respuesta (consulta [Chats grupales](../chats/group-chats.md)), los personajes comparten un límite diario y un ritmo. Después de que cualquier personaje te contacta, el siguiente contacto de cualquiera espera como un seguimiento. Cualquier personaje cuya propia espera haya pasado puede enviarlo, y va primero el que tiene menos contactos ese día. Tras una ausencia larga, solo un personaje te contacta.

## Guías relacionadas

- [Conversation Mode: primeros pasos](getting-started.md)
- [Perfiles de Conversation Mode](profiles.md)
- [Descripción general de los ajustes del chat](../chats/chat-settings.md)
