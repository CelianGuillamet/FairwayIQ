# Classification d’âge et conformité — FairwayIQ

État du code : branche `feat/appstore-copy` (issue de `main`). Les numéros de règles viennent des App Review Guidelines ; Apple les renumérote parfois : `[À VÉRIFIER]` sur la version en vigueur avant de citer un numéro à l’équipe de revue.

## 1. Classification d’âge (questionnaire App Store Connect)

Apple a refondu le questionnaire et l’échelle d’âges (4+, 9+, 13+, 16+, 18+) : les intitulés ci-dessous suivent le questionnaire tel qu’il était connu à la rédaction, `[À VÉRIFIER sur App Store Connect]` au moment de répondre. Dans tous les cas, la colonne « Vérifié dans le code » dit ce qui existe réellement dans l’app.

| Sujet | Réponse | Vérifié dans le code |
|---|---|---|
| Contrôle parental, vérification de l’âge dans l’app | Non | Aucun champ d’âge ni de date de naissance à l’inscription (`app/(auth)/register.tsx`). |
| Accès web sans restriction | Non | Pas de WebView (`package.json`). Les liens (conditions, politique, réglages d’abonnement Apple, vidéo YouTube d’un exercice) s’ouvrent dans le navigateur du système par `Linking.openURL` (`lib/legal.ts`, `components/drills/DrillCard.tsx`). |
| Contenu généré par les utilisateurs | Non | Notes, messages de débrief et nom de parcours ne sont visibles que de leur auteur (politiques RLS « own », migrations 001, 002). Aucun fil, profil public, classement ni commentaire. La carte de partage est une image que l’utilisateur envoie lui-même par la feuille de partage système. |
| Messagerie et discussion | Non | Aucune messagerie entre utilisateurs. Le débrief est un échange privé avec une IA ; `[À VÉRIFIER]` si Apple le range sous « discussion » (voir section 3). |
| Publicité | Non | Aucun SDK de publicité (`package.json`). |
| Informations médicales ou de traitement | Non | Aucune. |
| Thèmes de santé ou de bien-être | Non | Conseils d’entraînement de golf seulement. Un exercice de routine mentale prévoit 3 respirations avant le coup (`lib/drill-library.ts`, « Respiration avant coup ») sans allégation de santé. `[À VÉRIFIER]` le choix. |
| Thèmes sexuels, nudité | Aucun | Aucun contenu. |
| Violence (dessinée, réaliste, armes) | Aucune | Aucun contenu. |
| Jeux d’argent réels, jeux d’argent simulés, concours, boîtes à butin | Non | Aucun pari ni gain : le « défi du mois » est un objectif personnel sans enjeu (`lib/monthly-challenge.ts`). |
| Grossièreté ou humour cru, horreur, alcool, tabac ou drogues | Aucun | Recherche des termes correspondants dans `app/`, `lib/`, `components/` : rien. |

Résultat attendu : la classe la plus basse (4+) si toutes les réponses sont négatives. `[À VÉRIFIER]` : la classe calculée par Apple.

Âge minimum des conditions : le brouillon de `legal-site/terms.html` (section 2) et de `legal-site/privacy.html` (section 14) exige 16 ans, alors que l’app ne contrôle pas l’âge. L’âge minimum des conditions et la classe d’âge de l’App Store sont indépendants (la classe décrit le contenu, pas l’âge légal de consentement). Décision du propriétaire et du juriste : `[À CONFIRMER]` (âge retenu et, si besoin, relèvement de la classe d’âge dans App Store Connect ou contrôle à l’inscription).

## 2. Droits sur le contenu

Question d’App Store Connect : l’app contient, affiche ou donne accès à du contenu tiers ? Réponse : Oui. À ne confirmer « j’ai les droits » qu’après les vérifications ci-dessous.

| Contenu | Source | Licence ou droit | État |
|---|---|---|---|
| Catalogue de parcours, distances, points GPS | golfapi.io (fonction `supabase/functions/course-catalog`, `GOLFAPI_BASE_URL`) | Conditions du fournisseur | `[À VÉRIFIER]` : autorisent-elles le stockage en base et l’affichage à tous les utilisateurs ? |
| Données OpenStreetMap (parcours, tracés de trous) | Overpass (`OSM_OVERPASS_URL`) | ODbL : attribution obligatoire | Mention présente dans `legal-site/terms.html` (section 7), dans la description de la fiche et dans l’app : écran « Crédits et licences » (`app/credits.tsx`) et ligne « Parcours : © OpenStreetMap » sous les résultats de recherche issus d’OpenStreetMap. |
| Polices Newsreader et Hanken Grotesk | `@expo-google-fonts/*` | MIT et OFL-1.1 (`package-lock.json`) | `[À VÉRIFIER]` : conservation des mentions de licence si requise. |
| Icônes de l’interface | `lucide-react-native` | ISC (`package-lock.json`) | Rien à faire. |
| Icône, écran de lancement | `assets/` | Créations du propriétaire | `[À CONFIRMER]` |
| Textes des 40 exercices | `lib/drill-library.ts` | Rédigés pour l’app | `[À CONFIRMER]` : texte original. Un exercice renvoie vers une vidéo YouTube (lien, pas de copie). |
| Réponses du coach IA | Anthropic (Claude) | Conditions d’Anthropic | `[À VÉRIFIER]` : droits d’usage commercial des sorties. |
| Termes « WHS » et « Handicap Index » | Gouvernance du golf | Termes d’organismes tiers | L’app écrit « non officiel » (`lib/rounds.ts`). `[À VÉRIFIER]` côté juridique l’usage de ces termes dans l’app et la fiche. |

## 3. Contenu généré par l’IA : points de divulgation

| Point | Où dans l’app ou le dépôt |
|---|---|
| Où l’IA intervient : diagnostic de partie (gratuit, 3 par jour) et débrief conversationnel (Premium) | `supabase/functions/ai-coach/index.ts` (`analyze_round`, `post_round_debrief`) |
| Fournisseur et chemin : Anthropic (Claude) via une fonction Supabase, aucune clé dans l’app | `lib/claude.ts`, `README.md` (section Coach IA) |
| Information avant la première donnée envoyée, et consentement explicite : encadré « Coach IA et tes données » et case à cocher obligatoire à l’inscription | `app/(auth)/register.tsx`, `constants/legal.ts` (`AI_DATA_NOTICE`, constante non utilisée à ce jour) |
| Détail des données transmises, et de celles qui ne le sont pas | `legal-site/privacy.html` section 4 ; `privacy-nutrition-labels.md` section 4 |
| Étiquetage des contenus : « établis par le coach IA » sur la carte de diagnostic, « Débrief IA » en en-tête ; mention explicite quand un diagnostic est simplifié et hors ligne | `components/rounds-detail/RoundDiagnosticCard.tsx`, `app/debrief.tsx`, `app/diagnostic.tsx` |
| Alternative sans IA : diagnostic et réponse simplifiés calculés sur l’appareil quand l’IA est indisponible ou la limite atteinte | `buildFallbackDiagnostic` (`lib/claude.ts`), `buildFallbackReply` (`app/debrief.tsx`) |
| Avertissement sur l’exactitude : présent dans les conditions (section 6) et la fiche (« À savoir »), absent à l’écran près des réponses | `legal-site/terms.html` ; `[À VÉRIFIER]` : ajouter une mention dans l’app |
| Maîtrise du contenu produit : rôle limité au coaching de golf, textes de l’utilisateur traités comme des données, entrée limitée à 1000 caractères, sortie à 400 jetons pour le débrief, réponses en 5 phrases au plus, aucune génération d’image, aucune publication | `buildDebriefInstructions`, `sanitizeText`, constantes `MAX_*` de `ai-coach/index.ts` |
| Signalement d’une réponse inappropriée | Aucun bouton dans l’app ; seule la mention d’une adresse e-mail dans `terms.html` (section 6). `[À VÉRIFIER]` : la règle 1.2 vise le contenu partagé entre utilisateurs et l’échange est privé ici, mais Apple examine les apps de discussion IA. |
| Partage de données personnelles avec une IA tierce | Règle 5.1.2(i) dans sa version récente (information claire et autorisation explicite avant l’envoi) : couverte par l’encadré et la case de l’inscription. `[À VÉRIFIER]` : numérotation et libellé de la règle en vigueur. |

## 4. Abonnement : liste de contrôle (règle 3.1.2)

| Exigence | État | Preuve |
|---|---|---|
| Ce que l’abonné obtient pour le prix | Fait | `FEATURES` dans `app/paywall.tsx` : « Débrief conversationnel », « Coach IA étendu ... 30 ... contre 3 en version gratuite » |
| Durée de chaque formule | Fait | Cartes « Mensuel » `/mois` et « Annuel » `/an` |
| Prix par période, dans la devise locale | Fait | `priceString` fourni par l’App Store via RevenueCat ; rien d’écrit en dur |
| Le prix facturé est plus visible que l’équivalent mensuel | Fait | Prix de la formule en `titleMd`, « Soit X/mois » en petit (`savingsText`, `planPrice`) |
| Essai gratuit : durée, puis prix | Fait si l’essai existe | `describeFreeTrial` et `buildSubscriptionDisclosure` (`lib/subscription.ts`) ; le bouton devient « Commencer l’essai gratuit de ... » |
| Renouvellement automatique, annulation 24 h avant, débit, où gérer | Fait | Texte `terms` de `buildSubscriptionDisclosure`, affiché sous le bouton |
| Gérer l’abonnement | Fait | Lien « Gérer mon abonnement » (paywall, Profil, Modifier le profil) vers `https://apps.apple.com/account/subscriptions` |
| Restaurer les achats | Fait | « Restaurer mes achats » (`handleRestore`) |
| Liens vers les conditions et la politique dans l’app | Fait | Pied du paywall ; ouvrent « Lien indisponible » tant que `EXPO_PUBLIC_TERMS_URL` et `EXPO_PUBLIC_PRIVACY_POLICY_URL` sont vides |
| Lien vers les conditions (EULA) dans les métadonnées, politique dans le champ dédié | À faire | `listing.fr.md` sections 4 et 8 |
| Possibilité de ne pas s’abonner | Fait | « Passer » ; le reste de l’app est gratuit |
| Formulations comparatives vraies | `[À VÉRIFIER]` | « Meilleur choix » et « nettement plus intéressant que le mensuel » (`app/paywall.tsx`) ne sont vrais que si le prix annuel est inférieur à 12 fois le mensuel : à contrôler avec les prix configurés dans App Store Connect |
| Abonnements créés dans App Store Connect : groupe, deux formules, noms, descriptions, prix, essai | À faire | `listing.fr.md` section 9 |
| Capture d’écran et notes de revue de l’achat intégré | À faire | Capture de l’écran Premium ; `review-notes.md` |
| Droit `premium` et offre RevenueCat (`$rc_monthly`, `$rc_annual`) | À faire | `lib/purchases.ts` (`entitlements.active['premium']`), `lib/subscription.ts` |
| Accord pour les apps payantes, banque et fiscalité dans App Store Connect | À faire (propriétaire) | Coordonnées bancaires et fiscales : saisies par le propriétaire seul |

## 5. Suppression de compte (règle 5.1.1(v))

- Chemin : Profil > Modifier le profil > « Zone dangereuse » > « Supprimer mon compte » > confirmation (`app/edit-profile.tsx`).
- Effet : `supabase/functions/delete-account/index.ts` supprime d’abord les lignes `debrief_messages`, `debrief_sessions`, `round_holes`, `diagnostics`, `drill_completions`, `rounds`, `subscriptions`, `profiles`, puis le compte d’authentification, ce qui supprime aussi par cascade `club_distances`, `user_badges`, `ai_coach_usage`, `course_catalog_rate_limits`. La suppression est réelle, pas une désactivation.
- Le dialogue prévient que l’abonnement Apple n’est pas annulé et propose « Gérer mon abonnement » ; la zone dangereuse porte le même avertissement et le même lien.
- Observations, sans correction dans cette PR :
  1. `club_distances` et `user_badges` (migrations 020, 021) ne figurent pas dans la liste explicite de `delete-account` : elles partent par la cascade de la clé étrangère. La fonction dit elle-même ne pas vouloir dépendre de la cascade.
  2. Si la suppression du compte d’authentification échoue après celle des données, les données sont perdues et le compte subsiste : l’utilisateur voit une erreur et peut recommencer.
  3. Les données gardées par RevenueCat et Sentry ne sont pas effacées par l’app (dit dans `privacy.html`, section 11).
  4. La file des parties non envoyées et les réglages locaux restent sur l’appareil après la suppression (seul le brouillon est effacé à la déconnexion, `stores/auth.ts`) ; ils disparaissent à la désinstallation.

## 6. Sign in with Apple (règle 4.8)

Non requis ici. La règle 4.8 s’applique aux apps qui utilisent un service de connexion tiers ou social (Google, Facebook, etc.) pour créer ou authentifier le compte principal. FairwayIQ n’a que des comptes propres par e-mail et mot de passe, gérés par Supabase Auth : `supabase.auth.signUp`, `signInWithPassword`, `resetPasswordForEmail`, `exchangeCodeForSession` (pour les liens e-mail). Aucun `signInWithOAuth` ni `signInWithIdToken`, aucune dépendance `expo-apple-authentication`, Google ou Facebook (`package.json`). Les apps qui n’utilisent que leur propre système de compte sont exemptées de 4.8. Si une connexion Google ou autre est ajoutée un jour, Sign in with Apple (ou un service équivalent) devient obligatoire.

## 7. Autres points de conformité

| Sujet | Constat | Preuve |
|---|---|---|
| Politique de confidentialité accessible dans l’app et dans la fiche (5.1.1(i)) | À faire : publier les pages et définir les deux adresses | `lib/legal.ts`, `.env.example`, `README.md` |
| Texte d’usage de la localisation (5.1.1) | Fait, en français, « quand l’app est utilisée » seulement | `app.json` (`locationWhenInUsePermission`) |
| Notifications non imposées et sans promotion (4.5.4) | Fait : désactivées par défaut, permission demandée à l’activation, rappels de pratique uniquement | `lib/notification-settings.ts`, `app/notifications.tsx`, `lib/notification-plan.ts` |
| Manifeste de confidentialité (API à raison obligatoire) | Fait pour l’app ; manifestes des SDK à contrôler dans le build | `app.json` > `ios.privacyManifests` ; `privacy-nutrition-labels.md` section 6 |
| Exactitude des métadonnées (2.3) | Textes de `listing.fr.md` limités à ce que le code fait. Captures à tirer de l’app réelle (`screenshots.md`). | `listing.fr.md` |
| Données de trou génériques | Quand le catalogue n’a pas la distance d’un trou, l’app en génère une et l’étiquette « Estimée ». Le « Hcp » du trou s’affiche « — » quand le catalogue n’a pas l’index (`lib/hole-view.ts`, `components/rounds/HoleOverviewCard.tsx`). Les formes et dangers générés dans le même fichier ne sont affichés nulle part. | `lib/hole-view.ts` |
| Distances GPS | Le calcul est sur l’appareil. L’app affiche « Estimée » sur les distances Avant, Milieu, Fond quand les données du trou sont estimées, comme sur la longueur du trou et le conseil de club. La fiche les dit estimées, comme les conditions (section 7). `[À DÉCIDER]` : rendre la mention systématique. | `components/rounds/HoleOverviewCard.tsx` |
| Application complète (2.1) | Compte de démonstration et serveur actifs pendant la revue | `review-notes.md` sections 6 et 9 |
| Famille d’appareils | iPhone seulement | `app.json` : `supportsTablet: false` |

## 8. Liste finale avant soumission

### Fait dans le dépôt

| Élément | Preuve |
|---|---|
| Identifiant `com.fairwayiq.app`, version `1.0.0`, iPhone seulement, portrait | `app.json` |
| Chiffrement : seulement HTTPS et Trousseau du système | `app.json` (`usesNonExemptEncryption: false`), `review-notes.md` section 7 |
| Manifeste de confidentialité de l’app | `app.json` |
| Localisation : texte en français, premier plan seulement | `app.json` |
| Création de compte, connexion, mot de passe oublié, suppression du compte dans l’app | `app/(auth)/`, `app/reset-password.tsx`, `app/edit-profile.tsx`, `supabase/functions/delete-account` |
| Divulgation IA avec consentement à l’inscription | `app/(auth)/register.tsx` |
| Abonnement : informations, restauration, gestion, liens | `app/paywall.tsx`, `lib/subscription.ts` |
| Webhook d’abonnement, quota IA côté serveur | `supabase/functions/revenuecat-webhook`, `ai-coach` |
| Export des données | `app/export-data.tsx`, `lib/data-export.ts` |
| Profil de build `production` avec numéro de build automatique | `eas.json` |
| Typage et tests à chaque pull request | `.github/workflows/ci.yml` |
| Brouillons des pages légales, fiche, étiquettes de confidentialité, notes de revue, captures | `legal-site/`, `docs/app-store/` |

### À faire par le propriétaire

1. Compte Apple Developer (adhésion payante), application créée dans App Store Connect, nom `FairwayIQ` disponible, accords pour les apps payantes, coordonnées bancaires et fiscales. Dépenses : décision du propriétaire.
2. `eas.json` > `submit.production.ios` : remplacer `YOUR_APPLE_ID_EMAIL`, `YOUR_APP_STORE_CONNECT_APP_ID`, `YOUR_APPLE_TEAM_ID`.
3. Variables EAS `production` : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_PRIVACY_POLICY_URL`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_SENTRY_DSN` ; pour les symboles Sentry : `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (secret).
4. Pages légales : remplir tous les champs `class="ph"` (`grep -o 'class="ph">[^<]*' legal-site/*.html`), faire relire par un juriste, retirer les bannières « BROUILLON », héberger, renseigner les adresses.
5. Supabase : migrations `001` à `021` appliquées ; fonctions `ai-coach`, `delete-account`, `course-catalog`, `revenuecat-webhook` (sans vérification JWT) déployées à jour ; secrets `ANTHROPIC_API_KEY` (usage payant), `REVENUECAT_WEBHOOK_SECRET`, limites `AI_COACH_DAILY_LIMIT_*` valides ; Auth : redirection `fairwayiq://**`, SMTP personnalisé, e-mails de confirmation et de réinitialisation. Projet actif pendant la revue.
6. RevenueCat : droit `premium`, offre courante avec forfaits mensuel et annuel, clé SDK iOS, webhook Production et Sandbox.
7. App Store Connect : fiche (`listing.fr.md`), abonnements (section 9 du même fichier), étiquettes de confidentialité, classe d’âge, droits sur le contenu, conformité à l’exportation, captures, notes de revue, compte de démonstration, contact de revue.
8. Build de production, TestFlight, essais sur appareil réel : notifications, carte de partage, GPS, lien de réinitialisation, achat en bac à sable, restauration, suppression de compte.
9. Décisions restantes : catégories de l’étiquette de confidentialité (`privacy-nutrition-labels.md` section 8), âge minimum, base légale et conservation chez Anthropic (`privacy.html`).

### Observations hors de cette PR (code)

1. `delete-account` : ajouter `club_distances` et `user_badges` à la liste explicite.
2. Sentry : l’UUID de l’utilisateur peut apparaître dans les adresses de requêtes et les journaux (`stores/auth.ts`, `stores/subscription.ts`, `app/_layout.tsx`, `lib/redact-url.ts`).
3. Aucun contrôle d’âge dans l’app. L’attribution OpenStreetMap, la mention « Généré par une IA » et le « Hcp » de repli sont traités.
