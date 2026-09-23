# Luma mobile 0.3.1

La navigation utilise une WebView persistante pour les messages, le fil, les amis,
les communautés et les paramètres. Cette version remplace les anciens écrans de
messagerie React Native à couleurs fixes par l'interface web responsive commune.
Elle ne constitue pas une réécriture de tous les écrans en composants natifs.

Le thème est conservé sur cet appareil, appliqué avant l'affichage et transmis
aux marges système. Le bouton Retour Android suit l'historique de navigation.
Les liens externes s'ouvrent dans le navigateur du téléphone.

Configurer EXPO_PUBLIC_LUMA_URL avec le domaine HTTPS Coolify avant de construire.
Le numéro Android est 4 et la version Expo est 0.3.1.
Les installations existantes nécessitent un nouvel APK signé avec la même clé.
Un push GitHub ne met pas à jour les APK déjà installés.

Validation locale : TypeScript mobile et compilation web. La génération, la
signature et le test sur téléphone restent nécessaires avant distribution.
