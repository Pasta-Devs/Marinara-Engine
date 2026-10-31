# IA de combate de Game Mode

Cómo decide Engine qué hacen los oponentes y los compañeros controlados por IA en las peleas de Classic, Tactical y los conjuntos de reglas, y cómo controla el Game Master a los jefes. El código está en `packages/shared/src/features/combat-ai.ts`, `combat-minds.ts`, `tactical-combat/ai.ts` y `tactical-combat/profile-ai.ts`, con la parte del servidor en `packages/server/src/services/game/combat-director.service.ts`, `combat-ai.service.ts`, `combat-boss.service.ts` y `ruleset-combat-director.service.ts`. Para saber dónde encaja el combate en Game Mode en su conjunto, consulta [Arquitectura de Game Mode](game-mode-architecture.md).

Los números de las secciones de implementación ([Límite actual de IA ordinaria](#current-ordinary-ai-implementation-boundary) y las vinculadas a constantes con nombre) corresponden al ajuste actual de Engine. Los números marcados como ejemplo, propuestos, provisionales u objetivos de diseño no corresponden a ese ajuste, y ninguno constituye una afirmación de equilibrio probada en partidas. La invocación en el combate propio de Marinara en Classic y Tactical sigue siendo una propuesta ([Extensión Summoning](#summoning-design-extension)); las peleas de los conjuntos de reglas invocan mediante sus propias reglas de `summons`.

## Separa capacidad, temperamento y control

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

## Catálogo de adjetivos

### Los ocho iniciales

| Adjetivo         | Objetivo preferido                                                             | Posición y riesgo                                                                                    | Habilidades/recursos                                                                                      | Qué puede aprender el jugador                                   |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| **Mindless**      | Miembro vivo alcanzable más cercano según [Mindless: contrato exacto de persecución](#mindless-an-exact-pursuit-contract)               | Ruta espacial legal más corta; ignora utilidad del terreno, exposición y formación                           | Ataque simple legal al objetivo; sin priorizar curaciones, fuego concentrado ni recursos                   | Atráelo con cercanía, terreno y pasos estrechos             |
| **Reckless**      | Daño inmediato y presión alcanzable; no siempre el más débil | Se acerca agresivamente; tolera contraataques y exposición                                  | Gasta ataques fuertes disponibles; rara vez se detiene a defender                                             | Castiga su avance excesivo y provoca intercambios desfavorables            |
| **Cautious**      | Amenazas alcanzables limitando daño recibido                          | Destinos seguros, alcance útil, terreno defensivo                                            | Conserva recursos escasos si el básico sirve casi igual; cura/defiende si hace falta                | Presiona el espacio seguro y su reticencia a comprometerse   |
| **Opportunistic** | Heridos, expuestos o debilitados; remates fiables   | Acepta cierto riesgo por una apertura concreta                                                                | Valora habilidades que crean o explotan la apertura                                                      | Protege vulnerables y niega remates fáciles   |
| **Protective**    | Amenazas a un aliado vulnerable designado o grupo cercano          | Distancia de apoyo; bloqueo posicional legal útil                                    | Defensa/apoyo para preservar al protegido; ataca si proteger no urge              | Separa al grupo o entra desde varias direcciones   |
| **Supportive**    | Salud aliada y mejoras útiles antes de daño propio                           | Se mueve al alcance legal sin exposición innecesaria                                        | Cura HP faltante significativo; evita sobrecurar y mejoras duplicadas; ataca si apoyar aporta poco | Presiona al apoyo o sepáralo de sus beneficiarios |
| **Disciplined**   | Objetivos eficaces para el rol y remates sensatos                      | Equilibra daño, seguridad, posición y recursos; compromiso moderado                            | Fundamentos fiables sin especializarse en extremos                                               | Interrumpe su rol y fuerza elecciones malas              |
| **Cowardly**      | Objetivos seguros sin represalias                       | Se preserva más al estar herido o superado localmente; retrocede hacia aliados seguros | Se cura/defiende antes y evita compromisos costosos                                                | Corta retirada segura y mantén presión a distancia    |

Protective no redirige daño, provoca, intercepta ni obtiene reacciones por magia. La ocupación actual permite bloquear posiciones; mayor protección exige habilidades reales. Cowardly puede retroceder/defender, pero `flee` de Tactical termina toda la batalla. **Nunca uses la huida global como escape de un enemigo.** Un oponente individual solo abandona una pelea mediante la moral ("Perder el ánimo en Classic y Tactical", en [Protecciones prácticas](#practical-guardrails)) o una huida del conjunto de reglas.

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

<a id="assigning-profiles-role-experience-personality-then-seeded-variety"></a>

## Asignación: rol, experiencia, personalidad y variedad con semilla

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

La experiencia influye **tanto** en la probabilidad inicial de temperamento adecuado como en su ejecución consistente. La IA local ordinaria no descubre habilidades ocultas ni órdenes en cola. Los jefes GM tienen conocimiento más amplio según [Jefes GM, acciones legendarias y reacciones](#gm-bosses-legendary-actions-and-reactions); ninguno ve tiradas futuras o elecciones sin confirmar. La supervivencia del veterano es un sesgo útil para construir mundo, no una ley de que todos los magos veteranos sean cautelosos.

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
- Cuánto vacila una unidad es una proporción de lo que puede ganar en su turno, y alcanza su valor completo cuando el mejor candidato equivale aproximadamente a un tercio de un enemigo. Contra un grupo demasiado resistente para que un solo golpe le haga mella, cada golpe representa una pequeña proporción de un enemigo, y una fluctuación fija decidiría entre un Multiattack completo y dos dagas lanzadas con desventaja. La inclinación de una unidad Methodical hacia su último objetivo se reduce de la misma manera, y también según cuánto menos valga el golpe contra ese objetivo.
- Un golpe que obtiene claramente menos que el mejor disponible (por debajo de 97 centésimas) y cuya puntuación ya es inferior no recibe fluctuación alguna, de modo que un novato nunca hace que dos dagas que valen 93 centésimas de un Multiattack lo superen por vacilación.
- Lo que una unidad prefiere de un objetivo (el enfoque de su mente: el más peligroso, el más débil) solo inclina una elección entre golpes que dañan de forma similar: uno que inflige menos de 97 centésimas del daño de su golpe más fuerte no recibe nada de ese enfoque.
- En las peleas de conjunto de reglas, el peligro al que se expone una unidad donde se queda a pelear considera a un oponente que puede caminar hasta ella y golpearla allí casi tan peligroso como uno a su lado (una décima menos al extremo de su desplazamiento), de modo que alejarse seis casillas de un caballero para lanzar desde larga distancia nunca parece más seguro que acercarse a él. Una huida sigue considerando el extremo de un desplazamiento mucho más seguro, y nunca se dirige a un paso en el que tendría que apretarse si puede situarse en un lugar donde quepa por completo.
- Un guardaespaldas fuera de su límite no realiza ningún desplazamiento seguido de un golpe que termine fuera del límite, aunque acabe más cerca que donde está: en su lugar, camina de regreso.
- Un Multiattack cuyo objetivo cae durante su ejecución dirige sus partes restantes al otro oponente más cercano al que llegue cada parte (si no hay ninguno, no se ejecutan); uno dirigido a alguien que ya está caído se ejecuta tal como se eligió, y una criatura Cruel sigue atacando a los caídos.
- El registro de la pelea indica qué activó una prueba de moral antes de su tirada, un cambio de temperamento y qué lo causó, a quién arrastró un desplazamiento, una criatura Territorial que mantiene su terreno y una rendición del grupo. Una criatura que se rinde permanece en el tablero donde se rindió.
- En las peleas de conjunto de reglas, la puntuación de daño de un golpe es su daño esperado con respecto a la salud media del bando de su objetivo, sea quien sea quien lo reciba, de modo que la mayor salud de un caballero no hace que un Multiattack contra él valga menos que el mismo daño contra el mago. Un golpe que haría caer a su objetivo se pondera según la salud del propio objetivo, sin considerarlo nunca más frágil que tres cuartos de esa media.

<a id="mindless-an-exact-pursuit-contract"></a>

## Mindless: contrato exacto de persecución

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

## Decisiones ordinarias

### Reutiliza la resolución; cambia prioridades

Genera primero acciones legales y luego puntúa con pesos de rol/adjetivo. Reutiliza movimiento, previsión y disponibilidad; añade la función mínima de legalidad compartida que necesitan IA y GM. No llames al mutador `performUnitAction` con entrada del modelo sin validar.

Los candidatos deben incluir:

- Ataque básico y habilidades usables, con destinos legales de mover y actuar.
- Curaciones, mejoras y debilitaciones sobre el bando correcto, incluido moverse al alcance.
- Defender, esperar y movimiento intencional sin ataque/apoyo útil.

Incluye solo mecánicas realmente resueltas. Objetos enemigos necesitan inventario/contabilidad reales. La puntuación no inventa geometría AoE, invocaciones, provocaciones, reacciones nuevas, ataques de oportunidad, cobertura ni escapes. Tactical ya tiene contraataques y defender/esperar; Classic necesita defensa/espera automática y apoyo real antes de ofrecer perfiles equivalentes. Es trabajo de resolución, no solo pesos.

Normaliza daño esperado, probabilidad de remate, curación/apoyo útil, riesgo inmediato de contraataque, exposición siguiente, progreso hacia alcance del rol y costo. Multiplícalos por una tabla pequeña. Una bonificación universal enorme por matar borraría temperamentos; usa valor de remate acotado según perfil.

Es una puntuación de utilidad pequeña: compara acciones legales con escalas coherentes y prioridades de personalidad. David "Rez" Graham describe el enfoque y la inercia de decisión en [Introducción a la teoría de utilidad](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf). Perfiles, fórmula, valores e integración concretos aquí son recomendaciones propias de Marinara.

<a id="practical-guardrails"></a>

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

**Pérdida de valor en Classic y Tactical (IA de combate E1, E2).** Una pelea dirigida de Classic o Tactical aplica la regla de moral de los juegos antiguos a cada oponente que no sea un jefe ni sea Mindless. Cada oponente tiene una puntuación de moral en la escala de 2 a 12: el `aiHints.morale` del esquema cuando la historia especifica uno; en caso contrario, 7 para una mente instintiva o astuta, 8 para una táctica y 9 para una genial, ajustada según el temperamento (Cowardly −3, Cautious −1, Protective +1, Reckless y Disciplined +2) y con uno más para un líder. Al comenzar uno de sus turnos comprueba, una vez por cada circunstancia y en este orden, haber sido sorprendido (`surprised` en el esquema), que su líder haya caído (`aiHints.leader`, o un jefe), que haya caído la mitad de su bando, que haya caído el primero de su bando y haber recibido heridas que lo dejen por debajo de la mitad de su salud. Dos dados que superen su puntuación le hacen perder el valor. Un oponente pensante con un enemigo a su lado (siempre, en Classic, que no tiene tablero) se rinde; un animal, o uno con espacio, huye, caminando hacia el borde más cercano del tablero y escapando cuando comienza allí uno de sus turnos. En ambos casos sale vivo de la pelea: la pelea se gana cuando no queda ningún oponente, el resumen le cuenta al Game Master quién huyó y quién se rindió, y el botín de un oponente rendido se obtiene junto con el de los caídos. El mismo `aiHints.leader` marca a un oponente de una pelea de conjunto de reglas como líder para las pruebas de moral `leader-down` de su conjunto de reglas. Las peleas guardadas antes de la moral siguen jugándose sin ella.

**Qué hace cada rol (IA de combate A1-A3).** El rol ahora modifica la ponderación compartida en los tres estilos, salvo que el oponente sea Mindless: un Bulwark da más peso a la protección y recibe puntuación por terminar su desplazamiento junto a un amigo amenazado; un Skirmisher da más peso al remate y la coordinación y recibe puntuación por golpear desde el lado opuesto del objetivo respecto de un amigo que ya lo está atacando; un Marksman presta más atención al peligro; un Spellcaster reserva sus opciones costosas para cuando importan; un Controller da más peso a la preparación; un Supporter da más peso a la ayuda y recibe puntuación por terminar junto a un amigo herido; y un Solo (una criatura de conjunto de reglas con acciones distintivas o resistencia legendaria, o un jefe de Classic/Tactical) gasta libremente, golpea más fuerte y presta menos atención al peligro. El rol de una criatura de conjunto de reglas se deriva de lo que puede hacer (consulta los párrafos de 1.763/1.776 de writing-rulesets.md) y su temperamento se sortea de nuevo con ese rol cuando difiere de la primera estimación, salvo que la historia o los datos especifiquen uno, o que sea un oponente con ficha (cuyas elecciones abiertas se completaron con el temperamento que se le dio).

**Entrar y volver a salir (IA de combate A4).** Una criatura de conjunto de reglas que haya golpeado de cerca este turno y sea Skirmisher, o Cautious o Cowardly, usa el desplazamiento que le queda para alejarse: un Disengage que todavía pueda pagar (el de acción adicional de Nimble Escape) y luego su casilla de huida; sin él, solo una casilla que no provoque nada y que no esté junto a ningún oponente. Se recuerda a través de una ventana a la que responde una persona (`turnSoFar.struckClose`).

**Guardaespaldas (IA de combate A5, Capability API 1.777).** Un oponente cuyo `behavior.guards` indique `leader`, `casters` o `healers` recibe la orden de compañero `protect` para el amigo en pie más cercano de esos tipos (`rulesetBodyguardOrders`): el mismo límite de tres casillas, enfoque en quien esté atacando a su protegido y su desplazamiento de regreso a este cuando no tiene nada que hacer. Un guardaespaldas Mindless también mantiene la orden: antes de la regla de objetivo más cercano de Mindless, sus candidatos se limitan a golpes contra quien esté junto a su protegido, cuando los haya. Una preferencia de objetivo `leader` ahora también cuenta a un combatiente al que la historia marca como líder (E2).

**Líderes (IA de combate A6).** En las peleas de conjunto de reglas, un líder (`block.leader` o el `leader` de E2) pondera la ayuda a todo su bando (opciones para aliados con dos o más objetivos o un área) con +0.6 de enfoque en las rondas 1-2 (`weighRulesetLeadership`); el resto de su bando (solo oponentes; los compañeros tienen la orden de seguir) recibe +0.3 de enfoque en su último objetivo; y, cuando el líder comienza su turno, los aliados en fuga a seis casillas o menos pierden `routed` y el activador que los hizo perder el valor se quita de `moraleChecked`, por lo que vuelven a comprobarlo en su siguiente turno (`rallyRulesetSide`). La ayuda a todo el bando también cuenta una opción que se aplica a sí mismo un estado cuyas `auras` alcanzan a su bando (Leadership de 5e), y `rulesetEffectWorth` valora esa aura según el valor de los estados que aplica por cada amigo dentro de su alcance; la bonificación de apertura es +1 de enfoque. La moral de Classic y Tactical aún no permite reagruparse.

**Disciplina y fanatismo (IA de combate T1, T2).** `disciplined` ahora tiene un peso de coordinación de 1 (formación), +0.6 en lugar de +0.3 de enfoque en el último objetivo de su líder, y omite el activador de moral `first-fall` del conjunto de reglas. `fanatical` (en `COMBAT_NAMED_TEMPERAMENTS`, nunca sorteado sin una indicación o datos que lo especifiquen) da un peso de 2 al daño, 0.05 al riesgo y 1 a la protección, no tiene puntuación de moral en Classic/Tactical y nunca realiza una prueba de moral de conjunto de reglas. El director refleja el temperamento que usa en `RulesetCombatant.temperament` para esas pruebas de reglas.

**Cambios de temperamento (IA de combate T7, Capability API 1.779).** `aiHints.shifts` (la historia) o un `behavior.shifts` del conjunto de reglas especifica hasta cuatro `{on, to}`; `shiftCombatTemperament` aplica el primero cuyo activador haya ocurrido, una vez (`tactics.shifted`), al comienzo del turno de la unidad: `shiftTurn` en Classic/Tactical (allí, estar acorralado significa estar por debajo de un cuarto con un miembro del grupo adyacente, siempre en Classic) y `shiftRulesetTemperament` en las peleas de conjunto de reglas (estar acorralado también requiere no tener casilla de retirada). Una unidad que ha cambiado mantiene su nuevo temperamento por encima del de sus datos, y el reflejo del conjunto de reglas lo sigue.

**Temperamento Arrogant (IA de combate T5, Capability API 1.780).** Un temperamento que solo se asigna explícitamente por su nombre (`COMBAT_NAMED_TEMPERAMENTS`): riesgo 0.2, preparación 0.05, coste 2 (un rol `solo` mantiene ese coste en lugar de llevarlo a cero), con tendencia ofensiva al mantener la posición. Sin `shifts` propios usa `COMBAT_ARROGANT_SHIFTS` (ensangrentado o aliado caído → Methodical); `tactics.shiftedFrom` lo recuerda. En las peleas de conjunto de reglas, `retreatAloft` hace que una criatura voladora legendaria Arrogant (o anteriormente Arrogant) vuele hacia arriba cuando está por debajo de un cuarto de su salud e impide que camine hacia nadie.

**Temperamento Territorial (IA de combate T4, Capability API 1.781).** Un temperamento que solo se asigna explícitamente por su nombre. `syncRulesetCombatants` registra `tactics.home` donde se sitúa por primera vez; `rulesetTerritoryLeash` convierte `behavior.territory` (6 de forma predeterminada) alrededor de ese punto en el mismo límite que tiene un compañero que protege (un combatiente sustituto en el punto de origen), usado por `walkTowardsTrouble` y para descartar candidatos que lo alejen aún más de su terreno. El límite se suspende mientras `harmedBy` esté fuera de su terreno. Una criatura Mindless cuyos datos indiquen `territorial` mantiene su terreno (`rulesetTerritorial`), y `tactics.home` sobrevive a un nuevo sorteo de tácticas.

**Temperamento Cruel (IA de combate T3, Capability API 1.782).** Un temperamento que solo se asigna explícitamente por su nombre: remate 3 (como Opportunistic), preparación 0.8. El `cruelOpponents` de la configuración del juego (desactivado de forma predeterminada) se convierte en `CombatDirectorState.cruel`; solo entonces `syncRulesetCombatants` refleja `cruel` en el combatiente del conjunto de reglas (en caso contrario, `opportunistic`), y `rulesetCandidatesFrom` permite que un combatiente cuyo temperamento reflejado sea `cruel` pondere golpes dañinos contra un enemigo que esté caído y no derrotado. Las peleas de Classic y Tactical no tienen un estado de caído pero vivo, así que allí solo se aplican los pesos.

**Temperamento Honourable (IA de combate T6, Capability API 1.783).** Un temperamento que solo se asigna explícitamente por su nombre: remate 0.2. En las peleas de conjunto de reglas su selección descarta candidatos dirigidos contra un enemigo en fuga, caído o rendido (cuando queda cualquier otra opción) y da +0.6 de enfoque al enemigo que lo hirió por última vez y +0.3 a un enemigo a su lado. El comando `yield` del grupo (ofrecido como `DirectedRulesetView.canYield` mientras todos los oponentes en pie sean Honourable) termina la pelea como una `defeat` con `CombatSummary.yielded`, que el resumen comunica al Game Master como una rendición aceptada.

**Temperamento Hungry (IA de combate T8, Capability API 1.784).** Un temperamento que solo se asigna explícitamente por su nombre: remate 2, preparación 1. Su selección da +0.6 de enfoque a `tactics.targetId`. Al comienzo de su turno de conjunto de reglas, `dragOffPrey` encuentra a los enemigos que arrastra (`rulesetDragging`), convierte al primero en su objetivo y camina hacia `rulesetRetreatCell` ignorándolos, de modo que el arrastre los lleva consigo; después no camina hacia nadie durante ese turno.

**Los voladores mantienen la altitud (IA de combate A7).** Cuando el turno de un volador de conjunto de reglas se queda sin nada que hacer en el suelo (`keepAloft`), y puede volar, tiene una acción dañina a distancia disponible, no es Bruiser, Reckless ni Mindless, y queda un oponente en pie que no puede volar, usa Fly hacia arriba donde el tablero tiene niveles, y luego continúa su turno (un disparo, su hostigamiento manteniendo la distancia) desde el aire.

**Casillas de agua, pasos estrechos, presas y disparos desde lejos.** Se carga una posición guardada en una casilla de agua (la comprobación del guardado ya no considera que el agua esté bloqueada). Una huida (`rulesetRetreatCell`) nunca termina en un paso donde deba apretarse una criatura de más de una casilla. Una criatura Hungry solo arrastra presas en pie, y una vez que todos los demás enemigos en pie están más allá de su desplazamiento más una casilla, se queda donde está en lugar de seguir arrastrando. Un combatiente rendido muestra una bandera blanca en su token y "Surrendered" (Rendido) en su tarjeta, en lugar de una calavera de derrotado. Una criatura pensante cuyo mejor golpe de cerca tiene una media superior a una vez y media la de su disparo (`rulesetShotFromAfar`) solo dispara mientras no puede llegar, y luego se acerca caminando en lugar de mantener su posición. Solo cuentan las acciones que puede realizar ahora: no se cuenta un golpe concedido de Flame Blade que no haya invocado.

**Soltar a los caídos y prisioneros.** Un portador suelta, sin coste (`rulesetLetGoOfHeld`), a los enemigos caídos que sujeta mientras siga en pie otro enemigo, salvo que sea Cruel y el juego permita golpear a los caídos. Empujar o agarrar a alguien a quien ya sujeta no vale nada, al igual que un empujón sin ningún lugar adonde enviarlo, de modo que un cocodrilo muerde a quien tiene entre sus mandíbulas. El enfoque de una criatura Hungry en su presa sujeta solo cuenta los golpes. Un prisionero conserva su casilla: se puede pasar por ella, pero nunca detenerse en ella, como en la de un combatiente caído; su token tiene un anillo blanco y una bandera más grande.

**Disparos de Multiattack y terreno abierto.** La comparación de disparos desde lejos cuenta cada golpe de un Multiattack tantas veces como se ejecuta, y compara el mejor ataque cuerpo a cuerpo utilizable con el mejor ataque a distancia utilizable, de modo que los dos disparos de Longbow de un explorador pesan más que sus dos Shortswords. Una criatura de más de una casilla prefiere el terreno abierto a un paso donde deba apretarse a la misma distancia; los golpes desde un paso en el que tendría que apretarse valen 0.6 de lo que valen los mismos desde terreno abierto (`RULESET_SQUEEZED_BLOWS`), y una vez apretada, los golpes desde terreno abierto valen esa misma proporción más, por lo que sale para golpear.

<a id="boss-turns-controlled-by-the-gm"></a>

## Turnos de jefes controlados por GM

### Identidad y responsabilidad

Añade identidad explícita de jefe por unidad. No conviertas automáticamente al más fuerte de cada grupo. Rangos sugeridos: ordinary, elite, boss; elite sigue local salvo designación de jefe. La clasificación musical del encuentro queda separada.

El GM elige una acción legal según personalidad, intención del encuentro, cuadrícula, habilidades/recursos/objetos del grupo y mecánicas admitidas. La información amplia permite anticipar, no conocer elecciones sin confirmar; [Jefes GM, acciones legendarias y reacciones](#gm-bosses-legendary-actions-and-reactions) define el contrato. El motor controla alcance, movimiento, recursos, tiradas, daño, estados y presupuestos. Los ayudantes ordinarios siguen locales incluso con jefe.

**Oponentes con nombre y brillantes (IA de combate P9).** Un juego también puede hacer que el GM controle a cada oponente con nombre (el `aiHints.named` del esquema del encuentro, dado solo a individuos con nombre de la historia) y a cada oponente con una mente `genius` (según el `aiHints.mind` de la historia o, en su defecto, sus propios datos de conjunto de reglas). El `aiHints.mind` de la historia solo puede reducir el raciocinio que indican los datos propios de una criatura (una dominada o enloquecida), o suplirlos cuando sus datos no especifican ninguna mente: una indicación suelta nunca convierte a un lobo en un táctico. La opción de configuración es `gmNamedControl`, que se ofrece bajo el control de jefes y queda fijada junto con él cuando comienza la pelea; su ausencia significa solo jefes. Estos oponentes reciben el mismo contrato de un identificador del menú, tiempo de espera y respaldo que un jefe, pero ningún presupuesto legendario que no posean. En una pelea de conjunto de reglas, el prompt también lleva el perfil del oponente (mente, temperamento, rol, competencia y el `behavior` de su conjunto de reglas), el otro bando ordenado por amenaza y las órdenes de compañeros del grupo.

**Sugerencias del propio Engine.** En un turno del Game Master en una pelea de conjunto de reglas, el Engine puntúa a los candidatos del oponente exactamente como lo haría su propio selector (`rankRulesetChoices`, los mismos pesos que `chooseCombatCandidate`) y marca sus tres mejores en las opciones de la decisión como `suggested: { rank, reason }`, añadiendo cualquiera que la lista reducida haya omitido. El prompt los lleva como `engineSuggestions`, uno por línea con una gramática fija: `1. CANDIDATE: <id> ACTION: <label> -> <targets> REASON: <why>`. El motivo indica los componentes más grandes de la puntuación (daño con su previsión, una muerte probable, a quién más quiere hacer caer, una preparación, ayuda, el coste que gasta, el peligro al que se expone) y el desplazamiento que realiza primero. Así, un modelo que no conoce el conjunto de reglas sigue viendo por qué un conjuro supera a otro; puede elegir cualquier candidato ofrecido, y se le indica que siga una sugerencia salvo que la personalidad del oponente, la historia o una jugada mejor aconsejen otra cosa. No intervienen llamadas a herramientas. Las peleas de Classic y Tactical hacen lo mismo: cuando se abre una ventana ordinaria del Game Master, `chooseClassicAction` o `decideProfileAction` ordena a los candidatos de la unidad sin realizar la selección, y las tres mejores elecciones coincidentes llevan `suggested`, mostrado en ese prompt como `engineSuggestions` con la misma gramática.

Recomendación: activa las nuevas tácticas en partidas nuevas al publicar la función completa y ofrece "GM directs bosses" explicado con la conexión GM configurada. Aclara que los turnos pueden esperar al modelo y consumir uso normal del proveedor. Partidas existentes conservan conducta hasta optar explícitamente; fija la elección al comenzar el encuentro. La opción local/sin conexión usa los mismos perfiles para jefes. No añadas otra enumeración de estilo ni cambies controlador silenciosamente a mitad de batalla.

### Orquestación

Deja llamadas al proveedor en un servicio del servidor, fuera del motor compartido puro:

1. Acepta acción del jugador con identidad de encuentro, ID de acción y revisión esperada; valida contra estado aceptado.
2. Avanza a la próxima acción o decisión de interrupción en orden existente. Separa declaración de efectos para interrumpir un lanzamiento pendiente; no resuelvas una ronda y luego la reescribas.
3. Guarda activación/ventana pendiente: unidad, revisión, cursor, acción disparadora/pendiente, versión y menú legal acotado.
4. Pide ID de candidato estructurado o pasar a la conexión GM. Incluye hojas actuales, intención, mecánicas e información adecuada de ventana según [Jefes GM, acciones legendarias y reacciones](#gm-bosses-legendary-actions-and-reactions). Una narración opcional breve no cambia estado.
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

## Contrato de datos e integración

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

## Diversión, realismo y variedad

**Diversión:** hábitos reconocibles y explotables. Ganar separando un guardia Protective del sanador Supportive satisface más que una mala jugada aleatoria de un evaluador universal. No hagas de todos máquinas perfectas de fuego concentrado.

**Realismo:** objetivos plausibles, información limitada y competencia apropiada. Cobardía, lealtad, agresión y entrenamiento son cualidades diferentes. Mindless simplifica dos categorías por petición. La moral (rendición y escape) y el temperamento territorial ya existen, en [Protecciones prácticas](#practical-guardrails); los objetivos más complejos no.

**Variedad:** cambia perfiles y composición entre semillas, conservando identidad dentro de batalla y NPC recurrentes. Terreno, roles, recursos y objetivos deben variar más que la tirada crítica. La dificultad cambia desafío previsiblemente sin hacer que un Mindless Beast cace sanadores de pronto.

Ejemplo en el mismo mapa:

- Reckless Bruiser deja su casilla segura para presionar a un frente alcanzable.
- Protective Bulwark permanece cerca del mago Supportive en vez de sumarse a la carga.
- Cautious Marksman conserva línea de tiro y evita exposición.
- Mindless Beast cruza la ruta forestal más corta hacia el miembro alcanzable más cercano e ignora al mago herido lejano.
- Un jefe humanoide con nombre recibe turno GM para elegir presión característica legal o proteger retirada. Sus ayudantes mantienen perfiles propios.

Otra semilla puede dar Cowardly Bruiser y Opportunistic Marksman y cambiar el combate. Una recarga no. El mismo jefe debe conservar hábitos al reaparecer salvo cambio narrativo o edición explícita.

<a id="current-ordinary-ai-implementation-boundary"></a>

## Límite actual de IA ordinaria

Vocabulario implementado: Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly, **Patient, Methodical y Coordinated**. Otros adjetivos siguientes son ideas, no ajustes ocultos.

`features/combat-ai.ts` separa rol, adjetivo, entrenamiento y semilla guardados del control. Nuevas batallas reciben asignaciones; restauradas sin perfil conservan política previa. Cambiar controlador de compañero no vuelve a sortear. Recursos MP finitos y tipos/costos explícitos pasan a ejecución; MP enemigo omitido usa la reserva provisional `20 + 3 × level` igual que aliados sin estadísticas, conservando cero explícito. Es una alternativa genérica Engine, no regla de recursos de mesa.

La asignación v1 es menor que la fórmula de [Asignación: rol, experiencia, personalidad y variedad con semilla](#assigning-profiles-role-experience-personality-then-seeded-variety): pesos positivos para compatibles, bonificación de entrenamiento a favorecidos por rol y preferencia acotada de una indicación cerrada opcional. La categoría fuerza Mindless; una indicación explícita Mindless también lo elige en otras categorías. La generación existente aporta indicaciones en cualquiera de los idiomas; el motor no interpreta prosa por sí mismo. Otras indicaciones son preferencias, no garantías; negación y caracterización multilingüe aún requieren evaluación del proveedor. Procedencia completa y personalidad ligada a NPC recurrentes entre encuentros quedan pendientes. Nivel basado en HP sigue siendo indicador débil sin indicación.

Cada modo enumera ataques básicos, habilidades y defensas ejecutables; puntúa daño, remate, curación efectiva, apoyo, costo y táctica pertinente. No añade llamadas ordinarias al modelo. Los perfiles no conceden habilidades inexistentes, MP ilimitado, activaciones extra ni terreno ficticio.

- **Classic:** sin puntuación espacial. Mindless usa orden estable con semilla de rivales vivos, sin HP. Apoyo usa aliados correctos. Mejoras/debilitaciones aplican modificador defensivo nombrado real, no solo daño. Perfiles nuevos tienen recargas por uso. Compañeros manuales encolan ataque/habilidad/defensa en su iniciativa; inventario y acciones narrativas quedan con líder activo. Otros compañeros usan IA inicialmente, como la interacción establecida. Órdenes identifican actor incluso si el líder original está KO.
- **Tactical:** destinos legales de ataque/apoyo alimentan política. Mindless sigue mínimos pasos pagando costo real; vuelo/teletransporte conservan límites propios. Apoyo puede moverse antes de lanzar. Estimaciones de contraataque usan destino previsto. Exposición usa estimación conservadora de alcance público, no rutas completas del próximo turno. Un muro o una montaña bloquea la visión para cada golpe (combat C6).
- **Patient:** favorece espera defensiva acotada frente a intercambio malo; Classic espera una recarga próxima, no movimiento imaginario. No espera eternamente cuando hay acción útil.
- **Methodical:** prepara reducción de defensa admitida, conserva objetivo y ataca cuando el estado sirve. Sin árbol de combos inventado o búsqueda de tiradas futuras.
- **Coordinated:** considera objetivos aliados registrados y debilitaciones útiles, recalculando tras cada acción aceptada. Sin planificador omnisciente ni reservas de acciones aún no enviadas.
- **Compañeros:** selección Player/AI localizada por miembro dentro de batalla, manteniendo líder manual. Tactical actúa tras órdenes manuales restantes o End Turn. Se puede cambiar a manual antes de actuar. Controladores, perfiles y memoria persisten con combatientes/instantáneas.
- **Persistencia Classic:** resultados aceptados y siguiente número de ronda llegan al callback de instantánea antes de animación. Las recargas reales sobreviven. Classic conserva dados aleatorios existentes; no es repetición exacta ni registro idempotente del servidor. Garantías multipestaña corresponden al futuro trabajo autorizado de jefes.

El primer hito terminó antes de proveedores de jefe/reacciones; [Jefes GM, acciones legendarias y reacciones](#gm-bosses-legendary-actions-and-reactions) registra la implementación posterior. Siguen pendientes provocación, objetivos ricos, iniciativa específica, normalización completa de hojas y registro de NPC recurrentes. Lo no implementado sigue siendo trabajo de aceptación, no funcionalidad implícitamente publicada. Benchmarks sintéticos de computadora no calibran teléfonos físicos.

## Más adjetivos según clase

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

Mejores siguientes tras los once: **Frugal, Relentless, Disruptive y Vengeful**. Los dos primeros encajan con pequeños cambios de estado. Disruptive requiere incapacitación/disipación reales; Vengeful memoria de eventos. Adaptive da variedad pero exige más. Territorial ya se ha publicado para las peleas de conjunto de reglas como un temperamento que solo se asigna explícitamente por su nombre (IA de combate T4, arriba). Prueba solapamientos de Resolute y Zealous antes de ampliar vocabulario público.

Los tres añadidos solicitados también varían por clase:

| Adjetivo | Bruiser / Bulwark | Skirmisher / Marksman | Spellcaster / Supporter |
| --- | --- | --- | --- |
| Patient | Se prepara mientras mejora un mal intercambio; sostiene un acceso valioso Tactical | Espera alcance legal útil, sin forzar tiro débil | Conserva turno para hechizo casi listo o evita curación inútil; nunca espera regeneración de maná inexistente |
| Methodical | Debilita realmente y luego ataca a ese rival | Prepara vulnerabilidad admitida antes del golpe fuerte | Debilita antes de dañar o prepara defensa admitida; no reaplica efectos aún útiles |
| Coordinated | Presiona objetivo aliado o prepara ayuda útil | Remata lo que el grupo amenaza | Apoyo no redundante/debilitación aprovechable; recalcula tras cada acción |

Son metas de ajuste. La primera implementación usa defensa mejorada/debilitada genérica; combinaciones de clase más ricas necesitan habilidades y regresiones correspondientes.

<a id="summoning-design-extension"></a>

## Extensión Summoning

Empieza sin cuadrícula. Una invocación es combatiente real con ID estable, propietario, bando, perfil, controlador, duración, costo y presupuesto de activación explícitos. Clase modifica capacidades legales; adjetivo prioridades como Classic.

Separa **elección de invocación** del invocador de **política de combate** de la unidad. Patient puede reservar un espacio para después; Knight Protective protege con acciones admitidas; Mage Methodical prepara debilitación; sanador Coordinated evita duplicados. Invocaciones Beast/Monstrosity siguen Mindless incluso aliadas.

Las reglas deciden si ordenar consume acción del dueño, si actúa inmediatamente o próxima ronda, iniciativa compartida y conducta sin órdenes. Recomendación genérica: invocar consume acción ordinaria, primera activación siguiente ronda, IA del motor salvo control explícito. Retirar/reinvocar no da otro turno ordinario. Impón límite de población y una activación por ronda antes de enjambres.

KO del dueño, encanto/cambio de bando, retirada, expiración, derrota grupal y fin del encuentro requieren limpieza explícita. Guarda propietario/duración restante ante recarga/importación. Una invocación derrotada no es objeto ni miembro permanente. Cobra hechizo/MP una vez al aceptar creación. Sus acciones no fabrican ventanas legendarias fuera de la elegibilidad del modificador fijo.

<a id="gm-bosses-legendary-actions-and-reactions"></a>

## Jefes GM, acciones legendarias y reacciones

<a id="implemented-generic-engine-adapter"></a>

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
- Ayudantes quedan locales. GM solo en ventanas con elección significativa. Reutiliza conexión, depuración, alternativa guardada y límite agregado de [Turnos de jefes controlados por GM](#boss-turns-controlled-by-the-gm).

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

Contrato mínimo guardado: ID/revisión del encuentro; ID/cursor de activación; actor confirmado; tipo/ID de ventana; evento e IDs de acción pendiente/padre; revisiones de contexto y candidatos; orden de reactores elegibles/resueltos; presupuestos; deltas reservados/comprometidos/reembolsados; elección/paso aceptado; estado de resolución; resultado del proveedor/alternativa y efectos restantes. Acepta decisiones y costos/resultados atómicamente. Respuestas tardías/duplicadas no gastan otra vez. Restaurar reanuda ventana o reproduce resultado; rama/rebobinado aísla todo el registro, no solo narración. Restaurar texto no reembolsa reacción aceptada. El registro del servidor descrito en [Adaptador genérico Engine implementado](#implemented-generic-engine-adapter) aporta la implementación inicial; [Turnos de jefes controlados por GM](#boss-turns-controlled-by-the-gm) conserva contrato futuro.

Interfaz: muestra puntos legendarios, reacción disponible y costo; distingue anticipación de reacción disparada. Explica interrupción y si el hechizo se resuelve, falla o necesita nueva elección. Pensamiento/espera, reintento/alternativa y cancelación accesibles. Anuncia cargas cuando corresponda. No atribuyas alternativas locales al GM. No muestres puntuaciones/prompts internos en menú del jugador.

Pruebas requeridas: hechizos/recursos/objetos correctos en contexto; previsión con reservas agotadas; predicción Fireball plausible pero errónea; sin filtración de borradores/órdenes; sin explotar clics/reselección; jugador cambia acción legal tras anticipación; tiempo 5e nativo frente a regla casera; Counterspell solo tras lanzamiento legal; pasar hechizo débil frente a responder al letal; sin MP/slot/reacción; costo único al fallar; reembolso original según reglas; visibilidad/alcance prohibidos; múltiples reactores y contras anidadas; sin ventana legendaria extra por movimiento/golpe adicional/reacción; posición Classic correcta; orden manual invalidada; unidades omitidas Tactical/elegibilidad de invocación; presupuesto agotado; renovación una vez; muerte/final mientras espera; duplicados; timeout y éxito tardío; recarga, multipestaña, rama/rebobinado y cambios de ajustes. Después de rutas deterministas, valida proveedor real y ritmo móvil representativo.

<a id="encounter-environment-agent-handoff"></a>

## Guía del agente de entorno del encuentro

Se eliminan el área **Terrain guidance** (Orientación del terreno) y su resumen en creación. Archivos antiguos pueden conservar campo por compatibilidad, pero generación no lo inyecta en cada batalla. Battlefield Size sigue reutilizable. Batallas nuevas reciben semillas internas individuales; mapas/reinicios guardados conservan aceptadas. La etiqueta Tactical describe movimiento, terreno y previsiones sin nombre de otro juego.

Un futuro agente **Battlefield Scout** debe ejecutarse al preparar encuentro con ubicación actual, escena/entorno recientes, mapa creado, clima y eventos pertinentes. Envía al GM un informe breve antes de generar el encuentro, no al crear mundo ni por turno ordinario.

Límite:

| Responsable | Trabajo |
| --- | --- |
| `Pasta-Devs/Marinara-Agents`, `staging` | Definición, prompt predeterminado, ejecución del paquete, catálogo/manifest, recursos y ajustes del agente |
| Marinara Engine, `staging` | Integración previa al encuentro, entrada de escena acotada, resultado validado, conexión configurada, caché/alternativa y procedencia del terreno guardada |

Entradas con revisión de encuentro/ubicación y distinción entre observaciones y sugerencias inciertas. Salida: resumen corto del entorno admitido, rasgos acotados mediante `TacticalBattlefieldBrief` donde corresponda y referencias de fuente. Sin reglas ejecutables, coordenadas arbitrarias, recursos inventados, privilegios de jefe o cambios HP. Classic recibe peligros/contexto descriptivos, no modificadores de cuadrícula sin soporte.

GM recibe contexto aceptado y sigue creando encuentro; Engine valida terreno final. Cachea por revisión, descarta respuestas obsoletas tras viaje/cambio de escena y evita cobros repetidos al reintentar. Si está desactivado, falta o vence tiempo, usa contexto actual y terreno procedural alternativo normal. Guarda terreno aceptado, no lo regeneres al recargar. Añade logs de prompts y pruebas de esquema/timeout/ubicación vieja. El agente se documenta aquí; no se implementa en Engine ni instala silenciosamente.

## Dificultad y clima

### Configuración y dificultad

Elimina el campo **Battlefield Seed** (semilla del campo de batalla) y su resumen, y conserva **Battlefield Size** (tamaño del campo de batalla). Los encuentros nuevos reciben semillas aleatorias internas. Ignora las preferencias obsoletas de semilla de campaña al iniciar futuras batallas; conserva las semillas, cuadrículas y reinicios de las batallas aceptadas. Cambia la descripción de Classic a "Cinematic menu battles." (Batallas cinematográficas con menús).

Normaliza la dificultad mediante una función compartida, incluidas las configuraciones antiguas con inicial mayúscula. Conserva los multiplicadores de daño enemigo Casual 0,6, Normal 1, Hard 1,3 y Brutal 1,6. Classic debe escalar solo el daño enemigo, como Tactical. Revisa encuentros y botín para detectar el mismo error de mayúsculas. Fija la dificultad al crear el encuentro; no la cambies al modificar ajustes durante el combate.

Los multiplicadores actuales pertenecen únicamente a Traditional (la mecánica heredada actual de Engine). Al implementar 5e, V20 u otro conjunto de reglas, revisa la dificultad según la política propia de esas reglas. No heredes los multiplicadores de Traditional de forma predeterminada. Ajustar las decisiones de la IA es independiente de escalar el daño.

### Clima

Usa el clima de campaña existente y la exposición fundamentada del encuentro. Guarda el clima aceptado con el encuentro; la ausencia del campo en un combate antiguo significa mecánica neutral. La exposición desconocida es neutral. Los entornos cerrados están protegidos. Normaliza los alias actuales a los tipos de clima existentes; al establecer un tipo, genera viento y visibilidad compatibles.

Las reglas iniciales se aplican por igual a ambos bandos: la lluvia reduce moderadamente el daño de fuego y aumenta el de rayo; el viento fuerte penaliza los ataques marcados explícitamente como proyectiles; la mala visibilidad penaliza los ataques que requieren vista explícitamente; la nieve aumenta el costo de caminar en Tactical. El vuelo y la teletransportación conservan su semántica. No deduzcas los rasgos de proyectil/vista de los nombres de habilidades sin etiquetas. El clima despejado/nublado suele ser neutral. Las funciones compartidas deben gobernar previsiones, resolución y estimaciones de IA sin consumir futuras tiradas de combate.

Muestra las condiciones aceptadas y sus efectos en ambas interfaces. Los ajustes visuales del clima no pueden desactivar la mecánica. El clima permanece fijo durante el encuentro; se posponen las habilidades que lo cambian, las transiciones periódicas, los rayos aleatorios y el desgaste por calor. Summoning y futuras reglas pueden reutilizar el contrato compartido sin añadir un modo de interfaz incompleto.

### Decisiones de los enemigos

Conserva rol, adjetivo, competencia, legalidad y contabilidad de recursos. La dificultad modifica una variación de decisiones acotada y con semilla: Casual admite más errores plausibles, Normal queda cerca de la base actual, Hard es más consistente y Brutal minimiza errores sin eliminar las diferencias de competencia. Los compañeros usan una base fija Normal en cualquier dificultad; siguen respondiendo al clima y al peligro reales. Las restricciones de Mindless permanecen intactas.

Usa puntuaciones sensibles al clima para ataques, apoyo, posicionamiento y reacciones. Counterspell y guard compiten con pasar según amenaza, costo y personalidad. Ninguna dificultad concede órdenes ocultas, tiradas futuras, recursos gratuitos ni acciones adicionales. El prompt (las instrucciones enviadas a la IA) del jefe GM recibe la dificultad/clima aceptados y orientación sobre presión y oportunidades; el motor sigue imponiendo las opciones legales y los presupuestos ofrecidos. Si falla el proveedor, se conserva la alternativa local.

### Detalles de implementación

Las condiciones compartidas están en `packages/shared/src/features/combat-conditions.ts`. La dificultad se normaliza al importar/crear configuraciones y en los consumidores de encuentros, botín, Classic y Tactical. La variación de decisiones enemigas se multiplica por 2,5 / 1 / 0,4 / 0,15 para Casual / Normal / Hard / Brutal; la competencia y personalidad guardadas siguen vigentes. Classic estima con la misma probabilidad de impacto de d20 enfrentados que la resolución; Tactical usa la previsión de ataque compartida. La persecución Tactical ordena las rutas por costo de terreno y clima para los perfiles ordinarios. Las unidades Mindless eligen la ruta legal con menos pasos espaciales; ambas políticas pagan los costos reales de terreno y clima al moverse. Las reacciones valoran amenaza esperada y escasez, con la misma variación exclusiva de enemigos.

Con exposición a lluvia, lluvia intensa o tormentas, el daño de fuego se multiplica por 0,85 y el de rayo por 1,15. Los proyectiles explícitos pierden 10 puntos de precisión con viento fuerte y 15 con vendavales. Los ataques que requieren vista explícitamente pierden 5 con visibilidad reducida y 15 con mala visibilidad. La penalización combinada tiene un máximo de 25. Classic la convierte en modificadores de tiradas enfrentadas (un punto por cada cinco de precisión); su panel de condiciones identifica esas penalizaciones de tirada. En Tactical, la nieve/ventisca con exposición añade un punto de caminata por casilla; vuelo y teletransporte no cambian. Los objetos de daño elemental también reciben modificadores de lluvia; la curación y la duración de estados no.

El generador crea booleanos `projectile` / `requiresSight` para ataques básicos y habilidades, y `battlefield.terrainBrief.exposure`. Los rasgos ausentes son neutrales. Gana la exposición explícita; los entornos cerrados reconocidos están protegidos, los exteriores reconocidos expuestos y los ambiguos son desconocidos. El clima de campaña procede del sistema persistido, con el valor meteorológico de la escena confirmada como alternativa si falta. Las etiquetas de mensaje de inicio de combate detienen la progresión meteorológica de fondo antes de que el modo renderizado se actualice. Las condiciones aceptadas se guardan en el director y en el estado Tactical; se rechazan importaciones contradictorias o malformadas. Los guardados sin clima siguen neutrales. Los reinicios de Tactical heredado transmiten las condiciones aceptadas (incluida la ausencia neutral) en lugar de muestrear el clima de campaña cambiado.

La configuración sigue validando campos obsoletos de importación por compatibilidad y seguridad, pero los elimina de las exportaciones normalizadas. El motor conserva semillas explícitas de encuentro para restauración/reinicio y reproducción de regresiones. Esto no elimina las semillas de mundo de Experience, que tienen otra finalidad.
