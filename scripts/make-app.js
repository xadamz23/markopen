// Builds build/markopen.app: a renamed, re-iconed copy of Electron.app, so the macOS
// menu bar and Dock say "markopen". It still loads the code from this folder.
// Runs on npm install; rerun with: npm run app
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectDir = path.join(__dirname, '..');
const source = path.join(path.dirname(require('electron')), '..', '..');
const target = path.join(projectDir, 'build', 'markopen.app');
const plist = path.join(target, 'Contents', 'Info.plist');

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(path.dirname(target), { recursive: true });
// cp -R keeps the framework symlinks intact.
execFileSync('cp', ['-R', source, target]);

for (const [key, value] of [
  ['CFBundleName', 'markopen'],
  ['CFBundleDisplayName', 'markopen'],
  ['CFBundleIdentifier', 'com.adamstahl.markopen'],
]) {
  execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist]);
}
fs.copyFileSync(path.join(projectDir, 'assets', 'icon.icns'), path.join(target, 'Contents', 'Resources', 'electron.icns'));

// No re-signing needed: Electron's binary carries a linker ad-hoc signature that doesn't bind
// Info.plist or resources (codesign -dv shows "Info.plist=not bound"), so the edits above keep it valid.
console.log(`built ${path.relative(projectDir, target)}`);
