import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return NextResponse.json({ result: response.text });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
