import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const apiKey = body.apiKey || process.env.GROQ_API_KEY;

    if (!apiKey || apiKey.includes('your_groq_api_key_here')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Groq API key missing or placeholder text found. Please check GROQ_API_KEY in .env.local.' 
        },
        { status: 400 }
      );
    }

    const groq = new Groq({ apiKey: apiKey.trim() });
    const prompt = body.prompt || 'Respond with a JSON object confirming Groq API connectivity: {"status": "online", "provider": "Groq", "message": "Ready for assessment extraction"}';

    // Fetch models available for this API key dynamically
    let availableModels: string[] = [];
    try {
      const modelsList = await groq.models.list();
      availableModels = modelsList.data.map((m: any) => m.id);
    } catch (e: any) {
      console.warn('Could not fetch models list directly:', e.message);
    }

    // Default candidate models if list query fails
    const candidateModels = availableModels.length > 0
      ? availableModels
      : (body.imageBase64 && body.mimeType
          ? ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview']
          : ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']);

    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        let messages: any[] = [];
        if (body.imageBase64 && body.mimeType) {
          const imageUrl = body.imageBase64.startsWith('data:')
            ? body.imageBase64
            : `data:${body.mimeType};base64,${body.imageBase64}`;

          messages = [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: { url: imageUrl },
                },
              ],
            },
          ];
        } else {
          messages = [
            {
              role: 'user',
              content: prompt,
            },
          ];
        }

        const chatCompletion = await groq.chat.completions.create({
          messages,
          model: modelName,
          temperature: 0.2,
        });

        const responseText = chatCompletion.choices[0]?.message?.content || '';

        return NextResponse.json({
          success: true,
          provider: 'Groq',
          modelUsed: modelName,
          availableModelsCount: availableModels.length,
          rawResponse: responseText,
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${modelName} attempt error:`, err.message || err);
      }
    }

    return NextResponse.json(
      { 
        success: false, 
        error: lastError?.message || 'Groq API request failed. Please check your API key.' 
      },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('Groq Test Route Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to connect to Groq API.' 
      },
      { status: 500 }
    );
  }
}
