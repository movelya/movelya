import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const workerOutput = resolve(root, 'dist', 'jhow_fit')
const serverOutput = resolve(root, 'dist', 'server')
const hostingSource = resolve(root, '.openai', 'hosting.json')
const hostingOutput = resolve(root, 'dist', '.openai')
const serviceWorkerOutput = resolve(root, 'dist', 'client', 'sw.js')

if (!existsSync(resolve(workerOutput, 'index.js'))) {
  throw new Error('A saída Cloudflare do vinext não foi encontrada.')
}

if (!existsSync(serviceWorkerOutput)) {
  throw new Error('O service worker não foi encontrado no build do cliente.')
}

const buildId = `${JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version}-${Date.now()}`
const serviceWorker = readFileSync(serviceWorkerOutput, 'utf8')
if (!serviceWorker.includes('__BUILD_ID__')) {
  throw new Error('O service worker não contém o marcador de versão de build.')
}
writeFileSync(serviceWorkerOutput, serviceWorker.replace('__BUILD_ID__', buildId))

mkdirSync(serverOutput, { recursive: true })
cpSync(workerOutput, serverOutput, { recursive: true, force: true })
rmSync(resolve(serverOutput, '.dev.vars'), { force: true })
mkdirSync(hostingOutput, { recursive: true })
cpSync(hostingSource, resolve(hostingOutput, 'hosting.json'), { force: true })

console.log(`Sites artifact ready: dist/server/index.js (cache ${buildId})`)
