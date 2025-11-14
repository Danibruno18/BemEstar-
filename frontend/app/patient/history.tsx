import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Answer {
  questionId: string;
  questionText: string;
  answerText: string;
}

interface Response {
  id: string;
  formTitle: string;
  answers: Answer[];
  submittedAt: string;
}

export default function PatientHistory() {
  const [responses, setResponses] = useState<Response[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { user, token, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async () => {
    try {
      const response = await axios.get(`${EXPO_PUBLIC_BACKEND_URL}/api/responses/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResponses(response.data);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao carregar histórico');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (responseId: string) => {
    setExpandedId(expandedId === responseId ? null : responseId);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleLogout = async () => {
    Alert.alert('Sair', 'Deseja realmente sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const renderResponse = ({ item }: { item: Response }) => {
    const isExpanded = expandedId === item.id;

    return (
      <View style={styles.card}>
        <Pressable onPress={() => toggleExpand(item.id)}>
          <View style={styles.cardHeader}>
            <View style={styles.responseInfo}>
              <Ionicons name="document-text" size={28} color="#007AFF" />
              <View style={styles.responseDetails}>
                <Text style={styles.formTitle}>{item.formTitle}</Text>
                <Text style={styles.submittedDate}>{formatDate(item.submittedAt)}</Text>
                <View style={styles.answerCount}>
                  <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                  <Text style={styles.answerCountText}>
                    {item.answers.length} {item.answers.length === 1 ? 'resposta' : 'respostas'}
                  </Text>
                </View>
              </View>
            </View>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#666"
            />
          </View>
        </Pressable>

        {isExpanded && (
          <View style={styles.answersContainer}>
            {item.answers.map((answer, index) => (
              <View key={index} style={styles.answerCard}>
                <Text style={styles.questionText}>{answer.questionText}</Text>
                <Text style={styles.answerText}>{answer.answerText}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

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
          <Text style={styles.headerTitle}>Minhas Respostas</Text>
          <Text style={styles.headerSubtitle}>Olá, {user?.name}</Text>
        </View>
        <Pressable onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#007AFF" />
        </Pressable>
      </View>

      <View style={styles.tabContainer}>
        <Pressable style={styles.tab} onPress={() => router.push('/patient')}>
          <Text style={styles.tabText}>Disponíveis</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, styles.tabActive]}
          onPress={() => router.push('/patient/history')}
        >
          <Text style={[styles.tabText, styles.tabTextActive]}>Minhas Respostas</Text>
        </Pressable>
      </View>

      <FlatList
        data={responses}
        renderItem={renderResponse}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nenhuma resposta enviada</Text>
            <Text style={styles.emptySubtext}>Suas respostas aparecerão aqui após serem enviadas</Text>
          </View>
        }
      />
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#007AFF',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  responseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  responseDetails: {
    flex: 1,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  submittedDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  answerCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  answerCountText: {
    fontSize: 12,
    color: '#666',
  },
  answersContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  answerCard: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  questionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  answerText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
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
});
