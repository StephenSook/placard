/**
 * The film's motion vocabulary, in one place so every scene moves the same way.
 *
 * The rules encoded here, from the motion-graphics guidance and the studio
 * skill, are what separate polished from amateur:
 *   - every element animates fully IN and fully OUT, nothing pops or is cut
 *     mid-motion,
 *   - springs carry a little anticipation and overshoot, then settle,
 *   - siblings stagger a few frames apart so the eye can follow,
 *   - something is always alive on screen (a slow float, a sheen sweep),
 *   - a 3D object turns a WHOLE revolution on entrance and settles face-on,
 *     never spinning forever, because a continuous rotation is edge-on half the
 *     time and every verification still lands on a thin ellipse.
 */
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from "remotion";

/** Spring with a little overshoot, then settle. The film's default reveal. */
export const useReveal = (delay = 0, damping = 11, mass = 0.8) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass, stiffness: 120 } });
};

/**
 * Enter, hold, exit. `t` runs 0 to 1 to 0 across the scene so nothing is ever
 * cut mid-motion. `inF` and `outF` are frame counts.
 */
export const useInOut = (durationInFrames: number, inF = 18, outF = 16) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 11, mass: 0.8, stiffness: 120 } });
  const exit = interpolate(
    frame,
    [durationInFrames - outF, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) },
  );
  return Math.min(enter, exit);
};

/** A slow living float so a held card is never perfectly static. */
export const useFloat = (amp = 4, period = 150) => {
  const frame = useCurrentFrame();
  return Math.sin((frame / period) * Math.PI * 2) * amp;
};

/**
 * ONE deliberate whole revolution on entrance, eased, then settle face-on with
 * a small breathing tilt. `turns` is whole turns, so an off-axis settle is
 * unrepresentable.
 */
export const useEntranceSpin = (delay = 0, frames = 52, turns = 1) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [delay, delay + frames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const settle = Math.sin(((frame - delay - frames) / 190) * Math.PI * 2) * 4;
  return t * 360 * turns + (frame > delay + frames ? settle : 0);
};

/**
 * A slow diagonal sheen across a card. `mix-blend-mode: screen` is not optional:
 * with the default blend the sheen's edge reads as a dark band over glyphs.
 */
export const Sheen: React.FC<{ delay?: number; duration?: number }> = ({
  delay = 24,
  duration = 80,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + duration], [-40, 140], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        mixBlendMode: "screen",
        background: `linear-gradient(105deg, transparent ${p - 16}%, rgba(255,255,255,0.20) ${p}%, transparent ${p + 16}%)`,
      }}
    />
  );
};

/**
 * Ken Burns plus optional FOCUS KEYFRAMES: push toward a region, hold, release.
 * Scale is capped so footage never softens past recognition.
 *
 * `origin` is the transform origin as a 0..1 pair. With `transform-origin: cx`
 * and scale z, the right edge is cut by (1 - cx)(z - 1), so to keep a right-hand
 * panel visible push cx toward 0.9 and keep z modest.
 */
export type Focus = { at: number; scale: number; origin: [number, number] };

export const useFocus = (keys: Focus[], frame: number) => {
  if (keys.length === 0) return { scale: 1, origin: [0.5, 0.5] as [number, number] };
  if (keys.length === 1) return { scale: keys[0]!.scale, origin: keys[0]!.origin };
  const ats = keys.map((k) => k.at);
  const scale = interpolate(frame, ats, keys.map((k) => k.scale), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const ox = interpolate(frame, ats, keys.map((k) => k.origin[0]), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const oy = interpolate(frame, ats, keys.map((k) => k.origin[1]), {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  return { scale, origin: [ox, oy] as [number, number] };
};
