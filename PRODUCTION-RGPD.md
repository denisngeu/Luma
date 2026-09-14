# Luma — décision de lancement

État au 14 septembre 2026 : **préparation privée, lancement avec des utilisateurs réels non validé**. Ce dossier ne constitue ni une certification RGPD ni un avis juridique. Ne pas présenter le produit comme « conforme RGPD » sur la seule base de ces changements.

## Réalisé dans cette livraison

- Notice publique dans l'application `/confidentialite`, liée à la connexion et au compte.
- Espace authentifié `/mes-donnees` : rectification du nom, export JSON paginé et limité aux données du compte, fermeture et effacement des contenus actifs.
- Suppression des messages et de leurs dépendances dans une transaction. Suppression des fichiers R2 reprenable, avec file persistante. Les fichiers sont inaccessibles dès la suppression de leur message.
- Compte fermé bloqué pour empêcher une recréation automatique par les requêtes de session. Identifiant technique conservé : ce n'est **pas** un effacement intégral de toutes les données personnelles.
- Protection des insertions tardives par déclencheurs SQLite. La migration 0002 contient des déclencheurs complémentaires au schéma Drizzle : les préserver dans les migrations futures.
- Transfert de communauté avant fermeture pour préserver les droits des autres membres. Les messages des autres personnes restent intacts.
- Réponses sensibles sans cache, refus des opérations inter-origines, noms de fichiers servis en téléchargement, pas de journalisation brute des exceptions applicatives.
- Aucun traceur publicitaire ou d'audience ajouté au code. Cela ne dispense pas de vérifier les mécanismes de la plateforme et des applications natives.

## Conditions bloquant une ouverture

1. **Exploitant et contact** : renseigner `lib/privacy-config.ts` (identité légale, adresse, e-mail réellement suivi). Compléter les mentions légales selon le statut juridique, coordonnées de l'hébergeur et directeur de publication, et les conditions du service. Déterminer le public et la gestion des mineurs.
2. **Contrats et transferts** : vérifier les rôles réels de ChatGPT/Sites et Cloudflare, entités contractuelles et sous-traitants ultérieurs, accords article 28, lieux de traitement, accès de support hors EEE, mécanisme de transfert et analyse complémentaire si nécessaire. Ne pas supposer une résidence UE.
3. **Conservation** : choisir et justifier les durées des messages, fichiers, comptes inactifs, identifiants des comptes fermés, journaux et sauvegardes. Implémenter une tâche de purge planifiée côté hébergement, supervisée, avec reprise, et un traitement automatique de `erasure_files`. Actuellement la file est traitée depuis la page de l'utilisateur : ce mécanisme seul ne suffit pas pour une exploitation sans surveillance. Ne lancer aucune purge des données existantes sans avoir arrêté la politique.
4. **Droits complets** : mettre en service le contact, la réception et le suivi des demandes (accès aux fichiers, copies/citations par des tiers, effacement résiduel, opposition, limitation). L'export JSON ne contient pas les octets des pièces jointes. Fournir les fichiers séparément ou ajouter une archive complète et vérifier les gros volumes. Répondre en principe dans un mois ; documenter toute extension motivée.
5. **Sécurité opérationnelle** : test d'intrusion, revue des autorisations en concurrence, limites de débit et anti-abus, traitement des fichiers malveillants, supervision/alertes, restauration testée, contrôle et révocation des sessions, accès administrateurs minimaux avec authentification forte, correctifs et inventaire des dépendances. Valider CSP compatible avec le rendu, les WebViews et l'intégration Sites. Les protections ajoutées ne remplacent pas cet audit.
6. **Traçabilité et incidents** : journaux de sécurité minimisés et protégés avec durée justifiée, registre des violations, responsables d'astreinte et moyens d'alerte testés. Ne pas journaliser le corps des messages, jetons ou contenus exportés. Notification CNIL sous 72 h lorsque le risque le requiert ; information des personnes en cas de risque élevé, sous réserve des exceptions prévues.
7. **Analyse juridique** : confirmer finalités et bases légales, documenter l'intérêt légitime si retenu, évaluer nécessité d'une AIPD et désignation d'un DPO selon les critères applicables. Une messagerie n'implique pas automatiquement ces obligations, mais son échelle, ses publics et ses usages peuvent les déclencher.
8. **Applications natives** : finaliser builds signés et distribution, politique de confidentialité accessible dans les stores, déclarations de collecte Apple/Google exactes, parcours de fermeture et demandes de suppression accessibles depuis les apps. Pas de lancement natif certifié par cette livraison web.

## Registre de traitements à finaliser

| Traitement | Données | Finalité / base proposée à confirmer | Destinataires | Conservation |
|---|---|---|---|---|
| Compte | Identifiant plateforme, nom ; e-mail reçu en session | Fourniture du service / contrat | Exploitant, prestataires d'accès et d'hébergement | À définir, comptes fermés inclus |
| Messagerie | Textes, fichiers, métadonnées, groupes, rôles | Fourniture des fonctions demandées / contrat | Membres autorisés, exploitants habilités | À définir et automatiser |
| Interactions | Favoris, réactions, votes liés au compte | Fourniture du service / contrat | Visibilité selon fonction, prestataires | À définir |
| Sécurité | Événements techniques minimisés | Protection du service / intérêt légitime à documenter | Personnel habilité, hébergeurs | À déterminer contractuellement |
| Exercice des droits | Demande, preuve limitée d'identité, décision | Respect des obligations légales | Personnes habilitées à traiter les demandes | À définir et justifier |

Responsable opérationnel de chaque ligne, localisation, mesures de sécurité, contrats, transferts et pièces justificatives à ajouter au registre interne. Ne pas publier les détails de sécurité internes.

## Procédure pour une demande

Accuser réception ; vérifier l'identité proportionnellement au risque ; noter date/échéance ; délimiter les systèmes et prestataires concernés ; préserver les droits des tiers ; exécuter et vérifier ; répondre avec le résultat et les limites motivées ; conserver uniquement la preuve nécessaire. Ne pas demander systématiquement une copie de pièce d'identité.

## Sources officielles

- https://www.cnil.fr/fr/passer-laction/rgpd-les-premieres-etapes
- https://www.cnil.fr/fr/passer-laction/les-droits-des-personnes-sur-leurs-donnees
- https://www.cnil.fr/fr/passer-laction/les-durees-de-conservation-des-donnees
- https://www.cnil.fr/fr/clauses-contractuelles-types-entre-responsable-de-traitement-et-sous-traitant
- https://www.cnil.fr/fr/transferts-de-donnees-hors-ue-le-cadre-general-prevu-par-le-rgpd
- https://www.cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi
- https://www.cnil.fr/fr/securite-gerer-les-incidents-et-les-violations
