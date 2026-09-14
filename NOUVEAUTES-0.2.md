# Luma 0.2 — Communautés et conversations enrichies

## Fonctions ajoutées

- Communautés sur invitation, chacune avec des salons thématiques et un salon d’annonces.
- Propriétaire, modérateurs et membres ; seul le propriétaire attribue les rôles. Les annonces et la création de salons sont réservées aux responsables.
- Invitations renouvelables : un nouveau code invalide le précédent, sans retirer les membres déjà présents.
- Fils de discussion rattachés aux messages, pour séparer les réponses du fil principal.
- Six réactions par emoji avec compteurs et possibilité de retirer sa réaction.
- Sondages anonymes à un choix, de 2 à 8 réponses ; changement de vote et clôture par l’auteur ou un responsable.
- Messages épinglés par les responsables, favoris personnels et modification de ses propres messages.
- Recherche côté serveur dans l’historique du salon, jusqu’à 50 résultats par recherche.
- Chargement progressif de l’historique, par pages de 80 messages, avec curseur stable.
- Messages programmés et fichiers disponibles dans les nouveaux salons.
- Accès aux outils enrichis pour les conversations privées, depuis l’icône de sondage de leur en-tête.

## Plateformes

Le site et le client desktop existant ouvrent la nouvelle version. Le code React Native propose l’accès aux communautés dans une vue web intégrée authentifiée ; les écrans natifs de conversation sont conservés. Les bundles Android et iOS sont reconstruits. La signature et les essais sur appareils restent à effectuer.

## Vérifications

Tests des vrais gestionnaires API avec SQLite et adaptateurs D1/R2 : espaces privés, invitations, rotation des codes, rôles, restrictions des annonces (texte, fichiers et sondages), fils, réactions idempotentes, modification réservée à l’auteur, épingles, votes anonymes, changement de vote, clôture, favoris privés, recherche et pagination. Les tests de la messagerie précédente passent également.

La nouvelle migration ajoute des tables et colonnes sans réécrire la migration publiée ni supprimer les messages existants. Le parcours des nouvelles communautés avec plusieurs vrais comptes en production n’a pas été testé. Aucune mesure de charge ni comparaison de performances avec WhatsApp, Discord ou Telegram n’est revendiquée.

Un test dans le moteur Cloudflare de prévisualisation a confirmé la création d’une communauté, l’enregistrement d’un sondage et la persistance d’un vote avec un compte fictif local.

## Limites

Le site conserve son accès privé : partager un code de communauté ne suffit pas à autoriser une personne à ouvrir le site. Les salons vocaux, appels, partage d’écran, bots, notifications push et chiffrement de bout en bout restent à développer. Les salons d’annonces n’exposent pas de permission personnalisable par utilisateur. Limites de cette version : 30 communautés créées par utilisateur, 50 salons par communauté, 500 membres par communauté, 20 épingles affichées et 100 favoris affichés par salon. Les fils montrent les 80 derniers éléments.

Les votes sont anonymes pour les participants via l’interface et l’API ; la base conserve l’identifiant du votant pour garantir un seul vote par personne. Ce n’est pas un scrutin cryptographiquement anonyme vis-à-vis de l’administrateur de la base.

## Inspirations

[Salons et fils Discord](https://support.discord.com/hc/en-us/articles/4403205878423-Threads-FAQ), [rôles Discord](https://discord.com/blog/how-to-set-up-your-servers-roles-for-members-mods-admins), [sujets et sondages Telegram](https://telegram.org/blog/topics-in-groups-collectible-usernames/pl?setln=en).
