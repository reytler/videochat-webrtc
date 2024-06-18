import express, { Application } from 'express'
import socketIO, { Server as SocketIOServer } from 'socket.io'
import { createServer, Server as HTTPServer } from 'http'
import path from 'path'
import cors from 'cors'
import fs from 'fs'
import https from 'https'

export class Server {
  private httpServer: HTTPServer
  private app: Application
  private io: SocketIOServer

  private activeSockets: string[] = []

  private readonly DEFAULT_PORT = 5000

  private options = {
    key: fs.readFileSync(process.cwd() + '/src/server.key', 'utf-8'),
    cert: fs.readFileSync(process.cwd() + '/src/server.cert', 'utf-8'),
  }

  constructor() {
    this.app = express()
    this.app.use(cors())
    this.configureApp()
    this.httpServer = https.createServer(this.options, this.app)
    //@ts-ignore
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    })

    this.configureRoutes()
    this.handleSocketConnection()
  }

  private configureApp(): void {
    this.app.use(express.static(path.join(__dirname, '../public')))
  }

  private configureRoutes(): void {
    this.app.get('/', (req, res) => {
      res.sendFile('index.html')
    })
  }

  private handleSocketConnection(): void {
    this.io.on('connection', (socket) => {
      const existingSocket = this.activeSockets.find(
        (existingSocket) => existingSocket === socket.id,
      )

      if (!existingSocket) {
        this.activeSockets.push(socket.id)

        socket.emit('update-user-list', {
          users: this.activeSockets.filter(
            (existingSocket) => existingSocket !== socket.id,
          ),
        })

        socket.broadcast.emit('update-user-list', {
          users: [socket.id],
        })
      }

      socket.on('call-user', (data: any) => {
        socket.to(data.to).emit('call-made', {
          offer: data.offer,
          socket: socket.id,
        })
      })

      socket.on('make-answer', (data) => {
        socket.to(data.to).emit('answer-made', {
          socket: socket.id,
          answer: data.answer,
        })
      })

      socket.on('reject-call', (data) => {
        socket.to(data.from).emit('call-rejected', {
          socket: socket.id,
        })
      })

      socket.on('disconnect', () => {
        this.activeSockets = this.activeSockets.filter(
          (existingSocket) => existingSocket !== socket.id,
        )
        socket.broadcast.emit('remove-user', {
          socketId: socket.id,
        })
      })
    })
  }

  public listen(callback: (port: number) => void): void {
    this.httpServer.listen(this.DEFAULT_PORT, () => {
      callback(this.DEFAULT_PORT)
    })
  }
}
