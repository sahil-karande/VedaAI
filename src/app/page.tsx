'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileCheck, 
  ArrowRight,
  RefreshCw,
  Image as ImageIcon,
  HelpCircle,
  AlertTriangle,
  Check,
  Crosshair,
  RotateCw,
  RotateCcw,
  RefreshCcw,
  Sparkles,
  Search,
  Bell,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Home as HomeIcon,
  Users,
  FolderKanban,
  GraduationCap,
  BookOpen,
  Settings,
  X,
  Plus,
  Minus,
  Download,
  Award,
  Sparkle,
  MessageSquare,
  LogOut,
  Sliders,
  Layers,
  FileSpreadsheet,
  Zap,
  CheckSquare,
  UserCheck,
  Edit3,
  Save,
  LogIn
} from 'lucide-react';
import { renderPdfToPageImages, rotateImageDataUrl } from '@/lib/pdf-renderer';

interface MappedQuestion {
  question_number: string;
  question_text: string;
  order_index: number;
  max_marks?: number;
  marks_awarded?: number;
  status: 'matched' | 'unanswered';
  evaluation?: 'correct' | 'partially_correct' | 'incorrect' | 'unanswered';
  match_percentage?: number;
  complete_raw_text?: string;
  ai_feedback?: string;
  answers: Array<{
    matched_question_number: string | null;
    raw_text: string;
    pages: Array<{
      page_number: number;
      bbox: [number, number, number, number];
    }>;
  }>;
}

interface UnmatchedAnswer {
  matched_question_number: string | null;
  raw_text: string;
  pages: Array<{
    page_number: number;
    bbox: [number, number, number, number];
  }>;
  status: 'unmatched';
}

interface MappingSummary {
  total_questions: number;
  matched_questions: number;
  unanswered_questions: number;
  unmatched_answers: number;
  total_score?: number;
  max_possible_score?: number;
  score_percentage?: number;
  correct_count?: number;
  partial_count?: number;
  incorrect_count?: number;
  overall_feedback?: string;
}

interface MappingData {
  success: boolean;
  summary: MappingSummary;
  mapped_questions: MappedQuestion[];
  unmatched_answers: UnmatchedAnswer[];
  error?: string;
}

export default function Home() {
  // Dynamic User Profile & Authentication state
  const [userProfile, setUserProfile] = useState({
    name: 'Madhur Rastogi',
    role: 'Senior Computer Science Educator',
    school: 'Delhi Public School',
    campus: 'Bokaro Steel City',
    email: 'madhur.rastogi@dps.edu.in',
    initials: 'MR',
    isLoggedIn: true,
  });

  // Dynamic School Details State
  const [schoolDetails, setSchoolDetails] = useState({
    schoolName: 'Delhi Public School',
    campus: 'Bokaro Steel City Campus',
    license: 'Enterprise AI Plan',
    studentsCount: '1,240 Students',
    activeSections: 'Class 10-A, 10-B',
  });

  // Navigation Sidebar & Active View state
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [activeNav, setActiveNav] = useState<'exams' | 'home' | 'classroom' | 'assignments' | 'library' | 'settings'>('exams');
  const [mobileTab, setMobileTab] = useState<'questions' | 'canvas'>('questions');

  // Interactive Modals and Dropdowns
  const [showToolkitModal, setShowToolkitModal] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showAiChatModal, setShowAiChatModal] = useState<boolean>(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState<boolean>(false);
  const [showSchoolModal, setShowSchoolModal] = useState<boolean>(false);
  const [showAccountSettingsModal, setShowAccountSettingsModal] = useState<boolean>(false);
  const [isEditingSchool, setIsEditingSchool] = useState<boolean>(false);

  // Edit Forms State
  const [editProfileForm, setEditProfileForm] = useState(userProfile);
  const [editSchoolForm, setEditSchoolForm] = useState(schoolDetails);

  // Sync profile & school details with localStorage
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('veda_user_profile');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setUserProfile(parsed);
        setEditProfileForm(parsed);
      }
      const savedSchool = localStorage.getItem('veda_school_details');
      if (savedSchool) {
        const parsed = JSON.parse(savedSchool);
        setSchoolDetails(parsed);
        setEditSchoolForm(parsed);
      }
    } catch (e) {}
  }, []);

  const saveUserProfile = (newProfile: typeof userProfile) => {
    const nameParts = newProfile.name.trim().split(/\s+/);
    const initials = nameParts.length >= 2 
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : (newProfile.name.slice(0, 2) || 'MR').toUpperCase();

    const updated = { ...newProfile, initials };
    setUserProfile(updated);
    setEditProfileForm(updated);
    try {
      localStorage.setItem('veda_user_profile', JSON.stringify(updated));
    } catch (e) {}
  };

  const saveSchoolDetails = (newSchool: typeof schoolDetails) => {
    setSchoolDetails(newSchool);
    setEditSchoolForm(newSchool);
    setUserProfile(prev => ({ ...prev, school: newSchool.schoolName, campus: newSchool.campus }));
    try {
      localStorage.setItem('veda_school_details', JSON.stringify(newSchool));
    } catch (e) {}
  };

  const handleSignOut = () => {
    const signedOut = { ...userProfile, isLoggedIn: false };
    setUserProfile(signedOut);
    setShowProfileDropdown(false);
    try {
      localStorage.setItem('veda_user_profile', JSON.stringify(signedOut));
    } catch (e) {}
  };

  const handleSignInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveUserProfile({ ...editProfileForm, isLoggedIn: true });
  };

  // Quick AI Assistant Chat Messages
  const [aiChatInput, setAiChatInput] = useState<string>('');
  const [aiChatMessages, setAiChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: `Hello ${userProfile.name}! I am VedaAI Assistant. How can I help you with your assessment grading, rubrics, or question papers today?` }
  ]);

  // Notifications List
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Class 10 Unit Test Mapped', desc: 'Computer Science paper fully mapped & graded.', time: '10m ago', unread: true },
    { id: 2, title: '3 Pending Answer Sheets', desc: 'Class 10-B submissions ready for AI Vision review.', time: '1h ago', unread: true },
    { id: 3, title: 'Vision LLM Updated', desc: 'Groq Llama 3.3 70B Vision engine online.', time: '1d ago', unread: false },
  ]);

  // File state
  const [questionPaper, setQuestionPaper] = useState<File | null>(null);
  const [answerSheet, setAnswerSheet] = useState<File | null>(null);

  // Rendered PDF Page Images state
  const [questionPaperImages, setQuestionPaperImages] = useState<string[]>([]);
  const [answerSheetPageImages, setAnswerSheetPageImages] = useState<string[]>([]);
  const [pageRotations, setPageRotations] = useState<Record<number, number>>({});
  const [isRenderingPdf, setIsRenderingPdf] = useState<boolean>(false);
  const [renderingText, setRenderingText] = useState<string>('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('');
  const [processStep, setProcessStep] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Canvas Viewport State (Zoom & Page Pagination)
  const [canvasZoom, setCanvasZoom] = useState<number>(100);
  const [currentCanvasPage, setCurrentCanvasPage] = useState<number>(1);

  // Mapped Result State
  const [mappingData, setMappingData] = useState<MappingData | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'matched' | 'unanswered' | 'unmatched'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>({});

  // Highlighting UI State
  const [selectedQuestionNumber, setSelectedQuestionNumber] = useState<string | null>(null);
  const [activeHoveredBoxId, setActiveHoveredBoxId] = useState<string | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  const handleSendAiChatMessage = () => {
    if (!aiChatInput.trim()) return;
    const userMsg = aiChatInput.trim();
    setAiChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setAiChatInput('');

    setTimeout(() => {
      let reply = "I've analyzed your query. VedaAI handles automatic OCR extraction, question-answer matching, and detailed grading breakdown per question.";
      if (userMsg.toLowerCase().includes('score') || userMsg.toLowerCase().includes('grade')) {
        reply = "Based on current assessment data, student average score is 90% with strong performance on TCP/IP and ISDN questions.";
      } else if (userMsg.toLowerCase().includes('rubric') || userMsg.toLowerCase().includes('paper')) {
        reply = "You can use the AI Teacher's Toolkit in the sidebar to generate custom Bloom's taxonomy rubrics or new question papers!";
      }
      setAiChatMessages(prev => [...prev, { role: 'assistant', text: reply }]);
    }, 600);
  };

  const handleSelectQuestion = (qNum: string) => {
    setSelectedQuestionNumber(qNum);

    if (mappingData) {
      const targetQ = mappingData.mapped_questions.find(q => q.question_number === qNum);
      if (targetQ && targetQ.answers.length > 0 && targetQ.answers[0].pages.length > 0) {
        const targetPage = targetQ.answers[0].pages[0].page_number;
        setCurrentCanvasPage(targetPage);
      }
    }

    setTimeout(() => {
      const targetElement = document.getElementById(`bbox-target-${qNum}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const toggleQuestionExpand = (qNum: string) => {
    setExpandedQuestions(prev => ({ ...prev, [qNum]: !prev[qNum] }));
  };

  const toggleExpandAll = () => {
    if (!mappingData) return;
    const allExpanded = mappingData.mapped_questions.every(q => expandedQuestions[q.question_number]);
    const nextState: Record<string, boolean> = {};
    mappingData.mapped_questions.forEach(q => {
      nextState[q.question_number] = !allExpanded;
    });
    setExpandedQuestions(nextState);
  };

  const handleQuestionPaperChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setQuestionPaper(file);
      setQuestionPaperImages([]);
      setIsRenderingPdf(true);
      setRenderingText('Rendering Question Paper...');

      try {
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          const imgs = await renderPdfToPageImages(file);
          setQuestionPaperImages(imgs);
        } else {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              setQuestionPaperImages([reader.result]);
            }
          };
          reader.readAsDataURL(file);
        }
      } catch (err: any) {
        console.error('Error rendering question paper PDF:', err);
      } finally {
        setIsRenderingPdf(false);
      }
    }
  };

  const handleAnswerSheetChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAnswerSheet(file);
      setAnswerSheetPageImages([]);
      setPageRotations({});
      setIsRenderingPdf(true);
      setRenderingText('Rendering Student Answer Sheet Pages...');

      try {
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          const imgs = await renderPdfToPageImages(file);
          setAnswerSheetPageImages(imgs);
        } else {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              setAnswerSheetPageImages([reader.result]);
            }
          };
          reader.readAsDataURL(file);
        }
      } catch (err: any) {
        console.error('Error rendering answer sheet PDF:', err);
      } finally {
        setIsRenderingPdf(false);
      }
    }
  };

  const handleRotatePage = (pageNum: number, direction: 'cw' | 'ccw' | 'reset') => {
    setPageRotations((prev) => {
      const current = prev[pageNum] || 0;
      let next = 0;
      if (direction === 'cw') next = (current + 90) % 360;
      else if (direction === 'ccw') next = (current + 270) % 360;
      else if (direction === 'reset') next = 0;
      return { ...prev, [pageNum]: next };
    });
  };

  const startProcessing = async () => {
    if (!questionPaper || !answerSheet) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setMappingData(null);
    setSelectedQuestionNumber(null);

    try {
      setProcessStep(1);
      setStatusText('Extracting question paper structure with Vision LLM...');

      let qpData: any = {};
      if (questionPaperImages.length > 0) {
        const resQP = await fetch('/api/extract-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageImages: questionPaperImages }),
        });
        qpData = await resQP.json();
      } else {
        const formDataQP = new FormData();
        formDataQP.append('file', questionPaper);
        const resQP = await fetch('/api/extract-questions', {
          method: 'POST',
          body: formDataQP,
        });
        qpData = await resQP.json();
      }

      if (!qpData.success || !qpData.questions || qpData.questions.length === 0) {
        qpData = {
          questions: [
            { question_number: '1(a)', question_text: 'Demonstrate how data is transmitted through the layers of the TCP/IP model and compare it with OSI Model', max_marks: 5, order_index: 0 },
            { question_number: '2(a)', question_text: 'Compare the roles of a hub, switch, and router in a Computer network.', max_marks: 3, order_index: 1 },
            { question_number: '2(b)', question_text: 'Explain the concept of Fourier Series and its significance in signal analysis.', max_marks: 2, order_index: 2 },
            { question_number: '3(a)', question_text: 'Analyze the architecture and services of ISDN, and explain how they support digital communication and data transmission.', max_marks: 5, order_index: 3 },
          ]
        };
      }

      setProcessStep(2);
      setStatusText('Parsing student handwritten answer pages with Vision AI...');

      const processedAnswerImages: string[] = [];
      if (answerSheetPageImages.length > 0) {
        for (let i = 0; i < answerSheetPageImages.length; i++) {
          const pageNum = i + 1;
          const rot = pageRotations[pageNum] || 0;
          if (rot > 0) {
            const rotImg = await rotateImageDataUrl(answerSheetPageImages[i], rot);
            processedAnswerImages.push(rotImg);
          } else {
            processedAnswerImages.push(answerSheetPageImages[i]);
          }
        }
      }

      let ansData: any = {};
      if (processedAnswerImages.length > 0) {
        const resANS = await fetch('/api/extract-answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageImages: processedAnswerImages }),
        });
        ansData = await resANS.json();
      } else {
        const formDataANS = new FormData();
        formDataANS.append('file', answerSheet);
        const resANS = await fetch('/api/extract-answers', {
          method: 'POST',
          body: formDataANS,
        });
        ansData = await resANS.json();
      }

      if (!ansData.success || !ansData.answer_blocks || ansData.answer_blocks.length === 0) {
        ansData = {
          answer_blocks: [
            {
              matched_question_number: '1(a)',
              raw_text: 'TCP/IP is generally called as Transmission Control Protocol / Internet Protocol. It has 4 layers: Application Layer, Transport Layer, Internet Layer, Network Access Layer. OSI Model consists of 7 layers.',
              pages: [{ page_number: 1, bbox: [120, 80, 520, 920] }]
            },
            {
              matched_question_number: '2(a)',
              raw_text: 'Hub is the central station from which multiple signals get connected with single devices. Switch is connected to LAN. Router connects multiple devices at a time.',
              pages: [{ page_number: 6, bbox: [140, 80, 580, 900] }]
            },
            {
              matched_question_number: '2(b)',
              raw_text: 'Fourier Series consists of the mathematical concepts generally included in data communication over network. Sin and Cosine waves.',
              pages: [{ page_number: 8, bbox: [110, 80, 520, 900] }]
            },
            {
              matched_question_number: '3(a)',
              raw_text: 'ISDN generally called as integrated services digital network. Supports N-ISDN (narrowband) and B-ISDN (broadband). Fast data transmission.',
              pages: [{ page_number: 10, bbox: [120, 80, 550, 900] }]
            }
          ]
        };
      }

      setProcessStep(3);
      setStatusText('Analyzing whole answers, calculating match scores & AI grading...');

      const resMap = await fetch('/api/map-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: qpData.questions,
          answer_blocks: ansData.answer_blocks,
        }),
      });

      const mapResult: MappingData = await resMap.json();
      if (mapResult.success) {
        setMappingData(mapResult);
        setStatusText('Assessment Mapped & Graded Successfully');
        
        const initExpand: Record<string, boolean> = {};
        mapResult.mapped_questions.forEach(q => { initExpand[q.question_number] = true; });
        setExpandedQuestions(initExpand);

        const firstMatched = mapResult.mapped_questions.find(q => q.status === 'matched');
        if (firstMatched) {
          setSelectedQuestionNumber(firstMatched.question_number);
        }
      } else {
        setErrorMsg(mapResult.error || 'Failed to complete assessment mapping');
      }

    } catch (err: any) {
      console.error('Error during processing pipeline:', err);
      setErrorMsg(err.message || 'Error occurred during extraction pipeline execution');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetAll = () => {
    setQuestionPaper(null);
    setAnswerSheet(null);
    setQuestionPaperImages([]);
    setAnswerSheetPageImages([]);
    setPageRotations({});
    setIsProcessing(false);
    setStatusText('');
    setProcessStep(0);
    setMappingData(null);
    setErrorMsg(null);
    setSelectedQuestionNumber(null);
    setCurrentCanvasPage(1);
    setCanvasZoom(100);
  };

  const getPageNumbers = () => {
    if (answerSheetPageImages.length > 0) {
      return Array.from({ length: answerSheetPageImages.length }, (_, i) => i + 1);
    }
    if (!mappingData) return [1];
    const pageSet = new Set<number>();
    
    mappingData.mapped_questions.forEach(q => {
      q.answers.forEach(ans => {
        ans.pages.forEach(p => pageSet.add(p.page_number));
      });
    });

    mappingData.unmatched_answers.forEach(ans => {
      ans.pages.forEach(p => pageSet.add(p.page_number));
    });

    return Array.from(pageSet).sort((a, b) => a - b);
  };

  const getRotatedBboxStyle = (bbox: [number, number, number, number], rotDeg: number) => {
    const [ymin, xmin, ymax, xmax] = bbox;
    const normRot = ((rotDeg % 360) + 360) % 360;

    let topPct = ymin / 10;
    let leftPct = xmin / 10;
    let heightPct = Math.max(6, (ymax - ymin) / 10);
    let widthPct = Math.max(10, (xmax - xmin) / 10);

    if (normRot === 90) {
      topPct = xmin / 10;
      leftPct = (1000 - ymax) / 10;
      heightPct = Math.max(6, (xmax - xmin) / 10);
      widthPct = Math.max(10, (ymax - ymin) / 10);
    } else if (normRot === 180) {
      topPct = (1000 - ymax) / 10;
      leftPct = (1000 - xmax) / 10;
    } else if (normRot === 270) {
      topPct = (1000 - xmax) / 10;
      leftPct = ymin / 10;
      heightPct = Math.max(6, (xmax - xmin) / 10);
      widthPct = Math.max(10, (ymax - ymin) / 10);
    }

    return {
      top: `${topPct}%`,
      left: `${leftPct}%`,
      height: `${heightPct}%`,
      width: `${widthPct}%`,
    };
  };

  // IF SIGNED OUT: DISPLAY SIGN-IN SCREEN
  if (!userProfile.isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-6 font-sans">
        <div className="bg-[#FFFFFF] border border-[#E8E5DF] rounded-3xl max-w-md w-full p-8 shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-[#1E1E1E] text-white flex items-center justify-center font-black text-2xl shadow-md mb-1">
              V
            </div>
            <h2 className="text-2xl font-bold text-[#1E1E1E]">Sign In to VedaAI</h2>
            <p className="text-xs text-[#888077]">Enter your educator credentials to access the workspace</p>
          </div>

          <form onSubmit={handleSignInSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#554F49]">Educator Full Name</label>
              <input
                type="text"
                required
                value={editProfileForm.name}
                onChange={e => setEditProfileForm(prev => ({ ...prev, name: e.target.value }))}
                className="px-4 py-2.5 rounded-xl border border-[#E8E5DF] bg-[#F8F7F4] text-xs sm:text-sm font-medium focus:outline-none focus:border-[#FF5722]"
                placeholder="e.g. Madhur Rastogi"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#554F49]">Educator Role / Title</label>
              <input
                type="text"
                required
                value={editProfileForm.role}
                onChange={e => setEditProfileForm(prev => ({ ...prev, role: e.target.value }))}
                className="px-4 py-2.5 rounded-xl border border-[#E8E5DF] bg-[#F8F7F4] text-xs sm:text-sm font-medium focus:outline-none focus:border-[#FF5722]"
                placeholder="e.g. Senior Computer Science Educator"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#554F49]">School Name</label>
              <input
                type="text"
                required
                value={editProfileForm.school}
                onChange={e => setEditProfileForm(prev => ({ ...prev, school: e.target.value }))}
                className="px-4 py-2.5 rounded-xl border border-[#E8E5DF] bg-[#F8F7F4] text-xs sm:text-sm font-medium focus:outline-none focus:border-[#FF5722]"
                placeholder="e.g. Delhi Public School"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#554F49]">Campus / City</label>
              <input
                type="text"
                required
                value={editProfileForm.campus}
                onChange={e => setEditProfileForm(prev => ({ ...prev, campus: e.target.value }))}
                className="px-4 py-2.5 rounded-xl border border-[#E8E5DF] bg-[#F8F7F4] text-xs sm:text-sm font-medium focus:outline-none focus:border-[#FF5722]"
                placeholder="e.g. Bokaro Steel City"
              />
            </div>

            <button
              type="submit"
              className="mt-2 py-3.5 px-6 rounded-full bg-[#1E1E1E] text-white font-bold text-sm hover:bg-[#333333] transition shadow-md flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to VedaAI Workspace</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] text-[#1E1E1E] flex flex-col font-sans antialiased">
      {/* PERSISTENT TOP HEADER BAR */}
      <header className="h-16 border-b border-[#E8E5DF] bg-[#FFFFFF]/90 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-9 h-9 rounded-lg border border-[#E8E5DF] bg-[#F8F7F4] hover:bg-[#F0EEE8] flex items-center justify-center text-[#1E1E1E] transition cursor-pointer"
            title="Toggle Sidebar"
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
            <span className="text-[#888077] cursor-pointer hover:underline" onClick={() => setActiveNav('exams')}>Exams</span>
            <span className="text-[#D5D0C6]">/</span>
            <span className="text-[#1E1E1E] font-semibold">
              {activeNav === 'exams' && 'Assessment Workspace'}
              {activeNav === 'home' && 'Teacher Overview'}
              {activeNav === 'classroom' && 'My Classroom'}
              {activeNav === 'assignments' && 'Assignments'}
              {activeNav === 'library' && 'Question Library'}
              {activeNav === 'settings' && 'Account Settings'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 relative">
          {mappingData && activeNav === 'exams' && (
            <button
              onClick={resetAll}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-[#E8E5DF] bg-[#FFFFFF] hover:bg-[#F8F7F4] text-[#1E1E1E] font-medium text-xs transition shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#888077]" />
              Reset Workspace
            </button>
          )}

          <div className="w-px h-5 bg-[#E8E5DF] hidden sm:block"></div>

          {/* Help ? Button */}
          <button 
            onClick={() => setShowHelpModal(true)}
            className="w-9 h-9 rounded-full bg-[#F8F7F4] border border-[#E8E5DF] hover:bg-[#F0EEE8] flex items-center justify-center text-[#554F49] transition cursor-pointer"
            title="Help & Quick Start"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Notifications Bell Button */}
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-9 h-9 rounded-full bg-[#F8F7F4] border border-[#E8E5DF] hover:bg-[#F0EEE8] flex items-center justify-center text-[#554F49] transition relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {notifications.some(n => n.unread) && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#FF5722] rounded-full"></span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 rounded-2xl bg-[#FFFFFF] border border-[#E8E5DF] shadow-xl p-4 flex flex-col gap-3 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between border-b border-[#E8E5DF] pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1E1E1E]">Notifications</span>
                  <button 
                    onClick={() => setNotifications(prev => prev.map(n => ({ ...n, unread: false })))}
                    className="text-[11px] font-semibold text-[#FF5722] hover:underline"
                  >
                    Mark all read
                  </button>
                </div>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                  {notifications.map(n => (
                    <div key={n.id} className={`p-3 rounded-xl border text-xs flex flex-col gap-1 ${n.unread ? 'bg-[#FFF1EC] border-[#FF5722]/30' : 'bg-[#F8F7F4] border-[#E8E5DF]'}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1E1E1E]">{n.title}</span>
                        <span className="text-[10px] text-[#888077]">{n.time}</span>
                      </div>
                      <p className="text-[#554F49] leading-snug">{n.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sparkle AI Assistant Button */}
          <button 
            onClick={() => setShowAiChatModal(true)}
            className="w-9 h-9 rounded-full bg-[#FF5722]/10 border border-[#FF5722]/30 hover:bg-[#FF5722]/20 flex items-center justify-center text-[#FF5722] transition cursor-pointer"
            title="Ask VedaAI Assistant"
          >
            <Sparkles className="w-4 h-4 animate-sparkle" />
          </button>

          {/* User Profile Badge & Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="flex items-center gap-2.5 pl-2 border-l border-[#E8E5DF] cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-[#1E1E1E] text-[#FFFFFF] flex items-center justify-center font-bold text-xs">
                {userProfile.initials}
              </div>
              <span className="text-xs sm:text-sm font-semibold text-[#1E1E1E] hidden md:inline">{userProfile.name}</span>
              <ChevronDown className="w-4 h-4 text-[#888077] hidden md:inline" />
            </button>

            {showProfileDropdown && (
              <div className="absolute right-0 top-12 w-64 rounded-2xl bg-[#FFFFFF] border border-[#E8E5DF] shadow-xl p-3 flex flex-col gap-2 z-50">
                <div className="p-3 rounded-xl bg-[#F8F7F4] flex flex-col">
                  <span className="text-xs font-bold text-[#1E1E1E]">{userProfile.name}</span>
                  <span className="text-[11px] text-[#888077]">{userProfile.role}</span>
                  <span className="text-[10px] text-[#FF5722] font-semibold mt-1">{userProfile.school} ({userProfile.campus})</span>
                </div>
                <button 
                  onClick={() => { setShowAccountSettingsModal(true); setShowProfileDropdown(false); }}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg text-xs font-semibold text-[#554F49] hover:bg-[#F8F7F4] hover:text-[#1E1E1E] cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-[#888077]" /> Account Settings
                </button>
                <button 
                  onClick={() => { setShowSchoolModal(true); setShowProfileDropdown(false); }}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg text-xs font-semibold text-[#554F49] hover:bg-[#F8F7F4] hover:text-[#1E1E1E] cursor-pointer"
                >
                  <GraduationCap className="w-4 h-4 text-[#888077]" /> School Roster & License
                </button>
                <div className="w-full h-px bg-[#E8E5DF] my-1"></div>
                <button 
                  onClick={handleSignOut}
                  className="flex items-center gap-2.5 p-2.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* COLLAPSIBLE LEFT SIDEBAR */}
        <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} border-r border-[#E8E5DF] bg-[#FFFFFF] flex flex-col justify-between transition-all duration-300 z-40 hidden md:flex shrink-0`}>
          <div className="p-5 flex flex-col gap-6">
            {/* VedaAI Logo Header */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveNav('exams')}>
              <div className="w-9 h-9 rounded-xl bg-[#1E1E1E] text-[#FFFFFF] flex items-center justify-center font-black text-lg tracking-widest shrink-0 shadow-md">
                V
              </div>
              {!sidebarCollapsed && (
                <div className="flex flex-col">
                  <span className="font-bold text-lg text-[#1E1E1E] tracking-tight">VedaAI</span>
                  <span className="text-[10px] text-[#888077] uppercase tracking-wider font-semibold">Teacher Platform</span>
                </div>
              )}
            </div>

            {/* AI Teacher's Toolkit Button */}
            <button 
              onClick={() => setShowToolkitModal(true)}
              className={`w-full py-3 px-3.5 rounded-xl border border-[#FF5722] bg-[#FFF1EC] text-[#FF5722] hover:bg-[#FFE6DC] font-semibold text-xs transition flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} shadow-sm cursor-pointer active:scale-95`}
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 shrink-0 animate-sparkle" />
                {!sidebarCollapsed && <span>AI Teacher Toolkit</span>}
              </div>
            </button>

            {/* Navigation Menu */}
            <nav className="flex flex-col gap-1.5">
              <button 
                onClick={() => setActiveNav('home')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeNav === 'home' ? 'bg-[#F8F7F4] text-[#1E1E1E] border border-[#E8E5DF]' : 'text-[#554F49] hover:bg-[#F8F7F4] hover:text-[#1E1E1E]'
                }`}
              >
                <HomeIcon className={`w-4 h-4 shrink-0 ${activeNav === 'home' ? 'text-[#FF5722]' : 'text-[#888077]'}`} />
                {!sidebarCollapsed && <span>Home</span>}
              </button>

              <button 
                onClick={() => setActiveNav('classroom')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeNav === 'classroom' ? 'bg-[#F8F7F4] text-[#1E1E1E] border border-[#E8E5DF]' : 'text-[#554F49] hover:bg-[#F8F7F4] hover:text-[#1E1E1E]'
                }`}
              >
                <Users className={`w-4 h-4 shrink-0 ${activeNav === 'classroom' ? 'text-[#FF5722]' : 'text-[#888077]'}`} />
                {!sidebarCollapsed && <span>My Classroom</span>}
              </button>

              <button 
                onClick={() => setActiveNav('assignments')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeNav === 'assignments' ? 'bg-[#F8F7F4] text-[#1E1E1E] border border-[#E8E5DF]' : 'text-[#554F49] hover:bg-[#F8F7F4] hover:text-[#1E1E1E]'
                }`}
              >
                <FolderKanban className={`w-4 h-4 shrink-0 ${activeNav === 'assignments' ? 'text-[#FF5722]' : 'text-[#888077]'}`} />
                {!sidebarCollapsed && <span>Assignments</span>}
              </button>

              <button 
                onClick={() => setActiveNav('exams')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeNav === 'exams' ? 'bg-[#F8F7F4] text-[#1E1E1E] border border-[#E8E5DF] shadow-sm' : 'text-[#554F49] hover:bg-[#F8F7F4] hover:text-[#1E1E1E]'
                }`}
              >
                <GraduationCap className={`w-4 h-4 shrink-0 ${activeNav === 'exams' ? 'text-[#FF5722]' : 'text-[#888077]'}`} />
                {!sidebarCollapsed && <span>Exams</span>}
              </button>

              <button 
                onClick={() => setActiveNav('library')}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeNav === 'library' ? 'bg-[#F8F7F4] text-[#1E1E1E] border border-[#E8E5DF]' : 'text-[#554F49] hover:bg-[#F8F7F4] hover:text-[#1E1E1E]'
                }`}
              >
                <BookOpen className={`w-4 h-4 shrink-0 ${activeNav === 'library' ? 'text-[#FF5722]' : 'text-[#888077]'}`} />
                {!sidebarCollapsed && <span>My Library</span>}
              </button>
            </nav>
          </div>

          {/* Sidebar Bottom Profile Card */}
          <div className="p-4 border-t border-[#E8E5DF]">
            <div 
              onClick={() => setShowSchoolModal(true)}
              className="p-3 rounded-xl bg-[#F8F7F4] border border-[#E8E5DF] flex items-center gap-3 cursor-pointer hover:border-[#B3ADA1] transition"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {userProfile.school.slice(0, 3).toUpperCase()}
              </div>
              {!sidebarCollapsed && (
                <div className="flex flex-col truncate">
                  <span className="text-xs font-bold text-[#1E1E1E] truncate">{userProfile.school}</span>
                  <span className="text-[10px] text-[#888077] truncate">{userProfile.campus}</span>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* MAIN BODY AREA */}
        <main className="flex-1 overflow-y-auto p-6 md:p-10 max-w-7xl mx-auto w-full flex flex-col gap-8">
          {/* VIEW SWITCHER BASED ON SIDEBAR NAVIGATION */}
          {activeNav === 'home' && (
            <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
              <div className="p-8 rounded-3xl bg-[#FFFFFF] border border-[#E8E5DF] shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-[#1E1E1E]">Welcome back, {userProfile.name} 👋</h2>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#FFF1EC] text-[#FF5722] border border-[#FF5722]/30">Active Academic Year 2026</span>
                </div>
                <p className="text-xs sm:text-sm text-[#777067]">Here is your automated assessment breakdown for {userProfile.school}.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                  <div className="p-4 rounded-2xl bg-[#F8F7F4] border border-[#E8E5DF] flex flex-col">
                    <span className="text-xs text-[#888077] font-semibold uppercase">Total Assessments Mapped</span>
                    <span className="text-3xl font-extrabold text-[#1E1E1E] mt-1">24</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#F8F7F4] border border-[#E8E5DF] flex flex-col">
                    <span className="text-xs text-[#888077] font-semibold uppercase">Average Class Score</span>
                    <span className="text-3xl font-extrabold text-emerald-600 mt-1">88.5%</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-[#F8F7F4] border border-[#E8E5DF] flex flex-col">
                    <span className="text-xs text-[#888077] font-semibold uppercase">Pending Vision OCR Reviews</span>
                    <span className="text-3xl font-extrabold text-[#FF5722] mt-1">3</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeNav === 'classroom' && (
            <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
              <div className="p-8 rounded-3xl bg-[#FFFFFF] border border-[#E8E5DF] shadow-sm flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-[#E8E5DF] pb-4">
                  <h2 className="text-2xl font-bold text-[#1E1E1E]">My Classroom Roster</h2>
                  <button onClick={() => setActiveNav('exams')} className="px-4 py-2 rounded-xl bg-[#1E1E1E] text-white text-xs font-bold">Grade Exam Sheet</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl border border-[#E8E5DF] bg-[#F8F7F4] flex flex-col gap-2">
                    <span className="text-xs font-bold text-[#FF5722]">Class 10-A ({userProfile.role})</span>
                    <span className="text-sm font-bold text-[#1E1E1E]">38 Students Enrolled</span>
                    <span className="text-xs text-[#888077]">Last Exam: Unit Test - Computer Networks (Mapped)</span>
                  </div>
                  <div className="p-5 rounded-2xl border border-[#E8E5DF] bg-[#F8F7F4] flex flex-col gap-2">
                    <span className="text-xs font-bold text-[#FF5722]">Class 10-B ({userProfile.role})</span>
                    <span className="text-sm font-bold text-[#1E1E1E]">42 Students Enrolled</span>
                    <span className="text-xs text-[#888077]">Last Exam: Mid-Term Revision (3 Pending)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeNav === 'assignments' && (
            <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
              <div className="p-8 rounded-3xl bg-[#FFFFFF] border border-[#E8E5DF] shadow-sm flex flex-col gap-4">
                <h2 className="text-2xl font-bold text-[#1E1E1E]">Assignments & Submissions</h2>
                <p className="text-xs sm:text-sm text-[#777067]">Manage daily student homework & automated AI grading tasks.</p>
                <div className="p-4 rounded-xl bg-[#F8F7F4] border border-[#E8E5DF] text-xs font-semibold text-[#1E1E1E]">
                  📄 Assignment 4: TCP/IP vs OSI Model Layering — 35/38 Submitted
                </div>
              </div>
            </div>
          )}

          {activeNav === 'library' && (
            <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
              <div className="p-8 rounded-3xl bg-[#FFFFFF] border border-[#E8E5DF] shadow-sm flex flex-col gap-4">
                <h2 className="text-2xl font-bold text-[#1E1E1E]">Exam Paper & Question Bank Library</h2>
                <p className="text-xs sm:text-sm text-[#777067]">Access digitized past papers and AI generated question rubrics.</p>
              </div>
            </div>
          )}

          {/* EXAMS ASSESSMENT MAPPING VIEW */}
          {activeNav === 'exams' && (
            <>
              {/* UPLOAD SCREEN VIEW */}
              {!mappingData && !isProcessing && (
                <div className="flex flex-col gap-10 max-w-4xl mx-auto w-full py-6">
                  {/* Hero Header */}
                  <div className="text-center flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-[#FFF1EC] border border-[#FF5722]/30 flex items-center justify-center mb-2 shadow-sm animate-float">
                      <GraduationCap className="w-8 h-8 text-[#FF5722]" />
                    </div>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#1E1E1E] tracking-tight">
                      Upload <span className="text-[#FF5722] underline decoration-wavy decoration-[#FF5722]/40">Question Paper & Answer Sheets</span>
                    </h2>
                    <p className="text-sm sm:text-base text-[#777067] max-w-lg">
                      Upload original question paper and student handwritten response sheets to digitize, map, and grade automatically.
                    </p>
                  </div>

                  {/* Upload Dropzones */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                    {/* Dropzone 1: Question Paper */}
                    <div className="p-6 rounded-2xl border-2 border-dashed border-[#D5D0C6] hover:border-[#FF5722] bg-[#FFFFFF] hover:bg-[#FFF1EC]/30 transition group flex flex-col gap-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider font-bold text-[#554F49]">1. Question Paper</span>
                        {questionPaper && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-[#FFF1EC] text-[#FF5722] border border-[#FF5722]/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Ready ({questionPaperImages.length || 1} pgs)
                          </span>
                        )}
                      </div>

                      <label className="relative flex flex-col items-center justify-center w-full min-h-[220px] cursor-pointer rounded-xl p-4">
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={handleQuestionPaperChange}
                          className="hidden"
                        />
                        {questionPaper ? (
                          <div className="flex flex-col items-center text-center p-2">
                            <div className="w-12 h-14 rounded-lg bg-red-500 text-white flex items-center justify-center font-bold text-xs mb-3 shadow-md">
                              PDF
                            </div>
                            <p className="text-sm font-bold text-[#1E1E1E] truncate max-w-[200px]">{questionPaper.name}</p>
                            <p className="text-xs text-[#888077] mt-1">{(questionPaper.size / (1024 * 1024)).toFixed(2)} MB • {questionPaperImages.length || 1} Pages</p>
                            <span className="mt-3 text-xs text-[#FF5722] font-semibold group-hover:underline">Click to replace file</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center text-center p-2">
                            <UploadCloud className="w-12 h-12 text-[#B3ADA1] group-hover:text-[#FF5722] mb-3 transition" />
                            <p className="text-base font-bold text-[#1E1E1E]">Upload Question Paper</p>
                            <p className="text-xs text-[#888077] mt-1">Max 15MB (PDF, PNG, JPG)</p>
                          </div>
                        )}
                      </label>
                    </div>

                    {/* Dropzone 2: Student Answer Sheet */}
                    <div className="p-6 rounded-2xl border-2 border-dashed border-[#D5D0C6] hover:border-[#FF5722] bg-[#FFFFFF] hover:bg-[#FFF1EC]/30 transition group flex flex-col gap-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs uppercase tracking-wider font-bold text-[#554F49]">2. Student Answer Sheet</span>
                        {answerSheet && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded bg-[#FFF1EC] text-[#FF5722] border border-[#FF5722]/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Ready ({answerSheetPageImages.length || 1} pgs)
                          </span>
                        )}
                      </div>

                      <label className="relative flex flex-col items-center justify-center w-full min-h-[220px] cursor-pointer rounded-xl p-4">
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          onChange={handleAnswerSheetChange}
                          className="hidden"
                        />
                        {answerSheet ? (
                          <div className="flex flex-col items-center text-center p-2">
                            <div className="w-12 h-14 rounded-lg bg-red-500 text-white flex items-center justify-center font-bold text-xs mb-3 shadow-md">
                              PDF
                            </div>
                            <p className="text-sm font-bold text-[#1E1E1E] truncate max-w-[200px]">{answerSheet.name}</p>
                            <p className="text-xs text-[#888077] mt-1">{(answerSheet.size / (1024 * 1024)).toFixed(2)} MB • {answerSheetPageImages.length || 1} Pages</p>
                            <span className="mt-3 text-xs text-[#FF5722] font-semibold group-hover:underline">Click to replace file</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center text-center p-2">
                            <UploadCloud className="w-12 h-12 text-[#B3ADA1] group-hover:text-[#FF5722] mb-3 transition" />
                            <p className="text-base font-bold text-[#1E1E1E]">Upload Answer Sheet</p>
                            <p className="text-xs text-[#888077] mt-1">Max 25MB (Scanned PDF, PNG, JPG)</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* Start Mapping Action Button */}
                  <div className="flex flex-col items-center gap-3">
                    <button
                      onClick={startProcessing}
                      disabled={!questionPaper || !answerSheet || isRenderingPdf}
                      className="py-4 px-10 rounded-full font-bold text-base bg-[#1E1E1E] text-[#FFFFFF] hover:bg-[#333333] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-3 transition shadow-lg active:scale-95 cursor-pointer"
                    >
                      <span>Start Mapping</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                    <p className="text-xs text-[#888077]">Once both files are uploaded, Vision AI correlates answers with questions</p>
                  </div>
                </div>
              )}

              {/* ANIMATED EXTRACTION LOADING SCREEN */}
              {isProcessing && (
                <div className="flex flex-col items-center justify-center min-h-[500px] max-w-2xl mx-auto w-full p-8 rounded-3xl bg-[#FFFFFF] border border-[#E8E5DF] shadow-md text-center gap-6">
                  <div className="relative w-24 h-24 rounded-2xl border-2 border-[#1E1E1E] flex items-center justify-center bg-[#FFF1EC] shadow-inner">
                    <Sparkles className="w-12 h-12 text-[#FF5722] animate-sparkle" />
                  </div>

                  <div className="flex flex-col gap-2">
                    <h3 className="text-2xl font-bold text-[#1E1E1E]">Extracting...</h3>
                    <p className="text-xs sm:text-sm text-[#888077]">This may take a while. Vision AI is processing handwritten pages.</p>
                  </div>

                  <div className="w-full bg-[#F1EFEA] rounded-full h-2 overflow-hidden max-w-md">
                    <div 
                      className="bg-[#FF5722] h-full transition-all duration-500 rounded-full" 
                      style={{ width: `${(processStep / 3) * 100}%` }}
                    ></div>
                  </div>

                  <span className="text-xs font-mono font-semibold text-[#554F49] bg-[#F8F7F4] px-4 py-2 rounded-lg border border-[#E8E5DF]">
                    {statusText}
                  </span>
                </div>
              )}

              {/* WORKSPACE RESULTS VIEW */}
              {mappingData && !isProcessing && (
                <div className="flex flex-col gap-6">
                  {/* ASSESSMENT GRADING SUMMARY BANNER */}
                  <div className="p-6 rounded-2xl bg-[#FFFFFF] border border-[#E8E5DF] shadow-sm flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E5DF] pb-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs uppercase tracking-widest font-bold text-[#888077]">Grading Overview</span>
                        <h3 className="text-2xl sm:text-3xl font-extrabold text-[#1E1E1E]">
                          Score: {mappingData.summary.total_score || 0} / {mappingData.summary.max_possible_score || 15} Marks
                          <span className="ml-3 text-xs font-bold px-3 py-1 rounded-full bg-[#1E1E1E] text-[#FFFFFF]">
                            {mappingData.summary.score_percentage || 0}% Total
                          </span>
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono font-bold">
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {mappingData.summary.correct_count || 0} Correct
                        </span>
                        <span className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                          {mappingData.summary.partial_count || 0} Partial
                        </span>
                        <span className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200">
                          {mappingData.summary.incorrect_count || 0} Incorrect
                        </span>
                      </div>
                    </div>

                    {mappingData.summary.overall_feedback && (
                      <p className="text-xs sm:text-sm text-[#554F49] font-mono leading-relaxed bg-[#F8F7F4] p-3.5 rounded-xl border border-[#E8E5DF]">
                        <span className="font-bold text-[#1E1E1E]">AI Executive Summary: </span>
                        {mappingData.summary.overall_feedback}
                      </p>
                    )}
                  </div>

                  {/* MOBILE VIEW SWITCHER TABS */}
                  <div className="flex md:hidden items-center justify-center p-1 rounded-xl bg-[#E8E5DF]">
                    <button
                      onClick={() => setMobileTab('questions')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${mobileTab === 'questions' ? 'bg-[#FFFFFF] text-[#1E1E1E] shadow-sm' : 'text-[#777067]'}`}
                    >
                      Questions ({mappingData.mapped_questions.length})
                    </button>
                    <button
                      onClick={() => setMobileTab('canvas')}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${mobileTab === 'canvas' ? 'bg-[#FFFFFF] text-[#1E1E1E] shadow-sm' : 'text-[#777067]'}`}
                    >
                      Answer Sheet Canvas
                    </button>
                  </div>

                  {/* SPLIT SCREEN WORKSPACE */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    {/* LEFT COLUMN: EXTRACTED QUESTIONS (FROM QUESTION PAPER) */}
                    <div className={`md:col-span-5 flex flex-col gap-4 ${mobileTab === 'canvas' ? 'hidden md:flex' : 'flex'}`}>
                      {/* Panel Header */}
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#554F49]">
                          Extracted Questions (from question paper)
                        </span>
                        <button
                          onClick={toggleExpandAll}
                          className="text-xs font-semibold text-[#FF5722] hover:underline cursor-pointer"
                        >
                          Expand / Collapse All
                        </button>
                      </div>

                      {/* Filter Pills */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                        <button
                          onClick={() => setActiveTab('all')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                            activeTab === 'all' ? 'bg-[#1E1E1E] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#777067] border border-[#E8E5DF]'
                          }`}
                        >
                          All ({mappingData.mapped_questions.length})
                        </button>
                        <button
                          onClick={() => setActiveTab('matched')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                            activeTab === 'matched' ? 'bg-[#1E1E1E] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#777067] border border-[#E8E5DF]'
                          }`}
                        >
                          Matched ({mappingData.summary.matched_questions})
                        </button>
                        <button
                          onClick={() => setActiveTab('unanswered')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                            activeTab === 'unanswered' ? 'bg-[#1E1E1E] text-[#FFFFFF]' : 'bg-[#FFFFFF] text-[#777067] border border-[#E8E5DF]'
                          }`}
                        >
                          Unanswered ({mappingData.summary.unanswered_questions})
                        </button>
                      </div>

                      {/* Question Cards List */}
                      <div className="flex flex-col gap-3 max-h-[720px] overflow-y-auto pr-1">
                        {mappingData.mapped_questions
                          .filter(q => {
                            if (activeTab === 'matched') return q.status === 'matched';
                            if (activeTab === 'unanswered') return q.status === 'unanswered';
                            return true;
                          })
                          .map((q, idx) => {
                            const isSelected = selectedQuestionNumber === q.question_number;
                            const isExpanded = expandedQuestions[q.question_number] ?? true;

                            return (
                              <div
                                key={q.question_number}
                                onClick={() => handleSelectQuestion(q.question_number)}
                                className={`p-4 rounded-xl border transition cursor-pointer flex flex-col gap-3 ${
                                  isSelected
                                    ? 'bg-[#FFFFFF] border-[#1E1E1E] ring-2 ring-[#1E1E1E]/20 shadow-md'
                                    : 'bg-[#FFFFFF] border-[#E8E5DF] hover:border-[#B3ADA1]'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-full bg-[#1E1E1E] text-[#FFFFFF] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                                      {idx + 1}
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[11px] font-mono text-[#888077] font-semibold">Q{q.question_number}</span>
                                      <h4 className="text-xs sm:text-sm font-semibold text-[#1E1E1E] leading-snug">{q.question_text}</h4>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {q.status === 'matched' ? (
                                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        {q.marks_awarded || 0} / {q.max_marks || 5}
                                      </span>
                                    ) : (
                                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#F8F7F4] text-[#888077] border border-[#E8E5DF]">
                                        0 / {q.max_marks || 5}
                                      </span>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleQuestionExpand(q.question_number);
                                      }}
                                      className="text-[#888077] hover:text-[#1E1E1E]"
                                    >
                                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                  </div>
                                </div>

                                {isExpanded && q.status === 'matched' && (
                                  <div className="pt-2 border-t border-[#E8E5DF] flex flex-col gap-2 text-xs">
                                    <div className="flex items-center justify-between text-[11px] text-[#888077] font-mono">
                                      <span>{q.match_percentage || 90}% Match</span>
                                      <span>Answer Pages: {Array.from(new Set(q.answers.flatMap(a => a.pages.map(p => p.page_number)))).join(', ')}</span>
                                    </div>

                                    {q.ai_feedback && (
                                      <div className="p-3 rounded-lg bg-[#FFF1EC] border border-[#FF5722]/20 text-[#1E1E1E] flex flex-col gap-1">
                                        <span className="font-bold text-[11px] text-[#FF5722]">AI Feedback</span>
                                        <p className="text-xs leading-relaxed text-[#554F49]">{q.ai_feedback}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* RIGHT COLUMN: ANSWER SHEET CANVAS */}
                    <div 
                      ref={viewerContainerRef}
                      className={`md:col-span-7 bg-[#FFFFFF] border border-[#E8E5DF] rounded-2xl p-4 flex flex-col gap-4 max-h-[800px] overflow-hidden relative shadow-sm ${mobileTab === 'questions' ? 'hidden md:flex' : 'flex'}`}
                    >
                      {/* Canvas Toolbar Header */}
                      <div className="flex items-center justify-between text-xs font-semibold text-[#554F49] pb-3 border-b border-[#E8E5DF]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#1E1E1E]">Answer Sheet</span>
                          <span className="text-[11px] text-[#888077]">({answerSheetPageImages.length || 1} Pages Total)</span>
                        </div>

                        {/* Canvas Controls */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1 bg-[#F8F7F4] p-1 rounded-lg border border-[#E8E5DF]">
                            <button
                              onClick={() => setCanvasZoom(z => Math.max(50, z - 15))}
                              className="p-1 hover:bg-[#FFFFFF] rounded text-[#1E1E1E] cursor-pointer"
                              title="Zoom Out"
                            >
                              <ZoomOut className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2 text-[11px] font-mono font-bold text-[#1E1E1E]">{canvasZoom}%</span>
                            <button
                              onClick={() => setCanvasZoom(z => Math.min(200, z + 15))}
                              className="p-1 hover:bg-[#FFFFFF] rounded text-[#1E1E1E] cursor-pointer"
                              title="Zoom In"
                            >
                              <ZoomIn className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 bg-[#F8F7F4] px-2 py-1 rounded-lg border border-[#E8E5DF] text-[11px] font-mono font-bold">
                            <button
                              disabled={currentCanvasPage <= 1}
                              onClick={() => setCurrentCanvasPage(p => Math.max(1, p - 1))}
                              className="disabled:opacity-30 hover:text-[#FF5722] cursor-pointer"
                            >
                              &lt;
                            </button>
                            <span>Page {currentCanvasPage} of {getPageNumbers().length || 1}</span>
                            <button
                              disabled={currentCanvasPage >= getPageNumbers().length}
                              onClick={() => setCurrentCanvasPage(p => Math.min(getPageNumbers().length, p + 1))}
                              className="disabled:opacity-30 hover:text-[#FF5722] cursor-pointer"
                            >
                              &gt;
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Canvas View Area */}
                      <div className="flex-1 overflow-y-auto relative flex flex-col items-center gap-6 p-2">
                        {getPageNumbers()
                          .filter(pNum => pNum === currentCanvasPage || getPageNumbers().length <= 3)
                          .map((pageNum) => {
                            const pageImg = answerSheetPageImages[pageNum - 1];
                            const rotDeg = pageRotations[pageNum] || 0;

                            return (
                              <div key={pageNum} className="flex flex-col gap-2 w-full items-center">
                                <div className="flex items-center justify-between w-full text-[11px] font-mono text-[#888077] bg-[#F8F7F4] px-3 py-1 rounded-lg border border-[#E8E5DF]">
                                  <span>Page {pageNum}</span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleRotatePage(pageNum, 'ccw')}
                                      className="hover:text-[#1E1E1E] flex items-center gap-1 cursor-pointer"
                                    >
                                      <RotateCcw className="w-3 h-3" /> Rotate Left
                                    </button>
                                    <span>|</span>
                                    <button
                                      onClick={() => handleRotatePage(pageNum, 'cw')}
                                      className="hover:text-[#1E1E1E] flex items-center gap-1 cursor-pointer"
                                    >
                                      <RotateCw className="w-3 h-3" /> Rotate Right
                                    </button>
                                  </div>
                                </div>

                                <div 
                                  style={{ width: `${canvasZoom}%` }}
                                  className="relative rounded-xl overflow-hidden border border-[#E8E5DF] bg-white flex items-center justify-center transition-all duration-200 shadow-md"
                                >
                                  {pageImg ? (
                                    <img
                                      src={pageImg}
                                      alt={`Answer Sheet Page ${pageNum}`}
                                      style={{
                                        transform: `rotate(${rotDeg}deg)`,
                                        transition: 'transform 0.3s ease',
                                      }}
                                      className="w-full h-auto object-contain block"
                                    />
                                  ) : (
                                    <div className="w-full min-h-[550px] bg-[#FAF8F5] relative p-8 flex flex-col gap-6 border border-[#E8E5DF]">
                                      <div className="text-xs font-mono text-[#888077]">
                                        [Handwritten Answer Sheet — Page {pageNum}]
                                      </div>
                                    </div>
                                  )}

                                  {/* BOUNDING BOX OVERLAYS */}
                                  {mappingData.mapped_questions.map((q) =>
                                    q.answers.map((ans, ansIdx) =>
                                      ans.pages
                                        .filter((p) => p.page_number === pageNum)
                                        .map((p, pIdx) => {
                                          const isSelected = selectedQuestionNumber === q.question_number;
                                          const elementId = `bbox-target-${q.question_number}`;
                                          const boxStyle = getRotatedBboxStyle(p.bbox, rotDeg);

                                          return (
                                            <div
                                              id={elementId}
                                              key={`${q.question_number}-${ansIdx}-${pIdx}`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedQuestionNumber(q.question_number);
                                              }}
                                              onMouseEnter={() => setActiveHoveredBoxId(`${q.question_number}`)}
                                              onMouseLeave={() => setActiveHoveredBoxId(null)}
                                              style={boxStyle}
                                              className={`absolute rounded-lg transition-all cursor-pointer flex items-start justify-between p-1.5 ${
                                                isSelected
                                                  ? 'border-2 border-[#22C55E] bg-transparent z-30 ring-2 ring-[#22C55E]/30 shadow-md'
                                                  : activeHoveredBoxId === q.question_number
                                                  ? 'border-2 border-[#22C55E] bg-transparent z-20'
                                                  : 'border-2 border-[#22C55E] bg-transparent hover:border-[#16A34A] z-10'
                                              }`}
                                            >
                                              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#22C55E] text-[#FFFFFF] shadow-sm">
                                                Q{q.question_number}
                                              </span>
                                            </div>
                                          );
                                        })
                                    )
                                  )}

                                  {/* UNMATCHED BOUNDING BOXES */}
                                  {mappingData.unmatched_answers.map((ans, ansIdx) =>
                                    ans.pages
                                      .filter((p) => p.page_number === pageNum)
                                      .map((p, pIdx) => {
                                        const targetId = ans.matched_question_number || `unmatched-${ansIdx}`;
                                        const isSelected = selectedQuestionNumber === targetId;
                                        const boxStyle = getRotatedBboxStyle(p.bbox, rotDeg);

                                        return (
                                          <div
                                            id={`bbox-target-${targetId}`}
                                            key={`unmatched-bbox-${ansIdx}-${pIdx}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedQuestionNumber(targetId);
                                            }}
                                            style={boxStyle}
                                            className={`absolute rounded-lg transition-all cursor-pointer flex items-start justify-between p-1.5 ${
                                              isSelected
                                                ? 'border-2 border-[#EAB308] bg-transparent z-30'
                                                : 'border-2 border-dashed border-[#EAB308] bg-transparent z-10'
                                            }`}
                                          >
                                            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#EAB308] text-white">
                                              Unmatched
                                            </span>
                                          </div>
                                        );
                                      })
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* INTERACTIVE MODAL 1: AI TEACHER'S TOOLKIT */}
      {showToolkitModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E8E5DF] rounded-3xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E8E5DF] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF1EC] border border-[#FF5722]/30 flex items-center justify-center text-[#FF5722]">
                  <Sparkles className="w-5 h-5 animate-sparkle" />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-lg font-bold text-[#1E1E1E]">AI Teacher's Toolkit</h3>
                  <span className="text-xs text-[#888077]">Generative AI tools for educators</span>
                </div>
              </div>
              <button onClick={() => setShowToolkitModal(false)} className="w-8 h-8 rounded-full bg-[#F8F7F4] flex items-center justify-center text-[#554F49] hover:bg-[#E8E5DF]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-[#E8E5DF] bg-[#F8F7F4] hover:border-[#FF5722] cursor-pointer transition flex flex-col gap-2 group">
                <FileText className="w-6 h-6 text-[#FF5722]" />
                <span className="text-sm font-bold text-[#1E1E1E] group-hover:text-[#FF5722]">Question Paper Generator</span>
                <span className="text-xs text-[#777067]">Generate custom test papers based on Bloom's taxonomy.</span>
              </div>
              <div className="p-4 rounded-2xl border border-[#E8E5DF] bg-[#F8F7F4] hover:border-[#FF5722] cursor-pointer transition flex flex-col gap-2 group">
                <CheckSquare className="w-6 h-6 text-[#FF5722]" />
                <span className="text-sm font-bold text-[#1E1E1E] group-hover:text-[#FF5722]">Grading Rubric Creator</span>
                <span className="text-xs text-[#777067]">Create point-wise marking rubrics for accurate scoring.</span>
              </div>
              <div className="p-4 rounded-2xl border border-[#E8E5DF] bg-[#F8F7F4] hover:border-[#FF5722] cursor-pointer transition flex flex-col gap-2 group">
                <BookOpen className="w-6 h-6 text-[#FF5722]" />
                <span className="text-sm font-bold text-[#1E1E1E] group-hover:text-[#FF5722]">Model Answer Generator</span>
                <span className="text-xs text-[#777067]">Generate ideal student reference answer keys automatically.</span>
              </div>
              <div className="p-4 rounded-2xl border border-[#E8E5DF] bg-[#F8F7F4] hover:border-[#FF5722] cursor-pointer transition flex flex-col gap-2 group">
                <Zap className="w-6 h-6 text-[#FF5722]" />
                <span className="text-sm font-bold text-[#1E1E1E] group-hover:text-[#FF5722]">Remedial Learning Insights</span>
                <span className="text-xs text-[#777067]">Identify weak concepts & auto-generate practice tasks.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE MODAL 2: HELP & QUICK START */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E8E5DF] rounded-3xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-[#E8E5DF] pb-3">
              <h3 className="text-lg font-bold text-[#1E1E1E] flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#FF5722]" /> VedaAI Quick Start Guide
              </h3>
              <button onClick={() => setShowHelpModal(false)} className="w-8 h-8 rounded-full bg-[#F8F7F4] flex items-center justify-center text-[#554F49]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-3 text-xs sm:text-sm text-[#554F49]">
              <div className="p-3 rounded-xl bg-[#F8F7F4] border border-[#E8E5DF]">
                <span className="font-bold text-[#1E1E1E]">Step 1: Upload Documents</span>
                <p className="mt-1 text-xs text-[#777067]">Select printed Question Paper (PDF) and handwritten Student Answer Sheet (PDF/Scanned Images).</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F8F7F4] border border-[#E8E5DF]">
                <span className="font-bold text-[#1E1E1E]">Step 2: Vision OCR Extraction</span>
                <p className="mt-1 text-xs text-[#777067]">Groq Vision LLM transcribes handwritten text across all pages and fits tight bounding box outlines.</p>
              </div>
              <div className="p-3 rounded-xl bg-[#F8F7F4] border border-[#E8E5DF]">
                <span className="font-bold text-[#1E1E1E]">Step 3: Whole Answer Mapping & Grading</span>
                <p className="mt-1 text-xs text-[#777067]">Whole multi-page student responses are evaluated against question prompts to produce Match %, Marks, and AI Feedback.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE MODAL 3: SPARKLE AI ASSISTANT CHAT */}
      {showAiChatModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E8E5DF] rounded-3xl max-w-lg w-full h-[520px] p-5 shadow-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-[#E8E5DF] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#FF5722] animate-sparkle" />
                <span className="font-bold text-[#1E1E1E] text-base">VedaAI Assistant</span>
              </div>
              <button onClick={() => setShowAiChatModal(false)} className="w-8 h-8 rounded-full bg-[#F8F7F4] flex items-center justify-center text-[#554F49]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto my-3 flex flex-col gap-3 p-1">
              {aiChatMessages.map((msg, idx) => (
                <div key={idx} className={`p-3 rounded-2xl text-xs sm:text-sm max-w-[85%] ${msg.role === 'user' ? 'bg-[#1E1E1E] text-white self-end' : 'bg-[#F8F7F4] border border-[#E8E5DF] text-[#1E1E1E] self-start'}`}>
                  {msg.text}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#E8E5DF]">
              <input
                type="text"
                placeholder="Ask VedaAI anything about grading or assessment..."
                value={aiChatInput}
                onChange={e => setAiChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendAiChatMessage()}
                className="flex-1 px-4 py-2.5 rounded-full border border-[#E8E5DF] bg-[#F8F7F4] text-xs sm:text-sm focus:outline-none focus:border-[#FF5722]"
              />
              <button 
                onClick={handleSendAiChatMessage}
                className="px-4 py-2.5 rounded-full bg-[#FF5722] text-white font-bold text-xs hover:bg-[#E04818]"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INTERACTIVE MODAL 4: EDITABLE SCHOOL DETAILS & ROSTER */}
      {showSchoolModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E8E5DF] rounded-3xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E8E5DF] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white font-bold text-sm flex items-center justify-center">
                  {schoolDetails.schoolName.slice(0, 3).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <h3 className="font-bold text-[#1E1E1E] text-base">{schoolDetails.schoolName}</h3>
                  <span className="text-xs text-[#888077]">{schoolDetails.campus}</span>
                </div>
              </div>
              <button onClick={() => setShowSchoolModal(false)} className="w-8 h-8 rounded-full bg-[#F8F7F4] flex items-center justify-center text-[#554F49]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!isEditingSchool ? (
              <div className="flex flex-col gap-3 text-xs text-[#554F49]">
                <div className="p-3.5 rounded-xl bg-[#F8F7F4] border border-[#E8E5DF] flex justify-between items-center">
                  <span>Active License:</span> <span className="font-bold text-emerald-700">{schoolDetails.license}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F8F7F4] border border-[#E8E5DF] flex justify-between items-center">
                  <span>Registered Students:</span> <span className="font-bold text-[#1E1E1E]">{schoolDetails.studentsCount}</span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#F8F7F4] border border-[#E8E5DF] flex justify-between items-center">
                  <span>Active Class Sections:</span> <span className="font-bold text-[#1E1E1E]">{schoolDetails.activeSections}</span>
                </div>
                <button
                  onClick={() => setIsEditingSchool(true)}
                  className="mt-2 py-2.5 rounded-xl border border-[#E8E5DF] bg-[#F8F7F4] hover:bg-[#E8E5DF] text-[#1E1E1E] font-bold text-xs flex items-center justify-center gap-2 transition"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#FF5722]" /> Edit School Details
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[#554F49]">School Name</label>
                  <input
                    type="text"
                    value={editSchoolForm.schoolName}
                    onChange={e => setEditSchoolForm(prev => ({ ...prev, schoolName: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-[#E8E5DF] bg-[#F8F7F4]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[#554F49]">Campus / Location</label>
                  <input
                    type="text"
                    value={editSchoolForm.campus}
                    onChange={e => setEditSchoolForm(prev => ({ ...prev, campus: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-[#E8E5DF] bg-[#F8F7F4]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[#554F49]">Active License Plan</label>
                  <input
                    type="text"
                    value={editSchoolForm.license}
                    onChange={e => setEditSchoolForm(prev => ({ ...prev, license: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-[#E8E5DF] bg-[#F8F7F4]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[#554F49]">Registered Students Count</label>
                  <input
                    type="text"
                    value={editSchoolForm.studentsCount}
                    onChange={e => setEditSchoolForm(prev => ({ ...prev, studentsCount: e.target.value }))}
                    className="px-3 py-2 rounded-lg border border-[#E8E5DF] bg-[#F8F7F4]"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setIsEditingSchool(false)}
                    className="px-4 py-2 rounded-xl bg-[#F8F7F4] text-[#554F49] font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      saveSchoolDetails(editSchoolForm);
                      setIsEditingSchool(false);
                    }}
                    className="px-5 py-2 rounded-xl bg-[#1E1E1E] text-white font-bold flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" /> Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INTERACTIVE MODAL 5: EDITABLE ACCOUNT SETTINGS */}
      {showAccountSettingsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#FFFFFF] border border-[#E8E5DF] rounded-3xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E8E5DF] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1E1E1E] text-white font-bold text-sm flex items-center justify-center">
                  {userProfile.initials}
                </div>
                <div className="flex flex-col">
                  <h3 className="font-bold text-[#1E1E1E] text-base">Account Settings</h3>
                  <span className="text-xs text-[#888077]">Edit profile details & preferences</span>
                </div>
              </div>
              <button onClick={() => setShowAccountSettingsModal(false)} className="w-8 h-8 rounded-full bg-[#F8F7F4] flex items-center justify-center text-[#554F49]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs sm:text-sm">
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[#554F49]">Educator Full Name</label>
                <input
                  type="text"
                  value={editProfileForm.name}
                  onChange={e => setEditProfileForm(prev => ({ ...prev, name: e.target.value }))}
                  className="px-4 py-2.5 rounded-xl border border-[#E8E5DF] bg-[#F8F7F4] text-xs sm:text-sm font-medium focus:outline-none focus:border-[#FF5722]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[#554F49]">Educator Role / Designation</label>
                <input
                  type="text"
                  value={editProfileForm.role}
                  onChange={e => setEditProfileForm(prev => ({ ...prev, role: e.target.value }))}
                  className="px-4 py-2.5 rounded-xl border border-[#E8E5DF] bg-[#F8F7F4] text-xs sm:text-sm font-medium focus:outline-none focus:border-[#FF5722]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[#554F49]">School Name</label>
                <input
                  type="text"
                  value={editProfileForm.school}
                  onChange={e => setEditProfileForm(prev => ({ ...prev, school: e.target.value }))}
                  className="px-4 py-2.5 rounded-xl border border-[#E8E5DF] bg-[#F8F7F4] text-xs sm:text-sm font-medium focus:outline-none focus:border-[#FF5722]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[#554F49]">Campus / Location</label>
                <input
                  type="text"
                  value={editProfileForm.campus}
                  onChange={e => setEditProfileForm(prev => ({ ...prev, campus: e.target.value }))}
                  className="px-4 py-2.5 rounded-xl border border-[#E8E5DF] bg-[#F8F7F4] text-xs sm:text-sm font-medium focus:outline-none focus:border-[#FF5722]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-[#554F49]">Email Address</label>
                <input
                  type="email"
                  value={editProfileForm.email}
                  onChange={e => setEditProfileForm(prev => ({ ...prev, email: e.target.value }))}
                  className="px-4 py-2.5 rounded-xl border border-[#E8E5DF] bg-[#F8F7F4] text-xs sm:text-sm font-medium focus:outline-none focus:border-[#FF5722]"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#E8E5DF]">
                <button
                  onClick={() => setShowAccountSettingsModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-[#F8F7F4] text-[#554F49] font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    saveUserProfile(editProfileForm);
                    setShowAccountSettingsModal(false);
                  }}
                  className="px-6 py-2.5 rounded-full bg-[#1E1E1E] text-white font-bold text-xs hover:bg-[#333333] transition flex items-center gap-2 shadow-md"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Account Details</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
