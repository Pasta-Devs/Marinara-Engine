# Stockage natif en fichiers

Ce guide décrit l'architecture de persistance locale de Marinara Engine. Pour l'organisation des dossiers côté utilisateur, voir [Où sont stockées tes données](../data/where-data-is-stored.md).

## Source de vérité

Marinara enregistre les lignes de l'application sous forme d'instantanés JSON dans `DATA_DIR/storage` :

```text
storage/
├── manifest.json
└── tables/
    ├── chats/
    │   ├── <encoded-chat-id>.json
    │   └── ...
    ├── characters/
    │   ├── <encoded-character-id>.json
    │   └── ...
    ├── messages/
    │   ├── <encoded-chat-id>.json
    │   └── ...
    ├── message_swipes/
    │   └── <encoded-chat-id>.json
    └── ...
```

La variable `FILE_STORAGE_DIR` permet de remplacer le dossier `storage`. Chaque fichier de table contient un tableau JSON. Le fichier `manifest.json` conserve la version du format de stockage, l'heure d'enregistrement, l'identifiant du backend et le nombre de lignes de chaque table enregistrée.

### Tables fragmentées

Le format de stockage 5 conserve **chaque table adossée à des fichiers sous forme de fragments indexés par propriétaire**, au lieu de réécrire un fichier JSON monolithique pour toute la table. Les lignes enfants sont regroupées sous l'entité qui possède leur cycle de vie et leur mode d'accès : messages, mémoire, exécutions d'Agents et état de jeu par chat ; historique des fiches et galeries par personnage ou persona ; entrées, dossiers et liens de lorebook par lorebook ; enfants de prompt par preset ; et données sociales par compte ou publication. Les enregistrements autonomes utilisent un fichier par clé primaire. `message_swipes` est le seul cas indirect et retrouve son propriétaire via le message parent. `FILE_BACKED_TABLES` et `getFileTableShardStrategy()` dans `file-backed-store.ts` font référence ; pour les retours de version sûrs, la commande hors ligne `unshard` de `scripts/protect-launcher-data.mjs` reproduit la liste complète, dont un test de régression garantit la correspondance.

Le suivi des modifications fonctionne au niveau du fragment : une écriture ne touche donc que les propriétaires modifiés. Un fragment dont le nombre de lignes tombe à zéro est supprimé au lieu d'être écrit comme tableau vide. Les noms de fichiers sont encodés en pourcentage depuis la clé de propriété, avec des solutions de repli par hachage pour les noms trop longs ou réservés. Cet encodage constitue une limite de sécurité, car les profils importés peuvent contenir des ids arbitraires. Les fichiers ne sont que des conteneurs ; les lignes conservent leurs propres clés.

Au premier démarrage avec de nouvelles tables fragmentées, les fichiers monolithiques existants migrent automatiquement : les lignes sont regroupées par propriétaire et écrites en fragments, puis le fichier monolithique **et son `.bak`** sont renommés en `.pre-shard`. Ces fichiers constituent la sauvegarde automatique précédant la migration et le Engine ne les supprime jamais. Un marqueur `.migrating` rend la récupération après incident déterministe. Si une ancienne build recrée ensuite un fichier monolithique à côté des fragments, les fragments prévalent et le fichier conflictuel est isolé avec un suffixe horodaté `.post-downgrade-`, sans fusion. Les lignes enfants orphelines vont dans le fragment `orphaned-rows` au lieu d'être perdues. Un manifeste écrit par un format de stockage plus récent refuse de se charger.

## Modèle d'exécution

Le fichier `packages/server/src/db/file-backed-store.ts` charge les instantanés des tables en mémoire au démarrage. Le serveur lit et modifie ces lignes via les opérations natives en fichiers exposées par `db/file-query.ts`. Le fichier `db/file-schema.ts` fournit des métadonnées de tables et de colonnes sans risque de collision pour les définitions de `db/schema/`.

L'API fluide `select`, `insert`, `update` et `delete` garde les services de stockage compacts, sans dépendre d'une base de données externe ni d'un ORM. Les filtres et les tris pris en charge sont des objets d'expression explicites : le store n'analyse donc jamais de chaînes de requête.

Les tables déclarent leurs clés naturelles avec `fileTable(..., { uniqueBy: [...] })`. Les insertions et les mises à jour valident les clés primaires et les clés naturelles déclarées sur l'ensemble du changement candidat avant de modifier les lignes en mémoire. Une contrainte non respectée laisse ainsi la table intacte. Une règle peut inclure un prédicat `when` lorsque l'unicité ne s'applique qu'à une partie des lignes.

Les capability packages téléchargés peuvent embarquer leurs propres instances de file-table. Le store résout ces instances par le nom de table enregistré, après avoir vérifié l'identité des objets. Le code de stockage fourni par un package peut donc utiliser les tables du moteur en toute sécurité.

## Persistance et récupération

Les écritures marquent les tables concernées comme modifiées. Un court anti-rebond regroupe les changements rapprochés, pendant qu'un minuteur de sécurité vide régulièrement le travail en attente. À l'arrêt propre, Marinara attend la fin des écritures en cours, puis enregistre les lignes modifiées pendant cette écriture.

Chaque instantané est écrit dans un fichier temporaire, vidé sur le disque, puis renommé de façon atomique. Avant le remplacement, l'instantané sain précédent est rafraîchi sous forme de fichier `.bak`. Au démarrage, un fichier principal illisible est restauré depuis sa sauvegarde quand c'est possible. Si aucune des deux copies n'est exploitable, Marinara met les fichiers corrompus en quarantaine avec un suffixe horodaté et ne démarre que cette table à vide, pour que l'interface reste accessible et permette la récupération.

## Transactions

Les transactions reposent sur des instantanés en copie sur écriture, délimités par `AsyncLocalStorage`. Une table n'est clonée qu'au moment où la transaction la modifie pour la première fois. Si le callback lève une erreur, seules les tables modifiées par cette transaction sont restaurées ; les écritures concurrentes sans rapport sont préservées.

## Ajouter une table

Pour ajouter des données persistantes :

1. Définis la table dans `packages/server/src/db/schema/` avec `fileTable` et les constructeurs de colonnes natifs en fichiers.
2. Exporte-la depuis `db/schema/index.ts`.
3. Déclare les éventuelles clés naturelles avec l'option de table `uniqueBy`.
4. Enregistre son nom dans `FILE_BACKED_TABLES` ; ajoute sa colonne parent stable à `SHARD_KEY_COLUMNS` lorsque les lignes doivent être regroupées avec un propriétaire plutôt que par leur clé primaire.
5. Définis les relations en cascade ou en mise à null dans `file-backed-store.ts` si nécessaire.
6. Ajoute les métadonnées de colonne JSON dans `services/mari-db/mari-db.service.ts` quand un champ texte contient du JSON structuré.
7. Vérifie le comportement de sauvegarde et de restauration du profil.
8. Lance `pnpm check` et les régressions de stockage concernées.

Garde alignés dans le même changement les définitions de tables, les métadonnées de relations, la portabilité des profils et la validation Mari DB.
