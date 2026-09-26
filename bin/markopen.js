#!/usr/bin/env node
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const electron = require('electron');

const target = path.resolve(process.argv[2] ?? '.');

if (!fs.statSync(target, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`markopen: ${target} is not a directory`);
  process.exit(1);
}

const appDir = path.join(__dirname, '..');
spawn(electron, [appDir, target], { detached: true, stdio: 'ignore' }).unref();
