# 1001aides.org

Site de l association 1001aides : pompage solaire de puits profonds au Senegal.

Site statique (index.html), deploye sur Vercel.

## Formulaire de contact

Le formulaire (section Contact) envoie les messages via la fonction Vercel `api/contact.js`, qui utilise Resend.

Variables d'environnement à définir dans Vercel (Settings > Environment Variables) :

- `RESEND_API_KEY` : clé API Resend (intégration Resend du Marketplace Vercel)
- `CONTACT_TO` : adresse qui reçoit les messages (par défaut contact@1001aides.org)
- `CONTACT_FROM` : expéditeur sur un domaine vérifié chez Resend, ex. `Site 1001aides <site@1001aides.org>`

Tant que `RESEND_API_KEY` n'est pas définie, le formulaire propose au visiteur d'envoyer son message, déjà rempli, depuis sa messagerie.
