const CACHE = new Map<string, HTMLAudioElement>();

function get(name: string) {
  if (typeof window === "undefined") return null;
  let a = CACHE.get(name);
  if (!a) {
    a = new Audio(`/games/quilt/audio/${name}.mp3`);
    a.preload = "auto";
    CACHE.set(name, a);
  }
  return a;
}

export function playSfx(name: string, volume = 0.55) {
  const a = get(name);
  if (!a) return;
  try {
    a.pause();
    a.currentTime = 0;
    a.volume = volume;
    void a.play();
  } catch {
    /* autoplay policies */
  }
}

let loop: HTMLAudioElement | null = null;

export function startLoop() {
  if (typeof window === "undefined") return;
  if (!loop) {
    loop = new Audio("/games/quilt/audio/loop.mp3");
    loop.loop = true;
    loop.volume = 0.18;
  }
  void loop.play().catch(() => undefined);
}

export function stopLoop() {
  loop?.pause();
}
