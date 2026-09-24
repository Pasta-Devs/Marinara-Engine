# Conjuntos de regras de combate versionados: orientação de implementação

> **Estado em 19 de setembro de 2026.** O adaptador `5e-2014` reservado neste documento está sendo construído como um tipo de combate ORIENTADO A DADOS, em vez de um adaptador TypeScript por sistema: o conjunto declara um bloco `combat` opcional e o motor é dono do tipo que o resolve, assim como dos tipos de resolução de testes. Os motivos, a arquitetura e as etapas estão em `game-rulesets-and-sheets-implementation.md` § Real ruleset combat, e o trabalho é acompanhado na [issue #6361](https://github.com/Pasta-Devs/Marinara-Engine/issues/6361). O restante continua valendo: o conjunto Traditional e seu comportamento de velocidade aceito, o contrato do produto, a regra de que a dificuldade pertence ao conjunto e nunca vira multiplicador de dano, o registro único do diretor controlado pelo servidor, as janelas de reações e ações lendárias, e o contrato de salvamento, interface e lançamento.
>
> Desde C3a o tipo está CONECTADO: resolve uma luta no registro existente do diretor como terceiro `style` ao lado de `classic` e `tactical`, com a mesma revisão, idempotência, mutex e chamada única ao modelo para escolher um ID de candidato. Desde C3b está NA TELA: um conjunto que declara `combat` luta na interface Classic com seu menu, seus termos e os cálculos reais no registro; as fichas são salvas durante a luta, não depois. Desde C4a tem POSIÇÕES: `combat.distance` permite lutar no tabuleiro gerado do motor tático, com movimento, alcance, distâncias, áreas de explosão, cone e linha, linha de visão, cobertura e ataques contra quem se afasta, tudo resolvido com os números do conjunto, e um oponente que se move. Desde C4b o tabuleiro está NA TELA: o terreno do estilo tático mostra as casas alcançáveis e seus custos, os caminhos, quem cada passo provoca, os alvos válidos e onde mirar uma área, tudo obtido da visão do servidor e expresso na distância do conjunto. Reações e janelas de ações especiais ainda virão em C5.
>
> O campo é desenhado na tela desde C4b. Desde C5a um TURNO pode fazer o que um turno de mesa faz: um golpe pode carregar outra cláusula de dano; uma ação pode comprar vários ataques; uma habilidade pode não gastar orçamento, devolvê-lo ou permitir comprar uma ação padrão com outro; um efeito adicional pode se aplicar ao primeiro golpe válido de um período; e uma condição pode alterar as salvaguardas do portador, reduzir todo dano pela metade, impedir atacar ou se aproximar de quem a aplicou, valer só enquanto essa pessoa estiver visível ou terminar quando ela cair. Desde C5b a luta pode FICAR EM ESPERA: sair do alcance de alguém interrompe o movimento onde está e pergunta se essa pessoa quer atacar, em vez de atacar por ela; o intervalo entre atores para e pergunta a cada bloco com pontos se quer comprar uma de suas ações. Enquanto uma janela está aberta, nada mais avança; a luta retoma exatamente onde parou. Desde C5c uma entrada de catálogo informa QUAL momento espera: `aimed`, antes de algo atingir seu portador, pode cancelar esse efeito; `harmed`, depois de ele sofrer dano, mira de volta em quem o causou. O custo é pago antes da pergunta: cancelar uma ação impede que aconteça, não que tenha sido comprada. As cadeias ainda virão: há uma janela, não uma pilha, então um contra-ataque não pode ser contrariado por outro.

Status: proposta de implementação, 17 de setembro de 2026. A reformulação da IA não implementa estes conjuntos de regras. A exigência de golpe adicional por velocidade em Traditional é uma direção aceita para o produto; limites e outros padrões abaixo são propostas de ajuste. Implemente no `staging` atual, depois de verificar trabalhos relacionados.

## Contrato do produto

Mantenha quatro escolhas independentes:

| Escolha | O que controla | Exemplos |
| --- | --- | --- |
| Apresentação | Informação espacial e entrada | Menus Classic; grade Tactical |
| Participação | Quem luta | Equipe; futuro Summoning |
| Conjunto de regras | Ações legais, recursos, sequência dos turnos, resolução | Traditional; 5e com versão explícita; V20 |
| Controlador | Quem escolhe uma ação legal | Jogador; IA local; chefes do GM |

Um Cautious Mage deve continuar cauteloso nas duas apresentações. Mudar as regras altera o que o Mage pode fazer, não sua personalidade. Summoning é um sistema de participação, não um terceiro motor de regras; sua primeira apresentação pode ser não espacial. Nenhum modo pode inventar distância de grade sem um modelo de posição.

Mostre descrições legíveis na interface do produto. Evite comparações com outros jogos nas descrições de Traditional ou Tactical. Conjuntos de regras intencionalmente nomeados pelo sistema implementado devem identificar a edição e a cobertura exatas com suporte.

### A dificuldade deve pertencer ao conjunto de regras

Os multiplicadores atuais de dano inimigo do Engine (Casual 0,6, Normal 1, Hard 1,3, Brutal 1,6) destinam-se apenas a Traditional. Reavalie-os ao implementar regras alternativas: 5e, V20 e adaptadores futuros não devem herdá-los automaticamente. Defina a dificuldade pelo modelo de encontros e resolução próprio de cada sistema. Separe o ajuste decisório da IA inimiga do escalonamento aritmético de dano. Acrescente uma regressão de adaptador que prove que selecionar outro conjunto não aplica silenciosamente a tabela Traditional. Esta nota não renomeia as mecânicas legadas atuais como um conjunto Traditional implementado.

## Código atual e restrições

- `packages/shared/src/types/game.ts`: `Combatant`, `CombatSkill`, resultados e snapshots Classic. Os atributos atuais são números genéricos; `speed` não é Destreza de RPG de mesa nem distância de movimento em pés.
- `packages/server/src/services/game/combat.service.ts`: Classic lança iniciativa a cada rodada, resolve um comando por participante e usa fórmulas genéricas de dano. Partidas legadas fazem o estado circular pelo cliente; novas partidas do assistente usam o registro do diretor de combate sob autoridade do servidor.
- `packages/shared/src/features/tactical-combat/{engine,math,types}.ts`: fases alternadas de equipe/inimigos, alcance baseado em classe, movimento derivado de velocidade, contra-ataques, ainda sem golpe adicional por velocidade.
- `packages/shared/src/features/combat-ai.ts` e adaptadores dos modos: prioridades sobre ações disponíveis. A IA comum mantém seu limite de informações; chefes do GM recebem fichas/recursos da equipe para antecipar, mas nenhum vê lançamentos futuros ou escolhas do jogador antes da declaração.
- `packages/server/src/routes/combat-director.routes.ts` e `services/game/combat-director.service.ts`: estado de encontro versionado e autoritativo, cursor de ativação, reações pendentes, orçamentos lendários e proteção contra respostas duplicadas/obsoletas. Estenda esse caminho de ações aceitas para os adaptadores, em vez de criar outro registro. Chance atual de Counterspell, pagamento de espaço e custo de cancelamento são políticas genéricas do Engine, não regras de 5e.
- `packages/server/src/routes/game.routes.ts`: validação legada de rodada/início/ação. `GameCombatUI`, `TacticalCombatUI` e `use-game.ts`: entradas, previsões, resultados aceitos e persistência.
- `GameSurface.tsx`: hidratação de blueprints gerados e snapshots de combate. `encounter.routes.ts`: prompt de geração de encontros. `game-setup-share.ts`: importação/exportação de configurações reutilizáveis.

Não renomeie a fórmula de dano atual como Traditional sem implementar e verificar o comportamento de velocidade aceito. Não apresente um lançamento de d20 com os atributos atuais do Engine como conformidade com 5e.

## Arquitetura mínima

Comece com um registro fechado de adaptadores integrados em TypeScript puro. Não acrescente linguagem de scripts nem pacotes de regras executáveis arbitrários. Reutilize os tipos existentes de ação legal e resultado quando possível; extraia um helper compartilhado só quando ambos os chamadores precisarem dele.

Persista uma referência fixada em cada novo encontro:

```ts
type RulesetRef = {
  id: "engine-legacy" | "traditional" | "5e-2014" | "v20";
  version: number;
  options: Record<string, boolean | number | string>;
};
```

Cada adaptador valida seu próprio esquema fechado de opções, sem aceitar o registro de exemplo sem restrições. Inclua uma lista de capacidades com suporte (movimento, contra-ataque, espaços de magia, gasto de sangue, invocações, reações de chefes). Rejeite opções explícitas sem suporte com um erro útil. Dados de regras ausentes significam `engine-legacy`, nunca migração automática para Traditional.

Uma interface pequena deve cobrir:

1. Validar/normalizar uma ficha específica das regras sem adivinhar conversões.
2. Iniciar um encontro, lançar ou estabelecer a ordem uma vez no momento apropriado definido pelas regras.
3. Iniciar uma ativação: renovar orçamentos permitidos e avançar os estados apropriados.
4. Enumerar ações legais e reações opcionais, seus conjuntos de alvos, alcance, custo e janela temporal, incluindo passar.
5. Produzir uma previsão somente de leitura sem consumir RNG.
6. Aceitar uma declaração de ação, registrar seu compromisso de recursos e expor janelas de gatilho com suporte antes da resolução dos efeitos.
7. Resolver efeitos/reações pendentes em eventos ordenados e variações de recursos; expor janelas de chefe no início/após a ativação somente quando habilitadas.
8. Encerrar a rodada quando seus participantes terminarem; avançar uma vez os efeitos limitados por rodada.

O mesmo adaptador alimenta entrada do jogador, IA comum, menus de candidatos do GM e previsões. O GM não pode fornecer HP finais, IDs de capacidades fabricados, nova ordem de turnos ou alterações gratuitas de recursos. A legalidade usa o estado aceito; contextos decisórios expõem as informações apropriadas ao controlador e à janela. Chefes do GM conhecem capacidades, pontos/espaços de magia, recargas e inventário utilizável da equipe para prever ameaças. Seleções não confirmadas e outras ações na fila permanecem privadas até sua declaração. Uma previsão informa valores esperados, não futuros resultados dos dados.

Mantenha fichas específicas das regras em uma união discriminada. Não force todos os recursos para `mp`: MP, contagens de espaços, Blood Pool, Willpower, gastos por rodada e usos por descanso têm semânticas diferentes. Barras da interface e custos leem descritores do adaptador selecionado. Armazene recursos atuais e máximos separadamente; normalize nomes apenas para exibição, nunca como identidade do recurso.

## Traditional v1: comportamento de velocidade aceito

**Cada participante vivo e elegível recebe no máximo uma ativação comum e uma iniciação de combate por rodada. Um golpe adicional por velocidade é outra investida dentro da troca, não outra ativação.**

Equilíbrio inicial proposto:

| Regra | Comportamento proposto para v1 |
| --- | --- |
| Iniciativa | Speed efetiva decrescente, desempate estável do encontro; nenhuma ativação extra por empate ou velocidade alta |
| Sequência Tactical | Fase da equipe seguida da inimiga; jogador escolhe unidades da equipe que ainda não agiram, unidades automáticas usam ordem de velocidade |
| Sequência Classic | Ordem unificada de Speed efetiva decrescente; interface enfileira comandos manuais e resolve alvos legais atuais em cada posição |
| Movimento | Orçamento explícito independente de Speed. Padrão sugerido de 4 casas, com ajustes limitados de classe/capacidade |
| Attack Speed | Speed efetiva, apenas com penalidades/bônus explicitamente modelados; nenhum peso fictício de arma |
| Limite do golpe adicional | Attack Speed do atacante pelo menos igual à do defensor + 5; configurável somente como opção validada das regras |
| Ação elegível | Ataque básico ou capacidade explicitamente marcada `allowsSpeedFollowUp`; falso por padrão para capacidades |
| Troca | Golpe do iniciador → contra-ataque legal do defensor sobrevivente → golpe adicional elegível do iniciador sobrevivente |
| Defensor mais rápido | Um contra-ataque legal em v1; golpe adicional do defensor é opção de equilíbrio separada, desativada por padrão |
| MP | Reserva explícita e custo por capacidade, descontado uma vez por ativação escolhida; custos do golpe adicional devem ser definidos pela capacidade |
| Renovação de movimento | Uma vez na próxima ativação comum; contra-ataque/golpe adicional nunca o renovam |

O limite de 5 e a ordem da troca são propostas do Marinara, não uma alegação de reproduzir as regras de algum jogo específico. O mantenedor pediu que a unidade atacante mais rápida golpeasse duas vezes; duplicação defensiva não é exigida por esse pedido.

Verifique novamente estado vivo, validade do alvo, alcance, condições incapacitantes e orçamentos restantes entre golpes. Uma unidade morta pelo contra-ataque não pode desferir o adicional. Errar o primeiro golpe não cancela por si só o adicional por velocidade. Um alvo derrotado não pode ser atingido de novo nem substituído silenciosamente na mesma troca. Impeça recursão de contra-ataque para contra-ataque. Um contra-ataque não gasta a iniciação comum do defensor nem concede outra. Cura, melhoria, item, invocação e ações lendárias não duplicam, salvo exceção definida por uma capacidade explícita com suporte.

Calcule a elegibilidade a partir dos atributos efetivos aceitos no início da troca; aplique imediatamente efeitos incapacitantes durante a troca, mas não acrescente retroativamente golpes após uma melhoria de velocidade no meio dela. Coloque o resultado na lista de eventos, com previsão de um ou dois golpes e elegibilidade de contra-ataque. Recarregar durante uma animação reproduz eventos aceitos, nunca lança dados ou gasta duas vezes.

Classic não tem alcance de movimento: omita movimento ou forneça um modelo de engajamento definido separadamente. Contra-ataques Traditional em Classic exigem uma regra explícita `canCounter`; não copie verificações de alcance de grade para posições de arrays. A recomendação v1 é manter contra-ataques Classic desativados até definir engajamento básico de corpo a corpo/distância, preservando golpes adicionais de velocidade do atacante.

## Perfil 5e: nomeie a edição antes de programar

Primeiro alvo recomendado: `5e-2014`, fixado no SRD 5.1. Um perfil posterior 2024/SRD 5.2 precisa de identificador/versão próprios e testes; não combine edições silenciosamente. O [índice oficial dos SRDs](https://www.dndbeyond.com/srd) publica as versões, e o [SRD 5.1](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf) é a referência primária do primeiro alvo.

Audite a referência primária antes de implementar: iniciativa baseada em Destreza; movimento medido em distância; disponibilidade de ação, ação bônus e reação; espaços de magia; concentração e condições; lançamentos de ataque e testes de resistência distintos. Isso exige campos dedicados da ficha e fixtures de resolução. Nível/ataque/defesa genéricos do Engine não os substituem. Pontos de magia são uma variante selecionada explicitamente com fonte revisada e limites próprios, não uma reserva de espaços renomeada.

Entregue primeiro um subconjunto honesto com suporte, como ataques básicos de arma, movimento, Dodge e uma pequena lista de magias, deixando ações sem suporte indisponíveis. Não reivindique um conjunto 5e completo com base em uma fórmula de iniciativa. Mantenha a duplicação Traditional desativada; ataques extras surgem somente de capacidades implementadas do perfil.

## Perfil V20: auditoria dedicada necessária

O alvo é Vampire: The Masquerade 20th Anniversary Edition, não V5 nem V20 Dark Ages. Obtenha a referência primária apropriada antes de programar iniciativa exata, ordem de declaração, ações múltiplas, Celerity, dano/absorção, penalidades de ferimentos e limites de gasto de recursos. Nenhuma fórmula exata de V20 é aprovada por esta orientação.

Reserve uma ficha específica para Attributes/Abilities, níveis de saúde, Blood Pool e Willpower, com restrições de gasto por turno onde houver suporte. Não converta Blood Pool em MP genérico nem Celerity em duplicação de velocidade Traditional. Os testes devem citar a edição e o trecho de regra usados; resposta de fórum ou prévia de Dark Ages não bastam para fundamentar o comportamento de V20 moderno. Resolva reutilização de conteúdo e atribuição pela fonte realmente selecionada antes de distribuir texto ou blocos de atributos copiados; este documento não fornece esse conteúdo.

## Ações lendárias, antecipação e reações

Direção aceita: chefes do GM podem ter ações lendárias mesmo em Traditional ou outros conjuntos não 5e. Isso é um **modificador explícito de encontro de chefe**, independente de iniciativa comum, temperamento e participação. Veja a seção de chefes do documento de design da IA.

O adaptador expõe `afterActivation`, e um modificador habilitado de antecipação do Marinara também pode expor `activationStarted` depois de um ator confirmar o início do turno. As duas janelas lendárias gastam a **mesma** reserva finita do chefe. Cliques brutos, inspeção, menus cancelados e recargas não abrem mais janelas. O GM pode prever Fireball pelas capacidades/recursos disponíveis do mago e regras reais de área/fogo amigo antes da declaração do jogador; não pode ler um comando futuro. Essa antecipação é uma extensão de regra da casa ao momento após o turno de 5e, fixada explicitamente no encontro. Um perfil fiel mantém o momento nativo salvo habilitação do modificador.

A regra de uma iniciação de Traditional vale para ativações comuns; uma ação lendária criada não concede ativação comum nem golpe adicional por velocidade. Classic deve suspender na posição de iniciativa do ator, em vez de interromper cedo enquanto a interface reúne ordens da rodada inteira. Revalide comandos na fila após uma interrupção e peça substituição se se tornarem ilegais antes da confirmação. Tactical precisa de compromisso distinto de início de ativação para que inspecionar unidades seja seguro e nova seleção não multiplique interrupções.

Reações como Counterspell pertencem a **gatilhos de eventos** com suporte, independentemente do status lendário. Defina pelo menos evento disparador, momento antes/depois do efeito, visibilidade/alcance, custo de recurso, direito/renovação de reação, resultado e cancelamento/reembolso da ação original. GM do chefe e IA comum usam as mesmas janelas legais; unidades manuais recebem **React/Pass** (reagir/passar). A IA avalia automaticamente a janela e pode passar conforme temperamento, valor da ameaça, estimativa de sucesso, escassez de MP/espaços e custo de perder a reação. Disponibilidade nunca força gasto. Uma unidade comum pode reagir sem virar chefe.

Counterspell exige um lançamento pendente, não apenas um mago selecionado. Mantenha distintos recursos MP/pontos/espaços. A [magia de 2014](https://www.dndbeyond.com/spells/2051-counterspell) usa regras de nível de magia/teste, enquanto a [magia de 2024](https://www.dndbeyond.com/spells/2619072-counterspell) usa teste de resistência de Constituição e especifica que uma magia baseada em espaço interrompida com sucesso não gasta o espaço. Não aplique o reembolso da magia original de 2024 a todas as edições nem ao pagamento de quem reage. Traditional precisa de operação explícita e ajustada de interrupção; V20 deve mapear suas próprias capacidades reativas, sem herdar Counterspell pelo nome.

Reserve e confirme recursos atomicamente com declarações/reações aceitas, registrando reembolsos específicos separadamente. Padrão Traditional proposto: um direito de reação, inicialmente disponível salvo impedimento explícito do encontro, renovado no início da ativação comum da unidade. Outros adaptadores definem seus próprios direitos/limites de renovação. Ações lendárias e golpes adicionais nunca o renovam implicitamente. Mantenha contra-ataques de troca existentes separados salvo mapeamento explícito. Se uma opção lendária lança magia, exponha reações de magia somente conforme permitido pelas regras selecionadas.

Use uma pilha salva e limitada de ações pendentes com IDs de pai/gatilho para reações aninhadas com suporte, prioridade estável de reagentes e revalidação após cada resposta. Um lançamento já cancelado não pode ser contrariado novamente. Passar encerra a oportunidade daquela unidade para o gatilho. Um adaptador limitado deve declarar cadeias de contrarreações sem suporte. Resolva eventos aceitos uma vez e derive a narração deles; a interrupção reversível de texto da [PR #6110](https://github.com/Pasta-Devs/Marinara-Engine/pull/6110) é precedente de persistência/contexto, não permissão para reverter combate truncando prosa. Veja a seção 16 do design da IA para o ciclo completo e a matriz de aceitação.

## Contrato de salvamento, interface e implantação

- Fixe no snapshot do encontro ID das regras, versão, opções efetivas, controladores, fichas, ordem inicial, ativação atual/confirmada, orçamentos e pontos de renovação lendários/de reação, pilha pendente, IDs de gatilho/decisão, compromissos/reembolsos de recursos, recargas, estado RNG e decisões aceitas de interrupção.
- Exija um registro de revisões/ações sob autoridade do servidor antes de decisões GM assíncronas. Rejeite submissões concorrentes obsoletas e torne a repetição idempotente. Um ID de candidato no navegador não basta.
- Mudar as configurações afeta o próximo encontro. Preserve as regras fixadas da batalha ativa, inclusive após importação, restauração de checkpoint/ramificação, reconexão e atualização.
- Mantenha combates antigos em andamento no `engine-legacy`. Ofereça conversão explícita para uma batalha futura com prévia de atributos/recursos sem mapeamento; nunca sobrescreva silenciosamente fichas ou reservas salvas.
- Versões desconhecidas das regras ficam somente de leitura/recuperáveis, não são interpretadas silenciosamente como a mais recente.
- Introduza um seletor localizado **Combat rules** (regras de combate), separado de **Combat presentation** (apresentação de combate) e da futura **Participation**. Descreva brevemente ordem, recursos e comportamento principal; mostre limites de compatibilidade antes de começar.
- Se campos obrigatórios da ficha estiverem ausentes, solicite-os antes do combate; use regras legadas somente por seleção explícita. Não deixe a geração fabricar atributos autoritativos do personagem.

## Sequência de implementação e provas de conclusão

| Etapa | Trabalho | Menor prova útil |
| --- | --- | --- |
| 1 | Inventariar resolutores existentes, definir identidade fixada e adaptador legado | Salvamentos legados e ambas as apresentações atuais reproduzem o comportamento anterior |
| 2 | Implementar ativação/troca Traditional e controle explícito de recursos | Matriz do limite de velocidade; uma iniciação/rodada; controle de MP e recargas |
| 3 | Integrar previsões, seleção de interface e eventos aceitos salvos | Concordância previsão/resolução; testes de recarga/importação/checkpoint; capturas desktop/celular |
| 4 | Acrescentar fronteiras declaração/efeito, reações opcionais, antecipação de chefes e janelas após turno | Nenhuma multiplicação por seleção ou vazamento de comando futuro; IA pode passar; custos/renovação/reembolsos corretos; nenhum turno comum extra ou duplicação |
| 5 | Implementar um subconjunto declarado de 5e-2014 com fontes primárias | Exemplos positivos/negativos específicos da edição para toda ação com suporte |
| 6 | Auditar e implementar um subconjunto declarado de V20 | Iniciativa, limites de recursos e exemplos de dano verificados; nenhuma matemática acidental de 5e/Traditional |
| 7 | Adaptar orçamentos e propriedade de comandos de Summoning | Momento de criação/dispensa/morte, limite de população e nenhuma multiplicação de ações por invocação |

Casos de aceitação Traditional: diferença de velocidade 4 contra 5; velocidades iguais; contra-ataque mata atacante; primeiro golpe mata alvo; primeiro golpe erra; incapacitação durante a troca; contra-ataque à distância indisponível; recarga/MP insuficientes; jogador/IA/GM usam a mesma legalidade; duas unidades rápidas ainda iniciam apenas uma vez cada; ação lendária não reinicia esses marcadores; renovação da rodada restaura orçamentos uma vez; versão desconhecida falha com segurança.

Casos de aceitação de reação/antecipação: seleção do ator contra ativação confirmada; seleção/recarregamento repetidos; posição Classic exata; ameaça Fireball viável contra mago esgotado; previsão pode errar; passar opcionalmente uma magia fraca contra anular algo valioso; reação/MP/espaço insuficientes; contra falho ainda cobrado; reembolso da magia original específico da edição; gatilho fora de alcance/não visto; vários reagentes; contra aninhado com suporte e limites de pilha; resposta obsoleta após morte do alvo; revalidar escolha interrompida na fila; momento nativo contra regra da casa; nenhum comando oculto na fila ou RNG futuro nos prompts do controlador.

Execute `pnpm install`, `pnpm check`, provas focadas `*.regression.ts`, regressões de prompts ao mudar prompts de GM/esquema e testes básicos de interface nas duas apresentações. Siga o fluxo de issues/PRs do repositório e inclua texto localizado, changelog, acompanhamento de traduções e CodeRabbit antes da revisão. Deixe desmarcadas as caixas de verificação manual da PR.
