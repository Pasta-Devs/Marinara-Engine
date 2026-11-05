# Presupuestos de tokens y recursión en lorebooks

Los presupuestos limitan cuánto texto de los lorebooks (libros de trasfondo) llega a la IA, para que los lorebooks no desplacen el chat. Esta guía cubre el **Token Budget** (Presupuesto de tokens) y el **Entry Limit** (Límite de entradas) de cada lorebook, el **Lorebook Token Budget** (Presupuesto de tokens del lorebook) del chat, cómo Marinara recorta las entradas y el escaneo **Recursive** (Recursivo).

Los tokens son fragmentos pequeños de texto que los modelos cuentan. La ventana de contexto de un modelo es cuánto texto puede leer de una vez, contado en tokens. El texto de los lorebooks comparte esa ventana con el resto del prompt (las instrucciones enviadas a la IA).

## Dos presupuestos de tokens

Marinara aplica dos presupuestos cada vez que arma un prompt. Una entrada se omite si haría que cualquiera de los dos superara su límite.

- Cada lorebook tiene su propio **Token Budget**: la mayor cantidad de tokens que ese lorebook puede añadir a una respuesta.
- Cada chat tiene un único **Lorebook Token Budget**: la mayor cantidad de tokens que todos los lorebooks activos pueden añadir juntos.

## Configurar el Token Budget y el Entry Limit de un lorebook

1. Abre un lorebook desde el panel **Lorebooks**.
2. Haz clic en la pestaña **Overview** (Resumen).
3. Establece **Token Budget** y **Entry Limit**.

| Ajuste | Predeterminado | Qué hace |
| --- | --- | --- |
| **Token Budget** | 2048 | La mayor cantidad de tokens que este lorebook añade en una respuesta. 0 significa ilimitado. |
| **Entry Limit** | 100 | La mayor cantidad de entradas que este lorebook añade en una respuesta. Rango de 1 a 1000. |

**Entry Limit** cuenta entradas, no tokens. Un lorebook deja de añadir entradas cuando alcanza cualquiera de los dos límites.

Por ejemplo, con un **Token Budget** de 2048, una sola entrada de 3000 tokens nunca se puede añadir. Baja un presupuesto si un lorebook ocupa demasiado espacio. Súbelo si entradas importantes se siguen omitiendo.

## Configurar el Lorebook Token Budget del chat

1. Abre un chat.
2. Abre **Chat Settings** (Ajustes del chat).
3. Busca la sección **Lorebooks** y establece **Lorebook Token Budget**.

El valor predeterminado es 8192, y 0 significa ilimitado. Es el total de todos los lorebooks activos en este chat, además del **Token Budget** propio de cada lorebook.

## Cómo se recortan las entradas

Cuando coinciden más entradas de las que permite un presupuesto, Marinara añade las entradas en este orden.

1. Las entradas **Constant** (Constantes).
2. Las entradas que coincidieron con los mensajes más recientes.
3. El resto, en su orden de inyección (el campo **Order** de la entrada).

Marinara añade cada entrada que todavía cabe. Cuando una no cabe, omite esa entrada y sigue revisando el resto, así que una entrada más pequeña todavía puede entrar después de que se omitiera una más grande.

<a id="seeing-skipped-entries-in-active-context"></a>

## Ver las entradas omitidas en Active Context

1. Abre **Chat Settings**.
2. Despliega **Active Context** (Contexto activo). Muestra el escaneo de lorebook más reciente.

Si se omitieron entradas coincidentes, un aviso en la parte superior dice "N matching lore entries were skipped by token budget" (Se omitieron N entradas de trasfondo coincidentes por el presupuesto de tokens). Nombra cada presupuesto que omitió entradas y dónde cambiarlo. Despliégalo para ver cada entrada omitida, su lorebook, sus palabras clave coincidentes, su tamaño estimado y cuánto del presupuesto se usó. La razón es una de estas.

| Razón | Significado |
| --- | --- |
| **lorebook budget** | La entrada no cupo en el **Token Budget** de ese lorebook. |
| **chat budget** | La entrada no cupo en el **Lorebook Token Budget** del chat. |
| **lorebook and chat budgets** | Ambos límites ya estaban llenos. |
| **current-location context cap** | La entrada está adjunta a la ubicación actual del mapa, que tiene su propio límite fijo de 2.048 tokens. |

Una entrada con el texto en blanco, o con un texto que las macros convierten en nada, no aparece en la lista. Sus macros se siguen ejecutando, así que un `{{setvar}}` dentro de ella sigue estableciendo la variable. Con ambos presupuestos en 0, solo el límite de la ubicación puede listar entradas omitidas.

Si lorebooks grandes se siguen omitiendo, **Active Context** sugiere los agentes **Knowledge Retrieval** o **Knowledge Router**. Consulta [Fuentes de conocimiento](../agents/knowledge-sources.md). Estos agentes suelen funcionar mejor con lorebooks grandes que un límite más alto.

## Escaneo recursivo

Normalmente Marinara escanea solo tus mensajes recientes en busca de palabras clave. Con **Recursive** activado, también escanea el texto de las entradas que acaban de activarse, así que una entrada puede atraer entradas relacionadas.

1. Abre el lorebook y haz clic en **Overview**.
2. Activa **Recursive**. Está desactivado de forma predeterminada.
3. Establece **Max Depth** (Profundidad máxima) si quieres cambiar hasta dónde llega el encadenamiento.

**Max Depth** es el número de pasadas de escaneo adicionales. El valor predeterminado es 3 y el rango es de 1 a 10. Los valores más altos encuentran más trasfondo conectado y usan más procesamiento.

Cada entrada también tiene su propio interruptor **Recursion** (Recursión), desactivado de forma predeterminada, que decide si el contenido de esa entrada puede disparar más entradas. Déjalo desactivado a menos que la entrada deba encadenarse. Consulta [Entradas de lorebook: claves, posición y tiempo](entries.md).

La recursión no se salta los presupuestos. Las entradas encontradas por una pasada recursiva cuentan contra el **Token Budget**, el **Entry Limit** y el **Lorebook Token Budget** del chat.

## Guías relacionadas

- [Entradas de lorebook: claves, posición y tiempo](entries.md)
- [Resumen de lorebooks](overview.md)
- [Fuentes de conocimiento: agentes Retrieval y Router](../agents/knowledge-sources.md)
