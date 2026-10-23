import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTrash } from 'react-icons/fa'; // Importer l'icône de poubelle

const Dashboard = () => {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [newArticle, setNewArticle] = useState({ nom: '', description: '', prix: '', categorieId: '' });
  const [newCategory, setNewCategory] = useState({ nom: '' });
  const [editingArticle, setEditingArticle] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  // Objet de correspondance pour les images des articles
  const articleImages = {
    "lablebi adhma thon": "src/assets/LABLABI.webp",
    "makloub chawarma": "src/assets/makloub.png",
    "plat tounsi": "src/assets/shan-tounsi.jpg",
    "glace": "src/assets/glace.webp"
  };

  // Objet de correspondance pour les images des catégories
  const categoryImages = {
    "fast food": "src/assets/mix-pizza-olives-bell-pepper-cheese-mushrooms-top-view.jpg",
    "plat": "src/assets/lavash-rolls-top-view-table.jpg",
    "dessert": "src/assets/chocolate-brownie-cake-with-scoop-ice-cream.jpg"
  };

  useEffect(() => {
    // Vérifiez si l'utilisateur est un administrateur
    const username = localStorage.getItem('username'); // Supposons que le nom d'utilisateur est stocké dans le local storage
    if (username !== 'admin') {
      // Redirigez l'utilisateur non autorisé vers la page de connexion ou une page d'erreur
      navigate('/login'); // Redirigez vers la page de connexion
    }

    // Charger les données nécessaires pour le tableau de bord
    fetchArticles();
    fetchCategories();
    fetchCommandes();
    fetchUsers();
  }, [navigate]);

  const fetchArticles = async () => {
    try {
      const response = await fetch('http://localhost:5118/api/Articles');
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
      setArticles(itemsWithImages);
    } catch (error) {
      console.error('Erreur lors du chargement des articles:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('http://localhost:5118/api/Categorie');
      const data = await response.json();
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
    } catch (error) {
      console.error('Erreur lors du chargement des catégories:', error);
    }
  };

  const fetchCommandes = async () => {
    try {
      const response = await fetch('http://localhost:5118/api/Commande/allCommandes');
      const data = await response.json();
      setCommandes(data);
    } catch (error) {
      console.error('Erreur lors du chargement des commandes:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:5118/api/User/getUsers');
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
    }
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
  };

  const filteredArticles = selectedCategory === 'All'
    ? articles
    : articles.filter(article => article.categorieId === parseInt(selectedCategory));

  const handleAddArticle = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5118/api/Articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newArticle)
      });
      if (!response.ok) {
        throw new Error('Erreur lors de l\'ajout de l\'article');
      }
      setNewArticle({ nom: '', description: '', prix: '', categorieId: '' });
      fetchArticles();
      setMessage('Article ajouté avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'article:', error);
    }
  };

  const handleEditArticle = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://localhost:5118/api/Articles/${editingArticle.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editingArticle)
      });
      if (!response.ok) {
        throw new Error('Erreur lors de la modification de l\'article');
      }
      setEditingArticle(null);
      fetchArticles();
      setMessage('Article modifié avec succès');
    } catch (error) {
      console.error('Erreur lors de la modification de l\'article:', error);
    }
  };

  const handleDeleteArticle = async (id) => {
    try {
      const response = await fetch(`http://localhost:5118/api/Articles/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Erreur lors de la suppression de l\'article');
      }
      fetchArticles();
      setMessage('Article supprimé avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'article:', error);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5118/api/Categorie', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newCategory)
      });
      if (!response.ok) {
        throw new Error('Erreur lors de l\'ajout de la catégorie');
      }
      setNewCategory({ nom: '' });
      fetchCategories();
      setMessage('Catégorie ajoutée avec succès');
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la catégorie:', error);
    }
  };

  const handleEditCategory = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`http://localhost:5118/api/Categorie/${editingCategory.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editingCategory)
      });
      if (!response.ok) {
        throw new Error('Erreur lors de la modification de la catégorie');
      }
      setEditingCategory(null);
      fetchCategories();
      setMessage('Catégorie modifiée avec succès');
    } catch (error) {
      console.error('Erreur lors de la modification de la catégorie:', error);
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      const response = await fetch(`http://localhost:5118/api/Categorie/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Erreur lors de la suppression de la catégorie');
      }
      fetchCategories();
      setMessage('Catégorie supprimée avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression de la catégorie:', error);
    }
  };

  const handleDeleteUser = async (userName) => {
    try {
      const response = await fetch(`http://localhost:5118/api/User/deleteUserByUserName?userName=${userName}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Erreur lors de la suppression de l\'utilisateur');
      }
      fetchUsers();
      setMessage('Utilisateur supprimé avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    }
  };

  const handleGoHome = () => {
    navigate('/HomeLogin');
  };

  const handleLogout = () => {
    // Add your logout logic here
    navigate('/login');
  };

  return (
    <div className="dashboard-container">
      <h1>Tableau de bord de l'administrateur</h1>
      {message && <p className="message">{message}</p>}

      {/* Gestion des articles */}
      <div className="section">
        <h2>Articles</h2>
        <form onSubmit={handleAddArticle}>
          <input type="text" name="nom" placeholder="Nom" value={newArticle.nom} onChange={(e) => setNewArticle({ ...newArticle, nom: e.target.value })} required />
          <textarea name="description" placeholder="Description" value={newArticle.description} onChange={(e) => setNewArticle({ ...newArticle, description: e.target.value })} required />
          <input type="number" name="prix" placeholder="Prix" value={newArticle.prix} onChange={(e) => setNewArticle({ ...newArticle, prix: e.target.value })} required />
          <select name="categorieId" value={newArticle.categorieId} onChange={(e) => setNewArticle({ ...newArticle, categorieId: e.target.value })} required>
            <option value="">Sélectionnez une catégorie</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>{category.nom}</option>
            ))}
          </select>
          <button type="submit">Ajouter un article</button>
        </form>
        <div className="articles-list">
          {filteredArticles.map(article => (
            <div key={article.id} className="article-card">
              <img src={article.image} alt={article.nom} className="article-image" />
              <h3>{article.nom}</h3>
              <p>{article.description}</p>
              <p>Prix: {article.prix}€</p>
              <button onClick={() => setEditingArticle(article)}>Modifier</button>
              <button onClick={() => handleDeleteArticle(article.id)}>Supprimer</button>
            </div>
          ))}
        </div>
        {editingArticle && (
          <form onSubmit={handleEditArticle}>
            <input type="text" name="nom" placeholder="Nom" value={editingArticle.nom} onChange={(e) => setEditingArticle({ ...editingArticle, nom: e.target.value })} required />
            <textarea name="description" placeholder="Description" value={editingArticle.description} onChange={(e) => setEditingArticle({ ...editingArticle, description: e.target.value })} required />
            <input type="number" name="prix" placeholder="Prix" value={editingArticle.prix} onChange={(e) => setEditingArticle({ ...editingArticle, prix: e.target.value })} required />
            <select name="categorieId" value={editingArticle.categorieId} onChange={(e) => setEditingArticle({ ...editingArticle, categorieId: e.target.value })} required>
              <option value="">Sélectionnez une catégorie</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>{category.nom}</option>
              ))}
            </select>
            <button type="submit">Enregistrer les modifications</button>
            <button type="button" onClick={() => setEditingArticle(null)}>Annuler</button>
          </form>
        )}
      </div>

      {/* Gestion des catégories */}
      <div className="section">
        <h2>Catégories</h2>
        <form onSubmit={handleAddCategory}>
          <input type="text" name="nom" placeholder="Nom" value={newCategory.nom} onChange={(e) => setNewCategory({ ...newCategory, nom: e.target.value })} required />
          <button type="submit">Ajouter une catégorie</button>
        </form>
        <div className="categories-list">
          {categories.map(category => (
            <div key={category.id} className="category-card">
              <img src={category.image} alt={category.nom} className="category-image" />
              <h3>{category.nom}</h3>
              <button onClick={() => setEditingCategory(category)}>Modifier</button>
              <button onClick={() => handleDeleteCategory(category.id)}>Supprimer</button>
            </div>
          ))}
        </div>
        {editingCategory && (
          <form onSubmit={handleEditCategory}>
            <input type="text" name="nom" placeholder="Nom" value={editingCategory.nom} onChange={(e) => setEditingCategory({ ...editingCategory, nom: e.target.value })} required />
            <button type="submit">Enregistrer les modifications</button>
            <button type="button" onClick={() => setEditingCategory(null)}>Annuler</button>
          </form>
        )}
      </div>

      {/* Affichage des articles par catégorie */}
      <div className="section">
        <h2>Articles par catégorie</h2>
        <select value={selectedCategory} onChange={handleCategoryChange}>
          <option value="All">Toutes les catégories</option>
          {categories.map(category => (
            <option key={category.id} value={category.id}>{category.nom}</option>
          ))}
        </select>
        <div className="articles-list">
          {filteredArticles.map(article => (
            <div key={article.id} className="article-card">
              <img src={article.image} alt={article.nom} className="article-image" />
              <h3>{article.nom}</h3>
              <p>{article.description}</p>
              <p>Prix: {article.prix}€</p>
            </div>
          ))}
        </div>
      </div>

      {/* Gestion des commandes */}
      <div className="orders-section">
        <h2>Vos Commandes</h2>
        {commandes.length > 0 ? (
          <table className="orders-table">
            <thead>
              <tr>
                <th>Commande #</th>
                <th>Utilisateur</th>
                <th>Articles</th>
                <th>Quantité</th>
                <th>Prix Unitaire</th>
                <th>Total</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {commandes.map(commande => (
                <tr key={commande.id}>
                  <td>{commande.id}</td>
                  <td>{commande.username}</td>
                  <td>
                    <ul>
                      {commande.items.map(item => (
                        <li key={item.articleId}>{item.articleName}</li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    <ul>
                      {commande.items.map(item => (
                        <li key={item.articleId}>{item.quantity}</li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    <ul>
                      {commande.items.map(item => (
                        <li key={item.articleId}>{item.prixUnitaire} €</li>
                      ))}
                    </ul>
                  </td>
                  <td>{commande.total} €</td>
                  <td>{new Date(commande.orderDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Vous n'avez pas encore passé de commandes.</p>
        )}
      </div>

      {/* Gestion des utilisateurs */}
      <div className="section">
        <h2>Utilisateurs</h2>
        <div className="users-list">
          {users.filter(user => user.userName !== 'admin').map(user => (
            <div key={user.id} className="user-card">
              <img src={user.imageUrl || "src/assets/user-avatar-profile-icon-black-vector-illustration.webp"} alt="Profil" className="profile-icon" />
              <h3>UserName: {user.userName}</h3>
              <p>Email: {user.email}</p>
              <FaTrash className="delete-icon" onClick={() => handleDeleteUser(user.userName)} /> {/* Ajouter l'icône de poubelle */}
            </div>
          ))}
        </div>
      </div>

      {/* Boutons pour retourner à la page d'accueil et se déconnecter */}
      <div className="section">
        <button onClick={handleGoHome} className="home-button">Retour à l'accueil</button>
        <button onClick={handleLogout} className="logout-button">Déconnexion</button>
      </div>
    </div>
  );
};

export default Dashboard;