import { createElement } from "react"
import { ArrowRight, Check, Code2, Link2, LockKeyhole, Play, Save, Users, Zap } from "lucide-react"
import { Link } from "react-router-dom"

const highlights = [
  {
    icon: Zap,
    title: "Work in the same file",
    description: "Every change appears for everyone right away. No refresh, no merge conflict.",
    className: "highlight-featured",
  },
  {
    icon: Users,
    title: "See who's doing what",
    description: "Know who's in the room and follow their cursor as they type.",
    className: "highlight-presence",
  },
  {
    icon: Play,
    title: "Run code together",
    description: "Try JavaScript, TypeScript, Python, C++, Java, or Go. Everyone sees the result.",
    className: "highlight-run",
  },
  {
    icon: LockKeyhole,
    title: "Add a room password",
    description: "Keep a private session for your team, class, or interview.",
    className: "highlight-password",
  },
  {
    icon: Link2,
    title: "Invite with a link",
    description: "Share one room link and get straight to the work.",
    className: "highlight-invite",
  },
  {
    icon: Save,
    title: "Pick up where you left off",
    description: "Your work is saved automatically, even if everyone leaves.",
    className: "highlight-save",
  },
]

const technologies = ["React", "Node.js", "WebSockets", "Yjs", "Docker", "AWS"]

function Brand() {
  return (
    <Link className="brand-link" to="/" aria-label="Pairspace home">
      <span className="brand-mark"><Code2 size={18} strokeWidth={2.2} /></span>
      <span>Pairspace</span>
    </Link>
  )
}

function EditorPreview() {
  return (
    <div className="preview-shell" aria-label="Preview of two people editing code together">
      <div className="preview-toolbar">
        <div className="preview-dots" aria-hidden="true"><i /><i /><i /></div>
        <div className="preview-file"><Code2 size={14} /> welcome.js</div>
        <div className="preview-presence"><span className="presence-dot" /> 2 online</div>
      </div>
      <div className="preview-workspace">
        <div className="preview-gutter" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => <span key={index}>{index + 1}</span>)}
        </div>
        <div className="preview-code" aria-hidden="true">
          <div className="code-line"><span className="syntax-purple">const</span> <span className="syntax-blue">room</span> = {"{"}</div>
          <div className="code-line code-indent"><span className="syntax-blue">people</span>: [</div>
          <div className="code-line code-indent-two"><span className="syntax-green">"you"</span>,</div>
          <div className="code-line code-indent-two code-typing-one">
            <span className="typing-cursor cursor-sam" />
            <span className="cursor-label label-sam">Sam</span>
            <span className="typed-text typed-text-one"><span className="syntax-green">"Alex"</span></span>
          </div>
          <div className="code-line code-indent">],</div>
          <div className="code-line code-indent"><span className="syntax-blue">workingOn</span>: <span className="syntax-green">"something great"</span>,</div>
          <div className="code-line code-indent code-typing-two">
            <span className="typing-cursor cursor-jules" />
            <span className="cursor-label label-jules">Jules</span>
            <span className="syntax-blue">together</span>: <span className="syntax-orange">true</span>
          </div>
          <div className="code-line">{"}"}</div>
          <div className="code-line">&nbsp;</div>
          <div className="preview-output"><span className="output-check">✓</span> Ready to build together</div>
        </div>
      </div>
      <div className="preview-caption">
        <span><span className="presence-dot" /> Everyone sees the same thing</span>
        <span className="preview-live"><i /> Live preview</span>
      </div>
    </div>
  )
}

function LandingPage() {
  return (
    <div className="landing-page">
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav className="header-nav" aria-label="Main navigation">
            <a className="header-github" href="https://github.com/" target="_blank" rel="noreferrer">
              <Code2 size={16} /> GitHub
            </a>
            <Link className="button button-small button-secondary" to="/access?mode=join">Open editor</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-content">
            <div className="hero-copy">
              <div className="hero-note"><span className="hero-note-dot" /> A shared space for great ideas</div>
              <h1>Write code together, <span>at the same time.</span></h1>
              <p className="hero-description">
                Bring your team into one room to build, learn, or solve a problem together. No setup, just a link.
              </p>
              <div className="hero-actions">
                <Link className="button button-primary button-large" to="/access?mode=create">
                  Create a room <ArrowRight size={17} />
                </Link>
                <Link className="button button-quiet button-large" to="/access?mode=join">Join a room</Link>
              </div>
              <div className="hero-reassurance"><Check size={15} /> Free to start <span /> Nothing to install</div>
            </div>
            <div className="hero-visual">
              <div className="preview-backdrop-line" />
              <EditorPreview />
              <div className="preview-note"><span className="note-avatar">A</span><span>Alex is editing too</span></div>
            </div>
          </div>
          <div className="hero-scroll-hint"><span /> A better way to work together</div>
        </section>

        <section className="intro-section content-width">
          <div className="intro-rule" />
          <p>Like Google Docs, <span>but for code.</span></p>
          <span className="intro-description">One shared editor, made for the moments when working together matters.</span>
        </section>

        <section className="features-section content-width" id="features">
          <div className="section-heading">
            <div>
              <p className="section-label">Made for working together</p>
              <h2>Everything in one room.</h2>
            </div>
            <p className="section-aside">Less setup. More making progress.</p>
          </div>
          <div className="feature-grid">
            {highlights.map(({ icon, title, description, className }) => (
              <article className={`highlight ${className}`} key={title}>
                <div className="highlight-icon">{createElement(icon, { size: 18, strokeWidth: 1.8 })}</div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="steps-section">
          <div className="content-width steps-inner">
            <div className="steps-heading">
              <p className="section-label">Simple from the start</p>
              <h2>Three steps.<br />Then you're building.</h2>
            </div>
            <ol className="steps-list">
              <li><span className="step-number">01</span><div><h3>Create a room</h3><p>Give it a name. Add a password if you'd like.</p></div></li>
              <li><span className="step-number">02</span><div><h3>Share the link</h3><p>Send it to anyone you'd like to work with.</p></div></li>
              <li><span className="step-number">03</span><div><h3>Code together</h3><p>Write, run, and figure things out side by side.</p></div></li>
            </ol>
          </div>
        </section>

        <section className="built-section content-width">
          <div className="built-copy">
            <p className="section-label">Thoughtfully put together</p>
            <h2>Built with tools<br />that work well together.</h2>
          </div>
          <div className="technology-list" aria-label="Technology used">
            {technologies.map((technology) => <span key={technology}>{technology}</span>)}
          </div>
        </section>

        <section className="closing-section content-width">
          <div>
            <span className="closing-icon"><Code2 size={19} /></span>
            <h2>Good work happens together.</h2>
            <p>Make a room and invite someone in.</p>
          </div>
          <Link className="button button-primary button-large" to="/access?mode=create">
            Create a room <ArrowRight size={17} />
          </Link>
        </section>
      </main>

      <footer className="site-footer">
        <div className="content-width footer-inner">
          <Brand />
          <span className="footer-credit">Made by Your Name</span>
          <div className="footer-links">
            <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer">LinkedIn</a>
            <a href="https://github.com/" target="_blank" rel="noreferrer">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
