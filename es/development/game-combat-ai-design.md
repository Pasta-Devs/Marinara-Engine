# IA de combate de Game Mode: enemigos, compañeros y jefes GM

**Estado: la IA ordinaria y la primera implementación de jefes GM/reacciones están presentes localmente; Summoning y los sistemas de reglas con nombre siguen siendo propuestas.** Preparado el 17 de septiembre de 2026 a partir del combate incorporado a staging por [PR #6266](https://github.com/Pasta-Devs/Marinara-Engine/pull/6266). Base original auditada: `1f2e965c34f77b19a1457439f61e291300e163c7`; el checkout `025442b1722b090b4640e0f078d1e08a4435f965` tenía la misma implementación pertinente. La implementación local actual parte de staging `abe61d30a`. Revisa staging antes de continuar; los números de línea de la auditoría corresponden a la base anterior.

Este documento permite continuar el desarrollo sin la conversación original. Registra requisitos de la mantenedora, auditoría del código, valores recomendados, límites y escenarios de aceptación. Las cifras y campos propuestos fuera del alcance implementado de la sección 13 no son contratos existentes ni equilibrio demostrado en partidas. La implementación y las guías son trabajo local; no se ha enviado ningún issue ni PR.

## Actualización del alcance del 17 de septiembre

La mantenedora aprobó IA ordinaria en Classic y Tactical con control opcional de compañeros por IA, y luego autorizó el trabajo de jefes GM/reacciones. Los jefes creados explícitamente pueden usar acciones legendarias sin depender de elegir reglas 5e. El GM recibe hojas y recursos de combate del grupo y puede prever acciones probables al comenzar una activación. Reacciones que consumen recursos, como Counterspell, exigen una decisión del controlador, no uso incondicional. Summoning sigue siendo una extensión de diseño. Se conservan la auditoría original y el diseño completo; las secciones 13–17 contienen las decisiones actuales y sustituyen la secuencia exclusiva de Tactical, la propuesta inicial de ocho adjetivos, las declaraciones de alcance solo exploratorio y el prompt (las instrucciones enviadas a la IA) original del jefe limitado al estado observado.

El trabajo ejecutable es una primera política de utilidad, no todos los escenarios de aceptación. Sus límites están en las secciones 13 y 16. La [guía de implementación de reglas](game-combat-rulesets-implementation.md) trata ataques adicionales por velocidad Traditional, orden de turnos/movimiento, reservas de recursos y futuros perfiles específicos por edición.

## 1. Lo que pidió la mantenedora

- Enemigos ordinarios con comportamiento del motor descrito por **un adjetivo y un rol de combate**, como Reckless Bruiser o Cautious Spellcaster.
- **Solo los enemigos de nivel jefe reciben control del GM por turno.** El motor sigue determinando acciones legales y resultados. Se eligen acciones durante la lucha, no solo un guion previo.
- La asignación pondera competencia/nivel, rol y personalidad conocida, con algo de azar. Los experimentados deben tener más frecuentemente hábitos adecuados al rol, sin volver idénticos a todos los veteranos.
- **Todo Beast y Monstrosity es Mindless.** Persigue al miembro más cercano del grupo por la ruta legal más corta, ignorando salud del objetivo y ventajas/desventajas del terreno. No excluyas silenciosamente a jefes o criaturas con nombre.
- Prioriza diversión estratégica, comportamiento plausible y variedad entre partidas, sobre todo en juego táctico y futuro juego similar al de mesa. El cambio de IA no exige implementar 5e o V20.
- Conserva un diseño detallado para después. El alcance exploratorio original se amplió a IA ordinaria y control de compañeros; consulta la actualización anterior.

El [plan de combate](game-combat-roadmap.md) separa reglas del campo, participación del grupo/invocaciones y perfiles de reglas de mesa. La táctica enemiga también debe ser independiente. Summoning queda para más adelante.

### Valores recomendados aún pendientes de aceptación

1. Empieza con ocho adjetivos: Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly.
2. Muestra adjetivo y rol al inspeccionar enemigos, con explicación breve. No muestres probabilidades, pesos de utilidad ni análisis bruto de personalidad en la interfaz normal.
3. La ruta más corta de Mindless significa **menos pasos espaciales legales**, no menor costo de terreno. Puede cruzar un bosque corto aunque una ruta abierta más larga sea más rápida. El movimiento sigue pagando su costo real.
4. Un jefe Beast/Monstrosity sigue siendo Mindless. El GM solo elige acciones compatibles con su objetivo y persecución obligatorios.
5. Sortea y guarda el perfil ordinario una vez. Un NPC recurrente conserva su temperamento; subir de nivel no vuelve a sortear personalidad.
6. Implementa IA ordinaria en Tactical y Classic conjuntamente según el alcance revisado. El sistema completo incluye turnos reales de jefes GM; un hito solo del motor no es toda la función.

## 2. Auditoría previa a la renovación

La segunda hipótesis de la mantenedora se aproxima más: cada motor activo tiene una política automática común. El GM crea el encuentro, pero no elige turnos individuales en las interfaces de combate activas de Game Mode.

| Área                    | Classic Game Mode                                                         | Tactical Game Mode                                                            |
| ----------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Orden              | Tiradas de iniciativa más velocidad; participan todos                   | Por iniciativa en juegos nuevos (una unidad cada vez, un orden tirado una sola vez, combat C6c); por bandos en los antiguos (fase del jugador, luego enemigos por velocidad) |
| Política enemiga            | Heurística común de habilidades; si no, rival vivo aleatorio           | Curar primero, ataque puntuado y acercamiento                        |
| Clases       | Sin política específica de clase                                         | Seis clases cambian alcance, movimiento y crítico; comparten política |
| Personalidad/competencia | Sin modelo táctico o de entrenamiento guardado                          | Sin modelo táctico o de entrenamiento guardado                              |
| Jefes          | Política ordinaria más mecánicas de guion admitidas                   | Política ordinaria; etiqueta afecta colocación/interfaz                         |
| GM en cada turno     | Fuera del resolutor activo                                                | Fuera del resolutor activo                                                    |
| Reproducibilidad         | Decisiones/tiradas aleatorias sin semilla                                      | Semilla y contador de acciones rigen decisiones y tiradas                   |
| Persistencia             | Cliente restaura instantánea; ronda/animación no se guardan por completo | Cliente guarda instantánea táctica completa en metadatos del chat               |

Existe otro sistema de ventana de encuentro con la ruta `/encounter/action` dirigida por modelo y tipos de acciones de combate. Lo usa el `EncounterModal` del chat general mediante `useEncounter`, no el `GameCombatUI` actual. El modelo puede devolver estado reescrito; no lo reutilices sin cambios para controlar jefes con validación del motor. Rastrea consumidores reales antes de reutilizar o eliminar.

La maniobra explícita **Special** (Especial) de Classic pide al GM resolver una acción narrativa y admite etiquetas compatibles de estado/elemento. No resuelve una ronda ordinaria ni elige turnos rutinarios enemigos. Conserva la distinción al cambiar prompts: controlar solo turnos de jefes no prohíbe generar encuentros, arbitrar narrativa ni narrar después del combate.

### Política Classic

En `combat.service.ts`, `resolveCombatRound` llama `chooseAutoSkill` para aliados automáticos y enemigos:

1. La habilidad es usable si hay MP suficiente y la recarga pasa una comprobación de módulo de ronda.
2. Cura al aliado elegible más herido si tiene como máximo 75% HP y hay curación disponible.
3. De lo contrario, con 45% de probabilidad elige una habilidad no curativa y un enemigo aleatorios.
4. Si no, ataca a un rival aleatorio.

Los enemigos solo pasan a sí mismos como lista aliada, así que esta política no cura a otros enemigos. Las habilidades no curativas incluyen mejoras además de ataques/debilitaciones; cualquier sustitución debe validar el bando objetivo de cada habilidad. En la práctica, la omisión de MP descrita abajo impide usar habilidades con costo positivo y deja ataques básicos aleatorios. La orden del jugador llega al primer combatiente vivo de su bando; los demás aliados actúan automáticamente. Cambiar táctica enemiga no debe cambiar silenciosamente control de compañeros o identidad del jugador.

Las mecánicas generadas se procesan por separado tras las acciones normales. Solo se ejecutan `round_interval` y `hp_threshold`; los disparadores aceptados `on_hit`, `on_attack` y `passive` no. Los umbrales HP se repiten en rondas posteriores válidas y `damage_one` elige al primer objetivo contrario. No es un GM eligiendo en vivo. Distingue efectos únicos y recurrentes antes de adaptarlos.

Classic también resuelve habilidades no curativas por una ruta orientada a daño; mejoras/debilitaciones no equivalen al apoyo Tactical, aunque un impacto puede aplicar un estado. Semántica real de apoyo/control y recargas por uso son requisitos para anunciar ese comportamiento. Defender/esperar automáticamente también requiere soporte; defender pertenece ahora a la posición de iniciativa del jugador, por lo que enemigos más rápidos actúan antes. La dificultad escala daño de ambos bandos mediante el resolutor común, no calidad de decisión. Conserva o cambia eso aparte del temperamento.

Otra discrepancia merece prueba propia: si la posición cero está KO, el servidor transfiere órdenes al primer aliado vivo, pero la interfaz conserva el índice activo cero. Una habilidad no disponible puede convertirse en ataque básico. Regístralo/corrígelo aparte del temperamento enemigo.

### Política Tactical

Actualmente `packages/shared/src/features/tactical-combat/ai.ts`:

1. Intenta la primera curación lista sobre el aliado con menor fracción HP a dos casillas o menos, si está en 60% HP o menos. No se mueve antes al alcance.
2. Evalúa destinos alcanzables frente a rivales vivos, considerando ataques básicos y habilidades listas.
3. Puntúa ataques con `1000 * likelyKill + expectedDamage - 0.75 * counterRisk`. likelyKill significa daño previsto suficiente para el HP actual y al menos 50% de impacto, no muerte garantizada.
4. A veces cambia el mejor ataque no letal por otro legal aleatorio: 60% casual, 30% normal, 10% hard, 0% brutal. La aceptación de curar es 50%, 80%, 100%, 100% respectivamente.
5. Sin ataque disponible, se acerca al rival más próximo por Manhattan mediante la casilla alcanzable más próxima según esa distancia. No busca la ruta más corta de toda la cuadrícula y puede atascarse ante obstáculos.

El terreno afecta movimiento y previsiones de daño/impacto, pero no hay valoración general de exposición durante la siguiente fase del jugador. No selecciona deliberadamente mejoras, debilitaciones, defensa ni objetos. El alcance de habilidades está simplificado. Las descripciones AoE generadas no constituyen un resolutor espacial completo.

Las clases son Fighter, Knight, Rogue, Archer, Mage y Healer. Se derivan de una indicación explícita, curaciones, palabras clave de nombres/habilidades, ataques elementales y heurísticas de estadísticas. Una etiqueta de rol no crea capacidades.

### Carencias que debilitarían un sistema de personalidad

Son hallazgos de inspección, no reproducciones ejecutadas en navegador:

| Carencia                                                     | Evidencia y consecuencia                                                                                                                                                    | Siguiente paso acotado                                                                                                                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Enemigos generados sin MP                            | `generatedEnemyToCombatant` omite MP/maxMP; las habilidades no básicas generadas cuestan MP positivo. Ambos motores tratan ausencia como cero y no pueden usarlas. | Prueba de hidratación real del esquema; conserva recursos explícitos o aplica una regla documentada. No concedas hechizos ilimitados. |
| Nivel inferido del HP                               | Suele derivarse de maxHP/20 redondeado. Resistencia no significa entrenamiento táctico.                                                       | Indicación acotada de competencia; nivel solo como alternativa declarada hasta disponer de perfiles.                                                  |
| Identidad heurística de jefe                              | Tactical etiqueta al más fuerte de grupos de al menos dos por maxHP + level\*10 + attack. Nunca etiqueta a uno solitario.                               | Identidad explícita por enemigo. La categoría musical no identifica quién recibe turnos GM.                                                               |
| Mecánicas generadas de jefe no llegan a Tactical          | Classic recibe propiedades de mecánicas; Tactical no consume la lista.                                                                                       | Operaciones tácticas validadas con fases/disparadores guardados. Identifica lo no admitido sin narrarlo como ejecutado.          |
| Tipo y personalidad sin contrato ejecutable | La descripción está en el esquema, pero se pierde al hidratar; Beast/Monstrosity no son categorías tipadas.                                                | Lleva categoría y entradas acotadas por todas las conversiones y límites de persistencia.                                                                 |
| Visión y cobertura Tactical compartidas (combat C6)        | Un muro o una montaña bloquea la visión tanto en combates nativos como de conjunto de reglas, y la cobertura se gradúa con la misma prueba (media, tres cuartos): previsiones, acciones, contraataques, áreas, reacciones, superposiciones de amenaza y la IA usan `hasLineOfSight` y `coverTier`. | Mantén una sola prueba de visión y una sola prueba de cobertura para todos los llamadores.                                                                                                                 |
| Previsiones de candidatos de la IA leen la casilla candidata        | Ambas IA prevén un ataque, y el contraataque que arriesgan, desde la casilla desde la que golpearían, así que la cobertura (combat C6a-2) se pondera tal como se tirará. | Mantén previsiones y resolución sobre el mismo `hitChance`.                                                                                                                      |

Otra pérdida afecta a ambos motores: el tipo de ataque se infiere de palabras inglesas en nombre/descripción, aunque el encuentro puede generarse en otro idioma. La bandera `AoE`/`both` tampoco se convierte en múltiples objetivos reales. Campos explícitos validados deben alimentar futuros roles; una traducción no debe decidir si un hechizo cura o ataca.

No añadas una reescritura completa a estos requisitos. Aporta pruebas mínimas, corrige el flujo pertinente y reutiliza movimiento, previsiones, disponibilidad y resolución.

## 3. Separa capacidad, temperamento y control

Cada enemigo necesita respuestas distintas:

| Dimensión           | Significado                                          | Ejemplo                                                                |
| ------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| Categoría   | Aplica reglas obligatorias de tipo                      | Beast fuerza Mindless                                                  |
| Rol                | Para qué sirve su conjunto real de capacidades           | Supporter tiene curación/mejoras usables                            |
| Temperamento         | Qué valora al elegir opciones legales | Cautious valora evitar peligro                                  |
| Competencia         | Consistencia al ejecutar hábitos          | Un Reckless Bruiser veterano sigue arriesgando, pero desperdicia menos acciones |
| Controlador          | Quién elige                           | Motor para ordinarios; GM para jefes explícitos                    |
| Objetivo del encuentro | Qué intenta el bando               | Derrotar al grupo ahora; proteger/escapar/capturar después                         |

Usa inicialmente un adjetivo principal. No añadas combinaciones arbitrarias, editor de vectores de personalidad, dependencias de árboles de conducta ni un marco general de planificación. Basta una tabla pequeña de perfiles sobre candidatos legales compartidos.

### Roles basados en capacidades

Conserva las clases tácticas como presets (ajustes guardados) de geometría/estadísticas. Un mapeo pequeño puede afinarlas si sus capacidades lo justifican:

| Rol propuesto | Evidencia                                | Trabajo habitual                                          | Adjetivos probables                    |
| ------------- | -------------------------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| Bruiser       | Ataques cercanos fuertes                         | Acercarse e intercambiar daño                               | Reckless, Disciplined, Opportunistic |
| Bulwark       | Capacidades resistentes cuerpo a cuerpo                                  | Mantener posición útil cerca de aliados vulnerables        | Protective, Disciplined, Cautious    |
| Skirmisher    | Movilidad y daño cercano útil            | Elegir enfrentamientos favorables                           | Opportunistic, Cautious, Reckless    |
| Marksman      | Ataques sostenidos a distancia, quizá alcance mínimo | Mantener distancia de tiro útil                    | Cautious, Disciplined, Opportunistic |
| Spellcaster   | Magia ofensiva usable y su reserva       | Presión a distancia sin desperdiciar habilidades limitadas | Cautious, Disciplined, Opportunistic |
| Controller    | Debilitaciones/control usables                     | Debilitar amenazas relevantes                             | Disciplined, Opportunistic, Cautious |
| Supporter     | Curación/mejoras usables                            | Mantener eficacia del grupo                             | Supportive, Protective, Cautious     |

Son tendencias previas, no prohibiciones. Deben ser posibles Cowardly Fighter o Reckless Spellcaster. Un Cleric blindado con combate cercano puede ser Bulwark; un sanador puede preferir retaguardia. No derives temperamento solo del estereotipo de clase. Agotar MP temporalmente cambia acciones legales, no rol/adjetivo guardados. No asignes Supportive a quien nunca tuvo apoyo.

## 4. Catálogo de adjetivos

### Los ocho iniciales

| Adjetivo         | Objetivo preferido                                                             | Posición y riesgo                                                                                    | Habilidades/recursos                                                                                      | Qué puede aprender el jugador                                   |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Mindless**      | Miembro vivo alcanzable más cercano según sección 6               | Ruta espacial legal más corta; ignora utilidad del terreno, exposición y formación                           | Ataque simple legal al objetivo; sin priorizar curaciones, fuego concentrado ni recursos                   | Atráelo con cercanía, terreno y pasos estrechos             |
| **Reckless**      | Daño inmediato y presión alcanzable; no siempre el más débil | Se acerca agresivamente; tolera contraataques y exposición                                  | Gasta ataques fuertes disponibles; rara vez se detiene a defender                                             | Castiga su avance excesivo y provoca intercambios desfavorables            |
| **Cautious**      | Amenazas alcanzables limitando daño recibido                          | Destinos seguros, alcance útil, terreno defensivo                                            | Conserva recursos escasos si el básico sirve casi igual; cura/defiende si hace falta                | Presiona el espacio seguro y su reticencia a comprometerse   |
| **Opportunistic** | Heridos, expuestos o debilitados; remates fiables   | Acepta cierto riesgo por una apertura concreta                                                                | Valora habilidades que crean o explotan la apertura                                                      | Protege vulnerables y niega remates fáciles   |
| **Protective**    | Amenazas a un aliado vulnerable designado o grupo cercano          | Distancia de apoyo; bloqueo posicional legal útil                                    | Defensa/apoyo para preservar al protegido; ataca si proteger no urge              | Separa al grupo o entra desde varias direcciones   |
| **Supportive**    | Salud aliada y mejoras útiles antes de daño propio                           | Se mueve al alcance legal sin exposición innecesaria                                        | Cura HP faltante significativo; evita sobrecurar y mejoras duplicadas; ataca si apoyar aporta poco | Presiona al apoyo o sepáralo de sus beneficiarios |
| **Disciplined**   | Objetivos eficaces para el rol y remates sensatos                      | Equilibra daño, seguridad, posición y recursos; compromiso moderado                            | Fundamentos fiables sin especializarse en extremos                                               | Interrumpe su rol y fuerza elecciones malas              |
| **Cowardly**      | Objetivos seguros sin represalias                       | Se preserva más al estar herido o superado localmente; retrocede hacia aliados seguros | Se cura/defiende antes y evita compromisos costosos                                                | Corta retirada segura y mantén presión a distancia    |

Protective no redirige daño, provoca, intercepta ni obtiene reacciones por magia. La ocupación actual permite bloquear posiciones; mayor protección exige habilidades reales. Cowardly puede retroceder/defender, pero `flee` de Tactical termina toda la batalla. **Nunca uses la huida global como escape de un enemigo.** Retirada/rendición individual requiere reglas explícitas nuevas.

Cautious y Cowardly deben divergir: un Cautious Marksman sano toma buena posición; uno Cowardly herido puede renunciar al tiro para sobrevivir. Protective protege una persona/posición; Supportive maximiza acciones de apoyo útiles.

### Ampliación solo con conducta distinta y pruebas

| Adjetivo   | Conducta distintiva                                                                                         | Requisito de publicación                                                                |
| ----------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Vengeful    | Sigue al último agresor o asesino observado de un aliado aunque otro objetivo sea algo mejor | Memoria pequeña persistida; cambio legal si el objetivo no está disponible      |
| Patient     | Mantiene una posición valiosa hasta que el enemigo entra en buen alcance                                          | Reglas acotadas de espera/enfrentamiento y protección contra espera infinita           |
| Predatory   | Acecha objetivos aislados y entra cuando hay apertura                                              | Métrica de aislamiento; nunca anula Mindless obligatorio de Beast/Monstrosity           |
| Fanatical   | Sacrifica seguridad por ritual, líder o misión explícitos                                               | Objetivos con progreso visible y condiciones de fracaso                     |
| Methodical  | Prepara una secuencia admitida de debilitación/ataque                            | Dependencias explícitas, memoria acotada y diferencia clara de Disciplined |
| Coordinated | Considera intenciones aliadas y reduce redundancia                                      | Intención grupal acotada, sin coordinación perfecta omnisciente                          |
| Territorial | Defiende ubicación y deja de perseguir fuera del límite                                                    | Territorio/objetivo guardado y retirada legible                       |
| Deceptive   | Usa fintas, señuelos u ocultación reales                                              | Mecánicas de engaño/percepción; la narración sola no crea efectos     |

Evita sinónimos con idéntica puntuación. Cruel equivale sobre todo a Opportunistic salvo objetivos distintos admitidos. Reserva Strategic para planificación acotada real, no para "mejor en todo". Valentía e inteligencia no son extremos opuestos obligatorios.

## 5. Asignación: rol, experiencia, personalidad y variedad con semilla

### Prioridad

1. Valida categoría explícita. Beast o Monstrosity fuerza Mindless sin importar nivel, personalidad, dificultad o jefe. Descarta indicaciones contradictorias generadas y registra procedencia. Rechaza perfiles resueltos explícitos/importados contradictorios con error útil; no reescribas silenciosamente una elección guardada.
2. Conserva un perfil válido resuelto al reanudar. Conserva el temperamento de un NPC recurrente conocido si hay identidad estable.
3. Respeta perfiles creados para otras criaturas compatibles con capacidades. Datos explícitos no admitidos o contradictorios dan error claro; datos ausentes usan valores predeterminados.
4. Resuelve rol de capacidades reales, con indicación validada para conjuntos ambiguos.
5. Calcula competencia, tendencias de rol y ajustes de personalidad acotados.
6. Sortea un perfil ponderado con semilla y guarda resultado y versión de política.

Mindless queda inicialmente fuera del sorteo ordinario. Futuros muertos vivientes/constructos creados pueden usarlo, pero se impone siempre a Beast/Monstrosity. Para enemigos antiguos sin categoría usa `unknown`; un nombre con "beast" no es una declaración taxonómica.

### Competencia no es HP, dificultad ni valor moral

Prefiere entrenamiento del perfil de reglas o datos fiables de la hoja NPC; después, una indicación explícita validada del encuentro. Solo usa nivel si faltan ambos y registra la fuente. El nivel actual derivado de HP es una alternativa débil, no una medida autorizada de inteligencia.

Inicialmente, novice/trained/veteran/master podría corresponder a `c = 0, 0.35, 0.7, 1`. Propuesta provisional por nivel Engine: 1–2 novice, 3–7 trained, 8–14 veteran, 15+ master. Es una curva ajustable de diseño, no regla de mesa; marca `level-fallback`, sobre todo si procede de HP. Fija el mapeo a la versión y sustitúyelo por perfiles cuando existan. No equipares challenge rating 5e a nivel de personaje ni impongas una sola escala a juegos tipo V20.

La experiencia influye **tanto** en la probabilidad inicial de temperamento adecuado como en su ejecución consistente. La IA local ordinaria no descubre habilidades ocultas ni órdenes en cola. Los jefes GM tienen conocimiento más amplio según sección 16; ninguno ve tiradas futuras o elecciones sin confirmar. La supervivencia del veterano es un sesgo útil para construir mundo, no una ley de que todos los magos veteranos sean cautelosos.

### Modelo concreto de ponderación

Usa una tabla pequeña y una fórmula acotada. Valores iniciales de ejemplo sujetos a pruebas:

```text
w[a] = baseRoleWeight[role,a] * exp(1.2*c*roleAffinity[role,a] + 1.5*q*personalityMatch[a])
P[a] = 0.94 * w[a]/sum(w) + 0.06/N
```

- `c`: competencia, 0..1.
- `roleAffinity`: ajuste creado de -1..1; algunas personalidades sirven a varios roles.
- `personalityMatch`: evidencia acotada de -1..1, no números libres del modelo.
- `q`: confianza en personalidad conocida, 0..1; cero si se desconoce.
- `N`: número de adjetivos compatibles; elimina incompatibles antes de normalizar. Si no queda ninguno, usa una alternativa Disciplined/básica validada y registra el problema.
- La mezcla del 6% da una oportunidad pequeña a cada perfil compatible infrecuente. Nunca debilita reglas duras de tipo.

Ejemplo de **mago versátil con apoyo**, sin evidencia de personalidad:

| Adjetivo     | Peso base | Afinidad de rol | Probabilidad novice | Probabilidad master |
| ------------- | ----------- | ------------- | ------------------ | ------------------ |
| Cautious      | 4           | 1             | 23,0%              | 35,8%              |
| Disciplined   | 4           | 1             | 23,0%              | 35,8%              |
| Opportunistic | 3           | 0,5           | 17,4%              | 15,2%              |
| Supportive    | 1           | 0             | 6,4%               | 3,5%               |
| Protective    | 1           | 0             | 6,4%               | 3,5%               |
| Reckless      | 2           | -1            | 11,9%              | 2,4%               |
| Cowardly      | 2           | -0,5          | 11,9%              | 3,7%               |

El redondeo puede impedir sumar exactamente 100%. Una personalidad temeraria conocida aumenta Reckless incluso con gran competencia. No vuelvas a sortear el adjetivo de un NPC con nombre al cambiar de nivel. Las cifras ilustran tendencias, no equilibrio final.

### Extraer personalidad sin llamar al modelo en cada turno ordinario

Usa la generación de encuentros existente para interpretar la personalidad conocida en hasta tres indicaciones de enumeración cerrada, cada una con confianza baja/media/alta y referencia de fuente acotada. Ejemplos: leal, busca riesgo, se preserva, compasivo, paciente. El motor las convierte a pesos. No pidas probabilidades arbitrarias ni código ejecutable.

Usa personalidad realmente conocida. "Un mago con cicatrices" no demuestra cautela. Importa la negación: "no es cobarde" no debe aumentar Cowardly. Prueba descripciones multilingües y contradictorias. Si falta la extracción o es inválida/no admitida, no ajustes personalidad: bastan rol, competencia y RNG. Coincidir palabras clave no equivale a entender significado.

Guarda indicaciones/procedencia aceptadas para explicar la asignación, no transcripciones de razonamiento. La identidad NPC estable debe venir de referencias de entidad, no solo nombres visibles. Monstruos anónimos repetidos pueden recibir nuevos perfiles por encuentro; personajes recurrentes requieren perfiles ligados a identidad antes de prometer consistencia entre sesiones.

### Límites de aleatoriedad

- Deriva la semilla de asignación de la semilla del encuentro, ID estable del enemigo y versión. Separa su dominio del terreno y las tiradas.
- No consumas RNG de combate al enumerar/puntuar candidatos o mostrar previsiones.
- Guarda el perfil resuelto. Recarga, reintento, importación, punto de control y reinicio de la misma batalla no deben sortear otro temperamento.
- Encuentros/semillas nuevos pueden variar composición y perfiles. Un sorteo explícito debe crear una revisión, no alterar secretamente la lucha actual.
- Tactical comparte ahora un cursor con semilla para decisiones y resultados. Cambiarlo exige versión de comportamiento: conserva políticas antiguas en curso o aporta migración explícita probada.
- El resolutor sin semilla de Classic requiere otro adaptador RNG/persistencia antes de prometer repetición exacta.

## 6. Mindless: contrato exacto de persecución

Es una regla solicitada del proyecto para Beast/Monstrosity, no una afirmación sobre reglas oficiales de mesa o conducta animal real.

### Objetivo y ruta

1. Considera miembros vivos del grupo y posiciones legales desde donde el ataque simple designado puede alcanzar a cada uno. La casilla ocupada del objetivo no es destino legal.
2. Para caminar, busca rutas legales mínimas en **pasos de cuadrícula**, sin recargo de terreno al clasificarlas. Muros, agua y montañas siguen bloqueando al caminante normal. Se pueden atravesar aliados según reglas actuales; nunca terminar en posición ocupada.
3. Prefiere quien requiera menos pasos hasta posición legal de ataque. En empate, cercanía espacial, después ID estable y orden de coordenadas. No desempates por HP, defensa, evasión, clase o daño previsto.
4. Sigue la ruta hasta donde permita el presupuesto real de esta activación. El bosque sigue costando dos puntos. Elige la parada legal libre más lejana sobre esa ruta, no un desvío barato con ventaja táctica.
5. Si queda en alcance legal, usa el ataque simple contra ese objetivo; si no, espera tras moverse. El básico es predeterminado; al crear puede designarse un ataque innato característico validado. No busques la habilidad de mayor daño ni cambies objetivo para agrupar AoE.
6. Recalcula en la próxima activación con la cuadrícula actual. Si se bloquea la ruta, busca otro objetivo alcanzable. Sin ninguno, espera: nada de atajos ilegales o bucles infinitos.

Se busca un perseguidor deliberadamente simple, no una falla de rutas. Una pared en U puede exigir alejarse temporalmente por Manhattan. Buscar toda la cuadrícula debe encontrar el rodeo.

**Ejemplo:** A requiere tres pasos legales de bosque; B cinco de llanura. Mindless elige A aunque cueste más movimiento. Recibe normalmente defensa/evasión del bosque si termina allí y paga su costo. Cautious puede preferir el bosque defensivo deliberadamente; Mindless obtiene la misma ventaja de forma incidental.

Vuelo y teletransporte usan sus contratos reales. Volar cruza suelo bloqueado y ocupaciones, y permite suspenderse sobre terreno normalmente intransitable; teletransporte cruza obstáculos intermedios pero exige aterrizaje legal. Ninguno termina en casilla ocupada. Su métrica actual es Manhattan, no "un salto a cualquier lugar". La persecución con varios turnos de teletransporte necesita una ruta de aterrizajes legales alcanzables; no elijas un objetivo aparentemente cercano tras un hueco mayor que todos los saltos posibles. Defensa/evasión del terreno siguen aplicándose a todos los modos.

No implementes permisos paralelos sutilmente distintos solo para Mindless. Extrae/reutiliza predicados de movimiento. La preferencia puede ignorar costo; la ejecución mantiene legalidad y costos normales.

### Exclusiones duras y prioridad de jefe

Mindless no elige por HP, optimiza remates, busca cobertura, coordina fuego, cura aliados, huye por miedo ni cambia a una clase más valiosa. Dificultad y competencia no pueden recuperar esas conductas.

Para un jefe Mindless, limita candidatos GM al objetivo y persecución elegidos, con opciones legales características/de fase que no eludan límites. Si queda una sola acción, ejecútala localmente sin llamada inútil. Una futura excepción para jefes Beast/Monstrosity inteligentes sería un cambio de producto acordado con la mantenedora, no comodidad de implementación.

Classic no tiene distancia espacial y no puede cumplir literalmente "más cercano por ruta mínima". La adaptación propuesta usa un orden de enfrentamiento guardado con semilla, sin pesos de HP/terreno, y el primer objetivo vivo. **La implementación no espacial revisada usa esta abstracción** y debe decirlo; no satisface el requisito espacial exacto. No la llames distancia: una regla real de proximidad requiere formación/posiciones futuras. Una formación delantera/trasera podría aportar eso; el orden del arreglo no se convierte silenciosamente en distancia. La ruta Tactical sigue siendo la conducta normativa propuesta.

## 7. Decisiones ordinarias

### Reutiliza la resolución; cambia prioridades

Genera primero acciones legales y luego puntúa con pesos de rol/adjetivo. Reutiliza movimiento, previsión y disponibilidad; añade la función mínima de legalidad compartida que necesitan IA y GM. No llames al mutador `performUnitAction` con entrada del modelo sin validar.

Los candidatos deben incluir:

- Ataque básico y habilidades usables, con destinos legales de mover y actuar.
- Curaciones, mejoras y debilitaciones sobre el bando correcto, incluido moverse al alcance.
- Defender, esperar y movimiento intencional sin ataque/apoyo útil.

Incluye solo mecánicas realmente resueltas. Objetos enemigos necesitan inventario/contabilidad reales. La puntuación no inventa geometría AoE, invocaciones, provocaciones, reacciones nuevas, ataques de oportunidad, cobertura ni escapes. Tactical ya tiene contraataques y defender/esperar; Classic necesita defensa/espera automática y apoyo real antes de ofrecer perfiles equivalentes. Es trabajo de resolución, no solo pesos.

Normaliza daño esperado, probabilidad de remate, curación/apoyo útil, riesgo inmediato de contraataque, exposición siguiente, progreso hacia alcance del rol y costo. Multiplícalos por una tabla pequeña. Una bonificación universal enorme por matar borraría temperamentos; usa valor de remate acotado según perfil.

Es una puntuación de utilidad pequeña: compara acciones legales con escalas coherentes y prioridades de personalidad. David "Rez" Graham describe el enfoque y la inercia de decisión en [Introducción a la teoría de utilidad](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf). Perfiles, fórmula, valores e integración concretos aquí son recomendaciones propias de Marinara.

### Protecciones prácticas

- Calcula previsiones desde el destino hipotético y su terreno sin mutar estado ni consumir RNG. La probabilidad de contraataque debe coincidir con impacto/supervivencia/reglas; 50% de tiro no es muerte segura.
- Estima peligro siguiente con posiciones observables y ataques conocidos. No leas RNG futuro u órdenes pendientes. Limita primero la previsión a una activación antes de profundizar.
- Evita curar sin utilidad: valora curación efectiva, urgencia, costo de oportunidad y MP. Un rasguño de un HP no debe ganar automáticamente a una acción importante. No renueves mejoras útiles sin beneficio.
- Evita oscilaciones: conserva objetivo/protegido válido salvo una alternativa significativamente mejor. Guarda solo memoria utilizada. Mindless sigue proximidad, no persistencia táctica.
- Evita kiteo/defensa interminables: sin apoyo o retirada con progreso, favorece un enfrentamiento útil. Acota la protección contra estancamiento sin forzar cargas suicidas de Cowardly para abreviar turnos.
- No des a todos un mismo plan de fase precalculado. Resuelve en orden y evalúa la siguiente unidad sobre estado actualizado, evitando curaciones desperdiciadas o atacar derrotados.
- Protective elige aliado vivo según rol/necesidad y lo conserva hasta ser inválido o claramente inadecuado. Proteger a un jefe explícito puede ser una indicación, no regla universal de ayudantes.
- Usa variación pequeña con semilla entre opciones casi óptimas **dentro del temperamento elegido**. No reutilices la selección uniforme entre todos los ataques que borra personalidad.

Ajuste propuesto: utilidad en escala fija; novice elige dentro de 0,15 del mejor perfil, master dentro de 0,03, con interpolación. Añade una corrección pequeña documentada de dificultad, acotada para no cambiar temperamento. Estos umbrales requieren simulación y juego, no son equilibrio probado.

## 8. Turnos de jefes controlados por GM

### Identidad y responsabilidad

Añade identidad explícita de jefe por unidad. No conviertas automáticamente al más fuerte de cada grupo. Rangos sugeridos: ordinary, elite, boss; elite sigue local salvo designación de jefe. La clasificación musical del encuentro queda separada.

El GM elige una acción legal según personalidad, intención del encuentro, cuadrícula, habilidades/recursos/objetos del grupo y mecánicas admitidas. La información amplia permite anticipar, no conocer elecciones sin confirmar; la sección 16 define el contrato. El motor controla alcance, movimiento, recursos, tiradas, daño, estados y presupuestos. Los ayudantes ordinarios siguen locales incluso con jefe.

Recomendación: activa las nuevas tácticas en partidas nuevas al publicar la función completa y ofrece "GM directs bosses" explicado con la conexión GM configurada. Aclara que los turnos pueden esperar al modelo y consumir uso normal del proveedor. Partidas existentes conservan conducta hasta optar explícitamente; fija la elección al comenzar el encuentro. La opción local/sin conexión usa los mismos perfiles para jefes. No añadas otra enumeración de estilo ni cambies controlador silenciosamente a mitad de batalla.

### Orquestación

Deja llamadas al proveedor en un servicio del servidor, fuera del motor compartido puro:

1. Acepta acción del jugador con identidad de encuentro, ID de acción y revisión esperada; valida contra estado aceptado.
2. Avanza a la próxima acción o decisión de interrupción en orden existente. Separa declaración de efectos para interrumpir un lanzamiento pendiente; no resuelvas una ronda y luego la reescribas.
3. Guarda activación/ventana pendiente: unidad, revisión, cursor, acción disparadora/pendiente, versión y menú legal acotado.
4. Pide ID de candidato estructurado o pasar a la conexión GM. Incluye hojas actuales, intención, mecánicas e información adecuada de ventana según sección 16. Una narración opcional breve no cambia estado.
5. Valida respuesta, revisión, unidad, pertenencia al menú y legalidad actual. Registra atómicamente y aplica una vez.
6. Reanuda acción/activación suspendida con estado actualizado y luego participantes restantes. Revalida tras interrupciones; actualiza cada presupuesto/efecto una vez en su límite reglado y devuelve control al jugador.

Los IDs identifican acciones completas del motor, no coordenadas arbitrarias del modelo. Una cuadrícula grande da candidatos repetidos; crea menú determinista limitado que conserve familias: movimientos característicos, objetivos, apoyo, defensa y desplazamiento. Unas 8–16 opciones diversas son punto inicial para medir. No recortes todas las alternativas con un perfil genérico antes de mostrarlas al GM.

### Latencia, fallas y repetición

Límite inicial: una llamada por ventana de decisión distinta; ninguna para ayudantes, clics de selección u oportunidades sin elección útil. Turnos, anticipación, legendarias posteriores y reacciones pueden crear ventanas diferentes; limita la latencia agregada con varios jefes. Empieza con objetivo blando configurable de unos cinco segundos y límite duro de unos diez por llamada; ajústalos con proveedores reales. Son objetivos de diseño, no garantías medidas. Al agotar presupuesto agregado, guarda alternativa determinista o pasar; no hagas llamadas ilimitadas.

Timeout, proveedor indisponible, salida malformada o candidato inválido usan la misma política alternativa determinista guardada. Regístrala como decisión; una respuesta tardía no la sustituye ni agrega turno. Mantén interfaz receptiva, estado simple de pensamiento y cancelación hacia alternativa aceptada sin reiniciar encuentro.

Reintentar un ID devuelve resultado guardado. Recargar se une a la decisión pendiente. Pestañas simultáneas no avanzan dos veces al jefe. Cambiar chat no conecta la respuesta a otro encuentro. Restaurar/ramificar un punto de control conserva identidad e historial coherentes; reiniciar animación no repite llamadas externas.

**Requisito de persistencia:** las solicitudes tácticas actuales aceptan estado cliente y devuelven instantánea, sin registro autorizado de turnos en servidor. Classic también acepta combatientes/mecánicas completos del cliente sin contrastar una ronda autorizada. Un ID guardado solo en navegador no resuelve reintentos o concurrencia. Antes de decisiones externas en ambos modos, añade el almacén mínimo de revisión/decisión del servidor usando colas existentes. Ajustes e identidad de jefe aceptados por servidor deben gobernar llamadas; una bandera cliente no puede habilitarlas. Audita espacios de turn-game/Experience antes de elegir `game_engine_state`. Es un cambio acotado de combate, no una reestructuración de todo el almacenamiento.

### Mecánicas y claridad de jefes

Solo convierte mecánicas generadas admitidas en operaciones estructuradas. Da IDs estables y estado guardado a transiciones únicas. Distingue acción normal, transición y acción extra explícita; una descripción vistosa no permite daño gratuito.

Anuncia ataques grandes en interfaz/registro antes del efecto cuando la mecánica lo exija. El GM improvisa ambientación alrededor de eventos aceptados, pero narra resultados reales. Personalidad y habilidades características deben reconocerse entre repeticiones aunque varíen elecciones.

Si GM está desactivado o indisponible, muestra la alternativa local sin atribuirle esa decisión. Reproducibilidad significa repetir elecciones/tiradas guardadas, no esperar respuestas nuevas idénticas con la misma semilla.

## 9. Contrato de datos e integración

Prefiere un objeto pequeño compartido por el flujo existente. Ejemplo resuelto:

```ts
type ResolvedEnemyTactics = {
  version: 1;
  creatureCategory: "beast" | "monstrosity" | "other" | "unknown";
  role: EnemyRole;
  adjective: EnemyAdjective;
  proficiency: "novice" | "trained" | "veteran" | "master";
};
```

Esta categoría mínima distingue reglas sin fingir taxonomía 5e completa. Conserva una categoría canónica más rica si se introduce. Guarda rango por separado para no codificar jefe en personalidad. Deriva controlador de rango y ajuste fijo del encuentro; evita dos fuentes editables de verdad.

Indicaciones del esquema y datos resueltos son contratos distintos. El esquema puede contener indicaciones acotadas de rol/competencia/personalidad y referencia estable NPC. El motor las resuelve una vez al perfil guardado. Guarda procedencia una vez por encuentro y memoria pequeña solo cuando se use. No dupliques descripciones brutas en cada unidad y turno.

Classic necesita propagación por `sanitizeCombatantForRound`, esquema de ronda y `CombatantStats`. Su instantánea omite intencionalmente ronda/iniciativa/cola; guardar temperamento solo no permite reanudar GM, recargas reales o reproducción determinista. Persiste la ronda/activación autorizada necesaria; las animaciones consumen resultados aceptados, no provocan otra resolución.

Rastrea todo el recorrido:

```text
known NPC/card data + scene
  -> encounter prompt/schema and generated blueprint
  -> accepted assignment inputs and explicit boss identity
  -> generatedEnemyToCombatant / fallback encounter construction
  -> Classic request OR Tactical start request
  -> resolved units + pinned AI version + encounter identity
  -> action resolution / optional server boss decision
  -> snapshot, checkpoint/branch restore, import/export, post-combat summary
```

Valida enumeraciones y límites en cada frontera externa. `.passthrough()` no valida campos IA nuevos. Conserva omisiones antiguas; rechaza valores explícitos inválidos con error útil, sin cambios silenciosos de temperamento. Una versión nueva no reinterpreta accidentalmente instantáneas antiguas.

Conserva política heredada inicialmente para encuentros en curso y aplica la nueva a batallas nuevas. No puedes clasificar de forma fiable antiguas instantáneas sin taxonomía; no finjas haber evaluado la regla de tipo. Un Beast/Monstrosity conocido que entra en la política nueva debe ser Mindless.

Importan todas las creaciones: generación, combate manual/alternativo, restauración y futuras invocaciones. No añadas campos solo al tipo TypeScript para perderlos al copiar propiedades.

## 10. Diversión, realismo y variedad

**Diversión:** hábitos reconocibles y explotables. Ganar separando un guardia Protective del sanador Supportive satisface más que una mala jugada aleatoria de un evaluador universal. No hagas de todos máquinas perfectas de fuego concentrado.

**Realismo:** objetivos plausibles, información limitada y competencia apropiada. Cobardía, lealtad, agresión y entrenamiento son cualidades diferentes. Mindless simplifica dos categorías por petición. Sistemas futuros de moral/objetivos pueden añadir rendición, defensa territorial y escape sin fingir que existen.

**Variedad:** cambia perfiles y composición entre semillas, conservando identidad dentro de batalla y NPC recurrentes. Terreno, roles, recursos y objetivos deben variar más que la tirada crítica. La dificultad cambia desafío previsiblemente sin hacer que un Mindless Beast cace sanadores de pronto.

Ejemplo en el mismo mapa:

- Reckless Bruiser deja su casilla segura para presionar a un frente alcanzable.
- Protective Bulwark permanece cerca del mago Supportive en vez de sumarse a la carga.
- Cautious Marksman conserva línea de tiro y evita exposición.
- Mindless Beast cruza la ruta forestal más corta hacia el miembro alcanzable más cercano e ignora al mago herido lejano.
- Un jefe humanoide con nombre recibe turno GM para elegir presión característica legal o proteger retirada. Sus ayudantes mantienen perfiles propios.

Otra semilla puede dar Cowardly Bruiser y Opportunistic Marksman y cambiar el combate. Una recarga no. El mismo jefe debe conservar hábitos al reaparecer salvo cambio narrativo o edición explícita.

## 11. Etapas sugeridas

Es una función grande: cambia contratos persistidos, prompts, decisiones y orquestación asíncrona. Acuerda el diseño y luego implementa partes pequeñas revisables sobre staging actual.

| Etapa                                  | Entrega                                                                                                                    | Evidencia de salida                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| A. Capacidad e identidad | Probar/corregir recursos enemigos; indicaciones de categoría/rango/competencia; conservar campos en todas las creaciones  | Mago generado usa recursos finitos reales; jefe solitario conserva identidad al restaurar |
| B. Asignación/persistencia          | Tendencias de rol, personalidad, adjetivo guardado con semilla y legado versionado                                              | Tendencias, prioridad dura de tipo, estabilidad de recarga/importación/puntos de control                  |
| C. Ordinarios Tactical           | Candidatos comunes, persecución Mindless exacta, ocho perfiles distintos, textos de inspección                                      | Matriz de conducta, previsiones coherentes, pruebas móvil/navegador y rendimiento acotado           |
| D. Jefes GM                       | Revisión/idempotencia servidor, fase reanudable, respuesta validada, alternativa guardada, mecánicas admitidas | Timeout/reintento/concurrencia/restauración y batalla manual con proveedor real                        |
| E. Adaptación Classic                  | Semántica no espacial, grupos aliados/apoyo correctos, decisiones/tiradas con semilla e iniciativa de jefe           | Regresiones de ronda/recursos y restauración; sin afirmar conducta de cuadrícula        |

A–C son un buen hito, pero **no cumplen por sí solos el control GM de jefes**. En Classic pide la decisión en su posición de iniciativa después de acciones previas, no sobre el estado viejo de principio de ronda. Reutiliza perfiles/asignación sin forzar ambos motores en un resolutor gigante.

Trabajo posterior separado: LOS/cobertura, objetivos AoE reales, moral/escape individual, objetivos, más adjetivos, coordinación, IA de invocaciones y economías por reglas. Las reglas determinan legalidad; el temperamento decide entre opciones legales.

### Mapa de código para implementar

| Archivo / símbolo                                                                                                                                                                                                                                    | Importancia                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [tipos compartidos de combate](../../packages/shared/src/types/game.ts), `Combatant`, `GameCombatStateSnapshot`                                                                                                                                           | Metadatos ejecutables y restauración Classic                                              |
| [tipos de encuentro](../../packages/shared/src/types/combat-encounter.ts), `CombatEnemy`, `CombatInitState`                                                                                                                                         | Esquema generado, mecánicas y tipos de la ventana separada                          |
| [rutas de encuentro](../../packages/server/src/routes/encounter.routes.ts)                                                                                                                                                                         | Prompts/esquemas de generación y contexto de personajes; ruta de acción de la ventana     |
| [prompts GM](../../packages/server/src/services/game/gm-prompts.ts)                                                                                                                                                                              | Actualmente dicen al GM que la interfaz gestiona mecánicas                             |
| [GameSurface](../../packages/client/src/components/game/GameSurface.tsx), `generatedEnemyToCombatant`                                                                                                                                            | Pierde descripción y MP enemigo; hidratación y creación/restauración explícitas        |
| [interfaz Classic](../../packages/client/src/components/game/GameCombatUI.tsx) y [hooks de juego](../../packages/client/src/hooks/use-game.ts)                                                                                                           | Solicitudes activas, ronda/animación y acciones del jugador                   |
| [servicio Classic](../../packages/server/src/services/game/combat.service.ts), `chooseAutoSkill`, `resolveCombatRound`                                                                                                                            | Política común, RNG, mecánicas e iniciativa                                     |
| [rutas de juego](../../packages/server/src/routes/game.routes.ts), `/combat/round`, `/combat/tactical/start`, `/combat/tactical/action`                                                                                                             | Esquemas y orquestación; intercambio de estado cliente                                |
| [IA Tactical](../../packages/shared/src/features/tactical-combat/ai.ts), `decide`, `runEnemyPhase`                                                                                                                                               | Política y bucle de todos los enemigos a la vez                                          |
| [motor Tactical](../../packages/shared/src/features/tactical-combat/engine.ts)                                                                                                                                                                  | Conversión, heurística de jefe, movimiento, legalidad, resolución, previsiones y rondas |
| [clases Tactical](../../packages/shared/src/features/tactical-combat/classes.ts)                                                                                                                                                                | Seis clases existentes y derivación de capacidades                                             |
| [tipos Tactical](../../packages/shared/src/features/tactical-combat/types.ts), [matemáticas](../../packages/shared/src/features/tactical-combat/math.ts), [RNG](../../packages/shared/src/features/tactical-combat/rng.ts)                              | Instantáneas/acciones, terreno y flujo determinista                      |
| [interfaz Tactical](../../packages/client/src/components/game/TacticalCombatUI.tsx) y [metadatos del chat](../../packages/shared/src/types/chat.ts)                                                                                                       | Instantánea guardada, estados ocupados y recuperación del jefe pendiente                             |
| [regresiones de terreno](../../scripts/regressions/hybrid-terrain.regression.ts), [prueba de ruta](../../scripts/regressions/hybrid-terrain-route.regression.ts), [prueba de configuración](../../scripts/regressions/hybrid-terrain-setup.regression.ts) | Patrones ejecutables para ampliar donde corresponda                                  |

Antes de implementar, busca issues, PR abiertos/borradores, ramas vinculadas y elementos del proyecto para evitar duplicación. El plan anterior cita PR #4391 cerrado/no integrado como precedente; revisa estado y responsable sin convertir toda esa ampliación en requisito. Sigue `AGENTS.md`, `CONTRIBUTING.md`, instrucciones de paquetes y flujo Chai actuales. No implementes solo desde líneas antiguas.

## 12. Aceptación y validación

Usa pruebas pequeñas ejecutables `*.regression.ts` en el runner existente. No conserves `.test.ts` temporales. Las aserciones demuestran conducta, no replican constantes de pesos.

| Escenario                                                                                        | Resultado requerido                                                                                                           |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Beast/Monstrosity con adjetivo conflictivo, master, personalidad o rango jefe | Indicaciones generadas siempre Mindless; perfil resuelto explícito/importado contradictorio rechazado con error útil |
| Tanque sano cercano frente a mago herido lejano                                              | Mindless persigue tanque; Opportunistic puede elegir mago                                                            |
| Ruta corta de bosque frente a abierta larga                                                     | Mindless elige menos pasos pagando costo real y recibe bonificaciones incidentales              |
| Muro obliga a alejarse; rival inalcanzable                                      | Rodeo legal u otro objetivo; sin bloqueo Manhattan                                         |
| Mindless volador/teletransportador                                                               | Traversía, aterrizaje, ocupación y alcance correctos; sin cadenas imposibles                       |
| Aliado herido fuera de alcance actual                                                      | Supportive se mueve y cura legalmente; MP/recarga bloquean                                               |
| Protective sin provocar/interceptar                                           | Solo posición; no redirección de daño inventada                                                                          |
| Cowardly herido                                                                          | Puede retirarse/defender; nunca huida global del grupo                                                                      |
| Gran competencia sobre conjunto amplio fijo de semillas                                                     | Más perfiles adecuados, conservando raros compatibles y resultados estables por semilla                |
| Personalidad conocida, negación, conflicto, datos ausentes/erróneos, texto no inglés  | Ajustes acotados documentados; sin control numérico arbitrario o supuesto de inglés exclusivo                             |
| MP temporalmente agotado                                                                         | Rol/adjetivo iguales; cambian solo opciones legales                                                                |
| Dos enemigos apuntan a herido; primero lo derrota                                             | Segundo evalúa estado nuevo; sin atacar muerto o reservar curación duplicada                                |
| Terreno del destino distinto al original                                               | Previsión y contraataque real coinciden en posiciones, terreno y reglas                                             |
| GM inventa coordenadas, habilidades, acciones gratis, IDs o recursos                   | Sin mutación; solo alternativa legal guardada o candidato válido                                                                 |
| Timeout y éxito tardío, recarga, duplicado o pestañas simultáneas            | Una acción aceptada y un descuento; respuesta vieja descartada                                     |
| Victoria/derrota durante fase suspendida                                          | Final correcto; sin turno posterior de jefe/ayudante                                                     |
| Punto de control, ramas, importación/exportación, legado, NPC recurrente                        | Perfiles e identidad correctos; sin sorteos accidentales ni decisiones externas duplicadas             |
| Mindless y jefe GM Classic                                                                    | Regla no espacial explícita y posición de iniciativa correcta; sin afirmación de cuadrícula/terreno                        |

Mide costo con límites admitidos de 40 unidades / 64 por 64, movimiento mixto, muchas habilidades y obstáculos densos. Cachea cálculos por decisión si se justifica, invalidando tras cambios. Fija presupuesto medible de fase tras perfilar computadora y móvil representativo. No declares milisegundos sin medir ni añadas búsqueda profunda antes de perfilar.

Empieza con `pnpm install`; ejecuta `pnpm check`, regresiones focalizadas de combate/rutas, `pnpm regression:prompt` al cambiar prompts y `pnpm localization:check` para textos. Prueba flujo real, recarga, espera/falla de jefe, teclado, pantallas pequeñas y temas claro/oscuro. Añade entradas `[Unreleased]`. Lee `packages/client/.instructions.md` antes de editar cliente. Registra prompts/resultados con herramientas de depuración existentes y Pino, sin secretos ajenos.

Antes de pedir revisión de PR, ejecuta CodeRabbit local, corrige hallazgos sustanciales y repite. Documenta descartes de falsos positivos o pedantería con evidencia del código, sin bucle indefinido. Deja casillas del plan sin marcar para la persona colaboradora. Publica con seguimiento `[docs-i18n]` obligatorio o traducciones equivalentes.

### Qué verificó la exploración original

La descripción procede de rastrear cliente, rutas y resolutores activos con auditorías Classic/Tactical separadas. El ejemplo de probabilidades se calculó directamente. No se cambió IA, simularon políticas ni ejercitaron jefes en navegador/proveedor real. Son requisitos de implementación, no pruebas aportadas por este diseño.

## 13. Límite actual de IA ordinaria

Vocabulario implementado: Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly, **Patient, Methodical y Coordinated**. Otros adjetivos siguientes son ideas, no ajustes ocultos.

`features/combat-ai.ts` separa rol, adjetivo, entrenamiento y semilla guardados del control. Nuevas batallas reciben asignaciones; restauradas sin perfil conservan política previa. Cambiar controlador de compañero no vuelve a sortear. Recursos MP finitos y tipos/costos explícitos pasan a ejecución; MP enemigo omitido usa la reserva provisional `20 + 3 × level` igual que aliados sin estadísticas, conservando cero explícito. Es una alternativa genérica Engine, no regla de recursos de mesa.

La asignación v1 es menor que la fórmula de sección 5: pesos positivos para compatibles, bonificación de entrenamiento a favorecidos por rol y preferencia acotada de una indicación cerrada opcional. La categoría fuerza Mindless; una indicación explícita Mindless también lo elige en otras categorías. La generación existente aporta indicaciones en cualquiera de los idiomas; el motor no interpreta prosa por sí mismo. Otras indicaciones son preferencias, no garantías; negación y caracterización multilingüe aún requieren evaluación del proveedor. Procedencia completa y personalidad ligada a NPC recurrentes entre encuentros quedan pendientes. Nivel basado en HP sigue siendo indicador débil sin indicación.

Cada modo enumera ataques básicos, habilidades y defensas ejecutables; puntúa daño, remate, curación efectiva, apoyo, costo y táctica pertinente. No añade llamadas ordinarias al modelo. Los perfiles no conceden habilidades inexistentes, MP ilimitado, activaciones extra ni terreno ficticio.

- **Classic:** sin puntuación espacial. Mindless usa orden estable con semilla de rivales vivos, sin HP. Apoyo usa aliados correctos. Mejoras/debilitaciones aplican modificador defensivo nombrado real, no solo daño. Perfiles nuevos tienen recargas por uso. Compañeros manuales encolan ataque/habilidad/defensa en su iniciativa; inventario y acciones narrativas quedan con líder activo. Otros compañeros usan IA inicialmente, como la interacción establecida. Órdenes identifican actor incluso si el líder original está KO.
- **Tactical:** destinos legales de ataque/apoyo alimentan política. Mindless sigue mínimos pasos pagando costo real; vuelo/teletransporte conservan límites propios. Apoyo puede moverse antes de lanzar. Estimaciones de contraataque usan destino previsto. Exposición usa estimación conservadora de alcance público, no rutas completas del próximo turno. Un muro o una montaña bloquea la visión para cada golpe (combat C6).
- **Patient:** favorece espera defensiva acotada frente a intercambio malo; Classic espera una recarga próxima, no movimiento imaginario. No espera eternamente cuando hay acción útil.
- **Methodical:** prepara reducción de defensa admitida, conserva objetivo y ataca cuando el estado sirve. Sin árbol de combos inventado o búsqueda de tiradas futuras.
- **Coordinated:** considera objetivos aliados registrados y debilitaciones útiles, recalculando tras cada acción aceptada. Sin planificador omnisciente ni reservas de acciones aún no enviadas.
- **Compañeros:** selección Player/AI localizada por miembro dentro de batalla, manteniendo líder manual. Tactical actúa tras órdenes manuales restantes o End Turn. Se puede cambiar a manual antes de actuar. Controladores, perfiles y memoria persisten con combatientes/instantáneas.
- **Persistencia Classic:** resultados aceptados y siguiente número de ronda llegan al callback de instantánea antes de animación. Las recargas reales sobreviven. Classic conserva dados aleatorios existentes; no es repetición exacta ni registro idempotente del servidor. Garantías multipestaña corresponden al futuro trabajo autorizado de jefes.

El primer hito terminó antes de proveedores de jefe/reacciones; sección 16 registra la implementación posterior. Siguen pendientes escape individual, provocación, objetivos ricos, iniciativa específica, normalización completa de hojas y registro de NPC recurrentes. Lo no implementado sigue siendo trabajo de aceptación, no funcionalidad implícitamente publicada. Benchmarks sintéticos de computadora no calibran teléfonos físicos.

## 14. Más adjetivos según clase

Conserva un adjetivo visible y rol derivado de capacidades. Son prioridades distintas, no sinónimos de "inteligente". Admite combinaciones inusuales pero válidas.

| Adjetivo | Fighter / Knight | Rogue / Archer | Mage / Healer | Diferencia y requisito |
| --- | --- | --- | --- | --- |
| **Frugal** | Golpe normal antes de técnica limitada | Reserva munición/habilidades explosivas para objetivos importantes | Hechizos eficientes; curación cara para HP faltante sustancial | Eficiencia aun estando seguro, distinta de Cautious; costos finitos reales |
| **Relentless** | Presiona a un rival elegido | Persecución u hostigamiento sostenido a una marca | Continúa secuencia admitida sobre la misma amenaza | Compromiso de objetivo, no riesgo Reckless; objetivo guardado y salida por invalidez/estancamiento |
| **Disruptive** | Desarme, interrupción o golpe incapacitante disponible | Rompe canalización admitida de mago expuesto o debilita | Disipar, silenciar, limpiar o controlar de forma útil | Impide acciones importantes, no maximiza daño; solo efectos reales, sin silencio deducido del nombre |
| **Vengeful** | Represalia a quien hirió o abatió al protegido | Marca al último agresor y busca apertura legal | Maldice agresor o protege víctima prevista | Agravio por evento, no objetivo débil; memoria acotada de agresor/aliado derrotado |
| **Adaptive** | Cambia tras resistencia observada o mal enfrentamiento | Deja ataques ineficaces repetidos | Cambia elemento/apoyo según resultados observados | Solo evidencia pública; historial acotado, sin tablas ocultas de resistencia |
| **Opportunistic** (ya incluido) | Remate seguro antes de duelo largo | Explota heridos/expuestos | Hechizo para asegurar oportunidad real | Base existente; no añadas "Cruel" con idéntica puntuación |
| **Resolute** | Sigue rol con poca salud | Mantiene posición útil bajo presión | Termina curación importante/canalización admitida | Serenidad con HP bajo, no agresión Reckless; intención y cancelación de emergencia |
| **Territorial** | Sostiene puerta/protegido definidos | Vigila aproximación y corta persecución fuera | Apoya dentro de la zona | Objetivo/límite real Tactical; en Classic objetivo nombrado, no coordenadas imaginarias |
| **Zealous** | Prioriza líder/causa explícitos ante sobrevivir | Gasta ráfaga escasa contra amenazas al objetivo | Compromete recursos a misión aun con riesgo | Lealtad a objetivo, no apoyo genérico; metadatos de objetivo/rango |
| **Deceptive** | Finta/cambio de postura admitidos | Ocultación, señuelos o desorientación reales | Ilusión/cebo admitidos | Percepción/engaño con contrajuego legible; narración sola no hace nada |
| **Merciful** | Remate no letal admitido | Incapacita si hay posibilidad de rendición | Contiene/controla y acepta rendición | Resultados no letales y rendición; sin atacar derrotados ni misericordia ficticia |
| **Selective** | Invoca protector resistente cuando hace falta | Invoca perseguidor/tirador para apertura actual | Invocación elemental/apoyo según amenazas visibles | Política futura del repertorio de invocaciones, no daño genérico; contabilidad de invocación |

Mejores siguientes tras los once: **Frugal, Relentless, Disruptive y Vengeful**. Los dos primeros encajan con pequeños cambios de estado. Disruptive requiere incapacitación/disipación reales; Vengeful memoria de eventos. Adaptive y Territorial dan variedad pero exigen más. Prueba solapamientos de Resolute y Zealous antes de ampliar vocabulario público.

Los tres añadidos solicitados también varían por clase:

| Adjetivo | Bruiser / Bulwark | Skirmisher / Marksman | Spellcaster / Supporter |
| --- | --- | --- | --- |
| Patient | Se prepara mientras mejora un mal intercambio; sostiene un acceso valioso Tactical | Espera alcance legal útil, sin forzar tiro débil | Conserva turno para hechizo casi listo o evita curación inútil; nunca espera regeneración de maná inexistente |
| Methodical | Debilita realmente y luego ataca a ese rival | Prepara vulnerabilidad admitida antes del golpe fuerte | Debilita antes de dañar o prepara defensa admitida; no reaplica efectos aún útiles |
| Coordinated | Presiona objetivo aliado o prepara ayuda útil | Remata lo que el grupo amenaza | Apoyo no redundante/debilitación aprovechable; recalcula tras cada acción |

Son metas de ajuste. La primera implementación usa defensa mejorada/debilitada genérica; combinaciones de clase más ricas necesitan habilidades y regresiones correspondientes.

## 15. Extensión Summoning

Empieza sin cuadrícula. Una invocación es combatiente real con ID estable, propietario, bando, perfil, controlador, duración, costo y presupuesto de activación explícitos. Clase modifica capacidades legales; adjetivo prioridades como Classic.

Separa **elección de invocación** del invocador de **política de combate** de la unidad. Patient puede reservar un espacio para después; Knight Protective protege con acciones admitidas; Mage Methodical prepara debilitación; sanador Coordinated evita duplicados. Invocaciones Beast/Monstrosity siguen Mindless incluso aliadas.

Las reglas deciden si ordenar consume acción del dueño, si actúa inmediatamente o próxima ronda, iniciativa compartida y conducta sin órdenes. Recomendación genérica: invocar consume acción ordinaria, primera activación siguiente ronda, IA del motor salvo control explícito. Retirar/reinvocar no da otro turno ordinario. Impón límite de población y una activación por ronda antes de enjambres.

KO del dueño, encanto/cambio de bando, retirada, expiración, derrota grupal y fin del encuentro requieren limpieza explícita. Guarda propietario/duración restante ante recarga/importación. Una invocación derrotada no es objeto ni miembro permanente. Cobra hechizo/MP una vez al aceptar creación. Sus acciones no fabrican ventanas legendarias fuera de la elegibilidad del modificador fijo.

## 16. Jefes GM, acciones legendarias y reacciones

### Adaptador genérico Engine implementado

Las partidas nuevas del asistente habilitan combate dirigido por servidor. **GM directs bosses** (El GM dirige a los jefes) controla el proveedor; ordinarios y compañeros IA siguen locales. Partidas sin `combatDirector` conservan resolutor heredado. La configuración fija interruptor GM, dificultad, semilla, terreno y capacidades para que cambios intermedios no reescriban reglas aceptadas. El generador debe declarar `boss`; HP alto o marca visual no concede extras. Se admite jefe solitario.

`combat-director.routes.ts` guarda instantánea versionada del servidor en el almacén existente bajo `experience:marinara-engine.combat`, anclada al mensaje inicial. Incluye cursor, pila de efectos, elecciones, presupuestos de reacción/legendarios, recursos, IDs aceptados y eventos recientes. Las órdenes llevan ID de encuentro, instancia del almacén y revisión; duplicadas/obsoletas devuelven estado aceptado. Inventario y guardado comparten transacción. Las respuestas del proveedor se contrastan con identidad de fila, revisión y ventana: una tardía no cruza alternativa, restauración o rama.

- **Classic:** cada posición de iniciativa pausa para personaje manual o jefe. El director resuelve actor por actor y aplica una vez mecánicas/estados de fin de ronda. Partidas heredadas conservan cola original.
- **Tactical:** inspeccionar/seleccionar ficha es gratis. **Begin [name]'s turn** (Iniciar el turno de [name]) confirma activación y abre anticipación. Mover solo no crea otra activación o ventana legendaria. Compañeros/enemigos conservan fases. Terreno aceptado, semillas y tamaño siguen autorizados. Encuentros nuevos ignoran preferencias obsoletas de semilla de campaña.
- **Jefes:** presupuesto creado inicial normalmente tres puntos legendarios, cada extra con costo positivo. Se renueva en activación ordinaria del jefe. Anticipación y después de turno comparten reserva; extras/reacciones no generan cadenas legendarias. El generador define ataque/defensa/movimiento legal y costos de habilidades. Mindless respeta persecución; una sola opción ejecuta localmente.
- **Proveedor:** conexión de herramienta GM configurada, con conexión del chat como alternativa. Envía habilidades, recursos, cantidades, estados, perfiles, posiciones y eventos aceptados de ambos bandos. Nunca órdenes privadas pendientes, RNG ni elecciones escritas/señaladas. GM devuelve un ID legal, no estado reescrito. Usa depuración del host. Timeout de diez segundos y máximo agregado actual de doce llamadas por ronda. La alternativa ordinaria usa IA; las ventanas legendarias opcionales pasan. La interfaz identifica alternativas y ofrece una local mientras espera. Límites iniciales fijos, no garantías configurables.
- **Reacciones:** habilidades explícitas `counterspell` y `guard` tienen ventanas. Manuales reciben capacidad/objetivo/costo y **Pass** (Pasar); IA local evalúa amenaza/escasez, jefes usan contrato GM. Una reacción por unidad renovada en su activación, con recargas explícitas. Counterspell puede ser hechizo y ser contrarrestado. Orden estable y pila guardada acotan resolución al límite de cuarenta unidades. Pasar no consume.
- **Costos:** reserva/gasta MP o un slot de nivel exacto antes de reacciones, sin duplicar al resolver. El adaptador genérico cobra aun si hechizo/Counterspell falla. Reacción gasta disponibilidad; habilidades legendarias pagan costo propio y puntos. Slots son datos explícitos opcionales, no inferidos de clase/nombre. Sin lanzamiento a nivel superior ni reembolsos por edición.
- **Efectos genéricos:** Counterspell tiene probabilidad con semilla `clamp(65% + 3% × level difference, 20%, 95%)` y cancela solo efectos pendientes. Guard aplica temporalmente la reducción de daño por defensa existente a un aliado amenazado para ese ataque. Reacciones Tactical comprueban alcance creado y la línea de visión compartida (combat C6), igual que los ataques ordinarios. `areaRadius` y `friendlyFire` explícitos habilitan áreas Tactical; Classic `targetScope: all-enemies` aplica un lanzamiento pagado al grupo contrario. Son reglas genéricas, no Counterspell de ninguna edición 5e.
- **Controles:** pantallas existentes muestran estado aceptado autorizado, presupuestos y panel enfocado accesible por teclado. Inventario Tactical ofrece objetos reales admitidos, no la poción ilimitada heredada. Recarga restaura decisión pendiente. El arreglo de reiniciar antes de restaurar conserva ancla y mecánicas, incluso montajes repetidos de desarrollo React. El resumen incluye recursos totales.

**Límites actuales:** el director no ofrece maniobra libre **Special** ni reinicio en sitio, sin contrato autorizado de acción/rebobinado; el legado los conserva. Usa historia/puntos de control para restaurar. Menú GM máximo dieciséis opciones ordinarias/legendarias y pocos destinos de reposición. Guard reduce daño, no desplaza/intercepta ni es ataque de oportunidad. La represalia automática Tactical sigue separada de reacciones de hechizo. Classic conserva dados aleatorios y mecánicas de guion actuales; Tactical no gana las de Classic. No hay adaptador completo de mesa, resurrección, propiedad de invocaciones, concentración general, lanzamiento superior ni registro recurrente NPC. Normalizar hojas y persistir recursos entre encuentros corresponde a reglas. Calidad de proveedores y ritmo en dispositivos reales requieren juego.

### Requisitos aceptados

**Aceptado:** jefes creados explícitamente tienen acciones legendarias sin depender de 5e. GM conoce capacidades/recursos del grupo y puede actuar ante una predicción plausible antes de la acción ordinaria. Unidades IA evalúan reacciones opcionales y pueden rechazarlas para conservar recursos. Ya hay una primera implementación genérica Engine, separada de la política ordinaria.

### Conocimiento y predicción GM

Da al GM una instantánea vinculada a revisión de habilidades/hechizos, alcances y áreas admitidas, HP y MP/puntos actuales/máximos, slots por nivel, recargas, estados, equipo, cantidades usables y usos restantes. Incluye propiedad/acceso de inventario compartido, posiciones cuando correspondan, invocaciones, últimas acciones aceptadas y actor que comienza. Datos ausentes son desconocidos, no cero o ilimitados. Usa hojas/inventario aceptados, no un resumen inventado. Leer objetos del grupo no permite al jefe usarlos o quitarlos.

El GM puede prever amenazas con conocimiento amplio manteniendo personalidad/competencia. La IA ordinaria conserva su límite. Ninguno recibe RNG futuro, borradores privados, selecciones señaladas ni órdenes ajenas en cola antes de declarar. Un hechizo declarado aporta solo detalles de disparador permitidos; conocer el repertorio no prueba cuál se elegirá. El servidor puede validar estado completo mientras filtra contexto del controlador.

**Ejemplo Fireball:** el mago seleccionado tiene hechizo, recursos y área legal que amenaza al jefe sin dañar aliados. GM puede prever alta probabilidad y gastar punto legendario en reposición, protección o presión legales. Puede equivocarse; debe considerar también si conviene objetivo único u otra acción. No inventa esquivas, silencio o movimiento gratis. Usa AoE, fuego amigo y visibilidad reales; la aproximación original de objetivo único no admitía esta previsión espacial. El director ahora admite áreas explícitas. En Classic/Summoning usa grupos y amenazas no espaciales reales, no alcance ficticio.

### Tres ventanas distintas

Referencia: las [reglas legendarias de 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/monsters) sitúan acciones tras el turno de otra criatura y reponen presupuesto en el propio. Anticipar al mago seleccionado **antes** de actuar es extensión deliberada Marinara, no tiempo 5e estándar. Hazlo independiente de reglas mediante modificador explícito fijo por encuentro; un perfil fiel de 5e usa tiempo nativo salvo regla casera habilitada. No lo mezcles silenciosamente con [reglas de monstruos 2024](https://www.dndbeyond.com/sources/dnd/br-2024/how-to-use-a-monster).

| Ventana | Disparador e información | Presupuesto y continuación |
| --- | --- | --- |
| Legendaria anticipatoria | Comienza activación ajena; GM ve actor, hojas y estado, no elección sin confirmar | Gasta reserva legendaria existente; luego actor elige/revalida |
| Reacción disparada | Evento admitido, como inicio de lanzamiento; solo detalles permitidos | Gasta reacción y MP/slot/uso; después reanuda/cancela pendiente por regla |
| Legendaria posterior | Otra unidad termina activación ordinaria | Gasta la misma reserva y avanza a siguiente activación |

En Tactical distingue inspeccionar/seleccionar de **comenzar activación**. La primera elección confirmada para actuar abre anticipación antes de movimiento/acción, una vez. Tras aceptar, reselección, cancelar menú, recarga o cambiar entrada no reabren ni cambian actor para explotar decisiones. Inspeccionar sigue gratis. Haz visible el compromiso; tras interrupción conserva acción ordinaria salvo incapacidad real. Explicación breve es mejor que un ataque por clic.

Classic recoge órdenes antes de resolver iniciativa completa. Elegir en el menú no es activarse. El futuro resolutor pausa en la posición correcta, expone actor sin filtrar orden en cola, resuelve anticipación y luego valida/procesa declaración. Si la interrupción vuelve ilegal la orden, pide otra manual o recalcula IA antes de lanzar. No llames al GM por cada menú ni adelantes una posición futura. Aplica el ciclo a compañeros IA e invocaciones futuras.

Valores genéricos propuestos:

- Identidad de jefe y menú legendario pequeño explícitos; no privilegio por mayor HP.
- Presupuesto visible de 3 puntos, costos 1–3, repuesto al inicio ordinario del jefe. Fija presupuesto inicial y política de sorpresa/incapacitación al comenzar. Es propuesta Marinara, no copia obligatoria de un monstruo publicado.
- Máximo una elección anticipatoria y una posterior por jefe por activación ajena elegible, ambas de la misma reserva. Permite anticipar sin más puntos. Pasar cierra ventana. Resuelve la posterior previa antes de comenzar la siguiente.
- En Tactical, posterior a mover+actuar o Wait, no clics, golpes individuales, contras, fotogramas ni fase entera. En Classic tras posición resuelta. End Turn cierra cada activación omitida elegible una vez; invocaciones siguen elegibilidad fijada.
- Ofrece `pass` y solo candidatos legales asequibles. Legendaria no abre otra legendaria ni duplica velocidad. Un hechizo legendario dispara Counterspell solo si el adaptador admite esa reacción; presupuestos separados.
- Revalida vida/capacidad del jefe, objetivo y resultado antes de pedir/aceptar. Un jefe muerto no gasta respuesta tardía. Mindless sigue restringido también en opciones legendarias.
- Separa acción ordinaria, reacción, legendaria y evento de guarida/fase. Presupuestos/disparadores distintos; descripciones no dan daño o activaciones gratis.
- Ayudantes quedan locales. GM solo en ventanas con elección significativa. Reutiliza conexión, depuración, alternativa guardada y límite agregado de sección 8.

### Counterspell y reacciones opcionales

**Evalúa automáticamente, gasta selectivamente.** Tener Counterspell no implica lanzarlo contra todo. Un disparador ofrece reacciones elegibles y `pass`. Compañeros IA y enemigos eligen localmente según capacidades, adjetivo, competencia, reservas y valor de impedir ese efecto. Jefes usan GM en la misma ventana. Manuales reciben React/Pass con costo; no gastes slots escasos automáticamente por tener la habilidad. Efectos pasivos obligatorios siguen reglas propias, no son decisiones opcionales.

Puntúa daño/control evitado, derrota aliada impedida, curación/preparación enemiga valiosa negada, éxito estimado y costo de oportunidad del recurso y de consumir reacción antes de reponer. Counterspell puede afectar curación/utilidad si lo permiten reglas, no solo ataques. No inspecciones futuro o elecciones privadas. Una reacción cara ante hechizo inocuo puede perder frente a pasar; el último slot puede salvar al grupo. Reservas son prioridades blandas salvo límite duro explícito del jugador.

| Estilo / capacidades | Prioridad de ejemplo |
| --- | --- |
| Protective Knight o Mage | Intercepta golpe peligroso para aliado o contrarresta hechizo letal solo con habilidad real |
| Cautious o Patient Mage | Pasa hechizo débil para conservar reacción/recursos ante amenaza seria |
| Methodical Mage | Niega limpieza, curación o control admitidos que rompen su plan |
| Mago de apoyo Coordinated | Reevalúa tras reacción aliada; no contrarresta hechizo ya negado ni reserva dos veces |
| Mago Reckless | Gasta más para conservar presión ofensiva, sin actuar con presupuesto agotado |
| Mago Frugal (propuesto) | Respuesta suficiente más barata o pasar; pondera último slot frente a curación/daño futuros |

Usa IDs y metadatos explícitos de disparador/efecto, no la palabra traducida "Counterspell". Cada reacción requiere disparador, momento, objetivos/visibilidad, costo, disponibilidad/renovación y resolución. Separa MP, puntos y slots. Se dispara al comenzar lanzamiento antes de efectos, no al seleccionar mago/menú. [Counterspell 2014](https://www.dndbeyond.com/spells/2051-counterspell) y [Counterspell 2024](https://www.dndbeyond.com/spells/2619072-counterspell) difieren en éxito/recursos; el adaptador debe definirlo. Traditional necesita fórmula/costo documentados propios, no mezcla accidental.

Revalida disparador, vida/capacidad, visibilidad/alcance, objetivo y fondos antes de confirmar. Cobra una vez incluso si falla la contra, salvo reembolso reglado implementado. Costo y acción del hechizo original siguen sus reglas, aparte del pago del contramago. Pasar no gasta ninguno. Cancelar animación no reembolsa. Propuesta Traditional: una reacción por unidad, inicialmente disponible salvo condición explícita, repuesta al comenzar su activación ordinaria. Otros adaptadores definen cantidad/límite propios; interrupción o golpe adicional nunca renueva implícitamente. Contras de intercambio Tactical no son automáticamente reacciones de hechizo; conserva semántica hasta mapeo explícito.

### Resolver interrupciones y persistir

[PR #6110](https://github.com/Pasta-Devs/Marinara-Engine/pull/6110) aporta precedente: conservar intento original, mostrar interrupción aceptada, actualizar contexto inmediatamente y proteger restauración/reintento de sobrescribir cambios posteriores. Roleplay corta texto en frase literal validada; ese parser no resuelve tiempo/recursos de combate. Reutiliza principios de persistencia/visibilidad, no recorte de prosa para decidir daño.

Representa acción como declaración guardada, efectos pendientes y resultado. Secuencia propuesta: inicio/renovación → anticipación opcional → declaración legal/compromiso de recursos → ventanas de reacción → efectos restantes → fin de activación → legendaria posterior. Counterspell cancela pendientes, no daño ya aceptado. Revalida lo restante tras cambiar estado, incluidos objetivo, alcance e incapacitación. Antes de lanzar puede reemplazarse una orden invalidada sin costo; después, cancelación/reembolso depende de reglas. Registro y GM narran hechos aceptados, no el final no ejecutado de la maniobra.

Varios reactores usan prioridad estable reglada y revalidan tras cada respuesta. Reacciones anidadas, como contrarrestar Counterspell, solo mediante capacidad explícita y pila acotada. Cada entrada lleva padre/disparador; una unidad responde una vez al mismo disparador y necesita reacción restante. Cierra agotados, cancelados y resueltos. Sin recursión ilimitada, prompts repetidos tras pasar, cobros múltiples ni cadenas legendarias. Un primer adaptador limitado declara cadenas no admitidas, sin prometer 5e completo.

Contrato mínimo guardado: ID/revisión del encuentro; ID/cursor de activación; actor confirmado; tipo/ID de ventana; evento e IDs de acción pendiente/padre; revisiones de contexto y candidatos; orden de reactores elegibles/resueltos; presupuestos; deltas reservados/comprometidos/reembolsados; elección/paso aceptado; estado de resolución; resultado del proveedor/alternativa y efectos restantes. Acepta decisiones y costos/resultados atómicamente. Respuestas tardías/duplicadas no gastan otra vez. Restaurar reanuda ventana o reproduce resultado; rama/rebobinado aísla todo el registro, no solo narración. Restaurar texto no reembolsa reacción aceptada. El registro del servidor siguiente aporta la implementación inicial; sección 8 conserva contrato futuro.

Interfaz: muestra puntos legendarios, reacción disponible y costo; distingue anticipación de reacción disparada. Explica interrupción y si el hechizo se resuelve, falla o necesita nueva elección. Pensamiento/espera, reintento/alternativa y cancelación accesibles. Anuncia cargas cuando corresponda. No atribuyas alternativas locales al GM. No muestres puntuaciones/prompts internos en menú del jugador.

Pruebas requeridas: hechizos/recursos/objetos correctos en contexto; previsión con reservas agotadas; predicción Fireball plausible pero errónea; sin filtración de borradores/órdenes; sin explotar clics/reselección; jugador cambia acción legal tras anticipación; tiempo 5e nativo frente a regla casera; Counterspell solo tras lanzamiento legal; pasar hechizo débil frente a responder al letal; sin MP/slot/reacción; costo único al fallar; reembolso original según reglas; visibilidad/alcance prohibidos; múltiples reactores y contras anidadas; sin ventana legendaria extra por movimiento/golpe adicional/reacción; posición Classic correcta; orden manual invalidada; unidades omitidas Tactical/elegibilidad de invocación; presupuesto agotado; renovación una vez; muerte/final mientras espera; duplicados; timeout y éxito tardío; recarga, multipestaña, rama/rebobinado y cambios de ajustes. Después de rutas deterministas, valida proveedor real y ritmo móvil representativo.

## 17. Guía del agente de entorno del encuentro

Se eliminan el área **Terrain guidance** (Orientación del terreno) y su resumen en creación. Archivos antiguos pueden conservar campo por compatibilidad, pero generación no lo inyecta en cada batalla. Battlefield Size sigue reutilizable. Batallas nuevas reciben semillas internas individuales; mapas/reinicios guardados conservan aceptadas. La etiqueta Tactical describe movimiento, terreno y previsiones sin nombre de otro juego.

Un futuro agente **Battlefield Scout** debe ejecutarse al preparar encuentro con ubicación actual, escena/entorno recientes, mapa creado, clima y eventos pertinentes. Envía al GM un informe breve antes de generar el encuentro, no al crear mundo ni por turno ordinario.

Límite:

| Responsable | Trabajo |
| --- | --- |
| `Pasta-Devs/Marinara-Agents`, `staging` | Definición, prompt predeterminado, ejecución del paquete, catálogo/manifest, recursos y ajustes del agente |
| Marinara Engine, `staging` | Integración previa al encuentro, entrada de escena acotada, resultado validado, conexión configurada, caché/alternativa y procedencia del terreno guardada |

Entradas con revisión de encuentro/ubicación y distinción entre observaciones y sugerencias inciertas. Salida: resumen corto del entorno admitido, rasgos acotados mediante `TacticalBattlefieldBrief` donde corresponda y referencias de fuente. Sin reglas ejecutables, coordenadas arbitrarias, recursos inventados, privilegios de jefe o cambios HP. Classic recibe peligros/contexto descriptivos, no modificadores de cuadrícula sin soporte.

GM recibe contexto aceptado y sigue creando encuentro; Engine valida terreno final. Cachea por revisión, descarta respuestas obsoletas tras viaje/cambio de escena y evita cobros repetidos al reintentar. Si está desactivado, falta o vence tiempo, usa contexto actual y terreno procedural alternativo normal. Guarda terreno aceptado, no lo regeneres al recargar. Añade logs de prompts y pruebas de esquema/timeout/ubicación vieja. El agente se documenta aquí; no se implementa en Engine ni instala silenciosamente.

### Validación registrada de la primera implementación

Pasan `pnpm check`, regresión focalizada de IA, regresiones existentes de rutas/configuración/motor de terreno híbrido y `pnpm regression:prompt`. Navegador a través de rutas reales Classic/Tactical cubre elección de compañeros, cola manual, acciones automáticas, persistencia de ronda aceptada y recarga. Configuración/hidratación cubre quitar orientación, semilla cero, tipos explícitos no ingleses de hechizo y MP cero. Pasó Chromium de computadora claro y tamaño Android oscuro; WebKit no arrancó por bibliotecas del sistema ausentes. Capturas son artefactos locales, no recursos documentales incluidos.

Una cuadrícula abierta sintética de 40 unidades, 64×64, con caminar/volar/teletransportar y apoyo tardó unos 400–440 ms por fase enemiga ordinaria en este host. No es peor caso con obstáculos ni teléfono físico. Equilibrio y ritmo completo requieren partidas. Las medidas cubren el primer hito, no latencia de ventanas de jefe ni reglas futuras.


### Validación registrada de jefes/reacciones

Pasan `pnpm check` y `pnpm regression:prompt`. Persiste advertencia previa ajena de hook `GameNarration`. Regresiones de IA, director, rutas y proveedor cubren compromiso de activación, turno normal, contras anidadas, pasar, pago fallido, MP/slots vacíos, guardias de área, muros, turnos deshabilitados, transacciones de inventario, duplicados/obsoletos, timeout duro real, límites por ronda e identidad de puntos de control/ramas. El adaptador se ejercitó contra servidor HTTP local, con contexto saliente real y rechazo de elecciones malformadas/desconocidas. Demuestra integración, no estrategia de modelo pagado.

Pasan dieciséis pruebas Chromium de computadora/móvil de controles heredados/dirigidos Classic/Tactical, acciones reales, ronda completa, recarga con reacción, último slot cobrado una vez, habilidades generadas y limpieza de configuración. Capturas inspeccionadas en claro de computadora y oscuro móvil: panel visible, enfocado y operable. Rendimiento físico, cobertura actual WebKit y calidad/ritmo del proveedor siguen sin verificar. La prueba ampliada ejecuta timeout real de diez segundos y rechaza respuestas posteriores. No hubo llamadas a modelos vivos de juego. La mantenedora autorizó después CodeRabbit externo como flujo previsto; la revisión local inicial terminó con 15 hallazgos.


### Seguimiento de CodeRabbit local

La primera revisión corrigió consumo aceptado de objetos Classic tras reintentos/turnos omitidos, previsiones de potencia Tactical, entrada IA compatible con legado, metadatos de jefe solo enemigos, consultas malformadas/costos importados, eventos ausentes de fase automática, normalización de MP máximo, IDs inválidos de unidad controlada, menús de solo reacciones, limpieza del proveedor de prueba y resolución de conexión compartida en servicio. La observación de objetos suponía varios menús de grupo; solo el líder tiene uno, pero quitar referencia vieja arregla un reintento abandonado real. El consumo sigue órdenes aceptadas y resultados efectivos.

Sugerencias descartadas con fundamentos de código:

- Slots admiten solo niveles 1–9 deliberadamente. Quitar claves no admitidas silenciosamente ocultaría capacidades inválidas creadas; el esquema las rechaza. Cantrips y reglas nombradas pertenecen al contrato separado.
- Costos IA ordinaria usan MP actual si falta máximo. Escasez de reacción divide deliberadamente por MP **restante**: Counterspell que agota últimos puntos es caro aunque la reserva original fuera grande.
- Enumerar candidatos ya crea lista alcanzable una vez. Cada uno sigue pasando validación autorizada. Quitar comprobaciones o añadir caché requiere evidencia de rendimiento y conservar el límite; no se observó acción ilegal.
- `CombatAttackResult` no tiene marcador de motivo de falla. El resolutor perfilado rechaza habilidades indisponibles antes de ejecutar, y director valida antes de cobrar. Un protocolo resultado/UI nuevo solo para la alternativa heredada sin efecto se pospone como presentación; no aplica efecto ni gasta.

La segunda revisión completa tuvo seis hallazgos. Se corrigieron merges de slots aceptados y resets de propiedades viejas en Classic independiente; se asignaron perfiles al construir unidades; se extrajo caracterización GM de campos de tarjeta y no metadatos serializados; se bloquearon reacciones en ambas rutas ordinarias heredadas/selección automática; y se devolvió error recuperable al leer estado malformado.

La sugerencia restante del esquema no aplica: `CombatAttack[]`, el prompt generador y `combatSkillsFromGeneratedAttacks` requieren objetos con nombre. Entradas solo texto no tienen hidratación admitida. Se mantiene esquema estricto en vez de aceptar datos que la pantalla no puede usar.

Después pasan `pnpm check` y `pnpm regression:prompt`. Pasan cuatro regresiones de combate y ruta de terreno, incluido contexto real sin comentarios/notas de edición de tarjeta. Dieciséis pruebas de combate pasaron tras primeras correcciones; las ocho finales Classic pasan con reintento de objeto, objeto omitido y último slot. Una colisión compilación/recarga interrumpió una ejecución anterior; el reintento exitoso fue después de compilar. La tercera revisión detectó panel vacío Classic con solo reacciones, corregido en ambos diseños. La ruta heredada Tactical de curación/resolución también las rechaza. La verificación final se registra abajo.


Otras decisiones de revisión:

- El endpoint Tactical ya pasa control por `applyTacticalTurn` y `applyAction`; `applyAction` rechaza IA para el primer miembro vivo. La prueba de ruta ahora comprueba esa solicitud y HTTP 400 con error de líder manual. Duplicarlo en ruta crearía otra fuente de verdad.
- Indicaciones IA e interrupciones pueden omitirse; presentes, deben cumplir esquemas. Capturar y eliminar capacidades inválidas convertiría Counterspell, costo o jefe generado en reglas distintas sin explicar. Tolerar toda capacidad opcional inválida es cambio de conducta intencional, no guardia ausente.
- Exportar alias `TacticalUnitAction` más estrecho es limpieza. El control ya retorna en `applyAction` antes de validación/ejecución ordinaria, y los esquemas del director lo excluyen. No bloquea; una futura limpieza puede estrechar la unión sin cambiar conducta.


Persistencia del inventario heredado queda aparte. `GameCombatUI` separa el callback de inventario tras resultado de ronda, ya existente en la base que usa `void onInventoryItemUsed?.(usedItemName)`. Esperarlo no garantiza idempotencia: `handleUseCombatInventoryItem` trata fallas internamente y rondas heredadas carecen de transacción autorizada guardada para reintentar. Batallas dirigidas omiten callback y usan descuento atómico del registro más estado aceptado. El legado conserva límite viejo; migrar ronda/inventario juntos requiere compatibilidad explícita. Se documenta, sin afirmar que lo corrigen reintentos/órdenes en cola.

La etiqueta de reacción usa variantes singular/plural del catálogo. Pasan regresiones focalizadas, tipos cliente, lint y prueba de líder tras guardias pequeñas; persiste advertencia previa `GameNarration`.


La verificación final añadió alternativas deterministas de acción básica/defensa para Classic sin perfil o rivales restantes, y IDs acotados de órdenes que deben nombrar miembros vivos. Pasan regresiones y tipos servidor; localización valida plurales.

Se posponen sugerencias sin efecto conductual: deduplicar esquemas de slots, retornar ID pendiente en vez del último registro tras declaración síncrona, estrechar tipos y sustituir ordenación de frontera teleport por búsqueda mínima. Hay límites explícitos, validación por acción y ninguna declaración intercalada entre insertar y elegir. No demuestran resultado distinto. Recarga heredada 0/ausente se guarda temporalmente como 1 y decrementa al terminar la misma ronda; está lista en próxima activación. Director usa pago por activación con 0 directo. No hace falta igualar valores intermedios para la misma disponibilidad.


La propuesta de caché supone `/director/start` no idempotente. Sí lo es para chat/ancla aceptados: la ruta serializada devuelve registro existente antes de crear/cobrar; la regresión repite inicio con combatientes viejos y obtiene exactamente sesión aceptada. Refrescar al remontar/reconectar permite ver estado restaurado/actualizado. Desactivarlo conservaría batallas obsoletas; refresco explícito sigue disponible y reintentos desactivados.

La cuarta revisión tuvo 15 hallazgos, con repeticiones/limpieza opcional. La corrección restante respeta Mindless explícito en categorías other/unknown; la regresión reprodujo indicación ignorada antes. Perfiles guardados conservan conducta. Un límite pendiente de 40 rechazaría entrada terminal válida: primero declara, luego suprime nuevas tareas al superar 40, así que el límite guardado es 41. Radio 0 significa sin expansión en ambos resolutores. Convertir importación dinámica heredada del proveedor en estática es opcional. No se afirma cero hallazgos; sigue abierto el seguimiento del inventario heredado.

Verificación tras todas las correcciones: pasa `pnpm check` con localización, formato, tipos, lint y producción; pasa IA tras demostrar falla Mindless previa. Resultados anteriores de prompts, director/rutas/proveedor y navegadores se mantienen como registrados. Últimas correcciones pequeñas verificadas localmente, luego otra revisión externa al preparar PR.


### Revisión de preparación del PR

Propiedad y alcance están en [#6299](https://github.com/Pasta-Devs/Marinara-Engine/issues/6299); traducciones de estas dos guías en [#6300](https://github.com/Pasta-Devs/Marinara-Engine/issues/6300). El enlace compartido de skills funciona; se compararon los 52 archivos byte a byte con Git anterior. `pnpm check` pasa tras moverlos. `AGENTS.md` adapta por separado `CLAUDE.md` para Codex, con transición explícita de borrador a listo tras implementación, validación y revisión locales.

Decisiones de la ronda de publicación:

- La skill Impeccable está en `.agents/skills/impeccable`. La copia de `.claude/skills` y su alias `.agents/skills` se eliminaron el 2026-10-07; el guardián Impeccable lee la skill desde `.agents/skills`.
- Ejemplos, redacción, procedencia del paquete Impeccable e interiores de herramientas vivas son archivos trasladados sin cambios. No son regresiones. Se preserva la skill instalada, sin incorporar mantenimiento upstream separado.
- Ámbito de objeto Tactical `any` está admitido por `CombatItemEffect`, ruta y objetivos del director. Cambiar todo ámbito no self/enemy a `ally` lo rompería. El predeterminado solo cubre ausencia.
- Calcular persecución anticipadamente está acotado y no cambia la acción ganadora. Hacerlo perezoso es rendimiento opcional; la medición mixta registrada sigue siendo evidencia actual, no afirmación de que no pueda optimizarse.
- Capacidades generadas se validan en esquema de encuentro y luego inicio/acción del director. Sustituir costos/capacidades explícitos inválidos por predeterminados al hidratar cambia silenciosamente el conjunto creado. Conserva compatibilidad de ausencias y valida lo proporcionado.
- Se rechaza de nuevo desactivar refrescos de inicio por idempotencia/estado obsoleto; la prueba real de repetición sigue siendo evidencia.

La revisión de publicación terminó con 34 hallazgos: 30 en la skill trasladada sin cambios y cuatro de combate. Los cuatro quedan cubiertos arriba (persecución perezosa, objetivos `any`, refrescos idempotentes y validación explícita). No requirió más implementación. Los aceptados anteriores siguen corregidos/probados. Es revisión con decisiones fundamentadas, no cero hallazgos.

## Seguimiento de dificultad y clima

Consulta [Dificultad del combate y clima](game-combat-difficulty-weather.md) para #6305: dificultad normalizada, daño Traditional solo enemigo, consistencia con semilla, clima aceptado en ambos modos, rasgos explícitos, neutralidad de protegido/desconocido y condiciones fijas tras recarga. Otras reglas deben definir su política de dificultad antes de heredar escalado.
