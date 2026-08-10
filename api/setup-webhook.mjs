// api/setup-webhook.mjs
// FICHIER TEMPORAIRE — à supprimer une fois utilisé.
//
// Revolut ne propose pas de bouton "webhook" dans son interface : il faut le créer
// par un appel API. Ce fichier le fait pour toi.
//
// Utilisation :
//   1. Déposer ce fichier dans api/
//   2. Déployer
//   3. Ouvrir https://nextplay-store.com/api/setup-webhook dans le navigateur
//   4. Supprimer ce fichier et redéployer

const WEBHOOK_URL = 'https://nextplay-store.com/api/revolut-webhook';
const EVENTS = ['ORDER_COMPLETED'];

// On essaie plusieurs variantes de l'API Revolut (les versions changent régulièrement)
const CANDIDATS = [
  { base: 'https://merchant.revolut.com/api/webhooks', version: '2026-04-20' },
  { base: 'https://merchant.revolut.com/api/webhooks', version: '2024-09-01' },
  { base: 'https://merchant.revolut.com/api/1.0/webhooks', version: null }
];

function entetes(version) {
  const h = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.REVOLUT_SECRET_KEY}`
  };
  if (version) h['Revolut-Api-Version'] = version;
  return h;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!process.env.REVOLUT_SECRET_KEY) {
    return res.status(200).send(page(
      '❌ Clé manquante',
      "La variable REVOLUT_SECRET_KEY n'existe pas sur Vercel. Ajoute-la dans Settings → Environment Variables, redéploie, puis recharge cette page."
    ));
  }

  const journal = [];

  for (const c of CANDIDATS) {
    try {
      // 1) On regarde si le webhook existe déjà
      const liste = await fetch(c.base, { headers: entetes(c.version) });
      if (liste.ok) {
        const data = await liste.json();
        const tableau = Array.isArray(data) ? data : (data.webhooks || []);
        const dejaLa = tableau.find((w) => w.url === WEBHOOK_URL);
        if (dejaLa) {
          return res.status(200).send(page(
            '✅ Déjà configuré',
            `Le webhook existe déjà (id : ${dejaLa.id}). Tu n'as rien à faire.<br><br>
             <b>Supprime maintenant le fichier api/setup-webhook.mjs et redéploie.</b>`
          ));
        }
      }

      // 2) Création
      const creation = await fetch(c.base, {
        method: 'POST',
        headers: entetes(c.version),
        body: JSON.stringify({ url: WEBHOOK_URL, events: EVENTS })
      });
      const corps = await creation.json().catch(() => ({}));

      if (creation.ok) {
        return res.status(200).send(page(
          '✅ Webhook créé',
          `Revolut préviendra désormais ton site à chaque paiement encaissé.<br><br>
           URL : ${WEBHOOK_URL}<br>
           Événement : ORDER_COMPLETED<br>
           ${corps.signing_secret ? `<br>Clé de signature (garde-la de côté) :<br><code>${corps.signing_secret}</code><br>` : ''}
           <br><b>Supprime maintenant le fichier api/setup-webhook.mjs et redéploie.</b>`
        ));
      }

      journal.push(`${c.base} (${c.version || 'sans version'}) → ${creation.status} ${JSON.stringify(corps)}`);
    } catch (e) {
      journal.push(`${c.base} → ${e.message}`);
    }
  }

  return res.status(200).send(page(
    '❌ Échec',
    `Aucune tentative n'a fonctionné. Copie-colle ce qui suit dans le chat :<br><br>
     <pre style="white-space:pre-wrap">${journal.join('\n\n')}</pre>`
  ));
}

function page(titre, corps) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${titre}</title></head>
  <body style="font-family:system-ui,sans-serif;background:#0d0e12;color:#f3f1ea;padding:40px 24px;line-height:1.6;">
  <div style="max-width:640px;margin:0 auto;">
    <h1 style="font-size:22px;">${titre}</h1>
    <p style="color:#c9ccd3;">${corps}</p>
  </div></body></html>`;
}
