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

  // Browser-level hash navigation: respond to URL-bar edits or back/forward
  // that change the hash without a full reload. Native browser hash-jump
  // only fires on initial load; in-page hash changes leave the scroll
  // wherever it was. Listen for `hashchange` and scroll to the matching
  // element (or to top, if the hash was cleared). Same snap-disable
  // pattern as the nav buttons so mandatory snap doesn't yank the
  // programmatic scroll back.
  useEffect(() => {
    const onHashChange = () => {
      const id = window.location.hash.slice(1);
      const el = id ? document.getElementById(id) : null;
      const top = el ? el.offsetTop : 0;
      const html = document.documentElement;
      html.style.scrollSnapType = "none";
      void html.offsetHeight;
      html.scrollTop = top;
      setTimeout(() => {
        html.style.scrollSnapType = "";
      }, 80);
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
