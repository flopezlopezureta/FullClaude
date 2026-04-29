import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { Alert } from 'react-native';

export const PhotoService = {
  /**
   * Solicita permisos necesarios para cámara y galería
   */
  requestPermissions: async () => {
    const cameraStatus = await ImagePicker.requestCameraPermissionsAsync();
    const libraryStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const mediaLibraryStatus = await MediaLibrary.requestPermissionsAsync();
    
    return (
      cameraStatus.status === 'granted' && 
      libraryStatus.status === 'granted' &&
      mediaLibraryStatus.status === 'granted'
    );
  },

  /**
   * Toma una foto con la cámara, la guarda en la galería y la comprime
   */
  takePhoto: async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1, // Calidad original para procesar después
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }

      const asset = result.assets[0];
      
      // 1. Guardar en la galería del teléfono inmediatamente
      try {
        await MediaLibrary.saveToLibraryAsync(asset.uri);
      } catch (e) {
        console.log('No se pudo guardar en galería:', e);
      }

      // 2. Comprimir y redimensionar para la app
      return await PhotoService.processImage(asset.uri);
    } catch (error) {
      console.error('Error al tomar foto:', error);
      Alert.alert('Error', 'No se pudo capturar la foto.');
      return null;
    }
  },

  /**
   * Selecciona fotos de la galería y las procesa una a una
   */
  selectFromGallery: async (allowMultiple = true) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: allowMultiple,
        quality: 1,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return [];
      }

      const processedPhotos: string[] = [];
      
      // Procesamos secuencialmente para no saturar la memoria en teléfonos antiguos
      for (const asset of result.assets) {
        const base64 = await PhotoService.processImage(asset.uri);
        if (base64) {
          processedPhotos.push(base64);
        }
      }

      return processedPhotos;
    } catch (error) {
      console.error('Error al seleccionar de galería:', error);
      Alert.alert('Error', 'No se pudieron cargar las fotos de la galería.');
      return [];
    }
  },

  /**
   * Redimensiona y comprime la imagen para optimizar Base64
   * Max 1024px de ancho o alto.
   */
  processImage: async (uri: string) => {
    try {
      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }], // Esto mantiene el aspect ratio automáticamente si solo pasas un lado
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      return `data:image/jpeg;base64,${manipResult.base64}`;
    } catch (error) {
      console.error('Error procesando imagen:', error);
      return null;
    }
  }
};
