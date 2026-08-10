// api/revolut-webhook.mjs
// Envoie l'événement "Purchase" à Meta quand un paiement Revolut est RÉELLEMENT encaissé.
// Fichier autonome : aucun import externe, aucun dossier à créer.
//
// Variables d'environnement à créer sur Vercel :
//   META_PIXEL_ID      = 1807278287099246
//   META_CAPI_TOKEN    = ton nouveau token (JAMAIS dans le HTML)
//   REVOLUT_SECRET_KEY = déjà présente normalement (utilisée par checkout.js)

import crypto from 'crypto';

const PIXEL_ID = process.env.META_PIXEL_ID;
const CAPI_TOKEN = process.env.META_CAPI_TOKEN;
const API_VERSION = 'v21.0';

const sha256 = (v) =>
  v ? crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex') : undefined;

// 0612345678 -> 33612345678 (format attendu par Meta)
function hashPhone(tel) {
  if (!tel) return undefined;
  let d = String(tel).replace(/\D/g, '');
  if (d.startsWith('0')) d = '33' + d.slice(1);
  if (d.length === 9) d = '33' + d;
  return sha256(d);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const event = req.body || {};

    // On ne réagit qu'aux paiements réussis
    const type = String(event.event || event.type || '').toUpperCase();
    if (!type.includes('COMPLET')) {
      return res.status(200).json({ ignored: type });
    }

    const orderId = event.order_id || event.id;
    const order = orderId ? await fetchRevolutOrder(orderId) : {};

    // metadata = bonus si tu l'ajoutes plus tard dans checkout.js.
    // Sinon on se rabat sur les infos que Revolut possède déjà : ça marche quand même.
    const m = order.metadata || {};
    const c = order.customer || {};

    const fullName = (m.prenom || m.nom) ? '' : (c.full_name || c.name || '');
    const parts = fullName.split(' ').filter(Boolean);
    const autoPrenom = parts[0] || '';
    const autoNom = parts.slice(1).join(' ');

    const centimes = order.order_amount?.value ?? order.amount ?? 29900;

    const payload = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: m.event_id || `revolut_${orderId}`, // évite les doublons
          event_source_url: 'https://nextplay-store.com/',
          action_source: 'website',
          user_data: {
            em: sha256(m.email || c.email),
            ph: hashPhone(m.tel || c.phone),
            fn: sha256(m.prenom || autoPrenom),
            ln: sha256(m.nom || autoNom),
            ct: m.ville ? sha256(String(m.ville).replace(/\s/g, '')) : undefined,
            zp: sha256(m.cp),
            country: sha256('fr'),
            client_ip_address: m.ip,
            client_user_agent: m.user_agent,
            fbp: m.fbp || undefined,
            fbc: m.fbc || undefined
          },
          custom_data: {
            currency: 'EUR',
            value: Number(centimes) / 100,
            content_ids: ['switch2-pack-nextplay'],
            content_name: 'Nintendo Switch 2 — Pack NEXTPLAY',
            content_type: 'product',
            num_items: 1
          }
        }
      ]
    };

    if (!PIXEL_ID || !CAPI_TOKEN) {
      console.warn('[CAPI] Variables Vercel manquantes — rien envoyé');
      return res.status(200).json({ ok: false, reason: 'env manquantes' });
    }

    const r = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
    const out = await r.json();
    console.log(r.ok ? '[CAPI] Purchase OK' : '[CAPI] ERREUR', out);

    return res.status(200).json({ ok: r.ok });
  } catch (e) {
    console.error('[webhook]', e);
    // On répond 200 pour éviter que Revolut renvoie le webhook en boucle
    return res.status(200).json({ ok: false });
  }
}

async function fetchRevolutOrder(orderId) {
  try {
    const r = await fetch(`https://merchant.revolut.com/api/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
        'Revolut-Api-Version': '2024-09-01'
      }
    });
    return await r.json();
  } catch {
    return {};
  }
}
