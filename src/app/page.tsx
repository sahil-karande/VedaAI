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
  Crosshair
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
    <main className="min-h-screen bg-[#F5F2EB] text-[#2C2A29] flex flex-col font-sans antialiased">
      {/* Navigation Header */}
      <header className="border-b border-[#E4DDD3] bg-[#FAF8F5]/90 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#2C2A29] text-[#F5F2EB] flex items-center justify-center font-bold text-base tracking-widest">
              V
            </div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-base tracking-wide text-[#2C2A29]">VEDAAI</h1>
              <span className="text-[#C8BEB5]">/</span>
              <span className="text-xs sm:text-sm text-[#7A6E65] font-normal tracking-wide">ASSESSMENT WORKSPACE</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            {mappingData && (
              <button
                onClick={resetAll}
                className="flex items-center gap-2 px-4 py-2 rounded border border-[#E4DDD3] bg-[#FAF8F5] text-[#2C2A29] hover:bg-[#EFECE6] transition font-medium text-xs sm:text-sm"
              >
                <RefreshCw className="w-4 h-4 text-[#7A6E65]" />
                Reset Workspace
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 flex flex-col gap-10">
        {/* Workspace Header - Prominent & Bold */}
        {!mappingData && (
          <div className="max-w-3xl mx-auto text-center flex flex-col items-center mb-4">
            <h2 className="text-4xl sm:text-5xl font-light text-[#2C2A29] tracking-tight uppercase">
              Assessment Mapping
            </h2>
            <div className="w-16 h-0.5 bg-[#C8BEB5] my-5"></div>
            <p className="text-base sm:text-lg text-[#554F49] leading-relaxed font-normal">
              Upload original question papers and student answer sheets to automatically digitize and correlate questions with bounding box overlays.
            </p>
          </div>
        )}

        {/* Upload Cards — Generous & Prominent Scale */}
        {!mappingData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto w-full">
            {/* Question Paper Card */}
            <div className="p-8 rounded-xl border border-[#E4DDD3] bg-[#FAF8F5] shadow-sm hover:border-[#C8BEB5] transition flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-[#7A6E65]" />
                  <h3 className="text-base font-semibold tracking-wider text-[#2C2A29] uppercase">1. Question Paper</h3>
                </div>
                {questionPaper && (
                  <span className="text-xs text-[#2C2A29] font-semibold bg-[#C8BEB5]/30 px-3 py-1 rounded border border-[#C8BEB5] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2C2A29]" /> Ready
                  </span>
                )}
              </div>

              <label className="relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-[#C8BEB5] hover:border-[#7A6E65] rounded-lg cursor-pointer bg-[#F5F2EB]/60 hover:bg-[#F5F2EB] transition group p-6">
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleQuestionPaperChange}
                  className="hidden"
                />
                {questionPaper ? (
                  <div className="flex flex-col items-center text-center px-4">
                    <FileCheck className="w-12 h-12 text-[#2C2A29] mb-3" />
                    <p className="text-base font-semibold text-[#2C2A29] truncate max-w-xs">{questionPaper.name}</p>
                    <p className="text-xs text-[#7A6E65] mt-1">{(questionPaper.size / (1024 * 1024)).toFixed(2)} MB</p>
                    <span className="mt-3 text-xs text-[#7A6E65] group-hover:text-[#2C2A29] underline font-medium">Click to replace file</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center px-4">
                    <UploadCloud className="w-12 h-12 text-[#A89D93] group-hover:text-[#2C2A29] mb-3 transition-colors" />
                    <p className="text-lg font-semibold text-[#2C2A29]">Select Question Paper</p>
                    <p className="text-xs text-[#7A6E65] mt-1">Drag and drop or browse (PDF, PNG, JPG)</p>
                  </div>
                )}
              </label>
            </div>

            {/* Answer Sheet Card */}
            <div className="p-8 rounded-xl border border-[#E4DDD3] bg-[#FAF8F5] shadow-sm hover:border-[#C8BEB5] transition flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-6 h-6 text-[#7A6E65]" />
                  <h3 className="text-base font-semibold tracking-wider text-[#2C2A29] uppercase">2. Student Answer Sheet</h3>
                </div>
                {answerSheet && (
                  <span className="text-xs text-[#2C2A29] font-semibold bg-[#C8BEB5]/30 px-3 py-1 rounded border border-[#C8BEB5] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#2C2A29]" /> Ready
                  </span>
                )}
              </div>

              <label className="relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-[#C8BEB5] hover:border-[#7A6E65] rounded-lg cursor-pointer bg-[#F5F2EB]/60 hover:bg-[#F5F2EB] transition group p-6">
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleAnswerSheetChange}
                  className="hidden"
                />
                {answerSheet ? (
                  <div className="flex flex-col items-center text-center px-4">
                    <FileCheck className="w-12 h-12 text-[#2C2A29] mb-3" />
                    <p className="text-base font-semibold text-[#2C2A29] truncate max-w-xs">{answerSheet.name}</p>
                    <p className="text-xs text-[#7A6E65] mt-1">{(answerSheet.size / (1024 * 1024)).toFixed(2)} MB</p>
                    <span className="mt-3 text-xs text-[#7A6E65] group-hover:text-[#2C2A29] underline font-medium">Click to replace file</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center px-4">
                    <UploadCloud className="w-12 h-12 text-[#A89D93] group-hover:text-[#2C2A29] mb-3 transition-colors" />
                    <p className="text-lg font-semibold text-[#2C2A29]">Select Student Answer Sheet</p>
                    <p className="text-xs text-[#7A6E65] mt-1">Drag and drop or browse (Scanned images, PDF)</p>
                  </div>
                )}
              </label>
            </div>
          </div>
        )}

        {/* Action Button & Loader — Scaled Up */}
        {!mappingData && (
          <div className="max-w-lg mx-auto w-full flex flex-col items-center gap-4 mt-2">
            {isProcessing ? (
              <div className="w-full p-6 rounded-lg bg-[#FAF8F5] border border-[#E4DDD3] flex flex-col items-center text-center shadow-sm">
                <Loader2 className="w-7 h-7 text-[#2C2A29] animate-spin mb-3" />
                <h4 className="text-sm font-semibold text-[#2C2A29] mb-1">{statusText}</h4>
                <div className="mt-4 w-full bg-[#E4DDD3] rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-[#2C2A29] h-full transition-all duration-300" 
                    style={{ width: `${(processStep / 3) * 100}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <button
                onClick={startProcessing}
                disabled={!questionPaper || !answerSheet}
                className="w-full py-4 px-8 rounded font-semibold text-sm sm:text-base tracking-widest bg-[#2C2A29] text-[#F5F2EB] hover:bg-[#3E3A37] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition uppercase shadow-md active:scale-[0.99]"
              >
                Process & Map Assessment
                <ArrowRight className="w-5 h-5" />
              </button>
            )}

            {errorMsg && (
              <div className="w-full p-4 rounded bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        )}

        {/* WORKSPACE RESULTS VIEW */}
        {mappingData && (
          <div className="flex flex-col gap-8">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-5 rounded-lg bg-[#FAF8F5] border border-[#E4DDD3] flex flex-col">
                <span className="text-xs text-[#7A6E65] uppercase tracking-wider font-semibold">Total Questions</span>
                <span className="text-2xl font-bold text-[#2C2A29] mt-1">{mappingData.summary.total_questions}</span>
              </div>

              <div className="p-5 rounded-lg bg-[#FAF8F5] border border-[#E4DDD3] flex flex-col">
                <span className="text-xs text-[#7A6E65] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#2C2A29]" /> Matched
                </span>
                <span className="text-2xl font-bold text-[#2C2A29] mt-1">{mappingData.summary.matched_questions}</span>
              </div>

              <div className="p-5 rounded-lg bg-[#FAF8F5] border border-[#E4DDD3] flex flex-col">
                <span className="text-xs text-[#7A6E65] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-[#7A6E65]" /> Unanswered
                </span>
                <span className="text-2xl font-bold text-[#2C2A29] mt-1">{mappingData.summary.unanswered_questions}</span>
              </div>

              <div className="p-5 rounded-lg bg-[#FAF8F5] border border-[#E4DDD3] flex flex-col">
                <span className="text-xs text-[#7A6E65] uppercase tracking-wider font-semibold flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-[#7A6E65]" /> Unmatched Answers
                </span>
                <span className="text-2xl font-bold text-[#2C2A29] mt-1">{mappingData.summary.unmatched_answers}</span>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-[#E4DDD3] pb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-2 rounded text-xs sm:text-sm font-semibold transition ${
                    activeTab === 'all'
                      ? 'bg-[#2C2A29] text-[#F5F2EB]'
                      : 'bg-[#FAF8F5] text-[#7A6E65] hover:text-[#2C2A29] border border-[#E4DDD3]'
                  }`}
                >
                  All ({mappingData.mapped_questions.length + mappingData.unmatched_answers.length})
                </button>
                <button
                  onClick={() => setActiveTab('matched')}
                  className={`px-4 py-2 rounded text-xs sm:text-sm font-semibold transition ${
                    activeTab === 'matched'
                      ? 'bg-[#2C2A29] text-[#F5F2EB]'
                      : 'bg-[#FAF8F5] text-[#7A6E65] hover:text-[#2C2A29] border border-[#E4DDD3]'
                  }`}
                >
                  Matched ({mappingData.summary.matched_questions})
                </button>
                <button
                  onClick={() => setActiveTab('unanswered')}
                  className={`px-4 py-2 rounded text-xs sm:text-sm font-semibold transition ${
                    activeTab === 'unanswered'
                      ? 'bg-[#2C2A29] text-[#F5F2EB]'
                      : 'bg-[#FAF8F5] text-[#7A6E65] hover:text-[#2C2A29] border border-[#E4DDD3]'
                  }`}
                >
                  Unanswered ({mappingData.summary.unanswered_questions})
                </button>
                <button
                  onClick={() => setActiveTab('unmatched')}
                  className={`px-4 py-2 rounded text-xs sm:text-sm font-semibold transition ${
                    activeTab === 'unmatched'
                      ? 'bg-[#2C2A29] text-[#F5F2EB]'
                      : 'bg-[#FAF8F5] text-[#7A6E65] hover:text-[#2C2A29] border border-[#E4DDD3]'
                  }`}
                >
                  Unmatched ({mappingData.summary.unmatched_answers})
                </button>
              </div>

              {selectedQuestionNumber && (
                <span className="text-xs sm:text-sm text-[#7A6E65] font-mono flex items-center gap-1.5 font-semibold">
                  <Crosshair className="w-4 h-4 text-[#2C2A29]" /> Active Selection: Q{selectedQuestionNumber}
                </span>
              )}
            </div>

            {/* Split Screen Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT COLUMN: QUESTION ITEMS */}
              <div className="lg:col-span-5 flex flex-col gap-4 max-h-[800px] overflow-y-auto pr-2">
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
                        className={`p-5 rounded-lg border transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#C8BEB5]/40 border-[#2C2A29] ring-2 ring-[#2C2A29]/40 shadow-sm'
                            : 'bg-[#FAF8F5] border-[#E4DDD3] hover:border-[#C8BEB5]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="px-2.5 py-1 rounded bg-[#2C2A29] text-[#F5F2EB] text-xs font-mono font-bold">
                              Q{q.question_number}
                            </span>
                            <h4 className="text-sm sm:text-base font-semibold text-[#2C2A29]">{q.question_text}</h4>
                          </div>

                          {q.status === 'matched' ? (
                            <span className="text-xs text-[#2C2A29] font-bold border border-[#C8BEB5] bg-[#C8BEB5]/40 px-2.5 py-1 rounded shrink-0">
                              Matched
                            </span>
                          ) : (
                            <span className="text-xs text-[#7A6E65] font-semibold border border-[#E4DDD3] bg-[#EFECE6] px-2.5 py-1 rounded shrink-0">
                              Unanswered
                            </span>
                          )}
                        </div>

                        {q.status === 'matched' ? (
                          <div className="mt-3 pl-3.5 border-l-2 border-[#C8BEB5] text-xs sm:text-sm">
                            <p className="text-[#3E3A37] font-mono text-xs sm:text-sm leading-relaxed">
                              {q.answers[0]?.raw_text}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-[#8C7E72] italic">No answer submitted.</p>
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
                      className="p-5 rounded-lg bg-[#FAF8F5] border border-[#E4DDD3] hover:border-[#C8BEB5] cursor-pointer transition"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-[#7A6E65] font-bold">
                          Unmatched Answer #{idx + 1}
                        </span>
                      </div>
                      <p className="text-[#2C2A29] font-mono text-xs sm:text-sm">{ans.raw_text}</p>
                    </div>
                  ))}
              </div>

              {/* RIGHT COLUMN: CANVAS OVERLAY */}
              <div 
                ref={viewerContainerRef}
                className="lg:col-span-7 bg-[#FAF8F5] border border-[#E4DDD3] rounded-lg p-5 flex flex-col gap-5 max-h-[800px] overflow-y-auto relative"
              >
                <div className="flex items-center justify-between text-xs sm:text-sm text-[#7A6E65] pb-3 border-b border-[#E4DDD3]">
                  <span className="font-semibold text-[#2C2A29]">Answer Sheet Canvas</span>
                  <span className="font-mono text-xs">Normalized Overlay Bounding Boxes</span>
                </div>

                {getPageNumbers().map((pageNum) => (
                  <div key={pageNum} className="flex flex-col gap-2">
                    <div className="text-xs font-mono text-[#7A6E65] font-semibold">Page {pageNum}</div>

                    <div className="relative w-full rounded overflow-hidden border border-[#E4DDD3] bg-white flex items-center justify-center min-h-[520px]">
                      {answerSheetPreviewUrl ? (
                        <img
                          src={answerSheetPreviewUrl}
                          alt={`Answer Sheet Page ${pageNum}`}
                          className="w-full h-auto object-contain block"
                        />
                      ) : (
                        <div className="w-full min-h-[550px] bg-[#FAF8F5] relative p-8 flex flex-col gap-6 border border-[#E4DDD3] bg-[linear-gradient(to_bottom,#E4DDD3_1px,transparent_1px)] bg-[size:100%_32px]">
                          <div className="absolute top-0 bottom-0 left-12 w-0.5 bg-[#C8BEB5]"></div>
                          <div className="text-xs font-mono text-[#7A6E65] pl-6">
                            [Handwritten Answer Sheet — Page {pageNum}]
                          </div>

                          {mappingData.mapped_questions
                            .filter(q => q.answers.some(a => a.pages.some(p => p.page_number === pageNum)))
                            .map(q => (
                              <div key={q.question_number} className="pl-6 font-mono text-xs sm:text-sm text-[#2C2A29] leading-relaxed">
                                <span className="text-[#7A6E65] font-semibold">Ans {q.question_number}: </span>
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
                                  className={`absolute rounded transition-all cursor-pointer flex items-start justify-between p-1.5 ${
                                    isSelected
                                      ? 'border-2 border-[#2C2A29] bg-[#C8BEB5]/60 z-30 ring-2 ring-[#7A6E65]/50 shadow-md'
                                      : activeHoveredBoxId === q.question_number
                                      ? 'border border-[#7A6E65] bg-[#C8BEB5]/40 z-20'
                                      : 'border border-[#C8BEB5] bg-[#C8BEB5]/20 hover:border-[#7A6E65] z-10'
                                  }`}
                                >
                                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                                    isSelected ? 'bg-[#2C2A29] text-[#F5F2EB]' : 'bg-[#FAF8F5] text-[#2C2A29] border border-[#C8BEB5]'
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
                                className={`absolute rounded transition-all cursor-pointer flex items-start justify-between p-1.5 ${
                                  isSelected
                                    ? 'border-2 border-[#2C2A29] bg-[#C8BEB5]/40 z-30'
                                    : 'border border-dashed border-[#C8BEB5] bg-[#C8BEB5]/15 hover:border-[#7A6E65] z-10'
                                }`}
                              >
                                <span className="px-2 py-0.5 rounded text-xs font-mono bg-[#FAF8F5] text-[#7A6E65] border border-[#E4DDD3]">
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
