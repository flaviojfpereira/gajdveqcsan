import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, Disc, Upload, RefreshCw } from 'lucide-react';
import { AudioUploadModal } from './AudioUploadModal.js';

interface AudioPlayerProps {
  songTitle?: string;
  artist?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  songTitle: initialSongTitle = 'Para os Meus Ninjas',
  artist = 'GAJDVEQCSAN Theme'
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.6);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [audioSrc, setAudioSrc] = useState('/api/audio/track');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [currentSongTitle, setCurrentSongTitle] = useState(initialSongTitle);
  const [hasAudioError, setHasAudioError] = useState(false);

  // Initialize and check audio version from server
  useEffect(() => {
    const checkAudioInfo = async () => {
      try {
        const res = await fetch('/api/audio/info');
        if (res.ok) {
          const data = await res.json();
          if (data.exists && data.mtime) {
            setAudioSrc(`/api/audio/track?t=${data.mtime}`);
          }
        }
      } catch (e) {
        console.error('Failed to query audio info:', e);
      }
    };
    checkAudioInfo();

    const savedTitle = localStorage.getItem('gajdveqcsan_song_title');
    if (savedTitle) {
      setCurrentSongTitle(savedTitle);
    }
  }, []);

  // Handle Playback Setup & Autoplay
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;
    audio.loop = true;

    // Reset error
    setHasAudioError(false);

    // Attempt autoplay
    const promise = audio.play();
    if (promise !== undefined) {
      promise
        .then(() => {
          setIsPlaying(true);
          setNeedsUserGesture(false);
        })
        .catch(() => {
          // Autoplay blocked by browser security
          setNeedsUserGesture(true);
          setIsPlaying(false);

          // Trigger on first user interaction anywhere
          const onFirstInteraction = () => {
            if (audioRef.current) {
              audioRef.current.play()
                .then(() => {
                  setIsPlaying(true);
                  setNeedsUserGesture(false);
                })
                .catch(() => {});
            }
            window.removeEventListener('click', onFirstInteraction);
            window.removeEventListener('keydown', onFirstInteraction);
            window.removeEventListener('touchstart', onFirstInteraction);
          };

          window.addEventListener('click', onFirstInteraction, { once: true });
          window.addEventListener('keydown', onFirstInteraction, { once: true });
          window.addEventListener('touchstart', onFirstInteraction, { once: true });
        });
    }
  }, [audioSrc]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
        setNeedsUserGesture(false);
      }).catch(err => {
        console.error('Audio play error:', err);
      });
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val === 0) {
        setIsMuted(true);
      } else if (isMuted) {
        setIsMuted(false);
        audioRef.current.muted = false;
      }
    }
  };

  const handleAudioUpdated = (newUrl: string, songName?: string) => {
    setAudioSrc(newUrl);
    if (songName) {
      setCurrentSongTitle(songName);
      localStorage.setItem('gajdveqcsan_song_title', songName);
    }
    setHasAudioError(false);
    setIsPlaying(true);
  };

  return (
    <>
      <audio
        ref={audioRef}
        src={audioSrc}
        preload="auto"
        loop
        onError={() => {
          console.warn('Audio failed to load from:', audioSrc);
          setHasAudioError(true);
        }}
      />

      {/* Floating Mini Player */}
      <div 
        id="ninja-audio-player"
        className={`fixed bottom-4 right-4 z-40 transition-all duration-300 select-none ${
          isMinimized ? 'translate-y-1' : ''
        }`}
      >
        <div className="relative group flex items-center gap-2.5 bg-slate-900/95 border-2 border-amber-400/90 hover:border-amber-400 rounded-2xl p-2 sm:p-2.5 shadow-2xl backdrop-blur-md text-slate-100 cartoon-card-gold">
          
          {/* Animated Disc / Vinyl Icon */}
          <button
            onClick={togglePlay}
            className="relative w-9 h-9 rounded-full bg-slate-950 border border-amber-400 flex items-center justify-center text-amber-400 hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-md flex-shrink-0"
            title={isPlaying ? 'Pausar música' : 'Tocar música'}
          >
            <Disc className={`w-5 h-5 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            {/* Play/Pause Overlay indicator */}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              {isPlaying ? <Pause className="w-3.5 h-3.5 text-white" /> : <Play className="w-3.5 h-3.5 text-amber-400 ml-0.5" />}
            </span>
          </button>

          {/* Song Info & Visualizer */}
          <div className="flex flex-col min-w-0 pr-1 max-w-[150px] sm:max-w-[190px]">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black font-gaming text-amber-400 truncate tracking-wide">
                {currentSongTitle}
              </span>
            </div>
            
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-slate-400 truncate font-semibold">
                {artist}
              </span>

              {/* Equalizer Wave Bars */}
              <div className="flex items-end gap-0.5 h-3.5 flex-shrink-0">
                <span className={`w-1 bg-amber-400 rounded-full transition-all duration-150 ${isPlaying ? 'h-3 animate-pulse' : 'h-1'}`} />
                <span className={`w-1 bg-amber-500 rounded-full transition-all duration-150 ${isPlaying ? 'h-3.5 animate-bounce' : 'h-1'}`} style={{ animationDelay: '100ms' }} />
                <span className={`w-1 bg-emerald-400 rounded-full transition-all duration-150 ${isPlaying ? 'h-2 animate-pulse' : 'h-1'}`} style={{ animationDelay: '200ms' }} />
                <span className={`w-1 bg-amber-400 rounded-full transition-all duration-150 ${isPlaying ? 'h-3 animate-bounce' : 'h-1'}`} style={{ animationDelay: '150ms' }} />
              </div>
            </div>
          </div>

          {/* Controls: Play/Pause, Mute, Volume, Upload */}
          <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
            <button
              onClick={togglePlay}
              className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-white transition-colors cursor-pointer"
              title={isPlaying ? 'Pausa' : 'Tocar'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={toggleMute}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
              title={isMuted ? 'Ativar som' : 'Silenciar'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Subtle Volume Slider on desktop */}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-12 h-1 accent-amber-400 bg-slate-800 rounded-lg cursor-pointer hidden sm:block"
              title={`Volume: ${Math.round(volume * 100)}%`}
            />

            {/* Upload Modal Trigger button */}
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold transition-all cursor-pointer flex items-center gap-1 text-[10px]"
              title="Carregar ou substituir o ficheiro de áudio MP3 no servidor"
            >
              <Upload className="w-3 h-3" />
              <span className="hidden sm:inline">Mudar MP3</span>
            </button>
          </div>

          {/* Autoplay prompt toast if browser blocked autoplay */}
          {needsUserGesture && (
            <div 
              onClick={togglePlay}
              className="absolute -top-10 right-0 bg-amber-500 text-slate-950 text-[11px] font-black px-2.5 py-1 rounded-xl shadow-lg border-2 border-slate-950 animate-bounce cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            >
              <Music className="w-3.5 h-3.5" />
              <span>Clica aqui para ouvir o hino! 🎧</span>
            </div>
          )}

          {/* Audio Error prompt */}
          {hasAudioError && (
            <div 
              onClick={() => setIsUploadModalOpen(true)}
              className="absolute -top-10 right-0 bg-rose-600 text-white text-[11px] font-black px-2.5 py-1 rounded-xl shadow-lg border-2 border-slate-950 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            >
              <span>Carregar novo MP3</span>
            </div>
          )}
        </div>
      </div>

      {/* Upload Audio Modal */}
      <AudioUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onAudioUpdated={handleAudioUpdated}
      />
    </>
  );
};
