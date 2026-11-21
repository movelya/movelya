import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const workerPath = resolve(root, 'dist-github', 'sw.js')
const version = `${JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version}-${Date.now()}`

if (!existsSync(workerPath)) throw new Error('O service worker não foi encontrado no build do GitHub Pages.')

const worker = readFileSync(workerPath, 'utf8')
if (!worker.includes('__BUILD_ID__')) throw new Error('O service worker não contém o marcador de versão de build.')

writeFileSync(workerPath, worker.replace('__BUILD_ID__', version))
console.log(`GitHub Pages service worker versionado: ${version}`)
