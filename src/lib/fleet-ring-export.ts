/**
 * The fleet trend ring's CSV export — the AJ seat of the t1019/t1029/
 * t1030 grammar chain (param-diff-export's sibling). The storage
 * overview's fleet band shows the ring as a strip of bars and the
 * stamp's "ring N/12"; the memory behind the strip could not leave as
 * bytes. This builder is the ring's ONE father: the head words are the
 * band's own three faces (the stamp's address, the cluster's channel,
 * the mirrors' channel — the t1097 pair), the rows speak the strip's
 * own reading order (oldest first — fleetTrendSpec's draw order), and
 * the cells speak the values the bars MEAN:
 *
 *   • the t1092 hole law — an honest hole exports an EMPTY cell, never
 *     a zero wearing a number's clothes (the house CSV's nullish cell
 *     already speaks the empty word — rowsToCsv's cell());
 *   • the t1104 spoken-zero law — a zero the walk SPOKE exports as 0
 *     (a spoken zero is TRUE; the empty cell is reserved for silence);
 *   • the t1029 name-address law — the identity cell speaks the row's
 *     own key (the ISO stamp, deterministic, parse-back-able), never a
 *     relative age (the paper's "just now" is width economy, not data);
 *   • the t1030 view-mirror law — the door exports the rows the strip
 *     SPEAKS: the remembered ring, chronological — the present's own
 *     numbers stay OUT (they are the row's present, never duplicated
 *     into the memory — the same law the ring's storage keeps).
 */

import type { CsvRow } from "@/lib/chart-export";
import { fileSlug } from "@/lib/chart-export";

/** the head words — the band's own faces, in the strip's own order
 *  (the address first, then the two channels; rowsToCsv speaks the
 *  first row's keys as the header, so this order IS the file's). */
export const FLEET_RING_CSV_HEAD = ["Measured at", "Cluster", "Mirrors"] as const;

/** one remembered measure — the ring row's own shape (the sidecar's
 *  and the dialogs' FleetHistoryPointRow: the mirror key rides
 *  optional — channel-young points lack it). */
export interface FleetRingExportPoint {
  at: string;
  bytes: number | null;
  mirrorBytes?: number | null;
}

/** the file's name — the connection's own word, slugged (the family's
 *  fileSlug law): `fleet-ring-mock-cluster.csv`. */
export function fleetRingCsvName(connectionName: string): string {
  return `fleet-ring-${fileSlug(connectionName || "connection")}`;
}

/** the ring's rows — chronological (the strip's draw order), one row
 *  per remembered measure. The keys of the first row ARE the head
 *  words; the hole's cell stays nullish (the house CSV speaks the
 *  empty word for it) and the spoken zero travels its own digit. */
export function fleetRingCsvRows(history: FleetRingExportPoint[]): CsvRow[] {
  return [...history].reverse().map((p) => ({
    [FLEET_RING_CSV_HEAD[0]]: p.at,
    [FLEET_RING_CSV_HEAD[1]]: p.bytes,
    [FLEET_RING_CSV_HEAD[2]]: p.mirrorBytes,
  }));
}
