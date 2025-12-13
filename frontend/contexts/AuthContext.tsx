import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Platform } from 'react-native';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const BASE_URL = EXPO_PUBLIC_BACKEND_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: 'psychologist' | 'patient' | 'patiente';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, name: string, email: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      console.log('AuthContext.login: Iniciando login');
      console.log('URL Backend:', EXPO_PUBLIC_BACKEND_URL);
      console.log('Username:', username);
      
      const response = await axios.post(`${BASE_URL}/api/auth/login`, {
        username,
        password,
      });

      console.log('Resposta recebida, status:', response.status);
      const { access_token, user: userData } = response.data;
      
      console.log('Token recebido:', access_token ? 'Sim' : 'Não');
      console.log('Dados do usuário:', userData);
      
      await AsyncStorage.setItem('token', access_token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      setToken(access_token);
      setUser(userData);
      
      console.log('Login concluído com sucesso!');
    } catch (error: any) {
      console.error('Erro no AuthContext.login:', error);
      console.error('Detalhes do erro:', error.response?.data);
      console.error('Status do erro:', error.response?.status);
      throw new Error(error.response?.data?.detail || 'Falha ao fazer login. Verifique suas credenciais.');
    }
  };

  const register = async (username: string, password: string, name: string, email: string, role: string) => {
    try {
      console.log('Tentando registrar com URL:', EXPO_PUBLIC_BACKEND_URL);
      console.log('Dados:', { username, name, email, role });
      
      const response = await axios.post(`${BASE_URL}/api/auth/register`, {
        username,
        password,
        name,
        email,
        role,
      });

      console.log('Resposta recebida:', response.status);
      const { access_token, user: userData } = response.data;
      
      await AsyncStorage.setItem('token', access_token);
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      
      setToken(access_token);
      setUser(userData);
      console.log('Registro bem-sucedido!');
    } catch (error: any) {
      console.error('Erro no registro:', error);
      console.error('Detalhes:', error.response?.data);
      throw new Error(error.response?.data?.detail || 'Falha ao cadastrar. Verifique os dados e tente novamente.');
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
