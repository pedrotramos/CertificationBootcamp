
import React, { useState, useEffect } from 'react';
import { AppState, User, Question, ExamResult, Answers } from './types';
import { dbService } from './services/dbService';
// import { geminiService } from './services/geminiService';
import Button from './components/Button';
import Card from './components/Card';
import QuestionView from './components/QuestionView';
import ResultsChart from './components/ResultsChart';

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
      isCorrect: answers[q._id] === q.correctOptionId
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
                  <span className="font-bold text-[#1B3139] uppercase text-sm tracking-tight">Questões atualizadas</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#FF3621]" />
                  <span className="font-bold text-[#1B3139] uppercase text-sm tracking-tight">Explicações das questões</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[#FF3621]" />
                  <span className="font-bold text-[#1B3139] uppercase text-sm tracking-tight">Relatório final completo</span>
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
                  <label className="text-[10px] font-black uppercase text-slate-400">Companhia</label>
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
              <div className="p-10 flex flex-col items-center">
                <div className="text-center space-y-2 mb-8">
                  <h2 className="text-3xl font-black text-[#1B3139] uppercase tracking-tighter">Relatório de Performance</h2>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-sm font-bold text-slate-500">{user?.firstName} {user?.lastName}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                    <span className="text-sm font-bold text-[#FF3621] uppercase">{user?.company}</span>
                  </div>
                </div>

                {/* Centralized Donut Chart with Score Inside */}
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
      <nav className="bg-[#1B3139] text-white px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-xl border-b border-slate-800">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setState('register')}>
          <div className="w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-full h-full text-[#FF3621]">
              <path strokeWidth="3" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-xl font-black tracking-tighter uppercase italic">
            CERTIFICATION <span className="text-[#FF3621]">PREPCAMP</span>
          </span>
        </div>
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
