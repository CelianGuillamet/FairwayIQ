# FairwayIQ

Application mobile de coaching golf alimentée par l'IA. Enregistrez vos parties, analysez vos statistiques et recevez des conseils personnalisés pour progresser.

## Stack technique

- **Frontend** : React Native + Expo (Expo Router)
- **Backend** : Supabase (PostgreSQL, Auth, Edge Functions)
- **IA** : Claude API via Supabase Edge Functions
- **État global** : Zustand
- **Paiement** : RevenueCat

## Prérequis

- Node.js 20.19.4 ou plus récent (requis par React Native 0.81)
- Un projet Supabase configuré
- Pour les builds App Store : un compte Expo et EAS CLI (`npm install -g eas-cli`)
- Pour déployer les Edge Functions : Supabase CLI

Aucune installation globale d'Expo n'est nécessaire : les commandes passent par `npx expo` et les scripts npm.

## Installation

```bash
npm install
```

Copier le fichier d'exemple et renseigner les variables **client** :

```bash
cp .env.example .env.local
```

`.env.example` contient deux sections : la section 1 (client, `EXPO_PUBLIC_*`) est faite pour `.env.local` ; la section 2 (serveur) est commentée et ne doit jamais être recopiée dans `.env.local`.

Variables client dans `.env.local` (publiques : elles sont embarquées dans l'app) :

| Variable | Description | Obligatoire |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL de ton projet Supabase | Oui (l'app plante au lancement sans) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase (anon) | Oui (l'app plante au lancement sans) |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` | URL de la politique de confidentialité | Oui pour l'App Store (liens vides sinon) |
| `EXPO_PUBLIC_TERMS_URL` | URL des conditions d'utilisation | Oui pour l'App Store (liens vides sinon) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | Clés SDK publiques RevenueCat | Pour les achats |
| `EXPO_PUBLIC_SENTRY_DSN` | DSN Sentry | Pour le suivi des crashs |

> Les secrets serveur (Anthropic, webhook RevenueCat, etc.) se définissent uniquement avec `supabase secrets set`, jamais dans `.env.local` ni dans le bundle Expo. `SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont injectées automatiquement par Supabase dans les Edge Functions.

`lib/env-check.ts` exporte `assertClientEnv()`, appelée au chargement de `lib/supabase.ts` avant `createClient(...)` : en développement, elle lève une erreur explicite listant les variables client manquantes ; en production, elle journalise seulement l'erreur. Les tests Jest définissent des valeurs factices dans `jest.setup.js`.

## Coach IA (Edge Function `ai-coach`)

La fonction `supabase/functions/ai-coach` appelle l'API Messages d'Anthropic (Claude). Le diagnostic de round passe par un appel d'outil forcé (tool use) dont le résultat est validé côté serveur ; le débrief est une réponse texte.

Secrets Supabase à définir (jamais dans le bundle Expo) :

| Secret | Description | Défaut |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clé API Anthropic (obligatoire) | — |
| `ANTHROPIC_MODEL_PRIMARY` | Modèle Claude utilisé | `claude-haiku-4-5-20251001` |
| `AI_COACH_DAILY_LIMIT_FREE` | Appels IA par jour, utilisateur gratuit (`-1` ou `unlimited` : illimité ; toute autre valeur <= 0 est ignorée avec un avertissement) | `3` |
| `AI_COACH_DAILY_LIMIT_PREMIUM` | Appels IA par jour, utilisateur premium (`-1` ou `unlimited` : illimité ; toute autre valeur <= 0 est ignorée avec un avertissement) | `30` |

```bash
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-server-key
supabase secrets set ANTHROPIC_MODEL_PRIMARY=claude-sonnet-4-6   # optionnel
supabase functions deploy ai-coach
```

Le modèle doit accepter un `tool_choice` forcé : Sonnet 5.5, Opus 5.5 et Fable 5.1 le refusent (erreur 400).

## Gratuit vs Premium

| Fonctionnalité | Gratuit | Premium |
|---|---|---|
| Scorecard et rounds | Oui | Oui |
| Statistiques et dashboard | Oui | Oui |
| Bibliothèque de drills | Oui | Oui |
| Diagnostic IA de round | Oui, 3 appels IA par jour | Oui, 30 appels IA par jour |
| Débrief conversationnel post-round | Non | Oui |

- Le quota quotidien est commun à tous les appels `ai-coach` (diagnostic et messages de débrief), se règle via `AI_COACH_DAILY_LIMIT_FREE` / `AI_COACH_DAILY_LIMIT_PREMIUM` et change à minuit, heure de Paris. Un appel n'est pas décompté si la requête est invalide, et il est rendu si le fournisseur IA échoue.
- Le statut Premium fait foi côté serveur : la table `subscriptions` est synchronisée par la fonction `revenuecat-webhook`, et `ai-coach` répond `403` à `post_round_debrief` pour un utilisateur non Premium (le quota n'est alors pas consommé). L'app lit la même ligne `subscriptions` pour afficher ou masquer le débrief.
- RevenueCat est identifié avec l'UUID Supabase de l'utilisateur (`Purchases.logIn` à la connexion, `Purchases.logOut` à la déconnexion). Sans cela, le webhook reçoit un identifiant anonyme et ne peut pas retrouver l'utilisateur.

## Webhook RevenueCat (Edge Function `revenuecat-webhook`)

La fonction `supabase/functions/revenuecat-webhook` met à jour la table `subscriptions` à partir des événements RevenueCat. Ordre de mise en place :

1. Appliquer les migrations (`supabase db push`) **avant** de déployer la fonction : la migration `017_subscription_event_timestamp.sql` ajoute `subscriptions.last_event_at` et la fonction SQL `apply_subscription_event` utilisée par le webhook.
2. Définir le secret (jamais dans `.env.local` ni dans le bundle Expo) :

```bash
supabase secrets set REVENUECAT_WEBHOOK_SECRET=your-long-random-secret
```

3. Déployer la fonction sans vérification JWT (RevenueCat n'envoie pas de JWT Supabase ; l'authentification repose uniquement sur le secret ci-dessus) :

```bash
supabase functions deploy revenuecat-webhook --no-verify-jwt
```

`supabase/config.toml` désactive déjà `verify_jwt` pour cette fonction ; le flag rend la commande explicite.

4. Dans RevenueCat (Project settings > Integrations > Webhooks), créer le webhook :
   - URL : `https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook`
   - Authorization header value : exactement la valeur de `REVENUECAT_WEBHOOK_SECRET`, sans préfixe `Bearer` (la fonction compare l'en-tête `Authorization` à cette valeur, en temps constant).
   - Environnements : Production et Sandbox (App Review teste avec des achats sandbox).
   - Le bouton « Send test event » doit répondre 200.

Effet de chaque événement sur `subscriptions` :

| Événement RevenueCat | Effet |
|---|---|
| `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `UNCANCELLATION`, `SUBSCRIPTION_EXTENDED`, `REFUND_REVERSED` | Premium jusqu'à `expiration_at_ms` |
| `CANCELLATION` (auto-renouvellement désactivé) | Premium conservé, `expires_at` = `expiration_at_ms` ; le retrait se fait à l'`EXPIRATION` |
| `CANCELLATION` avec `cancel_reason = CUSTOMER_SUPPORT` (remboursement) | Premium retiré immédiatement |
| `EXPIRATION` | Premium retiré |
| `TRANSFER` | L'expiration connue du compte source est reprise par le compte cible, la source est retirée. Sans expiration connue (source anonyme ou inconnue), la cible attend le prochain `RENEWAL` |
| `BILLING_ISSUE`, `SUBSCRIPTION_PAUSED`, `TEMPORARY_ENTITLEMENT_GRANT`, `TEST` et types inconnus | Ignorés (réponse 200) |

Un `app_user_id` qui n'est pas un UUID (par exemple `$RCAnonymousID:...`) ou un compte supprimé est ignoré avec une réponse 200 : il n'y a rien à rattacher et RevenueCat ne doit pas réessayer. Un événement plus ancien que le dernier appliqué (`last_event_at`) est ignoré, de sorte qu'une `EXPIRATION` rejouée après un `RENEWAL` ne retire pas le Premium. Une erreur base de données renvoie 500 et RevenueCat réessaie.

## Mot de passe oublié

« Mot de passe oublié ? » sur l'écran de connexion envoie un lien (`supabase.auth.resetPasswordForEmail`) qui ouvre `app/reset-password.tsx`, où l'utilisateur choisit un nouveau mot de passe.

- **URL de redirection** : dans Supabase, Authentication > URL Configuration > Redirect URLs, autoriser `fairwayiq://reset-password`. Le joker `fairwayiq://**` couvre cette URL et `fairwayiq://auth-callback`. Si l'URL n'est pas autorisée, Supabase redirige vers la Site URL et le lien n'ouvre pas l'app. Dans Expo Go, l'URL à autoriser est de la forme `exp://<ip>:8081/--/reset-password`.
- **Même appareil** : le flux est en PKCE, donc le lien ne fonctionne que sur l'appareil qui l'a demandé, et seul le dernier email reçu reste valable.
- **Limite d'envoi** : le serveur d'emails intégré de Supabase est limité à quelques emails par heure pour tout le projet, et Supabase espace aussi les demandes pour une même adresse (60 s par défaut). L'app affiche alors « Trop de demandes pour le moment ». Pour la production, configurer un SMTP personnalisé (Authentication > Emails > SMTP Settings).

## Lancer l'app

```bash
# Expo Go (développement)
npm start

# iOS
npm run ios

# Android
npm run android
```

## Builds EAS (TestFlight / App Store)

Les builds cloud EAS ne lisent pas `.env.local` (ignoré par le dépôt). Sans configuration, un build partirait **sans connexion Supabase (crash au lancement) et avec des liens légaux vides**. Les variables client sont donc stockées côté EAS ; chaque profil de `eas.json` (`development`, `preview`, `production`) charge l'environnement EAS du même nom via `"environment"`.

Créer les variables (valeurs publiques, visibilité `plaintext`) pour chaque environnement utilisé. Les valeurs ci-dessous sont des exemples à remplacer :

```bash
eas login
eas env:set --name EXPO_PUBLIC_SUPABASE_URL --value https://your-project.supabase.co --environment production --environment preview --visibility plaintext
eas env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value your-public-anon-key --environment production --environment preview --visibility plaintext
eas env:set --name EXPO_PUBLIC_PRIVACY_POLICY_URL --value https://example.com/privacy --environment production --environment preview --visibility plaintext
eas env:set --name EXPO_PUBLIC_TERMS_URL --value https://example.com/terms --environment production --environment preview --visibility plaintext
```

Faire de même pour `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` et `EXPO_PUBLIC_SENTRY_DSN`. Sur les anciennes versions d'EAS CLI, `eas env:set` s'appelle `eas env:create`. Vérification : `eas env:list --environment production`.

Pour les mises à jour OTA, passer le même environnement : `eas update --environment production`.

### Sentry (source maps et symboles de debug)

Le plugin `@sentry/react-native` lit `SENTRY_ORG` et `SENTRY_PROJECT` dans l'environnement au moment du build (`app.json` est statique et ne peut pas les interpoler ; l'avertissement « Missing config for organization, project » est normal). Les définir côté EAS :

```bash
eas env:set --name SENTRY_ORG --value your-org-slug --environment production --visibility plaintext
eas env:set --name SENTRY_PROJECT --value your-project-slug --environment production --visibility plaintext
eas env:set --name SENTRY_AUTH_TOKEN --value your-auth-token --environment production --visibility secret
```

`SENTRY_AUTH_TOKEN` est un secret : ne l'écris jamais dans `eas.json`, `app.json` ni `.env.local`. `eas.json` définit `SENTRY_ALLOW_FAILURE=true` pour tous les profils : si ces variables manquent, `sentry-cli` n'interrompt pas le build (le crash reporting fonctionne, mais sans source maps). Pour désactiver complètement l'envoi, ajoute `SENTRY_DISABLE_AUTO_UPLOAD=true` dans le bloc `env` du profil.

### Avant la soumission

- `eas.json` > `submit.production.ios` : remplacer `YOUR_APPLE_ID_EMAIL`, `YOUR_APP_STORE_CONNECT_APP_ID` et `YOUR_APPLE_TEAM_ID`.
- Les deux URL légales doivent être publiées (voir `legal-site/`) et définies dans l'environnement EAS `production`.
- Le numéro de build iOS est incrémenté automatiquement (`autoIncrement`, `appVersionSource: remote`).

## Structure du projet

```
app/           # Routes Expo Router (tabs, modals)
components/    # Composants UI réutilisables
lib/           # Clients (Supabase, etc.) et utilitaires
stores/        # Stores Zustand
supabase/      # Migrations et Edge Functions
types/         # Types TypeScript partagés
constants/     # Thème, couleurs, config
```

## Base de données

Les migrations Supabase se trouvent dans `supabase/migrations/`. Pour les appliquer :

```bash
supabase db push
```
