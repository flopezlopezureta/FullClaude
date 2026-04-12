import React, { useState, useEffect, useContext } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  RefreshControl,
  SafeAreaView,
  StatusBar,
  Platform
} from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import { api } from '../services/api';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

export default function HistoryScreen({ navigation }: any) {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useContext(AuthContext);

  const fetchHistory = async () => {
    try {
      const data = await api.getDriverPackages(user.id);
      // Filtrar por cerrados (Entregado o Problema)
      const closed = data.filter((p: any) => p.status === 'ENTREGADO' || p.status === 'PROBLEMA');
      setPackages(closed);
    } catch (error) {
      console.error("Error fetching history", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'ENTREGADO' ? '#dcfce7' : '#fee2e2' }]}>
          <Text style={[styles.statusText, { color: item.status === 'ENTREGADO' ? '#166534' : '#991b1b' }]}>
            {item.status}
          </Text>
        </View>
        <Text style={styles.dateText}>{new Date(item.updatedAt || item.estimatedDelivery).toLocaleDateString()}</Text>
      </View>
      
      <Text style={styles.recipientName}>{item.recipientName}</Text>
      <Text style={styles.addressText}>{item.recipientAddress}, {item.recipientCommune}</Text>
      
      <View style={styles.footer}>
        <Text style={styles.idText}>ID: #{item.id.slice(-8)}</Text>
        <TouchableOpacity 
          style={styles.detailBtn}
          onPress={() => navigation.navigate('DeliveryDetail', { pkg: item })}
        >
          <Text style={styles.detailBtnText}>Ver Detalles</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={28} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Historial</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={packages}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchHistory} tintColor="#2563eb" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="history" size={64} color="#e2e8f0" />
            <Text style={styles.emptyText}>No tienes entregas cerradas aún</Text>
          </View>
        }
      />
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
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  backBtn: { padding: 4 },
  listContent: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  idText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontFamily: 'monospace',
  },
  detailBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  detailBtnText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '700',
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
});
