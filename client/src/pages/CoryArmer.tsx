import { useEffect, useState } from "react";
import "./CoryArmer.css";

const RESUME_PATH = "/assets/coryarmer_resume.pdf";
const PROFILE_IMAGE_PATH = "/downloads/noise-and-fury-cory.jpg";

const pillars = [
  {
    label: "PILLAR 01",
    accent: "teal",
    icon: "ops",
    heading: "Operations & Leadership",
    body:
      "15+ years leading branded hospitality operations across Marriott, IHG, and Hyatt assets, with multi-property responsibility, P&L ownership, revenue strategy, owner relations, and team development.",
    stat: "15+",
    statLabel: "YRS EXPERIENCE",
  },
  {
    label: "PILLAR 02",
    accent: "amber",
    icon: "plane",
    heading: "Founder, Ready Set Fly",
    body:
      "Full-stack SaaS for general aviation pilots built across React, React Native, Node.js, and modern cloud tooling. Pre-seed raise in market with commercial launch targeting Q2 2026.",
    stat: "2020",
    statLabel: "FOUNDED",
  },
  {
    label: "PILLAR 03",
    accent: "gold",
    icon: "wave",
    heading: "Creator, Noise & Fury",
    body:
      "8-episode prestige biographical drama set inside the Alice in Chains and Seattle grunge era. WGA registered with producer Scott Rosenfelt attached.",
    stat: "WGA",
    statLabel: "REGISTERED",
  },
];

const timeline = [
  {
    role: "Founder & CEO",
    company: "Ready Set Fly",
    date: "2020-Present",
    accent: "teal",
    detail:
      "Built RSF from concept into a full-stack aviation platform spanning planning, mobile flight tools, marketplace workflows, and investor-ready SaaS infrastructure.",
    expanded: [
      "Translated real pilot workflow gaps into product requirements across planning, mobile flight tools, marketplace operations, subscriptions, payments, and account systems.",
      "Built and coordinated the product roadmap across web, mobile, backend, investor materials, release readiness, and go-to-market priorities.",
      "Balanced technical execution with business development, customer discovery, fundraising preparation, and strategic partnership conversations.",
    ],
  },
  {
    role: "Creator & Lead Writer",
    company: "Noise & Fury",
    date: "Jan 2025-Present",
    accent: "gold",
    detail:
      "Created and developed a WGA-registered prestige television series with season architecture, scripts, investor materials, and producer attachment momentum.",
    expanded: [
      "Developed the original creative concept, season structure, series bible, episode architecture, scripts, and investor-facing materials.",
      "Positioned the project for serious packaging conversations with emphasis on creative quality, market credibility, and the right producing attachments.",
      "Managed the project like a professional IP asset, connecting writing, development, investor presentation, and industry outreach.",
    ],
  },
  {
    role: "General Manager",
    company: "Hyatt Place Austin Lake Travis",
    date: "2023-2024",
    accent: "amber",
    detail:
      "Led property operations, commercial execution, guest experience, team development, budget controls, and owner-facing performance management.",
    expanded: [
      "Directed daily hotel operations across staffing, service standards, revenue execution, expense discipline, and guest satisfaction.",
      "Partnered with ownership and commercial stakeholders on performance, forecasting, operational priorities, and market positioning.",
      "Led team development, accountability systems, and property-level execution through high-pressure operating environments.",
    ],
  },
  {
    role: "Dual General Manager",
    company: "Fairfield Austin NW / Staybridge Suites Austin NW",
    date: "2019-2023",
    accent: "amber",
    detail:
      "Managed dual branded assets with responsibility for operations, sales alignment, labor strategy, revenue performance, and cross-property leadership.",
    expanded: [
      "Oversaw two branded properties simultaneously, aligning operating standards, leadership cadence, staffing plans, and commercial priorities.",
      "Managed cross-property communication between sales, operations, ownership, and brand expectations.",
      "Drove performance through revenue awareness, cost control, process consistency, and manager development across both assets.",
    ],
  },
  {
    role: "Area General Manager",
    company: "Holiday Inn Express / Days Inn / Best Western",
    date: "2013-2018",
    accent: "amber",
    detail:
      "Oversaw multi-property hotel operations with direct accountability for team performance, owner relations, cost control, and operational recovery.",
    expanded: [
      "Managed multi-property operations across varied brand environments with responsibility for staffing, service recovery, cost controls, and owner communication.",
      "Built operational discipline across teams by standardizing expectations, improving accountability, and tightening daily execution.",
      "Led through turnaround and stabilization needs while maintaining guest experience and property-level financial focus.",
    ],
  },
];

const skillGroups = [
  {
    title: "Operations",
    skills: [
      "P&L Management",
      "Revenue Strategy",
      "Budget & Cost Control",
      "Business Development",
      "Owner Relations",
      "Multi-Unit Ops",
      "Team Leadership",
      "Forecasting",
      "Process Optimization",
    ],
  },
  {
    title: "Technical",
    skills: [
      "JavaScript",
      "React",
      "React Native",
      "TypeScript",
      "Node.js / Express",
      "Supabase",
      "Firebase",
      "GitHub",
      "Stripe",
      "REST APIs",
      "Expo",
      "Full-Stack Architecture",
    ],
  },
  {
    title: "Creative & Additional",
    skills: [
      "TV Writing & Development",
      "WGA Registration",
      "Series Bible",
      "Pitch Materials",
      "Film & IP Development",
      "Private Pilot (PPL) In Progress",
      "Aviation",
    ],
  },
];

function Icon({ type }: { type: string }) {
  if (type === "plane") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M58 30.5 36.7 23 28 6h-5l4 19.5-16 3.8-5-6.2H2l4.5 9L2 41h4l5-6.2 16 3.8-4 19.4h5l8.7-17L58 33.5c2.7-.9 2.7-2.1 0-3Z" />
      </svg>
    );
  }

  if (type === "wave") {
    return (
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <path d="M8 40h6V24H8v16Zm10 8h6V16h-6v32Zm10-12h6V28h-6v8Zm10 16h6V12h-6v40Zm10-8h6V20h-6v24Z" />
        <circle cx="32" cy="32" r="28" fill="none" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <path d="M10 54V12h44v42H10Zm8-8h8v-8h-8v8Zm0-14h8v-8h-8v8Zm0-14h8v-2h-8v2Zm14 28h14v-8H32v8Zm0-14h14v-8H32v8Zm0-14h14v-2H32v2Z" />
    </svg>
  );
}

export default function CoryArmer() {
  const [openExperienceKeys, setOpenExperienceKeys] = useState<string[]>([]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "Cory Armer - Operations Leader | Founder | Creator";

    const fontId = "cory-armer-fonts";
    if (!document.getElementById(fontId)) {
      const fontLink = document.createElement("link");
      fontLink.id = fontId;
      fontLink.rel = "stylesheet";
      fontLink.href = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@400&family=Rajdhani:wght@500;600;700&display=swap";
      document.head.appendChild(fontLink);
    }

    let description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content;
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    description.content =
      "Senior operations and business development leader. Founder of Ready Set Fly. Creator of Noise & Fury. Based in Austin, TX.";

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("ca-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 },
    );

    document.querySelectorAll(".ca-reveal").forEach((element) => observer.observe(element));

    return () => {
      document.title = previousTitle;
      if (description && previousDescription !== undefined) {
        description.content = previousDescription;
      }
      observer.disconnect();
    };
  }, []);

  const scrollToContact = () => {
    document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleExperience = (key: string) => {
    setOpenExperienceKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  return (
    <main className="cory-armer-page">
      <div className="ca-scanlines" aria-hidden="true" />

      <section className="ca-hero">
        <div className="ca-hero-copy ca-reveal">
          <div className="ca-kicker">COMMAND PROFILE // CORY ARMER // KAUS</div>
          <h1>CORY ARMER</h1>
          <div className="ca-title-line">EXECUTIVE OPS & BIZ DEV LEADER // FOUNDER, READY SET FLY // CREATOR, NOISE & FURY</div>
          <div className="ca-rule" />
          <p>
            Senior operations and business development leader with 15+ years leading branded hospitality assets, multi-property teams, P&amp;L
            performance, revenue strategy, owner relations, and operational execution. Founder of Ready Set Fly, built from concept into a real
            full-stack general aviation platform, and creator of Noise &amp; Fury, a WGA-registered prestige series with producer attachment momentum.
            My work sits at the intersection of disciplined operations, entrepreneurial execution, product building, and creative leadership.
          </p>
          <div className="ca-hero-actions">
            <a className="ca-button ca-button-primary" href={RESUME_PATH} download>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 20h14" />
              </svg>
              DOWNLOAD RESUME
            </a>
            <button className="ca-button ca-button-secondary" type="button" onClick={scrollToContact}>
              GET IN TOUCH
            </button>
          </div>
        </div>

        <div className="ca-hero-portrait ca-reveal" style={{ animationDelay: "120ms" }}>
          <div className="ca-portrait-frame">
            <img src={PROFILE_IMAGE_PATH} alt="Cory Armer" />
            <div className="ca-portrait-readout">
              <span>READY SET FLY // NOISE & FURY</span>
              <strong>OPERATOR // FOUNDER // CREATIVE LEAD</strong>
            </div>
          </div>
        </div>

        <svg className="ca-compass" viewBox="0 0 500 500" aria-hidden="true">
          <circle cx="250" cy="250" r="210" />
          <circle cx="250" cy="250" r="146" />
          <path d="M250 32v84M250 384v84M32 250h84M384 250h84M250 132l44 118-44 118-44-118 44-118Z" />
        </svg>
      </section>

      <section className="ca-section ca-reveal">
        <div className="ca-section-label">INSTRUMENT PANEL</div>
        <div className="ca-pillars">
          {pillars.map((pillar, index) => (
            <article className={`ca-panel ca-pillar ca-accent-${pillar.accent} ca-reveal`} key={pillar.heading} style={{ animationDelay: `${index * 80}ms` }}>
              <div className="ca-pillar-top">
                <span>{pillar.label}</span>
                <div className="ca-icon">
                  <Icon type={pillar.icon} />
                </div>
              </div>
              <h2>{pillar.heading}</h2>
              <p>{pillar.body}</p>
              <div className="ca-stat">
                <strong>{pillar.stat}</strong>
                <span>{pillar.statLabel}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="ca-section ca-reveal">
        <div className="ca-section-label">FLIGHT LOG</div>
        <h2 className="ca-section-heading">Professional Experience</h2>
        <div className="ca-timeline">
          {timeline.map((item, index) => {
            const experienceKey = `${item.company}-${item.date}`;
            const isOpen = openExperienceKeys.includes(experienceKey);
            const expandedState = isOpen ? "true" : "false";

            return (
              <article className={`ca-timeline-entry ca-dot-${item.accent} ${isOpen ? "ca-entry-open" : ""}`} key={experienceKey} style={{ animationDelay: `${index * 80}ms` }}>
                <button
                  type="button"
                  className="ca-timeline-trigger"
                  {...{ "aria-expanded": expandedState, "aria-controls": `experience-${index}` }}
                  onClick={() => toggleExperience(experienceKey)}
                >
                  <div className="ca-date">{item.date}</div>
                  <div className="ca-timeline-heading-row">
                    <h3>{item.company}</h3>
                    <span className="ca-expand-indicator" aria-hidden="true">{isOpen ? "-" : "+"}</span>
                  </div>
                  <div className="ca-role">{item.role}</div>
                  <p>{item.detail}</p>
                </button>

                {isOpen ? (
                  <div id={`experience-${index}`} className="ca-experience-details">
                    <div className="ca-experience-label">Expanded experience</div>
                    <ul>
                      {item.expanded.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      <section className="ca-section ca-reveal">
        <div className="ca-section-label">SYSTEMS CHECK</div>
        <div className="ca-skills">
          {skillGroups.map((group, groupIndex) => (
            <article className="ca-panel ca-skill-column ca-reveal" key={group.title} style={{ animationDelay: `${groupIndex * 80}ms` }}>
              <h2>{group.title}</h2>
              <div className="ca-tags">
                {group.skills.map((skill, skillIndex) => (
                  <span className="ca-tag" key={skill} style={{ animationDelay: `${skillIndex * 80}ms` }}>
                    {skill}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="contact" className="ca-contact ca-reveal">
        <div className="ca-section-label">CONTACT</div>
        <h2>LET&apos;S CONNECT</h2>
        <p>
          Open to senior business development and operations leadership roles in aviation technology, hospitality tech, media &amp;
          entertainment, or growth-stage companies.
        </p>
        <a className="ca-email-button" href="mailto:coryarmer@gmail.com">
          EMAIL CORY
        </a>
        <div className="ca-contact-links">
          <span>coryarmer@gmail.com</span>
          <a href="https://www.linkedin.com/in/cory-armer" target="_blank" rel="noopener">
            linkedin.com/in/cory-armer
          </a>
        </div>
      </section>

      <footer className="ca-footer">CORY ARMER // PFLUGERVILLE, TX // KAUS // © 2026</footer>
    </main>
  );
}
