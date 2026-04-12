import * as Location from 'expo-location';
import { api } from './api';

export const LocationService = {
  startTracking: async (driverId: string) => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Permission to access location was denied');
      return;
    }

    // Seguimiento en primer plano (simple)
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 30000, // 30 segundos
        distanceInterval: 50, // 50 metros
      },
      (location) => {
        const { latitude, longitude } = location.coords;
        api.syncLocation(driverId, latitude, longitude).catch(err => 
          console.log("Failed to sync location", err)
        );
      }
    );
  },

  // Nota: Para seguimiento real en SEGUNDO PLANO (Background), 
  // se requiere configurar TaskManager en Expo, lo cual es un paso avanzado
  // que requiere plugins específicos en app.json.
};
