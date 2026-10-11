# Corpus de provenance

Ce corpus contient des résumés originaux de sources publiques consultées le **10 octobre 2026**, des fiches de mécanismes et des hypothèses de test. Il ne contient aucun malware original, aucune clé réelle et aucune copie intégrale d’article. Aucune infrastructure d’attaque citée par les articles n’a été contactée.

`sources.json` contient les 11 références du cahier des charges, toutes accessibles lors de cette consultation. `kind: research` désigne les rapports de recherche; les documentations, annonces de produits et le règlement restent dans leurs catégories propres. Une date de publication non établie reste `null`. `section` identifie le passage utilisé; les URL pointent vers l’éditeur primaire. Les documentations web restent évolutives.

`techniques.json` sépare trois fiches documentées (`DOC-*`) de trois hypothèses synthétiques (`SYN-*`). Les secondes ont `source_id: null`: leurs éventuelles `contextualSources` apportent du contexte, sans confirmer un incident. Les limites de la correspondance FIN-02 sont conservées dans `DOC-03`. FIN-01 à FIN-06 sont notre taxonomie de prototype, pas six incidents historiques établis.

## Comptage et déduplication

Les compteurs de l’UI doivent être calculés sur les fichiers:

- Sources consultées: sources avec `status === 'consulted'`.
- Rapports consultés: même filtre, puis `kind === 'research'`.
- Techniques documentées: fiches avec `kind === 'documented'`.
- Scénarios synthétiques: cas effectivement présents dans `evaluation/cases.json`, en distinguant développement et évaluation.
- Cas évalués: sorties individuelles d’un fichier de résultats effectivement produit par le runner, jamais le nombre de cas prévus.

Le champ `family` déduplique les mécanismes. Les recoupements entre Bitdefender, Snyk et Unit 42 ne créent pas plusieurs techniques pour une même chaîne de téléchargement. `corroboratingSources` conserve ces rapprochements. Un article peut décrire plusieurs familles et une famille peut apparaître dans plusieurs articles: aucun compteur n’est présenté comme un nombre d’attaques indépendantes.

Chaque fiche documentée conserve une source primaire et une section. La confirmation est celle déclarée par l’auteur; HoneySkill n’a pas réexécuté les échantillons. Les fixtures liées sont des adaptations inertes ou des hypothèses du projet, jamais les échantillons originaux. Leur lien avec une fiche n’est pas une preuve de détection. Seuls les résultats d’évaluation montrent ce que le moteur exécuté a produit.

## État de l’art et licences

L’affichage d’audits avant installation est déjà documenté par [Vercel](https://vercel.com/changelog/automated-security-audits-now-available-for-skills-sh). HoneySkill ne revendique pas l’invention de ce parcours.

Les README de [Cisco Skill Scanner](https://github.com/cisco-ai-defense/skill-scanner) et [vercel-labs/skills](https://github.com/vercel-labs/skills) indiquent respectivement Apache-2.0 et MIT. Aucun code de ces dépôts n’a été repris dans ce travail de recherche. Cisco constitue une référence de comparaison **non exécutée**, sans version de runtime installée ou résultat concurrent attribué à ce projet. Une comparaison ultérieure devra figer sa version et enregistrer sa commande, sa configuration et ses résultats.

Le corpus structure les règles et leurs explications. Il n’entraîne aucun modèle et ne garantit pas une amélioration de détection par sa simple présence. Les métriques d’autres éditeurs ne sont pas réutilisées comme performances du MVP.
