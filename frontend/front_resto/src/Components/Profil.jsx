import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Profil = () => {
  const [userInfo, setUserInfo] = useState({
    username: '',
    email: '',
    imageUrl: '', // Ajoutez l'URL de l'image de l'utilisateur
  });
  const [commandes, setCommandes] = useState([]); // Ajoutez un état pour les commandes
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserInfo = async () => {
      const username = localStorage.getItem('username');
      if (!username) {
        navigate('/login');  // Redirige vers la page de login si l'utilisateur n'est pas connecté
        return;
      }

      try {
        const response = await fetch(`http://localhost:5118/api/User/getUserInfoByName?username=${username}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log('User Info:', data); // Afficher les informations utilisateur dans la console
        setUserInfo(data);
      } catch (error) {
        console.error('Erreur lors du chargement des informations utilisateur:', error);
      }
    };

    const fetchUserOrders = async () => {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        console.error('ID utilisateur non disponible');
        return;
      }

      try {
        const response = await fetch(`http://localhost:5118/api/Commande/userCommandes?userId=${userId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
          }
        });

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log('User Orders:', data); // Afficher les commandes utilisateur dans la console

        // Fetch orders from local storage
        const localOrders = JSON.parse(localStorage.getItem('lastOrder')) || [];
        console.log('Local Orders:', localOrders);

        // Combine API orders and local storage orders
        const combinedOrders = [...data, ...localOrders];
        setCommandes(combinedOrders);
      } catch (error) {
        console.error('Erreur lors du chargement des commandes utilisateur:', error);
      }
    };

    fetchUserInfo();
    fetchUserOrders();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserInfo({ ...userInfo, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      console.log('User Info to Update:', userInfo); // Afficher les informations utilisateur à mettre à jour dans la console

      const response = await fetch(`http://localhost:5118/api/User/updateUserInfoByName?username=${localStorage.getItem('username')}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          nom: userInfo.username,
          email: userInfo.email
        }),
      });

      console.log('Response Status:', response.status); // Afficher le statut de la réponse dans la console

      const responseText = await response.text();
      console.log('Response Text:', responseText); // Afficher le texte de la réponse dans la console

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (e) {
          console.error('Erreur lors du parsing JSON:', e);
          throw new Error(responseText);
        }
        console.log('Error Data:', errorData); // Afficher les données d'erreur dans la console
        throw new Error(errorData.title || 'Erreur lors de la mise à jour des informations');
      }

      let updatedUserInfo;
      try {
        updatedUserInfo = JSON.parse(responseText);
      } catch (e) {
        console.error('Erreur lors du parsing JSON:', e);
        throw new Error(responseText);
      }
      console.log('Updated User Info:', updatedUserInfo); // Afficher les informations utilisateur mises à jour dans la console

      // Update local storage with new username and email
      localStorage.setItem('username', updatedUserInfo.username);
      localStorage.setItem('email', updatedUserInfo.email);

      setSuccess('Informations mises à jour avec succès');
      setIsEditing(false);
    } catch (err) {
      console.error('Erreur lors de la mise à jour des informations:', err); // Afficher l'erreur dans la console
      setError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    navigate('/'); // Rediriger vers la page de connexion après la déconnexion
  };

  return (
    <div className="profil-container">
      <h1>Profil de l'utilisateur</h1>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
      <div className="user-info">
        <img src={userInfo.imageUrl || "src/assets/user-avatar-profile-icon-black-vector-illustration.webp"} alt="Profil" className="profile-image" />
        <p><strong>Nom d'utilisateur :</strong> {userInfo.username}</p>
        <p><strong>Email :</strong> {userInfo.email}</p>
      </div>
      {isEditing ? (
        <form onSubmit={handleSubmit}>
          <div>
            <label>Nom d'utilisateur :</label>
            <input
              type="text"
              name="username"
              value={userInfo.username}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <label>Email :</label>
            <input
              type="email"
              name="email"
              value={userInfo.email}
              onChange={handleChange}
              required
            />
          </div>
          
          <button type="submit">Enregistrer</button>
          <button type="button" onClick={() => setIsEditing(false)}>Annuler</button>
        </form>
      ) : (
        <button onClick={() => setIsEditing(true)}>Modifier</button>
      )}

      {/* Orders Section */}
      <div className="orders-section">
        <h2>Vos Commandes</h2>
        {commandes.length > 0 ? (
          <table className="orders-table">
            <thead>
              <tr>
                <th>Commande #</th>
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

      {/* Boutons supplémentaires */}
      <div className="buttons-container">
        <button onClick={handleLogout}>Déconnexion</button>
        <button onClick={() => navigate('/HomeLogin')}>Retour à l'accueil</button>
      </div>
    </div>
  );
};

export default Profil;