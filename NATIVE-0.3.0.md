# Luma 0.3.0 — applications

Les applications se connectent au site Luma existant. Les contenus, amis et publications sont partagés avec le site ; ils ne sont pas stockés dans les archives distribuées.

## Windows

La version portable contient les permissions micro/caméra et le choix de partage d’écran. Décompresser entièrement l’archive et lancer Luma.exe. Cette version n’est pas signée et ne possède pas de mise à jour automatique de son lanceur. Le contenu web suit la version hébergée.

## Android

Les sources 0.3.0 ajoutent l’accès au fil des amis, aux profils et publications. Les permissions caméra et micro sont déclarées. La vérification TypeScript et l’export Android vérifient le code JavaScript ; ils ne produisent pas d’APK.

Pour produire un APK, installer le SDK Android et Java pour une compilation locale, ou utiliser un compte Expo autorisé avec le profil `preview` de `native/mobile/eas.json`. Ce profil demande un APK de distribution interne. Aucun compte Expo, clé de signature ou identifiant personnel n’est inclus dans les sources. La signature et les essais sur appareil restent nécessaires avant distribution.

## Hébergement et accès

Le backend dépend de Sites, Cloudflare D1/R2 et de l’authentification de la plateforme. Déposer les sources sur GitHub ne déplace pas automatiquement ce backend vers GitHub Pages. Les appels entre réseaux différents nécessitent encore un relais TURN configuré et testé.
