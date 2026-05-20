const firebaseConfig = window.firebaseConfig || {};
const isFirebaseConfigured = Boolean(window.isFirebaseConfigured);

const defaultRooms = [
  { id: "switch-desk", name: "Switch System Desk", type: "Individual Desk", capacity: 10, price: 120, seatPrefix: "S", active: true },
  { id: "pc-desk", name: "PC Desk", type: "Computer Desk", capacity: 10, price: 180, seatPrefix: "PC", active: true },
  { id: "group-table", name: "Group Table", type: "Student Group Seat", capacity: 10, price: 150, seatPrefix: "G", active: true },
  { id: "board-room", name: "Board Room", type: "Private Room", capacity: 2, price: 500, seatPrefix: "BR", active: true }
];

const defaultSlots = [
  { id: "morning", label: "Morning", start: "06:00", end: "10:00", active: true },
  { id: "midday", label: "Midday", start: "10:00", end: "14:00", active: true },
  { id: "evening", label: "Evening", start: "14:00", end: "18:00", active: true },
  { id: "night", label: "Night", start: "18:00", end: "22:00", active: true },
  { id: "full-day", label: "Full Day", start: "06:00", end: "22:00", active: true }
];

const storeKey = "elite-study-room-demo-db";
const isPlaceholder = (value) => String(value || "").startsWith("local-");
const todayIso = () => new Date().toISOString().slice(0, 10);

const demoDb = () => {
  const saved = localStorage.getItem(storeKey);
  if (saved) return JSON.parse(saved);

  const initial = {
    rooms: defaultRooms,
    slots: defaultSlots,
    bookings: [
      {
        id: "demo-booking",
        userName: "Demo Student",
        phone: "9999999999",
        email: "student@example.com",
        roomId: "silent-zone",
        roomName: "Silent Zone",
        slotId: "morning",
        slotLabel: "Morning",
        seatId: "S1",
        seatLabel: "S1",
        date: todayIso(),
        notes: "Sample booking",
        status: "pending",
        source: "demo",
        createdAt: new Date().toISOString()
      }
    ]
  };
  localStorage.setItem(storeKey, JSON.stringify(initial));
  return initial;
};

const saveDemoDb = (db) => localStorage.setItem(storeKey, JSON.stringify(db));
const normalizeDoc = (docSnap) => ({ id: docSnap.id, ...docSnap.data() });

let firebaseApiPromise = null;
async function firebaseApi() {
  if (!isFirebaseConfigured) return null;
  if (!firebaseApiPromise) {
    firebaseApiPromise = Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js")
    ]).then(([appModule, firestoreModule]) => {
      const app = appModule.initializeApp(firebaseConfig);
      const db = firestoreModule.getFirestore(app);
      return { db, ...firestoreModule };
    });
  }
  return firebaseApiPromise;
}

async function list(collectionName) {
  const api = await firebaseApi();
  if (!api) {
    const db = demoDb();
    return [...db[collectionName]];
  }

  const { db, collection, getDocs, query, orderBy } = api;
  const orderField = collectionName === "bookings" ? "createdAt" : collectionName === "slots" ? "label" : "name";
  try {
    const snap = await getDocs(query(collection(db, collectionName), orderBy(orderField, "desc")));
    return snap.docs.map(normalizeDoc);
  } catch {
    const snap = await getDocs(collection(db, collectionName));
    return snap.docs.map(normalizeDoc);
  }
}

async function add(collectionName, data) {
  const api = await firebaseApi();
  if (!api) {
    const db = demoDb();
    const clean = { ...data, id: `${collectionName}-${Date.now()}`, createdAt: new Date().toISOString() };
    db[collectionName].push(clean);
    saveDemoDb(db);
    return clean.id;
  }

  const { db, collection, addDoc, serverTimestamp } = api;
  const clean = { ...data, createdAt: serverTimestamp() };
  const ref = await addDoc(collection(db, collectionName), clean);
  return ref.id;
}

async function update(collectionName, id, data) {
  const api = await firebaseApi();
  if (!api) {
    const db = demoDb();
    db[collectionName] = db[collectionName].map((item) => (item.id === id ? { ...item, ...data } : item));
    saveDemoDb(db);
    return;
  }

  const { db, doc, updateDoc } = api;
  await updateDoc(doc(db, collectionName, id), data);
}

async function remove(collectionName, id) {
  const api = await firebaseApi();
  if (!api) {
    const db = demoDb();
    db[collectionName] = db[collectionName].filter((item) => item.id !== id);
    saveDemoDb(db);
    return;
  }

  const { db, doc, deleteDoc } = api;
  await deleteDoc(doc(db, collectionName, id));
}

export const eliteDb = {
  isFirebaseConfigured,
  defaultRooms,
  defaultSlots,
  rooms: () => list("rooms"),
  slots: () => list("slots"),
  bookings: () => list("bookings"),
  createBooking: (booking) => add("bookings", { ...booking, status: "pending", source: "online" }),
  updateBooking: (id, data) => update("bookings", id, data),
  deleteBooking: (id) => remove("bookings", id),
  saveRoom: (room) => (room.id && !isPlaceholder(room.id) ? update("rooms", room.id, room) : add("rooms", room)),
  saveSlot: (slot) => (slot.id && !isPlaceholder(slot.id) ? update("slots", slot.id, slot) : add("slots", slot)),
  deleteRoom: (id) => remove("rooms", id),
  deleteSlot: (id) => remove("slots", id),
  seedDefaults: async () => {
    const [rooms, slots] = await Promise.all([list("rooms"), list("slots")]);
    const roomNames = new Set(rooms.map((room) => room.name));
    const slotLabels = new Set(slots.map((slot) => slot.label));
    const missingRooms = defaultRooms.filter((room) => !roomNames.has(room.name));
    const missingSlots = defaultSlots.filter((slot) => !slotLabels.has(slot.label));
    if (missingRooms.length > 0) await Promise.all(missingRooms.map(({ id, ...room }) => add("rooms", room)));
    if (missingSlots.length > 0) await Promise.all(missingSlots.map(({ id, ...slot }) => add("slots", slot)));
  },
  resetDemoDefaults: () => {
    const initial = {
      rooms: defaultRooms,
      slots: defaultSlots,
      bookings: []
    };
    saveDemoDb(initial);
    return initial;
  }
};
