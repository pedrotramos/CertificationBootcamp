
import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AppState, User, Question, ExamResult, Answers } from './types';
import { dbService } from './services/dbService';
// import { geminiService } from './services/geminiService';
import Button from './components/Button';
import Card from './components/Card';
import QuestionView from './components/QuestionView';
import ResultsChart from './components/ResultsChart';
import CategoryChart from './components/CategoryChart';
import Admin from './components/Admin';

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

// Whitelisted emails that bypass domain validation
const WHITELISTED_EMAILS = [
  "alcioneroveri@gmail.com",
  "alinebpamplona@gmail.com",
  "amandinharodriguescruz@gmail.com",
  "anagatcavalcante@gmail.com",
  "ariany.ramos.ultra@gmail.com",
  "brunabatistavelloso@gmail.com",
  "carool1307@gmail.com",
  "daiane.mpereira@gmail.com",
  "drcdoimo@gmail.com",
  "ericaestat@gmail.com",
  "ems.erikamedeiros@gmail.com",
  "estela.polverini@gmail.com",
  "ethelbeluzzi@gmail.com",
  "fdiasguima@gmail.com",
  "gabibraga1014@gmail.com",
  "wallgiu@gmail.com",
  "greyce.cos.sil@gmail.com",
  "huaragois@gmail.com",
  "jaque.orizzo@gmail.com",
  "jessica.jc.2010@gmail.com",
  "juliafernand3s@gmail.com",
  "leila.sousa@ambevtech.com.br",
  "lucianawlr@gmail.com",
  "maiyuri.martins.17@gmail.com",
  "manuela.castilla@gmail.com",
  "marcela.bsbcel@gmail.com",
  "thaisal.estudo@gmail.com",
  "raquelcldba@gmail.com",
  "thaisleticiaamaral@gmail.com",
  "thalitasisnandes1@gmail.com",
  "vanessaorsigordo@gmail.com",
  "leticiaflores.pinho@gmail.com"
];

// Helper functions to manage exam progress in localStorage
const EXAM_PROGRESS_KEY = 'examProgress';
const SELECTED_EXAM_KEY = 'selectedExam';
const EXAM_TIMER_KEY = 'examTimer';

const EXAM_DURATION_MS = 90 * 60 * 1000; // 90 minutes in milliseconds

interface ExamProgress {
  answers: Answers;
  currentQuestionIndex: number;
  userId: string;
}

interface ExamTimer {
  startTime: number;
  elapsedWhenPaused: number;
  isPaused: boolean;
  lastPauseTime: number | null;
  userId: string;
  examId: string;
}

function saveExamProgress(answers: Answers, currentQuestionIndex: number, userId: string): void {
  const progress: ExamProgress = {
    answers,
    currentQuestionIndex,
    userId
  };
  localStorage.setItem(EXAM_PROGRESS_KEY, JSON.stringify(progress));
}

function loadExamProgress(userId: string): { answers: Answers; currentQuestionIndex: number } | null {
  try {
    const stored = localStorage.getItem(EXAM_PROGRESS_KEY);
    if (!stored) return null;

    const progress: ExamProgress = JSON.parse(stored);
    if (progress.userId !== userId) return null;

    return {
      answers: progress.answers,
      currentQuestionIndex: progress.currentQuestionIndex
    };
  } catch {
    return null;
  }
}

function clearExamProgress(): void {
  localStorage.removeItem(EXAM_PROGRESS_KEY);
}

function initializeExamTimer(userId: string, examId: string): ExamTimer {
  const now = Date.now();
  return {
    startTime: now,
    elapsedWhenPaused: 0,
    isPaused: false,
    lastPauseTime: null,
    userId,
    examId
  };
}

function loadExamTimer(userId: string, examId: string): ExamTimer | null {
  try {
    const stored = localStorage.getItem(EXAM_TIMER_KEY);
    if (!stored) return null;

    const timer: ExamTimer = JSON.parse(stored);
    if (timer.userId !== userId || timer.examId !== examId) return null;

    return timer;
  } catch {
    return null;
  }
}

function saveExamTimer(timer: ExamTimer): void {
  localStorage.setItem(EXAM_TIMER_KEY, JSON.stringify(timer));
}

function clearExamTimer(): void {
  localStorage.removeItem(EXAM_TIMER_KEY);
}

function getRemainingTime(timer: ExamTimer): number {
  if (timer.isPaused) {
    return Math.max(0, EXAM_DURATION_MS - timer.elapsedWhenPaused);
  }

  const now = Date.now();
  const elapsed = timer.elapsedWhenPaused + (now - timer.startTime);
  return Math.max(0, EXAM_DURATION_MS - elapsed);
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

const App: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [user, setUser] = useState<User | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // Stores the selected option ID for each question by question ID
  // Each entry represents the user's answer choice when they interacted with that question
  const [answers, setAnswers] = useState<Answers>({});
  const [finalResult, setFinalResult] = useState<ExamResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpValidated, setOtpValidated] = useState(false);
  const [isValidatingOtp, setIsValidatingOtp] = useState(false);
  const [availableExams, setAvailableExams] = useState<string[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [hasResults, setHasResults] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [examTimer, setExamTimer] = useState<ExamTimer | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(EXAM_DURATION_MS);
  const [isTimeExpired, setIsTimeExpired] = useState<boolean>(false);
  const examTimerRef = useRef<ExamTimer | null>(null);

  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', company: '' });

  useEffect(() => {
    const loadExams = async () => {
      try {
        const exams = await dbService.getExams();
        setAvailableExams(exams);
      } catch (err) {
        console.error('Error loading exams:', err);
      }
    };
    loadExams();

    // Check authentication status
    const validatedEmail = localStorage.getItem('validatedEmail');
    setIsAuthenticated(!!validatedEmail);

    // Check for existing session when app loads
    checkExistingSession();
  }, []);

  // Check for existing session when navigating to home page (only if no user is set)
  useEffect(() => {
    if (location.pathname === '/' && !user) {
      checkExistingSession();
    }
  }, [location.pathname, user]);

  // Load questions when entering exam page
  useEffect(() => {
    const loadQuestionsForExam = async () => {
      if (location.pathname === '/exam' && user) {
        const examToUse = selectedExam || localStorage.getItem(SELECTED_EXAM_KEY) || '';
        if (!examToUse) {
          setErrorMsg('Por favor, selecione uma prova antes de iniciar.');
          navigate('/');
          return;
        }
        if (!selectedExam && examToUse) {
          setSelectedExam(examToUse);
        }
        try {
          const q = await dbService.getQuestions(examToUse);
          setQuestions(q);
        } catch (err) {
          console.error('Error loading questions:', err);
          setErrorMsg('Erro ao carregar as perguntas. Tente novamente.');
        }
      }
    };
    loadQuestionsForExam();
  }, [location.pathname, user, selectedExam, navigate]);

  // Load exam progress when entering exam page
  useEffect(() => {
    if (location.pathname === '/exam' && user && questions.length > 0) {
      const progress = loadExamProgress(user._id?.toString() || '');
      if (progress) {
        setAnswers(progress.answers);
        setCurrentQuestionIndex(progress.currentQuestionIndex);
      }
    }
  }, [location.pathname, user, questions]);

  // Save exam progress whenever answers or currentQuestionIndex changes (only during exam)
  useEffect(() => {
    if (location.pathname === '/exam' && user && Object.keys(answers).length > 0) {
      saveExamProgress(answers, currentQuestionIndex, user._id?.toString() || '');
    }
  }, [answers, currentQuestionIndex, location.pathname, user]);

  // Initialize or resume timer when entering exam page
  useEffect(() => {
    if (location.pathname === '/exam' && user && selectedExam && questions.length > 0) {
      const userId = user._id?.toString() || '';
      const examId = selectedExam;

      // Try to load existing timer
      let timer = loadExamTimer(userId, examId);

      if (!timer) {
        // Initialize new timer
        timer = initializeExamTimer(userId, examId);
        saveExamTimer(timer);
      } else if (timer.isPaused) {
        // Resume timer - set new start time
        const now = Date.now();
        timer.startTime = now;
        timer.isPaused = false;
        timer.lastPauseTime = null;
        saveExamTimer(timer);
      }

      setExamTimer(timer);
      examTimerRef.current = timer;
      const remaining = getRemainingTime(timer);
      setRemainingTime(remaining);
      setIsTimeExpired(remaining <= 0);
    } else if (location.pathname !== '/exam' && examTimer && !examTimer.isPaused) {
      // Pause timer when leaving exam page
      const now = Date.now();
      const currentElapsed = examTimer.elapsedWhenPaused + (now - examTimer.startTime);
      const updatedTimer: ExamTimer = {
        ...examTimer,
        isPaused: true,
        lastPauseTime: now,
        elapsedWhenPaused: currentElapsed,
        startTime: now // Update startTime for consistency
      };
      saveExamTimer(updatedTimer);
      setExamTimer(updatedTimer);
      examTimerRef.current = updatedTimer;
    }
  }, [location.pathname, user, selectedExam, questions.length]);

  // Sync ref with timer state
  useEffect(() => {
    examTimerRef.current = examTimer;
  }, [examTimer]);

  // Update timer every second when on exam page
  useEffect(() => {
    if (location.pathname !== '/exam' || !examTimer || examTimer.isPaused || isTimeExpired) {
      return;
    }

    const interval = setInterval(() => {
      const currentTimer = examTimerRef.current;
      if (!currentTimer || currentTimer.isPaused) return;

      const remaining = getRemainingTime(currentTimer);
      setRemainingTime(remaining);

      if (remaining <= 0) {
        setIsTimeExpired(true);
        clearInterval(interval);
        // Auto-submit exam when time expires
        if (user && questions.length > 0) {
          finishExam();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [location.pathname, examTimer?.isPaused, isTimeExpired, user, questions.length]);

  // Check if user has results when user and exam are available
  useEffect(() => {
    const checkUserResults = async () => {
      if (user && selectedExam) {
        try {
          const results = await dbService.getUserResults(user._id.toString(), selectedExam);
          setHasResults(results.length > 0);
        } catch (err) {
          console.error('Error checking user results:', err);
          setHasResults(false);
        }
      } else if (user && !selectedExam) {
        // Try to get exam from localStorage
        const examFromStorage = localStorage.getItem(SELECTED_EXAM_KEY);
        if (examFromStorage) {
          setSelectedExam(examFromStorage);
          try {
            const results = await dbService.getUserResults(user._id.toString(), examFromStorage);
            setHasResults(results.length > 0);
          } catch (err) {
            console.error('Error checking user results:', err);
            setHasResults(false);
          }
        } else {
          setHasResults(false);
        }
      } else {
        setHasResults(false);
      }
    };
    checkUserResults();
  }, [user, selectedExam]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const checkExistingSession = async () => {
    try {
      const validatedEmail = localStorage.getItem('validatedEmail');
      if (validatedEmail) {
        // User has validated OTP before - check their status
        const existingUser = await dbService.getUserByEmail(validatedEmail);
        if (existingUser) {
          setUser(existingUser);
          setIsAuthenticated(true);
          // Pre-fill form with user data
          setFormData({
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            email: existingUser.email,
            company: existingUser.company
          });

          // Check if they've taken the test
          // Get exam from localStorage first
          const savedExam = localStorage.getItem(SELECTED_EXAM_KEY);
          if (savedExam) {
            setSelectedExam(savedExam);
            const results = await dbService.getUserResults(existingUser._id.toString(), savedExam);
            if (results.length > 0) {
              // User has taken the test - go to results
              setHasResults(true);
              const questions = await dbService.getAnsweredQuestions(existingUser._id.toString(), savedExam);
              setQuestions(questions);
              setFinalResult(results[0]);
              navigate('/results');
            } else {
              // User hasn't taken the test - stay on home page to select exam
              setHasResults(false);
              // Don't navigate to exam automatically, user needs to select an exam first
            }
          } else {
            // No saved exam - user needs to select an exam first
            setHasResults(false);
            // User hasn't taken the test - stay on home page to select exam
          }
          return true; // Session found and restored
        } else {
          // User not found - clear invalid session
          localStorage.removeItem('validatedEmail');
          setIsAuthenticated(false);
        }
      }
      return false; // No session found
    } catch (err) {
      console.error('Error checking existing session:', err);
      // Clear invalid session
      localStorage.removeItem('validatedEmail');
      setIsAuthenticated(false);
      return false;
    }
  };

  const handleLogoClick = () => {
    setIsMobileMenuOpen(false);
    navigate('/');
  };

  const handleGoHome = async () => {
    setIsMobileMenuOpen(false);
    // Check if user has an existing session
    const hasSession = await checkExistingSession();
    if (!hasSession) {
      // No session - go to home page
      navigate('/');
      // Reset OTP state
      setOtpSent(false);
      setOtpValidated(false);
      setOtp('');
      setErrorMsg(null);
    }
    // If hasSession is true, checkExistingSession already navigated to the appropriate page
  };

  const handleNavigateToResults = async () => {
    setIsMobileMenuOpen(false);
    if (!user || !selectedExam) return;
    try {
      const examToUse = selectedExam || localStorage.getItem(SELECTED_EXAM_KEY) || '';
      if (!examToUse) {
        navigate('/');
        return;
      }
      const results = await dbService.getUserResults(user._id.toString(), examToUse);
      if (results.length > 0) {
        const questions = await dbService.getAnsweredQuestions(user._id.toString(), examToUse);
        setQuestions(questions);
        setFinalResult(results[0]);
        navigate('/results');
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Error navigating to results:', err);
      navigate('/');
    }
  };

  const handleNavigateToExam = () => {
    setIsMobileMenuOpen(false);
    if (!user || !selectedExam) {
      navigate('/');
      return;
    }
    navigate('/exam');
  };

  const handleLogout = () => {
    // Clear session from localStorage
    localStorage.removeItem('validatedEmail');
    localStorage.removeItem(SELECTED_EXAM_KEY);

    // Reset all user-related state
    setUser(null);
    setOtpSent(false);
    setOtpValidated(false);
    setOtp('');
    setErrorMsg(null);
    setAnswers({});
    setFinalResult(null);
    setCurrentQuestionIndex(0);
    setSelectedExam('');
    setQuestions([]);
    setHasResults(false);
    setIsAuthenticated(false);

    // Reset form data
    setFormData({ firstName: '', lastName: '', email: '', company: '' });

    // Clear exam progress
    clearExamProgress();

    // Clear exam timer
    clearExamTimer();
    setExamTimer(null);
    examTimerRef.current = null;
    setRemainingTime(EXAM_DURATION_MS);
    setIsTimeExpired(false);

    // Navigate to home page
    navigate('/');
  };

  const validateEmail = (email: string, isWhitelisted: boolean): { isValid: boolean; message: string | null } => {
    const emailLower = email.toLowerCase().trim();
    if (!emailLower) return { isValid: false, message: 'O e-mail é obrigatório.' };

    // Check if email is in the whitelist - if so, bypass all domain validation
    if (WHITELISTED_EMAILS.includes(emailLower)) {
      return { isValid: true, message: null };
    }

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

    // If user is already authenticated, just update exam and proceed
    if (isAuthenticated && user) {
      if (!selectedExam) {
        setErrorMsg('Por favor, selecione uma prova antes de continuar.');
        return;
      }
      // Save selected exam to localStorage
      localStorage.setItem(SELECTED_EXAM_KEY, selectedExam);
      // Check if user has results for this exam
      try {
        const results = await dbService.getUserResults(user._id.toString(), selectedExam);
        if (results.length > 0) {
          setHasResults(true);
          const questions = await dbService.getAnsweredQuestions(user._id.toString(), selectedExam);
          setQuestions(questions);
          setFinalResult(results[0]);
          navigate('/results');
        } else {
          setHasResults(false);
          navigate('/exam');
        }
      } catch (err) {
        console.error('Error checking results:', err);
        navigate('/exam');
      }
      return;
    }

    // If OTP is already validated, proceed with registration
    if (otpValidated) {
      await proceedWithRegistration();
      return;
    }

    // If OTP is not sent yet, validate email and generate OTP
    if (!otpSent) {
      if (!selectedExam) {
        setErrorMsg('Por favor, selecione uma prova antes de continuar.');
        return;
      }

      const emailLower = formData.email.toLowerCase().trim();
      const isEmailWhitelisted = WHITELISTED_EMAILS.includes(emailLower);

      // Skip domain check for whitelisted emails
      let domainCheck: { whitelisted: boolean; company?: string };
      if (isEmailWhitelisted) {
        domainCheck = { whitelisted: true };
      } else {
        domainCheck = await dbService.checkDomain(formData.email);
      }

      // Store company from domain check (will be used when saving user)
      if (domainCheck.company) {
        setFormData(prev => ({ ...prev, company: domainCheck.company! }));
      }

      const emailValidation = validateEmail(formData.email, domainCheck.whitelisted);
      if (!emailValidation.isValid) {
        setErrorMsg(emailValidation.message);
        return;
      }

      setIsSubmitting(true);
      try {
        await dbService.generateOTP(formData.email);
        setOtpSent(true);
      } catch (err) {
        setErrorMsg('Ocorreu um erro ao gerar o código de verificação. Tente novamente.');
        console.error(err);
      } finally {
        setIsSubmitting(false);
      }
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
      const result = await dbService.validateOTP(formData.email, otp);
      if (result.valid) {
        setOtpValidated(true);
        // Clear error messages and proceed immediately to exam or results
        setErrorMsg(null);
        // Proceed with registration - this will navigate to exam or results
        await proceedWithRegistration();
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

  const proceedWithRegistration = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      // Store validated email in localStorage for session persistence
      localStorage.setItem('validatedEmail', formData.email);
      setIsAuthenticated(true);

      // Check if user already exists
      const existingUser = await dbService.getUserByEmail(formData.email);

      if (existingUser) {
        // User exists - check if they've taken the test
        // Get exam from selectedExam or localStorage
        const examToUse = selectedExam || localStorage.getItem(SELECTED_EXAM_KEY) || '';
        if (!examToUse) {
          setErrorMsg('Por favor, selecione uma prova antes de continuar.');
          setIsSubmitting(false);
          return;
        }
        if (!selectedExam && examToUse) {
          setSelectedExam(examToUse);
        }

        const results = await dbService.getUserResults(existingUser._id.toString(), examToUse);

        if (results.length > 0) {
          // User has already taken the test - show results page
          setHasResults(true);
          // Fetch answered questions for the selected exam
          const questions = await dbService.getAnsweredQuestions(existingUser._id.toString(), examToUse);
          setQuestions(questions);
          setUser(existingUser);
          setFinalResult(results[0]);
          setIsSubmitting(false);
          navigate('/results');
          return;
        } else {
          setHasResults(false);
        }

        // User exists but hasn't taken the test - proceed to exam
        if (!selectedExam) {
          setErrorMsg('Por favor, selecione uma prova antes de continuar.');
          setIsSubmitting(false);
          return;
        }
        // Save selected exam to localStorage
        localStorage.setItem(SELECTED_EXAM_KEY, selectedExam);
        setUser(existingUser);
        setHasResults(false);
        setIsSubmitting(false);
        navigate('/exam');
      } else {
        // New user - create account and proceed to exam
        if (!selectedExam) {
          setErrorMsg('Por favor, selecione uma prova antes de continuar.');
          setIsSubmitting(false);
          return;
        }
        // Save selected exam to localStorage
        localStorage.setItem(SELECTED_EXAM_KEY, selectedExam);
        const newUser = await dbService.saveUser(formData);
        setUser(newUser);
        setHasResults(false);
        setIsSubmitting(false);
        navigate('/exam');
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Ocorreu um erro ao processar seu registro. Tente novamente.';
      setErrorMsg(errorMessage);
      console.error('Error in proceedWithRegistration:', err);
      setIsSubmitting(false);
    }
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      // Scroll to top when navigating
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      finishExam();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      // Scroll to top when navigating
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleGoToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentQuestionIndex(index);
      // Scroll to top of question area
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

    const examToUse = selectedExam || localStorage.getItem(SELECTED_EXAM_KEY) || '';

    const result = {
      userId: user._id,
      timestamp: new Date(),
      score,
      totalQuestions: questions.length,
      exam: examToUse,
      answers: examAnswers
    };

    const savedResult = await dbService.saveResult(result);
    setFinalResult(savedResult);
    setHasResults(true);
    clearExamProgress(); // Clear progress after exam is completed
    clearExamTimer(); // Clear timer after exam is completed
    setExamTimer(null);
    examTimerRef.current = null;
    setRemainingTime(EXAM_DURATION_MS);
    setIsTimeExpired(false);
    navigate('/results');
    setIsSubmitting(false);
  };

  const inputClasses = "w-full px-4 py-3 rounded bg-[#1B3139] text-white border border-slate-700 focus:border-[#FF3621] focus:ring-1 focus:ring-[#FF3621] outline-none transition-all placeholder-slate-400";

  const renderContent = () => {
    const path = location.pathname;

    if (path === '/exam') {
      if (questions.length === 0 || !user) {
        navigate('/');
        return null;
      }
      const currentQuestion = questions[currentQuestionIndex];
      if (!currentQuestion) {
        navigate('/');
        return null;
      }
      const progress = (Object.keys(answers).length / questions.length) * 100;

      const timeDisplay = formatTime(remainingTime);
      const timePercentage = (remainingTime / EXAM_DURATION_MS) * 100;
      const isTimeWarning = remainingTime < 15 * 60 * 1000; // Less than 15 minutes
      const isTimeCritical = remainingTime < 5 * 60 * 1000; // Less than 5 minutes

      return (
        <div className="max-w-5xl mx-auto py-8 px-4 space-y-8 overflow-x-hidden">
          <div className="sticky top-[72px] bg-slate-50 py-4 z-10 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black text-[#1B3139] uppercase tracking-[0.2em]">
                Respondidas: {Object.keys(answers).length} / {questions.length}
              </span>
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 ${isTimeCritical ? 'text-red-600' : isTimeWarning ? 'text-orange-600' : 'text-[#1B3139]'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={`text-xs font-black ${isTimeCritical ? 'animate-pulse' : ''}`}>
                    {isTimeExpired ? '00:00' : timeDisplay}
                  </span>
                </div>
                <span className="text-xs font-black text-[#FF3621]">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                <div className="h-full bg-[#FF3621] transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${isTimeCritical ? 'bg-red-600' : isTimeWarning ? 'bg-orange-600' : 'bg-[#1B3139]'}`}
                  style={{ width: `${timePercentage}%` }}
                />
              </div>
            </div>
            {isTimeExpired && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 text-red-600 text-xs font-bold uppercase tracking-tight rounded">
                Tempo esgotado! O simulado será finalizado automaticamente.
              </div>
            )}
          </div>

          <QuestionView
            question={currentQuestion}
            selectedOptionId={answers[currentQuestion._id]}
            onSelectOption={(optionId) => handleSelectOption(currentQuestion._id, optionId)}
          />

          <div className="flex items-center justify-between pt-8 border-t border-slate-200">
            <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0 || isTimeExpired}>
              Anterior
            </Button>
            <div className="flex items-center gap-2">
              {currentQuestionIndex < questions.length - 1 && (
                <Button variant="outline" onClick={handleNext} disabled={isTimeExpired}>
                  Pular
                </Button>
              )}
              <Button onClick={handleNext} disabled={isTimeExpired} isLoading={isSubmitting}>
                {currentQuestionIndex === questions.length - 1 ? 'Finalizar Simulado' : 'Próxima Questão'}
              </Button>
            </div>
          </div>

          {/* Question Pagination */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Navegação de Questões</span>
              <span className="text-[10px] font-black text-slate-500">
                {Object.keys(answers).length} / {questions.length} respondidas
              </span>
            </div>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2">
              {questions.map((q, index) => {
                const isAnswered = !!answers[q._id];
                const isCurrent = index === currentQuestionIndex;
                return (
                  <button
                    key={q._id}
                    onClick={() => handleGoToQuestion(index)}
                    disabled={isTimeExpired}
                    className={`
                      w-9 h-9 sm:w-10 sm:h-10 rounded text-xs font-black transition-all flex items-center justify-center
                      ${isCurrent
                        ? 'bg-[#FF3621] text-white border-2 border-[#FF3621] shadow-[0_0_0_3px_rgba(255,54,33,0.3)] relative z-10'
                        : isAnswered
                          ? 'bg-green-500 text-white hover:bg-green-600 border-2 border-green-600 hover:scale-105 shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-2 border-slate-300 hover:scale-105'
                      }
                      ${isTimeExpired ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                    title={`Questão ${index + 1}${isAnswered ? ' (Respondida)' : ' (Não respondida)'}`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500 border-2 border-green-600"></div>
                <span>Respondida</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-slate-100 border-2 border-slate-300"></div>
                <span>Não Respondida</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#FF3621] border-2 border-[#FF3621] shadow-[0_0_0_2px_rgba(255,54,33,0.3)]"></div>
                <span>Atual</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (path === '/results') {
      if (!finalResult || !user) {
        navigate('/');
        return null;
      }
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
                  <Button onClick={() => navigate('/')} variant="secondary" className="px-12">
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
    }

    if (path === '/contact') {
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
    }

    if (path === '/faq') {
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
    }

    // Default: register/home page
    if (path === '/' || path === '') {
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
                {isAuthenticated && user ? (
                  <>
                    <div className="p-3 bg-green-50 border border-green-200 text-green-600 text-xs font-bold uppercase tracking-tight rounded mb-4">
                      Autenticado como: {user.firstName} {user.lastName}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Prova</label>
                      <select
                        required
                        className={`${inputClasses} cursor-pointer`}
                        value={selectedExam}
                        onChange={(e) => setSelectedExam(e.target.value)}
                      >
                        <option value="" className="bg-[#1B3139] text-white">Selecione uma prova</option>
                        {availableExams.map((exam) => (
                          <option key={exam} value={exam} className="bg-[#1B3139] text-white">
                            {exam}
                          </option>
                        ))}
                      </select>
                      <p className="text-[9px] text-slate-500 mt-1">
                        Selecione a prova que deseja realizar.
                      </p>
                    </div>
                    <Button type="submit" className="w-full py-4 mt-4" isLoading={isSubmitting}>
                      {hasResults ? 'Ver Resultados' : 'Iniciar Prova'}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Nome</label>
                        <input required disabled={otpSent} className={inputClasses} placeholder="Primeiro Nome" value={formData.firstName} onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Sobrenome</label>
                        <input required disabled={otpSent} className={inputClasses} placeholder="Sobrenome" value={formData.lastName} onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">E-mail Corporativo</label>
                      <input
                        required
                        type="email"
                        disabled={otpSent}
                        className={inputClasses}
                        placeholder="voce@empresa.com"
                        value={formData.email}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, email: e.target.value }));
                          // Reset OTP state if email changes
                          if (otpSent) {
                            setOtpSent(false);
                            setOtpValidated(false);
                            setOtp('');
                          }
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">Prova</label>
                      <select
                        required
                        disabled={otpSent}
                        className={`${inputClasses} cursor-pointer`}
                        value={selectedExam}
                        onChange={(e) => setSelectedExam(e.target.value)}
                      >
                        <option value="" className="bg-[#1B3139] text-white">Selecione uma prova</option>
                        {availableExams.map((exam) => (
                          <option key={exam} value={exam} className="bg-[#1B3139] text-white">
                            {exam}
                          </option>
                        ))}
                      </select>
                      <p className="text-[9px] text-slate-500 mt-1">
                        Selecione a prova que deseja realizar.
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
                            Um código de verificação foi enviado para <span className="font-bold">{formData.email}</span>
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={handleValidateOTP}
                          className="w-full py-4 mt-4"
                          isLoading={isValidatingOtp}
                          disabled={!otp.trim()}
                        >
                          {otpValidated ? 'Validado ✓' : 'Validar Código e Iniciar'}
                        </Button>
                      </>
                    )}
                  </>
                )}
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
    }

    // Default: register/home page
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed top-0 right-0 h-full w-64 bg-[#1B3139] text-white transform transition-transform duration-300 ease-in-out z-50 md:hidden ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h2 className="text-sm font-black uppercase tracking-[0.25em]">Menu</h2>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-slate-200 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex flex-col flex-1 overflow-y-auto p-4 space-y-4">
            {user && isAuthenticated ? (
              hasResults ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleNavigateToResults();
                  }}
                  className="text-left text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors py-2"
                >
                  Resultados
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleNavigateToExam();
                  }}
                  className="text-left text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors py-2"
                >
                  Prova
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleGoHome();
                }}
                className="text-left text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors py-2"
              >
                Home
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/faq');
              }}
              className="text-left text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors py-2"
            >
              FAQ
            </button>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                navigate('/contact');
              }}
              className="text-left text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors py-2"
            >
              Contato
            </button>
            {user && (
              <>
                <div className="border-t border-slate-700 pt-4 mt-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-sm bg-[#FF3621] flex items-center justify-center font-black text-xs text-white flex-shrink-0">
                      {user.firstName[0]}{user.lastName[0]}
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <p className="text-[9px] font-black text-[#FF3621] uppercase tracking-[0.2em]">{user.company}</p>
                      <p className="text-xs font-black uppercase tracking-tight">{user.firstName} {user.lastName}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors px-4 py-2 border border-slate-600 hover:border-slate-400 rounded"
                  >
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <nav className="bg-[#1B3139] text-white px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-xl border-b border-slate-800">
        <div className="flex items-center gap-2 md:gap-4 cursor-pointer" onClick={handleLogoClick}>
          <div className="w-32 h-8 md:w-64 md:h-16 flex items-center justify-center">
            <img
              src={`${import.meta.env.BASE_URL}databricks-logo.svg`}
              alt="Databricks Logo"
              className="w-full h-full object-contain"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-6">
          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-slate-200 hover:text-white transition-colors"
            aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
          >
            {isMobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2 md:gap-6">
            {user && isAuthenticated ? (
              hasResults ? (
                <button
                  type="button"
                  onClick={handleNavigateToResults}
                  className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors"
                >
                  Resultados
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNavigateToExam}
                  className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors"
                >
                  Prova
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={handleGoHome}
                className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors"
              >
                Home
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/faq')}
              className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors"
            >
              FAQ
            </button>
            <button
              type="button"
              onClick={() => navigate('/contact')}
              className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors"
            >
              Contato
            </button>
            {user && (
              <div className="flex items-center gap-3 md:gap-4">
                <div className="hidden md:block text-right">
                  <p className="text-[9px] font-black text-[#FF3621] uppercase tracking-[0.2em]">{user.company}</p>
                  <p className="text-xs font-black uppercase tracking-tight">{user.firstName} {user.lastName}</p>
                </div>
                <div className="w-9 h-9 rounded-sm bg-[#FF3621] flex items-center justify-center font-black text-xs text-white">
                  {user.firstName[0]}{user.lastName[0]}
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.25em] text-slate-200 hover:text-white transition-colors px-2 py-1 border border-slate-600 hover:border-slate-400 rounded"
                  title="Sair"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
      <main className="container mx-auto">
        {renderContent()}
      </main>

      {location.pathname === '/exam' && questions.length > 0 && (
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-3 px-6 md:hidden shadow-2xl z-50">
          <div className="flex justify-between items-center max-w-lg mx-auto gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Q{currentQuestionIndex + 1} DE {questions.length}</span>
              <div className={`flex items-center gap-1 ${isTimeExpired || remainingTime < 5 * 60 * 1000 ? 'text-red-600' : remainingTime < 15 * 60 * 1000 ? 'text-orange-600' : 'text-slate-600'}`}>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className={`text-[10px] font-black ${isTimeExpired ? 'animate-pulse' : ''}`}>
                  {isTimeExpired ? '00:00' : formatTime(remainingTime)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentQuestionIndex > 0 && (
                <Button size="sm" variant="outline" onClick={handlePrevious} disabled={isTimeExpired}>
                  ←
                </Button>
              )}
              <Button size="sm" onClick={handleNext} disabled={isTimeExpired}>
                {currentQuestionIndex === questions.length - 1 ? 'Finalizar' : 'Avançar'}
              </Button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

const AppRouter: React.FC = () => {
  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />
      <Route path="/exam" element={<App />} />
      <Route path="/results" element={<App />} />
      <Route path="/contact" element={<App />} />
      <Route path="/faq" element={<App />} />
      <Route path="/" element={<App />} />
    </Routes>
  );
};

export default AppRouter;
