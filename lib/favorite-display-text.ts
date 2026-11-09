/** Display only: never change the saved transcript or the input sent to TTS. */
export function favoriteDisplayText(text: string): string {
  return text
    .replace(/<#\s*[^<>\r\n]+?\s*#>|&lt;#\s*[^<>\r\n]+?\s*#&gt;/gi, "")
    .replace(/[（(]\s*(?:breath|breaths|breathing|laugh|laughs|laughing|chuckle|chuckles|chuckling|sigh|sighs|sighing|cough|coughs|coughing|sniff|sniffs|sniffing|sob|sobs|sobbing|crying|gasp|gasps|gasping|groan|groans|yawn|yawns|yawning|clears? throat|throat clearing|lip[- ]smacking)\s*[）)]/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
