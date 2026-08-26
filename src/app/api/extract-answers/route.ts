import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import pdfParse from 'pdf-parse';

const ANSWER_EXTRACTION_SYSTEM_PROMPT = `You are an expert AI handwritten answer sheet digitizer and OCR layout parser.

Your task is to transcribe and extract every distinct student answer block from the provided handwritten answer sheet document or image.

For EVERY student answer block found, extract:
1. "matched_question_number": The question label written by the student or inferred (e.g. "11(a)", "11(b)", "12(a)", "13"). If unlabelled or unclear, set to null.
2. "raw_text": Transcribe the complete handwritten text of the student's answer. Preserve math formulas, step-by-step calculations, and exact student phrasing.
3. "pages": Array of page region locations for this answer block, where each element is an object:
   - "page_number": Integer (1-indexed page number).
   - "bbox": Array of 4 normalized integers [ymin, xmin, ymax, xmax] on a scale of 0 to 1000.
     - ymin: Top coordinate (0 = top of page, 1000 = bottom of page)
     - xmin: Left coordinate (0 = left of page, 1000 = right of page)
     - ymax: Bottom coordinate
     - xmax: Right coordinate

STRICT JSON OUTPUT FORMAT:
Return ONLY a valid JSON object matching this schema:
{
  "answer_blocks": [
    {
      "matched_question_number": "11(a)",
      "raw_text": "Transcribed handwritten student answer...",
      "pages": [
        {
          "page_number": 1,
          "bbox": [150, 80, 420, 920]
        }
      ]
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

    let answerText = '';
    let imageBase64 = '';
    let mimeType = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const rawTextInput = formData.get('text') as string | null;

      if (rawTextInput) {
        answerText = rawTextInput;
      } else if (file) {
        const buffer = Buffer.from(await file.arrayBuffer());
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          try {
            const pdfData = await pdfParse(buffer);
            answerText = pdfData.text;
          } catch (pdfErr: any) {
            console.error('PDF Parse Error:', pdfErr);
            return NextResponse.json(
              { success: false, error: `Failed to parse PDF file: ${pdfErr.message}` },
              { status: 400 }
            );
          }
        } else if (file.type.startsWith('image/')) {
          imageBase64 = buffer.toString('base64');
          mimeType = file.type;
        } else {
          answerText = buffer.toString('utf-8');
        }
      }
    } else {
      const jsonBody = await req.json().catch(() => ({}));
      answerText = jsonBody.text || '';
      imageBase64 = jsonBody.imageBase64 || '';
      mimeType = jsonBody.mimeType || 'image/jpeg';
    }

    if (!answerText && !imageBase64) {
      return NextResponse.json(
        { success: false, error: 'No student answer sheet text, PDF, or image file provided.' },
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

    const candidateModels = imageBase64
      ? availableModels.filter(m => m.includes('vision'))
      : availableModels;

    if (candidateModels.length === 0) {
      if (imageBase64) {
        candidateModels.push('llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview');
      } else {
        candidateModels.push('llama-3.1-8b-instant', 'llama-3.3-70b-versatile');
      }
    }

    let rawResponseText = '';
    let selectedModel = '';
    let lastErr: any = null;

    for (const modelName of candidateModels) {
      try {
        let messages: any[] = [];
        if (imageBase64) {
          const imageUrl = imageBase64.startsWith('data:')
            ? imageBase64
            : `data:${mimeType};base64,${imageBase64}`;

          messages = [
            { role: 'system', content: ANSWER_EXTRACTION_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extract and transcribe all student handwritten answer blocks with bounding boxes from this answer sheet.' },
                { type: 'image_url', image_url: { url: imageUrl } },
              ],
            },
          ];
        } else {
          messages = [
            { role: 'system', content: ANSWER_EXTRACTION_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Extract all student answer blocks from the following student answer sheet text:\n\n${answerText}`,
            },
          ];
        }

        const completion = await groq.chat.completions.create({
          messages,
          model: modelName,
          temperature: 0.1,
          response_format: { type: 'json_object' },
        });

        rawResponseText = completion.choices[0]?.message?.content || '{}';
        selectedModel = modelName;
        break; // Success!
      } catch (err: any) {
        lastErr = err;
        console.warn(`Answer extraction attempt failed with model ${modelName}:`, err.message || err);
      }
    }

    if (!rawResponseText) {
      return NextResponse.json(
        { success: false, error: lastErr?.message || 'Answer extraction failed with available Groq models.' },
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

    const rawAnswers = Array.isArray(parsedResult.answer_blocks)
      ? parsedResult.answer_blocks
      : Array.isArray(parsedResult.answers)
      ? parsedResult.answers
      : Array.isArray(parsedResult)
      ? parsedResult
      : [];

    const answer_blocks = rawAnswers.map((ans: any) => {
      // Normalize bounding box format: [ymin, xmin, ymax, xmax] 0-1000 scale
      let pages = Array.isArray(ans.pages) ? ans.pages : [];
      if (pages.length === 0 && ans.bbox) {
        pages = [{ page_number: ans.page_number || 1, bbox: ans.bbox }];
      } else if (pages.length === 0) {
        pages = [{ page_number: 1, bbox: [100, 100, 500, 900] }];
      }

      pages = pages.map((p: any) => {
        let bbox = Array.isArray(p.bbox) ? p.bbox : [100, 100, 500, 900];
        // Ensure 4 normalized integer coords [ymin, xmin, ymax, xmax]
        bbox = bbox.slice(0, 4).map((val: any) => Math.max(0, Math.min(1000, Math.round(Number(val) || 0))));
        if (bbox.length < 4) bbox = [100, 100, 500, 900];

        return {
          page_number: typeof p.page_number === 'number' ? p.page_number : 1,
          bbox,
        };
      });

      return {
        matched_question_number: ans.matched_question_number || ans.question_number || null,
        match_confidence: typeof ans.match_confidence === 'number' ? ans.match_confidence : 0.0,
        raw_text: String(ans.raw_text || ans.text || ans.answer_text || ''),
        pages,
      };
    });

    return NextResponse.json({
      success: true,
      answer_blocks_count: answer_blocks.length,
      answer_blocks,
      model_used: selectedModel,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Answer Extraction Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to extract student answers.' },
      { status: 500 }
    );
  }
}
