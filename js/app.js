/**
 * Cabin — read-only vehicle status UI
 * Polls data/vehicle.json every 3s; gently mutates live fields client-side.
 */

const POLL_MS = 3000;
const CIRCUMFERENCE = 2 * Math.PI * 85;

let vehicleData = null;
let pollTimer = null;
let muteTimer = null;

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

function initNav() {
  $$(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.section;
      $$(".nav-btn").forEach((b) => b.classList.remove("active"));
      $$(".section").forEach((s) => s.classList.remove("active"));
      btn.classList.add("active");
      const target = $(`#section-${section}`);
      if (target) target.classList.add("active");
    });
  });
}

async function fetchVehicle() {
  try {
    const res = await fetch(`data/vehicle.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    vehicleData = await res.json();
    renderAll(vehicleData);
    updateLiveBar(true);
  } catch (err) {
    console.warn("Cabin poll failed:", err.message);
    updateLiveBar(false);
  }
}

function updateLiveBar(ok) {
  const el = $("#live-status");
  if (!el) return;
  const now = new Date();
  const local = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Chicago",
  });
  el.textContent = ok ? `Updated ${local} CT` : `Offline · last try ${local} CT`;
}

function startMute() {
  if (muteTimer) clearInterval(muteTimer);
  muteTimer = setInterval(() => {
    if (!vehicleData) return;
    const b = vehicleData.battery;
    const c = vehicleData.climate;
    if (!b.charging) b.power_kw = +(-0.2 - Math.random() * 0.25).toFixed(2);
    c.inside_f = +(c.inside_f + (Math.random() - 0.5) * 0.3).toFixed(1);
    c.inside_f = Math.min(85, Math.max(55, c.inside_f));
    c.outside_f = +(c.outside_f + (Math.random() - 0.5) * 0.2).toFixed(1);
    if (Math.random() < 0.05) {
      vehicleData.vehicle.odometer_mi = +(vehicleData.vehicle.odometer_mi + 0.1).toFixed(1);
    }
    renderClimate(vehicleData);
    renderOverviewLive(vehicleData);
    renderChargeLive(vehicleData);
  }, 1800);
}

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }) + " CT";
  } catch {
    return iso;
  }
}

function batteryColor(pct) {
  if (pct <= 15) return "#f87171";
  if (pct <= 30) return "#fbbf24";
  return "#34d399";
}

function renderAll(d) {
  renderHeader(d);
  renderOverview(d);
  renderCharge(d);
  renderClimate(d);
  renderSecurity(d);
  renderSoftware(d);
  renderLocation(d);
  renderHistory(d);
}

function renderHeader(d) {
  const v = d.vehicle;
  $("#vehicle-name").textContent = v.name;
  $("#vehicle-model").textContent = `${v.model} · …${v.vin_suffix}`;
  const pill = $("#state-pill");
  const state = v.state || "unknown";
  pill.querySelector(".state-text").textContent = state;
  pill.classList.toggle("warn", state === "driving" || state === "offline");
}

function setRing(pct) {
  const ring = $("#battery-ring");
  if (!ring) return;
  const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, pct)) / 100);
  ring.style.strokeDasharray = String(CIRCUMFERENCE);
  ring.style.strokeDashoffset = String(offset);
  ring.style.stroke = batteryColor(pct);
}

function renderOverview(d) {
  const b = d.battery;
  const s = d.security;
  const c = d.climate;
  $("#ov-pct").textContent = Math.round(b.percent);
  $("#ov-range").textContent = Math.round(b.range_mi);
  $("#ov-odo").textContent = d.vehicle.odometer_mi.toLocaleString("en-US", { maximumFractionDigits: 1 });
  $("#ov-inside").textContent = Math.round(c.inside_f);
  $("#ov-outside").textContent = Math.round(c.outside_f);
  setRing(b.percent);
  setChip("chip-lock", s.locked, s.locked ? "Locked" : "Unlocked");
  setChip("chip-sentry", s.sentry_mode, s.sentry_mode ? "Sentry" : "Sentry off");
  setChip("chip-charge", b.charging, b.charging ? "Charging" : "Not charging");
  setChip("chip-climate", c.is_climate_on, c.is_climate_on ? "Climate" : "Climate off");
}

function renderOverviewLive(d) {
  const b = d.battery;
  const c = d.climate;
  $("#ov-pct").textContent = Math.round(b.percent);
  $("#ov-range").textContent = Math.round(b.range_mi);
  $("#ov-inside").textContent = Math.round(c.inside_f);
  $("#ov-outside").textContent = Math.round(c.outside_f);
  $("#ov-power").textContent = `${b.power_kw > 0 ? "+" : ""}${b.power_kw} kW`;
  $("#ov-odo").textContent = d.vehicle.odometer_mi.toLocaleString("en-US", { maximumFractionDigits: 1 });
  setRing(b.percent);
}

function setChip(id, on, label) {
  const el = $(`#${id}`);
  if (!el) return;
  el.classList.toggle("on", !!on);
  el.classList.toggle("off", !on);
  const lbl = el.querySelector(".chip-lbl");
  if (lbl) lbl.textContent = label;
}

function renderCharge(d) {
  const b = d.battery;
  $("#ch-pct").textContent = `${Math.round(b.percent)}%`;
  $("#ch-range").textContent = `${Math.round(b.range_mi)} mi`;
  $("#ch-rated").textContent = `${Math.round(b.rated_range_mi)} mi`;
  $("#ch-usable").textContent = `${b.usable_kwh} kWh`;
  $("#ch-limit").textContent = `${b.charge_limit_percent}%`;
  $("#ch-amps").textContent = `${b.charge_amps} A`;
  $("#ch-power").textContent = `${b.power_kw > 0 ? "+" : ""}${b.power_kw} kW`;
  $("#ch-status").textContent = b.charging ? "Charging" : "Idle";
  const bar = $("#ch-bar");
  if (bar) {
    bar.style.width = `${b.percent}%`;
    bar.style.background = b.percent <= 15
      ? "linear-gradient(90deg, #f87171, #fbbf24)"
      : "linear-gradient(90deg, #3d9eff, #34d399)";
  }
  const limitBar = $("#ch-limit-bar");
  if (limitBar) limitBar.style.width = `${b.charge_limit_percent}%`;
  $("#ch-ttf").textContent = b.time_to_full_min ? `${b.time_to_full_min} min` : "—";
  $("#ch-rate").textContent = b.charging ? `${b.charge_rate_mph} mph` : "—";
}

function renderChargeLive(d) {
  const b = d.battery;
  $("#ch-power").textContent = `${b.power_kw > 0 ? "+" : ""}${b.power_kw} kW`;
  $("#ch-pct").textContent = `${Math.round(b.percent)}%`;
  $("#ch-range").textContent = `${Math.round(b.range_mi)} mi`;
}

function renderClimate(d) {
  const c = d.climate;
  $("#cl-inside").textContent = c.inside_f.toFixed(1);
  $("#cl-outside").textContent = Math.round(c.outside_f);
  $("#cl-set").textContent = c.set_temp_f;
  $("#cl-status").textContent = c.is_climate_on ? "On" : "Off";
  $("#cl-auto").textContent = c.is_auto ? "Auto" : "Manual";
  $("#cl-fan").textContent = c.fan_status === 0 ? "Off" : `Lvl ${c.fan_status}`;
  $("#cl-defrost").textContent = c.defrost ? "On" : "Off";
  $("#cl-seat-l").textContent = c.seat_heater_left || "Off";
  $("#cl-seat-r").textContent = c.seat_heater_right || "Off";
}

function renderSecurity(d) {
  const s = d.security;
  const t = d.tires;
  $("#sec-locked").textContent = s.locked ? "Locked" : "Unlocked";
  $("#sec-sentry").textContent = s.sentry_mode ? "On" : "Off";
  $("#sec-doors").textContent = s.doors_open ? "Open" : "Closed";
  $("#sec-frunk").textContent = s.frunk_open ? "Open" : "Closed";
  $("#sec-trunk").textContent = s.trunk_open ? "Open" : "Closed";
  $("#sec-windows").textContent = s.windows_closed ? "Closed" : "Open";
  $("#sec-alarm").textContent = s.alarm ? "Active" : "Off";
  $("#sec-valet").textContent = s.valet_mode ? "On" : "Off";
  $("#tire-fl").textContent = t.fl_psi;
  $("#tire-fr").textContent = t.fr_psi;
  $("#tire-rl").textContent = t.rl_psi;
  $("#tire-rr").textContent = t.rr_psi;
}

function renderSoftware(d) {
  const sw = d.software;
  const v = d.vehicle;
  $("#sw-version").textContent = sw.version;
  $("#sw-build").textContent = sw.build;
  $("#sw-status").textContent = sw.status === "up_to_date" ? "Up to date" : sw.status.replace(/_/g, " ");
  $("#sw-notes").textContent = sw.release_notes;
  $("#sw-color").textContent = v.color;
  $("#sw-wheels").textContent = v.wheels;
  $("#sw-model").textContent = v.model;
}

function renderLocation(d) {
  const loc = d.location;
  $("#loc-address").textContent = loc.address;
  $("#loc-coords").textContent = `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}`;
  $("#loc-heading").textContent = `${loc.heading}°`;
  $("#loc-speed").textContent = `${loc.speed_mph} mph`;
  $("#loc-shift").textContent = loc.shift_state;
  $("#map-label").textContent = loc.address;
}

function renderHistory(d) {
  const list = $("#history-list");
  if (!list) return;
  const icons = {
    drive: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14M5 17a2 2 0 01-2-2V9l2-4h14l2 4v6a2 2 0 01-2 2M5 17a2 2 0 002 2h0a2 2 0 002-2M15 17a2 2 0 002 2h0a2 2 0 002-2M7 9h10"/></svg>`,
    charge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    sentry: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    software: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3"/></svg>`,
    climate: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4M3 12h18"/></svg>`,
  };
  list.innerHTML = d.history.map((h) => {
    const cls = h.type === "drive" ? "" : h.type;
    return `<li class="history-item"><div class="history-icon ${cls}">${icons[h.type] || icons.drive}</div><div class="history-body"><div class="history-title">${escapeHtml(h.title)}</div><div class="history-detail">${escapeHtml(h.detail)}</div><div class="history-time">${fmtTime(h.ts)}</div></div></li>`;
  }).join("");
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """);
}

function boot() {
  initNav();
  fetchVehicle();
  pollTimer = setInterval(fetchVehicle, POLL_MS);
  startMute();
}

document.addEventListener("DOMContentLoaded", boot);
