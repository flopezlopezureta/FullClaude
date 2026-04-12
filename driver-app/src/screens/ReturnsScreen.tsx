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

export default function ReturnsScreen({ navigation }: any) {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useContext(AuthContext);

  const fetchReturns = async () => {
    try {
      const data = await api.getDriverPackages(user.id);
      // Filtrar por estados que requieren devolución (por ejemplo, aquellos marcados como problema no resuelto)
      // O simplemente aquellos con estado 'DEVOLUCION' si existe
      const returns = data.filter((p: any) => p.status === 'RETORNO_A_BODEGA' || p.status === 'PROBLEMA');
      setPackages(returns);
    } catch (error) {
      console.error("Error fetching returns", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
        <Text style={styles.idText}>#{item.id.slice(-6)}</Text>
      </View>
      
      <Text style={styles.recipientName}>{item.recipientName}</Text>
      <Text style={styles.reasonText}>Motivo: {item.problemReason || 'No especificado'}</Text>
      
      <TouchableOpacity 
        style={styles.actionBtn}
        onPress={() => navigation.navigate('Scanner', { mode: 'return', packageId: item.id })}
      >
        <Icon name="barcode-scan" size={20} color="#fff" />
        <Text style={styles.actionBtnText}>Confirmar Devolución</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={28} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Devoluciones</Text>
        <View style={{ width: 28 }} />
      </View>

      <FlatList
        data={packages}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchReturns} tintColor="#f97316" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="package-variant-closed" size={64} color="#e2e8f0" />
            <Text style={styles.emptyText}>No hay devoluciones pendientes</Text>
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
    borderColor: '#fed7aa',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    backgroundColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9a3412',
  },
  idText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  recipientName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 13,
    color: '#ea580c',
    marginBottom: 16,
    fontWeight: '600',
  },
  actionBtn: {
    backgroundColor: '#f97316',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
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
