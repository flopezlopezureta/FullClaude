
import React, { useState } from 'react';
import { IconX, IconFileUpload, IconCheckCircle, IconAlertTriangle, IconFileText } from '../Icon';
import { PackageCreationData } from '../../services/api';
import { ShippingType } from '../../constants';
import { User } from '../../types';

declare const XLSX: any;

interface ImportPackagesModalProps {
  onClose: () => void;
  onImport: (packages: Omit<PackageCreationData, 'origin' | 'creatorId'>[], creatorId?: string) => Promise<void>;
  clients?: User[]; // Optional list of clients for admin mode
}

const EXPECTED_HEADERS = [
    'Nombre Destinatario', 
    'Teléfono', 
    'Dirección', 
    'Comuna', 
    'Ciudad', 
    'Tipo Envío', // EN EL DÍA, EXPRESS, NEXT DAY
    'Notas'
];

const HEADER_MAP: { [key: string]: 'recipientName' | 'recipientPhone' | 'recipientAddress' | 'recipientCommune' | 'recipientCity' | 'shippingType' | 'notes' } = {
    'nombre destinatario': 'recipientName',
    'teléfono': 'recipientPhone',
    'dirección': 'recipientAddress',
    'comuna': 'recipientCommune',
    'ciudad': 'recipientCity',
    'tipo envío': 'shippingType',
    'notas': 'notes',
};

interface ParsedRow {
    rowNumber: number;
    isValid: boolean;
    error?: string;
    packageData?: Omit<PackageCreationData, 'origin' | 'creatorId'>;
    rawData: (string | number)[];
}

const ImportPackagesModal: React.FC<ImportPackagesModalProps> = ({ onClose, onImport, clients }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [dragActive, setDragActive] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState<string>('');

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelected(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelected(e.target.files[0]);
        }
    };
    
    const handleFileSelected = (selectedFile: File) => {
        setFile(selectedFile);
        parseFile(selectedFile);
    };

    const resetState = () => {
        setFile(null);
        setIsParsing(false);
        setParsedRows([]);
    };

    const validateAndParseRow = (row: (string|number)[], rowIndex: number, headers: string[]): ParsedRow => {
        const rowData: { [key: string]: any } = {};
        headers.forEach((header, index) => {
            const key = HEADER_MAP[header.toLowerCase().trim()];
            if (key) {
                rowData[key] = row[index] || '';
            }
        });

        // --- Validations ---
        if (!rowData.recipientName) return { rowNumber: rowIndex + 2, isValid: false, error: 'Falta el nombre del destinatario.', rawData: row };
        if (!rowData.recipientPhone) return { rowNumber: rowIndex + 2, isValid: false, error: 'Falta el teléfono.', rawData: row };
        if (!rowData.recipientAddress) return { rowNumber: rowIndex + 2, isValid: false, error: 'Falta la dirección.', rawData: row };
        if (!rowData.recipientCommune) return { rowNumber: rowIndex + 2, isValid: false, error: 'Falta la comuna.', rawData: row };
        
        const typeMap: { [key: string]: ShippingType } = {
            'EN EL DÍA': ShippingType.SameDay,
            'EXPRESS': ShippingType.Express,
            'NEXT DAY': ShippingType.NextDay,
        };
        const shippingTypeStr = String(rowData.shippingType || '').trim().toUpperCase();
        const validShippingType = typeMap[shippingTypeStr];

        if (!validShippingType) {
            return { rowNumber: rowIndex + 2, isValid: false, error: 'Tipo de envío inválido (Usar: EN EL DÍA, EXPRESS, NEXT DAY).', rawData: row };
        }
        
        // --- Formatting ---
        let phone = String(rowData.recipientPhone).replace(/\s+/g, '');
        if (phone.length === 9 && phone.startsWith('9')) {
          phone = `+56${phone}`;
        } else if (phone.length === 8 && /^\d+$/.test(phone)) {
          phone = `+569${phone}`;
        }

        const packageData: Omit<PackageCreationData, 'origin' | 'creatorId'> = {
            recipientName: String(rowData.recipientName).toUpperCase(),
            recipientPhone: phone,
            recipientAddress: String(rowData.recipientAddress).toUpperCase(),
            recipientCommune: String(rowData.recipientCommune),
            recipientCity: String(rowData.recipientCity || 'Santiago'),
            shippingType: validShippingType,
            estimatedDelivery: new Date(),
            notes: rowData.notes || '',
            source: 'MANUAL',
        };

        return { rowNumber: rowIndex + 2, isValid: true, packageData, rawData: row };
    };


    const parseFile = (fileToParse: File) => {
        setIsParsing(true);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: (string|number)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (json.length < 2) {
                    setParsedRows([{ rowNumber: 1, isValid: false, error: 'El archivo está vacío o no tiene datos.', rawData: [] }]);
                    return;
                }

                const headers = (json[0] as string[]).map(h => String(h).trim());
                const dataRows = json.slice(1);
                
                const missingHeaders = EXPECTED_HEADERS.filter(h => !headers.map(th => th.toLowerCase()).includes(h.toLowerCase()));
                if(missingHeaders.length > 0) {
                    setParsedRows([{ rowNumber: 1, isValid: false, error: `Faltan las siguientes columnas: ${missingHeaders.join(', ')}`, rawData: [] }]);
                    return;
                }

                const parsed = dataRows.map((row, index) => validateAndParseRow(row, index, headers));
                setParsedRows(parsed);

            } catch (error) {
                console.error(error);
                setParsedRows([{ rowNumber: 0, isValid: false, error: 'No se pudo leer el archivo. Asegúrate que sea un formato Excel válido.', rawData: [] }]);
            } finally {
                setIsParsing(false);
            }
        };
        reader.readAsBinaryString(fileToParse);
    };

    const handleDownloadTemplate = () => {
        const worksheet = XLSX.utils.aoa_to_sheet([EXPECTED_HEADERS, [
            'Juan Pérez',
            '912345678',
            'Av. Siempre Viva 123',
            'Providencia',
            'Santiago',
            'EN EL DÍA',
            'Dejar en conserjería'
        ]]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla Paquetes");
        XLSX.writeFile(workbook, "plantilla_importacion.xlsx");
    };

    const handleSubmit = async () => {
        if (clients && !selectedClientId) {
            alert('Por favor selecciona un cliente para asignar los paquetes.');
            return;
        }
        const validPackages = parsedRows.filter(r => r.isValid && r.packageData).map(r => r.packageData!);
        if (validPackages.length === 0) return;
        
        setIsImporting(true);
        try {
            await onImport(validPackages, selectedClientId);
        } catch (error) {
            console.error("Import failed", error);
        } finally {
            setIsImporting(false);
        }
    };

    const validCount = parsedRows.filter(r => r.isValid).length;
    const invalidCount = parsedRows.length - validCount;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[90vh] flex flex-col animate-fade-in-up" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between p-4 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-800">Importar Paquetes desde Excel</h3>
                <button onClick={onClose} className="p-2 rounded-full text-slate-500 hover:bg-slate-100" aria-label="Cerrar modal">
                    <IconX className="w-6 h-6" />
                </button>
            </header>
            
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                
                {clients && (
                    <div className="mb-6">
                        <label htmlFor="client-select" className="block text-sm font-medium text-slate-700 mb-2">Asignar a Cliente</label>
                        <select
                            id="client-select"
                            value={selectedClientId}
                            onChange={(e) => setSelectedClientId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">-- Seleccionar Cliente --</option>
                            {clients.map(client => (
                                <option key={client.id} value={client.id}>{client.name}</option>
                            ))}
                        </select>
                        {!selectedClientId && <p className="text-xs text-red-500 mt-1">Debes seleccionar un cliente antes de importar.</p>}
                    </div>
                )}

                {!file ? (
                    <div className="text-center">
                        <p className="text-slate-600 mb-4">Sigue estos pasos para importar tus paquetes:</p>
                        <ol className="text-left list-decimal list-inside bg-slate-50 p-4 rounded-md space-y-2 mb-6">
                            <li>Descarga nuestra plantilla de Excel para asegurar el formato correcto.</li>
                            <li>Completa la plantilla con la información de tus paquetes.</li>
                            <li>Sube el archivo completo aquí.</li>
                        </ol>
                        <button onClick={handleDownloadTemplate} className="mb-6 inline-flex items-center px-4 py-2 border border-green-600 text-sm font-medium rounded-md shadow-sm text-green-700 bg-green-50 hover:bg-green-100">
                            <IconFileText className="w-5 h-5 mr-2"/>
                            Descargar Plantilla
                        </button>

                        <form onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()} className="relative">
                            <input type="file" id="file-upload" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                            <label htmlFor="file-upload" className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}>
                                <IconFileUpload className="w-10 h-10 mb-3 text-slate-400"/>
                                <p className="mb-2 text-sm text-slate-500">
                                    <span className="font-semibold">Haz clic para subir</span> o arrastra el archivo
                                </p>
                                <p className="text-xs text-slate-500">XLSX o XLS</p>
                            </label>
                            {dragActive && <div className="absolute inset-0 w-full h-full" onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}></div>}
                        </form>
                    </div>
                ) : isParsing ? (
                     <p className="text-center text-slate-500 py-12">Procesando archivo...</p>
                ) : (
                    <div>
                        <div className="flex justify-between items-center mb-4 p-3 bg-slate-50 rounded-md">
                           <div>
                                <p className="font-medium text-slate-800">Archivo: {file.name}</p>
                                <div className="flex gap-4 text-sm">
                                    <span className="text-green-600 font-semibold">{validCount} paquetes válidos</span>
                                    {invalidCount > 0 && <span className="text-red-600 font-semibold">{invalidCount} con errores</span>}
                                </div>
                           </div>
                           <button onClick={resetState} className="text-sm text-blue-600 hover:underline">Cambiar archivo</button>
                        </div>
                        <div className="border rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                             <table className="min-w-full text-sm">
                                <thead className="bg-slate-100 sticky top-0">
                                    <tr>
                                        <th className="p-2 text-left font-medium text-slate-600">Fila</th>
                                        <th className="p-2 text-left font-medium text-slate-600">Estado</th>
                                        <th className="p-2 text-left font-medium text-slate-600">Detalles</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {parsedRows.map(row => (
                                        <tr key={row.rowNumber} className={row.isValid ? 'bg-white' : 'bg-red-50'}>
                                            <td className="p-2 font-mono">{row.rowNumber}</td>
                                            <td className="p-2">
                                                {row.isValid ? 
                                                    <span className="inline-flex items-center text-green-700"><IconCheckCircle className="w-4 h-4 mr-1.5"/> Válido</span> : 
                                                    <span className="inline-flex items-center text-red-700"><IconAlertTriangle className="w-4 h-4 mr-1.5"/> Error</span>
                                                }
                                            </td>
                                            <td className="p-2 text-slate-700">
                                                {row.error || `${row.packageData?.recipientName} - ${row.packageData?.recipientAddress}`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                             </table>
                        </div>
                    </div>
                )}
            </div>

            <footer className="px-6 py-4 bg-slate-50 rounded-b-xl flex justify-end space-x-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">Cancelar</button>
                <button 
                    type="button" 
                    onClick={handleSubmit}
                    disabled={isImporting || validCount === 0 || !file || (clients && !selectedClientId)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 disabled:bg-slate-400"
                >
                   {isImporting ? 'Importando...' : `Importar ${validCount} Paquetes`}
                </button>
            </footer>
        </div>
      </div>
    );
};

export default ImportPackagesModal;
