
import { GoogleGenAI } from "@google/genai";
import { GameState } from "../types";

// Initialize the GoogleGenAI client using the required named parameter and direct process.env.API_KEY.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getAdvisorFeedback = async (gameState: GameState, userPrompt: string) => {
  const model = "gemini-3-flash-preview";
  
  const systemPrompt = `You are "Admiral Jarvis", a helpful, friendly space advisor for a user playing a strategy game. 
  The user is non-technical and wants simple, strategic advice. 
  Avoid complex tables or numbers unless necessary. Focus on "The Vibe" and "What to do next".
  
  Current Game Status (Round ${gameState.round}):
  - Player Credits: ${gameState.credits}
  - Player Ships: ${gameState.ships.filter(s => s.owner === 'PLAYER').length}
  - Player Planets: ${gameState.planets.filter(p => p.owner === 'PLAYER').length}
  - Controlled Planets: ${gameState.planets.filter(p => p.owner === 'PLAYER').map(p => p.name).join(', ')}
  
  Recent Logs: ${gameState.logs.slice(-3).join('. ')}
  
  Rules for response:
  1. Keep it concise.
  2. Use a reassuring, military but friendly tone.
  3. Suggest one clear action (e.g., "Build mines on Rigel VII" or "Move the scout to Antares").
  4. If user asks "What should I do?", give a top priority.`;

  try {
    // Generate content by specifying the model and contents directly in the call.
    const response = await ai.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    });
    // Extract text output using the .text property (not a method).
    return response.text || "I'm having trouble connecting to central command, Admiral.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The subspace transceiver is down. I recommend focusing on your current borders.";
  }
};
