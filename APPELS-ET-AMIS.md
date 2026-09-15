# Amis et appels — état de livraison

Fonctions web : demandes d'amis par e-mail (recherche désactivée par défaut), lien/QR renouvelable, lecture QR caméra et image locale, acceptation/refus, discussion privée partagée, appels WebRTC à deux, micro/caméra, remplacement de la vidéo par l'écran, soundboard mixée à la piste audio sortante. Les appels entrants apparaissent tant qu'une page Luma est ouverte et visible ; il n'y a pas de notification push quand l'application est fermée.

## Connectivité à compléter

Aucun fournisseur d'appels n'est encore souscrit. Par défaut, `iceServers` est vide : seuls les chemins de connexion directs accessibles peuvent fonctionner. Ne pas annoncer une fiabilité Internet générale. Un relais TURN est nécessaire pour couvrir les réseaux contraints ; une validation sur deux appareils et réseaux distincts reste obligatoire.

Le serveur lit la variable privée d'hébergement `LUMA_ICE_SERVERS`, une liste JSON de configurations RTCIceServer (`urls`, et si nécessaire `username`/`credential`). Ne jamais y placer une clé d'administration de fournisseur. Les identifiants TURN fournis au navigateur doivent être limités et de courte durée. Pour la production, remplacer cette configuration statique par une émission de jetons temporaires côté serveur via le fournisseur choisi, avec authentification et quotas. Les contrats, localisations et transferts doivent être ajoutés au dossier RGPD avant activation du fournisseur.

L'application permet actuellement la connexion directe sans relais ; les adresses IP des participants peuvent être révélées au correspondant. Un déploiement imposant la confidentialité des adresses IP devra exiger TURN et `iceTransportPolicy: 'relay'`, après configuration et validation.

## Limites explicites

- Appels à deux amis acceptés, pas de conférence de groupe ni de téléphone classique.
- Un appel simultané par personne, 90 secondes pour répondre après l'offre, une heure maximum après acceptation.
- Signalisation authentifiée et conservée temporairement en D1 ; expiration logique puis purge lors des requêtes. Ajouter une purge planifiée et une supervision avant ouverture publique.
- Le micro et la caméra ne sont activés qu'après une action de l'utilisateur et la permission du navigateur. Le son système n'est pas partagé ; seul l'écran vidéo est transmis. Le support du partage d'écran varie selon le navigateur et l'appareil.
- Soundboard : quatre sons synthétiques, un fichier temporaire de 10 secondes / 3 Mo maximum, volume réglable et arrêt. Aucun téléversement ni bibliothèque persistante de sons. Couper le micro ne coupe pas les sons ; leur commande d'arrêt et leur volume sont distincts.
- La connexion privée Sites reste obligatoire : l'invitation d'ami n'ajoute pas d'accès au site.
- Le retrait/refus suspend les nouvelles demandes de cette paire de comptes pendant 24 heures. Annuler sa propre demande permet de la renouveler. Retirer un ami lui retire l’accès aux publications, mais n’efface pas la conversation passée et ne bloque pas les messages.
- Les sources desktop demandent une confirmation native pour micro/caméra et un choix explicite de fenêtre/écran. Remplacer l'ancienne version portable pour bénéficier de ces permissions.
- Les sources mobiles doivent être recompilées/signées et les permissions testées sur Android/iOS. La publication web ne fabrique pas de nouvelles applications de stores.

## Vérifications de livraison

Tests serveur : recherche par e-mail volontaire, doublons, acceptation réservée au destinataire, rotation QR, exclusion d'un tiers des appels, cycle offre/réponse/fin, contrôle d'origine, fermeture RGPD et préservation des autres comptes. Compilation TypeScript et production.

Ces tests ne démontrent pas une transmission audiovisuelle réelle entre appareils. Recette avant production : deux comptes autorisés, deux navigateurs/appareils, même réseau puis réseaux différents avec TURN ; refus des permissions ; appel ignoré, refusé, interrompu ; caméra activée après appel vocal ; partage d'écran démarré/arrêté ; son personnalisé entendu à distance et arrêt ; départ de page sans micro restant actif ; mise en veille mobile ; inspection des permissions OS.
