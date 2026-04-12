import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Platform
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { api } from '../services/api';

export default function TestMLScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleBarcodeScanned = async ({ data }: any) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);

    try {
      // Extraer ID con regex más robusto
      let packageId = data.trim();
      const idMatch = packageId.match(/\/(?:shipping|shipments)\/(\d+)/i) || packageId.match(/(\d{10,12})/);
      
      if (idMatch) {
        packageId = idMatch[1] || idMatch[0];
      }

      console.log(`[TestML] Validando ID: ${packageId}`);

      // Sincronizar con Mercado Libre
      const response = await api.syncPackageWithMeli(packageId);
      setResult({
        data,
        info: response,
        success: true
      });
    } catch (error: any) {
      setResult({
        data,
        error: error.message || 'Error al validar con Meli',
        success: false
      });
    } finally {
      setLoading(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Permiso de cámara requerido</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Otorgar Permiso</Text>
        </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Test ML Flex</Text>
        <TouchableOpacity onPress={() => { setScanned(false); setResult(null); }} style={styles.refreshBtn}>
          <Icon name="refresh" size={24} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraContainer}>
        {!scanned ? (
          <CameraView 
            style={styles.camera} 
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "code128", "code39"],
            }}
          />
        ) : (
          <View style={styles.resultView}>
             {loading ? (
               <ActivityIndicator size="large" color="#2563eb" />
             ) : (
               <ScrollView contentContainerStyle={styles.resultContent}>
                  <Icon 
                    name={result?.success ? "check-circle" : "alert-circle"} 
                    size={64} 
                    color={result?.success ? "#22c55e" : "#ef4444"} 
                    style={styles.resultIcon}
                  />
                  <Text style={styles.resultTitle}>{result?.success ? 'Etiqueta Válida' : 'Error de Lectura'}</Text>
                  
                  <View style={styles.infoBox}>
                     <Text style={styles.label}>Datos Escaneados:</Text>
                     <Text style={styles.value}>{result?.data}</Text>
                  </View>

                  {result?.info && (
                    <View style={styles.infoBox}>
                       <Text style={styles.label}>Estado Mercado Libre:</Text>
                       <Text style={styles.value}>{result.info.mlStatus || 'N/A'}</Text>
                       <Text style={styles.label}>Subestado:</Text>
                       <Text style={styles.value}>{result.info.mlSubstatus || 'N/A'}</Text>
                    </View>
                  )}

                  {result?.error && (
                    <View style={[styles.infoBox, { borderColor: '#fca5a5' }]}>
                       <Text style={[styles.label, { color: '#ef4444' }]}>Error:</Text>
                       <Text style={styles.value}>{result.error}</Text>
                    </View>
                  )}

                  <TouchableOpacity style={styles.retryBtn} onPress={() => { setScanned(false); setResult(null); }}>
                     <Text style={styles.retryBtnText}>Escanear de nuevo</Text>
                  </TouchableOpacity>
               </ScrollView>
             )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
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
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  resultView: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
  },
  resultContent: {
    padding: 24,
    alignItems: 'center',
  },
  resultIcon: {
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 32,
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 15,
    color: '#1e293b',
    marginTop: 4,
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  message: { textAlign: 'center', marginTop: 100 },
  permBtn: { backgroundColor: '#2563eb', padding: 15, borderRadius: 10, alignSelf: 'center', marginTop: 20 },
  permBtnText: { color: '#fff', fontWeight: 'bold' },
});
