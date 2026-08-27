import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const GROQ_TEXT_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
];

export async function POST(req: NextRequest) {
  try {
    const { messages, userProfile, schoolDetails, academicYear, currentMappingSummary, libraryItemsCount } = await req.json();

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ reply: "VedaAI Assistant is online. How can I help you with grading, rubrics, or platform navigation today?" });
    }

    const groq = new Groq({ apiKey });

    const systemPrompt = `You are VedaAI Assistant, an intelligent, helpful AI assistant built specifically for educators on the VedaAI Automated Assessment Platform.

CURRENT CONTEXT OF THE USER & PLATFORM:
- User Name: ${userProfile?.name || 'Educator'} (${userProfile?.role || 'Teacher'})
- Institution: ${schoolDetails?.schoolName || 'High School'} (${schoolDetails?.campus || 'Main Campus'})
- Active Academic Year: ${academicYear || '2025-2026'}
- Saved Library Assessments: ${libraryItemsCount || 0} items
- Current Workspace Exam Sheet Status: ${
      currentMappingSummary
        ? `Assessment loaded with ${currentMappingSummary.total_questions || 0} questions, overall score ${currentMappingSummary.score_percentage || 0}%, feedback: "${currentMappingSummary.overall_feedback || ''}"`
        : 'No exam sheet currently mapped in workspace.'
    }

PLATFORM CAPABILITIES YOU SHOULD BE KNOWLEDGEABLE ABOUT:
1. Automated Assessment Digitization: Upload printed question paper and handwritten student answer sheets to transcribe text, map answers to questions across multiple pages, and draw bounding box overlays.
2. Multi-Page Continuation: Automatically tracks answers spanning multiple pages (e.g. Q1a spanning Pages 1-5, Q2a starting on Page 6).
3. Whole Integer & .5 Step Marking: Enforces standard academic grading increments (.5 or whole numbers only).
4. My Library: Persistent saving, loading, and deletion of past assessments.
5. Real-Time Home Analytics: Interactive SVG Donut charts for Grade Distribution and Vertical Column charts for Subject Topic Mastery.
6. AI Teacher Toolkit: Generate question papers, marking rubrics, model answer keys, and remedial learning tasks.

RULES FOR YOUR RESPONSES:
- Be warm, professional, articulate, and directly helpful to the user.
- DO NOT use any emojis in your response text.
- If the user says "hi", "hey", "how are you", or greets you, respond conversationally as VedaAI Assistant and ask how you can help them with their teaching, classroom data, or assessment grading today.
- Provide accurate answers according to the VedaAI platform features and current session state.
- Keep responses concise (1 to 3 paragraphs max).`;

    const groqMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text || m.content || '',
      })),
    ];

    let replyText = '';
    let lastError = null;

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
        lastError = err;
        console.warn(`Groq assistant model ${model} failed:`, err?.message);
      }
    }

    if (!replyText) {
      replyText = `Hello ${userProfile?.name || 'Educator'}! I am VedaAI Assistant. I am doing well and ready to assist you with answer paper grading, classroom rubrics, topic mastery analytics, and exporting your assessments. How can I help you today?`;
    }

    return NextResponse.json({ reply: replyText });
  } catch (error: any) {
    console.error('Chat Assistant API Error:', error);
    return NextResponse.json(
      { reply: "I am VedaAI Assistant. I am here to help you navigate VedaAI, analyze student assessment scores, or generate custom rubrics. What would you like assistance with?" },
      { status: 200 }
    );
  }
}
