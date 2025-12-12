import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Register() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'psychologist' | 'patient'>('patient');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!username || !password || !name || !email) {
      Alert.alert('Erro', 'Por favor, preencha todos os campos');
      return;
    }

    if (username.length < 3) {
      Alert.alert('Erro', 'Usuário deve ter no mínimo 3 caracteres');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'Senha deve ter no mínimo 6 caracteres');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Iniciando cadastro...');
      await register(username, password, name, email, role);
      console.log('Cadastro concluído!');
      if (role === 'patient') {
        router.replace('/patient');
      } else {
        router.replace('/psychologist');
      }
    } catch (error: any) {
      console.error('Erro no cadastro:', error);
      Alert.alert('Erro no Cadastro', error.message || 'Não foi possível criar a conta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.title}>Criar Conta</Text>
            <Text style={styles.subtitle}>Preencha os dados abaixo</Text>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Nome Completo</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Digite seu nome"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="Digite seu email"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Usuário</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  placeholder="Digite seu usuário"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Senha</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Digite sua senha"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Tipo de Conta</Text>
                <View style={styles.roleContainer}>
                  <Pressable
                    style={[
                      styles.roleButton,
                      role === 'patient' && styles.roleButtonActive,
                    ]}
                    onPress={() => setRole('patient')}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        role === 'patient' && styles.roleButtonTextActive,
                      ]}
                    >
                      Paciente
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.roleButton,
                      role === 'psychologist' && styles.roleButtonActive,
                    ]}
                    onPress={() => setRole('psychologist')}
                  >
                    <Text
                      style={[
                        styles.roleButtonText,
                        role === 'psychologist' && styles.roleButtonTextActive,
                      ]}
                    >
                      Psicólogo
                    </Text>
                  </Pressable>
                </View>
              </View>

              <Pressable
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={isLoading}
              >
                <Text style={styles.buttonText}>
                  {isLoading ? 'Cadastrando...' : 'Cadastrar'}
                </Text>
              </Pressable>

              <Pressable
                style={styles.linkButton}
                onPress={() => router.back()}
              >
                <Text style={styles.linkText}>Já tem uma conta? Faça login</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 16,
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
  roleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  roleButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  roleButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  roleButtonTextActive: {
    color: '#fff',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
  },
});
