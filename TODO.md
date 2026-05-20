# TODO - Payment Page + PHP/XAMPP Integration

## Step 1: Create payment API
- Create `api/payment_api.php`
- Implement endpoints:
  - `POST action=pay`: validate booking exists and status is pending/approved (not cancelled)
  - Create `payments` table if missing (safe fallback)
  - Insert a payment record (amount, method, transaction ref)
  - Update `bookings.status` to `paid`
  - Return JSON for frontend

## Step 2: Create payment page UI
- Create `payment.html`
- Read `bookingId` from query string
- Show summary (user, room, seat, slot, date, total amount)
- Simulated UPI/Card amount payment form
- `Pay Now` calls `/api/payment_api.php?action=pay`

## Step 3: Wire redirect from booking to payment
- Edit `userportal.js`
- After booking request is successfully created, redirect to `payment.html?bookingId=...`
- Ensure this works when using MySQL API (action=booking returns ok)

## Step 4: Receipt print
- On payment success, show receipt preview
- Auto-generate simple receipt HTML with booking details
- Provide `Print Receipt` button (window.print)

## Step 5: Test on XAMPP
- Load `userportal.html`
- Create booking request
- Ensure redirect to `payment.html`
- Click Pay Now
- Confirm:
  - `bookings.status` updated
  - `payments` record inserted
  - receipt prints

