# Plano de desenvolvimento do combate no Game Mode

Este documento registra a direção acordada para [terreno híbrido #6265](https://github.com/Pasta-Devs/Marinara-Engine/issues/6265) e os próximos trabalhos de combate. Separa o planejado do jogo atual. A implementação começa em `staging`; isso não significa que todas as capacidades abaixo já foram lançadas.

## Separar participação e regras do campo de batalha

Os valores atuais de `combatStyle` são `classic` e `tactical`. Preserve-os. Futuras invocações pertencem a uma configuração de participação separada, com combate em grupo como padrão para configurações e saves antigos. Presets de criação podem definir ambos os valores sem introduzir outro enum persistente de modo:

| Preset | Participação | Campo de batalha |
| --- | --- | --- |
| Grupo | Jogador e companheiros | Menus Classic |
| Invocação (planejada) | Criaturas controladas; treinador fora do combate | Menus Classic |
| Tático | Jogador e companheiros | Grade Tactical |
| Invocação tática (depois) | Criaturas controladas; treinador fora do combate | Grade Tactical |

Não exponha combinações inacabadas. Companheiros narrativos e unidades de combate são distintos; a posição do primeiro membro no array não deve virar um contrato permanente de identidade do personagem controlado.

## Prioridade atual: terreno híbrido

O GM fornece uma descrição pequena e estruturada baseada na cena. O motor resolve o terreno exato e as posições iniciais com uma semente, valida o tabuleiro e salva o resultado. O GM então descreve o campo aceito. Movimentos e ataques comuns não exigem chamadas ao modelo.

O fluxo de ambiente e formação oferece tamanho opcional do mapa e pontos de referência da cena. As orientações de terreno pertencem a cada encontro; as sementes do mapa são internas a cada encontro, sem um controle de semente na configuração da campanha. Mantenha configurações antigas válidas. Salve a grade aceita e a procedência da geração para que uma mudança futura do gerador não redesenhe uma batalha existente. Sementes salvas reproduzem a geração com a mesma descrição e combatentes; não tornam determinística qualquer saída do modelo.

O terreno gerado pode ser reparado para garantir conectividade, mas restrições autorais não podem desaparecer silenciosamente. Limite saída do modelo, quantidade de casas e unidades e dimensões dos elementos. Rejeite disposições impossíveis com uma razão que indique como agir e ofereça uma alternativa gerada explícita. Tabuleiros pintados à mão para os lugares de um mundo (worldgen W9g, em um editor como o Pixelforge) passam pelas mesmas regras: as faixas de posicionamento inicial viram planície e todas as casas abertas ficam conectadas, então a luta acontece neles exatamente como foram pintados.

### Capacidades de movimento

Caminhada, voo e teletransporte precisam de regras explícitas. Voo e teletransporte podem cruzar paredes, água e montanhas e ignorar o custo extra da floresta. Bônus de defesa e esquiva permanecem independentes do movimento.

Um modo omitido usa caminhada nos encontros antigos. Um modo explicitamente solicitado e não suportado deve ser rejeitado com erro; não o substitua silenciosamente por caminhada. Esse contrato vale para planos gerados e entradas da API tática.

Separe travessia, destinos legais e ocupação. Teletransportar através de uma parede não permite terminar dentro dela. A grade tem altura desde o combate C6b (escalada, penhascos, cristas que bloqueiam a visão, terreno elevado), mas não representa tetos, exigências de visão das magias ou duração limitada do voo. Documente esse limite em vez de alegar regras completas de mesa. Reutilize a mesma verificação de movimento em prévias, resolução, animação de trajetos e IA inimiga.

## Regras de mesa: perfis integrados e ferramentas de referência para o GM

Priorize jogos semelhantes a 5e e V20 em vez de um jogo completo de coleção de criaturas. Adicione depois perfis de regras delimitados e versionados. Escolha edição exata e subconjunto suportado antes de chamar um perfil de implementação daquele sistema.

O motor deve controlar rolagens reais, alvos legais, movimento, limites de ações, consumo de recursos e resultados numéricos. O GM interpreta a ficção, seleciona uma operação suportada, fornece intenções dos NPCs e narra o resultado real. Textos recuperados dos lorebooks podem fornecer referências e regras de campanha, sem contornar a resolução ou reescrever rolagens.

[A issue #5955](https://github.com/Pasta-Devs/Marinara-Engine/issues/5955) cobre recuperação semântica de lorebooks e um caminho opcional por ferramenta. A recuperação complementa os perfis: ajuda o GM a encontrar informações relevantes, enquanto perfis explícitos tornam mecânicas comuns consistentes e testáveis. Evite uma consulta separada para cada rolagem comum.

Comece pelas primitivas suportadas de testes, turnos e recursos. Um perfil d20 e um perfil de pool de dados d10 exigem regras de resolução diferentes; um não é apenas o outro renomeado. A cobertura futura deve incluir iniciativa, testes opostos, dano e mitigação, condições e uso de recursos. Documente casos não suportados e deixe explícita a arbitragem do GM.

A linha de visão compartilhada já existe (combate C6): uma parede ou uma montanha a bloqueia igualmente na resolução, na IA, nos contra-ataques, nas áreas, nas previsões e nas sobreposições de ameaça. Os níveis de cobertura se baseiam no mesmo teste. A iniciativa individual é uma configuração do jogo (combate C6c): jogos novos rolam uma ordem uma única vez por luta e jogam o turno de uma unidade por vez, tanto no motor quanto no diretor de combate; jogos mais antigos mantêm as fases de grupo e inimigos.

## Invocações: preservar o projeto, adiar o sistema maior

Uma primeira etapa pode ser pequena: uma criatura ativa por lado, reservas próprias, treinador não combatente, troca voluntária que consome o comando e pausa persistente de substituição após desmaio. A derrota ocorre quando não resta criatura disponível. Itens do treinador não devem conceder outra ação à criatura.

Mantenha um elenco indexado por IDs estáveis e IDs dos espaços ativos. Derive reservas e estado de desmaio em vez de manter arrays concorrentes. HP, recursos e condições das criaturas próprias persistem; a geração de encontros não deve reinventar esses atributos a cada luta. Defina explicitamente a evolução das condições nas reservas.

Captura, evolução, reprodução, batalhas em duplas, duração de invocações temporárias e invocação tática são adições separadas. O resumo do GM precisa distinguir uma criatura desmaiada de um treinador ferido.

## Persistência e provas

Fixe as regras efetivas ao iniciar a batalha. Novos campos opcionais devem preservar saves antigos Classic e Tactical. Importações, snapshots imutáveis de criação e resumos devem conservar as novas escolhas. Recarregar, reiniciar, levar à próxima sessão, variantes de resposta, ramificações e restauração de checkpoints exigem cobertura explícita individual.

O futuro estado de batalha do servidor deve aplicar mudanças da batalha e do elenco juntas, com IDs de encontro, revisões e IDs de ação idempotentes. Reutilize filas de gravação quando adequado. Audite os namespaces de jogos por turnos e Experiences antes de reutilizar `game_engine_state`; ele não é automaticamente um armazenamento seguro para combate.

Para cada regra, adicione a menor prova executável `*.regression.ts`, incluindo ações rejeitadas e entradas antigas. As provas no navegador devem cobrir configuração, ação tática real, recarga, telas pequenas, contraste dos temas, foco e teclado e estados de erro úteis. Mantenha localização e documentação do usuário junto da implementação.

## Trabalhos anteriores e pontos de entrada

[O PR #4391, fechado sem merge](https://github.com/Pasta-Devs/Marinara-Engine/pull/4391), em `feat/game-mode-combat-expansion`, contém uma expansão maior de sessões de combate, manobras, objetivos e chefes. É uma referência útil, não o comportamento atual de staging. Confira responsável e status antes de retomar o trabalho; não faça merge da expansão inteira como pré-requisito do terreno.

Os arquivos principais do Engine são `packages/shared/src/features/tactical-combat/`, `packages/server/src/routes/encounter.routes.ts`, `packages/server/src/routes/game.routes.ts`, `packages/client/src/components/game/GameSetupWizard.tsx`, `GameSurface.tsx` e `TacticalCombatUI.tsx`. Definições de agentes e Experiences para download e prompts próprios dos pacotes pertencem ao Marinara-Agents se trabalhos posteriores os afetarem.
