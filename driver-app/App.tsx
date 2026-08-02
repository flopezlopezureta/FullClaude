import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthProvider, AuthContext } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import DeliveriesScreen from './src/screens/DeliveriesScreen';
import DispatchScreen from './src/screens/DispatchScreen';
import PickupsScreen from './src/screens/PickupsScreen';
import ReturnsScreen from './src/screens/ReturnsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ClosureScreen from './src/screens/ClosureScreen';
import TestMLScreen from './src/screens/TestMLScreen';
import ScannerScreen from './src/screens/ScannerScreen';
import SetupScreen from './src/screens/SetupScreen';
import DeliveryDetailScreen from './src/screens/DeliveryDetailScreen';
import { ActivityIndicator, View, StyleSheet, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { COLORS } from './src/constants';
import { StatusBar } from 'expo-status-bar';

// Set this to the current version of the app when compiling. 
// When the backend returns a higher latestVersion, it will force an update.
const APP_VERSION = "1.0.1";

const Stack = createNativeStackNavigator();

function Navigation() {
  const { user, serverUrl, isLoading } = useContext(AuthContext);
  const [needsUpdate, setNeedsUpdate] = React.useState(false);
  const [updateUrl, setUpdateUrl] = React.useState("");

  React.useEffect(() => {
    if (!serverUrl) return;
    
    // Check for updates
    const checkUpdate = async () => {
      try {
        const response = await fetch(`${serverUrl}/driver/version`);
        const data = await response.json();
        
        if (data && data.latestVersion && data.latestVersion !== APP_VERSION) {
           setNeedsUpdate(true);
           setUpdateUrl(data.downloadUrl);
        }
      } catch (e) {
        console.log("No se pudo verificar la versión", e);
      }
    };
    
    checkUpdate();
  }, [serverUrl]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      </View>
    );
  }

  if (needsUpdate) {
    return (
      <View style={styles.updateContainer}>
        <StatusBar style="light" />
        <View style={styles.updateCard}>
          <Text style={styles.updateTitle}>⚠️ Actualización Requerida</Text>
          <Text style={styles.updateText}>
            Tu aplicación está desactualizada (v{APP_VERSION}). Es obligatorio descargar e instalar la nueva versión para continuar trabajando.
          </Text>
          <TouchableOpacity 
            style={styles.updateButton} 
            onPress={() => {
              if (updateUrl) {
                Linking.openURL(updateUrl);
              } else {
                Alert.alert("Error", "URL de descarga no disponible.");
              }
            }}
          >
            <Text style={styles.updateButtonText}>Descargar Nueva Versión</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!serverUrl ? (
          <Stack.Screen name="Setup" component={SetupScreen} />
        ) : !user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Deliveries" component={DeliveriesScreen} />
            <Stack.Screen name="Pickups" component={PickupsScreen} />
            <Stack.Screen name="Dispatch" component={DispatchScreen} />
            <Stack.Screen name="Returns" component={ReturnsScreen} />
            <Stack.Screen name="History" component={HistoryScreen} />
            <Stack.Screen name="Closure" component={ClosureScreen} />
            <Stack.Screen name="TestML" component={TestMLScreen} />
            <Stack.Screen name="Scanner" component={ScannerScreen} />
            <Stack.Screen name="DeliveryDetail" component={DeliveryDetailScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Navigation />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateContainer: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  updateCard: {
    backgroundColor: COLORS.CARD_BACKGROUND,
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  updateTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.ERROR,
    marginBottom: 15,
    textAlign: 'center',
  },
  updateText: {
    fontSize: 16,
    color: COLORS.TEXT,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 24,
  },
  updateButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
