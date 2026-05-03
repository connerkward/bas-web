import { useEffect, useState } from "react";

const FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "America/Los_Angeles",
  timeZoneName: "short",
});

function format() {
  const parts = FORMATTER.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const time = `${get("hour")}:${get("minute")}:${get("second")}`;
  const tz = get("timeZoneName");
  return `SAN FRANCISCO ${time} ${tz}`;
}

export default function TimeTicker() {
  const [now, setNow] = useState(format);

  useEffect(() => {
    const id = window.setInterval(() => setNow(format()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="time-ticker" aria-live="off">
      {now}
    </span>
  );
}
