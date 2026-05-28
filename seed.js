// seed.js — one-time loader for vehicles / drivers / staff (DUMMY DATA).
//
// Run this ONCE after creating your Firebase project to populate Firestore so
// the app has something to show. Replace the dummy rows with your real data.
//
//   npm install firebase
//   node seed.js
//
// NOTE: with strict Security Rules, writes from an unauthenticated script are
// blocked. Easiest options:
//   (a) Run this while Firestore is still in "test mode" (before pasting rules), OR
//   (b) Temporarily relax rules, run seed, then re-apply the locked-down rules, OR
//   (c) Use the Firebase Admin SDK with a service-account key (bypasses rules).
// For a 5-vehicle business, (a) is simplest.

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, Timestamp } from "firebase/firestore";

// 👇 Same config as public/firebase.js — paste your project keys here too.
const firebaseConfig = {
  apiKey: "AIzaSyACzyCBmUig_ZY3Y-Afu-v9pQhNe0YWFJc",
  authDomain: "rental-service-5f816.firebaseapp.com",
  projectId: "rental-service-5f816",
  storageBucket: "rental-service-5f816.firebasestorage.app",
  messagingSenderId: "42980088047",
  appId: "1:42980088047:web:8326e1aec18e5afb3de31a",
  measurementId: "G-BB7HXZ257R",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------- DUMMY DATA ----------

const vehicles = [
  { id: "V001", name: "Tata 407 Truck",   type: "Truck",     numberPlate: "KA01AB1234", capacity: "2 Ton",  hourlyRate: 600, status: "Active" },
  { id: "V002", name: "Ashok Leyland 6T", type: "Truck",     numberPlate: "KA01CD5678", capacity: "6 Ton",  hourlyRate: 900, status: "Active" },
  { id: "V003", name: "Kirloskar 25 kVA", type: "Generator", numberPlate: "",           capacity: "25 kVA", hourlyRate: 400, status: "Active" },
  { id: "V004", name: "Cummins 62 kVA",   type: "Generator", numberPlate: "",           capacity: "62 kVA", hourlyRate: 750, status: "Active" },
  { id: "V005", name: "Mahindra Pickup",  type: "Truck",     numberPlate: "KA01EF9012", capacity: "1 Ton",  hourlyRate: 450, status: "Under Maintenance" },
];

// No drivers and no staff/login — the dashboard uses a client-side password
// (see admin.js). Bookings keep an optional driverId field, left empty.

// One sample booking so the dashboard isn't empty on first run.
const sampleBookings = [
  {
    id: "SAMPLE001",
    customerName: "Demo Customer",
    customerPhone: "9123456789",
    vehicleId: "V001",
    vehicleName: "Tata 407 Truck",
    start: Timestamp.fromDate(new Date("2026-06-01T09:00:00")),
    end: Timestamp.fromDate(new Date("2026-06-01T12:00:00")),
    status: "Pending",
    driverId: null,
    totalAmount: 1800,
    advancePaid: 0,
    balance: 1800,
    notes: "Sample seeded booking — safe to cancel.",
    source: "Customer",
    createdAt: Timestamp.now(),
  },
];

// ---------- WRITE ----------

async function seed() {
  for (const v of vehicles) await setDoc(doc(db, "vehicles", v.id), v);
  for (const b of sampleBookings) {
    const { id, ...data } = b;
    await setDoc(doc(db, "bookings", id), data);
  }
  console.log(
    `✅ Seeded ${vehicles.length} vehicles, ` +
      `${sampleBookings.length} sample booking(s).`,
  );
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
