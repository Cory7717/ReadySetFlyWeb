import { useEffect } from "react";
import { ArrowDown, Download, Mail, MapPin, Send, Sparkles } from "lucide-react";
import "./CoryArmer.css";

const ONE_SHEET_PATH = "/assets/Cory_Armer_Representation_One_Sheet.pdf";
const PROFILE_IMAGE_PATH = "/downloads/cory-armer-creator-bio.png";
const CONTACT_EMAIL = "coryarmer@gmail.com";
const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Representation inquiry for Cory Armer")}`;

const momentumItems = [
  "Noise & Fury currently in early development",
  "Producer attached: Scott Rosenfelt - Home Alone, Teen Wolf, Mystic Pizza",
  "Active outreach and relationship-building with key Seattle music stakeholders",
  "Multiple completed television and feature packages",
  "Founder of Ready Set Fly, a live aviation technology platform serving the general aviation community",
];

const projects = [
  {
    title: "NOISE & FURY",
    genre: "Prestige Anthology Drama Series",
    cue: "Seattle music / legacy / addiction",
    description:
      "A character-driven anthology exploring the artists who defined a generation and the personal cost of fame, addiction, creativity, and legacy. Season One follows Layne Staley and Jerry Cantrell as Alice in Chains rises from Seattle clubs to international fame while the bond that built the band is tested by success and addiction.",
    badges: ["Pilot Complete", "Series Bible Complete", "Pitch Deck Complete", "Producer Attached", "Early Development"],
    href: "/noiseandfury",
  },
  {
    title: "GRAVESIDE",
    genre: "Drama / Mystery Series",
    cue: "Memory / death / buried history",
    description:
      "A trauma surgeon and a genealogist see death from opposite perspectives - one fights to prevent it, the other preserves its memory. Together, they uncover forgotten stories hidden within America's most historic cemeteries.",
    badges: ["Pilot Complete", "Series Bible Complete", "Season One Bible Complete", "Pitch Deck Complete"],
    href: "/graveside",
  },
  {
    title: "THE GRASP",
    genre: "Psychological Thriller / Horror Feature",
    cue: "Time / belonging / surrender",
    description:
      "Seeking freedom from a life dictated by time, Jonas and Lena relocate to the Norwegian island of Sommaroy, where clocks and schedules have been abandoned. What begins as liberation slowly reveals itself to be something far darker as they uncover the island's true reason for drawing people there.",
    badges: ["Feature Screenplay Complete", "Character Bible Complete", "Pitch Deck Complete"],
    href: "/thegrasp",
  },
  {
    title: "THE PATRIOT PROTOCOL",
    genre: "Political Action Drama Series",
    cue: "Power / systems / resistance",
    description:
      "A political conspiracy thriller centered on a decades-long plan to execute a bloodless coup against American democracy - and the covert network formed to stop it.",
    badges: ["Pilot In Progress", "Series Bible In Development"],
    href: "/patriotprotocol",
  },
];

const setMetaTag = (selector: string, attribute: "name" | "property", value: string, content: string) => {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, value);
    document.head.appendChild(tag);
  }
  const previous = tag.content;
  tag.content = content;
  return () => {
    if (previous) {
      tag.content = previous;
    } else {
      tag.remove();
    }
  };
};

function scrollToSlate() {
  document.getElementById("project-slate")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function CoryArmer() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Cory Armer | Writer & Creator Portfolio";

    const cleanups = [
      setMetaTag(
        'meta[name="description"]',
        "name",
        "description",
        "Industry-facing portfolio for writer and creator Cory Armer, featuring original television and feature projects including Noise & Fury, Graveside, The Grasp, and The Patriot Protocol.",
      ),
      setMetaTag('meta[property="og:title"]', "property", "og:title", "Cory Armer | Writer & Creator Portfolio"),
      setMetaTag(
        'meta[property="og:description"]',
        "property",
        "og:description",
        "Prestige television and elevated genre storytelling centered on legacy, identity, obsession, and the human cost of ambition.",
      ),
      setMetaTag('meta[property="og:image"]', "property", "og:image", PROFILE_IMAGE_PATH),
    ];

    return () => {
      document.title = previousTitle;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  return (
    <main className="cory-writer-page">
      <div className="cw-texture" aria-hidden="true" />

      <section className="cw-hero">
        <header className="cw-topbar">
          <a className="cw-mark" href="/coryarmer" aria-label="Cory Armer portfolio home">
            CA
          </a>
          <nav className="cw-nav" aria-label="Portfolio sections">
            <button type="button" onClick={scrollToSlate}>Slate</button>
            <a href={CONTACT_MAILTO}>Contact</a>
          </nav>
        </header>

        <div className="cw-hero-grid">
          <div className="cw-hero-copy">
            <p className="cw-kicker">Writer / Creator / Entrepreneur</p>
            <h1>CORY ARMER</h1>
            <p className="cw-role">Writer &bull; Creator &bull; Entrepreneur</p>
            <p className="cw-tagline">
              Prestige television and elevated genre storytelling centered on legacy, identity, obsession, and the human cost of ambition.
            </p>
            <p className="cw-body">
              Cory Armer is a writer and creator developing a slate of original television and feature projects spanning biographical drama,
              psychological thriller, mystery, horror, and political suspense. His work explores characters confronting forces larger than
              themselves - fame, mortality, history, obsession, and systems built to consume them.
            </p>
            <div className="cw-actions">
              <a className="cw-button cw-button-primary" href={ONE_SHEET_PATH} download>
                <Download aria-hidden="true" />
                Download One-Sheet
              </a>
              <button className="cw-button cw-button-secondary" type="button" onClick={scrollToSlate}>
                <ArrowDown aria-hidden="true" />
                View Project Slate
              </button>
            </div>
          </div>

          <figure className="cw-portrait">
            <img src={PROFILE_IMAGE_PATH} alt="Cory Armer" />
            <figcaption>
              <span>Austin, Texas</span>
              <strong>Original television and feature development</strong>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="cw-section cw-momentum">
        <div className="cw-section-heading">
          <p className="cw-kicker">Development / Packaging / Platform</p>
          <h2>Current Industry Momentum</h2>
        </div>
        <div className="cw-momentum-grid">
          {momentumItems.map((item) => (
            <article className="cw-momentum-card" key={item}>
              <Sparkles aria-hidden="true" />
              <p>{item}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cw-section cw-voice">
        <div className="cw-section-heading">
          <p className="cw-kicker">Point Of View</p>
          <h2>Writer&apos;s Voice</h2>
        </div>
        <p>
          My work explores individuals confronting forces larger than themselves - fame, mortality, obsession, history, politics, and legacy.
          Whether grounded in true events or elevated genre storytelling, my projects focus on complex characters navigating extraordinary
          circumstances while searching for identity, purpose, and connection.
        </p>
      </section>

      <section id="project-slate" className="cw-section cw-slate">
        <div className="cw-section-heading">
          <p className="cw-kicker">Original IP / Film / Television</p>
          <h2>Current Project Slate</h2>
        </div>
        <div className="cw-project-grid">
          {projects.map((project) => (
            <article className="cw-project-card" key={project.title}>
              <div>
                <p className="cw-project-cue">{project.cue}</p>
                <h3>{project.title}</h3>
                <p className="cw-project-genre">{project.genre}</p>
                <p className="cw-project-description">{project.description}</p>
              </div>
              <div className="cw-project-footer">
                <div className="cw-badges" aria-label={`${project.title} status`}>
                  {project.badges.map((badge) => (
                    <span key={badge}>{badge}</span>
                  ))}
                </div>
                <a className="cw-project-link" href={project.href}>
                  View Project
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="cw-section cw-seeking">
        <div>
          <p className="cw-kicker">Currently Seeking</p>
          <h2>Long-Term Strategic Representation</h2>
          <p>
            Cory is currently seeking literary management and long-term strategic representation focused on prestige television, elevated genre
            storytelling, and franchise-capable original intellectual property.
          </p>
        </div>
        <div className="cw-actions cw-seeking-actions">
          <a className="cw-button cw-button-primary" href={ONE_SHEET_PATH} download>
            <Download aria-hidden="true" />
            Download One-Sheet
          </a>
          <a className="cw-button cw-button-secondary" href={CONTACT_MAILTO}>
            <Send aria-hidden="true" />
            Contact Cory
          </a>
        </div>
      </section>

      <section className="cw-section cw-contact" aria-labelledby="contact-heading">
        <div className="cw-section-heading">
          <p className="cw-kicker">Contact</p>
          <h2 id="contact-heading">Cory Armer</h2>
        </div>
        <div className="cw-contact-grid">
          <div className="cw-contact-item">
            <MapPin aria-hidden="true" />
            <span>Austin, Texas</span>
          </div>
          <a className="cw-contact-item" href={CONTACT_MAILTO}>
            <Mail aria-hidden="true" />
            <span>{CONTACT_EMAIL}</span>
          </a>
          <a className="cw-contact-item" href="https://readysetfly.us" target="_blank" rel="noopener noreferrer">
            <span className="cw-contact-dot" aria-hidden="true" />
            <span>readysetfly.us</span>
          </a>
        </div>
      </section>
    </main>
  );
}
