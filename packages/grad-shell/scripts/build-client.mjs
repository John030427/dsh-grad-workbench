import * as esbuild from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(new URL(import.meta.url)))
const PKG = dirname(ROOT)

const result = await esbuild.build({
  entryPoints: [join(PKG, 'src/client/index.tsx')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  write: false,
  external: [
    'react',
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-runtime/client',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-sidebar',
    '@deepseek-ai/dsh-client-ui-conversation',
  ],
  jsx: 'automatic',
  logLevel: 'warning',
})

const body = result.outputFiles[0].text
const wrapped = `window.__ModuleLoader__.load({
  id: "@grad/grad-shell",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    ${body}
    return module.exports;
  }
});
`

mkdirSync(join(PKG, 'lib'), { recursive: true })
writeFileSync(join(PKG, 'lib/client.js'), wrapped, 'utf8')
console.log('[grad-shell] built lib/client.js')