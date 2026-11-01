import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Check, Clipboard, Code2, LockKeyhole } from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { copyText } from "./clipboard.js"

function sessionKey(roomId) {
  return `pairspace:session:${roomId}`
}

function saveRoomSession(roomId, token, username, roomName) {
  window.sessionStorage.setItem(sessionKey(roomId), JSON.stringify({ token, username, roomName }))
}

function RoomName() {
  return (
    <Link className="brand-link" to="/" aria-label="Pairspace home">
      <span className="brand-mark"><Code2 size={18} strokeWidth={2.2} /></span>
      <span>Pairspace</span>
    </Link>
  )
}

function AccessPage() {
  const [searchParams] = useSearchParams()
  const initialRoomCode = searchParams.get("room") || ""
  const requestedMode = searchParams.get("mode") === "create" ? "create" : "join"
  const [activeTab, setActiveTab] = useState(requestedMode)
  const [name, setName] = useState("")
  const [roomName, setRoomName] = useState("")
  const [roomCode, setRoomCode] = useState(initialRoomCode.toUpperCase())
  const [password, setPassword] = useState("")
  const [roomInfo, setRoomInfo] = useState(null)
  const [roomLookup, setRoomLookup] = useState("idle")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [createdRoom, setCreatedRoom] = useState(null)
  const [copyState, setCopyState] = useState("")
  const roomId = useMemo(() => roomCode.trim().toUpperCase(), [roomCode])

  useEffect(() => {
    if (!/^[A-Z0-9]{6}$/.test(roomId)) {
      setRoomInfo(null)
      setRoomLookup("idle")
      return undefined
    }

    const controller = new AbortController()
    setRoomLookup("loading")
    setRoomInfo(null)
    setPassword("")
    setError("")
    fetch(`/api/rooms/${roomId}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || "Room not found.")
        return result
      })
      .then((result) => {
        setRoomInfo(result)
        setRoomLookup("found")
      })
      .catch((lookupError) => {
        if (lookupError.name === "AbortError") return
        setRoomInfo(null)
        setRoomLookup(lookupError.message === "Room not found." ? "not-found" : "error")
      })
    return () => controller.abort()
  }, [roomId])

  function switchTab(tab) {
    setActiveTab(tab)
    setError("")
    setCreatedRoom(null)
  }

  async function handleCreate(event) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), roomName: roomName.trim(), password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "The room could not be created.")

      const inviteUrl = `${window.location.origin}/room/${result.roomId}`
      saveRoomSession(result.roomId, result.token, name.trim(), result.roomName)
      setCreatedRoom({ ...result, inviteUrl })
    } catch (createError) {
      setError(createError.message || "The room could not be created. Try again.")
    } finally {
      setPending(false)
    }
  }

  async function handleJoin(event) {
    event.preventDefault()
    setPending(true)
    setError("")
    try {
      const response = await fetch(`/api/rooms/${roomId}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), ...(roomInfo?.hasPassword ? { password } : {}) }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "You could not join this room.")
      saveRoomSession(result.roomId, result.token, name.trim(), result.roomName)
      window.location.assign(`/room/${result.roomId}`)
    } catch (joinError) {
      setError(joinError.message || "You could not join this room. Try again.")
    } finally {
      setPending(false)
    }
  }

  async function handleCopyInvite() {
    try {
      await copyText(createdRoom.inviteUrl)
      setCopyState("Copied")
    } catch (copyError) {
      setCopyState(copyError.message)
    }
  }

  const formDisabled = pending
  const roomCodeStatus = roomLookup === "loading"
    ? "Checking room…"
    : roomLookup === "found"
      ? roomInfo?.hasPassword ? "Password-protected room" : "Room is ready to join"
      : roomLookup === "not-found"
        ? "No room found with that code."
        : roomLookup === "error"
          ? "Could not check the room. Try again."
          : "Enter the 6-character code from your invite."

  return (
    <main className="access-page">
      <div className="access-topbar">
        <RoomName />
        <Link className="back-home-link" to="/"><ArrowLeft size={15} /> Home</Link>
      </div>
      <section className="access-layout" aria-labelledby="access-heading">
        <div className="access-intro">
          <p className="section-label">A little closer to the work</p>
          <h1 id="access-heading">Make space<br />to build together.</h1>
          <p>Start a new room or join someone who has already invited you.</p>
        </div>

        <div className="access-card">
          <div className="access-tabs" role="tablist" aria-label="Room options">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "create"}
              className={activeTab === "create" ? "access-tab active" : "access-tab"}
              onClick={() => switchTab("create")}
            >Create a room</button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "join"}
              className={activeTab === "join" ? "access-tab active" : "access-tab"}
              onClick={() => switchTab("join")}
            >Join a room</button>
          </div>

          {activeTab === "create" && !createdRoom && (
            <form className="access-form" onSubmit={handleCreate}>
              <div className="access-form-heading">
                <h2>Create a new room</h2>
                <p>A few details, then you can invite your team.</p>
              </div>
              <label className="field-label" htmlFor="create-name">Your name</label>
              <input
                autoComplete="name"
                id="create-name"
                maxLength={32}
                name="name"
                onChange={(event) => setName(event.target.value)}
                placeholder="How should others know you?"
                required
                value={name}
              />
              <label className="field-label" htmlFor="create-room-name">Room name <span>Optional</span></label>
              <input
                id="create-room-name"
                maxLength={60}
                onChange={(event) => setRoomName(event.target.value)}
                placeholder="e.g. Friday pairing session"
                value={roomName}
              />
              <label className="field-label" htmlFor="create-password">Room password <span>Optional</span></label>
              <div className="input-with-icon">
                <LockKeyhole size={16} aria-hidden="true" />
                <input
                  autoComplete="new-password"
                  id="create-password"
                  maxLength={72}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Add one for a private room"
                  type="password"
                  value={password}
                />
              </div>
              {error && <p className="form-message form-error" role="alert">{error}</p>}
              <button className="button button-primary access-submit" disabled={formDisabled} type="submit">
                {pending ? "Creating room…" : "Create room"}
              </button>
              <p className="form-footnote">Anyone with the invite link can join unless you add a password.</p>
            </form>
          )}

          {activeTab === "join" && (
            <form className="access-form" onSubmit={handleJoin}>
              <div className="access-form-heading">
                <h2>Join a room</h2>
                <p>Enter the code your teammate shared with you.</p>
              </div>
              <label className="field-label" htmlFor="join-name">Your name</label>
              <input
                autoComplete="name"
                id="join-name"
                maxLength={32}
                onChange={(event) => setName(event.target.value)}
                placeholder="How should others know you?"
                required
                value={name}
              />
              <label className="field-label" htmlFor="room-code">Room code</label>
              <input
                autoCapitalize="characters"
                autoComplete="off"
                className="room-code-input"
                id="room-code"
                maxLength={6}
                onChange={(event) => {
                  setRoomCode(event.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase())
                  setError("")
                }}
                placeholder="ABC123"
                required
                spellCheck="false"
                value={roomCode}
              />
              <p className={`room-lookup-status ${roomLookup}`} aria-live="polite">
                {roomInfo?.hasPassword && <LockKeyhole size={14} />}
                {roomCodeStatus}
              </p>
              {roomLookup === "found" && roomInfo?.hasPassword && (
                <>
                  <label className="field-label" htmlFor="join-password">Room password</label>
                  <div className="input-with-icon">
                    <LockKeyhole size={16} aria-hidden="true" />
                    <input
                      autoComplete="current-password"
                      id="join-password"
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Enter the room password"
                      required
                      type="password"
                      value={password}
                    />
                  </div>
                </>
              )}
              {error && <p className="form-message form-error" role="alert">{error}</p>}
              <button
                className="button button-primary access-submit"
                disabled={formDisabled || roomLookup !== "found"}
                type="submit"
              >{pending ? "Joining room…" : "Join room"}</button>
            </form>
          )}

          {activeTab === "create" && createdRoom && (
            <div className="created-room-result" aria-live="polite">
              <div className="created-success-icon"><Check size={18} /></div>
              <h2>Your room is ready.</h2>
              <p>Share this link with anyone you'd like to work with.</p>
              <span className="field-label">Room code</span>
              <div className="created-room-code">{createdRoom.roomId}</div>
              <span className="field-label">Invite link</span>
              <div className="invite-link-box">
                <span>{createdRoom.inviteUrl}</span>
                <button aria-label="Copy invite link" className="icon-button" onClick={handleCopyInvite} type="button">
                  {copyState === "Copied" ? <Check size={16} /> : <Clipboard size={16} />}
                </button>
              </div>
              {copyState && <p className={copyState === "Copied" ? "copy-feedback" : "form-message form-error"} role="status">{copyState}</p>}
              <Link className="button button-primary access-submit enter-room-button" to={`/room/${createdRoom.roomId}`}>
                Open your room
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

export default AccessPage
