import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const BASE_URL = EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface Question {
  id: string;
  text: string;
  order: number;
}

interface FormData {
  id: string;
  title: string;
  description: string;
  questions: Question[];
}

interface Answer {
  questionId: string;
  questionText: string;
  answerText: string;
}

export default function AnswerForm() {
  const { id } = useLocalSearchParams();
  const [form, setForm] = useState<FormData | null>(null);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadForm();
  }, []);

  const loadForm = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/forms/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setForm(response.data);
    } catch (error) {
      if (Platform.OS === 'web') {
        window.alert('Falha ao carregar questionário');
      } else {
        Alert.alert('Erro', 'Falha ao carregar questionário');
      }
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const updateAnswer = (questionId: string, text: string) => {
    setAnswers({ ...answers, [questionId]: text });
  };

  const handleSubmit = async () => {
    if (!form) return;

    // Check if all questions are answered
    const unanswered = form.questions.filter((q) => !answers[q.id] || !answers[q.id].trim());
    if (unanswered.length > 0) {
      if (Platform.OS === 'web') {
        window.alert('Por favor, responda todas as perguntas antes de enviar');
      } else {
        Alert.alert('Erro', 'Por favor, responda todas as perguntas antes de enviar');
      }
      return;
    }

    if (!token) {
      if (Platform.OS === 'web') {
        window.alert('Sessão expirada. Faça login novamente');
      } else {
        Alert.alert('Sessão expirada', 'Faça login novamente');
      }
      router.replace('/login');
      return;
    }

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Tem certeza que deseja enviar suas respostas? Após o envio não será possível editar.');
      if (!confirmed) return;
      setIsSubmitting(true);
      try {
        const formattedAnswers: Answer[] = form.questions.map((q) => ({
          questionId: q.id,
          questionText: q.text,
          answerText: answers[q.id],
        }));
        await axios.post(`${BASE_URL}/api/responses`, { formId: id, answers: formattedAnswers }, { headers: { Authorization: `Bearer ${token}` } });
        window.alert('Respostas enviadas com sucesso!');
        router.push('/patient');
      } catch (error: any) {
        const detail = error?.response?.data?.detail;
        window.alert(detail || 'Falha ao enviar respostas');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    Alert.alert(
      'Confirmar Envio',
      'Tem certeza que deseja enviar suas respostas? Após o envio não será possível editar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              const formattedAnswers: Answer[] = form.questions.map((q) => ({
                questionId: q.id,
                questionText: q.text,
                answerText: answers[q.id],
              }));
              await axios.post(`${BASE_URL}/api/responses`, { formId: id, answers: formattedAnswers }, { headers: { Authorization: `Bearer ${token}` } });
              Alert.alert('Sucesso', 'Respostas enviadas com sucesso!', [
                { text: 'OK', onPress: () => router.push('/patient') },
              ]);
            } catch (error: any) {
              const detail = error?.response?.data?.detail;
              Alert.alert('Erro', detail || 'Falha ao enviar respostas');
            } finally {
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!form) return null;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {form.title}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content}>
          {form.description ? (
            <View style={styles.descriptionCard}>
              <Text style={styles.description}>{form.description}</Text>
            </View>
          ) : null}

          {form.questions.map((question, index) => (
            <View key={question.id} style={styles.questionCard}>
              <Text style={styles.questionNumber}>Pergunta {index + 1}</Text>
              <Text style={styles.questionText}>{question.text}</Text>
              <TextInput
                style={styles.answerInput}
                value={answers[question.id] || ''}
                onChangeText={(text) => updateAnswer(question.id, text)}
                placeholder="Digite sua resposta aqui..."
                multiline
                numberOfLines={4}
              />
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {Object.keys(answers).filter((k) => answers[k]?.trim()).length} de{' '}
              {form.questions.length} respondidas
            </Text>
          </View>
          <Pressable
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Enviando...' : 'Enviar Respostas'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
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
    flex: 1,
    marginHorizontal: 12,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  descriptionCard: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
  },
  questionCard: {
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
  questionNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    lineHeight: 22,
  },
  answerInput: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  progressContainer: {
    marginBottom: 12,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
