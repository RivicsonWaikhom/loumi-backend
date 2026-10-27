import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  User,
  fetchCurrentUser,
  loginUser,
  signupUser,
  logoutUser,
} from "@/services/authService";
import { getStoredAuthToken, setStoredAuthToken } from "@/services/apiClient";

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredAuthToken());
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      const storedToken = getStoredAuthToken();
      if (!storedToken) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const currentUser = await fetchCurrentUser();
        if (mounted) {
          if (currentUser) {
            setUser(currentUser);
            setToken(storedToken);
          } else {
            setUser(null);
            setToken(null);
          }
        }
      } catch (err) {
        if (mounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();
    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await loginUser(email, password);
      setUser(res.user);
      setToken(res.token);
    } finally {
      setLoading(false);
    }
  };

  const signup = async (fullName: string, email: string, password: string) => {
    setLoading(true);
    try {
      const res = await signupUser(fullName, email, password);
      setUser(res.user);
      setToken(res.token);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await logoutUser();
    } finally {
      setUser(null);
      setToken(null);
      setStoredAuthToken(null);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
