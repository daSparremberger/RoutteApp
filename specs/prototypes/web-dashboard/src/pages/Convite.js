import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export function ConvitePage() {
    const { token } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [convite, setConvite] = useState(null);
    useEffect(() => {
        async function validateConvite() {
            try {
                const res = await fetch(`${API_URL}/auth/convite/${token}`);
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Convite invalido');
                }
                const data = await res.json();
                setConvite(data);
            }
            catch (err) {
                setError(err.message);
            }
            finally {
                setLoading(false);
            }
        }
        if (token) {
            validateConvite();
        }
    }, [token]);
    if (loading) {
        return (_jsx("div", { className: "app-container items-center justify-center", children: _jsx("p", { className: "text-text-muted", children: "Validando convite..." }) }));
    }
    if (error) {
        return (_jsx("div", { className: "app-container items-center justify-center px-4", children: _jsxs("div", { className: "w-full max-w-md rounded-[28px] border border-border bg-surface p-8 text-center shadow-[0_28px_52px_rgba(16,18,20,0.14)]", children: [_jsx("h1", { className: "mb-4 text-xl font-bold text-danger", children: "Convite Invalido" }), _jsx("p", { className: "text-text-muted", children: error })] }) }));
    }
    return (_jsx("div", { className: "app-container items-center justify-center px-4", children: _jsxs("div", { className: "w-full max-w-md rounded-[28px] border border-border bg-surface p-8 shadow-[0_28px_52px_rgba(16,18,20,0.14)]", children: [_jsx("h1", { className: "font-heading mb-2 text-2xl font-bold text-text", children: "Convite Recebido" }), _jsxs("p", { className: "mb-6 text-text-muted", children: ["Voce foi convidado para ser", ' ', _jsx("span", { className: "font-medium text-success", children: convite?.tipo === 'gestor' ? 'Gestor' : 'Motorista' }), ' ', "em ", _jsx("span", { className: "font-medium text-text", children: convite?.tenant.nome }), convite?.tenant.cidade && ` - ${convite.tenant.cidade}`] }), convite?.email_restrito && (_jsxs("p", { className: "mb-4 text-sm text-text-muted", children: ["Este convite e restrito ao email: ", convite.email_restrito] })), _jsx("button", { onClick: () => navigate(`/login?convite=${token}`), className: "ui-btn-primary w-full py-3", children: "Aceitar Convite" })] }) }));
}
