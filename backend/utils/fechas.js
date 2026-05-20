/**
 * UTILIDADES DE FECHAS PARA TAREAS RECURRENTES
 * Incluye feriados argentinos y cálculo de días hábiles
 */

// Feriados argentinos (actualizar anualmente los móviles)
const FERIADOS_ARGENTINA = [
  '01-01', // Año Nuevo
  '02-12', // Carnaval (2026 - ajustar cada año)
  '02-13', // Carnaval (2026)
  '03-24', // Día Nacional de la Memoria
  '04-02', // Malvinas
  '04-18', // Viernes Santo (2026 - ajustar cada año)
  '05-01', // Día del Trabajador
  '05-25', // Revolución de Mayo
  '06-20', // Día de la Bandera (trasladable)
  '07-09', // Independencia
  '08-17', // Paso a la Inmortalidad del Gral. San Martín (trasladable)
  '10-12', // Diversidad Cultural (trasladable)
  '11-20', // Soberanía Nacional (trasladable)
  '12-08', // Inmaculada Concepción
  '12-25', // Navidad
];

/**
 * Verifica si una fecha es día hábil en Argentina
 * @param {Date} fecha - Fecha a verificar
 * @returns {boolean}
 */
const esDiaHabil = (fecha) => {
  const dia = fecha.getDay();
  
  // 0 = Domingo, 6 = Sábado
  if (dia === 0 || dia === 6) return false;
  
  // Verificar feriados
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const diaMes = String(fecha.getDate()).padStart(2, '0');
  const mesDia = `${mes}-${diaMes}`;
  
  if (FERIADOS_ARGENTINA.includes(mesDia)) return false;
  
  return true;
};

/**
 * Ajusta una fecha al siguiente día hábil
 * @param {Date} fecha - Fecha a ajustar
 * @returns {Date}
 */
const ajustarADiaHabil = (fecha) => {
  const nuevaFecha = new Date(fecha);
  let intentos = 0;
  
  while (!esDiaHabil(nuevaFecha) && intentos < 30) {
    nuevaFecha.setDate(nuevaFecha.getDate() + 1);
    intentos++;
  }
  
  return nuevaFecha;
};

/**
 * Calcula la próxima fecha de vencimiento para un ticket recurrente
 * @param {Date} fechaBase - Fecha desde la cual calcular
 * @param {Object} configRecurrencia - Configuración de recurrencia
 * @returns {Date|null}
 */
const calcularProximaFecha = (fechaBase, configRecurrencia) => {
  const { 
    tipo, 
    intervalo = 1, 
    solo_dias_habiles = true, 
    dias_semana, 
    dia_mes 
  } = configRecurrencia;
  
  const ahora = new Date();
  let proximaFecha = new Date(fechaBase);
  let intentos = 0;
  const maxIntentos = 365;
  
  while (intentos < maxIntentos) {
    // Mover fecha según el tipo de recurrencia
    switch (tipo) {
      case 'diaria':
        proximaFecha.setDate(proximaFecha.getDate() + intervalo);
        break;
        
      case 'semanal':
        if (dias_semana && dias_semana.length > 0) {
          // Avanzar día por día hasta encontrar un día permitido
          proximaFecha.setDate(proximaFecha.getDate() + 1);
          let diasBusqueda = 0;
          while (!dias_semana.includes(proximaFecha.getDay()) && diasBusqueda < 14) {
            proximaFecha.setDate(proximaFecha.getDate() + 1);
            diasBusqueda++;
          }
        } else {
          proximaFecha.setDate(proximaFecha.getDate() + (7 * intervalo));
        }
        break;
        
      case 'mensual':
        const diaObjetivo = dia_mes || fechaBase.getDate();
        proximaFecha.setMonth(proximaFecha.getMonth() + intervalo);
        const diasEnMes = new Date(
          proximaFecha.getFullYear(), 
          proximaFecha.getMonth() + 1, 
          0
        ).getDate();
        proximaFecha.setDate(Math.min(diaObjetivo, diasEnMes));
        break;
        
      case 'anual':
        proximaFecha.setFullYear(proximaFecha.getFullYear() + intervalo);
        break;
        
      default:
        return null;
    }
    
    // Si la fecha calculada ya pasó, continuar buscando
    if (proximaFecha <= ahora) {
      intentos++;
      continue;
    }
    
    // Ajustar a día hábil si es necesario
    if (solo_dias_habiles && !esDiaHabil(proximaFecha)) {
      proximaFecha = ajustarADiaHabil(proximaFecha);
    }
    
    return proximaFecha;
  }
  
  return null;
};

module.exports = {
  esDiaHabil,
  ajustarADiaHabil,
  calcularProximaFecha,
  FERIADOS_ARGENTINA
};