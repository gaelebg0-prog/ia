
import { GoogleGenAI, GenerateContentResponse, Part, Content } from "@google/genai";
import { Message, Role } from "../types";

// Always use process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Transforms application messages into Gemini API Content format.
 * This ensures that the model sees previous images and context.
 */
const formatMessageToContent = (msg: Message): Content => {
  const parts: Part[] = [];

  // Add text part
  if (msg.text) {
    parts.push({ text: msg.text });
  }

  // Add attachments if they exist (Gemini supports multiple parts per turn)
  if (msg.attachments && msg.attachments.length > 0) {
    msg.attachments.forEach(att => {
      parts.push({
        inlineData: {
          mimeType: att.mimeType,
          data: att.data
        }
      });
    });
  }

  // Ensure at least one part exists (Gemini requirement)
  if (parts.length === 0) {
    parts.push({ text: " " });
  }

  return {
    role: msg.role === Role.USER ? 'user' : 'model',
    parts
  };
};

export const generateGeminiResponse = async (
  prompt: string,
  history: Message[],
  attachments: any[] = [],
  ocrMode: boolean = false,
  objectDetectionMode: boolean = false
): Promise<string> => {
  const model = 'gemini-3-flash-preview';
  
  // 1. Prepare conversation history
  const contents: Content[] = history.map(formatMessageToContent);

  // 2. Prepare current turn parts
  const currentParts: Part[] = [];
  
  let finalPrompt = prompt.trim();
  
  // Adjust prompt based on active modes
  if (objectDetectionMode) {
    const detectInstruction = "ACTION REQUISE : Analyse l'image et effectue une détection d'objets exhaustive. Liste tous les objets identifiables, leur emplacement approximatif et leurs caractéristiques notables (couleur, état, etc.). Structure ta réponse sous forme de liste à puces claire.";
    finalPrompt = finalPrompt ? `${detectInstruction}\n\nNotes de l'utilisateur : ${finalPrompt}` : detectInstruction;
  } else if (ocrMode) {
    const ocrInstruction = "ACTION REQUISE : Effectue une reconnaissance optique de caractères (OCR). Extrais TOUT le texte lisible des fichiers joints. Conserve la mise en forme si possible. Ne fais pas de description de l'image, donne uniquement le texte extrait.";
    finalPrompt = finalPrompt ? `${ocrInstruction}\n\nContexte supplémentaire de l'utilisateur : ${finalPrompt}` : ocrInstruction;
  } else if (!finalPrompt && attachments.length > 0) {
    finalPrompt = "Analyse cette image ou ce document.";
  }

  currentParts.push({ text: finalPrompt || "Bonjour" });

  attachments.forEach(att => {
    currentParts.push({
      inlineData: {
        mimeType: att.mimeType,
        data: att.data
      }
    });
  });

  // 3. Add current turn to contents
  contents.push({
    role: 'user',
    parts: currentParts
  });

  // 4. System Instruction optimized for Vision, Documents, OCR and Detection
  const systemInstruction = `Tu es un assistant IA français expert en vision par ordinateur et analyse de données. 
${objectDetectionMode ? "Tu es en MODE DÉTECTION. Ta mission est d'identifier chaque élément visuel important." : ""}
${ocrMode ? "Tu es en MODE OCR. Ta priorité est la transcription textuelle exacte." : ""}

Instructions :
- Utilise le Markdown pour une présentation élégante (tableaux, listes, gras).
- Sois précis et technique si nécessaire.
- Si plusieurs images sont fournies, traite-les séparément dans ta réponse.
- En cas de détection d'objets, mentionne aussi le contexte global de la scène.`;

  try {
    // Call generateContent directly with model name and configuration
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: {
        systemInstruction,
        temperature: (ocrMode || objectDetectionMode) ? 0.2 : 0.7,
        topP: 0.95,
        topK: 64,
      },
    });

    // Access .text property directly (not a method)
    return response.text || "Désolé, je n'ai pas pu générer de réponse intelligible.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    if (error.message?.includes('413')) {
      throw new Error("Les fichiers sont trop volumineux pour être analysés d'un coup.");
    }
    throw new Error("Une erreur est survenue lors de la communication avec l'IA.");
  }
};
