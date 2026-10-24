#!/usr/bin/env node
// `qb` — Vike-style eject CLI for question-bank-framework.
//   qb list                        list ejectable framework files
//   qb reveal <path> [--to <dir>]  copy framework/<path> into your repo to own it
//   qb init [--to <dir>]           scaffold bank.config.ts + content/ + routes
//
// Eject model (like Vike's `eject` package): framework code ships in
// node_modules/question-bank-framework/framework/. By default you import it.
// `qb reveal` copies a file into your project (default: src/overrides/<path>)
// where your Vite/TS alias shadows the package. Edit freely afterwards.
//
// NOTE: the installed bin is plain JS compiled from this file
// (`pnpm build:bin`) — Node refuses to type-strip files under node_modules,
// so bin/qb.js must stay committed alongside this source.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const frameworkDir = join(pkgRoot, 'framework');
const templateDir = join(pkgRoot, 'template');
const args = process.argv.slice(2);
const cmd = args[0];
function walk(dir, base = '') {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const rel = base ? `${base}/${entry}` : entry;
        if (statSync(full).isDirectory())
            out.push(...walk(full, rel));
        else
            out.push(rel);
    }
    return out.sort();
}
function pkgVersion() {
    try {
        const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'));
        return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
    }
    catch {
        return '0.0.0';
    }
}
function readManifest(cwd) {
    const path = join(cwd, '.qb-manifest.json');
    try {
        const parsed = JSON.parse(readFileSync(path, 'utf8'));
        if (parsed && typeof parsed.reveals === 'object' && parsed.reveals !== null) {
            return { reveals: parsed.reveals };
        }
        return { reveals: {} };
    }
    catch {
        return { reveals: {} };
    }
}
function writeManifest(cwd, manifest) {
    writeFileSync(join(cwd, '.qb-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}
if (cmd === 'list' || !cmd) {
    if (!existsSync(frameworkDir)) {
        console.error(`framework/ not found at ${frameworkDir}`);
        process.exit(1);
    }
    for (const f of walk(frameworkDir))
        console.log(`framework/${f}`);
    if (!cmd) {
        console.log('\nUsage: qb reveal <framework/<path>> [--to <dir>] [--force]');
    }
}
else if (cmd === 'reveal') {
    const src = args[1];
    if (!src) {
        console.error('Usage: qb reveal <framework/<path>> [--to <dir>] [--force]');
        process.exit(1);
    }
    const toIdx = args.indexOf('--to');
    const force = args.includes('--force');
    const destRoot = toIdx !== -1 && args[toIdx + 1] ? args[toIdx + 1] : 'src/overrides';
    const rel = src.replace(/^framework\//, '');
    const absSrc = join(frameworkDir, rel);
    if (!existsSync(absSrc) || !statSync(absSrc).isFile()) {
        console.error(`Not ejectable: ${src}\nRun \`qb list\` to see ejectable files.`);
        process.exit(1);
    }
    const cwd = process.cwd();
    const dest = resolve(cwd, destRoot, rel);
    if (existsSync(dest) && !force) {
        console.error(`Refusing to overwrite ${dest} (pass --force).`);
        process.exit(1);
    }
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(absSrc, dest);
    const manifest = readManifest(cwd);
    manifest.reveals[`${destRoot}/${rel}`] = { src: `framework/${rel}`, version: pkgVersion(), revealedAt: new Date().toISOString() };
    writeManifest(cwd, manifest);
    console.log(`Revealed ${`framework/${rel}`} -> ${dest}`);
    console.log('Add an alias so the override shadows the package, e.g. Vite resolve.alias + tsconfig paths:');
    console.log(`  "${destRoot}/*" takes precedence over "question-bank-framework/framework/*"`);
}
else if (cmd === 'init') {
    const toIdx = args.indexOf('--to');
    const destRoot = toIdx !== -1 && args[toIdx + 1] ? args[toIdx + 1] : '.';
    const cwd = resolve(process.cwd(), destRoot);
    for (const f of walk(templateDir)) {
        const from = join(templateDir, f);
        const to = join(cwd, f);
        mkdirSync(dirname(to), { recursive: true });
        if (!existsSync(to))
            cpSync(from, to);
    }
    console.log(`Scaffolded template into ${cwd}`);
    console.log('Next: pnpm install, then point your routes at bank.config.ts (see template/src/routes/).');
}
else {
    console.error(`Unknown command: ${cmd}\nCommands: list, reveal, init`);
    process.exit(1);
}
