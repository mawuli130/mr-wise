
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { FormattingOptions, AppMode, ExamBoard, NewsCategory, NewsItem, QuestionEntry } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const rebrandImage = async (
  imageFile: File, 
  tutorName: string, 
  tutorPhone: string,
  size: string = 'medium',
  position: string = 'bottom center'
): Promise<string> => {
  const base64Data = await fileToBase64(imageFile);
  const dataOnly = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          inlineData: {
            data: dataOnly,
            mimeType: imageFile.type,
          },
        },
        {
          text: `CRITICAL "LEGIT-IFY" EDITING TASK:
          1. CONTEXT-AWARE ERASURE: Detect and meticulously remove ALL foreign branding, watermarks, logos, stamps, social media handles, and phone numbers. This is for educational rebranding.
          2. IMAGE HEALING: If a watermark or logo overlaps existing text, mathematical equations, or diagrams, you MUST reconstruct the underlying lines and data naturally to ensure the question is still readable.
          3. REBRANDING: Seamlessly integrate the new branding: "${tutorName} LEGIT SOURCE" and the contact "${tutorPhone}".
          4. STYLING:
             - FONT SIZE: ${size}
             - PLACEMENT: ${position}
          5. ENSURE the result looks like an original official document from the new source. The output must be a single clean image.`,
        },
      ],
    },
  });

  if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content?.parts) {
    throw new Error("Rebranding failed: No valid content returned from the AI.");
  }

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Rebranding failed: No image data found in the AI response.");
};

export const generateTutorVoice = async (text: string): Promise<Uint8Array> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Read this educational guide clearly for a student: ${text.substring(0, 500)}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Kore' }, 
        },
      },
    },
  });

  if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content?.parts || response.candidates[0].content.parts.length === 0) {
    throw new Error("Voice generation failed: No valid content returned from the AI.");
  }

  const base64Audio = response.candidates[0].content.parts[0].inlineData?.data;
  if (!base64Audio) throw new Error("Voice generation failed: No audio data found in the AI response part.");

  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export const generateAIImage = async (prompt: string): Promise<string> => {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { text: `Create a professional educational illustration or photo for a social media post: ${prompt}. Style: High quality, vibrant, suitable for an African education setting.` }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1"
      }
    }
  });

  if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content?.parts) {
    throw new Error("Image generation failed: No valid content returned from the AI.");
  }

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image data found in the AI response.");
};

export const chatWithAssistantStream = async (message: string, memory?: string) => {
  const contextPrompt = memory 
    ? `\n\n[CRITICAL STRATEGIC CONTEXT - TUTOR BRAIN]:
    The tutor has provided their mission, workflow, and profit strategy below. 
    Use this to give strategic advice, schedule posts, and manage groups:
    \n${memory}`
    : "";

  return await ai.models.generateContentStream({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: message }] }],
    config: {
      thinkingConfig: { thinkingBudget: 0 }, 
      systemInstruction: `You are the "Mr. Wise AI Strategic Partner". 
      You are not just a chatbot; you are a business consultant for a top-tier West African Tutor.
      
      CORE OBJECTIVES:
      1. Help the tutor maintain their high-profit workflow.
      2. Suggest optimal times for engagement.
      3. Proactively suggest community activities based on the tutor's "Why" and "Mission".
      
      TONE:
      - Highly analytical but respectful and professional.
      - Uses WhatsApp formatting (*bold*, _italics_).
      
      ${contextPrompt}
      
      WHEN ASKED FOR STRATEGY:
      - Look at the "Mission" and "Profit Logic" in memory.
      - Suggest specific actions.
      - Recommend group opening times.`
    }
  });
};

export const fetchGhanaEducationNews = async (category: NewsCategory): Promise<NewsItem[]> => {
  const queries = {
    WASSCE: "latest WASSCE and WAEC Ghana 2024 2025 news updates and exam dates",
    BECE: "latest BECE Ghana 2024 2025 news updates result dates and placements",
    NABTEB: "latest NABTEB and technical vocational education news Ghana 2024 2025",
    GES: "latest Ghana Education Service GES official news updates and teacher recruitment"
  };

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [{ parts: [{ text: `Fetch the 4 most recent and important news items for: ${queries[category]}. 
    Format each item as a JSON object with: title, summary (max 30 words), source, and date.
    Ensure they are specifically about Ghana.` }] }],
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            summary: { type: Type.STRING },
            source: { type: Type.STRING },
            date: { type: Type.STRING }
          },
          required: ["title", "summary", "source", "date"]
        }
      }
    },
  });

  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const results = JSON.parse(response.text || "[]");

  return results.map((item: any, index: number) => ({
    id: Math.random().toString(36).substr(2, 9),
    ...item,
    url: groundingChunks[index]?.web?.uri || groundingChunks[0]?.web?.uri || "https://www.waecgh.org"
  }));
};

export const processQuestions = async (
  inputs: (string | File)[], 
  subjectInput: string, 
  options: FormattingOptions,
  mode: AppMode,
  year: string,
  board: ExamBoard
): Promise<{ subject: string, questions: QuestionEntry[], test: string, answers: string, tutorGuide: string }> => {
  
  const numberingLogic = options.autoRenumber 
    ? `CRITICAL RENUMBERING INSTRUCTION:
       - DO NOT USE THE NUMBERS FROM THE SOURCE.
       - THE FIRST QUESTION YOU OUTPUT MUST BE NUMBER 1.
       - THE SECOND MUST BE 2, AND SO ON.
       - IF THE INPUT STARTS AT QUESTION 7, YOU MUST STILL CHANGE IT TO 1.`
    : `PRESERVE ORIGINAL NUMBERING:
       - KEEP the question numbers exactly as they appear in the source material.`;

  const systemInstruction = `
    You are Mr. Wise, the West African Exam Specialist.
    Your task is to extract exam questions and provide simplified solutions.

    RENUMBERING INSTRUCTION:
    ${numberingLogic}

    LANGUAGE RULES:
    - Use VERY simple English for solutions.
    - Explain 'How' and 'Why' in the "guide" field.
    - Format all text for WhatsApp using *bold* for question numbers.

    OUTPUT SCHEMA:
    Return an object containing:
    - subject: The subject name.
    - questions: Array of granular question objects.
    - test: A SINGLE COMPILED TEXT STRING of all questions formatted for WhatsApp.
    - answers: A SINGLE COMPILED TEXT STRING of all answers formatted for WhatsApp.
    - tutorGuide: A SINGLE COMPILED TEXT STRING of all guide notes formatted for WhatsApp.
  `;

  const parts: any[] = [];
  parts.push({ text: `Extract all questions from this ${board} paper. Subject: ${subjectInput || 'Unknown'}.` });

  for (const input of inputs) {
    if (typeof input === 'string') {
      parts.push({ text: input });
    } else {
      const base64Data = await fileToBase64(input);
      const dataOnly = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      parts.push({
        inlineData: {
          mimeType: input.type || 'application/pdf',
          data: dataOnly
        }
      });
    }
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts },
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          test: { type: Type.STRING },
          answers: { type: Type.STRING },
          tutorGuide: { type: Type.STRING },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                questionNumber: { type: Type.NUMBER },
                text: { type: Type.STRING },
                answer: { type: Type.STRING },
                guide: { type: Type.STRING }
              },
              required: ["questionNumber", "text", "answer", "guide"]
            }
          }
        },
        required: ["subject", "questions", "test", "answers", "tutorGuide"]
      }
    },
  });

  try {
    const data = JSON.parse(response.text || "{}");
    data.questions = data.questions.map((q: any, idx: number) => ({
      ...q,
      id: q.id || `q-${idx}-${Date.now()}`
    }));
    return data;
  } catch (e) {
    console.error("AI parse failed:", response.text);
    throw new Error("Failed to process paper. Ensure clarity.");
  }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
