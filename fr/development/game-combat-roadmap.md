# Feuille de route des combats du Game Mode

Ce document consigne la direction convenue pour [le terrain hybride #6265](https://github.com/Pasta-Devs/Marinara-Engine/issues/6265) et les travaux de combat à venir. Il distingue les projets du jeu actuel. L'implémentation commence sur `staging` ; toutes les capacités décrites ci-dessous ne sont pas nécessairement livrées.

## Séparer la participation des règles du champ de bataille

Les valeurs actuelles de `combatStyle` sont `classic` et `tactical`. Conserve-les. Les invocations futures relèvent d'un réglage de participation distinct, avec le combat en groupe par défaut pour les anciennes configurations et sauvegardes. Les préréglages de création peuvent définir les deux valeurs sans ajouter une autre énumération de mode persistante :

| Préréglage | Participation | Champ de bataille |
| --- | --- | --- |
| Groupe | Joueur et compagnons | Menus Classic |
| Invocation (prévue) | Créatures contrôlées ; dresseur hors combat | Menus Classic |
| Tactique | Joueur et compagnons | Grille Tactical |
| Invocation tactique (plus tard) | Créatures contrôlées ; dresseur hors combat | Grille Tactical |

N'expose pas de combinaisons inachevées. Compagnons narratifs et unités de combat sont distincts ; la position du premier membre du groupe dans un tableau ne doit pas devenir l'identité permanente du personnage contrôlé.

## Priorité actuelle : terrain hybride

Le GM fournit une petite description structurée fondée sur la scène. Le moteur détermine le terrain exact et les positions de départ à l'aide d'une graine, valide le plateau et enregistre le résultat. Le GM décrit ensuite le champ de bataille accepté. Déplacements et attaques ordinaires ne nécessitent pas d'appels au modèle.

Étends le traitement existant de l'environnement et des formations avec une taille de carte facultative, des repères de scène, des indications du joueur et une graine réutilisable. Les anciennes configurations doivent rester valides. Enregistre la grille acceptée et la provenance de sa génération afin qu'un changement de générateur ne redessine pas un combat existant. Les graines reproduisent la génération pour une même description et les mêmes combattants ; elles ne rendent pas déterministes des sorties arbitraires du modèle.

Le terrain généré peut être corrigé pour assurer les connexions, mais les contraintes de l'auteur ne doivent pas disparaître silencieusement. Borne la sortie du modèle, le nombre de cases et d'unités, et les dimensions des éléments. Refuse les dispositions impossibles avec une explication exploitable et propose explicitement un terrain généré de remplacement. Un éditeur complet de peinture et de placement et les cartes arbitraires viendront plus tard, avec les mêmes règles de validation.

### Capacités de déplacement

Marche, vol et téléportation exigent des règles explicites. Vol et téléportation peuvent franchir murs, eau et montagnes et éviter le surcoût de la forêt. Les bonus de défense et d'esquive restent indépendants du mode de déplacement.

Un mode omis signifie marche pour les anciennes rencontres. Un mode explicitement demandé mais non pris en charge est refusé avec une erreur ; ne remplace pas silencieusement la capacité par la marche. Ce contrat vaut pour les plans générés et les entrées de l'API tactique.

Sépare traversée, destinations autorisées et occupation. Traverser un mur par téléportation ne permet pas d'y terminer. La grille plane initiale ne représente ni altitude, ni plafonds, ni visibilité propre aux sorts, ni durée de vol limitée. Documente ces limites au lieu d'annoncer des règles de déplacement sur table complètes. Réutilise les mêmes contrôles pour les aperçus, la résolution, l'animation des trajets et l'IA ennemie.

## Règles sur table : profils intégrés et outils de référence pour le GM

Donne la priorité aux parties proches de 5e et V20 plutôt qu'à un jeu complet de collection de créatures. Ajoute ultérieurement des profils de règles bornés et versionnés. Choisis l'édition exacte et le sous-ensemble pris en charge avant de présenter un profil comme l'implémentation de ce système.

Le moteur doit gérer les vrais jets, les cibles autorisées, les déplacements, les budgets d'actions, la consommation des ressources et les résultats numériques. Le GM interprète la fiction, choisit une opération prise en charge, indique les intentions des PNJ et raconte le résultat réel. Les textes récupérés dans les lorebooks peuvent fournir des références et règles de campagne, sans contourner la résolution ni réécrire les jets.

[L'issue #5955](https://github.com/Pasta-Devs/Marinara-Engine/issues/5955) couvre la recherche sémantique dans les lorebooks et un accès par outil facultatif. La recherche complète les profils : elle aide le GM à trouver les informations utiles, tandis que les profils explicites rendent les mécanismes courants cohérents et testables. Évite une recherche distincte pour chaque jet ordinaire.

Commence par des primitives de test, de tour et de ressources prises en charge. Un profil d20 et un profil à réserve de d10 demandent des règles de résolution différentes ; l'un n'est pas une version renommée de l'autre. La couverture future devrait inclure initiative, tests opposés, dégâts et réduction, états et utilisation des ressources. Documente les cas non pris en charge et rends l'arbitrage du GM explicite.

Le jeu tactique sur table nécessite aussi des règles communes de ligne de vue et de couverture. La grille actuelle bloque le déplacement à travers les murs, mais les attaques à distance fondées sur la distance peuvent les franchir. Mets à jour ensemble résolution, IA, contre-attaques, prévisions et indications de menace. Conserve les phases actuelles du groupe et des ennemis ; l'initiative individuelle est un profil de règles distinct à sélectionner.

## Invocations : conserver le concept, reporter le système complet

Une première étape peut rester petite : une créature active par camp, des réserves possédées, un dresseur hors combat, un changement volontaire qui consomme la commande et une pause persistante de remplacement après un K.-O. La défaite survient lorsqu'aucune créature ne peut plus être déployée. Les objets du dresseur ne doivent pas accorder d'action supplémentaire à une créature.

Garde un seul effectif indexé par identifiants stables, plus les identifiants des emplacements actifs. Déduis réserves et état K.-O. au lieu de maintenir des tableaux concurrents. PV, ressources et états des créatures possédées persistent ; la génération des rencontres ne doit pas réinventer ces valeurs à chaque combat. Définis explicitement l'évolution des états des réserves.

Capture, évolution, reproduction, combats doubles, durées d'invocation temporaires et invocations tactiques sont des ajouts distincts. Le récapitulatif du GM doit distinguer une créature K.-O. d'un dresseur blessé.

## Persistance et preuves

Fige les règles effectives au début du combat. Les nouveaux champs facultatifs doivent préserver les anciennes sauvegardes Classic et Tactical. Imports de configuration, instantanés de création immuables et résumés doivent conserver les nouveaux choix. Actualisation, redémarrage, report à la session suivante, variantes de réponse, branches et restauration de points de contrôle exigent chacun une couverture explicite.

Un futur état de combat géré par le serveur doit appliquer ensemble les changements de combat et d'effectif, avec identifiants de rencontre, révisions et identifiants d'action idempotents. Réutilise les files d'écriture existantes lorsque cela convient. Examine les espaces de noms des jeux au tour par tour et des Experiences avant de réutiliser `game_engine_state` ; ce n'est pas automatiquement un stockage sûr pour le combat.

Pour chaque règle, ajoute la plus petite preuve exécutable `*.regression.ts`, comprenant les actions refusées et les anciennes entrées. Les vérifications dans le navigateur doivent couvrir configuration, véritable action tactique, actualisation, petits écrans, contraste des thèmes, focus et clavier, et erreurs utiles. Livre localisation et documentation utilisateur avec l'implémentation.

## Travaux antérieurs et points d'entrée

[La PR #4391, fermée sans fusion](https://github.com/Pasta-Devs/Marinara-Engine/pull/4391), sur `feat/game-mode-combat-expansion`, contient une extension plus large des sessions de combat, manoeuvres, objectifs et boss. C'est une référence utile, pas le comportement actuel de staging. Vérifie son responsable et son statut avant de la reprendre ; ne fusionne pas toute l'extension comme préalable au terrain.

Les principaux fichiers Engine sont `packages/shared/src/features/tactical-combat/`, `packages/server/src/routes/encounter.routes.ts`, `packages/server/src/routes/game.routes.ts`, `packages/client/src/components/game/GameSetupWizard.tsx`, `GameSurface.tsx` et `TacticalCombatUI.tsx`. Les définitions d'agents et d'Experiences téléchargeables et les prompts propres aux paquets relèvent de Marinara-Agents si des travaux ultérieurs les touchent.
