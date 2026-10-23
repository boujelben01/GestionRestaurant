import React, { createContext, useState, useContext } from 'react';

// Crée un contexte pour le panier
const CartContext = createContext();

// Fournisseur de contexte du panier
export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);

  // Ajouter un article au panier
  const addToCart = async (item) => {
    try {
      const response = await fetch('http://localhost:5118/api/Cart/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(item),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'ajout de l\'article au panier');
      }

      const updatedCart = await response.json();
      setCart(updatedCart);
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'article au panier:', error);
    }
  };

  // Supprimer un article du panier
  const removeFromCart = async (itemId) => {
    try {
      const response = await fetch(`http://localhost:5118/api/Cart/remove/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression de l\'article du panier');
      }

      const updatedCart = await response.json();
      setCart(updatedCart);
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'article du panier:', error);
    }
  };

  // Vider le panier
  const clearCart = async () => {
    try {
      const response = await fetch('http://localhost:5118/api/Cart/clear', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erreur lors du vidage du panier');
      }

      setCart([]);
    } catch (error) {
      console.error('Erreur lors du vidage du panier:', error);
    }
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

// Hook pour utiliser le contexte du panier
export const useCart = () => {
  return useContext(CartContext);
};