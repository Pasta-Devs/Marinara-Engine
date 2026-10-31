# IA de combate de Game Mode

Como o Engine decide o que oponentes e companheiros controlados pela IA fazem em Classic, Tactical e lutas de conjunto de regras, e como o Game Master joga com os chefes. O código está em `packages/shared/src/features/combat-ai.ts`, `combat-minds.ts`, `tactical-combat/ai.ts` e `tactical-combat/profile-ai.ts`, com a parte do servidor em `packages/server/src/services/game/combat-director.service.ts`, `combat-ai.service.ts`, `combat-boss.service.ts` e `ruleset-combat-director.service.ts`. Para saber onde o combate se encaixa em Game Mode como um todo, veja [Arquitetura de Game Mode](game-mode-architecture.md).

Os números nas seções de implementação ([Limite atual da implementação da IA comum](#current-ordinary-ai-implementation-boundary) e as vinculadas a constantes nomeadas) são os ajustes atuais do Engine. Números marcados como exemplo, propostos, provisórios ou meta de design não são, e nenhum deles constitui uma afirmação de equilíbrio validada por testes de jogo. A invocação no combate Classic e Tactical do próprio Marinara ainda é uma proposta ([Extensão de design de Summoning](#summoning-design-extension)); lutas de conjunto de regras invocam por meio de suas próprias regras de `summons`.

## Separar capacidade, temperamento e controle

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

## Catálogo de adjetivos

### Oito iniciais

| Adjetivo | Preferência de alvo | Posicionamento e risco | Comportamento de capacidades/recursos | O que o jogador pode aprender |
| --- | --- | --- | --- | --- |
| **Mindless** | Membro vivo e alcançável mais próximo da equipe, pela regra de [Mindless: contrato exato de perseguição](#mindless-an-exact-pursuit-contract) | Rota espacial legal mais curta; ignora utilidade do terreno, exposição e formação | Ataque legal simples nesse alvo; sem triagem de cura, fogo concentrado ou otimização de recursos | Atraí-lo com proximidade, terreno e gargalos |
| **Reckless** | Dano imediato e pressão alcançável; não automaticamente a vítima mais fraca | Aproxima-se agressivamente, tolera contra-ataques e destinos expostos | Gasta prontamente ataques fortes disponíveis; raramente para para defender | Punir avanço excessivo e atraí-lo para trocas ruins |
| **Cautious** | Alvos que pode ameaçar limitando o dano de retorno | Valoriza destinos seguros, alcance útil e terreno defensivo | Preserva recursos escassos quando o ataque básico é quase tão útil; cura/defende quando necessário | Pressionar seu espaço seguro; explorar a relutância em se comprometer |
| **Opportunistic** | Alvos feridos, expostos ou já comprometidos; chances confiáveis de finalizar | Aceita algum risco por uma abertura concreta | Valoriza a capacidade que cria ou explora a abertura | Proteger aliados vulneráveis e negar finalizações fáceis |
| **Protective** | Ameaças a um aliado vulnerável designado ou grupo próximo apoiado | Fica a distância de apoio; ocupa casas úteis de bloqueio quando legal | Usa defesa/apoio para preservar o protegido; ataca quando proteger não é urgente | Separar o grupo ou aproximar-se de várias direções |
| **Supportive** | Saúde dos aliados e melhorias úteis antes do dano próprio | Move-se para alcance legal de apoio evitando exposição desnecessária | Cura perdas relevantes de HP, evita excesso inútil de cura/melhorias duplicadas, ataca quando apoiar acrescenta pouco | Pressionar o apoiador ou separá-lo dos beneficiários |
| **Disciplined** | Alvos eficazes para o papel, oportunidades sensatas de finalizar | Equilibra dano, segurança, posição e recursos; compromisso moderado com alvo | Fundamentos confiáveis do papel sem se especializar em extremo | Perturbar seu papel e forçar escolhas desfavoráveis |
| **Cowardly** | Alvos alcançáveis com segurança que não convidem retaliação | Autopreservação cresce muito com ferimentos ou inferioridade numérica local; recua para espaço aliado seguro | Cura-se/defende mais prontamente e evita compromissos caros | Cortar retirada segura e aplicar pressão sustentada à distância |

Protective não redireciona magicamente dano, provoca, intercepta ataques nem ganha reações. A ocupação atual permite bloqueio posicional; proteção mais forte precisa de capacidades reais. Cowardly pode recuar e defender, mas a ação `flee` existente em Tactical encerra toda a batalha. **Nunca use fuga global como fuga de um único inimigo.** Um único oponente só sai de uma luta por meio da moral ("Perder a coragem em Classic e Tactical", em [Proteções práticas](#practical-guardrails)) ou de uma fuga prevista pelo conjunto de regras.

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

<a id="assigning-profiles-role-experience-personality-then-seeded-variety"></a>

## Atribuir perfis: papel, experiência, personalidade e variedade com semente

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

A experiência influencia **tanto** a chance de temperamento adequado ao papel na primeira atribuição quanto a consistência em segui-lo. Na IA local comum, não revela capacidades ocultas do jogador nem comandos na fila. Chefes do GM têm a consciência mais ampla das fichas especificada em [Chefes GM, ações lendárias e reações](#gm-bosses-legendary-actions-and-reactions); nenhum controlador vê futuros lançamentos aleatórios ou conhece uma escolha não confirmada do jogador. A premissa de sobrevivência é uma tendência útil para construção do mundo, não uma lei factual de que todo mago veterano é cauteloso.

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
- Quanto uma unidade hesita é uma fração do que seu turno pode ganhar, chegando ao máximo quando o melhor candidato ganha cerca de um terço de um inimigo. Contra uma equipe resistente demais para que um único golpe faça diferença, cada golpe representa uma pequena fração de um inimigo, e uma variação fixa decidiria entre um Multiattack completo e duas adagas arremessadas com desvantagem. A tendência de uma unidade Methodical a insistir no último alvo diminui da mesma forma, e também conforme o golpe nesse alvo perde valor.
- Um golpe que ganha claramente menos que o melhor disponível (menos de 97 centésimos) e já tem pontuação inferior à dele não recebe variação alguma, então um novato nunca faz duas adagas que valem 93 centésimos de um Multiattack superá-lo por variação.
- O que uma unidade valoriza em um alvo (o foco da sua mente: o mais perigoso, o mais fraco) só desempata golpes que causam danos semelhantes: um golpe que causa menos de 97 centésimos do dano de seu golpe mais forte não recebe nada desse valor.
- Em lutas de conjunto de regras, o perigo que uma unidade corre onde fica para lutar considera um oponente que pode caminhar até ela e golpeá-la ali quase tão perigoso quanto um que está ao lado dela (um décimo menos no limite da caminhada), então se afastar seis casas de um cavaleiro para arremessar de longa distância nunca parece mais seguro do que se aproximar dele. Uma fuga ainda considera o limite de uma caminhada muito mais seguro, e nunca entra em uma passagem em que seria preciso se espremer quando há onde caber por inteiro.
- Um guarda-costas fora do limite de proteção não faz nenhuma caminhada seguida de golpe que termine fora desse limite, mesmo que termine mais perto do que está: em vez disso, caminha de volta.
- Um Multiattack cujo alvo cai durante a execução direciona as partes restantes ao outro oponente mais próximo que cada parte alcança (se não houver nenhum, elas não são feitas); um que mira alguém já caído é feito conforme escolhido, e uma criatura cruel continua atacando os caídos.
- O registro da luta informa o que disparou um teste de moral antes da rolagem, uma mudança de temperamento e o que a provocou, quem uma caminhada arrastou junto, uma criatura territorial mantendo posição e uma rendição da equipe. Uma criatura rendida permanece no tabuleiro onde se rendeu.
- Em lutas de conjunto de regras, a pontuação de dano de um golpe é o dano esperado em relação à saúde média do lado do alvo, seja quem for que o receba, então a saúde maior de um cavaleiro não faz um Multiattack contra ele valer menos que o mesmo dano contra o mago. Um golpe que derrubaria o alvo é ponderado pela saúde do próprio alvo, nunca o considerando mais frágil do que três quartos dessa média.

<a id="mindless-an-exact-pursuit-contract"></a>

## Mindless: contrato exato de perseguição

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

## Decisões de inimigos comuns

### Reutilizar o resolutor; variar prioridades

Gere primeiro ações candidatas legais, depois pontue com pesos de papel e adjetivo. Use helpers existentes de movimento, previsão e prontidão; acrescente a menor função reutilizável de legalidade necessária à IA do motor e às unidades do GM. Não chame `performUnitAction`, que apenas altera estado, com entrada não validada do modelo.

Os candidatos devem incluir:

- Ataque básico e capacidades de ataque utilizáveis, incluindo destinos legais para mover e agir.
- Cura, melhorias e enfraquecimentos no lado correto, incluindo mover para alcance de apoio.
- Defender, esperar e movimento com propósito quando não houver ataque/apoio útil disponível.

Inclua só mecânicas realmente atendidas pelo resolutor. Itens inimigos precisam primeiro de inventário/contabilidade reais. O pontuador não pode inventar geometria AoE, invocações, provocações, novas reações, ataques de oportunidade, cobertura ou fuga. Tactical já tem contra-ataques e defender/esperar; Classic precisa de defesa/espera automática explícita e operações adequadas de melhoria/enfraquecimento antes de oferecer perfis equivalentes. Isso é trabalho do resolutor, não só pesos diferentes.

Use fatores normalizados para dano esperado, probabilidade de finalizar, cura/apoio úteis, risco imediato de contra-ataque, exposição na próxima fase, progresso para alcance de engajamento do papel e custo de recurso. Multiplique por uma pequena tabela de perfis. Um bônus universal enorme de abate apagaria as diferenças de temperamento; substitua por valor limitado de finalização dependente do perfil na política nova.

Esta é uma abordagem pequena de pontuação de utilidade: comparar ações legais em escalas consistentes e variar prioridades pela personalidade. A abordagem geral e a inércia decisória são descritas em [An Introduction to Utility Theory](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf), de David "Rez" Graham. Perfis, fórmula, padrões e plano de integração concretos aqui são recomendações de design específicas do Marinara.

<a id="practical-guardrails"></a>

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

**Perder a coragem em Classic e Tactical (IA de combate E1, E2).** Uma luta dirigida de Classic ou Tactical aplica a regra de moral dos jogos antigos a cada oponente que não seja chefe nem Mindless. Cada oponente tem uma pontuação de moral na escala de 2 a 12: o `aiHints.morale` do blueprint quando a história informa uma, caso contrário 7 para uma mente Instinct ou Cunning, 8 para Tactical e 9 para Genius, ajustada pelo temperamento (Cowardly −3, Cautious −1, Protective +1, Reckless e Disciplined +2) e mais um para um líder. Quando um de seus turnos começa, ele testa, uma vez cada e nesta ordem, ter sido pego desprevenido (`surprised` no blueprint), seu líder estar caído (`aiHints.leader`, ou um chefe), metade do seu lado estar caída, o primeiro do seu lado estar caído e ter sido ferido até ficar abaixo da metade da saúde. Se a soma dos dois dados superar a pontuação, ele perde a coragem. Um oponente pensante com um inimigo ao lado (sempre, em Classic, que não tem tabuleiro) se rende; um animal, ou um que tenha espaço, foge, caminhando até a borda mais próxima do tabuleiro e escapando assim que um de seus turnos começa ali. De qualquer forma, sai vivo da luta: a luta é vencida quando não resta nenhum oponente, a recapitulação informa ao Game Master quem fugiu e quem se rendeu, e o saque de um oponente rendido cai junto com o dos caídos. O mesmo `aiHints.leader` marca um oponente de uma luta de conjunto de regras como líder para os testes de moral `leader-down` do conjunto de regras. Lutas salvas antes da introdução da moral continuam sem ela.

**O que cada papel faz (IA de combate A1-A3).** O papel agora ajusta a ponderação compartilhada nos três estilos, a menos que o oponente seja Mindless: um Bulwark dá mais peso à proteção e recebe pontos por terminar a caminhada ao lado de um amigo ameaçado; um Skirmisher dá mais peso à finalização e à coordenação e recebe pontos por golpear do lado oposto de um alvo em relação a um amigo que já o enfrenta; um Marksman se preocupa mais com o perigo; um Spellcaster guarda as opções caras para quando fizerem diferença; um Controller dá mais peso à preparação; um Supporter dá mais peso à ajuda e recebe pontos por terminar ao lado de um amigo ferido; e um Solo (uma criatura de conjunto de regras com ações lendárias de custo próprio ou resistência lendária, ou um chefe de Classic/Tactical) gasta livremente, golpeia mais forte e se preocupa menos com o perigo. O papel de uma criatura de conjunto de regras deriva do que ela pode fazer (veja os parágrafos 1.763/1.776 de writing-rulesets.md), e seu temperamento é sorteado novamente com esse papel quando ele difere da primeira estimativa, a menos que a história ou os dados indiquem um, ou que seja um oponente com ficha (cujas escolhas em aberto foram preenchidas com o temperamento fornecido).

**Entrar e sair de novo (IA de combate A4).** Uma criatura de conjunto de regras que golpeou de perto neste turno e é Skirmisher, Cautious ou Cowardly usa o restante da caminhada para se afastar: um Disengage que ainda possa pagar (o da ação bônus de Nimble Escape), seguido da casa de fuga, ou, sem ele, apenas uma casa que não provoque nada e não fique ao lado de nenhum oponente. Isso é lembrado ao longo de uma janela à qual uma pessoa responde (`turnSoFar.struckClose`).

**Guarda-costas (IA de combate A5, Capability API 1.777).** Um oponente cujo `behavior.guards` indica `leader`, `casters` ou `healers` recebe a ordem de companheiro `protect` para o amigo de pé mais próximo de um desses tipos (`rulesetBodyguardOrders`): o mesmo limite de três casas, foco em quem estiver atacando o protegido e caminhada de volta até ele quando ocioso. Um guarda-costas Mindless também mantém a ordem: antes da regra Mindless de alvo mais próximo, seus candidatos se restringem a golpes contra quem estiver ao lado do protegido, quando houver algum. Uma preferência de alvo `leader` agora também considera um combatente que a história marca como líder (E2).

**Líderes (IA de combate A6).** Em lutas de conjunto de regras, um líder (`block.leader` ou o `leader` de E2) dá à ajuda para todo o lado (opções para aliados com dois ou mais alvos ou uma área) +0.6 de foco nas rodadas 1-2 (`weighRulesetLeadership`); o restante do seu lado (somente oponentes; companheiros têm a ordem de seguir) recebe +0.3 de foco no último alvo dele; e, quando o líder começa o turno, aliados em fuga a até seis casas perdem `routed`, e o gatilho que os fez perder a coragem sai de `moraleChecked`, para que testem novamente no próximo turno (`rallyRulesetSide`). A ajuda para todo o lado também considera uma opção que aplica em si uma condição cujas `auras` alcançam seu lado (Leadership de 5e), e `rulesetEffectWorth` avalia essa aura pelo valor das condições que ela concede por amigo ao alcance; o bônus de abertura é +1 de foco. A moral de Classic e Tactical ainda não tem recuperação.

**Disciplinado e fanático (IA de combate T1, T2).** `disciplined` agora tem peso de coordenação 1 (formação), +0.6 em vez de +0.3 de foco no último alvo do líder e ignora o gatilho de moral `first-fall` do conjunto de regras. `fanatical` (em `COMBAT_NAMED_TEMPERAMENTS`, nunca sorteado sem uma indicação ou dados que o nomeiem) dá peso 2 ao dano, 0.05 ao risco e 1 à proteção, não tem pontuação de moral em Classic/Tactical e nunca faz um teste de moral de conjunto de regras. O diretor espelha o temperamento que está usando em `RulesetCombatant.temperament` para esses testes de regras.

**Mudanças de temperamento (IA de combate T7, Capability API 1.779).** `aiHints.shifts` (a história) ou o `behavior.shifts` de um conjunto de regras indica até quatro `{on, to}`; `shiftCombatTemperament` aplica a primeira cujo gatilho tenha ocorrido, uma vez (`tactics.shifted`), no início do turno da unidade: `shiftTurn` em Classic/Tactical (estar encurralado ali significa estar abaixo de um quarto da saúde com um membro da equipe adjacente, sempre em Classic) e `shiftRulesetTemperament` em lutas de conjunto de regras (estar encurralado também exige não haver casa de retirada). Uma unidade que mudou mantém o novo temperamento em vez do definido nos dados, e o espelho do conjunto de regras acompanha a mudança.

**Arrogante (IA de combate T5, Capability API 1.780).** Um temperamento disponível somente quando nomeado (`COMBAT_NAMED_TEMPERAMENTS`): risco 0.2, preparação 0.05, custo 2 (um papel `solo` mantém esse custo em vez de zerá-lo), tendência de manter posição voltada à ofensiva. Sem `shifts` próprios, usa `COMBAT_ARROGANT_SHIFTS` (ferido até a metade da saúde ou aliado caído → Methodical); `tactics.shiftedFrom` registra isso. Em lutas de conjunto de regras, `retreatAloft` faz uma criatura voadora lendária arrogante (ou anteriormente arrogante) voar para cima quando fica abaixo de um quarto da saúde e a impede de caminhar na direção de alguém.

**Territorial (IA de combate T4, Capability API 1.781).** Um temperamento disponível somente quando nomeado. `syncRulesetCombatants` registra em `tactics.home` o local onde ela fica inicialmente; `rulesetTerritoryLeash` transforma `behavior.territory` (padrão 6) ao redor desse ponto no mesmo limite que um companheiro em guarda tem (um combatente substituto na posição inicial), usado por `walkTowardsTrouble` e para descartar candidatos que a façam caminhar para mais longe do território. O limite é suspenso enquanto `harmedBy` estiver fora do território. Uma criatura Mindless cujos dados dizem `territorial` mantém posição (`rulesetTerritorial`), e `tactics.home` sobrevive a um novo sorteio de tática.

**Cruel (IA de combate T3, Capability API 1.782).** Um temperamento disponível somente quando nomeado: finalização 3 (como Opportunistic), preparação 0.8. O `cruelOpponents` da configuração do jogo (desligado por padrão) se torna `CombatDirectorState.cruel`; `syncRulesetCombatants` espelha `cruel` no combatente do conjunto de regras somente nesse caso (caso contrário, `opportunistic`), e `rulesetCandidatesFrom` permite que um combatente cujo temperamento espelhado seja `cruel` pondere golpes que causam dano contra um inimigo caído e não derrotado. Lutas de Classic e Tactical não têm estado caído mas vivo, então nelas apenas os pesos se aplicam.

**Honrado (IA de combate T6, Capability API 1.783).** Um temperamento disponível somente quando nomeado: finalização 0.2. Em lutas de conjunto de regras, sua seleção descarta candidatos que miram um inimigo em fuga, caído ou rendido (quando resta qualquer outra opção) e dá +0.6 de foco ao inimigo que o feriu por último e +0.3 a um inimigo ao lado dele. O comando `yield` da equipe (oferecido como `DirectedRulesetView.canYield` enquanto todos os oponentes de pé forem honrados) encerra a luta como uma `defeat` com `CombatSummary.yielded`, que a recapitulação informa ao Game Master como uma rendição aceita.

**Faminto (IA de combate T8, Capability API 1.784).** Um temperamento disponível somente quando nomeado: finalização 2, preparação 1. Sua seleção dá +0.6 de foco a `tactics.targetId`. No início do turno de conjunto de regras, `dragOffPrey` encontra os inimigos que ele arrasta (`rulesetDragging`), torna o primeiro seu alvo e caminha até `rulesetRetreatCell` ignorando-os, de modo que o arrasto os leve junto; depois, não caminha na direção de ninguém nesse turno.

**Criaturas voadoras mantêm a altitude (IA de combate A7).** Quando o turno de uma criatura voadora de conjunto de regras fica ocioso no chão (`keepAloft`), e ela pode voar, tem uma ação de dano à distância disponível, não é Bruiser, Reckless nem Mindless, e há um oponente de pé que não pode voar, ela usa Fly para subir onde o tabuleiro tem níveis e depois continua o turno (um tiro, sua movimentação para manter distância) pelo ar.

**Casas de água, passagens apertadas, presas e tiros de longe.** Uma posição salva em uma casa de água é carregada (a verificação de salvamento não considera mais a água bloqueada). Uma fuga (`rulesetRetreatCell`) nunca termina em uma passagem apertada para uma criatura maior que uma casa. Uma criatura faminta arrasta somente presas de pé e, assim que todos os outros inimigos de pé estão além de sua caminhada mais uma casa, fica parada em vez de continuar arrastando. Um combatente rendido mostra uma bandeira branca no token e "Surrendered" no cartão, em vez de uma caveira de derrotado. Uma criatura pensante cujo melhor golpe de perto causa em média mais de uma vez e meia o dano de seu tiro (`rulesetShotFromAfar`) só atira enquanto não consegue alcançar, depois se aproxima, em vez de manter posição. Só contam as ações que ela pode fazer agora: um golpe concedido por Flame Blade que ela ainda não invocou não é contado.

**Soltar os caídos e prisioneiros.** Um portador solta, gratuitamente (`rulesetLetGoOfHeld`), inimigos caídos que segura enquanto outro inimigo ainda está de pé, a menos que seja cruel e o jogo permita golpear os caídos. Empurrar ou agarrar alguém que já segura não vale nada, assim como um empurrão sem lugar para onde mandar o alvo, então um crocodilo morde quem está em suas mandíbulas. O foco de uma criatura faminta na presa que segura conta apenas golpes. Um prisioneiro mantém sua casa: é possível passar por ela, mas nunca parar nela, como a de um combatente caído; seu token tem um anel branco e uma bandeira maior.

**Tiros de Multiattack e terreno aberto.** A comparação de tiros de longe conta cada golpe de um Multiattack tantas vezes quanto ele é feito e compara o melhor ataque corpo a corpo utilizável com o melhor ataque à distância utilizável, então os dois tiros de Longbow de um batedor têm mais peso que seus dois golpes de Shortsword. Uma criatura maior que uma casa escolhe terreno aberto em vez de uma passagem apertada à mesma distância; golpes a partir de uma passagem em que ela teria de se espremer valem 0.6 do mesmo golpe em terreno aberto (`RULESET_SQUEEZED_BLOWS`), e, uma vez espremida, golpes a partir de terreno aberto valem proporcionalmente mais, então ela sai para golpear.

<a id="boss-turns-controlled-by-the-gm"></a>

## Turnos de chefes controlados pelo GM

### Identidade e responsabilidade

Acrescente identidade explícita de chefe por unidade nos dados do encontro. Não transforme automaticamente o membro mais forte de cada grupo em chefe do GM. Graus sugeridos: comum, elite, chefe; elite continua controlada pelo motor salvo designação explícita como chefe. A classificação musical do encontro inteiro pode continuar separada.

O GM seleciona ação legal para o chefe conforme personalidade estabelecida, intenção do encontro, tabuleiro atual, capacidades/recursos/itens da equipe e mecânicas com suporte. Essa consciência ampla permite antecipação, não conhecimento de escolha não confirmada do jogador; [Chefes GM, ações lendárias e reações](#gm-bosses-legendary-actions-and-reactions) define o contrato de informação e interrupção. O motor controla alcance, movimento, recursos, lançamentos, dano, condições e orçamentos de turno. Auxiliares comuns continuam controlados pelo motor mesmo com chefe presente.

**Oponentes nomeados e brilhantes (IA de combate P9).** Um jogo também pode fazer o GM controlar cada oponente nomeado (o `aiHints.named` do blueprint do encontro, dado somente a indivíduos nomeados da história) e cada oponente com mente `genius` (pelo `aiHints.mind` da história ou, na ausência dele, pelos próprios dados de conjunto de regras). O `aiHints.mind` da história só pode reduzir a capacidade de pensar em relação ao que os próprios dados da criatura dizem (uma criatura dominada ou enlouquecida), ou substituí-los quando não indicam mente alguma: uma indicação isolada nunca transforma um lobo em estrategista. A opção de configuração é `gmNamedControl`, oferecida sob o controle de chefes e fixada com ele quando a luta começa; sua ausência significa somente chefes. Esses oponentes recebem o mesmo contrato de um único ID do menu, tempo limite e alternativa de um chefe, mas nenhum orçamento lendário que não possuam. Em uma luta de conjunto de regras, o prompt também leva o perfil do oponente (mente, temperamento, papel, proficiência e seu `behavior` de conjunto de regras), o outro lado ordenado por ameaça e as ordens dos companheiros da equipe.

**As próprias sugestões do Engine.** Em um turno do Game Master em uma luta de conjunto de regras, o Engine pontua os candidatos do oponente exatamente como seu próprio seletor faria (`rankRulesetChoices`, os mesmos pesos de `chooseCombatCandidate`) e marca os três melhores nas opções da decisão como `suggested: { rank, reason }`, acrescentando qualquer um que a lista reduzida tenha deixado de fora. O prompt os leva como `engineSuggestions`, uma linha para cada um em uma gramática fixa: `1. CANDIDATE: <id> ACTION: <label> -> <targets> REASON: <why>`. O motivo indica as maiores parcelas da pontuação (dano com sua previsão, um abate provável, quem ele mais quer derrubar, uma preparação, ajuda, o custo que gasta, o perigo em que está) e a caminhada que faz primeiro. Assim, um modelo que não conhece o conjunto de regras ainda vê por que uma magia supera outra; pode escolher qualquer candidato oferecido e recebe a instrução de seguir uma sugestão, a menos que a personalidade do oponente, a história ou uma jogada melhor indiquem outra coisa. Não há chamadas de ferramenta envolvidas. Lutas de Classic e Tactical fazem o mesmo: quando uma janela comum do Game Master se abre, `chooseClassicAction` ou `decideProfileAction` ordena os candidatos da unidade sem fazer a escolha, e as três melhores opções correspondentes levam `suggested`, mostradas nesse prompt como `engineSuggestions` na mesma gramática.

Configuração recomendada: habilite o novo sistema tático em novas partidas quando a funcionalidade completa for entregue e ofereça **GM directs bosses** (GM dirige os chefes) como opção claramente explicada que usa a conexão GM configurada. Explique que turnos de chefe podem aguardar resposta do modelo e incorrer no uso normal do provedor. Partidas existentes mantêm comportamento até o usuário optar; fixe a escolha no início do encontro. Uma opção só do motor/offline usa os mesmos perfis para chefes. Não acrescente outra enumeração de estilo de combate para esse ajuste nem mude silenciosamente o controlador no meio da batalha.

### Orquestração de turnos

Mantenha chamadas ao provedor em um serviço de orquestração do servidor, fora do motor compartilhado puro:

1. Aceite ação do jogador com identidade do encontro, ID de ação e revisão esperada. Valide pelo estado aceito da batalha.
2. Avance para a próxima ação comum ou decisão de interrupção na ordem existente. Separe declaração e resolução de efeitos para uma reação poder interromper conjuração pendente; não resolva uma rodada inteira para depois reescrevê-la.
3. Persista a ativação/janela pendente: ID da unidade, revisão, cursor de turno, ação disparadora/pendente, versão da política e menu limitado de candidatos legais.
4. Peça à conexão GM um ID estruturado de candidato ou passar. Inclua o snapshot atual das fichas da equipe, intenção do chefe, mecânicas com suporte e só informações de ação apropriadas à janela, conforme [Chefes GM, ações lendárias e reações](#gm-bosses-legendary-actions-and-reactions). Uma breve narração opcional não pode alterar estado.
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

## Contrato de dados e integração

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

## Verificações de diversão, realismo e rejogabilidade

**Diversão:** inimigos devem ter hábitos que o jogador reconheça e explore. Vencer por separar guarda Protective de curador Supportive satisfaz mais que vencer porque um pontuador universal escolheu jogada ruim aleatória. Evite transformar todos em máquinas perfeitas de fogo concentrado.

**Realismo:** use objetivos críveis, informação limitada e competência adequada. Covardia, lealdade, agressão e treinamento são qualidades diferentes. Mindless é a simplificação pedida para duas categorias de criatura. A moral (rendição e fuga) e o temperamento territorial já existem, em [Proteções práticas](#practical-guardrails); objetivos mais ricos ainda não.

**Rejogabilidade:** varie perfis e composição entre sementes, preservando identidade na batalha e de NPCs recorrentes. Terreno, combinações de papéis, recursos inimigos e objetivos devem criar variação além de outro lançamento crítico. Dificuldade deve mudar desafio previsivelmente sem um Mindless Beast começar de repente a caçar curadores.

Exemplo de encontro no mesmo mapa:

- Um Reckless Bruiser deixa a casa segura para pressionar unidade alcançável da frente.
- Um Protective Bulwark fica perto do conjurador Supportive em vez de participar da investida.
- Um Cautious Marksman mantém linha de tiro e evita destino exposto.
- Um Mindless Beast pega a rota mais curta na floresta rumo ao membro alcançável mais próximo, ignorando conjurador ferido mais distante.
- Um chefe humanoide nomeado recebe turno GM para escolher entre pressão característica legal e proteger sua retirada. Seus auxiliares continuam com os próprios perfis.

Outra semente pode produzir Cowardly Bruiser e Opportunistic Marksman, mudando o confronto. Recarregar não pode. Uma aparição posterior do mesmo chefe nomeado deve preservar hábitos estabelecidos salvo mudança pela história ou edição explícita.

<a id="current-ordinary-ai-implementation-boundary"></a>

## Limite atual da implementação da IA comum

Vocabulário implementado: Mindless, Reckless, Cautious, Opportunistic, Protective, Supportive, Disciplined, Cowardly, **Patient, Methodical e Coordinated**. Outros adjetivos abaixo são ideias, não configurações ocultas de execução.

O contrato compartilhado `features/combat-ai.ts` separa papel, adjetivo, grau de treinamento e semente salvos do controle. Novas batalhas recebem atribuições salvas; restauradas sem perfil mantêm a política automática anterior. Alterar controlador do companheiro não sorteia seu adjetivo novamente. Reservas finitas geradas de MP e tipos/custos explícitos de capacidades passam à execução; MP inimigo omitido usa a mesma reserva provisória `20 + 3 × level` dos aliados sem atributos, preservando zero explícito. É alternativa genérica do Engine, não regra de recurso de mesa.

A atribuição v1 é intencionalmente menor que a fórmula proposta em [Atribuir perfis: papel, experiência, personalidade e variedade com semente](#assigning-profiles-role-experience-personality-then-seeded-variety): perfis compatíveis começam com peso positivo, favorecidos pelo papel ganham bônus dependente do treinamento, e uma indicação opcional de personalidade de enumeração fechada acrescenta preferência limitada. A precedência de categoria força Mindless; indicação explícita Mindless também o seleciona para outras categorias. A chamada existente de geração fornece indicações em qualquer idioma; o motor não interpreta prosa de personalidade diretamente. Outras indicações de temperamento são preferências, não garantias, e a compreensão de negação/caracterização multilíngue pelo modelo ainda precisa de avaliação do provedor. Proveniência completa e personalidade ligada à identidade entre encontros recorrentes continuam como trabalho posterior. Nível derivado de HP continua uma aproximação fraca do treinamento sem indicação.

Cada modo enumera ataques básicos, capacidades e opções defensivas executáveis, depois pontua dano, finalização, cura efetiva, apoio, custo e fatores táticos pertinentes. Nenhuma chamada de modelo por turno comum é acrescentada. Perfis nunca concedem capacidade indisponível, MP ilimitado, ativação extra ou terreno inexistente.

- **Classic:** sem pontuação espacial. Mindless usa ordenação estável com semente de adversários vivos, independente de HP. Apoio usa o conjunto aliado correto. Melhorias/enfraquecimentos aplicam modificador real nomeado de defesa em vez de aproximação só de dano. Novos perfis têm recargas por uso. Companheiros manuais enfileiram ataque/capacidade/defesa para suas posições de iniciativa; inventário da equipe e ações narrativas continuam com o líder ativo. Outros companheiros usam IA por padrão, como na interação estabelecida Classic. Comandos identificam o ator, inclusive quando o líder original está KO.
- **Tactical:** destinos legais alcançáveis de ataque/apoio alimentam a política. Mindless segue rota de menos passos pagando o custo real; voo e teletransporte mantêm restrições próprias. Apoio pode mover antes de conjurar. Novas estimativas de contra-ataque usam destino prospectivo. Estimativa conservadora de alcance pelo estado público fornece exposição; não é busca completa de caminho no próximo turno. Uma parede ou uma montanha bloqueia a visão em todo ataque (combate C6).
- **Patient:** favorece espera defensiva limitada em vez de confronto desfavorável; Classic espera recarga quase pronta em vez de movimento fictício. Não pode esperar para sempre enquanto houver ação útil.
- **Methodical:** prefere preparação com suporte de redução de defesa, mantém alvo e ataca quando o estado é útil. Sem árvore inventada de combo ou busca de lançamentos futuros.
- **Coordinated:** considera alvos registrados dos aliados e enfraquecimentos úteis, recalculando após cada ação aceita. Não há planejador onisciente de equipe nem reserva de ações não enviadas do jogador.
- **Companheiros:** seleção localizada **Player/AI** (jogador/IA) por membro na batalha, mantendo o líder ativo manual. Companheiros Tactical agem após comandos manuais restantes ou **End Turn** (encerrar turno). Intervenção manual continua possível antes de agir. Mudanças de controlador, perfis e memória persistem com combatentes/snapshots táticos.
- **Persistência Classic:** resultados aceitos e número da próxima rodada vão ao callback existente de snapshot antes da animação cosmética. Recargas reais por uso sobrevivem à ida e volta. Classic ainda usa os lançamentos aleatórios existentes; não é reprodução exata de dados nem registro idempotente autoritativo de ações. Garantias de abas simultâneas pertencem ao futuro trabalho autoritativo de chefes.

O primeiro marco parou antes de chamadas a provedores e reações; [Chefes GM, ações lendárias e reações](#gm-bosses-legendary-actions-and-reactions) registra a implementação posterior. Limites restantes incluem provocação, objetivos mais ricos, iniciativa por regras, normalização completa de recursos das fichas e registro de perfis de NPCs recorrentes. Partes não implementadas da proposta original continuam como trabalho de aceitação, não funcionalidade implicitamente entregue. Medições sintéticas em desktop não calibram desempenho em celular real.

## Mais adjetivos com comportamento sensível à classe

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

Melhores próximos acréscimos após os onze atuais: **Frugal, Relentless, Disruptive e Vengeful**. Frugal e Relentless combinam com capacidades existentes com pequenas mudanças de estado. Disruptive precisa de semântica real de incapacidade/dissipação; Vengeful de memória de eventos. Adaptive tem alto valor de rejogabilidade, mas pré-requisitos maiores. Territorial já foi lançado para lutas de conjunto de regras como um temperamento disponível somente quando nomeado (IA de combate T4, acima). Trate Resolute e Zealous como candidatos a testar sobreposição antes de ampliar o vocabulário público.

Os três acréscimos pedidos também variam por classe:

| Adjetivo | Bruiser / Bulwark | Skirmisher / Marksman | Spellcaster / Supporter |
| --- | --- | --- | --- |
| Patient | Prepara-se enquanto uma troca ruim melhora; mantém aproximação valiosa em Tactical | Aguarda alcance legal útil sem forçar tiro fraco | Conserva turno para magia quase pronta ou evita cura inútil; nunca espera regeneração inexistente de mana |
| Methodical | Aplica técnica real de enfraquecimento, depois ataca esse inimigo | Prepara vulnerabilidade com suporte antes da explosão | Enfraquece antes de causar dano ou prepara sequência defensiva com suporte; efeitos ativos úteis não são reaplicados |
| Coordinated | Pressiona alvo atual de aliado ou fornece preparação útil | Finaliza alvo já ameaçado pela equipe | Fornece apoio não redundante ou enfraquecimento explorável; recalcula após cada ação |

Estas descrições são metas de ajuste. A primeira implementação usa o modelo genérico atendido de melhoria/enfraquecimento de defesa; combinações mais ricas por classe exigem capacidades correspondentes e cenários de regressão.

<a id="summoning-design-extension"></a>

## Extensão de design de Summoning

Comece sem grade. Uma invocação é combatente real com ID estável de encontro, referência de dono, lado, perfil, controlador, duração, custo e orçamento explícito de ativação. A classe muda suas capacidades legais; o adjetivo muda prioridades como em Classic.

Separe a **escolha de invocação** do invocador da **política de combate** da unidade invocada. Invocador Patient pode guardar vaga para ameaça futura; Knight invocado Protective protege por ações com suporte; Mage invocado Methodical prepara enfraquecimento; curador Coordinated evita cura duplicada. Invocações Beast/Monstrosity continuam Mindless pela regra atual, mesmo amigas.

As regras decidem se comandos consomem ação do dono, se invocação age imediatamente ou na próxima rodada, se compartilha iniciativa e o que faz sem comando. Padrão genérico recomendado: invocar consome a ação comum do dono, a unidade nova ativa primeiro na próxima rodada e usa IA do motor salvo controle explícito. Não conceda novo turno comum por dispensar/reinvocar a mesma unidade. Imponha limite de população e contabilidade estável de uma ativação por rodada antes de capacidades de enxame.

KO do dono, encanto/mudança de lado, dispensa, término de duração, derrota da equipe e fim do encontro precisam de regras explícitas de limpeza. Salve dono e duração restante em recarga/importação. Invocação derrotada não é item de inventário nem membro permanente. Custo de magia/MP é descontado uma vez pela criação aceita. Ações de invocação não devem fabricar janelas lendárias além da elegibilidade fixada pelo modificador de chefe.

<a id="gm-bosses-legendary-actions-and-reactions"></a>

## Chefes GM, ações lendárias e reações

<a id="implemented-generic-engine-adapter"></a>

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
- Em Tactical, a janela após turno segue mover mais agir ou Wait (esperar), não cliques de movimento, cada golpe, contra-ataques, quadros de animação ou fase inteira do jogador. Em Classic, segue a posição resolvida de iniciativa. End Turn fecha cada ativação elegível pulada no máximo uma vez; invocações seguem elegibilidade fixada.
- Ofereça `pass` e só candidatos legais dentro do orçamento. Nenhuma ação lendária abre outra janela lendária ou concede duplicação por velocidade. Magia lançada como ação lendária pode disparar Counterspell apenas se o adaptador selecionado permitir; orçamentos continuam separados.
- Confira chefe vivo/apto, legalidade do alvo e resultado da batalha antes de pedir e aceitar decisão. Chefe derrotado não pode gastar resposta tardia. Restrições Mindless ainda valem para alvo/perseguição, incluindo opções lendárias.
- Diferencie ação comum, reação, ação lendária e evento de covil/fase. São orçamentos/gatilhos separados; não deixe descrição criar dano novo ou ativações gratuitas.
- Auxiliares comuns ficam na IA local. GM é chamado só em janelas de chefe com escolha significativa. Reutilize conexão configurada, debug, alternativa salva e limite agregado de [Turnos de chefes controlados pelo GM](#boss-turns-controlled-by-the-gm).

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

Contrato salvo mínimo: ID de encontro, revisão, ID/cursor de ativação, ator confirmado, tipo/ID da janela, evento disparador e IDs de ação pendente/pai, revisão de contexto do controlador e de candidatos, ordem de reagentes elegíveis/resolvidos, orçamentos lendários e de reação, variações reservadas/confirmadas/reembolsadas de recursos, escolha/passe aceitos, estado de resolução, resultado do provedor/alternativa e efeitos restantes. Aceite atomicamente decisões com custos/resultados. Resposta tardia ou duplicada não gasta de novo. Restaurar retoma janela pendente ou reproduz resultado aceito; ramificar/voltar isola todo o registro, não só narração. Não há Restore somente de texto que reembolse reação aceita. O registro servidor descrito em [Adaptador genérico do Engine implementado](#implemented-generic-engine-adapter) fornece a implementação inicial; [Turnos de chefes controlados pelo GM](#boss-turns-controlled-by-the-gm) preserva o contrato de longo prazo.

Interface: mostre pontos lendários restantes, disponibilidade de reação e custo oferecido; diferencie antecipação de reação disparada. Mostre por que houve interrupção e se a magia original resolve, falha ou precisa de nova escolha. Exponha pensar/esperar, repetir/alternativa e cancelar de modo acessível. Anuncie ataques carregados quando exigido. Nunca alegue que GM escolheu alternativa local. Mantenha pontuações/prompts internos fora do menu do jogador.

Provas exigidas: magias/recursos/itens corretos da equipe no contexto GM; previsão de recursos esgotados; previsão Fireball plausível mas errada; nenhum vazamento de rascunho/comando enfileirado; nenhuma multiplicação por clique/resseleção; jogador muda ação legal após antecipação; momento nativo 5e contra regra da casa; Counterspell só após gatilho legal de conjuração; passar magia fraca contra contestar letal; sem MP/espaço/reação; custo único no contra falho; reembolso específico da magia original; visibilidade/alcance proibidos; vários reagentes e contras anulados; nenhuma janela extra por movimento/seguimento/reação; posição Classic correta; escolha manual enfileirada invalidada; unidades Tactical puladas/elegibilidade de invocações; orçamento lendário esgotado; renovação uma vez; morte/resultado na espera; duplicatas; timeout seguido de sucesso tardio; recarga, abas simultâneas, ramificação/retorno e mudanças de configuração. Acrescente comportamento com provedor real e ritmo móvel representativo após testes determinísticos de rota.

<a id="encounter-environment-agent-handoff"></a>

## Orientação do agente de ambiente do encontro

A área de texto **Terrain guidance** (orientação de terreno) e sua linha de resumo foram removidas da criação de partidas. Arquivos antigos de configuração podem manter o campo por compatibilidade, mas a geração de encontros não o injeta mais em toda luta. Battlefield Size continua uma preferência reutilizável. Novas batalhas recebem sementes internas individuais; mapas salvos e reinícios preservam sementes aceitas. O rótulo Tactical descreve movimento, terreno e previsões sem citar outro jogo.

Um futuro agente **Battlefield Scout** deve rodar na preparação do encontro, usando localização atual do jogador, cena/ambiente mais recente, detalhes criados do mapa, clima e eventos recentes relevantes. Envia ao GM um resumo ambiental antes da geração do encontro, não na criação do mundo nem a cada turno comum.

Responsabilidades:

| Responsável | Trabalho |
| --- | --- |
| `Pasta-Devs/Marinara-Agents`, `staging` | Definição do agente, prompt padrão, runtime do pacote, catálogo/manifesto, recursos e configurações próprias desse agente |
| Marinara Engine, `staging` | Hook de preparação do encontro, contrato limitado de entrada da cena, entrega validada do resultado do agente, roteamento do provedor configurado, cache e alternativa, procedência salva do terreno |

Entradas devem conter revisão de encontro/localização e distinguir fatos observados de sugestões incertas. Saída: resumo curto do ambiente com suporte, elementos limitados de terreno usando o esquema existente `TacticalBattlefieldBrief` quando pertinente e referências de fontes. Nada de regras executáveis, coordenadas arbitrárias de casas, recursos inventados, privilégio de chefe ou alterações de HP. Classic pode receber contexto/perigos descritivos, mas não modificadores de grade sem suporte no resolutor.

O GM recebe o contexto aceito e ainda produz o encontro; o Engine valida o terreno final. Use cache por revisão de encontro/localização, descarte respostas obsoletas após viagem ou mudança de cena e evite chamadas pagas repetidas em novas tentativas. Se desabilitado, ausente ou expirado, use o contexto atual de geração com a alternativa habitual de terreno procedural. Salve o terreno aceito em vez de regenerar ao recarregar. Acrescente logging de prompts de debug e testes de esquema, timeout e localização obsoleta. Este agente está documentado aqui, não implementado no Engine nem instalado silenciosamente.

## Dificuldade e clima

### Configuração e dificuldade

Remova o campo **Battlefield Seed** (semente do campo de batalha) e seu resumo, mantendo **Battlefield Size** (tamanho do campo de batalha). Novos encontros recebem sementes aleatórias internas. Ignore as preferências obsoletas de semente da campanha ao iniciar batalhas futuras; preserve sementes aceitas, grades e comportamento de reinício. Altere a descrição de Classic para "Cinematic menu battles."

Normalize a dificuldade por um único helper compartilhado, incluindo configurações antigas com iniciais maiúsculas. Mantenha os multiplicadores de dano inimigo Casual 0,6, Normal 1, Hard 1,3 e Brutal 1,6. Classic deve ajustar apenas o dano inimigo, como Tactical. Audite encontros e saques para o mesmo erro de capitalização. Fixe a dificuldade na criação do encontro, sem alterá-la quando as configurações mudarem durante o combate.

Esses multiplicadores pertencem somente a Traditional (as mecânicas legadas atuais do Engine). Ao implementar 5e, V20 ou outro conjunto de regras, reavalie a dificuldade pela política desse sistema. Não herde os multiplicadores de Traditional por padrão. O ajuste das decisões da IA é separado do escalonamento de dano.

### Clima

Use o clima existente da campanha e a exposição fundamentada do encontro. Salve o clima aceito com o encontro; a ausência do campo em um combate antigo salvo significa mecânicas neutras. Exposição desconhecida é neutra. Ambientes fechados são abrigados. Os aliases atuais de clima devem ser normalizados para os tipos existentes, e definir um tipo deve gerar vento e visibilidade compatíveis.

As regras iniciais valem igualmente para os dois lados: chuva reduz moderadamente o dano de fogo e aumenta o de raio; vento forte penaliza ataques explicitamente marcados como projéteis; baixa visibilidade penaliza ataques explicitamente dependentes de visão; neve aumenta o custo de caminhada em Tactical. Voo e teletransporte mantêm suas regras de movimento. Nenhuma característica de projétil/visão é deduzida do nome de capacidades sem marcação. Tempo limpo/nublado normalmente é neutro. Helpers compartilhados devem orientar previsões, resolução e estimativas da IA sem consumir futuros lançamentos de combate.

Mostre condições e efeitos aceitos nas duas interfaces de combate. Configurações cosméticas do clima não podem desativar as mecânicas. O clima permanece fixo durante um encontro; capacidades de mudar o clima, transições periódicas, raios aleatórios e desgaste por calor ficam para depois. Summoning e futuros conjuntos de regras podem reutilizar o contrato compartilhado de clima sem acrescentar um modo de interface inacabado.

### Decisões inimigas

Preserve papel, adjetivo, proficiência, legalidade e controle de recursos. A dificuldade altera uma variação decisória limitada e com semente: Casual permite mais erros plausíveis, Normal fica próximo da base atual, Hard é mais consistente e Brutal minimiza erros mantendo diferenças de proficiência. Os companheiros usam uma base fixa Normal em toda dificuldade; continuam reagindo ao clima e perigo reais. As restrições de Mindless permanecem intactas.

Use pontuações que considerem o clima para ataques, apoio, posicionamento e reações. Counterspell e guard competem com passar conforme ameaça, custo e personalidade. Nenhuma dificuldade concede comandos ocultos, lançamentos futuros, recursos gratuitos ou ações adicionais. O prompt do GM (mestre do jogo) recebe a dificuldade/o clima aceitos e orientações sobre pressão e escolha de oportunidades; o Engine continua impondo escolhas legais e orçamentos oferecidos. Uma falha do provedor mantém a alternativa local.

### Detalhes da implementação

As condições compartilhadas ficam em `packages/shared/src/features/combat-conditions.ts`. A dificuldade é normalizada na importação/criação da configuração e nos consumidores de encontros, saques, Classic e Tactical. A variação das decisões inimigas é multiplicada por 2,5 / 1 / 0,4 / 0,15 para Casual / Normal / Hard / Brutal; proficiência e personalidade salvas continuam valendo. As estimativas Classic usam a mesma probabilidade de acerto de d20 oposto da resolução, enquanto Tactical usa a previsão compartilhada de ataque. A perseguição Tactical classifica as rotas pelos custos de terreno e clima para os perfis comuns. Unidades Mindless escolhem a rota legal com menos passos espaciais; ambas as políticas pagam os custos reais de terreno e clima durante o movimento. As reações consideram ameaça esperada e escassez de recursos, com a mesma política de variação apenas para inimigos.

Chuva, chuva intensa e tempestades com exposição multiplicam o dano de fogo por 0,85 e o de raio por 1,15. Projéteis explícitos perdem 10 pontos de precisão com vento forte e 15 com vendavais. Ataques explicitamente dependentes de visão perdem 5 pontos com visibilidade reduzida e 15 com visibilidade ruim. As penalidades combinadas têm limite de 25 pontos. Classic converte esses valores em modificadores de lançamentos de ataque opostos (um ponto para cada cinco pontos de precisão), e sua exibição de condições nomeia essas penalidades. Neve/nevascas com exposição em Tactical acrescentam um ponto de caminhada por casa percorrida; voo e teletransporte não mudam. Itens de dano elemental também recebem os modificadores de chuva; cura e duração de estados não.

A geração de encontros produz os booleanos `projectile` / `requiresSight` de ataques básicos e capacidades e `battlefield.terrainBrief.exposure`. Características de ataque ausentes são neutras. A exposição explícita tem precedência; ambientes fechados reconhecidos são abrigados, externos reconhecidos são expostos, e ambíguos são desconhecidos. O clima da campanha vem do sistema de clima persistido, com alternativa no valor climático de cena confirmado se ausente. Tags de mensagem de início de combate suprimem a progressão climática em segundo plano antes de o modo renderizado acompanhar. Condições aceitas são salvas no diretor e no estado Tactical; importações contraditórias ou malformadas são recusadas. Salvamentos existentes sem clima permanecem neutros. Reinícios Tactical legados passam as condições aceitas (incluindo ausência neutra), em vez de amostrar o clima alterado da campanha.

A configuração ainda valida campos obsoletos nas importações por compatibilidade e segurança, mas os remove das exportações normalizadas. O Engine mantém sementes explícitas de encontro para restauração/reinício e reprodução de regressões. Isso não remove as sementes de mundo de Experience, que têm outra finalidade.
