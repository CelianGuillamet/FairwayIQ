# Captures d’écran App Store — FairwayIQ

Ce fichier liste quoi capturer, dans quel ordre, avec quelle légende et quelles données. Aucune image n’est générée ici : les captures sont à tirer de l’app réelle (règle 2.3 : les captures montrent l’app en usage, pas une maquette).

## 1. Jeux de captures exigés pour l’iPhone

L’app est pour iPhone seulement (`app.json` : `supportsTablet: false`) et en portrait (`orientation: portrait`) : captures en portrait, aucun jeu iPad à fournir. `[À VÉRIFIER sur App Store Connect]` qu’aucun jeu iPad n’est demandé.

| Jeu | Taille en pixels (portrait) | Statut |
|---|---|---|
| iPhone 6,9 pouces (iPhone 16 Pro Max, iPhone 17 Pro Max) | 1320 × 2868 | Sûr |
| iPhone 6,9 pouces, autres tailles acceptées | 1290 × 2796 ; 1260 × 2736 | `[À VÉRIFIER sur App Store Connect]` |
| iPhone 6,5 pouces | 1284 × 2778 ; 1242 × 2688 | Tailles sûres. `[À VÉRIFIER sur App Store Connect]` : ce jeu est-il encore exigé quand le jeu 6,9 pouces est fourni ? |
| Autres iPhone (6,3, 6,1, 5,5 pouces et plus petits) | Aucune taille à fournir en principe : Apple les déduit du plus grand jeu | `[À VÉRIFIER sur App Store Connect]` |

Règles générales :

| Règle | Statut |
|---|---|
| 1 capture au minimum, 10 au maximum par jeu | Sûr |
| Formats PNG ou JPEG | Sûr |
| Pas de transparence, pas de coins arrondis ajoutés | `[À VÉRIFIER sur App Store Connect]` |
| Les légendes sont dans l’image (pas un champ de la fiche) | Sûr |
| Une vidéo d’aperçu est facultative | Sûr : aucune n’est prévue |

Recommandation : produire les 6 captures en 1320 × 2868 ; ajouter le jeu 6,5 pouces seulement si App Store Connect le réclame.

## 2. Liste des 6 captures, dans l’ordre

Un seul thème pour les six (clair ou sombre, au choix du propriétaire ; l’icône et l’écran de lancement sont sombres, `#0A0A0C`). Pas de prix affiché : les montants dépendent d’App Store Connect.

| N° | Écran à capturer | État à montrer | Légende (français) |
|---|---|---|---|
| 1 | Onglet Score, mode saisie, trou en cours (`app/(tabs)/round.tsx`) | Parcours démo, 18 trous, 6 trous déjà saisis, trou 7 affiché avec le panneau coups, putts, green, fairway et pénalités | Saisis ta partie trou par trou |
| 2 | Onglet Accueil, haut de l’écran | Carte « Index estimé » avec sa valeur et la mention « méthode WHS, non officiel », courbe d’évolution des scores | Ton index estimé, non officiel |
| 3 | Écran « Où tu perds des coups » (`app/leaks.tsx`) | Au moins une fuite détaillée avec sa tendance et l’exercice associé | Vois où tu perds des coups |
| 4 | Écran « Diagnostic du round » (`app/diagnostic.tsx`) | Diagnostic enregistré : lecture globale, points forts, axes d’amélioration, priorités | Un diagnostic après chaque partie |
| 5 | Onglet Exercices (`app/(tabs)/drills.tsx`) | Filtre « Focus » ou « Tous », cartes d’exercices avec durée et résultats déjà enregistrés | 40 exercices en 5 catégories |
| 6 | Écran « Trophées » (`app/trophies.tsx`) | Plusieurs trophées obtenus et quelques-uns à débloquer avec leur progression | 18 trophées à débloquer |

Captures facultatives à ajouter si de la place reste (jusqu’à 10) : distances GPS jusqu’au green (« Distance au green », avant, milieu, fond) ; « Mon sac » avec au moins 3 clubs renseignés et le conseil de club ; débrief avec le coach IA (compte Premium, légende « Un débrief avec le coach IA » ; la carte doit alors porter l’étiquette Premium). Pour les distances GPS, la position se simule dans le simulateur (Features > Location > Custom Location) sur un parcours du catalogue qui a des points GPS ; ne pas fabriquer de distance à la main.

## 3. Données de démonstration

Compte dédié, e-mail fictif, aucune donnée réelle (voir `review-notes.md`, section 6). Prénom fictif, par exemple « Alex ». Handicap déclaré : 24. Fréquence : toutes les semaines. Objectif : faire baisser le handicap.

Pour que l’app calcule elle-même ce que les captures montrent :

| Besoin | Données à saisir dans l’app |
|---|---|
| Index estimé (capture 2) | Au moins 3 parties de 18 trous (`lib/rounds.ts` : minimum 3, les parties de 9 trous sont exclues). Suggestion : 6 parties sur « Parcours démo » (parcours libre, par 72), sur les 6 dernières semaines, scores 98, 96, 101, 94, 97, 92. Sans note de parcours (rating, slope), l’app affiche « Handicap Index estimé » et calcule 20,0 avec ces scores. Si la valeur affichée diffère, ne rien retoucher à la main. |
| Évolution (capture 2) | Les 6 parties ci-dessus. |
| Fuites (capture 3) | Au moins 3 parties où putts, greens et fairways sont vraiment saisis (une partie sans putts différents de 2, sans green ni fairway touché n’est pas considérée comme détaillée : `hasRecordedHoleDetails`). Varier : quelques 3-putts, 2 ou 3 pénalités, un ou deux doubles bogeys. Au moins 0,5 coup perdu sur 18 trous pour qu’une fuite apparaisse (`LEAKS_MIN_LOSS`). |
| Saisie en cours (capture 1) | Nouvelle partie sur « Parcours démo » : 6 trous saisis (2 pars, 3 bogeys, 1 double), trou 7 affiché. |
| Diagnostic (capture 4) | Un vrai diagnostic enregistré sur la dernière partie. Il vient d’un appel au coach IA (Anthropic) : un appel dans le quota gratuit de 3 par jour, mais facturé au propriétaire, qui décide. Un diagnostic simplifié (hors IA) n’est pas enregistré et porte un avertissement : il ne convient pas pour une capture. |
| Exercices (capture 5) | Une dizaine d’exercices réalisés sur plusieurs jours (série de jours visible), dont 4 avec un résultat (par exemple 7 sur 10), répartis sur au moins 3 catégories. |
| Trophées (capture 6) | Se déduisent des données ci-dessus : « Premier round », « 5 rounds », « Premier exercice », etc. Aucun trophée n’est attribué à la main. |

## 4. Méthode de capture

1. Build de l’app (développement ou TestFlight) sur le simulateur ou un appareil. Pas d’Expo Go pour la version finale des captures : les achats natifs n’y sont pas ceux du build réel.
2. Simulateur 6,9 pouces : `xcrun simctl list devices available`, choisir un iPhone 6,9 pouces.
3. Barre d’état propre : `xcrun simctl status_bar booted override --time 9:41 --batteryState charged --batteryLevel 100 --cellularBars 4 --wifiBars 3`, puis `xcrun simctl status_bar booted clear` à la fin.
4. Capture à la résolution native : `xcrun simctl io booted screenshot --type=png capture-01.png`. Contrôler la taille : 1320 × 2868.
5. Les légendes du tableau de la section 2 sont ajoutées après coup dans un outil de mise en page ; ne pas modifier le contenu de l’écran capturé.

## 5. Points à vérifier

1. `[À VÉRIFIER sur App Store Connect]` Tailles et jeux exigés (section 1).
2. Les légendes ne promettent rien que l’app ne fait pas : « Index estimé, non officiel » reprend le libellé de l’app ; « 40 exercices en 5 catégories » et « 18 trophées » correspondent à `lib/drill-library.ts` et `lib/badges.ts`.
3. Refaire les captures si l’interface change avant la soumission ; les écrans cités viennent de `main` au moment de la rédaction.
