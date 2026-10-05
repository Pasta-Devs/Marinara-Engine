# Presupuestos de tokens y recursión en lorebooks

Esta guía explica cómo Marinara Engine limita cuánto texto de un lorebook (libro de trasfondo) llega a la IA. Cubre el **Token Budget** (presupuesto de tokens) y el **Entry Limit** (límite de entradas) propios de cada lorebook, más el **Lorebook Token Budget** que abarca todo el chat. También explica cómo Marinara recorta las entradas cuando un presupuesto está lleno, y qué hace el escaneo **Recursive** (recursivo).

Un token es un fragmento pequeño de texto, más o menos de unos pocos caracteres. Cada modelo tiene una ventana de contexto limitada, que es la cantidad total de texto que puede leer de una vez. Los presupuestos evitan que tus lorebooks llenen esa ventana y desplacen la conversación real.

## Dos presupuestos de tokens

Marinara aplica dos presupuestos de tokens distintos cada vez que arma un prompt (las instrucciones enviadas a la IA). Marinara omite una entrada si haría que cualquiera de los dos presupuestos superara su límite.

1. Cada lorebook tiene su propio **Token Budget**. Esto limita cuánto texto puede añadir ese lorebook por respuesta.
2. El chat tiene un único **Lorebook Token Budget**. Esto limita el texto total de todos los lorebooks activos combinados en ese chat.

Ambos límites funcionan al mismo tiempo. Una sola entrada puede quedar bloqueada por el presupuesto del lorebook, por el presupuesto del chat, o por ambos.

## Configurar el Token Budget y el Entry Limit de un lorebook

Abre un lorebook desde el panel **Lorebooks**, luego usa la pestaña **Overview** (Resumen). Verás dos campos numéricos cerca de los ajustes de escaneo.

- **Token Budget** (predeterminado **2048**): la mayor cantidad de tokens que este lorebook puede añadir en una respuesta. Ponlo en **0** para que sea ilimitado.
- **Entry Limit** (predeterminado **100**): la mayor cantidad de entradas que este lorebook puede añadir en una respuesta. Puedes ponerlo de **1** a **1000**.

El **Entry Limit** es un límite separado del presupuesto de tokens. Cuenta entradas, no tokens. Aunque quede espacio en el presupuesto de tokens, un lorebook deja de añadir entradas en cuanto alcanza este límite. El presupuesto de tokens todavía puede omitir entradas mientras el lorebook esté por debajo de su **Entry Limit**.

Por ejemplo, imagina un lorebook con un **Token Budget** de **2048** y una entrada de 3000 tokens. Ese lorebook nunca puede añadir la entrada. Baja el presupuesto solo si un lorebook está ocupando demasiado espacio. Súbelo si entradas importantes se siguen omitiendo.

## El Lorebook Token Budget que abarca todo el chat

El límite a nivel del chat vive en el panel lateral **Settings** (Configuración) del chat, en la sección **Lorebooks**.

1. Abre un chat.
2. Abre el panel lateral **Settings** del chat.
3. Busca la sección **Lorebooks**.
4. Configura el campo **Lorebook Token Budget**.

El valor predeterminado es **8192**. Ponlo en **0** para que sea ilimitado. Este presupuesto es el total de cada lorebook activo en este chat. Se aplica además del **Token Budget** propio de cada lorebook.

## Cómo se recortan las entradas

Cuando coinciden más entradas de las que permite un presupuesto, Marinara conserva las más importantes y descarta el resto. Ordena las entradas antes de recortar para que sobrevivan las que probablemente más necesitas.

- Las entradas **Constant** (constantes) van primero. Son las entradas configuradas para inyectarse cada vez que el lorebook está activo.
- Las entradas que coincidieron con tu mensaje más reciente van después.
- Las entradas restantes siguen en su orden de inyección normal.

Marinara recorre esa lista y añade cada entrada que todavía cabe. Si una entrada haría que un presupuesto superara su límite, Marinara omite esa entrada y sigue adelante. Aun así revisa cada entrada por debajo de la que omitió. Esto significa que una entrada más pequeña puede entrar incluso después de que Marinara omita una más grande.

<a id="seeing-skipped-entries-in-active-context"></a>

## Ver las entradas omitidas en Active Context

No tienes que adivinar qué entradas se descartaron. Abre **Chat Settings** y despliega **Active Context** (Contexto activo). Muestra el resultado en vivo del escaneo de lorebook más reciente.

Si se omitió alguna entrada coincidente, aparece un aviso ámbar en la parte superior. Dice "N matching lore entries were skipped by token budget" (Se omitieron N entradas de trasfondo coincidentes por el presupuesto de tokens). Expándelo para ver cada entrada omitida.

Cada entrada omitida indica de qué lorebook vino y por qué fue bloqueada. La razón es una de estas:

- **lorebook budget**: la entrada no cupo en el **Token Budget** de ese único lorebook.
- **chat budget**: la entrada no cupo en el **Lorebook Token Budget** que abarca todo el chat.
- **lorebook and chat budgets**: ambos límites ya estaban llenos.

Expande una entrada omitida para ver más detalle. Muestra las palabras clave coincidentes, el tamaño estimado en tokens, y cuánto del presupuesto ya se había usado. Si lorebooks grandes se siguen omitiendo, **Active Context** sugiere los agentes **Knowledge Retrieval** o **Knowledge Router**. Estos suelen manejar mejor los lorebooks grandes que subir tus límites.

## Escaneo recursivo

Normalmente Marinara escanea solo tus mensajes recientes en busca de coincidencias de palabras clave. Con el escaneo **Recursive** activado, también escanea el texto de las entradas que acaban de activarse. Esto permite que una entrada activada atraiga entradas relacionadas cuyas palabras clave aparecen en su texto.

Actívalo en la pestaña **Overview** del lorebook.

1. Abre el lorebook.
2. Abre la pestaña **Overview**.
3. Activa el interruptor **Recursive**. Está desactivado de forma predeterminada.
4. Configura **Max Depth** (Profundidad máxima) si quieres cambiar hasta dónde llega el encadenamiento.

**Max Depth** (predeterminado **3**) establece cuántas pasadas de escaneo adicionales se ejecutan. Cada pasada examina las entradas recién activadas en busca de más coincidencias de palabras clave. Puedes ponerlo de **1** a **10**. Los valores más altos encuentran más trasfondo conectado pero usan más procesamiento.

La recursión también se activa por entrada. En el panel lateral expandido de una entrada, el interruptor **Recursion** (Recursión) controla si el contenido de esa entrada puede disparar más entradas. Está desactivado de forma predeterminada. Déjalo desactivado a menos que esa entrada deba encadenarse con otro trasfondo. Consulta [Entradas de lorebook: claves, posición y tiempo](entries.md) para ver todos los controles de entrada.

La recursión no evita tus presupuestos. Las entradas encontradas por una pasada recursiva siguen contando contra el **Token Budget**, el **Entry Limit** y el **Lorebook Token Budget** que abarca todo el chat, igual que cualquier otra entrada.

## Guías relacionadas

- [Entradas de lorebook: claves, posición y tiempo](entries.md)
- [Resumen de lorebooks](overview.md)
- [Fuentes de conocimiento: agentes Retrieval y Router](../agents/knowledge-sources.md)
