# Notes pour App Review — FairwayIQ

Contenu pour App Store Connect > Informations pour la revue de l’app. Les chemins d’écran viennent du code (`app/`). Le bloc anglais de la section 1 est à coller tel quel dans le champ « Notes » ; le reste sert au propriétaire.

Aucun identifiant réel ne doit figurer dans ce fichier ni dans le dépôt : les champs de compte de test restent des marques à remplir dans App Store Connect seulement.

## 1. Texte à coller dans « Notes » (anglais)

```text
FairwayIQ is a French-language golf scoring and training app (iPhone only). Users record rounds hole by hole, get statistics and an estimated (unofficial) Handicap Index, and follow practice drills. An AI coach (Anthropic Claude, called through our Supabase Edge Function) writes a diagnostic after each round; a conversational debrief is part of the Premium subscription.

TEST WITHOUT BEING ON A GOLF COURSE (no GPS, no location needed)
1. Sign in with the demo account in the fields above (self sign-up may require e-mail confirmation).
2. Tab "Score": choose "9 trous" to finish faster, leave the course field empty (course is optional), tap "Commencer le round", enter strokes, putts, green and fairway hole by hole, then "Terminer le round" on the last hole. A diagnostic is generated automatically after saving (free tier: 3 AI uses per day).
3. Offline entry: switch to airplane mode and save a round. It is kept on the device ("Round enregistré sur ton téléphone") and sent automatically when the connection returns.
4. Location is requested only during a round, only if the chosen course has GPS points, only "while using the app", and only to compute distances to the green on the device. The position is never sent to any server. The app is fully usable if permission is denied.

SUBSCRIPTION (auto-renewable, monthly and annual, entitlement "Premium")
- The paywall opens after profile setup, from the "Premium" button on the Home tab, and from Profil > "Voir Premium". "Passer" closes it.
- Restore Purchases: paywall, link "Restaurer mes achats".
- Manage Subscription: paywall, link "Gérer mon abonnement" (opens Apple subscription settings); also in Profil > Abonnement once subscribed.
- Terms of Use and Privacy Policy links: bottom of the paywall, and on the sign-up screen.
- Price, period, free trial (if eligible), renewal and cancellation terms are shown on the paywall before purchase. Purchases are made with StoreKit via RevenueCat. Premium status is confirmed on our server by a RevenueCat webhook (sandbox included), so it can take a few seconds to appear after a sandbox purchase.
- Premium unlocks the conversational debrief and raises the daily AI limit from 3 to 30. Everything else is free.

ACCOUNT DELETION
Tab "Profil" > "Modifier le profil" > bottom section "Zone dangereuse" > "Supprimer mon compte" > confirm. It deletes the account and its data on our server. It does not cancel the Apple subscription (the confirmation dialog says so and links to Apple subscription settings).

AI DATA DISCLOSURE
The sign-up screen shows a block "Coach IA et tes données" stating that round data and notes are sent to Anthropic (Claude), with a link to the privacy policy. The Create account button stays disabled until the user ticks the consent checkbox. Details are in the privacy policy, section 4. No API key is stored in the app.

OTHER
- Sign in with Apple is not offered: the app only has its own e-mail and password accounts, with no third-party login.
- Notifications are optional and off by default (Profil > Notifications). They are local reminders only; there is no push server.
- No advertising, no tracking, no in-app web browser, no user-to-user content.
```

## 2. Parcours de test détaillé (pour le propriétaire)

| Étape | Chemin | Remarque |
|---|---|---|
| Saisie sans parcours | Onglet Score > « Commencer le round » (le champ parcours indique « Optionnel — la saisie reste disponible sans parcours. ») | L’en-tête affiche « Score rapide ». Aucune demande de localisation : un parcours libre n’a pas de points GPS. |
| Saisie hors ligne | Mode avion > fin de partie | Bandeau « Round enregistré sur ton téléphone — Il sera envoyé dès que la connexion revient. » (`lib/round-save-flow.ts`). Envoi automatique au retour du réseau, à l’ouverture de l’app et toutes les 30 s (`lib/use-round-queue-sync.ts`). 20 parties en attente au plus. |
| Brouillon | Quitter l’app en pleine saisie, rouvrir | « Brouillon restauré » (`app/(tabs)/round.tsx`). |
| Diagnostic IA | Automatique après l’enregistrement ; relançable dans le détail d’une partie | Gratuit : 3 utilisations par jour, partagées entre diagnostic et débrief. Au-delà : message de limite et diagnostic simplifié. |
| Index estimé | Onglet Accueil, après 3 parties de 18 trous | Libellé « méthode WHS, non officiel » (`lib/rounds.ts`). |
| Où tu perds des coups | Accueil, carte dédiée ; écran `app/leaks.tsx` | Demande au moins 3 parties avec détail par trou. |
| Exercices | Onglet Exercices | 40 exercices, filtres par catégorie, résultats réussis sur tentés. |
| Trophées, Mon sac | Profil > Mon jeu | 18 trophées ; distances de carry de 14 clubs. |
| Rappels | Profil > Rappels > Notifications | Désactivés par défaut ; la permission système n’est demandée qu’au moment d’« Activer les rappels ». |
| Export | Profil > Données et confidentialité > Exporter mes données | JSON complet ou CSV des parties. |
| Distances GPS | Score, parcours du catalogue qui a des points GPS, saisie commencée | Demande « quand l’app est active ». Impossible à tester sans position : simulateur Xcode > Features > Location > Custom Location, ou vrai appareil. Si l’équipe de revue n’y arrive pas, elle voit « Active la localisation pour les distances réelles. » (`gpsHintLabel`) sans blocage. |

## 3. Abonnement : où tout se trouve

| Élément | Où | Preuve |
|---|---|---|
| Écran Premium (paywall) | Après la création du profil ; bouton « Premium » de l’Accueil ; Profil > Abonnement > « Voir Premium » ; écran de débrief verrouillé > « Découvrir Premium » | `app/(auth)/onboarding.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/profile.tsx`, `app/debrief.tsx` |
| Restaurer mes achats | Paywall, lien en bas | `app/paywall.tsx` (`handleRestore`, `restorePurchases`) |
| Gérer mon abonnement | Paywall ; Profil > Abonnement (abonné) ; Modifier le profil > Zone dangereuse | `MANAGE_SUBSCRIPTION_URL = https://apps.apple.com/account/subscriptions` (`lib/subscription.ts`) |
| Conditions d’utilisation et politique | Pied du paywall, inscription, Profil > Informations légales | `app/paywall.tsx`, `app/(auth)/register.tsx`, `app/(tabs)/profile.tsx`, adresses `EXPO_PUBLIC_TERMS_URL` et `EXPO_PUBLIC_PRIVACY_POLICY_URL` |
| Prix, essai, renouvellement | Résumé et texte sous le bouton | `buildSubscriptionDisclosure` dans `lib/subscription.ts` ; prix et essai lus auprès d’Apple via RevenueCat |

Tant que les deux adresses légales ne sont pas définies dans l’environnement EAS de production, les liens ouvrent « Lien indisponible » (`lib/legal.ts`) : refus quasi certain. À régler avant le build de soumission.

## 4. Suppression de compte

- Chemin : Profil > Modifier le profil > « Zone dangereuse » > « Supprimer mon compte » (`app/edit-profile.tsx`), puis confirmation (« Cette action est irréversible. »).
- Effet : la fonction `delete-account` supprime les lignes de l’utilisateur puis le compte d’authentification (`supabase/functions/delete-account/index.ts`), puis l’app déconnecte l’utilisateur.
- Limites annoncées dans la boîte de dialogue : l’abonnement Apple n’est pas annulé, avec le lien « Gérer mon abonnement ».

## 5. Divulgation de l’IA

- Où : `app/(auth)/register.tsx`, encadré « Coach IA et tes données » et case obligatoire (bouton désactivé tant qu’elle n’est pas cochée).
- Les écrans d’IA le disent : « établis par le coach IA » (carte de diagnostic), « Débrief IA » (en-tête), message explicite quand le diagnostic est simplifié et hors ligne (`app/diagnostic.tsx`).
- Données envoyées : `privacy-nutrition-labels.md`, section 4 ; page publique : `legal-site/privacy.html`, section 4.

## 6. Comptes de démonstration

Deux comptes dédiés, créés pour la revue, sans donnée personnelle réelle. Le propriétaire les crée et renseigne les identifiants dans App Store Connect seulement.

| Compte | Identifiant | Mot de passe | Usage |
|---|---|---|---|
| Gratuit | `[IDENTIFIANT DE TEST À CRÉER]` | `[MOT DE PASSE DE TEST À CRÉER]` | Voir le paywall et tester l’achat en bac à sable. Sans Premium. |
| Premium (facultatif) | `[IDENTIFIANT DE TEST À CRÉER]` | `[MOT DE PASSE DE TEST À CRÉER]` | Voir le débrief sans acheter. Demande une ligne `subscriptions` Premium valide dans la base. |

Conditions pour que ces comptes servent à quelque chose :

- Adresse déjà confirmée dans Supabase Auth si la confirmation d’e-mail y est activée : sinon la connexion échoue (l’inscription peut envoyer un e-mail de confirmation, `app/(auth)/register.tsx`).
- Profil terminé (`onboarding_complete`), sinon la revue passe par l’écran de configuration.
- Quelques parties déjà saisies (3 parties de 18 trous avec détail par trou) pour que l’Accueil montre l’index estimé et l’analyse des fuites ; mêmes données que pour les captures (`screenshots.md`).

## 7. Conformité à l’exportation (chiffrement)

Réponse : l’app n’utilise pas de chiffrement soumis à documentation (« non exempt » = Non).

- `app.json` : `expo.ios.config.usesNonExemptEncryption: false`. Expo écrit cette valeur dans la clé `ITSAppUsesNonExemptEncryption` du `Info.plist` : avec elle, App Store Connect ne repose pas la question à chaque envoi. À contrôler dans le premier build : `[À VÉRIFIER]` (lire l’`Info.plist` du build).
- Pourquoi c’est cohérent avec le code : l’app ne chiffre rien par elle-même. Les échanges réseau (Supabase, RevenueCat, Sentry) passent en HTTPS, fourni par le système ; la session est gardée dans le Trousseau iOS (`lib/secure-session-storage.ts`, `expo-secure-store`) ; la seule utilisation de l’API cryptographique dans le code de l’app est la génération d’identifiants aléatoires (`lib/round-save.ts`, `randomUUID` et `getRandomValues`). Aucune bibliothèque de chiffrement n’est dans `package.json`, aucun algorithme propriétaire ou non standard. La connexion utilise le flux PKCE standard de Supabase (`lib/supabase.ts`).
- Limite : c’est l’éditeur qui répond à Apple sous sa responsabilité. Si un chiffrement propre était ajouté plus tard, il faudrait revoir cette réponse. Le questionnaire d’App Store Connect peut poser une question propre à la distribution en France : `[À VÉRIFIER]` à la saisie.

## 8. Contact de la revue

| Champ App Store Connect | Valeur |
|---|---|
| Prénom, nom | `[À RENSEIGNER]` |
| Téléphone | `[À RENSEIGNER]` |
| E-mail | `[À RENSEIGNER]` |

## 9. À régler avant d’envoyer en revue

1. `[À VÉRIFIER]` Projet Supabase actif le jour de la revue. Sur une offre gratuite, un projet inactif peut être mis en pause ; un projet en pause rend l’app inutilisable (connexion, parties, IA) et entraîne un refus pour fonctionnalité cassée. Le choix d’une offre payante appartient au propriétaire.
2. `[À VÉRIFIER]` Secret `ANTHROPIC_API_KEY` défini côté Supabase, et limites `AI_COACH_DAILY_LIMIT_*` valides (entier supérieur à 0, `-1` ou `unlimited`). Sans clé, le diagnostic tombe sur la version simplifiée et le débrief affiche un message d’indisponibilité.
3. `[À VÉRIFIER]` Webhook RevenueCat configuré pour Production et Sandbox, avec le secret `REVENUECAT_WEBHOOK_SECRET` : sans lui, un achat en bac à sable donne Premium environ 10 minutes dans l’app (`PURCHASE_GRACE_MS` dans `stores/subscription.ts`), puis le serveur le refuse (débrief en 403).
4. `[À VÉRIFIER]` Fonctions déployées identiques à celles de `main` (`ai-coach`, `delete-account`, `revenuecat-webhook`, `course-catalog`) : le dépôt ne dit rien de l’état déployé. Sans clé `GOLFAPI_KEY`, la recherche de parcours reste sur la liste intégrée (`FRENCH_COURSES`) et le catalogue déjà en base.
5. `[À VÉRIFIER]` Adresses légales publiées et définies dans EAS (production) : `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_URL`. Pages relues par un juriste, bannières « BROUILLON » retirées.
6. `[À VÉRIFIER]` Redirection d’authentification `fairwayiq://**` autorisée dans Supabase (e-mail de confirmation et réinitialisation du mot de passe) et SMTP personnalisé (limite d’envoi du serveur d’e-mails intégré).
7. Le dépôt ne contient que des tests Jest : notifications, carte de partage, GPS et lien de réinitialisation sont à contrôler sur un appareil iOS réel (TestFlight) avant la revue.
