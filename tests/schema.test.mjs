import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import Ajv from 'ajv/dist/2020.js'
const read = async file => JSON.parse(await readFile(new URL(`../${file}`, import.meta.url)))
const ajv = new Ajv({ strict: true, allErrors: true })
const android = ajv.compile(await read('schemas/android-v8.schema.json'))
const shared = ajv.compile(await read('schemas/megaproxy-v8.schema.json'))
test('Android baseline and additive browser fields remain compatible', async () => {
  for (const file of ['android-v8', 'browser-v8']) {
    const config = await read(`examples/${file}.json`)
    assert.ok(android(config), JSON.stringify(android.errors))
    assert.ok(shared(config), JSON.stringify(shared.errors))
  }
})
test('known platform fields, common requirements and jump chains are validated', async () => {
  const original = await read('examples/browser-v8.json')
  for (const change of [
    c => delete c.profiles[0].id,
    c => { c.profiles[0].proxy.port = 0 },
    c => { c.profiles[0].proxy.type = 'HTTPS_JUMP' },
    c => { c.routing.bypassLocalNetworks = 'yes' },
    c => { c.browser.language = 'xx' },
    c => { c.profiles[0].browser.knockHost = 'https://knock.example' },
    c => { c.profiles[0].browser.bypass = ['a.example', 'a.example'] },
    c => { c.ssh = { maxChannels: 0 } },
    c => { c.profiles[0].proxy.password = 'secret\nheader' }
  ]) {
    const config = structuredClone(original)
    change(config)
    assert.equal(shared(config), false)
  }
  const config = structuredClone(original)
  config.profiles[0].proxy.type = 'HTTPS_JUMP'
  config.profiles[0].proxy.jump = {host: 'jump.example', port: 443}
  assert.ok(shared(config), JSON.stringify(shared.errors))
})
