# IA de combate do Game Mode: inimigos, companheiros e chefes do GM

**Status: a IA comum e a primeira implementação de chefes/reações do GM estão presentes localmente; Summoning e conjuntos de regras nomeados continuam como propostas.** Preparado em 17 de setembro de 2026 a partir do código de combate integrado ao staging pela [PR #6266](https://github.com/Pasta-Devs/Marinara-Engine/pull/6266). Base original auditada do staging: `1f2e965c34f77b19a1457439f61e291300e163c7`; o checkout `025442b1722b090b4640e0f078d1e08a4435f965` tinha a mesma implementação pertinente. A implementação local atual parte do staging `abe61d30a`. Verifique novamente o staging antes de continuar; os números de linha da auditoria original descrevem a base anterior.

Este documento é autossuficiente para que outra tarefa de desenvolvimento continue sem a conversa original. Registra requisitos do mantenedor, auditoria do código, padrões recomendados, limites de implementação e cenários de aceitação. Números e campos propostos fora do limite implementado da seção 13 não são contratos existentes nem alegações de equilíbrio testado. A implementação e as orientações são trabalho local; nenhuma issue ou PR foi enviada.

## Atualização de escopo de 17 de setembro

O mantenedor aprovou IA comum em Classic e Tactical e controle opcional de companheiros pela IA, depois autorizou a implementação complementar de chefes/reações do GM (mestre do jogo). Chefes criados explicitamente podem usar ações lendárias independentemente da escolha de um conjunto de regras 5e. O GM recebe fichas/recursos de combate da equipe e pode antecipar ações prováveis quando uma unidade inicia a ativação. Reações que consomem recursos, como Counterspell, exigem decisão do controlador, não uso incondicional sempre que disponíveis. Summoning continua como extensão de design. A auditoria original e o design completo abaixo foram preservados; as seções 13–17 especificam as decisões atuais e substituem a sequência restrita a Tactical, a proposta inicial de oito adjetivos, declarações anteriores de escopo apenas exploratório e o prompt original de chefe limitado ao estado observado.

O trabalho de execução é uma primeira implementação de política de utilidade, não a conclusão de todos os cenários de aceitação deste documento. Seus limites estão nas seções 13 e 16. A [orientação separada de implementação das regras](game-combat-rulesets-implementation.md) cobre golpes adicionais por velocidade de Traditional, ordem de turno/movimento, reservas de recursos e futuros perfis por edição.

## 1. O que o mantenedor pediu

- Inimigos comuns usam comportamento controlado pelo motor, descrito por **um adjetivo mais um papel de combate**, como Reckless Bruiser ou Cautious Spellcaster.
- **Somente inimigos de nível chefe recebem controle do GM por turno.** O motor ainda determina ações legais e resolve resultados. Controle de chefe significa escolher ações durante a luta, não apenas gerar um roteiro antes dela.
- A atribuição de adjetivos pondera proficiência/nível, papel e personalidade conhecida, com alguma aleatoriedade. Inimigos experientes devem ter mais frequentemente hábitos adequados ao papel, sem tornar todos os veteranos iguais.
- **Todo Beast e Monstrosity é Mindless.** Persegue o membro mais próximo da equipe pelo trajeto legal mais curto, ignorando saúde do alvo e vantagens/desvantagens de terreno. Não isente discretamente chefes ou criaturas nomeadas.
- Otimize diversão estratégica, comportamento plausível e rejogabilidade, sobretudo em jogo tático e futuro semelhante a RPG de mesa. Isso não exige implementar regras 5e ou V20 na mudança da IA.
- Preserve um design detalhado para implementação posterior. O escopo exploratório original foi ampliado para IA comum e controle de companheiros; veja a atualização acima.

A direção relacionada está no [roteiro de combate](game-combat-roadmap.md): regras de campo de batalha, participação da equipe/invocações e perfis de regras de mesa são escolhas independentes. Táticas inimigas também devem permanecer independentes. Summoning continua como prioridade posterior.

### Padrões recomendados que ainda precisam de aceitação de design

1. Comece com oito adjetivos: Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly.
2. Mostre adjetivo e papel na inspeção do inimigo, com breve explicação. Mantenha probabilidades, pesos de utilidade e análise bruta de personalidade fora da interface normal.
3. Interprete o trajeto mais curto de Mindless como **menos passos espaciais legais**, não menor custo de movimento do terreno. Ele pode atravessar uma rota menor de floresta mesmo quando uma rota aberta mais longa seria mais rápida. O movimento ainda consome o custo real do terreno.
4. Um chefe Beast/Monstrosity continua Mindless. O GM escolhe somente ações compatíveis com o alvo e a perseguição exigidos.
5. Perfis comuns são sorteados uma vez e salvos. Um NPC (personagem não jogável) recorrente nomeado mantém o temperamento estabelecido; ganhar um nível por si só não sorteia sua personalidade novamente.
6. Implemente IA comum em Tactical e Classic juntos no escopo revisado. Concluir todo o sistema pedido inclui turnos reais de chefes do GM; um marco só do motor não deve ser apresentado como a funcionalidade inteira.

## 2. Auditoria do código antes da reformulação

A segunda hipótese do mantenedor é a mais próxima: cada motor ativo tem uma política automática comum. O GM cria o encontro; não escolhe turnos individuais nas interfaces ativas de batalha do Game Mode.

| Área | Classic Game Mode | Tactical Game Mode |
| --- | --- | --- |
| Ordem de turnos | Lançamentos de iniciativa mais velocidade; todos os combatentes participam | Por iniciativa em jogos novos (uma unidade por vez, ordem rolada uma única vez, combate C6c); por lado nos mais antigos (fase do jogador, depois inimigos por velocidade) |
| Política inimiga | Heurística compartilhada de capacidades, senão alvo adversário vivo aleatório | Política compartilhada de curar primeiro, ataque pontuado, depois aproximação |
| Diferenças de classe | Nenhuma política decisória específica por classe | Seis classes alteram alcance, movimento e crítico; todas usam a mesma política |
| Personalidade/proficiência | Nenhum modelo salvo de personalidade tática ou treinamento | Nenhum modelo salvo de personalidade tática ou treinamento |
| Decisões de chefes | Mesma política comum, mais mecânicas roteirizadas com suporte | Mesma política comum; marcador de chefe afeta posição/interface |
| GM em cada turno | Fora do resolutor ativo | Fora do resolutor ativo |
| Reprodutibilidade | Decisões/lançamentos aleatórios sem semente | Semente mais contador de ações governam decisões e lançamentos de combate |
| Persistência | Cliente restaura snapshot de combate; estado de rodada/animação não é totalmente salvo | Cliente persiste snapshot tático completo nos metadados do chat |

Também existe um sistema separado de modal de encontro, com rota `/encounter/action` guiada pelo modelo e tipos de ações de combate. É usado pelo `EncounterModal` geral do chat através de `useEncounter`, não pelo `GameCombatUI` atual do Game Mode. Esse modelo pode retornar estado de combate reescrito; não o reutilize sem mudanças para o controlador de chefe proposto e validado pelo motor. Rastreie chamadores reais antes de reutilizar ou excluir qualquer coisa.

A manobra explícita **Special** (ação livre) de Classic também pede ao GM que julgue uma ação narrativa e permite tags de estado/elemento com suporte. Não resolve uma rodada comum nem escolhe turnos inimigos de rotina. Preserve essa distinção ao atualizar prompts do GM; controle de turno restrito a chefes não proíbe geração de encontro, julgamento narrativo ou narração pós-combate.

### Política Classic

Em `combat.service.ts`, `resolveCombatRound` chama `chooseAutoSkill` para aliados e inimigos automáticos:

1. Uma capacidade é utilizável se há MP suficientes e a recarga passa em uma verificação de módulo da rodada.
2. Cura o aliado elegível mais ferido se estiver com até 75% de HP e houver capacidade de cura.
3. Caso contrário, com chance de 45%, escolhe uma capacidade aleatória que não seja de cura e um alvo inimigo aleatório.
4. Caso contrário, ataca um adversário aleatório.

Inimigos passam apenas a si mesmos como lista de aliados, portanto não curam outros inimigos por essa política atualmente. Não cura inclui melhorias e ataques/enfraquecimentos; qualquer substituição deve validar o lado pretendido de cada capacidade, sem manter esse agrupamento. Na prática, a omissão de MP dos inimigos gerados abaixo impede o uso de capacidades de custo positivo, restando ataques básicos de alvo aleatório. O primeiro combatente vivo do lado do jogador recebe o comando enviado; os demais aliados agem automaticamente. Mudar táticas inimigas não deve alterar silenciosamente controle dos companheiros ou identidade do jogador.

Mecânicas geradas são processadas separadamente após ações normais. Atualmente só `round_interval` e `hp_threshold` executam; gatilhos aceitos `on_hit`, `on_attack` e `passive` não. Mecânicas de limite de HP repetem-se nas rodadas posteriores elegíveis, e `damage_one` escolhe o primeiro alvo adversário. Isso não é um GM escolhendo ao vivo o movimento do chefe. Diferencie explicitamente efeitos únicos e recorrentes antes de adaptá-los.

Classic também resolve capacidades que não curam por um caminho orientado a dano; melhorias/enfraquecimentos não equivalem às operações de apoio Tactical, embora um estado nomeado possa acompanhar um acerto. Semântica real de apoio/controle e recargas por uso são pré-requisitos para anunciar esses comportamentos em Classic. Ações automáticas de defender/esperar também precisam de suporte do resolutor; a defesa atual pertence à posição de iniciativa do jogador controlado, então inimigos mais rápidos agem antes dela. A dificuldade atualmente escala o dano de ataque dos dois lados pelo resolutor comum, não a qualidade decisória. Preserve ou altere isso separadamente do ajuste de temperamento.

Uma divergência existente de controle do jogador merece prova própria: o servidor transfere comandos ao primeiro aliado vivo quando a posição zero está KO, enquanto o índice do jogador ativo na interface permanece em zero. Um ID de capacidade indisponível pode então recair no ataque básico. Registre/corrija isso independentemente, sem ligar ao temperamento inimigo.

### Política Tactical

Atualmente, `packages/shared/src/features/tactical-combat/ai.ts`:

1. Tenta a primeira cura pronta no aliado com menor proporção de HP a até duas casas, se ele tiver até 60% de HP. Não se move primeiro para entrar no alcance da cura.
2. Avalia destinos de movimento alcançáveis contra adversários vivos, considerando ataques básicos e capacidades de ataque prontas.
3. Pontua ataques como `1000 * likelyKill + expectedDamage - 0.75 * counterRisk`. Aqui, likelyKill significa que o dano previsto alcança os HP atuais com chance de acerto de pelo menos 50%; não é morte garantida.
4. Ocasionalmente substitui o melhor ataque não letal por outro ataque legal aleatório. As probabilidades são 60% casual, 30% normal, 10% hard, 0% brutal. A aceitação de cura é 50%, 80%, 100%, 100%, respectivamente.
5. Sem ataque disponível, aproxima-se do adversário mais próximo por Manhattan usando a casa alcançável mais próxima por Manhattan. Isso não é perseguição por caminho mínimo no tabuleiro inteiro e pode deixar de progredir ao redor de obstáculos.

O terreno influencia movimento e previsões de dano/acerto, mas a política não avalia em geral onde a unidade ficará exposta na próxima fase do jogador. Não seleciona deliberadamente melhorias, enfraquecimentos, defesa ou itens. O alcance das capacidades é simplificado. Descrições geradas de AoE não constituem um resolutor espacial completo de efeitos de área.

As classes são Fighter, Knight, Rogue, Archer, Mage e Healer. A derivação usa indicação explícita, capacidades de cura, palavras-chave dos nomes/capacidades, ataques elementais e heurísticas de atributos. Um rótulo de papel sozinho não cria capacidades.

### Lacunas fundamentais que prejudicariam um sistema de personalidades

Estes são achados de inspeção do código, não alegações de reprodução executada no navegador:

| Lacuna | Evidência e consequência | Próximo passo restrito |
| --- | --- | --- |
| Inimigos gerados não têm MP | `generatedEnemyToCombatant` omite MP/maxMP; capacidades geradas não básicas têm custo positivo de MP. Os dois motores tratam MP ausentes como zero. Esses inimigos não podem usar tais capacidades. | Acrescente regressão pela hidratação real do blueprint; preserve recursos explícitos ou aplique uma regra documentada de recursos para inimigos gerados. Não conceda magias ilimitadas. |
| Nível é deduzido dos HP | O nível do inimigo gerado normalmente vem de maxHP/20 arredondado. Uma criatura resistente não é necessariamente treinada em tática. | Acrescente indicação limitada de proficiência; use nível apenas como alternativa declarada até os perfis de regras fornecerem dados apropriados de treinamento. |
| Identidade de chefe é heurística | Tactical marca o inimigo mais forte em grupos de dois ou mais por maxHP + level\*10 + attack. Um inimigo sozinho nunca é marcado por essa heurística. | Acrescente identidade explícita de chefe por inimigo. O nível musical do encontro não identifica sozinho qual unidade recebe turnos do GM. |
| Mecânicas de chefes gerados não chegam a Tactical | Classic recebe propriedades das mecânicas; Tactical não consome a lista gerada. | Mapeie mecânicas com suporte para operações táticas validadas, com estado salvo de fase/gatilho. Identifique mecânicas sem suporte em vez de narrá-las como executadas. |
| Tipo de criatura e personalidade não são contratos de execução | A descrição existe no blueprint, mas é descartada na hidratação; Beast/Monstrosity não são categorias tipadas. | Leve categoria explícita e entradas limitadas de atribuição por todas as conversões e fronteiras de persistência. |
| Visão e cobertura em Tactical são compartilhadas (combate C6) | Uma parede ou uma montanha bloqueia a visão tanto em lutas nativas quanto em lutas de conjunto de regras, e a cobertura é graduada pelo mesmo teste (meia, três quartos): previsões, ações, contra-ataques, áreas, reações, sobreposições de ameaça e a IA usam `hasLineOfSight` e `coverTier`. | Mantenha um único teste de visão e um único teste de cobertura para todos os chamadores. |
| Previsões de candidatos da IA leem a casa candidata | As duas IAs preveem um ataque, e o contra-ataque que ele arrisca, a partir da casa de onde atacariam, então a cobertura (combate C6a-2) é pesada como será rolada. | Mantenha previsões e resolução no mesmo `hitChance`. |

Outra lacuna de conversão afeta os dois motores: o tipo de ataque gerado é deduzido de palavras-chave inglesas no nome/descrição, enquanto a prosa do encontro pode ser gerada em outros idiomas. O marcador `AoE`/`both` do blueprint também não sobrevive como comportamento real de múltiplos alvos. Campos explícitos e validados de capacidade devem alimentar a derivação futura do papel; nomes traduzidos não devem determinar se uma magia cura ou ataca.

Não inclua uma reescrita completa de combate nesses pré-requisitos. Acrescente as menores provas, corrija o fluxo pertinente e reutilize helpers existentes de movimento, previsão, prontidão de capacidades e resolução de ações.

## 3. Separar capacidade, temperamento e controle

Cada inimigo precisa de respostas para perguntas diferentes:

| Dimensão | Significado | Exemplo |
| --- | --- | --- |
| Categoria de criatura | Aplica regras de tipo obrigatórias | Beast força Mindless |
| Papel | Para que suas capacidades reais servem | Supporter tem capacidades utilizáveis de cura/melhoria |
| Temperamento | O que valoriza ao escolher entre ações legais | Cautious valoriza ficar fora de perigo |
| Proficiência | Com que consistência executa seus hábitos | Um Reckless Bruiser veterano ainda assume riscos, mas desperdiça menos ações |
| Controlador | Quem escolhe a ação | Motor para inimigos comuns; GM para chefes explícitos |
| Objetivo do encontro | O que o lado busca alcançar | Derrotar equipe agora; proteger/fugir/capturar depois |

Use inicialmente um adjetivo principal. Não introduza acúmulo arbitrário de traços, editor de vetores de personalidade, dependências de árvores de comportamento nem framework geral de planejamento. Uma pequena tabela de perfis sobre candidatos legais compartilhados basta.

### Papéis baseados nas capacidades

Mantenha classes táticas existentes como presets de geometria/atributos. Um pequeno mapeamento de papéis de política pode refiná-las quando as capacidades justificarem:

| Papel proposto | Evidência de capacidade | Tarefa típica | Adjetivos prováveis |
| --- | --- | --- | --- |
| Bruiser | Ataques fortes de curto alcance | Aproximar e trocar dano | Reckless, Disciplined, Opportunistic |
| Bulwark | Capacidades resistentes de corpo a corpo | Manter posição útil perto de aliados vulneráveis | Protective, Disciplined, Cautious |
| Skirmisher | Mobilidade mais dano útil de curto alcance | Escolher confrontos favoráveis | Opportunistic, Cautious, Reckless |
| Marksman | Ataques sustentados à distância, possivelmente com alcance mínimo | Manter distância útil de tiro | Cautious, Disciplined, Opportunistic |
| Spellcaster | Magia ofensiva utilizável e sua reserva de recursos | Pressionar à distância sem desperdiçar capacidades limitadas | Cautious, Disciplined, Opportunistic |
| Controller | Enfraquecimentos/controle utilizáveis | Enfraquecer ameaça pertinente | Disciplined, Opportunistic, Cautious |
| Supporter | Capacidades utilizáveis de cura/melhoria | Manter o grupo eficaz | Supportive, Protective, Cautious |

São tendências iniciais, não proibições. Um Cowardly Fighter ou Reckless Spellcaster deve continuar possível. Um Cleric com armadura e capacidades de corpo a corpo pode ser Bulwark; um curador pode preferir a retaguarda. Não deduza temperamento apenas de estereótipo de classe. Esgotamento temporário de MP muda ações legais, não papel ou adjetivo salvos. Não atribua Supportive a capacidades que nunca permitiram apoio.

## 4. Catálogo de adjetivos

### Oito iniciais

| Adjetivo | Preferência de alvo | Posicionamento e risco | Comportamento de capacidades/recursos | O que o jogador pode aprender |
| --- | --- | --- | --- | --- |
| **Mindless** | Membro vivo e alcançável mais próximo da equipe, pela regra da seção 6 | Rota espacial legal mais curta; ignora utilidade do terreno, exposição e formação | Ataque legal simples nesse alvo; sem triagem de cura, fogo concentrado ou otimização de recursos | Atraí-lo com proximidade, terreno e gargalos |
| **Reckless** | Dano imediato e pressão alcançável; não automaticamente a vítima mais fraca | Aproxima-se agressivamente, tolera contra-ataques e destinos expostos | Gasta prontamente ataques fortes disponíveis; raramente para para defender | Punir avanço excessivo e atraí-lo para trocas ruins |
| **Cautious** | Alvos que pode ameaçar limitando o dano de retorno | Valoriza destinos seguros, alcance útil e terreno defensivo | Preserva recursos escassos quando o ataque básico é quase tão útil; cura/defende quando necessário | Pressionar seu espaço seguro; explorar a relutância em se comprometer |
| **Opportunistic** | Alvos feridos, expostos ou já comprometidos; chances confiáveis de finalizar | Aceita algum risco por uma abertura concreta | Valoriza a capacidade que cria ou explora a abertura | Proteger aliados vulneráveis e negar finalizações fáceis |
| **Protective** | Ameaças a um aliado vulnerável designado ou grupo próximo apoiado | Fica a distância de apoio; ocupa casas úteis de bloqueio quando legal | Usa defesa/apoio para preservar o protegido; ataca quando proteger não é urgente | Separar o grupo ou aproximar-se de várias direções |
| **Supportive** | Saúde dos aliados e melhorias úteis antes do dano próprio | Move-se para alcance legal de apoio evitando exposição desnecessária | Cura perdas relevantes de HP, evita excesso inútil de cura/melhorias duplicadas, ataca quando apoiar acrescenta pouco | Pressionar o apoiador ou separá-lo dos beneficiários |
| **Disciplined** | Alvos eficazes para o papel, oportunidades sensatas de finalizar | Equilibra dano, segurança, posição e recursos; compromisso moderado com alvo | Fundamentos confiáveis do papel sem se especializar em extremo | Perturbar seu papel e forçar escolhas desfavoráveis |
| **Cowardly** | Alvos alcançáveis com segurança que não convidem retaliação | Autopreservação cresce muito com ferimentos ou inferioridade numérica local; recua para espaço aliado seguro | Cura-se/defende mais prontamente e evita compromissos caros | Cortar retirada segura e aplicar pressão sustentada à distância |

Protective não redireciona magicamente dano, provoca, intercepta ataques nem ganha reações. A ocupação atual permite bloqueio posicional; proteção mais forte precisa de capacidades reais. Cowardly pode recuar e defender, mas a ação `flee` existente em Tactical encerra toda a batalha. **Nunca use fuga global como fuga de um único inimigo.** Retirada/rendição por unidade exige regras novas explícitas.

Cautious e Cowardly devem produzir resultados diferentes: um Cautious Marksman saudável assume uma boa posição de tiro; um Cowardly Marksman ferido pode abrir mão de um bom tiro para se preservar. Protective e Supportive diferem de forma semelhante: um guarda pessoa ou posição, o outro maximiza ações úteis de apoio.

### Expansão candidata, somente com comportamento distinto e prova

| Adjetivo | Comportamento distinto | Necessário antes da entrega |
| --- | --- | --- |
| Vengeful | Compromete-se com o último atacante ou assassino testemunhado de um aliado mesmo se outro alvo for um pouco melhor | Pequena memória persistida de combate; troca legal quando o alvo estiver indisponível |
| Patient | Mantém posição valiosa e deixa inimigos entrarem no alcance favorável | Regras limitadas de manter/engajar e proteção de progresso contra espera infinita |
| Predatory | Persegue alvos isolados e avança quando surge abertura | Medida de isolamento; não deve substituir Mindless obrigatório em Beast/Monstrosity |
| Fanatical | Sacrifica segurança por ritual, líder ou missão explícitos | Objetivos de encontro com progresso e condições de falha visíveis |
| Methodical | Constrói sequência de enfraquecimento/ataque com suporte em vez de perseguir dano imediato | Dependências explícitas de combo, memória limitada e distinção clara de Disciplined |
| Coordinated | Considera intenções aliadas e reduz ataques/apoio redundantes | Intenção limitada da equipe, sem coordenação perfeita onisciente |
| Territorial | Defende local e para de perseguir além de um limite | Território/objetivo salvo e desengajamento legível |
| Deceptive | Usa finta, isca ou ocultação reais para desorientar | Mecânicas de engano/percepção com suporte; a narração sozinha não cria efeito |

Evite lançar sinônimos com pontuação idêntica. Cruel é principalmente Opportunistic salvo objetivo distinto nas regras. Strategic é melhor reservado para planejamento limitado real, não um rótulo de melhor em tudo. Coragem e inteligência não precisam ser extremos opostos da mesma escala.

## 5. Atribuir perfis: papel, experiência, personalidade e variedade com semente

### Precedência

1. Valide a categoria explícita da criatura. Beast ou Monstrosity força Mindless, independentemente de nível, personalidade, dificuldade ou status de chefe. Indicações conflitantes de adjetivo geradas pelo modelo são descartadas com a proveniência da atribuição. Um perfil resolvido explicitamente criado/importado conflitante é rejeitado com erro que permita correção; não reescreva silenciosamente uma escolha criada e salva.
2. Preserve um perfil válido já resolvido ao retomar um encontro. Preserve o temperamento estabelecido de um NPC recorrente conhecido quando houver identidade estável.
3. Respeite um perfil criado para outras criaturas se compatível com suas capacidades. Entrada explícita sem suporte ou conflitante recebe erro claro de validação; entrada ausente recebe padrões.
4. Resolva o papel pelas capacidades reais, com indicação validada de papel para conjuntos ambíguos.
5. Calcule proficiência, tendências iniciais do papel e ajustes limitados de personalidade.
6. Sorteie um perfil por escolha ponderada com semente; salve resultado e versão da política.

Mindless fica inicialmente fora da atribuição aleatória comum. Comportamentos futuros criados para mortos-vivos/construtos podem usá-lo, mas sua regra obrigatória Beast/Monstrosity deve continuar aplicada. Para inimigos legados de categoria desconhecida, use valor explícito `unknown`; não suponha que um nome contendo "beast" declare taxonomia.

### Proficiência não é HP, dificuldade ou valor moral

Prefira um nível de treinamento fornecido pelo perfil de regras ou dados confiáveis da ficha do NPC. Depois use uma indicação explícita validada do encontro. Recorra ao nível somente se nenhum existir, registrando a fonte. O nível atual derivado de HP é uma alternativa fraca e não deve virar silenciosamente uma medida autoritativa de inteligência.

Na implementação inicial neutra às regras, os graus novato/treinado/veterano/mestre poderiam mapear para competência `c = 0, 0.35, 0.7, 1`. Uma alternativa provisória concreta de nível do Engine é nível 1–2 novato, 3–7 treinado, 8–14 veterano, 15+ mestre. É uma curva ajustável de design de jogo, não regra de mesa; marque a fonte como `level-fallback`, especialmente enquanto níveis forem derivados de HP. Fixe o mapeamento na versão de atribuição e substitua-o por mapeamentos de perfis quando existirem. Não iguale nível de desafio de 5e a nível de personagem nem imponha uma escala única a jogos como V20.

A experiência influencia **tanto** a chance de temperamento adequado ao papel na primeira atribuição quanto a consistência em segui-lo. Na IA local comum, não revela capacidades ocultas do jogador nem comandos na fila. Chefes do GM têm a consciência mais ampla das fichas especificada na seção 16; nenhum controlador vê futuros lançamentos aleatórios ou conhece uma escolha não confirmada do jogador. A premissa de sobrevivência é uma tendência útil para construção do mundo, não uma lei factual de que todo mago veterano é cauteloso.

### Um modelo concreto de ponderação

Use uma pequena tabela de papel/adjetivo e uma fórmula limitada. Valores iniciais de exemplo, sujeitos a testes de jogo:

```text
w[a] = baseRoleWeight[role,a] * exp(1.2*c*roleAffinity[role,a] + 1.5*q*personalityMatch[a])
P[a] = 0.94 * w[a]/sum(w) + 0.06/N
```

- `c`: competência, 0..1.
- `roleAffinity`: adequação definida de -1..1; algumas personalidades funcionam em mais de um papel.
- `personalityMatch`: evidência limitada de -1..1, não números irrestritos fornecidos pelo modelo.
- `q`: confiança na personalidade conhecida, 0..1; zero quando desconhecida.
- `N`: número de adjetivos compatíveis; remova perfis incompatíveis antes de normalizar. Se nenhum restar, use alternativa Disciplined/básica validada e registre o problema da entrada.
- A mistura de 6% dá uma pequena chance a cada perfil incomum compatível. Nunca enfraquece regras rígidas de tipo.

Exemplo de **conjurador versátil com capacidade de apoio**, sem evidência de personalidade:

| Adjetivo | Peso base | Afinidade do papel | Probabilidade novato | Probabilidade mestre |
| --- | --- | --- | --- | --- |
| Cautious | 4 | 1 | 23,0% | 35,8% |
| Disciplined | 4 | 1 | 23,0% | 35,8% |
| Opportunistic | 3 | 0,5 | 17,4% | 15,2% |
| Supportive | 1 | 0 | 6,4% | 3,5% |
| Protective | 1 | 0 | 6,4% | 3,5% |
| Reckless | 2 | -1 | 11,9% | 2,4% |
| Cowardly | 2 | -0,5 | 11,9% | 3,7% |

Arredondamentos podem impedir soma exata de 100%. Uma personalidade sabidamente imprudente aumenta o peso de Reckless mesmo com alta competência. O adjetivo existente de um NPC nomeado não deve ser sorteado novamente a cada mudança de nível. Os números ilustram a tendência desejada, não o equilíbrio final.

### Extração de personalidade sem chamada de modelo a cada turno comum

Use a chamada existente de geração de encontro para interpretar a personalidade conhecida do personagem/NPC em no máximo três indicações de enumeração fechada, cada uma com confiança baixa/média/alta e referência de origem limitada. Exemplos: leal, propenso a riscos, autopreservador, compassivo, paciente. O motor mapeia indicações para pesos numéricos. Não peça ao modelo probabilidades arbitrárias nem código de execução.

Use personalidade realmente conhecida quando presente. Uma aparência como "um mago com cicatrizes" não prova cautela. Negação importa: "não covarde" não deve favorecer Cowardly. Descrições multilíngues e contraditórias precisam de fixtures de regressão. Se a extração estiver ausente, malformada ou sem suporte, não aplique ajuste de personalidade; papel, proficiência e RNG bastam. Correspondência de palavras-chave sozinha não deve ser anunciada como compreensão semântica.

Persista indicações/proveniência aceitas necessárias para explicar a atribuição, não transcrições do raciocínio do modelo. A identidade estável de NPC deve vir de referências existentes de entidades, não só de nomes exibidos. Monstros anônimos repetidos podem receber novos perfis de encontro; personagens nomeados recorrentes precisam de perfil ligado à identidade antes de prometer consistência entre sessões.

### Limites da aleatoriedade

- Use uma semente de atribuição de IA derivada da semente do encontro, ID estável do inimigo e versão de atribuição. Separe seu domínio da geração de terreno e dos lançamentos de combate.
- Não consuma RNG de combate apenas para enumerar/pontuar candidatos ou renderizar previsões.
- Salve o perfil resolvido. Atualização, nova tentativa, importação, retorno a checkpoint e reinício da mesma batalha não devem sortear acidentalmente novo temperamento.
- Novos encontros/sementes podem variar composição e temperamentos. Um novo sorteio explícito deve criar revisão do encontro, não alterar secretamente a luta atual.
- Tactical atualmente compartilha um cursor com semente para decisões e resultados. Alterar seu uso é mudança de comportamento versionada; preserve a política antiga em andamento ou forneça migração explícita testada.
- O resolutor Classic sem semente precisa de adaptador separado de RNG/persistência antes de alegar reprodução exata.

## 6. Mindless: contrato exato de perseguição

Esta é uma regra solicitada do projeto para Beast/Monstrosity, não uma alegação de que esses rótulos impliquem tal comportamento nas regras oficiais de mesa ou no comportamento animal real.

### Alvo e rota

1. Considere membros vivos da equipe e posições legais de onde o ataque simples designado da criatura alcança cada um. A casa ocupada do alvo não é destino legal.
2. Para caminhar, procure no tabuleiro rotas legais mais curtas medidas em **passos da grade**, ignorando sobretaxa do terreno na classificação. Paredes, água e montanhas ainda bloqueiam caminhantes comuns. Aliados podem ser atravessados nas regras atuais; terminar em posição ocupada continua proibido.
3. Prefira o membro da equipe que exija menos passos até uma posição legal de ataque. Entre objetivos de ataque igualmente alcançáveis, prefira o alvo espacialmente mais próximo, depois ID estável e ordem de coordenadas. Nunca desempate por HP, defesa, evasão, classe ou dano previsto.
4. Siga a rota escolhida até onde o orçamento real de movimento do turno permitir. Floresta ainda custa dois pontos. Escolha o ponto de parada legal desocupado mais distante nessa rota, não um atalho mais barato fora dela por vantagem tática.
5. Se ficar em alcance legal após mover, use o ataque simples designado contra o alvo. Caso contrário, espere após mover. Ataque básico é o padrão; um ataque característico inato validado pode ser designado na criação. Não procure a melhor capacidade de dano nem mude o alvo por um grupo em AoE.
6. Recalcule na próxima ativação pelo tabuleiro atualizado. Se uma rota for bloqueada, escolha o próximo alvo alcançável. Se nenhum for, espere; nunca ataque por atalho ilegal de movimento nem entre em loop infinito.

O objetivo é um perseguidor deliberadamente simples, não uma falha de busca de caminho. Uma parede em U pode exigir afastar-se temporariamente pela distância Manhattan. A busca pelo tabuleiro inteiro deve encontrar essa rota.

**Exemplo de terreno:** rota A usa três passos legais por floresta; rota B usa cinco por planícies. Mindless seleciona A mesmo com custo maior de movimento. Ainda recebe defesa/evasão da floresta se terminar nela e paga seu custo. Um inimigo Cautious pode preferir intencionalmente uma posição defensiva na floresta; um Mindless ganha o mesmo bônus incidentalmente.

Para voo e teletransporte, use seu contrato real de movimento. Voo cruza solo bloqueado e casas ocupadas e pode pairar em terreno normalmente intransitável; teletransporte cruza obstáculos intermediários, mas exige terreno de chegada legal. Nenhum pode terminar em casa ocupada. A métrica de distância é Manhattan nas regras atuais de grade plana, não "um salto de teletransporte para qualquer lugar". Em vários turnos, perseguição por teletransporte precisa de rota por posições legais de chegada alcançáveis; nunca escolha um alvo aparentemente próximo além de um vão maior que todos os saltos legais. Defesa/evasão do terreno continuam efetivas em todos os modos de movimento.

Não implemente permissões paralelas de travessia, sutilmente diferentes, só para Mindless. Extraia/reutilize os predicados de movimento existentes. A preferência de rota pode ignorar custo enquanto a execução continua usando legalidade e custos normais.

### Exclusões rígidas e precedência de chefes

Mindless não inspeciona HP para escolher vítimas; não otimiza chance de matar; não escolhe terreno por cobertura; não coordena fogo concentrado; não cura aliados feridos; não recua por medo; nem troca de alvo porque outra classe é mais valiosa. Dificuldade e proficiência não podem restaurar esses comportamentos.

Para um chefe Mindless, restrinja o menu do GM ao alvo escolhido e à perseguição obrigatória, com opções legais de assinatura/fase que não evitem as restrições. Se restar apenas uma ação, execute sem chamada inútil ao modelo. Uma exceção futura para chefes Beast/Monstrosity inteligentes seria mudança deliberada de regra do produto que exige acordo do mantenedor, não conveniência de implementação.

Classic não tem distância espacial. Não pode implementar fielmente "mais próximo pelo caminho mínimo". Uma adaptação proposta é uma ordem de engajamento do encontro salva e com semente, sem pesos de HP/terreno, mirando a primeira entrada viva. **A implementação não espacial revisada usa essa abstração** e deve ser identificada assim; não satisfaz a exigência espacial exata. Não descreva a abstração como distância; uma regra real de alvo mais próximo exigiria um futuro modelo de formação/posição. Formação frontal/traseira poderia fornecer essa regra mais tarde; ordem de array não deve virar distância silenciosamente. A regra de caminho Tactical continua sendo o comportamento normativo de Mindless nesta proposta.

## 7. Decisões de inimigos comuns

### Reutilizar o resolutor; variar prioridades

Gere primeiro ações candidatas legais, depois pontue com pesos de papel e adjetivo. Use helpers existentes de movimento, previsão e prontidão; acrescente a menor função reutilizável de legalidade necessária à IA do motor e às unidades do GM. Não chame `performUnitAction`, que apenas altera estado, com entrada não validada do modelo.

Os candidatos devem incluir:

- Ataque básico e capacidades de ataque utilizáveis, incluindo destinos legais para mover e agir.
- Cura, melhorias e enfraquecimentos no lado correto, incluindo mover para alcance de apoio.
- Defender, esperar e movimento com propósito quando não houver ataque/apoio útil disponível.

Inclua só mecânicas realmente atendidas pelo resolutor. Itens inimigos precisam primeiro de inventário/contabilidade reais. O pontuador não pode inventar geometria AoE, invocações, provocações, novas reações, ataques de oportunidade, cobertura ou fuga. Tactical já tem contra-ataques e defender/esperar; Classic precisa de defesa/espera automática explícita e operações adequadas de melhoria/enfraquecimento antes de oferecer perfis equivalentes. Isso é trabalho do resolutor, não só pesos diferentes.

Use fatores normalizados para dano esperado, probabilidade de finalizar, cura/apoio úteis, risco imediato de contra-ataque, exposição na próxima fase, progresso para alcance de engajamento do papel e custo de recurso. Multiplique por uma pequena tabela de perfis. Um bônus universal enorme de abate apagaria as diferenças de temperamento; substitua por valor limitado de finalização dependente do perfil na política nova.

Esta é uma abordagem pequena de pontuação de utilidade: comparar ações legais em escalas consistentes e variar prioridades pela personalidade. A abordagem geral e a inércia decisória são descritas em [An Introduction to Utility Theory](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf), de David "Rez" Graham. Perfis, fórmula, padrões e plano de integração concretos aqui são recomendações de design específicas do Marinara.

### Proteções práticas

- Calcule previsões desde o destino hipotético, incluindo terreno, sem alterar estado real nem consumir RNG. A probabilidade de contra-ataque deve corresponder às regras reais de acerto/sobrevivência/contra-ataque; não chame um tiro de 50% de abate certo.
- Estime o perigo da próxima fase por posições observáveis atuais e ataques conhecidos. Nada de olhar RNG futuro ou ler comando pendente do jogador. Mantenha uma estimativa limitada a uma ativação antes de considerar busca mais profunda.
- Evite repetição excessiva de curas: valorize cura efetiva, urgência, custo de oportunidade e MP. Um arranhão de um HP não deve superar automaticamente uma ação importante. Evite renovar melhoria ainda útil sem benefício.
- Evite oscilação: mantenha alvo/protegido válido salvo opção significativamente melhor. Salve só a pequena memória usada. Mindless segue seu contrato de alvo mais próximo em vez dessa persistência tática.
- Evite afastar/defender sem fim: sem apoio relevante ou progresso de retirada, favoreça engajamento útil. Use proteção limitada contra estagnação; não force uma unidade Cowardly à carga suicida só para encurtar turnos.
- Não deixe toda unidade escolher o mesmo plano de fase pré-calculado. Resolva na ordem atual e avalie a próxima pelo estado atualizado, reduzindo curas desperdiçadas e ataques a alvos derrotados.
- Protective seleciona aliado vivo por papel/necessidade e o mantém até ficar inválido ou claramente inadequado. Proteger chefe explícito pode ser indicação da configuração; não é comportamento universal de todos os auxiliares.
- Use pequena variação com semente entre ações quase ótimas **dentro do temperamento selecionado**. Não reutilize a escolha uniforme atual entre todos os ataques restantes, que pode apagar a personalidade.

Ajuste inicial proposto: normalize a utilidade em escala fixa; novatos escolhem opções a até 0,15 da melhor pontuação do perfil, mestres a até 0,03, interpolando competência intermediária. Acrescente pequeno ajuste documentado de dificuldade, limitado para nunca trocar o temperamento. Os limites precisam de simulação e testes de jogo; não são valores de equilíbrio comprovados.

## 8. Turnos de chefes controlados pelo GM

### Identidade e responsabilidade

Acrescente identidade explícita de chefe por unidade nos dados do encontro. Não transforme automaticamente o membro mais forte de cada grupo em chefe do GM. Graus sugeridos: comum, elite, chefe; elite continua controlada pelo motor salvo designação explícita como chefe. A classificação musical do encontro inteiro pode continuar separada.

O GM seleciona ação legal para o chefe conforme personalidade estabelecida, intenção do encontro, tabuleiro atual, capacidades/recursos/itens da equipe e mecânicas com suporte. Essa consciência ampla permite antecipação, não conhecimento de escolha não confirmada do jogador; a seção 16 define o contrato de informação e interrupção. O motor controla alcance, movimento, recursos, lançamentos, dano, condições e orçamentos de turno. Auxiliares comuns continuam controlados pelo motor mesmo com chefe presente.

Configuração recomendada: habilite o novo sistema tático em novas partidas quando a funcionalidade completa for entregue e ofereça **GM directs bosses** (GM dirige os chefes) como opção claramente explicada que usa a conexão GM configurada. Explique que turnos de chefe podem aguardar resposta do modelo e incorrer no uso normal do provedor. Partidas existentes mantêm comportamento até o usuário optar; fixe a escolha no início do encontro. Uma opção só do motor/offline usa os mesmos perfis para chefes. Não acrescente outra enumeração de estilo de combate para esse ajuste nem mude silenciosamente o controlador no meio da batalha.

### Orquestração de turnos

Mantenha chamadas ao provedor em um serviço de orquestração do servidor, fora do motor compartilhado puro:

1. Aceite ação do jogador com identidade do encontro, ID de ação e revisão esperada. Valide pelo estado aceito da batalha.
2. Avance para a próxima ação comum ou decisão de interrupção na ordem existente. Separe declaração e resolução de efeitos para uma reação poder interromper conjuração pendente; não resolva uma rodada inteira para depois reescrevê-la.
3. Persista a ativação/janela pendente: ID da unidade, revisão, cursor de turno, ação disparadora/pendente, versão da política e menu limitado de candidatos legais.
4. Peça à conexão GM um ID estruturado de candidato ou passar. Inclua o snapshot atual das fichas da equipe, intenção do chefe, mecânicas com suporte e só informações de ação apropriadas à janela, conforme a seção 16. Uma breve narração opcional não pode alterar estado.
5. Valide resposta, revisão atual, unidade, pertinência do candidato ao menu e legalidade atual. Registre atomicamente a decisão e aplique a ação uma vez.
6. Retome a ação/ativação suspensa pelo estado atualizado, depois os participantes restantes. Revalide após interrupções; avance cada orçamento/efeito no limite definido pelas regras exatamente uma vez, depois devolva o controle ao jogador.

IDs de candidatos devem identificar ações completas geradas pelo motor, não coordenadas arbitrárias do modelo. Um tabuleiro grande pode produzir muitos candidatos quase duplicados. Monte menu determinístico limitado que preserve famílias úteis: movimentos característicos, alvos de ataque, apoio, defesa e movimento. Cerca de 8–16 candidatos diversos é um alvo inicial para medir. Não elimine todas as alternativas por um único perfil genérico antes de o GM vê-las.

### Latência, falhas e requisições repetidas

Uma chamada por janela distinta de decisão do chefe é o limite inicial; nenhuma para auxiliares rotineiros, cliques simples de seleção ou janelas sem escolha legal útil. Turnos comuns, antecipação, ações lendárias após turno e reações disparadas podem criar janelas diferentes; limite portanto a latência total de ativação/fase com vários chefes. Comece com alvo flexível configurável de cerca de cinco segundos e timeout rígido de cerca de dez segundos por chamada, ajustando pelos provedores reais com suporte. São metas de design, não garantias medidas de resposta. Registre alternativa determinística ou passar quando o orçamento agregado acabar, em vez de chamadas ilimitadas.

Timeout, provedor indisponível, saída malformada ou candidato inválido devem usar a mesma política determinística salva de alternativa. Salve essa alternativa como decisão; resposta tardia do modelo não deve substituí-la nem tomar turno extra. Mantenha a interface responsiva, mostre estado simples de chefe pensando e permita cancelar para a alternativa aceita sem reiniciar o encontro inteiro.

Repetições do mesmo ID retornam o resultado salvo. Uma aba recarregada retoma a decisão pendente. Abas concorrentes não podem avançar o mesmo chefe duas vezes. Trocar de chat não deve anexar resposta a outro encontro. Retorno/ramificação de checkpoint cria ou restaura identidade coerente da batalha e histórico de decisões; não repita chamadas externas só porque a animação reiniciou.

**Pré-requisito de persistência:** requisições táticas atuais aceitam estado do cliente e retornam novo snapshot; não há registro autoritativo de turnos no servidor. Classic também aceita combatentes/mecânicas completos do cliente sem comparar com rodada salva autoritativa. Um ID de candidato salvo só no navegador não resolve repetição ou concorrência. Antes de entregar decisões externas de chefes em qualquer modo, introduza o armazenamento mínimo de revisão/decisão de combate sob autoridade do servidor, usando filas de armazenamento existentes quando apropriado. Configurações de encontro no servidor e identidade aceita de chefe devem determinar se a chamada é permitida; um marcador do cliente não deve habilitá-la. Audite namespaces turn-game/Experience antes de supor que `game_engine_state` é o armazenamento correto. É uma mudança limitada do estado de combate, não motivo para redesenhar todo o armazenamento do jogo.

### Mecânicas de chefe e legibilidade

Promova somente mecânicas geradas com suporte a operações estruturadas. Dê IDs estáveis e estado salvo de gatilho a transições de fase únicas. Diferencie ação normal, transição de fase e ação extra explicitamente atendida; descrição evocativa de chefe não autoriza dano gratuito.

Anuncie grandes ataques na interface/registro antes da resolução quando a mecânica exigir aviso. O GM pode improvisar sabor ao redor de eventos aceitos, mas deve narrar resultados reais. A personalidade aprendida e as capacidades características do chefe devem continuar reconhecíveis em reproduções mesmo com escolhas legais variadas.

Se o controle do GM estiver desativado ou indisponível, mostre o uso da alternativa do motor, sem alegar decisão do GM. Reprodutibilidade com GM significa reproduzir escolhas e lançamentos salvos, não esperar novas respostas idênticas do modelo com a mesma semente.

## 9. Contrato de dados e integração

Prefira um pequeno objeto compartilhado de metadados levado pelo pipeline existente. Exemplo de forma resolvida:

```ts
type ResolvedEnemyTactics = {
  version: 1;
  creatureCategory: "beast" | "monstrosity" | "other" | "unknown";
  role: EnemyRole;
  adjective: EnemyAdjective;
  proficiency: "novice" | "trained" | "veteran" | "master";
};
```

A categoria mínima distingue regras obrigatórias sem fingir implementar toda a taxonomia de criaturas de 5e. Preserve categoria canônica mais rica se introduzida em outro lugar. Armazene grau explícito do encontro separadamente para não codificar identidade de chefe na personalidade. Derive controlador do grau e do ajuste fixado de controle de chefes; evite duas fontes de verdade editáveis separadamente.

Indicações de atribuição no blueprint e dados resolvidos de execução são contratos diferentes. O blueprint pode conter indicações limitadas de papel/proficiência/personalidade e referência estável de NPC. O motor resolve uma vez no perfil salvo. Persista proveniência da atribuição uma vez com o encontro e memória pequena de decisão só nas políticas que precisam. Não duplique descrições brutas de personalidade em toda unidade a cada turno.

Classic também precisa propagar perfis por `sanitizeCombatantForRound`, esquema da requisição de rodada e `CombatantStats`. Seu snapshot atual omite intencionalmente estado de rodada/iniciativa/fila, portanto salvar só um campo de temperamento não permite turnos GM retomáveis, recargas reais ou reprodução determinística. Persista o estado autoritativo de rodada/ativação necessário; animações devem consumir resultados aceitos, não causar outra resolução.

Rastreie toda a fronteira:

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

Valide enumerações e valores limitados em toda fronteira externa. `.passthrough()` não valida novos campos de IA. Preserve campos omitidos em salvamentos antigos; rejeite valores explícitos malformados com erro útil, não mudança silenciosa de temperamento. Nova versão de política não deve reinterpretar acidentalmente snapshot antigo.

Para encontros legados em andamento, mantenha a política legada por padrão e aplique o sistema novo a novas batalhas. Snapshots antigos sem taxonomia não podem ser classificados retroativamente com confiança; não finja que a regra obrigatória de tipo foi avaliada. Um Beast/Monstrosity recém-conhecido entrando na política nova deve resolver como Mindless.

Todo caminho de criação importa: encontros gerados, combate manual/alternativo, salvamentos restaurados e futuras invocações. Não acrescente campos só à interface TypeScript para perdê-los na cópia explícita de propriedades.

## 10. Verificações de diversão, realismo e rejogabilidade

**Diversão:** inimigos devem ter hábitos que o jogador reconheça e explore. Vencer por separar guarda Protective de curador Supportive satisfaz mais que vencer porque um pontuador universal escolheu jogada ruim aleatória. Evite transformar todos em máquinas perfeitas de fogo concentrado.

**Realismo:** use objetivos críveis, informação limitada e competência adequada. Covardia, lealdade, agressão e treinamento são qualidades diferentes. Mindless é a simplificação pedida para duas categorias de criatura. Futuros sistemas de moral/objetivo podem acrescentar rendição, defesa territorial e fuga sem fingir que existem agora.

**Rejogabilidade:** varie perfis e composição entre sementes, preservando identidade na batalha e de NPCs recorrentes. Terreno, combinações de papéis, recursos inimigos e objetivos devem criar variação além de outro lançamento crítico. Dificuldade deve mudar desafio previsivelmente sem um Mindless Beast começar de repente a caçar curadores.

Exemplo de encontro no mesmo mapa:

- Um Reckless Bruiser deixa a casa segura para pressionar unidade alcançável da frente.
- Um Protective Bulwark fica perto do conjurador Supportive em vez de participar da investida.
- Um Cautious Marksman mantém linha de tiro e evita destino exposto.
- Um Mindless Beast pega a rota mais curta na floresta rumo ao membro alcançável mais próximo, ignorando conjurador ferido mais distante.
- Um chefe humanoide nomeado recebe turno GM para escolher entre pressão característica legal e proteger sua retirada. Seus auxiliares continuam com os próprios perfis.

Outra semente pode produzir Cowardly Bruiser e Opportunistic Marksman, mudando o confronto. Recarregar não pode. Uma aparição posterior do mesmo chefe nomeado deve preservar hábitos estabelecidos salvo mudança pela história ou edição explícita.

## 11. Etapas de implementação sugeridas

É uma funcionalidade grande: muda contratos persistidos, prompts, decisões inimigas e orquestração assíncrona. Acorde o design, depois implemente etapas pequenas e revisáveis no staging atual.

| Etapa | Entrega | Evidência de conclusão |
| --- | --- | --- |
| A. Fundamentos de capacidade e identidade | Provar/corrigir perda de recursos gerados; indicações explícitas de categoria/grau/proficiência; preservar campos em todos os caminhos | Conjurador gerado usa e consome recursos reais; identidade de chefe solo sobrevive à restauração |
| B. Atribuição e persistência | Tendências de papel, indicações de personalidade, adjetivo salvo com semente, comportamento legado versionado | Tendências de atribuição, precedência rígida de tipo, estabilidade em recarga/importação/checkpoint |
| C. Inimigos comuns Tactical | Candidatos legais compartilhados, perseguição Mindless exata, oito perfis distintos, texto de inspeção | Matriz de cenários comportamentais, paridade de previsões, provas móveis/navegador, desempenho limitado |
| D. Turnos GM de chefes | Fronteira servidor de revisão/idempotência, fase inimiga retomável, resposta validada, alternativa salva, mecânicas com suporte | Testes de timeout/repetição/concorrência/restauração e batalha manual de chefe com provedor real |
| E. Adaptação Classic | Semânticas não espaciais, conjuntos corretos de aliados/apoio, decisões/lançamentos com semente, integração à iniciativa | Regressões de rodada/recursos Classic e prova de restauração/reprodução; nenhuma falsa alegação de grade |

Etapas A–C são um primeiro marco útil, mas **não atendem sozinhas aos chefes controlados pelo GM**. Em Classic, a decisão deve ser pedida na posição correta de iniciativa após ações anteriores, não em tabuleiro obsoleto do início da rodada. Reutilize tabelas de perfis e atribuição sem forçar motores espaciais e não espaciais em um resolutor gigante.

Trabalho posterior com escopo separado: linha de visão/cobertura comuns, alvos AoE reais, moral/fuga por unidade, objetivos, mais adjetivos, coordenação, IA de invocações e economias de ação por perfil de regras. Regras de mesa determinam legalidade; temperamento decide como usar opções legais.

### Mapa de código para o agente implementador

| Arquivo / símbolo | Por que importa |
| --- | --- |
| [tipos compartilhados de combate](../../packages/shared/src/types/game.ts), `Combatant`, `GameCombatStateSnapshot` | Metadados de execução e contrato de restauração Classic |
| [tipos de encontro](../../packages/shared/src/types/combat-encounter.ts), `CombatEnemy`, `CombatInitState` | Blueprint gerado, mecânicas e tipos separados de modal |
| [rotas de encontro](../../packages/server/src/routes/encounter.routes.ts) | Prompts/esquemas e contexto existente de personagem; rota separada de ação do modal |
| [prompts GM](../../packages/server/src/services/game/gm-prompts.ts) | Atualmente dizem ao GM que a interface resolve mecânicas de combate |
| [GameSurface](../../packages/client/src/components/game/GameSurface.tsx), `generatedEnemyToCombatant` | Descarta descrição e omite MP inimigos; hidratação explícita e caminhos de restauração/criação |
| [interface Classic](../../packages/client/src/components/game/GameCombatUI.tsx) e [hooks de jogo](../../packages/client/src/hooks/use-game.ts) | Requisições Classic ativas, rodada/animação e fluxo de ações do jogador |
| [serviço Classic](../../packages/server/src/services/game/combat.service.ts), `chooseAutoSkill`, `resolveCombatRound` | Política automática compartilhada, RNG, mecânicas e iniciativa |
| [rotas de jogo](../../packages/server/src/routes/game.routes.ts), `/combat/round`, `/combat/tactical/start`, `/combat/tactical/action` | Esquemas e fronteira de orquestração; ida e volta do estado do cliente |
| [IA Tactical](../../packages/shared/src/features/tactical-combat/ai.ts), `decide`, `runEnemyPhase` | Política atual e loop de fase de todos os inimigos de uma vez |
| [motor Tactical](../../packages/shared/src/features/tactical-combat/engine.ts) | Conversão, heurística de chefe, movimento, legalidade, resolução, previsões e avanços de rodada |
| [classes Tactical](../../packages/shared/src/features/tactical-combat/classes.ts) | Seis classes existentes e derivação de capacidades |
| [tipos Tactical](../../packages/shared/src/features/tactical-combat/types.ts), [matemática](../../packages/shared/src/features/tactical-combat/math.ts), [RNG](../../packages/shared/src/features/tactical-combat/rng.ts) | Contratos de snapshot/ação, previsões de terreno e fluxo determinístico |
| [interface Tactical](../../packages/client/src/components/game/TacticalCombatUI.tsx) e [metadados de chat](../../packages/shared/src/types/chat.ts) | Snapshot tático salvo, estados ocupados e recuperação de chefe pendente |
| [regressões de terreno existentes](../../scripts/regressions/hybrid-terrain.regression.ts), [prova de rota](../../scripts/regressions/hybrid-terrain-route.regression.ts), [prova de configuração](../../scripts/regressions/hybrid-terrain-setup.regression.ts) | Padrões existentes de prova executável a estender quando pertinente |

Antes de implementar, procure issues, PRs abertas/rascunhos, branches vinculadas e itens de projeto para evitar duplicação. O roteiro anterior cita a PR #4391 fechada/não integrada como referência; confira novamente status e responsável e não absorva toda a expansão como pré-requisito. Siga `AGENTS.md`, `CONTRIBUTING.md`, instruções de pacotes e a camada Chai atuais. Não implemente apenas por números antigos de linha.

## 12. Plano de aceitação e validação

Use provas pequenas executáveis `*.regression.ts` no runner existente. Não mantenha arquivos temporários `.test.ts`. Asserções devem demonstrar comportamento, não só espelhar constantes de pesos.

| Cenário | Resultado exigido |
| --- | --- |
| Beast/Monstrosity com adjetivo conflitante, competência mestre, personalidade conhecida ou grau de chefe | Indicações geradas sempre resolvem Mindless; perfis resolvidos criados/importados conflitantes são rejeitados com erro útil |
| Tank saudável próximo contra conjurador ferido distante | Mindless persegue o tank; Opportunistic pode selecionar o conjurador |
| Rota curta de floresta contra rota aberta longa | Mindless escolhe menos passos pagando custo real; ganha bônus incidentais de terreno normalmente |
| Parede que exige afastamento temporário; adversário inalcançável | Perseguição acha desvio legal ou outro alvo alcançável; sem bloqueio de Manhattan |
| Unidades Mindless voadoras/teletransportadoras | Respeitam travessia/chegada/ocupação distintas e alcance por turno; nenhuma cadeia impossível de chegadas |
| Aliado ferido fora do alcance atual de cura | Supportive move e cura legalmente; MP esgotado/recarga bloqueiam capacidade |
| Protective sem provocação ou interceptação | Só posicionamento; nenhum redirecionamento inventado de dano |
| Inimigo Cowardly ferido | Pode recuar/defender; nunca dispara fuga global da equipe |
| Alta competência em conjunto grande fixo de sementes | Perfis adequados ficam mais comuns, raros compatíveis continuam; saídas por semente são estáveis |
| Personalidade conhecida, traço negado, indicações contraditórias, ausentes/inválidas, texto não inglês | Ajustes limitados documentados; sem controle numérico arbitrário ou alegação acidental restrita ao inglês |
| Esgotamento temporário de MP | Papel/adjetivo não mudam; só escolhas legais mudam |
| Dois inimigos visam ferido, primeiro o derrota | Segundo avalia estado atualizado; sem ataque a morto ou cura reservada duplicada |
| Terreno do destino difere da origem | Previsões e contra-ataques reais concordam em posições, terreno e regras |
| GM inventa coordenadas, capacidades, ações grátis, IDs de alvo ou recursos ilegais | Nenhuma mutação; somente alternativa legal salva ou candidato válido |
| Timeout GM seguido de sucesso tardio, recarga, repetição ou abas simultâneas | Exatamente uma ação aceita e um desconto de recursos; resposta obsoleta descartada |
| Vitória/derrota da equipe enquanto fase inimiga está suspensa | Resultado terminal correto; nenhum turno restante de chefe/auxiliar após fim da batalha |
| Restaurar checkpoint, ramificar, importar/exportar, salvamento legado, NPC recorrente | Preserva perfis aceitos e identidade correta; sem novos sorteios involuntários ou decisões externas duplicadas |
| Classic Mindless e chefe GM | Regra explícita de alvo não espacial e posição correta de iniciativa; sem alegação de grade/terreno |

Meça o custo decisório nos limites de requisição de 40 unidades / 64 por 64, com modos de movimento mistos, muitas capacidades e obstáculos densos. Use cache por decisão para cálculos de movimento/ameaça quando justificado; invalide após mudanças de estado. Defina orçamento mensurável para fase comum após avaliar o motor atual em desktop e celular representativo. Não alegue orçamento específico de milissegundos sem medir nem acrescente busca profunda antes de avaliar.

Para implementar: comece com `pnpm install`; execute `pnpm check`, regressões focadas de combate/rotas, `pnpm regression:prompt` ao mudar prompts e `pnpm localization:check` para texto de interface. Use regressões de navegador para fluxo real, recarga, espera/falha de chefe, teclado, telas pequenas e temas claro/escuro. Acrescente entradas apropriadas de changelog em `[Unreleased]`. Leia `packages/client/.instructions.md` antes de editar o cliente. Registre prompts/resultados do provedor nas ferramentas existentes de debug e Pino sem expor segredos não relacionados.

Antes de pedir revisão de PR, execute CodeRabbit local, trate achados substantivos e execute novamente. Documente rejeições fundamentadas no código para falsos positivos ou sugestões puramente pedantes; não repita indefinidamente. Deixe desmarcadas as caixas de teste para o contribuinte humano. Ao publicar este documento em PR, inclua a issue de acompanhamento `[docs-i18n]` exigida ou as traduções correspondentes.

### O que a exploração original verificou

As descrições atuais vieram do rastreamento do cliente ativo, rotas e resolutores, com auditorias Classic/Tactical separadas. O exemplo de probabilidades foi calculado diretamente. Nenhum código de IA foi alterado, nenhuma política nova simulada e nenhum fluxo de chefe no navegador ou provedor real foi exercitado. São exigências de aceitação da implementação, não provas fornecidas pelo design.

## 13. Limite atual da implementação da IA comum

Vocabulário implementado: Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly, **Patient, Methodical e Coordinated**. Outros adjetivos abaixo são ideias, não configurações ocultas de execução.

O contrato compartilhado `features/combat-ai.ts` separa papel, adjetivo, grau de treinamento e semente salvos do controle. Novas batalhas recebem atribuições salvas; restauradas sem perfil mantêm a política automática anterior. Alterar controlador do companheiro não sorteia seu adjetivo novamente. Reservas finitas geradas de MP e tipos/custos explícitos de capacidades passam à execução; MP inimigo omitido usa a mesma reserva provisória `20 + 3 × level` dos aliados sem atributos, preservando zero explícito. É alternativa genérica do Engine, não regra de recurso de mesa.

A atribuição v1 é intencionalmente menor que a fórmula proposta na seção 5: perfis compatíveis começam com peso positivo, favorecidos pelo papel ganham bônus dependente do treinamento, e uma indicação opcional de personalidade de enumeração fechada acrescenta preferência limitada. A precedência de categoria força Mindless; indicação explícita Mindless também o seleciona para outras categorias. A chamada existente de geração fornece indicações em qualquer idioma; o motor não interpreta prosa de personalidade diretamente. Outras indicações de temperamento são preferências, não garantias, e a compreensão de negação/caracterização multilíngue pelo modelo ainda precisa de avaliação do provedor. Proveniência completa e personalidade ligada à identidade entre encontros recorrentes continuam como trabalho posterior. Nível derivado de HP continua uma aproximação fraca do treinamento sem indicação.

Cada modo enumera ataques básicos, capacidades e opções defensivas executáveis, depois pontua dano, finalização, cura efetiva, apoio, custo e fatores táticos pertinentes. Nenhuma chamada de modelo por turno comum é acrescentada. Perfis nunca concedem capacidade indisponível, MP ilimitado, ativação extra ou terreno inexistente.

- **Classic:** sem pontuação espacial. Mindless usa ordenação estável com semente de adversários vivos, independente de HP. Apoio usa o conjunto aliado correto. Melhorias/enfraquecimentos aplicam modificador real nomeado de defesa em vez de aproximação só de dano. Novos perfis têm recargas por uso. Companheiros manuais enfileiram ataque/capacidade/defesa para suas posições de iniciativa; inventário da equipe e ações narrativas continuam com o líder ativo. Outros companheiros usam IA por padrão, como na interação estabelecida Classic. Comandos identificam o ator, inclusive quando o líder original está KO.
- **Tactical:** destinos legais alcançáveis de ataque/apoio alimentam a política. Mindless segue rota de menos passos pagando o custo real; voo e teletransporte mantêm restrições próprias. Apoio pode mover antes de conjurar. Novas estimativas de contra-ataque usam destino prospectivo. Estimativa conservadora de alcance pelo estado público fornece exposição; não é busca completa de caminho no próximo turno. Uma parede ou uma montanha bloqueia a visão em todo ataque (combate C6).
- **Patient:** favorece espera defensiva limitada em vez de confronto desfavorável; Classic espera recarga quase pronta em vez de movimento fictício. Não pode esperar para sempre enquanto houver ação útil.
- **Methodical:** prefere preparação com suporte de redução de defesa, mantém alvo e ataca quando o estado é útil. Sem árvore inventada de combo ou busca de lançamentos futuros.
- **Coordinated:** considera alvos registrados dos aliados e enfraquecimentos úteis, recalculando após cada ação aceita. Não há planejador onisciente de equipe nem reserva de ações não enviadas do jogador.
- **Companheiros:** seleção localizada **Player/AI** (jogador/IA) por membro na batalha, mantendo o líder ativo manual. Companheiros Tactical agem após comandos manuais restantes ou **End Turn** (encerrar turno). Intervenção manual continua possível antes de agir. Mudanças de controlador, perfis e memória persistem com combatentes/snapshots táticos.
- **Persistência Classic:** resultados aceitos e número da próxima rodada vão ao callback existente de snapshot antes da animação cosmética. Recargas reais por uso sobrevivem à ida e volta. Classic ainda usa os lançamentos aleatórios existentes; não é reprodução exata de dados nem registro idempotente autoritativo de ações. Garantias de abas simultâneas pertencem ao futuro trabalho autoritativo de chefes.

O primeiro marco parou antes de chamadas a provedores e reações; a seção 16 registra a implementação posterior. Limites restantes incluem fuga por unidade, provocação, objetivos mais ricos, iniciativa por regras, normalização completa de recursos das fichas e registro de perfis de NPCs recorrentes. Partes não implementadas da proposta original continuam como trabalho de aceitação, não funcionalidade implicitamente entregue. Medições sintéticas em desktop não calibram desempenho em celular real.

## 14. Mais adjetivos com comportamento sensível à classe

Mantenha um adjetivo visível e um papel derivado das capacidades. São prioridades distintas, não sinônimos de "inteligente". Permita combinações incomuns mecanicamente válidas.

| Adjetivo | Fighter / Knight | Rogue / Archer | Mage / Healer | Distinção e pré-requisito |
| --- | --- | --- | --- | --- |
| **Frugal** | Usa golpe normal antes de técnica limitada | Guarda munição especial ou explosões para alvos relevantes | Usa magias eficientes; reserva cura cara para perdas substanciais de HP | Eficiência mesmo seguro; diferente de Cautious. Exige custos finitos reais |
| **Relentless** | Mantém pressão no inimigo escolhido | Mantém perseguição ou pressão sustentada sobre uma marca | Continua sequência de dano/controle com suporte na mesma ameaça | Compromisso forte com alvo, não risco Reckless; precisa de alvo salvo e saída por invalidade/falta de progresso |
| **Disruptive** | Usa desarme, interrupção ou golpe incapacitante disponível | Quebra canalização com suporte de conjurador exposto ou aplica enfraquecimento | Prioriza dissipar, silenciar, purificar ou controlar com utilidade | Impede ações relevantes em vez de maximizar dano. Habilite só efeitos reais com suporte; sem silêncio falso pelo nome |
| **Vengeful** | Retalia contra quem o feriu ou derrubou o protegido | Marca o último agressor e busca abertura legal | Amaldiçoa o agressor ou protege sua vítima pretendida | Ressentimento por evento, não alvo mais fraco. Precisa de memória limitada de último atacante/aliado derrotado |
| **Adaptive** | Muda tática após resistência observada ou confronto falho | Para de repetir ataques ineficazes | Troca elemento ou apoio pelos resultados observados | Aprende só evidência pública. Precisa de histórico limitado; não acessa tabelas ocultas de resistência |
| **Opportunistic** (já incluído) | Escolhe finalização segura em vez de duelo longo | Explora alvo ferido/exposto | Usa magia para garantir abertura real | Perfil atual é a base; não acrescente "Cruel" com o mesmo pontuador |
| **Resolute** | Continua papel designado apesar da pouca saúde | Mantém posição útil de tiro sob pressão | Termina cura importante ou canalização com suporte | Compostura com pouca saúde, distinta da agressão Reckless; exige intenção/compromisso e invalidação de emergência |
| **Territorial** | Guarda portão ou local definido | Vigia aproximação definida e para de perseguir fora dela | Apoia aliados na área defendida | Exige objetivo/limite real Tactical. Em Classic, defenda objetivo nomeado, não coordenadas imaginárias |
| **Zealous** | Prioriza líder ou causa designados acima da sobrevivência | Gasta explosões escassas em ameaças ao objetivo | Compromete apoio/recursos à missão mesmo em risco pessoal | Lealdade ao objetivo, diferente de Supportive geral; exige metadados de objetivo/grau |
| **Deceptive** | Usa finta ou mudança de postura com suporte | Usa ocultação, iscas ou desvio real de alvo | Cria ilusão ou capacidade de isca com suporte | Exige percepção/engano com respostas legíveis. Só alegações narrativas não fazem nada |
| **Merciful** | Escolhe finalização não letal com suporte | Incapacita em vez de matar quando há rendição | Usa contenção/controle e aceita rendição | Exige resultados não letais e regras de rendição; sem atacar derrotados ou inventar efeito de misericórdia |
| **Selective** | Chama protetor resistente só quando necessário | Chama perseguidor ou unidade à distância para abertura atual | Escolhe invocação elemental/de apoio adequada às ameaças visíveis | Futura política de elenco de invocações, não outra preferência genérica de dano; exige contabilidade de invocações |

Melhores próximos acréscimos após os onze atuais: **Frugal, Relentless, Disruptive e Vengeful**. Frugal e Relentless combinam com capacidades existentes com pequenas mudanças de estado. Disruptive precisa de semântica real de incapacidade/dissipação; Vengeful de memória de eventos. Adaptive e Territorial têm alto valor de rejogabilidade, mas pré-requisitos maiores. Trate Resolute e Zealous como candidatos a testar sobreposição antes de ampliar o vocabulário público.

Os três acréscimos pedidos também variam por classe:

| Adjetivo | Bruiser / Bulwark | Skirmisher / Marksman | Spellcaster / Supporter |
| --- | --- | --- | --- |
| Patient | Prepara-se enquanto uma troca ruim melhora; mantém aproximação valiosa em Tactical | Aguarda alcance legal útil sem forçar tiro fraco | Conserva turno para magia quase pronta ou evita cura inútil; nunca espera regeneração inexistente de mana |
| Methodical | Aplica técnica real de enfraquecimento, depois ataca esse inimigo | Prepara vulnerabilidade com suporte antes da explosão | Enfraquece antes de causar dano ou prepara sequência defensiva com suporte; efeitos ativos úteis não são reaplicados |
| Coordinated | Pressiona alvo atual de aliado ou fornece preparação útil | Finaliza alvo já ameaçado pela equipe | Fornece apoio não redundante ou enfraquecimento explorável; recalcula após cada ação |

Estas descrições são metas de ajuste. A primeira implementação usa o modelo genérico atendido de melhoria/enfraquecimento de defesa; combinações mais ricas por classe exigem capacidades correspondentes e cenários de regressão.

## 15. Extensão de design de Summoning

Comece sem grade. Uma invocação é combatente real com ID estável de encontro, referência de dono, lado, perfil, controlador, duração, custo e orçamento explícito de ativação. A classe muda suas capacidades legais; o adjetivo muda prioridades como em Classic.

Separe a **escolha de invocação** do invocador da **política de combate** da unidade invocada. Invocador Patient pode guardar vaga para ameaça futura; Knight invocado Protective protege por ações com suporte; Mage invocado Methodical prepara enfraquecimento; curador Coordinated evita cura duplicada. Invocações Beast/Monstrosity continuam Mindless pela regra atual, mesmo amigas.

As regras decidem se comandos consomem ação do dono, se invocação age imediatamente ou na próxima rodada, se compartilha iniciativa e o que faz sem comando. Padrão genérico recomendado: invocar consome a ação comum do dono, a unidade nova ativa primeiro na próxima rodada e usa IA do motor salvo controle explícito. Não conceda novo turno comum por dispensar/reinvocar a mesma unidade. Imponha limite de população e contabilidade estável de uma ativação por rodada antes de capacidades de enxame.

KO do dono, encanto/mudança de lado, dispensa, término de duração, derrota da equipe e fim do encontro precisam de regras explícitas de limpeza. Salve dono e duração restante em recarga/importação. Invocação derrotada não é item de inventário nem membro permanente. Custo de magia/MP é descontado uma vez pela criação aceita. Ações de invocação não devem fabricar janelas lendárias além da elegibilidade fixada pelo modificador de chefe.

## 16. Chefes GM, ações lendárias e reações

### Adaptador genérico implementado do Engine

Novas partidas criadas no assistente habilitam combate dirigido pelo servidor. **GM directs bosses** controla o uso do provedor; adversários comuns e companheiros IA continuam locais. Partidas existentes sem `combatDirector` ficam no resolutor legado. A configuração do encontro fixa GM, dificuldade, semente, terreno e capacidades para que mudanças no meio da batalha não reescrevam regras aceitas. O gerador deve criar explicitamente `boss`; HP alto ou marcador visual sozinho não concede ações extras. Há suporte a chefe solo.

`combat-director.routes.ts` armazena snapshot versionado sob autoridade do servidor no armazenamento existente do estado do motor, em `experience:marinara-engine.combat`, ancorado à mensagem inicial do encontro. Inclui cursor de iniciativa, pilha de efeitos pendentes, escolhas disponíveis, orçamentos de reação/lendários, recursos, IDs de requisições aceitas e eventos recentes. Comandos trazem ID de encontro, ID da instância de armazenamento e revisão; submissões duplicadas/obsoletas retornam estado aceito. Consumo de inventário e salvamento compartilham transação. Respostas do provedor também são conferidas pela identidade da linha salva, revisão e janela; resposta tardia não pode atravessar alternativa, restauração de checkpoint ou ramificação.

- **Classic:** posições individuais de iniciativa agora pausam para decisão manual ou de chefe. O diretor resolve um ator por vez, depois aplica mecânicas/avanços de estados de fim de rodada uma vez. Partidas legadas mantêm comandos originais de rodada enfileirada.
- **Tactical:** inspecionar/selecionar um token é gratuito. **Begin [name]'s turn** (iniciar o turno de [name]) confirma a ativação e abre oportunidade de antecipação. Movimento sozinho não produz outra ativação ou janela lendária. Companheiros IA e inimigos mantêm estrutura de fases. Descrições de terreno, sementes e tamanho aceitos permanecem autoritativos. Novos encontros ignoram preferências obsoletas de semente da campanha.
- **Chefes:** orçamento inicial criado costuma ser de três pontos lendários, com custo positivo por ação extra oferecida. Pontos renovam na ativação comum do chefe. Antecipação e oportunidades após turno compartilham a reserva; ações extras e reações nunca geram cadeia lendária própria. O gerador define custos legais de ataque/defesa/movimento e capacidades. Chefe Mindless obedece à perseguição; uma única ação legal roda localmente.
- **Provedor:** use a conexão de ferramenta GM configurada, com alternativa na conexão do chat. Forneça capacidades, recursos, quantidades de itens, condições, perfis, posições e eventos aceitos atuais da equipe/adversários. Nunca envie comandos privados pendentes, estado RNG ou escolhas digitadas/sobrevoadas pelo jogador. O GM retorna ID de candidato legal, nunca estado reescrito. Debug de prompts/resultados segue ferramentas existentes. A decisão expira após dez segundos; doze chamadas por rodada é o teto agregado atual. Alternativa comum usa IA local; janelas lendárias opcionais passam. A interface identifica alternativas e oferece opção local enquanto o GM está pendente. São limites iniciais fixos, não garantias configuráveis de latência.
- **Reações:** capacidades explicitamente marcadas `counterspell` e `guard` têm janelas disparadas. Personagens manuais recebem escolhas de capacidade/alvo/custo e **Pass** (passar); IA local avalia ameaça e escassez, chefes GM escolhem pelo mesmo contrato. A unidade tem uma reação, renovada na ativação, e recargas explícitas continuam válidas. Contramágicas podem ser magias e ser anuladas. Ordem estável e pilha pai salva limitam a resolução ao encontro de quarenta unidades. Passar não consome nada.
- **Custos:** reserve/gaste MP da capacidade declarada ou um espaço do nível exato antes das reações, sem cobrança dupla na resolução. O adaptador genérico consome o custo mesmo se magia ou Counterspell falhar. Reação também gasta seu direito; capacidades lendárias gastam custo próprio e pontos lendários. Espaços são dados explícitos opcionais das capacidades, não inferidos por classe ou nome. Não há conjuração em nível superior nem reembolso específico de edição.
- **Efeitos genéricos:** Counterspell tem chance com semente de `clamp(65% + 3% × level difference, 20%, 95%)`; cancela só efeitos pendentes. Guard aplica temporariamente a redução de defesa existente a um aliado ameaçado por aquele ataque. Reações Tactical verificam alcance definido e a linha de visão compartilhada (combate C6), como fazem os ataques comuns. `areaRadius` e `friendlyFire` explícitos permitem áreas de ataque Tactical, enquanto `targetScope: all-enemies` Classic aplica uma conjuração paga única ao grupo oposto. São regras deliberadamente genéricas, não Counterspell de qualquer edição de 5e.
- **Controles:** telas existentes renderizam estado aceito autoritativo, orçamentos de reação/lendários e painel focado de escolhas acessível por teclado. Inventário Tactical oferece itens reais com suporte em vez da antiga poção provisória ilimitada. Recarregar restaura decisão pendente. A correção de reinicialização antes da restauração preserva âncora e mecânicas, inclusive montagem repetida de desenvolvimento React. Totais de recursos entram no resumo do combate.

**Limites atuais:** o diretor não oferece a manobra livre legada **Special** nem reinício de batalha no local, pois nenhuma tem ainda contrato autoritativo de ação/retorno; batalhas legadas mantêm os controles. Use história/checkpoints existentes para restaurar. O menu GM tem limite de dezesseis escolhas comuns/lendárias; só um conjunto pequeno de destinos é oferecido. Guard reduz dano, não move/intercepta nem cria ataque de oportunidade. Retaliação Tactical existente continua uma troca automática separada, não reação de magia. Classic mantém dados aleatórios atuais e cobertura existente de mecânicas roteirizadas; Tactical não ganha as mecânicas roteirizadas Classic. Não há adaptador completo de mesa, ressurreição, propriedade de invocação, concentração geral, conjuração em nível superior ou registro de perfis de NPCs recorrentes. Normalização completa de fichas e recursos duráveis entre encontros ainda pertencem ao trabalho de regras. Qualidade do provedor e ritmo em aparelho real ainda precisam de testes de jogo.

### Requisitos de design aceitos

**Aceito:** ações lendárias devem estar disponíveis a chefes criados explicitamente sem depender de regras 5e. O GM conhece capacidades/recursos da equipe e pode agir sobre previsão plausível antes de ação comum. Unidades IA avaliam reações opcionais e podem recusá-las para preservar recursos. Isso já tem primeira implementação genérica do Engine, separada da política de turnos comuns.

### Consciência e previsão do GM

Forneça ao GM snapshot ligado à revisão de capacidades/magias de cada membro, alcances legais e formas de área com suporte, HP e MP/pontos de magia atuais/máximos, espaços por nível, recargas, condições, equipamento, quantidades utilizáveis de itens e usos restantes. Inclua dono/acesso do inventário compartilhado, posições atuais onde aplicável, invocações, ações aceitas recentes e unidade começando a ativação. Dado ausente é desconhecido, não zero ou ilimitado. Obtenha isso de fichas/inventário aceitos, não resumo inventado pelo modelo. Leitura dos itens da equipe não permite ao chefe usá-los ou removê-los.

O GM pode usar essa consciência mais ampla para prever ameaças escolhendo comportamento adequado à personalidade e proficiência. IA local comum mantém a fronteira existente de informações. Nenhum recebe RNG futuro, rascunhos privados, capacidades/alvos sob o cursor ou comandos de outras unidades enfileirados antes da declaração. Magia realmente declarada fornece só detalhes de gatilho expostos pelas regras; conhecer a lista de magias não prova qual será escolhida. O servidor pode validar estado completo filtrando o contexto de decisão do controlador.

**Exemplo Fireball:** o mago selecionado tem Fireball, recursos suficientes e explosão legal que ameaça o chefe sem atingir aliados. O GM pode deduzir alta probabilidade de Fireball e gastar ponto lendário para reposicionamento, proteção ou pressão legais. Pode errar; também deve considerar por que magia de alvo único ou outra ação seria melhor. Não pode inventar esquiva, silêncio ou movimento gratuito. Use regras reais de AoE, fogo amigo e visibilidade; a aproximação original de alvo único não permitia essa previsão espacial. O diretor agora tem áreas de ataque explicitamente criadas. Em Classic/Summoning, use grupos de alvos e ameaças não espaciais reais, não alcance inventado de grade.

### Três janelas temporais distintas

Referência: as [regras de ações lendárias de 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/monsters) colocam essas ações após o turno de outra criatura e renovam o orçamento no turno do próprio chefe. Antecipar o mago recém-selecionado **antes** da ação é extensão deliberada do Marinara, não momento padrão de 5e. Mantenha disponível independentemente das regras por modificador explícito de chefe fixado no encontro; um perfil fiel a 5e usa o momento nativo salvo habilitação da regra da casa. Não misture silenciosamente com [regras de monstros de 2024](https://www.dndbeyond.com/sources/dnd/br-2024/how-to-use-a-monster).

| Janela | Gatilho e informações disponíveis | Orçamento e continuidade |
| --- | --- | --- |
| Ação lendária antecipatória | Ativação de outra unidade começa; GM vê ator, fichas e estado atual, não ação não confirmada | Gasta da reserva existente, depois deixa ator escolher/revalidar ação |
| Reação disparada | Ocorre evento com suporte, como início de conjuração; revela só detalhes permitidos | Gasta direito de reação mais custo MP/espaço/uso, depois retoma ou cancela ação pendente pela regra |
| Ação lendária após turno | Outra unidade termina ativação comum | Gasta da mesma reserva, depois avança à próxima ativação comum |

Em Tactical, diferencie inspecionar/selecionar unidade de **iniciar sua ativação**. A primeira seleção confirmada para agir pode abrir antecipação antes de movimento/ação, uma vez por ativação. Depois de aceita, trocar seleção, cancelar menu, recarregar ou trocar método de entrada não pode reabrir nem mudar para outro ator para multiplicar decisões. Inspeção continua grátis. Torne visível o compromisso; após interrupção, a unidade ainda tem sua ação comum salvo efeito incapacitante real. Uma explicação curta é melhor que chefe atacando a cada clique.

Classic atualmente reúne comandos antes de resolver a rodada inteira de iniciativa. Seleção na entrada de comando não é ativação real da unidade. O futuro resolutor deve pausar na posição de iniciativa, expor ator ativo sem vazar comando enfileirado, resolver antecipação e validar/processar sua declaração. Se a interrupção tornar escolha ilegal, peça nova escolha manual (ou reavalie IA) antes de iniciar a conjuração. Não chame GM em toda seleção nem execute posição futura cedo. Aplique o mesmo ciclo a companheiros IA e futuras invocações.

Padrões propostos do modificador genérico:

- Crie identidade explícita de chefe e menu lendário legal pequeno; não deduza privilégio GM do maior HP.
- Comece com orçamento visível de 3 pontos, ações de custo 1–3, renovado no início da ativação comum do chefe. Fixe orçamento inicial e política de surpresa/incapacidade no início. É ajuste proposto do Marinara, não exigência de copiar monstro publicado.
- Permita no máximo uma escolha antecipatória e uma após turno por chefe por ativação elegível de outra unidade, ambas na mesma reserva finita. Permite antecipação sem conceder mais pontos. Passar também fecha a janela. Resolva a janela após turno anterior antes da próxima ativação.
- Em Tactical, a janela após turno segue mover mais agir ou **Wait** (esperar), não cliques de movimento, cada golpe, contra-ataques, quadros de animação ou fase inteira do jogador. Em Classic, segue a posição resolvida de iniciativa. End Turn fecha cada ativação elegível pulada no máximo uma vez; invocações seguem elegibilidade fixada.
- Ofereça `pass` e só candidatos legais dentro do orçamento. Nenhuma ação lendária abre outra janela lendária ou concede duplicação por velocidade. Magia lançada como ação lendária pode disparar Counterspell apenas se o adaptador selecionado permitir; orçamentos continuam separados.
- Confira chefe vivo/apto, legalidade do alvo e resultado da batalha antes de pedir e aceitar decisão. Chefe derrotado não pode gastar resposta tardia. Restrições Mindless ainda valem para alvo/perseguição, incluindo opções lendárias.
- Diferencie ação comum, reação, ação lendária e evento de covil/fase. São orçamentos/gatilhos separados; não deixe descrição criar dano novo ou ativações gratuitas.
- Auxiliares comuns ficam na IA local. GM é chamado só em janelas de chefe com escolha significativa. Reutilize conexão configurada, debug, alternativa salva e limite agregado da seção 8.

### Counterspell e outras reações opcionais

**Avalie automaticamente, gaste seletivamente.** Ter Counterspell não significa lançá-lo contra toda magia. Um gatilho abre escolha entre reações elegíveis e `pass`. Companheiros IA e inimigos comuns escolhem localmente por capacidades, adjetivo, proficiência, reservas atuais e valor de negar aquele efeito. Chefes GM usam seu controlador na mesma janela. Unidades do jogador recebem escolha **React/Pass** (reagir/passar) com custo; não gaste silenciosamente espaços escassos por possuírem a capacidade. Efeitos passivos obrigatórios seguem regras próprias, sem fingir serem reações discricionárias.

Pontue dano/controle esperado prevenido, derrota aliada evitada, cura/preparação inimiga valiosa negada, sucesso estimado e custo de oportunidade tanto do recurso quanto de consumir a reação antes da próxima renovação. Counterspell pode mirar cura ou utilidade quando permitido, não só ataques. Não inspecione lançamentos futuros ou escolhas ainda privadas. Reação cara contra magia inofensiva pode perder para passar; último espaço pode valer a pena para evitar derrota total. Preferências de reserva são prioridades flexíveis salvo limite rígido explicitamente definido pelo jogador.

| Estilo / capacidades | Exemplo de prioridade de reação |
| --- | --- |
| Protective Knight ou Mage | Interceptar golpe que ameace aliado ou anular magia letal, só com capacidade real correspondente |
| Cautious ou Patient Mage | Passar magia fraca para guardar reação e recursos escassos para ameaça grave |
| Methodical Mage | Negar purificação, cura ou controle com suporte que quebraria seu plano |
| Conjurador de apoio Coordinated | Reavaliar após aliado reagir; não anular magia já negada nem reservar reação duas vezes |
| Conjurador Reckless | Gastar mais prontamente para manter pressão ofensiva; ainda não conjura sem orçamento de recurso/reação |
| Conjurador Frugal (adjetivo proposto) | Preferir resposta suficiente mais barata ou passar; pesar último espaço contra necessidades futuras de cura/dano |

Use IDs de capacidades e metadados explícitos de gatilho/efeito, nunca a palavra traduzida "Counterspell". Cada reação precisa de gatilho, momento, requisitos de alvo/visibilidade, custo de recurso, custo/renovação de reação e operação de resolução. Mantenha MP, pontos de magia e espaços distintos. Counterspell dispara quando a conjuração começa, antes dos efeitos; selecionar mago ou abrir menu não basta. [Counterspell 2014](https://www.dndbeyond.com/spells/2051-counterspell) e [Counterspell 2024](https://www.dndbeyond.com/spells/2619072-counterspell) têm resultados de sucesso/recursos diferentes; o adaptador deve defini-los explicitamente. Traditional precisa de fórmula/custo documentados próprios de interrupção, não mistura acidental.

Revalide gatilho, estado vivo/apto, visibilidade/alcance, alvo e recursos antes de confirmar. Desconte custo da reação escolhida uma vez mesmo se falhar, salvo reembolso por regra implementada. Custo e consumo de ação da magia original pendente seguem regras próprias, separados do pagamento de quem anula. Passar não gasta nenhum. Não reembolse automaticamente por animação cancelada. Padrão Traditional proposto: um direito de reação por unidade, disponível inicialmente salvo condição explícita impeditiva, renovado no início da ativação comum. Outros adaptadores definem quantidade/limite de renovação; interrupção ou golpe adicional nunca renova implicitamente. Contra-ataques de troca Tactical não são automaticamente reações de magia; preserve a semântica até mapeamento explícito por regras.

### Resolução e persistência de interrupções

A [PR #6110](https://github.com/Pasta-Devs/Marinara-Engine/pull/6110) dá precedente útil: preserve a ação original tentada, mostre interrupção aceita, atualize contexto seguinte imediatamente e proteja restauração/repetição contra sobrescrever mudanças posteriores. Sua implementação Roleplay corta texto em frase literal validada; o parser não é motor temporal ou de recursos de combate. Reutilize princípios de persistência/visibilidade, não truncamento para decidir se houve dano.

Represente ação comum como declaração salva, efeitos pendentes e resultado. Sequência proposta: início de ativação e renovação → antecipação opcional → declaração legal/compromisso de recurso → janela(s) elegível(is) de reação → efeitos restantes → fim da ativação → janela lendária após turno. Counterspell cancela efeitos pendentes, nunca desfaz dano aceito. Após resposta mudar estado, revalide ação restante, incluindo alvo, alcance e condições incapacitantes. Antes da conjuração, escolha enfileirada invalidada pode ser substituída sem gasto; depois do início, cancelamento/reembolso seguem a regra selecionada. Registros e narração devem descrever eventos aceitos, não o sufixo não executado da manobra tentada.

Vários reagentes elegíveis usam prioridade estável das regras, reavaliando legalidade após cada resposta aceita. Reações aninhadas, como anular Counterspell, só existem por capacidade explícita das regras e pilha pendente limitada. Cada entrada leva ID de pai/gatilho; unidade responde uma vez ao mesmo gatilho e precisa de direito restante. Feche gatilhos esgotados, cancelados ou resolvidos. Sem recursão ilimitada, pedidos repetidos de passar, gasto repetido ou cadeias lendárias. Primeiro adaptador deliberadamente limitado deve informar cadeias sem suporte, não alegar comportamento completo de 5e.

Contrato salvo mínimo: ID de encontro, revisão, ID/cursor de ativação, ator confirmado, tipo/ID da janela, evento disparador e IDs de ação pendente/pai, revisão de contexto do controlador e de candidatos, ordem de reagentes elegíveis/resolvidos, orçamentos lendários e de reação, variações reservadas/confirmadas/reembolsadas de recursos, escolha/passe aceitos, estado de resolução, resultado do provedor/alternativa e efeitos restantes. Aceite atomicamente decisões com custos/resultados. Resposta tardia ou duplicada não gasta de novo. Restaurar retoma janela pendente ou reproduz resultado aceito; ramificar/voltar isola todo o registro, não só narração. Não há Restore somente de texto que reembolse reação aceita. O registro servidor descrito abaixo fornece a implementação inicial; a seção 8 preserva o contrato de longo prazo.

Interface: mostre pontos lendários restantes, disponibilidade de reação e custo oferecido; diferencie antecipação de reação disparada. Mostre por que houve interrupção e se a magia original resolve, falha ou precisa de nova escolha. Exponha pensar/esperar, repetir/alternativa e cancelar de modo acessível. Anuncie ataques carregados quando exigido. Nunca alegue que GM escolheu alternativa local. Mantenha pontuações/prompts internos fora do menu do jogador.

Provas exigidas: magias/recursos/itens corretos da equipe no contexto GM; previsão de recursos esgotados; previsão Fireball plausível mas errada; nenhum vazamento de rascunho/comando enfileirado; nenhuma multiplicação por clique/resseleção; jogador muda ação legal após antecipação; momento nativo 5e contra regra da casa; Counterspell só após gatilho legal de conjuração; passar magia fraca contra contestar letal; sem MP/espaço/reação; custo único no contra falho; reembolso específico da magia original; visibilidade/alcance proibidos; vários reagentes e contras anulados; nenhuma janela extra por movimento/seguimento/reação; posição Classic correta; escolha manual enfileirada invalidada; unidades Tactical puladas/elegibilidade de invocações; orçamento lendário esgotado; renovação uma vez; morte/resultado na espera; duplicatas; timeout seguido de sucesso tardio; recarga, abas simultâneas, ramificação/retorno e mudanças de configuração. Acrescente comportamento com provedor real e ritmo móvel representativo após testes determinísticos de rota.

## 17. Orientação do agente de ambiente do encontro

A área de texto **Terrain guidance** (orientação de terreno) e sua linha de resumo foram removidas da criação de partidas. Arquivos antigos de configuração podem manter o campo por compatibilidade, mas a geração de encontros não o injeta mais em toda luta. Battlefield Size continua uma preferência reutilizável. Novas batalhas recebem sementes internas individuais; mapas salvos e reinícios preservam sementes aceitas. O rótulo Tactical descreve movimento, terreno e previsões sem citar outro jogo.

Um futuro agente **Battlefield Scout** deve rodar na preparação do encontro, usando localização atual do jogador, cena/ambiente mais recente, detalhes criados do mapa, clima e eventos recentes relevantes. Envia ao GM um resumo ambiental antes da geração do encontro, não na criação do mundo nem a cada turno comum.

Responsabilidades:

| Responsável | Trabalho |
| --- | --- |
| `Pasta-Devs/Marinara-Agents`, `staging` | Definição do agente, prompt padrão, runtime do pacote, catálogo/manifesto, recursos e configurações próprias desse agente |
| Marinara Engine, `staging` | Hook de preparação do encontro, contrato limitado de entrada da cena, entrega validada do resultado do agente, roteamento do provedor configurado, cache e alternativa, procedência salva do terreno |

Entradas devem conter revisão de encontro/localização e distinguir fatos observados de sugestões incertas. Saída: resumo curto do ambiente com suporte, elementos limitados de terreno usando o esquema existente `TacticalBattlefieldBrief` quando pertinente e referências de fontes. Nada de regras executáveis, coordenadas arbitrárias de casas, recursos inventados, privilégio de chefe ou alterações de HP. Classic pode receber contexto/perigos descritivos, mas não modificadores de grade sem suporte no resolutor.

O GM recebe o contexto aceito e ainda produz o encontro; o Engine valida o terreno final. Use cache por revisão de encontro/localização, descarte respostas obsoletas após viagem ou mudança de cena e evite chamadas pagas repetidas em novas tentativas. Se desabilitado, ausente ou expirado, use o contexto atual de geração com a alternativa habitual de terreno procedural. Salve o terreno aceito em vez de regenerar ao recarregar. Acrescente logging de prompts de debug e testes de esquema, timeout e localização obsoleta. Este agente está documentado aqui, não implementado no Engine nem instalado silenciosamente.

### Validação registrada da primeira implementação

A validação local `pnpm check` passa, assim como a regressão focada de IA de combate, regressões existentes de rotas/configuração/motor de terreno híbrido e `pnpm regression:prompt`. Testes focados de navegador pelas rotas reais Classic/Tactical cobrem seleção de companheiro, comandos manuais enfileirados, ações automáticas, persistência de rodada aceita e recarga. Verificações de configuração/hidratação cobrem remoção da orientação de terreno, semente zero, tipos explícitos de magia em outros idiomas e MP zero explícito. Chromium passou em tema claro de desktop e escuro com dimensões Android; WebKit não iniciou por falta de bibliotecas de sistema. Capturas são artefatos locais de teste, não recursos de documentação versionados.

Um tabuleiro aberto sintético 64×64 com 40 unidades, mistura de caminhada/voo/teleporte e capacidades de apoio levou cerca de 400–440 ms para uma fase inimiga comum neste host. Não é orçamento de pior caso com obstáculos densos nem medição em celular físico. Equilíbrio e ritmo de encontro completo ainda precisam de testes de jogo. Medições cobrem só o primeiro marco; não estabelecem latência de janelas de chefe nem regras futuras.


### Validação registrada da implementação de chefes/reações

`pnpm check` e `pnpm regression:prompt` passam. O aviso preexistente e não relacionado de hook de `GameNarration` permanece. Regressões focadas de IA comum, diretor, rota e provedor cobrem compromisso de ativação, preservação do turno comum, contras aninhados, passar, pagamento de contra falho, MP/espaços vazios, proteção em área, reações bloqueadas por parede, turnos desabilitados, transações de inventário, comandos duplicados/obsoletos, timeout rígido real, limites de chamadas por rodada e identidade de checkpoint/ramificação. O adaptador de provedor foi exercitado contra fixture HTTP local, incluindo contexto de saída real e rejeição de escolhas desconhecidas/malformadas. Isso prova integração, não qualidade estratégica em modelo pago.

Dezesseis verificações de navegador Chromium desktop/móvel passam para controles de companheiros Classic/Tactical legados e dirigidos, ações reais de menu, conclusão de rodada comum, recarga de reação pendente, consumo do último espaço exatamente uma vez, hidratação de capacidades geradas e limpeza da configuração. Capturas foram inspecionadas em tema claro de desktop e escuro móvel; painel de reações visível, focado e operável. Desempenho em aparelho físico, cobertura WebKit atual e qualidade/ritmo de decisões de provedor real não foram verificados. A prova ampliada de rota também executa timeout real de dez segundos e rejeita respostas posteriores. Não foi usada chamada a modelo de jogo ao vivo. Depois, a mantenedora autorizou revisão externa CodeRabbit como parte do fluxo esperado; a revisão local inicial terminou com 15 achados.


### Acompanhamento local do CodeRabbit

A primeira rodada levou a correções de consumo aceito de itens Classic após tentativas/turnos pulados, previsões de poder de capacidades Tactical, entrada pública de IA segura para legado, metadados de chefes só inimigos, consultas malformadas de estado e custos importados de decisão, eventos automáticos ausentes de fase inimiga, normalização ausente de MP máximo, IDs inválidos de unidade controlada, menus de capacidades só de reação, limpeza de fixture do provedor e resolução compartilhada de conexão na camada de serviço. O relato de itens pressupunha vários menus de inventário da equipe; atualmente só o líder tem esse menu, mas remover referência obsoleta de item corrige uma tentativa abandonada real. Consumo agora segue ordens aceitas e resultados reais de ações.

Sugestões revisadas e mantidas com razões baseadas no código:

- Espaços de magia aceitam intencionalmente apenas níveis 1–9. Descartar silenciosamente chaves não suportadas de blueprints gerados poderia esconder conjunto inválido; o esquema existente rejeita. Truques e comportamento de regras nomeadas pertencem a contrato separado.
- Custos da IA comum agora usam MP atual quando não há máximo. Escassez de reação divide deliberadamente pelo MP **restante**: Counterspell que gaste últimos pontos deve ser caro mesmo em reserva original grande.
- A enumeração de candidatos do chefe já calcula casas alcançáveis uma vez. Cada candidato ainda passa no validador autoritativo. Remover verificações repetidas ou adicionar cache separado exige evidência de desempenho e preservar essa fronteira; foi sugestão de desempenho, não ação ilegal observada.
- `CombatAttackResult` não tem marcador existente de motivo de falha. O novo resolutor por perfil rejeita capacidades indisponíveis antes de executar, e o diretor valida antes de cobrar. Novo protocolo resultado/interface só para alternativa legada sem efeito fica adiado como melhoria de apresentação; a alternativa não aplica efeito nem gasta recursos.

A segunda rodada local completa terminou com seis achados. Corrigiu mesclagem aceita de espaços e redefinições obsoletas de props na tela Classic independente, atribuiu perfis diretamente na construção da unidade, extraiu caracterização GM dos campos da ficha em vez de metadados serializados, bloqueou capacidades de reação nos dois caminhos legados de comandos comuns e seleção automática e retornou erro recuperável para leitura malformada de estado salvo.

A sugestão restante de blueprint não se aplica: `CombatAttack[]` nos tipos compartilhados, prompt de encontro gerado e `combatSkillsFromGeneratedAttacks` exigem objetos de ataque com nome. Entradas só de texto não têm hidratação com suporte. O esquema permanece estrito em vez de aceitar dados inutilizáveis na tela de combate.

Após correções, `pnpm check` e `pnpm regression:prompt` passam. Quatro regressões de combate e a de rota de terreno híbrido passam, incluindo extração real de contexto do provedor sem comentários/notas de edição da ficha. Dezesseis verificações desktop/móvel passaram após primeiras correções; as oito verificações finais Classic também passam com cobertura explícita de nova tentativa de item, item pulado e esgotamento do último espaço. Colisão com atualização de build interrompeu uma execução anterior; nova execução bem-sucedida ocorreu após concluir o build. A terceira revisão identificou painel vazio de capacidades Classic quando todas são só de reação, agora corrigido nos dois layouts. O caminho legado Tactical correspondente de cura/resolução também rejeita capacidades só de reação. A verificação final está registrada abaixo.


Disposições adicionais da revisão:

- A rota de ação Tactical já encaminha mudanças de controle por `applyTacticalTurn` e `applyAction`; `applyAction` rejeita atribuir IA à primeira unidade viva da equipe. A regressão de rota agora exerce a requisição e verifica HTTP 400 com erro de líder manual. Repetir regra na rota criaria segunda fonte de verdade.
- Dicas de IA e campos de interrupção podem ser omitidos. Quando fornecidos, precisam cumprir esquemas explícitos. Capturar/descartar silenciosamente capacidades malformadas transformaria Counterspell, custo ou conjunto de chefe gerado em regras diferentes sem explicação. Tolerar valor inválido em toda capacidade opcional é mudança deliberada de comportamento, não proteção ausente.
- Alias exportado `TacticalUnitAction` mais estreito é sugestão de limpeza de tipos. Tratamento de controle já retorna em `applyAction` antes da validação/execução comum e esquemas do diretor excluem controle. Não bloqueia recurso; limpeza futura de API pode estreitar união interna sem mudar comportamento.


Persistência legada de inventário continua acompanhamento separado. A revisão observou que `GameCombatUI` separa callback do inventário após resultado de rodada legada. Isso já existe na revisão base, que também usa `void onInventoryItemUsed?.(usedItemName)`. Apenas esperar não é correção idempotente: `handleUseCombatInventoryItem` trata falhas internamente e rodadas legadas não têm transação autoritativa salva de requisição/resultado para repetir. Novas batalhas dirigidas ignoram callback e usam desconto atômico de inventário mais salvamento do estado aceito no registro servidor. Legadas mantêm fronteira antiga; migrar juntas persistência de rodada e inventário exige migração explícita de compatibilidade. A limitação está documentada, não alegada corrigida por mudanças de nova tentativa/ordens enfileiradas.

O rótulo de disponibilidade de reação agora usa variantes singular/plural do catálogo. Regressões focadas finais, tipos do cliente, lint do workspace e prova de rota de controle do líder passam após pequenas proteções de reação; aviso preexistente do hook `GameNarration` permanece.


A verificação final também levou a alternativas determinísticas de ação básica/defesa para unidades Classic sem perfil salvo ou inimigos restantes, além de IDs limitados de ordens que devem nomear combatentes vivos da equipe. Regressões focadas e tipos do servidor passam; validação de localização passa para plurais de quantidade de reações.

Sugestões restantes sem efeito comportamental foram adiadas: deduplicar esquemas idênticos de espaços, retornar ID da ação pendente em vez de usar registro mais novo imediatamente após declaração síncrona, estreitar tipos internos e trocar ordenação da fronteira de teleporte por busca de mínimo. Código atual tem limites explícitos, preserva validação por ação e não há declaração intercalada entre inserção e seleção do registro pendente. Sugestões não demonstram mudança em resultado de combate. Da mesma forma, recarga legada 0/omitida fica temporariamente 1 e diminui ao fim do mesmo resolutor de rodada inteira; está disponível na próxima ativação. Diretor usa pagamento separado por ativação com 0 diretamente. Igualar valores intermediários não é necessário para mesma disponibilidade.


A mudança de cache proposta pressupõe `/director/start` não idempotente. Ele é idempotente para chat/âncora aceitos: rota serializada carrega e retorna registro existente antes de criar/cobrar, e regressão verifica que repetir início com combatentes obsoletos do cliente retorna exatamente sessão aceita. Atualizações ao remontar/reconectar permitem ver estado restaurado/atualizado do servidor. Desabilitar manteria batalhas obsoletas no cache; atualização explícita continua disponível e novas tentativas estão desabilitadas.

A quarta rodada local terminou com 15 achados, incluindo repetidos e limpeza opcional. Sua correção comportamental restante respeita dicas explícitas Mindless para categorias outras/desconhecidas; a regressão reproduziu dica ignorada antes da correção. Perfis salvos preservam comportamento estabelecido. Limite sugerido de 40 no mapa pendente rejeitaria entrada terminal válida da pilha: declaração insere primeiro, depois bloqueia novas tarefas de reação quando contagem supera 40, então limite salvo é 41. Raio de área 0 significa deliberadamente ausência de expansão, conforme ambos os resolutores. Trocar importação dinâmica herdada do provedor na função de conexão por estática é limpeza opcional. Não se alega ausência de achados; acompanhamento preexistente de persistência legada de inventário permanece aberto.

Verificação final após todas as correções: `pnpm check` passa, incluindo localização, formatação, tipos, lint e builds de produção; regressão focada de IA passa após demonstrar falha da dica Mindless antes da correção. Resultados anteriores de prompts, diretor/rota/provedor e navegador desktop/móvel permanecem conforme registrados acima. Últimas correções pequenas foram verificadas localmente, seguidas por revisão externa adicional na preparação da PR.


### Revisão de preparação da PR

Responsabilidade e escopo da implementação estão em [#6299](https://github.com/Pasta-Devs/Marinara-Engine/issues/6299); paridade de tradução destas duas orientações de desenvolvimento está em [#6300](https://github.com/Pasta-Devs/Marinara-Engine/issues/6300). O symlink da skill compartilhada resolve, e todos os 52 arquivos foram comparados byte a byte com conteúdo Git anterior. `pnpm check` passa após movê-los. `AGENTS.md` é adaptação Codex separada de `CLAUDE.md`, com transição explícita de rascunho para pronto após implementação, validação local obrigatória e revisão local.

Disposições da rodada de publicação:

- A skill Impeccable fica em `.agents/skills/impeccable`. A cópia em `.claude/skills` e o alias `.agents/skills` que apontava para ela foram removidos em 2026-10-07; a proteção de projeto Impeccable lê a skill em `.agents/skills`.
- Achados sobre exemplos/redação Impeccable, origem do pacote incorporado e funcionamento existente de ferramentas ao vivo tratam de arquivos movidos sem alteração. Não são regressões desta PR. A migração preserva skill instalada, sem incorporar projeto separado de manutenção upstream.
- Escopo de item Tactical `any` tem suporte explícito em `CombatItemEffect`, validação de rota e alvos do diretor. Trocar todo escopo que não seja self/enemy por `ally` quebraria comportamento com suporte. Padrão existente aplica-se só a escopo ausente.
- Cálculo antecipado de perseguição é limitado e não muda ação legal vencedora. Torná-lo sob demanda é refinamento opcional de desempenho; medição registrada da fase com movimentos mistos continua evidência atual, não alegação de impossibilidade de melhorar.
- Capacidades de ataques gerados são validadas pelo esquema do encontro e novamente pelos esquemas de início/ação do diretor. Substituir custos/capacidades explícitos malformados por padrões na hidratação mudaria silenciosamente conjunto criado. Mantenha campos ausentes compatíveis e fornecidos validados, conforme documentado.
- Pedido repetido para desabilitar atualização da consulta de início foi rejeitado por idempotência/estado obsoleto acima; prova real de repetição da rota permanece evidência.

A revisão de publicação terminou com 34 achados: 30 na skill realocada sem alteração e quatro no combate. As quatro sugestões são cobertas acima (perseguição sob demanda, alvo `any`, novas consultas idempotentes de início e validação explícita de capacidades). Esta rodada não exigiu nova mudança de implementação. Achados anteriores aceitos continuam corrigidos/testados. É resultado revisado com disposições, não alegação de zero achados.

## Acompanhamento de dificuldade e clima

Veja [Dificuldade e clima no combate](game-combat-difficulty-weather.md) para implementação #6305: dificuldade normalizada, modificadores de dano Traditional só para inimigos, consistência de decisão com semente, clima aceito nos dois modos, traços explícitos de ataque, neutralidade em abrigo/condições desconhecidas e condições fixas após recarga. Regras alternativas devem definir política própria de dificuldade antes de herdar escala de dano.
