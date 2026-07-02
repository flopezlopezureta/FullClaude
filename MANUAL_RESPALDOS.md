# 🛡️ MANUAL DE RESPALDOS DE BASE DE DATOS DE FULLENVÍOS (PRODUCCIÓN)

Este manual documenta la arquitectura y configuración del sistema de copias de seguridad automáticas diarias implementado para la base de datos PostgreSQL de producción en el servidor local.

---

## 💾 1. Destino Físico (Pendrive USB)
* **Unidad en Windows**: Unidad `D:` (Nombre de volumen: `USB_STRELEC`).
* **Capacidad**: 64 GB (54.8 GB libres).
* **Ruta de Montaje en WSL2**: `/mnt/d/respaldos` (montado de forma nativa mediante `drvfs`).

---

## ⚙️ 2. Script de Respaldo (`backup_db.sh`)
El script de mantenimiento está ubicado en la ruta segura de Linux:
📂 `/opt/backups/backup_db.sh`

### Características de Seguridad del Script:
1. **Identificación de Contenedor Real**: Conectado directamente al contenedor Docker real de producción de PostgreSQL: `yss8k8sggsk0gwkkgos8gk0w`.
2. **Historial Flotante de 30 Días**: Mantiene siempre los últimos 30 archivos de respaldo individuales (`.sql.gz`) para evitar ocupar espacio innecesario, eliminando automáticamente los archivos más antiguos.
3. **Respaldo de Fallback**: Si el pendrive USB es desconectado físicamente por error, el script lo detecta automáticamente y guarda el respaldo diario en la carpeta local segura: `/opt/backups/local/`.
4. **Nomenclatura Única**: Cada archivo se guarda con la fecha y hora exacta: `fullenvios_prod_AAAA-MM-DD_HH-MM-SS.sql.gz`.

---

## ⏰ 3. Automatización Diaria (Cron Job)
Se configuró una tarea programada en el sistema operativo Linux para ejecutar el script todas las noches a las **3:00 AM**.

* **Línea de comando en Crontab** (`crontab -l`):
  ```text
  0 3 * * * /bin/bash /opt/backups/backup_db.sh > /opt/backups/backup.log 2>&1
  ```
* **Registro de Bitácora (Log)**: Cualquier ejecución o error técnico se guarda de forma transparente en `/opt/backups/backup.log`.

---

## 🛠️ 4. Comandos de Mantenimiento Útiles

### A. Ejecutar el respaldo de forma manual en cualquier momento:
Si quieres hacer un respaldo inmediato (por ejemplo, antes de una actualización importante):
```bash
bash /opt/backups/backup_db.sh
```

### B. Listar los archivos guardados en el pendrive y su tamaño real:
```bash
ls -lh /mnt/d/respaldos/
```

### C. Ver el registro de la última ejecución del respaldo automático:
```bash
cat /opt/backups/backup.log
```

---
*Este sistema de copias de seguridad ha sido verificado y puesto en producción con éxito el 17 de mayo de 2026.*
