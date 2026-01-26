
import { GoogleGenAI } from "@google/genai";
import { GameState } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getAdvisorFeedback = async (gameState: GameState, userPrompt: string) => {
  const model = "gemini-3-flash-preview";
  
  const systemPrompt = `You are "Jarvis", a very helpful, warm, and encouraging space assistant. 
  The user is playing a simple space game and wants easy-to-follow advice. 
  Don't use complex numbers or military jargon. Use emojis and friendly language.
  
  Current Situation (Day ${gameState.round}):
  - Gold: ${gameState.gold}
  - Our Ships: ${gameState.ships.filter(s => s.owner === 'PLAYER').length}
  - Our Worlds: ${gameState.planets.filter(p => p.owner === 'PLAYER').length}
  - We control: ${gameState.planets.filter(p => p.owner === 'PLAYER').map(p => p.name).join(', ')}
  
  Rule: Give ONE clear, fun suggestion. Be like a helpful friend, not a drill sergeant.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.8,
      },
    });
    return response.text || "I'm just checking the star charts, Commander! How can I help?";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The radio is a bit fuzzy, but I think you're doing great! Maybe send a ship to a new world?";
  }
};
