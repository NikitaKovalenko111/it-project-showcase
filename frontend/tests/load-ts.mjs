import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const cache = new Map()
export async function loadTs(url) {
  if (cache.has(url.href)) return cache.get(url.href)
  const source = await readFile(url, 'utf8')
  let { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } })
  const imports = [...outputText.matchAll(/from ['"]([^'"]+)['"]/g)]
  for (const match of imports) {
    const dependency = match[1].startsWith('.')
      ? await loadTs(new URL(`${match[1]}.ts`, url)) : import.meta.resolve(match[1])
    outputText = outputText.replace(match[0], `from '${dependency}'`)
  }
  const result = `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
  cache.set(url.href, result)
  return result
}
