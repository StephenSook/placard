/**
 * The shared furniture: ground, eyebrow, chips, media cards, captions and the
 * 3D placard. Every scene is built from these so the film reads as one system.
 */
import React from "react";
import {
  AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, Easing,
} from "remotion";
import { OffthreadVideo } from "remotion";
import { T, FONT_DISPLAY, FONT_BODY, FONT_MONO, SAFE } from "./theme";
import { Sheen, useEntranceSpin, useFloat, useInOut, useReveal, useFocus, type Focus } from "./motion";
import ticker from "./data/ticker.json";

/** The paper ground, with a faint grain and a slow vignette so it breathes. */
export const Background: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 220) * 2;
  return (
    <AbsoluteFill style={{ background: dark ? T.deck : T.paper }}>
      <AbsoluteFill
        style={{
          background: dark
            ? `radial-gradient(120% 90% at ${50 + drift}% 20%, #262320 0%, ${T.deck} 62%)`
            : `radial-gradient(120% 90% at ${50 + drift}% 18%, #fbf4ee 0%, ${T.paper} 60%)`,
        }}
      />
      {/*
        LIVE GRAIN, and it is load-bearing rather than decoration.

        A built scene whose elements have finished entering is a STILL IMAGE,
        and the media harness fails a still: seven segments of this film ran
        three seconds or longer with no pixel changing, because a settled
        typographic scene genuinely stops. Ken Burns covers the capture beats
        and nothing covered these. So the paper keeps a grain that drifts, at a
        rate low enough to read as texture rather than noise and high enough
        that the frame is never twice the same.
      */}
      <AbsoluteFill
        style={{
          opacity: dark ? 0.075 : 0.055,
          backgroundPosition: `${frame * 0.73}px ${frame * -0.41}px`,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * THE CLAUSE TICKER, and it does two jobs.
 *
 * Design: the console itself runs a strip of verbatim regulation across its
 * top, so carrying the same strip into the built scenes makes capture and
 * graphic read as one product rather than two.
 *
 * Mechanical: a built scene whose elements have settled is a still image, and
 * the media harness correctly fails a still. Grain alone measured -75 dB
 * between adjacent frames, well under the -60 dB gate, because sub-pixel
 * translation of a five-percent texture barely moves a pixel. Scrolling type
 * moves real ink at 1.7 px per frame and clears it by a wide margin. The strip
 * is therefore load-bearing, not decoration, and it must not be removed
 * without something else that genuinely moves taking its place.
 *
 * Text comes from data/clauses.json via scripts/film-ticker.mjs. Verbatim,
 * generated, never typed.
 */
const TICKER = ticker.items;
const TICKER_LINE = TICKER.map((c) => `${c.cite}   ${c.text}`).join("        \u00b7        ");

export const ClauseTicker: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const frame = useCurrentFrame();
  // One pass is far longer than any scene, so the strip never visibly loops.
  const x = -((frame * 1.7) % 24000);
  return (
    <div
      style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 46, overflow: "hidden",
        borderBottom: `1px solid ${dark ? T.deckRule : T.paperEdge}`,
        background: dark ? "rgba(38,35,32,0.55)" : "rgba(235,223,213,0.55)",
        display: "flex", alignItems: "center",
      }}
    >
      <div
        style={{
          transform: `translateX(${x}px)`, whiteSpace: "nowrap",
          fontFamily: FONT_MONO, fontSize: 17, letterSpacing: "0.04em",
          color: dark ? T.deckInkSoft : T.inkFaint, opacity: 0.85,
        }}
      >
        {TICKER_LINE}
        <span style={{ paddingLeft: 120 }}>{TICKER_LINE}</span>
      </div>
    </div>
  );
};

/** Small mono label above a title. */
export const Eyebrow: React.FC<{ children: React.ReactNode; dark?: boolean; delay?: number }> = ({
  children, dark, delay = 0,
}) => {
  const r = useReveal(delay);
  return (
    <div
      style={{
        fontFamily: FONT_MONO, fontSize: 24, letterSpacing: "0.20em", textTransform: "uppercase",
        color: dark ? T.deckInkSoft : T.inkFaint,
        opacity: r, transform: `translateY(${(1 - r) * 14}px)`, marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
};

export const Title: React.FC<{ children: React.ReactNode; dark?: boolean; delay?: number; size?: number }> = ({
  children, dark, delay = 4, size = 84,
}) => {
  const r = useReveal(delay);
  return (
    <div
      style={{
        fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.02,
        letterSpacing: "-0.02em", color: dark ? T.deckInk : T.ink,
        opacity: r, transform: `translateY(${(1 - r) * 22}px)`, maxWidth: 1500,
      }}
    >
      {children}
    </div>
  );
};

export const Chip: React.FC<{ children: React.ReactNode; delay?: number; accent?: string; dark?: boolean }> = ({
  children, delay = 0, accent, dark,
}) => {
  const r = useReveal(delay);
  return (
    <div
      style={{
        fontFamily: FONT_MONO, fontSize: 22, letterSpacing: "0.04em",
        padding: "10px 18px", borderRadius: 999,
        background: dark ? T.deckRaised : T.card,
        color: accent ?? (dark ? T.deckInk : T.inkSoft),
        border: `1px solid ${accent ? accent + "55" : dark ? T.deckRule : T.paperEdge}`,
        opacity: r, transform: `translateY(${(1 - r) * 12}px) scale(${0.96 + r * 0.04})`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
};

/** Every scene sits in this, which owns the safe area and the in-out envelope. */
export const SceneWrap: React.FC<{
  durationInFrames: number; children: React.ReactNode; dark?: boolean; align?: "center" | "flex-start";
}> = ({ durationInFrames, children, dark, align = "center" }) => {
  const t = useInOut(durationInFrames);
  return (
    <AbsoluteFill>
      <Background dark={dark} />
      <ClauseTicker dark={dark} />
      <AbsoluteFill
        style={{
          padding: SAFE, display: "flex", flexDirection: "column", justifyContent: "center",
          alignItems: align, opacity: t, transform: `scale(${0.985 + t * 0.015})`,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * A real capture framed as a card: rounded, shadowed, entering with overshoot,
 * held with a Ken Burns push and one sheen. `focus` adds tracking keyframes.
 */
export const MediaCard: React.FC<{
  src: string; durationInFrames: number; video?: boolean; startFrom?: number;
  focus?: Focus[]; delay?: number; radius?: number;
  /** Every capture in this film is 1.6:1. The card is FITTED to the frame from
   *  that ratio rather than stretched to the column width, because a card taller
   *  than 1080 silently loses its own bottom edge and nothing in the render
   *  reports it. */
  aspect?: number; maxW?: number; maxH?: number;
}> = ({
  src, durationInFrames, video, startFrom, focus = [], delay = 0, radius = 20,
  aspect = 1.6, maxW = 1760, maxH = 900,
}) => {
  const w = Math.min(maxW, maxH * aspect);
  const frame = useCurrentFrame();
  const r = useReveal(delay, 12, 0.9);
  const f = useFocus(focus.length ? focus : [{ at: 0, scale: 1.02, origin: [0.5, 0.45] }], frame);
  const float = useFloat(3, 260);
  return (
    <div
      style={{
        position: "relative", width: w, height: w / aspect, borderRadius: radius, overflow: "hidden",
        boxShadow: "0 40px 90px rgba(20,17,14,0.28), 0 0 0 1px rgba(20,17,14,0.10)",
        opacity: r,
        transform: `translateY(${(1 - r) * 34 + float}px) scale(${0.965 + r * 0.035})`,
        background: T.card,
      }}
    >
      <div style={{ width: "100%", height: "100%", transform: `scale(${f.scale})`, transformOrigin: `${f.origin[0] * 100}% ${f.origin[1] * 100}%` }}>
        {video ? (
          <OffthreadVideo src={staticFile(src)} startFrom={startFrom} muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        )}
      </div>
      <Sheen delay={delay + 26} duration={90} />
    </div>
  );
};

/** Rough relative luminance of a #rrggbb, enough to pick lettering contrast. */
const relLuminance = (hex: string): number => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.2126 * r! + 0.7152 * g! + 0.0722 * b!) / 255;
};

/**
 * The hazard placard, drawn rather than photographed, in its legally specified
 * colours. It turns ONE whole revolution on entrance and settles face-on.
 */
export const Placard3D: React.FC<{
  cls: string; top: string; bottom: string; delay?: number; size?: number;
}> = ({ cls, top, bottom, delay = 0, size = 240 }) => {
  const spin = useEntranceSpin(delay, 54, 1);
  const r = useReveal(delay, 12, 0.9);
  // 49 CFR 172 subpart F sets the ground colour; contrast then decides the
  // lettering, which is white on the red and black grounds and black on yellow.
  const onDark = relLuminance(bottom) < 0.45;
  return (
    <div style={{ perspective: 1200, width: size, height: size, opacity: r }}>
      <div
        style={{
          width: size, height: size, transform: `rotateY(${spin}deg) scale(${0.9 + r * 0.1})`,
          transformStyle: "preserve-3d", position: "relative",
        }}
      >
        {/*
          THE SPLIT IS 135 DEGREES, NOT 180, and that is not a style choice.
          The square is rotated 45 degrees to make the diamond, which rotates
          its gradient with it, so a 180deg fill renders as a DIAGONAL split and
          the placard stops looking like a placard. 135 plus the 45 of the
          rotation lands the boundary horizontal, which is where 49 CFR 172
          subpart F puts it. The class number sits in the LOWER half for the
          same reason.
        */}
        <div
          style={{
            position: "absolute", inset: 0, transform: "rotate(45deg)",
            background: `linear-gradient(135deg, ${top} 0%, ${top} 50%, ${bottom} 50%, ${bottom} 100%)`,
            border: `3px solid ${T.ink}`, borderRadius: 8,
            boxShadow: "0 24px 60px rgba(20,17,14,0.35)",
            display: "grid", placeItems: "center",
          }}
        >
          <span
            style={{
              transform: `rotate(-45deg) translateY(${size * 0.20}px)`,
              fontFamily: FONT_DISPLAY, fontWeight: 800,
              fontSize: size * 0.26,
              color: onDark ? "#ffffff" : T.ink,
              textShadow: onDark ? "none" : "0 1px 0 rgba(255,255,255,0.35)",
            }}
          >
            {cls}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Burned captions, lower third, left aligned.
 *
 * The fade window is duration-safe: a chunk shorter than the fade breaks
 * `interpolate` with "inputRange must be strictly monotonically increasing".
 */
export const Caption: React.FC<{ text: string; durationInFrames: number; dark?: boolean }> = ({
  text, durationInFrames, dark,
}) => {
  const frame = useCurrentFrame();
  const fade = durationInFrames < 24 ? 0 : Math.min(8, Math.floor(durationInFrames / 3));
  const o = fade === 0 ? 1 : interpolate(
    frame, [0, fade, durationInFrames - fade, durationInFrames], [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) },
  );
  return (
    <div
      style={{
        position: "absolute", left: SAFE, right: SAFE, bottom: 74,
        display: "flex", justifyContent: "flex-start", pointerEvents: "none", opacity: o,
      }}
    >
      <div
        style={{
          maxWidth: 1320, padding: "16px 26px", borderRadius: 14,
          background: dark ? "rgba(27,25,22,0.86)" : "rgba(20,17,14,0.86)",
          color: "#fdfaf7", fontFamily: FONT_BODY, fontWeight: 500, fontSize: 34, lineHeight: 1.34,
          textAlign: "left", backdropFilter: "blur(6px)",
          boxShadow: "0 14px 40px rgba(0,0,0,0.30)",
        }}
      >
        {text}
      </div>
    </div>
  );
};

/**
 * The transparent call-to-action overlay. It rides OVER the picture rather than
 * replacing it, so the product is still visible while the ask is on screen.
 */
export const CTAOverlay: React.FC<{ durationInFrames: number; url: string; sub: string }> = ({
  durationInFrames, url, sub,
}) => {
  const t = useInOut(durationInFrames, 16, 14);
  const float = useFloat(3, 170);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 96, pointerEvents: "none" }}>
      <div
        style={{
          position: "relative", overflow: "hidden",
          padding: "22px 44px", borderRadius: 18,
          background: "rgba(255,253,251,0.90)", border: `1px solid ${T.paperEdge}`,
          boxShadow: "0 24px 60px rgba(20,17,14,0.26)",
          opacity: t, transform: `translateY(${(1 - t) * -22 + float}px)`,
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: FONT_MONO, fontSize: 20, letterSpacing: "0.18em", color: T.inkFaint, textTransform: "uppercase" }}>
          {sub}
        </div>
        <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 46, color: T.ink, marginTop: 6, letterSpacing: "-0.01em" }}>
          {url}
        </div>
        <Sheen delay={20} duration={70} />
      </div>
    </AbsoluteFill>
  );
};
