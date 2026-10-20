# Multijugador opcional

Seguimiento de implementación: [#6790](https://github.com/Pasta-Devs/Marinara-Engine/issues/6790). Este documento registra los límites de implementación y las pruebas exigidas. No afirma que el multijugador esté disponible ni que una plataforma haya superado las pruebas.

<a id="smallest-architecture"></a>

## Arquitectura mínima

Un anfitrión controla un chat compartido nuevo, el estado guardado del juego y sus conexiones de IA. Elige participantes humanos y de IA sin límite fijo de personas o tarjetas. Conversation, Roleplay y Game conservan sus modos. Una invitación nunca comparte un historial privado anterior.

El transporte elegido es un servidor HTTPS independiente con acciones JSON pequeñas y consultas largas limitadas. Fastify, Node HTTPS y Zod ya están instalados. WebRTC añadiría señalización, configuración ICE/TURN y problemas de duración de la pestaña anfitriona móvil; WebSocket exigiría otra dependencia de servidor y un analizador de streaming. Los chats privados compartidos reutilizan HTTPS sin esas adiciones. Es el único transporte de sala. El servidor registra solo operaciones de sala, nunca la API normal de Engine. La conexión es directa entre invitado y anfitrión, sin retransmisor central. Una invitación no permite acceder a los archivos, bibliotecas, ajustes, credenciales ni otros chats del otro participante. Mantén privado el puerto de administración de Engine; solo el puerto independiente de sala pertenece a la invitación.

El Engine de confianza del invitado se conecta al anfitrión. TLS debe validar la cadena del certificado y el nombre de host; la invitación fija además la huella del certificado del anfitrión. Comprueba esa vinculación antes de enviar contraseña o persona. No sigas redirecciones, cambies a HTTP, desactives la validación de certificados ni configures automáticamente el reenvío del router. El anfitrión configura dirección HTTPS y certificado con las funciones TLS existentes.

La vista del invitado usa código incluido de confianza en un entorno aislado de origen opaco, sin red, descargas, navegación, almacenamiento, puente nativo ni acceso administrativo. Un MessageChannel autenticado transporta solo proyecciones de sala validadas y un conjunto pequeño y explícito de acciones. El contenedor proporciona preferencias de presentación locales; los pares no pueden aportar estilos, recursos, código, URL para descargar ni llamadas API arbitrarias. El texto recibido se representa como texto. Los renderizadores enriquecidos existentes quedan fuera de este límite. El contenedor Android inyecta un puente nativo en cada frame y debe seguir sin admitir invitados hasta implementar un contexto sin puente y verificarlo en un dispositivo físico.

<a id="trust-boundaries"></a>

## Límites de confianza

| Límite | Aplicación |
| --- | --- |
| Administrador local al controlador de sala | Se mantienen Basic Auth, CSRF, validación de host y autenticación local nativa existentes. |
| Engine invitado al servidor del par | HTTPS, vinculación de huella, contraseña independiente, aprobación, sesiones aleatorias que caducan y solicitudes limitadas. |
| Par al invitado de confianza | Esquemas versionados estrictos en ambos receptores, proyección de texto, aislamiento de origen opaco y CSP restrictiva. |
| Participante al estado de chat/juego | Identidad y propiedad derivadas de la sesión autenticada; nunca aceptar roles, rutas o solicitudes de generación elegidos por el par. |
| Sala a generación y herramientas | Asignación de operaciones controlada por el anfitrión, bloqueo de generación existente, políticas explícitas de comandos/herramientas y barrera de preparación de Game. |
| Estado compartido al historial | Lista permitida de campos visibles; excluir credenciales, prompts de depuración, razonamiento, notas privadas, bibliotecas ajenas y estado oculto del GM. |

Un par autenticado sigue sin ser de confianza. El texto del prompt se conserva literalmente; la autorización se aplica en código, no escapando prompts ni pidiendo seguridad al modelo. El anfitrión y sus proveedores de IA pueden leer lo compartido. Como cualquier conexión directa, este diseño revela al anfitrión la IP del Engine que se conecta. Ningún otro dato del dispositivo o biblioteca del invitado forma parte del protocolo. No promete protección contra toda vulnerabilidad del navegador o sistema operativo.

<a id="activation-and-lifetime"></a>

## Activación y duración

`MULTIPLAYER_ENABLED=true` es un requisito que solo se aplica al reiniciar. Los valores ausentes, falsos o inválidos desactivan el multijugador. Se exige además una activación independiente en Settings; ninguno de los dos ajustes inicia la red. Alojar y unirse requieren acciones explícitas. Reiniciar nunca restaura una sala activa. Stop, Kick y Leave revocan las credenciales correspondientes e impiden acciones posteriores o entregas tardías.

Mientras cualquiera de las dos condiciones esté desactivada, no hay exploraciones de sesiones, comprobaciones de certificados, consultas de anfitrión/invitado ni tareas autónomas de sala. El servidor lee los indicadores y el cliente conserva una lectura de disponibilidad; las acciones explícitas de Settings pueden renovarla. Las solicitudes directas a la API desactivada se rechazan de forma segura. La limpieza de sesiones guardadas se aplaza hasta la activación, sin reanudar la red.

<a id="proof-before-enabling-the-feature"></a>

## Pruebas antes de activar

- Demostrar que texto malicioso de un par no puede ejecutarse, cargar recursos, navegar, descargar, alcanzar API locales ni invocar un puente nativo en el contexto de invitado compatible.
- Demostrar que condiciones desactivadas, admisión sin autenticación, propiedad, proyección de estado privado, tráfico limitado y revocación rechazan el acceso cuando corresponde.
- Reutilizar generación, comandos y autonomía mediante un único coordinador anfitrión. Publicar la tabla de compatibilidad por comando con restricciones explícitas.
- Demostrar que dos jugadores de Game producen una ronda solo después de que ambos envíen o pasen explícitamente; reintentos, desconexiones, cancelación y reinicio no pueden aplicar estado dos veces.
- Probar configuración, panel lateral, barra lateral y cuadro de escritura existentes en escritorio y móvil, con controles claros de Leave/Stop y recuperación. Registrar las pruebas pendientes en dispositivos físicos.

Los incrementos incompletos siguen desactivados. Los tres modos y sus límites de seguridad son necesarios antes de dar #6790 por terminado.

<a id="command-and-feature-compatibility"></a>

## Compatibilidad de comandos y funciones

Las acciones de sala pasan por el coordinador anfitrión autenticado. Esta tabla describe ese límite, no permiso para ejecutar comandos arbitrarios en otro equipo. El cuadro de escritura explica los comandos rechazados; el invitado nunca los ejecuta.

| Función | Quién llama y dónde se ejecuta | Resultado compartido y regla de ronda |
| --- | --- | --- |
| Mensajes humanos, `/send` | Participante admitido; el anfitrión crea un mensaje de usuario atribuido. `/send` suprime la respuesta automática. | Texto público. Conversation/Roleplay ordenan los envíos aceptados junto con la generación; un remitente ocupado conserva su borrador. Game envía solo mediante el recolector de ronda. |
| `/roll`, `/r`, `/dice` | Participante admitido; el analizador limitado y el lanzador de dados de Engine se ejecutan en el anfitrión. | Resultado de texto atribuido. En Game, la tirada sigue siendo la acción enviada por ese jugador hasta cerrar la ronda. |
| Generar, `/trigger` | Participante admitido; una reserva persistente de generación del anfitrión y el bloqueo existente. | Narración de IA guardada y filtrada. Game rechaza disparadores independientes; la preparación es el único disparador de resolución. |
| Otros comandos slash | No disponibles hasta auditar y añadir explícitamente su autorización de sala. | Sin inserción de rol de sistema, suplantación, navegación/edición de chats privados, tareas de galería, acciones de dispositivo ni comandos locales arbitrarios. |
| Respuestas de grupo | El anfitrión selecciona la lista de IA aprobada y se conserva la generación secuencial/Smart/manual. | La identidad de IA queda separada de las instantáneas de personas humanas. `{{user}}` usa la persona revisada del anfitrión, nunca la del último invitado que habló. |
| Horarios y autonomía de Conversation | Programador de servidor, lógica de candidatos/intenciones, esperas por enfriamiento y ocupación existentes; despacho mediante la misma reserva de sala. | Sin programador invitado. Salas detenidas/pausadas y Game no generan por temporizadores. Si no se observa una vista humana ni un par admitido durante 45 segundos, la autonomía se pausa. |
| Conversation `schedule_update`, `memory`, `react` | Manejadores de Engine existentes sujetos a la política de sala. | Cambios de horarios/memoria locales a la sala; las reacciones deben apuntar a este chat y no incluir imágenes personalizadas. Sin cambios globales de memoria de personaje o presencia. |
| Notas, recordatorios, tiradas y susurros de Roleplay | Analizador de comandos y manejador del anfitrión existentes; los ID aprobados identifican destinatarios. | Las notas privadas siguen privadas. Un susurro aparece solo en la instantánea filtrada del destinatario; el anfitrión conserva la propiedad de los datos guardados. Los agentes de la sala nunca leen susurros, ya que todos los participantes ven lo que generan. |
| Escenas entre chats y recordatorios del navegador | Restringidos porque su flujo normal crea/abre chats privados vinculados o usa temporizadores locales del navegador. | Describe escenas en el historial compartido; usa horarios de Conversation coordinados por el anfitrión para mensajes autónomos. Ningún comando recibido crea chats privados ni recordatorios locales. |
| Lorebooks y recuerdos | Libros adjuntos o de la sala revisados por el anfitrión y recuerdos de conversación locales a la sala. | Solo contexto del prompt, no exportaciones de biblioteca. Se excluyen libros globales implícitos, chats privados vinculados y recuerdos globales de tarjetas. |
| Rastreadores, dados, estado, resúmenes y variables de Engine | Listas permitidas explícitas en el ejecutor real de herramientas/agentes, no solo en prompts del modelo. | Se pueden proyectar campos públicos seguros; se ocultan salida de agentes sin filtrar, razonamiento, prompts de depuración y campos privados del GM. Los efectos de Game dependen de la reserva de ronda. |
| Acciones, elecciones, pruebas, inventario y fichas de Game | Configuración/inicio de Game por el anfitrión y mecánica de generación existente; efectos deterministas posteriores al turno se guardan una vez. | La propiedad de acciones humanas procede del participante autenticado. Las elecciones rellenan un borrador y nunca eluden la preparación de envíos. |
| Medios, herramientas personalizadas/de paquetes, Game Experiences e integraciones de dispositivo | No disponibles para generación de sala. | Sin archivos, imágenes, audio, video, estilos remotos, descargas, comandos nativos ni interfaz invitada aportada por paquetes. Requieren otro incremento de seguridad. |

El Game compartido inicial es el flujo sincronizado de narración/acciones. Las superficies tácticas/minijuegos solo del cliente, Game Experiences personalizados y la presentación de escenas/medios no se anuncian como funciones de invitado. Se reutiliza la configuración estándar de Game restringiendo expresamente esas opciones. No se carga un renderizador del anfitrión para cubrir carencias de compatibilidad.

<a id="recovery-and-limits"></a>

## Recuperación y límites

Cada participante autenticado tiene una secuencia de acciones monótona persistente y recibos de operaciones limitados. Un reintento devuelve el resultado anterior; una repetición sigue obsoleta después de salir su recibo de la caché de 128 entradas. Las instantáneas de persona de los mensajes nunca cambian cuando un jugador cambia de persona. Los nombres de personas humanas y de IA deben ser inequívocos para susurros y pruebas dirigidos.

Los nombres visibles y de persona son públicos, así que nunca demuestran quién ocupa un asiento. Un jugador que sale o deja de responder solo recupera su asiento anterior cuando su Engine presenta la clave privada de reincorporación de ese asiento: el token de sesión de la admisión que lo sentó por primera vez, enviado de nuevo como credencial bearer de la nueva solicitud de unión. Sin ella, una solicitud con los mismos nombres recibe un conflicto de nombre y las sesiones del asiento quedan intactas. Ambos Engines guardan la clave solo en memoria. Tras reiniciar el Engine invitado, el anfitrión elimina el asiento anterior antes de que ese jugador pueda volver a usar la misma persona.

Los cambios de persona en Game se aplican en el límite de la siguiente ronda. Fichas existentes, estadísticas actuales, propiedad del inventario y claves de privacidad de rastreadores siguen la identidad estable del participante; los mensajes históricos conservan su atribución. Si un NPC toma el nombre solicitado antes de ese límite, sigue activa la persona anterior y el jugador ve un conflicto de nombre. Pases, expulsiones, pausas y reanudaciones del anfitrión dejan eventos localizados en el mismo historial.

Game guarda participantes requeridos, cada revisión de envío y una reserva de resolución única en los metadatos existentes del chat. Recoger envíos y guardar mensajes atribuidos usa la cola de metadatos y después la transacción de almacenamiento. El trabajo del proveedor ocurre fuera de ella. Stop cancela la señal de operación de confianza; las escrituras tardías deben seguir coincidiendo con su reserva activa. Los turnos interrumpidos no se reintentan automáticamente. Reanudar explícitamente avanza al siguiente límite de recolección sin repetir efectos guardados. Una configuración fallida permanece en el vestíbulo para inspección/reinicio explícitos.

No hay límite fijo de participantes humanos o de IA. El protocolo versión 1 limita cada acción a 16 KiB, las instantáneas a 256 KiB y 100 mensajes recientes, y cada mensaje de texto a 8000 caracteres. Colas de aprobación, sockets, solicitudes, consultas largas, sesiones, derivaciones de contraseñas y trabajo de generación tienen límites. Hay una consulta de par activa por sesión y una de conector por Engine invitado. No se acepta compresión ni redirecciones. Contraseñas/tokens nunca aparecen en URL ni instantáneas compartidas.

Las salas grandes dependen de recursos del anfitrión, capacidad de conexión y contexto del modelo. Nunca se eliminan participantes silenciosamente para ajustar una actualización. Si esta excede el presupuesto de transporte, el invitado conserva el último estado válido y puede salir; el anfitrión puede seguir administrando y reducir los datos para recuperar las consultas.

<a id="verification-record"></a>

## Registro de verificación

Las pruebas automáticas usan almacenamiento desechable, una CA local de prueba y proveedores simulados. No modifican certificados, datos ni conexiones de IA del usuario.

- `multiplayer-peer-security.regression.ts`: comprobaciones TLS de cadena/nombre/huella antes de revelar datos por HTTP; respuestas malformadas, excesivas o con redirección y cancelación.
- `multiplayer-peer-server-security.regression.ts`: rutas solo de sala, límites de cuerpo/cabeceras/salida/frecuencia/concurrencia y cierre inmediato del servidor.
- `multiplayer-seat-key-security.regression.ts`: los nombres copiados o una clave de reincorporación incorrecta nunca ocupan un asiento ni reciben sus susurros; quien tiene la clave vuelve al mismo asiento, y la clave nunca llega a otros participantes ni a los datos guardados del chat.
- `multiplayer-room.regression.ts`: dos Engines, admisión, propiedad, historial filtrado, revocación/repetición, generación secuencial y rondas/recuperación de Game con dos jugadores.
- `multiplayer-session-flows.regression.ts`: dos Engines por HTTPS con generación y runtimes Game reales, proveedor simulado y rondas completas de Conversation, Roleplay y Game.
- `multiplayer-generation-policy.regression.ts` y `generation-output.regression.ts`: restricciones del ejecutor, exclusión de bibliotecas privadas, identidades locales al prompt, bloqueo compartido y semántica de finalización.
- `multiplayer-autonomy-security.regression.ts`: reutilización del programador, reloj de actividad de sala, autoridad única y carreras de Stop.
- `multiplayer-game-runtime.regression.ts`: configuración/inicio/introducción de Game, efectos deterministas, escrituras obsoletas y configuración interrumpida.
- `multiplayer-game-persona.regression.ts` y `multiplayer-game-projection.regression.ts`: migración de propiedad de persona, recuperación de colisiones, filtrado por audiencia y rastreadores públicos limitados.
- `e2e/multiplayer-guest-isolation.e2e.ts`: bundle invitado de producción con texto hostil e intentos de acceso local/de red/nativo en Chromium de escritorio, Chromium móvil y WebKit móvil.
- Casos de navegador específicos cubren advertencias de admisión, Players, vestíbulo de Game, diseños táctiles, claro/oscuro y borradores/reintentos.

Antes de fusionar, repite `pnpm check`, las regresiones Node pertinentes, `pnpm regression:prompt`, `pnpm smoke:ui` y la matriz de navegador específica contra el candidato final. Registra resultados reales y revisión en el PR, completa CodeRabbit y una revisión de seguridad específica, y verifica dispositivos físicos compatibles. Emular un navegador no prueba un iPhone/iPad físico en pantalla de inicio ni Android real. El contenedor nativo Android sigue desactivado como invitado. Las pruebas físicas están pendientes hasta registrarse; no deduzcas compatibilidad de una configuración de viewport.

El invitado se compila como IIFE clásica porque cargar módulos ES desde un origen opaco exigiría relajar CORS. El inicio de producción y desarrollo compila los recursos locales fijos del invitado; tras editar su código con el servidor de desarrollo abierto, ejecuta `node packages/client/scripts/build-multiplayer-guest.mjs` y recarga la vista. La comprobación de integridad del lanzador incluye ambos recursos aislados.

Seguimiento de traducción: [#6854](https://github.com/Pasta-Devs/Marinara-Engine/issues/6854).
