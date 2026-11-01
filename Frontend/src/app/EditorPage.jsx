import { useEffect, useMemo, useRef, useState } from "react"
import { Editor } from "@monaco-editor/react"
import { MonacoBinding } from "y-monaco"
import * as Y from "yjs"
import { SocketIOProvider } from "y-socket.io"
import {
  Check,
  ChevronDown,
  Clipboard,
  Code2,
  LoaderCircle,
  PanelBottom,
  Play,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { copyText } from "./clipboard.js"

const languages = [
  { id: "javascript", name: "JavaScript" },
  { id: "typescript", name: "TypeScript" },
  { id: "python", name: "Python" },
  { id: "cpp", name: "C++" },
  { id: "java", name: "Java" },
  { id: "go", name: "Go" },
]

const participantColors = ["#e6a184", "#81b8e9", "#c5a1e5", "#9dca82", "#e4c271", "#e78fa4"]
const languageNames = Object.fromEntries(languages.map(({ id, name }) => [id, name]))

function getRoomSession(roomId) {
  try {
    const stored = window.sessionStorage.getItem(`pairspace:session:${roomId}`)
    if (!stored) return null
    const value = JSON.parse(stored)
    if (typeof value.token !== "string" || typeof value.username !== "string") return null
    return value
  } catch {
    return null
  }
}

function getInitials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
}

function safeCursorStyles(users, localClientId) {
  return users
    .filter((user) => Number.isInteger(user.clientId) && user.clientId !== localClientId)
    .map((user) => {
      const color = /^#[\da-f]{6}$/i.test(user.color) ? user.color : "#91a4ba"
      const cleanName = Array.from(user.name)
        .filter((character) => {
          const code = character.codePointAt(0)
          return code >= 32 && code !== 127
        })
        .join("")
        .slice(0, 32)
      const label = JSON.stringify(cleanName)
      return `
        .yRemoteSelection-${user.clientId} { background-color: ${color}38 !important; }
        .yRemoteSelectionHead-${user.clientId} {
          position: relative;
          border-left: 2px solid ${color} !important;
        }
        .yRemoteSelectionHead-${user.clientId}::after {
          position: absolute;
          top: -19px;
          left: -2px;
          padding: 3px 6px;
          border-radius: 4px;
          color: #111316;
          background: ${color};
          content: ${label};
          font: 10px/1.2 Inter, "Segoe UI", sans-serif;
          white-space: nowrap;
        }
      `
    })
    .join("\n")
}

function EditorPage() {
  const { roomId = "" } = useParams()
  const navigate = useNavigate()
  const session = useMemo(() => getRoomSession(roomId), [roomId])
  const ydoc = useMemo(() => new Y.Doc(), [])
  const text = useMemo(() => ydoc.getText("monaco"), [ydoc])
  const settings = useMemo(() => ydoc.getMap("settings"), [ydoc])
  const runState = useMemo(() => ydoc.getMap("run"), [ydoc])
  const editorRef = useRef(null)
  const [editorModel, setEditorModel] = useState(null)
  const [monacoApi, setMonacoApi] = useState(null)
  const [provider, setProvider] = useState(null)
  const [users, setUsers] = useState([])
  const [language, setLanguage] = useState("javascript")
  const [connection, setConnection] = useState("connecting")
  const [connectionError, setConnectionError] = useState("")
  const [showCursors, setShowCursors] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const [outputOpen, setOutputOpen] = useState(false)
  const [copyState, setCopyState] = useState("")
  const [runResult, setRunResult] = useState(null)
  const [runPending, setRunPending] = useState(false)
  const roomName = session?.roomName || `Room ${roomId}`
  const cursorStyles = useMemo(
    () => safeCursorStyles(users, provider?.awareness.clientID),
    [users, provider],
  )

  useEffect(() => {
    if (!session) navigate(`/access?mode=join&room=${roomId}`, { replace: true })
  }, [navigate, roomId, session])

  useEffect(() => {
    if (!session) return undefined

    const nextProvider = new SocketIOProvider(window.location.origin, roomId, ydoc, {
      autoConnect: false,
      auth: { token: session.token, roomId, clientId: ydoc.clientID },
    })
    const colorIndex = Math.floor(Math.random() * participantColors.length)
    const user = {
      name: session.username,
      color: participantColors[colorIndex],
      userId: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }
    const updateUsers = () => {
      const participants = Array.from(nextProvider.awareness.getStates(), ([clientId, state]) => {
        if (!state.user || typeof state.user.name !== "string") return null
        return {
          clientId,
          name: state.user.name,
          color: state.user.color,
          userId: state.user.userId,
        }
      }).filter(Boolean)
      setUsers(participants)
    }
    const handleConnect = () => {
      setConnection("connected")
      setConnectionError("")
    }
    const handleDisconnect = () => setConnection("disconnected")
    const handleConnectError = (error) => {
      setConnection("disconnected")
      setConnectionError(error.message === "Unauthorized room connection."
        ? "Your room access has expired. Join again to reconnect."
        : "Could not connect to this room. Check your connection and try again.")
    }
    const syncLanguage = () => {
      const sharedLanguage = settings.get("language")
      if (languages.some((option) => option.id === sharedLanguage)) setLanguage(sharedLanguage)
    }
    const clearPresence = () => nextProvider.awareness.setLocalState(null)

    nextProvider.awareness.setLocalStateField("user", user)
    nextProvider.awareness.on("change", updateUsers)
    nextProvider.socket.on("connect", handleConnect)
    nextProvider.socket.on("disconnect", handleDisconnect)
    nextProvider.socket.on("connect_error", handleConnectError)
    settings.observe(syncLanguage)
    if (!settings.has("language")) settings.set("language", "javascript")
    syncLanguage()
    updateUsers()
    window.addEventListener("beforeunload", clearPresence)
    window.addEventListener("pagehide", clearPresence)
    setProvider(nextProvider)
    setConnection("connecting")
    nextProvider.connect()

    return () => {
      window.removeEventListener("beforeunload", clearPresence)
      window.removeEventListener("pagehide", clearPresence)
      nextProvider.awareness.setLocalState(null)
      nextProvider.awareness.off("change", updateUsers)
      nextProvider.socket.off("connect", handleConnect)
      nextProvider.socket.off("disconnect", handleDisconnect)
      nextProvider.socket.off("connect_error", handleConnectError)
      settings.unobserve(syncLanguage)
      nextProvider.destroy()
    }
  }, [roomId, session, settings, ydoc])

  useEffect(() => {
    if (!editorRef.current || !editorModel || !provider) return undefined
    const binding = new MonacoBinding(text, editorModel, new Set([editorRef.current]), provider.awareness)
    return () => binding.destroy()
  }, [editorModel, provider, text])

  useEffect(() => {
    const editor = editorRef.current
    if (!editorModel || !editor) return undefined
    const layoutEditor = () => editor.layout()
    layoutEditor()
    window.addEventListener("resize", layoutEditor)
    return () => window.removeEventListener("resize", layoutEditor)
  }, [editorModel])

  useEffect(() => {
    if (editorModel && monacoApi) monacoApi.editor.setModelLanguage(editorModel, language)
  }, [editorModel, language, monacoApi])

  useEffect(() => {
    const updateRunResult = () => {
      const result = runState.get("last") || null
      setRunResult(result)
      if (result) setOutputOpen(true)
    }
    runState.observe(updateRunResult)
    updateRunResult()
    return () => runState.unobserve(updateRunResult)
  }, [runState])

  async function handleCopyInvite() {
    try {
      await copyText(`${window.location.origin}/room/${roomId}`)
      setCopyState("Copied")
    } catch (error) {
      setCopyState(error.message)
    }
  }

  function handleLanguageChange(event) {
    const nextLanguage = event.target.value
    setLanguage(nextLanguage)
    settings.set("language", nextLanguage)
  }

  function handleEditorMount(editor, monaco) {
    editorRef.current = editor
    setEditorModel(editor.getModel())
    setMonacoApi(monaco)
  }

  async function handleRun() {
    const startedAt = new Date().toISOString()
    setRunPending(true)
    setOutputOpen(true)
    runState.set("last", {
      user: session.username,
      language,
      status: "Running",
      time: null,
      memory: null,
      output: "Running your code...",
      completedAt: startedAt,
    })

    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ language, code: text.toString() }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "This program could not be run.")
      runState.set("last", {
        user: session.username,
        language,
        status: result.status,
        time: result.time,
        memory: result.memory,
        output: result.output,
        completedAt: new Date().toISOString(),
      })
    } catch (error) {
      runState.set("last", {
        user: session.username,
        language,
        status: "Error",
        time: null,
        memory: null,
        output: error.message || "This program could not be run.",
        completedAt: new Date().toISOString(),
      })
    } finally {
      setRunPending(false)
    }
  }

  if (!session) {
    return <main className="editor-loading" role="status"><LoaderCircle size={18} /> Opening room…</main>
  }

  const connectionLabel = connection === "connected"
    ? "Connected"
    : connection === "connecting"
      ? "Connecting"
      : "Disconnected"

  return (
    <main className="editor-page">
      <header className="editor-topbar">
        <div className="editor-brand-area">
          <Link className="brand-link" to="/" aria-label="Pairspace home">
            <span className="brand-mark"><Code2 size={17} /></span>
          </Link>
          <span className="editor-divider" aria-hidden="true" />
          <div className="room-title">
            <strong>{roomName}</strong>
            <span className="room-code-label">{roomId}</span>
          </div>
          <button className="copy-invite-button" onClick={handleCopyInvite} type="button">
            {copyState === "Copied" ? <Check size={14} /> : <Clipboard size={14} />}
            <span>{copyState === "Copied" ? "Copied" : "Invite"}</span>
          </button>
          {copyState && copyState !== "Copied" && <span className="copy-error" role="status">{copyState}</span>}
        </div>

        <div className="editor-toolbar">
          <div className="participants">
            <button
              aria-expanded={usersOpen}
              aria-label={`${users.length} people in room`}
              className="participants-button"
              onClick={() => setUsersOpen((open) => !open)}
              type="button"
            >
              <span className="avatar-stack" aria-hidden="true">
                {users.slice(0, 3).map((user) => (
                  <span
                    className="participant-avatar"
                    key={user.clientId}
                    style={{ "--participant-color": user.color }}
                    title={user.name}
                  >{getInitials(user.name)}</span>
                ))}
                {users.length === 0 && <span className="participant-avatar avatar-placeholder"><Users size={13} /></span>}
              </span>
              <span className="participant-count">{users.length}</span>
              <ChevronDown size={13} />
            </button>
            {usersOpen && (
              <div className="participants-popover" role="dialog" aria-label="People in this room">
                <div className="popover-heading">
                  <strong>People here</strong>
                  <button className="popover-close" aria-label="Close people list" onClick={() => setUsersOpen(false)} type="button"><X size={15} /></button>
                </div>
                {users.length === 0 ? (
                  <p className="empty-participants">Waiting for people to join…</p>
                ) : (
                  <ul>
                    {users.map((user) => (
                      <li key={user.clientId}>
                        <span className="participant-avatar" style={{ "--participant-color": user.color }}>{getInitials(user.name)}</span>
                        <span>{user.name}{user.userId === users.find((person) => person.clientId === provider?.awareness.clientID)?.userId ? " (you)" : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <label className="language-control">
            <span className="visually-hidden">Programming language</span>
            <select aria-label="Programming language" onChange={handleLanguageChange} value={language}>
              {languages.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <ChevronDown size={13} aria-hidden="true" />
          </label>
          <button className="button button-primary run-button" disabled={runPending} onClick={handleRun} type="button">
            {runPending ? <LoaderCircle className="connection-spinner" size={14} /> : <Play size={14} fill="currentColor" />}
            {runPending ? "Running" : "Run"}
          </button>
          <div className={`connection-indicator connection-${connection}`} aria-live="polite">
            {connection === "connected"
              ? <Wifi size={14} />
              : connection === "connecting"
                ? <LoaderCircle className="connection-spinner" size={14} />
                : <WifiOff size={14} />}
            <span>{connectionLabel}</span>
          </div>
        </div>
      </header>

      <div className="editor-secondary-bar">
        <label className="cursor-toggle">
          <input checked={showCursors} onChange={(event) => setShowCursors(event.target.checked)} type="checkbox" />
          <span className="toggle-track" aria-hidden="true"><span /></span>
          <span>Show collaborators' cursors</span>
        </label>
        <div className="editor-secondary-actions">
          <span className="editor-file-label"><Code2 size={13} /> main.{language === "python" ? "py" : language === "java" ? "java" : language === "go" ? "go" : language === "cpp" ? "cpp" : language === "typescript" ? "ts" : "js"}</span>
          <button
            aria-expanded={outputOpen}
            aria-label={`${outputOpen ? "Hide" : "Show"} output panel`}
            className="output-toggle"
            onClick={() => setOutputOpen((open) => !open)}
            type="button"
          ><PanelBottom size={13} /><span>Output</span>{runResult && <i aria-hidden="true" />}</button>
        </div>
      </div>

      {connectionError && (
        <div className="connection-message" role="alert">
          <span>{connectionError}</span>
          <Link to={`/access?mode=join&room=${roomId}`}>Join this room again</Link>
        </div>
      )}

      <section className="editor-workspace" aria-label="Shared code editor">
        <div className={`editor-canvas${showCursors ? "" : " hide-other-cursors"}`}>
          <style>{cursorStyles}</style>
          <Editor
            defaultLanguage={language}
            defaultValue=""
            height="100%"
            loading={<div className="editor-loading"><LoaderCircle size={17} /> Loading editor…</div>}
            onMount={handleEditorMount}
            options={{
              automaticLayout: true,
              fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
              fontSize: 13,
              lineHeight: 22,
              minimap: { enabled: false },
              padding: { top: 17, bottom: 17 },
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              wordWrap: "on",
            }}
            theme="vs-dark"
          />
        </div>
        {outputOpen && (
          <>
            <button aria-label="Close output panel" className="output-backdrop" onClick={() => setOutputOpen(false)} type="button" />
            <section aria-label="Program output" className="output-panel">
            <div className="output-panel-header">
              <div><PanelBottom size={15} /><strong>Output</strong></div>
              <button aria-label="Close output" className="popover-close" onClick={() => setOutputOpen(false)} type="button"><X size={16} /></button>
            </div>
            <div className={runResult ? "output-result-container" : "output-empty"}>
              {runResult ? (
                <div className={`run-result run-result-${runResult.status === "Accepted" ? "success" : runResult.status === "Running" ? "running" : "error"}`}>
                  <div className="run-result-heading">
                    <span className="run-status">{runResult.status}</span>
                    <span>{runResult.user} ran {languageNames[runResult.language] || runResult.language}</span>
                    <time dateTime={runResult.completedAt}>
                      {new Date(runResult.completedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </time>
                  </div>
                  <pre>{runResult.output}</pre>
                  {runResult.status !== "Running" && (
                    <div className="run-result-metrics">
                      <span>Time {runResult.time == null ? "n/a" : `${runResult.time}s`}</span>
                      <span>Memory {runResult.memory == null ? "n/a" : `${runResult.memory} KB`}</span>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Play size={17} />
                  <p>Run your code to see the result here.</p>
                </>
              )}
            </div>
            </section>
          </>
        )}
      </section>
    </main>
  )
}

export default EditorPage
