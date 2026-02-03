import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './store/AuthContext'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// DEBUG: Check the console to see if this prints your ID or "undefined"
console.log("Google Client ID Loaded:", clientId);

if (!clientId) {
  console.error("CRITICAL ERROR: VITE_GOOGLE_CLIENT_ID is missing in .env file");
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Ensure clientId is not null/undefined here */}
    <GoogleOAuthProvider clientId={clientId || ""}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </StrictMode>,
)