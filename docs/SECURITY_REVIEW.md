# Revue de sécurité du MVP

What this change does: SkillGate copie un paquet dans une quarantaine, analyse les octets collectés puis active un snapshot vérifié via un lien de projet. La revue vise ce chemin contrôlé et les lectures de l’UI locale, pas la sécurité complète du poste ni le comportement d’un modèle.

Revue effectuée le 10 octobre 2026 par un agent distinct de ceux qui implémentaient le moteur et le CLI, avec les workflows Ponytail Review et Repo Quality Gate. Il s’agit d’une revue interne au même projet et au même assistant, pas d’un audit externe indépendant. Charge visée: opérateur local avec plusieurs commandes concurrentes possibles.

## Problèmes reproduits puis corrigés

1. **P1 — Une déclaration de tutoriel masquait des instructions actives** (`packages/core/src/analysis.ts`, `activeLines`).
   - **What this is:** Le filtre distinguait les exemples défensifs des ordres à suivre.
   - **Problem:** Un simple titre « Security tutorial » supprimait toutes les lignes d’un bloc de code, même précédé d’une demande explicite d’exécution. Un paquet synthétique contenant collecte de clé, transmission et transfert caché a réellement obtenu `allow`, zéro constat, couverture complète et activation dans une cible temporaire.
   - **Fix:** La correction a supprimé la confiance dans le seul titre et exige un contexte local explicitement inerte pour exclure un bloc. Un test de régression couvre l’ordre actif maquillé en tutoriel.
   - **If we skip it:** Un éditeur hostile peut soustraire des instructions financières connues aux règles locales avec un simple intitulé.
   - **Retest:** Même reproduction après correction: `hold`, trois constats, aucune activation. Cette amélioration ne résout pas toutes les ambiguïtés du langage naturel.

2. **P2 — Le nom de skill `retention` bloquait la purge** (`packages/core/src/storage.ts`, `withTargetLock`; `packages/core/src/index.ts`, `pruneData`).
   - **What this is:** La purge et les installations utilisaient un verrou local.
   - **Problem:** Un rapport expiré pour un skill au nom valide `retention` reprenait le verrou déjà détenu par la purge. Le cas a réellement échoué avec `LOCKED` après environ trois secondes.
   - **Fix:** La correction sépare les espaces de noms des verrous de cible et de maintenance.
   - **If we skip it:** Ce rapport empêche l’application de la rétention sans intervention manuelle.
   - **Retest:** Test de régression « a skill named retention cannot collide with the housekeeping lock » réussi.

3. **P1 — Une référence distante obligatoire dans un fichier texte passait en couverture complète** (`packages/core/src/analysis.ts`, `checkReferences`).
   - **What this is:** La couverture signale les instructions requises absentes du paquet.
   - **Problem:** SKILL.md pouvait référencer `instructions.txt`, lui-même exigeant des instructions à une URL `.invalid`. La vérification distante limitée aux fichiers `.md` produisait `allow`, aucune référence non résolue et une activation réelle dans la cible temporaire.
   - **Fix:** Les vérifications de références portent désormais sur les fichiers textuels pris en charge, indépendamment de leur extension.
   - **If we skip it:** Déplacer une instruction dans une référence `.txt` transforme une analyse incomplète en autorisation automatique.
   - **Retest:** Test de régression « remote instructions in referenced plain text are incomplete and cannot auto-activate » réussi.

## Vérifications effectives

Commandes exécutées pendant cette revue:

```text
pnpm exec tsx work/security-review-repro.ts
pnpm exec tsx --test tests/server.test.ts
pnpm exec tsx --test tests/core.test.ts tests/server.test.ts
```

Dernier run ciblé: **24 tests exécutés, 24 réussis, zéro ignoré**. Ils couvrent notamment les deux parcours P0, l’exception liée à l’empreinte et à la destination, les mutations avant activation, les mises à jour retenues, les liens et chemins refusés, les limites, le profil hybride indisponible ou invalide, l’activation concurrente, la reprise, la rétention, les destinations non gérées, les preuves et l’affichage hostile.

Les vérifications HTTP ont réellement lancé le serveur sur loopback et testé session absente, hôte/origine incorrects, mutation refusée et routes arbitraires absentes. Les rapports HTML échappent les extraits hostiles. La lecture du code React n’a révélé aucun rendu HTML brut des contenus de skills; l’examen visuel desktop/mobile relève de la validation UI principale et n’est pas revendiqué comme réalisé par cette revue.

Une erreur `EACCES` a été injectée en retirant temporairement le droit d’écriture du dossier des enregistrements, après préparation d’une mise à jour légitime. Le pointeur actif avait déjà changé lorsque l’écriture du journal a échoué. Une lecture ultérieure des installations, après restauration des permissions, a réparé l’enregistrement à partir de la transaction préparée; une nouvelle tentative a réussi. L’ancien snapshot était conservé. **Une erreur tardive ne prouve donc pas qu’aucune activation n’a eu lieu**: examiner l’état et sa reprise avant de conclure à un échec sans effet.

Toutes les reproductions ont utilisé des racines temporaires explicitement créées pour les tests. Aucun code de skill n’a été exécuté; aucune clé réelle, aucun wallet et aucun endpoint d’attaque n’ont été utilisés. Les corrections n’ont pas modifié les 44 cas gelés. Empreinte inchangée de `evaluation/cases.json`: `a75fff4675bf8020c603dc8ab6a1307f2dc63d700f8f27e939490f868a036446`.

## État relu

Les empreintes permettent de distinguer cette revue d’une future version; un nouveau changement exige une validation adaptée.

| Fichier | SHA-256 au terme de la revue |
| --- | --- |
| `packages/core/src/analysis.ts` | `45c66047fac5407595bf2fcb3f59585ffb455eac36c821e4baf40cc3da51193c` |
| `packages/core/src/acquisition.ts` | `39b6d9ff52475c8893457413ccdb138240240716e6d66470338d2e76fddd40ab` |
| `packages/core/src/storage.ts` | `4b50e96959db8f12c65e8f1ff911f1408fb92334a093aa79a0ae0bafd1036078` |
| `packages/core/src/index.ts` | `aef1e0301e84921aca43598e074db1837724808f6d65346547d3a84fe92a7dd2` |
| `apps/cli/src/index.ts` | `2a80ebf87485be224aef3feb6cd12e0bd3e7159c5a779897f0f6be71bbf6f011` |
| `apps/cli/src/server.ts` | `b962dad0dfed2b99b3ed93a9503e07f5fa6a53f69fdb09115b06d0ed003bbddf` |
| `apps/cli/src/report.ts` | `96a70b5c5f0942efaf33ed5a228975075f1ffdbe6f6506ea15ae99fbbe500bf5` |

Verdict: les trois problèmes reproduits sont corrigés sur l’état relu; aucune certification de sécurité ni validation de production.

Not checked: provider payant réel, efficacité face à un corpus malveillant indépendant, épuisement massif des ressources, coupure matérielle en pleine écriture, adversaire disposant des droits du propriétaire système, contrôle d’exécution de Codex et sécurité des transactions financières réelles.

## Correction complémentaire après la revue

Le cas d’écriture tardive signale maintenant le code `ACTIVATED_RECOVERY_REQUIRED` et annonce explicitement que le snapshot vérifié est actif. Un test supplémentaire injecte EACCES après renommage du pointeur, vérifie la transaction préparée puis sa reprise. Le validateur final enregistre les empreintes de cette version dans `outputs/validation.json` ; les empreintes ci-dessus restent celles de l’état relu précédemment.
