
import { Package } from '../types';
import { cityCoordinates } from './api';

interface Point {
    id: string;
    lat: number;
    lng: number;
    pkg: Package;
}

// Calculate distance between two points (Haversine simplified)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
}

const AVG_SPEED_KMH = 30; // Conservative city speed
const TIME_PER_STOP_MINUTES = 10; // Service time per package

// Basic single-route optimizer (Nearest Neighbor)
export const optimizeRoute = (packages: Package[], startLocation?: { lat: number, lng: number }): Package[] => {
    const points: Point[] = [];
    const noCoords: Package[] = [];

    packages.forEach(pkg => {
        let lat = pkg.destLatitude;
        let lng = pkg.destLongitude;

        // Fallback to city coordinates with jitter if specific coords missing
        if ((!lat || !lng) && pkg.recipientCity && cityCoordinates[pkg.recipientCity]) {
             const baseCoords = cityCoordinates[pkg.recipientCity];
             lat = baseCoords[0] + (Math.random() - 0.5) * 0.02;
             lng = baseCoords[1] + (Math.random() - 0.5) * 0.02;
        }

        if (lat && lng) {
            points.push({ id: pkg.id, lat, lng, pkg });
        } else {
            noCoords.push(pkg);
        }
    });

    if (points.length === 0) return [...noCoords];

    const optimizedOrder: Package[] = [];
    const unvisited = [...points];
    let currentLocation = startLocation || { lat: unvisited[0].lat, lng: unvisited[0].lng };
    
    if (!startLocation) {
        optimizedOrder.push(unvisited[0].pkg);
        unvisited.splice(0, 1);
    }

    while (unvisited.length > 0) {
        let nearestIndex = -1;
        let minDistance = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
            const dist = getDistance(currentLocation.lat, currentLocation.lng, unvisited[i].lat, unvisited[i].lng);
            if (dist < minDistance) {
                minDistance = dist;
                nearestIndex = i;
            }
        }

        if (nearestIndex !== -1) {
            const nextPoint = unvisited[nearestIndex];
            optimizedOrder.push(nextPoint.pkg);
            currentLocation = { lat: nextPoint.lat, lng: nextPoint.lng };
            unvisited.splice(nearestIndex, 1);
        } else {
            break;
        }
    }

    return [...optimizedOrder, ...noCoords];
};

// K-Means Clustering for Multi-Driver Optimization with Time Constraint
export const optimizeMultiDriverRoute = (packages: Package[], driverCount: number, startLocation: { lat: number, lng: number }, endTimeStr: string = "21:00"): Package[][] => {
    // 1. Parse Time Constraint
    const now = new Date();
    const [endHour, endMinute] = endTimeStr.split(':').map(Number);
    const endDate = new Date();
    endDate.setHours(endHour, endMinute, 0, 0);
    
    // If end time is before now (e.g. next day), add 24 hours. 
    // For simplicity, assume same day if time is later than now, otherwise just fail safe.
    if (endDate < now) {
        // If it's 23:00 and target is 01:00, add a day. 
        // But usually user selects 21:00. If it's currently 22:00, time is negative.
        // We'll assume minimal operational time remaining if late.
    }
    
    const maxDurationMinutes = Math.max(0, (endDate.getTime() - now.getTime()) / 60000);

    // 2. Prepare points
    const points: Point[] = [];
    const noCoords: Package[] = [];

    packages.forEach(pkg => {
        let lat = pkg.destLatitude;
        let lng = pkg.destLongitude;

        if ((!lat || !lng) && pkg.recipientCity && cityCoordinates[pkg.recipientCity]) {
             const baseCoords = cityCoordinates[pkg.recipientCity];
             lat = baseCoords[0] + (Math.random() - 0.5) * 0.02;
             lng = baseCoords[1] + (Math.random() - 0.5) * 0.02;
        }

        if (lat && lng) {
            points.push({ id: pkg.id, lat, lng, pkg });
        } else {
            noCoords.push(pkg);
        }
    });

    // If not enough points or drivers, fallback to single route logic split simply or return all in one
    if (points.length < driverCount) {
        return [optimizeRoute(packages, startLocation)];
    }

    // 3. Initialize Centroids (Randomly pick k points)
    let centroids: { lat: number, lng: number }[] = [];
    const shuffled = [...points].sort(() => 0.5 - Math.random());
    centroids = shuffled.slice(0, driverCount).map(p => ({ lat: p.lat, lng: p.lng }));

    // 4. K-Means Loop
    let clusters: Point[][] = Array.from({ length: driverCount }, () => []);
    const maxIterations = 20;
    
    for (let iter = 0; iter < maxIterations; iter++) {
        clusters = Array.from({ length: driverCount }, () => []);

        for (const point of points) {
            let minDist = Infinity;
            let clusterIndex = 0;
            for (let i = 0; i < driverCount; i++) {
                const d = getDistance(point.lat, point.lng, centroids[i].lat, centroids[i].lng);
                if (d < minDist) {
                    minDist = d;
                    clusterIndex = i;
                }
            }
            clusters[clusterIndex].push(point);
        }

        let changed = false;
        for (let i = 0; i < driverCount; i++) {
            if (clusters[i].length === 0) continue;
            const avgLat = clusters[i].reduce((sum, p) => sum + p.lat, 0) / clusters[i].length;
            const avgLng = clusters[i].reduce((sum, p) => sum + p.lng, 0) / clusters[i].length;

            if (Math.abs(avgLat - centroids[i].lat) > 0.0001 || Math.abs(avgLng - centroids[i].lng) > 0.0001) {
                centroids[i] = { lat: avgLat, lng: avgLng };
                changed = true;
            }
        }
        if (!changed) break;
    }

    // 5. Optimize route within each cluster and APPLY TIME LIMIT
    const optimizedRoutes: Package[][] = clusters.map(clusterPoints => {
        const clusterPackages = clusterPoints.map(p => p.pkg);
        const optimized = optimizeRoute(clusterPackages, startLocation);
        
        // Time Limiting Logic
        const feasibleRoute: Package[] = [];
        let currentLat = startLocation.lat;
        let currentLng = startLocation.lng;
        let accumulatedTime = 0;

        for (const pkg of optimized) {
            // Distance in km
            const lat = pkg.destLatitude || currentLat; // Fallback if optimized somehow lost coords
            const lng = pkg.destLongitude || currentLng;
            
            const distKm = getDistance(currentLat, currentLng, lat, lng);
            const travelTimeMin = (distKm / AVG_SPEED_KMH) * 60;
            
            if (accumulatedTime + travelTimeMin + TIME_PER_STOP_MINUTES <= maxDurationMinutes) {
                accumulatedTime += travelTimeMin + TIME_PER_STOP_MINUTES;
                feasibleRoute.push(pkg);
                currentLat = lat;
                currentLng = lng;
            } else {
                // Cannot add this package without exceeding time
                // In a real VRP, we might try to give it to another driver, but here we drop it from this route
            }
        }
        return feasibleRoute;
    });

    // 6. Distribute no-coord packages (round robin, ignoring time for simplicity as distance is 0)
    noCoords.forEach((pkg, index) => {
        optimizedRoutes[index % driverCount].push(pkg);
    });

    return optimizedRoutes.filter(route => route.length > 0);
};
