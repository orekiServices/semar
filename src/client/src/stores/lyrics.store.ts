import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export interface LrcLine {
  timeSeconds: number;
  timeFormatted: string;
  text: string;
}

export const useLyricsStore = defineStore('lyrics', () => {
  const activeSong = ref<any>(null);
  const isPlaying = ref<boolean>(false);
  const currentTime = ref<number>(0);
  const duration = ref<number>(0);
  const playbackSpeed = ref<number>(1);
  const timerId = ref<any>(null);

  const parsedLrc = computed<LrcLine[]>(() => {
    if (!activeSong.value || !activeSong.value.synced_lyrics) return [];
    return parseLrcText(activeSong.value.synced_lyrics);
  });

  const currentLineIndex = computed(() => {
    const lines = parsedLrc.value;
    if (lines.length === 0) return -1;

    let activeIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      if (currentTime.value >= lines[i].timeSeconds) {
        activeIdx = i;
      } else {
        break;
      }
    }
    return activeIdx;
  });

  function parseLrcText(lrc: string): LrcLine[] {
    const lines = lrc.split('\n');
    const result: LrcLine[] = [];
    const timeReg = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      let match;
      timeReg.lastIndex = 0;
      const timestamps: number[] = [];
      let text = line;

      while ((match = timeReg.exec(line)) !== null) {
        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        const ms = match[3] ? (match[3].length === 2 ? parseInt(match[3], 10) * 10 : parseInt(match[3], 10)) : 0;
        const totalSeconds = mins * 60 + secs + ms / 1000;
        timestamps.push(totalSeconds);
      }

      text = line.replace(timeReg, '').trim();

      if (timestamps.length > 0 && text) {
        for (const t of timestamps) {
          result.push({
            timeSeconds: t,
            timeFormatted: formatTime(t),
            text,
          });
        }
      }
    }

    result.sort((a, b) => a.timeSeconds - b.timeSeconds);
    return result;
  }

  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function playSong(song: any) {
    activeSong.value = song;
    duration.value = song.duration || 200;
    currentTime.value = 0;
    startTimer();
  }

  function togglePlay() {
    if (isPlaying.value) {
      pause();
    } else {
      resume();
    }
  }

  function resume() {
    if (!activeSong.value) return;
    startTimer();
  }

  function pause() {
    isPlaying.value = false;
    if (timerId.value) {
      clearInterval(timerId.value);
      timerId.value = null;
    }
  }

  function seek(timeSecs: number) {
    currentTime.value = Math.max(0, Math.min(timeSecs, duration.value || 300));
  }

  function startTimer() {
    pause();
    isPlaying.value = true;
    const intervalMs = 100;

    timerId.value = setInterval(() => {
      currentTime.value += (intervalMs / 1000) * playbackSpeed.value;
      if (duration.value && currentTime.value >= duration.value) {
        pause();
        currentTime.value = 0;
      }
    }, intervalMs);
  }

  return {
    activeSong,
    isPlaying,
    currentTime,
    duration,
    playbackSpeed,
    parsedLrc,
    currentLineIndex,
    playSong,
    togglePlay,
    pause,
    resume,
    seek,
    parseLrcText,
    formatTime,
  };
});
