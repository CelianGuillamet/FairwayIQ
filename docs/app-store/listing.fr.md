# Fiche App Store — FairwayIQ (français)

Textes à coller dans App Store Connect (langue principale : français, France). Chaque champ limité est dans un bloc de code sous un titre de la forme « (N max) » : `node docs/app-store/check-limits.mjs` relit ces blocs, compte les caractères et signale tout dépassement. `node docs/app-store/check-limits.mjs --write` met à jour le tableau de la section 10.

Règle suivie : chaque phrase décrit une fonction présente dans le code (écrans `app/`, bibliothèques `lib/`, fonctions serveur `supabase/functions/`). Rien n’est annoncé qui n’existe pas, aucune allégation médicale, aucun niveau « pro ».

Les éléments `[À RENSEIGNER]` et `[À VÉRIFIER]` sont à régler par le propriétaire avant soumission.

## 1. Nom de l’app (30 max)

```text
FairwayIQ
```

Nom de l’app dans `app.json` : `FairwayIQ`. Disponibilité du nom sur l’App Store : `[À VÉRIFIER sur App Store Connect]` (le nom doit être unique).

## 2. Sous-titre (30 max)

```text
Golf : scores, stats, coach IA
```

## 3. Texte promotionnel (170 max)

Modifiable à tout moment sans nouvelle revue.

```text
Saisis tes parties trou par trou, suis ton Handicap Index estimé (non officiel) et travaille tes points faibles avec 40 exercices et un diagnostic après chaque partie.
```

## 4. Description (4000 max)

Les adresses réelles des deux liens du bloc « Abonnement » ajouteront quelques dizaines de caractères aux marques `[À RENSEIGNER]` : la marge du tableau de la section 10 la couvre largement.

```text
FairwayIQ t’aide à suivre tes parties de golf, à repérer où tu perds des coups et à t’entraîner en conséquence. L’application est en français.

SAISIR TA PARTIE
• Scorecard trou par trou, sur 9 ou 18 trous : coups, putts, green en régulation, fairway, pénalités.
• Parcours et départ choisis dans un catalogue, ou saisie libre : le parcours est optionnel.
• Brouillon enregistré automatiquement, partie modifiable après coup.
• Saisie hors connexion : sans réseau, la partie est gardée sur ton téléphone et envoyée dès que la connexion revient.
• Carte de la partie partageable en image.

COMPRENDRE TON JEU
• Handicap Index estimé selon la méthode WHS, à partir de 3 parties de 18 trous. Estimation non officielle : elle ne remplace pas ton index fédéral.
• Statistiques : évolution des scores, moyenne par rapport au par, putts, greens en régulation, fairways, pénalités.
• « Où tu perds des coups » : putting, pénalités, gros scores, départs, approches ou petit jeu, repérés sur tes dernières parties.
• Diagnostic après chaque partie, rédigé par un coach IA : points forts, axes d’amélioration, plan de la semaine. Si le coach IA est indisponible, un diagnostic simplifié est affiché.

T’ENTRAÎNER
• 40 exercices en 5 catégories : putting, petit jeu, approches, mise en jeu, mental.
• Plan de la semaine choisi d’après ton diagnostic, résultats d’exercices (réussis sur tentés) et série de jours.
• Objectif de la semaine, défi du mois et 18 trophées à débloquer.

SUR LE PARCOURS
• Distances GPS jusqu’à l’avant, au milieu et au fond du green, sur les parcours dont les points GPS sont disponibles. Elles sont estimées : leur précision dépend de ton téléphone et des données du parcours.
• Ta position reste sur ton téléphone : elle n’est ni envoyée ni enregistrée. La localisation n’est demandée que pendant l’utilisation de l’app.
• « Mon sac » : saisis la distance de vol (carry) de tes clubs. Avec au moins 3 clubs, l’app suggère un club à titre indicatif.

TES DONNÉES
• Rappels facultatifs, désactivés par défaut, programmés sur ton téléphone.
• Export (JSON ou CSV) et suppression du compte directement dans l’app.
• Pas de publicité.

PREMIUM
• Débrief conversationnel : pose tes questions après le round et clarifie les coups qui t’ont coûté des points.
• Coach IA étendu : jusqu’à 30 analyses et échanges avec le coach IA par jour, contre 3 en version gratuite.
Le reste, dont le diagnostic IA de chaque partie (3 utilisations par jour), est gratuit.

ABONNEMENT
Premium est un abonnement mensuel ou annuel à renouvellement automatique. Le prix, la durée et l’éventuel essai gratuit (selon ton éligibilité) s’affichent avant l’achat. Le paiement est débité de ton compte Apple à la confirmation de l’achat, ou à la fin de l’essai. L’abonnement se renouvelle automatiquement, sauf annulation au moins 24 heures avant la fin de la période en cours. Gère-le ou annule-le dans Réglages > ton nom > Abonnements. Supprimer ton compte FairwayIQ n’annule pas l’abonnement.
Conditions d’utilisation : [À RENSEIGNER : adresse de terms.html]
Politique de confidentialité : [À RENSEIGNER : adresse de privacy.html]

À SAVOIR
• Le coach IA (Claude, d’Anthropic) donne des conseils généraux, parfois inexacts, qui ne remplacent ni un professeur de golf ni un avis médical. Pour les produire, une partie de tes données (profil de jeu, scores, notes, messages de débrief) est transmise à Anthropic : détail dans la politique de confidentialité.
• Index estimé et statistiques sont non officiels. Les données de parcours peuvent être incomplètes ou inexactes ; respecte les règles locales sur les appareils de mesure de distance.
• Données de parcours en partie issues d’OpenStreetMap (© contributeurs d’OpenStreetMap, licence ODbL).
```

## 5. Mots-clés (100 max)

Sans espace après les virgules. Les mots déjà présents dans le nom et le sous-titre (golf, scores, stats, coach, IA) sont volontairement absents : ils sont déjà indexés. Aucun nom de concurrent, aucune marque.

```text
handicap,index,putting,exercices,entraînement,parcours,GPS,distances,green,fairway,birdie,trophées
```

## 6. Nouveautés de la version 1.0 (4000 max)

```text
Première version de FairwayIQ.
• Scorecard trou par trou (9 ou 18 trous), brouillon automatique et saisie hors connexion
• Handicap Index estimé (méthode WHS, non officiel), statistiques et analyse « Où tu perds des coups »
• Diagnostic IA après chaque partie, débrief conversationnel avec Premium
• 40 exercices, plan de la semaine, objectif de la semaine, défi du mois et 18 trophées
• Distances GPS jusqu’au green sur les parcours compatibles, « Mon sac » et conseil de club indicatif
• Rappels facultatifs, export des données et suppression du compte dans l’app
```

## 7. Catégories

| Catégorie | Choix | Raison |
|---|---|---|
| Principale | Sports | L’app suit une pratique sportive (parties, exercices) et ne vise pas la santé. |
| Secondaire | Aucune recommandée | Éviter « Santé et forme » : cohérent avec l’absence d’allégation médicale (voir `age-rating-and-compliance.md`). À réévaluer par le propriétaire. |

## 8. Adresses et mentions

| Champ App Store Connect | Valeur | État |
|---|---|---|
| URL d’assistance (obligatoire) | `[À RENSEIGNER]` | Page ou adresse qui permet de joindre le support. Doit être joignable pendant la revue. |
| URL marketing (facultative) | `[À RENSEIGNER]` | Peut rester vide. |
| URL de la politique de confidentialité (obligatoire) | `[À RENSEIGNER]` | Adresse publique de `legal-site/privacy.html` une fois hébergée. Même valeur que `EXPO_PUBLIC_PRIVACY_POLICY_URL`. |
| Conditions d’utilisation (EULA) | `[À RENSEIGNER]` | Adresse publique de `legal-site/terms.html`. Même valeur que `EXPO_PUBLIC_TERMS_URL`. Lien aussi présent dans la description (section 4). |
| Copyright | `© 2026 [À RENSEIGNER : titulaire des droits]` | Nom de l’éditeur, comme dans les pages légales. |
| Langue principale | Français (France) | L’app n’existe qu’en français. |
| Prix de l’app | Gratuit, avec achats intégrés | L’abonnement Premium est vendu par achat intégré (Apple), voir section 9. |

## 9. Abonnements (App Store Connect > Abonnements)

Le code attend dans RevenueCat une offre courante contenant un forfait mensuel (`$rc_monthly`) et un forfait annuel (`$rc_annual`), et un droit d’accès nommé `premium` (`lib/subscription.ts`, `lib/purchases.ts`). Les identifiants produit App Store ne sont pas dans le dépôt : `[À RENSEIGNER : identifiant du produit mensuel]` et `[À RENSEIGNER : identifiant du produit annuel]`.

Groupe d’abonnements : un seul groupe, qui contient les deux formules. Nom de référence : `FairwayIQ Premium`.

Les textes ci-dessous sont les noms et descriptions affichés par Apple (limites : 30 et 45 caractères, `[À VÉRIFIER sur App Store Connect]`).

### Abonnement mensuel : nom d’affichage (30 max)

```text
Premium mensuel
```

### Abonnement mensuel : description (45 max)

```text
Débrief conversationnel et coach IA étendu
```

### Abonnement annuel : nom d’affichage (30 max)

```text
Premium annuel
```

### Abonnement annuel : description (45 max)

```text
Débrief conversationnel et coach IA étendu
```

Le prix et l’éventuel essai gratuit se règlent dans App Store Connect (`[À RENSEIGNER : prix mensuel, prix annuel, essai gratuit oui ou non et durée]`). L’écran Premium lit le prix et l’essai auprès d’Apple : il n’y a aucun montant ni durée d’essai écrits en dur dans l’app. Les pages légales ne doivent donc pas non plus fixer une durée d’essai tant que le choix n’est pas fait.

## 10. Tableau des limites

Généré par `node docs/app-store/check-limits.mjs --write`. Les caractères sont comptés par points de code, retours à la ligne compris.

<!-- limites:debut -->
| Champ | Limite | Caractères | Marge | Statut |
|---|---:|---:|---:|---|
| 1. Nom de l’app | 30 | 9 | 21 | OK |
| 2. Sous-titre | 30 | 30 | 0 | OK |
| 3. Texte promotionnel | 170 | 167 | 3 | OK |
| 4. Description | 4000 | 3731 | 269 | OK |
| 5. Mots-clés | 100 | 98 | 2 | OK |
| 6. Nouveautés de la version 1.0 | 4000 | 565 | 3435 | OK |
| Abonnement mensuel : nom d’affichage | 30 | 15 | 15 | OK |
| Abonnement mensuel : description | 45 | 42 | 3 | OK |
| Abonnement annuel : nom d’affichage | 30 | 14 | 16 | OK |
| Abonnement annuel : description | 45 | 42 | 3 | OK |
<!-- limites:fin -->
