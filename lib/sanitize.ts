export function sanitizeFilenamePart(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

export function buildAudioFilename(opts: {
  mobile: string;
  name: string;
  callId: string;
}): string {
  const mobile = sanitizeFilenamePart(opts.mobile) || "unknown";
  const name = sanitizeFilenamePart(opts.name) || "unknown";
  const callId = sanitizeFilenamePart(opts.callId);
  return `${mobile}_${name}_${callId}.mp3`;
}
