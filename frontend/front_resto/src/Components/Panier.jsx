import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Panier = () => {
  const [panier, setPanier] = useState([]);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Récupérer les articles du panier depuis le local storage
    const storedPanier = JSON.parse(localStorage.getItem('panier')) || [];
    console.log('Stored Panier:', storedPanier); // Log the stored panier
    setPanier(storedPanier);
  }, []);

  const handleRemoveItem = async (itemId) => {
    const panierId = localStorage.getItem('panierId'); // Récupérer l'ID du panier depuis le local storage
    try {
      const response = await fetch(`http://localhost:5118/api/Panier/${panierId}/articles/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression de l\'article du panier');
      }

      const updatedPanier = panier.filter(item => item.id !== itemId);
      setPanier(updatedPanier);
      localStorage.setItem('panier', JSON.stringify(updatedPanier));
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'article du panier:', error);
    }
  };

  const handleClearPanier = async () => {
    const panierId = localStorage.getItem('panierId'); // Récupérer l'ID du panier depuis le local storage
    try {
      const response = await fetch(`http://localhost:5118/api/Panier/${panierId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erreur lors du vidage du panier');
      }

      setPanier([]);
      localStorage.removeItem('panier');
    } catch (error) {
      console.error('Erreur lors du vidage du panier:', error);
    }
  };

  const handlePlaceOrder = async () => {
    setIsPlacingOrder(true);
    try {
      const userId = localStorage.getItem('userId'); // Assuming userId is stored in localStorage
      if (!userId) {
        throw new Error('Utilisateur non connecté');
      }
      // Log the cart content
      console.log('Panier content:', panier);

      if (panier.length === 0) {
        throw new Error('Le panier est vide.');
      }

      console.log('Request payload:', userId); // Log the payload

      const response = await fetch('http://localhost:5118/api/Commande/validerCommandeParUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userId) // Send userId as a plain string
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error('Erreur lors de la passation de la commande');
      }

      setPanier([]);
      localStorage.removeItem('panier');
      setIsPlacingOrder(false);
      alert('Commande passée avec succès');
    } catch (error) {
      console.error('Erreur lors de la passation de la commande:', error);
      setIsPlacingOrder(false);
    }
  };

  const totalAmount = panier.reduce((total, item) => total + item.prix * item.quantity, 0);

  return (
    <div className="panier-container">
      <div className="navigation-buttons">
        <button className="nav-btn" onClick={() => navigate('/menu')}>Retour au menu</button>
        <button className="nav-btn" onClick={() => navigate('/homeLogin')}>Retour à l'accueil</button>
      </div>
      <h1>Votre Panier</h1>
      {panier.length > 0 ? (
        <>
          <ul className="panier-list">
            {panier.map(item => (
              <li key={item.id} className="panier-item-card">
                <img src={item.image} alt={item.nom} className="panier-item-image" />
                <div className="panier-item-details">
                  <h2>{item.nom}</h2>
                  <p>Quantité: {item.quantity}</p>
                  <p>Prix: {item.prix} €</p>
                  <p>Total: {item.quantity * item.prix} €</p>
                  <button className="remove-btn" onClick={() => handleRemoveItem(item.id)}>Supprimer</button>
                </div>
              </li>
            ))}
          </ul>
          <h2>Montant total: {totalAmount} €</h2>
          <div className="panier-actions">
            <button className="clear-btn" onClick={handleClearPanier}>Vider le panier</button>
            <button className="order-btn" onClick={handlePlaceOrder} disabled={isPlacingOrder}>
              {isPlacingOrder ? 'Passage de la commande...' : 'Confirmer la commande'}
            </button>
          </div>
        </>
      ) : (
        <p>Votre panier est vide.</p>
      )}
    </div>
  );
};

export default Panier;