# Responsabilités et rapprochement DORA

SkillGate Finance est un prototype de contrôle avant installation. Ce document ne constitue ni une certification, ni un audit réglementaire, ni un conseil juridique personnalisé. Il ne permet pas d’afficher « conforme DORA ».

Le [règlement (UE) 2022/2554, article 2](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2554) définit les entités concernées et des exceptions. Il vise notamment certains prestataires de services sur crypto-actifs autorisés; utiliser un wallet ou développer un agent ne suffit pas à conclure qu’une personne est assujettie. Texte officiel consulté le 10 octobre 2026, référence `SRC-11`.

## Rapprochement limité

Les thèmes ci-dessous sont issus du [texte officiel, articles 5, 9, 10 et 17](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2554). La colonne centrale décrit des éléments du prototype à examiner, pas une satisfaction automatique de l’article.

| Thème du texte | Éléments SkillGate à examiner | Écart qui reste à traiter dans une organisation |
| --- | --- | --- |
| Article 5: gouvernance, responsabilité et rôles | Décision d’exception et chronologie locale | Identité vérifiée, délégations, séparation des rôles et contrôle organisationnel. |
| Article 9: protection et changements contrôlés | Analyse avant activation, snapshot vérifié, mise à jour retenue | Politique globale de changement, droits d’exécution, autres installateurs et systèmes. |
| Article 10: détection et tests | Constats, preuves et benchmark reproductible | Surveillance en exécution, risques non couverts et efficacité en environnement réel. |
| Article 17: gestion, traçabilité et suivi des incidents | Rapport local et playbook de réponse | Qualification d’un incident, escalade, communication et signalements applicables. |

Ce rapprochement porte seulement sur ces thèmes. Aucun examen exhaustif du règlement, de ses textes techniques ou des obligations d’une entité n’a été réalisé.

## Qui décide et quelle preuve est produite

Le système propose une décision à partir de contrôles annoncés et de leur couverture. L’opérateur choisit un profil et assume l’éventuelle exception. Le propriétaire de l’environnement conserve la responsabilité des permissions d’exécution, des installations extérieures à SkillGate et de la réaction après une exposition réelle. L’état d’implémentation et les exécutions vérifiées sont consignés dans `BUILD_STATUS.md`.

Un identifiant local déclaré ne vérifie pas une identité d’entreprise. Le journal local est modifiable par son propriétaire. Une empreinte lie un rapport à des octets; elle ne prouve ni l’exactitude de l’analyse ni la légitimité de l’auteur. Une analyse statique complète pour les contrôles pris en charge ne signifie pas que tous les comportements sont sûrs. Une exception sur une version ne vaut pas pour ses mises à jour.

Le contrôle se limite aux acquisitions et activations effectuées par SkillGate. Il ne révoque aucune clé, ne bloque pas toutes les transactions, ne récupère aucun transfert et ne remplace pas l’isolation de l’agent. Après découverte d’un risque postérieur à l’installation, appliquer le playbook et faire examiner les accès réellement exposés par un opérateur.

## Données locales et envoi externe

Les rapports peuvent contenir des extraits du paquet, des noms de fichiers, des origines publiques, des empreintes et des décisions locales. Ils doivent être traités comme potentiellement sensibles. Ne pas inscrire de secret réel dans les motifs d’exception. Une démo ou un export partagé doit utiliser des données fictives ou être relu avant diffusion. Aucun rapport brut ni donnée sensible n’est ancré dans un registre public.

L’analyse statique n’a pas besoin d’envoyer le contenu du skill à un modèle. L’acquisition d’une source GitHub publique implique son téléchargement. Un mode hybride exige un consentement explicite à l’envoi et une configuration de fournisseur; la sélection de ce profil ne vaut pas autorisation de dépense dans la mission de développement. Une étape sémantique absente ou invalide doit rester visible et retenir l’installation automatique. Le filtrage des secrets apparents avant envoi ne peut pas promettre une redaction parfaite.

L’export doit préserver la distinction entre résultats exécutés et scénarios; la suppression doit tenir compte des snapshots encore actifs. La durée de rétention est un choix opérateur, pas une durée réglementaire déterminée par ce document. Les commandes et limites réellement disponibles sont documentées dans le README et vérifiées dans `BUILD_STATUS.md`; ce document n’atteste pas à lui seul leur fonctionnement.

## Responsabilités de remise

Avant une utilisation organisationnelle, faire vérifier l’assujettissement et les obligations applicables, fixer les responsabilités et la politique de conservation, et éprouver le contrôle dans l’environnement cible. Pour ce hackathon, présenter le périmètre, les échecs observés, les limites du benchmark interne synthétique et les intégrations non exécutées. Aucun montant fictif de la démo ne constitue une économie réelle démontrée.
