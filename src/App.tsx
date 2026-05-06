import { useEffect, useState } from "react";
import Logo from "./components/Logo";
import TopNav from "./components/TopNav";
import Hero from "./components/Hero";
import Prefinal from "./components/Prefinal";
import Projects from "./components/Projects";
import Footer from "./components/Footer";
import Grain from "./components/Grain";
import { attachScrollProgress } from "./lib/scrollProgress";
import { attachLightProbe } from "./lib/lightProbe";
import { detectInitialDpr } from "./lib/renderQuality";
import "./App.css";

function App() {
  // Quality detected once at boot from cores + devicePixelRatio. Slider
  // removed — auto-tuned, no UI knob.
  const [dpr] = useState<number>(() => detectInitialDpr());

  useEffect(() => {
    attachScrollProgress();
    attachLightProbe();
  }, []);

  // URL-bar edits (e.g. user manually deletes the `#about` from the URL)
  // fire `hashchange` but the browser doesn't auto-scroll for in-page
  // hash changes — only on initial load. Listen and scroll the document
  // to match: empty hash → top, `#id` → element. Pure hash navigation
  // via <a href="#id"> is handled natively by the browser; this only
  // catches the URL-bar case.
  useEffect(() => {
    const onHashChange = () => {
      const id = window.location.hash.slice(1);
      const el = id ? document.getElementById(id) : null;
      // Direct scrollTop assignment to bypass `scroll-behavior: smooth`
      // — a smooth scroll across the full document height races with
      // mandatory scroll-snap and lands mid-animation.
      document.documentElement.scrollTop = el ? el.offsetTop : 0;
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <>
      {/* Two independent fixed elements (left = logo, right = nav).
          See `.topbar-left` / `.topbar-right` in App.css for why this
          replaced the single full-width .topbar wrapper. */}
      <div className="topbar-left">
        <Logo />
      </div>
      <nav className="topbar-right">
        <TopNav />
      </nav>
      <main className="page">
        <section className="page__section page__section--hero">
          <Hero dpr={dpr} />
          <Grain />
        </section>
        <section
          id="prefinal"
          className="page__section page__section--prefinal"
        >
          <Prefinal />
        </section>
        <section
          id="projects"
          className="page__section page__section--projects"
        >
          <Projects />
        </section>
        <section
          id="about"
          className="page__section page__section--footer"
        >
          <Footer />
        </section>
      </main>
    </>
  );
}

export default App;
