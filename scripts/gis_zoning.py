#!/usr/bin/env python3
"""
Zoning and Package Assignment Engine for Santiago Metropolitan Region (GIS & Last Mile Logistics)

This program automates package zoning validation by checking if the geocoded coordinates 
(Latitude, Longitude) of a package strictly fall within the geofenced boundary (Bounding Box or GeoJSON Polygon)
of its declared Comuna. Packages outside their boundaries or in unconfigured zones are flagged 
for manual review.

Author: Antigravity AI - Last Mile Logistics Expert
Version: 1.0.0
Date: 2026-07-08
"""

import json
from typing import Dict, Any, Tuple, List, Optional
import pandas as pd
from shapely.geometry import Point, Polygon, shape

class ZoningConfig:
    """
    Manages boundaries and polygons for each Comuna.
    Supports simple Bounding Boxes (lat/lon limits) and complex GeoJSON geometries.
    """
    def __init__(self, config_data: Dict[str, Any]):
        self.comunas: Dict[str, Any] = {}
        self._load_config(config_data)

    def _load_config(self, config_data: Dict[str, Any]) -> None:
        """
        Parses configuration and converts boundaries into Shapely Polygon geometries.
        """
        for comuna_name, data in config_data.items():
            boundary_type = data.get("type", "bbox")
            
            if boundary_type == "bbox":
                # Convert Bounding Box into a rectangular Shapely Polygon
                lat_min = data["lat_min"]
                lat_max = data["lat_max"]
                lon_min = data["lon_min"]
                lon_max = data["lon_max"]
                
                # Rectangle coordinates: bottom-left, bottom-right, top-right, top-left, close-loop
                coords = [
                    (lon_min, lat_min),
                    (lon_max, lat_min),
                    (lon_max, lat_max),
                    (lon_min, lat_max),
                    (lon_min, lat_min)
                ]
                self.comunas[comuna_name] = {
                    "type": "bbox",
                    "geometry": Polygon(coords),
                    "raw": data
                }
                
            elif boundary_type == "geojson":
                # Parse GeoJSON geometry (Polygon or MultiPolygon) using Shapely
                geom_data = data.get("geometry")
                if not geom_data:
                    raise ValueError(f"Comuna '{comuna_name}' of type 'geojson' must have a 'geometry' field.")
                
                self.comunas[comuna_name] = {
                    "type": "geojson",
                    "geometry": shape(geom_data),
                    "raw": data
                }
            else:
                raise ValueError(f"Unknown boundary type '{boundary_type}' for comuna '{comuna_name}'")

    def contains_point(self, comuna_name: str, lat: float, lon: float) -> Tuple[bool, str]:
        """
        Checks if a given coordinate (lat, lon) is strictly inside a comuna's boundary.
        Returns:
            Tuple[bool, str]: (is_inside, status_reason_message)
        """
        if comuna_name not in self.comunas:
            return False, f"Comuna '{comuna_name}' no configurada en las reglas del sistema."
        
        # Note: Shapely uses (x, y) which corresponds to (Longitude, Latitude)
        point = Point(lon, lat)
        comuna_geom = self.comunas[comuna_name]["geometry"]
        
        if comuna_geom.contains(point):
            return True, "Asignado Correctamente"
        else:
            return False, f"Coordenadas ({lat}, {lon}) estan fuera de los limites permitidos para '{comuna_name}'."


class ZoningEngine:
    """
    Core engine to process and validate lists of packages against zoning rules.
    """
    def __init__(self, config: ZoningConfig):
        self.config = config

    def process_packages(self, df_packages: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Processes a pandas DataFrame of packages.
        
        Expected columns:
            - ID_Paquete: Unique package identifier
            - Direccion: Physical address
            - Comuna: Declared Comuna name
            - Latitud: Geocoded latitude
            - Longitud: Geocoded longitude
            
        Returns:
            Tuple[pd.DataFrame, pd.DataFrame]: (df_assigned, df_exceptions)
        """
        # Create copies to prevent modifying original data
        df = df_packages.copy()
        
        # Apply validation logic element-wise
        validation_results = []
        reasons = []
        
        for idx, row in df.iterrows():
            is_valid, reason = self.config.contains_point(
                comuna_name=row["Comuna"],
                lat=row["Latitud"],
                lon=row["Longitud"]
            )
            validation_results.append("Asignado Correctamente" if is_valid else "Revision Manual")
            reasons.append(reason)
            
        df["Resultado_Zonificacion"] = validation_results
        df["Motivo_Zonificacion"] = reasons
        
        # Split datasets
        df_assigned = df[df["Resultado_Zonificacion"] == "Asignado Correctamente"].reset_index(drop=True)
        df_exceptions = df[df["Resultado_Zonificacion"] == "Revision Manual"].reset_index(drop=True)
        
        return df_assigned, df_exceptions


# ==========================================
# DEMOSTRACIÓN DE EJECUCIÓN (MOCK DATA & TESTS)
# ==========================================

if __name__ == "__main__":
    print("=" * 70)
    print("INICIANDO MOTOR DE ZONIFICACION GIS - FULLENVIOS")
    print("=" * 70)

    # 1. Configuración de límites comunales (Santiago Bounding Boxes de Prueba)
    config_data = {
        "Las Condes": {
            "type": "bbox",
            "lat_min": -33.4300,
            "lat_max": -33.3500,
            "lon_min": -70.5800,
            "lon_max": -70.4000
        },
        "Providencia": {
            "type": "bbox",
            "lat_min": -33.4500,
            "lat_max": -33.4100,
            "lon_min": -70.6300,
            "lon_max": -70.5800
        },
        "Santiago": {
            "type": "bbox",
            "lat_min": -33.4800,
            "lat_max": -33.4200,
            "lon_min": -70.7000,
            "lon_max": -70.6200
        },
        # Ejemplo de comuna con geometría GeoJSON real (Polígono en forma de L simple para demo)
        "Vitacura": {
            "type": "geojson",
            "geometry": {
                "type": "Polygon",
                "coordinates": [
                    [
                        [-70.5800, -33.4000],
                        [-70.5000, -33.4000],
                        [-70.5000, -33.3500],
                        [-70.5800, -33.3500],
                        [-70.5800, -33.4000] # Cerrar el loop
                    ]
                ]
            }
        }
    }
    
    # Cargar la configuración en el validador
    zConfig = ZoningConfig(config_data)
    engine = ZoningEngine(zConfig)
    
    # 2. Mock Data de Paquetes (Incluye casos exitosos y excepciones deliberadas)
    mock_packages = [
        # --- CASOS VÁLIDOS ---
        {
            "ID_Paquete": "PKG-001",
            "Direccion": "Av. Vitacura 3560",
            "Comuna": "Vitacura",
            "Latitud": -33.3850,
            "Longitud": -70.5500
        },
        {
            "ID_Paquete": "PKG-002",
            "Direccion": "Apoquindo 4800",
            "Comuna": "Las Condes",
            "Latitud": -33.4120,
            "Longitud": -70.5720
        },
        {
            "ID_Paquete": "PKG-003",
            "Direccion": "Av. Providencia 1200",
            "Comuna": "Providencia",
            "Latitud": -33.4280,
            "Longitud": -70.6150
        },
        {
            "ID_Paquete": "PKG-004",
            "Direccion": "Huerfanos 1050",
            "Comuna": "Santiago",
            "Latitud": -33.4400,
            "Longitud": -70.6500
        },
        
        # --- CASOS EXCEPCIONES ---
        {
            # Excepcion: Comuna declarada es Providencia, pero las coordenadas caen en Las Condes
            "ID_Paquete": "PKG-ERR-001",
            "Direccion": "El Bosque Sur 120 (Declarado en Providencia por error)",
            "Comuna": "Providencia",
            "Latitud": -33.4180,
            "Longitud": -70.5650
        },
        {
            # Excepcion: Las coordenadas corresponden a Valparaiso, fuera de la RM y Las Condes
            "ID_Paquete": "PKG-ERR-002",
            "Direccion": "Av. Altamirano 1450 (Declarado en Las Condes por error)",
            "Comuna": "Las Condes",
            "Latitud": -33.0470,
            "Longitud": -71.6120
        },
        {
            # Excepcion: Comuna no configurada en el sistema
            "ID_Paquete": "PKG-ERR-003",
            "Direccion": "Concha y Toro 120",
            "Comuna": "Puente Alto",
            "Latitud": -33.6120,
            "Longitud": -70.5750
        }
    ]
    
    df_input = pd.DataFrame(mock_packages)
    print("\n[INFO] Dataset de entrada cargado ({} paquetes):".format(len(df_input)))
    print(df_input[["ID_Paquete", "Comuna", "Latitud", "Longitud"]])
    
    # 3. Procesar datos a través del motor GIS
    df_assigned, df_exceptions = engine.process_packages(df_input)
    
    # 4. Mostrar Resultados
    print("\n" + "=" * 70)
    print("1. RESULTADOS DE ASIGNACION CORRECTA (AGRUPADOS POR COMUNA)")
    print("=" * 70)
    if not df_assigned.empty:
        # Agrupar por comuna para el posterior ruteo
        for comuna, group in df_assigned.groupby("Comuna"):
            print(f"\n> Zona/Comuna: {comuna.upper()} ({len(group)} paquetes)")
            print(group[["ID_Paquete", "Direccion", "Latitud", "Longitud"]].to_string(index=False))
    else:
        print("Ningún paquete fue asignado correctamente.")

    print("\n" + "=" * 70)
    print("2. REPORTE DE EXCEPCIONES Y REVISION MANUAL")
    print("=" * 70)
    if not df_exceptions.empty:
        print(df_exceptions[["ID_Paquete", "Comuna", "Direccion", "Motivo_Zonificacion"]].to_string(index=False))
    else:
        print("Felicidades! No se detectaron excepciones en esta sesion.")
    
    print("\n" + "=" * 70)
    print("FIN DEL PROCESO")
    print("=" * 70)
