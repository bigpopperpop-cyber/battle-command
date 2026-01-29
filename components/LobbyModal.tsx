
import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { Owner } from '../types';

interface LobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (id: string, role: Owner) => void;
  db: any;
}

const LobbyModal: React.FC<LobbyModalProps> = ({ isOpen, onClose, onJoin, db }) => {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !db) return;
    const lobbyRef = ref(db, 'lobby');
    const unsubscribe = onValue(lobbyRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const gameList = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          ...val
        }));
        setGames(gameList);
      } else {
        setGames([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Lobby Load Error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isOpen, db]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" onClick={onClose} />
      
      <div className="relative w-full max-w-lg glass-card rounded-[3.5rem] border-white/10 p-10 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-white mb-2 italic tracking-tight">GALAXY BROWSER</h2>
          <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em]">Sub-Ether Relay Active</p>
        </div>

        <div className="space-y-4 max-h-[50vh] overflow-y-auto mb-8 custom-scrollbar px-2">
          {loading ? (
            <div className="py-12 text-center">
              <div className="w-10 h-10 border-2 border-slate-800 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Scanning Sectors...</p>
            </div>
          ) : !db ? (
            <div className="py-12 text-center border-2 border-red-500/20 bg-red-500/5 rounded-[2.5rem]">
              <p className="text-xs text-red-400 font-bold mb-2">Relay Connection Error</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Check Firebase Configuration</p>
            </div>
          ) : games.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-[2.5rem]">
              <p className="text-xs text-slate-500 font-bold mb-2">No active signal detected.</p>
              <p className="text-[10px] text-slate-600 uppercase tracking-widest">Awaiting host initialization.</p>
            </div>
          ) : (
            games.map((g) => (
              <div key={g.id} className="bg-slate-900/60 p-6 rounded-[2rem] border border-white/5 hover:border-cyan-500/30 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="text-white font-bold text-lg leading-none mb-1">{g.name}</h4>
                    <p className="text-[9px] text-cyan-500 font-black uppercase tracking-widest">ID: {g.id}</p>
                  </div>
                  <div className="bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                    <span className="text-[9px] font-black text-cyan-400">RND {g.round}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {Array.from({length: g.maxPlayers}).map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i < g.players ? 'bg-emerald-500' : 'bg-slate-800'}`} />
                    ))}
                    <span className="text-[10px] font-bold text-slate-500 ml-2">{g.players}/{g.maxPlayers} COMMANDERS</span>
                  </div>
                  
                  <select 
                    onChange={(e) => onJoin(g.id, e.target.value as Owner)}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all outline-none"
                    value=""
                  >
                    <option value="" disabled>JOIN</option>
                    {Array.from({length: g.maxPlayers - 1}).map((_, i) => {
                      const pId = `P${i+2}`;
                      return <option key={pId} value={pId}>AS {pId}</option>;
                    })}
                  </select>
                </div>
              </div>
            ))
          )}
        </div>

        <button 
          onClick={onClose}
          className="w-full py-4 text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
        >
          Close Terminal
        </button>
      </div>
    </div>
  );
};

export default LobbyModal;
