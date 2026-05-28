// admin.js — owner/staff dashboard.
// Simple password gate (no accounts, no Google login). The password is checked
// in the browser and "remembered" in localStorage so you stay unlocked on your
// phone. Live booking list (onSnapshot) → approve / cancel / complete + WhatsApp.
//
// ⚠️ SECURITY NOTE: this password is NOT real security — it is visible in this
// file and only hides the UI. The Firestore database is open (see
// ../firestore.rules), so anyone with the project ID can read/edit bookings.
// Acceptable for a small local business; do not store anything sensitive.

import { db } from "./firebase.js";
import {
  collection, query, where, orderBy, onSnapshot,
  doc, updateDoc, addDoc, deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 👇 Change this to your own password.
const DASHBOARD_PASSWORD = "rental2026";
const UNLOCK_KEY = "rental_dashboard_unlocked";

const $ = (id) => document.getElementById(id);

const els = {
  locked: $("locked"), unlocked: $("unlocked"),
  password: $("password"), unlockBtn: $("unlockBtn"), lockBtn: $("lockBtn"),
  authMsg: $("authMsg"), whoami: $("whoami"),
  list: $("list"), empty: $("empty"),
  revenue: $("revenue"),
  tabPending: $("tabPending"), tabUpcoming: $("tabUpcoming"), tabAll: $("tabAll"),
  // Add-vehicle form
  vName: $("vName"), vType: $("vType"), vNumberPlate: $("vNumberPlate"),
  vCapacity: $("vCapacity"), vRate: $("vRate"),
  addVehicleBtn: $("addVehicleBtn"), vehicleMsg: $("vehicleMsg"),
  vehicleList: $("vehicleList"),
};

let unsubscribe = null;       // active bookings listener
let unsubVehicles = null;     // active vehicles listener
let activeTab = "Pending";

const fmt = (ts) =>
  ts?.toDate
    ? ts.toDate().toLocaleString("en-IN", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      })
    : "—";

// ---------- Lock / unlock ----------

function unlock() {
  localStorage.setItem(UNLOCK_KEY, "1");
  els.authMsg.classList.add("hidden");
  els.locked.classList.add("hidden");
  els.unlocked.classList.remove("hidden");
  els.whoami.textContent = "Manage bookings";
  watch(activeTab);
  watchVehicles();
}

function lock() {
  localStorage.removeItem(UNLOCK_KEY);
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  if (unsubVehicles) { unsubVehicles(); unsubVehicles = null; }
  els.unlocked.classList.add("hidden");
  els.locked.classList.remove("hidden");
  els.password.value = "";
  els.whoami.textContent = "Enter password to manage bookings";
}

function tryUnlock() {
  if (els.password.value === DASHBOARD_PASSWORD) {
    unlock();
  } else {
    els.authMsg.textContent = "Wrong password.";
    els.authMsg.classList.remove("hidden");
  }
}

els.unlockBtn.addEventListener("click", tryUnlock);
els.password.addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryUnlock();
});
els.lockBtn.addEventListener("click", lock);

// Stay unlocked across page reloads on the same device.
if (localStorage.getItem(UNLOCK_KEY) === "1") {
  unlock();
}

// ---------- Live list ----------

function setTab(tab) {
  activeTab = tab;
  watch(tab);
}
els.tabPending.addEventListener("click", () => setTab("Pending"));
els.tabUpcoming.addEventListener("click", () => setTab("Approved"));
els.tabAll.addEventListener("click", () => setTab("All"));

function watch(tab) {
  if (unsubscribe) unsubscribe();

  let q;
  if (tab === "All") {
    q = query(collection(db, "bookings"), orderBy("start", "desc"));
  } else {
    q = query(
      collection(db, "bookings"),
      where("status", "==", tab),
      orderBy("start", "asc"),
    );
  }

  unsubscribe = onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render(rows);
      updateRevenue(rows);
    },
    (err) => {
      els.list.innerHTML =
        '<div class="msg bad">Could not load bookings. Check your Firestore rules and indexes.</div>';
      console.error(err);
    },
  );
}

function updateRevenue(rows) {
  // Sum advancePaid on Completed bookings as a simple "collected" figure.
  const total = rows
    .filter((r) => r.status === "Completed")
    .reduce((sum, r) => sum + (Number(r.advancePaid) || 0), 0);
  els.revenue.textContent = `₹${total}`;
}

function render(rows) {
  els.empty.classList.toggle("hidden", rows.length > 0);
  els.list.innerHTML = rows.map(card).join("");
  wireActions(rows);
}

function card(b) {
  const actions = [];

  if (b.status === "Pending") {
    actions.push(`<button class="ok sm" data-act="approve" data-id="${b.id}">Approve</button>`);
  }
  if (b.status === "Pending" || b.status === "Approved") {
    actions.push(`<button class="bad sm" data-act="cancel" data-id="${b.id}">Cancel</button>`);
  }
  if (b.status === "Approved") {
    actions.push(`<button class="sm" data-act="complete" data-id="${b.id}">Mark done</button>`);
  }
  if (b.status === "Approved" || b.status === "Pending") {
    actions.push(`<button class="ghost sm" data-act="whatsapp" data-id="${b.id}">WhatsApp</button>`);
  }

  return `
    <div class="booking">
      <h3>${b.vehicleName || b.vehicleId}
        <span class="chip ${b.status}">${b.status}</span>
      </h3>
      <div class="meta">${b.customerName} · ${b.customerPhone}</div>
      <div class="meta">${fmt(b.start)} → ${fmt(b.end)}</div>
      <div class="meta">Total ₹${b.totalAmount ?? 0} · Advance ₹${b.advancePaid ?? 0} · Balance ₹${b.balance ?? 0}</div>
      ${b.notes ? `<div class="meta">📝 ${b.notes}</div>` : ""}
      <div class="actions row">${actions.join("") || '<span class="muted">No actions</span>'}</div>
    </div>`;
}

// ---------- Actions ----------

const setStatus = (id, status) =>
  updateDoc(doc(db, "bookings", id), { status });

function wireActions(rows) {
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  els.list.querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const { act, id } = btn.dataset;
      const b = byId[id];
      try {
        if (act === "approve") await setStatus(id, "Approved");
        else if (act === "cancel") await setStatus(id, "Cancelled");
        else if (act === "complete") await setStatus(id, "Completed");
        else if (act === "whatsapp") whatsappConfirm(b);
      } catch (err) {
        alert(err.message || "Action failed.");
        console.error(err);
      }
    });
  });
}

// ---------- Vehicles (add / list / delete) ----------

function vehicleMsg(type, text) {
  els.vehicleMsg.className = `msg ${type}`;
  els.vehicleMsg.textContent = text;
  els.vehicleMsg.classList.remove("hidden");
}

els.addVehicleBtn.addEventListener("click", async () => {
  const name = els.vName.value.trim();
  const type = els.vType.value;
  const rate = Number(els.vRate.value);

  if (!name) return vehicleMsg("bad", "Please enter a name.");
  if (!(rate > 0)) return vehicleMsg("bad", "Please enter a valid hourly rate.");

  els.addVehicleBtn.disabled = true;
  try {
    await addDoc(collection(db, "vehicles"), {
      name,
      type,
      numberPlate: type === "Truck" ? els.vNumberPlate.value.trim() : "",
      capacity: els.vCapacity.value.trim(),
      hourlyRate: rate,
      status: "Active",
    });
    // Clear the form.
    els.vName.value = "";
    els.vNumberPlate.value = "";
    els.vCapacity.value = "";
    els.vRate.value = "";
    vehicleMsg("ok", `✅ Added ${name}. It now appears in the customer dropdown.`);
  } catch (err) {
    vehicleMsg("bad", err.message || "Could not add vehicle.");
    console.error(err);
  } finally {
    els.addVehicleBtn.disabled = false;
  }
});

function watchVehicles() {
  if (unsubVehicles) unsubVehicles();
  const q = query(collection(db, "vehicles"), orderBy("type"));
  unsubVehicles = onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderVehicles(rows);
    },
    (err) => {
      els.vehicleList.innerHTML =
        '<div class="msg bad">Could not load vehicles.</div>';
      console.error(err);
    },
  );
}

function renderVehicles(rows) {
  if (!rows.length) {
    els.vehicleList.innerHTML = '<p class="muted">No vehicles yet.</p>';
    return;
  }
  els.vehicleList.innerHTML = rows
    .map(
      (v) => `
      <div class="booking" style="padding:8px 12px">
        <div class="meta">
          <strong>${v.name}</strong> · ${v.type} · ₹${v.hourlyRate}/hr
          ${v.capacity ? ` · ${v.capacity}` : ""}
          ${v.status && v.status !== "Active" ? ` · ${v.status}` : ""}
        </div>
        <button class="bad sm" data-del-vehicle="${v.id}" style="margin-top:8px">Delete</button>
      </div>`,
    )
    .join("");

  els.vehicleList.querySelectorAll("button[data-del-vehicle]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.delVehicle;
      if (!confirm("Delete this vehicle? It will disappear from the customer form.")) return;
      try {
        await deleteDoc(doc(db, "vehicles", id));
      } catch (err) {
        alert(err.message || "Could not delete.");
        console.error(err);
      }
    });
  });
}

// WhatsApp click-to-send — free, no Cloud Function (Spark plan friendly).
function whatsappConfirm(b) {
  const when = b.start?.toDate ? b.start.toDate().toLocaleString("en-IN") : "";
  const msg =
    `Hi ${b.customerName}, your booking for ${b.vehicleName || b.vehicleId} ` +
    `on ${when} is CONFIRMED. ` +
    `Advance: Rs ${b.advancePaid ?? 0}. Balance: Rs ${b.balance ?? 0}.`;
  const phone = String(b.customerPhone || "").replace(/\D/g, "");
  window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, "_blank");
}
