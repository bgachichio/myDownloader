import express from 'express';
import cors from 'cors';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const app = express();
app.use(cors({ origin: [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  'https://mydownloader-f6a9e.web.app',
  'https://mydownloader.gachichio.org',
] }));
app.use(express.json());

const PORT = 3001;

// yt-dlp accepts arguments that look like URLs. Anything that is not plainly
// http(s) is rejected here rather than argued with downstream.
function isHttpUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── Check yt-dlp is installed ───────────────────────────────────────────────
async function getYtDlpPath() {
  try {
    const { stdout } = await execAsync('which yt-dlp');
    return stdout.trim();
  } catch {
    // Try common locations
    const locations = [
      '/usr/local/bin/yt-dlp',
      '/usr/bin/yt-dlp',
      path.join(os.homedir(), '.local/bin/yt-dlp'),
      path.join(os.homedir(), 'bin/yt-dlp'),
    ];
    for (const loc of locations) {
      if (fs.existsSync(loc)) return loc;
    }
    return null;
  }
}

// ─── Health / yt-dlp check ────────────────────────────────────────────────────
async function hasFfmpeg() {
  try { await execFileAsync('ffmpeg', ['-version']); return true; } catch { return false; }
}

async function hasJsRuntime() {
  for (const bin of ['deno', 'node']) {
    try { await execFileAsync(bin, ['--version']); return bin; } catch { /* try next */ }
  }
  return null;
}

function ytdlpAgeDays(version) {
  const m = /^(\d{4})\.(\d{2})\.(\d{2})/.exec(version.trim());
  if (!m) return null;
  const released = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return Math.floor((Date.now() - released.getTime()) / 86400000);
}

app.get('/api/health', async (req, res) => {
  const ytdlpPath = await getYtDlpPath();
  if (!ytdlpPath) {
    return res.json({
      ok: false,
      message: 'yt-dlp not found. Install it with: pip install yt-dlp',
      ytdlp: false,
    });
  }
  try {
    const { stdout } = await execFileAsync(ytdlpPath, ['--version']);
    const version = stdout.trim();
    const ffmpeg = await hasFfmpeg();
    const jsRuntime = await hasJsRuntime();
    const ageDays = ytdlpAgeDays(version);
    const stale = ageDays !== null && ageDays > 90;

    const problems = [];
    if (!ffmpeg) problems.push('ffmpeg not found - only 360p will have sound.');
    if (!jsRuntime) {
      problems.push(
        'No JS runtime (deno) found - YouTube downloads will likely fail with a ' +
        '403. Install: curl -fsSL https://deno.land/install.sh | sh'
      );
    }
    if (stale) {
      problems.push(
        `yt-dlp is ${ageDays} days old - YouTube changes often enough that this ` +
        'alone can break downloads. Update: pip install -U yt-dlp --break-system-packages'
      );
    }

    res.json({
      ok: ffmpeg && !stale && !!jsRuntime,
      ytdlp: true,
      ffmpeg,
      jsRuntime,
      version,
      ytdlpAgeDays: ageDays,
      message: problems.length ? problems.join(' ') : undefined,
    });
  } catch {
    res.json({ ok: false, ytdlp: false, message: 'yt-dlp found but failed to run.' });
  }
});

// ─── Get video info / available formats ──────────────────────────────────────
app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!isHttpUrl(url)) return res.status(400).json({ error: 'A valid http(s) URL is required' });

  const ytdlpPath = await getYtDlpPath();
  if (!ytdlpPath) {
    return res.status(503).json({
      error: 'yt-dlp is not installed. Run: pip install yt-dlp',
      installRequired: true,
    });
  }

  try {
    const { stdout } = await execFileAsync(
      ytdlpPath,
      ['--dump-json', '--no-playlist', '--', url],
      { timeout: 30000, maxBuffer: 32 * 1024 * 1024 }
    );
    const info = JSON.parse(stdout);

    // Every option below is muxed to video+audio by yt-dlp before it reaches
    // the browser. Audio-only is deliberately not offered.
    const heights = [...new Set(
      (info.formats || [])
        .filter(f => f.vcodec && f.vcodec !== 'none' && f.height)
        .map(f => f.height)
    )].sort((a, b) => b - a).slice(0, 6);

    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      uploader: info.uploader || info.channel,
      platform: info.extractor_key,
      webpage_url: info.webpage_url,
      qualities: heights.map(h => ({
        height: h,
        quality: h >= 2160 ? '4K' : h >= 1440 ? '1440p' : h >= 1080 ? '1080p HD' : `${h}p`,
      })),
    });
  } catch (err) {
    const msg = err.stderr || err.message || 'Failed to fetch video info';
    res.status(400).json({ error: msg.split('\n').slice(-2).join(' ') });
  }
});

// ─── Download ────────────────────────────────────────────────────────────────
app.get('/api/download', async (req, res) => {
  const { url, quality } = req.query;
  if (!isHttpUrl(url)) return res.status(400).json({ error: 'A valid http(s) URL is required' });

  const ytdlpPath = await getYtDlpPath();
  if (!ytdlpPath) {
    return res.status(503).json({ error: 'yt-dlp not installed. Run: pip install yt-dlp' });
  }

  // Build format string
  // Audio-only is not offered. Every format string below pairs a video track
  // with an audio track and yt-dlp muxes them into one MP4 before streaming.
  const cap = /^\d{3,4}$/.test(String(quality)) ? String(quality) : null;
  const fmt = cap
    ? `bestvideo[height<=${cap}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${cap}][ext=mp4]/best[height<=${cap}]`
    : 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
  const formatArgs = ['-f', fmt, '--merge-output-format', 'mp4'];

  // Write to temp file, stream to client
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `myd_${Date.now()}.%(ext)s`);

  const args = [...formatArgs, '-o', tmpFile, '--no-playlist', '--', url];

  try {
    await execFileAsync(ytdlpPath, args, { timeout: 120000, maxBuffer: 32 * 1024 * 1024 });

    // Find the actual output file
    const files = fs.readdirSync(tmpDir).filter(f => f.startsWith('myd_'));
    const latest = files
      .map(f => ({ f, t: fs.statSync(path.join(tmpDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t)[0];

    if (!latest) return res.status(500).json({ error: 'Download failed — no output file found.' });

    const filePath = path.join(tmpDir, latest.f);
    const actualExt = path.extname(latest.f).slice(1);
    const filename = `myDownloader_${Date.now()}.${actualExt}`;

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'video/mp4');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('end', () => {
      fs.unlink(filePath, () => {}); // cleanup
    });
  } catch (err) {
    const msg = (err.stderr || err.message || '').split('\n').filter(Boolean).slice(-3).join(' ');
    res.status(400).json({ error: `Download failed: ${msg}` });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 myDownloader backend running at http://localhost:${PORT}`);
  console.log(`   Checking yt-dlp...`);
  getYtDlpPath().then(p => {
    if (p) console.log(`   ✅ yt-dlp found at: ${p}`);
    else console.log(`   ⚠️  yt-dlp NOT found. Install with: pip install yt-dlp`);
  });
});
