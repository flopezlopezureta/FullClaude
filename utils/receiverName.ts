// Control del NOMBRE DE QUIEN RECIBE al cerrar una entrega (formulario del conductor y cierre administrativo).
//
// El campo es obligatorio, pero en los cierres de 14 días casi 14 de cada 100 traían un nombre de 0 o 1 letra (un «.», una «m»…), sobre todo de unos pocos conductores,
// así que no decía nada de quién recibió. Esta regla frena lo evidentemente vacío sin estorbar a quien sí anota algo: un nombre de pila solo («Juan») sirve, y también
// quién fue («Conserje», «Portería», «Titular», «Vecino»), que es lo que más se escribe cuando la persona no da su nombre.
// La misma regla vive en el servidor (services/receiverName.js): si se cambia aquí, cambiarla allá (tests/deliveryChecks.test.js compara las dos).

export type ReceiverNameProblem = 'EMPTY' | 'NO_LETTERS' | 'TOO_SHORT' | 'INITIALS_ONLY' | 'REPEATED' | 'PLACEHOLDER';

export const MIN_RECEIVER_LETTERS = 3;

// Textos de relleno (ya sin tildes, mayúsculas ni espacios): teclazos, pruebas, «no hay nombre» y palabras sueltas que no son un nombre.
const PLACEHOLDERS = new Set([
  'asd', 'asdf', 'asdfg', 'asdfgh', 'sdf', 'sdfg', 'qwe', 'qwer', 'qwert', 'qwerty', 'zxc', 'zxcv', 'wasd', 'xyz', 'abc', 'abcd', 'abcde',
  'test', 'prueba', 'pruebas',
  'nose', 'nosabe', 'noindica', 'nodice', 'nodio', 'sinnombre', 'sindato', 'sindatos', 'ninguno', 'ninguna', 'nadie', 'nada', 'anonimo', 'anonima', 'desconocido', 'desconocida',
  'por', 'con', 'sin', 'que', 'del', 'los', 'las', 'una', 'uno',
]);

const cleanName = (raw: unknown): string => String(raw ?? '').replace(/\s+/g, ' ').trim();
const lettersIn = (text: string): number => (text.match(/\p{L}/gu) ?? []).length;
/** «Á.b-C» → «abc»: minúsculas, sin tildes y solo letras. */
const foldName = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}]/gu, '');

/** Qué tiene de malo el nombre escrito, o null si sirve. */
export const receiverNameProblem = (raw: unknown): ReceiverNameProblem | null => {
  const name = cleanName(raw);
  if (!name) return 'EMPTY';
  const letters = lettersIn(name);
  if (letters === 0) return 'NO_LETTERS';
  if (letters < MIN_RECEIVER_LETTERS) return 'TOO_SHORT';
  // «A B C», «J P M»: solo iniciales sueltas
  if (Math.max(...name.split(' ').map(lettersIn)) < 2) return 'INITIALS_ONLY';
  const folded = foldName(name);
  // una misma letra («aaa», «xxxx») o una sílaba que se repite («jajaja», «lalala»)
  if (/^(\p{L}{1,3})\1{2,}$/u.test(folded)) return 'REPEATED';
  if (PLACEHOLDERS.has(folded)) return 'PLACEHOLDER';
  return null;
};

/** Mensaje para el conductor, o null si el nombre sirve. */
export const receiverNameMessage = (problem: ReceiverNameProblem | null): string | null => {
  switch (problem) {
    case null: return null;
    case 'EMPTY': return 'Escribe el nombre de quien recibe.';
    case 'REPEATED':
    case 'PLACEHOLDER': return 'Ese no parece un nombre real. Escribe el nombre de quien recibe o, si no quiso darlo, quién fue: Conserje, Vecino o Familiar.';
    default: return 'Escribe el nombre de quien recibe (al menos 3 letras). Si no quiso darlo, escribe quién fue: Conserje, Vecino o Familiar.';
  }
};

/** Atajo para los formularios: el mensaje del problema del nombre escrito, o null si sirve (un campo vacío no se reclama aquí: ya es obligatorio). */
export const receiverNameErrorMessage = (raw: unknown): string | null => {
  if (!cleanName(raw)) return null;
  return receiverNameMessage(receiverNameProblem(raw));
};
