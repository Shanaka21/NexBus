import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type AnswerLeg = {
  route_number: string;
  from_name?: string; to_name?: string;
  direction?: "forward" | "reverse";
  stop_count?: number; km?: number; minutes?: number | null;
  via?: string[];
};

// "8 stops, 95.8 km, about 247 min, via A, B, ...": the ride summary the assistant writes after each bus
function parseRide(text: string): Pick<AnswerLeg, "stop_count" | "km" | "minutes" | "via"> {
  const m = text.match(/(\d+) stops?, ([\d.]+) km(?:, about (\d+) min)?(?:, via (.+?))?\.?$/);
  if (!m) return {};
  return {
    stop_count: Number(m[1]), km: Number(m[2]), minutes: m[3] ? Number(m[3]) : null,
    via: m[4] ? m[4].replace(/,? ?\.\.\.$/, "").split(/, /).filter(Boolean) : [],
  };
}

/**
 * Builds the legs from the assistant's written answer. The server also sends them as data (with stop names), but an
 * older server does not, and the text always has the same shape, so the steps can be highlighted either way.
 */
export function legsFromAnswer(answer: string | null | undefined): AnswerLeg[] {
  if (!answer) return [];
  const lines = answer.split("\n").map((l) => l.trim());
  const legs: AnswerLeg[] = [];

  for (const line of lines) {
    // journey with changes: "1) Take bus 17 from A to B: ..." then "2) Change to bus 190 and get off at C: ..."
    let m = line.match(/^\d\) Take bus (\S+) from (.+?) to (.+?): (.*)$/);
    if (m) { legs.push({ route_number: m[1], from_name: m[2], to_name: m[3], direction: "forward", ...parseRide(m[4]) }); continue; }
    m = line.match(/^\d\) Change to bus (\S+) and get off at (.+?): (.*)$/);
    if (m && legs.length) {
      legs.push({ route_number: m[1], from_name: legs[legs.length - 1].to_name, to_name: m[2], direction: "forward", ...parseRide(m[3]) });
    }
  }
  if (legs.length === 0) {
    // direct journey: "Take bus 138 (Route name)." then "Board at A, get off at B: ..."
    const bus = lines.map((l) => l.match(/^(?:Take|This way is served by) bus (\S+)/)).find(Boolean);
    const ride = lines.map((l) => l.match(/^Board at (.+?), get off at (.+?): (.*)$/)).find(Boolean);
    if (bus && ride) legs.push({ route_number: bus[1], from_name: ride[1], to_name: ride[2], direction: "forward", ...parseRide(ride[3]) });
  }

  // "Bus 17 also runs from A to B, but the app has no timetable ... for that direction yet": that leg is a reverse one
  for (const line of lines) {
    const m = line.match(/^Bus (\S+) also runs from (.+?) to (.+?), but the app has no timetable/);
    if (m) {
      const leg = legs.find((l) => l.route_number === m[1] && l.from_name === m[2] && l.to_name === m[3]);
      if (leg) leg.direction = "reverse";
    }
  }
  return legs;
}

// Step-by-step journey with the places where the passenger boards, gets off and changes buses highlighted
export default function JourneySteps({ legs }: { legs: AnswerLeg[] }) {
  const usable = legs.filter((l) => l.from_name && l.to_name);
  if (usable.length === 0) return null;
  const last = usable.length - 1;

  return (
    <View style={styles.wrap}>
      {usable.map((l, i) => (
        <View key={`${l.route_number}-${i}`}>
          <View style={styles.legCard}>
            <View style={styles.busBadge}><Text style={styles.busBadgeText}>{l.route_number}</Text></View>
            <View style={{ flex: 1 }}>
              {/* where to get on */}
              <View style={styles.actionRow}>
                <View style={[styles.tag, styles.tagBoard]}>
                  <Ionicons name="log-in-outline" size={13} color="#1b5e20" />
                  <Text style={[styles.tagText, { color: "#1b5e20" }]}>BOARD</Text>
                </View>
                <Text style={styles.actionText}>
                  bus <Text style={styles.bold}>{l.route_number}</Text> at <Text style={[styles.stop, styles.stopBoard]}>{l.from_name}</Text>
                </Text>
              </View>

              {(l.stop_count != null || l.km != null) && (
                <Text style={styles.rideMeta}>
                  {l.stop_count != null ? `${l.stop_count} stop${l.stop_count === 1 ? "" : "s"}` : ""}
                  {l.km != null ? ` · ${l.km} km` : ""}
                  {l.minutes ? ` · about ${l.minutes} min` : ""}
                  {l.via && l.via.length > 0 ? ` · via ${l.via.slice(0, 4).join(", ")}${l.via.length > 4 ? "…" : ""}` : ""}
                </Text>
              )}
              {l.direction === "reverse" && (
                <Text style={styles.rideNote}>No timetable or live position for this direction yet.</Text>
              )}

              {/* where to get off */}
              <View style={[styles.actionRow, { marginTop: 8 }]}>
                <View style={[styles.tag, i === last ? styles.tagArrive : styles.tagOff]}>
                  <Ionicons name={i === last ? "flag-outline" : "log-out-outline"} size={13} color={i === last ? "#0d47a1" : "#b71c1c"} />
                  <Text style={[styles.tagText, { color: i === last ? "#0d47a1" : "#b71c1c" }]}>{i === last ? "ARRIVE" : "GET OFF"}</Text>
                </View>
                <Text style={styles.actionText}>
                  at <Text style={[styles.stop, i === last ? styles.stopArrive : styles.stopOff]}>{l.to_name}</Text>
                  {i === last ? " (your destination)" : ""}
                </Text>
              </View>
            </View>
          </View>

          {/* the change itself */}
          {i < last && (
            <View style={styles.changeBox}>
              <Ionicons name="swap-vertical" size={16} color="#e65100" />
              <Text style={styles.changeText}>
                Change buses at <Text style={styles.changeStop}>{l.to_name}</Text>: get off bus {l.route_number}, then board bus {usable[i + 1].route_number}
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        { gap: 0, marginTop: 4 },
  legCard:     { flexDirection: "row", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 12 },
  busBadge:    { minWidth: 46, height: 46, borderRadius: 12, backgroundColor: "#e8ecff", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  busBadgeText:{ fontSize: 16, fontWeight: "bold", color: "#1a3cff" },
  actionRow:   { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  actionText:  { fontSize: 14, color: "#333", flexShrink: 1 },
  bold:        { fontWeight: "700" },
  tag:         { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagBoard:    { backgroundColor: "#c8f0cf" },
  tagOff:      { backgroundColor: "#ffd6d2" },
  tagArrive:   { backgroundColor: "#cfe3ff" },
  tagText:     { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  stop:        { fontWeight: "800", borderRadius: 4, overflow: "hidden", paddingHorizontal: 4 },
  stopBoard:   { backgroundColor: "#d9f5dd", color: "#1b5e20" },
  stopOff:     { backgroundColor: "#ffe3e0", color: "#b71c1c" },
  stopArrive:  { backgroundColor: "#dbeaff", color: "#0d47a1" },
  rideMeta:    { fontSize: 12, color: "#888", marginTop: 6, lineHeight: 17 },
  rideNote:    { fontSize: 11.5, color: "#a96400", marginTop: 4 },
  changeBox:   { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff0d9", borderLeftWidth: 4, borderLeftColor: "#ff9800", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginVertical: 6, marginHorizontal: 8 },
  changeText:  { flex: 1, fontSize: 13, color: "#7a4a00", lineHeight: 18 },
  changeStop:  { fontWeight: "800", backgroundColor: "#ffe0b2", color: "#e65100", borderRadius: 4, overflow: "hidden" },
});
