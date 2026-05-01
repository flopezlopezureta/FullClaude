import React, { useState, useContext } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform,
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import { COLORS, STORAGE_KEYS } from '../constants';
import * as SecureStore from 'expo-secure-store';
import { AuthContext } from '../contexts/AuthContext';
import { setApiBaseUrl } from '../services/api';
import axios from 'axios';

export default function SetupScreen({ navigation }: any) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const { setServerUrl } = useContext(AuthContext);

  const handleConnect = async () => {
    if (!url) {
      Alert.alert('Error', 'Por favor ingresa la URL de tu servidor');
      return;
    }

    // Limpiar y formatear URL
    let cleanUrl = url.trim().toLowerCase();
    if (!cleanUrl.startsWith('http')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    // Quitar '/' al final si existe
    if (cleanUrl.endsWith('/')) {
      cleanUrl = cleanUrl.slice(0, -1);
    }

    setLoading(true);
    try {
      // Intentar conectar con el servidor para validar
      const testUrl = cleanUrl.endsWith('/api') ? `${cleanUrl}/settings/system` : `${cleanUrl}/api/settings/system`;
      const response = await axios.get(testUrl, { timeout: 5000 });

      if (response.status === 200) {
        // Guardar URL permanentemente
        await SecureStore.setItemAsync(STORAGE_KEYS.SERVER_URL, cleanUrl);
        // Configurar instancia de API
        setApiBaseUrl(cleanUrl);
        // Actualizar estado global para que App.tsx cambie a la pantalla de Login
        setServerUrl(cleanUrl);
        
        Alert.alert('¡Conectado!', `Conexión exitosa con ${response.data.companyName || 'el servidor'}`, [
          { text: 'Continuar' }
        ]);
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert(
        'Error de Conexión', 
        'No pudimos contactar al servidor. Revisa la URL y asegúrate de tener internet.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../assets/logo.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Configuración Inicial</Text>
            <Text style={styles.subtitle}>Conecta la App con tu servidor de logística</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>URL del Servidor</Text>
            <TextInput
              style={styles.input}
              placeholder="ej: api.minegocio.cl"
              placeholderTextColor={COLORS.MUTED}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Text style={styles.hint}>
              Esta es la dirección que Coolify te entregó para tu instancia.
            </Text>

            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleConnect}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Conectar Servidor</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.TEXT,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.MUTED,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: COLORS.CARD,
    borderRadius: 12,
    padding: 16,
    color: COLORS.TEXT,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  hint: {
    fontSize: 12,
    color: COLORS.MUTED,
    marginTop: 8,
    marginLeft: 4,
  },
  button: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: COLORS.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
