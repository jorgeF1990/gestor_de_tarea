import React, { useEffect, useMemo, useState } from "react";
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
    ArcElement
} from "chart.js";
import { Bar, Doughnut, Pie, Line } from "react-chartjs-2";
import "./StatsPage.css";

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

const guessAuthor = (t) => t.creador || t.usuario || t.cliente || t.createdBy || t.autor || "desconocido";
const guessType = (t) => t.tipo || t.categoria || t.category || "sin_tipo";
const guessState = (t) => (t.estado || "").toString().toLowerCase();
const guessCreatedAt = (t) => t.historial?.[0]?.fecha || t.createdAt || t.created_at || null;

export default function StatsPage({ tickets: propTickets }) {
    const [tickets, setTickets] = useState(propTickets || []);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (propTickets) return;
        let mounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem("token");
                const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/tickets`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                if (mounted) setTickets(res.data || []);
            } catch (err) {
                console.error("Error cargando tickets:", err);
                if (mounted) setTickets([]);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [propTickets]);

    const {
        byState, byType, byUser, timeseries,
        byPriority, daily, weekly, monthly,
        avgFirstResponse, avgResolution, firstContactResolution
    } = useMemo(() => {
        const byState = {};
        const byType = {};
        const byUser = {};
        const byPriority = {};
        const times = {};
        const daily = {};
        const weekly = {};
        const monthly = {};

        let totalFirstResponse = 0, countFirstResponse = 0;
        let totalResolution = 0, countResolution = 0;
        let resolvedAtFirstContact = 0, totalResolved = 0;

        tickets.forEach(t => {
            const st = guessState(t) || "sin_estado";
            const ty = guessType(t) || "sin_tipo";
            const user = guessAuthor(t) || "desconocido";
            const pr = t.prioridad || t.priority || "sin_prioridad";

            byState[st] = (byState[st] || 0) + 1;
            byType[ty] = (byType[ty] || 0) + 1;
            byUser[user] = (byUser[user] || 0) + 1;
            byPriority[pr] = (byPriority[pr] || 0) + 1;

            const created = guessCreatedAt(t);
            if (created) {
                const d = new Date(created);
                if (!Number.isNaN(d.getTime())) {
                    const key = d.toISOString().slice(0, 10);
                    times[key] = (times[key] || 0) + 1;

                    daily[key] = (daily[key] || 0) + 1;

                    const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate() + ((d.getDay() + 6) % 7)) / 7)}`;
                    weekly[weekKey] = (weekly[weekKey] || 0) + 1;

                    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                    monthly[monthKey] = (monthly[monthKey] || 0) + 1;
                }
            }

            if (t.firstResponseAt && t.createdAt) {
                const diff = new Date(t.firstResponseAt) - new Date(t.createdAt);
                if (diff > 0) {
                    totalFirstResponse += diff;
                    countFirstResponse++;
                }
            }
            if (t.resolvedAt && t.createdAt) {
                const diff = new Date(t.resolvedAt) - new Date(t.createdAt);
                if (diff > 0) {
                    totalResolution += diff;
                    countResolution++;
                    totalResolved++;
                    if (t.interactionsCount <= 1) {
                        resolvedAtFirstContact++;
                    }
                }
            }
        });

        const timeseries = Object.keys(times).sort().map(k => ({ date: k, count: times[k] }));

        return {
            byState, byType, byUser, timeseries, byPriority, daily, weekly, monthly,
            avgFirstResponse: countFirstResponse ? totalFirstResponse / countFirstResponse : 0,
            avgResolution: countResolution ? totalResolution / countResolution : 0,
            firstContactResolution: totalResolved ? (resolvedAtFirstContact / totalResolved) * 100 : 0
        };
    }, [tickets]);

    const stateLabels = Object.keys(byState);
    const stateData = stateLabels.map(l => byState[l]);

    const typeLabels = Object.keys(byType);
    const typeData = typeLabels.map(l => byType[l]);

    const sortedUsers = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const userLabelsSorted = sortedUsers.map(([u]) => u);
    const userDataSorted = sortedUsers.map(([, c]) => c);

    const timeseriesLabels = timeseries.map(t => t.date);
    const timeseriesCounts = timeseries.map(t => t.count);

    if (loading) return <div className="stats-loading">Cargando estadísticas…</div>;

    return (
        <div className="stats-page">
            <h2>Estadísticas</h2>

            <div className="charts-row">
                <div className="chart-card">
                    <h3>Situación por estado</h3>
                    <Doughnut
                        data={{
                            labels: stateLabels,
                            datasets: [{ data: stateData, backgroundColor: generateColors(stateLabels.length) }]
                        }}
                        options={{ responsive: true, plugins: { legend: { position: 'right' } } }}
                    />
                </div>

                <div className="chart-card">
                    <h3>Tipos de ticket</h3>
                    <Pie
                        data={{
                            labels: typeLabels,
                            datasets: [{ data: typeData, backgroundColor: generateColors(typeLabels.length) }]
                        }}
                        options={{ responsive: true, plugins: { legend: { position: 'right' } } }}
                    />
                </div>
            </div>

            <div className="charts-row">
                <div className="chart-card wide">
                    <h3>Tickets creados por usuario (Top {userLabelsSorted.length})</h3>
                    <Bar
                        data={{
                            labels: userLabelsSorted,
                            datasets: [{ label: 'Tickets', data: userDataSorted, backgroundColor: '#4f46e5' }]
                        }}
                        options={{ responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { maxRotation: 45, minRotation: 0 } } } }}
                    />
                </div>

                <div className="chart-card">
                    <h3>Evolución (creados por día)</h3>
                    <Line
                        data={{
                            labels: timeseriesLabels,
                            datasets: [{ label: 'Tickets/día', data: timeseriesCounts, borderColor: '#06b6d4', backgroundColor: 'rgba(6,182,212,0.12)', fill: true }]
                        }}
                        options={{ responsive: true, plugins: { legend: { display: false } } }}
                    />
                </div>
            </div>

            <div className="charts-row">
                <div className="chart-card">
                    <h3>Tickets por prioridad</h3>
                    <Pie
                        data={{
                            labels: Object.keys(byPriority),
                            datasets: [{ data: Object.values(byPriority), backgroundColor: generateColors(Object.keys(byPriority).length) }]
                        }}
                    />
                </div>

                <div className="chart-card">
                    <h3>Tickets por mes</h3>
                    <Line
                        data={{
                            labels: Object.keys(monthly).sort(),
                            datasets: [{ label: "Tickets/mes", data: Object.keys(monthly).sort().map(k => monthly[k]), borderColor: "#f59e0b", fill: false }]
                        }}
                    />
                </div>
            </div>

            <div className="charts-row">
                <div className="chart-card">
                    <h3>Métricas de rendimiento</h3>
                    <ul>
                        <li>Tiempo promedio primera respuesta: {(avgFirstResponse / 3600000).toFixed(2)} horas</li>
                        <li>Tiempo promedio resolución: {(avgResolution / 3600000).toFixed(2)} horas</li>
                        <li>% Resolución en primer contacto: {firstContactResolution.toFixed(2)}%</li>
                    </ul>
                </div>
            </div>
        </div>
    );
    function generateColors(n) {
        const palette = [
            "#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444",
            "#8b5cf6", "#ec4899", "#f97316", "#64748b", "#14b8a6"
        ];
        return Array.from({ length: n }, (_, i) => palette[i % palette.length]);
    }
}