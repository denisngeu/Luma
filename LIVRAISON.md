# Luma — première version de développement

Luma contient une application web, un client mobile React Native Android/iOS et un client desktop Electron. Cette livraison constitue une base fonctionnelle de messagerie, pas une équivalence complète à WhatsApp.

## Ce qui est implémenté

- Discussions à deux et groupes sur invitation (jusqu’à 256 membres).
- Messages conservés côté serveur, actualisation toutes les 3 secondes.
- Messages programmés : visibles aux destinataires à partir de l’heure prévue ; aucune notification en arrière-plan.
- Réponses avec référence à un message et favoris personnels.
- Fichiers de 20 Mo maximum ; accès réservé aux membres de la discussion.
- Recherche de discussions, thème clair/sombre, interface responsive en français.
- Écrans mobiles natifs de liste, création de groupe et conversation ; connexion et fonctions avancées via une vue web intégrée.
- Application Windows portable. Projets de packaging macOS et Linux présents, non construits.

Les exemples affichés avant connexion sont fictifs. Aucun accusé de lecture ou indicateur de présence n’est simulé. La coche simple signifie que le message est enregistré.

## Limites actuelles

Les appels audio/vidéo, messages vocaux, statuts, notifications push, chiffrement de bout en bout, connexion par téléphone, import du carnet d’adresses, blocage/signalement, administration des groupes, suppression/modification des messages, sauvegardes et pagination au-delà des 200 derniers messages restent à développer. La synchronisation utilise des requêtes périodiques et ne constitue pas encore une infrastructure à grande échelle.

Le site est publié en accès privé pour son propriétaire. Les invitations internes ne donnent pas accès au site lui-même. Une décision de partage et une validation de l’authentification grand public sont nécessaires avant utilisation avec d’autres personnes.

L’accès actuel utilise la connexion ChatGPT fournie par l’hébergeur. Le client mobile conserve cette session dans sa vue web de connexion ; aucun mot de passe ni jeton n’est copié dans le code natif. Le parcours de connexion mobile doit être vérifié sur de vrais appareils, notamment avec les fournisseurs de connexion qui refusent les navigateurs intégrés.

## Vérifications effectuées

- Compilation et vérification TypeScript du site.
- Vérification TypeScript et génération des bundles Android/iOS avec Expo.
- Inspection du rendu web sur un petit écran, navigation et brouillon WebMCP ; refus d’un brouillon vide vérifié.
- Tests des vrais gestionnaires API avec SQLite et adaptateurs D1/R2 : authentification requise, accès réservé aux membres, capacité des discussions à deux, programmation, favoris privés, fichiers et contrôle d’origine.

Le moteur Cloudflare local redémarre lors du premier accès D1 dans cet environnement Windows. Les tests de service sont donc exécutés avec des adaptateurs locaux ; ils ne valident pas le runtime Cloudflare ni les échanges entre appareils en production. Les binaires mobiles signés ne sont pas générés et aucune application n’est soumise aux stores.

## Démarrer le développement

### Web

À la racine : `npm run install:ci`, `npm run dev`.
La connexion de développement fournit un utilisateur fictif, uniquement sur localhost. Les en-têtes d’identité doivent être fournis et protégés par le dispatcher Sites en production : ne pas exposer directement ce Worker sur Internet en faisant confiance aux en-têtes envoyés par les clients.

Les tables sont définies dans `db/schema.ts`, les migrations dans `drizzle/`. `npm run db:generate` génère les migrations. Ne pas modifier une migration déjà appliquée en production.

Tests de service : `node scripts/test-service.mjs`. Les adaptateurs utilisent une base éphémère et des fichiers fictifs en mémoire. Test d’intégration du Worker : `node scripts/test-chat.mjs` avec un Worker de test sur le port 8787, jamais contre la production.

### Mobile

Dans `native/mobile` : `npm ci`, copier `.env.example` vers `.env`, puis `npm start`.
`npm run android` nécessite Java et le SDK Android ; `npm run ios` nécessite macOS et Xcode.
Le fichier `eas.json` prépare des profils APK de test et de publication. Les comptes Expo/Apple/Google, identifiants d’application définitifs et certificats restent à fournir avant une construction signée et une publication.

### Desktop

Dans `native/desktop` : `npm ci`, puis `npm start`. L’adresse du service se trouve dans `config.json`.
Les scripts `dist:win`, `dist:mac` et `dist:linux` produisent les formats de distribution sur les machines correspondantes. L’archive Windows portable fournie contient le moteur Electron et le code applicatif ; extraire le dossier entier avant d’ouvrir `Luma.exe`.

## Priorités pour une version publique

1. Valider les échanges multiutilisateurs sur l’hébergement choisi et la connexion sur appareils réels.
2. Ajouter idempotence des envois, pagination, gestion des erreurs et limites de débit robustes.
3. Définir une authentification mobile adaptée, la suppression de compte et la politique de conservation.
4. Intégrer appels/WebRTC, notifications APNs/FCM et messages vocaux avec tests réels.
5. Intégrer un protocole de chiffrement de bout en bout éprouvé, puis faire auditer le produit.
6. Préparer les signatures, fiches et exigences de publication des stores.

Références utilisées : [Expo SDK 55](https://docs.expo.dev/versions/v55.0.0/), [sécurité Electron](https://www.electronjs.org/docs/latest/tutorial/security).
