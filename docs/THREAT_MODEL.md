# Modèle de menace et limites

## Actifs et adversaire

Les actifs potentiellement exposés sont les fonds, autorisations de dépense, secrets de wallets et comptes de paiement auxquels l’agent hôte aurait déjà accès. SkillGate ne lit pas ces actifs réels. L’adversaire fournit un paquet de skill trompeur : instructions, scripts, références et fichiers de support.

La frontière contrôlée est `skillgate add` et `skillgate update`. Copies manuelles, autres installateurs, modifications postérieures à l’installation et processus disposant des mêmes droits utilisateur restent hors de cette frontière. Un prompt terminal n’établit pas cryptographiquement une présence humaine. Un utilisateur local peut modifier la configuration, les rapports ou les snapshots.

## Garanties testables

- Aucune exécution du code collecté ; pas de téléchargement depuis les liens trouvés dans un skill.
- Rejet des liens entrants, fichiers spéciaux et chemins ambigus ; limites d’inventaire visibles.
- Empreinte des octets réellement analysés et vérification avant activation.
- Installation risquée retenue ; mise à jour rejetée sans remplacer la version active.
- Aucun feu vert en cas d’échec d’analyse obligatoire, de provider invalide ou de couverture insuffisante.
- UI locale sans écriture et sans API de lecture arbitraire de fichiers ni proxy réseau.

## Limites de détection

Le moteur natif est un ensemble fini d’heuristiques textuelles avec corrélation de preuves. Il ne prouve pas le flot de données complet d’un programme, ne désobfusque pas toutes les charges et n’exécute pas de sandbox dynamique. Des reformulations, langues, alias, encodages et chaînes indirectes peuvent lui échapper. Les exemptions pédagogiques ne rendent pas les déclarations d’un paquet fiables. Les allowances larges déclarées et les actions financières voulues exigent une interprétation contextuelle ; les heuristiques ont des faux positifs et négatifs visibles dans le benchmark.

`complete_for_supported_checks` signifie uniquement que les contrôles pris en charge ont pu lire le paquet dans les limites annoncées. Ce statut ne signifie jamais que son comportement entier est sûr. Une adresse publique seule n’établit aucune malveillance. Les sévérités ne sont pas des probabilités calibrées.

Le profil hybride reste optionnel. L’expurgation des secrets apparents avant envoi est imparfaite ; l’opérateur doit consentir au transfert de contenu et au coût API. Aucun appel réel n’a été autorisé durant ce build. L’API implémentée et les réponses simulées de tests ne constituent pas une validation de détection par un modèle réel.

## Collecte

Sources prises en charge : dossiers locaux et dépôts publics HTTPS `github.com/owner/repo`, avec `/tree/revision/sous-dossier` ou sélection explicite. Collecte limitée à l’API GitHub, redirections refusées, commits résolus avant lecture de blobs. Pas d’archives, réseau privé, localhost ou URL arbitraire. L’API GitHub peut limiter les requêtes anonymes ; un échec n’autorise rien.

Limites natives : 256 fichiers, 2 MiB par paquet, 256 KiB par fichier, profondeur 12 et 20 secondes d’inventaire/collecte. La couverture indique les fichiers ignorés, références non résolues et limites atteintes. La réception d’une archive est refusée sans extraction : la limite ne repose pas sur la confiance dans sa taille déclarée.

## Ce que le prototype ne répare pas

Aucune révocation de clé, récupération de fonds, annulation de transaction, vérification universelle d’un bénéficiaire ou interception de wallet. Après une activation avec exception, un skill peut nuire selon les permissions de l’agent. Une ancienne version conservée ne remet pas à zéro les effets d’une version déjà exécutée.
