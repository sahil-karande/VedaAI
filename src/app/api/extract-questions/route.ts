import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import pdfParse from 'pdf-parse';

const getExtractionSystemPrompt = (language: string) => `You are an expert exam paper parser.
The question paper language is: ${language || 'English'}.

CRITICAL EXTRACTION REQUIREMENTS:
1. PRESERVE ORIGINAL NUMBERING & SCRIPT: Extract question_number strings EXACTLY as printed (e.g. "1(a)", "2(a)", "१(अ)", "२(क)", "प्रश्न १(अ)"). Do NOT renumber or standardize question numbers. Preserve original Devanagari script for Hindi/Marathi or Latin script for English.
2. SUB-PARTS AS SEPARATE ENTRIES: Treat labelled sub-parts (e.g., 1(a), 2(a), १(अ), २(क)) as separate entries in the output list.
3. PRESERVE PRINTED ORDER: Maintain the exact printed sequence using a zero-indexed integer field "order_index" (0, 1, 2, ...).
4. EXTRACT MARKS: Extract the printed marks/points for each question as a number field "max_marks" (e.g. 5, 3, 2, 5). If unspecified, estimate default 5.
5. COMPLETE TEXT: Include the full, unabridged question text in ${language}.
6. STRICT JSON OUTPUT: Return ONLY a valid JSON object matching this schema:
{
  "questions": [
    {
      "question_number": "1(a)",
      "question_text": "Question text in ${language}...",
      "max_marks": 5,
      "order_index": 0
    }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey.includes('your_groq_api_key_here')) {
      return NextResponse.json(
        { success: false, error: 'GROQ_API_KEY is missing or invalid in .env.local' },
        { status: 400 }
      );
    }

    const groq = new Groq({ apiKey: apiKey.trim() });
    const contentType = req.headers.get('content-type') || '';

    let paperText = '';
    let imageBase64 = '';
    let mimeType = '';
    let pageImages: string[] = [];
    let paperLanguage = 'English';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const rawTextInput = formData.get('text') as string | null;
      const pageImagesInput = formData.get('pageImages') as string | null;
      const langInput = (formData.get('paperLanguage') || formData.get('language')) as string | null;

      if (langInput) paperLanguage = String(langInput);

      if (pageImagesInput) {
        try { pageImages = JSON.parse(pageImagesInput); } catch (e) {}
      }

      if (rawTextInput) {
        paperText = rawTextInput;
      } else if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          try {
            const pdfData = await pdfParse(buffer);
            paperText = pdfData.text;
          } catch (pdfErr: any) {
            console.error('PDF Parsing Error:', pdfErr);
          }
        } else if (file.type.startsWith('image/')) {
          imageBase64 = buffer.toString('base64');
          mimeType = file.type;
        } else {
          paperText = buffer.toString('utf-8');
        }
      }
    } else {
      const jsonBody = await req.json().catch(() => ({}));
      paperText = jsonBody.text || '';
      imageBase64 = jsonBody.imageBase64 || '';
      mimeType = jsonBody.mimeType || 'image/jpeg';
      pageImages = Array.isArray(jsonBody.pageImages) ? jsonBody.pageImages : [];
      paperLanguage = jsonBody.paperLanguage || jsonBody.language || 'English';
    }

    if (pageImages.length > 0 && !imageBase64) {
      imageBase64 = pageImages[0];
    }

    if (!paperText && !imageBase64 && pageImages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No question paper text, PDF, or image file provided.' },
        { status: 400 }
      );
    }

    // Fetch models available for this API key dynamically
    let availableModels: string[] = [];
    try {
      const modelsList = await groq.models.list();
      availableModels = modelsList.data.map((m: any) => m.id);
    } catch (e: any) {
      console.warn('Could not fetch models list directly:', e);
    }

    const candidateModels = (imageBase64 || pageImages.length > 0)
      ? ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview']
      : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

    let rawResponseText = '';
    let selectedModel = '';
    let lastErr: any = null;

    const systemPrompt = getExtractionSystemPrompt(paperLanguage);

    for (const modelName of candidateModels) {
      try {
        let messages: any[] = [];
        if (imageBase64 || pageImages.length > 0) {
          const contentList: any[] = [
            { type: 'text', text: `Extract all questions from this printed question paper image in ${paperLanguage} according to instructions.` },
          ];

          const imagesToProcess = pageImages.length > 0 ? pageImages.slice(0, 3) : [imageBase64];
          imagesToProcess.forEach((imgStr) => {
            const imageUrl = imgStr.startsWith('data:')
              ? imgStr
              : `data:${mimeType || 'image/png'};base64,${imgStr}`;
            contentList.push({ type: 'image_url', image_url: { url: imageUrl } });
          });

          messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contentList },
          ];
        } else {
          messages = [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Extract all questions in ${paperLanguage} from the following printed question paper text:\n\n${paperText}`,
            },
          ];
        }

        const completion = await groq.chat.completions.create({
          messages: messages as any,
          model: modelName,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });

        rawResponseText = completion.choices[0]?.message?.content || '{}';
        selectedModel = modelName;
        break; // Success!
      } catch (err: any) {
        lastErr = err;
        console.warn(`Model ${modelName} extraction attempt error:`, err.message || err);
      }
    }

    if (!rawResponseText) {
      return NextResponse.json(
        { success: false, error: lastErr?.message || 'Question extraction failed with available Groq models.' },
        { status: 500 }
      );
    }

    let parsedResult: any = {};
    try {
      parsedResult = JSON.parse(rawResponseText);
    } catch (parseErr) {
      const cleanedText = rawResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedResult = JSON.parse(cleanedText);
    }

    const rawQuestions = Array.isArray(parsedResult.questions)
      ? parsedResult.questions
      : Array.isArray(parsedResult)
      ? parsedResult
      : [];

    const questions = rawQuestions.map((q: any, idx: number) => ({
      question_number: String(q.question_number || q.number || `Q${idx + 1}`),
      question_text: String(q.question_text || q.text || ''),
      max_marks: Number(q.max_marks || q.marks || 5),
      order_index: typeof q.order_index === 'number' ? q.order_index : idx,
    }));

    return NextResponse.json({
      success: true,
      questions_count: questions.length,
      questions,
      model_used: selectedModel,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Question Extraction Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to extract questions.' },
      { status: 500 }
    );
  }
}
