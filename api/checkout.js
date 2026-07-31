export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prenom, nom, email, tel, adresse, cp, ville } = req.body;

  if (!prenom || !nom || !email || !adresse || !cp || !ville) {
    return res.status(400).json({ error: 'Champs manquants' });
  }

  try {
    const response = await fetch('https://merchant.revolut.com/api/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.REVOLUT_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Revolut-Api-Version': '2024-09-01'
      },
      body: JSON.stringify({
        amount: 29900, // 299€ en centimes
        currency: 'EUR',
        customer_email: email,
        shipping_address: {
          street_line_1: adresse,
          city: ville,
          postcode: cp,
          country_code: 'FR'
        },
        metadata: {
          prenom,
          nom,
          email,
          tel,
          adresse: `${adresse}, ${cp} ${ville}`
        },
        description: 'Nintendo Switch 2 — Pack complet NEXTPLAY'
      })
    });

    const order = await response.json();

    if (!response.ok) {
      console.error('Revolut error:', order);
      return res.status(500).json({ error: 'Erreur création commande', details: order });
    }

    // Retourne l'URL de checkout Revolut
    return res.status(200).json({
      checkout_url: order.checkout_url,
      order_id: order.id
    });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}
