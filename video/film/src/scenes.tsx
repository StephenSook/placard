/**
 * The built scenes, for beats no capture can show: a mechanism, a headline
 * figure, the size of a population. Mixing real captures with built scenes on
 * real data reads as more designed, not less real.
 *
 * EVERY NUMBER HERE IS FROM FACTS.md, which is generated from the committed
 * 49 CFR corpus. Nothing is typed from memory, and the claims guard fails the
 * build if the script and the fact sheet disagree.
 */
import React from "react";
import { interpolate, useCurrentFrame, Easing } from "remotion";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "./theme";
import { Chip, Eyebrow, Placard3D, SceneWrap, Title } from "./chrome";
import { useReveal, useInOut } from "./motion";

/** A number that counts up and LANDS, with time to hold on the real value. */
const CountUp: React.FC<{ to: number; delay?: number; frames?: number; size?: number; color?: string }> = ({
  to, delay = 6, frames = 46, size = 210, color = T.ink,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + frames], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });
  const pop = interpolate(frame, [delay + frames, delay + frames + 8, delay + frames + 20], [1, 1.045, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad),
  });
  return (
    <div
      style={{
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1,
        letterSpacing: "-0.03em", color, transform: `scale(${pop})`,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {Math.round(to * p).toLocaleString("en-US")}
    </div>
  );
};

/** Beat 2: who signs. The certification, and the person holding the pen. */
export const SignerScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const lines = [
    "properly classified",
    "described, packaged",
    "marked and labeled",
    "in proper condition for transportation",
  ];
  return (
    <SceneWrap durationInFrames={durationInFrames} align="flex-start">
      <Eyebrow>49 CFR 172.204, shipper certification</Eyebrow>
      <Title size={76}>Somebody signs for that.</Title>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 34, maxWidth: 1450 }}>
        {lines.map((l, i) => (
          <Chip key={l} delay={16 + i * 5}>{l}</Chip>
        ))}
      </div>
      {/*
        This said "becomes a hazmat employee under subpart H", which cites the
        TRAINING subpart for a definition that lives in 171.8, on a claim the
        pinned corpus could not check. 172.204(a) is now pinned and it says
        exactly this much, so the line says exactly this much. The chips above
        are verbatim fragments of 172.204(a)(1).
      */}
      <div
        style={{
          marginTop: 40, fontFamily: FONT_BODY, fontSize: 40, lineHeight: 1.35,
          color: T.inkSoft, maxWidth: 1280,
          opacity: useReveal(40),
        }}
      >
        172.204 puts that certification on the person who offers the material.
        Not on the software.
      </div>
    </SceneWrap>
  );
};

/** Beat 3: how many people this is for. Census 2022, cited on screen. */
export const HowManyScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => (
  <SceneWrap durationInFrames={durationInFrames}>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <Eyebrow>US establishments shipping hazmat in DOT regulated packaging, 2022</Eyebrow>
      <CountUp to={20460} size={230} />
      <div
        style={{
          marginTop: 26, fontFamily: FONT_BODY, fontSize: 38, color: T.inkSoft, maxWidth: 1180,
          opacity: useReveal(56),
        }}
      >
        Counted by the Census Bureau in a survey PHMSA paid for specifically to find out.
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 30 }}>
        <Chip delay={66}>2022 Commodity Flow Survey</Chip>
        <Chip delay={72}>Expanded Hazmat Supplement</Chip>
      </div>
    </div>
  </SceneWrap>
);

/** Beat 4: the measured gap. A bar the viewer can read in one glance. */
export const GapScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const grow = interpolate(frame, [14, 62], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });
  const redIn = interpolate(frame, [64, 92], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic),
  });
  const CLEARED = 792;
  const FORBIDS = 56;
  const BAR_W = 1420;
  return (
    <SceneWrap durationInFrames={durationInFrames} align="flex-start">
      <Eyebrow>1,296 configurations examined, 18 hazard categories</Eyebrow>
      <Title size={72}>The table alone clears 792.</Title>
      <div style={{ marginTop: 46, width: BAR_W }}>
        <div
          style={{
            position: "relative", height: 92, borderRadius: 12, overflow: "hidden",
            background: T.paperDeep, border: `1px solid ${T.paperEdge}`,
          }}
        >
          <div style={{ position: "absolute", inset: 0, width: `${grow * 100}%`, background: T.nonflam, opacity: 0.22 }} />
          <div
            style={{
              position: "absolute", top: 0, bottom: 0, left: `${(1 - FORBIDS / CLEARED) * 100}%`,
              width: `${(FORBIDS / CLEARED) * 100 * redIn}%`, background: T.flammable,
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <span style={{ fontFamily: FONT_MONO, fontSize: 26, color: T.inkFaint }}>792 cleared by the table</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 26, color: T.flammable, opacity: redIn }}>
            56 the regulation forbids
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 38 }}>
        <Chip delay={96} accent={T.flammable}>48 explosive compatibility</Chip>
        <Chip delay={102} accent={T.flammable}>8 corrosive over oxidizer</Chip>
        <Chip delay={108}>recomputed at /api/measure</Chip>
      </div>
    </SceneWrap>
  );
};

/**
 * Beat 10: capability as state. Two registries side by side, the two gated
 * tools swapping, with the placards turning once on entrance.
 */
export const CapabilityScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const swap = interpolate(frame, [70, 96], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic),
  });
  const Row: React.FC<{ name: string; on: boolean; delay: number }> = ({ name, on, delay }) => {
    const r = useReveal(delay);
    return (
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 22px", borderRadius: 10, marginBottom: 8,
          background: on ? "rgba(0,132,61,0.10)" : "rgba(216,35,42,0.07)",
          border: `1px solid ${on ? "rgba(0,132,61,0.35)" : "rgba(216,35,42,0.28)"}`,
          opacity: r, transform: `translateX(${(1 - r) * 18}px)`,
        }}
      >
        <span style={{ fontFamily: FONT_MONO, fontSize: 27, color: T.deckInk }}>{name}</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 21, letterSpacing: "0.10em", color: on ? T.clearedText : T.refusedText }}>
          {on ? "REGISTERED" : "ABSENT"}
        </span>
      </div>
    );
  };
  const Panel: React.FC<{ label: string; proposeOn: boolean; commitOn: boolean; delay: number; opacity: number }> = ({
    label, proposeOn, commitOn, delay, opacity,
  }) => (
    <div
      style={{
        flex: 1, padding: 30, borderRadius: 18, background: T.deckRaised,
        border: `1px solid ${T.deckRule}`, opacity,
      }}
    >
      <div style={{ fontFamily: FONT_MONO, fontSize: 21, letterSpacing: "0.16em", color: T.deckInkSoft, marginBottom: 18 }}>
        {label}
      </div>
      <Row name="propose_load" on={proposeOn} delay={delay} />
      <Row name="commit_manifest" on={commitOn} delay={delay + 6} />
    </div>
  );
  return (
    <SceneWrap durationInFrames={durationInFrames} dark align="flex-start">
      <Eyebrow dark>capability as state</Eyebrow>
      <Title dark size={70}>Never both. Never neither.</Title>
      <div style={{ display: "flex", gap: 26, marginTop: 40, width: 1520, alignItems: "stretch" }}>
        {/* The "before" panel dims to make the swap read, but not so far that a
            viewer cannot check what it said. It is half the argument. */}
        <Panel label="load refused" proposeOn commitOn={false} delay={20} opacity={1 - swap * 0.32} />
        <div style={{ display: "grid", placeItems: "center", width: 150 }}>
          <Placard3D cls="8" top="#ffffff" bottom={T.corrosive} delay={30} size={120} />
        </div>
        <Panel label="load passes" proposeOn={false} commitOn delay={74} opacity={0.5 + swap * 0.5} />
      </div>
      <div
        style={{
          marginTop: 34, fontFamily: FONT_BODY, fontSize: 36, color: T.deckInkSoft, maxWidth: 1420,
          opacity: useReveal(104),
        }}
      >
        The agent cannot choose the unsafe action, because from where it stands the action does not exist.
      </div>
    </SceneWrap>
  );
};

/** The close: one action, the links, and the placards settling face-on. */
export const CloseScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const t = useInOut(durationInFrames, 20, 24);
  return (
    <SceneWrap durationInFrames={durationInFrames}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", opacity: t }}>
        <div style={{ display: "flex", gap: 40, marginBottom: 44 }}>
          <Placard3D cls="8" top="#ffffff" bottom={T.corrosive} delay={4} size={150} />
          <Placard3D cls="5.1" top={T.oxidizer} bottom={T.oxidizer} delay={12} size={150} />
          <Placard3D cls="3" top={T.flammable} bottom={T.flammable} delay={20} size={150} />
        </div>
        <Eyebrow delay={26}>open it yourself. no account, no key, no flag.</Eyebrow>
        <div
          style={{
            fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 68, color: T.ink,
            letterSpacing: "-0.02em", marginTop: 4,
          }}
        >
          segregation-console.vercel.app
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 34 }}>
          <Chip delay={44}>github.com/StephenSook/placard</Chip>
          <Chip delay={50}>Apache 2.0</Chip>
          <Chip delay={56}>eCFR snapshot 2026-08-27</Chip>
        </div>
      </div>
    </SceneWrap>
  );
};
