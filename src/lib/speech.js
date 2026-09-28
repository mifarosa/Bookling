export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Speaks text using the best matching installed voice for the language code. */
export function speak(text, code) {
  if (!canSpeak() || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (code) {
    u.lang = code;
    const voice = synth
      .getVoices()
      .find((v) => v.lang?.toLowerCase().startsWith(code.toLowerCase()));
    if (voice) u.voice = voice;
  }
  synth.speak(u);
}
