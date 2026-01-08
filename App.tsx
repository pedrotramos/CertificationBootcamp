
import React, { useState, useEffect } from 'react';
import { AppState, User, Question, ExamResult, Answers } from './types';
import { dbService } from './services/dbService';
// import { geminiService } from './services/geminiService';
import Button from './components/Button';
import Card from './components/Card';
import QuestionView from './components/QuestionView';
import ResultsChart from './components/ResultsChart';
import CategoryChart from './components/CategoryChart';

const PROHIBITED_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'bol.com.br',
  'uol.com.br',
  'ig.com.br'
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>('register');
  const [user, setUser] = useState<User | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // Stores the selected option ID for each question by question ID
  // Each entry represents the user's answer choice when they interacted with that question
  const [answers, setAnswers] = useState<Answers>({});
  const [finalResult, setFinalResult] = useState<ExamResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', company: '' });

  useEffect(() => {
    const loadData = async () => {
      const q = await dbService.getQuestions();
      setQuestions(q);
    };
    loadData();
  }, []);

  const validateEmail = (email: string, isWhitelisted: boolean): { isValid: boolean; message: string | null } => {
    const emailLower = email.toLowerCase().trim();
    if (!emailLower) return { isValid: false, message: 'O e-mail é obrigatório.' };

    const domain = emailLower.split('@')[1];
    if (PROHIBITED_DOMAINS.includes(domain)) {
      return {
        isValid: false,
        message: 'Utilize apenas e-mails corporativos. Provedores gratuitos não são permitidos.'
      };
    }

    if (!isWhitelisted) {
      return {
        isValid: false,
        message: 'Seu domínio de email não está liberado para uso. Solicite a liberação.'
      };
    }

    return { isValid: true, message: null };
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const whitelistedDomain = await dbService.checkDomain(formData.email);

    const emailValidation = validateEmail(formData.email, whitelistedDomain);
    if (!emailValidation.isValid) {
      setErrorMsg(emailValidation.message);
      return;
    }

    setIsSubmitting(true);
    try {
      const existingUser = await dbService.getUserByEmail(formData.email);
      if (existingUser) {
        const results = await dbService.getUserResults(existingUser._id.toString());
        if (results.length > 0) {
          const questions = await dbService.getAnsweredQuestions(existingUser._id.toString());
          setQuestions(questions);
          setUser(existingUser);
          setFinalResult(results[0]);
          setState('results');
          setIsSubmitting(false);
          return;
        }
        setUser(existingUser);
      } else {
        const newUser = await dbService.saveUser(formData);
        setUser(newUser);
      }
      setState('exam');
    } catch (err) {
      setErrorMsg('Ocorreu um erro ao processar seu registro. Tente novamente.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      finishExam();
    }
  };

  const finishExam = async () => {
    if (!user) return;
    setIsSubmitting(true);

    const examAnswers = questions.map(q => ({
      questionId: q._id,
      selectedOptionId: answers[q._id] || '',
      isCorrect: answers[q._id] === q.correctOptionId,
      category: q.category
    }));

    const score = examAnswers.filter(a => a.isCorrect).length;

    const result = {
      userId: user._id,
      timestamp: new Date(),
      score,
      totalQuestions: questions.length,
      answers: examAnswers
    };

    const savedResult = await dbService.saveResult(result);
    setFinalResult(savedResult);
    setState('results');
    setIsSubmitting(false);
  };

  const inputClasses = "w-full px-4 py-3 rounded bg-[#1B3139] text-white border border-slate-700 focus:border-[#FF3621] focus:ring-1 focus:ring-[#FF3621] outline-none transition-all placeholder-slate-400";

  const renderContent = () => {
    switch (state) {
      case 'register':
        return (
          <>
            <div className="max-w-4xl mx-auto py-12 px-4 grid md:grid-cols-2 gap-12 items-center animate-in fade-in duration-700">
              <div className="space-y-6">
                <h1 className="text-4xl md:text-5xl font-extrabold text-[#1B3139] leading-tight uppercase">
                  Certification <span className="text-[#FF3621]">PrepCamp</span>
                </h1>
                <p className="text-lg text-slate-600">
                  O caminho definitivo para sua especialização em Databricks. Valide suas competências técnicas e se prepare para a certificação.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FF3621]" />
                    <span className="font-bold text-[#1B3139] uppercase text-sm tracking-tight">Perguntas de Múltipla Escolha</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FF3621]" />
                    <span className="font-bold text-[#1B3139] uppercase text-sm tracking-tight">Relatório de Performance</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FF3621]" />
                    <span className="font-bold text-[#1B3139] uppercase text-sm tracking-tight">Revisão com explicação das respostas</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FF3621]" />
                    <span className="font-bold text-[#1B3139] uppercase text-sm tracking-tight">Questões atualizadas constantemente</span>
                  </div>
                </div>
              </div>

              <Card className="p-8 space-y-6 border-t-4 border-t-[#FF3621] shadow-2xl">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-[#1B3139] uppercase tracking-tighter">Acesso Restrito</h2>
                  <p className="text-xs text-slate-500 font-medium">Preencha os dados oficiais da sua organização.</p>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs font-bold uppercase tracking-tight rounded">
                    {errorMsg}
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Nome</label>
                      <input required className={inputClasses} placeholder="Primeiro Nome" value={formData.firstName} onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Sobrenome</label>
                      <input required className={inputClasses} placeholder="Sobrenome" value={formData.lastName} onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">Empresa</label>
                    <input required className={inputClasses} placeholder="Ex: Databricks, Microsoft, etc" value={formData.company} onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">E-mail Corporativo</label>
                    <input required type="email" className={inputClasses} placeholder="voce@empresa.com" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} />
                  </div>
                  <Button type="submit" className="w-full py-4 mt-4" isLoading={isSubmitting}>
                    Autenticar e Iniciar
                  </Button>
                </form>
              </Card>
            </div>
            <footer className="max-w-4xl mx-auto mt-16 pt-8 border-t border-slate-200">
              <div className="flex flex-col items-center gap-6">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Siga a Databricks</p>
                <div className="flex items-center gap-6">
                  <a
                    href="https://www.linkedin.com/company/databricks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[#1B3139] flex items-center justify-center hover:bg-[#FF3621] transition-colors duration-200 group"
                    aria-label="LinkedIn"
                  >
                    <svg className="w-5 h-5 text-white group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                  </a>
                  <a
                    href="https://x.com/databricks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[#1B3139] flex items-center justify-center hover:bg-[#FF3621] transition-colors duration-200 group"
                    aria-label="X"
                  >
                    <svg className="w-5 h-5 text-white group-hover:text-white" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M84.25 30.25H97.0833L72.0833 59.2L100 89.75H79.125L61.6583 69.5667L41.75 89.75H28.9167L55.7917 59.6583L28 30.25H49.25L65.0417 48.2875L84.25 30.25ZM80.625 84.0083H86.25L48.5417 35.6167H42.5417L80.625 84.0083Z"
                        fill="currentColor"
                      />
                    </svg>
                  </a>
                  <a
                    href="https://www.youtube.com/c/Databricks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[#1B3139] flex items-center justify-center hover:bg-[#FF3621] transition-colors duration-200 group"
                    aria-label="YouTube"
                  >
                    <svg className="w-5 h-5 text-white group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                  </a>
                  <a
                    href="https://www.facebook.com/databricksinc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[#1B3139] flex items-center justify-center hover:bg-[#FF3621] transition-colors duration-200 group"
                    aria-label="Facebook"
                  >
                    <svg className="w-5 h-5 text-white group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </a>
                  <a
                    href="https://www.instagram.com/databricks_br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-full bg-[#1B3139] flex items-center justify-center hover:bg-[#FF3621] transition-colors duration-200 group"
                    aria-label="Instagram"
                  >
                    <svg className="w-5 h-5 text-white group-hover:text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                  </a>
                </div>
              </div>
            </footer>
          </>
        );

      case 'contact':
        return (
          <div className="max-w-3xl mx-auto py-12 px-4 space-y-8">
            <Card className="p-8 md:p-10 shadow-2xl border-t-4 border-t-[#FF3621] bg-white">
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  Fale com a equipe
                </span>
                <h1 className="text-3xl md:text-4xl font-extrabold text-[#1B3139] leading-tight uppercase tracking-tight">
                  Dúvidas, sugestões ou feedbacks
                </h1>
                <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                  Este espaço é dedicado para que você possa compartilhar impressões sobre o simulado, sugerir novas questões,
                  reportar problemas ou tirar qualquer dúvida relacionada ao <span className="font-bold">Certification PrepCamp</span>.
                </p>
              </div>

              <div className="mt-8 grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.25em]">
                    Canal oficial
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Entre em contato diretamente por e-mail. Responderemos o mais rápido possível, priorizando participantes
                    que estejam em preparação ativa para certificações Databricks.
                  </p>
                  <a
                    href="mailto:pedro.ramos@databricks.com?subject=Certification%20PrepCamp%20-%20D%C3%BAvidas%20e%20Feedbacks"
                    className="inline-flex items-center gap-2 text-sm font-bold text-[#FF3621] hover:text-[#E6311D] underline underline-offset-4 decoration-[#FF3621]"
                  >
                    pedro.ramos@databricks.com
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M17 8l4 4m0 0l-4 4m4-4H3"
                      />
                    </svg>
                  </a>
                </div>

                <div className="space-y-4">
                  <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.25em]">
                    Como podemos ajudar?
                  </h2>
                  <div className="space-y-3 text-xs text-slate-600">
                    <p className="font-semibold text-slate-700">Alguns exemplos de temas:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Correções ou melhorias em questões do simulado</li>
                      <li>Sugestão de novos tópicos ou categorias</li>
                      <li>Dúvidas sobre interpretação das respostas e explicações</li>
                      <li>Problemas técnicos na plataforma (acesso, performance, etc.)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        );

      case 'faq':
        return (
          <div className="max-w-3xl mx-auto py-12 px-4 space-y-8">
            <Card className="p-8 md:p-10 shadow-2xl border-t-4 border-t-[#1B3139] bg-white">
              <div className="space-y-4 mb-6">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  Perguntas Frequentes
                </span>
                <h1 className="text-3xl md:text-4xl font-extrabold text-[#1B3139] leading-tight uppercase tracking-tight">
                  FAQ do Certification PrepCamp
                </h1>
                <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                  Reunimos as dúvidas mais comuns sobre o funcionamento do simulado e sobre como ele pode apoiar sua jornada
                  de certificação Databricks.
                </p>
              </div>

              <div className="space-y-4">
                <details className="group border border-slate-100 rounded-md px-4 py-3 bg-slate-50">
                  <summary className="flex items-center justify-between cursor-pointer gap-4">
                    <span className="text-sm font-semibold text-[#1B3139] flex-1">
                      O simulado é uma prova oficial de certificação Databricks?
                    </span>
                    <span className="text-xs font-black text-[#FF3621] uppercase tracking-[0.2em] whitespace-nowrap flex items-center gap-2">
                      <span className="group-open:hidden">Ver resposta</span>
                      <span className="hidden group-open:inline-flex items-center gap-1">
                        Fechar
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </span>
                    </span>
                  </summary>
                  <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                    Não. Este simulado é uma ferramenta de apoio e preparação, inspirada no formato e na complexidade das
                    certificações Databricks, mas não substitui nem representa um exame oficial.
                  </div>
                </details>

                <details className="group border border-slate-100 rounded-md px-4 py-3 bg-slate-50">
                  <summary className="flex items-center justify-between cursor-pointer gap-4">
                    <span className="text-sm font-semibold text-[#1B3139] flex-1">
                      Quantas vezes posso realizar o simulado?
                    </span>
                    <span className="text-xs font-black text-[#FF3621] uppercase tracking-[0.2em] whitespace-nowrap flex items-center gap-2">
                      <span className="group-open:hidden">Ver resposta</span>
                      <span className="hidden group-open:inline-flex items-center gap-1">
                        Fechar
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </span>
                    </span>
                  </summary>
                  <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                    O fluxo padrão considera uma tentativa única por usuário para o conjunto atual de questões, de forma a
                    refletir melhor seu nível de preparo em um cenário próximo ao de prova. Novos conjuntos de questões podem
                    ser disponibilizados periodicamente.
                  </div>
                </details>

                <details className="group border border-slate-100 rounded-md px-4 py-3 bg-slate-50">
                  <summary className="flex items-center justify-between cursor-pointer gap-4">
                    <span className="text-sm font-semibold text-[#1B3139] flex-1">
                      Os resultados são compartilhados com minha liderança ou com a Databricks?
                    </span>
                    <span className="text-xs font-black text-[#FF3621] uppercase tracking-[0.2em] whitespace-nowrap flex items-center gap-2">
                      <span className="group-open:hidden">Ver resposta</span>
                      <span className="hidden group-open:inline-flex items-center gap-1">
                        Fechar
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </span>
                    </span>
                  </summary>
                  <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                    Os resultados são utilizados principalmente para fins internos de análise de aderência do conteúdo e para
                    apoiar planos de desenvolvimento. Caso exista algum compartilhamento adicional (por exemplo, em programas
                    específicos com clientes), isso será sempre comunicado previamente.
                  </div>
                </details>

                <details className="group border border-slate-100 rounded-md px-4 py-3 bg-slate-50">
                  <summary className="flex items-center justify-between cursor-pointer gap-4">
                    <span className="text-sm font-semibold text-[#1B3139] flex-1">
                      Este simulado cobre qual certificação Databricks?
                    </span>
                    <span className="text-xs font-black text-[#FF3621] uppercase tracking-[0.2em] whitespace-nowrap flex items-center gap-2">
                      <span className="group-open:hidden">Ver resposta</span>
                      <span className="hidden group-open:inline-flex items-center gap-1">
                        Fechar
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </span>
                    </span>
                  </summary>
                  <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                    O foco principal é a certificação Data Engineer Associate. Simulados para outras certificações serão disponibilizados no futuro.
                  </div>
                </details>

                <details className="group border border-slate-100 rounded-md px-4 py-3 bg-slate-50">
                  <summary className="flex items-center justify-between cursor-pointer gap-4">
                    <span className="text-sm font-semibold text-[#1B3139] flex-1">
                      Como devo interpretar meu resultado no relatório de performance?
                    </span>
                    <span className="text-xs font-black text-[#FF3621] uppercase tracking-[0.2em] whitespace-nowrap flex items-center gap-2">
                      <span className="group-open:hidden">Ver resposta</span>
                      <span className="hidden group-open:inline-flex items-center gap-1">
                        Fechar
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </span>
                    </span>
                  </summary>
                  <div className="mt-3 text-sm text-slate-600 leading-relaxed">
                    Use o percentual geral como um termômetro do seu nível de preparo e, principalmente, observe a performance
                    por categoria. As áreas com menor aproveitamento indicam onde focar os estudos antes de agendar a prova
                    oficial.
                  </div>
                </details>
              </div>
            </Card>
          </div>
        );

      case 'exam':
        const currentQuestion = questions[currentQuestionIndex];
        const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

        return (
          <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">
            <div className="sticky top-[72px] bg-slate-50 py-4 z-10 border-b border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black text-[#1B3139] uppercase tracking-[0.2em]">
                  Questão: {currentQuestionIndex + 1} / {questions.length}
                </span>
                <span className="text-xs font-black text-[#FF3621]">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                <div className="h-full bg-[#FF3621] transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <QuestionView
              question={currentQuestion}
              selectedOptionId={answers[currentQuestion._id]}
              onSelectOption={(optionId) => handleSelectOption(currentQuestion._id, optionId)}
            />

            <div className="flex items-center justify-between pt-8 border-t border-slate-200">
              <Button variant="outline" onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))} disabled={currentQuestionIndex === 0}>
                Anterior
              </Button>
              <Button onClick={handleNext} disabled={!answers[currentQuestion._id]} isLoading={isSubmitting}>
                {currentQuestionIndex === questions.length - 1 ? 'Finalizar Simulado' : 'Próxima Questão'}
              </Button>
            </div>
          </div>
        );

      case 'results':
        if (!finalResult) return null;
        const percentage = Math.round((finalResult.score / finalResult.totalQuestions) * 100);
        const passed = percentage >= 70;

        return (
          <div className="max-w-4xl mx-auto py-12 px-4 space-y-12 animate-in fade-in duration-500">
            <Card className="overflow-hidden border-t-8 border-t-[#1B3139] shadow-2xl bg-white">
              <div className="p-10">
                <div className="text-center space-y-2 mb-8">
                  <h2 className="text-3xl font-black text-[#1B3139] uppercase tracking-tighter">Relatório de Performance</h2>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm font-bold text-slate-500">{user?.firstName} {user?.lastName}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                    <span className="text-sm font-bold text-[#FF3621] uppercase">{user?.company}</span>
                  </div>
                </div>

                {/* Donut Chart and Category Charts Side by Side */}
                {(() => {
                  // Group answers by category and calculate stats
                  const categoryStats = finalResult.answers.reduce((acc, answer) => {
                    const category = answer.category || 'Sem Categoria';
                    if (!acc[category]) {
                      acc[category] = { correct: 0, total: 0 };
                    }
                    acc[category].total++;
                    if (answer.isCorrect) {
                      acc[category].correct++;
                    }
                    return acc;
                  }, {} as Record<string, { correct: number; total: number }>);

                  const categories = Object.entries(categoryStats).sort((a: [string, { correct: number; total: number }], b: [string, { correct: number; total: number }]) => {
                    // Sort by percentage descending, then by category name
                    const percentageA = a[1].total > 0 ? a[1].correct / a[1].total : 0;
                    const percentageB = b[1].total > 0 ? b[1].correct / b[1].total : 0;
                    if (percentageA !== percentageB) {
                      return percentageB - percentageA;
                    }
                    return a[0].localeCompare(b[0]);
                  });

                  return (
                    <div className="flex flex-col items-center">
                      {/* Donut Chart Section */}
                      <div className="flex flex-col items-center">
                        <div className="relative w-full max-w-sm h-80 flex items-center justify-center">
                          <ResultsChart score={finalResult.score} total={finalResult.totalQuestions} />
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className={`text-6xl font-black tracking-tighter ${passed ? 'text-green-600' : 'text-[#FF3621]'}`}>
                              {percentage}%
                            </span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mt-1">
                              Aproveitamento
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-6 w-full max-w-2xl mt-8">
                          <div className="text-center p-4 border-r border-slate-100 last:border-0">
                            <div className="text-2xl font-black text-green-600">{finalResult.score}</div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Acertos</div>
                          </div>
                          <div className="text-center p-4 border-r border-slate-100 last:border-0">
                            <div className="text-2xl font-black text-[#FF3621]">{finalResult.totalQuestions - finalResult.score}</div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Erros</div>
                          </div>
                          <div className="text-center p-4">
                            <div className="text-2xl font-black text-[#1B3139]">{finalResult.totalQuestions}</div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total</div>
                          </div>
                        </div>
                      </div>

                      {/* Category Charts Section */}
                      {categories.length > 0 && (
                        <div className="space-y-6 w-full max-w-2xl mt-12">
                          <h3 className="text-base font-black text-[#1B3139] uppercase tracking-widest border-l-4 border-[#FF3621] pl-4">
                            Performance por Categoria
                          </h3>
                          <div className="space-y-6">
                            {categories.map(([category, stats]: [string, { correct: number; total: number }]) => (
                              <CategoryChart
                                key={category}
                                category={category}
                                correct={stats.correct}
                                total={stats.total}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="mt-12 pt-8 border-t border-slate-50 w-full text-center">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-4">Registro de Tentativa Única Concluído</p>
                  <div className="flex justify-center">
                    <Button onClick={() => window.location.reload()} variant="secondary" className="px-12">
                      Voltar ao Início
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            <div className="space-y-6">
              <h3 className="text-xl font-black text-[#1B3139] uppercase tracking-widest border-l-4 border-[#FF3621] pl-4">Revisão do Simulado</h3>
              {finalResult.answers.map((answer, index) => {
                const question = questions.find(q => q._id === answer.questionId)!;
                return (
                  <Card key={answer.questionId} className={`p-8 border-l-4 ${answer.isCorrect ? 'border-l-green-500' : 'border-l-[#FF3621]'} shadow-sm`}>
                    <div className="flex flex-col gap-6">
                      <div className="space-y-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Questão {index + 1}</span>
                        <p className="text-lg font-bold text-[#1B3139] leading-snug" dangerouslySetInnerHTML={{ __html: question.enunciado }} />
                      </div>

                      {answer.isCorrect && (
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-sm">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sua Resposta</span>
                            <span className="font-bold text-slate-700">{question.options.find(o => o.id === answer.selectedOptionId)?.text || 'Nenhuma'}</span>
                            {question.options.find(o => o.id === answer.selectedOptionId)?.imageUrl && (
                              <img
                                src={question.options.find(o => o.id === answer.selectedOptionId)?.imageUrl}
                                alt={question.options.find(o => o.id === answer.selectedOptionId)?.text}
                              />
                            )}
                          </div>
                        </div>
                      )}
                      {!answer.isCorrect && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 border border-slate-100 rounded-sm">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sua Resposta</span>
                            <span className="font-bold text-slate-700">{question.options.find(o => o.id === answer.selectedOptionId)?.text}</span>
                            {question.options.find(o => o.id === answer.selectedOptionId)?.imageUrl && (
                              <img
                                src={question.options.find(o => o.id === answer.selectedOptionId)?.imageUrl}
                                alt={question.options.find(o => o.id === answer.selectedOptionId)?.text}
                              />
                            )}
                          </div>
                          <div className="p-4 bg-green-50 border border-green-100 rounded-sm">
                            <span className="block text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">Gabarito Oficial</span>
                            <span className="font-black text-green-800">{question.options.find(o => o.id === question.correctOptionId)?.text}</span>
                            {question.options.find(o => o.id === answer.selectedOptionId)?.imageUrl && (
                              <img
                                src={question.options.find(o => o.id === answer.selectedOptionId)?.imageUrl}
                                alt={question.options.find(o => o.id === answer.selectedOptionId)?.text}
                              />
                            )}
                          </div>
                        </div>
                      )}

                      <div className="pt-2">
                        <details className="group" aria-labelledby={`explanation-toggle-${question._id}`}>
                          <summary
                            id={`explanation-toggle-${question._id}`}
                            className="cursor-pointer text-[#FF3621] hover:text-[#E6311D] font-black text-[10px] uppercase tracking-widest flex items-center gap-2 select-none transition-all focus:outline-none"
                          >
                            Ver Explicação
                            <svg
                              className="w-4 h-4 transform group-open:translate-x-1 transition-transform"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M17 8l4 4m0 0l-4 4m4-4H3"
                              />
                            </svg>
                          </summary>
                          <div className="mt-4 p-6 bg-[#1B3139] text-white rounded-sm border-l-4 border-[#FF3621] space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-3 text-[#FF3621]">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            </div>
                            <p className="text-slate-200 text-sm leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: question.explanation }}></p>
                          </div>
                        </details>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <nav className="bg-[#1B3139] text-white px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-xl border-b border-slate-800">
        <div className="flex items-center gap-2 md:gap-4 cursor-pointer" onClick={() => setState('register')}>
          <div className="w-32 h-8 md:w-64 md:h-16 flex items-center justify-center">
            <img
              src="public/databricks-logo.svg"
              alt="Databricks Logo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-6">
          <button
            type="button"
            onClick={() => setState('register')}
            className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors"
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => setState('faq')}
            className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors"
          >
            FAQ
          </button>
          <button
            type="button"
            onClick={() => setState('contact')}
            className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors"
          >
            Contato
          </button>
          {user && (
            <div className="flex items-center gap-4">
              <div className="hidden md:block text-right">
                <p className="text-[9px] font-black text-[#FF3621] uppercase tracking-[0.2em]">{user.company}</p>
                <p className="text-xs font-black uppercase tracking-tight">{user.firstName} {user.lastName}</p>
              </div>
              <div className="w-9 h-9 rounded-sm bg-[#FF3621] flex items-center justify-center font-black text-xs text-white">
                {user.firstName[0]}{user.lastName[0]}
              </div>
            </div>
          )}
        </div>
      </nav>
      <main className="container mx-auto">
        {renderContent()}
      </main>

      {state === 'exam' && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-3 px-6 md:hidden shadow-2xl z-50">
          <div className="flex justify-between items-center max-w-lg mx-auto">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Q{currentQuestionIndex + 1} DE {questions.length}</span>
            <Button size="sm" onClick={handleNext} disabled={!answers[questions[currentQuestionIndex].id]}>
              Avançar
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;
