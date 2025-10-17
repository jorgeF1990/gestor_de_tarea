import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav style={{ padding: '10px', backgroundColor: '#eee', display: 'flex', justifyContent: 'space-between' }}>
      <div>
        <Link to="/">Inicio</Link>
        {' | '}
        {user?.rol === 'admin' && ( 
          <>
            <Link to="/dashboard">Dashboard</Link>
            {' | '}
          </>
        )}
        <Link to="/tickets">Tickets</Link>
      </div>

      <div>
        {user ? (
          <>
            <span style={{ marginRight: '10px' }}> {user.email}</span>
            <button onClick={handleLogout}>Cerrar sesión</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            {' | '}
            <Link to="/register">Registro</Link>
          </>
        )}
      </div>
    </nav>
  );
}

export default Navbar;