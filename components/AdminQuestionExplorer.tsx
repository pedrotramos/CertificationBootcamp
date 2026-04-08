import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/dbService';
import type { Question } from '../types';
import Button from './Button';
import QuestionView from './QuestionView';

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

function stripHtmlSnippet(html: string, maxLen = 200): string {
    const t = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return '(sem texto no enunciado)';
    if (t.length <= maxLen) return t;
    return `${t.slice(0, maxLen)}…`;
}

function qid(q: Question): string {
    return String(q._id ?? '');
}

function resolveExamAgainstList(examTrimmed: string, exams: string[]): string {
    const exact = exams.find((x) => x === examTrimmed);
    if (exact !== undefined) return exact;
    const ci = exams.find((x) => x.trim().toLowerCase() === examTrimmed.toLowerCase());
    if (ci !== undefined) return ci;
    return examTrimmed;
}

interface AdminQuestionExplorerProps {
    otpValidated: boolean;
    examOptions: string[];
    loadingExams: boolean;
    inputClasses: string;
    optionCellInputClasses: string;
    onMutate?: () => void;
}

const BROWSE_PAGE_SIZE = 25;

const AdminQuestionExplorer: React.FC<AdminQuestionExplorerProps> = ({
    otpValidated,
    examOptions,
    loadingExams,
    inputClasses,
    optionCellInputClasses,
    onMutate,
}) => {
    const [exploreExam, setExploreExam] = useState('');
    const [list, setList] = useState<Question[]>([]);
    const [browseTotal, setBrowseTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [semanticRanked, setSemanticRanked] = useState(false);
    const [searchMatchMode, setSearchMatchMode] = useState<'strict' | 'relaxed' | undefined>();
    const [loadingList, setLoadingList] = useState(false);
    const [listError, setListError] = useState<string | null>(null);
    const [exploreCategory, setExploreCategory] = useState('');
    const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(false);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editCategory, setEditCategory] = useState('');
    const [editExam, setEditExam] = useState('');
    const [editEnunciado, setEditEnunciado] = useState('');
    const [editEnunciadoImageUrl, setEditEnunciadoImageUrl] = useState('');
    const [editOptions, setEditOptions] = useState<{ id: string; text: string; imageUrl?: string }[]>([]);
    const [editCorrectId, setEditCorrectId] = useState('');
    const [editExplanation, setEditExplanation] = useState('');
    const [previewPick, setPreviewPick] = useState<string | undefined>();
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);

    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
        return () => window.clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, exploreCategory]);

    useEffect(() => {
        if (!otpValidated || !exploreExam.trim()) {
            setCategoryOptions([]);
            setExploreCategory('');
            return;
        }
        let cancelled = false;
        const resolved = resolveExamAgainstList(exploreExam.trim(), examOptions);
        setLoadingCategories(true);
        dbService
            .getQuestionCategoriesForExam(resolved)
            .then((cats) => {
                if (!cancelled) setCategoryOptions(cats);
            })
            .catch(() => {
                if (!cancelled) setCategoryOptions([]);
            })
            .finally(() => {
                if (!cancelled) setLoadingCategories(false);
            });
        return () => {
            cancelled = true;
        };
    }, [otpValidated, exploreExam, examOptions]);

    useEffect(() => {
        if (!otpValidated || !exploreExam.trim()) {
            setList([]);
            setBrowseTotal(0);
            setSemanticRanked(false);
            setSearchMatchMode(undefined);
            setListError(null);
            return;
        }
        const categoryForApi = exploreCategory.trim();
        let cancelled = false;
        setLoadingList(true);
        setListError(null);
        dbService
            .browseQuestions({
                exam: exploreExam.trim(),
                page,
                pageSize: BROWSE_PAGE_SIZE,
                search: debouncedSearch,
                category: categoryForApi || undefined,
            })
            .then((res) => {
                if (cancelled) return;
                setList(res.questions);
                setBrowseTotal(res.total);
                setSemanticRanked(res.semanticRanked);
                setSearchMatchMode(res.searchMatchMode);
                if (res.page !== page) {
                    setPage(res.page);
                }
            })
            .catch((e: Error) => {
                if (!cancelled) {
                    setList([]);
                    setBrowseTotal(0);
                    setListError(e.message || 'Erro ao carregar perguntas.');
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingList(false);
            });
        return () => {
            cancelled = true;
        };
    }, [otpValidated, exploreExam, page, debouncedSearch, exploreCategory]);

    const totalPages = Math.max(1, Math.ceil(browseTotal / BROWSE_PAGE_SIZE) || 1);

    useEffect(() => {
        const ids = new Set(editOptions.map((o) => o.id));
        setEditCorrectId((cur) => (cur && !ids.has(cur) ? '' : cur));
    }, [editOptions]);

    const openModal = (q: Question) => {
        const id = qid(q);
        setEditingId(id);
        setEditCategory(q.category || '');
        setEditExam(q.exam || '');
        setEditEnunciado(q.enunciado || '');
        setEditEnunciadoImageUrl(q.enunciadoImageUrl || '');
        const raw = (q.options || []).map((o) => ({
            id: o.id,
            text: o.text || '',
            imageUrl: o.imageUrl || '',
        }));
        const padded =
            raw.length >= 4
                ? raw
                : [
                      ...raw,
                      ...Array.from({ length: 4 - raw.length }, () => ({
                          id: '',
                          text: '',
                          imageUrl: '' as string | undefined,
                      })),
                  ];
        setEditOptions(withSequentialOptionIds(padded));
        setEditCorrectId((q.correctOptionId || '').trim().toLowerCase());
        setEditExplanation(q.explanation || '');
        setPreviewPick(undefined);
        setModalError(null);
        setShowDeleteConfirm(false);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingId(null);
        setModalError(null);
        setShowDeleteConfirm(false);
    };

    const previewQuestion: Question | null = useMemo(() => {
        if (!modalOpen || !editingId) return null;
        const cleaned = editOptions
            .map((o) => ({
                id: o.id.trim().toLowerCase(),
                text: o.text.trim(),
                imageUrl: o.imageUrl?.trim(),
            }))
            .filter((o) => o.id && (o.text || o.imageUrl));
        const opts =
            cleaned.length > 0
                ? cleaned
                : [
                      { id: 'a', text: '…' },
                      { id: 'b', text: '…' },
                      { id: 'c', text: '…' },
                      { id: 'd', text: '…' },
                  ];
        const enunciado = editEnunciado.trim() || '<p class="text-slate-400 italic">Enunciado vazio</p>';
        const cat = editCategory.trim() || 'Categoria';
        const cid = editCorrectId.trim().toLowerCase();
        const fb = opts[0]?.id ?? 'a';
        return {
            category: cat,
            enunciado,
            enunciadoImageUrl: editEnunciadoImageUrl.trim() || undefined,
            options: opts,
            correctOptionId: cid && opts.some((o) => o.id === cid) ? cid : fb,
            explanation: editExplanation.trim() || '<p class="text-slate-400 italic">Sem explicação</p>',
            exam: editExam.trim() || exploreExam,
        };
    }, [
        modalOpen,
        editingId,
        editCategory,
        editExam,
        editEnunciado,
        editEnunciadoImageUrl,
        editOptions,
        editCorrectId,
        editExplanation,
        exploreExam,
    ]);

    const handleOptionChange = (index: number, field: 'text' | 'imageUrl', value: string) => {
        setEditOptions((prev) => {
            const next = [...prev];
            const row = { ...next[index], [field]: value };
            next[index] = row;
            return next;
        });
    };

    const handleAddOption = () => {
        setEditOptions((prev) =>
            withSequentialOptionIds([...prev, { id: '', text: '', imageUrl: '' }])
        );
    };

    const handleRemoveOption = (index: number) => {
        if (editOptions.length <= 4) return;
        setEditOptions((prev) => withSequentialOptionIds(prev.filter((_, i) => i !== index)));
    };

    const handleSave = async () => {
        if (!editingId || !otpValidated) return;
        setModalError(null);
        const cleaned = editOptions
            .map((o) => ({
                id: o.id.trim().toLowerCase(),
                text: o.text.trim(),
                imageUrl: o.imageUrl?.trim(),
            }))
            .filter((o) => o.id && (o.text || o.imageUrl));
        if (cleaned.length < 4) {
            setModalError('É necessário pelo menos quatro alternativas válidas.');
            return;
        }
        if (!editCategory.trim() || !editExam.trim() || !editEnunciado.trim() || !editExplanation.trim()) {
            setModalError('Preencha categoria, prova, enunciado e explicação.');
            return;
        }
        const correct = editCorrectId.trim().toLowerCase();
        if (!correct || !cleaned.some((o) => o.id === correct)) {
            setModalError('Selecione a opção correta entre as alternativas válidas.');
            return;
        }
        const payload: Omit<Question, '_id'> = {
            exam: editExam.trim(),
            category: editCategory.trim(),
            enunciado: editEnunciado.trim(),
            options: cleaned,
            correctOptionId: correct,
            explanation: editExplanation.trim(),
            enunciadoImageUrl: editEnunciadoImageUrl.trim(),
        };

        setSaving(true);
        try {
            await dbService.updateQuestion(editingId, payload);
            const res = await dbService.browseQuestions({
                exam: exploreExam.trim(),
                page,
                pageSize: BROWSE_PAGE_SIZE,
                search: debouncedSearch,
                category: exploreCategory.trim() || undefined,
            });
            setList(res.questions);
            setBrowseTotal(res.total);
            setSemanticRanked(res.semanticRanked);
            setSearchMatchMode(res.searchMatchMode);
            if (res.page !== page) {
                setPage(res.page);
            }
            onMutate?.();
            closeModal();
        } catch (e: unknown) {
            setModalError(e instanceof Error ? e.message : 'Erro ao salvar.');
        } finally {
            setSaving(false);
        }
    };

    const executeDeleteQuestion = async () => {
        if (!editingId || !otpValidated) return;
        setModalError(null);
        setDeleting(true);
        try {
            await dbService.deleteQuestion(editingId);
            const res = await dbService.browseQuestions({
                exam: exploreExam.trim(),
                page,
                pageSize: BROWSE_PAGE_SIZE,
                search: debouncedSearch,
                category: exploreCategory.trim() || undefined,
            });
            setList(res.questions);
            setBrowseTotal(res.total);
            setSemanticRanked(res.semanticRanked);
            setSearchMatchMode(res.searchMatchMode);
            if (res.page !== page) {
                setPage(res.page);
            }
            onMutate?.();
            setShowDeleteConfirm(false);
            closeModal();
        } catch (e: unknown) {
            setModalError(e instanceof Error ? e.message : 'Erro ao excluir.');
        } finally {
            setDeleting(false);
        }
    };

    useEffect(() => {
        if (!modalOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (showDeleteConfirm) {
                setShowDeleteConfirm(false);
            } else {
                closeModal();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [modalOpen, showDeleteConfirm]);

    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.25em]">
                    Explorar perguntas por prova
                </span>
                <p className="text-[11px] text-slate-600">
                    Escolha um exame para listar os enunciados (25 por página). Use a busca semântica para ordenar por
                    relevância ao texto em enunciado, alternativas, explicação e categoria.
                </p>
            </div>

            <div className="space-y-1">
                <label htmlFor="admin-explore-search" className="text-[10px] font-black uppercase text-slate-400">
                    Busca semântica
                </label>
                <input
                    id="admin-explore-search"
                    type="search"
                    className={inputClasses}
                    placeholder="Ex.: delta lake merge, autoloader, unity catalog…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    disabled={!otpValidated || !exploreExam.trim()}
                />
                <p className="text-[9px] text-slate-500">
                    Digite uma ou mais palavras (mín. 2 caracteres). Com busca ativa, a lista é ordenada por relevância.
                    {semanticRanked && searchMatchMode === 'relaxed' && (
                        <span className="block mt-1 text-amber-700 font-bold">
                            Correspondência ampla: algumas palavras podem não aparecer em todas as questões listadas.
                        </span>
                    )}
                </p>
            </div>

            <div className="space-y-1">
                <label htmlFor="admin-explore-exam" className="text-[10px] font-black uppercase text-slate-400">
                    Prova
                </label>
                <select
                    id="admin-explore-exam"
                    className={`${inputClasses} cursor-pointer`}
                    value={exploreExam}
                    onChange={(e) => {
                        setExploreExam(e.target.value);
                        setExploreCategory('');
                        setPage(1);
                    }}
                    disabled={!otpValidated || loadingExams}
                >
                    <option value="">{loadingExams ? 'Carregando provas…' : 'Selecione uma prova'}</option>
                    {examOptions.map((ex) => (
                        <option key={ex} value={ex}>
                            {ex}
                        </option>
                    ))}
                </select>
            </div>

            <div className="space-y-1">
                <label htmlFor="admin-explore-category" className="text-[10px] font-black uppercase text-slate-400">
                    Categoria (opcional)
                </label>
                <select
                    id="admin-explore-category"
                    className={`${inputClasses} cursor-pointer`}
                    value={exploreCategory}
                    onChange={(e) => setExploreCategory(e.target.value)}
                    disabled={!otpValidated || !exploreExam.trim() || loadingCategories}
                >
                    <option value="">Todas as categorias</option>
                    {categoryOptions.map((c) => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>
                <p className="text-[9px] text-slate-500">
                    {loadingCategories
                        ? 'Carregando categorias desta prova…'
                        : exploreExam.trim()
                          ? 'Escolha uma categoria ou deixe “Todas as categorias” para não filtrar.'
                          : 'Selecione uma prova para listar categorias.'}
                </p>
            </div>

            {listError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded">{listError}</div>
            )}

            {exploreExam.trim() && (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        <span>
                            {semanticRanked ? 'Ordenado por relevância' : 'Ordenado por categoria'}
                            {browseTotal > 0 && (
                                <>
                                    {' '}
                                    · {browseTotal === 1 ? '1 questão' : `${browseTotal} questões`}
                                </>
                            )}
                        </span>
                        {browseTotal > 0 && (
                            <span className="tabular-nums">
                                Página {page} / {totalPages}
                            </span>
                        )}
                    </div>
                    <div className="border border-slate-200 rounded-lg bg-slate-50/80 max-h-[min(420px,50vh)] overflow-y-auto">
                        {loadingList ? (
                            <p className="p-4 text-xs text-slate-500">Carregando perguntas…</p>
                        ) : list.length === 0 ? (
                            <p className="p-4 text-xs text-slate-500">
                                {debouncedSearch.length >= 2
                                    ? 'Nenhuma questão encontrada para essa busca nesta prova.'
                                    : exploreCategory.trim()
                                      ? 'Nenhuma questão nesta categoria ou combinação com a busca.'
                                      : 'Nenhuma pergunta encontrada para esta prova.'}
                            </p>
                        ) : (
                            <ul className="divide-y divide-slate-200">
                                {list.map((q) => (
                                    <li key={qid(q)}>
                                        <button
                                            type="button"
                                            onClick={() => openModal(q)}
                                            className="w-full text-left px-4 py-3 hover:bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3621]/40"
                                        >
                                            <span className="block text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">
                                                {q.category}
                                            </span>
                                            <span className="text-sm text-[#1B3139] font-medium line-clamp-2">
                                                {stripHtmlSnippet(q.enunciado)}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    {exploreExam.trim() && browseTotal > 0 && (
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={loadingList || page <= 1}
                                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Anterior
                            </button>
                            <button
                                type="button"
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={loadingList || page >= totalPages}
                                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Próxima
                            </button>
                        </div>
                    )}
                </>
            )}

            {modalOpen && previewQuestion && (
                <div
                    className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="admin-explore-modal-title"
                >
                    <button
                        type="button"
                        className="absolute inset-0 cursor-default"
                        aria-label="Fechar modal"
                        onClick={closeModal}
                    />
                    <div className="relative bg-white w-full sm:max-w-3xl max-h-[96vh] sm:max-h-[92vh] overflow-hidden flex flex-col rounded-t-2xl sm:rounded-xl shadow-2xl border border-slate-200">
                        {showDeleteConfirm && (
                            <div
                                className="absolute inset-0 z-[120] flex items-center justify-center p-4 bg-[#1B3139]/60 backdrop-blur-[2px]"
                                role="alertdialog"
                                aria-modal="true"
                                aria-labelledby="admin-delete-question-title"
                            >
                                <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 max-w-md w-full space-y-4">
                                    <h3
                                        id="admin-delete-question-title"
                                        className="text-sm font-black text-[#1B3139] uppercase tracking-tight"
                                    >
                                        Confirmar exclusão
                                    </h3>
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        Esta pergunta será removida permanentemente da base. Esta ação não pode ser
                                        desfeita. Clique em <span className="font-bold">Confirmar</span> para prosseguir.
                                    </p>
                                    <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setShowDeleteConfirm(false)}
                                            disabled={deleting}
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="danger"
                                            onClick={executeDeleteQuestion}
                                            disabled={deleting}
                                            isLoading={deleting}
                                        >
                                            Confirmar
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
                            <h2 id="admin-explore-modal-title" className="text-sm font-black text-[#1B3139] uppercase tracking-tight truncate">
                                Editar pergunta
                            </h2>
                            <button
                                type="button"
                                onClick={closeModal}
                                className="text-[10px] font-black uppercase text-slate-500 hover:text-[#FF3621] px-2 py-1 shrink-0"
                            >
                                Fechar
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-8">
                            {modalError && (
                                <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded">
                                    {modalError}
                                </div>
                            )}

                            <section className="space-y-2">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                    Pré-visualização (simulado)
                                </span>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 overflow-x-hidden">
                                    <QuestionView
                                        question={previewQuestion}
                                        selectedOptionId={previewPick}
                                        onSelectOption={setPreviewPick}
                                    />
                                </div>
                            </section>

                            <section className="space-y-2">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                    Explicação (relatório)
                                </span>
                                <details className="group">
                                    <summary className="cursor-pointer text-[#FF3621] font-black text-[10px] uppercase tracking-widest flex items-center gap-2 select-none">
                                        <span className="group-open:hidden">Ver Explicação</span>
                                        <span className="hidden group-open:inline">Ocultar Explicação</span>
                                        <svg
                                            className="w-4 h-4 shrink-0 transform text-current transition-transform duration-200 group-open:-rotate-180"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                            aria-hidden
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </summary>
                                    <div className="mt-3 p-4 bg-[#1B3139] text-white rounded-sm border-l-4 border-[#FF3621] text-sm leading-relaxed">
                                        <div
                                            className="text-slate-200 font-medium break-words"
                                            style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                                            dangerouslySetInnerHTML={{
                                                __html: editExplanation.trim() || '<p class="text-slate-400 italic">(vazio)</p>',
                                            }}
                                        />
                                    </div>
                                </details>
                            </section>

                            <section className="space-y-3 border-t border-slate-200 pt-6">
                                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Editar dados</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Categoria</label>
                                        <input
                                            className={inputClasses}
                                            value={editCategory}
                                            onChange={(e) => setEditCategory(e.target.value)}
                                            disabled={saving || deleting}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Prova (exam)</label>
                                        <input
                                            className={inputClasses}
                                            value={editExam}
                                            onChange={(e) => setEditExam(e.target.value)}
                                            disabled={saving || deleting}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Enunciado (HTML)</label>
                                    <textarea
                                        className={`${inputClasses} min-h-[100px] resize-y`}
                                        value={editEnunciado}
                                        onChange={(e) => setEditEnunciado(e.target.value)}
                                        disabled={saving || deleting}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400">URL imagem do enunciado</label>
                                    <input
                                        className={inputClasses}
                                        value={editEnunciadoImageUrl}
                                        onChange={(e) => setEditEnunciadoImageUrl(e.target.value)}
                                        disabled={saving || deleting}
                                        placeholder="Opcional"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center gap-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Opções</label>
                                        <button
                                            type="button"
                                            onClick={handleAddOption}
                                            className="text-[10px] font-black uppercase text-[#FF3621]"
                                            disabled={saving || deleting}
                                        >
                                            + Opção
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {editOptions.map((opt, index) => (
                                            <div key={`${opt.id}-${index}`} className="grid grid-cols-12 gap-2 items-start">
                                                <div className="col-span-2 flex items-center justify-center px-2 py-2 rounded bg-slate-800/80 text-white text-xs font-black">
                                                    {opt.id.toUpperCase()}
                                                </div>
                                                <input
                                                    className={`col-span-5 ${optionCellInputClasses}`}
                                                    placeholder="HTML"
                                                    value={opt.text}
                                                    onChange={(e) => handleOptionChange(index, 'text', e.target.value)}
                                                    disabled={saving || deleting}
                                                />
                                                <input
                                                    className={`col-span-4 ${optionCellInputClasses}`}
                                                    placeholder="URL img"
                                                    value={opt.imageUrl || ''}
                                                    onChange={(e) => handleOptionChange(index, 'imageUrl', e.target.value)}
                                                    disabled={saving || deleting}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveOption(index)}
                                                    className="col-span-1 text-[10px] font-black text-slate-400 hover:text-[#FF3621]"
                                                    disabled={saving || deleting || editOptions.length <= 4}
                                                >
                                                    X
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400">Opção correta</label>
                                        <select
                                            className={inputClasses}
                                            value={editCorrectId}
                                            onChange={(e) => setEditCorrectId(e.target.value)}
                                            disabled={saving || deleting}
                                        >
                                            <option value="">Letra…</option>
                                            {editOptions.map((o) => (
                                                <option key={o.id} value={o.id}>
                                                    {o.id.toUpperCase()}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Explicação (HTML)</label>
                                    <textarea
                                        className={`${inputClasses} min-h-[100px] resize-y`}
                                        value={editExplanation}
                                        onChange={(e) => setEditExplanation(e.target.value)}
                                        disabled={saving || deleting}
                                    />
                                </div>
                            </section>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50 shrink-0">
                            <Button
                                type="button"
                                variant="danger"
                                className="flex-1"
                                onClick={() => {
                                    setModalError(null);
                                    setShowDeleteConfirm(true);
                                }}
                                disabled={saving || deleting}
                            >
                                Excluir pergunta
                            </Button>
                            <Button type="button" className="flex-1" onClick={handleSave} disabled={deleting} isLoading={saving}>
                                Salvar alterações
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminQuestionExplorer;
