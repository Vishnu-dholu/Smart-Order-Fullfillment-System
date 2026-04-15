import { GoogleOAuthProvider } from '@react-oauth/google';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './store/AuthContext';
import { CartProvider } from './store/CartContext.tsx';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// DEBUG: Check the console to see if this prints your ID or "undefined"
console.log('Google Client ID Loaded:', clientId);

if (!clientId) {
  console.error('CRITICAL ERROR: VITE_GOOGLE_CLIENT_ID is missing in .env file');
}

createRoot(document.getElementById('root')!).render(
  <GoogleOAuthProvider clientId={clientId}>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </GoogleOAuthProvider>,
);
