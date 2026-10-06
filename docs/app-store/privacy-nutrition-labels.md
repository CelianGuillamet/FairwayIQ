# App Privacy (« étiquettes de confidentialité ») — FairwayIQ

Réponses pour App Store Connect > Confidentialité de l’app, déduites du code et des migrations de la branche `feat/appstore-copy` (issue de `main`). À refaire si une table, un SDK ou une donnée envoyée à un service change.

Les libellés d’Apple ci-dessous sont ceux connus à la rédaction ; l’interface d’App Store Connect peut les renommer ou les regrouper autrement : `[À VÉRIFIER sur App Store Connect]` au moment de la saisie.

Définition retenue (celle d’Apple) : une donnée est « collectée » quand elle quitte l’appareil vers vous ou vers un partenaire tiers et reste accessible plus longtemps que le temps de la requête. Ici, les partenaires qui traitent des données pour le compte de l’éditeur sont Supabase, RevenueCat, Sentry et Anthropic ; leurs collectes sont déclarées comme celles de l’app.

## 1. Réponses à saisir

| Question d’Apple | Réponse |
|---|---|
| Collectez-vous des données depuis cette app ? | Oui |
| Des données servent-elles au suivi (tracking) ? | Non, pour tous les types |
| Position précise ou approximative collectée ? | Non (calculée sur l’appareil, jamais envoyée) |
| Autorisation de suivi (ATT) à afficher ? | Non : aucune |

Preuves du « pas de suivi » : aucune dépendance de publicité, d’attribution ou de mesure d’audience dans `package.json` ; aucun `NSUserTrackingUsageDescription` dans `app.json` ; aucun appel à un identifiant publicitaire dans `app/`, `lib/`, `stores/`, `components/` (recherche faite sur `AppTrackingTransparency`, `advertis`, `IDFA`, `analytics`, `firebase`, `mixpanel`, `amplitude`). Les seuls services tiers dans le binaire sont Supabase (`@supabase/supabase-js`), RevenueCat (`react-native-purchases`) et Sentry (`@sentry/react-native`).

## 2. Types de données à déclarer

Colonnes : « Lié » = lié à l’identité de l’utilisateur ; « Finalités » = noms des finalités d’Apple. Tous les types ci-dessous : suivi = Non.

| Catégorie > type (Apple) | Données concrètes | Lié | Finalités | Preuves |
|---|---|---|---|---|
| Coordonnées > Adresse e-mail | E-mail du compte, utilisé pour la confirmation du compte, la connexion et le lien de réinitialisation du mot de passe | Oui | Fonctionnalités de l’app | `app/(auth)/register.tsx` (`supabase.auth.signUp`), `app/(auth)/login.tsx` (`signInWithPassword`), `lib/supabase.ts` (`resetPasswordForEmail`), `lib/export-document.ts` (le compte exporté contient l’e-mail) |
| Coordonnées > Nom | Prénom ou pseudo saisi à l’inscription du profil (`profiles.display_name`, 2 caractères minimum) | Oui | Fonctionnalités de l’app ; Personnalisation du produit | `supabase/migrations/001_initial.sql`, `app/(auth)/onboarding.tsx`, `app/edit-profile.tsx`, `supabase/functions/ai-coach/index.ts` (`buildDebriefInstructions` insère le prénom) |
| Santé et forme > Forme (Fitness) | Scores, putts, greens en régulation, fairways et pénalités par partie et par trou ; exercices réalisés et leurs résultats (réussis sur tentés) ; distances de carry par club ; trophées obtenus ; niveau de handicap, fréquence de jeu, objectif | Oui | Fonctionnalités de l’app ; Personnalisation du produit | Tables `rounds`, `round_holes` (001, 003, 004, 005, 006, 016), `drill_completions` (013, 019), `club_distances` (020), `user_badges` (021), `profiles` (001, 007). `[À VÉRIFIER]` : voir point 1 de la section 8 |
| Achats > Historique d’achats | Statut Premium, formule (identifiant du produit), date d’expiration, date du dernier événement RevenueCat. Aucun numéro de carte : le paiement reste chez Apple | Oui | Fonctionnalités de l’app | `subscriptions` (001, 017), `supabase/functions/revenuecat-webhook/events.ts` (`plan: event.productId`), `lib/purchases.ts` |
| Contenu de l’utilisateur > Autre contenu | Notes libres de partie (`rounds.notes`), nom de parcours saisi librement (`rounds.course_name`), messages du débrief et réponses du coach (`debrief_messages.content`), diagnostics générés (`diagnostics`) | Oui | Fonctionnalités de l’app | `rounds` (001), `debrief_*` (002), `diagnostics` (001, 004), `app/debrief.tsx` (`persistExchange`) |
| Identifiants > ID utilisateur | UUID du compte Supabase, utilisé comme clé de toutes les tables et comme identifiant d’abonné RevenueCat | Oui | Fonctionnalités de l’app | 001 à 021 (`user_id uuid references auth.users`), `lib/purchases.ts` (`Purchases.logIn(userId)`) |
| Données d’utilisation > Autres données d’utilisation | Nombre d’appels au coach IA par jour et par utilisateur ; nombre de recherches de parcours par fenêtre de temps | Oui | Fonctionnalités de l’app (limite quotidienne, protection contre les abus) | `ai_coach_usage` (010), `course_catalog_rate_limits` (009). `[À VÉRIFIER]` : point 2 de la section 8 |
| Diagnostics > Données de plantage ; Données de performance ; Autres données de diagnostic | Rapports d’erreur Sentry, traces de performance (10 % en production), sessions pour la stabilité des versions, modèle d’appareil et version du système | Oui, par prudence | Fonctionnalités de l’app | `lib/sentry.ts` (`tracesSampleRate: 0.1`, `enableAutoSessionTracking: true`, `sendDefaultPii: false`), `components/ErrorBoundary.tsx` (`captureException`), `app/_layout.tsx` (`initSentry`). `[À VÉRIFIER]` : point 4 de la section 8 |
| Historique de recherche | Texte saisi dans la recherche de parcours, transmis à la fonction `course-catalog` puis à golfapi.io ; les recherches sans résultat sont gardées en cache sans identifiant d’utilisateur | Non | Fonctionnalités de l’app | `lib/golf-courses.ts` (`invokeCourseCatalog`), `supabase/functions/course-catalog/index.ts` (`providerFetch('/clubs', { name: query })`), migration 009 (`course_catalog_negative_cache`). `[À VÉRIFIER]` : point 3 de la section 8 |
| Identifiants > ID de l’appareil | Non établi | À déterminer | À déterminer | `[À VÉRIFIER]` : point 5 de la section 8 |

Types à ne pas déclarer, avec la raison :

| Type | Raison |
|---|---|
| Position précise, position approximative | Calculée et utilisée sur l’appareil seulement (section 5). |
| Informations financières, informations de paiement | Le paiement passe par Apple ; l’app et le serveur ne reçoivent aucune donnée de carte ni de compte bancaire. |
| Santé (données médicales) | Aucun HealthKit, aucune API Mouvement et forme (`package.json`, `app.json`). Les scores de golf ne sont pas des données médicales. |
| Contacts, photos ou vidéos, audio, e-mails ou messages (de l’appareil), historique de navigation | Aucune autorisation ni API correspondante (`app.json`, `package.json`). La carte de partage et l’export créent un fichier local que l’utilisateur envoie lui-même (section 7). |
| Données de publicité, données sensibles | Aucune. |
| Assistance client | Aucun formulaire d’assistance dans l’app. `[À VÉRIFIER]` : point 8 de la section 8 (e-mails reçus à l’adresse de contact). |

## 3. Origine des données dans la base (migrations)

| Table | Données personnelles ou liées à l’utilisateur | Migrations |
|---|---|---|
| `auth.users` (gérée par Supabase Auth, absente des migrations) | E-mail, mot de passe haché, identifiant, dates | Supabase |
| `profiles` | `display_name`, `handicap`, `play_frequency`, `goal`, `onboarding_complete` | 001, 007 |
| `rounds` | Date, parcours (`course_name`, `course_id`, `course_provider`, `provider_course_id`), départ (`tee_*`), `holes`, `total_score`, `par`, `putts`, `gir`, `fairways_*`, `penalties`, `notes`, `client_request_id` | 001, 004, 005, 006, 016 |
| `round_holes` | Par, score, putts, GIR, fairway, pénalité par trou | 003 |
| `diagnostics` | Points forts, points faibles, plan de la semaine, analyse, catégories recommandées | 001, 004, 015 |
| `debrief_sessions`, `debrief_messages` | Une session par partie ; messages de l’utilisateur et du coach | 002 |
| `drill_completions` | Exercice, date, `result_made`, `result_attempts` | 013, 019 |
| `club_distances` | Club, distance de carry en mètres, date | 020 |
| `user_badges` | Trophée et date d’obtention | 021 |
| `subscriptions` | `is_premium`, `plan`, `expires_at`, `last_event_at`, `updated_at` | 001, 017 |
| `ai_coach_usage` | Compteur quotidien par utilisateur | 010 |
| `course_catalog_rate_limits` | Compteur par utilisateur et par fenêtre | 009 |
| `course_catalog_negative_cache` | Recherches sans résultat (texte normalisé), sans identifiant d’utilisateur, 24 h par défaut | 009 |
| `golf_courses`, `course_tee_sets`, `course_holes`, `course_hole_tee_distances`, `course_hole_gps_points` | Aucune donnée d’utilisateur : catalogue de parcours | 006, 008, 018 |

## 4. Ce qui est envoyé à Anthropic

Le téléphone n’appelle jamais Anthropic : il appelle la fonction `ai-coach` de Supabase (`lib/claude.ts`, `supabase.functions.invoke('ai-coach')`), qui détient la clé Anthropic et filtre ce qui part (`supabase/functions/ai-coach/index.ts`).

Le client envoie plus que ce qui est retenu (objet `round` complet avec identifiants, nom du parcours et date ; objet `profile` complet). La fonction relit le profil dans la base et ne garde que les champs suivants.

| Action | Envoyé à Anthropic | Où dans le code |
|---|---|---|
| Diagnostic de partie (`analyze_round`), lancé automatiquement à l’enregistrement d’une partie (`app/(tabs)/round.tsx`, `handleSave`) ou depuis le détail d’une partie (`app/round-detail.tsx`) | Handicap, objectif, fréquence de jeu ; score et par de la partie, putts, GIR, fairways, pénalités ; notes libres nettoyées (1000 caractères) ; scores des dernières parties (10 au plus) pour en tirer une moyenne ; par trou : numéro, par, score, putts, agrégés en indicateurs (aller, retour, birdies, doubles, trois-putts, trous les plus coûteux) | `parseRound`, `parsePreviousScores`, `parseScorecard`, `loadProfile`, `buildAnalyzePrompt` |
| Débrief (`post_round_debrief`), Premium seulement (réponse 403 sinon) | Prénom (`<prenom_joueur>`), handicap ; score total et par de la partie (relus dans la base) ; nouveau message de l’utilisateur (1000 caractères) et historique (12 messages au plus, 1500 caractères chacun) | `buildDebriefInstructions`, `buildDebriefMessages`, `parseHistory` |

Jamais envoyés à Anthropic : e-mail, mot de passe, identifiant du compte, nom du parcours, date de la partie, position GPS, statut d’abonnement, exercices, trophées, distances du sac. Les notes de partie ne sont pas transmises dans le débrief (seuls score et par le sont).

Autres faits utiles :

- Les textes de l’utilisateur sont encadrés par des balises (`<notes_joueur>`, `<message_joueur>`) et traités comme des données dans les consignes envoyées au modèle.
- Sans réponse exploitable, l’app calcule un diagnostic ou une réponse simplifiés sur l’appareil (`buildFallbackDiagnostic` dans `lib/claude.ts`, `buildFallbackReply` dans `app/debrief.tsx`) : rien n’est alors envoyé de plus.
- Information et consentement à l’inscription : `app/(auth)/register.tsx` (encadré « Coach IA et tes données », case obligatoire, lien vers la politique).
- Durée de conservation, usage pour l’entraînement de modèles et accord de traitement côté Anthropic : `[À VÉRIFIER]`, point 6 de la section 8. Le code n’en dit rien.

## 5. Position

La position précise n’est pas collectée :

- `app/(tabs)/round.tsx` demande l’autorisation « quand l’app est active » seulement si le parcours choisi a des points GPS et que la saisie a commencé, puis lit la position avec `Location.watchPositionAsync`. Elle est gardée dans l’état React `livePosition`.
- `livePosition` ne sert qu’à `getGreenDistances` (`lib/gps.ts`, calcul de distance sur l’appareil) ; la distance au centre du green alimente `useClubAdvice` (`lib/use-club-advice.ts`), qui lit les distances du sac.
- Aucune requête réseau ne reçoit ces coordonnées : les seuls appels sortants sont `supabase.functions.invoke('ai-coach' | 'course-catalog' | 'delete-account')`, les requêtes `supabase.from(...)`, RevenueCat et Sentry, et aucun ne reçoit `livePosition`. La recherche `latitude|longitude` dans `app/`, `lib/`, `stores/`, `components/` ne trouve que des coordonnées de parcours (catalogue) et cet état.
- `app.json` : `locationWhenInUsePermission` en français, localisation en arrière-plan désactivée (`isIosBackgroundLocationEnabled: false`).

Limite : l’adresse IP de l’appareil est visible de Supabase, RevenueCat et Sentry comme pour toute connexion. Si l’un d’eux en déduit une localisation approximative, Apple pourrait y voir une position approximative collectée. `[À VÉRIFIER]` : point 5 de la section 8.

## 6. SDK tiers dans le binaire

| SDK | Rôle | Données | Statut |
|---|---|---|---|
| `react-native-purchases` (RevenueCat) | Achats et abonnements | Identifiant d’abonné (UUID du compte une fois connecté, identifiant anonyme avant), reçus et état de l’abonnement, données techniques de l’appareil | Identifiants d’appareil exacts : `[À VÉRIFIER]` |
| `@sentry/react-native` | Rapports d’erreur et de performance | Voir ligne « Diagnostics » de la section 2 | Contenu exact des événements : `[À VÉRIFIER]` |
| `@supabase/supabase-js` | Compte, base, fonctions | Section 3 | Déclaré |

`app.json > ios.privacyManifests` ne déclare que les API à raison obligatoire (`FileTimestamp`, `UserDefaults`, `DiskSpace`, `SystemBootTime`). Il ne déclare ni `NSPrivacyCollectedDataTypes` ni `NSPrivacyTracking` : ce n’est pas ce que lit App Store Connect, mais cela doit rester cohérent avec les réponses ci-dessus. Vérification recommandée sur le build final : générer le rapport de confidentialité Xcode depuis l’archive (Organizer > clic droit sur l’archive > « Generate Privacy Report ») pour voir les manifestes agrégés de tous les SDK. `[À VÉRIFIER]`

## 7. Données gardées sur l’appareil seulement (non collectées)

| Donnée | Où | Preuve |
|---|---|---|
| Session de connexion | Trousseau iOS (SecureStore, `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`) | `lib/secure-session-storage.ts` |
| Brouillon de partie | AsyncStorage, par utilisateur | `lib/round-draft.ts` |
| File d’attente des parties non envoyées (20 au plus) | AsyncStorage, par utilisateur ; chaque partie est envoyée comme une partie normale dès que le réseau revient | `lib/round-save-queue.ts`, `stores/round-queue.ts` |
| Objectif de la semaine, défi du mois, réglages de rappels, indice « rappels » | AsyncStorage, par utilisateur | `lib/weekly-goal-storage.ts`, `lib/monthly-challenge-storage.ts`, `lib/notification-settings-storage.ts`, `lib/reminders-hint.ts` |
| Préférence d’apparence | AsyncStorage | `lib/theme-preference.ts` |
| Dernier départ et dernier format (9 ou 18 trous) utilisés sur chacun des 50 derniers parcours (clé = identifiant du parcours ou nom normalisé d’un parcours libre) | AsyncStorage, par utilisateur. La liste « Mes parcours » (5 derniers parcours) est déduite des parties déjà enregistrées, rien de plus n’est stocké ni envoyé | `lib/course-memory.ts`, `stores/course-memory.ts`, `lib/recent-courses.ts` |
| Rappels | Notifications locales programmées par le téléphone, aucun jeton de notification push, aucun serveur | `lib/notifications.ts`, `lib/notification-plan.ts` (recherche `PushToken` sans résultat) |
| Fichier d’export (JSON ou CSV) | Cache de l’app, un seul fichier conservé, envoyé ailleurs par l’utilisateur via la feuille de partage | `lib/export-files.ts`, `lib/export-flow.ts` |
| Image de la carte de partage | Fichier temporaire, partagé par l’utilisateur | `components/share/useShareRound.tsx` |

## 8. À vérifier avant de valider les réponses

1. `[À VÉRIFIER]` Catégorie des données de golf. Retenu : « Forme (Fitness) » pour les scores, exercices et distances de carry, parce que les exercices enregistrent une pratique sportive. Si le propriétaire juge que ce n’en est pas, l’alternative est « Autres types de données » ; ne rien déclarer serait le choix le moins prudent. Décision du propriétaire.
2. `[À VÉRIFIER]` « Autres données d’utilisation » pour les compteurs `ai_coach_usage` et `course_catalog_rate_limits` : déclaration prudente, ce sont des compteurs d’activité rattachés à un utilisateur.
3. `[À VÉRIFIER]` « Historique de recherche » : le texte de recherche de parcours part vers la fonction serveur puis vers golfapi.io (et vers OpenStreetMap si la recherche OSM est activée, `OSM_COURSE_SEARCH_ENABLED`). Il n’est pas rattaché à l’utilisateur, mais les recherches sans résultat restent en cache 24 h par défaut. Déclarer « non lié » est la lecture prudente.
4. `[À VÉRIFIER]` Sentry « lié ou non ». Le code ne définit pas d’utilisateur Sentry (aucun `setUser`) et met `sendDefaultPii: false`. Mais `lib/redact-url.ts` ne masque que les paramètres `code`, `token` et `secret`, alors que les requêtes vers Supabase contiennent l’UUID du compte dans l’adresse (par exemple `user_id=eq.<uuid>` dans `stores/subscription.ts`, `lib/subscription-period.ts`, `lib/data-export.ts`), et que `stores/auth.ts`, `stores/subscription.ts` et `app/_layout.tsx` écrivent `userId` dans des messages `console.info` ou `console.warn`. Si le SDK enregistre ces adresses et ces messages comme fil d’Ariane (comportement par défaut à confirmer dans la documentation de la version 7.2 du SDK), l’UUID peut figurer dans les rapports. D’où « lié » par prudence. Corriger cela (masquer l’UUID, retirer `userId` des journaux) n’est pas dans cette PR.
5. `[À VÉRIFIER]` Identifiants d’appareil et adresse IP. Lire les manifestes de confidentialité de RevenueCat et de Sentry (rapport Xcode, section 6) : s’ils listent un identifiant d’appareil, ajouter « ID de l’appareil » (fonctionnalités de l’app, lié). Vérifier aussi dans Sentry si l’adresse IP est stockée (réglage du projet) et si Supabase Auth garde l’IP des sessions.
6. `[À VÉRIFIER]` Anthropic : durée de conservation des données de l’API, usage éventuel pour l’entraînement, accord de traitement. À reporter ensuite dans `legal-site/privacy.html` (champs `class="ph"` de la section 4 et du tableau des durées).
7. `[À VÉRIFIER]` Libellés des finalités et des catégories dans l’interface au moment de la saisie (Apple les modifie).
8. `[À VÉRIFIER]` « Assistance client » : si des utilisateurs écrivent à l’adresse de contact, décider s’il faut le déclarer ; l’app elle-même ne propose aucun formulaire.
9. `[À VÉRIFIER]` Cohérence finale : relire `legal-site/privacy.html` (sections 2, 4, 5, 7, 9) une fois les champs remplis ; ces réponses et cette page doivent dire la même chose.
