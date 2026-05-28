// booking.js — race-safe booking creation.
//
// The heart of the app: prevent double-booking the same vehicle for an
// overlapping time slot. Overlap rule (see ../../04-shared-data-model.md):
//
//     existing.start < new.end   AND   existing.end > new.start
//
// Firestore allows a range filter on only ONE field, so half the test lives
// in the query (start < end) and half in JS (end > start). The whole check +
// write runs inside a transaction so two simultaneous bookings can't both win.

import { db } from "./firebase.js";
import {
  collection, query, where, getDocs, getDoc,
  runTransaction, doc, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Hours between two Date objects (can be fractional, e.g. 2.5h).
function hoursBetween(start, end) {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

/**
 * Create a Pending booking, rejecting if it clashes with an existing
 * Pending/Approved booking on the same vehicle.
 *
 * @param {Object} b
 * @param {string} b.customerName
 * @param {string} b.customerPhone
 * @param {string} b.vehicleId
 * @param {Date}   b.start
 * @param {Date}   b.end
 * @param {number} [b.advancePaid=0]
 * @param {string} [b.notes=""]
 * @param {"Customer"|"Staff"} [b.source="Customer"]
 * @returns {Promise<string>} the new booking id
 */
export async function createBooking(b) {
  if (!b.vehicleId) throw new Error("Please pick a vehicle.");
  if (!b.customerName?.trim()) throw new Error("Please enter your name.");
  if (!b.customerPhone?.trim()) throw new Error("Please enter your phone number.");
  if (!(b.start instanceof Date) || !(b.end instanceof Date)) {
    throw new Error("Start and end time are required.");
  }
  if (b.end <= b.start) throw new Error("End time must be after start time.");

  // Half of the overlap test (existing.start < new.end) runs server-side.
  const clashQuery = query(
    collection(db, "bookings"),
    where("vehicleId", "==", b.vehicleId),
    where("status", "in", ["Pending", "Approved"]),
    where("start", "<", Timestamp.fromDate(b.end)),
  );

  return await runTransaction(db, async (tx) => {
    // Pull the vehicle to compute the amount and confirm it exists/active.
    const vehicleRef = doc(db, "vehicles", b.vehicleId);
    const vehicleSnap = await getDoc(vehicleRef);
    if (!vehicleSnap.exists()) throw new Error("That vehicle no longer exists.");
    const vehicle = vehicleSnap.data();
    if (vehicle.status && vehicle.status !== "Active") {
      throw new Error(`${vehicle.name} is currently ${vehicle.status}.`);
    }

    // Second half of the overlap test (existing.end > new.start) in JS.
    const snap = await getDocs(clashQuery);
    const clash = snap.docs.some((d) => d.data().end.toDate() > b.start);
    if (clash) {
      throw new Error("❌ This vehicle is already booked for that time slot.");
    }

    // Derived values (see shared data model).
    const hours = hoursBetween(b.start, b.end);
    const hourlyRate = Number(vehicle.hourlyRate) || 0;
    const totalAmount = Math.round(hourlyRate * hours);
    const advancePaid = Number(b.advancePaid) || 0;
    const balance = totalAmount - advancePaid;

    const ref = doc(collection(db, "bookings"));
    tx.set(ref, {
      customerName: b.customerName.trim(),
      customerPhone: b.customerPhone.trim(),
      vehicleId: b.vehicleId,
      vehicleName: vehicle.name || "",
      start: Timestamp.fromDate(b.start),
      end: Timestamp.fromDate(b.end),
      status: "Pending",
      driverId: b.driverId || null,
      totalAmount,
      advancePaid,
      balance,
      notes: b.notes?.trim() || "",
      source: b.source || "Customer",
      createdAt: Timestamp.now(),
    });
    return ref.id;
  });
}
