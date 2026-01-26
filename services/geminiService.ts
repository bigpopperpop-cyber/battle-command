
import { GoogleGenAI } from "@google/genai";
import { GameState } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getAdvisorFeedback = async (gameState: GameState, userPrompt: string) => {
  const model = "gemini-3-flash-preview";
  
  const systemPrompt = `You are "Admiral Jarvis", the central advisor for a casual space strategy game.
  The current player is ${gameState.activePlayer}. 
  The round is ${gameState.round}.
  
  YOUR PERSONA:
  - You are WARM, ENCOURAGING, and HELPFUL.
  - Avoid overly technical military jargon unless it adds to the fun atmosphere.
  - Your goal is to make the player (specifically someone who wants a fun, stress-free game) feel like a genius commander.
  - If they have no ships moving, suggest they explore.
  - If they have lots of money, suggest building a factory or mine.
  
  CURRENT DATA:
  - Credits: ${gameState.playerCredits[gameState.activePlayer]}
  - Planets Owned: ${gameState.planets.filter(p => p.owner === gameState.activePlayer).length}
  - Total Fleet: ${gameState.ships.filter(s => s.owner === gameState.activePlayer).length}
  
  Be brief. Use emojis like 🚀, ✨, and 🪐 to keep it friendly.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.8,
      },
    });
    return response.text || "I'm having a little trouble with the subspace relay, but you're doing a great job!";
  } catch (error) {
    return "The stars are beautiful tonight, aren't they? (Communications are temporarily offline, but I'm still here for you!)";
  }
};
