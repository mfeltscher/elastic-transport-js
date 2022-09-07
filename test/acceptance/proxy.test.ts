/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// We are using self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

import { test } from 'tap'
import { AddressInfo } from 'net'
import {
  TestClient,
  buildProxy
} from '../utils'
import { BaseConnection, HttpConnection, UndiciConnection } from '../../lib/connection'
import type { Server } from 'http'
import { Server as HttpsServer } from 'https'
import type { ProxyServer } from '../utils/buildProxy'

const {
  createProxy,
  createSecureProxy,
  createServer,
  createSecureServer
} = buildProxy

const request = async <TResponse = unknown>(server: Server, proxy: ProxyServer, path: string, connection: typeof BaseConnection = HttpConnection, proxyAuth?: string) => {
  const client = new TestClient({
    connection,
    node: `http${server instanceof HttpsServer ? 's' : ''}://${proxyAuth ? `${proxyAuth}@` : ''}${(server.address() as AddressInfo).address}:${(server.address() as AddressInfo).port}`,
    proxy: `http${proxy instanceof HttpsServer ? 's' : ''}://${proxyAuth ? `${proxyAuth}@` : ''}${(proxy.address() as AddressInfo).address}:${(proxy.address() as AddressInfo).port}`,
  })
  const response = await client.request<TResponse>({ path, method: 'GET' })
  await client.close()

  return response
}

const mockResponse = (server: Server, t: Tap.Test) => {
  server.on('request', (req, res) => {
    t.equal(req.url, '/_cluster/health')
    res.setHeader('content-type', 'application/json')
    res.setHeader('x-elastic-product', 'Elasticsearch')
    res.end(JSON.stringify({ hello: 'world' }))
  })
}

test('http-http proxy support', async t => {
  const server = await createServer()
  const proxy = await createProxy()
  mockResponse(server, t)

  t.same(await request(server, proxy, '/_cluster/health'), { hello: 'world' })
  t.same(await request(server, proxy, '/_cluster/health', UndiciConnection), { hello: 'world' })

  server.close()
  proxy.close()
})

test('http-https proxy support', async t => {
  const server = await createSecureServer()
  const proxy = await createProxy()
  mockResponse(server, t)

  t.same(await request(server, proxy, '/_cluster/health'), { hello: 'world' })
  t.same(await request(server, proxy, '/_cluster/health', UndiciConnection), { hello: 'world' })

  server.close()
  proxy.close()
})

test('https-http proxy support', async t => {
  const server = await createServer()
  const proxy = await createSecureProxy()
  mockResponse(server, t)

  t.same(await request(server, proxy, '/_cluster/health'), { hello: 'world' })
  t.same(await request(server, proxy, '/_cluster/health', UndiciConnection), { hello: 'world' })

  server.close()
  proxy.close()
})

test('https-https proxy support', async t => {
  const server = await createSecureServer()
  const proxy = await createSecureProxy()
  mockResponse(server, t)

  t.same(await request(server, proxy, '/_cluster/health'), { hello: 'world' })
  t.same(await request(server, proxy, '/_cluster/health', UndiciConnection), { hello: 'world' })

  server.close()
  proxy.close()
})

test('http basic authentication', async t => {
  const server = await createServer()
  const proxy = await createProxy()
  mockResponse(server, t)

  proxy.authenticate = function (req, fn): void {
    fn(null, req.headers['proxy-authorization'] === `Basic ${Buffer.from('hello:world').toString('base64')}`)
  }

  t.same((await request(server, proxy, '/_cluster/health', HttpConnection, 'hello:world')), { hello: 'world' })
  t.same(await request(server, proxy, '/_cluster/health', UndiciConnection, 'hello:world'), { hello: 'world' })

  server.close()
  proxy.close()
})

test('https basic authentication', async t => {
  const server = await createSecureServer()
  const proxy = await createProxy()
  mockResponse(server, t)

  proxy.authenticate = function (req, fn): void {
    fn(null, req.headers['proxy-authorization'] === `Basic ${Buffer.from('hello:world').toString('base64')}`)
  }

  t.same(await request(server, proxy, '/_cluster/health', HttpConnection, 'hello:world'), { hello: 'world' })
  t.same(await request(server, proxy, '/_cluster/health', UndiciConnection, 'hello:world'), { hello: 'world' })

  server.close()
  proxy.close()
})
