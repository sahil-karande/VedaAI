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
    let pageImages: string[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const rawTextInput = formData.get('text') as string | null;
      const pageImagesInput = formData.get('pageImages') as string | null;

      if (pageImagesInput) {
        try { pageImages = JSON.parse(pageImagesInput); } catch (e) {}
      }

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
      pageImages = Array.isArray(jsonBody.pageImages) ? jsonBody.pageImages : [];
    }

    if (pageImages.length === 0 && imageBase64) {
      pageImages = [imageBase64];
    }

    if (!answerText && pageImages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No student answer sheet text, PDF, or image file provided.' },
        { status: 400 }
      );
    }

    // Candidate vision models
    const candidateModels = [
      'llama-3.2-11b-vision-preview',
      'llama-3.2-90b-vision-preview',
      'llama-3.2-11b-vision-instruct',
    ];

    const allExtractedBlocks: any[] = [];
    let selectedModel = 'llama-3.2-11b-vision-preview';

    if (pageImages.length > 0) {
      // Process page images page by page with Vision LLM
      for (let pIdx = 0; pIdx < pageImages.length; pIdx++) {
        const pageNum = pIdx + 1;
        const imgStr = pageImages[pIdx];
        const imageUrl = imgStr.startsWith('data:')
          ? imgStr
          : `data:${mimeType || 'image/png'};base64,${imgStr}`;

        let pageSuccess = false;
        for (const modelName of candidateModels) {
          try {
            const messages = [
              { role: 'system', content: ANSWER_EXTRACTION_SYSTEM_PROMPT },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `This is Page ${pageNum} of the student's handwritten answer sheet. Extract all student handwritten answer blocks on Page ${pageNum} with exact matched_question_number (e.g., 1(a), 2(a), 2(b), 3(a)), complete transcribed text, and accurate 0-1000 scale bounding box coords [ymin, xmin, ymax, xmax]. Set page_number to ${pageNum} for all extracted blocks.`,
                  },
                  { type: 'image_url', image_url: { url: imageUrl } },
                ],
              },
            ];

            const completion = await groq.chat.completions.create({
              messages: messages as any,
              model: modelName,
              temperature: 0.1,
              response_format: { type: 'json_object' },
            });

            const content = completion.choices[0]?.message?.content || '{}';
            let parsedPage: any = {};
            try {
              parsedPage = JSON.parse(content);
            } catch (e) {
              const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
              parsedPage = JSON.parse(cleaned);
            }

            const rawBlocks = Array.isArray(parsedPage.answer_blocks)
              ? parsedPage.answer_blocks
              : Array.isArray(parsedPage.answers)
              ? parsedPage.answers
              : Array.isArray(parsedPage)
              ? parsedPage
              : [];

            rawBlocks.forEach((block: any) => {
              if (!block.pages || !Array.isArray(block.pages) || block.pages.length === 0) {
                block.pages = [{ page_number: pageNum, bbox: block.bbox || [100, 100, 500, 900] }];
              } else {
                block.pages = block.pages.map((p: any) => ({
                  page_number: p.page_number || pageNum,
                  bbox: p.bbox || [100, 100, 500, 900],
                }));
              }
              allExtractedBlocks.push(block);
            });

            selectedModel = modelName;
            pageSuccess = true;
            break; // Next page
          } catch (err: any) {
            console.warn(`Vision model ${modelName} error on page ${pageNum}:`, err.message || err);
          }
        }
      }
    } else {
      // Fallback text parsing
      for (const modelName of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']) {
        try {
          const completion = await groq.chat.completions.create({
            messages: [
              { role: 'system', content: ANSWER_EXTRACTION_SYSTEM_PROMPT },
              {
                role: 'user',
                content: `Extract all student answer blocks from the following text:\n\n${answerText}`,
              },
            ],
            model: modelName,
            temperature: 0.1,
            response_format: { type: 'json_object' },
          });

          const content = completion.choices[0]?.message?.content || '{}';
          const parsed = JSON.parse(content);
          const rawBlocks = parsed.answer_blocks || parsed.answers || [];
          rawBlocks.forEach((b: any) => allExtractedBlocks.push(b));
          selectedModel = modelName;
          break;
        } catch (e: any) {
          console.warn(`Text model ${modelName} error:`, e.message);
        }
      }
    }

    const answer_blocks = allExtractedBlocks.map((ans: any) => {
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
