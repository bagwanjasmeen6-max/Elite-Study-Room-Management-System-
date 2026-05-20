<?php
declare(strict_types=1);

require __DIR__ . '/db.php';

$message = '';
$data = [];

try {
    $pdo = db();
    ensure_schema($pdo);

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $bookingId = 'test-' . time();
        $stmt = $pdo->prepare("INSERT INTO bookings (id, user_name, phone, email, room_id, room_name, slot_id, slot_label, seat_id, seat_label, booking_date, notes, amount, payment_method, payment_reference, payment_status, status, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'test-page')");
        $stmt->execute([
            $bookingId,
            $_POST['user_name'] ?? 'Test User',
            $_POST['phone'] ?? '9999999999',
            $_POST['email'] ?? '',
            'pc-desk',
            'PC Desk',
            'morning',
            'Morning',
            $_POST['seat_id'] ?? 'PC1',
            $_POST['seat_id'] ?? 'PC1',
            $_POST['booking_date'] ?? date('Y-m-d'),
            $_POST['notes'] ?? '',
            180,
            $_POST['payment_method'] ?? 'cash',
            $_POST['payment_reference'] ?? '',
            ($_POST['payment_method'] ?? 'cash') === 'cash' ? 'unpaid' : 'pending',
        ]);
        $message = 'POST success. Test booking saved with ID ' . $bookingId;
    }

    $data = $pdo->query("SELECT id, user_name, phone, room_name, seat_label, booking_date, payment_status, status FROM bookings ORDER BY created_at DESC LIMIT 10")->fetchAll();
} catch (Throwable $error) {
    $message = 'Error: ' . $error->getMessage();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GET POST Test</title>
    <link rel="stylesheet" href="../portal.css">
</head>
<body>
    <main class="shell">
        <section class="panel grid">
            <h1>PHP GET and POST Test</h1>
            <?php if ($message !== ''): ?>
                <div class="notice"><?php echo htmlspecialchars($message, ENT_QUOTES, 'UTF-8'); ?></div>
            <?php endif; ?>

            <form method="post" class="grid">
                <div class="grid two">
                    <div class="field">
                        <label>Name</label>
                        <input name="user_name" required value="Test Student">
                    </div>
                    <div class="field">
                        <label>Phone</label>
                        <input name="phone" required value="9999999999">
                    </div>
                </div>
                <div class="grid two">
                    <div class="field">
                        <label>Date</label>
                        <input type="date" name="booking_date" value="<?php echo date('Y-m-d'); ?>">
                    </div>
                    <div class="field">
                        <label>Seat</label>
                        <input name="seat_id" value="PC1">
                    </div>
                </div>
                <div class="field">
                    <label>Payment Method</label>
                    <select name="payment_method">
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="card">Card</option>
                        <option value="bank">Bank</option>
                    </select>
                </div>
                <button class="button" type="submit">POST Test Booking</button>
            </form>
        </section>

        <section class="panel">
            <h2>GET Latest Bookings</h2>
            <div class="list">
                <?php foreach ($data as $row): ?>
                    <article class="item">
                        <strong><?php echo htmlspecialchars($row['user_name'], ENT_QUOTES, 'UTF-8'); ?></strong>
                        <div class="item-meta">
                            <?php echo htmlspecialchars($row['room_name'] . ' | ' . $row['seat_label'] . ' | ' . $row['booking_date'] . ' | ' . $row['payment_status'], ENT_QUOTES, 'UTF-8'); ?>
                        </div>
                    </article>
                <?php endforeach; ?>
            </div>
        </section>
    </main>
</body>
</html>
