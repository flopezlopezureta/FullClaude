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
  Linking,
  Alert,
  Modal,
  TextInput,
  Platform
} from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import { api } from '../services/api';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';

export default function PickupsScreen({ navigation }: any) {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirming, setConfirming] = useState<any>(null);
  const [count, setCount] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const { user } = useContext(AuthContext);

  const fetchData = async () => {
    try {
      const [pickupData, systemSettings] = await Promise.all([
        api.getDriverPickups(),
        api.getSystemSettings()
      ]);
      setRuns(pickupData);
      setSettings(systemSettings);
    } catch (error) {
      console.error("Error fetching pickups", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConfirm = async () => {
    if (!count || isNaN(parseInt(count))) {
      Alert.alert('Error', 'Ingresa una cantidad válida');
      return;
    }

    try {
      await api.updatePickupStatus(confirming.id, 'RETIRADO', parseInt(count));
      Alert.alert('Éxito', 'Retiro confirmado correctamente');
      setConfirming(null);
      setCount('');
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const renderAssignment = (assignment: any) => {
    const isCompleted = assignment.status === 'RETIRADO';
    return (
      <View key={assignment.id} style={[styles.card, isCompleted && styles.completedCard]}>
        <View style={styles.cardHeader}>
          <Text style={styles.clientName}>{assignment.clientName}</Text>
          {isCompleted && (
            <View style={styles.doneBadge}>
              <Icon name="check-circle" size={14} color="#16a34a" />
              <Text style={styles.doneText}>LISTO</Text>
            </View>
          )}
        </View>

        <View style={styles.infoRow}>
          <Icon name="package-variant" size={18} color="#64748b" />
          <Text style={styles.infoText}>{assignment.packagesToPickup} paquetes est.</Text>
        </View>

        <TouchableOpacity 
          style={styles.addressBox} 
          onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(assignment.clientAddress)}`)}
        >
          <Icon name="map-marker" size={18} color="#ef4444" />
          <Text style={styles.addressText} numberOfLines={1}>{assignment.clientAddress}</Text>
        </TouchableOpacity>

        {!isCompleted && (
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.callBtn} 
              onPress={() => Linking.openURL(`tel:${assignment.clientPhone}`)}
            >
              <Icon name="phone" size={20} color="#2563eb" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.confirmBtn} 
              onPress={() => {
                if (settings?.pickupMode === 'SCAN' || settings?.pickupMode === 'ScanWithCount') {
                   navigation.navigate('Scanner', { 
                     type: 'PICKUP', 
                     assignmentId: assignment.id,
                     clientId: assignment.clientId,
                     clientName: assignment.clientName,
                     expectedCount: assignment.packagesToPickup,
                     onComplete: () => fetchData()
                   });
                } else {
                   setConfirming(assignment);
                   setCount(String(assignment.packagesToPickup));
                }
              }}
            >
              <Text style={styles.confirmBtnText}>
                {settings?.pickupMode === 'SCAN' || settings?.pickupMode === 'ScanWithCount' ? 'ESCANEAR RETIRO' : 'CONFIRMAR RETIRO'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderRun = ({ item: run }: { item: any }) => (
    <View style={styles.runSection}>
      <View style={styles.runHeader}>
         <Text style={styles.runTitle}>Turno {run.shift}</Text>
         <Text style={styles.runCount}>{run.assignments.length} paradas</Text>
      </View>
      {run.assignments.map(renderAssignment)}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={28} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Retiros de Hoy</Text>
        <TouchableOpacity onPress={fetchData} style={styles.refreshBtn}>
          <Icon name="refresh" size={22} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={runs}
        renderItem={renderRun}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
           <RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor="#2563eb" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="truck-outline" size={64} color="#e2e8f0" />
            <Text style={styles.emptyText}>No tienes retiros asignados</Text>
          </View>
        }
      />

      <Modal transparent visible={!!confirming} animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
               <Text style={styles.modalTitle}>Confirmar Retiro</Text>
               <Text style={styles.modalSubtitle}>{confirming?.clientName}</Text>
               
               <Text style={styles.label}>Cantidad de bultos retirados:</Text>
               <TextInput
                 style={styles.input}
                 value={count}
                 onChangeText={setCount}
                 keyboardType="numeric"
                 autoFocus
                 placeholder="0"
               />

               <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirming(null)}>
                     <Text style={styles.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={handleConfirm}>
                     <Text style={styles.saveBtnText}>Confirmar</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>
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
  refreshBtn: { padding: 8 },
  listContent: { padding: 16 },
  runSection: { marginBottom: 24 },
  runHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  runTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563eb',
    textTransform: 'uppercase',
  },
  runCount: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  completedCard: {
    opacity: 0.6,
    backgroundColor: '#f8fafc',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clientName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  doneText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#166534',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  infoText: {
    color: '#64748b',
    fontSize: 14,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f1f5f9',
    padding: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  addressText: {
    flex: 1,
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  callBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '800',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#0f172a',
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#64748b',
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '800',
  }
});
