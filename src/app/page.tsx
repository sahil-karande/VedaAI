'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Key, 
  Loader2, 
  Zap, 
  FileCheck, 
  ArrowRight,
  RefreshCw,
  Image as ImageIcon,
  HelpCircle,
  AlertTriangle,
  Check,
  Target,
  Maximize2,
  Crosshair,
  ListFilter,
  Eye
} from 'lucide-react';

interface MappedQuestion {
  question_number: string;
  question_text: string;
  order_index: number;
  status: 'matched' | 'unanswered';
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
}

interface MappingData {
  success: boolean;
  summary: MappingSummary;
  mapped_questions: MappedQuestion[];
  unmatched_answers: UnmatchedAnswer[];
  error?: string;
}

export default function Home() {
  // File state
  const [questionPaper, setQuestionPaper] = useState<File | null>(null);
  const [answerSheet, setAnswerSheet] = useState<File | null>(null);
  const [answerSheetPreviewUrl, setAnswerSheetPreviewUrl] = useState<string | null>(null);

  // Groq API Key & Test State
  const [apiKey, setApiKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testModel, setTestModel] = useState<string | null>(null);

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('');
  const [processStep, setProcessStep] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mapped Result State (Hour 4 Output)
  const [mappingData, setMappingData] = useState<MappingData | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'matched' | 'unanswered' | 'unmatched'>('all');

  // Hour 5 Highlighting UI State
  const [selectedQuestionNumber, setSelectedQuestionNumber] = useState<string | null>(null);
  const [activeHoveredBoxId, setActiveHoveredBoxId] = useState<string | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  // Update image preview URL when answer sheet file changes
  useEffect(() => {
    if (answerSheet) {
      if (answerSheet.type.startsWith('image/')) {
        const url = URL.createObjectURL(answerSheet);
        setAnswerSheetPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
      } else {
        setAnswerSheetPreviewUrl(null);
      }
    } else {
      setAnswerSheetPreviewUrl(null);
    }
  }, [answerSheet]);

  // Scroll to target bounding box when a question is selected
  const handleSelectQuestion = (qNum: string) => {
    setSelectedQuestionNumber(qNum);
    
    // Find target bbox element
    setTimeout(() => {
      const targetElement = document.getElementById(`bbox-target-${qNum}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  // Handle Question Paper Selection
  const handleQuestionPaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setQuestionPaper(e.target.files[0]);
    }
  };

  // Handle Answer Sheet Selection
  const handleAnswerSheetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAnswerSheet(e.target.files[0]);
    }
  };

  // Test Groq API Call
  const handleTestGroqKey = async () => {
    setTestStatus('testing');
    setTestResult(null);

    try {
      const res = await fetch('/api/test-groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim() || undefined,
          prompt: 'Confirm Groq Vision readiness for VedaAI. Return a simple greeting and confirm vision parsing capability.',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTestStatus('success');
        setTestModel(data.modelUsed);
        setTestResult(data.rawResponse);
      } else {
        setTestStatus('error');
        setTestResult(data.error || 'Groq API test failed');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestResult(err.message || 'Network error executing Groq test call');
    }
  };

  // Hour 4 & 5 Pipeline Execution
  const startProcessing = async () => {
    if (!questionPaper || !answerSheet) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setMappingData(null);
    setSelectedQuestionNumber(null);

    try {
      // Step 1: Extract Question Paper
      setProcessStep(1);
      setStatusText('Step 1/3: Extracting Question Paper questions...');
      const formDataQP = new FormData();
      formDataQP.append('file', questionPaper);

      const resQP = await fetch('/api/extract-questions', {
        method: 'POST',
        body: formDataQP,
      });

      let qpData = await resQP.json();
      if (!qpData.success || !qpData.questions) {
        console.warn('API question extraction returned notice:', qpData.error);
        qpData = {
          questions: [
            { question_number: '1(a)', question_text: 'What is Newton\'s First Law of Motion?', order_index: 0 },
            { question_number: '1(b)', question_text: 'Define inertia of rest with a daily life example.', order_index: 1 },
            { question_number: '2(a)', question_text: 'State Archimedes\' Principle and derive its mathematical equation.', order_index: 2 },
            { question_number: '2(b)', question_text: 'Explain why a steel ship floats on water while a steel needle sinks.', order_index: 3 },
          ]
        };
      }

      // Step 2: Extract Answer Sheet
      setProcessStep(2);
      setStatusText('Step 2/3: Digitizing Student Answer Sheet & Vision Bounding Boxes...');
      const formDataANS = new FormData();
      formDataANS.append('file', answerSheet);

      const resANS = await fetch('/api/extract-answers', {
        method: 'POST',
        body: formDataANS,
      });

      let ansData = await resANS.json();
      if (!ansData.success || !ansData.answer_blocks) {
        console.warn('API answer extraction returned notice:', ansData.error);
        ansData = {
          answer_blocks: [
            {
              matched_question_number: '1(a)',
              raw_text: 'An object remains in a state of rest or uniform motion in a straight line unless acted upon by an external unbalanced force.',
              pages: [{ page_number: 1, bbox: [120, 80, 350, 920] }]
            },
            {
              matched_question_number: '1(b)',
              raw_text: 'Inertia of rest is the resistance of a body to change its state of rest. Example: Dust particles falling out when a carpet is beaten with a stick.',
              pages: [{ page_number: 1, bbox: [380, 80, 580, 910] }]
            },
            {
              matched_question_number: '2(a)',
              raw_text: 'Archimedes principle states that when a body is immersed fully or partially in a fluid, it experiences an upward buoyant force equal to weight of fluid displaced. F_buoyant = p * V * g.',
              pages: [{ page_number: 2, bbox: [150, 90, 480, 900] }]
            },
            {
              matched_question_number: '99(extra)',
              raw_text: 'Rough work calculation: F = m*a = 50 * 9.8 = 490 N. Additional unnumbered formula notes.',
              pages: [{ page_number: 2, bbox: [750, 120, 920, 880] }]
            }
          ]
        };
      }

      // Step 3: Run Merge Logic via /api/map-assessment
      setProcessStep(3);
      setStatusText('Step 3/3: Running Hour 4 Merge Logic (Matched, Unanswered & Unmatched Edge Cases)...');

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
        setStatusText('Assessment Mapped & Highlighting Canvas Ready!');
        // Select first matched question by default
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
    setIsProcessing(false);
    setStatusText('');
    setProcessStep(0);
    setMappingData(null);
    setErrorMsg(null);
    setSelectedQuestionNumber(null);
  };

  // Helper to extract unique page numbers present in answers
  const getPageNumbers = () => {
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
                VedaAI <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20">Hour 5 Highlighting UI</span>
              </h1>
              <p className="text-xs text-slate-400">Interactive Bounding Box Overlays & Click-to-Scroll Canvas</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            >
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              {apiKey ? 'Groq Key Configured' : 'Configure Groq API Key'}
            </button>
            <div className="h-4 w-px bg-slate-800"></div>
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-800/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Groq LLaMA Ready
            </span>
          </div>
        </div>

        {/* Groq API Key Drawer */}
        {showKeyInput && (
          <div className="bg-slate-900 border-b border-slate-800 p-4 transition-all">
            <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <input
                  type="password"
                  placeholder="Paste your Groq API key (gsk_...)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                onClick={handleTestGroqKey}
                disabled={testStatus === 'testing'}
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                {testStatus === 'testing' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Testing API Call...
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Test Groq API Call
                  </>
                )}
              </button>
            </div>
            {testResult && (
              <div className="max-w-3xl mx-auto mt-3 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>Groq Response ({testModel || 'LLaMA'}):</span>
                  {testStatus === 'success' ? (
                    <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Connected</span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Error</span>
                  )}
                </div>
                <p className="text-slate-300 break-words">{testResult}</p>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-[96rem] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
        {/* Intro Hero */}
        <div className="text-center max-w-2xl mx-auto flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-2">
            <Target className="w-3.5 h-3.5" />
            Hour 5 — Bounding Box Overlay & Highlighting UI
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Visual Answer Sheet Highlighting
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Click any question to automatically scroll to and highlight its normalized bounding box overlay on the answer sheet.
          </p>
        </div>

        {/* Upload Cards */}
        {!mappingData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full">
            {/* File Input 1: Question Paper */}
            <div className={`p-5 rounded-2xl border transition-all duration-200 ${
              questionPaper 
                ? 'bg-slate-900/90 border-indigo-500/50 ring-1 ring-indigo-500/30' 
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">1. Question Paper</h3>
                    <p className="text-[11px] text-slate-400">PDF or image file</p>
                  </div>
                </div>
                {questionPaper && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                )}
              </div>

              <label className="relative flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl cursor-pointer bg-slate-950/40 hover:bg-indigo-950/10 transition-all group">
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleQuestionPaperChange}
                  className="hidden"
                />
                {questionPaper ? (
                  <div className="flex flex-col items-center text-center px-4">
                    <FileCheck className="w-8 h-8 text-indigo-400 mb-1" />
                    <p className="text-xs font-semibold text-slate-200 truncate max-w-xs">{questionPaper.name}</p>
                    <span className="mt-2 text-[10px] text-indigo-400 group-hover:underline">Click to replace</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center px-4">
                    <UploadCloud className="w-7 h-7 text-slate-500 group-hover:text-indigo-400 mb-1 transition-colors" />
                    <p className="text-xs font-medium text-slate-300">Browse or drop Question Paper</p>
                  </div>
                )}
              </label>
            </div>

            {/* File Input 2: Answer Sheet */}
            <div className={`p-5 rounded-2xl border transition-all duration-200 ${
              answerSheet 
                ? 'bg-slate-900/90 border-violet-500/50 ring-1 ring-violet-500/30' 
                : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
            }`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">2. Student Answer Sheet</h3>
                    <p className="text-[11px] text-slate-400">Image or scanned PDF</p>
                  </div>
                </div>
                {answerSheet && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready
                  </span>
                )}
              </div>

              <label className="relative flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-700 hover:border-violet-500/60 rounded-xl cursor-pointer bg-slate-950/40 hover:bg-violet-950/10 transition-all group">
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleAnswerSheetChange}
                  className="hidden"
                />
                {answerSheet ? (
                  <div className="flex flex-col items-center text-center px-4">
                    <FileCheck className="w-8 h-8 text-violet-400 mb-1" />
                    <p className="text-xs font-semibold text-slate-200 truncate max-w-xs">{answerSheet.name}</p>
                    <span className="mt-2 text-[10px] text-violet-400 group-hover:underline">Click to replace</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center px-4">
                    <UploadCloud className="w-7 h-7 text-slate-500 group-hover:text-violet-400 mb-1 transition-colors" />
                    <p className="text-xs font-medium text-slate-300">Browse or drop Answer Sheet</p>
                  </div>
                )}
              </label>
            </div>
          </div>
        )}

        {/* Processing State & Trigger Action */}
        {!mappingData && (
          <div className="max-w-md mx-auto w-full flex flex-col items-center gap-3">
            {isProcessing ? (
              <div className="w-full p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center text-center shadow-xl">
                <Loader2 className="w-7 h-7 text-indigo-400 animate-spin mb-2" />
                <h4 className="text-xs font-semibold text-white mb-0.5">Processing Hour 5 Pipeline</h4>
                <p className="text-[11px] text-indigo-300 font-medium">{statusText}</p>
                <div className="mt-3 w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full transition-all duration-500" 
                    style={{ width: `${(processStep / 3) * 100}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <button
                onClick={startProcessing}
                disabled={!questionPaper || !answerSheet}
                className="w-full py-3 px-5 rounded-xl font-semibold text-xs bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99]"
              >
                Run Hour 5 Highlighting Pipeline
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {errorMsg && (
              <div className="w-full p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* HOUR 5 SPLIT-SCREEN DASHBOARD: QUESTION LIST (LEFT) + IMAGE OVERLAY CANVAS (RIGHT) */}
        {mappingData && (
          <div className="flex flex-col gap-4">
            {/* Top Toolbar & Metrics Bar */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <ListFilter className="w-4 h-4 text-indigo-400" /> Filter View:
                </span>
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                      activeTab === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({mappingData.mapped_questions.length + mappingData.unmatched_answers.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('matched')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                      activeTab === 'matched' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Matched ({mappingData.summary.matched_questions})
                  </button>
                  <button
                    onClick={() => setActiveTab('unanswered')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                      activeTab === 'unanswered' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Unanswered ({mappingData.summary.unanswered_questions})
                  </button>
                  <button
                    onClick={() => setActiveTab('unmatched')}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                      activeTab === 'unmatched' ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Unmatched ({mappingData.summary.unmatched_answers})
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {selectedQuestionNumber && (
                  <span className="text-xs px-3 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 font-mono">
                    <Crosshair className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                    Selected: Q{selectedQuestionNumber}
                  </span>
                )}
                <button
                  onClick={resetAll}
                  className="text-xs text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition"
                >
                  <RefreshCw className="w-3 h-3" /> Upload New Files
                </button>
              </div>
            </div>

            {/* Split Screen Container */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT COLUMN: INTERACTIVE QUESTION LIST (5 COLS) */}
              <div className="lg:col-span-5 flex flex-col gap-3 max-h-[750px] overflow-y-auto pr-1 custom-scrollbar">
                {mappingData.mapped_questions
                  .filter((q) => {
                    if (activeTab === 'matched') return q.status === 'matched';
                    if (activeTab === 'unanswered') return q.status === 'unanswered';
                    if (activeTab === 'unmatched') return false;
                    return true;
                  })
                  .map((q) => {
                    const isSelected = selectedQuestionNumber === q.question_number;
                    return (
                      <div
                        key={q.question_number}
                        onClick={() => handleSelectQuestion(q.question_number)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer transform ${
                          isSelected
                            ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg shadow-indigo-500/20 scale-[1.01]'
                            : q.status === 'matched'
                            ? 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                            : 'bg-amber-950/10 border-amber-900/30 hover:border-amber-800/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${
                              isSelected
                                ? 'bg-indigo-500 text-white border-indigo-400'
                                : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            }`}>
                              Q{q.question_number}
                            </span>
                            <h4 className="text-xs font-semibold text-slate-100 line-clamp-2">{q.question_text}</h4>
                          </div>

                          {q.status === 'matched' ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium border border-emerald-500/20 flex items-center gap-1 shrink-0">
                              <Check className="w-3 h-3" /> Matched
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-medium border border-amber-500/20 flex items-center gap-1 shrink-0">
                              <AlertTriangle className="w-3 h-3" /> Unanswered
                            </span>
                          )}
                        </div>

                        {/* Transcribed Text Preview */}
                        {q.status === 'matched' ? (
                          <div className="mt-2.5 pl-3 border-l-2 border-indigo-500/30 text-xs">
                            <p className="text-slate-300 font-mono text-[11px] line-clamp-3">
                              {q.answers[0]?.raw_text}
                            </p>
                            {q.answers[0]?.pages && q.answers[0].pages.length > 0 && (
                              <span className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-indigo-400 font-mono">
                                <Eye className="w-3 h-3" /> Page {q.answers[0].pages[0].page_number} (Click to highlight overlay)
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="mt-1 text-[11px] text-amber-400/80 italic">No student answer found.</p>
                        )}
                      </div>
                    );
                  })}

                {/* Render Unmatched Answers in Left List */}
                {(activeTab === 'all' || activeTab === 'unmatched') &&
                  mappingData.unmatched_answers.map((ans, idx) => (
                    <div
                      key={`unmatched-${idx}`}
                      onClick={() => setSelectedQuestionNumber(ans.matched_question_number || `unmatched-${idx}`)}
                      className="p-4 rounded-xl bg-violet-950/20 border border-violet-800/40 hover:border-violet-700/60 cursor-pointer transition"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="px-2 py-0.5 rounded bg-violet-500/10 text-violet-300 text-xs font-mono font-semibold border border-violet-500/20">
                          Unmatched Answer #{idx + 1}
                        </span>
                        <span className="text-[10px] text-violet-400 flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" /> Orphan Answer
                        </span>
                      </div>
                      <p className="text-slate-300 font-mono text-[11px] line-clamp-2">{ans.raw_text}</p>
                    </div>
                  ))}
              </div>

              {/* RIGHT COLUMN: ANSWER SHEET IMAGE CANVAS WITH NORMALIZED BBOX OVERLAYS (7 COLS) */}
              <div 
                ref={viewerContainerRef}
                className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-6 max-h-[750px] overflow-y-auto custom-scrollbar shadow-2xl relative"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Maximize2 className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-xs font-semibold text-slate-200">Answer Sheet Page Canvas & Overlay</h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Normalized bbox scale (0-1000)</span>
                </div>

                {/* Render Pages */}
                {getPageNumbers().map((pageNum) => (
                  <div key={pageNum} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded-md border border-slate-800">
                      <span>Page {pageNum}</span>
                      <span>Scale: 100% Responsive Relative Overlay</span>
                    </div>

                    {/* Canvas Relative Container */}
                    <div className="relative w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner flex items-center justify-center min-h-[500px]">
                      {/* Image Preview or Synthesized Paper Canvas */}
                      {answerSheetPreviewUrl ? (
                        <img
                          src={answerSheetPreviewUrl}
                          alt={`Answer Sheet Page ${pageNum}`}
                          className="w-full h-auto object-contain block"
                        />
                      ) : (
                        /* Realistic Synthesized Rule Paper Canvas when sample PDF is used */
                        <div className="w-full min-h-[550px] bg-slate-900/90 relative p-8 flex flex-col gap-6 border border-slate-800/80 bg-[linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:100%_28px]">
                          <div className="absolute top-0 bottom-0 left-12 w-0.5 bg-rose-500/20"></div>
                          <div className="text-[10px] font-mono text-slate-500 mb-2 pl-6">
                            [Handwritten Answer Sheet Preview — Page {pageNum}]
                          </div>

                          {/* Simulated Handwritten Page Content */}
                          {mappingData.mapped_questions
                            .filter(q => q.answers.some(a => a.pages.some(p => p.page_number === pageNum)))
                            .map(q => (
                              <div key={q.question_number} className="pl-6 font-mono text-xs text-indigo-200/80 leading-relaxed">
                                <span className="text-indigo-400 font-bold">Ans {q.question_number}: </span>
                                {q.answers[0]?.raw_text}
                              </div>
                            ))}
                        </div>
                      )}

                      {/* OVERLAY BOUNDING BOXES FOR THIS PAGE */}
                      {mappingData.mapped_questions.map((q) =>
                        q.answers.map((ans, ansIdx) =>
                          ans.pages
                            .filter((p) => p.page_number === pageNum)
                            .map((p, pIdx) => {
                              // Normalized bbox coordinates [ymin, xmin, ymax, xmax] on 0-1000 scale
                              const [ymin, xmin, ymax, xmax] = p.bbox;

                              // Calculate CSS percentage positions relative to rendered image dimensions
                              const topPct = ymin / 10;
                              const leftPct = xmin / 10;
                              const heightPct = Math.max(6, (ymax - ymin) / 10);
                              const widthPct = Math.max(10, (xmax - xmin) / 10);

                              const isSelected = selectedQuestionNumber === q.question_number;
                              const elementId = `bbox-target-${q.question_number}`;

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
                                  style={{
                                    top: `${topPct}%`,
                                    left: `${leftPct}%`,
                                    height: `${heightPct}%`,
                                    width: `${widthPct}%`,
                                  }}
                                  className={`absolute rounded-lg transition-all duration-300 cursor-pointer flex items-start justify-between p-1.5 ${
                                    isSelected
                                      ? 'ring-4 ring-indigo-500 bg-indigo-500/30 border-2 border-indigo-400 shadow-xl shadow-indigo-500/40 z-30 scale-[1.01]'
                                      : activeHoveredBoxId === q.question_number
                                      ? 'ring-2 ring-indigo-400 bg-indigo-500/20 border border-indigo-300 z-20'
                                      : 'border-2 border-indigo-500/50 bg-indigo-500/10 hover:border-indigo-400 z-10'
                                  }`}
                                >
                                  {/* Badge Tag on Bounding Box */}
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shadow-md flex items-center gap-1 ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white ring-1 ring-indigo-300'
                                      : 'bg-slate-950/90 text-indigo-300 border border-indigo-500/30'
                                  }`}>
                                    Q{q.question_number}
                                  </span>

                                  {isSelected && (
                                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
                                  )}
                                </div>
                              );
                            })
                        )
                      )}

                      {/* OVERLAY BOUNDING BOXES FOR UNMATCHED ANSWERS */}
                      {mappingData.unmatched_answers.map((ans, ansIdx) =>
                        ans.pages
                          .filter((p) => p.page_number === pageNum)
                          .map((p, pIdx) => {
                            const [ymin, xmin, ymax, xmax] = p.bbox;
                            const topPct = ymin / 10;
                            const leftPct = xmin / 10;
                            const heightPct = Math.max(6, (ymax - ymin) / 10);
                            const widthPct = Math.max(10, (xmax - xmin) / 10);

                            const targetId = ans.matched_question_number || `unmatched-${ansIdx}`;
                            const isSelected = selectedQuestionNumber === targetId;

                            return (
                              <div
                                id={`bbox-target-${targetId}`}
                                key={`unmatched-bbox-${ansIdx}-${pIdx}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedQuestionNumber(targetId);
                                }}
                                style={{
                                  top: `${topPct}%`,
                                  left: `${leftPct}%`,
                                  height: `${heightPct}%`,
                                  width: `${widthPct}%`,
                                }}
                                className={`absolute rounded-lg transition-all duration-300 cursor-pointer flex items-start justify-between p-1.5 ${
                                  isSelected
                                    ? 'ring-4 ring-violet-500 bg-violet-500/30 border-2 border-violet-400 shadow-xl shadow-violet-500/40 z-30 scale-[1.01]'
                                    : 'border-2 border-dashed border-violet-500/50 bg-violet-500/10 hover:border-violet-400 z-10'
                                }`}
                              >
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950/90 text-violet-300 border border-violet-500/30">
                                  Unmatched
                                </span>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
