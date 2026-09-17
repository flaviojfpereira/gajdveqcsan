import React, { useState } from 'react';
import { User, ShieldCheck, X, Gamepad2, ArrowRight } from 'lucide-react';
import type { User as UserType } from '../types.js';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (name: string, password?: string) => Promise<boolean>;
  existingUsers?: UserType[];
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin
}) => {
  const [nameInput, setNameInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setErrorMsg('Por favor introduz o teu nome ou nickname.');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);
    // Login by name
    const success = await onLogin(nameInput.trim(), nameInput.trim());
    setIsLoading(false);
    if (success) {
      onClose();
    } else {
      setErrorMsg('Erro ao entrar. Tenta novamente.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border-4 border-amber-500 rounded-2xl shadow-2xl p-6 cartoon-card-gold text-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400">
            <Gamepad2 className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-black font-gaming tracking-wide uppercase text-amber-400">
              Identifica-te, Menino!
            </h2>
            <p className="text-xs text-slate-300">
              Escreve o teu nome para marcares a tua disponibilidade
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1">
              O teu Nome / Nickname:
            </label>
            <div className="relative">
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Escreve o teu nome..."
                maxLength={25}
                className="w-full px-3.5 py-2.5 bg-slate-950 border-2 border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-semibold"
                autoFocus
              />
              <User className="absolute right-3.5 top-3 w-4 h-4 text-slate-500" />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-300">Como funciona o acesso:</strong> A tua password é o mesmo nome. Ao entrares pela primeira vez, o teu perfil é criado e todos os teus votos ficam gravados!
            </span>
          </div>

          {errorMsg && (
            <p className="text-xs font-bold text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-800">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading || !nameInput.trim()}
            className="cartoon-btn w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-gaming"
          >
            {isLoading ? (
              <span>A verificar...</span>
            ) : (
              <>
                <span>Entrar no Lobby</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
