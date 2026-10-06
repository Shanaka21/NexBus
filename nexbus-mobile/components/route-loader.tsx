import { useEffect, useMemo, useState } from "react";
import { Animated, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

type Pt = { x: number; y: number };

const VIEW_W = 720;
const VIEW_H = 264;

// start point, then [control1, control2, end] for each cubic segment; the segment ends are the bus stops
const START: Pt = { x: 32, y: 204 };
const SEGMENTS: [Pt, Pt, Pt][] = [
  [{ x: 85, y: 204 }, { x: 110, y: 84 }, { x: 212, y: 84 }],
  [{ x: 312, y: 84 }, { x: 340, y: 170 }, { x: 405, y: 132 }],
  [{ x: 470, y: 94 }, { x: 462, y: 68 }, { x: 490, y: 60 }],
];
const STOPS: Pt[] = [START, ...SEGMENTS.map((s) => s[2])];

const PATH = `M${START.x} ${START.y} ` + SEGMENTS.map(([a, b, c]) => `C${a.x} ${a.y} ${b.x} ${b.y} ${c.x} ${c.y}`).join(" ");

const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};

// the curve as a polyline with its cumulative length, so progress 0..1 maps to an even speed along the road
function buildTrack() {
  const points: Pt[] = [START];
  let from = START;
  for (const [a, b, c] of SEGMENTS) {
    for (let i = 1; i <= 40; i++) points.push(cubic(from, a, b, c, i / 40));
    from = c;
  }
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  return { points, lengths, total: lengths[lengths.length - 1] };
}

type Track = ReturnType<typeof buildTrack>;

function pointAt(track: Track, progress: number): Pt {
  const target = Math.min(1, Math.max(0, progress)) * track.total;
  let i = 1;
  while (i < track.lengths.length - 1 && track.lengths[i] < target) i++;
  const span = track.lengths[i] - track.lengths[i - 1] || 1;
  const k = (target - track.lengths[i - 1]) / span;
  const a = track.points[i - 1];
  const b = track.points[i];
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

/**
 * Route-style loading indicator: a dotted road with stops and a green bus dot that travels along it.
 * `progress` runs 0 → 1 and must come from an Animated.Value that does not use the native driver.
 */
export default function RouteLoader({ progress, width = 300 }: { progress: Animated.Value; width?: number }) {
  const track = useMemo(() => buildTrack(), []);
  const [pos, setPos] = useState<Pt>(START);
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const id = progress.addListener(({ value }) => setPos(pointAt(track, value)));
    return () => progress.removeListener(id);
  }, [progress, track]);

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: false }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // 0 → 1 repeating; the halo around the moving dot grows and fades with it
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = pulse.addListener(({ value }) => setPhase(value));
    return () => pulse.removeListener(id);
  }, [pulse]);

  return (
    <View style={{ width, height: (width * VIEW_H) / VIEW_W }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <Path d={PATH} stroke="rgba(255,255,255,0.35)" strokeWidth={4} strokeDasharray="2 11" strokeLinecap="round" fill="none" />
        {STOPS.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={13} fill="rgba(255,255,255,0.18)" />
        ))}
        {STOPS.map((s, i) => (
          <Circle key={`c${i}`} cx={s.x} cy={s.y} r={6} fill="#fff" />
        ))}
        <Circle cx={pos.x} cy={pos.y} r={14 + phase * 12} fill="#34d399" opacity={0.35 * (1 - phase)} />
        <Circle cx={pos.x} cy={pos.y} r={11} fill="#34d399" stroke="#fff" strokeWidth={3.5} />
      </Svg>
    </View>
  );
}
