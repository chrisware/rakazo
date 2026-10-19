/** Text for a manual Speak tap. A failed lookup keeps the on-screen reply. */
export async function textForManualSpeech(input: {
  fallback: string;
  lookup: () => Promise<{ text: string; hostSpoken: boolean }>;
}): Promise<string> {
  try {
    const spoken = await input.lookup();
    if (spoken.hostSpoken) return "";
    return spoken.text;
  } catch {
    return input.fallback;
  }
}
