/**
 * The film.
 *
 * THE EXECUTION WINDOW IS ONE CONTINUOUS SPAN. Beats 5 to 8 are a single
 * `MediaCard` over the single continuous take, sequenced once, with no cut, no
 * dissolve and no speed change inside it. Only the CAMERA moves: focus
 * keyframes push toward the region under discussion and release. Transitions
 * exist between every OTHER beat, and deliberately not inside this one, because
 * a dissolve there would be a cut through the proof.
 *
 * Captions are per beat and pause automatically where the narration pauses,
 * because each beat's caption lives in that beat's own Sequence.
 */
import React from "react";
import {
  AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig,
} from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { loadFont as loadArchivo } from "@remotion/google-fonts/Archivo";
import { loadFont as loadPublicSans } from "@remotion/google-fonts/PublicSans";
import { loadFont as loadPlexMono } from "@remotion/google-fonts/IBMPlexMono";

import beatsData from "./data/beats.json";
import { T } from "./theme";
import { Background, Caption, CTAOverlay, Eyebrow, MediaCard, SceneWrap, Title } from "./chrome";
import { CapabilityScene, CloseScene, GapScene, HowManyScene, SignerScene } from "./scenes";

// Only the weights the film actually sets. loadFont blocks the render until the
// face is ready, and pulling every weight costs 70 requests per frame batch.
const F = { subsets: ["latin"] as ["latin"], ignoreTooManyRequestsWarning: true };
loadArchivo("normal", { ...F, weights: ["800"] });
loadPublicSans("normal", { ...F, weights: ["500"] });
loadPlexMono("normal", { ...F, weights: ["400"] });

type Beat = { id: string; start: number; end: number; dur: number; startFrame: number; durFrames: number };
const B: Record<string, Beat> = Object.fromEntries((beatsData.beats as Beat[]).map((b) => [b.id, b]));

/** Caption text per beat, matching the narration word for word. No em-dashes. */
const CAPTIONS: Record<string, string> = {
  "01_refusal": "Legal according to the federal segregation table. Watch it get refused anyway.",
  "02_signer": "Under 49 CFR 172.204 the person who signs becomes personally responsible.",
  "03_howmany": "20,460 US establishments shipped hazmat in DOT regulated packaging in 2022.",
  "04_gap": "The table alone clears 792 configurations. The full regulation forbids 56.",
  "05_propose": "The agent reads the manifest and proposes an arrangement. Nothing here is staged.",
  "06_refuse": "It refuses, and quotes 177.848(e)(3) word for word from a pinned eCFR snapshot.",
  "07_barrier": "Tick the barrier box and it still refuses. No separation reaches that clause.",
  "08_export": "Two vehicles. Now it passes, and only now does the export tool exist.",
  "09_forbidden": "256 entries have no identification number. To a UN keyed index they read as not regulated.",
  "10_webmcp": "Propose exists only while the load fails. Export only while it passes.",
  "11_close": "Open it yourself. No account, no key, no browser flag.",
};

const Cap: React.FC<{ id: string; dark?: boolean }> = ({ id, dark }) => (
  <Caption text={CAPTIONS[id]!} durationInFrames={B[id]!.durFrames} dark={dark} />
);

/** Beat 1: the cold open, straight onto the real refusal. No title card. */
const RefusalScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => (
  <SceneWrap durationInFrames={durationInFrames}>
    <MediaCard
      src="stills/refusal.png"
      durationInFrames={durationInFrames}
      maxW={1700}
      maxH={870}
      focus={[
        { at: 0, scale: 1.02, origin: [0.5, 0.45] },
        { at: 170, scale: 1.28, origin: [0.74, 0.40] },
        { at: 360, scale: 1.40, origin: [0.76, 0.56] },
        { at: durationInFrames, scale: 1.30, origin: [0.70, 0.48] },
      ]}
    />
  </SceneWrap>
);

/**
 * Beat 9: the 256 entries with no identification number. Two columns, because
 * the claim needs the words beside the evidence rather than stacked above it,
 * and stacking left the capture too small to read the FORBIDDEN row.
 */
const ForbiddenScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => (
  <SceneWrap durationInFrames={durationInFrames} align="flex-start">
    <div style={{ display: "flex", gap: 44, alignItems: "center", width: 1704 }}>
      <div style={{ width: 470, flexShrink: 0 }}>
        <Eyebrow>172.101(d)(1)</Eyebrow>
        <Title size={58}>256 entries have no placard, and cannot.</Title>
      </div>
      <MediaCard
        src="stills/forbidden.png"
        durationInFrames={durationInFrames - 20}
        delay={12}
        maxW={1190}
        maxH={744}
        focus={[
          { at: 0, scale: 1.04, origin: [0.5, 0.45] },
          { at: 200, scale: 1.28, origin: [0.44, 0.48] },
          { at: durationInFrames, scale: 1.38, origin: [0.50, 0.46] },
        ]}
      />
    </div>
  </SceneWrap>
);

/**
 * Beats 5 to 8: THE CONTINUOUS TAKE. One video element, one Sequence, no cuts.
 * The camera tracks; the footage does not.
 *
 * Frame offsets inside the take correspond to the holds the capture script
 * waited on: propose 0, refuse 356, barrier 821, split 1205.
 */
const TakeScene: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => (
  <AbsoluteFill style={{ background: T.paper }}>
    <Background />
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <MediaCard
        src="footage/take.mp4"
        video
        startFrom={0}
        durationInFrames={durationInFrames}
        radius={16}
        maxW={1780}
        maxH={952}
        focus={[
          // 05 propose: hold wide so the whole console is legible, then drift left
          // across the manifest the narration is describing.
          { at: 0, scale: 1.00, origin: [0.5, 0.45] },
          { at: 300, scale: 1.10, origin: [0.34, 0.52] },
          // 06 refuse: swing right to the verdict, then settle on the clause.
          { at: 430, scale: 1.16, origin: [0.62, 0.46] },
          { at: 560, scale: 1.42, origin: [0.78, 0.40] },
          { at: 780, scale: 1.50, origin: [0.79, 0.60] },
          // 07 barrier: pull back, drop to the load plan where the box is ticked,
          // then return to the verdict that still says REFUSED.
          { at: 880, scale: 1.08, origin: [0.5, 0.5] },
          { at: 980, scale: 1.34, origin: [0.28, 0.76] },
          { at: 1110, scale: 1.44, origin: [0.79, 0.52] },
          // 08 split, pass, export: wide for the flip to two vehicles, then in on
          // the shipping paper that only now exists.
          { at: 1230, scale: 1.02, origin: [0.5, 0.45] },
          { at: 1420, scale: 1.18, origin: [0.70, 0.48] },
          { at: 1570, scale: 1.22, origin: [0.5, 0.58] },
          { at: durationInFrames, scale: 1.18, origin: [0.5, 0.55] },
        ]}
      />
    </AbsoluteFill>
  </AbsoluteFill>
);

/**
 * Sequence durations are DERIVED from the beat clock, never hand-typed: each
 * scene runs until the next narrated beat begins, plus the overlap its
 * transition consumes. That makes the chain land exactly on the film's last
 * frame by construction, so a retimed narration cannot leave a blank tail.
 */
const GROUPS: { id: string; nextId: string | null; el: (d: number) => React.ReactNode; after: number }[] = [
  { id: "01_refusal", nextId: "02_signer", after: 14, el: (d) => <RefusalScene durationInFrames={d} /> },
  { id: "02_signer", nextId: "03_howmany", after: 13, el: (d) => <SignerScene durationInFrames={d} /> },
  { id: "03_howmany", nextId: "04_gap", after: 14, el: (d) => <HowManyScene durationInFrames={d} /> },
  { id: "04_gap", nextId: "05_propose", after: 13, el: (d) => <GapScene durationInFrames={d} /> },
  // Beats 05 to 08 are ONE entry on purpose: the uncut execution window.
  { id: "05_propose", nextId: "09_forbidden", after: 13, el: (d) => <TakeScene durationInFrames={d} /> },
  { id: "09_forbidden", nextId: "10_webmcp", after: 13, el: (d) => <ForbiddenScene durationInFrames={d} /> },
  { id: "10_webmcp", nextId: "11_close", after: 13, el: (d) => <CapabilityScene durationInFrames={d} /> },
  { id: "11_close", nextId: null, after: 0, el: (d) => <CloseScene durationInFrames={d} /> },
];

const TRANSITIONS = [
  <TransitionSeries.Transition key="t1" presentation={fade()} timing={linearTiming({ durationInFrames: 14 })} />,
  <TransitionSeries.Transition key="t2" presentation={slide({ direction: "from-right" })}
    timing={springTiming({ config: { damping: 200 }, durationInFrames: 13 })} />,
  <TransitionSeries.Transition key="t3" presentation={wipe({ direction: "from-left" })} timing={linearTiming({ durationInFrames: 14 })} />,
  <TransitionSeries.Transition key="t4" presentation={fade()} timing={linearTiming({ durationInFrames: 13 })} />,
  <TransitionSeries.Transition key="t5" presentation={fade()} timing={linearTiming({ durationInFrames: 13 })} />,
  <TransitionSeries.Transition key="t6" presentation={slide({ direction: "from-bottom" })}
    timing={springTiming({ config: { damping: 200 }, durationInFrames: 13 })} />,
  <TransitionSeries.Transition key="t7" presentation={fade()} timing={linearTiming({ durationInFrames: 13 })} />,
];

export const Film: React.FC = () => {
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: T.paper }}>
      {/* Picture. Transitions between beats, and deliberately none inside the take. */}
      <TransitionSeries>
        {GROUPS.flatMap((g, i) => {
          const from = B[g.id]!.startFrame;
          const to = g.nextId ? B[g.nextId]!.startFrame : durationInFrames;
          const d = to - from + g.after;
          const seq = (
            <TransitionSeries.Sequence key={g.id} durationInFrames={d}>
              {g.el(d)}
            </TransitionSeries.Sequence>
          );
          return g.after > 0 ? [seq, TRANSITIONS[i]!] : [seq];
        })}
      </TransitionSeries>

      {/* Captions, per beat, so they pause exactly where the voice does. */}
      {(beatsData.beats as Beat[]).map((b) =>
        b.id === "11_close" ? null : (
          <Sequence key={b.id} from={b.startFrame} durationInFrames={b.durFrames} layout="none">
            <Cap id={b.id} dark={b.id === "10_webmcp"} />
          </Sequence>
        ),
      )}

      {/* The transparent CTA, riding OVER the product during the export beat. */}
      <Sequence from={B["08_export"]!.startFrame + 200} durationInFrames={180} layout="none">
        <CTAOverlay durationInFrames={180} url="segregation-console.vercel.app" sub="running live, right now" />
      </Sequence>

      <Audio src={staticFile("audio/narration.wav")} />
      <Audio src={staticFile("audio/music.mp3")} volume={0.11} />
    </AbsoluteFill>
  );
};
