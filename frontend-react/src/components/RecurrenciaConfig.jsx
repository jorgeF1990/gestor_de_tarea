import React from 'react';
import { RefreshCw, Calendar } from 'lucide-react';
import './RecurrenciaConfig.css';

const TIPOS = [
  { value: 'diaria', label: 'Diaria' },
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual', label: 'Anual' }
];

const DIAS_SEMANA = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' }
];

/**
 * Componente para configurar recurrencia de tareas
 */
export default function RecurrenciaConfig({ config = {}, onChange, disabled = false }) {
  const esRecurrente = config?.es_recurrente || false;
  const recurrencia = config?.recurrencia || {};

  const handleToggle = (e) => {
    const checked = e.target.checked;
    onChange({
      es_recurrente: checked,
      recurrencia: checked ? {
        tipo: 'semanal',
        intervalo: 1,
        solo_dias_habiles: true,
        dias_semana: [1, 2, 3, 4, 5]
      } : null
    });
  };

  const handleChange = (campo, valor) => {
    onChange({
      es_recurrente: true,
      recurrencia: { ...recurrencia, [campo]: valor }
    });
  };

  const toggleDiaSemana = (dia) => {
    const dias = recurrencia.dias_semana || [1, 2, 3, 4, 5];
    const nuevos = dias.includes(dia)
      ? dias.filter(d => d !== dia)
      : [...dias, dia].sort();
    handleChange('dias_semana', nuevos);
  };

  return (
    <div className="recurrencia-config">
      <div className="recurrencia-toggle">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={esRecurrente}
            onChange={handleToggle}
            disabled={disabled}
          />
          <RefreshCw size={16} />
          <span>Tarea Recurrente</span>
        </label>
      </div>

      {esRecurrente && (
        <div className="recurrencia-opciones">
          <div className="recurrencia-fila">
            <div className="form-grupo" style={{ flex: 1 }}>
              <label>Tipo</label>
              <select
                value={recurrencia.tipo || 'diaria'}
                onChange={(e) => handleChange('tipo', e.target.value)}
                disabled={disabled}
              >
                {TIPOS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="form-grupo" style={{ width: 80 }}>
              <label>Intervalo</label>
              <input
                type="number"
                min="1"
                max="99"
                value={recurrencia.intervalo || 1}
                onChange={(e) => handleChange('intervalo', parseInt(e.target.value) || 1)}
                disabled={disabled}
              />
            </div>
          </div>

          {/* Solo días hábiles */}
          <div className="recurrencia-check">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={recurrencia.solo_dias_habiles !== false}
                onChange={(e) => handleChange('solo_dias_habiles', e.target.checked)}
                disabled={disabled}
              />
              <Calendar size={14} />
              <span>Solo días hábiles (excluye fines de semana y feriados)</span>
            </label>
          </div>

          {/* Días de la semana (solo recurrencia semanal) */}
          {recurrencia.tipo === 'semanal' && (
            <div className="dias-semana">
              <label>Repetir los días:</label>
              <div className="dias-botones">
                {DIAS_SEMANA.map(dia => (
                  <button
                    key={dia.value}
                    type="button"
                    className={`dia-btn ${(recurrencia.dias_semana || []).includes(dia.value) ? 'active' : ''}`}
                    onClick={() => toggleDiaSemana(dia.value)}
                    disabled={disabled}
                  >
                    {dia.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Día del mes (solo recurrencia mensual) */}
          {recurrencia.tipo === 'mensual' && (
            <div className="form-grupo" style={{ maxWidth: 120 }}>
              <label>Día del mes</label>
              <input
                type="number"
                min="1"
                max="31"
                value={recurrencia.dia_mes || 1}
                onChange={(e) => handleChange('dia_mes', parseInt(e.target.value) || 1)}
                disabled={disabled}
                placeholder="1-31"
              />
            </div>
          )}

          {/* Fecha fin de recurrencia (opcional) */}
          <div className="form-grupo" style={{ maxWidth: 200 }}>
            <label>
              <Calendar size={12} /> Finalizar recurrencia (opcional)
            </label>
            <input
              type="date"
              value={recurrencia.fecha_fin ? new Date(recurrencia.fecha_fin).toISOString().split('T')[0] : ''}
              onChange={(e) => handleChange('fecha_fin', e.target.value || null)}
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}