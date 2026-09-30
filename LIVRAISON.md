# Luma — état de livraison

Luma comprend un site Next.js, une API connectée à PostgreSQL, une application Electron et une application React Native/Expo. Le déploiement principal utilise Docker Compose dans Coolify.

## Fonctions disponibles

- Comptes natifs par e-mail et mot de passe, sessions multiples et déconnexion.
- Fil privé entre amis, profils, photos, vidéos, commentaires et mentions J’aime.
- Ajout d’amis par e-mail, lien ou carte QR.
- Messages privés et groupes, fichiers, réponses, favoris et messages programmés.
- Communautés avec rôles, salons textuels, annonces, fils, réactions, sondages, épingles, invitations et bots intégrés.
- Appels audio/vidéo, appels de groupe, salons vocaux, partage d’écran sur bureau/Web compatible et soundboard.
- Tableau de bord administrateur avec gestion des comptes, communautés, conversations, appels, signalements et journal d’actions.
- Personnalisation du thème, densité, contraste, taille du texte et réduction des animations.
- Export, rectification et fermeture du compte depuis « Mes données ».

## Versions installables

- Android 0.3.6 de test.
- Windows 0.3.5 de test.
- Sources iOS présentes; signature et distribution Apple encore nécessaires.

## Vérifications effectuées

- Compilation Next.js de production et TypeScript.
- ESLint sans erreur.
- Tests PostgreSQL des comptes, permissions, messages, fichiers, communautés, réseau social, vie privée, appels et salons vocaux.
- Tests du tableau de bord administrateur et de ses protections.
- Test WebRTC dans deux clients réels : audio bidirectionnel, caméra, partage d’écran et groupe.
- Export Expo Android et compilation APK GitHub Actions.

## Limites avant une ouverture publique

- Compléter l’identité légale, l’adresse et le contact dans `lib/privacy-config.ts`.
- Définir les durées de conservation et automatiser les purges et sauvegardes.
- Mettre en place supervision, alertes, tests de restauration et audit de sécurité.
- Tester les appels sur appareils physiques et réseaux distincts.
- Ajouter les notifications push et le traitement natif des appels en arrière-plan.
- Finaliser la signature de production et les fiches Apple/Google/Microsoft.

Les détails d’exploitation sont dans [README.md](README.md), ceux des appels dans [APPELS-ET-AMIS.md](APPELS-ET-AMIS.md) et les décisions RGPD restantes dans [PRODUCTION-RGPD.md](PRODUCTION-RGPD.md).
