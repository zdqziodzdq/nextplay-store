// api/revolut-webhook.js — déclenche le Purchase Meta UNIQUEMENT quand le paiement est réellement encaissé
// À configurer dans Revolut Business → Merchant API → Webhooks → https://nextplay-store.com/api/revolut-webhook
//
// ⚠️ Le Purchase ne doit JAMAIS partir au clic "Confirmer" : sinon tu comptes des paniers abandonnés
// comme des ventes, Meta optimise sur du faux et ton ROAS affiché est mensonger.

import { sendPurchase } from '../lib/meta-capi.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const event = req.body;

    // Revolut envoie ORDER_COMPLETED quand le paiement est validé
    if (event.event !== 'ORDER_COMPLETED') return res.status(200).json({ ignored: true });

    const order = event.order_id ? await fetchRevolutOrder(event.order_id) : event;

    // metadata enregistrée au moment du /api/checkout (event_id, fbp, fbc, coordonnées client)
    const meta = order.metadata || {};

    await sendPurchase({
      eventId: meta.event_id,                       // MÊME id que côté pixel
      value: (order.order_amount?.value ?? 29900) / 100,
      customer: {
        email: meta.email,
        tel: meta.tel,
        prenom: meta.prenom,
        nom: meta.nom,
        cp: meta.cp,
        ville: meta.ville
      },
      context: {
        ip: meta.ip,
        userAgent: meta.user_agent,
        fbp: meta.fbp,
        fbc: meta.fbc,
        sourceUrl: 'https://nextplay-store.com/'
      }
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[webhook] ', e);
    return res.status(200).json({ ok: false }); // 200 pour éviter que Revolut rejoue en boucle
  }
}

async function fetchRevolutOrder(orderId) {
  const r = await fetch(`https://merchant.revolut.com/api/orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
      'Revolut-Api-Version': '2024-09-01'
    }
  });
  return r.json();
}

/* ------------------------------------------------------------------
   À AJOUTER dans ton /api/checkout.js existant, au moment de créer
   la commande Revolut — sinon le webhook n'aura rien à envoyer :

   metadata: {
     event_id: req.body.event_id,
     fbp: req.body.fbp,
     fbc: req.body.fbc,
     email: req.body.email,
     tel: req.body.tel,
     prenom: req.body.prenom,
     nom: req.body.nom,
     cp: req.body.cp,
     ville: req.body.ville,
     ip: req.headers['x-forwarded-for']?.split(',')[0],
     user_agent: req.headers['user-agent']
   }
------------------------------------------------------------------ */
