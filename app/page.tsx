"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import CakeRoom from "../components/CakeRoom";
import Party from "../components/Party";
import { playBirthday } from "../lib/melody";
import { CONFIG } from "../lib/config";

type Stage = "cake" | "dark" | "party";

const BLACKOUT_MS = 2600; // how long the screen stays black before page two

export default function Page() {
  const [stage, setStage] = useState<Stage>("cake");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const onBlown = useCallback(() => {
    setStage("dark");
    timer.current = setTimeout(() => {
      setStage("party");
      playBirthday(CONFIG.song);
    }, BLACKOUT_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <>
      {stage === "party" ? <Party /> : <CakeRoom onBlown={onBlown} />}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "#000",
          zIndex: 50,
          opacity: stage === "dark" ? 1 : 0,
          transition: "opacity .9s ease",
          pointerEvents: stage === "dark" ? "auto" : "none",
        }}
      />
    </>
  );
}
