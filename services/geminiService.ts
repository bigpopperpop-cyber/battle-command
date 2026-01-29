
import { GoogleGenAI, Type } from "@google/genai";
import { GameState, Owner } from "../types";

export const getAdvisorFeedback = async (gameState: GameState, userPrompt: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const player = gameState.activePlayer;
  const credits = gameState.playerCredits[player] || 0;
  
  const systemInstruction = `You are "Admiral Jarvis", a helpful and warm galactic advisor.
  The player is ${gameState.playerNames[player]} (${player}).
  Current Round: ${gameState.round}.
  Credits: ${credits}.
  Owned Planets: ${gameState.planets.filter(p => p.owner === player).length}.

  Persona:
  - Encouraging, brief, and tactical.
  - Suggest colonizing Neutral planets if credits are high.
  - Suggest building mines for income or factories for ship slots.
  - Use emojis like 🪐, 🚀, ✨.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });
    return response.text || "Subspace interference detected, Commander. Please repeat.";
  } catch (error) {
    console.error(error);
    return "Signal lost. But I'm still here in spirit! Keep expanding! ✨";
  }
};
