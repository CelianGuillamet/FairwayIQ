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

`lib/env-check.ts` exporte `assertClientEnv()`, qui lève en développement une erreur explicite listant les variables client manquantes (en production, elle journalise seulement l'erreur). Pour l'activer, appelle-la dans `lib/supabase.ts` juste avant `createClient(...)` :

```ts
import { assertClientEnv } from './env-check';

assertClientEnv();
```

## Coach IA (Edge Function `ai-coach`)

La fonction `supabase/functions/ai-coach` appelle l'API Messages d'Anthropic (Claude). Le diagnostic de round passe par un appel d'outil forcé (tool use) dont le résultat est validé côté serveur ; le débrief est une réponse texte.

Secrets Supabase à définir (jamais dans le bundle Expo) :

| Secret | Description | Défaut |
|---|---|---|
| `ANTHROPIC_API_KEY` | Clé API Anthropic (obligatoire) | — |
| `ANTHROPIC_MODEL_PRIMARY` | Modèle Claude utilisé | `claude-haiku-4-5-20251001` |
| `AI_COACH_DAILY_LIMIT_FREE` | Appels IA par jour, utilisateur gratuit (<= 0 : illimité) | `3` |
| `AI_COACH_DAILY_LIMIT_PREMIUM` | Appels IA par jour, utilisateur premium (<= 0 : illimité) | `30` |

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

- Le quota quotidien est commun à tous les appels `ai-coach` (diagnostic et messages de débrief) et se règle via `AI_COACH_DAILY_LIMIT_FREE` / `AI_COACH_DAILY_LIMIT_PREMIUM`.
- Le statut Premium fait foi côté serveur : la table `subscriptions` est synchronisée par la fonction `revenuecat-webhook`, et `ai-coach` répond `403` à `post_round_debrief` pour un utilisateur non Premium (le quota n'est alors pas consommé). L'app lit la même ligne `subscriptions` pour afficher ou masquer le débrief.
- RevenueCat est identifié avec l'UUID Supabase de l'utilisateur (`Purchases.logIn` à la connexion, `Purchases.logOut` à la déconnexion). Sans cela, le webhook reçoit un identifiant anonyme et ne peut pas retrouver l'utilisateur.

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
