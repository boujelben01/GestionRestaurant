import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaShoppingCart, FaUser } from "react-icons/fa";

const Menu = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [quantities, setQuantities] = useState({}); // État pour les quantités des articles
  const [message, setMessage] = useState(''); // État pour le message de succès
  const navigate = useNavigate();

  // Objet de correspondance pour les images des articles
  const articleImages = {
    "lablebi adhma thon": "src/assets/LABLABI.webp",
    "makloub chawarma": "src/assets/makloub.png",
    "plat tounsi": "src/assets/shan-tounsi.jpg",
    "glace": "src/assets/glace.webp"
  };

  useEffect(() => {
    const fetchMenuData = async () => {
      try {
        const response = await fetch('http://localhost:5118/api/Articles'); // Remplacez par l'URL de votre API
        const data = await response.json();
        // Ajoutez manuellement les URL des images pour les articles
        const itemsWithImages = data.map(item => {
          if (item.nom) {
            return {
              ...item,
              image: articleImages[item.nom.toLowerCase()] || "src/assets/default.jpg" // Utilisez l'image par défaut si aucune correspondance n'est trouvée
            };
          }
          return item;
        });
        setMenuItems(itemsWithImages);
        console.log('Article IDs:', itemsWithImages.map(item => item.id)); // Afficher les IDs des articles dans la console
      } catch (error) {
        console.error('Erreur lors du chargement du menu:', error);
      }
    };

    const fetchCategories = async () => {
      try {
        const response = await fetch('http://localhost:5118/api/Categorie'); // Remplacez par l'URL de votre API pour les catégories
        const data = await response.json();
        setCategories([{ id: 'All', nom: 'All' }, ...data.map(category => ({ id: category.id, nom: category.nom }))]);
      } catch (error) {
        console.error('Erreur lors du chargement des catégories:', error);
      }
    };

    fetchMenuData();
    fetchCategories();
  }, []);

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
  };

  const filteredMenuItems = selectedCategory === 'All'
    ? menuItems
    : menuItems.filter(item => item.categorieId === parseInt(selectedCategory));

  const handleQuantityChange = (itemId, delta) => {
    setQuantities(prevQuantities => {
      const newQuantities = { ...prevQuantities };
      newQuantities[itemId] = (newQuantities[itemId] || 0) + delta;
      if (newQuantities[itemId] < 0) newQuantities[itemId] = 0;
      return newQuantities;
    });
  };

  const addToCart = async (item) => {
    const quantity = quantities[item.id] || 1; // Utiliser la quantité sélectionnée ou 1 par défaut
    const panierId = localStorage.getItem('panierId'); // Récupérer l'ID du panier depuis le local storage
    if (!panierId) {
      console.error('ID du panier non disponible');
      setMessage('Erreur: ID du panier non disponible.');
      setTimeout(() => setMessage(''), 3000); // Effacer le message après 3 secondes
      return;
    }
    try {
      const response = await fetch(`http://localhost:5118/api/Panier/${panierId}/articles/${item.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quantity) // Inclure la quantité dans le corps de la requête
      });
  
      console.log('Response Status:', response.status); // Afficher le statut de la réponse dans la console
  
      if (response.status !== 204) {
        const responseData = await response.json();
        console.log('Response Data:', responseData); // Afficher les données de la réponse dans la console
  
        if (!response.ok) {
          throw new Error(responseData.message || 'Erreur lors de l\'ajout de l\'article au panier');
        }
      }
  
      // Ajouter l'article au panier dans le local storage
      const storedPanier = JSON.parse(localStorage.getItem('panier')) || [];
      const existingItemIndex = storedPanier.findIndex(panierItem => panierItem.id === item.id);
      if (existingItemIndex !== -1) {
        storedPanier[existingItemIndex].quantity += quantity;
      } else {
        storedPanier.push({ ...item, quantity });
      }
      localStorage.setItem('panier', JSON.stringify(storedPanier));
  
      setMessage(`L'article "${item.nom}" a été ajouté au panier avec succès.`);
      setTimeout(() => setMessage(''), 3000); // Effacer le message après 3 secondes
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'article au panier:', error);
      setMessage(error.message || 'Erreur lors de l\'ajout de l\'article au panier.');
      setTimeout(() => setMessage(''), 3000); // Effacer le message après 3 secondes
    }
  };

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <div className="logo">Mon Restaurant</div>
        <div className="nav-icons">
          <FaShoppingCart className="icon" onClick={() => navigate('/Panier')} />
          <FaUser className="icon" onClick={() => navigate('/Profil')} />
        </div>
      </div>

      <div className="menu-container">
        <h1>Menu du Restaurant</h1>
        {message && <p className="message">{message}</p>} {/* Afficher le message de succès */}
        <div className="category-filter">
          <label htmlFor="category">Filtrer par catégorie :</label>
          <select id="category" value={selectedCategory} onChange={handleCategoryChange}>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.nom}</option>
            ))}
          </select>
        </div>
        <div className="menu-items">
          {filteredMenuItems.map((item) => (
            <div key={item.id} className="menu-item-card">
              <img src={item.image} alt={item.nom} className="menu-item-image" />
              <h2>{item.nom}</h2>
              <p>{item.description}</p>
              <p>Prix: {item.prix}€</p>
              <div className="quantity-controls">
                <button onClick={() => handleQuantityChange(item.id, -1)}>-</button>
                <span>{quantities[item.id] || 1}</span>
                <button onClick={() => handleQuantityChange(item.id, 1)}>+</button>
              </div>
              <button onClick={() => addToCart(item)}>Ajouter au panier</button>
            </div>
          ))}
        </div>
        <button className="back-btn" onClick={() => navigate('/HomeLogin')}>Retour à l'accueil</button>
      </div>

      {/* Footer */}
      <div className="footer">
        <h2>Contactez-nous</h2>
        <p>Email: <a href="mailto:contact@monrestaurant.com">contact@monrestaurant.com</a></p>
        <p>Téléphone: 01 23 45 67 89</p>
      </div>
    </div>
  );
};

export default Menu;