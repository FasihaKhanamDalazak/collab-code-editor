import { lazy, Suspense } from "react"
import { Link, Route, Routes, useParams } from "react-router-dom"
import LandingPage from "./LandingPage.jsx"
import AccessPage from "./AccessPage.jsx"
import "./App.css"

const EditorPage = lazy(() => import("./EditorPage.jsx"))

function RoomRoute() {
  const { roomId } = useParams()
  return (
    <Suspense fallback={<main className="editor-loading" role="status">Loading room…</main>}>
      <EditorPage key={roomId} />
    </Suspense>
  )
}

function NotFound() {
  return (
    <main className="not-found-page">
      <div>
        <h1>Page not found</h1>
        <Link className="button button-primary" to="/">Go home</Link>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/access" element={<AccessPage />} />
      <Route path="/room/:roomId" element={<RoomRoute />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
