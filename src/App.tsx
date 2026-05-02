import { useEffect, useState } from "react";
import Logo from "./components/Logo";
import TopNav from "./components/TopNav";
import Hero from "./components/Hero";
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
      <Logo />
      <TopNav />
      <main className="page">
        <section className="page__section page__section--hero">
          <Hero dpr={dpr} />
        </section>
        <section className="page__section page__section--footer">
          <Footer />
        </section>
      </main>
      <Grain />
    </>
  );
}

export default App;
