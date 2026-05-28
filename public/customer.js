// customer.js — wires the public booking form (index.html) to createBooking().
// No login. Public users can only read vehicles and create a Pending booking
// (enforced by Firestore rules — the UI just makes it pleasant).

import { db } from "./firebase.js";
import { createBooking } from "./booking.js";
import {
  collection, query, where, getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const form = $("bookingForm");
const truckSelect = $("truckId");
const generatorSelect = $("generatorId");
const message = $("message");
const submitBtn = $("submitBtn");

// Keep loaded vehicles to validate the customer's selection.
let vehicles = [];

function show(type, text) {
  message.className = `msg ${type}`;
  message.textContent = text;
}

// A customer may pick a truck, a generator, or both. Returns the chosen
// vehicle ids (0, 1, or 2 of them).
function selectedVehicleIds() {
  return [truckSelect.value, generatorSelect.value].filter(Boolean);
}

function fillSelect(sel, items, label) {
  if (!items.length) {
    sel.innerHTML = `<option value="">No ${label}s available</option>`;
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  sel.innerHTML =
    `<option value="">Select a ${label}…</option>` +
    items
      .map(
        (v) =>
          `<option value="${v.id}">${v.name} — ₹${v.hourlyRate}/hr${
            v.capacity ? ` (${v.capacity})` : ""
          }</option>`,
      )
      .join("");
}

async function loadVehicles() {
  try {
    const q = query(collection(db, "vehicles"), where("status", "==", "Active"));
    const snap = await getDocs(q);
    vehicles = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    fillSelect(truckSelect, vehicles.filter((v) => v.type === "Truck"), "truck");
    fillSelect(generatorSelect, vehicles.filter((v) => v.type === "Generator"), "generator");
  } catch (err) {
    truckSelect.innerHTML = '<option value="">Could not load</option>';
    generatorSelect.innerHTML = '<option value="">Could not load</option>';
    show("bad", "Couldn’t load vehicles. Please refresh and try again.");
    console.error(err);
  }
}


form.addEventListener("submit", async (e) => {
  e.preventDefault();
  message.classList.add("hidden");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting…";

  try {
    const ids = selectedVehicleIds();
    if (!ids.length) throw new Error("Please select a truck and/or a generator.");

    const base = {
      customerName: $("customerName").value,
      customerPhone: $("customerPhone").value,
      start: new Date($("start").value),
      end: new Date($("end").value),
      notes: $("notes").value,
      source: "Customer",
    };

    // One booking per item, so each is priced and availability-checked
    // independently. Done in sequence so a clash message is clear.
    for (const vehicleId of ids) {
      await createBooking({ ...base, vehicleId });
    }

    form.reset();
    message.classList.remove("hidden");
    const word = ids.length > 1 ? "requests" : "request";
    show("ok", `✅ Thanks! We’ve received your ${word} and will confirm shortly.`);
  } catch (err) {
    message.classList.remove("hidden");
    show("bad", err.message || "Something went wrong. Please try again.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Request booking";
  }
});

loadVehicles();
