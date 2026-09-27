#!/usr/bin/env node
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const target = path.resolve(process.argv[2] ?? '.');

if (!fs.statSync(target, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`markopen: ${target} is not a directory`);
  process.exit(1);
}

const appDir = path.join(__dirname, '..');
// The renamed Electron copy built by scripts/make-app.js (so macOS shows "markopen").
const electron = path.join(appDir, 'build', 'markopen.app', 'Contents', 'MacOS', 'Electron');

if (!fs.existsSync(electron)) {
  console.error('markopen: app bundle missing; run npm install (or npm run app) first');
  process.exit(1);
}

spawn(electron, [appDir, target], { detached: true, stdio: 'ignore' }).unref();
