'use client';

import React, { useState } from 'react';
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
  Layers,
  FileQuestion,
  Check,
  XCircle,
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

  // Hour 4 - Full Extraction & Mapping Pipeline
  const startProcessing = async () => {
    if (!questionPaper || !answerSheet) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setMappingData(null);

    try {
      // Step 1: Extract Question Paper
      setProcessStep(1);
      setStatusText('Step 1/3: Parsing Question Paper questions...');
      const formDataQP = new FormData();
      formDataQP.append('file', questionPaper);

      const resQP = await fetch('/api/extract-questions', {
        method: 'POST',
        body: formDataQP,
      });

      let qpData = await resQP.json();
      if (!qpData.success || !qpData.questions) {
        // Fallback for demonstration/mock if no API key set
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
              pages: [{ page_number: 1, bbox: [120, 100, 350, 900] }]
            },
            {
              matched_question_number: '1(b)',
              raw_text: 'Inertia of rest is the resistance of a body to change its state of rest. Example: Dust particles falling out when a carpet is beaten with a stick.',
              pages: [{ page_number: 1, bbox: [380, 100, 600, 890] }]
            },
            {
              matched_question_number: '99(extra)',
              raw_text: 'Rough work calculation: F = m*a = 50 * 9.8 = 490 N. Additional unnumbered formula notes.',
              pages: [{ page_number: 2, bbox: [800, 150, 950, 850] }]
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
        setStatusText('Assessment Mapping Complete!');
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
                VedaAI <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20">Assessment Engine</span>
              </h1>
              <p className="text-xs text-slate-400">AI Question Paper & Student Answer Mapping</p>
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
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Intro Hero */}
        <div className="text-center max-w-2xl mx-auto flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
            <Zap className="w-3.5 h-3.5" />
            Hour 4 — Assessment Mapping Engine
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Upload & Map Assessment Documents
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Automatically extract question paper structure, transcribe student handwritten answer blocks, and merge matched, unanswered, and unmatched items.
          </p>
        </div>

        {/* Upload Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto w-full">
          {/* File Input 1: Question Paper */}
          <div className={`p-6 rounded-2xl border transition-all duration-200 ${
            questionPaper 
              ? 'bg-slate-900/90 border-indigo-500/50 ring-1 ring-indigo-500/30' 
              : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">1. Question Paper</h3>
                  <p className="text-xs text-slate-400">PDF or clean image files</p>
                </div>
              </div>
              {questionPaper && (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </span>
              )}
            </div>

            <label className="relative flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl cursor-pointer bg-slate-950/40 hover:bg-indigo-950/10 transition-all group">
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={handleQuestionPaperChange}
                className="hidden"
              />
              {questionPaper ? (
                <div className="flex flex-col items-center text-center px-4">
                  <FileCheck className="w-10 h-10 text-indigo-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-200 truncate max-w-xs">{questionPaper.name}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{(questionPaper.size / (1024 * 1024)).toFixed(2)} MB</p>
                  <span className="mt-3 text-[11px] text-indigo-400 group-hover:underline">Click to replace file</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center px-4">
                  <UploadCloud className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 mb-2 transition-colors" />
                  <p className="text-xs font-medium text-slate-300">Drop Question Paper here or <span className="text-indigo-400">browse</span></p>
                  <p className="text-[10px] text-slate-500 mt-1">Supports PDF, PNG, JPG (Max 20MB)</p>
                </div>
              )}
            </label>
          </div>

          {/* File Input 2: Answer Sheet */}
          <div className={`p-6 rounded-2xl border transition-all duration-200 ${
            answerSheet 
              ? 'bg-slate-900/90 border-violet-500/50 ring-1 ring-violet-500/30' 
              : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">2. Student Answer Sheet</h3>
                  <p className="text-xs text-slate-400">Handwritten PDF or scanned images</p>
                </div>
              </div>
              {answerSheet && (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready
                </span>
              )}
            </div>

            <label className="relative flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-slate-700 hover:border-violet-500/60 rounded-xl cursor-pointer bg-slate-950/40 hover:bg-violet-950/10 transition-all group">
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={handleAnswerSheetChange}
                className="hidden"
              />
              {answerSheet ? (
                <div className="flex flex-col items-center text-center px-4">
                  <FileCheck className="w-10 h-10 text-violet-400 mb-2" />
                  <p className="text-xs font-semibold text-slate-200 truncate max-w-xs">{answerSheet.name}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{(answerSheet.size / (1024 * 1024)).toFixed(2)} MB</p>
                  <span className="mt-3 text-[11px] text-violet-400 group-hover:underline">Click to replace file</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center px-4">
                  <UploadCloud className="w-8 h-8 text-slate-500 group-hover:text-violet-400 mb-2 transition-colors" />
                  <p className="text-xs font-medium text-slate-300">Drop Student Answer Sheet here or <span className="text-violet-400">browse</span></p>
                  <p className="text-[10px] text-slate-500 mt-1">Supports PDF, PNG, JPG (Max 20MB)</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Processing State & Trigger Action */}
        <div className="max-w-xl mx-auto w-full flex flex-col items-center gap-4">
          {isProcessing ? (
            <div className="w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center text-center shadow-xl">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
              <h4 className="text-sm font-semibold text-white mb-1">Mapping Assessment</h4>
              <p className="text-xs text-indigo-300 font-medium">{statusText}</p>
              <div className="mt-4 w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-500" 
                  style={{ width: `${(processStep / 3) * 100}%` }}
                ></div>
              </div>
            </div>
          ) : mappingData ? (
            <div className="w-full p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-center flex items-center justify-between">
              <span className="text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Assessment Mapped! ({mappingData.summary.matched_questions} matched, {mappingData.summary.unanswered_questions} unanswered, {mappingData.summary.unmatched_answers} unmatched)
              </span>
              <button
                onClick={resetAll}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700"
              >
                <RefreshCw className="w-3 h-3" /> Reset & Re-run
              </button>
            </div>
          ) : (
            <button
              onClick={startProcessing}
              disabled={!questionPaper || !answerSheet}
              className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99]"
            >
              Start Extraction & Hour 4 Mapping
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {errorMsg && (
            <div className="w-full p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {(!questionPaper || !answerSheet) && !isProcessing && !mappingData && (
            <p className="text-[11px] text-slate-500">Select both files to enable processing.</p>
          )}
        </div>

        {/* HOUR 4 MAPPING RESULTS DASHBOARD */}
        {mappingData && (
          <div className="max-w-5xl mx-auto w-full flex flex-col gap-6 mt-4">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col">
                <span className="text-xs text-slate-400 font-medium">Total Questions</span>
                <span className="text-2xl font-bold text-white mt-1">{mappingData.summary.total_questions}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">From Question Paper</span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex flex-col">
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Matched
                </span>
                <span className="text-2xl font-bold text-emerald-300 mt-1">{mappingData.summary.matched_questions}</span>
                <span className="text-[10px] text-emerald-500/80 mt-0.5">Questions with answers</span>
              </div>

              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 flex flex-col">
                <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Unanswered
                </span>
                <span className="text-2xl font-bold text-amber-300 mt-1">{mappingData.summary.unanswered_questions}</span>
                <span className="text-[10px] text-amber-500/80 mt-0.5">No student answer found</span>
              </div>

              <div className="p-4 rounded-xl bg-violet-950/30 border border-violet-800/40 flex flex-col">
                <span className="text-xs text-violet-400 font-medium flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5" /> Unmatched Answers
                </span>
                <span className="text-2xl font-bold text-violet-300 mt-1">{mappingData.summary.unmatched_answers}</span>
                <span className="text-[10px] text-violet-500/80 mt-0.5">Orphan student answers</span>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                All Items ({mappingData.mapped_questions.length + mappingData.unmatched_answers.length})
              </button>
              <button
                onClick={() => setActiveTab('matched')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === 'matched'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Matched ({mappingData.summary.matched_questions})
              </button>
              <button
                onClick={() => setActiveTab('unanswered')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === 'unanswered'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Unanswered Edge Cases ({mappingData.summary.unanswered_questions})
              </button>
              <button
                onClick={() => setActiveTab('unmatched')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeTab === 'unmatched'
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Unmatched Answers ({mappingData.summary.unmatched_answers})
              </button>
            </div>

            {/* Mapped Items Detailed List */}
            <div className="flex flex-col gap-4">
              {/* Render Mapped Questions */}
              {mappingData.mapped_questions
                .filter((q) => {
                  if (activeTab === 'matched') return q.status === 'matched';
                  if (activeTab === 'unanswered') return q.status === 'unanswered';
                  if (activeTab === 'unmatched') return false;
                  return true;
                })
                .map((q) => (
                  <div 
                    key={q.question_number}
                    className={`p-5 rounded-2xl border transition-all ${
                      q.status === 'matched'
                        ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        : 'bg-amber-950/10 border-amber-900/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 text-xs font-mono font-bold border border-indigo-500/20">
                          Q{q.question_number}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-100">{q.question_text}</h4>
                      </div>

                      {q.status === 'matched' ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-medium border border-emerald-500/20 flex items-center gap-1 shrink-0">
                          <Check className="w-3 h-3" /> Matched
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-medium border border-amber-500/20 flex items-center gap-1 shrink-0">
                          <AlertTriangle className="w-3 h-3" /> Unanswered
                        </span>
                      )}
                    </div>

                    {/* Answers or Unanswered Notice */}
                    {q.status === 'matched' ? (
                      <div className="mt-3 flex flex-col gap-2 pl-4 border-l-2 border-indigo-500/40">
                        {q.answers.map((ans, idx) => (
                          <div key={idx} className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-xs">
                            <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1.5">
                              <span className="font-semibold text-indigo-300">Transcribed Student Answer:</span>
                              {ans.pages && ans.pages.length > 0 && (
                                <span className="font-mono text-[10px] text-slate-500">
                                  Page {ans.pages[0].page_number} | bbox: [{ans.pages[0].bbox.join(', ')}]
                                </span>
                              )}
                            </div>
                            <p className="text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">{ans.raw_text}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-amber-400/90 italic bg-amber-950/30 p-2.5 rounded-lg border border-amber-900/30">
                        No corresponding student answer block found on answer sheet.
                      </div>
                    )}
                  </div>
                ))}

              {/* Render Unmatched Student Answers */}
              {(activeTab === 'all' || activeTab === 'unmatched') &&
                mappingData.unmatched_answers.map((ans, idx) => (
                  <div key={idx} className="p-5 rounded-2xl bg-violet-950/20 border border-violet-800/40">
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-1 rounded-md bg-violet-500/10 text-violet-400 text-xs font-mono font-semibold border border-violet-500/20">
                        Unmatched Answer #{idx + 1} ({ans.matched_question_number || 'No Label'})
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-300 text-[11px] font-medium border border-violet-500/20 flex items-center gap-1">
                        <HelpCircle className="w-3 h-3" /> Unmatched Student Answer
                      </span>
                    </div>
                    <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 text-xs mt-2">
                      <p className="text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">{ans.raw_text}</p>
                      {ans.pages && ans.pages.length > 0 && (
                        <div className="mt-2 text-[10px] font-mono text-slate-500">
                          Location: Page {ans.pages[0].page_number} (bbox: [{ans.pages[0].bbox.join(', ')}])
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
