import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import ts from 'typescript'

function files(path: string): string[] { return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(resolve(path, entry.name)) : [resolve(path, entry.name)]) }

function feature_sources(): string[] {
  return [...files(resolve('src/features')), ...files(resolve('src/app'))].filter(path => path.endsWith('.tsx') && !path.endsWith('.test.tsx'))
}

function parse(file: string) {
  return ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

it('keeps native JSX inside shadcn components only', () => {
 for (const file of feature_sources()) {
 const source = parse(file)
 const visit = (node: ts.Node) => {
 if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) expect(node.tagName.getText(source), file).not.toMatch(/^[a-z]/)
 ts.forEachChild(node, visit)
 }
 visit(source)
 }
})

it('uses CardTitle and CardDescription only inside a Card', () => {
 for (const file of feature_sources()) {
 const source = parse(file)
 const visit = (node: ts.Node, ancestors: string[]) => {
 if (ts.isJsxElement(node)) {
 const name = node.openingElement.tagName.getText(source)
 if (name === 'CardTitle' || name === 'CardDescription') expect(ancestors, `${file}: ${name} outside Card`).toContain('Card')
 ts.forEachChild(node, child => visit(child, [...ancestors, name]))
 return
 }
 if (ts.isJsxSelfClosingElement(node)) {
 const name = node.tagName.getText(source)
 if (name === 'CardTitle' || name === 'CardDescription') expect(ancestors, `${file}: ${name} outside Card`).toContain('Card')
 return
 }
 ts.forEachChild(node, child => visit(child, ancestors))
 }
 visit(source, [])
 }
})

it('scrolls feature areas with ScrollArea, not overflow classes', () => {
 for (const file of feature_sources()) {
 const text = readFileSync(file, 'utf8')
 expect(text, file).not.toMatch(/overflow-(y-|x-)?(auto|scroll)/)
 }
})
