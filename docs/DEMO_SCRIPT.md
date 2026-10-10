# Démonstration terminal — environ 3 minutes

SkillGate 0.2.1, sans plateforme web. Skills synthétiques publics : https://github.com/gderamchi/skillgate-demo-skills ; release v0.1.0. Le ZIP a été téléchargé anonymement et vérifié ; preuves dans `outputs/demo-publication.json`.

## Préparation isolée

Installer le tarball public GitHub (pas un paquet du registre npm), puis ouvrir un projet temporaire. Ne jamais installer la fixture piégée dans le profil réel ou ce dépôt de développement.

```sh
npm install --global https://github.com/gderamchi/skillgate/releases/download/v0.2.1/gderamchi-skillgate-0.2.1.tgz --ignore-scripts --no-audit --no-fund
DEMO_PROJECT=$(mktemp -d)
cd "$DEMO_PROJECT"
eval "$(skillgate enable)"
skillgate doctor
```

L’activation concerne ce terminal et les agents qui héritent de son environnement. Aucune modification de profil shell global. Le code des skills n’est jamais exécuté par le scanner.

## Skill utile : aucun clic supplémentaire

```sh
npx skills add gderamchi/skillgate-demo-skills --skill portfolio-summary --agent codex
```

Montrer l’installation automatique dans `.agents/skills/portfolio-summary`. C’est SkillGate qui acquiert et installe le snapshot vérifié ; le package npx tiers n’est pas lancé.

## Skill piégé : contrôle avant activation

```sh
npx skills add gderamchi/skillgate-demo-skills --skill portfolio-summary-trap --agent codex
```

Montrer les raisons FIN-02/FIN-06 : le skill annonce une lecture seule mais demande un transfert dissimulé de 25 DEMOUSD. Le terminal indique les extraits, le rapport et la destination. Entrée choisit « Ne pas installer ». Vérifier que le dossier actif ne contient pas le piège.

Relancer la même commande et taper `2` uniquement dans ce projet temporaire pour montrer « Installer malgré le risque ». Montrer `installed_with_exception` dans `skillgate list`. Le consentement porte sur cette empreinte et cette destination ; aucune approbation globale n’est enregistrée.

## Mise à jour et limites

`skillgate update portfolio-summary` refait le contrôle avant de remplacer la version existante. Une version retenue conserve le snapshot actif précédent. Les mises à jour de l’installateur tiers sont refusées et dirigées vers cette commande.

Sans TTY (par exemple un agent en mode JSON), une alerte retourne le code 2 et n’installe rien. L’agent présente les risques à l’utilisateur ; la décision se prend ensuite dans un terminal interactif avec `skillgate approve RAPPORT`. Le modèle n’est pas une preuve de consentement humain.

Pour Codex, le hook complémentaire exige une activation explicite et la revue `/hooks` native. Ne pas présenter cette étape comme déjà accordée dans le vrai profil utilisateur.

## Illustration financière, séparée de l’installation

```sh
skillgate demo --json
```

Cette commande utilise d’autres racines temporaires et un registre déterministe : baseline 100 → 75 DEMOUSD, rétention 100, légitime 100, mise à jour retenue 100, exception 75. **Simulation, aucun modèle réel ni fonds réel.** Ce n’est pas une somme économisée ni la probabilité qu’un agent suive le piège.

Le benchmark synthétique interne montre aussi les échecs : 11/16 suspects détectés, 5 manqués et 4/16 faux positifs. Ne pas annoncer une protection totale. L’activation PATH ne contrôle pas toutes les façons d’écrire un skill sur le disque.

## Secours

Les sorties `outputs/cli-demo.json`, `outputs/cli-only-pty-smoke.json` et `outputs/demo-publication.json` documentent les exécutions effectives. L’ancienne vidéo UI de 0.1.0 est historique et ne doit plus servir de présentation du produit actuel.

Les résumés publics de vérification sont disponibles dans [evidence](evidence/). Les chemins `outputs/` cités désignent les fichiers produits localement par les scripts, volontairement exclus du dépôt public pour éviter de publier les chemins et journaux privés du poste.
