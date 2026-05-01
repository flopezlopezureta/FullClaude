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
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { COLORS } from './src/constants';
import { StatusBar } from 'expo-status-bar';

const Stack = createNativeStackNavigator();

function Navigation() {
  const { user, serverUrl, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.PRIMARY} />
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
});
