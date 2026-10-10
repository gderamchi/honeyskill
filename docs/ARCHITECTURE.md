# Architecture

SkillGate Finance contrôle l’installation de skills destinés à des agents financiers. Il n’intercepte pas leurs transactions à l’exécution.

Le CLI appelle le moteur partagé : acquisition sans exécution → inventaire et empreinte canonique → règles financières → analyse sémantique si explicitement configurée → politique déterministe → snapshot vérifié et activation. Les adaptateurs terminal remplacent les commandes d’installation prises en charge avant leur exécution ; un hook Codex optionnel ajoute la même réécriture dans les outils shell de l’agent.

- `packages/contracts` : schémas Zod des rapports, constats, couverture, configuration, décisions et sources.
- `packages/core` : collecte locale/GitHub, règles FIN-01 à FIN-06, politique, fournisseur sémantique facultatif, état et installation.
- `apps/cli` : commandes, rendu terminal/HTML, wrappers PATH et hook Codex. Le fichier server.ts est une archive de la version 0.1.0, non importée dans le produit.
- `apps/web` : archive React/Vite de la version 0.1.0, conservée pour traçabilité et exclue du produit.
- `packages/demo` : registre fictif et relecture d’actions bornées, sans shell ni réseau.
- `evaluation` : étiquettes externes aux paquets, gel des empreintes, runner reproductible.

## Frontières

Les paquets entrants sont des données hostiles. Aucun hook, script ni gestionnaire de dépendances du skill n’est exécuté. Les références distantes incluses dans les paquets ne sont pas téléchargées. Le fournisseur IA ne dispose d’aucun outil et ne peut pas activer un skill ni supprimer un constat natif.

Les octets inventoriés sont copiés en quarantaine privée, hors des emplacements de découverte Codex. Le manifeste trié contient chemins, tailles, SHA-256 et indicateur exécutable. La promotion recontrôle ce manifeste. Le dossier actif est un lien symbolique vers un snapshot ; son remplacement atomique conserve l’ancienne cible jusqu’à validation. Les liens entrants sont refusés, tandis que ce lien de sortie est créé par l’adaptateur.

La découverte `.agents/skills`, les liens symboliques et le chargement des modifications sont documentés dans [Build skills](https://learn.chatgpt.com/docs/build-skills), consulté le 10 octobre 2026. Le build prouve le placement des fichiers ; il ne revendique pas une exécution d’un modèle Codex sur une fixture hostile.

## État local

Configuration, rapports, quarantaine, snapshots, installations, verrous et transactions restent dans `.skillgate/`. Les écritures JSON passent par fichier temporaire et renommage ; les opérations sur une cible sont verrouillées. Le journal n’est pas inviolable contre le propriétaire du compte. Aucune télémétrie ni base distante.

Le serveur historique de 0.1.0, exclu du build CLI actuel, écoutait uniquement sur `127.0.0.1`. Un lien de session initial établit un cookie HttpOnly/SameSite=Strict puis redirige vers une URL sans jeton. Hôte et origine sont vérifiés ; l’UI est entièrement en lecture seule. Les exceptions exigent le CLI, donc aucune route de mutation web n’existe. Les skills sont rendus comme texte échappé, sous CSP restrictive.

## Politique

Risque et couverture restent séparés. Une analyse statique complète pour les contrôles pris en charge, sans constat financier pertinent, peut auto-installer. Une couverture partielle ou un profil hybride non terminé ne le peut pas. Une exception lie rapport, empreinte, destination, confirmation et opérateur déclaré ; elle n’autorise pas une mise à jour future. Il n’y a aucun cache de verdict partagé entre versions ou profils : chaque nouvelle opération relance l’analyse.

## Preuves de distribution

La release publique contient le CLI autonome et ses empreintes. Le dépôt contient les tests et les résumés expurgés dans `docs/evidence/`. Les scans sont réels ; le modèle du smoke Codex et le registre financier de démonstration sont des simulations explicites. La sandbox Codex continue de contrôler l’écriture dans `.agents` : aucune élévation de permission n’est effectuée par SkillGate.
