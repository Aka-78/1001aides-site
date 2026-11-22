// Fonction Vercel : reçoit le formulaire de contact et l'envoie par e-mail via Resend.
// Variables d'environnement à définir dans Vercel :
//   RESEND_API_KEY  clé API Resend (fournie par l'intégration Resend du Marketplace Vercel)
//   CONTACT_TO      adresse qui reçoit les messages (par défaut contact@1001aides.org)
//   RESEND_EMAIL_DOMAIN  domaine vérifié chez Resend (fourni par l'intégration), ex. 1001aides.org
//   CONTACT_FROM    facultatif : expéditeur complet, ex. "Site 1001aides <site@1001aides.org>"
// Sans RESEND_API_KEY, la fonction répond 503 et le site propose l'envoi par la messagerie du visiteur.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OBJETS = ["Faire un don", "Donner du matériel", "Devenir volontaire", "Proposer un projet", "Autre demande"];
const LIMITS = { prenom: 80, nom: 80, societe: 120, contact: 120, email: 160, telephone: 30, message: 4000,
  mat_type: 60, mat_desc: 300, mat_qte: 60, mat_etat: 40, mat_lieu: 120 };

function clean(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode non autorisée." });
  }
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Champ piège anti-robots : un humain ne le voit pas et le laisse vide.
  if (clean(body.site_web, 200)) return res.status(200).json({ ok: true });

  const type = body.type === "societe" ? "societe" : "particulier";
  const d = {};
  for (const [k, max] of Object.entries(LIMITS)) d[k] = clean(body[k], max);
  const objet = OBJETS.includes(body.objet) ? body.objet : "Autre demande";

  const materiel = objet === "Donner du matériel";
  const missing = ["email"].concat(materiel ? ["mat_type", "mat_desc", "mat_lieu"] : ["message"])
    .concat(type === "societe" ? ["societe", "contact"] : ["prenom", "nom"])
    .filter((k) => !d[k]);
  if (missing.length) return res.status(400).json({ error: "Merci de compléter les champs obligatoires." });
  if (!EMAIL_RE.test(d.email)) return res.status(400).json({ error: "L'adresse e-mail n'est pas valide." });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "Envoi non configuré." });

  const qui = type === "societe" ? `${d.societe} (contact : ${d.contact})` : `${d.prenom} ${d.nom}`;
  const text = [
    `Nouveau message depuis le formulaire de contact de 1001aides.org`,
    ``,
    `Type : ${type === "societe" ? "Société / organisation" : "Particulier"}`,
    type === "societe" ? `Société : ${d.societe}\nPersonne à contacter : ${d.contact}` : `Prénom : ${d.prenom}\nNom : ${d.nom}`,
    `E-mail : ${d.email}`,
    `Téléphone : ${d.telephone || "non renseigné"}`,
    `Objet : ${objet}`,
    ...(materiel ? [
      ``,
      `Don de matériel`,
      `Type : ${d.mat_type}`,
      `Description : ${d.mat_desc}`,
      `Quantité : ${d.mat_qte || "non précisée"}`,
      `État : ${d.mat_etat || "non précisé"}`,
      `Lieu d'enlèvement : ${d.mat_lieu}`,
    ] : []),
    ``,
    `Message :`,
    d.message || "(aucun)",
  ].join("\n");

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM
          || (process.env.RESEND_EMAIL_DOMAIN ? `Site 1001aides <site@${process.env.RESEND_EMAIL_DOMAIN}>` : "Site 1001aides <onboarding@resend.dev>"),
        to: [process.env.CONTACT_TO || "contact@1001aides.org"],
        reply_to: d.email,
        subject: `[Site] ${objet} – ${qui}`.slice(0, 200),
        text,
      }),
    });
    if (!r.ok) {
      console.error("Resend a refusé l'envoi", r.status, await r.text());
      return res.status(502).json({ error: "L'envoi a échoué." });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("Erreur d'envoi", e);
    return res.status(502).json({ error: "L'envoi a échoué." });
  }
};
