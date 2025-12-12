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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const BASE_URL = EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface Answer {
  questionId: string;
  questionText: string;
  answerText: string;
}

interface Response {
  id: string;
  patientName: string;
  patientEmail: string;
  answers: Answer[];
  submittedAt: string;
}

export default function FormResponses() {
  const { id } = useLocalSearchParams();
  const [responses, setResponses] = useState<Response[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/forms/${id}/responses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResponses(response.data);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao carregar respostas');
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

  const renderResponse = ({ item }: { item: Response }) => {
    const isExpanded = expandedId === item.id;

    return (
      <View style={styles.card}>
        <Pressable onPress={() => toggleExpand(item.id)}>
          <View style={styles.cardHeader}>
            <View style={styles.patientInfo}>
              <Ionicons name="person-circle-outline" size={32} color="#007AFF" />
              <View style={styles.patientDetails}>
                <Text style={styles.patientName}>{item.patientName}</Text>
                <Text style={styles.patientEmail}>{item.patientEmail}</Text>
                <Text style={styles.submittedDate}>{formatDate(item.submittedAt)}</Text>
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
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Respostas</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={responses}
        renderItem={renderResponse}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nenhuma resposta ainda</Text>
            <Text style={styles.emptySubtext}>Aguardando pacientes responderem este questionário</Text>
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
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  patientDetails: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  patientEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  submittedDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
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
