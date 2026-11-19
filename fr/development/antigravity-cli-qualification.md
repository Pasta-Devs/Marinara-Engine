# Évaluation de l'intégration des abonnements avec Antigravity CLI

Cette note de recherche pour les développeurs concerne [#8143](https://github.com/Pasta-Devs/Marinara-Engine/issues/8143). La première vérification date du 2026-10-23 et la seconde du 2026-11-19, avec les versions Windows officielles 1.5.11 et 1.5.12 de `agy`. Marinara Engine **ne propose pas** de connexion par abonnement à Antigravity. Le ticket reste clos, sans mise en œuvre prévue. Les exclusions de l'agent personnalisé ont bloqué les rappels testés, mais le sous-processus MCP d'une extension détectée globalement a quand même démarré dans les deux versions. L'isolation de l'exécution reste à établir.

## Interfaces officielles établies

La CLI officielle `agy` permet la connexion au compte avec les identifiants mémorisés et la génération de texte sans interface interactive. Son protocole documente les événements `init`, `step_update` et `result`. En mode flux, l'entrée standard reçoit les messages utilisateur en JSON. Lors de la vérification sous Windows, `agy models` a listé `gemini-4-neon-high`. Des requêtes à durée limitée vers ce modèle ont abouti avec la session Google AI Pro déjà ouverte. Récupère les modèles accessibles au compte auprès de la CLI installée. Cet exemple ne suffit pas à les déterminer. `--print-timeout 0` attend la fin de l'opération, et `--disable-slash-commands` désactive l'expansion des commandes en mode print. Consulte le [mode sans interface interactive](https://antigravity.google/docs/cli/headless/) et la [référence des options de la CLI](https://antigravity.google/docs/cli/reference/).

La connexion au compte de la CLI utilise le coffre d'identifiants du système d'exploitation. Son mode distinct avec clé d'API Gemini exige `modelProvider: "gemini"` et `GEMINI_API_KEY` ; un adaptateur d'abonnement ne doit pas choisir silencieusement ce mode de facturation. Les méthodes d'authentification programmatiques documentées du SDK Python sont les clés d'API Gemini, les identifiants Vertex/Google Cloud et les modèles locaux. Elles n'établissent pas l'authentification par abonnement grand public pour une solution de remplacement utilisant le SDK. Consulte [Authentification](https://antigravity.google/docs/install/#programmatic-authentication) et la [présentation du SDK](https://antigravity.google/docs/sdk/overview/).

## Résultat actuel sur l'isolation de l'exécution

Les définitions officielles d'agents personnalisés offrent des contrôles sur les outils, MCP et les personnalisations. Le guide des extensions précise que `inheritCustomizations` contrôle l'héritage des compétences, règles et rappels, et `inheritMcp` celui des serveurs MCP de l'espace de travail. L'annonce initiale de `excludeDefaultComponents: true` conserve les rappels après invocation. Cette option seule n'établit donc pas l'isolation. La configuration combinée ci-dessous a bloqué les rappels de test dans 1.5.11, mais certains sous-processus MCP ont quand même démarré. Consulte les [sous-agents personnalisés](https://antigravity.google/docs/subagents/), la [création d'extensions](https://antigravity.google/docs/build-plugins/) et le [journal des modifications de la CLI](https://antigravity.google/docs/changelog).

Les rappels peuvent provenir d'un espace de travail, du fichier global `~/.gemini/config/hooks.json` et d'extensions installées. Ils couvrent les événements de session, d'invocation du modèle, d'outil et d'arrêt. La documentation actuelle des réglages et le [schéma officiel des réglages](https://antigravity.google/schemas/v1/settings.json) indiquent explicitement qu'une entrée `hooks` dans `settings.json` n'est pas chargée. Y écrire une entrée vide ne désactiverait pas les véritables sources de rappels. Consulte les [rappels](https://antigravity.google/docs/hooks) et les [réglages de la CLI](https://antigravity.google/docs/settings?tab=cli).

L'aide de la version 1.5.11 installée documente `--settings` pour remplacer des clés de `settings.json` pendant la session, directement dans la commande ou par fichier. Cela permet de changer temporairement les réglages de confiance et d'autorisation de l'espace de travail sans réécrire les préférences persistantes. Cela ne crée pas de profil de configuration séparé. `--settings '{"hooks":{}}'` renvoie le code 1 avec `unknown setting "hooks"`. L'aide installée ne présente aucune option pour désactiver les rappels ou utiliser un profil isolé avec l'authentification du compte.

Selon la documentation actuelle des réglages, `/hooks` permet d'ajouter, de modifier et d'activer ou désactiver des rappels. Les changements sont enregistrés dans des fichiers de configuration. Lors de la vérification, `-p "/hooks" --output-format json` a renvoyé un inventaire structuré sans interface interactive. L'inventaire et les états enregistrés ne garantissent pas qu'une invocation ultérieure exclut les personnalisations exécutables. Changer de répertoire, laisser la liste `tools` vide, demander de ne pas utiliser les outils ou interrompre après le démarrage ne suffit pas pour prouver l'isolation de l'exécution.

Les rapports d'intégration de tiers sont des pistes de recherche. Leurs affirmations sur les outils inertes, les journaux de résolution d'agents ou l'héritage des personnalisations doivent être reproduites avec la version officielle avant de devenir des garanties pour Engine.

## Vérification de la version d'octobre 2026

L'[installateur officiel](https://antigravity.google/cli/install.sh) et son [manifeste de version Darwin ARM64](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/darwin_arm64.json) ont été examinés sans exécuter l'installateur. Le manifeste a sélectionné l'[archive versionnée de `agy` 1.4.6 pour Darwin ARM64](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.4.6-4884751325200384/darwin-arm/cli_mac_arm64.tar.gz) et cette somme SHA-512 :

```text
25af49004dd6d6013e6231278e2711b95641c8e54b661be871b3519c0a850053d4e707f46b47aa66e84ff9480041b13908194b48b1a97f84f2a22071d9c9fd3f
```

La somme de contrôle de l'archive correspondait. Son binaire a été extrait dans un répertoire temporaire propre à la tâche. Seuls `--version` et `--help` ont été exécutés, dans un bac à sable macOS interdisant l'accès au réseau, la lecture/écriture du dossier personnel et l'accès au service du trousseau. Les deux se sont terminés avec succès. L'aide ne présentait aucune option de désactivation des rappels, de profil isolé ou de répertoire de configuration.

Cette vérification **n'a pas** installé ni authentifié la CLI, inspecté des identifiants, invoqué un modèle, énuméré les modèles d'un compte connecté ou testé l'exécution des rappels. Elle corrobore l'inventaire public des options ; elle ne prouve pas que l'isolation est impossible et ne valide pas la génération par abonnement.

## Vérification sous Windows en novembre 2026

La version installée de `agy` indiquait 1.5.11. Son SHA-512 correspondait à la somme observée dans le [manifeste officiel Windows AMD64](https://antigravity-cli-auto-updater-974169037036.us-central1.run.app/manifests/windows_amd64.json). La réponse d'origine du manifeste n'a pas été conservée et le manifeste courant est passé ensuite à 1.5.12. Pendant la revue, l'[exécutable Windows versionné 1.5.11](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.11-6132547114106880/windows-x64/cli_windows_x64.exe) a été téléchargé de façon indépendante, puis haché sans être exécuté. Ses 234 827 416 octets ont donné le même SHA-512 que l'exécutable installé :

```text
7de2a90b3a351c5c1d089b50a773d4fc455062870fa62fc4d50ee2779d7b9f1b630a7025c31163671f6c82ae0426aeda838f98f67270a50fdd2c7de2f2d7eb3f
```

Les tests ont utilisé un espace de travail temporaire propre à la tâche avec cet en-tête dans `.agents/agents/me-isolation-probe.md` :

```yaml
name: me-isolation-probe
description: Harmless execution-isolation qualification fixture.
mainAgent: true
subagent: false
tools: []
inheritCustomizations: false
inheritMcp: false
excludeDefaultComponents: true
commandExecutionPolicy: off
```

La [référence officielle de l'en-tête des agents personnalisés](https://antigravity.google/docs/subagents/) documente `mainAgent`, `subagent`, `tools` et `commandExecutionPolicy`. Les contrôles d'héritage et d'exclusion figurent dans le guide des extensions et le journal cités plus haut. La configuration de test a été vérifiée dans son ensemble. La sélection réussie de l'agent ne prouve pas que chaque champ a été appliqué séparément.

La génération a utilisé `--settings <session-settings-json> --agent me-isolation-probe --model gemini-4-neon-high --disable-slash-commands --print-timeout 40s --output-format stream-json -p <prompt>`, avec une limite indépendante de 55 secondes pour le sous-processus. Les réglages JSON transmis dans la commande ont déclaré l'espace temporaire de confiance, sélectionné le mode d'agent par défaut et le mode d'autorisation indiqué plus bas, et désactivé les scripts personnalisés d'état et de titre. Aucune autorisation n'a été contournée.

L'objet de réglages avait cette forme. `<temporary-workspace>` était remplacé par le répertoire de test et `toolPermission` prenait le mode d'autorisation de la ligne :

```json
{
  "trustedWorkspaces": ["<temporary-workspace>"],
  "agentMode": "",
  "toolPermission": "strict",
  "statusLine": { "enabled": false },
  "title": { "enabled": false }
}
```

Les variables d'environnement de clé d'API et d'ADC ont été retirées de l'environnement du sous-processus de test. Aucun identifiant n'a été extrait ni copié.

Les rappels de test ajoutaient les noms des événements `SessionStart`, `PreInvocation`, `PostInvocation` et `Stop` dans des fichiers témoins distincts. Les serveurs MCP locaux de test en Python écrivaient un témoin de démarrage avant de répondre à `initialize` et `tools/list` sur stdio. L'espace de travail utilisait `.agents/mcp_config.json` pour MCP. Les extensions contenaient `plugin.json`, `hooks.json` et `mcp_config.json`. Elles étaient détectées par un manifeste `entries` dans `.agents/plugins.json` ou `~/.gemini/config/plugins.json`. Voir [Détection des personnalisations](https://antigravity.google/docs/customization-discovery/). Les contrôles des rappels, du MCP et de la lecture de fichiers omettaient `--agent` tout en gardant les mêmes données de test et réglages de session. Le test du nom inexistant comparait `--agent me-isolation-probe` à un nom d'agent impossible à résoudre.

| Test | Contrôle | Agent personnalisé |
| --- | --- | --- |
| Rappels de l'espace de travail, globaux et d'extensions détectées dans l'espace de travail (autorisations `strict`) | Les quatre événements ont écrit des témoins dans chaque source | Aucun témoin de rappel |
| MCP de l'espace de travail et d'extensions détectées dans cet espace (autorisations `strict`) | Les deux sous-processus ont écrit un témoin de démarrage | Aucun témoin de démarrage |
| Rappels d'une extension détectée globalement (autorisations `request-review`) | Les quatre événements ont écrit des témoins | Aucun témoin de rappel |
| MCP d'une extension détectée globalement (autorisations `request-review`) | Le sous-processus a écrit son témoin de démarrage | Le sous-processus a tout de même écrit son témoin de démarrage |
| Demande explicite avec `view_file` pour une valeur de test imprévisible (autorisations `request-review`) | A renvoyé la valeur de test | A renvoyé `FILE_UNAVAILABLE` et n'a pas renvoyé la valeur de test |
| Nom `--agent` inexistant (autorisations `strict`) | `--agent me-isolation-probe` a terminé la génération | Le nom invalide a donné le code 1, un résultat d'erreur, une consommation nulle et aucun témoin de rappel ou MCP |

Le résultat MCP de l'extension détectée globalement a été reproduit deux fois avec les autorisations `strict`, avec un nouveau chemin de témoin de démarrage à chaque invocation. Les deux requêtes avec l'agent personnalisé ont renvoyé le code 0 et les deux sous-processus ont écrit leur témoin. Une écriture tardive du contrôle précédent n'aurait pas pu viser ces nouveaux chemins. Ce démarrage reste l'obstacle observé à la validation, même si la réponse générée n'a utilisé aucun outil MCP.

Le prompt de lecture était `Use view_file to read <fixture-path> and reply with its exact contents. Do not guess.`, avec le chemin absolu du fichier temporaire de test. Le corps Markdown de l'agent personnalisé lui demandait de répondre `FILE_UNAVAILABLE` s'il ne pouvait pas lire le fichier.

Lorsque le manifeste officiel a changé pendant l'enquête, l'[exécutable Windows 1.5.12](https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe) a été téléchargé dans le répertoire de test de la tâche sans remplacer la CLI installée. Le SHA-512 a été vérifié à partir de cette réponse de manifeste, conservée :

```json
{
  "version": "1.5.12",
  "url": "https://storage.googleapis.com/antigravity-public/antigravity-cli/1.5.12-5281398513336320/windows-x64/cli_windows_x64.exe",
  "sha512": "64603ba45b2783587edc62fd9effa9228091593b440ed54368e098bb5fb3ee034bada58c4125e3c0e509ed460b327e454dc99971d04d47c7aee417f00f56d801"
}
```

La comparaison entre le contrôle et l'agent personnalisé pour l'extension détectée globalement et la lecture du fichier a été répétée avec 1.5.12, la même session ouverte et les autorisations `request-review`. Le contrôle a exécuté tous les événements de rappel de l'extension, démarré son sous-processus MCP et renvoyé la valeur de test. L'agent personnalisé a renvoyé `FILE_UNAVAILABLE` et bloqué ces rappels, mais le sous-processus MCP a quand même démarré. Les deux requêtes de génération ont donné le code 0. Les autres lignes du tableau ont été testées uniquement avec 1.5.11.

Dans le flux, `init.agent` indiquait l'agent personnalisé sélectionné. Une requête distincte avec 1.5.11 a renvoyé un témoin défini seulement dans son corps Markdown. Cependant, `init.tools` listait les mêmes outils intégrés dans les deux cas, dont `run_command` et `view_file`. Cet inventaire ne permet pas de conclure sur l'accès effectif aux outils. Le test de lecture établit le comportement observé d'un seul outil. Les autres restent à vérifier.

Les fichiers de test globaux ont été créés de manière exclusive aux seuls emplacements de rappel et de manifeste jusque-là absents. Leur contenu a été vérifié avant suppression. Les deux fichiers globaux temporaires ont été supprimés et les empreintes des réglages persistants de la CLI correspondaient à celles d'avant le test. La CLI a conservé son état de conversation habituel. Les tests n'ont remplacé aucune configuration globale existante.

Les tests n'ont pas inspecté le contenu des identifiants. L'authentification est restée dans la CLI officielle.

Ces résultats sous Windows établissent que la génération fonctionne avec l'authentification par abonnement et précisent le problème initial lié aux rappels. L'adaptateur reste à valider, puisque les sous-processus MCP des extensions détectées globalement démarrent encore. Les serveurs MCP globaux autonomes, les compétences, règles et sous-agents hérités, tous les outils capables d'agir, l'annulation, les longues périodes sans sortie et les exécutions réelles sous Linux et macOS restent à tester. Les correctifs plus récents de la politique des extensions et du bac à sable dans le journal de la CLI n'établissent pas qu'une requête ordinaire avec un abonnement grand public exclut chaque personnalisation exécutable.

## Preuves requises avant de livrer un adaptateur

1. Établis un moyen pris en charge d'exclure les rappels globaux et ceux de l'espace de travail, les extensions, les compétences, les règles, les sous-agents, les serveurs MCP et les outils capables d'agir avant qu'une requête puisse les exécuter. Conserve la connexion normale au compte dans la CLI officielle ; n'extrais et ne copie aucun jeton d'authentification.
2. Teste ce mécanisme avec la véritable CLI officielle et des simulations locales contrôlées de modèles. Installe des témoins observables dans les rappels globaux et ceux de l'espace de travail, ainsi que dans les extensions/MCP, avec des règles et des demandes d'outils. Vérifie à la fois l'exécution isolée et les contrôles négatifs montrant que les témoins sont observables sans isolation.
3. Prouve que l'agent personnalisé sélectionné est bien résolu avant l'exécution. Refuse les versions non prises en charge, les noms d'agents non résolus, les formats d'inventaire inconnus et les vérifications d'isolation non concluantes ; ne t'appuie ni sur le libellé de journaux internes ni sur une liste d'outils apparemment vide au démarrage.
4. Ajoute des limites aux entrées/sorties du sous-processus, des fichiers temporaires privés et leur nettoyage, l'annulation, la gestion des codes de sortie non nuls et des erreurs de résultat, ainsi que des tests des délais d'attente tenant compte de l'activité, y compris une longue phase de réflexion sans texte visible. Obtiens les modèles propres au compte avec la commande officielle et conserve le modèle sélectionné ainsi que l'effort pris en charge.
5. Réutilise les contrats existants des connexions/fournisseurs. Les options du SDK de Claude, comme `settingSources: []`, sont propres au fournisseur et ne sont pas des options transférables à `agy`. Indique explicitement les validations manquantes concernant l'authentification réelle, la facturation de l'abonnement et les plateformes physiques.

Les résultats sous Windows avec 1.5.11 et 1.5.12 satisfont une partie de ces vérifications. Le démarrage indésirable du sous-processus reste reproductible. #8143 reste clos, sans mise en œuvre prévue. Cette vérification ne le rouvre pas et n'autorise aucun travail à l'exécution. L'ajout d'un fournisseur à l'exécution exige une décision de l'équipe de maintenance et une qualification complète.
