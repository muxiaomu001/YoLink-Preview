// 用真实动作与种子数据做内存验证，不读取浏览器或磁盘上的用户数据。
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '..')
const sourceRoot = process.env.YOLINK_TEST_SOURCE || root
const projectRequire = createRequire(path.join(root, 'package.json'))
const ts = projectRequire('typescript')
const modules = new Map(), timers = [], memory = new Map()
const localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value) }, removeItem: key => { memory.delete(key) } }
function load(file) {
  file = path.resolve(file)
  if (!fs.existsSync(file)) file += fs.existsSync(`${file}.ts`) ? '.ts' : '.tsx'
  if (modules.has(file)) return modules.get(file).exports
  const module = { exports: {} }
  modules.set(file, module)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    .replace(/import\.meta\.env\.BASE_URL/g, "'/'")
  const requireSource = spec => spec.startsWith('@/') ? load(path.join(sourceRoot, 'src', spec.slice(2))) : spec.startsWith('.') ? load(path.resolve(path.dirname(file), spec)) : projectRequire(spec)
  vm.runInNewContext(code, { module, exports: module.exports, require: requireSource, Date, Math, console, localStorage,
    window: { setTimeout: fn => timers.push(fn), addEventListener() {} }, navigator: { onLine: true } }, { filename: file })
  return module.exports
}
const { useStore } = load(path.join(sourceRoot, 'src/store/store.ts'))
const { buildSeed } = load(path.join(sourceRoot, 'src/domain/seed.ts'))
const rules = load(path.join(sourceRoot, 'src/domain/messageRules.ts'))
const customerStatus = load(path.join(sourceRoot, 'src/domain/customerStatus.ts'))
const policy = load(path.join(sourceRoot, 'src/store/policy.ts'))
function reset() {
  timers.length = 0
  memory.clear()
  useStore.setState(structuredClone(buildSeed()))
  return useStore.getState()
}
function flush() { while (timers.length) timers.shift()() }
module.exports = { reset, flush, store: useStore, rules, customerStatus, policy, loadSource: relative => load(path.join(sourceRoot, relative)) }
