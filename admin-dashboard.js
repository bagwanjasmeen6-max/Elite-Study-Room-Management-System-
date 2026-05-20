(function () {
  if (sessionStorage.getItem("eliteAdminLoggedIn") !== "true") {
    window.location.href = "adminpass.html";
    return;
  }

  const defaultRooms = [
    { id: "switch-desk", name: "Switch System Desk", type: "Individual Desk", capacity: 10, price: 120, seatPrefix: "S" },
    { id: "pc-desk", name: "PC Desk", type: "Computer Desk", capacity: 10, price: 180, seatPrefix: "PC" },
    { id: "group-table", name: "Group Table", type: "Student Group Seat", capacity: 10, price: 150, seatPrefix: "G" },
    { id: "board-room", name: "Board Room", type: "Private Room", capacity: 2, price: 500, seatPrefix: "BR" }
  ];

  const defaultSlots = [
    { id: "morning", label: "Morning", start: "06:00", end: "10:00" },
    { id: "midday", label: "Midday", start: "10:00", end: "14:00" },
    { id: "evening", label: "Evening", start: "14:00", end: "18:00" },
    { id: "night", label: "Night", start: "18:00", end: "22:00" },
    { id: "full-day", label: "Full Day", start: "06:00", end: "22:00" }
  ];

  const storeKey = "elite-study-room-demo-db";
  const $ = (id) => document.getElementById(id);
  const state = { rooms: [], slots: [], bookings: [], activeTab: "bookings", dataSource: "local" };
  const mysqlApi = "./api/booking_api.php";
  let firestoreDb = null;

  async function mysqlRequest(action, payload) {
    const url = action ? `${mysqlApi}?action=${encodeURIComponent(action)}` : mysqlApi;
    const response = await fetch(url, {
      method: payload ? "POST" : "GET",
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "MySQL API request failed");
    }
    return result;
  }

  async function readMysqlDb() {
    const result = await mysqlRequest("");
    state.dataSource = "mysql";
    return result.data;
  }

  function firebaseReady() {
    return Boolean(window.isFirebaseConfigured && window.firebase && window.firebase.firestore);
  }

  function db() {
    if (!firebaseReady()) return null;
    if (!firestoreDb) {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(window.firebaseConfig);
      }
      firestoreDb = window.firebase.firestore();
    }
    return firestoreDb;
  }

  async function getCollection(name) {
    const snap = await db().collection(name).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async function seedFirebaseIfEmpty() {
    const database = db();
    const [roomsSnap, slotsSnap] = await Promise.all([
      database.collection("rooms").limit(1).get(),
      database.collection("slots").limit(1).get()
    ]);
    const writes = [];
    if (roomsSnap.empty) {
      defaultRooms.forEach((room) => writes.push(database.collection("rooms").doc(room.id).set(room)));
    }
    if (slotsSnap.empty) {
      defaultSlots.forEach((slot) => writes.push(database.collection("slots").doc(slot.id).set(slot)));
    }
    await Promise.all(writes);
  }

  async function readDb() {
    try {
      return await readMysqlDb();
    } catch {
      state.dataSource = "local";
    }

    if (firebaseReady()) {
      await seedFirebaseIfEmpty();
      const [rooms, slots, bookings] = await Promise.all([
        getCollection("rooms"),
        getCollection("slots"),
        getCollection("bookings")
      ]);
      return {
        rooms: rooms.length ? rooms : defaultRooms,
        slots: slots.length ? slots : defaultSlots,
        bookings
      };
    }

    try {
      const db = JSON.parse(localStorage.getItem(storeKey) || "{}");
      return {
        rooms: Array.isArray(db.rooms) && db.rooms.length ? db.rooms : defaultRooms,
        slots: Array.isArray(db.slots) && db.slots.length ? db.slots : defaultSlots,
        bookings: Array.isArray(db.bookings) ? db.bookings : []
      };
    } catch {
      return { rooms: defaultRooms, slots: defaultSlots, bookings: [] };
    }
  }

  function saveDb() {
    localStorage.setItem(storeKey, JSON.stringify({
      rooms: state.rooms,
      slots: state.slots,
      bookings: state.bookings
    }));
  }

  async function saveRoomToDb(room) {
    if (state.dataSource === "mysql") {
      await mysqlRequest("room", room);
      return;
    }

    if (firebaseReady()) {
      await db().collection("rooms").doc(room.id).set(room);
      return;
    }
    saveDb();
  }

  async function saveSlotToDb(slot) {
    if (state.dataSource === "mysql") {
      await mysqlRequest("slot", slot);
      return;
    }

    if (firebaseReady()) {
      await db().collection("slots").doc(slot.id).set(slot);
      return;
    }
    saveDb();
  }

  async function updateBookingStatus(id, status) {
    if (state.dataSource === "mysql") {
      await mysqlRequest("status", { id, status });
      return;
    }

    if (firebaseReady()) {
      await db().collection("bookings").doc(id).update({ status });
      return;
    }
    saveDb();
  }

  async function deleteDocFromDb(collection, id) {
    if (state.dataSource === "mysql") {
      await mysqlRequest("delete", { collection, id });
      return;
    }

    if (firebaseReady()) {
      await db().collection(collection).doc(id).delete();
      return;
    }
    saveDb();
  }

  function setAdminMessage(text, type) {
    const message = $("adminMessage");
    message.textContent = text;
    message.className = `notice ${type || ""}`;
    message.hidden = false;
  }

  function renderStats() {
    $("totalBookings").textContent = state.bookings.length;
    $("pendingBookings").textContent = state.bookings.filter((item) => item.status === "pending").length;
    $("approvedBookings").textContent = state.bookings.filter((item) => item.status === "approved").length;
    $("adminMessage").hidden = false;
    $("adminMessage").className = "notice";
    $("adminMessage").textContent = state.dataSource === "mysql" ? "Connected to XAMPP MySQL database." : firebaseReady() ? "Connected to Firebase database." : "Using local backup database.";
  }

  function renderBookings() {
    const search = $("bookingSearch").value.trim().toLowerCase();
    const status = $("statusFilter").value;
    const bookings = state.bookings.filter((booking) => {
      const haystack = `${booking.userName || ""} ${booking.phone || ""} ${booking.roomName || ""} ${booking.seatLabel || ""}`.toLowerCase();
      return (!search || haystack.includes(search)) && (!status || booking.status === status);
    });

    $("adminBookingList").innerHTML = bookings.length ? bookings.map((booking) => `
      <article class="item">
        <div class="item-head">
          <div>
            <h3>${booking.userName || "Student"} - ${booking.roomName || "Room"} - ${booking.seatLabel || booking.seatId || "Seat"}</h3>
            <div class="item-meta">${booking.date || ""} | ${booking.slotLabel || ""} | ${booking.phone || ""}${booking.email ? ` | ${booking.email}` : ""}</div>
          </div>
          <span class="badge ${booking.status || "pending"}">${booking.status || "pending"}</span>
        </div>
        ${booking.notes ? `<div class="item-meta">${booking.notes}</div>` : ""}
        <div class="actions">
          <button class="button" type="button" data-booking-status="approved" data-id="${booking.id}"><i class="fa-solid fa-check"></i> Approve</button>
          <button class="button secondary" type="button" data-booking-status="pending" data-id="${booking.id}"><i class="fa-solid fa-clock"></i> Pending</button>
          <button class="button danger" type="button" data-booking-status="rejected" data-id="${booking.id}"><i class="fa-solid fa-xmark"></i> Reject</button>
          <button class="button secondary" type="button" data-delete-booking="${booking.id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </article>
    `).join("") : `<div class="notice">No booking requests yet.</div>`;
  }

  function renderRooms() {
    $("roomList").innerHTML = state.rooms.map((room) => `
      <article class="item">
        <div class="item-head">
          <div>
            <h3>${room.name}</h3>
            <div class="item-meta">${room.type} | Capacity ${room.capacity} | Rs.${room.price || 0}</div>
          </div>
          <span class="badge">active</span>
        </div>
        <div class="actions">
          <button class="button secondary" type="button" data-edit-room="${room.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button class="button danger" type="button" data-delete-room="${room.id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </article>
    `).join("");
  }

  function renderSlots() {
    $("slotList").innerHTML = state.slots.map((slot) => `
      <article class="item">
        <div class="item-head">
          <div>
            <h3>${slot.label}</h3>
            <div class="item-meta">${slot.start} - ${slot.end}</div>
          </div>
          <span class="badge">active</span>
        </div>
        <div class="actions">
          <button class="button secondary" type="button" data-edit-slot="${slot.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button class="button danger" type="button" data-delete-slot="${slot.id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </article>
    `).join("");
  }

  function renderTabs() {
    document.querySelectorAll("[data-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === state.activeTab);
    });
    ["bookings", "rooms", "slots"].forEach((tab) => {
      $(`tab-${tab}`).hidden = tab !== state.activeTab;
    });
  }

  function renderAll() {
    renderStats();
    renderBookings();
    renderRooms();
    renderSlots();
    renderTabs();
  }

  async function loadAdminData() {
    const databaseData = await readDb();
    state.rooms = databaseData.rooms;
    state.slots = databaseData.slots;
    state.bookings = databaseData.bookings.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    renderAll();
  }

  async function saveRoom(event) {
    event.preventDefault();
    const id = $("roomId").value || `room-${Date.now()}`;
    const room = {
      id,
      name: $("roomName").value.trim(),
      type: $("roomType").value.trim(),
      capacity: Number($("roomCapacity").value),
      price: Number($("roomPrice").value),
      seatPrefix: $("roomName").value.trim().slice(0, 2).toUpperCase()
    };
    state.rooms = state.rooms.some((item) => item.id === id)
      ? state.rooms.map((item) => item.id === id ? room : item)
      : [...state.rooms, room];
    await saveRoomToDb(room);
    event.target.reset();
    $("roomId").value = "";
    setAdminMessage("Room saved.", "good");
    await loadAdminData();
  }

  async function saveSlot(event) {
    event.preventDefault();
    const id = $("slotId").value || `slot-${Date.now()}`;
    const slot = {
      id,
      label: $("slotLabel").value.trim(),
      start: $("slotStart").value,
      end: $("slotEnd").value
    };
    state.slots = state.slots.some((item) => item.id === id)
      ? state.slots.map((item) => item.id === id ? slot : item)
      : [...state.slots, slot];
    await saveSlotToDb(slot);
    event.target.reset();
    $("slotId").value = "";
    setAdminMessage("Slot saved.", "good");
    await loadAdminData();
  }

  document.addEventListener("click", async (event) => {
    const tab = event.target.closest("[data-tab]");
    if (tab) {
      state.activeTab = tab.dataset.tab;
      renderTabs();
      return;
    }

    const statusButton = event.target.closest("[data-booking-status]");
    if (statusButton) {
      state.bookings = state.bookings.map((booking) =>
        booking.id === statusButton.dataset.id ? { ...booking, status: statusButton.dataset.bookingStatus } : booking
      );
      await updateBookingStatus(statusButton.dataset.id, statusButton.dataset.bookingStatus);
      setAdminMessage("Booking status updated.", "good");
      await loadAdminData();
      return;
    }

    const deleteBooking = event.target.closest("[data-delete-booking]");
    if (deleteBooking && confirm("Delete this booking?")) {
      state.bookings = state.bookings.filter((booking) => booking.id !== deleteBooking.dataset.deleteBooking);
      await deleteDocFromDb("bookings", deleteBooking.dataset.deleteBooking);
      await loadAdminData();
      return;
    }

    const editRoom = event.target.closest("[data-edit-room]");
    if (editRoom) {
      const room = state.rooms.find((item) => item.id === editRoom.dataset.editRoom);
      $("roomId").value = room.id;
      $("roomName").value = room.name;
      $("roomType").value = room.type;
      $("roomCapacity").value = room.capacity;
      $("roomPrice").value = room.price;
      return;
    }

    const deleteRoom = event.target.closest("[data-delete-room]");
    if (deleteRoom && confirm("Delete this room?")) {
      state.rooms = state.rooms.filter((room) => room.id !== deleteRoom.dataset.deleteRoom);
      await deleteDocFromDb("rooms", deleteRoom.dataset.deleteRoom);
      await loadAdminData();
      return;
    }

    const editSlot = event.target.closest("[data-edit-slot]");
    if (editSlot) {
      const slot = state.slots.find((item) => item.id === editSlot.dataset.editSlot);
      $("slotId").value = slot.id;
      $("slotLabel").value = slot.label;
      $("slotStart").value = slot.start;
      $("slotEnd").value = slot.end;
      return;
    }

    const deleteSlot = event.target.closest("[data-delete-slot]");
    if (deleteSlot && confirm("Delete this slot?")) {
      state.slots = state.slots.filter((slot) => slot.id !== deleteSlot.dataset.deleteSlot);
      await deleteDocFromDb("slots", deleteSlot.dataset.deleteSlot);
      await loadAdminData();
    }
  });

  $("roomForm").addEventListener("submit", saveRoom);
  $("slotForm").addEventListener("submit", saveSlot);
  $("bookingSearch").addEventListener("input", renderBookings);
  $("statusFilter").addEventListener("change", renderBookings);
  $("refreshAdmin").addEventListener("click", () => loadAdminData());
  $("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("eliteAdminLoggedIn");
    window.location.href = "adminpass.html";
  });
  $("seedBtn").addEventListener("click", async () => {
    state.rooms = defaultRooms;
    state.slots = defaultSlots;
    if (firebaseReady()) {
      await Promise.all([
        ...defaultRooms.map((room) => db().collection("rooms").doc(room.id).set(room)),
        ...defaultSlots.map((slot) => db().collection("slots").doc(slot.id).set(slot))
      ]);
    } else {
      saveDb();
    }
    if (state.dataSource === "mysql") {
      await mysqlRequest("seed", {});
    }
    setAdminMessage("Default rooms and slots are ready.", "good");
    await loadAdminData();
  });

  loadAdminData().catch((error) => {
    setAdminMessage(`Database connection error: ${error.message}`, "bad");
  });
})();
