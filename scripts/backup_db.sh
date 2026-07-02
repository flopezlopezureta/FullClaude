#!/bin/bash

# ==============================================================================
# SCRIPT DE RESPALDO DIARIO DE BASE DE DATOS - PRIORIDAD PENDRIVE LOCAL
# ==============================================================================
# Este script realiza un dump de la base de datos PostgreSQL de Fullenvíos,
# lo comprime y lo guarda con prioridad en un pendrive conectado (/mnt/pendrive).
# Cuenta con un fallback de seguridad en disco local si el pendrive no está montado.
# ==============================================================================

# --- CONFIGURACIÓN LOCAL ---
# Detecta dinámicamente el contenedor de Postgres corriendo (para evitar fallos si Coolify cambia el ID/hash al redesplegar)
DB_CONTAINER=$(docker ps --filter "name=postgres" --format "{{.Names}}" | head -n 1)
DB_USER="postgres"
DB_NAME="fullenvios"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="fullenvios_prod_$DATE.sql.gz"

# --- DESTINOS DE RESPALDO ---
PENDRIVE_DIR="/mnt/d/respaldos"        # Ruta donde se monta el pendrive USB (Unidad D: de Windows en WSL2)
LOCAL_FALLBACK_DIR="/opt/backups/local"  # Directorio local en el servidor (por si se desconecta el USB)

# --- CONFIGURACIÓN DE HISTORIAL ---
DIAS_HISTORIAL=30                        # Cuántos días de historial mantener antes de borrar

# --- INICIO DEL PROCESO ---
echo "[$(date)] Iniciando respaldo de la base de datos..."

# Validar que se detectó el contenedor
if [ -z "$DB_CONTAINER" ]; then
    echo "❌ ERROR CRÍTICO: No se encontró ningún contenedor Docker activo que contenga 'postgres' en su nombre."
    exit 1
fi
echo "Contenedor PostgreSQL detectado: $DB_CONTAINER"

# 1. Determinar ruta de destino activa (Prioridad Pendrive)
if mountpoint -q /mnt/pendrive || [ -d "$PENDRIVE_DIR" ]; then
    TARGET_DIR="$PENDRIVE_DIR"
    echo "USB Pendrive detectado. El respaldo se guardará en: $TARGET_DIR"
else
    TARGET_DIR="$LOCAL_FALLBACK_DIR"
    echo "⚠️ ADVERTENCIA: Pendrive no detectado o desmontado. Usando almacenamiento local de respaldo en: $TARGET_DIR"
fi

# Crear directorio de destino si no existe
mkdir -p "$TARGET_DIR"

FINAL_FILE="$TARGET_DIR/$FILENAME"

# 2. Generar dump desde el contenedor Docker y comprimir en tiempo real
docker exec -t "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$FINAL_FILE"

# 3. Validar generación correcta del archivo
if [ -f "$FINAL_FILE" ] && [ -s "$FINAL_FILE" ]; then
    echo "¡Copia de seguridad completada con éxito! Archivo: $FINAL_FILE"
    
    # 4. Limpieza automática del historial antiguo (mantiene solo los últimos 30 respaldos)
    echo "Limpiando copias de seguridad de más de $DIAS_HISTORIAL días en el destino actual..."
    find "$TARGET_DIR" -type f -name "*.sql.gz" -mtime +$DIAS_HISTORIAL -delete
    echo "Limpieza completada."
else
    echo "❌ ERROR CRÍTICO: Falló la creación de la copia de seguridad o el archivo generado está vacío."
    exit 1
fi

# ==============================================================================
# RESPALDO REMOTO SECUNDARIO (OPCIONAL - HOSTINGER)
# ==============================================================================
# Si en el futuro quieres activar la subida automática a Hostinger además del pendrive,
# solo descomenta las siguientes líneas y configura tu contraseña FTP real:
#
# HOSTINGER_HOST="ftp.fullenvios.cl"
# HOSTINGER_USER="u994400602.flopezcl"
# HOSTINGER_PASS="TU_CONTRASENA_FTP_AQUI"
# HOSTINGER_DIR="/public_html/respaldos_privados_db"
#
# echo "Subiendo copia de seguridad secundaria a Hostinger..."
# curl --ftp-create-dirs -T "$FINAL_FILE" -u "$HOSTINGER_USER:$HOSTINGER_PASS" "ftp://$HOSTINGER_HOST$HOSTINGER_DIR/$FILENAME"
#
# if [ $? -eq 0 ]; then
#     echo "¡Respaldo secundario subido a Hostinger con éxito!"
# else
#     echo "⚠️ ADVERTENCIA: No se pudo subir el respaldo secundario a Hostinger."
# fi
# ==============================================================================

echo "[$(date)] Proceso de copia de seguridad diario completado."
