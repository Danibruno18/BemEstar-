import React, { useState, useEffect } from 'react';
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

interface Question {
  id: string;
  text: string;
  order: number;
}

export default function EditForm() {
  const { id } = useLocalSearchParams();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [patients, setPatients] = useState<Array<{ id: string; name: string; email: string; username: string }>>([]);
  const [assignedPatientIds, setAssignedPatientIds] = useState<string[]>([]);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientsError, setPatientsError] = useState('');
  const { token, user } = useAuth();
  const router = useRouter();

  const goBackOrHome = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/psychologist');
    }
  };

  useEffect(() => {
    loadForm();
    loadPatients();
  }, []);

  const loadForm = async () => {
    try {
      const baseUrl = EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await axios.get(`${baseUrl}/api/forms/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTitle(response.data.title);
      setDescription(response.data.description || '');
      setQuestions(response.data.questions || []);
      setAssignedPatientIds(response.data.assignedPatients || []);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao carregar formulário');
      goBackOrHome();
    } finally {
      setIsLoading(false);
    }
  };

  const loadPatients = async () => {
    try {
      const baseUrl = EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      if (!token) return;
      setPatientsError('');
      const res = await axios.get(`${baseUrl}/api/patients`, { headers: { Authorization: `Bearer ${token}` } });
      setPatients(res.data);
    } catch (error: any) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      const msg = detail || (status === 403 ? 'Apenas psicólogos podem listar pacientes' : 'Falha ao carregar pacientes');
      setPatientsError(msg);
      setPatients([]);
    }
  };

  const toggleAssign = (pid: string) => {
    setAssignedPatientIds((prev) => (prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]));
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      text: '',
      order: questions.length,
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, text: string) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, text } : q)));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Erro', 'Por favor, digite um título');
      return;
    }

    if (questions.length === 0) {
      Alert.alert('Erro', 'Por favor, adicione pelo menos uma pergunta');
      return;
    }

    const emptyQuestions = questions.filter((q) => !q.text.trim());
    if (emptyQuestions.length > 0) {
      Alert.alert('Erro', 'Por favor, preencha todas as perguntas');
      return;
    }

    setIsSaving(true);
    try {
      await axios.put(
        `${EXPO_PUBLIC_BACKEND_URL}/api/forms/${id}`,
        {
          title,
          description,
          questions,
          assignedPatientIds,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      Alert.alert('Sucesso', 'Questionário atualizado com sucesso', [
        { text: 'OK', onPress: () => goBackOrHome() },
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao atualizar questionário');
    } finally {
      setIsSaving(false);
    }
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Pressable onPress={goBackOrHome}>
            <Ionicons name="arrow-back" size={24} color="#007AFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Editar Questionário</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.label}>Título *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Questionário de Ansiedade"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Descrição do questionário (opcional)"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Perguntas</Text>
              <Pressable style={styles.addButton} onPress={addQuestion}>
                <Ionicons name="add-circle" size={24} color="#007AFF" />
                <Text style={styles.addButtonText}>Adicionar</Text>
              </Pressable>
            </View>

            {questions.map((question, index) => (
              <View key={question.id} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionNumber}>Pergunta {index + 1}</Text>
                  <Pressable onPress={() => removeQuestion(question.id)}>
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  </Pressable>
                </View>
                <TextInput
                  style={[styles.input, styles.questionInput]}
                  value={question.text}
                  onChangeText={(text) => updateQuestion(question.id, text)}
                  placeholder="Digite a pergunta"
                  multiline
                />
              </View>
            ))}
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Selecione Pacientes</Text>
            {patientsError ? (
              <Text style={{ color: '#d00', marginBottom: 8 }}>{patientsError}</Text>
            ) : null}
            {user?.role !== 'psychologist' ? (
              <View style={styles.centered}>
                <Ionicons name="lock-closed-outline" size={48} color="#ccc" />
                <Text style={{ color: '#999', marginTop: 8 }}>Apenas psicólogos podem selecionar pacientes</Text>
              </View>
            ) : null}
            <TextInput
              style={[styles.input, styles.searchInput]}
              value={patientQuery}
              onChangeText={setPatientQuery}
              placeholder="Buscar por nome ou email"
            />
            {patients.length === 0 ? (
              <View style={styles.centered}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={{ color: '#999', marginTop: 8 }}>Nenhum paciente encontrado</Text>
              </View>
            ) : (
              <View>
                {patients
                  .filter(
                    (p) =>
                      p.name.toLowerCase().includes(patientQuery.toLowerCase()) ||
                      p.email.toLowerCase().includes(patientQuery.toLowerCase())
                  )
                  .map((p) => (
                    <Pressable key={p.id} onPress={() => toggleAssign(p.id)} style={styles.checkboxRow}>
                      <Ionicons
                        name={assignedPatientIds.includes(p.id) ? 'checkbox-outline' : 'square-outline'}
                        size={22}
                        color={assignedPatientIds.includes(p.id) ? '#007AFF' : '#666'}
                      />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={styles.checkboxLabel}>{p.name}</Text>
                        <Text style={{ color: '#777', fontSize: 12 }}>{p.email}</Text>
                      </View>
                    </Pressable>
                  ))}
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.submitButton, isSaving && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSaving}
          >
            <Text style={styles.submitButtonText}>
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
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
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  searchInput: {
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  questionInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  checkboxLabel: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
});
