'use strict';

const http     = require('http');
const assert   = require('assert/strict');
const { spawn } = require('child_process');
const path     = require('path');

const PORT = 8081; // separate port so tests don't clash with a running dev server

// ── helpers ─────────────────────────────────────────────────

function get(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${urlPath}`, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, raw }));
    }).on('error', reject);
  });
}

async function test(label, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    return true;
  } catch (err) {
    console.log(`  \x1b[31m✗\x1b[0m ${label}`);
    console.log(`      \x1b[2m${err.message}\x1b[0m`);
    return false;
  }
}

// ── bootstrap server ─────────────────────────────────────────

const server = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
  env:   { ...process.env, PORT: String(PORT) },
  stdio: 'inherit', // let server output (including any errors) pass through
});

server.on('error', err => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

// ── run suite ────────────────────────────────────────────────

async function run() {
  // give the server a moment to bind
  await new Promise(r => setTimeout(r, 400));

  console.log('\n  hello-http\n');

  const results = await Promise.all([

    test('GET / → 200', async () => {
      const { status } = await get('/');
      assert.equal(status, 200);
    }),

    test('GET / → Content-Type: application/json', async () => {
      const { headers } = await get('/');
      assert.ok(headers['content-type'].includes('application/json'));
    }),

    test('GET / → body.status === "ok"', async () => {
      const { raw } = await get('/');
      assert.equal(JSON.parse(raw).status, 'ok');
    }),

    test('GET / → body.message === "Hello, World!"', async () => {
      const { raw } = await get('/');
      assert.equal(JSON.parse(raw).message, 'Hello, World!');
    }),

    test('GET /foo → body.path === "/foo"', async () => {
      const { raw } = await get('/foo');
      assert.equal(JSON.parse(raw).path, '/foo');
    }),

    test('GET / → body.timestamp is a valid ISO date', async () => {
      const { raw } = await get('/');
      const ts = JSON.parse(raw).timestamp;
      assert.ok(!isNaN(new Date(ts).getTime()), `"${ts}" is not a valid date`);
    }),

  ]);

  const passed = results.filter(Boolean).length;
  const failed = results.length - passed;

  console.log(`\n  ${passed} passing`);
  if (failed) console.log(`  \x1b[31m${failed} failing\x1b[0m`);
  console.log();

  server.kill();
  process.exitCode = failed > 0 ? 1 : 0;
}

run().catch(err => {
  console.error(err);
  server.kill();
  process.exitCode = 1;
});
