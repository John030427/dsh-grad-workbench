import * as esbuild from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(new URL(import.meta.url)))
const PKG = dirname(ROOT)
const ENTRY_ID = '@grad/dsh-grad-workbench'

// ── host half: single ESM bundle, zero runtime deps beyond node builtins ───
await esbuild.build({
  entryPoints: [join(PKG, 'src/host/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outfile: join(PKG, 'lib/index.js'),
  sourcemap: true,
  logLevel: 'warning',
})
console.log('[dsh-grad-workbench] built lib/index.js')

// ── client half: browser CJS wrapped for window.__ModuleLoader__ ───────────
const result = await esbuild.build({
  entryPoints: [join(PKG, 'src/client/index.tsx')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  write: false,
  sourcemap: false,
  external: [
    'react',
    'react-dom',
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-runtime/client',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-sidebar',
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-layout',
  ],
  jsx: 'automatic',
  logLevel: 'warning',
})

const cjsBody = result.outputFiles[0].text
const wrapped = `window.__ModuleLoader__.load({
  id: "${ENTRY_ID}",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    ${cjsBody}
    return module.exports;
  }
});
`

mkdirSync(join(PKG, 'lib'), { recursive: true })
writeFileSync(join(PKG, 'lib/client.js'), wrapped, 'utf8')
console.log('[dsh-grad-workbench] built lib/client.js')
