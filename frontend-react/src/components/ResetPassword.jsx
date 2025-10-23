// src/components/ResetPassword.jsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { resetPassword } from '../api'; // asegúrate de exportar esta función en src/api.js

export default function ResetPassword() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null); // { type: 'ok' | 'error', message: string }

    const validate = () => {
        if (!password || !confirm) return 'Ambos campos son obligatorios';
        if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
        if (password !== confirm) return 'Las contraseñas no coinciden';
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus(null);
        const err = validate();
        if (err) return setStatus({ type: 'error', message: err });

        setLoading(true);
        try {
            const res = await resetPassword(token, password);
            setStatus({ type: 'ok', message: res.message || 'Contraseña actualizada correctamente' });
            setTimeout(() => navigate('/login'), 2000);
        } catch (error) {
            setStatus({ type: 'error', message: error?.message || 'Error al actualizar la contraseña' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 480, margin: '2rem auto', padding: 16 }}>
            <h2>Restablecer contraseña</h2>

            <form onSubmit={handleSubmit}>
                <label style={{ display: 'block', marginBottom: 12 }}>
                    Nueva contraseña
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        style={{ width: '100%', padding: 8, marginTop: 6 }}
                        aria-label="Nueva contraseña"
                    />
                </label>

                <label style={{ display: 'block', marginBottom: 12 }}>
                    Confirmar contraseña
                    <input
                        type="password"
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        required
                        minLength={8}
                        style={{ width: '100%', padding: 8, marginTop: 6 }}
                        aria-label="Confirmar contraseña"
                    />
                </label>

                <button
                    type="submit"
                    disabled={loading}
                    style={{ padding: '8px 16px' }}
                >
                    {loading ? 'Actualizando...' : 'Restablecer contraseña'}
                </button>
            </form>

            {status && (
                <div style={{ marginTop: 16, color: status.type === 'ok' ? 'green' : 'red' }}>
                    {status.message}
                </div>
            )}

            <p style={{ marginTop: 12, fontSize: 12, color: '#666' }}>
                Si el enlace está expirado o es inválido, solicitá uno nuevo desde la pantalla de recuperación.
            </p>
        </div>
    );
}