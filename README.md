# SkillGate

Contrôle des risques financiers **avant l’installation des skills**. Pas de wallet, de contrôle transactionnel ou de plateforme web.

SkillGate acquiert le paquet en quarantaine et analyse son contenu sans exécuter son code. Une analyse complète sans alerte installe automatiquement le snapshot vérifié. Un risque ou une analyse incomplète affiche les raisons, les fichiers et les lignes concernés, puis laisse le choix dans le terminal : **Ne pas installer** (défaut) ou **Installer malgré le risque**. Une collecte tronquée ne peut pas être acceptée, même par exception.

## Installer et activer

Node.js 22.18+ requis ; testé avec Node.js 25.6.1. Le produit est distribué comme paquet autonome dans les releases GitHub, **sans publication au registre npm**. Aucun serveur ou navigateur requis.

```sh
npm install --global https://github.com/gderamchi/skillgate/releases/download/v0.2.1/gderamchi-skillgate-0.2.1.tgz --ignore-scripts --no-audit --no-fund
cd /CHEMIN/PROJET-DE-DEMO
# Cette commande initialise le projet et active le contrôle dans ce terminal.
eval "$(skillgate enable)"
```

Le `eval` exécute uniquement les exports shell générés par le CLI installé localement. `enable` seul ne peut pas modifier l’environnement du terminal parent. Les terminaux déjà ouverts et les applications déjà lancées n’héritent pas de cette activation. Aucun fichier de profil shell n’est modifié.

Les commandes prises en charge passent ensuite automatiquement par SkillGate, qu’elles soient lancées par une personne ou par un agent héritant de ce terminal :

```sh
npx skills add gderamchi/skillgate-demo-skills --skill portfolio-summary --agent codex
npx skills add gderamchi/skillgate-demo-skills --skill portfolio-summary-trap --agent codex
# Aussi : npx -y skills@VERSION add …, pnpm dlx skills add …, skills add …
```

Le premier skill s’installe automatiquement ; le second est retenu et expliqué. Dans un terminal interactif, taper `2` accepte explicitement le risque pour le snapshot affiché. Entrée annule. Sans terminal interactif, le paquet reste retenu (code 2) ; `skillgate approve RAPPORT` permet la décision ultérieure. Aucun `--yes` d’un installateur ne confirme un risque.

La cible est **Codex dans le projet activé**, sous `.agents/skills`. Les demandes globales, multi-skills et options non prises en charge sont refusées. Changer de projet exige une activation dans ce projet. Les commandes sans rapport avec l’installation sont déléguées au programme original.

## Codex : garde complémentaire

```sh
eval "$(skillgate enable --codex-hook)"
```

Cela ajoute un hook `PreToolUse` dans `.codex/hooks.json`, en préservant les autres hooks. **Codex exige de revoir et autoriser ce hook via `/hooks` dans un projet de confiance** ; SkillGate ne modifie pas cette confiance. Le hook reconnaît les installateurs pris en charge et remplace leur commande par le CLI contrôlé avant toute acquisition/activation. Le script Python natif de Codex n’est accepté qu’avec une destination explicite correspondant à `.agents/skills` du projet ; sa cible globale implicite est refusée.

Ce hook complète le terminal, il ne remplace pas l’activation du terminal pour les installations externes à Codex. Il ne lance pas l’analyse dans le processus de hook : la commande substituée effectue la collecte, les checks et l’installation.

Les permissions de Codex s’appliquent toujours : le test réel en sandbox `workspace-write` a analysé le paquet puis refusé la création de `.agents` (`EPERM`). L’installation requiert donc aussi une autorisation d’écriture du host. Le test d’intégration réussi utilise le vrai CLI Codex avec un faux modèle local, dans un projet temporaire dont l’écriture est autorisée ; il ne démontre pas une installation sans permission dans toutes les sandboxes. SkillGate n’élève pas ces permissions.

## Périmètre réel

L’intégration par PATH couvre `npx skills add/install`, `pnpm dlx skills add/install` et `skills add/install` dans le terminal activé et ses descendants. Elle n’intercepte pas les copies manuelles, binaires appelés par chemin absolu, autres installateurs, environnements qui réinitialisent PATH, commandes passées à un shell déjà ouvert via `write_stdin`, ni processus lancés avant activation. Le hook natif couvre certaines commandes Codex supplémentaires.

Les hooks Codex peuvent laisser passer une commande si le hook ne démarre pas ou expire ; ils ne constituent pas une isolation de sécurité. Les syntaxes reconnues mais non prises en charge sont explicitement refusées par notre adaptateur. La protection ne résiste pas à un processus local qui décide de la contourner ou de modifier ses fichiers. **Aucune interception universelle de tous les processus n’est revendiquée.** Voir la [documentation officielle des hooks](https://learn.chatgpt.com/docs/hooks).

## Autres commandes

```sh
skillgate scan /chemin/skill --json
skillgate install /chemin/skill
skillgate update nom-du-skill
skillgate inspect scan-ID
skillgate approve scan-ID
skillgate list
skillgate doctor
skillgate env                 # exports pour réactiver un projet configuré
skillgate report scan-ID --format html --output rapport.html
skillgate demo --json
skillgate benchmark --json
skillgate export --json
skillgate prune --json
```

`--project DOSSIER` fixe la racine ; `--json` réserve stdout au JSON et désactive les questions. `scan` n’installe rien. Une mise à jour retenue laisse la version précédente active ; les mises à jour doivent passer par `skillgate update`. L’exception reste enregistrée avec l’empreinte, la destination et le statut `installed_with_exception`.

Codes : 0 succès, 1 erreur, 2 retenu/annulé/décision requise, 3 configuration absente, 130 interruption. Une erreur n’autorise jamais une activation par SkillGate.

## Analyse et limites mesurées

Mode statique local par défaut, sans clé : heuristiques financières FIN-01 à FIN-06 (secrets, bénéficiaires, autorisations, paramètres, code distant/masqué, consignes cachées). Un mot financier isolé ne suffit pas. La couverture des fichiers et le risque restent distincts. Les empreintes et contrôles avant activation empêchent de substituer la source à la version analysée.

Sur le benchmark interne synthétique gelé de 40 cas : **11/16 suspects détectés, 5 non détectés, 4/16 faux positifs** ; 11/16 légitimes installables automatiquement ; 7/8 incomplets retenus et 1 erreur de collecte sans activation. Ces chiffres ne sont pas une certification ou une mesure indépendante. Les résultats détaillés restent dans `outputs/benchmark.json`.

Un provider OpenAI Responses facultatif est implémenté et testé avec des réponses simulées, mais aucun appel payé réel n’a été exécuté. Il nécessite profil hybride, consentement explicite, modèle et clé. Il ne peut pas effacer un constat natif. Aucun fallback hybride vers statique silencieux. Sans clé, la démonstration utilise uniquement les checks locaux.

Le corpus sépare 11 sources réelles consultées (dont 4 rapports de recherche), 3 mécanismes documentés et 3 hypothèses financières synthétiques. Les fixtures et leurs actions sont inertes. `skillgate demo` rejoue un registre fictif 100 → 75 DEMOUSD ; aucune transaction, économie réelle ou réaction d’un modèle n’en est déduite.

## Développer et vérifier

Pour reconstruire les sources : pnpm 10.33.0, Python 3 (ZIP et tests PTY) et un shell POSIX macOS/Linux. Le smoke natif optionnel exige le CLI Codex installé ; il utilise un faux modèle local, sans clé.

```sh
pnpm install --frozen-lockfile
pnpm validate
```

La validation exécute typecheck, tests, build CLI, scénarios de choix dans un vrai PTY, démonstration isolée, packaging et installation du paquet hors dépôt. Les preuves actuelles sont dans `outputs/cli-validation.json`. Le paquet compilé n’a aucune dépendance runtime externe et exclut le serveur, React, Vite et les assets web. Les anciens fichiers `apps/web`, tests HTTP et preuves 0.1.0 sont conservés pour traçabilité, sans faire partie du produit 0.2.1.

Les rapports, snapshots et journaux locaux sont privés au compte, mais ne sont pas inviolables. Les extraits masquent certains motifs de secrets ; les snapshots peuvent contenir le texte original. `prune` retire explicitement les données inactives selon la rétention configurée et préserve les versions encore actives. Ne pas effacer des snapshots référencés.

Le dépôt public contient le code source, le corpus, les fixtures inertes et les scripts de vérification. Les rapports publics expurgés se trouvent dans `docs/evidence/` et les empreintes dans la release ; les journaux bruts restent locaux.

Le cahier des charges initial est conservé dans `docs/SPECIFICATION.md`, avec le changement de périmètre demandé ensuite : CLI et interception terminal, sans UI web.
