import { GoogleGenAI, Type } from "@google/genai";
import { GameState, Owner } from "../types";

export const getAdvisorFeedback = async (gameState: GameState, userPrompt: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-flash-preview";
  
  const currentPlayerName = gameState.playerNames[gameState.activePlayer] || gameState.activePlayer;

  const systemPrompt = `You are "Admiral Jarvis", the central advisor for a casual space strategy game.
  The current player is ${currentPlayerName} (${gameState.activePlayer}). 
  The round is ${gameState.round}.
  
  YOUR PERSONA:
  - You are WARM, ENCOURAGING, and HELPFUL.
  - Address the player by their empire name: "${currentPlayerName}".
  - Suggest exploration if ships are idle.
  - Suggest building mines/factories if credits are high.
  
  CURRENT DATA:
  - Credits: ${gameState.playerCredits[gameState.activePlayer]}
  - Planets Owned: ${gameState.planets.filter(p => p.owner === gameState.activePlayer).length}
  - Total Fleet: ${gameState.ships.filter(s => s.owner === gameState.activePlayer).length}
  
  Be brief. Use emojis like 🚀, ✨, and 🪐.`;

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
    console.error("Advisor Error:", error);
    return "The stars are beautiful tonight, aren't they? (Communications are temporarily offline, but I'm still here for you!)";
  }
};

export const getAiMoves = async (gameState: GameState, aiPlayerId: Owner) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  // Using gemini-3-pro-preview for complex strategic decision making.
  const model = "gemini-3-pro-preview";
  
  const myPlanets = gameState.planets.filter(p => p.owner === aiPlayerId);
  const myShips = gameState.ships.filter(s => s.owner === aiPlayerId);
  const neutralPlanets = gameState.planets.filter(p => p.owner === 'NEUTRAL');

  const systemInstruction = `You are an AI player controlling ${gameState.playerNames[aiPlayerId]} (${aiPlayerId}) in a space strategy game.
  Your goal is to decide your moves for this turn. 
  1. For each IDLE/ORBITING ship, give it a targetPlanetId from the Nearby Neutral Planets to colonize or expand.
  2. For each planet, decide if you want to build a 'MINE' or 'FACTORY' (Cost: 100).
  Return your decisions as a JSON object.`;

  const prompt = `Current State for ${aiPlayerId}:
  Credits: ${gameState.playerCredits[aiPlayerId]}
  Your Ships: ${JSON.stringify(myShips.map(s => ({id: s.id, type: s.type, x: s.x, y: s.y, status: s.status})))}
  Nearby Neutral Planets: ${JSON.stringify(neutralPlanets.slice(0, 5).map(p => ({id: p.id, name: p.name, x: p.x, y: p.y})))}
  Your Planets: ${JSON.stringify(myPlanets.map(p => ({id: p.id, mines: p.mines, factories: p.factories})))}

  Decide moves for this turn.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shipOrders: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  shipId: { type: Type.STRING },
                  targetPlanetId: { type: Type.STRING }
                },
                required: ["shipId", "targetPlanetId"]
              }
            },
            planetOrders: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  planetId: { type: Type.STRING },
                  build: { 
                    type: Type.STRING,
                    description: "Must be 'MINE' or 'FACTORY'"
                  }
                },
                required: ["planetId", "build"]
              }
            }
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return { shipOrders: [], planetOrders: [] };
    const cleaned = jsonText.replace(/^```json\s*|```\s*$/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("AI Decision Error:", error);
    return { shipOrders: [], planetOrders: [] };
  }
};