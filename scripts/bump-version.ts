const path = new URL('../package.json', import.meta.url)
const manifest = JSON.parse(await Bun.file(path).text()) as { version: string }
const [major, minor, patch] = manifest.version.split('.').map(Number)
manifest.version = `${major}.${minor}.${patch + 1}`
await Bun.write(path, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(manifest.version)
