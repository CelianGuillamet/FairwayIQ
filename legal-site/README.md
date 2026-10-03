# FairwayIQ legal site (draft, static HTML + CSS, no build)
- Fill every highlighted bracketed placeholder (`grep -o 'class="ph">[^<]*' *.html`): [NOM / RAISON SOCIALE DE L'ÉDITEUR], [FORME JURIDIQUE], [ADRESSE POSTALE], [EMAIL DE CONTACT], [SIREN/SIRET si applicable], [DIRECTEUR DE LA PUBLICATION], [HÉBERGEUR DU SITE], [ADRESSE ET COORDONNÉES DE L'HÉBERGEUR], [MÉDIATEUR DE LA CONSOMMATION], [DATE DE MISE À JOUR], plus the [RÉGION ...], [DURÉE ...], [À CONFIRMER ...] and [À VÉRIFIER ...] fields of privacy.html and terms.html.
- After legal review, delete the "BROUILLON" banner (`div.draft-banner`) from index.html, privacy.html and terms.html; no `class="ph"` should remain.
- Deploy the folder as a static site (e.g. Vercel: root directory `legal-site`, framework preset "Other", no build command).
- Set `EXPO_PUBLIC_PRIVACY_POLICY_URL=https://<domain>/privacy.html` and `EXPO_PUBLIC_TERMS_URL=https://<domain>/terms.html` in the app environment.
