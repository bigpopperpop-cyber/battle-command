
import React, { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { Owner } from '../types';

interface LobbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  db: any;
  onJoin: (id: string, role: Owner) => void;
}

const LobbyModal: React.FC<LobbyModalProps> = ({ isOpen, onClose, db, onJoin }) => {
  const [games, setGames] = useState<any[]>([]);

  useEffect(() => {
    if (!db || !isOpen) return;
    const lobbyRef = ref(db, 'lobby');
    const unsub = onValue(lobbyRef, (snap) => {
      const val = snap.val();
      if (val) setGames(Object.entries(val).map(([id, g]: any) => ({ id, ...g })));
    });
    return () => unsub();
  }, [db, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/95" onClick={onClose} />
      <div className="relative w-full max-w-md glass-card rounded-[3rem] p-10 shadow-2xl">
        <h2 className="text-3xl font-bold text-white mb-8 italic text-center">ACTIVE SECTORS</h2>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto mb-8 custom-scrollbar">
          {games.length === 0 && <p className="text-center text-slate-500 py-10">No signals detected...</p>}
          {games.map(g => (
            <div key={g.id} className="p-5 bg-slate-900 border border-white/5 rounded-2xl flex justify-between items-center group hover:border-cyan-500/40 transition-all">
              <div>
                <h4 className="font-bold text-white">{g.name}</h4>
                <p className="text-[10px] text-cyan-500 font-black">ID: {g.id} // RND {g.round}</p>
              </div>
              <select 
                onChange={(e) => onJoin(g.id, e.target.value as Owner)}
                className="bg-cyan-600 text-white rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none"
                value=""
              >
                <option value="" disabled>JOIN</option>
                <option value="P2">AS P2</option>
                <option value="P3">AS P3</option>
                <option value="P4">AS P4</option>
              </select>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="w-full text-slate-500 text-[10px] font-black uppercase tracking-widest">Close terminal</button>
      </div>
    </div>
  );
};

export default LobbyModal;
