# Amis et appels — état actuel

## Amis

- Recherche exacte par e-mail, désactivée par défaut pour chaque compte.
- Carte de contact avec lien et QR code renouvelable.
- Lecture du QR code avec la caméra ou depuis une image locale.
- Demandes reçues et envoyées, acceptation, refus, annulation et retrait.
- Création automatique d’une discussion privée commune après acceptation.
- Accès direct au profil, au message, à l’appel audio et à l’appel vidéo depuis la carte d’un ami.

Le refus ou le retrait suspend les nouvelles demandes entre les deux comptes pendant 24 heures. Retirer un ami lui retire l’accès aux publications privées, mais ne supprime pas automatiquement l’historique de conversation.

## Appels

- Appels audio et vidéo à deux.
- Appels de groupe et salons vocaux de communauté.
- Activation ou désactivation du micro et de la caméra pendant l’appel.
- Partage et restauration de l’écran sur le Web compatible et l’application bureau.
- Réduction du bruit, suppression de l’écho et préférences de caméra.
- Soundboard synthétique et son local temporaire de dix secondes maximum.
- Sonnerie Web; sonnerie et vibration natives lorsque l’application Android est active.

Le navigateur envoie directement la piste du micro. L’audio distant utilise un élément séparé de la vidéo afin qu’une caméra inactive ne coupe pas le son. Les clients échangent les offres, réponses et candidats WebRTC par une signalisation authentifiée conservée temporairement dans PostgreSQL.

## Connectivité

Le déploiement Docker démarre Coturn avec un secret partagé. `LUMA_ICE_SERVERS` fournit les serveurs ICE aux clients; `LUMA_TURN_PUBLIC_IP` et `SERVICE_PASSWORD_64_TURN` configurent le relais. Les ports `3478/tcp`, `3478/udp` et `49160-49200/udp` doivent être accessibles.

Sans TURN joignable, certains réseaux mobiles, réseaux d’entreprise et routeurs NAT symétriques empêchent l’appel. En connexion directe, le correspondant peut recevoir l’adresse IP publique du participant.

## Limites connues

- Android peut recevoir un partage d’écran, mais sa WebView ne peut pas démarrer MediaProjection. L’émission depuis Android nécessitera un moteur WebRTC natif.
- La sonnerie native Android fonctionne lorsque l’application est active. Une sonnerie lorsque l’application est fermée nécessitera APNs/FCM et un service d’appel natif.
- Le partage transmet la vidéo de l’écran sans audio système.
- Les appels ne sont pas enregistrés par Luma.
- Un appel à deux expire après 90 secondes sans réponse et dure au maximum une heure après acceptation.

## Vérifications automatisées

`scripts/test-call-ui.cjs` lance deux clients Electron isolés avec micro et caméra synthétiques et vérifie :

- l’énergie audio reçue dans les deux sens;
- l’activation de la caméra pendant un appel;
- le partage puis la restauration de l’écran;
- les mêmes scénarios dans un salon de groupe.

Les tests serveur couvrent en plus les autorisations, la présence de groupe, la confidentialité de la signalisation et la fin des salles. Une recette sur deux téléphones physiques et deux réseaux différents reste nécessaire avant une ouverture publique.
