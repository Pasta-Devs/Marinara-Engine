# Évaluation de l'intégration des abonnements avec Antigravity CLI

Cette note de recherche pour les développeurs concerne [#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143) et a été vérifiée le 2026-10-23. Marinara Engine **ne propose pas** de connexion par abonnement à Antigravity. Il manque encore un moyen pris en charge et vérifiable d'empêcher l'exécution des outils et personnalisations globales de la CLI, y compris les rappels de cycle de vie, pendant une demande de génération de texte d'Engine.

## Interfaces officielles établies

La CLI officielle `agy` permet la connexion au compte avec les identifiants mémorisés et la génération de texte sans interface interactive. Son protocole documenté comporte les événements `init`, `step_update` et `result`, avec des messages utilisateur JSON sur stdin pour l'entrée en flux. `agy models` énumère les modèles disponibles, dont les exemples documentés `gemini-4-argon-high` et `gemini-4-argon-medium`. Les modèles accessibles au compte doivent être obtenus depuis la CLI installée, et non déduits de ces exemples. `--print-timeout 0` attend la fin de l'opération, et `--disable-slash-commands` désactive l'expansion des commandes en mode print. Consulte le [mode sans interface interactive](https://www.antigravity.google/docs/cli/headless/) et la [référence des options de la CLI](https://www.antigravity.google/docs/cli/reference/).

La connexion au compte de la CLI utilise le coffre d'identifiants du système d'exploitation. Son mode distinct avec clé d'API Gemini exige `modelProvider: "gemini"` et `GEMINI_API_KEY` ; un adaptateur d'abonnement ne doit pas choisir silencieusement ce mode de facturation. Les méthodes d'authentification programmatiques documentées du SDK Python sont les clés d'API Gemini, les identifiants Vertex/Google Cloud et les modèles locaux. Elles n'établissent pas l'authentification par abonnement grand public pour une solution de remplacement utilisant le SDK. Consulte [Authentification](https://www.antigravity.google/docs/install/#programmatic-authentication) et la [présentation du SDK](https://www.antigravity.google/docs/sdk/overview/).

## Absence de garantie d'isolation de l'exécution

Les définitions officielles d'agents personnalisés offrent des contrôles sur les outils, MCP et les personnalisations. Le journal des modifications documente aussi `inheritCustomizations`, `inheritMcp` et `excludeDefaultComponents`. Cependant, l'annonce de `excludeDefaultComponents: true` conserve explicitement les rappels après invocation. Cette option ne peut donc pas prouver à elle seule qu'une demande de génération de texte exclut tous les rappels exécutables. Consulte les [sous-agents personnalisés](https://www.antigravity.google/docs/subagents/) et le [journal des modifications de la CLI](https://www.antigravity.google/docs/changelog).

Les rappels peuvent provenir d'un espace de travail, du fichier global `~/.gemini/config/hooks.json` et d'extensions installées. Ils couvrent les événements de session, d'invocation du modèle, d'outil et d'arrêt. La documentation actuelle des réglages et le [schéma officiel des réglages](https://antigravity.google/schemas/v1/settings.json) indiquent explicitement qu'une entrée `hooks` dans `settings.json` n'est pas chargée. Y écrire une entrée vide ne désactiverait pas les véritables sources de rappels. Consulte les [rappels](https://www.antigravity.google/docs/hooks) et les [réglages de la CLI](https://www.antigravity.google/docs/settings?tab=cli).

Les options et réglages documentés de la CLI ne proposent ni désactivation des rappels propre à une requête, ni répertoire de configuration/profil isolé conservant l'authentification du compte. L'inventaire en lecture seule `/hooks` est une indication utile, mais sa documentation ne garantit pas qu'une invocation ultérieure du modèle utilise une configuration fixe sans rappels. Un changement de répertoire, une liste `tools` vide, une instruction de ne pas utiliser les outils ou un abandon après le démarrage ne suffisent pas à prouver l'isolation de l'exécution.

Les rapports d'intégration de tiers sont des pistes de recherche. Leurs affirmations sur les outils inertes, les journaux de résolution d'agents ou l'héritage des personnalisations doivent être reproduites avec la version officielle avant de devenir des garanties pour Engine.

## Vérification locale de la version

L'[installateur officiel](https://antigravity.google/cli/install.sh) et son [manifeste de version Darwin ARM64](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json) ont été examinés sans exécuter l'installateur. Le manifeste a sélectionné l'[archive versionnée de `agy` 1.4.6 pour Darwin ARM64](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz) et cette somme SHA-512 :

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

La somme de contrôle de l'archive correspondait. Son binaire a été extrait dans un répertoire temporaire propre à la tâche. Seuls `--version` et `--help` ont été exécutés, dans un bac à sable macOS interdisant l'accès au réseau, la lecture/écriture du dossier personnel et l'accès au service du trousseau. Les deux se sont terminés avec succès. L'aide ne présentait aucune option de désactivation des rappels, de profil isolé ou de répertoire de configuration.

Cette vérification **n'a pas** installé ni authentifié la CLI, inspecté des identifiants, invoqué un modèle, énuméré les modèles d'un compte connecté ou testé l'exécution des rappels. Elle corrobore l'inventaire public des options ; elle ne prouve pas que l'isolation est impossible et ne valide pas la génération par abonnement.

## Preuves requises avant de livrer un adaptateur

1. Établis un moyen pris en charge d'exclure les rappels globaux et ceux de l'espace de travail, les extensions, les compétences, les règles, les sous-agents, les serveurs MCP et les outils capables d'agir avant qu'une requête puisse les exécuter. Conserve la connexion normale au compte dans la CLI officielle ; n'extrais et ne copie aucun jeton d'authentification.
2. Teste ce mécanisme avec la véritable CLI officielle et des simulations locales contrôlées de modèles. Installe des témoins observables dans les rappels globaux et ceux de l'espace de travail, ainsi que dans les extensions/MCP, avec des règles et des demandes d'outils. Vérifie à la fois l'exécution isolée et les contrôles négatifs montrant que les témoins sont observables sans isolation.
3. Prouve que l'agent personnalisé sélectionné est bien résolu avant l'exécution. Refuse les versions non prises en charge, les noms d'agents non résolus, les formats d'inventaire inconnus et les vérifications d'isolation non concluantes ; ne t'appuie ni sur le libellé de journaux internes ni sur une liste d'outils apparemment vide au démarrage.
4. Ajoute des limites aux entrées/sorties du sous-processus, des fichiers temporaires privés et leur nettoyage, l'annulation, la gestion des codes de sortie non nuls et des erreurs de résultat, ainsi que des tests des délais d'attente tenant compte de l'activité, y compris une longue phase de réflexion sans texte visible. Obtiens les modèles propres au compte avec la commande officielle et conserve le modèle sélectionné ainsi que l'effort pris en charge.
5. Réutilise les contrats existants des connexions/fournisseurs. Les options du SDK de Claude, comme `settingSources: []`, sont propres au fournisseur et ne sont pas des options transférables à `agy`. Indique explicitement les validations manquantes concernant l'authentification réelle, la facturation de l'abonnement et les plateformes physiques.

Tant que cette limite d'exécution n'est pas établie, #8143 reste ouvert et aucune entrée de fournisseur ne doit être ajoutée à l'exécution.
