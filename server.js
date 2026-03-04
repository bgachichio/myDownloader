import express from 'express';
import cors from 'cors';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execAsync = promisify(exec);
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;

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
    const { stdout } = await execAsync(`"${ytdlpPath}" --version`);
    res.json({ ok: true, ytdlp: true, version: stdout.trim() });
  } catch {
    res.json({ ok: false, ytdlp: false, message: 'yt-dlp found but failed to run.' });
  }
});

// ─── Get video info / available formats ──────────────────────────────────────
app.post('/api/info', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  const ytdlpPath = await getYtDlpPath();
  if (!ytdlpPath) {
    return res.status(503).json({
      error: 'yt-dlp is not installed. Run: pip install yt-dlp',
      installRequired: true,
    });
  }

  try {
    const { stdout } = await execAsync(
      `"${ytdlpPath}" --dump-json --no-playlist "${url}"`,
      { timeout: 30000 }
    );
    const info = JSON.parse(stdout);
    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      duration: info.duration,
      uploader: info.uploader || info.channel,
      platform: info.extractor_key,
      webpage_url: info.webpage_url,
    });
  } catch (err) {
    const msg = err.stderr || err.message || 'Failed to fetch video info';
    res.status(400).json({ error: msg.split('\n').slice(-2).join(' ') });
  }
});

// ─── Download ────────────────────────────────────────────────────────────────
app.get('/api/download', async (req, res) => {
  const { url, mode, quality } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });

  const ytdlpPath = await getYtDlpPath();
  if (!ytdlpPath) {
    return res.status(503).json({ error: 'yt-dlp not installed. Run: pip install yt-dlp' });
  }

  // Build format string
  let formatArgs = '';
  let ext = 'mp4';

  if (mode === 'audio') {
    ext = quality === 'flac' ? 'flac' : 'mp3';
    const audioBitrate = quality === 'flac' ? '0' : (quality || '192');
    formatArgs = `-x --audio-format ${ext} --audio-quality ${audioBitrate === '0' ? '0' : audioBitrate + 'K'}`;
  } else {
    // video
    const resMap = {
      best: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '1080': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]',
      '720': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
      '480': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]',
      '360': 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]',
    };
    const fmt = resMap[quality] || resMap['best'];
    formatArgs = `-f "${fmt}" --merge-output-format mp4`;
  }

  // Write to temp file, stream to client
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `myd_${Date.now()}.%(ext)s`);

  const cmd = `"${ytdlpPath}" ${formatArgs} -o "${tmpFile}" --no-playlist "${url}"`;

  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 120000 });

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
    res.setHeader('Content-Type', mode === 'audio' ? `audio/${actualExt}` : 'video/mp4');

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
