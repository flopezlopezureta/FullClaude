import React, { useContext, useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView, 
  StatusBar,
  Platform
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { AuthContext } from '../contexts/AuthContext';
import { api } from '../services/api';
import { COLORS } from '../constants';

const MENU_ITEMS = [
  { 
    id: 'Deliveries', 
    title: '1. Entregas', 
    subtitle: 'RUTA DE HOY', 
    icon: 'truck-delivery', 
    color: '#2563eb' 
  },
  { 
    id: 'Pickups', 
    title: '2. Retiros', 
    subtitle: 'CLIENTES ASIG.', 
    icon: 'package-variant-closed', 
    color: '#9333ea' 
  },
  { 
    id: 'Dispatch', 
    title: '4. Despacho', 
    subtitle: 'CARGA RUTA', 
    icon: 'clipboard-check', 
    color: '#0d9488' 
  },
  { 
    id: 'Returns', 
    title: '5. Devolucion...', 
    subtitle: 'LOGÍSTICA INVERSA', 
    icon: 'undo-variant', 
    color: '#f97316' 
  },
  { 
    id: 'History', 
    title: '6. Historial', 
    subtitle: 'MIS ENTREGAS', 
    icon: 'history', 
    color: '#475569' 
  },
  { 
    id: 'TestML', 
    title: 'Test ML Flex', 
    subtitle: 'PRUEBA LECTURA', 
    icon: 'flash', 
    color: '#eab308' 
  },
];

export default function HomeScreen({ navigation }: any) {
  const { user, logout } = useContext(AuthContext);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await api.getSystemSettings();
        setSettings(data);
      } catch (error) {
        console.error("Error fetching settings", error);
      }
    };
    fetchSettings();
  }, []);

  const renderCard = (item: any) => (
    <TouchableOpacity 
      key={item.id} 
      style={styles.card}
      onPress={() => {
        if (item.id === 'Dispatch') {
          navigation.navigate('Scanner', { type: 'DISPATCH' });
        } else {
          navigation.navigate(item.id);
        }
      }}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${item.color}15` }]}>
        <Icon name={item.icon} size={32} color={item.color} />
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Icon name="account" size={24} color="#64748b" />
          </View>
          <View>
            <Text style={styles.userName}>{user?.name || 'FABIÁN LÓPEZ'}</Text>
            <Text style={styles.userRole}>Conductor</Text>
          </View>
        </View>
        <View style={styles.headerIcons}>
          <TouchableOpacity style={styles.headerBtn}>
            <Icon name="bell-outline" size={24} color="#64748b" />
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.headerBtn}>
            <Icon name="logout" size={24} color="#64748b" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.banner}>
          <View style={styles.bannerText}>
            <Text style={styles.bannerLabel}>EMPRESA</Text>
            <Text style={styles.bannerTitle}>{settings?.companyName || 'GO DELIVERY'}</Text>
          </View>
          <Icon name="package-variant" size={80} color="rgba(255,255,255,0.2)" style={styles.bannerIcon} />
        </View>

        <View style={styles.grid}>
          {MENU_ITEMS.filter(item => {
            if (!user?.driverPermissions) return true; // Default to shown if no permissions found
            const perms = user.driverPermissions;
            switch(item.id) {
              case 'Deliveries': return perms.canDeliver;
              case 'Pickups': return perms.canPickup;
              case 'Dispatch': return perms.canDispatch;
              case 'Returns': return perms.canReturn;
              case 'History': return perms.canViewHistory;
              default: return true;
            }
          }).map(renderCard)}
        </View>
      </ScrollView>

      {/* Pantalla de bloqueo si la app está deshabilitada */}
      {settings && settings.isAppEnabled === false && (
        <View style={styles.lockoutOverlay}>
          <Icon name="alert-circle" size={80} color="#ef4444" />
          <Text style={styles.lockoutTitle}>App Deshabilitada</Text>
          <Text style={styles.lockoutMessage}>
            El acceso a la aplicación ha sido suspendido temporalmente por el administrador.
          </Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutBtnText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    textTransform: 'uppercase',
  },
  userRole: {
    fontSize: 12,
    color: '#64748b',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 10,
  },
  headerBtn: {
    padding: 8,
  },
  content: {
    padding: 20,
  },
  banner: {
    backgroundColor: '#2563eb',
    borderRadius: 24,
    padding: 30,
    height: 140,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  bannerText: {
    flex: 1,
  },
  bannerLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  bannerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  bannerIcon: {
    position: 'absolute',
    right: -10,
    top: 10,
    transform: [{ rotate: '-15deg' }],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: '#fff',
    width: '48%',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 2,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  cardSubtitle: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  lockoutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.98)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    zIndex: 1000,
  },
  lockoutTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 20,
    marginBottom: 10,
  },
  lockoutMessage: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  logoutBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  logoutBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
});
