import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
// FIX: Import School type to handle school-specific user data.
import { User, School } from '../types';

interface AuthContextType {
  // FIX: The user object can be a generic User or a more specific School.
  user: User | School | null;
  loading: boolean;
  // FIX: Login should accept both User and School types.
  login: (userData: User | School) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // FIX: State needs to accommodate both User and School types.
  const [user, setUser] = useState<User | School | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (userData: User | School) => {
    if (userData) {
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};