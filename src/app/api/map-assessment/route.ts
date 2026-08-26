import { NextRequest, NextResponse } from 'next/server';

export interface QuestionItem {
  question_number: string;
  question_text: string;
  order_index: number;
}

export interface BoundingBoxPage {
  page_number: number;
  bbox: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
}

export interface AnswerBlockItem {
  matched_question_number: string | null;
  raw_text: string;
  pages: BoundingBoxPage[];
}

export interface MappedQuestion {
  question_number: string;
  question_text: string;
  order_index: number;
  status: 'matched' | 'unanswered';
  answers: AnswerBlockItem[];
}

export interface UnmatchedAnswer {
  matched_question_number: string | null;
  raw_text: string;
  pages: BoundingBoxPage[];
  status: 'unmatched';
}

export interface MappingResponse {
  success: boolean;
  summary: {
    total_questions: number;
    matched_questions: number;
    unanswered_questions: number;
    unmatched_answers: number;
  };
  mapped_questions: MappedQuestion[];
  unmatched_answers: UnmatchedAnswer[];
  error?: string;
}

/**
 * Normalizes question number string for reliable direct matching.
 * E.g., "Q.1(a)", "1 (a)", "1(a)", "Question 1a" -> "1a"
 */
function normalizeQuestionKey(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/^q(uestion)?[\s\.\-]*/i, '') // strip leading Q., Q-, Question
    .replace(/[\s\.\_\-\(\)]/g, ''); // strip punctuation & parentheses
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const questions: QuestionItem[] = Array.isArray(body.questions) ? body.questions : [];
    const answerBlocks: AnswerBlockItem[] = Array.isArray(body.answer_blocks) ? body.answer_blocks : [];

    // Map to keep track of questions and matched answers
    const questionMap = new Map<string, QuestionItem>();
    const answersByQuestionKey = new Map<string, AnswerBlockItem[]>();

    // Register all valid questions from question paper
    questions.forEach((q) => {
      const normKey = normalizeQuestionKey(q.question_number);
      if (normKey) {
        questionMap.set(normKey, q);
        if (!answersByQuestionKey.has(normKey)) {
          answersByQuestionKey.set(normKey, []);
        }
      }
    });

    const unmatchedAnswers: UnmatchedAnswer[] = [];

    // Classify each student answer block
    answerBlocks.forEach((ans) => {
      const normAnsKey = normalizeQuestionKey(ans.matched_question_number);

      if (normAnsKey && answersByQuestionKey.has(normAnsKey)) {
        // Direct match found! Trusting LLM's question label prediction
        answersByQuestionKey.get(normAnsKey)!.push(ans);
      } else {
        // Unmatched answer (label missing, null, or not in question paper)
        unmatchedAnswers.push({
          ...ans,
          status: 'unmatched',
        });
      }
    });

    // Build final mapped questions list
    const mappedQuestions: MappedQuestion[] = questions.map((q) => {
      const normKey = normalizeQuestionKey(q.question_number);
      const matchedAnsList = answersByQuestionKey.get(normKey) || [];

      return {
        question_number: q.question_number,
        question_text: q.question_text,
        order_index: q.order_index,
        status: matchedAnsList.length > 0 ? 'matched' : 'unanswered',
        answers: matchedAnsList,
      };
    });

    // Sort by order_index
    mappedQuestions.sort((a, b) => a.order_index - b.order_index);

    const matchedCount = mappedQuestions.filter((q) => q.status === 'matched').length;
    const unansweredCount = mappedQuestions.filter((q) => q.status === 'unanswered').length;

    const responseData: MappingResponse = {
      success: true,
      summary: {
        total_questions: questions.length,
        matched_questions: matchedCount,
        unanswered_questions: unansweredCount,
        unmatched_answers: unmatchedAnswers.length,
      },
      mapped_questions: mappedQuestions,
      unmatched_answers: unmatchedAnswers,
    };

    return NextResponse.json(responseData);
  } catch (err: any) {
    console.error('Error in /api/map-assessment:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to process mapping logic',
      },
      { status: 500 }
    );
  }
}
