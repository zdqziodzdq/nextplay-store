export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    prenom, nom, email, tel, adresse, cp, ville,
    event_id, fbp, fbc            // ← envoyés par le pixel côté navigateur
  } = req.body;

  if (!prenom || !nom || !email || !adresse || !cp || !ville) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  // PRIX FIXÉ CÔTÉ SERVEUR — on n'écoute plus le montant envoyé par le navigateur.
  // Pour un test à 1€ : ajoute la variable PRIX_CENTIMES = 100 sur Vercel, puis remets-la à 29900.
  const PRIX_CENTIMES = Number(process.env.PRIX_CENTIMES || 29900);

  // Infos techniques réclamées par Meta pour rattacher l'achat au clic sur la pub
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const userAgent = String(req.headers['user-agent'] || '');

  try {
    const response = await fetch('https://merchant.revolut.com/api/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Revolut-Api-Version': '2024-09-01'
      },
      body: JSON.stringify({
        amount: PRIX_CENTIMES,
        currency: 'EUR',
        description: 'Nintendo Switch 2 — Pack complet',

        // Champ "customer" (et non customer_email, qui était ignoré par Revolut)
        customer: {
          full_name: `${prenom} ${nom}`,
          email,
          ...(tel ? { phone: tel } : {})
        },

        // Champ "shipping" (et non shipping_address, ignoré lui aussi)
        shipping: {
          name: `${prenom} ${nom}`,
          ...(tel ? { phone: tel } : {}),
          address: {
            street_line_1: adresse,
            city: ville,
            postcode: cp,
            country_code: 'FR'
          }
        },

        // Détail article : exigé par Revolut pour les marchands e-commerce
        line_items: [
          {
            name: 'Nintendo Switch 2 — Pack complet',
            quantity: 1,
            unit_price: PRIX_CENTIMES,
            total_amount: PRIX_CENTIMES
          }
        ],

        // Tout ce que le webhook relira pour envoyer le Purchase à Meta
        metadata: {
          prenom,
          nom,
          email,
          tel: tel || '',
          adresse,
          cp,
          ville,
          event_id: event_id || '',
          fbp: fbp || '',
          fbc: fbc || '',
          ip,
          user_agent: userAgent
        }
      })
    });

    const order = await response.json();

    if (!response.ok) {
      console.error('Revolut error:', JSON.stringify(order));
      // On renvoie le message exact de Revolut : plus facile à diagnostiquer
      const detail = order.message || order.error || order.code || JSON.stringify(order);
      return res.status(500).json({ error: `Revolut : ${detail}` });
    }

    return res.status(200).json({
      checkout_url: order.checkout_url,
      order_id: order.id
    });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
