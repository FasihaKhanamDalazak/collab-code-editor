import "dotenv/config"
import bcrypt from "bcryptjs"
import express from "express"
import { rateLimit } from "express-rate-limit"
import { randomBytes } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import path from "node:path"
import { fileURLToPath } from "node:url"
import jwt from "jsonwebtoken"
import { Server } from "socket.io"
import { removeAwarenessStates } from "y-protocols/awareness"
import { YSocketIO } from "y-socket.io/dist/server"

const app = express()
const httpServer = createServer(app)
const port = Number(process.env.PORT || 3000)
const directory = path.dirname(fileURLToPath(import.meta.url))
const dataDirectory = path.resolve(process.env.DATA_DIR || path.join(directory, "data"))
const roomsFile = path.join(dataDirectory, "rooms.json")
const roomCodeCharacters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
const judge0Url = (process.env.JUDGE0_URL || "https://ce.judge0.com").replace(/\/+$/, "")
const maximumCodeBytes = 32 * 1024
const rooms = new Map()
const joinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many join attempts. Please try again later." },
})
const runLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many runs. Please wait a moment before trying again." },
})
const judge0LanguageMatchers = {
  javascript: /^JavaScript\b/i,
  typescript: /^TypeScript\b/i,
  python: /^Python\b/i,
  cpp: /^C\+\+/i,
  java: /^Java(?:\s|\()/i,
  go: /^Go\b/i,
}
let cachedJudge0Languages = null

class RunServiceError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const jwtSecret = process.env.JWT_SECRET || randomBytes(32).toString("hex")
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET must be set in production.")
}
if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET is not set. A temporary secret will be used until the server restarts.")
}

await mkdir(dataDirectory, { recursive: true })
try {
  const savedRooms = JSON.parse(await readFile(roomsFile, "utf8"))
  if (!Array.isArray(savedRooms)) throw new Error("Room metadata must be an array.")
  for (const room of savedRooms) {
    if (room && /^[A-Z0-9]{6}$/.test(room.id) && typeof room.createdAt === "string") {
      rooms.set(room.id, room)
    }
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error
}

let persistenceQueue = Promise.resolve()
function persistRooms() {
  const snapshot = JSON.stringify([...rooms.values()], null, 2)
  const write = persistenceQueue.then(async () => {
    const temporaryFile = `${roomsFile}.${randomBytes(6).toString("hex")}.tmp`
    await writeFile(temporaryFile, snapshot, "utf8")
    await rename(temporaryFile, roomsFile)
  })
  persistenceQueue = write.catch((error) => {
    console.error("Room metadata persistence failed:", error)
  })
  return write
}

function createRoomId() {
  let id
  do {
    id = Array.from(randomBytes(6), (byte) => roomCodeCharacters[byte % roomCodeCharacters.length]).join("")
  } while (rooms.has(id))
  return id
}

function validName(value, maximum = 40) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximum
}

function readRoomToken(token) {
  return jwt.verify(token, jwtSecret, { algorithms: ["HS256"] })
}

function getBearerToken(request) {
  const authorization = request.get("authorization") || ""
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  return match?.[1]
}

function requireRoomToken(request, response, next) {
  try {
    const claims = readRoomToken(getBearerToken(request))
    if (!claims || typeof claims !== "object" || typeof claims.roomId !== "string") {
      return response.status(401).json({ error: "Your room session has expired. Join the room again." })
    }
    const bodyRoomId = request.body?.roomId
    const requestedRoom = String(request.params.id || bodyRoomId || claims.roomId).toUpperCase()
    if (
      claims.roomId !== requestedRoom ||
      (bodyRoomId && String(bodyRoomId).toUpperCase() !== claims.roomId) ||
      !rooms.has(requestedRoom)
    ) {
      return response.status(403).json({ error: "This session is not authorized for that room." })
    }
    request.room = rooms.get(requestedRoom)
    request.user = { username: claims.username, roomId: claims.roomId }
    return next()
  } catch {
    return response.status(401).json({ error: "Your room session has expired. Join the room again." })
  }
}

async function requestJudge0(resource, options = {}) {
  let response
  try {
    response = await fetch(`${judge0Url}${resource}`, {
      ...options,
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    throw new RunServiceError(502, "The code execution service is unavailable. Please try again.")
  }
  if (!response.ok) {
    throw new RunServiceError(502, "The code execution service could not process this run.")
  }
  try {
    return await response.json()
  } catch {
    throw new RunServiceError(502, "The code execution service returned an invalid response.")
  }
}

async function getJudge0LanguageId(language) {
  if (!cachedJudge0Languages || cachedJudge0Languages.expiresAt <= Date.now()) {
    const languages = await requestJudge0("/languages")
    if (!Array.isArray(languages)) {
      throw new RunServiceError(502, "The code execution service returned an invalid language list.")
    }
    const ids = new Map()
    for (const languageEntry of languages) {
      if (typeof languageEntry?.name !== "string" || !Number.isInteger(languageEntry.id)) continue
      for (const [key, matcher] of Object.entries(judge0LanguageMatchers)) {
        if (!ids.has(key) && matcher.test(languageEntry.name)) ids.set(key, languageEntry.id)
      }
    }
    cachedJudge0Languages = { expiresAt: Date.now() + 60 * 60 * 1000, ids }
  }

  const id = cachedJudge0Languages.ids.get(language)
  if (!id) throw new RunServiceError(503, `${language} is not currently available to run.`)
  return id
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_ORIGIN
      ? [process.env.FRONTEND_ORIGIN]
      : ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST"],
  },
})

const ySocketIO = new YSocketIO(io, {
  levelPersistenceDir: path.join(dataDirectory, "documents"),
  authenticate: (handshake) => {
    try {
      const claims = readRoomToken(handshake.auth?.token)
      return rooms.has(claims.roomId) && handshake.auth?.roomId === claims.roomId
    } catch {
      return false
    }
  },
})

const presenceOwners = new Map()
ySocketIO.initialize()

const yjsNamespace = ySocketIO.nsp
if (!yjsNamespace) throw new Error("The Yjs namespace could not be initialized.")

yjsNamespace.use((socket, next) => {
  try {
    const namespaceRoomId = socket.nsp.name.slice("/yjs|".length)
    const claims = readRoomToken(socket.handshake.auth?.token)
    if (
      !/^[A-Z0-9]{6}$/.test(namespaceRoomId) ||
      !rooms.has(namespaceRoomId) ||
      claims.roomId !== namespaceRoomId ||
      socket.handshake.auth?.roomId !== namespaceRoomId ||
      !Number.isSafeInteger(socket.handshake.auth?.clientId)
    ) {
      return next(new Error("Unauthorized room connection."))
    }
    socket.data.username = claims.username
    socket.data.roomId = claims.roomId
    socket.data.clientId = socket.handshake.auth.clientId
    return next()
  } catch {
    return next(new Error("Unauthorized room connection."))
  }
})

yjsNamespace.on("connection", (socket) => {
  const roomId = socket.nsp.name.slice("/yjs|".length)
  const presenceKey = `${roomId}:${socket.data.clientId}`
  presenceOwners.set(presenceKey, socket.id)
  socket.on("disconnect", () => {
    if (presenceOwners.get(presenceKey) !== socket.id) return
    presenceOwners.delete(presenceKey)
    const document = ySocketIO.documents.get(roomId)
    if (document?.awareness.getStates().has(socket.data.clientId)) {
      removeAwarenessStates(document.awareness, [socket.data.clientId], socket)
    }
  })
})

app.use(express.json({ limit: "64kb" }))
app.use(express.static(path.join(directory, "public")))

app.get("/health", (_request, response) => {
  response.status(200).json({ message: "ok", success: true })
})

app.post("/api/rooms", async (request, response) => {
  const { name, roomName = "", password = "" } = request.body || {}
  if (!validName(name, 32)) {
    return response.status(400).json({ error: "Enter a name between 1 and 32 characters.", code: "invalid_name" })
  }
  if (typeof roomName !== "string" || roomName.trim().length > 60) {
    return response.status(400).json({ error: "Room names must be 60 characters or fewer.", code: "invalid_room_name" })
  }
  if (typeof password !== "string" || password.length > 72) {
    return response.status(400).json({ error: "Passwords must be 72 characters or fewer.", code: "invalid_password" })
  }

  const id = createRoomId()
  const room = {
    id,
    name: roomName.trim() || `${name.trim()}'s room`,
    passwordHash: password ? await bcrypt.hash(password, 12) : null,
    createdAt: new Date().toISOString(),
  }
  rooms.set(id, room)
  await persistRooms()
  const token = jwt.sign({ roomId: id, username: name.trim() }, jwtSecret, { expiresIn: "12h", algorithm: "HS256" })
  return response.status(201).json({
    roomId: id,
    roomName: room.name,
    hasPassword: Boolean(room.passwordHash),
    token,
    inviteUrl: `${request.protocol}://${request.get("host")}/room/${id}`,
  })
})

app.get("/api/rooms/:id", (request, response) => {
  const room = rooms.get(String(request.params.id).toUpperCase())
  if (!room) return response.status(404).json({ error: "Room not found.", code: "room_not_found" })
  return response.json({ roomId: room.id, roomName: room.name, hasPassword: Boolean(room.passwordHash) })
})

app.post("/api/rooms/:id/join", joinLimiter, async (request, response) => {
  const id = String(request.params.id).toUpperCase()
  const room = rooms.get(id)
  if (!room) return response.status(404).json({ error: "Room not found.", code: "room_not_found" })

  const { name, password = "" } = request.body || {}
  if (!validName(name, 32)) {
    return response.status(400).json({ error: "Enter a name between 1 and 32 characters.", code: "invalid_name" })
  }
  if (typeof password !== "string" || password.length > 72) {
    return response.status(400).json({ error: "Enter a valid password.", code: "invalid_password" })
  }
  if (room.passwordHash && !(await bcrypt.compare(password, room.passwordHash))) {
    return response.status(401).json({ error: "That password is not correct.", code: "wrong_password" })
  }

  const token = jwt.sign({ roomId: id, username: name.trim() }, jwtSecret, { expiresIn: "12h", algorithm: "HS256" })
  return response.json({ roomId: id, roomName: room.name, token })
})

app.post("/api/run", runLimiter, requireRoomToken, async (request, response) => {
  const { language, code } = request.body || {}
  if (!Object.hasOwn(judge0LanguageMatchers, language)) {
    return response.status(400).json({ error: "Choose one of the supported programming languages." })
  }
  if (typeof code !== "string") {
    return response.status(400).json({ error: "Add some code before running this program." })
  }
  if (Buffer.byteLength(code, "utf8") > maximumCodeBytes) {
    return response.status(413).json({ error: "Code must be 32 KB or smaller." })
  }

  try {
    const languageId = await getJudge0LanguageId(language)
    const submission = await requestJudge0("/submissions?base64_encoded=false&wait=false", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source_code: code, language_id: languageId }),
    })
    if (typeof submission?.token !== "string") {
      throw new RunServiceError(502, "The code execution service did not return a run identifier.")
    }

    let result
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (attempt > 0) await delay(750)
      result = await requestJudge0(`/submissions/${encodeURIComponent(submission.token)}?base64_encoded=false`)
      if (Number(result?.status?.id) > 2) break
    }
    if (Number(result?.status?.id) <= 2 || !result?.status) {
      throw new RunServiceError(504, "This run took too long. Try again with a smaller program.")
    }

    const output = [result.stdout, result.stderr, result.compile_output, result.message]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join("\n")

    return response.json({
      status: result.status.description || "Finished",
      statusId: result.status.id,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      compileOutput: result.compile_output || "",
      output: output || "Program finished without output.",
      time: result.time ?? null,
      memory: result.memory ?? null,
    })
  } catch (error) {
    if (error instanceof RunServiceError) {
      return response.status(error.status).json({ error: error.message })
    }
    throw error
  }
})

app.get("/{*path}", (request, response, next) => {
  if (request.path.startsWith("/api/") || request.path.startsWith("/socket.io/")) return next()
  response.sendFile(path.join(directory, "public", "index.html"), (error) => {
    if (error) next(error)
  })
})

app.use((error, _request, response, next) => {
  if (response.headersSent) return next(error)
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500
  if (status >= 500) console.error("Request failed:", error)
  const message = status === 413
    ? "The request body is too large."
    : status === 400
      ? "The request body is invalid."
      : "Something went wrong. Please try again."
  return response.status(status).json({ error: message })
})

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Server is running on port ${port}`)
})
