import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dbService } from '../services/dbService';
import type { Question } from '../types';
import Button from './Button';
import Card from './Card';
import QuestionView from './QuestionView';

/** IDs enviados à base: letras minúsculas (a–z); na UI exibimos maiúsculas. */
function optionIdForIndex(index: number): string {
    if (index >= 0 && index < 26) {
        return String.fromCharCode(97 + index);
    }
    return `x${index}`;
}

function withSequentialOptionIds(
    rows: { id: string; text: string; imageUrl?: string }[]
): { id: string; text: string; imageUrl?: string }[] {
    return rows.map((opt, i) => ({ ...opt, id: optionIdForIndex(i) }));
}

/** Corresponde o texto da prova ao valor exato na base (lista de exames), para a API de categorias. */
function resolveExamAgainstList(examTrimmed: string, exams: string[]): string {
    const exact = exams.find((x) => x === examTrimmed);
    if (exact !== undefined) return exact;
    const ci = exams.find((x) => x.trim().toLowerCase() === examTrimmed.toLowerCase());
    if (ci !== undefined) return ci;
    return examTrimmed;
}

const Admin: React.FC = () => {
    const isDevMode = import.meta.env.VITE_EXECUTION_MODE === 'DEV';

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

    // Question creation state
    const [questionCategory, setQuestionCategory] = useState('');
    const [questionExam, setQuestionExam] = useState('');
    const [questionEnunciado, setQuestionEnunciado] = useState('');
    const [questionEnunciadoImageUrl, setQuestionEnunciadoImageUrl] = useState('');
    const [questionOptions, setQuestionOptions] = useState<
        { id: string; text: string; imageUrl?: string }[]
    >(() => withSequentialOptionIds([{ id: '', text: '' }, { id: '', text: '' }, { id: '', text: '' }, { id: '', text: '' }]));
    const [questionCorrectOptionId, setQuestionCorrectOptionId] = useState('');
    const [questionExplanation, setQuestionExplanation] = useState('');
    const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
    const [questionPreviewOpen, setQuestionPreviewOpen] = useState(false);
    const [previewSelectedOptionId, setPreviewSelectedOptionId] = useState<string | undefined>();
    const [adminExamOptions, setAdminExamOptions] = useState<string[]>([]);
    const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
    const [loadingAdminExams, setLoadingAdminExams] = useState(false);
    const [loadingCategories, setLoadingCategories] = useState(false);
    const prevExamForCategory = useRef<string>('');

    // Results cleanup state
    const [resultsEmail, setResultsEmail] = useState('');
    const [resultsExam, setResultsExam] = useState('');
    const [isDeletingResults, setIsDeletingResults] = useState(false);

    // Admin tabs state
    const [activeTab, setActiveTab] = useState<'whitelist' | 'questions' | 'results'>('whitelist');

    const inputClasses =
        'w-full min-w-0 max-w-full px-4 py-3 rounded bg-[#1B3139] text-white border border-slate-700 focus:border-[#FF3621] focus:ring-1 focus:ring-[#FF3621] outline-none transition-all placeholder-slate-400 placeholder:text-xs sm:placeholder:text-sm';
    /** Narrow grid cells: short placeholders + ellipsis to avoid horizontal overflow */
    const optionCellInputClasses =
        'min-w-0 max-w-full rounded bg-[#1B3139] text-white border border-slate-700 text-xs placeholder:text-[10px] px-2 py-2 overflow-hidden text-ellipsis whitespace-nowrap';

    useEffect(() => {
        if (!otpValidated || (activeTab !== 'questions' && activeTab !== 'results')) {
            return;
        }
        let cancelled = false;
        setLoadingAdminExams(true);
        dbService
            .getExams()
            .then((exams) => {
                if (!cancelled) setAdminExamOptions(exams);
            })
            .catch(() => {
                if (!cancelled) setAdminExamOptions([]);
            })
            .finally(() => {
                if (!cancelled) setLoadingAdminExams(false);
            });
        return () => {
            cancelled = true;
        };
    }, [otpValidated, activeTab]);

    useEffect(() => {
        const exam = questionExam.trim();
        if (!exam) {
            setCategoryOptions([]);
            setQuestionCategory('');
            prevExamForCategory.current = '';
            return;
        }

        /** Prova que existe na lista (mesmo texto ou só diferença de maiúsculas) → busca na hora */
        const isKnownExam =
            adminExamOptions.some((x) => x === exam) ||
            adminExamOptions.some((x) => x.trim().toLowerCase() === exam.toLowerCase());
        const delayMs = isKnownExam ? 0 : 300;

        let cancelled = false;
        const timer = window.setTimeout(() => {
            const eTrim = questionExam.trim();
            if (!eTrim || cancelled) return;
            const eApi = resolveExamAgainstList(eTrim, adminExamOptions);
            if (prevExamForCategory.current && prevExamForCategory.current !== eApi) {
                setQuestionCategory('');
            }
            prevExamForCategory.current = eApi;

            setLoadingCategories(true);
            dbService
                .getQuestionCategoriesForExam(eApi)
                .then((cats) => {
                    if (!cancelled) setCategoryOptions(cats);
                })
                .catch(() => {
                    if (!cancelled) setCategoryOptions([]);
                })
                .finally(() => {
                    if (!cancelled) setLoadingCategories(false);
                });
        }, delayMs);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [questionExam, adminExamOptions]);

    useEffect(() => {
        const ids = new Set(questionOptions.map((o) => o.id));
        setQuestionCorrectOptionId((current) =>
            current && !ids.has(current) ? '' : current
        );
    }, [questionOptions]);

    /** Mesmos critérios de `handleCreateQuestion` para opções exibidas na pré-visualização. */
    const previewQuestion: Question | null = useMemo(() => {
        if (!questionExam.trim()) return null;

        const cleanedOptions = questionOptions
            .map((opt) => ({
                id: opt.id.trim().toLowerCase(),
                text: opt.text.trim(),
                imageUrl: opt.imageUrl?.trim(),
            }))
            .filter((opt) => opt.id && (opt.text || opt.imageUrl));

        const enunciado = questionEnunciado.trim();
        const placeholderEnunciado =
            '<p class="text-slate-400 italic">Preencha o enunciado acima para ver o texto da questão aqui.</p>';

        const optionsForView =
            cleanedOptions.length > 0
                ? cleanedOptions
                : [
                      { id: 'a', text: 'Preencha as alternativas acima para visualizá-las como no simulado.' },
                      { id: 'b', text: 'São necessárias pelo menos quatro alternativas com texto ou imagem para cadastrar.' },
                      { id: 'c', text: '…' },
                      { id: 'd', text: '…' },
                  ];

        const correctId = questionCorrectOptionId.trim().toLowerCase();
        const fallbackCorrect = optionsForView[0]?.id ?? 'a';

        const explanationTrim = questionExplanation.trim();
        const placeholderExplanation =
            '<p class="text-slate-400 italic">Preencha a explicação acima para ver como ela aparecerá na revisão do simulado.</p>';

        return {
            category: questionCategory.trim() || 'Categoria da pergunta',
            enunciado: enunciado || placeholderEnunciado,
            enunciadoImageUrl: questionEnunciadoImageUrl.trim() || undefined,
            options: optionsForView,
            correctOptionId: correctId && optionsForView.some((o) => o.id === correctId) ? correctId : fallbackCorrect,
            explanation: explanationTrim || placeholderExplanation,
            exam: questionExam.trim(),
        };
    }, [
        questionExam,
        questionCategory,
        questionEnunciado,
        questionEnunciadoImageUrl,
        questionExplanation,
        questionOptions,
        questionCorrectOptionId,
    ]);

    const validateDatabricksEmail = (email: string): { isValid: boolean; message: string | null } => {
        const emailLower = email.toLowerCase().trim();
        if (!emailLower) {
            return { isValid: false, message: 'O e-mail é obrigatório.' };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailLower)) {
            return { isValid: false, message: 'Formato de e-mail inválido.' };
        }

        // In DEV mode, allow any valid email
        if (isDevMode) {
            return { isValid: true, message: null };
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

        // In DEV mode, skip OTP and authenticate directly
        if (isDevMode) {
            setOtpValidated(true);
            setSuccessMsg('Modo DEV: Autenticação automática ativada.');
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

    const handleQuestionOptionChange = (
        index: number,
        field: 'text' | 'imageUrl',
        value: string
    ) => {
        setQuestionOptions((prev) => {
            const updated = [...prev];
            const option = { ...updated[index] };
            if (field === 'text') option.text = value;
            else option.imageUrl = value;
            updated[index] = option;
            return updated;
        });
    };

    const handleAddOptionRow = () => {
        setQuestionOptions((prev) =>
            withSequentialOptionIds([...prev, { id: '', text: '' }])
        );
    };

    const handleRemoveOptionRow = (index: number) => {
        setQuestionOptions((prev) =>
            withSequentialOptionIds(prev.filter((_, i) => i !== index))
        );
    };

    const handleCreateQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);

        if (!otpValidated) {
            setErrorMsg('Autenticação necessária para cadastrar novas perguntas.');
            return;
        }

        const cleanedOptions = questionOptions
            .map((opt) => ({
                id: opt.id.trim().toLowerCase(),
                text: opt.text.trim(),
                imageUrl: opt.imageUrl?.trim(),
            }))
            .filter((opt) => opt.id && (opt.text || opt.imageUrl));

        if (cleanedOptions.length < 4) {
            setErrorMsg('Cadastre pelo menos quatro alternativas válidas (texto ou imagem em cada uma).');
            return;
        }

        if (!questionExam.trim()) {
            setErrorMsg('Selecione ou informe primeiro a prova (simulado).');
            return;
        }

        if (!questionCategory.trim()) {
            setErrorMsg('Informe a categoria da pergunta (após definir a prova).');
            return;
        }

        if (!questionEnunciado.trim()) {
            setErrorMsg('Enunciado da pergunta é obrigatório.');
            return;
        }

        if (!questionExplanation.trim()) {
            setErrorMsg('Explicação da resposta é obrigatória.');
            return;
        }

        const correctId = questionCorrectOptionId.trim().toLowerCase();
        if (!correctId) {
            setErrorMsg('Selecione a letra da opção correta.');
            return;
        }

        const hasCorrect = cleanedOptions.some((opt) => opt.id === correctId);
        if (!hasCorrect) {
            setErrorMsg('A opção correta deve ser uma das alternativas listadas.');
            return;
        }

        const payload: any = {
            category: questionCategory.trim(),
            enunciado: questionEnunciado.trim(),
            options: cleanedOptions,
            correctOptionId: correctId,
            explanation: questionExplanation.trim(),
            exam: questionExam.trim(),
        };

        const imgUrl = questionEnunciadoImageUrl.trim();
        if (imgUrl) {
            payload.enunciadoImageUrl = imgUrl;
        }

        setIsSubmittingQuestion(true);
        try {
            await dbService.addQuestion(payload);
            setSuccessMsg('Pergunta adicionada à base de dados com sucesso.');
            setQuestionCategory('');
            setQuestionExam('');
            try {
                const exams = await dbService.getExams();
                setAdminExamOptions(exams);
            } catch {
                /* ignore refresh errors */
            }
            setQuestionEnunciado('');
            setQuestionEnunciadoImageUrl('');
            setQuestionExplanation('');
            setQuestionCorrectOptionId('');
            setQuestionOptions(
                withSequentialOptionIds([
                    { id: '', text: '' },
                    { id: '', text: '' },
                    { id: '', text: '' },
                    { id: '', text: '' },
                ])
            );
        } catch (err: any) {
            setErrorMsg(err.message || 'Erro ao adicionar pergunta. Tente novamente.');
            console.error(err);
        } finally {
            setIsSubmittingQuestion(false);
        }
    };

    const handleDeleteResults = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSuccessMsg(null);

        if (!otpValidated) {
            setErrorMsg('Autenticação necessária para remover resultados de usuários.');
            return;
        }

        if (!resultsEmail.trim()) {
            setErrorMsg('Informe o e-mail do usuário para remoção dos resultados.');
            return;
        }

        setIsDeletingResults(true);
        try {
            const user = await dbService.getUserByEmail(resultsEmail.trim());
            if (!user || !user._id) {
                setErrorMsg('Usuário não encontrado para o e-mail informado.');
                return;
            }

            const examFilter = resultsExam.trim() || undefined;
            const result = await dbService.deleteUserResults(user._id.toString(), examFilter);

            if (result.deletedCount > 0) {
                setSuccessMsg(
                    `Removidos ${result.deletedCount} registro(s) de resultados para ${resultsEmail.trim()}${examFilter ? ` no exame "${examFilter}"` : ''
                    }.`
                );
                setResultsEmail('');
                setResultsExam('');
            } else {
                setErrorMsg('Nenhum registro de resultado encontrado para os critérios informados.');
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Erro ao remover resultados. Tente novamente.');
            console.error(err);
        } finally {
            setIsDeletingResults(false);
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

                            <h1 className="text-3xl md:text-4xl font-extrabold text-[#1B3139] leading-tight uppercase tracking-tight">
                                Administração
                            </h1>
                            <ul className="text-sm md:text-base text-slate-600 leading-relaxed list-disc list-inside space-y-2">
                                <li>Adicione novos domínios de e-mail corporativos à whitelist para permitir o acesso ao simulado.</li>
                                <li>Cadastre novas perguntas para os simulados.</li>
                                <li>Limpe os resultados de um usuário permitindo que ele refaça a prova.</li>
                            </ul>
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
                                {isDevMode && (
                                    <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs font-bold uppercase tracking-tight rounded mb-4">
                                        ⚠️ Modo DEV: Autenticação OTP desabilitada. Apenas insira o e-mail para continuar.
                                    </div>
                                )}
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
                                        {isDevMode ? 'Modo DEV: Qualquer e-mail válido é aceito.' : 'Apenas e-mails @databricks.com são permitidos para adicionar domínios.'}
                                    </p>
                                </div>

                                {!otpSent ? (
                                    <Button type="submit" className="w-full py-4 mt-4" isLoading={isSubmitting}>
                                        {isDevMode ? 'Autenticar' : 'Enviar Código de Verificação'}
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
                            <div className="space-y-6">
                                {/* Auth badge */}
                                <div
                                    className={`p-3 border text-xs font-bold uppercase tracking-tight rounded ${isDevMode
                                        ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                        : 'bg-green-50 border-green-200 text-green-600'
                                        }`}
                                >
                                    {isDevMode ? '⚠️ Modo DEV: ' : ''}Autenticação validada: {email}
                                </div>

                                {/* Tabs */}
                                <div className="border-b border-slate-200 mb-2">
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('whitelist')}
                                            className={`px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-colors ${activeTab === 'whitelist'
                                                ? 'border-[#FF3621] text-[#FF3621]'
                                                : 'border-transparent text-slate-500 hover:text-slate-800'
                                                }`}
                                        >
                                            Whitelist
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('questions')}
                                            className={`px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-colors ${activeTab === 'questions'
                                                ? 'border-[#FF3621] text-[#FF3621]'
                                                : 'border-transparent text-slate-500 hover:text-slate-800'
                                                }`}
                                        >
                                            Perguntas
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab('results')}
                                            className={`px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-colors ${activeTab === 'results'
                                                ? 'border-[#FF3621] text-[#FF3621]'
                                                : 'border-transparent text-slate-500 hover:text-slate-800'
                                                }`}
                                        >
                                            Resultados
                                        </button>
                                    </div>
                                </div>

                                {/* Tab content */}
                                <div className="space-y-8">
                                    {activeTab === 'whitelist' && (
                                        <form onSubmit={handleSubmit} className="space-y-4">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.25em]">
                                                    Whitelisting de Domínios
                                                </span>
                                                <p className="text-[11px] text-slate-600">
                                                    Adicione novos domínios corporativos autorizados a acessar o simulado.
                                                </p>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase text-slate-400">
                                                    Domínio
                                                </label>
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
                                                <label className="text-[10px] font-black uppercase text-slate-400">
                                                    Nome da Empresa
                                                </label>
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

                                    {activeTab === 'questions' && (
                                        <form onSubmit={handleCreateQuestion} className="space-y-4">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.25em]">
                                                    Incluir Novas Perguntas
                                                </span>
                                                <p className="text-[11px] text-slate-600">
                                                    Cadastre perguntas na base de dados seguindo o schema padrão do simulado.
                                                </p>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase text-slate-400">
                                                    Prova (simulado)
                                                </label>
                                                <input
                                                    required
                                                    type="text"
                                                    className={inputClasses}
                                                    list="admin-question-exams"
                                                    autoComplete="off"
                                                    placeholder="Nome da prova"
                                                    value={questionExam}
                                                    onChange={(e) => setQuestionExam(e.target.value)}
                                                    disabled={isSubmittingQuestion}
                                                />
                                                <datalist id="admin-question-exams">
                                                    {adminExamOptions.map((ex) => (
                                                        <option key={ex} value={ex} />
                                                    ))}
                                                </datalist>
                                                <p className="text-[9px] text-slate-500 mt-1 break-words">
                                                    {loadingAdminExams
                                                        ? 'Carregando provas já cadastradas…'
                                                        : questionExam.trim()
                                                          ? 'Se escolher uma prova já cadastrada na lista, as categorias existentes são carregadas na hora. Você também pode digitar um nome novo.'
                                                          : (
                                                                <>
                                                                    Informe a prova para exibir categoria, enunciado,
                                                                    opções e demais campos.{' '}
                                                                    <span className="text-slate-600">
                                                                        Exemplos: Data Engineer Associate, Machine
                                                                        Learning Professional…
                                                                    </span>
                                                                </>
                                                            )}
                                                </p>
                                            </div>

                                            {questionExam.trim() ? (
                                                <>
                                                    <div className="space-y-1 pt-2 border-t border-slate-200">
                                                        <label className="text-[10px] font-black uppercase text-slate-400">
                                                            Categoria da pergunta
                                                        </label>
                                                        <input
                                                            required
                                                            type="text"
                                                            className={inputClasses}
                                                            list="admin-question-categories"
                                                            autoComplete="off"
                                                            placeholder="Categoria"
                                                            value={questionCategory}
                                                            onChange={(e) => setQuestionCategory(e.target.value)}
                                                            disabled={isSubmittingQuestion}
                                                        />
                                                        <datalist id="admin-question-categories">
                                                            {categoryOptions.map((c, i) => (
                                                                <option key={`cat-${i}-${c}`} value={c} />
                                                            ))}
                                                        </datalist>
                                                        <p className="text-[9px] text-slate-500 mt-1 break-words">
                                                            {loadingCategories
                                                                ? 'Carregando categorias já usadas nesta prova…'
                                                                : categoryOptions.length > 0
                                                                  ? 'Escolha uma sugestão da lista ou digite um nome novo (mesmo comportamento do campo Prova).'
                                                                  : 'Ainda não há categorias nesta prova — digite o nome da primeira.'}
                                                        </p>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black uppercase text-slate-400">
                                                            Enunciado (HTML)
                                                        </label>
                                                        <textarea
                                                            required
                                                            className={`${inputClasses} min-h-[120px] resize-y`}
                                                            placeholder={'<p>…</p>'}
                                                            value={questionEnunciado}
                                                            onChange={(e) => setQuestionEnunciado(e.target.value)}
                                                            disabled={isSubmittingQuestion}
                                                        />
                                                        <p className="text-[9px] text-slate-500 break-words">
                                                            O enunciado deve ser enviado em{' '}
                                                            <span className="font-bold">HTML</span> (parágrafos, listas,
                                                            código, imagens inline, etc.).
                                                        </p>
                                                    </div>

                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black uppercase text-slate-400">
                                                            URL de Imagem do Enunciado (opcional)
                                                        </label>
                                                        <input
                                                            type="url"
                                                            className={inputClasses}
                                                            placeholder="https://"
                                                            value={questionEnunciadoImageUrl}
                                                            onChange={(e) => setQuestionEnunciadoImageUrl(e.target.value)}
                                                            disabled={isSubmittingQuestion}
                                                        />
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between gap-2 min-w-0">
                                                            <label className="text-[10px] font-black uppercase text-slate-400 shrink-0">
                                                                Opções (texto em HTML)
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={handleAddOptionRow}
                                                                className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF3621] hover:text-[#E6311D]"
                                                                disabled={isSubmittingQuestion}
                                                            >
                                                                + Adicionar Opção
                                                            </button>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {questionOptions.map((opt, index) => (
                                                                <div
                                                                    key={opt.id}
                                                                    className="grid grid-cols-12 gap-2 items-start min-w-0"
                                                                >
                                                                    <div
                                                                        className="col-span-2 flex items-center justify-center px-2 py-2 rounded bg-slate-800/80 text-white border border-slate-600 text-xs font-black tabular-nums"
                                                                        title="ID fixo (gravado como minúsculo na base)"
                                                                        aria-hidden
                                                                    >
                                                                        {opt.id.toUpperCase()}
                                                                    </div>
                                                                    <input
                                                                        className={`col-span-5 ${optionCellInputClasses}`}
                                                                        placeholder="HTML"
                                                                        title="Conteúdo da opção em HTML"
                                                                        value={opt.text}
                                                                        onChange={(e) =>
                                                                            handleQuestionOptionChange(
                                                                                index,
                                                                                'text',
                                                                                e.target.value
                                                                            )
                                                                        }
                                                                        disabled={isSubmittingQuestion}
                                                                    />
                                                                    <input
                                                                        className={`col-span-4 ${optionCellInputClasses}`}
                                                                        placeholder="URL img"
                                                                        title="URL da imagem (opcional)"
                                                                        value={opt.imageUrl || ''}
                                                                        onChange={(e) =>
                                                                            handleQuestionOptionChange(
                                                                                index,
                                                                                'imageUrl',
                                                                                e.target.value
                                                                            )
                                                                        }
                                                                        disabled={isSubmittingQuestion}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveOptionRow(index)}
                                                                        className="col-span-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-[#FF3621]"
                                                                        disabled={
                                                                            isSubmittingQuestion ||
                                                                            questionOptions.length <= 4
                                                                        }
                                                                        title="Remover opção"
                                                                    >
                                                                        X
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <p className="text-[9px] text-slate-500 break-words">
                                                            Mínimo de <span className="font-bold">quatro</span>{' '}
                                                            alternativas por questão. As letras{' '}
                                                            <span className="font-bold">A, B, C…</span> são fixas (na base
                                                            ficam <span className="font-bold">minúsculas</span>). Preencha
                                                            o texto em <span className="font-bold">HTML</span> e/ou a URL
                                                            da imagem.
                                                        </p>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black uppercase text-slate-400">
                                                                Opção correta
                                                            </label>
                                                            <select
                                                                required
                                                                className={inputClasses}
                                                                value={questionCorrectOptionId}
                                                                onChange={(e) =>
                                                                    setQuestionCorrectOptionId(e.target.value)
                                                                }
                                                                disabled={isSubmittingQuestion}
                                                            >
                                                                <option value="">Letra…</option>
                                                                {questionOptions.map((opt) => (
                                                                    <option key={opt.id} value={opt.id}>
                                                                        {opt.id.toUpperCase()}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <p className="text-[9px] text-slate-500">
                                                                Valor gravado na base: letra{' '}
                                                                <span className="font-bold">minúscula</span> (ex.:{' '}
                                                                <span className="font-mono">a</span>).
                                                            </p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black uppercase text-slate-400">
                                                                Explicação (HTML)
                                                            </label>
                                                            <textarea
                                                                required
                                                                className={`${inputClasses} min-h-[80px] resize-y`}
                                                                placeholder={'<p>…</p>'}
                                                                value={questionExplanation}
                                                                onChange={(e) => setQuestionExplanation(e.target.value)}
                                                                disabled={isSubmittingQuestion}
                                                            />
                                                            <p className="text-[9px] text-slate-500 break-words">
                                                                A explicação também deve estar em{' '}
                                                                <span className="font-bold">HTML</span>.
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 border-t border-slate-200 space-y-3">
                                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.25em]">
                                                                Pré-visualização no simulado
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setQuestionPreviewOpen((open) => !open)}
                                                                className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF3621] hover:text-[#E6311D]"
                                                                disabled={isSubmittingQuestion}
                                                            >
                                                                {questionPreviewOpen
                                                                    ? 'Ocultar pré-visualização'
                                                                    : 'Mostrar pré-visualização'}
                                                            </button>
                                                        </div>
                                                        {questionPreviewOpen && previewQuestion && (
                                                            <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-4 md:p-6 overflow-x-hidden shadow-sm">
                                                                <div className="mb-6 pb-4 border-b border-slate-200 space-y-2">
                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                        <span className="text-xs font-black text-[#1B3139] uppercase tracking-[0.2em]">
                                                                            Questão 1 de 1 (exemplo)
                                                                        </span>
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                                            Apenas visualização
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full bg-[#FF3621] transition-all duration-300"
                                                                            style={{ width: '100%' }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <QuestionView
                                                                    question={previewQuestion}
                                                                    selectedOptionId={previewSelectedOptionId}
                                                                    onSelectOption={setPreviewSelectedOptionId}
                                                                />
                                                                <p className="mt-8 mb-3 text-[9px] text-slate-500">
                                                                    Mesma tela do simulado — clique nas alternativas para
                                                                    ver o destaque.
                                                                </p>

                                                                <div className="pt-6 border-t border-slate-200 space-y-3">
                                                                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.25em]">
                                                                        No relatório final
                                                                    </span>
                                                                    <p className="text-[9px] text-slate-500">
                                                                        Após o simulado, na revisão questão a questão, a
                                                                        explicação aparece assim (mesmo bloco da página
                                                                        de resultados).
                                                                    </p>
                                                                    <Card className="p-6 md:p-8 border-l-4 border-l-slate-300 shadow-sm bg-white">
                                                                        <div className="space-y-2 mb-4">
                                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                                                Questão 1
                                                                            </span>
                                                                            <div
                                                                                className="text-lg font-bold text-[#1B3139] leading-snug break-words [&_pre]:whitespace-pre-wrap"
                                                                                style={{
                                                                                    wordBreak: 'break-word',
                                                                                    overflowWrap: 'break-word',
                                                                                }}
                                                                                dangerouslySetInnerHTML={{
                                                                                    __html: previewQuestion.enunciado,
                                                                                }}
                                                                            />
                                                                        </div>
                                                                        <div className="pt-2">
                                                                            <details
                                                                                className="group"
                                                                                aria-labelledby="admin-explanation-preview-toggle"
                                                                            >
                                                                                <summary
                                                                                    id="admin-explanation-preview-toggle"
                                                                                    className="cursor-pointer text-[#FF3621] hover:text-[#E6311D] font-black text-[10px] uppercase tracking-widest flex items-center gap-2 select-none transition-all focus:outline-none"
                                                                                >
                                                                                    <span className="group-open:hidden">
                                                                                        Ver Explicação
                                                                                    </span>
                                                                                    <span className="hidden group-open:inline">
                                                                                        Ocultar Explicação
                                                                                    </span>
                                                                                    <svg
                                                                                        className="w-4 h-4 shrink-0 transform text-current transition-transform duration-200 group-open:-rotate-180"
                                                                                        fill="none"
                                                                                        stroke="currentColor"
                                                                                        viewBox="0 0 24 24"
                                                                                        aria-hidden
                                                                                    >
                                                                                        <path
                                                                                            strokeLinecap="round"
                                                                                            strokeLinejoin="round"
                                                                                            strokeWidth="2"
                                                                                            d="M19 9l-7 7-7-7"
                                                                                        />
                                                                                    </svg>
                                                                                </summary>
                                                                                <div className="mt-4 p-6 bg-[#1B3139] text-white rounded-sm border-l-4 border-[#FF3621] space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                                                    <div className="flex items-center gap-3 text-[#FF3621]">
                                                                                        <svg
                                                                                            className="w-6 h-6"
                                                                                            fill="none"
                                                                                            stroke="currentColor"
                                                                                            viewBox="0 0 24 24"
                                                                                        >
                                                                                            <path
                                                                                                strokeLinecap="round"
                                                                                                strokeLinejoin="round"
                                                                                                strokeWidth="2"
                                                                                                d="M13 10V3L4 14h7v7l9-11h-7z"
                                                                                            />
                                                                                        </svg>
                                                                                    </div>
                                                                                    <div
                                                                                        className="text-slate-200 text-sm leading-relaxed font-medium [&_a]:text-[#FF3621] [&_a]:underline break-words"
                                                                                        style={{
                                                                                            wordBreak: 'break-word',
                                                                                            overflowWrap: 'break-word',
                                                                                        }}
                                                                                        dangerouslySetInnerHTML={{
                                                                                            __html: previewQuestion.explanation,
                                                                                        }}
                                                                                    />
                                                                                </div>
                                                                            </details>
                                                                        </div>
                                                                    </Card>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <Button
                                                        type="submit"
                                                        className="w-full py-4 mt-4"
                                                        isLoading={isSubmittingQuestion}
                                                    >
                                                        Cadastrar Pergunta
                                                    </Button>
                                                </>
                                            ) : null}
                                        </form>
                                    )}

                                    {activeTab === 'results' && (
                                        <form onSubmit={handleDeleteResults} className="space-y-4">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.25em]">
                                                    Remover Resultados de Usuários
                                                </span>
                                                <p className="text-[11px] text-slate-600">
                                                    Limpe registros de resultados para um usuário específico, opcionalmente
                                                    filtrando por exame.
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-1">
                                                    <label className="text-[10px] font-black uppercase text-slate-400">
                                                        E-mail do Usuário
                                                    </label>
                                                    <input
                                                        required
                                                        type="email"
                                                        className={inputClasses}
                                                        placeholder="usuario@empresa.com"
                                                        value={resultsEmail}
                                                        onChange={(e) => setResultsEmail(e.target.value)}
                                                        disabled={isDeletingResults}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label
                                                        htmlFor="admin-results-exam"
                                                        className="text-[10px] font-black uppercase text-slate-400"
                                                    >
                                                        Exame (opcional)
                                                    </label>
                                                    <select
                                                        id="admin-results-exam"
                                                        className={inputClasses}
                                                        value={resultsExam}
                                                        onChange={(e) => setResultsExam(e.target.value)}
                                                        disabled={isDeletingResults || loadingAdminExams}
                                                    >
                                                        <option value="">
                                                            Todos os exames do usuário
                                                        </option>
                                                        {adminExamOptions.map((ex) => (
                                                            <option key={ex} value={ex}>
                                                                {ex}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <p className="text-[9px] text-slate-500 break-words">
                                                        {loadingAdminExams
                                                            ? 'Carregando provas cadastradas…'
                                                            : adminExamOptions.length === 0
                                                              ? 'Nenhuma prova na base ainda — a remoção aplicará a todos os resultados do usuário.'
                                                              : 'Deixe “Todos” para apagar resultados de qualquer exame, ou escolha uma prova específica.'}
                                                    </p>
                                                </div>
                                            </div>

                                            <Button
                                                type="submit"
                                                className="w-full py-4 mt-4 bg-red-600 hover:bg-red-700"
                                                isLoading={isDeletingResults}
                                            >
                                                Remover Resultados
                                            </Button>
                                        </form>
                                    )}
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            </main>
        </div>
    );
};

export default Admin;
