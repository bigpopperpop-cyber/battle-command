
import { GoogleGenAI, Type } from "@google/genai";
import { GameState, Owner } from "../types";

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

export const getAiMoves = async (gameState: GameState, aiPlayerId: Owner) => {
  const model = "gemini-3-flash-preview";
  
  const myPlanets = gameState.planets.filter(p => p.owner === aiPlayerId);
  const myShips = gameState.ships.filter(s => s.owner === aiPlayerId);
  const neutralPlanets = gameState.planets.filter(p => p.owner === 'NEUTRAL');
  const enemyPlanets = gameState.planets.filter(p => p.owner !== 'NEUTRAL' && p.owner !== aiPlayerId);

  const prompt = `You are an AI player controlling ${aiPlayerId}.
  Credits: ${gameState.playerCredits[aiPlayerId]}
  Your Ships: ${JSON.stringify(myShips.map(s => ({id: s.id, type: s.type, x: s.x, y: s.y})))}
  Nearby Neutral Planets: ${JSON.stringify(neutralPlanets.slice(0, 10).map(p => ({id: p.id, name: p.name, x: p.x, y: p.y})))}
  Your Planets: ${JSON.stringify(myPlanets.map(p => ({id: p.id, mines: p.mines, factories: p.factories})))}

  Decide your moves for this turn. 
  1. For each IDLE or ORBITING ship, give it a targetPlanetId (prioritize neutral ones).
  2. For each planet, decide if you want to build a 'MINE' or 'FACTORY' (Cost: 100 each). 
  Only build if you have enough credits. Credits: ${gameState.playerCredits[aiPlayerId]}.

  Return the result in JSON format.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
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
                  build: { type: Type.STRING, description: "'MINE' or 'FACTORY'" }
                },
                required: ["planetId", "build"]
              }
            }
          }
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("AI Decision Error:", error);
    return { shipOrders: [], planetOrders: [] };
  }
};
