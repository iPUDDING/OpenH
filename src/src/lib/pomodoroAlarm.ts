export type CompletedPomodoroMode = 'work' | 'break';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextConstructor();
  return audioContext;
}

/** Debe llamarse desde un gesto del usuario para que WebView2 permita la alarma posterior. */
export async function primePomodoroAlarm(): Promise<void> {
  try {
    const context = getAudioContext();
    if (context?.state === 'suspended') await context.resume();
  } catch {
    // El temporizador sigue funcionando aunque el dispositivo no tenga audio.
  }
}

/** Melodía breve, local y sin archivos de red: se distingue enfoque de descanso. */
export async function playPomodoroAlarm(completedMode: CompletedPomodoroMode): Promise<void> {
  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === 'suspended') await context.resume();
    if (context.state !== 'running') return;

    const frequencies = completedMode === 'work' ? [880, 660, 880] : [523.25, 659.25, 523.25];
    const startAt = context.currentTime + 0.03;
    frequencies.forEach((frequency, index) => {
      const start = startAt + index * 0.24;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.24, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.21);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  } catch {
    // Nunca interrumpir el cambio de sesión por permisos o errores de audio.
  }
}
