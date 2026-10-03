# FairwayIQ

Application mobile de coaching golf alimentée par l'IA. Enregistrez vos parties, analysez vos statistiques et recevez des conseils personnalisés pour progresser.

## Stack technique

- **Frontend** : React Native + Expo (Expo Router)
- **Backend** : Supabase (PostgreSQL, Auth, Edge Functions)
- **IA** : Claude API via Supabase Edge Functions
- **État global** : Zustand
- **Paiement** : RevenueCat

## Prérequis

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Un projet Supabase configuré

## Installation

```bash
npm install
```

Copier le fichier d'exemple et renseigner les variables :

```bash
cp .env.example .env.local
```

Variables requises dans `.env.local` :

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL de ton projet Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé publique Supabase (anon) |

> Les clés sensibles (Anthropic, service role) se configurent directement dans les secrets Supabase Edge Functions, jamais dans le bundle Expo.

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
