import React, { useState } from 'react';
import { dbService } from '../services/dbService';
import Button from './Button';
import Card from './Card';

const Admin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [otpValidated, setOtpValidated] = useState(false);
    const [isValidatingOtp, setIsValidatingOtp] = useState(false);
    const [domain, setDomain] = useState('');
    const [company, setCompany] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const inputClasses = "w-full px-4 py-3 rounded bg-[#1B3139] text-white border border-slate-700 focus:border-[#FF3621] focus:ring-1 focus:ring-[#FF3621] outline-none transition-all placeholder-slate-400";

    const validateDatabricksEmail = (email: string): { isValid: boolean; message: string | null } => {
        const emailLower = email.toLowerCase().trim();
        if (!emailLower) {
            return { isValid: false, message: 'O e-mail é obrigatório.' };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailLower)) {
            return { isValid: false, message: 'Formato de e-mail inválido.' };
        }

        const domain = emailLower.split('@')[1];
        if (domain !== 'databricks.com') {
            return { isValid: false, message: 'Apenas e-mails @databricks.com são permitidos para adicionar domínios.' };
        }

        return { isValid: true, message: null };
    };

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);

        const emailValidation = validateDatabricksEmail(email);
        if (!emailValidation.isValid) {
            setErrorMsg(emailValidation.message);
            return;
        }

        setIsSubmitting(true);
        try {
            await dbService.generateOTP(email.trim());
            setOtpSent(true);
        } catch (err: any) {
            setErrorMsg('Ocorreu um erro ao gerar o código de verificação. Tente novamente.');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleValidateOTP = async () => {
        if (!otp.trim()) {
            setErrorMsg('Por favor, insira o código OTP.');
            return;
        }

        setIsValidatingOtp(true);
        setErrorMsg(null);
        try {
            const result = await dbService.validateOTP(email.trim(), otp);
            if (result.valid) {
                setOtpValidated(true);
                setErrorMsg(null);
            } else {
                setErrorMsg(result.message || 'Código OTP inválido. Tente novamente.');
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Ocorreu um erro ao validar o código. Tente novamente.');
            console.error(err);
        } finally {
            setIsValidatingOtp(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);

        if (!otpValidated) {
            setErrorMsg('Por favor, valide o código OTP antes de adicionar um domínio.');
            return;
        }

        if (!domain.trim()) {
            setErrorMsg('Por favor, insira um domínio.');
            return;
        }

        if (!company.trim()) {
            setErrorMsg('Por favor, insira o nome da empresa.');
            return;
        }

        // Validate domain format (basic validation)
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
        if (!domainRegex.test(domain.trim())) {
            setErrorMsg('Formato de domínio inválido. Use o formato: exemplo.com');
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await dbService.addDomain(domain.trim(), email.trim(), company.trim());
            if (result.success) {
                setSuccessMsg(`Domínio "${domain.trim()}" adicionado à whitelist com sucesso!`);
                setDomain('');
                setCompany('');
            } else {
                setErrorMsg(result.message || 'Erro ao adicionar domínio. Tente novamente.');
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Ocorreu um erro ao adicionar o domínio. Tente novamente.');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <nav className="bg-[#1B3139] text-white px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-xl border-b border-slate-800">
                <div className="flex items-center gap-2 md:gap-4">
                    <div className="w-32 h-8 md:w-64 md:h-16 flex items-center justify-center">
                        <img
                            src={`${import.meta.env.BASE_URL}databricks-logo.svg`}
                            alt="Databricks Logo"
                            className="w-full h-full object-contain"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2 md:gap-6">
                    <a
                        href="/"
                        className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors"
                    >
                        Voltar
                    </a>
                </div>
            </nav>

            <main className="container mx-auto">
                <div className="max-w-2xl mx-auto py-12 px-4">
                    <Card className="p-8 md:p-10 shadow-2xl border-t-4 border-t-[#1B3139] bg-white">
                        <div className="space-y-4 mb-6">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                                Administração
                            </span>
                            <h1 className="text-3xl md:text-4xl font-extrabold text-[#1B3139] leading-tight uppercase tracking-tight">
                                Adicionar Domínio à Whitelist
                            </h1>
                            <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                                Adicione novos domínios de e-mail corporativos à whitelist para permitir o acesso ao simulado.
                            </p>
                        </div>

                        {errorMsg && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold uppercase tracking-tight rounded mb-4">
                                {errorMsg}
                            </div>
                        )}

                        {successMsg && (
                            <div className="p-3 bg-green-50 border border-green-200 text-green-600 text-xs font-bold uppercase tracking-tight rounded mb-4">
                                {successMsg}
                            </div>
                        )}

                        {!otpValidated ? (
                            <form onSubmit={handleSendOTP} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400">E-mail Databricks</label>
                                    <input
                                        required
                                        type="email"
                                        className={inputClasses}
                                        placeholder="seu.email@databricks.com"
                                        value={email}
                                        onChange={(e) => {
                                            setEmail(e.target.value);
                                            // Reset OTP state if email changes
                                            if (otpSent) {
                                                setOtpSent(false);
                                                setOtpValidated(false);
                                                setOtp('');
                                            }
                                        }}
                                        disabled={otpSent || isSubmitting}
                                    />
                                    <p className="text-[9px] text-slate-500 mt-1">
                                        Apenas e-mails @databricks.com são permitidos para adicionar domínios.
                                    </p>
                                </div>

                                {!otpSent ? (
                                    <Button type="submit" className="w-full py-4 mt-4" isLoading={isSubmitting}>
                                        Enviar Código de Verificação
                                    </Button>
                                ) : (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400">Código de Verificação (OTP)</label>
                                            <input
                                                required
                                                type="text"
                                                className={inputClasses}
                                                placeholder="Digite o código enviado para seu e-mail"
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value)}
                                                maxLength={6}
                                            />
                                            <p className="text-[9px] text-slate-500 mt-1">
                                                Um código de verificação foi enviado para <span className="font-bold">{email}</span>
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            onClick={handleValidateOTP}
                                            className="w-full py-4 mt-4"
                                            isLoading={isValidatingOtp}
                                            disabled={!otp.trim()}
                                        >
                                            {otpValidated ? 'Validado ✓' : 'Validar Código'}
                                        </Button>
                                    </>
                                )}
                            </form>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="p-3 bg-green-50 border border-green-200 text-green-600 text-xs font-bold uppercase tracking-tight rounded mb-4">
                                    Autenticação validada: {email}
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Domínio</label>
                                    <input
                                        required
                                        type="text"
                                        className={inputClasses}
                                        placeholder="exemplo.com"
                                        value={domain}
                                        onChange={(e) => setDomain(e.target.value.toLowerCase())}
                                        disabled={isSubmitting}
                                    />
                                    <p className="text-[9px] text-slate-500 mt-1">
                                        Digite apenas o domínio (sem @). Exemplo: databricks.com
                                    </p>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Nome da Empresa</label>
                                    <input
                                        required
                                        type="text"
                                        className={inputClasses}
                                        placeholder="Ex: Databricks, Microsoft, etc"
                                        value={company}
                                        onChange={(e) => setCompany(e.target.value)}
                                        disabled={isSubmitting}
                                    />
                                    <p className="text-[9px] text-slate-500 mt-1">
                                        Digite o nome da empresa associada ao domínio.
                                    </p>
                                </div>

                                <Button type="submit" className="w-full py-4 mt-4" isLoading={isSubmitting}>
                                    Adicionar Domínio
                                </Button>
                            </form>
                        )}
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default Admin;
