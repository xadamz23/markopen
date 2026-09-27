// Renders assets/icon.svg into assets/icon.icns. Run with: npm run icon
const { app, BrowserWindow } = require('electron');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const assets = path.join(__dirname, '..', 'assets');
const SIZES = [16, 32, 128, 256, 512];

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    transparent: true,
    webPreferences: { offscreen: true },
  });
  await win.loadFile(path.join(assets, 'icon.svg'));
  const full = await win.capturePage();

  const iconset = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'markopen-icon-')), 'icon.iconset');
  fs.mkdirSync(iconset);
  for (const size of SIZES) {
    for (const scale of [1, 2]) {
      const png = full.resize({ width: size * scale, height: size * scale, quality: 'best' }).toPNG();
      fs.writeFileSync(path.join(iconset, `icon_${size}x${size}${scale === 2 ? '@2x' : ''}.png`), png);
    }
  }
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', path.join(assets, 'icon.icns')]);
  fs.rmSync(path.dirname(iconset), { recursive: true, force: true });
  console.log('wrote assets/icon.icns');
  app.quit();
});
