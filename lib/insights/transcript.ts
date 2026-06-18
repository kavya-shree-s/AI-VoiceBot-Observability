const LINE = /^(\w+):\s?(.*)$/;

export function countTurns(transcription: string): number {
  if (!transcription.trim()) return 0;
  return transcription.split("\n").filter((l) => LINE.test(l.trim())).length;
}

export function lastUserTurn(transcription: string): string {
  const lines = transcription.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].trim().match(LINE);
    if (m && m[1] === "user") return m[2];
  }
  return "";
}
