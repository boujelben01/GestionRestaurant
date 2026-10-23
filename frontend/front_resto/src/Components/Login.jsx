import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      console.log('Form Data:', formData); // Afficher les données du formulaire dans la console

      // Vérifier si l'utilisateur est admin
      if (formData.username === 'admin' && formData.password === 'Admin123*') {
        localStorage.setItem('token', 'admin-token'); // Enregistrer un token fictif pour l'admin
        localStorage.setItem('username', formData.username);
        navigate('/dashboard'); // Rediriger vers la page du tableau de bord
        return;
      }

      const response = await fetch('http://localhost:5118/api/Account/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('Response Status:', response.status); // Afficher le statut de la réponse dans la console

      if (!response.ok) {
        const errorData = await response.json();
        console.log('Error Data:', errorData); // Afficher les données d'erreur dans la console
        throw new Error(errorData.message || 'Erreur lors de la connexion');
      }

      const data = await response.json();
      console.log('Response Data:', data); // Afficher les données de la réponse dans la console

      const { token, email, username, userId, panierId } = data;
      localStorage.setItem('token', token);
      localStorage.setItem('email', email);
      localStorage.setItem('username', username);
      localStorage.setItem('userId', userId);
      localStorage.setItem('panierId', panierId);

      navigate('/HomeLogin'); // Rediriger vers la page d'accueil après la connexion
    } catch (err) {
      console.error('Login Error:', err); // Afficher l'erreur de connexion dans la console
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box auth-box-blur">
        <h2 className="auth-title">Se connecter</h2>
        {error && <p className="auth-error">{error}</p>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="username">Nom d'utilisateur :</label>
          <input
            id="username"
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="Entrez votre nom d'utilisateur"
            required
          />
          <label htmlFor="password">Mot de passe :</label>
          <input
            id="password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Entrez votre mot de passe"
            required
          />
          <button className="auth-button" type="submit">
            Connexion
          </button>
        </form>
        <div className="auth-footer">
          Pas de compte ? <a href="/register">Créer un compte</a>
        </div>
      </div>
    </div>
  );
};

export default Login;