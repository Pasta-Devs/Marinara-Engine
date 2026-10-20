# Fonctionnement interne des prompts Noodle (développeurs)

Référence pour les développeurs : où vivent les prompts de génération de Noodle dans le code, comment les personnaliser et comment déboguer les prompts finaux. Un prompt, c'est le texte que Marinara envoie à l'IA. Côté utilisateur, Noodle se configure depuis son panneau **Settings** (Paramètres) ; voir les guides Noodle dans `docs/noodle/`.

Noodle est un package téléchargeable. Ses routes (`/api/noodle`, enregistrées quand le package s'active) et son code de génération vivent dans le package Noodle de [Pasta-Devs/Marinara-Agents](https://github.com/Pasta-Devs/Marinara-Agents), sous `packages/noodle/src/engine/packages/server/src/`. Dans le tableau ci-dessous, une source marquée **package** est relative à ce dossier. Engine conserve le schéma et les types Noodle partagés, le stockage de Noodle, les surcharges de prompts enregistrées que Settings liste, ainsi que le texte par défaut du prompt de timeline dans `packages/server/src/services/noodle/noodle-prompt.ts`. Le package garde ses propres copies de `services/prompt-overrides/registry/noodle.ts` et de `services/noodle/noodle-prompt.ts`.

## Carte des sources de prompts

Noodle compte un prompt de timeline assemblé, un prompt de profil écrit directement dans le code et trois surcharges de prompts enregistrées : deux pour le prompt système de la timeline et une pour les images des posts.

| Rôle | Source | Symbole principal | Comment personnaliser |
| ----------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Posts, réponses, abonnements, sondages, votes et digests de la timeline | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()` | Le message système est la surcharge **Noodle Timeline Prompt** suivie de la surcharge **Noodle Timeline Voice & Tone** (toutes deux ci-dessous). Les deux messages utilisateur, le contexte (comptes, persona, profils, emplois du temps, lore, contexte de chat activé, timeline, fonctionnalités activées et quotas) et le message `# JSON Output Format` sont assemblés dans le code. |
| Prompt système de base de la timeline | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_BASE` (`noodle.timelineBase`) | Modifie **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Prompt**, ou change dans le code `NOODLE_TIMELINE_BASE_DEFAULT_PROMPT` dans `noodle-prompt.ts`. La valeur par défaut contient les règles de plateforme pour adultes, d'auteur du persona, d'interaction et de JSON : une réécriture peut donc casser l'analyse de `noodleGeneratedRefreshSchema`. |
| Instructions de voix et de ton de la timeline (ajoutées après la base) | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_TIMELINE_VOICE` (`noodle.timelineVoice`) | Modifie **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Timeline Voice & Tone**, ou change dans le code la valeur par défaut enregistrée (`noodleTimelineVoiceDefaultText(enhanced, allowRandomUsers)` dans `noodle-prompt.ts`). Tant qu'elle n'est pas modifiée, la valeur par défaut suit le réglage Noodle `enableEnhancedTimelineWriting` (`ctx.enhanced` ; désactivé par défaut, ce qui reproduit l'instruction de ton d'origine sur une seule ligne) et le fait que les utilisateurs aléatoires soient autorisés ou non. Dès que l'utilisateur enregistre son propre texte de surcharge, celui-ci l'emporte quels que soient ces réglages. |
| Profils des comptes de personnages créés pour la première fois | **package** `services/noodle/noodle-public-profiles.service.ts` | `generateMissingNoodleProfiles()` | Modifie dans le code les messages système et utilisateur écrits en dur. La sélection des participants s'exécute d'abord, et seuls les comptes de personnages sélectionnés sans `profileGenerated` sont transmis à ce prompt. |
| Prompt de l'image générée pour un post | `packages/server/src/services/prompt-overrides/registry/noodle.ts` | `NOODLE_IMAGE_POST` (`noodle.imagePost`) | Modifie **Settings -> Generations -> Image Generation Prompt Overrides -> Noodle Post Image**, ou change dans le code la valeur par défaut enregistrée. |
| Instructions d'image propres à Noodle, par défaut | `packages/shared/src/schemas/noodle.schema.ts` | `DEFAULT_NOODLE_SETTINGS.imageGenerationPrompt` | Change le réglage Noodle dans l'interface, ou sa valeur par défaut de schéma dans le code. |
| Contexte de chat inséré dans la génération de la timeline, sur activation | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildOptedInChatContext()` | Change l'assemblage du contexte dans le code ; l'activation par l'utilisateur reste dans les réglages de chaque chat. |
| Images fournies en entrée pour les posts et réponses de la timeline | **package** `services/noodle/noodle-vision.ts` | `prepareNoodleVisionAttachments()` | Change dans le code la sélection des images, leur normalisation, les limites ou le repli en texte seul pour raison de compatibilité. |
| Activité Noodle insérée dans les prompts de chat | **package** `services/noodle/noodle-context.ts` | `buildRecentSocialMediaActivityBlock()` | Le package l'enregistre comme service `noodle:prompt-context`. Change dans le code le filtrage ou l'assemblage du bloc ; les utilisateurs règlent les modes cibles et le nombre maximal d'éléments dans les réglages de Noodle, tandis que le bloc encapsulé a un plafond strict de 8 192 tokens. |
| Contrat JSON de la génération | `packages/shared/src/schemas/noodle.schema.ts` | `noodleGeneratedRefreshSchema` | À ne changer qu'en même temps que le prompt, le traitement de la route, les types partagés et la couverture de régression. |
| Contexte de monde et de lore issu des lorebooks, inséré dans la génération de la timeline | **package** `services/noodle/noodle-public-prompt.service.ts` | `buildRefreshPrompt()` (appelle `processLorebooks()`) | Conditionné par le réglage Noodle **Lorebook context** (`enableLorebookContext`, désactivé par défaut). Réutilise le même `processLorebooks()` multi-personnages que les chats de groupe, avec un budget de tokens propre à Noodle fourni par `noodleLorebookTokenBudget()` dans `noodle-prompt.ts`, mis à l'échelle selon le nombre de personnages actifs et plafonné à 8 192 tokens. S'exécute avec `previewOnly: true`, car Noodle n'a pas d'emplacement par chat où conserver l'état de temporisation sticky/cooldown. |

Le prompt de profil n'apparaît pas dans l'interface des surcharges de prompts. Les modèles **Noodle Timeline Prompt**, **Noodle Timeline Voice & Tone** et **Noodle Post Image** y apparaissent. Quand **Noodle image generation** est activé (`enableImagePrompts`), le réglage Noodle **Image instructions (sent to your LLM)** est transmis au modèle de la timeline, qui le suit quand il écrit l'idée d'image de chaque post ; le modèle **Noodle Post Image** par défaut ne l'ajoute plus, mais des modèles personnalisés peuvent toujours l'utiliser sous la forme `${userInstructions}`.

Le service d'image (**package** `services/noodle/noodle-public-images.service.ts`) charge `NOODLE_IMAGE_POST`, puis fait passer le résultat par `compileImagePrompt()` avant de l'envoyer au fournisseur d'images. La requête finale peut donc aussi dépendre du profil de style d'image sélectionné et des valeurs par défaut de la connexion.

## Inspecter les prompts finaux

Un rafraîchissement manuel lancé avec Debug Mode (mode débogage) activé enregistre les messages finaux envoyés au modèle, pour le profil comme pour la timeline, via le logger partagé du serveur. Cherche :

```text
[debug/noodle] Profile prompt sent to model
[debug/noodle] Prompt sent to model
[debug/noodle] Attached N timeline image input(s) to the refresh prompt
```

Les images de la timeline ne sont jamais écrites en base64 dans les logs de débogage. Le texte enregistré contient les mêmes clés de pièce jointe de post ou de réponse que celles envoyées au modèle, ainsi que le nombre d'images fournies nativement en entrée. Noodle normalise et plafonne ces entrées dans `noodle-vision.ts`. Si un fournisseur refuse explicitement le contenu visuel, le package l'enregistre dans les logs et envoie à la place le prompt de repli en texte seul.

Pour les images, active **Expose media prompts before sending** (afficher les prompts médias avant l'envoi) sous **Settings -> Generations -> Overall Generations** afin d'inspecter et de modifier les prompts positif et négatif compilés avant l'envoi de la requête.

## Modifier sans casser

L'assemblage des prompts est une frontière de compatibilité à haut risque. Quand tu y touches, garde alignés le prompt, `noodleGeneratedRefreshSchema`, le traitement de la route ainsi que les régressions Noodle sur les mentions et les sondages. Dans Engine, lance au minimum :

```bash
pnpm check
pnpm regression:prompt
pnpm regression:noodle
```

Les changements du code qui appartient au package se font et se valident dans Marinara-Agents, sur sa branche `staging`.

## Guides associés

- [Noodle : la timeline sociale intégrée](../noodle/overview.md)
- [Réglages de Noodle et reprise du chat](../noodle/settings.md)
- [Packages d'agents et de capacités optionnels](optional-agent-packages.md)
- [Carte de l'architecture (développeurs)](architecture-map.md)
