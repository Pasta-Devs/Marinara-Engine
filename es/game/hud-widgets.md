# Game Mode: widgets del HUD

Los widgets del HUD son pequeños paneles en los bordes izquierdo y derecho de la pantalla del juego. Registran cosas como una barra de salud, un contador de oro o el nivel de confianza de un aliado. HUD significa heads-up display (barra de estado en pantalla). Cada partida tiene sus propios widgets, distintos de los trackers del HUD de Roleplay (consulta [HUD y trackers de Roleplay](../roleplay/hud-and-trackers.md)).

Una partida puede tener hasta 4 widgets en total, repartidos entre el lado izquierdo y el derecho como prefieras. Los widgets solo se usan cuando **Custom HUD Widgets** (Widgets de HUD personalizados) está activado para la partida. Está activado de forma predeterminada en el asistente de configuración. Entonces el Game Master (GM) diseña un conjunto inicial mientras construye tu mundo.

## Tipos de widget

El GM elige un tipo para cada widget que crea. Tú puedes elegir los tipos cuando construyes widgets a mano.

| Tipo de widget | Qué muestra |
| --- | --- |
| **Progress Bar** | Una barra horizontal para un valor sobre un máximo, como salud o resistencia. |
| **Gauge** | Un dial de medio círculo para un valor sobre un máximo. |
| **Relationship Meter** | Una barra con marcadores de hitos y una etiqueta, ideal para la confianza de un NPC o un vínculo. |
| **Counter** | Un número grande, como oro, días transcurridos o bajas. |
| **Stat Block** | Una cuadrícula pequeña de campos con nombre y valores, como STR y DEX o una palabra de estado. |
| **List** | Una lista corta con viñetas de elementos de texto, como objetivos activos. |
| **Inventory Grid** | Una cuadrícula de ranuras de objetos, con pestañas de categoría opcionales y recuentos de objetos. |
| **Timer** | Un reloj de cuenta regresiva en minutos y segundos que puede descontar en vivo. |

## Revisar los widgets antes de que empiece la partida

Cuando existen widgets personalizados, hay un botón **Review Starting Widgets** (Revisar widgets iniciales) debajo de **Start Game** (Iniciar partida) en la pantalla del juego. Al hacer clic en él se abre la ventana **Review Starting Widgets** antes de empezar. Enumera cada widget inicial para que puedas ajustarlos antes de que la partida los fije.

1. Pulsa **Edit** (Editar) en un widget para cambiar sus valores iniciales o renombrar los campos de **Stat Block**.
2. Pulsa **Remove** (Quitar) para descartar un widget que no quieres.
3. Pulsa **Start Game** para comenzar a jugar con los widgets tal como se muestran. Pulsa **Back** (Atrás) para cerrar la ventana sin empezar.

Una ventana similar, **Prepare Next Session Widgets** (Preparar widgets de la próxima sesión), aparece cuando inicias una nueva sesión en una partida en curso. Tiene **Start Next Session** (Iniciar próxima sesión) en lugar de **Start Game**, y **Cancel** (Cancelar) en lugar de **Back**.

## Editar un widget durante el juego

El GM actualiza los valores de los widgets a medida que avanza la historia. Si omite una actualización, corrige el widget a mano.

1. Encuentra el panel del widget en el borde izquierdo o derecho de la pantalla.
2. Haz clic en el botón del lápiz (**Edit**) en el encabezado del widget.
3. Cambia los valores en la ventana del editor, por ejemplo el **Maximum value** (Valor máximo) de una barra.
4. Haz clic en **Save Changes** (Guardar cambios).

Haz clic en el encabezado del widget para plegar o desplegar su cuerpo.

## Mover y bloquear paneles

Los paneles de widgets están bloqueados en su sitio de forma predeterminada. Cada uno tiene un icono de candado en su encabezado.

1. Haz clic en el icono de candado para desbloquear el panel. Un contorno tenue muestra que se puede mover.
2. Arrastra el panel a un nuevo lugar.
3. Haz clic en el icono de candado otra vez para bloquearlo.

Para devolver un panel a su lugar predeterminado, haz doble clic en su icono de candado, o pulsa <kbd>R</kbd> mientras el icono está enfocado. Cada panel recuerda su posición y su estado de bloqueo por partida. Tu distribución no se traslada a otras partidas.

En un teléfono, los widgets se muestran como pequeñas píldoras en lugar de paneles completos. Toca una píldora para abrir ese widget y toca la X para cerrarlo.

## Construir tus propios widgets

Puedes diseñar los widgets tú mismo en lugar de dejar que el GM los cree. Abre el editor manual en cualquiera de estos lugares:

- En el asistente de configuración: activa **Custom HUD Widgets** y luego activa **Build Widget Setup** (Construir configuración de widgets). El editor aparece debajo.
- En una partida existente: abre **Chat Settings** (Ajustes del chat) y luego la sección **Widgets**.

1. Elige un tipo de widget del menú desplegable y pulsa **Add** (Añadir).
2. Define **Icon** (Icono: un símbolo corto o emoji), **Label** (Etiqueta), **Type** (Tipo), **Side** (Lado: **Left HUD** o **Right HUD**) y **Accent** (Acento: el color).
3. Rellena los campos de ese tipo: una barra usa **Value** (Valor) y **Max** (Máximo), un contador usa **Count** (Cuenta), una cuadrícula de inventario usa **Slots** (Ranuras) y **Contents** (Contenido), y un temporizador usa **Seconds** (Segundos) y **Running** (En marcha).
4. En **Chat Settings**, pulsa **Save Widgets** (Guardar widgets) para aplicar tus cambios. **Reset** (Restablecer) deshace las ediciones sin guardar.

El editor muestra cuántos de los 4 widgets permitidos has usado.

## Compartir widgets con importar y exportar

Puedes guardar una distribución de widgets en un archivo y cargarla en otra partida. El asistente de configuración y la sección **Widgets** de **Chat Settings** tienen estos botones.

1. Pulsa **Export Widgets** (Exportar widgets) para descargar tus widgets como un archivo JSON (un formato de datos de texto plano).
2. En otra partida, pulsa **Import Widgets** (Importar widgets) y elige ese archivo.
3. En **Chat Settings**, pulsa **Save Widgets** para que los widgets cargados se apliquen.

## Guías relacionadas

- [Game Mode: primeros pasos](getting-started.md)
- [HUD y trackers de Roleplay](../roleplay/hud-and-trackers.md)
