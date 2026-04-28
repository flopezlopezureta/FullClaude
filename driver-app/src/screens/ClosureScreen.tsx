import React, { useState, useEffect, useContext } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView, 
  StatusBar,
  Alert,
  ActivityIndicator,
  TextInput
} from 'react-native';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { api } from '../services/api';
import { COLORS } from '../constants';

export default function ClosureScreen({ navigation }: any) {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  const fetchSummary = async () => {
    try {
      const data = await api.getClosureSummary();
      setSummary(data);
    } catch (error) {
      Alert.alert('Error', 'No se pudo obtener el resumen de hoy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleClosure = async () => {
    if (summary.pending > 0) {
      Alert.alert(
        'Paquetes Pendientes',
        `Aún tienes ${summary.pending} paquetes sin gestionar. ¿Estás seguro de cerrar la ruta?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sí, Cerrar', onPress: submit }
        ]
      );
    } else {
      submit();
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await api.submitClosure({
        ...summary,
        notes
      });
      Alert.alert('Éxito', 'Ruta cerrada correctamente.');
      navigation.navigate('Home');
    } catch (error) {
      Alert.alert('Error', 'No se pudo registrar el cierre.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={28} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cierre de Jornada</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen de Hoy</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={styles.statValue}>{summary.total}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: '#166534' }]}>Entregados</Text>
              <Text style={[styles.statValue, { color: '#166534' }]}>{summary.delivered}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: '#92400e' }]}>Problemas</Text>
              <Text style={[styles.statValue, { color: '#92400e' }]}>{summary.problems}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: '#ef4444' }]}>Pendientes</Text>
              <Text style={[styles.statValue, { color: '#ef4444' }]}>{summary.pending}</Text>
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Notas / Observaciones</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            placeholder="Escribe cualquier detalle relevante de tu ruta..."
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        <TouchableOpacity 
          style={[styles.closeBtn, submitting && { opacity: 0.7 }]} 
          onPress={handleClosure}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon name="check-circle-outline" size={24} color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.closeBtnText}>Confirmar Cierre de Ruta</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.infoText}>
          Al cerrar la ruta, tu balance quedará registrado para el informe administrativo diario.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  backBtn: { padding: 4 },
  content: { padding: 20 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  summaryTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statItem: { width: '45%', marginBottom: 20 },
  statLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#0f172a' },
  inputGroup: { marginBottom: 24 },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 8 },
  textArea: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    height: 120,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    textAlignVertical: 'top',
    fontSize: 15,
  },
  closeBtn: {
    backgroundColor: '#0f172a',
    height: 60,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  infoText: {
    marginTop: 20,
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  }
});
