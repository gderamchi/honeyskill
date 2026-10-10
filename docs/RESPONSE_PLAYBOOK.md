# Playbook opérateur

1. **Alerte avant activation.** L’installation reste suspendue et le paquet en quarantaine. Lire la conséquence financière, puis les preuves avec fichier et lignes : `skillgate inspect <scan-id>`. L’UI locale montre le même rapport. Vérifier couverture et limites même lorsqu’une alerte critique est présente.
2. **Version légitime après revue.** Préférer une version corrigée et relancer `skillgate add <source>`. Sans anomalie dans le profil complet choisi, elle est installée automatiquement. Une exception passe par `skillgate approve <scan-id>`, terminal interactif et confirmation complète liant ID, empreinte et destination. Entrée seule annule. Le statut demeure « installé avec exception ».
3. **Mise à jour dangereuse.** `skillgate update <name>` conserve la version antérieure. Examiner le nouveau rapport ; aucune exception précédente ne s’applique. Le snapshot refusé n’est pas le dossier actif.
4. **Risque découvert après installation.** Considérer que le composant a pu être exécuté. Un humain doit désactiver/retirer le skill, examiner les accès éventuellement exposés et décider des mesures adaptées chez les fournisseurs concernés. SkillGate ne révoque aucune clé et n’annule aucune transaction. Conserver ou exporter les preuves avant suppression.

L’opérateur mentionné dans le journal est un identifiant local déclaré, pas une identité d’entreprise vérifiée. Les fichiers locaux sont modifiables par leur propriétaire. Une empreinte prouve une correspondance de contenu, pas l’exactitude du verdict.

Le CLI et l’UI sont les seuls canaux de notification implémentés. Aucun email, Slack ou mécanisme d’alerte externe n’est intégré.

## Données

`skillgate export --json` exporte configuration, rapports et installations, sans le contenu brut des snapshots. Les rapports peuvent néanmoins contenir des extraits sensibles : les conserver localement et ne pas les publier sans revue. La quarantaine contient les fichiers originaux ; son accès est privé au compte local.

La durée de conservation des rapports inactifs est configurable à l’initialisation. La suppression explicite via la commande de purge et ses limites sont décrites dans le README. Ne pas effacer `.skillgate/snapshots` tant qu’un lien actif pointe dedans. Pour supprimer tout le projet de test, arrêter l’UI puis supprimer sa racine temporaire complète.
