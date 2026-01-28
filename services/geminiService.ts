
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
  const model = "gemini-3-pro-preview";
  
  const myPlanets = gameState.planets.filter(p => p.owner === aiPlayerId);
  const myShips = gameState.ships.filter(s => s.owner === aiPlayerId);
  const otherPlanets = gameState.planets.filter(p => p.owner !== aiPlayerId);
  const neutralPlanets = gameState.planets.filter(p => p.owner === 'NEUTRAL');
  const enemyPlanets = gameState.planets.filter(p => p.owner !== 'NEUTRAL' && p.owner !== aiPlayerId);

  let tacticalInstruction = "";
  if (gameState.aiDifficulty === 'EASY') {
    tacticalInstruction = `
      - Play PASSIVELY and CAUTIOUSLY.
      - Focus on colonizing Neutral planets only. 
      - Avoid attacking other players or entering their territory.
      - Prioritize 'MINE' construction for economy over 'FACTORY' construction for war.
      - If you have many ships, keep some IDLE to be less threatening.`;
  } else {
    tacticalInstruction = `
      - Play AGGRESSIVELY and STRATEGICALLY.
      - Actively target planets owned by rival players, especially those with low defense or low population.
      - Prioritize building 'FACTORY' to increase warship production if credits are available.
      - Coordinate attacks: send Warships to bombard enemy populations and Freighters to drop off colonists after the population hits zero.
      - Seek to dominate the entire map.`;
  }

  const systemInstruction = `You are an AI player controlling ${gameState.playerNames[aiPlayerId]} (${aiPlayerId}) in a space strategy game.
  Your goal is to decide your moves for this turn. 
  Difficulty Level: ${gameState.aiDifficulty}.
  
  TACTICAL DOCTRINE:${tacticalInstruction}

  1. For each ship, decide its targetPlanetId. 
     - SCOUTS should explore Neutral space.
     - WARSHIPS should defend or attack according to difficulty.
     - FREIGHTERS should transport people (cargoPeople) to colonize or reinforce.
  2. For each owned planet, decide construction: 'MINE' (income) or 'FACTORY' (construction power). Cost is 100 each.
  
  Return your decisions as a JSON object.`;

  const prompt = `Current State for ${aiPlayerId}:
  Credits: ${gameState.playerCredits[aiPlayerId]}
  Your Ships: ${JSON.stringify(myShips.map(s => ({id: s.id, type: s.type, x: s.x, y: s.y, status: s.status, cargoPeople: s.cargoPeople})))}
  Nearby Neutral Planets: ${JSON.stringify(neutralPlanets.slice(0, 5).map(p => ({id: p.id, name: p.name, x: p.x, y: p.y})))}
  Nearby Enemy Planets: ${JSON.stringify(enemyPlanets.slice(0, 5).map(p => ({id: p.id, name: p.name, owner: p.owner, pop: p.population, def: p.defense})))}
  Your Planets: ${JSON.stringify(myPlanets.map(p => ({id: p.id, mines: p.mines, factories: p.factories, pop: p.population})))}

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

    const jsonStr = response.text?.trim();
    if (!jsonStr) return { shipOrders: [], planetOrders: [] };
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("AI Decision Error:", error);
    return { shipOrders: [], planetOrders: [] };
  }
};
