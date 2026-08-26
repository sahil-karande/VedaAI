import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = body.apiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Gemini API key missing. Please provide it in the input field or set GEMINI_API_KEY in .env.local.' 
        },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // We try gemini-2.5-flash first, falling back to gemini-1.5-flash if needed
    let modelName = 'gemini-2.5-flash';
    let responseText = '';

    const prompt = body.prompt || 'Respond with a simple JSON object confirming system readiness: {"status": "online", "model": "Gemini Multimodal", "message": "Ready to extract questions and student answers"}';

    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      let contents: any = prompt;

      if (body.imageBase64 && body.mimeType) {
        contents = [
          prompt,
          {
            inlineData: {
              data: body.imageBase64.replace(/^data:image\/\w+;base64,/, ''),
              mimeType: body.mimeType,
            },
          },
        ];
      }

      const result = await model.generateContent(contents);
      responseText = result.response.text();
    } catch (e: any) {
      // Fallback to gemini-1.5-flash if 2.5 model ID is different in free tier
      modelName = 'gemini-1.5-flash';
      const fallbackModel = genAI.getGenerativeModel({ model: modelName });
      let contents: any = prompt;

      if (body.imageBase64 && body.mimeType) {
        contents = [
          prompt,
          {
            inlineData: {
              data: body.imageBase64.replace(/^data:image\/\w+;base64,/, ''),
              mimeType: body.mimeType,
            },
          },
        ];
      }

      const result = await fallbackModel.generateContent(contents);
      responseText = result.response.text();
    }

    return NextResponse.json({
      success: true,
      modelUsed: modelName,
      rawResponse: responseText,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Gemini Test Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to connect to Gemini API.' 
      },
      { status: 500 }
    );
  }
}
