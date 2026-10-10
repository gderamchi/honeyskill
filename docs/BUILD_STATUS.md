# SkillGate 0.3.0 — état de livraison

Mis à jour le 10 octobre 2026. Le périmètre actuel remplace l’UI web du brief initial par un CLI et des adaptateurs d’installation dans le terminal.

## Livré

- Moteur statique, quarantaine, preuves financières, empreintes, activation du snapshot vérifié et mises à jour préservant l’ancienne version en cas de rétention.
- CLI seul, sans serveur ni assets web. Installation automatique du légitime ; choix terminal « Ne pas installer » / « Installer malgré le risque ». Aucune approbation de risque par `--yes` ou sortie JSON.
- `skillgate on` ouvre une session Bash dédiée et active les wrappers npx/pnpm/skills dans le terminal et les processus qui héritent de son environnement. Le contrôle remplace l’installateur avant son exécution.
- Options globales/ambiguës, sources multiples, mises à jour tierces et recherche interactive pouvant installer refusées ; le CLI explique la commande prise en charge.
- Hook Codex optionnel `PreToolUse`, configuration fusionnée, confiance native `/hooks` jamais contournée par le produit. Tests de réécriture, refus, contexte de projet et préservation des autres hooks.
- Dépôt de démo **public** : https://github.com/gderamchi/skillgate-demo-skills . Release v0.1.0 et ZIP téléchargés anonymement, empreintes vérifiées. Légitime et piège analysés depuis le ZIP et GitHub figé, en racines temporaires ; légitime actif, piège retenu FIN-02/FIN-06 et absent du dossier actif.
- Paquet autonome 0.3.0, installable avec `npm i -g gderamchi/skillgate` et distribué par release GitHub, installation hors monorepo et parcours terminal vérifiés. Ancienne UI 0.1.0 conservée comme archive de travail, exclue du produit livré.

## Preuves

La [vérification publique 0.3.0](evidence/public-short-install.json) valide `npm i -g gderamchi/skillgate` anonymement avec un cache neuf, puis dix contrôles de `skillgate on` dans un vrai terminal. Le clone public passe 45 tests et le typecheck ; sa reconstruction produit exactement les octets du CLI installé. Le raccourci `npx --yes gderamchi/skillgate --version` fonctionne également.

`outputs/cli-validation.json` et ses logs : typecheck, tests, build, test des décisions en PTY, simulation isolée, package et installation hors dépôt. `outputs/cli-only-package-smoke.json` prouve aussi les commandes npx/pnpm/skills réelles sur le paquet installé : installateur tiers jamais exécuté pendant les cas interceptés. `outputs/cli-only-pty-smoke.json` couvre treize parcours de décision et d’interruption.

`outputs/demo-publication.json` contient les URLs publiques, le SHA Git, les requêtes anonymes et les rapports. `outputs/codex-hook-smoke.json` rend compte séparément du test avec le vrai CLI Codex et un fournisseur de modèle local simulé ; son statut et ses conditions doivent être lus avant toute revendication d’intégration native.

Le benchmark du moteur n’a pas changé : 11/16 suspects détectés, 5 non détectés, 4/16 faux positifs, 11/16 légitimes autorisés. Sept incomplets retenus et une erreur de collecte sans activation. Évaluation interne synthétique gelée, pas indépendante. Aucun appel provider réel, fonds ou secret réel.

## Reste à faire / limites

- **Distribution** : sources et paquet publics sur GitHub ; téléchargement anonyme, installation depuis l’URL et reconstruction depuis clone neuf vérifiés. Le registre npm n’est pas utilisé : aucune session npm valide sur ce poste. L’installation recommandée utilise le raccourci GitHub `npm i -g gderamchi/skillgate` et un CLI précompilé.
- **Couverture** : autres installateurs, autres agents, chemins absolus contournant les wrappers et processus qui n’héritent pas de PATH restent exclus. Aucun contrôle universel du système.
- **Contexte Codex** : projet de confiance, autorisation native du hook et permission d’écrire dans le dossier de skills nécessaires. Le produit ne modifie pas la sandbox. Les hooks peuvent laisser continuer une commande en cas d’erreur de démarrage/timeout et n’interceptent pas `write_stdin`.
- **Qualité de détection** : améliorer les faux négatifs et faux positifs sur un nouveau jeu de développement, puis évaluer séparément sans réécrire le benchmark gelé.
- Modèle réel, comparaison Cisco, provider payé et Fuji : non exécutés ; aucune nécessité pour le mode statique actuel.
- Hackathon : confirmer le track exact avec le mentor et obtenir les livrables communs officiels manquants.

Le profil réel de l’utilisateur n’a pas été modifié et aucune fixture n’est activée dans ce dépôt de développement.

Les résumés publics de vérification sont disponibles dans [evidence](evidence/). Les chemins `outputs/` cités désignent les fichiers produits localement par les scripts, volontairement exclus du dépôt public pour éviter de publier les chemins et journaux privés du poste.

## Vérification publique 0.2.1 terminée

Les deux preuves [installation publique](evidence/public-package.json) et [source publique](evidence/public-source.json) passent. Le CLI recompilé depuis le commit publié et le CLI installé depuis le tarball ont exactement le même SHA-256. 43 tests passent depuis le clone neuf, et 13 parcours PTY passent sur le paquet public installé. Les skills de démo sont acquis depuis le dépôt public, sans authentification.
