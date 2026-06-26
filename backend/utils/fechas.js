const FERIADOS_ARGENTINA = [
  '01-01',
  '02-12',
  '02-13',
  '03-24',
  '04-02',
  '04-18',
  '05-01',
  '05-25',
  '06-20',
  '07-09',
  '08-17',
  '10-12',
  '11-20',
  '12-08',
  '12-25',
];

const esDiaHabil = (fecha) => {
  const dia = fecha.getDay();
  
  if (dia === 0 || dia === 6) return false;
  
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const diaMes = String(fecha.getDate()).padStart(2, '0');
  const mesDia = `${mes}-${diaMes}`;
  
  if (FERIADOS_ARGENTINA.includes(mesDia)) return false;
  
  return true;
};

const ajustarADiaHabil = (fecha) => {
  const nuevaFecha = new Date(fecha);
  let intentos = 0;
  
  while (!esDiaHabil(nuevaFecha) && intentos < 30) {
    nuevaFecha.setDate(nuevaFecha.getDate() + 1);
    intentos++;
  }
  
  return nuevaFecha;
};

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
    switch (tipo) {
      case 'diaria':
        proximaFecha.setDate(proximaFecha.getDate() + intervalo);
        break;
        
      case 'semanal':
        if (dias_semana && dias_semana.length > 0) {
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
    
    if (proximaFecha <= ahora) {
      intentos++;
      continue;
    }
    
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