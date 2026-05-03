const PREFINAL_VIDEO = "/videos/prefinal.mp4";

export default function Prefinal() {
  return (
    <div className="prefinal">
      <video
        className="prefinal__video"
        src={PREFINAL_VIDEO}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        disablePictureInPicture
        aria-hidden="true"
      />

      <div className="prefinal__copy">
        <h2 className="prefinal__title">
          <span className="prefinal__title-line prefinal__title-line--studies">
            STUDIES
          </span>
          <span className="prefinal__title-line prefinal__title-line--motion">
            IN MOTION.
          </span>
        </h2>
        <p className="prefinal__body">
          A single body, photographed in profile, broken across depth and
          projected back onto milled relief. The piece is a chronophotograph
          held in one frame — Marey's interval, Muybridge's stride — rendered
          as surface and light.
        </p>
        <p className="prefinal__def">
          <span className="prefinal__def-head">
            <span className="prefinal__def-term">chronophotography</span>
            <span className="prefinal__def-pos">n.</span>
          </span>
          <span className="prefinal__def-text">
            a sequence of photographs taken at fixed intervals to record a
            body in motion. Étienne-Jules Marey, 1882.
          </span>
        </p>
      </div>
    </div>
  );
}
