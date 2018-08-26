// todo: unify across simulator and framework projects

import * as http from 'http'
import * as websocket from 'websocket-stream'
import * as ws from 'ws'
import * as Connection from 'mqtt-connection'

import { Observable, Observer } from 'rxjs'
export interface Config {
  hostname: string
  port: number
}

export const start = (c: Config): Observable<{ url: string }> =>
  Observable.create((obs: Observer<{ url: string }>) => {
    const { hostname, port } = c

    const WebSocketServer = ws.Server

    const server = http.createServer()
    const wss = new WebSocketServer({ server: server })

    let subs: { [K: string]: any } = {}

    wss.on('connection', function (ws: any) {
      const stream = websocket(ws)
      const connection = new Connection(stream)

      handle(connection)
    })

    function handle (conn: any) {
      conn.on('connect', function (packet: any) {
        // acknowledge the connect packet
        conn.connack({ returnCode: 0 })
      })

      // client published
      conn.on('publish', function (packet: any) {
        console.log('MSG', packet.topic, packet.payload.toString())
        const sub = subs[packet.topic]
        if (sub) {
          sub.forEach((s: any) => s.write(packet))
          // sub.write(packet)
          if (packet.qos > 0) {
            conn.puback({ messageId: packet.messageId })
          }
        }
      })

      // client pinged
      conn.on('pingreq', function () {
        // send a pingresp
        conn.pingresp()
      })

      // client subscribed
      conn.on('subscribe', function (packet: any) {
        packet.subscriptions.forEach((s: any) =>
          subs[s.topic] = (subs[s.topic] || []).concat([conn]))

        if (packet.qos > 0) {
          conn.suback({ granted: [packet.qos], messageId: packet.messageId })
        }
      })

      // connection error handling
      conn.on('close', function () {
        conn.destroy()
        Object.keys(subs).forEach(s => {
          if (subs[s] && subs[s].indexOf(conn) >= 0) {
            subs[s] = subs[s].filter((c: any) => c !== conn)
            if (subs[s].length === 0) delete (subs[s])
          }
        })
      })
      conn.on('error', function (e: any) { console.error('\n\nMQTT-ERROR\n\n', e); conn.destroy() })
      conn.on('disconnect', function () { conn.destroy() })
    }

    server.listen(port, hostname, (err: any) => {
      if (err) {
        console.error(err)
        process.exit(1)
      }
      const url = `ws://${hostname}:${port}`
      console.log(`MQTT listening on ${url}`)
      obs.next({ url })
    })

    server.on('error', (err) => obs.error(err))

    return () => {
      Object.keys(subs).forEach(s => subs[s]
        .forEach((c: any) => c.disconnect()))
      subs = {}
      server.close()
    }
  }) as any
