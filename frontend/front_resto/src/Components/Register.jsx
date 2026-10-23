import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setValidationErrors({});
    setSuccess(false);

    try {
      console.log('Form Data:', formData); // Afficher les données du formulaire dans la console

      const response = await fetch('http://localhost:5118/api/Account/register', {
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
        if (errorData.errors) {
          setValidationErrors(errorData.errors);
        }
        throw new Error(errorData.title || 'Erreur d\'inscription');
      }

      const data = await response.json(); // Handle JSON response
      console.log('Response Data:', data); // Afficher les données de la réponse dans la console

      const { token, email, username, userId, panierId } = data;
      localStorage.setItem('token', token);
      localStorage.setItem('email', email);
      localStorage.setItem('username', username);
      localStorage.setItem('userId', userId);
      localStorage.setItem('panierId', panierId);

      setSuccess(true);
      navigate('/homelogin', { state: { message: 'Inscription réussie !' } }); // Redirect to home with success message
    } catch (err) {
      console.error('Registration Error:', err); // Afficher l'erreur d'inscription dans la console
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box auth-box-blur">
        <h2 className="auth-title">Créer un compte</h2>
        {success && <p style={{ color: 'green' }}>{success}</p>}
        {error && <p className="auth-error">{error}</p>}
        <form className="auth-form" onSubmit={handleSubmit}>
          <div>
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
            {validationErrors.Username && (
              <p className="auth-error">{validationErrors.Username.join(', ')}</p>
            )}
          </div>
          <div>
            <label htmlFor="email">Email :</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Entrez votre email"
              required
            />
            {validationErrors.Email && (
              <p className="auth-error">{validationErrors.Email.join(', ')}</p>
            )}
          </div>
          <div>
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
            {validationErrors.Password && (
              <p className="auth-error">{validationErrors.Password.join(', ')}</p>
            )}
          </div>
          <button className="auth-button auth-button-animate" type="submit">
            S'inscrire
          </button>
        </form>
        <div className="auth-footer">
          Déjà un compte ? <a href="/login">Se connecter</a>
        </div>
      </div>
    </div>
  );
};

export default Register;