import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GameState, Planet, Ship, Owner, ShipType, AiDifficulty } from './types';
import { generateInitialState, SHIP_SPEEDS, PLAYER_COLORS, SHIP_COSTS, SHIP_STATS, MAX_PLANET_POPULATION, MAX_FACTORIES, MAX_MINES } from './gameLogic';
import MapView from './components/MapView';
import AdvisorPanel from './components/AdvisorPanel';
import HelpModal from './components/HelpModal';
import NewGameModal from './components/NewGameModal';
import InviteModal from './components/InviteModal';
import LobbyModal from './components/LobbyModal';
import { getAiMoves } from './services/geminiService';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update, push, onDisconnect, get, Database } from 'firebase/database';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  databaseURL: "https://stellar-commander-default-rtdb.firebaseio.com",
};

// Initialize Firebase App and Database service safely
let db: Database | null = null;
const isConfigSet = firebaseConfig.databaseURL && !firebaseConfig.databaseURL.includes("default-rtdb");

try {
    const firebaseApp: FirebaseApp = getApps().length === 0 
        ? initializeApp(firebaseConfig) 
        : getApp();
        
    db = getDatabase(firebaseApp);
    console.log("Stellar Command Relay Link Established.");
} catch (e) {
    console.error("Firebase Initialization Failed:", e);
}

const App: React.FC = () => {
  const [hasInitiated, setHasInitiated] = useState(false);
  const [viewMode, setViewMode] = useState<'PLAYER' | 'HOST'>('PLAYER');
  const [playerRole, setPlayerRole] = useState<Owner | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);

  const [gameState, setGameState] = useState<GameState>(() => generateInitialState(2, 0));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'PLANET' | 'SHIP' | null>(null);
  const [isAdvisorOpen, setIsAdvisorOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isLobbyOpen, setIsLobbyOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 overflow-hidden font-mono selection:bg-cyan-500/30">
      {/* Header */}
      <header className="h-12 border-b border-cyan-900/50 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h1 className="text-sm font-black tracking-tighter text-cyan-400 uppercase italic">Stellar</h1>
            <span className="text-[8px] leading-none text-cyan-700 font-bold tracking-[0.2em] -mt-1">Cloud Command Interface</span>
          </div>
        </div>
      </header>

      <main className="flex-1 relative">
        <MapView planets={gameState.planets} ships={gameState.ships} />
        
        {!db || !isConfigSet ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-[100]">
             <div className="bg-slate-900 border border-red-900/50 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
                <div className="text-red-500 font-bold mb-4 tracking-widest text-sm uppercase">Relay Offline: Check Configuration in App.tsx</div>
                <button className="w-full bg-slate-800 text-slate-500 py-3 rounded-lg font-bold uppercase tracking-widest text-xs mb-2 cursor-not-allowed">Create New Galaxy</button>
                <button className="w-full bg-slate-800 text-slate-500 py-3 rounded-lg font-bold uppercase tracking-widest text-xs cursor-not-allowed">Find Active Galaxy</button>
             </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center z-[100]">
             <div className="bg-slate-900 border border-cyan-900/30 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center backdrop-blur-md">
                <div className="mb-8">
                  <h2 className="text-4xl font-black italic tracking-tighter text-white mb-1">STELLAR</h2>
                  <div className="text-[10px] text-cyan-500 font-bold tracking-[0.3em] uppercase">Cloud Command Interface</div>
                </div>
                <div className="space-y-3">
                  <button onClick={() => setIsNewGameModalOpen(true)} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]">Create New Galaxy</button>
                  <button onClick={() => setIsLobbyOpen(true)} className="w-full bg-slate-800 hover:bg-slate-700 text-cyan-400 py-4 rounded-xl font-black uppercase tracking-widest text-sm border border-cyan-900/30 transition-all">Find Active Galaxy</button>
                </div>
                <div className="mt-8 text-[9px] text-slate-500 font-bold uppercase tracking-widest opacity-50">Connected to Firebase Relay // Sector 0-1</div>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default