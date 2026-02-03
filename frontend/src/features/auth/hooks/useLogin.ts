import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../../../api/authApi";
import { useAuth } from "../../../hooks/useAuth";
import { jwtDecode } from "jwt-decode";

interface LoginResponse {
  token: string;
}

interface DecodedToken {
  sub: string;
  role: "CUSTOMER" | "ADMIN" | "WAREHOUSE_MANAGER";
  exp: number;
}

export const useLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setToken } = useAuth();

  // Helper to handle the final steps (Decode -> Store -> Redirect)
  const handleSuccess = (token: string) => {
    const decoded: DecodedToken = jwtDecode(token);
    setToken(token);

    // Redirect based on role
    if (decoded.role === "ADMIN") navigate("/admin/users");
    else if (decoded.role === "WAREHOUSE_MANAGER")
      navigate("/warehouse/inventory");
    else navigate("/app/orders");
  };

  // 1. Standard Email/Password Login
  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authApi.post<LoginResponse>("/auth/login", {
        email,
        password: pass,
      });
      handleSuccess(response.data.token);
    } catch (err: any) {
      if (err.response?.status === 403) setError("Invalid email or password.");
      else setError("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Google Login Handler
  // Receives the ID Token from the Google Button component
  const googleLogin = async (idToken: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Send the Google ID Token to your Spring Boot backend
      // Endpoint: POST /auth/google
      const response = await authApi.post<LoginResponse>("/auth/google", {
        idToken: idToken,
      });

      handleSuccess(response.data.token);
    } catch (err: any) {
      console.error("Google Auth Error:", err);
      setError("Google sign-in failed on the server.");
    } finally {
      setIsLoading(false);
    }
  };

  return { login, googleLogin, isLoading, error };
};
