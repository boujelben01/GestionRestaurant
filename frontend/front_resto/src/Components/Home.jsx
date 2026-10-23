import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FaShoppingCart, FaUser } from "react-icons/fa";

const Home = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [categoryItems, setCategoryItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Objet de correspondance pour les images des catégories
  const categoryImages = {
    "fast food": "src/assets/mix-pizza-olives-bell-pepper-cheese-mushrooms-top-view.jpg",
    "plat": "src/assets/lavash-rolls-top-view-table.jpg",
    "dessert": "src/assets/chocolate-brownie-cake-with-scoop-ice-cream.jpg"
  };

  // Objet de correspondance pour les images des articles
  const articleImages = {
    "lablebi adhma thon": "src/assets/LABLABI.webp",
    "makloub chawarma": "src/assets/makloub.png",
    "plat tounsi": "src/assets/shan-tounsi.jpg",
    "glace": "src/assets/glace.webp"
  };

  useEffect(() => {
    // Fetch categories
    fetch('http://localhost:5118/api/Categorie')
      .then(response => response.json())
      .then(data => {
        console.log('Categories:', data); // Afficher les catégories dans la console
        // Ajoutez manuellement les URL des images pour les catégories
        const categoriesWithImages = data.map(category => {
          if (category.nom) {
            return {
              ...category,
              image: categoryImages[category.nom.toLowerCase()] || "src/assets/default.jpg" // Utilisez l'image par défaut si aucune correspondance n'est trouvée
            };
          }
          return category;
        });
        setCategories(categoriesWithImages);
      })
      .catch(err => {
        console.error('Erreur lors du chargement des catégories:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCategoryClick = (categoryId) => {
    setSelectedCategory(categoryId);
    setLoading(true);
    fetch(`http://localhost:5118/api/Categorie/${categoryId}/with-foods`)
      .then(response => response.json())
      .then(data => {
        console.log('Category Items:', data); // Afficher les articles de la catégorie dans la console
        if (data && Array.isArray(data.foods)) {
          // Ajoutez manuellement les URL des images pour les articles
          const itemsWithImages = data.foods.map(item => {
            if (item.nom) {
              return {
                ...item,
                image: articleImages[item.nom.toLowerCase()] || "src/assets/default.jpg" // Utilisez l'image par défaut si aucune correspondance n'est trouvée
              };
            }
            return item;
          });
          setCategoryItems(itemsWithImages);
        } else {
          setError("Les données reçues ne sont pas valides.");
        }
      })
      .catch(err => {
        console.error('Erreur lors du chargement des articles de la catégorie:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  return (
    <div className="container">
      {/* Header */}
      <div className="header">
        <div className="logo">Mon Restaurant</div>
        <div className="nav-icons">
          <FaShoppingCart className="icon" onClick={() => navigate('/Panier')} />
          <FaUser className="icon" onClick={() => navigate('/Profil')} />
          <Link to="/login" className="auth-button">Login</Link>
          <Link to="/register" className="auth-button">Register</Link>
        </div>
      </div>

      {/* Hero Section */}
      <div className="hero-section">
        <img src="src/assets/view-delicious-shawarma-dish.jpg" alt="Hero" className="hero-image" />
        <div className="hero-text">
          <h1>Bienvenue à Mon Restaurant</h1>
          <p>Découvrez notre carte</p>
          <button className="cta-button" onClick={() => navigate('/menu')}>Commandez maintenant</button>
        </div>
      </div>

      {/* Categories Section */}
      <div className="popular-section">
        <h2>Nos Catégories</h2>
        <div className="popular-items">
          {categories.slice(0, 3).map(category => (
            <div
              className="popular-card"
              key={category.id}
              onClick={() => handleCategoryClick(category.id)}
              style={{ cursor: 'pointer' }}
            >
              <img src={category.image} alt={category.nom} className="category-image" />
              <h3>{category.nom}</h3>
            </div>
          ))}
        </div>
      </div>

      {/* Category Items Section */}
      {selectedCategory && (
        <div className="category-items-section">
          <h2>Articles de la catégorie</h2>
          {loading ? (
            <div>Chargement...</div>
          ) : error ? (
            <div>{error}</div>
          ) : (
            <div className="category-items">
              {categoryItems.map(item => (
                <div className="category-item-card" key={item.id}>
                  <img src={item.image} alt={item.nom} />
                  <h3>{item.nom}</h3>
                  <p>{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="footer">
        <h2>Contactez-nous</h2>
        <p>Email: <a href="mailto:contact@monrestaurant.com">contact@monrestaurant.com</a></p>
        <p>Téléphone: 01 23 45 67 89</p>
      </div>
    </div>
  );
};

export default Home;