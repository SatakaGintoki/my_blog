import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import process from 'node:process'
import console from 'node:console'

const root = path.resolve('dist')
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(file) : [file]
  })
}
const files = walk(root)
const errors = []
for (const file of files) {
  const relative = path.relative(root, file).replaceAll('\\', '/')
  if (/(?:^|\/)(?:node_modules|previews|tests|design-assets|\.env)(?:\/|$)|\.(?:map|log|tsx?)$/.test(relative)) errors.push(`Development file: ${relative}`)
  if (!/\.(?:html|css|js)$/.test(file)) continue
  const content = fs.readFileSync(file, 'utf8')
  const references = file.endsWith('.css')
    ? Array.from(content.matchAll(/url\((?:["']?)([^)"']+)(?:["']?)\)/g), match => match[1])
    : Array.from(content.matchAll(/["'`]((?:\.\/|\/|assets\/)[^"'`\s]+\.(?:js|css|woff2?|svg|webp|png))["'`]/g), match => match[1])
  for (const reference of references) {
    if (/^(?:data:|https?:|#)/.test(reference)) continue
    const target = reference.startsWith('/') || reference.startsWith('assets/')
      ? path.join(root, reference.replace(/^\//, ''))
      : path.resolve(path.dirname(file), reference)
    if (!fs.existsSync(target)) errors.push(`Missing ${reference} referenced by ${relative}`)
  }
}
if (process.env.VITE_ENABLE_PREVIEW !== 'true' && files.some(file => /[/\\]demo-[^/\\]+\.js$/.test(file))) errors.push('Example article chunk included in the default production build')
if (process.env.VITE_ENABLE_PREVIEW !== 'true' && files.some(file => /[/\\]demo-md-flow-[^/\\]+\.svg$/.test(file))) errors.push('Example article image included in the default production build')
if (errors.length) throw new Error(errors.join('\n'))
const totals = {}
for (const file of files) {
  const extension = path.extname(file)
  totals[extension] ??= { count: 0, bytes: 0 }
  totals[extension].count++; totals[extension].bytes += fs.statSync(file).size
}
const entry = files.find(file => /[/\\]index-[^/\\]+\.js$/.test(file))
console.log(JSON.stringify({ resourceReferences: 'passed', files: files.length, totalBytes: files.reduce((sum, file) => sum + fs.statSync(file).size, 0), entryBytes: fs.statSync(entry).size, entryGzipBytes: gzipSync(fs.readFileSync(entry)).length, totals }, null, 2))
