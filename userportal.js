(function () {
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
  const userKey = "elite-current-user";
  const $ = (id) => document.getElementById(id);
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const compactId = (id) => String(id || "").replace(/^booking-/, "").replace(/^BK-/, "BK").slice(-8).toUpperCase();

  const state = {
    rooms: defaultRooms,
    slots: defaultSlots,
    bookings: [],
    selectedSlotId: "morning",
    selectedSeatId: "",
    currentUser: null,
    dataSource: "local"
  };

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

  async function readCurrentUser() {
    try {
      const saved = localStorage.getItem(userKey);
      if (saved) state.currentUser = JSON.parse(saved);
    } catch {
      state.currentUser = null;
    }

    try {
      const response = await fetch("./api/user_auth1.php?action=session");
      const result = await response.json();
      if (result.ok && result.user) {
        state.currentUser = result.user;
        localStorage.setItem(userKey, JSON.stringify(result.user));
      }
    } catch {
      // Local fallback is enough when MySQL is not running.
    }
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

    const saved = localStorage.getItem(storeKey);
    if (!saved) {
      const db = { rooms: defaultRooms, slots: defaultSlots, bookings: [] };
      localStorage.setItem(storeKey, JSON.stringify(db));
      return db;
    }

    try {
      const db = JSON.parse(saved);
      if (!Array.isArray(db.rooms) || !db.rooms.some((room) => room.id === "pc-desk")) {
        const fresh = { rooms: defaultRooms, slots: defaultSlots, bookings: Array.isArray(db.bookings) ? db.bookings : [] };
        localStorage.setItem(storeKey, JSON.stringify(fresh));
        return fresh;
      }
      return db;
    } catch {
      const fresh = { rooms: defaultRooms, slots: defaultSlots, bookings: [] };
      localStorage.setItem(storeKey, JSON.stringify(fresh));
      return fresh;
    }
  }

  function saveDb() {
    localStorage.setItem(storeKey, JSON.stringify({
      rooms: state.rooms,
      slots: state.slots,
      bookings: state.bookings
    }));
  }

  async function saveBooking(booking) {
    if (state.dataSource === "mysql") {
      await mysqlRequest("booking", booking);
      return;
    }

    const safeBooking = { ...booking };
    delete safeBooking.password;

    if (firebaseReady()) {
      await db().collection("bookings").doc(safeBooking.id).set(safeBooking);
      return;
    }
    state.bookings.push(safeBooking);
    saveDb();
  }

  function setMessage(text, type) {
    const message = $("bookingMessage");
    message.textContent = text;
    message.className = `notice ${type || ""}`;
    message.hidden = false;
  }

  function bookingBlocksSlot(booking) {
    return !["rejected", "cancelled"].includes(String(booking.status || "").toLowerCase());
  }

  function selectedRoom() {
    return state.rooms.find((room) => room.id === $("roomSelect").value) || state.rooms[0];
  }

  function selectedSlot() {
    return state.slots.find((slot) => slot.id === state.selectedSlotId) || state.slots[0];
  }

  function activeBookingsFor(roomId, slotId, date) {
    return state.bookings.filter((booking) =>
      booking.roomId === roomId &&
      booking.slotId === slotId &&
      booking.date === date &&
      bookingBlocksSlot(booking)
    );
  }

  function seatLabel(room, index) {
    return `${room.seatPrefix || "S"}${index}`;
  }

  function renderSummary() {
    $("roomCount").textContent = state.rooms.length;
    $("slotCount").textContent = state.slots.length;
    $("todayCount").textContent = state.bookings.filter((booking) => booking.date === todayIso() && bookingBlocksSlot(booking)).length;
    $("dbMode").textContent = state.dataSource === "mysql" ? "XAMPP MySQL connected" : firebaseReady() ? "Firebase connected" : "Local backup database";
    if (state.currentUser) {
      $("userGreeting").textContent = `Welcome, ${state.currentUser.fullName}. Your bookings are private to your account.`;
      $("loginNotice").hidden = true;
    } else {
      $("userGreeting").textContent = "Login once, then choose your room, time, and seat.";
      $("loginNotice").hidden = false;
      $("loginNotice").innerHTML = `Please login first so only your bookings appear here. <a href="userauth.php"><b>Login / Register</b></a>`;
    }
  }

  function renderRooms() {
    $("roomSelect").innerHTML = state.rooms.map((room) =>
      `<option value="${room.id}">${room.name} - ${room.type} - Rs.${room.price}</option>`
    ).join("");
  }

  function renderSlots() {
    const room = selectedRoom();
    const date = $("bookingDate").value;
    $("slotGrid").innerHTML = state.slots.map((slot) => {
      const used = activeBookingsFor(room.id, slot.id, date).length;
      const left = Math.max(Number(room.capacity) - used, 0);
      const pressed = state.selectedSlotId === slot.id;
      return `
        <button class="slot-card" type="button" data-slot-id="${slot.id}" aria-pressed="${pressed}" ${left === 0 ? "disabled" : ""}>
          <strong>${slot.label}</strong>
          <span>${slot.start} - ${slot.end}</span>
          <span>${left} left</span>
        </button>
      `;
    }).join("");
  }

  function renderSeatMap() {
    const room = selectedRoom();
    const slot = selectedSlot();
    const date = $("bookingDate").value;
    const bookedSeats = new Set(activeBookingsFor(room.id, slot.id, date).map((booking) => booking.seatId));
    const isBoardRoom = room.id === "board-room";

    $("seatMap").className = `seat-map ${isBoardRoom ? "board" : ""}`;
    $("seatMap").innerHTML = Array.from({ length: Number(room.capacity) }, (_, index) => {
      const label = seatLabel(room, index + 1);
      const booked = bookedSeats.has(label);
      const selected = state.selectedSeatId === label;
      const title = isBoardRoom ? `Board Room ${index + 1}` : label;
      return `
        <button class="seat" type="button" data-seat-id="${label}" aria-pressed="${selected}" ${booked ? "disabled" : ""}>
          ${title}
        </button>
      `;
    }).join("");
  }

  function renderBookings() {
    const phone = state.currentUser?.phone || $("phone").value.trim();
    const bookings = state.bookings
      .filter((booking) => phone && booking.phone === phone)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
      .slice(0, 8);

    $("bookingList").innerHTML = bookings.length ? bookings.map((booking) => `
      <article class="item">
        <div class="item-head">
          <div>
            <h3>${booking.roomName} - ${booking.seatLabel}</h3>
            <div class="item-meta">${booking.date} | ${booking.slotLabel} | ${booking.userName} | ${booking.phone}</div>
            <div class="item-meta">Token: ${compactId(booking.id)} | Amount: Rs.${Number(booking.amount || booking.price || 0).toFixed(2)}</div>
          </div>
          <span class="badge ${booking.status}">${booking.status}</span>
        </div>
        <div class="actions">
          ${String(booking.status || "").toLowerCase() === "paid"
            ? `<a class="button" href="seat-allotted.html?bookingId=${encodeURIComponent(booking.id)}"><i class="fa-solid fa-print"></i> Print Token</a>`
            : `<a class="button" href="payment.html?bookingId=${encodeURIComponent(booking.id)}"><i class="fa-solid fa-credit-card"></i> Pay</a>`}
        </div>
      </article>
    `).join("") : `<div class="notice">Only your booking requests will appear here after login.</div>`;
  }

  function applyCurrentUserToForm() {
    if (!state.currentUser) return;
    $("userName").value = state.currentUser.fullName || "";
    $("phone").value = state.currentUser.phone || "";
    $("email").value = state.currentUser.email || "";
    $("userName").readOnly = true;
    $("phone").readOnly = true;
    $("email").readOnly = true;
  }

  function renderAll() {
    renderSummary();
    renderRooms();
    renderSlots();
    renderSeatMap();
    renderBookings();
  }

  async function loadData() {
    await readCurrentUser();
    const databaseData = await readDb();
    state.rooms = databaseData.rooms;
    state.slots = databaseData.slots;
    state.bookings = databaseData.bookings || [];
    if (!state.selectedSlotId && state.slots[0]) state.selectedSlotId = state.slots[0].id;
    applyCurrentUserToForm();
    renderAll();
  }

  async function submitBooking(event) {
    event.preventDefault();
    const room = selectedRoom();
    const slot = selectedSlot();
    const password = $("bookingPassword").value.trim();

    if (!state.selectedSeatId) {
      setMessage("Please select one available desk or board room.", "bad");
      return;
    }

    if (!state.currentUser) {
      setMessage("Please login or register before reserving a seat.", "bad");
      return;
    }

    if (!password) {
      setMessage("Please enter your account password to reserve this seat.", "bad");
      return;
    }

    const date = $("bookingDate").value;
    const alreadyBooked = activeBookingsFor(room.id, slot.id, date).some((booking) => booking.seatId === state.selectedSeatId);
    if (alreadyBooked) {
      setMessage("This selected desk is already booked. Please choose another.", "bad");
      loadData();
      return;
    }

    const booking = {
      id: `BK-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`,
      userId: state.currentUser?.id || "",
      userName: state.currentUser?.fullName || $("userName").value.trim(),
      phone: state.currentUser?.phone || $("phone").value.trim(),
      email: state.currentUser?.email || $("email").value.trim(),
      location: state.currentUser?.location || "",
      roomId: room.id,
      roomName: room.name,
      slotId: slot.id,
      slotLabel: slot.label,
      seatId: state.selectedSeatId,
      seatLabel: state.selectedSeatId,
      date,
      notes: $("notes").value.trim(),
      amount: Number(room.price || 0),
      password,
      status: "pending",
      source: "online",
      createdAt: new Date().toISOString()
    };

    await saveBooking(booking);

    // If saved successfully, redirect user to payment page AFTER admin approval.
    // Admin will approve booking status in dashboard, then user can pay from payment.html.
    setMessage("Booking request sent. Wait for admin approval. Redirecting to payment page...", "good");

    const paymentUrl = `payment.html?bookingId=${encodeURIComponent(booking.id)}`;
    setTimeout(() => {
      window.location.href = paymentUrl;
    }, 1200);

    $("bookingForm").reset();
    $("bookingDate").value = todayIso();
    state.selectedSeatId = "";
    await loadData();
  }


  document.addEventListener("click", (event) => {
    const slotButton = event.target.closest("[data-slot-id]");
    if (slotButton) {
      state.selectedSlotId = slotButton.dataset.slotId;
      state.selectedSeatId = "";
      renderSlots();
      renderSeatMap();
      return;
    }

    const seatButton = event.target.closest("[data-seat-id]");
    if (seatButton) {
      state.selectedSeatId = seatButton.dataset.seatId;
      renderSeatMap();
    }
  });

  $("bookingDate").value = todayIso();
  $("bookingForm").addEventListener("submit", submitBooking);
  $("roomSelect").addEventListener("change", () => {
    state.selectedSeatId = "";
    renderSlots();
    renderSeatMap();
  });
  $("bookingDate").addEventListener("change", () => {
    state.selectedSeatId = "";
    renderSlots();
    renderSeatMap();
  });
  $("refreshBtn").addEventListener("click", () => loadData());
  $("phone").addEventListener("change", renderBookings);
  loadData().catch((error) => {
    setMessage(`Database connection error: ${error.message}`, "bad");
  });
})();
