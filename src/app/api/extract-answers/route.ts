import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import pdfParse from 'pdf-parse';

const ANSWER_EXTRACTION_SYSTEM_PROMPT = `You are an expert AI handwritten answer sheet digitizer and OCR layout parser.

Your task is to transcribe and extract EVERY SINGLE student answer block from the provided handwritten answer sheet page image.

CRITICAL INSTRUCTIONS FOR FULL ANSWER CAPTURE & BOUNDING BOXES:
1. "matched_question_number": Identify the exact question number written at the top or margin of the answer (e.g., "1(a)", "2(a)", "2(b)", "3(a)"). If a handwritten answer is a continuation of a question from an earlier page without a new label, tag it with the question number it continues.
2. "raw_text": Transcribe ALL handwritten text for this question on the page Thoroughly and Unabridged from top to bottom. Do NOT omit any paragraphs, bullet points, sub-headings (e.g., i) Hub, ii) Switch, iii) Router), diagrams, or concluding statements.
3. PRECISE BOUNDING BOX ("bbox"): Provide an accurate 4-integer array [ymin, xmin, ymax, xmax] on a 0 to 1000 scale that bounds the COMPLETE handwritten text area for this answer from its starting line down to its ending line on this page:
   - ymin: Topmost line of handwriting for this answer.
   - xmin: Leftmost margin of handwriting.
   - ymax: Bottommost line of handwriting for this answer (cover all text written down the page).
   - xmax: Rightmost margin of handwriting.

STRICT JSON OUTPUT FORMAT:
Return ONLY a valid JSON object matching this schema:
{
  "answer_blocks": [
    {
      "matched_question_number": "2(a)",
      "raw_text": "Full transcribed text covering all sub-points i) Hub, ii) Switch, iii) Router...",
      "pages": [
        {
          "page_number": 1,
          "bbox": [100, 50, 950, 950]
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

    // Valid Groq vision candidate models
    const candidateModels = [
      'llama-3.2-11b-vision-preview',
      'llama-3.2-90b-vision-preview',
    ];

    const allExtractedBlocks: any[] = [];
    let selectedModel = 'llama-3.2-11b-vision-preview';

    if (pageImages.length > 0) {
      // Parallel vision extraction across all pages concurrently
      const pagePromises = pageImages.map(async (imgStr, pIdx) => {
        const pageNum = pIdx + 1;
        const imageUrl = imgStr.startsWith('data:')
          ? imgStr
          : `data:${mimeType || 'image/jpeg'};base64,${imgStr}`;

        for (const modelName of candidateModels) {
          try {
            const completion = await groq.chat.completions.create({
              messages: [
                { role: 'system', content: ANSWER_EXTRACTION_SYSTEM_PROMPT },
                {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: `Page ${pageNum} of handwritten answer sheet. Extract all student handwritten answer blocks on Page ${pageNum} with exact matched_question_number (e.g., 1(a), 2(a), 2(b), 3(a)), complete transcribed text, and accurate 0-1000 scale bounding box coords [ymin, xmin, ymax, xmax].`,
                    },
                    { type: 'image_url', image_url: { url: imageUrl } },
                  ],
                },
              ] as any,
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

            return rawBlocks.map((block: any) => ({
              ...block,
              pages: [{ page_number: pageNum, bbox: block.bbox || (block.pages && block.pages[0]?.bbox) || [100, 100, 500, 900] }],
            }));
          } catch (err: any) {
            console.warn(`Vision model ${modelName} error on page ${pageNum}:`, err.message || err);
          }
        }
        return [];
      });

      const pageResults = await Promise.all(pagePromises);
      
      // Page sequence continuation tracking across pages 1..N
      let currentActiveQuestionNumber: string | null = null;

      for (let pIdx = 0; pIdx < pageResults.length; pIdx++) {
        const pageNum = pIdx + 1;
        const pageBlocks = pageResults[pIdx] || [];

        if (pageBlocks.length > 0) {
          pageBlocks.forEach((block: any) => {
            const rawQNum = block.matched_question_number;
            if (rawQNum && String(rawQNum).trim() !== '' && String(rawQNum).trim().toLowerCase() !== 'null') {
              currentActiveQuestionNumber = String(rawQNum).trim();
              allExtractedBlocks.push({
                ...block,
                matched_question_number: currentActiveQuestionNumber,
              });
            } else if (currentActiveQuestionNumber) {
              allExtractedBlocks.push({
                ...block,
                matched_question_number: currentActiveQuestionNumber,
                pages: [{ page_number: pageNum, bbox: block.pages?.[0]?.bbox || [100, 50, 950, 950] }],
              });
            } else {
              allExtractedBlocks.push(block);
            }
          });
        } else if (currentActiveQuestionNumber) {
          // Unlabeled continuation page between question headers
          allExtractedBlocks.push({
            matched_question_number: currentActiveQuestionNumber,
            raw_text: `[Handwritten Answer Continuation for Q${currentActiveQuestionNumber} on Page ${pageNum}]`,
            pages: [{ page_number: pageNum, bbox: [100, 50, 950, 950] }],
          });
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
