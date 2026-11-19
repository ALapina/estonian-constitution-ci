// Own audio player (DESIGN.md 6, 7.5 phase 1): play/pause, 5-second skips, a seek bar and a
// YouTube-style speed menu. The speed is shared by every player and saved in the browser.
// Only one player on the page plays at a time.
import { useEffect, useRef, useState } from 'preact/hooks';
import { loadState, setSpeed, SPEEDS, subscribe } from '../lib/state';

interface Props {
  src: string;
  /** Accessible name, for example "Аудио истории". */
  label: string;
}

const PLAY_EVENT = 'player-play';
const SKIP = 5;

const clock = (s: number) => {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
const speedLabel = (s: number) => (s === 1 ? 'Обычная' : `${String(s).replace('.', ',')}×`);

export default function Player({ src, label }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeedState] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);

  // Loading a file resets playbackRate to defaultPlaybackRate, so both are set (DESIGN.md 6).
  const applySpeed = (s: number) => {
    setSpeedState(s);
    if (audio.current) {
      audio.current.defaultPlaybackRate = s;
      audio.current.playbackRate = s;
    }
  };

  useEffect(() => {
    // Metadata may load before hydration, so its event is missed: read what is already there.
    const a = audio.current;
    if (a && Number.isFinite(a.duration)) setDuration(a.duration);
    applySpeed(loadState().speed ?? 1);
    const unsub = subscribe((st) => applySpeed(st.speed ?? 1));
    const onOtherPlay = (e: Event) => {
      if ((e as CustomEvent).detail !== audio.current) audio.current?.pause();
    };
    window.addEventListener(PLAY_EVENT, onOtherPlay);
    return () => {
      unsub();
      window.removeEventListener(PLAY_EVENT, onOtherPlay);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node))
        setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };
  const skip = (delta: number) => {
    const a = audio.current;
    if (a) a.currentTime = Math.min(Math.max(0, a.currentTime + delta), a.duration || 0);
  };
  const pick = (s: number) => {
    applySpeed(s);
    setSpeed(s);
    setMenuOpen(false);
  };

  return (
    <div class="ap" role="group" aria-label={label}>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onPlay={(e) => {
          setPlaying(true);
          window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: e.currentTarget }));
        }}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          applySpeed(speed);
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
      />
      <button type="button" class="ap-btn ap-play" onClick={toggle} aria-label={playing ? 'Пауза' : 'Слушать'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <button type="button" class="ap-btn" onClick={() => skip(-SKIP)} aria-label={`Назад на ${SKIP} секунд`}>
        −{SKIP}
      </button>
      <button type="button" class="ap-btn" onClick={() => skip(SKIP)} aria-label={`Вперёд на ${SKIP} секунд`}>
        +{SKIP}
      </button>
      <span class="ap-time">{clock(time)}</span>
      <input
        class="ap-seek"
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={time}
        aria-label="Позиция"
        onInput={(e) => {
          const a = audio.current;
          if (a) a.currentTime = Number(e.currentTarget.value);
        }}
      />
      <span class="ap-time">{clock(duration)}</span>
      <div class="ap-speed" ref={menuRef}>
        <button
          type="button"
          class="ap-btn ap-speed-btn"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={`Скорость: ${speedLabel(speed)}`}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {String(speed).replace('.', ',')}×
        </button>
        {menuOpen && (
          <ul class="ap-menu" role="menu" aria-label="Скорость">
            {SPEEDS.map((s) => (
              <li role="none">
                <button type="button" role="menuitemradio" aria-checked={s === speed} onClick={() => pick(s)}>
                  {speedLabel(s)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
