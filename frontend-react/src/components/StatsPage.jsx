import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import axios from "axios";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ArcElement,
} from "chart.js";
import { Bar, Doughnut, Pie, Line } from "react-chartjs-2";
import "./StatsPage.css";

// ⬇️ Agregados para PDF
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/* ========= Helpers para campos heterogéneos ========= */
const guessAuthor = (t) =>
  t.creador || t.usuario || t.cliente || t.createdBy || t.autor || t?.usuario_id?.email || "desconocido";

const guessType = (t) => t.tipo || t.categoria || t.category || "sin_tipo";

const guessState = (t) => (t.estado || "").toString().toLowerCase() || "sin_estado";

const guessPriority = (t) => (t.prioridad || t.priority || "sin_prioridad").toString().toLowerCase();

const guessCreatedAt = (t) => t.historial?.[0]?.fecha || t.createdAt || t.created_at || t.fecha_creacion || null;

const guessResolvedAt = (t) => t.resolvedAt || t.fecha_cierre || null;

const guessFirstResponseAt = (t) => t.firstResponseAt || t.primera_respuesta || null;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const toDayKey = (d) => new Date(d).toISOString().slice(0, 10);

const weekdays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const formatHours = (ms) => {
  if (!ms || ms <= 0) return "—";
  const h = ms / 36e5;
  return `${h.toFixed(2)} h`;
};

/* ========= Paletas ========= */
const PALETTE = [
  "#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#f97316", "#64748b", "#14b8a6",
];

const colorByEstado = {
  abierto: "#22c55e",
  pendiente: "#e11d48",
  en_proceso: "#f59e0b",
  resuelto: "#10b981",
  cerrado: "#64748b",
  reabierto: "#fb923c",
  cancelado: "#ef4444",
  sin_estado: "#94a3b8",
};

/* ========= SLA Targets (en horas) ========= */
const SLA_FIRST_RESPONSE_H =
  Number(import.meta.env.VITE_SLA_FIRST_RESPONSE_H || 4);
const SLA_RESOLUTION_H =
  Number(import.meta.env.VITE_SLA_RESOLUTION_H || 48);

export default function StatsPage({ tickets: propTickets }) {
  const [tickets, setTickets] = useState(propTickets || []);
  const [loading, setLoading] = useState(false);

  // Filtros de periodo
  const [preset, setPreset] = useState("30"); // "7" | "30" | "90" | "custom"
  const [start, setStart] = useState(""); // YYYY-MM-DD
  const [end, setEnd] = useState(""); // YYYY-MM-DD

  // ⬇️ Ref del contenedor a exportar
  const statsRef = useRef(null);

  /* ====== Carga (si no viene por props) ====== */
  useEffect(() => {
    if (propTickets) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/tickets`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (mounted) setTickets(res.data || []);
      } catch (err) {
        console.error("Error cargando tickets:", err);
        if (mounted) setTickets([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [propTickets]);

  /* ====== Determinar rango de fechas ====== */
  const todayKey = toDayKey(new Date());
  const [rangeStart, rangeEnd] = useMemo(() => {
    if (preset !== "custom") {
      const days = Number(preset || 30);
      const endD = new Date();
      const startD = new Date();
      startD.setDate(endD.getDate() - (days - 1));
      return [toDayKey(startD), toDayKey(endD)];
    }
    const s = start || todayKey;
    const e = end || todayKey;
    return [s, e];
  }, [preset, start, end, todayKey]);

  const inRange = useCallback(
    (d) => {
      if (!d) return false;
      const k = toDayKey(d);
      return k >= rangeStart && k <= rangeEnd;
    },
    [rangeStart, rangeEnd]
  );

  /* ====== Datos filtrados por rango ====== */
  const filtered = useMemo(() => {
    if (!tickets?.length) return [];
    return tickets.filter((t) => {
      const created = guessCreatedAt(t);
      return created && inRange(created);
    });
  }, [tickets, inRange]);

  /* ====== Agregaciones / KPIs ====== */
  const {
    byState,
    byType,
    byUser,
    byPriority,
    perDay,
    stackedPerDay,
    byWeekday,
    avgFirstResponse,
    avgResolution,
    firstContactResolution,
    totals,
    dailyAvgFirstResponse,
    dailyAvgResolution,
  } = useMemo(() => {
    const byState = {};
    const byType = {};
    const byUser = {};
    const byPriority = {};
    const perDay = {};
    const stackedPerDay = {};
    const byWeekday = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    let totalFirstResponse = 0, countFirstResponse = 0;
    let totalResolution = 0, countResolution = 0;
    let resolvedAtFirstContact = 0, totalResolved = 0;

    const frDailySum = {};
    const frDailyCount = {};
    const rsDailySum = {};
    const rsDailyCount = {};

    filtered.forEach((t) => {
      const st = guessState(t) || "sin_estado";
      const ty = guessType(t) || "sin_tipo";
      const user = guessAuthor(t) || "desconocido";
      const pr = guessPriority(t);

      byState[st] = (byState[st] || 0) + 1;
      byType[ty] = (byType[ty] || 0) + 1;
      byUser[user] = (byUser[user] || 0) + 1;
      byPriority[pr] = (byPriority[pr] || 0) + 1;

      const created = guessCreatedAt(t);
      if (created) {
        const d = new Date(created);
        if (!Number.isNaN(d.getTime())) {
          const key = toDayKey(d);
          perDay[key] = (perDay[key] || 0) + 1;

          stackedPerDay[key] = stackedPerDay[key] || {};
          stackedPerDay[key][st] = (stackedPerDay[key][st] || 0) + 1;

          byWeekday[d.getDay()] = (byWeekday[d.getDay()] || 0) + 1;
        }
      }

      const fr = guessFirstResponseAt(t);
      if (fr && created) {
        const diff = new Date(fr) - new Date(created);
        if (diff > 0) {
          totalFirstResponse += diff;
          countFirstResponse++;
          const k = toDayKey(created);
          frDailySum[k] = (frDailySum[k] || 0) + diff;
          frDailyCount[k] = (frDailyCount[k] || 0) + 1;
        }
      }

      const rs = guessResolvedAt(t);
      if (rs && created) {
        const diff = new Date(rs) - new Date(created);
        if (diff > 0) {
          totalResolution += diff;
          countResolution++;
          totalResolved++;
          const interactions = t.interactionsCount ?? t.historial?.length ?? 0;
          if (interactions <= 1) resolvedAtFirstContact++;

          const k = toDayKey(created);
          rsDailySum[k] = (rsDailySum[k] || 0) + diff;
          rsDailyCount[k] = (rsDailyCount[k] || 0) + 1;
        }
      }
    });

    const totals = {
      total: filtered.length,
      abiertos: byState.abierto || 0,
      pendientes: byState.pendiente || 0,
      enProceso: byState.en_proceso || 0,
      resueltos: byState.resuelto || 0,
    };

    const dailyAvgFirstResponse = {};
    const dailyAvgResolution = {};
    Object.keys(frDailySum).forEach((k) => {
      dailyAvgFirstResponse[k] = frDailySum[k] / (frDailyCount[k] || 1);
    });
    Object.keys(rsDailySum).forEach((k) => {
      dailyAvgResolution[k] = rsDailySum[k] / (rsDailyCount[k] || 1);
    });

    return {
      byState,
      byType,
      byUser,
      byPriority,
      perDay,
      stackedPerDay,
      byWeekday,
      avgFirstResponse: countFirstResponse ? totalFirstResponse / countFirstResponse : 0,
      avgResolution: countResolution ? totalResolution / countResolution : 0,
      firstContactResolution: totalResolved ? (resolvedAtFirstContact / totalResolved) * 100 : 0,
      totals,
      dailyAvgFirstResponse,
      dailyAvgResolution,
    };
  }, [filtered]);

  /* ====== Arrays ordenados para gráficas ====== */
  const dayKeysSorted = useMemo(() => Object.keys(perDay).sort(), [perDay]);
  const perDayCounts = useMemo(() => dayKeysSorted.map((k) => perDay[k]), [dayKeysSorted, perDay]);

  const estadosPresentes = useMemo(() => {
    const set = new Set();
    Object.values(stackedPerDay).forEach((obj) => Object.keys(obj).forEach((k) => set.add(k)));
    return Array.from(set);
  }, [stackedPerDay]);

  const stackedDatasets = useMemo(
    () =>
      estadosPresentes.map((est, idx) => ({
        label: est.replace("_", " "),
        data: dayKeysSorted.map((day) => stackedPerDay[day]?.[est] || 0),
        backgroundColor: colorByEstado[est] || PALETTE[idx % PALETTE.length],
        stack: "stacked",
      })),
    [estadosPresentes, dayKeysSorted, stackedPerDay]
  );

  const topUsers = useMemo(
    () => Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 10),
    [byUser]
  );
  const topUsersLabels = useMemo(() => topUsers.map(([u]) => u), [topUsers]);
  const topUsersCounts = useMemo(() => topUsers.map(([, c]) => c), [topUsers]);

  const prioLabels = useMemo(() => Object.keys(byPriority), [byPriority]);
  const prioCounts = useMemo(() => prioLabels.map((k) => byPriority[k]), [byPriority, prioLabels]);

  const typeLabels = useMemo(() => Object.keys(byType), [byType]);
  const typeCounts = useMemo(() => typeLabels.map((k) => byType[k]), [byType, typeLabels]);

  const weekdayLabels = weekdays;
  const weekdayCounts = weekdays.map((_, i) => byWeekday[i] || 0);

  const frDailyLabels = useMemo(
    () => Object.keys(dailyAvgFirstResponse).sort(),
    [dailyAvgFirstResponse]
  );
  const frDailyHours = useMemo(
    () => frDailyLabels.map((k) => (dailyAvgFirstResponse[k] || 0) / 36e5),
    [frDailyLabels, dailyAvgFirstResponse]
  );
  const rsDailyLabels = useMemo(
    () => Object.keys(dailyAvgResolution).sort(),
    [dailyAvgResolution]
  );
  const rsDailyHours = useMemo(
    () => rsDailyLabels.map((k) => (dailyAvgResolution[k] || 0) / 36e5),
    [rsDailyLabels, dailyAvgResolution]
  );

  /* ====== CSV export: tickets ====== */
  const exportCSV = () => {
    const headers = [
      "numero_ticket","asunto","estado","prioridad","usuario",
      "created_at","first_response_at","resolved_at",
      "t_first_response_h","t_resolution_h","tipo",
    ];
    const rows = filtered.map((t) => {
      const created = guessCreatedAt(t);
      const fr = guessFirstResponseAt(t);
      const rs = guessResolvedAt(t);
      const diffFR = fr && created ? (new Date(fr) - new Date(created)) / 36e5 : "";
      const diffRS = rs && created ? (new Date(rs) - new Date(created)) / 36e5 : "";
      return [
        t.numero_ticket ?? "",
        (t.asunto ?? "").toString().replace(/\s+/g, " ").trim(),
        guessState(t),
        guessPriority(t),
        guessAuthor(t),
        created ? new Date(created).toISOString() : "",
        fr ? new Date(fr).toISOString() : "",
        rs ? new Date(rs).toISOString() : "",
        diffFR === "" ? "" : diffFR.toFixed(2),
        diffRS === "" ? "" : diffRS.toFixed(2),
        guessType(t),
      ];
    });
    const csv = headers.join(",") + "\n" + rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
    downloadBlob(csv, `tickets_${rangeStart}_a_${rangeEnd}.csv`, "text/csv;charset=utf-8;");
  };

  /* ====== CSV export: agregados por día ====== */
  const exportAggregatesCSV = () => {
    const baseHeaders = ["date","tickets_total","avg_first_response_h","avg_resolution_h"];
    const estadoHeaders = estadosPresentes.map((e) => `estado_${e}`);
    const headers = [...baseHeaders, ...estadoHeaders];

    const rows = dayKeysSorted.map((day) => {
      const ticketsTotal = perDay[day] || 0;
      const avgFRh = dailyAvgFirstResponse[day] ? (dailyAvgFirstResponse[day] / 36e5).toFixed(2) : "";
      const avgRSh = dailyAvgResolution[day] ? (dailyAvgResolution[day] / 36e5).toFixed(2) : "";
      const estadoCounts = estadosPresentes.map((e) => stackedPerDay[day]?.[e] ?? 0);
      return [day, ticketsTotal, avgFRh, avgRSh, ...estadoCounts];
    });

    const csv = headers.join(",") + "\n" + rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
    downloadBlob(csv, `tickets_aggregates_${rangeStart}_a_${rangeEnd}.csv`, "text/csv;charset=utf-8;");
  };

  const escapeCsv = (val) => {
    const s = (val ?? "").toString();
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };

  const downloadBlob = (text, filename, type) => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ====== Navegación al hacer click ====== */
  const navigateToDate = (isoDay) => {
    const url = `/tickets?date=${isoDay}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  /* ====== Exportar PDF (multipágina, alta resolución) ====== */
  const exportPDF = async () => {
    if (!statsRef.current) return;
    // Forzamos scroll top para evitar “lazy” / placeholders
    window.scrollTo(0, 0);

    const node = statsRef.current;
    // Doble escala para mejor nitidez
    const scale = 2;

    const canvas = await html2canvas(node, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`stats_${rangeStart}_a_${rangeEnd}.pdf`);
  };

  /* ====== Imprimir (vista limpia) ====== */
  const printPage = () => {
    window.print();
  };

  /* ====== Loading ====== */
  if (loading) return <div className="stats-loading">Cargando estadísticas…</div>;

  /* ====== Render ====== */
  return (
    <div className="stats-page" ref={statsRef}>
      <div className="stats-topbar no-print">
        <h2>Estadísticas</h2>
        <div className="filters">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="select"
            title="Período"
          >
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="custom">Personalizado…</option>
          </select>

          {preset === "custom" && (
            <>
              <input
                type="date"
                className="input"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
              <input
                type="date"
                className="input"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </>
          )}
          <div className="range-hint">
            Rango activo: <strong>{rangeStart}</strong> → <strong>{rangeEnd}</strong>
          </div>

          <div className="actions">
            <button className="btn" onClick={exportCSV}>Exportar CSV</button>
            <button className="btn btn-secondary" onClick={exportAggregatesCSV}>Exportar métricas</button>
            {/* ⬇️ Nuevos */}
            <button className="btn btn-outline" onClick={exportPDF}>Exportar PDF</button>
            <button className="btn btn-outline" onClick={printPage}>Imprimir</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-row">
        <div className="kpi"><div className="kpi-title">Total</div><div className="kpi-value">{totals.total}</div></div>
        <div className="kpi"><div className="kpi-title">Abiertos</div><div className="kpi-value">{totals.abiertos}</div></div>
        <div className="kpi"><div className="kpi-title">Pendientes</div><div className="kpi-value">{totals.pendientes}</div></div>
        <div className="kpi"><div className="kpi-title">En proceso</div><div className="kpi-value">{totals.enProceso}</div></div>
        <div className="kpi"><div className="kpi-title">Resueltos</div><div className="kpi-value">{totals.resueltos}</div></div>
        <div className="kpi"><div className="kpi-title">FCR</div><div className="kpi-value">{`${clamp(firstContactResolution, 0, 100).toFixed(1)}%`}</div></div>
        <div className="kpi"><div className="kpi-title">1ª respuesta</div><div className="kpi-value">{formatHours(avgFirstResponse)}</div></div>
        <div className="kpi"><div className="kpi-title">Resolución</div><div className="kpi-value">{formatHours(avgResolution)}</div></div>
      </div>

      {/* Gráficos… (todo igual que tu versión previa) */}
      {/* Tickets por día */}
      <div className="charts-row">
        <div className="chart-card wide avoid-break">
          <div className="card-title">Tickets/día (creados)</div>
          <Line
            data={{
              labels: dayKeysSorted,
              datasets: [
                {
                  label: "Tickets/día",
                  data: perDayCounts,
                  borderColor: "#06b6d4",
                  backgroundColor: "rgba(6,182,212,0.12)",
                  tension: 0.3,
                  fill: true,
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    afterLabel(ctx) {
                      const total = perDayCounts[ctx.dataIndex] || 0;
                      const sum = perDayCounts.reduce((a, b) => a + b, 0);
                      const pct = sum ? ((total / sum) * 100).toFixed(1) : "0.0";
                      return ` (${pct}% del período)`;
                    },
                  },
                },
              },
              onClick: (_, elements) => {
                if (!elements?.length) return;
                const idx = elements[0].index;
                const day = dayKeysSorted[idx];
                if (day) navigateToDate(day);
              },
              scales: {
                x: { ticks: { maxRotation: 0 }, grid: { display: false } },
                y: { beginAtZero: true, grid: { color: "rgba(148,163,184,.2)" } },
              },
            }}
          />
        </div>

        <div className="chart-card avoid-break">
          <div className="card-title">Distribución por estado</div>
          <Doughnut
            data={{
              labels: Object.keys(byState),
              datasets: [
                {
                  data: Object.keys(byState).map((k) => byState[k]),
                  backgroundColor: Object.keys(byState).map(
                    (k, i) => colorByEstado[k] || PALETTE[i % PALETTE.length]
                  ),
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "right" },
                tooltip: {
                  callbacks: {
                    label(ctx) {
                      const total = Object.values(byState).reduce((a, b) => a + b, 0);
                      const val = ctx.parsed;
                      const pct = total ? ((val / total) * 100).toFixed(1) : "0.0";
                      return `${ctx.label}: ${val} (${pct}%)`;
                    },
                  },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Apilado por estado + prioridad */}
      <div className="charts-row">
        <div className="chart-card wide avoid-break">
          <div className="card-title">Mezcla por estado (apilado por día)</div>
          <Bar
            data={{ labels: dayKeysSorted, datasets: stackedDatasets }}
            options={{
              responsive: true,
              plugins: { legend: { position: "bottom" } },
              onClick: (_, elements) => {
                if (!elements?.length) return;
                const idx = elements[0].index;
                const day = dayKeysSorted[idx];
                if (day) navigateToDate(day);
              },
              scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, grid: { color: "rgba(148,163,184,.2)" } },
              },
            }}
          />
        </div>

        <div className="chart-card avoid-break">
          <div className="card-title">Tickets por prioridad</div>
          <Pie
            data={{
              labels: prioLabels,
              datasets: [{ data: prioCounts, backgroundColor: prioLabels.map((_, i) => PALETTE[i % PALETTE.length]) }],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "right" },
                tooltip: {
                  callbacks: {
                    label(ctx) {
                      const total = prioCounts.reduce((a, b) => a + b, 0);
                      const val = ctx.parsed;
                      const pct = total ? ((val / total) * 100).toFixed(1) : "0.0";
                      return `${ctx.label}: ${val} (${pct}%)`;
                    },
                  },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Top solicitantes + tipos */}
      <div className="charts-row">
        <div className="chart-card avoid-break">
          <div className="card-title">Top 10 solicitantes</div>
          <Bar
            data={{
              labels: topUsersLabels,
              datasets: [{ label: "Tickets", data: topUsersCounts, backgroundColor: "#4f46e5" }],
            }}
            options={{
              responsive: true,
              indexAxis: "y",
              plugins: { legend: { display: false } },
              onClick: (_, elements) => {
                if (!elements?.length) return;
                const idx = elements[0].index;
                const user = topUsersLabels[idx];
                if (user) window.open(`/tickets?user=${encodeURIComponent(user)}`, "_blank", "noopener,noreferrer");
              },
              scales: {
                x: { beginAtZero: true, grid: { color: "rgba(148,163,184,.2)" } },
                y: { grid: { display: false } },
              },
            }}
          />
        </div>

        <div className="chart-card avoid-break">
          <div className="card-title">Distribución por tipo</div>
          <Pie
            data={{
              labels: typeLabels,
              datasets: [{ data: typeCounts, backgroundColor: typeLabels.map((_, i) => PALETTE[i % PALETTE.length]) }],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "right" },
                tooltip: {
                  callbacks: {
                    label(ctx) {
                      const total = typeCounts.reduce((a, b) => a + b, 0);
                      const val = ctx.parsed;
                      const pct = total ? ((val / total) * 100).toFixed(1) : "0.0";
                      return `${ctx.label}: ${val} (${pct}%)`;
                    },
                  },
                },
              },
            }}
          />
        </div>
      </div>

      {/* Tiempos diarios con SLA */}
      <div className="charts-row">
        <div className="chart-card wide avoid-break">
          <div className="card-title">Tiempo promedio de 1ª respuesta (h) por día</div>
          <Line
            data={{
              labels: frDailyLabels,
              datasets: [
                {
                  label: "Promedio diario (h)",
                  data: frDailyHours,
                  borderColor: "#0ea5e9",
                  backgroundColor: "rgba(14,165,233,0.12)",
                  tension: 0.3,
                  fill: true,
                },
                {
                  label: `SLA ${SLA_FIRST_RESPONSE_H} h`,
                  data: frDailyLabels.map(() => SLA_FIRST_RESPONSE_H),
                  borderColor: "#ef4444",
                  borderDash: [6, 6],
                  pointRadius: 0,
                  tension: 0,
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "bottom" },
                tooltip: {
                  callbacks: {
                    afterBody(ctx) {
                      const v = ctx[0]?.parsed?.y;
                      if (typeof v === "number") {
                        const ok = v <= SLA_FIRST_RESPONSE_H;
                        return ok ? "✅ Dentro de SLA" : "⛔ Fuera de SLA";
                      }
                      return "";
                    },
                  },
                },
              },
              onClick: (_, elements) => {
                if (!elements?.length) return;
                const idx = elements[0].index;
                const day = frDailyLabels[idx];
                if (day) navigateToDate(day);
              },
              scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: "rgba(148,163,184,.2)" } },
              },
            }}
          />
        </div>

        <div className="chart-card avoid-break">
          <div className="card-title">Tiempo promedio de resolución (h) por día</div>
          <Line
            data={{
              labels: rsDailyLabels,
              datasets: [
                {
                  label: "Promedio diario (h)",
                  data: rsDailyHours,
                  borderColor: "#10b981",
                  backgroundColor: "rgba(16,185,129,0.12)",
                  tension: 0.3,
                  fill: true,
                },
                {
                  label: `SLA ${SLA_RESOLUTION_H} h`,
                  data: rsDailyLabels.map(() => SLA_RESOLUTION_H),
                  borderColor: "#ef4444",
                  borderDash: [6, 6],
                  pointRadius: 0,
                  tension: 0,
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "bottom" },
                tooltip: {
                  callbacks: {
                    afterBody(ctx) {
                      const v = ctx[0]?.parsed?.y;
                      if (typeof v === "number") {
                        const ok = v <= SLA_RESOLUTION_H;
                        return ok ? "✅ Dentro de SLA" : "⛔ Fuera de SLA";
                      }
                      return "";
                    },
                  },
                },
              },
              onClick: (_, elements) => {
                if (!elements?.length) return;
                const idx = elements[0].index;
                const day = rsDailyLabels[idx];
                if (day) navigateToDate(day);
              },
              scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: "rgba(148,163,184,.2)" } },
              },
            }}
          />
        </div>
      </div>

      {/* Día de la semana + Métricas */}
      <div className="charts-row">
        <div className="chart-card avoid-break">
          <div className="card-title">Tickets por día de la semana</div>
          <Bar
            data={{
              labels: weekdayLabels,
              datasets: [{ label: "Tickets", data: weekdayCounts, backgroundColor: "#10b981" }],
            }}
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
              scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, grid: { color: "rgba(148,163,184,.2)" } },
              },
            }}
          />
        </div>

        <div className="chart-card avoid-break">
          <div className="card-title">Métricas de rendimiento</div>
          <ul className="metrics-list">
            <li><span>Tiempo prom. 1ª respuesta</span><strong>{formatHours(avgFirstResponse)}</strong></li>
            <li><span>Tiempo prom. resolución</span><strong>{formatHours(avgResolution)}</strong></li>
            <li><span>FCR (1er contacto)</span><strong>{`${clamp(firstContactResolution,0,100).toFixed(1)}%`}</strong></li>
          </ul>
          <p className="metric-hint">
            Las métricas dependen de que tus tickets tengan <code>createdAt</code>, <code>firstResponseAt</code> y <code>resolvedAt</code>
            (o equivalentes como <code>fecha_creacion</code>/<code>primera_respuesta</code>/<code>fecha_cierre</code>).
          </p>
        </div>
      </div>
    </div>
  );
}
