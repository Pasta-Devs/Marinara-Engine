# Audit de nettoyage du code

**Date de l'audit :** 2026-07-22

**Branche visée :** `staging`

**Objectif :** repérer les artefacts supprimables et les simplifications bien délimitées, sans rien changer au comportement à l'exécution.

**État d'avancement :** les constats à confiance élevée et à faible risque ont été appliqués dans le même nettoyage.

## Résultat de la mise en œuvre

Travaux terminés :

- suppression des quatre modules source inatteignables, du constructeur de sidecar obsolète, du lanceur de tests à zéro test et des fiches de tâches déjà réalisées ;
- suppression du tampon de logs de débogage, qui n'existait que pour le panneau de débogage inatteignable, tout en conservant les diagnostics dans la console du navigateur ;
- résolution des 60 constats de code inutilisé prouvés par le compilateur, puis activation des vérifications de code inutilisé côté client et serveur ;
- suppression de 53 hooks, fonctions utilitaires, types et déclarations d'interface client sans consommateur, par lots thématiques ;
- suppression des huit dépendances orphelines à confiance élevée, avec réparation du fichier de verrouillage, de la vérification d'installation de l'espace de travail et du texte de dépannage ;
- passage de la commande `pnpm test` racine à une vraie couverture de régression, au lieu d'un succès annoncé sans aucun test ;
- réutilisation du sélecteur d'image-clé de storyboard existant et regroupement de la logique dupliquée des tokens de requête Spotify ;
- limitation du réordonnancement des variables de preset au seul preset demandé, en faisant du paramètre `presetId` jusque-là ignoré une frontière d'intégrité.

Volontairement conservés pour un travail distinct de compatibilité ou de produit :

- `@rollup/wasm-node` ;
- les exports du serveur susceptibles d'être des API externes au dépôt ou des points d'accroche pour les tests ;
- le regroupement du parseur PNG et de la géométrie des tutoriels ;
- les refactorisations larges de l'éditeur, du composeur et des gros modules ;
- les champs de compatibilité prévus pour une future version majeure.

Les constats détaillés ci-dessous sont conservés comme trace des preuves recueillies avant les changements. Là où subsiste une formulation en forme de recommandation, ce résultat de mise en œuvre fait foi.

## Validation

Le nettoyage appliqué a passé les lignes de preuve prises en charge par le dépôt :

- `pnpm install --frozen-lockfile`
- `pnpm check` (contrôle du code inutilisé, TypeScript, ESLint et builds de production)
- `pnpm test` (toutes les lignes de régression, plus la couverture smoke navigateur : 81 réussis, 51 volontairement ignorés)

En rendant la commande de test générique honnête, la suite navigateur a aussi révélé quatre localisateurs qui supposaient un état particulier. Ces tests naviguent désormais explicitement, ciblent les contrôles mobiles dupliqués dans leur propre portée et visent le vrai défileur de la chronologie Noodle, sans affaiblir leurs assertions produit.

## Résumé pour les décideurs

Le dépôt est volumineux (1 665 fichiers suivis et environ 478 000 lignes sur les types de fichiers source inspectés), mais la plupart des gros fichiers sont du code produit actif plutôt que des restes évidents. Le nettoyage le plus sûr tient dans une série de petites suppressions étayées par des preuves, pas dans une réécriture générale.

La première ligne de nettoyage de l'audit initial a identifié :

- quatre modules source sans aucune référence entrante (899 lignes au total) ;
- un script de build de sidecar obsolète (173 lignes) ;
- un lanceur de tests qui réussit en n'exécutant aucun test (54 lignes, plus son câblage dans les scripts du paquet) ;
- deux fiches de tâches de phase déjà réalisées, restées à la racine du dépôt (235 lignes) ;
- 60 déclarations, imports, paramètres et variables locales inutilisés, prouvés par le compilateur ;
- huit dépendances directes probablement orphelines, sous réserve d'une vérification par installation propre et build ;
- un sprite Mari statique probablement inutilisé, sous réserve d'une vérification smoke dans le navigateur.

À eux seuls, les quatre modules inatteignables, le script périmé, le lanceur sans effet et les fiches de tâches représentent 1 361 lignes suivies. Le travail proposé mérite quand même d'être découpé en petites PR de nettoyage : chaque suppression garde ainsi une preuve étroite et un retour en arrière facile.

## Comment l'audit a été mené

L'audit a croisé plusieurs types de preuves :

1. Inventaire de tous les fichiers suivis, des types de fichiers, des grandes zones de code source et des plus gros fichiers.
2. Analyse des imports et exports via l'AST TypeScript, imports relatifs et alias du dépôt compris.
3. Recherches par nom de symbole exact et par nom de fichier dans le code source suivi, les scripts, la documentation, les manifestes et les workflows.
4. Sondes du compilateur TypeScript avec `noUnusedLocals` et `noUnusedParameters` forcés à l'activation pour le client et le serveur.
5. Recherches de dépendances directes, complétées par une inspection ciblée de l'historique Git quand une dépendance ou un script semblait laissé de côté par une refactorisation antérieure.
6. Comparaison de fenêtres dupliquées après normalisation, suivie d'une inspection manuelle des correspondances les plus importantes.
7. Vérifications syntaxiques des fichiers JSON, Python et Bash suivis.

Les niveaux de confiance employés ci-dessous :

- **Élevée :** plusieurs vérifications indépendantes concordent ; la suppression doit être mécanique.
- **Moyenne :** aucune référence actuelle, mais un chargement dynamique, des consommateurs externes ou une intention produit peuvent encore compter.
- **À reporter :** une vraie occasion de simplification, dont la surface de régression est trop large pour une passe de suppression d'artefacts.

L'analyse statique ne peut pas prouver l'absence de recherche par chaîne à l'exécution, d'usage par un paquet téléchargé, de chemins fournis par l'utilisateur ou de consommateurs externes. Ces cas sont signalés plutôt que traités comme du code mort.

## 1. Suppressions de fichiers à confiance élevée

### 1.1 Modules source inatteignables

| Candidat | Preuves | Note de nettoyage | Preuve exigée |
| --- | --- | --- | --- |
| `packages/client/src/components/agents/AgentDebugPanel.tsx` (296 lignes) | Aucun import entrant, et `AgentDebugPanel` n'apparaît qu'à sa déclaration. | Supprime le composant. Passe ensuite en revue `debugLog` et `clearDebugLog` dans le store des agents : hors de ce panneau inatteignable, rien ne les consomme. Ne supprime pas `lastResults`, utilisé par `SpriteOverlay`. | `pnpm check` ; ouvre les réglages des agents ou le mode débogage et vérifie les surfaces de débogage actives. |
| `packages/client/src/components/agents/AgentThoughtBubbles.tsx` (113 lignes) | Aucun import entrant, et `AgentThoughtBubbles` n'apparaît qu'à sa déclaration. L'interface actuelle des bulles de pensée et de la checklist passe par `RoleplayHUD` / `RoleplayHUDActionsMenu`. | Supprime le composant et son entrée périmée dans le fichier `packages/client/.instructions.md`. | `pnpm check` ; `pnpm regression:roleplay` ; vérifie dans le navigateur le HUD du roleplay et la checklist de continuité. |
| `packages/client/src/components/panels/GlobalGalleryPanel.tsx` (468 lignes) | Aucun import entrant, aucun enregistrement de route, aucune référence au nom exact. | Supprime uniquement ce panneau. N'en déduis **pas** que toute la fonctionnalité de galerie est morte : `NoodleHome`, les hooks de galerie, les routes serveur et le stockage ont encore des références actives. | `pnpm check` ; `pnpm smoke:ui` ; vérifie manuellement le téléversement d'images et la galerie dans Noodle. |
| `packages/shared/src/features/turn-games/engine-utils.ts` (22 lignes) | Aucun import, aucun export de barrel, et les quatre symboles exportés n'apparaissent que dans ce fichier. | Supprime le fichier. | `pnpm check` ; `pnpm regression`. |

### 1.2 Script de build de sidecar obsolète

Le fichier `scripts/build-sidecar-runtime.mjs` n'est référencé par aucun script de paquet, workflow, document ni fichier source. Il appelle `pnpm exec node-llama-cpp`, or `node-llama-cpp` n'est plus une dépendance de l'espace de travail. Son historique Git le rattache à l'ancien chemin de build du sidecar Gemma local.

**Recommandation (confiance élevée) :** supprime le script. Avant cela, fais une dernière recherche dans les artefacts de release hors du dépôt, au cas où un pipeline d'installeur serait configuré à l'extérieur.

### 1.3 Fiches de mise en œuvre terminées à la racine

`MARI_PHASE2_TASK.md` et `MARI_PHASE3_TASK.md` sont des instructions de mise en œuvre orientées branche, pour un travail désormais présent dans le code. Rien dans le dépôt n'y fait référence, et ce n'est pas de la documentation durable pour les utilisateurs ou les contributeurs.

**Recommandation (confiance élevée) :** retire-les de l'arbre de travail. Leur historique reste disponible dans Git. Si une justification garde de la valeur, conserve-la seule dans le document d'architecture concerné, plutôt que de garder des instructions de tâche.

### 1.4 Lanceur de tests trompeur, à zéro test

Le fichier `packages/server/scripts/run-tests.mjs` vise trois motifs `.test.ts`, mais aucun des dossiers ciblés ne contient de fichier de test. Les commandes `pnpm --filter @marinara-engine/server test` et `pnpm test` à la racine se terminent toutes deux avec succès, sans aucun test ni aucune suite. Les anciens tests ont été retirés volontairement, et les règles du dépôt interdisent de conserver des fichiers `.test.ts`.

C'est plus dangereux que du code mort ordinaire : aujourd'hui, une commande `pnpm test` au vert laisse croire à une couverture qui n'existe pas.

**Recommandation (confiance élevée) :**

1. Supprime le lanceur du serveur et le script `test` du serveur.
2. Conserve la vérification de la structure de l'installeur Windows, en lui donnant au besoin un nom de script dédié et honnête.
3. Redéfinis le script `test` racine pour qu'il lance un sous-ensemble intentionnel de régression et de smoke, ou supprime l'alias générique et documente `pnpm check`, `pnpm regression:*` et `pnpm smoke:ui` comme les vraies commandes de preuve.
4. Fais en sorte que la CI ne puisse pas annoncer "tests passed" sur la seule base d'une exécution sans test.

## 2. Nettoyage des dépendances

Sauf mention contraire, ces dépendances directes n'ont aucun import, enregistrement, réglage ni référence par chaîne à l'exécution en dehors des manifestes et du fichier de verrouillage.

| Espace de travail | Dépendance | Confiance et preuves |
| --- | --- | --- |
| client | `class-variance-authority` | **Élevée.** Aucun usage dans le code ni la configuration. Un précédent nettoyage de dépendances la considérait déjà comme inutilisée. |
| client | `autoprefixer` | **Élevée, avec preuve par build.** Aucune configuration PostCSS ni import ; le client utilise le plugin Vite de Tailwind. |
| server | `@earendil-works/pi-ai` | **Élevée.** Le runtime de Professor Mari a été refactorisé pour se passer de la dépendance Pi. L'historique du dépôt note explicitement qu'elle n'était déjà plus importée et qu'elle restait à nettoyer plus tard. |
| server | `@fastify/websocket` | **Élevée.** Aucun enregistrement de plugin, aucune route websocket, aucun import. |
| server | `png-chunk-text` | **Élevée.** Aucun import. La gestion actuelle des métadonnées PNG est implémentée directement. |
| server | `png-chunks-encode` | **Élevée.** Aucun import. |
| server | `png-chunks-extract` | **Élevée.** Aucun import. |
| shared | `chess.js` | **Élevée, avec preuve de compatibilité.** Aucun import actuel dans le code. Les échecs intégrés ont été extraits dans des paquets optionnels. La suppression impose aussi d'effacer son entrée dans `scripts/check-workspace-install.mjs` et de mettre à jour le texte de dépannage périmé sur le paquet `chess.js` manquant. |

Le paquet `@rollup/wasm-node` côté client n'est lui non plus jamais référencé, mais il peut servir de repli Rollup propre à certains environnements. Traite-le en **confiance moyenne** : inspecte l'historique de packaging et de CI, et prouve que les builds passent sur les plateformes prises en charge avant de le supprimer.

Ne classe pas comme inutilisées des dépendances telles que `workbox-window`, `pino-pretty`, le paquet `esbuild` racine, les paquets de types ou les outils uniquement en ligne de commande, sur la seule foi du texte des imports. Elles sont consommées par des modules générés, une configuration de transport basée sur des chaînes, des scripts de build ou des scripts de paquet.

Pour la PR de dépendances, mets à jour le fichier `pnpm-lock.yaml`, installe depuis un état de dépendances propre et lance la ligne complète de build et de vérification. Retirer un paquet d'un dossier `node_modules` déjà rempli ne constitue pas une preuve suffisante.

## 3. Code inutilisé prouvé par le compilateur

Forcer les vérifications de code inutilisé de TypeScript a produit **57 diagnostics serveur** et **3 diagnostics client**. C'est une preuve plus solide que les candidats issus d'une simple recherche textuelle. La plupart sont des imports ou des variables locales, supprimables mécaniquement ; pour les paramètres de callback et les paramètres de méthodes publiques, vérifie d'abord les signatures d'appel.

### 3.1 Client

- `ChatSettingsDrawer.tsx` : paramètre de filtre `subject` inutilisé.
- `GameCombatUI.tsx` : paramètre `line` de map inutilisé.
- `hooks/use-encounter.ts` : `_res` inutilisé ; attends la requête sans l'affecter à une variable.

### 3.2 Serveur

- `db/file-backed-store.ts` : `TABLES_REVERSE` inutilisé ; champ d'instance `loadedManifest` et son affectation inutilisés.
- Imports et variables locales de routes : `backup.routes.ts` (`dirname`), `sprites.routes.ts` (`readdir`), `scene.routes.ts` (`gsStorage`), `noodle.routes.ts` (`extractNoodleMentionHandles`, `NoodleInteractionType`) et `generate/dry-run-route.ts` (`lorebooksStore`).
- Paramètres de callback de route inutilisés : `game-assets.routes.ts`, `lorebooks.routes.ts`, `sprites.routes.ts` et `youtube.routes.ts` (`reply`). Renomme en `_reply` seulement si la position dans la signature Fastify doit être préservée.
- `game.routes.ts` : `GmPromptContext`, `formatMoraleContext` et `sceneSpotifyTrackCandidateSchema`.
- `generate.routes.ts` : `readFileSync`, `LIMITS`, `AgentPhase`, `CharacterStat`, `GameState`, `createLLMProvider`, `formatZonedConversationDate`, `formatZonedConversationTime`, `chatsTable`, `normalizeCustomEmojiSelection`, `embedMemoryRecallTexts`, `latestHistoryUserContent`, `getActiveTurnGame`, `startTurnGame`, `pruneEmptyPromptWrappers`, `areConversationSchedulesEnabled`, `addEventEntry`, `normalizeAgentMaxTokens`, `resolveAgentRunInterval`, ainsi que la variable locale `chatParams`.
- `generate/dry-run-route.ts` : fonction utilitaire locale morte `wrapperMessages`.
- `services/agents/agent-executor.ts` : paramètre `agentType` inutilisé dans `sanitizeTextAgentResponse` ; mets à jour ses appelants internes si le paramètre disparaît.
- `services/agents/agent-pipeline.ts` : `AgentPhase` inutilisé.
- `services/conversation/schedule.service.ts` : `createLLMProvider` et `ConversationStatusOverride` inutilisés.
- `services/game/perception.service.ts` : `RPGAttributes` inutilisé.
- `services/generation/conversation-react-command-runtime.ts` : paramètre `command` inutilisé dans une fonction utilitaire.
- `services/import/st-bulk.importer.ts` : `personasTable` inutilisé.
- `services/lorebook/keyword-scanner.ts` : `currentMessageIndex` déstructuré mais inutilisé ; vérifie la forme des options internes avant de le retirer.
- `services/lorebook/prompt-injector.ts` : `LorebookEntry` inutilisé.
- `services/mari-db/mari-db.service.ts` : fonction utilitaire morte `makeEmptyValidation`.
- `services/prompt/assembler.ts` : `PromptPreset`, `PromptSection`, `PromptGroup`, `groupOrder` et `chatHistoryEndIdx` inutilisés.
- `services/sidecar/scene-analyzer.ts` : fonctions utilitaires mortes `widgetUpdateHint` et `widgetStateSummary`.
- `services/sidecar/scene-postprocess.ts` : fonction utilitaire morte `normalizeExpression`.
- `services/sidecar/sidecar-process.service.ts` : `lastReadyAt` est affecté mais jamais lu.
- `services/storage/noodle.storage.ts` : `NoodlerStageProfile` inutilisé.
- `services/storage/prompts.storage.ts` : paramètre `presetId` inutilisé dans `reorderVariables` ; vérifie les appelants et la sémantique d'ordre du stockage avant de toucher à la signature.

Une fois cette liste assainie, active `noUnusedLocals` et `noUnusedParameters` dans les configurations TypeScript du serveur et du client. Cet audit ponctuel devient alors un invariant maintenu dans la durée. Mieux vaut préfixer par `_` les paramètres de callback réellement obligatoires que de désactiver à nouveau la règle globalement.

## 4. Exports internes sans consommateur dans le dépôt

Les déclarations exportées échappent aux vérifications ordinaires de variables locales inutilisées. Une seconde passe a donc cherché les noms qui n'apparaissent qu'à leur déclaration. Le client est une application, pas une bibliothèque publique : ces éléments sont de bons candidats à la suppression. Supprime-les par lots thématiques et laisse le compilateur révéler les fonctions utilitaires privées ou les imports associés.

### 4.1 Hooks et fonctions utilitaires du client

- Hooks d'agents : `useAgentConfig`, `useUpdateAgentByType`, `useToggleAgent`.
- Hooks de personnages : `useUpdatePersonaGalleryClipTrim`, `useCharacterGroup`.
- Hooks de chats et de dossiers : `useReorderChats`, `useActiveChatPreset`, `useCreateChatPreset`, `useTouchChat`, `useMarkAutonomousUnread`, `useBulkSetMessagesHiddenFromAI`, `useSwipes`, `useMoveConnection`.
- Hooks de Game Mode : `useRegeneratePartyCard`, `useUpdateGameMapBinding`, `useCombatLoot`, `useLootGenerate`, `useGameJournal`, `useGameCheckpoints`, `useCreateCheckpoint`, `useLoadCheckpoint`, `useDeleteCheckpoint`.
- Hooks haptiques : `useHapticStopScan`, `useHapticCommand`, `useHapticStopAll`.
- Hooks de lorebooks : `useLorebookEntry`, `useBulkCreateEntries`, `useSearchLorebookEntries`.
- Autres hooks : `useCustomTool`, `useUpdateNoodleAccount`, `usePreset`, `useCreatePreset`, `usePresetGroups`, `useReorderGroups`, `usePresetSections`, `usePresetVariables`, `usePreviewPreset`, `useRegexScript`, `useUpdateSpatialContext`.
- Déclarations d'interface : `parseQteTag`, `NoodlerNotificationItem`, `LabelWithHelp`, `RESOURCE_PANEL_SORT_OPTIONS` et `SyncedSettings`.
- Fonctions utilitaires de bibliothèque : `isManagedChatBackgroundUrl`, `isBrowserSpeechRecognitionSupported`, `requestTurnGameBotGeneration`, `resolveInputMacrosForChat`, `createCustomToolFolderPackageFilename`, `resolveCurrentGameSessionChatId`, `readTextFileFromZip` et `buildTTSMessageText`.

Un hook client inutilisé ne prouve **pas** que son endpoint serveur l'est aussi. Supprime d'abord le hook ; audite les routes séparément, face à l'interface, aux capability packages et à la compatibilité des API externes.

### 4.2 Candidats serveur nécessitant une décision finale sur les API et les points d'accroche de test

Les déclarations serveur exportées suivantes n'ont elles non plus aucun consommateur dans le dépôt. La plupart semblent internes, mais des points d'accroche de test et des fonctions utilitaires exportés peuvent servir à de l'outillage externe : la confiance reste moyenne tant que les mainteneurs n'ont pas confirmé qu'il ne s'agit pas d'API prises en charge.

- runtime et authentification basique : `getServerRoot`, `getSpotifyRedirectUri`, `isAutoOpenBrowserDisabled`, `hasBasicAuthConfigured` ;
- points d'accroche de test : `resetRateLimitBucketsForTests`, `buildKnowledgeRetrievalAgentMessagesForTest`, `splitRuntimeHandledAgentInjectionsForTest`, `__setSdkForTesting` ;
- fonctions utilitaires de génération et de prompt : `normalizeSecretPlotSceneDirections`, `buildUserMessageRegenerationPrompt`, `buildUserMessageRegenerationSourceMessage`, `wrapFields`, `mergeTruncation`, `modelAccessOptions`, `isStandaloneCharacterProfileBlock`, `resolveChatSummaryPromptFromMetadata` ;
- fonctions utilitaires de Game Mode : `buildNpcPortraitImagePrompt`, `buildBackgroundImagePrompt`, `buildSceneIllustrationImagePrompt`, `buildSessionSummaryPrompt`, `buildCardAdjustmentPrompt`, `moraleDiceModifier`, `buildNpcRelationshipSummary`, `buildSessionCarryoverContext`, `getTurnGameContextText` ;
- fonctions utilitaires de lorebook : `enforceMaxActivatedEntries`, `applyPerLorebookTokenBudgets`, `resolveActivatedLorebookEntryContent`, `resolveBudgetAndRecursivelyActivateLorebookEntries`, `recursiveScan` ;
- utilitaires et types : `AgentPipelineResult`, `resolveVideoRequestDuration`, `newTimeSortableId`, `parseBoolean`, `sanitizePathFilename`.

N'applique pas en bloc ce test de "l'occurrence textuelle unique" au dossier `packages/shared` : les exports partagés sont des contrats de compatibilité pour le client, le serveur et les paquets d'agents téléchargeables, y compris pour des consommateurs situés hors de ce dépôt.

## 5. Candidat parmi les ressources statiques

`packages/client/public/sprites/mari/Mari_point_down_left.png`, le seul sprite Mari livré dont le nom de fichier ou le chemin n'apparaissait nulle part dans le dépôt, a été supprimé par la tranche 38a de l'omnibar.

Ne te sers pas de recherches par nom de fichier pour élaguer les ressources de jeu livrées. Certains dossiers de ressources sont parcourus dynamiquement par les seeders et les manifestes du serveur.

## 6. Simplifications bien délimitées

Il s'agit d'améliorations de maintenabilité, pas de suppressions de code mort. Chacune doit préserver le comportement à l'identique et s'accompagner d'une preuve de régression ciblée.

### 6.1 Logique métier dupliquée à l'identique ou presque

1. **Sélection de l'image-clé de storyboard – risque faible.** Le fichier `GameSurface.tsx` contient une implémentation locale `findStoryboardKeyframeForSegment` identique à la fonction exportée `findReplayStoryboardKeyframe` de `lib/game-session-replay.ts`. Réutilise la fonction de la bibliothèque et supprime la copie locale.
2. **Normalisation de la recherche Spotify – risque faible à moyen.** `SPOTIFY_STOP_WORDS`, `SPOTIFY_MOOD_EXPANSIONS` et le flux d'expansion sont dupliqués entre `game-spotify-music.service.ts` et `tool-executor.ts`. Extrais une petite fonction utilitaire de tokens de requête Spotify, pour que les deux chemins ne puissent plus diverger.
3. **Extraction des métadonnées PNG des fiches de personnage – risque moyen.** `extractCharaFromPng` est implémentée deux fois, dans `import.routes.ts` et dans `st-bulk.importer.ts`. Extrais un utilitaire serveur unique et vérifie, avec des fixtures de régression, les chunks de texte normaux, les chunks de texte internationaux, les charges utiles base64 et brutes, les fiches V2 et V3, et les PNG mal formés.
4. **Géométrie des infobulles de tutoriel – risque moyen.** `GameTutorial.tsx` et `OnboardingTutorial.tsx` dupliquent la logique de collision et de placement. Extrais uniquement le calcul de géométrie commun ; garde les politiques mobiles et propres au produit de chaque tutoriel sous forme d'options explicites.
5. **Normalisation client/serveur des modifications de segments de jeu – risque moyen à élevé.** La normalisation pure est similaire côté client et côté serveur. Ne déplace vers le code partagé qu'un schéma ou un normaliseur vraiment neutre à l'exécution ; laisse au serveur ce qui relève de l'analyse et de la persistance.

### 6.2 Grandes zones d'interface répétées : reporter la consolidation large

- `CharacterEditor.tsx` et `PersonaEditor.tsx` reprennent un même flux, conséquent, de gestion des sprites.
- `ChatInput.tsx` et `ConversationInput.tsx` répètent le comportement du plan guidé et du composeur.

La consolidation a une vraie valeur, mais fusionner l'une ou l'autre paire d'un bloc créerait une large surface de régression. Extrais un seul hook ou composant cohérent à la fois, la gestion des sprites d'abord pour les éditeurs, le comportement du plan guidé d'abord pour les composeurs, et teste les deux appelants dans le navigateur après chaque extraction.

### 6.3 Points chauds de complexité active

Les plus gros modules actifs sont `server/routes/game.routes.ts`, `client/components/game/GameSurface.tsx`, `client/features/chat-settings/ChatSettingsDrawer.tsx`, `server/routes/generate.routes.ts` et `client/components/panels/SettingsPanel.tsx`. Ce ne sont pas des candidats à la suppression. Continue d'extraire des gestionnaires de route délimités, des services métier, des sections de panneau latéral et des fonctions pures, mais seulement quand la fonctionnalité concernée est déjà en cours de modification. Une PR isolée du type "on découpe tout" apporterait de l'agitation sans preuve fiable au niveau du comportement. Le panneau des réglages du chat faisait exception. Il a été découpé à raison d'une section par PR (#9119). Les règles de son dossier figurent dans `packages/client/.instructions.md` à la section Chat Settings.

## 7. Éléments délibérément exclus du nettoyage

- Les champs de compatibilité explicitement acceptés sur toute la ligne 2.x, notamment les formes de compatibilité liées au style d'image, à l'état du jeu, au Text to Speech (TTS, la synthèse vocale), au tracker de persona et au contexte de conversation. Ne les supprime qu'au moyen d'une migration versionnée, dans la prochaine version majeure.
- Les registres et manifestes de capacités générés. Régénère-les via leurs scripts ; ne les élague pas à la main.
- Le code des paquets d'agents téléchargeables Illustrator, Music DJ, Lorebook Keeper et autres. Le nettoyage du runtime et des prompts appartenant aux agents relève de `Pasta-Devs/Marinara-Agents` ; seule l'intégration côté hôte relève d'ici.
- Les modules Home Assistant sous `custom_components`, dont la découverte repose sur des conventions et des manifestes.
- `MarinaraLauncher.exe`, consommé par le code de migration des raccourcis de la barre des tâches.
- `start-local.bat`, qu'aucun script de paquet ne référence, mais qui reste un lanceur local plausible pour un humain. Ne le supprime qu'après avoir vérifié l'intention des mainteneurs.
- Les déclarations de schéma qui semblent non référencées, mais qui s'exécutent lors de l'initialisation d'un module ou de l'enregistrement d'une table.
- Les routes serveur, au seul motif qu'un hook React de confort est inutilisé : des paquets téléchargeables ou des consommateurs de l'API peuvent encore les appeler.

## 8. Ordre de nettoyage recommandé

Garde un travail simple et relisible :

1. **PR A – artefacts :** supprime les quatre modules inatteignables, l'entrée périmée de documentation du composant, le script de sidecar obsolète, les fiches de tâches terminées et, après confirmation manuelle, le sprite Mari inutilisé.
2. **PR B – surface de test honnête :** supprime le lanceur à zéro test et renomme ou redéfinis les scripts de paquet, pour qu'une commande réussie corresponde à de vraies vérifications.
3. **PR C – nettoyage compilateur :** résous les 60 diagnostics TypeScript, puis active les vérifications de code inutilisé dans les configurations du client et du serveur.
4. **PR D – dépendances :** supprime les huit paquets à confiance élevée, répare la vérification d'installation de l'espace de travail et le texte de dépannage, régénère le fichier de verrouillage et prouve une installation et un build propres.
5. **PR E et suivantes – lots thématiques :** supprime les exports client inutilisés domaine par domaine, puis traite les fonctions utilitaires dupliquées à faible risque une par une.

Évite de mélanger suppression de dépendances, refactorisation large de l'interface et découpage de routes dans une seule PR de nettoyage.

## 9. Matrice de validation

Lance la preuve adaptée à chaque changement :

- Tout nettoyage de code : `pnpm check`.
- Changements partagés ou larges côté serveur : d'abord `pnpm regression` ou la commande étroite `pnpm regression:<domain>`, puis la ligne complète avant la fusion.
- Nettoyage de composants ou de hooks d'interface : `pnpm smoke:ui`, plus une vérification manuelle du flux concerné dans le navigateur.
- Chemins de prompt, d'agent ou de roleplay : `pnpm regression:prompt` et/ou `pnpm regression:roleplay`.
- Nettoyage de dépendances : installation propre et figée, `pnpm check`, builds de production et CI sur les plateformes prises en charge.
- Regroupement de l'import PNG : régressions d'import direct couvrant les fiches de personnage valides et mal formées.
- Fichiers de release ou de version, s'ils ont été touchés par accident : `pnpm version:check` et `pnpm credits:check`.

Avant ce nettoyage, le résultat de la commande générique `pnpm test` ne pouvait pas servir de preuve de test : elle se terminait avec succès sans exécuter le moindre test.

## 10. Validation et limites de l'audit

Pendant cet audit :

- tous les fichiers JSON suivis ont été analysés avec succès ;
- les 12 fichiers Python suivis ont tous été analysés avec succès par le parseur AST de Python ;
- `start.sh`, `start-termux.sh` et `android/build-apk.sh` ont passé `bash -n` ;
- les sondes TypeScript de code inutilisé ont produit les 57 constats serveur et 3 constats client documentés ci-dessus ;
- il a été directement constaté que les commandes de test du serveur et de la racine réussissaient sans exécuter aucun test.

ShellCheck et PowerShell n'étaient pas installés : l'analyse sémantique des scripts shell et l'analyse des scripts PowerShell et Windows n'ont donc pas eu lieu. Les cibles Android et Home Assistant ont été inspectées dans leur structure, mais n'ont pas été entièrement compilées lors de cet audit. Ces vérifications de plateforme relèvent des PR de nettoyage qui touchent leurs fichiers.
