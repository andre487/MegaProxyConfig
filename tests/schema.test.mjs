import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import Ajv from 'ajv/dist/2020.js'
const read = async file => JSON.parse(await readFile(new URL(`../${file}`, import.meta.url)))
const ajv = new Ajv({ strict: true, allErrors: true })
const android = ajv.compile(await read('schemas/android-v8.schema.json'))
const shared = ajv.compile(await read('schemas/megaproxy-v8.schema.json'))
test('Shared examples and opaque platform extensions remain compatible', async () => {
  for (const file of ['android-v8', 'browser-v8', 'windows-v8']) {
    const config = await read(`examples/${file}.json`)
    assert.ok(android(config), JSON.stringify(android.errors))
    assert.ok(shared(config), JSON.stringify(shared.errors))
  }
})
test('mixed Android HTTPS and MASQUE retain separate custom TLS and QUIC JA3 fields', async () => {
  const config = await read('examples/android-v8.json')
  const masque = config.profiles.find(p => p.proxy.type === 'MASQUE')
  assert.ok(config.profiles.some(p => p.proxy.type === 'HTTPS'))
  assert.equal(config.tls.fingerprint, 'CUSTOM')
  assert.equal(masque.tls.fingerprint, 'CUSTOM')
  assert.notEqual(config.tls.customJa3, masque.tls.customJa3)
  assert.ok(masque.tls.customJa3.split(',')[2].split('-').includes('57'))
  assert.ok(!config.tls.customJa3.split(',')[2].split('-').includes('57'))
  for (const validate of [android, shared]) {
    assert.ok(validate(config), JSON.stringify(validate.errors))
    for (const value of [42, 'x'.repeat(8193)]) {
      const invalid = structuredClone(config)
      invalid.profiles.find(p => p.proxy.type === 'MASQUE').tls.customJa3 = value
      assert.equal(validate(invalid), false)
    }
  }
})
test('Common requirements and jump chains are validated', async () => {
  const original = await read('examples/browser-v8.json')
  for (const change of [
    c => delete c.profiles[0].id,
    c => { c.profiles[0].proxy.port = 0 },
    c => { c.profiles[0].proxy.type = 'HTTPS_JUMP' },
    c => { c.routing.bypassLocalNetworks = 'yes' },
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




test('SOCKS5 is valid in both shared and Android contracts', async () => {
  const config = await read('examples/browser-v8.json')
  config.profiles[0].proxy.type = 'SOCKS5'
  config.profiles[0].proxy.port = 1080
  assert.ok(shared(config), JSON.stringify(shared.errors))
  assert.ok(android(config), JSON.stringify(android.errors))
  config.profiles[0].proxy.username = 'user:with:colon'
  assert.ok(shared(config), JSON.stringify(shared.errors))
  assert.ok(android(config), JSON.stringify(android.errors))
  config.profiles[0].proxy.type = 'HTTPS'
  assert.equal(shared(config), false)
  assert.equal(android(config), false)
  config.profiles[0].proxy.type = 'SOCKS4'
  assert.equal(shared(config), false)
})


test('MASQUE is validated while browser template validation belongs to the browser', async () => {
  const config = await read('examples/browser-v8.json')
  config.profiles[0].proxy.type = 'MASQUE'
  assert.ok(shared(config), JSON.stringify(shared.errors))
  assert.ok(android(config), JSON.stringify(android.errors))
  config.profiles[0].browser.masqueTemplate = '/custom/{target_host}/{target_port}/'
  assert.ok(shared(config), JSON.stringify(shared.errors))
  for (const value of [42, 'x'.repeat(2049)]) {
    config.profiles[0].browser.masqueTemplate = value
    assert.ok(shared(config), JSON.stringify(shared.errors))
  }
})

test('root configuration subscriptions validate in both schemas', async () => {
  const config = await read('examples/browser-v8.json')
  config.subscription = { url: 'https://configs.example.com/MegaProxy.json', username: 'subscriber', password: 'example', fallbackUrls: ['https://backup.example.com/config.json'], intervalMinutes: 15, enabled: true }
  assert.ok(shared(config), JSON.stringify(shared.errors))
  assert.ok(android(config), JSON.stringify(android.errors))
  for (const subscription of [null, { url: 'https://configs.example.com/MegaProxy.json' }, { url: 'https://configs.example.com/', future: true }]) {
    assert.ok(shared({ ...config, subscription }), JSON.stringify(shared.errors))
  }
  for (const subscription of [
    {}, [], { url: 'http://configs.example.com/' },
    { url: 'https://configs.example.com/', username: 123 },
    { url: 'https://configs.example.com/', password: 'x'.repeat(1025) },
    { url: 'https://configs.example.com/', intervalMinutes: 0 },
    { url: 'https://configs.example.com/', intervalMinutes: 10081 },
    { url: 'https://configs.example.com/', enabled: 'yes' },
    { url: 'https://configs.example.com/', fallbackUrls: 'https://backup.example.com/' },
    { url: 'https://configs.example.com/', fallbackUrls: ['http://backup.example.com/'] },
    { url: 'https://configs.example.com/', fallbackUrls: ['https://backup.example.com/', 'https://backup.example.com/'] },
    { url: 'https://configs.example.com/', fallbackUrls: Array.from({ length: 8 }, (_, i) => `https://backup${i}.example.com/`) }
  ]) {
    assert.equal(shared({ ...config, subscription }), false)
    assert.equal(android({ ...config, subscription }), false)
  }
})

test('HTTPS HTTP/3 preference is optional, boolean and compatible with both schemas', async () => {
  const config = await read('examples/android-v8.json')
  const proxy = config.profiles.find(p => p.proxy.type === 'HTTPS').proxy
  assert.equal(proxy.preferHttp3, true)
  for (const validate of [android, shared]) {
    for (const value of [false, true]) {
      proxy.preferHttp3 = value
      assert.ok(validate(config), JSON.stringify(validate.errors))
    }
    for (const value of ['true', 1, null]) {
      proxy.preferHttp3 = value
      assert.equal(validate(config), false)
    }
    delete proxy.preferHttp3
    assert.ok(validate(config), JSON.stringify(validate.errors))
  }
})

test('HTTPS Jump also preserves the optional HTTP/3 preference', async () => {
  const config = await read('examples/android-v8.json')
  const proxy = config.profiles.find(p => p.proxy.type === 'HTTPS').proxy
  proxy.type = 'HTTPS_JUMP'
  proxy.preferHttp3 = true
  proxy.jump = { host: 'jump.example', port: 443, username: 'jump', password: 'synthetic' }
  for (const validate of [android, shared]) assert.ok(validate(config), JSON.stringify(validate.errors))
})



test('shared HTTPS knock host is typed in Android and shared schemas without browser metadata', async () => {
  const config = await read('examples/android-v8.json')
  const proxy = config.profiles.find(p => p.proxy.type === 'HTTPS').proxy
  for (const validate of [android, shared]) {
    for (const value of ['', 'knock.example', '192.0.2.1', '2001:db8::1', '[2001:db8::1]']) {
      proxy.knockHost = value
      assert.ok(validate(config), JSON.stringify(validate.errors))
    }
    for (const value of [true, 1, null, 'https://knock.example', 'host:443', 'user@host', 'host/path', 'x'.repeat(254)]) {
      proxy.knockHost = value
      assert.equal(validate(config), false)
    }
    delete proxy.knockHost
    assert.ok(validate(config), JSON.stringify(validate.errors))
  }
})

test('platform extensions are opaque to the shared schema', async () => {
  const config = await read('examples/browser-v8.json')
  for (const name of ['android', 'browser', 'windows', 'futurePlatform']) {
    config[name] = { version: 17, routing: { applicationIds: ['platform-specific'] }, arbitrary: true }
    config.profiles[0][name] = { arbitrary: 'owned by the application' }
  }
  for (const validate of [shared, android]) assert.ok(validate(config), JSON.stringify(validate.errors))
})

test('HTTP/2 preference is typed and optional', async () => {
  const config = await read('examples/browser-v8.json')
  for (const value of [true, false]) {
    config.profiles[0].proxy.preferHttp2 = value
    assert.ok(shared(config), JSON.stringify(shared.errors))
  }
  for (const value of [1, 'true', null]) {
    config.profiles[0].proxy.preferHttp2 = value
    assert.equal(shared(config), false)
  }
})

test('IPv6 permissions are separate optional booleans', async () => {
  const config = await read('examples/windows-v8.json')
  config.routing = { systemAllowIpv6: true }
  config.profiles[0].routing = { allowIpv6: false }
  for (const validate of [shared, android]) {
    assert.ok(validate(config), JSON.stringify(validate.errors))
    config.routing.systemAllowIpv6 = 'true'
    assert.equal(validate(config), false)
    config.routing.systemAllowIpv6 = true
    config.profiles[0].routing.allowIpv6 = 'false'
    assert.equal(validate(config), false)
    config.profiles[0].routing.allowIpv6 = false
  }
})
