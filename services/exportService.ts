
import ExcelJS from 'exceljs';
import { Package, User } from '../types';
import { PackageStatus } from '../constants';

const mapStatus = (status: PackageStatus): string => {
    switch (status) {
        case PackageStatus.Pending: return 'PENDIENTE';
        case PackageStatus.PickedUp: return 'PICKEADO';
        case PackageStatus.InTransit: return 'EN RUTA';
        case PackageStatus.Delivered: return 'ENTREGADO';
        case PackageStatus.Delayed: return 'RETRASADO';
        case PackageStatus.Problem: return 'PROBLEMA';
        case PackageStatus.ReturnPending: return 'PEND. DEVOLUCION';
        case PackageStatus.Returned: return 'DEVUELTO';
        case PackageStatus.Cancelled: return 'CANCELADO';
        case PackageStatus.Rescheduled: return 'REPROGRAMADO';
        default: return status;
    }
};

export const exportToExcel = async (packages: Package[], filename: string, users: User[] = []) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('BASE');

    const userMap = new Map(users.map(u => [u.id, u.name]));

    // Define columns
    worksheet.columns = [
        { header: 'PEDIDO', key: 'pedido', width: 15 },
        { header: 'FECHA DE PEDIDO', key: 'fecha', width: 20 },
        { header: 'DESTINATARIO', key: 'destinatario', width: 25 },
        { header: 'TELEFONO', key: 'telefono', width: 15 },
        { header: 'DIRECCION', key: 'direccion', width: 35 },
        { header: 'COMUNA', key: 'comuna', width: 20 },
        { header: 'CORREO', key: 'correo', width: 25 },
        { header: 'ESTADO_PICK', key: 'estado', width: 15 },
        { header: 'BULTOS', key: 'bultos', width: 10 },
        { header: 'CONDUCTOR', key: 'conductor', width: 20 },
    ];

    // Add rows
    packages.forEach(pkg => {
        worksheet.addRow({
            pedido: pkg.meliOrderId || pkg.id,
            fecha: new Date(pkg.createdAt).toLocaleDateString('es-CL').replace(/\//g, '-'),
            destinatario: pkg.recipientName,
            telefono: pkg.recipientPhone,
            direccion: pkg.recipientAddress,
            comuna: pkg.recipientCommune,
            correo: '',
            estado: mapStatus(pkg.status),
            bultos: 1,
            conductor: pkg.driverId ? (userMap.get(pkg.driverId) || 'No encontrado') : 'No asignado'
        });
    });

    // Style header
    const headerRow = worksheet.getRow(1);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' } // Blue from image
        };
        cell.font = {
            color: { argb: 'FFFFFFFF' }, // White
            bold: true,
            size: 11
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };
    });

    // Style rows (zebra stripes and borders)
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.height = 20;
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            if (rowNumber % 2 === 0) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD9E1F2' } // Light blue from image
                };
            }
        });
    });

    // Add second sheet
    workbook.addWorksheet('RESUMEN_PICKING');

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
};

export const exportToCSV = (packages: Package[], filename: string, users: User[] = []) => {
    const userMap = new Map(users.map(u => [u.id, u.name]));
    const headers = [
        'ID Paquete',
        'Fecha Creación',
        'Estado',
        'Destinatario',
        'Dirección',
        'Comuna',
        'Ciudad',
        'Tipo Envío',
        'Conductor'
    ];

    const escapeCSV = (val: any) => {
        const str = String(val || '').replace(/"/g, '""');
        return `"${str}"`;
    };

    const rows = packages.map(pkg => [
        pkg.id,
        new Date(pkg.createdAt).toLocaleString('es-CL'),
        pkg.status.replace('_', ' '),
        pkg.recipientName,
        pkg.recipientAddress,
        pkg.recipientCommune,
        pkg.recipientCity,
        pkg.shippingType,
        pkg.driverId ? (userMap.get(pkg.driverId) || 'No encontrado') : 'No asignado'
    ].map(escapeCSV).join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
