import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Register from './Components/Register';
import Login from './Components/Login';
import Home from './Components/Home';
import Menu from './Components/Menu';
import Panier from './Components/Panier';
import Profil from './Components/Profil';
import Dashboard from './Components/Dashboard';
import HomeLogin from './Components/HomeLogin';


function App() {
  return (
    <Router>
      <Routes>
      <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/panier" element={<Panier />} /> 
        <Route path="/profil" element={<Profil />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/homelogin" element={<HomeLogin />} />

        
      </Routes>
    </Router>
  );
}
export default App;
