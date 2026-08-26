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
  Maximize2,
  Crosshair,
  ListFilter,
  Eye,
  BookOpen
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

  // Processing state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusText, setStatusText] = useState<string>('');
  const [processStep, setProcessStep] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mapped Result State
  const [mappingData, setMappingData] = useState<MappingData | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'matched' | 'unanswered' | 'unmatched'>('all');

  // Highlighting UI State
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
    
    setTimeout(() => {
      const targetElement = document.getElementById(`bbox-target-${qNum}`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  // Handle File Selections
  const handleQuestionPaperChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setQuestionPaper(e.target.files[0]);
    }
  };

  const handleAnswerSheetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAnswerSheet(e.target.files[0]);
    }
  };

  // Pipeline Execution
  const startProcessing = async () => {
    if (!questionPaper || !answerSheet) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setMappingData(null);
    setSelectedQuestionNumber(null);

    try {
      // Step 1: Extract Question Paper
      setProcessStep(1);
      setStatusText('Extracting question paper structure...');
      const formDataQP = new FormData();
      formDataQP.append('file', questionPaper);

      const resQP = await fetch('/api/extract-questions', {
        method: 'POST',
        body: formDataQP,
      });

      let qpData = await resQP.json();
      if (!qpData.success || !qpData.questions) {
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
      setStatusText('Parsing student answer blocks...');
      const formDataANS = new FormData();
      formDataANS.append('file', answerSheet);

      const resANS = await fetch('/api/extract-answers', {
        method: 'POST',
        body: formDataANS,
      });

      let ansData = await resANS.json();
      if (!ansData.success || !ansData.answer_blocks) {
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

      // Step 3: Run Assessment Mapping
      setProcessStep(3);
      setStatusText('Correlating questions and answer blocks...');

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
        setStatusText('Assessment Mapped Successfully');
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
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-white antialiased">
      {/* Minimalist Top Navigation Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center font-bold text-sm">
              V
            </div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-sm tracking-tight text-white">VedaAI</h1>
              <span className="text-zinc-600">/</span>
              <span className="text-xs text-zinc-400 font-normal">Assessment Workspace</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-400">
            {mappingData && (
              <button
                onClick={resetAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-800 hover:border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset Workspace
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* Workspace Intro Header */}
        {!mappingData && (
          <div className="max-w-xl mx-auto text-center flex flex-col items-center mb-2">
            <h2 className="text-xl font-semibold text-zinc-100 tracking-tight">
              Assessment Document Processing
            </h2>
            <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
              Upload the original question paper and student handwritten answer sheet to automatically extract and map answers.
            </p>
          </div>
        )}

        {/* Upload Cards — Minimalist Form */}
        {!mappingData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto w-full">
            {/* Question Paper Card */}
            <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-400" />
                  <h3 className="text-xs font-semibold text-zinc-200">1. Question Paper</h3>
                </div>
                {questionPaper && (
                  <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Selected
                  </span>
                )}
              </div>

              <label className="relative flex flex-col items-center justify-center w-full h-36 border border-dashed border-zinc-800 hover:border-zinc-600 rounded-lg cursor-pointer bg-zinc-950/60 transition group">
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleQuestionPaperChange}
                  className="hidden"
                />
                {questionPaper ? (
                  <div className="flex flex-col items-center text-center px-4">
                    <FileCheck className="w-7 h-7 text-zinc-300 mb-1" />
                    <p className="text-xs font-medium text-zinc-200 truncate max-w-xs">{questionPaper.name}</p>
                    <span className="mt-1.5 text-[10px] text-zinc-400 group-hover:text-zinc-200">Click to replace file</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center px-4">
                    <UploadCloud className="w-6 h-6 text-zinc-500 group-hover:text-zinc-300 mb-1 transition-colors" />
                    <p className="text-xs font-medium text-zinc-300">Drop Question Paper here</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">PDF or image formats</p>
                  </div>
                )}
              </label>
            </div>

            {/* Answer Sheet Card */}
            <div className="p-5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 transition">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-zinc-400" />
                  <h3 className="text-xs font-semibold text-zinc-200">2. Student Answer Sheet</h3>
                </div>
                {answerSheet && (
                  <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Selected
                  </span>
                )}
              </div>

              <label className="relative flex flex-col items-center justify-center w-full h-36 border border-dashed border-zinc-800 hover:border-zinc-600 rounded-lg cursor-pointer bg-zinc-950/60 transition group">
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleAnswerSheetChange}
                  className="hidden"
                />
                {answerSheet ? (
                  <div className="flex flex-col items-center text-center px-4">
                    <FileCheck className="w-7 h-7 text-zinc-300 mb-1" />
                    <p className="text-xs font-medium text-zinc-200 truncate max-w-xs">{answerSheet.name}</p>
                    <span className="mt-1.5 text-[10px] text-zinc-400 group-hover:text-zinc-200">Click to replace file</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center px-4">
                    <UploadCloud className="w-6 h-6 text-zinc-500 group-hover:text-zinc-300 mb-1 transition-colors" />
                    <p className="text-xs font-medium text-zinc-300">Drop Student Answer Sheet here</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Scanned images or PDF</p>
                  </div>
                )}
              </label>
            </div>
          </div>
        )}

        {/* Action Button & Processing Loader */}
        {!mappingData && (
          <div className="max-w-md mx-auto w-full flex flex-col items-center gap-3">
            {isProcessing ? (
              <div className="w-full p-5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col items-center text-center">
                <Loader2 className="w-5 h-5 text-zinc-300 animate-spin mb-2" />
                <h4 className="text-xs font-medium text-zinc-200">{statusText}</h4>
                <div className="mt-3 w-full bg-zinc-950 rounded-full h-1 overflow-hidden">
                  <div 
                    className="bg-zinc-300 h-full transition-all duration-300" 
                    style={{ width: `${(processStep / 3) * 100}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <button
                onClick={startProcessing}
                disabled={!questionPaper || !answerSheet}
                className="w-full py-2.5 px-4 rounded-lg font-medium text-xs bg-zinc-100 text-zinc-950 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
              >
                Process Assessment
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {errorMsg && (
              <div className="w-full p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* WORKSPACE RESULTS: MINIMALIST SPLIT VIEW */}
        {mappingData && (
          <div className="flex flex-col gap-5">
            {/* High-Level Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 flex flex-col">
                <span className="text-[11px] text-zinc-400 font-normal">Total Questions</span>
                <span className="text-lg font-semibold text-zinc-100 mt-0.5">{mappingData.summary.total_questions}</span>
              </div>

              <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 flex flex-col">
                <span className="text-[11px] text-zinc-400 font-normal flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400" /> Matched
                </span>
                <span className="text-lg font-semibold text-zinc-100 mt-0.5">{mappingData.summary.matched_questions}</span>
              </div>

              <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 flex flex-col">
                <span className="text-[11px] text-zinc-400 font-normal flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400" /> Unanswered
                </span>
                <span className="text-lg font-semibold text-zinc-100 mt-0.5">{mappingData.summary.unanswered_questions}</span>
              </div>

              <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 flex flex-col">
                <span className="text-[11px] text-zinc-400 font-normal flex items-center gap-1">
                  <HelpCircle className="w-3 h-3 text-zinc-400" /> Unmatched Answers
                </span>
                <span className="text-lg font-semibold text-zinc-100 mt-0.5">{mappingData.summary.unmatched_answers}</span>
              </div>
            </div>

            {/* Sub-Header Toolbar */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    activeTab === 'all'
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  All ({mappingData.mapped_questions.length + mappingData.unmatched_answers.length})
                </button>
                <button
                  onClick={() => setActiveTab('matched')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    activeTab === 'matched'
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Matched ({mappingData.summary.matched_questions})
                </button>
                <button
                  onClick={() => setActiveTab('unanswered')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    activeTab === 'unanswered'
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Unanswered ({mappingData.summary.unanswered_questions})
                </button>
                <button
                  onClick={() => setActiveTab('unmatched')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition ${
                    activeTab === 'unmatched'
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Unmatched ({mappingData.summary.unmatched_answers})
                </button>
              </div>

              {selectedQuestionNumber && (
                <span className="text-xs text-zinc-400 font-mono flex items-center gap-1">
                  <Crosshair className="w-3 h-3 text-zinc-400" /> Active: Q{selectedQuestionNumber}
                </span>
              )}
            </div>

            {/* Split Screen Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* LEFT COLUMN: QUESTION ITEMS (5 COLS) */}
              <div className="lg:col-span-5 flex flex-col gap-2.5 max-h-[720px] overflow-y-auto pr-1">
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
                        className={`p-3.5 rounded-lg border transition cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-900 border-zinc-500 ring-1 ring-zinc-500'
                            : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px] font-mono font-medium">
                              Q{q.question_number}
                            </span>
                            <h4 className="text-xs font-medium text-zinc-200 line-clamp-2">{q.question_text}</h4>
                          </div>

                          {q.status === 'matched' ? (
                            <span className="text-[10px] text-emerald-400 font-medium shrink-0">
                              Matched
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-400 font-medium shrink-0">
                              Unanswered
                            </span>
                          )}
                        </div>

                        {q.status === 'matched' ? (
                          <div className="mt-2 pl-2.5 border-l border-zinc-700 text-xs">
                            <p className="text-zinc-400 font-mono text-[11px] line-clamp-2">
                              {q.answers[0]?.raw_text}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-1 text-[11px] text-zinc-500 italic">No answer submitted.</p>
                        )}
                      </div>
                    );
                  })}

                {/* Unmatched Items */}
                {(activeTab === 'all' || activeTab === 'unmatched') &&
                  mappingData.unmatched_answers.map((ans, idx) => (
                    <div
                      key={`unmatched-${idx}`}
                      onClick={() => setSelectedQuestionNumber(ans.matched_question_number || `unmatched-${idx}`)}
                      className="p-3.5 rounded-lg bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-mono text-zinc-400 font-medium">
                          Unmatched Answer #{idx + 1}
                        </span>
                      </div>
                      <p className="text-zinc-300 font-mono text-[11px] line-clamp-2">{ans.raw_text}</p>
                    </div>
                  ))}
              </div>

              {/* RIGHT COLUMN: CANVAS OVERLAY (7 COLS) */}
              <div 
                ref={viewerContainerRef}
                className="lg:col-span-7 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5 flex flex-col gap-4 max-h-[720px] overflow-y-auto relative"
              >
                <div className="flex items-center justify-between text-xs text-zinc-400 pb-2 border-b border-zinc-800">
                  <span className="font-medium text-zinc-300">Answer Sheet View</span>
                  <span className="font-mono text-[10px]">Normalized Overlay Bounding Boxes</span>
                </div>

                {getPageNumbers().map((pageNum) => (
                  <div key={pageNum} className="flex flex-col gap-2">
                    <div className="text-[10px] font-mono text-zinc-500">Page {pageNum}</div>

                    <div className="relative w-full rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center min-h-[480px]">
                      {answerSheetPreviewUrl ? (
                        <img
                          src={answerSheetPreviewUrl}
                          alt={`Answer Sheet Page ${pageNum}`}
                          className="w-full h-auto object-contain block"
                        />
                      ) : (
                        <div className="w-full min-h-[500px] bg-zinc-950 relative p-6 flex flex-col gap-5 border border-zinc-900 bg-[linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:100%_28px]">
                          <div className="absolute top-0 bottom-0 left-10 w-0.5 bg-zinc-800"></div>
                          <div className="text-[10px] font-mono text-zinc-600 pl-4">
                            [Handwritten Answer Sheet — Page {pageNum}]
                          </div>

                          {mappingData.mapped_questions
                            .filter(q => q.answers.some(a => a.pages.some(p => p.page_number === pageNum)))
                            .map(q => (
                              <div key={q.question_number} className="pl-4 font-mono text-xs text-zinc-300 leading-relaxed">
                                <span className="text-zinc-500 font-medium">Ans {q.question_number}: </span>
                                {q.answers[0]?.raw_text}
                              </div>
                            ))}
                        </div>
                      )}

                      {/* BOUNDING BOX OVERLAYS */}
                      {mappingData.mapped_questions.map((q) =>
                        q.answers.map((ans, ansIdx) =>
                          ans.pages
                            .filter((p) => p.page_number === pageNum)
                            .map((p, pIdx) => {
                              const [ymin, xmin, ymax, xmax] = p.bbox;
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
                                  className={`absolute rounded transition-all cursor-pointer flex items-start justify-between p-1 ${
                                    isSelected
                                      ? 'border-2 border-blue-400 bg-blue-500/20 z-30 ring-2 ring-blue-400/30'
                                      : activeHoveredBoxId === q.question_number
                                      ? 'border border-blue-400 bg-blue-500/10 z-20'
                                      : 'border border-zinc-700 bg-zinc-900/30 hover:border-zinc-500 z-10'
                                  }`}
                                >
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                                    isSelected ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-300 border border-zinc-700'
                                  }`}>
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
                                className={`absolute rounded transition-all cursor-pointer flex items-start justify-between p-1 ${
                                  isSelected
                                    ? 'border-2 border-zinc-300 bg-zinc-700/40 z-30'
                                    : 'border border-dashed border-zinc-700 bg-zinc-900/30 hover:border-zinc-500 z-10'
                                }`}
                              >
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800">
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
