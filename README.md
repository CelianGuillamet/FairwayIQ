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

> Les clés sensibles (OpenAI, service role) se configurent directement dans les secrets Supabase Edge Functions, jamais dans le bundle Expo.

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
