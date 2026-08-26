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
  Image as ImageIcon
} from 'lucide-react';

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

  // Processing state for Hour 1 requirements: "spinner + status text"
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('');
  const [processStep, setProcessStep] = useState<number>(0);

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

  // Basic processing flow demonstration for Hour 1
  const startProcessing = async () => {
    if (!questionPaper || !answerSheet) return;

    setIsProcessing(true);
    setProcessStep(1);
    setStatusText('Step 1/3: Reading Question Paper and Answer Sheet files...');

    setTimeout(() => {
      setProcessStep(2);
      setStatusText('Step 2/3: Connecting to Groq AI for extraction...');
      
      setTimeout(() => {
        setProcessStep(3);
        setStatusText('Step 3/3: Mapping student answers with confidence scores...');
        
        setTimeout(() => {
          setIsProcessing(false);
          setStatusText('Processing Ready! Scaffolding complete for Hour 1.');
        }, 1500);
      }, 1500);
    }, 1200);
  };

  const resetAll = () => {
    setQuestionPaper(null);
    setAnswerSheet(null);
    setIsProcessing(false);
    setStatusText('');
    setProcessStep(0);
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
              <p className="text-xs text-slate-400">AI Question Paper & Answer Sheet Extraction</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Groq Key Config Button */}
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
            Hour 1 Setup — Upload & Multimodal Skeleton
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Upload Assessment Documents
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Provide the original question paper and student handwritten answer sheet to automatically extract and map questions.
          </p>
        </div>

        {/* Upload Card Container */}
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

        {/* Processing State & Action Controls */}
        <div className="max-w-xl mx-auto w-full flex flex-col items-center gap-4 mt-2">
          {isProcessing ? (
            /* Basic Processing / Loading State requirement: "spinner + status text" */
            <div className="w-full p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center text-center shadow-xl">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-3" />
              <h4 className="text-sm font-semibold text-white mb-1">Processing Assessment</h4>
              <p className="text-xs text-indigo-300 font-medium">{statusText}</p>
              <div className="mt-4 w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-500" 
                  style={{ width: `${(processStep / 3) * 100}%` }}
                ></div>
              </div>
            </div>
          ) : statusText ? (
            <div className="w-full p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-center flex items-center justify-between">
              <span className="text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {statusText}
              </span>
              <button
                onClick={resetAll}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Reset
              </button>
            </div>
          ) : (
            <button
              onClick={startProcessing}
              disabled={!questionPaper || !answerSheet}
              className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99]"
            >
              Start Processing & Extraction
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {(!questionPaper || !answerSheet) && !isProcessing && (
            <p className="text-[11px] text-slate-500">Select both files to enable processing.</p>
          )}
        </div>

        {/* Groq Quick Tester Card */}
        <div className="max-w-3xl mx-auto w-full mt-6 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold text-slate-200">Groq API Connectivity & Vision Test</h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">POST /api/test-groq</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Verify fast LLM & multimodal calls using Groq LLaMA models directly before running extraction tasks.
          </p>
          
          <div className="flex gap-2">
            <button
              onClick={handleTestGroqKey}
              disabled={testStatus === 'testing'}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-2 transition"
            >
              {testStatus === 'testing' ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-400" />}
              Run Live Groq API Connectivity Check
            </button>
          </div>

          {testResult && (
            <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
              <div className="text-indigo-400 font-semibold mb-1">Response ({testModel || 'Groq'}):</div>
              <pre className="text-slate-300 whitespace-pre-wrap text-[11px]">{testResult}</pre>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
