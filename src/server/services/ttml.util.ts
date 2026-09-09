/**
 * TTML (Timed Text Markup Language) & Apple Music Lyrics Converter & Parser
 */

export function formatTtmlTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

export function parseTtmlTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  // Format can be "00:01:23.456", "01:23.456", or seconds "83.456" / "83.456s"
  const clean = timeStr.trim().replace('s', '');
  if (!clean.includes(':')) {
    return parseFloat(clean) || 0;
  }

  const parts = clean.split(':');
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseFloat(parts[2]);
    return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseFloat(parts[1]);
    return m * 60 + s;
  }
  return 0;
}

/**
 * Convert standard or enhanced LRC text into Apple Music / TTML compliant XML
 */
export function lrcToTtml(lrcText: string, title: string = 'Untitled', artist: string = 'Unknown Artist', durationSecs: number = 200): string {
  if (!lrcText) return '';

  const lines = lrcText.split('\n');
  const parsedLines: Array<{ begin: number; end: number; text: string; words?: Array<{ begin: number; end: number; word: string }> }> = [];

  const timeReg = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    timeReg.lastIndex = 0;
    const match = timeReg.exec(raw);
    if (match) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const ms = match[3] ? (match[3].length === 2 ? parseInt(match[3], 10) * 10 : parseInt(match[3], 10)) : 0;
      const beginSecs = mins * 60 + secs + ms / 1000;
      const cleanText = raw.replace(timeReg, '').trim();

      parsedLines.push({
        begin: beginSecs,
        end: beginSecs + 3.5, // Default line duration fallback
        text: cleanText,
      });
    }
  }

  // Adjust line end times to next line's begin time
  for (let i = 0; i < parsedLines.length; i++) {
    if (i < parsedLines.length - 1) {
      parsedLines[i].end = parsedLines[i + 1].begin;
    } else {
      parsedLines[i].end = Math.max(parsedLines[i].begin + 3.0, durationSecs);
    }

    // Generate word-by-word syllable timing estimation for am-lyrics interpolation
    const words = parsedLines[i].text.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const lineDuration = Math.max(0.5, parsedLines[i].end - parsedLines[i].begin);
      const perWordDur = lineDuration / words.length;
      parsedLines[i].words = words.map((w, wIdx) => {
        const wBegin = parsedLines[i].begin + wIdx * perWordDur;
        const wEnd = parsedLines[i].begin + (wIdx + 1) * perWordDur;
        return {
          begin: wBegin,
          end: wEnd,
          word: w,
        };
      });
    }
  }

  const durationFormatted = formatTtmlTime(durationSecs);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-extensions">
  <head>
    <metadata>
      <ttm:title>${escapeXml(title)}</ttm:title>
      <ttm:agent type="person" xml:id="v1">${escapeXml(artist)}</ttm:agent>
    </metadata>
  </head>
  <body dur="${durationFormatted}">
    <div>
`;

  for (const line of parsedLines) {
    const beginStr = formatTtmlTime(line.begin);
    const endStr = formatTtmlTime(line.end);
    xml += `      <p begin="${beginStr}" end="${endStr}" ttm:agent="v1">\n`;
    if (line.words && line.words.length > 0) {
      for (const w of line.words) {
        xml += `        <span begin="${formatTtmlTime(w.begin)}" end="${formatTtmlTime(w.end)}">${escapeXml(w.word)} </span>\n`;
      }
    } else {
      xml += `        <span>${escapeXml(line.text)}</span>\n`;
    }
    xml += `      </p>\n`;
  }

  xml += `    </div>
  </body>
</tt>`;

  return xml;
}

/**
 * Convert TTML XML into standard LRC formatted string
 */
export function ttmlToLrc(ttmlXml: string): string {
  if (!ttmlXml) return '';

  const pRegex = /<p\s+[^>]*begin="([^"]+)"[^>]*>([\s\S]*?)<\/p>/gi;
  const spanRegex = /<span(?:\s+[^>]*begin="([^"]+)")?[^>]*>([\s\S]*?)<\/span>/gi;
  const tagStrip = /<[^>]+>/g;

  let match;
  const lrcLines: Array<{ time: number; formatted: string; text: string }> = [];

  while ((match = pRegex.exec(ttmlXml)) !== null) {
    const beginStr = match[1];
    const inner = match[2];
    const timeSecs = parseTtmlTimeToSeconds(beginStr);
    const m = Math.floor(timeSecs / 60);
    const s = Math.floor(timeSecs % 60);
    const cs = Math.floor((timeSecs % 1) * 100);
    const timeCode = `[${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}]`;

    const text = inner.replace(tagStrip, '').replace(/\s+/g, ' ').trim();
    if (text) {
      lrcLines.push({ time: timeSecs, formatted: timeCode, text });
    }
  }

  lrcLines.sort((a, b) => a.time - b.time);
  return lrcLines.map((l) => `${l.formatted} ${l.text}`).join('\n');
}

function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
