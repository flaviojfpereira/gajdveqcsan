import React, { useState, useRef } from 'react';
import { Crown, LogOut, User as UserIcon, Share2, Check, Sparkles, Camera, Image as ImageIcon } from 'lucide-react';
import type { User } from '../types.js';

interface HeaderBannerProps {
  currentUser: User | null;
  onLogout: () => void;
  onOpenLogin: () => void;
  totalVotersCount: number;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  currentUser,
  onLogout,
  onOpenLogin,
  totalVotersCount
}) => {
  const [copied, setCopied] = useState(false);
  const [bannerSrc, setBannerSrc] = useState('/banner.jpg');
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleShare = async () => {
    const text = `🔫 GAJDVEQCSAN - Reunião 5v5 de CS à Noite! Malta, entrem e votem em quando podem para fecharmos os 10 jogadores: ${window.location.href}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant preview
    const localUrl = URL.createObjectURL(file);
    setBannerSrc(localUrl);

    // Save to server
    try {
      setUploadMessage('A guardar imagem...');
      const res = await fetch('/api/banner/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file
      });
      if (res.ok) {
        setUploadMessage('✅ Foto original guardada no servidor!');
        setTimeout(() => setUploadMessage(null), 4000);
      } else {
        setUploadMessage('⚠️ Imagem carregada nesta sessão.');
        setTimeout(() => setUploadMessage(null), 3000);
      }
    } catch (err) {
      console.error('Banner upload error:', err);
      setUploadMessage('⚠️ Imagem carregada nesta sessão.');
      setTimeout(() => setUploadMessage(null), 3000);
    }
  };

  return (
    <header className="relative w-full overflow-hidden bg-slate-950 border-b-4 border-amber-500/80 shadow-2xl">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleBannerUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Top Banner Image with responsive overlay */}
      <div className="relative w-full max-h-[380px] h-[42vw] min-h-[220px] overflow-hidden bg-slate-900">
        <img
          src={bannerSrc}
          alt="GAJDVEQCSAN - Grupo de amigos que joga CS à noite"
          className="w-full h-full object-cover object-center"
          referrerPolicy="no-referrer"
        />
        {/* Subtle gradient overlay to make controls legible */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/20 pointer-events-none" />

        {/* Upload feedback badge */}
        {uploadMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-emerald-600 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-2xl shadow-2xl border-2 border-emerald-400 animate-fade-in">
            {uploadMessage}
          </div>
        )}

        {/* Top Floating Actions */}
        <div className="absolute top-4 right-4 left-4 flex justify-between items-center z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border-2 border-amber-400 text-amber-300 text-xs sm:text-sm font-bold shadow-lg backdrop-blur-md">
            <Crown className="w-4 h-4 text-amber-400 animate-pulse" />
            <span className="tracking-wide uppercase font-gaming">5v5 Reunion • CS à Noite</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="cartoon-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-amber-500 text-amber-300 hover:text-slate-950 text-xs sm:text-sm font-bold border-2 border-amber-400/80 shadow-md cursor-pointer transition-all"
              title="Carregar a tua imagem original para o banner"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden sm:inline">Colocar Foto Original</span>
              <span className="sm:hidden">Mudar Banner</span>
            </button>

            <button
              id="share-whatsapp-btn"
              onClick={handleShare}
              className="cartoon-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-md cursor-pointer transition-colors"
              title="Partilhar link no WhatsApp"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>Copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Partilhar Link</span>
                  <span className="sm:hidden">Partilhar</span>
                </>
              )}
            </button>

            {currentUser ? (
              <div className="flex items-center gap-2 bg-slate-900/90 border-2 border-slate-700 rounded-xl px-3 py-1.5 shadow-md backdrop-blur-md">
                <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-slate-950 font-black text-xs">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs sm:text-sm font-bold text-slate-200 max-w-[100px] sm:max-w-[140px] truncate">
                  {currentUser.name}
                </span>
                <button
                  id="logout-btn"
                  onClick={onLogout}
                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                  title="Mudar de jogador / Sair"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="header-login-btn"
                onClick={onOpenLogin}
                className="cartoon-btn inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-black shadow-md cursor-pointer"
              >
                <UserIcon className="w-4 h-4" />
                <span>Entrar / Votar</span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom Banner Title Callout */}
        <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 pointer-events-none">
          <div>
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-widest drop-shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Recordar as noitadas de CS</span>
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] font-gaming uppercase">
              GAJDVEQCSAN
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-slate-200 font-semibold drop-shadow-md">
              Grupo de amigos que joga CS à noite • Votação de disponibilidade 5v5
            </p>
          </div>

          <div className="pointer-events-auto self-start sm:self-auto bg-slate-950/90 border-2 border-slate-700/80 rounded-xl px-3 py-2 text-xs backdrop-blur-md flex items-center gap-3">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Amigos a Votar</span>
              <span className="text-amber-400 font-bold text-sm font-gaming">
                {totalVotersCount} jogadores ativos
              </span>
            </div>
            <div className="w-[1px] h-6 bg-slate-700" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Objetivo</span>
              <span className="text-emerald-400 font-bold text-sm font-gaming">10 jogadores (5v5)</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
