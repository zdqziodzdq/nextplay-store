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
  // Pour un test à 1€ : ajoute la variable PRIX_CENTIMES = 100 sur Vercel, puis remets 29900.
  const PRIX_CENTIMES = Number(process.env.PRIX_CENTIMES || 29900);

  // Infos techniques réclamées par Meta pour rattacher l'achat au clic sur la pub
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const userAgent = String(req.headers['user-agent'] || '');

  // Base commune à toutes les tentatives — contient tout ce dont Meta a besoin
  const base = {
    amount: PRIX_CENTIMES,
    currency: 'EUR',
    description: 'Nintendo Switch 2 — Pack complet',
    customer: {
      full_name: `${prenom} ${nom}`,
      email,
      ...(tel ? { phone: tel } : {})
    },
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
  };

  const livraison = {
    shipping: {
      name: `${prenom} ${nom}`,
      ...(tel ? { phone: tel } : {}),
      address: {
        street_line_1: adresse,
        city: ville,
        postcode: cp,
        country_code: 'FR'
      }
    }
  };

  // quantity est un OBJET chez Revolut, pas un nombre
  const articles = {
    line_items: [
      {
        name: 'Nintendo Switch 2 — Pack complet',
        type: 'physical',
        quantity: { value: 1, unit: 'piece' },
        unit_price_amount: PRIX_CENTIMES,
        total_amount: PRIX_CENTIMES
      }
    ]
  };

  // On tente du plus complet au plus simple. Si Revolut refuse un champ optionnel,
  // on retire ce champ et on réessaie : la commande passe toujours.
  const tentatives = [
    { nom: 'complet', corps: { ...base, ...livraison, ...articles } },
    { nom: 'sans line_items', corps: { ...base, ...livraison } },
    { nom: 'minimal', corps: base }
  ];

  let derniereErreur = null;

  for (const t of tentatives) {
    try {
      const response = await fetch('https://merchant.revolut.com/api/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
          'Content-Type': 'application/json',
          'Revolut-Api-Version': '2024-09-01'
        },
        body: JSON.stringify(t.corps)
      });

      const order = await response.json();

      if (response.ok) {
        console.log(`[checkout] Commande créée — variante « ${t.nom} »`);
        return res.status(200).json({
          checkout_url: order.checkout_url,
          order_id: order.id
        });
      }

      derniereErreur = order.message || order.error || order.code || JSON.stringify(order);
      console.error(`[checkout] Variante « ${t.nom} » refusée : ${derniereErreur}`);
      // on continue avec la variante suivante
    } catch (err) {
      derniereErreur = err.message;
      console.error(`[checkout] Variante « ${t.nom} » — erreur réseau :`, err);
    }
  }

  console.error('[checkout] Toutes les variantes ont échoué.');
  return res.status(500).json({ error: `Revolut : ${derniereErreur}` });
}
