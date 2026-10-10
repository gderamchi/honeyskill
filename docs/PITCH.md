# SkillGate — trame de cinq slides

**Phrase produit :** Analysez les skills avant de leur confier un accès à vos opérations financières.

**Positionnement :** prévention à l’installation pour développeurs et opérateurs d’agents ayant accès à des wallets, outils de trading ou de paiement. Cible commerciale hypothétique, aucun client acquis revendiqué.

## Slide 1 — Une instruction peut sortir du mandat financier

Un skill qui promet de résumer un portefeuille peut ajouter une demande de transfert, de signature ou de transmission de secret. Les sources consultées documentent plusieurs mécanismes d’abus de skills ; notre scénario portfolio est une hypothèse synthétique, pas la reproduction exacte d’un incident nommé.

## Slide 2 — Contrôler les octets avant activation

Acquisition en quarantaine privée, inventaire et empreinte, règles financières puis politique déterministe. L’absence d’anomalie dans un profil terminé permet l’installation automatique. Risque et couverture restent distincts. Montrer le vrai snapshot installé et la version retenue.

## Slide 3 — Une réponse exploitable

Conséquence financière lisible, preuve avec fichier et lignes, rapport local, mise à jour dangereuse retenue et ancienne version conservée. L’opérateur peut confirmer une exception liée à une empreinte et une destination ; le statut reste visible. Aucune révocation de clé ni annulation de transaction n’est simulée.

## Slide 4 — Ce qui a été mesuré

Utiliser les métriques actuelles de `outputs/benchmark.json` et leur analyse dans `outputs/RESULTATS.md`. Corpus consulté séparé des scénarios synthétiques et résultats : 11 sources, dont 4 rapports de recherche ; 3 mécanismes documentés et 3 hypothèses ; 40 cas d’évaluation gelés et 4 de développement.

Afficher rappel, faux positifs, autorisations légitimes, couverture et erreurs avec numérateurs/dénominateurs. Les faux négatifs restent visibles. Le benchmark est interne synthétique, généré pour ce prototype. Les comparaisons hybride et Cisco n’ont pas été exécutées.

## Slide 5 — Intégration et responsabilité

CLI compilé installé avec `npm i -g gderamchi/skillgate`, puis activé avec `skillgate on`, sans interface web, cible Codex projet. Après activation du terminal, les commandes npx skills add, pnpm dlx skills add et skills add passent par SkillGate. Un hook Codex complémentaire couvre les commandes natives prises en charge. Les copies manuelles, chemins absolus contournant les wrappers et autres installateurs restent hors périmètre. Pas de wallet, de token, de SaaS, ni d’interception universelle. Aucun modèle payé ni fonds réel utilisés dans cette démonstration.

Alignement avec les thèmes de prévention, détection, traitement et responsabilité de DORA documenté prudemment ; aucune revendication « conforme DORA ». Le track Guardians of Value et ses livrables communs restent à confirmer avec le mentor/organisateur.

## Démonstration orale

« Voici la même demande de lecture de portefeuille et le même skill synthétique. La baseline rejoue un transfert fictif ; le chemin contrôlé retient son installation avec des preuves. Une version légitime s’installe automatiquement. La mise à jour suspecte laisse cette version active. Voici les échecs réels de nos règles : cette protection d’installation est utile mais limitée. »

La simulation est déterministe ; elle ne mesure pas la probabilité qu’un modèle suive l’instruction malveillante. Aucun montant fictif n’est présenté comme une économie réelle.

Les résumés publics de vérification sont disponibles dans [evidence](evidence/). Les chemins `outputs/` cités désignent les fichiers produits localement par les scripts, volontairement exclus du dépôt public pour éviter de publier les chemins et journaux privés du poste.
