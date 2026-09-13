import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fareSources } from "../data/fareSources";
import type { TransitResult } from "../types";
import { loadOfficialFares, resolveOfficialFare, type FareDocument } from "./officialFares";

const document = (country: string): FareDocument => JSON.parse(readFileSync(`public/fares/${country}.json`, "utf8"));
const hk = document("hong_kong"), kr = document("korea"), us = document("united_states");
const base: TransitResult = { id: "fare-test", country: "hong_kong", operator: "MTR", service: "Tsuen Wan Line", date: hk.observedOn,
  origin: "Central", destination: "Admiralty", departureTime: "10:00", direct: true, stops: [] };
const korean: TransitResult = { ...base, country: "korea", operator: "Korail", trainType: "무궁화", service: "Mugunghwa 1201", origin: "Seoul", destination: "Suwon", date: kr.observedOn };
const american: TransitResult = { ...base, country: "united_states", operator: "MBTA", service: "Red Line", origin: "Alewife", destination: "Davis", date: "2026-09-13" };

describe("official fare documents", () => {
  it.each(Object.keys(fareSources))("keeps %s separate and never exports a timetable", country => {
    const doc = document(country);
    expect(doc.schemaVersion).toBe(1);
    expect(doc.country).toBe(country);
    expect(doc.sources.length).toBeGreaterThan(0);
    expect(doc.sources.every(s => s.url.startsWith("https://"))).toBe(true);
    expect(doc.gtfs || {}).not.toHaveProperty("trips");
    expect(doc.gtfs || {}).not.toHaveProperty("stop_times");
  });

  it("reads the MTR adult single ticket, rather than the discounted Octopus fare", () => {
    expect(resolveOfficialFare(base, hk)).toMatchObject({ amount: 5, currency: "HKD", labelEn: expect.stringContaining("Single Journey") });
    expect(resolveOfficialFare({ ...base, origin: "中環", destination: "金鐘" }, hk)?.amount).toBe(5);
  });
  it.each([
    { operator: "Other" }, { seatClass: "first" }, { service: "Airport Express", origin: "Hong Kong", destination: "Kowloon" },
    { destination: "Unknown" }, { destination: "Central" }, { direct: false }, { service: "Guessed line" },
    { date: "2026-02-30" }, { date: "2026-09-14" }, { date: undefined, realtime: false }, { provenance: "curated" },
  ])("hides a mismatched/unknown MTR fare: %j", changes => {
    expect(resolveOfficialFare({ ...base, ...changes } as TransitResult, hk)).toBeNull();
  });
  it("uses operator-local date for an undated live departure", () => {
    expect(resolveOfficialFare({ ...base, date: undefined, realtime: true }, hk, new Date("2026-09-12T17:00:00Z"))?.amount).toBe(5);
    expect(resolveOfficialFare({ ...base, date: undefined, realtime: true }, hk, new Date("2026-09-13T17:00:00Z"))).toBeNull();
  });
  it("matches Korail bilingual station identities and published intervals in either direction", () => {
    expect(resolveOfficialFare(korean, kr)).toMatchObject({ amount: 2700, currency: "KRW" });
    expect(resolveOfficialFare({ ...korean, origin: "수원", destination: "서울" }, kr)?.amount).toBe(2700);
    expect(resolveOfficialFare({ ...korean, legs: [{ origin: "Seoul", destination: "Suwon", lineName: korean.service, mode: "train" }] }, kr)?.amount).toBe(2700);
  });
  it("rejects Korail via-route ambiguity and does not manufacture first-class prices", () => {
    expect(resolveOfficialFare({ ...korean, trainType: "KTX", destination: "Busan" }, kr)).toBeNull();
    expect(resolveOfficialFare({ ...korean, seatClass: "first" }, kr)).toBeNull();
    expect(resolveOfficialFare({ ...korean, trainType: "SRT" }, kr)).toBeNull();
    expect(resolveOfficialFare({ ...korean, date: "2025-09-26" }, kr)).toBeNull();
  });
  it("matches the MBTA route, both stops, product, medium and service calendar", () => {
    expect(resolveOfficialFare(american, us)).toMatchObject({ amount: 2.4, currency: "USD", labelEn: "Adult · CharlieTicket" });
    expect(resolveOfficialFare({ ...american, service: "Blue Line" }, us)).toBeNull();
    expect(resolveOfficialFare({ ...american, direct: false }, us)).toBeNull();
    expect(resolveOfficialFare({ ...american, date: "2027-01-01" }, us)).toBeNull();
    expect(resolveOfficialFare({ ...american, operator: "Amtrak" }, us)).toBeNull();
  });
  it("does not fall through to a cheaper generic rule when a specific MBTA timeframe is unknown", () => {
    const doc = structuredClone(us);
    doc.gtfs!.timeframes[0].start_time = "06:00:00";
    expect(resolveOfficialFare(american, doc)).toBeNull();
  });
  it("fails closed on malformed amounts, country mismatch and missing identity data", () => {
    const doc = structuredClone(hk);
    doc.rows = doc.rows!.map(r => [r[0], r[1], r[2], NaN]);
    expect(resolveOfficialFare(base, doc)).toBeNull();
    expect(resolveOfficialFare(base, kr)).toBeNull();
    expect(resolveOfficialFare(american, { ...us, gtfs: {} })).toBeNull();
  });
});

describe("fare download recovery", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });
  it("evicts a failed request so reopening details retries", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ ok: true, json: async () => hk });
    vi.stubGlobal("fetch", fetcher);
    await expect(loadOfficialFares("hong_kong")).rejects.toThrow("offline");
    await expect(loadOfficialFares("hong_kong")).resolves.toEqual(hk);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("bounds a stalled response body and allows another attempt", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: () => new Promise(() => {}) }).mockResolvedValue({ ok: true, json: async () => kr });
    vi.stubGlobal("fetch", fetcher);
    const request = expect(loadOfficialFares("korea")).rejects.toThrow("timeout");
    await vi.advanceTimersByTimeAsync(4000);
    await request;
    await expect(loadOfficialFares("korea")).resolves.toEqual(kr);
  });
});
