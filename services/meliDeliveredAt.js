/**
 * Hora REAL en que Mercado Libre registró la entrega de un envío: la que ML usa para su porcentaje semanal de envíos correctos.
 *
 * Por qué existe: GET /shipments/{id} entrega `status_history` como un OBJETO ({ date_delivered, date_shipped, date_first_visit, … }) y el código lo
 * buscaba como una LISTA ([{ status: 'delivered', date }]). Al no encontrarla, el evento CIERRE_OFICIAL_ML guardaba la hora en que NUESTRO sondeo
 * detectó el cierre (en promedio 13 min después de la de ML) o no guardaba nada. Aquí se leen los formatos conocidos, del más fiable al menos.
 *
 * Sin base de datos ni dependencias: solo reglas, para poder probarlas sueltas.
 */

// Una hora de ML más de 10 min en el futuro es un dato malo (o un reloj desfasado): se ignora y se sigue con el siguiente formato.
const MAX_FUTURE_MS = 10 * 60 * 1000;

const toDate = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * @param {object} shipment respuesta de GET /shipments/{id}
 * @param {{ now?: Date }} [opts]
 * @returns {{ date: Date | null, source: string | null }} la hora de entrega según ML y de dónde salió; `date` es null si ML no la informa
 */
function extractMeliDeliveredAt(shipment, { now = new Date() } = {}) {
    if (!shipment || typeof shipment !== 'object') return { date: null, source: null };
    const history = shipment.status_history;
    const candidates = [];
    // 1) Formato actual de la API: objeto con la fecha de cada etapa.
    if (history && typeof history === 'object' && !Array.isArray(history)) candidates.push(['status_history.date_delivered', history.date_delivered]);
    // 2) Campo directo del envío.
    candidates.push(['shipment.date_delivered', shipment.date_delivered]);
    // 3) Formato antiguo en lista: la entrada más reciente de tipo 'delivered'.
    if (Array.isArray(history)) {
        const last = history.filter(h => h && h.status === 'delivered' && toDate(h.date)).sort((a, b) => toDate(b.date) - toDate(a.date))[0];
        if (last) candidates.push(['status_history.delivered', last.date]);
    }
    // 4) Último recurso.
    candidates.push(['shipment.delivered_date', shipment.delivered_date]);
    for (const [source, value] of candidates) {
        const d = toDate(value);
        if (d && d.getTime() <= now.getTime() + MAX_FUTURE_MS) return { date: d, source };
    }
    return { date: null, source: null };
}

module.exports = { extractMeliDeliveredAt };
