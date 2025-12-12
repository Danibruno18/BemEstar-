import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const BASE_URL = EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface Form {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  responseCount: number;
  createdAt: string;
}

export default function PsychologistHome() {
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const { user, token, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!token) return;
    if (user?.role !== 'psychologist') {
      if (Platform.OS === 'web') {
        window.alert('Acesso restrito a psicólogos');
      } else {
        Alert.alert('Acesso restrito', 'Esta área é apenas para psicólogos');
      }
      router.replace('/patient');
      return;
    }
    loadForms();
  }, [user, token]);

  useFocusEffect(
    useCallback(() => {
      if (!token || user?.role !== 'psychologist') return;
      setIsLoading(true);
      loadForms();
    }, [token, user])
  );

  const loadForms = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/forms`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setForms(response.data);
    } catch (error: any) {
      console.error('Error loading forms:', error);
      const detail = error?.response?.data?.detail;
      const status = error?.response?.status;
      const msg = detail || (status ? `Falha ao carregar (status ${status})` : 'Falha ao carregar formulários');
      Alert.alert('Erro', msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (formId: string) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Tem certeza que deseja excluir este formulário?');
      if (!confirmed) return;
      try {
        setIsDeletingId(formId);
        const response = await axios.delete(`${BASE_URL}/api/forms/${formId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        await loadForms();
        window.alert('Formulário excluído com sucesso');
      } catch (error: any) {
        const msg = error?.response?.data?.detail || 'Falha ao excluir formulário';
        window.alert(msg);
      } finally {
        setIsDeletingId(null);
      }
      return;
    }
    Alert.alert(
      'Confirmar Exclusão',
      'Tem certeza que deseja excluir este formulário?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeletingId(formId);
              const response = await axios.delete(`${BASE_URL}/api/forms/${formId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              await loadForms();
              Alert.alert('Sucesso', 'Formulário excluído com sucesso');
            } catch (error: any) {
              const msg = error?.response?.data?.detail || 'Falha ao excluir formulário';
              Alert.alert('Erro', msg);
            } finally {
              setIsDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Deseja realmente sair?');
      if (confirmed) {
        await logout();
        router.replace('/');
      }
      return;
    }
    Alert.alert('Sair', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/');
        },
      },
    ]);
  };

  const renderForm = ({ item }: { item: Form }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {item.description ? (
            <Text style={styles.cardDescription}>{item.description}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.cardStats}>
        <View style={styles.stat}>
          <Ionicons name="help-circle-outline" size={16} color="#666" />
          <Text style={styles.statText}>{item.questionCount} perguntas</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#666" />
          <Text style={styles.statText}>{item.responseCount} respostas</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <Pressable
          style={styles.actionButton}
          onPress={() => router.push(`/psychologist/responses?id=${item.id}`)}
        >
          <Ionicons name="eye-outline" size={20} color="#007AFF" />
          <Text style={styles.actionButtonText}>Ver Respostas</Text>
        </Pressable>

        <Pressable
          style={styles.actionButton}
          onPress={() => router.push(`/psychologist/edit?id=${item.id}`)}
        >
          <Ionicons name="pencil-outline" size={20} color="#007AFF" />
          <Text style={styles.actionButtonText}>Editar</Text>
        </Pressable>

        <Pressable
          style={[styles.actionButton, isDeletingId === item.id && { opacity: 0.5 }]}
          onPress={() => handleDelete(item.id)}
          disabled={isDeletingId === item.id}
        >
          <Ionicons name="trash-outline" size={20} color="#FF3B30" />
          <Text style={[styles.actionButtonText, { color: '#FF3B30' }]}>Excluir</Text>
        </Pressable>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Meus Questionários</Text>
          <Text style={styles.headerSubtitle}>Olá, {user?.name}</Text>
        </View>
        <Pressable 
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && { opacity: 0.6 }
          ]}
        >
          <Ionicons name="log-out-outline" size={24} color="#007AFF" />
        </Pressable>
      </View>

      <FlatList
        data={forms}
        renderItem={renderForm}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum questionário criado</Text>
            <Text style={styles.emptySubtext}>Toque no botão + para criar seu primeiro questionário</Text>
          </View>
        }
      />

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/psychologist/create')}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
  },
  list: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#666',
  },
  cardStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#666',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f8f8f8',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
