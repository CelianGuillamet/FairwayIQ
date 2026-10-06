import { MAX_QUEUE_SIZE } from './round-save-queue';

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: 'offline',
    question: 'Que se passe-t-il si je n’ai pas de réseau à la fin de mon round ?',
    answer: `Ton round est gardé sur ton téléphone, puis envoyé dès que la connexion revient. Une bannière sur l’accueil montre les rounds en attente, avec un bouton pour réessayer. Tu peux en garder ${MAX_QUEUE_SIZE} en attente : au-delà, retrouve du réseau avant d’en enregistrer un autre. Ta saisie trou par trou est aussi conservée si tu quittes l’app avant la fin.`,
  },
  {
    id: 'handicap',
    question: 'Comment l’index estimé est-il calculé ?',
    answer:
      'L’index estimé suit la méthode WHS, mais il n’est pas officiel : il ne remplace pas l’index de ta fédération. Il faut au moins 3 parties de 18 trous. Seules tes 20 parties les plus récentes comptent, et les parties de 9 trous sont écartées. Quand un parcours n’a pas de rating ni de slope connus, l’app utilise une valeur neutre et l’index reste une estimation. Le handicap déclaré de ton profil n’est pas modifié.',
  },
  {
    id: 'gps',
    question: 'Les distances GPS sont-elles exactes ?',
    answer:
      'Non, ce sont des estimations. L’app mesure à vol d’oiseau la distance entre ta position et l’avant, le milieu et le fond du green. Quelques mètres d’écart sont possibles selon la précision de ton téléphone, le dénivelé et les données du parcours. Une distance de trou marquée « Estimée » ne vient pas du catalogue du parcours. Ta position sert seulement pendant la saisie d’un round : elle n’est ni enregistrée ni envoyée.',
  },
  {
    id: 'reminders',
    question: 'Comment régler ou couper les rappels ?',
    answer:
      'Ouvre Profil, puis Notifications. Tu peux activer ou couper chaque rappel : plan de la semaine, round à enregistrer, série à garder et exercice de la semaine, et choisir le jour et l’heure de ceux du round et de l’exercice. Les rappels sont programmés sur ton téléphone. Si rien n’arrive, vérifie que FairwayIQ est autorisé dans les réglages de notifications de ton iPhone.',
  },
  {
    id: 'data',
    question: 'Comment exporter ou supprimer mes données ?',
    answer:
      'Pour exporter, ouvre Profil, puis Exporter mes données : tu choisis un fichier JSON avec tout, ou un CSV de tes rounds. Pour supprimer, ouvre Profil, puis Modifier le profil, et touche « Supprimer mon compte » tout en bas. Ton profil, tes rounds et tes diagnostics sont alors effacés définitivement. Cela n’annule pas un abonnement Premium : annule-le avant, depuis les réglages Apple.',
  },
  {
    id: 'premium',
    question: 'Que change Premium et comment gérer mon abonnement ?',
    answer:
      'Premium ajoute le débrief conversationnel et étend la limite quotidienne du coach IA. Pour gérer ou annuler ton abonnement, touche « Gérer mon abonnement » dans Profil, ou ouvre Réglages, ton nom, puis Abonnements sur ton iPhone. Après un changement de téléphone ou une réinstallation, « Restaurer mes achats » est dans l’écran Premium.',
  },
  {
    id: 'password',
    question: 'J’ai oublié mon mot de passe, que faire ?',
    answer:
      'Sur l’écran de connexion, touche « Mot de passe oublié ? » et entre ton e-mail. Tu reçois un lien : ouvre-le sur ce même téléphone pour choisir un nouveau mot de passe. Seul le dernier lien reçu fonctionne. Si rien n’arrive, regarde tes courriers indésirables et patiente quelques minutes avant de redemander.',
  },
];
