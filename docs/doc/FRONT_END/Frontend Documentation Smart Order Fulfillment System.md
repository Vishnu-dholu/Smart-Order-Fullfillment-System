**Tags:** #frontend #react #typescript #microservices #documentation **Date:** February 3, 2026 **Status:** 🚧 In Development

## 1. Project Overview

This is the frontend client for the **Smart Order Fulfillment & Inventory Management System**. It is built as a Single Page Application (SPA) to interact with a polyglot microservices backend (Spring Boot & Go).

- **Framework:** React 18 (Vite)
    
- **Styling:** Tailwind CSS 4.0 (CSS-first configuration)
    
- **Language:** TypeScript
    
- **State Management:** React Context API
    
- **Authentication:** JWT (Stateless) + Google OAuth 2.0
    

---

## 2. File Structure

The project follows a **Feature-Based Architecture** to align with the backend microservices structure.
```
frontend/
├── src/
│   ├── api/                    # Axios instances for backend communication
│   │   └── authApi.ts          # Configured for Auth Service (Port 8081)
│   ├── components/             # Shared UI components
│   │   ├── layout/
│   │   │   ├── Navbar.tsx      # Main navigation
│   │   │   └── ProtectedRoute.tsx # RBAC Route Guard
│   ├── features/               # Feature modules (Microservice aligned)
│   │   ├── auth/
│   │   │   ├── hooks/
│   │   │   │   └── useLogin.ts # Login logic (Standard + Google)
│   │   │   └── LoginPage.tsx   # Login UI form
│   │   ├── public/
│   │   │   └── LandingPage.tsx # Marketing entry page
│   ├── hooks/                  # Global hooks
│   │   └── useAuth.ts          # Access to global AuthContext
│   ├── store/                  # Global State Providers
│   │   └── AuthContext.tsx     # User session management
│   ├── App.tsx                 # Routing & Layout definition
│   ├── main.tsx                # App Entry & Providers
│   └── index.css               # Tailwind 4.0 imports
├── .env                        # Environment Variables
└── vite.config.ts              # Vite Config
```
---
## 3. Core Modules & Implementation

### [[API Layer]]

Centralized configuration for HTTP requests. We use **Axios Interceptors** to handle security headers automatically.

- **File:** `src/api/authApi.ts`
    
- **Target:** `auth-service` (Port 8081).
    
- **Key Functionality:**
    
    - **Base URL:** Pulled from `VITE_AUTH_SERVICE_URL`.
        
    - **Request Interceptor:** Automatically attaches `Authorization: Bearer <token>` to every outgoing request.
        
    - **Response Interceptor:** (Prepared) To handle global 403/401 errors.
        

### [[Authentication Module]]

Implements the security flows defined in the backend documentation.

#### A. Login Logic (`useLogin.ts`)

A custom hook that manages the login state and API calls.

- **Standard Login:** Posts `email` and `password` to `/auth/login`.
    
- **Google Login:**
    
    1. Receives `idToken` from Google SDK.
        
    2. Posts `idToken` to backend endpoint `/auth/google`.
        
- **Role-Based Redirect:** Decodes the JWT `role` claim (`ADMIN`, `CUSTOMER`, `WAREHOUSE_MANAGER`) to determine the landing page.
    

#### B. Login UI (`LoginPage.tsx`)

- **Libraries:** `lucide-react` (Icons), `@react-oauth/google` (Google SDK).
    
- **Features:**
    
    - Form validation for Email/Password.
        
    - **Google Sign-In Button:** Configured with `useOneTap` and rectangular shape.
        
    - Error handling for `403 Forbidden` (Invalid credentials) and `ERR_CONNECTION_REFUSED` (Backend down).
        

### [[State Management]]

#### Auth Context (`AuthContext.tsx`)

- **Responsibility:** Holds the `User` object and raw `token`.
    
- **Persistence:** Checks `localStorage` on hydration to keep users logged in.
    
- **Security:** Decodes JWT expiration (`exp`) to auto-logout users if the token is stale.

### [[Routing & Security]]

- **File:** `App.tsx` & `ProtectedRoute.tsx`
    
- **Strategy:** "Guard" components wrapper.
    
- **Logic:**
    
    - Checks if `user` exists.
        
    - Checks if `user.role` matches the `allowedRoles` array passed to the route.
        
    - Redirects unauthorized access attempts.
    
---
## 4. Environment Configuration

Crucial settings for connecting the disjointed services.

**File:** `.env`
```Properties
# Backend Service URLs
VITE_AUTH_SERVICE_URL=http://localhost:8081
VITE_WAREHOUSE_SERVICE_URL=http://localhost:8084

# Google OAuth Credentials
# Must match the ID in Google Cloud Console
VITE_GOOGLE_CLIENT_ID=407408718192.apps.googleusercontent.com
```
---
## 5. Current Issues & Fixes

_Documenting known issues for future debugging._

### 🔴 CORS Error

- **Symptom:** `Access to XMLHttpRequest ... has been blocked by CORS policy`.
    
- **Cause:** Spring Boot backend (Port 8081) does not whitelist the Vite frontend (Port 5173).
    
- **Fix Required:** Update `SecurityConfig.java` in `auth-service` to allow `http://localhost:5173`.
    

### 🔴 Google Origin Error

- **Symptom:** `[GSI_LOGGER]: The given origin is not allowed...`
    
- **Cause:** Google Cloud Console has not whitelisted `http://localhost:5173`.
    
- **Fix Required:** Add the frontend URL to "Authorized JavaScript origins" in Google Console.

---
## 6. Next Steps

1. [ ] **Backend:** Apply CORS fix in Spring Boot.
    
2. [ ] **Cloud Console:** Add `localhost:5173` to authorized origins.
    
3. [ ] **Frontend:** Build the `RegisterPage.tsx` to support new user sign-ups.
    
4. [ ] **Frontend:** Create the `Dashboard` layouts for the 3 different user roles.