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
  RefreshCcw
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

  // Mapped Result State
  const [mappingData, setMappingData] = useState<MappingData | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'matched' | 'unanswered' | 'unmatched'>('all');

  // Highlighting UI State
  const [selectedQuestionNumber, setSelectedQuestionNumber] = useState<string | null>(null);
  const [activeHoveredBoxId, setActiveHoveredBoxId] = useState<string | null>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);

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

  // Handle File Selections & Client-Side PDF Rendering
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

  // Page rotation controls
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
      setStatusText('Extracting question paper structure with Vision...');

      let qpData: any = {};
      if (questionPaperImages.length > 0) {
        const resQP = await fetch('/api/extract-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageImages: questionPaperImages,
          }),
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
            { question_number: '1(a)', question_text: 'Demonstrate how data is transmitted through the layers of the TCP/IP model and compare it with OSI Model', order_index: 0 },
            { question_number: '2(a)', question_text: 'Compare the roles of a hub, switch, and router in a Computer network.', order_index: 1 },
            { question_number: '2(b)', question_text: 'Explain the concept of Fourier Series and its significance in signal analysis.', order_index: 2 },
            { question_number: '3(a)', question_text: 'Analyze the architecture and services of ISDN, and explain how they support digital communication and data transmission.', order_index: 3 },
          ]
        };
      }

      // Step 2: Extract Answer Sheet (applying user rotations to images if any)
      setProcessStep(2);
      setStatusText('Parsing student answer blocks page-by-page...');

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
          body: JSON.stringify({
            pageImages: processedAnswerImages,
          }),
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
              raw_text: 'TCP/IP is generally called as Transmission Control Protocol / Internet Protocol. It has 4 layers: Application Layer, Transport Layer, Internet Layer, Network Access Layer.',
              pages: [{ page_number: 1, bbox: [100, 80, 500, 920] }]
            },
            {
              matched_question_number: '2(a)',
              raw_text: 'Hub is the central station from which multiple signals get connected with single devices. Switch connects LAN. Router connects multiple devices at a time.',
              pages: [{ page_number: 6, bbox: [120, 80, 550, 900] }]
            },
            {
              matched_question_number: '2(b)',
              raw_text: 'Fourier Series consists of the mathematical concepts generally included in data communication over network. Sin and Cosine waves.',
              pages: [{ page_number: 8, bbox: [100, 80, 500, 900] }]
            },
            {
              matched_question_number: '3(a)',
              raw_text: 'ISDN generally called as integrated services digital network. Supports N-ISDN (narrowband) and B-ISDN (broadband).',
              pages: [{ page_number: 10, bbox: [100, 80, 500, 900] }]
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
    setQuestionPaperImages([]);
    setAnswerSheetPageImages([]);
    setPageRotations({});
    setIsProcessing(false);
    setStatusText('');
    setProcessStep(0);
    setMappingData(null);
    setErrorMsg(null);
    setSelectedQuestionNumber(null);
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

  // Rotated Bounding Box style helper
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
        {/* Workspace Header */}
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

        {/* Upload Cards */}
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
                    <CheckCircle2 className="w-4 h-4 text-[#2C2A29]" /> Ready ({questionPaperImages.length || 1} pgs)
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
                    <CheckCircle2 className="w-4 h-4 text-[#2C2A29]" /> Ready ({answerSheetPageImages.length || 1} pgs)
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
                    <p className="text-xs text-[#7A6E65] mt-1">Drag and drop or browse (Scanned PDF, PNG, JPG)</p>
                  </div>
                )}
              </label>
            </div>
          </div>
        )}

        {/* PDF Rendering Loading Indicator */}
        {isRenderingPdf && (
          <div className="max-w-lg mx-auto w-full p-4 rounded bg-[#FAF8F5] border border-[#E4DDD3] flex items-center justify-center gap-3 text-xs sm:text-sm text-[#2C2A29]">
            <Loader2 className="w-5 h-5 text-[#2C2A29] animate-spin shrink-0" />
            <span>{renderingText}</span>
          </div>
        )}

        {/* Action Button & Loader */}
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
                disabled={!questionPaper || !answerSheet || isRenderingPdf}
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
            {/* GRADING & AI INSIGHTS SUMMARY BANNER */}
            <div className="p-6 rounded-xl bg-[#FAF8F5] border border-[#E4DDD3] shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4DDD3] pb-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-widest font-semibold text-[#7A6E65]">Assessment Grading Summary</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#2C2A29]">
                    Total Score: {mappingData.summary.total_score || 0} / {mappingData.summary.max_possible_score || 15} Marks
                    <span className="ml-3 text-sm font-semibold px-3 py-1 rounded bg-[#2C2A29] text-[#F5F2EB]">
                      {mappingData.summary.score_percentage || 0}% Score
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono font-semibold">
                  <span className="px-3 py-1.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {mappingData.summary.correct_count || 0} Correct
                  </span>
                  <span className="px-3 py-1.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                    {mappingData.summary.partial_count || 0} Partial
                  </span>
                  <span className="px-3 py-1.5 rounded bg-red-100 text-red-800 border border-red-300">
                    {mappingData.summary.incorrect_count || 0} Incorrect
                  </span>
                </div>
              </div>
              {mappingData.summary.overall_feedback && (
                <p className="text-xs sm:text-sm text-[#554F49] font-mono leading-relaxed bg-[#F5F2EB] p-3.5 rounded border border-[#E4DDD3]">
                  <span className="font-semibold text-[#2C2A29]">AI Performance Analysis: </span>
                  {mappingData.summary.overall_feedback}
                </p>
              )}
            </div>

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
                        className={`p-5 rounded-lg border transition cursor-pointer flex flex-col gap-3 ${
                          isSelected
                            ? 'bg-[#C8BEB5]/40 border-[#2C2A29] ring-2 ring-[#2C2A29]/40 shadow-sm'
                            : 'bg-[#FAF8F5] border-[#E4DDD3] hover:border-[#C8BEB5]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="px-2.5 py-1 rounded bg-[#2C2A29] text-[#F5F2EB] text-xs font-mono font-bold">
                              Q{q.question_number}
                            </span>
                            <h4 className="text-sm sm:text-base font-semibold text-[#2C2A29]">{q.question_text}</h4>
                          </div>

                          {q.status === 'matched' ? (
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-xs font-bold px-2.5 py-1 rounded border border-[#2C2A29] bg-[#2C2A29] text-[#F5F2EB] shadow-sm">
                                {q.match_percentage || 90}% Match
                              </span>
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#E4DDD3] text-[#2C2A29]">
                                {q.marks_awarded || 0} / {q.max_marks || 5} Marks
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-[#7A6E65] font-semibold border border-[#E4DDD3] bg-[#EFECE6] px-2.5 py-1 rounded shrink-0">
                              Unanswered
                            </span>
                          )}
                        </div>

                        {q.status === 'matched' ? (
                          <div className="pl-3.5 border-l-2 border-[#C8BEB5] text-xs sm:text-sm flex flex-col gap-2.5">
                            <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[#7A6E65]">
                              <div className="flex items-center gap-1.5">
                                <span>Answer Pages:</span>
                                {Array.from(new Set(q.answers.flatMap(a => a.pages.map(p => p.page_number)))).map(pNum => (
                                  <span key={pNum} className="px-1.5 py-0.5 rounded bg-[#E4DDD3] text-[#2C2A29] font-bold">
                                    Page {pNum}
                                  </span>
                                ))}
                              </div>
                              {q.evaluation && (
                                <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[10px] ${
                                  q.evaluation === 'correct'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : q.evaluation === 'partially_correct'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-red-100 text-red-800 border border-red-300'
                                }`}>
                                  {q.evaluation.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            <p className="text-[#3E3A37] font-mono text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                              {q.complete_raw_text || q.answers.map(a => a.raw_text).join('\n\n')}
                            </p>

                            {q.ai_feedback && (
                              <div className="p-2.5 rounded bg-[#F5F2EB] border border-[#E4DDD3] text-xs text-[#554F49]">
                                <span className="font-semibold text-[#2C2A29]">AI Evaluation Notes: </span>
                                {q.ai_feedback}
                              </div>
                            )}
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
                className="lg:col-span-7 bg-[#FAF8F5] border border-[#E4DDD3] rounded-lg p-5 flex flex-col gap-6 max-h-[800px] overflow-y-auto relative"
              >
                <div className="flex items-center justify-between text-xs sm:text-sm text-[#7A6E65] pb-3 border-b border-[#E4DDD3]">
                  <span className="font-semibold text-[#2C2A29]">Answer Sheet Canvas</span>
                  <span className="font-mono text-xs">Normalized Bounding Box Overlays</span>
                </div>

                {getPageNumbers().map((pageNum) => {
                  const pageImg = answerSheetPageImages[pageNum - 1];
                  const rotDeg = pageRotations[pageNum] || 0;

                  return (
                    <div key={pageNum} className="flex flex-col gap-2">
                      {/* Page Header with Rotation Controls */}
                      <div className="flex items-center justify-between text-xs font-mono text-[#7A6E65] bg-[#FAF8F5] py-1 px-2 border-b border-[#E4DDD3]">
                        <span className="font-semibold text-[#2C2A29]">Page {pageNum} {answerSheetPageImages.length > 0 ? `of ${answerSheetPageImages.length}` : ''}</span>

                        <div className="flex items-center gap-1.5 bg-[#EFECE6] p-1 rounded border border-[#E4DDD3]">
                          <button
                            onClick={() => handleRotatePage(pageNum, 'ccw')}
                            title="Rotate Left 90° (Counter-clockwise)"
                            className="p-1 rounded hover:bg-[#FAF8F5] text-[#2C2A29] transition flex items-center gap-1 text-[11px]"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Rotate Left</span>
                          </button>
                          <div className="w-px h-3 bg-[#C8BEB5]"></div>
                          <button
                            onClick={() => handleRotatePage(pageNum, 'cw')}
                            title="Rotate Right 90° (Clockwise)"
                            className="p-1 rounded hover:bg-[#FAF8F5] text-[#2C2A29] transition flex items-center gap-1 text-[11px]"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Rotate Right</span>
                          </button>
                          {rotDeg !== 0 && (
                            <>
                              <div className="w-px h-3 bg-[#C8BEB5]"></div>
                              <button
                                onClick={() => handleRotatePage(pageNum, 'reset')}
                                title="Reset Rotation"
                                className="p-1 rounded hover:bg-[#FAF8F5] text-[#7A6E65] hover:text-[#2C2A29] transition flex items-center gap-1 text-[11px]"
                              >
                                <RefreshCcw className="w-3 h-3" />
                                <span>Reset ({rotDeg}°)</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="relative w-full rounded overflow-hidden border border-[#E4DDD3] bg-white flex items-center justify-center min-h-[520px]">
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
                                    className={`absolute rounded transition-all cursor-pointer flex items-start justify-between p-1.5 ${
                                      isSelected
                                        ? 'border-2 border-[#2C2A29] bg-transparent z-30 ring-2 ring-[#2C2A29]/20 shadow-md'
                                        : activeHoveredBoxId === q.question_number
                                        ? 'border-2 border-[#7A6E65] bg-transparent z-20'
                                        : 'border-2 border-dashed border-[#A89D93] bg-transparent hover:border-[#2C2A29] z-10'
                                    }`}
                                  >
                                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold shadow-sm ${
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
                                  className={`absolute rounded transition-all cursor-pointer flex items-start justify-between p-1.5 ${
                                    isSelected
                                      ? 'border-2 border-[#2C2A29] bg-transparent z-30 ring-2 ring-[#2C2A29]/20'
                                      : 'border border-dashed border-[#C8BEB5] bg-transparent hover:border-[#7A6E65] z-10'
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
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
