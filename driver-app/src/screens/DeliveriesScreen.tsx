import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Share,
  Alert,
  Platform,
  TextInput,
  Animated,
  Easing,
  AppState
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { AuthContext } from '../contexts/AuthContext';
import { api } from '../services/api';
import { OfflineManager } from '../services/OfflineManager';
import { COLORS } from '../constants';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

export default function DeliveriesScreen({ navigation }: any) {
  const { user } = useContext(AuthContext);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'closed'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const online = await OfflineManager.isConnected();
      setIsOnline(!!online);
      const data = await api.getDriverPackages(user.id);
      setPackages(data || []);
    } catch (error) {
      console.error("Error fetching packages", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const blinkAnim = useRef(new Animated.Value(0)).current;
  const promptedPackages = useRef<Set<string>>(new Set());

  // Auto-prompt para tomar fotos de MELI si está configurado
  useEffect(() => {
    if (!settings?.meliAutoPromptPhotos) return;
    if (user?.driverPermissions && user.driverPermissions.meliAutoPromptPhotos === false) return;

    const needsPhotosPackage = packages.find(
      p => p.meliDeliveredNeedsPhotos === true && 
           p.status !== 'ENTREGADO' && 
           p.status !== 'PROBLEMA' &&
           !promptedPackages.current.has(p.id)
    );

    if (needsPhotosPackage) {
      promptedPackages.current.add(needsPhotosPackage.id);
      navigation.navigate('DeliveryDetail', { pkg: needsPhotosPackage });
    }
  }, [packages, settings, user]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.ease)
        }),
        Animated.timing(blinkAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: false,
          easing: Easing.inOut(Easing.ease)
        })
      ])
    ).start();
  }, []);

  useEffect(() => {
    fetchPackages();
    const fetchSettings = async () => {
      try {
        const data = await api.getSystemSettings();
        setSettings(data);
      } catch (e) {}
    };
    fetchSettings();
    // Poll every 30 seconds
    const interval = setInterval(fetchPackages, 30000);
    
    // [NUEVO] Listener para cuando el conductor regresa a la app desde Meli
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        // Fast sync Meli
        try {
          // If we have settings and auto-prompt is enabled, do fast sync
          const res = await api.syncMyMeliPackages();
          if (res && res.newlyDelivered && res.newlyDelivered.length > 0) {
            await fetchPackages();
          }
        } catch (e) {
          console.log("Fast sync failed:", e);
        }
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPackages();
  };

  const filteredPackages = useMemo(() => {
    const CLOSED_STATUSES = ['ENTREGADO', 'PROBLEMA', 'DEVUELTO', 'CANCELADO'];
    const today = new Date().toISOString().split('T')[0];
    
    let result = packages;
    if (activeTab === 'pending') {
      // Mostrar TODO lo que no esté cerrado (sin importar la fecha)
      result = packages.filter(p => !CLOSED_STATUSES.includes(p.status));
    } else {
      // Mostrar TODO lo que esté cerrado (el API ya nos dará los relevantes)
      result = packages.filter(p => CLOSED_STATUSES.includes(p.status));
    }

    if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        result = result.filter(p => 
            (p.recipientName && p.recipientName.toLowerCase().includes(query)) ||
            (p.recipientAddress && p.recipientAddress.toLowerCase().includes(query)) ||
            (p.id && p.id.toLowerCase().includes(query)) ||
            (p.recipientPhone && p.recipientPhone.includes(query))
        );
    }
    return result;
  }, [packages, activeTab, searchQuery]);

  const handleExportCircuit = async () => {
    const pending = packages.filter(p => p.status !== 'ENTREGADO' && p.status !== 'PROBLEMA');
    const csvContent = "Address\n" + pending
      .map(p => `"${p.recipientAddress}, ${p.recipientCommune}"`)
      .join('\n');

    try {
      const filename = `Ruta_Circuit_${new Date().getTime()}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      
      await FileSystem.writeAsStringAsync(fileUri, "\uFEFF" + csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Enviar a Circuit',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        // Fallback to text sharing if file sharing not available
        await Share.share({
          message: pending.map(p => `${p.recipientAddress}, ${p.recipientCommune}`).join('\n'),
          title: 'Ruta Circuit'
        });
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const isCancelled = item.status === 'CANCELADO';
    const isRescheduled = item.status === 'REPROGRAMADO';
    const isCritical = isCancelled || isRescheduled;
    const isDelivered = item.status === 'ENTREGADO';
    const isProblem = item.status === 'PROBLEMA';
    
    // Status colors
    let statusBg = '#f1f5f9';
    let statusText = '#475569';
    let statusIcon = 'package-variant';
    
    if (isDelivered) { statusBg = '#dcfce7'; statusText = '#16a34a'; statusIcon = 'check-circle'; }
    else if (isCancelled) { statusBg = '#fee2e2'; statusText = '#ef4444'; statusIcon = 'close-circle'; }
    else if (isProblem) { statusBg = '#ffedd5'; statusText = '#f97316'; statusIcon = 'alert'; }
    else if (isRescheduled) { statusBg = '#fef3c7'; statusText = '#d97706'; statusIcon = 'calendar-clock'; }
    else if (item.status === 'EN RUTA' || item.status === 'EN_RUTA') { statusBg = '#dbeafe'; statusText = '#2563eb'; statusIcon = 'truck'; }
    
    // Source mapping
    let sourceText = 'MANUAL';
    let sourceIcon = 'hand-extended';
    let sourceColor = '#64748b';
    let sourceBg = '#f1f5f9';
    
    if (item.source === 'MERCADO_LIBRE' || item.meliOrderId || item.meliFlexCode) {
      sourceText = 'MERCADO LIBRE';
      sourceIcon = 'handshake';
      sourceColor = '#ca8a04';
      sourceBg = '#fef08a';
    } else if (item.source === 'SHOPIFY' || item.shopifyOrderId) {
      sourceText = 'SHOPIFY';
      sourceIcon = 'shopping';
      sourceColor = '#16a34a';
      sourceBg = '#dcfce7';
    } else if (item.source === 'WOOCOMMERCE' || item.wooOrderId) {
      sourceText = 'WOOCOMMERCE';
      sourceIcon = 'cart';
      sourceColor = '#9333ea';
      sourceBg = '#f3e8ff';
    } else if (item.source === 'FALABELLA' || item.falabellaOrderId) {
      sourceText = 'FALABELLA';
      sourceIcon = 'tag';
      sourceColor = '#65a30d';
      sourceBg = '#ecfccb';
    }

    const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';

    return (
      <Animated.View style={[
        styles.card,
        { backgroundColor: isCritical ? '#fef2f2' : rowBg, borderLeftColor: statusText }
      ]}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('DeliveryDetail', { pkg: item })}
          activeOpacity={0.7}
          style={styles.cardInner}
        >
          <View style={styles.cardMain}>
            <View style={[styles.iconCircle, { backgroundColor: statusBg }]}>
               <Icon name={statusIcon} size={20} color={statusText} />
            </View>
            <View style={styles.cardContent}>
              <View style={styles.titleRow}>
                <Text style={styles.recipientName} numberOfLines={1}>{item.recipientName || 'Sin Nombre'}</Text>
                {item.status === 'PENDIENTE' && (
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>NUEVO</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.addressRow}>
                <Icon name="map-marker" size={14} color="#94a3b8" />
                <Text style={styles.addressText} numberOfLines={2}>
                  {item.recipientAddress || 'Sin Dirección'}
                </Text>
              </View>
              
              <View style={styles.pillsRow}>
                <View style={styles.communePill}>
                  <Text style={styles.communeText}>{item.recipientCommune || 'Sin Comuna'}</Text>
                </View>
                <View style={[styles.sourcePill, { backgroundColor: sourceBg, borderColor: sourceColor + '40' }]}>
                  <Icon name={sourceIcon} size={12} color={sourceColor} />
                  <Text style={[styles.sourceText, { color: sourceColor }]}>{sourceText}</Text>
                </View>
              </View>
            </View>
          </View>
          
          <View style={styles.cardRight}>
            <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
              <Text style={[styles.statusPillText, { color: statusText }]}>
                {(item.status || 'PENDIENTE').replace('_', ' ')}
              </Text>
            </View>
            <Text style={styles.idText}>#{item.id.slice(-6)}</Text>
            <Icon name="chevron-right" size={24} color="#cbd5e1" style={styles.chevron} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={28} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Entregas</Text>
        {settings?.circuitExportEnabled && (
          <TouchableOpacity onPress={handleExportCircuit} style={styles.circuitBtn}>
            <Icon name="share-variant" size={20} color="#2563eb" />
            <Text style={styles.circuitBtnText}>Circuit</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pendientes ({packages.filter(p => !['ENTREGADO', 'PROBLEMA', 'DEVUELTO', 'CANCELADO'].includes(p.status)).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'closed' && styles.activeTab]}
          onPress={() => setActiveTab('closed')}
        >
          <Text style={[styles.tabText, activeTab === 'closed' && styles.activeTabText]}>
            Cerrados ({packages.filter(p => ['ENTREGADO', 'PROBLEMA', 'DEVUELTO', 'CANCELADO'].includes(p.status)).length})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, calle o ID..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94a3b8"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
            <Icon name="close" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <FlashList
        data={filteredPackages}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        estimatedItemSize={112}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="package-variant" size={64} color="#e2e8f0" />
            <Text style={styles.emptyText}>No hay paquetes en esta sección</Text>
          </View>
        }
      />

      {activeTab === 'pending' && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => navigation.navigate('Scanner')}
        >
          <Icon name="qrcode-scan" size={28} color="#fff" />
        </TouchableOpacity>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  circuitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  circuitBtnText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  activeTab: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  clearBtn: {
    backgroundColor: '#cbd5e1',
    padding: 2,
    borderRadius: 10,
  },
  listContent: {
    padding: 0,
    paddingBottom: 100,
  },
  card: {
    borderLeftWidth: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  cardInner: {
    flexDirection: 'row',
    padding: 16,
    justifyContent: 'space-between',
  },
  cardMain: {
    flexDirection: 'row',
    flex: 1,
    marginRight: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    marginRight: 12,
  },
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    flexShrink: 1,
  },
  newBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginBottom: 8,
  },
  addressText: {
    flex: 1,
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  communePill: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  communeText: {
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  sourceText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  idText: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  chevron: {
    marginTop: 'auto',
    marginBottom: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 15,
    marginTop: 12,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#2563eb',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  }
});
