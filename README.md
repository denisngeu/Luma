# Luma

Luma est une messagerie privée et un réseau social réunissant conversations à deux et en groupe, fil entre amis, profils, demandes par e-mail ou QR code, communautés, salons textuels et vocaux, appels audio/vidéo, partage d’écran et soundboard.

## Architecture actuelle

- `app/` contient le site Next.js 16 et ses API.
- `postgres/` contient les migrations PostgreSQL appliquées au démarrage.
- `native/desktop/` contient l’application Electron pour Windows, macOS et Linux.
- `native/mobile/` contient l’application React Native/Expo pour Android et iOS.
- Les pièces jointes sont conservées dans le répertoire privé défini par `LUMA_UPLOAD_DIRECTORY`.
- Les appels utilisent WebRTC. Le service Coturn du fichier `docker-compose.yaml` relaie les flux lorsque la connexion directe échoue.

L’authentification de production est native à Luma : adresse e-mail, mot de passe dérivé avec PBKDF2-SHA-256, session stockée sous forme d’empreinte et cookie `HttpOnly`, `SameSite=Lax`, `Secure` derrière HTTPS.

## Développement

Prérequis : Node.js 22.13 ou plus récent et une base PostgreSQL accessible.

```powershell
npm ci
$env:DATABASE_URL='postgresql://utilisateur:mot-de-passe@localhost:5432/luma'
npm run dev
```

L’application locale écoute sur `http://localhost:5173`. Les migrations peuvent être appliquées séparément avec :

```powershell
npm run db:migrate
```

Vérifications principales :

```powershell
npm run lint
npx tsc --noEmit
npm run build
node scripts/test-postgres.mjs
node scripts/test-admin.mjs
```

`scripts/test-call-ui.cjs` exécute deux clients Electron invisibles avec un micro et une caméra synthétiques. Il vérifie l’audio bidirectionnel, l’activation de la caméra pendant l’appel, le partage/restauration d’écran et les salons de groupe.

## Docker et Coolify

Le déploiement utilise `Dockerfile` et `docker-compose.yaml`. Coolify doit construire le dépôt avec Docker Compose, exposer le service `luma` sur le port interne `3000` et fournir :

- `DATABASE_URL` : URL PostgreSQL interne.
- `SERVICE_PASSWORD_64_TURN` : secret partagé fort pour Coturn.
- `LUMA_TURN_PUBLIC_IP` : adresse IPv4 publique du serveur.
- `LUMA_ICE_SERVERS` : configuration ICE publique envoyée aux clients.
- `LUMA_UPLOAD_DIRECTORY` : facultatif; la composition utilise `/app/.wrangler/state/uploads`.

Le volume `luma-data` conserve uniquement les pièces jointes. PostgreSQL conserve les comptes, sessions, messages, communautés, relations sociales, appels et journaux d’administration. `scripts/postgres-start.mjs` vérifie et applique les migrations de `postgres/` avant de lancer Next.js.

Le port TURN `3478` est exposé en TCP et UDP; les ports UDP `49160-49200` transportent les médias relayés. Le pare-feu du serveur doit autoriser ces ports.

## Applications natives

- Android : version de test actuelle `0.3.6`.
- Bureau : version de test actuelle `0.3.5`.
- iOS : le projet Expo est présent, mais la distribution nécessite une signature et un compte Apple Developer.

Le partage d’écran fonctionne dans les navigateurs compatibles et dans l’application bureau. La WebView Android peut recevoir un partage, mais ne peut pas encore démarrer une capture MediaProjection; cette fonction nécessitera un moteur d’appel natif Android.

## Données personnelles

La notice visible dans l’application est dans `app/confidentialite/page.tsx`. Avant une ouverture publique, renseigner et vérifier `lib/privacy-config.ts` avec l’identité légale de l’exploitant, son adresse et une adresse de contact réellement suivie. Consulter [PRODUCTION-RGPD.md](PRODUCTION-RGPD.md) pour les décisions organisationnelles et juridiques qui ne peuvent pas être déduites du code.

Ne jamais ajouter au dépôt les fichiers `.env`, secrets TURN, mots de passe PostgreSQL, clés de signature, bases locales, pièces jointes ou fichiers installables générés.
