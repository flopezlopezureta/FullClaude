import React, { useState, useEffect, useContext } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Alert,
  Vibration,
  SafeAreaView,
  StatusBar,
  Platform
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS } from '../constants';
import { api } from '../services/api';
import { AuthContext } from '../contexts/AuthContext';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

export default function DispatchScreen({ navigation }: any) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [count, setCount] = useState(0);
  const [lastScan, setLastScan] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (!permission) requestPermission();
  }, []);

  const handleBarcodeScanned = async ({ type, data }: any) => {
    if (scanned || isProcessing) return;
    
    setScanned(true);
    setIsProcessing(true);
    Vibration.vibrate(100);

    try {
      // Extraer ID con regex más robusto (soporta /shipping/, /shipments/ o ID directo)
      let packageId = data.trim();
      const idMatch = packageId.match(/\/(?:shipping|shipments)\/(\d+)/i) || packageId.match(/(\d{10,12})/);
      
      if (idMatch) {
        packageId = idMatch[1] || idMatch[0];
      }
      
      console.log(`[Dispatch] Procesando ID: ${packageId} (Origen: ${data})`);

      const result = await api.scanPackageForDispatch(packageId, user.id);
      
      setLastScan({
        success: true,
        message: `Paquete ${packageId.slice(-6)} despachado`,
        package: result.package
      });
      setCount(prev => prev + 1);

      // Si es Mercado Libre y necesita "Flex", podrías abrir un modal aquí
      // Pero para bulk scan, solemos continuar rápido
      setTimeout(() => {
        setScanned(false);
        setIsProcessing(false);
        setLastScan(null);
      }, 1500);

    } catch (error: any) {
      setLastScan({
        success: false,
        message: error.message || 'Error al despachar'
      });
      Vibration.vibrate([0, 200, 100, 200]);
      
      setTimeout(() => {
        setScanned(false);
        setIsProcessing(false);
        setLastScan(null);
      }, 3000);
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Despacho / Carga</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      </View>

      <CameraView 
        style={styles.camera} 
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "code128", "code39"],
        }}
      >
        <View style={styles.overlay}>
           <View style={styles.topOverlay}>
              <Text style={styles.instruction}>Escanea paquetes para cargar a tu ruta</Text>
           </View>
           
           <View style={styles.middleRow}>
              <View style={styles.sideOverlay} />
              <View style={styles.focusedContainer}>
                 <View style={[styles.corner, styles.topLeft]} />
                 <View style={[styles.corner, styles.topRight]} />
                 <View style={[styles.corner, styles.bottomLeft]} />
                 <View style={[styles.corner, styles.bottomRight]} />
                 
                 {isProcessing && (
                   <View style={styles.processingOverlay}>
                      <Icon 
                        name={lastScan?.success ? "check-circle" : "alert-circle"} 
                        size={80} 
                        color={lastScan?.success ? "#22c55e" : "#ef4444"} 
                      />
                   </View>
                 )}
              </View>
              <View style={styles.sideOverlay} />
           </View>

           <View style={styles.bottomOverlay}>
              {lastScan && (
                <View style={[styles.resultToast, { backgroundColor: lastScan.success ? '#22c55e' : '#ef4444' }]}>
                  <Text style={styles.resultText}>{lastScan.message}</Text>
                </View>
              )}
              
              <View style={styles.controls}>
                <TouchableOpacity 
                  style={[styles.controlBtn, torch && styles.activeControl]} 
                  onPress={() => setTorch(!torch)}
                >
                  <Icon name={torch ? "flashlight" : "flashlight-off"} size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.controlBtn} onPress={() => Alert.alert('Ingreso Manual', 'Función próximamente')}>
                   <Icon name="keyboard-outline" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
           </View>
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1e293b',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  backBtn: {
    padding: 4,
  },
  countBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instruction: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  middleRow: {
    flexDirection: 'row',
    height: 250,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  focusedContainer: {
    width: 250,
    height: 250,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  bottomOverlay: {
    flex: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    paddingTop: 20,
  },
  controls: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 'auto',
    marginBottom: 40,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  activeControl: {
    backgroundColor: '#2563eb',
  },
  resultToast: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  resultText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#2563eb',
  },
  topLeft: { top: 0, left: 0, borderLeftWidth: 4, borderTopWidth: 4 },
  topRight: { top: 0, right: 0, borderRightWidth: 4, borderTopWidth: 4 },
  bottomLeft: { bottom: 0, left: 0, borderLeftWidth: 4, borderBottomWidth: 4 },
  bottomRight: { bottom: 0, right: 0, borderRightWidth: 4, borderBottomWidth: 4 },
  message: { color: '#fff', textAlign: 'center', marginBottom: 20 },
  permBtn: { backgroundColor: '#2563eb', padding: 15, borderRadius: 10 },
  permBtnText: { color: '#fff', fontWeight: 'bold' },
});
