import React, { useState, useEffect, useContext } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Alert, 
  Platform, 
  StatusBar, 
  ActivityIndicator 
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS } from '../constants';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { api } from '../services/api';
import { AuthContext } from '../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';

export default function ScannerScreen({ navigation, route }: any) {
  const { type, assignmentId, clientId, clientName, expectedCount, onComplete } = route.params || { type: 'DISPATCH' };
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const [scannedIds, setScannedIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<any>(null);
  
  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (!permission) requestPermission();
    
    // Fetch settings
    api.getSystemSettings().then(setSettings).catch(() => {});
  }, []);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Necesitamos permiso para usar la cámara</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Otorgar Permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarcodeScanned = async ({ type: barType, data }: any) => {
    if (scanned || loading) return;
    setScanned(true);
    setLoading(true);
    
    let extractedId = data.trim();
    // Logic for Meli Flex ID extraction
    const scaMatch = data.match(/[A-Z]{3}\d{2}-[A-Z0-9]{12}/);
    if (scaMatch && scaMatch[0]) extractedId = scaMatch[0];
    
    try {
      if (type === 'PICKUP') {
        if (scannedIds.includes(extractedId)) {
           Alert.alert("Ya escaneado", "Este paquete ya fue procesado en esta sesión.", [{ text: "Ok", onPress: () => { setScanned(false); setLoading(false); } }]);
           return;
        }

        let flexLabelPhoto = undefined;
        const isMeli = extractedId.length > 20 || data.includes('ML') || data.includes('SHIPMENT');
        
        if (settings?.saveFlexLabelPhoto && isMeli) {
            Alert.alert(
                "Meli Flex Detectado",
                "Se requiere una foto de la etiqueta para este paquete.",
                [
                    { 
                        text: "Capturar Foto", 
                        onPress: async () => {
                            const result = await ImagePicker.launchCameraAsync({
                                base64: true,
                                quality: 0.5,
                            });
                            if (!result.canceled) {
                                const photoBase64 = result.assets[0].base64 || undefined;
                                proceedWithPickup(extractedId, data, photoBase64);
                            } else {
                                setScanned(false);
                                setLoading(false);
                            }
                        }
                    },
                    { text: "Cancelar", onPress: () => { setScanned(false); setLoading(false); }, style: "cancel" }
                ]
            );
        } else {
            await proceedWithPickup(extractedId, data);
        }
      } else {
        // Dispatch Mode
        await api.scanPackageForDispatch(extractedId, user.id, data);
        setScannedIds(prev => [...prev, extractedId]);
        setScannedCount(prev => prev + 1);
        Alert.alert("¡Cargado!", `Paquete ${extractedId} asignado a tu ruta.`, [
          { text: "Continuar", onPress: () => { setScanned(false); setLoading(false); } }
        ]);
      }
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "No se pudo procesar el código.");
      setScanned(false);
      setLoading(false);
    }
  };

  const proceedWithPickup = async (pkgId: string, flexCode: string, photo?: string) => {
    try {
        await api.markPackageAsPickedUp(pkgId, flexCode);
        setScannedIds(prev => [...prev, pkgId]);
        setScannedCount(prev => prev + 1);
        
        Alert.alert("¡Escaneado!", `Paquete ${pkgId} retirado.`, [
            { text: "Continuar", onPress: () => { setScanned(false); setLoading(false); } }
        ]);
    } catch (error: any) {
        Alert.alert("Error", error.response?.data?.message || "Error al retirar paquete.");
        setScanned(false);
        setLoading(false);
    }
  };

  const handleFinish = async () => {
    if (type === 'PICKUP') {
        if (scannedCount === 0) {
            navigation.goBack();
            return;
        }
        setLoading(true);
        try {
            await api.updatePickupStatus(assignmentId, 'RETIRADO', scannedCount);
            Alert.alert("¡Retiro Exitoso!", `Se han retirado ${scannedCount} paquetes.`, [
                { text: "Ok", onPress: () => {
                    if (onComplete) onComplete();
                    navigation.goBack();
                }}
            ]);
        } catch (error) {
            Alert.alert("Error", "No se pudo finalizar el retiro en el servidor.");
        } finally {
            setLoading(false);
        }
    } else {
        navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <CameraView 
        style={styles.camera} 
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={scanned || loading ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "code128", "code39"],
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.topBar}>
             <Text style={styles.modeTitle}>{type === 'PICKUP' ? 'ESCANEANDO RETIRO' : 'CARGA DE RUTA'}</Text>
             {type === 'PICKUP' && clientName && (
               <Text style={styles.clientSubtitle}>{clientName}</Text>
             )}
          </View>
          
          <View style={styles.middleContainer}>
            <View style={styles.unfocusedContainer}></View>
            <View style={styles.focusedContainer}>
                {/* Cuadro de enfoque */}
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
                
                {loading && (
                   <View style={styles.loadingOverlay}>
                      <ActivityIndicator size="large" color="#fff" />
                   </View>
                )}
            </View>
            <View style={styles.unfocusedContainer}></View>
          </View>
          
          <View style={styles.unfocusedContainer}>
              <View style={styles.statsRow}>
                 <View style={styles.statBox}>
                    <Text style={styles.statValue}>{scannedCount}</Text>
                    <Text style={styles.statLabel}>ESCANEO</Text>
                 </View>
                 {expectedCount > 0 && (
                   <View style={styles.statBox}>
                      <Text style={styles.statValue}>{expectedCount}</Text>
                      <Text style={styles.statLabel}>ESPERADO</Text>
                   </View>
                 )}
              </View>
              <Text style={styles.instructionText}>Ubica el código en el recuadro</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity 
            style={[styles.controlBtn, styles.closeBtn]} 
            onPress={() => navigation.goBack()}
          >
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          {scannedCount > 0 && (
             <TouchableOpacity 
               style={styles.finishBtn} 
               onPress={handleFinish}
               disabled={loading}
             >
               <Text style={styles.finishBtnText}> {type === 'PICKUP' ? 'FINALIZAR' : 'LISTO'} ({scannedCount})</Text>
             </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.controlBtn, torch && styles.activeControl]} 
            onPress={() => setTorch(!torch)}
          >
            <Icon name={torch ? "flashlight" : "flashlight-off"} size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: '#fff',
  },
  button: {
    backgroundColor: COLORS.PRIMARY,
    padding: 16,
    borderRadius: 8,
    alignSelf: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  unfocusedContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  middleContainer: {
    flexDirection: 'row',
    height: 250,
  },
  focusedContainer: {
    width: 250,
    height: 250,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  instructionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    opacity: 0.8,
  },
  topBar: {
    paddingTop: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modeTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2,
  },
  clientSubtitle: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 10,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  controlBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  closeBtn: {
    backgroundColor: '#334155',
  },
  finishBtn: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  finishBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
  },
  activeControl: {
    backgroundColor: COLORS.PRIMARY,
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: COLORS.PRIMARY,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderLeftWidth: 4,
    borderTopWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderRightWidth: 4,
    borderTopWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
  },
});
