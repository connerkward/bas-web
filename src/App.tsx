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
