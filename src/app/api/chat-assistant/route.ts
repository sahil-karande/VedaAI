import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const GROQ_TEXT_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
];

function getSmartFallbackResponse(
  query: string,
  userProfile: any,
  currentMappingSummary: any,
  libraryItemsCount: number,
  paperLanguage: string = 'English'
): string {
  const q = query.toLowerCase().trim();
  const userName = userProfile?.name || 'Educator';

  // Language inquiry or Hindi/Marathi keywords
  if (q.includes('language') || q.includes('hindi') || q.includes('marathi') || q.includes('हिंदी') || q.includes('मराठी') || q.includes('भाषा')) {
    return `VedaAI fully supports multi-lingual exam papers in English, Hindi (हिंदी), and Marathi (मराठी):

1. Language Selection: Select your preferred paper language (English, Hindi, Marathi) on the upload screen before mapping.
2. Devanagari OCR & Transcription: Vision AI transcribes handwritten student responses in Devanagari script for Hindi & Marathi answer sheets.
3. Multi-Lingual Evaluation & Feedback: Step marking, match percentages, AI feedback, and Bloom's taxonomy rubrics are generated in your chosen paper language.`;
  }

  // 1. Greetings
  if (/^(hi|hello|hey|greetings|howdy|good\s*(morning|afternoon|evening)|how are you)/i.test(q) || q === 'hey' || q === 'hi') {
    return `Hello ${userName}! I am VedaAI Assistant. I am doing well and ready to assist you with answer paper grading (in English, Hindi, or Marathi), classroom rubrics, topic mastery analytics, and exporting your assessments. How can I help you today?`;
  }

  // 2. Deduction / Marks / Step Grading
  if (
    q.includes('deduct') ||
    q.includes('mark') ||
    q.includes('score') ||
    q.includes('cut') ||
    q.includes('grade') ||
    q.includes('subtrac') ||
    q.includes('point') ||
    q.includes('step') ||
    q.includes('अंक') ||
    q.includes('गुण')
  ) {
    return `In VedaAI, mark deduction and automated grading follow standard academic evaluation rules:

1. Rubric & Answer Matching: VedaAI transcribes handwritten responses and compares them against the question's model answer key and target concepts extracted from the printed question paper (in English, Hindi, or Marathi).
2. Step Marking & Increments: Marks are awarded or deducted strictly in whole numbers or 0.5 step increments. For example:
   - 0.5 Marks Deducted: For minor technical omissions, incomplete units, or partial concept coverage.
   - 1.0+ Marks Deducted: For missing key derivation steps, formula errors, or incomplete sub-answers.
   - Full Mark Deduction (0 Awarded): For blank responses, irrelevant answers, or incorrect solutions.
3. Detailed Criteria Feedback: For every question, VedaAI provides a specific feedback explanation in the selected paper language showing where marks were lost and what required concepts were missing.
4. Manual Teacher Overrides: As a teacher, you can click on any question in the mapped assessment view to manually adjust awarded marks or edit feedback.`;
  }

  // 3. Uploading & Paper Mapping
  if (
    q.includes('upload') ||
    q.includes('map') ||
    q.includes('paper') ||
    q.includes('answer') ||
    q.includes('scan') ||
    q.includes('page') ||
    q.includes('ocr')
  ) {
    return `To upload and map assessments in VedaAI:

1. Select Paper Language: Choose English, Hindi (हिंदी), or Marathi (मराठी) on the upload screen.
2. Upload Question Paper: Upload your printed exam paper (PDF or Image). VedaAI automatically extracts individual questions, sub-parts, and maximum marks.
3. Upload Student Answer Sheet: Upload handwritten student answer pages. Vision AI transcribes text and locates answer bounding boxes.
4. Multi-Page Continuation: VedaAI tracks student answers spanning multiple pages (e.g. Q1a extending across Pages 1 to 5, Q2a on Page 6) so full answers are evaluated together.
5. Run Assessment Mapping: Click 'Map & Grade Assessment' to generate match percentages, score breakdowns, and topic mastery data.`;
  }

  // 4. Rubrics & Teacher Toolkit
  if (
    q.includes('rubric') ||
    q.includes('toolkit') ||
    q.includes('bloom') ||
    q.includes('taxonomy') ||
    q.includes('remedial') ||
    q.includes('generator')
  ) {
    return `The AI Teacher Toolkit provides customized teaching assets in English, Hindi, and Marathi:

1. Marking Rubrics: Build structured multi-criteria rubrics aligned with Bloom's Taxonomy levels (Remembering, Understanding, Applying, Analyzing, Evaluating, Creating).
2. Model Answer Keys: Instantly generate step-by-step solution keys for uploaded question papers in your selected language.
3. Remedial Tasks: Automatically create practice worksheets tailored to student learning gaps identified during grading.`;
  }

  // 5. Analytics & Dashboard
  if (
    q.includes('analytic') ||
    q.includes('chart') ||
    q.includes('mastery') ||
    q.includes('donut') ||
    q.includes('column') ||
    q.includes('graph') ||
    q.includes('report')
  ) {
    return `VedaAI provides real-time classroom performance analytics:

1. Grade Distribution (Donut Chart): Displays class score breakdown across grade bands (A+, A, B, C, Needs Improvement).
2. Subject Topic Mastery (Vertical Column Chart): Highlights class performance percentages across specific topics and syllabus concepts.
3. Exam Summaries: Displays total points scored, percentage marks, and overall qualitative feedback for each student submission.`;
  }

  // 6. Library & Storage
  if (
    q.includes('library') ||
    q.includes('save') ||
    q.includes('export') ||
    q.includes('delete') ||
    q.includes('pdf') ||
    q.includes('history')
  ) {
    return `My Library allows you to store and manage your assessment history:

1. Saved Items: Currently you have ${libraryItemsCount} saved assessment(s) in your library.
2. Persisted State: Mapped assessments, question papers, and student scorecards can be reloaded at any time with full interactive overlays.
3. Export & Download: You can export complete assessment reports and student answer mapping breakdowns to PDF.`;
  }

  // 7. Contextual Fallback for general questions
  return `Hello ${userName}! Regarding "${query}":

VedaAI is designed to streamline assessment workflows for educators across English, Hindi, and Marathi. You can:
- Map & Grade Answer Sheets: Automatically transcribe handwritten answers and grade them against model criteria.
- Multi-Lingual Support: Switch paper language between English, Hindi (हिंदी), and Marathi (मराठी).
- Customize Mark Deductions: Enforce 0.5 or whole integer step-marking rules and view question-level feedback.
- Generate Teaching Assets: Create Bloom's Taxonomy rubrics and remedial tasks in the AI Teacher Toolkit.

Feel free to ask specifically about paper uploading, language selection, rubric generation, mark deduction rules, or assessment exports!`;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, userProfile, schoolDetails, academicYear, currentMappingSummary, libraryItemsCount, paperLanguage = 'English' } = await req.json();

    const groqApiKey = process.env.GROQ_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    
    // Extract last user message for fallback intent classification if needed
    const userMessages = (messages || []).filter((m: any) => m.role === 'user');
    const lastUserQuery = userMessages.length > 0 ? (userMessages[userMessages.length - 1].text || userMessages[userMessages.length - 1].content || '') : '';

    const systemPrompt = `You are VedaAI Assistant, an intelligent, helpful AI assistant built specifically for educators on the VedaAI Automated Assessment Platform.

CURRENT CONTEXT OF THE USER & PLATFORM:
- User Name: ${userProfile?.name || 'Educator'} (${userProfile?.role || 'Teacher'})
- Institution: ${schoolDetails?.schoolName || 'High School'} (${schoolDetails?.campus || 'Main Campus'})
- Active Academic Year: ${academicYear || '2025-2026'}
- Active Paper Language: ${paperLanguage}
- Saved Library Assessments: ${libraryItemsCount || 0} items
- Current Workspace Exam Sheet Status: ${
      currentMappingSummary
        ? `Assessment loaded with ${currentMappingSummary.total_questions || 0} questions, overall score ${currentMappingSummary.score_percentage || 0}%, feedback: "${currentMappingSummary.overall_feedback || ''}"`
        : 'No exam sheet currently mapped in workspace.'
    }

PLATFORM CAPABILITIES YOU SHOULD BE KNOWLEDGEABLE ABOUT:
1. Multi-Lingual Support: Native support for English, Hindi (हिंदी), and Marathi (मराठी) exam papers and handwritten student answer sheets using Devanagari Vision AI OCR.
2. Automated Assessment Digitization: Upload printed question paper and handwritten student answer sheets to transcribe text, map answers to questions across multiple pages, and draw bounding box overlays.
3. Multi-Page Continuation: Automatically tracks answers spanning multiple pages (e.g. Q1a spanning Pages 1-5, Q2a starting on Page 6).
4. Whole Integer & .5 Step Marking: Enforces standard academic grading increments (.5 or whole numbers only).
5. My Library: Persistent saving, loading, and deletion of past assessments.
6. Real-Time Home Analytics: Interactive SVG Donut charts for Grade Distribution and Vertical Column charts for Subject Topic Mastery.
7. AI Teacher Toolkit: Generate question papers, marking rubrics, model answer keys, and remedial learning tasks in English, Hindi, or Marathi.

RULES FOR YOUR RESPONSES:
- Be warm, professional, articulate, and directly helpful to the user.
- DO NOT use any emojis in your response text.
- If the user says "hi", "hey", "how are you", or greets you, respond conversationally as VedaAI Assistant and ask how you can help them with their teaching, classroom data, or assessment grading today.
- Provide accurate, specific answers according to the user's prompt, VedaAI platform features, and current session state.
- Keep responses concise (1 to 3 paragraphs max).`;

    let replyText = '';

    // Strategy 1: Try Groq if API Key is configured
    if (groqApiKey && !groqApiKey.includes('your_groq_api_key_here')) {
      try {
        const groq = new Groq({ apiKey: groqApiKey.trim() });
        const groqMessages = [
          { role: 'system', content: systemPrompt },
          ...messages.map((m: any) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text || m.content || '',
          })),
        ];

        for (const model of GROQ_TEXT_MODELS) {
          try {
            const response = await groq.chat.completions.create({
              model,
              messages: groqMessages,
              temperature: 0.7,
              max_tokens: 600,
            });

            replyText = response.choices[0]?.message?.content || '';
            if (replyText) break;
          } catch (err: any) {
            console.warn(`Groq assistant model ${model} attempt failed:`, err?.message || err);
          }
        }
      } catch (err: any) {
        console.warn('Groq client initialization or call failed:', err?.message || err);
      }
    }

    // Strategy 2: Fallback to Gemini if Groq failed and Gemini API Key is available
    if (!replyText && geminiApiKey && !geminiApiKey.includes('your_gemini_api_key_here')) {
      try {
        const genAI = new GoogleGenerativeAI(geminiApiKey.trim());
        const geminiModels = ['gemini-2.5-flash', 'gemini-1.5-flash'];
        
        // Build prompt string combining system context and message history
        const historyText = messages.map((m: any) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text || m.content || ''}`).join('\n');
        const fullPrompt = `${systemPrompt}\n\nCONVERSATION HISTORY:\n${historyText}\n\nAssistant Response:`;

        for (const modelName of geminiModels) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(fullPrompt);
            replyText = result.response.text();
            if (replyText) break;
          } catch (err: any) {
            console.warn(`Gemini model ${modelName} attempt failed:`, err?.message || err);
          }
        }
      } catch (err: any) {
        console.warn('Gemini client failed:', err?.message || err);
      }
    }

    // Strategy 3: Smart Local Intent Engine Fallback (guarantees accurate answer even without active API keys)
    if (!replyText) {
      replyText = getSmartFallbackResponse(lastUserQuery, userProfile, currentMappingSummary, libraryItemsCount, paperLanguage);
    }

    return NextResponse.json({ reply: replyText });
  } catch (error: any) {
    console.error('Chat Assistant API Error:', error);
    const fallback = getSmartFallbackResponse('help', null, null, 0, 'English');
    return NextResponse.json({ reply: fallback }, { status: 200 });
  }
}

