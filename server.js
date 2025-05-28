const express = require('express');
const cors = require('cors');
const path = require('path');
const stripe = require('stripe')('sk_test_51RTMhuLFHVbWJugPsyZ1UBCcjWCN7jtbEiQf5va3m8TDcPJe7tLkr752svp4vkQaizOnGmCDnkpcICmDIghnRpq000gTPPtaKB');

const app = express();

app.use(cors());
app.use(express.json());

// Servir les fichiers statiques (index.html, success.html, cancel.html, etc.)
app.use(express.static(path.join(__dirname)));

// Création de session Stripe
app.post('/create-checkout-session', async (req, res) => {
  const panier = req.body.panier;

  console.log('--- Panier reçu ---');
  console.dir(panier, { depth: null });

  const line_items = panier.map((pizza, index) => {
    const supplements = pizza.supplements || [];
    const validSupplements = supplements.filter(sup => sup.id !== 'aucun');

    const supplementsText = validSupplements.length > 0
      ? ' + Suppléments : ' + validSupplements.map(sup => sup.nom).join(', ')
      : '';

    const supplementsTotal = validSupplements.reduce((acc, sup) => acc + sup.prix, 0);
    const totalPrice = pizza.prix + supplementsTotal;

    console.log(`\nPizza #${index + 1}`);
    console.log(`Nom: ${pizza.nom}`);
    console.log(`Suppléments: ${supplementsText || 'Aucun'}`);
    console.log(`Prix base: ${pizza.prix}€`);
    console.log(`Prix suppléments: ${supplementsTotal}€`);
    console.log(`Prix total: ${totalPrice}€`);

    return {
      price_data: {
        currency: 'eur',
        product_data: {
          name: pizza.nom + supplementsText,
        },
        unit_amount: Math.round(totalPrice * 100),
      },
      quantity: 1,
    };
  });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      success_url: 'http://localhost:3000/success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:3000/cancel.html',
    });

    res.json({ id: session.id });
  } catch (err) {
    console.error('Erreur Stripe:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la session' });
  }
});

// Récupérer la session avec ses line items
app.get('/api/session/:id', async (req, res) => {
  const sessionId = req.params.id;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
      limit: 100,
      expand: ['data.price.product']
    });

    // Ajouter les line_items à la session pour la réponse
    session.line_items = lineItems;

    res.json(session);
  } catch (err) {
    console.error('Erreur récupération session:', err);
    res.status(500).json({ error: 'Erreur récupération session' });
  }
});

// Démarrer le serveur
app.listen(3000, () => {
  console.log('✅ Serveur démarré sur http://localhost:3000');
});
